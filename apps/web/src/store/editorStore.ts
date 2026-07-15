import { create } from 'zustand';
import type {
  ScreenConfig,
  WidgetConfig,
  WidgetLayout,
  GridConfig,
  ThemeConfig,
} from '@hugescreen/shared';
import {
  DEFAULT_THEME,
  DEFAULT_CANVAS,
} from '@hugescreen/shared';
import { widgetRegistry, layoutEngine } from '@hugescreen/core';
import { generateId } from '../utils/id';
import { DEFAULT_SLOTS, DEFAULT_GRID as LAYOUT_GRID, type ScreenSlot } from './defaultLayout';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

const DEFAULT_GRID: GridConfig = {
  ...LAYOUT_GRID,
  snapToGrid: true,
};

interface EditorState {
  config: ScreenConfig;
  currentBreakpoint: Breakpoint;
  selectedWidgetId: string | null;
  isEditorVisible: boolean;  // 编辑器是否可见
  showGrid: boolean;
  snapToGrid: boolean;

  setConfig: (config: ScreenConfig) => void;
  setTheme: (theme: ThemeConfig) => void;
  setGrid: (grid: GridConfig) => void;

  addWidget: (type: string, layout: WidgetLayout) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<WidgetConfig>) => void;
  moveWidget: (id: string, layout: WidgetLayout) => void;
  resizeWidget: (id: string, layout: WidgetLayout) => void;
  selectWidget: (id: string | null) => void;
  duplicateWidget: (id: string) => void;

  setBreakpoint: (bp: Breakpoint) => void;
  toggleEditor: () => void;
  showEditor: () => void;
  hideEditor: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;

  saveConfig: () => string;
  loadConfig: (json: string) => void;
  exportConfig: () => void;
  importConfig: () => void;
  loadSlots: (slots: ScreenSlot[]) => void;
}

/** 根据默认槽位创建初始组件 */
function createDefaultWidgets(slots: ScreenSlot[]): WidgetConfig[] {
  return slots.map((slot) => ({
    id: generateId(),
    type: slot.defaultType,
    displayName: slot.label,
    category: slot.category,
    layout: slot.layout,
    dataSource: {
      type: 'static',
      config: {},
      mapping: {},
      staticData: slot.defaultData ?? [],
    },
    options: slot.defaultOptions ?? {},
    animation: { enabled: true },
    style: {
      title: { show: true, text: slot.label, accent: true },
    },
  }));
}

/**
 * 删除组件后，尝试将同列相邻组件扩展填充空位。
 * 优先「下方组件上移」，其次「上方组件下扩」。
 */
function mergeSlotsAfterRemove(widgets: WidgetConfig[], removed: WidgetConfig): WidgetConfig[] {
  const { col, row, colSpan, rowSpan } = removed.layout;
  const removedRowEnd = row + rowSpan;

  // 尝试找正下方同列等宽的组件 → 上移扩展
  const belowIdx = widgets.findIndex(
    (w) =>
      w.layout.col === col &&
      w.layout.colSpan === colSpan &&
      w.layout.row === removedRowEnd,
  );

  if (belowIdx !== -1) {
    const below = widgets[belowIdx];
    const merged: WidgetConfig = {
      ...below,
      layout: {
        ...below.layout,
        row,
        rowSpan: rowSpan + below.layout.rowSpan,
      },
    };
    return widgets.map((w, i) => (i === belowIdx ? merged : w));
  }

  // 尝试找正上方同列等宽的组件 → 下扩填充
  const aboveIdx = widgets.findIndex(
    (w) =>
      w.layout.col === col &&
      w.layout.colSpan === colSpan &&
      w.layout.row + w.layout.rowSpan === row,
  );

  if (aboveIdx !== -1) {
    const above = widgets[aboveIdx];
    const merged: WidgetConfig = {
      ...above,
      layout: {
        ...above.layout,
        rowSpan: above.layout.rowSpan + rowSpan,
      },
    };
    return widgets.map((w, i) => (i === aboveIdx ? merged : w));
  }

  return widgets;
}

/**
 * 添加组件时的反向 reflow：如果新组件的目标位置与已被合并扩大的组件重叠，
 * 把被扩大组件缩回其注册默认尺寸，腾出空间给新组件。
 *
 * 覆盖场景：
 *   - 新组件放在扩大组件的顶部 → 扩大组件向下缩（row 下移，rowSpan 减少）
 *   - 新组件放在扩大组件的底部 → 扩大组件向上缩（rowSpan 减少）
 */
