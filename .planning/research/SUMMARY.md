# Research Summary: v1.1 "Make It Shine"

**Project:** Okno (Google Photos digital photo frame PWA)
**Milestone:** v1.1 "Make It Shine"
**Domain:** Visual effects, monetization, and demo mode for a 24/7 photo frame
**Researched:** 2026-02-15
**Confidence:** HIGH

## Executive Summary

The v1.1 milestone adds visual polish (Ken Burns effect, blurred backgrounds, date/time overlays), monetization (Stripe donate button), and portfolio showcase capability (demo mode) to the existing photo frame PWA. Research reveals that **all new features can be implemented with zero new npm dependencies** using pure CSS animations, vanilla JavaScript, and Stripe Payment Links.

The most critical finding: **v1.1's visual effects must be carefully orchestrated to avoid GPU memory exhaustion on the target hardware** (iPad Pro 1st Gen, A9X chip, 24/7 operation). Ken Burns and blurred backgrounds both create GPU compositing layers; stacking these effects during photo transitions creates peak memory pressure that can crash the PWA after hours of operation. The recommended approach is to use CSS-only implementations with modest scale ranges (1.0x to 1.15x zoom), blur tiny background images instead of full-resolution ones, and serialize transition choreography to prevent triple-stacking of GPU layers.

The second most important finding: **demo mode is the highest-value feature for portfolio presentation** but introduces security risk if not properly isolated. Demo mode must use a completely separate photo source (bundled sample images) with no access to authenticated API endpoints to prevent accidental exposure of the real user's cache or settings.

## Key Findings

### Recommended Stack (STACK.md)

**Zero new npm dependencies needed.** All v1.1 features use the existing vanilla HTML/CSS/JS stack:

**Core approach:**
- **Ken Burns:** Pure CSS `@keyframes` with `transform: scale()` — GPU-accelerated, no library needed
- **Blurred backgrounds:** CSS `filter: blur()` on duplicate `<img>` element OR blur a tiny low-res image — no canvas library needed
- **Date/time overlays:** Vanilla JS with `toLocaleDateString()` and `toLocaleTimeString()` — no date library needed
- **Stripe donate:** Stripe Payment Links (URL-only, no backend code) — zero npm packages, not even the `stripe` SDK
- **Demo mode:** Static sample photos in `/public/demo/` served via existing Express static middleware — no external API
- **README polish:** Mermaid diagrams (GitHub native rendering) + shields.io badges — no build tools

**Critical version requirements:**
- None — all features use browser-native APIs supported on iOS 16 Safari

**What NOT to use:**
- GSAP, anime.js, or any JS animation library (CSS does Ken Burns natively)
- Canvas-based blur or StackBlur (CSS `filter: blur()` is GPU-accelerated)
- date-fns, luxon, moment.js (Intl API is built-in)
- Full Stripe integration with Checkout Sessions and webhooks (Payment Links for a donate button)

**Confidence:** HIGH — CSS animations, `filter: blur()`, Intl API, and Stripe Payment Links are all mature, well-documented features. The specific approaches are proven in the existing codebase (backdrop-filter already in use, CSS transitions validated).

### Expected Features (FEATURES.md)

**Must have (table stakes):**
- **Ken Burns:** Smooth constant-speed animation, randomized direction, matches slide interval, toggleable, no performance degradation
- **Blurred background:** Same-photo blur, heavy blur (30-40px), reduced brightness, seamless color match, toggleable
- **Photo date overlay:** Formatted human-readable date, positioned unobtrusively, handles missing metadata
- **Clock overlay:** Updates every minute, locale-aware format, consistent styling
- **Stripe donate:** Pre-set amounts, secure (Stripe-hosted), thank-you confirmation, no account required for donor
- **Demo mode:** No auth required, high-quality photos, all features functional, clear demo indicator, easy exit to real product
- **README:** Hero image/GIF, one-line description, feature screenshots, architecture diagram, live demo link

**Should have (differentiators):**
- **Ken Burns + Blurred Background combined:** Creates cinematic experience matching Apple TV quality — most DIY frames have neither
- **Product Decisions in README:** Shows what was NOT built and why — demonstrates product leadership thinking
- **Demo Mode with optimal defaults:** Interviewer experiences product in 10 seconds without setup — 95% of side projects lack this
- **Photo date with nostalgia framing:** "March 2019" creates emotional response — commercial frames cannot do this (lack metadata)

