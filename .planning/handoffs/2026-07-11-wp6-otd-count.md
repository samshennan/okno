# Handoff — WP6: OTD count via health (2026-07-11)

## What
- `health.js`: `cache.onThisDayCount` added to both payload branches
  (0 in the no-userId fallback; `photoCache.getOnThisDayCount(userId)` —
  already exported, cheap in-memory filter — in the auth branch).
- `settings.html` `fetchOnThisDayCount()` now reads `/api/health` instead
  of downloading a full-res photo for the `X-Photo-OnThisDayCount` header.
  Copy preserved: `N photo(s) from today across all years`, and the old
  404 branch became `count === 0` → 'No photos from today in your
  library'. Count is now a number (was a header string).
- Stub health gained `onThisDayCount: 7`; new UI test asserts the settings
  page renders the count from health AND makes zero `/api/photo/random`
  requests during load (via the stub request log, reset first).
- Slideshow's per-photo header path untouched (it already downloads the
  photo, so the header is free there).

## State
- 24/24 green locally ×3 (2 agent + 1 orchestrator). CI watched after push.

## Deviations from plan
- Plan wanted the server smoke test to assert the new field; /api/health
  is auth-gated (401 unauthenticated) so that's unreachable without real
  OAuth — coverage lives in the stub-driven UI test instead, mirroring how
  portraitCount is (un)covered server-side.

## Pending
- Nothing for WP6. Next: WP7 a11y pass (scout in flight at handoff time).
