# Phase 4: Bug Fixes + Stability - Research

**Researched:** 2026-02-15
**Domain:** Bug fixes to vanilla JS/Node.js photo slideshow PWA (6 bugs + 1 deployment task)
**Confidence:** HIGH

## Summary

Phase 4 addresses six bugs found during v1.0 QA testing plus one deployment task (Service Worker cache version bump). All bugs are targeted fixes to the existing codebase with clear root causes identified through direct code analysis. No new dependencies are needed -- all fixes use existing vanilla JS, CSS, and Node.js patterns already present in the codebase.

The most architecturally significant fix is BUGFIX-01 (Picker session batch merge), which requires changing `photo-cache.js` `setItems()` from a replace operation to a merge operation. This is the only fix that changes data persistence behavior. The remaining bugs are UI/UX fixes (BUGFIX-02 through BUGFIX-06) and error handling improvements that touch `slideshow.html`, `index.html`, and `photo-proxy.js`.

DEPLOY-01 (Service Worker cache version) is a one-line change but has outsized impact -- without it, iPad PWAs will serve stale v1.0 HTML from cache and never receive bug fixes.

**Primary recommendation:** Fix bugs in dependency order -- BUGFIX-01 first (data layer), then BUGFIX-03/04/05 (error handling), then BUGFIX-02/06 (UI), then DEPLOY-01 last (cache bust deploys everything).

## Standard Stack

No new libraries needed. All fixes use the existing stack.

### Core (Already Installed)
| Library | Version | Purpose | Relevant To |
|---------|---------|---------|-------------|
| Express | (existing) | Backend routing | BUGFIX-01, BUGFIX-05 |
| Vanilla JS | n/a | Frontend logic | All BUGFIX-02 through BUGFIX-06 |
| CSS | n/a | Layout/styling | BUGFIX-03, BUGFIX-06 |
| Service Worker API | n/a | Cache management | DEPLOY-01 |

### No New Dependencies

This phase requires zero new npm packages, zero new CDN scripts, and zero new browser APIs. Every fix uses patterns already proven in the codebase.

## Architecture Patterns

### Pattern 1: Cache Merge (BUGFIX-01)

**What:** The current `setItems()` in `photo-cache.js` (line 69) replaces the entire cache with new items. It must instead merge new selections with existing cached items, deduplicating by photo ID.

**Root cause (verified in code):**
```javascript
// photo-cache.js line 69-74 -- CURRENT (replaces)
function setItems(items, sessionId) {
  cache.mediaItems = items;  // <-- THIS OVERWRITES
  cache.sessionId = sessionId;
  cache.lastRefresh = new Date().toISOString();
  saveCache();
}
```

**Fix pattern:**
```javascript
// Merge: deduplicate by item ID, append new items
function setItems(items, sessionId) {
  const existingIds = new Set(cache.mediaItems.map(item => item.id));
  const newItems = items.filter(item => !existingIds.has(item.id));
  cache.mediaItems = [...cache.mediaItems, ...newItems];
  cache.sessionId = sessionId;  // Update to latest session for baseUrl refresh
  cache.lastRefresh = new Date().toISOString();
  saveCache();
}
```

**Key consideration:** The `sessionId` stored in cache is used by `refreshBaseUrls()` (line 173) to re-fetch fresh baseUrls. When merging items from multiple Picker sessions, only the LATEST session's items will be refreshable via the Picker API. Items from older sessions will have stale baseUrls after 60 minutes. This is an inherent limitation of the Google Picker API architecture -- each session only returns its own items. The fix should update `sessionId` to the latest one and accept that older items will eventually fail (the existing 502 retry logic in the frontend handles this gracefully).

**Confidence:** HIGH -- root cause is a direct `=` assignment on line 69 of `photo-cache.js`.

### Pattern 2: Countdown Timer UI (BUGFIX-02)

**What:** The Picker session has a timeout (`pollingConfig.timeoutIn` returned from Google API, currently stored as `data.timeout` in the frontend). The frontend must show a visible countdown so users know when the session expires.

**Root cause (verified in code):** The `openPicker()` function in `index.html` (line 811) receives `timeout` from the backend (line 64-65 of `picker.js` returns it as `timeout: session.pollingConfig?.timeoutIn || '600s'`), but never displays it to the user. The timeout value is a duration string like `"600s"` (10 minutes).

