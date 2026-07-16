import { useEffect, useRef, useState, useMemo } from 'react';
import { ScreenCanvas } from '../components/ScreenCanvas';
import { useEditorStore } from '../store/editorStore';
import type { ScreenConfig } from '@hugescreen/shared';

/**
 * 纯展示模式
 * 加载配置 → 全屏渲染 → 实时数据刷新
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

  // ═══ 等比例缩放 ═══
  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      setScale(Math.min(cw / config.canvas.width, ch / config.canvas.height));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [config.canvas]);

  // 居中偏移
  const offset = useMemo(() => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    return {
      x: (cw - config.canvas.width * scale) / 2,
      y: (ch - config.canvas.height * scale) / 2,
    };
  }, [config.canvas, scale]);

  // ═══ 加载 / 错误状态 ═══
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent-cool animate-pulse" />
          <span className="text-textSecondary/40 text-xs tracking-widest">加载中</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center px-4">
          <span className="text-negative/60 text-sm font-semibold">加载失败</span>
          <span className="text-textSecondary/30 text-xs leading-relaxed">{error}</span>
          <span className="text-textSecondary/20 text-[10px] mt-2">请检查配置 ID 或网络连接</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0a0e1a] overflow-hidden">
      <div
        style={{
          width: config.canvas.width,
          height: config.canvas.height,
          position: 'absolute',
          left: offset.x,
          top: offset.y,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <ScreenCanvas isEditing={false} />
      </div>
    </div>
  );
}
