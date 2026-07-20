import { useState, useEffect, useRef } from 'react';
import type { CompositeSlotConfig } from '@hugescreen/shared';
import { RESTAdapter } from '@hugescreen/data/adapters/RESTAdapter';
// WebSocket adapter available for future use

/**
 * Hook that manages live data subscriptions per composite sub-slot.
 * Returns a map from slotId to the latest data payload.
 */
export function useCompositeData(slots: CompositeSlotConfig[]): Record<string, unknown> {
  const [liveData, setLiveData] = useState<Record<string, unknown>>({});
  const adaptersRef = useRef<Map<string, RESTAdapter>>(new Map());
  const unsubsRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const adapters = adaptersRef.current;
    const unsubs = unsubsRef.current;

    // Clean up adapters for removed slots
    const currentSlotIds = new Set(slots.map(s => s.id));
    for (const [id, adapter] of adapters) {
      if (!currentSlotIds.has(id)) {
        adapter.disconnect();
        adapters.delete(id);
        unsubs.get(id)?.();
        unsubs.delete(id);
      }
    }

    // Connect new/updated slots with REST data sources
    for (const slot of slots) {
      const ds = slot.dataSource;
      if (!ds || ds.type !== 'rest' || adapters.has(slot.id)) continue;

      const adapter = new RESTAdapter();
      adapters.set(slot.id, adapter);

      const unsub = adapter.onData((data) => {
        setLiveData(prev => ({ ...prev, [slot.id]: data }));
      });
      unsubs.set(slot.id, unsub);

      adapter.connect(ds).catch(() => {
        // Will retry on next poll interval
      });
    }

    return () => {
      for (const [, adapter] of adapters) { adapter.disconnect(); }
      adapters.clear();
      for (const [, unsub] of unsubs) { unsub(); }
      unsubs.clear();
    };
  }, [slots]);

  return liveData;
}
