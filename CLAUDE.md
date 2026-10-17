# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start   # Express server, port 3100 (or $PORT). No test suite — test manually in browser.
```

## What This Is

**OKNO** — self-hosted Google Photos digital photo frame PWA on an iPad. Node/Express backend on a VPS proxies all images (Google Photos `baseUrl` requires `Authorization` headers that `<img>` tags can't send). Any Google account can sign in; each user gets fully isolated photos, tokens, and settings.

## Architecture

```
iPad Safari PWA  ←→  VPS (Express :3100)  ←→  Google Photos Picker API
                            ↓
                     SQLite data/okno.db
```

## Key Files

| File | Role |
|------|------|
| `server.js` | Entry point — mounts routes, session, helmet/CSP |
| `auth.js` | OAuth 2.0 flow + `requireAuth` middleware + per-user `OAuth2Client` cache (`Map<userId, client>`) |
| `photo-proxy.js` | `GET /api/photo/random` — random photo from cache, fetched from Google with auth header |
| `photo-cache.js` | `Map<userId, CacheData>` in-memory cache backed by SQLite; refreshes Google `baseUrl`s every 50 min (they expire at ~60 min) |
| `picker.js` | Google Picker API session flow (`/api/picker/*`) — populates the cache |
| `config.js` | Per-user settings — `Map<userId, config>`, persisted to `user_settings` table |
| `db/migrate.js` | Schema + auto-migration on startup (`PRAGMA user_version`) |

## Frontend (`public/`)

- **`slideshow.html`** — Two stacked `<img>` with CSS crossfade + Ken Burns. Polls `/api/photo/random`. NoSleep.js hidden video fallback for iOS 16 Wake Lock bugs. Shows reconnect overlay on 401.
- **`settings.html`** — Config UI + logout button
- **`index.html`** — Dashboard (Picker launch + health status), auth-guarded
- **`login.html`** / **`demo.html`** — Public pages (no auth required)

## Database (`data/okno.db`)

Five tables, auto-migrated: `users`, `tokens` (per-user OAuth), `photo_cache` (UNIQUE on `user_id, media_item_id`), `user_settings` (JSON blob), `invite_codes` (unused, pre-wired).

## Auth Flow

1. `/auth/login` → Google OAuth with CSRF `state` token
2. `/auth/callback` → exchange code → UPSERT user by email → save tokens → `session.userId`
3. `requireAuth` checks `req.session.userId`; returns 401 JSON for `/api/*`, redirects otherwise
4. Per-user `OAuth2Client` instances cached in `Map` — avoids token refresh race conditions
5. `photo-cache.js` uses `require('./auth')` inside `refreshBaseUrls()` (lazy require to break circular dep)

## Environment Variables

```
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, PORT=3100
```

## User Settings (JSON in `user_settings.settings`)

`interval` (30s), `displayMode` (cover/contain/dual), `kenBurns`, `blurredBackground`, `showPhotoDate`, `showClock`, `onThisDay`, `portraitPairs`, `transitionTime`

## Planning

Phases in `.planning/phases/`. Phase 09 (per-user auth) code-complete, awaiting manual checkpoint. Next: Phase 10 (resilience), 11 (hide photo), 12 (README).
