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

/** 时间段统计配置（attack-globe 等事件型组件）：开启后只统计窗口内事件 */
export interface TimeWindowConfig {
  enabled: boolean;
  /** last=最近 N 分钟；range=自定义起止 */
  type: 'last' | 'range';
  minutes: number;
  start?: string;
  end?: string;
}

/** 解析事件时间戳：ISO 字符串 / epoch 毫秒 / epoch 秒 → 毫秒 | null */
function parseTs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') {
    return Number.isFinite(v) ? (v > 1e11 ? v : v * 1000) : null;
  }
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n > 1e11 ? n : n * 1000;
    const t = Date.parse(trimmed);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/** 时间窗口过滤（disabled 时不过滤） */
function inTimeWindow(ts: number, tw: TimeWindowConfig, now: number): boolean {
  if (!tw.enabled) return true;
  if (tw.type === 'last') return ts >= now - Math.max(1, tw.minutes || 60) * 60000;
  const s = tw.start ? Date.parse(tw.start) : NaN;
  const e = tw.end ? Date.parse(tw.end) : NaN;
  if (Number.isFinite(s) && ts < s) return false;
  if (Number.isFinite(e) && ts > e) return false;
  return true;
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
  timeWindow?: TimeWindowConfig,
): Record<string, unknown> {
  if (raw == null) return {};
  switch (chartType) {
    case 'pie-chart': return mapPie(raw, mapping);
    case 'funnel-chart': return mapPie(raw, mapping);  // 漏斗图与饼图同数据形状 [{name,value}]
    case 'line-chart': return mapLine(raw, mapping);
    case 'bar-chart': return mapBar(raw, mapping);
    case 'bar-line-chart': return mapBarLine(raw, mapping);
    case 'stat-card': return mapStat(raw, mapping);
    case 'text-widget': return mapText(raw, mapping);
    case 'image-widget': return mapImage(raw, mapping);
    case 'video-widget': return mapVideo(raw, mapping);
    case 'water-pond': return mapWaterPond(raw, mapping);
    case 'gauge-chart': return mapGauge(raw, mapping);
    case 'box-plot': return mapBoxPlot(raw, mapping);
    case 'candlestick': return mapCandlestick(raw, mapping);
    case 'group-chart': return mapGroupBar(raw, mapping);
    case 'histogram': return mapHistogram(raw, mapping);
    case 'voronoi': return mapVoronoi(raw, mapping);
    case 'confidence-band': return mapConfidenceBand(raw, mapping);
    case 'large-area-chart': return mapLargeArea(raw, mapping);
    case 'dynamic-time': return mapLargeArea(raw, mapping);  // 动态时间轴与大规模面积图同格式
    case 'step-line': return mapStepLine(raw, mapping);
    case 'scatter-plot': return mapScatter(raw, mapping);
    case 'intraday-chart': return mapIntraday(raw, mapping);
    case 'radar-chart': return mapRadar(raw, mapping);
    case 'heatmap': return mapHeatmap(raw, mapping);
    case 'relation-chart': return mapRelation(raw, mapping);
    case 'tree-chart': return mapTree(raw, mapping);
    case 'treemap-chart': return mapTreemap(raw, mapping);
    case 'sunburst-chart': return mapSunburst(raw, mapping);
    case 'multiple-x-axis-chart': return mapMultipleXAxis(raw, mapping);
    case 'sankey-chart': return mapSankey(raw, mapping);
    case 'marquee-table': return mapMarqueeTable(raw, mapping);
    case 'attack-globe': return mapAttackGlobe(raw, mapping, timeWindow);
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

/**
 * 箱线图 — 参照 mapPie/mapBar 模式：
 *   1. resolveSrc 提取数组（支持 mapping 自定义路径 + 常见键名 fallback）
 *   2. 支持 mapping 自定义字段名（min/q1/median/q3/max/name）
 *   3. 若对象数组未命中 → 尝试列式格式 {groups/names:[], min:[], q1:[],…}（统计分析 API 常见）
 */
function mapBoxPlot(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};

  // ── 标准格式：对象数组 [{name, min, q1, median, q3, max}, …] ──
  const src = resolveSrc(raw, m, 'categories', 'data', 'items', 'series');
  if (src.length > 0) {
    const nameKey = m.name || 'name';
    const minKey = m.min || 'min';
    const q1Key = m.q1 || 'q1';
    const medianKey = m.median || 'median';
    const q3Key = m.q3 || 'q3';
    const maxKey = m.max || 'max';
    const categories = src.map((it) => {
      const r = asRecord(it);
      return {
        name: String(r[nameKey] ?? r.label ?? r.category ?? ''),
        min: toNum(r[minKey] ?? r.Q1 ?? r.firstQuartile),
        q1: toNum(r[q1Key] ?? r.Q1 ?? r.firstQuartile),
        median: toNum(r[medianKey] ?? r.med ?? r.medianValue),
        q3: toNum(r[q3Key] ?? r.Q3 ?? r.thirdQuartile),
        max: toNum(r[maxKey] ?? r.maximum),
        ...(r.outliers != null && (Array.isArray(r.outliers) ? r.outliers.length > 0 : true)
          ? { outliers: Array.isArray(r.outliers) ? r.outliers.map(Number) : [Number(r.outliers)] }
          : {}),
      };
    });
    return categories.length > 0 ? { categories } : {};
  }

  // ── 列式格式：{groups/names:[], min:[], q1:[], median:[], q3:[], max:[]} ──
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const groupsKey = m.name || 'groups';
    const groups = asArray(rec[groupsKey] || rec['names'] || rec['labels'] || rec['categories']);
    const minArr = asArray(rec[m.min || 'min']);
    const q1Arr = asArray(rec[m.q1 || 'q1'] || rec['Q1'] || rec['firstQuartile']);
    const medianArr = asArray(rec[m.median || 'median'] || rec['med']);
    const q3Arr = asArray(rec[m.q3 || 'q3'] || rec['Q3'] || rec['thirdQuartile']);
    const maxArr = asArray(rec[m.max || 'max'] || rec['maximum']);

    if (minArr.length > 0 || q1Arr.length > 0 || medianArr.length > 0) {
      const len = Math.max(
        groups.length, minArr.length, q1Arr.length,
        medianArr.length, q3Arr.length, maxArr.length,
      );
      const categories: Record<string, unknown>[] = [];
      for (let i = 0; i < len; i++) {
        categories.push({
          name: String(groups[i] ?? `组${i + 1}`),
          min: toNum(minArr[i]),
          q1: toNum(q1Arr[i]),
          median: toNum(medianArr[i]),
          q3: toNum(q3Arr[i]),
          max: toNum(maxArr[i]),
        });
      }
      return { categories };
    }
  }

  // ── 单对象兜底 ──
  const r = asRecord(raw);
  const nameKey = m.name || 'name';
  if (r[nameKey] != null || r['min'] != null || r['q1'] != null) {
    return {
      categories: [{
        name: String(r[nameKey] ?? r.label ?? r.category ?? ''),
        min: toNum(r[m.min || 'min']),
        q1: toNum(r[m.q1 || 'q1'] ?? r['Q1']),
        median: toNum(r[m.median || 'median'] ?? r['med']),
        q3: toNum(r[m.q3 || 'q3'] ?? r['Q3']),
        max: toNum(r[m.max || 'max']),
      }],
    };
  }

  return {};
}

