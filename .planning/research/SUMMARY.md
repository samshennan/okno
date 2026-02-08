# Project Research Summary

**Project:** Okno
**Domain:** Self-hosted Google Photos digital photo frame (Node.js + vanilla JS PWA)
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

Okno is a self-hosted digital photo frame app that displays photos from Google Photos on an iPad. This is a well-understood domain with clear table stakes (random slideshow, fullscreen display, screen wake prevention, smooth transitions) and established patterns. However, **a critical API change in March 2025 fundamentally reshapes the architecture**: Google deprecated the `photoslibrary.readonly` scope, eliminating the ability to programmatically browse a user's entire photo library. The replacement Picker API requires explicit user selection of photos via Google's UI — a session-based workflow rather than background syncing.

The recommended approach is a Node.js/Express backend using the Picker API with `photospicker.mediaitems.readonly` scope, serving a vanilla JavaScript PWA frontend. The backend handles OAuth, manages Picker sessions, caches media item IDs (not baseUrls, which expire in 60 minutes), and serves fresh photo URLs to the frontend. The iPad runs the PWA in fullscreen mode using iOS Guided Access as a kiosk. NoSleep.js (hidden video loop) is the primary screen wake strategy because the Wake Lock API is broken in iOS 16.x PWAs — the target iPad Pro 1st Gen maxes out at iOS 16.x and will never get the fix (released in iOS 18.4).

Key risks center on API scope deprecation (already mitigated by using Picker API), baseUrl expiry (mitigated by server-side refresh every 50 minutes), and OAuth token management (mitigated by setting consent screen to "In Production" mode to avoid 7-day token expiry). The architecture is straightforward: this is a Node.js API server with file-based persistence (JSON for tokens/cache), nginx for SSL termination, and PM2 for process management. A weekend MVP is achievable: OAuth + Picker session + random photo endpoint + fullscreen slideshow with crossfade. V1 polish adds Ken Burns effect, blurred backgrounds, and date overlays — high visual impact for minimal effort.

## Key Findings

### Recommended Stack

**Critical finding:** Google removed `photoslibrary.readonly` scope on April 1, 2025. The Picker API is now the only way to access user photos. This changes the entire architecture from "fetch all photos in background" to "user explicitly selects photos via Google's picker UI."

**Core technologies:**
- **Node.js 22.x LTS** (runtime) — Active LTS through April 2027, required by Express 5.x, native `--env-file` support eliminates dotenv dependency
- **Express 5.x** (web framework) — Now default on npm since March 2025, improved async error handling and security
- **google-auth-library 10.x** (OAuth) — Official Google auth library, handles token refresh automatically
- **Google Photos Picker API** (`photospicker.googleapis.com/v1/`) — Replacement for deprecated Library API, session-based photo selection
- **nginx + Let's Encrypt** (reverse proxy + SSL) — Standard production pattern, required for OAuth redirect URIs
- **PM2** (process manager) — Auto-restart on crash, startup persistence
- **NoSleep.js 0.12.0** (screen wake) — Primary strategy for iOS 16.x PWAs where Wake Lock API is broken

**Critical constraint:** BaseUrls from Google Photos expire after 60 minutes. Must refresh server-side before serving to frontend.

**Confidence:** HIGH — all versions verified against official documentation and npm registry (Feb 2026). Picker API migration path verified against Google's official deprecation announcements.

### Expected Features

**Must have (table stakes):**
- Google OAuth + token persistence — Without this, nothing works
- Picker session creation + media item caching — New session-based workflow replaces old library listing
- Random photo endpoint with fresh baseUrl — Core value: serendipitous rediscovery of memories
- Fullscreen slideshow with crossfade transitions — Every commercial frame has smooth transitions
- Preload next image — Eliminates white flash between photos
- Prevent screen sleep — NoSleep.js as primary strategy (Wake Lock broken on iOS 16.x PWAs)
- PWA manifest + Apple meta tags — Fullscreen mode, no browser chrome
- Configurable interval — Users have strong preferences (10s feels rushed, 60s feels slow)
- Error resilience — Network blips must not kill the slideshow

