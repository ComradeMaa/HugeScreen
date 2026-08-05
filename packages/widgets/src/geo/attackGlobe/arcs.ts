import * as THREE from 'three';
import { geoToSphere, GLOBE_R } from './geo';
import type { AggregatedAttack, LevelStyle } from './aggregate';

/**
 * 攻击线动态方案（极简）：
 * 静态带状弧线（8c85410 验证正常）+ 每弧一段"移动亮段"——
 * 亮段是弧线的一段区间 [t−LEN, t]，每帧把 t 沿弧推进（t 到 1 回 0 循环），
 * 视觉上就是一段亮线沿弧线从攻击源流向被攻击地点。
 * 顶点色渐变（head 亮 → tail 暗），Additive 混合。
 */

/** 静态弧线采样点数 */
const ARC_SEGMENTS = 64;
/** 移动亮段采样段数 */
const LIGHT_SEGS = 24;
/** 亮段长度（弧长比例） */
const LIGHT_LEN = 0.25;

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
  /** 静态弧线几何（球面 R+6 薄壳带状，随 globeGroup 自转） */
  geometry: THREE.BufferGeometry;
  style: LevelStyle;
  sourceName: string;
  targetName: string;
  /** 端点单位向量（亮段每帧插值用） */
  a: THREE.Vector3;
  b: THREE.Vector3;
}

export interface FlowSystem {
  arcs: FlowArc[];
  /** 每条弧一个移动亮段 Mesh（共享材质，单材质切换） */
  lightMeshes: THREE.Mesh[];
  lightPositions: Float32Array[];
  lightColors: Float32Array[];
  lightMaterial: THREE.MeshBasicMaterial;
  /** 每亮段当前进度（0-1，沿弧从源到目标循环） */
  tOf: number[];
}

/** 静态带状弧线几何（WebGL 线恒 1px，带状才能控制宽度） */
function buildArcGeometry(a: THREE.Vector3, b: THREE.Vector3, width: number): THREE.BufferGeometry | null {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const p = greatCirclePoint(a, b, i / ARC_SEGMENTS, GLOBE_R + 6);
    if (!p) return null;
    pts.push(p);
  }
  const half = width / 2;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tan = new THREE.Vector3().subVectors(next, prev);
    const normal = new THREE.Vector3().crossVectors(tan, pts[i]).normalize();
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
const tmpColor = new THREE.Color();
const tmpTan = new THREE.Vector3();
const tmpN = new THREE.Vector3();

/** 重写亮段几何：弧段 [tail, head] 的带状 + 顶点色渐变（head 亮 → tail 暗） */
function writeLight(arc: FlowArc, t: number, positions: Float32Array, colors: Float32Array): void {
  const head = t;
  const tail = Math.max(0, t - LIGHT_LEN);
  const len = head - tail;
  if (len < 1e-4) {
    positions.fill(0);
    colors.fill(0);
    return;
  }
  const halfW = arc.style.arcWidth / 2;
  const c = tmpColor.set(arc.style.color);
  for (let s = 0; s <= LIGHT_SEGS; s++) {
    const u = tail + len * (s / LIGHT_SEGS);
    const p = greatCirclePoint(arc.a, arc.b, u, GLOBE_R + 6);
    if (!p) {
      positions.fill(0);
      colors.fill(0);
      return;
    }
    const up = greatCirclePoint(arc.a, arc.b, Math.max(tail, u - len / LIGHT_SEGS), GLOBE_R + 6);
    const un = greatCirclePoint(arc.a, arc.b, Math.min(head, u + len / LIGHT_SEGS), GLOBE_R + 6);
    tmpTan.subVectors(un!, up!);
    tmpN.crossVectors(tmpTan, p).normalize();
    const i = s * 2;
    positions[i * 3] = p.x + tmpN.x * halfW;
    positions[i * 3 + 1] = p.y + tmpN.y * halfW;
    positions[i * 3 + 2] = p.z + tmpN.z * halfW;
    positions[i * 3 + 3] = p.x - tmpN.x * halfW;
    positions[i * 3 + 4] = p.y - tmpN.y * halfW;
    positions[i * 3 + 5] = p.z - tmpN.z * halfW;
    // 亮度渐变：head 全亮 → tail 15% 亮度
    const bright = 0.15 + 0.85 * (u - tail) / len;
    const r = c.r * bright, g = c.g * bright, b = c.b * bright;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    colors[i * 3 + 3] = r;
    colors[i * 3 + 4] = g;
    colors[i * 3 + 5] = b;
  }
}

/** 构建静态弧线 + 移动亮段系统 */
export function buildFlowSystem(attacks: AggregatedAttack[]): FlowSystem | null {
  const arcs: FlowArc[] = [];
  const lightMeshes: THREE.Mesh[] = [];
  const lightPositions: Float32Array[] = [];
  const lightColors: Float32Array[] = [];
  const tOf: number[] = [];

  const lightMaterial = new THREE.MeshBasicMaterial({
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
    const geometry = buildArcGeometry(a, b, style.arcWidth);
    if (!geometry) continue;
    const arc: FlowArc = { geometry, style, sourceName: atk.source.name, targetName: atk.target.name, a, b };
    arcs.push(arc);

    // 移动亮段：初始相位按弧序错开（避免所有亮段同步）
    const pos = new Float32Array((LIGHT_SEGS + 1) * 2 * 3);
    const col = new Float32Array((LIGHT_SEGS + 1) * 2 * 3);
    const t0 = ((arcs.length - 1) * 0.13) % 1;
    writeLight(arc, t0, pos, col);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const indices: number[] = [];
    for (let s = 0; s < LIGHT_SEGS; s++) {
      const a2 = s * 2, b2 = a2 + 1, c = a2 + 2, d = a2 + 3;
      indices.push(a2, c, b2, b2, c, d);
    }
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo, lightMaterial);
    mesh.frustumCulled = false;
    lightMeshes.push(mesh);
    lightPositions.push(pos);
    lightColors.push(col);
    tOf.push(t0);
  }

  if (arcs.length === 0) {
    lightMaterial.dispose();
    return null;
  }
  return { arcs, lightMeshes, lightPositions, lightColors, lightMaterial, tOf };
}

/** 每帧推进亮段：t += speed·dt，越过目标回到源（循环） */
export function updateLights(system: FlowSystem, dt: number): void {
  for (let i = 0; i < system.arcs.length; i++) {
    const arc = system.arcs[i];
    system.tOf[i] += arc.style.particleSpeed * dt;
    if (system.tOf[i] >= 1) system.tOf[i] -= 1;
    writeLight(arc, system.tOf[i], system.lightPositions[i], system.lightColors[i]);
    const geo = system.lightMeshes[i].geometry as THREE.BufferGeometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
