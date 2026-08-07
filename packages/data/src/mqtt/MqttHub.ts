/**
 * MqttHub — MQTT 数据中枢（镜像 DataHub 的 eventBus channelKey 模式）
 *
 * 职责：
 *   1. 每个 broker（url + topics 组合）维护一个共享 mqtt.js 客户端
 *   2. Widget 通过 subscribe() 声明数据需求，多个 Widget 共享同一连接
 *   3. 累积 MQTT 推送状态（lines / buses / online / connected）
 *   4. 100ms 节流后通过 eventBus 按 channelKey 推送快照
 *
 * 与 DataHub 的差异：MQTT 是服务器推送（retained），无需轮询；
 * 状态是累积的（每辆车一条消息覆盖更新），不是一次性响应。
 */

import mqtt, { type MqttClient } from 'mqtt';
import { eventBus } from '@hugescreen/core';
import type { DataSourceConfig } from '@hugescreen/shared';
import type { BusLine, BusPosition, BusSnapshot } from './types';

// ─── 常量 ───

export const DEFAULT_MQTT_TOPICS = ['bus/meta/lines', 'bus/+/+/position', 'bus/status'];

const EMIT_THROTTLE_MS = 100;
const POSITION_TOPIC_RE = /^bus\/([^/]+)\/([^/]+)\/position$/;

function normalizeTopics(topics?: string[]): string[] {
  const list = (topics && topics.length > 0 ? topics : DEFAULT_MQTT_TOPICS)
    .map((t) => t.trim()).filter(Boolean);
  return [...new Set(list)];
}

// ─── 单个 broker 连接 ───

class MqttConnection {
  readonly channelKey: string;
  private readonly url: string;
  private readonly topics: string[];
  private client: MqttClient | null = null;
  private subscribers = new Set<string>(); // widgetId

  // 累积状态
  private lines: BusLine[] = [];
  private buses = new Map<string, BusPosition>();
  private online = false;
  private onlineKnown = false; // 是否已收到过 bus/status（防初始误报离线）
  private connected = false;

  private _emitTimer: ReturnType<typeof setTimeout> | null = null;

  // 周期统计（每 10s 汇总数据接收情况，供数据链路测试）
  private _statMsgs = 0;
  private _statTimer: ReturnType<typeof setInterval> | null = null;

  // 页面可见性监听（文档推荐时序：页面隐藏/离开时 client.end()，恢复时重连）
  private _visHandler: (() => void) | null = null;

  constructor(url: string, topics: string[]) {
    this.url = url;
    this.topics = topics;
    this.channelKey = `mqtt::${url}::${[...topics].sort().join(',')}`;
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }

  addSubscriber(widgetId: string): void {
    this.subscribers.add(widgetId);
    if (!this.client) this.connect();
  }

  removeSubscriber(widgetId: string): boolean {
    this.subscribers.delete(widgetId);
    if (this.subscribers.size === 0) {
      this.destroy();
      return true;
    }
    return false;
  }

  // ─── 连接管理 ───

  private connect(): void {
    console.log(`[MqttHub] connecting ${this.url} topics=${this.topics.join(',')}`);
    const client = mqtt.connect(this.url, {
      keepalive: 30,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clean: true,
      clientId: 'hugescreen-' + Math.random().toString(36).slice(2, 10),
    });
    this.client = client;

    client.on('connect', () => {
      console.log(`[MqttHub] connected ${this.url}`);
      this.connected = true;
      // retained 消息会在订阅后立即重放（mqtt.js 重连自动重新订阅）
      client.subscribe(this.topics, { qos: 1 }, (err) => {
        if (err) console.warn(`[MqttHub] subscribe failed: ${err.message}`);
        else console.log(`[MqttHub] subscribed ${this.topics.length} topics`);
      });
      this.scheduleEmit();
    });
    client.on('reconnect', () => console.log(`[MqttHub] reconnecting ${this.url}`));
    client.on('close', () => {
      this.connected = false;
      this.scheduleEmit();
    });
    client.on('offline', () => {
      this.connected = false;
      this.scheduleEmit();
    });
    client.on('error', (err) => console.warn(`[MqttHub] error: ${err.message}`));

    client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    // 周期统计：数据接收情况（消息率/车辆数/线路数/连接状态）
    this._statTimer = setInterval(() => {
      console.log(`[MqttHub] 统计: 10s 内消息 ${this._statMsgs} 条 (${(this._statMsgs / 10).toFixed(1)}/s) · 车辆 ${this.buses.size} · 线路 ${this.lines.length} · online=${this.online} connected=${this.connected}`);
      this._statMsgs = 0;
    }, 10000);

    // 页面隐藏 → 主动断开；恢复可见 → 重连（retained 秒级重放数据，累积状态保留不闪烁）
    if (!this._visHandler) {
      this._visHandler = () => this.handleVisibilityChange();
      document.addEventListener('visibilitychange', this._visHandler);
      window.addEventListener('pagehide', this._visHandler);
    }
  }

  /** 页面可见性切换：隐藏断开连接（保留累积状态），恢复时重连 */
  private handleVisibilityChange(): void {
    if (document.hidden || document.visibilityState === 'hidden') {
      if (this.client && this.subscribers.size > 0) {
        console.log(`[MqttHub] page hidden → end client ${this.url} (state kept)`);
        this.client.end(true);
        this.client = null;
        this.connected = false;
        this.scheduleEmit();
      }
      return;
    }
    if (!this.client && this.subscribers.size > 0) {
      console.log(`[MqttHub] page visible → reconnect ${this.url}`);
      this.connect();
    }
  }

  // ─── 消息路由 ───

