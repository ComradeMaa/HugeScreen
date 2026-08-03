import type { MapPinIcon } from '@hugescreen/shared';
import type { ComponentType } from 'react';

/** 预设地图钉图标的 SVG path data（24×24 viewBox） */
export const PIN_ICON_PATHS: Record<string, string> = {
  pulse: 'M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  tower: 'M12 22l-6-10 3-2v-4h2v2l-1.5 1 3 5 3-5-1.5-1v-2h2v4l3 2z',
};

/** react-icons 地图钉注册表 */
let _pinCustomIcons: Record<string, ComponentType<{ size?: number; color?: string }>> | null = null;
export function registerPinIcons(icons: Record<string, ComponentType<{ size?: number; color?: string }>>) { _pinCustomIcons = icons; }
export function getPinCustomIcon(name: string) { return _pinCustomIcons?.[name]; }

/** 所有可用图标名（内置 + 自定义） */
export function getPinIconKeys(): string[] {
  return [...Object.keys(PIN_ICON_PATHS), ...Object.keys(_pinCustomIcons ?? {})];
}

/** 图标标签（内置 + 自定义） */
export function getPinIconLabel(key: string): string {
  const builtin: Record<string, string> = { pulse: '脉冲', tower: '基站' };
  return builtin[key] ?? key;
}

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
