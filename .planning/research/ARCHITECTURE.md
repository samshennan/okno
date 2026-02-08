# Architecture Research

**Domain:** Self-hosted Google Photos digital photo frame (Node.js backend + PWA frontend)
**Researched:** 2026-02-08
**Confidence:** MEDIUM — API landscape verified against official docs; Picker API session lifecycle details partially documented by Google

## Critical Context: Google Photos API Deprecation (March 2025)

Before any architecture discussion, the biggest finding from this research:

**The `photoslibrary.readonly` scope was removed on March 31, 2025.** The original PRD assumption of using the Library API to browse a user's full photo library no longer works. Three replacement APIs exist, each with different trade-offs for a photo frame app:

| API | Purpose | OAuth Flow | Photo Frame Fit | Status |
|-----|---------|------------|-----------------|--------|
| **Picker API** | User selects specific photos/albums | Standard web OAuth 2.0 | Good (with re-selection) | Available now |
| **Ambient API** | Purpose-built for photo frames/ambient displays | TV/Limited-Input Device OAuth | Best fit conceptually | Available, but targets embedded devices |
| **Library API** (remaining) | Access app-uploaded content only | Standard web OAuth 2.0 | Not useful (can't read user's library) | Active but restricted |

**Recommended path for weekend MVP: Picker API.** The user creates a session, selects an album or photos, and the app displays them. Re-selection is needed when the session expires, but this is the simplest path that works with standard web OAuth. The Ambient API is architecturally better for photo frames but uses the TV/Limited-Input OAuth flow (device code grant), which adds complexity and may require a separate Google Cloud project configuration.

