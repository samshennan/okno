# Okno Roadmap

## Current Status: v0.1 (Family Use)
✅ Working slideshow for shared Google Photos library
✅ Two homes (Sam + Alicja)
✅ Email allowlist security
✅ 3 display modes (Fill Screen, Show All, 2 Portraits)
✅ Auto-refresh baseUrls every 50 minutes

---

## Phase 2: Photo Management (In Progress)
**Goal:** Edit photo selection without re-selecting 2000 photos every time

- [ ] Add `hidden` flag to cache structure
- [ ] Create "Manage Photos" page (`/manage.html`)
- [ ] Thumbnail grid view of all cached photos
- [ ] Toggle individual photos on/off
- [ ] "Select All" / "Unselect All" buttons
- [ ] Filter: "Show active" / "Show hidden"
- [ ] Photo count display: "Showing 1,847 of 2,000"
- [ ] Update slideshow to respect `hidden` flag

---

## Phase 3: Video Support
**Goal:** Include videos in slideshow rotation

- [ ] Add "Include Videos" toggle in settings
- [ ] Update Picker API to include video mimeTypes
- [ ] Detect video vs photo in cache
- [ ] Add `<video>` element support in slideshow
- [ ] Handle video playback with controls/autoplay
- [ ] Respect display modes for videos
- [ ] Add loading state for video buffering

**Technical considerations:**
- Videos use same baseUrl system (60-min expiry)
- Need to handle video duration (pause slideshow during playback?)
- File size concerns (bandwidth for large videos)

---

## Phase 4: Multi-Tenant (Public Release)
**Goal:** Make Okno usable by anyone, not just Sam + Alicja

**Sub-goal:** Open-source GitHub portfolio piece

### Authentication Changes:
- [ ] Remove global `tokens.json` - store per-session instead
- [ ] Remove global `cache.json` - store per-user instead
- [ ] Create per-user OAuth client instances
- [ ] Add session validation middleware
- [ ] Update photo-cache to support multiple users
- [ ] Add user account management UI

### User Isolation:
- [ ] Each user gets their own photo collection
- [ ] Sessions properly isolated (already done ✅)
- [ ] Cache keyed by user ID, not global
- [ ] No cross-user data leakage

### Documentation:
- [ ] README with setup instructions
- [ ] Docker deployment option
- [ ] Environment variable documentation
- [ ] Contributing guidelines
- [ ] License (MIT?)

### Testing:
- [ ] Multi-user test scenarios
- [ ] Security audit for public use
- [ ] Performance testing (100+ concurrent users)
- [ ] Browser compatibility testing

---

## Phase 5: Full Library Sync (Alternative to Picker)
**Goal:** Download entire Google Photos library to cloud storage instead of using Picker API

### Why?
- Picker API limit: 2000 photos max
- You have 2005-2026 library (likely >2000 photos)
- Want entire library available without re-selecting

### Implementation Options:

#### Option A: Google Photos Library API + Cloud Storage
```
1. Use Google Photos Library API (not Picker API)
2. Paginate through entire library (no 2000 limit)
3. Download all photos to S3/R2/BackBlaze
4. Store metadata in database
5. Serve photos from cloud storage
6. Periodic sync (daily/weekly) to update
```

**Pros:**
- Entire library available (unlimited photos)
- Faster loading (cached in cloud storage)
- No 60-minute baseUrl expiry issues
- Works offline (photos pre-downloaded)

**Cons:**
- Storage costs (2005-2026 library = ~100GB-500GB?)
- Download time (initial sync could take hours)
- Need database for metadata
- More complex architecture

#### Option B: On-Demand Caching
```
1. Use Google Photos Library API to list all items
2. Cache metadata only (no photo download)
3. Download photos on-demand when viewed
4. Cache most-viewed photos locally
5. LRU eviction when cache full
```

**Pros:**
- No storage costs for full library
- Faster initial setup
- Only stores what you actually view

**Cons:**
- Still have 60-minute baseUrl expiry
- Network dependent
- Slower first-view experience

#### Option C: Hybrid Approach (Recommended)
```
1. List entire library via Library API
2. Download thumbnails only (small, cheap)
3. Show thumbnail grid for selection
4. Download full-res on-demand for slideshow
5. Cache last 500 viewed photos
```

**Pros:**
- Best of both worlds
- Manageable storage costs
- Fast browsing experience
- Full-res when needed

**Cons:**
- More complex than A or B
- Still needs cloud storage

### Technical Requirements:
- [ ] Switch from Picker API to Library API
- [ ] Add cloud storage (S3/R2/BackBlaze)
- [ ] Add database (SQLite/PostgreSQL)
- [ ] Background sync job
- [ ] Photo download queue
- [ ] Cache management logic
- [ ] Storage quota monitoring

### Cost Estimates:
- **BackBlaze B2:** $6/TB/month storage, $0.01/GB download
  - 200GB library = ~$1.20/month storage
- **Cloudflare R2:** $15/TB/month, $0 egress (FREE downloads!)
  - 200GB library = ~$3/month
- **AWS S3:** $23/TB/month, $0.09/GB egress
  - 200GB library = ~$4.60/month + bandwidth costs

**Recommendation:** Use Cloudflare R2 (free egress = no surprise bills)

---

## Phase 6: Advanced Features (Nice-to-Haves)

### Smart Album Support:
- [ ] Detect Google Photos smart albums (People, Places)
- [ ] Filter slideshow by album
- [ ] "Memories" feature (this day in history)

### AI Features:
- [ ] Face detection for "family members only" filter
- [ ] Blur faces for "guest mode"
- [ ] Auto-hide screenshots/memes
- [ ] Smart cropping for dual portrait mode

### Hardware Integration:
- [ ] Motion sensor to wake display
- [ ] Ambient light sensor for brightness
- [ ] Physical buttons (next/previous)
- [ ] Raspberry Pi specific builds

### Social Features:
- [ ] QR code for guests to upload photos
- [ ] "Guest photos" temporary album
- [ ] Photo reactions/likes

---

## Priority Order (Recommended)

1. **Phase 2** (Photo Management) - CURRENT PRIORITY
   - Immediate need: don't re-select 2000 photos every time
   - Small scope, big impact

2. **Phase 5** (Full Library Sync) - IF you have >2000 photos
   - Check actual library size first
   - If under 2000, Picker API is fine

3. **Phase 3** (Video Support) - Nice-to-have
   - Low complexity, high delight factor

4. **Phase 4** (Multi-Tenant) - Before GitHub release
   - Required for public use
   - Portfolio piece goal

5. **Phase 6** (Advanced Features) - Future polish
   - After public release

---

## Open Questions

1. **How many total photos in your 2005-2026 library?**
   - If <2000: Picker API is fine
   - If >2000: Need Phase 5 (Full Library Sync)

2. **Are you hitting the 2000 photo limit in Picker?**
   - Or is there another issue preventing full selection?

3. **Storage budget for Phase 5?**
   - $1-5/month acceptable?
   - Or prefer to stay zero-cost?

4. **Timeline for GitHub release?**
   - Months? Year? Just a someday goal?

---

**Last Updated:** 2026-02-10
**Next Milestone:** Phase 2 (Photo Management UI)
