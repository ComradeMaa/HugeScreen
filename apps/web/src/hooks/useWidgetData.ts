import { useState, useEffect, useRef } from 'react';
import type { WidgetConfig } from '@hugescreen/shared';
import { dataHub, mqttHub, mapData, type TimeWindowConfig } from '@hugescreen/data';
import { eventBus } from '@hugescreen/core';

/**
 * 为单个组件管理数据订阅。
 * 通过中央 DataHub / MqttHub 订阅数据，避免重复请求，统一 jsonPath 切片和 mapData 转换。
 *
 *   static  → 直接 mapData(staticData)，不经过 DataHub
 *   rest    → 通过 DataHub.subscribe() 订阅，EventBus 监听推送
 *   mqtt    → 通过 MqttHub.subscribe() 订阅（共享连接），EventBus 监听推送
 *   websocket → 暂返回 {}
 *
 * dataSource 变化时自动退订旧频道、订阅新频道；卸载时清理。
 */
export function useWidgetData(widget: WidgetConfig): Record<string, unknown> {
  const [liveProps, setLiveProps] = useState<Record<string, unknown>>({});

  const ds = widget.dataSource;
  const chartType = widget.type;

  // ── 配置指纹：变化时重新订阅 ──
  const dsFingerprint = (ds?.type === 'rest')
    ? JSON.stringify({ url: ds.config?.url, method: ds.config?.method, headers: ds.config?.headers, jsonPath: ds.config?.jsonPath, interval: ds.config?.interval })
    : (ds?.type === 'mqtt')
      ? JSON.stringify({ url: ds.config?.url, topics: ds.config?.topics })
      : (ds?.type ?? 'none');
  const lastFpRef = useRef(dsFingerprint);

  useEffect(() => {
    const fpChanged = dsFingerprint !== lastFpRef.current;
    lastFpRef.current = dsFingerprint;

    const tw = widget.options?.timeWindow as TimeWindowConfig | undefined;

    if (!ds || ds.type === 'static') {
      setLiveProps(
        ds?.staticData != null
          ? mapData(ds.staticData, chartType, ds.mapping ?? {}, tw)
          : {},
      );
      return;
    }

    if (ds.type === 'rest' && ds.config?.url) {
      console.log(`[useWidgetData] ${widget.id} subscribing: url=${ds.config.url} jsonPath=${ds.config.jsonPath} interval=${ds.config.interval}`);
      const channelKey = dataHub.subscribe(widget.id, ds, chartType, tw);

      const handler = (data: unknown) => {
        console.log(`[useWidgetData] ${widget.id} received data on ${channelKey}`);
        setLiveProps(data as Record<string, unknown>);
      };
      eventBus.on(`data:updated:${channelKey}`, handler);

      return () => {
        eventBus.off(`data:updated:${channelKey}`, handler);
        dataHub.unsubscribe(widget.id);
      };
    }

    if (ds.type === 'mqtt' && ds.config?.url) {
      console.log(`[useWidgetData] ${widget.id} subscribing mqtt: url=${ds.config.url} topics=${JSON.stringify(ds.config.topics)}`);
      const channelKey = mqttHub.subscribe(widget.id, ds);

      const handler = (data: unknown) => {
        setLiveProps(mapData(data, chartType, ds.mapping ?? {}) as Record<string, unknown>);
      };
      eventBus.on(`data:updated:${channelKey}`, handler);

      return () => {
        eventBus.off(`data:updated:${channelKey}`, handler);
        mqttHub.unsubscribe(widget.id);
      };
    }

    // websocket 等：暂不处理
    setLiveProps({});
  }, [dsFingerprint, chartType, widget.id, widget.options?.timeWindow]);

  return liveProps;
}
