# Architecture Research: v2.0 Multi-Tenant + Photo Grid

**Domain:** Multi-tenant photo frame (Express + vanilla JS)
**Researched:** 2026-02-27
**Confidence:** HIGH -- based on complete codebase analysis (all 12 backend + frontend files), existing architecture patterns, and verified library documentation.

---

## Executive Summary

The v2.0 transformation converts a single-user file-based app into a multi-tenant server-side architecture. The existing backend proxy pattern (required because Google Photos Picker API baseUrls need Authorization headers that browser `<img>` tags cannot provide) fundamentally requires server-side token storage. This makes the older "client-side primary storage" decision (MULTI-USER-ARCHITECTURE.md, Feb 13) inapplicable -- it is superseded by the current v2.0 requirements which explicitly call for server-side DB storage.

The refactor touches every backend module but can be executed incrementally. The key insight: all existing modules already work correctly -- they just need a userId dimension added to their data access layer. The modules themselves (OAuth flow, Picker session management, photo proxy, config) remain functionally identical.

**Superseded decision:** The `.planning/decisions/MULTI-USER-ARCHITECTURE.md` (Option A: Client-Side Storage) is invalidated by the backend proxy requirement. Tokens MUST be on the server because the backend fetches photos on behalf of users. This document establishes the server-side multi-tenant architecture as the replacement decision.

---

## Current Architecture (As-Built)

```
                    +-----------------+
                    |   iPad / Browser |
                    |   (PWA Client)  |
                    +--------+--------+
                             |
                             | HTTPS
                             |
                    +--------v--------+
                    |   nginx (SSL)   |
                    +--------+--------+
                             |
                    +--------v--------+
                    | Express Server  |
                    |   server.js     |
                    +--------+--------+
                             |
        +--------+-----------+-----------+--------+
        |        |           |           |        |
   +----v---+ +--v---+ +----v----+ +----v---+ +--v------+
   |auth.js | |picker| |photo-   | |config  | |demo-    |
   |        | |.js   | |proxy.js | |.js     | |photos.js|
   +----+---+ +--+---+ +----+----+ +----+---+ +---------+
        |        |           |           |
        +--+-----+-----+----+-----------+
           |           |
   +-------v---+ +----v------+  +----------+
   |tokens.json| |cache.json |  |config.json|
   | (GLOBAL)  | | (GLOBAL)  |  | (GLOBAL)  |
   +-----------+ +-----------+  +-----------+
```

### Single-User Assumptions (Must Change)

| Module | Single-User Assumption | What Changes |
|--------|----------------------|--------------|
| `auth.js` | One global `oAuth2Client` instance, one `tokens.json` | Per-user OAuth client instances or per-user token loading |
| `photo-cache.js` | One global `cache` object, one `cache.json` | Per-user cache stored in DB |
| `photo-proxy.js` | Calls `oAuth2Client.getAccessToken()` (single user's token) | Must get token for the requesting user |
| `config.js` | One global `currentConfig`, one `config.json` | Per-user config rows in DB |
| `picker.js` | Uses global `oAuth2Client` for all Picker API calls | Must use requesting user's OAuth token |
| `health.js` | Reports single global cache stats and single auth status | Must scope to requesting user |
| `server.js` | Session has `authenticated` boolean, no user identity | Session must store `userId`, user identity |

---

## Recommended Architecture (v2.0)

```
                    +-----------------+
                    |   iPad / Browser |
                    |   (PWA Client)  |
                    +--------+--------+
                             |
                             | HTTPS + Session Cookie
                             |
                    +--------v--------+
                    |   nginx (SSL)   |
                    +--------+--------+
                             |
                    +--------v--------------------------+
                    |        Express Server             |
                    |        server.js                  |
                    |                                   |
                    |  +---------------------------+    |
                    |  | requireAuth middleware    |    |
                    |  | (attaches req.userId,     |    |
                    |  |  req.userTokens)          |    |
                    |  +---------------------------+    |
                    |                                   |
                    +--+----+----+----+----+----+------+
                       |    |    |    |    |    |
              +--------+    |    |    |    |    +--------+
              |              |    |    |    |             |
         +----v---+    +----v-+  | +--v---+    +--------v--+
         |auth.js |    |picker|  | |config|    |photo-grid |
         |        |    |.js   |  | |.js   |    |.js (NEW)  |
         +--------+    +------+  | +------+    +-----------+
                                 |
                           +-----v------+
                           | photo-     |
                           | proxy.js   |
                           +-----+------+
                                 |
                    +------------v-------------+
                    |       db.js (NEW)        |
                    |  better-sqlite3 wrapper  |
                    +------------+-------------+
                                 |
                    +------------v-------------+
                    |       okno.db            |
                    |  +---------+---------+   |
                    |  | users   | tokens  |   |
                    |  | configs | caches  |   |
                    |  | invites | sessions|   |
                    |  +---------+---------+   |
                    +--'-----------------------+
```

### Component Responsibilities (v2.0)

| Component | Responsibility | New/Modified |
|-----------|---------------|-------------|
| **db.js** | Database initialization, schema, CRUD operations for all tables | NEW |
| **auth.js** | Google OAuth flow, per-user token storage/retrieval in DB, invite code validation | MODIFIED (major) |
| **photo-cache.js** | Per-user media item storage/retrieval from DB, per-user baseUrl refresh scheduling | MODIFIED (major) |
| **photo-proxy.js** | Fetches photos using requesting user's OAuth token from DB | MODIFIED (moderate) |
| **config.js** | Per-user settings stored in DB, fallback to defaults | MODIFIED (major) |
| **picker.js** | Picker sessions scoped to requesting user's OAuth token | MODIFIED (moderate) |
| **photo-grid.js** | New page/route serving cached photo thumbnails, photo removal | NEW |
| **health.js** | Reports per-user stats (scoped to session) | MODIFIED (minor) |
| **server.js** | Session store migration (file -> SQLite), requireAuth middleware, invite routes | MODIFIED (major) |
| **demo-photos.js** | Unchanged -- demo is unauthenticated, no per-user data | UNCHANGED |
| **feedback.js** | Unchanged -- feedback is not user-scoped | UNCHANGED |

---

## Database Architecture

### Why better-sqlite3

| Criterion | better-sqlite3 | Node 22 built-in sqlite | PostgreSQL |
|-----------|---------------|------------------------|------------|
| Stability | Mature, production-ready (v12.6.x) | Experimental, requires --experimental-sqlite flag | Production-ready |
| Performance | Synchronous API, ~2000+ queries/sec | Untested at scale | Overkill for <100 users |
| Dependencies | Single npm package, native addon | Zero (built-in) | Separate server process |
| Fit for project | File-based DB, zero infra | Not production-ready in 2026 | Requires separate service |
| Session store | Multiple compatible packages available | No session store packages | connect-pg-simple |
| Migration | Single file backup/copy | N/A | pg_dump |

**Recommendation: better-sqlite3 v12.x.** It is the standard SQLite library for Node.js, synchronous (simpler code), and several express-session store packages exist for it. The single-file nature of SQLite matches the project's single-VPS deployment model.

**Session store: better-sqlite3-session-store** or **express-session-better-sqlite3.** Both wrap better-sqlite3 for express-session compatibility. The attestate/better-sqlite3-session-store package is archived (June 2025) but functionally complete. The ironboy/better-sqlite3-express-session-store is an alternative. Either replaces the current `session-file-store`.

### Schema

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- UUID generated on creation
  google_id TEXT UNIQUE NOT NULL,         -- Google user ID (from userinfo)
  email TEXT NOT NULL,                    -- Google email (for display, admin lookup)
  name TEXT,                              -- Google display name
  invite_code_used TEXT,                  -- Which invite code they redeemed
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT DEFAULT (datetime('now'))
);