/**
 * 蜡烛图 — 参照 mapBoxPlot 模式：
 *   1. resolveSrc 提取数组（支持 mapping 自定义路径 + 常见键名 fallback）
 *   2. 支持 mapping 自定义字段名（open/close/high/low/name）
 *   3. 若对象数组未命中 → 尝试列式格式 {names/dates:[], open:[], close:[],…}
 */
function mapCandlestick(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};

  // ── 标准格式：对象数组 [{name, open, close, high, low}, …] ──
  const src = resolveSrc(raw, m, 'candles', 'data', 'items', 'series');
  if (src.length > 0) {
    const nameKey = m.name || 'name';
    const openKey = m.open || 'open';
    const closeKey = m.close || 'close';
    const highKey = m.high || 'high';
    const lowKey = m.low || 'low';
    const candles = src.map((it) => {
      const r = asRecord(it);
      return {
        name: String(r[nameKey] ?? r.date ?? r.time ?? ''),
        open: toNum(r[openKey] ?? r.o),
        close: toNum(r[closeKey] ?? r.c),
        high: toNum(r[highKey] ?? r.h ?? r.max),
        low: toNum(r[lowKey] ?? r.l ?? r.min),
      };
    });
    return candles.length > 0 ? { candles } : {};
  }

  // ── 列式格式：{dates/names:[], open:[], close:[], high:[], low:[]}（金融 API 常见）──
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const datesKey = m.name || 'dates';
    const dates = asArray(rec[datesKey] || rec['names'] || rec['labels'] || rec['times'] || rec['x']);
    const openArr = asArray(rec[m.open || 'open']);
    const closeArr = asArray(rec[m.close || 'close']);
    const highArr = asArray(rec[m.high || 'high']);
    const lowArr = asArray(rec[m.low || 'low']);

    if (openArr.length > 0 || closeArr.length > 0) {
      const len = Math.max(dates.length, openArr.length, closeArr.length, highArr.length, lowArr.length);
      const candles: Record<string, unknown>[] = [];
      for (let i = 0; i < len; i++) {
        candles.push({
          name: String(dates[i] ?? `K${i + 1}`),
          open: toNum(openArr[i]),
          close: toNum(closeArr[i]),
          high: toNum(highArr[i]),
          low: toNum(lowArr[i]),
        });
      }
      return { candles };
    }
  }

  return {};
}

/**
 * 层级数据通用适配（矩形树图/旭日图共用）— 嵌套结构 + 扁平列表多格式适配：
 *   1. 嵌套：{name, value, children:[…]} 或数组（多根）
 *   2. 扁平列表 + parent：[{name, value, parent}] → 构建嵌套
 *   3. 包装：{treemap/tree/data: {…} 或 […]}
 * 返回根节点数组（未匹配则空数组）
 */
function mapHierarchy(raw: unknown, m: FieldMapping): { name: string; value?: number; children?: unknown[] }[] {
  if (raw == null) return [];
  const nameKey = m.name || 'name';
  const valueKey = m.value || 'value';
  const parentKey = m.parent || 'parent';
  const childrenKey = m.children || 'children';

  const clean = (node: Record<string, unknown>): { name: string; value?: number; children?: unknown[] } => {
    const out: { name: string; value?: number; children?: unknown[] } = {
      name: String(node[nameKey] ?? node.label ?? ''),
    };
    const v = toNum(node[valueKey], NaN);
    if (Number.isFinite(v)) out.value = v;
    const kids = asArray(node[childrenKey]);
    if (kids.length > 0) out.children = kids.map((c) => clean(asRecord(c)));
    return out;
  };

  // 直接是根（对象）或根数组
  if (Array.isArray(raw)) {
    const trees = raw.map((r) => clean(asRecord(r))).filter((t) => t.name);
    if (trees.length > 0) return trees;
  } else {
    const candidate = raw as Record<string, unknown>;
    if (candidate[nameKey] != null) {
      const t = clean(candidate);
      if (t.name) return [t];
    }
    // 包装
    const wrapped = candidate['treemaps'] ?? candidate['treemap'] ?? candidate['tree'] ?? candidate['data'] ?? candidate['root'];
    if (Array.isArray(wrapped)) {
      const trees = wrapped.map((r) => clean(asRecord(r))).filter((t) => t.name);
      if (trees.length > 0) return trees;
    } else {
      const wr = asRecord(wrapped);
      if (wr[nameKey] != null) {
        const t = clean(wr);
        if (t.name) return [t];
      }
    }
  }

  // 扁平列表 + parent → 构建嵌套（保留 value）
  const src = resolveSrc(raw, m, 'nodes', 'data', 'items', 'nodes');
  if (src.length > 0 && src.every((it) => !Array.isArray(it))) {
    const items = src.map((it) => {
      const r = asRecord(it);
      return {
        name: String(r[nameKey] ?? r.label ?? ''),
        value: toNum(r[valueKey], NaN),
        parent: r[parentKey] != null ? String(r[parentKey]) : undefined,
      };
    }).filter((n) => n.name);
    const roots = items.filter((n) => !n.parent);
    if (roots.length > 0) {
      const childrenOf = (name: string): { name: string; value?: number; children?: { name: string; value?: number }[] }[] =>
        items.filter((n) => n.parent === name).map((k) => ({
          name: k.name,
          ...(Number.isFinite(k.value) ? { value: k.value } : {}),
          ...(childrenOf(k.name).length > 0 ? { children: childrenOf(k.name) } : {}),
        }));
      return roots.map((r) => ({
        name: r.name,
        ...(Number.isFinite(r.value) ? { value: r.value } : {}),
        ...(childrenOf(r.name).length > 0 ? { children: childrenOf(r.name) } : {}),
      }));
    }
  }

  return [];
}

