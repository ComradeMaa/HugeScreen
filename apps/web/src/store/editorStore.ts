import { create } from 'zustand';
import type {
  ScreenConfig,
  WidgetConfig,
  WidgetLayout,
  GridConfig,
  ThemeConfig,
  HeaderSlotConfig,
} from '@hugescreen/shared';
import {
  DEFAULT_THEME,
  DEFAULT_CANVAS,
} from '@hugescreen/shared';
import { widgetRegistry, layoutEngine } from '@hugescreen/core';
import { headerElementRegistry } from '@hugescreen/widgets';
import { generateId } from '../utils/id';
import { DEFAULT_SLOTS, DEFAULT_GRID as LAYOUT_GRID, type ScreenSlot } from './defaultLayout';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

const DEFAULT_GRID: GridConfig = {
  ...LAYOUT_GRID,
  snapToGrid: true,
};

/** 顶栏守卫：row 0 是固定顶栏，不应对普通组件开放 */
function row0Guard(grid: GridConfig) {
  return { col: 0, row: 0, colSpan: grid.cols, rowSpan: 1 };
}

interface EditorState {
  config: ScreenConfig;
  currentBreakpoint: Breakpoint;
  selectedWidgetId: string | null;
  selectedHeaderSlotId: string | null;
  isEditorVisible: boolean;  // 编辑器是否可见
  isDraggingWidget: boolean; // 是否正在拖拽已有组件（用于左侧栏删除提示）
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

  // 顶栏槽位管理
  setHeaderSlot: (slotId: string, elementType: string | null, options?: Record<string, unknown>) => void;
  removeHeaderElement: (slotId: string) => void;
  swapHeaderSlots: (fromId: string, toId: string) => void;
  selectHeaderSlot: (id: string | null) => void;

  setBreakpoint: (bp: Breakpoint) => void;
  toggleEditor: () => void;
  showEditor: () => void;
  hideEditor: () => void;
  setDraggingWidget: (v: boolean) => void;
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
      title: { primary: { text: slot.label } },
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
 * 三场景覆盖：
 *   I.   新组件在顶部  → 旧组件向下收缩（row 下移，rowSpan 减少）
 *   II.  新组件在底部  → 旧组件向上收缩（rowSpan 减少）
 *   III. 新组件在中间  → 旧组件保留最上方部分，下方释放为空区块
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

    // 未扩大 → 不动（交由 findFreeSlot 找其他位置）
    if (ex.rowSpan <= defRowSpan && ex.colSpan <= defColSpan) return existing;

    const incRowEnd = inc.row + inc.rowSpan;
    const exRowEnd = ex.row + ex.rowSpan;

    // ═══ 场景 I：新组件在顶部 → 旧组件向下缩 ═══
    // 例：旧 rows 1-6, 新 rows 1-2 → 旧缩为 rows 3-6
    if (ex.rowSpan > defRowSpan && inc.row <= ex.row && incRowEnd < exRowEnd) {
      const newRow = incRowEnd;
      const newRowSpan = exRowEnd - incRowEnd;
      if (newRowSpan >= defRowSpan) {
        return { ...existing, layout: { ...ex, row: newRow, rowSpan: newRowSpan } };
      }
    }

    // ═══ 场景 II：新组件在底部 → 旧组件向上缩 ═══
    // 例：旧 rows 1-6, 新 rows 5-6 → 旧缩为 rows 1-4
    if (ex.rowSpan > defRowSpan && inc.row > ex.row && incRowEnd >= exRowEnd) {
      const newRowSpan = inc.row - ex.row;
      if (newRowSpan >= defRowSpan) {
        return { ...existing, layout: { ...ex, rowSpan: newRowSpan } };
      }
    }

    // ═══ 场景 III：新组件在中间 → 旧组件保留最上方部分 ═══
    // 例：旧 rows 1-6（三个 2 行区块合并），新 rows 3-4 → 旧缩为 rows 1-2，释放 3-6
    if (ex.rowSpan > defRowSpan && inc.row > ex.row && incRowEnd < exRowEnd) {
      const topRowSpan = inc.row - ex.row;
      if (topRowSpan >= defRowSpan) {
        return { ...existing, layout: { ...ex, rowSpan: topRowSpan } };
      }
    }

    return existing;
  });
}

function createDefaultHeader(): { slots: HeaderSlotConfig[] } {
  // 8 个等宽 1 列槽位；标题占 2 列(=合并 slot0+slot1)；datetime 占 1 列
  return {
    slots: [
      { id: generateId(), colSpan: 2, elementType: 'header-title',   options: { text: '数据监控中心' } },
      // slot1 已被合并到 slot0（colSpan=2），故不存在
      { id: generateId(), colSpan: 1, elementType: null,              options: {} },
      { id: generateId(), colSpan: 1, elementType: null,              options: {} },
      { id: generateId(), colSpan: 1, elementType: null,              options: {} },
      { id: generateId(), colSpan: 1, elementType: null,              options: {} },
      { id: generateId(), colSpan: 1, elementType: null,              options: {} },
      { id: generateId(), colSpan: 1, elementType: 'header-datetime', options: { showSeconds: true } },
    ],
  };
}

