# Phase 8: Database Foundation + Data Migration - Research

**Researched:** 2026-02-27
**Domain:** SQLite database integration, JSON-to-DB migration, schema versioning
**Confidence:** HIGH

## Summary

Phase 8 replaces three JSON files (tokens.json, cache.json, config.json) and a file-based session store with a single SQLite database using better-sqlite3. The migration must be automatic on first startup, transparent to the existing single user, and preserve the original files as .migrated backups until verified.

The standard approach is: (1) create a `db/` module with a singleton better-sqlite3 connection, (2) run a hand-rolled migration runner keyed on `PRAGMA user_version` at startup, (3) detect presence of legacy JSON files and auto-migrate them as the first user, (4) rename originals to `.migrated`, (5) replace all `fs.readFileSync`/`fs.writeFileSync` calls in auth.js, photo-cache.js, and config.js with database reads/writes, (6) swap session-file-store for a SQLite-backed session store.

**Primary recommendation:** Build the DB module and migration runner first, then systematically replace each JSON file consumer one at a time (config.js is simplest, auth.js/tokens next, photo-cache.js/cache last), testing each replacement before moving to the next.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^12.6.2 | Synchronous SQLite driver for Node.js | Fastest SQLite library for Node.js, 43M+ downloads, 8+ years of stability, synchronous API ideal for Express middleware |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-sqlite3-session-store | ^0.1.0 | Express session store backed by SQLite | Replace session-file-store; falls back to hand-rolled ~30-line store if package proves problematic |
| @types/better-sqlite3 | latest | TypeScript definitions for IDE support | devDependency for JSDoc type hints and editor autocomplete |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | node:sqlite (built-in) | Experimental in Node 22, API may change; better-sqlite3 is battle-tested |
| better-sqlite3 | sqlite3 (npm) | Async/callback API is slower and more complex |
| Hand-rolled migration | Knex migrations | Adds CLI tool, config, migration state table -- overkill for ~5 tables |
| Raw SQL | Prisma/Drizzle | Require build step and/or TypeScript -- contradicts project philosophy |
| better-sqlite3-session-store | connect-sqlite3 | Uses the older sqlite3 driver, would require a second SQLite dependency |
| better-sqlite3-session-store | Hand-rolled SqliteSessionStore | ~30 lines, zero dependencies; good fallback if package has issues |

**Installation:**
```bash
npm install better-sqlite3
npm install better-sqlite3-session-store
npm install -D @types/better-sqlite3
npm uninstall session-file-store
```

**Note on native compilation:** better-sqlite3 is a native addon. On the VPS (Ubuntu), ensure `build-essential` and `python3` are installed. Most environments with Node 22 LTS already have prebuilt binaries available.

## Architecture Patterns

### Recommended Project Structure
```
db/
  database.js       # Singleton connection, pragma setup, runs migrations
  migrate.js        # Migration definitions (version 1, 2, 3...)
  seed.js           # Auto-migrate JSON files to DB as first user
data/
  okno.db           # SQLite database file (gitignored)
```

### Pattern 1: Singleton Database Module
**What:** A single module that opens the database, configures pragmas, runs migrations, and exports the connection. Every module that needs data imports `db` from this one file.
**When to use:** Always. better-sqlite3 is synchronous and uses a single connection -- no connection pool needed.
**Example:**
```javascript
// db/database.js
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
db.pragma('foreign_keys = ON');          // Enforce referential integrity
db.pragma('synchronous = NORMAL');       // Safe balance for WAL mode
db.pragma('cache_size = -16000');        // 16MB page cache
db.pragma('temp_store = MEMORY');        // Temp tables in memory

// Run migrations
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
```

### Pattern 2: Hand-Rolled Migration Runner with PRAGMA user_version
**What:** Sequential version checks using SQLite's built-in `PRAGMA user_version`. Each migration block checks the current version and applies schema changes in a transaction.
**When to use:** Instead of Knex/umzug/db-migrate for small schemas that rarely change.
**Example:**
```javascript
// db/migrate.js
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

  // Future: if (version < 2) { ... db.pragma('user_version = 2'); }
}

module.exports = { migrate };
```

