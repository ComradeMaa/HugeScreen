import { lazy } from 'react';
import { widgetRegistry } from '@hugescreen/core';

export function registerBuiltinWidgets(): void {
  widgetRegistry.registerAll([
    // ─── 统计卡 ───
    {
      type: 'stat-card',
      name: '统计卡',
      description: '关键指标数值及趋势',
      icon: 'TrendingUp',
      category: 'stat',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 1, rowSpan: 1 },
      maxSize: { colSpan: 4, rowSpan: 3 },
      component: lazy(() => import('./stat-card/StatCard').then(m => ({ default: m.StatCard }))),
      configSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', title: '标题' },
          value: { type: 'number', title: '数值' },
          format: { type: 'string', title: '格式', enum: ['number', 'currency', 'percent'] },
        },
      },
      defaultConfig: { title: '指标', value: 0, format: 'number' },
    },

    // ─── 折线图 ───
    {
      type: 'line-chart',
      name: '折线图',
      description: '数据趋势变化',
      icon: 'LineChart',
      category: 'chart',
      defaultSize: { colSpan: 4, rowSpan: 6 },
      minSize: { colSpan: 2, rowSpan: 2 },
      maxSize: { colSpan: 8, rowSpan: 6 },
      component: lazy(() => import('./charts/LineChartWidget').then(m => ({ default: m.LineChartWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          smooth: { type: 'boolean', title: '平滑曲线' },
          showArea: { type: 'boolean', title: '显示面积' },
        },
      },
      defaultConfig: { smooth: true, showArea: true },
    },

    // ─── 柱状图 ───
    {
      type: 'bar-chart',
      name: '柱状图',
      description: '竖向对比分类数据',
      icon: 'BarChart3',
      category: 'chart',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 2, rowSpan: 1 },
      maxSize: { colSpan: 4, rowSpan: 3 },
      component: lazy(() => import('./charts/BarChartWidget').then(m => ({ default: m.BarChartWidget }))),
      configSchema: { type: 'object', properties: {} },
      defaultConfig: { direction: 'vertical' },
    },

    // ─── 条形图 ───
    {
      type: 'bar-chart-h',
      name: '条形图',
      description: '横向排名对比',
      icon: 'BarChartHorizontal',
      category: 'chart',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 2, rowSpan: 1 },
      maxSize: { colSpan: 4, rowSpan: 3 },
      component: lazy(() => import('./charts/BarChartWidget').then(m => ({ default: m.BarChartWidget }))),
      configSchema: { type: 'object', properties: {} },
      defaultConfig: { direction: 'horizontal' },
    },

    // ─── 饼图 ───
    {
      type: 'pie-chart',
      name: '饼图',
      description: '占比分布环形图',
      icon: 'PieChart',
      category: 'chart',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 2, rowSpan: 2 },
      maxSize: { colSpan: 3, rowSpan: 3 },
      component: lazy(() => import('./charts/PieChartWidget').then(m => ({ default: m.PieChartWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          donut: { type: 'boolean', title: '环形' },
          showLegend: { type: 'boolean', title: '图例' },
        },
      },
      defaultConfig: { donut: true, showLegend: true },
    },
  ]);

  console.log(
    `[Widgets] ${widgetRegistry.getAll().length} widgets ready:`,
    widgetRegistry.getAll().map(w => w.type).join(', '),
  );
}
