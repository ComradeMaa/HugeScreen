import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface LargeAreaPoint {
  /** 时间戳 (ms) */
  time: number;
  value: number;
}

interface LargeAreaChartWidgetProps {
  /** 时间序列数据 [时间戳, 数值] 对 — 对应 ECharts Large scale area chart */
  points?: LargeAreaPoint[];
  lineColor?: string;
  areaColor?: string;
  /** 降采样算法（大数据量性能优化） */
  sampling?: 'lttb' | 'average' | 'max' | 'min' | 'sum' | 'none';
  /** 刻度线（y 轴 value 刻度） */
  showTick?: boolean;
}

/** 生成模拟时序数据：sin 波动 + 噪声 */
export function genMockTimeSeries(count: number, start = Date.now() - count * 3600_000): LargeAreaPoint[] {
  const pts: LargeAreaPoint[] = [];
  let v = 100;
  for (let i = 0; i < count; i++) {
    v += Math.sin(i / 25) * 2.5 + (Math.sin(i / 7) * 0.8) + (Math.random() - 0.5) * 3;
    pts.push({ time: start + i * 3600_000, value: Math.round(v * 10) / 10 });
  }
  return pts;
}

const DEFAULT_POINTS = genMockTimeSeries(600);

/**
 * LargeAreaChartWidget — 大规模面积图（时间序列）。
 * 对应 ECharts 官方 Large scale area chart：
 *   - x 轴 type: 'time'（时间戳数据对 [time, value]）
 *   - sampling: 'lttb' 降采样 + progressive 增量渲染（大数据量流畅）
 *   - areaStyle 渐变面积
 * 严格复用 useECharts 基础设施。
 */
export function LargeAreaChartWidget({
  points,
  lineColor = '#00D4FF',
  areaColor = '#00D4FF',
  sampling = 'lttb',
  showTick = true,
}: LargeAreaChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const pts = points?.length ? points : DEFAULT_POINTS;
  // 排序（时间轴要求递增）
  const sorted = [...pts].sort((a, b) => a.time - b.time);
  // [time, value] 对（ECharts time 轴原生格式）
  const pairs: [number, number][] = sorted.map((p) => [p.time, p.value]);

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
        valueFormatter: (v: unknown) => String(v),
      },
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      xAxis: {
        type: 'time' as const,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick },
        axisLabel: { color: '#9E9EA8', fontSize: 10, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        axisTick: { show: showTick },
      },
      series: [{
        type: 'line' as const,
        name: '数值',
        data: zero ? pairs.map(([, v]) => [pairs[0]?.[0] ?? 0, 0] as [number, number]) : pairs,
        showSymbol: false,
        sampling: sampling === 'none' ? undefined : (sampling as 'lttb'),
        progressive: 10000,
        progressiveThreshold: 3000,
        lineStyle: { color: lineColor, width: 0.8 },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${areaColor}59` },
            { offset: 1, color: `${areaColor}0a` },
          ]),
        },
        animation: animated, animationDuration: animated ? 800 : 0,
      }],
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
  }, [JSON.stringify(pairs), lineColor, areaColor, sampling, showTick]);

  return <div ref={chartRef} className="w-full h-full" />;
}
