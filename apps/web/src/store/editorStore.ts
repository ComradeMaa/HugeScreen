import { create } from 'zustand';
import type {
  ScreenConfig,
  WidgetConfig,
  WidgetLayout,
  GridConfig,
  ThemeConfig,
  HeaderSlotConfig,
  CompositeSubChartType,
  CustomComponentDef,
  DataSourceConfig,
} from '@hugescreen/shared';
import {
  DEFAULT_THEME,
  DEFAULT_CANVAS,
} from '@hugescreen/shared';
import { widgetRegistry, layoutEngine } from '@hugescreen/core';
import { headerElementRegistry } from '@hugescreen/widgets';
import { registerCustomComponent, unregisterCustomComponent } from '@hugescreen/widgets/composite';
import { generateId } from '../utils/id';
import { DEFAULT_SLOTS, DEFAULT_GRID as LAYOUT_GRID, findSlotAt, type ScreenSlot } from './defaultLayout';

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
  isDraggingHeaderEl: boolean; // 是否正在拖拽顶栏元素（区分一般组件和顶栏拖拽）
  showGrid: boolean;
  snapToGrid: boolean;
  backgroundPattern: string; // 背景图案：'none' | 'globe-1' 等（同步至 config）
  backgroundEffect: string;  // 背景效果：'none' | 'energy-flow' 等（同步至 config）

  setConfig: (config: ScreenConfig) => void;
  setTheme: (theme: ThemeConfig) => void;
  setGrid: (grid: GridConfig) => void;

  addWidget: (type: string, layout: WidgetLayout) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<WidgetConfig>) => void;
  moveWidget: (id: string, layout: WidgetLayout) => void;
  swapWidgetLayouts: (idA: string, idB: string) => void;
  resizeWidget: (id: string, layout: WidgetLayout) => void;
  selectWidget: (id: string | null) => void;
  duplicateWidget: (id: string) => void;

  // ─── 自定义组合组件（持久化定义 + 主动删除）───
  addCustomComponent: (def: CustomComponentDef) => void;
  deleteCustomComponent: (type: string) => void;

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
  setDraggingHeaderEl: (v: boolean) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setBackgroundPattern: (pattern: string) => void;
  setBackgroundEffect: (effect: string) => void;

  // ─── 组合图表槽位编辑（构建窗口 → 属性面板通信）───
  compositeSlotEdit: {
    chartType: CompositeSubChartType;
    options: Record<string, unknown>;
    onUpdate: (patch: Record<string, unknown>) => void;
    dataSource?: DataSourceConfig;
    onUpdateDataSource?: (ds: DataSourceConfig) => void;
  } | null;
  setCompositeSlotEdit: (edit: {
    chartType: CompositeSubChartType;
    options: Record<string, unknown>;
    onUpdate: (patch: Record<string, unknown>) => void;
    dataSource?: DataSourceConfig;
    onUpdateDataSource?: (ds: DataSourceConfig) => void;
  } | null) => void;

  // ─── 地图钉编辑模式 ───
  pinEditWidgetId: string | null;
  setPinEditWidgetId: (id: string | null) => void;

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
      ...(slot.defaultStyle as object),
    },
  }));
}

/**
 * 删除组件后，尝试将同列相邻组件扩展填充空位。
 * 优先「下方组件上移」，其次「上方组件下扩」。
 */
