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
      if (scaleMode === 'width') {
        // 移动端：撑满宽度
        setScale(cw / config.canvas.width);
      } else {
        // 桌面：等比缩放填满视口，CSS transform 统一缩放所有内容
        setScale(cw / config.canvas.width);
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [config.canvas, loading, scaleMode]);

  const isMobile = scaleMode === 'width';
  const vpW = containerRef.current?.clientWidth ?? window.innerWidth;
  const vpH = containerRef.current?.clientHeight ?? window.innerHeight;
  const mobileCanvasW = Math.max(320, vpW);
  const displayCanvasH = isMobile
    ? Math.round(effectiveCanvasH * mobileCanvasW / config.canvas.width)
    : Math.round(config.canvas.width * (vpH / vpW));

  const canvasWrapperStyle: React.CSSProperties = isMobile ? {
    width: mobileCanvasW,
    height: displayCanvasH,
    position: 'relative',
  } : {
    // 桌面展示态：设计宽 1920 + 拉伸高度 + CSS transform 统一缩放
    width: config.canvas.width,
    height: displayCanvasH,
    position: 'absolute',
    top: 0,
    left: 0,
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
          canvasWidth={isMobile ? mobileCanvasW : config.canvas.width}
          canvasHeight={isMobile ? displayCanvasH : displayCanvasH}
        />
      </div>
    </div>
  );
}
