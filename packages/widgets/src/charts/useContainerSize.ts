import { useRef, useState, useEffect, useCallback } from 'react';

interface Size {
  width: number;
  height: number;
}

/**
 * 测量容器实际渲染尺寸 — 所有非 ECharts 图表组件的公共 hook。
 *
 * ECharts 组件用 useECharts（内置 ResizeObserver + 自动 resize）。
 * Victory / Canvas / 自定义渲染的组件用此 hook 获取尺寸，
 * 避免硬编码高度导致容器不匹配（overflow:hidden 裁剪等 bug）。
 *
 * @returns { containerRef, size, ready } — ready 为 true 时表示尺寸已就绪
 */
export function useContainerSize() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // 初始测量 — 等 DOM 落定
    const raf = requestAnimationFrame(measure);

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [measure]);

  const ready = size.width > 0 && size.height > 0;

  return { containerRef, size, ready };
}
