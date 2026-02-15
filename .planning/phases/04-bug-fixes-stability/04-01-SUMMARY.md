---
phase: 04-bug-fixes-stability
plan: 01
subsystem: photo-management
tags: [cache, merge, dedup, countdown, picker, session, timer]
requires:
  - phase: 01-03
    provides: "photo-cache.js with setItems() and Picker integration"
  - phase: 01-03
    provides: "index.html with openPicker() and polling flow"
provides:
  - "Merge-based photo cache that preserves selections across Picker sessions"
  - "Visible countdown timer during Picker sessions with expiry warning"
affects:
  - phase: 04-02
    note: "Cache merge changes how items accumulate -- verify refresh logic still works"
  - phase: 05
    note: "Countdown timer styling may need visual polish to match new effects"
tech-stack:
  added: []
  patterns:
    - "Set-based dedup for O(1) merge lookups"
    - "Inline countdown with interval cleanup pattern"
key-files:
  created: []
  modified:
    - "photo-cache.js"
    - "public/index.html"
key-decisions:
  - "setItems() always merges (no replace mode parameter) -- merge is always correct behavior"
  - "sessionId updates to latest on merge -- older session items lose baseUrl refresh but frontend retry handles it"
  - "Countdown uses inline styles matching existing index.html pattern (no separate CSS)"
  - "clearPickerCountdown() called at all exit paths (6 call sites) to prevent memory leaks"
duration: 2min
completed: 2026-02-15
---

# Phase 4 Plan 01: Picker Merge + Countdown Summary

**Set-based dedup merge for photo cache and live countdown timer for Picker session expiry**

## Performance

- Duration: ~2 minutes
- Tasks: 2/2 completed
- No blockers encountered

## Accomplishments

### BUGFIX-01: Picker Batch Merge

The `setItems()` function in `photo-cache.js` previously replaced the entire `cache.mediaItems` array on every Picker session completion. Users who opened a second Picker session to add more photos would lose all photos from the first session.

**Fix:** `setItems()` now builds a `Set` of existing item IDs for O(1) lookup, filters incoming items to exclude duplicates, and appends only new items. The function logs merge statistics (new items added, duplicates skipped, total count) for operational visibility.

The `sessionId` is always updated to the latest session, which means only the most recent session's items can have their baseUrls refreshed. Items from older sessions will have stale baseUrls after 60 minutes -- this is an accepted limitation documented in research, and the frontend retry logic handles it gracefully.

### BUGFIX-02: Picker Session Countdown Timer

The Picker session has a server-defined timeout (typically 600 seconds). Previously, users had no visibility into when the session would expire, leading to silent timeouts that wasted user effort.

**Fix:** A `startPickerCountdown()` function parses the `data.timeout` string from the backend, creates a countdown element showing "Session expires in M:SS", and updates every second. In the final 60 seconds the text turns red and bold as a visual warning. When the timer hits zero, it displays "Session expired. Please start a new session."

The countdown is wired into both mobile (iPad/tab) and desktop (popup) Picker flows. A `clearPickerCountdown()` helper ensures cleanup at all exit paths: session success, error, cancel, new session start, and natural expiry.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix Picker batch merge in photo-cache.js | `ee6fb70` | photo-cache.js |
| 2 | Add Picker session countdown timer | `a5e0f64` | public/index.html |

## Files Created/Modified

### Modified

- **photo-cache.js** -- `setItems()` rewritten from replace to merge with Set-based dedup (+15 lines, -2 lines)
- **public/index.html** -- Added `startPickerCountdown()`, `clearPickerCountdown()`, wired into picker flow, cleanup at all exit paths (+79 lines)

## Decisions Made

1. **Merge-only mode (no replace parameter):** The plan explicitly stated not to add a "replace mode" parameter. Merge is always correct -- there is no scenario where replacing is desired now that multi-session workflows are supported.

2. **SessionId always updates to latest:** Intentional design choice. Only the latest Picker session's items can have baseUrls refreshed via the Google API. Older items degrade after 60 minutes but the frontend proxy retry logic handles this.

3. **Inline styles for countdown:** Matches the existing pattern in index.html where all styles are inline or in the `<style>` block. No separate CSS file introduced.

4. **Six cleanup call sites:** `clearPickerCountdown()` is called at: (a) start of openPicker (new session), (b) openPicker error catch, (c) startPolling window-closed detection, (d) startPolling error catch, (e) start of checkPickerComplete, (f) timer self-cleanup on expiry. This prevents any interval leaks.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- **Ready for 04-02:** Cache merge changes are backward-compatible. The `refreshBaseUrls()` function still works because it matches by ID and updates in-place.
- **No new dependencies added:** Both changes are pure logic/UI additions with no new packages.
- **Testing note:** The merge logic should be validated with a real multi-session workflow on the deployed instance. The countdown timer should be visually verified on iPad.
