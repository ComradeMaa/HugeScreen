import Attachment from 'supercons/Attachment';
import Announcement from 'supercons/Announcement';
import Apps from 'supercons/Apps';
import Bank from 'supercons/Bank';
import BatteryBolt from 'supercons/BatteryBolt';
import BadgeCheck from 'supercons/BadgeCheck';
import BadgeAward from 'supercons/BadgeAward';
import Analytics from 'supercons/Analytics';
import Admin from 'supercons/Admin';
import BroadcastPin from 'supercons/BroadcastPin';
import CloudSun from 'supercons/CloudSun';

/** 预设图标注册表 */
const PRESET_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  attachment:    Attachment,
  announcement:  Announcement,
  apps:          Apps,
  bank:          Bank,
  'battery-bolt': BatteryBolt,
  'badge-check':  BadgeCheck,
  'badge-award':  BadgeAward,
  analytics:     Analytics,
  admin:         Admin,
  'broadcast-pin': BroadcastPin,
  'cloud-sun':   CloudSun,
};

export const ICON_PRESET_KEYS = Object.keys(PRESET_ICONS);

export function IconPresetRenderer({ name, size = 24 }: { name: string; size?: number }) {
  const Comp = PRESET_ICONS[name];
  if (!Comp) return null;
  return <Comp size={size} />;
}