function createInitialConfig(): ScreenConfig {
  const initialSlots = DEFAULT_SLOTS;
  return {
    id: generateId(),
    name: '默认大屏',
    version: '1.0',
    canvas: { ...DEFAULT_CANVAS },
    grid: { ...DEFAULT_GRID },
    header: createDefaultHeader(),
    responsive: {
      desktop: { grid: { cols: 8, rows: 7, gap: 8 }, widgetLayouts: {}, hiddenWidgets: [] },
      tablet: { grid: { cols: 4, rows: 7, gap: 6 }, widgetLayouts: {}, hiddenWidgets: [] },
      mobile: { grid: { cols: 1, rows: 6, gap: 4 }, widgetLayouts: {}, hiddenWidgets: [] },
    },
    widgets: createDefaultWidgets(initialSlots),
    theme: { ...DEFAULT_THEME },
  };
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  config: createInitialConfig(),
  currentBreakpoint: 'desktop',
  selectedWidgetId: null,
  selectedHeaderSlotId: null,
  isEditorVisible: false,  // 默认隐藏编辑器 → 展示态
  isDraggingWidget: false,
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
        title: { primary: { text: def?.name ?? type } },
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
          col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan,
        }));
        occupied.push(row0Guard(s.config.grid));
        const free = layoutEngine.findFreeSlot(incomingCell, occupied, s.config.grid);
        // 确保不会落在 row 0
        newWidget.layout = { col: free.col, row: Math.max(1, free.row), colSpan: free.colSpan, rowSpan: free.rowSpan };
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
        occupied.push(row0Guard(s.config.grid));
        const free = layoutEngine.findFreeSlot(
          { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
          occupied,
          s.config.grid,
        );
        moved.layout = { col: free.col, row: Math.max(1, free.row), colSpan: free.colSpan, rowSpan: free.rowSpan };
      }
      widgets.push(moved);
      return { config: { ...s.config, widgets } };
    }),

  resizeWidget: (id: string, layout: WidgetLayout) =>
    set((s) => ({
      config: { ...s.config, widgets: s.config.widgets.map((w) =>
        w.id === id ? { ...w, layout } : w) },
    })),

  selectWidget: (id: string | null) => set({ selectedWidgetId: id, selectedHeaderSlotId: null }),

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

  // ─── 顶栏槽位管理（支持多列组件合并/拆分） ───
  setHeaderSlot: (slotId: string, elementType: string | null, options?: Record<string, unknown>) =>
    set((s) => {
      const slots = [...s.config.header.slots];
      const idx = slots.findIndex((sl) => sl.id === slotId);
      if (idx === -1) return s;

      // 如果要清空 → 委派给 removeHeaderElement
      if (!elementType) {
        const oldSpan = slots[idx].colSpan;
        slots[idx] = { ...slots[idx], colSpan: 1, elementType: null, options: {} };
        // 还原被合并的右侧槽位
        for (let i = 1; i < oldSpan; i++) {
          slots.splice(idx + i, 0, {
            id: generateId(), colSpan: 1, elementType: null, options: {},
          });
        }
        return { config: { ...s.config, header: { ...s.config.header, slots } } };
      }

      const def = headerElementRegistry.get(elementType);
      const needCols = def?.defaultColSpan ?? 1;

      // 拒绝：多列组件放在最后一个槽位
      if (needCols > 1 && idx + needCols > slots.length) return s;

      // 先清除旧槽位的合并状态（如果之前有占用多列）
      const oldSpan = slots[idx].colSpan;
      if (oldSpan > 1) {
        slots[idx] = { ...slots[idx], colSpan: 1, elementType: null, options: {} };
        for (let i = 1; i < oldSpan; i++) {
          slots.splice(idx + i, 0, {
            id: generateId(), colSpan: 1, elementType: null, options: {},
          });
        }
      }

      // 如果新元素需要多列 → 合并右侧槽位
      if (needCols > 1) {
        slots.splice(idx + 1, needCols - 1);
      }

      slots[idx] = {
        ...slots[idx],
        colSpan: needCols,
        elementType,
        options: options ?? def?.defaultConfig ?? {},
      };

      return { config: { ...s.config, header: { ...s.config.header, slots } } };
    }),

  removeHeaderElement: (slotId: string) =>
    set((s) => {
      const slots = [...s.config.header.slots];
      const idx = slots.findIndex((sl) => sl.id === slotId);
      if (idx === -1) return s;

      const oldSpan = slots[idx].colSpan;
      // 清空当前槽位
      slots[idx] = { ...slots[idx], colSpan: 1, elementType: null, options: {} };
      // 还原被合并的右侧槽位
      for (let i = 1; i < oldSpan; i++) {
        slots.splice(idx + i, 0, {
          id: generateId(), colSpan: 1, elementType: null, options: {},
        });
      }

      return { config: { ...s.config, header: { ...s.config.header, slots } } };
    }),

  /** 原子化交换两个顶栏槽位的内容，避免分步操作造成的中间态异常 */
  swapHeaderSlots: (fromId: string, toId: string) =>
    set((s) => {
      const slots = [...s.config.header.slots];
      const fromIdx = slots.findIndex((sl) => sl.id === fromId);
      const toIdx = slots.findIndex((sl) => sl.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return s;

      const from = slots[fromIdx];
      const to = slots[toIdx];

      const fromDef = from.elementType ? headerElementRegistry.get(from.elementType) : undefined;
      const toDef = to.elementType ? headerElementRegistry.get(to.elementType) : undefined;
      const fromNeed = fromDef?.defaultColSpan ?? 1;
      const toNeed = toDef?.defaultColSpan ?? 1;

      if (fromNeed > 1 && toIdx + fromNeed > slots.length) return s;
      if (toNeed > 1 && fromIdx + toNeed > slots.length) return s;

      // 1) 清空 from → 拆分多列，可能改变 toIdx
      const fromSpan = from.colSpan;
      slots[fromIdx] = { ...from, colSpan: 1, elementType: null, options: {} };
      for (let i = 1; i < fromSpan; i++) {
        slots.splice(fromIdx + i, 0, { id: generateId(), colSpan: 1, elementType: null, options: {} });
      }
      const adjToIdx = fromIdx < toIdx ? toIdx + (fromSpan - 1) : toIdx;

      // 2) 清空 to → 拆分多列
      const toSpan = slots[adjToIdx].colSpan;
      slots[adjToIdx] = { ...slots[adjToIdx], colSpan: 1, elementType: null, options: {} };
      for (let i = 1; i < toSpan; i++) {
        slots.splice(adjToIdx + i, 0, { id: generateId(), colSpan: 1, elementType: null, options: {} });
      }

      // 3) 放 to 的内容到 from 位置
      const adjFromIdx = fromIdx < adjToIdx ? fromIdx : fromIdx + (toSpan - 1);
      if (to.elementType) {
        slots[adjFromIdx] = { ...slots[adjFromIdx], colSpan: toNeed, elementType: to.elementType, options: to.options };
        if (toNeed > 1) slots.splice(adjFromIdx + 1, toNeed - 1);
      }

      // 4) 放 from 的内容到 to 位置
      const finalToIdx = slots.findIndex((sl) => sl.id === toId);
      if (finalToIdx !== -1 && from.elementType) {
        slots[finalToIdx] = { ...slots[finalToIdx], colSpan: fromNeed, elementType: from.elementType, options: from.options };
        if (fromNeed > 1) slots.splice(finalToIdx + 1, fromNeed - 1);
      }

      return { config: { ...s.config, header: { ...s.config.header, slots } } };
    }),

  selectHeaderSlot: (id: string | null) => set({ selectedHeaderSlotId: id, selectedWidgetId: null }),

  setBreakpoint: (bp: Breakpoint) => set({ currentBreakpoint: bp }),
  toggleEditor: () => set((s) => ({ isEditorVisible: !s.isEditorVisible })),
  showEditor: () => set({ isEditorVisible: true }),
  hideEditor: () => set({ isEditorVisible: false }),
  setDraggingWidget: (v: boolean) => set({ isDraggingWidget: v }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  saveConfig: () => {
    const json = JSON.stringify(get().config, null, 2);
    localStorage.setItem('hugescreen-config', json);
    return json;
  },

  loadConfig: (json: string) => {
    try {
      const raw = JSON.parse(json) as Partial<ScreenConfig> & { header?: unknown };
      // 迁移：旧版配置没有 header → 补默认值
      if (!raw.header || !(raw.header as { slots?: unknown })?.slots) {
        raw.header = createDefaultHeader();
      }
      // 清理旧版残留：screen-header 组件、row 0 的组件（现在属于固定顶栏区域）
      if (raw.widgets) {
        raw.widgets = raw.widgets.filter(
          (w: { type?: string; layout?: { row?: number } }) =>
            w.type !== 'screen-header' && (w.layout?.row ?? 1) >= 1,
        );
      }
      set({ config: raw as ScreenConfig });
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
