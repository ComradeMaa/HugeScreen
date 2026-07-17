import { useEffect } from 'react';
import { useECharts, echarts } from './useECharts';

export interface LineSeries {
  name: string;
  data: number[];
}

interface LineChartWidgetProps {
  title?: string;
  /** 旧接口：直接传入 series */
  series?: { name: string; data: number[] }[];
  /** 旧接口：X 轴标签 */
  xLabels?: string[];
  /** 新接口：可编辑的系列数据（优先） */
  lineSeries?: LineSeries[];
  /** 是否平滑曲线 */
  smooth?: boolean;
  /** 是否显示面积 */
  showArea?: boolean;
}

const DEFAULT_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DEFAULT_SERIES: LineSeries[] = [
  { name: '系列1', data: [120, 200, 150, 80, 70, 110, 130] },
];

/** 多条线时的和谐色板 */
const LINE_COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#a78bfa', '#60a5fa', '#f59e0b'];

/**
 * 折线图组件
 */
export function LineChartWidget({
  title,
  series: oldSeries,
  xLabels: oldLabels,
  lineSeries,
  smooth = true,
  showArea = true,
}: LineChartWidgetProps) {
  const { chartRef, setOption } = useECharts();

  // lineSeries 优先，其次旧接口
  const lSeries: LineSeries[] = lineSeries && lineSeries.length > 0
    ? lineSeries
    : (oldSeries && oldSeries.length > 0
      ? oldSeries
      : DEFAULT_SERIES);
  const labels: string[] = oldLabels && oldLabels.length > 0
    ? oldLabels
    : DEFAULT_LABELS;

  // 若某系列节点数超出 x 轴标签数，自动补「未定义」
  const maxLen = Math.max(...lSeries.map(s => s.data.length), labels.length);
  const xData = labels.length >= maxLen
    ? labels
    : [...labels, ...Array.from({ length: maxLen - labels.length }, (_, i) => `未定义${i + 1}`)];

  // 自动适配 Y 轴范围
  const allVals = lSeries.flatMap(s => s.data);
  const dataMax = allVals.length > 0 ? Math.max(...allVals) : 0;
  const dataMin = allVals.length > 0 ? Math.min(...allVals) : 0;
  const yPad = Math.max((dataMax - dataMin) * 0.12, 10);

  useEffect(() => {
    setOption({
      animation: true,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#9E9EA8', fontSize: 11 },
      },
      color: LINE_COLORS,
      grid: {
        left: 8,
        right: 16,
        top: title ? 8 : 4,
        bottom: lSeries.length > 1 ? 28 : 4,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: false },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        min: dataMin > 0 ? Math.max(0, dataMin - yPad) : dataMin - yPad,
        max: dataMax + yPad,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      series: lSeries.map((s, i) => ({
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
                { offset: 0, color: `${LINE_COLORS[i % LINE_COLORS.length]}26` },
                { offset: 1, color: `${LINE_COLORS[i % LINE_COLORS.length]}03` },
              ]),
            }
          : undefined,
      })),
    }, true);
  }, [lSeries, xData, smooth, showArea, title, yPad, dataMax, dataMin]);

  return <div ref={chartRef} className="w-full h-full" />;
}
