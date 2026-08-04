import { useEffect, useState } from 'react';
import { useECharts } from './useECharts';

export interface SankeyNode { name: string; value?: number; }
export interface SankeyLink { source: string; target: string; value: number; }

interface SankeyWidgetProps {
  /** 节点（名称 + 可选值） */
  nodes?: SankeyNode[];
  /** 连线（起点/终点/流量值） */
  links?: SankeyLink[];
  /** 布局方向 */
  orient?: 'horizontal' | 'vertical';
  /** 悬停高亮模式（相邻链路/无） */
  focusMode?: 'adjacency' | 'none';
  /** 节点宽度 (px) */
  nodeWidth?: number;
  /** 节点间距 (px) */
  nodeGap?: number;
  /** 连线不透明度 */
  lineOpacity?: number;
}

const DEFAULT_NODES: SankeyNode[] = [
  { name: '总流量', value: 30 },
  { name: '渠道A', value: 15 },
  { name: '渠道B', value: 15 },
  { name: '上海', value: 8 },
  { name: '杭州', value: 7 },
  { name: '广州', value: 9 },
  { name: '成都', value: 6 },
];
const DEFAULT_LINKS: SankeyLink[] = [
  { source: '总流量', target: '渠道A', value: 15 },
  { source: '总流量', target: '渠道B', value: 15 },
  { source: '渠道A', target: '上海', value: 8 },
  { source: '渠道A', target: '杭州', value: 7 },
  { source: '渠道B', target: '广州', value: 9 },
  { source: '渠道B', target: '成都', value: 6 },
];
const SANKEE_COLORS = ['#00D4FF', '#3A8BFF', '#5B6EE8', '#FF8C42', '#2BC8E8', '#7FD8F7'];

/**
 * SankeyWidget — 桑基图（参考 ECharts Basic Sankey）。
 * 节点 + 连线构成流量流向图：连线宽度 = 流量值，渐变着色（source→target 色）。
 * 悬停节点高亮相邻链路（focus:'adjacency'），节点可拖动。
 * 严格复用 useECharts 基础设施。
 */
export function SankeyWidget({
  nodes,
  links,
  orient = 'horizontal',
  focusMode = 'adjacency',
  nodeWidth = 14,
  nodeGap = 12,
  lineOpacity = 0.35,
}: SankeyWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const nodeList = nodes?.length ? nodes : DEFAULT_NODES;
  const linkList = links?.length ? links : DEFAULT_LINKS;

  useEffect(() => {
    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => {
          const d = p.data;
          if (!d) return '';
          const v = typeof d.value === 'number' ? d.value : '';
          const nm = d.name ?? (d.source ? `${d.source} → ${d.target}` : '');
          return `${nm}${v !== '' ? `<br/>值: ${v}` : ''}`;
        },
      },
      series: [{
        type: 'sankey' as const,
        data: nodeList,
        links: linkList,
        orient,
        left: 4,
        top: 4,
        bottom: 4,
        right: '12%',
        nodeWidth,
        nodeGap,
        draggable: true,
        label: { color: '#E8E8EC', fontSize: 10 },
        itemStyle: { borderColor: '#2C2C34', borderWidth: 1 },
        // 渐变连线（source 色 → target 色），Basic Sankey 示例观感
        lineStyle: { color: 'gradient', opacity: lineOpacity, curveness: 0.5 },
        emphasis: {
          focus: focusMode,
          lineStyle: { opacity: Math.min(lineOpacity * 2.5, 0.8) },
        },
        color: SANKEE_COLORS,
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
  }, [JSON.stringify([nodeList, linkList]), orient, focusMode, nodeWidth, nodeGap, lineOpacity]);

  return <div ref={chartRef} className="w-full h-full" />;
}
