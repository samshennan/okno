---
phase: 14
name: Friend Testing Hardening
status: complete
backfilled: true
authored-by: codex
tags: [csp, frontend-extraction, dependency-bumps, input-validation, env-hygiene]
dependency-graph:
  requires: [13]
  provides: [strict-csp, externalized-frontend, hardened-feedback-input, conditional-health-diagnostics, donation-url-config]
  affects: [phase-15-security-audit-rerun]
tech-stack:
  added: []
  patterns: [external-js-css, mime-validation, env-gated-diagnostics, validated-env-redirects]
  bumped:
    - express: 4.18.x → 4.22.1
    - google-auth-library: 9.14.x → 10.6.2
    - multer: 2.0.x → 2.1.1
key-files:
  created:
    - .env.example
    - public/css/demo.css
    - public/css/index.css
    - public/css/login.css
    - public/css/settings.css
    - public/css/slideshow.css
    - public/js/demo.js
    - public/js/index.js
    - public/js/login.js
    - public/js/settings.js
    - public/js/slideshow.js
  modified:
    - server.js
    - auth.js
    - feedback.js
    - health.js
    - public/sw.js
    - public/demo.html
    - public/index.html
    - public/login.html
    - public/settings.html
    - public/slideshow.html
    - .gitignore
    - package.json
    - package-lock.json
  deleted:
    - okno.env
decisions:
  - id: HARD-01
    decision: "All inline <script> and <style> moved to public/js/* and public/css/*"
    rationale: "Required to drop 'unsafe-inline' from CSP, which is a meaningful XSS hardening step before exposing the app to friend testers"
  - id: HARD-02
    decision: "CSP script-src-attr and style-src-attr set to 'none'"
    rationale: "No inline event handlers remain; blocking attribute-level inline JS/CSS closes a common XSS vector"
  - id: HARD-03
    decision: "Health endpoint returns thin payload in production unless OKNO_DEBUG_HEALTH=true"
    rationale: "Prior /api/health leaked tokenExpiry, sessionId, lastApiCall, lastRefresh, and process.memoryUsage() to any authenticated user"
  - id: HARD-04
    decision: "Feedback endpoint validates length caps + MIME type + email regex; multer fileFilter checks both extension AND mimetype"
    rationale: "Mitigates oversized-payload abuse and disguised non-image uploads from anonymous /api/feedback callers"
  - id: HARD-05
    decision: "DONATION_URL is read from env, validated against ^https://buy.stripe.com/, exposed via /auth/status; null when invalid or unset"
    rationale: "Replaces hard-coded placeholder Stripe links and prevents arbitrary redirect URLs from being injected via env"
  - id: HARD-06
    decision: "okno.env (1Password reference file) deleted; .env.example added; .env.production gitignored"
    rationale: "1Password CLI workflow not in use; .env.example is the canonical contract for required env vars"
metrics:
  commit: 4b7e711
  date: 2026-04-30
  diff: 5692 insertions / 5307 deletions across 26 files
---

# Phase 14: Friend Testing Hardening (Backfilled)

**Status:** Code-complete in commit 4b7e711 ("Harden app for friend testing"), pushed to origin/main 2026-04-30. Backfilled into the GSD planning trail on 2026-04-30 so the audit trail and Codex/Claude alignment are preserved.

## Why this is its own phase

The work was authored by Codex outside the standard GSD planning ceremony but is too large and security-relevant to leave undocumented. It tightens the production posture before the app is exposed to friend testers and is the direct predecessor of Phase 15 (security audit re-run), which it triggers via the "security-adjacent dependency bump" rule in ROADMAP.md.

## What changed

### 1. Inline-script/style extraction → strict CSP

Every authenticated HTML page (`index.html`, `slideshow.html`, `settings.html`, plus `demo.html` and `login.html`) had its `<script>` and `<style>` blocks pulled out into separate files under `public/js/` and `public/css/`. With no inline handlers remaining, `server.js` now sets:

- `script-src`: `'self' https://cdn.jsdelivr.net https://unpkg.com` (removed `'unsafe-inline'`)
- `script-src-attr`: `'none'`
- `style-src`: `'self' https://fonts.googleapis.com` (removed `'unsafe-inline'`)
- `style-src-attr`: `'none'`

This is the largest functional change in the commit and the reason the diff is ~11k LOC even though most of it is relocation. Service worker bumped v1.4 → v1.7 to invalidate old precaches and pick up the new asset paths.

### 2. Health endpoint diagnostics gating

`health.js` now branches on `NODE_ENV !== 'production' || OKNO_DEBUG_HEALTH === 'true'`. In production by default the response only contains `status`, `uptime`, `timestamp`, `auth.hasTokens`, `auth.hasRefreshToken`, `cache.totalItems`, `cache.portraitCount`. Token expiry, session ID, last API call, last refresh, and memory usage are debug-only.

### 3. Feedback endpoint hardening

`feedback.js` now:
- Caps description/reason at 2000 chars, email at 254, type at 20
- Rejects emails that don't match `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- multer fileFilter requires BOTH allowed extension AND allowed MIME type (`image/jpeg|png|gif`)
- Generates `bugId` once (was generated twice — second one was off-by-ms)
- Extracted `ensureDir` and `normalizeText` helpers

### 4. Donation URL configuration

Added `getDonationUrl()` in `auth.js` that reads `process.env.DONATION_URL`, validates against `^https://buy.stripe.com/`, returns null otherwise. Exposed on `/auth/status` for both authenticated and unauthenticated callers. Replaces the placeholder Stripe links flagged as a known issue in earlier handoffs.

### 5. Dependency bumps

| Package | From | To | Notes |
|---------|------|------|------|
| express | ^4.18.2 | ^4.22.1 | Routine patch sweep |
| google-auth-library | ^9.14.1 | ^10.6.2 | Major version bump — auth-adjacent |
| multer | ^2.0.2 | ^2.1.1 | Keeps current with security advisories |

Two of these (`express`, `google-auth-library`) are explicitly listed as Phase 15 triggers in ROADMAP.md.

### 6. Env hygiene

- `okno.env` (1Password CLI reference file) deleted — workflow not in use
- `.env.example` added as canonical contract: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `PORT`, `NODE_ENV`, `DONATION_URL`, `OKNO_DEBUG_HEALTH`
- `.env.production` added to `.gitignore`

## Verification

Manual verification only (no test suite):
- All HTML pages load without CSP violations (verified by Codex pre-push)
- Slideshow, settings, login, demo all render with externalized CSS/JS
- `/api/health` returns thin payload when `NODE_ENV=production`
- Strict Stripe URL pattern rejects non-Stripe `DONATION_URL` values

## Carry-forward to Phase 15

The dependency bumps and CSP/header changes trip the Phase 15 trigger criteria. Phase 15 should re-run `security-audit` against this commit and diff findings against `SECURITY-AUDIT-v2.md`. Particular focus areas:

- CSP — confirm no remaining inline handlers in any frontend page
- `/auth/status` donation URL reflection — confirm validation can't be bypassed
- multer 2.1 changelog — review for new advisories or API changes
- google-auth-library v10 — review for breaking changes to `OAuth2Client` cache pattern
- Feedback input limits — fuzz test boundary cases

## Deviations from standard GSD flow

This phase was not planned via `/gsd:plan-phase`. It was implemented directly by Codex and then backfilled here. No DISCUSS / RESEARCH / PLAN / VERIFICATION artefacts exist for it. If this pattern recurs, consider a lighter "backfill" template or a `/gsd:retro-phase` flow.
