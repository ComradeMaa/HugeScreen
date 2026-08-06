/**
 * 公交实时地图组件（bus-map）
 *
 * 数据流（6 层数据流合规）：MqttHub 快照 → eventBus → useWidgetData → liveProps →
 * {...defaultConfig} {...liveProps} {...options} spread 注入本组件。
 *
 * 地图：高德 JS API 2.0（暗色样式，GCJ-02）。
 * 线路：AMap.Driving 途经点规划真实道路路径（localStorage 缓存 + 直线降级）。
 * 车辆：TbBus 图标 Marker（保持正位底盘在下，仅向西镜像），行驶中沿真实道路路径弧长插值，停靠中脉冲。
 * 无位置字段 → 位置以站点名为粒度，车辆运动由 current/next 站之间的状态机驱动。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TbBus } from 'react-icons/tb';
import { GiBusStop } from 'react-icons/gi';
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
 * - 行驶中插值：段内速率自适应 —— 相邻同段消息算瞬时速率 rate = Δt/Δts（EMA 平滑），
 *   消息间外推 t = lastMsgT + Δ本地时间 × rate，跟随数据源真实节奏，吸收 dur 估计偏差
 * - 到站追赶：指数逼近 t=1（剩余越多速率越快），沿轨道滑入，绝不瞬移/冲刺
 */
const DEFAULT_SEG_MS = 5000; // 无任何学习历史时的兜底段用时（测试数据源节奏 ~2-5s/段）
const SEGDUR_KEY = 'bm-segdur';
/** 到站追赶增益：指数逼近 t=1，时间常数 1/GAIN 秒，剩余越多速率越快（沿轨道滑入，绝不瞬移/冲刺） */
const CATCHUP_GAIN = 4;

/** 解析 "YYYY-MM-DD HH:mm:ss"（东八区北京时间）→ epoch ms */
function parseBJTime(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5], +m[6]);
}

