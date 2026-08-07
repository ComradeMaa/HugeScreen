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
    clearWidgets,
    backgroundPattern,
    backgroundImage,
    backgroundVideo,
  } = useEditorStore();

  // 展示态响应式（编辑态始终桌面端）
  const { grid: bpGrid, layouts: bpLayouts, hiddenWidgets, scaleMode, canvasHeight: bpCanvasH } = useBreakpoint();

  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [viewportW, setViewportW] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [showClearScreen, setShowClearScreen] = useState(false);
  const lastSavedConfig = useEditorStore(s => s.lastSavedConfig);

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
        useEditorStore.getState().markConfigSaved();
        setReady(true);
      })();
      return () => { setCurrentTemplateId(null); };
    } else {
      const saved = localStorage.getItem('hugescreen-config');
      if (saved) {
        try { loadConfig(saved); } catch { /* use default */ }
      }
      setReady(true);
    }
  }, [templateId, loadConfig, setCurrentTemplateId]);

  const handleBack = async () => {
    const current = JSON.stringify(useEditorStore.getState().config);
    if (current !== lastSavedConfig) {
      setShowUnsaved(true);
    } else {
      // 无改动也保存一次——生成缩略图
      const thumb = captureThumbnail();
      await useEditorStore.getState().saveConfig(thumb);
      navigate('/templates');
    }
  };

  const captureThumbnail = useCallback((): string | undefined => {
    const cfg = useEditorStore.getState().config;
    const { width, height } = cfg.canvas;
    const { cols, rows, gap } = cfg.grid;
    const widgets = cfg.widgets || [];
    const customComps = (cfg as any).customComponents as any[] || [];
    const header = cfg.header;

    // 连续行格模型（与 ScreenCanvas 一致）：总行格 = 顶栏行 + 组件区行（固定），组件区格数恒定
    const headerVisible = header?.visible !== false;
    const headerSpan = headerVisible ? (header?.rowSpan ?? (cols >= 8 ? 1 : cols >= 2 ? 4 : 7)) : 0;
    const rowMin = headerVisible ? Math.ceil(headerSpan) : 0;
    // 组件区行数恒 = grid.rows - 1（主体可用网格固定 6 行），总行格 = 组件区 + 顶栏行
    const totalRows = headerVisible ? (rows - 1) + headerSpan : rows - headerSpan;
    const cellW = (width - gap * (cols + 1)) / cols;
    const cellH = headerVisible
      ? (height - gap * (totalRows + 2)) / totalRows
      : (height - gap * (totalRows + 1)) / totalRows;
    // 顶栏底边（连续行格）+ 组件区起点
    const headerBottomPx = gap + (headerVisible ? headerSpan * (cellH + gap) : 0);
    const widgetTop = (l: { row: number }) => headerVisible
      ? headerBottomPx + gap + Math.max(0, l.row - rowMin) * (cellH + gap)
      : gap + Math.max(0, l.row - headerSpan) * (cellH + gap);
    const tw = 400;
    const th = Math.round(tw * (height / width));
    const sc = tw / width;

    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#2C2C34';
    ctx.fillRect(0, 0, tw, th);

    // 虚线网格
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.setLineDash([2, 4]);
    for (let col = 1; col < cols; col++) {
      const x = (gap + col * (cellW + gap)) * sc;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, th); ctx.stroke();
    }
    for (let row = 1; row < rows; row++) {
      const y = (gap + row * (cellH + gap)) * sc;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(tw, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    const COLORS: Record<string, string> = { stat: '#FF8C42', chart: '#34d399', table: '#00D4FF', '3d': '#7c3aed', media: '#c084fc', decorator: '#9E9EA8' };

    // 查找自定义组件定义
    function findComposite(type: string) { return customComps.find((d: any) => d.type === type); }

    function drawWidget(area: { x: number; y: number; w: number; h: number }, type: string, cat: string, name: string) {
      const { x, y, w: rw, h: rh } = area;
      const color = COLORS[cat] || 'rgba(255,255,255,0.06)';
      const m = 2; // margin
      const pad = 4;

      // 背景 + 边框
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x + m, y + m, rw - m * 2, rh - m * 2);
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + m, y + m, rw - m * 2, rh - m * 2);
      ctx.globalAlpha = 1;

      const cx = x + rw / 2, cy = y + rh / 2;
      const innerW = rw - pad * 2, innerH = rh - pad * 4;
      const innerX = x + pad, innerY = y + pad * 3;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x + m, y + m, rw - m * 2, rh - m * 2);
      ctx.clip();

      // ── 按类型绘制简化图 ──
      switch (type) {
        case 'pie-chart': {
          const r = Math.min(innerW, innerH) * 0.35;
          ctx.beginPath(); ctx.arc(cx, cy - 2, r, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.globalAlpha = 0.15; ctx.fill();
          ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.stroke();
          // 切片
          const slices = [0, Math.PI * 0.6, Math.PI * 1.2, Math.PI * 1.7, Math.PI * 2.2];
          ctx.globalAlpha = 0.4;
          for (let i = 1; i < slices.length; i++) {
            ctx.beginPath(); ctx.moveTo(cx, cy - 2);
            ctx.arc(cx, cy - 2, r, slices[i - 1], slices[i]);
            ctx.closePath();
            ctx.fillStyle = i % 2 ? color : '#fff'; ctx.globalAlpha = i % 2 ? 0.3 : 0.1; ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx + Math.cos(slices[i]) * r, cy - 2 + Math.sin(slices[i]) * r);
            ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.5; ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'bar-chart': {
          const barCount = 4, barGap = 3, totalW = innerW - 8;
          const barW = (totalW - barGap * (barCount - 1)) / barCount;
          const maxH = innerH * 0.6;
          const vals = [0.7, 0.45, 0.9, 0.55];
          ctx.fillStyle = color; ctx.globalAlpha = 0.5;
          for (let i = 0; i < barCount; i++) {
            const bh = maxH * vals[i];
            ctx.fillRect(innerX + i * (barW + barGap), innerY + maxH - bh, barW, bh);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'funnel-chart': {
          // 漏斗图：梯形层叠（上宽下窄），逐层变浅
          const fLayers = 5;
          const fLayerH = innerH / fLayers;
          for (let i = 0; i < fLayers; i++) {
            const fY = innerY + i * fLayerH;
            const halfW = (innerW / 2) * (1 - i / fLayers) * 0.9 + innerW * 0.02;
            const halfWNext = (innerW / 2) * (1 - (i + 1) / fLayers) * 0.9 + innerW * 0.02;
            ctx.fillStyle = color; ctx.globalAlpha = 0.85 - i * 0.15;
            ctx.beginPath();
            ctx.moveTo(innerX + innerW / 2 - halfW, fY);
            ctx.lineTo(innerX + innerW / 2 + halfW, fY);
            ctx.lineTo(innerX + innerW / 2 + halfWNext, fY + fLayerH);
            ctx.lineTo(innerX + innerW / 2 - halfWNext, fY + fLayerH);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(44,44,52,1)'; ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'marquee-table': {
          // 环形滚动表格：表头行 + 交替数据行 + 向上滚动指示
          const mtRowH = innerH / 4;
          ctx.fillStyle = color; ctx.globalAlpha = 0.2;
          ctx.fillRect(innerX + innerW * 0.06, innerY, innerW * 0.88, mtRowH);
          ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8;
          ctx.strokeRect(innerX + innerW * 0.06, innerY, innerW * 0.88, mtRowH);
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)';
            ctx.globalAlpha = 1;
            ctx.fillRect(innerX + innerW * 0.06, innerY + mtRowH * (i + 1), innerW * 0.88, mtRowH);
          }
          ctx.strokeStyle = color; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(innerX + innerW * 0.88, innerY + innerH - innerH * 0.1);
          ctx.lineTo(innerX + innerW * 0.92, innerY + innerH - innerH * 0.16);
          ctx.lineTo(innerX + innerW * 0.96, innerY + innerH - innerH * 0.1);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'line-chart':
        case 'bar-line-chart': {
          const pts = [{x: 0.1, y: 0.6}, {x: 0.3, y: 0.3}, {x: 0.5, y: 0.7}, {x: 0.7, y: 0.2}, {x: 0.9, y: 0.5}];
          ctx.beginPath();
          pts.forEach((p, i) => {
            const px = innerX + innerW * p.x, py = innerY + innerH * p.y;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
          ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.2; ctx.stroke();
          pts.forEach(p => { ctx.beginPath(); ctx.arc(innerX + innerW * p.x, innerY + innerH * p.y, 1.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
          ctx.globalAlpha = 1;
          break;
        }
        case 'stat-card': {
          ctx.fillStyle = color; ctx.globalAlpha = 0.7;
          ctx.font = `bold ${Math.round(Math.min(innerH * 0.5, innerW * 0.15))}px JetBrains Mono,monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('1,234', cx, cy - 2);
          ctx.globalAlpha = 0.4;
          ctx.font = `${Math.round(Math.min(innerH * 0.18, innerW * 0.08))}px Inter,sans-serif`;
          ctx.fillText(name || '指标', cx, cy + innerH * 0.25);
          ctx.globalAlpha = 1;
          break;
        }
        case 'text-widget': {
          const lineH = Math.max(2, innerH * 0.12);
          ctx.fillStyle = color; ctx.globalAlpha = 0.3;
          for (let i = 0; i < 5; i++) {
            const lw = innerW * (0.5 + Math.random() * 0.5);
            ctx.fillRect(innerX, innerY + i * lineH * 2, lw, lineH);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'image-widget': {
          // 简化山峰+太阳图标
          ctx.fillStyle = color; ctx.globalAlpha = 0.3;
          ctx.beginPath(); ctx.arc(cx + rw * 0.18, cy - rh * 0.1, rw * 0.1, 0, Math.PI * 2); ctx.fill(); // sun
          ctx.beginPath(); ctx.moveTo(cx - rw * 0.25, cy + rh * 0.25);
          ctx.lineTo(cx - rw * 0.05, cy - rh * 0.15); ctx.lineTo(cx + rw * 0.1, cy + rh * 0.25);
          ctx.lineTo(cx + rw * 0.2, cy - rh * 0.05); ctx.lineTo(cx + rw * 0.3, cy + rh * 0.25);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'video-widget': {
          // 2×2 网格 + 播放按钮
          const hw = innerW / 2, hh = innerH / 2;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.2; ctx.lineWidth = 0.5;
          ctx.strokeRect(innerX, innerY, hw, hh);
          ctx.strokeRect(innerX + hw, innerY, hw, hh);
          ctx.strokeRect(innerX, innerY + hh, hw, hh);
          ctx.strokeRect(innerX + hw, innerY + hh, hw, hh);
          // 四个播放三角
          const drawPlay = (qx: number, qy: number, s: number) => {
            ctx.fillStyle = color; ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(qx - s, qy - s * 1.4);
            ctx.lineTo(qx - s, qy + s * 1.4);
            ctx.lineTo(qx + s * 1.2, qy);
            ctx.closePath(); ctx.fill();
          };
          drawPlay(innerX + hw / 2, innerY + hh / 2, Math.min(hw, hh) * 0.2);
          drawPlay(innerX + hw + hw / 2, innerY + hh / 2, Math.min(hw, hh) * 0.2);
          drawPlay(innerX + hw / 2, innerY + hh + hh / 2, Math.min(hw, hh) * 0.2);
          drawPlay(innerX + hw + hw / 2, innerY + hh + hh / 2, Math.min(hw, hh) * 0.2);
          ctx.globalAlpha = 1;
          break;
        }
        case 'box-plot': {
          // 箱线图：须线 + 箱体 + 白色中位数线
          const drawBox = (bx: number, min: number, q1: number, med: number, q3: number, max: number) => {
            const s = (v: number) => innerY + innerH * 0.85 - (v / 60) * innerH * 0.7;
            ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(bx, s(max)); ctx.lineTo(bx, s(min)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 2, s(min)); ctx.lineTo(bx + 2, s(min)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 2, s(max)); ctx.lineTo(bx + 2, s(max)); ctx.stroke();
            ctx.fillStyle = color; ctx.globalAlpha = 0.2;
            ctx.fillRect(bx - 3, s(q3), 6, s(q1) - s(q3));
            ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.8;
            ctx.strokeRect(bx - 3, s(q3), 6, s(q1) - s(q3));
            ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bx - 3, s(med)); ctx.lineTo(bx + 3, s(med)); ctx.stroke();
          };
          const bw = innerW / 6;
          drawBox(innerX + bw, 10, 20, 30, 45, 55);
          drawBox(innerX + bw * 3, 15, 25, 35, 48, 60);
          drawBox(innerX + bw * 5, 5, 18, 28, 40, 50);
          ctx.globalAlpha = 1;
          break;
        }
        case 'histogram': {
          // 直方图：钟形分布密集柱
          const barCount = 9, barW = innerW / barCount;
          const baseY = innerY + innerH * 0.85;
          const maxH = innerH * 0.55;
          const heights = [0.2, 0.4, 0.65, 0.85, 1, 0.85, 0.65, 0.4, 0.2];
          ctx.fillStyle = color; ctx.globalAlpha = 0.55;
          for (let i = 0; i < barCount; i++) {
            const bh = maxH * heights[i];
            ctx.fillRect(innerX + i * barW + 1, baseY - bh, barW - 2, bh);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'confidence-band': {
          // 置信区间带：主线 + 上下界淡色带
          const mkPts = (vals: number[]) => vals.map((v, i) => [innerX + i * (innerW / 4), innerY + innerH * 0.85 - v * innerH * 0.6]);
          const cbUp = mkPts([0.7, 0.55, 0.75, 0.6, 0.8]);
          const cbLow = mkPts([0.3, 0.2, 0.35, 0.25, 0.4]);
          const cbMain = mkPts([0.5, 0.4, 0.55, 0.45, 0.6]);
          ctx.fillStyle = color; ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.moveTo(cbUp[0][0], cbUp[0][1]);
          cbUp.forEach(([x, y]) => ctx.lineTo(x, y));
          cbLow.slice().reverse().forEach(([x, y]) => ctx.lineTo(x, y));
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]);
          for (const pts2 of [cbUp, cbLow]) {
            ctx.beginPath(); pts2.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5;
          ctx.beginPath(); cbMain.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'step-line': {
          // 阶梯线图：水平 + 垂直交替的阶梯折线
          const stPts = [
            [0.06, 0.75], [0.28, 0.75], [0.28, 0.42], [0.5, 0.42], [0.5, 0.85],
            [0.72, 0.85], [0.72, 0.55], [0.94, 0.55],
          ].map(([fx, fy]) => [innerX + fx * innerW, innerY + fy * innerH]);
          ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5;
          ctx.beginPath(); stPts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
          ctx.fillStyle = color; ctx.globalAlpha = 0.9;
          stPts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); });
          ctx.globalAlpha = 1;
          break;
        }
        case 'dynamic-time': {
          // 动态时间轴：波形 + 滚动方向箭头
          const dtVals = [0.45, 0.65, 0.5, 0.75, 0.55, 0.85, 0.6, 0.7, 0.5, 0.65, 0.45];
          const dtPts = dtVals.map((v, i) => [innerX + i * (innerW / (dtVals.length - 1)), innerY + innerH * 0.85 - v * innerH * 0.6]);
          ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5;
          ctx.beginPath(); dtPts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
          const dtTail = dtPts[dtPts.length - 1];
          ctx.fillStyle = color; ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(dtTail[0] + 4, dtTail[1]);
          ctx.lineTo(dtTail[0] - 2, dtTail[1] - 3.5);
          ctx.lineTo(dtTail[0] - 2, dtTail[1] + 3.5);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'large-area-chart': {
          // 大规模面积图：密集波形 + 渐变面积
          const laVals = [0.5, 0.7, 0.45, 0.8, 0.55, 0.9, 0.6, 0.75, 0.4, 0.65, 0.5];
          const laPts = laVals.map((v, i) => [innerX + i * (innerW / (laVals.length - 1)), innerY + innerH * 0.85 - v * innerH * 0.6]);
          ctx.fillStyle = color; ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.moveTo(laPts[0][0], laPts[0][1]);
          laPts.forEach(([x, y]) => ctx.lineTo(x, y));
          ctx.lineTo(laPts[laPts.length - 1][0], innerY + innerH * 0.85);
          ctx.lineTo(laPts[0][0], innerY + innerH * 0.85);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5;
          ctx.beginPath(); laPts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'scatter-plot': {
          // 散点图：分布散点
          const scPts = [[0.1, 0.3], [0.25, 0.55], [0.4, 0.2], [0.55, 0.7], [0.7, 0.35], [0.85, 0.6], [0.35, 0.75], [0.65, 0.8]];
          ctx.fillStyle = color; ctx.globalAlpha = 0.85;
          scPts.forEach(([fx, fy]) => {
            ctx.beginPath(); ctx.arc(innerX + fx * innerW, innerY + fy * innerH, 2.5, 0, Math.PI * 2); ctx.fill();
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'intraday-chart': {
          // 盘中走势图：两段走势线，中部断开（午休间隔）
          const idSeg = (pts: number[][]) => {
            ctx.beginPath();
            pts.forEach(([fx, fy], i) => {
              const x = innerX + fx * innerW, y = innerY + fy * innerH;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
          };
          ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5;
          idSeg([[0.05, 0.55], [0.3, 0.4], [0.45, 0.5], [0.55, 0.3]]);
          idSeg([[0.68, 0.45], [0.85, 0.35], [0.95, 0.55]]);
          ctx.globalAlpha = 1;
          break;
        }
        case 'radar-chart': {
          // 雷达图：五边形网格 + 数据多边形
          const rdN = 5;
          const rdPt = (i: number, r: number) => [
            cx + r * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / rdN),
            cy + r * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / rdN),
          ];
          const rdR = Math.min(innerW, innerH) * 0.32;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.25; ctx.lineWidth = 0.7;
          for (let ring = 1; ring <= 3; ring++) {
            ctx.beginPath();
            for (let i = 0; i <= rdN; i++) {
              const [x, y] = rdPt(i % rdN, (rdR * ring) / 3);
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          for (let i = 0; i < rdN; i++) {
            const [x, y] = rdPt(i, rdR);
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
          }
          const rdVals = [0.9, 0.65, 0.8, 0.5, 0.7];
          ctx.fillStyle = color; ctx.globalAlpha = 0.2;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.2;
          ctx.beginPath();
          rdVals.forEach((v, i) => {
            const [x, y] = rdPt(i, rdR * v);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'heatmap': {
          // 热力图：渐变色格子矩阵
          const hmCols = ['rgba(26,26,36,1)', 'rgba(10,61,92,0.9)', 'rgba(0,168,204,0.8)', 'rgba(0,212,255,0.9)', 'rgba(255,140,66,0.95)'];
          const hmRows = 5, hmColCount = 9;
          for (let r = 0; r < hmRows; r++) {
            for (let c = 0; c < hmColCount; c++) {
              const heat = Math.exp(-((r - 2) ** 2 + (c - 4) ** 2) / 6);
              ctx.fillStyle = hmCols[Math.min(hmCols.length - 1, Math.floor(heat * hmCols.length))];
              ctx.fillRect(innerX + c * (innerW / hmColCount), innerY + r * (innerH / hmRows), innerW / hmColCount + 0.5, innerH / hmRows + 0.5);
            }
          }
          break;
        }
        case 'relation-chart': {
          // 关系图：中心节点 + 放射连线 + 周围节点
          const rlC = [cx, cy];
          const rlPts = [[0.1, 0.2], [0.9, 0.15], [0.08, 0.6], [0.93, 0.62], [0.5, 0.72]];
          ctx.strokeStyle = color; ctx.globalAlpha = 0.4; ctx.lineWidth = 0.8;
          rlPts.forEach(([fx, fy]) => {
            ctx.beginPath(); ctx.moveTo(rlC[0], rlC[1]); ctx.lineTo(innerX + fx * innerW, innerY + fy * innerH); ctx.stroke();
          });
          ctx.fillStyle = color; ctx.globalAlpha = 0.95;
          ctx.beginPath(); ctx.arc(rlC[0], rlC[1], 4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.8;
          rlPts.forEach(([fx, fy]) => {
            ctx.beginPath(); ctx.arc(innerX + fx * innerW, innerY + fy * innerH, 2.5, 0, Math.PI * 2); ctx.fill();
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'tree-chart': {
          // 树形图：根节点 + 分级分支线
          const tX = innerX, tW = innerW, tY = innerY, tH = innerH;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(tX + tW / 2, tY + tH * 0.12); ctx.lineTo(tX + tW / 2, tY + tH * 0.22); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tX + tW * 0.15, tY + tH * 0.25); ctx.lineTo(tX + tW * 0.85, tY + tH * 0.25); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tX + tW * 0.15, tY + tH * 0.25); ctx.lineTo(tX + tW * 0.15, tY + tH * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tX + tW * 0.08, tY + tH * 0.4); ctx.lineTo(tX + tW * 0.22, tY + tH * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tX + tW / 2, tY + tH * 0.25); ctx.lineTo(tX + tW / 2, tY + tH * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tX + tW * 0.43, tY + tH * 0.4); ctx.lineTo(tX + tW * 0.57, tY + tH * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tX + tW * 0.85, tY + tH * 0.25); ctx.lineTo(tX + tW * 0.85, tY + tH * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tX + tW * 0.78, tY + tH * 0.4); ctx.lineTo(tX + tW * 0.92, tY + tH * 0.4); ctx.stroke();
          ctx.fillStyle = color; ctx.globalAlpha = 0.95;
          [[tW / 2, 0.12], [0.15, 0.25], [0.5, 0.25], [0.85, 0.25], [0.15, 0.4], [0.5, 0.4], [0.85, 0.4]]
            .forEach(([fx, fy]) => { ctx.beginPath(); ctx.arc(tX + fx * tW, tY + fy * tH, 2.5, 0, Math.PI * 2); ctx.fill(); });
          ctx.globalAlpha = 1;
          break;
        }
        case 'treemap-chart': {
          // 矩形树图：嵌套矩形分布
          const tmFill = [0.9, 0.65, 0.35, 0.55];
          const tmRects = [
            [0.08, 0.1, 0.28, 0.8],
            [0.38, 0.1, 0.54, 0.36],
            [0.38, 0.48, 0.23, 0.42],
            [0.63, 0.48, 0.29, 0.42],
          ];
          tmRects.forEach(([fx, fy, fw, fh], i) => {
            const x = innerX + fx * innerW, y = innerY + fy * innerH, w = fw * innerW, h = fh * innerH;
            ctx.fillStyle = color; ctx.globalAlpha = tmFill[i];
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(44,44,52,1)'; ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, w, h);
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'sunburst-chart': {
          // 旭日图：同心环扇区（中心盘 + 三环，逐层变浅）
          const sCx = innerX + innerW / 2, sCy = innerY + innerH / 2;
          const sR = Math.min(innerW, innerH) * 0.42;
          const sRings = [
            { r0: 0, r1: 0.3, alpha: 0.9, sectors: [[0, 1.8], [1.8, 3.6], [3.6, 5.2], [5.2, 6.28]] },
            { r0: 0.3, r1: 0.62, alpha: 0.55, sectors: [[0, 2.1], [2.1, 4.3], [4.3, 6.28]] },
            { r0: 0.62, r1: 1, alpha: 0.3, sectors: [[0, 1.4], [1.4, 3.0], [3.0, 4.6], [4.6, 6.28]] },
          ];
          sRings.forEach((ring) => {
            ring.sectors.forEach(([a0, a1]) => {
              ctx.beginPath();
              ctx.arc(sCx, sCy, ring.r1 * sR, a0, a1);
              ctx.arc(sCx, sCy, ring.r0 * sR, a1, a0, true);
              ctx.closePath();
              ctx.fillStyle = color; ctx.globalAlpha = ring.alpha;
              ctx.fill();
              ctx.strokeStyle = 'rgba(44,44,52,1)'; ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
              ctx.stroke();
            });
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'multiple-x-axis-chart': {
          // 多 X 轴：上下双轴 + 两条折线十字交叉
          const mTop = innerY + innerH * 0.08, mBottom = innerY + innerH * 0.92;
          const mLeft = innerX + innerW * 0.06, mRight = innerX + innerW * 0.94;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.globalAlpha = 1; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(mLeft, mTop); ctx.lineTo(mRight, mTop); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(mLeft, mBottom); ctx.lineTo(mRight, mBottom); ctx.stroke();
          ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.moveTo(mLeft, mBottom - innerH * 0.08);
          ctx.lineTo(innerX + innerW * 0.35, innerY + innerH * 0.6);
          ctx.lineTo(innerX + innerW * 0.6, innerY + innerH * 0.38);
          ctx.lineTo(mRight, innerY + innerH * 0.16);
          ctx.stroke();
          ctx.strokeStyle = '#FF8C42'; ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(mRight, mTop + innerH * 0.08);
          ctx.lineTo(innerX + innerW * 0.65, innerY + innerH * 0.42);
          ctx.lineTo(innerX + innerW * 0.4, innerY + innerH * 0.62);
          ctx.lineTo(mLeft, innerY + innerH * 0.82);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'sankey-chart': {
          // 桑基图：左1中2右3节点 + 渐变流量连线
          const sNodeW = innerW * 0.07, sNodeH = innerH * 0.2;
          const sCols = [
            { x: innerX + innerW * 0.08, ys: [innerY + innerH * 0.4] },
            { x: innerX + innerW * 0.38, ys: [innerY + innerH * 0.24, innerY + innerH * 0.56] },
            { x: innerX + innerW * 0.72, ys: [innerY + innerH * 0.12, innerY + innerH * 0.4, innerY + innerH * 0.68] },
          ];
          ctx.lineWidth = 2;
          const sLinks: Array<[number, number, number]> = [[0, 0, 0], [0, 0, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]];
          sLinks.forEach(([c, f, t]) => {
            const x0 = sCols[c].x + sNodeW, y0 = sCols[c].ys[f] + sNodeH / 2;
            const x1 = sCols[c + 1].x, y1 = sCols[c + 1].ys[t] + sNodeH / 2;
            ctx.strokeStyle = color; ctx.globalAlpha = 0.25 + c * 0.1;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.bezierCurveTo(x0 + innerW * 0.14, y0, x1 - innerW * 0.14, y1, x1, y1);
            ctx.stroke();
          });
          sCols.forEach((col) => {
            col.ys.forEach((y) => {
              ctx.fillStyle = color; ctx.globalAlpha = 0.85;
              ctx.fillRect(col.x, y, sNodeW, sNodeH);
              ctx.strokeStyle = 'rgba(44,44,52,1)'; ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
              ctx.strokeRect(col.x, y, sNodeW, sNodeH);
            });
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'voronoi': {
          // Voronoi：区域分割线 + 散点
          const vCells = [
            [[0.08, 0.1], [0.5, 0.28], [0.22, 0.72]],
            [[0.5, 0.28], [0.92, 0.08], [0.78, 0.75], [0.5, 0.28]],
            [[0.22, 0.72], [0.5, 0.28], [0.78, 0.75], [0.92, 0.08], [0.92, 0.88], [0.78, 0.75]],
          ];
          ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.8;
          vCells.forEach((cell) => {
            ctx.beginPath();
            cell.forEach(([vx, vy], i) => {
              const px = innerX + vx * innerW, py = innerY + vy * innerH;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
            ctx.closePath(); ctx.stroke();
          });
          const vPts = [[0.08, 0.1], [0.5, 0.28], [0.22, 0.72], [0.92, 0.08], [0.78, 0.75]];
          ctx.fillStyle = color; ctx.globalAlpha = 0.9;
          vPts.forEach(([vx, vy]) => {
            ctx.beginPath(); ctx.arc(innerX + vx * innerW, innerY + vy * innerH, 2.5, 0, Math.PI * 2); ctx.fill();
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'group-chart': {
          // 分组柱状图：主色 + 白色两组并列柱
          const barCount = 4, groupW = innerW / barCount, gap = 2;
          const barW = Math.max(2, groupW * 0.3);
          const baseY = innerY + innerH * 0.85;
          const maxH = innerH * 0.6;
          const v1 = [0.7, 0.45, 0.9, 0.55];
          const v2 = [0.5, 0.8, 0.6, 0.75];
          for (let i = 0; i < barCount; i++) {
            const gx = innerX + i * groupW + groupW * 0.15;
            ctx.fillStyle = color; ctx.globalAlpha = 0.55;
            ctx.fillRect(gx, baseY - v1[i] * maxH, barW, v1[i] * maxH);
            ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.35;
            ctx.fillRect(gx + barW + gap, baseY - v2[i] * maxH, barW, v2[i] * maxH);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'water-pond': {
          // 水位球：圆形 + 波浪 + 百分比
          const r = Math.min(innerW, innerH) * 0.35;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = color; ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.moveTo(cx - r, cy + r * 0.3);
          for (let x = -r; x <= r; x += 2) {
            ctx.lineTo(cx + x, cy + r * 0.2 + Math.sin((x / r) * Math.PI * 2) * r * 0.12);
          }
          ctx.lineTo(cx + r, cy + r); ctx.lineTo(cx - r, cy + r);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9;
          ctx.font = `bold ${Math.round(Math.min(innerW, innerH) * 0.18)}px JetBrains Mono,monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('60%', cx, cy + r * 0.35);
          ctx.globalAlpha = 1;
          break;
        }
        case 'gauge-chart': {
          // 仪表盘：半圆弧轨道 + 进度弧 + 指针
          const gR = Math.min(innerW, innerH) * 0.35;
          const gStart = Math.PI * 0.75, gEnd = Math.PI * 2.25;
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = Math.max(3, Math.min(innerW, innerH) * 0.07);
          ctx.beginPath(); ctx.arc(cx, cy + innerH * 0.05, gR, gStart, gEnd); ctx.stroke();
          const gProg = gStart + (gEnd - gStart) * 0.65;
          ctx.strokeStyle = color;
          ctx.beginPath(); ctx.arc(cx, cy + innerH * 0.05, gR, gStart, gProg); ctx.stroke();
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy + innerH * 0.05);
          ctx.lineTo(cx + Math.cos(gProg) * (gR - 4), cy + innerH * 0.05 + Math.sin(gProg) * (gR - 4));
          ctx.stroke();
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(cx, cy + innerH * 0.05, 3, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'candlestick': {
          // 蜡烛图：阳线绿实心、阴线红空心
          const drawCandle = (bx: number, open: number, close: number, high: number, low: number) => {
            const s = (v: number) => innerY + innerH * 0.85 - (v / 60) * innerH * 0.7;
            const up = close >= open;
            ctx.strokeStyle = up ? 'rgba(52,211,153,0.8)' : 'rgba(248,113,113,0.8)';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(bx, s(high)); ctx.lineTo(bx, s(low)); ctx.stroke();
            ctx.fillStyle = up ? 'rgba(52,211,153,0.8)' : 'rgba(248,113,113,0.15)';
            ctx.strokeStyle = up ? 'rgba(52,211,153,0.8)' : 'rgba(248,113,113,0.8)';
            ctx.lineWidth = 1;
            ctx.fillRect(bx - 1.5, s(Math.max(open, close)), 3, Math.max(1, s(Math.min(open, close)) - s(Math.max(open, close))));
            ctx.strokeRect(bx - 1.5, s(Math.max(open, close)), 3, Math.max(1, s(Math.min(open, close)) - s(Math.max(open, close))));
          };
          const bw = innerW / 6;
          drawCandle(innerX + bw, 30, 38, 42, 26);
          drawCandle(innerX + bw * 3, 38, 34, 40, 30);
          drawCandle(innerX + bw * 5, 34, 46, 48, 32);
          ctx.globalAlpha = 1;
          break;
        }
        case 'data-table': {
          const cellRows = 3, cellCols = 3;
          const cw = innerW / cellCols, ch2 = innerH / cellRows;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.25; ctx.lineWidth = 0.5;
          for (let ri = 0; ri <= cellRows; ri++) { ctx.beginPath(); ctx.moveTo(innerX, innerY + ri * ch2); ctx.lineTo(innerX + innerW, innerY + ri * ch2); ctx.stroke(); }
          for (let ci = 0; ci <= cellCols; ci++) { ctx.beginPath(); ctx.moveTo(innerX + ci * cw, innerY); ctx.lineTo(innerX + ci * cw, innerY + innerH); ctx.stroke(); }
          ctx.globalAlpha = 1;
          break;
        }
        case 'rank-list': {
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = color; ctx.globalAlpha = 0.3;
            ctx.font = `${Math.round(innerH * 0.16)}px Inter,sans-serif`; ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}.`, innerX, innerY + i * innerH * 0.22 + innerH * 0.16);
            ctx.fillRect(innerX + innerW * 0.15, innerY + i * innerH * 0.22 + innerH * 0.06, innerW * 0.7, innerH * 0.08);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'cyber-globe':
        case 'cyber-sphere':
        case 'cyber-map':
        case 'particle-field': {
          // 简化建筑群/地球
          ctx.fillStyle = color; ctx.globalAlpha = 0.15;
          ctx.beginPath(); ctx.arc(cx, cy, Math.min(rw, rh) * 0.35, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.stroke();
          ctx.beginPath(); ctx.arc(cx - rw * 0.08, cy - rh * 0.05, Math.min(rw, rh) * 0.12, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'attack-globe': {
          // 网络攻击地球：球体轮廓 + 经线 + 攻击弧线 + 源/目标点
          const agR = Math.min(rw, rh) * 0.35;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(cx, cy, agR, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 0.25; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.ellipse(cx, cy, agR * 0.45, agR, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 0.75; ctx.strokeStyle = '#FF8C42'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(cx + agR * 0.7, cy - agR * 0.55);
          ctx.quadraticCurveTo(cx, cy - agR * 1.3, cx - agR * 0.8, cy + agR * 0.25); ctx.stroke();
          ctx.fillStyle = '#FF8C42';
          ctx.beginPath(); ctx.arc(cx + agR * 0.7, cy - agR * 0.55, 2.8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(cx - agR * 0.8, cy + agR * 0.25, 2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'attack-map': {
          // 网络攻击平面地图：矩形轮廓 + 经纬网格 + 攻击弧线 + 源/目标点
          const mw = innerW - 4, mh = innerH - 4, mx = innerX + 2, my = innerY + 2;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
          ctx.strokeRect(mx, my, mw, mh);
          ctx.globalAlpha = 0.25; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(mx, my + mh / 3); ctx.lineTo(mx + mw, my + mh / 3); ctx.stroke();
          ctx.moveTo(mx, my + (mh * 2) / 3); ctx.lineTo(mx + mw, my + (mh * 2) / 3); ctx.stroke();
          ctx.moveTo(mx + mw / 3, my); ctx.lineTo(mx + mw / 3, my + mh); ctx.stroke();
          ctx.moveTo(mx + (mw * 2) / 3, my); ctx.lineTo(mx + (mw * 2) / 3, my + mh); ctx.stroke();
          ctx.globalAlpha = 0.75; ctx.strokeStyle = '#FF8C42'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(mx + mw * 0.85, my + mh * 0.2);
          ctx.quadraticCurveTo(mx + mw * 0.5, my - mh * 0.25, mx + mw * 0.15, my + mh * 0.75); ctx.stroke();
          ctx.fillStyle = '#FF8C42';
          ctx.beginPath(); ctx.arc(mx + mw * 0.85, my + mh * 0.2, 2.8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(mx + mw * 0.15, my + mh * 0.75, 2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'bus-map': {
          // 公交实时地图：暗色底图 + 线路折线 + 站点 + 行驶亮点
          ctx.fillStyle = 'rgba(20,24,32,0.85)';
          ctx.fillRect(innerX, innerY, innerW, innerH);
          const routes: Array<{ pts: [number, number][]; c: string }> = [
            { pts: [[innerX + 6, innerY + innerH * 0.6], [innerX + innerW * 0.3, innerY + innerH * 0.35], [innerX + innerW * 0.55, innerY + innerH * 0.45], [innerX + innerW * 0.8, innerY + innerH * 0.3]], c: '#00D4FF' },
            { pts: [[innerX + 6, innerY + innerH * 0.75], [innerX + innerW * 0.4, innerY + innerH * 0.8], [innerX + innerW * 0.7, innerY + innerH * 0.65]], c: '#FF8C42' },
          ];
          for (const r of routes) {
            ctx.strokeStyle = r.c; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(r.pts[0][0], r.pts[0][1]);
            for (let i = 1; i < r.pts.length; i++) ctx.lineTo(r.pts[i][0], r.pts[i][1]);
            ctx.stroke();
            ctx.globalAlpha = 1;
            for (const [x, y] of r.pts) {
              ctx.fillStyle = '#9E9EA8';
              ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
            }
          }
          ctx.fillStyle = '#FFD34D';
          ctx.shadowColor = '#FFD34D'; ctx.shadowBlur = 5;
          ctx.beginPath(); ctx.arc(innerX + innerW * 0.55, innerY + innerH * 0.45, 2.8, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }
        case 'border-frame':
        case 'screen-header':
        case 'header-title':
        case 'header-datetime': {
          // 边框/装饰条
          ctx.strokeStyle = color; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
          ctx.strokeRect(innerX, innerY, innerW, innerH);
          ctx.fillStyle = color; ctx.globalAlpha = 0.2;
          ctx.fillRect(innerX, innerY, innerW, innerH * 0.15);
          ctx.globalAlpha = 1;
          break;
        }
        default: {
          // 自定义组合组件 → 在内部绘制子组件
          const comp = findComposite(type);
          if (comp && comp.composite) {
            const { layoutTemplate, slots: subSlots } = comp.composite;
            const subWidgets = (subSlots || []).map((s: any, i: number) => ({
              type: s.chartType, cat: s.chartType?.startsWith('stat') ? 'stat' : 'chart', name: s.chartType || `slot${i}`,
            }));
            drawCompositeArea({ x: innerX, y: innerY, w: innerW, h: innerH }, layoutTemplate, subWidgets);
          }
          break;
        }
      }

      ctx.restore();
    }

    function drawCompositeArea(area: { x: number; y: number; w: number; h: number }, template: string, subWidgets: any[]) {
      // 使用与 CompositeChartWidget 相同的网格模板
      const TEMPLATE_AREAS: Record<string, string> = {
        '2col': '"a a b b" "a a b b" "a a b b" "a a b b"',
        '2row': '"a a a a" "a a a a" "b b b b" "b b b b"',
        '3col': '"a a b b c c" "a a b b c c" "a a b b c c" "a a b b c c"',
        '2x2': '"a a b b" "a a b b" "c c d d" "c c d d"',
        '1top2bottom': '"a a a a" "a a a a" "b b c c" "b b c c"',
        '1left2right': '"a a b b" "a a b b" "a a c c" "a a c c"',
        'topNarrow': '"a a a a" "b b b b" "b b b b" "b b b b" "b b b b" "b b b b" "b b b b" "b b b b"',
        // 两列 1/3 变体：6 列，a 2 列 + b 4 列（左 1/3）/ a 4 列 + b 2 列（右 1/3）
        '2colLeftThird': '"a a b b b b" "a a b b b b" "a a b b b b" "a a b b b b"',
        '2colRightThird': '"a a a a b b" "a a a a b b" "a a a a b b" "a a a a b b"',
        // 两行 1/3 变体：6 行，a 2 行 + b 4 行（上 1/3）/ a 4 行 + b 2 行（下 1/3）
        '2rowTopThird': '"a a a a" "a a a a" "b b b b" "b b b b" "b b b b" "b b b b"',
        '2rowBottomThird': '"a a a a" "a a a a" "a a a a" "a a a a" "b b b b" "b b b b"',
      };
      const tpl = template || '2col';
      const areaStr = TEMPLATE_AREAS[tpl] || TEMPLATE_AREAS['2col'];
      // Parse grid areas
      const lines = areaStr.split('" "').map((s: string) => s.replace(/"/g, ''));
      const areas = lines.map((l: string) => l.split(' '));
      const gridRows = areas.length;
      const gridCols = areas[0]?.length || 4;
      const cw = area.w / gridCols, ch = area.h / gridRows;

      // Find bounding box for each slot letter
      const slotAreas: Record<string, { x1: number; y1: number; x2: number; y2: number; }> = {};
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const letter = areas[row]?.[col];
          if (!letter || letter === '.') continue;
          if (!slotAreas[letter]) slotAreas[letter] = { x1: col, y1: row, x2: col + 1, y2: row + 1 };
          else {
            slotAreas[letter].x2 = Math.max(slotAreas[letter].x2, col + 1);
            slotAreas[letter].y2 = Math.max(slotAreas[letter].y2, row + 1);
          }
        }
      }

      const letters = Object.keys(slotAreas).sort();
      subWidgets.slice(0, letters.length).forEach((sw: any, i: number) => {
        const sa = slotAreas[letters[i]];
        if (!sa) return;
        const sx = area.x + sa.x1 * cw + 1;
        const sy = area.y + sa.y1 * ch + 1;
        const sw2 = (sa.x2 - sa.x1) * cw - 2;
        const sh2 = (sa.y2 - sa.y1) * ch - 2;
        drawWidget({ x: sx, y: sy, w: sw2, h: sh2 }, sw.type, sw.cat, sw.name);
      });
    }

    for (const w of widgets) {
      const l = w.layout;
      const x = (gap + l.col * (cellW + gap)) * sc;
      const y = widgetTop(l) * sc;
      const rw = (l.colSpan * cellW + (l.colSpan - 1) * gap) * sc;
      const rh = (l.rowSpan * cellH + (l.rowSpan - 1) * gap) * sc;
      drawWidget({ x, y, w: rw, h: rh }, w.type, w.category, w.displayName);
    }
    return c.toDataURL('image/jpeg', 0.65);
  }, []);

  const handleSaveAndExit = async () => {
    const thumb = captureThumbnail();
    await useEditorStore.getState().saveConfig(thumb);
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
        // 编辑态：等比缩放，面板内完整显示
        const availW = cw - EDITOR_PANEL_WIDTH;
        setScale(Math.min(availW / config.canvas.width, ch / config.canvas.height));
      } else if (scaleMode === 'width') {
        // 展示态移动端：撑满宽度
        setScale(cw / config.canvas.width);
      } else {
        // 展示态桌面/平板：等比缩放填满视口，CSS transform 统一缩放所有内容
        setScale(cw / config.canvas.width);
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

  const isMobile = !isEditorVisible && scaleMode === 'width';
  const isDesktopDisplay = !isEditorVisible && !isMobile;
  const vpW = containerRef.current?.clientWidth ?? window.innerWidth;
  const vpH = containerRef.current?.clientHeight ?? window.innerHeight;
  const mobileCanvasW = Math.max(320, vpW);

  // 桌面展示态：设计宽 1920，高度按视口比例拉伸，CSS transform 统一缩放
  const stretchedCanvasH = Math.round(config.canvas.width * (vpH / vpW));

  const effectiveCanvasH = isMobile
    ? Math.round((bpCanvasH ?? config.canvas.height) * mobileCanvasW / config.canvas.width)
    : config.canvas.height;

  const canvasStyle: React.CSSProperties = isMobile ? {
    width: mobileCanvasW,
    height: effectiveCanvasH,
    position: 'relative',
  } : isDesktopDisplay ? {
    // 桌面展示态：设计宽 1920 + 拉伸高度 + CSS transform 统一缩放
    width: config.canvas.width,
    height: stretchedCanvasH,
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  } : {
    // 编辑态：等比缩放 + 左偏移面板宽度
    width: config.canvas.width,
    height: config.canvas.height,
    position: 'absolute',
    top: 0,
    left: EDITOR_PANEL_WIDTH,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    transition: 'left 300ms ease, transform 300ms ease',
  };

  // 传给 ScreenCanvas 的实际画布尺寸
  const scCanvasW = isMobile ? mobileCanvasW : (isDesktopDisplay ? config.canvas.width : undefined);
  const scCanvasH = isMobile ? effectiveCanvasH : (isDesktopDisplay ? stretchedCanvasH : undefined);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-surface-base relative"
      style={{ overflowY: isMobile ? 'auto' : 'hidden', overflowX: 'hidden' }}
    >
      {/* ═══ 背景地球-2：视口级渲染，不受画布缩放偏移影响 ═══ */}
      {ready && backgroundPattern === 'globe-2' && !backgroundImage && !backgroundVideo && viewportW > 0 && (
        <Suspense fallback={null}>
          <CyberGlobe canvasW={viewportW} canvasH={viewportH} variant="oblique" />
        </Suspense>
      )}

      {/* 展示画布 — 数据就绪后才渲染，避免闪现默认配置 */}
      {ready && (
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
      )}

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


      {/* 编辑态：底部提示 + 清空屏幕按钮 */}
      {isEditorVisible && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
          <span className="text-[10px] text-textSecondary/25 tracking-wide pointer-events-none">
            拖拽组件到左侧组件池以删除 · Delete 键删除选中
          </span>
          <button
            onClick={() => setShowClearScreen(true)}
            className="pointer-events-auto text-[10px] px-2.5 py-1 rounded border border-negative/30 text-negative/70
              hover:bg-negative/10 hover:text-negative transition-colors tracking-wide"
          >
            清空屏幕
          </button>
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

      {/* 清空屏幕二次确认 */}
      <ConfirmDialog
        open={showClearScreen}
        title="清空屏幕"
        message={`确定要清除画布上全部 ${config.widgets.length} 个组件吗？此操作不可撤销。`}
        confirmLabel="清空"
        cancelLabel="取消"
        danger
        onConfirm={() => { clearWidgets(); setShowClearScreen(false); }}
        onCancel={() => setShowClearScreen(false)}
      />
    </div>
  );
}
