# Handoff — WP2: SW bounded photo cache + offline fallback (2026-07-11)

## What
- `public/sw.js` rewritten: random photos (`/api/photo/random`,
  `/api/demo/random`) now cached under stable synthetic keys
  `/__photo/<encoded X-Photo-Id>` instead of the `?t=` cache-busted request
  URL. Cap 50 entries, FIFO by first-cached (`cache.keys()` insertion
  order). On network failure the SW serves a *random* cached photo, so an
  offline frame keeps rotating its last ~50 photos.
- Non-GETs and cross-origin requests bypass the SW entirely (also fixes the
  silent `cache.put(POST)` rejection on hide/unhide).
- Thumbnails/hidden-list keep exact-key network-first caching (stable URLs,
  so exact-match offline fallback works); excluded from cap and random pick
  by the `/__photo/` prefix filter.
- Versions bumped: `okno-v1.7` / `okno-photos-v1.7` (constraint 6).
- New `test/sw.test.js` (3 tests): controlled-page registration; 60 fetches
  → exactly 50 cached; offline fallback via *killing the stub server*
  (`close` + `closeAllConnections`) — NOT Playwright `setOffline`, which
  doesn't apply to SW fetches. `test:ui` now runs both files.

## State
- 12/12 green locally (run by orchestrator). First CI run was RED: node
  --test runs test files in parallel processes, and two concurrent Chromes
  starved the 2-vCPU runner — two timing-sensitive ui-buttons tests failed
  (the 3 new SW tests passed). Fix-up: `--test-concurrency=1` in test:ui so
  files run sequentially. Second CI run green.

## Pending
- Nothing for WP2. Design note: keying by X-Photo-Id chosen over normalized
  URL because all random-photo requests share one path — a normalized-URL
  key would collapse the cache to ~1 entry. Next: WP3 polish batch.
