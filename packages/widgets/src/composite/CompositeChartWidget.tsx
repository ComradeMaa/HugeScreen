import { createContext, useContext, useState, Suspense } from 'react';
import type { CompositeConfig } from '@hugescreen/shared';
import { widgetRegistry } from '@hugescreen/core';
import { TEMPLATE_GRID_AREAS, templateColumns, templateRows } from './types';
import { useCompositeData } from './useCompositeData';
import { getCompositeConfig } from './compositeConfigStore';

/** 嵌套深度上下文 — 防止过深嵌套导致性能问题 */
const NestDepth = createContext(0);
const MAX_DEPTH = 5;

interface CompositeChartWidgetProps {
  /** Key pointing to a stored CompositeConfig in compositeConfigStore */
  compositeKey?: string;
  /** Or a direct config (used by the builder preview, not needed for runtime) */
  composite?: CompositeConfig | null;
}

/**
 * Composite chart widget — renders sub-charts in a CSS Grid layout.
 * Looks up configuration via compositeKey in the session store.
 */
export function CompositeChartWidget({ composite, compositeKey }: CompositeChartWidgetProps) {
  const depth = useContext(NestDepth);

  // Resolve config: prefer direct composite, then key lookup
  const resolved = composite ?? (compositeKey ? getCompositeConfig(compositeKey) : null);
  const slots = resolved?.slots ?? [];
  const liveData = useCompositeData(resolved ? slots : []);

  if (depth >= MAX_DEPTH) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#f87171]/60 text-xs">
        嵌套已达上限（{MAX_DEPTH}层）
      </div>
    );
  }

  // Entry animation: bump version on first render
  const [buildVersion] = useState(() => {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 4)
      : Math.random().toString(36).slice(2, 6);
  });

  if (!resolved || slots.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#9E9EA8]/60 text-sm">
        未配置组合图表
      </div>
    );
  }

  return (
    <NestDepth.Provider value={depth + 1}>
    <div
      className="w-full h-full p-1"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${templateColumns(resolved.layoutTemplate)}, 1fr)`,
        gridTemplateRows: `repeat(${templateRows(resolved.layoutTemplate)}, 1fr)`,
        gridTemplateAreas: TEMPLATE_GRID_AREAS[resolved.layoutTemplate],
        gap: '3px',
      }}
    >
      {slots.map((slot, i) => {
        // 槽位有内联合并快照 → 直接渲染，不依赖 registry（源组件被删也不影响）
        if (slot.inlineComposite) {
          return (
            <div
              key={`${slot.id}-${buildVersion}`}
              style={{ gridArea: String.fromCharCode(97 + i) }}
              className="w-full h-full overflow-hidden"
            >
              <NestDepth.Provider value={depth + 1}>
                <CompositeChartWidget composite={slot.inlineComposite} />
              </NestDepth.Provider>
            </div>
          );
        }

        const def = widgetRegistry.get(slot.chartType);
        const SubComp = def?.component;
        const defaultCfg = def?.defaultConfig ?? {};
        const slotLiveData = liveData[slot.id];

        const mergedProps = {
          ...defaultCfg,
          ...(slot.chartOptions as object),
          ...(slotLiveData as object ?? {}),
          dataSource: slot.dataSource,
          widgetId: slot.id,
        };

        return (
          <div
            key={`${slot.id}-${buildVersion}`}
            style={{ gridArea: String.fromCharCode(97 + i) }}
            className="w-full h-full overflow-hidden"
          >
            {SubComp ? (
              <Suspense fallback={null}>
                <SubComp {...mergedProps} />
              </Suspense>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#9E9EA8]/40 text-[11px]">
                {slot.chartType}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </NestDepth.Provider>
  );
}