### Pattern 3: Auto-Migration from JSON Files (Seed)
**What:** On first startup after upgrade, detect legacy JSON files, read them, insert data as the first user, rename files to `.migrated`.
**When to use:** One-time migration during upgrade from v1.x to v2.0.
**Example:**
```javascript
// db/seed.js
// Source: Codebase analysis of tokens.json, cache.json, config.json structures
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, '..', 'tokens.json');
const CACHE_PATH = path.join(__dirname, '..', 'cache.json');
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function seedFromJson(db) {
  // Only seed if JSON files exist AND users table is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return; // Already migrated

  const hasTokens = fs.existsSync(TOKEN_PATH);
  const hasCache = fs.existsSync(CACHE_PATH);
  const hasConfig = fs.existsSync(CONFIG_PATH);

  if (!hasTokens && !hasCache && !hasConfig) return; // Fresh install

  db.transaction(() => {
    // 1. Create first user (email from env or placeholder)
    const email = process.env.ALLOWED_EMAILS?.split(',')[0]?.trim() || 'owner@local';
    const insertUser = db.prepare(
      'INSERT INTO users (email, display_name, created_at) VALUES (?, ?, datetime(\'now\'))'
    );
    const { lastInsertRowid: userId } = insertUser.run(email, 'Owner');

    // 2. Migrate tokens
    if (hasTokens) {
      try {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        // Skip if tokens look invalid (no refresh_token = dead)
        if (tokens.refresh_token) {
          db.prepare(`
            INSERT INTO tokens (user_id, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            userId,
            tokens.access_token || '',
            tokens.refresh_token,
            tokens.expiry_date || null,
            tokens.scope || null,
            tokens.token_type || null
          );
        }
      } catch (err) {
        console.error('Failed to migrate tokens.json:', err.message);
      }
    }

    // 3. Migrate photo cache
    if (hasCache) {
      try {
        const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
        const items = cache.mediaItems || [];
        const sessionId = cache.sessionId || null;

        // Skip stale items (those without a valid baseUrl)
        const insertItem = db.prepare(`
          INSERT OR IGNORE INTO photo_cache (user_id, session_id, media_item_id, media_item_data, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `);

        let migrated = 0;
        for (const item of items) {
          if (!item.id) continue; // Skip items without ID
          const baseUrl = item.mediaFile?.baseUrl || item.baseUrl;
          // baseUrls expire after ~60min, but we keep the item metadata
          // (baseUrls will be refreshed on next cycle)
          insertItem.run(userId, sessionId, item.id, JSON.stringify(item));
          migrated++;
        }
        console.log(`Migrated ${migrated}/${items.length} photo cache items`);
      } catch (err) {
        console.error('Failed to migrate cache.json:', err.message);
      }
    }

    // 4. Migrate config/settings
    if (hasConfig) {
      try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        db.prepare(`
          INSERT INTO user_settings (user_id, settings, updated_at)
          VALUES (?, ?, datetime('now'))
        `).run(userId, JSON.stringify(config));
      } catch (err) {
        console.error('Failed to migrate config.json:', err.message);
      }
    }
  })(); // Execute transaction immediately

  // 5. Rename JSON files to .migrated
  const renameIfExists = (filePath) => {
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, filePath + '.migrated');
      console.log(`Renamed ${filePath} -> ${filePath}.migrated`);
    }
  };

  renameIfExists(TOKEN_PATH);
  renameIfExists(CACHE_PATH);
  renameIfExists(CONFIG_PATH);

  console.log('JSON-to-DB migration complete');
}

module.exports = { seedFromJson };
```

### Pattern 4: Replacing JSON File Reads with DB Queries
**What:** Each module that currently reads/writes JSON files (auth.js, photo-cache.js, config.js) gets refactored to use the shared `db` instance.
**When to use:** After the DB module and migration runner are working.

**Config module replacement example:**
```javascript
// config.js (after migration)
const db = require('./db/database');

const defaults = {
  interval: 30, displayMode: 'cover', onThisDay: false,
  portraitPairs: false, transitionTime: 1, kenBurns: true,
  blurredBackground: true, showPhotoDate: true, showClock: false,
};

function getConfig(userId) {
  const row = db.prepare('SELECT settings FROM user_settings WHERE user_id = ?').get(userId);
  if (!row) return { ...defaults };
  return { ...defaults, ...JSON.parse(row.settings) };
}

