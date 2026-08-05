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

const SEGMENT_MS = 25000; // 每站段行驶时长基准（animationSpeed 缩放）

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
  animationSpeed?: number;
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
  t: number;
  color: string;
}

export function BusMapWidget({
  lines, buses, online = true, connected = true, updatedAt,
  showLegend = true, showStats = true, showStatusBanner = true,
  showStationLabels = false, showBusLabels = false,
  animationSpeed = 1, busRadius = 6,
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
  const optsRef = useRef({ animationSpeed, busRadius, showBusLabels });
  optsRef.current = { animationSpeed, busRadius, showBusLabels };
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
        // 新车辆
        const color = lineColor(activeLines.indexOf(line), lineColors, line.id);
        const { m, dot } = createBusMarker(M, map, key, color, busRadius, showBusLabels ? `${line.name} ${pos.bus}` : key);
        busMarkersRef.current.set(key, m);
        busDotsRef.current.set(key, dot);
        busAnimsRef.current.set(key, {
          key, lineId: line.id,
          cur: pos.current_station, next: pos.next_station,
          curIdx: Math.max(0, curIdx), nextIdx: Math.max(0, nextIdx),
          phase: pos.status === '停靠中' ? 'dwell' : 'moving',
          t: pos.status === '停靠中' ? 1 : 0,
          color,
        });
      } else {
        // 已有车辆：站段变化检测
        if (anim.cur !== pos.current_station || anim.next !== pos.next_station) {
          anim.cur = pos.current_station;
          anim.next = pos.next_station;
          anim.curIdx = Math.max(0, curIdx);
          anim.nextIdx = Math.max(0, nextIdx);
          anim.phase = pos.status === '停靠中' ? 'dwell' : 'moving';
          anim.t = pos.status === '停靠中' ? 1 : 0;
        } else if (pos.status === '停靠中' && anim.phase === 'moving') {
          anim.phase = 'dwell'; // 到站
          anim.t = 1;
        } else if (pos.status === '行驶中' && anim.phase === 'dwell') {
          anim.phase = 'moving'; // 出发
          anim.t = 0;
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

  // ═══ Effect 3b：rAF 动画循环（一次启动，无条件运行）═══
  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const tick = (nowMs: number) => {
      const now = nowMs / 1000;
      const dt = Math.min(0.1, now - lastT); // clamp 防跳帧
      lastT = now;
      const map = mapRef.current;

      if (map && stationsRef.current) {
        if (isDemoRef.current) {
          // 演示：每帧从 demoBuses 直接映射（含到站/离站 frac）
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
          // 实时：状态机推进 + 沿真实道路路径插值
          for (const anim of busAnimsRef.current.values()) {
            const m = busMarkersRef.current.get(anim.key);
            if (!m) continue;
            const curC = stationsRef.current.get(anim.cur);
            const nextC = stationsRef.current.get(anim.next);
            if (anim.phase === 'moving' && curC && nextC) {
              anim.t += dt / (SEGMENT_MS / 1000 / optsRef.current.animationSpeed);
              if (anim.t > 1) anim.t = 1;
              const eased = easeInOut(anim.t);
              const path = linePathsRef.current.get(anim.lineId);
              let pos: [number, number] | null = null;
              if (path && path.coords.length >= 2 && anim.curIdx >= 0 && anim.nextIdx >= 0) {
                pos = pathPos(path.coords, path.stopIndexes, anim.curIdx, anim.nextIdx, eased);
              }
              m.setPosition(pos ?? lerpPos(curC, nextC, eased));
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