-- OAuth tokens (per-user)
CREATE TABLE tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expiry_date INTEGER,                    -- Unix ms timestamp
  scope TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Photo cache (per-user, per-item)
CREATE TABLE photo_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL,                 -- Google media item ID
  session_id TEXT,                        -- Picker session that added this item
  base_url TEXT,                          -- Current baseUrl (expires every 60 min)
  mime_type TEXT,
  filename TEXT,
  width INTEGER,
  height INTEGER,
  create_time TEXT,                       -- Photo creation timestamp
  camera_make TEXT,
  camera_model TEXT,
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, photo_id)              -- Dedup per user
);

-- User config (per-user settings)
CREATE TABLE user_config (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL DEFAULT '{}', -- JSON blob of settings
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Invite codes
CREATE TABLE invite_codes (
  code TEXT PRIMARY KEY,                  -- 8-char alphanumeric
  created_by TEXT,                        -- Admin or user who created it
  used_by TEXT REFERENCES users(id),      -- NULL until redeemed
  max_uses INTEGER DEFAULT 1,            -- How many times code can be used
  use_count INTEGER DEFAULT 0,           -- How many times used
  expires_at TEXT,                        -- Optional expiry
  created_at TEXT DEFAULT (datetime('now'))
);

-- Refresh scheduling (per-user)
CREATE TABLE refresh_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_session_id TEXT,                   -- Latest Picker session ID for baseUrl refresh
  last_refresh TEXT,                      -- Last baseUrl refresh timestamp
  last_api_call TEXT,                     -- Last Google API call timestamp
  photo_count INTEGER DEFAULT 0          -- Cached count for quick lookups
);

