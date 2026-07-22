import { useState, useEffect, useRef, useMemo } from 'react';
import type { WidgetConfig } from '@hugescreen/shared';
import { RESTAdapter } from '@hugescreen/data/adapters/RESTAdapter';
import { mapData } from '@hugescreen/data/transform';

// ─── 模块级 Adapter 连接池 ───
// 相同 URL 的 widget 共享一个 RESTAdapter，避免重复请求

interface PoolEntry {
  adapter: RESTAdapter;
  refs: number;
  calls: Set<(data: unknown) => void>;
}

const adapterPool = new Map<string, PoolEntry>();

function getPoolKey(ds: WidgetConfig['dataSource']): string | null {
  if (!ds || ds.type !== 'rest') return null;
  const url = ds.config?.url;
  if (!url) return null;
  // 以 URL 为 key，忽略 headers/method 差异（大多数场景够用）
  return `rest:${url}`;
}

/**
 * 为单个普通组件管理实时数据订阅。
 * 返回一个「已按组件 props 形状映射好」的对象，渲染时以最高优先级覆盖静态默认值。
 *
 *   static  → 若配置了 staticData 则映射后返回，否则返回 {}（沿用组件 options）
 *   rest    → 复用模块级 Adapter 池，相同 URL 共享连接
 *   其它     → 暂返回 {}
 *
 * dataSource 变化时自动断开旧连接、建立新连接；卸载时清理。
 */
export function useWidgetData(widget: WidgetConfig): Record<string, unknown> {
  const [liveProps, setLiveProps] = useState<Record<string, unknown>>({});

  const ds = widget.dataSource;
  const chartType = widget.type;

  // ── 稳定依赖 key：用 URL + type 做浅比较，避免 JSON.stringify 每次 render 创建新字符串 ──
  const poolKey = ds?.type === 'rest' ? `rest:${ds.config?.url || ''}` : null;
  const dsKey = poolKey || (ds?.type ?? 'none');
  const lastDsKeyRef = useRef(dsKey);

  useEffect(() => {
    const dsChanged = dsKey !== lastDsKeyRef.current;
    lastDsKeyRef.current = dsKey;

    if (!ds || ds.type === 'static') {
      setLiveProps(
        ds?.staticData != null ? mapData(ds.staticData, chartType, ds.mapping ?? {}) : {},
      );
      return;
    }

    if (ds.type === 'rest' && poolKey) {
      // ─── 连接池模式：相同 URL 复用 Adapter ───
      let entry = adapterPool.get(poolKey);
      if (!entry) {
        entry = {
          adapter: new RESTAdapter(),
          refs: 0,
          calls: new Set(),
        };
        adapterPool.set(poolKey, entry);

        // 首次连接
        entry.adapter.onData((raw) => {
          for (const cb of entry!.calls) {
            cb(raw);
          }
        });
        entry.adapter.connect(ds).catch(() => {});
      }

      entry.refs++;

      const callback = (raw: unknown) => {
        setLiveProps(mapData(raw, chartType, ds.mapping ?? {}));
      };
      entry.calls.add(callback);

      // 如果 dataSource 变了（URL 相同但其他配置变了），强制刷新
      if (dsChanged && entry.adapter.getData() != null) {
        callback(entry.adapter.getData()!);
      }

      return () => {
        entry!.calls.delete(callback);
        entry!.refs--;
        // 所有订阅者都卸载后，清理 adapter
        if (entry!.refs <= 0) {
          entry!.adapter.disconnect();
          adapterPool.delete(poolKey!);
        }
      };
    }

    // websocket 等：暂不处理
    setLiveProps({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsKey, chartType]);

  return liveProps;
}