/** 矩形树图 — 输出 {treemaps:[{name, value, children}]} */
function mapTreemap(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const trees = mapHierarchy(raw, m);
  return trees.length ? { treemaps: trees } : {};
}

/** 旭日图 — 与矩形树图同格式（多根并列渲染），输出 {sunbursts:[{name, value, children}]} */
function mapSunburst(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const trees = mapHierarchy(raw, m);
  return trees.length ? { sunbursts: trees } : {};
}

/**
 * 多 X 轴走势图 — 两条折线分别绑定底部/顶部 category 轴：
 *   1. {bottom:{labels,values}, top:{labels,values}}（项内兼容 labels/xLabels/categories、values/data/y）
 *   2. [{name, labels, values}, …]（取前两项）
 *   3. {xLabels, series:[{name, data}, …]}（共用 xLabels，取前两项）
 * 输出 {bottom:{labels,values}, top:{labels,values}}
 */
function mapMultipleXAxis(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const out: Record<string, unknown> = {};
  const line = (r: Record<string, unknown>): { labels: string[]; values: number[] } => ({
    labels: resolveSrc(r, m, 'labels', 'xLabels', 'categories', 'x').map(String),
    values: resolveSrc(r, m, 'values', 'data', 'y', 'seriesData').map((v) => toNum(v)),
  });

  // 数组：[{labels,values}, {labels,values}, …] → 取前两项
  if (Array.isArray(raw)) {
    const items = raw.map((r) => line(asRecord(r))).filter((l) => l.labels.length || l.values.length);
    if (items.length >= 1) out.bottom = items[0];
    if (items.length >= 2) out.top = items[1];
    return out;
  }

  // 对象：{bottom:…, top:…}
  const candidate = raw as Record<string, unknown>;
  const bottomRaw = candidate['bottom'] ?? candidate['bottomSeries'] ?? candidate['s1'];
  const topRaw = candidate['top'] ?? candidate['topSeries'] ?? candidate['s2'];
  if (asRecord(bottomRaw) || asRecord(topRaw)) {
    const b = line(asRecord(bottomRaw));
    const t = line(asRecord(topRaw));
    if (b.labels.length || b.values.length) out.bottom = b;
    if (t.labels.length || t.values.length) out.top = t;
    return out;
  }

  // 兜底：共用 xLabels + series 前两项
  const labels = resolveSrc(raw, m, 'xLabels', 'categories', 'xLabels').map(String);
  const series = resolveSrc(raw, m, 'series', 'series', 'data', 'items');
  const first = asRecord(series[0]);
  const second = asRecord(series[1]);
  const mk = (r: Record<string, unknown>): { labels: string[]; values: number[] } => ({
    labels,
    values: asArray(r[m.data || 'data']).map((v) => toNum(v)),
  });
  if (labels.length && asArray(first[m.data || 'data']).length) out.bottom = mk(first);
  if (labels.length && asArray(second[m.data || 'data']).length) out.top = mk(second);
  return out;
}

/**
 * 桑基图 — 节点 + 连线多格式适配：
 *   1. {nodes:[{name,value}], links:[{source,target,value}]}（ECharts 原生格式）
 *   2. 包装键：nodes/data/node/items + links/edges/link/relations
 *   3. 仅连线（无 nodes）→ 自动从 source/target 收集节点
 * 字段别名：连线 source/target（from/to/u/v/start/end）、流量值（value/weight/flow）
 * 输出 {nodes:[{name,value?}], links:[{source,target,value}]}
 */
function mapSankey(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const nameKey = m.name || 'name';
  const valueKey = m.value || 'value';

  const nodes = resolveSrc(raw, m, 'nodes', 'data', 'node', 'items').map((it) => {
    const r = asRecord(it);
    const out: { name: string; value?: number } = { name: String(r[nameKey] ?? r.label ?? '') };
    const v = toNum(r[valueKey], NaN);
    if (Number.isFinite(v)) out.value = v;
    return out;
  }).filter((n) => n.name);

  const links = resolveSrc(raw, m, 'links', 'edges', 'link', 'relations').map((it) => {
    const r = asRecord(it);
    const src = r[m.source || 'source'] ?? r.from ?? r.u ?? r.start;
    const tgt = r[m.target || 'target'] ?? r.to ?? r.v ?? r.end;
    return {
      source: String(src ?? ''),
      target: String(tgt ?? ''),
      value: toNum(r[valueKey] ?? r.weight ?? r.flow ?? r.value),
    };
  }).filter((l) => l.source && l.target);

  // 仅连线 → 自动收集节点
  const all = [...nodes];
  if (!all.length && links.length) {
    const names = new Set<string>();
    links.forEach((l) => { names.add(l.source); names.add(l.target); });
    names.forEach((n) => all.push({ name: n }));
  }

  if (all.length || links.length) {
    const out: Record<string, unknown> = {};
    if (all.length) out.nodes = all;
    if (links.length) out.links = links;
    return out;
  }
  return {};
}

