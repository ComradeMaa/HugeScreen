/**
 * views.json → SQLite 一次性迁移
 *
 * 启动时自动执行：若 published_views 为空且 views.json 存在，
 * 则导入全部配置到 SQLite，然后重命名 views.json 为 views.json.migrated。
 */
import { getDb } from './connection.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renameSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '..', 'views.json');

export function migrateViewsJson() {
  const db = getDb();

  // 检查是否已有数据
  const count = db.prepare('SELECT COUNT(*) as cnt FROM published_views').get();
  if (count.cnt > 0) {
    console.log(`[migrate] published_views 已有 ${count.cnt} 条数据，跳过迁移`);
    return;
  }

  if (!existsSync(DATA_FILE)) {
    console.log('[migrate] views.json 不存在，跳过迁移');
    return;
  }

  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    const entries = JSON.parse(raw);

    if (!Array.isArray(entries) || entries.length === 0) {
      console.log('[migrate] views.json 为空，跳过迁移');
      return;
    }

    const insert = db.prepare(
      'INSERT OR IGNORE INTO published_views (id, user_id, name, config, created_at) VALUES (?, NULL, ?, ?, ?)'
    );

    const migrateOne = db.transaction(() => {
      for (const entry of entries) {
        // views.json 格式: [[key, {id, name, createdAt, config}], ...]
        const item = Array.isArray(entry) ? entry[1] : entry;
        if (!item?.id) continue;
        insert.run(
          item.id,
          item.name || '未命名',
          JSON.stringify(item.config || item),
          item.createdAt || new Date().toISOString()
        );
      }
    });

    migrateOne();
    console.log(`[migrate] 从 views.json 迁移了 ${entries.length} 条配置到 SQLite`);

    // 重命名旧文件作为备份
    renameSync(DATA_FILE, DATA_FILE + '.migrated');
    console.log('[migrate] views.json → views.json.migrated（备份）');
  } catch (e) {
    console.error('[migrate] 迁移失败:', e.message);
  }
}
