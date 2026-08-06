import { useState, useEffect, useRef } from 'react';
import type { CompositeSlotConfig } from '@hugescreen/shared';
import { dataHub } from '@hugescreen/data';
import { eventBus } from '@hugescreen/core';

/**
 * Hook that manages live data subscriptions per composite sub-slot.
 * Routes through DataHub — slots sharing the same URL get a single Fetcher,
 * no duplicate HTTP requests.
 *
 * Returns a map from slotId to the latest data payload (already mapped via mapData).
 *
 * ★ 实例唯一性：widgetId 必须带 instanceId（`composite:{instanceId}:{slot.id}`）——
 *   slot.id 只在单个 composite 配置内唯一，若多个实例共用（同模板两个实例、
 *   编辑器预览 + 画布实例），DataHub.subscribe 会先 unsubscribe 互相踢下线，
 *   且 initialFetch 只在首次订阅时执行 → 后实例 interval=0 时永远收不到数据。
 */
export function useCompositeData(instanceId: string, slots: CompositeSlotConfig[]): Record<string, unknown> {
  const [liveData, setLiveData] = useState<Record<string, unknown>>({});
  const subscribedRef = useRef<Map<string, { channelKey: string; handler: (data: unknown) => void; configKey: string }>>(new Map());
  const instanceIdRef = useRef(instanceId);

  useEffect(() => {
    const subscribed = subscribedRef.current;
    const currentSlotIds = new Set(slots.map(s => s.id));

    for (const slot of slots) {
      const ds = slot.dataSource;
      if (!ds || ds.type !== 'rest' || !ds.config?.url) continue;
      // 订阅过的 slot 且数据源配置未变（URL/jsonPath/method 相同）→ 沿用现有订阅
      const configKey = `${ds.config.method || 'GET'}|${ds.config.url}|${ds.config.jsonPath || ''}`;
      const existing = subscribed.get(slot.id);
      if (existing && existing.configKey === configKey) continue;

      const subId = `composite:${instanceIdRef.current}:${slot.id}`;
      console.log(`[useCompositeData] ${subId} subscribing: url=${ds.config.url} jsonPath=${ds.config.jsonPath} interval=${ds.config.interval}`);
      const channelKey = dataHub.subscribe(subId, ds, slot.chartType);

      const handler = (data: unknown) => {
        console.log(`[useCompositeData] ${subId} received data on ${channelKey}`);
        setLiveData(prev => ({
          ...prev,
          [slot.id]: data,
        }));
      };
      eventBus.on(`data:updated:${channelKey}`, handler);
      subscribed.set(slot.id, { channelKey, handler, configKey });
    }

    // Cleanup removed slots（slot 被删或数据源被清空）
    for (const [id, entry] of subscribed) {
      if (!currentSlotIds.has(id)) {
        eventBus.off(`data:updated:${entry.channelKey}`, entry.handler);
        dataHub.unsubscribe(`composite:${instanceIdRef.current}:${id}`);
        subscribed.delete(id);
      }
    }
  }, [slots]);

  // Full cleanup on unmount（含 eventBus handler — 防止实例销毁后残留监听）
  useEffect(() => () => {
    for (const [id, entry] of subscribedRef.current) {
      eventBus.off(`data:updated:${entry.channelKey}`, entry.handler);
      dataHub.unsubscribe(`composite:${instanceIdRef.current}:${id}`);
    }
    subscribedRef.current.clear();
  }, []);

  return liveData;
}
