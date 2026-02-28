---
phase: 08-database-foundation
plan: 02
subsystem: persistence
tags: [sqlite, config, auth, db-migration]

# Dependency graph
requires:
  - phase: 08-01
    provides: "DB singleton, users/tokens/user_settings tables"
provides:
  - "config.js reads/writes user_settings table via SQLite"
  - "auth.js reads/writes tokens table via SQLite"
affects: [08-03, 09-auth]

# Tech tracking
tech-stack:
  patterns: [prepared-statements, upsert-coalesce, lazy-init-statements]

key-files:
  modified: [config.js, auth.js]

key-decisions:
  - "Lazy-initialized prepared statements for performance"
  - "COALESCE(new_refresh_token, existing_refresh_token) preserves token across OAuth refresh events"
  - "user_id=1 hardcoded for Phase 8 single-user (Phase 9 adds dynamic user resolution)"

# Metrics
duration: 5 min
completed: 2026-02-28
---

# Phase 8 Plan 02: Config + Auth DB Migration Summary

**Replaced JSON file persistence in config.js and auth.js with SQLite queries via better-sqlite3 prepared statements**

## Performance
- Duration: 5 min (verification and commit of pre-written code)
- Tasks: 2
- Files modified: 2

## Accomplishments
- config.js now reads/writes user settings via `user_settings` table with JSON column
- auth.js now reads/writes OAuth tokens via `tokens` table with UPSERT
- COALESCE pattern preserves refresh_token when Google sends token refresh events (Google only includes refresh_token on first authorisation)
- Lazy-initialized prepared statements avoid creating DB statements until first use
- Token refresh events (`oAuth2Client.on('tokens')`) persist directly to DB
- Both modules verified: no remaining references to JSON files, fs, readFileSync, or writeFileSync

## Task Commits
1. **Task 1: config.js DB migration** -- `d014113` (refactor)
2. **Task 2: auth.js DB migration** -- `e4e0ad0` (refactor)

## Files Modified
- `config.js` -- Replaced `config.json` file read/write with `user_settings` table queries; lazy-init prepared statements for SELECT/UPSERT
- `auth.js` -- Replaced `tokens.json` file read/write with `tokens` table queries; COALESCE-based UPSERT preserves refresh_token; removed fs import entirely

## Decisions Made
- Lazy-initialized prepared statements (created on first call, not at module load) -- avoids issues if DB is not ready at import time
- COALESCE pattern for refresh_token preservation -- Google only sends refresh_token on initial consent; subsequent token refreshes omit it, so we must never overwrite it with null
- user_id=1 hardcoded throughout -- Phase 9 will introduce dynamic user resolution via session

## Deviations from Plan
- Task 1 was completed in a previous session and already committed (d014113). Task 2 code was also written in the previous session; this execution verified and committed it.

## Issues Encountered
None.

## Next Phase Readiness
- config.js and auth.js now read/write exclusively from SQLite
- No JSON file references remain in either module
- Plan 08-03 can proceed to migrate photo-cache.js and the session store
