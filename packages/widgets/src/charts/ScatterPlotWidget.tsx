import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface ScatterPoint {
  name: string;
  x: number;
  y: number;
}

interface ScatterPlotWidgetProps {
  points?: ScatterPoint[];
  pointColor?: string;
  /** 点大小 (px) */
  symbolSize?: number;
  /** 刻度线（value 轴） */
  showTick?: boolean;
}

const DEFAULT_POINTS: ScatterPoint[] = [
  { name: 'A', x: 12, y: 38 }, { name: 'B', x: 26, y: 62 }, { name: 'C', x: 33, y: 28 },
  { name: 'D', x: 47, y: 55 }, { name: 'E', x: 55, y: 30 }, { name: 'F', x: 68, y: 70 },
  { name: 'G', x: 74, y: 42 }, { name: 'H', x: 86, y: 22 }, { name: 'I', x: 90, y: 58 },
  { name: 'J', x: 96, y: 78 },
];

/**
 * ScatterPlotWidget — 散点图，对应 ECharts Basic Scatter Chart。
 * 数据 {name, x, y} → data 传纯 [x, y] 数值数组（规避 ECharts 数组解包），
 * 名称/tooltip 经 dataIndex 从闭包反查（Voronoi 组件的经验）。
 * 严格复用 useECharts 基础设施。
 */
export function ScatterPlotWidget({
  points,
  pointColor = '#00D4FF',
  symbolSize = 8,
  showTick = true,
}: ScatterPlotWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const pts = points?.length ? points : DEFAULT_POINTS;
  const pairs: [number, number][] = pts.map((p) => [p.x, p.y]);

  useEffect(() => {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const dataMax = Math.max(...xs, ...ys);

    const opt = (animated: boolean, zero = false) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => {
          // dataIndex 反查闭包中的原始点
          const d = pts[p.dataIndex];
          if (!d) return '';
          return `${d.name}<br/>X: ${d.x}<br/>Y: ${d.y}`;
        },
      },
      grid: { left: 44, right: 20, top: 12, bottom: 30 },
      xAxis: {
        type: 'value' as const,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'value' as const,
        scale: true,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [{
        type: 'scatter' as const,
        name: '数据点',
        data: zero ? pairs.map(([, y], i) => [pairs[i]?.[0] ?? 0, 0] as [number, number]) : pairs,
        symbol: 'circle',
        symbolSize,
        itemStyle: {
          color: pointColor,
          shadowBlur: 6,
          shadowColor: `${pointColor}55`,
        },
        emphasis: {
          scale: 1.6,
          itemStyle: { color: '#FF8C42' },
        },
        label: {
          show: true,
          position: 'top' as const,
          color: '#9E9EA8',
          fontSize: 9,
          formatter: (p: any) => {
            const d = pts[p.dataIndex];
            return d ? d.name : '';
          },
        },
        animation: animated,
        animationDuration: animated ? 800 : 0,
        animationDelay: animated ? (idx: number) => idx * 40 : undefined,
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      // 首帧：点全部在底部（y=0），双 rAF 后散开入场
      setOption({ ...opt(false, true), series: [{ type: 'scatter' as const, data: pairs.map(([x]) => [x, 0] as [number, number]), symbol: 'circle', symbolSize }] }, true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(pairs), pointColor, symbolSize, showTick]);

  return <div ref={chartRef} className="w-full h-full" />;
}
