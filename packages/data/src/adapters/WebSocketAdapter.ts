import type { DataSourceConfig } from '@hugescreen/shared';
import type { DataAdapter } from '../DataSourceManager';

export type WSDataCallback = (data: unknown) => void;

/**
 * WebSocket adapter — connects to a WS endpoint with exponential backoff reconnection.
 */
export class WebSocketAdapter implements DataAdapter {
  readonly type = 'websocket';
  private _connected = false;
  private _data: unknown = null;
  private _ws: WebSocket | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectDelay = 1000;
  private _maxReconnectDelay = 30000;
  private _url: string = '';
  private _listeners: Set<WSDataCallback> = new Set();

  get connected(): boolean { return this._connected; }

  onData(cb: WSDataCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  /** Connect to a WebSocket endpoint. Resolves when the handshake completes, rejects on failure. */
  async connect(config: DataSourceConfig): Promise<void> {
    const url = config.config?.url;
    if (!url) {
      console.warn('[WSAdapter] No url provided');
      return;
    }

    // Guard: disconnect any previous connection first
    if (this._ws || this._connected) {
      this.disconnect();
    }

    this._url = url;

    // Return a promise that resolves on open, rejects on error
    return new Promise<void>((resolve, reject) => {
      try {
        this._ws = new WebSocket(url);
      } catch (err) {
        console.warn(`[WSAdapter] Failed to create WebSocket for ${url}`);
        reject(err);
        return;
      }

      this._ws.onopen = () => {
        this._connected = true;
        this._reconnectDelay = 1000;
        resolve();
      };

      this._ws.onmessage = (event: MessageEvent) => {
        try {
          const json = JSON.parse(event.data);
          this._data = json;
          this._listeners.forEach(cb => cb(json));
        } catch {
          this._data = event.data;
          this._listeners.forEach(cb => cb(event.data));
        }
      };

      this._ws.onclose = () => {
        this._connected = false;
        this._scheduleReconnect();
      };

      this._ws.onerror = () => {
        // If not yet connected (handshake phase), reject the connect promise
        if (!this._connected) {
          reject(new Error(`[WSAdapter] Connection failed for ${url}`));
        }
        // Otherwise, onclose will fire next and trigger reconnect
      };
    });
  }

  private _scheduleReconnect(): void {
    this._reconnectTimer = setTimeout(() => {
      this.connect({ type: 'websocket', config: { url: this._url }, mapping: {} });
    }, this._reconnectDelay);
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxReconnectDelay);
  }

  disconnect(): void {
    this._connected = false;
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this._ws) { this._ws.onclose = null; this._ws.close(); this._ws = null; }
    this._listeners.clear();
    this._data = null;
    this._reconnectDelay = 1000;
  }

  getData(): unknown { return this._data; }
}
