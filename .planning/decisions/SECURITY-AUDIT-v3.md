---
audit_version: 3
audit_date: 2026-04-30
audit_commit: 143e3aa
supersedes: SECURITY-AUDIT-v2.md
auditor: claude (security-audit skill v2)
status: draft
---

# Security Audit v3.0

**Scope:** Full 8-section re-audit post-Phase-14, diff vs v2, Phase 14 surface validation, npm-audit CVE pass, skill-quality notes for Plan 03.

**Audited tree:** HEAD `143e3aa` (`docs(15): add plans 01-03 ...`). Both Phase 14 hardening commits are reachable: `145638f` (planning backfill) and `4b7e711` ("Harden app for friend testing"). Source tree is clean (no dirty source files outside `.planning/`); the only working-tree mutation is a doc-only `.planning/STATE.md` change made by the orchestrator before this audit.

**Stack ground truth (held in memory throughout):**
Node.js + Express 4.22.1 + SQLite via `better-sqlite3` 12.6.2; sessions in `better-sqlite3-session-store`; auth via `google-auth-library` 10.6.2 (raw OAuth2Client, no Passport); `helmet` 7.2.0; `express-rate-limit` 8.3.1; `multer` 2.1.1; static HTML + vanilla JS frontend served by `express.static`; PM2-on-VPS deployment behind nginx. **NOT** Supabase, NOT Postgres, NOT serverless, NOT a framework like Next.js.

## Summary

| # | Section | v2 | v3 | Diff |
|---|---------|----|----|------|
| 1 | Env Vars + Secret Management | PASS | PASS | UNCHANGED (env.example now exists per Phase 14; closes F5) |
| 2 | Session Management (incl. DB) | PASS | PASS | STILL OPEN (no regressions; SQLite-correct verdict, **not** N/A) |
| 3 | Auth Middleware Coverage | PASS | PASS | UNCHANGED |
| 4 | Server-Side Validation | PASS | PASS (with watch) | UNCHANGED on baseline; new MISSED-IN-V2 watch around `donationUrl` HTML reflection |
| 5 | Dependency Audit | PASS (pending audit) | PASS | FIXED — `npm audit` is now clean (0 advisories, total 211 deps); v10/v2.1 bumps verified |
| 6 | Rate Limiting | PASS | PASS | UNCHANGED |
| 7 | CORS Configuration | PASS | PASS | UNCHANGED |
| 8 | Error Response Leaks | PASS | PASS | UNCHANGED; spot-check confirms v2 fixes still in place |

**Headline counts:** 8 PASS, 0 FAIL, 0 N/A, 0 PARTIAL.
**NEW CRITICAL/HIGH findings:** 0.
**NEW MEDIUM/LOW findings:** 1 (F-N1 — donationUrl rendered via `innerHTML`; defended by server-side regex but worth tightening — defer to Plan 02 triage or document as acceptable).

## Section 1 — Environment Variables + Secret Management

**Verdict: PASS**

- 1.1 No hardcoded secrets. `grep -nE "process\.env\." *.js` returns only legitimate references: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (auth.js lines 98–99, 142–143, 185–186), `SESSION_SECRET` (server.js line 77), `DONATION_URL` (auth.js line 35), `NODE_ENV`, `PORT`, `OKNO_DEBUG_HEALTH`, `ALLOWED_EMAILS` (db/seed.js — legacy seed only). No JWTs, Stripe keys, AWS keys, or 32+ char literals appear in source.
- 1.2 `.gitignore` covers `.env`, `.env.production`, `tokens.json`, `data/`, `feedback/`, `logs/`, `cache.json`, `config.json`, `okno.env`. `.env.example` is committed (per Phase 14, addressing v2 finding F5). Confirmed via `ls .env*` → only `.env.example` and `.env.production` (latter ignored) exist on this filesystem.
- 1.3 N/A — no client-side bundler (vanilla JS, no `NEXT_PUBLIC_*` / `VITE_*` / `REACT_APP_*` prefix concept). Browser code never reads env vars directly; `donationUrl` is only ever exposed via the server-validated `/auth/status` endpoint.
- 1.4 No `console.log(process.env...)` patterns. winston log lines that include `env` reference `NODE_ENV` only (server.js line 198), never secret values.
- 1.5 N/A — no source-map emission for static assets; no production bundler.
- 1.6 Fail-fast is enforced (server.js lines 4–9: `process.exit(1)` if `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` missing; lines 10–12: explicit warning if `SESSION_SECRET` missing or default in production).

