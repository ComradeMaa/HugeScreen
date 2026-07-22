import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { DataSourceConfig } from '@hugescreen/shared';
import { computeRegionBounds, lngLatToWorld } from '../geo/projection';

// ─── 模块级缓存，最多 10 条，超出删最旧 ───
const MAX_CACHE = 10;
const dataCache = new Map<string, { data: any[]; bounds: ReturnType<typeof computeRegionBounds> }>();
const cacheOrder: string[] = [];

function cacheSet(key: string, val: { data: any[]; bounds: ReturnType<typeof computeRegionBounds> }) {
  if (dataCache.size >= MAX_CACHE) {
    const oldest = cacheOrder.shift();
    if (oldest) dataCache.delete(oldest);
  }
  dataCache.set(key, val);
  cacheOrder.push(key);
}

// ─── Props ───

interface CyberCityWidgetProps {
  widgetId?: string;
  dataSource?: DataSourceConfig;
  heightScale?: number;
  showGrid?: boolean;
}

type LoadState = 'empty' | 'loading' | 'ready' | 'error';

const CYAN = 0x00d4ff;

// ─── 建筑高度估算 ───

function estimateHeight(tags: Record<string, string>): number {
  const btype = tags.building ?? 'yes';
  // 类型 → 基准高度范围 [min, max]
  const ranges: Record<string, [number, number]> = {
    commercial: [20, 70],
    office: [25, 80],
    hotel: [20, 60],
    industrial: [15, 40],
    warehouse: [10, 25],
    apartment: [15, 50],
    dormitory: [12, 35],
    residential: [15, 45],
    house: [5, 12],
    detached: [5, 15],
    terrace: [5, 15],
    school: [10, 30],
    hospital: [15, 40],
    garage: [3, 8],
    shed: [3, 6],
    roof: [1, 3],
    yes: [8, 30],
  };
  const [lo, hi] = ranges[btype] ?? [8, 30];
  // 伪随机：基于 building id 保持稳定
  const hash = (tags.name ?? btype).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const t = (hash % 100) / 100;
  return lo + (hi - lo) * t;
}

// ─── 组件 ───

