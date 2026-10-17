---
phase: 06-stripe-+-demo-mode
plan: 02
subsystem: api
tags: [express, sharp, demo-mode, photo-serving, unsplash]

# Dependency graph
requires:
  - phase: 05-visual-effects-+-overlays
    provides: Visual effects (Ken Burns, blur, overlays) that demo will showcase
provides:
  - Express router serving random demo photos at /api/demo/random
  - Demo health endpoint at /api/demo/health
  - 12 optimized sample photos in public/demo/
  - manifest.json with fake EXIF dates spanning 2019-2024
  - Optimization script for re-processing demo originals
affects: [06-03-PLAN (demo slideshow page needs these endpoints)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Isolated Express router pattern: demo-photos.js has zero imports from auth/cache/proxy"
    - "Slot-based photo optimization: script matches originals by slot number, fills gaps with placeholders"

key-files:
  created:
    - demo-photos.js
    - public/demo/manifest.json
    - public/demo/photo-01.jpg through photo-12.jpg
    - scripts/optimize-demo-photos.js
  modified:
    - server.js
    - .gitignore

key-decisions:
  - "10 real Unsplash photos + 2 portrait placeholders (flower close-up, architectural doorway)"
  - "Placeholder photos use SVG-based gradient generation with sharp for visual distinction"
  - "5 portrait photos total (3 real Unsplash + 2 placeholder) exceeds the 4 minimum"

patterns-established:
  - "Demo isolation: demo-photos.js never touches auth.js, photo-cache.js, photo-proxy.js, or config.js"
  - "Response header parity: X-Photo-Id, X-Photo-CreateTime, X-Photo-IsPortrait match real proxy format"

# Metrics
duration: 6min
completed: 2026-02-15
---

# Phase 6 Plan 2: Demo Backend Summary

**Express router serving 12 optimized demo photos with isolation from auth stack, 10 real Unsplash photos + 2 portrait placeholders, manifest with dates spanning 2019-2024**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-15T17:26:46Z
- **Completed:** 2026-02-15T17:32:50Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- 12 demo photos sourced (10 from Unsplash, 2 portrait placeholders), optimized to 3.0MB total
- demo-photos.js Express router with /random and /health endpoints, fully isolated from auth stack
- Routes mounted in server.js at /api/demo with /demo route for future demo.html
- Optimization script supports re-processing when real photos are added to demo-originals/

## Task Commits

Each task was committed atomically:

1. **Task 1: Source and optimize demo photos** - `3ca21fe` (feat)
2. **Task 2: Create demo-photos.js router and mount in server.js** - `3a909cc` (feat)

## Files Created/Modified
- `demo-photos.js` - Express router for /api/demo/random and /api/demo/health
- `public/demo/manifest.json` - Metadata for 12 demo photos (id, createTime, dimensions, description)
- `public/demo/photo-01.jpg` through `photo-12.jpg` - Optimized demo photos (7 landscape, 5 portrait)
- `scripts/optimize-demo-photos.js` - Reads originals, resizes to 2048px, generates manifest
- `server.js` - Added demo router mount and /demo route
- `.gitignore` - Added demo-originals/ exclusion

## Decisions Made
- Used Unsplash download URLs (royalty-free, no API key needed) for 10 of 12 photos; 2 portrait slots got placeholders because suitable portrait Unsplash photos returned 404
- Placeholder photos use SVG gradient + text overlay rendered via sharp, visually distinguishable by color and description text
- Photo 04 (autumn forest) turned out to be portrait from Unsplash, giving 3 real portrait photos + 2 portrait placeholders = 5 total (exceeds the 4 minimum)
- Cache-Control set to `public, max-age=3600` for demo photos (aggressive caching since they never change)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rewrote optimization script for slot-based matching**
- **Found during:** Task 1 (running optimization with gaps in original files)
- **Issue:** Original script processed files sequentially, but 2 originals were missing (slots 09, 10), causing misalignment between photo numbers and metadata
- **Fix:** Rewrote to match originals by slot number (`original-09.jpg` maps to `photo-09.jpg`) and generate placeholders only for missing slots
- **Files modified:** scripts/optimize-demo-photos.js
- **Verification:** All 12 photos generated with correct metadata mapping
- **Committed in:** 3ca21fe (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Script rewrite was necessary to handle partial Unsplash downloads correctly. No scope creep.

## Issues Encountered
- 3 of 12 Unsplash photo IDs returned 404 (photos may have been removed); resolved by trying alternate IDs and using placeholders for remaining gaps
- zsh array syntax incompatibility in batch download script; resolved by using individual function calls

## Next Phase Readiness
- Demo backend is ready for Plan 03 (demo.html slideshow page)
- /api/demo/random returns photos with headers matching the real photo proxy format
- /api/demo/health returns the structure expected by slideshow init
- /demo route registered, waiting for demo.html to be created in Plan 03

---
*Phase: 06-stripe-+-demo-mode*
*Completed: 2026-02-15*