**Evidence:** server.js:4-12, server.js:77, auth.js:35, auth.js:98, .gitignore (full file).
**Diff vs v2:** UNCHANGED at section level. F5 (`.env.example` absent) now closed by Phase 14.

## Section 2 — Session Management (DB variant: SQLite, **not** Supabase/Postgres)

**Verdict: PASS**

This is the section that produced spurious N/As in v2. Re-evaluating against actual stack reality:

- 2.1 (SQL/NoSQL injection) **PASS.** Every database write path uses `better-sqlite3` prepared statements with bound parameters or named bindings — no string-concatenated SQL anywhere. Concrete sites:
  - `auth.js:46-58` (`stmtUpsertTokens`) — named-param UPSERT
  - `auth.js:64-72` (`stmtUpsertUser`) — positional + named UPSERT with `RETURNING id`
  - `config.js:25-32` — positional `SELECT` and UPSERT
  - `photo-cache.js:33-46` — 8 prepared statements covering all photo cache CRUD; transactional bulk insert via `db.transaction(...)` (lines 110, 303)
  - Session store: `better-sqlite3-session-store@0.1.0` (server.js:80) writes through `better-sqlite3` only — no raw SQL surface for session payloads.
  - **No `db.exec(${...})` or `db.prepare(${...})` calls anywhere.**
- 2.2 (Least-privilege DB user) **PASS.** SQLite is a file-based DB; "user" is the OS process. The Node process runs as user `sam` under PM2 on the VPS (per CLAUDE.md / MEMORY.md), not root. No separate read-only/write-only role concept applies — this is the correct posture for embedded SQLite, not a gap.
- 2.3 (Query result scope) **PASS.** Every per-user query derives `userId` from `req.session.userId`, never from request body or query string:
  - `photo-proxy.js:27,167,180,194,207,217` — all `req.session.userId`
  - `picker.js:25,79,131` — all `req.session.userId`
  - `health.js:29,107` — same
  - `feedback.js` — feedback writes to filesystem (not DB), but is gated by `requireAuth` and tagged with timestamp/random suffix only (no user-controlled IDs).
  - `config.js` — accepts `userId` but is only ever called by routes that pass `req.session.userId` (server.js:179, 187).
  - **No site reads `req.body.userId` / `req.query.userId` and passes it to a DB query.**
- 2.4 (Schema migration hygiene) **PASS.** Migrations run automatically at startup via `db/migrate.js` invoked from `db/database.js:27-28`, gated by `PRAGMA user_version`. No ad-hoc ALTER TABLE in production paths.
- 2.5 (Sensitive column over-selection) **PASS.** `auth.js:46` selects all columns from `tokens` but the result is consumed server-side only — never serialised to the client. `/auth/status` and `/api/health` deliberately project a small subset (`hasTokens`, `hasRefreshToken`, `tokenExpiry`); raw `access_token`/`refresh_token` values never leave the server.
- 2.6 (SQLite file permissions) **PASS.** `data/okno.db` lives outside the web root (`./data/`, while `express.static` serves only `./public`); CLAUDE.md confirms it's not exposed via any route. On the VPS, the file is owned by user `sam` per MEMORY.md. Default Node `fs.mkdirSync` creates the dir with the process umask (typically `755` / `644` for the file) — fine for a single-tenant VPS.
- 2.7 (Connection string) **PASS.** DB path is computed in `db/database.js:8-9` via `path.join(__dirname, '..', 'data', 'okno.db')` — no env var needed for a single-tenant deployment, and no sensitive connection string to leak.
- 2.8 (DB error containment) **PASS.** All `try/catch` around DB calls log `error.message` server-side (winston) and either return generic `{ error: 'server_error' }` JSON or fall back silently (e.g. `auth.js:88-90`, `config.js:54,109`, `photo-cache.js:78-79,118-120,309-311`). No SQL detail reaches the client.

**Cookie/session-config posture (carries from v2):**
- httpOnly, sameSite=lax, secure-in-prod (server.js:87-92).
- 1-year maxAge — appropriate for a "set-and-forget" photo-frame use case; documented decision.
- `req.session.regenerate(...)` called inside `/auth/callback` (auth.js:222) post-token-exchange — closes session-fixation hole that was Finding F1 in v2.
- 15-min `expired.clear` interval on the session store (server.js:84) — keeps the SQLite session table from unbounded growth.
- Logout (auth.js:275-291) deletes the cached `OAuth2Client` AND destroys the session.

