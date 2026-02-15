# Domain Pitfalls: v1.1 "Make It Shine"

**Domain:** Adding visual polish, Stripe payments, and demo mode to an existing 24/7 photo frame PWA
**Target hardware:** iPad Pro 1st Gen (A9X chip, 4GB RAM, iOS 16.x, Safari WebKit)
**Researched:** 2026-02-15
**Confidence:** MEDIUM -- based on deep codebase analysis and known WebKit/Safari behavior patterns. WebSearch/WebFetch unavailable during research; all claims derive from training data and should be validated against official docs during implementation.

**Key context:** This app runs 24/7 in Guided Access kiosk mode. Any performance regression means the photo frame dies silently with nobody watching. Every pitfall below is evaluated through the lens of "will this cause a crash or memory leak after 48+ hours of continuous operation?"

---

## Critical Pitfalls

These cause crashes, memory exhaustion, or security holes.

### Pitfall 1: Ken Burns CSS Transform Animation Creates Unbounded GPU Memory on iOS Safari

**Severity:** CRITICAL -- frame crashes after hours of continuous Ken Burns animation

**What goes wrong:**
Ken Burns effect requires CSS `transform: scale()` with `transition` or `@keyframes` animation on full-screen images. On iOS Safari (especially older devices like iPad Pro 1st Gen with A9X), each animated element that uses `transform` gets promoted to its own GPU compositing layer. A 2732x2048 image at retina resolution consumes ~21MB of GPU texture memory per compositing layer. With the A/B swap pattern (two images during crossfade), you briefly have TWO animated GPU layers (~42MB). If the old layer is not properly decommissioned, GPU memory accumulates over hundreds of transitions.

The A9X GPU has limited VRAM shared with system RAM (from the 4GB total). After hundreds of Ken Burns cycles, the WebKit process gets killed by iOS's jetsam (out-of-memory killer) with no warning and no error -- the PWA simply restarts from scratch.

**Why it happens:**
- CSS `transform` triggers GPU layer promotion. `will-change: transform` makes this explicit, but Safari often promotes implicitly.
- The Ken Burns animation is CONTINUOUS -- the image is always scaling/panning during the entire display interval (30-300 seconds). This is not a brief transition; it holds a GPU layer for the entire duration.
- The current A/B swap pattern (see `showSinglePhoto()` in `slideshow.html`) removes old `<img>` elements after 1.5 seconds. But removing the DOM element does NOT guarantee the GPU texture is freed synchronously. WebKit's compositor may hold stale textures.
- Blob URLs (`URL.createObjectURL`) already consume memory; adding GPU textures on top compounds the pressure.

**How to avoid:**
1. **Single animated element, not two.** Never run Ken Burns on both the incoming and outgoing image. The outgoing image should have its animation STOPPED (set `animation: none` or remove the class) before the incoming image starts animating. This halves peak GPU memory.
2. **Force GPU layer teardown.** After removing the old image from DOM, explicitly set `img.style.transform = 'none'` and `img.style.willChange = 'auto'` BEFORE calling `img.remove()`. This hints to WebKit to release the compositing layer.
3. **Use `transform: scale()` NOT `zoom`.** The CSS `zoom` property is not GPU-accelerated on Safari and triggers full repaint instead.
4. **Keep scale range modest.** A Ken Burns zoom from 1.0 to 1.15 (15% zoom) looks cinematic without requiring massive texture resampling. Going to 1.3+ means the GPU must render a much larger texture.
5. **Request smaller images when Ken Burns is active.** Currently the proxy fetches `=w2048-h1536`. With Ken Burns at 1.15x scale, you need at most `=w2356-h1766` to avoid pixelation. Do NOT fetch 4K images -- the A9X cannot handle continuous animation of 4K textures.
6. **Add a memory watchdog.** Check `performance.memory.usedJSHeapSize` (if available on Safari) every 10 transitions. If memory exceeds a threshold (e.g., 200MB), disable Ken Burns and fall back to static display. Better to lose the effect than crash.

**Warning signs:**
- PWA restarts itself after 2-8 hours with no error in the console
- Safari Web Inspector shows increasing "Compositing Layers" count
- Memory graph in Web Inspector climbs steadily without plateauing
- Images flicker or show white frames during transitions

**Detection during development:**
- Safari Web Inspector > Layers panel -- watch compositing layer count during transitions
- Safari Web Inspector > Timelines > Memory -- should plateau, not climb
- Run slideshow for 30+ minutes in Safari on the actual iPad, not Chrome desktop

**Phase to address:** Ken Burns implementation phase -- must be baked into the animation approach from the start, not bolted on after.

**Confidence:** MEDIUM -- GPU layer behavior is well-documented for Safari but exact thresholds depend on iOS version and device. Must validate on actual iPad Pro 1st Gen.

---

### Pitfall 2: CSS `filter: blur()` on Full-Screen Background Triggers Continuous Repaint on iOS 16.x Safari

**Severity:** CRITICAL -- causes persistent jank, battery drain, and potential crash

**What goes wrong:**
The blurred background feature requires placing a copy of the current photo behind the main image, scaled to cover the full viewport, and applying `filter: blur(20px)` or similar. On iOS 16.x Safari, `filter: blur()` has several known issues:

