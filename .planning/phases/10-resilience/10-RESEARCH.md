# Phase 10: Resilience - Research

**Researched:** 2026-03-11
**Domain:** Node/Express error handling, Google OAuth token lifecycle, Google Photos Picker API baseUrl expiry
**Confidence:** HIGH (all findings from direct source code analysis)

## Summary

Phase 10 has three scope items: (1) stale baseUrl fix on server restart, (2) startup env validation, and (3) verifying the token expiry reconnect flow. After reading every relevant source file, the codebase is already in good shape -- the reconnect overlay UI exists and is wired up, the refresh interval logic works, and the per-user cache pattern is solid. The gaps are specific and well-bounded.

The biggest risk is **scope item 1** (stale baseUrl on restart). The photo_cache table has no `refreshed_at` column, and `lastRefresh` is only tracked in-memory. After a restart, `getUserCache()` loads items from DB but sets `lastRefresh: null`, meaning there is no way to know how old the baseUrls are. The refresh interval (`startRefreshInterval()`) is only started when `setItems()` is called (i.e., after a new Picker session), not on cache load from DB. This means after a PM2 restart, existing users' baseUrls will be stale and never refresh until someone runs the Picker again.

**Primary recommendation:** The fix is surgical -- trigger `refreshBaseUrls()` for each user loaded from DB when `getUserCache()` detects items, and start the refresh interval on first DB-loaded cache access.

## What Exists

### Scope 1: Stale baseUrl on Restart

**Cache loading from DB** (`photo-cache.js:47-71`):
- `getUserCache(userId)` lazily loads from DB on first access
- Loads `mediaItems` and `sessionId` from `photo_cache` table
- Sets `lastRefresh: null` and `lastApiCall: null` (timestamps are in-memory only)
- Does NOT trigger any refresh or start the refresh interval

**Refresh mechanism** (`photo-cache.js:211-305`):
- `refreshBaseUrls(userId)` calls Google Picker API `mediaItems.list` with stored `sessionId` to get fresh baseUrls
- Requires: `cache.sessionId` (stored in DB) and `cache.mediaItems.length > 0`
- Updates in-memory cache + persists updated `media_item_data` to DB
- `startRefreshInterval()` runs every 50 min for ALL loaded user caches
- `startRefreshInterval()` is ONLY called from `setItems()` (line 109)

**DB schema for `photo_cache`** (`db/migrate.js:29-37`):
```sql
CREATE TABLE photo_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  media_item_id TEXT NOT NULL,
  media_item_data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, media_item_id)
);
```
- Has `created_at` but NO `refreshed_at` or `updated_at` column
- `media_item_data` is the full JSON blob (includes `mediaFile.baseUrl`)
- baseUrls are updated in-place via `updateItem` prepared statement but no timestamp is recorded for when

**Google baseUrl expiry**: baseUrls expire ~60 minutes after issuance. Refresh interval is 50 min. After a server restart, if the last refresh was >10 minutes ago, some baseUrls will start failing. If >60 minutes ago, ALL baseUrls are dead.

### Scope 2: Startup Env Validation

**Current state -- env vars are accessed ad-hoc, never validated:**

| Env Var | Where Accessed | What Happens If Missing |
|---------|---------------|------------------------|
| `GOOGLE_CLIENT_ID` | `auth.js:93,137,180` (in `new OAuth2Client(...)`) | `OAuth2Client` created with `undefined` -- crashes at first OAuth attempt with cryptic error |
| `GOOGLE_CLIENT_SECRET` | `auth.js:94,138,181` (in `new OAuth2Client(...)`) | Same as above |
| `SESSION_SECRET` | `server.js:63` | Falls back to `'dev-secret-change-in-production'` -- insecure but won't crash |
| `PORT` | `server.js:160` | Falls back to `3100` -- fine |
| `NODE_ENV` | `server.js:74,163` | Used for cookie `secure` flag and logging -- safe defaults |

**No central config module exists.** `dotenv` is loaded at the top of `server.js` (line 1). All env access is via `process.env.X` directly in the files that need it.

**Earliest safe validation point:** After `require('dotenv').config()` on line 1 of `server.js`, before any Express middleware or route mounting. The `db/database.js` module is loaded early (line 7) but doesn't need env vars.

