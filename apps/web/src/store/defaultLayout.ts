import type { WidgetCategory, WidgetLayout } from '@hugescreen/shared';

export interface ScreenSlot {
  id: string;
  label: string;
  layout: WidgetLayout;
  defaultType: string;
  category: WidgetCategory;
  defaultData?: unknown;
  defaultOptions?: Record<string, unknown>;
  defaultStyle?: Record<string, unknown>;
}

/**
 * 驾驶舱布局：8列 × 7行
 *
 * Row 0 ──── 顶部标题栏 ────
 * ┌────────┬──────────────────────┬────────┐
 * │ 统计卡  │                      │ 统计卡  │  Row 1-2
 * │        │      ★ 核心区域 ★     │        │
 * ├────────┤      折线趋势图       ├────────┤
 * │ 饼图   │      4列 × 6行       │ 柱状图  │  Row 3-4
 * │        │                      │        │
 * ├────────┤                      ├────────┤
 * │ 条形图  │                      │ 统计卡  │  Row 5-6
 * └────────┴──────────────────────┴────────┘
 *  2 cols        4 cols             2 cols
 */
export const DEFAULT_SLOTS: ScreenSlot[] = [
  // ─── 核心区域（中间大字） ───
  {
    id: 'slot-center',
    label: '核心趋势',
    layout: { col: 2, row: 1, colSpan: 4, rowSpan: 6 },
    defaultType: 'line-chart',
    category: 'chart',
    defaultData: {
      xLabels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
      series: [
        { name: '访问量', data: [320, 480, 650, 580, 720, 890, 760] },
        { name: '订单量', data: [120, 200, 280, 240, 310, 380, 340] },
      ],
    },
    defaultOptions: { smooth: true, showArea: true },
    defaultStyle: { borderStyle: 'style1' },
  },

  // ─── 左列 ───
  {
    id: 'slot-left-1',
    label: '总访问量',
    layout: { col: 0, row: 1, colSpan: 2, rowSpan: 2 },
    defaultType: 'stat-card',
    category: 'stat',
    defaultData: { value: 128340, title: '总访问量', trend: 12.5, trendLabel: 'vs 昨日' },
    defaultOptions: { format: 'number' },
  },
  {
    id: 'slot-left-2',
    label: '来源分布',
    layout: { col: 0, row: 3, colSpan: 2, rowSpan: 2 },
    defaultType: 'pie-chart',
    category: 'chart',
    defaultData: {
      data: [
        { name: '直接访问', value: 3350 },
        { name: '搜索引擎', value: 2480 },
        { name: '社交媒体', value: 1620 },
        { name: '外部链接', value: 980 },
      ],
    },
    defaultOptions: { donut: true, showLegend: false },
  },
  {
    id: 'slot-left-3',
    label: '地域 TOP5',
    layout: { col: 0, row: 5, colSpan: 2, rowSpan: 2 },
    defaultType: 'bar-chart',
    category: 'chart',
    defaultData: {
      xLabels: ['北京', '上海', '深圳', '广州', '杭州'],
      series: [{ name: '销售额', data: [520, 480, 390, 350, 280] }],
    },
    defaultOptions: { direction: 'horizontal' },
  },

  // ─── 右列 ───
  {
    id: 'slot-right-1',
    label: '实时在线',
    layout: { col: 6, row: 1, colSpan: 2, rowSpan: 2 },
    defaultType: 'stat-card',
    category: 'stat',
    defaultData: { value: 3421, title: '实时在线', trend: -3.2, trendLabel: 'vs 上小时' },
    defaultOptions: { format: 'number' },
  },
  {
    id: 'slot-right-2',
    label: '品类对比',
    layout: { col: 6, row: 3, colSpan: 2, rowSpan: 2 },
    defaultType: 'bar-chart',
    category: 'chart',
    defaultData: {
      xLabels: ['品类A', '品类B', '品类C', '品类D', '品类E'],
      series: [{ name: '销量', data: [182, 234, 165, 298, 210] }],
    },
    defaultOptions: {},
  },
  {
    id: 'slot-right-3',
    label: '转化率',
    layout: { col: 6, row: 5, colSpan: 2, rowSpan: 2 },
    defaultType: 'stat-card',
    category: 'stat',
    defaultData: { value: 5.8, title: '转化率', suffix: '%', trend: 0.8, trendLabel: 'vs 昨日' },
    defaultOptions: { format: 'percent', decimals: 1 },
  },
];

/** 默认网格：8列 × 7行 */
export const DEFAULT_GRID = {
  cols: 8,
  rows: 7,
  gap: 8,
  snapToGrid: true,
};

/**
 * 标准槽位 — 画布上 7 个不可再分的基础区块。
 * 组件注册的默认尺寸应与此对齐；merge/swap 产生的多槽位布局可通过 reflow 重新分割。
 */
export const CANONICAL_SLOTS: WidgetLayout[] = [
  { col: 0, row: 1, colSpan: 2, rowSpan: 2 }, // left-1
  { col: 0, row: 3, colSpan: 2, rowSpan: 2 }, // left-2
  { col: 0, row: 5, colSpan: 2, rowSpan: 2 }, // left-3
  { col: 2, row: 1, colSpan: 4, rowSpan: 6 }, // center
  { col: 6, row: 1, colSpan: 2, rowSpan: 2 }, // right-1
  { col: 6, row: 3, colSpan: 2, rowSpan: 2 }, // right-2
  { col: 6, row: 5, colSpan: 2, rowSpan: 2 }, // right-3
];

/** 中央大区块（索引 3），永远不可被普通组件截断 */
export const CENTER_SLOT = CANONICAL_SLOTS[3];

/** 根据网格坐标查找所属的标准槽位 */
export function findSlotAt(col: number, row: number): WidgetLayout | null {
  return (
    CANONICAL_SLOTS.find(
      (s) =>
        col >= s.col && col < s.col + s.colSpan &&
        row >= s.row && row < s.row + s.rowSpan,
    ) ?? null
  );
}
