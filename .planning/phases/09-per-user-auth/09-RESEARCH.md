# Phase 9: Per-User Auth + Data Isolation - Research

**Researched:** 2026-02-28
**Domain:** Express session-based multi-user auth, SQLite per-user data isolation
**Confidence:** HIGH (codebase analysis, all source directly inspected)

## Summary

Phase 9 transforms a single-user photo frame into a multi-user deployment where each Google account gets fully isolated photos, tokens, settings, and slideshow. The current codebase is structurally ready for this: the DB schema already has `user_id` foreign keys on every table, but every query hardcodes `user_id = 1`. The OAuth2Client is a global singleton shared across all requests. The photo cache is a module-level in-memory object with no user scoping.

The work splits into three clear domains: (1) make auth create/resolve real users and store userId in the session, (2) parameterise every DB query and in-memory cache by userId, (3) add the login/logout UI surface per the CONTEXT.md decisions.

**Primary recommendation:** Parameterise the three data modules (auth.js, photo-cache.js, config.js) by userId, eliminate the singleton OAuth2Client pattern, and add a `requireAuth` middleware that rejects unauthenticated requests to all routes except `/login`, `/auth/*`, `/demo*`, and static assets.

## Current Codebase Analysis

### 1. Current Auth Flow

**File:** `auth.js` (222 lines)

The auth flow works like this:
1. `GET /auth/login` -- generates a Google OAuth URL with CSRF state stored in `req.session.oauthState`, redirects browser to Google
2. `GET /auth/callback` -- exchanges code for tokens, checks `ALLOWED_EMAILS` env var against userinfo endpoint, saves tokens to DB (hardcoded `user_id = 1`), sets `req.session.authenticated = true`
3. `GET /auth/status` -- returns auth status by checking `req.session.authenticated` OR presence of tokens on the singleton OAuth2Client
4. `POST /auth/logout` -- destroys session

**Critical singleton pattern:** A single `oAuth2Client` instance is created at module scope (line 27-30) and exported to `picker.js`, `photo-proxy.js`, `photo-cache.js`, and `health.js`. All token operations go through this one object. This is the #1 architectural problem for multi-user.

**SCOPES:** Only `['https://www.googleapis.com/auth/photospicker.mediaitems.readonly']`. The callback already calls the userinfo endpoint (line 159) to get the user's email for ALLOWED_EMAILS checking -- this works because Google's OAuth2 flow provides basic profile access with any scope, but adding `openid email profile` explicitly would be more robust.

### 2. Current DB Schema

**File:** `db/migrate.js` (62 lines)

Schema (migration version 1):

```sql
-- Already has user_id FKs everywhere -- good foundation
users (id, email, display_name, created_at, last_login)
tokens (user_id PK -> users, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
photo_cache (id, user_id -> users, session_id, media_item_id, media_item_data, created_at, UNIQUE(user_id, media_item_id))
user_settings (user_id PK -> users, settings JSON, updated_at)
invite_codes (code PK, created_by -> users, used_by -> users, created_at, used_at, max_uses, use_count)
```

The schema is already multi-user ready. No schema migration needed. The `invite_codes` table already exists for Phase 10.

### 3. Hardcoded user_id = 1 -- Complete List

| File | Line | Statement | Type |
|------|------|-----------|------|
| `auth.js` | 38 | `SELECT * FROM tokens WHERE user_id = 1` | SELECT |
| `auth.js` | 41 | `VALUES (1, @access_token, ...)` | INSERT/UPSERT |
| `photo-cache.js` | 40 | `SELECT ... FROM photo_cache WHERE user_id = 1` | SELECT |
| `photo-cache.js` | 43 | `VALUES (1, ?, ?, ?, datetime('now'))` | INSERT |
| `photo-cache.js` | 45 | `UPDATE photo_cache SET session_id = ? WHERE user_id = 1` | UPDATE |
| `photo-cache.js` | 46 | `UPDATE ... WHERE user_id = 1 AND media_item_id = ?` | UPDATE |
| `config.js` | 25 | `SELECT settings FROM user_settings WHERE user_id = 1` | SELECT |
| `config.js` | 28 | `VALUES (1, @settings, datetime('now'))` | INSERT/UPSERT |

