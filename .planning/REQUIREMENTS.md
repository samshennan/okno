# Requirements: Okno

**Defined:** 2026-02-27
**Core Value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.

## v2.0 Requirements

Requirements for "Multi-Tenant" milestone. Multi-user architecture, photo management grid, and polish.

### Database & Migration

- [x] **DB-01**: App uses SQLite database for all persistent storage (users, tokens, photos, settings, invite codes)
- [x] **DB-02**: Existing JSON files (tokens.json, cache.json, config.json) auto-migrate to DB as first user on first startup
- [x] **DB-03**: Migrated JSON files renamed to .migrated as backup

### Authentication

- [ ] **AUTH-01**: Each user authenticates with their own Google account via OAuth 2.0
- [ ] **AUTH-02**: Per-user OAuth tokens stored in DB, isolated from other users
- [ ] **AUTH-03**: Token refresh happens automatically per-user (expired token for User A does not affect User B)
- [ ] **AUTH-04**: Session stores userId, all routes resolve current user from session

### Access Control

- [ ] **ACCESS-01**: New users must enter a valid invite code before Google sign-in
- [ ] **ACCESS-02**: Invite codes are single-use (or limited-use) with optional expiry
- [ ] **ACCESS-03**: Invalid/expired codes show clear error message
- [ ] **ACCESS-04**: Invite code can be pre-filled via URL parameter (?invite=CODE)

### Data Isolation

- [ ] **ISOL-01**: Each user's photo cache is fully isolated (User A never sees User B's photos)
- [ ] **ISOL-02**: Each user's settings are independent (interval, Ken Burns, etc.)
- [ ] **ISOL-03**: Each user's slideshow serves only their photos
- [ ] **ISOL-04**: Per-user baseUrl refresh (stale URLs refreshed per-user, not globally)

### Photo Grid

- [ ] **GRID-01**: User can view a thumbnail grid of all their cached photos
- [ ] **GRID-02**: User can select one or more photos and remove them from their cache
- [ ] **GRID-03**: Thumbnails load lazily for performance with 2000-photo collections
- [ ] **GRID-04**: Grid uses responsive CSS Grid layout matching existing design system

### Token Expiry

- [ ] **EXPIRY-01**: When a user's Google token expires/is revoked, their slideshow shows a reconnect overlay instead of crashing
- [ ] **EXPIRY-02**: Other users' slideshows are unaffected by one user's token failure
- [ ] **EXPIRY-03**: User can re-authenticate via a reconnect button

### Device Setup

- [ ] **SETUP-01**: After photo selection, settings page shows QR code pointing to slideshow URL for iPad scanning

### Admin CLI

- [ ] **ADMIN-01**: Admin can generate invite codes via CLI on VPS
- [ ] **ADMIN-02**: Admin can list users and their photo counts via CLI
- [ ] **ADMIN-03**: Admin can delete a user and all their data via CLI

### Portfolio (carried from v1.1)

- [ ] **PORT-01**: GitHub README with hero image/GIF showing the product
- [ ] **PORT-02**: Architecture diagram (Mermaid) in README
- [ ] **PORT-03**: Product decisions section explaining key tradeoffs
- [ ] **PORT-04**: Live demo link in README pointing to okno.moonacle.com

## v1.1 Requirements (Shipped)

All v1.1 requirements completed in Phases 4-6. See MILESTONES.md for details.

- [x] BUGFIX-01 through BUGFIX-06 -- Phase 4
- [x] DEPLOY-01 -- Phase 4
- [x] VISUAL-01 through VISUAL-05 -- Phase 5
- [x] OVERLAY-01 through OVERLAY-03 -- Phase 5
- [x] PAY-01, PAY-02 -- Phase 6
- [x] DEMO-01 through DEMO-04 -- Phase 6

## v2.1+ Requirements

Deferred to future milestone.

### User Experience

- **UX-01**: Account page (view profile, photo count, disconnect Google, delete account)
- **UX-02**: URL-based invite links (okno.moonacle.com/?invite=CODE as shareable link)

### Scale

- **SCALE-01**: Google OAuth app verification (removes 100-user cap)
- **SCALE-02**: Open registration (remove invite code requirement)
- **SCALE-03**: Rate limiting on API endpoints for multi-user protection

### Media

- **MEDIA-01**: Short video playback support in slideshow
- **MEDIA-02**: Album filtering from Google Photos
- **MEDIA-03**: Date range filtering for slideshow

### Admin

- **ADMIN-04**: Admin dashboard UI (web-based user/invite management)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Client-side token storage (IndexedDB) | Breaks "set up on phone, run on iPad" UX -- tokens must be server-side |
| Shared albums / social features | Okno is a personal photo frame, not a social platform |
| Real-time photo sync | No Google Photos push API -- explicit Picker flow is sufficient |
| Photo editing / cropping | Out of scope for a photo frame app -- use Google Photos for editing |
| Multi-device per user | One user = one device. Use two accounts for two frames. |
| Admin dashboard UI | CLI sufficient for invite-only with <100 users |
| Native iOS app | PWA + Guided Access sufficient, avoids $100 fee |
| Face recognition / AI curation | Massive scope, Google Photos already does this |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 8 | Complete |
| DB-02 | Phase 8 | Complete |
| DB-03 | Phase 8 | Complete |
| AUTH-01 | Phase 9 | Pending |
| AUTH-02 | Phase 9 | Pending |
| AUTH-03 | Phase 9 | Pending |
| AUTH-04 | Phase 9 | Pending |
| ISOL-01 | Phase 9 | Pending |
| ISOL-02 | Phase 9 | Pending |
| ISOL-03 | Phase 9 | Pending |
| ISOL-04 | Phase 9 | Pending |
| ACCESS-01 | Phase 10 | Pending |
| ACCESS-02 | Phase 10 | Pending |
| ACCESS-03 | Phase 10 | Pending |
| ACCESS-04 | Phase 10 | Pending |
| EXPIRY-01 | Phase 10 | Pending |
| EXPIRY-02 | Phase 10 | Pending |
| EXPIRY-03 | Phase 10 | Pending |
| ADMIN-01 | Phase 10 | Pending |
| ADMIN-02 | Phase 10 | Pending |
| ADMIN-03 | Phase 10 | Pending |
| SETUP-01 | Phase 10 | Pending |
| GRID-01 | Phase 11 | Pending |
| GRID-02 | Phase 11 | Pending |
| GRID-03 | Phase 11 | Pending |
| GRID-04 | Phase 11 | Pending |
| PORT-01 | Phase 12 | Pending |
| PORT-02 | Phase 12 | Pending |
| PORT-03 | Phase 12 | Pending |
| PORT-04 | Phase 12 | Pending |

**Coverage:**
- v2.0 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after roadmap creation*