### Scope 3: Token Expiry Reconnect Overlay

**Frontend -- reconnect overlay is fully implemented** (`slideshow.html`):

1. **UI exists** (lines 729-742): `#reconnect-overlay` div with "Session Expired" message and "Reconnect" button
2. **CSS styles exist** (lines 533-617): Full neumorphic card styling
3. **Show/hide helpers** (lines 1083-1092): `showReconnectOverlay()` stops the slideshow; `hideReconnectOverlay()` hides it
4. **Reconnect button wired** (lines 1094-1097): Redirects to `/auth/login` for re-authentication
5. **401 detection** (lines 1236-1241): `loadPhoto()` checks `response.status === 401` and shows overlay
6. **502 + auth check** (lines 1243-1251): Checks 502 body for `authentication_required` string
7. **Init checks** (lines 985-987, 1115-1117): Both `loadAppConfig()` and `init()` check for 401 on startup
8. **Auto-hide on recovery** (lines 1271-1274): Successful fetch hides the overlay if visible

**Backend -- `requireAuth` middleware** (`auth.js:121-130`):
- Returns `401` with `{ error: 'authentication_required' }` for `/api/*` routes when no session
- Redirects to `/login` for page routes

**Backend -- photo-proxy error handling** (`photo-proxy.js:69-149`):
- `client.getAccessToken()` on line 70 can throw if token refresh fails (revoked/expired refresh token)
- Catch block (lines 143-149) returns `502` with `{ error: 'proxy_failed', message: error.message }`
- The `error.message` from `google-auth-library` for revoked tokens is typically `invalid_grant` NOT `authentication_required`

**Backend -- refreshBaseUrls error handling** (`photo-cache.js:246-255`):
- HTTP errors from Google API are logged but silently returned (keeps stale data)
- Token refresh errors in `getAccessToken()` would be caught by the outer catch (line 287) and logged

## Gaps / Work Needed

### Gap 1 (CRITICAL): No baseUrl refresh on restart

After PM2 restart:
1. No user caches are in memory (Map is empty)
2. First request to `/api/photo/random` triggers `getUserCache()` which loads from DB
3. `lastRefresh` is set to `null` -- no staleness detection
4. `startRefreshInterval()` is never called (only called from `setItems()`)
5. Loaded items have stale baseUrls (could be hours/days old)
6. Photo proxy returns 502 (Google rejects expired baseUrl)
7. This continues until someone runs the Picker again or manually hits `/api/health/refresh`

**Work needed:**
- Detect cache age on DB load (compare `created_at` or add `updated_at` column)
- Trigger immediate `refreshBaseUrls()` when cache is loaded from DB and is stale
- Start the refresh interval whenever any user cache is loaded from DB with items

### Gap 2 (MODERATE): No startup env validation

Missing `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` causes a confusing runtime error only when someone tries to log in. Missing `SESSION_SECRET` silently falls back to an insecure default.

