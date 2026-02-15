# Feature Research: v1.1 "Make It Shine"

**Domain:** Visual polish, monetization, and demo mode for a self-hosted digital photo frame
**Researched:** 2026-02-15
**Confidence:** HIGH for CSS animation techniques (well-understood domain), MEDIUM for Stripe integration (training data, not verified against latest docs), MEDIUM for demo mode patterns (design patterns, no single authoritative source)

**Context:** v1.0 is shipped and functional. This research covers the six NEW feature areas for v1.1: Ken Burns effect, blurred background fill, date/time overlays, Stripe donate button, demo mode, and README polish. The existing slideshow uses vanilla HTML/CSS/JS with `<img>` elements, CSS opacity transitions, and an A/B swap pattern.

---

## 1. Ken Burns Effect

### What It Is

The Ken Burns effect is a slow, continuous pan-and-zoom animation applied to still photographs, named after documentary filmmaker Ken Burns who popularized it. The effect gives static images a cinematic quality by slowly zooming in or out while optionally panning across the image. Apple TV screensavers, Google Photos Memories, and premium digital frames all use this technique.

### Table Stakes (Expected behavior when this feature exists)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Smooth, constant-speed animation | Jerky movement destroys the cinematic feel. Users associate Ken Burns with "slow and dreamy." | Use `linear` or gentle easing like `ease-in-out`. Never `ease` alone (jarring start). |
| Animation duration matches slide interval | If photos change every 30s, the Ken Burns should run for the full 30s. Mismatched timing creates abrupt stops. | Dynamically set CSS `transition-duration` or `animation-duration` to match `currentIntervalSeconds`. |
| Randomized direction per photo | Same zoom direction every time feels robotic. Each photo should get a randomly chosen zoom/pan combination. | Pick from a set of presets: zoom-in-center, zoom-in-top-left, zoom-out-center, pan-left-to-right, etc. |
| Works with both object-fit modes | Must work in `cover` mode (already zoomed to fill) and `contain` mode (full photo with bars). | In `contain` mode, Ken Burns zoom must not exceed the viewport -- or better, use a wrapper `div` with `overflow: hidden`. |
| Toggle on/off | Users may find the motion distracting, especially for a bedroom frame. Must be configurable via settings. | Add `kenBurns: boolean` to config schema. Already have toggle pattern from `onThisDay` and `portraitPairs`. |
| No performance degradation on iPad | CSS transforms are GPU-accelerated but memory-intensive if misused. iPad Pro 1st Gen has limited GPU budget. | Use `transform: scale()` only (GPU-composited). Never animate `width`/`height` or `background-size` (causes layout reflow). |

### Recommended Implementation

**Technique:** CSS `transform: scale()` with `transform-origin` randomization, applied via CSS animation.

**Parameters (industry standard from Apple TV, Google Photos, commercial frames):**

| Parameter | Recommended Value | Range | Notes |
|-----------|-------------------|-------|-------|
| Zoom range | 1.0x to 1.15x (zoom in) or 1.15x to 1.0x (zoom out) | 1.05x - 1.25x max | Beyond 1.2x looks like an error, not a cinematic effect. Apple TV uses ~1.1x. |
| Animation duration | Match slide interval (e.g., 30s) | 10s - 300s | Must equal `currentIntervalSeconds` to fill the full display time. |
| Easing | `linear` or `cubic-bezier(0.25, 0.1, 0.25, 1.0)` | -- | `linear` is most common for Ken Burns. Subtle easing at start/end is acceptable. |
| Transform origin | Random per photo from preset list | 9 positions (3x3 grid) | `top left`, `top center`, `top right`, `center left`, `center`, `center right`, `bottom left`, `bottom center`, `bottom right` |
| Direction | Random: zoom-in OR zoom-out | -- | Mix of both feels most natural. 50/50 split or slight bias toward zoom-in. |

**Preset Combinations (pick one randomly per photo):**

```
Preset 1: scale(1.0) -> scale(1.15), origin: top left       (zoom into top-left)
Preset 2: scale(1.15) -> scale(1.0), origin: center          (zoom out from center)
Preset 3: scale(1.0) -> scale(1.15), origin: bottom right    (zoom into bottom-right)
Preset 4: scale(1.0) -> scale(1.12), origin: center left     (zoom into left side)
Preset 5: scale(1.12) -> scale(1.0), origin: top center      (zoom out from top)
Preset 6: scale(1.0) -> scale(1.15), origin: center right    (zoom into right side)
```

**CSS approach (preferred for performance):**

```css
@keyframes kenburns-in {
  from { transform: scale(1.0); }
  to   { transform: scale(1.15); }
}

@keyframes kenburns-out {
  from { transform: scale(1.15); }
  to   { transform: scale(1.0); }
}

.photo.kenburns {
  animation-name: kenburns-in; /* or kenburns-out, set via JS */
  animation-duration: 30s;     /* set dynamically to match interval */
  animation-timing-function: linear;
  animation-fill-mode: forwards;
  transform-origin: top left;  /* set randomly via JS */
}
```

**JS integration with existing code:**