**N/A items: 0** (target was ≤2). All 8 SQLite-variant checks evaluated explicitly. The Supabase variant (RLS, service-role key, storage buckets, etc.) is correctly out of scope for this stack and is not enumerated as 8 false N/As — it is excluded by the "identify the database layer first" instruction in the skill.

**Evidence:** server.js:76-93; auth.js:46-58, 64-72, 77-91, 222-240, 275-291; config.js:25-32; photo-cache.js:33-46, 110, 303; db/database.js:8-28.
**Diff vs v2:** STILL OPEN (clean) — v2's PASS verdict holds, but v2 had Section 2's checklist polluted with N/A items that didn't apply. **MISSED-IN-V2** insight: v2 didn't audit better-sqlite3 prepared-statement coverage explicitly; v3 confirms that coverage is total.

## Section 3 — Auth Middleware Coverage

**Verdict: PASS**

- 3.1/3.2 `requireAuth` middleware (auth.js:126-135) gates every protected page (`/`, `/index.html`, `/slideshow.html`, `/settings.html` — server.js:142-156) and every protected API mount (`/api/picker`, `/api/photo`, `/api/health`, `/api/feedback`, `/api/config` — server.js:165-187). Public routes are explicitly enumerated: `/login`, `/auth/*`, `/api/demo/*`, `/demo` (server.js:119-138). The pattern is allowlist-of-public + default-deny, matching the safer model.
- 3.3 Session validation reads `req.session.userId` from the server-side SQLite-backed session store (`better-sqlite3-session-store`); cookie value is opaque session ID validated against the store, not a self-contained JWT.
- 3.4 `/auth/callback` (auth.js:169-245) exchanges code for tokens, fetches Google userinfo, UPSERTs the user, regenerates the session, then sets `req.session.userId`. Error paths redirect with `?error=oauth_failed` and never echo tokens or stack traces (auth.js:241-243).
- 3.5 Session cookie is httpOnly (server.js:89) — never accessible to client JS. Tokens themselves never reach the browser.
- 3.6 Every API route calls `requireAuth` (verified by inspecting `server.js` mount list line by line). Demo router is intentionally public (no per-user data, only static demo photos).
- 3.7 OAuth state parameter is generated via `crypto.randomBytes(32)` (auth.js:149), stored on session, validated on callback (auth.js:172-175); mismatch returns 403 without echoing the state value. Redirect URI is computed from `req.protocol + req.get('host')` and used for both URL generation (auth.js:145) and token exchange (auth.js:188).
- 3.8 N/A — no password reset flow (Google OAuth only).

**Evidence:** server.js:118-187; auth.js:126-135, 138-166, 169-245.
**Diff vs v2:** UNCHANGED.

## Section 4 — Server-Side Validation

**Verdict: PASS** (with one MISSED-IN-V2 watch — F-N1, MEDIUM/LOW)

- 4.1 Every state-changing API enforces server-side validation:
  - `/api/feedback` (feedback.js:70-87): `type` in `['bug','feature']`; `description` required, capped at 2000 chars; `email` capped 254 chars and validated by anchored regex; `reason` capped at 2000 chars; multer `fileFilter` cross-checks MIME (`image/jpeg|png|gif`) AND extension (`/\.(jpg|jpeg|png|gif)$/i`); `limits.fileSize: 5 * 1024 * 1024`.
  - `/api/config` (config.js:67-113): allowlisted keys, `typeof` match, range/enum validation per key.
- 4.2 All write operations derive identity from `req.session.userId` — never from request body. Confirmed by reading every `router.post`/`router.put`/`router.delete` site in the repo.
- 4.3 **MISSED-IN-V2 watch (F-N1):** `public/js/index.js:513` injects `donationUrl` into a template literal that is then assigned to `modalBody.innerHTML`. The value is reflected from `/auth/status` → server-validated by `getDonationUrl()` (auth.js:34-37) against `/^https:\/\/buy\.stripe\.com\//`. The regex anchors the prefix and the URL spec forbids quotes/brackets in unencoded paths, so a successful injection requires either (a) a misconfigured `DONATION_URL` env var that begins with `https://buy.stripe.com/` AND contains an HTML-significant character later in the path, or (b) defeating the regex. The current operator-controlled threat model makes this self-inflicted only — no untrusted input reaches the field. **Verdict for the section remains PASS;** registered as F-N1 (LOW) because defence-in-depth (encodeURI / setting `.href` directly, like `settings.js:161` does correctly) is cheap. v2 missed this entirely because the env-reflection surface was added in Phase 14.
- 4.4 HTTP method discipline: feedback uses POST; config GET/POST; logout POST (auth.js:275); picker creation POST; photo hide/unhide POST. No state-changing GETs.
- 4.5 Error responses are sanitised to generic strings (e.g. `'server_error'`, `'proxy_failed'`, `'authentication_required'`). Stack traces only land in winston logs (verified across feedback.js:240-256, photo-proxy.js:142-160, picker.js:42-72, health.js:96-101).
- 4.6 N/A — no inbound webhooks (no Stripe webhook handler — donation flow is external Payment Link, not subscriptions; no GitHub webhooks).

