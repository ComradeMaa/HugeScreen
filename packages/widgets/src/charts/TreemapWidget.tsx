import { useEffect, useState, useRef, Fragment } from 'react';
import { useECharts, echarts } from './useECharts';

export interface TreemapNode {
  name: string;
  value?: number;
  children?: TreemapNode[];
}

interface TreemapWidgetProps {
  /** 矩形树数据（每项一个根） */
  treemaps?: TreemapNode[];
  /** 面包屑导航（顶部，点击返回上级） */
  breadcrumb?: boolean;
  /** 可缩放/平移 */
  roam?: boolean;
  /** 点击有子节点的卡片下钻 */
  drillDown?: boolean;
}

const DEFAULT_TREEMAP: TreemapNode = {
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
};

/**
 * TreemapWidget — 矩形树图（下钻模式）。
 * 初始显示第一层卡片（如 华东/华南），点击卡片下钻显示其子级（上海/杭州/南京），
 * 顶部面包屑返回上级。数据切换驱动，非 zoomToNode（保证初始画面干净、层级清晰）。
 * 严格复用 useECharts 基础设施。
 */
export function TreemapWidget({
  treemaps,
  breadcrumb = true,
  roam = true,
  drillDown = true,
}: TreemapWidgetProps) {
  const { chartRef, setOption } = useECharts();
  const [didInit, setDidInit] = useState(false);

  const roots = treemaps?.length ? treemaps : [DEFAULT_TREEMAP];
  const root = roots[0];

  // 当前下钻路径（[] = 根层，显示第一层卡片）
  const [path, setPath] = useState<string[]>([]);
  const pathRef = useRef(path);
  pathRef.current = path;
  const rootRef = useRef(root);
  rootRef.current = root;

  // 下钻中间态：点击卡片后先显示该卡片（无 children 单卡片，放大填满），
  // 动画结束后再切换为子节点卡片布局
  const [drillTarget, setDrillTarget] = useState<{ name: string; value: number } | null>(null);
  const drillTargetRef = useRef(drillTarget);
  drillTargetRef.current = drillTarget;

  // 淡入淡出阶段：'out' 旧界面淡出（禁布局动画）→ 'in' 新卡片浮现 → 'idle' 恢复
  const [fadePhase, setFadePhase] = useState<'idle' | 'out' | 'in'>('idle');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  // 数据变化时回到根层
  useEffect(() => {
    setPath([]);
    setDrillTarget(null);
    setFadePhase('idle');
    clearTimers();
  }, [JSON.stringify(roots)]);

  // 解析当前层节点
  const resolve = (nodes: TreemapNode[], p: string[]): TreemapNode[] => {
    if (p.length === 0) return nodes;
    const node = nodes.find((n) => n.name === p[0]);
    return node ? resolve(node.children ?? [], p.slice(1)) : [];
  };
  const current = resolve(root.children ?? [], path);
  const display = current.length ? current : (root.children ?? []);

  // 两阶段下钻动画：
  //   阶段1：data 换成「点击卡片（无 children 单卡片）」→ treemap 原生动画：卡片放大填满
  //   阶段2：旧界面淡出（opacity）→ data 切换子卡片（150ms 短过渡，treemap 0 时长更新不渲染）→ 淡入
  useEffect(() => {
    if (!drillTarget) return;
    const name = drillTarget.name;
    const t1 = setTimeout(() => {
      // 阶段1 放大完成 → 淡出旧界面
      setFadePhase('out');
      const t2 = setTimeout(() => {
        // 切换子卡片布局 + 淡入（t3 由 fadePhase effect 独立处理，不被清理）
        setPath([...pathRef.current, name]);
        setDrillTarget(null);
        setFadePhase('in');
      }, 220);
      timersRef.current.push(t2);
    }, 520);
    timersRef.current.push(t1);
    return clearTimers;
  }, [drillTarget]);

  // fadePhase 'in' → 300ms 后回 idle（独立 effect，避免被 drillTarget cleanup 误清）
  useEffect(() => {
    if (fadePhase !== 'in') return;
    const t = setTimeout(() => setFadePhase('idle'), 300);
    return () => clearTimeout(t);
  }, [fadePhase]);

  // 节点 value 汇总（父节点无 value 时求和）
  const sumValue = (n: TreemapNode): number =>
    n.value ?? (n.children?.length ? n.children.reduce((s, c) => s + sumValue(c), 0) : 1);

  // 绑定节点点击 → 下钻（需实例，useECharts 创建后此 effect 顺序执行）
  useEffect(() => {
    const el = chartRef.current;
    const inst = el ? echarts.getInstanceByDom(el) : null;
    if (!inst) return;
    const handler = (params: any) => {
      if (params.componentType !== 'series') return;
      const name = params.data?.name;
      if (!name) return;
      const p = pathRef.current;
      const nodes = resolve(rootRef.current.children ?? [], p);
      const node = nodes.find((n) => n.name === name);
      if (drillDown && node?.children?.length) {
        // 阶段1：先显示该卡片（放大填满），动画结束由 effect 切换数据
        setDrillTarget({ name, value: sumValue(node) });
      }
    };
    inst.on('click', handler);
    return () => { inst.off('click', handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillDown]);

  useEffect(() => {
    // 渲染数据：下钻中间态显示单卡片（放大填满），否则显示当前层卡片
    const renderData = drillTarget
      ? [{ name: drillTarget.name, value: drillTarget.value, _hasChildren: false }]
      : display.map((n) => ({
          name: n.name,
          value: n.value ?? 1,
          _hasChildren: !!(n.children?.length),
        }));
    // 布局动画：阶段1（放大填满）500ms；淡入阶段 0（merge 模式下 treemap 0 时长更新可正常布局，原地出现）
    const layoutAnim = drillTarget ? 500 : (fadePhase === 'idle' ? 500 : 0);

    const opt = (animated: boolean) => ({
      animation: animated,
      animationDuration: animated ? 500 : 0,
      animationDurationUpdate: animated ? layoutAnim : 0,   // 数据过渡动画（下钻两阶段用）
      animationEasing: animated ? 'cubicOut' : undefined,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (p: any) => {
          const d = p.data;
          const v = typeof d.value === 'number' ? d.value : '';
          const hasKids = !!d._hasChildren;
          return `${d.name}${v !== '' ? `<br/>值: ${v}` : ''}${hasKids ? '<br/>点击下钻' : ''}`;
        },
      },
      series: [{
        type: 'treemap' as const,
        data: renderData,
        nodeClick: false as const,
        roam,
        top: breadcrumb ? 26 : 8,
        left: 8, right: 8, bottom: 8,
        label: {
          show: true,
          color: '#E8E8EC',
          fontSize: 10,
          formatter: (p: any) => (p.name.length > 10 ? `${p.name.slice(0, 10)}…` : p.name),
        },
        itemStyle: {
          borderColor: '#2C2C34',
          borderWidth: 2,
          gapWidth: 2,
        },
        emphasis: {
          itemStyle: { borderColor: '#FF8C42', borderWidth: 2 },
        },
        animation: animated, animationDuration: animated ? 500 : 0,
        animationDurationUpdate: animated ? layoutAnim : 0,
      }],
    });

    if (didInit) {
      // ★ 更新用 merge（notMerge=false）：treemap 保留实例状态，0 时长数据更新可正常布局（原地出现）
      setOption(opt(true), false);
    } else {
      setDidInit(true);
      setOption(opt(false), true);
    }
  }, [JSON.stringify(display), JSON.stringify(drillTarget), breadcrumb, roam, path, fadePhase]);

  // 顶部面包屑（手动渲染，点击返回上级）
  const crumb = [root.name, ...path];

  return (
    <div className="relative w-full h-full">
      {breadcrumb && crumb.length > 0 && (
        <div className="absolute top-0.5 left-1.5 z-10 flex items-center gap-1 text-[9px] pointer-events-auto" style={{ maxWidth: '92%', flexWrap: 'wrap' }}>
          {crumb.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="text-textSecondary/30">›</span>}
              <button
                onClick={() => setPath(i === 0 ? [] : path.slice(0, i - 1))}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  i === crumb.length - 1
                    ? 'text-accent-cool bg-accent-cool/10'
                    : 'text-textSecondary/70 hover:text-accent-cool bg-surface-base/60'
                }`}>
                {c}
              </button>
            </Fragment>
          ))}
        </div>
      )}
      <div
        ref={chartRef}
        className="w-full h-full"
        style={{
          opacity: fadePhase === 'out' ? 0 : 1,
          transition: fadePhase === 'out' ? 'opacity 0.2s ease' : (fadePhase === 'in' ? 'opacity 0.28s ease' : 'none'),
        }}
      />
    </div>
  );
}