**Fix pattern:**
```javascript
// Parse timeout duration string "600s" to seconds
function parseTimeoutSeconds(timeoutStr) {
  const match = String(timeoutStr).match(/^(\d+)s$/);
  return match ? parseInt(match[1]) : 600; // Default 10 min
}

// Display countdown in pickerStatusEl during Picker session
function startCountdown(seconds) {
  let remaining = seconds;
  const countdownInterval = setInterval(() => {
    remaining--;
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const countdownEl = document.getElementById('pickerCountdown');
    if (countdownEl) {
      countdownEl.textContent = `Session expires in ${mins}:${secs.toString().padStart(2, '0')}`;
      if (remaining <= 60) {
        countdownEl.style.color = '#e74c3c'; // Red warning
      }
    }
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      // Show expiry message
    }
  }, 1000);
  return countdownInterval;
}
```

**Key consideration:** The countdown should be visible in both desktop (popup) and mobile (tab) flows. For mobile/iPad, the countdown appears on the home page while the user is in the Picker tab. For desktop, it appears below the "Opening Google Photos Picker..." message.

**Confidence:** HIGH -- the `timeout` value is already returned by the backend, just not displayed.

### Pattern 3: Visible Fallback Message (BUGFIX-03)

**What:** When On This Day mode has no matching photos, the user sees a black screen instead of a visible message. The `onThisDayMessage` element exists in the DOM (line 451 of `slideshow.html`) but may not be visible enough, or the fallback logic may not trigger correctly.

**Root cause (verified in code):** The fallback logic in `createPhotoElement()` (line 726-740 of slideshow.html) catches the error from `fetchWithRetry`, shows a message, and sets `onThisDayFallback = true`. However, `fetchWithRetry` retries 7 times before failing, which means the user stares at a black screen for ~10+ seconds of retry delay before seeing the message. Additionally, the retry logic treats HTTP 404 the same as network errors, retrying a 404 seven times when it should fail immediately.

**Fix pattern:**
```javascript
// In fetchWithRetry: don't retry 404s (they're intentional, not transient)
async function fetchWithRetry(url, maxRetries = 7) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 404) {
        // 404 is intentional (no photos today) -- don't retry
        throw { status: 404, response };
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (error.status === 404) throw error; // Propagate 404 immediately
      // ... existing retry logic
    }
  }
}
```

Also, the `#onThisDayMessage` CSS uses `display: none` / `display: block` toggle. The message element has a dark background with white text, which is correct for a black background. But the message hides after 5 seconds (line 893), and by that time the fallback to random photos may not have loaded yet, leaving a black screen again.

**Fix:** Keep the message visible until the first fallback photo loads successfully. Remove the 5-second auto-hide timeout and instead hide the message in `showSinglePhoto()` when the first random photo appears.

**Confidence:** HIGH -- root cause identified in code through direct analysis of the error handling flow.

### Pattern 4: Calendar Indicator Independence (BUGFIX-04)

**What:** The On This Day calendar indicator (`#onThisDayIndicator`, line 445) should show even before the first photo loads. Currently, `updateOnThisDayIndicator()` is only called after a photo successfully loads (line 765), so there is no indicator while loading.

