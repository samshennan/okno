---
phase: 05-visual-effects-+-overlays
plan: 02
subsystem: ui
tags: [ken-burns, css-animations, gpu-optimization, accessibility, prefers-reduced-motion]

# Dependency graph
requires:
  - phase: 05-01
    provides: "kenBurns config key + settings toggle, loadAppConfig reads /api/config"
provides:
  - "Ken Burns cinematic zoom/pan effect on slideshow photos"
  - "6 cycling animation presets (zoom-in, zoom-out, drift)"
  - "Sequential transition choreography (stop old -> crossfade -> start new)"
  - "GPU-safe teardownAndRemove() function for element cleanup"
  - "prefers-reduced-motion accessibility support (CSS + JS)"
  - "Independent Ken Burns on dual portrait photos"
affects: ["05-03", "blurred-background"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sequential animation choreography to limit GPU layer count"
    - "teardownAndRemove() pattern for GPU-safe element cleanup"
    - "CSS keyframe presets cycled via JS (not random) to prevent repetition"

key-files:
  created: []
  modified:
    - "public/slideshow.html"

key-decisions:
  - "8% max zoom scale (1.0 to 1.08) for subtle, cinematic feel"
  - "100ms delay before Ken Burns start so crossfade begins first"
  - "Animation duration matches slideshow interval for complete motion arc"
  - "teardownAndRemove replaces ad-hoc blob revocation + element.remove"

patterns-established:
  - "Sequential choreography: stop old animation -> crossfade -> start new animation"
  - "GPU teardown: animation none -> transform none -> willChange auto -> revoke -> remove"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 5 Plan 2: Ken Burns Effect Summary

**6-preset Ken Burns cinematic zoom/pan with sequential transition choreography, GPU teardown, and prefers-reduced-motion support**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T13:01:50Z
- **Completed:** 2026-02-15T13:04:38Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Ken Burns effect with 6 presets (zoom-in center/TL/BR, zoom-out center, drift left/right) cycling without repeats
- Sequential transition choreography: stop old KB -> crossfade -> cleanup old -> start new KB (max 2 GPU layers)
- GPU-safe `teardownAndRemove()` function replaces all ad-hoc cleanup (animation stop + transform reset + layer de-promote + blob revoke + DOM remove)
- Full prefers-reduced-motion support: CSS `!important` override + JS runtime listener stops animations immediately
- Config toggle: `kenBurns: false` disables effect entirely via loadAppConfig()
- Independent Ken Burns on each portrait in dual mode (different presets for visual variety)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Ken Burns CSS keyframes and base styles** - `15290dd` (feat)
2. **Task 2: Add Ken Burns JS logic with transition choreography** - `028f16e` (feat)

## Files Created/Modified
- `public/slideshow.html` - Added 6 KB keyframe animations, .kenburns class, reduced-motion override, overflow hidden on #slideshow; Added KB state vars, helper functions, teardownAndRemove, reduced-motion listener, config reading; Replaced showSinglePhoto and showDualPortraits with choreographed versions

## Decisions Made
- 8% max zoom (scale 1.08) chosen for subtle cinematic feel without noticeable distortion
- 100ms delay before applying Ken Burns after crossfade starts -- lets opacity transition begin first for deliberate, cinematic feel
- Animation duration set to `currentIntervalSeconds` so each photo completes its full motion arc
- `teardownAndRemove()` consolidates all cleanup into one function (replaces 3 separate ad-hoc cleanup blocks)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ken Burns foundation complete, ready for Plan 03 (blurred background + overlays)
- `teardownAndRemove()` available for future cleanup needs
- GPU budget stays within 2 layers during transitions -- safe for blurred background addition in Plan 03

---
*Phase: 05-visual-effects-+-overlays*
*Completed: 2026-02-15*
