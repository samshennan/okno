# Phase 13: Architecture Review + Security Audit - Research

**Researched:** 2026-03-12
**Domain:** Node.js/Express security hardening, architecture review
**Confidence:** HIGH

## Summary

This phase audits the OKNO codebase for architectural issues and security vulnerabilities across 8 checklist areas. Research was conducted by reading every backend module (`server.js`, `auth.js`, `photo-proxy.js`, `photo-cache.js`, `picker.js`, `config.js`, `feedback.js`, `health.js`, `demo-photos.js`, `db/database.js`, `db/migrate.js`) and evaluating them against OWASP session management guidelines, Express security best practices, and the 8 checklist sections defined in the phase scope.

The existing `.planning/decisions/SECURITY-ASSESSMENT.md` is **fully obsolete** -- it describes a client-side storage model (IndexedDB, JWTs, SubtleCrypto) that was never implemented. The actual implementation uses server-side SQLite with express-session. That document should be superseded entirely by the new `SECURITY-AUDIT-v2.md`.

**Primary recommendation:** Fix the 3 CRITICAL/HIGH findings (session fixation, missing rate limiting, error message leaks) and document all 8 checklist verdicts in a structured audit report.

## Findings by Checklist Section

### 1. Environment Variables + Secret Management

**Verdict: PASS with notes**
**Confidence: HIGH** (direct code review)

**What's good:**
- `server.js:4-9` -- Fail-fast on missing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- `server.js:10-12` -- Warns on weak `SESSION_SECRET` in production
- `.env` is gitignored (confirmed by `.gitignore`)
- `.env.production` is symlinked on VPS, not committed

**Issues found:**
- NONE critical. The env var handling is solid.

**Minor observations:**
- `SESSION_SECRET` fallback to `'dev-secret-change-in-production'` is safe because it only triggers in development. The production warning catches misconfiguration.
- No `.env.example` file exists for documenting required variables (LOW priority, documentation concern only)

---

### 2. Session Management

**Verdict: FAIL -- CRITICAL finding (session fixation)**
**Confidence: HIGH** (direct code review + OWASP guidelines)

**What's good:**
- `httpOnly: true` on session cookie (`server.js:86`)
- `secure: true` in production (`server.js:85`)
- `saveUninitialized: false` prevents empty session creation (`server.js:79`)
- Session store uses SQLite with 15-minute expired session cleanup (`server.js:78-83`)
- Logout properly destroys session and clears OAuth client cache (`auth.js:252-268`)

**CRITICAL -- Session fixation vulnerability:**
In `auth.js:217`, after successful OAuth callback, the code sets `req.session.userId = userId` on the **existing session** without calling `req.session.regenerate()`. This means the session ID from before authentication persists after authentication. An attacker who can set or observe a pre-auth session ID can hijack the authenticated session.

**Fix required:**
```javascript
// In auth.js callback, BEFORE setting userId:
const oauthState = req.session.oauthState; // preserve needed data
req.session.regenerate((err) => {
  if (err) {
    logger.error('Session regeneration failed:', { error: err.message });
    return res.redirect('/login?error=session_error');
  }
  req.session.userId = userId;
  // Continue with redirect
  res.redirect('/');
});
```

**Missing: SameSite cookie attribute.**
The session cookie configuration in `server.js:84-88` does not set `sameSite`. Express-session defaults to `undefined`, which means the browser uses its default (typically `Lax` in modern browsers). Explicitly setting `sameSite: 'lax'` is best practice.

---

### 3. Auth Middleware Coverage

**Verdict: PASS**
**Confidence: HIGH** (direct code review of all route mounts)

**All routes audited in `server.js`:**

| Route | Auth | Correct? |
|-------|------|----------|
| `GET /login` | None | YES -- public login page |
| `/auth/*` | None | YES -- OAuth flow must be pre-auth |
| `/api/demo/*` | None | YES -- demo mode, isolated module |
| `GET /demo` | None | YES -- demo page |
| `GET /` | `requireAuth` | YES |
| `GET /index.html` | `requireAuth` | YES |
| `GET /slideshow.html` | `requireAuth` | YES |
| `GET /settings.html` | `requireAuth` | YES |
| `express.static` | None | Partial -- see note |
| `/api/picker/*` | `requireAuth` | YES |
| `/api/photo/*` | `requireAuth` | YES |
| `/api/health` | `requireAuth` | YES |
| `/api/feedback` | `requireAuth` | YES |
| `/api/config` | `requireAuth` | YES |

