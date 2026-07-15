export type EventHandler<T = unknown> = (payload: T) => void;

/**
 * 轻量级事件总线
 * 用于组件间解耦通信（数据更新通知、3D→2D 联动等）
 */
class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  /** 订阅事件 */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /** 取消订阅 */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as EventHandler);
  }

  /** 发布事件（无等待） */
  emit<T = unknown>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    });
  }

  /** 销毁所有监听 */
  clear(): void {
    this.listeners.clear();
  }
}

/** 全局单例 */
export const eventBus = new EventBus();

// ─── 预设事件名 ───

export const Events = {
  DATA_UPDATED: 'data:updated',
  WIDGET_ADDED: 'widget:added',
  WIDGET_REMOVED: 'widget:removed',
  WIDGET_SELECTED: 'widget:selected',
  WIDGET_MOVED: 'widget:moved',
  WIDGET_RESIZED: 'widget:resized',
  CONFIG_CHANGED: 'config:changed',
  THEME_CHANGED: 'theme:changed',
  BREAKPOINT_CHANGED: 'breakpoint:changed',
  WS_CONNECTED: 'ws:connected',
  WS_DISCONNECTED: 'ws:disconnected',
} as const;