/**
 * 树形图 — 多格式适配：
 *   1. 嵌套树：{name, children:[…]} 或 [{name, children:[…]}, …]（多根）
 *   2. 扁平列表 + parent：[{name, parent}] → 构建嵌套树（常见 API 格式）
 *   3. 包装：{tree/trees/data: {…} 或 […]}
 * 输出 {trees:[{name, children}]}（多根数组）
 */
function mapTree(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const nameKey = m.name || 'name';
  const parentKey = m.parent || 'parent';
  const childrenKey = m.children || 'children';

  const clean = (node: Record<string, unknown>): { name: string; children?: unknown[] } => ({
    name: String(node[nameKey] ?? node.label ?? ''),
    children: asArray(node[childrenKey]).map((c) => clean(asRecord(c))),
  });

  // 直接是根节点（对象）或根节点数组
  const candidate = raw as Record<string, unknown>;
  if (Array.isArray(raw)) {
    const trees = raw.map((r) => clean(asRecord(r))).filter((t) => t.name);
    if (trees.length > 0) return { trees };
  } else if (candidate[nameKey] != null) {
    const t = clean(candidate);
    if (t.name) return { trees: [t] };
  }
  // 包装：{tree/trees/data/root}
  const wrapped = candidate['trees'] ?? candidate['tree'] ?? candidate['data'] ?? candidate['root'];
  if (Array.isArray(wrapped)) {
    const trees = wrapped.map((r) => clean(asRecord(r))).filter((t) => t.name);
    if (trees.length > 0) return { trees };
  } else {
    const wr = asRecord(wrapped);
    if (wr[nameKey] != null) {
      const t = clean(wr);
      if (t.name) return { trees: [t] };
    }
  }

  // 扁平列表 + parent → 构建嵌套树（支持多个根）
  const src = resolveSrc(raw, m, 'nodes', 'data', 'items', 'nodes');
  if (src.length > 0 && src.every((it) => !Array.isArray(it))) {
    const items = src.map((it) => {
      const r = asRecord(it);
      return { name: String(r[nameKey] ?? r.label ?? ''), parent: r[parentKey] != null ? String(r[parentKey]) : undefined };
    }).filter((n) => n.name);
    const roots = items.filter((n) => !n.parent);
    if (roots.length > 0) {
      const childrenOf = (name: string): { name: string; children?: { name: string }[] }[] => {
        const kids = items.filter((n) => n.parent === name);
        return kids.map((k) => ({ name: k.name, ...(childrenOf(k.name).length > 0 ? { children: childrenOf(k.name) } : {}) }));
      };
      const trees = roots.map((r) => ({ name: r.name, ...(childrenOf(r.name).length > 0 ? { children: childrenOf(r.name) } : {}) }));
      return { trees };
    }
  }

  return {};
}

/**
 * 关系图 — nodes + links 多格式适配：
 *   1. 官方：{nodes:[{name,x,y}], links:[{source,target}]}
 *   2. edges 别名：{nodes, edges:[{from,to}]} → links
 *   3. 边索引：links 的 source/target 为数字 → 按 nodes 索引转名称
 *   4. 行内边：nodes 项带 target 字段 → 展开为 links
 * 输出 {nodes:[{name,x,y}], links:[{source,target}]}
 */
function mapRelation(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};

  // ── 标准/别名格式 ──
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const nodesArr = asArray(rec[m.nodes || 'nodes'] ?? rec['nodes']);
    if (nodesArr.length > 0) {
      const nameKey = m.name || 'name';
      const xKey = m.x || 'x';
      const yKey = m.y || 'y';
      const nodes = nodesArr.map((it) => {
        const r = asRecord(it);
        return {
          name: String(r[nameKey] ?? r.id ?? r.label ?? `节点${nodesArr.indexOf(it) + 1}`),
          x: toNum(r[xKey] ?? r[0], 50),
          y: toNum(r[yKey] ?? r[1], 50),
          // 行内边：节点带 target → 收集为链接
          target: r.target != null ? String(r.target) : undefined,
        };
      });
      // 行内边展开
      const inlineLinks = nodes
        .filter((n) => n.target)
        .map((n) => ({ source: n.name, target: n.target as string }));
      const linksArr = asArray(rec['links'] ?? rec['edges'] ?? rec['relations']);
      const links = linksArr.map((it) => {
        if (Array.isArray(it)) return { source: String(it[0]), target: String(it[1]) };
        const r = asRecord(it);
        return {
          source: String(r.source ?? r.from ?? r[0] ?? ''),
          target: String(r.target ?? r.to ?? r[1] ?? ''),
        };
      });
      // 边索引 → 节点名
      const idxToName = (v: string): string => {
        const idx = Number(v);
        return Number.isInteger(idx) && idx >= 0 && idx < nodes.length ? nodes[idx].name : v;
      };
      const normalizedLinks = links.map((l) => ({ source: idxToName(l.source), target: idxToName(l.target) }));
      const allLinks = [...inlineLinks, ...normalizedLinks];
      return {
        nodes: nodes.map(({ name, x, y }) => ({ name, x, y })),
        ...(allLinks.length > 0 ? { links: allLinks } : {}),
      };
    }
  }

  // ── 纯数组：[[name, x, y], ...] 节点 + [[src, dst], ...] 边 ──
  const src = resolveSrc(raw, m, 'nodes', 'data', 'items');
  if (src.length > 0 && src.every((it) => Array.isArray(it) && it.length >= 3)) {
    const nodes = src.map((it, i) => ({
      name: String((it as unknown[])[0] ?? `节点${i + 1}`),
      x: toNum((it as unknown[])[1], 50),
      y: toNum((it as unknown[])[2], 50),
    }));
    const linksArr = asArray((raw as Record<string, unknown>)['links'] ?? (raw as Record<string, unknown>)['edges']);
    const links = linksArr.map((it) => {
      if (Array.isArray(it)) return { source: String(it[0]), target: String(it[1]) };
      const r = asRecord(it);
      return { source: String(r.source ?? r.from ?? ''), target: String(r.target ?? r.to ?? '') };
    });
    return { nodes, ...(links.length > 0 ? { links } : {}) };
  }

  return {};
}

