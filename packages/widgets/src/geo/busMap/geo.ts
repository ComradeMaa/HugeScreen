/**
 * 站点坐标表（/data/bus_stations.json，GCJ-02，与高德瓦片/JS API 坐标系一致，零转换）。
 * 结构：{ version, crs, stations: {站名: {lat, lng}}, aliases: {别名: 规范名} }
 */

export interface StationFile {
  version?: number;
  crs?: string;
  stations: Record<string, { lat: number; lng: number }>;
  aliases?: Record<string, string>;
}

let stationCache: Promise<Map<string, [number, number]>> | null = null;

/** 加载站点坐标表 → Map<站名, [lng, lat]>（别名已合并进同一 Map；失败返回空表） */
export function loadStations(): Promise<Map<string, [number, number]>> {
  if (!stationCache) {
    stationCache = fetch('/data/bus_stations.json')
      .then((res) => res.json())
      .then((j: StationFile) => {
        const map = new Map<string, [number, number]>();
        for (const [name, c] of Object.entries(j.stations ?? {})) {
          if (Number.isFinite(c?.lat) && Number.isFinite(c?.lng)) map.set(name, [c.lng, c.lat]);
        }
        for (const [alias, canonical] of Object.entries(j.aliases ?? {})) {
          const c = map.get(canonical);
          if (c) map.set(alias, c);
        }
        console.log(`[busMap] stations loaded: ${map.size}`);
        return map;
      })
      .catch((err) => {
        console.warn('[busMap] stations load failed:', err);
        return new Map<string, [number, number]>();
      });
  }
  return stationCache;
}

/** 站名 → 坐标（精确名 / 别名均已入表）；未知站返回 null */
export function lookupStation(stations: Map<string, [number, number]>, name: string): [number, number] | null {
  return stations.get(name) ?? null;
}