function saveConfig(userId, updates) {
  const current = getConfig(userId);
  // ... validation logic stays the same ...
  const merged = { ...current, ...validated };
  db.prepare(`
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET settings = ?, updated_at = datetime('now')
  `).run(userId, JSON.stringify(merged), JSON.stringify(merged));
  return merged;
}
```

**Auth/token replacement example:**
```javascript
// In auth.js (after migration) -- token persistence functions
const db = require('./db/database');

function loadTokens(userId) {
  const row = db.prepare('SELECT * FROM tokens WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expiry_date: row.expiry_date,
    scope: row.scope,
    token_type: row.token_type,
  };
}

function saveTokens(userId, tokens) {
  db.prepare(`
    INSERT INTO tokens (user_id, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = ?, refresh_token = COALESCE(?, refresh_token),
      expiry_date = ?, scope = ?, token_type = ?, updated_at = datetime('now')
  `).run(
    userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date, tokens.scope, tokens.token_type,
    tokens.access_token, tokens.refresh_token, tokens.expiry_date, tokens.scope, tokens.token_type
  );
}
```

### Pattern 5: Session Store Replacement
**What:** Swap `session-file-store` for a SQLite-backed store sharing the same database connection.
**When to use:** As part of the DB migration, after the database module is set up.
**Example:**
```javascript
// In server.js (after migration)
const db = require('./db/database');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);

app.use(session({
  store: new SqliteStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 900000  // Clean expired sessions every 15 min
    }
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000
  }
}));
```

**Fallback (hand-rolled session store, ~30 lines):**
```javascript
class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired INTEGER NOT NULL
    )`);
  }
  get(sid, cb) {
    const row = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?')
      .get(sid, Date.now());
    cb(null, row ? JSON.parse(row.sess) : null);
  }
  set(sid, sess, cb) {
    const maxAge = sess.cookie?.maxAge || 86400000;
    this.db.prepare('REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)')
      .run(sid, JSON.stringify(sess), Date.now() + maxAge);
    cb(null);
  }
  destroy(sid, cb) {
    this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    cb(null);
  }
}
```

### Anti-Patterns to Avoid
- **Opening multiple database connections:** better-sqlite3 is synchronous, single-threaded. One connection per process is correct. Do not create connection pools.
- **Using async functions inside transactions:** better-sqlite3 transactions are synchronous. Never use `await` inside a `db.transaction()` callback -- it will not work correctly.
- **Forgetting ON DELETE CASCADE:** Without CASCADE on foreign keys, deleting a user would leave orphaned tokens, cache items, and settings. Every child table should reference users(id) ON DELETE CASCADE.
- **Reading JSON files as fallback:** After migration, production code must NEVER fall back to reading JSON files. The DB is the single source of truth. If the DB is empty, that means there is no data -- not "check the JSON file."
- **Manual PRAGMA user_version without transaction:** Always set user_version inside the same transaction as the schema changes. If the schema change fails but user_version was already bumped, the migration state is corrupt.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session store | Custom session serialization | better-sqlite3-session-store (or minimal hand-rolled Store) | Express session Store API handles expiry, cleanup, and edge cases |
| SQL injection protection | String concatenation with escaping | better-sqlite3 prepared statements (`.prepare()` with `?` params) | Prepared statements are immune to SQL injection by design |
| Schema versioning | Custom version tracking table | PRAGMA user_version | Built into SQLite's file header -- zero overhead, zero tables |
| Database connection management | Manual open/close lifecycle | Module-level singleton + process.on('exit') | Node.js module caching gives you a singleton for free |
| JSON backup of DB | Custom JSON export | `fs.copyFileSync()` on the .db file | SQLite DB file is a single file; file copy is a complete backup |

**Key insight:** better-sqlite3's synchronous API eliminates entire categories of problems (callback hell, connection pooling, race conditions on writes) that plague async SQLite drivers. Embrace the synchronous model -- it matches Express request handling perfectly.

## Common Pitfalls

