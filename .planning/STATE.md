# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** Phase 3 complete -- Advanced Features (On This Day, portrait pairs, settings)

## Current Position

**Phase: 3 of 3 (Advanced Features)**
Plan: 3 of 3 complete
Status: Phase 3 complete
Last activity: 2026-02-13 - Completed 03-03-PLAN.md (Portrait Pairs feature)

Progress: [████████████████████] 100% (All phases complete)

## What We Shipped

### v0.1.0 (2026-02-10 morning)
- Google Photos slideshow with 3 display modes
- Interval controls (10s - 5m)
- Fullscreen support with touch controls
- iPad optimization (sleep reminder, responsive design)
- VPS deployment (nginx + PM2 + SSL)
- Auto-refresh baseUrls every 50 minutes
- OAuth 2.0 authentication with token persistence

### v0.1.1 (2026-02-10 afternoon)
- Email allowlist security
- Sign Out button and logout endpoint
- Manual cache refresh endpoint
- Comprehensive documentation
- Fixed black photos issue

### Phase 2 (2026-02-11 to 2026-02-13)
- PWA manifest with fullscreen display mode (02-01)
- Service Worker with network-first photo caching (02-01)
- iOS-specific meta tags for Add to Home Screen (02-01)
- NoSleep.js screen wake lock for indefinite operation (02-02)
- Exponential backoff retry for network resilience (02-02)
- Visual polish: Inter font, Lucide icons, custom SVG logo (02-03)
- Picker bug fix: poll interval parsing + retry logic (02-03)

### Phase 3 (2026-02-13)
- Settings page at /settings.html with neumorphic UI (03-01)
- Config persistence layer: config.js + config.json (03-01)
- Config API: GET/POST /api/config (03-01)
- Slideshow reads config on startup, URL params override (03-01)
- Feature toggles for On This Day and Portrait Pairs (disabled, Coming Soon) (03-01)
- On This Day mode: date-based photo filtering across all years (03-02)
- OTD toggle enabled on settings page with live photo count (03-02)
- Calendar-heart indicator showing photo date during OTD mode (03-02)
- Graceful fallback to random mode when no OTD photos match (03-02)
- Portrait pair mode: backend-assisted portrait pairing using Picker API metadata (03-03)
- Portrait pairs toggle enabled on settings page with portrait count display (03-03)
- Backend portrait filtering: ?portrait=true endpoint + X-Photo-IsPortrait header (03-03)
- Portrait count exposed via /api/health endpoint (03-03)

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase | Date |
|----------|-----------|-------|------|
| Single-tenant design (shared OAuth tokens + cache) | Family use case, simplifies auth | 01 | 2026-02-10 |
| File-based cache (metadata only, no image storage) | Lightweight, no disk space issues | 01 | 2026-02-10 |
| On-demand streaming from Google Photos | No local storage, always fresh photos | 01 | 2026-02-10 |
| baseUrl refresh every 50 minutes | 10-min buffer before 1-hour expiry | 01 | 2026-02-10 |
| Email allowlist via ALLOWED_EMAILS env var | Security for family sharing | 01 | 2026-02-10 |
| Session-based authentication (1-year expiry) | Long-lived sessions for photo frame use case | 01 | 2026-02-10 |
| Network-first caching for photos | Fresh photos when online, offline fallback | 02-01 | 2026-02-11 |
| Fullscreen display mode (not standalone) | Remove all browser chrome for photo frame | 02-01 | 2026-02-11 |
| NoSleep.js via CDN (not npm package) | Avoids build step, maintains vanilla JS | 02-02 | 2026-02-11 |
| NoSleep.js over Wake Lock API | Wake Lock API broken in iOS PWAs until iOS 18.4 | 02-02 | 2026-02-11 |
| Exponential backoff (7 retries, 10ms-640ms) | Balances fast recovery with server kindness | 02-02 | 2026-02-11 |
| Inter font + Lucide icons (pinned v0.564.0) | Professional look, consistent design language | 02 | 2026-02-13 |
| File-based config persistence (config.json) | Lightweight, matches existing patterns (cache.json, tokens.json) | 03-01 | 2026-02-13 |
| URL params override saved config | Allows testing/override without changing saved settings | 03-01 | 2026-02-13 |
| Feature toggles disabled with Coming Soon | UI ready for 03-02 and 03-03 without premature functionality | 03-01 | 2026-02-13 |
| Server-side date filtering via createTime | createTime already in cache; no extra API calls needed | 03-02 | 2026-02-13 |
| 404 for no OTD photos (not 200 empty) | Distinct status lets frontend detect and handle gracefully | 03-02 | 2026-02-13 |
| 5-second fallback to random on no OTD match | Enough time to read message before auto-switching | 03-02 | 2026-02-13 |
| Portrait detection from Picker API metadata | Backend filters by width/height without downloading images | 03-03 | 2026-02-13 |
| Backend-assisted portrait pairing | ?portrait=true guarantees match; eliminates recursive guessing | 03-03 | 2026-02-13 |

### Blockers/Concerns

**Active:**
- Google Picker API has no "Select All" option (manual selection only)
- 2000 photo limit from Google Picker API (need Library API for >2000)
- Single-tenant design limits public use (Phase 4 required)

## Session Continuity

**Last session:** 2026-02-13 22:53 UTC
**Status:** All phases complete
**Resume file:** None

**Next steps when resuming:**
1. Deploy Phase 3 to VPS
2. iPad device testing (parallel manual activity)
3. Consider Phase 4 planning if desired

---

**Project Status:** All phases complete -- ready for deployment
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