function reflowOnAdd(widgets: WidgetConfig[], incoming: WidgetConfig): WidgetConfig[] {
  const inc = incoming.layout;

  return widgets.map((existing) => {
    const ex = existing.layout;
    const overlaps = layoutEngine.overlaps(
      { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
      { col: ex.col, row: ex.row, colSpan: ex.colSpan, rowSpan: ex.rowSpan },
    );
    if (!overlaps) return existing;

    const def = widgetRegistry.get(existing.type);
    const defRowSpan = def?.defaultSize?.rowSpan ?? ex.rowSpan;
    const defColSpan = def?.defaultSize?.colSpan ?? ex.colSpan;

    // 未扩大 → 不动
    if (ex.rowSpan <= defRowSpan && ex.colSpan <= defColSpan) return existing;

    const incRowEnd = inc.row + inc.rowSpan;
    const exRowEnd = ex.row + ex.rowSpan;

    // 竖向扩大 → 新组件在上方：现有组件 row 下移，rowSpan 减少
    if (ex.rowSpan > defRowSpan && inc.row <= ex.row && incRowEnd < exRowEnd) {
      const newRow = incRowEnd;
      const newRowSpan = exRowEnd - incRowEnd;
      if (newRowSpan >= defRowSpan) {
        return { ...existing, layout: { ...ex, row: newRow, rowSpan: newRowSpan } };
      }
    }

    // 竖向扩大 → 新组件在下方：现有组件 rowSpan 减少
    if (ex.rowSpan > defRowSpan && inc.row > ex.row && incRowEnd >= exRowEnd) {
      const newRowSpan = inc.row - ex.row;
      if (newRowSpan >= defRowSpan) {
        return { ...existing, layout: { ...ex, rowSpan: newRowSpan } };
      }
    }

    return existing;
  });
}

function createInitialConfig(): ScreenConfig {
  const initialSlots = DEFAULT_SLOTS;
  return {
    id: generateId(),
    name: '默认大屏',
    version: '1.0',
    canvas: { ...DEFAULT_CANVAS },
    grid: { ...DEFAULT_GRID },
    responsive: {
      desktop: { grid: { cols: 8, rows: 7, gap: 8 }, widgetLayouts: {}, hiddenWidgets: [] },
      tablet: { grid: { cols: 4, rows: 7, gap: 6 }, widgetLayouts: {}, hiddenWidgets: [] },
      mobile: { grid: { cols: 1, rows: 8, gap: 4 }, widgetLayouts: {}, hiddenWidgets: ['screen-header'] },
    },
    widgets: createDefaultWidgets(initialSlots),
    theme: { ...DEFAULT_THEME },
  };
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  config: createInitialConfig(),
  currentBreakpoint: 'desktop',
  selectedWidgetId: null,
  isEditorVisible: false,  // 默认隐藏编辑器 → 展示态
  showGrid: true,
  snapToGrid: true,

  setConfig: (config: ScreenConfig) => set({ config }),

  setTheme: (theme: ThemeConfig) =>
    set((s) => ({ config: { ...s.config, theme } })),

  setGrid: (grid: GridConfig) =>
    set((s) => ({ config: { ...s.config, grid } })),

  addWidget: (type: string, layout: WidgetLayout) => {
    const def = widgetRegistry.get(type);
    const newWidget: WidgetConfig = {
      id: generateId(),
      type,
      displayName: def?.name ?? type,
      category: def?.category ?? 'chart',
      layout,  // 最终放置位置由 reflow 决定
      dataSource: { type: 'static', config: {}, mapping: {}, staticData: def?.defaultConfig ?? {} },
      options: def?.defaultConfig ?? {},
      animation: { enabled: true },
      style: {
        title: { show: true, text: def?.name ?? type, accent: true },
      },
    };
    set((s) => {
      // ★ 关键：reflow — 如果新组件落点有被合并扩大的组件，先缩回腾空间
      let widgets = reflowOnAdd(s.config.widgets, newWidget);
      // 检测 reflow 后是否还有重叠，有则用 findFreeSlot 找不重叠位置
      const incomingCell = {
        col: newWidget.layout.col,
        row: newWidget.layout.row,
        colSpan: newWidget.layout.colSpan,
        rowSpan: newWidget.layout.rowSpan,
      };
      const stillOverlaps = widgets.some((w) =>
        layoutEngine.overlaps(incomingCell, {
          col: w.layout.col,
          row: w.layout.row,
          colSpan: w.layout.colSpan,
          rowSpan: w.layout.rowSpan,
        }),
      );
      if (stillOverlaps) {
        const occupied = widgets.map((w) => ({
          col: w.layout.col,
          row: w.layout.row,
          colSpan: w.layout.colSpan,
          rowSpan: w.layout.rowSpan,
        }));
        const free = layoutEngine.findFreeSlot(incomingCell, occupied, s.config.grid);
        newWidget.layout = { col: free.col, row: free.row, colSpan: free.colSpan, rowSpan: free.rowSpan };
      }
      widgets.push(newWidget);
      return {
        config: { ...s.config, widgets },
        selectedWidgetId: newWidget.id,
      };
    });
  },

  removeWidget: (id: string) => {
    const state = get();
    const removed = state.config.widgets.find((w) => w.id === id);
    if (!removed) return;

    let widgets = state.config.widgets.filter((w) => w.id !== id);

    // 侧边栏槽位合并：删除后下方/上方同列组件扩展填充
    widgets = mergeSlotsAfterRemove(widgets, removed);

    set((s) => ({
      config: { ...s.config, widgets },
      selectedWidgetId: s.selectedWidgetId === id ? null : s.selectedWidgetId,
    }));
  },

  updateWidget: (id: string, patch: Partial<WidgetConfig>) =>
    set((s) => ({
      config: { ...s.config, widgets: s.config.widgets.map((w) =>
        w.id === id ? { ...w, ...patch } : w) },
    })),

  moveWidget: (id: string, layout: WidgetLayout) =>
    set((s) => {
      const oldWidget = s.config.widgets.find((w) => w.id === id);
      if (!oldWidget) return s;

      // 1. 从旧位置移除
      let widgets = s.config.widgets.filter((w) => w.id !== id);

      // 2. 旧位置腾空后尝试合并相邻空区块
      const ghost: WidgetConfig = { ...oldWidget };
      widgets = mergeSlotsAfterRemove(widgets, ghost);

      // 3. 移动到新位置（使用新区块尺寸）
      const moved = { ...oldWidget, layout };

      // 4. 新位置 reflow：如果和目标区块内的已扩大组件重叠，先缩回
      widgets = reflowOnAdd(widgets, moved);

      // 5. reflow 后仍有冲突 → findFreeSlot 兜底
      const inc = moved.layout;
      const stillOverlaps = widgets.some((w) =>
        layoutEngine.overlaps(
          { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
          { col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan },
        ),
      );
      if (stillOverlaps) {
        const occupied = widgets.map((w) => ({
          col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan,
        }));
        const free = layoutEngine.findFreeSlot(
          { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
          occupied,
          s.config.grid,
        );
        moved.layout = { col: free.col, row: free.row, colSpan: free.colSpan, rowSpan: free.rowSpan };
      }
      widgets.push(moved);
      return { config: { ...s.config, widgets } };
    }),

  resizeWidget: (id: string, layout: WidgetLayout) =>
    set((s) => ({
      config: { ...s.config, widgets: s.config.widgets.map((w) =>
        w.id === id ? { ...w, layout } : w) },
    })),

  selectWidget: (id: string | null) => set({ selectedWidgetId: id }),

  duplicateWidget: (id: string) => {
    const state = get();
    const source = state.config.widgets.find((w) => w.id === id);
    if (!source) return;
    set((s) => ({
      config: {
        ...s.config,
        widgets: [...s.config.widgets, { ...source, id: generateId(),
          displayName: `${source.displayName} (副本)`,
          layout: { ...source.layout, col: Math.min(source.layout.col + 1, s.config.grid.cols - source.layout.colSpan) },
        }],
      },
    }));
  },

  setBreakpoint: (bp: Breakpoint) => set({ currentBreakpoint: bp }),
  toggleEditor: () => set((s) => ({ isEditorVisible: !s.isEditorVisible })),
  showEditor: () => set({ isEditorVisible: true }),
  hideEditor: () => set({ isEditorVisible: false }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  saveConfig: () => {
    const json = JSON.stringify(get().config, null, 2);
    localStorage.setItem('hugescreen-config', json);
    return json;
  },

  loadConfig: (json: string) => {
    try {
      const config = JSON.parse(json) as ScreenConfig;
      set({ config });
    } catch { console.error('[EditorStore] Failed to parse config JSON'); }
  },

  exportConfig: () => {
    const json = JSON.stringify(get().config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${get().config.name}.json`;
    a.click(); URL.revokeObjectURL(url);
  },

  importConfig: () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => get().loadConfig(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
  },

  loadSlots: (slots: ScreenSlot[]) => {
    set((s) => ({
      config: { ...s.config, widgets: createDefaultWidgets(slots) },
    }));
  },
}));
