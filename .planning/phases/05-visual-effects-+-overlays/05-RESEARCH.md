# Phase 5: Visual Effects + Overlays - Research

**Researched:** 2026-02-15
**Domain:** CSS GPU-accelerated animations, blur compositing, overlay positioning on constrained iOS hardware
**Confidence:** HIGH (architecture), MEDIUM-HIGH (GPU memory budgets -- validated against multiple sources but exact A9X thresholds need on-device testing)

## Summary

This phase adds Ken Burns zoom/pan animation, blurred background fill, and date/time overlays to the existing slideshow. All features are pure frontend CSS/JS changes -- zero new npm dependencies, zero backend changes (except one optional blur-thumbnail endpoint).

The most critical finding is the **GPU memory budget on iPad Pro 1st Gen (A9X)**. Each full-screen compositing layer at the device's physical resolution (2732x2048) consumes ~22.4MB of GPU texture memory (width x height x 4 bytes RGBA). The A9X shares its 4GB LPDDR4 between CPU and GPU, with approximately 200-400MB available for GPU compositing effects after OS and browser overhead. This means a strict budget of **2 concurrent full-screen GPU layers during normal operation** (44.8MB) and **briefly 3 during transitions** (67.2MB), but **never 4+**.

The second critical finding eliminates one of the prior research's proposed approaches: **CanvasRenderingContext2D.filter is NOT supported in Safari/iOS Safari** (confirmed via caniuse.com -- unsupported through Safari 26.4). This rules out the "render blur once to canvas" approach. The recommended approach is the **tiny-image CSS blur technique**: fetch or generate a very small thumbnail (e.g., 32x24 pixels), apply CSS `filter: blur(20px)` to it, and scale it up with `background-size: cover`. Blurring a 32x24 image costs effectively zero GPU resources (~3KB texture), and the visual result is indistinguishable from blurring a full-resolution image because heavy blur destroys all high-frequency detail.

The third critical finding concerns **transition choreography**. The existing A/B swap pattern creates and destroys DOM elements dynamically. With Ken Burns + blurred background + crossfade, a naive implementation would stack 4 full-screen GPU layers during transitions (outgoing photo + blur + incoming photo + blur). The solution is sequential choreography: stop old Ken Burns, crossfade photos, swap blur background instantly (no fade), then start new Ken Burns.

**Primary recommendation:** Use CSS-only Ken Burns with `transform: scale()` at modest scale range (1.0-1.08), blur a tiny image (not the full-res photo), enforce a strict 2-layer GPU budget with sequential transition choreography, and position overlays using `env(safe-area-inset-*)` for PWA compatibility.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS `@keyframes` + `transform: scale()` | N/A (browser native) | Ken Burns zoom/pan animation | GPU-accelerated on all browsers, no JS overhead per frame, removed automatically when element leaves DOM |
| CSS `filter: blur()` | N/A (browser native) | Blurred background fill | GPU-accelerated when paired with `transform: translate3d(0,0,0)` on Safari, zero dependencies |
| `Date.toLocaleDateString()` / `toLocaleTimeString()` | N/A (Intl API) | Date/time overlay formatting | Fully supported iOS 16+ Safari, locale-aware, zero dependencies |
| `env(safe-area-inset-*)` | N/A (CSS env) | PWA-safe overlay positioning | Required for iOS PWA standalone mode, supported since iOS 11 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sharp` | 0.34.5 (already in devDependencies) | Server-side blur thumbnail generation | Optional: if CSS blur of tiny client-side image proves insufficient, move blur computation to server |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `filter: blur()` on tiny image | Server-side sharp blur endpoint | Server-side is guaranteed zero GPU cost on client, but adds an HTTP request per photo and backend complexity. CSS blur of 32x24 image is so cheap it should work fine. |
| CSS `filter: blur()` on tiny image | Canvas `drawImage` + `ctx.filter = 'blur()'` | **ELIMINATED** -- `CanvasRenderingContext2D.filter` is NOT supported in Safari/iOS Safari (unsupported through Safari 26.4). |
| CSS `filter: blur()` on tiny image | CSS `filter: blur()` on full-res image | **ELIMINATED** -- blur(20px) on 2732x2048 image may fall back to software rendering on A9X, causing persistent jank and potential crash. |
| CSS `@keyframes` | GSAP / anime.js | JS animation libraries add unnecessary complexity and bundle size. CSS animations are GPU-composited natively, run independently of JS thread, and are automatically cleaned up on DOM removal. |
| `toLocaleDateString()` | date-fns / luxon / moment.js | Intl API is built into the browser. No date library needed for formatting "March 2019" or "3:45 PM". |

**Installation:**
```bash
# Zero new npm dependencies required
# sharp already in devDependencies if server-side blur endpoint is needed
```

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes are in existing files:
```
public/
  slideshow.html     # Ken Burns CSS + JS, blur background, overlay elements, transition choreography
  settings.html      # 4 new toggle rows (Ken Burns, Blur, Photo Date, Clock)
