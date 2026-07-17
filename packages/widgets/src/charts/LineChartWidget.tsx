import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface LineSeries { name: string; data: number[]; }

interface LineChartWidgetProps {
  title?: string;
  series?: { name: string; data: number[] }[];
  xLabels?: string[];
  lineSeries?: LineSeries[];
  smooth?: boolean;
  showArea?: boolean;
}

const DEFAULT_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DEFAULT_SERIES: LineSeries[] = [{ name: '系列1', data: [120, 200, 150, 80, 70, 110, 130] }];
const LINE_COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#a78bfa', '#60a5fa', '#f59e0b'];

export function LineChartWidget({
  title, series: oldSeries, xLabels: oldLabels, lineSeries, smooth = true, showArea = true,
}: LineChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const ls = lineSeries?.length ? lineSeries : (oldSeries?.length ? oldSeries : DEFAULT_SERIES);
  const labels = oldLabels?.length ? oldLabels : DEFAULT_LABELS;
  const maxLen = Math.max(...ls.map(s => s.data.length), labels.length);
  const xData = labels.length >= maxLen ? labels
    : [...labels, ...Array.from({ length: maxLen - labels.length }, (_, i) => `未定义${i + 1}`)];
  const allVals = ls.flatMap(s => s.data);
  const dataMax = allVals.length ? Math.max(...allVals) : 0;
  const dataMin = allVals.length ? Math.min(...allVals) : 0;
  const yPad = Math.max((dataMax - dataMin) * 0.12, 10);

  useEffect(() => {
    const opt = (animated: boolean, seriesOverride?: LineSeries[]) => ({
      animation: animated,
      animationDuration: animated ? 1000 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'axis' as const, backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)', textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      legend: { show: false },
      color: LINE_COLORS,
      grid: { left: 8, right: 16, top: title ? 8 : 4, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category' as const, data: xData,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: false }, axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        min: dataMin > 0 ? Math.max(0, dataMin - yPad) : dataMin - yPad,
        max: dataMax + yPad,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      series: (seriesOverride ?? ls).map((s, i) => {
        const c = LINE_COLORS[i % LINE_COLORS.length];
        return {
          name: s.name, type: 'line' as const, data: s.data,
          animation: animated,
          animationType: animated ? 'progressive' : undefined,
          smooth, symbol: 'circle' as const, symbolSize: 6, lineStyle: { width: 2 },
          areaStyle: showArea ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${c}26` }, { offset: 1, color: `${c}03` },
            ]),
          } : undefined,
        };
      }),
    });

    if (didInit) {
      setOption(opt(true), false);
    } else {
      setDidInit(true);
      // 基线：空 series → 第二帧新增整个系列，progressive 逐段绘制
      setOption({ ...opt(false), series: [] }, true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true, ls), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(ls), JSON.stringify(xData), smooth, showArea, title]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-1 right-2 z-10 pointer-events-none flex flex-col gap-1.5 max-w-[50%]">
        {ls.map((s, i) => (
          <div key={i} className="flex items-center gap-2 justify-end">
            <span className="text-[11px] text-textSecondary/80 truncate max-w-[80px]" title={s.name}>{s.name}</span>
            <span className="relative flex items-center flex-shrink-0" style={{ width: 36, height: 28 }}>
              <span className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
              <span className="absolute top-1/2 left-1/2 w-3.5 h-3.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
            </span>
          </div>
        ))}
      </div>
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
}
