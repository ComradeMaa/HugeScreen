import { useEffect, useState } from 'react';
import { useECharts } from './useECharts';

export interface FunnelItem { name: string; value: number; }

interface FunnelWidgetProps {
  /** 漏斗数据（名称 + 数值，数值大的层在上） */
  categories?: FunnelItem[];
  /** 排序：降序/升序/保持数据顺序（funnel 默认 'descending'，需显式控制） */
  sortMode?: 'desc' | 'asc' | 'none';
  /** 层间距 (px) */
  gap?: number;
  /** 梯形对齐 */
  funnelAlign?: 'left' | 'center' | 'right';
  /** 标签位置（内部/外部带指引线） */
  labelPosition?: 'inside' | 'outer';
  /** 标签显示百分比 */
  showPercent?: boolean;
  /** 显示图例 */
  showLegend?: boolean;
}

const DEFAULT_FUNNEL: FunnelItem[] = [
  { name: '展现', value: 100 },
  { name: '点击', value: 80 },
  { name: '访问', value: 60 },
  { name: '咨询', value: 40 },
  { name: '订单', value: 20 },
];
const FUNNEL_COLORS = ['#00D4FF', '#3A8BFF', '#5B6EE8', '#FF8C42', '#2BC8E8', '#7FD8F7'];

/**
 * FunnelWidget — 漏斗图（参考 ECharts Funnel Chart）。
 * 梯形层叠展示转化/占比：数值大的层在上，宽度按数值比例收窄。
 * 严格复用 useECharts 基础设施。
 */
export function FunnelWidget({
  categories,
  sortMode = 'desc',
  gap = 2,
  funnelAlign = 'center',
  labelPosition = 'inside',
  showPercent = false,
  showLegend = true,
}: FunnelWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const cats = categories?.length ? categories : DEFAULT_FUNNEL;
  const total = cats.reduce((s, c) => s + (c.value ?? 0), 0);
  // funnel 的 sort 有效值：'ascending' | 'descending' | 'none'（源码 funnelLayout.js 判定）
  const sortMap = { desc: 'descending', asc: 'ascending', none: 'none' } as const;

  useEffect(() => {
    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      legend: {
        show: showLegend,
        top: 2,
        right: 8,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#9E9EA8', fontSize: 10 },
      },
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => {
          const v = typeof p.value === 'number' ? p.value : 0;
          const pct = total ? Math.round((v / total) * 100) : 0;
          return `${p.name}<br/>值: ${v}（${pct}%）`;
        },
      },
      series: [{
        type: 'funnel' as const,
        data: cats,
        // ★ left/right 必须对称：funnel 布局以 [left, left+width] 为基准居中，
        // 不对称（如 30%/14%）会把漏斗中心推到 58% 偏右。图例浮动于顶部右上，无需缩窄留位。
        left: '10%',
        right: '10%',
        top: 30,
        bottom: 8,
        sort: sortMap[sortMode],
        minSize: '0%',
        maxSize: '100%',
        gap,
        funnelAlign,
        label: {
          show: true,
          position: labelPosition,
          color: '#E8E8EC',
          fontSize: 10,
          formatter: (p: any) => {
            const pct = total ? Math.round(((p.value ?? 0) / total) * 100) : 0;
            return showPercent ? `${p.name} ${pct}%` : p.name;
          },
        },
        labelLine: {
          show: labelPosition === 'outer',
          length: 8,
          lineStyle: { width: 1 },
        },
        itemStyle: {
          borderColor: '#2C2C34',
          borderWidth: 2,
        },
        emphasis: {
          label: { fontSize: 12 },
          itemStyle: { borderColor: '#FF8C42' },
        },
        color: FUNNEL_COLORS,
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false), true);
      let raf1: number, raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOption(opt(true), false));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
  }, [JSON.stringify(cats), sortMode, gap, funnelAlign, labelPosition, showPercent, showLegend]);

  return <div ref={chartRef} className="w-full h-full" />;
}