-- Indexes
CREATE INDEX idx_photo_cache_user ON photo_cache(user_id);
CREATE INDEX idx_photo_cache_user_portrait ON photo_cache(user_id, width, height);
CREATE INDEX idx_invite_codes_unused ON invite_codes(code) WHERE used_by IS NULL;
```

### Why JSON Blob for Config (Not Separate Columns)

The config system has a validated allowlist pattern in `config.js` -- only keys in `defaults` are accepted, with type checking. Storing config as a JSON blob in `user_config.config_json` preserves this pattern:

1. **Load:** `JSON.parse(row.config_json)` then merge with defaults (same as current `loadConfig()`)
2. **Save:** Validate against defaults (same as current `saveConfig()`), then `JSON.stringify()` and UPDATE
3. **New config keys:** Just add to `defaults` -- no schema migration needed
4. **Per-user defaults:** New users get `'{}'` which merges cleanly with defaults

This avoids adding a column for every config toggle (currently 9 toggles, growing).

---

## Migration Strategy (Existing Data to DB)

### The First User Problem

The current deployment has one user with data in three files:
- `tokens.json` -- OAuth tokens
- `cache.json` -- ~N cached photo items with metadata
- `config.json` -- 9 settings values

This user's data must be automatically imported on first startup with the new DB.

### Migration Flow

```
Server startup:
  1. Check if okno.db exists
     NO -> Run schema creation, proceed to step 2
     YES -> Skip migration, start normally

  2. Check if tokens.json exists
     NO -> Fresh install, no migration needed
     YES -> Migrate existing user:

  3. Create user record:
     - google_id: extract from tokens.json (decode access_token or call userinfo)
     - email: from ALLOWED_EMAILS env var (only one email configured)
     - id: generate UUID
     - invite_code_used: 'MIGRATED'

  4. Import tokens.json -> tokens table (keyed to new user_id)

  5. Import cache.json -> photo_cache table:
     - For each mediaItem in cache.mediaItems:
       INSERT INTO photo_cache (user_id, photo_id, session_id, base_url, ...)

  6. Import config.json -> user_config table:
     - INSERT INTO user_config (user_id, config_json)
       VALUES (user_id, readFileSync('config.json'))

  7. Import cache.json metadata -> refresh_state table:
     - last_session_id from cache.sessionId
     - last_refresh from cache.lastRefresh

  8. Rename old files: tokens.json -> tokens.json.migrated, etc.
     (Keep as backup, don't delete)

  9. Log: "Migration complete: imported user {email} with {N} photos"
```

### Migration Safety

- **Atomic:** Wrap all inserts in a SQLite transaction. If any step fails, roll back entirely.
- **Idempotent:** Check for existing user with same google_id before inserting. If exists, skip.
- **Non-destructive:** Rename old files to `.migrated` suffix instead of deleting.
- **One-time:** Only runs when `okno.db` does not exist AND `tokens.json` does exist.

---

## Authentication Refactor

### Current Auth Flow (Single User)

```
1. User clicks "Sign in with Google"
2. auth.js creates ONE global oAuth2Client
3. On callback: tokens saved to tokens.json (global file)
4. Session gets authenticated=true (no user identity stored)
5. All routes use the ONE global oAuth2Client
```

### New Auth Flow (Multi-User)

```
1. User clicks "Sign in with Google"
2. auth.js creates a TEMPORARY oAuth2Client for the OAuth flow
3. On callback:
   a. Exchange code for tokens
   b. Fetch userinfo (email, name, google_id)
   c. Check invite code (if new user):
      - req.session.pendingInviteCode must be set
      - Validate code in invite_codes table
      - If invalid/expired: reject with 403
   d. Find or create user record in users table
   e. Save tokens to tokens table (keyed by user_id)
   f. Set session: req.session.userId = user.id
   g. Redirect to /slideshow.html (or /settings.html if first login)
4. Subsequent requests: requireAuth middleware loads user from session
```

### Key Changes to auth.js

**Remove:** Global `oAuth2Client` instance, global `tokens.json` read/write, `loadTokens()` on module init.

**Add:** Per-request OAuth client creation for the login flow, per-user token loading from DB.

```javascript
// BEFORE (single user):
const oAuth2Client = new OAuth2Client(clientId, clientSecret);
// Used by ALL modules via: const { oAuth2Client } = require('./auth');

// AFTER (multi-user):
// No global oAuth2Client. Each module that needs Google API access
// creates a client and loads tokens for the specific user:

function getOAuthClientForUser(userId) {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  const tokens = db.getTokens(userId);
  if (tokens) {
    client.setCredentials(tokens);
    client.on('tokens', (newTokens) => {
      db.saveTokens(userId, { ...tokens, ...newTokens });
    });
  }
  return client;
}
```

**Export change:** Instead of exporting `oAuth2Client`, export `getOAuthClientForUser(userId)`.

### Invite Code Flow

```
New user visits https://okno.moonacle.com
  -> Sees "Enter invite code" input + "Sign in with Google" button
  -> Enters invite code, clicks sign in
  -> Code validated client-side (basic format check)
  -> Code stored in session: req.session.pendingInviteCode = code
  -> OAuth flow proceeds
  -> On callback, server validates code in DB:
     - Code exists?
     - use_count < max_uses?
     - Not expired?
     - If all pass: increment use_count, create user, set used_by
     - If fail: destroy session, redirect to / with error

Existing user visits:
  -> Session already has userId
  -> Redirect straight to slideshow
  -> No invite code needed
```

**Where invite code fits in auth flow:** BEFORE the OAuth redirect. The code is collected on the landing page and stashed in the session. It is validated AFTER OAuth callback succeeds (we need the Google identity first to create the user record).

---

## Session Management

### Current: File-Based Sessions

```javascript
// server.js (current)
const FileStore = require('session-file-store')(session);
app.use(session({
  store: new FileStore({ path: './sessions', ttl: 86400 * 365 }),
  cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 }
}));
```

### New: SQLite-Backed Sessions

```javascript
// server.js (v2.0)
const Database = require('better-sqlite3');
const SqliteStore = require('better-sqlite3-session-store')(session);
const db = new Database('./okno.db');

