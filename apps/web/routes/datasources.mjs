/**
 * 数据源管理与查询路由
 * 挂载在 /api/data
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.mjs';
import { getPool } from '../db/mysql.mjs';
import { requireAuth } from '../middleware/auth.mjs';

const router = Router();
router.use(requireAuth);

// ─── 禁止的 SQL 关键词（防止 DDL/DCL 注入）───
const FORBIDDEN_KEYWORDS = /\b(DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|USE\s|RENAME)\b/i;

// ─── 表名列名白名单（防止 SHOW 注入）───
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// ─── 默认/最大行数限制 ───
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;

// ─── 查询超时 ───
const QUERY_TIMEOUT_MS = 30000;

// ─── GET /api/data/sources — 列出数据源（不含密码）───
router.get('/sources', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, name, type, host, port, database, username, created_at, created_by FROM datasources ORDER BY created_at DESC'
    ).all();
    res.json(rows);
  } catch (e) {
    console.error('[datasources] list error:', e.message);
    res.status(500).json({ error: '获取数据源列表失败' });
  }
});

// ─── POST /api/data/sources — 新增数据源 ───
router.post('/sources', (req, res) => {
  try {
    const { name, type, host, port, database, username, password } = req.body || {};
    if (!name || !host || !database || !username || !password) {
      return res.status(400).json({ error: '缺少必填字段 (name, host, database, username, password)' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM datasources WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ error: `数据源 '${name}' 已存在` });
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO datasources (id, name, type, host, port, database, username, password, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, type || 'mysql', host, port || 3306, database, username, password, req.user?.id || null);

    console.log(`[datasources] Created: '${name}' by ${req.user?.username}`);
    res.status(201).json({ id, name, type: type || 'mysql', host, port: port || 3306, database, username });
  } catch (e) {
    console.error('[datasources] create error:', e.message);
    res.status(500).json({ error: '创建数据源失败' });
  }
});

// ─── DELETE /api/data/sources/:name — 删除数据源 ───
router.delete('/sources/:name', (req, res) => {
  try {
    const { name } = req.params;
    const db = getDb();
    const row = db.prepare('SELECT id FROM datasources WHERE name = ?').get(name);
    if (!row) {
      return res.status(404).json({ error: `数据源 '${name}' 不存在` });
    }
    db.prepare('DELETE FROM datasources WHERE name = ?').run(name);
    // 异步关闭对应的连接池
    import('../db/mysql.mjs').then(m => m.closePool(name)).catch(() => {});
    console.log(`[datasources] Deleted: '${name}' by ${req.user?.username}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('[datasources] delete error:', e.message);
    res.status(500).json({ error: '删除数据源失败' });
  }
});

// ─── GET /api/data/sources/:name/tables — 列出表 ───
router.get('/sources/:name/tables', async (req, res) => {
  try {
    const { name } = req.params;
    const pool = await getPool(name);
    const [rows] = await pool.execute('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    res.json({ source: name, tables });
  } catch (e) {
    console.error('[datasources] tables error:', e.message);
    if (e.message.includes('不存在')) {
      return res.status(404).json({ error: e.message });
    }
    res.status(500).json({ error: '获取表列表失败' });
  }
});

// ─── GET /api/data/sources/:name/tables/:table/columns — 列出列 ───
router.get('/sources/:name/tables/:table/columns', async (req, res) => {
  try {
    const { name, table } = req.params;
    if (!IDENTIFIER_RE.test(table)) {
      return res.status(400).json({ error: '无效的表名' });
    }
    const pool = await getPool(name);
    const [rows] = await pool.execute('SHOW COLUMNS FROM `' + table + '`');
    const columns = rows.map(r => ({
      field: r.Field,
      type: r.Type,
      nullable: r.Null === 'YES',
      key: r.Key || null,
      default: r.Default,
    }));
    res.json({ source: name, table, columns });
  } catch (e) {
    console.error('[datasources] columns error:', e.message);
    if (e.message.includes('不存在')) {
      return res.status(404).json({ error: e.message });
    }
    res.status(500).json({ error: '获取列信息失败' });
  }
});

// ─── POST /api/data/query — 执行参数化查询 ───
router.post('/query', async (req, res) => {
  const startTime = Date.now();
  try {
    const { source, query, params, limit } = req.body || {};
    if (!source || !query) {
      return res.status(400).json({ error: '缺少必填字段 (source, query)' });
    }

    // 安全检查：禁止 DDL/DCL 关键词
    if (FORBIDDEN_KEYWORDS.test(query)) {
      return res.status(400).json({ error: '查询包含禁止的关键词 (DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE/USE/RENAME)' });
    }

    // 参数数量检查：? 占位符数量与 params 数组长度一致
    const placeholderCount = (query.match(/\?/g) || []).length;
    const paramArray = Array.isArray(params) ? params : [];
    if (paramArray.length !== placeholderCount) {
      return res.status(400).json({
        error: `查询包含 ${placeholderCount} 个占位符(?)，但提供了 ${paramArray.length} 个参数`
      });
    }

    const pool = await getPool(source);

    // 自动添加 LIMIT（如果查询中不存在）
    let finalQuery = query.trim();
    const hasLimit = /\bLIMIT\s+\d+/i.test(finalQuery);
    if (!hasLimit) {
      const finalLimit = Math.min(
        typeof limit === 'number' && limit > 0 ? limit : DEFAULT_LIMIT,
        MAX_LIMIT
      );
      // 移除末尾分号以便追加 LIMIT
      finalQuery = finalQuery.replace(/;+\s*$/, '');
      finalQuery += ` LIMIT ${finalLimit}`;
    }

    const [rows] = await pool.execute({ sql: finalQuery, values: paramArray, timeout: QUERY_TIMEOUT_MS });
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const executionTimeMs = Date.now() - startTime;

    res.json({ columns, rows, rowCount: rows.length, executionTimeMs });
  } catch (e) {
    console.error('[datasources] query error:', e.message);
    if (e.message.includes('不存在')) {
      return res.status(404).json({ error: e.message });
    }
    res.status(500).json({ error: '查询执行失败: ' + e.message });
  }
});

export default router;
