/**
 * 建表 — 幂等，服务启动时调用。
 */
import { getDb } from './connection.mjs';

export function initTables() {
  const db = getDb();

  // 迁移：为已有表补充 last_active_at 列（幂等）
  try { db.exec('ALTER TABLE users ADD COLUMN last_active_at TEXT'); }
  catch { /* 列已存在 */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT    PRIMARY KEY,
      username       TEXT    NOT NULL UNIQUE,
      password_hash  TEXT    NOT NULL,
      is_guest       INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      last_active_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );


    CREATE TABLE IF NOT EXISTS templates (
      id            TEXT    PRIMARY KEY,
      user_id       TEXT    NOT NULL,
      name          TEXT    NOT NULL DEFAULT '未命名模板',
      config        TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS published_views (
      id            TEXT    PRIMARY KEY,
      user_id       TEXT    NULL,
      name          TEXT    NOT NULL DEFAULT '未命名',
      config        TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_views_user ON published_views(user_id);
    CREATE INDEX IF NOT EXISTS idx_views_created ON published_views(created_at DESC);

    CREATE TABLE IF NOT EXISTS datasources (
      id          TEXT    PRIMARY KEY,
      name        TEXT    NOT NULL UNIQUE,
      type        TEXT    NOT NULL DEFAULT 'mysql',
      host        TEXT    NOT NULL,
      port        INTEGER NOT NULL DEFAULT 3306,
      database    TEXT    NOT NULL,
      username    TEXT    NOT NULL,
      password    TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      created_by  TEXT    REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  console.log('[db] Tables ready: users, templates, published_views, datasources');
}