/**
 * 热力图 — [x, y, value] 三元组多格式适配：
 *   1. [[x, y, v], …] 官方格式
 *   2. 对象数组：[{x, y, value}] / [{x, y, v}]
 *   3. 列式：{x:[], y:[], value:[]}
 * 输出 {points:[{x, y, value}]}
 */
function mapHeatmap(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const xKey = m.x || 'x';
  const yKey = m.y || 'y';
  const valueKey = m.value || 'value';

  const src = resolveSrc(raw, m, 'points', 'data', 'items', 'series');
  if (src.length > 0) {
    const points = src
      .map((it) => {
        if (Array.isArray(it)) {
          return { x: toNum(it[0]), y: toNum(it[1]), value: toNum(it[2]) };
        }
        const r = asRecord(it);
        return {
          x: toNum(r[xKey] ?? r[0]),
          y: toNum(r[yKey] ?? r[1]),
          value: toNum(r[valueKey] ?? r.v ?? r[2]),
        };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.value));
    if (points.length > 0) return { points };
  }

  // 列式：{x:[], y:[], value:[]}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const xArr = asArray(rec[xKey] ?? rec['x']);
    const yArr = asArray(rec[yKey] ?? rec['y']);
    const vArr = asArray(rec[valueKey] ?? rec['value'] ?? rec['v']);
    if (vArr.length > 0) {
      const len = Math.max(xArr.length, yArr.length, vArr.length);
      const points: { x: number; y: number; value: number }[] = [];
      for (let i = 0; i < len; i++) {
        const x = toNum(xArr[i]);
        const y = toNum(yArr[i]);
        const value = toNum(vArr[i]);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(value)) points.push({ x, y, value });
      }
      if (points.length > 0) return { points };
    }
  }

  return {};
}

/**
 * 雷达图 — indicator + value 多格式适配：
 *   1. 标准：{indicators:[{name,max}], data:[{name, value:[…]}]} 或 {indicators, values:[…]}
 *   2. 对象数组：[{name, value: number}] → 每项是一个维度（indicator name + value）
 *   3. 纯数组：[80, 90, 70] → 维度名自动「维度N」，max 100
 * 输出 {indicators:[{name,max}], series:[{name, value:[…]}]}
 */
function mapRadar(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};

  // ── 标准/列式：{indicators, data/values} ──
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const indArr = asArray(rec[m.indicators || 'indicators'] ?? rec['indicator']);
    const indicators: { name: string; max: number }[] = indArr.map((it) => {
      const r = asRecord(it);
      return { name: String(r.name ?? r.label ?? r[0] ?? ''), max: toNum(r.max ?? r.maximum, 100) };
    });
    if (indicators.length > 0) {
      // data: [{name, value}] 或 {values: [...]}
      const dataArr = asArray(rec['data'] ?? rec['series']);
      if (dataArr.length > 0) {
        const series = dataArr.map((it) => {
          const r = asRecord(it);
          return {
            name: String(r.name ?? r.label ?? '系列'),
            value: asArray(r.value ?? r.values ?? r.data).map((v) => toNum(v)),
          };
        }).filter((s) => s.value.length > 0);
        if (series.length > 0) return { indicators, series };
      }
      const valuesArr = asArray(rec[m.values || 'values']);
      if (valuesArr.length > 0) {
        return {
          indicators,
          series: [{ name: '数据', value: valuesArr.map((v) => toNum(v)) }],
        };
      }
    }
  }

  // ── 对象数组：每项 {name, value} 是一个维度 ──
  const src = resolveSrc(raw, m, 'data', 'data', 'items', 'series');
  if (src.length > 0) {
    const nameKey = m.name || 'name';
    const valueKey = m.value || 'value';
    const allNamed = src.every((it) => !Array.isArray(it));
    if (allNamed) {
      const indicators = src.map((it, i) => {
        const r = asRecord(it);
        return { name: String(r[nameKey] ?? r.label ?? `维度${i + 1}`), max: toNum(r.max ?? r.maximum, 100) };
      });
      const values = src.map((it) => toNum(asRecord(it)[valueKey] ?? asRecord(it).value));
      if (values.some((v) => Number.isFinite(v)) && indicators.length > 0) {
        return { indicators, series: [{ name: '数据', value: values }] };
      }
    }
    // 纯数组 [80, 90, 70] → 维度自动命名
    if (src.every((it) => typeof it === 'number' || typeof it === 'string')) {
      const values = src.map((v) => toNum(v));
      return {
        indicators: values.map((_, i) => ({ name: `维度${i + 1}`, max: 100 })),
        series: [{ name: '数据', value: values }],
      };
    }
  }

  return {};
}

/**
 * 盘中走势图（带休市间隔）— 时间字符串 + 数值适配：
 *   1. 列式：{times:[], values:[]}（官方格式）
 *   2. 对象数组：[{time, value}] / [{date, y}]
 *   3. [time, value] 对
 * 时间保留字符串（category 轴标签），输出 {points:[{time, value}]}
 */
function mapIntraday(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const timeKey = m.time || 'time';
  const valueKey = m.value || 'value';

  // 列式（官方格式优先）
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const timesArr = asArray(rec[timeKey] ?? rec['times'] ?? rec['dates']);
    const valuesArr = asArray(rec[valueKey] ?? rec['values'] ?? rec['y']);
    if (valuesArr.length > 0) {
      const len = Math.max(timesArr.length, valuesArr.length);
      const points: { time: string; value: number }[] = [];
      for (let i = 0; i < len; i++) {
        const t = timesArr[i];
        const value = toNum(valuesArr[i]);
        if (t != null && Number.isFinite(value)) points.push({ time: String(t), value });
      }
      if (points.length > 0) return { points };
    }
  }

  // 对象数组 / 对
  const src = resolveSrc(raw, m, 'points', 'data', 'items', 'series');
  if (src.length > 0) {
    const points = src
      .map((it) => {
        if (Array.isArray(it)) {
          return { time: String(it[0] ?? ''), value: toNum(it[1]) };
        }
        const r = asRecord(it);
        return {
          time: String(r[timeKey] ?? r.date ?? r.x ?? ''),
          value: toNum(r[valueKey] ?? r.y ?? r.v ?? r[1]),
        };
      })
      .filter((p) => p.time !== '' && Number.isFinite(p.value));
    if (points.length > 0) return { points };
  }

  return {};
}

