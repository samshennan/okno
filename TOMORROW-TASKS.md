# OKNO - Tomorrow's Tasks
**Date**: February 12, 2026

## Priority 1: Fix Bugs (Immediate)

### 1. Fix Form Submission Error ⚠️
**Issue**: Feedback form shows "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
**Root Cause**: Backend `/api/feedback` endpoint likely returning HTML instead of JSON
**Fix**:
- Check `feedback.js` router
- Ensure proper JSON response
- Test all three paths: Bug/Feature/Donation

### 2. Invert Modal Input Shadows 🔄
**Issue**: Input fields in modal look RAISED instead of SUNKEN
**Current**: Using raised shadows (looks like buttons)
**Target**: Invert to inset shadows (carved into surface)
**Fix**:
```css
.form-input, .form-textarea {
  box-shadow: inset -4px -4px 8px rgba(174, 174, 192, 0.2),
              inset 4px 4px 8px #FFFFFF;
}
```

---

## Priority 2: Visual Polish (Design)

### 3. Replace System Fonts 🔤
**Current**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
**Issue**: Generic, doesn't match premium feel
**Options to research**:
- **Inter** (modern, clean, free) - https://rsms.me/inter/
- **Space Grotesk** (geometric, sophisticated)
- **Plus Jakarta Sans** (warm, readable)
- **Outfit** (rounded, friendly)
- **Manrope** (balanced, modern)

**Decision criteria**:
- Free/open source
- Variable font support
- Good readability at small sizes
- Pairs well with neumorphic aesthetic

### 4. Replace Emojis with Icon Set 🎨
**Current**: Using emojis (🪟 🐛 ✨ 💝 📎)
**Issue**: Inconsistent across platforms, not professional
**Options**:
- **Lucide** (clean, modern, MIT license) - https://lucide.dev/
- **Phosphor Icons** (flexible weights, extensive) - https://phosphoricons.com/
- **Tabler Icons** (800+ icons, outlined style) - https://tabler-icons.io/
- **Heroicons** (by Tailwind team) - https://heroicons.com/

**Replace**:
- 🪟 Window icon → `square-split` or `layout-grid`
- 🐛 Bug → `bug` icon
- ✨ Feature → `sparkles` or `lightbulb`
- 💝 Donation → `heart` or `gift`
- 📎 Attachment → `paperclip`

### 5. Custom Logo Design 🎯
**Current**: Text "OKNO" + window emoji
**Goal**: Professional, memorable iconography

**Concept Direction**:
- Window/frame metaphor
- Time/memory concept
- Photo frame aesthetic
- Minimalist, works at 32px and 512px

**Process**:
1. Use Gemini CLI (via 1Password key pool) to generate logo concepts
2. Prompt ideas:
   - "minimalist logo of a window frame with subtle time/memory symbolism"
   - "geometric photo frame icon, line art style"
   - "modernist window icon representing a portal to memories"
3. Use nanobanana to refine/generate final SVG
4. Create favicon, app icon, and header logo

---

## Priority 3: Core Functionality (Architecture)

### 6. Multi-User Architecture Decision 🏗️

**Current State**:
- OAuth with Google
- Photos cached on YOUR VPS in `/cache`
- Single-user assumption

**User's Question**:
> "Could we store their JSON for images recall on their browser cache locally instead of on my VPS?"

**Options to Research**:

#### Option A: Client-Side Storage (Your Preference)
**How it works**:
1. User signs in with Google
2. App gets OAuth token → stores in browser (localStorage/IndexedDB)
3. User selects photos → App stores selection in browser
4. Slideshow fetches directly from Google Photos API using their token
5. VPS only serves HTML/JS, no user data stored

**Pros**:
- ✅ Zero storage on your VPS
- ✅ No liability for user data
- ✅ Scales to unlimited users
- ✅ Users control their own data
- ✅ No privacy concerns

**Cons**:
- ❌ Clears with cache/cookies
- ❌ Doesn't sync across devices
- ❌ Needs to re-auth frequently
- ❌ Higher API quota usage (each client calls Google)

#### Option B: Server-Side Storage (Current Model)
**How it works**:
1. User signs in → VPS stores OAuth refresh token
2. User selects photos → VPS caches photos
3. Slideshow fetches from VPS cache
4. Each user: ~50MB-500MB storage (depends on photo count)

**For 100 users**:
- Storage: 5GB - 50GB
- Database: User IDs + tokens
- Security risk: You're custodian of OAuth tokens

**Pros**:
- ✅ Persistent across devices
- ✅ Works offline (cached photos)
- ✅ Lower Google API usage
- ✅ Faster slideshow (local cache)

**Cons**:
- ❌ You store sensitive tokens
- ❌ Storage costs scale
- ❌ Privacy/security liability
- ❌ GDPR compliance needed

