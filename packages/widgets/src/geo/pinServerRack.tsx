import { SERVER_RACK_LOGO } from './serverRackLogo';

/**
 * 服务器机柜 logo 地图钉：统计卡自定义图标 /presets/icons/server-rack.svg 的
 * 简化版（贝塞尔采样 + 抽稀，657 path 彩色插图原样保留），不可替换为其他图标。
 */
export function ServerRackLogoPin({ size = 24, color }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size * (236.2 / 739.3)}
      viewBox="0 0 739.3 236.2"
      style={{ display: 'block', filter: color ? `drop-shadow(0 0 4px ${color})` : undefined }}
    >
      {SERVER_RACK_LOGO.map((p, i) => <path key={i} d={p.d} fill={p.fill} />)}
    </svg>
  );
}
