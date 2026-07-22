import { useState, useEffect, useMemo } from 'react';
import { useEditorStore } from '../store/editorStore';
import { reflowToBreakpoint } from '@hugescreen/core';
import type { GridConfig, WidgetLayout, WidgetConfig } from '@hugescreen/shared';

export type BreakpointId = 'desktop' | 'tablet' | 'mobile';

interface BreakpointInfo {
  id: BreakpointId;
  label: string;
  minWidth: number;
}

export const BREAKPOINTS: BreakpointInfo[] = [
  { id: 'desktop', label: '桌面端', minWidth: 1024 },
  { id: 'tablet',  label: '平板',   minWidth: 640 },
  { id: 'mobile',  label: '手机',   minWidth: 0 },
];

/** 根据视口宽度检测当前断点 */
export function detectBreakpoint(width: number): BreakpointId {
  for (const bp of BREAKPOINTS) {
    if (width >= bp.minWidth) return bp.id;
  }
  return 'mobile';
}

/** 移动端默认网格：1 列，行数动态计算 */
const MOBILE_GRID: GridConfig = { cols: 1, rows: 24, gap: 8, snapToGrid: false };

/** 平板默认网格：2 列 */
const TABLET_GRID: GridConfig = { cols: 2, rows: 12, gap: 8, snapToGrid: false };

/**
 * 响应式断点 Hook
 *
 * 返回当前断点 ID、有效网格、各 widget 的有效布局、缩放模式。
 * 桌面端使用原始布局；平板/手机端优先使用手动覆盖，否则自动重排。
 */
export function useBreakpoint() {
  // 精确订阅：只选择重排所需的切片，避免 widget options 等无关变更触发重算
  const widgets = useEditorStore(s => s.config.widgets);
  const canvas = useEditorStore(s => s.config.canvas);
  const desktopGrid = useEditorStore(s => s.config.grid);
  const responsive = useEditorStore(s => s.config.responsive);
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1920,
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const bp = detectBreakpoint(width);

  return useMemo(() => {

    // 桌面端：直接用原始配置
    if (bp === 'desktop') {
      return {
        breakpoint: 'desktop' as BreakpointId,
        grid: desktopGrid,
        layouts: undefined,
        hiddenWidgets: [] as string[],
        scaleMode: 'auto' as const,
        canvasHeight: canvas.height,
      };
    }

    const targetGrid = bp === 'tablet' ? { ...TABLET_GRID } : { ...MOBILE_GRID };
    const bpConfig = responsive[bp];
    const hidden = bpConfig?.hiddenWidgets || [];

    // 如果有手动覆盖的布局 → 使用手动值
    const hasManualLayouts = bpConfig && Object.keys(bpConfig.widgetLayouts).length > 0;
    if (hasManualLayouts) {
      return {
        breakpoint: bp,
        grid: { ...targetGrid, ...bpConfig.grid },
        layouts: bpConfig.widgetLayouts,
        hiddenWidgets: hidden,
        scaleMode: 'auto' as const,
        canvasHeight: canvas.height,
      };
    }

    // 自动重排
    const reflowWidgets = widgets.map(w => ({ id: w.id, layout: w.layout }));
    const autoLayouts = reflowToBreakpoint(
      reflowWidgets,
      desktopGrid,
      targetGrid,
      canvas.width,
      canvas.height,
      hidden,
    );

    // 根据实际 layout 动态计算所需总行数
    let maxRowEnd = targetGrid.rows;
    for (const l of Object.values(autoLayouts)) {
      maxRowEnd = Math.max(maxRowEnd, l.row + l.rowSpan);
    }
    const dynamicGrid = { ...targetGrid, rows: maxRowEnd };

    // 移动端：用桌面端 cell 高度推算所需画布总高度
    const dg = desktopGrid.gap;
    const deskCH = (canvas.height - dg * (desktopGrid.rows + 1)) / desktopGrid.rows;
    const tg = dynamicGrid.gap;
    const neededH = tg + maxRowEnd * (deskCH + tg);
    const effectiveCanvasH = Math.max(canvas.height, neededH);

    const scaleMode = bp === 'mobile' ? 'width' as const : 'auto' as const;

    return {
      breakpoint: bp,
      grid: dynamicGrid,
      layouts: autoLayouts,
      hiddenWidgets: hidden,
      scaleMode,
      canvasHeight: effectiveCanvasH,
    };
  }, [bp, widgets, canvas, desktopGrid, responsive]);
}
