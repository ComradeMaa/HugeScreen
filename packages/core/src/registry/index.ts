import type { WidgetCategory } from '@hugescreen/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = any;

export interface WidgetDefinition {
  /** 唯一标识，如 'line-chart' */
  type: string;
  /** 显示名称 */
  name: string;
  /** 简要描述 */
  description: string;
  /** Lucide 图标名称 */
  icon: string;
  /** 分类 */
  category: WidgetCategory;
  /** 默认尺寸（网格单位） */
  defaultSize: { colSpan: number; rowSpan: number };
  /** 最小尺寸 */
  minSize: { colSpan: number; rowSpan: number };
  /** 最大尺寸 */
  maxSize: { colSpan: number; rowSpan: number };
  /** 展示态渲染组件 (React.lazy 导入) */
  component: AnyComponent;
  /** 编辑器中的缩略预览 */
  thumbnail?: AnyComponent;
  /** 属性配置 JSON Schema */
  configSchema: Record<string, unknown>;
  /** 默认配置值 */
  defaultConfig: Record<string, unknown>;
  /** 移动端降级策略 */
  mobile?: {
    render: 'simplified' | 'hidden';
    simplifiedComponent?: AnyComponent;
  };
}

class WidgetRegistry {
  private widgets = new Map<string, WidgetDefinition>();
  private categoryOrder: WidgetCategory[] = ['stat', 'chart', 'table', '3d', 'media', 'decorator', 'custom'];

  /** 注册一个组件 */
  register(def: WidgetDefinition): void {
    if (this.widgets.has(def.type)) {
      console.warn(`[Registry] Widget type "${def.type}" already registered, overwriting.`);
    }
    this.widgets.set(def.type, def);
  }

  /** 批量注册 */
  registerAll(defs: WidgetDefinition[]): void {
    defs.forEach(d => this.register(d));
  }

  /** 获取组件定义 */
  get(type: string): WidgetDefinition | undefined {
    return this.widgets.get(type);
  }

  /** 获取全部组件 */
  getAll(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  /** 按分类获取 */
  getByCategory(category: WidgetCategory): WidgetDefinition[] {
    return this.getAll().filter(w => w.category === category);
  }

  /** 按分类分组 */
  getGroupedByCategory(): Map<WidgetCategory, WidgetDefinition[]> {
    const grouped = new Map<WidgetCategory, WidgetDefinition[]>();
    for (const cat of this.categoryOrder) {
      const items = this.getByCategory(cat);
      if (items.length > 0) grouped.set(cat, items);
    }
    return grouped;
  }

  /** 注销组件 */
  unregister(type: string): boolean {
    return this.widgets.delete(type);
  }

  /** 清空 */
  clear(): void {
    this.widgets.clear();
  }
}

/** 全局单例 */
export const widgetRegistry = new WidgetRegistry();
