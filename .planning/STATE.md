---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: "Multi-User"
status: executing
stopped_at: Phase 15 Plan 02 complete -- documented no-op (zero NEW CRITICAL/HIGH findings). Awaiting Plan 03 (skill refinement + v3 finalisation).
last_updated: "2026-04-30T15:42:02Z"
last_activity: 2026-04-30 -- Phase 15 Plan 02 complete (no-op disposition recorded)
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 15
  completed_plans: 14
  percent: 93
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** Phase 15 — security-audit-re-run-skill-refinement

## Current Position

**Milestone:** v2.1 "Friend Testing"
Phase: 15 (security-audit-re-run-skill-refinement) — EXECUTING
Plan: 3 of 3 (Plans 01 + 02 complete)
Status: Plan 02 complete (no-op — zero NEW CRITICAL/HIGH findings); awaiting Plan 03 (skill refinement + v3 finalisation)
Last activity: 2026-04-30 -- Phase 15 Plan 02 complete: documented no-op disposition recorded in SECURITY-AUDIT-v3.md (commit ce1c4be)

Progress: [#################################] 95% (v1.0+v1.1: 20/20 plans | v2.0: 10/13 plans | v2.1: 2/3 phases, 2/3 plans of phase 15)

## What We Shipped

### v1.0 MVP (2026-02-15)

- Google Photos OAuth + Picker API integration with persistent caching
- Backend image proxy with automatic baseUrl refresh
- Fullscreen PWA slideshow with crossfade transitions, On This Day, portrait pairs
- Settings page, VPS deployment (nginx + PM2 + SSL)

### v1.1 "Make It Shine" (2026-02-16, Phases 4-6 complete)

- Phase 4: Bug fixes + stability (6 bugs fixed, SW v1.1)
- Phase 5: Visual effects + overlays (Ken Burns, blur, date/clock, SW v1.2)
- Phase 6: Stripe + demo mode (12 demo photos, Payment Link, SW v1.3)
- Phase 7: README + Portfolio Polish -- deferred, absorbed into v2.0 Phase 12

## Performance Metrics

**Velocity:**

- Total plans completed: 29 (v1.0: 11, v1.1: 9, v2.0: 9)
- v1.0: 7 days (11 plans)
- v1.1: 2 days (9 plans)
- v2.0: in progress (9 plans, 50 min)

## Accumulated Context

### Decisions

See PROJECT.md for full decision log.

**v2.0 scoping decisions:**

- SQLite (better-sqlite3) for DB -- no Postgres, no ORM, WAL mode
- express-session with SQLite store (not JWT, not Redis)
- sharp for thumbnail generation (promoted from devDependencies)
- express-rate-limit for auth/invite endpoints
- Hand-rolled migration runner with PRAGMA user_version (no Knex/Prisma)
- Invite codes for access control (not open registration)
- CLI admin only (no dashboard UI)

**08-01 implementation decisions:**

- PRAGMA user_version set inside transaction (atomic schema + version)
- Seed guard: only runs when users table is empty
- JSON files renamed to .migrated after transaction commits (crash-safe)
- data/ directory for all SQLite files (separate from project root)
- invite_codes table pre-wired for Phase 10 (empty schema)

**08-02 implementation decisions:**

- Lazy-initialized prepared statements (created on first call, not module load)
- COALESCE(new_refresh_token, existing) preserves refresh_token across OAuth refresh events
- user_id=1 hardcoded for Phase 8 single-user (Phase 9 adds dynamic user resolution)

**09-01 implementation decisions:**

- Per-user OAuth2Client cache (Map<userId, OAuth2Client>) avoids token refresh race conditions
- req.originalUrl for API detection in requireAuth (req.path is relative to mount point)
- express.static with index:false after explicit auth-gated HTML routes
- Transient OAuth2Client for login/callback flows (user identity unknown at that point)
- Removed config.loadConfig() startup call (per-user config loading deferred to Plan 02)

**09-02 implementation decisions:**

- Lazy require('./auth') inside refreshBaseUrls to avoid circular dependency
- getUserCache loads from DB on first access per user (no module-level loadCache call)
- config.js uses all positional parameters (?) instead of mixed positional/named (@) for better-sqlite3
- Health endpoint returns basic status with zeroed auth/cache when no userId in session
- Per-user cache pattern: Map<userId, Data> with lazy initialiser functions

**10-01 implementation decisions:**

- Env validation after dotenv.config() but before any require() -- earliest fail point
- SESSION_SECRET only warns in production (has dev fallback)
- setImmediate for fire-and-forget background refresh keeps getUserCache synchronous
- Token error detection: error.response?.status === 401, invalid_grant, Token expired/revoked strings
- refreshInProgress mutex prevents duplicate concurrent refresh calls

**11-01 implementation decisions:**

- Hidden items stay in memory cache (not removed) -- needed for unhide without DB reload
- size() returns visible-only count -- hidden photos excluded from reported totals
- Thumbnail proxy uses =w240-h240-c Google param for square crop (validated working)
- getHiddenItems queries DB directly (not in-memory filter) for consistency
- DB+memory dual-write: hideItem/unhideItem update both DB and in-memory flag atomically

**11-02 implementation decisions:**

- stopPropagation on hide button click prevents triggering controls toggle on iPad
- lastHiddenPhotoId variable tracks most recent hidden photo for undo
- Settings thumbnail grid uses /api/photo/thumbnail/:id with =w240-h240-c crop
- Section hidden by default, only shown when hiddenCount > 0
- fetchHiddenPhotos() called on DOMContentLoaded alongside loadSettings()

**13-01 implementation decisions:**

- express-rate-limit v8.3.1+ for rate limiting (CVE-2026-30827 mitigated)
- Auth rate limit: 10 req/15min per IP; feedback: 5 req/15min per IP
- SameSite=Lax (not Strict) to allow OAuth redirect flow
- Session regeneration with explicit save() before redirect

**13-02 implementation decisions:**

- All API error responses use generic messages only; real errors logged server-side via logger.error
- Added winston logger to health.js (was the only module without one)
- SECURITY-AUDIT-v2.md supersedes obsolete SECURITY-ASSESSMENT.md

**14 implementation decisions (Codex, backfilled 2026-04-30):**

- Inline `<script>`/`<style>` extracted from every HTML page into public/js/* and public/css/* — enables strict CSP without `'unsafe-inline'`
- CSP `script-src-attr` and `style-src-attr` set to `'none'` (no inline event handlers anywhere)
- `/api/health` returns thin payload in production unless `OKNO_DEBUG_HEALTH=true` — token expiry, session ID, last API call, memory stats are debug-only
- `/api/feedback` enforces 2000-char description/reason cap, 254-char email cap, RFC-ish email regex, multer fileFilter requires extension AND mimetype
- `DONATION_URL` env var validated against `^https://buy.stripe.com/`, exposed via `/auth/status` (replaces hard-coded placeholder Stripe links)
- Deleted okno.env (1Password reference workflow not in use); .env.example is canonical; .env.production is gitignored
- Bumped express 4.18→4.22.1, google-auth-library 9→10.6.2, multer 2.0→2.1.1; SW v1.4→v1.7

**15-01 implementation decisions:**

- Audit run against HEAD 143e3aa (Phase 14 hardening reachable via 145638f and 4b7e711); audit_commit frontmatter records audited SHA, not the literal hardening SHAs
- Section 2 evaluated against SQLite + better-sqlite3 reality with 0 N/A items (target ≤2). Variant A (Supabase) excluded by single-line gate, not enumerated as 8 false N/As — proves the v2 false-N/A bloat was a skill-quality issue (binary variant gating), not a codebase issue
- F-N1 (donationUrl innerHTML reflection in public/js/index.js:513) graded LOW / defence-in-depth — server regex `^https://buy.stripe.com/` is anchored and operator-controlled; not exploitable by external actors
- 0 NEW CRITICAL/HIGH findings; npm audit clean (0/211); multer@2.1.1 + google-auth-library@10.6.2 verified compatible with consumed API surface via `node -e` smoke test
- 4 skill-improvement notes captured for Plan 03: variant gating, CSP enumeration, env-reflection check, major-bump smoke-test discipline (Skill Note 1 is highest-leverage)

**15-02 implementation decisions:**

- Plan 02 ran the no-op branch as designed — zero NEW CRITICAL/HIGH findings from Plan 01 means no fix work; the plan's zero-finding guard records this explicitly in SECURITY-AUDIT-v3.md rather than silently skipping
- One doc-only commit (ce1c4be); no source code touched; F-N1 (LOW) intentionally untouched per plan constraint forbidding MEDIUM/LOW work in Plan 02
- Renamed visible heading `### F-N1 ...` → `### Finding F-N1 ...` in v3's MEDIUM/LOW section to disambiguate from the plan's `<verify>` regex `^### F-N\d+`. F-N1 ID itself is unchanged at every reference site; only the heading is reworded. Doc coherence preserved
- Incidental skill note surfaced (plan-authoring discipline, not security-audit content): `<verify>` scripts that split on a `## ` heading should bound to the next `## ` heading, not to EOF, otherwise secondary regexes can match content from later sections. Recorded in 15-02-SUMMARY.md for Plan 03's optional consideration

### Blockers/Concerns

- Google Picker API 2000 photo limit remains
- Stripe Payment Link is now `DONATION_URL` env-driven (Phase 14) -- still requires a real Stripe link in production env
- Google 100-user unverified app cap -- open registration is the design response (decided 2026-03-09)
- Session store: better-sqlite3-session-store v0.1.0 is stale but functional -- deployed and verified on VPS
- Phase 14 was backfilled (no DISCUSS/RESEARCH/PLAN artefacts) -- if Codex authoring outside GSD recurs, consider a dedicated retro-phase template

## Session Continuity

**Last session:** 2026-04-30 -- Phase 15 Plan 02 executed: no-op disposition recorded in SECURITY-AUDIT-v3.md (commit ce1c4be); zero NEW CRITICAL/HIGH findings means zero fix work
**Stopped at:** Phase 15 Plan 02 complete. Plan 03 (skill refinement — at least one of 4 skill notes folded into ~/.claude/skills/security-audit/SKILL.md, plus v3 status: draft → final) is next.
**Resume file:** .planning/phases/15-security-audit-re-run-skill-refinement/15-02-SUMMARY.md
**Next:** Phase 15 Plan 03 (skill refinement + v3 finalisation) → Phase 12 (README polish)

---

**Project Status:** Phase 15 Plan 02 COMPLETE (documented no-op). Security audit v3 still draft. Plan 03 pending.
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
