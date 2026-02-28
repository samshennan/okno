# Roadmap: Okno

## Milestones

- **v1.0 MVP** -- Phases 1-3 (shipped 2026-02-15)
- **v1.1 Make It Shine** -- Phases 4-7 (Phases 4-6 shipped 2026-02-16, Phase 7 deferred)
- **v2.0 Multi-Tenant** -- Phases 8-12 (planned)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) -- SHIPPED 2026-02-15</summary>

- [x] Phase 1: Backend + Deployment (5/5 plans) -- completed 2026-02-10
- [x] Phase 2: Slideshow + PWA (3/3 plans) -- completed 2026-02-13
- [x] Phase 3: Advanced Features (3/3 plans) -- completed 2026-02-13

See `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.1 "Make It Shine" (Phases 4-7) -- Phases 4-6 SHIPPED 2026-02-16</summary>

- [x] Phase 4: Bug Fixes + Stability (3/3 plans) -- completed 2026-02-15
- [x] Phase 5: Visual Effects + Overlays (3/3 plans) -- completed 2026-02-15
- [x] Phase 6: Stripe + Demo Mode (3/3 plans) -- completed 2026-02-16
- [ ] Phase 7: README + Portfolio Polish -- deferred to v2.0 Phase 12

**Phase 4: Bug Fixes + Stability**
Goal: Users experience a reliable, bug-free slideshow regardless of how they interact with the app.
Requirements: BUGFIX-01 through BUGFIX-06, DEPLOY-01

**Phase 5: Visual Effects + Overlays**
Goal: The slideshow delivers a cinematic viewing experience with smooth Ken Burns zoom/pan, blurred background fill, and contextual date/time overlays.
Requirements: VISUAL-01 through VISUAL-05, OVERLAY-01 through OVERLAY-03

**Phase 6: Stripe + Demo Mode**
Goal: Visitors can experience Okno without Google auth and supporters can donate with one click.
Requirements: PAY-01, PAY-02, DEMO-01 through DEMO-04

**Phase 7: README + Portfolio Polish**
Goal: The GitHub repository communicates product quality at a glance.
Requirements: PORT-01 through PORT-04 -- absorbed into v2.0 Phase 12.

</details>

---

### v2.0 "Multi-Tenant"

**Goal:** Transform Okno from a single-user app into a multi-tenant platform where multiple Google users can each run their own photo frame with isolated data, invite-based access, a photo management grid, and a polished GitHub README.

---

### Phase 8: Database Foundation + Data Migration

**Goal:** All persistent storage moves from file-based JSON to a proper database, and the existing user's data migrates automatically with zero downtime.

**Depends on:** Phase 6 (shipped v1.1 codebase)

**Requirements:** DB-01, DB-02, DB-03

**Success Criteria** (what must be TRUE):
1. App starts up using SQLite for all persistent storage -- no reads from tokens.json, cache.json, or config.json in production code paths
2. Existing user's photos, tokens, and settings appear in the database as the first user account after upgrade -- no manual intervention required
3. Original JSON files are preserved as .migrated backups -- no data loss even if migration has issues

**Plans:** 3 plans

Plans:
- [x] 08-01-PLAN.md -- Database foundation (better-sqlite3, schema, migration runner, JSON-to-DB seed)
- [x] 08-02-PLAN.md -- Replace config.js + auth.js JSON persistence with DB queries
- [x] 08-03-PLAN.md -- Replace photo-cache.js + session store with DB, VPS deploy verification

---

### Phase 9: Per-User Auth + Data Isolation

**Goal:** Multiple Google accounts can authenticate independently, and each user's photos, tokens, settings, and slideshow are fully isolated from every other user.

**Depends on:** Phase 8 (database must exist for per-user storage)

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, ISOL-01, ISOL-02, ISOL-03, ISOL-04

**Success Criteria** (what must be TRUE):
1. Two different Google accounts can be authenticated simultaneously -- User A's session is independent of User B's session
2. User A's slideshow shows only User A's photos -- never User B's photos, even when both are active
3. User A's settings changes (interval, Ken Burns toggle, etc.) do not affect User B's settings
4. A token refresh or expiry for User A does not interrupt User B's slideshow
5. All API routes resolve the current user from the session -- no global state or singleton OAuth client

**Plans:** 3 plans

Plans:
- [ ] 09-01-PLAN.md -- Auth foundation + per-user OAuth2Client + login page + route protection
- [ ] 09-02-PLAN.md -- Per-user data isolation (picker, photo-proxy, health, photo-cache, config)
- [ ] 09-03-PLAN.md -- Frontend auth flows (reconnect overlay, logout button, 401 handling)

---

### Phase 10: Access Control + Admin + Resilience

**Goal:** New users join via invite codes, admins manage the system from the CLI, expired tokens degrade gracefully, and iPads can be set up by scanning a QR code.

**Depends on:** Phase 9 (invite code redemption creates a user record that requires the full auth + isolation stack)

**Requirements:** ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04, EXPIRY-01, EXPIRY-02, EXPIRY-03, ADMIN-01, ADMIN-02, ADMIN-03, SETUP-01

**Success Criteria** (what must be TRUE):
1. A new user enters an invite code, signs in with Google, and lands in their own isolated photo frame -- the full onboarding flow works end-to-end
2. An expired or already-used invite code shows a clear error message -- no silent failures or confusing redirects
3. An invite code pre-filled via URL parameter (?invite=CODE) skips the manual entry step
4. When a user's Google token expires or is revoked, their slideshow shows a reconnect overlay instead of crashing -- and other users are unaffected
5. Admin can generate invite codes, list users with photo counts, and delete a user with all their data via CLI commands on the VPS

**Plans:** TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD
- [ ] 10-03: TBD

---

### Phase 11: Photo Management Grid

**Goal:** Users can view and manage their cached photo collection through a thumbnail grid interface.

**Depends on:** Phase 9 (per-user data isolation must be complete for the grid to show only the current user's photos)

**Requirements:** GRID-01, GRID-02, GRID-03, GRID-04

**Success Criteria** (what must be TRUE):
1. User sees a grid of thumbnail images representing all their cached photos
2. User can select and remove unwanted photos from their cache -- removed photos no longer appear in the slideshow
3. Grid loads smoothly with large collections (2000 photos) -- thumbnails appear progressively, no page freeze or server overload

**Plans:** TBD

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

---

### Phase 12: Portfolio Polish

**Goal:** The GitHub repository communicates product quality, technical depth, and product leadership at a glance -- documenting the completed multi-tenant product.

**Depends on:** Phases 8-11 (documents the completed v2.0 product; absorbs deferred v1.1 Phase 7 scope)

**Requirements:** PORT-01, PORT-02, PORT-03, PORT-04

**Success Criteria** (what must be TRUE):
1. GitHub visitor sees a hero image or GIF showing the multi-user slideshow in action within the first scroll
2. Architecture diagram (Mermaid) communicates the multi-tenant system design -- database, per-user auth, isolation, invite flow -- without needing to read code
3. Product decisions section explains key tradeoffs (SQLite over Postgres, invite codes over open registration, server-side tokens over client-side, etc.)
4. Live demo link lets an interviewer experience the product in under 10 seconds

---

## v2.0 Coverage

| Requirement | Phase | Category |
|-------------|-------|----------|
| DB-01 | Phase 8 | Database & Migration |
| DB-02 | Phase 8 | Database & Migration |
| DB-03 | Phase 8 | Database & Migration |
| AUTH-01 | Phase 9 | Authentication |
| AUTH-02 | Phase 9 | Authentication |
| AUTH-03 | Phase 9 | Authentication |
| AUTH-04 | Phase 9 | Authentication |
| ISOL-01 | Phase 9 | Data Isolation |
| ISOL-02 | Phase 9 | Data Isolation |
| ISOL-03 | Phase 9 | Data Isolation |
| ISOL-04 | Phase 9 | Data Isolation |
| ACCESS-01 | Phase 10 | Access Control |
| ACCESS-02 | Phase 10 | Access Control |
| ACCESS-03 | Phase 10 | Access Control |
| ACCESS-04 | Phase 10 | Access Control |
| EXPIRY-01 | Phase 10 | Token Expiry |
| EXPIRY-02 | Phase 10 | Token Expiry |
| EXPIRY-03 | Phase 10 | Token Expiry |
| ADMIN-01 | Phase 10 | Admin CLI |
| ADMIN-02 | Phase 10 | Admin CLI |
| ADMIN-03 | Phase 10 | Admin CLI |
| SETUP-01 | Phase 10 | Device Setup |
| GRID-01 | Phase 11 | Photo Grid |
| GRID-02 | Phase 11 | Photo Grid |
| GRID-03 | Phase 11 | Photo Grid |
| GRID-04 | Phase 11 | Photo Grid |
| PORT-01 | Phase 12 | Portfolio |
| PORT-02 | Phase 12 | Portfolio |
| PORT-03 | Phase 12 | Portfolio |
| PORT-04 | Phase 12 | Portfolio |

**v2.0 Coverage: 30/30 requirements mapped**

## v1.1 Coverage

<details>
<summary>v1.1 coverage (25/25 mapped -- all shipped except Phase 7 deferred to Phase 12)</summary>

| Requirement | Phase | Category |
|-------------|-------|----------|
| BUGFIX-01 | Phase 4 | Bug Fixes |
| BUGFIX-02 | Phase 4 | Bug Fixes |
| BUGFIX-03 | Phase 4 | Bug Fixes |
| BUGFIX-04 | Phase 4 | Bug Fixes |
| BUGFIX-05 | Phase 4 | Bug Fixes |
| BUGFIX-06 | Phase 4 | Bug Fixes |
| DEPLOY-01 | Phase 4 | Deployment |
| VISUAL-01 | Phase 5 | Visual Effects |
| VISUAL-02 | Phase 5 | Visual Effects |
| VISUAL-03 | Phase 5 | Visual Effects |
| VISUAL-04 | Phase 5 | Visual Effects |
| VISUAL-05 | Phase 5 | Visual Effects |
| OVERLAY-01 | Phase 5 | Overlays |
| OVERLAY-02 | Phase 5 | Overlays |
| OVERLAY-03 | Phase 5 | Overlays |
| PAY-01 | Phase 6 | Payments |
| PAY-02 | Phase 6 | Payments |
| DEMO-01 | Phase 6 | Demo Mode |
| DEMO-02 | Phase 6 | Demo Mode |
| DEMO-03 | Phase 6 | Demo Mode |
| DEMO-04 | Phase 6 | Demo Mode |
| PORT-01 | Phase 7/12 | Portfolio |
| PORT-02 | Phase 7/12 | Portfolio |
| PORT-03 | Phase 7/12 | Portfolio |
| PORT-04 | Phase 7/12 | Portfolio |

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend + Deployment | v1.0 | 5/5 | Complete | 2026-02-10 |
| 2. Slideshow + PWA | v1.0 | 3/3 | Complete | 2026-02-13 |
| 3. Advanced Features | v1.0 | 3/3 | Complete | 2026-02-13 |
| 4. Bug Fixes + Stability | v1.1 | 3/3 | Complete | 2026-02-15 |
| 5. Visual Effects + Overlays | v1.1 | 3/3 | Complete | 2026-02-15 |
| 6. Stripe + Demo Mode | v1.1 | 3/3 | Complete | 2026-02-16 |
| 7. README + Portfolio Polish | v1.1 | 0/? | Deferred | -- |
| 8. Database Foundation + Data Migration | v2.0 | 3/3 | Complete | 2026-02-28 |
| 9. Per-User Auth + Data Isolation | v2.0 | 0/? | Not Started | -- |
| 10. Access Control + Admin + Resilience | v2.0 | 0/? | Not Started | -- |
| 11. Photo Management Grid | v2.0 | 0/? | Not Started | -- |
| 12. Portfolio Polish | v2.0 | 0/? | Not Started | -- |
