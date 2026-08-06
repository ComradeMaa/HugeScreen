import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  MAP_THICKNESS, geoToPlane, loadCountries, buildRegionGroup, buildMapFrame,
  lookupCountry, type CountryFeature,
} from './attackMap/geo';
import {
  aggregateAttacks, sourceLevelByTotal, LEVEL_STYLES,
  type AttackSource, type AttackTarget, type AttackEvent,
} from './attackGlobe/aggregate';
import { buildFlowSystem, updateLights, type FlowSystem } from './attackMap/arcs';
import { worldToScreen } from './projection';
import { PIN_ICON_PATHS } from './types';

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
  /** 攻击层对象（弧/粒子），数据更新时重建 */
  attackGroup: THREE.Group;
  flow: FlowSystem | null;
  /** 攻击源冲击波环（Sprite，每源 2 个错半周期） */
  rings: THREE.Sprite[];
  countries: CountryFeature[];
  /** 源/目标 DOM pin（屏幕投影定位） */
  pinContainer: HTMLDivElement;
}

const CYAN = 0x00d4ff;
/** 攻击源标记色（纯警告红 #FF1F1F，与攻击线高档同色系） */
const SOURCE_COLOR = '#ff1f1f';
/** 被攻击地点标记色（绿色系 #34d399） */
const TARGET_COLOR = '#34d399';
/** 冲击波扩散最大半径（世界 ~100 量级，地图宽 200 的 4%） */
const RING_MAX_RADIUS = 8;
/** 冲击波环淡出峰值透明度 */
const RING_PEAK_OPACITY = 0.6;
/** pin 图标尺寸 px */
const PIN_SIZE = 22;

