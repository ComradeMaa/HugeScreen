import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ScreenCanvas } from '../components/ScreenCanvas';
import { EditorOverlay } from '../components/EditorOverlay';

/**
 * 主屏幕
 * 默认展示态（全屏数据展示），Ctrl+E 切换编辑器浮层。
 */
export function MainScreen() {
  const {
    config,
    isEditorVisible,
    showEditor,
    hideEditor,
    loadConfig,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // 启动时加载本地配置
  useEffect(() => {
    const saved = localStorage.getItem('hugescreen-config');
    if (saved) {
      try { loadConfig(saved); } catch { /* use default */ }
    }
  }, [loadConfig]);

  // 缩放比：编辑模式需扣除左侧面板宽度
  const EDITOR_PANEL_WIDTH = 280;
  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const availW = isEditorVisible ? cw - EDITOR_PANEL_WIDTH : cw;
      setScale(Math.min(availW / config.canvas.width, ch / config.canvas.height));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [config.canvas, isEditorVisible]);

  // 快捷键
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        isEditorVisible ? hideEditor() : showEditor();
      }
      if (e.key === 'Escape' && isEditorVisible) hideEditor();
      if (e.key === 'Delete' && isEditorVisible) {
        const { selectedWidgetId, removeWidget: rm } = useEditorStore.getState();
        if (selectedWidgetId) rm(selectedWidgetId);
      }
    },
    [isEditorVisible, showEditor, hideEditor],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 展示态 left：精确居中 = (视口宽 - 画布缩放后宽) / 2
  const displayLeft = Math.max(0, ((containerRef.current?.clientWidth ?? window.innerWidth) - config.canvas.width * scale) / 2);

  const canvasStyle: React.CSSProperties = {
    width: config.canvas.width,
    height: config.canvas.height,
    position: 'absolute',
    top: 0,
    left: isEditorVisible ? 280 : displayLeft,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    transition: 'left 300ms ease, transform 300ms ease',
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-surface-base overflow-hidden relative"
    >
      {/* 展示画布 */}
      <div style={canvasStyle}>
        <ScreenCanvas isEditing={isEditorVisible} />
      </div>

      {/* 编辑器浮层 */}
      <EditorOverlay />

      {/* 展示态提示：底部居中 Ctrl+E */}
      {!isEditorVisible && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-[11px] text-textSecondary/30 bg-surface-panel/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[rgba(255,255,255,0.04)]">
            按 <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-surface-hover border border-[rgba(255,255,255,0.06)]">Ctrl+E</kbd> 编辑大屏
          </span>
        </div>
      )}

      {/* 编辑态：底部提示 */}
      {isEditorVisible && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <span className="text-[10px] text-textSecondary/25 tracking-wide">
            拖拽组件到左侧组件池以删除 · Delete 键删除选中
          </span>
        </div>
      )}
    </div>
  );
}
