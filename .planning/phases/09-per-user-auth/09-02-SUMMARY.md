---
phase: 09-per-user-auth
plan: 02
subsystem: api
tags: [oauth2, multi-user, photo-cache, config, data-isolation, per-user]

# Dependency graph
requires:
  - phase: 09-per-user-auth
    plan: 01
    provides: "Per-user OAuth2Client factory (getOAuth2ClientForUser), requireAuth middleware, session.userId"
  - phase: 08-database-foundation
    provides: "photo_cache and user_settings tables with user_id FKs"
provides:
  - "Per-user photo cache (Map<userId, CacheData>) with on-demand DB loading"
  - "Per-user config (Map<userId, config>) with on-demand DB loading"
  - "All data modules parameterised by userId (picker, photo-proxy, health, photo-cache, config)"
  - "BaseUrl refresh iterating all active user caches"
  - "Server config routes passing req.session.userId"
affects: [09-03, 10-invite-codes, 11-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-user data cache: Map<userId, CacheData> with lazy DB loading via getUserCache()"
    - "Lazy require('./auth') inside async function to break circular dependency"
    - "Refresh interval iterates all active user caches (not just one global)"
    - "All DB queries use positional ? params with userId (no hardcoded user_id = 1)"

key-files:
  created: []
  modified:
    - "picker.js"
    - "photo-proxy.js"
    - "health.js"
    - "photo-cache.js"
    - "config.js"
    - "server.js"

key-decisions:
  - "Lazy require('./auth') inside refreshBaseUrls to avoid circular dependency (photo-cache -> auth -> db, auth does not require photo-cache)"
  - "getUserCache loads from DB on first access per user (no module-level loadCache call)"
  - "config.js uses all positional parameters (?) instead of mixed positional/named (@) for better-sqlite3 compatibility"
  - "Health endpoint returns basic status with zeroed auth/cache when no userId in session"

patterns-established:
  - "Per-user cache pattern: Map<userId, Data> with getUserCache/getUserConfig lazy initialiser"
  - "All public API functions take userId as first parameter"
  - "No module-level side effects: no loadCache(), no loadConfig() at startup"
  - "Circular dependency avoidance: lazy require inside function body"

# Metrics
duration: 3min
completed: 2026-03-01
---

# Phase 9 Plan 2: Data Module Parameterisation Summary

**All 6 data modules (picker, photo-proxy, health, photo-cache, config, server) parameterised by userId with per-user Map caches and on-demand DB loading**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T13:08:12Z
- **Completed:** 2026-03-01T13:11:30Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- Replaced singleton oAuth2Client in picker.js, photo-proxy.js, and health.js with getOAuth2ClientForUser(req.session.userId)
- Replaced global cache object in photo-cache.js with Map<userId, CacheData> and on-demand DB loading
- Replaced global currentConfig in config.js with Map<userId, config> and on-demand DB loading
- Eliminated all 8 hardcoded user_id = 1 statements across photo-cache.js and config.js
- Updated server.js config API routes to pass req.session.userId
- BaseUrl refresh interval now iterates all active user caches

## Task Commits

Each task was committed atomically:

1. **Task 1: Update picker.js, photo-proxy.js, and health.js to use per-user OAuth2Client** - `5c1796c` (feat)
2. **Task 2: Parameterise photo-cache.js and config.js by userId** - `d0bffcd` (feat)

## Files Created/Modified

- `picker.js` - Per-user OAuth2Client in all 3 routes (start, status, complete), userId passed to photoCache.setItems
- `photo-proxy.js` - Per-user OAuth2Client and all photoCache calls pass userId
- `health.js` - Per-user OAuth2Client and cache stats, basic fallback when no session
- `photo-cache.js` - Map<userId, CacheData>, getUserCache() lazy loader, parameterised DB queries, lazy require for auth, per-user refresh interval
- `config.js` - Map<userId, config>, loadConfig/saveConfig/getConfig all take userId, positional DB params
- `server.js` - Config API routes pass req.session.userId to getConfig/saveConfig

## Decisions Made

- **Lazy require('./auth') in refreshBaseUrls:** photo-cache.js previously imported oAuth2Client at module scope. To avoid circular dependency (and because photo-cache doesn't need auth at load time), the require is done inside the async refreshBaseUrls function body. This is the standard Node.js pattern for breaking circular deps.
- **All positional DB parameters:** config.js previously used mixed positional (?) and named (@settings) parameters in the UPSERT statement. better-sqlite3 does not support mixing styles. Converted to all positional (?, ?) with .run(userId, JSON.stringify(config)).
- **Health endpoint basic fallback:** When health.js is called without a userId in the session (e.g. load balancer health check), it returns a valid response with zeroed auth/cache data rather than throwing.
- **No module-level side effects:** Removed the loadCache() call at module bottom and config.loadConfig() startup call. All data is now loaded on-demand per user. This is essential for multi-user -- you can't load "the" cache at startup when there are multiple users.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- All data modules fully parameterised by userId
- User A's photos, tokens, settings, and API calls are now isolated from User B's
- **Ready for Plan 03:** Downstream verification and integration testing
- **Note:** The old oAuth2Client singleton export from auth.js is no longer referenced anywhere in the codebase. All consumers use getOAuth2ClientForUser.

---
*Phase: 09-per-user-auth*
*Completed: 2026-03-01*
