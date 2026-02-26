# Project Milestones: Okno

## v1.0 MVP (Shipped: 2026-02-15)

**Delivered:** Self-hosted Google Photos digital photo frame with OAuth authentication, PWA slideshow, On This Day mode, portrait pairs, and settings page — from zero to production in one week.

**Phases completed:** 1-3 (11 plans total)

**Key accomplishments:**
- Google Photos Picker API integration with OAuth 2.0, persistent token/cache storage, and automatic baseUrl refresh every 50 minutes
- Backend image proxy architecture solving Picker API's Authorization header requirement for browser `<img>` tags
- Progressive Web App with fullscreen iOS support, Service Worker caching, NoSleep.js screen wake lock, and exponential backoff retry for network resilience
- "On This Day" mode filtering photos to today's month+day across all years with graceful fallback to random
- Portrait pair mode using Picker API metadata to detect and display matching portrait photos side-by-side
- Settings page with persistent configuration, feature toggles, and URL parameter overrides

**Stats:**
- 90 files created/modified
- ~4,500 lines of code (JavaScript + HTML + CSS)
- 3 phases, 11 plans, 105 commits
- 7 days from start to ship (2026-02-08 to 2026-02-15)

**Git range:** `6f3ec2d` (project init) → `f7725e8` (testing docs)

**What's next:** v1.1 — visual polish, bug fixes, demo mode, Stripe donations

---

## v1.1 "Make It Shine" (Phases 4-6 shipped: 2026-02-16, Phase 7 deferred)

**Delivered:** Cinematic visual effects, comprehensive bug fixes, demo mode for portfolio showcase, and Stripe donation support. Elevated the MVP into a polished, portfolio-quality product.

**Phases completed:** 4-6 (9 plans total). Phase 7 (README + Portfolio Polish) context gathered but deferred.

**Key accomplishments:**
- Ken Burns cinematic zoom/pan with 6 randomized presets and prefers-reduced-motion accessibility
- Blurred background fill using GPU-efficient 32x24 canvas data URI (~3KB per photo)
- Photo date and clock overlays, all effects independently toggleable
- All 6 v1.0 QA bugs fixed (picker merge, countdown timer, OTD fallback, 502 recovery, dual mode, calendar)
- Demo mode with 12 sample photos, fully isolated from auth stack, end-of-demo CTA
- Stripe Payment Link donate button (auth-gated on settings page)
- Service Worker cache versioned v1.0 → v1.3 across phases

**Stats:**
- 4 phases (3 complete + 1 context gathered), 9 plans
- 2 days of development (2026-02-15 to 2026-02-16)

**What's next:** v2.0 — multi-tenant architecture, invite codes, photo management grid

---
