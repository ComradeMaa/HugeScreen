import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface MixedSeries {
  name: string;
  unit?: string;
  type: 'bar' | 'line';
  data: number[];
}

interface BarLineChartWidgetProps {
  xLabels?: string[];
  mixedSeries?: MixedSeries[];
  smooth?: boolean;
  showArea?: boolean;
  barWidth?: string;
  showLabel?: boolean;
  /** 刻度线对齐标签（category 轴） */
  showTick?: boolean;
}

const DEFAULT_LABELS = ['2020', '2021', '2022', '2023', '2024', '2025'];
const DEFAULT_MIXED: MixedSeries[] = [
  { name: '带宽', unit: 'T', type: 'bar', data: [0.6, 1.1, 1.8, 2.4, 3.2, 3.9] },
  { name: '机柜数', unit: '个', type: 'line', data: [120, 230, 410, 620, 850, 1080] },
];
const SERIES_COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#a78bfa', '#60a5fa', '#f59e0b'];

/**
 * 柱线组合图 — 双 Y 轴。
 * 柱系列挂左轴（index 0），折线系列挂右轴（index 1），各自独立缩放，
 * 避免量级悬殊时柱被压平。入场动画沿用柱/折线组件的两阶段（零值 → 真值）方案。
 */
export function BarLineChartWidget({
  xLabels, mixedSeries,
  smooth = true, showArea = false, barWidth = '50%', showLabel = false,
  showTick = true,
}: BarLineChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const labels = xLabels?.length ? xLabels : DEFAULT_LABELS;
  const series = mixedSeries?.length ? mixedSeries : DEFAULT_MIXED;

  const hasBar = series.some((s) => s.type === 'bar');
  const hasLine = series.some((s) => s.type === 'line');
  const barUnit = series.find((s) => s.type === 'bar')?.unit ?? '';
  const lineUnit = series.find((s) => s.type === 'line')?.unit ?? '';

  useEffect(() => {
    const mkSeries = (animated: boolean, zero: boolean) =>
      series.map((s, i) => {
        const c = SERIES_COLORS[i % SERIES_COLORS.length];
        const data = zero ? s.data.map(() => 0) : s.data;
        if (s.type === 'line') {
          return {
            name: s.name, type: 'line' as const, yAxisIndex: 1, data,
            smooth, symbol: 'circle' as const, symbolSize: 6,
            lineStyle: { width: 2, color: c }, itemStyle: { color: c },
            animation: animated, animationDuration: animated ? 1000 : 0,
            areaStyle: showArea ? {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: `${c}26` }, { offset: 1, color: `${c}03` },
              ]),
            } : undefined,
            label: { show: showLabel, color: c, fontSize: 10 },
          };
        }
        return {
          name: s.name, type: 'bar' as const, yAxisIndex: 0, data, barWidth,
          itemStyle: {
            borderRadius: [3, 3, 0, 0] as [number, number, number, number],
            color: {
              type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: c }, { offset: 1, color: `${c}33` }],
            },
          },
          animation: animated, animationDuration: animated ? 800 : 0,
          animationDelay: animated ? (idx: number) => idx * 50 : undefined,
          label: { show: showLabel, position: 'top' as const, color: c, fontSize: 10 },
          emphasis: { itemStyle: { color: '#FF8C42' } },
        };
      });

    const opt = (animated: boolean, zero = false) => ({
      animation: animated,
      tooltip: {
        trigger: 'axis' as const, backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)', textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      legend: { show: false },
      color: SERIES_COLORS,
      grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category' as const, data: labels,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick, alignWithLabel: showTick }, axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value' as const, position: 'left' as const,
          name: hasBar ? barUnit : '',
          nameTextStyle: { color: '#9E9EA8', fontSize: 9 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
          axisLabel: { color: '#9E9EA8', fontSize: 10 },
          axisTick: { show: showTick },
        },
        {
          type: 'value' as const, position: 'right' as const,
          name: hasLine ? lineUnit : '',
          nameTextStyle: { color: '#9E9EA8', fontSize: 9 },
          splitLine: { show: false },
          axisLabel: { color: '#9E9EA8', fontSize: 10 },
          axisTick: { show: showTick },
        },
      ],
      series: mkSeries(animated, zero),
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false, true), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true, false), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(series), JSON.stringify(labels), smooth, showArea, barWidth, showLabel, showTick]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-1 right-2 z-10 pointer-events-none flex flex-wrap gap-x-3 gap-y-1 justify-end max-w-[75%]">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            <span className="text-[10px] text-textSecondary/80 truncate max-w-[90px]" title={s.name}>
              {s.name}{s.unit ? `(${s.unit})` : ''}
            </span>
          </div>
        ))}
      </div>
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
}