app.use(session({
  store: new SqliteStore({
    client: db,
    expired: { clear: true, intervalMs: 900000 } // Clean expired every 15 min
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000  // 1 year (matches current)
  }
}));
```

### Session Content (v2.0)

```javascript
// What gets stored in each session:
req.session = {
  userId: 'uuid-xxx',              // Set on successful login
  pendingInviteCode: 'ABC12345',   // Temporary, cleared after use
  oauthState: 'csrf-token-xxx'     // Temporary, cleared after callback
};
```

No user data (tokens, photos, config) in the session. Session is just an authentication ticket pointing to the user record in DB.

---

## requireAuth Middleware Pattern

The central architectural piece for multi-tenant data isolation.

```javascript
// middleware/requireAuth.js (NEW)

function requireAuth(req, res, next) {
  // Skip auth for demo routes, static files, health check
  if (req.path.startsWith('/api/demo') ||
      req.path.startsWith('/auth') ||
      req.path === '/api/health') {
    return next();
  }

  if (!req.session || !req.session.userId) {
    // API requests get 401, page requests get redirect
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/');
  }

  // Attach userId to request for downstream handlers
  req.userId = req.session.userId;
  next();
}
```

**Usage in server.js:**

```javascript
// Mount AFTER session middleware, BEFORE API routes
app.use(requireAuth);

// Then all route handlers can use req.userId:
app.get('/api/config', (req, res) => {
  const config = db.getUserConfig(req.userId);  // Scoped to user
  res.json(config);
});
```

### Routes That Need Auth vs Don't

| Route | Auth Required | Why |
|-------|--------------|-----|
| `GET /` (index.html) | No | Landing page with login |
| `GET /demo`, `/api/demo/*` | No | Demo mode is public |
| `GET /auth/login` | No | Initiates login |
| `GET /auth/callback` | No | Completes login |
| `GET /auth/status` | No | Frontend checks auth state |
| `POST /auth/logout` | Yes | Must know who to log out |
| `GET /slideshow.html` | Yes | Needs user's photos |
| `GET /settings.html` | Yes | Needs user's config |
| `GET /photos.html` (NEW) | Yes | Needs user's photo grid |
| `GET /api/config` | Yes | User's settings |
| `POST /api/config` | Yes | User's settings |
| `POST /api/picker/*` | Yes | User's Picker session |
| `GET /api/photo/random` | Yes | User's photos + tokens |
| `GET /api/photo/grid` (NEW) | Yes | User's photo thumbnails |
| `DELETE /api/photo/:id` (NEW) | Yes | Remove from user's cache |
| `GET /api/health` | Partial | Show user-scoped stats if authed |

---

## Per-User baseUrl Refresh Strategy

### Current: One Global Timer

```javascript
// photo-cache.js (current)
let refreshIntervalHandle = null;
// Started on first setItems() call:
refreshIntervalHandle = setInterval(refreshBaseUrls, 50 * 60 * 1000);
```

This fires every 50 minutes for the single user's entire cache.

### New: Per-User Refresh Manager

**Problem:** With N users, we cannot have N independent setInterval timers. At 10 users, that's 10 timers firing Google API calls every 50 minutes. At 100 users, it becomes a Google API quota concern.

**Solution: Unified refresh scheduler with per-user tracking.**

```javascript
// refresh-scheduler.js (NEW)

const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes
const JITTER_MS = 5 * 60 * 1000;           // 5 min random jitter
const CHECK_INTERVAL_MS = 60 * 1000;        // Check every 1 minute

let schedulerHandle = null;

function startScheduler() {
  schedulerHandle = setInterval(checkRefreshes, CHECK_INTERVAL_MS);
}

async function checkRefreshes() {
  // Query DB for users whose baseUrls are stale
  const staleUsers = db.getUsersNeedingRefresh(REFRESH_INTERVAL_MS);

  for (const user of staleUsers) {
    try {
      await refreshUserBaseUrls(user.id);
    } catch (err) {
      logger.error('Refresh failed for user', { userId: user.id, error: err.message });
    }
    // Small delay between users to avoid API burst
    await sleep(1000);
  }
}

async function refreshUserBaseUrls(userId) {
  const refreshState = db.getRefreshState(userId);
  if (!refreshState || !refreshState.last_session_id) return;

  const oAuthClient = getOAuthClientForUser(userId);
  const { token } = await oAuthClient.getAccessToken();

  // Paginate through mediaItems.list (same as current refreshBaseUrls)
  let allItems = [];
  let pageToken = null;
  do {
    const url = new URL('https://photospicker.googleapis.com/v1/mediaItems');
    url.searchParams.set('sessionId', refreshState.last_session_id);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return; // Don't throw, just skip this cycle

    const data = await response.json();
    allItems.push(...(data.mediaItems || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Update baseUrls in DB for this user's photos
  db.updateBaseUrls(userId, allItems);
  db.updateRefreshState(userId, { last_refresh: new Date().toISOString() });
}
```

**Key design decisions:**

1. **Single scheduler, not per-user timers.** One `setInterval` checks every minute which users need a refresh. This prevents timer proliferation and makes the system observable.

2. **DB-driven staleness check.** `getUsersNeedingRefresh()` queries: `SELECT user_id FROM refresh_state WHERE last_refresh < datetime('now', '-50 minutes') AND photo_count > 0`. Only users with photos AND stale baseUrls get refreshed.

3. **Sequential processing with delay.** Users are refreshed one at a time with a 1-second gap. This prevents Google API rate limiting from concurrent requests.

4. **Jitter per-user.** The first refresh for each user could add random jitter (0-5 minutes) to the 50-minute interval, preventing all users from synchronizing.

5. **Graceful failure.** If one user's refresh fails (e.g., revoked token), it logs the error and moves to the next user. The failed user will be retried on the next check cycle.

---

## Photo Grid Architecture

### Recommendation: New Standalone Page (`photos.html`)

**Why not integrate into settings.html:**
- Settings page is 750 lines of neumorphic UI for toggles/buttons
- Photo grid has fundamentally different layout needs (fluid grid vs form controls)
- Mixing concerns makes both harder to maintain
- Navigation between settings and photos is trivial (link/button)

**Why a new page, not a modal or panel:**
- Photo grids need full viewport width to display thumbnails effectively
- On iPad, a modal/panel would reduce available space
- Keeps the existing settings.html untouched
- Consistent with existing page pattern (index.html, slideshow.html, settings.html, demo.html)

### Photo Grid Page Structure

```html
<!-- public/photos.html (NEW) -->
<html>
<head>
  <!-- Same Inter font, Lucide icons as other pages -->
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Photos</h1>
      <p id="photoCount">Loading...</p>
    </div>

    <div class="toolbar">
      <button onclick="addMorePhotos()">Add More Photos</button>
      <span id="selectedCount" style="display:none">
        <button onclick="removeSelected()">Remove Selected</button>
      </span>
    </div>

    <div id="photoGrid" class="photo-grid">
      <!-- Populated by JS -->
    </div>

    <div class="actions">
      <button onclick="location.href='/settings.html'">Settings</button>
      <button onclick="location.href='/slideshow.html'">Start Slideshow</button>
    </div>
  </div>
</body>
</html>
```

### CSS Grid Layout

```css
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px;
  padding: 8px;
}

.photo-grid .thumb {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
}

.photo-grid .thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-grid .thumb.selected {
  outline: 3px solid #8FB5A5;
  outline-offset: -3px;
}

.photo-grid .thumb.selected::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: #8FB5A5;
  border-radius: 50%;
  /* Checkmark via CSS or Lucide icon */
}
```

**Why CSS Grid over Flexbox:** `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))` automatically handles responsive column count without media queries. 120px minimum ensures thumbnails are large enough to identify photos. On iPad landscape (2732px effective), this yields ~14-16 columns. On phone portrait (~375px), ~3 columns.

### Thumbnail Strategy

**Google Photos baseUrl already supports thumbnails via URL parameters.**

The existing `mediaFile.baseUrl` from the Picker API can be appended with size parameters:
- `=w120-h120-c` -- 120x120 cropped square (perfect for grid)
- `=w240-h240-c` -- 240x240 for retina displays
- `=w120-h120` -- 120x120 scaled (preserves aspect ratio, no crop)

**Recommendation: `=w240-h240-c`** (cropped square at 2x for Retina iPad). This gives consistent grid cells without aspect ratio variation. The crop is acceptable for thumbnails (full image is shown in slideshow).

**Important constraint:** baseUrl requires Authorization header. The backend must proxy thumbnails just like it proxies full images. Two approaches:

**Approach A: Backend thumbnail proxy endpoint (RECOMMENDED)**

```
GET /api/photo/thumb/:photoId
  1. Look up photo's baseUrl in DB (for requesting user)
  2. Append =w240-h240-c
  3. Fetch from Google with user's OAuth token
  4. Stream bytes back to client
  5. Set Cache-Control: private, max-age=3000 (50 min, before baseUrl expires)
