import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';

export function useECharts() {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  const setOption = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (option: any, notMerge = true) => {
      const inst = instanceRef.current;
      if (!inst) return;
      inst.setOption(option, notMerge);
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
