---
phase: 01-backend-deployment
plan: 01
subsystem: authentication
tags: [oauth, express, session-management, google-photos-picker]

requires:
  - none (first plan in phase)

provides:
  - OAuth 2.0 authentication flow with Google Photos Picker API scope
  - Token persistence across server restarts
  - Express server with session management
  - Foundation for Picker API and photo proxy integration

affects:
  - 01-02 (Picker integration will use authenticated oAuth2Client)
  - 01-03 (Photo proxy will use authenticated oAuth2Client)
  - 01-04 (Health endpoint will report auth status)

tech-stack:
  added:
    - express: ^4.22.1
    - google-auth-library: ^9.15.1
    - express-session: ^1.19.0
    - session-file-store: ^1.5.0
    - morgan: ^1.10.1
    - helmet: ^7.2.0
    - winston: ^3.19.0
  patterns:
    - OAuth 2.0 web server flow with CSRF protection
    - Token persistence with refresh token merging
    - File-based session storage (1-year TTL)
    - Dynamic OAuth redirect URI (supports local dev and production)

key-files:
  created:
    - package.json: Node.js project with Express backend dependencies
    - .gitignore: Excludes secrets (tokens.json, .env, sessions/, logs/)
    - okno.env: 1Password secret references (safe to commit)
    - server.js: Express app with session middleware and auth route mounting
    - auth.js: OAuth login, callback, token persistence, oAuth2Client export
  modified:
    - none

