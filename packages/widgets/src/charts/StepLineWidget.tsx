import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface StepPoint {
  /** x 值：时间戳 (number) 或字符串标签（自动判断轴类型） */
  x: number | string;
  value: number;
}

interface StepLineWidgetProps {
  /** [x, value] 阶梯数据 — 对应 ECharts Step Line */
  points?: StepPoint[];
  /** 阶梯拐点位置 */
  step?: 'start' | 'middle' | 'end';
  lineColor?: string;
  /** 刻度线（y 轴 value 刻度；x 轴随轴类型） */
  showTick?: boolean;
}

const DEFAULT_POINTS: StepPoint[] = [
  { x: '周一', value: 82 }, { x: '周二', value: 82 }, { x: '周三', value: 95 },
  { x: '周四', value: 95 }, { x: '周五', value: 88 }, { x: '周六', value: 88 },
  { x: '周日', value: 76 },
];

/**
 * StepLineWidget — 阶梯线图，对应 ECharts Step Line。
 * 数据为 [x, value] 对（x 为时间戳或字符串标签）：
 *   全数字 x → time 轴；含字符串 → category 轴。
 * step 控制阶梯拐点位置（start/middle/end）。
 * 严格复用 useECharts 基础设施。
 */
export function StepLineWidget({
  points,
  step = 'middle',
  lineColor = '#00D4FF',
  showTick = true,
}: StepLineWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const pts = points?.length ? points : DEFAULT_POINTS;
  const isTime = pts.every((p) => typeof p.x === 'number');
  // ECharts 数据对：time 轴 → [ts, value]；category 轴 → [label, value]
  const pairs: (number | string)[][] = pts.map((p) => [p.x, p.value]);

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
      },
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      xAxis: isTime ? {
        type: 'time' as const,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick },
        axisLabel: { color: '#9E9EA8', fontSize: 10, hideOverlap: true },
        splitLine: { show: false },
      } : {
        type: 'category' as const,
        data: pts.map((p) => String(p.x)),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick, alignWithLabel: showTick },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        scale: true,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        axisTick: { show: showTick },
      },
      series: [{
        type: 'line' as const,
        name: '数值',
        step: step as 'start',
        data: zero ? pairs.map(([, v]) => [pairs[0]?.[0], 0]) : pairs,
        showSymbol: true,
        symbol: 'circle', symbolSize: 5,
        lineStyle: { color: lineColor, width: 2 },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${lineColor}33` },
            { offset: 1, color: `${lineColor}05` },
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
  }, [JSON.stringify(pairs), isTime, step, lineColor, showTick]);

  return <div ref={chartRef} className="w-full h-full" />;
}