config.js            # 4 new default keys
photo-proxy.js       # (optional) blur thumbnail endpoint
```

### Pattern 1: Dynamic Element Lifecycle with Effects

**What:** Every visual effect is created and destroyed with its photo element. No persistent animation elements.

**When to use:** Always -- this matches the existing A/B swap pattern where `<img>` elements are created per transition and removed after 1.5s.

**Example:**
```javascript
// Current pattern (simplified):
// createPhotoElement() -> returns <img>
// showSinglePhoto(img) -> appends to DOM, transitions, cleans up old

// With visual effects, the flow becomes:
// createPhotoElement() -> returns <img> (unchanged)
// showSinglePhoto(img) -> wraps in container if blur enabled,
//                         applies Ken Burns class if enabled,
//                         updates overlays,
//                         orchestrates transition with GPU budget

// Cleanup removes the entire wrapper (atomic), revoking blob URLs
```

### Pattern 2: Wrapper-Div Architecture for Blur Background

**What:** Change from bare `<img>` to wrapper `<div>` containing blur background + foreground photo.

**When to use:** When blurred background is enabled. When disabled, use bare `<img>` (existing path).

**DOM structure with blur enabled:**
```html
<div id="slideshow">
  <div class="photo-wrapper active">
    <div class="photo-bg"></div>          <!-- tiny blurred image, z-index: 0 -->
    <img class="photo" src="blob:..." /> <!-- actual photo, z-index: 1 -->
  </div>
</div>
```

**Critical detail -- blob URL management:**
- The foreground `<img>` uses the full-res blob URL as `src`
- The background `<div>` uses a **separate tiny-image data URI** or a **second small blob URL** for its `background-image`
- During cleanup, revoke the full-res blob URL when wrapper is removed
- If using a tiny blob URL for background, revoke that too
- **Preferred approach:** Inline the tiny image as a base64 data URI (avoids second blob URL entirely)

### Pattern 3: Sequential Transition Choreography (GPU Budget Rule)

**What:** Serialize effect state changes during transitions to never exceed 3 concurrent GPU layers (and only briefly).

**When to use:** Every photo transition when Ken Burns and/or blur are active.

**Choreography sequence:**
```
State: Photo A displayed with Ken Burns animating
       Background: Blur-A visible
       GPU layers: 2 (photo-A transform + blur-A static) -- blur-A is static, may not need own layer

Step 1: STOP Ken Burns on Photo A
        Set: photoA.style.animation = 'none'
        Set: photoA.style.transform = 'none'
        GPU layers: 1 (blur-A only, photo-A de-promoted)
        Duration: instant

Step 2: CROSSFADE Photo A -> Photo B
        Append Photo B wrapper (with blur-B) to DOM
        Photo B opacity: 0 -> 1 (1s transition)
        Photo A opacity: 1 -> 0 (1s transition)
        GPU layers: 3 briefly (blur-A + photo-A fading + photo-B fading)
        Note: blur-B is HIDDEN during crossfade (opacity 0 on wrapper handles this)
        Duration: 1 second

Step 3: CLEANUP Photo A
        Remove Photo A wrapper from DOM (revoke blob URLs)
        GPU layers: 1 (photo-B, no Ken Burns yet)
        Duration: instant (after 1.5s timeout)

Step 4: START Ken Burns on Photo B
        Add animation class to Photo B
        GPU layers: 2 (photo-B transform + blur-B static)
        Duration: starts after cleanup

Total transition time: ~2.5s (acceptable -- feels deliberate, cinematic)
Peak GPU layers: 3 (for ~1 second during crossfade)
```

### Pattern 4: Ken Burns Presets (Not Random)

**What:** Use 4-6 predefined animation presets that are cycled through, never randomized chaotically.

**When to use:** Always for Ken Burns. Prevents consecutive opposing motions that cause viewer discomfort.

**Example presets:**
```css
/* Preset 1: Slow zoom in from center */
@keyframes kb-zoom-in-center {
  from { transform: scale(1.0); }
  to   { transform: scale(1.08); }
}

/* Preset 2: Slow zoom in from top-left */
@keyframes kb-zoom-in-tl {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.08) translate(-1%, -0.5%); }
}

/* Preset 3: Slow zoom in from bottom-right */
@keyframes kb-zoom-in-br {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.08) translate(1%, 0.5%); }
}

