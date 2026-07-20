import type { CompositeConfig } from '@hugescreen/shared';

/**
 * 会话级存储：保存通过构建器创建的组合图表配置。
 * 动态注册的 composite-N 组件通过 compositeKey 在此查找实际配置。
 * 刷新页面后自动清空。
 */
const compositeConfigStore = new Map<string, CompositeConfig>();

export function setCompositeConfig(key: string, config: CompositeConfig): void {
  compositeConfigStore.set(key, config);
}

export function getCompositeConfig(key: string): CompositeConfig | undefined {
  return compositeConfigStore.get(key);
}

export function deleteCompositeConfig(key: string): void {
  compositeConfigStore.delete(key);
}

export function getAllCompositeKeys(): string[] {
  return Array.from(compositeConfigStore.keys());
}
