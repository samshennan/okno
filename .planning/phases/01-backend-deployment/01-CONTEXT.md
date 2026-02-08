# Phase 1: Backend + Deployment - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete backend infrastructure: OAuth authentication with Google, Google Photos Picker integration, photo ID caching, baseUrl refresh management, and production deployment on VPS. Delivers working API endpoints that serve random photos with fresh URLs.

The frontend slideshow is Phase 2. Advanced features (On This Day, portrait pairs, settings) are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### OAuth flow & session handling
- Session duration: Forever (until manual logout) — ideal for dedicated iPad use
- On access expiry/revocation: Keep showing last cached photos (graceful degradation)
- Multi-device support: Single iPad only for now (keep it simple)
- Post-login flow: Claude's discretion (choose most straightforward UX)

### Photo selection & caching strategy
- Cache storage: Photo IDs only (not full images or static URLs)
- Collection size: Designed for large collections (1000+ photos)
- Re-selection ability: Yes — provide way to re-open Picker and update photo collection
- URL refresh strategy: Claude's discretion (ensure 60-min baseUrl expiry is handled reliably)

### API design & error responses
- `/api/photo/random` response format: Claude's discretion (return what's needed for clean implementation)
- `/api/health` response: **Detailed diagnostics** — token status, cache size/stats, last API call timestamp, errors, memory usage, uptime
- Empty cache handling: Claude's discretion (graceful fallback)
- Google API failure handling: Claude's discretion (choose resilient retry/fallback strategy)

### Production infrastructure
- VPS: **Existing server** — currently running n8n, Gemini CLI, Claude Code at root level
- Secrets management: **Use 1Password CLI** — fetch secrets from 1Password using `op` CLI (not plain .env files)
- Crash recovery: Claude's discretion (choose reliable auto-restart strategy)
- Logging level: **Verbose (everything)** — detailed logs for debugging, every request and decision

### Claude's Discretion
- Post-login UX flow (where OAuth callback lands)
- BaseUrl refresh timing and strategy
- API response format and metadata inclusion
- Empty cache and API failure fallback behavior
- Process restart strategy (immediate vs backoff)

</decisions>

<specifics>
## Specific Ideas

- VPS environment: Shared with n8n, Gemini CLI, and Claude Code — coordinate port usage and process management
- Security concern: User uncomfortable with plain .env files on VPS — 1Password CLI addresses this
- Use case: Single dedicated iPad that stays logged in indefinitely

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-backend-deployment*
*Context gathered: 2026-02-08*
