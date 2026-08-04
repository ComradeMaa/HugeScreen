import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface RadarIndicator {
  name: string;
  max: number;
}

export interface RadarSeries {
  name: string;
  /** 每个指标一个值（与 indicators 顺序对应） */
  value: number[];
}

interface RadarChartWidgetProps {
  indicators?: RadarIndicator[];
  series?: RadarSeries[];
  lineColor?: string;
  areaColor?: string;
}

const DEFAULT_INDICATORS: RadarIndicator[] = [
  { name: '攻击', max: 100 }, { name: '防御', max: 100 },
  { name: '速度', max: 100 }, { name: '血量', max: 100 },
  { name: '法术', max: 100 }, { name: '闪避', max: 100 },
];
const DEFAULT_SERIES: RadarSeries[] = [
  { name: '角色', value: [80, 65, 72, 90, 55, 70] },
];
// 多系列色板：第一系列用 lineColor，后续系列按色板分配
const SERIES_COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#a78bfa', '#60a5fa', '#f59e0b'];

/**
 * RadarChartWidget — 雷达图，对应 ECharts Basic Radar Chart。
 * 数据：indicators（维度名 + 最大值）+ series（每系列 value 数组与维度对应）。
 * 严格复用 useECharts 基础设施。
 */
export function RadarChartWidget({
  indicators,
  series,
  lineColor = '#00D4FF',
  areaColor = '#00D4FF',
}: RadarChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const inds = indicators?.length ? indicators : DEFAULT_INDICATORS;
  const sers = series?.length ? series : DEFAULT_SERIES;

  useEffect(() => {
    const opt = (animated: boolean, zero = false) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      // 图例：多系列时左下角竖排堆叠
      legend: sers.length > 1 ? {
        orient: 'vertical' as const,
        left: 4,
        bottom: 4,
        textStyle: { color: '#9E9EA8', fontSize: 10 },
        itemWidth: 10, itemHeight: 10, itemGap: 6,
      } : undefined,
      radar: {
        indicator: inds,
        // 多系列时雷达图左移给图例腾空间
        radius: sers.length > 1 ? '60%' : '68%',
        center: sers.length > 1 ? ['56%', '50%'] : ['50%', '50%'],
        splitNumber: 4,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        splitArea: {
          areaStyle: {
            color: ['rgba(255,255,255,0.015)', 'rgba(255,255,255,0.03)'],
          },
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisName: { color: '#9E9EA8', fontSize: 10 },
      },
      series: [{
        type: 'radar' as const,
        data: sers.map((s, i) => {
          // 第一系列用 lineColor/areaColor，多系列按色板分配
          const c = i === 0 ? lineColor : SERIES_COLORS[(i - 1) % (SERIES_COLORS.length - 1) + 1];
          const a = i === 0 ? areaColor : c;
          return {
            name: s.name,
            value: zero ? s.value.map(() => 0) : s.value,
            lineStyle: { color: c, width: 2 },
            itemStyle: { color: c },
            areaStyle: { color: `${a}33` },
            emphasis: {
              lineStyle: { width: 3 },
              itemStyle: { color: '#FF8C42' },
            },
          };
        }),
        symbol: 'circle', symbolSize: 4,
        animation: animated, animationDuration: animated ? 800 : 0,
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      // 首帧零值基线（多边形缩到中心），双 rAF 后展开入场
      setOption(opt(false, true), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(inds), JSON.stringify(sers), lineColor, areaColor]);

  return <div ref={chartRef} className="w-full h-full" />;
}
