/**
 * 游客数据定时清理 + 限流
 */
import { getDb } from './connection.mjs';

const GUEST_TTL_MINUTES = 5;       // 游客 5 分钟不活跃即清理（关标签页即死）
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // 每 2 分钟扫一次

/** 游客限流：同 IP 每小时最多 N 个 */
const rateLimitMap = new Map(); // ip → { count, resetAt }

export function checkGuestRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 3600000 };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;
  if (entry.count > 5) {
    return { allowed: false, error: '游客创建过于频繁，请稍后再试或注册正式账号' };
  }
  return { allowed: true };
}

/** 清理过期游客（及其关联的模板、发布） */
export function cleanupGuests() {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - GUEST_TTL_MINUTES * 60000).toISOString();

    const deleted = db.prepare(
      'DELETE FROM users WHERE is_guest = 1 AND last_active_at < ?'
    ).run(cutoff);

    if (deleted.changes > 0) {
      console.log(`[cleanup] 清理了 ${deleted.changes} 个过期游客 (${GUEST_TTL_MINUTES}min TTL)`);
    }
  } catch (e) {
    console.error('[cleanup] 清理失败:', e.message);
  }
}

/** 启动定时清理 */
export function startCleanupScheduler() {
  cleanupGuests(); // 启动时立即执行一次
  setInterval(cleanupGuests, CLEANUP_INTERVAL_MS);
  console.log(`[cleanup] 定时清理已启动: 每 ${CLEANUP_INTERVAL_MS / 60000} 分钟, TTL ${GUEST_TTL_MINUTES}min`);
}
