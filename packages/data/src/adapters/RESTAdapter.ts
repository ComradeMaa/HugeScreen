import type { DataSourceConfig } from '@hugescreen/shared';
import type { DataAdapter } from '../DataSourceManager';
import { getByPath } from '../transform/jsonPath';

/**
 * REST adapter — fetches from a URL and optionally polls at an interval.
 * Stores latest data; use a listener pattern for updates.
 */
/** Strip corrupted token prefixes, return clean Authorization header */
function normalizeAuthHeader(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'authorization') {
      let t = v.trim();
      const ai = t.toLowerCase().indexOf('authorization:');
      if (ai !== -1) t = t.slice(ai + 14).trim();
      if (t.toLowerCase().startsWith('bearer ')) t = t.slice(7);
      if (t) out[k] = 'Bearer ' + t;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export type RESTDataCallback = (data: unknown) => void;

export class RESTAdapter implements DataAdapter {
  readonly type = 'rest';
  private _connected = false;
  private _data: unknown = null;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _abortController: AbortController | null = null;
  private _listeners: Set<RESTDataCallback> = new Set();

  get connected(): boolean { return this._connected; }

  /** 是否已启动轮询计时器 */
  hasPolling(): boolean { return this._timer != null; }

  /** Register a callback for data updates */
  onData(cb: RESTDataCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  async connect(config: DataSourceConfig): Promise<void> {
    const url = config.config?.url;
    if (!url) {
      console.warn('[RESTAdapter] No url provided');
      return;
    }

    // 重连时仅清理定时器和进行中的请求，保留监听器列表
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._abortController) { this._abortController.abort(); this._abortController = null; }
    this._connected = false;

    const fetchData = async (): Promise<void> => {
      // Abort any in-flight request before starting a new one
      if (this._abortController) {
        this._abortController.abort();
      }
      this._abortController = new AbortController();
      const signal = this._abortController.signal;

      try {
        // Normalize headers — clean any token corruption from earlier bugs
        const rawHeaders = config.config?.headers ?? {};
        const cleanHeaders = normalizeAuthHeader(rawHeaders);
        const resp = await fetch(url, {
          method: config.config?.method ?? 'GET',
          headers: cleanHeaders,
          signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        let json: unknown = await resp.json();

        // Apply jsonPath extraction (supports dot + array index, e.g. items[0].value)
        if (config.config?.jsonPath) {
          json = getByPath(json, config.config.jsonPath) ?? null;
        }

        this._data = json;
        console.log(`[RESTAdapter] fetch ok: url=${url} polling=${!!this._timer}`);
        this._listeners.forEach(cb => cb(json));
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn(`[RESTAdapter] Fetch failed for ${url}:`, err);
      }
    };

    // Initial fetch
    await fetchData();

    // Only mark connected after initial fetch succeeds
    this._connected = true;

    // Poll at interval if configured
    const interval = config.config?.interval;
    if (interval && interval > 0) {
      this._timer = setInterval(fetchData, interval);
    }
  }

  disconnect(): void {
    this._connected = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._abortController) { this._abortController.abort(); this._abortController = null; }
    this._listeners.clear();
    this._data = null;
  }

  getData(): unknown {
    return this._data;
  }
}