**Evidence:** feedback.js:25-87; config.js:67-113; auth.js:34-37; public/js/index.js:495, 513; public/js/settings.js:159-161.
**Diff vs v2:** STILL OPEN (clean) at section level; v3 surfaces F-N1 as MEDIUM/LOW MISSED-IN-V2.

## Section 5 — Dependency Audit

**Verdict: PASS** (was "PASS pending npm audit" in v2 — now resolved)

- 5.1 `npm audit --json` (run 2026-04-30 against this tree) — **0 vulnerabilities** across 211 deps (170 prod, 42 dev, 26 optional). No `info`, `low`, `moderate`, `high`, or `critical` advisories. This closes the "pending" qualifier in v2's verdict.
- 5.2 No hallucinated packages. Every dep in `package.json` is well-known and high-traffic (express, helmet, morgan, express-session, multer, google-auth-library, better-sqlite3, better-sqlite3-session-store, dotenv, winston, express-rate-limit). `better-sqlite3-session-store@0.1.0` has the lowest profile but is a maintained legitimate package and was already in use in v2.
- 5.3 `package-lock.json` is committed (verified by `git ls-files | grep package-lock.json`).
- 5.4 Version-pinning verification (resolved versions from `package-lock.json`):
  - `multer@2.1.1` ✓ (Phase 14 bumped to 2.x — closes the multer ecosystem CVE chain)
  - `google-auth-library@10.6.2` ✓ (Phase 14 bumped major; constructor + token-refresh signature compatible — verified by `node -e` smoke that all consumed methods exist on a v10.6.2 instance: `setCredentials`, `getAccessToken`, `on('tokens', ...)`, `generateAuthUrl`, `getToken`)
  - `express@4.22.1`, `express-session@1.19.0`, `helmet@7.2.0`, `express-rate-limit@8.3.1`, `better-sqlite3@12.6.2`, `dotenv@16.x`, `winston@3.x` — all current, no advisories.
  - `express-rate-limit@8.3.1` retains the IPv4-mapped IPv6 bypass fix (CVE-2026-30827 family) noted in v2.
- 5.5 No obvious unused deps (every entry in `package.json` is `require()`d in the source — confirmed by spot-check).

**Evidence:** `npm audit --json` output captured during this audit (vulnerabilities: {} / metadata.vulnerabilities all zero); package-lock.json resolved versions; package.json.
**Diff vs v2:** FIXED — v2's "pending npm audit" qualifier is now closed; bumps in Phase 14 verified.

## Section 6 — Rate Limiting

**Verdict: PASS**

- 6.1 No paid external APIs are user-triggered; Google Photos API calls happen on a fixed 50-min cache-refresh interval per user, not on demand from end users. The `/api/photo/random` proxy fetches Google with an already-cached `baseUrl` per user — no per-request quota exposure.
- 6.2 Auth + feedback endpoints are limited:
  - `/auth/login`, `/auth/callback`: `authLimiter` 10 req/15min per IP (server.js:99-105, mounted 126-127)
  - `/api/feedback`: `feedbackLimiter` 5 req/15min per IP (server.js:108-114, applied 174)
- 6.3 Implementation is `express-rate-limit@8.3.1` — in-memory by default. **Operational note:** in-memory state resets on every PM2 restart, which is acceptable for this single-process VPS deployment but would not be safe across multiple replicas. Documented as a known constraint in v2 and unchanged here. Not a finding because the deployment is single-instance.

**Evidence:** server.js:23, 99-114, 126-127, 174.
**Diff vs v2:** UNCHANGED.

## Section 7 — CORS Configuration