**Total: 8 hardcoded statements across 3 files.**

### 4. Current Session Contents

| Key | Where Set | Where Read | Purpose |
|-----|-----------|------------|---------|
| `req.session.oauthState` | `auth.js:116` | `auth.js:138` | CSRF protection during OAuth flow |
| `req.session.authenticated` | `auth.js:185` | `auth.js:199` | Boolean flag for auth status |
| `req.session.pickerSessionId` | `picker.js:52` | (not read anywhere) | Unused -- stored but never consumed |

**Missing:** `req.session.userId` -- this is the key addition for Phase 9. Every route needs to resolve the current user from the session.

### 5. Global/Singleton State That Must Become Per-User

| Component | File | Current State | What Must Change |
|-----------|------|---------------|-----------------|
| `oAuth2Client` | `auth.js:27` | Single instance, credentials set globally | Create per-user OAuth2Client instances (or load credentials per-request) |
| `cache` object | `photo-cache.js:24-29` | Single in-memory `{ sessionId, mediaItems[], lastRefresh, lastApiCall }` | Keyed by userId -- `Map<userId, cache>` or load from DB per-request |
| `currentConfig` | `config.js:17` | Single in-memory config object | Keyed by userId or load from DB per-request |
| Token refresh listener | `auth.js:94` | `oAuth2Client.on('tokens', ...)` on singleton | Per-user token refresh |
| `refreshIntervalHandle` | `photo-cache.js:32` | Single `setInterval` for baseUrl refresh | Per-user refresh intervals |
| `loadTokens()` on startup | `auth.js:100` | Loads user_id=1 tokens into singleton on module init | Remove startup load; load per-request |
| `loadCache()` on startup | `photo-cache.js:285` | Loads user_id=1 cache into memory on module init | Remove startup load; load per-user on demand |
| `config.loadConfig()` | `server.js:109` | Loads user_id=1 settings into memory on startup | Remove startup load; load per-user on demand |

### 6. Photo Serving Architecture

**Flow:** `slideshow.html` -> `GET /api/photo/random` -> `photo-proxy.js` -> uses `oAuth2Client.getAccessToken()` -> fetches from Google -> proxies bytes back

1. `photo-proxy.js` imports the singleton `oAuth2Client` from `auth.js`
2. It calls `photoCache.getRandomItem()` to pick a photo from the module-level cache
3. It calls `oAuth2Client.getAccessToken()` to get a valid token (auto-refreshes if expired)
4. It fetches the image from Google with the Bearer token and proxies the bytes back

**baseUrl refresh:** `photo-cache.js:refreshBaseUrls()` runs on a 50-minute interval (line 21). It uses the singleton `oAuth2Client` to re-fetch media items and update the in-memory cache. The DB is also updated.

**For multi-user:** Each user needs their own token for Google API calls, their own photo cache (in-memory and DB), and their own baseUrl refresh cycle.

### 7. Frontend Files Needing Updates

| File | What Needs to Change |
|------|---------------------|
| `public/index.html` | Currently the landing page for both auth and unauth. Must redirect unauth to `/login`. Auth users see their photo count + slideshow button. The picker flow stays here. |
| `public/slideshow.html` | Fetches from `/api/photo/random` and `/api/config` -- no changes needed if the backend correctly scopes by session userId. Must handle 401/403 responses (redirect to login). |
| `public/settings.html` | Fetches from `/api/config` -- needs a logout button added. Must handle 401 (redirect to login). |
| `public/sw.js` | Service worker caches photos -- the cache is device-local so isolation is natural (one user per device). No changes needed. |
| `public/demo.html` | Isolated, no auth -- no changes needed. |