**Note on static assets:** `express.static` serves CSS, JS, icons, manifest, and `sw.js` without auth. This is **correct** -- these are public assets. The `index: false` option prevents serving `index.html` for `/`, which is gated separately. HTML pages are all gated individually before the static middleware.

**`/auth/status` endpoint:** Returns auth status without `requireAuth`. This is intentional -- it's used by the frontend to check if the user is logged in. It returns only boolean flags and token expiry (no sensitive data). ACCEPTABLE.

---

### 4. Server-Side Validation

**Verdict: PASS with minor issues**
**Confidence: HIGH** (direct code review)

**Config validation (`config.js:73-98`):** GOOD
- Allowlist of known keys (skips unknown keys)
- Type checking against defaults
- Range validation for `interval` (5-600), `displayMode` enum, `transitionTime` (0.5-5)

**Feedback validation (`feedback.js:58-65`):** GOOD
- Type must be `'bug'` or `'feature'`
- Description required
- Multer limits file size (5MB) and filters by extension

**Picker session ID (`picker.js`):** MEDIUM risk
- `req.params.sessionId` is passed directly to Google Picker API URL. Since this is used as a URL segment in a Google API call, injection risk is low (Google validates the ID). However, no validation that the session ID belongs to the requesting user beyond the OAuth token scope.

**Photo proxy (`photo-proxy.js`):** GOOD
- `req.params.mediaItemId` is looked up in per-user cache (`photoCache.hideItem(req.session.userId, ...)`), so cross-user access is prevented by the userId scoping.
- Query params `onThisDay` and `portrait` are compared against string literals, safe.

**Minor issue -- feedback description length:**
No max length on `description` or `reason` fields in feedback. A malicious user could submit very large strings. LOW priority since feedback writes to files, not DB queries.

---

### 5. Dependency Audit

**Verdict: NEEDS REVIEW**
**Confidence: MEDIUM** (could not run `npm audit` in this environment)

**Lockfile:** `package-lock.json` exists. GOOD.

**Dependencies (from `package.json`):**

| Package | Version | Notes |
|---------|---------|-------|
| better-sqlite3 | ^12.6.2 | Native addon, actively maintained |
| better-sqlite3-session-store | ^0.1.0 | Small wrapper, low attack surface |
| dotenv | ^16.4.5 | Stable, no known issues |
| express | ^4.18.2 | Stable LTS line |
| express-session | ^1.18.0 | Stable |
| google-auth-library | ^9.14.1 | Google-maintained |
| helmet | ^7.1.0 | Security headers |
| morgan | ^1.10.0 | Logging |
| multer | ^2.0.2 | File upload |
| winston | ^3.11.0 | Logging |

**sharp is in devDependencies:** `"sharp": "^0.34.5"` is listed under `devDependencies`, which means it is NOT installed in production (`npm install --production`). If thumbnails or any sharp-dependent features are used in production, this is a bug. However, no code imports sharp directly -- the thumbnail endpoint proxies from Google at a smaller size, not using local sharp processing. So this is fine -- sharp was likely added for a build-time task.

**Action needed:** Run `npm audit` on the VPS to check for known vulnerabilities. Cannot be done in this research environment.

---

### 6. Rate Limiting

**Verdict: FAIL -- HIGH finding (no rate limiting at all)**
**Confidence: HIGH** (grep confirms zero usage)

**Current state:** `express-rate-limit` is NOT installed (not in `package.json`, not in `node_modules`, zero imports in any `.js` file). Despite being referenced extensively in planning documents as a decision, it was never implemented.

**Routes that need rate limiting:**

| Route | Risk | Recommended Limit |
|-------|------|-------------------|
| `GET /auth/login` | OAuth initiation abuse | 10 req/15min per IP |
| `GET /auth/callback` | OAuth callback replay | 10 req/15min per IP |
| `POST /api/feedback` | Spam/disk filling | 5 req/15min per IP |
| `POST /api/picker/start` | Google API quota consumption | 10 req/15min per user |
| `POST /api/health/refresh` | Forced cache refresh abuse | 5 req/15min per user |

**Lower priority (already auth-gated):**
- `GET /api/photo/random` -- polled by slideshow, rate limiting would break normal use. Skip.
- `GET /api/config`, `POST /api/config` -- low abuse potential behind auth

