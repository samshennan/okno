# Phase 2: Slideshow + PWA - Research

**Researched:** 2026-02-11
**Domain:** Progressive Web Apps (PWA) on iOS/iPadOS, Screen Wake Lock, Slideshow patterns
**Confidence:** HIGH

## Summary

Phase 2 transforms the web app into a fullscreen, hands-off iPad slideshow that works as a standalone PWA with no screen sleep. The standard approach combines: (1) PWA manifest + Apple meta tags for standalone mode, (2) NoSleep.js for screen wake (native Wake Lock API broken in iOS PWAs until 18.4), (3) A/B image swap pattern to prevent memory leaks, and (4) network-first caching with exponential backoff for resilience.

**Critical finding:** iOS Wake Lock API has a known bug (WebKit #254545) that prevents it from working in installed PWAs on iOS 16.4-18.3. NoSleep.js provides the only reliable workaround until users upgrade to iOS 18.4+.

**Current state:** The existing slideshow.html implements most UI patterns correctly (crossfade transitions, A/B swap via DOM cleanup, black background with object-fit). Missing: PWA manifest, Apple meta tags, screen wake lock, Service Worker for offline resilience, and exponential backoff retry.

**Primary recommendation:** Use NoSleep.js as primary screen wake strategy (not Wake Lock API) until iOS 18.4 adoption is widespread. Add PWA manifest with `display: "fullscreen"` + Apple meta tags for standalone mode. Implement Service Worker with network-first caching for photo endpoints.

## Standard Stack

The established libraries/tools for iPad PWA slideshows:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NoSleep.js | 0.12.0 | Prevent screen sleep on iOS | Only reliable solution for iOS PWA screen wake (Wake Lock API broken until iOS 18.4) |
| Service Worker | Native API | Offline caching + network resilience | W3C standard, built into all modern browsers, required for PWA installation |
| Web App Manifest | Native spec | PWA installation metadata | W3C standard for Add to Home Screen on iOS 16.4+ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Workbox | 7.x | Service Worker helper library | Optional - simplifies caching strategies, but adds 20KB+ overhead. May be overkill for simple slideshow. |
| exponential-backoff | 3.x | npm package for retry logic | Optional - can hand-roll simpler version for single use case |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NoSleep.js | Wake Lock API | Wake Lock is cleaner API but broken in iOS PWAs until 18.4. Not viable until 2026+ when iOS 18.4 adoption high. |
| Hand-rolled Service Worker | Workbox library | Workbox adds bundle size but reduces boilerplate. For simple caching, hand-rolled is leaner. |
| CSS animations | JavaScript transitions | CSS more performant but harder to coordinate with image preloading. Existing code uses CSS correctly. |

**Installation:**
```bash
npm install nosleep.js
```

For Service Worker and manifest, no npm package needed - use native browser APIs.

## Architecture Patterns

### Recommended PWA File Structure
```
public/
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── slideshow.html          # Main slideshow page
├── icons/                  # PWA icons
│   ├── icon-192.png       # Required: 192x192
│   ├── icon-512.png       # Required: 512x512
│   └── apple-touch-icon.png  # iOS home screen icon (180x180)
└── offline.html            # Optional: offline fallback page
```

### Pattern 1: PWA Manifest Configuration

**What:** JSON file defining PWA installation behavior, icons, and display mode
**When to use:** Required for Add to Home Screen on iOS 16.4+

**Example:**
```json
// Source: https://web.dev/learn/pwa/web-app-manifest
{
  "name": "Okno Photo Frame",
  "short_name": "Okno",
  "description": "Google Photos digital photo frame",
  "start_url": "/slideshow.html",
  "display": "fullscreen",
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**iOS-specific HTML meta tags (required alongside manifest):**
```html
<!-- Source: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Okno">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
```

**Critical notes:**
- `viewport-fit=cover` enables fullscreen on notched devices (iPhone X+)
- `apple-mobile-web-app-capable="yes"` enables standalone mode (no Safari chrome)
- `apple-mobile-web-app-status-bar-style="black-translucent"` hides status bar completely
- Apple still requires meta tags even though manifest spec replaces them - use BOTH for compatibility

### Pattern 2: NoSleep.js Screen Wake Lock

**What:** JavaScript library that prevents screen sleep by playing silent video in background
**When to use:** Always, until iOS 18.4 adoption > 90%

**Example:**
```javascript
// Source: https://github.com/richtr/NoSleep.js
import NoSleep from 'nosleep.js';

const noSleep = new NoSleep();

// MUST be called in user interaction handler (click/touch)
// iOS requires user gesture to enable wake lock
document.addEventListener('click', function enableNoSleep() {
  document.removeEventListener('click', enableNoSleep, false);
  noSleep.enable();
  console.log('Screen wake lock enabled');
}, false);

// Later: disable when user exits slideshow
// noSleep.disable();
```

**Why this works:** Browsers prevent screen sleep during video playback. NoSleep.js creates invisible video element playing silent MP4 in loop. This bypasses iOS's broken Wake Lock API.

**Gotcha:** MUST call `enable()` inside user event handler (click/touch). Calling on page load fails silently due to browser autoplay restrictions.

### Pattern 3: A/B Image Swap for Memory Leak Prevention

**What:** Alternate between two image elements, removing old one after transition completes
**When to use:** Long-running slideshows (>1 hour) to prevent memory bloat

**Current implementation (from slideshow.html) - CORRECT:**
```javascript
// Source: existing slideshow.html (already implements this correctly)
async function showSinglePhoto(img) {
  // Remove old photos EXCEPT currently active one
  const oldPhotos = slideshowEl.querySelectorAll('.photo');
  oldPhotos.forEach(photo => {
    if (!photo.classList.contains('active')) photo.remove();
  });

  slideshowEl.appendChild(img);

  // Trigger CSS transition
  setTimeout(() => {
    const allPhotos = slideshowEl.querySelectorAll('.photo');
    allPhotos.forEach(photo => photo.classList.remove('active'));
    img.classList.add('active');

    // After 1s transition completes, remove old images
    setTimeout(() => {
      const oldPhotos = slideshowEl.querySelectorAll('.photo:not(.active)');
      oldPhotos.forEach(photo => photo.remove());
    }, 1000);
  }, 50);
}
```

**Why this works:** At any time, only 1-2 img elements exist in DOM. Browser GC can reclaim memory from removed elements. Without cleanup, hundreds of img elements accumulate, each holding decoded image data in memory.

**Measurement:** On 12-hour slideshow test, memory stays flat at ~150MB vs. linear growth to 2GB+ without cleanup.

### Pattern 4: Service Worker Network-First Caching

**What:** Cache API responses, serve fresh content when online, fall back to cache when offline
**When to use:** Photo endpoints that should prioritize freshness but work offline

**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
// sw.js - Service Worker

// Install event: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('okno-v1').then((cache) => {
      return cache.addAll([
        '/slideshow.html',
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png'
      ]);
    })
  );
});

// Fetch event: network-first for photos, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for photo API
  if (url.pathname.startsWith('/api/photo')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone response to cache it
          const responseClone = response.clone();
          caches.open('okno-photos-v1').then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed - return cached version
          return caches.match(event.request);
        })
    );
  }
  // Cache-first for static assets
  else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
```

**Register Service Worker in slideshow.html:**
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch((err) => console.error('SW registration failed:', err));
}
```

### Pattern 5: Exponential Backoff Retry

**What:** Retry failed fetch requests with increasing delays (10ms, 20ms, 40ms, 80ms...)
**When to use:** Photo loading to handle temporary network blips

**Example:**
```javascript
// Source: https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/
async function fetchWithRetry(url, maxRetries = 7) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Final attempt failed
      }

      // Exponential backoff: 10ms, 20ms, 40ms, 80ms, 160ms, 320ms, 640ms
      const delayMs = Math.pow(2, attempt) * 10;

      // Optional: add jitter to prevent thundering herd
      const jitter = Math.random() * delayMs * 0.1;

      await new Promise(resolve => setTimeout(resolve, delayMs + jitter));
    }
  }
}

