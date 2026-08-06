/**
 * 公交实时地图组件（bus-map）
 *
 * 数据流（6 层数据流合规）：MqttHub 快照 → eventBus → useWidgetData → liveProps →
 * {...defaultConfig} {...liveProps} {...options} spread 注入本组件。
 *
 * 地图：高德 JS API 2.0（暗色样式，GCJ-02）。
 * 线路：AMap.Driving 途经点规划真实道路路径（localStorage 缓存 + 直线降级）。
 * 车辆：HTML 圆点 Marker，行驶中沿真实道路路径弧长插值，停靠中脉冲。
 * 无位置字段 → 位置以站点名为粒度，车辆运动由 current/next 站之间的状态机驱动。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataSourceConfig } from '@hugescreen/shared';
import type { BusLine, BusPosition } from '@hugescreen/data';
import { loadAmap } from './busMap/loadAmap';
import { loadStations } from './busMap/geo';
import { lineColor } from './busMap/colors';
import { DEMO_LINES, demoBuses, demoProgress } from './busMap/demo';
import { getLinePath, type LinePath } from './busMap/route';
import { easeInOut, pathPos, lerpPos } from './busMap/animate';

/**
 * 站间行驶时长完全数据驱动：
 * - 车辆出发（收到出发消息）时记录本地时刻 departTs
 * - 数据源确认到站（current_station 变化或状态变停靠中）时，用真实耗时回填该段用时（按线路+段缓存，自学习）
 * - 学习值持久化到 localStorage：刷新页面后立即可用（否则每段第一趟永远用默认值 → 到站对齐跳变）
 * - 未学习段用「全局已学段用时中位数」自适应数据源节奏（模拟器 ~2-5s/段，真实公交可能 30-90s）
 * - 行驶中插值 t = (now - departTs) / 段用时 —— 与数据源真实节奏一致
 */
const DEFAULT_SEG_MS = 10000; // 无任何学习历史时的兜底段用时
const SEGDUR_KEY = 'bm-segdur';

interface BusMapWidgetProps {
  // 数据（liveProps 注入）
  lines?: BusLine[];
  buses?: Record<string, BusPosition>;
  online?: boolean;
  connected?: boolean;
  updatedAt?: number;
  // 选项
  showLegend?: boolean;
  showStats?: boolean;
  showStatusBanner?: boolean;
  showStationLabels?: boolean;
  showBusLabels?: boolean;
  busRadius?: number;
  lineVisibility?: Record<string, boolean>;
  lineColors?: Record<string, string>;
  minZoom?: number;
  maxZoom?: number;
  // 标准 props
  interactive?: boolean;
  dataSource?: DataSourceConfig;
  widgetId?: string;
  onUpdate?: (patch: Record<string, unknown>) => void;
  compact?: boolean;
}

/** 车辆动画状态机（存在 ref，不触发 React） */
interface BusAnim {
  key: string;
  lineId: number;
  cur: string;
  next: string;
  curIdx: number;   // line.stations 下标
  nextIdx: number;
  phase: 'moving' | 'dwell';
  /** 段内进度 0..1（由绝对时间与段用时推导，数据驱动） */
  t: number;
  /** 本段出发时刻（收到出发消息的本地时间，epoch ms） */
  departTs: number;
  color: string;
}

