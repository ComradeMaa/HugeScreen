import { Suspense, lazy, useMemo, useRef, useState, useCallback, useEffect, Fragment } from 'react';
import { useEditorStore, computePlacement, isTruncatable } from '../store/editorStore';
import { widgetRegistry, layoutEngine, clampToGrid, resizeCellFromHandle, type ResizeHandle } from '@hugescreen/core';
import { headerElementRegistry } from '@hugescreen/widgets';
import type { WidgetConfig, WidgetLayout, GridConfig } from '@hugescreen/shared';
import { mergePreservingMeta } from '@hugescreen/data';
import { dragPaletteType } from '../store/dragState';
import { useWidgetData } from '../hooks/useWidgetData';
import { EnergyFlow } from './EnergyFlow';
import { LowPolyBg } from './LowPolyBg';
import { CyberSphere } from './CyberSphere';
import { BorderFrame, HeaderBorder1 } from '@hugescreen/widgets/borders';
// 动态加载 CyberGlobe + Three.js，防止模块错误导致整页白屏
const CyberGlobe = lazy(() => import('./CyberGlobe').then(m => ({ default: m.CyberGlobe })));

/** 组件主体：注入实时数据（liveProps 以最高优先级覆盖静态默认值与用户配置）。
 *  当 liveProps 有内容时，自动把数据字段同步回 widget.options，保证属性面板显示最新数据。 */
