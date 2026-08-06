/**
 * 线路路径 — 静态数据驱动（/data/bus_routes.json，开发时一次性采集的真实道路路径）。
 *
 * 公交线路是固定的：采集一次、长期使用、运行时零在线规划调用
 * （不再依赖高德 JS API Driving / 服务器代理，彻底消除限流、失败、缓存问题）。
 *
 * 结构（bus_routes.json）：
 *   lines: [{
 *     lineId, name, stations,           // 站点序列（与数据源签名，防改线错配）
 *     segments: [[[lng,lat],...], ...], // 相邻站点间的真实道路路径段（逐段规划）
 *     stopIndexes: number[]             // 各站点在「拼接坐标」上的下标；-1 = 该站所在段
 *                                       //   规划失败 → 车辆停站（绝不直线插值）
 *   }]
 */

import type { BusLine } from '@hugescreen/data';

export interface RouteSegment {
  coords: [number, number][];
}

export interface LinePath {
  /** 绘制用：相邻站点间的路径段（每段一条 Polyline，失败段不存在 → 无直线） */
  segments: [number, number][][];
  /** 插值用：全部成功段拼接后的连续坐标 */
  coords: [number, number][];
  /** 各站点在 coords 上的下标（-1 = 该站无法沿路径行驶，停站） */
  stopIndexes: number[];
}

interface RouteFileLine {
  lineId: number;
  name?: string;
  stations: string[];
  segments: [number, number][][];
  stopIndexes: number[];
}

let routesCache: Promise<Map<number, RouteFileLine> | null> | null = null;

/** 加载静态路径表（模块级缓存，一次加载长期使用） */
export function loadRoutes(): Promise<Map<number, RouteFileLine> | null> {
  if (!routesCache) {
    routesCache = fetch('/data/bus_routes.json')
      .then((res) => res.json())
      .then((j: { lines?: RouteFileLine[] }) => {
        const map = new Map<number, RouteFileLine>();
        for (const l of j.lines ?? []) map.set(l.lineId, l);
        console.log(`[busMap] routes loaded: ${map.size} lines`);
        return map;
      })
      .catch((err) => {
        console.warn('[busMap] routes load failed:', err);
        return null;
      });
  }
  return routesCache;
}

/**
 * 获取线路路径：静态表命中且站点序列一致 → 返回；否则 null（不画线，车辆停站）。
 * ★ 不返回直线/在线规划兜底：路径要么真实存在，要么不画。
 */
export async function getLinePath(line: BusLine): Promise<LinePath | null> {
  const routes = await loadRoutes();
  const entry = routes?.get(line.id);
  if (!entry || entry.stations.join('>') !== line.stations.join('>')) {
    console.warn(`[busMap] no static route for line=${line.id} (${line.name}) — not drawn`);
    return null;
  }
  // 拼接连续坐标（供车辆弧长插值）
  const coords: [number, number][] = [];
  for (const seg of entry.segments) {
    for (const c of seg) coords.push(c);
  }
  return {
    segments: entry.segments,
    coords,
    stopIndexes: entry.stopIndexes,
  };
}
