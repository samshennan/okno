---
phase: 06-stripe-+-demo-mode
plan: 03
subsystem: frontend
tags: [demo-mode, slideshow, service-worker, cta, pwa]

# Dependency graph
requires:
  - plan: 06-02
    provides: Demo backend endpoints (/api/demo/random, /api/demo/health) and sample photos
provides:
  - Self-contained demo slideshow page at /demo with DEMO badge, Ken Burns, blur, overlays
  - End-of-demo CTA with "Watch again" and "Use your own photos" options
  - Service Worker cache v1.3 for Phase 6 deployment
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-contained page pattern: demo.html adapted from slideshow.html with demo-specific behavior baked in"
    - "Display count tracking: counts total photo loads, not unique IDs, to handle random endpoint repeats"

key-files:
  created:
    - public/demo.html
  modified:
    - public/sw.js

key-decisions:
  - "Adapted from slideshow.html with demo-specific defaults hardcoded (no /api/config fetch)"
  - "One-cycle tracking uses display count, not unique photo IDs (coupon collector problem with random endpoint)"
  - "Ken Burns ON, blur ON, photo date ON, clock OFF, portrait pairs ON as demo defaults"
  - "CTA shows after totalDemoPhotos displays, then stops slideshow and offers restart or sign-up"
  - "SW cache bumped to v1.3 with demo.html in precache and demo photo caching in fetch handler"

patterns-established:
  - "Demo isolation: demo.html fetches only /api/demo/* endpoints, never /api/photo/* or /api/config"

# Metrics
duration: 8min
completed: 2026-02-16
---

# Phase 6 Plan 3: Demo Slideshow Page Summary

**Self-contained demo.html with DEMO badge, one-cycle CTA, all visual effects, and SW cache v1.3**

## Performance

- **Duration:** 8 min
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 2

## Accomplishments
- public/demo.html — fullscreen demo slideshow adapted from slideshow.html with hardcoded demo defaults
- DEMO badge (top-right, glassmorphism style) visible throughout the slideshow
- End-of-demo CTA overlay after one cycle: "That's a taste of Okno" with "Watch again" / "Use your own photos"
- All visual effects functional: Ken Burns zoom/pan, blurred background fill, photo date overlay
- Portrait pairs enabled for demo to showcase the feature
- Service Worker bumped to v1.3 with demo.html precached and demo photo API caching

## Task Commits

1. **Task 1: Create demo.html adapted from slideshow.html** - `e65750a` (feat)
2. **Task 2: Bump SW cache version + add demo.html to precache** - `bc097c8` (chore)
3. **Task 3: Human verification checkpoint** - approved with fix `d16b7a5`

## Files Created/Modified
- `public/demo.html` - Self-contained demo slideshow page (created)
- `public/sw.js` - Cache v1.3, demo.html precache, demo photo caching (modified)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug Fix] One-cycle tracking used unique IDs instead of display count**
- **Found during:** Checkpoint verification (user reported CTA never appeared)
- **Issue:** `onDemoPhotoDisplayed()` tracked unique photo IDs via Set. Random endpoint repeats photos before all are seen (coupon collector's problem), so the Set never reached totalDemoPhotos within a reasonable time
- **Fix:** Changed to simple display counter — CTA triggers after totalDemoPhotos total loads (~96 seconds)
- **Files modified:** public/demo.html
- **Committed in:** d16b7a5

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fixed timing of end-of-demo CTA. No scope creep.

## User Feedback
- Demo lacks interactive UI controls — "not much of an impressive demo" without ways to control or explore settings. Consider adding feature callouts or minimal controls in a follow-up.

## Issues Encountered
- Random photo endpoint serves with replacement, causing coupon collector delay for unique-ID-based tracking

---
*Phase: 06-stripe-+-demo-mode*
*Completed: 2026-02-16*
