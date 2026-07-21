import { getByPath } from './jsonPath';

/**
 * 数据映射层：把外部接口返回的原始 JSON 转换成各图表组件需要的 props 形状。
 *
 * 只产出「数据字段」（categories / xLabels / lineSeries / mixedSeries / value 等），
 * 不覆盖用户在属性面板里配置的「外观字段」（颜色、开关、标题等）——
 * 标题仅当 mapping.title 显式指定时才由数据驱动。
 *
 * mapping 允许覆盖源路径与字段名，例如：
 *   { series: 'data.list', name: 'label', value: 'count' }
 * 未配置时自动探测对象内第一个数组（兼容 series / data / items / list 等键名）。
 */
export type FieldMapping = Record<string, string>;

/** 在对象中找到第一个数组值的键名，没有则返回 null */
function findArrayKey(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (Array.isArray(v)) return k;
  }
  return null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export function mapData(
  raw: unknown,
  chartType: string,
  mapping: FieldMapping = {},
): Record<string, unknown> {
  if (raw == null) return {};
  switch (chartType) {
    case 'pie-chart': return mapPie(raw, mapping);
    case 'line-chart': return mapLine(raw, mapping);
    case 'bar-chart': return mapBar(raw, mapping);
    case 'bar-line-chart': return mapBarLine(raw, mapping);
    case 'stat-card': return mapStat(raw, mapping);
    default: return asRecord(raw);
  }
}

/** 饼图：自动识别数据数组 → categories:[{name,value}] */
function mapPie(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const src = resolveSrc(raw, m, 'categories', 'series');
  const nameKey = m.name || 'name';
  const valueKey = m.value || 'value';
  const categories = src.map((it) => {
    const r = asRecord(it);
    return { name: String(r[nameKey] ?? ''), value: toNum(r[valueKey]) };
  });
  if (categories.length) out.categories = categories;
  applyTitle(raw, m, out);
  return out;
}

/** 折线图：自动识别 categories + series → {xLabels, lineSeries} */
function mapLine(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const labels = resolveSrc(raw, m, 'xLabels', 'categories').map(String);
  if (labels.length) out.xLabels = labels;
  const series = resolveSrc(raw, m, 'series', 'series').map((s) => {
    const r = asRecord(s);
    return {
      name: String(r[m.name || 'name'] ?? ''),
      data: asArray(r[m.data || 'data']).map((v) => toNum(v)),
    };
  });
  if (series.length) out.lineSeries = series;
  applyTitle(raw, m, out);
  return out;
}

/** 柱状图：自动识别数据数组 → categories:[{name,value}] */
function mapBar(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const valueKey = m.value || 'value';
  const direct = resolveSrc(raw, m, 'categories', 'series');
  const isDirect = direct.length > 0 && direct.every((it) => asRecord(it)[valueKey] !== undefined);
  if (isDirect) {
    out.categories = direct.map((it) => {
      const r = asRecord(it);
      return { name: String(r[m.name || 'name'] ?? ''), value: toNum(r[valueKey]) };
    });
  } else {
    const labels = resolveSrc(raw, m, 'xLabels', 'categories').map(String);
    const seriesArr = resolveSrc(raw, m, 'series', 'series');
    const first = asRecord(seriesArr[0]);
    const data = asArray(first[m.data || 'data']).map((v) => toNum(v));
    if (labels.length && data.length) {
      out.categories = labels.map((n, i) => ({ name: n, value: data[i] ?? 0 }));
    }
  }
  applyTitle(raw, m, out);
  return out;
}

/** 柱线组合图：自动识别 categories + series → {xLabels, mixedSeries} */
function mapBarLine(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const labels = resolveSrc(raw, m, 'xLabels', 'categories').map(String);
  if (labels.length) out.xLabels = labels;
  const series = resolveSrc(raw, m, 'series', 'series').map((s) => {
    const r = asRecord(s);
    return {
      name: String(r[m.name || 'name'] ?? ''),
      unit: r.unit != null ? String(r.unit) : undefined,
      type: r.type === 'line' ? 'line' : 'bar',
      data: asArray(r[m.data || 'data']).map((v) => toNum(v)),
    };
  });
  if (series.length) out.mixedSeries = series;
  applyTitle(raw, m, out);
  return out;
}

/** 统计卡：单个 item → {title,value,suffix,ringPercent}（raw 应已用 jsonPath 定位到该 item） */
function mapStat(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const title = getByPath(raw, m.title || 'name');
  if (title != null) out.title = String(title);
  const value = getByPath(raw, m.value || 'value');
  if (value != null) out.value = toNum(value);
  const suffix = getByPath(raw, m.suffix || 'unit');
  if (suffix != null) out.suffix = String(suffix);
  const ring = getByPath(raw, m.ring || 'occupancy_rate');
  if (ring != null) out.ringPercent = toNum(ring);
  return out;
}

/** 标题仅当 mapping.title 显式指定时才注入，避免覆盖用户配置 */
function applyTitle(raw: unknown, m: FieldMapping, out: Record<string, unknown>): void {
  if (!m.title) return;
  const t = getByPath(raw, m.title);
  if (t != null) out.titleText = String(t);
}

/**
 * 通用数据源解析 — 按优先级从 raw 中取出数组：
 *   1. mapping 里指定的路径（如 mapping.categories = 'data.items'）
 *   2. 若 raw 本身就是数组且未指定 mapping → 直接用 raw
 *   3. 若 raw 是对象 → 用 autoKey 或 fallbackKey 在对象内找数组
 *   4. 都找不到 → 返回空数组
 */
function resolveSrc(
  raw: unknown,
  m: FieldMapping,
  mapKey: string,
  fallbackKey: string,
): unknown[] {
  const path = (m as Record<string, string>)[mapKey];
  if (path) return asArray(getByPath(raw, path) ?? []);

  // Bare array — treat directly as data
  if (Array.isArray(raw)) return raw as unknown[];

  // Object — try fallback key first, then auto-detect
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const byFallback = getByPath(raw, fallbackKey);
    if (Array.isArray(byFallback)) return byFallback as unknown[];
    const autoKey = findArrayKey(raw);
    if (autoKey) return asArray(getByPath(raw, autoKey) ?? []);
  }

  return [];
}
