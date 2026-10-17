---
phase: 01-backend-deployment
plan: 02
subsystem: picker-integration
tags: [picker-api, photo-cache, baseurl-refresh, session-flow]

requires:
  - 01-01 (OAuth authentication with oAuth2Client)

provides:
  - Picker API session flow (start, poll, complete)
  - Photo cache with persistence (cache.json)
  - Automatic baseUrl refresh every 50 minutes
  - Media items storage with session ID tracking

affects:
  - 01-03 (Photo proxy will use photoCache.getRandomItem() to serve images)
  - 01-04 (Health endpoint will report cache size and last refresh)

tech-stack:
  added:
    - none (uses existing Express and google-auth-library)
  patterns:
    - Picker API session lifecycle (create, poll, complete)
    - In-memory cache with filesystem persistence
    - Automatic baseUrl refresh interval (50 minutes)
    - Pagination pattern for mediaItems.list (pageSize: 100)

key-files:
  created:
    - picker.js: Picker API routes (/start, /status/:id, /complete/:id)
    - photo-cache.js: In-memory cache with baseUrl refresh scheduler
  modified:
    - server.js: Mounted /api/picker routes
    - .gitignore: Added cache.json

decisions:
  - decision: Store sessionId in cache for baseUrl refresh
    rationale: mediaItems.list requires sessionId to get fresh baseUrls
    impact: Cache persists sessionId alongside mediaItems array
  - decision: 50-minute refresh interval
    rationale: BaseUrls expire after 60 minutes per research
    impact: 10-minute buffer ensures URLs stay fresh
  - decision: Gitignore cache.json
    rationale: Contains user-specific media item selection (not secrets but personal)
    impact: Cache.json excluded from git, persisted locally only

metrics:
  duration: 4 minutes
  tasks: 3
  commits: 3
  files-created: 2
  files-modified: 2
  completed: 2026-02-09
---

# Phase 1 Plan 02: Picker Integration & Photo Cache Summary

**One-liner:** Picker API session flow with automatic baseUrl refresh (50-min interval) and persistent cache.json for media item storage.

## What Was Built

Implemented the full Google Photos Picker API integration, enabling users to select photos via Google's Picker UI and caching those selections for serving. The system creates Picker sessions, polls for completion, paginates through selected media items (up to 100 per page), and caches them with automatic baseUrl refresh every 50 minutes to prevent URL expiry.

This plan delivers the photo selection and caching layer. Users can now pick photos from their Google Photos library, and the backend stores media item IDs + baseUrls with automatic freshness maintenance.

## Key Files Created

### picker.js (191 lines)
Picker API session management with three routes:

**POST /api/picker/start**
- Calls `https://photospicker.googleapis.com/v1/sessions` to create session
- Gets access token from oAuth2Client
- Returns sessionId, pickerUrl (with /autoclose), pollInterval, timeout
- Stores sessionId in req.session for tracking

**GET /api/picker/status/:sessionId**
- Polls session status from Picker API
- Returns `{ done: true }` when mediaItemsSet is true
- Frontend uses this to detect when user finished selection

**POST /api/picker/complete/:sessionId**
- Paginates through mediaItems.list (pageSize: 100 max)
- Handles nextPageToken for multi-page results
- Calls photoCache.setItems(allItems, sessionId) to cache
- Returns total count of selected items

**Error handling:**
- Logs all API errors with status codes
- Returns structured JSON errors
- Handles fetch failures gracefully

### photo-cache.js (193 lines)
In-memory cache with persistence and automatic baseUrl refresh:

**Cache structure:**
```javascript
{
  sessionId: "picker-session-id",
  mediaItems: [
    { id, baseUrl, mimeType, createTime, ... }
  ],
  lastRefresh: "2026-02-09T20:15:00Z",
  lastApiCall: "2026-02-09T20:15:00Z"
}
```

**Public API:**
- `setItems(items, sessionId)`: Store media items, start refresh interval
- `getItem(id)`: Retrieve specific item by ID
- `getRandomItem()`: Get random item from cache (for slideshow)
- `size()`: Get total item count
- `getSessionId()`: Get stored session ID
- `getLastRefresh()`: Get last refresh timestamp
- `getLastApiCall()`: Get last API call timestamp
- `refreshBaseUrls()`: Manually trigger refresh (also runs on interval)

**Persistence:**
- Loads cache.json on startup (restores across server restarts)
- Saves to disk on setItems() and after refresh
- Preserves sessionId for future refreshes

**BaseUrl refresh mechanism:**
- Runs every 50 minutes (before 60-minute expiry)
- Re-calls mediaItems.list with stored sessionId
- Paginates through all items to get fresh baseUrls
- Maps fresh items by ID and updates cache
- Saves updated cache to disk
- Logs refresh completion with item count

**Initialization:**
- Loads cache on module load
- Starts refresh interval after first setItems() call
- Logs loaded item count

## How Picker Flow Works

1. **Frontend calls POST /api/picker/start**
   - Backend creates Picker session with Google
   - Returns pickerUrl + sessionId

2. **User opens pickerUrl in new tab/window**
   - Google Photos Picker UI loads
   - User browses and selects photos
   - Tab auto-closes after selection (via /autoclose param)

3. **Frontend polls GET /api/picker/status/:sessionId**
   - Checks if mediaItemsSet is true
   - Continues until done

