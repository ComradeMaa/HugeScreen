/**
 * HugeScreen 一体化生产服务器
 *
 * 静态文件 + REST API 一体，单进程运行。
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
 *   POST   /api/view       保存配置 → {"id":"8abc","url":"/viewer?id=8abc"}
 *   GET    /api/view/:id   获取配置
 *   DELETE /api/view/:id   删除配置
 *   GET    /api/views      列出所有配置
 *
 * 存储：内存 + 文件持久化 (views.json)
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'views.json');
const DIST_DIR = join(__dirname, 'dist');
const PORT = process.env.PORT || 3001;

// ─── 持久化 ───
/** @type {Map<string, {id:string, name:string, createdAt:string, config:object}>} */
let views = new Map();

if (existsSync(DATA_FILE)) {
  try {
    const entries = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    views = new Map(entries);
    console.log(`[server] 加载了 ${views.size} 个大屏配置`);
  } catch { /* ignore corrupt file */ }
}

function save() {
  writeFileSync(DATA_FILE, JSON.stringify([...views]), 'utf-8');
}

// ─── 工具 ───
function nanoid(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < len; i++) id += chars[(Math.random() * chars.length) | 0];
  return id;
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

// POST /api/view — 保存配置（快照固化，每次生成新 ID）
app.post('/api/view', (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: '请求体必须是 JSON 对象' });
    }
    const id = nanoid();
    const entry = {
      id,
      name: config.name || '未命名',
      createdAt: new Date().toISOString(),
      config,
    };
    views.set(id, entry);
    save();
    console.log(`[server] 保存配置: ${id} (${entry.name})`);
    res.json({ id, url: `/viewer?id=${id}` });
  } catch {
    res.status(400).json({ error: '无效的 JSON' });
  }
});

// GET /api/view/:id — 获取单个配置
app.get('/api/view/:id', (req, res) => {
  const entry = views.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: `配置 ${req.params.id} 不存在` });
  }
  res.json(entry.config);
});

// DELETE /api/view/:id — 删除配置
app.delete('/api/view/:id', (req, res) => {
  const entry = views.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: `配置 ${req.params.id} 不存在` });
  }
  views.delete(req.params.id);
  save();
  console.log(`[server] 删除配置: ${req.params.id} (${entry.name})`);
  res.json({ ok: true });
});

// GET /api/views — 列出所有配置
app.get('/api/views', (_, res) => {
  const list = [...views.values()]
    .map(({ id, name, createdAt }) => ({ id, name, createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 最新的在前
  res.json(list);
});

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
  console.log(`   已存储配置: ${views.size} 个`);
  console.log('');
});
