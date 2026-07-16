import { Suspense, useMemo, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { widgetRegistry, layoutEngine } from '@hugescreen/core';
import { headerElementRegistry } from '@hugescreen/widgets';
import type { WidgetConfig } from '@hugescreen/shared';

interface ScreenCanvasProps {
  isEditing?: boolean;
}

interface BlockSlot {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

const CANONICAL_SLOTS: BlockSlot[] = [
  { col: 0, row: 1, colSpan: 2, rowSpan: 2 }, // left-1
  { col: 0, row: 3, colSpan: 2, rowSpan: 2 }, // left-2
  { col: 0, row: 5, colSpan: 2, rowSpan: 2 }, // left-3
  { col: 2, row: 1, colSpan: 4, rowSpan: 6 }, // center
  { col: 6, row: 1, colSpan: 2, rowSpan: 2 }, // right-1
  { col: 6, row: 3, colSpan: 2, rowSpan: 2 }, // right-2
  { col: 6, row: 5, colSpan: 2, rowSpan: 2 }, // right-3
];

const CENTER_AREA = CANONICAL_SLOTS[3];

function findSlotAt(col: number, row: number): BlockSlot | null {
  return (
    CANONICAL_SLOTS.find(
      (s) =>
        col >= s.col && col < s.col + s.colSpan &&
        row >= s.row && row < s.row + s.rowSpan,
    ) ?? null
  );
}

function isSlotHardBlocked(
  slot: BlockSlot,
  widgets: WidgetConfig[],
  excludeId?: string,
): boolean {
  const occupying = widgets.find((w) => {
    if (w.id === excludeId) return false;
    return layoutEngine.overlaps(
      { col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan },
      slot,
    );
  });
  if (!occupying) return false;
  const def = widgetRegistry.get(occupying.type);
  // 注册表中找不到该类型 → 按已扩大处理，允许覆盖（避免死锁）
  if (!def) return false;
  const defRowSpan = def.defaultSize?.rowSpan ?? occupying.layout.rowSpan;
  const defColSpan = def.defaultSize?.colSpan ?? occupying.layout.colSpan;
  return occupying.layout.rowSpan <= defRowSpan && occupying.layout.colSpan <= defColSpan;
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
const HEADER_ROWS = 1;

/** 顶栏 Y 结束位置（设计坐标），落点高于此 = 顶栏区域 */
function headerBottomY(canvasH: number, gap: number, rows: number): number {
  const { cellH } = cellMetrics(1920, canvasH, gap, 8, rows); // cols 固定 8
  return gap + HEADER_ROW * (cellH + gap) + cellH;
}

export function ScreenCanvas({ isEditing = false }: ScreenCanvasProps) {
  const {
    config, selectedWidgetId, selectedHeaderSlotId, selectWidget, selectHeaderSlot,
    addWidget, moveWidget, removeWidget,
    setHeaderSlot, removeHeaderElement, swapHeaderSlots,
    setDraggingWidget, setDraggingHeaderEl, isDraggingWidget, isDraggingHeaderEl,
  } = useEditorStore();
  const { canvas, grid, header, widgets, theme } = config;

  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingWidgetId = useRef<string | null>(null);
  // 自定义拖拽副本（替代浏览器默认半透明鬼影）
  const dragCloneEl = useRef<HTMLElement | null>(null);
  const dragCloneOffset = useRef({ x: 0, y: 0 });
  const dragCleanup = useRef<(() => void) | null>(null);
  const dragSourceEl = useRef<HTMLElement | null>(null);
  const dragDidMove = useRef(false); // 区分真实拖拽和点击

  type Preview = BlockSlot & { blocked?: boolean };
  const [dropPreview, setDropPreview] = useState<Preview | null>(null);

  const { cellW, cellH } = useMemo(
    () => cellMetrics(canvas.width, canvas.height, grid.gap, grid.cols, grid.rows),
    [canvas.width, canvas.height, grid.gap, grid.cols, grid.rows],
  );

  const headerPx = useMemo(
    () => slotToPx({ col: 0, row: HEADER_ROW, colSpan: grid.cols, rowSpan: HEADER_ROWS }, cellW, cellH, grid.gap),
    [cellW, cellH, grid.gap, grid.cols],
  );

  const headerBottom = headerPx.top + headerPx.height;

  // 顶栏槽位像素
  const headerSlotPixels = useMemo(() => {
    let left = headerPx.left;
    return header.slots.map((s) => {
      const w = s.colSpan * cellW + (s.colSpan - 1) * grid.gap;
      const px = { left, top: headerPx.top, width: w, height: headerPx.height };
      left += w + grid.gap;
      return { id: s.id, ...px };
    });
  }, [header.slots, headerPx, cellW, grid.gap]);

  // Widget 像素位置（canvas 相对坐标）
  const positions = useMemo(() => {
    return widgets.map((w) => ({
      id: w.id,
      ...slotToPx(w.layout, cellW, cellH, grid.gap),
    }));
  }, [widgets, cellW, cellH, grid.gap]);

  const isCenterEmpty = useMemo(() => {
    return !widgets.some((w) => {
      const wEndCol = w.layout.col + w.layout.colSpan;
      const wEndRow = w.layout.row + w.layout.rowSpan;
      return (
        w.layout.col < CENTER_AREA.col + CENTER_AREA.colSpan &&
        wEndCol > CENTER_AREA.col &&
        w.layout.row < CENTER_AREA.row + CENTER_AREA.rowSpan &&
        wEndRow > CENTER_AREA.row
      );
    });
  }, [widgets]);

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

  const handleHeaderDragOver = useCallback((e: React.DragEvent) => {
    // 一般组件拖入顶栏 → 标记拒绝
    if (e.dataTransfer.types.includes('application/widget-id')) {
      e.preventDefault();
      e.stopPropagation();
      setWidgetOverHeader(true);
      return;
    }
    if (e.dataTransfer.types.includes('application/header-element-type') ||
        e.dataTransfer.types.includes('application/header-element-id')) {
      e.preventDefault();
      e.stopPropagation();
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
        // 拒绝：多列组件交换到最后一个槽位
        if (srcNeed > 1 && targetIdx + srcNeed > header.slots.length) return;
        // 原子化交换，避免双 setHeaderSlot 中间态丢失组件
        swapHeaderSlots(src.id, target.id);
      }
    }
  }, [clientToDesign, header.slots, headerPx.left, cellW, grid.gap, swapHeaderSlots]);

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
      setDropPreview({ ...slot, blocked: isSlotHardBlocked(slot, widgets) });
    } else if (e.dataTransfer.types.includes('application/widget-id')) {
      e.dataTransfer.dropEffect = 'move';
      const wid = e.dataTransfer.getData('application/widget-id');
      setDropPreview({ ...slot, blocked: isSlotHardBlocked(slot, widgets, wid) });
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  }, [clientToDesign, grid, canvas.width, canvas.height, widgets, headerBottom]);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropPreview(null);
      setHeaderOverWidget(false);
    }
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/header-element-type') ||
        e.dataTransfer.types.includes('application/header-element-id')) return;

    e.preventDefault();
    e.stopPropagation();
    setDropPreview(null);

    const { x, y } = clientToDesign(e.clientX, e.clientY);
    if (y < headerBottom) return;

    const cell = layoutEngine.pixelToCell(x, y, 1, 1, grid, canvas.width, canvas.height);
    const slot = findSlotAt(cell.col, cell.row);
    if (!slot) return;

    const wt = e.dataTransfer.getData('application/widget-type');
    if (wt) {
      if (isSlotHardBlocked(slot, widgets)) return;
      addWidget(wt, { ...slot });
      return;
    }
    const wid = e.dataTransfer.getData('application/widget-id');
    if (wid) {
      if (isSlotHardBlocked(slot, widgets, wid)) return;
      moveWidget(wid, { ...slot });
    }
  }, [clientToDesign, grid, canvas.width, canvas.height, widgets, addWidget, moveWidget, headerBottom]);

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
  }

  // ═══ 拖拽生命周期 ═══
  const handleWidgetDragStart = useCallback((e: React.DragEvent, id: string) => {
    if (!isEditing) { e.preventDefault(); return; }

    // 防御性清理上一次拖拽残留
    doDragCleanup();

    e.dataTransfer.setData('application/widget-id', id);
    e.dataTransfer.effectAllowed = 'move';
    draggingWidgetId.current = id;
    setDraggingWidget(true);

    const sourceEl = e.currentTarget as HTMLElement;
    dragSourceEl.current = sourceEl;
    const rect = sourceEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // ★ 关键：先克隆再隐藏原组件，避免 clone 继承 visibility:hidden
    const clone = sourceEl.cloneNode(true) as HTMLElement;
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
      draggingWidgetId.current = null;
      setDraggingWidget(false);
      if (dragDidMove.current && !dragCloneEl.current) {
        // clone 已被 doDragCleanup 移除，说明此 dragend 是原生兜底触发
        // dropEffect 此时无法可靠读取，不做额外删除（handleDeleteDrop 已处理）
      }
    };
    document.addEventListener('dragend', onNativeDragEnd);
  }, [isEditing, setDraggingWidget]);

  const handleWidgetDragEnd = useCallback((e: React.DragEvent, id: string) => {
    doDragCleanup();
    draggingWidgetId.current = null;
    setDraggingWidget(false);
    // 组件未被删除（拖到合法新位置或取消）→ 恢复可见性
    const el = document.getElementById(`widget-${id}`);
    if (el) el.style.visibility = 'visible';
    // 仅当确实发生了拖拽移动（而非单纯点击）且未被任何目标接收时，才删除
    if (dragDidMove.current && e.dataTransfer.dropEffect === 'none') removeWidget(id);
  }, [removeWidget, setDraggingWidget]);

  // ─── 顶栏元素拖拽（与普通组件共用同一套自定义拖拽副本机制）───
  const handleHeaderElDragStart = useCallback((e: React.DragEvent, slotId: string) => {
    if (!isEditing) { e.preventDefault(); return; }

    // 防御性清理上一次拖拽残留
    doDragCleanup();

    e.dataTransfer.setData('application/header-element-id', slotId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingWidget(true);
    setDraggingHeaderEl(true);

    const sourceEl = e.currentTarget as HTMLElement;
    dragSourceEl.current = sourceEl;
    const rect = sourceEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // 先克隆再隐藏，避免继承 visibility:hidden
    const clone = sourceEl.cloneNode(true) as HTMLElement;
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
    // 顶栏不隐藏源元素（无"拿起来"效果），只移除鬼影
    requestAnimationFrame(() => {
      ghost.remove();
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
      doDragCleanup();
      setDraggingWidget(false);
      setDraggingHeaderEl(false);
    };
    document.addEventListener('dragend', onNativeDragEnd);
  }, [isEditing, setDraggingWidget, setDraggingHeaderEl]);

  const handleHeaderElDragEnd = useCallback((_e: React.DragEvent, slotId: string) => {
    doDragCleanup();
    setDraggingWidget(false);
    setDraggingHeaderEl(false);
    const el = document.getElementById(`header-slot-${slotId}`);
    if (el) el.style.visibility = 'visible';
    // 顶栏元素仅通过拖入左侧删除区销毁，拖到其他位置松手自动回到原处
  }, [setDraggingWidget, setDraggingHeaderEl]);

  // ═══════════════════════════════════
  return (
    <div
      ref={canvasRef}
      className="relative"
      style={{ width: canvas.width, height: canvas.height, backgroundColor: theme.colors.background }}
      onDragOver={isEditing ? handleCanvasDragOver : undefined}
      onDragLeave={isEditing ? handleCanvasDragLeave : undefined}
      onDrop={isEditing ? handleCanvasDrop : undefined}
    >
      {isEditing && <GridOverlay grid={grid} canvasWidth={canvas.width} canvasHeight={canvas.height} />}

      {/* ═══ 固定顶栏 ═══ */}
      <div
        className="absolute z-30"
        style={{ left: headerPx.left, top: headerPx.top, width: headerPx.width, height: headerPx.height }}
        onDragOver={isEditing ? handleHeaderDragOver : undefined}
        onDragLeave={() => { setHeaderDragIdx(null); setHeaderBlockedIdx(null); setWidgetOverHeader(false); }}
        onDrop={isEditing ? handleHeaderDrop : undefined}
      >
        <div className="flex h-full relative" style={{ gap: grid.gap }}>

          {/* 拖拽一般组件时顶栏虚化红框提示 */}
          {isDraggingWidget && !isDraggingHeaderEl && (
            <div className={`absolute inset-0 z-30 pointer-events-none flex items-center justify-center transition-all duration-200 ${
              widgetOverHeader
                ? 'bg-negative/15 backdrop-blur-sm ring-2 ring-negative/60'
                : 'bg-negative/5 backdrop-blur-[3px] ring-2 ring-negative/30'
            }`}>
              <span className={`font-bold tracking-wide transition-all duration-200 ${
                widgetOverHeader ? 'text-negative text-sm scale-110' : 'text-negative/80 text-xs'
              }`}>不可拖拽至此处</span>
            </div>
          )}
          {header.slots.map((slot, idx) => {
            const px = headerSlotPixels.find(p => p.id === slot.id);
            const elDef = slot.elementType ? headerElementRegistry.get(slot.elementType) : undefined;
            const ElComp = elDef?.component;
            return (
              <div
                key={slot.id}
                id={`header-slot-${slot.id}`}
                draggable={isEditing && !!slot.elementType}
                className={`relative overflow-hidden ${isEditing ? 'cursor-pointer' : ''}`}
                style={{
                  width: px?.width, height: px?.height,
                  outline: isEditing && selectedHeaderSlotId === slot.id
                    ? '1px solid rgba(126,184,218,0.7)' : 'none',
                  outlineOffset: -1,
                }}
                onClick={e => { if (isEditing) { e.stopPropagation(); selectHeaderSlot(slot.id); } }}
                onDragStart={e => { if (slot.elementType) handleHeaderElDragStart(e, slot.id); }}
                onDragEnd={e => handleHeaderElDragEnd(e, slot.id)}
              >
                {ElComp ? (
                  <ElComp {...(elDef!.defaultConfig ?? {})} {...(slot.options as object)} />
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

                {isEditing && slot.elementType && (
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
      {isDraggingHeaderEl && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{ top: headerBottom, left: 0, right: 0, bottom: 0 }}
        >
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            headerOverWidget
              ? 'bg-negative/15 backdrop-blur-sm ring-2 ring-negative/60'
              : 'bg-negative/5 backdrop-blur-[3px] ring-2 ring-negative/30'
          }`}>
            <span className={`font-bold tracking-wide transition-all duration-200 ${
              headerOverWidget ? 'text-negative text-sm scale-110' : 'text-negative/80 text-xs'
            }`}>不可拖拽至此处</span>
          </div>
        </div>
      )}

      {/* ═══ 中心空提示 ═══ */}
      {isCenterEmpty && (
        <div
          className="absolute flex items-center justify-center pointer-events-none z-20"
          style={slotToPx(CENTER_AREA, cellW, cellH, grid.gap)}
        >
          <span className="text-sm text-textSecondary/25 tracking-widest select-none">Ctrl+E 以添加组件</span>
        </div>
      )}

      {/* ═══ 拖入预览 ═══ */}
      {isEditing && dropPreview && (
        <div
          className="absolute pointer-events-none z-40"
          style={{
            ...slotToPx(dropPreview, cellW, cellH, grid.gap),
            backgroundColor: dropPreview.blocked ? 'rgba(248,113,113,0.12)' : 'rgba(126,184,218,0.08)',
            border: dropPreview.blocked ? '2px solid rgba(248,113,113,0.55)' : '1px dashed rgba(126,184,218,0.35)',
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
      {widgets.map(widget => {
        const px = positions.find(p => p.id === widget.id);
        if (!px) return null;
        const def = widgetRegistry.get(widget.type);
        const Comp = def?.component;
        const isCenter = widget.layout.col === CENTER_AREA.col &&
          widget.layout.colSpan >= CENTER_AREA.colSpan &&
          widget.layout.row === CENTER_AREA.row;
        const isSelected = widget.id === selectedWidgetId;

        return (
          <div
            key={widget.id}
            id={`widget-${widget.id}`}
            draggable={isEditing}
            className={`absolute overflow-hidden flex flex-col transition-shadow duration-300
              ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}
              ${isCenter && !isEditing ? 'z-10' : 'z-0'}
            `}
            style={{
              left: px.left, top: px.top, width: px.width, height: px.height,
              backgroundColor: isEditing ? (widget.style.backgroundColor || theme.colors.surface) : 'transparent',
              borderColor: isEditing ? (isSelected ? theme.colors.primary : 'rgba(255,255,255,0.12)') : 'transparent',
              borderWidth: isEditing ? 1 : 0,
              borderStyle: isEditing ? 'dashed' : 'solid',
              borderRadius: isEditing ? 4 : 0,
            }}
            onClick={e => { if (isEditing) { e.stopPropagation(); selectWidget(widget.id); } }}
            onDragStart={e => handleWidgetDragStart(e, widget.id)}
            onDragEnd={e => handleWidgetDragEnd(e, widget.id)}
          >
            {!isEditing && <CornerAccent isCenter={isCenter} />}
            {isEditing && isSelected && (
              <div className="absolute inset-0 ring-1 ring-accent-cool pointer-events-none z-20" />
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
                  <Comp {...(def?.defaultConfig ?? {})} {...(widget.options as object)} />
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
      className="flex items-center flex-shrink-0 z-10"
      style={{
        height: both ? 44 : hasPrimary ? 32 : 24,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
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
          borderColor: `rgba(126,184,218,${alpha})`, borderStyle: 'solid',
        }} />
      ))}
    </>
  );
}
