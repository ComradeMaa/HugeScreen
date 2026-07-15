import { useEditorStore } from '../store/editorStore';
import { WidgetPalette } from './WidgetPalette';
import { PropertyInspector } from './PropertyInspector';
import { useState, useEffect, useCallback } from 'react';

/**
 * 编辑器浮层
 * 从左侧滑入，包含组件面板和属性面板。
 * Ctrl+E 或关闭按钮隐藏。
 * 支持将画布组件拖入组件池区域来删除。
 */
export function EditorOverlay() {
  const { isEditorVisible, hideEditor, removeWidget } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'palette' | 'inspector'>('palette');
  const [dragOverDelete, setDragOverDelete] = useState(false);

  // ESC 关闭
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') hideEditor();
  }, [hideEditor]);

  useEffect(() => {
    if (isEditorVisible) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [isEditorVisible, handleKey]);

  // ─── 接收拖入的画布组件 → 删除 ───
  const handleDeleteDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/widget-id')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDragOverDelete(true);
    }
  }, []);

  const handleDeleteDragLeave = useCallback(() => {
    setDragOverDelete(false);
  }, []);

  const handleDeleteDrop = useCallback(
    (e: React.DragEvent) => {
      setDragOverDelete(false);
      const widgetId = e.dataTransfer.getData('application/widget-id');
      if (widgetId) {
        e.preventDefault();
        e.stopPropagation();
        removeWidget(widgetId);
      }
    },
    [removeWidget],
  );

  if (!isEditorVisible) return null;

  return (
    <div className="absolute inset-y-0 left-0 z-50 flex animate-slideIn">
      {/* 编辑器主体 */}
      <div
        className={`w-[272px] bg-surface-panel border-r border-[rgba(255,255,255,0.06)] flex flex-col shadow-2xl shadow-black/50 transition-colors duration-200 ${
          dragOverDelete ? 'ring-2 ring-negative/50 bg-negative/5' : ''
        }`}
        onDragOver={handleDeleteDragOver}
        onDragLeave={handleDeleteDragLeave}
        onDrop={handleDeleteDrop}
      >
        {/* 头部 */}
        <div className="h-9 flex items-center justify-between px-3 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-cool" />
            <span className="text-xs font-semibold text-text">编辑模式</span>
          </div>
          <button
            onClick={hideEditor}
            className="text-textSecondary/60 hover:text-textSecondary text-lg leading-none px-1"
            title="关闭编辑器 (Ctrl+E)"
          >
            ×
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-[rgba(255,255,255,0.04)] flex-shrink-0">
          <button
            onClick={() => setActiveTab('palette')}
            className={`flex-1 text-[11px] py-2 font-medium transition-colors ${
              activeTab === 'palette'
                ? 'text-accent-cool border-b border-accent-cool'
                : 'text-textSecondary/50 hover:text-textSecondary/70'
            } ${dragOverDelete ? 'text-negative' : ''}`}
          >
            {dragOverDelete ? '释放以删除' : '组件池'}
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex-1 text-[11px] py-2 font-medium transition-colors ${
              activeTab === 'inspector'
                ? 'text-accent-cool border-b border-accent-cool'
                : 'text-textSecondary/50 hover:text-textSecondary/70'
            }`}
          >
            属性
          </button>
        </div>

        {/* 内容 */}
        <div
          className="flex-1 overflow-y-auto"
          onDragOver={handleDeleteDragOver}
          onDragLeave={handleDeleteDragLeave}
          onDrop={handleDeleteDrop}
        >
          {activeTab === 'palette' ? <WidgetPalette /> : <PropertyInspector />}
        </div>

        {/* 底部操作 */}
        <div className="px-3 py-2 border-t border-[rgba(255,255,255,0.04)] flex-shrink-0">
          <ToolbarActions />
        </div>
      </div>
    </div>
  );
}

function ToolbarActions() {
  const { saveConfig, exportConfig, importConfig, config } = useEditorStore();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] text-textSecondary/40 px-1">{config.name}</div>
      <div className="flex gap-1">
        <button
          onClick={saveConfig}
          className="flex-1 text-[11px] py-1.5 rounded bg-surface-hover hover:bg-surface-hover/80 text-textSecondary hover:text-text transition-colors"
        >
          保存
        </button>
        <button
          onClick={exportConfig}
          className="flex-1 text-[11px] py-1.5 rounded bg-surface-hover hover:bg-surface-hover/80 text-textSecondary hover:text-text transition-colors"
        >
          导出
        </button>
        <button
          onClick={importConfig}
          className="flex-1 text-[11px] py-1.5 rounded bg-surface-hover hover:bg-surface-hover/80 text-textSecondary hover:text-text transition-colors"
        >
          导入
        </button>
      </div>
    </div>
  );
}
