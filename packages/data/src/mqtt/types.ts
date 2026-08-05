/** 公交线路元数据（bus/meta/lines 主题，retained） */
export interface BusLine {
  id: number;
  name: string;
  direction: string;
  stations: string[];
  buses: string[];
}

/** 车辆实时位置（bus/{line_id}/{bus_no}/position 主题，retained，~1s/辆） */
export interface BusPosition {
  line_id: number;
  line: string;
  bus: string;
  current_station: string;
  next_station: string;
  remaining_stops: number;
  status: '行驶中' | '停靠中';
  timestamp: string; // "YYYY-MM-DD HH:mm:ss" 东八区
}

/** MqttHub 推送给订阅者的规范化快照（mapData 按需再做字段映射） */
export interface BusSnapshot {
  lines: BusLine[];
  /** key = `${line_id}/${bus}`，覆盖更新即去重 */
  buses: Record<string, BusPosition>;
  online: boolean;     // bus/status retained 'online' | 'offline'
  connected: boolean;  // mqtt.js 传输层连接状态
  updatedAt: number;
}
