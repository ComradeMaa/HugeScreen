import { registerPinIcons } from './types';
import { AiOutlineDatabase, AiOutlineCloudDownload, AiOutlineBulb, AiOutlineEnvironment, AiOutlineWifi } from 'react-icons/ai';

/** 注册 react-icons 地图钉图标到 pin 图标系统 */
export function registerCustomPinIcons(): void {
  registerPinIcons({
    database: AiOutlineDatabase,
    'cloud-download': AiOutlineCloudDownload,
    bulb: AiOutlineBulb,
    environment: AiOutlineEnvironment,
    wifi: AiOutlineWifi,
  });
}
