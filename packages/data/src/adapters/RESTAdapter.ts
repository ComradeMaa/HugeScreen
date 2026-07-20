import type { DataSourceConfig } from '@hugescreen/shared';
import type { DataAdapter } from '../DataSourceManager';

/**
 * REST adapter — fetches from a URL and optionally polls at an interval.
 * Stores latest data; use a listener pattern for updates.
 */
export type RESTDataCallback = (data: unknown) => void;

export class RESTAdapter implements DataAdapter {
  readonly type = 'rest';
  private _connected = false;
  private _data: unknown = null;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _abortController: AbortController | null = null;
  private _listeners: Set<RESTDataCallback> = new Set();

  get connected(): boolean { return this._connected; }

  /** Register a callback for data updates */
  onData(cb: RESTDataCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  async connect(config: DataSourceConfig): Promise<void> {
    // Guard: disconnect any previous connection first to prevent timer/controller leaks
    if (this._connected || this._timer || this._abortController) {
      this.disconnect();
    }

    const url = config.config?.url;
    if (!url) {
      console.warn('[RESTAdapter] No url provided');
      return;
    }

    const fetchData = async (): Promise<void> => {
      // Abort any in-flight request before starting a new one
      if (this._abortController) {
        this._abortController.abort();
      }
      this._abortController = new AbortController();
      const signal = this._abortController.signal;

      try {
        const resp = await fetch(url, {
          method: config.config?.method ?? 'GET',
          headers: config.config?.headers ?? {},
          signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        let json: unknown = await resp.json();

        // Apply jsonPath extraction
        if (config.config?.jsonPath && json && typeof json === 'object') {
          const parts = config.config.jsonPath.split('.');
          for (const part of parts) {
            if (json && typeof json === 'object' && part in (json as Record<string, unknown>)) {
              json = (json as Record<string, unknown>)[part];
            } else {
              json = null; break;
            }
          }
        }

        this._data = json;
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
