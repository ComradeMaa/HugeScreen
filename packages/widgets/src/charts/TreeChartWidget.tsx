import { useEffect, useState } from 'react';
import { useECharts, echarts } from './useECharts';

export interface TreeNode {
  name: string;
  children?: TreeNode[];
}

export type TreeOrient = 'LR' | 'TB' | 'RL' | 'BT';

interface TreeChartWidgetProps {
  /** 多棵树形数据（每项一个根节点，可多棵树并排） */
  trees?: TreeNode[];
  /** 树朝向：LR 左→右 / RL 右→左 / TB 上→下 / BT 下→上 */
  orient?: TreeOrient;
  lineColor?: string;
  nodeColor?: string;
  /** 点击节点展开/折叠 */
  expandCollapse?: boolean;
  /** 初始展开深度 */
  initialDepth?: number;
}

const DEFAULT_TREE: TreeNode = {
  name: '总部',
  children: [
    {
      name: '华东区',
      children: [
        { name: '上海' }, { name: '杭州' }, { name: '南京' },
      ],
    },
    {
      name: '华南区',
      children: [
        { name: '广州' }, { name: '深圳' },
      ],
    },
    {
      name: '华北区',
      children: [
        { name: '北京' }, { name: '天津' }, { name: '石家庄' },
      ],
    },
  ],
};

const ORIENT_MAP: Record<TreeOrient, 'LR' | 'TB' | 'RL' | 'BT'> = {
  LR: 'LR', RL: 'RL', TB: 'TB', BT: 'BT',
};

/**
 * TreeChartWidget — 树形图，整合 ECharts Tree 的四个朝向示例
 * （Left→Right / Bottom→Top / Right→Left / Top→Bottom）。
 * orient 控制展开方向，expandAndCollapse 支持点击折叠/展开。
 * 严格复用 useECharts 基础设施。
 */
export function TreeChartWidget({
  trees,
  orient = 'LR',
  lineColor = 'rgba(0,212,255,0.4)',
  nodeColor = '#00D4FF',
  expandCollapse = true,
  initialDepth = 2,
}: TreeChartWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const roots = trees?.length ? trees : [DEFAULT_TREE];

  useEffect(() => {
    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 600 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => p.name,
      },
      // 每棵树一个 series，各占一份垂直空间竖排（多根 data 会重叠，故用多 series）
      series: roots.map((root, i) => ({
        type: 'tree' as const,
        data: [root],
        orient: ORIENT_MAP[orient],
        // 对称大边距：容纳根节点（左/上）与叶子节点（右/下）的标签，避免溢出
        top: `${(i * 100) / roots.length}%`,
        height: `${100 / roots.length}%`,
        left: 56, right: 56,
        // 可缩放/平移：树过大时用户可滚轮缩放补救
        roam: true,
        symbol: 'circle',
        symbolSize: 8,
        initialTreeDepth: initialDepth,
        expandAndCollapse: expandCollapse,
        itemStyle: {
          color: nodeColor,
          borderColor: 'rgba(255,255,255,0.15)',
          borderWidth: 1,
        },
        label: {
          position: 'left' as const,
          verticalAlign: 'middle' as const,
          align: 'right' as const,
          color: '#E8E8EC',
          fontSize: 10,
          // 长名截断，防止标签撑出组件
          overflow: 'truncate' as const,
          width: 64,
        },
        leaves: {
          label: {
            position: 'right' as const,
            verticalAlign: 'middle' as const,
            align: 'left' as const,
            color: '#9E9EA8',
            fontSize: 10,
            // ★ 叶子文字自适应：最多一行 16 字（10px 字号 × 16 = 160px，全角标点算一字），
            //   超出部分 break 自动换行（中文按字符断行）。tree 布局按 label 实际尺寸
            //   压缩节点间连线长度，把水平/垂直空间让给多行文字。
            overflow: 'break' as const,
            width: 160,
          },
        },
        lineStyle: {
          color: lineColor,
          width: 1,
          curveness: 0.5,
        },
        emphasis: {
          focus: 'descendant' as const,
          lineStyle: { color: '#FF8C42' },
        },
        animation: animated, animationDuration: animated ? 600 : 0,
      })),
    });

    if (didInit) {
      setOption(opt(true), true);
    } else {
      setDidInit(true);
      setOption(opt(false), true);
    }
  }, [JSON.stringify(roots), orient, lineColor, nodeColor, expandCollapse, initialDepth]);

  return <div ref={chartRef} className="w-full h-full" />;
}
