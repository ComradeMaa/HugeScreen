/**
 * HugeScreen 大屏配置服务
 *
 * 部署方式：
 *   1. node server.js                    ← 直接运行
 *   2. pm2 start server.js               ← 生产环境进程守护
 *
 * API：
 *   POST /api/view        保存配置 → {"id": "8abc", "url": "/viewer.html?id=8abc"}
 *   GET  /api/view/:id    获取配置
 *   GET  /api/views       列出所有配置
 *
 * 存储：内存 + 文件持久化 (views.json)
 */

import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'views.json');
const PORT = process.env.PORT || 3001;

// ─── 持久化 ───
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

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

// ─── 路由 ───
const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  const parsed = new URL(url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  // POST /api/view — 保存配置
  if (method === 'POST' && pathname === '/api/view') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const id = nanoid();
      const config = JSON.parse(body);
      const entry = { id, name: config.name || '未命名', createdAt: new Date().toISOString(), config };
      views.set(id, entry);
      save();
      console.log(`[server] 保存配置: ${id} (${entry.name})`);
      json(res, { id, url: `/viewer.html?id=${id}` });
    } catch (e) {
      json(res, { error: 'Invalid JSON' }, 400);
    }
    return;
  }

  // GET /api/view/:id — 获取单个配置
  const viewMatch = pathname.match(/^\/api\/view\/([a-z0-9]+)$/);
  if (method === 'GET' && viewMatch) {
    const entry = views.get(viewMatch[1]);
    if (!entry) { json(res, { error: 'Not found' }, 404); return; }
    json(res, entry.config);
    return;
  }

  // GET /api/views — 列出所有配置
  if (method === 'GET' && pathname === '/api/views') {
    const list = [...views.values()].map(({ id, name, createdAt }) => ({ id, name, createdAt }));
    json(res, list);
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[server] HugeScreen 配置服务运行在 http://localhost:${PORT}`);
  console.log(`[server] API: POST /api/view | GET /api/view/:id | GET /api/views`);
});
