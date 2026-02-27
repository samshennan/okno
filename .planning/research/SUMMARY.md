# Research Summary: v2.0 "Multi-Tenant"

**Project:** Okno
**Milestone:** v2.0 "Multi-Tenant"
**Domain:** Multi-tenant architecture + photo management grid
**Researched:** 2026-02-27
**Confidence:** HIGH

---

## Executive Summary

Okno v2.0 converts a single-user photo frame app into a multi-user system. The core challenge is not building multi-tenant from scratch -- it is a surgical refactor of modules that currently assume exactly one user. Every backend module (`auth.js`, `photo-cache.js`, `photo-proxy.js`, `config.js`, `picker.js`) shares a global `oAuth2Client` singleton and file-based JSON storage. The fundamental change is replacing those global singletons with per-user isolation keyed by `userId` from the session. The recommended approach is SQLite (`better-sqlite3`) for all persistence, a `requireAuth` middleware that attaches `req.userId` to every request, and a factory function that creates per-user OAuth clients from DB-stored tokens rather than a shared global instance. Only 2 new npm dependencies are needed.

The right stack is intentionally minimal: `better-sqlite3` + `express-rate-limit` as new production dependencies, `sharp` promoted from devDependencies, and `session-file-store` replaced with a SQLite-backed session store (or a hand-rolled 30-line implementation). No ORM, no migration library, no CLI framework, no TypeScript, no JWT. These additions would contradict the project's existing "no build step, vanilla JS" philosophy and add operational complexity that the workload does not justify. SQLite in WAL mode handles thousands of writes per second; the app's maximum load is roughly 8 writes per minute at 500 users. PostgreSQL would be pure overhead.

The primary risk is data isolation failure -- specifically, the shared `OAuth2Client` singleton causing User A's slideshow to serve User B's photos or vice versa. This is not a subtle bug; it will be immediately visible when the first family member becomes a second user. All four research files converge on the same priority: eliminate global state (OAuth client, in-memory cache, JSON files) before any other multi-tenant work proceeds. The feature dependency chain is strictly ordered: database schema and migration must land first, then per-user OAuth and session changes, then invite code gating, then per-user slideshow, then the photo management grid as a post-MVP differentiator.

---

## Key Findings

### Recommended Stack (from STACK.md)

The existing stack is validated and stays unchanged. Only four changes are needed for v2.0:

**New production dependencies:**
- `better-sqlite3` v12.6.2 -- synchronous SQLite driver; single-file DB, no daemon, trivially backupable. WAL mode supports concurrent reads with serialized writes. The app's write volume (~8 writes/min at 500 users) is far below SQLite's ceiling of thousands/sec.
- `express-rate-limit` v8.2.1 -- rate limiting for auth and invite code endpoints. Prevents brute-force abuse now that multiple users can attempt login.

**Promoted from devDependencies:**
- `sharp` ^0.34.5 -- already in the project for build scripts. Runtime thumbnail generation for the photo management grid requires it in production.

**Replaced:**
- `session-file-store` -- replaced by `better-sqlite3-session-store` (or a hand-rolled 30-line express-session Store implementation using the same DB connection). SQLite sessions share the same file as all other data and support atomic expiry cleanup.

**Explicitly rejected:** PostgreSQL (ops overhead, no benefit at this workload), Prisma/Drizzle (require TypeScript/build step), Knex (abstraction over raw SQL for 5 tables is unnecessary), JWT (instant logout is critical for a frame app; server sessions already work), Redis (another daemon; SQLite sessions are sufficient).

**New directory structure:**
```
db/          -- database.js (singleton), migrate.js (PRAGMA user_version migrations)
cli/         -- create-invite.js, list-users.js, delete-user.js, import-data.js
data/        -- okno.db, thumbnails/{userId}/{mediaItemId}.webp
```

**Net change: +2 dependencies, -1 dependency, sharp moved from dev to prod.**

### Expected Features (from FEATURES.md)

