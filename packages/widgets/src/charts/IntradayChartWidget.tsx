import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface IntradayPoint {
  /** 时间标签（HH:mm 或 ISO 字符串），作为 category 轴标签 */
  time: string;
  value: number;
}

interface IntradayChartWidgetProps {
  points?: IntradayPoint[];
  lineColor?: string;
  /** 刻度线（category 轴对齐标签 + value 轴） */
  showTick?: boolean;
}

/** 生成模拟盘中数据：9:30-11:30 + 13:00-15:00（5 分钟间隔，午休断开） */
export function genMockIntraday(): IntradayPoint[] {
  const pts: IntradayPoint[] = [];
  const mk = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  let v = 100;
  let i = 0;
  const push = (h: number, m: number) => {
    v += Math.sin(i / 6) * 0.8 + (Math.random() - 0.5) * 0.6;
    pts.push({ time: mk(h, m), value: Math.round(v * 100) / 100 });
    i++;
  };
  for (let m = 30; m <= 90; m += 5) push(9, m % 60);       // 9:30-10:30
  for (let m = 0; m <= 90; m += 5) push(10, m % 60);       // 10:05-11:30
  for (let m = 0; m <= 120; m += 5) push(13, m % 60);      // 13:00-15:00
  return pts;
}

const DEFAULT_POINTS = genMockIntraday();

/**
 * IntradayChartWidget — 盘中走势图（带休市间隔），对应 ECharts Intraday Chart with Breaks。
 * 核心技巧：用 category 轴代替 time 轴，时间字符串作为轴标签 ——
 * 只有数据存在的时刻显示，休市时段（午休等）自动跳过，不产生空白。
 * 严格复用 useECharts 基础设施。
 */
export function IntradayChartWidget({
  points,
  lineColor = '#00D4FF',
  showTick = true,
}: IntradayChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const pts = points?.length ? points : DEFAULT_POINTS;
  const labels = pts.map((p) => p.time);
  const values = pts.map((p) => p.value);

  useEffect(() => {
    // 时间标签格式化：ISO 完整时间 → 仅 HH:mm；已是短标签原样
    const fmtTime = (v: string) => {
      const m = /(\d{2}):(\d{2})$/.exec(v);
      return m ? `${m[1]}:${m[2]}` : v;
    };

    const opt = (animated: boolean, zero = false) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
      },
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: showTick, alignWithLabel: showTick },
        axisLabel: {
          color: '#9E9EA8', fontSize: 9, hideOverlap: true,
          formatter: (v: string) => fmtTime(v),
        },
      },
      yAxis: {
        type: 'value' as const,
        scale: true,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: '#9E9EA8', fontSize: 10, formatter: (v: number) => String(Math.round(v * 100) / 100) },
        axisTick: { show: showTick },
      },
      series: [{
        type: 'line' as const,
        name: '数值',
        data: zero ? values.map(() => 0) : values,
        showSymbol: false,
        smooth: false,
        lineStyle: { color: lineColor, width: 1.5 },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${lineColor}3d` },
            { offset: 1, color: `${lineColor}05` },
          ]),
        },
        animation: animated, animationDuration: animated ? 800 : 0,
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false, true), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(labels), JSON.stringify(values), lineColor, showTick]);

  return <div ref={chartRef} className="w-full h-full" />;
}
