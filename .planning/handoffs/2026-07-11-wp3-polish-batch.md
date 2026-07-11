# Handoff — WP3: slideshow polish batch (2026-07-11)

## What
- 3a: all 20 `:hover` rules across the five pages wrapped in
  `@media (hover: hover)` (sticky hover on iPad taps gone). The
  settings.html comma-group mixing `:hover`+`:active` was split; `:active`
  rules untouched.
- 3b: `nextPhoto()`/`previousPhoto()` call the previously-dead
  `resetProgressBar()` when paused — bar snaps to 0% instead of freezing.
- 3c: new `updateFullscreenButton()` + `document` `fullscreenchange`
  listener flips `#fullscreenBtn` between maximize/"Fullscreen" and
  minimize/"Exit Fullscreen" (browser-level Esc exits update it too).
- 3d: demo.html landscape-companion no longer double-crossfades ~100ms
  apart — companion is queued (`queuedPhoto`) and consumed by the next
  `loadPhoto()` tick instead of a `setTimeout`.
- Tests +3 in ui-buttons.test.js: paused-Next → bar `0%`; fullscreen label
  flips both ways (programmatic `exitFullscreen`, per Escape precedent);
  static guard that no `:hover` exists outside `@media (hover: hover)` on
  any page.

## State
- 15/15 green locally (orchestrator-run). CI watched after push.

## Pending
- Nothing for WP3. Next: WP4 rapid-Next transition race.
