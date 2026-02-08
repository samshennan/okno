# Stack Research

**Domain:** Self-hosted Google Photos digital photo frame web app
**Project:** Okno
**Researched:** 2026-02-08
**Confidence:** MEDIUM-HIGH (critical API change verified; some library behaviors based on community reports)

---

## Critical Finding: Google Photos API Scope Removal

> **This changes everything about the architecture.** As of April 1, 2025, Google removed the `photoslibrary.readonly`, `photoslibrary.sharing`, and `photoslibrary` scopes from the Library API. You can NO LONGER browse a user's entire photo library via API. Calls using removed scopes return `403 PERMISSION_DENIED`.

**What replaced it:** The **Google Photos Picker API** — a session-based flow where the user manually selects photos/albums through Google's own UI, then your app gets temporary access to those selected items.

**Impact on Okno:**
- No more "fetch all photos and display random ones" pattern
- User must go through a Picker session to select photos/albums to share with the app
- After selection, the app gets access to those specific media items
- Base URLs for photos expire after **60 minutes** — must be refreshed
- Sessions have an `expireTime` (exact duration undocumented, but sessions are meant to be short-lived for the selection phase)
- Once items are selected, you can re-list them using the session ID until the session expires

**Architectural implication:** The app needs a "setup flow" where the user picks photos via the Picker, then the server stores session data and periodically refreshes base URLs for the slideshow. This is a fundamentally different pattern from the old "fetch everything" approach.

**Confidence:** HIGH — verified via official Google documentation at developers.google.com/photos/overview/authorization and developers.google.com/photos/picker/guides/get-started-picker

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS (Jod) | Runtime | Active LTS through April 2027. Required by Express 5.x (Node 18+). Native `--env-file` support eliminates need for dotenv. |
| Express | 5.x (5.2.1) | Web framework | Now the default on npm since March 2025. Improved security, async error handling, simplified codebase. Drop-in replacement for Express 4 patterns. |
| google-auth-library | 10.x (10.5.0) | OAuth 2.0 | Official Google auth library. Handles token refresh automatically — when refresh_token is present, library auto-obtains new access_tokens. On 401/403, automatically requests new token and replays request. |
| nginx | Latest stable | Reverse proxy + SSL | Handles SSL termination, static file serving, rate limiting. Certbot integration for free Let's Encrypt SSL. Standard production pattern. |
| PM2 | 6.x (6.0.14) | Process manager | Keeps Node.js alive, auto-restart on crash, startup scripts for boot persistence. 100M+ downloads, battle-tested. |

**Confidence:** HIGH — all versions verified via npm and official sources (Feb 2026)

### Google Photos API Integration

| Component | Details | Notes |
|-----------|---------|-------|
| Picker API endpoint | `https://photospicker.googleapis.com` | New REST API replacing Library API read-only access |
| OAuth scope | `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` | Only scope needed — creates sessions, lists selected media items |
| Session flow | Create session -> User picks via pickerUri -> Poll until mediaItemsSet=true -> List media items | Server-side REST calls, no client SDK needed |
| Media item access | Base URLs with `=w{width}-h{height}` params | Base URLs expire after **60 minutes** — must refresh periodically |
| API quotas | 10,000 requests/day general; 75,000/day media bytes; 100,000/min rate limit | Generous for single-user digital frame |

**Confidence:** HIGH — verified via official Picker API documentation

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| helmet | 8.x (8.1.0) | HTTP security headers | Always. Express best practice — wraps 15 security middlewares. Prevents XSS, clickjacking, etc. |
| express-session | 1.18.x | Server-side session storage | Store OAuth tokens and Picker session data server-side. Never expose tokens to client. |
| express-rate-limit | 8.x (8.2.1) | API rate limiting | Protect OAuth callback and API routes from abuse. |
| NoSleep.js | 0.12.0 | Prevent screen sleep (iOS) | **PRIMARY screen wake strategy** — see critical note below about Wake Lock API bug. Uses hidden video playback hack. |