/** TbBus 图标默认朝东：向西行驶时水平镜像（保持正位、底盘在下，不做车头转向）。
 *  车辆图标 transform = scale(zoom系数) [scaleX(-1)]，镜像与 zoom 缩放同层合成 */

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
  /** 是否向西行驶（TbBus 默认朝东：向西镜像，保持正位底盘在下） */
  flipX: boolean;
  /** 同段消息序列（数据源时钟），用于段内速率估计：rate = Δt / Δts */
  msgSeq: { ts: number; t: number }[];
  /** 段内推进速率（t/秒，数据源时钟样本 EMA 平滑）；0 = 无样本，用 1/dur 兜底 */
  rate: number;
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
  /** map 'complete' 事件（投影就绪）—— 在此之前创建 Marker 会 Pixel(NaN,NaN) 崩溃 */
  const [mapComplete, setMapComplete] = useState(false);
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
  /** wrap = 脉冲动画层（bm-dot），rot = 图标旋转层（TbBus 沿行进方向旋转） */
  const busDotsRef = useRef(new Map<string, { wrap: HTMLElement; rot: HTMLElement }>());
  const warnedStationsRef = useRef(new Set<string>());
  const isDemoRef = useRef(false);
  /** 当前 zoom 缩放系数（站点/车辆图标随视野缩放，2^(zoom-13)，clamp [0.6, 2.5]） */
  const zoomScaleRef = useRef(1);
  /** 站点图标元素（zoomchange 时统一更新 transform scale） */
  const stationElsRef = useRef(new Map<string, HTMLElement>());
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

  /** 段行进方向是否向西（站坐标经度差；正位图标朝东，向西镜像） */
  const segmentWest = (cur: string, next: string): boolean => {
    const curC = stationsRef.current?.get(cur);
    const nextC = stationsRef.current?.get(next);
    return !!curC && !!nextC && nextC[0] < curC[0];
  };

  // ═══ Effect 1：地图初始化（一次）═══
  // 注意：Map 构造完成 ≠ 投影就绪 —— 投影就绪前调用 lngLatToContainer 会得到
  // Pixel(NaN, NaN) 抛错（Marker setMap 依赖投影；CircleMarker 则静默失败不渲染）。
  // complete 事件时机不可靠（可能提前触发），改用轮询 getZoom() 有效作为就绪信号。
  useEffect(() => {
    let disposed = false;
    let map: any = null;
    let raf = 0;
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
      // 图标随视野缩放自适应：zoom +1 → 图标 ×2（保持"贴在地面"的物理大小观感），clamp [0.6, 2.5]
      const applyZoomScale = () => {
        let z = 13;
        try { z = map.getZoom(); } catch { /* noop */ }
        const s = Math.min(2.5, Math.max(0.6, Math.pow(2, z - 13)));
        zoomScaleRef.current = s;
        for (const el of stationElsRef.current.values()) {
          el.style.transform = `scale(${s})`;
        }
        // 车辆图标统一更新（rAF 只在 moving 分支更新，停靠中车辆必须在此同步，
        // 否则缩放后移动车新 scale、停靠车旧 scale，图标大小参差）
        for (const els of busDotsRef.current.values()) {
          const flip = els.rot.style.transform.includes('scaleX(-1)');
          els.rot.style.transform = `scale(${s})${flip ? ' scaleX(-1)' : ''}`;
        }
      };
      map.on('zoomchange', applyZoomScale);
      applyZoomScale();
      const t0 = Date.now();
      const pollReady = () => {
        if (disposed) return;
        // 直接探测崩溃路径本身：lngLatToContainer 投影未就绪时返回/抛出 NaN Pixel。
        // （getZoom 在 init 早期就返回配置值 13，不可作为就绪信号）
        let ready = false;
        try {
          const px = map.lngLatToContainer([119.45, 32.2]);
          ready = !!px && Number.isFinite(px.x) && Number.isFinite(px.y);
        } catch { ready = false; }
        if (ready || Date.now() - t0 > 15000) {
          setMapComplete(true); // 投影就绪，放行 overlay 创建
        } else {
          raf = requestAnimationFrame(pollReady);
        }
      };
      pollReady();
      const ro = new ResizeObserver(() => { try { map?.resize(); } catch { /* noop */ } });
      ro.observe(containerRef.current);
      roRef.current = ro;
    }).catch((err: unknown) => {
      if (!disposed) setAmapError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
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
    if (!map || !stations || activeLines.length === 0 || !mapComplete) return;
    const M = (window as any).AMap;
    if (!M) return;

    let disposed = false;
    const allLayers: any[] = [];

    // 站点标记：GiBusStop 图标（被引用站点去重；位置 = 站点坐标），名称标签可选
    const STATION_ICON_SIZE = 18;
    stationElsRef.current = new Map(); // 重跑时重置（旧元素已 setMap(null) 清理）
    const stationMarkers = new Map<string, any>();
    for (const line of activeLines) {
      if (lineVisibility && lineVisibility[String(line.id)] === false) continue;
      for (const s of line.stations) {
        const c = stations.get(s);
        if (!c || stationMarkers.has(s)) continue;
        const el = document.createElement('div');
        el.style.cssText =
          `width:${STATION_ICON_SIZE}px;height:${STATION_ICON_SIZE}px;` +
          'filter:drop-shadow(0 0 2px rgba(0,0,0,0.8));';
        el.innerHTML = renderToStaticMarkup(<GiBusStop size={STATION_ICON_SIZE} color="#9E9EA8" />);
        el.style.transform = `scale(${zoomScaleRef.current})`; // 立即应用当前 zoom 缩放
        stationElsRef.current.set(s, el);
        // 悬停信息：站名 + 途经线路（与车辆 marker 一样用原生 title）
        const viaLines = activeLines
          .filter((l) => l.stations.includes(s))
          .map((l) => l.name)
          .join('、');
        const mk = new M.Marker({
          position: c,
          content: el,
          anchor: 'center',
          zIndex: 90, // 低于车辆图标（120）
          title: viaLines ? `${s}（${viaLines}）` : s,
        });
        mk.setMap(map);
        stationMarkers.set(s, mk);
        allLayers.push(mk);
        if (showStationLabels) {
          const t = new M.Text({
            text: s, position: c,
            style: {
              'font-size': '11px', color: '#9E9EA8',
              background: 'rgba(20,24,32,0.75)', border: 'none', padding: '1px 4px',
            },
            offset: new M.Pixel(0, STATION_ICON_SIZE + 4),
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

    // 不使用 setFitView：高德 2.0 该版本调用后 map 投影损坏，
    // 之后任何 Marker 的 setMap/setPosition 都会 Pixel(NaN,NaN) 崩溃（已手动复现）。
    // 初始视角用地图默认（镇江 center + zoom 13）。

    return () => {
      disposed = true;
      for (const l of allLayers) { try { l.setMap(null); } catch { /* noop */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amapReady, mapComplete, stations, linesSig, visSig, showStationLabels, lineColors]);

  // ═══ Effect 3a：车辆快照 → 动画状态机 + Marker 增删 ═══
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapComplete) return;
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
        const flipX = segmentWest(pos.current_station, pos.next_station);
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
          flipX,
          msgSeq: [],
          rate: 0,
        });
        // 停靠中车辆也要立即应用镜像 + zoom 缩放（rAF 只在 moving 分支更新 transform）
        dot.rot.style.transform = `scale(${zoomScaleRef.current})${flipX ? ' scaleX(-1)' : ''}`;
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
          // 出发：从当前站开始（数据源时间戳锚定出发时刻），新段重置速率样本
          anim.phase = 'moving';
          anim.t = 0;
          anim.departTs = Number.isFinite(msgTs) ? msgTs : Date.now();
          anim.lastMsgAt = Date.now();
          anim.lastMsgT = 0;
          anim.msgSeq = [];
          anim.rate = 0;
          console.log(`[busMap] ${key} 出发 ${pos.current_station}→${pos.next_station} ts=${pos.timestamp}`);
        } else if (anim.phase === 'moving') {
          // 同段行驶中消息：数据源时间戳锚定 t + 段内速率估计（跟随真实节奏，吸收 dur 估计偏差）
          if (Number.isFinite(msgTs) && anim.departTs > 0) {
            const segKey = `${anim.lineId}:${anim.curIdx}:${anim.nextIdx}`;
            const dur = segDurRef.current.get(segKey) ?? (medianDurRef.current ?? DEFAULT_SEG_MS);
            const t = (msgTs - anim.departTs) / dur;
            if (t >= 0) {
              const seq = anim.msgSeq;
              const prev = seq[seq.length - 1];
              if (prev && msgTs > prev.ts && t > prev.t) {
                // 相邻同段消息的瞬时速率（数据源时钟），EMA 平滑 —— 段内推进随样本自适应
                const instRate = (t - prev.t) / ((msgTs - prev.ts) / 1000);
                if (instRate > 0 && Number.isFinite(instRate)) {
                  anim.rate = anim.rate > 0 ? anim.rate * 0.6 + instRate * 0.4 : instRate;
                }
              }
              seq.push({ ts: msgTs, t });
              if (seq.length > 8) seq.shift();
              anim.t = Math.min(1, t);
              anim.lastMsgT = anim.t;
              anim.lastMsgAt = Date.now();
            }
          }
        }
        const els = busDotsRef.current.get(key);
        if (els) els.wrap.className = anim.phase === 'dwell' ? 'bm-dot bm-dwell' : 'bm-dot';
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
  }, [amapReady, mapComplete, buses, isDemo, activeLines, busRadius, showBusLabels, lineColors]);

  /** 到站学习：数据源时间戳差值回填该段用时（EMA 平滑消除单样本波动）+ 持久化 + 更新中位数 */
  const learnSegment = (anim: BusAnim, nowTs: number) => {
    if (anim.departTs <= 0) return;
    const dur = nowTs - anim.departTs;
    if (dur > 1500 && dur < 10 * 60 * 1000) {
      const segKey = `${anim.lineId}:${anim.curIdx}:${anim.nextIdx}`;
      const prev = segDurRef.current.get(segKey);
      // 首次直接采用，之后 0.6/0.4 EMA 混合 —— 单次样本波动不造成速率跳变
      const ema = prev != null ? prev * 0.6 + dur * 0.4 : dur;
      segDurRef.current.set(segKey, ema);
      medianDurRef.current = computeMedian(segDurRef.current);
      try { localStorage.setItem(SEGDUR_KEY, JSON.stringify([...segDurRef.current.entries()])); } catch { /* 忽略 */ }
      console.log(`[busMap] segment learned ${segKey} = ${(dur / 1000).toFixed(1)}s → ema ${(ema / 1000).toFixed(1)}s (median=${((medianDurRef.current ?? 0) / 1000).toFixed(1)}s)`);
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
    anim.msgSeq = []; // 新段重新积累速率样本
    anim.rate = 0;
    anim.flipX = segmentWest(anim.cur, anim.next);
    anim.catchUp = false;
    // 到站转停靠：立即应用新镜像 + zoom 缩放 + 停靠脉冲 class（rAF 只在 moving 分支更新 transform）
    const els = busDotsRef.current.get(anim.key);
    if (els) {
      els.rot.style.transform = `scale(${zoomScaleRef.current})${anim.flipX ? ' scaleX(-1)' : ''}`;
      els.wrap.className = anim.phase === 'dwell' ? 'bm-dot bm-dwell' : 'bm-dot';
    }
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
            const els = busDotsRef.current.get(key);
            if (curC && nextC) {
              m.setPosition(lerpPos(curC, nextC, demoProgress(key, nowMs)));
              if (els) {
                const sc = zoomScaleRef.current;
                els.rot.style.transform = `scale(${sc})${nextC[0] < curC[0] ? ' scaleX(-1)' : ''}`;
              }
            }
            if (els) els.wrap.className = pos.status === '停靠中' ? 'bm-dot bm-dwell' : 'bm-dot';
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
            // 滑入期间图标按滑动方向镜像（叠加 zoom 缩放）
            const els = busDotsRef.current.get(key);
            if (els) {
              const sc = zoomScaleRef.current;
              els.rot.style.transform = `scale(${sc})${s.to[0] < s.from[0] ? ' scaleX(-1)' : ''}`;
            }
          }
          for (const anim of busAnimsRef.current.values()) {
            const m = busMarkersRef.current.get(anim.key);
            if (!m) continue;
            const curC = stationsRef.current.get(anim.cur);
            const nextC = stationsRef.current.get(anim.next);
            if (anim.catchUp) {
              // ★ 到站追赶：沿旧段轨道指数逼近 t=1（剩余越多速率越快，任何时刻位置连续、无冲刺感）
              anim.t += dt * (1 - anim.t) * CATCHUP_GAIN;
              if (1 - anim.t < 0.003) {
                anim.t = 1;
                finishCatchUp(anim);
              }
            } else if (anim.phase === 'moving' && curC && nextC && anim.departTs > 0) {
              // 消息间外推：优先用段内速率（数据源样本自适应），无样本时用段用时兜底
              let rate = anim.rate;
              if (rate <= 0) {
                const segKey = `${anim.lineId}:${anim.curIdx}:${anim.nextIdx}`;
                const dur = segDurRef.current.get(segKey) ?? (medianDurRef.current ?? DEFAULT_SEG_MS);
                rate = 1000 / dur;
              }
              anim.t = Math.min(1, anim.lastMsgT + ((now - anim.lastMsgAt) / 1000) * rate);
            }
            if (anim.phase === 'moving' && curC && nextC) {
              const eased = easeInOut(anim.t);
              const path = linePathsRef.current.get(anim.lineId);
              let pos: [number, number] | null = null;
              let west = anim.flipX;
              if (path && path.coords.length >= 2 && anim.curIdx >= 0 && anim.nextIdx >= 0) {
                pos = pathPos(path.coords, path.stopIndexes, anim.curIdx, anim.nextIdx, eased);
                // 路径当前切线方向（每帧跟随弯道，仅判断东西镜像）
                const ahead = pathPos(path.coords, path.stopIndexes, anim.curIdx, anim.nextIdx, Math.min(1, eased + 0.02));
                if (pos && ahead) west = ahead[0] < pos[0];
              }
              m.setPosition(pos ?? curC);
              const els = busDotsRef.current.get(anim.key);
              if (els) {
                const sc = zoomScaleRef.current;
                els.rot.style.transform = `scale(${sc})${west ? ' scaleX(-1)' : ''}`;
              }
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

/** 创建车辆 Marker（TbBus 图标，anchor center；返回 marker + 图标 DOM） */
function createBusMarker(
  M: any, map: any, key: string, color: string,
  radius: number, title: string,
): { m: any; dot: { wrap: HTMLElement; rot: HTMLElement } } {
  const size = Math.max(14, Math.round(radius * 2.5)); // 图标高度 px（旧"半径"语义 ×2.5）
  const wrap = document.createElement('div');
  wrap.className = 'bm-dot'; // 外层：停靠脉冲（scale 动画）
  wrap.style.cssText =
    `width:${size}px;height:${size}px;` +
    `filter:drop-shadow(0 0 ${Math.max(4, Math.round(size / 4))}px ${color})` +
    `drop-shadow(0 1px 2px rgba(0,0,0,0.85));`;
  const rot = document.createElement('div'); // 内层：朝向旋转
  rot.style.cssText = 'width:100%;height:100%;transform-origin:center;';
  rot.innerHTML = renderToStaticMarkup(<TbBus size={size} color={color} />);
  wrap.appendChild(rot);
  const m = new M.Marker({
    position: [0, 0],
    content: wrap,
    anchor: 'center',
    title,
    zIndex: 120,
  });
  m.setMap(map);
  return { m, dot: { wrap, rot } };
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