export function BusMapWidget({
  lines, buses, online = true, connected = true, updatedAt,
  showLegend = true, showStats = true, showStatusBanner = true,
  showStationLabels = false, showBusLabels = false,
  busRadius = 6,
  lineVisibility, lineColors, minZoom = 10, maxZoom = 18,
  interactive = false, dataSource, widgetId,
  onUpdate,
}: BusMapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [amapReady, setAmapReady] = useState(false);
  const [amapError, setAmapError] = useState<string | null>(null);
  const [stations, setStations] = useState<Map<string, [number, number]> | null>(null);

  // ── refs（rAF 循环用，避免闭包过期）──
  const optsRef = useRef({ busRadius, showBusLabels });
  optsRef.current = { busRadius, showBusLabels };
  const stationsRef = useRef<Map<string, [number, number]> | null>(null);
  stationsRef.current = stations;
  const linePathsRef = useRef(new Map<number, LinePath>());
  const routePromisesRef = useRef(new Map<number, Promise<LinePath>>());
  const busAnimsRef = useRef(new Map<string, BusAnim>());
  const busMarkersRef = useRef(new Map<string, any>());
  const busDotsRef = useRef(new Map<string, HTMLElement>());
  const warnedStationsRef = useRef(new Set<string>());
  const hasFitRef = useRef(false);
  const isDemoRef = useRef(false);
  /** 段用时自学习缓存：`${lineId}:${fromIdx}:${toIdx}` → 实际行驶毫秒（数据源到站确认时回填） */
  const segDurRef = useRef<Map<string, number>>(loadSegDurs());
  /** 全局段用时中位数（未学习段的自适应默认） */
  const medianDurRef = useRef<number | null>(computeMedian(segDurRef.current));
  /** 到站对齐的平滑滑入动画（避免节奏估计偏差造成瞬移跳变） */
  const snapRef = useRef(new Map<string, { from: [number, number]; to: [number, number]; t0: number; dur: number }>());

  // ── 数据源：实时线路 vs 演示数据 ──
  const liveHasLines = !!lines && lines.length > 0;
  const isDemo = !liveHasLines && (!dataSource || dataSource.type === 'static');
  isDemoRef.current = isDemo;
  const activeLines = useMemo<BusLine[]>(
    () => (liveHasLines ? (lines as BusLine[]) : isDemo ? DEMO_LINES : []),
    [liveHasLines, lines, isDemo],
  );
  const linesSig = activeLines.map((l) => `${l.id}:${l.stations.join('>')}`).join('|');
  const visSig = JSON.stringify(lineVisibility ?? {});

  const warnOnce = (name: string) => {
    if (!warnedStationsRef.current.has(name)) {
      warnedStationsRef.current.add(name);
      console.warn('[busMap] unknown station:', name);
    }
  };

  // ═══ Effect 1：地图初始化（一次）═══
  useEffect(() => {
    let disposed = false;
    let map: any = null;
    loadAmap().then((AMap) => {
      if (disposed || !containerRef.current) return;
      const M = AMap as any;
      map = new M.Map(containerRef.current, {
        zoom: 13,
        center: [119.45, 32.2], // 镇江
        mapStyle: 'amap://styles/dark',
        features: ['bg', 'road', 'building'],
        zooms: [minZoom, maxZoom],
      });
      mapRef.current = map;
      setAmapReady(true);
      const ro = new ResizeObserver(() => { try { map?.resize(); } catch { /* noop */ } });
      ro.observe(containerRef.current);
      roRef.current = ro;
    }).catch((err: unknown) => {
      if (!disposed) setAmapError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      disposed = true;
      roRef.current?.disconnect();
      if (map) { try { map.destroy(); } catch { /* noop */ } }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══ Effect 1b：交互开关（编辑模式禁用，避免与 dnd-kit 冲突）═══
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStatus({
      dragEnable: !!interactive,
      scrollWheel: !!interactive,
      zoomEnable: !!interactive,
      doubleClickZoom: !!interactive,
      keyboardEnable: !!interactive,
    });
  }, [interactive, amapReady]);

  // ═══ 站点表加载 ═══
  useEffect(() => {
    loadStations().then(setStations);
  }, []);

  // ═══ Effect 2：线路 / 站点静态几何（内容签名不变不重跑）═══
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !stations || activeLines.length === 0) return;
    const M = (window as any).AMap;
    if (!M) return;

    let disposed = false;
    const allLayers: any[] = [];

    // 站点标记（被引用站点去重；位置 = 站点坐标）
    const stationMarkers = new Map<string, any>();
    for (const line of activeLines) {
      if (lineVisibility && lineVisibility[String(line.id)] === false) continue;
      for (const s of line.stations) {
        const c = stations.get(s);
        if (!c || stationMarkers.has(s)) continue;
        const cm = new M.CircleMarker(c, {
          radius: 4,
          strokeColor: '#E8E8EC', strokeWeight: 1,
          fillColor: '#9E9EA8', fillOpacity: 0.9,
        });
        cm.setMap(map);
        stationMarkers.set(s, cm);
        allLayers.push(cm);
        if (showStationLabels) {
          const t = new M.Text({
            text: s, position: c,
            style: {
              'font-size': '11px', color: '#9E9EA8',
              background: 'rgba(20,24,32,0.75)', border: 'none', padding: '1px 4px',
            },
            offset: new M.Pixel(0, 14),
          });
          t.setMap(map);
          allLayers.push(t);
        }
      }
    }

    const drawPolyline = (path: LinePath, color: string) => {
      if (disposed || !map) return;
      if (!path.coords || path.coords.length < 2) return;
      const poly = new M.Polyline({
        path: path.coords,
        strokeColor: color, strokeWeight: 4, strokeOpacity: 0.85,
      });
      poly.setMap(map);
      allLayers.push(poly);
    };

    // 每线路路径：缓存 → Driving 规划（完成后追加真实路径）→ 直线降级
    activeLines.forEach((line, i) => {
      if (lineVisibility && lineVisibility[String(line.id)] === false) return;
      const color = lineColor(i, lineColors, line.id);
      const existing = linePathsRef.current.get(line.id);
      if (existing && existing.coords.length >= 2) {
        drawPolyline(existing, color);
      } else if (!routePromisesRef.current.has(line.id)) {
        const p = getLinePath(line, stations)
          .then((path) => {
            linePathsRef.current.set(line.id, path);
            if (!disposed) {
              drawPolyline(path, color);
              // ★ 路径就绪：该线行驶中车辆从当前站重新出发（t=0），
              //   避免从“停在站上等待”的位置直接跳到路径中段造成闪回
              const nowTs = Date.now();
              for (const anim of busAnimsRef.current.values()) {
                if (anim.lineId === line.id && anim.phase === 'moving') {
                  anim.t = 0;
                  anim.departTs = nowTs;
                }
              }
              if (!hasFitRef.current && allLayers.length > 0) {
                map.setFitView(allLayers, false, [60, 60]);
                hasFitRef.current = true;
              }
            }
            return path;
          })
          .catch((err) => {
            console.warn('[busMap] route error:', line.id, err);
            return { coords: [], stopIndexes: [] } as LinePath;
          });
        routePromisesRef.current.set(line.id, p);
      }
    });

    // 首次 fitView（用已就绪的站点/线路）
    if (!hasFitRef.current && allLayers.length > 0) {
      map.setFitView(allLayers, false, [60, 60]);
      hasFitRef.current = true;
    }

    return () => {
      disposed = true;
      for (const l of allLayers) { try { l.setMap(null); } catch { /* noop */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amapReady, stations, linesSig, visSig, showStationLabels, lineColors]);

  // ═══ Effect 3a：车辆快照 → 动画状态机 + Marker 增删 ═══
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const M = (window as any).AMap;
    if (!M) return;

    // 演示模式：固定车辆集合，位置由 rAF 每帧从 demoBuses 直接映射
    if (isDemo) {
      for (const line of DEMO_LINES) {
        line.buses.forEach((b, bi) => {
          const key = `${line.id}/${b}`;
          if (busMarkersRef.current.has(key)) return;
          const color = lineColor(DEMO_LINES.indexOf(line), lineColors, line.id);
          const { m, dot } = createBusMarker(M, map, key, color, busRadius, showBusLabels ? `${line.name} ${b}` : key);
          busMarkersRef.current.set(key, m);
          busDotsRef.current.set(key, dot);
        });
      }
      return;
    }

    // 实时模式：快照 diff → 状态机
    const snapshot = buses ?? {};
    const snapshotKeys = new Set(Object.keys(snapshot));

    for (const [key, pos] of Object.entries(snapshot)) {
      const line = activeLines.find((l) => l.id === pos.line_id);
      if (!line) continue;
      const curIdx = line.stations.indexOf(pos.current_station);
      const nextIdx = line.stations.indexOf(pos.next_station);
      if (curIdx < 0) warnOnce(pos.current_station);
      if (nextIdx < 0) warnOnce(pos.next_station);

      const anim = busAnimsRef.current.get(key);
      if (!anim) {
        // 新车辆：立即对齐到数据确认的当前站（retained 重放时尤其重要，避免从 (0,0) 起跳）
        const color = lineColor(activeLines.indexOf(line), lineColors, line.id);
        const { m, dot } = createBusMarker(M, map, key, color, busRadius, showBusLabels ? `${line.name} ${pos.bus}` : key);
        const c0 = stationsRef.current?.get(pos.current_station);
        if (m && c0) m.setPosition(c0);
        busMarkersRef.current.set(key, m);
        busDotsRef.current.set(key, dot);
        busAnimsRef.current.set(key, {
          key, lineId: line.id,
          cur: pos.current_station, next: pos.next_station,
          curIdx, nextIdx, // 站不在线路时保持 -1（rAF 有 >=0 检查走直线兜底）
          phase: pos.status === '停靠中' ? 'dwell' : 'moving',
          t: pos.status === '停靠中' ? 1 : 0,
          departTs: pos.status === '停靠中' ? 0 : Date.now(), // 出发时刻 = 收到消息的本地时间
          color,
        });
      } else {
        // 已有车辆：站段变化检测（数据源确认到站/换段）
        const snapToStation = (m: any, name: string, key: string) => {
          // ★ 数据源已确认车辆位置 → 画面对齐该站坐标。
          //   滑入时长按距离自适应：近处 200ms 平滑，远处（模拟器跳站/掉头）可见滑行而非闪现
          const c = stationsRef.current?.get(name);
          if (!m || !c) return;
          let from: [number, number];
          try {
            const pos = m.getPosition();
            from = [pos.lng, pos.lat];
          } catch {
            from = c;
          }
          if (Math.abs(from[0] - c[0]) < 1e-7 && Math.abs(from[1] - c[1]) < 1e-7) return; // 已在站
          const distM = Math.hypot(from[0] - c[0], from[1] - c[1]) * 111320 * 0.847;
          const durMs = Math.min(1500, Math.max(200, distM / 2.5)); // ~2.5km → 1s，≤200m → 0.2s
          snapRef.current.set(key, { from, to: c, t0: performance.now(), dur: durMs });
        };
        if (anim.cur !== pos.current_station || anim.next !== pos.next_station) {
          // 到站学习：本段真实用时回填缓存（仅限此前确实在行驶中）
          learnSegment(anim, Date.now());
          anim.cur = pos.current_station;
          anim.next = pos.next_station;
          anim.curIdx = curIdx;
          anim.nextIdx = nextIdx;
          anim.phase = pos.status === '停靠中' ? 'dwell' : 'moving';
          anim.t = pos.status === '停靠中' ? 1 : 0;
          anim.departTs = pos.status === '停靠中' ? 0 : Date.now();
          snapToStation(busMarkersRef.current.get(key), pos.current_station, key);
        } else if (pos.status === '停靠中' && anim.phase === 'moving') {
          anim.phase = 'dwell'; // 到站（状态确认）
          anim.t = 1;
          learnSegment(anim, Date.now());
          anim.departTs = 0;
          snapToStation(busMarkersRef.current.get(key), pos.current_station, key);
        } else if (pos.status === '行驶中' && anim.phase === 'dwell') {
          anim.phase = 'moving'; // 出发
          anim.t = 0;
          anim.departTs = Date.now();
        }
        const dot = busDotsRef.current.get(key);
        if (dot) dot.className = anim.phase === 'dwell' ? 'bm-dot bm-dwell' : 'bm-dot';
      }
    }

    // 移除已消失的车辆
    for (const [key, m] of busMarkersRef.current) {
      if (!snapshotKeys.has(key)) {
        try { m.setMap(null); } catch { /* noop */ }
        busMarkersRef.current.delete(key);
        busDotsRef.current.delete(key);
        busAnimsRef.current.delete(key);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amapReady, buses, isDemo, activeLines, busRadius, showBusLabels, lineColors]);

  /** 到站学习：用真实耗时回填该段用时缓存（阈值 1.5s~10min 过滤异常值）+ 持久化 + 更新中位数 */
  const learnSegment = (anim: BusAnim, now: number) => {
    if (anim.departTs <= 0) return;
    const dur = now - anim.departTs;
    if (dur > 1500 && dur < 10 * 60 * 1000) {
      const segKey = `${anim.lineId}:${anim.curIdx}:${anim.nextIdx}`;
      segDurRef.current.set(segKey, dur);
      medianDurRef.current = computeMedian(segDurRef.current);
      try { localStorage.setItem(SEGDUR_KEY, JSON.stringify([...segDurRef.current.entries()])); } catch { /* 忽略 */ }
      console.log(`[busMap] segment learned ${segKey} = ${(dur / 1000).toFixed(1)}s (median=${((medianDurRef.current ?? 0) / 1000).toFixed(1)}s)`);
    }
  };

  // ═══ Effect 3b：rAF 动画循环（一次启动，无条件运行）═══
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const map = mapRef.current;

      if (map && stationsRef.current) {
        if (isDemoRef.current) {
          // 演示：每帧从 demoBuses 直接映射（含到站/离站 frac）
          const nowMs = Date.now();
          const demo = demoBuses(nowMs);
          for (const [key, pos] of Object.entries(demo)) {
            const m = busMarkersRef.current.get(key);
            if (!m) continue;
            const curC = stationsRef.current.get(pos.current_station);
            const nextC = stationsRef.current.get(pos.next_station);
            if (curC && nextC) {
              m.setPosition(lerpPos(curC, nextC, demoProgress(key, nowMs)));
            }
            const dot = busDotsRef.current.get(key);
            if (dot) dot.className = pos.status === '停靠中' ? 'bm-dot bm-dwell' : 'bm-dot';
          }
        } else {
          // 实时：段进度 t 由绝对时间推导（数据驱动节奏）+ 沿真实道路路径插值
          const now = Date.now();
          // 到站平滑滑入（时长按距离自适应，终点 = 数据权威位置）
          for (const [key, s] of snapRef.current) {
            const m = busMarkersRef.current.get(key);
            if (!m) { snapRef.current.delete(key); continue; }
            const st = (performance.now() - s.t0) / (s.dur || 200);
            if (st >= 1) { snapRef.current.delete(key); continue; }
            m.setPosition(lerpPos(s.from, s.to, easeInOut(Math.min(1, st))));
          }
          for (const anim of busAnimsRef.current.values()) {
            const m = busMarkersRef.current.get(anim.key);
            if (!m) continue;
            const curC = stationsRef.current.get(anim.cur);
            const nextC = stationsRef.current.get(anim.next);
            if (anim.phase === 'moving' && curC && nextC) {
              // t = 已行驶时间 / 段用时（自学习缓存 → 全局中位数 → 默认值）—— 永远按数据源真实节奏
              const segKey = `${anim.lineId}:${anim.curIdx}:${anim.nextIdx}`;
              const dur = segDurRef.current.get(segKey) ?? (medianDurRef.current ?? DEFAULT_SEG_MS);
              const t = Math.min(1, Math.max(0, (now - anim.departTs) / dur));
              anim.t = t;
              const eased = easeInOut(t);
              const path = linePathsRef.current.get(anim.lineId);
              let pos: [number, number] | null = null;
              if (path && path.coords.length >= 2 && anim.curIdx >= 0 && anim.nextIdx >= 0) {
                pos = pathPos(path.coords, path.stopIndexes, anim.curIdx, anim.nextIdx, eased);
              }
              // ★ 路径未就绪（逐段规划进行中）时停在当前站等待，不沿直线飘（直线会偏离道路 → “乱飘”）
              m.setPosition(pos ?? curC);
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── 叠加层数据 ──
  const busList = Object.values(buses ?? {});
  const moving = busList.filter((b) => b.status === '行驶中').length;
  const stopped = busList.filter((b) => b.status === '停靠中').length;
  const updatedStr = updatedAt ? new Date(updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '—';

  const bannerText = amapError ?? (connected === false ? '连接中断，正在重连…' : '数据源离线');
  const showBanner = showStatusBanner && (!!amapError || connected === false || (connected && online === false));

  const containerId = `busmap-${widgetId ?? 'root'}`;

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: '#14161f' }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* 状态横幅 */}
      {showBanner && (
        <div
          className="absolute top-0 left-0 right-0 z-[1000] text-center text-[12px] py-1"
          style={{ background: 'rgba(255,31,31,0.72)', color: '#fff', letterSpacing: 1 }}
        >
          {bannerText}
        </div>
      )}

      {/* 线路图例 */}
      {showLegend && activeLines.length > 0 && (
        <div
          className="absolute top-2 left-2 z-[1000] space-y-1 rounded"
          style={{ background: 'rgba(20,24,32,0.78)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 8px', maxWidth: 220 }}
        >
          {activeLines.map((l, i) => {
            const hidden = lineVisibility?.[String(l.id)] === false;
            const color = lineColor(i, lineColors, l.id);
            return (
              <button
                key={l.id}
                onClick={() => onUpdate?.({ lineVisibility: { ...(lineVisibility ?? {}), [String(l.id)]: !hidden } })}
                className="flex items-center gap-1.5 w-full text-left text-[11px] transition-opacity"
                style={{ opacity: hidden ? 0.35 : 1, color: '#E8E8EC' }}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                <span className="font-medium whitespace-nowrap">{l.name}</span>
                <span className="text-[10px] truncate" style={{ color: '#9E9EA8' }}>{l.direction}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 车辆状态统计 */}
      {showStats && (
        <div
          className="absolute bottom-2 left-2 z-[1000] text-[11px] leading-5"
          style={{ pointerEvents: 'none', color: '#9E9EA8', background: 'rgba(20,24,32,0.78)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 9px' }}
        >
          <div>
            <span style={{ color: '#E8E8EC' }}>在线车辆 {busList.length}</span>
            <span className="ml-2" style={{ color: '#FFD34D' }}>行驶 {moving}</span>
            <span className="ml-2" style={{ color: '#FF8C42' }}>停靠 {stopped}</span>
          </div>
          <div>连接：{connected ? (online ? '正常' : '数据源离线') : '中断'} · 更新 {updatedStr}</div>
        </div>
      )}

      {/* 演示数据角标 */}
      {isDemo && (
        <div
          className="absolute top-2 right-2 z-[1000] text-[10px] px-2 py-0.5 rounded"
          style={{ color: '#00D4FF', border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.08)' }}
        >
          演示数据
        </div>
      )}

      <style>{`
        #${containerId} .amap-container { background: #14161f; }
        #${containerId} .amap-zoom { filter: invert(1) hue-rotate(180deg); }
        #${containerId} .bm-dot { transition: none; }
        #${containerId} .bm-dwell { animation: bmPulse-${containerId} 1.2s ease-in-out infinite; }
        @keyframes bmPulse-${containerId} {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.45); }
        }
      `}</style>
    </div>
  );
}

/** 创建车辆 Marker（HTML 圆点，anchor center；返回 marker + dot DOM） */
function createBusMarker(
  M: any, map: any, key: string, color: string,
  radius: number, title: string,
): { m: any; dot: HTMLElement } {
  const dot = document.createElement('div');
  dot.className = 'bm-dot';
  dot.style.cssText =
    `width:${radius * 2}px;height:${radius * 2}px;background:${color};` +
    `border-radius:50%;box-shadow:0 0 ${radius}px ${color};`;
  const m = new M.Marker({
    position: [0, 0],
    content: dot,
    anchor: 'center',
    title,
    zIndex: 120,
  });
  m.setMap(map);
  return { m, dot };
}

/** 从 localStorage 读取段用时学习缓存 */
function loadSegDurs(): Map<string, number> {
  try {
    const raw = localStorage.getItem(SEGDUR_KEY);
    if (raw) return new Map(JSON.parse(raw) as [string, number][]);
  } catch { /* 忽略 */ }
  return new Map();
}

/** 计算段用时中位数（未学习段的自适应默认） */
function computeMedian(m: Map<string, number>): number | null {
  const vals = [...m.values()].sort((a, b) => a - b);
  if (vals.length === 0) return null;
  return vals[Math.floor(vals.length / 2)];
}
