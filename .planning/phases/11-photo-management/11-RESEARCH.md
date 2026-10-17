# Phase 11: Photo Management - Research

**Researched:** 2026-03-12
**Domain:** Photo hiding/unhiding with SQLite persistence, slideshow UI overlays, settings page thumbnail grid
**Confidence:** HIGH

## Summary

Phase 11 adds the ability to hide photos from the slideshow and manage hidden photos from the settings page. The implementation touches four layers: DB schema (new `hidden` column), backend cache logic (filter hidden items), API endpoints (hide/unhide), and two frontend pages (slideshow hide button + settings thumbnail grid).

The codebase already has all the patterns needed. The `photo_cache` table has a UNIQUE constraint on `(user_id, media_item_id)` -- adding a `hidden` column via migration v2 is straightforward. The in-memory cache (`Map<userId, CacheData>`) filters items for random selection in `getRandomItem()` and similar functions. The slideshow already passes `X-Photo-Id` in response headers, giving the frontend the `mediaItemId` needed for the hide API call. The settings page has established patterns for sections, toasts, and fetching data from API endpoints.

**Primary recommendation:** Add `hidden INTEGER DEFAULT 0` column to `photo_cache` via migration v2, filter hidden items in all `getRandomItem`/`getOnThisDayItems`/`getPortraitItems` functions, and use the existing `X-Photo-Id` response header as the identifier for hide requests.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | existing | DB with `hidden` column | Already used, WAL mode, prepared statements |
| Express | existing | API routes for hide/unhide | Already used for all API endpoints |
| Lucide Icons | 0.564.0 | Icons for hide button, restore button | Already loaded in both slideshow.html and settings.html |

### No New Libraries Needed
This phase requires zero new dependencies. Everything is built with existing patterns:
- DB migration: `db/migrate.js` pattern (PRAGMA user_version)
- API routes: Express router pattern (see `photo-proxy.js`, `config.js`)
- Frontend: Vanilla JS + fetch + existing CSS design system
- Thumbnails: Google Photos baseUrl with `=w240-h240-c` suffix (needs validation)

## Architecture Patterns

### Recommended Changes by File

```
db/migrate.js          # Add migration v2: ALTER TABLE photo_cache ADD COLUMN hidden
photo-cache.js         # Filter hidden items in getRandomItem, getOnThisDayItems, getPortraitItems
                       # Add hideItem(), unhideItem(), getHiddenItems(), unhideAll()
photo-proxy.js         # Add POST /hide/:mediaItemId and POST /unhide/:mediaItemId
                       # Add GET /hidden (returns hidden items list with thumbnail URLs)
                       # Add POST /unhide-all
server.js              # No changes needed (photo routes already mounted at /api/photo)
public/slideshow.html  # Add hide button overlay, toast with undo
public/settings.html   # Add hidden photos section with thumbnail grid
```

### Pattern 1: DB Migration v2
**What:** Add `hidden` column to existing `photo_cache` table
**When to use:** Schema changes on existing tables
**Example:**
```javascript
// In db/migrate.js, after the version < 1 block:
if (version < 2) {
  db.transaction(() => {
    db.exec('ALTER TABLE photo_cache ADD COLUMN hidden INTEGER DEFAULT 0');
    db.pragma('user_version = 2');
  })();
}
```
**Confidence:** HIGH -- this is the exact pattern already used in migrate.js. SQLite ALTER TABLE ADD COLUMN is safe, sets default for existing rows.

### Pattern 2: In-Memory Cache Filtering
**What:** Filter hidden items from random selection without removing them from the cache array
**When to use:** Items need to be excluded from selection but still present in cache for management
**Example:**
```javascript
// In photo-cache.js getRandomItem():
function getRandomItem(userId) {
  const cache = getUserCache(userId);
  const visible = cache.mediaItems.filter(item => !item.hidden);
  if (visible.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * visible.length);
  return visible[randomIndex];
}
```
**Key decision:** Store `hidden` flag on the in-memory item object (alongside the JSON data from Google). When loading from DB, check the `hidden` column and set `item.hidden = true` on the parsed object.

