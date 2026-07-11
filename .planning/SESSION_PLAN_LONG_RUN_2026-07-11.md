# Okno long-run build session — orchestrator plan (2026-07-11)

**Mission:** take okno from "initial public release + touch fixes" to a
hardened v0.2.x: CI on every push, a service worker that actually works
offline, the confirmed-but-unfixed edge bugs closed, real-server test
coverage, and a11y/docs polish — with Claude as orchestrator and sub-agents
doing the hands-on work, until session limits end the run. Zero Sam input
required; everything that needs him is parked in
`.planning/DECISIONS_FOR_SAM.md`.

**Resume rule (read this first in a fresh session):** find the first work
package below whose checkbox is unticked, verify the repo is green
(`git status` clean + `npm run test:ui` passes), and continue from there.
Every WP ends in a committed, pushed, green state — if the tree is dirty on
resume, the previous session died mid-WP: read the newest handoff in
`.planning/handoffs/`, finish or revert to green, then proceed.

**Context for a cold start:** okno is a self-hosted Google Photos digital
frame (Express + vanilla-JS HTML pages in `public/`, primary target iPad
Safari PWA). On 2026-07-11 we fixed a class of touch bugs (body `touchend`
`preventDefault()` was swallowing button clicks) and built
`test/ui-buttons.test.js` + `test/stub-server.js` (9 tests, `npm run
test:ui`, playwright-core against system Chrome/Edge). The WPs below are the
backlog that session identified but did not fix.

---

## Standing constraints (non-negotiable)

1. **Vanilla stack stays.** Inline-scripted HTML pages, no frameworks, no
   build step, no new runtime dependencies. Vendored libs live in
   `public/vendor/`. Dev-only deps are allowed (playwright-core precedent).
2. **iPad Safari PWA is the primary target.** Every UI change passes the
   touch suite. Never `preventDefault()` a tap that lands on (or inside) a
   button — that's the bug class this plan exists to prevent.
3. **`npm run test:ui` green before every commit.** Test count only goes up.
   The orchestrator runs it personally; a sub-agent's "it passes" is a claim,
   not evidence.
4. **CSP lives in `server.js` (helmet).** Inline handlers work because of
   `script-src-attr 'unsafe-inline'` — keep the CSP in sync with any UI
   pattern change; never silently widen it.
5. **Public repo hygiene.** No secrets, no real photos, no `.env`, no
   session/db artifacts. Placeholder images only (the `TINY_JPEG` in the stub).
6. **Bump `CACHE_VERSION`/`PHOTO_CACHE` in `public/sw.js` on any sw.js
   change** or clients keep the old worker's caches.
7. **Commits go straight to `main`** (single-dev repo, that is the existing
   convention) and are pushed immediately after each WP.

## Orchestrator protocol (how I manage my own context)

- **Delegate reading, keep judgment.** Explore agents do file-heavy discovery
  and report seams; general-purpose agents draft implementations for disjoint
  files. The orchestrator reviews every diff, runs verification itself, and
  writes the commits.
- **One WP in flight at a time**, in the order below (they're
  dependency-ordered). Within a WP, parallel sub-agents on disjoint files are
  fine.
- **Atomic checkpoints:** after each WP → run its verification block → tick
  the WP's checkbox in this doc and write the handoff
  `.planning/handoffs/<today's date>-<wp-slug>.md` (what/state/pending,
  ≤30 lines) → commit everything together (message given per WP) → push.
  Never amend after pushing. Nothing is ever lost to a context death.
- **Context budget:** when the window gets heavy, checkpoint (handoff + push)
  rather than pressing on. This doc is the resume artifact, not the
  conversation. Prefer finishing the current WP over starting the next.
- **Failure rule:** if a WP's verification fails twice after honest attempts,
  revert to green, log it as blocked in the WP's handoff, move to the next WP.
- **CI is the second witness:** from WP1 onward, after every push check
  `gh run list --limit 1` / `gh run watch` and treat a red run as a failed
  verification even if local tests passed.

---

## Work packages

### [x] WP1 — CI: the suite runs on every push
*Small, do first — it protects every WP after it.*

