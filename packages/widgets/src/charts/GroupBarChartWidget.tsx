import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface GroupBarSeries {
  name: string;
  data: number[];
}

interface GroupBarChartWidgetProps {
  xLabels?: string[];
  barSeries?: GroupBarSeries[];
  /** 呈现方式（同柱状图）：vertical 竖向柱状 / horizontal 横向条形 */
  direction?: 'vertical' | 'horizontal';
  showLabel?: boolean;
  barWidth?: string;
  /** 刻度线对齐标签（category 轴） */
  showTick?: boolean;
  /** 按正负值着色（正绿负红）+ 显示 0 线 */
  colorBySign?: boolean;
}

const DEFAULT_LABELS = ['周一', '周二', '周三', '周四', '周五'];
const DEFAULT_SERIES: GroupBarSeries[] = [
  { name: '系列1', data: [120, 200, 150, 80, 70] },
  { name: '系列2', data: [90, 150, 210, 130, 180] },
];
const SERIES_COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#a78bfa', '#60a5fa', '#f59e0b'];

/**
 * GroupBarChartWidget — 分组柱状图（多系列并列），对应 VictoryGroup 的多系列对比场景。
 * 严格复用 useECharts 基础设施，渲染模式与 BarLineChartWidget 完全一致。
 * 数据: {xLabels, barSeries:[{name, data}]} — 与 line-chart 同构。
 */
export function GroupBarChartWidget({
  xLabels,
  barSeries,
  direction = 'vertical',
  showLabel = false,
  barWidth = '40%',
  showTick = true,
  colorBySign = false,
}: GroupBarChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const labels = xLabels?.length ? xLabels : DEFAULT_LABELS;
  const series = barSeries?.length ? barSeries : DEFAULT_SERIES;
  const isHorizontal = direction === 'horizontal';

  useEffect(() => {
    const mkSeries = (animated: boolean, zero: boolean) =>
      series.map((s, i) => {
        const c = SERIES_COLORS[i % SERIES_COLORS.length];
        const data = zero ? s.data.map(() => 0) : s.data;
        return {
          name: s.name, type: 'bar' as const, data, barWidth,
          itemStyle: {
            borderRadius: (isHorizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]) as [number, number, number, number],
            // 正负着色：正值绿、负值红（对应 Negative Value 样式）
            color: colorBySign
              ? (params: { value: number }) => (params.value >= 0 ? '#34d399' : '#f87171')
              : {
                  type: 'linear' as const,
                  x: isHorizontal ? 1 : 0, y: isHorizontal ? 0 : 0,
                  x2: isHorizontal ? 0 : 0, y2: isHorizontal ? 0 : 1,
                  colorStops: [{ offset: 0, color: c }, { offset: 1, color: `${c}33` }],
                },
          },
          markLine: colorBySign ? {
            silent: true, symbol: 'none' as const,
            lineStyle: { color: 'rgba(255,255,255,0.25)' },
            label: { show: false },
            data: [{ yAxis: 0 }],
          } : undefined,
          animation: animated, animationDuration: animated ? 800 : 0,
          animationDelay: animated ? (idx: number) => idx * 50 : undefined,
          label: { show: showLabel, position: (isHorizontal ? 'right' : 'top') as 'right' | 'top', color: c, fontSize: 9 },
          emphasis: { itemStyle: { color: '#FF8C42' } },
        };
      });

    // 正负着色：值轴对称范围（0 线居中）
    const allVals = series.flatMap((s) => s.data);
    const signAbsMax = colorBySign && allVals.length ? Math.ceil(Math.max(...allVals.map((v) => Math.abs(v))) * 1.1) : undefined;
    // 横向条形模式：x 轴 value、y 轴 category（同柱状图）
    const xa = isHorizontal
      ? { type: 'value' as const, min: colorBySign ? -signAbsMax! : undefined, max: colorBySign ? signAbsMax : undefined, axisTick: { show: showTick }, axisLabel: { color: '#9E9EA8', fontSize: 10, formatter: (v: number) => String(Math.round(v * 100) / 100) } }
      : { type: 'category' as const, data: labels };
    const ya = isHorizontal
      ? { type: 'category' as const, data: labels }
      : { type: 'value' as const, min: colorBySign ? -signAbsMax! : undefined, max: colorBySign ? signAbsMax : undefined, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#9E9EA8', fontSize: 10, formatter: (v: number) => String(Math.round(v * 100) / 100) } };
    const xAf = isHorizontal
      ? { ...xa, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#9E9EA8', fontSize: 10, formatter: (v: number) => String(Math.round(v * 100) / 100) } }
      : { ...xa, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisTick: { show: showTick, alignWithLabel: showTick }, axisLabel: { color: '#9E9EA8', fontSize: 10 } };
    const yAf = isHorizontal
      ? { ...ya, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisTick: { show: showTick, alignWithLabel: showTick }, axisLabel: { color: '#9E9EA8', fontSize: 10 } }
      : { ...ya, axisLabel: { color: '#9E9EA8', fontSize: 10 }, axisTick: { show: showTick } };

    const opt = (animated: boolean, zero = false) => ({
      animation: animated,
      tooltip: {
        trigger: 'axis' as const, backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)', textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      legend: { show: false },
      color: SERIES_COLORS,
      grid: { left: 8, right: 16, top: 8, bottom: 24, containLabel: true },
      xAxis: xAf,
      yAxis: yAf,
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
  }, [JSON.stringify(series), JSON.stringify(labels), isHorizontal, showLabel, barWidth, showTick, colorBySign]);

  return (
    <div className="relative w-full h-full">
      {/* 左上角系列颜色图例（同 BarLineChartWidget） */}
      <div className="absolute top-1 left-2 z-10 pointer-events-none flex flex-wrap gap-x-3 gap-y-1 max-w-[75%]">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            <span className="text-[10px] text-textSecondary/80 truncate max-w-[90px]" title={s.name}>
              {s.name}
            </span>
          </div>
        ))}
      </div>
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
}
