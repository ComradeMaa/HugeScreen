import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components';

// 按需注册 ECharts 核心组件
echarts.use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

export function useECharts() {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  const setOption = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (option: any, notMerge = true) => {
      if (!instanceRef.current) return;
      instanceRef.current.setOption(option, { notMerge });
    },
    [],
  );

  const getInstance = useCallback(() => instanceRef.current, []);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表实例
    const instance = echarts.init(chartRef.current);
    instanceRef.current = instance;

    // 响应窗口变化
    const handleResize = () => instance.resize();
    // 使用 ResizeObserver 监听容器变化
    const observer = new ResizeObserver(() => {
      instance.resize();
    });
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  return { chartRef, setOption, getInstance };
}

export { echarts };