**Verdict: PASS**

- 7.1 No `cors` middleware is mounted — Express therefore returns no `Access-Control-Allow-Origin` header; same-origin only. Confirmed by `grep -n "cors\|Access-Control" *.js` (zero hits in source). This is correct for a single-origin PWA served from one host.
- 7.2 N/A — no `Access-Control-Allow-Credentials` exposure since no CORS at all.

**Bonus headers (helmet defaults, server.js:55-68):** `cross-origin-resource-policy: same-origin`, `cross-origin-opener-policy`, X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, Referrer-Policy, X-Permitted-Cross-Domain-Policies — all default-on via `helmet()`. CSP is custom-tightened for `script-src-attr`, `style-src-attr`, `script-src`, `style-src`, plus `img-src 'self' data: blob:` and `connect-src` allowlist for cdn.jsdelivr.net, unpkg.com, fonts.googleapis.com, fonts.gstatic.com.

**Evidence:** server.js:55-68; absence of `cors` in `package.json` and source.
**Diff vs v2:** UNCHANGED.

## Section 8 — Error Response Leaks

**Verdict: PASS**

Spot-checked every `try/catch` in the audit-relevant files post-Phase-14:

- `auth.js`: 4 catches; all log via winston and respond with redirects (`?error=oauth_failed`, `?error=session_error`) or generic `{ error: 'Failed to sign out' }`. No `error.message` reaches the client.
- `feedback.js:219-237, 240-256`: catches log via winston; client gets `{ error: 'Failed to submit feedback' }` or `{ error: 'File upload error' }` / `{ error: 'Internal server error' }`. The multer error handler explicitly does NOT forward `err.message`.
- `photo-proxy.js`: 5 catches; all return generic `{ error: 'server_error' }` / `{ error: 'proxy_failed' }`. The Google upstream status leaks back as `Google returned 502` etc., which is acceptable (no internal detail).
- `picker.js`: 3 catches; all return `{ error: 'internal_error' }` or upstream Google status.
- `health.js`: 2 catches; one returns `{ status: 'error', timestamp }` with no `error.message`; the other returns `{ success: false, error: 'Cache refresh failed' }`.
- `config.js`: errors logged with `console.error` server-side; `/api/config` POST handler (server.js:182-190) does not surface them — succeeds silently if DB write fails.
- `photo-cache.js`: errors only logged, never thrown to a client-bound layer.

No file paths, SQL, env-var names, or token data flow to client responses. v2's F3 fix (Phase 13 Plan 02) is intact.

**Evidence:** every catch block listed above; cross-checked against v2's enumeration.
**Diff vs v2:** UNCHANGED.

## Phase 14 Surface Validation

Targeted regression check on each surface Phase 14 touched. Each surface gets a verdict + the exact evidence.

### Surface 1 — CSP (no inline script/style; `script-src-attr`/`style-src-attr` = `'none'`)

- **Verdict: PASS**
- **Evidence:**
  - `grep -nE "<script[^>]*>[^<]" public/*.html` → **0 matches**.
  - `grep -nE "<style[^>]*>[^<]" public/*.html` → **0 matches**.
  - `grep -E "on(click|load|change|input|submit|error|focus|blur|keyup|keydown)\\s*=" public/*.html` (case-insensitive) → **0 matches**.
  - `grep -nE 'style\\s*=\\s*"' public/*.html` → **0 matches** (no inline style attributes either).
  - `grep -nE "scriptSrc|styleSrc|script-src|style-src|unsafe-inline" server.js`:
    - `server.js:59` `"script-src": ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com"]`
    - `server.js:60` `"script-src-attr": ["'none'"]`
    - `server.js:61` `"style-src": ["'self'", "https://fonts.googleapis.com"]`
    - `server.js:62` `"style-src-attr": ["'none'"]`
    - **`'unsafe-inline'` does NOT appear anywhere in `server.js`** (no matches in grep).
- **Diff vs v2:** NEW — Phase 14 introduced this hardening; v2 didn't audit inline-leak surface explicitly.
- **Notes:** Inline `<svg>` is present in `login.html` (lines 19–25) and the Google sign-in button (lines 37–42), but SVG is not script and is allowed by default `img-src`/`default-src 'self'`. No event handlers inside the SVG.

### Surface 2 — `/auth/status` DONATION_URL reflection

