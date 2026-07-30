/**
 * 模板 CRUD 路由
 * 所有路由需要登录认证。
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.mjs';
import { requireAuth } from '../middleware/auth.mjs';

const router = Router();

// 所有模板路由需要认证
router.use(requireAuth);

// ─── GET /api/templates — 列出当前用户的模板（不含 config 字段，含 thumbnail）───
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, name, config, created_at, updated_at FROM templates WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(req.user.id);
    res.json(rows.map(r => {
      let thumbnail = null;
      try {
        const cfg = JSON.parse(r.config);
        thumbnail = cfg.thumbnail || null;
      } catch { /* ignore */ }
      return {
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        thumbnail,
      };
    }));
  } catch (e) {
    console.error('[templates] list error:', e.message);
    res.status(500).json({ error: '获取模板列表失败' });
  }
});

// ─── POST /api/templates — 新建模板 ───
router.post('/', (req, res) => {
  try {
    const { name, config } = req.body || {};
    if (!config) {
      return res.status(400).json({ error: '缺少模板配置' });
    }
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO templates (id, user_id, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, req.user.id, name || '未命名模板', JSON.stringify(config), now, now);

    res.status(201).json({ id, name: name || '未命名模板', createdAt: now, updatedAt: now });
  } catch (e) {
    console.error('[templates] create error:', e.message);
    res.status(500).json({ error: '创建模板失败' });
  }
});

// ─── GET /api/templates/:id — 获取单个模板（含完整 config）───
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(
      'SELECT * FROM templates WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!row) {
      return res.status(404).json({ error: '模板不存在' });
    }
    res.json({
      id: row.id,
      name: row.name,
      config: JSON.parse(row.config),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (e) {
    console.error('[templates] get error:', e.message);
    res.status(500).json({ error: '获取模板失败' });
  }
});

// ─── PUT /api/templates/:id — 更新模板 ───
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(
      'SELECT id FROM templates WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!row) {
      return res.status(404).json({ error: '模板不存在' });
    }

    const { name, config } = req.body || {};
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (config !== undefined) {
      updates.push('config = ?');
      params.push(JSON.stringify(config));
    }
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);

    if (updates.length > 1) {
      db.prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT id, name, updated_at FROM templates WHERE id = ?').get(req.params.id);
    res.json({ id: updated.id, name: updated.name, updatedAt: updated.updated_at });
  } catch (e) {
    console.error('[templates] update error:', e.message);
    res.status(500).json({ error: '更新模板失败' });
  }
});

// ─── DELETE /api/templates/:id — 删除模板 ───
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(
      'SELECT id FROM templates WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!row) {
      return res.status(404).json({ error: '模板不存在' });
    }

    db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[templates] delete error:', e.message);
    res.status(500).json({ error: '删除模板失败' });
  }
});

export default router;