4. **Frontend calls POST /api/picker/complete/:sessionId**
   - Backend paginates through mediaItems.list
   - Caches all selected items with sessionId
   - Returns count

5. **Background refresh runs every 50 minutes**
   - Re-lists media items with sessionId
   - Updates baseUrls in cache
   - Saves to disk

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Unblocked:**
- Plan 01-03 (Photo proxy) can now use `photoCache.getRandomItem()` to get items with fresh baseUrls
- Plan 01-04 (Health endpoint) can now report `photoCache.size()`, `getSessionId()`, `getLastRefresh()`, `getLastApiCall()`

**Potential considerations:**
- Picker session longevity is undocumented by Google. If sessions expire after extended periods, baseUrl refresh may fail and require user to re-select photos. This is flagged in research as an open question requiring empirical testing.
- Current implementation keeps refresh interval running even if session becomes invalid. Future enhancement: detect session expiry errors and stop refresh interval until user creates new session.

## Testing Notes

### Verified Success Criteria (Code Structure)
- ✓ POST /api/picker/start route exists and creates session (route implemented)
- ✓ GET /api/picker/status/:id route exists (polling endpoint ready)
- ✓ POST /api/picker/complete/:id route exists (pagination implemented)
- ✓ photo-cache.js loads cache.json on startup (loadCache() called on module load)
- ✓ photoCache exports getRandomItem, setItems, size, refreshBaseUrls (all exported)
- ✓ cache.json is gitignored (added to .gitignore)
- ✓ BaseUrl refresh interval is set up (setInterval after setItems)

### Manual Testing Required
Full end-to-end testing requires:
1. Run server with `op run --env-file=okno.env -- node server.js`
2. Visit /auth/login to authenticate (from Plan 01-01)
3. Call POST /api/picker/start via curl or frontend
4. Open returned pickerUrl in browser
5. Select photos in Google Photos Picker UI
6. Poll /api/picker/status until done: true
7. Call POST /api/picker/complete to cache items
8. Verify cache.json created with mediaItems array
9. Restart server, confirm cache.json loaded (check logs)
10. Wait 50 minutes (or manually call refreshBaseUrls) to verify refresh works

This will be completed in Plan 01-05 (VPS deployment and end-to-end testing).

### Architecture Validation

**Key architectural decisions validated:**
- ✓ Picker API session flow matches research Pattern "Picker API Session Flow"
- ✓ BaseUrl refresh strategy matches research Pattern "BaseUrl Refresh Strategy"
- ✓ Pagination matches research (pageSize: 100 max)
- ✓ Session ID stored for refresh (per research requirement)
- ✓ Cache persistence matches requirement (tokens.json pattern)

**Not yet validated (requires live testing):**
- Picker session longevity for baseUrl refresh (open question from research)
- Actual 60-minute baseUrl expiry (research says 60 minutes, needs empirical confirmation)
- Google's response to expired sessions during refresh

## Maintenance Notes

**Cache Management:**
- cache.json is gitignored (not committed)
- Contains: sessionId, mediaItems array, timestamps
- Safe to delete (user will need to re-select photos)
- No PII or secrets (just media item IDs and Google-hosted URLs)

**BaseUrl Refresh:**
- Runs automatically every 50 minutes after first setItems()
- Logs each refresh with timestamp and item count
- On error: logs but doesn't crash (keeps stale baseUrls until next attempt)
- Manual trigger: `photoCache.refreshBaseUrls()` (for testing or recovery)

**Session Expiry Handling:**
- If Picker session expires, refresh will fail
- Current behavior: logs error, continues with stale baseUrls
- Recovery: user creates new Picker session and re-selects photos

**Memory Usage:**
- In-memory cache holds full mediaItems array
- Each item ~200-500 bytes (id, baseUrl, mimeType, createTime, etc.)
- 1000 items ≈ 0.5 MB in memory (negligible)

## Performance

**Execution Time:** 4 minutes
- Task 1 (picker.js): ~2 minutes
- Task 2 (photo-cache.js): ~2 minutes
- Task 3 (server.js + .gitignore): <1 minute

**Commit History:**
- c3a674e: feat(01-02): implement Picker API session flow
- 7778d7f: feat(01-02): implement photo cache with baseUrl refresh
- 244865b: feat(01-02): mount Picker routes and gitignore cache.json

**Code Metrics:**
- picker.js: 191 lines
- photo-cache.js: 193 lines
- Total new code: 384 lines
- Modified: server.js (+6 lines), .gitignore (+1 line)

## Research Alignment

**Patterns implemented:**
- ✅ Pattern 1: Image Proxy (foundation laid - photo-cache.js provides getRandomItem for proxy)
- ✅ Pattern 2: Picker API Session Flow (exact implementation from research)
- ✅ Pattern 4: BaseUrl Refresh Strategy (50-minute interval, re-list with sessionId)

**Anti-patterns avoided:**
- ✅ Did NOT store baseUrls in persistent cache without refresh (baseUrls expire)
- ✅ Did NOT expose OAuth tokens to frontend (all API calls server-side)
- ✅ Did use /autoclose param for pickerUri (per research guidance)

**Open questions from research:**
- Picker API session longevity: Flagged for testing in Plan 01-05
- Session expiry after user completes selection: Will be validated during end-to-end testing

---

*Completed: 2026-02-09*
*Duration: 4 minutes*
*Status: All success criteria met, ready for Plan 01-03*
