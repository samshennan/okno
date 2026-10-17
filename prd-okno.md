# PRD: Okno — Personal Digital Photo Frame

**Author:** Sam Shennan
**Version:** 1.1
**Date:** 2025-02-08
**Status:** Ready to Build

---

## 1. Product Overview

| Field | Detail |
|---|---|
| **Product** | Okno — a self-hosted web app that turns an old iPad into a Google Photos digital photo frame. Polish for "window." |
| **Platform** | Node.js backend (VPS) → fullscreen PWA in Safari on iPad Pro 1st Gen |
| **User** | Sam (single user, home network) |
| **Cost Target** | $0 (existing VPS + free Google APIs) |
| **Security Model** | Home use only. iPad locked in Guided Access (kiosk mode). No public access concerns. |

---

## 2. Problem Statement

An iPad Pro 1st Gen is collecting dust. A massive Google Photos library exists with years of memories. Commercial photo frame apps cost money and/or require subscriptions. The goal is a free, self-hosted, always-on photo frame that stays synced with Google Photos automatically.

---

## 3. Technical Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  iPad Pro    │◄───────►│   VPS            │◄───────►│  Google Photos  │
│  (Safari)    │  HTTPS  │  (Node/Express)  │  API    │  Library API    │
│  Kiosk Mode  │         │  + nginx + PM2   │         │                 │
└─────────────┘         └──────────────────┘         └─────────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ OpenWeather  │  (V2 - weather widget)
                         │ Free API     │
                         └──────────────┘