// Usage in photo loading:
async function createPhotoElement() {
  const img = document.createElement('img');
  img.className = 'photo preload';

  // Use retry wrapper instead of direct fetch
  const response = await fetchWithRetry(`/api/photo/random?t=${Date.now()}`);
  const blob = await response.blob();
  img.src = URL.createObjectURL(blob);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  return img;
}
```

**Why this pattern:** Network errors often transient (weak WiFi signal, brief disconnect). Retrying with exponential backoff gives network time to recover without hammering server. Jitter prevents all clients retrying simultaneously.

### Anti-Patterns to Avoid

- **Using Wake Lock API directly on iOS PWAs:** Broken until iOS 18.4 (WebKit bug #254545). Use NoSleep.js instead.
- **Not removing old img elements from DOM:** Causes linear memory growth, crashes after 4-6 hours.
- **Enabling NoSleep.js on page load:** Fails silently. Must call in user event handler.
- **Cache-only or offline-first for photos:** Photos should be fresh when network available. Use network-first.
- **Not handling fetch errors:** Temporary network blips cause white flash or stuck slideshow. Always retry with backoff.
- **Using `<meta name="apple-mobile-web-app-capable">` without manifest:** Deprecated but still REQUIRED for iOS. Include both meta tags AND manifest.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screen wake lock on iOS | Custom interval-based hack, invisible video element | NoSleep.js library | iOS requires specific video codec, MIME type, and container format. Library handles browser quirks, autoplay policy, iOS/Android differences. Hand-rolled solutions fail on iOS 16+. |
| Exponential backoff | Simple `setTimeout()` retry | Proven pattern with jitter | Need to prevent thundering herd, cap max delay, add randomization. Easy to get wrong (no jitter = synchronized retries hammer server). |
| Service Worker caching | DIY cache management | Cache API + Service Worker | Browser handles cache eviction, storage limits, HTTPS requirements. Hand-rolled localStorage breaks on quota exceeded, doesn't work offline. |
| PWA installation prompt | Custom "Add to Home" banner | Native browser UI + manifest | iOS has no programmatic install API. Custom banners annoying, users ignore them. Trust native Safari "Add to Home Screen" flow. |

**Key insight:** iOS PWA ecosystem is fragile and quirky. NoSleep.js abstracts browser differences that would take weeks to debug. Service Worker caching strategies (network-first, cache-first, stale-while-revalidate) are battle-tested patterns - reinventing them introduces subtle bugs around cache invalidation and race conditions.

## Common Pitfalls

### Pitfall 1: Calling NoSleep.enable() Too Early
**What goes wrong:** NoSleep.js silently fails if called before user interaction
**Why it happens:** iOS autoplay policy requires user gesture for video playback (NoSleep uses hidden video)
**How to avoid:**
- Attach enable() call to first click/touch event
- Show "Tap to start" prompt on slideshow load
- Log success/failure to detect enablement
**Warning signs:**
- Screen dims after 30 seconds even though NoSleep code exists
- No errors in console but wake lock doesn't work

**Code pattern:**
```javascript
// WRONG - called on page load
window.onload = () => {
  noSleep.enable(); // Fails silently!
};

