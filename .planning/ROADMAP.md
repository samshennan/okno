# Roadmap: Okno

## Overview

Okno goes from zero to working digital photo frame in three phases. Phase 1 builds the entire backend: OAuth, Picker API integration, photo caching, baseUrl refresh, and production deployment on VPS. Phase 2 builds the frontend slideshow and makes it run reliably on the iPad as a fullscreen PWA with screen wake prevention. Phase 3 adds the polish-week features that differentiate Okno from basic frames: "On This Day" mode, portrait pair display, and a settings page.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Backend + Deployment** - OAuth, Picker API, photo serving, and production infrastructure
- [ ] **Phase 2: Slideshow + PWA** - Fullscreen slideshow display with smooth transitions, screen wake, and error resilience
- [ ] **Phase 3: Advanced Features** - On This Day mode, portrait pairs, and settings page

## Phase Details

### Phase 1: Backend + Deployment
**Goal**: User can authenticate with Google, select photos via Picker, and the backend reliably serves random photos with fresh URLs from a production VPS
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-01, INFRA-02, INFRA-04
**Success Criteria** (what must be TRUE):
  1. User can visit the app URL, authenticate with Google via OAuth, and land back on the app with a valid session
  2. User can open Google Picker, select photos, and the backend confirms it has cached the selected media items
  3. Hitting `/api/photo/random` returns a working photo URL that displays a real image (baseUrl is fresh, not expired)
  4. The backend is running on the VPS behind nginx with HTTPS, auto-restarts after crash via PM2, and survives server reboot
  5. Hitting `/api/health` returns token status, cache size, last API call timestamp, and uptime
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md — Project setup + OAuth authentication with token persistence
- [ ] 01-02-PLAN.md — Picker API integration + photo cache with baseUrl refresh
- [ ] 01-03-PLAN.md — Random photo serving (image proxy) + health diagnostics
- [ ] 01-04-PLAN.md — VPS deployment with nginx/PM2/SSL/1Password secrets
- [ ] 01-05-PLAN.md — Human verification of all Phase 1 success criteria

### Phase 2: Slideshow + PWA
**Goal**: iPad displays a beautiful, hands-off slideshow that runs indefinitely without interaction, loading flicker, or screen dimming
**Depends on**: Phase 1
**Requirements**: DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, PWA-01, PWA-02, PWA-03, INFRA-03
**Success Criteria** (what must be TRUE):
  1. iPad shows fullscreen photos on a black background with no browser chrome, no scrollbars, and no visible UI elements
  2. Photos crossfade smoothly every interval (default 30s, configurable via URL param) with no white flash or loading delay between transitions
  3. The screen stays awake indefinitely -- leaving the iPad untouched for 1+ hours does not trigger screen dimming or sleep
  4. Adding the app to Home Screen launches it as a standalone fullscreen PWA, and it works in iOS Guided Access (kiosk) mode
  5. If the network drops briefly, the slideshow continues showing the current photo and retries fetching the next one automatically
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — PWA manifest + Service Worker (foundation for offline support)
- [ ] 02-02-PLAN.md — NoSleep.js integration + exponential backoff retry (screen wake + resilience)
- [ ] 02-03-PLAN.md — Human verification of all Phase 2 success criteria

### Phase 3: Advanced Features
**Goal**: Okno goes beyond basic slideshow with emotionally powerful features that match premium commercial frames
**Depends on**: Phase 2
**Requirements**: ADV-01, ADV-02, ADV-03
**Success Criteria** (what must be TRUE):
  1. User can enable "On This Day" mode and the slideshow shows only photos taken on today's month+day across all years
  2. When two consecutive portrait photos appear, they display side-by-side in landscape orientation instead of one at a time
  3. User can visit `/settings` and configure slideshow interval, toggle On This Day mode, and toggle portrait pair mode without touching code
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend + Deployment | 0/5 | Ready to execute | - |
| 2. Slideshow + PWA | 0/3 | Ready to execute | - |
| 3. Advanced Features | 0/TBD | Not started | - |
