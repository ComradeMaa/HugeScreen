import { useEffect, useState } from 'react';
import { useECharts } from './useECharts';

export interface BarCategory { name: string; value: number; }

interface BarChartWidgetProps {
  xLabels?: string[];
  series?: { name: string; data: number[] }[];
  categories?: BarCategory[];
  direction?: 'vertical' | 'horizontal';
  showLabel?: boolean;
  labelFontSize?: string; labelFontWeight?: string; labelColor?: string;
  barWidth?: string;
  /** 刻度线对齐标签（category 轴） */
  showTick?: boolean;
  /** 按正负值着色（正绿负红）+ 显示 0 线 */
  colorBySign?: boolean;
}

const DEFAULT_CATEGORIES: BarCategory[] = [
  { name: '类别A', value: 182 }, { name: '类别B', value: 234 },
  { name: '类别C', value: 165 }, { name: '类别D', value: 298 }, { name: '类别E', value: 210 },
];
const ZOOM_THRESHOLD = 6;

export function BarChartWidget({
  xLabels, series, categories,
  direction = 'vertical', showLabel = false,
  labelFontSize = '10px', labelFontWeight = '600', labelColor = '#FF8C42', barWidth = '50%',
  showTick = true, colorBySign = false,
}: BarChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const isHorizontal = direction === 'horizontal';
  const [didInit, setDidInit] = useState(false);

  const cats = categories?.length ? categories
    : (xLabels && series?.length ? xLabels.map((n, i) => ({ name: n, value: series[0]?.data[i] ?? 0 }))
    : DEFAULT_CATEGORIES);
  const catLabels = cats.map(c => c.name);
  const catValues = cats.map(c => c.value);
  const barPct = parseInt(barWidth) || 50;
  const barWidthPx = Math.round(barPct * 0.24);

  useEffect(() => {
    const dataMax = catValues.length ? Math.max(...catValues) : 0;
    // 正负着色：值轴对称范围（0 线居中，负值柱完整显示）
    const signAbsMax = colorBySign && catValues.length ? Math.ceil(Math.max(...catValues.map((v) => Math.abs(v))) * 1.1) : undefined;
    const yMax = colorBySign ? signAbsMax : (!isHorizontal && showLabel && dataMax > 0 ? dataMax * 1.18 : undefined);
    const yMin = colorBySign ? -signAbsMax! : undefined;
    const xMax = colorBySign ? signAbsMax : (isHorizontal && showLabel && dataMax > 0 ? dataMax * 1.18 : undefined);
    const xMin = colorBySign ? -signAbsMax! : undefined;
    const needZoom = !isHorizontal && cats.length > ZOOM_THRESHOLD;

    const xa = isHorizontal ? { type: 'value' as const, max: xMax, min: xMin, axisTick: { show: showTick } }
      : { type: 'category' as const, data: catLabels, axisLabel: { color: '#9E9EA8', fontSize: 10 } };
    const ya = isHorizontal ? { type: 'category' as const, data: catLabels, axisLabel: { color: '#9E9EA8', fontSize: 10 } }
      : { type: 'value' as const, max: yMax, min: yMin, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#9E9EA8', fontSize: 10, formatter: (v: number) => String(Math.round(v * 100) / 100) }, axisTick: { show: showTick } };
    const xAf = isHorizontal ? { ...xa, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#9E9EA8', fontSize: 10, formatter: (v: number) => String(Math.round(v * 100) / 100) } }
      : { ...xa, axisTick: { show: showTick, alignWithLabel: showTick }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } };
    const yAf = isHorizontal ? { ...ya, axisTick: { show: showTick, alignWithLabel: showTick }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } } : ya;
    const gridTop = !isHorizontal && showLabel ? 20 : 4;
    const gridBottom = needZoom ? 36 : (isHorizontal ? 4 : 24);

    const opt = (animated: boolean, dataOverride?: number[]) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'axis' as const, backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)', textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      grid: { left: 4, right: 16, top: gridTop, bottom: gridBottom, containLabel: true },
      dataZoom: needZoom ? [{
        type: 'slider' as const, bottom: 2, height: 20,
        start: 0, end: Math.min(100, (ZOOM_THRESHOLD / cats.length) * 100),
        borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(44,44,52,0.8)',
        fillerColor: 'rgba(0,212,255,0.12)', handleStyle: { color: '#00D4FF' },
        textStyle: { color: '#9E9EA8', fontSize: 9 },
      }] : undefined,
      xAxis: xAf, yAxis: yAf,
      series: [{
        name: '数值', type: 'bar' as const, data: dataOverride ?? catValues,
        animation: animated,
        animationDuration: animated ? 800 : 0,
        animationDelay: animated ? (idx: number) => idx * 50 : undefined,
        barWidth: isHorizontal ? barWidthPx : barWidth,
        itemStyle: {
          borderRadius: isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
          // 正负着色：正值绿、负值红（对应 Negative Value 样式）
          color: colorBySign
            ? (params: { value: number }) => (params.value >= 0 ? '#34d399' : '#f87171')
            : { type: 'linear' as const, x: 0, y: 0, x2: isHorizontal ? 1 : 0, y2: isHorizontal ? 0 : 1,
              colorStops: [{ offset: 0, color: '#00D4FF' }, { offset: 1, color: '#005566' }] },
        },
        markLine: colorBySign ? {
          silent: true, symbol: 'none' as const,
          lineStyle: { color: 'rgba(255,255,255,0.25)' },
          label: { show: false },
          data: [{ yAxis: 0 }],
        } : undefined,
        label: {
          show: showLabel, position: (isHorizontal ? 'right' : 'top') as 'right' | 'top',
          color: labelColor, fontSize: parseInt(labelFontSize) || 10, fontWeight: parseInt(labelFontWeight) || 600,
        },
        emphasis: { itemStyle: { color: '#FF8C42' } },
      }],
    });

    if (didInit) {
      // notMerge=true 确保关闭选项（如 dataZoom:undefined）被正确清除
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      // 首帧用零值作基线（animation:false），双 rAF 确保落定后切真实数据触发入场动画
      setOption(opt(false, catValues.map(() => 0)), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true, catValues), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(catLabels), JSON.stringify(catValues), isHorizontal, showLabel, barWidth, labelFontSize, labelFontWeight, labelColor, cats.length, showTick, colorBySign]);

  return <div ref={chartRef} className="w-full h-full" />;
}