/* Preset 4: Slow zoom out from center */
@keyframes kb-zoom-out-center {
  from { transform: scale(1.08); }
  to   { transform: scale(1.0); }
}

/* Preset 5: Gentle drift right with slight zoom */
@keyframes kb-drift-right {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.04) translate(1.5%, 0); }
}

/* Preset 6: Gentle drift left with slight zoom */
@keyframes kb-drift-left {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.04) translate(-1.5%, 0); }
}
```

**Selection logic (avoid opposing consecutive motion):**
```javascript
const KB_PRESETS = ['kb-zoom-in-center', 'kb-zoom-in-tl', 'kb-zoom-in-br',
                    'kb-zoom-out-center', 'kb-drift-right', 'kb-drift-left'];
let lastPresetIndex = -1;

function nextKenBurnsPreset() {
  // Avoid repeating same preset or using direct opposite
  let index;
  do {
    index = Math.floor(Math.random() * KB_PRESETS.length);
  } while (index === lastPresetIndex);
  lastPresetIndex = index;
  return KB_PRESETS[index];
}
```

### Pattern 5: Tiny-Image Blur Technique

**What:** Create a background fill by blurring a very small image (32x24 pixels) and scaling it up, instead of blurring the full-resolution photo.

**Why this works:** Heavy blur (20px+) destroys all high-frequency detail. A 32x24 image upscaled to fill 2732x2048 with blur(20px) applied looks identical to blurring a 2732x2048 image. But the GPU texture for the 32x24 element is ~3KB vs ~22.4MB.

**Two approaches for creating the tiny image:**

**Approach A: Client-side downscale (recommended -- zero backend changes):**
```javascript
function createTinyBlurImage(img, callback) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 32, 24);
  // Convert to data URI -- no blob URL needed, no cleanup needed
  const dataUri = canvas.toDataURL('image/jpeg', 0.5);
  callback(dataUri);
}
```
- Uses standard canvas drawImage (no filter -- just resize)
- Returns data URI (no blob URL to manage)
- Runs once per photo transition (~0ms on any device)
- The 32x24 JPEG data URI is ~400-800 bytes

**Approach B: Server-side via photo-proxy (optional, if Approach A has issues):**
```javascript
// New endpoint: GET /api/photo/random?blur=true
// Returns 32x24 JPEG blurred thumbnail
// Uses sharp (already in devDependencies)
const sharp = require('sharp');
const blurredBuffer = await sharp(imageBuffer)
  .resize(32, 24, { fit: 'cover' })
  .blur(8)
  .jpeg({ quality: 30 })
  .toBuffer();
