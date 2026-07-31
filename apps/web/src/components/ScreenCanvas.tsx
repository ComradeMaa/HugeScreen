import { Suspense, lazy, useMemo, useRef, useState, useCallback, useEffect, Fragment } from 'react';
import { useEditorStore } from '../store/editorStore';
import { CANONICAL_SLOTS, CENTER_SLOT, findSlotAt } from '../store/defaultLayout';
import { widgetRegistry, layoutEngine } from '@hugescreen/core';
import { headerElementRegistry } from '@hugescreen/widgets';
import type { WidgetConfig } from '@hugescreen/shared';
import { useWidgetData } from '../hooks/useWidgetData';
import { EnergyFlow } from './EnergyFlow';
import { LowPolyBg } from './LowPolyBg';
import { CyberSphere } from './CyberSphere';
import { BorderFrame, HeaderBorder1 } from '@hugescreen/widgets/borders';
// 动态加载 CyberGlobe + Three.js，防止模块错误导致整页白屏
const CyberGlobe = lazy(() => import('./CyberGlobe').then(m => ({ default: m.CyberGlobe })));

/** 组件主体：注入实时数据（liveProps 以最高优先级覆盖静态默认值与用户配置）。
 *  当 liveProps 有内容时，自动把数据字段同步回 widget.options，保证属性面板显示最新数据。 */
function WidgetBody({ widget, Comp, defaultConfig, compact }: {
  widget: WidgetConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Comp: any;
  defaultConfig: Record<string, unknown>;
  compact?: boolean;
}) {
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const pinEditWidgetId = useEditorStore((s) => s.pinEditWidgetId);
  const liveProps = useWidgetData(widget);

  // 当 REST 数据到达时，无条件回写数据字段到 widget.options
  // ★ static 数据源不需要同步——options 本身就是真源
  useEffect(() => {
    if (!liveProps || Object.keys(liveProps).length === 0) return;
    if (widget.dataSource?.type === 'static') return;
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
  }, [liveProps, widget.id, widget.type]);

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
  return <Comp {...defaultConfig} {...liveProps} {...(widget.options as object)} compact={compact} widgetId={widget.id} dataSource={widget.dataSource} pinEditMode={pinEditWidgetId === widget.id} onUpdate={stableOnUpdate} />;
}

/** 只保留数据字段，排除外观/开关字段 */
function pickDataFields(props: Record<string, unknown>, chartType: string): Record<string, unknown> {
  const dataKeys: Record<string, string[]> = {
    "pie-chart": ["categories"],
    "line-chart": ["xLabels", "lineSeries"],
    "bar-chart": ["categories"],
    "bar-line-chart": ["xLabels", "mixedSeries"],
    "stat-card": ["title", "value", "suffix", "ringPercent"],
    "text-widget": ["text"],
    "image-widget": ["images"],
    "video-widget": ["videos"],
    "water-pond": ["value"],
  };
  const keys = dataKeys[chartType] ?? Object.keys(props);
  const out: Record<string, unknown> = {};
  for (const k of keys) { if (k in props) out[k] = props[k]; }
  return out;
}

