/**
 * 线路色板 — 电光蓝/琥珀橙/警示黄/警示红/亮蓝/蓝紫（项目色规：无绿无粉）。
 */
export const LINE_PALETTE = ['#00D4FF', '#FF8C42', '#FFD34D', '#FF1F1F', '#4FC3F7', '#B388FF'];

/** 线路颜色：优先用户 per-line 覆盖（lineColors[lineId]），否则按索引轮转色板 */
export function lineColor(index: number, overrides?: Record<string, string>, lineId?: number | string): string {
  if (overrides && lineId != null) {
    const o = overrides[String(lineId)];
    if (o) return o;
  }
  const n = LINE_PALETTE.length;
  return LINE_PALETTE[((index % n) + n) % n];
}
