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

    const cellW = (width - gap * (cols + 1)) / cols;
    const cellH = (height - gap * (rows + 1)) / rows;
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

    const COLORS = { stat: '#FF8C42', chart: '#34d399', table: '#00D4FF', '3d': '#7c3aed', media: '#c084fc', decorator: '#9E9EA8' };

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
        case 'cyber-city':
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
      };
      const tpl = template || '2col';
      const areaStr = TEMPLATE_AREAS[tpl] || TEMPLATE_AREAS['2col'];
      const rows2 = areaStr.split('" "').length;
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
      const y = (gap + l.row * (cellH + gap)) * sc;
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