**Key insight:** Because the model is "one user per device", the frontend changes are minimal. The session cookie handles user identity transparently. The main frontend additions are: (1) redirect to `/login` when unauthenticated, (2) handle 401 responses gracefully, (3) add logout button to settings.

### 8. Login/Auth Flow -- What It Must Become

Per CONTEXT.md decisions:

```
Unauthenticated visitor:
  GET / -> 302 to /login
  /login -> branded page with "Sign in with Google" button
  Click -> /auth/login -> Google OAuth -> /auth/callback

Auth callback (new flow):
  1. Exchange code for tokens
  2. Call userinfo to get email + display_name
  3. Check ALLOWED_EMAILS (if set) -- reject with clear message if not allowed
  4. UPSERT user into users table (find by email, create if new)
  5. Save tokens to tokens table for that user_id
  6. Set req.session.userId = user.id
  7. Redirect to / (which now shows their dashboard/slideshow)

Already-logged-in user:
  GET /login -> 302 to /

Logout:
  POST /auth/logout -> destroy session -> 302 to /login
  (Settings page gets a logout button)

Token expiry:
  /api/photo/random returns 401/502 -> slideshow shows reconnect overlay
  Overlay has "Reconnect" button -> triggers /auth/login directly
```

### 9. Migration Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing user_id=1 data orphaned | LOW | The seed.js already creates a user row for user_id=1. Existing data will "just work" once the first user logs in and gets assigned user_id=1 (if they're the same person) OR we can run a one-time migration to associate existing data with the first user to authenticate |
| Session invalidation on deploy | NONE | CONTEXT.md explicitly says "re-login is acceptable after the Phase 9 VPS deploy" |
| Singleton OAuth2Client cached in other modules | HIGH | `photo-cache.js`, `photo-proxy.js`, `picker.js`, and `health.js` all import `oAuth2Client` at module scope. Must change every import site |
| In-memory cache data loss | LOW | Cache is backed by DB. Per-user cache can be loaded from DB on demand |
| baseUrl refresh interval per-user | MEDIUM | Currently one global setInterval. Need per-user intervals or a single interval that refreshes all active users |
| `config.loadConfig()` called at startup in server.js | LOW | Remove this call; config loads per-user on request |

### 10. Recommended Plan Breakdown

Based on the analysis, the natural plan boundaries are:

**Plan 1: Auth foundation (user creation + session userId)**
- Add `requireAuth` middleware (checks `req.session.userId`, returns 401 or redirects)
- Update `/auth/callback` to UPSERT user in DB, store `req.session.userId`
- Update `/auth/status` to use session userId
- Update `/auth/logout` to redirect to `/login`
- Add `/login` page (branded, "Sign in with Google")
- Wire ALLOWED_EMAILS gate (already partially exists, needs proper error page)
- Add OAuth scopes for `openid email profile`

