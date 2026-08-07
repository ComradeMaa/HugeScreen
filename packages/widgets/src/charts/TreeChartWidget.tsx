import { useEffect, useRef, useState } from 'react';
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
  const { chartRef, setOption, instanceRef } = useECharts();
  const [didInit, setDidInit] = useState(false);
  // 容器宽度：叶子 label 换行区宽度按组件剩余空间收缩，防止文字溢出组件外
  const [containerW, setContainerW] = useState(600);
  // ★ roam 状态保持（滚轮缩放/拖拽平移）：ECharts 的 treeRoam action 会把
  //   center/zoom 写回 series option，但组件 setOption(notMerge) 会清空它们 →
  //   进入/退出编辑模式或修改组件时 roam 被重置。这里监听 treeRoam 事件读回
  //   每棵树的 zoom/center 缓存，每次 setOption 时随 series 一起带回。
  const roamRef = useRef<Record<number, { zoom?: number; center?: number[] }>>({});

  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    const handler = () => {
      const series = (inst.getOption() as any).series as any[];
      if (!Array.isArray(series)) return;
      const next: Record<number, { zoom?: number; center?: number[] }> = {};
      series.forEach((s, i) => {
        if (s.zoom != null || s.center != null) {
          next[i] = { zoom: s.zoom, center: s.center };
        }
      });
      roamRef.current = next;
    };
    inst.on('treeRoam', handler);
    return () => { inst.off('treeRoam', handler); };
  }, [instanceRef]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerW(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const roots = trees?.length ? trees : [DEFAULT_TREE];
  // ★ 叶子 label 宽度：最多一行 16 字封顶（10px 字号 × 16 = 160px，全角标点算一字）；
  //   组件较窄时按剩余空间比例（约 42% − 边距）收缩。
  //   此宽度同时用作 series 的 right 边距 —— 布局器把叶子层放在 right 边缘，
  //   label 恰好占满剩余空间（不溢出），布局区变窄使每层间距（连线）同步压缩。
  const leafLabelWidth = Math.max(90, Math.min(160, Math.floor(containerW * 0.42) - 12));

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
        // ★ 恢复该树上次的 roam 状态（zoom/center），避免编辑模式切换/配置修改后重置
        ...(roamRef.current[i] ?? {}),
        type: 'tree' as const,
        data: [root],
        orient: ORIENT_MAP[orient],
        // ★ right 边距 = 叶子 label 宽度（关键）：ECharts tree 正交布局中
        //   叶子层永远贴着 right 边距（叶子点 x = left + 可用宽），label 可用空间
        //   恒等于 right 边距 —— 只有把 right 设为 label 宽度，文字才不会超出组件；
        //   同时布局区随之变窄，每层间距（连线长度）自动被压缩，给文字留出空间。
        top: `${(i * 100) / roots.length}%`,
        height: `${100 / roots.length}%`,
        left: 56, right: leafLabelWidth,
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
            // ★ 叶子文字自适应：最多一行 16 字，超出 break 自动换行（中文按字符断行）；
            //   宽度按容器剩余空间收缩（leafLabelWidth），保证换行区不超出组件边界。
            overflow: 'break' as const,
            width: leafLabelWidth,
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
  }, [JSON.stringify(roots), orient, lineColor, nodeColor, expandCollapse, initialDepth, leafLabelWidth]);

  return <div ref={chartRef} className="w-full h-full" />;
}
