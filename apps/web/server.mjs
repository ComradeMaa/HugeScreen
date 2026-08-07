/**
 * HugeScreen 一体化生产服务器
 *
 * 静态文件 + REST API 一体，单进程运行。
 * 存储：SQLite (hugescreen.db)
 *
 * 部署方式：
 *   1. node server.mjs                      ← 直接运行
 *   2. pm2 start server.mjs                 ← 生产环境进程守护
 *   3. PORT=8080 node server.mjs            ← 自定义端口
 *
 * 路由：
 *   GET  /                 编辑器 SPA
 *   GET  /screen           编辑器 SPA (React Router fallback)
 *   GET  /viewer           展示器 SPA (Query: ?id=xxx)
 *
 * API：
 *   POST   /api/auth/register|login|guest  认证
 *   GET    /api/auth/me                    当前用户
 *   DELETE /api/auth/me                    注销账号（销毁账号及数据）
 *   POST   /api/auth/upgrade               游客升级
 *   GET    /api/templates                  列出模板
 *   POST   /api/templates                  新建模板
 *   GET    /api/templates/:id              获取模板
 *   PUT    /api/templates/:id              更新模板
 *   DELETE /api/templates/:id              删除模板
 *   POST   /api/view                       发布配置
 *   GET    /api/view/:id                   获取配置
 *   DELETE /api/view/:id                   删除配置
 *   GET    /api/views                      列出发布
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import multer from 'multer';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { getDb, closeDb } from './db/connection.mjs';
import { initTables } from './db/init.mjs';
import { migrateViewsJson } from './db/migrate.mjs';
import { startCleanupScheduler } from './db/cleanup.mjs';
import { closeAllPools } from './db/mysql.mjs';
import authRouter from './routes/auth.mjs';
import templatesRouter from './routes/templates.mjs';
import datasourcesRouter from './routes/datasources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'views.json');
const DIST_DIR = join(__dirname, 'dist');
const PORT = process.env.PORT || 55906;

// ─── 初始化 SQLite ───
initTables();
migrateViewsJson();
startCleanupScheduler();

// ─── 持久化辅助 ───
/** 8-char nanoid */
function nanoid(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < len; i++) id += chars[(Math.random() * chars.length) | 0];
  return id;
}

/** 兼容三种时间格式 → ISO：SQLite datetime('now') / ISO / 毫秒时间戳字符串（旧迁移数据） */
function normalizeTime(t) {
  if (!t) return t;
  if (/^\d+(\.\d+)?$/.test(t)) return new Date(parseFloat(t)).toISOString();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) return new Date(t.replace(' ', 'T') + 'Z').toISOString();
  return t;
}

/** 获取本机所有局域网 IPv4 地址 */
function getLocalIPs() {
  /** @type {{name:string, ip:string}[]} */
  const result = [];
  const interfaces = os.networkInterfaces();
  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      // 跳过内部回环和 IPv6
      if (net.family === 'IPv4' && !net.internal) {
        result.push({ name, ip: net.address });
      }
    }
  }
  return result;
}

// ─── Express 应用 ───
const app = express();

// Body 解析
app.use(express.json({ limit: '5mb' }));

// ─── 上传目录 ───
const UPLOADS_DIR = join(__dirname, 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── 文件上传（multer + FormData multipart）───
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm']);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100MB

// multer 存储配置 — 用原始文件名 + nanoid 防冲突
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`不支持的文件类型: ${ext}`), '');
    }
    cb(null, nanoid(16) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`不支持的文件类型: ${ext}`));
    }
    cb(null, true);
  },
});

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未接收到文件' });
  }
  res.json({ url: '/uploads/' + req.file.filename });
});

// 删除上传文件
app.delete('/api/upload', requireAuth, (req, res) => {
  const { url } = req.body || {};
  if (!url || !url.startsWith('/uploads/')) {
    return res.status(400).json({ error: '无效的文件路径' });
  }
  const filename = url.replace('/uploads/', '');
  // 防止路径穿越
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: '无效的文件名' });
  }
  const filePath = join(UPLOADS_DIR, filename);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
  res.json({ ok: true });
});

// ─── API 代理（与 Vite 开发代理保持一致）───
// DataV GeoJSON API — 去掉 Referer 绕过访问校验
app.use('/geodata', createProxyMiddleware({
  target: 'https://geo.datav.aliyun.com',
  changeOrigin: true,
  pathRewrite: { '^/geodata': '' },
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.removeHeader('Referer');
      proxyReq.removeHeader('Origin');
    },
  },
}));

// OSM Overpass API
app.use('/overpass', createProxyMiddleware({
  target: 'https://overpass-api.de',
  changeOrigin: true,
  pathRewrite: { '^/overpass': '' },
}));

