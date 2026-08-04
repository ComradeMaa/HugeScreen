import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface RelationNode {
  name: string;
  x: number;
  y: number;
}

export interface RelationLink {
  source: string;
  target: string;
}

interface RelationChartWidgetProps {
  nodes?: RelationNode[];
  links?: RelationLink[];
  nodeColor?: string;
  lineColor?: string;
  /** 标签重叠时自动隐藏（核心特性） */
  hideOverlap?: boolean;
}

const DEFAULT_NODES: RelationNode[] = [
  { name: '中心', x: 50, y: 50 },
  { name: '服务A', x: 20, y: 25 }, { name: '服务B', x: 80, y: 25 },
  { name: '服务C', x: 15, y: 75 }, { name: '服务D', x: 85, y: 75 },
  { name: '节点E', x: 50, y: 12 }, { name: '节点F', x: 50, y: 88 },
];
const DEFAULT_LINKS: RelationLink[] = [
  { source: '中心', target: '服务A' }, { source: '中心', target: '服务B' },
  { source: '中心', target: '服务C' }, { source: '中心', target: '服务D' },
  { source: '中心', target: '节点E' }, { source: '中心', target: '节点F' },
  { source: '服务A', target: '节点E' }, { source: '服务D', target: '节点F' },
];

/**
 * RelationChartWidget — 关系图，对应 ECharts Hide Overlapped Label（graph 系列）。
 * 核心特性 label.hideOverlap：标签重叠时自动隐藏。
 * layout: 'none' 使用节点自带坐标。严格复用 useECharts 基础设施。
 */
export function RelationChartWidget({
  nodes,
  links,
  nodeColor = '#00D4FF',
  lineColor = 'rgba(0,212,255,0.45)',
  hideOverlap = true,
}: RelationChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const ns = nodes?.length ? nodes : DEFAULT_NODES;
  const ls = links?.length ? links : DEFAULT_LINKS;

  useEffect(() => {
    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 600 : 0,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => {
          if (p.dataType === 'edge') {
            return `${p.data.source} → ${p.data.target}`;
          }
          return p.name;
        },
      },
      series: [{
        type: 'graph' as const,
        layout: 'none' as const,
        data: ns.map((n) => ({
          name: n.name,
          x: n.x,
          y: n.y,
          symbolSize: 14,
          itemStyle: {
            color: nodeColor,
            shadowBlur: 6,
            shadowColor: `${nodeColor}55`,
          },
        })),
        links: ls.map((l) => ({
          source: l.source,
          target: l.target,
          lineStyle: { color: lineColor, width: 1 },
        })),
        edgeSymbol: ['none', 'arrow'] as const,
        edgeSymbolSize: [0, 7],
        // ★ 核心：标签重叠自动隐藏
        label: {
          show: true,
          position: 'right' as const,
          distance: 4,
          color: '#E8E8EC',
          fontSize: 10,
          hideOverlap: !!hideOverlap,
        },
        emphasis: {
          focus: 'adjacency' as const,
          lineStyle: { width: 3, color: '#FF8C42' },
        },
        animation: animated, animationDuration: animated ? 600 : 0,
      }],
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false), true);
    }
  }, [JSON.stringify(ns), JSON.stringify(ls), nodeColor, lineColor, hideOverlap]);

  return <div ref={chartRef} className="w-full h-full" />;
}