function mergeSlotsAfterRemove(widgets: WidgetConfig[], removed: WidgetConfig, gridRows: number): WidgetConfig[] {
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
    const newRowSpan = rowSpan + below.layout.rowSpan;
    // Guard: ensure expanded widget stays within grid bounds
    if (row + newRowSpan <= gridRows) {
      const merged: WidgetConfig = {
        ...below,
        layout: {
          ...below.layout,
          row,
          rowSpan: newRowSpan,
        },
      };
      return widgets.map((w, i) => (i === belowIdx ? merged : w));
    }
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
    const newRowSpan = above.layout.rowSpan + rowSpan;
    // Guard: ensure expanded widget stays within grid bounds
    if (above.layout.row + newRowSpan <= gridRows) {
      const merged: WidgetConfig = {
        ...above,
        layout: {
          ...above.layout,
          rowSpan: newRowSpan,
        },
      };
      return widgets.map((w, i) => (i === aboveIdx ? merged : w));
    }
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
 *
 * ★ 兼容 swap 后的多槽位组件：组件布局跨越多个标准槽位时（即使未超过自身默认尺寸），
 *   也能被新组件截断——以标准槽位尺寸为最小阈值，而非组件默认尺寸。
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

    // ── 可分割判定 ──
    const defMinRowSpan = def?.minSize?.rowSpan ?? 1;
    const defMinColSpan = def?.minSize?.colSpan ?? 1;

    // 条件 A：组件被 merge 扩大过（rowSpan/colSpan > 默认）
    const isExpanded = ex.rowSpan > defRowSpan || ex.colSpan > defColSpan;
    // 条件 B：组件布局跨越多个标准槽位（swap 后常见：中心组件换到侧栏 2×4）
    const canonicalSlot = findSlotAt(ex.col, ex.row);
    const spansMultipleSlots = canonicalSlot
      ? (ex.colSpan * ex.rowSpan > canonicalSlot.colSpan * canonicalSlot.rowSpan)
      : false;
    // 条件 C：组件当前尺寸大于注册最小尺寸（默认尺寸较大的组件允许被新组件截断）
    const isAboveMin = ex.rowSpan > defMinRowSpan || ex.colSpan > defMinColSpan;

    // 三种条件都不满足 → 不可截断
    if (!isExpanded && !spansMultipleSlots && !isAboveMin) return existing;

    // 最小阈值：
    //   扩大过 → 用组件默认尺寸
    //   跨多槽位 → 用标准槽位尺寸
    //   仅超过最小尺寸 → 用组件注册的 minSize
    let minRowSpan: number;
    let minColSpan: number;
    if (isExpanded) {
      minRowSpan = defRowSpan;
      minColSpan = defColSpan;
    } else if (spansMultipleSlots) {
      minRowSpan = canonicalSlot?.rowSpan ?? defRowSpan;
      minColSpan = canonicalSlot?.colSpan ?? defColSpan;
    } else {
      minRowSpan = defMinRowSpan;
      minColSpan = defMinColSpan;
    }

    const incRowEnd = inc.row + inc.rowSpan;
    const exRowEnd = ex.row + ex.rowSpan;

    // ═══ 场景 I：新组件在顶部 → 旧组件向下缩 ═══
    if (inc.row <= ex.row && incRowEnd < exRowEnd) {
      const newRow = incRowEnd;
      const newRowSpan = exRowEnd - incRowEnd;
      if (newRowSpan >= minRowSpan) {
        return { ...existing, layout: { ...ex, row: newRow, rowSpan: newRowSpan } };
      }
    }

    // ═══ 场景 II：新组件在底部 → 旧组件向上缩 ═══
    if (inc.row > ex.row && incRowEnd >= exRowEnd) {
      const newRowSpan = inc.row - ex.row;
      if (newRowSpan >= minRowSpan) {
        return { ...existing, layout: { ...ex, rowSpan: newRowSpan } };
      }
    }

    // ═══ 场景 III：新组件在中间 → 旧组件保留最上方部分 ═══
    if (inc.row > ex.row && incRowEnd < exRowEnd) {
      const topRowSpan = inc.row - ex.row;
      const bottomRowSpan = exRowEnd - incRowEnd;
      if (topRowSpan >= minRowSpan || topRowSpan >= bottomRowSpan) {
        return { ...existing, layout: { ...ex, rowSpan: topRowSpan } };
      }
      if (bottomRowSpan > 0) {
        return { ...existing, layout: { ...ex, row: incRowEnd, rowSpan: bottomRowSpan } };
      }
    }

    // ═══ 场景 IV：新组件完全覆盖已扩大的组件 → 缩回默认尺寸 ═══
    // （仅限真正被 merge 扩大的组件；swap 产生的多槽位不由场景 IV 处理，交由 findFreeSlot 转移）
    if (isExpanded && inc.row <= ex.row && incRowEnd >= exRowEnd) {
      return { ...existing, layout: { ...ex, row: inc.row, rowSpan: defRowSpan, col: inc.col, colSpan: defColSpan } };
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
    backgroundPattern: 'none',
    backgroundEffect: 'energy-flow',
    customComponents: [],
  };
}