### Pitfall 1: Migration Transaction Not Wrapping PRAGMA user_version
**What goes wrong:** Schema changes succeed but `PRAGMA user_version = N` is set outside the transaction. If the app crashes between schema change and version bump, the next startup tries to re-apply the migration to already-modified tables and fails with "table already exists."
**Why it happens:** `PRAGMA user_version = N` looks like a standalone statement, not part of the DDL.
**How to avoid:** Always set user_version INSIDE the same `db.exec()` call or `db.transaction()` as the schema changes. In better-sqlite3, `db.exec()` runs all statements atomically. Alternatively, wrap in `db.transaction()` and set pragma as the last step.
**Warning signs:** "table already exists" errors on startup after a crash.

### Pitfall 2: Forgetting to Enable foreign_keys PRAGMA on Every Connection
**What goes wrong:** Foreign key constraints are not enforced. ON DELETE CASCADE does not work. Orphaned rows accumulate.
**Why it happens:** SQLite disables foreign keys by default for backward compatibility. The PRAGMA must be set on every new connection (not persisted in the database file).
**How to avoid:** Set `db.pragma('foreign_keys = ON')` immediately after opening the connection, in the database.js module. Since this module is a singleton, it only runs once per process.
**Warning signs:** Deleting a user row does not delete their tokens, cache, or settings.

### Pitfall 3: Async Operations Inside better-sqlite3 Transactions
**What goes wrong:** Transaction appears to work but data is inconsistent. better-sqlite3 transactions are synchronous; any `await` inside the callback will cause the transaction to commit before the async operation completes.
**Why it happens:** JavaScript allows `async` functions anywhere. better-sqlite3 does not throw -- it just ignores the async nature.
**How to avoid:** Never use `async`/`await` inside `db.transaction()`. All operations inside a transaction must be synchronous. If you need async data (like fetching from an API), fetch it BEFORE starting the transaction, then insert the results synchronously.
**Warning signs:** Inconsistent data after transactions that include API calls or file reads.

### Pitfall 4: Not Cleaning Stale Data During Migration
**What goes wrong:** Dead data from JSON files (expired tokens, baseUrls from weeks ago, orphaned session IDs) gets migrated into the clean database, polluting it from day one.
**Why it happens:** Naively reading JSON and inserting everything without validation.
**How to avoid:** During migration, validate each piece of data. Skip tokens without a refresh_token (they cannot be renewed). Skip cache entries without a valid media_item_id. The context explicitly calls for cleaning stale data during migration.
**Warning signs:** Database contains entries that never get used or cause errors on access.

### Pitfall 5: Not Handling the "Fresh Install" Case
**What goes wrong:** The seed script assumes JSON files always exist. On a fresh install (new server, no prior data), the seed script either crashes or creates an empty user record with no data.
**Why it happens:** The migration code only accounts for the "existing user upgrading" scenario.
**How to avoid:** Check BOTH conditions: (a) JSON files exist AND (b) users table is empty. If no JSON files exist and no users exist, this is a fresh install -- skip seeding entirely.
**Warning signs:** An empty "Owner" user in the database on fresh installs.

### Pitfall 6: Renaming JSON Files Before Transaction Commits
**What goes wrong:** JSON files are renamed to .migrated, but the database transaction fails and rolls back. Now the data is gone from both JSON and DB.
**Why it happens:** File rename happens inside or before the transaction completes.
**How to avoid:** Rename files AFTER the transaction has committed successfully. The code pattern is: (1) begin transaction, (2) insert all data, (3) commit, (4) THEN rename files. If the transaction fails, the JSON files remain intact.
**Warning signs:** Data loss during migration if the transaction rolls back.

### Pitfall 7: Storing Entire media_item Objects as JSON Blobs Without Indexing
**What goes wrong:** Photo queries that need to filter by metadata (createTime for On This Day, dimensions for portrait detection) require parsing every JSON blob in JavaScript instead of using SQL WHERE clauses.
**Why it happens:** It seems simpler to store the entire Google API response as a JSON blob.
**How to avoid:** Store the full item as `media_item_data TEXT` (for API compatibility), but also extract frequently-queried fields into dedicated columns if needed for Phase 9+. For Phase 8, the JSON blob approach is acceptable since the current codebase already loads all items into memory and filters in JS. The schema can be evolved in later migrations.
**Warning signs:** Slow photo queries with large collections (2000+ photos).

