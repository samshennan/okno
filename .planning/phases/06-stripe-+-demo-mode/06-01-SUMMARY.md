---
phase: 06-stripe-+-demo-mode
plan: 01
subsystem: frontend
tags: [stripe, donation, demo-entry, settings, home-page]

# Dependency graph
requires:
  - phase: 05-visual-effects-+-overlays
    provides: Visual effects that demo mode will showcase
provides:
  - Stripe Payment Link donate button on settings page (auth-gated)
  - "Try Demo" entry point on home page for unauthenticated visitors
  - Cleaned package.json (removed unused stripe npm package)
affects: [06-03-PLAN (demo.html needs /demo route entry point)]

# Tech tracking
tech-stack:
  removed: [stripe (npm package)]
  patterns:
    - "Auth-gated UI: fetch /auth/status to conditionally show donate section"
    - "Stripe Payment Links: no backend SDK needed, just a URL"

key-files:
  modified:
    - public/settings.html
    - public/index.html
    - package.json
    - package-lock.json

key-decisions:
  - "Stripe Payment Link (URL) instead of Stripe SDK -- no backend code needed"
  - "Donate section hidden by default, shown via /auth/status check"
  - "Try Demo button uses existing .secondary button style for consistency"
  - "Also fixed pre-existing PayPal donation link in feedback modal to use Stripe"

patterns-established:
  - "Auth-gated sections: fetch /auth/status, show/hide based on response"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 6 Plan 1: Stripe Donate + Try Demo Summary

**Stripe Payment Link donate button on settings page (auth-gated), "Try Demo" entry point on home page, removed unused stripe npm package, fixed PayPal link in feedback modal**

## Performance

- **Duration:** 5 min
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 4

## Accomplishments
- "Support Okno" section on settings page with "Buy me a coffee" text and warm amber donate button, visible only to authenticated users
- "Try Demo" button on home page below "Sign in with Google" for unauthenticated visitors, linking to /demo
- Removed unused `stripe` npm package (leftover from reverted subscription code)
- Fixed pre-existing PayPal donation in feedback modal to use Stripe Payment Link

## Task Commits

1. **Task 1: Add Stripe donate section + remove stripe npm package** - `32d5333` (feat)
2. **Task 2: Add "Try Demo" button to home page** - `4d42e43` (feat)
3. **Orchestrator fix: Replace PayPal with Stripe in feedback modal** - `a5403bd` (fix)

## Files Modified
- `public/settings.html` - Added "Support Okno" section with Stripe Payment Link and auth check
- `public/index.html` - Added "Try Demo" button, fixed PayPal donation to Stripe in feedback modal
- `package.json` - Removed stripe dependency
- `package-lock.json` - Updated lockfile

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug Fix] Pre-existing PayPal donation link in feedback modal**
- **Found during:** Checkpoint verification (user reported seeing PayPal button)
- **Issue:** index.html feedback modal had a "Support Us" option linking to a non-functional PayPal page
- **Fix:** Replaced PayPal URL with Stripe Payment Link, updated text to match "buy me a coffee" tone
- **Files modified:** public/index.html
- **Committed in:** a5403bd

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Discovered and fixed pre-existing broken PayPal link. No scope creep.

## Issues Encountered
- Pre-existing PayPal donation in feedback modal was not in the plan scope but was broken and confusing to users

## Next Phase Readiness
- Settings page donate section ready (placeholder URL needs real Stripe Payment Link)
- /demo entry point ready for demo.html (Plan 03)

---
*Phase: 06-stripe-+-demo-mode*
*Completed: 2026-02-15*
