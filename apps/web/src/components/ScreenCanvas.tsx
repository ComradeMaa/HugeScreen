import { Suspense, useMemo, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { widgetRegistry, layoutEngine } from '@hugescreen/core';
import type { WidgetConfig } from '@hugescreen/shared';

interface ScreenCanvasProps {
  isEditing?: boolean;
}

/** ─── 固定区块定义（与 defaultLayout.ts 中的槽位完全对应）─── */
interface BlockSlot {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

const CANONICAL_SLOTS: BlockSlot[] = [
  { col: 0, row: 0, colSpan: 8, rowSpan: 1 }, // header
  { col: 0, row: 1, colSpan: 2, rowSpan: 2 }, // left-1
  { col: 0, row: 3, colSpan: 2, rowSpan: 2 }, // left-2
  { col: 0, row: 5, colSpan: 2, rowSpan: 2 }, // left-3
  { col: 2, row: 1, colSpan: 4, rowSpan: 6 }, // center
  { col: 6, row: 1, colSpan: 2, rowSpan: 2 }, // right-1
  { col: 6, row: 3, colSpan: 2, rowSpan: 2 }, // right-2
  { col: 6, row: 5, colSpan: 2, rowSpan: 2 }, // right-3
];

/** 中心区域（用于空状态判断和展示态增强） */
const CENTER_AREA = CANONICAL_SLOTS[4]; // center slot

/** 查找包含指定网格坐标的固定区块 */
function findSlotAt(col: number, row: number): BlockSlot | null {
  return (
    CANONICAL_SLOTS.find(
      (s) =>
        col >= s.col &&
        col < s.col + s.colSpan &&
        row >= s.row &&
        row < s.row + s.rowSpan,
    ) ?? null
  );
}

/** 检查区块是否被「不可缩回的组件」占用 */
function isSlotHardBlocked(
  slot: BlockSlot,
  widgets: WidgetConfig[],
  excludeId?: string,
): boolean {
  const occupying = widgets.find((w) => {
    if (w.id === excludeId) return false;
    return layoutEngine.overlaps(
      {
        col: w.layout.col,
        row: w.layout.row,
        colSpan: w.layout.colSpan,
        rowSpan: w.layout.rowSpan,
      },
      slot,
    );
  });
  if (!occupying) return false;

  const def = widgetRegistry.get(occupying.type);
  const defRowSpan = def?.defaultSize?.rowSpan ?? occupying.layout.rowSpan;
  const defColSpan = def?.defaultSize?.colSpan ?? occupying.layout.colSpan;

  // 组件处于自然尺寸（未合并扩大）→ 不可缩 → 硬占用
  return (
    occupying.layout.rowSpan <= defRowSpan &&
    occupying.layout.colSpan <= defColSpan
  );
}

/**
 * 屏幕画布 — 驾驶舱风格 + 区块吸附
 *
 * 核心规则：
 *  - 画布被 8 个固定区块划分，区块位置/大小只在合并/拆分时变化
 *  - 组件必须严格放入某个区块，填满区块
 *  - 如果区块已被处于自然尺寸的组件占用 → 显示红边 + 拒绝放置
 *  - 如果区块被已合并扩大的组件占用 → 允许放置，触发 reflow 缩回
 */
export function ScreenCanvas({ isEditing = false }: ScreenCanvasProps) {
  const {
    config,
    selectedWidgetId,
    selectWidget,
    addWidget,
    moveWidget,
    removeWidget,
  } = useEditorStore();
  const { canvas, grid, widgets, theme } = config;

  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingWidgetId = useRef<string | null>(null);

  type Preview = BlockSlot & { blocked?: boolean };
  const [dropPreview, setDropPreview] = useState<Preview | null>(null);

  // ─── 像素位置 ───
  const positions = useMemo(() => {
    const cellW = (canvas.width - grid.gap * (grid.cols + 1)) / grid.cols;
    const cellH = (canvas.height - grid.gap * (grid.rows + 1)) / grid.rows;
    return widgets.map((w) => {
      const x = grid.gap + w.layout.col * (cellW + grid.gap);
      const y = grid.gap + w.layout.row * (cellH + grid.gap);
      const width =
        w.layout.colSpan * cellW + (w.layout.colSpan - 1) * grid.gap;
      const height =
        w.layout.rowSpan * cellH + (w.layout.rowSpan - 1) * grid.gap;
      return { id: w.id, x, y, width, height };
    });
  }, [widgets, grid, canvas]);

  // ─── 中心是否为空 ───
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

  // ─── 像素 → 设计坐标 ───
  const clientToDesign = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [canvas.width, canvas.height],
  );

  // ─── 拖入悬停 → 吸附到区块 ───
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const { x, y } = clientToDesign(e.clientX, e.clientY);
      const cell = layoutEngine.pixelToCell(
        x,
        y,
        1,
        1,
        grid,
        canvas.width,
        canvas.height,
      );
      const slot = findSlotAt(cell.col, cell.row);

      if (!slot) {
        setDropPreview(null);
        return;
      }

      if (e.dataTransfer.types.includes('application/widget-type')) {
        e.dataTransfer.dropEffect = 'copy';
        const blocked = isSlotHardBlocked(slot, widgets);
        setDropPreview({ ...slot, blocked });
      } else if (e.dataTransfer.types.includes('application/widget-id')) {
        e.dataTransfer.dropEffect = 'move';
        const widgetId = e.dataTransfer.getData('application/widget-id');
        const blocked = isSlotHardBlocked(slot, widgets, widgetId);
        setDropPreview({ ...slot, blocked });
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    },
    [clientToDesign, grid, canvas.width, canvas.height, widgets],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (
      e.currentTarget === e.target ||
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      setDropPreview(null);
    }
  }, []);

  // ─── 放下 → 严格放入区块 ───
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropPreview(null);

      const { x, y } = clientToDesign(e.clientX, e.clientY);
      const cell = layoutEngine.pixelToCell(
        x,
        y,
        1,
        1,
        grid,
        canvas.width,
        canvas.height,
      );
      const slot = findSlotAt(cell.col, cell.row);
      if (!slot) return;

      // 从组件池拖入
      const widgetType = e.dataTransfer.getData('application/widget-type');
      if (widgetType) {
        if (isSlotHardBlocked(slot, widgets)) return;
        // ★ 组件使用区块的尺寸，不是自己的 defaultSize
        addWidget(widgetType, { ...slot });
        return;
      }

      // 画布内组件移动
      const widgetId = e.dataTransfer.getData('application/widget-id');
      if (widgetId) {
        if (isSlotHardBlocked(slot, widgets, widgetId)) return;
        moveWidget(widgetId, { ...slot });
      }
    },
    [clientToDesign, grid, canvas.width, canvas.height, widgets, addWidget, moveWidget],
  );

  // ─── 组件自身拖拽 ───
  const handleWidgetDragStart = useCallback(
    (e: React.DragEvent, widgetId: string) => {
      if (!isEditing) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('application/widget-id', widgetId);
      e.dataTransfer.effectAllowed = 'move';
      draggingWidgetId.current = widgetId;
      requestAnimationFrame(() => {
        const el = document.getElementById(`widget-${widgetId}`);
        if (el) el.style.opacity = '0.5';
      });
    },
    [isEditing],
  );

  const handleWidgetDragEnd = useCallback(
    (e: React.DragEvent, widgetId: string) => {
      const el = document.getElementById(`widget-${widgetId}`);
      if (el) el.style.opacity = '1';
      draggingWidgetId.current = null;
      if (e.dataTransfer.dropEffect === 'none') {
        removeWidget(widgetId);
      }
    },
    [removeWidget],
  );

  // ─── 辅助：网格坐标 → 像素 ───
  const slotToPixel = useCallback(
    (s: BlockSlot) => {
      const cellW = (canvas.width - grid.gap * (grid.cols + 1)) / grid.cols;
      const cellH = (canvas.height - grid.gap * (grid.rows + 1)) / grid.rows;
      return {
        left:
          grid.gap + s.col * (cellW + grid.gap),
        top:
          grid.gap + s.row * (cellH + grid.gap),
        width:
          s.colSpan * cellW + (s.colSpan - 1) * grid.gap,
        height:
          s.rowSpan * cellH + (s.rowSpan - 1) * grid.gap,
      };
    },
    [canvas.width, canvas.height, grid],
  );

  return (
    <div
      ref={canvasRef}
      className="relative"
      style={{
        width: canvas.width,
        height: canvas.height,
        backgroundColor: theme.colors.background,
      }}
      onDragOver={isEditing ? handleDragOver : undefined}
      onDragLeave={isEditing ? handleDragLeave : undefined}
      onDrop={isEditing ? handleDrop : undefined}
    >
      {/* ─── 编辑态网格线 ─── */}
      {isEditing && (
        <GridOverlay
          grid={grid}
          canvasWidth={canvas.width}
          canvasHeight={canvas.height}
        />
      )}

      {/* ─── 中心为空提示 ─── */}
      {isCenterEmpty && (
        <div
          className="absolute flex items-center justify-center pointer-events-none z-20"
          style={slotToPixel(CENTER_AREA)}
        >
          <span className="text-sm text-textSecondary/25 tracking-widest select-none">
            Ctrl+E 以添加组件
          </span>
        </div>
      )}

      {/* ─── 拖入预览 ─── */}
      {isEditing && dropPreview && (
        <div
          className="absolute pointer-events-none z-40"
          style={{
            ...slotToPixel(dropPreview),
            backgroundColor: dropPreview.blocked
              ? 'rgba(248,113,113,0.12)'
              : 'rgba(126,184,218,0.08)',
            border: dropPreview.blocked
              ? '2px solid rgba(248,113,113,0.55)'
              : '1px dashed rgba(126,184,218,0.35)',
            borderRadius: 4,
          }}
        >
          {dropPreview.blocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-negative/80 text-xs font-semibold bg-surface-panel/90 px-2 py-0.5 rounded">
                此区块已有组件
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── 组件 ─── */}
      {widgets.map((widget) => {
        const px = positions.find((p) => p.id === widget.id);
        if (!px) return null;

        const def = widgetRegistry.get(widget.type);
        const WidgetComponent = def?.component;
        const isHeader = widget.type === 'screen-header';
        const isCenter =
          widget.layout.col === CENTER_AREA.col &&
          widget.layout.colSpan >= CENTER_AREA.colSpan &&
          widget.layout.row === CENTER_AREA.row;
        const isSelected = widget.id === selectedWidgetId;
        const isDragging = draggingWidgetId.current === widget.id;

        return (
          <div
            key={widget.id}
            id={`widget-${widget.id}`}
            draggable={isEditing}
            className={`absolute overflow-hidden transition-shadow duration-300
              ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}
              ${isCenter && !isEditing ? 'z-10' : 'z-0'}
            `}
            style={{
              left: px.x,
              top: px.y,
              width: px.width,
              height: px.height,
              backgroundColor: isEditing
                ? widget.style.backgroundColor || theme.colors.surface
                : 'transparent',
              borderColor: isEditing
                ? isSelected
                  ? theme.colors.primary
                  : 'rgba(255,255,255,0.12)'
                : 'transparent',
              borderWidth: isEditing ? 1 : 0,
              borderStyle: isEditing ? 'dashed' : 'solid',
              borderRadius: isEditing ? 4 : 0,
              opacity: isDragging ? 0.4 : 1,
            }}
            onClick={(e) => {
              if (isEditing) {
                e.stopPropagation();
                selectWidget(widget.id);
              }
            }}
            onDragStart={(e) => handleWidgetDragStart(e, widget.id)}
            onDragEnd={(e) => handleWidgetDragEnd(e, widget.id)}
          >
            {/* ─── 展示态 HUD 角标 ─── */}
            {!isEditing && !isHeader && (
              <CornerAccent isCenter={isCenter} />
            )}

            {/* ─── 编辑态选中高亮 ─── */}
            {isEditing && isSelected && (
              <div className="absolute inset-0 ring-1 ring-accent-cool pointer-events-none z-20" />
            )}

            {/* ─── 标题 ─── */}
            {(isEditing || isCenter) &&
              widget.style.title?.show &&
              !isHeader && (
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center px-4 py-2">
                  <div
                    className="w-0.5 h-3 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: theme.colors.primary }}
                  />
                  <span
                    className={`font-medium tracking-wide truncate ${
                      isCenter && !isEditing
                        ? 'text-sm text-white'
                        : 'text-[11px] text-textSecondary'
                    }`}
                  >
                    {widget.style.title.text || widget.displayName}
                  </span>
                  {isCenter && !isEditing && (
                    <div className="flex-1 ml-3 h-px bg-gradient-to-r from-accent-cool/30 to-transparent" />
                  )}
                </div>
              )}

            {/* ─── 内容 ─── */}
            <div className="w-full h-full">
              {WidgetComponent ? (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full text-textSecondary/20 text-xs">
                      ...
                    </div>
                  }
                >
                  <WidgetComponent
                    {...(def?.defaultConfig ?? {})}
                    {...(widget.options as object)}
                  />
                </Suspense>
              ) : (
                <div className="flex items-center justify-center h-full text-textSecondary/20 text-xs">
                  {widget.displayName}
                </div>
              )}
            </div>

            {/* ─── 编辑态：标签 + 删除按钮 ─── */}
            {isEditing && (
              <>
                <div className="absolute bottom-1 right-1 z-10 flex items-center gap-1">
                  <span className="text-[9px] text-textSecondary/30 font-mono bg-surface-base/80 px-1 rounded">
                    {widget.type}
                  </span>
                </div>
                <button
                  className="absolute top-1 right-1 z-20 w-5 h-5 flex items-center justify-center
                    rounded-full bg-surface-base/80 text-textSecondary/40 hover:text-negative hover:bg-surface-hover
                    transition-colors text-xs leading-none"
                  title="删除组件"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWidget(widget.id);
                  }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 编辑态网格覆盖层 ───

function GridOverlay({
  grid,
  canvasWidth,
  canvasHeight,
}: {
  grid: { cols: number; rows: number; gap: number };
  canvasWidth: number;
  canvasHeight: number;
}) {
  const lines = useMemo(() => {
    const cellW = (canvasWidth - grid.gap * (grid.cols + 1)) / grid.cols;
    const cellH = (canvasHeight - grid.gap * (grid.rows + 1)) / grid.rows;
    const cols: number[] = [];
    const rows: number[] = [];
    for (let i = 0; i <= grid.cols; i++) {
      cols.push(grid.gap + i * (cellW + grid.gap));
    }
    for (let i = 0; i <= grid.rows; i++) {
      rows.push(grid.gap + i * (cellH + grid.gap));
    }
    return { cols, rows };
  }, [grid, canvasWidth, canvasHeight]);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
      {lines.cols.map((x) => (
        <line
          key={`c-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={canvasHeight}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />
      ))}
      {lines.rows.map((y) => (
        <line
          key={`r-${y}`}
          x1={0}
          y1={y}
          x2={canvasWidth}
          y2={y}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />
      ))}
    </svg>
  );
}

// ─── HUD 角标装饰 ───

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
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            ...c.style,
            width: size,
            height: size,
            borderColor: `rgba(126,184,218,${alpha})`,
            borderStyle: 'solid',
          }}
        />
      ))}
    </>
  );
}
