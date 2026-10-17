# Handoff: iOS touch fix + SW v1.4 + CLAUDE.md compression
**Date:** 2026-03-12
**Session:** Committing uncommitted fixes from prior session; project state review

---

## What Was Done

### 1. iOS touch double-fire fix (`public/slideshow.html`)
- Replaced single `click` listener with `touchend` + `click` (desktop fallback) to prevent iOS firing both events on tap
- `touchend` calls `e.preventDefault()` to stop the synthetic `click` from also firing (which caused controls to show then immediately hide on same gesture)
- Added `pointer-events: none`, `-webkit-touch-callout: none`, `-webkit-user-select: none` to `<img>` elements to prevent iOS long-press save-image gesture

### 2. Service Worker v1.4 (`public/sw.js`)
- Bumped `CACHE_VERSION` and `PHOTO_CACHE` from `okno-v1.3` to `okno-v1.4`
- Removed `slideshow.html` from precache list
- Auth-gated pages (`slideshow.html`, `index.html`, `settings.html`) must NOT be precached: they redirect to `/login` when unauthenticated, which would break SW install on first visit

### 3. CLAUDE.md compression
- Condensed from ~100 lines to ~55 lines
- Removed: column-level DB schema, verbose page descriptions, stale env vars, full settings JSON block
- Kept: architecture diagram, key files table, auth flow, planning status

---

## Current State
- Phase 9 (per-user auth) complete and deployed — any Google account can sign in, data isolated
- Phase 10 (resilience) has PLAN.md ready but not yet executed
- 3 commits ahead of origin/main from prior session (Phase 9 + Phase 10 planning docs)
- No blocking issues — app healthy at okno.moonacle.com

## Pending from This Session
- Execute Phase 10-01: server restart resilience, startup env validation, token revocation handling
- Run `/gsd:execute-phase 10` in a fresh context window
