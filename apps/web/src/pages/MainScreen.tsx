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
    removeWidget,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [globalDragOver, setGlobalDragOver] = useState(false);

  // 启动时加载本地配置
  useEffect(() => {
    const saved = localStorage.getItem('hugescreen-config');
    if (saved) {
      try { loadConfig(saved); } catch { /* use default */ }
    }
  }, [loadConfig]);

  // 快捷键
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+E 切换编辑器
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (isEditorVisible) {
          hideEditor();
        } else {
          showEditor();
        }
      }
      // ESC 关闭编辑器
      if (e.key === 'Escape' && isEditorVisible) {
        hideEditor();
      }
      // Delete 键删除选中组件
      if (e.key === 'Delete' && isEditorVisible) {
        const { selectedWidgetId, removeWidget: rm } = useEditorStore.getState();
        if (selectedWidgetId) {
          rm(selectedWidgetId);
        }
      }
    },
    [isEditorVisible, showEditor, hideEditor],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ─── 全局拖拽悬停指示（画布组件拖出时） ───
  const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/widget-id')) {
      e.preventDefault();
      setGlobalDragOver(true);
    }
  }, []);

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    // 仅当真正离开容器时清除
    if (e.currentTarget === e.target) {
      setGlobalDragOver(false);
    }
  }, []);

  const handleGlobalDrop = useCallback(
    (e: React.DragEvent) => {
      setGlobalDragOver(false);
      const widgetId = e.dataTransfer.getData('application/widget-id');
      if (widgetId) {
        e.preventDefault();
        removeWidget(widgetId);
      }
    },
    [removeWidget],
  );

  // 计算缩放比适配屏幕
  const calcScale = useCallback(() => {
    if (!containerRef.current) return 1;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    return Math.min(cw / config.canvas.width, ch / config.canvas.height);
  }, [config.canvas]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-surface-base overflow-hidden relative"
      onDragOver={isEditorVisible ? handleGlobalDragOver : undefined}
      onDragLeave={isEditorVisible ? handleGlobalDragLeave : undefined}
      onDrop={isEditorVisible ? handleGlobalDrop : undefined}
    >
      {/* 展示画布（始终显示） */}
      <div
        className="absolute"
        style={{
          width: config.canvas.width,
          height: config.canvas.height,
          transform: `scale(${calcScale()})`,
          transformOrigin: 'top left',
          left: isEditorVisible ? '280px' : '50%',
          marginLeft: isEditorVisible ? undefined : `-${config.canvas.width / 2}px`,
          transition: 'left 300ms ease, margin-left 300ms ease',
        }}
      >
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

      {/* 全局拖出画布 → 删除提示 */}
      {isEditorVisible && globalDragOver && (
        <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center">
          <div className="bg-negative/10 border border-negative/30 rounded-xl px-6 py-4 backdrop-blur-sm">
            <span className="text-negative/80 text-sm font-medium">释放以删除组件</span>
          </div>
        </div>
      )}

      {/* 编辑态：底部删除区域提示 */}
      {isEditorVisible && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <span className="text-[10px] text-textSecondary/25 tracking-wide">
            拖拽组件到左侧组件池或画布外以删除 · Delete 键删除选中
          </span>
        </div>
      )}
    </div>
  );
}
