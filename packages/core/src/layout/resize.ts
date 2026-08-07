import type { GridConfig } from '@hugescreen/shared';
import type { GridCell } from './index';

/**
 * 自由网格 resize 数学（纯函数，不依赖 React/registry）。
 * 由 ScreenCanvas 的 ResizeHandles 与 PropertyInspector 数字输入共用。
 */

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface CellMinMax {
  colSpan: number;
  rowSpan: number;
}

/**
 * 网格边界 clamp：
 *   - col/row 钳制到网格内（row 下限由 rowMin 保护顶栏）
 *   - 默认（resize 语义）：span 先收缩到网格剩余空间；已到 min 仍超界 → 平移收进
 *   - preferShift（拖拽移动/放置语义）：**保持 span 不变**，超界直接平移收进 ——
 *     拖拽改变位置绝不能影响组件大小
 *   - max 为可选上限（注册 maxSize，网格本身也天然限宽）
 */
export function clampToGrid(
  cell: GridCell,
  grid: GridConfig,
  min?: CellMinMax,
  max?: CellMinMax,
  rowMin = 1,
  preferShift = false,
): GridCell {
  let { col, row, colSpan, rowSpan } = cell;

  // 下限
  const minC = min?.colSpan ?? 1;
  const minR = min?.rowSpan ?? 1;
  colSpan = Math.max(minC, colSpan);
  rowSpan = Math.max(minR, rowSpan);

  // 上限（注册 maxSize 与网格共同限制）
  const maxC = Math.min(max?.colSpan ?? grid.cols, grid.cols);
  const maxR = Math.min(max?.rowSpan ?? grid.rows, grid.rows);
  colSpan = Math.min(maxC, colSpan);
  rowSpan = Math.min(maxR, rowSpan);

  // 行下限（顶栏保护）；列下限 0（防拖拽偏移校正产生负 col → 组件左半出屏）
  row = Math.max(rowMin, row);
  col = Math.max(0, col);

  if (preferShift) {
    // ★ 移动语义：保持尺寸，超界仅平移收进（拖拽改变位置不影响大小）
    if (col + colSpan > grid.cols) col = grid.cols - colSpan;
    if (row + rowSpan > grid.rows) row = grid.rows - rowSpan;
    return { col, row, colSpan, rowSpan };
  }

  // 先尝试收缩 span 收进网格
  if (col + colSpan > grid.cols) colSpan = Math.max(minC, grid.cols - col);
  if (row + rowSpan > grid.rows) rowSpan = Math.max(minR, grid.rows - row);

  // span 已到下限仍超界 → 平移收进
  if (col + colSpan > grid.cols) col = grid.cols - colSpan;
  if (row + rowSpan > grid.rows) row = grid.rows - rowSpan;

  return { col, row, colSpan, rowSpan };
}

/**
 * 手柄拖拽 → 新 layout。
 *
 * 核心不变量：**锚边不动**。
 *   - 含 'e'：右边界移动 → colSpan = colEnd − start.col
 *   - 含 'w'：左边界移动、右边界锚定 → col 移动，colSpan 相应增减
 *   - 's'/'n' 同理（'n' 的 row 下限由 rowMin=1 保护顶栏）
 * 最后统一 clampToGrid（min/max/网格边界）。
 */
export function resizeCellFromHandle(
  current: GridCell,
  handle: ResizeHandle,
  dxCells: number,
  dyCells: number,
  grid: GridConfig,
  min: CellMinMax,
  max: CellMinMax,
  rowMin = 1,
): GridCell {
  const right = current.col + current.colSpan; // 锚定右边界
  const bottom = current.row + current.rowSpan; // 锚定下边界

  let { col, row, colSpan, rowSpan } = current;

  // ── 水平（e / w / ne / nw / se / sw 含横轴）──
  if (handle.includes('e')) {
    colSpan = Math.max(1, right - current.col + dxCells);
  } else if (handle.includes('w')) {
    col = current.col + dxCells;
    // 右边界锚定：colSpan = right − col；col 越界时先 clamp 再算 span
    colSpan = right - col;
    if (col < 0) { colSpan += col; col = 0; }
    if (colSpan < 1) { colSpan = 1; col = right - 1; }
  }

  // ── 垂直（s / n / 斜角）──
  if (handle.includes('s')) {
    rowSpan = Math.max(1, bottom - current.row + dyCells);
  } else if (handle.includes('n')) {
    row = current.row + dyCells;
    rowSpan = bottom - row;
    if (row < rowMin) { rowSpan += row - rowMin; row = rowMin; }
    if (rowSpan < 1) { rowSpan = 1; row = bottom - 1; }
  }

  return clampToGrid({ col, row, colSpan, rowSpan }, grid, min, max, rowMin);
}
