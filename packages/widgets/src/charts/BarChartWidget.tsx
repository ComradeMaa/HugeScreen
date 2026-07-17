import { useEffect } from 'react';
import { useECharts } from './useECharts';

interface BarChartWidgetProps {
  title?: string;
  xLabels?: string[];
  series?: { name: string; data: number[] }[];
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

/**
 * 柱状图 / 条形图组件
 * direction: vertical = 竖向柱状图, horizontal = 横向条形图
 */
export function BarChartWidget({
  xLabels = DEFAULT_LABELS,
  series = [{ name: '数值', data: [182, 234, 165, 298, 210] }],
  direction = 'vertical',
  showLabel = false,
  labelFontSize = '10px',
  labelFontWeight = '600',
  labelColor = '#FF8C42',
  barWidth = '50%',
}: BarChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const isHorizontal = direction === 'horizontal';

  // 柱体粗细：百分比 → 竖向直接用，横向换算为 px
  const barPct = parseInt(barWidth) || 50;
  const barWidthPx = Math.round(barPct * 0.24); // 50% → 12px, 30% → 8px, 70% → 16px, 90% → 20px

  useEffect(() => {
    const xAxis = isHorizontal
      ? { type: 'value' as const }
      : {
          type: 'category' as const,
          data: xLabels,
          axisLabel: { color: '#9E9EA8', fontSize: 10 },
        };

    // 显示标签时，Y 轴最大值上浮 18% 留出标签空间，防止被挤出组件
    const allVals = series.flatMap((s) => s.data);
    const dataMax = allVals.length > 0 ? Math.max(...allVals) : 0;
    const yMax = !isHorizontal && showLabel && dataMax > 0 ? dataMax * 1.18 : undefined;

    const yAxis = isHorizontal
      ? {
          type: 'category' as const,
          data: xLabels,
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

    // 显示标签时增加顶部内边距，配合 containLabel 确保标签不被裁剪
    const gridTop = !isHorizontal && showLabel ? 20 : 4;

    setOption({
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
        bottom: isHorizontal ? 4 : 24,
        containLabel: true,
      },
      xAxis: xAxisFull,
      yAxis: yAxisFull,
      series: series.map((s) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
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
      })),
    }, true);
  }, [xLabels, series, isHorizontal, setOption, showLabel]);

  return <div ref={chartRef} className="w-full h-full" />;
}
