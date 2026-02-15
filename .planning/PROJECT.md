# Okno

## What This Is

Okno is a self-hosted web app that turns an old iPad into a Google Photos digital photo frame. It displays random photos from your Google Photos library in a beautiful, hands-off slideshow with "On This Day" memories, portrait pair display, and a settings page. It's both a useful daily tool for viewing past memories without printing, and a portfolio piece demonstrating end-to-end product ownership, technical depth, and product taste.

## Core Value

Display random photos from Google Photos library on an iPad in a beautiful, hands-off way that requires no interaction after initial setup. The slideshow must be smooth, reliable, and work indefinitely in kiosk mode.

## Current Milestone: v1.1 "Make It Shine"

**Goal:** Elevate Okno from functional MVP to portfolio-quality showcase with cinematic visual effects, bug fixes from QA testing, Stripe donate integration, and a demo mode for interviewer walkthroughs.

**Target features:**
- Bug fixes from v1.0 QA (picker merge overwrite, session timeout, On This Day fallback, 502 resilience)
- Ken Burns cinematic zoom/pan effect (toggleable)
- Blurred background fill instead of black bars (toggleable)
- Photo date and clock overlays (toggleable)
- Stripe donate button (existing moonacle account)
- Demo mode (works without Google auth, sample photos)
- Polished GitHub README with architecture diagrams and screenshots

## Current State

**Version:** v1.0 shipped 2026-02-15
**Deployment:** https://okno.moonacle.com
**Codebase:** ~4,500 LOC (Node.js + Express backend, vanilla HTML/CSS/JS frontend)
**Tech stack:** Node.js, Express, Google Photos Picker API, PWA (Service Worker + manifest), NoSleep.js

## Requirements

### Validated

- ✓ User authenticates with Google Photos via OAuth 2.0, tokens persist across restarts — v1.0
- ✓ User selects photos via Google Picker UI, backend caches media items + metadata — v1.0
- ✓ Backend auto-refreshes baseUrls every 50 minutes (before 60-min expiry) — v1.0
- ✓ iPad displays fullscreen slideshow with smooth crossfade transitions — v1.0
- ✓ Next photo preloads (A/B swap pattern prevents memory leaks) — v1.0
- ✓ Screen stays awake indefinitely via NoSleep.js — v1.0
- ✓ App works as fullscreen PWA (Add to Home Screen removes Safari chrome) — v1.0
- ✓ App works in iOS Guided Access mode (kiosk mode) — v1.0
- ✓ Backend runs on VPS with nginx + Let's Encrypt SSL — v1.0
- ✓ Backend runs via PM2 with auto-restart on crash and reboot survival — v1.0
- ✓ Exponential backoff retry for network resilience — v1.0
- ✓ Health endpoint reports auth status, cache size, uptime — v1.0
- ✓ Configurable slideshow interval via URL param and settings page — v1.0
- ✓ "On This Day" mode filters to today's month+day across all years — v1.0
- ✓ Portrait pair mode displays matching portraits side-by-side — v1.0
- ✓ Settings page for interval, display mode, and feature toggles — v1.0

### Active

- [ ] Fix picker session batch overwrite (merge instead of replace)
- [ ] Fix picker session timeout UX (countdown warning)
- [ ] Fix On This Day fallback visibility (black screen bug)
- [ ] Fix 502 resilience on photo random endpoint
- [ ] Fix dual mode letterboxing for landscape photos
- [ ] Fix calendar indicator when On This Day photo not loaded
- [ ] Ken Burns cinematic zoom/pan effect with toggle
- [ ] Blurred background fill instead of black bars with toggle
- [ ] Photo date overlay with toggle
- [ ] Clock overlay with toggle
- [ ] Stripe donate button (moonacle account)
- [ ] Demo mode (sample photos, no Google auth required)
- [ ] Polished GitHub README with architecture diagrams and screenshots

### Out of Scope