**Must have (table stakes -- required for multi-tenant to function):**
- TS-1: Per-user Google OAuth -- refactor singleton `oAuth2Client` to per-user factory function
- TS-2: Per-user data isolation -- all DB queries scoped by `user_id`, never unscoped
- TS-3: Session management -- session stores `userId` (not just `authenticated: true`)
- TS-4: Invite code access control -- gating with CLI-generated codes before OAuth
- TS-5: Per-user slideshow -- photo proxy resolves user from session, not global cache
- TS-6: Database migration -- SQLite schema replacing three JSON files
- TS-7: Auto-migration of existing data -- one-time import of `tokens.json`, `cache.json`, `config.json` as first user

**Should have (differentiators for v2.0):**
- D-1: Photo management grid -- view and remove cached photos; lazy-loading square thumbnail grid
- D-2: URL-based invite links -- `/?invite=CODE` pre-fills the code field; trivial frontend addition
- D-3: User account/profile page -- connected account info, photo count, account deletion

**Defer to post-v2.0:**
- D-4: Graceful per-user token expiry UI (reconnect overlay without crashing slideshow)
- D-5: QR code for iPad setup
- Video playback
- Open registration (blocked by Google 100-user lifetime cap for unverified apps)
- Admin dashboard UI (CLI is sufficient for invite-only scale)

**Hard constraints to design around:**
- Google's 100-user lifetime cap for unverified apps -- invite-only model is the correct design response, not a workaround
- Google Picker baseUrls expire every 60 minutes -- thumbnails cannot rely on expiring Google URLs; must be server-proxied

**All existing settings become per-user** -- there are no system-wide settings in the current `config.json`. The frontend `/api/config` API signature does not change; the backend transparently scopes to the authenticated user.

### Architecture Approach (from ARCHITECTURE.md)

The v2.0 architecture is the existing architecture with one new structural rule: every data-access path flows through a `userId` extracted from `req.session.userId`. The backend proxy pattern (already required because Google Photos URLs need Authorization headers that browser `<img>` tags cannot provide) makes server-side token storage mandatory. The earlier client-side storage decision (`.planning/decisions/MULTI-USER-ARCHITECTURE.md`, Feb 13) is superseded by this requirement.

**Major component changes:**

| Component | Change | Why |
|-----------|--------|-----|
| `db/database.js` (NEW) | Single SQLite connection, WAL mode, auto-migration on startup | All persistent state moves here |
| `auth.js` | Replace global `oAuth2Client` with `getOAuthClientForUser(userId)` factory | Core isolation fix |
| `photo-cache.js` | Replace global in-memory cache with per-user DB queries + per-user refresh scheduling | Data isolation |
| `photo-proxy.js` | Load user tokens from DB via session; stream responses instead of buffering | Isolation + performance |
| `config.js` | All settings per-user in `user_config` table | Every setting is personal |
| `server.js` | Add `requireAuth` middleware; swap session store; add invite routes | Auth enforcement |
| `photo-grid.js` (NEW) | Serve cached photo thumbnails, handle photo removal | D-1 feature |
| `refresh-scheduler.js` (NEW) | Single scheduler for all users' refresh state with jitter | Replace N independent timers |
| `demo-photos.js`, `feedback.js` | Unchanged -- not user-scoped | No change needed |

**Database schema (6 tables):** `users`, `tokens`, `photo_cache`, `user_config`, `invite_codes`, `refresh_state`. Config stored as JSON blob in `user_config` (preserves existing validated-allowlist pattern, avoids column-per-setting sprawl). Schema versioned via `PRAGMA user_version` with a hand-rolled 20-line migration runner.

**requireAuth middleware:** Mounted after session middleware, before all API routes. Attaches `req.userId` from `req.session.userId`. API requests get 401 JSON; page requests redirect to `/`. Demo, auth, and health routes bypass it. This single middleware enforces isolation across all endpoints without repeating auth logic per handler.

**Per-user baseUrl refresh:** Replace the single global `setInterval` with a central scheduler that checks every 60 seconds for users whose baseUrls are stale, with 5-minute random jitter per user to prevent thundering herd.

