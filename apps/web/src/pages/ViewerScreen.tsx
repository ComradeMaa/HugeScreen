import { useEffect, useRef, useState, useMemo } from 'react';
import { ScreenCanvas } from '../components/ScreenCanvas';
import { useEditorStore } from '../store/editorStore';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { ScreenConfig } from '@hugescreen/shared';

/**
 * 纯展示模式
 * 加载配置 → 断点适配 → 全屏渲染 → 实时数据刷新
 *
 * 三种配置加载方式：
 *   1. URL 参数 ?id=8  → fetch /api/view/8 (云端)
 *   2. window.__SCREEN_CONFIG__  → 本地 view.js 注入 (离线)
 *   3. 无参数 → 默认空屏
 */
export function ViewerScreen() {
  const { config, setConfig, loadConfig } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ═══ 配置加载 ═══
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');

        if (id) {
          // 云端加载
          const res = await fetch(`/api/view/${id}`);
          if (!res.ok) throw new Error(`配置 ${id} 不存在 (${res.status})`);
          const json: ScreenConfig = await res.json();
          setConfig(json);
        } else if ((window as any).__SCREEN_CONFIG__) {
          // 本地 view.js 注入
          loadConfig(JSON.stringify((window as any).__SCREEN_CONFIG__));
        } else {
          // 无配置 → 尝试 localStorage 兜底
          const saved = localStorage.getItem('hugescreen-config');
          if (saved) {
            loadConfig(saved);
          } else {
            setError('未指定大屏配置。请使用 ?id= 参数或部署 view.js');
          }
        }
      } catch (e: any) {
        setError(e.message || '加载配置失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [setConfig, loadConfig]);

  // ═══ 响应式断点 ═══
  const { grid: bpGrid, layouts: bpLayouts, hiddenWidgets, scaleMode, canvasHeight: bpCanvasH } = useBreakpoint();
  const effectiveCanvasH = bpCanvasH || config.canvas.height;

  // ═══ 缩放 ═══
  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      if (scaleMode === 'width') {
        // 移动端：撑满宽度
        setScale(cw / config.canvas.width);
      } else {
        // 桌面/平板：填满屏幕（cover 策略，裁切溢出部分）
        setScale(Math.max(cw / config.canvas.width, ch / effectiveCanvasH));
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [config.canvas, loading, scaleMode, effectiveCanvasH]);

  // 居中偏移
  const offset = useMemo(() => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    return {
      x: (cw - config.canvas.width * scale) / 2,
      y: scaleMode === 'width'
        ? 0
        : (ch - effectiveCanvasH * scale) / 2,
    };
  }, [config.canvas, scale, scaleMode, effectiveCanvasH]);

  // ═══ 加载 / 错误状态 ═══
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#2C2C34]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent-cool animate-pulse" />
          <span className="text-textSecondary/40 text-xs tracking-widest">加载中</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#2C2C34]">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center px-4">
          <span className="text-negative/60 text-sm font-semibold">加载失败</span>
          <span className="text-textSecondary/30 text-xs leading-relaxed">{error}</span>
          <span className="text-textSecondary/20 text-[10px] mt-2">请检查配置 ID 或网络连接</span>
        </div>
      </div>
    );
  }

  const isMobile = scaleMode === 'width';
  const mobileCanvasW = Math.max(320, containerRef.current?.clientWidth || window.innerWidth || 375);
  const displayCanvasH = isMobile
    ? Math.round(effectiveCanvasH * mobileCanvasW / config.canvas.width)
    : effectiveCanvasH;

  const canvasWrapperStyle: React.CSSProperties = isMobile ? {
    width: mobileCanvasW,
    height: displayCanvasH,
    position: 'relative',
  } : {
    width: config.canvas.width,
    height: displayCanvasH,
    position: 'absolute',
    left: offset.x,
    top: offset.y,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#2C2C34]"
      style={{ overflowY: isMobile ? 'auto' : 'hidden', overflowX: 'hidden' }}
    >
      <div style={canvasWrapperStyle}>
        <ScreenCanvas
          isEditing={false}
          bpGrid={bpGrid}
          bpLayouts={bpLayouts}
          hiddenWidgets={hiddenWidgets}
          canvasWidth={isMobile ? mobileCanvasW : undefined}
          canvasHeight={isMobile ? displayCanvasH : (bpCanvasH !== config.canvas.height ? bpCanvasH : undefined)}
        />
      </div>
    </div>
  );
}
