import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

interface HistogramWidgetProps {
  /** 原始数值数组 — 组件内部自动分箱（对应 VictoryHistogram 的 data） */
  data?: number[];
  /** 分箱数量 */
  binCount?: number;
  barColor?: string;
}

// 钟形分布示例数据（60 个样本，均值 50 附近）
const DEFAULT_DATA: number[] = [
  35, 42, 38, 51, 47, 55, 60, 44, 49, 53, 58, 46, 52, 41, 57,
  50, 48, 54, 39, 56, 45, 59, 43, 50, 61, 47, 52, 49, 55, 44,
  51, 57, 46, 53, 48, 42, 50, 56, 45, 54, 49, 58, 47, 52, 40,
  55, 51, 46, 59, 48, 53, 44, 50, 57, 49, 54, 43, 52, 47, 60,
];

/** 分箱：把原始数值按区间统计频数 → [{name, value}] */
function binData(values: number[], binCount: number) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  // 所有值相同 → 单箱
  if (min === max) {
    return [{ name: String(min), value: values.length }];
  }
  const n = Math.max(1, Math.min(binCount || 10, values.length));
  const width = (max - min) / n;
  const counts = new Array(n).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= n) idx = n - 1;  // max 归入最后一箱
    counts[idx]++;
  }
  const fmt = (x: number) => {
    const d = x % 1 === 0 ? 0 : 2;
    return x.toFixed(d);
  };
  return counts.map((c, i) => ({
    name: `${fmt(min + i * width)}~${fmt(min + (i + 1) * width)}`,
    value: c,
  }));
}

/**
 * HistogramWidget — 直方图（频率分布柱状图），对应 VictoryHistogram。
 * 输入原始数值数组，组件内部自动分箱统计频数，ECharts bar 渲染。
 * 严格复用 useECharts 基础设施，渲染模式与 BarChartWidget 完全一致。
 */
export function HistogramWidget({
  data,
  binCount = 10,
  barColor = '#00D4FF',
}: HistogramWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const values = data?.length ? data : DEFAULT_DATA;
  const bins = binData(values, binCount);
  const binLabels = bins.map((b) => b.name);
  const binValues = bins.map((b) => b.value);

  useEffect(() => {
    const dataMax = binValues.length ? Math.max(...binValues) : 0;
    // Math.ceil 取整：避免 11 * 1.15 = 12.649999999999999 的浮点刻度显示
    const yMax = dataMax > 0 ? Math.ceil(dataMax * 1.15) : undefined;

    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => `${p.name}<br/>频数: ${p.value}`,
      },
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: binLabels,
        axisLabel: { color: '#9E9EA8', fontSize: 9, interval: Math.max(0, Math.ceil(binLabels.length / 8) - 1) },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'value' as const,
        max: yMax,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: {
          color: '#9E9EA8', fontSize: 10,
          // 清理浮点误差刻度（如 12.649999999999999 → 12.65）
          formatter: (v: number) => String(Math.round(v * 100) / 100),
        },
      },
      series: [{
        name: '频数', type: 'bar' as const, data: binValues,
        barCategoryGap: '10%',
        itemStyle: {
          borderRadius: [2, 2, 0, 0] as [number, number, number, number],
          color: {
            type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: barColor }, { offset: 1, color: `${barColor}33` }],
          },
        },
        animation: animated, animationDuration: animated ? 800 : 0,
        animationDelay: animated ? (idx: number) => idx * 40 : undefined,
        emphasis: { itemStyle: { color: '#FF8C42' } },
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      // 首帧零基线入场动画
      setOption({ ...opt(false), series: [{ name: '频数', type: 'bar' as const, data: binValues.map(() => 0), barCategoryGap: '10%' }] }, true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(binLabels), JSON.stringify(binValues), barColor]);

  return <div ref={chartRef} className="w-full h-full" />;
}