1. **No GPU acceleration for `filter: blur()` on `<img>` elements in some contexts.** Safari may fall back to software rendering for the blur, which means the CPU recomputes the blur on every paint -- including during Ken Burns animation, crossfade transitions, or any compositor invalidation.
2. **Blur radius proportional to cost.** A `blur(20px)` on a 2732x2048 image requires sampling a 40x40 pixel kernel for every output pixel. Even GPU-accelerated, this is expensive. Software-rendered, it is catastrophic.
3. **Interaction with `backdrop-filter` already in use.** The current codebase uses `backdrop-filter: blur(12px)` and `backdrop-filter: blur(20px)` on control panels (`#controls`, `#intervalControls`, `#displayModeControls`, `#onThisDayIndicator`). Adding another full-screen blur underneath creates multiple blur passes.
4. **The blur must update every time the photo changes.** Unlike a static blur, the slideshow swaps photos every 10-300 seconds. Each swap requires re-blurring a new full-screen image.

**Why it happens:**
- Safari on iOS 16 has known performance issues with CSS filters on large elements
- The iPad Pro 1st Gen (A9X, 2015) has a much weaker GPU than modern iPads
- The combination of Ken Burns animation + blur background + crossfade transition creates a triple-stacked GPU workload

**How to avoid:**
1. **Pre-blur on the server, not in CSS.** The backend photo proxy already fetches and pipes the image. Add a server-side blur endpoint that returns a pre-blurred, heavily compressed, small version (e.g., `=w200-h150` from Google, then gaussian blur in sharp/canvas). Serve this as a separate background image. CSS blur becomes unnecessary.
2. **If using CSS blur: blur a TINY image, not the full-res one.** Load the background image at very low resolution (e.g., `=w64-h48`), apply `filter: blur(30px)`, and scale it up with `object-fit: cover`. Blurring a 64x48 image costs effectively nothing. The visual result is indistinguishable from blurring a full-res image because blur destroys high-frequency detail anyway.
3. **Use a static canvas element, not a live CSS filter.** Draw the blurred image once to a `<canvas>` using `CanvasRenderingContext2D.filter = 'blur(20px)'`, then leave the canvas static. This computes the blur once on photo change, not continuously.
4. **Never apply `filter: blur()` to an element that is also being animated with `transform`.** The combination forces Safari to recompute the blur on every animation frame (because the layer is being transformed). If Ken Burns is running on the foreground, the background blur must be on a completely separate, static element.
5. **Make blur toggleable independently of Ken Burns.** If users want both, fine -- but if performance suffers, they can disable blur while keeping Ken Burns or vice versa.

**Warning signs:**
- FPS drops below 30 during photo transitions (check Safari Timelines)
- iPad gets warm/hot during slideshow operation
- Scrolling or UI interactions become laggy even when controls are visible
- Battery drain is dramatically higher with blur enabled

**Detection during development:**
- Safari Web Inspector > Timelines > Rendering Frames -- green = good, yellow/red = jank
- If frame rate dips below 30fps consistently, the blur approach needs revision
- Test with both Ken Burns AND blur enabled simultaneously -- the combo is worse than either alone

**Phase to address:** Blurred background implementation phase. Choose the blur approach (CSS vs server-side vs canvas) upfront.

**Confidence:** MEDIUM -- CSS filter performance on Safari is notoriously device-dependent. The "blur a tiny image" approach is well-established but needs validation on iOS 16.x specifically.

---

### Pitfall 3: Ken Burns + Blur + Crossfade Triple-Stack During Photo Transitions

**Severity:** CRITICAL -- peak GPU/CPU load during transitions can trigger jetsam kill

**What goes wrong:**
During a photo transition with all v1.1 features enabled, the following happens simultaneously in a ~1 second window:

1. **Outgoing photo:** Ken Burns animation still running + CSS opacity fading to 0
2. **Incoming photo:** Ken Burns animation starting + CSS opacity fading to 1
3. **Outgoing background blur:** Fading out (or being replaced)
4. **Incoming background blur:** Fading in

That is potentially 4 full-screen elements, at least 2 with active transform animations, at least 2 with blur filters, all compositing simultaneously. On an iPad Pro 1st Gen, this is a GPU and memory budget far beyond what the device can handle smoothly.

**Why it happens:**
Each feature was designed independently and seems reasonable in isolation. Ken Burns alone is fine. Blur alone is fine. But the transition moment where OLD and NEW overlap is where all the costs stack.

**How to avoid:**
1. **Sequential, not simultaneous transitions.** When transitioning with Ken Burns:
   - STOP Ken Burns on outgoing image (set `animation: none`, `transform: none`)
   - Cross-fade (opacity transition -- cheap, no blur involved)
   - START Ken Burns on incoming image only after crossfade completes
   - Update background blur AFTER crossfade, not during
   This serialization doubles the perceived transition time (~2s instead of ~1s) but prevents the GPU spike.

2. **The background blur should NOT animate during crossfade.** Keep the OLD background blur visible during the entire crossfade, then swap to the NEW background blur instantly (no fade) after the crossfade is complete. One less animated element.

3. **Budget your compositing layers.** The rule of thumb for iPad Pro 1st Gen: no more than 2 GPU-promoted layers at any time during normal operation. During transitions, allow briefly 3, but never 4+.

