# Handoff: Verify okno.moonacle.com is on the latest deploy
**Date:** 2026-07-12
**Session:** Confirmed live site matches last night's WP1-8 deploy; no code changes this session

---

## What Was Done

Sam asked whether okno.moonacle.com was running the most recent version.
Verified directly against the live site and both repos, no code changed:

- `curl https://okno.moonacle.com/sw.js` → `okno-v1.7` (matches WP2's
  bounded photo cache bump from 2026-07-11).
- `curl https://okno.moonacle.com/demo.html` → contains
  `transitionGeneration` (WP4's rapid-Next fix) and `/login` responds 200.
- `git fetch origin` on the public repo → `main` unchanged since last
  night except the `/fin` handoff commit (`812a06a`, docs-only).
- `ssh -p 2222 sam@159.69.152.123` into the VPS → `/var/www/okno` still on
  staging commit `8539e08` (exactly what was deployed 2026-07-11), no new
  commits pulled since.

Conclusion: yes, the live site is on the latest version.

---

## Current State

- okno.moonacle.com live on staging `8539e08` / public `fadec66`-equivalent
  content, unchanged since 2026-07-11's deploy.
- Public repo main = `812a06a`. Staging main = `8539e08`. Tree clean, no
  unpushed commits, no bananas.
- Server clutter noted last session is still present and still untouched:
  locally-modified `.env.production`, two `.env.production.bak-*` files,
  and a stray untracked `slideshow.html` at the VPS repo root (not served
  — lives outside `public/`).

## Pending from This Session

- Nothing new. Carried over from 2026-07-11:
  - **DECISIONS_FOR_SAM.md #6** — export-public.sh would wipe public
    history and drop `test/` + `.github/` if re-run; needs Sam's call on
    source-of-truth direction before anyone touches it.
  - Decisions #1-5 still open.
  - Server clutter above — confirm-delete once Sam's had a look.