### Pattern 3: Photo ID Flow (Slideshow to Hide API)
**What:** The slideshow already receives `X-Photo-Id` header from `photo-proxy.js` (line 115: `res.set('X-Photo-Id', item.id)`). The frontend needs to store this ID and send it with the hide request.
**How it works:**
1. `photo-proxy.js` sets `X-Photo-Id` header on every response
2. `createPhotoElement()` in slideshow.html reads response headers
3. Store photo ID in `img.dataset.photoId`
4. When user taps "Hide", read `dataset.photoId` from the currently active photo
5. POST to `/api/photo/hide/{photoId}`

**Confidence:** HIGH -- the header is already set. Currently the frontend reads `X-Photo-CreateTime` and `X-Photo-OnThisDayCount` from headers, so the pattern is established.

### Pattern 4: Thumbnail URLs for Settings Grid
**What:** Google Photos baseUrl with size parameters for thumbnails
**Format:** `{baseUrl}=w240-h240-c` (240x240 center-cropped square)
**Concern from STATE.md:** "Picker API thumbnail URL format (=w240-h240-c) needs validation in Phase 11"

**Research finding:** The Google Photos API baseUrl parameter format `=w{width}-h{height}-c` is documented and works for both the Library API and Picker API. The `-c` suffix means "crop to square." The existing codebase already uses `=w2048-h1536` for full-size images (photo-proxy.js line 85). Thumbnails should work the same way.

**Important:** baseUrls expire after ~60 minutes. The thumbnail grid in settings will need to proxy through the backend (same as full photos), OR fetch thumbnails on-demand when the settings page loads. Since the settings page is not a long-running view, fetching thumbnails on page load via a backend proxy endpoint is the simplest approach.

**Thumbnail proxy approach:**
- `GET /api/photo/thumbnail/:mediaItemId` -- proxies a 240x240 thumbnail from Google
- Reuses the same auth token pattern as `/api/photo/random`
- Settings page fetches thumbnails as `<img src="/api/photo/thumbnail/{id}">` -- simple, no CORS issues

**Confidence:** MEDIUM -- the `=w240-h240-c` format is standard Google Photos, but Picker API baseUrls may differ from Library API baseUrls. Needs runtime validation.

### Pattern 5: Toast with Undo (Slideshow)
**What:** After hiding a photo, show a toast notification with "Undo" button
**Design:** The settings page already has a toast pattern (line 758-763 in settings.html). The slideshow needs a dark-themed version with an interactive Undo button.
**Timing flow:**
1. User taps "Hide" on current photo
2. POST `/api/photo/hide/{id}` fires immediately
3. Toast appears: "Photo hidden [Undo]"
4. Slideshow advances to next photo (no pause)
5. If user taps "Undo" within toast duration (~4s): POST `/api/photo/unhide/{id}`, toast disappears
6. After ~4s, toast auto-dismisses

**Confidence:** HIGH -- standard UI pattern, no special library needed.

### Anti-Patterns to Avoid
- **Don't remove hidden items from the in-memory cache array:** They need to stay for the hidden photos grid and unhide functionality. Just filter them out of random selection.
- **Don't serve thumbnails directly from Google baseUrls in the browser:** baseUrls require Authorization headers that `<img>` tags cannot send (this is why the photo proxy exists).
- **Don't add a new DB table for hidden photos:** The `hidden` column on `photo_cache` is sufficient. A separate table would require JOINs and add complexity.
- **Don't pause the slideshow on hide:** The context explicitly says "Revealing controls does NOT pause the slideshow."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Thumbnail proxy | Custom image resizing | Google's `=w240-h240-c` URL params + same fetch proxy pattern | Google does the resize server-side |
| Toast component | Complex notification system | Simple div with setTimeout + CSS transition | Settings page already has this pattern |
| Confirm dialog | Custom modal component | Native `confirm()` or simple inline confirm pattern | "Unhide all" is a rare action, doesn't need a fancy modal |

