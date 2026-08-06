/**
 * 线路路径规划 — AMap.Driving 途经点规划（真实道路）+ localStorage 缓存 + 直线降级。
 *
 * 为什么用 Driving 而非 Transfer：Transfer 是 A→B 公交换乘方案（含步行/换乘段，
 * 可能换乘到别的线路），拿不到整条线路路径；Driving 把数据源站点序列作为途经点
 * 强制经过，返回严格沿真实道路且经过每个站点的路径。
 */

import type { BusLine } from '@hugescreen/data';
import { loadAmap } from './loadAmap';

export interface LinePath {
  /** 路径坐标数组 [lng, lat]，GCJ-02 */
  coords: [number, number][];
  /** 各站点在 coords 上的下标（与 line.stations 一一对应） */
  stopIndexes: number[];
}

// ★ 版本化缓存键：规划算法变更时 bump（v1→v2 逐段规划），作废浏览器里的旧坏路径
const CACHE_PREFIX = 'bm-path-v2:';
/** 同线路并发规划去重（多实例/多 effect 共享） */
const pending = new Map<string, Promise<LinePath>>();

/**
 * 获取线路路径：localStorage 缓存（带站点序列签名，改线自动失效）→ Driving 规划 → 直线降级。
 * 降级也返回路径（coords = 站点连线），调用方无需区分。
 */
export function getLinePath(line: BusLine, stations: Map<string, [number, number]>): Promise<LinePath> {
  const sig = line.stations.join('>');

  // 1. 缓存命中（按线路 id + 站点序列签名）
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + line.id);
    if (raw) {
      const cached = JSON.parse(raw) as { sig: string; coords: [number, number][]; stopIndexes: number[] };
      if (cached.sig === sig && Array.isArray(cached.coords) && cached.coords.length >= 2) {
        return Promise.resolve({ coords: cached.coords, stopIndexes: cached.stopIndexes });
      }
    }
  } catch { /* localStorage 不可用时忽略 */ }

  // 2. 并发去重
  const planKey = `${line.id}:${sig}`;
  const existing = pending.get(planKey);
  if (existing) return existing;

  const p = planPath(line, stations)
    .then((path) => {
      try {
        localStorage.setItem(CACHE_PREFIX + line.id, JSON.stringify({ sig, ...path }));
      } catch { /* 忽略缓存失败 */ }
      return path;
    })
    .finally(() => pending.delete(planKey));
  pending.set(planKey, p);
  return p;
}

async function planPath(line: BusLine, stations: Map<string, [number, number]>): Promise<LinePath> {
  // 站点 → 坐标（未知站点直接跳过，只规划已知序列）
  const pts: [number, number][] = [];
  const knownIdx: number[] = [];
  line.stations.forEach((name, i) => {
    const c = stations.get(name);
    if (c) { pts.push(c); knownIdx.push(i); }
  });
  if (pts.length < 2) return { coords: [], stopIndexes: [] };

  try {
    const AMap = await loadAmap();
    const coords = await drivingPlan(AMap, pts);
    // 站点在路径上的下标：从上个站点的下标开始搜索（约束单调，防绕路乱序）
    const stopIndexes: number[] = new Array(line.stations.length).fill(-1);
    let from = 0;
    knownIdx.forEach((stationIdx, i) => {
      from = nearestFrom(coords, pts[i], from);
      stopIndexes[stationIdx] = from;
    });
    console.log(`[busMap] route planned line=${line.id} points=${coords.length}`);
    return { coords, stopIndexes };
  } catch (err) {
    // 降级：站点直线连线（数据源线路是模拟的，真实道路不经过属预期情况）
    console.warn('[busMap] route fallback (straight line):', line.id, err);
    return { coords: pts, stopIndexes: pts.map((_, i) => i) };
  }
}

/**
 * AMap.Driving 逐段规划 → 拼接全部 step 的 polyline 为坐标数组。
 *
 * ★ 为什么逐段而非一次途经点规划：高德对「途经点」是尽量经过而非强制——
 *   距道路较远的站点（地理编码坐标偏离站台）会被忽略，路径绕过站点。
 *   逐段规划每段只有起/终两个端点（无途经点依赖），路径必然从每个站点出发和到达，
 *   拼接后站站必经；某段规划失败时该段降级为站点直线（不中断整条线）。
 */
function drivingPlan(AMap: unknown, pts: [number, number][]): Promise<[number, number][]> {
  return new Promise((resolve, reject) => {
    const A = AMap as any;
    const driving = new A.Driving({ city: '镇江' });
    const all: [number, number][] = [];
    let i = 0;

    const pushPt = (c: [number, number]) => {
      const last = all[all.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) all.push(c);
    };
    const appendStepPath = (raw: unknown) => {
      // JS API 1.x：path 为 "lng,lat;lng,lat;..." 字符串；2.0：路径点数组
      if (typeof raw === 'string') {
        for (const seg of raw.split(';')) {
          const [lng, lat] = seg.split(',').map(Number);
          if (Number.isFinite(lng) && Number.isFinite(lat)) pushPt([lng, lat]);
        }
      } else if (Array.isArray(raw)) {
        for (const p of raw) {
          const lng = Number(Array.isArray(p) ? p[0] : (p as { lng?: unknown }).lng);
          const lat = Number(Array.isArray(p) ? p[1] : (p as { lat?: unknown }).lat);
          if (Number.isFinite(lng) && Number.isFinite(lat)) pushPt([lng, lat]);
        }
      }
    };

    const seg = () => {
      if (i >= pts.length - 1) {
        if (all.length >= 2) resolve(all);
        else reject(new Error('driving empty path'));
        return;
      }
      driving.search(pts[i], pts[i + 1], {}, (status: string, result: any) => {
        if (status === 'complete' && result?.routes?.length > 0) {
          for (const step of result.routes[0].steps ?? []) appendStepPath(step.path);
        } else {
          // 该段不可达 → 直线补段（保持线路连续）
          console.warn(`[busMap] driving seg ${i} fallback straight (${status})`);
          pushPt(pts[i]);
          pushPt(pts[i + 1]);
        }
        i++;
        seg();
      });
    };
    seg();
  });
}

/** 从 from 下标开始找离 c 最近的点（单调约束） */
function nearestFrom(coords: [number, number][], c: [number, number], from: number): number {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < coords.length; i++) {
    const d = (coords[i][0] - c[0]) ** 2 + (coords[i][1] - c[1]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
