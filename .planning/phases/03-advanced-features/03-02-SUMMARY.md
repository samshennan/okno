---
phase: 03-advanced-features
plan: 02
status: complete
started: 2026-02-13T22:50:06Z
completed: 2026-02-13T22:52:24Z
subsystem: slideshow-features
tags: [on-this-day, memories, photo-filter, date-matching]
dependency-graph:
  requires: [03-01]
  provides: [on-this-day-mode]
  affects: []
tech-stack:
  added: []
  patterns: [date-based-filtering, feature-toggle-pattern, graceful-fallback]
key-files:
  created: []
  modified: [photo-cache.js, photo-proxy.js, public/slideshow.html, public/settings.html]
decisions:
  - Server-side date filtering using createTime ISO 8601 parsing
  - 404 response for no matching photos with structured error JSON
  - 5-second fallback to random mode when no On This Day photos exist
  - Calendar-heart indicator always visible during OTD mode (not tied to controls visibility)
metrics:
  duration: ~2 minutes
  completed: 2026-02-13
---

# Phase 3 Plan 2: On This Day Mode Summary

Server-side date filtering with createTime matching, 404 fallback to random, and calendar-heart indicator showing photo year.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add On This Day filter to photo-cache.js | 6f0a27b | photo-cache.js |
| 2 | Add On This Day query parameter to photo-proxy.js | 6315b5c | photo-proxy.js |
| 3 | Integrate On This Day into slideshow frontend | 5bcecc8 | public/slideshow.html |
| 4 | Enable On This Day toggle on settings page | d7f9684 | public/settings.html |

## Deliverables

- `getRandomOnThisDayItem()` and `getOnThisDayCount()` functions in photo-cache.js filter mediaItems by today's month+day
- `GET /api/photo/random?onThisDay=true` returns matching photo or 404 with `no_photos_today` error
- `X-Photo-OnThisDay` and `X-Photo-OnThisDayCount` response headers for frontend use
- Slideshow reads `onThisDay` from appConfig and appends query param to photo fetch
- Calendar-heart indicator in top-left corner shows formatted date (e.g., "Feb 13, 2019 (5 photos)")
- Fallback overlay message "No photos from today in history" with 5-second auto-switch to random
- Settings page On This Day toggle is enabled (no longer Coming Soon) with live photo count display

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Server-side date filtering via createTime | createTime is already stored in cache; no additional API calls needed |
| 404 for no matching photos (not 200 with empty) | Distinct status allows frontend to detect and handle gracefully |
| 5-second fallback delay | Enough time to read the "no photos" message before switching to random |
| Calendar-heart indicator always visible in OTD mode | Provides constant context that memories mode is active |
| Photo count fetched via actual photo request headers | Reuses existing endpoint; no new API needed |

## Deviations from Plan

None - plan executed exactly as written.

## Issues

None.

## Next Phase Readiness

- On This Day feature is fully functional end-to-end
- Settings toggle persists via existing config.json mechanism
- Ready for 03-03 (Portrait Pairs) which follows the same toggle pattern
