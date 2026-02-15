# Phase 6: Stripe + Demo Mode - Research

**Researched:** 2026-02-15
**Domain:** Stripe Payment Links (no-code donation), demo mode (auth bypass with bundled sample photos)
**Confidence:** HIGH

## Summary

Phase 6 adds two independent features: (1) a Stripe Payment Links donation button on the settings page for signed-in users, and (2) a demo mode that lets unauthenticated visitors experience the full slideshow with bundled sample photos at `/demo`. Both features are well-understood, low-risk integrations into the existing codebase.

The Stripe integration is trivially simple -- Stripe Payment Links is a no-code product that generates a URL. The user clicks a link, lands on a Stripe-hosted payment page, and donates. No backend route, no Stripe SDK, no webhook, no API key management. The existing `stripe` npm dependency (from a reverted subscription attempt) can be removed.

Demo mode is the more architecturally involved feature. It requires: (a) bundled sample photos in `public/demo/`, (b) a new `demo-photos.js` backend module to serve them, (c) modifications to `photo-proxy.js` and `health.js` to detect demo mode, (d) a new `/demo` route serving `public/demo.html`, and (e) frontend changes for the demo indicator badge, "Try Demo" button, and end-of-demo CTA. The key architectural principle is **complete isolation** -- demo mode must never touch `tokens.json`, `cache.json`, `config.json`, or any authenticated API endpoint.

**Primary recommendation:** Use Stripe Payment Links (URL only, zero backend code). For demo mode, serve bundled JPEG files from `/public/demo/` via a lightweight `demo-photos.js` module, with the `/demo` route loading a dedicated `demo.html` page (adapted from `slideshow.html`).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Stripe Payment Links | N/A (hosted service) | One-click donations | Zero-code, Stripe-hosted, no backend needed |
| Express static middleware | Existing | Serve demo photos from `/public/demo/` | Already in use, no new dependency |
| sharp | ^0.34.5 (existing devDep) | Optimize + add EXIF dates to sample photos | Already in devDependencies, industry standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `stripe-buy-button.js` | v3 (CDN) | Embedded buy button web component | Optional: if using `<stripe-buy-button>` instead of plain `<a href>` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Payment Links (URL) | Stripe Checkout Session (server-side) | Checkout Sessions require a backend route, Stripe SDK, API keys in `.env` -- massively over-engineered for a "buy me a coffee" donate button |
| Stripe Payment Links (URL) | `<stripe-buy-button>` web component | Buy button renders inline on the page with Stripe branding -- more visually polished, but adds `js.stripe.com` script dependency and CSP changes. Plain link is simpler and matches the casual tone |
| sharp for EXIF writing | exiftool-vendored npm | exiftool-vendored is more full-featured for EXIF, but sharp is already a devDependency and can write basic EXIF data (DateTimeOriginal) via `withExif()` |
| Bundled photos (static) | Unsplash API (dynamic fetch) | Dynamic fetch adds complexity, rate limits (50/hr in dev mode), and external dependency. 10-15 bundled photos is simpler and more reliable |

**Installation:**
```bash
# No new runtime dependencies needed
# Remove unused stripe npm package (from reverted subscription code):
npm uninstall stripe
```

**Note on `stripe` npm dependency:** The `stripe` package (^20.3.1) is currently in `package.json` from a prior, reverted subscription integration attempt. Since Phase 6 uses Stripe Payment Links (a URL, not an API), the `stripe` npm package is unnecessary and should be removed to keep the dependency tree clean.

## Architecture Patterns

### Recommended Project Structure
```
public/
  demo/                  # NEW: Sample photo directory
    photo-01.jpg         # Optimized sample photos (10-15 files)
    photo-02.jpg
    ...
    manifest.json        # Metadata: createTime, dimensions, description
  demo.html              # NEW: Demo slideshow page (adapted from slideshow.html)
  index.html             # MODIFIED: Add "Try Demo" button for unauthenticated visitors
  settings.html          # MODIFIED: Add "Support Okno" donate section (signed-in only)
  slideshow.html         # UNCHANGED
demo-photos.js           # NEW: Backend module for demo photo serving
photo-proxy.js           # MODIFIED: Add demo route handler
server.js                # MODIFIED: Mount demo routes
```

