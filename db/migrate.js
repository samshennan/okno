// db/migrate.js
// Hand-rolled migration runner using PRAGMA user_version
// Source: SQLite PRAGMA user_version pattern (levlaz.org, gluer.org)

function migrate(db) {
  const version = db.pragma('user_version', { simple: true });

  if (version < 1) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          display_name TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          last_login TEXT
        );

        CREATE TABLE tokens (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expiry_date INTEGER,
          scope TEXT,
          token_type TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE photo_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_id TEXT,
          media_item_id TEXT NOT NULL,
          media_item_data TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(user_id, media_item_id)
        );

        CREATE TABLE user_settings (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          settings TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE invite_codes (
          code TEXT PRIMARY KEY,
          created_by INTEGER REFERENCES users(id),
          used_by INTEGER REFERENCES users(id),
          created_at TEXT DEFAULT (datetime('now')),
          used_at TEXT,
          max_uses INTEGER DEFAULT 1,
          use_count INTEGER DEFAULT 0
        );
      `);
      db.pragma('user_version = 1');
    })();
  }

  if (version < 2) {
    db.transaction(() => {
      db.exec('ALTER TABLE photo_cache ADD COLUMN hidden INTEGER DEFAULT 0');
      db.pragma('user_version = 2');
    })();
  }
}

module.exports = { migrate };
