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

**What's next:** v2 planning — visual polish (Ken Burns, blurred backgrounds), sleep/wake schedule, album filtering, and multi-device support

---
