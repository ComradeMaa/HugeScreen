/**
 * DataHub — 中央数据层单例
 *
 * 职责：
 *   1. 管理所有 DataFetcher（每个唯一 URL 一个）
 *   2. Widget 通过 subscribe() 声明数据需求，DataHub 去重合并请求
 *   3. 收到数据后统一执行 jsonPath 切片 + mapData 转换
 *   4. 通过 EventBus 按 channelKey 推送给订阅的 Widget
 *
 * 主动/被动模式：
 *   interval > 0  → 主动轮询（Fetcher 取所有 subscriber 的最短间隔）
 *   interval = 0  → 首次拉取后进入被动接受（仅响应 forceRefresh）
 *
 * 节流：同一 Fetcher 以最短 interval 轮询，各 subscriber 按自己的 interval 节流接收
 */

import { eventBus } from '@hugescreen/core';
import { mapData, getByPath } from './transform';
import type { DataSourceConfig } from '@hugescreen/shared';

// ─── 类型 ───

export interface SubEntry {
  widgetId: string;
  channelKey: string;
  jsonPath?: string;
  chartType: string;
  mapping: Record<string, string>;
  /** 该 subscriber 自己的轮询间隔 (ms)，0 = 被动模式 */
  interval: number;
  lastPushTime: number;
}

/**
 * 一个 DataFetcher 管理一个唯一 URL 的所有订阅者。
 * 直接使用 fetch()，不依赖 RESTAdapter（避免 listener 管理冲突）。
 */
class DataFetcher {
  private url: string;
  private method: string;
  private headers: Record<string, string>;

  private subs = new Map<string, SubEntry>();  // widgetId → SubEntry
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _activePollingInterval = 0;
  private _fetching = false;
  private _initPromise: Promise<void> | null = null; // 共享首次 fetch，防止并发请求
  private _initialFetchDone = false;                 // 首次 fetch 成功后不再重复

  constructor(url: string, method: string, headers: Record<string, string>) {
    this.url = url;
    this.method = method;
    this.headers = headers;
  }

  // ─── 订阅管理 ───

  addSubscriber(entry: SubEntry): void {
    this.subs.set(entry.widgetId, entry);
    this.recalcPolling();
  }

  removeSubscriber(widgetId: string): boolean {
    this.subs.delete(widgetId);
    if (this.subs.size === 0) {
      this.destroy();
      return true; // 告知 DataHub 可以删掉此 Fetcher
    }
    this.recalcPolling();
    return false;
  }

  getSubscriber(widgetId: string): SubEntry | undefined {
    return this.subs.get(widgetId);
  }

  get subscriberCount(): number {
    return this.subs.size;
  }

  // ─── 轮询管理 ───

  private recalcPolling(): void {
    const intervals: number[] = [];
    for (const sub of this.subs.values()) {
      if (sub.interval > 0) intervals.push(sub.interval);
    }
    const newInterval = intervals.length > 0 ? Math.min(...intervals) : 0;

    if (newInterval !== this._activePollingInterval) {
      this._activePollingInterval = newInterval;
      this.restartPolling();
    }
  }

  private restartPolling(): void {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    if (this._activePollingInterval > 0) {
      console.log(`[DataHub] ${this.url} polling START: every ${this._activePollingInterval}ms`);
      this._pollTimer = setInterval(() => this.fetchAndDispatch(), this._activePollingInterval);
    } else {
      console.log(`[DataHub] ${this.url} polling STOP (no active intervals)`);
    }
  }

  // ─── 数据获取与分发 ───

  /** 启动时拉取首次数据 — 已完成则跳过，进行中则共享 Promise */
  initialFetch(): Promise<void> {
    if (this._initialFetchDone) {
      console.log(`[DataHub] ${this.url} initialFetch: already done, skipped`);
      return Promise.resolve();
    }
    if (this._initPromise) {
      console.log(`[DataHub] ${this.url} initialFetch: sharing in-flight promise`);
      return this._initPromise;
    }
    console.log(`[DataHub] ${this.url} initialFetch: starting FIRST fetch (subs=${this.subs.size})`);
    this._initPromise = this.doFetch().then(() => {
      this._initialFetchDone = true;
    }).catch(() => {}).finally(() => {
      this._initPromise = null;
    });
    return this._initPromise;
  }

  /** 轮询触发 */
  private async fetchAndDispatch(): Promise<void> {
    if (this._fetching) return;
    this._fetching = true;
    try {
      await this.doFetch();
    } finally {
      this._fetching = false;
    }
  }

  private _fetchCount = 0;

