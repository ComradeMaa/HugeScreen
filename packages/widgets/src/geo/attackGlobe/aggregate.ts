import * as THREE from 'three';

export interface AttackSource { id: string; name: string; lat: number; lng: number; }
export interface AttackTarget { id: string; name: string; lat: number; lng: number; }
export interface AttackEvent { source: string; target: string; count: number; }

/** 档位样式 */
export interface LevelStyle {
  color: string;
  arcOpacity: number;
  particleCount: number;   // 每弧粒子数
  particleSpeed: number;   // 弧长比例/秒
  particleSize: number;    // 粒子屏幕尺寸
  sourceRadius: number;    // 攻击源标记半径（单位）
}

/**
 * ★ 档位用色规则：攻击线/粒子禁用项目电光蓝 #00D4FF——
 *   国家轮廓线、经纬网格、赤道环同为电蓝，同色会糊在一起看不清。
 *   攻击强度梯度全用暖色系：绿(低) → 亮琥珀黄 → 琥珀橙 → 红(高)，
 *   与暗蓝背景和电蓝轮廓均有明显区分。
 */
export const LEVEL_STYLES: LevelStyle[] = [
  { color: '#34d399', arcOpacity: 0.30, particleCount: 1, particleSpeed: 0.05, particleSize: 6, sourceRadius: 4 },
  { color: '#FFD34D', arcOpacity: 0.45, particleCount: 2, particleSpeed: 0.07, particleSize: 8, sourceRadius: 6 },
  { color: '#FF8C42', arcOpacity: 0.60, particleCount: 3, particleSpeed: 0.09, particleSize: 11, sourceRadius: 8 },
  { color: '#f87171', arcOpacity: 0.75, particleCount: 5, particleSpeed: 0.12, particleSize: 15, sourceRadius: 11 },
];

export const FIXED_THRESHOLDS = [5, 20, 100];
/** 采样上限：攻击线最多显示条数（配合分档不损失视觉信息） */
export const MAX_ATTACKS = 50;

/** 分位数（p ∈ [0,1]） */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(p * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

export interface AggregatedAttack {
  source: AttackSource;
  target: AttackTarget;
  count: number;
  level: 0 | 1 | 2 | 3;
  style: LevelStyle;
}

/**
 * 强度聚合：
 * 1. 同 (source,target) 对 count 求和（一个源大量攻击收敛为一条线）
 * 2. 按 count 降序截取前 MAX_ATTACKS 条
 * 3. 分档：auto = 分位数 [p50,p75,p90]；fixed = [5,20,100]
 */
export function aggregateAttacks(
  sources: AttackSource[],
  targets: AttackTarget[],
  attacks: AttackEvent[],
  mode: 'auto' | 'fixed',
): AggregatedAttack[] {
  const byId = new Map<string, AttackSource>(sources.map((s) => [s.id, s]));
  const targetById = new Map<string, AttackTarget>(targets.map((t) => [t.id, t]));
  // source/target 引用 id 或 name 均可
  const findSource = (ref: string): AttackSource | undefined =>
    byId.get(ref) ?? sources.find((s) => s.name === ref);
  const findTarget = (ref: string): AttackTarget | undefined =>
    targetById.get(ref) ?? targets.find((t) => t.name === ref);

  // 按 (source,target) 对聚合
  const sums = new Map<string, { source: AttackSource; target: AttackTarget; count: number }>();
  for (const ev of attacks) {
    const src = findSource(ev.source);
    const tgt = findTarget(ev.target);
    if (!src || !tgt) continue;
    const key = `${src.id}|${tgt.id}`;
    const cur = sums.get(key);
    if (cur) cur.count += Math.max(0, ev.count || 1);
    else sums.set(key, { source: src, target: tgt, count: Math.max(0, ev.count || 1) });
  }

  const list = [...sums.values()].sort((a, b) => b.count - a.count).slice(0, MAX_ATTACKS);
  if (list.length === 0) return [];

  const counts = list.map((l) => l.count);
  let b0: number, b1: number, b2: number;
  if (mode === 'fixed') {
    [b0, b1, b2] = FIXED_THRESHOLDS;
  } else {
    const sorted = [...counts].sort((a, b) => a - b);
    b0 = quantile(sorted, 0.5);
    b1 = quantile(sorted, 0.75);
    b2 = quantile(sorted, 0.9);
  }

  return list.map((l) => {
    const level: 0 | 1 | 2 | 3 = l.count <= b0 ? 0 : l.count <= b1 ? 1 : l.count <= b2 ? 2 : 3;
    return { ...l, level, style: LEVEL_STYLES[level] };
  });
}

/** 攻击源标记半径：按该源全部攻击求和套同一张表 */
export function sourceRadiusByTotal(aggregated: AggregatedAttack[], srcId: string): number {
  let total = 0;
  for (const a of aggregated) {
    if (a.source.id === srcId) total += a.count;
  }
  const level = total > 100 ? 3 : total > 20 ? 2 : total > 5 ? 1 : 0;
  return LEVEL_STYLES[level].sourceRadius;
}

/** 档位颜色 → THREE.Color 缓存 */
export function styleColor(style: LevelStyle): THREE.Color {
  return new THREE.Color(style.color);
}