## Common Pitfalls

### Pitfall 1: Hidden items still counted in `size()` and health endpoint
**What goes wrong:** After hiding photos, the health endpoint and slideshow "Photo X of Y" counter show wrong totals.
**How to avoid:** Update `size()` in photo-cache.js to return count of visible items only. Add a separate `hiddenCount()` function. Update health endpoint to report both `totalItems` (visible) and `hiddenItems`.

### Pitfall 2: Filtering performance on every random selection
**What goes wrong:** `cache.mediaItems.filter(item => !item.hidden)` runs on every photo request. With 2000 photos, this creates a new array every 10-30 seconds.
**How to avoid:** This is actually fine for 2000 items -- Array.filter on 2000 objects takes <1ms. Not worth optimizing with a separate visible/hidden array. Keep it simple.

### Pitfall 3: Race condition between hide and slideshow advance
**What goes wrong:** User hides a photo, slideshow advances, then Undo fires -- but the slideshow might have already fetched a new photo.
**How to avoid:** Undo simply POSTs unhide regardless of slideshow state. The photo won't appear immediately but will re-enter the random pool. No need to synchronize with slideshow timing.

### Pitfall 4: getUserCache loads hidden items as visible
**What goes wrong:** When loading from DB on startup, items with `hidden = 1` are loaded but their hidden flag isn't propagated to the in-memory object.
**How to avoid:** In `getUserCache()`, the `selectAll` query should include the `hidden` column. When parsing rows, set `item.hidden = !!row.hidden` on each parsed media item object.

### Pitfall 5: baseUrl expiry for thumbnail grid
**What goes wrong:** If the settings page is opened and the grid loads, but baseUrls have expired, all thumbnails show broken images.
**How to avoid:** The backend thumbnail proxy endpoint should handle this gracefully -- the same 50-minute refresh cycle that keeps slideshow URLs fresh will keep thumbnail URLs fresh. If a specific thumbnail fails, show a placeholder.

### Pitfall 6: Unhide-all doesn't update in-memory cache
**What goes wrong:** "Unhide all" updates the DB but the in-memory cache still has items flagged as hidden.
**How to avoid:** The unhide-all endpoint must also update the in-memory cache: iterate `cache.mediaItems` and set `item.hidden = false` for all items.

## Code Examples

### Migration v2 (verified pattern from existing migrate.js)
```javascript
if (version < 2) {
  db.transaction(() => {
    db.exec('ALTER TABLE photo_cache ADD COLUMN hidden INTEGER DEFAULT 0');
    db.pragma('user_version = 2');
  })();
}
```

### New prepared statements for photo-cache.js
```javascript
// Add to getStatements():
hideItem: db.prepare('UPDATE photo_cache SET hidden = 1 WHERE user_id = ? AND media_item_id = ?'),
unhideItem: db.prepare('UPDATE photo_cache SET hidden = 0 WHERE user_id = ? AND media_item_id = ?'),
unhideAll: db.prepare('UPDATE photo_cache SET hidden = 0 WHERE user_id = ?'),
selectHidden: db.prepare('SELECT media_item_id, media_item_data FROM photo_cache WHERE user_id = ? AND hidden = 1'),
countHidden: db.prepare('SELECT COUNT(*) as count FROM photo_cache WHERE user_id = ? AND hidden = 1'),
```

### Updated selectAll to include hidden column
```javascript
selectAll: db.prepare('SELECT media_item_id, media_item_data, session_id, hidden FROM photo_cache WHERE user_id = ?'),
```

### Hide button reveal mechanism (Claude's discretion)
**Recommendation:** Tap anywhere on slideshow to show/hide controls. The hide button appears alongside existing controls (Previous/Pause/Next). This reuses the existing tap-to-show-controls behavior -- the `#controls` div is already toggled by tapping.

