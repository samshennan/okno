# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** v2.0 "Multi-Tenant" -- Phase 8: Database Foundation + Data Migration

## Current Position

**Milestone:** v2.0 "Multi-Tenant"
Phase: 8 of 12 (Database Foundation + Data Migration)
Plan: 01 of 03
Status: In progress
Last activity: 2026-02-27 -- Completed 08-01-PLAN.md (Database Foundation)

Progress: [###################.............] 62% (v1.0+v1.1: 20/20 plans | v2.0: 1/13 plans)

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
- Total plans completed: 21 (v1.0: 11, v1.1: 9, v2.0: 1)
- v1.0: 7 days (11 plans)
- v1.1: 2 days (9 plans)
- v2.0: in progress (1 plan, 3 min)

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

### Blockers/Concerns

- Google Picker API 2000 photo limit remains
- Stripe Payment Link URLs are PLACEHOLDER
- Google 100-user unverified app cap -- invite-only is the design response
- Picker API thumbnail URL format (=w240-h240-c) needs validation in Phase 11
- Session store: better-sqlite3-session-store v0.1.0 is stale -- hand-rolled fallback ready

## Session Continuity

**Last session:** 2026-02-27
**Stopped at:** Completed 08-01-PLAN.md (Database Foundation)
**Resume:** `/gsd:execute-phase` -- 08-02-PLAN.md next

---

**Project Status:** Phase 8 in progress -- Plan 01 complete, Plans 02-03 remaining
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