**Implementation:**
```bash
npm install express-rate-limit@^8.3.1
```

```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many attempts, try again later' }
});

// Apply to auth routes
app.use('/auth/login', authLimiter);
app.use('/auth/callback', authLimiter);
```

**Important CVE:** express-rate-limit versions 8.0.0-8.2.1 have CVE-2026-30827 (IPv4-mapped IPv6 addresses bypass rate limiting on dual-stack servers). Use v8.3.1 or later.

---

### 7. CORS Configuration

**Verdict: PASS (by default)**
**Confidence: HIGH** (direct code review)

**Current state:** No `cors` middleware is installed or configured. Express does not set CORS headers by default, which means:
- Same-origin requests work normally (browser to same VPS)
- Cross-origin requests are blocked by browsers

This is **correct** for OKNO's architecture: the frontend is served from the same origin as the API. No cross-origin access is needed. No action required.

**Helmet's `crossOriginResourcePolicy`:** Helmet v7 sets this to `same-origin` by default. This is correct and adds defense-in-depth.

---

### 8. Error Response Leaks

**Verdict: FAIL -- HIGH finding (error.message exposed to clients)**
**Confidence: HIGH** (direct code review)

**Multiple endpoints return `error.message` to the client:**

| File | Line | Response |
|------|------|----------|
| `photo-proxy.js` | 161 | `{ error: 'proxy_failed', message: error.message }` |
| `photo-proxy.js` | 176 | `{ error: 'server_error', message: error.message }` |
| `photo-proxy.js` | 190 | `{ error: 'server_error', message: error.message }` |
| `photo-proxy.js` | 201 | `{ error: 'server_error', message: error.message }` |
| `photo-proxy.js` | 212 | `{ error: 'server_error', message: error.message }` |
| `photo-proxy.js` | 255 | `{ error: 'proxy_failed', message: error.message }` |
| `picker.js` | 73 | `{ error: 'internal_error', message: error.message }` |
| `picker.js` | 127 | `{ error: 'internal_error', message: error.message }` |
| `picker.js` | 197 | `{ error: 'internal_error', message: error.message }` |
| `feedback.js` | 216 | `{ error: 'Failed to submit feedback', details: error.message }` |
| `health.js` | 74 | `{ status: 'error', error: error.message }` |
| `health.js` | 93 | `{ error: error.message }` |

**Also:** `photo-proxy.js:144` logs `error.stack` (to logger only, not to client -- this is fine).

**Risk:** Error messages from Node.js, SQLite, and Google APIs can contain internal paths, SQL details, token fragments, or stack traces. These should never reach the client.

**Fix pattern:**
```javascript
// BAD
res.status(500).json({ error: 'server_error', message: error.message });

// GOOD
logger.error('Operation failed:', { error: error.message, stack: error.stack });
res.status(500).json({ error: 'server_error', message: 'An internal error occurred' });
```

---

## Architecture Review Findings

### Module Boundaries Assessment

| Module | Responsibility | Coupling | Verdict |
|--------|---------------|----------|---------|
| `auth.js` | OAuth + session + per-user client cache | Exports `getOAuth2ClientForUser` + `requireAuth` + router | CLEAN |
| `photo-cache.js` | In-memory + SQLite photo cache | Lazy-requires `auth.js` for token refresh | ACCEPTABLE (documented) |
| `photo-proxy.js` | Image proxy + hide/unhide | Imports from `auth.js` + `photo-cache.js` | CLEAN |
| `picker.js` | Google Picker API flow | Imports from `auth.js` + `photo-cache.js` | CLEAN |
| `config.js` | Per-user settings | Only imports `db/database.js` | CLEAN |
| `feedback.js` | File-based feedback storage | Standalone (multer + fs) | CLEAN |
| `health.js` | Diagnostics endpoint | Imports from `auth.js` + `photo-cache.js` | CLEAN |
| `demo-photos.js` | Demo mode | Fully isolated | CLEAN |
| `db/database.js` | SQLite singleton | No app-level imports | CLEAN |

### Circular Dependency

`photo-cache.js` lazy-requires `auth.js` inside `refreshBaseUrls()` to break a circular dependency. This is a known pattern, documented in CLAUDE.md, and works correctly because:
1. `auth.js` never requires `photo-cache.js`
2. The lazy require happens at function call time, not module load time
3. By the time `refreshBaseUrls` runs, both modules are fully loaded

