import { useEffect, useState, useMemo } from 'react';
import { useECharts, echarts } from './useECharts';

export interface VoronoiPoint {
  name: string;
  x: number;
  y: number;
}

interface VoronoiWidgetProps {
  points?: VoronoiPoint[];
  pointColor?: string;
  /** 是否显示 Voronoi 区域分界线 */
  showCells?: boolean;
}

const DEFAULT_POINTS: VoronoiPoint[] = [
  { name: 'A', x: 12, y: 38 },
  { name: 'B', x: 26, y: 62 },
  { name: 'C', x: 33, y: 28 },
  { name: 'D', x: 47, y: 55 },
  { name: 'E', x: 55, y: 30 },
  { name: 'F', x: 68, y: 70 },
  { name: 'G', x: 74, y: 42 },
  { name: 'H', x: 86, y: 22 },
  { name: 'I', x: 90, y: 58 },
  { name: 'J', x: 96, y: 78 },
];

// ─── 自实现 Voronoi 计算（Bowyer-Watson Delaunay 三角剖分 + 对偶提取）───
// 纯 TS 零依赖：不引 UMD/第三方几何库，渲染层用 ECharts custom series。
// 无限单元顶点直接保留，交给 ECharts 的 clip 裁剪到绘图区。

const EPS = 1e-12;

interface Tri {
  a: number; b: number; c: number;
  cx: number; cy: number; r2: number;  // 外接圆心 + 半径平方
}

function circumcircle(
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
): { cx: number; cy: number; r2: number } {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  // 退化（三点共线）→ 半径无穷大，必然被空圆准则剔除
  if (Math.abs(d) < EPS) return { cx: NaN, cy: NaN, r2: Infinity };
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r2 = (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy);
  return { cx: ux, cy: uy, r2 };
}

/** Bowyer-Watson 增量 Delaunay 三角剖分，返回三角形列表（仅数据点，不含超三角形） */
function delaunay(pts: { x: number; y: number }[]): Tri[] {
  const n = pts.length;
  if (n < 3) return [];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const dMax = Math.max(maxX - minX, maxY - minY, 1);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  // 超三角形：包围所有点的巨大三角形
  const superPts = [
    { x: midX - 20 * dMax, y: midY - dMax },
    { x: midX, y: midY + 20 * dMax },
    { x: midX + 20 * dMax, y: midY - dMax },
  ];
  const all = pts.concat(superPts);
  const mkTri = (a: number, b: number, c: number): Tri => {
    const cc = circumcircle(all[a].x, all[a].y, all[b].x, all[b].y, all[c].x, all[c].y);
    return { a, b, c, cx: cc.cx, cy: cc.cy, r2: cc.r2 };
  };
  let tris: Tri[] = [mkTri(n, n + 1, n + 2)];

  for (let i = 0; i < n; i++) {
    const px = pts[i].x, py = pts[i].y;
    // 外接圆包含新点的三角形（bad）
    const bad = tris.filter((t) => {
      if (t.r2 === Infinity) return true;
      const dx = px - t.cx, dy = py - t.cy;
      return dx * dx + dy * dy <= t.r2 + EPS;
    });
    if (bad.length === 0) continue;
    // 收集坏三角形边界（只保留出现一次的边 = 多边形的洞边界）
    const edgeCount = new Map<string, number>();
    for (const t of bad) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as const) {
        const key = u < v ? `${u}:${v}` : `${v}:${u}`;
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      }
    }
    const keep = new Set(tris.filter((t) => !bad.includes(t)));
    tris = tris.filter((t) => keep.has(t));
    for (const [key, count] of edgeCount) {
      if (count !== 1) continue;
      const [u, v] = key.split(':').map(Number);
      tris.push(mkTri(u, v, i));
    }
  }

  return tris.filter((t) => t.a < n && t.b < n && t.c < n);
}