```

**CSS for the tiny blur background:**
```css
.photo-bg {
  position: absolute;
  top: -5%;
  left: -5%;
  width: 110%;
  height: 110%;
  background-size: cover;
  background-position: center;
  filter: blur(20px) brightness(0.7);
  transform: translate3d(0, 0, 0); /* CRITICAL: forces GPU acceleration in Safari */
  z-index: 0;
}
```

The `top: -5%; left: -5%; width: 110%; height: 110%` extends the element beyond viewport to prevent blur edge softening from showing.

### Anti-Patterns to Avoid

- **NEVER blur the full-resolution photo.** `filter: blur(20px)` on a 2732x2048 element requires a 40x40 pixel kernel per output pixel. Even GPU-accelerated, this is expensive. Software-rendered (which Safari may do), it is catastrophic for the A9X.
- **NEVER animate the blur background with `transform`.** Combining `filter: blur()` and `transform` animation on the same element forces Safari to recompute the blur every animation frame. The blur background must be static once created.
- **NEVER use `zoom` CSS property.** It is not GPU-accelerated on Safari and triggers full repaint.
- **NEVER run Ken Burns on both the outgoing AND incoming photo simultaneously.** This doubles GPU layer count during transitions.
- **NEVER omit `translate3d(0,0,0)` when using `filter: blur()` in Safari.** Without this GPU-acceleration hint, Safari falls back to CPU blur rendering, causing extreme jank.
- **NEVER use `CanvasRenderingContext2D.filter` for blur.** It is NOT supported in Safari/iOS Safari (confirmed unsupported through Safari 26.4 per caniuse.com).
- **NEVER use `scale3d(1.5+)` or `scale(1.2+)` for Ken Burns.** Scale ranges above 1.15 look jarring and increase GPU texture sampling cost. The sweet spot is 1.04-1.08.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting ("March 2019") | Custom month name arrays, manual string formatting | `new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })` | Intl API handles all locales, edge cases, and formatting natively |
| Time formatting ("3:45 PM") | Manual hour/minute parsing, AM/PM logic | `new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })` | Built-in, locale-aware, handles 12/24 hour formats |
| Image downscaling for blur | Manual pixel manipulation, WebGL shaders | `canvas.getContext('2d').drawImage(img, 0, 0, 32, 24)` | Canvas drawImage handles resampling natively, works in all browsers including Safari |
| Animation timing/easing | Custom JS easing functions, RAF loops | CSS `@keyframes` with `animation-timing-function: ease-in-out` | CSS animations run on GPU compositor thread, independent of JS thread |
| Safe area positioning | Manual pixel offsets for different devices | CSS `env(safe-area-inset-top)` with `max()` | Built into WebKit, automatically adapts to device form factor |
| Reduced motion detection | JS-based device capability detection | CSS `@media (prefers-reduced-motion: reduce)` + JS `matchMedia` | OS-level setting, respected automatically by CSS, queryable from JS |

**Key insight:** Every component of this phase has a browser-native solution. The complexity is not in the individual features but in their **interaction during transitions** (GPU layer management, sequential choreography, cleanup ordering).

## Common Pitfalls

### Pitfall 1: GPU Texture Memory Exhaustion on A9X (24/7 Operation)

**What goes wrong:** Each full-screen compositing layer at 2732x2048 physical resolution consumes ~22.4MB GPU texture memory (width x height x 4 bytes RGBA). The A9X's 4GB LPDDR4 is shared between CPU and GPU, with ~200-400MB available for GPU compositing. Stacking 4+ layers during transitions (old photo + old blur + new photo + new blur) consumes ~89.6MB in a single transition, and if old layers are not properly torn down, memory accumulates. After hundreds of transitions, the iOS jetsam OOM killer terminates the PWA silently.

**Why it happens:** CSS `transform` and `filter` both trigger GPU compositing layer promotion. The A/B swap pattern briefly has old and new elements in DOM simultaneously. `will-change: transform` explicitly promotes layers, but Safari often promotes implicitly too.

**How to avoid:**
1. Enforce the GPU layer budget: max 2 during normal display, briefly 3 during crossfade, never 4+
2. Stop Ken Burns animation (`animation: none; transform: none`) on outgoing photo BEFORE starting crossfade
3. Use tiny-image blur (32x24 = ~3KB texture) instead of full-res blur (~22.4MB texture)
4. Set `will-change: auto` and `transform: none` on elements before removing from DOM to hint layer teardown
5. Verify with Safari Web Inspector Layers panel during development

**Warning signs:** PWA restarts itself after 2-8 hours; increasing compositing layer count in Safari Layers panel; memory graph climbs without plateauing.

### Pitfall 2: CSS `filter: blur()` Without GPU Acceleration Hint in Safari

**What goes wrong:** Safari does not automatically GPU-accelerate `filter: blur()` on elements. Without the `translate3d(0,0,0)` hint, blur falls back to CPU software rendering, causing persistent jank, especially on A9X.

**Why it happens:** Chrome and other browsers automatically engage the GPU for blur filters. Safari requires an explicit 3D transform to trigger GPU compositing for the filter.

**How to avoid:** Always pair `filter: blur()` with `transform: translate3d(0, 0, 0)` on the same element. This is a well-documented Safari-specific workaround confirmed by multiple sources.

**Warning signs:** FPS drops below 30; iPad gets warm/hot; visible stutter during photo transitions.

### Pitfall 3: Triple-Stack GPU Layers During Transitions

**What goes wrong:** During a naive crossfade with all effects enabled, 4 full-screen elements coexist: outgoing Ken Burns photo + outgoing blur + incoming Ken Burns photo + incoming blur. This is ~89.6MB GPU memory in a single transition window on a device with ~200-400MB GPU budget.

**Why it happens:** Each feature works fine in isolation. The danger is the brief moment where old and new overlap during the 1-second crossfade.

**How to avoid:** Sequential choreography (Pattern 3 above). Stop old Ken Burns, crossfade, start new Ken Burns. Background blur does not fade -- it appears/disappears with its wrapper's opacity. Never more than 3 GPU layers at peak.

**Warning signs:** Frame drops specifically during transitions (not during static display); occasional white/black flash; visible tearing.

### Pitfall 4: Overlay Positioning Under Status Bar in PWA Mode

**What goes wrong:** iOS PWA standalone mode with `apple-mobile-web-app-status-bar-style: black-translucent` renders the status bar OVER web content. Fixed-position elements at `top: 0` appear behind the status bar. The existing `#onThisDayIndicator` at `top: 1rem` works by coincidence (16px roughly matches status bar height on iPad).

**Why it happens:** `viewport-fit=cover` (already in the codebase) makes the viewport include the status bar area. Content is not automatically pushed down.

