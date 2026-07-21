import type { MapPinIcon } from '@hugescreen/shared';

/** 预设地图钉图标的 SVG path data（24×24 viewBox） */
export const PIN_ICON_PATHS: Record<MapPinIcon, string> = {
  circle: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  diamond: 'M12 2l10 10-10 10L2 12z',
  pin: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z',
  square: 'M2 2h20v20H2z',
  triangle: 'M12 2l10 20H2z',
  hex: 'M12 2l9.5 5.5v11L12 24l-9.5-5.5v-11z',
};

/** 图标标签 */
export const PIN_ICON_LABELS: Record<MapPinIcon, string> = {
  circle: '圆形',
  diamond: '菱形',
  pin: '图钉',
  square: '方形',
  triangle: '三角',
  hex: '六边形',
};

/** 预设颜色 */
export const PIN_COLORS = ['#00D4FF', '#FF8C42', '#34d399', '#f87171', '#c084fc', '#fbbf24'];

/** 区域边界信息（从 GeoJSON 解析） */
export interface RegionBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  scale: number;
  centerX: number;
  centerZ: number;
}