/** Delaunay 对偶 → 每个数据点的 Voronoi 多边形（外心按角度环绕） */
function voronoiCells(pts: { x: number; y: number }[], tris: Tri[]): [number, number][][] {
  if (tris.length === 0) return [];
  const cellPts: { x: number; y: number }[][] = pts.map(() => []);
  for (const t of tris) {
    if (Number.isNaN(t.cx)) continue;
    cellPts[t.a].push({ x: t.cx, y: t.cy });
    cellPts[t.b].push({ x: t.cx, y: t.cy });
    cellPts[t.c].push({ x: t.cx, y: t.cy });
  }
  return cellPts.map((cs, i) =>
    cs
      .sort((p, q) => Math.atan2(p.y - pts[i].y, p.x - pts[i].x) - Math.atan2(q.y - pts[i].y, q.x - pts[i].x))
      .map((p) => [p.x, p.y] as [number, number]),
  );
}

// ─── 哨兵点法处理凸包无限单元 ───
// 凸包边缘点的 Voronoi 单元本应向无穷延伸（开链）。在 [0,1]² 盒外 2 单位
// 处放一圈 8 个哨兵点参与 Delaunay：所有原始点都成为「内部点」，单元自动
// 闭合且包含自身；哨兵距盒 ≥2 → 中垂线在盒外 ≥1，盒内区域完全不受哨兵影响。
// 盒外外心由 Sutherland–Hodgman 裁剪收敛到盒边。

const SENTINELS: { x: number; y: number }[] = [
  { x: -2, y: -2 }, { x: 0.5, y: -2 }, { x: 3, y: -2 },
  { x: -2, y: 0.5 }, { x: 3, y: 0.5 },
  { x: -2, y: 3 }, { x: 0.5, y: 3 }, { x: 3, y: 3 },
];

/** Sutherland–Hodgman：把任意多边形裁剪到 [0,1]² 盒内（处理盒外外心） */
function clipPolyToBox(poly: [number, number][]): [number, number][] {
  let output = poly.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (output.length < 3) return output;
  const edges: [number, number, number, number][] = [
    [0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0],  // 盒边界（逆时针）
  ];
  for (const [ax, ay, bx, by] of edges) {
    const input = output;
    output = [];
    if (input.length === 0) break;
    const inside = (x: number, y: number) =>
      (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -1e-9;
    const inter = (p1: [number, number], p2: [number, number]): [number, number] => {
      const [x1, y1] = p1, [x2, y2] = p2;
      const denom = (x2 - x1) * (by - ay) - (y2 - y1) * (bx - ax);
      if (Math.abs(denom) < 1e-12) return p2;
      const t = ((ax - x1) * (by - ay) - (ay - y1) * (bx - ax)) / denom;
      return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    };
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], nxt = input[(i + 1) % input.length];
      if (inside(cur[0], cur[1])) {
        output.push(cur);
        if (!inside(nxt[0], nxt[1])) output.push(inter(cur, nxt));
      } else if (inside(nxt[0], nxt[1])) {
        output.push(inter(cur, nxt));
      }
    }
  }
  return output;
}

/** 哨兵点版单元生成：原始点 + 哨兵点 Delaunay → 只取原始点的 cell → 裁剪到盒内 */
function computeClippedCells(normPts: { x: number; y: number }[]): [number, number][][] {
  if (normPts.length < 3) return [];
  const all = normPts.concat(SENTINELS);
  const cells = voronoiCells(all, delaunay(all)).slice(0, normPts.length);
  return cells.map(clipPolyToBox).filter((c) => c.length >= 3);
}

/**
 * VoronoiWidget — Voronoi 图（散点 + 最近邻区域划分），对应 VictoryVoronoi。
 * 纯 ECharts 实现：自实现 Delaunay/Voronoi 几何计算（零依赖），
 * custom series 渲染区域 + scatter 渲染散点。数据归一化到 [0,1]² 域，
 * 轴标签 formatter 还原真实值，坐标全链路自洽。
 */