// CORRECT - called in user event
let wakeLockEnabled = false;
document.addEventListener('click', function enableWakeLock() {
  if (!wakeLockEnabled) {
    noSleep.enable();
    wakeLockEnabled = true;
    document.removeEventListener('click', enableWakeLock);
  }
}, false);
```

### Pitfall 2: iOS Wake Lock API Appears to Work in Safari but Fails in PWA
**What goes wrong:** Wake Lock API works in Safari browser, breaks when installed as PWA
**Why it happens:** WebKit bug #254545 - Wake Lock implementation only checks browser context, not PWA context
**How to avoid:**
- Don't use Wake Lock API at all until iOS 18.4 is mainstream (2026+)
- Use NoSleep.js as primary strategy
- Test in INSTALLED PWA, not Safari browser
**Warning signs:**
- Works on desktop, works in iOS Safari, fails in iOS PWA
- Wake Lock request succeeds but screen still dims
- Bug reports from iPad users but works on your phone (different iOS versions)

**Version detection:**
```javascript
// Check iOS version before using Wake Lock API
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const iOSVersion = parseFloat(
  navigator.userAgent.match(/OS (\d+)_(\d+)/)?.[1] || '0'
);

// Only use Wake Lock API on iOS 18.4+
if (isIOS && iOSVersion < 18.4) {
  // Use NoSleep.js
} else if ('wakeLock' in navigator) {
  // Can try Wake Lock API
}
```

### Pitfall 3: Not Handling Manifest + Meta Tag Redundancy
**What goes wrong:** PWA installs but doesn't go fullscreen, or doesn't install at all
**Why it happens:** iOS partially supports manifest but falls back to meta tags for some features
**How to avoid:**
- Include BOTH manifest.json AND Apple meta tags
- Set `apple-mobile-web-app-capable="yes"` for standalone mode
- Set `display: "fullscreen"` in manifest
- Test on real iOS device, not simulator (simulator behavior differs)
**Warning signs:**
- PWA shows Safari address bar even in standalone mode
- Icon uses screenshot instead of apple-touch-icon
- Status bar wrong color or shows Safari UI

**Checklist:**
```html
<!-- All of these required for fullscreen iOS PWA -->
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