```

### Tech Stack

| Layer | Tech | Rationale |
|---|---|---|
| Backend | Node.js + Express | Simple, vibe-code friendly, great Google API libraries |
| Auth | Google OAuth 2.0 | Free, required for Photos Library API |
| API | Google Photos Library API | Free tier (10K requests/day), read-only |
| Frontend | Vanilla HTML / CSS / JS | No build step, works on old Safari, easy to iterate |
| Hosting | VPS (nginx reverse proxy + PM2) | Already available, free |
| SSL | Let's Encrypt (Certbot) | Free, required for OAuth callbacks |
| Weather (V2) | OpenWeatherMap free tier | 1,000 calls/day free |

---

## 4. Feature Roadmap

### MVP — Weekend Build

The minimum to get photos on screen and never touch it again.

| # | Feature | Description |
|---|---|---|
| M1 | **Google Photos OAuth** | Authenticate with Google account, store refresh token in JSON file on VPS |
| M2 | **Full library fetch + cache** | Paginate through entire Google Photos library, cache media item IDs in memory/JSON |
| M3 | **Random photo endpoint** | `/api/random-photo` returns a random photo URL from cache, handles expired baseUrls (they expire ~60min) |
| M4 | **Fullscreen slideshow** | Clean fullscreen HTML page, black background, photo in cover-fit mode (no distortion) |
| M5 | **Crossfade transitions** | CSS opacity transition between two stacked `<img>` elements |
| M6 | **Configurable interval** | Default 30s, adjustable via URL param (`?interval=15`) |
| M7 | **Preload next image** | Fetch next photo while current is displaying for seamless transitions |
| M8 | **Prevent screen sleep** | Wake Lock API with fallback to NoSleep.js (hidden video loop) |
| M9 | **Add to Home Screen PWA** | `<meta name="apple-mobile-web-app-capable" content="yes">` for true fullscreen |
| M10 | **Guided Access compatible** | Works in iOS Guided Access / kiosk mode for always-on display |

### V1 — Polish Week

Make it feel like a real product, not a hack.

| # | Feature | Description |
|---|---|---|
| V1.1 | **Ken Burns effect** | Slow random pan + zoom on each photo. Creates a cinematic, alive feel. CSS transform with transition. |
| V1.2 | **Blurred background fill** | Instead of black bars on non-matching aspect ratios, show a blurred/darkened version of the same image behind. Much more visually appealing. |
| V1.3 | **Clock + date overlay** | Subtle digital clock + date in a corner. Semi-transparent, doesn't distract. Configurable on/off. |
| V1.4 | **Photo date overlay** | Show when the photo was taken ("March 2021") from EXIF/Google metadata. Adds nostalgia factor. |
| V1.5 | **Sleep/wake schedule** | Dim or black out the screen on a schedule (e.g., 11pm→7am). Backend-controlled via config. Saves screen life. |
| V1.6 | **Auto-dim by time** | Gradual brightness reduction in evening hours via CSS filter. |
| V1.7 | **Filter by album** | Settings page to select specific Google Photos albums instead of whole library. |
| V1.8 | **Filter by date range** | Only show photos from a specific period (e.g., "2018–2023"). |
| V1.9 | **Settings page** | Simple web page (`/settings`) to configure interval, filters, overlays, schedule. |
| V1.10 | **QR code for iPad setup** | Settings page generates a QR code pointing to the slideshow URL for quick iPad setup. |

### V2 — Delighter Features

The features that make people say "wait, you *built* this?"

| # | Feature | Description |
|---|---|---|
| V2.1 | **"On This Day" mode** | Only show photos taken on today's date across all years. Mimics Google Photos Memories. Can be a toggle or a time-of-day mode (e.g., first hour of the day = On This Day). |
| V2.2 | **Portrait pair mode** | Detect when two consecutive photos are both portrait orientation → display them side-by-side in landscape. Maximizes screen usage. |
| V2.3 | **Weather widget** | Current weather + icon overlay using OpenWeatherMap free API. Location set in config (Warsaw). |
| V2.4 | **Exclude screenshots** | Filter out screenshots by detecting common aspect ratios (exact screen dimensions) and/or filename patterns. |
| V2.5 | **Exclude non-photos** | Filter out memes, documents, receipts — heuristic based on image dimensions, creation source metadata. |
| V2.6 | **Short video playback** | If a media item is a short video (<15s), play it with audio muted instead of showing a still. |
| V2.7 | **Favorites only mode** | Toggle to only show starred/favorited photos from Google Photos. |
| V2.8 | **Recently added mode** | Show photos added in the last 7/30 days. Great for seeing fresh content. |
| V2.9 | **Shared upload page** | Simple page (`/upload` or `/add`) where Ala (or family) can upload photos directly, bypassing Google Photos. |
| V2.10 | **Touch to pause + info** | Tap the screen to pause slideshow and show photo details (date, location, album). Tap again to resume. |

---

## 5. API Design

### Backend Endpoints

| Endpoint | Method | Description | Version |
|---|---|---|---|
| `/` | GET | Serve the slideshow frontend | MVP |
| `/auth/google` | GET | Initiate Google OAuth flow | MVP |
| `/auth/callback` | GET | Handle OAuth callback, store tokens | MVP |
| `/api/random-photo` | GET | Return random photo URL + metadata | MVP |
| `/api/photo/on-this-day` | GET | Return random photo from today's date in history | V2 |
| `/api/settings` | GET/POST | Read/update slideshow configuration | V1 |
| `/api/weather` | GET | Proxy weather data from OpenWeatherMap | V2 |
| `/api/albums` | GET | List available Google Photos albums | V1 |
| `/api/cache/refresh` | POST | Force re-fetch of photo library cache | V1 |
| `/api/health` | GET | Health check (token status, cache size, uptime) | MVP |
| `/settings` | GET | Settings UI page | V1 |
| `/upload` | GET/POST | Shared photo upload page | V2 |

### Google Photos API Usage

| API Call | Purpose | Notes |
|---|---|---|
| `mediaItems.list` | Paginate full library | Cache media item IDs + metadata. Paginate with `pageToken`. |
| `mediaItems.get` | Fetch individual item | Get fresh `baseUrl` (expires ~60min). Append `=w{width}-h{height}` for sizing. |
| `albums.list` | List user's albums | For album filtering feature. |
| `mediaItems.search` | Filter by date/album | Used for "On This Day" and album filter modes. |

**Important:** `baseUrl` values expire after approximately 60 minutes. The backend must track expiry and re-fetch before serving to the frontend.

---

## 6. Frontend Spec

### Slideshow View (Default)

```
┌──────────────────────────────────────────────┐
│                                              │
│     ┌──────────────────────────────┐         │
│     │                              │         │
│     │    [PHOTO — cover fit]       │         │
│     │                              │         │
│     │    (Ken Burns: slow zoom)    │         │
│     │                              │         │
│     └──────────────────────────────┘         │
│                                              │
│  [blurred bg fill]              12:34 PM     │ ← clock overlay
│                                 8 Feb 2026   │ ← date overlay
│                                              │
│                          📸 March 2021       │ ← photo date
└──────────────────────────────────────────────┘
```

### Display Rules

| Rule | Implementation |
|---|---|
| Background | Blurred version of current photo (V1) or black (MVP) |
| Photo fit | `object-fit: cover` with slight Ken Burns zoom (V1) |
| Transitions | CSS crossfade via opacity on two alternating `<img>` elements |
| Overlays | `position: absolute`, semi-transparent background, configurable on/off |
| Orientation | Landscape locked. Portrait photos: cover-crop or paired (V2) |
| No browser chrome | PWA meta tags for Add to Home Screen fullscreen |
| No scrollbars | `overflow: hidden` on body |
| No cursor | `cursor: none` on body |

### PWA Meta Tags

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<link rel="apple-touch-icon" href="/okno-icon.png">
```

