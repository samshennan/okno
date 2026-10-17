# Feature Research: v2.0 "Multi-Tenant"

**Domain:** Multi-tenant photo frame with invite-based access and photo management grid
**Researched:** 2026-02-27
**Confidence:** HIGH for multi-tenant patterns (well-established domain), MEDIUM for Google OAuth multi-user constraints (verified against official docs but some details require testing), HIGH for photo grid UX (well-documented patterns)

**Context:** v1.1 is shipped and running as a single-user app. This research covers the five NEW feature areas for v2.0: multi-tenant user support, invite code access control, photo management grid, per-user settings, and admin tooling. The existing app uses file-based JSON storage (tokens.json, cache.json, config.json), a single global OAuth2Client, and Express sessions via session-file-store.

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are the features without which multi-tenant simply does not work or feels broken. Every one is required before the first additional user can use the app.

---

#### TS-1: Per-User Google OAuth Authentication

**Why expected:** Each user brings their own Google Photos library. The app must handle N independent OAuth tokens, not a single shared one. Users will not tolerate seeing another person's photos.

**What users expect:**
- Sign in with their own Google account
- Their OAuth tokens are private and secure
- Token refresh happens automatically (no manual re-authentication)
- If their token expires or is revoked, only they are affected -- other users keep working

**Complexity:** HIGH

**Current state:** Single global `oAuth2Client` in `auth.js` with one `tokens.json` file. This is the biggest architectural change -- every module that calls `oAuth2Client.getAccessToken()` must be refactored to use a per-user token.

**Dependencies on existing features:**
- `auth.js` -- must be refactored from singleton OAuth client to per-user clients
- `photo-cache.js` -- calls `oAuth2Client` for baseUrl refresh, must become per-user
- `photo-proxy.js` -- calls `oAuth2Client.getAccessToken()`, must resolve which user's token to use
- `picker.js` -- creates Picker sessions using the global client, must scope to user

**Implementation pattern:**
Each user row in the database stores `access_token`, `refresh_token`, `token_expiry_date`. When a request comes in, the session identifies the user, and a per-user `OAuth2Client` is instantiated (or cached in memory) with that user's credentials. The `google-auth-library` supports creating multiple `OAuth2Client` instances with different credentials -- the library is not inherently singleton.

**Critical constraint -- Google 100-user cap:** The Google Photos Picker API scope (`photospicker.mediaitems.readonly`) requires OAuth verification review. Unverified apps are limited to 100 lifetime users. This cap cannot be reset or increased without passing Google's verification process (3-5 business days, requires privacy policy, YouTube demo video, domain verification). For an invite-only friends-and-family phase, 100 users is generous. But this becomes a hard blocker if the app opens to public registration without verification.