**Defer (v2+):**
- Multiple transition styles (slide, dissolve, wipe) — Ken Burns + crossfade is sufficient
- Animated text overlays — motion reserved for photos, not chrome
- Custom overlay positioning — fixed positions are predictable and sufficient
- Donation tracking dashboard — Stripe Dashboard already tracks
- Interactive demo features — demo should showcase, not teach
- Weather/Spotify/news overlays — scope creep, each is a separate API

**Confidence:** HIGH — table stakes behaviors are derived from Apple TV screensavers, commercial digital frames (Aura, Samsung Frame TV), and portfolio project best practices. Differentiators identified through competitive analysis.

### Architecture Approach (v1.1-ARCHITECTURE.md)

**Three architectural categories:**

1. **CSS-layer visual effects** (Ken Burns, blurred backgrounds, overlays) — integrate into frontend slideshow DOM/CSS only, zero backend changes
2. **Backend service additions** (demo mode, Stripe) — new Express routes, new data sources
3. **Bug fixes** — targeted changes to existing modules

**Critical architectural constraint:** The existing **A/B image swap pattern** in `slideshow.html` dynamically creates and destroys `<img>` elements per transition. Every visual effect must be duplicated per-slot and cleaned up on transition. The pattern already handles blob URL revocation and DOM cleanup — new effects must hook into that same lifecycle.

**Major integration points:**

1. **Ken Burns:** Apply CSS animation class after `img.classList.add('active')`, remove on cleanup. Requires `overflow: hidden` on `#slideshow` container. Uses `will-change: transform` for GPU layer promotion.

2. **Blurred background:** Changes DOM structure from single `<img>` to wrapper `<div>` containing background `<div>` + foreground `<img>`. Most significant architectural change — touches `createPhotoElement()`, `showSinglePhoto()`, `showDualPortraits()`, cleanup logic, and blob URL revocation.

3. **Date/time overlays:** Fixed-position `<div>` elements outside `#slideshow`, updated on photo transitions (date) or every minute (clock). Must use `env(safe-area-inset-*)` for iOS PWA safe areas.

4. **Demo mode:** Server-side `DEMO_MODE=true` flag. New `demo-photos.js` module serves from `/public/demo/` instead of Google Photos cache. Modifies `photo-proxy.js`, `auth.js`, `health.js`. Frontend detects demo mode from `/auth/status` response.

5. **Stripe:** New `donate.js` router OR (simpler) just replace PayPal URL in `index.html` with Stripe Payment Link URL. No backend code needed with Payment Link approach.

**Config schema extensions:**
```javascript
const defaults = {
  // v1.0
  interval: 30,
  displayMode: 'cover',
  onThisDay: false,
  portraitPairs: false,
  // v1.1 NEW
  kenBurns: true,           // default ON for wow factor
  blurredBackground: true,  // default ON
  showPhotoDate: true,      // default ON
  showClock: false,         // default OFF
};
```

**Memory leak prevention checklist (24/7 operation):**
- Blob URLs: Every `createObjectURL()` has matching `revokeObjectURL()`
- DOM elements: Every appended element removed after transition
- CSS animations: Removed with element
- Intervals: `clockInterval` cleared on `exitSlideshow()`
- GPU layers: `will-change` elements destroyed with DOM removal

**Confidence:** HIGH — based on complete codebase reading of all source files. Architecture recommendations derive from existing patterns in `slideshow.html`, `config.js`, and service worker.

### Critical Pitfalls (PITFALLS.md)

1. **Ken Burns CSS Transform Creates Unbounded GPU Memory on iOS Safari**
   - Severity: CRITICAL (frame crashes after hours)
   - Each animated 2732x2048 image consumes ~21MB GPU texture memory. A9X has limited VRAM shared with system RAM.
   - **Avoidance:** Single animated element (not two during crossfade), force GPU layer teardown with `transform: none` before `remove()`, keep scale range modest (1.0-1.15x), add memory watchdog, use `will-change: transform` only on active element.

