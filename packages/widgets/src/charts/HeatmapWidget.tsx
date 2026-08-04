import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface HeatmapPoint {
  x: number;
  y: number;
  value: number;
}

interface HeatmapWidgetProps {
  /** [x, y, value] 热力数据 — 对应 ECharts Heatmap (20K data) */
  points?: HeatmapPoint[];
  /** 渐变色板 key（visualMap inRange color） */
  paletteKey?: string;
  /** 刻度线（value 轴） */
  showTick?: boolean;
}

// 预设渐变色板
const PALETTES: Record<string, string[]> = {
  electric: ['#1a1a24', '#0a3d5c', '#00a8cc', '#00D4FF', '#FF8C42'],
  ocean: ['#1a1a24', '#0a2a4a', '#0a5a8a', '#00a0e0', '#d0f0ff'],
  fire: ['#1a1a24', '#5c0a0a', '#cc4400', '#ff8800', '#ffdd44'],
  forest: ['#1a1a24', '#0a3d1a', '#00a84a', '#34d399', '#e0ffd0'],
  purple: ['#1a1a24', '#2a0a5c', '#6a2acc', '#a06aff', '#f0e0ff'],
};

/**
 * 生成模拟热力数据 — 平滑螺旋云状分布（对应官方 20K 示例的 sin/cos 波形 + 噪声），
 * 避免团簇式生成导致点聚集在局部矩形区域。
 */
export function genMockHeatmap(count: number): HeatmapPoint[] {
  const pts: HeatmapPoint[] = [];
  for (let i = 0; i < count; i++) {
    const x = 50 + Math.sin(i / 120) * 30 + (Math.random() - 0.5) * 14;
    const y = 50 + Math.cos(i / 90) * 30 + (Math.random() - 0.5) * 14;
    const value = 50 + Math.sin(i / 40) * 30 + Math.random() * 15;
    pts.push({
      x: Math.round(x),
      y: Math.round(y),
      value: Math.max(0, Math.min(100, Math.round(value))),
    });
  }
  return pts;
}

const DEFAULT_POINTS = genMockHeatmap(2000);

/**
 * HeatmapWidget — 热力图，对应 ECharts Heatmap (20K data)。
 * data [x, y, value] 三元组 + visualMap 颜色梯度 + 渐进渲染（大数据量流畅）。
 * 严格复用 useECharts 基础设施。
 */
export function HeatmapWidget({
  points,
  paletteKey = 'electric',
  showTick = true,
}: HeatmapWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const pts = points?.length ? points : DEFAULT_POINTS;
  const palette = PALETTES[paletteKey] ?? PALETTES.electric;
  const pairs: [number, number, number][] = pts.map((p) => [p.x, p.y, p.value]);

  useEffect(() => {
    const values = pts.map((p) => p.value);
    const vMin = values.length ? Math.min(...values) : 0;
    const vMax = values.length ? Math.max(...values) : 1;

    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 500 : 0,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => {
          const d = p.data as number[];
          return `X: ${d[0]}<br/>Y: ${d[1]}<br/>值: ${d[2]}`;
        },
      },
      grid: { left: 44, right: 44, top: 12, bottom: 30 },
      xAxis: {
        type: 'value' as const,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        scale: true,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        splitLine: { show: false },
      },
      visualMap: {
        min: vMin,
        max: vMax,
        calculable: true,
        orient: 'vertical' as const,
        right: 4,
        top: 'center',
        itemHeight: 120,
        textStyle: { color: '#9E9EA8', fontSize: 9 },
        inRange: { color: palette },
      },
      series: [{
        type: 'heatmap' as const,
        name: '热力',
        data: pairs,
        progressive: 5000,
        progressiveThreshold: 3000,
        emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
        animation: animated, animationDuration: animated ? 500 : 0,
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false), true);
    }
  }, [JSON.stringify(pairs), paletteKey, showTick]);

  return <div ref={chartRef} className="w-full h-full" />;
}