/**
 * 散点图 — [x, y] 对多格式适配（参照 mapVoronoi）：
 *   1. [[x, y], …] 对（ECharts 官方格式）
 *   2. 对象数组：[{name, x, y}] / [{x, y}] / [{name, value}]
 *   3. 列式：{x:[], y:[]}
 */
function mapScatter(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const xKey = m.x || 'x';
  const yKey = m.y || 'y';
  const nameKey = m.name || 'name';

  const src = resolveSrc(raw, m, 'points', 'data', 'items', 'series');
  if (src.length > 0) {
    const points = src
      .map((it) => {
        if (Array.isArray(it)) {
          return { name: '', x: toNum(it[0]), y: toNum(it[1]) };
        }
        const r = asRecord(it);
        return {
          name: String(r[nameKey] ?? r.label ?? r.id ?? ''),
          x: toNum(r[xKey] ?? r[0]),
          y: toNum(r[yKey] ?? r.value ?? r[1]),
        };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (points.length > 0) return { points };
  }

  // 列式：{x:[], y:[]}（或 values）
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const xArr = asArray(rec[xKey] ?? rec['x']);
    const yArr = asArray(rec[yKey] ?? rec['y'] ?? rec['values']);
    if (xArr.length > 0 || yArr.length > 0) {
      const len = Math.max(xArr.length, yArr.length);
      const points: { name: string; x: number; y: number }[] = [];
      for (let i = 0; i < len; i++) {
        const x = toNum(xArr[i]);
        const y = toNum(yArr[i]);
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ name: '', x, y });
      }
      if (points.length > 0) return { points };
    }
  }

  return {};
}

/**
 * 阶梯线图 — [x, value] 对多格式适配（x 保留原始类型，组件自动判断 time/category 轴）：
 *   1. [[x, value], …] 对（x 可为时间戳或字符串）
 *   2. 对象数组：[{x/name/time, value}]
 *   3. 列式：{x/names/times:[], values:[]}
 */
function mapStepLine(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const xKey = m.x || 'x';
  const valueKey = m.value || 'value';

  const src = resolveSrc(raw, m, 'points', 'data', 'items', 'series');
  if (src.length > 0) {
    const points = src
      .map((it) => {
        if (Array.isArray(it)) {
          const x = typeof it[0] === 'string' && !Number.isNaN(parseFloat(it[0])) && /^[-.\d]+$/.test(String(it[0]))
            ? parseFloat(String(it[0]))  // 纯数字字符串 → 数字（时间戳）
            : it[0];
          return { x, value: toNum(it[1]) };
        }
        const r = asRecord(it);
        const xv = r[xKey] ?? r.name ?? r.time ?? r.date ?? r[0];
        const x = typeof xv === 'string' && /^[-.\d]+$/.test(xv) ? parseFloat(xv) : xv;
        return { x, value: toNum(r[valueKey] ?? r.y ?? r.v ?? r[1]) };
      })
      .filter((p) => p.x != null && Number.isFinite(p.value));
    if (points.length > 0) return { points };
  }

  // 列式：{x/names/times:[], values:[]}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const xArr = asArray(rec[xKey] ?? rec['names'] ?? rec['times'] ?? rec['labels']);
    const valuesArr = asArray(rec[valueKey] ?? rec['values'] ?? rec['y']);
    if (valuesArr.length > 0) {
      const len = Math.max(xArr.length, valuesArr.length);
      const points: { x: number | string; value: number }[] = [];
      for (let i = 0; i < len; i++) {
        const xv = xArr[i];
        const x = typeof xv === 'string' && /^[-.\d]+$/.test(xv) ? parseFloat(xv) : (typeof xv === 'number' ? xv : undefined);
        const value = toNum(valuesArr[i]);
        if (x != null && Number.isFinite(value)) points.push({ x, value });
      }
      if (points.length > 0) return { points };
    }
  }

  return {};
}

/**
 * 大规模面积图（时间序列）— 多格式适配：
 *   1. 官方格式：[[timestamp, value], …]
 *   2. 对象数组：[{time/date/t, value/y/v}, …]
 *   3. 列式：{times/dates:[], values:[]}
 * 时间键统一转时间戳（ISO 字符串 → Date.parse），输出 {points:[{time, value}]}
 */
function mapLargeArea(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const toTs = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      if (Number.isFinite(n) && !/[:T-]/.test(v)) return n;  // 纯数字字符串 → 直接当时间戳
      const d = Date.parse(v);                                 // ISO/日期字符串 → 时间戳
      return Number.isFinite(d) ? d : NaN;
    }
    return NaN;
  };
  const toVal = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '')));

  const src = resolveSrc(raw, m, 'points', 'data', 'items', 'series');
  if (src.length > 0) {
    const timeKey = m.time || 'time';
    const valueKey = m.value || 'value';
    const points = src
      .map((it) => {
        // 官方格式 [ts, value]
        if (Array.isArray(it)) {
          return { time: toTs(it[0]), value: toVal(it[1]) };
        }
        const r = asRecord(it);
        return {
          time: toTs(r[timeKey] ?? r.t ?? r.date ?? r.x ?? r[0]),
          value: toVal(r[valueKey] ?? r.y ?? r.v ?? r[1]),
        };
      })
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value));
    if (points.length > 0) return { points };
  }

  // 列式：{times:[], values:[]} / {dates:[], values:[]} / {x:[], y:[]}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const timesArr = asArray(rec[m.time || 'times'] ?? rec['times'] ?? rec['dates'] ?? rec['x']);
    const valuesArr = asArray(rec[m.value || 'values'] ?? rec['values'] ?? rec['y']);
    if (valuesArr.length > 0) {
      const len = Math.max(timesArr.length, valuesArr.length);
      const points: { time: number; value: number }[] = [];
      for (let i = 0; i < len; i++) {
        const time = toTs(timesArr[i]);
        const value = toVal(valuesArr[i]);
        if (Number.isFinite(time) && Number.isFinite(value)) points.push({ time, value });
      }
      if (points.length > 0) return { points };
    }
  }

  return {};
}

