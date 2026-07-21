/**
 * 按路径从对象/数组中取值。
 * 支持点号与数组下标混合：
 *   "a.b.c"          对象逐层
 *   "items[0].name"  数组下标 + 对象键
 *   "series[2]"      纯下标
 *   ""               返回原值
 *
 * 取不到时返回 undefined（不抛错）。
 */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  // items[0].name → items.0.name，再按 . 分词
  const tokens = path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let cur: unknown = obj;
  for (const tok of tokens) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(tok);
      if (!Number.isInteger(idx)) return undefined;
      cur = cur[idx];
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[tok];
    } else {
      return undefined;
    }
  }
  return cur;
}
