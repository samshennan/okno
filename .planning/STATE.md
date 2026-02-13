# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** Phase 2 verification — slideshow working, picker bug outstanding

## Current Position

**Phase: 2 of 3 (Slideshow + PWA)**
Plan: 3 of 3 in phase (human verification — partially complete)
Status: Slideshow working, iPad device testing + picker bug remaining
Last activity: 2026-02-13 - Fixed CSP bugs, visual polish, deployed 3x

Progress: [████████████░░░░░░░░] 60% (Phase 1 done, Phase 2 near-complete)

## What We Shipped

### v0.1.0 (2026-02-10 morning)
- ✅ Google Photos slideshow with 3 display modes
- ✅ Interval controls (10s - 5m)
- ✅ Fullscreen support with touch controls
- ✅ iPad optimization (sleep reminder, responsive design)
- ✅ VPS deployment (nginx + PM2 + SSL)
- ✅ Auto-refresh baseUrls every 50 minutes
- ✅ OAuth 2.0 authentication with token persistence

### v0.1.1 (2026-02-10 afternoon)
- ✅ Email allowlist security (sam@samshennan.com, alicja.chodara@gmail.com)
- ✅ Sign Out button and logout endpoint
- ✅ Manual cache refresh endpoint (POST /api/health/refresh)
- ✅ Sleep reminder repositioned (bottom-left, no UI overlap)
- ✅ Comprehensive documentation (README, CHANGELOG, ROADMAP, SECURITY-AUDIT, COMPETITIVE-ANALYSIS)
- ✅ Fixed black photos issue (expired tokens + stale baseUrls)

### Phase 2 Progress (2026-02-11)
- ✅ PWA manifest with fullscreen display mode (02-01)
- ✅ Service Worker with network-first photo caching (02-01)
- ✅ iOS-specific meta tags for Add to Home Screen (02-01)
- ✅ NoSleep.js screen wake lock for indefinite operation (02-02)
- ✅ Exponential backoff retry for network resilience (02-02)

### Bug Fixes & Polish (2026-02-13)
- ✅ CSP fix: blob: in img-src (slideshow was showing loading spinner)
- ✅ CSP fix: connect-src for CDN (SW fetch governed by connect-src, not script-src)
- ✅ Service Worker: skip cross-origin requests (was crashing on CDN fetches)
- ✅ CSP: added Google Fonts + unpkg.com for Lucide icons
- ✅ Pinned Lucide icons to v0.564.0 (was @latest)
- ✅ Visual polish: Inter font, Lucide icons, custom SVG logo
- ✅ Feedback form: JSON error handling, defensive file cleanup
- ✅ Auth status: fallback to token check when session flag missing
- ✅ 1Password CLI installed on MacBook (autonomous VPS deploys)

## Performance Metrics

**Development Time:**
- Phase 1 (Backend + Deployment): ~6 hours (including planning)
- v0.1.0 launch: 1 session
- v0.1.1 fixes: 1 session (same day)
- Phase 2 (02-01 + 02-02): ~45 minutes total
- Total: ~9 hours from concept to production-ready PWA

**Phase 1 Results:**
- Plans completed: 5/5 (01-01 through 01-05)
- Deployment: Successful, live at okno.moonacle.com
- Security: Email allowlist active, HTTPS enforced
- Stability: PM2 auto-restart, health monitoring

**Phase 2 Results (in progress):**
- Plans completed: 2/3 (02-01, 02-02 complete)
- PWA installable on iOS with fullscreen mode
- Screen stays awake indefinitely during slideshow
- Network resilience handles weak WiFi gracefully

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
| Sharp for icon generation (not ImageMagick) | Portable, programmatic, high-quality | 02-01 | 2026-02-11 |
| NoSleep.js via CDN (not npm package) | Avoids build step, maintains vanilla JS | 02-02 | 2026-02-11 |
| NoSleep.js over Wake Lock API | Wake Lock API broken in iOS PWAs until iOS 18.4 | 02-02 | 2026-02-11 |
| Exponential backoff (7 retries, 10ms-640ms) | Balances fast recovery with server kindness | 02-02 | 2026-02-11 |
| Blob URLs for photo loading | Prevents cache issues with expired baseUrls | 02-02 | 2026-02-11 |
| Inter font + Lucide icons (pinned v0.564.0) | Professional look, consistent design language | 02 | 2026-02-13 |
| SW skip cross-origin requests | Prevents CSP cascade failures from CDN interception | 02 | 2026-02-13 |
| Client-side primary for multi-user (future) | Zero personal data on VPS, browser is the vault | future | 2026-02-13 |