**How to avoid:** Use `env(safe-area-inset-top)` for all top-positioned overlays:
```css
top: max(1rem, env(safe-area-inset-top, 0px));
```
This ensures overlays clear the status bar on all devices including iPad Pro 1st Gen.

**Warning signs:** Overlay text partially hidden behind status bar in PWA mode; visible on desktop Safari but cut off on iPad home screen app.

### Pitfall 5: Clock Interval Leak on 24/7 Device

**What goes wrong:** `setInterval(() => updateClock(), 60000)` runs forever. If the slideshow page is navigated away from without cleanup, the interval continues. On a 24/7 device that never navigates, this is minor, but if the user exits to settings and returns, each visit creates a new interval without clearing the old one.

**Why it happens:** No `clearInterval()` on exit.

**How to avoid:**
1. Store interval ID: `let clockIntervalId = null`
2. Clear on exit: add to `exitSlideshow()`: `if (clockIntervalId) clearInterval(clockIntervalId)`
3. Clear on `beforeunload`: `window.addEventListener('beforeunload', () => clearInterval(clockIntervalId))`
4. For the clock, update every 60 seconds (minute-level precision is sufficient), not every second

### Pitfall 6: Blob URL Cleanup Must Handle Wrapper Pattern

**What goes wrong:** Current cleanup targets `.photo:not(.active)` to find and remove old photos. With the wrapper pattern, elements are `.photo-wrapper:not(.active)` and contain both the blur background div and the foreground img. The existing cleanup selector misses wrapper elements.

**Why it happens:** The cleanup selector was designed for bare `<img class="photo">` elements, not wrapped structures.

**How to avoid:**
1. When blur is enabled, change cleanup selector to `.photo-wrapper:not(.active)`
2. When blur is disabled, keep existing `.photo:not(.active)` selector
3. Before removing wrapper, revoke blob URL from inner `<img>` element's `src`
4. If using a data URI for the tiny blur background (recommended), no additional blob URL to revoke
5. Use a single cleanup function that handles both wrapper and non-wrapper cases

### Pitfall 7: Ken Burns Animation Causing Viewer Discomfort

**What goes wrong:** Random zoom direction + random pan direction + random speed creates chaotic motion that causes nausea in sensitive viewers, especially at scale ranges above 1.15.

