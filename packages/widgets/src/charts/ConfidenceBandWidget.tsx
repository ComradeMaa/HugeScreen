import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

interface ConfidenceBandWidgetProps {
  xLabels?: string[];
  /** 主线数据 */
  mainSeries?: { name: string; data: number[] };
  /** 上界数组 */
  upper?: number[];
  /** 下界数组 */
  lower?: number[];
  /** 区间填充颜色 */
  bandColor?: string;
  /** 主线颜色 */
  lineColor?: string;
  /** 刻度线对齐标签 */
  showTick?: boolean;
}

const DEFAULT_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DEFAULT_MAIN = { name: '观测值', data: [42, 45, 44, 48, 46, 50, 49] };
const DEFAULT_UPPER = [46, 49, 48, 53, 51, 55, 54];
const DEFAULT_LOWER = [38, 41, 40, 43, 41, 45, 44];

/**
 * ConfidenceBandWidget — 置信区间带图（主线 + 上下界区间填充）。
 * 对应 ECharts 官方 Confidence Band 示例：下界先 stack、上界后 stack 并带
 * areaStyle，stack 区域恰好等于 [下界, 上界] 区间；主线独立绘制。
 * 严格复用 useECharts 基础设施。
 */
export function ConfidenceBandWidget({
  xLabels,
  mainSeries,
  upper,
  lower,
  bandColor = '#00D4FF',
  lineColor = '#00D4FF',
  showTick = true,
}: ConfidenceBandWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const labels = xLabels?.length ? xLabels : DEFAULT_LABELS;
  const main = mainSeries?.data?.length ? mainSeries : { name: '观测值', data: DEFAULT_MAIN.data };
  const up = upper?.length ? upper : DEFAULT_UPPER;
  const low = lower?.length ? lower : DEFAULT_LOWER;

  useEffect(() => {
    const opt = (animated: boolean, zero = false) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        axisPointer: { type: 'line' as const, lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      },
      legend: { show: false },
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category' as const, data: labels,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick, alignWithLabel: showTick },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        axisTick: { show: showTick },
      },
      series: [
        // 下界：先 stack（占位 0~lower），淡色边界线
        {
          name: '下界', type: 'line' as const, stack: 'confidence-band' as const,
          data: zero ? low.map(() => 0) : low,
          symbol: 'none', smooth: true,
          lineStyle: { color: bandColor, opacity: 0.25, width: 1 },
          silent: true, tooltip: { show: false },
        },
        // 上界：后 stack + areaStyle → 填充 [lower, upper] 区间
        {
          name: '上界', type: 'line' as const, stack: 'confidence-band' as const,
          data: zero ? up.map(() => 0) : up,
          symbol: 'none', smooth: true,
          lineStyle: { opacity: 0 },
          areaStyle: { color: `${bandColor}3d` },
          silent: true, tooltip: { show: false },
        },
        // 主线：独立绘制
        {
          name: main.name || '主线', type: 'line' as const,
          data: zero ? main.data.map(() => 0) : main.data,
          smooth: true,
          symbol: 'circle', symbolSize: 5,
          lineStyle: { color: lineColor, width: 2 },
          itemStyle: { color: lineColor },
          emphasis: { itemStyle: { color: '#FF8C42' } },
          animation: animated, animationDuration: animated ? 800 : 0,
        },
      ],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false, true), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(labels), JSON.stringify(main), JSON.stringify(up), JSON.stringify(low), bandColor, lineColor, showTick]);

  return <div ref={chartRef} className="w-full h-full" />;
}
