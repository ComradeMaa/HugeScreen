/** 缓动与沿路径插值工具 */

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function dist2(a: [number, number], b: [number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

/**
 * 在路径坐标序列 [stopIndexes[from] .. stopIndexes[to]] 段内按弧长插值。
 * @returns [lng, lat]；路径缺失/下标无效返回 null（调用方退化为站点直线插值）
 */
export function pathPos(
  coords: [number, number][] | null | undefined,
  stopIndexes: number[],
  from: number,
  to: number,
  t: number,
): [number, number] | null {
  if (!coords || coords.length < 2 || !stopIndexes) return null;
  let a = stopIndexes[from];
  let b = stopIndexes[to];
  if (a == null || b == null || a === b) return null;
  // 反向行驶（next 在 stations 中位于 current 之前）：交换端点并翻转 t
  if (b < a) { const tmp = a; a = b; b = tmp; t = 1 - t; }
  if (b >= coords.length) return null;

  // 累积段长度（逐段欧氏距离）
  const segLens: number[] = [];
  let total = 0;
  for (let i = a; i < b; i++) {
    const d = Math.sqrt(dist2(coords[i], coords[i + 1]));
    segLens.push(d);
    total += d;
  }
  if (total <= 0) return coords[a];

  let target = Math.min(1, Math.max(0, t)) * total;
  for (let i = a; i < b; i++) {
    const len = segLens[i - a];
    if (target <= len || i === b - 1) {
      const u = len > 0 ? Math.min(1, target / len) : 0;
      return [
        coords[i][0] + (coords[i + 1][0] - coords[i][0]) * u,
        coords[i][1] + (coords[i + 1][1] - coords[i][1]) * u,
      ];
    }
    target -= len;
  }
  return coords[b];
}

/** 站点直线插值（路径缺失/降级时的兜底） */
export function lerpPos(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