- `.github/workflows/test.yml`: on push + PR, ubuntu-latest,
  `actions/checkout` → `actions/setup-node` (node 22, cache npm) → `npm ci`
  → `npm run test:ui`. GitHub runners ship Chrome, which the suite's
  `channel: 'chrome'` launcher finds; if that proves false, add a step
  `npx playwright install chromium --with-deps` and let the bundled-browser
  fallback in `launchBrowser()` take over.
- Do NOT add a linter (none is configured; introducing one is scope creep).
- **Verify:** push, then `gh run watch` → workflow green on GitHub's runner.
- **Commit:** `ci: run UI button regression suite on every push`

### [x] WP2 — Service worker photo cache: bounded, and offline actually works
*The worst standing bug: `?t=Date.now()` cache-busters mean every photo ever
shown is cached under a unique key — unbounded storage on a 24/7 frame — and
`caches.match(request)` never hits, so the offline fallback is dead code.*

- Sub-agent A (Explore): map `public/sw.js` + the fetch paths in
  `slideshow.html`/`demo.html` (which URLs, which headers). Report only.
- Design (orchestrator reviews before code): keep a **capped photo cache**
  (50 entries, see DECISIONS_FOR_SAM #4) keyed by a normalized URL or the
  `X-Photo-Id` header, not the busted URL. On successful fetch: put + evict
  oldest beyond cap (`cache.keys()` is insertion-ordered). On network
  failure for a photo request: respond with a **random cached photo** — an
  offline frame keeps rotating its last ~50 photos instead of freezing.
- Bump both cache version constants.
- Tests (extend `test/ui-buttons.test.js` or a new `test/sw.test.js` using
  the same stub): after N>cap photo loads, cache entry count ≤ cap; flip the
  Playwright context offline → next photo still renders. Gotcha: the FIRST
  page load is not SW-controlled even with `clients.claim()` racing in —
  register, wait for `navigator.serviceWorker.ready`, then reload before
  asserting anything about caching. If the offline
  assertion is flaky on CI runners, gate it to local runs
  (`process.env.CI ? test.skip : test`) and say so in the handoff — a flaky
  guard is worse than a narrower one.
- **Verify:** `npm run test:ui` green locally AND in CI.
- **Commit:** `fix(sw): bounded photo cache with working offline fallback`

### [x] WP3 — Slideshow polish batch (small confirmed bugs, capped list)
*Exactly these four; resist adding more.*

- **3a** Sticky hover on touch: wrap every `:hover` rule in
  `@media (hover: hover)` across the five pages (buttons stay "raised" after
  taps on iPad today).
- **3b** Paused + Next: advancing while paused leaves the progress bar frozen
  at a stale position — reset it to 0 on manual advance while paused.
- **3c** Fullscreen button label/icon should flip to "Exit Fullscreen" on
  `fullscreenchange` (it always says Fullscreen today).
- **3d** (optional, demo-only, skip if fiddly) demo.html shows a portrait +
  landscape companion as two crossfades ~100ms apart — queue the companion
  for the next interval instead.
- Tests: extend the suite — progress bar width `0%` after paused-Next;
  fullscreen label flips both ways (programmatic `exitFullscreen`, per the
  Escape-test precedent: synthesized Esc doesn't exit browser fullscreen).
- **Verify:** `npm run test:ui` green locally + CI.
- **Commit:** `fix(ui): touch hover states, paused-next progress bar, fullscreen label`

### [x] WP4 — Rapid-Next transition race
*Separate WP because it touches the crossfade core — highest revert risk.*

- Today: two Next presses ~1.4–1.5s apart can let the 1500ms cleanup timer
  tear down the *incoming* preload element (occasional skipped crossfade /
  blank frame). Fix direction: a transition **generation counter** — cleanup
  callbacks capture the generation they belong to and no-op if a newer
  transition has started (clearing the pending timers on new transition is
  equally acceptable). Same treatment in `showSinglePhoto` and
  `showDualPortraits`, and mirror to `demo.html` (same code copied).
- Test: hammer Next 5× at ~200ms spacing → wait ~2s to settle → exactly one
  active photo/wrapper in the DOM and it is visible. Don't assert mid-flight
  DOM states (legitimate crossfade overlap would make that flaky) — assert
  the settled outcome, repeated a few times.
- **Verify:** `npm run test:ui` green locally + CI. Failure rule applies —
  two honest failures → revert, log blocked, move on.
- **Commit:** `fix(ui): rapid Next no longer tears down the incoming photo`

### [ ] WP5 — Real-server smoke tests
*The stub can't catch server wiring regressions — boot the real thing.*

- Sub-agent A (Explore): map `server.js` boot requirements — env vars,
  `db/database.js` file paths (`data/`), `logs/` — and what a throwaway boot
  needs (temp cwd? env overrides?). Report only.
- `test/server.test.js` (node:test): spawn `node server.js` with dummy
  `GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/SESSION_SECRET`, a scratch working
  dir for db/logs, and an ephemeral `PORT`. Assert: `/login` 200 HTML;
  `/` and `/slideshow.html` redirect unauthenticated → `/login`;
  `/api/config` unauthenticated → 401/redirect; `/demo` 200; `/api/demo/health`
  JSON with `cache.totalItems`; a static vendor asset serves. Kill child in
  `after()`.
- Wire into CI: change the `test:ui` step to `npm test` and add
  `"test": "node --test test/"` (runs both files); keep `test:ui` for the
  browser-only loop.
- **Verify:** `npm test` green locally + CI.
- **Commit:** `test(server): boot-and-smoke suite for public routes and auth gating`

### [ ] WP6 — On This Day count without downloading a photo
*settings.html currently fetches a full-resolution photo just to read the
`X-Photo-OnThisDayCount` header.*

- Sub-agent A (Explore): find where `photo-cache.js` computes the OTD count
  and what `health.js` already exposes (it has `portraitCount` — natural
  home). Report only.
- Add `onThisDayCount` to the health payload (or, if health is the wrong
  shape, a tiny `GET /api/photo/on-this-day/count`). Update
  `fetchOnThisDayCount()` in settings.html to use it; keep the 404/"no
  photos" copy behavior. Update `test/stub-server.js` to match.
- **Verify:** `npm test` green locally + CI; server smoke test asserts the
  new field/endpoint shape.
- **Commit:** `feat(api): on-this-day count via health; settings stops downloading a photo for it`

### [ ] WP7 — Accessibility pass on icon buttons
- `aria-label` for icon-only buttons (restore buttons in settings' hidden
  grid, any others found), `aria-pressed` on the play/pause + interval +
  display-mode toggles is optional — do it only if it doesn't fight the
  `.active`-class pattern. Keyboard-help overlay should mention that Esc in
  fullscreen only leaves fullscreen.
- Test: Playwright accessible-name assertions for the restore button and the
  main controls.
- **Verify:** `npm test` green locally + CI.
- **Commit:** `a11y(ui): accessible names for icon-only buttons`

### [ ] WP8 — Docs & changelog housekeeping (only if session still alive)
- `CHANGELOG.md`: an Unreleased/0.2.1 section covering the 2026-07-11 touch
  fixes and every WP shipped this run (write it from `git log`, not memory).
- `README.md`: a short Testing section (`npm test`, what it covers, the
  Chrome/Edge requirement) + CI badge.
- **No version bump, no tag, no release** — that's DECISIONS_FOR_SAM #3.
- **Verify:** `npm test` green; docs render sanely on GitHub.
- **Commit:** `docs: changelog for touch fixes + testing guide`

---

## What does NOT happen this run

- No persistence change for the slideshow's interval/display-mode buttons
  (Sam decision #1). No change to dual-portrait Hide semantics (#2). No
  version tag or release (#3). No new runtime dependencies, no frameworks,
  no build step, no linter. No auth-flow changes beyond tests. No touching
  vendored libs. No committing anything from `.playwright-mcp/` or `data/`.

## Sam's decisions

Everything that needs Sam lives in **`.planning/DECISIONS_FOR_SAM.md`** —
review whenever; nothing in this run blocks on it.