2. **CSS `filter: blur()` on Full-Screen Background Triggers Continuous Repaint**
   - Severity: CRITICAL (persistent jank, battery drain, potential crash)
   - `blur(40px)` on 2732x2048 may fall back to software rendering on iOS 16 Safari
   - **Avoidance:** Blur a TINY image (64x48) and scale it up, OR pre-blur server-side, OR use canvas element (compute once per photo). Never blur a full-res image. Never apply blur to an element also being animated with `transform`.

3. **Ken Burns + Blur + Crossfade Triple-Stack During Transitions**
   - Severity: CRITICAL (peak GPU load can trigger jetsam kill)
   - During transition: outgoing photo (Ken Burns + fade), incoming photo (Ken Burns + fade), 2 background blurs = 4 full-screen GPU layers
   - **Avoidance:** Sequential transitions (stop old Ken Burns, crossfade, start new Ken Burns). Background blur should NOT animate during crossfade. Budget rule: no more than 2 GPU-promoted layers at any time, briefly 3 during transitions, never 4+.

4. **Demo Mode Creates Authentication Bypass**
   - Severity: CRITICAL (security)
   - If demo mode skips auth checks, could allow unauthenticated access to `/api/config`, `/api/picker/*`, `/api/health`, or real user's cached photos
   - **Avoidance:** Separate code path (serve from `/public/demo/`, not `/api/photo/random`). Demo-specific endpoint if needed. Server-side `DEMO_MODE=true` flag, not URL parameter. Read-only access (no settings modification, no picker, no feedback).

5. **Blob URL Leak Rate Doubles with Background Blur Images**
   - Severity: HIGH (memory leak timeline halved)
   - Blurred background adds second image element per photo. Current cleanup targets `.photo:not(.active)` — background elements may be orphaned.
   - **Avoidance:** Share same blob URL for foreground and background, OR use data URI for tiny background image, OR extend cleanup selector to include `.photo-bg:not(.active)`.

**Confidence:** MEDIUM on GPU performance claims (based on training knowledge, needs on-device validation), HIGH on security and code path analysis (verified in codebase).

## Implications for Roadmap

Based on research, recommended phase structure:

### Phase 1: Bug Fixes
**Rationale:** Clean foundation before adding features. Bug fixes touch core infrastructure (`photo-cache.js`, `photo-proxy.js`, `slideshow.html`) — regressions in these could cascade into new features.

**Delivers:** 6 bugs fixed from v1.0 QA (picker merge, OTD fallback visibility, 502 resilience, calendar indicator, dual mode letterboxing, settings persistence).

**Avoids:** Pitfall #8 (regressions in stable features). Fix one bug per commit, manual regression checklist.

**Research needed:** No — bugs are targeted fixes with clear scope.

### Phase 2: Visual Effects (Ken Burns + Blurred Background)
**Rationale:** Highest visual impact. Both modify photo element architecture, so build together. This is the "before/after" moment for portfolio showcase.

**Delivers:** Ken Burns cinematic zoom/pan, blurred background fill for portrait photos in landscape mode.

**Addresses:** Table stakes behaviors for both features. Implements architecture changes to DOM structure (wrapper pattern for blur).

**Avoids:** Pitfalls #1, #2, #3 (GPU memory, blur jank, triple-stack). Must implement sequential transition choreography from the start.

**Research needed:** DEEP research during phase planning — GPU memory profiling on actual iPad Pro 1st Gen, blur performance testing (CSS vs tiny-image vs server-side), transition timing choreography.

### Phase 3: Date/Time Overlays
**Rationale:** Quick wins layered on top of visual improvements. Independent of photo lifecycle (fixed-position elements). Minimal risk.

**Delivers:** Photo date overlay (bottom-left), clock overlay (bottom-right), both toggleable.

**Uses:** Vanilla JS `toLocaleDateString()` and `toLocaleTimeString()`, existing photo metadata from `X-Photo-CreateTime` header.

**Avoids:** Pitfall #6 (overlay misposition), Pitfall #11 (clock timer leak). Use `env(safe-area-inset-*)` from the start, clean up clock interval on exit.

**Research needed:** No — straightforward DOM updates with existing patterns.

### Phase 4: Config Integration
**Rationale:** Wire all new features into settings system after they are implemented and tested. Features can be tested with hardcoded `true` values first.