**Confidence:** HIGH -- Google auth-library multi-instance pattern verified against [official Node.js client docs](https://github.com/googleapis/google-api-nodejs-client). 100-user cap verified against [Google Cloud unverified apps documentation](https://support.google.com/cloud/answer/7454865).

---

#### TS-2: Per-User Data Isolation

**Why expected:** Users expect complete privacy. User A must never see User B's photos, settings, or any indication that User B exists. This is the single most important guarantee in a multi-tenant app handling personal photos.

**What users expect:**
- Their photos are only visible to them
- Their settings do not affect other users' slideshows
- No accidental data leakage (e.g., photos from the wrong user appearing)
- Deleting their account removes all their data

**Complexity:** HIGH

**Current state:** Everything is global: one `cache.json`, one `config.json`, one `tokens.json`. Moving to per-user storage is a database migration, not a code tweak.

**Dependencies on existing features:**
- `photo-cache.js` -- currently a singleton module with in-memory + JSON persistence
- `config.js` -- currently a singleton with one global config
- `photo-proxy.js` -- currently picks random photo from global cache

**Implementation pattern:**
Every database query must be scoped by `user_id`. The data model becomes:

| Table | Key columns | Isolation |
|-------|-------------|-----------|
| `users` | `id`, `email`, `google_id`, `display_name` | N/A (admin-visible) |
| `tokens` | `user_id`, `access_token`, `refresh_token`, `expiry` | FK to users |
| `photos` | `user_id`, `google_media_id`, `base_url`, `create_time`, `width`, `height` | FK to users |
| `settings` | `user_id`, `key`, `value` | FK to users |
| `invite_codes` | `code`, `created_by`, `used_by`, `expires_at` | Admin-managed |

Every query pattern: `SELECT ... FROM photos WHERE user_id = ?`. Never `SELECT ... FROM photos` without a user filter.

**Confidence:** HIGH -- standard multi-tenant pattern, no novel complexity.

---

#### TS-3: User Session Management

**Why expected:** Users need persistent login across browser sessions. The iPad photo frame must stay authenticated indefinitely. A user opening their settings page on a phone must have their own session.

**What users expect:**
- Stay logged in on the iPad (the frame runs unattended for months)
- Settings changes on phone reflect on their iPad
- Logging out on one device does not log out others (unless they choose to)

**Complexity:** MEDIUM

**Current state:** Express sessions via `session-file-store` with 1-year TTL. The session stores `authenticated: true` but not which user. Works for single-user but has no user identity.

**Dependencies on existing features:**
- `server.js` -- session middleware already configured
- All routes that check `req.session.authenticated` must now check `req.session.userId`

**Implementation pattern:**
After OAuth callback, store `req.session.userId = user.id`. All subsequent route handlers resolve the user from the session. The existing `session-file-store` works for small user counts (under 100 concurrent), but could be replaced with a DB-backed session store if file I/O becomes a bottleneck.

Sessions must be long-lived for iPads in kiosk mode. The current 1-year TTL is appropriate. For phone/laptop management, shorter sessions (30 days) may be more appropriate, but this is a polish detail, not a blocker.

**Confidence:** HIGH -- existing session infrastructure only needs minor extension.

---

#### TS-4: Invite Code Access Control

**Why expected:** The app owner (Sam) wants to control who can register. Open registration exposes the app to abuse and exceeds the Google 100-user cap. Invite codes are the simplest gating mechanism that still feels welcoming.

**What users expect:**
- Receive an invite code from the app owner (via text/email/in person)
- Enter the code when first visiting the app
- Code works once (or a limited number of times)
- Clear error message if code is invalid or expired
- After entering a valid code, proceed directly to Google sign-in

**Complexity:** LOW

**Current state:** No access control. The `ALLOWED_EMAILS` env var provides an email allowlist, but this requires knowing users' emails in advance and doesn't scale.

**Dependencies on existing features:**
- `auth.js` -- the login flow must check for a valid invite code before initiating OAuth
- `index.html` -- the landing page must show an invite code input for new users

**Implementation pattern (recommended):**

```
Invite code schema:
  code: string (8-char alphanumeric, case-insensitive)
  created_by: user_id (admin who generated it)
  created_at: timestamp
  expires_at: timestamp (optional, default 30 days)
  max_uses: integer (default 1)
  use_count: integer (default 0)
  used_by: array of user_ids
```

Flow:
1. New visitor arrives at okno.moonacle.com
2. App detects no active session -- shows landing page with invite code input
3. User enters code -- backend validates (exists, not expired, not fully used)
4. Valid: code is "consumed" (use_count++), session gets `pendingInviteCode`, redirect to Google OAuth
5. After OAuth callback: create user record, link invite code usage, redirect to Picker flow
6. Invalid: show clear error ("Invalid or expired invite code")

Admin generates codes via CLI: `node admin.js create-invite --uses 1 --expires 30d`

**UX best practices from research:**
- Keep the code short (6-8 characters) and case-insensitive for easy sharing via text
- Show the code in a large, clear font on the input page
- Pre-fill the code if it's in the URL: `okno.moonacle.com/?invite=ABC123`
- Support URL-based invite links: the admin can share a direct URL that includes the code

**Confidence:** HIGH -- straightforward CRUD pattern, no external dependencies.

---

#### TS-5: Per-User Slideshow (Photo Proxy Scoped to User)

**Why expected:** When User A's iPad loads `/slideshow.html`, it must only receive User A's photos. The slideshow URL is the same for all users, but the session determines whose photos are served.

**What users expect:**
- Opening the slideshow shows only their photos
- Photo transitions, Ken Burns, blurred background all work exactly as before
- "On This Day" mode shows their photos from today's date
- Portrait pair mode works with their photo library

**Complexity:** MEDIUM

**Current state:** `/api/photo/random` calls `photoCache.getRandomItem()` from the global cache. Must become `getRandomItem(userId)`.

**Dependencies on existing features:**
- `photo-proxy.js` -- must extract `userId` from session, pass to cache layer
- `photo-cache.js` -- all methods must accept `userId` parameter
- `slideshow.html` -- no changes needed (it calls `/api/photo/random` which the backend resolves)
- baseUrl refresh timer -- must run per-user, not globally

**Implementation pattern:**
The in-memory cache becomes a `Map<userId, UserPhotoCache>`. The `refreshBaseUrls()` function runs per-user, with staggered timing to avoid API rate limits. When a user's iPad makes a request, the backend resolves their userId from the session, looks up their photo cache, and serves a random photo from their collection.

**Critical consideration -- per-user refresh scheduling:**
Currently a single `setInterval` refreshes all baseUrls every 50 minutes. With N users, this becomes N independent refresh schedules. Options:
1. **On-demand refresh:** Only refresh when a user's iPad makes a request and their URLs are stale. Pro: no unnecessary API calls. Con: first request after 60 minutes has latency.
2. **Active-user refresh:** Track which users have active slideshow sessions (heartbeat), only refresh for active users. Pro: efficient. Con: heartbeat adds complexity.
3. **Simple interval per user:** When user's photos are loaded into memory, start their refresh timer. Pro: simple. Con: refreshes for users whose iPads are off.

**Recommendation:** Start with on-demand refresh (option 1). It's simplest and the latency spike is acceptable (one slow photo load every ~60 min per user). Add active-user tracking later if needed.

**Confidence:** HIGH -- the architectural pattern is straightforward, and the frontend needs zero changes.

---

#### TS-6: Database Migration (File-Based to DB)

**Why expected:** Not user-facing, but a prerequisite for everything else. File-based JSON cannot support concurrent multi-user access safely.

**What happens without it:**
- Two users writing to `cache.json` simultaneously causes data corruption
- No foreign key relationships, no transactions, no atomic updates
- No way to query "all photos for user X" without loading entire cache

**Complexity:** MEDIUM

**Current state:** Three JSON files: `tokens.json`, `cache.json`, `config.json`.

**Dependencies on existing features:**
- Every module that reads/writes JSON files must be refactored
- The first user's existing data must be migrated automatically

**Implementation pattern:**
SQLite is the natural choice for this app:
- File-based (no separate database server)
- WAL mode supports concurrent reads/writes safely
- Built-in with `better-sqlite3` (synchronous, fast, zero config)
- Easy to back up (single file)
- Sufficient for under 100 users with under 2000 photos each

The migration script reads existing JSON files, creates the first user account (email from tokens.json), and imports all cached photos and config as that user's data. This runs once on first startup after the upgrade.

**Confidence:** HIGH -- SQLite is the standard choice for this scale. Verified via established patterns.

---

#### TS-7: Auto-Migration of Existing Data

**Why expected:** The app owner (Sam) has ~137+ photos cached, OAuth tokens, and configured settings. Upgrading to v2.0 must not lose this data or require re-authentication.

**What users expect:**
- After v2.0 upgrade, the existing slideshow continues working
- No need to re-authenticate with Google
- No need to re-select photos
- All settings (Ken Burns, blur, etc.) preserved

**Complexity:** MEDIUM

**Current state:** `tokens.json`, `cache.json`, `config.json` in the project root.

**Implementation pattern:**
On first startup, if the DB is empty and legacy JSON files exist:
1. Create user record from `tokens.json` (extract email from stored token, or from Google userinfo API)
2. Import `cache.json` media items as that user's photos
3. Import `config.json` settings as that user's settings
4. Rename JSON files to `.migrated` (keep as backup, stop reading them)

**Confidence:** HIGH -- deterministic migration from known formats.

---

### Differentiators (Competitive Advantage)

These features are not required for multi-tenant to function, but they make Okno stand out as a polished, thoughtful product. Prioritize based on impact vs. effort.

---

#### D-1: Photo Management Grid

**Why valuable:** Currently, the only way to manage photos is to start a new Picker session and re-select. Users want to see what they've already selected and remove individual photos without re-doing the entire selection process.

**What it looks like (based on research of Google Photos, Apple Photos, Immich, and Lychee):**

```
/manage page:

  [Your Photos]                              [137 photos]

  +--------+ +--------+ +--------+ +--------+
  |        | |        | |        | |        |
  | thumb  | | thumb  | | thumb  | | thumb  |
  |        | |        | |        | |        |
  +--------+ +--------+ +--------+ +--------+
  +--------+ +--------+ +--------+ +--------+
  |        | |        | |        | |        |
  | thumb  | | thumb  | | thumb  | | thumb  |
  |        | |        | |        | |        |
  +--------+ +--------+ +--------+ +--------+
  ... (scrollable grid)

  [Select Mode]  |  [Add More Photos]
```

**Grid layout pattern (recommended):**
- Uniform square grid with CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))`
- Square thumbnails using `aspect-ratio: 1/1` + `object-fit: cover`
- This crops photos to squares for consistent grid appearance (same as Google Photos, Apple Photos, Instagram)
- 96%+ browser support for `aspect-ratio` (only IE lacks it, which is irrelevant)

**Selection interaction pattern (based on Google Photos UX):**
1. **Default mode:** Grid shows thumbnails. Tapping a photo opens a larger preview with metadata (date taken, dimensions)
2. **Selection mode:** Activated by a "Select" button or long-press on a thumbnail. Checkboxes appear on each thumbnail. Tapping toggles selection.
3. **Batch actions:** When photos are selected, a toolbar appears: "Remove (N)" button. Possibly "Select All" / "Deselect All"
4. **Shift-click range select:** On desktop, hold Shift and click to select a range (standard pattern in Google Photos, Lightroom, file managers)

**Thumbnail generation strategy:**
The app does not store photo files locally. Thumbnails must come from Google's baseUrl with size parameters. Google's Picker API supports appending `=w120-h120-c` (120x120 cropped) or `=s120` (120px on longest side) to baseUrls. This means:
- Thumbnails are loaded on-demand from Google, not pre-generated
- Each thumbnail request requires a valid (non-expired) baseUrl + auth token
- The backend must proxy thumbnails the same way it proxies slideshow photos
- For performance, load thumbnails lazily (only when scrolled into view)

**New endpoint needed:**
```
GET /api/photo/thumbnail/:photoId
  - Resolves photo by ID from user's cache
  - Appends =w240-h240-c to baseUrl (240x240 cropped square)
  - Proxies through backend with auth token
  - Returns image binary
