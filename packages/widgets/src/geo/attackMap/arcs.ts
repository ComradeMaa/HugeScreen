import * as THREE from 'three';
import { geoToPlane } from './geo';
import type { AggregatedAttack, LevelStyle } from '../attackGlobe/aggregate';

/**
 * 攻击线动态方案（极简，与球版架构一致）：
 * 静态带状弧线 + 每弧一段"移动亮段"——
 * 亮段是弧线的一段区间 [t−LEN, t]，每帧把 t 沿弧推进（t 到 1 回 0 循环），
 * 视觉上就是一段亮线沿弧线从攻击源流向被攻击地点。
 * 顶点色渐变（head 亮 → tail 暗），Additive 混合。
 * ★ 与球版唯一差异：弧线是平面二次贝塞尔（等距圆柱投影平面上），
 *   亮段 sRGB/过曝视觉代码一字不动。
 */

/** 静态弧线采样点数 */
const ARC_SEGMENTS = 64;
/** 移动亮段采样段数 */
const LIGHT_SEGS = 24;
/** 亮段长度（弧长比例） */
const LIGHT_LEN = 0.25;

/** 平面竖直方向（弧线在 XZ 平面，法线统一取 y 轴） */
const UP = new THREE.Vector3(0, 1, 0);

/** 弧线几何参数（buildArcGeometry 与 FlowArc 共用形状） */
export interface ArcParams {
  style: LevelStyle;
  sourceName: string;
  targetName: string;
  /** 平面端点（y=0） */
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** 贝塞尔控制点（弦中点沿垂直方向偏移 0.25|AB|，背离地图中心） */
  ctrl: THREE.Vector3;
}

export interface FlowArc extends ArcParams {
  /** 静态弧线几何（平面薄壳带状） */
  geometry: THREE.BufferGeometry;
}

export interface FlowSystem {
  arcs: FlowArc[];
  /** 全部亮段（每弧 style.particleCount 条，相位均匀错开 → 发射频率按强度分档） */
  lights: LightSegment[];
  lightMaterial: THREE.MeshBasicMaterial;
}

export interface LightSegment {
  arcIndex: number;
  mesh: THREE.Mesh;
  /** attr.array 引用（mesh 实际持有的数组） */
  positions: Float32Array;
  colors: Float32Array;
  /** 进度 0-1（沿弧从源到目标循环） */
  t: number;
}

/** 平面二次贝塞尔插值（弦中点垂直偏移 0.25|AB|，保持"弧线越过中线"的弯曲观感） */
export function planeArcPoint(arc: ArcParams, t: number): THREE.Vector3 {
  const u = 1 - t;
  return new THREE.Vector3(
    u * u * arc.a.x + 2 * u * t * arc.ctrl.x + t * t * arc.b.x,
    0,
    u * u * arc.a.z + 2 * u * t * arc.ctrl.z + t * t * arc.b.z,
  );
}

/** 静态带状弧线几何（WebGL 线恒 1px，带状才能控制宽度） */
function buildArcGeometry(arc: ArcParams, width: number): THREE.BufferGeometry | null {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    pts.push(planeArcPoint(arc, i / ARC_SEGMENTS));
  }
  const half = width / 2;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tan = new THREE.Vector3().subVectors(next, prev);
    // 平面：法线 = 切线 × y 轴（弦平面内垂直方向）
    const normal = new THREE.Vector3().crossVectors(tan, UP).normalize();
    const l = pts[i].clone().addScaledVector(normal, half);
    const r = pts[i].clone().addScaledVector(normal, -half);
    positions.push(l.x, l.y, l.z, r.x, r.y, r.z);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a2 = i * 2, b2 = a2 + 1, c = a2 + 2, d = a2 + 3;
    indices.push(a2, c, b2, b2, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  return g;
}

// 复用临时对象（writeLight 每帧调用，避免分配）
const tmpTan = new THREE.Vector3();
const tmpN = new THREE.Vector3();

