---
phase: 01-backend-deployment
plan: 03
subsystem: photo-serving
tags: [image-proxy, health-check, google-photos-api, streaming]

requires:
  - 01-01 (OAuth authentication with oAuth2Client for bearer tokens)
  - 01-02 (Photo cache with getRandomItem() and diagnostics methods)

provides:
  - Random photo serving endpoint with Google Photos authorization
  - Image streaming proxy (critical for Picker API auth requirement)
  - Health check endpoint with comprehensive diagnostics
  - Operational visibility into auth, cache, and system state

affects:
  - 01-04 (Deployment will use /api/health for monitoring)
  - 02-* (Frontend Phase 2 will use /api/photo/random for slideshow)

tech-stack:
  added:
    - none (uses existing Express and google-auth-library)
  patterns:
    - Backend image proxy (Picker API baseUrls require Authorization headers)
    - Image streaming (fetch from Google, pipe to client)
    - Health check endpoint (operational visibility)
    - Response header enrichment (X-Photo-Id, X-Photo-CreateTime)

key-files:
  created:
    - photo-proxy.js: Image proxy that streams Google Photos with OAuth headers
    - health.js: Comprehensive diagnostics endpoint
  modified:
    - server.js: Mounted /api/photo and /api/health routes

decisions:
  - decision: Use w2048-h1536 size parameters for baseUrl
    rationale: iPad Pro 1st Gen landscape display (2732x2048 native resolution)
    impact: Optimized image size for target device without over-fetching
  - decision: Cache-Control: no-store on proxied images
    rationale: BaseUrls expire after 60 minutes, caching could serve expired URLs
    impact: Browser must re-fetch on each request, ensuring fresh baseUrls used
  - decision: Return 503 when cache is empty (not 404)
    rationale: 503 indicates temporary service unavailability, 404 implies endpoint doesn't exist
    impact: Clearer error semantics for frontend handling

metrics:
  duration: 5 minutes
  tasks: 3
  commits: 3
  files-created: 2
  files-modified: 1
  completed: 2026-02-09
---

# Phase 1 Plan 03: Random Photo Serving & Health Check Summary

**One-liner:** Backend image proxy streams Google Photos with OAuth headers, plus health endpoint showing auth/cache/system diagnostics.

## What Was Built

Implemented the core photo serving capability (requirement AUTH-04, DISP-05) and operational visibility (requirement INFRA-04). The image proxy is the most critical architectural piece in the entire backend: Picker API baseUrls require `Authorization: Bearer <token>` headers, which browser `<img>` tags cannot provide. The backend must act as a proxy, fetching image bytes from Google with OAuth credentials and streaming them to the client.

This plan delivers the foundation for the slideshow (Phase 2 frontend will call `/api/photo/random`), plus comprehensive diagnostics for monitoring and debugging.

## Key Files Created

### photo-proxy.js (95 lines)
Backend image proxy implementing the critical Picker API auth pattern:

