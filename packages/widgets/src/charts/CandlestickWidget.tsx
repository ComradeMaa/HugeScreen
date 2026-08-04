import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface CandleItem {
  name: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

interface CandlestickWidgetProps {
  candles?: CandleItem[];
  upColor?: string;
  downColor?: string;
}

const DEFAULT_CANDLES: CandleItem[] = [
  { name: '周一', open: 100, close: 105, high: 110, low: 98 },
  { name: '周二', open: 105, close: 102, high: 108, low: 100 },
  { name: '周三', open: 102, close: 115, high: 118, low: 101 },
  { name: '周四', open: 115, close: 112, high: 120, low: 110 },
  { name: '周五', open: 112, close: 118, high: 122, low: 108 },
];

/**
 * CandlestickWidget — 蜡烛图（K线图），基于 ECharts candlestick 系列。
 * 严格复用 useECharts 基础设施，渲染模式与 BarChartWidget 完全一致。
 * 数据: {name, open, close, high, low} → ECharts [open, close, lowest, highest]
 */
export function CandlestickWidget({
  candles,
  upColor = '#34d399',
  downColor = '#f87171',
}: CandlestickWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const items = candles?.length ? candles : DEFAULT_CANDLES;
  const catLabels = items.map(c => c.name);
  // ECharts candlestick 数据格式: [open, close, lowest, highest]
  const candleData = items.map(c => [c.open, c.close, c.low, c.high]);

  useEffect(() => {
    const allHighs = items.map(c => c.high);
    const allLows = items.map(c => c.low);
    const dataMax = allHighs.length ? Math.max(...allHighs) : 0;
    const dataMin = allLows.length ? Math.min(...allLows) : 0;
    const yMax = dataMax > 0 ? dataMax * 1.05 : undefined;
    const yMin = dataMin < 0 ? dataMin * 1.05 : undefined;

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
          const p = Array.isArray(ps) ? ps[0] : ps;
          // ★ 同 boxplot：ECharts candlestick 会 unshift x 序号 → 取后 4 个
          const raw = p.data as number[];
          const d = (Array.isArray(raw) && raw.length >= 4) ? raw.slice(-4) : [];
          const up = d[1] >= d[0];
          return `${p.name}<br/>
            开盘: ${d[0]}<br/>
            收盘: ${d[1]}<br/>
            最低: ${d[2]}<br/>
            最高: ${d[3]}<br/>
            <span style="color:${up ? '#34d399' : '#f87171'}">${up ? '▲ 涨' : '▼ 跌'}</span>`;
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
        min: yMin,
        max: yMax,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10 },
      },
      series: [{
        type: 'candlestick' as const,
        data: candleData,
        itemStyle: {
          color: upColor,        // 阳线（close >= open）
          color0: downColor,     // 阴线（close < open）
          borderColor: upColor,
          borderColor0: downColor,
          borderWidth: 1,
        },
        emphasis: {
          itemStyle: { borderWidth: 2 },
        },
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      // 首帧零基线：open=close=low=high（扁平柱）
      const zeroData = items.map(c => [c.open, c.open, c.open, c.open]);
      setOption({ ...opt(false), series: [{ type: 'candlestick' as const, data: zeroData }] }, true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(catLabels), JSON.stringify(candleData), upColor, downColor, items.length]);

  return <div ref={chartRef} className="w-full h-full" />;
}