---

## 7. Configuration Schema

All configuration stored in a `config.json` on the VPS.

```json
{
  "slideshow": {
    "interval_seconds": 30,
    "transition": "crossfade",
    "ken_burns": true,
    "background_mode": "blurred"
  },
  "display": {
    "show_clock": true,
    "show_photo_date": true,
    "show_weather": false,
    "clock_position": "bottom-right",
    "overlay_opacity": 0.7
  },
  "schedule": {
    "sleep_time": "23:00",
    "wake_time": "07:00",
    "dim_start": "21:00",
    "dim_level": 0.5
  },
  "filters": {
    "mode": "all",
    "albums": [],
    "date_range": { "from": null, "to": null },
    "favorites_only": false,
    "exclude_screenshots": true,
    "on_this_day": false,
    "recently_added_days": null
  },
  "weather": {
    "api_key": "",
    "location": "Warsaw,PL",
    "units": "metric"
  }
}
```

---

## 8. Vibe-Coding Build Plan

Step-by-step prompts for Claude Code, Cursor, or similar AI coding tools.

| Step | Task | AI Prompt Approach |
|---|---|---|
| **0** | **Google Cloud Console setup** | Manual. Create project → enable Photos Library API → create OAuth 2.0 credentials → set redirect URI to `https://yourdomain.com/auth/callback` |
| **1** | **Express server + OAuth** | "Build a Node.js Express app with Google OAuth 2.0 for the Photos Library API. Store refresh tokens in a JSON file. Include endpoints for /auth/google and /auth/callback." |
| **2** | **Photo library cache** | "Add a module that paginates through all Google Photos mediaItems on startup and caches them in memory. Include a function to refresh the cache every 6 hours." |
| **3** | **Random photo endpoint** | "Add GET /api/random-photo that picks a random cached item, fetches a fresh baseUrl if expired, and returns {url, date, description}. Append =w2048-h1536 for iPad resolution." |
| **4** | **Fullscreen slideshow** | "Build a minimal fullscreen HTML page that fetches /api/random-photo every 30 seconds. Use two stacked img elements with CSS crossfade transitions. Black background, object-fit cover." |
| **5** | **Prevent sleep + PWA** | "Add Wake Lock API with NoSleep.js fallback. Add Apple mobile web app meta tags for fullscreen PWA." |
| **6** | **Deploy** | "Write an nginx reverse proxy config for this app on port 3000, with Let's Encrypt SSL. Write a PM2 ecosystem config file." |
| **7** | **Ken Burns + blurred bg** | "Add a Ken Burns effect (random slow zoom 1.0→1.15 with random transform-origin). Add blurred background using a second img element behind with filter: blur(30px) and brightness(0.4)." |
| **8** | **Overlays** | "Add a semi-transparent clock/date overlay in bottom-right corner. Add photo date overlay showing the month and year the photo was taken." |
| **9** | **Settings page** | "Build a /settings page with a form to configure slideshow interval, enable/disable overlays, set sleep/wake times, and select albums. Save to config.json." |
| **10** | **"On This Day"** | "Add a mode that filters cached photos to only those taken on today's month+day across all years. Add a toggle in settings and a /api/photo/on-this-day endpoint." |

