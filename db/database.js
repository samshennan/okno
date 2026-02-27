// db/database.js
// Singleton better-sqlite3 connection with production pragmas
// Source: better-sqlite3 GitHub docs + SQLite PRAGMA cheatsheet (cj.rs)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'okno.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Production pragmas (order matters: journal_mode first)
db.pragma('journal_mode = WAL');         // Concurrent reads + single writer
db.pragma('busy_timeout = 5000');        // Wait 5s for locks before SQLITE_BUSY
db.pragma('foreign_keys = ON');          // Enforce referential integrity (Pitfall 2)
db.pragma('synchronous = NORMAL');       // Safe balance for WAL mode
db.pragma('cache_size = -16000');        // 16MB page cache
db.pragma('temp_store = MEMORY');        // Temp tables in memory

// Run migrations (creates tables if needed)
const { migrate } = require('./migrate');
migrate(db);

// Auto-migrate JSON files if they exist and DB is empty
const { seedFromJson } = require('./seed');
seedFromJson(db);

// Graceful shutdown: close DB on process exit
process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

module.exports = db;
