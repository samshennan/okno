# Pitfalls Research

**Domain:** Self-hosted Google Photos digital photo frame (Node.js + vanilla JS PWA)
**Researched:** 2026-02-08
**Confidence:** HIGH (verified against official Google documentation, WebKit bug tracker, and community reports)

---

## Critical Pitfalls

### Pitfall 1: Using the Deprecated Library API Instead of the Picker API

**Severity:** CRITICAL -- project will not work at all

**What goes wrong:**
The Google Photos Library API `photoslibrary.readonly` scope was **deprecated on March 31, 2025**. API calls using this scope now return `403 PERMISSION_DENIED`. Many tutorials, blog posts, and example projects still reference the old Library API. Building against the old API means the project is dead on arrival.

**Why it happens:**
Most Google Photos digital photo frame tutorials were written before March 2025. Claude's training data, Stack Overflow answers, and GitHub repos all reference `photoslibrary.googleapis.com` with the old readonly scope. The old flow was simpler: OAuth, list albums, fetch photos. The new Picker API has a fundamentally different architecture.

**How to avoid:**
- Use the **Google Photos Picker API** (`photospicker.googleapis.com/v1/`) with the `photospicker.mediaitems.readonly` scope
- The Picker API uses a **session-based workflow**: create session -> user selects photos via `pickerUri` -> poll session -> retrieve media items
- Do NOT reference any code using `photoslibrary.readonly`, `photoslibrary.sharing`, or `photoslibrary` scopes -- they are dead
- Key endpoints: `sessions.create`, `sessions.get`, `mediaItems.list` (with sessionId)

**Warning signs:**
- Any tutorial referencing `photoslibrary.googleapis.com/v1/mediaItems` for listing user library
- Any code using scopes: `photoslibrary.readonly`, `photoslibrary.sharing`, `photoslibrary`
- Getting `403 PERMISSION_DENIED` from Google Photos API

**Phase to address:** Phase 1 (project foundation) -- this is the fundamental API choice. Get this wrong and nothing else matters.

**Weekend MVP trade-off:** NO shortcut possible. Must use Picker API from day one.

