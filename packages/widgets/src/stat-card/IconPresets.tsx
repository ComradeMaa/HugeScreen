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
import Clock from 'supercons/Clock';
import Compass from 'supercons/Compass';
import Components from 'supercons/Components';
import Controls from 'supercons/Controls';
import Diagram3 from 'supercons/Diagram3';
import Explore from 'supercons/Explore';
import Flag from 'supercons/Flag';
import MapPin from 'supercons/MapPin';
import Wifi from 'supercons/Wifi';
import { AiFillAccountBook, AiFillFolderOpen, AiFillIeCircle, AiFillOpenAI, AiOutlineCopy, AiOutlineDesktop, AiOutlineDownload, AiOutlineFire, AiOutlineFlag, AiOutlineFundProjectionScreen, AiOutlineGlobal, AiOutlineLineChart, AiOutlinePhone, AiOutlineWarning, AiTwotoneDatabase } from 'react-icons/ai';
import { BsCpu, BsDatabaseFill, BsFillRouterFill } from 'react-icons/bs';
import { IoIosPhonePortrait } from 'react-icons/io';

/** 预设图标注册表 */
const PRESET_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  attachment:     Attachment,
  announcement:   Announcement,
  apps:           Apps,
  bank:           Bank,
  'battery-bolt': BatteryBolt,
  'badge-check':  BadgeCheck,
  'badge-award':  BadgeAward,
  analytics:      Analytics,
  admin:          Admin,
  'broadcast-pin': BroadcastPin,
  'cloud-sun':    CloudSun,
  clock:          Clock,
  compass:        Compass,
  components:     Components,
  controls:       Controls,
  'diagram-3':    Diagram3,
  explore:        Explore,
  flag:           Flag,
  'map-pin':      MapPin,
  wifi:           Wifi,
  'account-book':        AiFillAccountBook,
  'folder-open':         AiFillFolderOpen,
  'ie-circle':           AiFillIeCircle,
  'openai':              AiFillOpenAI,
  'copy':                AiOutlineCopy,
  'desktop':             AiOutlineDesktop,
  'download':            AiOutlineDownload,
  'fire':                AiOutlineFire,
  'outline-flag':        AiOutlineFlag,
  'projection-screen':   AiOutlineFundProjectionScreen,
  'global':              AiOutlineGlobal,
  'line-chart':          AiOutlineLineChart,
  'phone':               AiOutlinePhone,
  'warning':             AiOutlineWarning,
  'database':            AiTwotoneDatabase,
  'cpu':                 BsCpu,
  'database-fill':       BsDatabaseFill,
  'router':              BsFillRouterFill,
  'phone-portrait':      IoIosPhonePortrait,
};

export const ICON_PRESET_KEYS = Object.keys(PRESET_ICONS);

export function IconPresetRenderer({ name, size = 24 }: { name: string; size?: number }) {
  const Comp = PRESET_ICONS[name];
  if (!Comp) return null;
  return <Comp size={size} />;
}
