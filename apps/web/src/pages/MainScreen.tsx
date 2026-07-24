import { useEffect, useCallback, useRef, useState, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { ScreenCanvas } from '../components/ScreenCanvas';
import { EditorOverlay } from '../components/EditorOverlay';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { apiFetch } from '../utils/api';

const CyberGlobe = lazy(() => import('../components/CyberGlobe').then(m => ({ default: m.CyberGlobe })));

/**
 * 主屏幕
 * 默认展示态（全屏数据展示），Ctrl+E 切换编辑器浮层。
 * URL 含 templateId 时进入模板模式（API 存取），否则走 localStorage。
 */
export function MainScreen() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const {
    config,
    isEditorVisible,
    showEditor,
    hideEditor,
    loadConfig,
    setCurrentTemplateId,
    backgroundPattern,
  } = useEditorStore();

  // 展示态响应式（编辑态始终桌面端）
  const { grid: bpGrid, layouts: bpLayouts, hiddenWidgets, scaleMode, canvasHeight: bpCanvasH } = useBreakpoint();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [viewportW, setViewportW] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const savedSnapshotRef = useRef('');

  // 模板模式：从 API 加载配置；普通模式：localStorage
  useEffect(() => {
    if (templateId) {
      setCurrentTemplateId(templateId);
      (async () => {
        try {
          const res = await apiFetch(`/api/templates/${templateId}`);
          if (res.ok) {
            const tpl = await res.json();
            loadConfig(JSON.stringify(tpl.config));
          }
        } catch { /* ignore */ }
        // 记录初始快照，用于后续判断是否有未保存修改
        savedSnapshotRef.current = JSON.stringify(useEditorStore.getState().config);
      })();
      return () => { setCurrentTemplateId(null); };
    } else {
      const saved = localStorage.getItem('hugescreen-config');
      if (saved) {
        try { loadConfig(saved); } catch { /* use default */ }
      }
    }
  }, [templateId, loadConfig, setCurrentTemplateId]);

  const handleBack = () => {
    const current = JSON.stringify(useEditorStore.getState().config);
    if (current !== savedSnapshotRef.current) {
      setShowUnsaved(true);
    } else {
      navigate('/templates');
    }
  };

  const handleSaveAndExit = () => {
    useEditorStore.getState().saveConfig();
    savedSnapshotRef.current = JSON.stringify(useEditorStore.getState().config);
    setShowUnsaved(false);
    navigate('/templates');
  };

  // 跟踪容器尺寸（用于背景地球-2 视口级渲染）
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setViewportW(containerRef.current.clientWidth);
        setViewportH(containerRef.current.clientHeight);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 缩放比：编辑模式需扣除左侧面板宽度；展示模式按断点策略
  const EDITOR_PANEL_WIDTH = 280;
  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      if (isEditorVisible) {
        // 编辑态：始终等比缩放
        const availW = cw - EDITOR_PANEL_WIDTH;
        setScale(Math.min(availW / config.canvas.width, ch / config.canvas.height));
      } else if (scaleMode === 'width') {
        // 展示态移动端：撑满宽度
        setScale(cw / config.canvas.width);
      } else {
        // 展示态桌面/平板：填满屏幕（cover 策略，裁切溢出部分）
        setScale(Math.max(cw / config.canvas.width, ch / config.canvas.height));
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [config.canvas, isEditorVisible, scaleMode]);

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

  // 展示态 left/画布：移动端原生分辨率，桌面/平板等比缩放
  const isMobile = !isEditorVisible && scaleMode === 'width';
  const mobileCanvasW = Math.max(320, containerRef.current?.clientWidth || window.innerWidth || 375);
  const effectiveCanvasH = isMobile
    ? Math.round((bpCanvasH ?? config.canvas.height) * mobileCanvasW / config.canvas.width)
    : config.canvas.height;

  const displayLeft = isMobile
    ? 0
    : Math.max(0, ((containerRef.current?.clientWidth ?? window.innerWidth) - config.canvas.width * scale) / 2);
  const displayTop = isMobile
    ? 0
    : Math.max(0, ((containerRef.current?.clientHeight ?? window.innerHeight) - config.canvas.height * scale) / 2);

  const canvasStyle: React.CSSProperties = isMobile ? {
    width: mobileCanvasW,
    height: effectiveCanvasH,
    position: 'relative',
  } : {
    width: config.canvas.width,
    height: config.canvas.height,
    position: 'absolute',
    top: isEditorVisible ? 0 : displayTop,
    left: isEditorVisible ? 280 : displayLeft,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    transition: 'left 300ms ease, transform 300ms ease',
  };

  // 传给 ScreenCanvas 的实际画布尺寸（移动端用视口宽度）
  const scCanvasW = isMobile ? mobileCanvasW : undefined;
  const scCanvasH = isMobile ? effectiveCanvasH : (effectiveCanvasH !== config.canvas.height ? effectiveCanvasH : undefined);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-surface-base relative"
      style={{ overflowY: isMobile ? 'auto' : 'hidden', overflowX: 'hidden' }}
    >
      {/* ═══ 背景地球-2：视口级渲染，不受画布缩放偏移影响 ═══ */}
      {backgroundPattern === 'globe-2' && viewportW > 0 && (
        <Suspense fallback={null}>
          <CyberGlobe canvasW={viewportW} canvasH={viewportH} variant="oblique" />
        </Suspense>
      )}

      {/* 展示画布 */}
      <div style={canvasStyle}>
        <ScreenCanvas
          isEditing={isEditorVisible}
          bpGrid={isEditorVisible ? undefined : bpGrid}
          bpLayouts={isEditorVisible ? undefined : bpLayouts}
          hiddenWidgets={isEditorVisible ? undefined : hiddenWidgets}
          canvasWidth={scCanvasW}
          canvasHeight={scCanvasH}
        />
      </div>

      {/* 编辑器浮层 */}
      <EditorOverlay />

      {/* 模板模式：返回按钮 */}
      {templateId && (
        <div className="absolute top-3 left-3 z-[100]">
          <button
            onClick={handleBack}
            className="text-xs text-[#9E9EA8] hover:text-[#E8E8EC] bg-[#363640]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[rgba(255,255,255,0.06)] transition-colors"
          >
            ← 返回模板
          </button>
        </div>
      )}

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

      {/* 未保存提醒 */}
      <ConfirmDialog
        open={showUnsaved}
        title="未保存的修改"
        message="当前模板有未保存的修改，是否保存后再退出？"
        confirmLabel="保存并退出"
        cancelLabel="直接退出"
        onConfirm={handleSaveAndExit}
        onCancel={() => { setShowUnsaved(false); navigate('/templates'); }}
      />
    </div>
  );
}