The existing `createPhotoElement()` creates `<img>` elements. Add Ken Burns by:
1. Wrap `<img>` in a `<div>` with `overflow: hidden` (prevents zoom from exceeding container)
2. Apply animation class to the `<img>` after it becomes `.active`
3. Set `animation-duration` to match `currentIntervalSeconds`
4. Randomize `transform-origin` and `animation-name` (in/out) via inline style

**Critical: overflow: hidden wrapper is mandatory.** Without it, the 1.15x scale causes the image to overflow the viewport, creating visible edges or scrollbars. The wrapper clips the zoom cleanly.

### Interaction with Existing Features

| Feature | Interaction | Resolution |
|---------|-------------|------------|
| Crossfade transitions | Ken Burns must continue during crossfade. The outgoing photo keeps its animation while fading out. | Animation runs independently of opacity transition. No conflict. |
| Dual portrait mode | Each portrait in a pair needs its own independent Ken Burns animation. | Apply animation to each `<img>` individually, not the container. Random origin per image. |
| Display mode: contain | In `contain` mode, the photo has black bars. Ken Burns zoom would reveal the bars moving. | When `contain` mode + Ken Burns: switch to `cover` for the `<img>` inside the overflow wrapper. The wrapper is sized to the viewport, the image fills it, and Ken Burns zooms within. This is the standard approach. |
| Blurred background | Both Ken Burns and blurred background are `transform`-based. | Apply Ken Burns only to the foreground image, not the background blur layer. |

### Edge Cases

- **Very short intervals (10s):** Ken Burns at 10s duration is fast and may feel jarring. Consider a minimum duration floor (15s) or reducing zoom range at short intervals (1.0x to 1.08x).
- **Very long intervals (300s):** At 5 minutes, the zoom is so slow it is almost invisible. This is fine -- it is still more alive than a static image.
- **Portrait photos in landscape frame:** Ken Burns can emphasize the pan direction (horizontal pan across a vertical photo). This is a differentiator -- most frames do not adjust Ken Burns direction based on photo orientation.

### Complexity Assessment

**LOW.** Pure CSS animation with JS randomization. No new dependencies. No backend changes. The existing `<img>` element pattern supports this directly. The main complexity is the `overflow: hidden` wrapper and coordinating animation duration with the slide interval.

---

## 2. Blurred Background Fill

### What It Is

Instead of showing black bars (letterboxing) when a photo does not match the display aspect ratio, show a blurred, dimmed copy of the same photo as the background. The sharp photo displays at correct aspect ratio in the center, with a soft, ambient version of itself filling the remaining space. Aura frames, Samsung Frame TV, and premium digital frame apps all use this technique.

### Table Stakes (Expected behavior when this feature exists)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Seamless color match | The background must be the same photo (not a solid color or different image). Users instantly notice color mismatch. | Use the same `<img>` source twice: one sharp foreground, one blurred background. |
| Heavy blur (not subtle) | Background must be unrecognizable as a photo. It should feel like ambient color, not a duplicate image. | `filter: blur(40px)` minimum. 30-50px is the standard range. Below 20px, details are visible and distracting. |
| Reduced brightness | Background must be noticeably darker than the foreground photo to create depth separation. | `filter: blur(40px) brightness(0.5)` or `brightness(0.4)`. Without dimming, the background competes with the foreground. |
| Scale up to fill | The blurred background must fill the entire viewport with no gaps. Blur causes edge softening, so the background image must be scaled beyond 100%. | `transform: scale(1.3)` on the background image ensures blurred edges do not reveal the viewport boundary. |
| Transition with photo changes | Background must crossfade in sync with the foreground photo. Mismatched timing creates a flash of wrong color. | Both foreground and background images transition together as a unit. Use a wrapper `<div>` for each photo that contains both layers. |
| Toggle on/off | Some users prefer black bars (cleaner look, lower distraction). Must be configurable. | Add `blurredBackground: boolean` to config. When off, revert to current `object-fit: contain` behavior. |
| Works with all photo orientations | Landscape photos on landscape screen have minimal bars (top/bottom). Portrait photos have large bars (left/right). Both need blurred fill. | Background always fills viewport regardless of foreground orientation. |

### Recommended Implementation

**Architecture change:** Currently, each photo is a single `<img>` element. With blurred background, each photo becomes a `<div>` containing two `<img>` elements:

```html
<!-- Current: single img -->
<img class="photo active" src="blob:..." style="object-fit: cover;">

<!-- Proposed: wrapper with background + foreground -->
<div class="photo-wrapper active">
  <img class="photo-bg" src="blob:..." />    <!-- blurred background -->
  <img class="photo-fg" src="blob:..." />    <!-- sharp foreground -->
</div>
```

**CSS:**

```css
.photo-wrapper {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  overflow: hidden;
  opacity: 0;
  transition: opacity 1s ease-in-out;
}

.photo-wrapper.active {
  opacity: 1;
  z-index: 1;
}

.photo-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  filter: blur(40px) brightness(0.45) saturate(1.2);
  transform: scale(1.3); /* prevent blur edge reveal */
  z-index: 0;
}

.photo-fg {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: contain; /* show full photo, no crop */
  z-index: 1;
}
```

**Key detail: same blob URL for both images.** The browser caches the blob in memory, so using the same `blob:` URL for both `<img>` elements does NOT double the network transfer. Memory cost is minimal since the GPU handles the blur filter.