**Migration strategy:** On first startup with the new code, if `okno.db` does not exist but `tokens.json` does, automatically migrate existing user data as the first DB user. Wrap all inserts in a transaction. Rename JSON files to `.migrated` (keep as backup, do not delete). One-time, atomic, non-destructive.

### Critical Pitfalls (from PITFALLS.md)

**Critical severity (data leaks, security breaches):**

1. **Shared OAuth2Client singleton** -- When User B authenticates, their tokens overwrite User A's on the shared client object. User A's slideshow fetches the next photo using User B's token: 403 errors or, worse, silently serves wrong photos. Prevention: replace `oAuth2Client` export with `getOAuthClientForUser(userId)` factory. Must be resolved in Phase 1 before any second user authenticates.

2. **Single global photo cache** -- `cache.json` and the in-memory cache object have no `userId`. User B's Picker selection merges into User A's collection. The existing deduplication logic uses Google media item IDs which are unique per-library -- it provides zero cross-user protection. Prevention: DB `UNIQUE(user_id, photo_id)` constraint plus per-user in-memory `Map<userId, UserCache>`.

3. **Session fixation** -- OAuth callback sets `authenticated: true` without calling `req.session.regenerate()`. The pre-login session ID remains valid post-login, enabling session hijacking. Prevention: call `session.regenerate()` after successful OAuth callback, copy user data to new session before redirecting.

4. **Refresh token loss** -- Google issues a `refresh_token` only on first consent. Current code saves to a single `tokens.json`. With two users authenticating in sequence, User A's refresh token is permanently overwritten. User A's slideshow works for ~1 hour then fails with no recovery path except revoking and re-authenticating. Prevention: store each user's refresh token immediately in DB on OAuth callback; never overwrite with `null`.

5. **Missing `sameSite` cookie attribute** -- Current session config omits `sameSite`. Modern browsers default to `Lax`, but this is environment-dependent. POST endpoints are vulnerable to CSRF in multi-user context. Prevention: explicitly set `sameSite: 'lax'` in session cookie config.

**Moderate severity (performance degradation, bad UX):**

6. **N independent baseUrl refresh timers** -- Naive conversion creates one `setInterval` per user. At 10 users: 10 timers fire Google API calls every 50 minutes. Timer accumulation on repeated logins/logouts causes orphaned timers. Prevention: single central scheduler with per-user staleness check and jitter.

7. **Photo proxy memory buffering** -- Current proxy uses `arrayBuffer()` to load entire photos into Node.js memory before sending. With concurrent slideshow viewers this spikes memory. Prevention: stream response body via `imageResponse.body.pipe(res)`.

8. **Photo grid thumbnail load spike** -- 500 thumbnails simultaneously on grid page open exhausts server sockets. Prevention: pagination (20-50 per page), `loading="lazy"`, and per-user concurrency limit on proxy.

9. **Google 100-user unverified app warning** -- The "This app isn't verified" screen confuses non-technical users before they reach the invite code flow. Prevention: add onboarding text on login page explaining what to click; plan for Google OAuth verification before hitting 50 users.

10. **Atomic cutover for file-to-DB migration** -- A hybrid state where some code paths read files and others read DB creates race conditions with `fs.readFileSync`/`fs.writeFileSync`. Prevention: migrate ALL storage to DB in a single deployment; no fallback file reads in production code.

---

## Implications for Roadmap

The feature dependency graph from FEATURES.md maps directly to a phase structure. Each phase has a hard prerequisite from the previous phase. The architecture and pitfalls research confirms this ordering -- the shared singleton bug blocks everything else.

### Phase 1: Database Foundation + Data Migration

**Rationale:** The JSON files cannot support concurrent multi-user access. All subsequent features require a DB with per-user rows. The auto-migration of the existing user's data must happen in this phase so the production system has zero downtime on upgrade.

