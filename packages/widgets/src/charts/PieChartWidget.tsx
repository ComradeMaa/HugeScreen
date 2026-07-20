import { useEffect, useState } from 'react';
import { useECharts } from './useECharts';

interface PieChartWidgetProps {
  data?: { name: string; value: number }[];
  categories?: { name: string; value: number }[];
  donut?: boolean;
  showLegend?: boolean;
}

const DEFAULT_DATA = [
  { name: '类别A', value: 335 }, { name: '类别B', value: 310 },
  { name: '类别C', value: 234 }, { name: '类别D', value: 135 }, { name: '类别E', value: 548 },
];
const COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#f87171', '#a78bfa', '#60a5fa'];

export function PieChartWidget({ data, categories, donut = true, showLegend = false }: PieChartWidgetProps) {
  const pd = (categories?.length ? categories : data) ?? DEFAULT_DATA;
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  useEffect(() => {
    const total = pd.reduce((sum, d) => sum + d.value, 0);

    const opt = (animated: boolean, dataOverride?: typeof pd) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const, backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)', textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: { data: { name: string; value: number }; percent: number }) => {
          const pct = total > 0 ? ((p.data.value / total) * 100).toFixed(1) : '0.0';
          return `${p.data.name}: ${p.data.value.toLocaleString()} (${pct}%)`;
        },
      },
      legend: showLegend ? {
        orient: 'vertical' as const, right: 4, top: 'center',
        textStyle: { color: '#9E9EA8', fontSize: 10 }, itemWidth: 8, itemHeight: 8, itemGap: 8,
      } : undefined,
      series: [{
        type: 'pie' as const,
        radius: donut ? ['45%', '72%'] : ['0%', '70%'],
        center: showLegend ? ['40%', '50%'] : ['50%', '50%'],
        avoidLabelOverlap: false,
        startAngle: 90,
        clockwise: false,
        animationType: 'expansion',
        animationDelay: (idx: number) => idx * 200,
        itemStyle: { borderRadius: 2, borderColor: '#2C2C34', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' as const, color: '#ffffff' }, scaleSize: 8,
        },
        data: (dataOverride ?? pd).map((item, i) => ({ ...item, itemStyle: { color: COLORS[i % COLORS.length] } })),
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      // 空数组基线 → 真正从空白开始
      setOption(opt(false, []), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true, pd), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(pd), donut, showLegend]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-1 left-2 z-10 pointer-events-none flex flex-col gap-0.5 max-w-[70%]">
        {pd.map((d, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-[9px] text-textSecondary/70 truncate max-w-[60px]" title={d.name}>{d.name}</span>
          </div>
        ))}
      </div>
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
}
