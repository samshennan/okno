# Handoff — WP5: real-server smoke tests (2026-07-11)

## What
- New `test/server.test.js` (7 tests): spawns the real `node server.js`
  (dummy OAuth env, NODE_ENV deleted, random port 3800–4799 with
  EADDRINUSE retry, readiness = winston "Server listening on port" line,
  plus a warm-up poll — first loopback connection on Windows can time out).
  Asserts: /login 200 HTML; / and /slideshow.html 302→/login; /api/config
  401 `{error:'authentication_required'}`; /demo 200; /api/demo/health ok +
  integer totalItems>0 (count not pinned); /vendor/lucide.min.js 200.
- Child cwd = os.tmpdir scratch, so CWD-relative `logs/` never touches the
  repo. The SQLite DB path is HARDCODED to `<repo>/data/okno.db` (no
  override exists) — after() cleanup is strictly conditional: whole `data/`
  removed only if it didn't pre-exist; just the db trio if only the db is
  new; NOTHING touched if okno.db pre-existed (could be real user data).
- `npm test` added (explicit file list — `node --test test/` would execute
  stub-server.js as a test and hang). `test:ui` kept for the browser loop.
- CI workflow step: `npm run test:ui` → `npm test`.

## State
- 23/23 green locally ×3 (2 agent + 1 orchestrator), no repo artifacts
  left behind. CI watched after push.

## Pending
- Nothing for WP5. Next: WP6 (OTD count via health) — scout report done:
  `getOnThisDayCount` exported+cheap in photo-cache.js; add
  `cache.onThisDayCount` in both health.js branches; repoint
  settings.html `fetchOnThisDayCount()` to /api/health (string→number
  quirk in singular/plural copy); extend stub health.
