/**
 * 认证路由：注册 / 登录 / 游客 / 升级 / 获取当前用户
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.mjs';
import { signToken, requireAuth } from '../middleware/auth.mjs';
import { checkGuestRateLimit } from '../db/cleanup.mjs';

const router = Router();

// ─── 校验 ───
const USERNAME_RE = /^[a-zA-Z0-9_]{2,32}$/;

function validateUsername(username) {
  if (!username || !USERNAME_RE.test(username)) {
    return '用户名需 2-32 位（字母/数字/下划线）';
  }
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 6) {
    return '密码至少 6 位';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return '密码必须同时包含字母和数字';
  }
  return null;
}

// ─── POST /api/auth/register ───
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    const nameErr = validateUsername(username);
    if (nameErr) return res.status(400).json({ error: nameErr });

    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ error: passErr });

    const db = getDb();

    // 检查用户名是否已存在
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: '用户名已被注册' });
    }

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (id, username, password_hash, is_guest) VALUES (?, ?, ?, 0)').run(id, username, hash);

    const token = signToken({ id, username, is_guest: false });
    res.status(201).json({ token, user: { id, username, is_guest: false } });
  } catch (e) {
    console.error('[auth] register error:', e.message);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// ─── POST /api/auth/login ───
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const db = getDb();

    const row = db.prepare('SELECT id, username, password_hash, is_guest FROM users WHERE username = ?').get(username);
    if (!row) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    if (row.is_guest) {
      return res.status(401).json({ error: '该用户为游客，请使用游客登录或重新注册' });
    }

    const valid = bcrypt.compareSync(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = signToken({ id: row.id, username: row.username, is_guest: false });
    res.json({ token, user: { id: row.id, username: row.username, is_guest: false } });
  } catch (e) {
    console.error('[auth] login error:', e.message);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// ─── POST /api/auth/guest ───
router.post('/guest', async (req, res) => {
  try {
    // 限流：同 IP 每小时最多 5 个游客
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const limit = checkGuestRateLimit(ip);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.error });
    }

    const db = getDb();
    const id = uuidv4();
    const suffix = id.slice(0, 6);
    const username = `guest_${suffix}`;

    db.prepare('INSERT INTO users (id, username, password_hash, is_guest) VALUES (?, ?, ?, 1)').run(id, username, '');

    const token = signToken({ id, username, is_guest: true });
    res.status(201).json({ token, user: { id, username, is_guest: true } });
  } catch (e) {
    console.error('[auth] guest error:', e.message);
    res.status(500).json({ error: '游客登录失败，请稍后重试' });
  }
});

// ─── GET /api/auth/me ───
router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT id, username, is_guest, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!row) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user: { ...row, is_guest: !!row.is_guest } });
  } catch (e) {
    console.error('[auth] me error:', e.message);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// ─── POST /api/auth/upgrade ───
router.post('/upgrade', requireAuth, async (req, res) => {
  try {
    if (!req.user.is_guest) {
      return res.status(400).json({ error: '当前账号已是正式用户，无需升级' });
    }

    const { username, password } = req.body || {};
    const nameErr = validateUsername(username);
    if (nameErr) return res.status(400).json({ error: nameErr });
    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ error: passErr });

    const db = getDb();
    const oldId = req.user.id;

    // 检查用户名唯一性
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, oldId);
    if (existing) {
      return res.status(409).json({ error: '用户名已被注册' });
    }

    const newId = uuidv4();
    const hash = bcrypt.hashSync(password, 10);

    // 事务：创建新用户 → 迁移数据 → 删除旧游客
    const upgrade = db.transaction(() => {
      db.prepare('INSERT INTO users (id, username, password_hash, is_guest) VALUES (?, ?, ?, 0)').run(newId, username, hash);
      db.prepare('UPDATE templates SET user_id = ? WHERE user_id = ?').run(newId, oldId);
      db.prepare('UPDATE published_views SET user_id = ? WHERE user_id = ?').run(newId, oldId);
      db.prepare('DELETE FROM users WHERE id = ?').run(oldId);
    });

    upgrade();

    const token = signToken({ id: newId, username, is_guest: false });
    res.json({ token, user: { id: newId, username, is_guest: false } });
  } catch (e) {
    console.error('[auth] upgrade error:', e.message);
    res.status(500).json({ error: '升级失败，请稍后重试' });
  }
});

export default router;