**Delivers:** SQLite schema (6 tables), PRAGMA user_version migration runner (`db/migrate.js`), DB connection singleton (`db/database.js`), one-time import of `tokens.json`/`cache.json`/`config.json` as first user, CLI admin scripts skeleton (`cli/`).

**Features addressed:** TS-6, TS-7

**Pitfalls avoided:** Atomic cutover (no hybrid file/DB state); data loss during migration (transaction-wrapped, files renamed not deleted).

**Research flag:** Standard patterns -- SQLite migration with PRAGMA user_version is well-documented. Skip research-phase.

---

### Phase 2: Per-User Auth + Session Hardening

**Rationale:** The shared OAuth2Client singleton is the single highest-risk bug in the codebase. Until it is replaced, adding any second user causes data leakage. Session fixation, missing sameSite, and refresh token loss all belong in this phase -- they are auth-layer security issues that must be resolved before invite codes let new users in.

**Delivers:** `getOAuthClientForUser(userId)` factory replacing global `oAuth2Client` export; `req.session.userId` replacing `req.session.authenticated`; `session.regenerate()` call on OAuth callback; `sameSite: 'lax'` on cookie config; per-user token storage in DB on OAuth callback; `requireAuth` middleware attached in `server.js`.

**Features addressed:** TS-1, TS-3

**Pitfalls avoided:** Pitfall 1 (singleton), Pitfall 3 (session fixation), Pitfall 4 (refresh token loss), Pitfall 5 (sameSite CSRF).

**Research flag:** Standard patterns -- express-session and google-auth-library multi-instance are well-documented. Skip research-phase.

---

### Phase 3: Per-User Data Isolation

**Rationale:** Once auth is per-user, the data layer must follow. Photo cache, config, and all API endpoints must be scoped by `userId`. This phase is the mechanical application of the architecture pattern: add `WHERE user_id = ?` to every query, convert photo-proxy to streaming, replace the global refresh timer with the central scheduler.

**Delivers:** `photo-cache.js` reads/writes from DB keyed by `userId`; `config.js` reads/writes per-user config rows; `photo-proxy.js` loads user's tokens from DB and streams (not buffers) responses; all API endpoints use `req.userId`; `refresh-scheduler.js` with per-user staleness tracking and jitter.

**Features addressed:** TS-2, TS-5

**Pitfalls avoided:** Pitfall 2 (shared cache), Pitfall 6 (N independent timers), Pitfall 7 (memory buffering).

**Research flag:** Standard patterns -- no research-phase needed.

---

### Phase 4: Invite Code Access Control

**Rationale:** Invite codes gate new user registration. They cannot be built until auth (Phase 2) and data isolation (Phase 3) are in place -- invite code redemption creates a new user record and requires a working session and per-user token flow. This is the "open the door" phase that makes Okno ready for a second real user.

**Delivers:** `invite_codes` table (already in schema); CLI `create-invite.js` script; landing page invite code input with URL parameter pre-fill (`?invite=CODE`); backend validation with `crypto.timingSafeEqual()`; `express-rate-limit` on redemption endpoint; session stores `pendingInviteCode` through OAuth flow; post-callback user creation linked to invite code.

**Features addressed:** TS-4, D-2 (URL invite links, trivially added alongside invite code input)

**Pitfalls avoided:** Timing attack (timingSafeEqual); brute force (rate limit); invite reuse (consumed flag in DB); Google 100-user cap (invite-only model is the architectural response, not a workaround).

**Research flag:** Standard patterns -- no research-phase needed.

---

### Phase 5: Photo Management Grid

**Rationale:** The grid is the highest-value post-MVP differentiator. It builds on all four previous phases (needs per-user DB, per-user proxy, auth middleware). Developing it after the first real second user validates the Phase 4 invite flow de-risks the core multi-tenant conversion before adding new UI complexity.

**Delivers:** `GET /api/photo/grid` endpoint with pagination; `DELETE /api/photo/:id` endpoint; `/photos.html` page with CSS Grid square thumbnail layout; `loading="lazy"` on thumbnails; skeleton loading placeholders; concurrency limit on thumbnail proxy requests; per-user thumbnail directory (`data/thumbnails/{userId}/`).

