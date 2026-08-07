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
import { widgetRegistry, layoutEngine } from '@hugescreen/core';
import { headerElementRegistry } from '@hugescreen/widgets';
import { registerCustomComponent, unregisterCustomComponent, deepInlineSlots, setCompositeConfig } from '@hugescreen/widgets/composite';
import { generateId } from '../utils/id';
import { DEFAULT_GRID as LAYOUT_GRID } from './defaultLayout';
import defaultScreenConfig from './defaultScreenConfig.json';

// ─── 文件上传暂存（File 不可序列化，存模块级 Map）───

/** blob URL → File 映射，保存时统一上传 */
const pendingFiles = new Map<string, File>();

/** 注册待上传文件，返回 blob URL 供即时预览 */
export function stageUploadFile(file: File): string {
  const url = URL.createObjectURL(file);
  pendingFiles.set(url, file);
  return url;
}

/** 上传单个文件到服务器，返回永久 URL */
async function uploadFileToServer(file: File): Promise<string> {
  const token = localStorage.getItem('hugescreen-token');
  const formData = new FormData();
  formData.append('file', file, file.name);
  const resp = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error((err as any).error || `上传失败 HTTP ${resp.status}`);
  }
  const { url } = await resp.json();
  return url;
}

async function deleteFileFromServer(fileUrl: string): Promise<void> {
  const token = localStorage.getItem('hugescreen-token');
  const resp = await fetch('/api/upload', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ url: fileUrl }),
  });
  if (!resp.ok) throw new Error(`删除失败 HTTP ${resp.status}`);
}

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
  backgroundImage: string;   // 自定义背景图片 URL
  backgroundVideo: string;   // 自定义背景视频 URL

  setConfig: (config: ScreenConfig) => void;
  setTheme: (theme: ThemeConfig) => void;
  setGrid: (grid: GridConfig) => void;

  addWidget: (type: string, layout: WidgetLayout) => void;
  removeWidget: (id: string) => void;
  clearWidgets: () => void;
  updateWidget: (id: string, patch: Partial<WidgetConfig>) => void;
  moveWidget: (id: string, layout: WidgetLayout) => void;
  swapWidgetLayouts: (idA: string, idB: string) => void;
  resizeWidget: (id: string, layout: WidgetLayout) => void;
  selectWidget: (id: string | null) => void;
  duplicateWidget: (id: string) => void;

  // ─── 自定义组合组件（持久化定义 + 主动删除）───
  addCustomComponent: (def: CustomComponentDef) => void;
  deleteCustomComponent: (type: string) => void;
  renameCustomComponent: (type: string, newName: string) => void;

  // 顶栏槽位管理
  setHeaderSlot: (slotId: string, elementType: string | null, options?: Record<string, unknown>) => void;
  removeHeaderElement: (slotId: string) => void;
  swapHeaderSlots: (fromId: string, toId: string) => void;
  selectHeaderSlot: (id: string | null) => void;
  toggleHeader: () => void;
  setHeaderRowSpan: (n: number) => void;

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
  setBackgroundImage: (url: string) => void;
  setBackgroundVideo: (url: string) => void;

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
  lastDraggedPinId: string | null;  // 最近拖拽的地图钉实例 ID
  setLastDraggedPinId: (id: string | null) => void;

  // ─── 模板模式 ───
  currentTemplateId: string | null;
  setCurrentTemplateId: (id: string | null) => void;
  lastSavedConfig: string;  // 最近一次保存时的配置快照，供未保存检测用
  markConfigSaved: () => void;

  saveConfig: (thumbnail?: string) => string | Promise<string>;
  loadConfig: (json: string) => void;
  exportConfig: () => void;
  importConfig: () => void;
}

/**
 * R1：组件是否「被扩大过」（> 注册默认尺寸）→ 可被新落点截断。
 * 自由网格下默认尺寸组件 = 固体障碍（防意外截断回归）。
 */