- **Verdict: PASS**
- **Evidence:** `grep -nE "getDonationUrl|DONATION_URL|buy\\.stripe\\.com" auth.js`:
  - `auth.js:34` `function getDonationUrl() {`
  - `auth.js:35` `const value = (process.env.DONATION_URL || '').trim();`
  - `auth.js:36` `return /^https:\/\/buy\.stripe\.com\//.test(value) ? value : null;`
  - `auth.js:250` `const donationUrl = getDonationUrl();`  *(used inside `/auth/status` handler)*
- The regex anchors the start with `^https://buy.stripe.com/` (literal dot escaped). Trim-then-validate ensures whitespace can't slip through. If the env var is missing or non-matching, the function returns `null`, and `/auth/status` reflects `donationUrl: null` (auth.js:257, 270) — never the raw env value.
- **Diff vs v2:** NEW (Phase 14 added this endpoint surface).
- **Notes:** F-N1 below tracks the downstream `innerHTML` reflection in `public/js/index.js:513`. The server-side gate is sound; F-N1 is a defence-in-depth observation, not a server-side issue.

### Surface 3 — multer 2.1.x resolved + safe upload defaults

- **Verdict: PASS**
- **Evidence:**
  - `node -e "console.log(require('./package-lock.json').packages['node_modules/multer'].version)"` → **`2.1.1`**.
  - `grep -nE "multer\\(|multer\\.|fileFilter|fileSize" feedback.js`:
    - `feedback.js:42` `const storage = multer.diskStorage({` (deterministic random-suffix filename, no user-controlled path component beyond extension)
    - `feedback.js:53` `const upload = multer({` with:
      - `limits.fileSize: 5 * 1024 * 1024` (line 56)
      - `fileFilter` (lines 58-66) cross-checks `hasAllowedExtension` (regex `/\.(jpg|jpeg|png|gif)$/i`) AND `hasAllowedMime` (Set `image/jpeg|png|gif`). Either failing rejects.
    - `feedback.js:241` `if (err instanceof multer.MulterError)` — error handler returns generic `{ error: 'File upload error' }`, no path/buffer leak.
- **Diff vs v2:** NEW (Phase 14 bumped multer 1.x → 2.1.1 — exits the unmaintained 1.x branch).
- **Notes:** Filename generation uses `Date.now() + Math.random()` plus `path.extname(file.originalname)`. `path.extname` returns the last `.foo` segment from the original name; since the regex+MIME filter has already accepted only `.jpg/.jpeg/.png/.gif`, traversal sequences (`../`, NUL bytes) cannot survive the filter. Safe.

### Surface 4 — google-auth-library v10 resolved + breaking-change check

- **Verdict: PASS**
- **Evidence:**
  - `node -e "console.log(require('./package-lock.json').packages['node_modules/google-auth-library'].version)"` → **`10.6.2`**.
  - `grep -nE "OAuth2Client|google\\.auth|setCredentials|getAccessToken|refreshAccessToken" auth.js`:
    - 3× `new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)` with 2-arg form (lines 97-100, 141-144, 184-187). Per v10 changelog the constructor still accepts `(clientId, clientSecret)` or `(clientId, clientSecret, redirectUri)`; both are valid.
    - `redirectUri` set explicitly via property assignment after construction (auth.js:146, 188) — supported in v10.
    - `client.setCredentials(...)` (auth.js:106-112, 219) — present.
    - `client.on('tokens', cb)` (auth.js:116-119) — event still emitted in v10.
    - `client.getAccessToken()` (used by photo-proxy.js, picker.js, photo-cache.js, health.js consumers) — still returns `{ token }` shape in v10.
    - `tempClient.generateAuthUrl({...})` (auth.js:153-158) — unchanged signature in v10.
    - `tempClient.getToken(req.query.code)` (auth.js:191) — unchanged.
  - **No removed/deprecated APIs in use.** Smoke test (`node -e`) confirms each method exists on a freshly-constructed v10.6.2 client instance.
- **Diff vs v2:** NEW (Phase 14 major-bump 9.x → 10.x).
- **Notes:** The per-user `OAuth2Client` cache pattern (clientCache `Map<userId, client>` in auth.js:32) relies on the `'tokens'` event firing during refresh, which v10 retains. Token-refresh persistence (auth.js:116-119 → `saveTokens`) is therefore unaffected by the bump.

### Surface 5 — Feedback input limits