### Pitfall 8: Session Store Table Colliding with Migration Schema
**What goes wrong:** The better-sqlite3-session-store package creates its own `sessions` table with its own schema. If the migration runner also tries to create a sessions table, or if the session store table creation races with migrations, the app crashes on startup.
**Why it happens:** Two independent systems (migration runner and session store) both want to CREATE TABLE.
**How to avoid:** Let the session store package manage its own table. Do NOT include session table creation in the migration runner. The session store handles table creation internally.
**Warning signs:** "table sessions already exists" errors on startup.

## Code Examples

### Database Connection with All Recommended Pragmas
```javascript
// Source: better-sqlite3 GitHub docs + SQLite PRAGMA cheatsheet (cj.rs)
const Database = require('better-sqlite3');
const db = new Database('./data/okno.db');

// MUST set these on every connection (not persisted in DB file)
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -16000');    // 16MB (negative = KiB)
db.pragma('temp_store = MEMORY');
```

### Transaction for Bulk Insert (Photo Cache Migration)
```javascript
// Source: better-sqlite3 GitHub docs (transaction API)
const insertPhoto = db.prepare(`
  INSERT OR IGNORE INTO photo_cache
    (user_id, session_id, media_item_id, media_item_data, created_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`);

const bulkInsert = db.transaction((userId, sessionId, items) => {
  let count = 0;
  for (const item of items) {
    if (!item.id) continue;
    insertPhoto.run(userId, sessionId, item.id, JSON.stringify(item));
    count++;
  }
  return count;
});

// Usage: const inserted = bulkInsert(1, 'session-abc', mediaItems);
```

### UPSERT Pattern (Save Tokens, Preserve refresh_token)
```javascript
// Source: SQLite UPSERT syntax (ON CONFLICT DO UPDATE)
// Mirrors current auth.js behavior of preserving refresh_token
const saveTokens = db.prepare(`
  INSERT INTO tokens (user_id, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
  VALUES (@userId, @access_token, @refresh_token, @expiry_date, @scope, @token_type, datetime('now'))
  ON CONFLICT(user_id) DO UPDATE SET
    access_token = @access_token,
    refresh_token = COALESCE(@refresh_token, tokens.refresh_token),
    expiry_date = @expiry_date,
    scope = @scope,
    token_type = @token_type,
    updated_at = datetime('now')
`);

// COALESCE(@refresh_token, tokens.refresh_token) preserves existing
// refresh_token if the new one is null -- matches Google's behavior
// where refresh_token is only sent on first authorization.
```

### Querying JSON Data with SQLite json_extract (Optional Optimization)
```javascript
// Source: SQLite JSON1 extension (built-in since SQLite 3.9.0)
// For future optimization: query photo metadata without loading full JSON
const onThisDayPhotos = db.prepare(`
  SELECT media_item_id, media_item_data FROM photo_cache
  WHERE user_id = ?
    AND json_extract(media_item_data, '$.createTime') IS NOT NULL
`).all(userId);
```

### Graceful Shutdown with WAL Checkpoint
```javascript
// Source: better-sqlite3 docs (close method) + SQLite WAL docs
// On clean shutdown, close() triggers automatic checkpoint
process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));
// SQLite automatically checkpoints WAL on clean close, merging
// WAL contents into the main DB file and unlinking -wal/-shm files.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sqlite3 (async, callback) | better-sqlite3 (sync) | 2017+ | Synchronous API eliminates callback complexity; 2-5x faster |
| External migration tools (Knex, umzug) | PRAGMA user_version | Always available | Zero dependencies, built into SQLite header |
| node:sqlite (experimental) | better-sqlite3 (stable) | Node 22+ introduced built-in | node:sqlite still experimental; better-sqlite3 remains standard |
| Connection pools for SQLite | Single connection singleton | better-sqlite3 default | Pooling is unnecessary/harmful for SQLite (single-writer) |
| JSON file persistence | SQLite with WAL | Standard for Node.js apps since ~2020 | ACID transactions, concurrent reads, proper query language |

**Deprecated/outdated:**
- **session-file-store:** Creates one file per session. Does not scale with multiple users. Replace with SQLite session store.
- **Manual JSON merge for token refresh:** Current auth.js reads JSON, merges, writes back. Race condition if two requests refresh simultaneously. SQLite UPSERT is atomic.
- **In-memory cache with periodic JSON flush:** Current photo-cache.js loads everything into memory and writes to JSON periodically. SQLite replaces both the persistence AND the in-memory cache if needed (or can serve as the backing store with a thin memory cache layer).

## Codebase-Specific Analysis

### Files That Must Change

| File | Current JSON Dependency | What Changes |
|------|------------------------|--------------|
| **auth.js** | Reads/writes `tokens.json` (lines 33-78) | Replace `loadTokens()`/`saveTokens()` with DB queries. Remove `fs` import for tokens. Singleton `oAuth2Client` remains for Phase 8 (Phase 9 makes it per-user). |
| **photo-cache.js** | Reads/writes `cache.json` (lines 22, 38-66) | Replace `loadCache()`/`saveCache()` with DB queries. In-memory cache can remain as optimization layer reading from DB on startup. |
| **config.js** | Reads/writes `config.json` (lines 4, 29-37, 87-88) | Replace `loadConfig()`/`saveConfig()` with DB queries. Add `userId` parameter (default to 1 for Phase 8, real user ID in Phase 9). |
| **server.js** | Uses `session-file-store` (line 7, 65-68) | Replace with `better-sqlite3-session-store` or hand-rolled store. Import db module. |
| **health.js** | Reads from photoCache module (indirect) | No direct changes needed; health data comes from photo-cache.js which wraps DB. |

### Data Structures to Migrate

**tokens.json** (from auth.js analysis):
```json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//0e...",
  "scope": "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
  "token_type": "Bearer",
  "expiry_date": 1740000000000
}
```
Maps to: `tokens` table. Skip if `refresh_token` is missing (dead token).

**cache.json** (from photo-cache.js analysis):
```json
{
  "sessionId": "AQR...",
  "mediaItems": [
    {
      "id": "...",
      "createTime": "2024-12-25T10:30:00Z",
      "mediaFile": {
        "baseUrl": "https://...",
        "mimeType": "image/jpeg",
        "mediaFileMetadata": {
          "width": "4032",
          "height": "3024"
        }
      }
    }
  ],
  "lastRefresh": "2026-02-27T10:00:00Z",
  "lastApiCall": "2026-02-27T10:00:00Z"
}
```
Maps to: `photo_cache` table. Each mediaItem becomes a row. `media_item_data` stores the full JSON object for API compatibility. `session_id` stored per-row (latest session from cache.sessionId).

**config.json** (from config.js analysis):
```json
{
  "interval": 30,
  "displayMode": "cover",
  "onThisDay": false,
  "portraitPairs": false,
  "transitionTime": 1,
  "kenBurns": true,
  "blurredBackground": true,
  "showPhotoDate": true,
  "showClock": false
}
```
Maps to: `user_settings` table. Stored as JSON text blob in `settings` column. Merged with defaults on read (same pattern as current config.js).

### Phase 8 Scope Boundary

Phase 8 replaces **persistence only**. It does NOT:
- Add per-user data isolation (Phase 9)
- Change the OAuth flow (Phase 9)
- Add invite codes (Phase 10)
- Change the singleton oAuth2Client (Phase 9)

In Phase 8, the app still operates as single-user. The `user_id` column exists in the schema (pre-wired for Phase 9), but all operations use `user_id = 1` (the migrated first user). The existing `ALLOWED_EMAILS` env var continues to gate access.

## Recommended Migration Sequence

1. **Create db/ module** (database.js + migrate.js) -- DB opens, pragmas set, tables created
2. **Create seed.js** -- reads JSON files, inserts as user 1, renames to .migrated
3. **Replace config.js** -- simplest module, fewest dependencies, good validation target
4. **Replace auth.js token persistence** -- loadTokens/saveTokens use DB instead of JSON
5. **Replace photo-cache.js persistence** -- loadCache/saveCache use DB, keep in-memory layer
6. **Replace session store** -- swap session-file-store for SQLite store in server.js
7. **Verify** -- all JSON reads removed from production paths, .migrated files exist, app works

## Open Questions

1. **Backup cleanup timing**
   - What we know: CONTEXT.md says "delete .migrated JSON backups after verification" with auto-cleanup preferred
   - What's unclear: What constitutes "verified working"? N successful startups? Time-based?
   - Recommendation: Track a `migration_verified_at` timestamp. After 3 successful app startups spanning at least 24 hours, auto-delete .migrated files. Log the deletion. This avoids premature cleanup while not keeping backups forever.

2. **In-memory cache layer for photo-cache.js**
   - What we know: Current photo-cache.js loads all items into memory for O(1) random access. SQLite queries are fast but not as fast as array indexing.
   - What's unclear: Should Phase 8 keep the in-memory array and just change persistence, or switch to querying DB on every photo request?
   - Recommendation: Keep the in-memory array for Phase 8 (minimal change to photo-serving logic). Load from DB on startup instead of from JSON. Write to DB instead of to JSON. This preserves the existing fast random-access pattern while changing only the persistence layer. Phase 9 can reconsider when per-user isolation is added.

3. **DB file location**
   - What we know: CONTEXT.md gives Claude discretion on `data/` vs `db/` directory
   - Recommendation: Use `data/okno.db` in a `data/` directory. This directory will also hold thumbnails in Phase 11 (`data/thumbnails/`). All gitignored persistent data lives in one place. The `db/` directory holds source code (database.js, migrate.js, seed.js).

## Sources

### Primary (HIGH confidence)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) -- API docs, version 12.6.2, constructor options, pragma/prepare/transaction/exec methods
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) -- v12.6.2, published January 2026
- [SQLite WAL documentation](https://sqlite.org/wal.html) -- official docs on concurrent reads, automatic checkpoint on close
- [SQLite PRAGMA reference](https://sqlite.org/pragma.html) -- all PRAGMAs including user_version, journal_mode, foreign_keys
- [SQLite PRAGMA cheatsheet](https://cj.rs/blog/sqlite-pragma-cheatsheet-for-performance-and-consistency/) -- recommended production PRAGMAs with explanations
- [SQLite DB Migrations with PRAGMA user_version](https://levlaz.org/sqlite-db-migrations-with-pragma-user_version/) -- migration runner pattern
- [SQLite user_version for schema versioning](https://gluer.org/blog/sqlites-user_version-pragma-for-schema-versioning/) -- version checking approach

### Secondary (MEDIUM confidence)
- [better-sqlite3-session-store npm](https://www.npmjs.com/package/better-sqlite3-session-store) -- v0.1.0, last updated 4+ years ago but functional
- [Express session Store API](https://expressjs.com/en/resources/middleware/session.html) -- custom store implementation contract
- [Understanding better-sqlite3 (DEV.to)](https://dev.to/lovestaco/understanding-better-sqlite3-the-fastest-sqlite-library-for-nodejs-4n8) -- community patterns and practices
- [Database School - SQLite recommended PRAGMAs](https://databaseschool.com/articles/sqlite-recommended-pragmas) -- production PRAGMA guide

### Tertiary (LOW confidence)
- None. All critical findings verified against GitHub docs or official SQLite documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- better-sqlite3 v12.6.2 verified on npm/GitHub, PRAGMA patterns verified against official SQLite docs
- Architecture: HIGH -- singleton module pattern is documented best practice for better-sqlite3, migration runner verified against multiple sources
- Pitfalls: HIGH -- derived from codebase analysis of actual file structures (tokens.json, cache.json, config.json) cross-referenced with SQLite documentation
- Code examples: HIGH -- all examples use verified API (prepare, run, get, all, transaction, exec, pragma) from better-sqlite3 docs

**Codebase analysis performed on:**
- `server.js` (148 lines) -- Express app setup, session store, route mounting
- `auth.js` (210 lines) -- OAuth flow, token load/save to tokens.json
- `photo-cache.js` (267 lines) -- Photo cache with cache.json persistence
- `config.js` (108 lines) -- Config with config.json persistence
- `photo-proxy.js` (151 lines) -- Photo proxy using oAuth2Client and photoCache
- `picker.js` (194 lines) -- Picker API using oAuth2Client and photoCache
- `health.js` (73 lines) -- Health endpoint reading from photoCache
- `feedback.js` (242 lines) -- Feedback system (not migrated, uses separate files)
- `demo-photos.js` (60 lines) -- Demo mode (isolated, no migration needed)

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable domain, 30-day validity)