function WidgetBody({ widget, Comp, defaultConfig, compact, isEditing = false }: {
  widget: WidgetConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Comp: any;
  defaultConfig: Record<string, unknown>;
  compact?: boolean;
  isEditing?: boolean;
}) {
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const isDraggingWidget = useEditorStore((s) => s.isDraggingWidget);
  const isDraggingHeaderEl = useEditorStore((s) => s.isDraggingHeaderEl);
  const pinEditWidgetId = useEditorStore((s) => s.pinEditWidgetId);
  const liveProps = useWidgetData(widget);

  // 当 REST 数据到达时，无条件回写数据字段到 widget.options
  // ★ static 数据源不需要同步——options 本身就是真源
  useEffect(() => {
    if (!liveProps || Object.keys(liveProps).length === 0) return;
    if (widget.dataSource?.type === 'static') return;
    // ★ 拖拽期间跳过数据同步，避免 store 更新触发 Canvas 重渲染
    if (isDraggingWidget || isDraggingHeaderEl) return;
    const currentOpts = widget.options as Record<string, unknown>;
    const dataFields = pickDataFields(liveProps, widget.type);
    if (Object.keys(dataFields).length === 0) return;
    // 只有当 REST 数据确实与当前 options 中的数据不同时才写入，避免无意义的 store 更新
    const currentData = Object.fromEntries(
      Object.keys(dataFields).map(k => [k, currentOpts[k]])
    );
    if (JSON.stringify(dataFields) === JSON.stringify(currentData)) return;
    // Merge: keep existing per-item metadata (like showLabelLine) from current options
    const merged = mergePreservingMeta(dataFields, currentOpts, widget.type);
    updateWidget(widget.id, { options: { ...currentOpts, ...merged } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveProps, widget.id, widget.type, isDraggingWidget, isDraggingHeaderEl]);

  const setLastDraggedPinId = useEditorStore((s) => s.setLastDraggedPinId);
  const pinPosRef = useRef<Record<string, { lat: number; lng: number }>>({});
  // 用 ref 保存最新的 widget 引用，避免 onUpdate 每次渲染重建导致 CyberMapWidget 的 handlePinMouseDown 闭包过期
  const widgetRef = useRef(widget);
  widgetRef.current = widget;

  const stableOnUpdate = useCallback((patch: Record<string, unknown>) => {
    const w = widgetRef.current;
    // 地图钉拖拽检测：比较新旧位置，找出被拖拽的实例并高亮
    if (patch.pinInstances && Array.isArray(patch.pinInstances)) {
      const newPins = patch.pinInstances as any[];
      for (const np of newPins) {
        const prev = pinPosRef.current[np.id];
        if (prev && (prev.lat !== np.lat || prev.lng !== np.lng)) {
          setLastDraggedPinId(np.id);
        }
        pinPosRef.current[np.id] = { lat: np.lat, lng: np.lng };
      }
    }
    updateWidget(w.id, { options: { ...(w.options as Record<string, unknown>), ...patch } });
  }, [updateWidget, setLastDraggedPinId]); // 稳定依赖，不会每次渲染重建

  // widget.options 为最终真源 — 数据编辑器、引出线标签等 UI 元数据均在此
  // REST 数据通过 sync effect 异步写回 options，合并时自动保留 per-item 元数据
  // ★ interactive：浏览模式（非编辑）下 3D 组件启用拖拽旋转/悬停高亮（编辑模式禁用，避免与 dnd-kit 冲突）
  return <Comp {...defaultConfig} {...liveProps} {...(widget.options as object)} compact={compact} widgetId={widget.id} dataSource={widget.dataSource} pinEditMode={pinEditWidgetId === widget.id} onUpdate={stableOnUpdate} interactive={!isEditing} />;
}

/** 只保留数据字段，排除外观/开关字段 */
function pickDataFields(props: Record<string, unknown>, chartType: string): Record<string, unknown> {
  const dataKeys: Record<string, string[]> = {
    "pie-chart": ["categories"],
    "funnel-chart": ["categories"],
    "line-chart": ["xLabels", "lineSeries"],
    "bar-chart": ["categories"],
    "bar-line-chart": ["xLabels", "mixedSeries"],
    "stat-card": ["title", "value", "suffix", "ringPercent", "trend", "trendLabel"],
    "text-widget": ["text"],
    "image-widget": ["images"],
    "video-widget": ["videos"],
    "water-pond": ["value"],
    "gauge-chart": ["value", "name", "unit"],
    "box-plot": ["categories"],
    "candlestick": ["candles"],
    "group-chart": ["xLabels", "barSeries"],
    "histogram": ["data"],
    "voronoi": ["points"],
    "confidence-band": ["xLabels", "mainSeries", "upper", "lower"],
    "large-area-chart": ["points"],
    "dynamic-time": ["points"],
    "step-line": ["points"],
    "scatter-plot": ["points"],
    "intraday-chart": ["points"],
    "radar-chart": ["indicators", "series"],
    "heatmap": ["points"],
    "relation-chart": ["nodes", "links"],
    "sankey-chart": ["nodes", "links"],
    "marquee-table": ["headers", "rows"],
    "attack-globe": ["sources", "targets", "attacks"],
    "attack-map": ["sources", "targets", "attacks"],
    // ★ bus-map：MQTT 实时数据不回写 options（~10 快照/秒会 thrash store；发布后 viewer 重连 retained 秒级回补）
    "bus-map": [],
    "tree-chart": ["trees"],
    "treemap-chart": ["treemaps"],
    "sunburst-chart": ["sunbursts"],
    "multiple-x-axis-chart": ["bottom", "top"],
  };
  const keys = dataKeys[chartType] ?? Object.keys(props);
  const out: Record<string, unknown> = {};
  for (const k of keys) { if (k in props) out[k] = props[k]; }
  return out;
}

// ★ mergePreservingMeta 已提取到 @hugescreen/data（transform/mergeMeta.ts），
//   独立组件与成员组件（CompositeChartWidget）共用同一份实现，防止能力漂移



interface ScreenCanvasProps {
  isEditing?: boolean;
  /** 断点网格覆盖（响应式） */
  bpGrid?: import('@hugescreen/shared').GridConfig;
  /** 断点布局覆盖（响应式），key = widgetId */
  bpLayouts?: Record<string, import('@hugescreen/shared').WidgetLayout>;
  /** 需要隐藏的 widget ID 列表 */
  hiddenWidgets?: string[];
  /** 有效画布宽度覆盖（移动端原生分辨率） */
  canvasWidth?: number;
  /** 有效画布高度覆盖（移动端拉伸时用） */
  canvasHeight?: number;
}

interface BlockSlot {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/** 获取与区域重叠的组件（不检查大小限制），用于交换检测 */
function getOverlappingWidget(
  slot: BlockSlot,
  widgets: WidgetConfig[],
  excludeId?: string,
): WidgetConfig | null {
  return widgets.find((w) => {
    if (w.id === excludeId) return false;
    return layoutEngine.overlaps(
      { col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan },
      slot,
    );
  }) ?? null;
}

/**
 * 自由网格落点计算（R3 唯一路径的入口，dragover/drop 共用）：
 * - 新组件（copy）：cell 为左上角 + 注册 defaultSize 尺寸，clamp 网格边界；
 *   与已有组件重叠 → computePlacement 避让（reflow 截断扩大者 / findFreeSlot 兜底）
 * - 移动（move）：cell 为左上角 + 保持原尺寸；与其他组件重叠 → 返回 blocker（交换预览），
 *   否则直接放置
 */
function computeDropLayout(
  widgets: WidgetConfig[],
  grid: import('@hugescreen/shared').GridConfig,
  cell: { col: number; row: number },
  kind: 'copy' | 'move',
  wid: string | null,
  defSize?: { colSpan: number; rowSpan: number },
  rowMin = 1,
): { layout: WidgetLayout; blocker?: WidgetConfig } {
  if (kind === 'move' && wid) {
    const dragged = widgets.find((w) => w.id === wid);
    if (!dragged) return { layout: { col: cell.col, row: cell.row, colSpan: 1, rowSpan: 1 } };
    // ★ preferShift：移动保持尺寸，下边界超界平移收进（不压缩组件）
    const desired = clampToGrid(
      { col: cell.col, row: cell.row, colSpan: dragged.layout.colSpan, rowSpan: dragged.layout.rowSpan },
      grid, undefined, { colSpan: grid.cols, rowSpan: grid.rows }, rowMin, true,
    );
    const blocker = widgets.find((w) => w.id !== wid && layoutEngine.overlaps(desired, w.layout));
    if (blocker) return { layout: desired, blocker };
    return { layout: desired };
  }
  // copy：新组件 = 注册默认尺寸；★ 鼠标保持在判定框中心
  //   （落点格 = 鼠标格 − 尺寸一半，向下取整保证框覆盖鼠标格；
  //   ★ preferShift：边界超界平移收进，保持最小尺寸不压缩）
  const size = defSize ?? { colSpan: 2, rowSpan: 2 };
  const desired = clampToGrid(
    {
      col: cell.col - Math.floor(size.colSpan / 2),
      row: cell.row - Math.floor(size.rowSpan / 2),
      colSpan: size.colSpan,
      rowSpan: size.rowSpan,
    },
    grid, undefined, { colSpan: grid.cols, rowSpan: grid.rows }, rowMin, true,
  );
  // 与已有组件重叠 → 避让（可能被 reflow 截断或 findFreeSlot 移开）
  const { layout } = computePlacement(widgets, { layout: desired }, grid);
  return { layout };
}

// ─── 像素计算 ───
function cellMetrics(w: number, h: number, gap: number, cols: number, rows: number) {
  return {
    cellW: (w - gap * (cols + 1)) / cols,
    cellH: (h - gap * (rows + 1)) / rows,
  };
}

function slotToPx(
  s: { col: number; row: number; colSpan: number; rowSpan: number },
  cellW: number, cellH: number, gap: number,
) {
  return {
    left: gap + s.col * (cellW + gap),
    top:  gap + s.row * (cellH + gap),
    width:  s.colSpan * cellW + (s.colSpan - 1) * gap,
    height: s.rowSpan * cellH + (s.rowSpan - 1) * gap,
  };
}

const HEADER_ROW = 0;

/** 根据网格列数动态调整顶栏行数 */
function headerRows(cols: number): number {
  if (cols >= 8) return 1;
  if (cols >= 2) return 4;
  return 7; // 1 列 = 手机，需要足够高度容纳标题+时钟垂直排列
}

/** 顶栏 Y 结束位置（设计坐标），落点高于此 = 顶栏区域 */
function headerBottomY(canvasH: number, gap: number, rows: number): number {
  const { cellH } = cellMetrics(1920, canvasH, gap, 8, rows);
  return gap + HEADER_ROW * (cellH + gap) + cellH;
}

export function ScreenCanvas({ isEditing = false, bpGrid, bpLayouts, hiddenWidgets, canvasWidth: canvasWOverride, canvasHeight: canvasHOverride }: ScreenCanvasProps) {
  // ─── 精确订阅：只订阅渲染所需的状态，避免全量 store 变更触发重渲染 ───
  const config = useEditorStore(s => s.config);
  const selectedWidgetId = useEditorStore(s => s.selectedWidgetId);
  const selectedHeaderSlotId = useEditorStore(s => s.selectedHeaderSlotId);
  const isDraggingWidget = useEditorStore(s => s.isDraggingWidget);
  const isDraggingHeaderEl = useEditorStore(s => s.isDraggingHeaderEl);
  const backgroundPattern = useEditorStore(s => s.backgroundPattern);
  const backgroundEffect = useEditorStore(s => s.backgroundEffect);
  const backgroundImage = useEditorStore(s => s.backgroundImage);
  const backgroundVideo = useEditorStore(s => s.backgroundVideo);
  const pinEditWidgetId = useEditorStore(s => s.pinEditWidgetId);
  // 稳定 action 引用（store 创建时固定，不会随渲染变化）
  const { addWidget, moveWidget, swapWidgetLayouts, removeWidget, resizeWidget,
    setHeaderSlot, removeHeaderElement, swapHeaderSlots,
    setDraggingWidget, setDraggingHeaderEl, selectWidget, selectHeaderSlot, setHeaderRowSpan,
  } = useEditorStore.getState();
  const { canvas, grid, header, widgets, theme } = config;

  // ─── 响应式断点覆盖（仅影响渲染，不影响编辑态数据结构） ───
  const activeGrid = bpGrid || grid;
  const activeCanvasW = canvasWOverride || canvas.width;
  const activeCanvasH = canvasHOverride || canvas.height;
  const visibleWidgets = useMemo(() => {
    if (!hiddenWidgets || hiddenWidgets.length === 0) return widgets;
    return widgets.filter(w => !hiddenWidgets.includes(w.id));
  }, [widgets, hiddenWidgets]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingWidgetId = useRef<string | null>(null);
  // ★ 拖拽偏移校正：鼠标所在格 − 组件 origin 格（handleWidgetDragStart 记录，dragover/drop 反扣）
  const dragOffsetRef = useRef<{ col: number; row: number }>({ col: 0, row: 0 });
  // 自定义拖拽副本（替代浏览器默认半透明鬼影）
  const dragCloneEl = useRef<HTMLElement | null>(null);
  const dragCloneOffset = useRef({ x: 0, y: 0 });
  const dragCleanup = useRef<(() => void) | null>(null);
  const dragSourceEl = useRef<HTMLElement | null>(null);
  const dragDidMove = useRef(false); // 区分真实拖拽和点击
  const headerDragSlotId = useRef<string | null>(null); // 顶栏拖拽中的槽位 ID（用于 native dragend 兜底恢复可见性）
  const pendingHeaderSwap = useRef<{ fromId: string; toId: string } | null>(null); // 推迟到 dragend 执行的交换
  const lastSwapTargetId = useRef<string | null>(null); // 上一个被"挤"的组件 ID，用于归位动画
  const lastHeaderSwapInfo = useRef<{ targetSlotId: string; sourceSlotId: string } | null>(null); // 顶栏交换归位动画

  // 自由网格拖放预览：layout = 最终放置位置（可能已被避让），swapping = 交换模式
  type Preview = { layout: WidgetLayout; swapping?: boolean };
  const [dropPreview, setDropPreview] = useState<Preview | null>(null);

  // ★ 顶栏整体选中：显示底部 resize 手柄（像组件一样拖拽调节高度）
  const [headerSelected, setHeaderSelected] = useState(false);

  // 拖拽交换预览：拖拽已有组件到另一个组件上时，目标组件被"挤"到原位置
  type DragSwap = { targetWidgetId: string; originSlot: BlockSlot };
  const [dragSwap, setDragSwap] = useState<DragSwap | null>(null);

  // ★ 顶栏行数（高度可配）：配置 rowSpan 优先，否则按列数自适应（长度始终横跨全屏）
  const headerRowSpan = header?.rowSpan ?? headerRows(activeGrid.cols);
  const dynamicHRows = header?.visible !== false ? headerRowSpan : 0;
  const isNarrowHeader = activeGrid.cols <= 2;
  // ★ 组件起始行下限：顶栏支持 0.5 行步进时取整（row 0 与 0.5 行顶栏重叠）
  const widgetRowMin = header?.visible !== false ? Math.ceil(headerRowSpan) : 0;

  // ★ 网格自适应：顶栏可见时总行数 = 顶栏行 + 组件区行（组件行数不被顶栏压缩）；
  //   顶栏隐藏时行被释放，组件区变大（cellH 自动变大 → 组件拉伸）
  const effectiveRows = header?.visible !== false ? activeGrid.rows + headerRowSpan : activeGrid.rows - headerRowSpan;
  const { cellW, cellH } = useMemo(
    () => cellMetrics(activeCanvasW, activeCanvasH, activeGrid.gap, activeGrid.cols, effectiveRows),
    [activeCanvasW, activeCanvasH, activeGrid.gap, activeGrid.cols, effectiveRows],
  );

  const headerPx = useMemo(
    () => slotToPx({ col: 0, row: HEADER_ROW, colSpan: activeGrid.cols, rowSpan: dynamicHRows }, cellW, cellH, activeGrid.gap),
    [cellW, cellH, activeGrid.gap, activeGrid.cols, dynamicHRows],
  );

  const headerBottom = headerPx.top + headerPx.height;

  // 顶栏槽位像素：窄屏垂直排列（仅显示非空槽位），宽屏水平排列
  const headerSlotPixels = useMemo(() => {
    if (isNarrowHeader) {
      const activeSlots = header.slots.filter(s => s.elementType !== null);
      if (activeSlots.length === 0) return [];
      let top = headerPx.top;
      const slotH = Math.max(24, (headerPx.height - (activeSlots.length - 1) * activeGrid.gap) / activeSlots.length);
      return activeSlots.map((s) => {
        const px = { left: headerPx.left, top, width: headerPx.width, height: slotH };
        top += slotH + activeGrid.gap;
        return { id: s.id, ...px };
      });
    }
    let left = headerPx.left;
    return header.slots.map((s) => {
      const w = s.colSpan * cellW + (s.colSpan - 1) * activeGrid.gap;
      const px = { left, top: headerPx.top, width: w, height: headerPx.height };
      left += w + activeGrid.gap;
      return { id: s.id, ...px };
    });
  }, [header.slots, headerPx, cellW, activeGrid.gap, isNarrowHeader]);

  // Widget 像素位置（canvas 相对坐标）
  // 如果有断点布局覆盖，使用覆盖值；否则使用 widget 自身 layout
  const positions = useMemo(() => {
    const headerHidden = header?.visible === false;
    return visibleWidgets.map((w) => {
      const layout = bpLayouts?.[w.id] || w.layout;
      // 顶栏隐藏时，所有组件向上平移一行占据顶栏空间
      const adjustedLayout = headerHidden
        ? { ...layout, row: Math.max(0, layout.row - headerRowSpan) }
        : layout;
      return {
        id: w.id,
        ...slotToPx(adjustedLayout, cellW, cellH, activeGrid.gap),
      };
    });
  }, [visibleWidgets, bpLayouts, cellW, cellH, activeGrid.gap]);

  // ★ positions 的 Map 索引，替代 O(N²) 的 positions.find()
  const positionsMap = useMemo(() => {
    const map = new Map<string, (typeof positions)[number]>();
    for (const p of positions) map.set(p.id, p);
    return map;
  }, [positions]);

  const clientToDesign = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top)  * (canvas.height / rect.height),
      };
    },
    [canvas.width, canvas.height],
  );

  // ═══ 顶栏拖拽 ═══
  const [headerDragIdx, setHeaderDragIdx] = useState<number | null>(null);
  const [headerBlockedIdx, setHeaderBlockedIdx] = useState<number | null>(null);
  const [widgetOverHeader, setWidgetOverHeader] = useState(false); // 一般组件拖入顶栏区域
  const [headerOverWidget, setHeaderOverWidget] = useState(false); // 顶栏元素拖入主区块
  // ★ 拖拽去重：避免 dragover 高频事件对同一槽位反复 setState
  const lastDropRef = useRef<string | null>(null);
  // 交换预览：拖拽顶栏组件到已占用槽位上时，目标槽位内容在原位显示
  const [headerSwapPreview, setHeaderSwapPreview] = useState<{ targetSlotId: string; sourceSlotId: string } | null>(null);
  const [headerDragHint, setHeaderDragHint] = useState(false); // 顶栏相关拖拽悬停时高亮可用槽位
  const [widgetDragHint, setWidgetDragHint] = useState(false); // 一般组件拖拽时高亮可用区块
  const [localWidgetDrag, setLocalWidgetDrag] = useState(false); // 本地跟踪一般组件拖拽（避开 zustand 同步更新问题）
  const [localHeaderDrag, setLocalHeaderDrag] = useState(false); // 本地跟踪顶栏元素拖拽

  // 合并 store 和本地拖拽状态（store 用于跨组件通信，本地用于本组件即时渲染）
  const effectiveWidgetDrag = isDraggingWidget || localWidgetDrag;
  const effectiveHeaderDrag = isDraggingHeaderEl || localHeaderDrag;

  // 从组件池拿起组件时即可启用可用区域高亮
  useEffect(() => {
    const onDragStart = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/header-element-type')) {
        setHeaderDragHint(true);
      }
      if (e.dataTransfer?.types.includes('application/widget-type')) {
        setWidgetDragHint(true);
      }
    };
    const onDragEnd = () => {
      setHeaderDragHint(false);
      setWidgetDragHint(false);
    };
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragend', onDragEnd);
    return () => {
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('dragend', onDragEnd);
    };
  }, []);

  // ★ 切换编辑器 → 预览模式时强制重置所有拖拽状态，防止删除组件后提示残留
  useEffect(() => {
    if (!isEditing) {
      setLocalWidgetDrag(false);
      setLocalHeaderDrag(false);
      setWidgetDragHint(false);
      setHeaderDragHint(false);
      setDropPreview(null);
      setDragSwap(null);
      setWidgetOverHeader(false);
      setHeaderOverWidget(false);
      lastDropRef.current = null;
    }
  }, [isEditing]);

  // ★ 删除组件后也强制清除拖拽提示（编辑态下点击 × 可能触发微拖拽残留）
  const prevWidgetCount = useRef(widgets.length);
  useEffect(() => {
    if (widgets.length < prevWidgetCount.current) {
      setLocalWidgetDrag(false);
      setWidgetDragHint(false);
      setDropPreview(null);
      setDragSwap(null);
    }
    prevWidgetCount.current = widgets.length;
  }, [widgets.length]);

  // 一般组件拖拽时（palette 新建 / 已有组件移动）是否启用可用区块提示
  const showWidgetSlotsHint = widgetDragHint || (effectiveWidgetDrag && !effectiveHeaderDrag);
  const showHeaderDragHint = effectiveHeaderDrag || headerDragHint; // palette / 已有顶栏拖拽

  const handleHeaderDragOver = useCallback((e: React.DragEvent) => {
    // 一般组件拖入顶栏 → 标记拒绝
    if (e.dataTransfer.types.includes('application/widget-id')) {
      e.preventDefault();
      e.stopPropagation();
      setWidgetOverHeader(true);
      setDropPreview(null);
      setDragSwap(null);
      return;
    }
    if (e.dataTransfer.types.includes('application/header-element-type') ||
        e.dataTransfer.types.includes('application/header-element-id')) {
      e.preventDefault();
      e.stopPropagation();
      setHeaderDragHint(true);
      // palette 拖入 → copy；已有顶栏换位 → move（必须与 effectAllowed 匹配，否则浏览器重置为 none）
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/header-element-type')
        ? 'copy' : 'move';
      const { x } = clientToDesign(e.clientX, e.clientY);
      let acc = headerPx.left;
      for (let i = 0; i < header.slots.length; i++) {
        const w = header.slots[i].colSpan * cellW + (header.slots[i].colSpan - 1) * grid.gap;
        if (x >= acc && x < acc + w) {
          setHeaderDragIdx(i);
          // 多列组件放在最后槽位 → 红边
          const elType = e.dataTransfer.getData('application/header-element-type');
          if (elType) {
            const def = headerElementRegistry.get(elType);
            const need = def?.defaultColSpan ?? 1;
            setHeaderBlockedIdx(need > 1 && i + need > header.slots.length ? i : null);
          } else if (e.dataTransfer.types.includes('application/header-element-id') && headerDragSlotId.current) {
            // 拖拽已有顶栏组件 → 检查合并范围是否冲突 + 设置交换预览
            const srcSlot = header.slots.find(s => s.id === headerDragSlotId.current);
            if (srcSlot?.elementType) {
              const srcDef = headerElementRegistry.get(srcSlot.elementType);
              const srcNeed = srcDef?.defaultColSpan ?? 1;
              let mergeBlocked = false;
              if (srcNeed > 1) {
                // j 从 1 开始：跳过目标槽位本身（目标有元素 = 正常交换，不是冲突）
                for (let j = 1; j < srcNeed; j++) {
                  const sl = header.slots[i + j];
                  if (!sl) { mergeBlocked = true; break; }
                  if (sl.elementType && sl.id !== srcSlot.id) { mergeBlocked = true; break; }
                }
              }
              setHeaderBlockedIdx(mergeBlocked ? i : null);
              // 交换预览：目标槽位有内容且不是源槽位 → 目标内容"挤"到原位
              const targetSlot = header.slots[i];
              if (!mergeBlocked && targetSlot.elementType && targetSlot.id !== headerDragSlotId.current) {
                const info = { targetSlotId: targetSlot.id, sourceSlotId: headerDragSlotId.current };
                setHeaderSwapPreview(info);
                lastHeaderSwapInfo.current = info;
              } else {
                setHeaderSwapPreview(null);
                if (lastHeaderSwapInfo.current) {
                  const info = lastHeaderSwapInfo.current;
                  setTimeout(() => { if (lastHeaderSwapInfo.current === info) lastHeaderSwapInfo.current = null; }, 350);
                }
              }
            } else {
              setHeaderBlockedIdx(null);
            }
          } else {
            setHeaderBlockedIdx(null);
          }
          return;
        }
        acc += w + grid.gap;
      }
      setHeaderDragIdx(null);
      setHeaderBlockedIdx(null);
    }
  }, [clientToDesign, header.slots, headerPx.left, cellW, grid.gap]);

  const handleHeaderDrop = useCallback((e: React.DragEvent) => {
    setHeaderDragIdx(null);
    setHeaderBlockedIdx(null);
    setHeaderSwapPreview(null);
    setHeaderDragHint(false);
    const elType = e.dataTransfer.getData('application/header-element-type');
    const elId = e.dataTransfer.getData('application/header-element-id');
    if (!elType && !elId) return;
    e.preventDefault();
    e.stopPropagation();

    const { x } = clientToDesign(e.clientX, e.clientY);
    let acc = headerPx.left;
    let targetIdx = -1;
    for (let i = 0; i < header.slots.length; i++) {
      const w = header.slots[i].colSpan * cellW + (header.slots[i].colSpan - 1) * grid.gap;
      if (x >= acc && x < acc + w) { targetIdx = i; break; }
      acc += w + grid.gap;
    }
    if (targetIdx === -1) return;
    const target = header.slots[targetIdx];

    if (elType) {
      const def = headerElementRegistry.get(elType);
      const need = def?.defaultColSpan ?? 1;
      // 拒绝：多列组件放在最后槽位
      if (need > 1 && targetIdx + need > header.slots.length) return;
      setHeaderSlot(target.id, elType, def?.defaultConfig ?? {});
    } else if (elId && elId !== target.id) {
      const src = header.slots.find(s => s.id === elId);
      if (src?.elementType) {
        const srcDef = headerElementRegistry.get(src.elementType);
        const srcNeed = srcDef?.defaultColSpan ?? 1;
        // 拒绝：多列组件放到末尾会越界
        if (srcNeed > 1 && targetIdx + srcNeed > header.slots.length) return;
        // 拒绝：多列组件合并范围内有非空槽位（防止静默覆盖）
        if (srcNeed > 1) {
          let blocked = false;
          for (let i = 0; i < srcNeed; i++) {
            const sl = header.slots[targetIdx + i];
            if (!sl) { blocked = true; break; }
            if (sl.elementType && sl.id !== elId && sl.id !== target.id) { blocked = true; break; }
          }
          if (blocked) return;
        }
        // 推迟到 dragend 执行：避免 drop 中同步 setState → React 重渲染干扰浏览器 dragend 事件
        pendingHeaderSwap.current = { fromId: src.id, toId: target.id };
      }
    }
  }, [clientToDesign, header.slots, headerPx.left, cellW, grid.gap]);

  // ═══ 主区域拖拽（canvas 全局） ═══
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    // 顶栏元素拖入主区块 → 标记拒绝
    if (e.dataTransfer.types.includes('application/header-element-type') ||
        e.dataTransfer.types.includes('application/header-element-id')) {
      e.preventDefault();
      setHeaderOverWidget(true);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const { x, y } = clientToDesign(e.clientX, e.clientY);
    // 如果落点在顶栏区域内 → 不处理主区域逻辑
    if (y < headerBottom) { setDropPreview(null); lastDropRef.current = null; return; }

    const cell = layoutEngine.pixelToCell(x, y, 1, 1, grid, canvas.width, canvas.height);

    if (e.dataTransfer.types.includes('application/widget-type')) {
      e.dataTransfer.dropEffect = 'copy';
      // ★ dragover 无法 getData → 用模块级暂存的类型查 defaultSize（R3 预览 = 最终）
      const type = dragPaletteType;
      const def = type ? widgetRegistry.get(type) : undefined;
      // ★ 新组件默认以最小尺寸落位（用户自行拉伸放大）
      const { layout } = computeDropLayout(widgets, grid, cell, 'copy', null, def?.minSize, widgetRowMin);
      const key = `copy:${layout.col}:${layout.row}:${layout.colSpan}:${layout.rowSpan}`;
      if (lastDropRef.current === key) return;
      lastDropRef.current = key;
      setDragSwap(null);
      setDropPreview({ layout });
    } else if (e.dataTransfer.types.includes('application/widget-id')) {
      e.dataTransfer.dropEffect = 'move';
      // ★ 使用 ref 而非 getData()：Chrome 在 dragover 中禁止 getData() 读取自定义类型
      const wid = draggingWidgetId.current;
      if (!wid) { setDragSwap(null); setDropPreview(null); return; }
      // ★ 偏移校正：反扣拖拽起点鼠标相对组件 origin 的格偏移（防预览框跳格）
      const corrected = {
        col: cell.col - dragOffsetRef.current.col,
        row: cell.row - dragOffsetRef.current.row,
      };
      const { layout, blocker } = computeDropLayout(widgets, grid, corrected, 'move', wid, undefined, widgetRowMin);
      if (blocker) {
        // 拖到其他组件上 → 交换预览：被挤的 blocker 预览渲染在【拖动组件的原位置】
        //   （交换后它将移去的地方），配 300ms 过渡动画形成"被挤走"的视觉
        const dragged = widgets.find((w) => w.id === wid);
        const key = `swap:${blocker.id}:${layout.col}:${layout.row}`;
        if (lastDropRef.current === key) return;
        lastDropRef.current = key;
        lastSwapTargetId.current = blocker.id;
        setDragSwap({
          targetWidgetId: blocker.id,
          originSlot: dragged
            ? { col: dragged.layout.col, row: dragged.layout.row, colSpan: dragged.layout.colSpan, rowSpan: dragged.layout.rowSpan }
            : { col: layout.col, row: layout.row, colSpan: layout.colSpan, rowSpan: layout.rowSpan },
        });
        setDropPreview({ layout, swapping: true });
        return;
      }
      const key = `move:${layout.col}:${layout.row}`;
      if (lastDropRef.current === key) return;
      lastDropRef.current = key;
      // 不在这里清 lastSwapTargetId：保留它让组件归位也有动画
      setDragSwap(null);
      setDropPreview({ layout });
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  }, [clientToDesign, grid, canvas.width, canvas.height, widgets, headerBottom]);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    // 只有真正离开 canvas 容器才清状态，进入子元素（relatedTarget 仍在容器内）不做处理
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropPreview(null);
      setDragSwap(null);
      setHeaderOverWidget(false);
    }
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    // 地图钉编辑模式下禁用画布拖拽
    if (pinEditWidgetId !== null) return;
    if (e.dataTransfer.types.includes('application/header-element-type') ||
        e.dataTransfer.types.includes('application/header-element-id')) return;

    e.preventDefault();
    e.stopPropagation();
    setDropPreview(null);
    setDragSwap(null);

    const { x, y } = clientToDesign(e.clientX, e.clientY);
    if (y < headerBottom) return;

    const cell = layoutEngine.pixelToCell(x, y, 1, 1, grid, canvas.width, canvas.height);

    // drop 时 getData 可用，直接用真实类型（dragPaletteType 仅供 dragover 预览计算尺寸）
    const wt = e.dataTransfer.getData('application/widget-type');
    if (wt) {
      const def = widgetRegistry.get(wt);
      // ★ 新组件默认以最小尺寸落位（与 dragover 预览一致）
      const { layout } = computeDropLayout(widgets, grid, cell, 'copy', null, def?.minSize, widgetRowMin);
      addWidget(wt, { ...layout });
      return;
    }
    // ★ 优先用 ref（dragover 中 getData 不可用），drop 时 ref 兜底
    const wid = draggingWidgetId.current || e.dataTransfer.getData('application/widget-id');
    if (wid) {
      // ★ 偏移校正：与 dragover 一致，drop 落点 = 鼠标格 − 起点偏移
      const corrected = {
        col: cell.col - dragOffsetRef.current.col,
        row: cell.row - dragOffsetRef.current.row,
      };
      // drop 时检测交换（使用纯重叠检测，不受组件大小限制）
      const { layout, blocker } = computeDropLayout(widgets, grid, corrected, 'move', wid, undefined, widgetRowMin);
      if (blocker) {
        swapWidgetLayouts(wid, blocker.id);
      } else {
        moveWidget(wid, { ...layout });
      }
    }
  }, [clientToDesign, grid, canvas.width, canvas.height, widgets, addWidget, moveWidget, swapWidgetLayouts, headerBottom]);

  // ─── 共享清理函数 ───
  function doDragCleanup() {
    if (dragCloneEl.current) {
      dragCloneEl.current.remove();
      dragCloneEl.current = null;
    }
    if (dragCleanup.current) {
      dragCleanup.current();
      dragCleanup.current = null;
    }
    if (dragSourceEl.current) {
      dragSourceEl.current.style.visibility = 'visible';
      dragSourceEl.current = null;
    }
    dragOffsetRef.current = { col: 0, row: 0 };
    // 清理顶栏拖拽残留状态，防止中断的拖拽污染下一次拖拽
    pendingHeaderSwap.current = null;
    headerDragSlotId.current = null;
    lastHeaderSwapInfo.current = null;
  }

  // ═══ 拖拽生命周期 ═══
  const handleWidgetDragStart = useCallback((e: React.DragEvent, id: string) => {
    if (!isEditing) { e.preventDefault(); return; }
    // 地图钉编辑模式下禁用 widget 拖拽
    if (pinEditWidgetId !== null) { e.preventDefault(); return; }

    // 防御性清理上一次拖拽残留
    doDragCleanup();

    e.dataTransfer.setData('application/widget-id', id);
    e.dataTransfer.effectAllowed = 'move';
    draggingWidgetId.current = id;
    setLocalWidgetDrag(true); // React 18 自动批处理，handler 结束后才重渲染
    setDraggingWidget(true);

    const sourceEl = e.currentTarget as HTMLElement;
    dragSourceEl.current = sourceEl;
    const rect = sourceEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // ★ 拖拽偏移校正：记录「鼠标所在格 − 组件 origin 格」，
    //   拖拽预览/落点按反扣后的格计算 → 鼠标抓组件哪一点，组件就保持原位
    //   直到移动越过半格（修复预览框"偏右一格"的跳变）。
    const wl = widgets.find((w2) => w2.id === id);
    if (wl) {
      const sDesign = clientToDesign(e.clientX, e.clientY);
      const sCol = Math.round((sDesign.x - activeGrid.gap) / (cellW + activeGrid.gap));
      const sRow = Math.round((sDesign.y - activeGrid.gap) / (cellH + activeGrid.gap));
      dragOffsetRef.current = { col: sCol - wl.layout.col, row: sRow - wl.layout.row };
    } else {
      dragOffsetRef.current = { col: 0, row: 0 };
    }

    // ★ 关键：先克隆再隐藏原组件，避免 clone 继承 visibility:hidden
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    // ★ 移除克隆体中的 ECharts canvas：图表克隆后动画循环继续每帧重绘 canvas，
    //   叠加克隆体每帧移动会卡顿（饼图等 ECharts 组件明显）—— 用背景占位替代。
    //   ★ 占位 div 必须是普通流内块级 + 继承 canvas 尺寸 —— 绝对定位 + inset:0
    //   在父容器无定位祖先时会相对视口铺满，导致克隆体外观巨大。
    clone.querySelectorAll('canvas').forEach((c) => {
      const ph = document.createElement('div');
      ph.style.background = 'rgba(30,30,36,0.9)';
      ph.style.width = c.style.width || '100%';
      ph.style.height = c.style.height || '100%';
      c.replaceWith(ph);
    });
    // ★ 追加而非覆盖 className：保留 overflow-hidden / flex 等布局 class，
    //   否则克隆体内部布局崩坏、内容溢出固定尺寸之外（视觉"大一圈"）
    clone.className = (sourceEl.className + ' hugescreen-drag-clone').trim();
    clone.style.position = 'fixed';
    clone.style.left = (e.clientX - offsetX) + 'px';
    clone.style.top = (e.clientY - offsetY) + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '10000';
    clone.style.opacity = '0.92';
    document.body.appendChild(clone);
    dragCloneEl.current = clone;
    dragCloneOffset.current = { x: offsetX, y: offsetY };
    dragDidMove.current = false;

    // 用微小可见元素替换默认鬼影（必须在视口内，否则部分浏览器拒绝拖拽）
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => {
      ghost.remove();
      sourceEl.style.visibility = 'hidden';
    });

    // 全局 dragover 跟踪鼠标，实时更新副本位置（capture 阶段确保不被 stopPropagation 拦截）
    const onDocDragOver = (de: DragEvent) => {
      if (!dragCloneEl.current) return;
      dragCloneEl.current.style.left = (de.clientX - dragCloneOffset.current.x) + 'px';
      dragCloneEl.current.style.top = (de.clientY - dragCloneOffset.current.y) + 'px';
      dragDidMove.current = true;
    };
    document.addEventListener('dragover', onDocDragOver, true);
    dragCleanup.current = () => document.removeEventListener('dragover', onDocDragOver, true);

    // 原生 dragend 兜底：即使 React 在 drop 时卸载了元素（侧边栏删除），也能保证清理
    const onNativeDragEnd = () => {
      document.removeEventListener('dragend', onNativeDragEnd);
      doDragCleanup();
      setDropPreview(null);
      setDragSwap(null);
      draggingWidgetId.current = null;
      setDraggingWidget(false);
      setLocalWidgetDrag(false);
    };
    document.addEventListener('dragend', onNativeDragEnd);
  }, [isEditing, setDraggingWidget, clientToDesign, widgets, activeGrid, cellW, cellH]);

  const handleWidgetDragEnd = useCallback((e: React.DragEvent, id: string) => {
    doDragCleanup();
    setDropPreview(null);
    setDragSwap(null);
    lastSwapTargetId.current = null;
    draggingWidgetId.current = null;
    setDraggingWidget(false);
    setLocalWidgetDrag(false);
    // 拖到非法位置或取消 → 复原，不删除
    const el = document.getElementById(`widget-${id}`);
    if (el) el.style.visibility = 'visible';
  }, [setDraggingWidget]);

  // ─── 顶栏元素拖拽（与普通组件共用同一套自定义拖拽副本机制）───
  const handleHeaderElDragStart = useCallback((e: React.DragEvent, slotId: string) => {
    if (!isEditing) { e.preventDefault(); return; }

    // 防御性清理上一次拖拽残留
    doDragCleanup();

    e.dataTransfer.setData('application/header-element-id', slotId);
    e.dataTransfer.effectAllowed = 'move';
    headerDragSlotId.current = slotId;
    setLocalHeaderDrag(true); // React 18 自动批处理，handler 结束后才重渲染
    setDraggingWidget(true);
    setDraggingHeaderEl(true);

    const sourceEl = e.currentTarget as HTMLElement;
    dragSourceEl.current = sourceEl;
    const rect = sourceEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // 先克隆再隐藏，避免继承 visibility:hidden
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    // ★ 追加而非覆盖 className：保留 overflow-hidden / flex 等布局 class，
    //   否则克隆体内部布局崩坏、内容溢出固定尺寸之外（视觉"大一圈"）
    clone.className = (sourceEl.className + ' hugescreen-drag-clone').trim();
    clone.style.position = 'fixed';
    clone.style.left = (e.clientX - offsetX) + 'px';
    clone.style.top = (e.clientY - offsetY) + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '10000';
    clone.style.opacity = '0.92';
    document.body.appendChild(clone);
    dragCloneEl.current = clone;
    dragCloneOffset.current = { x: offsetX, y: offsetY };
    dragDidMove.current = false;

    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    // 先移除鬼影再隐藏源元素（与一般组件拿起来效果一致）
    requestAnimationFrame(() => {
      ghost.remove();
      sourceEl.style.visibility = 'hidden';
    });

    const onDocDragOver = (de: DragEvent) => {
      if (!dragCloneEl.current) return;
      dragCloneEl.current.style.left = (de.clientX - dragCloneOffset.current.x) + 'px';
      dragCloneEl.current.style.top = (de.clientY - dragCloneOffset.current.y) + 'px';
      dragDidMove.current = true;
    };
    document.addEventListener('dragover', onDocDragOver, true);
    dragCleanup.current = () => document.removeEventListener('dragover', onDocDragOver, true);

    // 原生 dragend 兜底
    const onNativeDragEnd = () => {
      document.removeEventListener('dragend', onNativeDragEnd);
      // ★ 先执行待定的交换（兜底：React onDragEnd 未触发时由原生事件处理）
      if (pendingHeaderSwap.current) {
        const { fromId, toId } = pendingHeaderSwap.current;
        pendingHeaderSwap.current = null;
        swapHeaderSlots(fromId, toId);
      }
      doDragCleanup();
      // 兜底：确保源槽位可见（避免 React 重建 DOM 后 dragSourceEl ref 失效）
      if (headerDragSlotId.current) {
        const el = document.getElementById(`header-slot-${headerDragSlotId.current}`);
        if (el) el.style.visibility = 'visible';
        headerDragSlotId.current = null;
      }
      setDraggingWidget(false);
      setDraggingHeaderEl(false);
      setLocalHeaderDrag(false);
      setLocalWidgetDrag(false);
      // 交换预览归位动画
      if (lastHeaderSwapInfo.current) {
        const info = lastHeaderSwapInfo.current;
        setTimeout(() => { if (lastHeaderSwapInfo.current === info) lastHeaderSwapInfo.current = null; }, 350);
      }
    };
    document.addEventListener('dragend', onNativeDragEnd);
  }, [isEditing, setDraggingWidget, setDraggingHeaderEl, swapHeaderSlots]);

  const handleHeaderElDragEnd = useCallback((_e: React.DragEvent, slotId: string) => {
    setHeaderSwapPreview(null);
    if (lastHeaderSwapInfo.current) {
      const info = lastHeaderSwapInfo.current;
      setTimeout(() => { if (lastHeaderSwapInfo.current === info) lastHeaderSwapInfo.current = null; }, 350);
    }
    // ★ 先执行待定的交换（在 dragend 中做 state 更新，避免干扰浏览器事件）
    try {
      if (pendingHeaderSwap.current) {
        const { fromId, toId } = pendingHeaderSwap.current;
        pendingHeaderSwap.current = null;
        swapHeaderSlots(fromId, toId);
      }
    } finally {
      doDragCleanup();
      const el = document.getElementById(`header-slot-${slotId}`);
      if (el) el.style.visibility = 'visible';
      headerDragSlotId.current = null;
      setDraggingWidget(false);
      setDraggingHeaderEl(false);
      setLocalHeaderDrag(false);
      setLocalWidgetDrag(false);
    }
    // 顶栏元素仅通过拖入左侧删除区销毁，拖到其他位置松手自动回到原处
  }, [setDraggingWidget, setDraggingHeaderEl, swapHeaderSlots]);

  // ═══════════════════════════════════
  return (
    <div
      ref={canvasRef}
      className="relative"
      style={{ width: activeCanvasW, height: activeCanvasH, backgroundColor: (backgroundPattern === 'globe-2' || backgroundImage || backgroundVideo) ? 'transparent' : '#2C2C34' }}
      onDragOver={isEditing ? handleCanvasDragOver : undefined}
      onDragLeave={isEditing ? handleCanvasDragLeave : undefined}
      onDrop={isEditing ? handleCanvasDrop : undefined}
    >
      {/* ═══ 背景聚光渐变 — HUD 座舱感（宽度对齐顶栏） ═══ */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: 0, top: 0, width: activeCanvasW, height: activeCanvasH,
          background: [
            'radial-gradient(ellipse 100% 22% at 50% 0%, #15151A 0%, #1A1A20 35%, #222228 65%, transparent 85%)',
            'radial-gradient(ellipse 100% 10% at 50% 100%, #15151A 0%, #1A1A20 50%, #222228 80%, transparent 100%)',
          ].join(', '),
        }}
      />
{/* ═══ 自定义背景图片/视频 ═══ */}
      {backgroundImage && (
        <img src={backgroundImage} alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      )}
      {backgroundVideo && (
        <video src={backgroundVideo} autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      )}
{/* ═══ 3D 赛博地球（俯视）════ */}
      {backgroundPattern === 'globe-1' && !backgroundImage && !backgroundVideo && (
        <Suspense fallback={null}>
          <CyberGlobe canvasW={activeCanvasW} canvasH={activeCanvasH} variant="top-down" />
        </Suspense>
      )}
      {backgroundPattern === 'globe-3' && !backgroundImage && !backgroundVideo && (
        <Suspense fallback={null}>
          <CyberSphere canvasW={activeCanvasW} canvasH={activeCanvasH} />
        </Suspense>
      )}
      {/* 地球-2（斜平视角）已移至 MainScreen 视口级渲染，不受画布缩放/偏移影响 */}
      {/* ═══ 能量脉冲动线 ═══ */}
      {backgroundEffect === 'energy-flow' && (
        <EnergyFlow canvasW={activeCanvasW} canvasH={activeCanvasH} mobile={isNarrowHeader} />
      )}
      {backgroundEffect === 'low-poly' && (
        <LowPolyBg canvasW={activeCanvasW} canvasH={activeCanvasH} />
      )}
      {isEditing && (
        <GridOverlay
          grid={{ ...grid, rows: effectiveRows }}
          canvasWidth={activeCanvasW}
          canvasHeight={activeCanvasH}
          headerBottom={headerBottom}
        />
      )}

      {/* ═══ 固定顶栏 ═══ */}
      {header?.visible !== false && (
      <>
      <div
        className="absolute z-30"
        style={{
          left: headerPx.left, top: headerPx.top, width: headerPx.width, height: headerPx.height,
          // 顶栏整体选中：琥珀橙外框（与组件选中一致）
          outline: isEditing && headerSelected ? '2px solid #FF8C42' : 'none',
          outlineOffset: 2,
        }}
        onClick={e => { if (isEditing) { e.stopPropagation(); selectHeaderSlot(null); setHeaderSelected(true); } }}
        onDragOver={isEditing ? handleHeaderDragOver : undefined}
        onDragLeave={() => {
          setHeaderDragIdx(null); setHeaderBlockedIdx(null); setWidgetOverHeader(false);
          if (headerSwapPreview) {
            lastHeaderSwapInfo.current = headerSwapPreview;
            setTimeout(() => { lastHeaderSwapInfo.current = null; }, 350);
          }
          setHeaderSwapPreview(null);
        }}
        onDrop={isEditing ? handleHeaderDrop : undefined}
      >
        <div className={`${isNarrowHeader ? 'flex-col' : 'flex'} h-full relative`} style={{ gap: activeGrid.gap }}>

          {/* 拖拽一般组件时顶栏虚化红框提示 */}
          {showWidgetSlotsHint && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
              style={{
                backgroundColor: widgetOverHeader ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.06)',
                boxShadow: widgetOverHeader
                  ? 'inset 0 0 0 2px rgba(248,113,113,0.6)'
                  : 'inset 0 0 0 2px rgba(248,113,113,0.35)',
                backdropFilter: widgetOverHeader ? 'blur(4px)' : 'blur(3px)',
                transition: 'all 200ms',
              }}
            >
              <span className="font-bold tracking-wide" style={{
                color: widgetOverHeader ? 'rgba(248,113,113,0.9)' : 'rgba(248,113,113,0.65)',
                fontSize: widgetOverHeader ? 14 : 12,
                transition: 'all 200ms',
              }}>不可拖拽至此处</span>
            </div>
          )}

          {/* ═══ 拖拽顶栏组件时顶栏蓝框提示 ═══ */}
          {showHeaderDragHint && !showWidgetSlotsHint && (
            <div className="absolute inset-0 z-30 pointer-events-none" style={{
              boxShadow: 'inset 0 0 0 2px rgba(0,212,255,0.55)',
              backgroundColor: 'rgba(0,212,255,0.04)',
              transition: 'all 200ms',
            }} />
          )}

          {/* ═══ 交换预览：目标内容"挤"到源位置（卡片动画） ═══ */}
          {(headerSwapPreview || lastHeaderSwapInfo.current) && (() => {
            const info = headerSwapPreview || lastHeaderSwapInfo.current;
            if (!info) return null;
            const targetSlot = header.slots.find(s => s.id === info.targetSlotId);
            const sourcePx = headerSlotPixels.find(p => p.id === info.sourceSlotId);
            if (!targetSlot?.elementType || !sourcePx) return null;
            const targetDef = headerElementRegistry.get(targetSlot.elementType);
            const TargetComp = targetDef?.component as React.ComponentType<any> | undefined;
            if (!TargetComp) return null;
            const isActive = !!headerSwapPreview;
            return (
              <div
                className={`absolute z-40 pointer-events-none ${isActive ? 'animate-headerSqueezeIn' : ''}`}
                style={{
                  left: sourcePx.left - headerPx.left,
                  top: 0,
                  width: sourcePx.width,
                  height: sourcePx.height,
                  transition: 'left 300ms ease-out, top 300ms ease-out, width 300ms ease-out, height 300ms ease-out, opacity 200ms ease-out',
                  opacity: isActive ? 1 : 0,
                }}
              >
                <TargetComp {...(targetDef?.defaultConfig ?? {})} {...(targetSlot.options as object)} />
              </div>
            );
          })()}

          {header.slots.map((slot, idx) => {
            const px = headerSlotPixels.find(p => p.id === slot.id);
            const elDef = slot.elementType ? headerElementRegistry.get(slot.elementType) : undefined;
            const ElComp = elDef?.component as React.ComponentType<any> | undefined;
            const isHeaderSwapTarget = headerSwapPreview?.targetSlotId === slot.id;
            return (
              <div
                key={slot.id}
                id={`header-slot-${slot.id}`}
                draggable={isEditing && !!slot.elementType}
                className={`relative overflow-hidden ${isEditing ? 'cursor-pointer' : ''} ${isNarrowHeader ? 'flex-shrink-0' : ''}`}
                style={{
                  width: isNarrowHeader ? '100%' : px?.width,
                  height: px?.height,
                  outline: isEditing && selectedHeaderSlotId === slot.id
                    ? '1px solid rgba(0,212,255,0.7)' : 'none',
                  outlineOffset: -1,
                  boxShadow: (effectiveHeaderDrag || headerDragHint) && !isHeaderSwapTarget && slot.id !== headerDragSlotId.current
                    ? 'inset 0 0 0 1px rgba(0,212,255,0.2)' : 'none',
                  transition: 'box-shadow 150ms',
                }}
                onClick={e => { if (isEditing) { e.stopPropagation(); selectHeaderSlot(slot.id); setHeaderSelected(true); } }}
                onDragStart={e => { if (slot.elementType) handleHeaderElDragStart(e, slot.id); }}
                onDragEnd={e => handleHeaderElDragEnd(e, slot.id)}
              >
                {/* 交换目标：荧光蓝边框 */}
                {isHeaderSwapTarget && (
                  <div className="absolute inset-0 z-30 pointer-events-none" style={{
                    border: '2px solid rgba(0,212,255,0.6)',
                    boxShadow: '0 0 16px rgba(0,212,255,0.35), inset 0 0 8px rgba(0,212,255,0.1)',
                    borderRadius: 4,
                  }} />
                )}
                <div className="h-full" style={{
                  position: 'relative',
                  zIndex: 1,
                  opacity: isHeaderSwapTarget ? 0 : 1,
                  transition: 'opacity 200ms ease-out',
                }}>
                  {ElComp ? (
                    <ElComp {...(elDef!.defaultConfig ?? {})} {...(slot.options as object)} compact={isNarrowHeader} />
                  ) : isEditing ? (
                    <div className={`h-full mx-0.5 rounded border transition-colors ${
                      headerBlockedIdx === idx
                        ? 'border-[rgba(248,113,113,0.55)] border-2 bg-negative/8 border-solid'
                        : headerDragIdx === idx
                          ? 'border-accent-cool/50 bg-accent-cool/5 border-dashed'
                          : 'border-[rgba(255,255,255,0.06)] border-dashed'
                    }`}>
                      <div className="flex items-center justify-center h-full">
                        <span className={`text-[10px] tracking-wider select-none ${
                          headerBlockedIdx === idx ? 'text-negative/70 font-medium' : 'text-textSecondary/25'
                        }`}>
                          {headerBlockedIdx === idx ? '需要右侧空间' : '拖入顶栏组件'}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* ═══ 顶栏边框 ═══ */}
                {slot.elementType && ((slot.options as Record<string, unknown>).borderStyle as string)
                  && (slot.options as Record<string, unknown>).borderStyle !== 'none'
                  && px && (
                  (slot.options as Record<string, unknown>).borderStyle === 'header-custom'
                    && (slot.options as Record<string, unknown>).customBorderImage ? (
                    <img
                      src={String((slot.options as Record<string, unknown>).customBorderImage)}
                      alt="自定义边框"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ objectFit: 'fill', zIndex: 0 }}
                      draggable={false}
                    />
                  ) : (
                    <HeaderBorder1 width={px.width} height={px.height} />
                  )
                )}

                {isEditing && slot.elementType && !isHeaderSwapTarget && (
                  <button
                    className="absolute top-0.5 right-0.5 z-20 w-4 h-4 flex items-center justify-center
                      rounded-full bg-surface-base/80 text-textSecondary/40 hover:text-negative hover:bg-surface-hover
                      transition-colors text-[10px] leading-none"
                    onClick={e => { e.stopPropagation(); removeHeaderElement(slot.id); }}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ 顶栏 resize 手柄（选中顶栏时南边拖拽调节高度，0.5 行步进） ═══ */}
      {isEditing && headerSelected && (
        <HeaderResizeHandle
          headerPx={headerPx}
          cellH={cellH}
          gap={activeGrid.gap}
          rowSpan={dynamicHRows}
          canvasWidth={activeCanvasW}
          canvasHeight={activeCanvasH}
          canvasRef={canvasRef}
          onCommit={setHeaderRowSpan}
        />
      )}

      {/* ═══ 顶栏元素拖入主区块 → 虚化红框 ═══ */}
      {showHeaderDragHint && (
        <div
          className="absolute z-30 pointer-events-none flex items-center justify-center"
          style={{
            top: headerBottom, left: 0, right: 0, bottom: 0,
            backgroundColor: headerOverWidget ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.06)',
            boxShadow: headerOverWidget
              ? 'inset 0 0 0 2px rgba(248,113,113,0.6)'
              : 'inset 0 0 0 2px rgba(248,113,113,0.35)',
            backdropFilter: headerOverWidget ? 'blur(4px)' : 'blur(3px)',
            transition: 'all 200ms',
          }}
        >
          <span className="font-bold tracking-wide" style={{
            color: headerOverWidget ? 'rgba(248,113,113,0.9)' : 'rgba(248,113,113,0.65)',
            fontSize: headerOverWidget ? 14 : 12,
            transition: 'all 200ms',
          }}>不可拖拽至此处</span>
        </div>
      )}
      </>)}

      {/* ═══ 拖拽已有组件 → 主体区域蓝框提示 ═══ */}
      {showWidgetSlotsHint && (
        <div
          className="absolute z-25 pointer-events-none"
          style={{
            top: headerBottom, left: 0, right: 0, bottom: 0,
            boxShadow: 'inset 0 0 0 2px rgba(0,212,255,0.6)',
            backgroundColor: 'rgba(0,212,255,0.04)',
            borderRadius: 6,
          }}
        />
      )}

      {/* ═══ 拖入预览（自由网格：layout 即最终放置位置，可能已被避让） ═══ */}
      {isEditing && dropPreview && (
        <div
          className="absolute pointer-events-none z-40"
          style={{
            ...slotToPx(
              header?.visible === false
                ? { ...dropPreview.layout, row: Math.max(0, dropPreview.layout.row - headerRowSpan) }
                : dropPreview.layout,
              cellW, cellH, grid.gap
            ),
            backgroundColor: 'rgba(0,212,255,0.12)',
            border: '2px solid rgba(0,212,255,0.6)',
            boxShadow: '0 0 16px rgba(0,212,255,0.35), inset 0 0 8px rgba(0,212,255,0.1)',
            borderRadius: 4,
          }}
        />
      )}


      {/* ═══ 组件 ═══ */}
      {visibleWidgets.map(widget => {
        // 交换预览：被"挤"走的组件渲染在原位置
        const isSwapTarget = dragSwap?.targetWidgetId === widget.id;
        const px = isSwapTarget
          ? slotToPx(
              header?.visible === false
                ? { ...dragSwap.originSlot, row: Math.max(0, dragSwap.originSlot.row - headerRowSpan) }
                : dragSwap.originSlot,
              cellW, cellH, grid.gap)
          : positionsMap.get(widget.id);
        if (!px) return null;
        const def = widgetRegistry.get(widget.type);
        const Comp = def?.component;
        const isSelected = widget.id === selectedWidgetId;
        const hasBorder = !!widget.style.borderStyle && widget.style.borderStyle !== 'none';
        const borderOutset = 12; // 边框向外溢出 px（利用网格间距容纳边框）

        return (
          <Fragment key={widget.id}>
          <div
            id={`widget-${widget.id}`}
            draggable={isEditing}
            className={`absolute overflow-hidden flex flex-col
              ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}
              ${!isEditing ? 'z-10' : 'z-0'}
            `}
            style={{
              left: px.left, top: px.top, width: px.width, height: px.height,
              backgroundColor: widget.style.backgroundColor || 'rgba(30, 30, 36, 0.72)',
              borderColor: isEditing ? (isSelected ? '#FF8C42' : 'rgba(255,255,255,0.12)') : 'transparent',
              borderWidth: isEditing ? (isSelected ? 2 : 1) : 0,
              borderStyle: isEditing ? (isSelected ? 'solid' : 'dashed') : 'solid',
              borderRadius: isEditing ? 4 : 0,
              boxShadow: !hasBorder && effectiveWidgetDrag && !effectiveHeaderDrag && !isSwapTarget && widget.id !== draggingWidgetId.current
                ? 'inset 0 0 0 1px rgba(0,212,255,0.2)' : 'none',
              transition: isSwapTarget || lastSwapTargetId.current === widget.id
                ? 'left 300ms ease-out, top 300ms ease-out, width 300ms ease-out, height 300ms ease-out, box-shadow 150ms'
                : 'box-shadow 150ms',
            }}
            onClick={e => { if (isEditing) { e.stopPropagation(); selectWidget(widget.id); setHeaderSelected(false); } }}
            onDragStart={e => handleWidgetDragStart(e, widget.id)}
            onDragEnd={e => handleWidgetDragEnd(e, widget.id)}
          >
            {!isEditing && <CornerAccent />}
            {isEditing && isSelected && (
              <>
                {/* 选中光环 */}
                <div className="absolute inset-0 ring-2 ring-accent-warm pointer-events-none z-20 rounded-[3px] animate-selectionPulse"
                  style={{ boxShadow: '0 0 16px rgba(255,140,66,0.45), inset 0 0 16px rgba(255,140,66,0.10)' }} />
                {/* 四角标记 */}
                <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-accent-warm pointer-events-none z-20 rounded-tl-sm" style={{ margin: -1 }} />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-accent-warm pointer-events-none z-20 rounded-tr-sm" style={{ margin: -1 }} />
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-accent-warm pointer-events-none z-20 rounded-bl-sm" style={{ margin: -1 }} />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-accent-warm pointer-events-none z-20 rounded-br-sm" style={{ margin: -1 }} />
              </>
            )}

            {/* ═══ 标准化标题区块 ═══ */}
            <WidgetTitleBar
              primary={widget.style.title?.primary}
              secondary={widget.style.title?.secondary}
              isEditing={isEditing}
              accentColor={theme.colors.primary}
            />

            <div className="flex-1 min-h-0 w-full">
              {Comp ? (
                <Suspense fallback={<div className="flex items-center justify-center h-full text-textSecondary/20 text-xs">...</div>}>
                  <WidgetBody widget={widget} Comp={Comp} defaultConfig={def?.defaultConfig ?? {}} compact={isNarrowHeader} isEditing={isEditing} />
                </Suspense>
              ) : (
                <div className="flex items-center justify-center h-full text-textSecondary/20 text-xs">{widget.displayName}</div>
              )}
            </div>

            {isEditing && (
              <>
                <div className="absolute bottom-1 right-1 z-10">
                  <span className="text-[9px] text-textSecondary/30 font-mono bg-surface-base/80 px-1 rounded">{widget.type}</span>
                </div>
                <button
                  className="absolute top-1 right-1 z-20 w-5 h-5 flex items-center justify-center
                    rounded-full bg-surface-base/80 text-textSecondary/40 hover:text-negative hover:bg-surface-hover
                    transition-colors text-xs leading-none"
                  onClick={e => { e.stopPropagation(); removeWidget(widget.id); }}
                >×</button>
              </>
            )}
          </div>
          {/* ═══ 边框装饰层 — 独立图层，不被组件 overflow-hidden 裁剪 ═══ */}
          {hasBorder && (
            <BorderFrame
              borderStyle={widget.style.borderStyle!}
              customBorderImage={widget.style.customBorderImage}
              left={px.left - borderOutset}
              top={px.top - borderOutset}
              width={px.width + borderOutset * 2}
              height={px.height + borderOutset * 2}
              isSelected={isSelected}
            />
          )}
          {/* ═══ Resize 手柄（自由网格：选中时 8 方向拉伸） ═══ */}
          {isEditing && isSelected && (
            <ResizeHandles
              widget={widget}
              px={px}
              grid={activeGrid}
              cellW={cellW}
              cellH={cellH}
              canvasWidth={activeCanvasW}
              canvasHeight={activeCanvasH}
              others={visibleWidgets.filter((w) => w.id !== widget.id)}
              canvasRef={canvasRef}
              onCommit={(layout) => resizeWidget(widget.id, layout)}
              headerHidden={header?.visible === false}
              headerRowSpan={headerRowSpan}
              rowMin={widgetRowMin}
            />
          )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── 顶栏 resize 手柄（选中顶栏时南边拖拽调节高度，0.5 行步进细微调节） ───

function HeaderResizeHandle({
  headerPx, cellH, gap, rowSpan, canvasWidth, canvasHeight, canvasRef, onCommit,
}: {
  headerPx: { left: number; top: number; width: number; height: number };
  cellH: number;
  gap: number;
  rowSpan: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasRef: React.RefObject<HTMLDivElement>;
  onCommit: (span: number) => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startSpan: number } | null>(null);

  const designAt = (clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvasWidth / rect.width),
      y: (clientY - rect.top) * (canvasHeight / rect.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = designAt(e.clientX, e.clientY);
    dragRef.current = { startY: start.y, startSpan: rowSpan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setPreview(rowSpan);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const d = designAt(e.clientX, e.clientY);
    // 连续换算 + 四舍五入到 0.5 行 → 细微调节
    const dyCells = (d.y - drag.startY) / (cellH + gap);
    const span = Math.max(0.5, Math.min(10, Math.round((drag.startSpan + dyCells) * 2) / 2));
    setPreview(span);
  };

  const endResize = (commit: boolean) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (commit && preview !== null) onCommit(preview);
    setPreview(null);
  };

  return (
    <>
      {/* 幽灵预览：目标高度的顶栏虚线框 + 行数提示 */}
      {preview !== null && (
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 45,
            left: headerPx.left,
            top: headerPx.top,
            width: headerPx.width,
            height: preview * cellH + (preview - 1) * gap,
            backgroundColor: 'rgba(255,140,66,0.08)',
            border: '2px dashed rgba(255,140,66,0.75)',
            boxShadow: '0 0 14px rgba(255,140,66,0.3)',
            borderRadius: 4,
          }}
        >
          <span
            className="absolute top-1 right-2 text-[10px] font-mono"
            style={{ color: 'rgba(255,140,66,0.95)' }}
          >
            {preview} 行
          </span>
        </div>
      )}
      {/* 手柄：顶栏底边中点，命中区 20×16 */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          zIndex: 45,
          left: headerPx.left + headerPx.width / 2 - 10,
          top: headerPx.top + headerPx.height - 8,
          width: 20,
          height: 16,
          cursor: 'ns-resize',
          pointerEvents: 'auto',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endResize(true)}
        onPointerCancel={() => endResize(false)}
      >
        <div
          className="w-2 h-2 rounded-sm bg-[#FF8C42] border border-[#FF8C42]/50"
          style={{ boxShadow: '0 0 6px rgba(255,140,66,0.6)' }}
        />
      </div>
    </>
  );
}

// ─── Resize 手柄（自由网格：选中组件 8 方向拉伸） ───

/**
 * 手柄命中区（比视觉方块大得多，鼠标易命中）：
 * 角 = 20×20 外扩 10px；边 = 16px 厚居中。
 * 内部视觉方块 8px 居中显示。
 */
const HANDLE_POSITIONS: { handle: ResizeHandle; style: React.CSSProperties }[] = [
  { handle: 'nw', style: { top: -10, left: -10, cursor: 'nwse-resize' } },
  { handle: 'n',  style: { top: -8, left: '50%', marginLeft: -10, width: 20, height: 16, cursor: 'ns-resize' } },
  { handle: 'ne', style: { top: -10, right: -10, cursor: 'nesw-resize' } },
  { handle: 'e',  style: { top: '50%', right: -10, marginTop: -10, width: 16, height: 20, cursor: 'ew-resize' } },
  { handle: 'se', style: { bottom: -10, right: -10, cursor: 'nwse-resize' } },
  { handle: 's',  style: { bottom: -8, left: '50%', marginLeft: -10, width: 20, height: 16, cursor: 'ns-resize' } },
  { handle: 'sw', style: { bottom: -10, left: -10, cursor: 'nesw-resize' } },
  { handle: 'w',  style: { top: '50%', left: -10, marginTop: -10, width: 16, height: 20, cursor: 'ew-resize' } },
];

/**
 * R4：resize 预览期贴边 —— 与不可截断障碍（默认尺寸组件）重叠时，
 * 沿手柄方向把 candidate 贴到障碍边界（横纵轴独立计算）。
 */
function clampAgainstObstacles(
  candidate: WidgetLayout,
  handle: ResizeHandle,
  others: WidgetConfig[],
  grid: GridConfig,
  rowMin = 1,
): WidgetLayout {
  let { col, row, colSpan, rowSpan } = candidate;
  for (const o of others) {
    if (isTruncatable(o)) continue; // 可截断障碍放行，提交时由 reflow 截断
    const ob = o.layout;
    const overlaps =
      col < ob.col + ob.colSpan && col + colSpan > ob.col &&
      row < ob.row + ob.rowSpan && row + rowSpan > ob.row;
    if (!overlaps) continue;
    // 横轴：'e' 贴障碍左缘；'w' 贴障碍右缘（右边界锚定）
    if (handle.includes('e')) {
      colSpan = Math.min(colSpan, ob.col - col);
    } else if (handle.includes('w')) {
      const right = col + colSpan;
      col = Math.max(col, ob.col + ob.colSpan);
      colSpan = right - col;
    }
    // 纵轴：'s' 贴障碍上缘；'n' 贴障碍下缘（下边界锚定）
    if (handle.includes('s')) {
      rowSpan = Math.min(rowSpan, ob.row - row);
    } else if (handle.includes('n')) {
      const bottom = row + rowSpan;
      row = Math.max(row, ob.row + ob.rowSpan);
      rowSpan = bottom - row;
    }
  }
  return clampToGrid({ col, row, colSpan, rowSpan }, grid,
    undefined, { colSpan: grid.cols, rowSpan: grid.rows }, rowMin);
}

function ResizeHandles({
  widget, px, grid, cellW, cellH, canvasWidth, canvasHeight, others, canvasRef, onCommit, headerHidden = false, headerRowSpan = 1, rowMin = 1,
}: {
  widget: WidgetConfig;
  px: { left: number; top: number; width: number; height: number };
  grid: GridConfig;
  cellW: number;
  cellH: number;
  canvasWidth: number;
  canvasHeight: number;
  others: WidgetConfig[];
  canvasRef: React.RefObject<HTMLDivElement>;
  onCommit: (layout: WidgetLayout) => void;
  /** 顶栏隐藏：渲染行向上平移 headerRowSpan，rowMin 为 0（可占 row 0） */
  headerHidden?: boolean;
  /** 顶栏行数（可见时组件起始行，用于预览平移） */
  headerRowSpan?: number;
  /** 组件行下限（= ceil(顶栏行数)，0.5 行顶栏时取整防重叠） */
  rowMin?: number;
}) {
  const [preview, setPreview] = useState<WidgetLayout | null>(null);
  const dragRef = useRef<{
    handle: ResizeHandle;
    startLayout: WidgetLayout;
    startX: number;
    startY: number;
    obstacles: WidgetConfig[];
  } | null>(null);

  const designAt = (clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvasWidth / rect.width),
      y: (clientY - rect.top) * (canvasHeight / rect.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent, handle: ResizeHandle) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = designAt(e.clientX, e.clientY);
    dragRef.current = {
      handle,
      startLayout: widget.layout,
      startX: start.x,
      startY: start.y,
      // 快照障碍（pointerdown 时捕获，避免拖拽中布局抖动）
      obstacles: others.filter((o) => !isTruncatable(o)),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setPreview(widget.layout);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const d = designAt(e.clientX, e.clientY);
    const dxCells = Math.round((d.x - drag.startX) / (cellW + grid.gap));
    const dyCells = Math.round((d.y - drag.startY) / (cellH + grid.gap));
    const def = widgetRegistry.get(widget.type);
    let candidate = resizeCellFromHandle(
      drag.startLayout, drag.handle, dxCells, dyCells, grid,
      def?.minSize ?? { colSpan: 1, rowSpan: 1 },
      def?.maxSize ?? { colSpan: grid.cols, rowSpan: grid.rows },
      // 顶栏隐藏时可占 row 0
      headerHidden ? 0 : rowMin,
    );
    candidate = clampAgainstObstacles(candidate, drag.handle, drag.obstacles, grid, headerHidden ? 0 : rowMin);
    setPreview(candidate);
  };

  const endResize = (commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (commit && preview) onCommit(preview);
    setPreview(null);
  };

  return (
    <>
      {/* 幽灵预览：组件本体不动，仅提交时落库（顶栏隐藏时行向上平移与组件渲染一致） */}
      {preview && (
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 45,
            ...slotToPx(
              headerHidden
                ? { ...preview, row: Math.max(0, preview.row - headerRowSpan) }
                : preview,
              cellW, cellH, grid.gap
            ),
            backgroundColor: 'rgba(255,140,66,0.10)',
            border: '2px solid rgba(255,140,66,0.65)',
            boxShadow: '0 0 14px rgba(255,140,66,0.35)',
            borderRadius: 4,
          }}
        />
      )}
      {/* 手柄覆盖层（widget div 的兄弟，避开 overflow-hidden 裁剪） */}
      <div
        className="absolute"
        style={{ zIndex: 45, left: px.left, top: px.top, width: px.width, height: px.height, pointerEvents: 'none' }}
      >
        {HANDLE_POSITIONS.map(({ handle, style }) => (
          <div
            key={handle}
            className="absolute flex items-center justify-center"
            style={{ ...style, pointerEvents: 'auto', touchAction: 'none' }}
            onPointerDown={(e) => onPointerDown(e, handle)}
            onPointerMove={onPointerMove}
            onPointerUp={() => endResize(true)}
            onPointerCancel={() => endResize(false)}
          >
            {/* 视觉方块：8px 居中，命中区远大于视觉 */}
            <div className="w-2 h-2 rounded-sm bg-accent-warm border border-black/40"
              style={{ boxShadow: '0 0 6px rgba(255,140,66,0.8)' }} />
          </div>
        ))}
      </div>
    </>
  );
}

// ─── 网格覆盖层（编辑模式可视化网格 + 吸附参照） ───
// 颜色遵循设计系统「电光蓝弱 rgba(0,212,255,0.12) 网格线」；
// 顶栏区域（headerBottom 之上，组件不可放置）线更淡以示区分。
function GridOverlay({ grid, canvasWidth, canvasHeight, headerBottom = 0 }: {
  grid: { cols: number; rows: number; gap: number };
  canvasWidth: number;
  canvasHeight: number;
  headerBottom?: number;
}) {
  const lines = useMemo(() => {
    const { cellW, cellH } = cellMetrics(canvasWidth, canvasHeight, grid.gap, grid.cols, grid.rows);
    const cols: number[] = [], rows: number[] = [];
    for (let i = 0; i <= grid.cols; i++) cols.push(grid.gap + i * (cellW + grid.gap));
    for (let i = 0; i <= grid.rows; i++) rows.push(grid.gap + i * (cellH + grid.gap));
    return { cols, rows };
  }, [grid, canvasWidth, canvasHeight]);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
      {lines.cols.map(x => (
        <g key={`c-${x}`}>
          <line x1={x} y1={0} x2={x} y2={headerBottom} stroke="rgba(0,212,255,0.05)" strokeWidth={1} />
          <line x1={x} y1={headerBottom} x2={x} y2={canvasHeight} stroke="rgba(0,212,255,0.12)" strokeWidth={1} />
        </g>
      ))}
      {lines.rows.map(y => (
        <g key={`r-${y}`}>
          <line x1={0} y1={y} x2={canvasWidth} y2={y} stroke={y <= headerBottom ? 'rgba(0,212,255,0.05)' : 'rgba(0,212,255,0.12)'} strokeWidth={1} />
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════
// 标准化标题区块
// ═══════════════════════════════════════════

interface WidgetTitleBarProps {
  primary?: { text: string };
  secondary?: { text: string };
  isEditing: boolean;
  accentColor: string;
}

function WidgetTitleBar({ primary, secondary, isEditing, accentColor }: WidgetTitleBarProps) {
  const hasPrimary = !!primary?.text;
  const hasSecondary = !!secondary?.text;
  const hasAny = hasPrimary || hasSecondary;

  // 没有任何标题 → 不占用空间
  if (!hasAny) return null;

  const both = hasPrimary && hasSecondary;

  return (
    <div
      className="flex items-center flex-shrink-0 z-10 relative"
      style={{
        height: both ? 44 : hasPrimary ? 32 : 24,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      {/* 渐变飘带底衬 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to right, ${accentColor}22 0%, ${accentColor}08 55%, transparent 100%)`,
        }}
      />
      {/* 左侧强调色条 */}
      <div
        className="rounded-full flex-shrink-0"
        style={{
          width: 2,
          height: both ? 24 : hasPrimary ? 16 : 12,
          backgroundColor: accentColor,
          marginRight: 8,
        }}
      />

      {/* 标题文字 */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        {hasPrimary && (
          <span
            className="text-white font-semibold tracking-wide truncate leading-tight"
            style={{ fontSize: both ? 12 : 13 }}
          >
            {primary!.text}
          </span>
        )}
        {hasSecondary && (
          <span
            className="text-textSecondary/60 tracking-wide truncate leading-tight"
            style={{ fontSize: both ? 10 : 11, marginTop: both ? 1 : 0 }}
          >
            {secondary!.text}
          </span>
        )}
      </div>

    </div>
  );
}

// ─── HUD 角标 ───
function CornerAccent() {
  const alpha = 0.12;
  const size = 10;
  const corners = [
    { style: { top: 2, left: 2, borderTop: 1, borderLeft: 1 } },
    { style: { top: 2, right: 2, borderTop: 1, borderRight: 1 } },
    { style: { bottom: 2, left: 2, borderBottom: 1, borderLeft: 1 } },
    { style: { bottom: 2, right: 2, borderBottom: 1, borderRight: 1 } },
  ] as const;
  return (
    <>
      {corners.map((c, i) => (
        <div key={i} className="absolute pointer-events-none" style={{
          ...c.style, width: size, height: size,
          borderColor: `rgba(0,212,255,${alpha})`, borderStyle: 'solid',
        }} />
      ))}
    </>
  );
}
