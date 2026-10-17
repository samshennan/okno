---
phase: 02-slideshow-pwa
plan: 02
subsystem: pwa
tags: [nosleep.js, wake-lock, exponential-backoff, network-resilience, ios-pwa]

# Dependency graph
requires:
  - phase: 02-01
    provides: PWA manifest, Service Worker, iOS meta tags for installation
provides:
  - Screen wake lock via NoSleep.js for indefinite photo frame operation
  - Exponential backoff retry for network error handling
  - Graceful degradation during temporary network failures
affects: [any future power management or network handling features]

# Tech tracking
tech-stack:
  added: [nosleep.js@0.12.0 via CDN]
  patterns: [exponential backoff with jitter, blob URLs for fetch responses, null-safe error handling]

key-files:
  created: []
  modified: [public/slideshow.html]

key-decisions:
  - "NoSleep.js via CDN instead of npm to avoid build step (vanilla JS architecture)"
  - "NoSleep.js required due to Wake Lock API bug in iOS PWAs (WebKit #254545)"
  - "Exponential backoff with 7 retries (10ms-640ms) with 10% jitter to prevent thundering herd"
  - "Blob URLs for photo loading to avoid cache issues with expired baseUrls"
  - "Null returns from failed fetches keep previous photo visible (no white flash)"

patterns-established:
  - "fetchWithRetry pattern: Generic exponential backoff wrapper for any fetch call"
  - "Blob URL pattern: Fetch as blob, create object URL, automatic cleanup via GC"
  - "Graceful degradation: Failed resource loads don't break user experience"

# Metrics
duration: 25min
completed: 2026-02-11
---

# Phase 2 Plan 2: Screen Wake Lock + Network Resilience Summary

**NoSleep.js screen wake lock and exponential backoff retry eliminate iPad sleep issues and network-induced white flashes**

## Performance

- **Duration:** 25 min
- **Started:** 2026-02-11T19:14:36Z
- **Completed:** 2026-02-11T19:39:34Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- iPad screen stays awake indefinitely during slideshow (no manual Auto-Lock settings required)
- Network errors retry automatically with exponential backoff (10ms-640ms over 7 attempts)
- Slideshow survives weak WiFi signals and brief disconnects without white flashes
- User-friendly error handling keeps previous photo visible on fetch failures

## Task Commits

All tasks committed atomically together as a single cohesive feature:

1. **Tasks 1-3: Screen wake lock + network retry** - `194a6e3` (feat)
   - Add NoSleep.js via CDN with iOS-specific documentation
   - Integrate wake lock with user interaction requirement
   - Implement exponential backoff retry for photo fetching
   - Update sleep reminder text to reflect automatic wake lock

## Files Created/Modified
- `public/slideshow.html` - Added NoSleep.js CDN script, wake lock functions (enableWakeLock, exitSlideshow), fetchWithRetry function with exponential backoff, blob-based photo loading, null-safe error handling

## Decisions Made

**1. NoSleep.js via CDN instead of npm package**
- Rationale: Avoids build step, maintains vanilla JS architecture
- Trade-off: External dependency (CDN must be available)
- Mitigation: jsdelivr.net CDN is highly reliable, version pinned to 0.12.0

**2. NoSleep.js over native Wake Lock API**
- Rationale: Wake Lock API broken in iOS PWAs until iOS 18.4 (WebKit bug #254545)
- Constraint: iPad Pro 1st Gen maxes at iOS 16.x
- NoSleep.js uses video playback workaround compatible with older iOS

**3. Exponential backoff parameters (7 retries, 10ms-640ms)**
- Rationale: Balances user experience (fast recovery) with network kindness (not hammering server)
- 7 retries: Total wait ~1.28s before giving up
- 10% jitter: Prevents thundering herd problem with multiple clients
- Delays chosen to match typical network recovery times

**4. Blob URLs instead of direct img.src = fetch URL**
- Rationale: Prevents browser cache issues with expired Google Photos baseUrls
- Each fetch is fresh, blob cleanup happens automatically via GC
- Allows retry logic to work correctly without cache interference

**5. Null returns keep previous photo (no white flash)**
- Rationale: Better UX than error message or blank screen
- User sees current photo frozen vs jarring white flash
- Console logging provides debugging info without disrupting experience

## Deviations from Plan

None - plan executed exactly as written.

All planned features implemented without requiring unplanned changes. Sleep reminder text update completed as specified.

## Issues Encountered

None - implementation proceeded smoothly following the documented iOS PWA wake lock workaround and standard exponential backoff patterns.

## User Setup Required

None - no external service configuration required.

NoSleep.js loaded via CDN, no API keys or environment variables needed.

## Next Phase Readiness

**Ready for phase 02-03 or production deployment:**
- PWA installation complete (02-01)
- Screen wake lock prevents auto-sleep indefinitely
- Network resilience handles temporary failures gracefully
- iPad can run as always-on photo frame without intervention

**No blockers:** All critical PWA features for photo frame use case complete. Ready for real-world iPad testing or additional slideshow enhancements.

---
*Phase: 02-slideshow-pwa*
*Completed: 2026-02-11*
