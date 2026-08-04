import { useEffect, useState } from 'react';
import { useECharts } from './useECharts';

interface PieCategory {
  name: string;
  value: number;
  /** 单独控制该类别是否显示引出线 + 标签 */
  showLabelLine?: boolean;
}

interface PieChartWidgetProps {
  data?: PieCategory[];
  categories?: PieCategory[];
  donut?: boolean;
  showLegend?: boolean;
  /** 左上角颜色图例开关 */
  showColorLegend?: boolean;
  /** 图名 — 自定义显示文字 */
  titleText?: string;
  /** 图名位置 — 左上角或图表下方 */
  titlePosition?: 'topLeft' | 'bottom' | 'none';
  /** 南丁格尔玫瑰图：扇区半径按数值比例（'radius' 按数值、'area' 按面积） */
  roseType?: 'none' | 'radius' | 'area';
}

const DEFAULT_DATA: PieCategory[] = [
  { name: '类别A', value: 335 }, { name: '类别B', value: 310 },
  { name: '类别C', value: 234 }, { name: '类别D', value: 135 }, { name: '类别E', value: 548 },
];
const COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#f87171', '#a78bfa', '#60a5fa'];

export function PieChartWidget({ data, categories, donut = true, showLegend = false, showColorLegend = true, titleText, titlePosition = 'none', roseType = 'none' }: PieChartWidgetProps) {
  const pd = (categories?.length ? categories : data) ?? DEFAULT_DATA;
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  // 是否有任何类别启用了引出线
  const hasAnyLabelLine = pd.some(d => (d as any).showLabelLine);

  useEffect(() => {
    const total = pd.reduce((sum, d) => sum + d.value, 0);

    const opt = (animated: boolean, dataOverride?: typeof pd) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      title: (showTitle && titleText) ? {
        text: titleText,
        left: isTopLeftTitle ? 'left' : 'center',
        top: isTopLeftTitle ? 'top' : 'bottom',
        textStyle: { color: '#E8E8EC', fontSize: 11, fontWeight: 'bold' as const },
      } : undefined,
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
        // 有引出线时缩小饼图半径腾空间
        radius: hasAnyLabelLine
          ? (donut ? ['38%', '62%'] : ['0%', '58%'])
          : (donut ? ['45%', '72%'] : ['0%', '70%']),
        center: showLegend ? ['40%', '50%'] : ['50%', '50%'],
        // 南丁格尔玫瑰图：扇区半径按数值比例（需外半径按数据变化）
        roseType: roseType === 'none' ? undefined : (roseType as 'radius'),
        radius: roseType !== 'none'
          ? (donut ? ['15%', '75%'] : ['0%', '75%'])
          : (hasAnyLabelLine
            ? (donut ? ['38%', '62%'] : ['0%', '58%'])
            : (donut ? ['45%', '72%'] : ['0%', '70%'])),
        avoidLabelOverlap: true,
        startAngle: 90,
        clockwise: false,
        animationType: 'expansion',
        animationDelay: (idx: number) => idx * 200,
        itemStyle: { borderRadius: 2, borderColor: '#2C2C34', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' as const, color: '#ffffff' }, scaleSize: 8,
        },
        data: (dataOverride ?? pd).map((item, i) => {
          const showLine = !!(item as any).showLabelLine;
          return {
            ...item,
            itemStyle: { color: COLORS[i % COLORS.length] },
            label: showLine ? {
              show: true,
              position: 'outside' as const,
              formatter: '{b}: {d}%',
              color: '#E8E8EC',
              fontSize: 10,
            } : { show: false },
            labelLine: showLine ? {
              show: true,
              length: 16,
              length2: 22,
              lineStyle: { color: COLORS[i % COLORS.length], width: 1 },
            } : { show: false },
          };
        }),
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false, []), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true, pd), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(pd), donut, showLegend, titleText, titlePosition, showColorLegend, hasAnyLabelLine, roseType]);

  const showTitle = !!(titleText && titlePosition !== 'none');
  const isTopLeftTitle = titlePosition === 'topLeft';

  return (
    <div className="relative w-full h-full">
      {showColorLegend && (
        <div className={`absolute ${isTopLeftTitle && showTitle ? 'top-5' : 'top-1'} left-2 z-10 pointer-events-none flex flex-col gap-0.5 max-w-[70%]`}>
          {pd.map((d, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-[9px] text-textSecondary/70 truncate max-w-[60px]" title={d.name}>{d.name}</span>
            </div>
          ))}
        </div>
      )}
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
}
