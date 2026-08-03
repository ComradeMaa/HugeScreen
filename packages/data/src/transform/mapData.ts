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
 * 未配置时自动探测对象内的数组（优先匹配常见键名，避免取错字段）。
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
    case 'text-widget': return mapText(raw, mapping);
    case 'image-widget': return mapImage(raw, mapping);
    case 'video-widget': return mapVideo(raw, mapping);
    case 'water-pond': return mapWaterPond(raw, mapping);
    default: return asRecord(raw);
  }
}

/** 饼图：自动识别数据数组 → categories:[{name,value}] */
function mapPie(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const src = resolveSrc(raw, m, 'categories', 'series', 'data', 'items');
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

/** 折线图：categories + series → {xLabels, lineSeries} */
function mapLine(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const labels = resolveSrc(raw, m, 'xLabels', 'categories', 'xLabels').map(String);
  if (labels.length) out.xLabels = labels;
  const series = resolveSrc(raw, m, 'series', 'series', 'data', 'items').map((s) => {
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
  const direct = resolveSrc(raw, m, 'categories', 'series', 'data', 'items');
  const isDirect = direct.length > 0 && direct.every((it) => asRecord(it)[valueKey] !== undefined);
  if (isDirect) {
    out.categories = direct.map((it) => {
      const r = asRecord(it);
      return { name: String(r[m.name || 'name'] ?? ''), value: toNum(r[valueKey]) };
    });
  } else {
    const labels = resolveSrc(raw, m, 'xLabels', 'categories', 'xLabels').map(String);
    const seriesArr = resolveSrc(raw, m, 'series', 'series', 'data', 'items');
    const first = asRecord(seriesArr[0]);
    const data = asArray(first[m.data || 'data']).map((v) => toNum(v));
    if (labels.length && data.length) {
      out.categories = labels.map((n, i) => ({ name: n, value: data[i] ?? 0 }));
    }
  }
  applyTitle(raw, m, out);
  return out;
}

/** 柱线组合图：categories + mixedSeries → {xLabels, mixedSeries} */
function mapBarLine(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const labels = resolveSrc(raw, m, 'xLabels', 'categories', 'xLabels').map(String);
  if (labels.length) out.xLabels = labels;
  const series = resolveSrc(raw, m, 'series', 'series', 'mixedSeries', 'data', 'items').map((s) => {
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

/** 统计卡：单个 item → {title,value,suffix,ringPercent,trend,trendLabel}（raw 应已用 jsonPath 定位到该 item） */
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
  // 增长率：优先 mapping 指定路径，否则自动探测常见字段名
  const trendVal = getByPath(raw, m.trend || 'trend')
    ?? getByPath(raw, 'growthRate') ?? getByPath(raw, 'changePercent')
    ?? getByPath(raw, 'change') ?? getByPath(raw, 'growth');
  if (trendVal != null) out.trend = toNum(trendVal);
  const trendLabel = getByPath(raw, m.trendLabel || 'trendLabel');
  if (trendLabel != null) out.trendLabel = String(trendLabel);
  return out;
}

/** 文本组件：自动探测常见文本字段名，提高 API 适配性 */
function mapText(raw: unknown, m: FieldMapping): Record<string, unknown> {
  // 基础类型直接转字符串显示
  if (raw == null) return { text: '' };
  if (typeof raw === 'string') return { text: raw };
  if (typeof raw === 'number' || typeof raw === 'boolean') return { text: String(raw) };
  if (Array.isArray(raw)) {
    // 数组 → 拼接所有项的文本（jsonPath 留空时显示全部，填了 path 时该 path 切片后的数组也在这一步拼接）
    const texts: string[] = [];
    for (const item of raw) {
      if (typeof item === 'string') { texts.push(item); }
      else if (typeof item === 'number' || typeof item === 'boolean') { texts.push(String(item)); }
      else if (item && typeof item === 'object') {
        const r = mapText(item, m);
        if (r.text) texts.push(r.text as string);
      }
    }
    if (texts.length > 0) return { text: texts.join('\n') };
    return { text: '' };
  }
  if (!raw || typeof raw !== 'object') return {};

  // mapping 显式指定 → 优先
  if (m.text) {
    const txt = getByPath(raw, m.text);
    if (txt != null) return { text: String(txt) };
    return {};
  }

  // 自动探测常见文本字段名（按优先级）
  const candidates = ['text', 'content', 'message', 'hitokoto', 'quote', 'body', 'title', 'sentence', 'desc', 'description', 'value', 'name'];
  for (const key of candidates) {
    const v = (raw as any)[key];
    if (v != null && (typeof v === 'string' || typeof v === 'number')) {
      return { text: String(v) };
    }
  }

  // 兜底：取对象里第一个字符串值
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (typeof v === 'string') return { text: v };
  }

  return {};
}

/** 图片组件：提取图片 URL 数组 → { images: {url, pinned?:boolean}[] }，pinned=false 表示可被覆盖 */
function mapImage(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const build = (urls: string[]) => urls.length > 0 ? { images: urls.map(url => ({ url, pinned: false })) } : {};
  if (typeof raw === 'string') return build([raw]);
  if (Array.isArray(raw)) {
    const urls: string[] = [];
    const urlKey = m.url || m.images || 'url';
    for (const item of raw) {
      if (typeof item === 'string') { urls.push(item); }
      else if (item && typeof item === 'object') {
        const v = getByPath(item, urlKey) ?? getByPath(item, 'url') ?? getByPath(item, 'src') ?? getByPath(item, 'download_url') ?? getByPath(item, 'image');
        if (typeof v === 'string') urls.push(v);
      }
    }
    return build(urls);
  }
  if (typeof raw === 'object') {
    const v = getByPath(raw, m.url || m.images || 'url') ?? getByPath(raw, 'src') ?? getByPath(raw, 'download_url');
    if (typeof v === 'string') return build([v]);
  }
  return {};
}

/** 视频数据源 — 同 mapImage 逻辑，API 视频 pinned: false */
function mapVideo(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const build = (urls: string[]) =>
    urls.length > 0 ? { videos: urls.slice(0, 4).map(url => ({ url, pinned: false })) } : {};
  if (typeof raw === 'string') return build([raw]);
  if (Array.isArray(raw)) {
    const urls: string[] = [];
    const urlKey = m.url || m.videos || 'url';
    for (const item of raw) {
      if (typeof item === 'string') { urls.push(item); }
      else if (item && typeof item === 'object') {
        const v = getByPath(item, urlKey) ?? getByPath(item, 'url') ?? getByPath(item, 'src')
          ?? getByPath(item, 'download_url') ?? getByPath(item, 'video')
          ?? getByPath(item, 'stream_url') ?? getByPath(item, 'hls_url');
        if (typeof v === 'string') urls.push(v);
      }
    }
    return build(urls);
  }
  if (typeof raw === 'object') {
    const v = getByPath(raw, m.url || m.videos || 'url') ?? getByPath(raw, 'src')
      ?? getByPath(raw, 'download_url') ?? getByPath(raw, 'stream_url');
    if (typeof v === 'string') return build([v]);
  }
  return {};
}

/** 水位球 — 自动提取数值 */
function mapWaterPond(raw: unknown, _m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'number') return { value: Math.round(raw) };
  if (Array.isArray(raw) && raw.length > 0) {
    const n = typeof raw[0] === 'number' ? raw[0] : Number(raw[0]);
    return isNaN(n) ? {} : { value: Math.round(n) };
  }
  if (typeof raw === 'object' && raw !== null) {
    const vals = Object.values(raw as Record<string, unknown>).map(v => typeof v === 'number' ? v : Number(v)).filter(v => !isNaN(v));
    return vals.length > 0 ? { value: Math.round(Math.max(...vals)) } : {};
  }
  return {};
}

function applyTitle(raw: unknown, m: FieldMapping, out: Record<string, unknown>): void {
  if (!m.title) return;
  const t = getByPath(raw, m.title);
  if (t != null) out.titleText = String(t);
}

/**
 * 通用数据源解析 — 按优先级从 raw 中取出数组：
 *   1. mapping 里指定的路径
 *   2. raw 本身就是数组 → 直接用
 *   3. raw 是对象 → 依次尝试 fallbackKeys，取第一个匹配到的数组
 *   4. 都不匹配 → 返回空数组
 */
function resolveSrc(
  raw: unknown,
  m: FieldMapping,
  mapKey: string,
  ...fallbackKeys: string[]
): unknown[] {
  const path = (m as Record<string, string>)[mapKey];
  if (path) return asArray(getByPath(raw, path) ?? []);

  // Bare array — treat directly as data
  if (Array.isArray(raw)) return raw as unknown[];

  // Object — try each fallback key in order
  if (raw && typeof raw === 'object') {
    for (const key of fallbackKeys) {
      const v = getByPath(raw, key);
      if (Array.isArray(v)) return v as unknown[];
    }
  }

  return [];
}