/** 合并新数据时保留已有 per-item 元数据（如 showLabelLine），图片组件追加 API 图片而不覆盖手动上传 */
function mergePreservingMeta(newData: Record<string, unknown>, currentOpts: Record<string, unknown>, chartType: string): Record<string, unknown> {
  const merged = { ...newData };
  // For categories-based charts, preserve showLabelLine from current options
  if ((chartType === "pie-chart" || chartType === "bar-chart") && Array.isArray(newData.categories) && Array.isArray(currentOpts.categories)) {
    const oldCats = currentOpts.categories as Array<Record<string, unknown>>;
    merged.categories = (newData.categories as Array<Record<string, unknown>>).map((item, i) => {
      const oldItem = oldCats[i] as Record<string, unknown> | undefined;
      if (oldItem && oldItem.showLabelLine !== undefined) {
        return { ...item, showLabelLine: oldItem.showLabelLine };
      }
      return item;
    });
  }
  // 图片组件：保留 pinned=true 的图片，替换 pinned=false 的图片为 API 新数据
  if (chartType === "image-widget" && Array.isArray(newData.images)) {
    const rawOld = Array.isArray(currentOpts.images) ? currentOpts.images : [];
    // 向后兼容：旧数据是 string[] → 视为 {url, pinned:true}（不丢失已有图片）
    const oldImages = rawOld.map((e: any) =>
      typeof e === 'string' ? { url: e, pinned: true } : e
    ) as Array<{ url: string; pinned?: boolean }>;
    const pinned = oldImages.filter((e: any) => e?.pinned);
    const pinnedUrls = new Set(pinned.map((p: any) => p.url));
    const newEntries = (newData.images as Array<{ url: string; pinned?: boolean }>).filter(
      (e: any) => !pinnedUrls.has(e.url)
    );
    merged.images = [...pinned, ...newEntries];
  }
  if (chartType === "video-widget" && Array.isArray(newData.videos)) {
    const rawOld = Array.isArray(currentOpts.videos) ? currentOpts.videos : [];
    const oldVideos = rawOld.map((e: any) =>
      typeof e === 'string' ? { url: e, pinned: true } : e
    ) as Array<{ url: string; pinned?: boolean }>;
    const pinned = oldVideos.filter((e: any) => e?.pinned);
    const pinnedUrls = new Set(pinned.map((p: any) => p.url));
    const newEntries = (newData.videos as Array<{ url: string; pinned?: boolean }>).filter(
      (e: any) => !pinnedUrls.has(e.url)
    ).slice(0, 4 - pinned.length); // 最多4个
    merged.videos = [...pinned, ...newEntries];
  }
  return merged;
}



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

function isSlotHardBlocked(
  slot: BlockSlot,
  widgets: WidgetConfig[],
  excludeId?: string,
): boolean {
  return widgets.some((w) => {
    if (w.id === excludeId) return false;
    return layoutEngine.overlaps(
      { col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan },
      slot,
    );
  });
}

/**
 * 检测槽位是否被「不可压缩」的组件阻挡。
 * - 中央大区块（4×6 区域）→ 永远阻挡
 * - 组件占据多个标准槽位（merge 扩大 / swap 后）→ 不阻挡，允许 reflow 截断
 * - 组件处于默认尺寸 → 阻挡
 */
function isSlotBlockedByUnexpanded(
  slot: BlockSlot,
  widgets: WidgetConfig[],
): boolean {
  const blocker = getOverlappingWidget(slot, widgets);
  if (!blocker) return false;

  // 中央大区块 → 永远不可截断
  if (
    layoutEngine.overlaps(
      { col: blocker.layout.col, row: blocker.layout.row, colSpan: blocker.layout.colSpan, rowSpan: blocker.layout.rowSpan },
      CENTER_SLOT,
    )
  ) {
    return true;
  }

  // ★ 检查组件是否占据超过一个标准槽位（merge 扩大 或 swap 后布局跨越多个槽位）
  const canonicalSlot = findSlotAt(blocker.layout.col, blocker.layout.row);
  if (canonicalSlot) {
    const blockerArea = blocker.layout.colSpan * blocker.layout.rowSpan;
    const slotArea = canonicalSlot.colSpan * canonicalSlot.rowSpan;
    // 面积 > 单个标准槽位 → 可分割（无论是否 swap 导致）
    if (blockerArea > slotArea) return false;
  }

  // 检查组件是否被扩大过（超出注册默认尺寸）
  const def = widgetRegistry.get(blocker.type);
  const defColSpan = def?.defaultSize?.colSpan ?? blocker.layout.colSpan;
  const defRowSpan = def?.defaultSize?.rowSpan ?? blocker.layout.rowSpan;
  const isExpanded =
    blocker.layout.colSpan > defColSpan ||
    blocker.layout.rowSpan > defRowSpan;

  // 未扩大 → 阻挡；已扩大 → 放行，由 reflowOnAdd 截断
  return !isExpanded;
}