// ─── 高德驾车路线规划（Web 服务 API 代理）───
// 前端路径规划的服务器兜底通道：浏览器直连高德 JS API 在线服务可能限流/网络波动，
// 服务器在中国机房直连 Web 服务 API 更稳定。POST { origin: [lng,lat], dest: [lng,lat] } → { ok, coords }
const AMAP_WEB_KEY = 'e6fd3820534c7276d74172b4decf32c2';
app.post('/amap/direction', async (req, res) => {
  try {
    const { origin, dest } = req.body || {};
    if (!origin || !dest || !Array.isArray(origin) || !Array.isArray(dest)) {
      return res.status(400).json({ error: 'origin/dest 必须为 [lng,lat] 数组' });
    }
    const url = `https://restapi.amap.com/v3/direction/driving?key=${AMAP_WEB_KEY}` +
      `&origin=${origin[0]},${origin[1]}&destination=${dest[0]},${dest[1]}&extensions=base&strategy=0`;
    const resp = await fetch(url);
    const j = await resp.json();
    if (j.status !== '1' || !j.route?.paths?.length) {
      console.warn(`[amap] driving fail: ${j.status} ${j.info}`);
      return res.status(502).json({ error: `高德规划失败 ${j.status} ${j.info}` });
    }
    const coords = [];
    for (const step of j.route.paths[0].steps ?? []) {
      for (const seg of (step.polyline || '').split(';')) {
        const [a, b] = seg.split(',').map(Number);
        if (Number.isFinite(a) && Number.isFinite(b)) coords.push([a, b]);
      }
    }
    if (coords.length < 2) return res.status(502).json({ error: '高德规划结果为空' });
    res.json({ ok: true, coords });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
});

// ─── API 路由 ───
app.use('/api/auth', authRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/data', datasourcesRouter);

// ─── 上传文件静态服务 ───
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', etag: true }));

// ─── 静态文件 ───
const hasDist = existsSync(DIST_DIR);
if (hasDist) {
  app.use(express.static(DIST_DIR, {
    maxAge: '7d',
    etag: true,
    // HTML 不缓存，JS/CSS 强缓存 (Vite 构建带 hash)
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  console.log('[server] 静态文件: dist/');
} else {
  console.log('[server] 静态文件: 未构建 (pnpm build 后生效)');
}

// ─── SPA fallback ───
// 编辑器路由
const sendEditor = (_, res) => {
  if (hasDist) {
    res.sendFile(join(DIST_DIR, 'index.html'));
  } else {
    res.status(503).send(
      '编辑器未构建 — 开发时请使用 pnpm dev 启动 Vite 开发服务器；\n' +
      '部署时请先执行 pnpm build 然后重新启动。\n'
    );
  }
};

app.get('/', sendEditor);
app.get('/screen', sendEditor);

// 展示器路由
app.get('/viewer.html', (_, res) => res.redirect(301, '/viewer'));
app.get('/viewer', (_, res) => {
  if (hasDist) {
    res.sendFile(join(DIST_DIR, 'viewer.html'));
  } else {
    res.status(503).send(
      '展示器未构建 — 开发时请使用 pnpm dev 启动 Vite 开发服务器；\n' +
      '部署时请先执行 pnpm build 然后重新启动。\n'
    );
  }
});

// ─── API ───
import { requireAuth, optionalAuth } from './middleware/auth.mjs';

// POST /api/view — 保存配置（快照固化，每次生成新 ID）
app.post('/api/view', requireAuth, (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: '请求体必须是 JSON 对象' });
    }
    const id = nanoid();
    const db = getDb();
    db.prepare(
      'INSERT INTO published_views (id, user_id, name, config) VALUES (?, ?, ?, ?)'
    ).run(id, req.user.id, config.name || '未命名', JSON.stringify(config));
    console.log(`[server] 发布配置: ${id} (${config.name})`);
    res.json({ id, url: `/viewer?id=${id}` });
  } catch (e) {
    console.error('[server] publish error:', e.message);
    res.status(400).json({ error: '无效的 JSON' });
  }
});

// GET /api/view/:id — 获取单个配置（公开）
app.get('/api/view/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT config FROM published_views WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: `配置 ${req.params.id} 不存在` });
    }
    res.json(JSON.parse(row.config));
  } catch (e) {
    res.status(500).json({ error: '获取配置失败' });
  }
});

// DELETE /api/view/:id — 删除配置（仅限本人发布）
app.delete('/api/view/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM published_views WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) {
      return res.status(404).json({ error: `配置 ${req.params.id} 不存在` });
    }
    db.prepare('DELETE FROM published_views WHERE id = ?').run(req.params.id);
    console.log(`[server] 删除配置: ${req.params.id} (${JSON.parse(row.config).name})`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '删除失败' });
  }
});

// GET /api/views — 列出当前用户的已发布配置
app.get('/api/views', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, name, created_at FROM published_views WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json(rows.map(r => ({ id: r.id, name: r.name, createdAt: normalizeTime(r.created_at) })));
  } catch (e) {
    res.status(500).json({ error: '获取列表失败' });
  }
});

// ─── SPA fallback — 所有非 API/静态文件 GET 请求均返回 index.html ───
app.get('*', (req, res, next) => {
  // 跳过 API 和已处理的路由
  if (req.path.startsWith('/api/')) return next();
  if (req.path === '/viewer' || req.path === '/viewer.html') return next();
  if (hasDist) {
    res.sendFile(join(DIST_DIR, 'index.html'));
  } else {
    next();
  }
});

// ─── 优雅关闭 ───
process.on('SIGINT', () => { closeAllPools(); closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeAllPools(); closeDb(); process.exit(0); });

// ─── 启动 ───
app.listen(PORT, () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('  ═══════════════════════════════════════════════');
  console.log('   HugeScreen 服务已启动');
  console.log('  ═══════════════════════════════════════════════');
  console.log('');
  console.log('   编辑器:');
  if (ips.length > 0) {
    for (const { name, ip } of ips) {
      console.log(`     http://${ip}:${PORT}/`);
    }
  }
  console.log(`     http://localhost:${PORT}/`);
  console.log('');
  console.log('   展示器:');
  if (ips.length > 0) {
    const firstIP = ips[0].ip;
    console.log(`     http://${firstIP}:${PORT}/viewer?id=<配置ID>`);
  }
  console.log(`     http://localhost:${PORT}/viewer?id=<配置ID>`);
  console.log('');
  console.log(`   API: http://localhost:${PORT}/api/`);
  console.log('');
});
