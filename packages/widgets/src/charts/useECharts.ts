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

  useEffect(() => {
    if (!chartRef.current) return;

    const instance = echarts.init(chartRef.current);
    instanceRef.current = instance;

    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  return { chartRef, setOption, instanceRef };
}

export { echarts };