### Technical Debt

**Addressed:**
- ✅ baseUrl expiry handling (manual refresh endpoint)
- ✅ Missing re-authentication UI (Sign Out button)
- ✅ Email allowlist for security
- ✅ Comprehensive documentation
- ✅ iPad screen sleep prevention (NoSleep.js)
- ✅ Network error handling (exponential backoff)

**Remaining:**
- ⚠️ Auto-retry on 403 errors (manual refresh required)
- ⚠️ Cache auto-refresh on startup if stale
- ⚠️ Single-tenant limitation (Phase 4 will fix)
- ⚠️ No photo management UI (Phase 2 goal)

### Next Phase: Phase 2 - Photo Management

**Goals:**
- Thumbnail grid view of cached photos
- Toggle individual photos on/off (hidden flag)
- Select All / Unselect All buttons
- Never re-select 2000 photos again

**After Phase 2:**
- Phase 3: Video support
- Phase 4: Multi-tenant refactor for public release
- Phase 5: Full library sync (>2000 photos)
- Phase 6: Monetization research and validation
- Phase 7: Advanced features (AI, smart albums, etc.)

See: ROADMAP.md for full feature roadmap

### Pending Todos

**Phase 2 Planning:**
- [ ] Design photo management UI/UX
- [ ] Add `hidden` boolean to cache.json schema
- [ ] Create /manage.html page with thumbnail grid
- [ ] Add API endpoint for toggling photo visibility
- [ ] Update slideshow to filter hidden photos

**Infrastructure:**
- [ ] Add auto-retry logic for 403 errors
- [ ] Auto-refresh cache on startup if >50 minutes old
- [ ] Better error messages in slideshow UI

**Documentation:**
- [ ] Add LICENSE file (MIT)
- [ ] Create CONTRIBUTING.md for Phase 4
- [ ] Docker deployment guide

### Blockers/Concerns

**Resolved:**
- ✅ OAuth token expiry (manual refresh endpoint + Sign Out button)
- ✅ No re-authentication UI (Sign Out button added)
- ✅ Security for family use (email allowlist active)
- ✅ iPad screen sleep issues (NoSleep.js screen wake lock)
- ✅ Network errors causing white flashes (exponential backoff retry)

**Active:**
- Google Picker API has no "Select All" option (manual selection only)
- 2000 photo limit from Google Picker API (need Library API for >2000)
- Single-tenant design limits public use (Phase 4 required)

**Future Considerations:**
- App Store submission requires native iOS app (Phase 4+)
- Monetization requires multi-tenant refactor (Phase 6)
- Market validation needed before commercial offering (1,000+ GitHub stars)

## Session Continuity

**Last session:** 2026-02-13 21:00 UTC
**Status:** Phase 02 Plan 03 partially verified — slideshow working, picker bug outstanding
**Resume file:** .planning/phases/02-slideshow-pwa/.continue-here.md

**Current state:**
- Production app running at okno.moonacle.com with visual polish
- Slideshow confirmed working (photos load, transitions smooth, controls functional)
- 1Password CLI + SSH key auth enables autonomous deploys
- 6 photos cached — slideshow works but picker can't add NEW photos

**KNOWN BUG:** Google Picker `mediaItemsSet` stays false after photo selection
- Enhanced logging deployed (picker.js:106-114) but not yet captured
- Need user to retry picker flow to get diagnostic data

**Next steps when resuming:**
1. Debug picker bug — retry flow, capture full session JSON from server logs
2. iPad real-device test — PWA install, wake lock 2+ hours, Guided Access
3. Complete 02-03-SUMMARY.md once all verification criteria pass
4. Phase 3: Advanced Features (On This Day, portrait pairs, settings page)

---

**Project Status:** 🎉 SHIPPED v0.1.1 - Production-ready family photo frame!
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