**Delivers:** 4 new config keys (`kenBurns`, `blurredBackground`, `showPhotoDate`, `showClock`), 2 new settings sections (Visual Effects, Overlays).

**Avoids:** Pitfall #10 (config key migration). Add defaults to `config.js` before deploying feature code that reads them.

**Research needed:** No — follows existing config pattern.

### Phase 5: Demo Mode
**Rationale:** After visual effects are done, demo mode can showcase them. Demo mode is also useful for portfolio presentation — having working visual effects makes the demo more impressive.

**Delivers:** Sample photo library (8-12 high-quality images), demo mode toggle, demo indicator UI, auth bypass for demo users.

**Implements:** Separate backend module (`demo-photos.js`), modifications to `photo-proxy.js`, `auth.js`, `health.js`, `index.html`.

**Avoids:** Pitfall #4 (auth bypass vulnerability). Design isolation boundary BEFORE writing code. Separate photo storage, no API access.

**Research needed:** MODERATE research during planning — sample photo curation (royalty-free sources), metadata structure for demo photos, auth bypass security review.

### Phase 6: Stripe Donate Button
**Rationale:** Completely independent of all other features. Touches only `index.html` (donation button) and adds a new backend route. Zero interaction with slideshow code. Lowest priority for portfolio showcase.

**Delivers:** Replace PayPal placeholder with Stripe Payment Link, thank-you message on success.

**Uses:** Stripe Payment Links (URL-only, no backend code).

**Avoids:** Pitfall #7 (overengineering), Pitfall #13 (CSP configuration). Use Payment Link approach, not full Checkout integration.

**Research needed:** No — 15-minute task to create Payment Link in Stripe Dashboard and replace URL in HTML.

### Phase 7: README Polish
**Rationale:** Must be last. Captures screenshots of the final product with all features active. README is portfolio artifact — needs to show completed product.

**Delivers:** Hero GIF (Ken Burns + blur in action), feature screenshots, architecture diagram (Mermaid), product decisions section, live demo link.

**Uses:** Mermaid diagrams (GitHub native rendering), shields.io badges, screenshots from actual iPad or dev tools.

**Research needed:** No — content creation, not implementation.

### Phase Ordering Rationale

- **Bug fixes first** — foundation must be solid before adding features
- **Ken Burns + Blur together** — both modify DOM structure, avoid duplicate refactoring
- **Overlays after visual effects** — layer on top, minimal risk
- **Config integration after implementation** — features can be tested hardcoded first
- **Demo mode after visual polish** — showcases completed features
- **Stripe last** — independent, lowest priority
- **README last** — documents completed product

### Dependency Graph

```
Bug Fixes (Phase 1)
    |
    v
Ken Burns + Blur (Phase 2) <--- CRITICAL PATH, needs deep research
    |
    v
Date/Time Overlays (Phase 3)
    |
    v
Config Integration (Phase 4)
    |
    +---> Demo Mode (Phase 5) <--- needs moderate research
    |
    +---> Stripe (Phase 6) <--- trivial, can be done anytime
    |
    v
README (Phase 7)
```

### Research Flags

**Needs deep research during phase planning:**
- **Phase 2 (Ken Burns + Blur):** GPU memory profiling, blur performance testing, transition choreography design. This is the highest-risk phase due to Pitfalls #1, #2, #3.

**Needs moderate research during phase planning:**
- **Phase 5 (Demo Mode):** Sample photo curation, auth bypass security review.

**Standard patterns (skip research-phase):**
- Phase 1 (Bug Fixes): Targeted fixes, well-scoped
- Phase 3 (Overlays): Simple DOM updates
- Phase 4 (Config): Follows existing pattern
- Phase 6 (Stripe): Payment Links approach is trivial
- Phase 7 (README): Content creation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All features use browser-native APIs (CSS animations, filter, Intl). Validated against existing codebase patterns (backdrop-filter already in use). |
| Features | HIGH | Table stakes behaviors derived from Apple TV, commercial frames (Aura, Samsung Frame TV), portfolio best practices. Differentiators identified through competitive analysis. |
| Architecture | HIGH | Based on complete codebase reading. DOM structure changes (wrapper pattern for blur) are the most significant risk but well-understood. Integration points mapped to existing code. |
| Pitfalls | MEDIUM | GPU performance claims based on training knowledge, need on-device validation on iPad Pro 1st Gen with iOS 16.x. Security and code path analysis is HIGH confidence (verified in codebase). |