```

The photo grid page creates `<img src="/api/photo/thumb/{photoId}">` for each cached item. The browser handles loading, and the 50-minute cache header prevents re-fetching on page interactions.

**Approach B: Batch thumbnail endpoint**

```
GET /api/photo/thumbs?page=1&size=50
  Returns JSON with base64-encoded thumbnail data
```

Rejected: base64 encoding increases payload ~33%, batch loading delays page render, and doesn't leverage browser image caching.

### Lazy Loading

For users with hundreds of photos, the grid should lazy-load thumbnails:

```html
<img src="/api/photo/thumb/{id}" loading="lazy" />
```

The native `loading="lazy"` attribute is supported in Safari 15.4+ (our target is iOS 16). This defers loading offscreen thumbnails until the user scrolls near them.

### Photo Removal

```
User taps photo in grid -> toggles .selected class
User clicks "Remove Selected" ->
  POST /api/photo/remove
  Body: { photoIds: ['id1', 'id2', ...] }

Backend:
  DELETE FROM photo_cache WHERE user_id = ? AND photo_id IN (?, ?, ...)
  Returns: { removed: 3, remaining: 47 }

Frontend:
  Remove .thumb elements from DOM
  Update count display
```

**Important:** Removal is from Okno's cache only. Photos remain in the user's Google Photos library. This distinction should be clear in the UI ("Remove from Okno" not "Delete photo").

### Backend Route: photo-grid.js (NEW)

```javascript
// photo-grid.js (NEW)
const express = require('express');
const router = express.Router();

// GET /api/photo/grid - List all cached photos for current user
router.get('/grid', (req, res) => {
  const items = db.getPhotosForUser(req.userId);
  res.json({
    count: items.length,
    items: items.map(item => ({
      id: item.photo_id,
      createTime: item.create_time,
      width: item.width,
      height: item.height,
      isPortrait: item.height > item.width
    }))
  });
});

// GET /api/photo/thumb/:photoId - Proxy thumbnail from Google
router.get('/thumb/:photoId', async (req, res) => {
  const photo = db.getPhoto(req.userId, req.params.photoId);
  if (!photo || !photo.base_url) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const oAuthClient = getOAuthClientForUser(req.userId);
  const { token } = await oAuthClient.getAccessToken();
  const thumbUrl = `${photo.base_url}=w240-h240-c`;

  const imageResponse = await fetch(thumbUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!imageResponse.ok) {
    return res.status(502).json({ error: 'Failed to fetch thumbnail' });
  }

  res.set('Content-Type', imageResponse.headers.get('content-type') || 'image/jpeg');
  res.set('Cache-Control', 'private, max-age=3000'); // ~50 min
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  res.send(buffer);
});

