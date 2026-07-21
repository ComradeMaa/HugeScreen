import { useState, useEffect } from 'react';
import type { WidgetConfig } from '@hugescreen/shared';
import { RESTAdapter } from '@hugescreen/data/adapters/RESTAdapter';
import { mapData } from '@hugescreen/data/transform';

/**
 * 为单个普通组件管理实时数据订阅。
 * 返回一个「已按组件 props 形状映射好」的对象，渲染时以最高优先级覆盖静态默认值。
 *
 *   static  → 若配置了 staticData 则映射后返回，否则返回 {}（沿用组件 options）
 *   rest    → 创建 RESTAdapter，onData 时用 mapData 转换为 props 后 setState
 *   其它     → 暂返回 {}
 *
 * dataSource 变化时自动断开旧连接、建立新连接；卸载时清理。
 */
export function useWidgetData(widget: WidgetConfig): Record<string, unknown> {
  const [liveProps, setLiveProps] = useState<Record<string, unknown>>({});

  const ds = widget.dataSource;
  const chartType = widget.type;
  const dsKey = JSON.stringify(ds ?? null);

  useEffect(() => {
    if (!ds || ds.type === 'static') {
      setLiveProps(
        ds?.staticData != null ? mapData(ds.staticData, chartType, ds.mapping ?? {}) : {},
      );
      return;
    }

    if (ds.type === 'rest') {
      const adapter = new RESTAdapter();
      const unsub = adapter.onData((raw) => {
        setLiveProps(mapData(raw, chartType, ds.mapping ?? {}));
      });
      adapter.connect(ds).then(() => {
        console.log('[useWidgetData] adapter connected, initial data:', adapter.getData());
      }).catch((err) => {
      });
      return () => {
        unsub();
        adapter.disconnect();
      };
    }

    // websocket 等：暂不处理
    setLiveProps({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsKey, chartType]);

  return liveProps;
}
