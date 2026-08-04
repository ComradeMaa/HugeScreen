import { useEffect, useState } from 'react';
import { useECharts } from './useECharts';

export interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
}

interface SunburstWidgetProps {
  /** 旭日图数据（每项一个根，多根并列渲染） */
  sunbursts?: SunburstNode[];
  /** 点击扇区下钻/返回（rootToNode 内置） */
  drillDown?: boolean;
  /** 扇区顺时针排布 */
  clockwise?: boolean;
  /** 扇区排序（none = 保持数据顺序） */
  sortMode?: 'none' | 'desc' | 'asc';
  /** 悬停高亮模式（祖先/后代/自身/无） */
  focusMode?: 'ancestor' | 'descendant' | 'self' | 'none';
  /** 显示扇区标签 */
  showLabel?: boolean;
}

const DEFAULT_SUNBURST: SunburstNode[] = [
  {
    name: '总销售额',
    children: [
      {
        name: '华东',
        children: [
          { name: '上海', value: 320 }, { name: '杭州', value: 180 }, { name: '南京', value: 150 },
        ],
      },
      {
        name: '华南',
        children: [
          { name: '广州', value: 260 }, { name: '深圳', value: 240 },
        ],
      },
      {
        name: '华北',
        children: [
          { name: '北京', value: 280 }, { name: '天津', value: 120 },
        ],
      },
      {
        name: '西南',
        children: [
          { name: '成都', value: 190 }, { name: '重庆', value: 170 },
        ],
      },
    ],
  },
];

/**
 * SunburstWidget — 旭日图（参考 ECharts Basic Sunburst）。
 * 层级占比环：中心根节点，向外逐层为子级扇区。
 * 颜色按顶层扇区分色、逐层变浅（sunburst 默认 visual 策略），
 * 点击扇区内置 rootToNode 下钻/返回。
 * 严格复用 useECharts 基础设施。
 */
export function SunburstWidget({
  sunbursts,
  drillDown = true,
  clockwise = true,
  sortMode = 'none',
  focusMode = 'ancestor',
  showLabel = true,
}: SunburstWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const roots = sunbursts?.length ? sunbursts : DEFAULT_SUNBURST;

  // 节点 value 汇总（父节点无 value 时求和，叶子无值兜底 1，保证扇区可见）
  const sumValue = (n: SunburstNode): number =>
    n.value ?? (n.children?.length ? n.children.reduce((s, c) => s + sumValue(c), 0) : 1);
  const toData = (n: SunburstNode): Record<string, unknown> => ({
    name: n.name,
    value: sumValue(n),
    ...(n.children?.length ? { children: n.children.map(toData) } : {}),
  });

  useEffect(() => {
    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 800 : 0,
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        triggerOn: 'mousemove' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => {
          const d = p.data;
          const v = typeof d.value === 'number' ? d.value : '';
          return `${d.name}${v !== '' ? `<br/>值: ${v}` : ''}`;
        },
      },
      series: [{
        type: 'sunburst' as const,
        data: roots.map(toData),
        radius: [0, '95%'],
        // sort: null = 保持数据顺序（Basic Sunburst 示例行为，默认 'desc'）
        sort: sortMode === 'none' ? null : sortMode,
        nodeClick: drillDown ? ('rootToNode' as const) : (false as const),
        clockwise,
        emphasis: { focus: focusMode },
        label: {
          show: showLabel,
          rotate: 'radial',
          minAngle: 10,
          color: '#E8E8EC',
          fontSize: 10,
        },
        // 电光蓝系 + 琥珀点缀；sunburst 按顶层扇区分色并逐层变浅
        color: ['#00D4FF', '#3A8BFF', '#5B6EE8', '#FF8C42', '#2BC8E8'],
        itemStyle: {
          borderColor: '#2C2C34',
          borderWidth: 2,
        },
        // 环带划分（Basic Sunburst 示例配置）
        levels: [
          {},
          { r0: '15%', r: '35%', itemStyle: { borderWidth: 2 } },
          { r0: '35%', r: '70%', itemStyle: { borderWidth: 2 } },
          { r0: '70%', r: '95%', itemStyle: { borderWidth: 2 } },
        ],
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
  }, [JSON.stringify(roots), drillDown, clockwise, sortMode, focusMode, showLabel]);

  return <div ref={chartRef} className="w-full h-full" />;
}
