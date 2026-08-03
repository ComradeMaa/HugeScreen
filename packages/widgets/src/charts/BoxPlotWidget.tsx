import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface BoxPlotCategory {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers?: number[];
}

interface BoxPlotWidgetProps {
  categories?: BoxPlotCategory[];
  boxColor?: string;
  boxWidth?: number;
}

const DEFAULT_CATEGORIES: BoxPlotCategory[] = [
  { name: 'A组', min: 10, q1: 30, median: 45, q3: 60, max: 85 },
  { name: 'B组', min: 15, q1: 35, median: 50, q3: 65, max: 90 },
  { name: 'C组', min: 20, q1: 40, median: 55, q3: 70, max: 95 },
  { name: 'D组', min: 12, q1: 32, median: 48, q3: 62, max: 88 },
  { name: 'E组', min: 8,  q1: 28, median: 42, q3: 58, max: 80 },
];

/**
 * BoxPlotWidget — 箱线图（盒须图），基于 ECharts boxplot 系列。
 * 复用 useECharts 基础设施，与 BarChart/PieChart 完全一致的渲染模式。
 */
export function BoxPlotWidget({
  categories,
  boxColor = '#00D4FF',
  boxWidth = 20,
}: BoxPlotWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const cats = categories?.length ? categories : DEFAULT_CATEGORIES;
  const catLabels = cats.map(c => c.name);
  const boxData = cats.map(c => {
    const vals: number[] = [c.min, c.q1, c.median, c.q3, c.max];
    if (c.outliers?.length) vals.push(...c.outliers);
    return vals;
  });

  useEffect(() => {
    const dataMax = boxData.length ? Math.max(...boxData.map(d => d[4] || 0)) : 0;
    const yMax = dataMax > 0 ? dataMax * 1.12 : undefined;

    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (ps: any) => {
          // 多系列时 ECharts 传入数组，取 boxplot 那条（data 长度 ≥5）
          const p = Array.isArray(ps) ? ps.find((x: any) => Array.isArray(x.data) && x.data.length >= 5) || ps[0] : ps;
          // ★ ECharts boxplot 会在数据数组头部 unshift x 轴序号：
          //   传入 [min,Q1,median,Q3,max] → 内部变 [index,min,Q1,median,Q3,max]
          //   所以取「后 5 个」拿到真正的五段统计值
          const raw = p.data as number[];
          const d = (Array.isArray(raw) && raw.length >= 5) ? raw.slice(-5) : [];
          return `${p.name}<br/>
            上限: ${d[4]}<br/>
            Q3: ${d[3]}<br/>
            中位数: ${d[2]}<br/>
            Q1: ${d[1]}<br/>
            下限: ${d[0]}`;
        },
      },
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: catLabels,
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'value' as const,
        max: yMax,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      series: [{
        type: 'boxplot' as const,
        data: boxData,
        boxWidth: [boxWidth * 0.5, boxWidth],
        itemStyle: {
          color: boxColor,
          borderColor: boxColor,
          borderWidth: 1.5,
        },
        emphasis: {
          itemStyle: {
            color: '#FF8C42',
            borderColor: '#FF8C42',
            borderWidth: 2,
          },
        },
      }, {
        // 中位数琥珀色横线 — 独立 scatter 系列叠在箱线图上方
        type: 'scatter' as const,
        data: cats.map((c, i) => [c.name, c.median]),
        symbol: 'roundRect',
        symbolSize: [boxWidth * 0.7, 3],
        itemStyle: { color: '#FF8C42' },
        z: 10,
        emphasis: {
          scale: 1.3,
          itemStyle: { color: '#FFB380' },
        },
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      // 首帧零基线入场动画（箱线 + 中位数标记同步归零）
      const zeroBoxData = boxData.map(d => [d[2], d[2], d[2], d[2], d[2]]);
      const zeroScatterData = cats.map((c) => [c.name, 0]);
      setOption({
        ...opt(false),
        series: [
          { type: 'boxplot', data: zeroBoxData },
          { type: 'scatter', data: zeroScatterData },
        ],
      }, true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(catLabels), JSON.stringify(boxData), boxColor, boxWidth, cats.length]);

  return <div ref={chartRef} className="w-full h-full" />;
}