**Saturation boost:** Adding `saturate(1.2)` to the background filter slightly enriches colors, making the ambient background feel warm rather than washed out. This is a subtle premium touch used by Aura.

### Interaction with Ken Burns

When both Ken Burns and blurred background are active:
- **Foreground photo:** Gets Ken Burns animation (scale + transform-origin)
- **Background photo:** Should NOT get Ken Burns. It should remain static and blurred. Animating the background creates motion sickness.
- The `overflow: hidden` on the wrapper clips Ken Burns zoom on the foreground while the background stays full-bleed.

### Interaction with Display Modes

| Current Mode | Blurred Background Behavior |
|--------------|----------------------------|
| `cover` (fill screen) | Blurred background is redundant (photo already fills screen). Do not show background layer. Or show it but foreground also fills -- effectively no visible change. **Recommendation: skip background layer in cover mode to save GPU.** |
| `contain` (full photo, black bars) | This is the primary use case. Background fills where bars would be. |
| `dual` (portrait pairs) | Each portrait photo in the pair could have its own blurred background behind it, or a single blurred composite. **Recommendation: skip blurred background in dual mode -- the two photos already fill most of the screen.** |

### Performance Considerations (iPad Pro 1st Gen)

- `filter: blur()` is GPU-composited in Safari. Performance is generally good.
- The 40px blur radius is within the comfortable range for mobile GPUs. Beyond 80px, some devices show frame drops.
- `transform: scale(1.3)` is GPU-accelerated. No layout cost.
- Two `<img>` elements per photo instead of one doubles the DOM element count. With the existing A/B swap cleanup pattern, at most 4 `<img>` elements are in the DOM at once (2 per photo x 2 photos during transition). This is well within iPad capabilities.
- **Potential concern:** If Ken Burns is also active, the foreground image has an animation running while the background has blur. That is 3 active GPU operations per photo (blur, scale, animation). Monitor for frame drops on actual iPad during testing.

### Complexity Assessment

**LOW-MEDIUM.** The CSS is straightforward but the architectural change from single `<img>` to wrapper `<div>` with two `<img>` elements touches the core `showSinglePhoto()` and `showDualPortraits()` functions. The A/B swap cleanup logic needs updating to remove wrapper divs instead of bare img tags. Blob URL revocation needs to handle two URLs per photo (though they are the same blob).

---

## 3. Date/Time Overlays

### What It Is

Semi-transparent text overlays on the slideshow showing:
1. **Photo date:** When the displayed photo was taken (e.g., "March 14, 2021" or "Mar 2021")
2. **Current clock:** Current time (e.g., "2:45 PM" or "14:45")

These serve different purposes: photo date creates nostalgia ("Oh, that was three years ago!"), while the clock makes the frame a dual-purpose ambient display.

### 3a. Photo Date Overlay

#### Table Stakes

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Formatted date, not raw timestamp | "March 14, 2021" not "2021-03-14T08:30:00Z". Human-readable is essential. | Use `toLocaleDateString()` with appropriate options. |
| Positioned unobtrusively | Must not cover the main subject of the photo. Bottom-left or bottom-right corner is standard. | Bottom-left is most common in photo frame apps. Avoid center or top (conflicts with On This Day indicator). |
| Semi-transparent background | Text alone is unreadable against bright photos. A dark pill/badge behind the text ensures legibility. | `background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(8px);` |
| Fade in/out with photo | Overlay must transition with the photo, not appear abruptly or persist between photos. | Overlay is part of the photo wrapper `<div>`, so it inherits the opacity crossfade. |
| Toggle on/off independently | Users may want clock but not photo date, or vice versa. | Separate config toggle: `photoDateOverlay: boolean` |
| Handle missing dates gracefully | Some photos may lack `createTime` metadata. Do not show "Invalid Date" or "undefined". | If `createTime` is missing or invalid, hide the overlay for that photo. |

#### Data Source

The `createTime` is already available:
- Backend sends it as `X-Photo-CreateTime` response header (see `photo-proxy.js` line 107)
- Frontend stores it as `img.dataset.createTime` (see `slideshow.html` line 751)
- The On This Day indicator already parses and displays it (`updateOnThisDayIndicator()`)

No backend changes needed. The data pipeline already exists.

#### Recommended Format

| Context | Format | Example |
|---------|--------|---------|
| Default | Month + Year | "March 2021" |
| On This Day mode | Full date with year | "March 14, 2019" |
| With clock overlay | Month + Year (compact) | "Mar 2021" |

**Recommendation: "Month Year" format** (e.g., "March 2021"). Full date (day) adds clutter without proportional value for random slideshow. The year is the emotional payload -- seeing "2018" triggers memories more than seeing "March 14."

#### Position

```
+--------------------------------------------------+
|  [On This Day indicator]                          |
|                                                    |
|                                                    |
|                    [PHOTO]                          |
|                                                    |
|                                                    |
|  [Photo date: "March 2021"]    [Clock: "2:45 PM"] |
+--------------------------------------------------+
```

Bottom-left for photo date, bottom-right for clock. Both use consistent pill style. This avoids conflict with the existing On This Day indicator (top-left) and control buttons (bottom-right when visible, but auto-hidden).

