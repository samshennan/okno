# Roadmap: Okno

## Milestones

- **v1.0 MVP** -- Phases 1-3 (shipped 2026-02-15)
- **v1.1 Make It Shine** -- Phases 4-7 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) -- SHIPPED 2026-02-15</summary>

- [x] Phase 1: Backend + Deployment (5/5 plans) -- completed 2026-02-10
- [x] Phase 2: Slideshow + PWA (3/3 plans) -- completed 2026-02-13
- [x] Phase 3: Advanced Features (3/3 plans) -- completed 2026-02-13

See `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

### v1.1 "Make It Shine"

**Goal:** Elevate Okno from functional MVP to portfolio-quality showcase with cinematic visual effects, bug fixes, Stripe donation, demo mode, and a polished README.

---

### Phase 4: Bug Fixes + Stability

**Goal:** Users experience a reliable, bug-free slideshow regardless of how they interact with the app.

**Dependencies:** None (first v1.1 phase, builds on shipped v1.0)

**Requirements:** BUGFIX-01, BUGFIX-02, BUGFIX-03, BUGFIX-04, BUGFIX-05, BUGFIX-06, DEPLOY-01

**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md -- Picker batch merge + session countdown timer
- [x] 04-02-PLAN.md -- Slideshow error handling + UI edge case fixes
- [x] 04-03-PLAN.md -- Service Worker error guard + v1.1 cache version bump

**Success Criteria:**
1. User adds photos via Picker in multiple sessions and all selections accumulate (no data loss from overwrite)
2. User sees a visible countdown warning when Picker session is about to expire (no silent timeout)
3. User in On This Day mode sees a readable fallback message when no photos match today (no black screen)
4. User in dual mode sees landscape photos handled gracefully without letterboxing artifacts
5. Slideshow recovers from 502 errors without requiring manual intervention or page reload

---

### Phase 5: Visual Effects + Overlays

**Goal:** The slideshow delivers a cinematic viewing experience with smooth Ken Burns zoom/pan, blurred background fill, and contextual date/time overlays.

**Dependencies:** Phase 4 (clean foundation, no regressions in slideshow core)

**Requirements:** VISUAL-01, VISUAL-02, VISUAL-03, VISUAL-04, VISUAL-05, OVERLAY-01, OVERLAY-02, OVERLAY-03

**Success Criteria:**
1. Photos animate with a smooth, slow Ken Burns zoom/pan effect that varies direction per photo and runs without visible jank on iPad Pro 1st Gen
2. Non-filling photos display with a blurred version of themselves as background instead of black bars
3. User can see when each photo was taken (e.g. "March 2019") and the current time as unobtrusive overlays
4. User can independently toggle Ken Burns, blurred background, photo date, and clock on/off from the settings page
5. Ken Burns animation respects `prefers-reduced-motion` and disables automatically for users who need it

**Research Flag:** DEEP -- GPU memory profiling on iPad Pro 1st Gen (A9X), blur performance testing (CSS vs tiny-image), transition choreography to avoid triple-stacking GPU layers. See research/SUMMARY.md Pitfalls #1, #2, #3.

**Plans:** 3 plans

Plans:
- [x] 05-01-PLAN.md -- Config defaults + settings page toggles (Visual Effects + Overlays sections)
- [x] 05-02-PLAN.md -- Ken Burns effect + transition choreography + prefers-reduced-motion
- [x] 05-03-PLAN.md -- Blurred background fill + date/time overlays + SW cache version bump

---

### Phase 6: Stripe + Demo Mode

**Goal:** Visitors can experience Okno without Google auth (demo mode) and supporters can donate with one click (Stripe).

**Dependencies:** Phase 5 (demo mode needs visual effects working to showcase them)

**Requirements:** PAY-01, PAY-02, DEMO-01, DEMO-02, DEMO-03, DEMO-04

**Success Criteria:**
1. Unauthenticated visitor clicks "Try Demo" on the home page and sees a full slideshow with sample photos, Ken Burns, blur, and overlays -- no Google account needed
2. Demo mode shows a clear indicator so viewers know they are seeing sample content, not real photos
3. User clicks donate button in feedback modal and is taken to a Stripe-hosted payment page (not PayPal)
4. Demo mode is fully isolated from real user data -- no access to cached photos, settings, or auth tokens

**Research Flag:** MODERATE -- sample photo curation (royalty-free licensing), auth bypass security review.

**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md -- Stripe donate button on settings page + "Try Demo" button on home page
- [x] 06-02-PLAN.md -- Demo backend (sample photos + API endpoints)
- [x] 06-03-PLAN.md -- Demo slideshow page + end-of-demo CTA + SW cache v1.3

---

### Phase 7: README + Portfolio Polish

**Goal:** The GitHub repository communicates product quality, technical depth, and product leadership at a glance.

**Dependencies:** Phases 5 and 6 (needs screenshots of final product with all visual effects and demo mode working)

**Requirements:** PORT-01, PORT-02, PORT-03, PORT-04

**Success Criteria:**
1. GitHub visitor sees a hero image or GIF showing the slideshow in action (Ken Burns + blur visible) within the first scroll
2. Architecture diagram (Mermaid) communicates the system design without needing to read code
3. Product decisions section explains what was NOT built and why -- demonstrating product leadership thinking
4. Live demo link lets an interviewer experience the product in under 10 seconds

---

## Coverage

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
| PORT-01 | Phase 7 | Portfolio |
| PORT-02 | Phase 7 | Portfolio |
| PORT-03 | Phase 7 | Portfolio |
| PORT-04 | Phase 7 | Portfolio |

**v1.1 Coverage: 25/25 requirements mapped**

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend + Deployment | v1.0 | 5/5 | Complete | 2026-02-10 |
| 2. Slideshow + PWA | v1.0 | 3/3 | Complete | 2026-02-13 |
| 3. Advanced Features | v1.0 | 3/3 | Complete | 2026-02-13 |
| 4. Bug Fixes + Stability | v1.1 | 3/3 | Complete | 2026-02-15 |
| 5. Visual Effects + Overlays | v1.1 | 3/3 | Complete | 2026-02-15 |
| 6. Stripe + Demo Mode | v1.1 | 3/3 | Complete | 2026-02-16 |
| 7. README + Portfolio Polish | v1.1 | 0/? | Not Started | -- |