**Plan 2: Token isolation (per-user OAuth2Client)**
- Remove singleton `oAuth2Client` from auth.js
- Create a function `getOAuth2ClientForUser(userId)` that loads tokens from DB and returns a configured client
- Update auth.js `loadTokens`/`saveTokens` to accept userId parameter
- Update `picker.js` to get OAuth client from session userId
- Update `photo-proxy.js` to get OAuth client from session userId
- Update `health.js` to use per-user token info
- Handle token refresh events per-user (save back to correct user's row)

**Plan 3: Data isolation (photo cache + config per-user)**
- Parameterise `photo-cache.js` prepared statements by userId
- Change in-memory cache to `Map<userId, CacheData>`
- Parameterise `config.js` prepared statements by userId
- Change `config.js` to load/save per-user (no global `currentConfig`)
- Update `/api/config` routes in server.js to pass userId
- Update `photo-cache.refreshBaseUrls()` to work per-user
- Per-user baseUrl refresh scheduling

**Plan 4: Frontend + route protection**
- Add `requireAuth` to all API routes (except `/auth/*`, `/demo*`, `/login`, static)
- Create `/login` page (new HTML file)
- Update `index.html` to redirect unauthenticated to `/login`
- Add logout button to settings.html
- Add reconnect overlay to slideshow.html (for token expiry)
- Handle 401 responses in slideshow.html and settings.html (redirect to login)

## Architecture Patterns

### Pattern 1: Per-Request User Resolution (not singleton)

**What:** Instead of a singleton OAuth2Client loaded at startup, create/configure an OAuth2Client per request using the session's userId to load tokens from DB.

**Why:** The singleton pattern is fundamentally incompatible with multi-user. Two users' tokens would clobber each other.

**Implementation approach:**
```javascript
// auth.js -- replace singleton with factory function
function createOAuth2Client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
}

async function getAuthenticatedClient(userId) {
  const client = createOAuth2Client();
  const tokens = getTokensFromDb(userId);
  if (tokens) {
    client.setCredentials(tokens);
  }
  client.on('tokens', (newTokens) => {
    saveTokensToDb(userId, newTokens);
  });
  return client;
}
```

**In route handlers:**
```javascript
router.get('/random', async (req, res) => {
  const userId = req.session.userId;
  const client = await getAuthenticatedClient(userId);
  const { token } = await client.getAccessToken();
  // ... use token for Google API call
});
```

### Pattern 2: requireAuth Middleware

**What:** Express middleware that checks `req.session.userId` and rejects/redirects if missing.

```javascript
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    // API routes get 401, page routes get redirect
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/login');
  }
  next();
}
```

### Pattern 3: Per-User In-Memory Cache with DB Backing

**What:** Replace the module-level `cache` object with a Map keyed by userId. Load from DB on first access, keep in memory for performance.

```javascript
const userCaches = new Map();

function getUserCache(userId) {
  if (!userCaches.has(userId)) {
    // Load from DB
    const rows = stmtSelectAll.all(userId);
    userCaches.set(userId, {
      sessionId: rows[0]?.session_id || null,
      mediaItems: rows.map(r => JSON.parse(r.media_item_data)),
      lastRefresh: null,
      lastApiCall: null
    });
  }
  return userCaches.get(userId);
}
```

### Anti-Patterns to Avoid

- **Global state for user data:** Never store per-user data in module-level variables without keying by userId
- **Trusting `req.session.authenticated` alone:** Must use `req.session.userId` -- a boolean flag does not identify which user
- **Creating OAuth2Client at module import time:** Delays setup to request time or uses a factory
- **Sharing one refresh interval across users:** Each user's baseUrl refresh must be independent

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management | Custom cookie/token system | express-session (already in use) | Battle-tested, handles edge cases |
| Session storage | In-memory or file store | better-sqlite3-session-store (already in use) | Already configured, WAL mode |
| OAuth2 token management | Custom token refresh logic | google-auth-library OAuth2Client (already in use) | Handles refresh, expiry, token events |
| CSRF protection | Custom state tokens | Keep current crypto.randomBytes approach | Already working correctly |

**Key insight:** The existing stack (express-session + SQLite store + google-auth-library) is correct for multi-user. The problem is not the libraries -- it's the singleton usage pattern.

## Common Pitfalls

### Pitfall 1: Stale OAuth2Client References

**What goes wrong:** Other modules (`picker.js`, `photo-proxy.js`, `photo-cache.js`, `health.js`) import `oAuth2Client` at module scope. Even if auth.js changes to a factory pattern, the imports are cached by Node's `require()`.

**Why it happens:** Node module caching means `const { oAuth2Client } = require('./auth')` evaluates once at startup.

**How to avoid:** Export a function (`getAuthenticatedClient(userId)`) instead of an object. All consumers must call the function per-request.

**Warning signs:** "Works for user 1 but user 2 sees user 1's photos" -- classic symptom of a cached singleton.

### Pitfall 2: Race Condition in Token Refresh

**What goes wrong:** Two concurrent requests for the same user both detect an expired token and both attempt refresh. Google may invalidate the first refresh token when the second is used.

**Why it happens:** google-auth-library's `getAccessToken()` checks expiry and refreshes, but if two calls happen simultaneously, both may initiate a refresh.

**How to avoid:** The google-auth-library OAuth2Client internally handles this with a pending promise -- as long as both requests use the SAME OAuth2Client instance for a given user. If creating a new client per request, add a cache layer keyed by userId that reuses the same client for concurrent requests.

**Warning signs:** Intermittent 401s when a user has multiple browser tabs open.

### Pitfall 3: Memory Growth with Per-User Caches

**What goes wrong:** In-memory cache grows unbounded as more users access the system.

**Why it happens:** Each user loads their full photo cache into memory. With many users and thousands of photos each, memory grows.

**How to avoid:** For the "one user per device" model, this is manageable -- there won't be hundreds of concurrent users. But add a simple LRU eviction: if the cache for a user hasn't been accessed in 2 hours, drop it from memory (it's backed by DB).

**Warning signs:** Node process memory growing steadily over days.

### Pitfall 4: Forgetting to Pass userId Through the Stack

**What goes wrong:** A route handler passes userId to the photo cache but forgets to pass it to the config loader, resulting in mixed user data.

**Why it happens:** With 8 hardcoded statements across 3 files, it's easy to miss one.

**How to avoid:** Create a checklist: every function that currently uses `user_id = 1` must receive userId as a parameter. Test with two users to verify isolation.

### Pitfall 5: Login Page Redirect Loop

**What goes wrong:** Unauthenticated user at `/` redirects to `/login`, but `/login` page tries to load a resource that itself redirects to `/login`.

**Why it happens:** `requireAuth` middleware applied too broadly (e.g., to static assets or the login page itself).

**How to avoid:** Explicitly exclude from requireAuth: `/login`, `/auth/*`, `/demo*`, `/api/demo/*`, and all static assets (served by `express.static` before route middleware).

## Code Examples

### User UPSERT in OAuth Callback
```javascript
// In auth.js callback handler
const stmtFindOrCreate = db.prepare(`
  INSERT INTO users (email, display_name, created_at, last_login)
  VALUES (@email, @display_name, datetime('now'), datetime('now'))
  ON CONFLICT(email) DO UPDATE SET
    last_login = datetime('now'),
    display_name = COALESCE(@display_name, users.display_name)
  RETURNING id
`);

// In callback:
const userInfo = await getUserInfo(tokens.access_token);
const { id: userId } = stmtFindOrCreate.get({
  email: userInfo.email,
  display_name: userInfo.name
});
req.session.userId = userId;
```

### Parameterised Token Statements
```javascript
// Replace hardcoded user_id = 1
const stmtSelectTokens = db.prepare('SELECT * FROM tokens WHERE user_id = ?');
const stmtUpsertTokens = db.prepare(`
  INSERT INTO tokens (user_id, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
  VALUES (@user_id, @access_token, @refresh_token, @expiry_date, @scope, @token_type, datetime('now'))
  ON CONFLICT(user_id) DO UPDATE SET
    access_token = @access_token,
    refresh_token = COALESCE(@refresh_token, tokens.refresh_token),
    expiry_date = @expiry_date,
    scope = @scope,
    token_type = @token_type,
    updated_at = datetime('now')
`);
```

### Per-User OAuth2Client Cache
```javascript
// Avoid creating a new client per request (token refresh race condition)
// Instead, cache clients by userId with lazy creation
const clientCache = new Map();

function getOAuth2ClientForUser(userId) {
  if (clientCache.has(userId)) {
    return clientCache.get(userId);
  }
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  const tokens = stmtSelectTokens.get(userId);
  if (tokens) {
    client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      token_type: tokens.token_type
    });
  }
  client.on('tokens', (newTokens) => {
    saveTokens(userId, newTokens);
  });
  clientCache.set(userId, client);
  return client;
}
```

### requireAuth Middleware
```javascript
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'authentication_required', message: 'Please sign in' });
    }
    return res.redirect('/login');
  }
  next();
}
```

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express-session | ^1.18.0 | Session management | Already in use, proven pattern |
| better-sqlite3-session-store | ^0.1.0 | Session persistence | Already in use, WAL mode |
| google-auth-library | ^9.14.1 | OAuth2 client | Already in use, handles token refresh |
| better-sqlite3 | ^12.6.2 | Database | Already in use, per decision |

### Supporting (no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (built-in) | Node.js | CSRF state generation | Already used in auth.js |
| dotenv | ^16.4.5 | Environment variables | Already used for ALLOWED_EMAILS |

**No new npm packages required for Phase 9.**

## State of the Art

| Old Approach (Current) | New Approach (Phase 9) | Impact |
|------------------------|------------------------|--------|
| Singleton OAuth2Client | Per-user OAuth2Client cache | Enables multi-user tokens |
| `user_id = 1` hardcoded | `user_id = ?` parameterised | Enables per-user data |
| `req.session.authenticated` (boolean) | `req.session.userId` (integer) | Identifies WHICH user |
| Module-level cache objects | userId-keyed Maps | Per-user photo/config isolation |
| No login page | `/login` branded page | Clean unauthenticated experience |
| No auth middleware | `requireAuth` middleware | Route protection |
| Config loaded at startup | Config loaded per-request per-user | Per-user settings |

## Open Questions

1. **OAuth scope addition**
   - What we know: Current SCOPES only include `photospicker.mediaitems.readonly`. The callback already calls userinfo endpoint successfully.
   - What's unclear: Whether adding `openid email profile` to SCOPES will force re-consent for existing users.
   - Recommendation: Add the scopes. The auth flow already uses `prompt: 'consent'` (line 123) so re-consent happens anyway. And re-login is acceptable per CONTEXT.md.

2. **Existing user_id=1 data ownership**
   - What we know: The seed.js creates a user from `ALLOWED_EMAILS` first entry. Existing data is for user_id=1.
   - What's unclear: Whether the first person to log in after Phase 9 deploy will get user_id=1 or a new ID.
   - Recommendation: If the users table already has a row (from seed.js), the UPSERT will match on email and return the existing id. If Sam is the only current user and his email is in ALLOWED_EMAILS, he'll get user_id=1 automatically. No migration needed.

3. **baseUrl refresh scheduling strategy**
   - What we know: Currently one global 50-minute interval refreshes all cached items.
   - What's unclear: Whether a single interval refreshing all users' items is acceptable, or each user needs their own timer.
   - Recommendation: Start with one interval that iterates over all users with cached items. Scale to per-user only if needed. The "one user per device" model means few concurrent users.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all source files (auth.js, photo-cache.js, photo-proxy.js, picker.js, config.js, health.js, server.js, db/migrate.js, db/seed.js, db/database.js, public/index.html, public/slideshow.html, public/settings.html)
- google-auth-library documentation (OAuth2Client pattern) -- verified against installed version ^9.14.1
- express-session documentation -- verified against installed version ^1.18.0

### Secondary (MEDIUM confidence)
- SQLite UPSERT with RETURNING clause -- standard SQLite 3.35+ feature, better-sqlite3 supports it

### Tertiary (LOW confidence)
- None -- all findings verified against the actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages, all existing libraries verified
- Architecture: HIGH -- patterns derived directly from codebase analysis, well-understood Express patterns
- Pitfalls: HIGH -- identified from concrete code patterns (singleton imports, hardcoded IDs)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable stack, no fast-moving dependencies)