**Features addressed:** D-1

**Pitfalls avoided:** Pitfall 8 (thumbnail load spike -- pagination + lazy loading); UX Pitfall 2 (skeleton screens prevent broken appearance); Google baseUrl expiry (server-proxied thumbnails do not break when baseUrls expire).

**Research flag:** Verify Google Picker API thumbnail URL parameter format (`=w240-h240-c`) -- inferred from legacy Library API docs, needs confirmation during implementation. Run a quick spike to confirm behavior with Picker-sourced media items before building the grid endpoint. Also verify Picker session cleanup API (`DELETE /v1/sessions/{sessionId}`).

---

### Phase 6: Account Page + Polish

**Rationale:** Account page and graceful token expiry are valuable but non-blocking. Ship after the grid is proven stable. The account page provides self-service account deletion, which is a reasonable expectation for a multi-user app.

**Delivers:** `/account.html` with profile info (name, email, connected since), photo count, last sync time; account deletion endpoint with cascading DB delete; Google OAuth disconnection flow; reconnect overlay in `slideshow.html` for per-user expired tokens.

**Features addressed:** D-3, D-4

**Research flag:** Standard patterns -- no research-phase needed.

---

### Phase Ordering Rationale

- **Phases 1-4 are strictly sequential.** No per-user auth without a DB (Phase 1 before 2). No data isolation without per-user auth (Phase 2 before 3). No invite codes without isolation -- invite redemption creates a user record that requires the full auth+isolation stack (Phase 3 before 4).
- **Phase 5 (grid) can overlap Phase 4 development** (different files) but should not be shipped until the first real second user validates Phase 4 invite flow end-to-end.
- **Phase 6 is genuinely optional for the v2.0 milestone.** Phases 1-5 constitute a working multi-tenant system. Phase 6 is polish.
- **The photo grid (Phase 5) is not on the critical path for multi-tenant launch.** The MVP is Phases 1-4. Include Phase 5 in v2.0 only if time permits without rushing the auth/isolation work.

### Research Flags

**Needs deeper research during planning:**
- **Phase 5 (Photo Grid):** Google Picker API thumbnail URL parameter format (`=w240-h240-c`) is inferred from legacy Library API documentation, not explicitly confirmed for Picker API responses. Spike recommended before building the grid thumbnail endpoint.

**Standard patterns (skip research-phase):**
- **Phase 1 (DB Foundation):** better-sqlite3, PRAGMA user_version -- HIGH confidence, official documentation.
- **Phase 2 (Auth):** express-session regenerate, google-auth-library multi-instance -- well-documented.
- **Phase 3 (Data Isolation):** Mechanical application of standard multi-tenant query scoping pattern.
- **Phase 4 (Invite Codes):** crypto.randomBytes, timingSafeEqual, express-rate-limit -- standard Node.js patterns.
- **Phase 6 (Account + Polish):** Standard CRUD and session management patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against npm, official docs, and existing project code. Only 2 net-new dependencies. Alternatives evaluated and explicitly rejected with rationale. |
| Features | HIGH | Table stakes derived from codebase analysis of single-user assumptions; differentiators from established photo app UX patterns. Google 100-user cap verified against official Cloud docs. |
| Architecture | HIGH | Based on complete codebase analysis (all 12 backend + frontend files). Factory function pattern verified against google-auth-library docs. Schema designed around actual query patterns in the app. |
| Pitfalls | HIGH for data isolation + auth (verified by direct codebase analysis of auth.js, photo-cache.js, photo-proxy.js, picker.js); MEDIUM for performance estimates (memory/load projections are estimates, not measurements on live system). |

**Overall confidence:** HIGH

### Gaps to Address During Planning

1. **Google Picker thumbnail URL parameters** -- the `=w240-h240-c` format is documented for the Google Photos Library API but its exact behavior with Picker API media items is inferred, not confirmed. Validate during Phase 5 spike before building the grid endpoint.