4. **Consider a transition blackout approach.** Instead of crossfading directly between two Ken Burns images, briefly fade to a blurred version (which is the background), hold for 0.5s, then fade in the new image with Ken Burns starting. This is cinematically beautiful and only ever has 1-2 GPU layers active.

**Warning signs:**
- Visible frame drops specifically DURING transitions, not during static Ken Burns
- Occasional white flash or black flash during transition
- Safari renderer falls back to software compositing (visible as "tearing" artifacts)

**Phase to address:** Must be designed during Ken Burns AND blur phase planning. The transition choreography is the integration point.

**Confidence:** HIGH -- this is fundamental GPU compositing math. Stacking animated layers is expensive on any device; on a 2015 iPad it is prohibitive.

---

### Pitfall 4: Demo Mode Creates Authentication Bypass if Not Properly Isolated

**Severity:** CRITICAL (security) -- demo mode could allow unauthenticated access to admin features or real user data

**What goes wrong:**
Demo mode needs to serve sample photos without Google OAuth. If implemented as a flag that skips authentication checks, it may accidentally:
1. Allow unauthenticated access to `/api/config` (settings modification)
2. Allow unauthenticated access to `/api/picker/*` (picker session management)
3. Allow unauthenticated access to `/api/health` (system information disclosure)
4. Allow unauthenticated access to `/api/feedback` (spam vector)
5. Expose the real user's cached photos if the demo flag leaks to the photo proxy

The current authentication model uses an email allowlist (`ALLOWED_EMAILS` in `.env`) checked during OAuth callback (see `auth.js:142-166`). But many API routes have NO authentication middleware -- they rely on the frontend only being accessible after OAuth. Demo mode must not break this assumption.

**Why it happens:**
The simplest implementation is `if (demoMode) return next()` in an auth middleware. But the app currently has no auth middleware on API routes -- authentication is only enforced at the OAuth level. Routes like `/api/config`, `/api/photo/random`, and `/api/health` are completely unprotected (by design -- single-tenant family app).

**How to avoid:**
1. **Demo mode should be a completely separate code path, not a flag that disables auth.** The demo slideshow should serve static bundled sample images from `/public/demo/` -- never hitting `/api/photo/random` which requires real Google tokens.
2. **Demo mode should NOT have access to any `/api/*` routes.** The demo slideshow page should be a self-contained HTML file (e.g., `/demo.html`) with embedded sample images or a separate demo endpoint.
3. **If demo mode needs an API endpoint, create `/api/demo/photo/random`** that serves from a separate, pre-bundled photo set. Never share the real photo proxy code path.
4. **The demo toggle should be server-side config, not a URL parameter.** If demo mode is triggered by `?demo=true`, anyone can access demo mode and potentially probe for vulnerabilities. Instead, use an environment variable or config flag: `DEMO_MODE=true`.
5. **Demo mode should be read-only.** No access to settings modification, picker sessions, or feedback submission. The demo should only show: slideshow + overlays + a "Sign in to use your own photos" CTA.

**Specific risks with current codebase:**
- `/api/config` POST has no auth check -- demo users could modify the real user's settings
- `/api/health` exposes `cache.totalItems`, `cache.portraitCount`, and uptime -- information disclosure
- `server.js` has no auth middleware on any route -- demo mode cannot rely on "skipping" auth that doesn't exist

**Warning signs:**
- Demo endpoint shares any code path with authenticated endpoints
- Demo mode is controlled by a query parameter instead of server-side config
- Demo mode can trigger Google API calls (even failed ones leak information about auth state)
- No separate demo photo storage -- demo accesses real cache

**Phase to address:** Demo mode implementation phase. Design the isolation boundary BEFORE writing code.

**Confidence:** HIGH -- this is straightforward security architecture. The current app has no auth middleware on routes, which is fine for single-tenant but becomes a problem the moment demo mode introduces unauthenticated access.

---

## Moderate Pitfalls

These cause degraded experience, bugs, or technical debt.

### Pitfall 5: Blob URL Leak Rate Doubles with Background Blur Images

**Severity:** HIGH -- memory leak timeline halved (crash in hours instead of days)

**What goes wrong:**
The current implementation correctly revokes blob URLs when removing old photos (see `showSinglePhoto()` lines 786-789, 809-815). But the blurred background feature adds a SECOND image element per photo (the background copy). If the background blur uses a blob URL (either the same blob URL as the foreground or a separate one for the low-res version), the cleanup code must revoke BOTH blob URLs.

The current cleanup code uses `slideshowEl.querySelectorAll('.photo:not(.active)')` to find old photos. If background blur elements have a different class (e.g., `.photo-bg`), they will NOT be cleaned up by the existing code.

**Why it happens:**
The current blob URL cleanup was designed for the A/B swap pattern with exactly 2 `.photo` elements. Adding background blur elements doubles the blob URLs created per cycle but the cleanup only targets `.photo` elements.

