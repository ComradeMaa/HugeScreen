import { useEditorStore } from '../store/editorStore';
import { WidgetPalette } from './WidgetPalette';
import { PropertyInspector } from './PropertyInspector';
import { CompositeBuilderWindow } from './CompositeBuilderWindow';
import type { CompositeConfig } from '@hugescreen/shared';
import { useState, useEffect, useCallback } from 'react';
import { Trash2, ChevronDown, Copy, Check, QrCode } from 'lucide-react';
// 自定义组合组件的注册由 store.addCustomComponent → registerCustomComponent 统一处理

/**
 * 编辑器浮层
 * 从左侧滑入，包含组件面板和属性面板。
 * Ctrl+E 或关闭按钮隐藏。
 * 支持将画布组件拖入组件池区域来删除。
 */
export function EditorOverlay() {
  const { isEditorVisible, isDraggingWidget, hideEditor, removeWidget, removeHeaderElement, setDraggingWidget, setCompositeSlotEdit, addCustomComponent } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'palette' | 'inspector'>('palette');
  const [dragOverDelete, setDragOverDelete] = useState(false);

  // ─── 组合图表构建窗口 ───
  const [showBuilder, setShowBuilder] = useState(false);

  // Clear compositeSlotEdit when editor is hidden (Escape / close button bypasses builder's handleClose)
  useEffect(() => {
    if (!isEditorVisible) setCompositeSlotEdit(null);
  }, [isEditorVisible, setCompositeSlotEdit]);

  const handleBuilderComplete = useCallback((typeName: string, displayName: string, composite: CompositeConfig) => {
    addCustomComponent({ type: typeName, displayName, composite });
    setShowBuilder(false);
  }, [addCustomComponent]);

  // 从组件池拿起组件时编辑器面板虚化 + 蓝框
  const [isPaletteDragging, setIsPaletteDragging] = useState(false);

  useEffect(() => {
    const paletteTypes = ['application/widget-type', 'application/header-element-type'];
    const onDragStart = (e: DragEvent) => {
      if (paletteTypes.some(t => e.dataTransfer?.types.includes(t))) {
        // 延迟到下一帧，避免 dragstart 期间 React 重渲染导致拖拽源 DOM 被重建而取消拖拽
        setTimeout(() => setIsPaletteDragging(true), 0);
      }
    };
    const onDragEnd = () => setIsPaletteDragging(false);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragend', onDragEnd);
    return () => {
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('dragend', onDragEnd);
    };
  }, []);

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

  // ─── 接收拖入的画布组件 / 顶栏元素 / 组合图表槽位 → 删除 ───
  const handleDeleteDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/widget-id') ||
        e.dataTransfer.types.includes('application/header-element-id') ||
        e.dataTransfer.types.includes('application/composite-slot')) {
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
      const compositeSlotIdx = e.dataTransfer.getData('application/composite-slot');
      if (compositeSlotIdx) {
        e.preventDefault();
        e.stopPropagation();
        const fn = (window as any).__hugescreen_compositeSlotDelete as (() => void) | undefined;
        if (fn) fn();
        delete (window as any).__hugescreen_compositeSlotDelete;
      } else if (widgetId) {
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
          className={`flex-1 overflow-y-auto ${(isDraggingWidget || isPaletteDragging) ? 'pointer-events-none' : ''}`}
          onDragOver={handleDeleteDragOver}
          onDragLeave={handleDeleteDragLeave}
          onDrop={handleDeleteDrop}
        >
          {activeTab === 'palette' ? <WidgetPalette onCreateComposite={() => setShowBuilder(true)} /> : <PropertyInspector />}
        </div>

        {/* 背景图案 */}
        <BackgroundPatternSelector />

        {/* 背景效果 */}
        <BackgroundEffectSelector />

        {/* 底部操作 */}
        <div className="px-3 py-2 border-t border-[rgba(255,255,255,0.04)] flex-shrink-0">
          <ToolbarActions />
        </div>

        {/* ─── 拖拽删除提示覆盖层 ─── */}
        {isDraggingWidget && (
          <div
            className={`absolute inset-0 z-20 flex items-center justify-center transition-all duration-200 ${
              dragOverDelete
                ? 'bg-negative/15 backdrop-blur-sm'
                : 'bg-negative/5 backdrop-blur-[3px]'
            }`}
            onDragOver={handleDeleteDragOver}
            onDragLeave={handleDeleteDragLeave}
            onDrop={handleDeleteDrop}
          >
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

        {/* ═══ 组件池拖拽中 — 面板虚化 + 蓝框 ═══ */}
        <div className="absolute inset-0 z-50 pointer-events-none" style={{
          backgroundColor: isPaletteDragging ? 'rgba(44,44,52,0.5)' : 'transparent',
          backdropFilter: isPaletteDragging ? 'blur(2px)' : 'none',
          boxShadow: isPaletteDragging ? 'inset 0 0 0 2px rgba(0,212,255,0.35)' : 'none',
          transition: 'all 300ms',
        }} />
      </div>

      {/* ─── 组合图表构建窗口（fixed 定位，独立层级）─── */}
      {showBuilder && (
        <CompositeBuilderWindow
          onClose={() => setShowBuilder(false)}
          onComplete={handleBuilderComplete}
        />
      )}
    </div>
  );
}

const BG_PATTERNS = [
  { value: 'none', label: '纯色' },
  { value: 'globe-1', label: '地球-1' },
  { value: 'globe-2', label: '地球-2' },
  { value: 'globe-3', label: '地球-3' },
];

function BackgroundPatternSelector() {
  const { backgroundPattern, setBackgroundPattern } = useEditorStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="px-3 py-2 border-t border-[rgba(255,255,255,0.04)] flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] font-semibold text-textSecondary/50 uppercase tracking-wider mb-1.5 hover:text-textSecondary/70 transition-colors w-full text-left"
      >
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
        背景图案
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5">
          {BG_PATTERNS.map(p => (
            <button
              key={p.value}
              onClick={() => setBackgroundPattern(p.value)}
              className={`px-2 text-[11px] py-1.5 rounded transition-colors whitespace-nowrap ${
                backgroundPattern === p.value
                  ? 'bg-accent-cool/15 text-accent-cool ring-1 ring-accent-cool/30'
                  : 'bg-surface-hover/50 text-textSecondary/60 hover:text-textSecondary hover:bg-surface-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const BG_EFFECTS = [
  { value: 'none', label: '纯色' },
  { value: 'energy-flow', label: 'PCB 流光' },
  { value: 'low-poly', label: '低多面体' },
];

function BackgroundEffectSelector() {
  const { backgroundEffect, setBackgroundEffect } = useEditorStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="px-3 py-2 border-t border-[rgba(255,255,255,0.04)] flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] font-semibold text-textSecondary/50 uppercase tracking-wider mb-1.5 hover:text-textSecondary/70 transition-colors w-full text-left"
      >
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
        背景效果
      </button>
      {open && (
        <div className="flex gap-1.5">
          {BG_EFFECTS.map(e => (
            <button
              key={e.value}
              onClick={() => setBackgroundEffect(e.value)}
              className={`flex-1 min-w-[80px] text-[11px] py-1.5 rounded transition-colors whitespace-nowrap ${
                backgroundEffect === e.value
                  ? 'bg-accent-cool/15 text-accent-cool ring-1 ring-accent-cool/30'
                  : 'bg-surface-hover/50 text-textSecondary/60 hover:text-textSecondary hover:bg-surface-hover'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolbarActions() {
  const { saveConfig, exportConfig, importConfig, config } = useEditorStore();
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'done' | 'error'>('idle');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // 构建绝对 URL
  const fullUrl = publishedUrl
    ? `${window.location.origin}${publishedUrl}`
    : null;

  // 生成二维码（动态导入，按需加载）
  useEffect(() => {
    if (fullUrl) {
      setQrDataUrl(null);
      import('qrcode').then(QRCode => {
        QRCode.toDataURL(fullUrl, {
          width: 160,
          margin: 2,
          color: { dark: '#00D4FF', light: '#2C2C34' },
        })
          .then(setQrDataUrl)
          .catch(() => setQrDataUrl(null));
      });
    }
  }, [fullUrl]);

  const handlePublish = async () => {
    setPublishStatus('publishing');
    setQrDataUrl(null);
    try {
      const token = localStorage.getItem('hugescreen-token');
      const res = await fetch('/api/view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 80)}`);
      }
      const data = await res.json();
      setPublishedUrl(data.url);
      setPublishStatus('done');
    } catch (e: unknown) {
      setPublishStatus('error');
      setPublishError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCopyUrl = async () => {
    if (fullUrl) {
      try {
        await navigator.clipboard.writeText(fullUrl);
      } catch {
        // 回退：选中文本手动复制
        const input = document.createElement('input');
        input.value = fullUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ─── 发布成功态 ───
  if (publishStatus === 'done' && publishedUrl) {
    return (
      <div className="flex flex-col gap-2">
        {/* 成功提示 */}
        <div className="flex items-center gap-1.5 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-positive" />
          <span className="text-[10px] text-positive/80 font-semibold">发布成功</span>
        </div>

        {/* URL 显示 */}
        <div className="bg-surface-base rounded p-2 flex flex-col gap-1.5">
          <div className="text-[9px] text-textSecondary/50 uppercase tracking-wider">大屏链接</div>
          <span className="text-[10px] text-accent-cool font-mono break-all select-all leading-relaxed">
            {fullUrl}
          </span>
          <button
            onClick={handleCopyUrl}
            className={`flex items-center justify-center gap-1 text-[10px] py-1.5 rounded transition-colors ${
              copied
                ? 'bg-positive/15 text-positive'
                : 'bg-surface-hover text-textSecondary hover:text-text'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>

        {/* QR 码 */}
        {qrDataUrl && (
          <div className="bg-surface-base rounded p-2 flex flex-col items-center gap-1.5">
            <div className="text-[9px] text-textSecondary/50 uppercase tracking-wider self-start">扫码查看</div>
            <img src={qrDataUrl} alt="QR Code" className="w-32 h-32 rounded" />
            <span className="text-[9px] text-textSecondary/30">手机扫描二维码打开大屏</span>
          </div>
        )}

        {/* 返回 */}
        <button
          onClick={() => { setPublishStatus('idle'); setPublishedUrl(null); setQrDataUrl(null); }}
          className="text-[10px] text-textSecondary/50 hover:text-textSecondary py-1 transition-colors"
        >
          ← 返回
        </button>
      </div>
    );
  }

  // ─── 默认态 ───
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] text-textSecondary/40 px-1">{config.name}</div>

      {/* 保存 / 导出 / 导入 */}
      <div className="flex gap-1">
        <button
          onClick={() => { saveConfig(); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          className={`flex-1 text-[11px] py-1.5 rounded transition-colors ${
            saved ? 'bg-positive/15 text-positive' : 'bg-surface-hover hover:bg-surface-hover/80 text-textSecondary hover:text-text'
          }`}
        >
          {saved ? '已保存 ✓' : '保存'}
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

      {/* 发布按钮 */}
      <button
        onClick={handlePublish}
        disabled={publishStatus === 'publishing'}
        className={`w-full text-[11px] py-1.5 rounded transition-colors ${
          publishStatus === 'publishing'
            ? 'bg-surface-hover/50 text-textSecondary/30 cursor-wait'
            : publishStatus === 'error'
              ? 'bg-negative/10 text-negative/80 hover:bg-negative/15'
              : 'bg-accent-cool/10 text-accent-cool hover:bg-accent-cool/15'
        }`}
      >
        {publishStatus === 'publishing'
          ? '发布中...'
          : publishStatus === 'error'
            ? `发布失败: ${publishError || '重试'}`
            : '发布大屏'}
      </button>

    </div>
  );
}
