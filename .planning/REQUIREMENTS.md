# Requirements

**Project:** Okno
**Version:** v1.0
**Timeline:** Two-phase (Weekend MVP + Polish Week)
**Last Updated:** 2026-02-08

---

## v1 Requirements

### Phase 1 Target: Weekend MVP (Core Slideshow)
### Phase 2 Target: Polish Week (Advanced Features)

---

### Authentication & Photo Access (AUTH)

- [ ] **AUTH-01**: User can authenticate with Google Photos via OAuth 2.0 (authorization code flow) and tokens persist across server restarts in `tokens.json`
- [ ] **AUTH-02**: User can select photos via Google Picker UI (Picker API with `photospicker.mediaitems.readonly` scope) and selected photos appear in slideshow
- [ ] **AUTH-03**: Backend caches selected media item IDs + metadata (creationTime, width, height) in `cache.json` for random selection and filtering
- [ ] **AUTH-04**: Backend automatically refreshes baseUrls every 50 minutes (before 60-min expiry) to prevent broken images

**Traceability:**
- AUTH-01 -> Phase 1: Backend + Deployment
- AUTH-02 -> Phase 1: Backend + Deployment
- AUTH-03 -> Phase 1: Backend + Deployment
- AUTH-04 -> Phase 1: Backend + Deployment

---

### Slideshow Display (DISP)

- [ ] **DISP-01**: iPad displays fullscreen slideshow with black background, photos in cover-fit mode, no browser chrome visible
- [ ] **DISP-02**: Photos crossfade smoothly between transitions (1-2s CSS opacity animation, no jarring swaps)
- [ ] **DISP-03**: Next photo preloads while current photo displays (seamless transitions, no white flash or loading delay)
- [ ] **DISP-04**: Slideshow interval is configurable via URL parameter (`?interval=30` for 30 seconds between photos)
- [ ] **DISP-05**: Backend serves random photos from cache each interval (serendipitous rediscovery of memories)
- [ ] **DISP-06**: Frontend uses two-image A/B swap pattern (alternating `<img>` elements) to prevent JavaScript memory leaks in long-running slideshow

**Traceability:**
- DISP-01 -> Phase 2: Slideshow + PWA
- DISP-02 -> Phase 2: Slideshow + PWA
- DISP-03 -> Phase 2: Slideshow + PWA
- DISP-04 -> Phase 2: Slideshow + PWA
- DISP-05 -> Phase 2: Slideshow + PWA
- DISP-06 -> Phase 2: Slideshow + PWA

---

### PWA + Screen Wake (PWA)

