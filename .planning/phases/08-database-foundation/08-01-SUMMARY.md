---
phase: 08-database-foundation
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, wal, migration, seed, schema]

# Dependency graph
requires:
  - phase: none
    provides: "First plan in v2.0 -- builds on existing JSON-file persistence from v1.0"
provides:
  - "Singleton better-sqlite3 connection via require('./db/database')"
  - "5-table schema: users, tokens, photo_cache, user_settings, invite_codes"
  - "PRAGMA user_version migration runner for future schema changes"
  - "One-time JSON-to-DB auto-migration (tokens.json, cache.json, config.json)"
affects: [08-02, 08-03, 09-auth, 10-invite-codes, 11-thumbnails]

# Tech tracking
tech-stack:
  added: [better-sqlite3@12.6.2, "@types/better-sqlite3@7.6.13"]
  patterns: [singleton-db-connection, pragma-user-version-migration, json-to-db-seed, wal-mode]

key-files:
  created: [db/database.js, db/migrate.js, db/seed.js]
  modified: [package.json, package-lock.json, .gitignore]

key-decisions:
  - "PRAGMA user_version for migration versioning (no external migration tool)"
  - "Transaction-wrapped schema creation with version inside transaction"
  - "Seed only runs when users table is empty (idempotent guard)"
  - "JSON files renamed to .migrated after successful transaction commit"
  - "data/ directory for all SQLite files (okno.db + future thumbnails)"

patterns-established:
  - "DB singleton: require('./db/database') returns ready-to-use better-sqlite3 instance"
  - "Migration pattern: check user_version, run DDL in transaction, bump version"
  - "Seed pattern: check if table empty, read JSON, insert, rename source files"
  - "Graceful shutdown: process.on('exit') closes DB connection"

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 8 Plan 01: Database Foundation Summary

**Singleton better-sqlite3 connection with WAL mode, 5-table schema via PRAGMA user_version migration, and JSON-to-DB auto-seed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T10:02:30Z
- **Completed:** 2026-02-27T10:05:05Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Installed better-sqlite3 with native compilation (production dep) and @types (dev dep)
- Created 5-table schema (users, tokens, photo_cache, user_settings, invite_codes) with foreign key cascades
- Built PRAGMA user_version migration runner for incremental schema evolution
- Built JSON-to-DB auto-migration that reads legacy files and renames to .migrated
- Configured WAL mode, busy_timeout, foreign_keys, synchronous=NORMAL, 16MB cache
- Added data/ to .gitignore for SQLite files

## Task Commits

Each task was committed atomically:

1. **Task 1: Install better-sqlite3 and update .gitignore** - `4e2cc01` (chore)
2. **Task 2: Create db/database.js, db/migrate.js, and db/seed.js** - `a1e4c4a` (feat)

## Files Created/Modified
- `db/database.js` - Singleton better-sqlite3 connection with production pragmas, auto-migration, graceful shutdown
- `db/migrate.js` - Schema migration runner using PRAGMA user_version (creates 5 tables at version 1)
- `db/seed.js` - One-time JSON-to-DB auto-migration (tokens.json, cache.json, config.json -> user 1)
- `package.json` - Added better-sqlite3 dependency
- `package-lock.json` - Lock file updated
- `.gitignore` - Added data/ directory

## Decisions Made
- Used PRAGMA user_version for migration versioning -- no external migration tool needed, aligns with v2.0 decision log
- Set user_version inside the transaction (not after) to ensure atomicity
- Seed guard checks `SELECT COUNT(*) FROM users` -- prevents re-migration on restart
- JSON files renamed to .migrated only after transaction commits -- prevents data loss on crash
- Created data/ directory for all SQLite files, separate from project root
- invite_codes table pre-wired for Phase 10 (empty schema, no data)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `require('./db/database')` returns a fully initialized, ready-to-use DB connection
- Plan 02 can wire auth module to use `users` and `tokens` tables
- Plan 03 can wire session store and photo cache to use DB
- All tables have foreign key cascades for safe user deletion
- Migration runner ready for future schema changes (version < 2 block)

---
*Phase: 08-database-foundation*
*Completed: 2026-02-27*
