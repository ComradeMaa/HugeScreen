import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import type { MapPinType, MapPinInstance, DataSourceConfig } from '@hugescreen/shared';
import { computeRegionBounds, lngLatToWorld, worldToScreen, screenToWorld, xzToLngLat } from './projection';
import { PIN_ICON_PATHS } from './types';

// ─── 坐标系说明 ───
//
// ExtrudeGeometry 天然在 XY 面定义 Shape，沿 Z 轴挤出厚度。
// Three.js 默认 Y=上，地面 = XZ 面（GridHelper 在这里）。
// 因此需要 rotateX(-π/2) 把地图从 XY 面翻到 XZ 面。
// 旋转后：(x,y,z) → (x, z, -y)，底部 Y=0，顶部 Y=thickness。
//
// 查错：场景中添加了一个淡红色调试底面在 XZ 面 Y=-0.05。
// 如果红色底面看起来是平铺的（不是一条线），则相机角度正确。

// ─── Props ───

interface CyberMapWidgetProps {
  widgetId?: string;
  dataSource?: DataSourceConfig;
  thickness?: number;
  showGrid?: boolean;
  mapName?: string;
  pinTypes?: MapPinType[];
  pinInstances?: MapPinInstance[];
  pinEditMode?: boolean;
  onUpdate?: (patch: Record<string, unknown>) => void;
}

type LoadState = 'empty' | 'loading' | 'ready' | 'error';

const CYAN = 0x00d4ff;

// ─── 组件 ───