### Pattern 1: Stripe Payment Links (Zero Backend)
**What:** A Stripe Payment Link is a pre-configured URL that opens a Stripe-hosted payment page. Created in the Stripe Dashboard, not in code.
**When to use:** One-time donations, tips, "buy me a coffee" scenarios where the product doesn't need to know about the payment.
**Implementation:**

1. Create a Payment Link in the Stripe Dashboard (https://dashboard.stripe.com/payment-links):
   - Select "Customers choose what to pay"
   - Set title: "Support Okno"
   - Set description: "Buy the developer a coffee"
   - Optionally set suggested amount (e.g., $5) and minimum ($1)
   - Save and copy the URL (format: `https://buy.stripe.com/xxxx`)

2. Add the link to `settings.html`:
```html
<!-- Support Okno section (only visible to signed-in users) -->
<div class="settings-section" id="supportSection">
  <div class="section-title">Support Okno</div>
  <div class="setting-row">
    <div class="setting-label">
      <div class="icon"><i data-lucide="heart"></i></div>
      <div class="text">
        <span class="name">Buy me a coffee</span>
        <span class="description">Okno is a passion project. Your support keeps it alive.</span>
      </div>
    </div>
    <a href="https://buy.stripe.com/YOUR_LINK_ID" target="_blank" rel="noopener noreferrer"
       style="text-decoration: none;">
      <button class="btn-donate">Support</button>
    </a>
  </div>
</div>
```

**Source:** [Stripe Payment Links documentation](https://docs.stripe.com/payment-links) and [Stripe buy button documentation](https://docs.stripe.com/payment-links/buy-button)

### Pattern 2: Demo Mode with Dedicated Route
**What:** A `/demo` URL loads `demo.html` which is a self-contained slideshow page that fetches photos from `/api/demo/random` instead of `/api/photo/random`. Completely separate code path from the authenticated slideshow.
**When to use:** When demo mode must be fully isolated from real user data.
**Implementation:**

The demo slideshow page (`demo.html`) is a copy of `slideshow.html` with these modifications:
- Fetches from `/api/demo/random` instead of `/api/photo/random`
- Fetches demo health from `/api/demo/health` instead of `/api/health`
- Does NOT load config from `/api/config` (uses hardcoded demo defaults)
- Adds a demo indicator badge (pill/badge in corner)
- Adds end-of-demo CTA after one complete cycle
- No settings access, no picker flow, no auth checks
- Registers Service Worker for PWA support

```javascript
// demo-photos.js -- serves random photos from /public/demo/
const path = require('path');
const fs = require('fs');

const DEMO_DIR = path.join(__dirname, 'public', 'demo');

// Load manifest on startup
let manifest = [];
function loadManifest() {
  const manifestPath = path.join(DEMO_DIR, 'manifest.json');
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function getRandomDemo() {
  const item = manifest[Math.floor(Math.random() * manifest.length)];
  const filePath = path.join(DEMO_DIR, item.file);
  const buffer = fs.readFileSync(filePath);
  return { buffer, item };
}

function getDemoCount() { return manifest.length; }
```

```javascript
// In server.js -- mount demo routes
const demoRouter = require('./demo-photos');
app.use('/api/demo', demoRouter);
// Serve demo.html at /demo route
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});
```

### Pattern 3: Demo Photo Manifest
**What:** A JSON file alongside the demo photos that provides metadata the slideshow needs (createTime for date overlay, dimensions for portrait detection).
**When to use:** When bundled photos need metadata that would normally come from the Google Photos API.

```json
// public/demo/manifest.json
[
  {
    "id": "demo-01",
    "file": "photo-01.jpg",
    "createTime": "2019-03-15T14:30:00Z",
    "width": 4032,
    "height": 3024,
    "description": "Beach sunset"
  },
  {
    "id": "demo-02",
    "file": "photo-02.jpg",
    "createTime": "2021-12-25T10:00:00Z",
    "width": 3024,
    "height": 4032,
    "description": "Holiday morning"
  }
]
```

The backend reads this manifest and returns appropriate headers (`X-Photo-CreateTime`, `X-Photo-IsPortrait`) so the demo slideshow works identically to the real one for overlays and portrait detection.

### Pattern 4: End-of-Demo CTA
**What:** After cycling through all demo photos once, show a full-screen overlay with options to "Watch again" or "Use your own photos."
**When to use:** Demo mode should not loop infinitely -- it showcases, then invites action.

```javascript
// Demo-specific: track photos shown, trigger CTA after one cycle
let demoPhtosShown = 0;
const totalDemoPhotos = demoPhotoCount; // from /api/demo/health

function onDemoPhotoLoaded() {
  demoPhtosShown++;
  if (demoPhtosShown >= totalDemoPhotos) {
    showEndOfDemoCTA();
  }
}

function showEndOfDemoCTA() {
  // Full-screen overlay with two buttons:
  // "Watch again" -> restart demo cycle
  // "Use your own photos" -> redirect to / (home page with sign-in)
}
```

### Anti-Patterns to Avoid
- **Using `DEMO_MODE=true` env var as the only way to activate demo:** The decision calls for a `/demo` URL route accessible to anyone. Demo mode should be route-based, not server-wide. The server runs in normal mode; `/demo` is just a separate entry point.
- **Sharing code paths between real slideshow and demo:** Tempting to add `if (demoMode)` checks throughout `slideshow.html`, but this creates coupling. A dedicated `demo.html` is cleaner and eliminates risk of demo code affecting the real slideshow.
- **Fetching demo photos from `/api/photo/random`:** This would require modifying the auth-gated photo proxy and risks leaking real user data. Use a separate `/api/demo/random` endpoint.
- **Storing Stripe API keys for Payment Links:** Payment Links are URLs, not API calls. No secret keys needed.
- **Making the donate button visible in demo mode:** Decision explicitly states donate button is for signed-in users only on the settings page.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment page | Custom payment form with card inputs | Stripe Payment Links (hosted page) | PCI compliance, security, error handling, 3D Secure -- all handled by Stripe |
| Image optimization | Manual resize/compress pipeline | sharp (already in devDependencies) | Handles JPEG quality, resize, EXIF writing in one tool |
| EXIF date injection | Manual binary JPEG header editing | sharp `withExif()` method | EXIF format is complex binary; sharp handles it correctly |
| Demo photo serving | Custom file reading + streaming | Express `res.sendFile()` or `fs.readFileSync()` + `res.send()` | Express handles Content-Type, caching headers, error handling |

**Key insight:** The entire Stripe integration is literally a URL. Do not build any backend payment infrastructure. Stripe Payment Links handle everything.

## Common Pitfalls

### Pitfall 1: Demo Mode Leaking Real User Data
**What goes wrong:** Demo code accidentally accesses `cache.json`, `tokens.json`, or authenticated API endpoints, exposing the real user's photos or credentials.
**Why it happens:** Sharing code paths between demo and real modes; checking `req.session` in demo routes; importing `photo-cache.js` in demo code.
**How to avoid:** Complete separation. Demo routes (`/api/demo/*`) must never import `auth.js`, `photo-cache.js`, or `photo-proxy.js`. The `demo-photos.js` module reads only from `/public/demo/`. No session checks on demo endpoints.
**Warning signs:** Any `require('./auth')` or `require('./photo-cache')` in demo code; any `req.session` check in demo routes.

### Pitfall 2: CSP Blocking Stripe
**What goes wrong:** If using `<stripe-buy-button>` web component, the `js.stripe.com` script is blocked by Content Security Policy headers.
**Why it happens:** The existing CSP in `server.js` (via Helmet) only allows scripts from `'self'`, `cdn.jsdelivr.net`, and `unpkg.com`.
**How to avoid:** If using the buy button web component, add `https://js.stripe.com` to both `script-src` and `frame-src` CSP directives. If using a plain `<a href>` link (recommended), no CSP changes needed -- it's just a link to an external URL.
**Warning signs:** Console errors mentioning "Content Security Policy" when the donate button is clicked.

### Pitfall 3: Demo Photos Too Large (Slow Load)
**What goes wrong:** Original-resolution photos (4032x3024, 5-10MB each) cause slow demo load times, especially on mobile.
**Why it happens:** Photos downloaded from Unsplash/Pexels at original resolution without optimization.
**How to avoid:** Use the `sharp` devDependency to optimize photos before bundling: resize to 2048px on longest edge (matches iPad Pro resolution), JPEG quality 80, strip unnecessary metadata. Target ~200-400KB per photo. Total bundle: ~3-5MB for 12 photos.
**Warning signs:** Demo takes more than 3 seconds to load first photo; `/public/demo/` directory is >20MB.

### Pitfall 4: Demo Photo Licensing Issues
**What goes wrong:** Photos sourced from the internet without proper licensing, leading to copyright claims.
**Why it happens:** Grabbing photos from Google Images or Instagram instead of properly licensed sources.
**How to avoid:** Use photos exclusively from Unsplash, Pexels, or Pixabay. All three platforms grant irrevocable, royalty-free licenses for commercial and non-commercial use. Unsplash license explicitly allows download, copy, modify, distribute -- the only restriction is not compiling photos to "replicate a similar or competing service" (i.e., don't build a stock photo site). A demo mode for a photo frame app is clearly not a competing service.
**Warning signs:** Photos without clear source attribution in the manifest; photos from photographer portfolios or social media.

### Pitfall 5: Forgetting EXIF Dates on Demo Photos
**What goes wrong:** The photo date overlay shows nothing during demo because sample photos lack `createTime` metadata.
**Why it happens:** Stock photos from Unsplash/Pexels have their original EXIF data, which may not span diverse dates. Or photos are optimized and EXIF is stripped.
**How to avoid:** The demo manifest includes `createTime` for each photo. The `/api/demo/random` endpoint returns this as the `X-Photo-CreateTime` header, just like the real endpoint. Fake dates should span multiple months and years (e.g., "March 2019", "December 2021", "July 2023") to showcase the date overlay naturally.
**Warning signs:** Date overlay is blank during demo; all demo photos show the same date.

### Pitfall 6: Service Worker Caching Stale Demo Assets
**What goes wrong:** After deploying demo mode, the iPad PWA still shows the old version without demo support.
**Why it happens:** Service Worker cache version wasn't bumped, so cached `index.html` doesn't have the "Try Demo" button.
**How to avoid:** Bump `CACHE_VERSION` and `PHOTO_CACHE` in `sw.js` when deploying Phase 6 changes (e.g., `okno-v1.3`). This forces the Service Worker to re-cache all static assets.
**Warning signs:** Changes visible in browser but not in installed PWA.

## Code Examples

### Demo Photo API Endpoint
```javascript
// demo-photos.js (Express router)
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DEMO_DIR = path.join(__dirname, 'public', 'demo');
let manifest = [];

// Load manifest on module init
try {
  manifest = JSON.parse(fs.readFileSync(path.join(DEMO_DIR, 'manifest.json'), 'utf8'));
} catch (e) {
  console.warn('Demo manifest not found:', e.message);
}

// GET /api/demo/random -- serve a random demo photo
router.get('/random', (req, res) => {
  if (manifest.length === 0) {
    return res.status(503).json({ error: 'No demo photos available' });
  }

  const item = manifest[Math.floor(Math.random() * manifest.length)];
  const filePath = path.join(DEMO_DIR, item.file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Demo photo file missing' });
  }

  // Set headers matching the real photo proxy format
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=3600'); // Demo photos can be cached
  res.set('X-Photo-Id', item.id);
  res.set('X-Photo-CreateTime', item.createTime || '');
  res.set('X-Photo-IsPortrait', String((item.height || 0) > (item.width || 0)));

  res.sendFile(filePath);
});

// GET /api/demo/health -- demo photo counts
router.get('/health', (req, res) => {
  const portraitCount = manifest.filter(i => (i.height || 0) > (i.width || 0)).length;
  res.json({
    status: 'ok',
    demoMode: true,
    cache: {
      totalItems: manifest.length,
      portraitCount
    }
  });
});

module.exports = router;
```

### Demo Photo Optimization Script
```javascript
// scripts/optimize-demo-photos.js (run once, not part of app)
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT_DIR = path.join(__dirname, '..', 'demo-originals');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'demo');

// Fake dates spanning multiple months/years for natural date overlay display
const fakeDates = [
  '2019-03-15T14:30:00Z', '2019-08-22T09:15:00Z',
  '2020-01-01T11:00:00Z', '2020-06-18T16:45:00Z',
  '2021-04-10T08:20:00Z', '2021-12-25T10:30:00Z',
  '2022-02-14T13:00:00Z', '2022-07-04T19:00:00Z',
  '2023-05-20T07:45:00Z', '2023-09-01T15:30:00Z',
  '2023-11-23T12:00:00Z', '2024-03-08T17:15:00Z',
];

async function optimize() {
  const files = fs.readdirSync(INPUT_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  const manifest = [];

  for (let i = 0; i < files.length; i++) {
    const input = path.join(INPUT_DIR, files[i]);
    const outputName = `photo-${String(i + 1).padStart(2, '0')}.jpg`;
    const output = path.join(OUTPUT_DIR, outputName);

    const metadata = await sharp(input).metadata();

    await sharp(input)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .withExif({
        IFD0: { Copyright: 'Demo photo - see manifest.json for source' },
      })
      .toFile(output);

    const outputMeta = await sharp(output).metadata();

    manifest.push({
      id: `demo-${String(i + 1).padStart(2, '0')}`,
      file: outputName,
      createTime: fakeDates[i % fakeDates.length],
      width: outputMeta.width,
      height: outputMeta.height,
    });
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`Optimized ${manifest.length} photos`);
}

optimize().catch(console.error);
```

### Stripe Payment Link on Settings Page
```html
<!-- "Support Okno" section in settings.html -->
<div class="settings-section" id="supportSection" style="display: none;">
  <div class="section-title">Support Okno</div>
  <div class="setting-row">
    <div class="setting-label">
      <div class="icon"><i data-lucide="coffee"></i></div>
      <div class="text">
        <span class="name">Buy me a coffee</span>
        <span class="description">Help keep Okno free and evolving</span>
      </div>
    </div>
    <a href="https://buy.stripe.com/YOUR_PAYMENT_LINK_ID"
       target="_blank"
       rel="noopener noreferrer"
       style="text-decoration: none;">
      <button type="button" class="btn-donate">
        <i data-lucide="heart" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>
        Support
      </button>
    </a>
  </div>
</div>
```

```javascript
// In settings.html <script>, show support section only for signed-in users:
async function checkAuthForDonate() {
  try {
    const res = await fetch('/auth/status');
    const data = await res.json();
    if (data.authenticated) {
      document.getElementById('supportSection').style.display = 'block';
    }
  } catch (e) {
    // Silently fail -- donate section stays hidden
  }
}
checkAuthForDonate();
```

### "Try Demo" Button on Home Page
```javascript
// In index.html checkAuth(), when user is NOT authenticated:
if (!data.authenticated) {
  statusEl.style.display = 'none';
  actionsEl.innerHTML = `
    <a href="/auth/login" style="text-decoration: none;">
      <button style="display: flex; align-items: center; gap: 0.75rem; ...">
        <svg ...>Google Logo</svg>
        Sign in with Google
      </button>
    </a>
    <div style="margin-top: 16px;">
      <a href="/demo" style="text-decoration: none;">
        <button class="secondary">Try Demo</button>
      </a>
    </div>
  `;
}
```

### Demo Mode Badge (in demo.html)
```html
<!-- Demo indicator badge - fixed position, always visible -->
<div id="demoBadge" style="
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 50;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.05em;
  pointer-events: none;
">DEMO</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe Checkout Sessions for donations | Stripe Payment Links (no-code) | Payment Links GA 2022 | No backend code needed at all; create link in Dashboard, paste URL |
| PayPal donate button | Stripe Payment Links | Decision from context | Stripe has better UX, no PayPal account needed for donors |
| Server-wide `DEMO_MODE=true` env var | Route-based `/demo` URL | Phase 6 context decision | Both modes coexist on same server; demo is just a URL, not a server config |
| Full Stripe SDK with webhooks | Payment Link URL only | Phase 6 context decision | The `stripe` npm package can be removed entirely |

**Deprecated/outdated:**
- **Stripe subscription code:** Was added by a prior agent and reverted. Phase 6 uses one-time donations only, via Payment Links (not Checkout Sessions, not Subscriptions).
- **PayPal donate placeholder:** Currently in `index.html` feedback modal. Will be removed; donate moves to settings page with Stripe.
- **`DEMO_MODE=true` env var approach:** Prior research suggested this. The context decision specifies a `/demo` URL route instead, which is shareable and linkable from the README.

## Open Questions

1. **Stripe Payment Link URL**
   - What we know: The user has an existing "moonacle" Stripe account. Payment Links are created in the Dashboard, not in code.
   - What's unclear: The actual Payment Link URL does not exist yet -- it must be created in the Stripe Dashboard.
   - Recommendation: Create the Payment Link as a pre-planning step. Use a placeholder URL during development that gets replaced with the real link before deployment.

2. **Demo Photo Curation**
   - What we know: 10-15 photos, mix of personal-feel (travel, family, pets, food) and scenic/landscape. Must include both portrait and landscape orientations.
   - What's unclear: Exact photos to use. This is marked as "Claude's Discretion" in CONTEXT.md.
   - Recommendation: Source from Unsplash (best quality, clear license). Select 12 photos: 4 scenic/landscape (mountains, beach, city skyline, forest), 4 personal-feel (cafe/food, pet, family gathering, travel street), 4 portrait orientation (flower close-up, doorway, person walking, architecture). Include at least 3-4 portrait-orientation photos to showcase the portrait pairs and blur background features. Fake dates should span 2019-2024 across different months.

3. **Demo Photo File Size Budget**
   - What we know: Photos optimized to 2048px longest edge, JPEG quality 80, mozjpeg compression.
   - What's unclear: Exact size target per photo.
   - Recommendation: Target 200-400KB per photo after optimization. Total demo bundle: 3-5MB for 12 photos. This is reasonable for a git repository and loads quickly even on 3G connections.

4. **End-of-Demo CTA Design**
   - What we know: After one cycle, show "Watch again" and "Use your own photos" options. No pressure, casual tone.
   - What's unclear: Exact visual design (full-screen overlay vs. smaller notification). Marked as "Claude's Discretion."
   - Recommendation: Full-screen overlay matching the slideshow aesthetic (dark background, blurred backdrop). Two large buttons with clear labels. Include a brief tagline like "That's a taste of Okno" or "Your photos would look even better."

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- All source files read directly: `server.js`, `auth.js`, `photo-proxy.js`, `photo-cache.js`, `config.js`, `picker.js`, `health.js`, `feedback.js`, `slideshow.html`, `index.html`, `settings.html`, `sw.js`, `manifest.json`, `package.json`, `.gitignore`, `stripe.env.example`
- **Stripe Payment Links documentation** -- https://docs.stripe.com/payment-links -- creating links, sharing, buy button embed
- **Stripe buy button documentation** -- https://docs.stripe.com/payment-links/buy-button -- `<stripe-buy-button>` web component syntax
- **Stripe Payment Links creation** -- https://docs.stripe.com/payment-links/create -- "customers choose what to pay" option for donations
- **sharp API documentation** -- https://sharp.pixelplumbing.com/api-output -- `withExif()`, `withMetadata()`, resize, JPEG options
- **Prior v1.1 architecture research** -- `.planning/research/v1.1-ARCHITECTURE.md` and `.planning/research/SUMMARY.md`

### Secondary (MEDIUM confidence)
- **Unsplash license** -- Grants irrevocable, worldwide license to download, copy, modify, distribute for any purpose. Only restriction: cannot compile to replicate a competing photo service. Bundling 12 photos in a demo mode for a photo frame is clearly permitted. Source: https://unsplash.com/license and Unsplash help center articles.
- **Pexels license** -- Creative Commons Zero (CC0), completely free for any legal purpose. Source: https://www.pexels.com/license/
- **Stripe CSP requirements** -- Buy button requires `frame-src: https://js.stripe.com` and `script-src: https://js.stripe.com`. Plain `<a href>` link requires no CSP changes. Source: Stripe documentation and community resources.

### Tertiary (LOW confidence)
- **Pixabay license** -- CC0, similar terms to Pexels. Not verified with official docs (403 on fetch), but consistent across multiple web search results.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Stripe Payment Links and Express static file serving are well-documented, mature solutions. Sharp is already in the project. Zero new runtime dependencies.
- Architecture: HIGH -- Route-based demo mode with complete isolation is the cleanest pattern. Codebase has been fully analyzed; all integration points identified. Prior v1.1 architecture research validated the approach (with adjustments for context decisions).
- Pitfalls: HIGH -- All pitfalls are based on direct codebase analysis (CSP configuration, Service Worker caching, photo proxy auth flow) and standard web development patterns.

**Research date:** 2026-02-15
**Valid until:** 2026-03-17 (30 days -- stable domain, no rapidly changing dependencies)
