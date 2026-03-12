# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** v2.0 "Multi-User" -- Phase 13: Architecture Review + Security Audit (complete)

## Current Position

**Milestone:** v2.0 "Multi-User"
Phase: 13 of 13 (Architecture Review + Security Audit)
Plan: 02 of 02 (complete)
Status: Phase complete
Last activity: 2026-03-13 -- Completed 13-02-PLAN.md (error sanitization + security audit)

Progress: [################################] 97% (v1.0+v1.1: 20/20 plans | v2.0: 10/13 plans)

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

### Blockers/Concerns

- Google Picker API 2000 photo limit remains
- Stripe Payment Link URLs are PLACEHOLDER
- Google 100-user unverified app cap -- invite-only is the design response
- Session store: better-sqlite3-session-store v0.1.0 is stale but functional -- deployed and verified on VPS

## Session Continuity

**Last session:** 2026-03-13 -- Phase 13 executed (architecture review + security audit)
**Stopped at:** Phase 13 complete. All security findings resolved. 24 commits pushed.
**Resume file:** .planning/handoffs/2026-03-13-phase-13-security-audit.md
**Next:** Deploy Phase 13 to VPS, then Phase 12 (README + Portfolio Polish)

---

**Project Status:** Phase 13 COMPLETE. All security findings resolved: session fixation, rate limiting, SameSite, error leaks. Full audit documented in SECURITY-AUDIT-v2.md.
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