**GET /api/photo/random**
- Calls `photoCache.getRandomItem()` to select random photo from cache
- If cache empty, returns 503 JSON: `{ error: 'no_photos', message: '...' }`
- Gets OAuth access token via `oAuth2Client.getAccessToken()`
- Appends size parameters to baseUrl: `${item.baseUrl}=w2048-h1536`
- Fetches image bytes from Google with `Authorization: Bearer ${token}` header
- If Google fetch fails, returns 502 JSON: `{ error: 'proxy_failed', message: '...' }`
- Streams image bytes to client using `imageResponse.body.pipe(res)`
- Sets response headers:
  - `Content-Type`: from Google response (usually image/jpeg or image/png)
  - `Cache-Control: no-store` (baseUrls expire, don't cache)
  - `X-Photo-Id`: media item ID
  - `X-Photo-CreateTime`: photo creation timestamp
- Logs each served photo with ID and content type

**Why this is critical (from research):**
> The deprecated Library API allowed direct baseUrl access without auth. The new Picker API changed this behavior. BaseUrls now require OAuth bearer token. Backend must proxy all image requests.

This is the single most important architectural pattern in the backend. Without it, photos cannot be displayed.

### health.js (54 lines)
Comprehensive diagnostics endpoint for monitoring:

**GET /api/health**
Returns JSON with all operational metrics:
```json
{
  "status": "ok",
  "uptime": 12345.67,  // Process uptime in seconds
  "timestamp": "2026-02-09T20:35:00Z",
  "auth": {
    "hasTokens": true,
    "tokenExpiry": "2026-02-09T21:35:00Z",
    "hasRefreshToken": true,
    "expiresIn": 3600  // Seconds until token expires (countdown)
  },
  "cache": {
    "totalItems": 42,
    "sessionId": "picker-session-abc123",
    "lastRefresh": "2026-02-09T19:45:00Z"
  },
  "lastApiCall": "2026-02-09T19:45:00Z",
  "memory": {
    "rss": 12345678,
    "heapTotal": 1234567,
    "heapUsed": 987654,
    "external": 12345
  }
}
```

**Diagnostics provided (per INFRA-04 requirement):**
- **Auth visibility:** Token status, expiry countdown, refresh token presence
- **Cache visibility:** Total items, session ID, last refresh timestamp
- **System visibility:** Uptime, memory usage, current timestamp
- **API tracking:** Last API call timestamp (from cache refresh)

Returns 200 OK even on internal errors (proper health check behavior).

## How Image Proxy Works

1. **Frontend requests:** GET http://localhost:3100/api/photo/random
2. **Backend selects:** Call `photoCache.getRandomItem()` → returns media item with ID, baseUrl, metadata
3. **Backend fetches:**
   - Get OAuth token: `const { token } = await oAuth2Client.getAccessToken()`
   - Append size params: `${baseUrl}=w2048-h1536`
   - Fetch from Google: `fetch(imageUrl, { headers: { 'Authorization': `Bearer ${token}` } })`
4. **Backend streams:** `imageResponse.body.pipe(res)` → stream bytes directly to client
5. **Client displays:** Browser receives image bytes with Content-Type: image/jpeg

**Why streaming (not buffering):**
- Images can be large (2048x1536 high-quality JPEGs)
- Streaming starts sending bytes immediately (lower latency)
- Doesn't load entire image into memory (lower memory footprint)
- Node.js fetch API provides ReadableStream that can be piped directly

## Architecture Deep Dive

### Why Backend Proxy is Necessary

**Browser limitation:** `<img>` tags cannot add custom HTTP headers
**Picker API requirement:** baseUrls require `Authorization: Bearer <token>` header
**Solution:** Backend acts as authenticated proxy

```
┌─────────┐                ┌─────────┐                 ┌──────────────┐
│ Browser │───────────────▶│ Backend │────────────────▶│ Google Photos│
│  <img>  │  GET /api/     │  Proxy  │  GET baseUrl   │   Picker API │
│         │  photo/random  │         │  + Auth header │              │
└─────────┘                └─────────┘                 └──────────────┘
                                │
                                │ Streams bytes back
                                ▼
                           [Image bytes]
```

**Alternative considered (doesn't work):**
- Frontend fetches baseUrl directly → 401 Unauthorized (no auth header)
- Frontend includes token in URL param → Not supported by Google
- Frontend uses CORS proxy → Still can't add auth header

**Conclusion:** Backend proxy is the ONLY viable solution.

### Size Parameter Selection

Research: Google requires width/height params on baseUrls
Format: `${baseUrl}=w{width}-h{height}` or `=d` (download)

**Chosen:** `=w2048-h1536`
- iPad Pro 1st Gen: 2732x2048 display (landscape)
- 2048x1536 covers most landscape displays
- Slightly under native resolution (faster download)
- Google scales image to fit within bounds (maintains aspect ratio)

**Future enhancement:** Frontend could pass desired dimensions as query params:
`GET /api/photo/random?width=2732&height=2048`

### Error Handling Strategy

**503 Service Unavailable (cache empty):**
- Temporary condition (user can fix by using Picker)
- Returns helpful message: "Use the picker to select photos first"
- Frontend can show UI prompt to select photos

**502 Bad Gateway (Google fetch fails):**
- Google returned non-200 status (likely expired baseUrl or auth issue)
- Logged with status code for debugging
- Frontend can retry or fallback

**No 404 errors:** Endpoint always exists, different conditions use appropriate 5xx codes

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Unblocked:**
- Plan 01-04 (VPS Deployment) can use `/api/health` for monitoring
- Plan 01-05 (End-to-end testing) can test full photo serving flow
- Phase 2 (Frontend) can build slideshow using `/api/photo/random`

**No blockers or concerns.**

## Testing Notes

### Verified Success Criteria (Code Structure)
- ✓ photo-proxy.js implements GET /api/photo/random (route exists)
- ✓ Image proxy adds Authorization header (code verified)
- ✓ Random selection via `photoCache.getRandomItem()` (code verified)
- ✓ Empty cache returns 503 with helpful message (code verified)
- ✓ health.js implements GET /api/health (route exists)
- ✓ Health shows token status, expiry, cache size, lastRefresh (code verified)
- ✓ Routes mounted in server.js (code verified)

### Manual Testing Required

Because image proxy requires:
1. Valid OAuth tokens (from Plan 01-01)
2. Populated cache (from Plan 01-02 Picker flow)
3. Active Google Photos API access

**Test plan for Plan 01-05 (VPS deployment):**
1. Run server with `op run --env-file=okno.env -- node server.js`
2. Authenticate via /auth/login
3. Use Picker to select photos via /api/picker/start → complete flow
4. Call GET /api/photo/random → should return image bytes
5. Verify X-Photo-Id header present
6. Call multiple times → should return different photos (randomization)
7. Call GET /api/health → should show cache size, token expiry, uptime
8. Delete cache.json, restart server, call /api/photo/random → should return 503

### Architecture Validation

**Key patterns validated:**
- ✓ Image proxy pattern (from research "Pattern 1: Image Proxy")
- ✓ Authorization header on baseUrl (Picker API requirement)
- ✓ Image streaming (pipe pattern)
- ✓ Health check with detailed diagnostics (INFRA-04 requirement)

**Not yet validated (requires live testing):**
- Actual image streaming performance with large files
- BaseUrl expiry handling (60-minute timeout)
- Token refresh during image fetch
- Random selection distribution (all photos served over time)

## Maintenance Notes

**Endpoint usage:**
- `/api/photo/random`: Called by frontend slideshow (Phase 2)
- `/api/health`: Called by monitoring systems and manual debugging

**Performance considerations:**
- Image streaming is efficient (no buffering)
- Each request to /random does OAuth token check (cached by google-auth-library)
- Large images (2048x1536) may take 1-2 seconds to stream on slow connections
- No rate limiting yet (may need in future if exposed to public)

**Debugging:**
- Check logs for "Served random photo" with photo ID
- Check logs for "Google image fetch failed" with status codes
- Use /api/health to verify cache is populated and tokens are valid
- Use X-Photo-Id header to track which photo was served

**Common issues:**
- 503 errors → Cache is empty, use Picker to select photos
- 502 errors → BaseUrls expired (refresh interval should prevent), or token invalid
- Slow image loading → Check network, consider CDN in future

## Performance

**Execution Time:** 5 minutes
- Task 1 (photo-proxy.js): ~2 minutes
- Task 2 (health.js): ~1 minute
- Task 3 (server.js updates): ~1 minute
- Verification and commit: ~1 minute

**Commit History:**
- a1ab2cb: feat(01-03): implement image proxy for random photo serving
- dc907be: feat(01-03): implement health check endpoint
- e9b6065: feat(01-03): mount photo and health routes

**Code Metrics:**
- photo-proxy.js: 95 lines (critical 60+ min_lines met)
- health.js: 54 lines (40+ min_lines met)
- server.js: +10 lines (route mounting)
- Total new code: 149 lines
- Modified: server.js (+10 lines)

## Research Alignment

**Patterns implemented:**
- ✅ Pattern 1: Image Proxy (Critical -- Picker API Requires Auth Headers)
  - Exact implementation from research "Random Photo Endpoint" example
  - Addresses research finding: "baseUrl requires Authorization header"
- ✅ Health Check Endpoint example from research
  - All fields from research example included
  - Added expiresIn countdown (enhancement)

**Anti-patterns avoided:**
- ✅ Did NOT expose baseUrls directly to frontend (would fail with 401)
- ✅ Did NOT buffer entire image in memory (used streaming)
- ✅ Did NOT cache proxied images (baseUrls expire after 60 minutes)

**Pitfalls avoided:**
- ✅ Pitfall 1: BaseUrl Requires Auth Header (Picker API)
  - Research: "Developer puts baseUrl directly in `<img src>` and gets 401 errors"
  - Solution: Implemented backend proxy with Authorization header
- ✅ Pitfall 4: Missing Size Parameters on BaseUrl
  - Research: "Google requires you to append `=w{width}-h{height}`"
  - Solution: Appended `=w2048-h1536` to all baseUrls

---

*Completed: 2026-02-09*
*Duration: 5 minutes*
*Status: All success criteria met, ready for Plan 01-04 (VPS deployment)*