### 3b. Clock Overlay

#### Table Stakes

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Updates every minute | Clock must stay current. Stale time is worse than no clock. | `setInterval` at 60-second intervals. Update DOM text only, no re-render. |
| 12-hour or 24-hour format | Respect user/locale preference. | Use `toLocaleTimeString()` which respects device locale. Or provide a toggle. |
| Consistent style with photo date | Both overlays should look like they belong together. Same font, size, pill style. | Shared CSS class for overlay pills. |
| Does not interfere with sleep modes | Clock should not prevent the screen from sleeping if a sleep schedule is implemented later. | Clock is purely cosmetic DOM update. No wake lock implications. |
| Toggle on/off independently | Separate from photo date overlay. | `clockOverlay: boolean` in config. |

#### Implementation

```html
<!-- Inside the slideshow container, fixed position -->
<div id="clockOverlay" class="slideshow-overlay bottom-right">
  <span id="clockTime">2:45 PM</span>
</div>

<div id="photoDateOverlay" class="slideshow-overlay bottom-left">
  <span id="photoDate">March 2021</span>
</div>
```

```css
.slideshow-overlay {
  position: fixed;
  z-index: 50;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  padding: 8px 16px;
  border-radius: 10px;
  pointer-events: none;
  transition: opacity 0.5s;
}

.slideshow-overlay.bottom-left {
  bottom: 1.5rem;
  left: 1.5rem;
}

.slideshow-overlay.bottom-right {
  bottom: 1.5rem;
  right: 1.5rem;
}
```

**Design note:** The overlay style should match the existing On This Day indicator (`background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(12px); border-radius: 10px;`). Consistent visual language across all overlays.

### Complexity Assessment

**LOW.** Both overlays are simple DOM elements with CSS positioning. Photo date data already flows through the system. Clock is a trivial `setInterval`. The only complexity is ensuring overlays hide when controls are visible (to avoid visual clutter), and show/hide based on config toggles.

---

## 4. Stripe Donate Button

### What It Is

A payment button allowing visitors to make one-time donations ("tips") to support development. The project context specifies using an existing Stripe account (moonacle). This replaces the current placeholder PayPal link in the feedback modal.

### Table Stakes (Expected behavior for a donate button)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Pre-set amount options | Users do not want to think about how much. Provide 3-4 options. | Standard pattern: $5, $10, $25, custom. Three specific amounts plus a custom field. |
| Secure payment flow | Users must feel safe entering payment info. Stripe's hosted checkout handles this. | Never collect card details on your own page. Use Stripe Checkout (hosted) or Payment Links. |
| Thank you confirmation | After payment, show a warm confirmation message. Do not just redirect to a blank page. | Stripe Checkout has `success_url` parameter. Redirect to a thank-you page or back to the app with a success state. |
| No account required for donor | Do not force donors to create an account. One-time payment should be frictionless. | Stripe Checkout supports guest checkout by default. |
| Mobile-friendly | The donate flow must work on phones and tablets. | Stripe Checkout is fully responsive. No additional work needed. |
| Minimal backend footprint | This is a personal project, not a SaaS. Do not over-engineer payment infrastructure. | Use Stripe Payment Links (zero backend) or Stripe Checkout with one server endpoint. |

### Recommended Approach: Stripe Payment Links (Simplest)

**Stripe Payment Links** are pre-built, hosted payment pages that require ZERO backend code. You create them in the Stripe Dashboard and get a URL. No API keys on your server, no webhook handling, no checkout session creation.

**How it works:**
1. Create 3-4 Payment Links in Stripe Dashboard (one per amount: $5, $10, $25)
2. Each link is a URL like `https://buy.stripe.com/xxxxxxxxxxxx`
3. Frontend opens the link in a new tab or redirects
4. Stripe handles everything: payment form, processing, receipt
5. Donor is redirected to a `success_url` you specify (e.g., `https://okno.moonacle.com/?donated=true`)

**Advantages over Stripe Checkout API:**
- Zero backend code (no API keys in .env, no `/api/create-checkout-session` endpoint)
- Zero npm dependencies (no `stripe` package)
- No webhook handling needed
- Works immediately in production
- Can be set up in 5 minutes from Stripe Dashboard

