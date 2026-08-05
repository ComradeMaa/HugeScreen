/**
 * 演示数据 — 仅当组件数据源为 static（未配置 MQTT）时用于编辑器预览。
 * 站点名取自真实数据源的 16 个镇江站点；坐标运行时从 bus_stations.json 解析。
 */

import type { BusLine, BusPosition } from '@hugescreen/data';

export const DEMO_LINES: BusLine[] = [
  {
    id: 1,
    name: '1路',
    direction: '金山公园 → 江苏大学',
    stations: ['金山公园', '中山西路', '中山桥', '大市口', '青云门', '梦溪广场', '江苏大学'],
    buses: ['D101', 'D102', 'D103'],
  },
  {
    id: 2,
    name: '2路',
    direction: '火车站北广场 → 江大东站',
    stations: ['火车站北广场', '中山桥', '大市口', '解放桥', '南门汽车站', '江大东站'],
    buses: ['D201', 'D202'],
  },
];

const CYCLE_MS = 8000; // 每站用时（模拟）

function fmtTs(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 演示车辆行驶进度（0..1，与 demoBuses 同一时间基准） */
export function demoProgress(busKey: string, now: number): number {
  const busNo = busKey.split('/')[1];
  for (const line of DEMO_LINES) {
    const bi = line.buses.indexOf(busNo);
    if (bi < 0) continue;
    const n = line.stations.length;
    const pos = ((now / CYCLE_MS) + bi * 5.3) % n;
    return pos - Math.floor(pos);
  }
  return 0;
}

/** 生成演示车辆快照：每辆车沿线循环推进，到站停靠片刻再行驶 */
export function demoBuses(now: number): Record<string, BusPosition> {
  const out: Record<string, BusPosition> = {};
  for (const line of DEMO_LINES) {
    const n = line.stations.length;
    line.buses.forEach((b, bi) => {
      const offset = bi * 5.3; // 车辆错峰
      const pos = ((now / CYCLE_MS) + offset) % n;
      const i = Math.floor(pos);
      const frac = pos - i;
      const cur = line.stations[i];
      const next = line.stations[(i + 1) % n];
      const status: '行驶中' | '停靠中' = frac < 0.2 ? '停靠中' : '行驶中';
      out[`${line.id}/${b}`] = {
        line_id: line.id,
        line: line.name,
        bus: b,
        current_station: cur,
        next_station: next,
        remaining_stops: Math.max(0, n - 1 - i),
        status,
        timestamp: fmtTs(now),
      };
    });
  }
  return out;
}