2. **Session store package viability** -- `better-sqlite3-session-store` v0.1.0 was last updated 4 years ago. The hand-rolled 30-line Store implementation is the documented fallback if the package has issues. Decide which approach to use at the start of Phase 2; the hand-rolled version eliminates a dependency.

3. **Google Picker session concurrency limits** -- Google does not publish exact limits for concurrent Picker sessions per project. With multiple users each creating Picker sessions, this could become a blocker. Implement session cleanup (`DELETE /v1/sessions/{sessionId}`) as a precaution in Phase 3/4.

4. **Token encryption at rest** -- Research recommends AES-256-GCM encryption for stored OAuth tokens as best practice for multi-user. For an invite-only app with <20 users on a private VPS, this may be acceptable to defer. Decide before Phase 2 schema is finalized: encrypted column sizes differ from plaintext, and retrofitting encryption requires a migration.

5. **Google OAuth verification timeline** -- If user count approaches 50, the "This app isn't verified" warning becomes a real UX barrier that invite codes cannot solve. Starting the verification process (privacy policy, demo video, domain verification) in parallel with v2.0 development prevents a later blocker.

---

## Sources

### Primary (HIGH Confidence -- Official Documentation + Codebase Analysis)

- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) -- v12.6.2, downloads, Node 22 compatibility
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) -- benchmarks, synchronous API, WAL mode behavior
- [SQLite WAL mode](https://sqlite.org/wal.html) -- official SQLite concurrency documentation
- [SQLite PRAGMA user_version](https://levlaz.org/sqlite-db-migrations-with-pragma-user_version/) -- migration pattern without a library
- [sharp npm](https://www.npmjs.com/package/sharp) -- v0.34.5, WebP output, resize API
- [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit) -- v8.2.1
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) -- randomBytes, timingSafeEqual
- [Google Photos Authorization Scopes](https://developers.google.com/photos/overview/authorization) -- scope classification, verification requirements
- [Google OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server) -- token refresh, refresh_token issuance rules
- [Google Cloud Unverified Apps](https://support.google.com/cloud/answer/7454865) -- 100-user lifetime cap, verification process
- [OWASP Session Fixation](https://owasp.org/www-community/attacks/Session_fixation) -- session regenerate requirement
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) -- sameSite cookie attribute
- Direct codebase analysis: `server.js`, `auth.js`, `photo-cache.js`, `photo-proxy.js`, `config.js`, `picker.js`, `health.js` -- all files read to identify single-user assumptions and injection points

### Secondary (MEDIUM Confidence -- Community Sources)

- [better-sqlite3-session-store npm](https://www.npmjs.com/package/better-sqlite3-session-store) -- v0.1.0, 367 weekly downloads, last updated 4 years ago; hand-rolled fallback documented
- [Google API Limits and Quotas](https://developers.google.com/photos/overview/api-limits-quotas) -- rate limit estimates for multi-user refresh scheduling
- [CSS-Tricks: Seamless Responsive Photo Grid](https://css-tricks.com/seamless-responsive-photo-grid/) -- CSS Grid layout for photo management
- [MDN: Lazy Loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading) -- thumbnail loading strategy
- [Dan Schlosser: Building the Image Grid from Google Photos](https://medium.com/@danrschlosser/building-the-image-grid-from-google-photos-6a09e193c74a) -- grid UX patterns
- [Immich self-hosted photo management](https://github.com/immich-app/immich) -- multi-user architecture reference
- [Auth.js Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) -- per-user token refresh patterns

### Tertiary (LOW Confidence -- Needs Validation)

- Google Picker API thumbnail URL parameter format (`=w240-h240-c`) -- inferred from legacy Library API docs; must be confirmed during Phase 5 implementation
- Picker API concurrent session limits -- Google does not publish exact numbers; cleanup recommendation based on docs advising proactive management
- VPS memory projections with multiple concurrent in-memory caches -- estimates based on typical JSON metadata sizes, not measured on the live system

---

*Research completed: 2026-02-27*
*Ready for roadmap: yes*
