# Phase 9: Per-User Auth + Data Isolation - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable multiple Google accounts to independently authenticate and each run their own fully isolated photo frame — photos, tokens, and settings are per-user. The model is "one user per device": different people share the same deployment but never see each other's data. Phase 9 does NOT implement invite codes (Phase 10) or the reconnect overlay across users (Phase 10 EXPIRY requirements) — but it does lay the auth + isolation foundation those phases build on.

</domain>

<decisions>
## Implementation Decisions

### Unauthenticated experience
- `/` redirects to `/login` for unauthenticated visitors — no demo mode shown
- `/login` is a branded page: Okno name/logo + "Sign in with Google" button
- An already-logged-in user visiting `/login` is redirected to `/` (their slideshow)
- Post-OAuth landing after first sign-in: Claude's discretion (planner decides based on existing first-run flow)

### Login entry point
- Multi-user model = multiple different Google accounts on different devices; not simultaneous users on one iPad
- Re-login is acceptable after the Phase 9 VPS deploy — no need to preserve existing sessions across the upgrade
- A placeholder access gate must be in place before Phase 10 adds invite codes: `ALLOWED_EMAILS` env var (comma-separated). Unknown Google accounts receive a clear "not authorised" response after OAuth, not a crash or silent failure

### Session lifetime + logout
- Sessions are effectively permanent: 30+ days (photo frame devices are always-on)
- Settings page gets a logout button — clears session, redirects to `/login`
- When a user's Google OAuth token expires: show a reconnect overlay on the slideshow (not a silent failure)
- The overlay has a "Reconnect" button that directly triggers the Google OAuth flow (not a redirect to settings)

### Claude's Discretion
- Post-OAuth redirect destination for first-time sign-in
- Exact session maxAge value (as long as it's 30 days or more)
- "Not authorised" page/response design for accounts not in ALLOWED_EMAILS
- Error state for when OAuth itself fails (network error, Google down, etc.)

</decisions>

<specifics>
## Specific Ideas

- The ALLOWED_EMAILS gate is explicitly temporary scaffolding — Phase 10 will replace it with the invite code system. Keep it clean enough to swap out.
- The reconnect overlay is a Phase 9 addition but will be extended in Phase 10 (EXPIRY-01 through EXPIRY-03) — implement the basic overlay now, Phase 10 will add the multi-user isolation guarantee

</specifics>

<deferred>
## Deferred Ideas

- Invite code access control — Phase 10 (ACCESS-01 through ACCESS-04)
- Token expiry behaviour across multiple concurrent users — Phase 10 (EXPIRY-01 through EXPIRY-03)
- Per-user URL paths (e.g. /u/sam/slideshow) — not needed; session-based routing is sufficient for the one-user-per-device model
- Account management UI beyond logout — future phase if needed

</deferred>

---

*Phase: 09-per-user-auth*
*Context gathered: 2026-02-28*
