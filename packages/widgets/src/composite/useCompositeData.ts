import { useState, useEffect, useRef } from 'react';
import type { CompositeSlotConfig } from '@hugescreen/shared';
import { RESTAdapter } from '@hugescreen/data/adapters/RESTAdapter';
import { mapData } from '@hugescreen/data/transform';
// WebSocket adapter available for future use

/**
 * Hook that manages live data subscriptions per composite sub-slot.
 * Returns a map from slotId to the latest data payload (already mapped to the
 * sub-chart's prop shape via mapData). Only disconnects removed slots; unchanged
 * slots keep their connections.
 */
export function useCompositeData(slots: CompositeSlotConfig[]): Record<string, unknown> {
  const [liveData, setLiveData] = useState<Record<string, unknown>>({});
  const adaptersRef = useRef<Map<string, RESTAdapter>>(new Map());
  const unsubsRef = useRef<Map<string, () => void>>(new Map());

  // Selective connect/disconnect — only changed slots are affected
  useEffect(() => {
    const adapters = adaptersRef.current;
    const unsubs = unsubsRef.current;

    // Disconnect adapters for removed slots only
    const currentSlotIds = new Set(slots.map(s => s.id));
    for (const [id, adapter] of adapters) {
      if (!currentSlotIds.has(id)) {
        adapter.disconnect();
        adapters.delete(id);
        unsubs.get(id)?.();
        unsubs.delete(id);
      }
    }

    // Connect new slots that have REST data sources
    for (const slot of slots) {
      const ds = slot.dataSource;
      if (!ds || ds.type !== 'rest' || adapters.has(slot.id)) continue;

      const adapter = new RESTAdapter();
      adapters.set(slot.id, adapter);

      const unsub = adapter.onData((data) => {
        setLiveData(prev => ({
          ...prev,
          [slot.id]: mapData(data, slot.chartType, slot.dataSource?.mapping ?? {}),
        }));
      });
      unsubs.set(slot.id, unsub);

      adapter.connect(ds).catch(() => {
        // Will retry on next poll interval
      });
    }
  }, [slots]);

  // Full cleanup only on unmount
  useEffect(() => () => {
    const adapters = adaptersRef.current;
    const unsubs = unsubsRef.current;
    for (const [, adapter] of adapters) { adapter.disconnect(); }
    adapters.clear();
    for (const [, unsub] of unsubs) { unsub(); }
    unsubs.clear();
  }, []);

  return liveData;
}