---

## 9. iPad Setup Instructions

1. On the VPS: deploy the app, set up SSL, run through OAuth to connect Google Photos
2. On the iPad: open Safari → navigate to `https://okno.yourdomain.com`
3. Tap Share → "Add to Home Screen" → this creates a fullscreen PWA
4. Open the PWA from the home screen
5. Go to Settings → Accessibility → Guided Access → ON
6. Open the photo frame app, triple-click Home button → Start Guided Access
7. Set Auto-Lock to "Never" (Settings → Display & Brightness)
8. Plug in iPad to power, place on stand

---

## 10. Technical Considerations

### Google Photos API

| Concern | Solution |
|---|---|
| baseUrl expiry (~60 min) | Backend tracks timestamps, re-fetches before serving. Cache URL alongside fetch time. |
| API quota (10K/day) | Cache aggressively. One full library scan uses ~50–100 calls (pagination). Random photo serving uses cached IDs. |
| Token refresh | Store refresh token in JSON. Use `google-auth-library` auto-refresh. Health endpoint monitors token status. |
| Large libraries (50K+ photos) | Initial cache build may take a few minutes. Start serving photos before cache is complete. Incremental cache refresh. |

### iPad Pro 1st Gen

| Concern | Solution |
|---|---|
| Max iOS 16.x | Safari supports most modern CSS. Test Wake Lock API — if unsupported, use NoSleep.js. |
| Memory limits | Frontend only holds 2 images in DOM at a time. No infinite scroll or gallery. |
| Screen burn-in (IPS LCD) | Not a major concern for LCD. Sleep schedule mitigates further. |
| Battery health (always plugged in) | iOS 16 has optimized charging. Acceptable trade-off for a repurposed device. |

### Reliability

| Concern | Solution |
|---|---|
| App crash | PM2 auto-restarts. Frontend auto-reconnects on fetch failure. |
| Network interruption | Frontend shows last loaded photo. Retries on interval. |
| VPS reboot | PM2 startup script. Cache rebuilds automatically on boot. |
| Google API changes | Unlikely short-term. Fallback: could pivot to Google Drive direct access. |

---

## 11. Success Criteria

- [ ] iPad displays random photos from full Google Photos library
- [ ] No user interaction needed after initial setup
- [ ] Screen stays on indefinitely in Guided Access mode
- [ ] Runs for 7+ days without crashing or token expiry issues
- [ ] Smooth transitions between photos (no flicker, no white flash)
- [ ] Total cost: $0
- [ ] Ala says "oh that's nice" (ultimate acceptance test)

---

## 12. Out of Scope

- Multiple simultaneous devices (single iPad only)
- Photo editing or management
- Social media integration (Instagram, Facebook, etc.)
- Face recognition or AI-based curation
- Native iOS app (web-only)
- Public/multi-user access
- Photo upload to Google Photos (read-only)

---

## 13. Future Ideas (Parking Lot)

- Integration with Spotify to show now-playing alongside photos
- Ambient light sensor integration (if iPad exposes this to web)
- Voice control ("Hey Siri, next photo") via Shortcuts
- Calendar overlay showing today's events
- Photo frame physical mount / 3D printed case for iPad
- Multiple photo sources (iCloud, Dropbox) if Google Photos ever becomes insufficient
