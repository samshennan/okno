# Handover: Antigravity Testing Session

## Context

v1.0 milestone audit complete (20/20 requirements, 28/28 integrations wired). Phase 3 code was just deployed to VPS for the first time. Manual testing in progress — need browser-based verification of features and edge cases.

## What Was Just Done

- Ran `/gsd:audit-milestone` — all requirements satisfied, integration check excellent
- Discovered Phase 3 code (config.js, settings.html, On This Day, portrait pairs) was never deployed to VPS
- Fixed: rsync'd code to VPS, PM2 restarted, all endpoints verified working
- Pushed to GitHub (960509e)

## Known Bugs

### BUG-1: Picker session timeout (CRITICAL UX)
- **Symptom:** After ~1 hour selecting 137 photos, clicking "Done" shows "Couldn't add photos" error
- **Root cause:** Google Picker session expires (undocumented timeout, likely ~30 min)
- **Impact:** User loses all selection work
- **Workaround:** Select in smaller batches (30-50 photos at a time)
- **Fix needed:** Warn users about time limit, add countdown timer

### BUG-2: Second picker batch overwrites first (DATA LOSS)
- **Symptom:** Starting a new picker session replaces all previously cached photos
- **Root cause:** `photo-cache.js:69` does `cache.mediaItems = items` (full replacement)
- **Fix needed:** Merge by `item.id` — dedupe and append new items to existing cache

## Tests Still Pending

### Must Re-Test (were failing because code wasn't deployed)
- [ ] **Test 7: On This Day** — Enable in /settings, save, open slideshow. Check for calendar-heart indicator or "No photos from today" fallback message
- [ ] **Test 11: Feature counts** — Check description text under toggles on /settings page (should show photo counts)

### Never Tested
- [ ] **Test 9: Settings persistence** — Save settings, `pm2 restart okno`, reload /settings, verify values persist
- [ ] **Test 10: URL param override** — Save interval=30s, visit `/slideshow.html?interval=10`, verify 10s transitions

### iPad Hardware Tests (deferred)
- [ ] **Test 3:** Screen wake lock 2+ hours continuous
- [ ] **Test 4:** Guided Access kiosk mode
- [ ] **Test 5:** Memory stability 30+ min
- [ ] **Test 6:** WiFi disconnect/reconnect resilience

## Antigravity/Chrome DevTools Testing Checklist

### Console Error Monitoring
- [ ] Open `/slideshow.html` with DevTools Console open — watch for JS errors during photo transitions
- [ ] Open `/settings` — check for failed API calls in Console
- [ ] Visit `/api/photo/random?onThisDay=true` directly — check response (photo or 404 JSON)
- [ ] Visit `/api/health` — verify `portraitCount` and `totalItems` are populated

### Network Resilience
- [ ] DevTools > Network > Slow 3G — does slideshow handle slow connections gracefully?
- [ ] DevTools > Network > Offline — does previous photo stay visible (no white flash)?
- [ ] DevTools > Network > Disable cache — does slideshow still work?

### Service Worker
- [ ] DevTools > Application > Service Workers — is sw.js registered and active?
- [ ] DevTools > Application > Cache Storage — are `okno-v1` and `okno-photos-v1` caches present?
- [ ] Check cached entries in `okno-photos-v1` — are photo blobs being cached?

### Performance
- [ ] DevTools > Performance tab > Record 5 minutes of slideshow — check for memory leaks (heap should stay flat)
- [ ] DevTools > Memory > Take heap snapshot before and after 10 transitions — compare size

### Race Conditions
- [ ] Rapidly click next/prev while photos load — any console errors or white flashes?
- [ ] Toggle play/pause rapidly during transitions
- [ ] Switch display modes (Cover/Contain/2 Portraits) during a transition

### On This Day Feature
- [ ] Enable On This Day in /settings, save
- [ ] Open slideshow — check console for "On This Day" related logs
- [ ] If no photos match today's date: "No photos from today in history" overlay should appear for 5s, then fall back to random
- [ ] If photos match: calendar-heart indicator in top-left with date and count

### Portrait Pairs Feature
- [ ] Enable Portrait Pairs in /settings, save
- [ ] Open slideshow — wait for portrait-orientation photos
- [ ] Check console for portrait detection logs
- [ ] Verify side-by-side display when portrait pair appears

### Settings Integration
- [ ] Change interval on /settings, save, open slideshow — verify timing matches
- [ ] Change display mode on /settings, save, open slideshow — verify mode applies
- [ ] Test URL override: `/slideshow.html?interval=5&mode=contain` — should override saved config

## Feature Ideas Captured

- **Photo management grid** — `/manage` page showing thumbnails with ability to remove individual photos from cache
- **Picker session timer** — Countdown warning so users know to finish selection before timeout
- **Batch merge fix** — Picker completion should merge, not replace

## VPS Deployment

- **Deploy method:** `rsync` (not git pull — VPS git repo not properly configured)
- **Command:** `rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'tokens.json' --exclude 'cache.json' --exclude 'config.json' --exclude 'sessions' --exclude 'logs' --exclude '.env' --exclude '.planning' --exclude '.claude' ./ root@okno.moonacle.com:/var/www/okno/`
- **Restart:** `ssh root@okno.moonacle.com "cd /var/www/okno && pm2 restart okno"`
- **Live URL:** https://okno.moonacle.com

## Key Files for Testing

- `/settings` — Settings page (newly deployed)
- `/slideshow.html` — Main slideshow
- `/api/health` — System diagnostics JSON
- `/api/config` — Current config JSON
- `/api/photo/random` — Random photo endpoint
- `/api/photo/random?onThisDay=true` — On This Day photo
- `/api/photo/random?portrait=true` — Portrait photo

## After Testing

When all tests pass or bugs are identified:
```
/gsd:audit-milestone
```
Then:
```
/gsd:complete-milestone v1.0
```
