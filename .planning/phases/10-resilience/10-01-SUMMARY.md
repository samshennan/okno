---
phase: 10-resilience
plan: 01
subsystem: api, infra
tags: [env-validation, cache-refresh, token-error-handling, resilience]

# Dependency graph
requires:
  - phase: 09-multi-user-auth
    provides: per-user OAuth2Client cache, per-user photo cache, session-based auth
provides:
  - Startup env validation (fail-fast on missing GOOGLE_CLIENT_ID/SECRET)
  - Immediate baseUrl refresh on server restart (no prolonged stale cache)
  - 401 response for token errors (triggers frontend reconnect overlay)
  - refreshInProgress guard preventing duplicate concurrent refreshes
affects: [11-hide-photo, 12-readme]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-fast env validation before any module loading"
    - "Fire-and-forget setImmediate for background cache refresh"
    - "refreshInProgress mutex flag for async operations"
    - "Token error detection via error.response.status and message string matching"

key-files:
  created: []
  modified:
    - server.js
    - photo-cache.js
    - photo-proxy.js

key-decisions:
  - "Env validation placed after dotenv.config() but before any require() -- fail fast"
  - "SESSION_SECRET only warns in production, not required in dev (has fallback)"
  - "setImmediate for fire-and-forget refresh keeps getUserCache synchronous"
  - "Token error detection uses both error.response.status and message string matching for robustness"

patterns-established:
  - "Fail-fast pattern: validate env vars before loading modules"
  - "Background refresh pattern: serve stale data immediately, refresh async"

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 10 Plan 01: Resilience Summary

**Startup env validation, immediate baseUrl refresh on restart, and 401 token error responses for reconnect overlay**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T10:57:41Z
- **Completed:** 2026-03-12T11:02:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Server exits immediately with clear FATAL message when GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing
- Server restart with existing photo cache triggers immediate background baseUrl refresh via setImmediate
- Token errors (revoked/expired) return 401 + authentication_required, triggering the frontend reconnect overlay
- Duplicate refresh calls prevented by refreshInProgress mutex flag

## Task Commits

Each task was committed atomically:

1. **Task 1: Startup env validation and stale cache refresh on restart** - `b4cd796` (feat)
2. **Task 2: Fix token error response to trigger reconnect overlay** - `e901f72` (feat)

## Files Created/Modified
- `server.js` - Added env validation block after dotenv.config(), before any require()
- `photo-cache.js` - Added refreshInProgress flag, setImmediate refresh on DB load, startRefreshInterval on load
- `photo-proxy.js` - Token error detection in catch block returns 401 instead of 502

## Decisions Made
- Env validation placed after `dotenv.config()` but before `const express = require('express')` -- earliest possible fail point
- SESSION_SECRET is only a warning in production, not a hard requirement (has dev fallback value)
- Used `setImmediate(() => refreshBaseUrls(userId))` to keep `getUserCache()` synchronous while firing background refresh
- Token error detection uses three checks: `error.response?.status === 401`, `invalid_grant` string, `Token has been expired or revoked` string -- covers google-auth-library and raw Google API error formats

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three resilience gaps closed (env validation, stale cache, token error handling)
- Ready for Phase 11 (hide photo) and Phase 12 (README)
- No new blockers introduced

---
*Phase: 10-resilience*
*Completed: 2026-03-12*
