# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** Phase 1: Backend + Deployment

## Current Position

Phase: 1 of 3 (Backend + Deployment)
Plan: 3 of 5 in current phase
Status: In progress
Last activity: 2026-02-09 - Completed 01-03-PLAN.md

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5 minutes
- Total execution time: 0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Backend + Deployment | 3/5 | 15 min | 5 min |
| 2. Slideshow + PWA | 0/TBD | - | - |
| 3. Advanced Features | 0/TBD | - | - |

**Recent Trend:**
- Last 5 plans: 01-01 (6 min), 01-02 (4 min), 01-03 (5 min)
- Trend: Steady (5 min/plan average)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Compressed to 3 phases (quick depth). Phase 1 combines all backend + infra. Phase 2 combines all frontend + PWA. Phase 3 is polish-week advanced features.
- 01-01: Use 1Password CLI secret references instead of plaintext .env files (user requirement for security on shared VPS)
- 01-01: Forever sessions with 1-year expiry (dedicated iPad use case, no manual logout needed)
- 01-01: Dynamic OAuth redirectUri to support both local dev and production HTTPS
- 01-01: Token merge logic preserves refresh_token (Google only sends it once)
- 01-02: Store sessionId in cache for baseUrl refresh (mediaItems.list requires it)
- 01-02: 50-minute refresh interval for baseUrls (10-minute buffer before 60-min expiry)
- 01-02: Gitignore cache.json (user-specific media item selection, not secrets)
- 01-03: Use w2048-h1536 size parameters for baseUrl (iPad Pro landscape display optimization)
- 01-03: Cache-Control: no-store on proxied images (baseUrls expire after 60 minutes)
- 01-03: Return 503 when cache is empty (temporary service unavailability semantics)

### Pending Todos

None yet.

### Blockers/Concerns

- Picker API session expiry duration is undocumented -- needs empirical testing in Phase 1
- NoSleep.js reliability in iOS 16.x PWA mode needs validation on actual iPad in Phase 2
- OAuth consent screen must be set to "In Production" to avoid 7-day token expiry

## Session Continuity

Last session: 2026-02-09
Stopped at: Completed 01-03-PLAN.md (Random photo serving and health check)
Resume file: None
