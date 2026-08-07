import { createContext, useContext, useState, Suspense } from 'react';
import type { CompositeConfig } from '@hugescreen/shared';
import { widgetRegistry } from '@hugescreen/core';
import { mergePreservingMeta } from '@hugescreen/data';
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
  /** 浏览模式交互透传（WidgetBody 传入；成员组件如 3D 地图据此启用拖拽旋转/悬停高亮） */
  interactive?: boolean;
}

/**
 * Composite chart widget — renders sub-charts in a CSS Grid layout.
 * Looks up configuration via compositeKey in the session store.
 */
export function CompositeChartWidget({ composite, compositeKey, interactive = false }: CompositeChartWidgetProps) {
  const depth = useContext(NestDepth);

  // Resolve config: prefer direct composite, then key lookup
  const resolved = composite ?? (compositeKey ? getCompositeConfig(compositeKey) : null);
  const slots = resolved?.slots ?? [];
  // ★ 实例唯一 id：多个实例（同模板/预览+画布）共用 slot.id，DataHub 订阅必须按实例隔离，
  //   否则 subscribe 会先 unsubscribe 互相踢下线（interval=0 时后实例永远收不到数据）
  const [instanceId] = useState(() => {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  });
  const liveData = useCompositeData(instanceId, resolved ? slots : []);

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
                <CompositeChartWidget composite={slot.inlineComposite} interactive={interactive} />
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
          // ★ 保留 per-item 元数据（showLabelLine / pinned）—— 与独立组件共用
          //   @hugescreen/data 的 mergePreservingMeta，否则数据源刷新会把勾选覆盖掉
          ...mergePreservingMeta(
            (slotLiveData ?? {}) as Record<string, unknown>,
            (slot.chartOptions as Record<string, unknown>) ?? {},
            slot.chartType,
          ),
          dataSource: slot.dataSource,
          widgetId: slot.id,
          // ★ 浏览模式交互透传（3D 组件据此启用旋转/悬停；编辑模式 false 与 dnd-kit 无冲突）
          interactive,
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
