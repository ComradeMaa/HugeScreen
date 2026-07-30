/**
 * MySQL 连接池管理器 — 单例，管理多个命名数据源的连接池。
 * 遵循 db/connection.mjs 的延迟初始化模式。
 */
import mysql from 'mysql2/promise';
import { getDb } from './connection.mjs';

/** @type {Map<string, mysql.Pool>} */
let pools = null;

/** @type {WeakMap<mysql.Pool, number>} — 空闲超时计时器 */
const idleTimers = new WeakMap();
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟空闲自动释放

/**
 * 获取指定数据源的连接池（不存在则创建）。
 * @param {string} sourceName — 数据源名称（datasources.name）
 * @returns {Promise<mysql.Pool>}
 */
export async function getPool(sourceName) {
  if (!pools) pools = new Map();

  let pool = pools.get(sourceName);
  if (pool) {
    // 重置空闲计时器
    clearTimeout(idleTimers.get(pool));
    idleTimers.set(pool, setTimeout(() => closePool(sourceName), IDLE_TIMEOUT_MS));
    return pool;
  }

  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM datasources WHERE name = ?'
  ).get(sourceName);

  if (!row) {
    throw new Error(`数据源 '${sourceName}' 不存在`);
  }

  pool = mysql.createPool({
    host: row.host,
    port: row.port,
    database: row.database,
    user: row.username,
    password: row.password,
    charset: 'utf8mb4',
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
  });

  pools.set(sourceName, pool);
  console.log(`[mysql] Pool created for '${sourceName}' (${row.host}:${row.port}/${row.database})`);
  return pool;
}

/**
 * 关闭指定数据源的连接池。
 * @param {string} sourceName
 */
export async function closePool(sourceName) {
  if (!pools) return;
  const pool = pools.get(sourceName);
  if (pool) {
    clearTimeout(idleTimers.get(pool));
    await pool.end();
    pools.delete(sourceName);
    console.log(`[mysql] Pool closed for '${sourceName}'`);
  }
}

/**
 * 关闭所有连接池（服务器关闭时调用）。
 */
export async function closeAllPools() {
  if (!pools) return;
  console.log(`[mysql] Closing ${pools.size} pools...`);
  const promises = [];
  for (const [name, pool] of pools) {
    clearTimeout(idleTimers.get(pool));
    promises.push(pool.end());
  }
  await Promise.all(promises);
  pools.clear();
  console.log('[mysql] All pools closed');
}