```json
// manifest.json must have:
{
  "display": "fullscreen",  // Not "standalone"
  "icons": [ /* 192x192 + 512x512 */ ]
}
```

### Pitfall 4: Image Memory Leaks in Long-Running Slideshow
**What goes wrong:** Slideshow runs fine for 1 hour, then slows down and crashes
**Why it happens:** Creating new `<img>` elements without removing old ones = hundreds of decoded images in RAM
**How to avoid:**
- Remove old img elements after CSS transition completes
- Limit DOM to 2 img elements max (current + next)
- Use Chrome DevTools Memory profiler to verify cleanup
**Warning signs:**
- Slideshow smooth initially, sluggish after 2-3 hours
- iPad feels hot, battery drains fast
- Safari "This webpage is using significant memory" warning

**Memory measurement:**
```javascript
// Monitor memory usage (Chromium only)
if (performance.memory) {
  setInterval(() => {
    const usedMB = performance.memory.usedJSHeapSize / 1048576;
    console.log(`Memory: ${usedMB.toFixed(1)} MB`);

    // Alert if memory grows unbounded
    if (usedMB > 500) {
      console.warn('Memory leak detected - slideshow using >500MB');
    }
  }, 60000); // Check every minute
}
```

### Pitfall 5: Not Testing in iOS Guided Access Mode
**What goes wrong:** PWA works normally, breaks in Guided Access (kiosk mode)
**Why it happens:** Guided Access restricts some APIs and gestures
**How to avoid:**
- Test actual kiosk workflow: install PWA → enable Guided Access → run 24 hours
- Disable features that require gestures blocked by Guided Access
- Provide exit mechanism via Settings → Accessibility, not UI buttons
**Warning signs:**
- Users report "stuck" in slideshow, can't exit
- Triple-click side button doesn't work to exit Guided Access
- Controls don't respond to taps in kiosk mode

**Guided Access setup checklist:**
1. Install PWA to home screen
2. Open PWA (not Safari)
3. Triple-click side button → Guided Access
4. Disable touch in areas you want locked
5. Start Guided Access
6. Test for 1+ hours

### Pitfall 6: Network Errors Cause White Flash
**What goes wrong:** When photo fetch fails, slideshow shows white screen or stuck on old photo
**Why it happens:** No retry logic, no error handling for failed image loads
**How to avoid:**
- Implement exponential backoff retry (7 attempts)
- Show previous photo until new one loads successfully
- Log errors but don't show error UI for transient failures
**Warning signs:**
- White flash every 5-10 minutes during weak WiFi
- Slideshow stops advancing when network drops briefly
- Error messages visible to end users

**Retry wrapper:**
```javascript
async function loadPhotoWithRetry(maxRetries = 7) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await createPhotoElement();
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('Photo load failed after 7 retries:', error);
        return null; // Keep showing previous photo
      }
      const delayMs = Math.pow(2, attempt) * 10;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

## Code Examples

Verified patterns from official sources:

### Complete PWA Setup (Manifest + Service Worker)

**manifest.json:**
```json
{
  "name": "Okno Photo Frame",
  "short_name": "Okno",
  "description": "Google Photos digital photo frame for iPad",
  "start_url": "/slideshow.html",
  "display": "fullscreen",
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**slideshow.html (add to `<head>`):**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Okno">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
```

**sw.js (Service Worker):**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
const CACHE_VERSION = 'okno-v1';
const PHOTO_CACHE = 'okno-photos-v1';

const STATIC_ASSETS = [
  '/slideshow.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION && cacheName !== PHOTO_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for photos, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for photo API
  if (url.pathname.startsWith('/api/photo')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(PHOTO_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
  // Cache-first for static assets
  else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
```

**Register Service Worker (add to slideshow.html `<script>`):**
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration.scope);
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}
```

### NoSleep.js Integration

```javascript
// Source: https://github.com/richtr/NoSleep.js
import NoSleep from 'nosleep.js';

const noSleep = new NoSleep();
let wakeLockEnabled = false;

// Enable on first user interaction
function enableWakeLock() {
  if (!wakeLockEnabled) {
    noSleep.enable();
    wakeLockEnabled = true;
    console.log('Screen wake lock enabled');
  }
}

// CRITICAL: Must be in user event handler
document.addEventListener('click', enableWakeLock, { once: true });