**Confidence:** HIGH for helmet, express-session, express-rate-limit (verified npm). MEDIUM for NoSleep.js (last release Dec 2020, but still the standard approach; see Wake Lock section).

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| nodemon | Auto-restart on file changes | Dev only. `npm install -D nodemon`. Use `"dev": "nodemon server.js"` in package.json. |
| Node.js `--env-file` | Load .env file natively | Node 22 LTS has native support. No dotenv dependency needed. Use `node --env-file=.env server.js` |

**Confidence:** HIGH

---

## Critical: Wake Lock on iPad Pro 1st Gen (iOS 16.x)

> **The Screen Wake Lock API does NOT work in PWAs (Home Screen web apps) on iOS 16.x.** This is a confirmed WebKit bug (#254545) that was only fixed in iOS/iPadOS 18.4 (March 31, 2025). The iPad Pro 1st Gen maxes out at iPadOS 16.x and will NEVER get this fix.

**What this means for Okno:**
- The native `navigator.wakeLock` API works in Safari browser mode on iOS 16.4+ but is **broken in installed PWAs**
- Since Okno runs as a Home Screen PWA, the Wake Lock API is useless
- **NoSleep.js is the PRIMARY strategy, not a fallback** — its hidden video playback trick is the only reliable way to prevent screen sleep in a PWA on iOS 16

**NoSleep.js caveats in PWA mode:**
- Must be triggered by user interaction (tap) — cannot auto-enable on page load
- Need to recreate the NoSleep instance before each `enable()` call for reliability in PWAs
- If the PWA goes to background, NoSleep is disabled — re-enable on `visibilitychange` event
- The library is old (v0.12.0, Dec 2020) but the video hack still works because browsers won't sleep during video playback

**Recommended fallback stack:**
1. User taps screen to start slideshow -> triggers `noSleep.enable()`
2. On `visibilitychange` back to visible -> recreate NoSleep instance, re-enable
3. Additionally: iPad Settings > Display & Brightness > Auto-Lock > Never (belt and suspenders)
4. Consider: iPad Guided Access mode (triple-click Home) with "Mirror Display Auto-Lock" enabled — prevents sleep at OS level

**Confidence:** HIGH — WebKit bug #254545 confirmed resolved only in 18.4; iPad Pro 1st Gen max iOS verified as 16.x

---

## PWA on iOS 16.x Safari — Manifest & Configuration

### Required HTML Meta Tags

```html
<!-- PWA manifest -->
<link rel="manifest" href="/manifest.json">

<!-- iOS-specific (still required on iOS 16) -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-touch-fullscreen" content="yes">
<link rel="apple-touch-icon" href="/icons/icon-180.png">

<!-- Viewport for fullscreen -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### manifest.json

```json
{
  "name": "Okno Photo Frame",
  "short_name": "Okno",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### iOS 16 PWA Limitations

| Feature | Status on iOS 16 | Workaround |
|---------|-------------------|------------|
| `display: standalone` | Supported since 11.3 | Works |
| `display: fullscreen` | Falls back to standalone | iPad only since iOS 8 — use standalone |
| Manifest icons | Supported since 15.4 | Keep `apple-touch-icon` link as fallback |
| `background_color` | NOT supported | Use CSS `body { background: #000 }` |
| `orientation` lock | NOT supported | Use CSS media queries + JS |
| Splash screen | Only via `apple-touch-startup-image` links | Must create per-resolution images or skip |
| Service Workers | Supported since 11.3 | Use for offline caching |
| Push notifications | 16.4+ only, PWA must be installed first | Not needed for photo frame |
| Storage limit | ~50MB for PWA cache | Don't cache photos in service worker — stream from server |
| Screen Wake Lock | **BROKEN in PWA mode** (fixed in 18.4) | NoSleep.js video hack |

**Confidence:** HIGH — verified via firt.dev/notes/pwa-ios/ and WebKit bug tracker

---

## Google Photos Picker API — Architecture Pattern

### The Setup Flow (One-Time per Photo Selection)

```
1. User opens Okno web app
2. App redirects to Google OAuth consent (if not authenticated)
3. User grants photospicker.mediaitems.readonly scope
4. Server creates Picker session via POST /v1/sessions
5. User is shown pickerUri link (opens Google Photos in new tab)
6. User selects photos/albums in Google Photos UI
7. Server polls GET /v1/sessions/{id} until mediaItemsSet=true
8. Server calls GET /v1/mediaItems?sessionId={id} to get selected items
9. Server stores media item IDs and metadata in memory/file
10. Slideshow begins
```

### The Slideshow Flow (Continuous)

```
1. Server picks random media item from stored list
2. Server fetches fresh baseUrl (they expire every 60 min)
3. Server proxies image to client with size params: baseUrl + =w{width}-h{height}
4. Client displays image with CSS transitions
5. Timer advances to next photo
6. Repeat from step 1
```

### Base URL Refresh Strategy

Base URLs expire after 60 minutes. Two approaches:

**Option A: Server-side proxy (recommended)**
- Client requests `/api/photo/next` from Express server
- Server fetches fresh baseUrl from Picker API, appends size params, proxies bytes to client
- Pros: Client never sees Google URLs; server controls caching; handles expiry transparently
- Cons: All image traffic flows through server

**Option B: Client-side refresh**
- Server provides fresh baseUrl to client via API
- Client loads image directly from Google
- Pros: Less server bandwidth
- Cons: Exposes Google URLs to client; harder to handle expiry gracefully

**Recommendation: Option A** — for a single-user photo frame, bandwidth isn't a concern, and it keeps the client dead simple (just show images from your own server).

**Confidence:** HIGH for the flow; MEDIUM for optimal refresh timing (session expireTime not documented precisely)

---

## Token Refresh & Security

### OAuth 2.0 Token Handling

```
google-auth-library handles this automatically:

1. Store refresh_token on first OAuth consent (only returned ONCE)
2. Library auto-refreshes access_token when expired
3. On 401/403, library retries with fresh token
4. Store tokens server-side in express-session (or encrypted file)
```

### Security Best Practices

| Practice | Implementation | Why |
|----------|---------------|-----|
| Tokens server-side only | Store in express-session, never send to client | Tokens grant access to user's Google Photos |
| .env for secrets | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` in .env | Never commit secrets |
| .gitignore | Add `.env`, `node_modules/`, `tokens.json` | Prevent accidental exposure |
| helmet middleware | `app.use(helmet())` | Sets 15 security headers automatically |
| HTTPS only | nginx + Let's Encrypt via Certbot | Required for OAuth redirect URIs; required for service workers |
| Rate limiting | `express-rate-limit` on `/auth/*` routes | Prevent OAuth abuse |
| Cookie security | `{ secure: true, httpOnly: true, sameSite: 'lax' }` | Prevent session hijacking |
| No `--env-file` in production | Use PM2 ecosystem config or systemd env | PM2 can load env from ecosystem.config.js |

**Confidence:** HIGH — standard patterns verified across multiple sources

### Refresh Token Persistence

The refresh_token is only returned on the **first** OAuth authorization. If lost, user must re-authorize. Options for persistence:

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| In-memory (express-session default) | Simple | Lost on restart | NOT for production |
| File-based (JSON) | Survives restart | Manual encryption needed | Good for single-user |
| SQLite | Structured, queryable | Overkill for one user | Skip for MVP |
| Environment variable | Survives restart | Manual management | Acceptable for single user |

**Recommendation:** File-based JSON storage (`tokens.json`) with restrictive file permissions (`chmod 600`). Encrypted at rest if possible. For a single-user self-hosted app, this is the pragmatic choice.

---

## Photo Caching Strategy

### Why Cache

- Base URLs expire every 60 min — can't re-fetch endlessly
- Network failures shouldn't kill the slideshow
- Pre-fetching next image enables smooth transitions

### Recommended Approach: In-Memory LRU + File Buffer

| Layer | What | Size | TTL |
|-------|------|------|-----|
| **Metadata cache** | Media item list from Picker session (IDs, mimeTypes) | Tiny (~KB) | Until new Picker session |
| **URL cache** | Fresh baseUrls mapped to media item IDs | Tiny (~KB) | 55 min (refresh before 60-min expiry) |
| **Image buffer** | Next 2-3 images pre-fetched as Buffers | ~15-30MB | Until displayed |
| **Current image** | Currently displayed image | ~5-10MB | Until next transition |

### Implementation Notes

- Use a simple `Map` or object for URL cache — no need for lru-cache library for single-user
- Pre-fetch next 2-3 images while current one displays (double-buffer pattern)
- If URL refresh fails, serve from buffer (graceful degradation)
- Don't cache to disk unless needed — in-memory is simpler and sufficient for single user
- Node.js default memory is ~1.5GB — holding 3-5 images in memory is trivial
- Use `Buffer` for image data, not base64 strings (less memory overhead)

**Confidence:** MEDIUM — standard patterns, but optimal buffer sizes depend on actual photo resolutions

---

## Installation

```bash
# Core dependencies
npm install express google-auth-library helmet express-session express-rate-limit

# Frontend (served as static files, no install needed)
# NoSleep.js — include via CDN or copy to /public/js/
# <script src="https://cdnjs.cloudflare.com/ajax/libs/nosleep/0.12.0/NoSleep.min.js"></script>
# OR download and self-host (recommended for reliability)

# Dev dependencies
npm install -D nodemon
```

### package.json Scripts

```json
{
  "scripts": {
    "start": "node --env-file=.env server.js",
    "dev": "nodemon --env-file=.env server.js"
  }
}
```

### PM2 Production Start

```bash
# ecosystem.config.js handles env vars in production
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express 5.x | Fastify | If you need maximum performance. But Express has better Google API sample code and ecosystem familiarity for vibe-coding. |
| google-auth-library | passport + passport-google-oauth20 | If you need multi-provider auth. Passport adds unnecessary complexity for single-provider Google OAuth. |
| express-session (memory store) | connect-session-knex, connect-redis | If you have multiple users or need session persistence across restarts. Overkill for single-user frame. |
| Node.js native --env-file | dotenv (17.x) | If stuck on Node < 20.6. With Node 22 LTS, native support is cleaner with zero dependencies. |
| NoSleep.js | Native Wake Lock API | If targeting iOS 18.4+ only. iPad Pro 1st Gen can't use it — stuck on iOS 16. |
| File-based token storage | SQLite via better-sqlite3 | If you add multiple users or need structured queries. MVP doesn't need it. |
| In-memory image buffer | Redis for image cache | If you scale to multiple server instances. Single PM2 process doesn't need it. |
| googleapis (monolith) | google-auth-library + manual REST | googleapis package is 170+ MB and includes ALL Google APIs. For Picker API only, use google-auth-library for auth + direct REST calls (fetch/axios) to photospicker.googleapis.com. Much lighter. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `googleapis` npm package (full) | 170+ MB monolith package containing ALL Google API clients. Massive install, slow startup. Picker API isn't even included as a dedicated client yet. | `google-auth-library` for OAuth + native `fetch()` (Node 22 has it built-in) for Picker API REST calls |
| `photoslibrary.readonly` scope | **Removed April 1, 2025.** Returns 403 PERMISSION_DENIED. | `photospicker.mediaitems.readonly` scope with Picker API |
| `googlephotos` npm package | Last published 4 years ago. Uses old Library API scopes that no longer work. | Direct REST calls to Picker API |
| React/Vue/any framework | Adds build step, increases complexity, no benefit for a fullscreen image slideshow. Old Safari compatibility risk. | Vanilla HTML/CSS/JS — zero build step, works everywhere |
| dotenv | Unnecessary dependency with Node 22 LTS. | `node --env-file=.env` (native) |
| Wake Lock API as primary strategy | Broken in PWA mode on iOS 16.x. Fixed only in 18.4. iPad Pro 1st Gen can't run 18.4. | NoSleep.js video hack as primary, Guided Access as OS-level backup |
| Service worker for photo caching | iOS limits PWA cache to ~50MB. Photos would fill this instantly. Eviction is aggressive. | Server-side proxy with in-memory buffer |
| passport.js | Adds auth abstraction layer with strategies/serialization. Overkill when you have exactly one OAuth provider and one user. | google-auth-library directly |
| `apple-mobile-web-app-capable` without manifest | Legacy-only approach. | Use both: manifest.json for standards compliance + meta tag for iOS backward compat |

---

## Stack Patterns by Variant

**If the user only has a few albums to display:**
- Use Picker API to select an album once
- Store selected media item list server-side
- Refresh base URLs every ~55 minutes via cron/setInterval
- Slideshow picks randomly from stored list

**If the user wants photos to rotate/change selection periodically:**
- Build a "re-pick" feature: button in admin UI triggers new Picker session
- Or: schedule periodic re-pick prompts (e.g., weekly notification)
- Each new session replaces the stored media item list

**If base URL refresh becomes unreliable:**
- Download photos to server disk on first fetch (within 60-min window)
- Serve from local disk cache
- Trade-off: disk space vs API dependency
- Consider: 1000 photos at 5MB each = 5GB disk — manageable on most VPS

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Express 5.x | Node.js 18+ | Node 22 LTS recommended |
| google-auth-library 10.x | Node.js 14+ | Works with Node 22 |
| helmet 8.x | Express 4.x or 5.x | Compatible with both |
| express-session 1.18.x | Express 4.x or 5.x | Verify middleware order with Express 5 |
| express-rate-limit 8.x | Express 4.x or 5.x | Uses new Express 5 async patterns |
| NoSleep.js 0.12.0 | All browsers | Vanilla JS, no framework dependency |
| PM2 6.x | Node.js 16+ | Compatible with Node 22 |
| certbot | nginx 1.18+ | Auto-renewal via systemd timer |

---

## iPad Pro 1st Gen Specific Considerations

| Constraint | Implication | Mitigation |
|------------|-------------|------------|
| Max iPadOS 16.7.x | No iOS 17/18 features | Test all features against Safari 16 |
| Wake Lock broken in PWA | Screen will sleep | NoSleep.js + Auto-Lock=Never + Guided Access |
| 2GB RAM (12.9") / 2GB RAM (9.7") | Limited browser memory | Don't preload more than 3-5 images |
| A9X chip | Adequate for image display | CSS transitions over JS animations for perf |
| 2732x2048 (12.9") / 2048x1536 (9.7") | High-res display | Request images at native resolution via baseUrl params |
| Safari 16 JS engine | Modern JS supported (ES2020+) | Avoid top-level await in scripts; use async IIFE |
| No Web Bluetooth, no USB | Can't programmatically control brightness | User must set brightness manually in Settings |

---

## Sources

### HIGH Confidence (Official Documentation)
- [Google Photos API Authorization Scopes](https://developers.google.com/photos/overview/authorization) — verified scope removal and replacements
- [Google Photos Picker API Getting Started](https://developers.google.com/photos/picker/guides/get-started-picker) — session flow, pickerUri, polling
- [Picker API Sessions Reference](https://developers.google.com/photos/picker/reference/rest/v1/sessions) — session JSON structure, expireTime, pollingConfig
- [Picker API Media Items Guide](https://developers.google.com/photos/picker/guides/media-items) — baseUrl, size params, 60-min expiry
- [Google Photos API Quotas](https://developers.google.com/photos/overview/api-limits-quotas) — 10K requests/day, 75K media bytes/day
- [WebKit Bug #254545](https://bugs.webkit.org/show_bug.cgi?id=254545) — Wake Lock broken in PWAs, fixed in iOS 18.4

### MEDIUM Confidence (npm + Community Verified)
- [Express 5.1.0 Release Announcement](https://expressjs.com/2025/03/31/v5-1-latest-release.html) — Express 5 now default on npm
- [google-auth-library npm](https://www.npmjs.com/package/google-auth-library) — v10.5.0, auto token refresh
- [NoSleep.js GitHub](https://github.com/richtr/NoSleep.js) — v0.12.0, video hack mechanism
- [firt.dev iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/) — comprehensive iOS PWA feature matrix
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) — Node 22 LTS through April 2027

### LOW Confidence (Community Reports, Needs Validation)
- NoSleep.js reliability in iOS 16 PWA mode — multiple GitHub issues report intermittent failures; recreating instance before each enable() is a community-reported workaround
- Google Photos Picker API session expireTime exact duration — not documented; needs empirical testing
- Whether Picker API allows selecting an "entire album" vs individual photos — documentation unclear; needs testing

---

*Stack research for: Okno — Self-hosted Google Photos digital photo frame*
*Researched: 2026-02-08*
