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
    // ★ 与普通组件统一：最小 2×2（与组件池内其他组件一致），最大可铺满整个界面
    minSize: { colSpan: 2, rowSpan: 2 },
    maxSize: { colSpan: 99, rowSpan: 99 },
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