/** sRGB 分量 → 线性分量（顶点色按线性空间存储，渲染输出 sRGB 编码后精确还原） */
function srgbToLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 解析 #RRGGBB → sRGB 分量数组（不经过 THREE.Color 的线性解码） */
function hexToSrgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** 重写亮段几何：弧段 [tail, head] 的带状 + 顶点色渐变（head 亮 → tail 暗） */
function writeLight(arc: ArcParams, t: number, positions: Float32Array, colors: Float32Array): void {
  const head = t;
  const tail = Math.max(0, t - LIGHT_LEN);
  const len = head - tail;
  if (len < 1e-4) {
    positions.fill(0);
    colors.fill(0);
    return;
  }
  const halfW = arc.style.arcWidth / 2;
  // ★ 颜色必须保持纯正警告色：亮度乘法在 sRGB 域做（色相比例不变），
  //   再线性解码存储——若在线性域乘法，sRGB 输出编码会把暗通道 gamma 抬升
  //   （红线的 g/b 通道被抬起 → 亮段变粉红）
  const [sr, sg, sb] = hexToSrgb(arc.style.color);
  for (let s = 0; s <= LIGHT_SEGS; s++) {
    const u = tail + len * (s / LIGHT_SEGS);
    const p = planeArcPoint(arc, u);
    const up = planeArcPoint(arc, Math.max(tail, u - len / LIGHT_SEGS));
    const un = planeArcPoint(arc, Math.min(head, u + len / LIGHT_SEGS));
    tmpTan.subVectors(un, up);
    tmpN.crossVectors(tmpTan, UP).normalize();
    const i = s * 2;
    const u01 = (u - tail) / len;
    positions[i * 3] = p.x + tmpN.x * halfW;
    positions[i * 3 + 1] = p.y + tmpN.y * halfW;
    positions[i * 3 + 2] = p.z + tmpN.z * halfW;
    positions[i * 3 + 3] = p.x - tmpN.x * halfW;
    positions[i * 3 + 4] = p.y - tmpN.y * halfW;
    positions[i * 3 + 5] = p.z - tmpN.z * halfW;
    // 过曝方案（用户接受偏粉）：头部 1.5 倍乘法过曝（主通道饱和、暗通道
    // 被放大 → 偏亮红/亮橙），立方衰减拖尾。Additive 混合下头部强烈发光，
    // 醒目优先于色相纯正。
    const bright = Math.pow(u01, 3) * 1.5;
    const r = srgbToLin(sr * bright), g = srgbToLin(sg * bright), b = srgbToLin(sb * bright);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    colors[i * 3 + 3] = r;
    colors[i * 3 + 4] = g;
    colors[i * 3 + 5] = b;
  }
}

/** 构建静态弧线 + 移动亮段系统（平面贝塞尔；端点重合跳过） */
export function buildFlowSystem(attacks: AggregatedAttack[]): FlowSystem | null {
  const arcs: FlowArc[] = [];
  const lights: LightSegment[] = [];

  const lightMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (const atk of attacks) {
    const { style } = atk;
    const a = geoToPlane(atk.source.lng, atk.source.lat);
    const b = geoToPlane(atk.target.lng, atk.target.lat);
    if (a.distanceToSquared(b) < 1e-4) continue;  // 端点重合跳过
    // 贝塞尔控制点：弦中点沿垂直方向偏移 0.25|AB|，方向背离地图中心（弧线弯曲观感）
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const sign = mid.lengthSq() < 1e-6 ? 1 : Math.sign(mid.dot(perp)) || 1;
    const ctrl = mid.clone().addScaledVector(perp, sign * 0.25 * a.distanceTo(b));
    const params: ArcParams = { style, sourceName: atk.source.name, targetName: atk.target.name, a, b, ctrl };
    const geometry = buildArcGeometry(params, style.arcWidth);
    if (!geometry) continue;
    arcs.push({ ...params, geometry });

    // 亮段条数 = style.particleCount（L0:1 … L3:5）→ 发射频率按强度分档：
    // 高强度弧上多条亮段接连流动，低强度基本只有一条。
    // 同弧内相位均匀错开（k/N），不同弧再按弧序偏移 0.13 避免全局同步。
    // ★ Float32BufferAttribute 构造会复制传入数组（new Float32Array(array)），
    //   必须用 attr.array（mesh 实际持有的数组）作为写入目标——
    //   否则 updateLights 写外部数组，mesh 持有的副本不动 → 画面静止（sameArr:false）
    for (let k = 0; k < style.particleCount; k++) {
      const posAttr = new THREE.Float32BufferAttribute(new Float32Array((LIGHT_SEGS + 1) * 2 * 3), 3);
      const colAttr = new THREE.Float32BufferAttribute(new Float32Array((LIGHT_SEGS + 1) * 2 * 3), 3);
      const t0 = (k / style.particleCount + (arcs.length - 1) * 0.13) % 1;
      writeLight(params, t0, posAttr.array as Float32Array, colAttr.array as Float32Array);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', posAttr);
      geo.setAttribute('color', colAttr);
      const indices: number[] = [];
      for (let s = 0; s < LIGHT_SEGS; s++) {
        const a2 = s * 2, b2 = a2 + 1, c = a2 + 2, d = a2 + 3;
        indices.push(a2, c, b2, b2, c, d);
      }
      geo.setIndex(indices);
      const mesh = new THREE.Mesh(geo, lightMaterial);
      mesh.frustumCulled = false;
      lights.push({
        arcIndex: arcs.length - 1,
        mesh,
        positions: posAttr.array as Float32Array,
        colors: colAttr.array as Float32Array,
        t: t0,
      });
    }
  }

  if (arcs.length === 0) {
    lightMaterial.dispose();
    return null;
  }
  return { arcs, lights, lightMaterial };
}

/** 每帧推进全部亮段：t += speed·dt，越过目标回到源（循环） */
export function updateLights(system: FlowSystem, dt: number): void {
  for (const light of system.lights) {
    const arc = system.arcs[light.arcIndex];
    light.t += arc.style.particleSpeed * dt;
    if (light.t >= 1) light.t -= 1;
    // ★ light.positions 即 mesh 持有的 attribute.array（构建时取自 attr.array）
    writeLight(arc, light.t, light.positions, light.colors);
    const geo = light.mesh.geometry as THREE.BufferGeometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