  private handleMessage(topic: string, payload: Buffer): void {
    this._statMsgs++;
    const text = payload.toString('utf8');
    if (topic === 'bus/meta/lines') {
      try {
        const arr = JSON.parse(text) as unknown;
        if (Array.isArray(arr)) {
          this.lines = arr.filter(
            (l): l is BusLine => !!l && typeof l === 'object' && Array.isArray((l as BusLine).stations),
          );
        }
      } catch {
        console.warn(`[MqttHub] bad lines payload on ${topic}`);
      }
      this.scheduleEmit();
      return;
    }

    if (topic === 'bus/status') {
      this.online = text.trim() === 'online';
      this.onlineKnown = true;
      this.scheduleEmit();
      return;
    }

    if (POSITION_TOPIC_RE.test(topic)) {
      try {
        const pos = JSON.parse(text) as Partial<BusPosition>;
        if (pos && typeof pos === 'object' && pos.line_id != null && pos.bus != null && pos.current_station) {
          this.buses.set(`${pos.line_id}/${pos.bus}`, pos as BusPosition);
          this.scheduleEmit();
        }
      } catch {
        console.warn(`[MqttHub] bad position payload on ${topic}`);
      }
    }
  }

  // ─── 节流推送 ───

  private scheduleEmit(): void {
    if (this._emitTimer) clearTimeout(this._emitTimer);
    this._emitTimer = setTimeout(() => {
      this._emitTimer = null;
      this.emitSnapshot();
    }, EMIT_THROTTLE_MS);
  }

  private emitSnapshot(): void {
    const snapshot: BusSnapshot = {
      lines: this.lines,
      buses: Object.fromEntries(this.buses),
      online: this.online,
      onlineKnown: this.onlineKnown,
      connected: this.connected,
      updatedAt: Date.now(),
    };
    eventBus.emit(`data:updated:${this.channelKey}`, snapshot);
  }

  destroy(): void {
    if (this._emitTimer) { clearTimeout(this._emitTimer); this._emitTimer = null; }
    if (this._visHandler) {
      document.removeEventListener('visibilitychange', this._visHandler);
      window.removeEventListener('pagehide', this._visHandler);
      this._visHandler = null;
    }
    if (this._statTimer) { clearInterval(this._statTimer); this._statTimer = null; }
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.lines = [];
    this.buses.clear();
    this.online = false;
    this.connected = false;
    console.log(`[MqttHub] destroyed ${this.channelKey}`);
  }
}

// ─── MqttHub 单例 ───

class MqttHub {
  private connections = new Map<string, MqttConnection>(); // cfgKey → connection
  private widgetConnMap = new Map<string, string>();       // widgetId → cfgKey

  /** Widget 订阅 MQTT 数据源。@returns channelKey — Widget 监听 eventBus `data:updated:{channelKey}` */
  subscribe(widgetId: string, ds: DataSourceConfig): string {
    this.unsubscribe(widgetId);

    const url = ds.config?.url || '';
    const topics = normalizeTopics(ds.config?.topics);
    const cfgKey = `${url}::${topics.join(',')}`;

    let conn = this.connections.get(cfgKey);
    if (!conn) {
      conn = new MqttConnection(url, topics);
      this.connections.set(cfgKey, conn);
    }
    conn.addSubscriber(widgetId);
    this.widgetConnMap.set(widgetId, cfgKey);

    console.log(`[MqttHub] subscribe widget=${widgetId} chanKey=${conn.channelKey} subs=${conn.subscriberCount}`);
    return conn.channelKey;
  }

  /** Widget 退订；最后一个订阅者离开时断开连接并清空状态 */
  unsubscribe(widgetId: string): void {
    const cfgKey = this.widgetConnMap.get(widgetId);
    if (!cfgKey) return;
    this.widgetConnMap.delete(widgetId);

    const conn = this.connections.get(cfgKey);
    if (!conn) return;
    if (conn.removeSubscriber(widgetId)) {
      this.connections.delete(cfgKey);
    }
  }

  /**
   * 测试连接：独立临时客户端，订阅后等待 ~2s 统计各主题消息数，随后断开。
   * 不进入共享连接池，不影响正式订阅。
   */
  testConnection(url: string, topics: string[]): Promise<{ ok: boolean; msg: string; counts?: Record<string, number> }> {
    const cleanTopics = normalizeTopics(topics);
    return new Promise((resolve) => {
      if (!url) { resolve({ ok: false, msg: '请先填写连接地址' }); return; }
      const client = mqtt.connect(url, {
        keepalive: 15,
        reconnectPeriod: 0,      // 测试不重连
        connectTimeout: 8000,
        clean: true,
        clientId: 'hugescreen-test-' + Math.random().toString(36).slice(2, 8),
      });
      const counts: Record<string, number> = {};
      let subscribed = false;

      const done = (ok: boolean, msg: string) => {
        try { client.end(true); } catch { /* noop */ }
        resolve({ ok, msg, counts });
      };

      client.on('connect', () => {
        console.log(`[MqttHub] test connect ${url}`);
        client.subscribe(cleanTopics, { qos: 1 }, (err) => {
          if (err) { done(false, `订阅失败: ${err.message}`); return; }
          subscribed = true;
          // 等 2s 收 retained + 实时消息
          setTimeout(() => {
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            const summary = Object.entries(counts).map(([t, n]) => `${t} ×${n}`).join(', ') || '无消息';
            done(true, total > 0 ? `连接成功 · ${summary}` : '连接成功，但 2s 内未收到消息（检查主题）');
          }, 2000);
        });
      });
      client.on('message', (topic) => {
        counts[topic] = (counts[topic] || 0) + 1;
      });
      client.on('error', (err) => {
        done(false, `连接失败: ${err.message}`);
      });
      client.on('offline', () => {
        if (!subscribed) done(false, '连接失败（无法建立连接）');
      });
    });
  }
}

export const mqttHub = new MqttHub();