**Verdict:** ACCEPTABLE. No refactoring needed.

### Structural Risks

1. **Logger duplication:** Every module creates its own `winston.createLogger()` with identical configuration. This is not a security risk but is a maintenance burden. Consider a shared `lib/logger.js`.

2. **`trust proxy` set to `true`:** In `server.js:50`, `app.set('trust proxy', true)` trusts ALL proxy headers. Behind nginx on a VPS this works, but if the app were ever exposed directly, clients could spoof their IP. More restrictive settings like `'loopback'` or `1` are safer. LOW priority since the app is always behind nginx.

3. **In-memory maps never evict:** `clientCache` in `auth.js`, `userCaches` in `photo-cache.js`, and `userConfigs` in `config.js` grow unbounded. With the current user count (family use), this is fine. At scale, this would be a memory concern. LOW priority.

4. **Feedback writes to filesystem:** `feedback.js` writes markdown, JSON, and CSV files to `./feedback/`. No size limits on accumulated feedback. A determined user could fill disk. LOW priority for family use.

---

## Standard Stack

### For Rate Limiting (the only new dependency)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express-rate-limit | ^8.3.1 | IP-based rate limiting | De facto standard for Express, 10M+ weekly downloads |

**Installation:**
```bash
npm install express-rate-limit@^8.3.1
```

**IMPORTANT:** Use v8.3.1+ to avoid CVE-2026-30827 (IPv4-mapped IPv6 bypass on dual-stack servers).

### Already Installed (no changes needed)

| Library | Purpose | Status |
|---------|---------|--------|
| helmet ^7.1.0 | Security headers + CSP | Working correctly |
| express-session ^1.18.0 | Session management | Working (needs fixation fix) |
| better-sqlite3-session-store ^0.1.0 | Session persistence | Working correctly |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom counter middleware | `express-rate-limit` | Handles edge cases (IPv6, proxy headers, window sliding) |
| Security headers | Manual header setting | `helmet` (already used) | 15+ headers configured correctly by default |
| CSRF for OAuth | Custom token system | The existing `crypto.randomBytes(32)` state parameter | Already correctly implemented |
| Session store | File-based or custom | `better-sqlite3-session-store` (already used) | Handles cleanup, serialization, concurrency |

---

## Common Pitfalls

### Pitfall 1: Session Fixation After OAuth
**What goes wrong:** Session ID persists through authentication, allowing pre-auth session hijacking
**Why it happens:** `express-session` does not auto-regenerate on privilege change
**How to avoid:** Call `req.session.regenerate()` after successful OAuth callback, before setting `userId`
**Warning signs:** Same session cookie before and after login

### Pitfall 2: Error Message Information Disclosure
**What goes wrong:** Internal error details (paths, SQL, token info) leak to API clients
**Why it happens:** Catch blocks pass `error.message` directly into JSON responses
**How to avoid:** Log the real error server-side, return generic message to client
**Warning signs:** API responses containing file paths, SQL syntax, or "SQLITE_" prefixes

### Pitfall 3: Rate Limit Bypass on Dual-Stack Servers
**What goes wrong:** All IPv4 clients share a single rate limit bucket
**Why it happens:** CVE-2026-30827 in express-rate-limit < 8.3.0
**How to avoid:** Use express-rate-limit v8.3.1+
**Warning signs:** Legitimate users getting 429 errors they didn't cause

### Pitfall 4: Session Regeneration Breaks Async Flow
**What goes wrong:** `req.session.regenerate()` is async (callback-based), and data from the old session is lost
**Why it happens:** Regenerate creates a brand new session object, discarding all old properties
**How to avoid:** Save any needed session data (like `oauthState`) before regenerate, restore userId after
**Warning signs:** Lost session data after login, redirect loops

---

## Code Examples

