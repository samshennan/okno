# Handoff: Secret and Merge Remediation
**Date:** 2026-07-13
**Session:** Removed an exposed revoked Gemini key and repaired the public repository after an accidental unrelated-history merge.

---

## What Was Done

### 1. Investigated the GitHub alerts
- Confirmed GitHub Actions run `29210018307` failed at `npm ci` because the committed `package-lock.json` contained unresolved merge markers.
- Confirmed the revoked Google API key first entered the repository in merge commit `218b307` on 2026-07-12 at 23:38 Europe/Warsaw; neither merge parent contained `.geminirc`.
- Verified the exposed key was an already-revoked older key, distinct from the current live key prefix reported by Sam.

### 2. Repaired repository history
- Identified `218b307` as an accidental merge of unrelated private-development and public-release histories, with unresolved conflict markers across application, configuration, lock, and HTML files.
- Restored `main` to clean public-release parent `ac22f0a` instead of guessing through incompatible conflict blocks.
- Kept a local-only backup branch, `backup/pre-remediation-218b307`, for forensic recovery. It must not be pushed.
- Added `.geminirc` and `.env.*` to `.gitignore`, while explicitly retaining `.env.example`.

### 3. Verified the clean release
- Ran `npm ci` successfully using Node 22-compatible dependencies.
- Ran `npm test`: all 25 tests passed, including server smoke, service worker, touch, desktop, settings, and accessibility coverage.
- `npm ci` reported 8 dependency vulnerabilities (7 moderate, 1 high); these were not changed during the emergency history repair.

---

## Current State
- `main` contains the clean public release plus this remediation handoff and ignore hardening.
- The exposed key was revoked before exposure and is no longer present in reachable `main` history after the guarded force-push.
- CI should now pass because the clean parent has a valid `package-lock.json` and the same test suite passes locally.

## Pending from This Session
- Review and remediate the 8 dependency audit findings in a dedicated dependency update.
- Confirm GitHub secret scanning shows the old alert as resolved/revoked after the history rewrite.