**Confidence:** HIGH — verified against [official Google deprecation docs](https://developers.google.com/photos/support/updates) and [authorization scopes page](https://developers.google.com/photos/overview/authorization).

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          iPad (Browser/PWA)                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Fullscreen Slideshow UI                                      │  │
│  │  - Crossfade transitions between photos                       │  │
│  │  - Preloads next image while current displays                 │  │
│  │  - Screen Wake Lock API prevents sleep                        │  │
│  │  - "Pick Photos" button triggers new Picker session           │  │
│  └──────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ HTTPS (fetch API)
                              │
┌─────────────────────────────┼────────────────────────────────────────┐
│                        nginx (reverse proxy + SSL)                   │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────────┐
│                     Node.js / Express Backend                        │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Auth Module  │  │  Photos      │  │  Static File Server      │   │
│  │              │  │  Module      │  │  (serves PWA assets)      │   │
│  │  - OAuth     │  │              │  │                           │   │
│  │    flow      │  │  - Session   │  └──────────────────────────┘   │
│  │  - Token     │  │    mgmt     │                                   │
│  │    refresh   │  │  - Media     │                                   │
│  │  - Token     │  │    item     │                                   │
│  │    storage   │  │    cache    │                                   │
│  └──────┬───────┘  │  - Random   │                                   │
│         │          │    select   │                                   │
│         │          │  - URL      │                                   │
│         │          │    refresh  │                                   │
│         │          └──────┬──────┘                                   │
│         │                 │                                          │
│  ┌──────┴─────────────────┴──────────────────────────────────────┐   │
│  │                    File-based Persistence                      │   │
│  │  tokens.json  │  photo-cache.json  │  config.json              │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Google Photos APIs                                │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐  │
│  │  OAuth 2.0       │  │  Picker API                              │  │
│  │  (accounts.      │  │  - POST /sessions (create picking       │  │
│  │   google.com)    │  │    session, get pickerUri)               │  │
│  │                  │  │  - GET /sessions/{id} (poll status)      │  │
│  │                  │  │  - GET /mediaItems (list selected items) │  │
│  │                  │  │  - DELETE /sessions/{id} (cleanup)       │  │
│  └──────────────────┘  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **PWA Frontend** | Fullscreen slideshow display, image preloading, transitions, sleep prevention, user interaction for photo picking | Vanilla JS + HTML/CSS, `manifest.json`, Service Worker |
| **Auth Module** | OAuth 2.0 authorization code flow, token persistence, automatic refresh | Express routes + `googleapis` npm package (`google-auth-library`) |
| **Photos Module** | Picker session management, media item caching, random selection, baseUrl refresh | Express routes calling Picker API REST endpoints |
| **File Persistence** | Token storage, photo ID cache, configuration | JSON files on disk (no database needed for single-user) |
| **nginx** | SSL termination, reverse proxy, static asset caching headers | Standard nginx config with Let's Encrypt |
| **PM2** | Process management, auto-restart, log rotation | `pm2 start app.js` |

---

## Recommended Project Structure

```
okno/
├── server/
│   ├── app.js              # Express app setup, middleware, routes
│   ├── auth.js             # OAuth 2.0 flow (authorize, callback, refresh)
│   ├── photos.js           # Picker API integration (sessions, media items)
│   ├── config.js           # Environment/config loader
│   └── data/               # Runtime data (gitignored)
│       ├── tokens.json     # OAuth tokens (access + refresh)
│       └── cache.json      # Cached media item IDs + metadata
├── public/                 # Static files served by Express
│   ├── index.html          # Main slideshow page
│   ├── setup.html          # Initial auth + photo picking page
│   ├── css/
│   │   └── style.css       # Slideshow styles, transitions
│   ├── js/
│   │   ├── slideshow.js    # Image cycling, preloading, transitions
│   │   ├── wakeLock.js     # Screen Wake Lock API wrapper
│   │   └── setup.js        # Auth flow UI, picker session UI
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service Worker (cache app shell)
├── .env                    # Google OAuth credentials (gitignored)
├── ecosystem.config.js     # PM2 configuration
├── package.json
└── README.md
```

### Structure Rationale

- **`server/`**: All backend logic in one folder. Flat structure (no nested folders) because there are only 3-4 modules. No need for `controllers/`, `services/`, `models/` separation at this scale.
- **`public/`**: Served statically by Express. Keeps frontend completely decoupled from backend -- the frontend is just HTML/CSS/JS that calls backend API endpoints.
- **`server/data/`**: Runtime state stored as JSON files. Gitignored. Simple to inspect, debug, and reset. No database overhead for a single-user app.
- **`.env`**: Client ID, client secret, redirect URI. Never committed.

---

## Data Flow

### Flow 1: Initial Setup (One-time)

```
User opens https://frame.example.com/setup.html
    │
    ▼
[Frontend] clicks "Sign in with Google"
    │
    ▼
[Backend: GET /auth/google] → redirects to Google OAuth consent screen
    │                          (scope: photospicker.mediaitems.readonly)
    ▼
[Google] → user grants consent → redirects to /auth/google/callback
    │
    ▼
[Backend: GET /auth/google/callback]
    ├── Exchanges authorization code for access_token + refresh_token
    ├── Stores tokens in server/data/tokens.json
    └── Redirects to /setup.html (now authenticated)
    │
    ▼
[Frontend] clicks "Pick Photos" → triggers Picker session
    │
    ▼
[Backend: POST /api/picker/session] → creates Picker API session
    ├── Returns pickerUri to frontend
    └── Stores session ID
    │
    ▼
[Frontend] opens pickerUri (new tab or redirect)
    │
    ▼
[User] selects album/photos in Google Photos UI → closes picker
    │
    ▼
[Backend] polls GET /sessions/{id} until mediaItemsSet === true
    │
    ▼
[Backend: GET /api/picker/media-items]
    ├── Calls Picker API mediaItems.list for the session
    ├── Caches media item IDs + metadata in cache.json
    └── Returns confirmation to frontend
    │
    ▼
[Frontend] redirects to index.html → slideshow begins
```

### Flow 2: Slideshow Display (Continuous loop)

```
[Frontend: slideshow.js] → GET /api/photo/random
    │
    ▼
[Backend: photos.js]
    ├── Selects random media item ID from cache
    ├── Checks if cached baseUrl is fresh (< 60 min old)
    │   ├── YES → returns cached baseUrl with dimensions
    │   └── NO → calls Picker API mediaItems.list to get fresh baseUrls
    │            ├── Updates cache with new baseUrls + timestamp
    │            └── Returns fresh baseUrl with dimensions
    │
    ▼
[Backend] returns JSON: { url: "baseUrl=w1024-h768", width, height }
    │
    ▼
[Frontend]
    ├── Preloads image into hidden <img> element
    ├── On load complete → crossfade transition (CSS opacity)
    ├── Previous image element recycled
    ├── Waits N seconds (configurable interval)
    └── Loops: GET /api/photo/random → repeat
```

### Flow 3: baseUrl Refresh (Every ~55 minutes)

```
[Backend: scheduled or on-demand]
    │
    ▼
Check: has it been > 50 minutes since last baseUrl fetch?
    │
    ├── YES → Call Picker API mediaItems.list with session ID
    │         ├── Get fresh baseUrls for all selected media items
    │         ├── Update cache.json with new baseUrls + timestamp
    │         └── Continue serving fresh URLs to frontend
    │
    └── NO → Continue serving cached baseUrls
```

**Key constraint:** baseUrls expire after 60 minutes. The backend must refresh them proactively (at ~50 min) or reactively (when a frontend request comes in and the cached URL is stale). The backend should never send an expired baseUrl to the frontend.

### Flow 4: Token Refresh (Automatic)

```
[Backend: any API call]
    │
    ▼
Access token expired? (HTTP 401 from Google)
    │
    ├── YES → Use refresh_token to get new access_token
    │         ├── POST to https://oauth2.googleapis.com/token
    │         ├── Update tokens.json with new access_token
    │         └── Retry original API call
    │
    └── NO → Proceed normally
```

**Note:** The `google-auth-library` npm package handles this automatically when configured with credentials that include a refresh token.

---

## State Management

### Where State Lives

| State | Location | Persistence | Lifetime |
|-------|----------|-------------|----------|
| OAuth tokens (access + refresh) | `server/data/tokens.json` | File on disk | Refresh token: indefinite (until revoked). Access token: ~1 hour |
| Media item IDs + metadata | `server/data/cache.json` | File on disk | Until user picks new photos |
| Cached baseUrls | `server/data/cache.json` (with timestamps) | File on disk | 60 minutes (must be refreshed) |
| Picker session ID | `server/data/cache.json` | File on disk | Until session expires (duration not documented; needs testing) |
| Slideshow position (current photo) | Frontend JS (in-memory) | None (lost on refresh) | Browser session |
| Wake Lock state | Frontend JS (in-memory) | None | Browser session |
| App shell (HTML/CSS/JS) | Service Worker cache | Browser storage | Until SW updates |

### tokens.json Structure

```json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//0d...",
  "token_type": "Bearer",
  "expiry_date": 1707400000000,
  "scope": "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
}
```

### cache.json Structure

```json
{
  "sessionId": "picker-session-abc123",
  "lastFetched": "2026-02-08T10:30:00Z",
  "baseUrlsRefreshedAt": "2026-02-08T11:15:00Z",
  "items": [
    {
      "id": "media-item-id-1",
      "baseUrl": "https://lh3.googleusercontent.com/...",
      "mimeType": "image/jpeg",
      "width": 4032,
      "height": 3024
    }
  ]
}
```

### Why File-Based (Not Database)

For a single-user photo frame:
- Zero infrastructure overhead (no SQLite, no Postgres)
- Human-readable for debugging (open the JSON, see your tokens)
- Atomic writes with `fs.writeFile` + temp file rename pattern
- Easy to reset (delete the file, re-authenticate)
- No migration headaches

If this ever needed multi-user support, migrate to SQLite (still file-based, but with concurrent access safety).

---

## Architectural Patterns

### Pattern 1: Backend as Photo Proxy

**What:** The frontend never talks to Google APIs directly. All Google API calls go through the backend. The frontend only requests `/api/photo/random` and gets back a URL it can display.

**When to use:** Always, for this type of app.

**Trade-offs:**
- PRO: Tokens never touch the frontend (security)
- PRO: Backend can cache, rate-limit, and handle errors before they reach the UI
- PRO: Frontend stays simple (just display images)
- CON: Backend is a single point of failure
- CON: Slightly higher latency (extra hop)

**Example:**
```javascript
// Backend: GET /api/photo/random
app.get('/api/photo/random', async (req, res) => {
  const item = selectRandomItem(cache.items);
  const url = await getFreshBaseUrl(item);
  res.json({
    url: `${url}=w${req.query.w || 1024}-h${req.query.h || 768}`,
    width: item.width,
    height: item.height
  });
});
```

### Pattern 2: Proactive baseUrl Refresh

**What:** Instead of waiting for a frontend request to discover an expired URL, the backend refreshes all baseUrls on a timer (~every 50 minutes).

**When to use:** When the app runs continuously (photo frame).

**Trade-offs:**
- PRO: Frontend never sees a stale URL
- PRO: No latency spike when URLs expire
- CON: Makes API calls even if no one is watching
- CON: Burns quota when display is off

**Example:**
```javascript
// Refresh baseUrls every 50 minutes
setInterval(async () => {
  try {
    const freshItems = await pickerApi.listMediaItems(cache.sessionId);
    cache.items = freshItems;
    cache.baseUrlsRefreshedAt = new Date().toISOString();
    await saveCache(cache);
  } catch (err) {
    console.error('baseUrl refresh failed:', err.message);
    // Will retry on next interval or next frontend request
  }
}, 50 * 60 * 1000);
```

### Pattern 3: Two-Image Crossfade

**What:** Maintain two `<img>` elements. One visible (current), one hidden (preloading next). When next is loaded, crossfade via CSS opacity transition, then swap roles.

**When to use:** Any slideshow with smooth transitions.

**Trade-offs:**
- PRO: Smooth visual experience
- PRO: No flash of white/empty between photos
- PRO: Works with CSS transitions (no JS animation library needed)
- CON: Two images in memory simultaneously
- CON: Must handle load errors for the hidden image

**Example:**
```javascript
const images = [document.getElementById('img-a'), document.getElementById('img-b')];
let current = 0;

async function showNext() {
  const next = 1 - current;
  const data = await fetch('/api/photo/random').then(r => r.json());

  images[next].src = data.url;
  await new Promise(resolve => {
    images[next].onload = resolve;
    images[next].onerror = resolve; // Don't hang on error
  });

  images[next].classList.add('visible');
  images[current].classList.remove('visible');
  current = next;
}
```

```css
.slideshow img {
  position: absolute;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  object-fit: contain;
  opacity: 0;
  transition: opacity 1.5s ease-in-out;
}
.slideshow img.visible {
  opacity: 1;
}
```

---

## Anti-Patterns

### Anti-Pattern 1: Storing baseUrls Long-Term

**What people do:** Cache the full baseUrl and serve it for hours/days.
**Why it's wrong:** baseUrls expire after 60 minutes. The frontend will get broken image links.
**Do this instead:** Store media item IDs permanently. Fetch fresh baseUrls from the Picker API every <60 minutes. Serve only fresh URLs to the frontend.

### Anti-Pattern 2: Frontend Calling Google APIs Directly

**What people do:** Put OAuth tokens in the frontend and call Google APIs from JavaScript.
**Why it's wrong:** Tokens are exposed to the browser. Refresh tokens in client-side code are a security risk. Also, CORS restrictions make direct API calls from the browser unreliable.
**Do this instead:** All Google API calls go through the backend. The frontend calls your backend endpoints only.

### Anti-Pattern 3: Using the Deprecated Library API Scopes

**What people do:** Copy code from pre-2025 tutorials using `photoslibrary.readonly` scope.
**Why it's wrong:** This scope was removed March 31, 2025. API calls return 403 PERMISSION_DENIED.
**Do this instead:** Use the Picker API with `photospicker.mediaitems.readonly` scope. Accept the trade-off that users must explicitly select photos.

### Anti-Pattern 4: Synchronized API Polling

**What people do:** Set `setInterval` to refresh at exactly the top of the hour or on round numbers.
**Why it's wrong:** Google explicitly warns this looks like DDoS. If multiple clients sync, you get rate-limited.
**Do this instead:** Add jitter. Refresh at 50 min + random(0-5 min). For single-user this barely matters, but it's good practice.

### Anti-Pattern 5: No Image Error Handling in Slideshow

**What people do:** Set `img.src = url` and hope for the best.
**Why it's wrong:** Network blips, expired URLs, or API errors will show a broken image icon indefinitely.
**Do this instead:** Handle `onerror` on every image load. On failure, retry with a new random photo. Keep the current photo displayed until the next one successfully loads.

---

## Integration Points

### External Services

| Service | Integration Pattern | Gotchas |
|---------|---------------------|---------|
| Google OAuth 2.0 | Authorization code flow via `google-auth-library` | Refresh tokens can be revoked; handle gracefully. Must use HTTPS redirect URIs in production. |
| Google Photos Picker API | REST calls from backend (`https://photospicker.googleapis.com/v1/`) | Sessions are single-use for selection. baseUrls expire in 60 min. Session expiry duration not well-documented. |
| Let's Encrypt / SSL | Certbot with nginx plugin | Auto-renewal via cron. Required -- Google APIs reject HTTP. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend <-> Backend | JSON over HTTPS (`fetch` API) | Simple REST: `GET /api/photo/random`, `POST /api/picker/session`, `GET /api/status` |
| Backend <-> File Storage | `fs.readFile` / `fs.writeFile` | Use atomic writes (write to temp, rename) to prevent corruption |
| Backend <-> Google APIs | HTTPS REST calls via `google-auth-library` | All calls authenticated with Bearer token |

### Backend API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/google` | GET | Initiates OAuth flow (redirects to Google) |
| `/auth/google/callback` | GET | Handles OAuth callback, stores tokens |
| `/api/status` | GET | Returns auth status, photo count, last refresh time |
| `/api/picker/session` | POST | Creates new Picker session, returns pickerUri |
| `/api/picker/complete` | POST | Polls session, fetches + caches media items |
| `/api/photo/random` | GET | Returns random photo URL (fresh baseUrl) |
| `/*` (static) | GET | Serves PWA files from `public/` |

---

## Build Order (Dependency Chain)

The components must be built in this order because each depends on the previous:

```
Phase 1: Backend Foundation
  ├── 1a. Express server + static file serving
  ├── 1b. OAuth 2.0 flow (authorize, callback, token storage)
  └── 1c. Token refresh logic
         │
Phase 2: Google Photos Integration
  ├── 2a. Picker session creation + polling
  ├── 2b. Media item fetching + caching
  └── 2c. baseUrl refresh timer
         │
Phase 3: Frontend Core
  ├── 3a. Basic slideshow (display one photo, then next)
  ├── 3b. Crossfade transitions + preloading
  └── 3c. Setup page (auth + picker flow UI)
         │
Phase 4: PWA + Polish
  ├── 4a. PWA manifest + Service Worker
  ├── 4b. Screen Wake Lock
  ├── 4c. Error handling + reconnection
  └── 4d. Guided Access setup (iPad config, not code)
         │
Phase 5: Infrastructure
  ├── 5a. VPS setup + nginx + SSL
  ├── 5b. PM2 process management
  └── 5c. DNS configuration
```

**Key dependency:** You cannot test photos without OAuth (Phase 1 before Phase 2). You cannot test the frontend slideshow without the backend photo endpoint (Phase 2 before Phase 3). Infrastructure (Phase 5) can actually be done in parallel with Phase 3/4 if you test locally first.

**Weekend MVP shortcut:** Do Phase 1 + 2 + 3a locally (localhost), then deploy Phase 5, then add Phase 3b/3c/4 as polish.

---

## Failure Modes and Recovery

| Failure | Detection | Impact | Recovery |
|---------|-----------|--------|----------|
| **baseUrl expired** (60 min) | HTTP 403 when frontend loads image, or backend timestamp check | Broken image in slideshow | Backend refreshes baseUrls via Picker API `mediaItems.list` before serving |
| **Access token expired** (~1 hr) | HTTP 401 from Google API | API calls fail | `google-auth-library` auto-refreshes using refresh_token. If refresh fails, show "re-authenticate" prompt |
| **Refresh token revoked** | HTTP 400 `invalid_grant` from token refresh | All API access lost | Redirect user to re-authenticate. Clear stored tokens |
| **Picker session expired** | `mediaItems.list` returns error for session ID | Cannot refresh baseUrls | Prompt user to create new Picker session (re-select photos) |
| **API rate limit** (429) | HTTP 429 from Google | Temporary API blackout | Exponential backoff with 30-second minimum delay (per Google best practices) |
| **Server error** (5xx from Google) | HTTP 5xx | Temporary API outage | Retry with exponential backoff, 1-second minimum delay |
| **Network loss** (iPad offline) | `fetch` throws `TypeError` / `navigator.onLine` check | Slideshow stalls | Keep displaying current photo. Retry with backoff. Show subtle offline indicator |
| **PM2 process crash** | PM2 detects exit | App down briefly | PM2 auto-restarts. Tokens/cache persist on disk (no data loss) |
| **tokens.json corrupted** | JSON parse error on startup | Cannot authenticate | Delete file, prompt re-auth. Use atomic writes to prevent corruption |
| **iPad sleep despite Wake Lock** | User observes blank screen | Slideshow stops | Guided Access "Display Auto-Lock: Never" as hardware backup. Wake Lock API as software layer |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **1 user, 1 display (target)** | Current architecture. File-based storage. Single Express process. No database. |
| **1 user, multiple displays** | Works as-is. Multiple iPads hit the same backend. Same photos, same cache. |
| **Multiple users** | Need per-user token storage (SQLite or Postgres). Need session/auth middleware. Add user ID to all API routes. |
| **High availability** | Move tokens/cache to Redis or database. Run multiple Express instances behind load balancer. Not needed for a photo frame. |

### Scaling Priorities

1. **First bottleneck (won't hit for photo frame):** Google API quota. Default quota is generous for single-user. Picker API calls are infrequent (once per session + baseUrl refresh every 50 min).
2. **Second bottleneck:** File I/O contention if multiple processes write to same JSON. Solved by SQLite if ever needed.

---

## Weekend MVP Simplifications

Things to defer to keep the first build simple:

| Full Version | MVP Simplification | Why OK for Weekend |
|-------------|--------------------|--------------------|
| Proactive baseUrl refresh timer | Refresh on-demand when frontend requests a photo and cached URL is stale | Simpler. Slight latency spike every 60 min is acceptable |
| Service Worker with offline cache | No Service Worker. PWA manifest only (for fullscreen + home screen icon) | Offline support not needed -- the frame needs internet for photos anyway |
| Crossfade transitions | Hard cut between photos (swap `img.src`) | Polish. Add CSS transitions after core works |
| Error recovery UI | `console.error` + retry silently | Polish. The frame is unattended |
| Config UI (interval, transition speed) | Hardcoded values in JS | Can tweak in code. UI is unnecessary for single user |
| Multi-album support | Single Picker session, all selected photos in one pool | Simplifies caching and random selection |
| Photo deduplication / history | Fully random (may repeat) | Random with repeats is fine for MVP |

---

## Alternative Architecture: Ambient API Path

If the Picker API's session-based model proves too limiting (e.g., sessions expire quickly and require frequent re-selection), the Ambient API is the purpose-built alternative:

**Ambient API Architecture Differences:**
- Uses TV/Limited-Input Device OAuth (device code grant: show code on screen, user enters at google.com/device)
- Registers the frame as an "ambient device" in the user's Google Photos account
- User configures which albums/sources to display via Google Photos app settings
- Backend polls for media items using device-specific endpoint
- `pollingConfig` from API tells you how often to poll

**When to switch to Ambient API:**
- If Picker sessions expire too quickly for continuous display
- If you want the user to manage photo selection entirely from the Google Photos app (no web UI needed)
- If you're comfortable with the device code OAuth flow

**Confidence:** LOW for Ambient API details -- the API documentation is sparse and appears to target hardware partners rather than hobbyist developers. The scope `photosambient.mediaitems` may require additional Google Cloud project approval.

---

## Sources

### HIGH Confidence (Official Documentation)
- [Google Photos API Updates / Deprecation](https://developers.google.com/photos/support/updates) -- scope removal timeline and migration guidance
- [Authorization Scopes](https://developers.google.com/photos/overview/authorization) -- current valid scopes for all Google Photos APIs
- [Picker API: Get Started](https://developers.google.com/photos/picker/guides/get-started-picker) -- session flow, architecture
- [Picker API: Sessions](https://developers.google.com/photos/picker/guides/sessions) -- session lifecycle, polling
- [Picker API: Media Items](https://developers.google.com/photos/picker/guides/media-items) -- baseUrl usage, 60-min expiry, URL parameters
- [Legacy Library API: Access Media Items](https://developers.google.com/photos/library/legacy/guides/access-media-items) -- baseUrl construction (`=w{width}-h{height}`)
- [Best Practices](https://developers.google.com/photos/overview/best-practices) -- rate limits, retry logic, caching guidance
- [Ambient API: About](https://developers.google.com/photos/ambient/guides/about) -- purpose, target devices
- [Ambient API: Configure](https://developers.google.com/photos/ambient/guides/configure-your-app) -- OAuth setup, scopes
- [Ambient API: Devices REST Resource](https://developers.google.com/photos/ambient/reference/rest/v1/devices) -- device lifecycle, pollingConfig
- [Screen Wake Lock API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) -- browser support, usage
- [Can I Use: Wake Lock](https://caniuse.com/wake-lock) -- Safari 16.4+, fixed in installed PWAs as of iOS 18.4

### MEDIUM Confidence (Verified Community Sources)
- [Google Official PhotoFrame Sample](https://github.com/googlesamples/google-photos/tree/main/REST/PhotoFrame) -- Express.js architecture reference (uses deprecated scopes, but structure is instructive)
- [PWA Kiosk Mode on iPad](https://timmyomahony.com/blog/kiosk-mode-on-ipads-with-pwa/) -- Guided Access setup for photo frame use case
- [Google OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server) -- token refresh flow

### LOW Confidence (Needs Validation During Implementation)
- Picker API session `expireTime` duration -- not documented; must test empirically
- Whether `mediaItems.list` can be called repeatedly on the same session to refresh baseUrls -- implied by docs but not explicit
- Ambient API accessibility for hobbyist projects -- may require partner program enrollment
- Wake Lock behavior in installed PWA on iPad with Guided Access -- reported fixed in iOS 18.4 but should verify on target device

---
*Architecture research for: Self-hosted Google Photos digital photo frame*
*Researched: 2026-02-08*