**Work needed:**
- Add validation block at top of `server.js` after `dotenv.config()`
- Throw clear error for missing required vars
- Warn (but don't crash) for missing `SESSION_SECRET` in production

### Gap 3 (LOW): Token revocation doesn't trigger reconnect overlay via 502

The slideshow checks for `authentication_required` string in 502 response bodies. But when `getAccessToken()` throws due to a revoked refresh token, `photo-proxy.js` catches it and returns `502` with `message: error.message` (e.g., `"invalid_grant: Token has been expired or revoked."`). The frontend's `bodyText.includes('authentication_required')` check will NOT match this.

However, there is a **partial mitigation**: if the session itself expires (cookie-based, 1 year), `requireAuth` returns a proper `401` which IS detected. The gap is specifically for the case where the session is still valid but the OAuth refresh token has been revoked by the user in their Google account settings.

**Work needed:**
- In `photo-proxy.js`, detect token-related errors from `getAccessToken()` and return a distinguishable error code (either `401` or `502` with `authentication_required`)
- OR: add token-error detection in the catch block and use a consistent error identifier

## Implementation Approach (per scope item)

### Scope 1: Fix stale baseUrl on restart

**Approach A (recommended -- no schema change):**
1. In `getUserCache()`, after loading items from DB, if items exist:
   - Set a flag `needsRefresh: true` on the cache data
   - Schedule an async `refreshBaseUrls(userId)` call (don't await -- let it run in background)
   - Call `startRefreshInterval()` to ensure periodic refresh runs
2. No DB schema change needed -- we always refresh on first load after restart because we can't know the age

**Approach B (schema change -- more precise):**
1. Add `updated_at` column to `photo_cache` via migration v2
2. Update `updateItem` prepared statement to set `updated_at = datetime('now')`
3. In `getUserCache()`, query `MAX(updated_at)` for the user and compare with 50-min threshold
4. Only trigger refresh if cache is actually stale

**Recommendation: Approach A.** Simpler, one extra refresh per user per restart is negligible cost, and avoids a DB migration. The refresh is idempotent and safe.

**Key implementation detail:** `refreshBaseUrls()` is async and calls Google APIs. It must NOT block `getUserCache()` (which is synchronous and called from request handlers). Use a fire-and-forget pattern:
```javascript
// After loading from DB in getUserCache():
if (cacheData.mediaItems.length > 0) {
  // Schedule background refresh (don't block the sync function)
  setImmediate(() => refreshBaseUrls(userId));
  startRefreshInterval();
}
```

### Scope 2: Startup env validation

**Approach:**
1. Add a validation block in `server.js` right after `require('dotenv').config()` (line 1), before any other requires
2. Check for required vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
3. For `SESSION_SECRET`: warn in production mode if missing or set to the default
4. Throw an error with a clear message listing all missing vars

```javascript
// Validate required environment variables
const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const missing = required.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('Create a .env file or set these variables before starting the server.');
  process.exit(1);
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'dev-secret-change-in-production') {
  if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: SESSION_SECRET is not set or using default. Set a strong secret for production.');
  }
}
```

**Placement:** Must be BEFORE line 7 (`const db = require('./db/database')`) because that triggers DB creation. The env validation should be the very first thing after dotenv.

### Scope 3: Verify token expiry reconnect flow

**Fix the 502 body mismatch:**
In `photo-proxy.js`, detect token-related errors from `getAccessToken()` specifically:

```javascript
// In the catch block of /api/photo/random:
catch (error) {
  // Detect token refresh failures (revoked/expired refresh token)
  const isTokenError = error.message?.includes('invalid_grant')
    || error.message?.includes('Token has been')
    || error.response?.status === 401;

  if (isTokenError) {
    return res.status(401).json({ error: 'authentication_required', message: 'Token expired or revoked' });
  }

  // Other errors remain 502
  res.status(502).json({ error: 'proxy_failed', message: error.message });
}
```

**Why return 401 instead of 502:** The frontend already has robust 401 handling (no retry, immediate overlay). Using 401 for "your OAuth token is dead" is semantically correct and aligns with existing frontend logic. The session is still valid, but the user needs to re-authenticate with Google.

**End-to-end verification checklist:**
1. Slideshow loads normally with valid tokens -- confirm no overlay
2. Session expires (clear cookie) -- confirm 401 from `/api/photo/random`, overlay appears
3. Token revoked (simulate by clearing refresh_token in DB) -- confirm overlay appears
4. Click "Reconnect" -- confirm redirect to `/auth/login`
5. Complete OAuth -- confirm redirect back, overlay hidden, slideshow resumes
6. Multi-user: user A's token revoked -- confirm user B's slideshow unaffected

## Risks / Gotchas

### Risk 1: Race condition on startup refresh

If multiple requests hit the server simultaneously after restart for the same user, `getUserCache()` could fire multiple `refreshBaseUrls()` calls. This is safe but wasteful -- `refreshBaseUrls` is idempotent (it replaces data with fresh data from the same API call).

**Mitigation:** Track a `refreshInProgress` flag per user cache to skip duplicate refreshes.

### Risk 2: Picker session expiry vs baseUrl expiry

Picker API sessions have their own lifetime. If a session expires (Google's server-side), `refreshBaseUrls()` will get an error when calling `mediaItems.list` with the expired `sessionId`. Current code handles this gracefully (logs error, returns without throwing, keeps stale data). But after a long server outage, the session may be permanently expired and no refresh will ever succeed.

**Mitigation:** This is an existing limitation, not introduced by Phase 10 changes. The user would need to re-run the Picker to create a new session. Consider logging a clear warning when refresh fails due to session expiry.

### Risk 3: `getAccessToken()` error messages are not stable

The `google-auth-library` error messages for revoked tokens are not contractually stable. Checking for `invalid_grant` is fragile.

**Mitigation:** Check the error object's properties more broadly:
- `error.response?.status === 401` (HTTP status from Google's token endpoint)
- `error.code` if available
- Fall back to string matching as last resort
- Log the full error for debugging regardless

### Risk 4: Fire-and-forget refresh in sync function

`getUserCache()` is synchronous (uses `better-sqlite3` sync API). Scheduling an async refresh via `setImmediate()` means the first request after restart will get stale baseUrls (the refresh hasn't completed yet). The photo proxy will then get a 502 from Google, and the frontend's `fetchWithRetry()` will retry with exponential backoff (up to 7 retries). By retry 2-3, the background refresh should have completed.

**Mitigation:** This is acceptable. The retry logic already exists and handles transient failures. The 60-second success criterion in the phase description allows for this brief window.

### Risk 5: `SESSION_SECRET` fallback in dev

The current code uses `'dev-secret-change-in-production'` as a fallback for `SESSION_SECRET`. Phase 10 should warn but NOT crash on this -- it allows easy local development without a `.env` file.

## Common Pitfalls

### Pitfall 1: Blocking startup with async refresh
**What goes wrong:** Making `getUserCache()` async to await the refresh would break all callers (it's used synchronously in request handlers).
**Prevention:** Keep `getUserCache()` synchronous. Fire-and-forget the refresh.

### Pitfall 2: Validating env vars after modules that use them
**What goes wrong:** If `auth.js` is required before env validation runs, the OAuth2Client constructor may already have captured `undefined` values.
**Prevention:** Validation MUST run before any `require()` that uses env vars. In `server.js`, this means after line 1 (`dotenv`) but before line 7 (`db`) or line 91 (`auth`).

### Pitfall 3: Breaking the refresh interval for existing sessions
**What goes wrong:** If `startRefreshInterval()` is called before `setItems()`, the interval starts with whatever users are loaded. If a user later runs the Picker, their new items also get refreshed (this is correct). But if the implementation accidentally creates a second interval, refresh runs double.
**Prevention:** `startRefreshInterval()` already has a guard: `if (refreshIntervalHandle) return;` -- this is safe.

### Pitfall 4: process.exit(1) in env validation prevents PM2 restart loops
**What goes wrong:** PM2 detects the crash and restarts, then crashes again, in a loop.
**Actually fine:** PM2 has `max_restarts` and `min_uptime` settings. A fast crash is detected as "unstable" and PM2 stops restarting. The error message in logs will be clear. This is the correct behavior for a missing config.

## Sources

### Primary (HIGH confidence)
- `photo-cache.js` -- direct source code analysis (lines 47-71 for DB loading, 211-305 for refresh, 293-305 for interval)
- `server.js` -- direct source code analysis (lines 1-8 for startup, 62-78 for session)
- `auth.js` -- direct source code analysis (lines 89-118 for OAuth2Client, 121-130 for requireAuth)
- `photo-proxy.js` -- direct source code analysis (lines 25-153 for photo proxy and error handling)
- `slideshow.html` -- direct source code analysis (reconnect overlay HTML, CSS, and JS)
- `db/migrate.js` -- direct source code analysis (photo_cache schema, no `updated_at` column)
- `config.js` -- direct source code analysis (no env var usage)

### Secondary (MEDIUM confidence)
- Google Photos Picker API: baseUrls expire ~60 minutes (documented in Google API docs, confirmed by 50-min refresh interval in codebase)
- `google-auth-library` v9.x: `getAccessToken()` throws on revoked refresh tokens with `invalid_grant` message (based on library behavior; exact message format may vary)

## Metadata

**Confidence breakdown:**
- What Exists: HIGH -- all from direct source code reading
- Gaps: HIGH -- identified through systematic analysis of data flow
- Implementation Approach: HIGH -- all patterns already used in the codebase
- Risks: MEDIUM -- token error messages from google-auth-library are based on common behavior, not verified against current library source

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable codebase, no fast-moving dependencies)