### Session Fixation Fix (auth.js callback)
```javascript
// After successful token exchange and user upsert:
const userId = userRow.id;
saveTokens(userId, tokens);

// Regenerate session to prevent fixation
req.session.regenerate((err) => {
  if (err) {
    logger.error('Session regeneration failed:', { error: err.message });
    return res.redirect('/login?error=session_error');
  }

  // Create/update per-user OAuth2Client with fresh credentials
  const userClient = getOAuth2ClientForUser(userId);
  userClient.setCredentials(tokens);

  // Set userId on the NEW session
  req.session.userId = userId;

  // Save session before redirect to ensure it's persisted
  req.session.save((saveErr) => {
    if (saveErr) {
      logger.error('Session save failed:', { error: saveErr.message });
      return res.redirect('/login?error=session_error');
    }
    logger.info('OAuth callback successful', { userId, email: userEmail });
    res.redirect('/');
  });
});
```

### Rate Limiting Setup (server.js)
```javascript
const rateLimit = require('express-rate-limit');

// Auth endpoints: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many attempts, please try again later' }
});

// Feedback: 5 requests per 15 minutes per IP
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many submissions, please try again later' }
});

// Apply before route handlers
app.use('/auth/login', authLimiter);
app.use('/auth/callback', authLimiter);
app.use('/api/feedback', feedbackLimiter);
```

### Error Response Sanitization Pattern
```javascript
// Replace this pattern throughout:
// BEFORE:
res.status(500).json({ error: 'server_error', message: error.message });

// AFTER:
logger.error('Operation failed:', { error: error.message });
res.status(500).json({ error: 'server_error' });
```

### SameSite Cookie Addition (server.js)
```javascript
cookie: {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax',  // ADD THIS
  maxAge: 365 * 24 * 60 * 60 * 1000
}
```

---

## Severity Summary

| ID | Finding | Severity | Checklist Section | Fix Complexity |
|----|---------|----------|-------------------|----------------|
| F1 | Session fixation (no regenerate after OAuth) | CRITICAL | 2. Session Management | Low (10 lines) |
| F2 | No rate limiting on any endpoint | HIGH | 6. Rate Limiting | Low (install + 20 lines) |
| F3 | error.message leaked to clients in 12+ endpoints | HIGH | 8. Error Response Leaks | Medium (touch 5 files) |
| F4 | Missing SameSite cookie attribute | MEDIUM | 2. Session Management | Trivial (1 line) |
| F5 | No .env.example for required variables | LOW | 1. Env Variables | Trivial (1 file) |
| F6 | trust proxy set to true (overly permissive) | LOW | Architecture | Trivial (1 line) |
| F7 | Logger duplication across modules | LOW | Architecture | Optional refactor |
| F8 | Feedback description has no max length | LOW | 4. Validation | Trivial (1 check) |

**CRITICAL/HIGH findings (F1, F2, F3) must be fixed in this phase.**
**MEDIUM findings (F4) should be fixed.**
**LOW findings (F5-F8) are optional improvements.**

---

## Open Questions

1. **npm audit results:** Cannot run `npm audit` in this environment. Must be run on the VPS or in a Node.js-capable shell. May surface additional dependency vulnerabilities.

2. **express-rate-limit store:** The default in-memory store resets on server restart. For a single-process PM2 deployment this is fine. If the app ever scales to cluster mode, a shared store (like `rate-limit-redis`) would be needed. Not a concern at current scale.

3. **Picker sessionId validation:** `req.params.sessionId` in picker routes is not validated for format before being sent to Google. Google handles validation, but a regex check (e.g., alphanumeric + hyphens) would add defense-in-depth. LOW priority.

---

## Sources

### Primary (HIGH confidence)
- Direct code review of all `.js` files in repository root and `db/` directory
- OWASP Session Fixation Protection guidelines
- Express-session documentation (session.regenerate behavior)

### Secondary (MEDIUM confidence)
- [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit) -- v8.3.1, 10M+ weekly downloads
- [CVE-2026-30827](https://github.com/express-rate-limit/express-rate-limit/security/advisories/GHSA-46wh-pxpv-q5gq) -- IPv4-mapped IPv6 bypass, fixed in 8.3.0+
- [OWASP Session Fixation Protection](https://owasp.org/www-community/controls/Session_Fixation_Protection) -- session regeneration best practice

### Tertiary (LOW confidence)
- npm audit results are unknown (could not run in this environment)

## Metadata

**Confidence breakdown:**
- Checklist findings: HIGH -- all based on direct code review
- Architecture review: HIGH -- complete module graph analyzed
- Rate limiting recommendation: HIGH -- express-rate-limit is the established standard
- npm audit: LOW -- could not execute, flagged as action item

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable stack, no fast-moving dependencies)
