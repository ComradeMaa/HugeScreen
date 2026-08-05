import { AMAP_KEY, AMAP_SECURITY_CODE } from './amapConfig';

/**
 * 动态加载高德 JS API 2.0 — 模块级单例，多个 bus-map 实例共享一次加载。
 * 安全密钥需在 script 加载前注入（高德要求 window._AMapSecurityConfig 先行）。
 */
let amapPromise: Promise<unknown> | null = null;

export function loadAmap(): Promise<unknown> {
  const w = window as unknown as Record<string, unknown>;
  if (w.AMap) return Promise.resolve(w.AMap);
  if (amapPromise) return amapPromise;

  if (AMAP_SECURITY_CODE) {
    (w as Record<string, unknown>)._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
  }
  if (!AMAP_KEY || AMAP_KEY.startsWith('PASTE_')) {
    amapPromise = Promise.reject(new Error('未配置高德 key（packages/widgets/src/geo/busMap/amapConfig.ts）'));
    return amapPromise;
  }

  amapPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // Driving 是 JS API 插件，需在 script URL 中显式加载
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(AMAP_KEY)}&plugin=AMap.Driving`;
    s.async = true;
    s.onload = () => {
      if (w.AMap) resolve(w.AMap);
      else reject(new Error('AMap 脚本加载完成但 window.AMap 缺失'));
    };
    s.onerror = () => {
      amapPromise = null; // 允许重试
      reject(new Error('高德地图脚本加载失败（检查 key / 网络）'));
    };
    document.head.appendChild(s);
  });
  return amapPromise;
}
