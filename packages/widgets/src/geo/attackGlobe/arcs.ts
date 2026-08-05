import * as THREE from 'three';
import { geoToSphere, GLOBE_R } from './geo';
import type { AggregatedAttack, LevelStyle } from './aggregate';

/**
 * PCB 数据流光系统（替代静态弧线 + 粒子）：
 * 光线从攻击源沿大圆弧流向被攻击地点，头部明亮、尾部渐暗（流光拖尾），
 * 到达目标后消散再从源重新发射。每弧光线条数 = 档位 particleCount、
 * 流动速度 = particleSpeed、线宽 = arcWidth——产生频率/粗细/颜色全按强度分档。
 */

/** 大圆弧采样（弧定义用，greatCirclePoint 插值不依赖它） */
const ARC_SEGMENTS = 64;
/** 单条光线带状段数 */
const LIGHT_SEGMENTS = 32;
/** 光线长度（弧长比例） */
const LIGHT_LENGTH = 0.3;

/**
 * 大圆弧插值：P(t) = R·normalize((1−t)·A + t·B)
 * 线性插值后归一化再乘 R，任意 t 都精确落在半径 R 的球面上（不穿模）。
 * A·B ≈ −1（对跖点）时归一化除零 → 返回 null 跳过。
 */
export function greatCirclePoint(a: THREE.Vector3, b: THREE.Vector3, t: number, radius: number): THREE.Vector3 | null {
  const dot = a.dot(b);
  if (dot < -0.9999) return null;  // 对跖点退化
  const v = new THREE.Vector3().lerpVectors(a, b, t);
  if (v.lengthSq() < 1e-12) return null;
  return v.normalize().multiplyScalar(radius);
}

export interface FlowArc {
  a: THREE.Vector3;
  b: THREE.Vector3;
  style: LevelStyle;
  sourceName: string;
  targetName: string;
}

interface LightInstance {
  arc: FlowArc;
  /** 进度 0→1+LIGHT_LENGTH：<1 发射（头部推进），≥1 消散（尾部收完），到周期重置重发 */
  t: number;
}

export interface FlowSystem {
  arcs: FlowArc[];
  lights: LightInstance[];
  /** 每条光线独立带状 Mesh（共享材质，单材质切换） */
  meshes: THREE.Mesh[];
  positions: Float32Array[];
  colors: Float32Array[];
  material: THREE.MeshBasicMaterial;
}

/** 单条光线弧段 → 带状顶点/顶点色（head 亮 → tail 暗的流光渐变） */
function writeLight(light: LightInstance, positions: Float32Array, colors: Float32Array): void {
  const { arc } = light;
  const head = Math.min(light.t, 1);
  const tail = light.t < 1 ? Math.max(0, light.t - LIGHT_LENGTH) : Math.min(1, light.t - LIGHT_LENGTH);
  const len = head - tail;
  if (len < 1e-4) {
    // 空段（消散完成/刚发射）：顶点清零，退化三角形不可见
    positions.fill(0);
    colors.fill(0);
    return;
  }
  const halfW = arc.style.arcWidth / 2;
  const c = lightColor.set(arc.style.color);
  const tan = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let s = 0; s <= LIGHT_SEGMENTS; s++) {
    const u = tail + len * (s / LIGHT_SEGMENTS);
    const p = greatCirclePoint(arc.a, arc.b, u, GLOBE_R + 6);
    if (!p) {
      positions.fill(0);
      colors.fill(0);
      return;
    }
    // 切向（相邻采样差分）与横向法向（× 球面外法线 p）
    const up = greatCirclePoint(arc.a, arc.b, Math.max(tail, u - len / LIGHT_SEGMENTS), GLOBE_R + 6);
    const un = greatCirclePoint(arc.a, arc.b, Math.min(head, u + len / LIGHT_SEGMENTS), GLOBE_R + 6);
    tan.subVectors(un!, up!);
    normal.crossVectors(tan, p).normalize();
    const i = s * 2;
    const ox = p.x, oy = p.y, oz = p.z;
    positions[i * 3] = ox + normal.x * halfW;
    positions[i * 3 + 1] = oy + normal.y * halfW;
    positions[i * 3 + 2] = oz + normal.z * halfW;
    positions[i * 3 + 3] = ox - normal.x * halfW;
    positions[i * 3 + 4] = oy - normal.y * halfW;
    positions[i * 3 + 5] = oz - normal.z * halfW;
    // 亮度渐变：头部全亮 → 尾部 20% 亮度（流光拖尾）
    const bright = 0.2 + 0.8 * (u - tail) / len;
    const r = c.r * bright, g = c.g * bright, b = c.b * bright;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    colors[i * 3 + 3] = r;
    colors[i * 3 + 4] = g;
    colors[i * 3 + 5] = b;
  }
}

// 复用临时对象，避免每光线每帧分配
const lightColor = new THREE.Color();

/**
 * 构建全部攻击弧 + 数据流光系统。
 * 每弧光线数 = style.particleCount（L0:1 … L3:5），相位均匀错开保证连续发射感。
 */
export function buildFlowSystem(attacks: AggregatedAttack[]): FlowSystem | null {
  const arcs: FlowArc[] = [];
  const lights: LightInstance[] = [];
  const positions: Float32Array[] = [];
  const colors: Float32Array[] = [];
  const meshes: THREE.Mesh[] = [];

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (const atk of attacks) {
    const { style } = atk;
    const a = geoToSphere(atk.source.lng, atk.source.lat, GLOBE_R).normalize();
    const b = geoToSphere(atk.target.lng, atk.target.lat, GLOBE_R).normalize();
    if (a.dot(b) < -0.9999) continue;  // 对跖点跳过
    const arc: FlowArc = { a, b, style, sourceName: atk.source.name, targetName: atk.target.name };
    arcs.push(arc);

    const N = style.particleCount;
    for (let k = 0; k < N; k++) {
      const light: LightInstance = { arc, t: k / N };
      const pos = new Float32Array((LIGHT_SEGMENTS + 1) * 2 * 3);
      const col = new Float32Array((LIGHT_SEGMENTS + 1) * 2 * 3);
      writeLight(light, pos, col);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const indices: number[] = [];
      for (let s = 0; s < LIGHT_SEGMENTS; s++) {
        const a2 = s * 2, b2 = a2 + 1, c = a2 + 2, d = a2 + 3;
        indices.push(a2, c, b2, b2, c, d);
      }
      geo.setIndex(indices);
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      meshes.push(mesh);
      lights.push(light);
      positions.push(pos);
      colors.push(col);
    }
  }

  if (arcs.length === 0) {
    material.dispose();
    return null;
  }
  return { arcs, lights, meshes, positions, colors, material };
}

/**
 * 每帧推进光线：t += speed·dt，周期 1+LIGHT_LENGTH（发射+消散）后从源重发。
 * 直接原地重写 position/color 属性（无分配）。
 */
export function updateLights(system: FlowSystem, dt: number): void {
  for (let i = 0; i < system.lights.length; i++) {
    const light = system.lights[i];
    light.t += light.arc.style.particleSpeed * dt;
    if (light.t >= 1 + LIGHT_LENGTH) light.t = 0;
    writeLight(light, system.positions[i], system.colors[i]);
    const geo = system.meshes[i].geometry as THREE.BufferGeometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
