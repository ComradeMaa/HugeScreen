import type { GridConfig } from '@hugescreen/shared';

/**
 * 自由网格布局：组件在网格上任意放置/拉伸（col/row/colSpan/rowSpan 自由），
 * 重叠由 editorStore 的 computePlacement 自动避让。无固定槽位概念。
 * 初始配置走 defaultScreenConfig.json（createInitialConfig）。
 */

/** 默认网格：8列 × 7行（row 0 为顶部标题栏，组件从 row 1 起） */
export const DEFAULT_GRID: GridConfig = {
  cols: 8,
  rows: 7,
  gap: 8,
  snapToGrid: true,
};
