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
const DEFAULT_SEG_MS = 5000; // 无任何学习历史时的兜底段用时（测试数据源节奏 ~2-5s/段）
const SEGDUR_KEY = 'bm-segdur';
/** 到站追赶时长：数据确认到站但动画未到时，0.4s 内沿轨道冲到站（绝不瞬移） */
const CATCHUP_SECONDS = 0.4;

/** 解析 "YYYY-MM-DD HH:mm:ss"（东八区北京时间）→ epoch ms */
function parseBJTime(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5], +m[6]);
}

interface BusMapWidgetProps {
  // 数据（liveProps 注入）
  lines?: BusLine[];
  buses?: Record<string, BusPosition>;
  online?: boolean;
  /** 是否已收到过 bus/status（false = 连接成功但状态未到达，不误报离线） */
  onlineKnown?: boolean;
  connected?: boolean;
  updatedAt?: number;
  // 选项
  showLegend?: boolean;
  showStats?: boolean;
  showStatusBanner?: boolean;
  showStationLabels?: boolean;
  showBusLabels?: boolean;
  /** 数据调试面板：车辆状态/动画/站名匹配（测试数据接收与车辆运行情况） */
  showDebugPanel?: boolean;
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
  /** 段内进度 0..1（由数据源消息时间戳锚定 + 消息间线性外推） */
  t: number;
  /** 本段出发时刻（数据源消息时间戳解析，东八区 epoch ms） */
  departTs: number;
  /** 最近一条同段消息：本地接收时刻 + 该消息锚定的 t（rAF 消息间线性外推） */
  lastMsgAt: number;
  lastMsgT: number;
  /** 到站追赶：数据确认到站但动画未到时置 true，rAF 沿轨道快速冲到站后应用 pending */
  catchUp: boolean;
  /** 追赶完成后应用的数据状态（含数据源时间戳） */
  pending: {
    cur: string; next: string;
    curIdx: number; nextIdx: number;
    status: '行驶中' | '停靠中';
    ts: number;
  } | null;
  color: string;
}

