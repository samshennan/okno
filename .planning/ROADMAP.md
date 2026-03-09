# Roadmap: Okno

## Milestones

- **v1.0 MVP** -- Phases 1-3 (shipped 2026-02-15)
- **v1.1 Make It Shine** -- Phases 4-7 (Phases 4-6 shipped 2026-02-16, Phase 7 deferred)
- **v2.0 Multi-User** -- Phases 8-12 (in progress)

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
- [ ] Phase 7: README + Portfolio Polish -- deferred to Phase 12

</details>

---

### v2.0 "Multi-User"

**Goal:** Any Google account can sign in, run their own photo frame with isolated data, and manage their photo collection. No invite codes, no allowlist — open by design.

**Access model decision (2026-03-09):** Removed `ALLOWED_EMAILS` gate. Anyone with a Google account can sign in. Google's unverified app cap (100 users) is not a concern at this scale. User data is already fully isolated per Phase 9.

---

### Phase 8: Database Foundation ✓

**Status:** COMPLETE (2026-02-28)

- [x] 08-01: SQLite schema + migration runner + JSON seed
- [x] 08-02: auth.js + config.js → DB persistence
- [x] 08-03: photo-cache.js + session store → DB, VPS deploy

---

### Phase 9: Per-User Auth + Data Isolation

**Status:** IN PROGRESS — code complete, awaiting checkpoint approval

**Goal:** Multiple Google accounts authenticate independently; each user's photos, tokens, settings, and slideshow are fully isolated.

- [x] 09-01: Per-user OAuth2Client cache, requireAuth middleware, login page
- [x] 09-02: Per-user data isolation across all modules (picker, proxy, cache, config, health)
- [ ] 09-03: Frontend auth UX (reconnect overlay ✓, logout button ✓) → checkpoint approval

**To complete:** approve checkpoint at https://okno.moonacle.com, create 09-03-SUMMARY.md, commit.

---

### Phase 10: Resilience

**Status:** NOT STARTED

**Goal:** The app handles edge cases gracefully — stale photo cache after restart, missing env vars, and token expiry — without manual intervention.

**Scope (single plan, no sub-phases):**
1. Fix stale baseUrl on restart: check cache age on DB load, trigger immediate refresh if >50 min old
2. Startup env validation: throw on missing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSION_SECRET`
3. Verify token expiry reconnect overlay works end-to-end (slideshow → overlay → re-auth → resume)

**Success criteria:**
- Server restart → slideshow continues serving photos within 60 seconds (no 502 burst)
- Missing env var → clear startup error, not a cryptic runtime crash

---

### Phase 11: Photo Management

**Status:** NOT STARTED

**Goal:** Users can remove photos they don't want from their slideshow cache.

**Scope:** Keep it simple — no full grid required to ship.
- "Hide this photo" button on the slideshow (subtle, tap to reveal)
- `POST /api/photo/hide/:mediaItemId` marks photo hidden in DB (`hidden = 1` column on `photo_cache`)
- Hidden photos excluded from random selection in `photo-cache.js`
- Settings page: "hidden photos" count + "unhide all" button

**If time/interest allows:** thumbnail grid on settings page showing hidden photos with restore option.

**Success criteria:**
- User taps a photo they don't want → it never appears again
- Hidden photos persist across server restarts

---

### Phase 12: Portfolio Polish

**Status:** NOT STARTED (absorbed deferred Phase 7 scope)

**Goal:** The GitHub repository communicates product quality at a glance for anyone who visits.

**Scope (single `/gsd:quick` pass — no planning ceremony):**
- README.md: hero screenshot/GIF, one-paragraph product description, architecture diagram (Mermaid), self-hosting guide, key technical decisions
- Live demo link
- Clean up any stale planning artefacts from root directory

**Success criteria:**
- A developer landing on the repo understands what it is and how it works within 30 seconds

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Backend + Deployment | ✅ Complete | 2026-02-10 |
| 2. Slideshow + PWA | ✅ Complete | 2026-02-13 |
| 3. Advanced Features | ✅ Complete | 2026-02-13 |
| 4. Bug Fixes + Stability | ✅ Complete | 2026-02-15 |
| 5. Visual Effects + Overlays | ✅ Complete | 2026-02-15 |
| 6. Stripe + Demo Mode | ✅ Complete | 2026-02-16 |
| 7. README + Portfolio Polish | ↪ Deferred to Phase 12 | -- |
| 8. Database Foundation | ✅ Complete | 2026-02-28 |
| 9. Per-User Auth + Data Isolation | 🔄 Checkpoint pending | -- |
| 10. Resilience | ⬜ Not started | -- |
| 11. Photo Management | ⬜ Not started | -- |
| 12. Portfolio Polish | ⬜ Not started | -- |