export function isTruncatable(w: WidgetConfig): boolean {
  const def = widgetRegistry.get(w.type);
  const defRowSpan = def?.defaultSize?.rowSpan ?? w.layout.rowSpan;
  const defColSpan = def?.defaultSize?.colSpan ?? w.layout.colSpan;
  return w.layout.rowSpan > defRowSpan || w.layout.colSpan > defColSpan;
}

/**
 * 添加/移动组件时的反向 reflow：与目标位置重叠的「被扩大组件」收缩腾空间。
 * R1：只有扩大过的组件可截断；R2：收缩下限 = 注册 minSize，全覆盖缩回默认尺寸并锚定自身左上角。
 * 场景：
 *   I.   新组件在顶部 → 旧组件向下收缩
 *   II.  新组件在底部 → 旧组件向上收缩
 *   III. 新组件在中间 → 旧组件保留最上方部分
 *   IV.  新组件完全覆盖 → 缩回注册默认尺寸（锚定自身左上角，不移动到落点）
 */
function reflowOnAdd(widgets: WidgetConfig[], incoming: { layout: WidgetLayout }): WidgetConfig[] {
  const inc = incoming.layout;

  return widgets.map((existing) => {
    const ex = existing.layout;
    if (!layoutEngine.overlaps(
      { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
      { col: ex.col, row: ex.row, colSpan: ex.colSpan, rowSpan: ex.rowSpan },
    )) return existing;
    if (!isTruncatable(existing)) return existing;

    const def = widgetRegistry.get(existing.type);
    const defRowSpan = def?.defaultSize?.rowSpan ?? ex.rowSpan;
    const defColSpan = def?.defaultSize?.colSpan ?? ex.colSpan;
    const minRowSpan = def?.minSize?.rowSpan ?? 1;
    const minColSpan = def?.minSize?.colSpan ?? 1;

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

    // ═══ 场景 IV：新组件完全覆盖 → 缩回默认尺寸（锚定自身左上角） ═══
    if (inc.row <= ex.row && incRowEnd >= exRowEnd) {
      return { ...existing, layout: { ...ex, colSpan: defColSpan, rowSpan: defRowSpan } };
    }

    return existing;
  });
}

/**
 * R3：唯一放置路径（拖放预览与 drop 提交共用，保证预览 = 最终结果）。
 * reflow 截断可截断的冲突组件 → 仍重叠则 findFreeSlot 兜底（row ≥ 1 guard）。
 * @param others 除 incoming 外的所有组件（move 时含全部其他组件，add 时 = 全部）
 * @returns reflow 后的 others + incoming 的最终 layout
 */
export function computePlacement(
  others: WidgetConfig[],
  incoming: { layout: WidgetLayout },
  grid: GridConfig,
): { widgets: WidgetConfig[]; layout: WidgetLayout } {
  let nextWidgets = reflowOnAdd(others, incoming);
  const inc = incoming.layout;
  const stillOverlaps = nextWidgets.some((w) =>
    layoutEngine.overlaps(
      { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
      { col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan },
    ),
  );
  if (stillOverlaps) {
    const occupied = nextWidgets.map((w) => ({
      col: w.layout.col, row: w.layout.row, colSpan: w.layout.colSpan, rowSpan: w.layout.rowSpan,
    }));
    occupied.push(row0Guard(grid));
    const free = layoutEngine.findFreeSlot(
      { col: inc.col, row: inc.row, colSpan: inc.colSpan, rowSpan: inc.rowSpan },
      occupied,
      grid,
    );
    return { widgets: nextWidgets, layout: { col: free.col, row: Math.max(1, free.row), colSpan: free.colSpan, rowSpan: free.rowSpan } };
  }
  return { widgets: nextWidgets, layout: { ...inc } };
}

function createDefaultHeader(): { slots: HeaderSlotConfig[]; visible: boolean } {
  // 8 个等宽 1 列槽位；标题占 2 列(=合并 slot0+slot1)；datetime 占 1 列
  return {
    visible: true,
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
  // 使用项目默认配置 JSON，确保首次打开即展示预设的大屏布局
  const config = defaultScreenConfig as ScreenConfig;
  // 注册默认配置中的自定义组合组件
  registerCustomComponents(config);
  return config;
}

/** 遍历 config.customComponents，把自定义组合组件重新注册到组件池（加载/setConfig 时调用） */
function registerCustomComponents(config: ScreenConfig): void {
  console.log("[registerCustomComponents] customComponents count:", (config.customComponents ?? []).length, (config.customComponents ?? []).map(c => c.type));
  // Pass 1: register all components so widgetRegistry + compositeConfigStore are populated
  for (const def of config.customComponents ?? []) {
    registerCustomComponent(def);
  }
  // Pass 2: inline referenced custom composites into slots (migration for old configs + newly created)
  for (const def of config.customComponents ?? []) {
    const inlined = deepInlineSlots(def.composite);
    setCompositeConfig(def.type, inlined);
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
  backgroundImage: '',
  backgroundVideo: '',
  compositeSlotEdit: null,
  pinEditWidgetId: null,
  lastDraggedPinId: null,
  currentTemplateId: null,
  lastSavedConfig: '',
  markConfigSaved: () => set({ lastSavedConfig: JSON.stringify(get().config) }),

  setConfig: (config: ScreenConfig) => {
    registerCustomComponents(config);
    set({
      config,
      backgroundPattern: config.backgroundPattern ?? 'none',
      backgroundEffect: config.backgroundEffect ?? 'energy-flow',
      backgroundImage: (config as any).backgroundImage ?? '',
      backgroundVideo: (config as any).backgroundVideo ?? '',
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
      // ★ R3 唯一路径：reflow 截断冲突的扩大组件 → 兜底 findFreeSlot → 最终 layout
      const { widgets: others, layout: finalLayout } = computePlacement(s.config.widgets, newWidget, s.config.grid);
      newWidget.layout = finalLayout;
      return {
        config: { ...s.config, widgets: [...others, newWidget] },
        selectedWidgetId: newWidget.id,
      };
    });
  },

  removeWidget: (id: string) => {
    const state = get();
    const removed = state.config.widgets.find((w) => w.id === id);
    if (!removed) return;

    const widgets = state.config.widgets.filter((w) => w.id !== id);

    set((s) => ({
      config: { ...s.config, widgets },
      selectedWidgetId: s.selectedWidgetId === id ? null : s.selectedWidgetId,
    }));
  },

  /** 清空画布所有组件实例（编辑模式「清空屏幕」，调用方负责二次确认） */
  clearWidgets: () =>
    set((s) => ({
      config: { ...s.config, widgets: [] },
      selectedWidgetId: null,
      selectedHeaderSlotId: null,
    })),

  updateWidget: (id: string, patch: Partial<WidgetConfig>) =>
    set((s) => ({
      config: { ...s.config, widgets: s.config.widgets.map((w) =>
        w.id === id ? { ...w, ...patch } : w) },
    })),

  moveWidget: (id: string, layout: WidgetLayout) =>
    set((s) => {
      const oldWidget = s.config.widgets.find((w) => w.id === id);
      if (!oldWidget) return s;

      // ★ R3 唯一路径：others 避让（reflow 截断 + findFreeSlot 兜底）→ 最终 layout
      const incoming = { ...oldWidget, layout };
      const others = s.config.widgets.filter((w) => w.id !== id);
      const { widgets: reflowed, layout: finalLayout } = computePlacement(others, incoming, s.config.grid);
      return {
        config: { ...s.config, widgets: [...reflowed, { ...incoming, layout: finalLayout }] },
      };
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
    set((s) => {
      const self = s.config.widgets.find((w) => w.id === id);
      if (!self) return s;
      // R4：resize 只动自己，绝不整体位移 —— 不可截断障碍由预览期贴边阻挡，
      // 可截断（扩大过的）障碍在提交时由 reflow 截断腾位
      const others = s.config.widgets.filter((w) => w.id !== id);
      const incoming = { ...self, layout };
      const { widgets: reflowed } = computePlacement(others, incoming, s.config.grid);
      return {
        config: {
          ...s.config,
          widgets: [...reflowed, { ...incoming, layout }],
        },
      };
    }),

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

  // ─── 顶栏显示/隐藏 ───
  toggleHeader: () =>
    set((s) => ({
      config: {
        ...s.config,
        header: { ...s.config.header!, visible: !(s.config.header?.visible !== false) },
      },
    })),

  /** 顶栏行数（高度）：长度始终横跨全屏不可改；0.5 行步进支持细微调节，最小 0.5 行 */
  setHeaderRowSpan: (n: number) =>
    set((s) => ({
      config: { ...s.config, header: { ...s.config.header!, rowSpan: Math.max(0.5, Math.min(10, Math.round(n * 2) / 2)) } },
    })),

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
  setBackgroundImage: (url: string) =>
    set((s) => ({
      backgroundImage: url,
      config: { ...s.config, backgroundImage: url },
    })),
  setBackgroundVideo: (url: string) =>
    set((s) => ({
      backgroundVideo: url,
      config: { ...s.config, backgroundVideo: url },
    })),

  setCompositeSlotEdit: (edit) => set({ compositeSlotEdit: edit }),
  setPinEditWidgetId: (id) => set({ pinEditWidgetId: id }),
  setLastDraggedPinId: (id) => set({ lastDraggedPinId: id }),

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

  renameCustomComponent: (type, newName) => {
    set((s) => ({
      config: {
        ...s.config,
        customComponents: (s.config.customComponents ?? []).map((c) =>
          c.type === type ? { ...c, displayName: newName } : c,
        ),
      },
    }));
    // 同步更新组件池中的显示名
    const def = widgetRegistry.get(type);
    if (def) {
      widgetRegistry.register({ ...def, name: newName });
    }
  },

  setCurrentTemplateId: (id) => set({ currentTemplateId: id }),

  saveConfig: async (thumbnail?: string) => {
    const state = get();
    let config: any = { ...state.config };
    let dirty = false;

    if (thumbnail) { config.thumbnail = thumbnail; }

    // 上传待处理的本地文件
    if (state.backgroundImage && state.backgroundImage.startsWith('blob:')) {
      const file = pendingFiles.get(state.backgroundImage);
      if (file) {
        try {
          const url = await uploadFileToServer(file);
          config = { ...config, backgroundImage: url };
          pendingFiles.delete(state.backgroundImage);
          dirty = true;
        } catch { /* 上传失败，保留本地 URL */ }
      }
    }
    if (state.backgroundVideo && state.backgroundVideo.startsWith('blob:')) {
      const file = pendingFiles.get(state.backgroundVideo);
      if (file) {
        try {
          const url = await uploadFileToServer(file);
          config = { ...config, backgroundVideo: url };
          pendingFiles.delete(state.backgroundVideo);
          dirty = true;
        } catch { /* 上传失败，保留本地 URL */ }
      }
    }

    // 收集旧文件 URL + 上传视频组件暂存文件 + 清理残留
    const oldUploadUrls = new Set<string>();
    let widgetBlobsDirty = false;

    if (config.widgets) {
      const updatedWidgets = await Promise.all(config.widgets.map(async (widget: any) => {
        for (const v of ((widget.options as any).videos || (widget.options as any).images || [])) {
          const u = typeof v === 'string' ? v : v?.url;
          if (u && u.startsWith('/uploads/')) oldUploadUrls.add(u);
        }

        if (widget.type !== 'video-widget' || !Array.isArray((widget.options as any).videos)) {
          return widget;
        }

        const rawVideos: any[] = (widget.options as any).videos;
        let hasBlob = false;
        const uploaded: any[] = [];

        for (const vid of rawVideos) {
          const url = typeof vid === 'string' ? vid : vid?.url;
          if (url && url.startsWith('blob:')) {
            hasBlob = true;
            const file = pendingFiles.get(url);
            if (file) {
              // 串行上传 + 300ms 间隔避免 TCP 连接复用导致 ERR_CONNECTION_RESET
              if (uploaded.length > 0) await new Promise(r => setTimeout(r, 300));
              try {
                const newUrl = await uploadFileToServer(file);
                pendingFiles.delete(url);
                uploaded.push({ url: newUrl, pinned: true });
              } catch (e) {
                console.warn(`[save] video upload failed:`, e);
                uploaded.push(vid);
              }
            } else {
              uploaded.push(vid);
              uploaded.push(vid);
            }
          } else {
            uploaded.push(vid);
          }
        }

        if (hasBlob) widgetBlobsDirty = true;
        return { ...widget, options: { ...widget.options, videos: uploaded } };
      }));

      if (widgetBlobsDirty) {
        config = { ...config, widgets: updatedWidgets };
        dirty = true;
      }

      // 计算新引用并清理残留
      const newUploadUrls = new Set<string>();
      for (const w of updatedWidgets) {
        for (const v of ((w.options as any).videos || (w.options as any).images || [])) {
          const u = typeof v === 'string' ? v : v?.url;
          if (u && u.startsWith('/uploads/')) newUploadUrls.add(u);
        }
      }
      for (const oldUrl of oldUploadUrls) {
        if (!newUploadUrls.has(oldUrl)) {
          try {
            await deleteFileFromServer(oldUrl);
          } catch (e) {
            console.warn(`[save] cleanup failed: ${oldUrl}`, e);
          }
        }
      }
    }

    // 上传自定义边框图片（widget.style.customBorderImage + header slot customBorderImage）
    let borderBlobsDirty = false;
    if (config.widgets) {
      const borderWidgets = config.widgets.map((widget: any) => {
        const img = widget.style?.customBorderImage;
        if (!img || !img.startsWith('blob:')) return widget;
        const file = pendingFiles.get(img);
        if (!file) return widget;
        return { widget, file, img };
      }).filter(Boolean);
      for (const { widget, file, img } of borderWidgets) {
        try {
          const url = await uploadFileToServer(file);
          pendingFiles.delete(img);
          widget.style.customBorderImage = url;
          borderBlobsDirty = true;
        } catch { /* 失败保留原值 */ }
      }
    }
    if (config.header?.slots) {
      for (const slot of config.header.slots) {
        const img = slot.options?.customBorderImage;
        if (!img || !img.startsWith('blob:')) continue;
        const file = pendingFiles.get(img);
        if (!file) continue;
        try {
          const url = await uploadFileToServer(file);
          pendingFiles.delete(img);
          slot.options.customBorderImage = url;
          borderBlobsDirty = true;
        } catch { /* 失败保留原值 */ }
      }
    }
    if (borderBlobsDirty) {
      dirty = true;
    }

    // 上传自定义统计卡图标（widget.options.customIconImage）
    let iconBlobsDirty = false;
    if (config.widgets) {
      for (const widget of config.widgets) {
        const iconUrl = widget.options?.customIconImage;
        if (!iconUrl || !iconUrl.startsWith('blob:')) continue;
        const file = pendingFiles.get(iconUrl);
        if (!file) continue;
        try {
          const url = await uploadFileToServer(file);
          pendingFiles.delete(iconUrl);
          widget.options.customIconImage = url;
          iconBlobsDirty = true;
        } catch { /* 失败保留原值 */ }
      }
    }
    if (iconBlobsDirty) {
      dirty = true;
    }

    if (dirty) {
      set({ config, backgroundImage: config.backgroundImage ?? '', backgroundVideo: config.backgroundVideo ?? '' });
    }

    const json = JSON.stringify(config, null, 2);

    // 记录保存快照（无论哪种模式），供未保存检测用
    set({ lastSavedConfig: JSON.stringify(config) });

    // 模板模式：保存到 API
    if (state.currentTemplateId) {
      const token = localStorage.getItem('hugescreen-token');
      await fetch(`/api/templates/${state.currentTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ config }),
      }).catch(() => {});
      return json;
    }

    // 普通模式：localStorage
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
      // 迁移：旧版配置 header 没有 visible → 默认显示
      if (raw.header && (raw.header as unknown as Record<string, unknown>).visible === undefined) {
        (raw.header as unknown as Record<string, unknown>).visible = true;
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
        backgroundImage: (raw as any).backgroundImage ?? '',
        backgroundVideo: (raw as any).backgroundVideo ?? '',
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
}));
