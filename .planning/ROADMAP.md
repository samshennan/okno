# Roadmap: Okno

## Milestones

- **v1.0 MVP** -- Phases 1-3 (shipped 2026-02-15)
- **v1.1 Make It Shine** -- Phases 4-7 (Phases 4-6 shipped 2026-02-16, Phase 7 deferred)
- **v2.0 Multi-User** -- Phases 8-12 (in progress)

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

### Phase 11: Photo Management

**Status:** NOT STARTED

**Goal:** Users can remove photos they don't want from their slideshow cache.

**Scope:** Keep it simple — no full grid required to ship.
- "Hide this photo" button on the slideshow (subtle, tap to reveal)
- `POST /api/photo/hide/:mediaItemId` marks photo hidden in DB (`hidden = 1` column on `photo_cache`)
- Hidden photos excluded from random selection in `photo-cache.js`
- Settings page: "hidden photos" count + "unhide all" button

**If time/interest allows:** thumbnail grid on settings page showing hidden photos with restore option.

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

### Phase 13: Architecture Review + Security Audit

**Status:** NOT STARTED

**Goal:** Review the full codebase architecture and identify any security vulnerabilities before the app is used by real users. Produce a written findings report and fix all critical/high issues.

**Scope:**
- **Architecture review:** assess module boundaries (`auth.js`, `photo-cache.js`, `picker.js`, `config.js`, `photo-proxy.js`), identify tight coupling, circular deps, and any structural risks introduced across v1.0–v2.0 phases
- **Security audit (all 8 checklist sections):**
  - 1. Environment variables + secret management
  - 2. Session management (httpOnly cookies, session fixation)
  - 3. Auth middleware coverage (all routes protected by `requireAuth`?)
  - 4. Server-side validation (picker input, config updates, proxy params)
  - 5. Dependency audit (`npm audit`) + lockfile check
  - 6. Rate limiting on auth + expensive routes
  - 7. CORS configuration
  - 8. Error response leaks (stack traces, file paths exposed to client)
- **Fix all CRITICAL and HIGH findings inline** — don't defer them
- Produce `.planning/decisions/SECURITY-AUDIT-v2.md` with full checklist verdicts, findings, and remediation status

**Context:**
- There is already a `.planning/decisions/SECURITY-ASSESSMENT.md` from an earlier phase — review it first and carry forward any unresolved items.
- The app is Node/Express — no Supabase, so RLS checks are N/A. Focus is on session security, input validation, auth middleware completeness, and rate limiting.
- OAuth callback (`/auth/callback`) and the per-user `OAuth2Client` cache added in Phase 9 are the highest-risk new surfaces.

**Success criteria:**
- No CRITICAL or HIGH findings remain unfixed after the phase
- All 8 audit sections have an explicit verdict (✅ / ❌ / ⚠️ / ⬚)
- Architecture findings documented with recommended improvements (can be deferred to future phases if not urgent)

---

---

### Phase 14: Security Audit Re-run + Skill Refinement

**Status:** NOT STARTED

**Trigger:** Run this phase after any major infrastructure upgrade (new auth surface, new API routes, new DB tables, dependency bumps). Not time-based — event-driven.

**Goal:** Keep the `security-audit` skill sharp by using OKNO as a real-world test bed. Run the skill on the current codebase, evaluate the quality of the output, then feed findings back to improve the skill itself.

**Scope:**
- Re-run the `security-audit` skill on OKNO's current codebase
- Compare findings against Phase 13's baseline (`SECURITY-AUDIT-v2.md`) — what's new, what's been fixed, what was missed last time
- Fix any new CRITICAL or HIGH findings
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
| 11. Photo Management | ⬜ Not started | -- |
| 12. Portfolio Polish | ⬜ Not started | -- |
| 13. Architecture Review + Security Audit | ⬜ Not started | -- |
| 14. Security Audit Re-run + Skill Refinement | ⬜ Event-driven | -- |
