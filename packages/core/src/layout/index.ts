import type { GridConfig, WidgetLayout } from '@hugescreen/shared';

export interface GridCell {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface LayoutResult {
  /** 组件 ID → 计算后的像素位置 */
  positions: Map<string, PixelRect>;
  /** 网格线坐标 */
  gridLines: { cols: number[]; rows: number[] };
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 网格布局引擎
 * 负责将网格坐标(layout)转换为像素坐标，处理吸附和碰撞检测。
 */
class LayoutEngine {
  /**
   * 计算某个网格位置对应的像素区域
   */
  cellToPixel(cell: GridCell, grid: GridConfig, canvasWidth: number, canvasHeight: number): PixelRect {
    const cellW = (canvasWidth - grid.gap * (grid.cols + 1)) / grid.cols;
    const cellH = (canvasHeight - grid.gap * (grid.rows + 1)) / grid.rows;

    return {
      x: grid.gap + cell.col * (cellW + grid.gap),
      y: grid.gap + cell.row * (cellH + grid.gap),
      width: cell.colSpan * cellW + (cell.colSpan - 1) * grid.gap,
      height: cell.rowSpan * cellH + (cell.rowSpan - 1) * grid.gap,
    };
  }

  /**
   * 像素坐标 → 最近的网格坐标（吸附）
   */
  pixelToCell(px: number, py: number, pw: number, ph: number, grid: GridConfig, canvasWidth: number, canvasHeight: number): GridCell {
    const cellW = (canvasWidth - grid.gap * (grid.cols + 1)) / grid.cols;
    const cellH = (canvasHeight - grid.gap * (grid.rows + 1)) / grid.rows;

    const col = Math.round((px - grid.gap) / (cellW + grid.gap));
    const row = Math.round((py - grid.gap) / (cellH + grid.gap));
    const colSpan = Math.max(1, Math.round((pw + grid.gap) / (cellW + grid.gap)));
    const rowSpan = Math.max(1, Math.round((ph + grid.gap) / (cellH + grid.gap)));

    return {
      col: Math.max(0, Math.min(col, grid.cols - 1)),
      row: Math.max(0, Math.min(row, grid.rows - 1)),
      colSpan: Math.max(1, Math.min(colSpan, grid.cols - col)),
      rowSpan: Math.max(1, Math.min(rowSpan, grid.rows - row)),
    };
  }

  /**
   * 检测两个网格区域是否重叠
   */
  overlaps(a: GridCell, b: GridCell): boolean {
    return (
      a.col < b.col + b.colSpan &&
      a.col + a.colSpan > b.col &&
      a.row < b.row + b.rowSpan &&
      a.row + a.rowSpan > b.row
    );
  }

  /**
   * 找一个不重叠的可用位置
   */
  findFreeSlot(
    desired: GridCell,
    occupied: GridCell[],
    grid: GridConfig,
  ): GridCell {
    let candidate = { ...desired };

    // 简单策略：如果冲突，向右下方偏移
    let attempts = 0;
    const maxAttempts = grid.cols * grid.rows;

    while (attempts < maxAttempts) {
      const hasCollision = occupied.some(o => this.overlaps(candidate, o));
      if (!hasCollision && candidate.col + candidate.colSpan <= grid.cols && candidate.row + candidate.rowSpan <= grid.rows) {
        return candidate;
      }

      candidate.col++;
      if (candidate.col + candidate.colSpan > grid.cols) {
        candidate.col = 0;
        candidate.row++;
        if (candidate.row + candidate.rowSpan > grid.rows) {
          // 回到起点缩小尺寸
          candidate.col = 0;
          candidate.row = 0;
          candidate.colSpan = Math.max(1, candidate.colSpan - 1);
          candidate.rowSpan = Math.max(1, candidate.rowSpan - 1);
        }
      }
      attempts++;
    }

    return desired;
  }