/** 遍历 config.customComponents，把自定义组合组件重新注册到组件池（加载/setConfig 时调用） */
function registerCustomComponents(config: ScreenConfig): void {
  console.log("[registerCustomComponents] customComponents count:", (config.customComponents ?? []).length, (config.customComponents ?? []).map(c => c.type));
  for (const def of config.customComponents ?? []) {
    registerCustomComponent(def);
  }
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  config: createInitialConfig(),
  currentBreakpoint: 'desktop',
  selectedWidgetId: null,
  selectedHeaderSlotId: null,
  isEditorVisible: false,  // 默认隐藏编辑器 → 展示态
  isDraggingWidget: false,
  isDraggingHeaderEl: false,
  showGrid: true,
  snapToGrid: true,
  backgroundPattern: 'none',
  backgroundEffect: 'energy-flow',
  compositeSlotEdit: null,
  pinEditWidgetId: null,

  setConfig: (config: ScreenConfig) => {
    registerCustomComponents(config);
    set({
      config,
      backgroundPattern: config.backgroundPattern ?? 'none',
      backgroundEffect: config.backgroundEffect ?? 'energy-flow',
    });
  },

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
    widgets = mergeSlotsAfterRemove(widgets, removed, state.config.grid.rows);

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

      // 1. 从旧位置移除（不做合并 — merge 仅限于 delete 操作）
      let widgets = s.config.widgets.map((w) => w.id === id ? { ...w, layout } : w);

      // 2. 重叠守卫：如果新位置与其他组件重叠 → 调整
      const inc = layout;
      const others = widgets.filter((w) => w.id !== id);
      const overlaps = others.find((w) =>
        layoutEngine.overlaps(
          { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
          { col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan },
        ),
      );
      if (overlaps) {
        // 尝试 reflow：如果重叠的是已扩大的组件，缩回默认尺寸
        widgets = reflowOnAdd(widgets, widgets.find((w) => w.id === id)!);
        // reflow 后仍重叠 → findFreeSlot 兜底
        const stillOverlaps = widgets.filter((w) => w.id !== id).some((w) =>
          layoutEngine.overlaps(
            { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
            { col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan },
          ),
        );
        if (stillOverlaps) {
          const occupied = widgets.filter((w) => w.id !== id).map((w) => ({
            col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan,
          }));
          occupied.push(row0Guard(s.config.grid));
          const free = layoutEngine.findFreeSlot(
            { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
            occupied,
            s.config.grid,
          );
          const idx = widgets.findIndex((w) => w.id === id);
          if (idx !== -1) {
            widgets[idx] = { ...widgets[idx], layout: { col: free.col, row: Math.max(1, free.row), colSpan: free.colSpan, rowSpan: free.rowSpan } };
          }
        }
      }
      return { config: { ...s.config, widgets } };
    }),

  /** 原子交换两个组件的布局（不做 merge/reflow，纯位置互换） */
  swapWidgetLayouts: (idA: string, idB: string) =>
    set((s) => {
      const a = s.config.widgets.find((w) => w.id === idA);
      const b = s.config.widgets.find((w) => w.id === idB);
      if (!a || !b) return s;
      const widgets = s.config.widgets.map((w) => {
        if (w.id === idA) return { ...w, layout: { ...b.layout } };
        if (w.id === idB) return { ...w, layout: { ...a.layout } };
        return w;
      });
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

      // ★ 拒绝：多列组件放在末尾（计入旧多列拆分后扩充的槽位数）
      const oldSpan = slots[idx].colSpan;
      const expandedLen = slots.length + (oldSpan > 1 ? oldSpan - 1 : 0);
      if (needCols > 1 && idx + needCols > expandedLen) return s;

      // 先清除旧槽位的合并状态（如果之前有占用多列）
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

      return { config: { ...s.config, header: { ...s.config.header, slots } }, selectedHeaderSlotId: slotId };
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

      return {
        config: { ...s.config, header: { ...s.config.header, slots } },
        selectedHeaderSlotId: s.selectedHeaderSlotId === slotId ? null : s.selectedHeaderSlotId,
      };
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

      // ★ 先保存内容，避免后续 splice 丢失引用
      const fromType = from.elementType;
      const fromOpts = from.options;
      const toType = to.elementType;
      const toOpts = to.options;

      const fromDef = fromType ? headerElementRegistry.get(fromType) : undefined;
      const toDef = toType ? headerElementRegistry.get(toType) : undefined;
      const fromNeed = fromDef?.defaultColSpan ?? 1;
      const toNeed = toDef?.defaultColSpan ?? 1;

      if (fromNeed > 1 && toIdx + fromNeed > slots.length) return s;
      if (toNeed > 1 && fromIdx + toNeed > slots.length) return s;

      // ★ 验证合并范围内没有非空槽位（防止静默覆盖其他组件）
      const mergeSlotsEmpty = (start: number, count: number, excludeA: string, excludeB: string) => {
        for (let i = 0; i < count; i++) {
          const sl = slots[start + i];
          if (!sl) return false;
          if (sl.elementType && sl.id !== excludeA && sl.id !== excludeB) return false;
        }
        return true;
      };
      if (!mergeSlotsEmpty(toIdx, fromNeed, fromId, toId)) return s;
      if (toType && !mergeSlotsEmpty(fromIdx, toNeed, fromId, toId)) return s;

      // 1) 清空 from → 拆分多列
      const fromSpan = from.colSpan;
      slots[fromIdx] = { ...from, colSpan: 1, elementType: null, options: {} };
      for (let i = 1; i < fromSpan; i++) {
        slots.splice(fromIdx + i, 0, { id: generateId(), colSpan: 1, elementType: null, options: {} });
      }
      let adjToIdx = fromIdx < toIdx ? toIdx + (fromSpan - 1) : toIdx;

      // 2) 清空 to → 拆分多列
      const toSpan = slots[adjToIdx].colSpan;
      slots[adjToIdx] = { ...slots[adjToIdx], colSpan: 1, elementType: null, options: {} };
      for (let i = 1; i < toSpan; i++) {
        slots.splice(adjToIdx + i, 0, { id: generateId(), colSpan: 1, elementType: null, options: {} });
      }

      // 3) ★ 先放 from 到 to 位置（避免 step 3 splice 误删 toId → step 4 findIndex 失败）
      const toPos = slots.findIndex((sl) => sl.id === toId);
      if (toPos !== -1 && fromType) {
        slots[toPos] = { ...slots[toPos], colSpan: fromNeed, elementType: fromType, options: fromOpts };
        if (fromNeed > 1) slots.splice(toPos + 1, fromNeed - 1);
      }

      // 4) 再放 to 到 from 位置（重新查找，因为 step 3 可能改变了索引）
      const fromPos = slots.findIndex((sl) => sl.id === fromId);
      if (fromPos !== -1 && toType) {
        slots[fromPos] = { ...slots[fromPos], colSpan: toNeed, elementType: toType, options: toOpts };
        if (toNeed > 1) slots.splice(fromPos + 1, toNeed - 1);
      }

      // 选中项跟随元素移动
      let nextSelected = s.selectedHeaderSlotId;
      if (s.selectedHeaderSlotId === fromId) nextSelected = toId;
      else if (s.selectedHeaderSlotId === toId && toType) nextSelected = fromId;

      return { config: { ...s.config, header: { ...s.config.header, slots } }, selectedHeaderSlotId: nextSelected };
    }),

  selectHeaderSlot: (id: string | null) => set({ selectedHeaderSlotId: id, selectedWidgetId: null }),

  setBreakpoint: (bp: Breakpoint) => set({ currentBreakpoint: bp }),
  toggleEditor: () => set((s) => ({ isEditorVisible: !s.isEditorVisible })),
  showEditor: () => set({ isEditorVisible: true }),
  hideEditor: () => set({ isEditorVisible: false }),
  setDraggingWidget: (v: boolean) => set({ isDraggingWidget: v }),
  setDraggingHeaderEl: (v: boolean) => set({ isDraggingHeaderEl: v }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  setBackgroundPattern: (pattern: string) =>
    set((s) => ({
      backgroundPattern: pattern,
      config: { ...s.config, backgroundPattern: pattern },
    })),
  setBackgroundEffect: (effect: string) =>
    set((s) => ({
      backgroundEffect: effect,
      config: { ...s.config, backgroundEffect: effect },
    })),

  setCompositeSlotEdit: (edit) => set({ compositeSlotEdit: edit }),
  setPinEditWidgetId: (id) => set({ pinEditWidgetId: id }),

  addCustomComponent: (def) => {
    registerCustomComponent(def);
    set((s) => {
      const existing = s.config.customComponents ?? [];
      const customComponents = existing.some((c) => c.type === def.type)
        ? existing.map((c) => (c.type === def.type ? def : c))
        : [...existing, def];
      return { config: { ...s.config, customComponents } };
    });
  },

  deleteCustomComponent: (type) => {
    unregisterCustomComponent(type);
    // 方案 b：级联删除画布上所有该类型实例
    set((s) => ({
      config: {
        ...s.config,
        widgets: s.config.widgets.filter((w) => w.type !== type),
        customComponents: (s.config.customComponents ?? []).filter((c) => c.type !== type),
      },
      selectedWidgetId: null,
    }));
  },

  saveConfig: () => {
    const config = get().config;
    const json = JSON.stringify(config, null, 2);
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
        raw.widgets = raw.widgets
          .filter(
            (w: { type?: string; layout?: { row?: number } }) =>
              w.type !== 'screen-header' && (w.layout?.row ?? 1) >= 1,
          )
          // 迁移：bar-chart-h → bar-chart（条形图已合并入柱状图）
          .map((w: any) =>
            w.type === 'bar-chart-h'
              ? { ...w, type: 'bar-chart', options: { ...w.options, direction: 'horizontal' } }
              : w,
          );
      }
      console.log("[loadConfig] customComponents from localStorage:", (raw.customComponents ?? []).length, (raw.customComponents ?? []).map(c => c.type));
      registerCustomComponents(raw as ScreenConfig);
      set({
        config: raw as ScreenConfig,
        backgroundPattern: (raw as ScreenConfig).backgroundPattern ?? 'none',
        backgroundEffect: (raw as ScreenConfig).backgroundEffect ?? 'energy-flow',
      });
    } catch { console.error('[EditorStore] Failed to parse config JSON'); }
  },

  exportConfig: () => {
    const config = get().config;
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${config.name}.json`;
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