export function CyberCityWidget({
  dataSource,
  heightScale = 1,
  showGrid = true,
}: CyberCityWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);

  const [loadState, setLoadState] = useState<LoadState>('empty');
  const [errorMsg, setErrorMsg] = useState('');
  const [buildings, setBuildings] = useState<any[]>([]);
  const [bounds, setBounds] = useState<ReturnType<typeof computeRegionBounds> | null>(null);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    running: boolean;
  } | null>(null);

  // ═══ 加载 OSM 数据（带缓存 + 加载锁 + 超时 + 卸载保护）═══
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadData = useCallback(async () => {
    const ds = dataSource;
    if (!ds) { setLoadState('empty'); return; }
    if (loadingRef.current) return;
    loadingRef.current = true;

    const cacheKey = ds.type === 'rest' ? (ds.config?.url ?? '') : JSON.stringify(ds.staticData ?? '');

    const cached = dataCache.get(cacheKey);
    if (cached) {
      if (!mountedRef.current) { loadingRef.current = false; return; }
      setBounds(cached.bounds);
      setBuildings(cached.data);
      setLoadState('ready');
      loadingRef.current = false;
      return;
    }

    if (!mountedRef.current) { loadingRef.current = false; return; }
    setLoadState('loading');
    setErrorMsg('');

    try {
      let allElems: any[] = [];

      if (ds.type === 'static' && ds.staticData) {
        allElems = (ds.staticData as any)?.elements ?? [];
      } else if (ds.type === 'rest' && ds.config?.url) {
        const baseUrl = ds.config.url;
        const fetchQuery = async (url: string, label: string) => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 15000);
          try {
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
            const data = await res.json();
            return (data?.elements ?? []) as any[];
          } catch (e: any) {
            clearTimeout(timer);
            if (e.name === 'AbortError') throw new Error(`${label}: 请求超时`);
            throw e;
          }
        };

        const bldUrl = baseUrl.replace(/\["highway"\]/, '["building"]').replace(/way\["highway"\]/, 'way["building"]');
        const roadUrl = baseUrl.replace(/\["building"\]/, '["highway"]').replace(/way\["building"\]/, 'way["highway"]');

        const [bldElems, roadElems] = await Promise.all([
          fetchQuery(bldUrl, '建筑'),
          fetchQuery(roadUrl, '道路').catch(() => [] as any[]),
        ]);
        allElems = [...bldElems, ...roadElems];
      } else {
        if (mountedRef.current) setLoadState('empty');
        loadingRef.current = false;
        return;
      }

      if (!mountedRef.current) { loadingRef.current = false; return; }
      if (!Array.isArray(allElems)) throw new Error('数据格式错误');
      const filtered = allElems.filter((e: any) =>
        e.type === 'way' && e.geometry && Array.isArray(e.geometry) && e.geometry.length >= 2,
      );
      if (filtered.length === 0) throw new Error('没有找到建筑数据');

      const features = filtered.map((b: any) => ({
        geometry: {
          type: 'MultiPolygon' as const,
          coordinates: [[b.geometry.map((p: any) => [p.lon, p.lat])]],
        },
      }));
      const b = computeRegionBounds(features);

      cacheSet(cacheKey, { data: filtered, bounds: b });
      if (!mountedRef.current) { loadingRef.current = false; return; }
      setBounds(b);
      setBuildings(filtered);
      setLoadState('ready');
    } catch (e: any) {
      if (mountedRef.current) {
        if (e.name === 'AbortError') setErrorMsg('请求超时，请缩小查询范围');
        else setErrorMsg(e.message || '加载失败');
        setLoadState('error');
      }
    } finally {
      loadingRef.current = false;
    }
  }, [dataSource]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  // ═══ Three.js 场景 ═══
  useEffect(() => {
    if (loadState !== 'ready' || !bounds || buildings.length === 0) return;
    const container = threeRef.current;
    if (!container) return;
    const w = container.clientWidth || 400;
    const h = container.clientHeight || 300;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;

    // ── Camera：等距俯视 ──
    const aspect = w / h;
    const frustumSize = 130;
    const camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2, frustumSize * aspect / 2,
      frustumSize / 2, -frustumSize / 2, 0.1, 800,
    );
    camera.position.set(50, 80, 60);
    camera.lookAt(0, 0, 0);

    const cityGroup = new THREE.Group();
    scene.add(cityGroup);

    // ── 地面网格 ──
    if (showGrid) {
      const gh = new THREE.GridHelper(120, 20, 0x00d4ff, 0x00d4ff);
      (gh.material as THREE.Material).opacity = 0.06;
      (gh.material as THREE.Material).transparent = true;
      scene.add(gh);
    }

    // ── 构建建筑 + 道路 ──
    const rotM4 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

    // 城市跨度（世界单位，约 100）
    const citySpan = Math.max(
      (bounds.maxX - bounds.minX) * bounds.scale,
      (bounds.maxZ - bounds.minZ) * bounds.scale,
    );

    // 分离建筑和道路
    const bldElements = buildings.filter((b: any) => b.tags?.building);
    const roadElements = buildings.filter((b: any) => b.tags?.highway);

    // ── 道路线 ──
    roadElements.forEach((road: any) => {
      if (road.geometry.length < 2) return;
      const pts = road.geometry.map((p: any) =>
        lngLatToWorld(p.lon, p.lat, bounds));

      const positions: number[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i].x, 0.05, pts[i].z, pts[i + 1].x, 0.05, pts[i + 1].z);
      }
      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      cityGroup.add(new THREE.LineSegments(roadGeo,
        new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.12 })));
    });

    // ── 建筑 ──
    bldElements.forEach((bld: any) => {
      const pts = bld.geometry.map((p: any) =>
        lngLatToWorld(p.lon, p.lat, bounds));
      if (pts.length < 3) return;

      // 几何中心
      let cx = 0, cz = 0;
      pts.forEach((p: any) => { cx += p.x; cz += p.z; });
      cx /= pts.length; cz /= pts.length;

      // 大幅外扩 footprint + 最小尺寸保证
      const minRadius = citySpan * 0.05; // 最小半径 = 城市跨度 5%
      const shape = new THREE.Shape();
      for (let i = 0; i < pts.length; i++) {
        const dx = pts[i].x - cx;
        const dz = pts[i].z - cz;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        const s = Math.max(dist * 8, minRadius) / dist; // 至少放大到 minRadius
        const nx = cx + dx * s;
        const nz = cz + dz * s;
        if (i === 0) shape.moveTo(nx, nz);
        else shape.lineTo(nx, nz);
      }
      shape.closePath();

      // 高度 = 正态分布因子 × 类型基准
      // 离中心越远越低，中心最高，边缘趋近于零
      const distFromCenter = Math.sqrt(cx * cx + cz * cz);
      const sigma = citySpan * 0.16; // 标准差 ≈ 城市半径的 1/3
      const gauss = Math.exp(-(distFromCenter * distFromCenter) / (2 * sigma * sigma));
      const actualMeters = estimateHeight(bld.tags ?? {});
      const h = (actualMeters / 80) * citySpan * 0.70 * heightScale * gauss;
      const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: Math.max(h, 0.8), bevelEnabled: false });
      geo.applyMatrix4(rotM4);

      // 面颜色：高度越高越偏青
      const heightRatio = Math.min(h / (citySpan * 0.7), 1);
      const r = 0.08 + heightRatio * 0.04;
      const g = 0.08 + heightRatio * 0.08;
      const b = 0.12 + heightRatio * 0.12;
      const faceColor = new THREE.Color(r, g, b);

      const bldGroup = new THREE.Group();
      bldGroup.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: faceColor,
        transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: true,
        specular: 0x111111, shininess: 20,
      })));
      bldGroup.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 15),
        new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35 }),
      ));
      cityGroup.add(bldGroup);
    });

    // ── 空地填充：确定性种子随机（同数据同结果）──
    if (bldElements.length > 0) {
      const fillCount = Math.min(bldElements.length * 2, 120);
      const bldCenters = bldElements.map((b: any) => {
        const p = b.geometry.map((g: any) => lngLatToWorld(g.lon, g.lat, bounds));
        const c = { x: 0, z: 0 };
        p.forEach((pt: any) => { c.x += pt.x; c.z += pt.z; });
        c.x /= p.length; c.z /= p.length;
        return c;
      });

      // 确定性种子：基于建筑数据的 hash
      const seedHash = bldElements.reduce((a: number, b: any) =>
        a + (b.id ?? 0) + b.geometry.length, 0);
      let seed = seedHash % 10000;
      const srand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

      let placed = 0;
      let attempts = 0;
      while (placed < fillCount && attempts < 800) {
        attempts++;
        const rx = (srand() - 0.5) * citySpan * 0.9;
        const rz = (srand() - 0.5) * citySpan * 0.9;
        const tooClose = bldCenters.some(c => Math.hypot(c.x - rx, c.z - rz) < citySpan * 0.018);
        if (tooClose) continue;

        // 矮宽矩形：更宽，更低
        const w = citySpan * 0.03 * (0.5 + srand() * 2);
        const d = citySpan * 0.02 * (0.5 + srand() * 1.5);
        const shape = new THREE.Shape();
        shape.moveTo(rx - w, rz - d);
        shape.lineTo(rx + w, rz - d);
        shape.lineTo(rx + w, rz + d);
        shape.lineTo(rx - w, rz + d);
        shape.closePath();

        const fh = citySpan * 0.08 * (0.2 + srand() * 0.6);
        const fgeo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: fh, bevelEnabled: false });
        fgeo.applyMatrix4(rotM4);

        const fg = new THREE.Group();
        fg.add(new THREE.Mesh(fgeo, new THREE.MeshPhongMaterial({
          color: 0x12141a, transparent: true, opacity: 0.85,
          side: THREE.DoubleSide, depthWrite: true,
          specular: 0x111111, shininess: 20,
        })));
        fg.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(fgeo, 15),
          new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.2 }),
        ));
        cityGroup.add(fg);
        placed++;
      }
    }

    // ── 光照 ──
    scene.add(new THREE.AmbientLight(0x446688, 1.2));
    const dirLight = new THREE.DirectionalLight(0xaaccff, 0.8);
    dirLight.position.set(60, 100, 40);
    scene.add(dirLight);

    // ── 地面暗底 ──
    const groundGeo = new THREE.PlaneGeometry(140, 140);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({
      color: 0x111118, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    scene.add(ground);

    // ── 渲染循环 ──
    let running = true;
    const animate = () => {
      if (!running) return;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    sceneRef.current = { renderer, scene, camera, running };

    // ── ResizeObserver ──
    const ro = new ResizeObserver(() => {
      if (!container || !sceneRef.current) return;
      const cw = container.clientWidth || 400;
      const ch = container.clientHeight || 300;
      sceneRef.current.renderer.setSize(cw, ch);
      if (sceneRef.current.camera instanceof THREE.OrthographicCamera) {
        const fs = 130;
        const ca = cw / ch;
        sceneRef.current.camera.left = -fs * ca / 2;
        sceneRef.current.camera.right = fs * ca / 2;
        sceneRef.current.camera.top = fs / 2;
        sceneRef.current.camera.bottom = -fs / 2;
        sceneRef.current.camera.updateProjectionMatrix();
      }
    });
    ro.observe(container);

    return () => {
      running = false;
      ro.disconnect();
      // 释放所有 GPU 资源
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
          child.geometry?.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => m?.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [loadState, bounds, buildings, heightScale, showGrid]);

  // ═══ 渲染 ═══
  if (loadState === 'empty') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#111118]/50 rounded">
        <div className="flex flex-col items-center gap-2 text-textSecondary/40 text-xs">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity={0.3}>
            <rect x="3" y="3" width="7" height="8" /><rect x="14" y="3" width="7" height="12" />
            <rect x="8" y="13" width="6" height="8" /><rect x="8" y="4" width="6" height="8" />
          </svg>
          <span>配置数据源以加载建筑数据</span>
        </div>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#111118]/50 rounded">
        <div className="flex flex-col items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00D4FF] animate-pulse" />
          <span className="text-textSecondary/40 text-xs">加载建筑数据…</span>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#111118]/50 rounded">
        <div className="flex flex-col items-center gap-2 max-w-[80%]">
          <span className="text-negative/60 text-xs font-semibold">加载失败</span>
          <span className="text-textSecondary/30 text-[11px] text-center">{errorMsg}</span>
          <button onClick={loadData}
            className="mt-1 text-[11px] text-accent-cool/70 hover:text-accent-cool px-3 py-1 rounded border border-[rgba(0,212,255,0.15)] transition-colors">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded">
      <div ref={threeRef} className="absolute inset-0" />
      {/* 建筑数量标识 */}
      <div className="absolute top-2 right-2 pointer-events-none" style={{ zIndex: 10 }}>
        <span className="text-[10px] text-textSecondary/40 font-mono">
          {buildings.length} 栋建筑
        </span>
      </div>
    </div>
  );
}
