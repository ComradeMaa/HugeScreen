import { useEffect } from 'react';
import { useECharts } from './useECharts';

export interface BarCategory {
  name: string;
  value: number;
}

interface BarChartWidgetProps {
  title?: string;
  xLabels?: string[];
  series?: { name: string; data: number[] }[];
  /** 可编辑的类别数据（优先于 xLabels/series） */
  categories?: BarCategory[];
  /** 'vertical' | 'horizontal' */
  direction?: 'vertical' | 'horizontal';
  /** 是否在矩形尽头显示数值标签 */
  showLabel?: boolean;
  /** 数值标签字号 */
  labelFontSize?: string;
  /** 数值标签字重 */
  labelFontWeight?: string;
  /** 数值标签颜色 */
  labelColor?: string;
  /** 柱体粗细百分比（如 '50%'） */
  barWidth?: string;
}

const DEFAULT_LABELS = ['类别A', '类别B', '类别C', '类别D', '类别E'];
const DEFAULT_CATEGORIES: BarCategory[] = [
  { name: '类别A', value: 182 },
  { name: '类别B', value: 234 },
  { name: '类别C', value: 165 },
  { name: '类别D', value: 298 },
  { name: '类别E', value: 210 },
];

/** 超过此数量时启用 dataZoom 走马灯滚动 */
const ZOOM_THRESHOLD = 6;

/**
 * 柱状图 / 条形图组件
 * direction: vertical = 竖向柱状图, horizontal = 横向条形图
 */
export function BarChartWidget({
  xLabels,
  series,
  categories,
  direction = 'vertical',
  showLabel = false,
  labelFontSize = '10px',
  labelFontWeight = '600',
  labelColor = '#FF8C42',
  barWidth = '50%',
}: BarChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const isHorizontal = direction === 'horizontal';

  // categories 优先，其次 series/xLabels

  // categories 优先，其次 series/xLabels
  const cats: BarCategory[] = categories && categories.length > 0
    ? categories
    : (xLabels && series && series.length > 0
      ? xLabels.map((name, i) => ({ name, value: series[0]?.data[i] ?? 0 }))
      : DEFAULT_CATEGORIES);
  const catLabels = cats.map(c => c.name);
  const catValues = cats.map(c => c.value);

  // 柱体粗细：百分比 → 竖向直接用，横向换算为 px
  const barPct = parseInt(barWidth) || 50;
  const barWidthPx = Math.round(barPct * 0.24);

  useEffect(() => {
    const allVals = catValues;
    const dataMax = allVals.length > 0 ? Math.max(...allVals) : 0;
    // 显示标签时，数值轴留 18% 余量防止标签挤出组件
    const yMax = !isHorizontal && showLabel && dataMax > 0 ? dataMax * 1.18 : undefined;
    const xMax = isHorizontal && showLabel && dataMax > 0 ? dataMax * 1.18 : undefined;
    const needZoom = !isHorizontal && cats.length > ZOOM_THRESHOLD;

    const xAxis = isHorizontal
      ? { type: 'value' as const, max: xMax }
      : {
          type: 'category' as const,
          data: catLabels,
          axisLabel: { color: '#9E9EA8', fontSize: 10 },
        };

    const yAxis = isHorizontal
      ? {
          type: 'category' as const,
          data: catLabels,
          axisLabel: { color: '#9E9EA8', fontSize: 10 },
        }
      : {
          type: 'value' as const,
          max: yMax,
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
          axisLabel: { color: '#9E9EA8', fontSize: 10 },
        };

    const xAxisFull = isHorizontal
      ? { ...xAxis, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#9E9EA8', fontSize: 10 } }
      : { ...xAxis, axisTick: { show: false }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } };

    const yAxisFull = isHorizontal
      ? { ...yAxis, axisTick: { show: false }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } }
      : yAxis;

    const gridTop = !isHorizontal && showLabel ? 20 : 4;
    const gridBottom = needZoom ? 36 : (isHorizontal ? 4 : 24);

    setOption({
      animation: true,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      grid: {
        left: 4,
        right: 16,
        top: gridTop,
        bottom: gridBottom,
        containLabel: true,
      },
      // 类别过多时启用底部滑块走马灯
      dataZoom: needZoom
        ? [
            {
              type: 'slider',
              bottom: 2,
              height: 20,
              start: 0,
              end: Math.min(100, (ZOOM_THRESHOLD / cats.length) * 100),
              borderColor: 'rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(44,44,52,0.8)',
              fillerColor: 'rgba(0,212,255,0.12)',
              handleStyle: { color: '#00D4FF' },
              textStyle: { color: '#9E9EA8', fontSize: 9 },
            },
          ]
        : undefined,
      xAxis: xAxisFull,
      yAxis: yAxisFull,
      series: [
        {
          name: '数值',
          type: 'bar',
          data: catValues,
          barWidth: isHorizontal ? barWidthPx : barWidth,
          itemStyle: {
            borderRadius: isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
            color: {
              type: 'linear',
              x: 0, y: 0, x2: isHorizontal ? 1 : 0, y2: isHorizontal ? 0 : 1,
              colorStops: [
                { offset: 0, color: '#00D4FF' },
                { offset: 1, color: '#005566' },
              ],
            },
          },
          label: {
            show: showLabel,
            position: isHorizontal ? 'right' : 'top',
            color: labelColor,
            fontSize: parseInt(labelFontSize) || 10,
            fontWeight: parseInt(labelFontWeight) || 600,
          },
          emphasis: {
            itemStyle: {
              color: '#FF8C42',
            },
          },
        },
      ],
    }, true);
  }, [catLabels, catValues, isHorizontal, setOption, showLabel, cats]);

  return <div ref={chartRef} className="w-full h-full" />;
}