**Disadvantage:**
- Cannot dynamically create custom amounts (each amount is a separate link)
- Less control over the UI (Stripe's hosted page, not your design)

**Recommendation: Use Payment Links.** For a portfolio project with a donate button, the zero-backend approach is correct. Over-engineering payment infrastructure for a tip jar is an anti-pattern.

### Alternative: Stripe Checkout API (More Control)

If custom amounts or tighter UX integration is desired:

```
Frontend                    Backend                     Stripe
--------                    -------                     ------
User clicks "$10"  ------>  POST /api/donate
                            { amount: 1000 }  -------> Create Checkout Session
                            <-- session.url  <--------- Return checkout URL
User redirected to ------> Stripe Checkout page
                            User pays
                            Redirected to success_url
```

This requires:
- `stripe` npm package on backend
- `STRIPE_SECRET_KEY` in .env
- One API endpoint: `POST /api/donate` that creates a Checkout Session
- CSP header update to allow Stripe scripts (if using embedded mode)

**Verdict: Payment Links for v1.1.** If custom amounts become important later, upgrade to Checkout API. The migration is incremental, not a rewrite.

### UX Pattern for Donate Button Placement

| Location | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| Home page (index.html) | Visible to all visitors, including interviewers | Can feel pushy on main page | YES -- small, tasteful link in footer area |
| Settings page | Natural for "support" section | Low traffic page | YES -- secondary placement |
| Feedback modal (current) | Already has "Support Us" option | Modal is for bug reports; donation feels out of place | REPLACE current PayPal placeholder with Stripe link |
| Slideshow overlay | Visible during core experience | Distracting, ruins the frame experience | NO -- never put commerce in the ambient display |

**Recommended placement:** Replace the current PayPal placeholder in the feedback modal "Support Us" section. Also add a small, subtle link in the footer of index.html ("Support Okno" with a heart icon). Do NOT add anything to the slideshow itself.

### Amount Options (Industry Standard for Tip Jars)

| Amount | Label | Psychology |
|--------|-------|------------|
| $5 | "Buy me a coffee" | Low barrier, most common donation tier |
| $10 | "Support development" | Middle tier, feels substantial but accessible |
| $25 | "Champion supporter" | High tier for enthusiastic supporters |

Three options is the sweet spot. Two feels limiting. Four or more creates decision paralysis. The existing "donation-amount" CSS class in index.html suggests the UI scaffolding is already partially built.

### Thank You Flow

After successful donation:
1. Stripe redirects to `https://okno.moonacle.com/?donated=true`
2. Home page detects `?donated=true` URL param
3. Show a warm thank-you message (toast or inline): "Thank you for supporting Okno! Your generosity keeps this project alive."
4. Clean URL param from address bar (`history.replaceState`)

### Complexity Assessment

**LOW** (with Payment Links approach). Create links in Stripe Dashboard, update HTML with URLs, add thank-you URL param detection. No backend changes, no new dependencies.

**MEDIUM** (with Checkout API approach). One new endpoint, one new npm dependency, env variable, webhook optionally.

---

## 5. Demo Mode

### What It Is

A mode that allows the full Okno slideshow experience WITHOUT requiring Google authentication or photo selection. Uses bundled sample photos so anyone (especially interviewers during portfolio reviews) can experience the product immediately.

### Why It Matters for Portfolio

This is arguably the most important v1.1 feature from a career perspective. Without demo mode:
- Interviewer visits `okno.moonacle.com` --> sees a login page --> bounces
- Interviewer cannot experience the product without the developer's Google account

With demo mode:
- Interviewer visits `okno.moonacle.com` --> clicks "Try Demo" --> sees beautiful slideshow with Ken Burns, blurred backgrounds, overlays --> understands the product in 10 seconds

**Demo mode is the difference between "I built a photo frame" (words) and the interviewer EXPERIENCING a photo frame (evidence).**

### Table Stakes (Expected behavior for a demo mode)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Works without any authentication | The entire point is zero-friction access. No Google sign-in, no account creation. | Must bypass auth check entirely for demo routes. |
| High-quality sample photos | Demo photos must be beautiful -- they represent the product's visual quality. Low-quality or placeholder images undermine the demo. | Use 15-25 royalty-free landscape/portrait photos. Mix of orientations. Include photos with different dates for the date overlay feature. |
| All features functional | Ken Burns, blurred background, date overlay, crossfade, portrait pairs -- everything must work in demo mode. | Demo photos need metadata (createTime, width, height) just like real Google Photos items. |
| Clear "Demo Mode" indicator | Users must know they are in demo mode, not the real product. Prevents confusion. | Subtle banner or badge: "Demo Mode -- Sign in with Google for your own photos" |
| Easy exit to real product | After experiencing the demo, the path to authentication should be obvious. | "Sign in with Google" CTA visible from demo mode. |
| Does not interfere with real data | Demo mode must not touch the real photo cache, tokens, or config. | Separate demo photo endpoint or query parameter to distinguish demo requests. |

### Sample Photo Strategy

**Source options (royalty-free, no attribution required):**
- Unsplash License photos (free for commercial use, no attribution required for most)
- Pexels License photos (similar terms)
- Self-shot photos (the developer's own non-personal photos)

**Photo requirements:**
| Requirement | Why | Count |
|-------------|-----|-------|
| Landscape orientation | Primary display orientation for iPad | 12-15 photos |
| Portrait orientation | Test portrait pair mode and blurred background | 6-8 photos |
| Various "dates" (fake metadata) | Test date overlay and On This Day features | Spread across years: 2018-2025 |
| High resolution | iPad Pro is 2732x2048. Photos should be at least 2048px on longest edge. | All photos |
| Varied subjects | Show versatility: landscapes, people, food, architecture, pets | Mix |

**Storage approach:**
- Store sample photos in `/public/demo/` directory (served as static files)
- Create a `demo-photos.json` manifest with metadata (filename, createTime, width, height, isPortrait)
- Total size: ~15-25 photos at ~500KB each = 7-12MB. Acceptable for a web app.

### Architecture

Two approaches:

**Approach A: Separate demo endpoint (recommended)**
```
GET /api/photo/random?demo=true
  --> Serves from /public/demo/ instead of Google Photos cache
  --> Returns same headers (X-Photo-CreateTime, etc.) from manifest

Frontend: /slideshow.html?demo=true
  --> Uses demo=true query param on all photo requests
  --> Shows "Demo Mode" indicator
  --> Skips auth check
```

**Approach B: Demo as a separate route**
```
GET /demo --> serves slideshow.html with demo flag
GET /api/demo/random --> serves demo photos

Frontend: /demo page
  --> Completely separate from /slideshow.html
  --> Own URL, own behavior
```

**Recommendation: Approach A (query parameter).** Reuses 100% of the slideshow frontend code. The only difference is the photo source. This avoids duplicating the slideshow page and ensures demo mode always matches the real product behavior.

### Demo Mode Flow

```
1. Visitor arrives at okno.moonacle.com
2. Home page shows:
   - "Sign in with Google" (primary action -- for real users)
   - "Try Demo" (secondary action -- for interviewers)
3. "Try Demo" links to /slideshow.html?demo=true
4. Slideshow loads with demo photos (Ken Burns, blur, overlays all active)
5. "Demo Mode" badge visible in corner
6. After exploring, user can:
   - Click demo badge to return home and sign in
   - Or just close the tab (interviewer has seen enough)
```

### Backend Changes

Minimal:
1. `photo-proxy.js`: Add demo handler to `GET /random` -- if `req.query.demo === 'true'`, serve from demo manifest instead of Google cache
2. No auth middleware on demo requests
3. Demo photo files served via existing `express.static`

### Edge Cases

- **Demo + real mode confusion:** If a user is authenticated AND visits `?demo=true`, still show demo photos (not their real photos). Demo is demo.
- **Demo photos preloading:** The existing preload pattern works unchanged. Demo photos are just a different source.
- **Demo mode settings:** Demo should use optimal settings (Ken Burns ON, blurred background ON, overlays ON, 15-second interval) regardless of saved config. Show the product at its best.
- **On This Day in demo:** Set some demo photo dates to today's month+day so the On This Day feature works in demo mode.

### Complexity Assessment

**MEDIUM.** Requires: curating and storing 15-25 sample photos, creating a manifest file, modifying the photo endpoint to serve demo photos, adding demo flag to the frontend, adding the "Try Demo" button to the home page, and adding the demo mode indicator to the slideshow. No complex logic, but several touchpoints across frontend and backend.

---

## 6. README as Portfolio Artifact

### What It Is

Transform the GitHub README from a basic project description into a polished portfolio piece that demonstrates product leadership, technical depth, and design taste. The README is often the FIRST thing an interviewer sees -- before the live demo, before the code.

### Table Stakes (Expected for a portfolio-quality README)

| Element | Why Expected | Notes |
|---------|--------------|-------|
| Hero image/GIF | Visual proof the product exists and looks good. A README without visuals is a red flag for a visual product. | Animated GIF or screenshot showing the slideshow in action. Ken Burns + blurred background in one frame. |
| One-line description | Interviewer scanning 50 repos needs to understand what this is in 5 seconds. | "Turn an old iPad into a Google Photos digital photo frame." |
| Feature list with screenshots | Each feature gets a brief description and visual proof. | Ken Burns, blurred background, On This Day, portrait pairs, date overlay, demo mode. |
| Architecture diagram | Shows system design thinking. Backend, frontend, Google API, deployment. | Mermaid diagram or image. Keep it clean -- 5-7 components max. |
| Tech stack section | What technologies and why. | Node.js, Express, vanilla JS, Google Photos Picker API, PWA. |
| Live demo link | Interviewer can experience it immediately. | Link to `okno.moonacle.com` (demo mode). |
| Setup instructions | Shows the project is real and reproducible. | Environment variables, Google Cloud setup, deployment steps. |
| Product decisions section | THIS is the portfolio gold. Why certain features were built, what was cut, what tradeoffs were made. | 3-5 key decisions with rationale. "Why vanilla JS instead of React," "Why On This Day exists," "What I chose NOT to build." |

### Differentiators (Elevate above typical READMEs)

| Element | Value | Notes |
|---------|-------|-------|
| "Product Thinking" section | Explicitly frame decisions as product leadership evidence. Interviewers hiring PMs want to see prioritization, not just engineering. | "Table stakes vs differentiators" framing. "What I scoped out and why." |
| Before/after comparison | Show the visual journey from v1.0 to v1.1. | Side-by-side: black bars vs blurred background, static vs Ken Burns. |
| Metrics / facts | "Shipped v1.0 in 7 days," "Runs 24/7 on a 2015 iPad," "2000 photos cached." | Concrete numbers are more impressive than vague claims. |
| Problem statement | Start with the human problem, not the technology. | "I wanted to see my old photos without scrolling through my phone. I had an old iPad sitting in a drawer." |

### Anti-Features (Do NOT include in README)

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Verbose installation instructions | This is a portfolio piece, not an open-source project seeking contributors. Keep setup to essentials. |
| Contributing guidelines | Same -- this is not seeking contributors. Omit CONTRIBUTING.md. |
| Badge spam (CI, coverage, etc.) | No CI exists. Fake badges are worse than no badges. |
| Exhaustive API documentation | Interviewers do not want to read API docs. Link to code if they are curious. |
| Changelog | Not relevant for portfolio context. The commit history is the changelog. |

### Recommended README Structure

```markdown
# Okno -- A Window in Time

> Turn an old iPad into a Google Photos digital photo frame.

[Hero GIF or screenshot]

[Live Demo](https://okno.moonacle.com) | [Architecture](#architecture)

## The Problem
[2-3 sentences about why this exists]

## Features
[Screenshots/GIFs for each major feature with 1-line descriptions]

## Architecture
[Mermaid diagram: iPad --> nginx --> Express --> Google Photos API]

## Product Decisions
[3-5 key decisions with "chose X because Y" format]

## Tech Stack
[Table: technology, purpose, why chosen]

## Setup
[Minimal: clone, env vars, run]

## Built By
[Your name, role, link to portfolio]
```

### Screenshot/GIF Strategy

For the hero image and feature screenshots:
- **Screenshot tool:** Safari on iPad, or browser dev tools in iPad emulation mode
- **GIF recording:** Use a screen recording tool, convert to GIF. Keep under 5MB for GitHub rendering.
- **Dimensions:** 1280x960 or similar 4:3 ratio matches iPad landscape
- **Content:** Use demo mode photos (not personal family photos for privacy)

### Complexity Assessment

**LOW** (for the content creation), **MEDIUM** (for the screenshot/GIF production). The README itself is just markdown. The effort is in capturing compelling visuals and writing concise product narratives. This should be done LAST, after all visual features are implemented, so screenshots show the final product.

---

## Feature Dependencies

```
[Bug Fixes] -----> Independent, do first
     |
     v
[Ken Burns] -----> Independent (CSS only, no backend)
     |
[Blurred Background] -----> Independent, but shares wrapper architecture with Ken Burns
     |                        RECOMMEND: Build together since both modify the img element structure
     v
[Date/Time Overlays] -----> Depends on photo wrapper (if using wrapper approach from blurred bg)
     |                        But can be built independently as fixed-position elements
     v
[Stripe Donate] -----> Fully independent (frontend link + Stripe Dashboard config)
     |
[Demo Mode] -----> Depends on: Ken Burns, Blurred Background, Overlays (demo should showcase all features)
     |              Also needs: sample photos curated and stored
     v
[README] -----> Depends on: ALL above (needs screenshots of final product)
                Must be last.
```

### Recommended Build Order

1. **Ken Burns + Blurred Background** (together) -- Both modify the photo element architecture. Build as a unit.
2. **Date/Time Overlays** -- Quick addition once photo structure is settled.
3. **Stripe Donate** -- Independent, can be done anytime. Quick.
4. **Demo Mode** -- Needs all visual features working to showcase them.
5. **README** -- Last. Captures the final product.

---

## Anti-Features (Things to deliberately NOT build in v1.1)

| Anti-Feature | Why Someone Might Want It | Why Avoid | What to Do Instead |
|--------------|---------------------------|-----------|-------------------|
| **Multiple transition styles** | "Add slide, dissolve, wipe, zoom transitions" | Each transition is separate CSS/JS. Testing matrix explodes. Users pick one and forget. Ken Burns IS the premium transition. | Ken Burns + crossfade is the entire transition story. Two is enough. Apple TV has one. |
| **Animated text overlays** | "Photo date should fly in, clock should pulse" | Animated text is distracting on an ambient display. Motion should be reserved for the photo (Ken Burns), not chrome. | Static text with simple fade-in (inherited from photo crossfade). |
| **Custom overlay positioning** | "Let users drag overlays to custom positions" | Massive UI complexity for negligible value. Users position once and forget. | Fixed positions (bottom-left, bottom-right). Consistent, predictable. |
| **Donation amount tracking/dashboard** | "Show how much has been donated" | Over-engineers a tip jar. Requires database, analytics. | Stripe Dashboard already tracks all payments. |
| **Interactive demo features** | "Let demo users configure settings, change interval" | Demo should be a showcase, not a sandbox. Configuration adds friction to the 10-second portfolio experience. | Demo runs with optimal settings, no configurability. The point is to impress, not to teach. |
| **Video demo on README** | "Embed a YouTube video walkthrough" | Videos are maintenance overhead (re-record when UI changes). GIFs are sufficient and auto-play on GitHub. | Animated GIF hero image. |
| **Donation receipts/emails** | "Send thank-you emails to donors" | Requires email infrastructure (SendGrid, SES). Over-engineers a tip jar. | Stripe automatically sends receipts. The on-site "thank you" message is sufficient. |
| **Weather/Spotify/news overlays** | "Add more data to the ambient display" | Scope creep. Each integration is a separate API, separate failure mode. The product is a PHOTO frame. | v2.0+ consideration at most. Keep v1.1 focused on photos. |

---

## Config Schema Extension

v1.1 adds four new boolean toggles to the existing config system:

```javascript
// Current config (v1.0)
const defaults = {
  interval: 30,
  displayMode: 'cover',
  onThisDay: false,
  portraitPairs: false,
};

// Extended config (v1.1)
const defaults = {
  interval: 30,
  displayMode: 'cover',
  onThisDay: false,
  portraitPairs: false,
  kenBurns: true,           // NEW: Ken Burns effect (default ON for wow factor)
  blurredBackground: true,   // NEW: Blurred background fill (default ON)
  photoDateOverlay: true,    // NEW: Photo date text overlay (default ON)
  clockOverlay: false,       // NEW: Clock overlay (default OFF -- less essential)
};
```

**Default ON rationale:** Ken Burns, blurred background, and photo date overlay are the visual differentiators. New users and demo mode should see the best version of the product by default. Clock is off by default because it is less universally desired.

The existing `config.js` validation pattern (allowedKeys, type checking) will automatically accept new boolean keys with no schema migration needed -- new keys simply merge with defaults.

---

## Settings Page Extension

Four new toggle rows in the "Features" section of `settings.html`:

```
Features Section (existing):
  - On This Day      [toggle]
  - Portrait Pairs   [toggle]

Visual Effects Section (NEW):
  - Ken Burns        [toggle]  "Cinematic zoom and pan on photos"
  - Blurred Fill     [toggle]  "Blurred background instead of black bars"

Overlays Section (NEW):
  - Photo Date       [toggle]  "Show when each photo was taken"
  - Clock            [toggle]  "Show current time"
```

Group the new toggles into logical sections to avoid a long undifferentiated list. The existing settings page design (neumorphic toggles with icon + label + description) provides the pattern.

---

## Summary: Feature Categorization

### Table Stakes (must have for each feature to feel complete)

| Feature | Table Stakes Behavior |
|---------|----------------------|
| Ken Burns | Smooth, randomized direction, matches interval timing, toggleable, overflow clipped |
| Blurred Background | Same-photo blur, heavy blur (40px+), dimmed, scaled to fill edges, toggleable |
| Photo Date | Formatted month+year, semi-transparent pill, positioned unobtrusively, handles missing dates |
| Clock | Updates every minute, locale-aware format, consistent style with photo date |
| Stripe Donate | Pre-set amounts, secure (Stripe hosted), thank-you confirmation, no account required |
| Demo Mode | No auth required, high-quality photos, all features active, clear demo indicator, exit path to real product |
| README | Hero image, feature screenshots, architecture diagram, product decisions section, live demo link |

### Differentiators (competitive advantage, portfolio wow factor)

| Feature | Why It Differentiates |
|---------|----------------------|
| Ken Burns + Blurred Background COMBINED | The combination creates a cinematic experience that matches Apple TV quality. Most DIY photo frames have neither. Having both is the "wow" moment. |
| Product Decisions in README | Most portfolio READMEs show what was built. Showing WHAT WAS NOT BUILT and WHY demonstrates product leadership thinking that interviewers value. |
| Demo Mode with optimal defaults | The interviewer experiences the product in 10 seconds without any setup. This is a portfolio differentiator that 95% of side projects lack. |
| Photo date overlay with nostalgia framing | "March 2019" on a photo creates an emotional response. Commercial frames cannot do this (they lack the metadata). Self-hosted advantage. |

### Prioritized Build Order with Rationale

| Order | Feature | Rationale |
|-------|---------|-----------|
| 1 | Bug fixes from v1.0 QA | Fix data loss and UX bugs before adding new features. Foundation must be solid. |
| 2 | Ken Burns + Blurred Background | Highest visual impact. Both modify the photo element architecture, so build together. This is the "before/after" moment. |
| 3 | Date/Time Overlays | Quick wins that add ambient information. Layer on top of the visual improvements. |
| 4 | Stripe Donate | Independent, small scope. Can be done in parallel or as a break from visual work. |
| 5 | Demo Mode | Requires all visual features to be working (demo showcases the final product). |
| 6 | README | Must be last. Captures screenshots of the final product with all features active. |

---

## Sources

- Ken Burns effect parameters: Based on training data knowledge of Apple TV screensaver behavior, CSS animation best practices, and digital photo frame app feature lists. **Confidence: HIGH** -- CSS transform/animation is extremely well-understood and stable. The recommended parameters (1.0-1.15x scale, linear easing, random transform-origin) are the documented standard across multiple implementations.
- Blurred background technique: Based on training data knowledge of CSS `filter: blur()`, `object-fit`, and the two-layer image approach. Verified by existing use in Aura frames and Samsung Frame TV. **Confidence: HIGH** -- pure CSS technique, well-documented, widely used.
- Stripe Payment Links: Based on training data of Stripe's product offering. **Confidence: MEDIUM** -- Stripe products evolve. Verify Payment Links availability and pricing at stripe.com/payments/payment-links before implementation. As of training cutoff, Payment Links are free (standard Stripe processing fees apply, 2.9% + 30c).
- Demo mode patterns: Based on training data knowledge of portfolio project best practices. No single authoritative source. **Confidence: MEDIUM** -- the pattern is logical and widely practiced but specific implementation details are opinion, not documented standard.
- README structure: Based on training data knowledge of high-quality GitHub READMEs and portfolio presentation. **Confidence: HIGH** -- README best practices are stable and well-documented across many guides.

---

*Feature research for: Okno v1.1 "Make It Shine"*
*Researched: 2026-02-15*
