/**
 * SQLite 单例连接 — 服务器本地文件，零网络依赖。
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'hugescreen.db');

/** @type {import('better-sqlite3').Database | null} */
let db = null;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log(`[db] SQLite connected: ${DB_PATH}`);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[db] SQLite closed');
  }
}
