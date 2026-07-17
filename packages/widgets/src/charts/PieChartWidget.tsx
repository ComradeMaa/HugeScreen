import { useEffect } from 'react';
import { useECharts } from './useECharts';

interface PieChartWidgetProps {
  title?: string;
  /** 数据：{ name, value }[] */
  data?: { name: string; value: number }[];
  /** 可编辑类别（优先于 data） */
  categories?: { name: string; value: number }[];
  /** 是否环形图 */
  donut?: boolean;
  /** 是否显示图例 */
  showLegend?: boolean;
}

const DEFAULT_DATA = [
  { name: '类别A', value: 335 },
  { name: '类别B', value: 310 },
  { name: '类别C', value: 234 },
  { name: '类别D', value: 135 },
  { name: '类别E', value: 548 },
];

const COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#f87171', '#a78bfa', '#60a5fa'];

/**
 * 饼图 / 环形图组件
 */
export function PieChartWidget({
  title,
  data,
  categories,
  donut = true,
  showLegend = true,
}: PieChartWidgetProps) {
  const pieData = (categories && categories.length > 0 ? categories : data) ?? DEFAULT_DATA;
  const { chartRef, setOption } = useECharts();

  useEffect(() => {
    const total = pieData.reduce((sum, d) => sum + d.value, 0);

    setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: '#2C2C34',
        borderColor: 'rgba(255,255,255,0.06)',
        textStyle: { color: '#E8E8EC', fontSize: 12 },
        formatter: (params: { data: { name: string; value: number }; percent: number }) => {
          const pct = total > 0 ? ((params.data.value / total) * 100).toFixed(1) : '0.0';
          return `${params.data.name}: ${params.data.value.toLocaleString()} (${pct}%)`;
        },
      },
      legend: showLegend
        ? {
            orient: 'vertical',
            right: 4,
            top: 'center',
            textStyle: { color: '#9E9EA8', fontSize: 10 },
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 8,
          }
        : undefined,
      series: [
        {
          type: 'pie',
          radius: donut ? ['45%', '72%'] : ['0%', '70%'],
          center: showLegend ? ['40%', '50%'] : ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 2,
            borderColor: '#2C2C34',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#ffffff',
            },
            scaleSize: 8,
          },
          data: pieData.map((d, i) => ({
            ...d,
            itemStyle: { color: COLORS[i % COLORS.length] },
          })),
        },
      ],
    }, true);
  }, [pieData, donut, showLegend]);

  return (
    <div className="relative w-full h-full">
      {/* 左上角色块图例 */}
      <div className="absolute top-1 left-2 z-10 pointer-events-none flex flex-col gap-0.5 max-w-[70%]">
        {pieData.map((d, i) => (
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
