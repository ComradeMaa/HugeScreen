import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  MAP_W, MAP_H, geoToPlane, loadCountries, buildCountryTexture, buildCountryLines, buildLonLatPlane, createPlaneGrids, linesToGeometry,
  lookupCountry, type CountryFeature,
} from './attackMap/geo';
import {
  aggregateAttacks, sourceLevelByTotal, LEVEL_STYLES,
  type AttackSource, type AttackTarget, type AttackEvent,
} from './attackGlobe/aggregate';
import { buildFlowSystem, updateLights, type FlowSystem } from './attackMap/arcs';
import { worldToScreen } from './projection';

interface AttackMapWidgetProps {
  sources?: AttackSource[];
  targets?: AttackTarget[];
  attacks?: AttackEvent[];
  /** 显示经纬网格 */
  showGrid?: boolean;
  /** 强度聚合：分位数自动 / 固定阈值 */
  aggregationMode?: 'auto' | 'fixed';
  /** 浏览模式交互（ScreenCanvas 自动透传 interactive={!isEditing}） */
  interactive?: boolean;
}

interface SceneRef {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  mapGroup: THREE.Group;
  /** 攻击层对象（弧/粒子/标记），数据更新时重建 */
  attackGroup: THREE.Group;
  flow: FlowSystem | null;
  markers: THREE.Mesh[];
  /** 攻击源冲击波环（Sprite，每源 2 个错半周期） */
  rings: THREE.Sprite[];
  countries: CountryFeature[];
}

const CYAN = 0x00d4ff;
/** 源/目标标记统一半径（世界地图 ~100 量级，强度差异用冲击波频率体现） */
const MARKER_RADIUS = 3;
/** 攻击源标记（纯警告红 #FF1F1F，与攻击线高档同色系） */
const SOURCE_COLOR = 0xff1f1f;
/** 被攻击地点标记（绿色系 #34d399） */
const TARGET_COLOR = 0x34d399;
/** 冲击波扩散最大半径（场景单位，地图宽 200 的 5%） */
const RING_MAX_RADIUS = 10;
/** 冲击波环淡出峰值透明度 */
const RING_PEAK_OPACITY = 0.6;
/** 目标标记缓慢呼吸：幅度 1 ± 0.3，频率 0.8 Hz（统一节奏，不按强度） */
const TARGET_BREATH_AMPLITUDE = 0.3;
const TARGET_BREATH_RATE = 0.8;
/** 标记离地高度（高于边界线框 0.5，防 z-fighting） */
const MARKER_Y = 1.2;

