# Okno

## What This Is

Okno is a self-hosted web app that turns an old iPad into a Google Photos digital photo frame. It displays random photos from your Google Photos library in a beautiful, hands-off slideshow. It's both a useful daily tool for viewing past memories without printing, and a portfolio piece demonstrating end-to-end product ownership, technical depth, and product taste for job hunt purposes.

## Core Value

Display random photos from Google Photos library on an iPad in a beautiful, hands-off way that requires no interaction after initial setup. The slideshow must be smooth, reliable, and work indefinitely in kiosk mode.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can authenticate with Google Photos via OAuth 2.0 and tokens persist across server restarts
- [ ] Backend fetches and caches entire Google Photos library on startup (paginated API calls)
- [ ] Backend serves random photos with fresh URLs (handles 60-min baseUrl expiry automatically)
- [ ] iPad displays fullscreen slideshow with smooth crossfade transitions every 30 seconds
- [ ] Next photo preloads while current photo displays (seamless transitions, no loading flicker)
- [ ] Screen stays awake indefinitely (Wake Lock API with NoSleep.js fallback for iOS 16)
- [ ] App works as fullscreen PWA (Add to Home Screen removes Safari chrome)
- [ ] App works in iOS Guided Access mode (kiosk mode for always-on display)
- [ ] Backend runs on VPS with nginx reverse proxy and Let's Encrypt SSL
- [ ] Backend runs via PM2 with auto-restart on crash and startup script on reboot

### Out of Scope

- Settings UI (hardcoded defaults for MVP) — deferred to V1, keeps weekend scope tight
- Ken Burns effect and blurred backgrounds (visual polish) — deferred to V1, MVP focuses on core functionality
- Clock/date/photo date overlays — deferred to V1, not needed for core value
- Album filtering, date range filtering, favorites mode — deferred to V1, random from full library is sufficient for MVP
- "On This Day" mode — deferred to V2, nice-to-have feature
- Weather widget — deferred to V2, not core to photo frame purpose
- Short video playback — deferred to V2, photos only for MVP
- Screenshot/non-photo filtering — deferred to V2, not critical for personal library
- Multi-device support (wife's iPad) — deferred to future, single device for MVP simplicity
- Settings page or QR code setup — deferred to V1, direct URL access is fine for MVP
- Shared upload page — deferred to V2, read-only Google Photos integration for MVP

## Context

**Hardware:**
- iPad Pro 1st Gen (max iOS 16.x, supports modern CSS, Wake Lock API may need fallback)
- Display resolution: 2732×2048 (264 PPI), landscape orientation locked
- Will be plugged in permanently, placed on stand, locked in Guided Access

**Photo Library:**
- Google Photos library with years of memories
- No photo printing habit, so this is primary way to view old photos
- Wife would also like to use it (she has old iPad), but starting with single device

**Infrastructure:**
- VPS already available (partially configured)
- Needs nginx reverse proxy setup + Let's Encrypt SSL for OAuth callbacks
- Domain name available for SSL (required for Google OAuth)

**Portfolio Context:**
- This is a portfolio piece for product leadership job hunt
- Needs to demonstrate: product taste (polished UX), technical depth (OAuth, APIs, deployment), and end-to-end ownership (concept to shipped product)
- Target: ship working MVP this weekend, polish incrementally in V1

**Google Photos API:**
- Free tier: 10,000 requests/day (sufficient for personal use)
- mediaItems.list for library pagination (~50-100 calls for full library)
- baseUrl expires after ~60 minutes (backend must track and refresh)
- Read-only access (no uploads in MVP)

## Constraints

- **Tech stack**: Node.js + Express backend — vibe-code friendly, excellent Google API library support
- **Frontend**: Vanilla HTML/CSS/JS — no build step, works on old Safari, easy to iterate
- **API**: Google Photos Library API — free tier sufficient, read-only access
- **Hosting**: VPS with nginx reverse proxy, PM2 process manager, Let's Encrypt SSL
- **Platform**: iPad Pro 1st Gen running iOS 16.x in Safari (PWA mode)
- **Timeline**: Weekend MVP — ship fast, iterate on polish later
- **Budget**: $0 — existing VPS, free Google APIs, no App Store ($100 developer fee avoided)
- **Security**: Home network only, single user (Sam), iPad locked in Guided Access kiosk mode
- **Safari compatibility**: Must work on iOS 16.x Safari (Wake Lock API may need NoSleep.js fallback)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app (PWA) instead of native iOS app | Avoids $100 Apple Developer fee, easier iteration, web deployment skills more relevant for portfolio | — Pending |
| Google Photos API instead of iCloud Photos | Free tier generous, better documented API, cross-platform if needed later | — Pending |
| Hardcoded defaults (30s interval, crossfade) for MVP | Ship faster this weekend, settings UI can come in V1 without breaking changes | — Pending |
| Single device for MVP | Simplify scope, multi-device (wife's iPad) can be added later with minimal changes | — Pending |
| VPS hosting instead of serverless | Existing infrastructure, full control, PM2 for reliability, fits portfolio narrative | — Pending |
| Vanilla JS instead of React/framework | No build step, works on old Safari, faster development for simple UI, lower complexity | — Pending |

---
*Last updated: 2026-02-08 after initialization*
