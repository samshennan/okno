---
phase: 09-per-user-auth
plan: 01
subsystem: auth
tags: [oauth2, multi-user, express-session, google-auth-library, middleware]

# Dependency graph
requires:
  - phase: 08-database-foundation
    provides: "users table, tokens table with user_id FKs, SQLite with better-sqlite3"
provides:
  - "Per-user OAuth2Client factory (getOAuth2ClientForUser)"
  - "requireAuth middleware for route protection"
  - "User UPSERT on OAuth callback with session.userId"
  - "Branded /login page with Google sign-in"
  - "ALLOWED_EMAILS gate with redirect to error page"
affects: [09-02, 09-03, 10-invite-codes, photo-proxy, picker, health, photo-cache, config]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-user OAuth2Client cache (Map<userId, OAuth2Client>) instead of singleton"
    - "requireAuth middleware: 401 JSON for /api/*, 302 redirect for pages"
    - "Transient OAuth2Client for login/callback (no user known yet)"
    - "User UPSERT with RETURNING id for atomic find-or-create"

key-files:
  created:
    - "public/login.html"
  modified:
    - "auth.js"
    - "server.js"

key-decisions:
  - "Per-user OAuth2Client cache avoids token refresh race conditions vs per-request creation"
  - "req.originalUrl for API detection in requireAuth (req.path is relative to mount point)"
  - "express.static with index:false after explicit auth-gated HTML routes"
  - "Transient OAuth2Client for login/callback flows (user identity unknown at that point)"
  - "Removed config.loadConfig() startup call (per-user config loading deferred to Plan 02)"

patterns-established:
  - "Per-user client cache: Map<userId, OAuth2Client> with lazy DB token loading"
  - "Auth-gated page routes: explicit app.get with requireAuth before express.static"
  - "Session identity: req.session.userId (integer) replaces req.session.authenticated (boolean)"

# Metrics
duration: 5min
completed: 2026-03-01
---

# Phase 9 Plan 1: Auth Foundation Summary

**Per-user OAuth2Client factory, requireAuth middleware, user UPSERT on OAuth callback, and branded /login page with route protection for all protected endpoints**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-01T12:59:30Z
- **Completed:** 2026-03-01T13:04:35Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Replaced global singleton OAuth2Client with per-user client cache keyed by userId
- OAuth callback now UPSERTs user by email, saves tokens per user_id, sets req.session.userId
- requireAuth middleware gates all protected routes (401 for APIs, 302 redirect for pages)
- Branded login page with neumorphic design, Google sign-in button, and error display
- ALLOWED_EMAILS gate redirects to /login?error=not_authorised instead of raw text

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite auth.js -- per-user OAuth2Client, user UPSERT, requireAuth** - `666a210` (feat)
2. **Task 2: Login page + route protection in server.js** - `b3f58cd` (feat)

## Files Created/Modified

- `auth.js` - Per-user OAuth2Client factory, requireAuth middleware, user UPSERT on callback, parameterised token statements
- `server.js` - Route protection with requireAuth on all protected routes, /login route, removed config.loadConfig() startup call
- `public/login.html` - Branded login page with neumorphic Okno design, Google sign-in, error messages, auth status check

## Decisions Made

- **Per-user client cache over per-request creation:** Using `Map<userId, OAuth2Client>` avoids the token refresh race condition documented in 09-RESEARCH.md (Pitfall 2). If two requests for the same user share the same OAuth2Client instance, the library's internal pending promise prevents double-refresh.
- **req.originalUrl in requireAuth:** Discovered during testing that `req.path` is relative to the Express mount point. When requireAuth is used as `app.use('/api/photo', requireAuth, router)`, `req.path` would be `/random` not `/api/photo/random`. Using `req.originalUrl` gives the full path.
- **express.static with index:false:** Prevents express.static from serving index.html for `/`. Auth-gated explicit routes for HTML pages are registered before express.static so they take precedence.
- **Removed config.loadConfig():** The startup call loaded user_id=1 config into memory. Plan 02 will parameterise config by userId. Removing now avoids inconsistency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed requireAuth using req.path instead of req.originalUrl**
- **Found during:** Task 2 (route protection verification)
- **Issue:** requireAuth checked `req.path.startsWith('/api/')` but when mounted as middleware via `app.use('/api/photo', requireAuth, router)`, `req.path` is `/random` (relative to mount), not `/api/photo/random`
- **Fix:** Changed to `req.originalUrl.startsWith('/api/')` which always contains the full request path
- **Files modified:** auth.js
- **Verification:** `curl -s http://localhost:3100/api/photo/random` returns `{"error":"authentication_required"}` with 401 status
- **Committed in:** b3f58cd (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct API route protection. No scope creep.

## Issues Encountered

None beyond the req.path bug documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Auth foundation complete: userId flows through session, per-user OAuth2Client cache works
- **Ready for Plan 02:** Token isolation -- downstream modules (picker.js, photo-proxy.js, photo-cache.js, health.js) still import the old `oAuth2Client` singleton export (now undefined). Plan 02 must update these to use `getOAuth2ClientForUser(req.session.userId)`
- **Ready for Plan 03:** Data isolation -- photo-cache.js and config.js still use hardcoded `user_id = 1`. Plan 03 must parameterise by userId
- **Note:** Existing `oAuth2Client` export removed from auth.js. Downstream modules will get `undefined` when destructuring. This is intentional -- routes will fail when called without auth (which they now require), and Plan 02 will fix the actual consumer code.

---
*Phase: 09-per-user-auth*
*Completed: 2026-03-01*