// POST /api/photo/remove - Remove photos from user's cache
router.post('/remove', (req, res) => {
  const { photoIds } = req.body;
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return res.status(400).json({ error: 'photoIds array required' });
  }
  const removed = db.removePhotos(req.userId, photoIds);
  const remaining = db.getPhotoCount(req.userId);
  db.updateRefreshState(req.userId, { photo_count: remaining });
  res.json({ removed, remaining });
});
```

---

## File-by-File Change Map

### New Files

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `db.js` | Database initialization, schema, all CRUD operations | ~300 |
| `photo-grid.js` | Photo grid API routes (list, thumbnail proxy, remove) | ~100 |
| `refresh-scheduler.js` | Unified per-user baseUrl refresh scheduler | ~80 |
| `public/photos.html` | Photo management grid page | ~200 |

### Modified Files (Backend)

| File | Changes | Effort |
|------|---------|--------|
| `server.js` | Replace FileStore with SqliteStore, add requireAuth middleware, mount photo-grid routes, mount invite routes, start refresh scheduler | Major |
| `auth.js` | Remove global oAuth2Client, remove tokens.json I/O, add per-user token DB operations, add invite code validation in callback, export `getOAuthClientForUser()` | Major |
| `photo-cache.js` | Remove global cache object, remove cache.json I/O, all functions take userId param, delegate to db.js | Major |
| `config.js` | Remove global currentConfig, remove config.json I/O, load/save from DB via userId, keep defaults + validation logic | Major |
| `photo-proxy.js` | Use `getOAuthClientForUser(req.userId)` instead of global oAuth2Client, get cache items from DB | Moderate |
| `picker.js` | Use `getOAuthClientForUser(req.userId)`, save items to DB scoped to userId | Moderate |
| `health.js` | Scope stats to req.userId (optional: show global stats for admin) | Minor |
| `package.json` | Add better-sqlite3, remove session-file-store | Minor |

### Modified Files (Frontend)

| File | Changes | Effort |
|------|---------|--------|
| `public/index.html` | Add invite code input field, update auth status check, link to photos.html | Moderate |
| `public/settings.html` | Add "Manage Photos" link/button to photos.html | Minor |
| `public/slideshow.html` | No changes (already uses /api/photo/random which will be scoped) | None |
| `public/demo.html` | No changes (demo is unauthenticated) | None |
| `public/sw.js` | Add photos.html to cached pages | Minor |

### Unchanged Files

| File | Why Unchanged |
|------|--------------|
| `demo-photos.js` | Demo mode is fully isolated from auth stack |
| `feedback.js` | Feedback is not user-scoped |
| `ecosystem.config.js` | PM2 config unchanged |
| `nginx.conf.template` | No new nginx requirements |

---

## Data Flow (v2.0)

### Flow 1: New User Registration

```
User visits https://okno.moonacle.com
  |
  v
index.html checks GET /auth/status
  -> { authenticated: false }
  -> Show invite code input + "Sign in with Google"
  |
  v
User enters invite code "ABC12345", clicks Sign In
  -> JS stores code in hidden form field
  -> POST /auth/validate-invite { code: "ABC12345" }
  -> Server checks DB: code exists, not expired, use_count < max_uses
  -> Returns { valid: true }
  -> JS sets window.location = /auth/login?invite=ABC12345
  |
  v
GET /auth/login
  -> Store invite code in session: req.session.pendingInviteCode = "ABC12345"
  -> Redirect to Google OAuth consent screen
  |
  v
Google OAuth callback
  -> Exchange code for tokens
  -> Fetch userinfo (email, name, google_id)
  -> Validate invite code from session
  -> INSERT INTO users (...)
  -> INSERT INTO tokens (...)
  -> INSERT INTO user_config (user_id, config_json='{}')
  -> INSERT INTO refresh_state (user_id)
  -> UPDATE invite_codes SET use_count = use_count + 1
  -> req.session.userId = user.id
  -> Redirect to /slideshow.html (or /settings.html for first-time setup)
```

### Flow 2: Returning User Slideshow

```
User visits https://okno.moonacle.com
  |
  v
Session cookie present, req.session.userId exists
  -> GET /auth/status -> { authenticated: true, userId: 'xxx', photoCount: 50 }
  -> Redirect to /slideshow.html (or show "Start Slideshow" button)
  |
  v
slideshow.html fetches GET /api/config
  -> requireAuth middleware: req.userId = session.userId
  -> config.js: SELECT config_json FROM user_config WHERE user_id = ?
  -> Returns user's settings (merged with defaults)
  |
  v
slideshow.html fetches GET /api/photo/random
  -> requireAuth middleware: req.userId = session.userId
  -> photo-cache: SELECT * FROM photo_cache WHERE user_id = ? ORDER BY RANDOM() LIMIT 1
  -> photo-proxy: getOAuthClientForUser(req.userId)
  -> Fetch from Google with user's token
  -> Stream image bytes to browser
  |
  v
Browser displays photo (same crossfade, Ken Burns, blur as v1.1)
```

### Flow 3: Per-User baseUrl Refresh

```
refresh-scheduler.js (runs every 60 seconds):
  |
  v
SELECT user_id, last_session_id FROM refresh_state
  WHERE last_refresh < datetime('now', '-50 minutes')
  AND photo_count > 0
  |
  v