#### Option C: Hybrid Approach
**How it works**:
1. Client stores selection + token (IndexedDB)
2. VPS only caches photo URLs (not images)
3. Slideshow fetches from Google on-demand
4. Optional: User can "pin" setup to VPS for persistence

**Best of both worlds**:
- Default: Client-side (zero VPS storage)
- Opt-in: Server-side for persistence
- Clear consent + data deletion flow

### 7. Security for 100 Users 🔐

**If Server-Side Storage**:
Must implement:
- **Encryption at rest**: Encrypt OAuth tokens in DB
- **User data isolation**: Each user's cache separate
- **Data deletion**: "Delete my data" button
- **Rate limiting**: Prevent abuse
- **HTTPS only**: No unencrypted transmission
- **Terms of Service**: Legal coverage
- **Privacy Policy**: GDPR compliance

**If Client-Side Storage**:
Much simpler:
- Users control their own tokens
- No personal data on VPS
- Just serve static files
- Minimal legal exposure

---

## Priority 4: Monetization Strategy

### 8. PayPal Integration Discussion 💰

**Current**: Hardcoded PayPal link (placeholder)

**Options**:
1. **Donation Link** (current)
   - Free for everyone
   - Voluntary donations
   - No risk, no obligation

2. **Pay-What-You-Want**
   - Suggested: $5/year
   - Optional: $0 still works
   - Honor system

3. **Freemium Model**
   - Free: 50 photos, client-side storage
   - Premium ($5/year): 500 photos, server cache, multi-device sync

4. **One-Time Purchase**
   - $10 lifetime license
   - Simple, no subscriptions
   - Good for gift market

**Low-Risk Approach**:
- Keep 100% free for now
- Add donation button that actually works
- Track engagement
- Add premium features later if demand exists

---

## Implementation Plan (Tomorrow)

### Morning (2 hours)
1. ✅ Fix feedback form JSON error
2. ✅ Invert input field shadows
3. ✅ Test bug/feature submission end-to-end

### Midday (2 hours)
4. ✅ Research + select font (Inter recommended)
5. ✅ Research + select icon set (Lucide recommended)
6. ✅ Replace emojis with icons

### Afternoon (2 hours)
7. ✅ Use Gemini CLI to generate logo concepts
8. ✅ Refine with nanobanana
9. ✅ Implement new logo across site

### Evening (1 hour)
10. ✅ Document multi-user architecture decision
11. ✅ Write security assessment
12. ✅ Create decision doc for storage approach

---

## Key Decisions Needed

### Decision 1: Storage Architecture
**Question**: Client-side vs Server-side storage for multi-user?

**Recommendation**: **Client-side first** (Option A)
- Zero risk for you
- Infinite scale
- Fast to implement
- Add server-side later if users request it

**Implementation**:
- Store OAuth token in IndexedDB (encrypted)
- Store photo selection in localStorage
- Fetch directly from Google Photos API
- No VPS database needed

### Decision 2: Font
**Recommendation**: **Inter Variable**
- Modern, professional
- Variable font (one file, all weights)
- Excellent readability
- Free, SIL license
- Used by GitHub, Mozilla, more

### Decision 3: Icons
**Recommendation**: **Lucide**
- Clean, consistent style
- MIT license
- React/Vue/Svelte components
- Tree-shakeable (small bundle)
- Matches neumorphic aesthetic

### Decision 4: Logo
**Process**:
1. Generate 5 concepts with Gemini
2. Pick best concept
3. Refine with nanobanana
4. Create SVG + favicon

---

## Out of Scope (Future)

- Dark mode
- Animation library
- Mobile app
- Desktop app
- Smart display integration
- AI photo selection
- Multi-room sync
- Voice control

---

## Notes from Today

### What Went Well ✅
- Neumorphic redesign looks great on slideshow
- Colors work well (#F0F0F3 base, #8FB5A5 accent)
- Shadow system is cohesive
- Deployment (eventually) succeeded

### What Went Wrong ❌
- Initial deployment didn't actually push files
- Feedback form submission broken
- Input fields have wrong shadow direction
- Font choice not intentional
- Emojis inconsistent

### Lessons Learned 📚
- Always verify files actually changed on server (don't trust deployment script)
- Test form submissions end-to-end
- Need proper icon system, not emojis
- Design system needs better font selection

---

## Summary

Tomorrow's focus:
1. **Fix bugs** (form submission, input shadows)
2. **Polish design** (font, icons, logo)
3. **Architecture decision** (client-side vs server storage)
4. **Security planning** (if going multi-user)

**Priority order**: Bugs → Design → Architecture → Strategy

**Time estimate**: 6-8 hours total work

**Blockers**: None - all tasks can be done independently