/** 目标 pin 呼吸 keyframes（模块级注入一次，与球版 0.8 Hz 幅度 1.2 一致） */
let breathStyleInjected = false;
function ensureBreathStyle(): void {
  if (breathStyleInjected) return;
  breathStyleInjected = true;
  const st = document.createElement('style');
  st.textContent = `@keyframes amPinBreath { 0%,100% { transform: translate(-50%,-100%) scale(1); } 50% { transform: translate(-50%,-100%) scale(1.2); } }`;
  document.head.appendChild(st);
}

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
 * AttackMapWidget — 网络攻击平面世界地图（攻击地球的平面版，渲染/交互参照 CyberMap）：
 * 国家 Shape 挤出 3D 地图（可拖拽旋转/缩放/平移）+ 平面贝塞尔攻击弧线 + 移动亮段
 * + 源/目标 DOM 钉标记（攻击源红色脉冲、目标绿色呼吸）+ 悬停 tooltip 国家名反查。
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
    // 参照 CyberMap：近距透视相机，世界 ~100 量级
    const camera = new THREE.PerspectiveCamera(35, w / h, 1, 800);
    camera.position.set(0, 100, 113);
    camera.lookAt(0, -15, 0);

    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    // 地面网格（CyberMap 同款 GridHelper；showGrid 选项）
    if (showGrid) {
      const gh = new THREE.GridHelper(130, 26, 0x00d4ff, 0x00d4ff);
      (gh.material as THREE.Material).opacity = 0.12;
      (gh.material as THREE.Material).transparent = true;
      scene.add(gh);
    }

    // 国家挤出 3D 地图（加载后替换占位）+ 地图外框
    const frame = buildMapFrame(0.3);
    mapGroup.add(frame);

    const attackGroup = new THREE.Group();
    mapGroup.add(attackGroup);

    // 源/目标 DOM pin 层（覆盖在地图上，屏幕投影定位）
    const pinContainer = document.createElement('div');
    pinContainer.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    container.appendChild(pinContainer);

    let disposed = false;
    const renderOnce = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };

    // 异步加载国家数据 → 构建挤出几何
    (async () => {
      try {
        const countries = await loadCountries();
        if (disposed) return;
        mapGroup.add(buildRegionGroup(countries));
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

    sceneRef.current = { renderer, scene, camera, mapGroup, attackGroup, flow: null, rings: [], countries: [], pinContainer };
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
      pinContainer.remove();
      sceneRef.current = null;
    };
  }, [showGrid]);

  // ═══ 攻击层：聚合 → 弧线/亮段/冲击波 + 源/目标 DOM pin（场景就绪或数据变化时重建） ═══
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
    s.pinContainer.replaceChildren();

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

    // 源/目标 DOM pin（参照 CyberMap 地图钉：图标 + 发光 + 屏幕投影定位）
    // ★ 位置在 3D 世界（geoToPlane + 地图顶面），每帧由渲染循环投影到屏幕
    const makePin = (name: string, lng: number, lat: number, color: string, isTarget: boolean) => {
      const el = document.createElement('div');
      el.style.cssText =
        'position:absolute;transform:translate(-50%,-100%);pointer-events:auto;cursor:pointer;' +
        `filter:drop-shadow(0 0 4px ${color});`;
      if (isTarget) {
        ensureBreathStyle();
        el.style.animation = 'amPinBreath 1.25s ease-in-out infinite';
      }
      el.innerHTML = `<svg width="${PIN_SIZE}" height="${PIN_SIZE}" viewBox="0 0 24 24" fill="${color}" style="display:block"><path d="${PIN_ICON_PATHS.pulse}"/></svg>`;
      // 悬停 tooltip：名称 + 国家（followKey 供渲染循环跟随投影）
      const tooltip = tooltipRef.current;
      el.addEventListener('mouseenter', () => {
        if (!tooltip) return;
        const country = lookupCountry(s.countries, lat, lng);
        tooltip.textContent = `${isTarget ? '被攻击地点' : '攻击源'} ${name}${country ? `（${country.nameZh || country.name}）` : ''}`;
        tooltip.dataset.followKey = name;
        tooltip.style.opacity = '1';
      });
      el.addEventListener('mouseleave', () => {
        if (!tooltip) return;
        tooltip.style.opacity = '0';
        delete tooltip.dataset.followKey;
      });
      s.pinContainer.appendChild(el);
      (el as unknown as { __pinData: { name: string; lng: number; lat: number } }).__pinData = { name, lng, lat };
    };
    for (const src of sources) makePin(src.name, src.lng, src.lat, SOURCE_COLOR, false);
    for (const tgt of targets) makePin(tgt.name, tgt.lng, tgt.lat, TARGET_COLOR, true);

    // 攻击源冲击波环（3D Sprite，每源 2 个错半周期）
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const level = sourceLevelByTotal(aggregated, src.id);
      const pos = geoToPlane(src.lng, src.lat);
      pos.y = MAP_THICKNESS;
      const freq = LEVEL_STYLES[level].sourcePulseRate;
      for (const offset of [0, 0.5]) {
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({
          map: getRingTexture(),
          color: 0xff1f1f,
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneVersion, sources, targets, attacks, aggregationMode]);

  // ═══ 渲染循环：编辑/浏览模式都动画（数据流光/冲击波是组件本体效果） ═══
  // OrbitControls 交互（可旋转/平移/缩放，CyberMap 同款）+ pin 屏幕投影 + tooltip 跟随
  useEffect(() => {
    const s = sceneRef.current;
    const container = containerRef.current;
    if (!s || !container) return;

    const { camera, renderer, scene } = s;
    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, -15, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 30;
      controls.maxDistance = 500;
      controls.maxPolarAngle = Math.PI * 0.9;   // 限制俯仰，避免钻到地图下方
      controls.minPolarAngle = 0.05;
      controls.update();
    }

    // 渲染循环：阻尼 + 移动亮段 + 冲击波 + pin 投影 + tooltip 跟随
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
      // 源/目标 pin 屏幕投影（相机旋转/平移/缩放时实时更新）
      const cw = container.clientWidth || 400;
      const ch = container.clientHeight || 300;
      for (const el of s.pinContainer.children) {
        const p = (el as unknown as { __pinData: { lng: number; lat: number } }).__pinData;
        if (!p) continue;
        const wp = geoToPlane(p.lng, p.lat);
        wp.y = MAP_THICKNESS;
        const sp = worldToScreen(wp, camera, cw, ch);
        (el as HTMLElement).style.left = `${sp.x}px`;
        (el as HTMLElement).style.top = `${sp.y}px`;
      }
      // tooltip 跟随（pin 悬停后保持跟随源位置）
      const tooltip = tooltipRef.current;
      if (tooltip && tooltip.style.opacity !== '0' && tooltip.dataset.followKey) {
        for (const el of s.pinContainer.children) {
          const p = (el as unknown as { __pinData: { name: string; lng: number; lat: number } }).__pinData;
          if (p && p.name === tooltip.dataset.followKey) {
            const wp = geoToPlane(p.lng, p.lat);
            wp.y = MAP_THICKNESS;
            const sp = worldToScreen(wp, camera, cw, ch);
            tooltip.style.left = `${sp.x}px`;
            tooltip.style.top = `${sp.y - 18}px`;
            break;
          }
        }
      }
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (interactive) controls?.dispose();
      if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
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
