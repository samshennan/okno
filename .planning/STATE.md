# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** v1.1 "Make It Shine" — visual polish, bug fixes, portfolio artifacts

## Current Position

**Milestone:** v1.1 "Make It Shine"
Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-15 — Milestone v1.1 started

Progress: [░░░░░░░░░░░░░░░░░░░░] 0%

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

## Accumulated Context

### Key Decisions

See PROJECT.md for full decision log (12 decisions, all marked ✓ Good).

### Blockers/Concerns

**Active:**
- Google Picker API has no "Select All" option (manual selection only)
- 2000 photo limit from Google Picker API (need Library API for >2000)
- Single-tenant design limits public use
- 6 QA bugs identified (BUG-1 through BUG-6) — addressed in v1.1

### QA Results (from v1.0 testing)

**Passed:** Settings persistence, portrait pairs, fallback to single, mode switching, URL override
**Partial:** Network resilience (recovered from 502s after manual cache refresh)
**Bugs found:** 6 (picker overwrite, session timeout, OTD fallback, calendar indicator, 502 resilience, dual mode letterboxing)

## Session Continuity

**Last session:** 2026-02-15
**Status:** Defining v1.1 requirements
**Resume file:** None

**Next steps when resuming:**
1. Complete requirements definition
2. Create roadmap with phases
3. `/gsd:plan-phase [N]` to start execution

---

**Project Status:** v1.1 milestone started — defining requirements
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