/** 冲击波环纹理（模块级缓存，白色径向渐变环，SpriteMaterial.color 染色） */
let ringTexture: THREE.Texture | null = null;
function getRingTexture(): THREE.Texture {
  if (ringTexture) return ringTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  // ★ 渐变终止半径（31）必须小于到画布角距离（45）：canvas 渐变外部区域
  //   会填充为最后一个色标——若最后色标不透明，矩形四角会露出白色直角。
  //   最后色标设为透明 → 四角与渐变外区域全部透明，只剩中心圆环。
  const g = ctx.createRadialGradient(32, 32, 8, 32, 32, 31);
  g.addColorStop(0.0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0)');
  g.addColorStop(0.88, 'rgba(255,255,255,0.8)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ringTexture = new THREE.CanvasTexture(c);
  ringTexture.colorSpace = THREE.SRGBColorSpace;
  return ringTexture;
}

/**
 * AttackMapWidget — 网络攻击平面世界地图（attack-globe 的等距圆柱投影平面版）。
 * 平面国家多边形（填充+边界线）+ 平面贝塞尔攻击弧线 + 移动亮段（强度 4 档分档）。
 * 浏览模式：可拖拽平移/缩放（无旋转、无自动旋转）+ 粒子流动 + 标记悬停提示。
 * 编辑模式：静态单帧（多实例不空转 CPU）。
 */
export function AttackMapWidget({
  sources = [],
  targets = [],
  attacks = [],
  showGrid = true,
  aggregationMode = 'auto',
  interactive = false,
}: AttackMapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRef | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // ═══ 场景骨架 + 国家多边形（依赖 showGrid，异步加载国家数据） ═══
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 400;
    const h = container.clientHeight || 300;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // 参照 CyberMap 的场景参数：近距透视 + 归一化 ~100 量级世界
    const camera = new THREE.PerspectiveCamera(35, w / h, 1, 800);
    camera.position.set(0, 100, 113);
    camera.lookAt(0, -15, 0);

    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    // ★ 世界地图纹理平面（替代海洋球+三角剖分面片+边界线）：
    //   canvas 2D evenodd 填充原生处理自交/孔洞——三角剖分的空洞问题彻底消除
    //   DoubleSide：自定义网格 winding 不保证朝外，双面渲染兜底
    //   y=-0.5：纹理平面略低于弧线/线框（z-fighting 分层）
    const mapMesh = new THREE.Mesh(
      buildLonLatPlane(MAP_W, MAP_H),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    mapMesh.position.y = -0.5;
    mapGroup.add(mapMesh);
    // 平面经纬网格（直线，y=1 抬离地面；★ Additive 叠加微发光）
    if (showGrid) {
      mapGroup.add(new THREE.LineSegments(
        linesToGeometry(createPlaneGrids()),
        new THREE.LineBasicMaterial({
          color: CYAN,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
        }),
      ));
    }

    const attackGroup = new THREE.Group();
    mapGroup.add(attackGroup);

    let disposed = false;
    const renderOnce = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };

    // 异步加载国家数据 → 生成经纬度纹理贴平面
    (async () => {
      try {
        const countries = await loadCountries();
        if (disposed) return;
        const texture = new THREE.CanvasTexture(buildCountryTexture(countries));
        // ★ colorSpace：canvas 内容为 sRGB 数据，必须标注 SRGBColorSpace（否则按线性解读颜色错误）
        texture.colorSpace = THREE.SRGBColorSpace;
        // ★ 清晰度：CanvasTexture 默认 generateMipmaps=false（线性过滤，旋转/缩放发糊），
        //   显式开启三线性 mipmap + 各向异性过滤（4096×2048 是 2 的幂，mipmap 合法）
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 8;
        (mapMesh.material as THREE.MeshBasicMaterial).map = texture;
        (mapMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        // 国家边界线框（叠加在纹理上，地图轮廓清晰；只画线无 earcut 空洞问题）
        mapGroup.add(new THREE.LineSegments(
          linesToGeometry(buildCountryLines(countries)),
          new THREE.LineBasicMaterial({
            color: CYAN,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
          }),
        ));
        if (sceneRef.current) sceneRef.current.countries = countries;
        setLoadState('ready');
        renderOnce();
      } catch (e: any) {
        if (disposed) return;
        setErrorMsg(e.message || '国家数据加载失败');
        setLoadState('error');
      }
    })();

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!container || disposed) return;
      const cw = container.clientWidth || 400;
      const ch = container.clientHeight || 300;
      renderer.setSize(cw, ch);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderOnce();
    });
    ro.observe(container);

    sceneRef.current = { renderer, scene, camera, mapGroup, attackGroup, flow: null, markers: [], rings: [], countries: [] };
    setSceneVersion((v) => v + 1);
    renderOnce();

    return () => {
      disposed = true;
      ro.disconnect();
      // Sprite 不在 traverse 的 Mesh/LineSegments/Points 分支内，单独释放材质
      for (const r of sceneRef.current?.rings ?? []) (r.material as THREE.SpriteMaterial).dispose();
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Points) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material?.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [showGrid]);

  // ═══ 攻击层：聚合 → 弧线/粒子/标记（场景就绪或数据变化时重建） ═══
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;

    // 清理旧攻击层
    s.attackGroup.clear();
    if (s.flow) {
      for (const l of s.flow.lights) l.mesh.geometry.dispose();
      s.flow.lightMaterial.dispose();
      s.flow = null;
    }
    for (const r of s.rings) (r.material as THREE.SpriteMaterial).dispose();
    s.rings = [];
    s.markers = [];

    const aggregated = aggregateAttacks(sources, targets, attacks, aggregationMode);

    // 静态弧线（带状，档位色/透明度）+ 移动亮段（沿弧流动的动态线条）
    if (aggregated.length > 0) {
      const flow = buildFlowSystem(aggregated);
      if (flow) {
        s.flow = flow;
        for (const arc of flow.arcs) {
          s.attackGroup.add(new THREE.Mesh(
            arc.geometry,
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(arc.style.color),
              transparent: true,
              opacity: arc.style.arcOpacity,
              side: THREE.DoubleSide,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          ));
        }
        for (const l of flow.lights) s.attackGroup.add(l.mesh);
      }
    }

    // 源标记（红色系，脉冲频率按该源总攻击档位）+ 目标标记（绿色系，大小相同）
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const level = sourceLevelByTotal(aggregated, src.id);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(MARKER_RADIUS, 16, 16),
        new THREE.MeshBasicMaterial({ color: SOURCE_COLOR }),
      );
      const pos = geoToPlane(src.lng, src.lat);
      pos.y = MARKER_Y;
      mesh.position.copy(pos);
      mesh.userData = {
        kind: 'source', name: src.name, lat: src.lat, lng: src.lng,
        pulseRate: LEVEL_STYLES[level].sourcePulseRate,
        phase: i * 1.3,  // 多源错相，避免同步
      };
      s.attackGroup.add(mesh);
      s.markers.push(mesh);

      // 冲击波环：每源 2 个 Sprite 错半周期（一个淡出时另一个已在扩散，衔接无感）
      const freq = LEVEL_STYLES[level].sourcePulseRate;
      for (const offset of [0, 0.5]) {
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({
          map: getRingTexture(),
          color: SOURCE_COLOR,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }));
        ring.position.copy(pos);
        ring.scale.set(0, 0, 1);
        ring.userData = { freq, offset };
        ring.frustumCulled = false;
        s.attackGroup.add(ring);
        s.rings.push(ring);
      }
    }
    for (let i = 0; i < targets.length; i++) {
      const tgt = targets[i];
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(MARKER_RADIUS, 16, 16),
        new THREE.MeshBasicMaterial({ color: TARGET_COLOR }),
      );
      const pos = geoToPlane(tgt.lng, tgt.lat);
      pos.y = MARKER_Y;
      mesh.position.copy(pos);
      mesh.userData = {
        kind: 'target', name: tgt.name, lat: tgt.lat, lng: tgt.lng,
        phase: i * 1.1,  // 多目标错相呼吸
      };
      s.attackGroup.add(mesh);
      s.markers.push(mesh);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneVersion, sources, targets, attacks, aggregationMode]);

  // ═══ 渲染循环：编辑/浏览模式都动画（数据流光/冲击波/呼吸是组件本体效果） ═══
  // OrbitControls 拖拽 + 标记悬停 tooltip 仅浏览模式创建（编辑模式不抢占 dnd-kit 拖拽）
  useEffect(() => {
    const s = sceneRef.current;
    const container = containerRef.current;
    if (!s || !container) return;

    const { camera, renderer, scene } = s;
    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, -15, 0);   // 与 CyberMap 一致（lookAt 目标）
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 30;
      controls.maxDistance = 500;
      controls.enableRotate = false;  // 平面地图只平移+缩放，无旋转
      controls.enablePan = true;
      controls.update();
    }

    // 标记悬停 tooltip（直接操作 DOM，不经 React state；仅浏览模式）
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let hoveredMarker: THREE.Mesh | null = null;
    const tooltip = tooltipRef.current;
    const updateTooltip = (mesh: THREE.Mesh | null) => {
      if (!tooltip) return;
      if (!mesh) { tooltip.style.opacity = '0'; return; }
      const u = mesh.userData as { kind: string; name: string; lat: number; lng: number };
      const country = lookupCountry(s.countries, u.lat, u.lng);
      const label = u.kind === 'source'
        ? `攻击源 ${u.name}${country ? `（${country.nameZh || country.name}）` : ''}`
        : `被攻击地点 ${u.name}${country ? `（${country.nameZh || country.name}）` : ''}`;
      tooltip.textContent = label;
      tooltip.style.opacity = '1';
    };
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(s.markers, false);
      const hit = (hits[0]?.object as THREE.Mesh | undefined) ?? null;
      if (hit !== hoveredMarker) {
        hoveredMarker = hit;
        updateTooltip(hit);
        if (hit && tooltip) {
          // tooltip 跟随标记的屏幕投影
          const wp = hit.position.clone();
          const sp = worldToScreen(wp, camera, container.clientWidth, container.clientHeight);
          tooltip.style.left = `${sp.x}px`;
          tooltip.style.top = `${sp.y - 18}px`;
        }
      }
    };
    const onLeave = () => { updateTooltip(null); };
    if (interactive) {
      container.addEventListener('pointermove', onPointerMove);
      container.addEventListener('pointerleave', onLeave);
    }

    // 渲染循环：阻尼 + 移动亮段 + 冲击波 + 呼吸（平面版无自动旋转）
    let disposed = false;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const loop = () => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      elapsed += dt;
      if (controls) controls.update();
      if (s.flow) updateLights(s.flow, dt);
      // 攻击源冲击波：环从 0 扩散到 RING_MAX_RADIUS 并淡出，频率按强度档位（0.7~2.0 Hz）
      for (const ring of s.rings) {
        const u = ring.userData as { freq: number; offset: number };
        const p = (elapsed * u.freq + u.offset) % 1;
        const d = p * RING_MAX_RADIUS;
        ring.scale.set(d, d, 1);
        (ring.material as THREE.SpriteMaterial).opacity = (1 - p) * RING_PEAK_OPACITY;
      }
      // 被攻击目标缓慢呼吸：缩放 1 ± 0.3，统一 0.8 Hz（与源的冲击波区分）
      for (const m of s.markers) {
        if (m.userData.kind !== 'target') continue;
        const u = m.userData as { phase: number };
        const breath = 1 + TARGET_BREATH_AMPLITUDE * (0.5 + 0.5 * Math.sin(2 * Math.PI * TARGET_BREATH_RATE * elapsed + u.phase));
        m.scale.setScalar(breath);
      }
      // tooltip 每帧跟随标记屏幕投影（平移/缩放时位置实时更新）
      if (hoveredMarker && tooltip) {
        const sp = worldToScreen(hoveredMarker.position.clone(), camera, container.clientWidth, container.clientHeight);
        tooltip.style.left = `${sp.x}px`;
        tooltip.style.top = `${sp.y - 18}px`;
      }
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (interactive) {
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerleave', onLeave);
        controls?.dispose();
      }
      if (tooltip) tooltip.style.opacity = '0';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, sceneVersion]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-textSecondary/30 text-xs">
          地图加载中...
        </div>
      )}
      {loadState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-negative/70 text-xs">
          {errorMsg}
        </div>
      )}
      {/* 标记悬停提示（DOM overlay，投影跟随相机） */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 px-2 py-1 rounded text-[10px] whitespace-nowrap transition-opacity duration-150"
        style={{
          opacity: 0,
          background: 'rgba(44,44,52,0.92)',
          border: '1px solid rgba(0,212,255,0.25)',
          color: '#E8E8EC',
          transform: 'translate(-50%, -100%)',
        }}
      />
    </div>
  );
}