**How to avoid:**
1. **If background blur uses the same blob URL as foreground:** Do NOT create a second blob URL. Set `bgImg.src = foregroundImg.src` (share the same blob URL). Only revoke it when BOTH elements are removed.
2. **If background blur uses a separate low-res blob URL:** Tag background elements with a data attribute and include them in the cleanup selector: `slideshowEl.querySelectorAll('.photo:not(.active), .photo-bg:not(.active)')`.
3. **Better: use the tiny-image CSS blur approach** (Pitfall 2, option 2). Set `bgImg.src` to a data URI or a tiny inline base64 image. Data URIs do not create blob URLs and do not need revocation.
4. **Audit the cleanup path.** After implementing blur backgrounds, add a console log that counts live blob URLs and DOM elements every 10 transitions. If either climbs, there is a leak.

**Warning signs:**
- `performance.memory.usedJSHeapSize` climbs faster with blur enabled than without
- DOM element count in `#slideshow` grows over time (check with `slideshowEl.childElementCount`)
- Blob URLs accumulate in browser memory (visible in Safari Web Inspector > Resources)

**Phase to address:** Blurred background implementation -- cleanup must be designed alongside creation.

**Confidence:** HIGH -- this is a direct analysis of the current codebase cleanup pattern in `slideshow.html`.

---

### Pitfall 6: Overlays (Date, Clock) Disappear or Misposition in iOS PWA Fullscreen Mode

**Severity:** HIGH -- feature appears broken on the primary target device

**What goes wrong:**
iOS PWA fullscreen mode (`apple-mobile-web-app-capable: yes` with `black-translucent` status bar) has a different safe area than Safari browser mode. The viewport includes the status bar area and home indicator area. CSS `position: fixed` elements positioned at `top: 0` or `bottom: 0` can appear under the notch, status bar, or rounded corners on newer iPads (and under the status bar on iPad Pro 1st Gen).

The current codebase already uses `viewport-fit=cover` (see `slideshow.html` line 6) and uses fixed positioning for overlays (`#onThisDayIndicator` at `top: 1rem; left: 1rem`). New date and clock overlays will face the same issue, but with the additional complexity of being always-visible (unlike controls that auto-hide).

Additionally, `position: fixed` behaves differently in iOS PWA standalone mode vs Safari. In standalone mode, there is no URL bar to account for, but the safe area insets from `env(safe-area-inset-*)` may differ.

**Why it happens:**
- iPad Pro 1st Gen does NOT have rounded corners or a home indicator, so `safe-area-inset-bottom` is 0. BUT it does have a status bar in PWA mode that can overlay content.
- `black-translucent` status bar style means the status bar overlays the web content -- it does NOT push content down. Content at `top: 0` appears BEHIND the status bar.
- The current `#onThisDayIndicator` at `top: 1rem` likely works by coincidence (1rem = 16px is roughly the status bar height on iPad).

**How to avoid:**
1. **Use `env(safe-area-inset-top)` for top-positioned overlays.** Instead of `top: 1rem`, use `top: max(1rem, env(safe-area-inset-top, 0px))`. This ensures the overlay clears the status bar on all devices.
2. **Test in actual PWA mode, not Safari.** Open the app from the home screen icon, not from Safari. The layout is different.
3. **Overlay z-index must be above the Ken Burns animated layer.** Ken Burns uses `transform` which creates a new stacking context. If the overlay is not in a higher stacking context, it can appear behind the animated photo. Current photos use `z-index: 0` (preload) and `z-index: 1` (active). Overlays should use `z-index: 50+` (the existing `#onThisDayIndicator` uses `z-index: 50`, which is correct).
4. **Clock overlay updating every second can interfere with CSS transitions.** If the clock DOM update triggers a repaint that coincides with a crossfade transition, it can cause micro-stutter. Use a separate `requestAnimationFrame` loop for clock updates, not `setInterval` with DOM writes.
5. **Test both landscape orientations.** iPad can be rotated 180 degrees. Safe area insets may differ between left-landscape and right-landscape if the device has a camera notch (iPad Pro 1st Gen does not, but future-proofing is free).

**Warning signs:**
- Overlay text partially hidden behind status bar in PWA mode
- Overlay visible in Safari but not in PWA home screen app
- Clock text causes visible jitter during photo crossfade transitions
- Overlay positioning differs between landscape-left and landscape-right

**Phase to address:** Overlay implementation phase. Use safe area insets from the start.

**Confidence:** MEDIUM -- iOS PWA safe area behavior is well-documented by Apple, but the exact behavior on iPad Pro 1st Gen with iOS 16.x in landscape mode should be validated on-device.

---

### Pitfall 7: Stripe Integration Overengineered -- Payment Links Exist for This Exact Use Case

**Severity:** HIGH (time waste, not technical failure) -- building a full Stripe integration for a donate button is massive overkill

**What goes wrong:**
Developers see "Stripe integration" and immediately think: `npm install stripe`, create checkout sessions server-side, handle webhooks, store payment state, build success/cancel pages. For a simple donate button on a personal project, this is weeks of unnecessary work that also introduces PCI compliance concerns, webhook security, and an entire payment state machine.

**Why it happens:**
Most Stripe tutorials teach the full Checkout Session flow because that is what e-commerce sites need. A donate button for a portfolio project is not e-commerce.