- **Verdict: PASS**
- **Evidence:** `grep -nE "2000|254|fileFilter|email.*regex|@.*\\.|description|reason" feedback.js`:
  - Constants (feedback.js:25-28): `MAX_DESCRIPTION_LENGTH = 2000`, `MAX_REASON_LENGTH = 2000`, `MAX_EMAIL_LENGTH = 254`, `ALLOWED_IMAGE_TYPES = new Set(['image/jpeg','image/png','image/gif'])`.
  - `normalizeText` (feedback.js:36-39) trims + slices to `maxLength` — applied to `type` (cap 20), `description` (2000), `reason` (2000), `email` (254) at lines 72-75.
  - `type` enum check: `['bug','feature']` (feedback.js:77).
  - `description` required: returns 400 if empty after normalize (feedback.js:81-83).
  - Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — anchored, requires `@` and `.` and forbids whitespace; not just `includes('@')` (feedback.js:85). Returns 400 on failure.
  - `fileFilter` enforces extension + MIME both (feedback.js:58-66, also covered in Surface 3).
- **Diff vs v2:** NEW (Phase 14 added 2000-char description cap closing v2 finding F8; tightened email handling).
- **Notes:** All five sub-criteria (description ≤ 2000, email ≤ 254, anchored email regex, fileFilter ext+MIME, type allowlist) are in place.

## NEW Findings (CRITICAL/HIGH)

**None.** Phase 14 introduced no CRITICAL or HIGH regressions.

**Disposition:** No NEW CRITICAL/HIGH findings — Plan 02 is a no-op. Proceeding to Plan 03.

## NEW Findings (MEDIUM/LOW)

### Finding F-N1 — `donationUrl` reflected via `innerHTML` template literal

- **Severity:** LOW (defence-in-depth)
- **Category:** Output Encoding (CWE-79)
- **Location:** `public/js/index.js:513`
- **What's wrong:** The trusted-but-env-derived `donationUrl` value is interpolated into a template-literal HTML string assigned to `modalBody.innerHTML`:

  ```js
  document.getElementById('modalBody').innerHTML = `
    <a href="${donationUrl}" target="_blank" rel="noopener noreferrer" ...>
  `;
  ```

- **Why it matters:** The server validates `DONATION_URL` against `^https://buy.stripe.com/` (auth.js:36), which constrains the value tightly. However, `innerHTML` is a powerful sink, and the value flows through a chain (env → `/auth/status` JSON → in-memory variable → template literal). If the operator ever loosens the regex (or a future endpoint reflects user-controlled URLs through the same code path), this becomes an XSS sink. The same UI elsewhere (`public/js/settings.js:161`) sets `.href` directly — the safer pattern.
- **Repro:** Self-inflicted only at present (operator must misconfigure `DONATION_URL`). Not exploitable by external actors against the current build.
- **Fix sketch:** Build the donation `<a>` element via `document.createElement('a')` and set `.href = donationUrl` (mirroring `settings.js:161`), then `appendChild` to a constructed wrapper. Alternatively, escape the value with `encodeURI` before interpolation. **Defer to Plan 02 triage.**
- **Diff vs v2:** MISSED-IN-V2 (the env-reflection chain was added in Phase 14; v2 didn't audit it).

## STILL OPEN (carried from v2)

| ID | v2 Severity | Status in v3 | Note |
|----|-------------|--------------|------|
| F6 | LOW | STILL OPEN (acceptable) | `app.set('trust proxy', true)` — correct behind nginx; no change. |
| F7 | LOW | STILL OPEN (acceptable) | Logger duplication across modules — maintenance concern, not security. |

## FIXED Since v2

| ID | v2 Severity | Resolution |
|----|-------------|------------|
| F5 | LOW | `.env.example` now committed (Phase 14). |
| F8 | LOW | Feedback description capped at 2000 chars; email at 254; reason at 2000; anchored email regex (Phase 14, feedback.js:25-87). |
| (n/a) | — | `npm audit` clean (was "pending" in v2). |
| (n/a) | — | multer 1.x → 2.1.1 (Phase 14). |
| (n/a) | — | google-auth-library 9.x → 10.6.2 (Phase 14, no breaking-change impact on usage). |

## MISSED IN V2

These are issues v2 should have caught had the skill been sharper. They feed Plan 03 (skill refinement).

1. **`innerHTML` reflection of env-derived values not enumerated.** v2's Section 4 only checked user-input sanitisation (`dangerouslySetInnerHTML` etc.) and missed env-config-as-content surfaces. F-N1 above is the concrete instance.
2. **better-sqlite3 prepared-statement coverage was not explicitly audited.** v2 said "Section 2 PASS" but didn't enumerate every prepared statement vs every SQL string in the repo. v3 does — and confirms 100% coverage. The skill should have prompted this enumeration.
3. **Helmet CSP `script-src-attr` / `style-src-attr` directives weren't checked.** Default helmet doesn't set `*-attr` directives; v2 PASS-ed Section 7 without verifying inline event-handler protection. v3 confirms Phase 14 added them, but the skill should ask the question regardless of phase.
4. **No multer + google-auth-library version-pinning audit.** v2's "Dependency Audit" was "PASS pending npm audit" — but didn't check the Express-ecosystem majors. A version pin like `multer@^1.4.5` (a known-stale branch) would have been invisible to v2.

## Skill Notes (feeds Plan 03)

Concrete observations captured during this audit. These are the deltas the security-audit SKILL.md should incorporate.

1. **Section 2 framing assumes a binary: client-accessible (Variant A — Supabase-style) vs server-side (Variant B — SQLite/Postgres/Mongo).** The skill instruction "mark the other variant ⬚ N/A with a brief note" is good in spirit but in practice produced **8 spurious N/A items in v2** (one per Variant A check) because the auditor didn't terminate the Variant A enumeration cleanly. **Skill fix:** make the variant selection a hard gate — once Variant B is identified, skip Variant A entirely (don't list each Variant A check as N/A). State the gate explicitly: "If you identify Variant B, write a single line 'Variant A N/A: stack is not Supabase/Firebase/PocketBase' and proceed only through Variant B's 8 checks." This alone closes the v2 false-N/A bloat that produced the "≤2 false N/As" Phase 15 success criterion.

