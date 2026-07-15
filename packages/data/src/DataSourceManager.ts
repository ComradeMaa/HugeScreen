import type { DataSourceConfig } from '@hugescreen/shared';
import { eventBus, Events } from '@hugescreen/core';

export interface DataAdapter {
  /** 适配器类型标识 */
  readonly type: string;
  /** 连接数据源 */
  connect(config: DataSourceConfig): Promise<void>;
  /** 断开连接 */
  disconnect(): void;
  /** 获取最新数据 */
  getData(): unknown;
  /** 是否已连接 */
  readonly connected: boolean;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

/**
 * 数据源管理器
 * 管理所有 Widget 的数据源连接，提供缓存和更新通知。
 */
export class DataSourceManager {
  private adapters = new Map<string, DataAdapter>();
  private cache = new Map<string, CacheEntry>();
  private subscriptions = new Map<string, Set<string>>(); // channel → widgetIds
  private defaultTTL = 30_000; // 30s

  /** 注册数据适配器 */
  registerAdapter(adapter: DataAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  /** 为 Widget 订阅数据通道 */
  async subscribe(widgetId: string, channel: string, config: DataSourceConfig): Promise<void> {
    // 记录订阅关系
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(widgetId);

    // 获取或创建适配器连接
    const adapterType = config.type;
    const adapter = this.adapters.get(adapterType);
    if (!adapter) {
      console.warn(`[DataSource] No adapter registered for type "${adapterType}"`);
      return;
    }

    await adapter.connect(config);
    const data = adapter.getData();

    // 更新缓存
    this.cache.set(channel, {
      data,
      timestamp: Date.now(),
      ttl: this.defaultTTL,
    });

    // 通知订阅者
    eventBus.emit(`${Events.DATA_UPDATED}:${channel}`, data);
  }

  /** 取消 Widget 订阅 */
  unsubscribe(widgetId: string, channel: string): void {
    this.subscriptions.get(channel)?.delete(widgetId);
    if (this.subscriptions.get(channel)?.size === 0) {
      this.subscriptions.delete(channel);
      // 可以在这里断开适配器连接
    }
  }

  /** 获取缓存数据 */
  getCachedData(channel: string): unknown | null {
    const entry = this.cache.get(channel);
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data;
    }
    return null;
  }

  /** 清理过期缓存 */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/** 全局单例 */
export const dataSourceManager = new DataSourceManager();
