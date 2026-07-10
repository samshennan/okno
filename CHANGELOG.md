---
project: okno
type: changelog
tags: [project/okno, type/changelog]
---

# Changelog

All notable changes to Okno will be documented in this file.

## [0.2.0] - 2026-07-10 - Reliability Hardening

### Security
- Removed all third-party CDN dependencies (unpkg, jsdelivr, Google Fonts) — Lucide icons, NoSleep.js, and Inter font are now vendored locally under `public/vendor/`. The frame no longer depends on three external services staying up to load correctly, and CSP `script-src`/`style-src`/`connect-src` no longer allow any external origin.
- OAuth CSRF `state` token is now single-use (deleted from session as soon as it's read), closing a replay window.

### Bug Fixes
- Fixed the reconnect flow: after a session-expired reconnect from the slideshow, the user is now returned to the slideshow instead of the dashboard (`?next=` param carried through the OAuth round trip, survives session regeneration).

### Developer Experience
- Aligned `package.json` version with `CHANGELOG.md` (was drifted at 0.1.0 vs 0.1.1).

---

## [0.1.1] - 2026-02-10 - Post-Launch Fixes

### Bug Fixes
- Sign Out button added to home page for re-authentication
- Added `POST /auth/logout` to destroy session
- Added `POST /api/health/refresh` endpoint to update expired baseUrls
- Moved iPad sleep reminder to bottom-left to avoid UI overlap
- Added `ALLOWED_EMAILS` environment variable for instance-level access control
- Email check added during OAuth callback

### Security Enhancements
- Optional email allowlist to restrict access to specific Google accounts
- Warning log and redirect for unauthorised login attempts
- Explicit logout flow for clean session teardown

### UX Improvements
- Sign Out button styled for clear visibility
- Confirmation dialog before signing out
- Auto-reload after logout for clean state
- Sleep reminder positioned to not block controls

### Developer Experience
- Manual cache refresh endpoint for debugging expired baseUrls
- Better error logging for unauthorised access attempts
- Health endpoint returns cache refresh timestamp

### Documentation
- Added COMPETITIVE-ANALYSIS.md with market research
- Added SECURITY-AUDIT.md with comprehensive security analysis
- Updated ROADMAP.md
- Created README.md

### Technical Debt Fixed
- Addressed baseUrl expiry issue (403 Forbidden errors)
- Added workaround for token expiry during slideshow
- Documented cache storage architecture (metadata only, no images)

### Issues Resolved
- Black photos issue (expired OAuth tokens + stale baseUrls)
- Missing re-authentication UI
- Cache staleness detection and manual refresh capability

---

## [0.1.0] - 2026-02-10 - Initial Release

### Features

#### Photo Slideshow
- Three display modes: Fill Screen (cover), Whole Photo (contain), Portrait Pairs (dual)
- Interval controls: 10s, 30s, 1m, 2m, 5m
- Fullscreen support with one-tap toggle
- Smooth crossfade transitions (1 second)
- Random photo selection from cache
- Control visibility: tap to show, auto-hide after 4 seconds
- Keyboard shortcuts (desktop): Space, arrows, Esc

#### Google Photos Integration
- Photo Picker API — select up to 2000 photos
- OAuth 2.0 authentication with refresh tokens
- Auto-refresh baseUrls every 50 minutes (prevents expiry)
- Image proxy with authorisation headers
- Session persistence — photos remembered across visits
- Server-side cache — survives restarts

#### Security
- Optional email allowlist for instance-level access control
- HTTPS enforced in production (Let's Encrypt SSL)
- CSRF protection for OAuth flow
- httpOnly cookies to prevent XSS attacks
- Session isolation with secure file store
- Helmet.js security headers

#### iPad Optimisation
- Touch controls — tap to show/hide
- Sleep mode reminder
- Responsive design
- PWA-ready — add to home screen
- Auto-redirect: direct slideshow access redirects to dashboard if unauthenticated

#### Deployment
- nginx reverse proxy with SSL
- PM2 process manager for reliability
- Auto-restart on crashes
- Winston logging (error + combined logs)
- Health endpoint for monitoring

### Technical Stack
- Backend: Node.js + Express
- Frontend: Vanilla HTML/CSS/JS (zero framework dependencies)
- Storage: SQLite (better-sqlite3) for sessions and photo cache
- API: Google Photos Picker API + OAuth 2.0
- Deployment: Linux VPS + nginx + PM2

### Known Limitations at Launch
- 2000 photo maximum per user (Google API limit)
- Must re-run the Picker to change photo selection
- No "Select All" in the Picker (Google UI limitation)

---

## Future Releases

### [0.2.0] - Photo Management (Planned)
- Thumbnail grid view of cached photos
- Toggle individual photos on/off
- Filter by active/hidden status
- Edit selection without re-running the Picker

### [0.3.0] - Video Support (Planned)
- Video playback in slideshow
- Auto-play with volume control

### [1.0.0] - Stability + Polish (Planned)
- Broader test coverage
- Performance improvements for large caches
