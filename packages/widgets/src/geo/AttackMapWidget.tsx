import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  geoToPlane, loadCountries,
  buildCountryTexture, buildLonLatPlane, buildCountryLines, linesToGeometry,
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
  /** 卷轴滚动组：平面/线框/弧线全部随 position.x 无限滚动（wrap ±200 整周期无缝） */
  scrollGroup: THREE.Group;
  /** 攻击层对象（弧/粒子），数据更新时重建 */
  attackGroup: THREE.Group;
  flow: FlowSystem | null;
  /** 弧线组（每弧一个 Group，userData.midX = 端点中心；卷轴镜像 wrap 用） */
  arcGroups: THREE.Group[];
  /** 攻击源冲击波环（Sprite，每源 2 个错半周期） */
  rings: THREE.Sprite[];
  /** 源/目标标记（2D 圆盘贴平面，raycast tooltip 用） */
  markers: THREE.Mesh[];
  countries: CountryFeature[];
  /** 地图纹理（卷轴滚动 offset 用） */
  mapTexture: THREE.Texture | null;
}

const CYAN = 0x00d4ff;
/** 攻击源标记色（纯警告红 #FF1F1F，与攻击线高档同色系） */
const SOURCE_COLOR = '#ff1f1f';
/** 被攻击地点标记色（绿色系 #34d399） */
const TARGET_COLOR = '#34d399';
/** 冲击波扩散最大半径（世界 ~100 量级，地图宽 100 的 8%） */
const RING_MAX_RADIUS = 8;
/** 冲击波环淡出峰值透明度 */
const RING_PEAK_OPACITY = 0.6;
/** 源/目标 2D 圆盘半径（世界 ~100 量级） */
const MARKER_RADIUS = 2;
/** 标记贴地高度（几乎贴平面，无高度差） */
const MARKER_Y = 0.01;
/** 目标标记缓慢呼吸：幅度 1 ± 0.3，频率 0.8 Hz（统一节奏，不按强度） */
const TARGET_BREATH_AMPLITUDE = 0.3;
const TARGET_BREATH_RATE = 0.8;

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
    // ★ 卷轴式平面地图：相机垂直俯视（y 轴正上方），距离 = 地图高 50 / 垂直视野
    //   → 画面精确铺满组件上下边界；左键拖拽左右平移（首尾无缝循环），滚轮缩放。
    const camera = new THREE.PerspectiveCamera(35, w / h, 1, 800);
    const CAM_DIST = 50 / (2 * Math.tan(THREE.MathUtils.degToRad(35 / 2))); // ≈79.4
    camera.position.set(0, CAM_DIST, 0);
    // ★ 垂直俯视必须改 up：默认 up=(0,1,0) 与视线平行 → lookAt 退化 → 画面斜歪。
    //   up=(0,0,-1)：屏幕上方 = 世界 -z = 北（地图正立）
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    const mapGroup = new THREE.Group();
    scene.add(mapGroup);
    // ★ 卷轴滚动组：平面/线框/攻击层全部随 position.x 无限滚动。
    //   平面 3 副本（±200 周期偏移）→ 任意滚动位置视野内总有几何；
    //   scroll wrap 跳整周期 200 = 内容视觉无缝（地图宽度 = 200 = 周期）
    const scrollGroup = new THREE.Group();
    mapGroup.add(scrollGroup);

    // 单面纹理地图平面（y=0，厚度 0）×3 副本
    const mapMesh = new THREE.Mesh(
      buildLonLatPlane(),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    for (const dx of [-100, 0, 100]) {
      const copy = mapMesh.clone();
      copy.position.x = dx;
      scrollGroup.add(copy);
    }

    const attackGroup = new THREE.Group();
    scrollGroup.add(attackGroup);

    let disposed = false;
    const renderOnce = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };

    // 异步加载国家数据 → 经纬度纹理贴平面 + 边界线框
    (async () => {
      try {
        const countries = await loadCountries();
        if (disposed) return;
        const texture = new THREE.CanvasTexture(buildCountryTexture(countries));
        // ★ 卷轴滚动：RepeatWrapping + offset.x 随相机平移反向滚动（左右边缘内容连续 = 俄罗斯跨接）
        texture.wrapS = THREE.RepeatWrapping;
        // ★ colorSpace：canvas 内容为 sRGB 数据，必须标注 SRGBColorSpace（否则按线性解读颜色错误）
        texture.colorSpace = THREE.SRGBColorSpace;
        // ★ 清晰度：CanvasTexture 默认 generateMipmaps=false（线性过滤，旋转/缩放发糊），
        //   显式开启三线性 mipmap + 各向异性过滤（4096×2048 是 2 的幂，mipmap 合法）
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 8;
        // 3 副本共享材质 → 贴一次全部生效
        (mapMesh.material as THREE.MeshBasicMaterial).map = texture;
        (mapMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        // 国家边界线框（叠加在纹理上，地图轮廓清晰；只画线无 earcut 空洞问题）×3 副本
        const frameMat = new THREE.LineBasicMaterial({
          color: 0x00d4ff,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
        });
        for (const dx of [-100, 0, 100]) {
          const frame = new THREE.LineSegments(linesToGeometry(buildCountryLines(countries)), frameMat);
          frame.position.x = dx;
          scrollGroup.add(frame);
        }
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

    sceneRef.current = { renderer, scene, camera, mapGroup, scrollGroup, attackGroup, flow: null, arcGroups: [], rings: [], markers: [], countries: [], mapTexture: null };
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
    s.arcGroups = [];
    s.markers = [];

    const aggregated = aggregateAttacks(sources, targets, attacks, aggregationMode);

    // 静态弧线（带状，档位色/透明度）+ 移动亮段（沿弧流动的动态线条）
    if (aggregated.length > 0) {
      const flow = buildFlowSystem(aggregated);
      if (flow) {
        s.flow = flow;
        // ★ 每弧一个 Group（静态弧 + 亮段同组）：卷轴滚动时 group.position.x 按
        //   200 世界单位周期镜像 wrap（弧线跟随地图无限循环，亮段坐标随组平移）
        for (const arc of flow.arcs) {
          const g = new THREE.Group();
          g.userData.midX = (arc.a.x + arc.b.x) / 2; // 端点中心（镜像基准）
          g.add(new THREE.Mesh(
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
          s.attackGroup.add(g);
          s.arcGroups.push(g);
        }
        for (const l of flow.lights) {
          const g = s.arcGroups[l.arcIndex];
          if (g) g.add(l.mesh);
        }
      }
    }

    // 源/目标标记：2D 圆盘贴平面（CircleGeometry，y=0.01 无高度差，随卷轴滚动）
    // ★ 悬停 tooltip 用 raycast（标记是 3D 对象，raycaster 自动处理 scrollGroup 变换）
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const level = sourceLevelByTotal(aggregated, src.id);
      const pos = geoToPlane(src.lng, src.lat);
      pos.y = MARKER_Y;
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(MARKER_RADIUS, 32),
        new THREE.MeshBasicMaterial({ color: SOURCE_COLOR, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
      );
      // ★ CircleGeometry 默认在 XY 平面（法线 +z）→ 垂直俯视看到侧面细线；
      //   旋转到 XZ 平面（法线 +y）与地图平行，俯视显示正圆
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(pos);
      mesh.userData = {
        kind: 'source', name: src.name, lat: src.lat, lng: src.lng,
        pulseRate: LEVEL_STYLES[level].sourcePulseRate,
        phase: i * 1.3,  // 多源错相，避免同步
      };
      s.attackGroup.add(mesh);
      s.markers.push(mesh);
    }
    for (let i = 0; i < targets.length; i++) {
      const tgt = targets[i];
      const pos = geoToPlane(tgt.lng, tgt.lat);
      pos.y = MARKER_Y;
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(MARKER_RADIUS, 32),
        new THREE.MeshBasicMaterial({ color: TARGET_COLOR, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2; // 平放 XZ 平面（法线 +y），俯视正圆
      mesh.position.copy(pos);
      mesh.userData = {
        kind: 'target', name: tgt.name, lat: tgt.lat, lng: tgt.lng,
        phase: i * 1.1,  // 多目标错相呼吸
      };
      s.attackGroup.add(mesh);
      s.markers.push(mesh);
    }

    // 攻击源冲击波环（Sprite，贴地扩散，每源 2 个错半周期）
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const level = sourceLevelByTotal(aggregated, src.id);
      const pos = geoToPlane(src.lng, src.lat);
      pos.y = MARKER_Y;
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
        ring.userData = { freq, offset, lng: src.lng, lat: src.lat }; // lng/lat 供卷轴镜像
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

    const { camera, renderer, scene, scrollGroup } = s;
    const MAP_PERIOD = 100; // 地图宽度（世界单位）= 卷轴镜像周期（geoToPlane：lon ±180 → x ±50）

    // ★ 卷轴交互：左键拖拽 = 左右平移（scrollGroup 无限滚动，几何 3 副本始终覆盖视野）
    //   OrbitControls 仅保留滚轮缩放（旋转/平移禁用）
    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enableRotate = false;
      controls.enablePan = false;
      controls.enableZoom = false; // 卷轴模式禁用滚轮缩放（相机固定视角）
      controls.update();
      // 左键拖拽平移（世界 x 方向）
      let dragging = false;
      let lastX = 0;
      const pxToWorld = () => {
        // 垂直俯视：屏幕高 h px ↔ 视野高 2·dist·tan(fov/2)；dist = 相机 y
        const ch = container.clientHeight || 300;
        const dist = camera.position.y || 150;
        return (2 * dist * Math.tan(THREE.MathUtils.degToRad(35 / 2))) / ch;
      };
      const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return; // 仅左键
        dragging = true;
        lastX = e.clientX;
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        // 内容跟随鼠标拖动方向：拖右 → 内容右移（scrollGroup.position.x 增加）
        scrollGroup.position.x += dx * pxToWorld();
      };
      const onUp = () => { dragging = false; };
      container.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      // cleanup 引用
      (controls as unknown as { __cleanup: () => void }).__cleanup = () => {
        container.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
    }

    // 标记悬停 tooltip（raycast 2D 圆盘标记；直接操作 DOM，不经 React state；仅浏览模式）
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let hoveredMarker: THREE.Mesh | null = null;
    const tooltip = tooltipRef.current;
    const updateTooltip = (mesh: THREE.Mesh | null) => {
      if (!tooltip) return;
      if (!mesh) { tooltip.style.opacity = '0'; return; }
      const u = mesh.userData as { kind: string; name: string; lat: number; lng: number };
      // ★ 显示名以经纬度反查的国家为准（城市名不随坐标更新，会出现"埃塞俄比亚的莫斯科"式矛盾）；
      //   反查不到国家（如海上）才退回城市名
      const country = lookupCountry(s.countries, u.lat, u.lng);
      const displayName = country ? (country.nameZh || country.name) : u.name;
      tooltip.textContent = `${u.kind === 'source' ? '攻击源' : '被攻击地点'} ${displayName}`;
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
      }
    };
    const onLeave = () => { updateTooltip(null); };
    if (interactive) {
      container.addEventListener('pointermove', onPointerMove);
      container.addEventListener('pointerleave', onLeave);
    }

    // 渲染循环：阻尼 + 移动亮段 + 冲击波 + 卷轴镜像 + 标记/tooltip 跟随
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
      // ★ 卷轴：scrollGroup 无限滚动；wrap 边界 = 地图半宽 100 − 视野半宽
      //   （视野边缘恰贴最近副本边缘，不越界；跳整周期 200 = 内容视觉无缝）
      const viewHalfW = camera.position.y * Math.tan(THREE.MathUtils.degToRad(35 / 2)) * camera.aspect;
      const B = Math.max(0, 50 - viewHalfW); // 地图半宽 50
      const scroll = scrollGroup.position.x;
      if (scroll > B) scrollGroup.position.x -= MAP_PERIOD;
      if (scroll < -B) scrollGroup.position.x += MAP_PERIOD;
      const sc = scrollGroup.position.x;

      // 弧线组镜像：内容世界 = 弧线坐标 + scroll；组内偏移保持"视野附近副本"
      for (const g of s.arcGroups) {
        const midX = g.userData.midX as number;
        g.position.x = Math.round(-(midX + sc) / MAP_PERIOD) * MAP_PERIOD;
      }

      if (s.flow) updateLights(s.flow, dt);
      // 攻击源冲击波：环从 0 扩散到 RING_MAX_RADIUS 并淡出，频率按强度档位（0.7~2.0 Hz）；
      // 位置 = 源坐标 + scroll 的视野附近副本
      for (const ring of s.rings) {
        const u = ring.userData as { freq: number; offset: number; lng: number; lat: number };
        const p = (elapsed * u.freq + u.offset) % 1;
        const d = p * RING_MAX_RADIUS;
        ring.scale.set(d, d, 1);
        (ring.material as THREE.SpriteMaterial).opacity = (1 - p) * RING_PEAK_OPACITY;
        const wx = u.lng * (100 / 360);
        ring.position.x = wx + Math.round(-(wx + sc) / MAP_PERIOD) * MAP_PERIOD;
      }
      // 源/目标标记：2D 圆盘镜像（组内偏移 → 视野附近副本）+ 目标呼吸
      for (const m of s.markers) {
        const u = m.userData as { kind: string; lng: number; lat: number; phase: number };
        const wx = u.lng * (100 / 360);
        m.position.x = wx + Math.round(-(wx + sc) / MAP_PERIOD) * MAP_PERIOD;
        if (u.kind === 'target') {
          // 目标标记缓慢呼吸：缩放 1 ± 0.3，统一 0.8 Hz（与源的冲击波区分）
          const breath = 1 + TARGET_BREATH_AMPLITUDE * (0.5 + 0.5 * Math.sin(2 * Math.PI * TARGET_BREATH_RATE * elapsed + u.phase));
          m.scale.setScalar(breath);
        }
      }
      // tooltip 跟随（raycast 悬停的标记，随卷轴滚动实时更新屏幕位置）
      const tooltip = tooltipRef.current;
      if (tooltip && tooltip.style.opacity !== '0' && hoveredMarker) {
        const wp = hoveredMarker.getWorldPosition(new THREE.Vector3());
        const sp = worldToScreen(wp, camera, container.clientWidth || 400, container.clientHeight || 300);
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
        controls?.dispose();
        (controls as unknown as { __cleanup?: () => void })?.__cleanup?.();
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerleave', onLeave);
      }
      if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, sceneVersion]);

  return (
    // 组件背景 = 海洋深色（地图外区域与地图内海洋无缝一致；WebGL canvas 透明透出此色）
    <div className="relative w-full h-full" style={{ backgroundColor: '#141c26' }}>
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