export function VoronoiWidget({
  points,
  pointColor = '#00D4FF',
  showCells = true,
}: VoronoiWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const pts = points?.length ? points : DEFAULT_POINTS;
  // 供 tooltip/label 用 dataIndex 反查原始数据（闭包，不进 ECharts data）
  const ptsRef = pts;

  // ── 归一化：真实值 → [0,1]²（留 8% 边距）──
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;
  const norm = (v: number, min: number, range: number) => 0.08 + 0.84 * ((v - min) / range);
  const normPts = pts.map((p) => ({ name: p.name, x: norm(p.x, xMin, xRange), y: norm(p.y, yMin, yRange) }));
  const denormX = (v: number) => xMin + ((v - 0.08) / 0.84) * xRange;
  const denormY = (v: number) => yMin + ((v - 0.08) / 0.84) * yRange;
  const fmt = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1));

  // ── Voronoi 多边形（归一化域数据坐标）──
  const polygons = useMemo<[number, number][][]>(() => {
    // 哨兵点法：凸包点单元自动闭合且包含自身，盒外外心裁剪到盒内
    // 过滤退化单元（重复点导致顶点 < 3）：只画点不画区域
    return computeClippedCells(normPts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(normPts)]);

  useEffect(() => {
    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => {
          // data 用 dataIndex 反查闭包中的原始点（真实值）
          const d = ptsRef[p.dataIndex];
          if (!d) return '';
          return `${d.name}<br/>X: ${fmt(d.x)}<br/>Y: ${fmt(d.y)}`;
        },
      },
      grid: { left: 44, right: 20, top: 12, bottom: 30 },
      xAxis: {
        type: 'value' as const, min: 0, max: 1,
        axisLabel: {
          color: '#9E9EA8', fontSize: 10,
          formatter: (v: number) => fmt(denormX(v)),
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'value' as const, min: 0, max: 1,
        axisLabel: {
          color: '#9E9EA8', fontSize: 10,
          formatter: (v: number) => fmt(denormY(v)),
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [
        // Voronoi 区域（底层）：data 传简单索引，多边形经 dataIndex 从闭包取
        // ★ ECharts 会把数组 data 按维度解包（DataStore original getter），
        //   嵌套数组 → 每个顶点变成数据项 → renderItem 崩溃。索引方案零歧义。
        ...(showCells && polygons.length > 0 ? [{
          type: 'custom' as const,
          name: '区域',
          clip: true,
          data: polygons.map((_, i) => i),
          renderItem: (params: any, api: any) => {
            const poly = polygons[params.dataIndex];
            if (!poly) return null;
            const pts2 = poly.map(([px, py]) => {
              const c = api.coord([px, py]);
              return [c[0], c[1]];
            });
            return {
              type: 'polygon',
              shape: { points: pts2 },
              style: {
                fill: pointColor,
                fillOpacity: 0.06,
                stroke: pointColor,
                strokeOpacity: 0.35,
                lineWidth: 1,
              },
              silent: true,
            };
          },
        }] : []),
        // 散点（上层）：data 用 [x, y] 数组（对象格式会被维度解包同样不可靠）
        {
          type: 'scatter' as const,
          name: '数据点',
          data: normPts.map((p) => [p.x, p.y]),
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: {
            color: pointColor,
            shadowBlur: 8,
            shadowColor: `${pointColor}66`,
          },
          emphasis: {
            scale: 1.8,
            itemStyle: { color: '#FF8C42' },
          },
          animation: animated,
          animationDuration: animated ? 800 : 0,
          animationDelay: animated ? (idx: number) => idx * 40 : undefined,
          label: {
            show: true,
            position: 'top' as const,
            color: '#9E9EA8',
            fontSize: 9,
            formatter: (p: any) => {
              const d = ptsRef[p.dataIndex];
              return d ? d.name : '';
            },
          },
        },
      ],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      // 首帧：只有区域（无点），双 rAF 后点入场
      setOption({ ...opt(false), series: opt(false).series.map((s: any) =>
        s.type === 'scatter' ? { ...s, symbolSize: 0, label: { ...s.label, show: false } } : s) }, true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(normPts), JSON.stringify(polygons), pointColor, showCells]);

  return <div ref={chartRef} className="w-full h-full" />;
}
