import { widgetRegistry } from '@hugescreen/core';
import type { CustomComponentDef } from '@hugescreen/shared';
import { CompositeChartWidget } from './CompositeChartWidget';
import { setCompositeConfig, deleteCompositeConfig } from './compositeConfigStore';

/**
 * 把一个自定义组合组件注册到组件池，并回填其配置到运行时 store。
 * editorStore 在 setConfig/loadConfig 时对 config.customComponents 逐个调用，
 * 构建器提交新组件时也调用 —— 单一注册路径，保证「持久化定义」与「运行时注册」一致。
 */
export function registerCustomComponent(def: CustomComponentDef): void {
  setCompositeConfig(def.type, def.composite);
  widgetRegistry.register({
    type: def.type,
    name: def.displayName,
    description: '自定义组合组件',
    icon: 'LayoutDashboard',
    category: 'custom',
    defaultSize: def.defaultSize ?? { colSpan: 4, rowSpan: 4 },
    minSize: { colSpan: 3, rowSpan: 3 },
    maxSize: { colSpan: 8, rowSpan: 6 },
    component: CompositeChartWidget,
    configSchema: { type: 'object', properties: { compositeKey: { type: 'string', title: '组合标识' } } },
    defaultConfig: { compositeKey: def.type },
  });
}

/** 注销自定义组合组件（删除定义 + 运行时配置） */
export function unregisterCustomComponent(type: string): void {
  deleteCompositeConfig(type);
  widgetRegistry.unregister(type);
}