- Album filtering, date range filtering, favorites mode — deferred to v2.0
- Photo management grid — deferred to v2.0
- Multi-user support (per-user accounts) — deferred to v2.0 (infra built with toggle)
- Multi-device support (wife's iPad) — deferred to v2.0
- Weather widget — not core to photo frame purpose
- Short video playback — photos only for now
- Screenshot/non-photo filtering — not critical for personal library
- Shared upload page — read-only Google Photos integration
- Native iOS app — PWA + Guided Access sufficient, avoids $100 developer fee
- Face recognition / AI curation — massive scope, Google Photos already does this
- Real-time photo sync — no push API, cache refresh sufficient
- Music / Spotify integration — different product category

## Context

**Hardware:**
- iPad Pro 1st Gen (iOS 16.x, landscape orientation, plugged in permanently)
- Display resolution: 2732x2048 (264 PPI)
- Locked in Guided Access kiosk mode

**Photo Library:**
- Google Photos library with years of memories
- Primary way to view old photos (no photo printing habit)
- Wife would also like to use it (she has old iPad) — future milestone

**Infrastructure:**
- VPS: nginx reverse proxy + Let's Encrypt SSL + PM2 process manager
- Domain: okno.moonacle.com
- GitHub: https://github.com/samshennan/okno

**Portfolio Context:**
- Portfolio piece for product leadership job hunt
- Demonstrates: product taste, technical depth, end-to-end ownership
- v1.0 shipped in 7 days (concept to production)

**Google Photos API:**
- Picker API with `photospicker.mediaitems.readonly` scope
- 2000 photo limit from Picker API (Library API needed for >2000)
- baseUrl expires after ~60 minutes (backend refreshes every 50 min)
- Read-only access

**Known Tech Debt (from v1.0 audit):**
- iPad device testing pending (PWA install, wake lock 2+ hrs, Guided Access, memory leak, WiFi resilience)
- No rate limiting on /api/photo/random (low priority for family app)
- No config.json schema migration logic
- Picker session expiry not explicitly detected

**QA Bugs (from v1.0 testing session):**
- BUG-1: Picker session timeout after ~30 min (CRITICAL UX — user loses selection)
- BUG-2: Second picker batch overwrites first (DATA LOSS — merge needed)
- BUG-3: On This Day fallback message invisible (black screen)
- BUG-4: Calendar indicator missing when photo not loaded
- BUG-5: 502 errors on /api/photo/random during fallback
- BUG-6: Dual mode forces landscape photos side-by-side (letterboxing)

## Constraints

- **Tech stack**: Node.js + Express backend, vanilla HTML/CSS/JS frontend
- **API**: Google Photos Picker API (Library API deprecated March 2025)
- **Hosting**: VPS with nginx, PM2, Let's Encrypt SSL
- **Platform**: iPad Pro 1st Gen running iOS 16.x in Safari PWA mode
- **Budget**: $0 — existing VPS, free Google APIs
- **Security**: API keys in .env (gitignored), email allowlist for access control
- **Safari compatibility**: iOS 16.x Safari (NoSleep.js for screen wake, not Wake Lock API)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app (PWA) instead of native iOS app | Avoids $100 fee, easier iteration, web skills more relevant | ✓ Good — fullscreen PWA works well |
| Google Photos Picker API instead of Library API | Library API deprecated March 2025, Picker is replacement | ✓ Good — works, but 2000 photo limit |
| Hardcoded defaults for MVP, settings page later | Ship faster, settings added in Phase 3 | ✓ Good — shipped both |
| Single device for MVP | Simplify scope, multi-device later | ✓ Good — single-tenant works for family |
| VPS hosting instead of serverless | Existing infra, full control, PM2 reliability | ✓ Good — rock solid |
| Vanilla JS instead of React/framework | No build step, works on old Safari, lower complexity | ✓ Good — simple and effective |
| Environment variables for secrets | .env gitignored, never hardcoded | ✓ Good — standard practice |
| NoSleep.js over Wake Lock API | Wake Lock broken in iOS 16.x PWAs | ✓ Good — reliable screen wake |
| File-based persistence (tokens.json, cache.json, config.json) | Lightweight, no database needed | ✓ Good — matches single-tenant use case |
| Backend image proxy for photo serving | Picker API baseUrls require Authorization headers | ✓ Good — solved browser img tag limitation |
| Network-first Service Worker caching | Fresh photos when online, offline fallback | ✓ Good — resilient to WiFi blips |
| Backend-assisted portrait pairing | Eliminates recursive frontend guessing | ✓ Good — clean architecture |

---
*Last updated: 2026-02-15 after v1.1 milestone start*