/**
 * 置信区间带 — 参照 mapLine：xLabels + 主线 → {xLabels, mainSeries, upper, lower}
 * 上下界支持 mapping 自定义路径 + 常见键名（upper/lower/ci_upper/ci_lower 等）。
 */
function mapConfidenceBand(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const labels = resolveSrc(raw, m, 'xLabels', 'categories').map(String);
  if (labels.length) out.xLabels = labels;

  // 主线：series 数组第一项，或 mapping.series 指定
  const series = resolveSrc(raw, m, 'series', 'series', 'data', 'items');
  const main = asRecord(series[0]);
  if (main) {
    out.mainSeries = {
      name: String(main[m.name || 'name'] ?? '观测值'),
      data: asArray(main[m.data || 'data']).map((v) => toNum(v)),
    };
  }

  // 上下界：对象字段（支持 mapping + 常见键名）
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const upperArr = asArray(rec[m.upper || 'upper'] ?? rec['ci_upper'] ?? rec['ciUpper'] ?? rec['band_upper']);
    const lowerArr = asArray(rec[m.lower || 'lower'] ?? rec['ci_lower'] ?? rec['ciLower'] ?? rec['band_lower']);
    if (upperArr.length) out.upper = upperArr.map((v) => toNum(v));
    if (lowerArr.length) out.lower = lowerArr.map((v) => toNum(v));
  }

  return out;
}

/**
 * Voronoi 图 — 参照 mapPie 模式：对象数组 → {points:[{name, x, y}]}
 * 支持 mapping 自定义 x/y/name 键；y 自动 fallback value 等常见键名。
 */
