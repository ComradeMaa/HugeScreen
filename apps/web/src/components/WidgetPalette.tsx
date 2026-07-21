import { widgetRegistry } from '@hugescreen/core';
import type { WidgetDefinition } from '@hugescreen/core';
import type { WidgetCategory } from '@hugescreen/shared';
import { headerElementRegistry } from '@hugescreen/widgets';
import type { HeaderElementDefinition } from '@hugescreen/widgets';
import {
  TrendingUp,
  LineChart,
  BarChart3,
  BarChart4,
  PieChart,
  Type,
  Clock,
  Globe,
  LayoutDashboard,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  LineChart,
  BarChart3,
  BarChartHorizontal: BarChart4,
  PieChart,
  Type,
  Clock,
  Globe,
  LayoutDashboard,
};

function WidgetIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon size={18} strokeWidth={1.5} />;
  return <span className="text-sm font-bold opacity-40">{name.slice(0, 2)}</span>;
}

/** Canvas: 圆角矩形 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** 创建拖拽缩略图 — Canvas 绘制图形化组件样本 */
function createWidgetThumbnail(type: string, w: number, h: number): HTMLElement {
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${w}px;height:${h}px;opacity:0.82`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // 背景
  ctx.fillStyle = 'rgba(44,44,52,0.92)';
  roundRect(ctx, 0, 0, w, h, 6);
  ctx.fill();

  // 边框
  ctx.strokeStyle = 'rgba(0,212,255,0.45)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 6);
  ctx.stroke();

  const c = '#00D4FF';
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.2;
  ctx.font = '10px "Inter","PingFang SC",sans-serif';
  ctx.textAlign = 'center';

  const cx = w / 2, cy = h / 2;

  if (type === 'stat-card') {
    ctx.font = '8px "Inter","PingFang SC",sans-serif';
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    ctx.fillText('VISITORS', cx, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "JetBrains Mono",monospace';
    ctx.fillText('12.8k', cx, 42);
    ctx.fillStyle = '#34d399';
    ctx.font = '9px "Inter","PingFang SC",sans-serif';
    ctx.fillText('↑ 12.5%', cx, 58);

  } else if (type === 'line-chart') {
    const pts = [[16, 58], [34, 40], [52, 48], [70, 22], [88, 32]];
    ctx.strokeStyle = 'rgba(0,212,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    // Points
    ctx.fillStyle = '#00D4FF';
    pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); });
    // Area
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#00D4FF';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[4][0], h - 10); ctx.lineTo(pts[0][0], h - 10); ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

  } else if (type === 'bar-chart') {
    const bars = [[22, 45, 48], [42, 30, 34], [62, 55, 58], [82, 20, 24]];
    bars.forEach(([x, top, bottom]) => {
      ctx.fillStyle = 'rgba(0,212,255,0.7)';
      roundRect(ctx, x - 6, top, 12, bottom - top, 2);
      ctx.fill();
    });

  } else if (type === 'pie-chart') {
    const slices = [[0, 0.35], [0.35, 0.65], [0.65, 1]];
    const colors = ['rgba(0,212,255,0.75)', 'rgba(0,212,255,0.45)', 'rgba(0,212,255,0.2)'];
    slices.forEach(([start, end], i) => {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 22, start * Math.PI * 2 - Math.PI / 2, end * Math.PI * 2 - Math.PI / 2);
      ctx.closePath();
      ctx.fill();
    });
    // Donut hole
    ctx.fillStyle = 'rgba(44,44,52,0.92)';
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'bar-line-chart') {
    const bars = [[20, 52], [38, 44], [56, 38], [74, 30]];
    bars.forEach(([x, top]) => {
      ctx.fillStyle = 'rgba(0,212,255,0.6)';
      roundRect(ctx, x - 5, top, 10, 60 - top, 2);
      ctx.fill();
    });
    const pts = [[20, 30], [38, 24], [56, 18], [74, 12]];
    ctx.strokeStyle = '#FF8C42';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.fillStyle = '#FF8C42';
    pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); });

  } else if (type.startsWith('composite-')) {
    // 2×2 grid with dashed dividers
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([3, 3]);
    // Vertical divider
    ctx.beginPath(); ctx.moveTo(cx, 10); ctx.lineTo(cx, h - 10); ctx.stroke();
    // Horizontal divider
    ctx.beginPath(); ctx.moveTo(10, cy); ctx.lineTo(w - 10, cy); ctx.stroke();
    ctx.setLineDash([]);
    // Quadrant labels
    ctx.fillStyle = 'rgba(0,212,255,0.4)';
    ctx.font = '7px "Inter","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A', cx / 2, cy / 2 + 2);
    ctx.fillText('B', cx + cx / 2, cy / 2 + 2);
    ctx.fillText('C', cx / 2, cy + cy / 2 + 2);
    ctx.fillText('D', cx + cx / 2, cy + cy / 2 + 2);

  } else {
    // Fallback: centered label
    ctx.font = '12px "Inter","PingFang SC",sans-serif';
    ctx.fillText(type, cx, cy + 4);
  }

  return canvas;
}

/** 创建顶栏组件拖拽缩略图 */
function createHeaderThumbnail(type: string, w: number, h: number): HTMLElement {
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${w}px;height:${h}px;opacity:0.82`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const c = '#00D4FF';
  const cx = w / 2, cy = h / 2;

  // 背景
  ctx.fillStyle = 'rgba(44,44,52,0.92)';
  roundRect(ctx, 0, 0, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,212,255,0.45)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 4);
  ctx.stroke();

  if (type === 'header-datetime') {
    // Digital clock display — dark panel
    const bx = 8, by = 5, bw = w - 16, bh = h - 10;
    ctx.fillStyle = 'rgba(10,14,26,0.7)';
    roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 4);
    ctx.stroke();
    // Time — digital font
    ctx.font = 'bold 20px "JetBrains Mono",monospace';
    ctx.fillStyle = '#00D4FF';
    ctx.textAlign = 'center';
    ctx.fillText('14:32', bx + bw / 2, by + 19);
    // Date below
    ctx.font = '8px "Inter","PingFang SC",sans-serif';
    ctx.fillStyle = 'rgba(0,212,255,0.45)';
    ctx.fillText('2026-07-16', bx + bw / 2, by + 30);

  } else if (type === 'header-title') {
    // Title lines
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    roundRect(ctx, 10, 14, w - 20, 5, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,212,255,0.5)';
    roundRect(ctx, 10, 24, w * 0.5, 4, 2); ctx.fill();

  } else if (type === 'mini-globe') {
    const gr = 14; // globe radius
    const gx = w / 2, gy = h / 2;
    // Sphere body
    ctx.fillStyle = 'rgba(44,44,52,0.7)';
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.stroke();
    // Latitude lines
    ctx.strokeStyle = 'rgba(0,212,255,0.15)';
    ctx.lineWidth = 0.5;
    [-6, -3, 0, 3, 6].forEach(dy => {
      const rx = Math.sqrt(gr * gr - dy * dy);
      ctx.beginPath();
      ctx.ellipse(gx, gy + dy, rx, 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Equator ring
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(gx, gy, gr + 1, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Highlight dot
    ctx.fillStyle = 'rgba(0,212,255,0.5)';
    ctx.beginPath(); ctx.arc(gx - 4, gy - 5, 1.2, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'spectrum-bar') {
    // 5 bars with varying heights
    const barW = 3, gap = 2.5;
    const barXs = [18, 25, 32, 39, 46].map(x => cx - 16 + x * 0.8);
    const barHs = [22, 14, 30, 18, 26];
    barXs.forEach((bx, i) => {
      const bh = barHs[i];
      const by = h - 10 - bh;
      ctx.fillStyle = `rgba(0,212,255,${0.3 + i * 0.08})`;
      roundRect(ctx, bx, by, barW, bh, 1.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,212,255,0.5)';
      ctx.beginPath(); ctx.arc(bx + barW / 2, by, 1.2, 0, Math.PI * 2); ctx.fill();
    });

  } else if (type === 'signal-tower') {
    // A-shaped tower
    ctx.strokeStyle = 'rgba(0,212,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 14, h - 8); ctx.lineTo(cx, 8); ctx.lineTo(cx + 14, h - 8); ctx.stroke();
    // Cross bars
    ctx.strokeStyle = 'rgba(0,212,255,0.2)';
    ctx.lineWidth = 0.5;
    for (let t = 0.3; t < 1; t += 0.25) {
      const y = 8 + (h - 16) * t;
      const lx = cx - 14 * (1 - t);
      const rx = cx + 14 * (1 - t);
      ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.stroke();
    }
    // Pulse dot at top
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    ctx.beginPath(); ctx.arc(cx, 8, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, 8, 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,212,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

  } else if (type === 'wire-sphere') {
    // Icosahedron-like wireframe
    const gr = 13;
    // Outer circles
    ctx.strokeStyle = 'rgba(0,212,255,0.3)';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2); ctx.stroke();
    // Diagonal lines (suggesting facets)
    ctx.strokeStyle = 'rgba(0,212,255,0.2)';
    ctx.lineWidth = 0.4;
    for (let a = 0; a < Math.PI; a += Math.PI / 5) {
      const x1 = cx + Math.cos(a) * gr;
      const y1 = cy + Math.sin(a) * gr;
      const x2 = cx + Math.cos(a + Math.PI * 0.6) * gr * 0.6;
      const y2 = cy + Math.sin(a + Math.PI * 0.6) * gr * 0.6;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Vertex dots
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * gr, cy + Math.sin(a) * gr * 0.55, 1, 0, Math.PI * 2);
      ctx.fill();
    }

  } else {
    ctx.font = '11px "Inter","PingFang SC",sans-serif';
    ctx.fillStyle = '#00D4FF';
    ctx.textAlign = 'center';
    ctx.fillText(type, cx, cy + 4);
  }

  return canvas;
}

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  stat: '统计卡',
  chart: '图表',
  table: '表格',
  '3d': '3D 组件',
  media: '媒体',
  decorator: '装饰',
  custom: '自定义',
};

/**
 * 组件池面板
 * 像手机主屏幕那样展示组件缩略图，拖入画布即放置。
 */
export function WidgetPalette({ onCreateComposite }: { onCreateComposite?: () => void }) {
  const grouped = widgetRegistry.getGroupedByCategory();
  const allWidgets = widgetRegistry.getAll();
  const headerElements = headerElementRegistry.getAll();
  const deleteCustomComponent = useEditorStore((s) => s.deleteCustomComponent);
  const instances = useEditorStore((s) => s.config.widgets);
  if (allWidgets.length === 0 && headerElements.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-textSecondary/50 py-12">
        暂无可用的数据组件
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* ─── 顶栏组件 ─── */}
      {headerElements.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-accent-warm/50 uppercase tracking-wider mb-2 px-1">
            顶栏
          </div>
          <div className="space-y-1">
            {headerElements.map((el) => (
              <HeaderPaletteItem key={el.type} element={el} />
            ))}
          </div>
        </div>
      )}

      {/* ─── 普通组件 ─── */}
      {Array.from(grouped.entries()).map(([category, widgets]) => (
        <div key={category}>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-semibold text-textSecondary/40 uppercase tracking-wider">
              {CATEGORY_LABELS[category]}
            </span>
            {/* ★ 图表分类显示"创建组合"入口 */}
            {category === 'chart' && (
              <button
                onClick={() => onCreateComposite?.()}
                className="flex items-center gap-1 text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors px-1.5 py-0.5 rounded border border-[rgba(0,212,255,0.15)] hover:border-[rgba(0,212,255,0.35)]"
              >
                <Plus size={10} />
                创建组合
              </button>
            )}
          </div>
          <div className="space-y-1">
            {widgets.map((widget) => (
              <PaletteItem
                key={widget.type}
                widget={widget}
                onDelete={category === 'custom' ? () => {
                  const count = instances.filter((w) => w.type === widget.type).length;
                  const msg = count > 0
                    ? `删除自定义组件「${widget.name}」？画布上有 ${count} 个实例将一并删除。`
                    : `删除自定义组件「${widget.name}」？`;
                  if (window.confirm(msg)) deleteCustomComponent(widget.type);
                } : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaletteItem({ widget, onDelete }: { widget: WidgetDefinition; onDelete?: () => void }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/widget-type', widget.type);
    e.dataTransfer.effectAllowed = 'copy';
    const thumb = createWidgetThumbnail(widget.type, 120, 72);
    e.dataTransfer.setDragImage(thumb, 60, 36);
    requestAnimationFrame(() => thumb.remove());
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-grab active:cursor-grabbing
        hover:bg-surface-hover transition-colors group border border-transparent hover:border-[rgba(255,255,255,0.04)]"
    >
      {/* 图标 */}
      <div className="w-9 h-9 rounded-md bg-surface-base flex items-center justify-center
        text-accent-cool/70 group-hover:text-accent-cool group-hover:bg-surface-hover transition-all flex-shrink-0">
        <WidgetIcon name={widget.icon} />
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-textSecondary group-hover:text-text truncate">
          {widget.name}
        </div>
        <div className="text-[10px] text-textSecondary/40 truncate mt-0.5">
          {widget.description}
        </div>
      </div>

      {/* 默认尺寸标签 */}
      <div className="text-[9px] text-textSecondary/20 font-mono flex-shrink-0 bg-surface-base/50 px-1 py-0.5 rounded">
        {widget.defaultSize.colSpan}×{widget.defaultSize.rowSpan}
      </div>

      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onDragStart={(e) => e.stopPropagation()}
          draggable={false}
          title="删除自定义组件"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-textSecondary/40 hover:text-negative hover:bg-negative/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

/** 顶栏组件项 — 拖入顶栏槽位 */
function HeaderPaletteItem({ element }: { element: HeaderElementDefinition }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/header-element-type', element.type);
    e.dataTransfer.effectAllowed = 'copy';
    const thumb = createHeaderThumbnail(element.type, 90, 42);
    e.dataTransfer.setDragImage(thumb, 45, 21);
    requestAnimationFrame(() => thumb.remove());
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-grab active:cursor-grabbing
        hover:bg-surface-hover transition-colors group border border-transparent hover:border-[rgba(255,255,255,0.04)]"
    >
      <div className="w-9 h-9 rounded-md bg-surface-base flex items-center justify-center
        text-accent-warm/70 group-hover:text-accent-warm group-hover:bg-surface-hover transition-all flex-shrink-0">
        <WidgetIcon name={element.icon} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-textSecondary group-hover:text-text truncate">
          {element.name}
        </div>
        <div className="text-[10px] text-textSecondary/40 truncate mt-0.5">
          仅顶栏可用
        </div>
      </div>

      <div className="text-[9px] text-textSecondary/20 font-mono flex-shrink-0 bg-surface-base/50 px-1 py-0.5 rounded">
        {element.defaultColSpan}列
      </div>
    </div>
  );
}