**Root cause (verified in code):** The indicator depends on `createTime` from the photo response header (line 745). Before a photo loads, there is no createTime. But the indicator should show that On This Day mode is active (with just today's date) regardless of photo state.

**Fix pattern:**
```javascript
// In init(), after config is loaded, show OTD indicator immediately
if (onThisDayEnabled) {
  const today = new Date();
  const formatted = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  document.getElementById('onThisDayDate').textContent = formatted;
  document.getElementById('onThisDayIndicator').classList.add('visible');
}
```

Then update with photo-specific data (year, count) once the first photo loads.

**Confidence:** HIGH -- straightforward UI timing issue, verified by reading the indicator update flow.

### Pattern 5: 502 Resilience Without Reload (BUGFIX-05)

**What:** When the backend returns 502 during a mode switch (e.g., switching from random to On This Day), the slideshow should recover without requiring a manual page reload.

**Root cause (verified in code):** The `fetchWithRetry()` function (line 599) already has exponential backoff retry logic with 7 retries. QA noted that recovery required "manual cache refresh" -- this suggests the issue is in the backend's `photo-proxy.js` where a 502 from Google (line 91-101) is returned directly to the client as a 502, and the Service Worker caches this 502 error response.

Looking at `sw.js` line 47-48: the Service Worker caches ALL responses from `/api/photo/*`, including error responses. When the network returns a 502, it gets cached, and subsequent requests may receive the cached 502 instead of retrying the network.

**Fix pattern (sw.js):**
```javascript
// Only cache successful responses
if (url.pathname.startsWith('/api/photo')) {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache 2xx responses, NOT errors
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(PHOTO_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
}
```

Additionally, in the frontend `createPhotoElement()`, when a 502 is received, the photo slot should keep showing the previous photo (which already happens -- the function returns `null` and the caller logs a warning on line 669). But the slideshow should also trigger a proactive `refreshBaseUrls` on the backend when it detects a 502, since stale baseUrls are the root cause of Google returning 502.

**Frontend fix pattern:**
```javascript
// After detecting 502 in createPhotoElement, trigger backend refresh
if (response.status === 502) {
  console.warn('502 from backend, triggering baseUrl refresh');
  fetch('/api/health/refresh', { method: 'POST' }).catch(() => {});
  return null; // Keep showing previous photo
}
```

**Confidence:** HIGH -- the Service Worker caching error responses is clearly visible in sw.js. The `response.ok` check is standard Service Worker practice per MDN documentation.

### Pattern 6: Dual Mode Landscape Handling (BUGFIX-06)

**What:** In dual mode, landscape photos cause letterboxing artifacts. Dual mode CSS (lines 76-84 of slideshow.html) sets `width: 50%` but inherits `object-fit: cover` from the base `.photo` class.

**Root cause (verified in code):** When a landscape photo appears in dual mode, the current code on line 687-703 checks `if (displayMode === 'dual' && isPortrait)`. If the photo is NOT portrait (i.e., landscape), it falls through to `showSinglePhoto()` on line 703. But the `pendingPortrait` is cleared (line 701), which means if the FIRST photo in a dual pair is portrait and the SECOND is landscape, the portrait is lost and the landscape shows full-screen with `object-fit: cover` at 100% width -- no letterboxing per se, but the portrait is wasted.

The real letterboxing issue occurs when `displayMode === 'dual'` and a landscape photo is forced into a 50% width container with `object-fit: cover` -- it works fine vertically but the horizontal crop is aggressive. With `object-fit: contain` instead, letterboxing bars appear.

**Fix pattern:** When in dual mode and a landscape photo is encountered, show it as a single full-width photo instead of trying to pair it. Only pair portrait + portrait.

```javascript
// In loadPhoto(), dual mode handling:
if (displayMode === 'dual' && isPortrait) {
  // ... existing portrait pairing logic
} else if (displayMode === 'dual' && !isPortrait) {
  // Landscape in dual mode: show as single photo, don't try to pair
  pendingPortrait = null;
  await showSinglePhoto(img);
}
```

Also, if `portraitPairsEnabled` is true and a landscape photo appears as the second photo after a portrait was pending, the portrait should be shown as a single rather than discarded.

**Confidence:** HIGH -- CSS layout behavior is deterministic and verifiable.

### Pattern 7: Service Worker Cache Version (DEPLOY-01)

**What:** Update `CACHE_VERSION` in `sw.js` from `'okno-v1'` to `'okno-v1.1'` so that deployed bug fixes are served to existing PWA installations.

**Root cause:** Service Worker uses cache-first for static assets (line 60-65 of sw.js). Without updating the cache version, the iPad PWA will continue serving the old v1.0 HTML from cache indefinitely. The `skipWaiting()` on install (line 19) ensures the new SW activates immediately, and `clients.claim()` (line 35) ensures it takes control.

**Fix:** Single line change:
```javascript
const CACHE_VERSION = 'okno-v1.1';
```

The `activate` handler (line 25-36) already deletes old caches whose names don't match `CACHE_VERSION`, so this is all that's needed.

**Key consideration:** This MUST be the last change deployed because it triggers re-caching of all static assets. If deployed before bug fixes, it will re-cache the old buggy HTML. Deploy order: fix all bugs, THEN bump SW version.

**Confidence:** HIGH -- standard Service Worker versioning pattern, verified against the existing code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timer countdown | Custom animation loop | `setInterval` with DOM update | Simple, reliable, already used elsewhere in codebase |
| Deduplication | Complex diffing | `Set` of existing IDs + `filter` | O(n) with Set, no need for fancy merge algorithms |
| Error response caching | Custom cache eviction | `response.ok` check in SW | Standard pattern, one-line fix |
| Duration string parsing | Full duration parser | Simple regex for `"NNNs"` format | Google only sends seconds format for Picker API |

**Key insight:** Every fix in this phase is a targeted change to existing code, not a new feature build. The risk is in regressions, not in complexity.

## Common Pitfalls

### Pitfall 1: Breaking baseUrl Refresh After Merge

**What goes wrong:** After implementing BUGFIX-01 (batch merge), the `refreshBaseUrls()` function uses `cache.sessionId` to re-fetch fresh baseUrls from Google. But with merged items from multiple sessions, only the latest session's items will have valid baseUrls after refresh.
**Why it happens:** Each Picker API session is isolated -- listing media items for session A only returns session A's items with fresh baseUrls.
**How to avoid:** Accept this limitation. Store the latest sessionId. Items from older sessions will gradually get stale baseUrls and return 502s, but the frontend retry logic handles this gracefully. Alternatively, store multiple sessionIds and refresh from all of them, but this adds complexity without solving the 60-minute baseUrl expiry fundamentally.
**Warning signs:** After adding photos in a second session, photos from the first session start returning 502s after ~60 minutes.

### Pitfall 2: Service Worker Caching 502 Error Responses

**What goes wrong:** The Service Worker caches error responses from `/api/photo/random`, which means a transient 502 gets served from cache on subsequent requests, making the slideshow permanently broken until manual cache clear.
**Why it happens:** The current SW code (line 47) clones and caches the response without checking `response.ok`.
**How to avoid:** Add `if (response.ok)` check before caching in the SW fetch handler.
**Warning signs:** Slideshow stops showing new photos even though the backend has recovered.

### Pitfall 3: Countdown Timer Memory Leak

**What goes wrong:** If the user opens the Picker, starts the countdown, then navigates away before the countdown finishes, the `setInterval` continues running.
**Why it happens:** No cleanup of the countdown interval on page navigation.
**How to avoid:** Clear the countdown interval in a `beforeunload` handler, or store the interval ID and clear it when the picker status element is hidden.
**Warning signs:** Not impactful for a single-page app, but good practice.

### Pitfall 4: On This Day Message Hidden Too Early

**What goes wrong:** The "No photos from today" message disappears after 5 seconds, but the fallback to random photos may take longer to load, leaving a black screen.
**Why it happens:** The `showOnThisDayMessage()` function has a hardcoded 5-second timeout (line 893).
**How to avoid:** Keep the message visible until the first random photo loads. Clear it in `showSinglePhoto()` instead of on a timer.
**Warning signs:** Brief flash of message, then black screen, then photo appears.

### Pitfall 5: Deploying DEPLOY-01 Before Bug Fixes

**What goes wrong:** If `CACHE_VERSION` is bumped and deployed before bug fixes are in the HTML files, the SW will re-cache the old buggy HTML. Users will then have the new cache version but old code.
**Why it happens:** SW re-caching happens on install, which is triggered by any byte change in sw.js.
**How to avoid:** DEPLOY-01 must be the LAST change committed and deployed. All bug fixes to HTML files should be committed first, then sw.js version bump as the final commit.
**Warning signs:** Users report bugs still present after "update."

### Pitfall 6: fetchWithRetry Retrying 404s in On This Day Mode

**What goes wrong:** When On This Day has no photos, the backend returns 404. `fetchWithRetry` retries this 404 seven times with exponential backoff, making the user wait ~10+ seconds before seeing the fallback message.
**Why it happens:** `fetchWithRetry` treats all non-ok responses the same.
**How to avoid:** Don't retry 4xx responses (especially 404). Only retry 5xx and network errors.
**Warning signs:** Long delay before "No photos from today" message appears.

## Code Examples

### Example 1: Cache Merge with Deduplication

```javascript
// photo-cache.js -- setItems() replacement
// Source: Codebase analysis of photo-cache.js line 69
function setItems(items, sessionId) {
  // Build set of existing IDs for O(1) lookup
  const existingIds = new Set(cache.mediaItems.map(item => item.id));

  // Filter out duplicates -- only add genuinely new items
  const newItems = items.filter(item => !existingIds.has(item.id));

  // Append new items to existing cache
  cache.mediaItems = [...cache.mediaItems, ...newItems];

  // Update session ID to latest (for baseUrl refresh)
  cache.sessionId = sessionId;
  cache.lastRefresh = new Date().toISOString();
  saveCache();

  // Start refresh interval if not already running
  if (!refreshIntervalHandle && cache.mediaItems.length > 0) {
    logger.info(`Starting baseUrl refresh interval (every ${REFRESH_INTERVAL_MS / 60000} minutes)`);
    refreshIntervalHandle = setInterval(refreshBaseUrls, REFRESH_INTERVAL_MS);
  }

  logger.info(`Cache updated: ${newItems.length} new items added, ${cache.mediaItems.length} total`);
}
```

### Example 2: Service Worker Error Response Guard

```javascript
// sw.js -- fetch handler with ok check
// Source: MDN Service Worker best practices
if (url.pathname.startsWith('/api/photo')) {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // ONLY cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(PHOTO_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
}
```

### Example 3: Countdown Timer for Picker Session

```javascript
// index.html -- countdown display during Picker session
// Source: Standard setInterval pattern
function startPickerCountdown(timeoutStr) {
  const match = String(timeoutStr).match(/^(\d+)s$/);
  let remaining = match ? parseInt(match[1]) : 600;

  const countdownEl = document.createElement('div');
  countdownEl.id = 'pickerCountdown';
  countdownEl.style.cssText = 'margin-top: 12px; font-size: 0.85rem; font-weight: 500;';

  function update() {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    countdownEl.textContent = `Session expires in ${mins}:${secs.toString().padStart(2, '0')}`;

    if (remaining <= 60) {
      countdownEl.style.color = '#e74c3c';
      countdownEl.style.fontWeight = '600';
    }

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      countdownEl.textContent = 'Session expired. Please start a new session.';
    }

    remaining--;
  }

  update(); // Show immediately
  const countdownInterval = setInterval(update, 1000);
  return { element: countdownEl, interval: countdownInterval };
}
```

### Example 4: 404 Short-Circuit in fetchWithRetry

```javascript
// slideshow.html -- modified fetchWithRetry
// Source: Codebase analysis of slideshow.html line 599
async function fetchWithRetry(url, maxRetries = 7) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // 4xx errors are intentional, not transient -- don't retry
      if (response.status >= 400 && response.status < 500) {
        return response; // Return the response, let caller handle
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const baseDelay = Math.pow(2, attempt) * 10;
      const jitter = Math.random() * baseDelay * 0.1;
      const delay = baseDelay + jitter;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cache.mediaItems = items` (replace) | `[...existing, ...new]` (merge) | This phase | BUGFIX-01: No more data loss |
| Cache all SW responses | Cache only `response.ok` | Standard practice | BUGFIX-05: No cached 502s |
| `CACHE_VERSION = 'okno-v1'` | `CACHE_VERSION = 'okno-v1.1'` | This phase | DEPLOY-01: Forces re-cache |

**No deprecated patterns apply** -- the existing codebase uses modern Service Worker API, Express 4.x patterns, and CSS object-fit, all of which are current.

## Open Questions

1. **Multi-session baseUrl refresh**
   - What we know: Only the latest Picker session's `sessionId` can be used to refresh baseUrls. Items from older sessions will have stale baseUrls after 60 minutes.
   - What's unclear: Whether Google's Picker API allows listing media items from expired sessions. The `expireTime` field on sessions suggests access is time-limited.
   - Recommendation: Accept this limitation for v1.1. The frontend retry logic + 502 resilience fix (BUGFIX-05) handles stale baseUrls gracefully. Users can always re-select all photos in a new session to get fresh baseUrls for everything. Document this behavior.

2. **Google Picker API exact timeout duration**
   - What we know: The API returns `pollingConfig.timeoutIn` as a duration string (e.g., `"600s"`). The backend currently defaults to `"600s"` if not provided.
   - What's unclear: Whether Google always returns 600s or if it varies. Official docs do not specify a fixed duration.
   - Recommendation: Parse whatever value Google returns. Display it as-is. Default to 600s (10 minutes) if missing.

## Sources

### Primary (HIGH confidence)
- **Codebase direct analysis:** `photo-cache.js` (lines 69-79, setItems replace bug), `sw.js` (lines 47-48, error caching), `slideshow.html` (lines 599-620 fetchWithRetry, lines 662-708 loadPhoto, lines 726-740 OTD fallback), `picker.js` (lines 60-65 timeout value), `index.html` (lines 811-874 openPicker flow)
- **MDN Service Worker caching:** `response.ok` guard is standard documented practice for SW fetch handlers
- [Google Photos Picker API Sessions reference](https://developers.google.com/photos/picker/reference/rest/v1/sessions) -- pollingConfig, timeoutIn, expireTime fields verified

### Secondary (MEDIUM confidence)
- [Google Photos Picker API Sessions guide](https://developers.google.com/photos/picker/guides/sessions) -- session lifecycle, timeout behavior
- [MDN object-fit documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) -- cover vs contain behavior for landscape images

### Tertiary (LOW confidence)
- Google Picker API exact timeout duration (600s default assumed, not confirmed in docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all fixes use existing patterns
- Architecture: HIGH -- every bug root cause identified through direct code analysis
- Pitfalls: HIGH -- pitfalls derived from actual code paths, not theoretical risks
- Code examples: HIGH -- all patterns verified against existing codebase

**Research date:** 2026-02-15
**Valid until:** Indefinite (bug fixes are stable, no external API changes expected)
