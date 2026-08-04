import { useEffect, useState } from 'react';
import { useECharts } from './useECharts';

interface GaugeWidgetProps {
  /** 当前值 */
  value?: number;
  /** 量程最小值 */
  min?: number;
  /** 量程最大值 */
  max?: number;
  /** 名称（表盘下方） */
  name?: string;
  /** 单位（数值后） */
  unit?: string;
  /** 进度弧颜色 */
  progressColor?: string;
  /** 轨道颜色 */
  trackColor?: string;
  /** 显示进度弧 */
  showProgress?: boolean;
  /** 数值滚动动画 */
  valueAnimation?: boolean;
  /** 显示刻度/指针 */
  showTick?: boolean;
}

/**
 * GaugeWidget — 仪表盘（参考 ECharts Simple Gauge）。
 * 半圆表盘（startAngle 225 → endAngle -45）+ 进度弧 + 中心大数字（滚动动画）。
 * 严格复用 useECharts 基础设施。
 */
export function GaugeWidget({
  value,
  min = 0,
  max = 100,
  name,
  unit,
  progressColor = '#00D4FF',
  trackColor = 'rgba(255,255,255,0.08)',
  showProgress = true,
  valueAnimation = true,
  showTick = true,
}: GaugeWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const val = Number.isFinite(Number(value)) ? Number(value) : 60;

  useEffect(() => {
    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      series: [{
        type: 'gauge' as const,
        center: ['50%', '58%'],
        radius: '85%',
        startAngle: 225,
        endAngle: -45,
        min,
        max,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[1, trackColor]],
          },
        },
        progress: {
          show: showProgress,
          width: 12,
          roundCap: true,
          itemStyle: { color: progressColor },
        },
        pointer: {
          show: showTick,
          length: '58%',
          width: 4,
          roundCap: true,
          itemStyle: { color: progressColor },
        },
        axisTick: { show: showTick, lineStyle: { color: 'rgba(255,255,255,0.25)', width: 1 } },
        splitLine: { show: showTick, length: 10, lineStyle: { color: 'rgba(255,255,255,0.25)', width: 1 } },
        axisLabel: { show: showTick, color: '#9E9EA8', fontSize: 9, distance: 14 },
        title: {
          show: !!name,
          offsetCenter: [0, '72%'],
          color: '#9E9EA8',
          fontSize: 11,
        },
        detail: {
          show: true,
          valueAnimation,
          offsetCenter: [0, '40%'],
          color: '#FFFFFF',
          fontSize: 24,
          fontWeight: 'bold' as const,
          formatter: (v: number) => `${v}${unit ?? ''}`,
        },
        data: [{ value: val, ...(name ? { name } : {}) }],
      }],
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
  }, [val, min, max, name, unit, progressColor, trackColor, showProgress, valueAnimation, showTick]);

  return <div ref={chartRef} className="w-full h-full" />;
}
