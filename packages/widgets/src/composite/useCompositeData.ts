import { useState, useEffect, useRef } from 'react';
import type { CompositeSlotConfig } from '@hugescreen/shared';
import { dataHub, mapData } from '@hugescreen/data';
import { eventBus } from '@hugescreen/core';

/**
 * Hook that manages live data subscriptions per composite sub-slot.
 * Routes through DataHub — slots sharing the same URL get a single Fetcher,
 * no duplicate HTTP requests.
 *
 * Returns a map from slotId to the latest data payload (already mapped via mapData).
 */
export function useCompositeData(slots: CompositeSlotConfig[]): Record<string, unknown> {
  const [liveData, setLiveData] = useState<Record<string, unknown>>({});
  const subscribedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const subscribed = subscribedRef.current;
    const currentSlotIds = new Set(slots.map(s => s.id));

    for (const slot of slots) {
      const ds = slot.dataSource;
      // slot.id 不是全局唯一的 widgetId，需要合成一个全局唯一的标识
      // 使用 slot.id 本身（它在同一个 composite 内唯一，且 DataHub 用 widgetId 仅作订阅跟踪）
      const subId = `composite:${slot.id}`;

      if (!ds || ds.type !== 'rest' || !ds.config?.url || subscribed.has(slot.id)) continue;
      subscribed.add(slot.id);

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
    }

    // Cleanup removed slots
    for (const id of subscribed) {
      if (!currentSlotIds.has(id)) {
        subscribed.delete(id);
        dataHub.unsubscribe(`composite:${id}`);
      }
    }
  }, [slots]);

  // Full cleanup on unmount
  useEffect(() => () => {
    for (const id of subscribedRef.current) {
      dataHub.unsubscribe(`composite:${id}`);
    }
    subscribedRef.current.clear();
  }, []);

  return liveData;
}