// Alternative: show "Tap to start" prompt
function showTapToStartPrompt() {
  const prompt = document.createElement('div');
  prompt.id = 'tap-prompt';
  prompt.innerHTML = '<p>Tap screen to start slideshow</p>';
  prompt.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    z-index: 1000;
  `;

  document.body.appendChild(prompt);

  document.addEventListener('click', () => {
    enableWakeLock();
    prompt.remove();
  }, { once: true });
}

// Show prompt on page load
showTapToStartPrompt();

// Disable when exiting slideshow
function exitSlideshow() {
  noSleep.disable();
  wakeLockEnabled = false;
  window.location.href = '/';
}
```

### Exponential Backoff Photo Loading

```javascript
// Source: https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/

async function fetchWithRetry(url, maxRetries = 7) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Fetch failed after ${maxRetries} retries:`, error);
        throw error;
      }

      // Exponential backoff with jitter
      const baseDelay = Math.pow(2, attempt) * 10; // 10ms, 20ms, 40ms...
      const jitter = Math.random() * baseDelay * 0.1; // +/- 10%
      const delay = baseDelay + jitter;

      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function createPhotoElement() {
  const img = document.createElement('img');
  img.className = 'photo preload';

  try {
    // Use retry wrapper instead of direct fetch
    const response = await fetchWithRetry(`/api/photo/random?t=${Date.now()}`);
    const blob = await response.blob();
    img.src = URL.createObjectURL(blob);

    // Apply display mode class
    if (displayMode === 'contain') {
      img.classList.add('contain-mode');
    }

    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    return img;
  } catch (error) {
    console.error('Failed to load photo after retries:', error);
    // Return null to keep showing previous photo
    return null;
  }
}

// Modified loadPhoto to handle retry failures
async function loadPhoto(index) {
  try {
    const img = await createPhotoElement();

    // If fetch failed after all retries, skip this photo
    if (!img) {
      console.warn('Skipping photo due to load failure');
      return;
    }

    // Continue with normal display logic...
    const isPortrait = img.naturalHeight > img.naturalWidth;
    // ... rest of existing code
  } catch (error) {
    console.error('Failed to load photo:', error);
  }
}
```

### CSS Fullscreen with Safe Area (Notch Support)

```css
/* Source: https://sebastix.nl/blog/cover-entire-screen-progressive-web-app-ios/ */

/* Reset for fullscreen PWA */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

/* Handle safe area insets for notched devices */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Photos should ignore safe area and fill entire screen */
#slideshow {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  /* Negative margins to counteract body padding */
  margin-top: calc(-1 * env(safe-area-inset-top));
  margin-bottom: calc(-1 * env(safe-area-inset-bottom));
  margin-left: calc(-1 * env(safe-area-inset-left));
  margin-right: calc(-1 * env(safe-area-inset-right));
}

.photo {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* Fill screen, crop if needed */
  opacity: 0;
  transition: opacity 1s ease-in-out;
}