function mapVoronoi(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const src = resolveSrc(raw, m, 'points', 'data', 'items', 'series');
  if (src.length === 0) return {};
  const xKey = m.x || 'x';
  const yKey = m.y || 'y';
  const nameKey = m.name || 'name';
  const points = src
    .map((it) => {
      const r = asRecord(it);
      return {
        name: String(r[nameKey] ?? r.label ?? r.id ?? ''),
        x: toNum(r[xKey] ?? r.lng ?? r.lon ?? r['0']),
        y: toNum(r[yKey] ?? r.value ?? r.lat ?? r['1']),
      };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  return points.length > 0 ? { points } : {};
}

/** 直方图 — 提取原始数值数组 → {data: number[]}（分箱由组件内部完成） */
function mapHistogram(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const src = resolveSrc(raw, m, 'data', 'data', 'values', 'items');
  if (src.length === 0) return {};
  const valueKey = m.value || 'value';
  const nums = src
    .map((it) => (typeof it === 'number' ? it : toNum(asRecord(it)[valueKey] ?? asRecord(it)['y'])))
    .filter((n) => Number.isFinite(n));
  return nums.length > 0 ? { data: nums } : {};
}

/** 分组柱状图 — 参照 mapLine：xLabels + 多系列 → {xLabels, barSeries} */
function mapGroupBar(raw: unknown, m: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const labels = resolveSrc(raw, m, 'xLabels', 'categories').map(String);
  if (labels.length) out.xLabels = labels;
  const series = resolveSrc(raw, m, 'series', 'series', 'barSeries', 'data', 'items').map((s) => {
    const r = asRecord(s);
    return {
      name: String(r[m.name || 'name'] ?? ''),
      data: asArray(r[m.data || 'data']).map((v) => toNum(v)),
    };
  });
  if (series.length) out.barSeries = series;
  return out;
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

/**
 * 环形滚动表格 — 表格数据多格式适配：
 *   1. {headers:[...], rows:[[...], ...]}
 *   2. {columns:[...], data:[[...], ...]}
 *   3. 对象数组 [{k1:v1, k2:v2}, ...] → 表头取首个对象键，行为值数组
 * 输出 {headers:[string], rows:[[string|number], ...]}
 */
function mapMarqueeTable(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const out: Record<string, unknown> = {};
  const headers = resolveSrc(raw, m, 'headers', 'columns', 'header', 'cols').map(String);
  const rowsSrc = resolveSrc(raw, m, 'rows', 'data', 'items', 'list');

  // 对象数组：无显式 headers → 从首个对象键推断
  if (rowsSrc.length > 0 && rowsSrc.every((it) => !Array.isArray(it))) {
    const first = asRecord(rowsSrc[0]);
    const keys = Object.keys(first);
    if (keys.length) out.headers = keys;
    out.rows = rowsSrc.map((it) => {
      const r = asRecord(it);
      return keys.map((k) => {
        const v = r[k];
        return typeof v === 'number' ? v : String(v ?? '');
      });
    });
    return out;
  }

  const rows = rowsSrc.map((it) => {
    if (Array.isArray(it)) {
      return it.map((v) => (typeof v === 'number' ? v : String(v ?? '')));
    }
    return Object.values(asRecord(it)).map((v) => (typeof v === 'number' ? v : String(v ?? '')));
  });
  if (headers.length) out.headers = headers;
  if (rows.length) out.rows = rows;
  return out.headers || out.rows ? out : {};
}

/**
 * 网络攻击地球 — 攻击数据多格式适配：
 *   A 标准：{sources:[{id,name,lat,lng}], targets:[...], attacks:[{source,target,count}]}
 *   B 坐标内联：{attacks:[{source:{name,lat,lng}, target:{name,lat,lng}, count}]}（自动收集匿名源/目标）
 *   C 单列表：{sources:[...], attacks:[{source:"名", target:"名", count}]}（无 targets，未命中跳过）
 *   D 裸数组：[["源名",lat,lng,"目标名",lat,lng,count], ...]
 *   E 仅事件：[{from:"A", to:"B", count:320}]（from/to 别名）
 * 字段别名：lat↔latitude/y、lng↔lon/longitude/x、count↔value/volume/attacks
 * 输出 {sources, targets, attacks}
 */
function mapAttackGlobe(raw: unknown, m: FieldMapping, tw?: TimeWindowConfig): Record<string, unknown> {
  if (raw == null) return {};
  const nameKey = m.name || 'name';
  const latKey = m.lat || 'lat';
  const lngKey = m.lng || 'lng';
  const countKey = m.count || 'count';
  // 时间窗口统计：开启后只统计窗口内事件（无时间戳的事件忽略）；关闭 = 原有逻辑
  const timeKey = m.time || 'time';
  const now = Date.now();

  const num = (v: unknown): number => toNum(v, NaN);
  const loc = (r: Record<string, unknown>): { lat: number; lng: number } | null => {
    const lat = num(r[latKey] ?? r.latitude ?? r.y);
    const lng = num(r[lngKey] ?? r.lon ?? r.longitude ?? r.x);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };
  const srcName = (r: Record<string, unknown>): string => String(r[nameKey] ?? r.label ?? '');

  // 直接对象
  const candidate = asRecord(raw);
  const srcArr = resolveSrc(raw, m, 'sources', 'source', 'src');
  const tgtArr = resolveSrc(raw, m, 'targets', 'target', 'dst');
  const atkArr = resolveSrc(raw, m, 'attacks', 'events', 'data', 'items');

  const sources: { id: string; name: string; lat: number; lng: number }[] = [];
  const targets: { id: string; name: string; lat: number; lng: number }[] = [];
  const attacks: { source: string; target: string; count: number }[] = [];
  const seen = { src: new Set<string>(), tgt: new Set<string>() };
  const addLoc = (arr: typeof sources, key: 'src' | 'tgt', r: Record<string, unknown>, fallbackName: string) => {
    const pos = loc(r);
    const name = srcName(r) || fallbackName;
    if (!pos || !name || seen[key].has(name)) return;
    seen[key].add(name);
    arr.push({ id: name, name, ...pos });
  };

  for (const it of srcArr) addLoc(sources, 'src', asRecord(it), '');
  for (const it of tgtArr) addLoc(targets, 'tgt', asRecord(it), '');

  // 事件处理（含坐标内联格式 B）
  for (const it of atkArr) {
    const r = asRecord(it);
    if (r.source && typeof r.source === 'object' && !Array.isArray(r.source)) {
      addLoc(sources, 'src', asRecord(r.source), '');
    }
    if (r.target && typeof r.target === 'object' && !Array.isArray(r.target)) {
      addLoc(targets, 'tgt', asRecord(r.target), '');
    }
    const sRef = typeof r.source === 'string' ? r.source
      : typeof r.from === 'string' ? r.from
      : srcName(asRecord(r.source));
    const tRef = typeof r.target === 'string' ? r.target
      : typeof r.to === 'string' ? r.to
      : srcName(asRecord(r.target));
    if (!sRef || !tRef) continue;
    // 时间段统计：开启时按时间戳过滤（time/timestamp/ts/timeStamp/date 均兼容）
    if (tw?.enabled) {
      const ts = parseTs(r[timeKey] ?? r.timestamp ?? r.ts ?? r.timeStamp ?? r.date);
      if (ts == null || !inTimeWindow(ts, tw, now)) continue;
    }
    attacks.push({
      source: sRef,
      target: tRef,
      count: Math.max(0, toNum(r[countKey] ?? r.value ?? r.volume ?? r.attacks, 1)),
    });
  }

  // 裸数组格式 D：[源名, lat, lng, 目标名, lat, lng, count]（无时间戳，窗口开启时忽略）
  if (atkArr.length === 0 && Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    for (const row of raw as unknown[][]) {
      if (tw?.enabled) continue;
      if (row.length < 6) continue;
      const [sn, slat, slng, tn, tlat, tlng] = row.map((v) => String(v ?? ''));
      const count = toNum(row[6] ?? 1, 1);
      const sLat = parseFloat(slat), sLng = parseFloat(slng);
      const tLat = parseFloat(tlat), tLng = parseFloat(tlng);
      if (!sn || !tn || !Number.isFinite(sLat) || !Number.isFinite(tLat)) continue;
      if (!seen.src.has(sn)) { seen.src.add(sn); sources.push({ id: sn, name: sn, lat: sLat, lng: sLng }); }
      if (!seen.tgt.has(tn)) { seen.tgt.add(tn); targets.push({ id: tn, name: tn, lat: tLat, lng: tLng }); }
      attacks.push({ source: sn, target: tn, count: Math.max(0, count) });
    }
  }

  if (attacks.length > 0 || sources.length > 0 || targets.length > 0) {
    const out: Record<string, unknown> = {};
    if (sources.length) out.sources = sources;
    if (targets.length) out.targets = targets;
    if (attacks.length) out.attacks = attacks;
    return out;
  }
  return {};
}

/**
 * 仪表盘 — 单值多格式适配：
 *   1. 数字：{value}
 *   2. 数组：[数字] 或 [{value, name, unit}]
 *   3. 对象：{value/name/unit}（data 数组单元素兜底）
 * 输出 {value, name?, unit?}
 */
function mapGauge(raw: unknown, m: FieldMapping): Record<string, unknown> {
  if (raw == null) return {};
  const out: Record<string, unknown> = {};
  const fromObj = (r: Record<string, unknown>) => {
    const v = toNum(r[m.value || 'value'], NaN);
    if (Number.isFinite(v)) out.value = Math.round(v);
    const nm = r[m.name || 'name'] ?? r.title;
    if (nm != null) out.name = String(nm);
    const u = r[m.unit || 'unit'] ?? r.suffix;
    if (u != null) out.unit = String(u);
  };
  if (typeof raw === 'number') { out.value = Math.round(raw); }
  else if (Array.isArray(raw)) {
    const first = raw[0];
    if (typeof first === 'number') { out.value = Math.round(first); }
    else if (first && typeof first === 'object') { fromObj(asRecord(first)); }
  } else if (typeof raw === 'object') {
    const r = asRecord(raw);
    fromObj(r);
    // 包装 data 数组（单元素）兜底
    if (out.value === undefined) {
      const data = asArray(r['data']);
      if (data.length) fromObj(asRecord(data[0]));
    }
  }
  return out;
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
