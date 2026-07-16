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
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  LineChart,
  BarChart3,
  BarChartHorizontal: BarChart4,
  PieChart,
  Type,
  Clock,
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
};

/**
 * 组件池面板
 * 像手机主屏幕那样展示组件缩略图，拖入画布即放置。
 */
export function WidgetPalette() {
  const grouped = widgetRegistry.getGroupedByCategory();
  const allWidgets = widgetRegistry.getAll();
  const headerElements = headerElementRegistry.getAll();

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
          <div className="text-[10px] font-semibold text-textSecondary/40 uppercase tracking-wider mb-2 px-1">
            {CATEGORY_LABELS[category]}
          </div>
          <div className="space-y-1">
            {widgets.map((widget) => (
              <PaletteItem key={widget.type} widget={widget} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaletteItem({ widget }: { widget: WidgetDefinition }) {
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