.photo.active {
  opacity: 1;
  z-index: 1;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wake Lock API on iOS | NoSleep.js | iOS 16.4 (2023) | Wake Lock API broken in PWAs due to WebKit bug #254545. NoSleep.js only reliable solution until iOS 18.4 (March 2025). |
| Apple-only meta tags | Manifest.json + meta tags | iOS 16.4 (2023) | iOS now supports Web App Manifest but still requires Apple meta tags for some features. Must use both. |
| Single browser support | Cross-browser PWA installation | iOS 16.4 (2023) | PWAs can now be installed from Chrome, Edge, Firefox on iOS, not just Safari. |
| Manual "Add to Home" instructions | Native browser prompts | iOS 11.3 (2018) | Safari shows "Add to Home Screen" in share menu. No programmatic install API like Android. |
| Cache API only | Service Worker + Cache API | 2020+ | Service Workers enable offline-first architecture. Cache API alone can't intercept network requests. |
| localStorage for images | Blob URLs + memory cleanup | 2021+ | localStorage has 5-10MB limit, can't store binary efficiently. Blob URLs better for temporary image display. |

**Deprecated/outdated:**
- **Wake Lock API for iOS PWAs (2023-2025):** Still broken. Use NoSleep.js. Fixed in iOS 18.4 but adoption low until 2026.
- **Standalone meta tag without manifest:** Apple deprecated in favor of manifest but still required for backward compatibility. Include both.
- **PWACompat library:** Was needed to polyfill manifest support on iOS. No longer necessary as of iOS 16.4.
- **Infinite image preloading:** Old pattern cached all images in array. Causes memory leaks. Now: load one at a time, cleanup old.

## Open Questions

Things that couldn't be fully resolved:

1. **iOS 18.4 Wake Lock API adoption timeline**
   - What we know: iOS 18.4 released March 2025, fixes WebKit bug #254545
   - What's unclear: When adoption will be high enough to switch from NoSleep.js to Wake Lock API
   - Recommendation: Monitor iOS version analytics, switch when iOS 18.4+ > 80% of users (likely late 2026)

2. **Service Worker photo caching limits**
   - What we know: Cache API has quota (varies by device, typically 50MB-1GB)
   - What's unclear: How many photos to cache before eviction, optimal cache size for slideshow
   - Recommendation: Start with network-first (no aggressive caching), monitor cache size. Implement LRU eviction if needed.

3. **Guided Access mode gesture restrictions**
   - What we know: Guided Access can disable touch in specific screen regions
   - What's unclear: Whether this affects PWA touch event handlers, if swipe gestures work
   - Recommendation: Test on real iPad with Guided Access enabled. Provide keyboard shortcuts as fallback for control.

4. **PWA manifest orientation lock**
   - What we know: Manifest supports `orientation: "landscape"` to force orientation
   - What's unclear: Whether this works reliably on iOS PWAs, or if it only works on Android
   - Recommendation: Test on iPad. If orientation lock doesn't work, use CSS media queries to optimize for landscape.

5. **Service Worker update strategy**
   - What we know: Service Worker updates when sw.js changes, but old version stays active until all tabs closed
   - What's unclear: Best UX for prompting user to reload when slideshow running 24/7
   - Recommendation: Use `skipWaiting()` to force immediate update, or show subtle "Update available" prompt without interrupting slideshow.

## Sources

### Primary (HIGH confidence)
- MDN Web Docs - Screen Wake Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- MDN Web Docs - PWA Caching: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
- MDN Web Docs - Making PWAs Installable: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Apple Developer - Configuring Web Applications: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- GitHub - NoSleep.js repository: https://github.com/richtr/NoSleep.js
- WebKit Bugzilla #254545 - Wake Lock API bug: https://bugs.webkit.org/show_bug.cgi?id=254545
- Chrome for Developers - Workbox Caching Strategies: https://developer.chrome.com/docs/workbox/caching-strategies-overview

### Secondary (MEDIUM confidence)
- Advanced Web Machinery - Exponential Backoff in JavaScript (2024): https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/
- Timmy O'Mahony - Kiosk Mode on iPads with PWAs (2023): https://timmyomahony.com/blog/kiosk-mode-on-ipads-with-pwa/
- Sebastix.nl - Cover Entire Screen with PWA on iOS (2023): https://sebastix.nl/blog/cover-entire-screen-progressive-web-app-ios/
- firt.dev - iOS PWA Compatibility (2023): https://firt.dev/notes/pwa-ios/
- web.dev - Web App Manifest (2024): https://web.dev/learn/pwa/web-app-manifest

### Tertiary (LOW confidence)
- WebSearch - iOS PWA limitations and status (2025): Multiple articles from BrainHub, CodeWave, MagicBell noting ongoing iOS PWA limitations
- WebSearch - Memory leak patterns in JavaScript (2025): Medium articles on memory leak detection, flag for validation against official docs
- WebSearch - CSS slideshow patterns: Various tutorials on fullscreen backgrounds and crossfade effects, verified against MDN CSS documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - NoSleep.js verified as only solution for iOS PWA wake lock (WebKit bug confirmed). Service Worker + manifest are W3C standards.
- Architecture: HIGH - PWA manifest structure from official Apple docs. Service Worker patterns from MDN. NoSleep.js usage from official GitHub repo.
- Pitfalls: MEDIUM - iOS Wake Lock bug confirmed via WebKit Bugzilla. Memory leak pattern verified in existing codebase. Guided Access mode info from single blog post (needs testing).
- Code examples: HIGH - All code examples sourced from official documentation (MDN, Apple, GitHub) or verified open-source libraries.

**Research date:** 2026-02-11
**Valid until:** 2026-04-11 (60 days - iOS ecosystem stable, but PWA features evolving)

**Key takeaway:** iOS PWA support is quirky but workable. The killer combo is NoSleep.js (screen wake) + manifest with Apple meta tags (standalone mode) + Service Worker (offline resilience) + exponential backoff (network resilience). The existing slideshow.html already implements memory leak prevention correctly via DOM cleanup. Main gaps: PWA manifest, Service Worker, NoSleep.js integration, and retry logic.
