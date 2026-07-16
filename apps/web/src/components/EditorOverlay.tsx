import { useEditorStore } from '../store/editorStore';
import { WidgetPalette } from './WidgetPalette';
import { PropertyInspector } from './PropertyInspector';
import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * 编辑器浮层
 * 从左侧滑入，包含组件面板和属性面板。
 * Ctrl+E 或关闭按钮隐藏。
 * 支持将画布组件拖入组件池区域来删除。
 */
export function EditorOverlay() {
  const { isEditorVisible, isDraggingWidget, hideEditor, removeWidget, removeHeaderElement, setDraggingWidget } = useEditorStore();
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

  // ─── 接收拖入的画布组件 / 顶栏元素 → 删除 ───
  const handleDeleteDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/widget-id') ||
        e.dataTransfer.types.includes('application/header-element-id')) {
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
      const headerSlotId = e.dataTransfer.getData('application/header-element-id');
      if (widgetId) {
        e.preventDefault();
        e.stopPropagation();
        removeWidget(widgetId);
        setDraggingWidget(false);
        // 清理拖拽副本残留（widget 卸载可能导致合成 dragEnd 不触发）
        document.querySelectorAll('.hugescreen-drag-clone').forEach((el) => el.remove());
      } else if (headerSlotId) {
        e.preventDefault();
        e.stopPropagation();
        removeHeaderElement(headerSlotId);
        setDraggingWidget(false);
        document.querySelectorAll('.hugescreen-drag-clone').forEach((el) => el.remove());
      }
    },
    [removeWidget, removeHeaderElement, setDraggingWidget],
  );

  if (!isEditorVisible) return null;

  return (
    <div className="absolute inset-y-0 left-0 z-50 flex animate-slideIn">
      {/* 编辑器主体 */}
      <div
        className={`relative w-[272px] bg-surface-panel border-r border-[rgba(255,255,255,0.06)] flex flex-col shadow-2xl shadow-black/50 transition-colors duration-200 ${
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
            }`}
          >
            组件池
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

        {/* ─── 拖拽删除提示覆盖层 ─── */}
        {isDraggingWidget && (
          <div className={`absolute inset-0 z-20 pointer-events-none flex items-center justify-center transition-all duration-200 ${
            dragOverDelete
              ? 'bg-negative/15 backdrop-blur-sm'
              : 'bg-negative/5 backdrop-blur-[3px]'
          }`}>
            <div className={`absolute inset-0 pointer-events-none transition-all duration-200 ${
              dragOverDelete
                ? 'ring-2 ring-negative/60'
                : 'ring-2 ring-negative/30'
            }`} />
            <div className="flex flex-col items-center gap-1.5 z-10">
              <Trash2 size={dragOverDelete ? 28 : 22} className={`transition-all duration-200 ${
                dragOverDelete ? 'text-negative' : 'text-negative/60'
              }`} strokeWidth={1.5} />
              <span className={`font-bold tracking-wide transition-all duration-200 ${
                dragOverDelete ? 'text-negative text-sm' : 'text-negative/80 text-xs'
              }`}>
                {dragOverDelete ? '释放以删除组件' : '拖拽组件到此处删除'}
              </span>
              {!dragOverDelete && (
                <span className="text-[10px] text-negative/40">Drop here to remove</span>
              )}
            </div>
          </div>
        )}
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