**Why it happens:** Developers randomize all parameters independently. Real Ken Burns (the documentary filmmaker's technique) uses slow, gentle, predictable motion in one direction.

**How to avoid:**
1. Use predefined presets (Pattern 4), not random parameters
2. Keep scale range modest: 1.0 to 1.08 (8% zoom) over 30 seconds is barely perceptible but adds life
3. Use `ease-in-out` timing, not `linear` (organic feel)
4. Never zoom out immediately after zoom in (track last preset, avoid opposing motions)
5. Implement `prefers-reduced-motion: reduce` to disable Ken Burns entirely for accessibility

## Code Examples

Verified patterns from official sources and browser compatibility research:

### Ken Burns CSS with prefers-reduced-motion
```css
/* Source: MDN @media/prefers-reduced-motion, kirupa.com Ken Burns tutorial */

/* Container must clip scaled content */
#slideshow {
  overflow: hidden;
}

/* Ken Burns applied via JS class */
.photo.kenburns {
  will-change: transform;
  animation-timing-function: ease-in-out;
  animation-fill-mode: forwards;
}

/* Disable for users who need reduced motion */
@media (prefers-reduced-motion: reduce) {
  .photo.kenburns {
    animation: none !important;
    transform: none !important;
    will-change: auto;
  }
}
```

### Tiny-Image Blur Background (Client-Side)
```javascript
// Source: CSS-Tricks "Blur Up" technique, adapted for slideshow
function createTinyBlurDataUri(imgElement) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgElement, 0, 0, 32, 24);
  return canvas.toDataURL('image/jpeg', 0.4);
  // Returns ~400-800 byte data URI
  // GPU texture for 32x24: ~3KB vs ~22.4MB for full-res
}
```

### Safari-Safe Blur CSS
```css
/* Source: graffino.com Safari blur fix */
.photo-bg {
  position: absolute;
  top: -5%;
  left: -5%;
  width: 110%;
  height: 110%;
  background-size: cover;
  background-position: center;
  filter: blur(20px) brightness(0.7);
  transform: translate3d(0, 0, 0); /* REQUIRED: forces Safari GPU acceleration */
  z-index: 0;
  pointer-events: none;
}
```

### Safe Area Overlay Positioning
```css
/* Source: Apple developer docs, cvan/6c022ff9b14cf8840e9d28730f75fc14 */
.slideshow-overlay {
  position: fixed;
  z-index: 30;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  transition: opacity 0.5s;
  opacity: 0;
}

.slideshow-overlay.visible {
  opacity: 1;
}

#photoDateOverlay {
  bottom: max(2rem, env(safe-area-inset-bottom, 0px));
  left: max(2rem, env(safe-area-inset-left, 0px));
  font-size: 0.875rem;
  font-weight: 400;
}

#clockOverlay {
  bottom: max(2rem, env(safe-area-inset-bottom, 0px));
  right: max(2rem, env(safe-area-inset-right, 0px));
  font-size: 1.25rem;
  font-weight: 300;
}
```

### Clock with Proper Cleanup
```javascript
// Source: MDN requestAnimationFrame, setInterval best practices
let clockIntervalId = null;

function startClock() {
  updateClock(); // Show immediately
  clockIntervalId = setInterval(updateClock, 60000); // Update every minute
}

function updateClock() {
  const now = new Date();
  document.getElementById('clockTime').textContent =
    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function stopClock() {
  if (clockIntervalId) {
    clearInterval(clockIntervalId);
    clockIntervalId = null;
  }
}

// Add to exitSlideshow():
// stopClock();
```

### Photo Date Formatting
```javascript
// Source: MDN toLocaleDateString
function formatPhotoDate(createTimeISO) {
  if (!createTimeISO) return null;
  try {
    const d = new Date(createTimeISO);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    // Output: "March 2019", "December 2023"
  } catch {
    return null;
  }
}
```

### Reduced Motion Detection in JS
```javascript
// Source: MDN prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let kenBurnsEnabled = true; // from config

function shouldApplyKenBurns() {
  return kenBurnsEnabled && !prefersReducedMotion.matches;
}

// Listen for changes (user toggles system setting)
prefersReducedMotion.addEventListener('change', (e) => {
  if (e.matches) {
    // Immediately stop any running Ken Burns
    document.querySelectorAll('.photo.kenburns').forEach(el => {
      el.style.animation = 'none';
      el.style.transform = 'none';
      el.classList.remove('kenburns');
    });
  }
});
```

### GPU Layer Teardown Before DOM Removal
```javascript
// Source: Smashing Magazine "GPU Animation: Doing It Right"
function teardownAndRemove(element) {
  // Step 1: Stop any animations
  element.style.animation = 'none';
  // Step 2: Reset transform (hints compositor to release layer)
  element.style.transform = 'none';
  // Step 3: De-promote from compositor
  element.style.willChange = 'auto';
  // Step 4: Revoke blob URLs
  const img = element.tagName === 'IMG' ? element : element.querySelector('.photo');
  if (img && img.src && img.src.startsWith('blob:')) {
    URL.revokeObjectURL(img.src);
  }
  // Step 5: Remove from DOM
  element.remove();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `filter: blur()` on full-res image | Blur a tiny (32x24) image, scale up | Well-established (CSS-Tricks "Blur Up") | Eliminates GPU-intensive blur computation; ~3KB vs ~22.4MB texture |
| Canvas `ctx.filter = 'blur()'` | CSS `filter: blur()` with `translate3d` hint | Safari still does not support canvas filter (as of Safari 26.4) | Canvas blur approach is NOT viable on Safari/iOS; CSS blur with GPU hint is the only path |
| `filter: blur()` alone on Safari | `filter: blur() + transform: translate3d(0,0,0)` | Safari-specific, ongoing requirement | Without 3D transform hint, Safari does not GPU-accelerate blur, causing CPU fallback |
| `constant(safe-area-inset-*)` | `env(safe-area-inset-*)` | iOS 11.2 (2017) | `constant()` is the legacy syntax; `env()` is the current standard |
| `animation: none` for reduced motion | `@media (prefers-reduced-motion: reduce)` | Baseline since January 2020 | System-level detection, no JS required for CSS-only animations |
| Random Ken Burns parameters | Predefined presets with opposing-motion avoidance | UX best practice | Prevents viewer discomfort from chaotic motion patterns |

**Deprecated/outdated:**
- `CanvasRenderingContext2D.filter`: Not supported in Safari/iOS Safari. Do not use for blur effects on Apple devices.
- `constant(safe-area-inset-*)`: Legacy iOS 11.0-11.2 syntax. Use `env()` instead.
- CSS `zoom` property for Ken Burns: Not GPU-accelerated on Safari, triggers full repaint. Use `transform: scale()`.

## GPU Memory Budget (iPad Pro 1st Gen Specific)

### Hardware Constraints
| Spec | Value | Source |
|------|-------|--------|
| SoC | Apple A9X | Wikipedia |
| RAM | 4GB LPDDR4 (12.9") or 2GB (9.7") | Wikipedia |
| GPU | 12-core PowerVR Series7XT | Wikipedia |
| Memory bandwidth | 51.2 GB/s | Wikipedia |
| VRAM | None (unified memory, GPU shares system RAM) | Wikipedia |
| Screen resolution (physical) | 2732 x 2048 (12.9") | Apple Support |
| Screen resolution (CSS logical) | 1366 x 1024 | @2x Retina |

### Layer Memory Calculations
| Layer Type | Resolution | Memory (RGBA) | Notes |
|------------|-----------|---------------|-------|
| Full-screen compositing layer | 2732 x 2048 | ~22.4 MB | Width x Height x 4 bytes |
| Tiny blur background | 32 x 24 | ~3 KB | Negligible |
| Photo at fetch resolution | 2048 x 1536 | ~12.6 MB | Actual texture may be this or upscaled to screen res |

### Budget Rules
| State | Max GPU Layers | Max Memory | Duration |
|-------|---------------|------------|----------|
| Normal display | 2 | ~44.8 MB | 95% of time |
| During crossfade | 3 | ~67.2 MB | ~1 second |
| NEVER | 4+ | ~89.6 MB+ | Triggers jetsam risk |

### Estimated Available GPU Memory
Based on Smashing Magazine data (iPhone 6 ~200-300MB for GPU effects) and the A9X having 4GB vs iPhone 6's 1GB, the A9X likely has 400-600MB available for GPU compositing. However, iOS reserves significant memory for system processes, so a conservative estimate of 200-400MB is prudent for 24/7 reliability.

## Config Schema Extension

```javascript
const defaults = {
  // Existing (v1.0)
  interval: 30,
  displayMode: 'cover',
  onThisDay: false,
  portraitPairs: false,

  // New (Phase 5)
  kenBurns: true,           // default ON -- the hero feature
  blurredBackground: true,  // default ON
  showPhotoDate: true,      // default ON
  showClock: false,         // default OFF -- less essential, opt-in
};
```

## Settings Page Layout Extension

```
SLIDESHOW
  Interval         [10s] [30s] [1m] [2m] [5m]
  Display Mode     [Cover] [Contain] [Dual]

VISUAL EFFECTS                                <-- New section
  Ken Burns        [toggle] (default ON)
  Blurred Background [toggle] (default ON)

OVERLAYS                                      <-- New section
  Photo Date       [toggle] (default ON)
  Clock            [toggle] (default OFF)

FEATURES
  On This Day      [toggle]
  Portrait Pairs   [toggle]
```

## Overlay Position Strategy

### Position Map (avoiding conflicts with existing UI)
```
+--------------------------------------------------+
| [OTD indicator]            [Clock overlay]        |  top
|                                                    |
|                                                    |
|                  PHOTO                             |
|                                                    |
|                                                    |
| [Photo date]               [Controls panel]       |  bottom
+--------------------------------------------------+
```

**Overlay positions:**
- Photo date: bottom-left (replaces or stacks with `#info` panel)
- Clock: top-right (no conflict)
- These are always-visible (when enabled), unlike controls which auto-hide

**Conflict resolution:**
- `#info` (Photo X of Y) is at bottom-left, only visible when controls shown. Photo date overlay is always visible at bottom-left. They can coexist because `#info` has z-index 100 and only shows on tap, while photo date has z-index 30 and is always visible.
- When controls are visible (z-index 100), they naturally overlay the photo date (z-index 30).
- Clock at top-right does not conflict with anything (display mode controls at top-right only show on tap at z-index 100).

### Interaction with On This Day Indicator
When OTD indicator is visible (top-left, z-index 50), photo date at bottom-left does not conflict. Both can show simultaneously -- OTD shows "Mar 15 (42 photos)" while photo date shows "March 2019" for the specific displayed photo. These are complementary, not redundant.

## Dual Portrait Mode Considerations

When two portraits are displayed side-by-side:
- **Ken Burns:** Apply to each portrait independently (different presets for visual variety)
- **Blur background:** Disable blur in dual mode OR use a single shared blur background behind both portraits. Recommendation: **disable blur in dual mode** -- the two photos already fill most of the viewport, and 4 elements (2 photos + 2 blurs) doubles GPU load. Portrait pairs are already a visual feature.
- **Overlays:** Show single photo date (from left portrait or whichever has more recent date). Clock unchanged.

## Open Questions

Things that couldn't be fully resolved:

1. **Exact A9X GPU memory budget for web compositing**
   - What we know: 4GB shared RAM, ~200-400MB likely available for GPU effects (extrapolated from iPhone data)
   - What's unclear: Exact amount iOS reserves for system processes on this specific model with iOS 16.x
   - Recommendation: Build with the conservative 2-layer budget. If testing shows headroom, keep the budget anyway for 24/7 reliability.

2. **Safari's GPU layer teardown timing**
   - What we know: Removing an element from DOM should release its compositing layer. Setting `transform: none` and `will-change: auto` before removal helps hint teardown.
   - What's unclear: Whether WebKit's compositor releases textures synchronously or asynchronously after DOM removal. Smashing Magazine notes "the browser has to paint back on the background layer" on teardown, suggesting some latency.
   - Recommendation: Add a 100ms delay between GPU teardown hints and DOM removal. Monitor with Safari Layers panel.

3. **Tiny-image canvas approach on iOS Safari**
   - What we know: Standard canvas drawImage (without ctx.filter) works in all browsers. Creating a 32x24 canvas and drawing the full-res image onto it is well-supported.
   - What's unclear: Whether iOS Safari restricts canvas creation from blob URL images in any edge case.
   - Recommendation: Test on device. Fallback: use server-side sharp endpoint to generate tiny thumbnail.

4. **`filter: blur()` + `translate3d` GPU acceleration on A9X specifically**
   - What we know: This is the documented Safari fix per graffino.com and multiple sources. Works on modern iPads.
   - What's unclear: Whether the A9X GPU (2015 vintage) handles this the same as newer Apple GPUs.
   - Recommendation: Test on actual iPad Pro 1st Gen. If blur is still janky with tiny image + translate3d, fall back to server-side pre-blurred thumbnails.

## Sources

### Primary (HIGH confidence)
- [Smashing Magazine - GPU Animation: Doing It Right](https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/) -- GPU texture memory formula (W x H x 4 bytes), compositing layer management, will-change best practices
- [MDN - prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) -- CSS media query syntax, supported values, code examples
- [MDN - toLocaleDateString](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleDateString) -- Intl API date formatting, full Safari support confirmed
- [MDN - toLocaleTimeString](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleTimeString) -- Time formatting API
- [caniuse.com - CanvasRenderingContext2D.filter](https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter) -- Confirmed NOT supported in Safari 3.1 through 26.4
- [Apple Support - iPad Pro 1st Gen specs](https://support.apple.com/en-us/112024) -- 2732x2048 resolution, A9X chip
- [Wikipedia - Apple A9X](https://en.wikipedia.org/wiki/Apple_A9X) -- 4GB LPDDR4, 12-core PowerVR GPU, 51.2 GB/s bandwidth, unified memory
- [Graffino TIL - Safari filter:blur() fix](https://graffino.com/til/how-to-fix-filter-blur-performance-issue-in-safari) -- `translate3d(0,0,0)` GPU acceleration hint for Safari blur

### Secondary (MEDIUM confidence)
- [CSS-Tricks - The Blur Up Technique](https://css-tricks.com/the-blur-up-technique-for-loading-background-images/) -- Tiny image + blur technique, ~40x22 image size, blur(20px) radius
- [kirupa.com - Ken Burns Effect CSS](https://www.kirupa.com/html5/ken_burns_effect_css.htm) -- Keyframe structure, scale3d for GPU acceleration, overflow:hidden container
- [GitHub Gist - iOS PWA safe-area CSS](https://gist.github.com/cvan/6c022ff9b14cf8840e9d28730f75fc14) -- `env(safe-area-inset-*)` patterns for standalone mode
- [Pope Tech Blog - Accessible Animation 2025](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/) -- prefers-reduced-motion best practices, "reduce not disable" principle
- [Sharp documentation](https://sharp.pixelplumbing.com/) -- Server-side blur/resize API (already in project devDependencies)

### Tertiary (LOW confidence)
- WebSearch results suggesting ~10MB per-element GPU texture limit on iOS Safari -- unverified specific number, needs on-device testing
- WebSearch results suggesting iPhone 6 has ~200-300MB GPU budget -- extrapolated to A9X (different device class), approximate

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all browser-native APIs, well-documented, verified compatibility
- Architecture (wrapper pattern, choreography): HIGH -- based on direct codebase analysis and established CSS patterns
- GPU memory budget: MEDIUM -- calculations verified (W x H x 4), but exact A9X thresholds need on-device validation
- Pitfalls: HIGH (code-level), MEDIUM (performance-level) -- code analysis is certain, GPU performance depends on device testing
- Overlays: HIGH -- straightforward DOM + Intl API, well-supported

**Research date:** 2026-02-15
**Valid until:** 2026-06-15 (stable -- browser APIs are mature, A9X hardware is fixed)