/** 获取槽位中重叠的组件（不检查大小限制），用于交换检测 */
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
const BASE_HEADER_ROWS = 1;

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
  const { addWidget, moveWidget, swapWidgetLayouts, removeWidget,
    setHeaderSlot, removeHeaderElement, swapHeaderSlots,
    setDraggingWidget, setDraggingHeaderEl, selectWidget, selectHeaderSlot,
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

  type Preview = BlockSlot & { blocked?: boolean; swapping?: boolean };
  const [dropPreview, setDropPreview] = useState<Preview | null>(null);

  // 拖拽交换预览：拖拽已有组件到另一个组件上时，目标组件被"挤"到原位置
  type DragSwap = { targetWidgetId: string; originSlot: BlockSlot; targetSlot: BlockSlot };
  const [dragSwap, setDragSwap] = useState<DragSwap | null>(null);

  const dynamicHRows = header?.visible !== false ? headerRows(activeGrid.cols) : 0;
  const isNarrowHeader = activeGrid.cols <= 2;

  // 顶栏隐藏时，有效行数减 1（row 0 不再被顶栏占用），cellH 自动变大 → 组件拉伸
  const effectiveRows = header?.visible !== false ? activeGrid.rows : activeGrid.rows - BASE_HEADER_ROWS;
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
        ? { ...layout, row: Math.max(0, layout.row - BASE_HEADER_ROWS) }
        : layout;
      return {
        id: w.id,
        ...slotToPx(adjustedLayout, cellW, cellH, activeGrid.gap),
      };
    });
  }, [visibleWidgets, bpLayouts, cellW, cellH, activeGrid.gap]);

  const isCenterEmpty = useMemo(() => {
    return !visibleWidgets.some((w) => {
      const wEndCol = w.layout.col + w.layout.colSpan;
      const wEndRow = w.layout.row + w.layout.rowSpan;
      return (
        w.layout.col < CENTER_SLOT.col + CENTER_SLOT.colSpan &&
        wEndCol > CENTER_SLOT.col &&
        w.layout.row < CENTER_SLOT.row + CENTER_SLOT.rowSpan &&
        wEndRow > CENTER_SLOT.row
      );
    });
  }, [visibleWidgets]);

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
    if (y < headerBottom) { setDropPreview(null); return; }

    const cell = layoutEngine.pixelToCell(x, y, 1, 1, grid, canvas.width, canvas.height);
    const slot = findSlotAt(cell.col, cell.row);
    if (!slot) { setDropPreview(null); return; }

    if (e.dataTransfer.types.includes('application/widget-type')) {
      e.dataTransfer.dropEffect = 'copy';
      setDragSwap(null);
      setDropPreview({ ...slot, blocked: isSlotBlockedByUnexpanded(slot, widgets) });
    } else if (e.dataTransfer.types.includes('application/widget-id')) {
      e.dataTransfer.dropEffect = 'move';
      // ★ 使用 ref 而非 getData()：Chrome 在 dragover 中禁止 getData() 读取自定义类型
      const wid = draggingWidgetId.current;
      if (!wid) { setDragSwap(null); setDropPreview(null); return; }
      const blocker = getOverlappingWidget(slot, widgets, wid);
      const dragged = blocker ? widgets.find((w) => w.id === wid) : null;
      if (blocker && dragged) {
        // 已有组件拖到同类组件上 → 交换预览（不检查大小）
        lastSwapTargetId.current = blocker.id;
        setDragSwap({
          targetWidgetId: blocker.id,
          originSlot: { col: dragged.layout.col, row: dragged.layout.row, colSpan: dragged.layout.colSpan, rowSpan: dragged.layout.rowSpan },
          targetSlot: { ...slot },
        });
        setDropPreview({ ...slot, swapping: true });
        return;
      }
      // 不在这里清 lastSwapTargetId：保留它让组件归位也有动画
      setDragSwap(null);
      setDropPreview({ ...slot, blocked: false });
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
    const slot = findSlotAt(cell.col, cell.row);
    if (!slot) return;

    const wt = e.dataTransfer.getData('application/widget-type');
    if (wt) {
      if (isSlotBlockedByUnexpanded(slot, widgets)) return;
      addWidget(wt, { ...slot });
      return;
    }
    // ★ 优先用 ref（dragover 中 getData 不可用），drop 时 ref 兜底
    const wid = draggingWidgetId.current || e.dataTransfer.getData('application/widget-id');
    if (wid) {
      // 直接在 drop 时检测交换（使用纯重叠检测，不受组件大小限制）
      const blocker = getOverlappingWidget(slot, widgets, wid);
      if (blocker) {
        swapWidgetLayouts(wid, blocker.id);
      } else {
        moveWidget(wid, { ...slot });
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

    // ★ 关键：先克隆再隐藏原组件，避免 clone 继承 visibility:hidden
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.className = 'hugescreen-drag-clone';
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
  }, [isEditing, setDraggingWidget]);

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
    clone.className = 'hugescreen-drag-clone';
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
      {isEditing && <GridOverlay grid={grid} canvasWidth={activeCanvasW} canvasHeight={activeCanvasH} />}

      {/* ═══ 固定顶栏 ═══ */}
      {header?.visible !== false && (
      <>
      <div
        className="absolute z-30"
        style={{ left: headerPx.left, top: headerPx.top, width: headerPx.width, height: headerPx.height }}
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
            const TargetComp = targetDef?.component;
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
                <TargetComp {...(targetDef.defaultConfig ?? {})} {...(targetSlot.options as object)} />
              </div>
            );
          })()}

          {header.slots.map((slot, idx) => {
            const px = headerSlotPixels.find(p => p.id === slot.id);
            const elDef = slot.elementType ? headerElementRegistry.get(slot.elementType) : undefined;
            const ElComp = elDef?.component;
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
                onClick={e => { if (isEditing) { e.stopPropagation(); selectHeaderSlot(slot.id); } }}
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
                {slot.elementType && (slot.options as Record<string, unknown>)?.borderStyle
                  && (slot.options as Record<string, unknown>).borderStyle !== 'none'
                  && px && (
                  <HeaderBorder1 width={px.width} height={px.height} />
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

      {/* ═══ 中心空提示 ═══ */}
      {isEditing && isCenterEmpty && (
        <div
          className="absolute flex items-center justify-center pointer-events-none z-20"
          style={slotToPx(CENTER_SLOT, cellW, cellH, grid.gap)}
        >
          <span className="text-sm text-textSecondary/25 tracking-widest select-none">Ctrl+E 以添加组件</span>
        </div>
      )}

      {/* ═══ 可用区块提示（低图层，已有组件自然遮挡不可用位置） ═══ */}
      {showWidgetSlotsHint && CANONICAL_SLOTS.map(slot => (
        <div
          key={`whint-${slot.col}-${slot.row}`}
          className="absolute pointer-events-none z-35"
          style={{
            ...slotToPx(slot, cellW, cellH, grid.gap),
            border: '1px solid rgba(0,212,255,0.2)',
            backgroundColor: 'rgba(0,212,255,0.03)',
            borderRadius: 4,
          }}
        />
      ))}

      {/* ═══ 拖入预览 ═══ */}
      {isEditing && dropPreview && (
        <div
          className="absolute pointer-events-none z-40"
          style={{
            ...slotToPx(
              header?.visible === false
                ? { ...dropPreview, row: Math.max(0, dropPreview.row - BASE_HEADER_ROWS) }
                : dropPreview,
              cellW, cellH, grid.gap
            ),
            backgroundColor: dropPreview.blocked
              ? 'rgba(248,113,113,0.12)'
              : 'rgba(0,212,255,0.12)',
            border: dropPreview.blocked
              ? '2px solid rgba(248,113,113,0.55)'
              : '2px solid rgba(0,212,255,0.6)',
            boxShadow: dropPreview.blocked
              ? 'none'
              : '0 0 16px rgba(0,212,255,0.35), inset 0 0 8px rgba(0,212,255,0.1)',
            borderRadius: 4,
          }}
        >
          {dropPreview.blocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-negative/80 text-xs font-semibold bg-surface-panel/90 px-2 py-0.5 rounded">此区块已有组件</span>
            </div>
          )}
        </div>
      )}


      {/* ═══ 组件 ═══ */}
      {visibleWidgets.map(widget => {
        // 交换预览：被"挤"走的组件渲染在原位置
        const isSwapTarget = dragSwap?.targetWidgetId === widget.id;
        const px = isSwapTarget
          ? slotToPx(
              header?.visible === false
                ? { ...dragSwap.originSlot, row: Math.max(0, dragSwap.originSlot.row - BASE_HEADER_ROWS) }
                : dragSwap.originSlot,
              cellW, cellH, grid.gap)
          : positions.find(p => p.id === widget.id);
        if (!px) return null;
        const def = widgetRegistry.get(widget.type);
        const Comp = def?.component;
        const isCenter = widget.layout.col === CENTER_SLOT.col &&
          widget.layout.colSpan >= CENTER_SLOT.colSpan &&
          widget.layout.row === CENTER_SLOT.row;
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
            onClick={e => { if (isEditing) { e.stopPropagation(); selectWidget(widget.id); } }}
            onDragStart={e => handleWidgetDragStart(e, widget.id)}
            onDragEnd={e => handleWidgetDragEnd(e, widget.id)}
          >
            {!isEditing && <CornerAccent isCenter={isCenter} />}
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
              isCenter={isCenter}
              isEditing={isEditing}
              accentColor={theme.colors.primary}
            />

            <div className="flex-1 min-h-0 w-full">
              {Comp ? (
                <Suspense fallback={<div className="flex items-center justify-center h-full text-textSecondary/20 text-xs">...</div>}>
                  <WidgetBody widget={widget} Comp={Comp} defaultConfig={def?.defaultConfig ?? {}} compact={isNarrowHeader} />
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
              left={px.left - borderOutset}
              top={px.top - borderOutset}
              width={px.width + borderOutset * 2}
              height={px.height + borderOutset * 2}
              isSelected={isSelected}
            />
          )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── 网格覆盖层 ───
function GridOverlay({ grid, canvasWidth, canvasHeight }: { grid: { cols: number; rows: number; gap: number }; canvasWidth: number; canvasHeight: number }) {
  const lines = useMemo(() => {
    const { cellW, cellH } = cellMetrics(canvasWidth, canvasHeight, grid.gap, grid.cols, grid.rows);
    const cols: number[] = [], rows: number[] = [];
    for (let i = 0; i <= grid.cols; i++) cols.push(grid.gap + i * (cellW + grid.gap));
    for (let i = 0; i <= grid.rows; i++) rows.push(grid.gap + i * (cellH + grid.gap));
    return { cols, rows };
  }, [grid, canvasWidth, canvasHeight]);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
      {lines.cols.map(x => <line key={`c-${x}`} x1={x} y1={0} x2={x} y2={canvasHeight} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="4 4" />)}
      {lines.rows.map(y => <line key={`r-${y}`} x1={0} y1={y} x2={canvasWidth} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="4 4" />)}
    </svg>
  );
}

// ═══════════════════════════════════════════
// 标准化标题区块
// ═══════════════════════════════════════════

interface WidgetTitleBarProps {
  primary?: { text: string };
  secondary?: { text: string };
  isCenter: boolean;
  isEditing: boolean;
  accentColor: string;
}

function WidgetTitleBar({ primary, secondary, isCenter, isEditing, accentColor }: WidgetTitleBarProps) {
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

      {/* 中心组件展示态：装饰渐变线 */}
      {isCenter && !isEditing && (
        <div className="flex-1 ml-3 h-px bg-gradient-to-r from-accent-cool/30 to-transparent flex-shrink-0" />
      )}
    </div>
  );
}

// ─── HUD 角标 ───
function CornerAccent({ isCenter }: { isCenter: boolean }) {
  const alpha = isCenter ? 0.25 : 0.12;
  const size = isCenter ? 16 : 10;
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