  private async doFetch(): Promise<void> {
    this._fetchCount++;
    const n = this._fetchCount;
    console.log(`[DataHub] ▶ FETCH #${n} START  ${this.url} (subs=${this.subs.size}, polling=${this._activePollingInterval}ms)`);
    const headers = this.cleanHeaders(this.headers);
    const resp = await fetch(this.url, { method: this.method, headers });
    if (!resp.ok) {
      console.warn(`[DataHub] ✗ FETCH #${n} FAIL  ${this.url} HTTP ${resp.status}`);
      return;
    }
    const raw: unknown = await resp.json();
    console.log(`[DataHub] ✓ FETCH #${n} DONE  ${this.url} → dispatching to ${this.subs.size} subs`);
    this.dispatch(raw);
  }

  /** 分发原始数据给所有 subscriber — 按 channelKey 去重，每个频道只 emit 一次 */
  dispatch(raw: unknown, bypassThrottle = false): void {
    const now = Date.now();
    // 按 channelKey 分组，取最短节流间隔
    const channelGroups = new Map<string, SubEntry[]>();
    for (const sub of this.subs.values()) {
      const list = channelGroups.get(sub.channelKey) || [];
      list.push(sub);
      channelGroups.set(sub.channelKey, list);
    }

    for (const [chKey, subs] of channelGroups) {
      // 取该频道所有 subscriber 中最短的 interval 作为节流依据
      const minInterval = subs.reduce((min, s) => s.interval > 0 ? Math.min(min, s.interval) : min, Infinity);
      const effectiveInterval = minInterval === Infinity ? 0 : minInterval;

      // 节流检查（使用第一个 subscriber 的 lastPushTime）
      if (!bypassThrottle && effectiveInterval > 0 && (now - subs[0].lastPushTime) < effectiveInterval) {
        continue;
      }

      // 用第一个 subscriber 的配置做切片和转换（同频道 = 同 URL + 同 jsonPath，配置相同）
      const sub = subs[0];
      const slice = sub.jsonPath ? getByPath(raw, sub.jsonPath) : raw;

      let transformed: unknown;
      try {
        transformed = mapData(slice, sub.chartType, sub.mapping);
      } catch (err) {
        console.warn(`[DataHub] mapData failed for ${sub.chartType}:`, err);
        continue;
      }

      // 更新所有同频道 subscriber 的 lastPushTime
      for (const s of subs) { s.lastPushTime = now; }

      // 每个频道只 emit 一次，同一频道的所有监听器同时收到
      eventBus.emit(`data:updated:${chKey}`, transformed);
    }
  }

  /** 只推送给指定的一个 subscriber（forceRefresh 使用） */
  dispatchTo(sub: SubEntry, raw: unknown, bypassThrottle = true): void {
    const slice = sub.jsonPath ? getByPath(raw, sub.jsonPath) : raw;
    let transformed: unknown;
    try {
      transformed = mapData(slice, sub.chartType, sub.mapping);
    } catch (err) {
      console.warn(`[DataHub] mapData failed for ${sub.chartType}:`, err);
      return;
    }
    sub.lastPushTime = Date.now();
    eventBus.emit(`data:updated:${sub.channelKey}`, transformed);
  }

  // ─── 强制刷新 ───

  /** 只为指定 widgetId 拉取一次并推送，不经过节流，不影响其他 subscriber */
  async forceRefresh(widgetId: string): Promise<void> {
    const sub = this.subs.get(widgetId);
    if (!sub) return;
    try {
      const headers = this.cleanHeaders(this.headers);
      const resp = await fetch(this.url, { method: this.method, headers });
      if (!resp.ok) {
        console.warn(`[DataHub] forceRefresh failed: ${this.url} HTTP ${resp.status}`);
        return;
      }
      const raw: unknown = await resp.json();
      this.dispatchTo(sub, raw, true);
    } catch (err) {
      console.warn(`[DataHub] forceRefresh error for ${this.url}:`, err);
    }
  }

  // ─── 工具 ───

