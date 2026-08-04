import * as THREE from 'three';
import { geoToSphere, GLOBE_R } from './geo';
import type { AggregatedAttack, LevelStyle } from './aggregate';

/** 大圆弧采样点数（静态弧几何） */
const ARC_SEGMENTS = 64;

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
  /** 静态弧线几何（球面 R+6 薄壳，随 globeGroup 自转） */
  geometry: THREE.BufferGeometry;
  /** 粒子相位（0-1 弧长比例，同档粒子错开避免同步） */
  phases: number[];
  style: LevelStyle;
  sourceName: string;
  targetName: string;
  /** 端点单位向量（粒子每帧插值用，避免重复三角函数） */
  a: THREE.Vector3;
  b: THREE.Vector3;
}

export interface FlowSystem {
  arcs: FlowArc[];
  /** 全部粒子合并的 Points（单 draw call） */
  points: THREE.Points;
  positions: Float32Array;
  /** 每粒子所属弧索引 */
  arcIndexOf: number[];
  /** 每粒子相位（弧长比例） */
  phaseOf: number[];
  /** 每粒子速度（弧长比例/秒） */
  speedOf: number[];
}

function buildArcGeometry(a: THREE.Vector3, b: THREE.Vector3): THREE.BufferGeometry | null {
  const pts: number[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const p = greatCirclePoint(a, b, i / ARC_SEGMENTS, GLOBE_R + 6);
    if (!p) return null;
    pts.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/**
 * 构建全部攻击弧 + 合并粒子系统。
 * 粒子每帧沿所属弧插值：pos = greatCirclePoint(a, b, phase)，phase += speed·dt（取模 1）。
 */
export function buildFlowSystem(attacks: AggregatedAttack[]): FlowSystem | null {
  const arcs: FlowArc[] = [];
  const positions: number[] = [];
  const arcIndexOf: number[] = [];
  const phaseOf: number[] = [];
  const speedOf: number[] = [];

  for (const atk of attacks) {
    const a = geoToSphere(atk.source.lng, atk.source.lat, GLOBE_R).normalize();
    const b = geoToSphere(atk.target.lng, atk.target.lat, GLOBE_R).normalize();
    const geometry = buildArcGeometry(a, b);
    if (!geometry) continue;

    const { style } = atk;
    const phases: number[] = [];
    // 粒子相位错开（彗尾效果：同弧 2 个相位差 0.03 的粒子，大头+小尾）
    for (let i = 0; i < style.particleCount; i++) {
      const phase = (i / style.particleCount + (i % 2) * 0.03) % 1;
      phases.push(phase);
      positions.push(0, 0, 0);
      arcIndexOf.push(arcs.length);
      phaseOf.push(phase);
      speedOf.push(style.particleSpeed);
    }
    arcs.push({ geometry, phases, style, sourceName: atk.source.name, targetName: atk.target.name, a, b });
  }

  if (arcs.length === 0) return null;

  // 粒子材质：圆点软边缘 + 加法混合（与 CyberSphere 海洋点云风格一致）
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aColor;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.5, 0.15, d);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  // 每粒子颜色/大小（按弧档位属性）
  const colors: number[] = [];
  const sizes: number[] = [];
  for (const arc of arcs) {
    const c = new THREE.Color(arc.style.color);
    for (let i = 0; i < arc.phases.length; i++) {
      const size = i % 2 === 0 ? arc.style.particleSize : arc.style.particleSize * 0.55;  // 彗尾小粒子
      colors.push(c.r, c.g, c.b);
      sizes.push(size);
    }
  }
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));

  return {
    arcs,
    points,
    positions: geo.attributes.position.array as Float32Array,
    arcIndexOf,
    phaseOf,
    speedOf,
  };
}

/** 每帧更新粒子位置（沿所属弧插值，dt 秒） */
export function updateParticles(system: FlowSystem, dt: number): void {
  const pos = system.positions;
  for (let i = 0; i < system.phaseOf.length; i++) {
    const arc = system.arcs[system.arcIndexOf[i]];
    if (!arc) continue;
    system.phaseOf[i] = (system.phaseOf[i] + system.speedOf[i] * dt) % 1;
    const pt = greatCirclePoint(arc.a, arc.b, system.phaseOf[i], GLOBE_R + 4);
    if (!pt) continue;
    pos[i * 3] = pt.x;
    pos[i * 3 + 1] = pt.y;
    pos[i * 3 + 2] = pt.z;
  }
  (system.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}
