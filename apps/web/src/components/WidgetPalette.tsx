import { widgetRegistry } from '@hugescreen/core';
import type { WidgetDefinition } from '@hugescreen/core';
import type { WidgetCategory } from '@hugescreen/shared';
import {
  TrendingUp,
  LineChart,
  BarChart3,
  BarChart4,
  PieChart,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  LineChart,
  BarChart3,
  BarChartHorizontal: BarChart4,
  PieChart,
  LayoutDashboard,
};

function WidgetIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon size={18} strokeWidth={1.5} />;
  return <span className="text-sm font-bold opacity-40">{name.slice(0, 2)}</span>;
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

  if (allWidgets.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-textSecondary/50 py-12">
        暂无可用的数据组件
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
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