```

**Performance considerations:**
- With 137 photos (current), a full grid loads 137 thumbnail requests. At 240x240 JPEG that's ~10-30KB each = 1.5-4MB total. Manageable.
- With 2000 photos (Picker API max), that's 2000 requests. Needs lazy loading via `IntersectionObserver` or `loading="lazy"` on img tags.
- Virtual scrolling (render only visible rows) is overkill for under 2000 photos but could be considered if performance is an issue.

**Photo removal behavior:**
Removing a photo from Okno does NOT delete it from Google Photos. It only removes the cached reference. The photo is no longer shown in the slideshow or grid. This distinction must be clearly communicated in the UI: "Remove from Okno" not "Delete."

**Complexity:** MEDIUM-HIGH

**Dependencies on existing features:**
- `photo-cache.js` (or its DB replacement) -- needs a per-user photo lookup and deletion API
- `photo-proxy.js` -- needs a new thumbnail endpoint
- New HTML page: `manage.html` or added as a tab/section in the existing settings page
- Must use the same neumorphic design system as `settings.html` and `index.html`

**Confidence:** HIGH for grid layout/UX patterns. MEDIUM for Google baseUrl thumbnail sizing parameters (based on legacy Library API docs -- the Picker API likely uses the same `=w{N}-h{N}-c` parameters but should be verified during implementation).

---

#### D-2: URL-Based Invite Links

**Why valuable:** Instead of telling someone "go to okno.moonacle.com and enter code ABC123", the admin can share a link: `okno.moonacle.com/?invite=ABC123`. The code is pre-filled. One tap to start.

**What it looks like:**
- Admin generates invite code via CLI
- CLI outputs both the code and the full URL
- Recipient clicks link, sees "You've been invited! Sign in with Google to set up your photo frame."
- Google OAuth starts immediately (or after one confirmation click)

**Complexity:** LOW (just URL parameter parsing on the landing page)

**Dependencies:** TS-4 (invite code system must exist first)

**Confidence:** HIGH -- trivial frontend addition.

---

#### D-3: User Profile / Account Page

**Why valuable:** Users need a place to see their account info, manage their Google connection, and delete their account. This is both a usability feature and a trust/privacy signal.

**What it looks like:**
```
/account page:

  [Profile]
  Name: Sam Shennan
  Email: sam@example.com
  Connected since: Feb 8, 2026

  [Google Photos]
  Photos cached: 137
  Last sync: 2 minutes ago

  [Danger Zone]
  [Disconnect Google Account]    -- Revokes OAuth, clears photos
  [Delete My Account]            -- Removes all data from Okno
