---
phase: 11-photo-management
plan: 01
subsystem: api, database
tags: [sqlite, photo-cache, hide, thumbnail, proxy]

# Dependency graph
requires:
  - phase: 08-database
    provides: "photo_cache table, PRAGMA user_version migration pattern"
  - phase: 09-multi-user
    provides: "per-user cache isolation, session.userId, requireAuth middleware"
  - phase: 10-resilience
    provides: "refreshBaseUrls with mutex, token error detection"
provides:
  - "hidden column in photo_cache (migration v2)"
  - "hideItem/unhideItem/unhideAll/getHiddenItems/hiddenCount cache functions"
  - "POST /api/photo/hide/:id, POST /api/photo/unhide/:id, POST /api/photo/unhide-all"
  - "GET /api/photo/hidden, GET /api/photo/thumbnail/:id"
affects: [11-02-PLAN (frontend UI for hide/unhide)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB+memory dual-write for hide state (DB is source of truth, memory for fast filtering)"
    - "Hidden flag preserved across baseUrl refresh cycles"

key-files:
  created: []
  modified:
    - "db/migrate.js"
    - "photo-cache.js"
    - "photo-proxy.js"

key-decisions:
  - "Hidden items stay in memory cache (not removed) -- needed for unhide without DB reload"
  - "size() returns visible-only count -- hidden photos excluded from reported totals"
  - "Thumbnail proxy uses =w240-h240-c Google param for square crop"
  - "getHiddenItems queries DB directly (not in-memory filter) for consistency"

patterns-established:
  - "Dual-write pattern: DB mutation + in-memory flag update in same function"
  - "Thumbnail proxy pattern: baseUrl + =w240-h240-c with auth header passthrough"

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 11 Plan 01: Hidden Photos Backend Summary

**DB migration v2 with hidden column, cache filtering for all selection functions, hide/unhide API endpoints, and 240x240 thumbnail proxy**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T13:42:40Z
- **Completed:** 2026-03-12T13:47:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migration v2 adds `hidden INTEGER DEFAULT 0` to photo_cache table (idempotent)
- getRandomItem, getOnThisDayItems, getPortraitItems, size() all exclude hidden photos
- refreshBaseUrls preserves hidden flag when merging fresh Google API data
- Five new API endpoints: hide, unhide, unhide-all, hidden list, thumbnail proxy

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration v2 + photo-cache.js hide/unhide logic** - `dcc0064` (feat)
2. **Task 2: API endpoints for hide/unhide/hidden-list/thumbnail** - `775cc7d` (feat)

## Files Created/Modified
- `db/migrate.js` - Added migration v2 block (ALTER TABLE photo_cache ADD COLUMN hidden)
- `photo-cache.js` - 5 new prepared statements, hidden flag propagation in getUserCache, filtering in 3 selection functions + size(), hidden preservation in refreshBaseUrls, 5 new exported functions
- `photo-proxy.js` - 5 new routes (hide, unhide, unhide-all, hidden list, thumbnail proxy)

## Decisions Made
- Hidden items remain in the in-memory cache array (not removed) so unhide works without DB reload
- size() returns visible-only count so health/status endpoints reflect what the user actually sees
- Thumbnail proxy caches for 30 minutes (Cache-Control: private, max-age=1800) since thumbnails change less frequently
- getHiddenItems uses DB query (not in-memory filter) as source of truth for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All backend endpoints ready for frontend consumption in Plan 02
- Frontend can call POST /api/photo/hide/:id with X-Photo-Id from slideshow headers
- Hidden photos grid can use GET /api/photo/hidden + GET /api/photo/thumbnail/:id
- Unhide-all button can call POST /api/photo/unhide-all

---
*Phase: 11-photo-management*
*Completed: 2026-03-12*
