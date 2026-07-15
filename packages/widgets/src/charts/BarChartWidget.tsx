import { useEffect } from 'react';
import { useECharts } from './useECharts';

interface BarChartWidgetProps {
  title?: string;
  xLabels?: string[];
  series?: { name: string; data: number[] }[];
  /** 'vertical' | 'horizontal' */
  direction?: 'vertical' | 'horizontal';
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
}: BarChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const isHorizontal = direction === 'horizontal';

  useEffect(() => {
    const xAxis = isHorizontal
      ? { type: 'value' as const }
      : {
          type: 'category' as const,
          data: xLabels,
          axisLabel: { color: '#8892a4', fontSize: 10 },
        };

    const yAxis = isHorizontal
      ? {
          type: 'category' as const,
          data: xLabels,
          axisLabel: { color: '#8892a4', fontSize: 10 },
        }
      : {
          type: 'value' as const,
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
          axisLabel: { color: '#8892a4', fontSize: 10 },
        };

    const xAxisFull = isHorizontal
      ? { ...xAxis, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#8892a4', fontSize: 10 } }
      : { ...xAxis, axisTick: { show: false }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } };

    const yAxisFull = isHorizontal
      ? { ...yAxis, axisTick: { show: false }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } }
      : yAxis;

    setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#161b2a',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
      },
      grid: {
        left: 4,
        right: 16,
        top: 4,
        bottom: isHorizontal ? 4 : 24,
        containLabel: true,
      },
      xAxis: xAxisFull,
      yAxis: yAxisFull,
      series: series.map((s) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        barWidth: isHorizontal ? 12 : '50%',
        itemStyle: {
          borderRadius: isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: isHorizontal ? 1 : 0, y2: isHorizontal ? 0 : 1,
            colorStops: [
              { offset: 0, color: '#7eb8da' },
              { offset: 1, color: 'rgba(126,184,218,0.4)' },
            ],
          },
        },
        emphasis: {
          itemStyle: {
            color: '#c9a96e',
          },
        },
      })),
    }, true);
  }, [xLabels, series, isHorizontal]);

  return <div ref={chartRef} className="w-full h-full" />;
}