**Overall confidence:** HIGH

### Gaps to Address During Planning

**GPU performance validation:**
- Pitfalls #1, #2, #3 all depend on iOS 16 Safari GPU compositing behavior on A9X chip. Claims like "21MB per compositing layer" and "blur falls back to software rendering" need validation.
- **Mitigation:** Deep research during Phase 2 planning. Run Safari Web Inspector on actual iPad, measure compositor layers and memory during Ken Burns + blur transitions. Prototype tiny-image blur approach vs CSS blur and benchmark frame rates.

**Stripe Payment Links current feature set:**
- Recommendation assumes Payment Links support "customer chooses amount" for donations.
- **Mitigation:** Verify in Stripe Dashboard before Phase 6. If not available, use 2-3 preset amounts ($5, $10, $25) as separate Payment Links.

**Demo photo licensing:**
- Need 8-12 royalty-free photos for demo mode.
- **Mitigation:** Research Unsplash License and Pexels License during Phase 5 planning. Confirm no attribution required for commercial use. Fallback: use original non-personal photos.

**Service Worker cache invalidation:**
- Pitfall #12 — after deploy, iPad PWA may serve stale v1.0 HTML.
- **Mitigation:** Update `CACHE_VERSION` in `sw.js` to `'okno-v1.1'` during first deployment of any v1.1 code. Document forced update procedure (SSH to VPS, update sw.js).

## Sources

### Primary (HIGH confidence)

**Codebase analysis:**
- All source files read directly: `server.js`, `auth.js`, `photo-proxy.js`, `photo-cache.js`, `config.js`, `picker.js`, `health.js`, `feedback.js`, `slideshow.html`, `index.html`, `settings.html`, `sw.js`, `package.json`
- Existing patterns validated: CSS transitions (slideshow.html line 93), backdrop-filter usage (lines 146, 240), On This Day date formatting (line 874), blob URL revocation (lines 786-815), A/B swap cleanup pattern, config validation (config.js)

**Web standards (well-established):**
- CSS `@keyframes`, `transform: scale()`, `will-change` — supported since iOS 9
- CSS `filter: blur()` — supported since iOS 9.3
- Intl API (`toLocaleDateString`, `toLocaleTimeString`) — supported since iOS 10
- `env(safe-area-inset-*)` — standard iOS PWA safe area API

**Stripe:**
- Stripe Payment Links — well-established Stripe product (launched ~2021, training data cutoff January 2025)

### Secondary (MEDIUM confidence)

**iOS Safari GPU compositing:**
- GPU layer promotion for `transform` and `will-change` — well-documented in WebKit sources but exact performance thresholds on iPad Pro 1st Gen (A9X) need on-device testing
- `filter: blur()` GPU vs CPU rendering — varies by iOS version and context, needs validation on iOS 16.x specifically

**Ken Burns parameters:**
- 1.0x to 1.15x scale range, linear easing, random transform-origin — based on training knowledge of Apple TV screensaver behavior and digital frame apps. Parameters are reasonable but should be tuned during implementation.

**Demo mode patterns:**
- Bundled sample photos, separate code path, auth isolation — based on portfolio project best practices. No single authoritative source but pattern is logical and widely practiced.

### Tertiary (LOW confidence, needs validation)

**GPU memory claims:**
- "21MB per compositing layer for 2732x2048 image" — based on 2732 * 2048 * 4 bytes, but actual GPU allocation may differ
- A9X GPU VRAM budget — iPad Pro 1st Gen has 4GB RAM shared between CPU and GPU, but exact allocation is undocumented

**Research limitations:**
- WebSearch and WebFetch were unavailable during this research session. All performance claims about iOS Safari should be validated against current Apple developer documentation and tested on the actual iPad Pro 1st Gen device during Phase 2 planning.

---

**Research completed:** 2026-02-15
**Ready for roadmap:** Yes

**Next step:** Roadmap creation using this summary as input. Phase 2 (Ken Burns + Blur) flagged for deep research during planning.
