# Handover: 2026-03-09

## What Was Done This Session

### Architecture review + roadmap simplification
- Audited codebase against known patterns — identified circular dep hack in photo-cache.js, double in-memory cache overhead, stale baseUrl on restart bug, no startup env validation
- Rewrote ROADMAP.md: cut Phase 10 (invite codes, admin CLI, QR setup) down to just resilience fixes; Phase 11 simplified to "hide photo" button; Phase 12 kept as single quick pass
- Created CLAUDE.md (project context file for Claude Code)

### Open registration — removed ALLOWED_EMAILS gate
- Deleted the `ALLOWED_EMAILS` check from auth.js (`/auth/callback`)
- Removed dead `not_authorised` error branch from public/login.html
- Decision: anyone with a Google account can now sign in; each user gets fully isolated data (Phase 9 already built this). Google's 100-user unverified cap is not a concern at this scale.

## Current State

**Phase 9 is code-complete.** All three plans are implemented and committed. The only thing blocking phase closure is the human verification checkpoint:

1. Visit https://okno.moonacle.com — should redirect to `/login`
2. Sign in with Google → lands at `/`
3. `/slideshow.html` plays (photos cached from before)
4. `/settings.html` shows "Sign Out" button
5. Sign Out → back to `/login`
6. `/demo` works without auth

Once tested: create `.planning/phases/09-per-user-auth/09-03-SUMMARY.md`, update STATE.md, commit phase completion.

## Next Actions (in order)

1. **Deploy today's changes to VPS** — `./update-vps.sh` (removes ALLOWED_EMAILS gate from live app)
2. **Test Phase 9 checkpoint** at https://okno.moonacle.com
3. **Close Phase 9** — write 09-03-SUMMARY.md, update STATE.md + ROADMAP.md phase 9 to ✅
4. **Phase 10** — single plan: fix stale baseUrl on restart, add startup env validation
5. **Phase 11** — "hide this photo" button on slideshow
6. **Phase 12** — `/gsd:quick` README pass

## Known Issues Carried Forward

- **Stale baseUrl on restart (Phase 10):** Server restart loads old baseUrls from DB without checking age. Photos may 502 for up to 60 min after restart. Fix: check cache timestamp on load, trigger immediate refresh if stale.
- **No startup env validation (Phase 10):** Missing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSION_SECRET` causes silent runtime failures instead of a clear startup error.
- **Circular dependency hack (tech debt):** `photo-cache.js` does `require('./auth')` inside `refreshBaseUrls()` to avoid circular import. Low priority — works fine, just ugly.
- **Stripe Payment Link URLs are placeholders** — not blocking anything.

## Deployment

```bash
./update-vps.sh   # pulls latest, npm install --production, pm2 restart okno
```

Live: https://okno.moonacle.com