Looking at the slideshow code, there's already a `#controls` div at the bottom with Previous/Pause/Next/Fullscreen/Exit buttons. The hide button should be placed in the **top-right corner** as a separate floating element (not inside `#controls`) because:
1. It's a destructive action -- should be separated from playback controls
2. Top-right is the least likely accidental tap zone on an iPad in landscape
3. It should appear/disappear with the same tap gesture that shows `#controls`

### API endpoint structure
```javascript
// POST /api/photo/hide/:mediaItemId
router.post('/hide/:mediaItemId', async (req, res) => {
  const userId = req.session.userId;
  const { mediaItemId } = req.params;
  photoCache.hideItem(userId, mediaItemId);
  res.json({ success: true });
});

// POST /api/photo/unhide/:mediaItemId
router.post('/unhide/:mediaItemId', async (req, res) => {
  const userId = req.session.userId;
  const { mediaItemId } = req.params;
  photoCache.unhideItem(userId, mediaItemId);
  res.json({ success: true });
});

// GET /api/photo/hidden -- list hidden items (for settings grid)
router.get('/hidden', async (req, res) => {
  const userId = req.session.userId;
  const items = photoCache.getHiddenItems(userId);
  res.json({ items: items.map(i => ({ id: i.id, createTime: i.createTime })) });
});

// POST /api/photo/unhide-all
router.post('/unhide-all', async (req, res) => {
  const userId = req.session.userId;
  photoCache.unhideAll(userId);
  res.json({ success: true });
});

// GET /api/photo/thumbnail/:mediaItemId -- proxy thumbnail
router.get('/thumbnail/:mediaItemId', async (req, res) => {
  // Same pattern as /random but for a specific item, using =w240-h240-c
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No photo management | Hide/unhide with DB persistence | Phase 11 | Users can curate their slideshow |

**No deprecated patterns to worry about.** This phase uses only established patterns from the existing codebase.

## Open Questions

1. **Thumbnail URL format validation**
   - What we know: `=w240-h240-c` is standard Google Photos URL parameter format. The codebase already uses `=w2048-h1536` for full images.
   - What's unclear: Whether Picker API baseUrls support the `-c` (crop) suffix identically to Library API baseUrls.
   - Recommendation: Implement with `=w240-h240-c`, test at runtime. Fall back to `=w240-h240` (no crop) if square crop fails. The thumbnail will still work, just won't be perfectly square.

2. **Controls reveal mechanism in slideshow**
   - What we know: The slideshow has a `#controls` div that appears on user interaction (keyboard shortcuts visible). There appears to be existing tap-to-show behavior.
   - What's unclear: The exact current tap handler -- need to verify if tapping already toggles controls visibility or if this needs to be added.
   - Recommendation: Investigate existing event listeners in slideshow.html during implementation. Add tap-to-reveal if not already present.

3. **Hidden items and On This Day / Portrait Pairs**
   - What we know: `getOnThisDayItems()` and `getPortraitItems()` filter from `cache.mediaItems`.
   - What's unclear: N/A -- these functions need the same `.filter(item => !item.hidden)` treatment.
   - Recommendation: Apply hidden filter consistently in ALL item selection functions.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `photo-cache.js`, `photo-proxy.js`, `db/migrate.js`, `server.js`, `config.js`, `health.js`, `picker.js`
- Codebase analysis: `public/slideshow.html`, `public/settings.html`
- `.planning/phases/11-photo-management/11-CONTEXT.md` -- user decisions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` -- thumbnail URL format concern flagged for Phase 11
- Google Photos API baseUrl parameter format (`=w{W}-h{H}-c`) -- based on existing codebase usage of `=w2048-h1536`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing patterns
- Architecture: HIGH -- clear file-by-file changes, no ambiguity
- DB migration: HIGH -- established pattern in migrate.js
- API endpoints: HIGH -- follows existing router patterns exactly
- Slideshow UI: MEDIUM -- tap-to-reveal mechanism needs implementation investigation
- Thumbnail proxy: MEDIUM -- baseUrl format needs runtime validation
- Pitfalls: HIGH -- based on direct codebase analysis

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain, no external API changes expected)
