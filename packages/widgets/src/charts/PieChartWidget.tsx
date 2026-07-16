import { useEffect } from 'react';
import { useECharts } from './useECharts';

interface PieChartWidgetProps {
  title?: string;
  /** 数据：{ name, value }[] */
  data?: { name: string; value: number }[];
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
  data = DEFAULT_DATA,
  donut = true,
  showLegend = true,
}: PieChartWidgetProps) {
  const { chartRef, setOption } = useECharts();

  useEffect(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0);

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
          data: data.map((d, i) => ({
            ...d,
            itemStyle: { color: COLORS[i % COLORS.length] },
          })),
        },
      ],
    }, true);
  }, [data, donut, showLegend]);

  return <div ref={chartRef} className="w-full h-full" />;
}