**Sources:**
- [Google Photos API Updates (official)](https://developers.google.com/photos/support/updates)
- [Google Developer Blog announcement](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/)
- [Picker API getting started (official)](https://developers.google.com/photos/picker/guides/get-started-picker)

---

### Pitfall 2: Storing baseUrls Instead of Media Item IDs

**Severity:** CRITICAL -- photos stop loading within 60 minutes

**What goes wrong:**
Base URLs for photos/videos expire after approximately 60 minutes. Developers cache baseUrls in a database or in-memory store, then try to load images hours or days later. Result: broken images everywhere. The URLs can expire even sooner if the user revokes app permissions.

**Why it happens:**
Storing the full URL feels natural -- it's how you'd handle any other image URL. The 60-minute expiry is aggressive and unusual. Most CDN URLs are permanent or have multi-day TTLs.

**How to avoid:**
- Store only `media item IDs` (these are permanent)
- Build a **baseUrl refresh cycle** on the backend: fetch fresh baseUrls from the Picker API before serving to the frontend
- Implement a server-side cache with a **50-minute TTL** (10-minute safety margin before the 60-minute expiry)
- Append size parameters to baseUrls: `=w1920-h1080` for display, `=w256-h256-c` for thumbnails
- Never store or persist baseUrls across server restarts

**Warning signs:**
- Broken image icons after the frame has been running for an hour
- Images that work initially but fail on the second rotation through the slideshow
- `403` or `404` errors when loading image URLs from cache

**Phase to address:** Backend API layer -- the photo-serving endpoint must always return fresh URLs.

**Weekend MVP trade-off:** Even in MVP, you must handle this. Simplest approach: fetch fresh baseUrls on every slideshow rotation, cache for max 50 minutes.

**Sources:**
- [Google Photos API Best Practices (official)](https://developers.google.com/photos/overview/best-practices)
- [Picker API media items (official)](https://developers.google.com/photos/picker/guides/media-items)
- [Base urls expire before 60 minutes (Google Issue Tracker)](https://issuetracker.google.com/issues/165028980)

---

### Pitfall 3: OAuth Testing Mode -- Refresh Tokens Expire After 7 Days

**Severity:** CRITICAL -- photo frame stops working after exactly one week

**What goes wrong:**
When your Google Cloud project's OAuth consent screen is in "Testing" publishing status, refresh tokens expire after **exactly 7 days**. The photo frame works perfectly for a week, then silently stops loading photos. You re-authorize, it works for another week, then breaks again.

**Why it happens:**
Developers naturally start in "Testing" mode during development. Google's documentation buries this limitation. The 7-day expiry is specifically tied to publishing status, not the token itself. Most developers don't connect "my tokens stopped working" to their consent screen configuration.

**How to avoid:**
- Set your OAuth consent screen publishing status to **"In Production"** in Google Cloud Console
- For personal/self-hosted use (<100 users), you do NOT need Google verification -- users click through the "unverified app" warning once
- Always implement **refresh token persistence** (store encrypted on disk, not just in memory)
- Implement token refresh error handling: catch `invalid_grant` errors and trigger re-authorization flow
- Use `access_type: 'offline'` AND `prompt: 'consent'` on the first authorization to guarantee you receive a refresh token

**Warning signs:**
- OAuth consent screen shows "Testing" in Google Cloud Console
- `invalid_grant` error exactly 7 days after authorization
- Refresh token works intermittently (works after re-auth, fails a week later)

**Phase to address:** OAuth setup phase -- must be configured correctly before any testing.

**Weekend MVP trade-off:** Switch to "In Production" mode immediately. Takes 2 minutes. Do NOT defer this -- you'll waste hours debugging token failures.

**Sources:**
- [Google OAuth using OAuth 2.0 (official)](https://developers.google.com/identity/protocols/oauth2)
- [Nango: Google OAuth invalid_grant explained](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked)
- [HomeSeer forum: refresh token expires in 7 days](https://forums.homeseer.com/forum/internet-or-network-related-plug-ins/internet-or-network-discussion/ak-google-calendar-alexbk66/1545936-refresh-token-expires-in-7-days-if-oauth-consent-screen-publishing-status-is-testing)

---

### Pitfall 4: Picker API Requires User Interaction Every Time

**Severity:** CRITICAL -- fundamentally changes how a "photo frame" works

**What goes wrong:**
Unlike the old Library API (which allowed background syncing of entire albums), the Picker API requires the user to **actively open a Google Photos UI and select photos** via a `pickerUri` link. You cannot programmatically list the user's library or auto-sync an album. Developers expecting "connect once, auto-update forever" will hit a wall.

**Why it happens:**
Google deliberately restricted background library access for privacy. The Picker API is designed for explicit, user-initiated selection -- not passive syncing. This is a fundamental architectural constraint, not a bug.

**How to avoid:**
- Design the UX around **explicit photo selection sessions**: user visits the app, clicks "Choose Photos," gets redirected to Google Photos picker, selects photos/albums, returns
- Store the selected `media item IDs` persistently (these are permanent) so users don't re-pick every time
- Build a "refresh selection" flow for when users want to add/change photos
- Consider the Picker API session as a "photo import" step, not a "live sync" feature
- Alternative: allow users to upload photos directly (Library API `photoslibrary.appendonly` scope still works for app-created content)

**Warning signs:**
- Architecture diagram shows "background album sync" or "auto-update from Google Photos"
- No user-facing "select photos" button in the design
- Expecting albums to dynamically update when user adds photos to Google Photos

**Phase to address:** Architecture/design phase -- the UX must be designed around this constraint from the start.

**Weekend MVP trade-off:** This is a design constraint, not a shortcut. Accept it: the frame shows a curated set of photos chosen by the user. Build the "choose photos" flow as a first-class feature.

**Sources:**
- [Picker API sessions (official)](https://developers.google.com/photos/picker/guides/sessions)
- [Picker API user experience (official)](https://developers.google.com/photos/picker/guides/picking-experience)
- [memoryKPR: Google Photos API deprecation impact](https://memorykpr.com/blog/google-photos-api-deprecation-what-it-means-for-third-party-apps-and-how-to-prepare/)

---

### Pitfall 5: Wake Lock API Broken in iOS PWAs (pre-18.4)

**Severity:** CRITICAL on iOS 16.x / HIGH on iOS 18.4+

**What goes wrong:**
The Screen Wake Lock API does not work in installed PWAs (Add to Home Screen) on iOS versions before 18.4. The screen will go to sleep despite calling `navigator.wakeLock.request('screen')`. This makes the "photo frame" use case impossible on older iPads/iPhones -- the whole point is keeping the screen on.

**Why it happens:**
Apple had a long-standing WebKit bug (Bug 254545) where the Wake Lock API worked in Safari browser but was broken in standalone/home-screen PWA mode. This was fixed in iOS 18.4 but many devices run older versions.

**How to avoid:**
- **Check your target device's iOS version** -- if running iOS 16.x or 17.x, Wake Lock will NOT work in PWA mode
- Implement a **fallback: play a silent/invisible video loop** to prevent screen sleep (the classic NoSleep.js technique)
- Wrap `navigator.wakeLock.request()` in try/catch -- it will throw on unsupported platforms
- Re-acquire wake lock on `visibilitychange` event (lock is auto-released when tab/app is backgrounded)
- Test in actual PWA mode (Add to Home Screen), not just Safari browser

**Warning signs:**
- Screen dims/sleeps during slideshow on iPad
- Wake Lock works in Safari but not after "Add to Home Screen"
- Testing only in desktop Chrome (where Wake Lock always works)

**Phase to address:** Frontend PWA phase -- implement NoSleep.js fallback alongside Wake Lock API.

**Weekend MVP trade-off:** Use NoSleep.js or a silent video hack from the start. Takes 10 minutes. Testing Wake Lock in PWA mode on the actual target device is essential -- do not skip.

**Sources:**
- [WebKit Bug 254545: Wake Lock in Home Screen Web Apps](https://bugs.webkit.org/show_bug.cgi?id=254545)
- [Can I Use: Wake Lock API](https://caniuse.com/wake-lock)
- [PWA iOS limitations guide (Brainhub)](https://brainhub.eu/library/pwa-on-ios)

---

## Moderate Pitfalls

### Pitfall 6: Not Handling Google's Refresh Token "First-Time Only" Behavior

**Severity:** HIGH -- breaks token refresh after first authorization

**What goes wrong:**
Google only returns a refresh token on the **first** authorization. Subsequent OAuth calls return only an access token. If you don't capture and store the refresh token on first auth, you'll never get another one without revoking and re-authorizing.

**Why it happens:**
Most OAuth tutorials show the happy path. Google's behavior is documented but easy to miss: "Where the user has never logged in before, it will send the Refresh Token and the Access Token, but after that, every call to OAuth2 will return only the Access Token."

**How to avoid:**
- Use `prompt: 'consent'` in the authorization URL to force Google to return a refresh token every time (overrides the first-time-only behavior)
- Use `access_type: 'offline'` to request offline access
- Persist the refresh token to disk immediately upon receipt -- before doing anything else
- Never rely on getting a refresh token from a subsequent authorization without `prompt: 'consent'`

**Warning signs:**
- Token response missing `refresh_token` field
- Access token expires after 1 hour with no way to refresh
- Having to revoke app access in Google Account settings to get a new refresh token

**Phase to address:** OAuth implementation phase.

**Sources:**
- [Google OAuth 2.0 (official)](https://developers.google.com/identity/protocols/oauth2)
- [How to get refresh token (CopyProgramming)](https://copyprogramming.com/howto/stopped-getting-refresh-token-from-google-s-api)

---

### Pitfall 7: JavaScript Memory Leaks in Long-Running Slideshow

**Severity:** HIGH -- frame crashes/freezes after hours or days of continuous use

**What goes wrong:**
A photo slideshow that runs continuously leaks memory through: unreleased Blob URLs, detached DOM nodes from swapping images, un-cleared intervals/timeouts, and accumulated event listeners. After 24-48 hours, the PWA crashes or becomes unresponsive.

**Why it happens:**
Memory leaks are invisible in short testing sessions. You test for 10 minutes, everything works. But the frame is meant to run for days without restarting. Every slideshow transition creates garbage that needs explicit cleanup.

**How to avoid:**
- **Blob URLs:** Always call `URL.revokeObjectURL(url)` when transitioning away from an image
- **DOM nodes:** Reuse a single `<img>` element or a two-image swap (A/B pattern). Never append new images without removing old ones
- **Timers:** Use a single `setInterval` or `requestAnimationFrame` loop. Clear and re-create if slideshow settings change
- **Image loading:** Use `img.src = ''` or `img.removeAttribute('src')` before setting new source to release the previous image from memory
- **Event listeners:** Use `{ once: true }` option or explicitly `removeEventListener` for transitional listeners
- **Monitor:** Ship with a simple memory telemetry endpoint (report `performance.memory.usedJSHeapSize` if available)

**Warning signs:**
- Browser tab memory usage steadily climbing in Task Manager
- PWA becoming sluggish after several hours
- Sudden crash with no error (out-of-memory kill)

**Phase to address:** Frontend slideshow implementation phase.

**Weekend MVP trade-off:** Use the A/B image swap pattern from the start (two `<img>` elements, swap visibility). This prevents the most common leaks. Defer sophisticated memory monitoring to post-MVP.

**Sources:**
- [WebKit Bug 31253: Unbounded memory growth with images](https://bugs.webkit.org/show_bug.cgi?id=31253)
- [Auth0: Four types of JS memory leaks](https://auth0.com/blog/four-types-of-leaks-in-your-javascript-code-and-how-to-get-rid-of-them/)
- [MDN: Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management)

---

### Pitfall 8: iOS Safari Evicts PWA Storage After Inactivity

**Severity:** HIGH -- stored tokens and photo selections vanish

**What goes wrong:**
iOS Safari can automatically clear PWA storage (Cache API, IndexedDB, localStorage) if the PWA hasn't been used for a few weeks. A previously-configured photo frame that sits idle (showing photos but never interacted with by the user) may lose its stored OAuth tokens and photo selection IDs.

**Why it happens:**
Apple's Intelligent Tracking Prevention (ITP) aggressively caps "script-writable storage." WebKit applies a 7-day cap on script-writable storage for sites without recent user interaction. While there are nuances to what counts as "interaction," a photo frame running autonomously may not register as interactive.

**How to avoid:**
- Store OAuth tokens and critical data on the **server side** (Node.js backend), not in the PWA's client-side storage
- The PWA should authenticate with the backend using a session cookie or simple token, not store Google OAuth tokens directly
- Use the server as the source of truth for photo selection state
- If you must use client-side storage, periodically trigger a user interaction event (though this is fragile)

**Warning signs:**
- Photo frame stops working after being untouched for 1-2 weeks
- IndexedDB or localStorage data missing after iOS update
- Service worker cache cleared unexpectedly

**Phase to address:** Architecture phase -- decide early that tokens live server-side.

**Weekend MVP trade-off:** Store tokens server-side from the start. This is both more secure and avoids iOS eviction. The PWA should be a thin display layer.

**Sources:**
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [Brainhub: PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios)
- [Vinova: Safari/iOS PWA Limitations](https://vinova.sg/navigating-safari-ios-pwa-limitations/)

---

### Pitfall 9: API Quota Exhaustion from Aggressive Polling/Refreshing

**Severity:** HIGH -- frame stops loading photos for the rest of the day

**What goes wrong:**
The Library API (for app-created content) has a **10,000 requests/day** limit. The Picker API is more generous (100,000/min) but still has quotas. Developers who poll aggressively, refresh baseUrls too often, or don't implement caching will exhaust quotas. When quota is hit, API returns `429` and the frame goes dark.

**Why it happens:**
A photo frame that refreshes baseUrls every 60 seconds for 100 photos makes 1,440 requests/day just for URL refresh. Add session polling, error retries, and metadata lookups, and you're approaching limits fast. Multiple users or debugging sessions compound this.

**How to avoid:**
- **Batch baseUrl refreshes:** Refresh all photo URLs in a single paginated API call, not one per photo
- **Cache with TTL:** Cache baseUrls server-side for 50 minutes. Only refresh the batch when the cache expires
- **Don't poll Picker sessions more than the recommended interval:** The session response includes `pollingConfig.pollInterval` -- use it, don't poll every second
- **Implement exponential backoff** on 429 errors (minimum 30-second delay per Google's docs)
- **Monitor quota** in Google Cloud Console Quotas page
- **Avoid synchronized requests:** Don't trigger API calls at fixed clock times (top of the hour, etc.) -- randomize timing

**Warning signs:**
- `429 Too Many Requests` errors in logs
- Photos stop loading at a consistent time of day (quota resets daily)
- Multiple test users/devices burning through shared project quota

**Phase to address:** Backend API layer.

**Weekend MVP trade-off:** Implement basic caching from the start. A simple in-memory object with timestamps is sufficient for MVP. This prevents accidental quota burn during development too.

**Sources:**
- [Google Photos API limits and quotas (official)](https://developers.google.com/photos/overview/api-limits-quotas)
- [Google Photos Best Practices: avoid synchronized requests (official)](https://developers.google.com/photos/overview/best-practices)
- [rclone forum: working with 10K quota](https://forum.rclone.org/t/working-with-google-photos-all-requests-quota-limit-10k/34349)

---

### Pitfall 10: Nginx WebSocket/Proxy Misconfiguration

**Severity:** HIGH -- app appears broken despite backend running fine

**What goes wrong:**
Default nginx `proxy_pass` config doesn't forward WebSocket upgrade headers. If the frontend uses WebSocket (or SSE for real-time updates), connections fail silently. Also, missing `proxy_set_header Host` causes Node.js to see wrong hostnames. Missing `proxy_set_header X-Real-IP` means all traffic appears from `127.0.0.1`.

**Why it happens:**
Basic nginx reverse proxy examples work for simple HTTP but miss WebSocket headers. Developers copy-paste minimal configs without the upgrade headers.

**How to avoid:**
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

- Always include WebSocket upgrade headers even if you think you don't need WebSockets (you might add them later)
- Use `proxy_http_version 1.1` (HTTP/1.0 doesn't support keep-alive properly)
- Set up SSL with Let's Encrypt/Certbot before going live (Google OAuth requires HTTPS redirect URIs)

**Warning signs:**
- Frontend loads but can't connect to backend API
- WebSocket connections fail with no clear error
- OAuth redirect fails because redirect URI doesn't match (http vs https)

**Phase to address:** Deployment/infrastructure phase.

**Weekend MVP trade-off:** Use a known-good nginx config template. Don't write from scratch. Certbot SSL setup takes 5 minutes.

**Sources:**
- [PM2 Nginx production setup (official)](https://pm2.keymetrics.io/docs/tutorials/pm2-nginx-production-setup)
- [Better Stack: Nginx reverse proxy for Node.js](https://betterstack.com/community/guides/scaling-nodejs/nodejs-reverse-proxy-nginx/)

---

## Minor Pitfalls

### Pitfall 11: Not Setting Image Size Parameters on baseUrls

**Severity:** MEDIUM -- wastes bandwidth and causes slow loading

**What goes wrong:**
Fetching photos at original resolution (often 4000x3000px, 5-10MB each) when the display is only 1920x1080. Slideshow loads slowly, wastes bandwidth, and uses excessive memory.

**How to avoid:**
- Always append size parameters to baseUrls: `=w1920-h1080` for full display, `=w400-h300` for thumbnails
- Use `-c` suffix for cropped squares: `=w256-h256-c`
- Match parameters to actual display resolution

**Phase to address:** Frontend/backend photo serving.

**Sources:**
- [Picker API media items (official)](https://developers.google.com/photos/picker/guides/media-items)

---

### Pitfall 12: PM2 Not Configured for Auto-Restart on VPS Reboot

**Severity:** MEDIUM -- frame goes down after VPS restart and stays down

**What goes wrong:**
PM2 manages the Node.js process but doesn't auto-start after VPS reboot unless explicitly configured. Server reboots (maintenance, updates, crashes) leave the photo frame offline.

**How to avoid:**
- Run `pm2 startup` to generate the system startup script
- Run `pm2 save` after starting your app to save the process list
- Test with `sudo reboot` to verify it comes back

**Phase to address:** Deployment phase.

---

### Pitfall 13: OAuth Credentials Committed to Git

**Severity:** MEDIUM (security risk) -- credentials exposed if repo goes public

**What goes wrong:**
Client ID, client secret, or refresh tokens committed to version control. Even in a private repo, this is risky. If the repo ever goes public, credentials are leaked and bots scrape them within minutes.

**How to avoid:**
- Use `.env` file for all secrets, add `.env` to `.gitignore` immediately
- Add `.gitignore` as the very first file in the project (before `git init` if possible)
- Use a `.env.example` file with placeholder values for documentation
- Never log OAuth tokens to console in production

**Phase to address:** Project setup (first file created).

**Weekend MVP trade-off:** DO NOT cut this corner. `.gitignore` with `.env` takes 30 seconds. Leaked credentials are a real emergency.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing tokens in plaintext JSON file | Fast to implement | Security risk if server compromised | MVP only -- encrypt in production |
| Hardcoding slideshow interval | Skip settings UI | Can't adjust without code change | MVP -- add config endpoint later |
| No error UI (just console.log) | Faster development | Users see blank screen with no explanation | MVP -- add basic error states post-MVP |
| Single-user architecture | Simpler auth flow | Rewrite needed for multi-user | Acceptable for personal frame |
| In-memory baseUrl cache only | No persistence layer needed | Cache lost on server restart (requires re-fetch, not re-auth) | Acceptable for MVP |
| No health check endpoint | Nothing to build | Can't monitor if frame is alive | MVP -- add simple `/health` post-MVP |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google OAuth | Using `response_type: 'token'` (implicit flow) | Use `response_type: 'code'` (authorization code flow) for server-side apps |
| Google OAuth | Not including `access_type: 'offline'` | Always include for server apps that need long-lived access |
| Google OAuth | Redirect URI mismatch (http vs https, trailing slash) | Exact match required -- copy from Google Cloud Console, include protocol |
| Picker API | Polling session without checking `pollingConfig` | Use the `pollInterval` and `timeoutIn` values from the session response |
| Picker API | Not handling session timeout gracefully | Session can timeout if user takes too long -- show "try again" UI |
| Let's Encrypt | Forgetting to set up auto-renewal | Certs expire every 90 days. `certbot renew` in crontab or systemd timer |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all photos into DOM at once | Initial load takes 30+ seconds | Lazy-load: only keep current + next photo in DOM | >50 photos |
| No image preloading | Visible flash/loading between transitions | Preload next image while current is displaying | Always visible, annoying from photo 1 |
| Fetching full-res for thumbnails | Slow selection UI, high data usage | Use `=w400-h300` size params on baseUrls | >10 photos in selection view |
| Refreshing all baseUrls individually | N API calls instead of 1 | Use paginated `mediaItems.list` to refresh batch | >20 photos |
| No request deduplication | Same photo URL fetched multiple times | Track in-flight requests, deduplicate | Multiple components requesting same photo |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Google refresh token in client-side storage (localStorage/IndexedDB) | Token theft via XSS, iOS storage eviction | Store tokens server-side only. Client authenticates with backend via session cookie |
| Exposing `/api/photos` endpoint without authentication | Anyone with the URL can view private photos | Require session token/cookie for all API endpoints |
| Using Google OAuth client secret in frontend code | Secret visible in browser dev tools | Client secret belongs ONLY on the server. Frontend uses authorization code flow with PKCE or redirects |
| Not validating OAuth state parameter | CSRF attack on OAuth flow | Generate random state before redirect, validate on callback |
| Serving photos over HTTP | Photos visible to network observers | HTTPS required. Google OAuth won't redirect to HTTP in production |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback during photo selection | User doesn't know if app is working | Show spinner + "waiting for photo selection" message while polling Picker session |
| Blank screen on API error | User thinks frame is broken | Show last known good photo + subtle error indicator |
| No offline fallback | Network outage = white screen | Cache last N photos in service worker for offline display |
| Abrupt image transitions | Feels janky and amateurish | CSS crossfade transition (even 0.5s makes huge difference) |
| No way to trigger re-selection without developer access | User stuck with original photo set | Add a simple settings page or long-press gesture to open admin UI |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **OAuth flow:** Often missing error handling for denied permissions -- verify user can cancel and retry
- [ ] **Token refresh:** Often missing handling for `invalid_grant` -- verify the app re-prompts for auth instead of crashing
- [ ] **Slideshow:** Often missing preloading of next image -- verify no flash between transitions
- [ ] **Wake Lock:** Often missing re-acquisition after `visibilitychange` -- verify screen stays on after returning from background
- [ ] **Deployment:** Often missing PM2 startup config -- verify app survives VPS reboot (`pm2 startup && pm2 save`)
- [ ] **SSL:** Often missing auto-renewal -- verify `certbot renew --dry-run` works
- [ ] **Picker flow:** Often missing session timeout handling -- verify graceful UX when user takes too long to pick photos
- [ ] **Error recovery:** Often missing auto-retry on network failure -- verify slideshow resumes after Wi-Fi reconnects

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Built against deprecated Library API | HIGH (rewrite API layer) | Migrate to Picker API. Change scopes, rewrite album/photo fetching to session-based flow. Auth layer can likely be reused. |
| Cached stale baseUrls | LOW (fix caching logic) | Add TTL check to cache. Invalidate all cached URLs. Fetch fresh batch. |
| Tokens expired (testing mode) | LOW (config change + re-auth) | Switch consent screen to Production. Delete stored tokens. Re-authorize. |
| Memory leak in slideshow | MEDIUM (refactor slideshow) | Switch to A/B image swap pattern. Add `URL.revokeObjectURL()` calls. Clear references. |
| iOS storage eviction | LOW (move to server-side) | Move token storage to backend. PWA fetches session from server on load. |
| Quota exhaustion | LOW (add caching) | Add server-side baseUrl cache with 50-min TTL. Batch API calls. Wait for daily quota reset. |
| Nginx misconfiguration | LOW (fix config) | Apply known-good template config. Test with `nginx -t`. Restart nginx. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Deprecated Library API (#1) | Project setup / API selection | `photospicker.mediaitems.readonly` scope used, NOT `photoslibrary.readonly` |
| baseUrl expiry (#2) | Backend API implementation | Photos still load after 2+ hours of continuous display |
| OAuth testing mode (#3) | OAuth setup | Consent screen shows "In Production" in Cloud Console |
| Picker requires interaction (#4) | Architecture/design | UX flow includes explicit "Choose Photos" step |
| Wake Lock on iOS (#5) | Frontend PWA | Screen stays on for 30+ minutes on target iPad in PWA mode |
| Refresh token first-time-only (#6) | OAuth implementation | Authorization URL includes `prompt=consent` and `access_type=offline` |
| Memory leaks (#7) | Frontend slideshow | Memory usage stable after 4+ hours (check browser Task Manager) |
| iOS storage eviction (#8) | Architecture | Tokens stored server-side, not in client storage |
| API quota (#9) | Backend caching | <200 API calls/day for single-user frame |
| Nginx config (#10) | Deployment | HTTPS works, WebSocket connects, headers forwarded correctly |
| Image sizing (#11) | Frontend/backend | Network tab shows images at display resolution, not 4000px originals |
| PM2 auto-restart (#12) | Deployment | `sudo reboot` followed by frame coming back online within 60 seconds |
| Credentials in git (#13) | Project setup (first commit) | `.env` in `.gitignore`, no secrets in git history |

## Sources

**Official Google Documentation (HIGH confidence):**
- [Google Photos API Updates](https://developers.google.com/photos/support/updates)
- [Google Photos API Best Practices](https://developers.google.com/photos/overview/best-practices)
- [Google Photos API Limits and Quotas](https://developers.google.com/photos/overview/api-limits-quotas)
- [Picker API: Getting Started](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Picker API: Sessions](https://developers.google.com/photos/picker/guides/sessions)
- [Picker API: Media Items](https://developers.google.com/photos/picker/guides/media-items)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Unverified Apps](https://support.google.com/cloud/answer/7454865)

**Bug Trackers and Issue Reports (HIGH confidence):**
- [WebKit Bug 254545: Wake Lock in Home Screen Web Apps](https://bugs.webkit.org/show_bug.cgi?id=254545)
- [Google Issue Tracker: baseUrl expiry](https://issuetracker.google.com/issues/165028980)
- [WebKit Bug 31253: Unbounded memory growth with images](https://bugs.webkit.org/show_bug.cgi?id=31253)
- [PWA-POLICE/pwa-bugs: list of PWA bugs](https://github.com/PWA-POLICE/pwa-bugs)

**Community Reports (MEDIUM confidence):**
- [memoryKPR: Google Photos API Deprecation](https://memorykpr.com/blog/google-photos-api-deprecation-what-it-means-for-third-party-apps-and-how-to-prepare/)
- [Brainhub: PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios)
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [rclone: Google Photos quota discussion](https://forum.rclone.org/t/working-with-google-photos-all-requests-quota-limit-10k/34349)
- [Nango: Google OAuth invalid_grant](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked)
- [Can I Use: Wake Lock API](https://caniuse.com/wake-lock)

---
*Pitfalls research for: Google Photos digital photo frame (Node.js + vanilla JS PWA)*
*Researched: 2026-02-08*
