/**
 * HugeScreen — views.json → MySQL 备份脚本
 *
 * 独立运行，不影响现有 server.mjs。
 *
 * 用法：
 *   node backup-to-mysql.mjs              # 手动执行一次
 *   crontab -e 加一行：                    # 每天凌晨 3 点自动备份
 *   0 3 * * * node /home/ubuntu/hugescreen/backup-to-mysql.mjs >> /tmp/hugescreen-backup.log 2>&1
 */

import { createConnection } from 'mysql2/promise';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── 配置 ───
const MYSQL = {
  host: '221.131.69.192',
  port: 33388,
  database: 'dashboard1',
  user: 'dashboard1_user',
  password: 'Dashboard1_2024!',
};

const VIEWS_FILE = join(__dirname, 'views.json');

// ─── 工具 ───

/** 转换 ISO 8601 '2026-07-23T02:52:11.458Z' → MySQL '2026-07-23 02:52:11' */
function toMySQLDatetime(isoStr) {
  if (!isoStr) return null;
  try {
    return new Date(isoStr).toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return null;
  }
}

// ─── 建表（如不存在）───
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS view_backups (
    id          VARCHAR(32)   PRIMARY KEY COMMENT '大屏配置 ID',
    name        VARCHAR(255)  NOT NULL COMMENT '大屏名称',
    config      JSON          NOT NULL COMMENT '完整 ScreenConfig',
    created_at  DATETIME      COMMENT '首次发布时间',
    synced_at   DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近备份时间'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='HugeScreen 大屏配置备份';
`;

async function main() {
  console.log(`[backup] ${new Date().toISOString()} — 开始备份`);

  // 1. 检查 views.json 是否存在
  if (!existsSync(VIEWS_FILE)) {
    console.log('[backup] views.json 不存在，跳过');
    return;
  }

  // 2. 读取配置
  let entries;
  try {
    const raw = readFileSync(VIEWS_FILE, 'utf-8');
    entries = JSON.parse(raw);
    console.log(`[backup] 读取 views.json: ${entries.length} 条配置`);
  } catch (e) {
    console.error('[backup] views.json 解析失败:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    console.log('[backup] 无配置需要备份');
    return;
  }

  // 3. 连接 MySQL
  let conn;
  try {
    conn = await createConnection(MYSQL);
    console.log(`[backup] 连接 MySQL: ${MYSQL.host}:${MYSQL.port}/${MYSQL.database}`);
  } catch (e) {
    console.error('[backup] MySQL 连接失败:', e.message);
    process.exit(1);
  }

  try {
    // 4. 建表
    await conn.execute(CREATE_TABLE);
    console.log('[backup] 确认表 view_backups 就绪');

    // 5. Upsert 每条配置
    const upsertSQL = `
      INSERT INTO view_backups (id, name, config, created_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        config = VALUES(config),
        created_at = VALUES(created_at),
        synced_at = CURRENT_TIMESTAMP
    `;

    let synced = 0;
    let skipped = 0;

    for (const entry of entries) {
      // views.json 格式: [[key, {id, name, createdAt, config}], ...]
      const item = Array.isArray(entry) ? entry[1] : entry;
      if (!item?.id) continue;

      try {
        await conn.execute(upsertSQL, [
          item.id,
          item.name || '未命名',
          JSON.stringify(item.config || item),
          toMySQLDatetime(item.createdAt),
        ]);
        synced++;
      } catch (e) {
        console.error(`[backup] 同步失败 ${item.id}:`, e.message);
        skipped++;
      }
    }

    console.log(`[backup] 完成: 同步 ${synced} 条, 跳过 ${skipped} 条`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[backup] 异常退出:', e.message);
  process.exit(1);
});
