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
 * 未配置时使用与本项目测试接口一致的默认字段名。
 */
export type FieldMapping = Record<string, string>;

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

/** 饼图：series:[{name,value}] → categories:[{name,value}] */
function mapPie(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const src = asArray(getByPath(raw, m.categories || m.series || 'series'));
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

/** 折线图：{categories:[年份], series:[{name,data}]} → {xLabels, lineSeries} */
function mapLine(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const labels = asArray(getByPath(raw, m.xLabels || m.categories || 'categories')).map(String);
  if (labels.length) out.xLabels = labels;
  const series = asArray(getByPath(raw, m.series || 'series')).map((s) => {
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

/** 柱状图：优先 [{name,value}]；否则退回 {categories:[标签], series:[{name,data}]} */
function mapBar(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const valueKey = m.value || 'value';
  const direct = asArray(getByPath(raw, m.categories || m.series || 'series'));
  const isDirect = direct.length > 0 && direct.every((it) => asRecord(it)[valueKey] !== undefined);
  if (isDirect) {
    out.categories = direct.map((it) => {
      const r = asRecord(it);
      return { name: String(r[m.name || 'name'] ?? ''), value: toNum(r[valueKey]) };
    });
  } else {
    const labels = asArray(getByPath(raw, m.xLabels || 'categories')).map(String);
    const first = asRecord(asArray(getByPath(raw, m.series || 'series'))[0]);
    const data = asArray(first[m.data || 'data']).map((v) => toNum(v));
    if (labels.length && data.length) {
      out.categories = labels.map((n, i) => ({ name: n, value: data[i] ?? 0 }));
    }
  }
  applyTitle(raw, m, out);
  return out;
}

/** 柱线组合图：{categories, series:[{name,unit,type,data}]} → {xLabels, mixedSeries} */
function mapBarLine(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const labels = asArray(getByPath(raw, m.xLabels || m.categories || 'categories')).map(String);
  if (labels.length) out.xLabels = labels;
  const series = asArray(getByPath(raw, m.series || 'series')).map((s) => {
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