  private cleanHeaders(h: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(h)) {
      if (k.toLowerCase() === 'authorization') {
        let t = v.trim();
        const ai = t.toLowerCase().indexOf('authorization:');
        if (ai !== -1) t = t.slice(ai + 14).trim();
        if (t.toLowerCase().startsWith('bearer ')) t = t.slice(7);
        if (t) out['Authorization'] = 'Bearer ' + t;
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  destroy(): void {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    this._activePollingInterval = 0;
    this._initialFetchDone = false;
    this.subs.clear();
  }
}

// ─── DataHub 单例 ───

class DataHub {
  private fetchers = new Map<string, DataFetcher>();    // urlKey → DataFetcher
  private widgetFetcherMap = new Map<string, string>();  // widgetId → urlKey

  /** 生成 URL 唯一键（url + method + headers 确定一个 Fetcher） */
  private urlKey(ds: DataSourceConfig, widgetId?: string): string {
    const u = ds.config?.url || '';
    const m = ds.config?.method || 'GET';
    const h = JSON.stringify(ds.config?.headers || {});
    const base = `${m}:${u}:${this.hashStr(h)}`;
    // 独立请求模式：urlKey 加上 widgetId，每个 Widget 独立 Fetcher
    if ((ds.config as any)?.independent && widgetId) {
      return `${base}:indep:${widgetId}`;
    }
    return base;
  }

  /** 生成频道键（urlKey + jsonPath 确定一个数据频道） */
  private channelKey(urlKey: string, jsonPath?: string): string {
    return `${urlKey}::${jsonPath || 'root'}`;
  }

  private hashStr(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
  }

  // ─── 公共 API ───

  /**
   * Widget 订阅数据。
   * @returns channelKey — Widget 用它监听 EventBus `data:updated:{channelKey}`
   */
  subscribe(widgetId: string, ds: DataSourceConfig, chartType: string): string {
    // 先退订旧的（如果 widget 之前订阅过另一个 URL）
    this.unsubscribe(widgetId);

    const uKey = this.urlKey(ds, widgetId);
    const chKey = this.channelKey(uKey, ds.config?.jsonPath);

    // 找到或创建 Fetcher
    let fetcher = this.fetchers.get(uKey);
    if (!fetcher) {
      fetcher = new DataFetcher(
        ds.config?.url || '',
        ds.config?.method || 'GET',
        ds.config?.headers || {},
      );
      this.fetchers.set(uKey, fetcher);
    }

    const subEntry: SubEntry = {
      widgetId,
      channelKey: chKey,
      jsonPath: ds.config?.jsonPath,
      chartType,
      mapping: ds.mapping || {},
      interval: ds.config?.interval ?? 0,
      lastPushTime: 0,
    };

    fetcher.addSubscriber(subEntry);
    this.widgetFetcherMap.set(widgetId, uKey);

    console.log(`[DataHub] subscribe: widget=${widgetId} urlKey=${uKey} chanKey=${chKey} fetcherSubs=${fetcher.subscriberCount} newFetcher=${this.fetchers.get(uKey) === fetcher && fetcher.subscriberCount === 1}`);

    // 首次拉取（doFetch 内部会 dispatch 给所有 subscriber，包括刚加的）
    fetcher.initialFetch().catch(() => {});

    return chKey;
  }

  /** Widget 退订 */
  unsubscribe(widgetId: string): void {
    const uKey = this.widgetFetcherMap.get(widgetId);
    if (!uKey) return;
    this.widgetFetcherMap.delete(widgetId);

    const fetcher = this.fetchers.get(uKey);
    if (!fetcher) return;

    const isEmpty = fetcher.removeSubscriber(widgetId);
    if (isEmpty) {
      this.fetchers.delete(uKey);
    }
  }

  /** 强制刷新 — 只为该 widget 拉一次并推送 */
  async forceRefresh(widgetId: string): Promise<void> {
    const uKey = this.widgetFetcherMap.get(widgetId);
    if (!uKey) return;
    const fetcher = this.fetchers.get(uKey);
    if (!fetcher) return;
    await fetcher.forceRefresh(widgetId);
  }

  /** 测试连接 — 独立于订阅生命周期，纯一次性 fetch + mapData */
  async testFetch(ds: DataSourceConfig, chartType?: string): Promise<unknown> {
    const url = ds.config?.url;
    if (!url) throw new Error('URL is required');

    const headers = this.normalizeTestHeaders(ds.config?.headers || {});
    const method = ds.config?.method || 'GET';

    const resp = await fetch(url, { method, headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw: unknown = await resp.json();

    if (chartType) {
      const slice = ds.config?.jsonPath ? getByPath(raw, ds.config.jsonPath) : raw;
      return mapData(slice, chartType, ds.mapping || {});
    }
    return raw;
  }

  private normalizeTestHeaders(h: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(h)) {
      if (k.toLowerCase() === 'authorization') {
        let t = v.trim();
        const ai = t.toLowerCase().indexOf('authorization:');
        if (ai !== -1) t = t.slice(ai + 14).trim();
        if (t.toLowerCase().startsWith('bearer ')) t = t.slice(7);
        if (t) out['Authorization'] = 'Bearer ' + t;
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}

export const dataHub = new DataHub();
