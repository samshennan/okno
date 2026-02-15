# Requirements: Okno

**Defined:** 2026-02-15
**Core Value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.

## v1.1 Requirements

Requirements for "Make It Shine" milestone. Visual polish, bug fixes, portfolio artifacts.

### Bug Fixes

- [ ] **BUGFIX-01**: Picker session batch merge -- new selections append to existing cache instead of replacing
- [ ] **BUGFIX-02**: Picker session timeout warning -- countdown timer visible during photo selection
- [ ] **BUGFIX-03**: On This Day fallback visibility -- "No photos from today" message visible on screen (not black)
- [ ] **BUGFIX-04**: Calendar indicator display -- shows correctly even when On This Day photo hasn't loaded
- [ ] **BUGFIX-05**: Random photo 502 resilience -- graceful fallback when backend returns 502 during mode switch
- [ ] **BUGFIX-06**: Dual mode landscape handling -- landscape photos display properly in dual mode (no letterboxing)

### Visual Effects

- [ ] **VISUAL-01**: Ken Burns cinematic zoom/pan effect on slideshow photos with randomized direction
- [ ] **VISUAL-02**: Ken Burns effect toggleable via settings page
- [ ] **VISUAL-03**: Blurred background fill instead of black bars for non-filling photos
- [ ] **VISUAL-04**: Blurred background toggleable via settings page
- [ ] **VISUAL-05**: Ken Burns respects `prefers-reduced-motion` accessibility setting

### Overlays

- [ ] **OVERLAY-01**: Photo date overlay showing when each photo was taken (e.g. "March 2019")
- [ ] **OVERLAY-02**: Clock overlay showing current time (updates every minute)
- [ ] **OVERLAY-03**: Both overlays independently toggleable via settings page

### Payments

- [ ] **PAY-01**: Stripe donate button replaces PayPal placeholder in feedback modal
- [ ] **PAY-02**: Donation uses Stripe Payment Links (existing moonacle account)

### Demo Mode

- [ ] **DEMO-01**: App runs without Google auth using bundled sample photos
- [ ] **DEMO-02**: "Try Demo" button visible on home page for unauthenticated visitors
- [ ] **DEMO-03**: Demo mode indicator visible during slideshow
- [ ] **DEMO-04**: All visual effects (Ken Burns, blur, overlays) functional in demo mode

### Portfolio

- [ ] **PORT-01**: GitHub README with hero image/GIF showing the product
- [ ] **PORT-02**: Architecture diagram (Mermaid) in README
- [ ] **PORT-03**: Product decisions section explaining key tradeoffs
- [ ] **PORT-04**: Live demo link in README pointing to okno.moonacle.com

### Deployment

- [ ] **DEPLOY-01**: Service Worker cache version updated for v1.1 deployment

## Future Requirements

Deferred to v2.0 milestone.

### Multi-User

- **MULTI-01**: Multiple Google users can authenticate independently
- **MULTI-02**: Per-user photo cache and settings isolation
- **MULTI-03**: Admin toggle to enable/disable multi-user registration

### Curation

- **CURA-01**: Album selection from Google Photos
- **CURA-02**: Photo management grid to view and remove cached photos
- **CURA-03**: Date range filtering for slideshow

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple transition styles (slide, wipe, dissolve) | Ken Burns + crossfade is sufficient. Apple TV has one transition. |
| Animated text overlays | Distracting on ambient display. Motion reserved for photos. |
| Custom overlay positioning (drag-and-drop) | Massive UI complexity for negligible value. |
| Donation amount tracking/dashboard | Stripe Dashboard already tracks all payments. |
| Interactive demo configuration | Demo is a showcase, not a sandbox. Optimal defaults only. |
| Video walkthrough in README | GIF is sufficient and auto-plays on GitHub. |
| Weather/Spotify/news overlays | Scope creep. Product is a photo frame. |
| Native iOS app | PWA + Guided Access sufficient, avoids $100 fee. |
| Face recognition / AI curation | Massive scope, Google Photos already does this. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUGFIX-01 | Phase 4 | Pending |
| BUGFIX-02 | Phase 4 | Pending |
| BUGFIX-03 | Phase 4 | Pending |
| BUGFIX-04 | Phase 4 | Pending |
| BUGFIX-05 | Phase 4 | Pending |
| BUGFIX-06 | Phase 4 | Pending |
| DEPLOY-01 | Phase 4 | Pending |
| VISUAL-01 | Phase 5 | Pending |
| VISUAL-02 | Phase 5 | Pending |
| VISUAL-03 | Phase 5 | Pending |
| VISUAL-04 | Phase 5 | Pending |
| VISUAL-05 | Phase 5 | Pending |
| OVERLAY-01 | Phase 5 | Pending |
| OVERLAY-02 | Phase 5 | Pending |
| OVERLAY-03 | Phase 5 | Pending |
| PAY-01 | Phase 6 | Pending |
| PAY-02 | Phase 6 | Pending |
| DEMO-01 | Phase 6 | Pending |
| DEMO-02 | Phase 6 | Pending |
| DEMO-03 | Phase 6 | Pending |
| DEMO-04 | Phase 6 | Pending |
| PORT-01 | Phase 7 | Pending |
| PORT-02 | Phase 7 | Pending |
| PORT-03 | Phase 7 | Pending |
| PORT-04 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after roadmap creation (phase assignments added)*
