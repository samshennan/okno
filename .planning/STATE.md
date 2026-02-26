# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** v2.0 "Multi-Tenant" — planning

## Current Position

**Milestone:** v2.0 "Multi-Tenant"
Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-27 — Milestone v2.0 started

## What We Shipped

### v1.0 MVP (2026-02-15)
- Google Photos OAuth + Picker API integration with persistent caching
- Backend image proxy with automatic baseUrl refresh
- Fullscreen PWA slideshow with crossfade transitions
- NoSleep.js screen wake lock for indefinite operation
- Service Worker with network-first caching + exponential backoff
- "On This Day" mode (photos from today's date across all years)
- Portrait pair mode (side-by-side portrait display)
- Settings page with persistent configuration
- VPS deployment (nginx + PM2 + SSL)

### v1.1 "Make It Shine" (2026-02-16, Phases 4-6 complete)
- Phase 4: Bug fixes + stability (picker merge, countdown timer, 502 recovery, OTD fallback, dual mode fix, SW v1.1)
- Phase 5: Visual effects + overlays (Ken Burns, blurred background, photo date, clock, accessibility, SW v1.2)
- Phase 6: Stripe + demo mode (12 demo photos, demo slideshow, Stripe Payment Link, auth isolation, SW v1.3)
- Phase 7: README + Portfolio Polish — context gathered, deferred (can complete alongside v2.0)

## v2.0 Milestone Overview

**Goal:** Multi-tenant architecture + photo management grid

**Key architectural changes:**
- File-based JSON → database (SQLite or PostgreSQL, research decides)
- Single OAuth flow → per-user OAuth with session management
- Global config/cache → per-user isolated storage
- Email allowlist → invite code access control
- New photo management grid UI

## Accumulated Context

### Key Decisions

See PROJECT.md for full decision log (12 decisions from v1.0/v1.1).

**v2.0 scoping decisions:**
- Multi-tenant + photo grid in v2.0, video deferred to v2.1+
- Invite codes for access control (not email allowlist, not admin approval)
- Each user has their own device (no shared-device switching)
- CLI admin only (admin dashboard UI deferred)
- Auto-migrate existing JSON data as first user account
- Start invite-only, open registration later
- DB choice delegated to research phase

### Blockers/Concerns

**Active:**
- Google Picker API 2000 photo limit remains
- Stripe Payment Link URLs are PLACEHOLDER
- v1.1 Phase 7 (README) still pending — low priority relative to v2.0

**Architecture risks (to research):**
- Session management strategy for multi-user (cookie-based? JWT?)
- Google OAuth consent screen for multiple users (verification status?)
- Per-user baseUrl refresh scheduling (currently global 50-min timer)
- Rate limiting becomes important with multiple users

### User Feedback

- Demo mode lacks interactive UI controls — noted for future
- Wife's iPad is first additional user test case

## Session Continuity

**Last session:** 2026-02-27
**Stopped at:** Milestone v2.0 started, entering research phase

---

**Project Status:** v2.0 milestone started — defining requirements
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
