import type { CompositeLayoutTemplate, CompositeSubChartType, CompositeConfig, CompositeSlotConfig } from '@hugescreen/shared';
import { widgetRegistry } from '@hugescreen/core';
import { getCompositeConfig } from './compositeConfigStore';

/** All available layout templates */
export const LAYOUT_TEMPLATES: CompositeLayoutTemplate[] = [
  '2col',
  '2row',
  '3col',
  '2x2',
  '1top2bottom',
  '1left2right',
  'topNarrow',
  'sandwich',
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
  'sandwich': 3,
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
  // 上 1/8 窄条 + 中 6/8 + 下 1/8 窄条：8 行 × 4 列，3 槽位
  'sandwich':      '"a a a a" "b b b b" "b b b b" "b b b b" "b b b b" "b b b b" "b b b b" "c c c c"',
};

/** Grid column count per template */
const TEMPLATE_COLUMNS: Record<CompositeLayoutTemplate, number> = {
  '2col': 4, '2row': 4, '3col': 6, '2x2': 4, '1top2bottom': 4, '1left2right': 4, 'topNarrow': 4, 'sandwich': 4,
};

/** Grid row count per template */
const TEMPLATE_ROWS: Record<CompositeLayoutTemplate, number> = {
  '2col': 4, '2row': 4, '3col': 4, '2x2': 4, '1top2bottom': 4, '1left2right': 4, 'topNarrow': 8, 'sandwich': 8,
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
  'sandwich': '三明治',
};

/** Display name for sub-chart types — 动态从 widgetRegistry 获取 */
export function getSubChartLabel(type: string): string {
  const def = widgetRegistry.get(type);
  return def?.name || type;
}

/** 所有已注册的 widget 类型均可用作组合成员 */
export function getValidSubTypes(): string[] {
  return widgetRegistry.getAll().map(d => d.type);
}

/**
 * 递归内联：遍历 slots，对每个引用自定义组合组件的槽位，
 * 将其 CompositeConfig 完整拷贝到 inlineComposite 字段，
 * 使该槽位成为「快照副本」——源组件被删除后渲染不受影响。
 */
export function deepInlineSlots(config: CompositeConfig, maxDepth = 4): CompositeConfig {
  if (maxDepth <= 0) return config;
  return {
    ...config,
    slots: config.slots.map((slot): CompositeSlotConfig => {
      const def = widgetRegistry.get(slot.chartType);
      const stored = def?.category === 'custom' ? getCompositeConfig(slot.chartType) : null;
      if (stored && slot.chartType) {
        return {
          ...slot,
          inlineComposite: deepInlineSlots(stored, maxDepth - 1),
        };
      }
      return slot;
    }),
  };
}

/** Check if a template fits within the given grid dimensions */
export function isTemplateViableForSize(
  template: CompositeLayoutTemplate,
  colSpan: number,
  rowSpan: number,
): boolean {
  const minCols: Record<CompositeLayoutTemplate, number> = {
    '2col': 3, '2row': 2, '3col': 4, '2x2': 4, '1top2bottom': 3, '1left2right': 3, 'topNarrow': 2, 'sandwich': 3,
  };
  const minRows: Record<CompositeLayoutTemplate, number> = {
    '2col': 2, '2row': 3, '3col': 2, '2x2': 3, '1top2bottom': 3, '1left2right': 3, 'topNarrow': 3, 'sandwich': 5,
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
