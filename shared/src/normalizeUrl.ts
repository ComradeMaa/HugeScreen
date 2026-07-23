/**
 * URL 规范化 — 自动将已知外部 API 转为代理路径，
 * 用户粘贴原始 URL 即可使用，无需手动改写。
 */
const PROXY_MAP: [string, string][] = [
  ['https://geo.datav.aliyun.com', '/geodata'],
  ['http://geo.datav.aliyun.com', '/geodata'],
  ['https://overpass-api.de', '/overpass'],
  ['http://overpass-api.de', '/overpass'],
];

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  for (const [prefix, proxy] of PROXY_MAP) {
    if (trimmed.startsWith(prefix)) {
      return proxy + trimmed.slice(prefix.length);
    }
  }
  return trimmed;
}
