/**
 * HugeScreen — SQLite → MySQL 备份脚本
 *
 * 将 SQLite (hugescreen.db) 中的所有数据备份到远程 MySQL。
 * 使用 REPLACE INTO 确保幂等（重复执行不会产生重复数据）。
 *
 * 用法：
 *   node db/backup-to-mysql.mjs                # 手动执行一次
 *   # 或通过 crontab 定时执行
 *
 * MySQL 连接：
 *   服务器内网: 172.16.1.192:33388
 *   外网:      221.131.69.192:33388
 */

import { createConnection } from 'mysql2/promise';
import { getDb } from './connection.mjs';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── 配置 ───
const MYSQL = {
  host: '172.16.1.192',       // 服务器用内网地址
  port: 33388,
  database: 'dashboard1',
  user: 'dashboard1_user',
  password: 'Dashboard1_2024!',
  charset: 'utf8mb4',
};

const DB_PATH = join(ROOT, 'hugescreen.db');

// ─── 工具 ───
function log(msg) { console.log(`[${new Date().toISOString().slice(0, 19)}] ${msg}`); }

/** ISO 8601 / SQLite datetime → MySQL DATETIME 格式 */
function toMySQLDate(val) {
  if (!val) return null;
  try {
    return new Date(val).toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    // 如果已经是 MySQL 格式，直接返回
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) return val;
    return null;
  }
}

// ─── 建表（MySQL，如不存在）───
const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(64)  PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,
    is_guest        TINYINT      NOT NULL DEFAULT 0,
    created_at      DATETIME     NULL,
    last_active_at  DATETIME     NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='HugeScreen 用户';

  CREATE TABLE IF NOT EXISTS templates (
    id            VARCHAR(64)  PRIMARY KEY,
    user_id       VARCHAR(64)  NOT NULL,
    name          VARCHAR(255) NOT NULL DEFAULT '未命名模板',
    config        JSON         NOT NULL,
    created_at    DATETIME     NULL,
    updated_at    DATETIME     NULL,
    INDEX idx_tpl_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='HugeScreen 模板';

  CREATE TABLE IF NOT EXISTS published_views (
    id            VARCHAR(64)  PRIMARY KEY,
    user_id       VARCHAR(64)  NULL,
    name          VARCHAR(255) NOT NULL DEFAULT '未命名',
    config        JSON         NOT NULL,
    created_at    DATETIME     NULL,
    INDEX idx_view_user (user_id),
    INDEX idx_view_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='HugeScreen 已发布配置';
`;

// ─── 主流程 ───
async function main() {
  log('开始备份 SQLite → MySQL');

  // 检查 SQLite 文件
  if (!existsSync(DB_PATH)) {
    log(`错误: SQLite 文件不存在: ${DB_PATH}`);
    process.exit(1);
  }

  const db = getDb();
  let mysql;

  try {
    // 连接 MySQL（服务端默认 latin1，需显式设置字符集）
    mysql = await createConnection(MYSQL);
    await mysql.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    log(`已连接 MySQL: ${MYSQL.database}@${MYSQL.host}:${MYSQL.port}`);
  } catch (err) {
    log(`MySQL 连接失败: ${err.message}`);
    process.exit(1);
  }

  try {
    // 建表（逐条执行，MySQL 默认不支持多语句）
    for (const stmt of CREATE_TABLES.split(';').filter(s => s.trim())) {
      await mysql.query(stmt + ';');
    }
    log('MySQL 表已就绪');

    // ─── 备份 users ───
    const users = db.prepare('SELECT * FROM users').all();
    if (users.length > 0) {
      for (const u of users) {
        await mysql.query(
          `REPLACE INTO users (id, username, password_hash, is_guest, created_at, last_active_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [u.id, u.username, u.password_hash, u.is_guest,
           toMySQLDate(u.created_at), toMySQLDate(u.last_active_at)],
        );
      }
      log(`users: ${users.length} 条已同步`);
    }

    // ─── 备份 templates ───
    const templates = db.prepare('SELECT * FROM templates').all();
    if (templates.length > 0) {
      for (const t of templates) {
        await mysql.query(
          `REPLACE INTO templates (id, user_id, name, config, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [t.id, t.user_id, t.name, t.config,
           toMySQLDate(t.created_at), toMySQLDate(t.updated_at)],
        );
      }
      log(`templates: ${templates.length} 条已同步`);
    }

    // ─── 备份 published_views ───
    const views = db.prepare('SELECT * FROM published_views').all();
    if (views.length > 0) {
      for (const v of views) {
        await mysql.query(
          `REPLACE INTO published_views (id, user_id, name, config, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [v.id, v.user_id, v.name, v.config, toMySQLDate(v.created_at)],
        );
      }
      log(`published_views: ${views.length} 条已同步`);
    }

    log('备份完成 ✓');
  } catch (err) {
    log(`备份过程出错: ${err.message}`);
    throw err;
  } finally {
    await mysql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