2. **`'unsafe-inline'` and `script-src-attr` / `style-src-attr` aren't called out in any CSP-related section.** The skill's Section 7 is "CORS Configuration" — CSP gets folded in via "what's already done right" or appears nowhere. **Skill fix:** add an explicit "Content Security Policy" subsection (perhaps Section 7.3 / 7.4) that enumerates: (a) `'unsafe-inline'` in `script-src`/`style-src` is FAIL by default; (b) absence of `script-src-attr 'none'` is PARTIAL when inline event handlers exist anywhere in the static HTML; (c) presence of `'unsafe-eval'` is FAIL absent justification; (d) `connect-src` allowlist matches network calls in the codebase. v2 missed the inline-attr surface entirely; v3 only caught it because Phase 14 explicitly added the directives.

3. **Env-derived values reflected to the browser are not on the checklist.** Section 4 (Server-Side Validation) covers user-input → DOM, and Section 1 covers secrets-in-source — but values like `DONATION_URL` that come from `process.env` and flow through a JSON API into client-side `innerHTML` fall in a gap. **Skill fix:** add a check (proposed as Section 4.7): "Env-derived values reflected to the browser must be (a) validated server-side against an explicit allowlist or anchored regex AND (b) rendered into the DOM via property assignment (e.g. `.href = value`, `.textContent = value`) rather than `innerHTML` template literals — even when the regex is tight, defence-in-depth applies because regexes drift."

4. **(Bonus, worth keeping)** **Dependency-major-bump verification is implicit in 5.4 ("outdated packages") but not in the verdict format.** When a project bumps a major (multer 1→2, google-auth-library 9→10), the audit should explicitly call out (a) resolved version, (b) consumed API surface compatibility (constructor sig, key methods, event names), (c) any deprecation warnings on smoke-test. v3 did this for both bumps; v2's framing wouldn't have prompted it. **Skill fix:** add to Section 5: "for any major-version bump since the prior audit, smoke-test the consumed method surface with `node -e` against the new version and record the methods explicitly in evidence."

## Notes for Plan 02 (fixes)

- F-N1 is LOW and self-inflicted-only. Plan 02 may either (a) tighten `index.js:513` to use `.href` assignment + element construction, or (b) document acceptance and close. No CRITICAL/HIGH fixes required, which simplifies Plan 02 significantly.
- The `npm audit` clean state should be re-verified at Plan 02 close to ensure no introduced fix pulls in a vulnerable transitive.

## Notes for Plan 03 (skill refinement)

- The four Skill Notes above are the candidate edits. Plan 03 should pick **at least one** concrete change — the variant-gating fix (Skill Note 1) is the highest-leverage and is exactly the failure mode that drove this entire phase.
