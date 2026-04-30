# Roadmap: Okno

## Milestones

- **v1.0 MVP** -- Phases 1-3 (shipped 2026-02-15)
- **v1.1 Make It Shine** -- Phases 4-7 (Phases 4-6 shipped 2026-02-16, Phase 7 deferred)
- **v2.0 Multi-User** -- Phases 8-12 (in progress)
- **v2.1 Friend Testing** -- Phases 13-15 (Phases 13-14 shipped 2026-04-30, Phase 15 event-driven)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) -- SHIPPED 2026-02-15</summary>

- [x] Phase 1: Backend + Deployment (5/5 plans) -- completed 2026-02-10
- [x] Phase 2: Slideshow + PWA (3/3 plans) -- completed 2026-02-13
- [x] Phase 3: Advanced Features (3/3 plans) -- completed 2026-02-13

See `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.1 "Make It Shine" (Phases 4-7) -- Phases 4-6 SHIPPED 2026-02-16</summary>

- [x] Phase 4: Bug Fixes + Stability (3/3 plans) -- completed 2026-02-15
- [x] Phase 5: Visual Effects + Overlays (3/3 plans) -- completed 2026-02-15
- [x] Phase 6: Stripe + Demo Mode (3/3 plans) -- completed 2026-02-16
- [ ] Phase 7: README + Portfolio Polish -- deferred to Phase 12

</details>

---

### v2.0 "Multi-User"

**Goal:** Any Google account can sign in, run their own photo frame with isolated data, and manage their photo collection. No invite codes, no allowlist — open by design.

**Access model decision (2026-03-09):** Removed `ALLOWED_EMAILS` gate. Anyone with a Google account can sign in. Google's unverified app cap (100 users) is not a concern at this scale. User data is already fully isolated per Phase 9.

---

### Phase 8: Database Foundation ✓

**Status:** COMPLETE (2026-02-28)

- [x] 08-01: SQLite schema + migration runner + JSON seed
- [x] 08-02: auth.js + config.js → DB persistence
- [x] 08-03: photo-cache.js + session store → DB, VPS deploy

---

### Phase 9: Per-User Auth + Data Isolation ✓

**Status:** COMPLETE (2026-03-11)

**Goal:** Multiple Google accounts authenticate independently; each user's photos, tokens, settings, and slideshow are fully isolated.

- [x] 09-01: Per-user OAuth2Client cache, requireAuth middleware, login page
- [x] 09-02: Per-user data isolation across all modules (picker, proxy, cache, config, health)
- [x] 09-03: Frontend auth UX (reconnect overlay, logout button, 401 handling, demo exit link)

---

### Phase 10: Resilience ✓

**Status:** COMPLETE (2026-03-12)

**Goal:** The app handles edge cases gracefully — stale photo cache after restart, missing env vars, and token expiry — without manual intervention.

**Plans:** 1 plan

Plans:
- [x] 10-01-PLAN.md — Env validation, stale cache refresh on restart, token error 401 fix

**Success criteria:**
- Server restart → slideshow continues serving photos within 60 seconds (no 502 burst)
- Missing env var → clear startup error, not a cryptic runtime crash

---

### Phase 11: Photo Management ✓

**Status:** COMPLETE (2026-03-12)

**Goal:** Users can hide unwanted photos from their slideshow and manage hidden photos from settings.

**Plans:** 2 plans

Plans:
- [x] 11-01-PLAN.md — Backend: DB migration v2 (hidden column), cache filtering, hide/unhide API + thumbnail proxy
- [x] 11-02-PLAN.md — Frontend: slideshow hide button with toast+undo, settings thumbnail grid with restore

**Success criteria:**
- User taps a photo they don't want → it never appears again
- Hidden photos persist across server restarts

---

### Phase 12: Portfolio Polish

**Status:** NOT STARTED (absorbed deferred Phase 7 scope)

**Goal:** The GitHub repository communicates product quality at a glance for anyone who visits.

**Scope (single `/gsd:quick` pass — no planning ceremony):**
- README.md: hero screenshot/GIF, one-paragraph product description, architecture diagram (Mermaid), self-hosting guide, key technical decisions
- Live demo link
- Clean up any stale planning artefacts from root directory

**Success criteria:**
- A developer landing on the repo understands what it is and how it works within 30 seconds

---

### Phase 13: Architecture Review + Security Audit ✓

**Status:** COMPLETE (2026-03-13)

**Goal:** Review the full codebase architecture and identify any security vulnerabilities before the app is used by real users. Produce a written findings report and fix all critical/high issues.

**Plans:** 2 plans

Plans:
- [x] 13-01-PLAN.md — Session fixation fix, rate limiting (express-rate-limit v8.3.1+), SameSite cookie
- [x] 13-02-PLAN.md — Error response sanitization (19 catch blocks), SECURITY-AUDIT-v2.md report

**Success criteria:**
- No CRITICAL or HIGH findings remain unfixed after the phase ✓
- All 8 audit sections have an explicit verdict ✓
- Architecture findings documented with recommended improvements ✓

---

---

### Phase 14: Friend Testing Hardening ✓

**Status:** COMPLETE (2026-04-30, backfilled — authored by Codex outside standard GSD flow)

**Goal:** Tighten production posture before exposing the app to friend testers — strict CSP, hardened input validation, reduced diagnostic leakage, dependency bumps.

**Plans:** Single backfilled SUMMARY (no DISCUSS/RESEARCH/PLAN artefacts — direct implementation by Codex)

- [x] 14-SUMMARY.md — Inline-script extraction → strict CSP, health endpoint gating, feedback input caps + MIME check, DONATION_URL config, dep bumps (express, google-auth-library, multer), env hygiene

**Success criteria:**
- CSP no longer requires `'unsafe-inline'` for scripts or styles ✓
- `/api/health` thin payload in production unless `OKNO_DEBUG_HEALTH=true` ✓
- `/api/feedback` rejects oversized payloads and disguised non-image uploads ✓
- `okno.env` (1Password references) removed; `.env.example` is canonical ✓

**Triggers Phase 15:** Bumped `express` and `google-auth-library` (security-adjacent), changed CSP/header surface area.

---

### Phase 15: Security Audit Re-run + Skill Refinement

**Status:** IN PROGRESS — Plans 01 + 02 complete (2/3); Plan 03 pending

**Trigger:** Run this phase after any major infrastructure upgrade (new auth surface, new API routes, new DB tables, dependency bumps). Not time-based — event-driven.

**Goal:** Keep the `security-audit` skill sharp by using OKNO as a real-world test bed. Run the skill on the current codebase, evaluate the quality of the output, then feed findings back to improve the skill itself.

**Plans:** 3 plans (1 complete)

Plans:
- [x] 15-01-PLAN.md — Run audit at commit 143e3aa (Phase 14 reachable), diff vs v2, validate Phase 14 surfaces, draft SECURITY-AUDIT-v3.md → **COMPLETE 2026-04-30 (commit 1049fd0; 8 PASS / 0 FAIL / 0 N/A; 0 NEW CRITICAL/HIGH; 1 NEW LOW (F-N1); 4 skill notes)**
- [x] 15-02-PLAN.md — Triage NEW CRITICAL/HIGH findings → **COMPLETE 2026-04-30 (commit ce1c4be; documented no-op — zero NEW CRITICAL/HIGH findings; F-N1 LOW remains tracked in v3 MEDIUM/LOW section, intentionally untouched per plan scope)**
- [ ] 15-03-PLAN.md — Apply concrete improvement(s) to ~/.claude/skills/security-audit/SKILL.md (human checkpoint), finalize SECURITY-AUDIT-v3.md

**Scope:**
- Re-run the `security-audit` skill on OKNO's current codebase (post-Phase-14 commit 4b7e711)
- Compare findings against Phase 13's baseline (`SECURITY-AUDIT-v2.md`) — what's new, what's been fixed, what was missed last time
- Fix any new CRITICAL or HIGH findings
- Validate Phase 14's CSP, donation URL reflection, multer 2.1, and google-auth-library v10 specifically
- Identify gaps in the skill's output: checks that produced false N/A verdicts, Supabase items that wasted space, Express/SQLite items that missed real issues
- Update `~/.claude/skills/security-audit/SKILL.md` with any improvements discovered
- Update the baseline document with the new audit results

**What "major infrastructure upgrade" means for OKNO:**
- Adding a new Express route that handles user data
- Adding or changing a DB table
- Changing session/auth logic
- Bumping Node.js or a security-adjacent dependency (express, express-session, helmet, googleapis)
- Opening the app to a significantly wider user base

**Success criteria:**
- Audit re-run produces output with ≤2 false N/A items in Section 2 (DB variant detection working)
- Any new CRITICAL/HIGH finding from the re-run is fixed before the phase closes
- At least one concrete improvement made to the `security-audit` skill based on what was learned

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Backend + Deployment | ✅ Complete | 2026-02-10 |
| 2. Slideshow + PWA | ✅ Complete | 2026-02-13 |
| 3. Advanced Features | ✅ Complete | 2026-02-13 |
| 4. Bug Fixes + Stability | ✅ Complete | 2026-02-15 |
| 5. Visual Effects + Overlays | ✅ Complete | 2026-02-15 |
| 6. Stripe + Demo Mode | ✅ Complete | 2026-02-16 |
| 7. README + Portfolio Polish | ↪ Deferred to Phase 12 | -- |
| 8. Database Foundation | ✅ Complete | 2026-02-28 |
| 9. Per-User Auth + Data Isolation | ✅ Complete | 2026-03-11 |
| 10. Resilience | ✅ Complete | 2026-03-12 |
| 11. Photo Management | ✅ Complete | 2026-03-12 |
| 12. Portfolio Polish | ⬜ Not started | -- |
| 13. Architecture Review + Security Audit | ✅ Complete | 2026-03-13 |
| 14. Friend Testing Hardening | ✅ Complete (backfilled) | 2026-04-30 |
| 15. Security Audit Re-run + Skill Refinement | ⏳ Triggered | -- |