```

**Complexity:** LOW-MEDIUM

**Dependencies:**
- Database must store user profile info (from Google userinfo API at OAuth time)
- Account deletion must cascade: remove user, tokens, photos, settings, sessions

**Confidence:** HIGH -- standard account management pattern.

---

#### D-4: Graceful Token Expiry Handling Per User

**Why valuable:** With multiple users, token issues become per-user problems instead of app-wide failures. User A's expired token must not crash User B's slideshow.

**What users expect:**
- If their Google token is revoked, they see a clear message on their slideshow: "Re-authenticate to continue"
- Other users' slideshows are unaffected
- Re-authentication is simple (tap a button, sign in again)

**What the slideshow shows during token failure:**
```
[Last successfully loaded photo stays visible]

  Overlay: "Connection to Google Photos lost.
            Open Settings to reconnect."

  [The slideshow pauses but doesn't crash]
```

**Complexity:** MEDIUM

**Current state:** Token errors crash the entire photo-proxy response with a 502. In multi-user, this must become a per-user graceful degradation.

**Implementation pattern:**
- Photo-proxy catches auth errors (401, 403) and returns a specific error code: `{ error: 'auth_expired', userId: 'abc' }`
- Frontend detects this error and shows a reconnection overlay
- The slideshow keeps displaying the last photo (current behavior on network error) rather than showing a broken state
- The user can tap a "Reconnect" button that opens the OAuth flow in a new tab

**Dependencies:**
- `photo-proxy.js` -- must handle per-user auth errors gracefully
- `slideshow.html` -- must show reconnection UI

**Confidence:** HIGH -- error handling pattern is well-established.

---

#### D-5: Slideshow Device Setup QR Code

**Why valuable:** After a user authenticates and picks photos on their phone, they need to open the slideshow on their iPad. A QR code pointing to their personal slideshow URL makes this frictionless.

**What it looks like:**
After completing photo selection, the settings page shows:
```
  [Your frame is ready!]

  [QR CODE]

  Scan with your iPad to start the slideshow.
  URL: okno.moonacle.com/slideshow.html
```

**Complexity:** LOW (QR code generation library, minimal UI)

**Dependencies:** None -- the slideshow URL is the same for all users (session-based), so the QR just points to the base slideshow URL. Could be done with a simple JS QR library like `qrcode` or a QR SVG generator.

**Confidence:** HIGH -- trivial feature.

---

### Anti-Features (Deliberately NOT Building)

These are features commonly requested or commonly built in this domain that would be wrong to build now. Each has a clear rationale for exclusion.

---

#### AF-1: Client-Side Token Storage (IndexedDB/localStorage)

**Why avoid:** The earlier Multi-User Architecture decision (Feb 13) recommended client-side primary storage. This is being REVERSED for v2.0. Here is why:

The fundamental UX of Okno is: set up on your phone, run on your iPad. Client-side storage means tokens stored in the phone's browser cannot be accessed by the iPad's browser. The user would need to authenticate separately on the iPad (Guided Access kiosk mode makes this nearly impossible) or use the same browser profile on both devices (not realistic).

Server-side token storage solves this: authenticate once on any device, the iPad's slideshow uses the server's stored token. This is how the current single-user app works, and it works well.

**What to do instead:** Store tokens server-side in the database, scoped by user_id. The session cookie (httpOnly, secure) identifies the user. The backend retrieves their tokens from the DB.

---

#### AF-2: Admin Dashboard UI

**Why avoid:** Building a web UI for admin tasks (user management, invite code generation, analytics) is significant scope for a small user base. The admin is the VPS owner who has SSH access.

**What to do instead:** CLI scripts that run on the VPS:
```bash
node admin.js create-invite --uses 5 --expires 30d
node admin.js list-users
node admin.js delete-user --email user@example.com
node admin.js list-invites
```

This covers 100% of admin needs for an invite-only app with under 100 users. Build the admin UI in a future version when (if) user management becomes burdensome.

---

#### AF-3: Shared Albums / Social Features

**Why avoid:** Okno is a personal photo frame, not a social photo platform. Adding album sharing, comments, likes, or collaborative curation adds massive complexity and changes the product's identity.

**What to do instead:** Each user has their own isolated photo collection. If two users want to share photos, they do it through Google Photos sharing (which already exists and is excellent).

---

#### AF-4: Real-Time Photo Sync

**Why avoid:** There is no push API from Google Photos. Implementing real-time sync would require either:
- Polling the Google API for changes (burns quota, unreliable)
- A webhook service (Google doesn't offer one for Photos)

**What to do instead:** Users add photos by starting a new Picker session. The cache merges new selections with existing ones. This explicit user action is both simpler and more predictable.

---

#### AF-5: Photo Editing / Cropping / Filtering

**Why avoid:** The photo management grid is for viewing and removing photos, not editing them. Adding crop, rotate, filter, or enhancement tools is out of scope for a photo frame app.

**What to do instead:** The grid shows photos as-is. Users who want to edit photos use Google Photos (which has excellent editing tools) and the edited version appears in Okno automatically on the next baseUrl refresh.

---

#### AF-6: Multi-Device Sync for Same User

**Why avoid:** Supporting multiple iPads per user (or an iPad and a TV) adds device management complexity. Each device could show different photo subsets, different settings, different positions in the slideshow.

**What to do instead:** One user = one device. If a user wants two frames, they create two accounts (two Google accounts). This matches the physical reality: different rooms, different frames, different photo selections.

---

#### AF-7: Open Registration

**Why avoid:** The Google OAuth 100-user lifetime cap for unverified apps is a hard constraint. Open registration risks hitting this cap with throwaway or one-time users. Invite codes ensure each slot is intentionally allocated.

**What to do instead:** Invite-only for v2.0. Re-evaluate in v2.1+ after:
1. Assessing actual demand
2. Completing Google OAuth verification (if demand warrants)
3. Implementing rate limiting and abuse prevention

---

#### AF-8: Video Playback

**Why avoid:** Explicitly deferred to v2.1+ in project scoping. Video adds decoding complexity, bandwidth considerations, audio handling, and iPad memory pressure that should not block multi-tenant launch.

**What to do instead:** Continue showing photos only. Add video support as a dedicated feature phase after multi-tenant is stable.

---

## Feature Dependencies

```
                    TS-6: Database Migration
                         |
                    TS-7: Auto-Migration
                         |
              +----------+----------+
              |          |          |
        TS-1: Per-User   TS-2: Data   TS-3: Session
        OAuth            Isolation    Management
              |          |          |
              +----------+----------+
                         |
                    TS-4: Invite Codes
                         |
                    TS-5: Per-User Slideshow
                         |
              +----------+----------+
              |          |          |
        D-1: Photo    D-2: Invite  D-3: Account
        Grid          Links        Page
              |
        D-4: Token
        Expiry
```

**Dependency chain explanation:**
1. Database must exist before any per-user feature can be built
2. Auto-migration must run to preserve existing user's data
3. Per-user OAuth, data isolation, and session management can be built in parallel once DB exists
4. Invite codes gate new user registration -- requires sessions and user model
5. Per-user slideshow requires all three isolation features
6. Differentiators (grid, invite links, account page) build on top of the table stakes

---

## MVP Definition

**The minimum for multi-tenant to work (in order of implementation):**

1. **TS-6: Database migration** -- SQLite schema, connection module
2. **TS-7: Auto-migration** -- Import existing JSON data as first user
3. **TS-1: Per-user OAuth** -- Refactor auth.js for multi-user token storage
4. **TS-2: Data isolation** -- All queries scoped by user_id
5. **TS-3: Session management** -- Session stores userId, routes check ownership
6. **TS-4: Invite codes** -- Code validation before OAuth flow
7. **TS-5: Per-user slideshow** -- Photo proxy scoped to authenticated user

**Defer to post-MVP within v2.0:**
- D-1: Photo management grid (high value but not blocking multi-tenant)
- D-3: Account page (nice to have, not critical for initial users)

**Defer to post-v2.0:**
- D-4: Graceful per-user token expiry (important but can iterate)
- D-5: QR code setup (convenience feature)

---

## Feature Prioritization Matrix

| Feature | User Value | Technical Risk | Effort | Priority | Phase |
|---------|-----------|---------------|--------|----------|-------|
| TS-6: DB Migration | Foundation | MEDIUM | MEDIUM | P0 | 1 |
| TS-7: Auto-Migration | High (data preservation) | LOW | LOW | P0 | 1 |
| TS-1: Per-User OAuth | Critical | HIGH | HIGH | P0 | 1 |
| TS-2: Data Isolation | Critical | MEDIUM | MEDIUM | P0 | 1 |
| TS-3: Session Mgmt | Critical | LOW | LOW | P0 | 1 |
| TS-4: Invite Codes | High | LOW | LOW | P0 | 1 |
| TS-5: Per-User Slideshow | Critical | MEDIUM | MEDIUM | P0 | 1-2 |
| D-1: Photo Grid | High | MEDIUM | MEDIUM-HIGH | P1 | 2 |
| D-2: Invite Links | Medium | LOW | LOW | P1 | 1 |
| D-3: Account Page | Medium | LOW | LOW-MEDIUM | P2 | 2 |
| D-4: Token Expiry | Medium | MEDIUM | MEDIUM | P2 | 2-3 |
| D-5: QR Code | Low | LOW | LOW | P3 | 3+ |

---

## Photo Grid UX Patterns (Deep Dive)

This section provides additional detail for D-1 since it is the most UX-complex new feature.

### Grid Layout Options Considered

| Layout | Description | Pros | Cons | Used By |
|--------|-------------|------|------|---------|
| **Uniform square (recommended)** | Fixed-size square cells, photos cropped to fill | Clean, predictable, easy to build | Crops photos | Google Photos, Apple Photos, Instagram |
| Masonry | Variable height, fixed width | Shows full photos | Complex layout, no consistent rows | Pinterest |
| Justified | Variable width, rows fill container | Elegant | Requires JS layout engine | Flickr, 500px |

**Recommendation: Uniform square grid.** It's the simplest to build with CSS Grid, matches user expectations (Google Photos uses it), and the management grid is a tool, not a gallery -- visual perfection is less important than usability.

### Interaction States

| State | Visual | Actions Available |
|-------|--------|-------------------|
| **Browse** (default) | Thumbnails in grid, count shown | Tap photo for preview, scroll, "Select" button |
| **Preview** | Single photo enlarged, metadata shown | Close, navigate prev/next, "Remove" |
| **Selection** | Checkboxes on thumbnails, selected photos highlighted | Toggle selection, "Remove Selected (N)", "Select All", "Cancel" |
| **Removing** | Confirmation dialog: "Remove N photos from your frame?" | Confirm, Cancel |

### Mobile vs Desktop

| Device | Grid Columns | Selection Mode | Notes |
|--------|-------------|----------------|-------|
| Phone (320-480px) | 3 columns | Tap to toggle | Primary management device |
| Tablet (768px+) | 4-5 columns | Tap or long-press | Uncommon for management |
| Desktop (1024px+) | 5-6 columns | Click, Shift-click range | Secondary management device |

### Thumbnail Loading Strategy

1. **Initial load:** Load first 20-30 thumbnails immediately (above the fold)
2. **Lazy loading:** Use `loading="lazy"` on img tags or `IntersectionObserver` for remaining
3. **Placeholder:** Show a subtle gray box with the neumorphic inset style while loading
4. **Error state:** If thumbnail fails to load (expired baseUrl), show a broken-image placeholder with "Refresh" action
5. **Caching:** Browser-level caching via `Cache-Control: max-age=3600` on thumbnail responses (thumbnails are small, can afford to cache for an hour)

---

## Per-User Settings (Detail for TS-2)

Currently, settings are global (`config.json`). In multi-tenant, each user needs their own settings.

### Which Settings Become Per-User

| Setting | Per-User? | Rationale |
|---------|-----------|-----------|
| `interval` | YES | User A may want 30s, User B wants 60s |
| `displayMode` | YES | Different iPads, different preferences |
| `onThisDay` | YES | Personal preference |
| `portraitPairs` | YES | Personal preference |
| `transitionTime` | YES | Personal preference |
| `kenBurns` | YES | Personal preference |
| `blurredBackground` | YES | Personal preference |
| `showPhotoDate` | YES | Personal preference |
| `showClock` | YES | Personal preference |

**Result:** ALL current settings become per-user. There are no "system-wide" settings in the current config. In the future, system-wide settings might include things like rate limits or maintenance mode, but those would be environment variables, not database config.

### Settings API Changes

Current:
```
GET  /api/config    -- returns global config
POST /api/config    -- updates global config
```

v2.0:
```
GET  /api/config    -- returns config for authenticated user (resolved from session)
POST /api/config    -- updates config for authenticated user
```

The frontend code (`settings.html`, `slideshow.html`) needs zero changes since it already calls `/api/config`. The backend transparently scopes to the authenticated user.

---

## Admin CLI Tooling (Detail for v2.0 Scope)

### Commands Needed

```bash
# Invite management
node admin.js create-invite [--uses N] [--expires Nd]
node admin.js list-invites [--active] [--expired]
node admin.js revoke-invite CODE

# User management
node admin.js list-users
node admin.js user-info EMAIL
node admin.js delete-user EMAIL [--confirm]

# System info
node admin.js stats   # total users, photos, active sessions
```

### Implementation Pattern

The admin CLI shares the database module with the Express app but does not start the HTTP server. It imports the DB layer, runs queries, and outputs results to stdout.

```javascript
// admin.js
const db = require('./db');

const command = process.argv[2];
switch (command) {
  case 'create-invite':
    // Generate random code, insert into invite_codes table
    break;
  case 'list-users':
    // SELECT * FROM users
    break;
  // ...
}
```

**Complexity:** LOW -- it's just a CLI wrapper around database queries.

---

## Google OAuth Verification (Blocking Concern)

### Current Status

The app uses `photospicker.mediaitems.readonly` scope. Google requires OAuth verification review for all apps accessing Google Photos APIs. Without verification:
- Users see "Google hasn't verified this app" warning during sign-in
- App is limited to 100 lifetime users
- Users must click "Advanced" then "Go to [app name] (unsafe)" to proceed

### Impact on v2.0

For invite-only friends-and-family use (5-20 users), this is manageable:
- Users trust the app owner (Sam) and will click through the warning
- 100-user cap is not a concern

For wider distribution:
- The warning scares away non-technical users
- 100-user cap becomes a hard blocker
- Verification requires: privacy policy page, demo video, domain verification, 3-5 business days

### Recommendation

Do NOT block v2.0 on Google verification. Build and ship with the unverified app flow. Begin verification in parallel:
1. Write privacy policy (needed for the app anyway)
2. Record demo video of the OAuth flow
3. Verify domain ownership in Google Search Console
4. Submit for verification

If verification fails or takes too long, the invite-only model still works for the target user base.

---

## Sources

### HIGH Confidence (Official Documentation, Codebase Analysis)
- [Google Photos Authorization Scopes](https://developers.google.com/photos/overview/authorization) -- scope classification, verification requirements
- [Google OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server) -- token refresh behavior, 100 refresh token limit per account
- [Google Cloud Unverified Apps](https://support.google.com/cloud/answer/7454865) -- 100-user cap, verification process
- [Google Sensitive Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) -- verification requirements and timeline
- [Google API Limits and Quotas](https://developers.google.com/photos/overview/api-limits-quotas) -- rate limits for multi-user considerations
- Codebase analysis: `server.js`, `auth.js`, `photo-cache.js`, `photo-proxy.js`, `config.js`, `picker.js` -- all source files read directly

### MEDIUM Confidence (Verified Community Sources)
- [Dan Schlosser: Building the Image Grid from Google Photos](https://medium.com/@danrschlosser/building-the-image-grid-from-google-photos-6a09e193c74a) -- grid layout algorithm, virtual scrolling pattern
- [Gallery UI Design Best Practices (Mobbin)](https://mobbin.com/glossary/gallery) -- grid layout variants, thumbnail patterns
- [Immich (self-hosted photo management)](https://github.com/immich-app/immich) -- multi-user architecture patterns
- [Lychee (self-hosted photo management)](https://lycheeorg.github.io/) -- user isolation model
- [Auth.js Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) -- per-user token refresh patterns
- [MDN: Lazy Loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading) -- thumbnail loading strategy
- [CSS-Tricks: Seamless Responsive Photo Grid](https://css-tricks.com/seamless-responsive-photo-grid/) -- CSS Grid layout implementation
- [MDN: Aspect Ratios](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Box_sizing/Aspect_ratios) -- `aspect-ratio` property for square thumbnails
- [Userpilot: Onboarding Invited Users](https://userpilot.com/blog/onboard-invited-users-saas/) -- invite flow UX patterns

### LOW Confidence (Needs Validation During Implementation)
- Google Picker API thumbnail URL parameters (`=w240-h240-c`) -- inferred from legacy Library API docs, not explicitly verified for Picker API responses
- Picker session behavior with per-user OAuth clients -- confirmed architecturally possible but not tested with multiple simultaneous users
- `session-file-store` performance with 20+ concurrent session files -- likely fine but untested at this scale
- Per-user baseUrl refresh scheduling under rate limits with 10+ active users -- theoretical analysis only

---
*Feature research for: v2.0 "Multi-Tenant" -- multi-tenant photo frame with invite-based access and photo management grid*
*Researched: 2026-02-27*
