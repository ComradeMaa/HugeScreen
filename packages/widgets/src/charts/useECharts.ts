import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';

// ─── 全局 resize 调度器：多个图表实例的 resize 统一批量处理 ───
let resizeQueue: Array<() => void> = [];
let resizeRaf: number | null = null;

function scheduleResize(fn: () => void) {
  resizeQueue.push(fn);
  if (resizeRaf === null) {
    resizeRaf = requestAnimationFrame(() => {
      const batch = resizeQueue;
      resizeQueue = [];
      resizeRaf = null;
      // 去重：同一实例多次 resize 只执行最后一次
      const seen = new Set<() => void>();
      batch.reverse();
      const unique = batch.filter(fn => {
        if (seen.has(fn)) return false;
        seen.add(fn);
        return true;
      });
      unique.reverse();
      for (const fn of unique) {
        fn();
      }
    });
  }
}

// ─── 全局滚动状态：滚动期间暂停 resize，滚动停止后再执行 ───
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let isScrolling = false;

function onGlobalScroll() {
  if (!isScrolling) {
    isScrolling = true;
    // 滚动开始：暂停所有 resize
  }
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    isScrolling = false;
    // 滚动停止：批量执行所有等待的 resize
    if (globalResizeFn) globalResizeFn();
  }, 150);
}

let scrollListenerAdded = false;
let globalResizeFn: (() => void) | null = null;

function ensureScrollListener() {
  if (!scrollListenerAdded) {
    window.addEventListener('scroll', onGlobalScroll, { passive: true });
    window.addEventListener('touchmove', onGlobalScroll, { passive: true });
    scrollListenerAdded = true;
  }
}

export function useECharts() {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  // 交互保护：用户刚操作图表 500ms 内不触发 resize
  const lastInteractionRef = useRef(0);

  const setOption = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (option: any, notMerge = true) => {
      const inst = instanceRef.current;
      if (!inst) return;
      inst.setOption(option, { notMerge, lazyUpdate: true });
    },
    [],
  );

  // 安全 resize：滚动期间跳过，交互冷却期内跳过
  const safeResize = useCallback(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    // 交互保护期内跳过 resize，防止 emphasis/click 被中断
    if (Date.now() - lastInteractionRef.current < 500) return;
    if (isScrolling) {
      // 滚动中：加入调度队列，等滚动停止
      scheduleResize(() => inst.resize());
    } else {
      scheduleResize(() => inst.resize());
    }
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    ensureScrollListener();
    const instance = echarts.init(chartRef.current, undefined, {
      // 减小渲染器开销
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
    instanceRef.current = instance;

    // 记录用户交互时间
    const onInteraction = () => {
      lastInteractionRef.current = Date.now();
    };
    instance.on('click', onInteraction);
    instance.on('mouseover', onInteraction);

    // 用全局调度替代独立 ResizeObserver
    const ro = new ResizeObserver(() => safeResize());
    ro.observe(chartRef.current);

    // 窗口 resize 也走批量调度
    const onWinResize = () => safeResize();
    window.addEventListener('resize', onWinResize, { passive: true });

    return () => {
      window.removeEventListener('resize', onWinResize);
      ro.disconnect();
      instance.off('click', onInteraction);
      instance.off('mouseover', onInteraction);
      instance.dispose();
      instanceRef.current = null;
    };
  }, [safeResize]);

  return { chartRef, setOption };
}

export { echarts };