**How to avoid:**
1. **Use Stripe Payment Links.** Create a Payment Link in the Stripe Dashboard (no code required). It generates a URL like `https://buy.stripe.com/xxx`. Put this URL behind an `<a>` tag. Done. No backend code, no npm packages, no webhooks, no PCI scope.
2. **Alternatively, use the Stripe Donate Button embed.** Stripe provides an embeddable donate button that handles the entire payment flow in a modal overlay. Requires only a `<script>` tag and data attributes.
3. **Do NOT install the `stripe` npm package for a donate button.** This pulls in server-side infrastructure for creating payment intents, managing customers, handling webhooks -- none of which are needed.
4. **Do NOT handle any payment logic server-side.** No checkout session creation, no webhook handling, no payment confirmation. The Stripe Dashboard shows all donations.
5. **CSP consideration:** The current Content Security Policy in `server.js` restricts scripts and connections to specific origins. Stripe's embedded button requires adding `https://js.stripe.com` to `script-src` and `https://api.stripe.com` to `connect-src`. The Payment Link approach (just an `<a>` tag) requires NO CSP changes.

**The existing codebase already has a donation placeholder.** See `index.html` line 1179 -- there is already a "Donate via PayPal" link in the feedback modal. The Stripe integration is literally replacing that PayPal link with a Stripe Payment Link URL. This should take 15 minutes, not a full implementation phase.

**Warning signs:**
- Pulling in `stripe` npm package for a donate button
- Creating server-side endpoints for payment handling
- Implementing webhook handlers
- Building success/cancel redirect pages
- Any discussion of PCI compliance for a donate button

**Phase to address:** Can be done in any phase -- it is a URL replacement. Should NOT be its own phase or plan.

**Confidence:** HIGH -- Stripe Payment Links are a well-established feature. The existing PayPal placeholder in the codebase confirms this is a trivial task.

---

### Pitfall 8: Bug Fixes Silently Break Existing Features (Regression Risk)

**Severity:** HIGH -- fixing 6 bugs simultaneously can introduce regressions in stable features

**What goes wrong:**
v1.1 includes fixes for 6 QA bugs (BUG-1 through BUG-6). Several of these touch core slideshow infrastructure:
- **BUG-2 (picker merge):** Modifies `photo-cache.js` -- the cache structure changes from replace to merge. This could break `getRandomItem()`, `getRandomOnThisDayItem()`, or `getRandomPortraitItem()` if the merged cache has unexpected duplicates or structure.
- **BUG-5 (502 resilience):** Modifies `photo-proxy.js` -- changing error handling in the photo endpoint could affect the retry logic in `slideshow.html`'s `fetchWithRetry()`.
- **BUG-6 (dual mode letterboxing):** Modifies the CSS/JS for dual portrait display -- the same code that Ken Burns and blur will need to integrate with.

**Why it happens:**
The codebase has no automated tests. There is no test suite, no integration tests, no visual regression tests. Bug fixes are manually verified on a single path but can break adjacent code paths. The slideshow code has complex state interactions (display modes, portrait pairs, On This Day, crossfade timing) that are easy to disrupt.

**How to avoid:**
1. **Fix bugs BEFORE adding new features.** Bug fixes should be a separate phase from Ken Burns/blur implementation. Ship the bug fixes, verify on the iPad, THEN add visual polish. This way, if Ken Burns introduces a regression, you know the bug fixes are not the cause.
2. **Create a manual regression checklist.** After each bug fix, test ALL of these:
   - Basic slideshow (cover mode, 30s interval)
   - Contain mode
   - Dual portrait mode
   - On This Day mode (with and without matching photos)
   - Settings persistence across page reload
   - URL parameter override
   - Photo transitions (no white flash, no stuck images)
   - Blob URL cleanup (check DOM element count after 10 transitions)
3. **Fix one bug per commit.** Do not batch all 6 bug fixes into a single commit. If a regression appears, bisecting is trivial with one-fix-per-commit.
4. **For BUG-2 (cache merge):** After implementing merge logic, verify that `photo-cache.json` does not grow unbounded. If the user runs the picker 10 times selecting 100 photos each time, the cache should contain ~1000 unique items, not 1000 * 10 duplicates.
5. **For BUG-5 (502 resilience):** The fix must not change the response format from `/api/photo/random`. The frontend's `createPhotoElement()` function expects either a blob response (success) or a JSON error response. If the fix changes the 502 response to return a fallback image instead of an error, the frontend's On This Day logic (which checks for 404 specifically) could break.

**Warning signs:**
- A feature that was working in v1.0 stops working after bug fixes
- Slideshow displays differently after bug fix deployment (e.g., photos stuck, wrong display mode)
- Console errors that were not present before

**Phase to address:** Bug fix phase should be Phase 1 of v1.1, before any visual polish.

**Confidence:** HIGH -- direct analysis of codebase interdependencies. No tests exist to catch regressions.

---

### Pitfall 9: Ken Burns Animation Direction Causes Nausea-Inducing Patterns

**Severity:** MEDIUM (UX) but HIGH (product reputation) -- a photo frame that makes people feel sick is worse than one with no effects

**What goes wrong:**
Random Ken Burns direction (zoom in, zoom out, pan left, pan right) creates a jarring experience when consecutive photos have opposing motion. Photo 1 zooms in, photo 2 zooms out, photo 3 pans left, photo 4 pans right -- the viewer's eye cannot settle. Over minutes of viewing, this induces motion sickness in sensitive viewers.

