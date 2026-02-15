---
phase: 04-bug-fixes-stability
plan: 02
subsystem: slideshow-frontend
tags: [error-handling, retry-logic, on-this-day, dual-mode, 502-recovery]
requires:
  - phase: 01-03
    provides: "slideshow.html with fetchWithRetry, OTD mode, dual portrait mode"
provides:
  - "Resilient slideshow error handling: instant 4xx fallback, 502 proactive recovery, correct dual-mode layout"
affects:
  - "Phase 5 (visual effects) builds on this stable slideshow foundation"
tech-stack:
  added: []
  patterns:
    - "4xx short-circuit in retry logic (intentional errors vs transient failures)"
    - "Fire-and-forget proactive refresh on 502"
    - "Message-stays-until-replacement pattern (no gap between message hide and photo show)"
key-files:
  created: []
  modified:
    - public/slideshow.html
key-decisions:
  - "502 refresh triggered inside fetchWithRetry on first attempt, not in createPhotoElement -- keeps recovery logic centralized"
  - "OTD fallback loads random photo immediately instead of waiting 5 seconds -- message hides when photo appears"
  - "Landscape in dual mode flushes pending portrait as single before showing landscape as single -- no photo waste"
duration: 3min
completed: 2026-02-15
---

# Phase 4 Plan 02: Slideshow Error Handling Summary

**4xx instant fallback, 502 proactive recovery, OTD indicator timing, dual-mode landscape layout -- four bugs fixed in one file**

## Performance

- **Duration:** ~3 minutes
- **Tasks:** 2/2 completed
- **Files modified:** 1

## Accomplishments

### BUGFIX-03: fetchWithRetry 404 short-circuit + OTD fallback timing
- `fetchWithRetry()` now returns 4xx responses immediately without retry (was retrying 7 times causing 10+ second delay)
- On This Day "no photos" message stays visible until first random photo actually loads (removed 5-second auto-hide timeout)
- `showSinglePhoto()` hides the OTD message when the fallback photo appears -- no black screen gap

### BUGFIX-04: Calendar indicator shows immediately
- On This Day calendar indicator (top-left) now appears in `init()` as soon as config loads, before any photo fetch
- Shows today's date (e.g. "Feb 15") immediately; `updateOnThisDayIndicator()` still updates with photo-specific year info after load

### BUGFIX-05: 502 proactive baseUrl recovery (frontend)
- First 502 response in `fetchWithRetry()` triggers fire-and-forget POST to `/api/health/refresh`
- Refresh happens in background while retry logic continues normally
- Next slideshow cycle benefits from refreshed base URLs

### BUGFIX-06: Landscape photos in dual mode
- Landscape photos in dual mode now display as full-width singles via explicit `else if` branch
- Pending portrait photos flushed (shown as singles) when landscape arrives -- no photos discarded

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | fetchWithRetry + OTD fallback + 502 recovery | `c5194e4` | 4xx short-circuit, OTD message persistence, 502 refresh trigger |
| 2 | Calendar indicator timing + dual landscape | `b95e80f` | Init-time OTD indicator, landscape-as-single in dual mode |

## Files Created/Modified

### Modified
- **public/slideshow.html** -- `fetchWithRetry()`, `createPhotoElement()`, `showSinglePhoto()`, `showOnThisDayMessage()`, `init()`, `loadPhoto()` dual mode branch

## Decisions Made

1. **502 refresh in fetchWithRetry, not createPhotoElement** -- Keeps all retry/recovery logic centralized in one function. The 502 triggers refresh on first attempt only (not every retry), then normal retry backoff continues.

2. **OTD fallback loads photo immediately** -- Previous behavior waited 5 seconds (auto-hide message, then load). Now `loadPhoto()` is called immediately when 404 detected, and the message stays visible until `showSinglePhoto()` hides it. Zero wasted time.

3. **Dual mode landscape flushes pending portrait** -- When a landscape photo arrives in dual mode and there's a pending portrait waiting for a pair, the portrait is shown as a single first, then the landscape is shown as a single. No photos are discarded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OTD fallback 404 handling moved from catch to response check**
- **Found during:** Task 1
- **Issue:** Plan described handling 404 in the catch block, but with the 4xx short-circuit, 404 is now returned as a response (not thrown). The OTD fallback logic needed to move from `catch(err)` to a `response.status` check after `fetchWithRetry` returns.
- **Fix:** Added `if (response.status >= 400 && response.status < 500)` check in `createPhotoElement()` with OTD-specific handling inside
- **Files modified:** public/slideshow.html
- **Commit:** c5194e4

**2. [Rule 2 - Missing Critical] 502 refresh placed in fetchWithRetry instead of createPhotoElement**
- **Found during:** Task 1
- **Issue:** Plan placed 502 detection in `createPhotoElement()`, but since fetchWithRetry retries 5xx errors, a 502 response is never returned to the caller -- it's retried and eventually thrown. Placing 502 detection in fetchWithRetry is the correct location.
- **Fix:** Added 502 detection with `/api/health/refresh` POST inside fetchWithRetry on first attempt
- **Files modified:** public/slideshow.html
- **Commit:** c5194e4

## Issues Encountered

None -- all changes applied cleanly.

## Next Phase Readiness

- All four slideshow bugs fixed (BUGFIX-03, 04, 05 frontend, 06)
- BUGFIX-05 backend part (if any) would be in a separate plan
- slideshow.html is now resilient to: 404 (instant fallback), 502 (proactive refresh), network errors (exponential backoff), landscape in dual mode (full-width single)
- Ready for Phase 5 visual effects to build on stable slideshow foundation