export function CyberMapWidget({
  widgetId,
  dataSource,
  thickness = 3,
  showGrid = true,
  mapName = '',
  pinTypes = [],
  pinInstances = [],
  pinEditMode = false,
  onUpdate,
}: CyberMapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);

  const [loadState, setLoadState] = useState<LoadState>('empty');
  const [errorMsg, setErrorMsg] = useState('');
  const [geoFeatures, setGeoFeatures] = useState<any[]>([]);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [bounds, setBounds] = useState<ReturnType<typeof computeRegionBounds> | null>(null);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    mapGroup: THREE.Group;
    running: boolean;
  } | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const dragRef = useRef<{ pinId: string; offsetX: number; offsetY: number } | null>(null);

  // ═══ 加载 GeoJSON ═══
  const loadGeoJson = useCallback(async () => {
    const ds = dataSource;
    if (!ds) { setLoadState('empty'); return; }

    setLoadState('loading');
    setErrorMsg('');

    try {
      let raw: any;

      if (ds.type === 'static' && ds.staticData) {
        raw = ds.staticData;
      } else if (ds.type === 'rest' && ds.config?.url) {
        const headers: Record<string, string> = {};
        if (ds.config.headers) {
          for (const [k, v] of Object.entries(ds.config.headers)) {
            if (k.toLowerCase() === 'authorization') {
              let t = String(v).trim();
              const ai = t.toLowerCase().indexOf('authorization:');
              if (ai !== -1) t = t.slice(ai + 14).trim();
              if (t.toLowerCase().startsWith('bearer ')) t = t.slice(7);
              if (t) headers[k] = 'Bearer ' + t;
            } else {
              headers[k] = String(v);
            }
          }
        }
        const res = await fetch(ds.config.url, {
          method: (ds.config.method as 'GET' | 'POST') ?? 'GET',
          headers,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        raw = await res.json();
      } else {
        setLoadState('empty');
        return;
      }

      if (!raw || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
        throw new Error('数据不是有效的 GeoJSON FeatureCollection');
      }

      const b = computeRegionBounds(raw.features);
      setBounds(b);
      setGeoFeatures(raw.features);
      setLoadState('ready');
    } catch (e: any) {
      setErrorMsg(e.message || '加载失败');
      setLoadState('error');
    }
  }, [dataSource]);

  useEffect(() => { loadGeoJson(); }, [loadGeoJson]);

  // ═══ Three.js 场景 ═══
  useEffect(() => {
    if (loadState !== 'ready' || !bounds || geoFeatures.length === 0) return;

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

    // ── Camera：透视相机 ──
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(35, aspect, 1, 800);
    camera.position.set(0, 100, 113);
    camera.lookAt(0, -15, 0);

    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    // ── 地面网格（XZ 面）──
    if (showGrid) {
      const gh = new THREE.GridHelper(130, 26, 0x00d4ff, 0x00d4ff);
      (gh.material as THREE.Material).opacity = 0.08;
      (gh.material as THREE.Material).transparent = true;
      scene.add(gh);
    }

    // ── 构建挤出几何体 ──
    // Shape(XY) → ExtrudeGeometry(Z) → applyMatrix4(rotX) → 平放 XZ 面
    // 用 applyMatrix4 而非 rotateX：后者会居中再旋转，导致几何体偏移
    const rotM4 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

    geoFeatures.forEach((feature) => {
      const geom = feature.geometry;
      if (!geom || geom.type !== 'MultiPolygon') return;

      const regionGroup = new THREE.Group();

      for (const polyCoords of geom.coordinates) {
        const rings: THREE.Vector3[][] = [];
        for (const ring of polyCoords) {
          rings.push(ring.map(([lng, lat]: number[]) =>
            lngLatToWorld(lng, lat, bounds)));
        }

        if (rings.length === 0) continue;
        const outer = rings[0];
        if (outer.length < 3) continue;

        const shape = new THREE.Shape();
        shape.moveTo(outer[0].x, outer[0].z);
        for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].z);
        shape.closePath();

        for (let h = 1; h < rings.length; h++) {
          const hole = rings[h];
          if (hole.length < 3) continue;
          const hp = new THREE.Path();
          hp.moveTo(hole[0].x, hole[0].z);
          for (let i = 1; i < hole.length; i++) hp.lineTo(hole[i].x, hole[i].z);
          hp.closePath();
          shape.holes.push(hp);
        }

        const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: thickness, bevelEnabled: false });
        // ★ applyMatrix4: 直接对每个顶点乘旋转矩阵，不居中，不偏移
        geo.applyMatrix4(rotM4);

        regionGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0x2c2c34, transparent: true, opacity: 0.25,
          side: THREE.DoubleSide, depthWrite: true,
        })));

        regionGroup.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(geo, 15),
          new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.7 }),
        ));
      }

      mapGroup.add(regionGroup);
    });

    // ── 辉光偏移层（顶面线框）──
    const glowGroup = new THREE.Group();
    glowGroup.position.y = thickness;
    geoFeatures.forEach((feature) => {
      const geom = feature.geometry;
      if (!geom || geom.type !== 'MultiPolygon') return;
      for (const polyCoords of geom.coordinates) {
        const outer = polyCoords[0];
        if (!outer || outer.length < 3) continue;

        const raw = outer.map(([lng, lat]: number[]) => lngLatToWorld(lng, lat, bounds));
        let cx = 0, cz = 0;
        raw.forEach(p => { cx += p.x; cz += p.z; });
        cx /= raw.length; cz /= raw.length;

        const shape = new THREE.Shape();
        for (let i = 0; i < raw.length; i++) {
          const p = raw[i];
          const d = Math.sqrt((p.x - cx) ** 2 + (p.z - cz) ** 2) || 1;
          const s = (d + 0.4) / d;
          if (i === 0) shape.moveTo(cx + (p.x - cx) * s, cz + (p.z - cz) * s);
          else shape.lineTo(cx + (p.x - cx) * s, cz + (p.z - cz) * s);
        }
        shape.closePath();

        const ggeo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: 0.3, bevelEnabled: false });
        ggeo.applyMatrix4(rotM4);
        glowGroup.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(ggeo, 15),
          new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.15 }),
        ));
      }
    });
    mapGroup.add(glowGroup);

    // ── 渲染（静态场景只渲染一次 + resize 时重渲染）──
    let disposed = false;
    const renderOnce = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };
    const requestRender = () => {
      if (disposed) return;
      requestAnimationFrame(renderOnce);
    };
    renderOnce();

    sceneRef.current = { renderer, scene, camera, mapGroup, running: false };
    setSceneVersion(v => v + 1);

    // ── ResizeObserver ──
    const ro = new ResizeObserver(() => {
      if (!container || !sceneRef.current) return;
      const cw = container.clientWidth || 400;
      const ch = container.clientHeight || 300;
      sceneRef.current.renderer.setSize(cw, ch);
      if (sceneRef.current.camera instanceof THREE.PerspectiveCamera) {
        sceneRef.current.camera.aspect = cw / ch;
        sceneRef.current.camera.updateProjectionMatrix();
      }
      requestRender();
    });
    ro.observe(container);
    resizeObsRef.current = ro;

    return () => {
      disposed = true;
      ro.disconnect();
      // GPU 资源完全释放
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [loadState, bounds, geoFeatures, thickness, showGrid]);

  // ═══ 钉屏幕坐标 ═══
  const pinScreenPositions = useMemo(() => {
    if (!bounds || !sceneRef.current) return [];
    const { camera } = sceneRef.current;
    const cw = threeRef.current?.clientWidth ?? 400;
    const ch = threeRef.current?.clientHeight ?? 300;

    return pinInstances.map((pi) => {
      const wp = lngLatToWorld(pi.lng, pi.lat, bounds);
      // 地图在 XZ 面，顶面 Y=thickness
      const pos = new THREE.Vector3(wp.x, thickness ?? 3, wp.z);
      const s = worldToScreen(pos, camera, cw, ch);
      return { ...pi, screenX: s.x, screenY: s.y };
    });
  }, [pinInstances, bounds, thickness, sceneVersion]);

  // ═══ 区域地名标签 ═══
  const regionLabels = useMemo(() => {
    if (!bounds || !sceneRef.current || geoFeatures.length === 0) return [];
    const { camera } = sceneRef.current;
    const cw = threeRef.current?.clientWidth ?? 400;
    const ch = threeRef.current?.clientHeight ?? 300;

    return geoFeatures
      .filter((f: any) => f.properties?.name)
      .map((f: any) => {
        const [lng, lat] = f.properties.centroid ?? f.properties.center ?? [0, 0];
        const wp = lngLatToWorld(lng, lat, bounds);
        // ★ Z 取反：applyMatrix4(rotX(-π/2)) 映射 (x,y,z)→(x,z,-y)
        // 地图几何体 Z = -wp.z，标签必须同步
        const pos = new THREE.Vector3(wp.x, thickness ?? 3, -wp.z);
        const s = worldToScreen(pos, camera, cw, ch);
        return { name: f.properties.name as string, screenX: s.x, screenY: s.y };
      });
  }, [geoFeatures, bounds, thickness, sceneVersion]);

  const pinTypeMap = useMemo(() => {
    const m: Record<string, MapPinType> = {};
    pinTypes.forEach(pt => { m[pt.id] = pt; });
    return m;
  }, [pinTypes]);

  // ═══ 钉拖拽 ═══
  const handlePinMouseDown = useCallback((e: React.MouseEvent, pinId: string) => {
    if (!pinEditMode) return;
    e.stopPropagation();
    e.preventDefault();

    const sc = sceneRef.current;
    if (!sc || !bounds) return;

    const rect = sc.renderer.domElement.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;

    // 当前鼠标 → 世界坐标
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mouseWorld = screenToWorld(mx, my, sc.camera, cw, ch,
      new THREE.Vector3(0, 1, 0), thickness ?? 3);
    if (!mouseWorld) return;

    // 钉当前世界坐标
    const pin = pinInstances.find(p => p.id === pinId);
    if (!pin) return;
    const pinWorld = lngLatToWorld(pin.lng, pin.lat, bounds);
    pinWorld.y = thickness ?? 3;

    // 世界空间偏移
    const off = new THREE.Vector3().subVectors(pinWorld, mouseWorld);
    dragRef.current = { pinId, offsetX: off.x, offsetY: off.z };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || dragRef.current.pinId !== pinId) return;
      const sc2 = sceneRef.current;
      if (!sc2 || !bounds) return;
      const r2 = sc2.renderer.domElement.getBoundingClientRect();
      const sx = ev.clientX - r2.left;
      const sy = ev.clientY - r2.top;
      const pt = screenToWorld(sx, sy, sc2.camera, r2.width, r2.height,
        new THREE.Vector3(0, 1, 0), thickness ?? 3);
      if (!pt) return;

      // 目标 = 鼠标 + 偏移
      const [lng, lat] = xzToLngLat(
        (pt.x + dragRef.current.offsetX) / bounds.scale + bounds.centerX,
        (pt.z + dragRef.current.offsetY) / bounds.scale + bounds.centerZ,
      );
      if (onUpdate) {
        onUpdate({ pinInstances: pinInstances.map(pi =>
          pi.id === pinId ? { ...pi, lng, lat } : pi) });
      }
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pinEditMode, bounds, pinInstances, onUpdate, thickness]);

  // ═══ 钉图标 ═══
  const renderPinIcon = (icon: string, color: string, size = 24) => {
    // A 字基站 + 两侧信号波纹
    if (icon === 'tower') {
      const s = size;
      return (
        <svg width={s} height={s} viewBox="0 0 24 24"
          style={{ filter: `drop-shadow(0 0 3px ${color})`, overflow: 'visible' }}>
          <style>{`
            @keyframes signalWave {
              0% { opacity: 0.8; transform: scale(0.5); }
              100% { opacity: 0; transform: scale(1.4); }
            }
            @keyframes towerBlink {
              0%, 100% { opacity: 0.8; }
              50% { opacity: 1; }
            }
          `}</style>
          {/* A 字塔架 */}
          <line x1="12" y1="4" x2="6" y2="22" stroke={color} strokeWidth="1" strokeLinecap="round" />
          <line x1="12" y1="4" x2="18" y2="22" stroke={color} strokeWidth="1" strokeLinecap="round" />
          <line x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth="0.5" opacity="0.5" />
          <line x1="9" y1="17" x2="15" y2="17" stroke={color} strokeWidth="0.5" opacity="0.3" />
          {/* 塔顶光点 */}
          <circle cx="12" cy="4" r="1.8" fill={color}
            style={{ animation: 'towerBlink 2s ease-in-out infinite' }} />
          {/* 左侧信号波纹 — 从塔顶发出，向外扩散 */}
          <g transform="translate(12, 4)" style={{ animation: 'signalWave 1.6s ease-out 0s infinite', transformOrigin: '12px 4px' }}>
            <path d="M-3,-2 Q-7,-6 -5,-10" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />
          </g>
          <g transform="translate(12, 4)" style={{ animation: 'signalWave 1.6s ease-out 0.4s infinite', transformOrigin: '12px 4px' }}>
            <path d="M-1.5,-2 Q-6,-6 -4,-11" fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
          </g>
          <g transform="translate(12, 4)" style={{ animation: 'signalWave 1.6s ease-out 0.8s infinite', transformOrigin: '12px 4px' }}>
            <path d="M0,-2 Q-5,-7 -3,-12" fill="none" stroke={color} strokeWidth="0.6" strokeLinecap="round" />
          </g>
          {/* 右侧信号波纹 */}
          <g transform="translate(12, 4)" style={{ animation: 'signalWave 1.6s ease-out 0.2s infinite', transformOrigin: '12px 4px' }}>
            <path d="M3,-2 Q7,-6 5,-10" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />
          </g>
          <g transform="translate(12, 4)" style={{ animation: 'signalWave 1.6s ease-out 0.6s infinite', transformOrigin: '12px 4px' }}>
            <path d="M1.5,-2 Q6,-6 4,-11" fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
          </g>
          <g transform="translate(12, 4)" style={{ animation: 'signalWave 1.6s ease-out 1s infinite', transformOrigin: '12px 4px' }}>
            <path d="M0,-2 Q5,-7 3,-12" fill="none" stroke={color} strokeWidth="0.6" strokeLinecap="round" />
          </g>
        </svg>
      );
    }

    // 脉冲环：CSS 动画 SVG，同心圆扩散 + 中心光点
    if (icon === 'pulse') {
      const s = size;
      return (
        <svg width={s} height={s} viewBox="0 0 24 24"
          style={{ filter: `drop-shadow(0 0 3px ${color})`, overflow: 'visible' }}>
          <style>{`
            @keyframes pinPulse1 {
              0% { r: 2; opacity: 0.9; }
              100% { r: 22; opacity: 0; }
            }
            @keyframes pinPulse2 {
              0% { r: 2; opacity: 0.7; }
              100% { r: 22; opacity: 0; }
            }
            @keyframes pinBlink {
              0%, 100% { opacity: 0.7; }
              50% { opacity: 1; }
            }
          `}</style>
          {/* 扩散环 */}
          <circle cx="12" cy="12" r="2" fill="none" stroke={color} strokeWidth="1.4"
            style={{ animation: 'pinPulse1 2s ease-out 0s infinite' }} />
          <circle cx="12" cy="12" r="2" fill="none" stroke={color} strokeWidth="1.1"
            style={{ animation: 'pinPulse2 2s ease-out 0.67s infinite' }} />
          <circle cx="12" cy="12" r="2" fill="none" stroke={color} strokeWidth="0.8"
            style={{ animation: 'pinPulse2 2s ease-out 1.33s infinite' }} />
          {/* 中心光点 */}
          <circle cx="12" cy="12" r="2" fill={color}
            style={{ animation: 'pinBlink 2s ease-in-out infinite' }} />
        </svg>
      );
    }

    const d = PIN_ICON_PATHS[icon as keyof typeof PIN_ICON_PATHS] ?? PIN_ICON_PATHS.circle;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
        <path d={d} fill={color} fillRule="evenodd" />
        <path d={d} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      </svg>
    );
  };

  // ═══ 渲染 ═══

  if (loadState === 'empty') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a22]/50 rounded">
        <div className="flex flex-col items-center gap-2 text-textSecondary/40 text-xs">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity={0.3}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>配置数据源以加载地图</span>
        </div>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a22]/50 rounded">
        <div className="flex flex-col items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00D4FF] animate-pulse" />
          <span className="text-textSecondary/40 text-xs">加载地图数据…</span>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a22]/50 rounded">
        <div className="flex flex-col items-center gap-2 max-w-[80%]">
          <span className="text-negative/60 text-xs font-semibold">加载失败</span>
          <span className="text-textSecondary/30 text-[11px] text-center">{errorMsg}</span>
          <button onClick={loadGeoJson}
            className="mt-1 text-[11px] text-accent-cool/70 hover:text-accent-cool px-3 py-1 rounded border border-[rgba(0,212,255,0.15)] transition-colors">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}
      className="w-full h-full relative overflow-hidden rounded"
      data-cyber-map={widgetId ?? ''}
      style={{ cursor: pinEditMode ? 'crosshair' : 'default' }}>

      {/* Three.js canvas */}
      <div ref={threeRef} className="absolute inset-0" />

      {/* 地名标签层 */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
        {regionLabels.map((rl, i) => (
          <div key={i}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: rl.screenX, top: rl.screenY }}>
            <span className="text-[10px] font-medium whitespace-nowrap select-none"
              style={{
                color: 'rgba(232,232,236,0.55)',
                textShadow: '0 0 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)',
              }}>
              {rl.name}
            </span>
          </div>
        ))}
      </div>

      {/* 地图钉覆盖层 */}
      <div className="absolute inset-0" style={{ pointerEvents: pinEditMode ? 'auto' : 'none' }}>
        {pinScreenPositions.map((pin) => {
          const pt = pinTypeMap[pin.pinTypeId];
          if (!pt) return null;
          return (
            <div key={pin.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: pin.screenX, top: pin.screenY, cursor: pinEditMode ? 'grab' : undefined, zIndex: pinEditMode ? 20 : 10 }}
              onMouseDown={(e) => handlePinMouseDown(e, pin.id)}>
              {renderPinIcon(pt.icon, pt.color ?? '#FF8C42', pinEditMode ? 36 : 28)}
              {pinEditMode && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#FF8C42]"
                  style={{ boxShadow: '0 0 4px #FF8C42' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* 地图名 */}
      {mapName && (
        <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
          style={{ bottom: '18%', zIndex: 8 }}>
          <style>{`
            @keyframes mapNameGlow {
              0%, 100% { text-shadow: 0 0 8px rgba(0,212,255,0.2), 0 0 16px rgba(0,212,255,0.08); }
              50% { text-shadow: 0 0 14px rgba(0,212,255,0.5), 0 0 28px rgba(0,212,255,0.2), 0 0 40px rgba(0,212,255,0.06); }
            }
            @keyframes mapNameFlow {
              0% { background-position: 0% 50%; }
              100% { background-position: 200% 50%; }
            }
          `}</style>
          <span
            className="text-3xl font-bold tracking-[0.5em] select-none"
            style={{
              background: 'linear-gradient(90deg, #00D4FF, #88EEFF, #00D4FF, #88EEFF)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'mapNameGlow 3s ease-in-out infinite, mapNameFlow 4s linear infinite',
            }}
          >
            {mapName}
          </span>
        </div>
      )}

      {/* 图例 */}
      {pinTypes.length > 0 && (
        <div className="absolute bottom-2 right-2 flex flex-col gap-1 px-2 py-1.5 rounded"
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {pinTypes.map((pt) => (
            <div key={pt.id} className="flex items-center gap-1.5">
              {renderPinIcon(pt.icon, pt.color ?? '#FF8C42', 16)}
              <span className="text-[10px] text-textSecondary/80 leading-none">{pt.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