Additionally, if the zoom origin is always center (the CSS default `transform-origin: center`), the effect looks mechanical and repetitive. Real Ken Burns effects vary the focal point.

**Why it happens:**
Developers randomize all parameters (zoom direction, pan direction, speed) independently, creating chaotic motion. Professional Ken Burns implementations use choreographed sequences.

**How to avoid:**
1. **Constrain the motion vocabulary.** Use only 4-6 predefined Ken Burns presets, each with a fixed zoom direction, transform-origin, and speed:
   - Slow zoom in from center
   - Slow zoom in from top-left corner
   - Slow zoom in from bottom-right corner
   - Slow zoom out from center
   - Gentle pan left (translate + slight zoom)
   - Gentle pan right (translate + slight zoom)
2. **Never zoom out immediately after zoom in.** Use a simple state variable to avoid consecutive opposing motions.
3. **Keep motion subtle.** 1.0 to 1.08 scale over 30 seconds is barely perceptible but adds life. 1.0 to 1.2 is noticeable but not sickening. Anything above 1.25 feels like a camera zoom, not a gentle effect.
4. **Use `ease-in-out` timing, not `linear`.** Linear motion feels robotic. A gentle ease makes the motion feel organic.
5. **Test with the `prefers-reduced-motion` media query.** When enabled, disable Ken Burns entirely -- do not reduce it, disable it. Some users have accessibility needs.

**Warning signs:**
- Viewer feels uncomfortable watching the slideshow for more than 5 minutes
- Motion feels "busy" or "restless" rather than "gentle" or "cinematic"
- Family members ask to turn off the effect

**Phase to address:** Ken Burns implementation. Define the motion presets during design.

**Confidence:** HIGH -- this is well-established UX knowledge from film/TV. The Ken Burns documentary style uses slow, gentle, predictable motion.

---

### Pitfall 10: New Config Keys Break Existing config.json Without Migration

**Severity:** MEDIUM -- new features silently disabled on existing deployment

**What goes wrong:**
v1.1 adds new toggleable features (Ken Burns, blur, overlays, demo mode). Each needs a config key (e.g., `kenBurns: false`, `blurBackground: false`, `showClock: false`). The existing `config.json` on the VPS was written by v1.0 and contains only `interval`, `displayMode`, `onThisDay`, and `portraitPairs`.

The current `config.js` merges defaults with saved config (`{ ...defaults, ...saved }`) which DOES handle missing keys correctly -- new defaults are applied. However, the `saveConfig()` validation uses `allowedKeys = Object.keys(defaults)` to filter updates. If the `defaults` object is updated in code but the VPS still has an old `config.json`, the system works. BUT if someone manually edited `config.json` on the VPS with unknown keys, those would be silently dropped on next save.

More importantly, the Settings page (`settings.html`) needs UI elements for every new config key. If the settings page is deployed but the backend defaults are not updated (deploy mismatch), toggles appear but do nothing.

**Why it happens:**
File-based config with no schema version. The merge-with-defaults pattern works for ADDING keys but does not handle RENAMING keys or REMOVING deprecated keys.

**How to avoid:**
1. **Add all new config keys to `defaults` in `config.js` before deploying any feature that reads them.** The merge pattern will provide correct defaults.
2. **Deploy backend before frontend.** If the settings page has a Ken Burns toggle but the backend does not have `kenBurns` in defaults, the toggle will be saved and silently ignored. Deploy sequence: backend config defaults first, frontend UI second.
3. **Keep config key names stable.** Once `kenBurns` is in config, never rename it to `kenBurnsEnabled` or `effectKenBurns`. Renaming is a breaking change without migration.
4. **Consider adding a `configVersion` field** to config.json. On load, if `configVersion < EXPECTED_VERSION`, run a migration function that maps old keys to new ones. This is low priority for v1.1 but becomes important if config changes frequently.

**Warning signs:**
- New feature toggle is ON in settings but the feature does not activate in slideshow
- `config.json` on VPS has fewer keys than expected after deploy
- Settings page shows "undefined" or blank for new settings

**Phase to address:** First phase of v1.1 -- update `config.js` defaults before implementing any feature.

**Confidence:** HIGH -- direct analysis of `config.js` code. The merge pattern handles additions correctly but deployment ordering matters.

---

## Minor Pitfalls

These cause annoyance or are easily fixable.

### Pitfall 11: Clock Overlay Creates 1-Second setInterval That Leaks Across Page Navigation

**Severity:** LOW-MEDIUM -- minor memory leak, but on a 24/7 device it accumulates

**What goes wrong:**
A clock overlay updating every second requires `setInterval(() => { clockEl.textContent = new Date().toLocaleTimeString() }, 1000)`. If the slideshow page is navigated away from (e.g., user exits to settings), the interval continues running because there is no cleanup. Each time the user navigates to slideshow and back, a new interval is created without clearing the old one.

In the current app, this is unlikely to be severe because the slideshow page is standalone and navigation destroys the entire page. But if the code is later refactored to SPA-style navigation (which the demo mode might introduce), leaked intervals become a real problem.

