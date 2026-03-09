# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start the Express server (port 3100, or $PORT)
node server.js     # Same as above
```

No test suite is configured. Manual testing via browser against the running server.

## What This Is

**OKNO** (Polish for "window") is a self-hosted digital photo frame that turns an iPad into a fullscreen Google Photos slideshow. Architecture:

```
iPad (Safari PWA) ←→ VPS (Node.js/Express, port 3100) ←→ Google Photos API
                              ↓
                      SQLite (data/okno.db)
                      users, tokens, photo_cache, user_settings
```

**Why backend proxy images?** Google Photos `baseUrl` values require Authorization headers — browser `<img>` tags can't add them, so every image is proxied through `/api/photo/random`.

## Key Files

| File | Role |
|------|------|
| `server.js` | Express entry point, mounts all routes, session middleware, helmet/CSP |
| `auth.js` | Google OAuth 2.0 routes (`/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/status`) and `requireAuth` middleware |
| `photo-proxy.js` | `GET /api/photo/random` — picks random cached photo, fetches via Google API, streams to client |
| `photo-cache.js` | In-memory + SQLite cache of Google Photos media items, per-user, populated via Picker API |
| `picker.js` | Google Picker API session management (`/api/picker/*`) |
| `config.js` | Per-user slideshow settings (interval, Ken Burns, overlays, etc.) — `GET/POST /api/config` |
| `db/database.js` | SQLite connection with WAL mode, foreign keys, 16MB cache |
| `db/migrate.js` | Schema creation — run automatically on startup |
| `health.js` | `GET /api/health` — token validity, cache size, user info |
| `feedback.js` | `POST /api/feedback` — bug/feedback collection |
| `demo-photos.js` | Demo mode routes using `/public/demo/` local images (no auth required) |

## Frontend Pages (`public/`)

- **`slideshow.html`** — The main PWA: two stacked `<img>` elements with CSS crossfade, Ken Burns zoom/pan, clock/date overlays, polling `/api/photo/random` every N seconds. Uses NoSleep.js (hidden video) as fallback for iOS 16 Wake Lock bugs.
- **`index.html`** — Dashboard: Picker integration to load albums, health status
- **`settings.html`** — Per-user config UI, logout button
- **`login.html`** — OAuth entry point
- **`demo.html`** — Fully isolated demo slideshow (no auth)
- **`sw.js`** — Service Worker for PWA offline support

## Database Schema

**SQLite at `data/okno.db`**, auto-migrated on startup:

- **`users`** — `id, email (UNIQUE), display_name, created_at, last_login`
- **`tokens`** — `user_id (PK), access_token, refresh_token, expiry_date, scope, updated_at`
- **`photo_cache`** — `id, user_id, session_id, media_item_id, media_item_data (JSON), created_at` — UNIQUE on `(user_id, media_item_id)`
- **`user_settings`** — `user_id (PK), settings (JSON blob), updated_at`
- **`invite_codes`** — Prepared for V2 invite system

## Auth Flow

1. `GET /auth/login` → redirects to Google OAuth with `state` CSRF token
2. `GET /auth/callback` → verifies state, exchanges code, checks email against `ALLOWED_EMAILS`, creates/updates user + token in DB, creates session
3. All protected routes use `requireAuth` middleware from `auth.js` — checks `req.session.userId`, returns 401 JSON or redirects based on `Accept` header
4. Per-user `OAuth2Client` instances cached in-memory for token refresh efficiency

## Environment Variables (`.env`, never committed)

```
PORT=3100
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
SESSION_SECRET=...
ALLOWED_EMAILS=email1@gmail.com,email2@gmail.com
```

## User Settings Schema

Stored as JSON in `user_settings.settings`:

```js
{
  interval: 30,           // seconds between photo transitions
  displayMode: 'cover',   // 'cover' | 'contain' | 'dual'
  onThisDay: false,       // filter to today's date in history
  portraitPairs: false,   // side-by-side portrait layout
  transitionTime: 1,      // CSS transition duration (seconds)
  kenBurns: true,         // zoom+pan animation
  blurredBackground: true,// blurred fill behind letterboxed images
  showPhotoDate: true,    // overlay: "March 2021"
  showClock: false        // overlay: current time
}
```

## Development Phase System

Phases tracked in `.planning/phases/`. Completed phases: 01–09 (backend deployment through per-user auth). Phase 09 was paused mid-way (task 3/3) at a human verification checkpoint. Each phase directory contains CONTEXT, RESEARCH, PLAN, SUMMARY, and VERIFICATION documents.
