import type { CompositeLayoutTemplate, CompositeSubChartType } from '@hugescreen/shared';

/** All available layout templates */
export const LAYOUT_TEMPLATES: CompositeLayoutTemplate[] = [
  '2col',
  '2row',
  '3col',
  '2x2',
  '1top2bottom',
  '1left2right',
  'topNarrow',
];

/** Number of sub-slots per template */
export const TEMPLATE_SLOT_COUNTS: Record<CompositeLayoutTemplate, number> = {
  '2col': 2,
  '2row': 2,
  '3col': 3,
  '2x2': 4,
  '1top2bottom': 3,
  '1left2right': 3,
  'topNarrow': 2,
};

/** CSS grid-template-areas for each template */
export const TEMPLATE_GRID_AREAS: Record<CompositeLayoutTemplate, string> = {
  '2col':          '"a a b b" "a a b b" "a a b b" "a a b b"',
  '2row':          '"a a a a" "a a a a" "b b b b" "b b b b"',
  '3col':          '"a a b b c c" "a a b b c c" "a a b b c c" "a a b b c c"',
  '2x2':           '"a a b b" "a a b b" "c c d d" "c c d d"',
  '1top2bottom':   '"a a a a" "a a a a" "b b c c" "b b c c"',
  '1left2right':   '"a a b b" "a a b b" "a a c c" "a a c c"',
  // 上 1/8 窄条 + 下 7/8：8 行 × 4 列
  'topNarrow':     '"a a a a" "b b b b" "b b b b" "b b b b" "b b b b" "b b b b" "b b b b" "b b b b"',
};

/** Grid column count per template */
const TEMPLATE_COLUMNS: Record<CompositeLayoutTemplate, number> = {
  '2col': 4, '2row': 4, '3col': 6, '2x2': 4, '1top2bottom': 4, '1left2right': 4, 'topNarrow': 4,
};

/** Grid row count per template */
const TEMPLATE_ROWS: Record<CompositeLayoutTemplate, number> = {
  '2col': 4, '2row': 4, '3col': 4, '2x2': 4, '1top2bottom': 4, '1left2right': 4, 'topNarrow': 8,
};

/** Human-readable labels */
export const TEMPLATE_LABELS: Record<CompositeLayoutTemplate, string> = {
  '2col': '两列',
  '2row': '两行',
  '3col': '三列',
  '2x2': '田字格',
  '1top2bottom': '上一下二',
  '1left2right': '左一右二',
  'topNarrow': '上窄条',
};

/** Display name for sub-chart types */
export const SUB_CHART_LABELS: Record<CompositeSubChartType, string> = {
  'line-chart': '折线图',
  'bar-chart': '柱状图',
  'bar-line-chart': '柱线组合图',
  'pie-chart': '饼图',
  'stat-card': '统计卡',
};

/** Valid sub-chart types (only regular widgets, no header elements) */
export const VALID_SUB_TYPES: CompositeSubChartType[] = [
  'line-chart',
  'bar-chart',
  'bar-line-chart',
  'pie-chart',
  'stat-card',
];

/** Check if a template fits within the given grid dimensions */
export function isTemplateViableForSize(
  template: CompositeLayoutTemplate,
  colSpan: number,
  rowSpan: number,
): boolean {
  const minCols: Record<CompositeLayoutTemplate, number> = {
    '2col': 3, '2row': 2, '3col': 4, '2x2': 4, '1top2bottom': 3, '1left2right': 3, 'topNarrow': 2,
  };
  const minRows: Record<CompositeLayoutTemplate, number> = {
    '2col': 2, '2row': 3, '3col': 2, '2x2': 3, '1top2bottom': 3, '1left2right': 3, 'topNarrow': 3,
  };
  return colSpan >= minCols[template] && rowSpan >= minRows[template];
}

/** Get the number of columns for the grid container */
export function templateColumns(template: CompositeLayoutTemplate): number {
  return TEMPLATE_COLUMNS[template];
}

/** Get the number of rows for the grid container */
export function templateRows(template: CompositeLayoutTemplate): number {
  return TEMPLATE_ROWS[template];
}
