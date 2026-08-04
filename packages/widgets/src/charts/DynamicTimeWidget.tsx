import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface DynamicPoint {
  /** 时间戳 (ms) */
  time: number;
  value: number;
}

interface DynamicTimeWidgetProps {
  /** 初始种子数据（静态数据源/初始加载） */
  points?: DynamicPoint[];
  /** 是否启用动态追加 */
  dynamic?: boolean;
  /** 追加间隔 (ms) */
  interval?: number;
  /** 滑窗大小（保留点数） */
  windowSize?: number;
  lineColor?: string;
  /** 刻度线（y 轴） */
  showTick?: boolean;
}

/** 生成种子时序数据（50 点，作为动态追加的起点） */
function genSeed(count = 50, start = Date.now() - count * 1000): DynamicPoint[] {
  const pts: DynamicPoint[] = [];
  let v = 100;
  for (let i = 0; i < count; i++) {
    v += Math.sin(i / 8) * 2 + (Math.random() - 0.5) * 4;
    pts.push({ time: start + i * 1000, value: Math.round(v * 10) / 10 });
  }
  return pts;
}

/**
 * DynamicTimeWidget — 动态数据 + 时间轴（实时滚动曲线）。
 * 对应 ECharts 官方 Dynamic Data + Time Axis：固定时间基准 + 定时追加新点 + 滑窗滚动。
 * 组件内部 setInterval 驱动演示；初始种子走数据源适配（mapLargeArea 同格式）。
 * 严格复用 useECharts 基础设施。
 */
export function DynamicTimeWidget({
  points,
  dynamic = true,
  interval = 1000,
  windowSize = 60,
  lineColor = '#00D4FF',
  showTick = true,
}: DynamicTimeWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);
  // 动态队列：种子数据 → 定时追加 → 滑窗截断
  const [queue, setQueue] = useState<DynamicPoint[]>(() =>
    points?.length ? [...points].sort((a, b) => a.time - b.time) : genSeed(),
  );

  // 外部数据源（静态种子）变化时重建队列
  useEffect(() => {
    if (points?.length) {
      setQueue([...points].sort((a, b) => a.time - b.time));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  // 动态追加定时器
  useEffect(() => {
    if (!dynamic) return;
    const timer = setInterval(() => {
      setQueue((q) => {
        const last = q[q.length - 1];
        const t = last ? last.time + 1000 : Date.now();
        let v = last ? last.value : 100;
        v += Math.sin(q.length / 8) * 2 + (Math.random() - 0.5) * 4;
        const next = [...q, { time: t, value: Math.round(v * 10) / 10 }];
        return next.length > windowSize ? next.slice(next.length - windowSize) : next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [dynamic, interval, windowSize]);

  useEffect(() => {
    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 300 : 0,
      animationEasing: 'linear' as const,
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
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
        scale: true,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        axisTick: { show: showTick },
      },
      series: [{
        type: 'line' as const,
        name: '实时数据',
        data: queue.map((p) => [p.time, p.value] as [number, number]),
        showSymbol: false,
        lineStyle: { color: lineColor, width: 2 },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${lineColor}3d` },
            { offset: 1, color: `${lineColor}05` },
          ]),
        },
        animation: animated, animationDuration: animated ? 300 : 0,
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false), true);
    }
  }, [JSON.stringify(queue), lineColor, showTick]);

  return <div ref={chartRef} className="w-full h-full" />;
}