export function BusMapWidget({
  lines, buses, online = true, onlineKnown = true, connected = true, updatedAt,
  showLegend = true, showStats = true, showStatusBanner = true,
  showStationLabels = false, showBusLabels = false,
  showDebugPanel = false,
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
  const routePromisesRef = useRef(new Map<number, Promise<LinePath | null>>());
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
      // 每段一条 Polyline（失败段不在 segments 中 → 无直线）
      for (const seg of path.segments) {
        if (!seg || seg.length < 2) continue;
        const poly = new M.Polyline({
          path: seg,
          strokeColor: color, strokeWeight: 4, strokeOpacity: 0.85,
        });
        poly.setMap(map);
        allLayers.push(poly);
      }
    };

    // 每线路路径：静态路径表（每段一条 Polyline；未收录线路不画，车辆停站）
    activeLines.forEach((line, i) => {
      if (lineVisibility && lineVisibility[String(line.id)] === false) return;
      const color = lineColor(i, lineColors, line.id);
      const existing = linePathsRef.current.get(line.id);
      if (existing && existing.coords.length >= 2) {
        drawPolyline(existing, color);
      } else if (!routePromisesRef.current.has(line.id)) {
        const p = getLinePath(line)
          .then((path) => {
            if (path) {
              linePathsRef.current.set(line.id, path);
              if (!disposed) {
                drawPolyline(path, color);
                // 路径就绪：该线行驶中车辆从当前站重新出发（t=0）
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
            }
            return path;
          })
          .catch((err) => {
            console.warn('[busMap] route error:', line.id, err);
            return null;
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
      const msgTs = parseBJTime(pos.timestamp);

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
          departTs: pos.status === '停靠中' ? 0 : (Number.isFinite(msgTs) ? msgTs : Date.now()),
          lastMsgAt: Date.now(),
          lastMsgT: 0,
          catchUp: false,
          pending: null,
          color,
        });
        console.log(`[busMap] ${key} 车辆上线 ${pos.status} ${pos.current_station}→${pos.next_station} 剩${pos.remaining_stops}站 ts=${pos.timestamp}`);
      } else {
        // 已有车辆：站段变化检测（数据源确认到站/换段）
        if (anim.catchUp) {
          // 追赶中：pending 覆盖为最新消息（追赶完成后应用）
          anim.pending = {
            cur: pos.current_station, next: pos.next_station,
            curIdx, nextIdx, status: pos.status,
            ts: Number.isFinite(msgTs) ? msgTs : Date.now(),
          };
        } else if (anim.cur !== pos.current_station || anim.next !== pos.next_station) {
          // ★ 到站/换段：数据已确认 → 标记追赶（不瞬移、不改状态）。
          //   rAF 沿旧段轨道 0.4s 内把 t 冲到 1（位置 = 旧 next = 新 cur 站），
          //   追赶完成后应用 pending 并更新状态 —— 任何时刻位置连续，绝不闪现
          anim.catchUp = true;
          anim.pending = {
            cur: pos.current_station, next: pos.next_station,
            curIdx, nextIdx, status: pos.status,
            ts: Number.isFinite(msgTs) ? msgTs : Date.now(),
          };
        } else if (pos.status === '停靠中' && anim.phase === 'moving') {
          // 停靠确认：追赶至站后转 dwell
          anim.catchUp = true;
          anim.pending = {
            cur: pos.current_station, next: pos.next_station,
            curIdx, nextIdx, status: '停靠中',
            ts: Number.isFinite(msgTs) ? msgTs : Date.now(),
          };
        } else if (pos.status === '行驶中' && anim.phase === 'dwell') {
          // 出发：从当前站开始（数据源时间戳锚定出发时刻）
          anim.phase = 'moving';
          anim.t = 0;
          anim.departTs = Number.isFinite(msgTs) ? msgTs : Date.now();
          anim.lastMsgAt = Date.now();
          anim.lastMsgT = 0;
          console.log(`[busMap] ${key} 出发 ${pos.current_station}→${pos.next_station} ts=${pos.timestamp}`);
        } else if (anim.phase === 'moving') {
          // 同段行驶中消息：用数据源时间戳锚定 t（消除接收延迟误差）
          if (Number.isFinite(msgTs) && anim.departTs > 0) {
            const segKey = `${anim.lineId}:${anim.curIdx}:${anim.nextIdx}`;
            const dur = segDurRef.current.get(segKey) ?? (medianDurRef.current ?? DEFAULT_SEG_MS);
            const t = (msgTs - anim.departTs) / dur;
            if (t >= 0) {
              anim.t = Math.min(1, t);
              anim.lastMsgT = anim.t;
              anim.lastMsgAt = Date.now();
            }
          }
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

  /** 到站学习：用数据源时间戳差值回填该段用时缓存（无接收延迟误差）+ 持久化 + 更新中位数 */
  const learnSegment = (anim: BusAnim, nowTs: number) => {
    if (anim.departTs <= 0) return;
    const dur = nowTs - anim.departTs;
    if (dur > 1500 && dur < 10 * 60 * 1000) {
      const segKey = `${anim.lineId}:${anim.curIdx}:${anim.nextIdx}`;
      segDurRef.current.set(segKey, dur);
      medianDurRef.current = computeMedian(segDurRef.current);
      try { localStorage.setItem(SEGDUR_KEY, JSON.stringify([...segDurRef.current.entries()])); } catch { /* 忽略 */ }
      console.log(`[busMap] segment learned ${segKey} = ${(dur / 1000).toFixed(1)}s (median=${((medianDurRef.current ?? 0) / 1000).toFixed(1)}s)`);
    }
  };

  /** 追赶完成：应用 pending 数据状态。位置已在旧段终点（= 新 cur 站），零跳变 */
  const finishCatchUp = (anim: BusAnim) => {
    const p = anim.pending;
    if (!p) { anim.catchUp = false; return; }
    learnSegment(anim, p.ts);
    const prevCur = anim.cur;
    const prevNext = anim.next;
    const prevCurIdx = anim.curIdx;
    const prevNextIdx = anim.nextIdx;
    anim.cur = p.cur;
    anim.next = p.next;
    anim.curIdx = p.curIdx;
    anim.nextIdx = p.nextIdx;
    anim.phase = p.status === '停靠中' ? 'dwell' : 'moving';
    anim.t = p.status === '停靠中' ? 1 : 0;
    anim.departTs = p.status === '停靠中' ? 0 : p.ts;
    anim.lastMsgAt = Date.now();
    anim.lastMsgT = anim.t;
    anim.catchUp = false;
    // 极端跳站兜底：pending.cur 与当前位置距离过大（数据源跳站）→ 平滑滑入而非瞬移
    const m = busMarkersRef.current.get(anim.key);
    if (m) {
      const c = stationsRef.current?.get(p.cur);
      if (c) {
        let from: [number, number];
        try { const pos = m.getPosition(); from = [pos.lng, pos.lat]; } catch { from = c; }
        const distM = Math.hypot(from[0] - c[0], from[1] - c[1]) * 111320 * 0.847;
        if (distM > 200) {
          const durMs = Math.min(1500, Math.max(300, distM / 2.5));
          snapRef.current.set(anim.key, { from, to: c, t0: performance.now(), dur: durMs });
        }
      }
    }
    const dot = busDotsRef.current.get(anim.key);
    if (dot) dot.className = anim.phase === 'dwell' ? 'bm-dot bm-dwell' : 'bm-dot';
    // 事件日志：到站 + 掉头/跳站识别
    const turning = prevCurIdx >= 0 && prevNextIdx >= 0 && p.curIdx >= 0 && p.nextIdx >= 0
      && ((prevCurIdx < prevNextIdx) !== (p.curIdx < p.nextIdx));
    const jump = prevNext !== prevCur && p.cur !== prevNext;
    console.log(
      `[busMap] ${anim.key} 到站 ${prevCur}→${p.cur}` +
      (jump ? ` ★跳站(应到${prevNext})` : '') +
      (turning ? ' ★掉头' : '') +
      ` ${p.status} 下一站${p.next}`,
    );
  };

  // ═══ Effect 3b：rAF 动画循环（一次启动，无条件运行）═══
  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const tick = () => {
      const nowMs = performance.now();
      const dt = Math.min(0.1, (nowMs - lastT) / 1000); // 帧间隔（clamp 防跳帧）
      lastT = nowMs;
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
          // 实时：数据源时间戳锚定 + 消息间线性外推 + 到站追赶（沿轨道，绝不瞬移）
          const now = Date.now();
          // 极端跳站滑入（finishCatchUp 中距离 >200m 时触发，常规到站不走这里）
          for (const [key, s] of snapRef.current) {
            const m = busMarkersRef.current.get(key);
            if (!m) { snapRef.current.delete(key); continue; }
            const st = (performance.now() - s.t0) / (s.dur || 300);
            if (st >= 1) { snapRef.current.delete(key); continue; }
            m.setPosition(lerpPos(s.from, s.to, easeInOut(Math.min(1, st))));
          }
          for (const anim of busAnimsRef.current.values()) {
            const m = busMarkersRef.current.get(anim.key);
            if (!m) continue;
            const curC = stationsRef.current.get(anim.cur);
            const nextC = stationsRef.current.get(anim.next);
            if (anim.catchUp) {
              // ★ 到站追赶：0.4s 内沿旧段轨道把 t 冲到 1（高速沿轨道移动，不闪现）
              anim.t += dt / CATCHUP_SECONDS;
              if (anim.t >= 1) {
                anim.t = 1;
                finishCatchUp(anim);
              }
            } else if (anim.phase === 'moving' && curC && nextC && anim.departTs > 0) {
              // 消息间线性外推：以上一条消息锚定的 t 为基准，按段用时推进
              const segKey = `${anim.lineId}:${anim.curIdx}:${anim.nextIdx}`;
              const dur = segDurRef.current.get(segKey) ?? (medianDurRef.current ?? DEFAULT_SEG_MS);
              anim.t = Math.min(1, anim.lastMsgT + (now - anim.lastMsgAt) / dur);
            }
            if (anim.phase === 'moving' && curC && nextC) {
              const eased = easeInOut(anim.t);
              const path = linePathsRef.current.get(anim.lineId);
              let pos: [number, number] | null = null;
              if (path && path.coords.length >= 2 && anim.curIdx >= 0 && anim.nextIdx >= 0) {
                pos = pathPos(path.coords, path.stopIndexes, anim.curIdx, anim.nextIdx, eased);
              }
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

  // 横幅三态：断线 → 中断；已收到状态且离线 → 数据源离线；连接中但状态未到达 → 不显示（避免误报）
  const bannerText = amapError ?? (connected === false ? '连接中断，正在重连…' : '数据源离线');
  const showBanner = showStatusBanner && (
    !!amapError || connected === false || (connected && onlineKnown && online === false)
  );

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
          <div>连接：{connected ? (onlineKnown ? (online ? '正常' : '数据源离线') : '连接中…') : '中断'} · 更新 {updatedStr}</div>
        </div>
      )}

      {/* 数据调试面板：车辆状态 + 动画 + 站名匹配（测试数据接收/处理） */}
      {showDebugPanel && (
        <div
          className="absolute right-2 top-2 z-[1000] text-[10px] leading-4 font-mono"
          style={{ color: '#9E9EA8', background: 'rgba(20,24,32,0.88)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', maxWidth: 340, maxHeight: '70%', overflowY: 'auto' }}
        >
          <div style={{ color: '#E8E8EC', marginBottom: 2 }}>
            连接:{connected ? (onlineKnown ? (online ? '正常' : '数据源离线') : '连接中…') : '中断'} · 车辆 {busList.length} · 线路 {activeLines.length}
          </div>
          {Object.entries(buses ?? {}).sort().map(([key, p]) => {
            const a = busAnimsRef.current.get(key);
            const curKnown = !!stationsRef.current?.get(p.current_station);
            const nextKnown = !!stationsRef.current?.get(p.next_station);
            const mark = !curKnown || !nextKnown ? ' ★站名缺' : '';
            return (
              <div key={key} style={{ color: '#9E9EA8' }}>
                <span style={{ color: '#00D4FF' }}>{p.line}</span> {p.bus}
                : {p.current_station}→{p.next_station}
                <span style={{ color: p.status === '行驶中' ? '#FFD34D' : '#FF8C42' }}> [{p.status}]</span>
                剩{p.remaining_stops} · 动:{a?.phase ?? '-'}/{a ? a.t.toFixed(2) : '-'}
                {mark}
              </div>
            );
          })}
          <div style={{ color: '#9E9EA8', marginTop: 2 }}>
            未知站:{warnedStationsRef.current.size > 0 ? [...warnedStationsRef.current].join('、') : '无'} · 更新:{updatedStr}
          </div>
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
