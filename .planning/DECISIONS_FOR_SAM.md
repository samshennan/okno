# Decisions for Sam — okno

Parking lot for choices only Sam can make. Nothing in the long-run session
plan blocks on these; each lists a recommendation so a "yes, do it" is enough.
Tick + note your call, and a future session picks it up.

---

## 1. Should the slideshow's own interval / display-mode buttons persist?

Today the buttons on the slideshow overlay change the running session only —
restart the app and it reverts to whatever the Settings page saved. Possibly
intentional ("quick override"), possibly surprising ("I chose 2m, why is it
back to 30s?").

**Recommendation:** persist — debounce a `POST /api/config` when they're
tapped, so the overlay and Settings page stop disagreeing. One-liner on the
existing endpoint.

**Sam says:** _(pending)_

## 2. What should Hide do in dual-portrait view?

Hide currently hides only the LEFT portrait's photo ID; the right one stays
in rotation. Options: (a) keep as-is, (b) hide both, (c) per-photo hide
buttons over each half.

**Recommendation:** (b) hide both — the user's intent when tapping Hide on a
pair is almost always "I don't want to see this screen again", and (c) is UI
clutter on a photo frame.

**Sam says:** _(pending)_

## 3. Release/version policy — cut v0.2.1?

The touch fixes + this plan's WPs are user-visible bug fixes on a public
repo. Worth a version bump, tag, and a GitHub release note? And is the
CHANGELOG's existing style (keep-a-changelog-ish) the format you want
maintained?

**Recommendation:** yes — tag v0.2.1 once WP1–WP4 land; releases make the
public repo look alive.

**Sam says:** _(pending)_

## 4. Offline photo cache size (service worker)

WP2 caps the offline photo cache. 50 photos ≈ a few hundred MB worst case on
originals, far less on typical compressed baseUrls. Bigger cap = longer
offline slideshows, more iPad storage pressure (iOS will evict under
pressure anyway).

**Recommendation:** 50, revisit only if you actually run the frame on flaky
Wi-Fi.

**Sam says:** _(pending)_

## 5. Demo photos — keep bundling, or trim?

`demo-photos.js` + `public/demo/` ship with the repo. If the demo photos are
personal, you may want them swapped for stock/synthetic images now that the
repo is public. (Not audited this session — flagging, not accusing.)

**Recommendation:** eyeball `public/demo/` once; swap if any are family
photos.

**Sam says:** _(pending)_

## 6. Two-repo pipeline: staging is the source of truth, but this session
## committed to the public repo directly

Discovered during the 2026-07-11 deploy: the VPS pulls from the private
`okno-staging` repo, and `scripts/export-public.sh` REGENERATES the public
repo from scratch (fresh `git init`, allowlist copy). This session's 9
commits (touch fixes + WP1–WP8) went straight to the public repo, so:

- Staging was 9 commits of content behind; I ported everything back as
  staging commit `8539e08` (verified: 25/25 tests green on the ported tree)
  and deployed it. Repos are content-level in sync again as of tonight.
- BUT: if `export-public.sh` is ever re-run as-is, it will (a) wipe the
  public repo's now-real history (9 meaningful commits + green CI runs),
  and (b) DROP `test/` and `.github/` from the export — they're not in its
  allowlist.

Options: (a) retire export-public.sh and develop in the public repo,
syncing staging FROM public (public repo has no secrets; the sweep found
none this session); (b) keep staging as source of truth, add `test/` +
`.github/` + `.planning/` to the allowlist, and change the script to
commit onto the existing public history instead of git init; (c) keep
divergence and hand-port each session (what I did tonight — works, but
manual and easy to forget).

**Recommendation:** (a) — the public repo is now the one with CI, tests,
and real history; staging's only unique value is `.env.production`,
`.vps-config`, and deploy scripts, which could live in a small private
`okno-deploy` folder/repo instead.

**Sam says:** _(pending)_