**Should have (competitive advantage):**
- **Ken Burns effect** — Cinematic slow zoom/pan, highest wow-per-hour feature (pure CSS, 1 hour to add)
- **Blurred background fill** — Instead of black bars, show blurred/dimmed version of same photo (matches Aura premium frames)
- **Photo date overlay** — "March 2021" creates nostalgia, unique to self-hosted
- **"On This Day" mode** — Mimics Google Photos Memories, emotionally powerful differentiator
- **Portrait pair mode** — Display two consecutive portrait photos side-by-side (matches Aura's $200+ flagship feature)

**Defer (v2+):**
- Weather widget — Nice but not core to photo frame identity
- Short video playback — More complex than expected, iOS autoplay restrictions
- Exclude screenshots — Heuristic-based, fragile, lots of edge cases
- Album filtering — Needs settings UI, defer until V1 polish

**Anti-features (deliberately not building):**
- Multi-user auth — Massively increases scope, kills weekend MVP
- Face recognition / AI curation — Requires ML infrastructure, Google Photos already does this
- Real-time sync — Google Photos has no push API, wastes quota
- Native iOS app — Zero benefit over PWA + Guided Access

### Architecture Approach

The architecture is a backend-as-photo-proxy pattern: the frontend never talks to Google APIs directly. All Google API calls go through the Node.js/Express backend, which manages OAuth tokens, Picker sessions, and baseUrl refresh cycles. The frontend is a thin display layer that requests `/api/photo/random` and displays the returned image URL.

**Major components:**
1. **Auth Module (Express routes + google-auth-library)** — OAuth 2.0 authorization code flow, token persistence to JSON file, automatic refresh on expiry
2. **Photos Module (Express routes + Picker API REST calls)** — Session creation/polling, media item caching (IDs + metadata), random selection, baseUrl refresh every 50 minutes
3. **File Persistence (JSON files)** — `tokens.json` for OAuth tokens, `cache.json` for media item IDs/metadata. No database needed for single-user app
4. **PWA Frontend (vanilla HTML/CSS/JS)** — Fullscreen slideshow with two-image crossfade pattern, NoSleep.js for screen wake, preloading next image
5. **Infrastructure (nginx + PM2)** — SSL termination with Let's Encrypt, process management with auto-restart on crash and boot persistence

**Data flow:** User creates Picker session → selects photos via Google's UI → backend caches media item IDs → slideshow requests `/api/photo/random` → backend returns fresh baseUrl (from 50-min cache or newly fetched) → frontend displays with crossfade transition.

**Key pattern:** Store media item IDs permanently (they never expire), but refresh baseUrls every 50 minutes (they expire in 60 minutes). Never store or persist baseUrls.

### Critical Pitfalls

1. **Using the Deprecated Library API** — The `photoslibrary.readonly` scope was removed April 1, 2025. API calls return `403 PERMISSION_DENIED`. Must use Picker API with `photospicker.mediaitems.readonly` scope. This is a project-killing mistake if not caught during setup.

2. **Storing baseUrls Instead of Media Item IDs** — BaseUrls expire after 60 minutes. Caching them long-term causes broken images. Must store only media item IDs, fetch fresh baseUrls on-demand, cache for max 50 minutes.

3. **OAuth Testing Mode (7-Day Token Expiry)** — When OAuth consent screen is in "Testing" status, refresh tokens expire after exactly 7 days. Frame works perfectly for a week, then silently stops. Must set consent screen to "In Production" immediately.

4. **Picker API Requires User Interaction** — Unlike the old Library API, Picker requires the user to actively select photos via Google's UI. No background syncing. The UX must be designed around explicit photo selection sessions, not "connect once, auto-update forever."

5. **Wake Lock API Broken in iOS PWAs (pre-18.4)** — Wake Lock works in Safari browser but is broken in installed PWAs on iOS 16.x and 17.x. WebKit bug fixed only in iOS 18.4, which the iPad Pro 1st Gen can never run. NoSleep.js (hidden video loop) is the primary strategy, not a fallback.

6. **JavaScript Memory Leaks in Long-Running Slideshow** — Unreleased Blob URLs, detached DOM nodes, and accumulated event listeners cause crashes after 24-48 hours. Must use A/B image swap pattern (two `<img>` elements, swap visibility), revoke Blob URLs, and clear references.

7. **iOS Safari Evicts PWA Storage After Inactivity** — iOS can clear PWA storage (localStorage, IndexedDB) if unused for weeks. Tokens must be stored server-side, not client-side.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Backend Foundation (OAuth + Picker API Integration)
**Rationale:** Everything depends on authenticated access to Google Photos. The Picker API session workflow is fundamentally different from the old Library API and must be implemented correctly from day one. This is the critical path.

**Delivers:** Working OAuth flow with token persistence, Picker session creation/polling, media item caching, health check endpoint.

**Addresses:** Pitfall #1 (deprecated Library API), Pitfall #3 (OAuth testing mode), Pitfall #4 (Picker API user interaction pattern).

**Research flag:** Standard patterns, well-documented by Google. Skip phase research.

### Phase 2: Photo Serving + BaseUrl Management
**Rationale:** Must be built after authentication exists but before frontend, since the frontend depends on this endpoint. BaseUrl refresh logic is critical — get this wrong and photos break after 60 minutes.

**Delivers:** `/api/photo/random` endpoint that returns fresh baseUrls, server-side cache with 50-min TTL, random selection from cached media items.

**Addresses:** Pitfall #2 (baseUrl expiry).

**Research flag:** Standard caching patterns. Skip phase research.

### Phase 3: Frontend Core (Slideshow Display)
**Rationale:** Once the backend can serve photos, build the display layer. Two-image crossfade pattern prevents most memory leaks and enables preloading.

**Delivers:** Fullscreen slideshow page, two-image A/B swap with CSS crossfade transitions, preload next image, configurable interval.

**Addresses:** Pitfall #6 (memory leaks via two-image pattern).

**Research flag:** Standard DOM manipulation patterns. Skip phase research.

### Phase 4: PWA + Screen Wake
**Rationale:** PWA configuration and screen wake are tightly coupled on iOS. NoSleep.js must be the primary strategy because Wake Lock is broken on the target device.

**Delivers:** PWA manifest, Apple meta tags, NoSleep.js integration (recreate instance before each enable for iOS PWA reliability), re-enable on `visibilitychange`.

**Addresses:** Pitfall #5 (Wake Lock broken on iOS 16.x PWAs).

**Research flag:** iOS PWA limitations are well-documented. Skip phase research.

### Phase 5: Deployment + Infrastructure
**Rationale:** Can be done in parallel with Phase 3/4 using localhost for testing. OAuth requires HTTPS in production, so SSL setup is required before final testing.

**Delivers:** nginx reverse proxy with SSL (Let's Encrypt), PM2 process management with startup persistence, DNS configuration.

**Addresses:** Deployment pitfalls (PM2 auto-restart, nginx WebSocket headers, SSL auto-renewal).

**Research flag:** Standard Node.js deployment patterns. Skip phase research.

### Phase 6: V1 Polish (High-Impact Visual Features)
**Rationale:** After core slideshow is working reliably for 7+ days. These features have high visual impact for minimal implementation effort — great portfolio value.

**Delivers:** Ken Burns effect (CSS transform with random origin), blurred background fill (CSS filter blur + brightness), photo date overlay, clock overlay, sleep/wake schedule.

**Addresses:** Competitive differentiation. These features match premium commercial frames.

**Research flag:** Pure CSS/simple JS patterns. Skip phase research.

### Phase 7: Advanced Features (V2)
**Rationale:** Defer until V1 is polished and stable. These are nice-to-haves, not essential.

**Delivers:** Portrait pair mode, "On This Day" mode, settings page, album filtering.

**Research flag:** Needs deeper investigation during planning — portrait detection logic, date filtering heuristics, settings persistence patterns.

### Phase Ordering Rationale

- **Phases 1-2 are the critical dependency chain:** No photos without OAuth, no photos without baseUrl refresh. This must be sequential.
- **Phase 3 depends on Phase 2:** Frontend needs the photo-serving endpoint.
- **Phase 4 can overlap with Phase 3:** PWA configuration and slideshow implementation are loosely coupled.
- **Phase 5 can overlap with Phase 3/4:** Deploy infrastructure while developing frontend locally, then push code to VPS.
- **Phases 6-7 are purely additive:** No dependencies between polish features. Can be added in any order.

**Avoids pitfalls by design:**
- Phase 1 forces correct API choice (Picker, not Library) before any implementation
- Phase 2 forces baseUrl refresh logic before frontend caching
- Phase 3 forces two-image pattern to prevent memory leaks
- Phase 4 forces NoSleep.js as primary strategy (not Wake Lock)
- Phase 5 forces OAuth consent screen to "In Production" and PM2 startup config

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** OAuth + Picker API well-documented by Google
- **Phase 2:** Server-side caching is standard Node.js pattern
- **Phase 3:** DOM manipulation and CSS transitions are well-established
- **Phase 4:** iOS PWA limitations and NoSleep.js are well-documented
- **Phase 5:** Node.js deployment with nginx + PM2 has abundant tutorials

**Phases needing deeper research during planning:**
- **Phase 7 (Portrait pair mode):** Needs investigation of portrait detection heuristics, aspect ratio matching, CSS Grid/Flexbox layout for side-by-side display
- **Phase 7 ("On This Day" mode):** Needs investigation of date filtering logic, handling timezone differences in metadata, UI for toggling mode on/off

**Overall:** This project is in a well-understood domain with established patterns. Most phases can proceed without additional research. Only advanced V2 features need phase-specific research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm and official Google documentation. Picker API migration path confirmed via Google's deprecation announcements (Feb 2026). |
| Features | HIGH | Domain well-understood, competitors well-documented, PRD already strong. Table stakes are clear from commercial frame analysis. |
| Architecture | MEDIUM | Standard patterns verified, but Picker API session lifecycle details (exact expiry duration, re-selection workflow) partially documented. Need empirical testing. |
| Pitfalls | HIGH | Critical pitfalls (deprecated API, baseUrl expiry, OAuth testing mode, Wake Lock on iOS) verified against official documentation, WebKit bug tracker, and Google Issue Tracker. |

**Overall confidence:** HIGH

### Gaps to Address

**Picker API session expiry duration:** Google's documentation doesn't specify exact session expiry time. The `expireTime` field exists in the session response but duration isn't documented. This affects how often users need to re-select photos. **Mitigation:** Design the UX assuming sessions are short-lived (hours to days, not weeks), with a clear "refresh selection" flow.

**NoSleep.js reliability in iOS 16.x PWA mode:** The library is old (v0.12.0, Dec 2020) and community reports suggest intermittent failures in PWA mode. The recommended workaround (recreate instance before each `enable()` call) is based on GitHub issues, not official documentation. **Mitigation:** Test on actual iPad Pro 1st Gen running iOS 16.x during Phase 4. Have fallback: iPad Settings > Display & Brightness > Auto-Lock > Never as hardware-level backup.

**Picker API album selection:** Documentation unclear on whether users can select an "entire album" or must pick photos individually. This affects initial setup UX (one-click album selection vs manual photo picking). **Mitigation:** Test during Phase 1 implementation. If individual selection only, design a clear UX around "this is a one-time setup, pick your favorite photos."

**Cache schema for V2 features:** "On This Day" and Portrait Pair modes need `creationTime` and `width/height` metadata stored in cache. The PRD's cache schema doesn't specify this. **Mitigation:** Design cache schema with these fields from day one (Phase 2), even if features are deferred. Costs nothing during initial fetch, avoids cache schema migration later.

## Sources

### Primary (HIGH confidence)
- [Google Photos API Updates (official)](https://developers.google.com/photos/support/updates) — Scope removal timeline, Picker API migration guidance
- [Google Photos Authorization Scopes (official)](https://developers.google.com/photos/overview/authorization) — Current valid scopes for all APIs
- [Picker API: Getting Started (official)](https://developers.google.com/photos/picker/guides/get-started-picker) — Session flow, architecture, pickerUri workflow
- [Picker API: Sessions (official)](https://developers.google.com/photos/picker/guides/sessions) — Session lifecycle, polling, expireTime field
- [Picker API: Media Items (official)](https://developers.google.com/photos/picker/guides/media-items) — BaseUrl usage, 60-min expiry, size parameters
- [Google Photos Best Practices (official)](https://developers.google.com/photos/overview/best-practices) — Rate limits, retry logic, caching guidance
- [Google Photos API Limits and Quotas (official)](https://developers.google.com/photos/overview/api-limits-quotas) — 10K requests/day, quota management
- [Google OAuth 2.0 (official)](https://developers.google.com/identity/protocols/oauth2) — Authorization code flow, token refresh, access_type and prompt parameters
- [WebKit Bug #254545 (official)](https://bugs.webkit.org/show_bug.cgi?id=254545) — Wake Lock broken in PWAs, fixed iOS 18.4
- [Node.js Releases (official)](https://nodejs.org/en/about/previous-releases) — Node 22 LTS through April 2027
- [Express 5.1.0 Release (official)](https://expressjs.com/2025/03/31/v5-1-latest-release.html) — Express 5 now default on npm

### Secondary (MEDIUM confidence)
- [google-auth-library npm](https://www.npmjs.com/package/google-auth-library) — v10.5.0, auto token refresh
- [NoSleep.js GitHub](https://github.com/richtr/NoSleep.js) — v0.12.0, video hack mechanism
- [firt.dev iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/) — Comprehensive iOS PWA feature matrix
- [Aura Frames Portrait Pairing](https://help.auraframes.com/hc/en-us/articles/360051589374) — Intelligent Pairing feature documentation
- [memoryKPR: Google Photos API Deprecation](https://memorykpr.com/blog/google-photos-api-deprecation-what-it-means-for-third-party-apps-and-how-to-prepare/) — Third-party impact analysis
- [Brainhub: PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios) — iOS PWA limitations and workarounds
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) — iOS storage eviction policies
- [Nango: Google OAuth invalid_grant](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked) — OAuth testing mode 7-day expiry

### Tertiary (LOW confidence)
- NoSleep.js reliability in iOS 16 PWA mode — Multiple GitHub issues report intermittent failures; recreating instance before each enable() is community-reported workaround, needs validation
- Picker API session expiry exact duration — Not documented by Google; needs empirical testing
- Whether Picker API allows "entire album" selection vs individual photos — Documentation unclear; needs testing

---
*Research completed: 2026-02-08*
*Ready for roadmap: yes*