**How to avoid:**
1. **Store the interval ID and clear it on page unload.** `window.addEventListener('beforeunload', () => clearInterval(clockIntervalId))`.
2. **Use `requestAnimationFrame` instead of `setInterval` for visual updates.** rAF pauses when the tab is hidden, saving CPU. For a clock that only needs second-level precision, check if the second has changed before updating the DOM.
3. **If the clock is always visible, consider CSS-only approaches.** There is no pure CSS clock, but updating via rAF is lighter than setInterval.

**Phase to address:** Clock overlay implementation.

**Confidence:** HIGH -- standard JavaScript timer management.

---

### Pitfall 12: Service Worker Cache Serves Stale Slideshow HTML After v1.1 Deploy

**Severity:** MEDIUM -- users see v1.0 slideshow without new features after deploy

**What goes wrong:**
The current Service Worker (`sw.js`) uses cache-first for static assets: `caches.match(event.request).then(response => response || fetch(event.request))`. After deploying v1.1, the iPad's PWA will continue serving the cached v1.0 `slideshow.html` until the Service Worker updates. The SW update mechanism requires: (1) the browser to detect the `sw.js` file changed (byte comparison), (2) the new SW to install, (3) the new SW to activate (requires all old tabs to close or `skipWaiting()`).

The current SW uses `self.skipWaiting()` and `self.clients.claim()`, which helps. But `slideshow.html` is in the `STATIC_ASSETS` precache list. A cache-first strategy means the old HTML is served even after the new SW activates, UNTIL the new SW's precache overwrites it.

**Why it happens:**
Cache-first is correct for performance but means stale content is served during updates. The `CACHE_VERSION` constant (`'okno-v1'`) must be updated to trigger cache invalidation.

**How to avoid:**
1. **Update `CACHE_VERSION` in `sw.js` for every v1.1 deploy.** Change to `'okno-v1.1'` or `'okno-v2'`. The activate handler already deletes old caches when the version changes.
2. **Force SW update on the iPad after deploy.** In Guided Access / PWA mode, there is no easy way to "hard refresh." Options:
   - SSH into VPS, update sw.js, the PWA will detect the change within 24 hours (browser checks SW updates every 24h max)
   - Add a version check endpoint: slideshow fetches `/api/version` on load, compares with a local constant, shows "update available" if mismatched
3. **Consider switching slideshow.html to network-first.** The SW already uses network-first for `/api/photo/*`. Using network-first for the HTML page too ensures the latest version is always served when online, with cache fallback when offline.

**Warning signs:**
- Deploy new features to VPS but iPad still shows old slideshow
- Features appear in settings but not in slideshow (settings.html may update faster because it is not in the precache list -- actually it IS in the precache list)
- Wait... checking: `STATIC_ASSETS` includes `/slideshow.html`, `/manifest.json`, and icons. But NOT `/index.html` or `/settings.html`. So index.html and settings.html are served with cache-first for same-origin requests, but are NOT precached. They will be cached on first visit and then served from cache on subsequent visits. This means settings.html could also be stale.

**Phase to address:** First deployment of any v1.1 code. Update the SW cache version.

**Confidence:** HIGH -- direct analysis of `sw.js` code.

---

### Pitfall 13: Stripe Payment Link CSP Configuration -- Button vs Link Approach Matters

**Severity:** LOW -- only relevant if using Stripe embedded button instead of Payment Link

**What goes wrong:**
If using Stripe's embedded donate button (JavaScript embed), the current Content Security Policy blocks it. The CSP in `server.js` allows scripts from `'self'`, `'unsafe-inline'`, `cdn.jsdelivr.net`, and `unpkg.com`. Stripe's JS SDK loads from `js.stripe.com` which is NOT in the allowed list.

If using a simple Payment Link (an `<a href="https://buy.stripe.com/xxx">` tag), NO CSP changes are needed because it is just a regular link.

**How to avoid:**
1. **Use a Payment Link (recommended).** No CSP changes needed. The donate button is an `<a>` tag that opens Stripe's hosted page in a new tab.
2. **If using Stripe.js embed, add to CSP:** `"script-src": [..., "https://js.stripe.com"]` and `"connect-src": [..., "https://api.stripe.com"]` and `"frame-src": [..., "https://js.stripe.com"]`.

**Phase to address:** Stripe implementation (should take 15 minutes with Payment Link approach).