For each stale user:
  -> getOAuthClientForUser(userId)
  -> GET /v1/mediaItems?sessionId={lastSessionId}&pageSize=100
     (with user's OAuth token)
  -> For each returned item:
     UPDATE photo_cache SET base_url = ? WHERE user_id = ? AND photo_id = ?
  -> UPDATE refresh_state SET last_refresh = datetime('now')
  -> Wait 1 second before next user
```

---

## Suggested Build Order

Based on dependency analysis and the goal of minimizing disruption to the working app:

### Phase 1: Database Foundation

**Build first because everything else depends on it.**

1. Add `better-sqlite3` dependency
2. Create `db.js` with schema creation and CRUD functions
3. Implement migration logic (JSON files -> DB)
4. Replace `session-file-store` with `better-sqlite3-session-store` in server.js
5. Test: server starts, creates DB, migrates existing data, sessions work

**Rationale:** This is the riskiest phase (data migration). Do it first while the app still works with fallback to JSON files. If migration fails, the old files are untouched.

**Key milestone:** Server starts with SQLite sessions and existing user's data is in the DB.

### Phase 2: Per-User Data Layer

**Refactor all modules to use DB instead of files.**

1. Refactor `auth.js`: Remove global oAuth2Client, export `getOAuthClientForUser(userId)`, tokens from DB
2. Refactor `config.js`: Load/save from DB with userId parameter
3. Refactor `photo-cache.js`: All functions take userId, query DB
4. Refactor `photo-proxy.js`: Use `getOAuthClientForUser(req.userId)`
5. Refactor `picker.js`: Use `getOAuthClientForUser(req.userId)`, save to DB
6. Add `requireAuth` middleware to server.js
7. Update `health.js` to use per-user data
8. Test with existing (migrated) user: entire flow works end-to-end

**Rationale:** After Phase 1, the DB has data. Phase 2 makes all code read from it. The existing single user should experience zero functional change.

**Key milestone:** Existing user's slideshow works identically, but backed by SQLite.

### Phase 3: Multi-User Auth + Invite Codes

**Only NOW do we add the ability for new users to join.**

1. Create invite_codes table operations in db.js
2. Add invite code validation endpoint
3. Modify auth.js callback to handle new user creation
4. Modify index.html to show invite code input for unauthenticated users
5. Create CLI script for admin to generate invite codes
6. Create `refresh-scheduler.js` for per-user baseUrl refresh
7. Test: generate invite code via CLI, new user signs in, gets own data space

**Rationale:** Phases 1-2 ensure the data layer works. Phase 3 adds the multi-tenant entry point. The invite code system is the gatekeeper.

**Key milestone:** Two users can sign in independently, each sees only their own photos.

### Phase 4: Photo Grid

**Can be built independently once Phase 2 is complete.**

1. Create `photo-grid.js` router
2. Create `public/photos.html` with CSS Grid layout
3. Implement thumbnail proxy endpoint
4. Implement photo removal endpoint
5. Add "Manage Photos" link in settings.html
6. Mount routes in server.js
7. Test: user sees their cached photos as thumbnails, can remove unwanted ones

**Rationale:** Photo grid depends on per-user data (Phase 2) but is independent of invite codes (Phase 3). Could be built in parallel with Phase 3 if desired.

**Key milestone:** Users can view and manage their photo selection visually.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-User Timer Proliferation

**What goes wrong:** Creating `setInterval(refreshBaseUrls, 50min)` for each user. At N users, N timers fire concurrently, overwhelming Google API quota and Node.js event loop.

**Instead:** Single scheduler that queries DB for stale users and processes them sequentially with delays.

### Anti-Pattern 2: Loading All User Data into Memory

**What goes wrong:** Caching all users' photo metadata in a global in-memory Map (like the current `let cache = {...}`). Memory grows linearly with users and is lost on restart.

**Instead:** Query DB on demand. SQLite is fast enough (~2000 queries/sec) for photo frame request rates. Keep zero user data in process memory.

### Anti-Pattern 3: Shared OAuth Client with Token Swapping

**What goes wrong:** Using one `oAuth2Client` instance and calling `setCredentials()` with different users' tokens per request. Race conditions when concurrent requests for different users arrive.

**Instead:** Create a fresh `OAuth2Client` per request or per user session. They are lightweight objects.

### Anti-Pattern 4: Tenant ID in URL Path

**What goes wrong:** Routes like `/api/user/:userId/photo/random` expose user IDs in URLs and require explicit ID passing.

**Instead:** User ID comes from the session (middleware sets `req.userId`). Routes stay clean: `/api/photo/random`. The middleware guarantees isolation.

### Anti-Pattern 5: Frontend-Driven Tenant Scoping

**What goes wrong:** Frontend sends userId in request body/params, backend trusts it. User A could send user B's ID.

**Instead:** Backend NEVER trusts client-provided user IDs. The userId comes exclusively from the server-side session, set during authenticated login. No client input can override it.

### Anti-Pattern 6: Storing Thumbnails on Disk

**What goes wrong:** Pre-generating and storing thumbnail files for each user's photos. Disk fills up, thumbnails go stale when baseUrls expire, cleanup is complex.

**Instead:** Proxy thumbnails on demand using Google's baseUrl size parameters (`=w240-h240-c`). Let browser HTTP caching handle repeat requests (Cache-Control: max-age=3000).

---

## Scalability Considerations

| Concern | At 1-5 users (target) | At 50 users | At 500 users |
|---------|----------------------|-------------|-------------|
| **DB size** | ~1MB | ~10MB | ~100MB |
| **baseUrl refreshes** | 1-5 API calls every 50 min | 50 calls every 50 min (spread over time) | Consider batching, may need rate limit management |
| **OAuth clients** | Trivial | Fine | Consider connection pooling |
| **Thumbnail proxy** | On-demand, cached in browser | May want server-side cache layer (Redis) | Need CDN or server-side thumbnail cache |
| **SQLite concurrency** | No concern | Fine (WAL mode handles concurrent reads) | Consider PostgreSQL migration |
| **Session storage** | ~5 rows | ~50 rows | Fine in SQLite |
| **Memory** | ~30MB total | ~30MB (no per-user memory) | ~30MB (all data in DB) |

**For the target scale (1-5 users, family use):** SQLite is perfect. No scaling concerns at all.

**SQLite WAL mode:** Enable `PRAGMA journal_mode=WAL;` on database initialization. This allows concurrent reads while a write is in progress -- important when the refresh scheduler writes baseUrls while a slideshow request reads them.

---

## Integration Points with Existing Components

### How Each Existing Module Is Affected

**auth.js (MAJOR refactor):**
- Remove: lines 27-30 (global oAuth2Client), lines 33-92 (global token file I/O), line 209 (module.exports.oAuth2Client)
- Add: `getOAuthClientForUser(userId)` function, invite code validation in callback
- Keep: OAuth flow structure (login redirect, callback handler, status check, logout)

**photo-cache.js (MAJOR refactor):**
- Remove: lines 1-2 (fs import, global oAuth2Client import), lines 22-32 (global cache object), lines 38-66 (file I/O functions), lines 249-250 (loadCache on init)
- Add: userId parameter to all functions, DB queries via db.js
- Keep: Business logic (dedup by ID, On This Day filtering, portrait detection, random selection)

**config.js (MAJOR refactor):**
- Remove: lines 1-3 (fs import, CONFIG_PATH), lines 20-44 (file-based loadConfig), lines 51-94 (file-based saveConfig)
- Add: userId parameter, DB load/save via db.js
- Keep: `defaults` object, validation logic (allowedKeys, type checking, range validation)

**photo-proxy.js (MODERATE refactor):**
- Remove: line 4 (import of global oAuth2Client)
- Add: `const oAuthClient = getOAuthClientForUser(req.userId)` per request
- Keep: Entire proxy logic (fetch from Google, stream to client, response headers)

**picker.js (MODERATE refactor):**
- Remove: line 3 (import of global oAuth2Client)
- Add: `const oAuthClient = getOAuthClientForUser(req.userId)` per request, save items via `db.setItems(req.userId, items)`
- Keep: Picker session flow (start, poll, complete)

**server.js (MAJOR refactor):**
- Remove: session-file-store import, inline config routes
- Add: better-sqlite3 + session store setup, requireAuth middleware, photo-grid route mounting, refresh scheduler start
- Keep: Express app structure, helmet, morgan, static file serving, route mounting pattern

---

## Sources

### HIGH Confidence (Verified)
- Codebase analysis: All 12 source files (`server.js`, `auth.js`, `photo-cache.js`, `photo-proxy.js`, `config.js`, `picker.js`, `health.js`, `feedback.js`, `demo-photos.js`, `slideshow.html`, `settings.html`, `index.html`) read and analyzed
- [Google Photos Picker API: Media Items](https://developers.google.com/photos/picker/guides/media-items) -- baseUrl parameters (w, h, c), 60-min expiry, required Authorization header
- [Google Photos Picker API: REST Reference](https://developers.google.com/photos/picker/reference/rest/v1/mediaItems) -- PickedMediaItem fields (id, createTime, type, mediaFile with baseUrl, mimeType, filename, mediaFileMetadata with width/height)
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) -- v12.6.x, synchronous API, ~2000 queries/sec
- [better-sqlite3-session-store](https://github.com/attestate/better-sqlite3-session-store) -- v0.1.0, works with express-session, archived June 2025 but functional
- CSS Grid `repeat(auto-fill, minmax())` pattern -- [W3Schools responsive image grid](https://www.w3schools.com/howto/howto_css_image_grid_responsive.asp)

### MEDIUM Confidence (Multiple Sources Agree)
- [Multi-tenant Express patterns](https://oneuptime.com/blog/post/2026-01-25-multi-tenant-apis-nodejs/view) -- middleware-based tenant isolation, session-based userId
- [Database-per-tenant SQLite considerations](https://medium.com/@dmitry.s.mamonov/database-per-tenant-consider-sqlite-9239113c936c) -- single DB with tenant_id column is simpler for <100 tenants
- Per-user timer management -- Map-based timer tracking is standard Node.js pattern but unified scheduler is better for this use case
- Node 22 built-in SQLite -- [still experimental](https://nodejs.org/api/sqlite.html), not production-ready, requires --experimental-sqlite flag

### LOW Confidence (Needs Validation)
- better-sqlite3-session-store archived status -- may need to fork or use alternative ([ironboy/better-sqlite3-express-session-store](https://github.com/ironboy/better-sqlite3-express-session-store) or [express-session-better-sqlite3](https://www.npmjs.com/package/express-session-better-sqlite3))
- Google API quota impact of N-user baseUrl refreshes -- needs testing at target scale
- `loading="lazy"` on thumbnail images in iOS 16 Safari -- supported per caniuse but should verify in actual PWA context
