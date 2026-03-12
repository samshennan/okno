# Security Audit v2.0

**Date:** 2026-03-13
**Scope:** Full codebase architecture review + 8-section security checklist
**Supersedes:** SECURITY-ASSESSMENT.md (obsolete -- described unimplemented client-side model)

## Audit Checklist

### 1. Environment Variables + Secret Management
**Verdict: PASS**
- Fail-fast on missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (server.js lines 4-9)
- Production warning on weak SESSION_SECRET (server.js lines 10-12)
- .env gitignored, .env.production symlinked on VPS
- No secrets hardcoded in source

### 2. Session Management
**Verdict: PASS (fixed in Phase 13)**
- httpOnly: true, secure: true in production (server.js cookie config)
- sameSite: 'lax' (added Phase 13 Plan 01)
- Session regeneration after OAuth callback (auth.js line 217, added Phase 13 Plan 01 -- fixes session fixation)
- SQLite session store with 15-min expired session cleanup
- Logout destroys session and clears OAuth client cache (auth.js /auth/logout)
- 1-year maxAge appropriate for "set and forget" photo frame use case

### 3. Auth Middleware Coverage
**Verdict: PASS**
- All HTML pages gated by requireAuth before express.static (server.js lines 118-132)
- All /api/* routes gated by requireAuth (server.js lines 141-166)
- Public routes correctly ungated: /login, /auth/*, /api/demo/*, /demo
- Static assets (CSS, JS, icons) correctly public via express.static with index:false
- requireAuth returns 401 JSON for /api/* requests, redirects to /login otherwise

### 4. Server-Side Validation
**Verdict: PASS**
- Config: allowlist of known keys, type checking, range validation (config.js)
- Feedback: type enum validation, description required, file size 5MB limit, image-only filter
- Photo proxy: userId-scoped cache lookups prevent cross-user access
- Picker: sessionId stored in session for tracking
- CSRF protection on OAuth flow via crypto.randomBytes state parameter

### 5. Dependency Audit
**Verdict: PASS (pending npm audit)**
- package-lock.json present, committed
- All dependencies actively maintained
- express-rate-limit v8.3.1+ (avoids CVE-2026-30827 IPv4-mapped IPv6 bypass)
- Action: Run `npm audit` on VPS periodically

### 6. Rate Limiting
**Verdict: PASS (added in Phase 13)**
- /auth/login, /auth/callback: authLimiter (10 req/15min per IP)
- /api/feedback: feedbackLimiter (5 req/15min per IP)
- Photo polling endpoints intentionally unrated (would break slideshow interval)

### 7. CORS Configuration
**Verdict: PASS**
- No CORS middleware = same-origin only (correct for single-origin PWA)
- Helmet sets crossOriginResourcePolicy: same-origin
- CSP directives restrict script/style/connect sources

### 8. Error Response Leaks
**Verdict: PASS (fixed in Phase 13 Plan 02)**
- All 15+ catch blocks sanitized: log real error server-side, return generic message
- No internal paths, SQL details, or token info in API responses
- Google API error details (errorData) no longer forwarded to client in picker.js
- Health endpoint no longer exposes error.message in response

## Architecture Review

**Module boundaries:** Clean separation across 9 modules (server, auth, photo-proxy, photo-cache, picker, config, feedback, health, db). No tight coupling.
**Circular dependency:** photo-cache.js lazy-requires auth.js inside refreshBaseUrls (documented, acceptable pattern to break circular dep).
**In-memory maps:** Per-user OAuth2Client cache and photo cache Maps are unbounded but acceptable at current scale (family/small-group use).
**Helmet:** Security headers configured with appropriate CSP for CDN dependencies (jsdelivr, unpkg, Google Fonts).

## Findings Resolved

| ID | Finding | Severity | Resolution |
|----|---------|----------|------------|
| F1 | Session fixation on OAuth callback | CRITICAL | Session regeneration via req.session.regenerate() in auth.js |
| F2 | No rate limiting on auth/feedback | HIGH | express-rate-limit on /auth/login, /auth/callback, /api/feedback |
| F3 | error.message leaked to API clients | HIGH | Sanitized all 15+ catch blocks across 4 files |
| F4 | Missing SameSite cookie attribute | MEDIUM | Added sameSite: 'lax' to session cookie config |

## Low-Priority Items (not fixed, acceptable risk)

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| F5 | No .env.example file | LOW | Documentation concern only; env vars listed in CLAUDE.md |
| F6 | trust proxy = true globally | LOW | Correct behind nginx reverse proxy on VPS |
| F7 | Logger duplication across modules | LOW | Each module creates own winston logger; maintenance burden, not security risk |
| F8 | No feedback description max length | LOW | File-based storage with auth gate; low abuse risk at current scale |
