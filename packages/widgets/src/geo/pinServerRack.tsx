/**
 * 服务器机柜 logo 地图钉：统计卡自定义图标 /presets/icons/server-rack.svg 原样渲染。
 * ★ 用 <img> 直接渲染原 SVG 文件而非内联 657 path —— 浏览器栅格化一次，
 *   拖拽只移动图片（内联 657 path 每帧重渲染会耗尽主线程 → 界面卡死）。
 * ★ 原图为彩色 logo，color 参数仅作用于阴影（无法染色，保持原样忠实）。
 */
export function ServerRackLogoPin({ size = 24, color }: { size?: number; color?: string }) {
  return (
    <img
      src="/presets/icons/server-rack.svg"
      width={size}
      height={size * (960 / 540)}
      style={{ display: 'block', filter: color ? `drop-shadow(0 0 4px ${color})` : undefined }}
      draggable={false}
      alt=""
    />
  );
}
