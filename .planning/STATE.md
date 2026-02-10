# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** Display random photos from Google Photos on an iPad in a beautiful, hands-off way that requires no interaction after initial setup.
**Current focus:** v0.1.1 - Post-launch improvements and Phase 2 planning

## Current Position

**Phase: COMPLETE - v0.1.1 shipped! 🎉**
Status: Production-ready, deployed at okno.moonacle.com
Last activity: 2026-02-10 - Completed v0.1.1 post-launch fixes

Progress: [██████████] 100% (Phase 1 complete)

## What We Shipped

### v0.1.0 (2026-02-10 morning)
- ✅ Google Photos slideshow with 3 display modes
- ✅ Interval controls (10s - 5m)
- ✅ Fullscreen support with touch controls
- ✅ iPad optimization (sleep reminder, responsive design)
- ✅ VPS deployment (nginx + PM2 + SSL)
- ✅ Auto-refresh baseUrls every 50 minutes
- ✅ OAuth 2.0 authentication with token persistence

### v0.1.1 (2026-02-10 afternoon)
- ✅ Email allowlist security (sam@samshennan.com, alicja.chodara@gmail.com)
- ✅ Sign Out button and logout endpoint
- ✅ Manual cache refresh endpoint (POST /api/health/refresh)
- ✅ Sleep reminder repositioned (bottom-left, no UI overlap)
- ✅ Comprehensive documentation (README, CHANGELOG, ROADMAP, SECURITY-AUDIT, COMPETITIVE-ANALYSIS)
- ✅ Fixed black photos issue (expired tokens + stale baseUrls)

## Performance Metrics

**Development Time:**
- Phase 1 (Backend + Deployment): ~6 hours (including planning)
- v0.1.0 launch: 1 session
- v0.1.1 fixes: 1 session (same day)
- Total: ~8 hours from concept to production

**Phase 1 Results:**
- Plans completed: 5/5 (01-01 through 01-05)
- Deployment: Successful, live at okno.moonacle.com
- Security: Email allowlist active, HTTPS enforced
- Stability: PM2 auto-restart, health monitoring

## Accumulated Context

### Key Decisions (v0.1.x)

**Architecture:**
- Single-tenant design (shared OAuth tokens + cache)
- File-based cache (metadata only, no image storage)
- On-demand streaming from Google Photos
- baseUrl refresh every 50 minutes (10-min buffer before expiry)

**Security:**
- Email allowlist via ALLOWED_EMAILS env var
- OAuth email verification during callback
- Session-based authentication (1-year expiry)
- Manual cache refresh endpoint for debugging

**UX:**
- Sign Out button for re-authentication
- Sleep reminder for iPad Auto-Lock settings
- Control visibility: tap to show, auto-hide after 4s
- Three display modes: Fill Screen, Show All, 2 Portraits

**Deployment:**
- 1Password CLI for secrets management
- nginx reverse proxy with Let's Encrypt SSL
- PM2 for process management and auto-restart
- Health endpoint for monitoring

### Technical Debt

**Addressed:**
- ✅ baseUrl expiry handling (manual refresh endpoint)
- ✅ Missing re-authentication UI (Sign Out button)
- ✅ Email allowlist for security
- ✅ Comprehensive documentation

**Remaining:**
- ⚠️ Auto-retry on 403 errors (manual refresh required)
- ⚠️ Cache auto-refresh on startup if stale
- ⚠️ Single-tenant limitation (Phase 4 will fix)
- ⚠️ No photo management UI (Phase 2 goal)

### Next Phase: Phase 2 - Photo Management

**Goals:**
- Thumbnail grid view of cached photos
- Toggle individual photos on/off (hidden flag)
- Select All / Unselect All buttons
- Never re-select 2000 photos again

**After Phase 2:**
- Phase 3: Video support
- Phase 4: Multi-tenant refactor for public release
- Phase 5: Full library sync (>2000 photos)
- Phase 6: Monetization research and validation
- Phase 7: Advanced features (AI, smart albums, etc.)

See: ROADMAP.md for full feature roadmap

### Pending Todos

**Phase 2 Planning:**
- [ ] Design photo management UI/UX
- [ ] Add `hidden` boolean to cache.json schema
- [ ] Create /manage.html page with thumbnail grid
- [ ] Add API endpoint for toggling photo visibility
- [ ] Update slideshow to filter hidden photos

**Infrastructure:**
- [ ] Add auto-retry logic for 403 errors
- [ ] Auto-refresh cache on startup if >50 minutes old
- [ ] Better error messages in slideshow UI

**Documentation:**
- [ ] Add LICENSE file (MIT)
- [ ] Create CONTRIBUTING.md for Phase 4
- [ ] Docker deployment guide

### Blockers/Concerns

**Resolved:**
- ✅ OAuth token expiry (manual refresh endpoint + Sign Out button)
- ✅ No re-authentication UI (Sign Out button added)
- ✅ Security for family use (email allowlist active)

**Active:**
- Google Picker API has no "Select All" option (manual selection only)
- 2000 photo limit from Google Picker API (need Library API for >2000)
- Single-tenant design limits public use (Phase 4 required)

**Future Considerations:**
- App Store submission requires native iOS app (Phase 4+)
- Monetization requires multi-tenant refactor (Phase 6)
- Market validation needed before commercial offering (1,000+ GitHub stars)

## Session Continuity

**Last session:** 2026-02-10
**Status:** v0.1.1 complete and deployed
**Resume file:** None needed - ready for Phase 2 when requested

**Current state:**
- Production app running at okno.moonacle.com
- 6 photos cached, slideshow working
- Email allowlist active (Sam + Alicja)
- All documentation committed to GitHub
- Ready for Phase 2 (photo management UI)

**Next steps when resuming:**
1. Review ROADMAP.md Phase 2 requirements
2. Design thumbnail grid UI
3. Implement photo toggle functionality
4. Test on iPad with 2000 photos

---

**Project Status:** 🎉 SHIPPED v0.1.1 - Production-ready family photo frame!
**Deployment:** https://okno.moonacle.com
**GitHub:** https://github.com/samshennan/okno
