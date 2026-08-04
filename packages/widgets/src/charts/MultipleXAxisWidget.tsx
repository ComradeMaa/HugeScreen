import { useEffect, useState } from 'react';
import { useECharts } from './useECharts';

export interface AxisLineData {
  /** 轴标签（category） */
  labels?: string[];
  /** 折线数值 */
  values?: number[];
}

interface MultipleXAxisWidgetProps {
  /** 底部轴折线数据 */
  bottom?: AxisLineData;
  /** 顶部轴折线数据 */
  top?: AxisLineData;
  /** 底部折线颜色 */
  bottomColor?: string;
  /** 顶部折线颜色 */
  topColor?: string;
  /** 平滑曲线 */
  smooth?: boolean;
  /** 显示图例 */
  showLegend?: boolean;
  /** 轴标签旋转角度 */
  labelRotate?: number;
  /** 显示轴标签 */
  showAxisLabel?: boolean;
}

const DEFAULT_BOTTOM: AxisLineData = {
  labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  values: [12, 23, 34, 45, 56, 67, 78],
};
const DEFAULT_TOP: AxisLineData = {
  labels: ['甲', '乙', '丙', '丁', '戊', '己', '庚'],
  values: [11.2, 6.3, 4.5, 5.7, 12.4, 15.7, 3.5],
};

/**
 * MultipleXAxisWidget — 多 X 轴走势图（参考 ECharts Multiple X Axes）。
 * 两个重叠 grid：底部 category 轴承载一条折线，顶部 category 轴承载另一条，
 * 两条折线在共享绘图区呈十字交叉。顶部轴需 position:'top' + axisLine.onZero:false。
 * 严格复用 useECharts 基础设施。
 */
export function MultipleXAxisWidget({
  bottom,
  top,
  bottomColor = '#00D4FF',
  topColor = '#FF8C42',
  smooth = true,
  showLegend = true,
  labelRotate = 20,
  showAxisLabel = true,
}: MultipleXAxisWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const bottomData: AxisLineData = bottom?.labels?.length || bottom?.values?.length ? bottom : DEFAULT_BOTTOM;
  const topData: AxisLineData = top?.labels?.length || top?.values?.length ? top : DEFAULT_TOP;
  const bottomLabels = bottomData.labels?.length ? bottomData.labels : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const topLabels = topData.labels?.length ? topData.labels : ['甲', '乙', '丙', '丁', '戊', '己', '庚'];
  const bottomValues = bottomData.values?.length ? bottomData.values : DEFAULT_BOTTOM.values!;
  const topValues = topData.values?.length ? topData.values : DEFAULT_TOP.values!;

  useEffect(() => {
    const axisLabelStyle = {
      rotate: labelRotate,
      show: showAxisLabel,
      color: '#9E9EA8',
      fontSize: 10,
    };

    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      legend: {
        show: showLegend,
        top: 2,
        right: 8,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#9E9EA8', fontSize: 10 },
      },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      // 两个完全重叠的绘图区：grid0 底部轴折线，grid1 顶部轴折线
      grid: [
        { left: 8, right: 8, top: 30, bottom: 8, containLabel: true },
        { left: 8, right: 8, top: 30, bottom: 8, containLabel: true },
      ],
      xAxis: [
        {
          type: 'category' as const,
          gridIndex: 0,
          data: bottomLabels,
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
          axisTick: { show: false },
          axisLabel: axisLabelStyle,
        },
        {
          type: 'category' as const,
          gridIndex: 1,
          position: 'top' as const,
          data: topLabels,
          axisLine: { onZero: false, lineStyle: { color: 'rgba(255,255,255,0.15)' } },
          axisTick: { show: false },
          axisLabel: axisLabelStyle,
        },
      ],
      yAxis: [
        {
          type: 'value' as const,
          gridIndex: 0,
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
          axisLabel: { color: '#9E9EA8', fontSize: 10 },
        },
        {
          type: 'value' as const,
          gridIndex: 1,
          position: 'right' as const,
          splitLine: { show: false },
          axisLabel: { color: '#9E9EA8', fontSize: 10 },
        },
      ],
      series: [
        {
          name: '底部',
          type: 'line' as const,
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: bottomValues,
          smooth,
          showSymbol: true,
          symbolSize: 5,
          lineStyle: { width: 2, color: bottomColor },
          itemStyle: { color: bottomColor },
          emphasis: { focus: 'series' as const },
        },
        {
          name: '顶部',
          type: 'line' as const,
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: topValues,
          smooth,
          showSymbol: true,
          symbolSize: 5,
          lineStyle: { width: 2, color: topColor },
          itemStyle: { color: topColor },
          emphasis: { focus: 'series' as const },
        },
      ],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify([bottomLabels, bottomValues, topLabels, topValues]), bottomColor, topColor, smooth, showLegend, labelRotate, showAxisLabel]);

  return <div ref={chartRef} className="w-full h-full" />;
}
