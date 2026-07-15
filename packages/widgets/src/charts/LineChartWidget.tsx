import { useEffect } from 'react';
import { useECharts, echarts } from './useECharts';

interface LineChartWidgetProps {
  title?: string;
  /** 数据：{ name, data: number[] }[] */
  series?: { name: string; data: number[] }[];
  /** X 轴标签 */
  xLabels?: string[];
  /** 是否平滑曲线 */
  smooth?: boolean;
  /** 是否显示面积 */
  showArea?: boolean;
}

/**
 * 折线图组件
 */
export function LineChartWidget({
  title,
  series = [
    { name: '系列1', data: [120, 200, 150, 80, 70, 110, 130] },
  ],
  xLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  smooth = true,
  showArea = true,
}: LineChartWidgetProps) {
  const { chartRef, setOption } = useECharts();

  useEffect(() => {
    setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#161b2a',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#8892a4', fontSize: 11 },
      },
      grid: {
        left: 8,
        right: 16,
        top: title ? 8 : 4,
        bottom: 28,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: false },
        axisLabel: { color: '#8892a4', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#8892a4', fontSize: 10 },
      },
      series: series.map((s) => ({
        name: s.name,
        type: 'line',
        data: s.data,
        smooth,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 },
        areaStyle: showArea
          ? {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(126,184,218,0.15)' },
                { offset: 1, color: 'rgba(126,184,218,0.01)' },
              ]),
            }
          : undefined,
      })),
    }, true);
  }, [series, xLabels, smooth, showArea, title]);

  return <div ref={chartRef} className="w-full h-full" />;
}