  /**
   * 根据断点布局计算所有组件的像素位置
   */
  computeLayout(
    layouts: Record<string, WidgetLayout>,
    grid: GridConfig,
    canvasWidth: number,
    canvasHeight: number,
  ): Map<string, PixelRect> {
    const positions = new Map<string, PixelRect>();

    for (const [id, layout] of Object.entries(layouts)) {
      const cell: GridCell = {
        col: layout.col,
        row: layout.row,
        colSpan: layout.colSpan,
        rowSpan: layout.rowSpan,
      };
      positions.set(id, this.cellToPixel(cell, grid, canvasWidth, canvasHeight));
    }

    return positions;
  }
}

/** 全局单例 */
export const layoutEngine = new LayoutEngine();

// ─── 响应式自动重排 ───

export interface ReflowWidget {
  id: string;
  layout: WidgetLayout; // 桌面端布局
}

/**
 * 按阅读顺序排序（从上到下、从左到右）
 */
function sortByReadingOrder(widgets: ReflowWidget[]): ReflowWidget[] {
  return [...widgets].sort((a, b) => {
    const ay = a.layout.row + a.layout.rowSpan / 2;
    const by = b.layout.row + b.layout.rowSpan / 2;
    if (Math.abs(ay - by) < 0.5) {
      return (a.layout.col + a.layout.colSpan / 2) - (b.layout.col + b.layout.colSpan / 2);
    }
    return ay - by;
  });
}

/**
 * 将桌面端布局自动重排到目标断点网格。
 *
 * 策略：
 *   - 1 列（手机）：单列堆叠，每个 widget 撑满宽度，高度按原始宽高比推算
 *   - 2 列（平板）：左右交替填入，维持原始宽高比
 *   - 多列：同桌面端不重排（使用原始布局）
 *
 * @returns widgetId → WidgetLayout 的映射
 */
export function reflowToBreakpoint(
  widgets: ReflowWidget[],
  desktopGrid: GridConfig,
  targetGrid: GridConfig,
  canvasWidth: number,
  canvasHeight: number,
  hiddenIds: string[] = [],
): Record<string, WidgetLayout> {
  const visible = sortByReadingOrder(
    widgets.filter(w => !hiddenIds.includes(w.id)),
  );

  if (visible.length === 0) return {};

  const dg = desktopGrid.gap;
  const tg = targetGrid.gap;
  const cols = targetGrid.cols;

  // 桌面端 cell 尺寸
  const deskCW = (canvasWidth - dg * (desktopGrid.cols + 1)) / desktopGrid.cols;
  const deskCH = (canvasHeight - dg * (desktopGrid.rows + 1)) / desktopGrid.rows;

  // 目标网格 cell 尺寸（用画布高度和桌面端行数计算，保持 cell 高度一致）
  const targetCW = (canvasWidth - tg * (cols + 1)) / cols;
  const targetCH = deskCH; // 同一个画布，cell 高度一致

  // row 0 保留给顶栏，组件从顶栏之后开始
  const hRows = cols >= 8 ? 1 : cols >= 2 ? 4 : 7;

  const result: Record<string, WidgetLayout> = {};
  const colRows: number[] = new Array(cols).fill(hRows);

  // ── 单列模式（手机）：堆叠，维持原始宽高比 ──
  if (cols === 1) {
    let cursor = hRows;
    for (const w of visible) {
      // 桌面端原始像素尺寸
      const pixelW = w.layout.colSpan * deskCW + (w.layout.colSpan - 1) * dg;
      const pixelH = w.layout.rowSpan * deskCH + (w.layout.rowSpan - 1) * dg;
      const ratio = pixelW > 0 ? pixelH / pixelW : 1;

      // 目标像素：满宽
      const targetPW = targetCW;
      const targetPH = targetPW * ratio;

      // 像素高度 → 行数
      const rowSpan = Math.max(2, Math.round((targetPH + tg) / (targetCH + tg)));
      result[w.id] = { col: 0, row: cursor, colSpan: 1, rowSpan };
      cursor += rowSpan;
    }
    return result;
  }

  // ── 多列模式（平板）：交替填入各列 ──
  for (const w of visible) {
    let minCol = 0;
    for (let c = 1; c < cols; c++) {
      if (colRows[c] < colRows[minCol]) minCol = c;
    }

    const pixelW = w.layout.colSpan * deskCW + (w.layout.colSpan - 1) * dg;
    const pixelH = w.layout.rowSpan * deskCH + (w.layout.rowSpan - 1) * dg;
    const ratio = pixelW > 0 ? pixelH / pixelW : 1;

    const targetColSpan = Math.min(w.layout.colSpan, cols - minCol);
    const targetPW = targetColSpan * targetCW + (targetColSpan - 1) * tg;
    const targetPH = targetPW * ratio;
    const rowSpan = Math.max(1, Math.round((targetPH + tg) / (targetCH + tg)));

    result[w.id] = {
      col: minCol,
      row: colRows[minCol],
      colSpan: targetColSpan,
      rowSpan,
    };
    colRows[minCol] += rowSpan;
  }

  return result;
}
