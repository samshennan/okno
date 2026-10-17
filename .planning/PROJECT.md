# Okno

## What This Is

Okno is a self-hosted web app that turns old iPads into Google Photos digital photo frames. It displays random photos from a user's Google Photos library in a beautiful, hands-off slideshow with cinematic Ken Burns effects, blurred backgrounds, "On This Day" memories, portrait pair display, and configurable overlays. Currently single-user, it's expanding to support multiple Google accounts so friends and family can each run their own frame. It's both a useful daily tool for viewing memories and a portfolio piece demonstrating end-to-end product ownership.

## Core Value

Display random photos from Google Photos library on an iPad in a beautiful, hands-off way that requires no interaction after initial setup. The slideshow must be smooth, reliable, and work indefinitely in kiosk mode.

## Current Milestone: v2.0 "Multi-Tenant"

**Goal:** Transform Okno from a single-user app into a multi-tenant platform where multiple Google users can each run their own photo frame with isolated data, invite-based access, and a photo management grid.

**Target features:**
- Multi-user authentication (per-user Google OAuth, sessions, isolated data)
- Invite code system (generate codes, users enter on first login)
- Database migration (file-based JSON → proper DB for multi-user storage)
- Per-user photo cache, tokens, and settings isolation
- Photo management grid (view cached photo thumbnails, remove unwanted photos)
- Data migration (auto-import existing JSON files as first user account)
- Admin via CLI (user management, invite code generation on VPS)

**Deferred from v1.1:** Phase 7 (README + Portfolio Polish) — can be completed alongside or after v2.0.

## Current State

**Version:** v1.1 (Phases 4-6 shipped, Phase 7 pending)
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
- ✓ Picker session batch merge (no photo loss on re-pick) — v1.1
- ✓ Picker countdown timer during photo selection — v1.1
- ✓ On This Day fallback visibility (no black screen) — v1.1
- ✓ 502 resilience with proactive baseUrl refresh — v1.1
- ✓ Dual mode landscape handling (no letterboxing) — v1.1
- ✓ Calendar indicator timing fix — v1.1
- ✓ Ken Burns cinematic zoom/pan with 6 presets, toggleable — v1.1
- ✓ Blurred background fill (32x24 data URI, GPU-efficient), toggleable — v1.1
- ✓ Photo date overlay (month + year from EXIF), toggleable — v1.1
- ✓ Clock overlay (opt-in, updates every minute) — v1.1
- ✓ prefers-reduced-motion accessibility support — v1.1
- ✓ Stripe Payment Link donate button (auth-gated) — v1.1
- ✓ Demo mode with 12 sample photos, no auth required — v1.1
- ✓ Demo badge indicator + end-of-demo CTA — v1.1
- ✓ Service Worker cache versioning (v1.0 → v1.3) — v1.1

### Active

- [ ] Multi-user Google OAuth (per-user tokens, sessions)
- [ ] Invite code access control (generate, validate, redeem)
- [ ] Database for multi-user storage (migrate from file-based JSON)
- [ ] Per-user photo cache isolation
- [ ] Per-user settings isolation
- [ ] Photo management grid (view thumbnails, remove photos)
- [ ] Data migration (auto-import existing JSON as first user)
- [ ] CLI admin tools (user management, invite codes)
- [ ] Polished GitHub README with architecture diagrams and screenshots (carried from v1.1 Phase 7)

### Out of Scope

- Video playback — photos only, deferred to v2.1+
- Open registration — start with invite codes, open up later
- Admin dashboard UI — CLI-only for now, UI in future version
- Album filtering, date range filtering, favorites mode — deferred to future
- Weather widget — not core to photo frame purpose
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
- Wife has old iPad, will be first additional user in v2.0

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

**Known Tech Debt:**
- iPad device testing pending (PWA install, wake lock 2+ hrs, Guided Access, memory leak, WiFi resilience)
- Rate limiting on /api/photo/random (becomes important with multiple users)
- File-based persistence (tokens.json, cache.json, config.json) must migrate to DB for multi-user
- Stripe Payment Link URLs are PLACEHOLDER — must replace before sharing with others

**v1.0 QA Bugs:** All 6 bugs fixed in v1.1 Phase 4.

## Constraints

- **Tech stack**: Node.js + Express backend, vanilla HTML/CSS/JS frontend
- **API**: Google Photos Picker API (Library API deprecated March 2025)
- **Hosting**: VPS with nginx, PM2, Let's Encrypt SSL
- **Platform**: iPad Pro 1st Gen running iOS 16.x — Chrome, Brave, or Safari (multi-browser support preferred)
- **Budget**: $0 — existing VPS, free Google APIs
- **Security**: API keys in .env (gitignored), per-user data isolation required
- **Browser compatibility**: Multi-browser (Chrome/Brave/Safari on iOS 16.x). NoSleep.js for screen wake. Visual effects should work across all three browsers.
- **Multi-tenant**: Each user's tokens, photos, and settings must be fully isolated. No cross-user data leakage.

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
| File-based persistence (tokens.json, cache.json, config.json) | Lightweight, no database needed | ⚠️ Revisit — must migrate to DB for multi-tenant |
| Backend image proxy for photo serving | Picker API baseUrls require Authorization headers | ✓ Good — solved browser img tag limitation |
| Network-first Service Worker caching | Fresh photos when online, offline fallback | ✓ Good — resilient to WiFi blips |
| Backend-assisted portrait pairing | Eliminates recursive frontend guessing | ✓ Good — clean architecture |

---
*Last updated: 2026-02-27 after v2.0 milestone start*
