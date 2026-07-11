# Handoff: Long-run session: WP1-WP8 complete + VPS deploy
**Date:** 2026-07-11
**Session:** All 8 work packages shipped CI-green, ported to okno-staging, deployed live to okno.moonacle.com

---

## What Was Done

Executed `SESSION_PLAN_LONG_RUN_2026-07-11.md` end to end as orchestrator
(sub-agents implemented, orchestrator reviewed every diff and ran every
verification personally). All 8 WPs ticked; per-WP detail lives in the
sibling handoffs (`2026-07-11-wp1-ci.md` … `wp8-docs.md`).

- WP1 CI workflow → WP8 docs: public repo commits `c4641b3..ffd7c81`,
  every one green locally AND on GitHub Actions. Tests 9 → 25
  (ui-buttons 15, sw 3, server smoke 7).
- Notable fixes: SW photo cache bounded at 50 with working offline
  fallback (cache v1.7); rapid-Next generation counter
  (mutation-verified test); hover media queries; paused-Next progress
  bar; fullscreen label; OTD count via /api/health; a11y labels +
  aria-pressed.
- One CI incident: parallel test files starved the 2-vCPU runner →
  `--test-concurrency=1` (0e7fdcf).
- **Deploy (evening):** discovered the VPS pulls from private
  `okno-staging`, which was at initial-release content (missing even the
  morning's touch fixes). Ported all session files → staging commit
  `8539e08` (25/25 green on the ported tree), pushed, deployed via the
  canonical flow (reset server's lockfile mod, pull,
  `npm install --production`, `pm2 restart okno`). Verified live:
  sw.js v1.7, WP3/WP4 markers in served demo.html, login 200 / demo 200 /
  slideshow 302→login. Deploy details: `2026-07-11-deploy-to-vps.md`.

---

## Current State

- okno.moonacle.com is LIVE on today's build — ready for Sam's testing
  tomorrow. iPad picks up the v1.7 SW on next app launch (auto cache
  wipe via the version bump).
- Public repo `samshennan/okno` main = `fadec66`, CI green, tree clean.
- Private `okno-staging` main = `8539e08`, content-identical to public
  for all shared files. Server `.env.production` untouched.
- The two repos' git histories remain UNRELATED (export-public.sh
  generates public from scratch) — see Pending.

## Pending from This Session

- **DECISIONS_FOR_SAM.md #6 (important):** re-running `export-public.sh`
  as-is would wipe the public repo's real history and drop `test/` +
  `.github/` (not in its allowlist). Needs Sam's call; recommendation is
  to make the public repo the source of truth.
- DECISIONS_FOR_SAM.md #1–5 still pending (persist overlay buttons, dual
  Hide semantics, v0.2.1 tag, SW cache cap, demo photo audit).
- Small known issues logged, not fixed: 1500ms cleanup literal vs
  configurable `--transition-time` (mid-fade pop at 2s+); demo.html never
  applies transitionTime; settings makes two /api/health fetches on load.
- Server clutter (harmless, unconfirmed): stray untracked
  `slideshow.html` at the server repo root + two `.env.production.bak-*`
  files — delete next session if Sam confirms.
