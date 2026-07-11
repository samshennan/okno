# Handoff — WP4: rapid-Next transition race (2026-07-11)

## What
- Generation counter in slideshow.html + demo.html: `transitionGeneration`
  bumped at the top of `showSinglePhoto()`/`showDualPortraits()`; each
  deferred 1500ms cleanup captures its generation and bails if a newer
  transition started. 50ms/100ms callbacks deliberately NOT gated (timer
  ordering already settles them; gating would strand preload elements).
  14 lines total across both pages.
- Root cause (scouted): cleanup selects `.photo:not(.active)`, which also
  matches the NEXT transition's ~50ms `preload` element — teardown revoked
  its blob URL → blank frame. Timer handles were never stored.
- New test hammers Next at three spacings (5@250ms, 2@1505ms, 3@742ms) and
  asserts the settled outcome only: exactly one active, opacity-1,
  complete, live-blob photo. `force: true` clicks are required — Playwright
  actionability waits add ~400ms/click and push presses out of the race
  window. Mutation-verified: with the guard removed, the test fails
  ("exactly one settled photo element (got 0)") on all three spacings.

## State
- 16/16 green locally ×4 runs (3 agent + 1 orchestrator). CI watched after
  push.

## Pending / known-but-out-of-scope
- The 1500ms cleanup literal is decoupled from the configurable
  `--transition-time` (default 1s): with transitionTime=2s the outgoing
  photo is removed mid-fade (cosmetic pop). Separate small bug, not
  addressed here. demo.html also never applies transitionTime config.
- Next: WP5 real-server smoke tests (scout report already delivered).