- [ ] **PWA-01**: Screen stays awake indefinitely using NoSleep.js as primary strategy (Wake Lock API broken on iOS 16.x PWAs per WebKit bug #254545)
- [ ] **PWA-02**: App works as fullscreen PWA (PWA manifest + Apple meta tags for Add to Home Screen, no Safari chrome)
- [ ] **PWA-03**: App works in iOS Guided Access mode (kiosk mode for always-on display, no navigation away from page)

**Traceability:**
- PWA-01 -> Phase 2: Slideshow + PWA
- PWA-02 -> Phase 2: Slideshow + PWA
- PWA-03 -> Phase 2: Slideshow + PWA

---

### Infrastructure & Deployment (INFRA)

- [ ] **INFRA-01**: Backend runs on VPS with nginx reverse proxy and Let's Encrypt SSL (HTTPS required for OAuth callbacks)
- [ ] **INFRA-02**: Backend runs via PM2 with auto-restart on crash and startup script on reboot
- [ ] **INFRA-03**: Frontend auto-retries on fetch failures, backend uses exponential backoff on API calls (error resilience for network blips)
- [ ] **INFRA-04**: Health check endpoint (`/api/health`) reports token status, cache size, last API call timestamp, uptime

**Traceability:**
- INFRA-01 -> Phase 1: Backend + Deployment
- INFRA-02 -> Phase 1: Backend + Deployment
- INFRA-03 -> Phase 2: Slideshow + PWA
- INFRA-04 -> Phase 1: Backend + Deployment

---

### Advanced Features (ADV) -- Polish Week Target

- [ ] **ADV-01**: "On This Day" mode filters photos to only those taken on today's month+day across all years (mimics Google Photos Memories, unique differentiator)
- [ ] **ADV-02**: Portrait pair mode detects two consecutive portrait photos and displays them side-by-side in landscape orientation (matches Aura's $200+ flagship feature)
- [ ] **ADV-03**: Settings page (`/settings`) provides web UI to configure slideshow interval, enable/disable filters and modes, no code changes needed

**Traceability:**
- ADV-01 -> Phase 3: Advanced Features
- ADV-02 -> Phase 3: Advanced Features
- ADV-03 -> Phase 3: Advanced Features

---

## v2 Requirements (Deferred to Future)

### Visual Polish

- [ ] Ken Burns effect (slow random zoom + pan, cinematic feel, pure CSS)
- [ ] Blurred background fill (blurred/dimmed photo behind instead of black bars)
- [ ] Photo date overlay ("March 2021" text for nostalgia)
- [ ] Clock + date overlay (current time/date in corner, ambient utility)

### Enhancements

- [ ] Album filtering (show photos from specific albums only, needs Settings page)
- [ ] Sleep/wake schedule (dim or black out screen on schedule, e.g., 11pm-7am)
- [ ] Auto-dim by time (gradual brightness reduction in evening hours)
- [ ] Weather widget (OpenWeatherMap overlay in corner)
- [ ] Touch to pause + info (tap to pause slideshow and show photo details)
- [ ] Exclude screenshots (heuristic-based filtering of screenshots/memes)
- [ ] Exclude non-photos (filter receipts, documents by metadata)
- [ ] Favorites-only mode (show only starred photos from Google Photos)
- [ ] Recently added mode (show photos added in last 7/30 days)
- [ ] Short video playback (play <15s videos muted instead of showing still)
- [ ] QR code for iPad setup (Settings page generates QR pointing to slideshow URL)

---

## Out of Scope

Explicitly not building these features:

- **Multi-user auth / multiple accounts** -- Massively increases scope (user management, per-user tokens, per-user caches). Wife can share albums to single Google account. Defer multi-device to future milestone.
- **Photo upload from browser** -- Requires file handling, storage management, mixing local + Google Photos sources. Family members can add photos to shared Google Photos album instead.
- **Native iOS app** -- $100 Apple Developer fee, App Store review, no benefit over PWA + Guided Access for single-device home use.
- **Face recognition / AI curation** -- Requires ML infrastructure, GPU resources, massive scope. Google Photos already does this; use Google Photos albums for curated selection.
- **Real-time photo sync** -- Google Photos has no push notification API. High-frequency polling wastes quota. Cache refresh every 6 hours is acceptable for photo frame use case.
- **Complex transition library (10+ styles)** -- Each transition is separate implementation, testing matrix explodes. Crossfade is sufficient; commercial frames ship 3-5 max.
- **Social features (like/comment)** -- Wrong product category. This is ambient display, not social app. Zero interaction is the feature.
- **Instagram / Facebook integration** -- Each integration is separate OAuth flow, separate API, separate failure modes. Google Photos is single source of truth.
- **Ambient light sensor integration** -- iPad doesn't expose ambient light sensor to web APIs (would require native app). Use time-based auto-dim instead.
- **Music / Spotify integration** -- Audio playback in PWA unreliable on iOS (auto-play restrictions). Different product category.

---

## Requirements Summary

| Category | v1 Count | v2 Count | Out of Scope |
|----------|----------|----------|--------------|
| Authentication & Photo Access | 4 | 0 | 0 |
| Slideshow Display | 6 | 0 | 0 |
| PWA + Screen Wake | 3 | 0 | 0 |
| Infrastructure & Deployment | 4 | 0 | 0 |
| Advanced Features | 3 | 0 | 0 |
| Visual Polish | 0 | 4 | 0 |
| Enhancements | 0 | 11 | 0 |
| Anti-Features | 0 | 0 | 10 |
| **Total** | **20** | **15** | **10** |

---

## Timeline

**Weekend MVP (Saturday-Sunday):**
- AUTH-01 through AUTH-04 (authentication + photo access)
- DISP-01 through DISP-06 (core slideshow)
- PWA-01 through PWA-03 (screen wake + fullscreen)
- INFRA-01 through INFRA-04 (deployment)

**Estimated:** 12-16 hours of focused work. Ship working slideshow by Sunday evening.

**Polish Week (Monday-Friday):**
- ADV-01: "On This Day" mode (~2-3 hours)
- ADV-02: Portrait pair mode (~2-3 hours)
- ADV-03: Settings page (~3-4 hours)

**Estimated:** 8-10 hours. Polish features live by end of week.

---

## Success Criteria

**Weekend MVP:**
- [ ] iPad displays random photos from Picker-selected library
- [ ] Screen stays on indefinitely in Guided Access mode
- [ ] Smooth crossfade transitions, no loading flash
- [ ] Runs for 7+ days without crashing or token expiry
- [ ] Total cost: $0 (existing VPS, free Google APIs)

**Polish Week:**
- [ ] "On This Day" mode surfaces photos from this date across years
- [ ] Portrait photos display side-by-side when consecutive
- [ ] Settings page allows configuration without code changes
- [ ] Demo-ready for portfolio (screenshot-worthy)

---

## Key Constraints (from PROJECT.md)

- **API:** Picker API only (`photospicker.mediaitems.readonly` scope) -- Library API deprecated March 31, 2025
- **Platform:** iPad Pro 1st Gen (iOS 16.x max) OR Chrome on iPad (better PWA support per user note)
- **Screen Wake:** NoSleep.js is PRIMARY strategy (not fallback) -- Wake Lock API broken on iOS 16.x PWAs
- **Timeline:** Weekend MVP + Polish Week = 7-10 days total
- **Budget:** $0 (existing VPS, free Google APIs, no App Store)
- **Security:** API keys in `.env` (gitignored), private GitHub repo, no hardcoded secrets
- **Portfolio:** Must demonstrate product taste, technical depth, and end-to-end shipping

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1: Backend + Deployment | Complete |
| AUTH-02 | Phase 1: Backend + Deployment | Complete |
| AUTH-03 | Phase 1: Backend + Deployment | Complete |
| AUTH-04 | Phase 1: Backend + Deployment | Complete |
| DISP-01 | Phase 2: Slideshow + PWA | Complete |
| DISP-02 | Phase 2: Slideshow + PWA | Complete |
| DISP-03 | Phase 2: Slideshow + PWA | Complete |
| DISP-04 | Phase 2: Slideshow + PWA | Complete |
| DISP-05 | Phase 2: Slideshow + PWA | Complete |
| DISP-06 | Phase 2: Slideshow + PWA | Complete |
| PWA-01 | Phase 2: Slideshow + PWA | Complete |
| PWA-02 | Phase 2: Slideshow + PWA | Complete |
| PWA-03 | Phase 2: Slideshow + PWA | Complete |
| INFRA-01 | Phase 1: Backend + Deployment | Complete |
| INFRA-02 | Phase 1: Backend + Deployment | Complete |
| INFRA-03 | Phase 2: Slideshow + PWA | Complete |
| INFRA-04 | Phase 1: Backend + Deployment | Complete |
| ADV-01 | Phase 3: Advanced Features | Complete |
| ADV-02 | Phase 3: Advanced Features | Complete |
| ADV-03 | Phase 3: Advanced Features | Complete |

---

*Requirements defined: 2026-02-08*
*Ready for roadmap: yes*
