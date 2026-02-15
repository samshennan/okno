# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** v1.1 "Make It Shine" -- Phase 6 in progress

## Current Position

**Milestone:** v1.1 "Make It Shine"
Phase: 6 of 7 (Stripe + Demo Mode)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-15 -- Completed 06-02-PLAN.md

Progress: [████████████████████████████████████████░░░░░░░░░░░░] Phase 6 plan 2 complete
v1.1:     [█████████████░░░░░░░] 2/3 plans in Phase 6

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

### v1.1 Phase 4: Bug Fixes + Stability (2026-02-15)
- Picker session merge (no more photo loss on re-pick)
- Picker countdown timer (visual feedback during 60s session creation)
- 502 proactive recovery with baseUrl refresh in fetchWithRetry
- OTD fallback to random mode with immediate photo load
- Error response caching guard (SW never caches 502s)
- Calendar indicator timing fix for dual-mode landscape
- Cache version bump to v1.1 (forces iPad PWA re-cache of all fixes)

## v1.1 Phase Overview

| Phase | Goal | Reqs | Status |
|-------|------|------|--------|
| 4. Bug Fixes + Stability | Reliable, bug-free slideshow | 7 | COMPLETE (3/3 plans) |
| 5. Visual Effects + Overlays | Cinematic viewing experience | 8 | COMPLETE (3/3 plans) |
| 6. Stripe + Demo Mode | Visitor demo + donation | 6 | IN PROGRESS (2/3 plans) |
| 7. README + Portfolio Polish | Portfolio-quality GitHub presence | 4 | Not Started |

## Accumulated Context

### Key Decisions

See PROJECT.md for full decision log (12 decisions, all marked Good).

**v1.1 roadmap decisions:**
- Compressed research's 7-phase suggestion to 4 phases (depth=quick)
- Combined Visual Effects + Overlays (both are frontend display, overlays are quick wins after visual effects)
- Combined Stripe + Demo Mode (both are independent feature additions, demo needs visual effects done)
- Research's "Config Integration" phase absorbed -- toggles built alongside each feature, not separately
- DEPLOY-01 (SW cache version) in Phase 4 because it must deploy with bug fixes

**Phase 4 Plan 01 decisions:**
- setItems() always merges (no replace mode) -- merge is always correct for multi-session
- sessionId updates to latest on merge -- older session items lose baseUrl refresh (accepted, frontend retry handles it)
- Countdown uses inline styles matching existing index.html pattern
- Six cleanup call sites for clearPickerCountdown() to prevent memory leaks

**Phase 4 Plan 02 decisions:**
- 502 refresh triggered in fetchWithRetry (centralized), not in createPhotoElement
- OTD fallback loads random photo immediately (no 5s wait), message hides when photo appears
- Dual mode landscape flushes pending portrait as single (no photo waste)

**Phase 4 Plan 03 decisions:**
- Minimal changes only to sw.js -- no structural modifications beyond response.ok guard and version constants
- Cache version bump deliberately last so re-cached assets contain all bug fixes

**Phase 5 Plan 01 decisions:**
- kenBurns, blurredBackground, showPhotoDate default ON; showClock defaults OFF (opt-in)
- Visual Effects and Overlays sections placed between Slideshow and Features on settings page
- No additional validation code -- existing typeof check handles boolean enforcement

**Phase 5 Plan 02 decisions:**
- 8% max zoom (scale 1.08) for subtle cinematic feel without distortion
- 100ms delay before Ken Burns start so crossfade begins first (deliberate, cinematic feel)
- Animation duration matches slideshow interval for complete motion arc per photo
- teardownAndRemove() consolidates all cleanup into one GPU-safe function

**Phase 5 Plan 03 decisions:**
- Blur uses 32x24 canvas data URI (~3KB) instead of full-resolution image for GPU efficiency
- Blur disabled in dual portrait mode (GPU budget) and cover mode (no black bars)
- Clock defaults OFF (opt-in), photo date defaults ON
- SW cache bumped to v1.2 for Phase 5 deployment

**Phase 6 context decisions:**
- One-time donations only (not subscriptions), casual "buy me a coffee" tone
- Donate button on settings page, signed-in users only
- Demo: 10-15 mixed photos (personal-feel + scenic), one cycle then CTA
- Demo: subtle badge indicator, no settings access, full PWA support
- Demo: direct /demo URL route, fake EXIF dates for date overlay
- Demo end: "Watch again" + "Use your own photos" (no pressure)
- External agent's subscription-based Stripe code reverted (wrong model)

**Phase 6 Plan 02 decisions:**
- 10 real Unsplash photos + 2 portrait placeholders (flower, architecture) for 12 total
- Demo router fully isolated: zero imports from auth, photo-cache, photo-proxy, config
- Response headers match real photo proxy format (X-Photo-Id, X-Photo-CreateTime, X-Photo-IsPortrait)

### Blockers/Concerns

**Active:**
- Demo mode auth bypass must be fully isolated (Phase 6, needs security review)
- Google Picker API 2000 photo limit remains (v2.0 scope)

### Research Flags

- **Phase 5:** COMPLETE -- Ken Burns, blur background, overlays all shipped
- **Phase 6:** MODERATE -- sample photo licensing, auth bypass security

### QA Results (from v1.0 testing)

**Passed:** Settings persistence, portrait pairs, fallback to single, mode switching, URL override
**Partial:** Network resilience (recovered from 502s after manual cache refresh)
**Bugs found:** 6 (all addressed in Phase 4)

## Session Continuity

**Last session:** 2026-02-15
**Stopped at:** Completed 06-02-PLAN.md
**Resume file:** None

**Next steps when resuming:**
1. Execute 06-03-PLAN.md (demo slideshow page + end-of-demo CTA + SW cache v1.3)
2. Complete Phase 6

---

**Project Status:** Phase 6 plan 2 complete -- 1 plan remaining
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
