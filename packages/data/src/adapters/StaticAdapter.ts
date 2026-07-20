import type { DataSourceConfig } from '@hugescreen/shared';
import type { DataAdapter } from '../DataSourceManager';

/**
 * Static data adapter — returns config.staticData directly.
 * Used when no fetching is needed (default for most sub-charts).
 */
export class StaticAdapter implements DataAdapter {
  readonly type = 'static';
  private _connected = false;
  private _data: unknown = null;

  get connected(): boolean { return this._connected; }

  async connect(config: DataSourceConfig): Promise<void> {
    this._data = config.staticData ?? null;
    this._connected = true;
  }

  disconnect(): void {
    this._connected = false;
    this._data = null;
  }

  getData(): unknown {
    return this._data;
  }
}
