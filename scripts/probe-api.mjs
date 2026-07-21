#!/usr/bin/env node
/**
 * API 探测脚本 — 数据源接入 · 阶段 1
 *
 * 读取根目录 .env.local 的服务器地址与鉴权 token，依次请求接口，
 * 打印每个接口的 JSON 结构树、样本数据、推荐图表类型，
 * 并把原始响应存到 samples/（已 gitignore）。
 * Node 端 fetch 无 CORS 限制，最省事。
 *
 * 用法：
 *   1. 在项目根目录建 .env.local（键名见下方注释）
 *   2. 在 scripts/endpoints.txt 每行写一个接口路径（或作为命令行参数传入）
 *   3. 运行：node scripts/probe-api.mjs [额外接口...]
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── 载入 .env.local（极简解析，无需依赖）───
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(resolve(ROOT, '.env.local'));

const BASE = (process.env.PROBE_BASE_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.PROBE_TOKEN || '';
const TOKEN_IN = (process.env.PROBE_TOKEN_IN || 'header').toLowerCase(); // header | query
const TOKEN_HEADER = process.env.PROBE_TOKEN_HEADER || 'Authorization';
const TOKEN_PREFIX = process.env.PROBE_TOKEN_PREFIX ?? 'Bearer ';
const TOKEN_PARAM = process.env.PROBE_TOKEN_PARAM || 'token';

if (!BASE) {
  console.error('✗ 缺少 PROBE_BASE_URL。请在项目根目录 .env.local 中配置后重试。');
  process.exit(1);
}

// ─── 收集要探测的接口 ───
function loadEndpoints() {
  const list = [];
  const file = resolve(__dirname, 'endpoints.txt');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const s = line.trim();
      if (s && !s.startsWith('#')) list.push(s);
    }
  }
  list.push(...process.argv.slice(2));
  return [...new Set(list)];
}

const endpoints = loadEndpoints();
if (endpoints.length === 0) {
  console.error('✗ 没有要探测的接口。请在 scripts/endpoints.txt 每行写一个路径，或作为命令行参数传入。');
  process.exit(1);
}

// ─── URL / headers 构造 ───
function buildUrl(ep) {
  const u = new URL(/^https?:\/\//.test(ep) ? ep : BASE + (ep.startsWith('/') ? ep : '/' + ep));
  if (TOKEN && TOKEN_IN === 'query') u.searchParams.set(TOKEN_PARAM, TOKEN);
  return u;
}
function buildHeaders() {
  const h = { Accept: 'application/json' };
  if (TOKEN && TOKEN_IN === 'header') h[TOKEN_HEADER] = TOKEN_PREFIX + TOKEN;
  return h;
}

// ─── 结构描述 ───
function kind(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function describe(v, indent, depth, maxDepth) {
  const pad = '  '.repeat(indent);
  if (depth >= maxDepth) return kind(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return 'array (空)';
    return `array[${v.length}] →\n${pad}  ${describe(v[0], indent + 1, depth + 1, maxDepth)}`;
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    const lines = keys.slice(0, 50).map(
      (k) => `${pad}  ${k}: ${describe(v[k], indent + 1, depth + 1, maxDepth)}`,
    );
    const more = keys.length > 50 ? `\n${pad}  … 其余 ${keys.length - 50} 键` : '';
    return `object{${keys.length}} →\n${lines.join('\n')}${more}`;
  }
  if (typeof v === 'string') {
    const s = v.length > 40 ? v.slice(0, 40) + '…' : v;
    return `string ("${s}")`;
  }
  return `${kind(v)} (${v})`;
}

// ─── 推荐图表（粗略启发式，仅供参考）───
function recommend(data) {
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? Object.values(data).find(Array.isArray)
      : null;
  if (Array.isArray(arr) && arr.length && arr[0] && typeof arr[0] === 'object') {
    const first = arr[0];
    const keys = Object.keys(first);
    const numKeys = keys.filter((k) => typeof first[k] === 'number');
    const strKeys = keys.filter((k) => typeof first[k] === 'string');
    if (strKeys.length >= 1 && numKeys.length === 1) return '饼图 / 柱状图（单值分类）';
    if (strKeys.length >= 1 && numKeys.length >= 2) return '折线图 / 多系列柱状图';
    if (numKeys.length >= 1) return '柱状图 / 折线图';
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const numKeys = Object.keys(data).filter((k) => typeof data[k] === 'number');
    if (numKeys.length) return `统计卡 ×${numKeys.length}（数值字段）`;
  }
  return '需人工判断';
}

// ─── 文件名脱敏 ───
function safeName(ep) {
  return (
    ep
      .replace(/^https?:\/\//, '')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'root'
  );
}

// ─── 主流程 ───
const SAMPLES = resolve(ROOT, 'samples');
mkdirSync(SAMPLES, { recursive: true });

const summary = [];

console.log('\n=== API 探测 ===');
console.log(`基地址: ${BASE}`);
console.log(
  `鉴权:   ${TOKEN ? `${TOKEN_IN} (${TOKEN_IN === 'header' ? TOKEN_HEADER : TOKEN_PARAM})` : '无'}`,
);
console.log(`接口数: ${endpoints.length}\n`);

for (const ep of endpoints) {
  const url = buildUrl(ep);
  const t0 = Date.now();
  console.log('─'.repeat(60));
  console.log(`▶ ${ep}`);
  try {
    const resp = await fetch(url, { headers: buildHeaders(), signal: AbortSignal.timeout(12000) });
    const ms = Date.now() - t0;
    const ct = resp.headers.get('content-type') || '';
    console.log(`  HTTP ${resp.status} ${resp.statusText}  ·  ${ms}ms  ·  ${ct}`);
    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.log(`  ⚠ 非 JSON 响应（前 200 字）：\n  ${text.slice(0, 200)}`);
      summary.push({ ep, status: resp.status, top: '非JSON', rec: '—' });
      continue;
    }
    writeFileSync(resolve(SAMPLES, safeName(ep) + '.json'), JSON.stringify(json, null, 2), 'utf8');
    console.log(`  结构:\n  ${describe(json, 1, 0, 4)}`);
    console.log(`  推荐图表: ${recommend(json)}`);
    console.log(`  原始已存: samples/${safeName(ep)}.json`);
    summary.push({
      ep,
      status: resp.status,
      top: Array.isArray(json) ? `array[${json.length}]` : kind(json),
      rec: recommend(json),
    });
  } catch (err) {
    console.log(`  ✗ 请求失败: ${err.message}`);
    summary.push({ ep, status: 'ERR', top: err.message, rec: '—' });
  }
}

// ─── 汇总表 ───
console.log('\n' + '='.repeat(60));
console.log('汇总:');
for (const s of summary) {
  console.log(`  [${String(s.status).padEnd(4)}] ${s.ep}`);
  console.log(`         ${s.top}  →  ${s.rec}`);
}
console.log('');
