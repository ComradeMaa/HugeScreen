/**
 * JWT 认证中间件
 */
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'hugescreen-secret-change-in-production';
const JWT_EXPIRES = '24h';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/** 必须登录 — 无有效 token 返回 401，同时刷新 last_active_at */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);

    // 刷新活跃时间（不阻塞请求）
    try {
      getDb().prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
        .run(new Date().toISOString(), req.user.id);
    } catch { /* ignore */ }

    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

/** 可选登录 — 有 token 则解析，无则不拒绝 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch { /* token invalid, continue without user */ }
  }
  next();
}