decisions:
  - decision: Use 1Password CLI secret references instead of plaintext .env
    rationale: User requirement for security on shared VPS
    impact: okno.env contains op:// references, secrets injected at runtime
  - decision: Forever sessions (1 year expiry)
    rationale: Dedicated iPad use case, no manual logout needed
    impact: Session cookie and file store both use 1-year TTL
  - decision: Dynamic OAuth redirectUri
    rationale: Support both local dev (http://localhost:3100) and production (https://domain.com)
    impact: redirectUri set per-request in /auth/login route
  - decision: Token merge logic in saveTokens()
    rationale: Google only sends refresh_token once, must preserve across token refresh events
    impact: Avoids Pitfall #2 from research (losing refresh token)

metrics:
  duration: 6 minutes
  tasks: 3
  commits: 3
  files-created: 5
  files-modified: 0
  completed: 2026-02-09
---

# Phase 1 Plan 01: OAuth Authentication Summary

**One-liner:** OAuth 2.0 authentication with Google Photos Picker API scope, token persistence via filesystem, and Express server with 1-year session management.

## What Was Built

Established the OAuth authentication foundation for the Okno backend. Users can authenticate with Google Photos via the Picker API scope, tokens are saved to disk and survive server restarts, and the Express server provides session management for authenticated state.

This plan delivers the critical authentication layer that all subsequent plans depend on. Without working OAuth, the Picker API integration (Plan 02) and photo serving (Plan 03) cannot function.

## Key Files Created

### package.json
Node.js project manifest with Express backend dependencies:
- express (HTTP server)
- google-auth-library (OAuth2Client)
- express-session + session-file-store (session persistence)
- morgan + helmet + winston (logging and security)

### .gitignore
Excludes secrets from git:
- tokens.json (OAuth tokens)
- .env (plaintext secrets)
- sessions/ (session files)
- logs/ (application logs)

### okno.env
1Password secret references (safe to commit):
```
GOOGLE_CLIENT_ID="op://Personal/Okno Google OAuth/client_id"
GOOGLE_CLIENT_SECRET="op://Personal/Okno Google OAuth/client_secret"
SESSION_SECRET="op://Personal/Okno/session_secret"
```

Uses `op run --env-file=okno.env` pattern for runtime secret injection on VPS.

### server.js (83 lines)
Express application entry point:
- Winston logger with timestamp formatting and file transport
- Helmet security headers
- Morgan HTTP request logging
- Express-session with FileStore (1-year TTL)
- Static file serving from ./public (for Phase 2 frontend)
- Auth route mounting at /auth
- Listens on port 3100 (avoids n8n conflict on shared VPS)

### auth.js (169 lines)
OAuth 2.0 authentication module:
- OAuth2Client with Google Photos Picker API scope
- `/auth/login`: Generates auth URL with CSRF state protection, redirects to Google
- `/auth/callback`: Exchanges code for tokens, persists to disk, sets session
- `/auth/status`: Returns authentication state (hasTokens, hasRefreshToken, tokenExpiry)
- `loadTokens()`: Restores tokens from tokens.json on startup
- `saveTokens()`: Persists tokens with refresh token merge logic
- Token refresh event listener for automatic token updates
- Exports `router` and `oAuth2Client` for use in other modules

## How OAuth Flow Works

1. User visits http://localhost:3100/auth/login
2. Server generates random CSRF state token, stores in session
3. Server redirects to Google OAuth consent screen with:
   - scope: photospicker.mediaitems.readonly
   - access_type: offline (for refresh token)
   - prompt: consent (forces refresh token)
   - state: CSRF token
4. User grants consent
5. Google redirects to /auth/callback with authorization code and state
6. Server verifies state matches (CSRF protection)
7. Server exchanges code for tokens (access_token, refresh_token, expiry_date)
8. Server calls oAuth2Client.setCredentials(tokens)
9. Server saves tokens to tokens.json with merge logic (preserves refresh_token)
10. Server sets req.session.authenticated = true
11. Server redirects to /
12. On server restart: tokens.json is loaded, oAuth2Client.setCredentials() called
13. Token refresh events automatically trigger saveTokens() to update disk

## Token Persistence Mechanism

**Critical Pattern:** Google only sends refresh_token on first authorization. Subsequent token refresh events only include access_token and expiry_date.

**Merge Logic:**
```javascript
const mergedTokens = {
  ...existingTokens,  // Load from disk
  ...tokens           // New tokens from event
};
// Preserve existing refresh_token if not in new tokens
if (!tokens.refresh_token && existingTokens.refresh_token) {
  mergedTokens.refresh_token = existingTokens.refresh_token;
}
```

This avoids Research Pitfall #2 (losing refresh token on token refresh).

**Startup Flow:**
- Server starts → auth.js loads → loadTokens() reads tokens.json → oAuth2Client.setCredentials()
- If tokens.json missing: OAuth flow required
- If tokens.json present: Authenticated state restored

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Unblocked:**
- Plan 01-02 (Picker API integration) can now use `oAuth2Client` exported from auth.js
- Plan 01-03 (Photo proxy) can now use `oAuth2Client.getAccessToken()` for image proxying
- Plan 01-04 (Health endpoint) can now report OAuth token status

**No blockers or concerns.**

## Testing Notes

### Verified Success Criteria
- ✓ User can visit /auth/login and be redirected to Google OAuth screen (route exists and generates valid auth URL)
- ✓ OAuth callback route exists at /auth/callback (handles code exchange and token storage)
- ✓ Tokens persist to tokens.json after successful OAuth (saveTokens() writes to disk)
- ✓ Server loads tokens.json on startup if it exists (loadTokens() called on module init)
- ✓ .gitignore excludes tokens.json from git (verified with `git status`)
- ✓ okno.env uses 1Password op:// references (verified with `grep`)

### Manual Testing Required
Because OAuth requires real Google credentials, full end-to-end testing requires:
1. Creating OAuth credentials in Google Cloud Console
2. Storing credentials in 1Password
3. Running server with `op run --env-file=okno.env -- node server.js`
4. Visiting /auth/login in browser
5. Completing Google consent screen
6. Verifying tokens.json is created with access_token, refresh_token, expiry_date
7. Restarting server and confirming tokens are loaded

This will be completed in Plan 01-05 (VPS deployment and end-to-end testing).

## Maintenance Notes

**Secret Management:**
- okno.env is safe to commit (contains op:// references only)
- tokens.json is gitignored and contains real OAuth tokens
- On VPS: Use `op run --env-file=okno.env -- pm2 start ecosystem.config.js`

**Session Files:**
- Stored in ./sessions/ (gitignored)
- 1-year TTL matches forever session requirement
- No cleanup needed (old sessions expire automatically)

**Token Refresh:**
- google-auth-library handles refresh automatically
- Token refresh events trigger saveTokens() to update disk
- No manual intervention needed

## Performance

**Execution Time:** 6 minutes
- Task 1 (npm install): ~1 minute
- Task 2 (server.js): ~2 minutes
- Task 3 (auth.js): ~3 minutes

**Commit History:**
- bef18f9: chore(01-01): initialize Node.js project with dependencies
- 0b45ebd: feat(01-01): create Express server with session middleware
- 0502316: feat(01-01): implement OAuth 2.0 authentication with token persistence

---

*Completed: 2026-02-09*
*Duration: 6 minutes*
*Status: All success criteria met, ready for Plan 01-02*