**Confidence:** HIGH -- direct analysis of `server.js` CSP configuration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Priority |
|-------------|---------------|------------|----------|
| Bug fixes | Regressions in stable features (#8) | Fix before adding features, one bug per commit, manual regression checklist | P0 |
| Ken Burns | GPU memory leak on 24/7 device (#1) | Single animated element, force layer teardown, modest scale range | P0 |
| Ken Burns | Nausea from random motion (#9) | Predefined presets, never opposing consecutive motions, respect prefers-reduced-motion | P1 |
| Blur background | CPU/GPU overload on A9X (#2) | Blur a tiny image not full-res, or pre-blur server-side | P0 |
| Ken Burns + Blur | Triple-stack during transitions (#3) | Sequential transitions, stop old animation before starting new | P0 |
| Blur background | Double blob URL leak rate (#5) | Share blob URLs or use data URIs for background, audit cleanup | P1 |
| Overlays | Misposition in PWA fullscreen (#6) | Use env(safe-area-inset-*), test in actual PWA mode on iPad | P1 |
| Clock overlay | Timer leak across navigation (#11) | Clear interval on beforeunload, prefer rAF | P2 |
| Stripe | Overengineering a donate button (#7) | Payment Link, not full integration, 15-minute task | P1 |
| Stripe | CSP blocks Stripe.js (#13) | Use Payment Link (no CSP change needed) | P2 |
| Demo mode | Auth bypass vulnerability (#4) | Separate code path, separate photo storage, no API access | P0 |
| Config | New keys without migration (#10) | Add defaults to config.js before feature deploy | P1 |
| Deployment | Stale SW cache serves old HTML (#12) | Update CACHE_VERSION on every deploy | P1 |

## Integration Risks with Existing A/B Swap Pattern

The current `showSinglePhoto()` and `showDualPortraits()` functions in `slideshow.html` form the core of the display system. v1.1 features must integrate without breaking this pattern.

| Existing Pattern | v1.1 Feature | Integration Risk | Approach |
|------------------|-------------|-----------------|----------|
| `.photo.active` / `.photo.preload` class swap | Ken Burns | Ken Burns CSS class must work with both active and preload states | Add `.ken-burns` class alongside `.active`, remove on deactivation |
| `z-index: 0` (preload) / `z-index: 1` (active) | Background blur | Blur layer must be z-index BELOW photos (z-index: -1 or 0 with DOM ordering) | Insert blur elements before photo elements in DOM |
| `opacity: 0` -> `opacity: 1` transition (1s) | Ken Burns | Scale animation must not restart during opacity transition | Use separate CSS properties: opacity for crossfade, transform for Ken Burns |
| Blob URL cleanup after 1.5s timeout | Blur background | Background element must also be cleaned up | Extend cleanup selector or share blob URL |
| `createPhotoElement()` returns `<img>` | Blur background | Need to also create background element | Return both elements or create background in `showSinglePhoto()` |
| Dual portrait mode (two images side-by-side) | Ken Burns + Blur | Two photos + two backgrounds = 4 elements | Disable blur in dual mode, or use a single shared background |
| `displayMode` state variable | New config keys | Must not conflict with new toggle states | Keep display mode separate from effect toggles |

## Recovery Strategies

If these pitfalls are hit despite prevention:

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| GPU memory crash (#1) | LOW | Reduce scale range to 1.05, add memory watchdog, disable Ken Burns as last resort |
| Blur jank (#2) | LOW | Switch from CSS blur to tiny-image approach (code change, not architecture change) |
| Triple-stack crash (#3) | MEDIUM | Redesign transition choreography to be sequential (affects UX timing) |
| Demo auth bypass (#4) | HIGH if exploited | Emergency: disable demo mode. Fix: rewrite demo as isolated code path |
| Blob URL leak (#5) | LOW | Add cleanup for background elements, verify with DOM count monitoring |
| Overlay misposition (#6) | LOW | Add safe area CSS, test on device |
| Stripe overengineering (#7) | MEDIUM (wasted time) | Scrap integration code, replace with Payment Link |
| Regressions (#8) | MEDIUM | Git bisect to find breaking commit, revert, re-fix |
| Ken Burns motion sickness (#9) | LOW | Reduce motion range, add presets, respect prefers-reduced-motion |
| Config key mismatch (#10) | LOW | Update defaults, redeploy |
| Clock timer leak (#11) | LOW | Add cleanup handler |
| Stale SW cache (#12) | LOW | Update cache version, force SW update |
| CSP blocks Stripe (#13) | LOW | Use Payment Link instead of embed, or add CSP exception |

---

## Sources and Confidence Notes

**HIGH Confidence (verified in codebase):**
- All code path analysis (Pitfalls 4, 5, 7, 8, 10, 12, 13) -- based on direct reading of `slideshow.html`, `server.js`, `config.js`, `photo-proxy.js`, `auth.js`, `sw.js`
- A/B swap pattern integration risks -- based on direct analysis of `showSinglePhoto()` and `showDualPortraits()` implementations
- CSP configuration -- based on direct reading of helmet configuration in `server.js`
- Blob URL cleanup pattern -- based on direct reading of cleanup code in slideshow

**MEDIUM Confidence (training knowledge, needs on-device validation):**
- iOS 16.x Safari GPU compositing behavior (Pitfalls 1, 2, 3) -- well-documented in WebKit sources but exact performance thresholds on iPad Pro 1st Gen need testing
- `env(safe-area-inset-*)` behavior in PWA mode on iPad Pro 1st Gen (Pitfall 6)
- Stripe Payment Links feature set (Pitfall 7) -- should verify current Stripe docs

**LOW Confidence (needs further research):**
- Exact VRAM budget on A9X GPU for compositing layers -- the 21MB-per-layer estimate is based on 2732x2048x4 bytes but actual GPU allocation may differ
- Whether Safari on iOS 16.x uses GPU or CPU for `filter: blur()` on `<img>` elements -- varies by context and version

**Research limitations:** WebSearch and WebFetch were unavailable during this research session. All performance claims about iOS Safari should be validated against current Apple developer documentation and tested on the actual iPad Pro 1st Gen device.

---
*v1.1 pitfalls research for: Okno photo frame -- Ken Burns, blur, Stripe, demo mode*
*Researched: 2026-02-15*
*Codebase version: v1.0 (commit f7725e8)*
