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
