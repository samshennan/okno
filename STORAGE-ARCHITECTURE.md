# OKNO Storage Architecture - Multi-User Strategy

## The 3-Tier Storage Model

You've outlined a smart, flexible approach:

### Option 1: Local Storage (Photos + JSON)
**What's stored where:**
- Browser IndexedDB: Photo URLs/metadata JSON + cached photo blobs
- Your VPS: Nothing

**UX:**
- ✅ Works offline completely
- ✅ Fast slideshow (local photos)
- ✅ No server dependency
- ❌ Lost if cache cleared
- ❌ Doesn't sync across devices
- ❌ Large storage (50-500MB)

### Option 2: Local JSON Only
**What's stored where:**
- Browser localStorage: Photo URLs/metadata JSON (~1-5KB)
- Your VPS: Nothing
- Photos: Fetched from Google on-demand

**UX:**
- ✅ Lightweight (5KB vs 500MB)
- ✅ Selection persists in browser
- ✅ Always shows latest photos from Google
- ❌ Lost if cache cleared
- ❌ Requires internet for slideshow
- ❌ Higher Google API usage

### Option 3: VPS JSON Storage
**What's stored where:**
- Your VPS Database: User ID + Photo URLs/metadata JSON
- Browser: Session token only
- Photos: Fetched from Google on-demand

**UX:**
- ✅ Syncs across devices
- ✅ Survives cache clear
- ✅ No re-selection needed
- ✅ Can share "My Okno" link
- ❌ Requires VPS account
- ❌ GDPR considerations (see below)

---

## GDPR Analysis: Storing Photo URLs/Metadata

### The Legal Question
**"If we store a JSON with their photo links on VPS, am I at risk of GDPR stuff?"**

### Short Answer: **YES, but it's manageable**

Photo URLs are **personal data** under GDPR because:
1. They link to identifiable photos (faces)
2. URLs can contain user IDs or identifying info
3. Metadata (dates, locations) may be included
4. Combined with your user database = clearly personal data

### GDPR Obligations If You Store URLs

#### 1. Legal Basis (Pick One)
**Option A: Consent** (Easiest)
```
✅ "Allow Okno to store your photo selection on our server?"
   [ ] Yes, sync across devices
   [ ] No, store locally only
```

**Option B: Legitimate Interest**
- Harder to justify
- Requires balancing test
- More legal complexity

#### 2. Required Implementations

**Technical:**
- ✅ HTTPS only (already have)
- ✅ Encrypt photo URLs in database (bcrypt/AES)
- ✅ Separate user data (one table per user or isolated rows)
- ✅ Secure authentication (OAuth already does this)
- ✅ API rate limiting (prevent abuse)

**Legal/UX:**
- ✅ Privacy Policy page (clear, simple language)
- ✅ Terms of Service (basic, user-friendly)
- ✅ Consent checkbox (opt-in, not pre-checked)
- ✅ "Delete My Data" button (one-click purge)
- ✅ Data export (JSON download of their data)
- ✅ Retention policy ("We delete after 1 year of inactivity")

#### 3. Privacy Policy Template (Simple Version)

```markdown
# Okno Privacy Policy

## What We Store
- Your Google user ID (to identify your account)
- Links to photos you selected from Google Photos
- Last login date

## What We DON'T Store
- Your actual photos (we never download or store images)
- Your Google password (we use secure OAuth)
- Any personal information beyond what's needed

## Your Rights
- **Access**: Download your data anytime
- **Deletion**: Delete your account with one click
- **Portability**: Export your data as JSON
- **Control**: Choose local or server storage

## How We Protect Your Data
- Encrypted storage
- HTTPS only
- Secure authentication
- Regular security updates

## Data Retention
- We delete inactive accounts after 1 year
- You can delete anytime

## Contact
- Email: privacy@moonacle.com
- Delete data: [Account Settings] → [Delete My Data]

Last updated: February 2026
```

### GDPR Risk Assessment

| Storage Type | GDPR Risk | Complexity | User Benefit |
|--------------|-----------|------------|--------------|
| Local only | **None** | Low | Device-specific |
| VPS URLs | **Low-Medium** | Medium | Multi-device sync |
| VPS Photos | **High** | High | ❌ Don't do this |

**Verdict**: Storing URLs/JSON on VPS is **low-medium risk** with proper safeguards.

---

## Google Photos Picker API - UX Limitations

### What You Can Control

**Current Implementation:**
```javascript
// Create picker session
POST /api/picker/start

// User opens Google's picker UI
window.open(pickerUrl)

// User selects photos in Google's interface
// (NO customization available here)

// Get results
GET /api/picker/complete/:sessionId
```

### What You CANNOT Customize ❌

The Picker API is **a black box** - Google controls the entire UI:

- ❌ **No filtering** (can't filter by date, location, person)
- ❌ **No sorting** (can't sort by date, name, etc.)
- ❌ **No album view customization**
- ❌ **No search**
- ❌ **No bulk actions** (can't "select all from 2024")
- ❌ **No preview sizes**
- ❌ **No custom buttons/actions**

**You get what Google gives you** - which is just the selection result.

### What You CAN Enhance (Post-Selection)

**After they pick photos**, you can add features:

#### 1. Selection Management UI
```
Your Selected Photos (24)
┌────────────────────────┐
│ [x] [x] [x] [x] [x]   │  ← Thumbnails with remove buttons
│ [x] [x] [x] [x] [x]   │
│                        │
│ [Add More Photos]      │  ← Reopen picker
│ [Clear All]            │
│ [Save Selection]       │
└────────────────────────┘
```

#### 2. Smart Sorting/Filtering (Client-Side)
After selection, you can organize:
```javascript
// Sort by date
photos.sort((a, b) => a.mediaMetadata.creationTime - b.mediaMetadata.creationTime)

// Filter portraits vs landscape
const portraits = photos.filter(p => p.height > p.width)

// Group by date/year
const byYear = groupBy(photos, p => new Date(p.creationTime).getFullYear())
```

#### 3. Slideshow Preferences
```
Slideshow Settings
[ ] Show in chronological order
[ ] Randomize each time
[ ] Skip portrait photos
[ ] Skip screenshots
[✓] Include all selected photos

Interval: [5 seconds ▼]
```

#### 4. Smart Albums (Client-Side Analysis)
```javascript
// After selection, analyze locally:
- "Your Year in Review 2024" (filter by year)
- "Landscapes" (filter by aspect ratio)
- "Recent Picks" (sort by selection date)
- "Favorites" (user can star photos)
```

### Best UX Pattern

**Initial Selection** (Google's Picker):
1. User clicks "Select Photos"
2. Google's picker opens (their UI, can't customize)
3. User selects 50 photos
4. Picker returns results

**Post-Selection Enhancement** (Your UI):
```
✓ 50 photos selected!

View & Organize:
━━━━━━━━━━━━━━━━━━━━━━━━
[Grid View] [List View]

Sort: [Date ▼] [Name] [Size]
Filter: [All ▼] [2024] [2023]...

[x] Photo1.jpg    Dec 2024
[x] Photo2.jpg    Nov 2024
[ ] Photo3.jpg    Oct 2024  ← User can deselect

[✓ Save Selection]
[+ Add More Photos]
```

---

## Recommended Architecture: Hybrid Model

### Implementation

```javascript
// On first use
const userChoice = prompt('How do you want to store your selection?')

if (userChoice === 'sync') {
  // Option 3: Store JSON on VPS
  await fetch('/api/user/photos', {
    method: 'POST',
    body: JSON.stringify({ photos: selectedPhotos })
  })
  localStorage.setItem('storage-mode', 'server')

} else {
  // Option 2: Store JSON locally only
  localStorage.setItem('okno-photos', JSON.stringify(selectedPhotos))
  localStorage.setItem('storage-mode', 'local')
}

// Later, when loading slideshow
const mode = localStorage.getItem('storage-mode')
if (mode === 'server') {
  photos = await fetch('/api/user/photos').then(r => r.json())
} else {
  photos = JSON.parse(localStorage.getItem('okno-photos'))
}
```

### User Choice Dialog

```
┌─────────────────────────────────────┐
│  How should Okno remember your      │
│  photo selection?                   │
│                                     │
│  ○ On this device only              │
│    • Works offline                  │
│    • Most private                   │
│    • Lost if you clear browser data │
│                                     │
│  ○ Sync across devices              │
│    • Access from any device         │
│    • Survives browser resets        │
│    • Stored securely on our server  │
│                                     │
│  [Learn more] [Continue]            │
└─────────────────────────────────────┘
```

---

## Database Schema (If Using VPS Storage)

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,           -- Google user ID (hashed)
  email_hash VARCHAR(255),               -- Email (hashed for lookups)
  created_at TIMESTAMP,
  last_login TIMESTAMP,
  storage_preference ENUM('local', 'server')
);
```

### Photo Selections Table
```sql
CREATE TABLE photo_selections (
  user_id VARCHAR(255) REFERENCES users(id),
  photo_data TEXT,                       -- Encrypted JSON blob
  updated_at TIMESTAMP,
  PRIMARY KEY (user_id)
);
```

### Encryption Example
```javascript
const crypto = require('crypto');

// Encrypt photo URLs before storing
function encryptPhotos(photos, userSecret) {
  const cipher = crypto.createCipher('aes-256-cbc', userSecret);
  const encrypted = cipher.update(JSON.stringify(photos), 'utf8', 'hex');
  return encrypted + cipher.final('hex');
}

// Decrypt when loading
function decryptPhotos(encrypted, userSecret) {
  const decipher = crypto.createDecipher('aes-256-cbc', userSecret);
  const decrypted = decipher.update(encrypted, 'hex', 'utf8');
  return JSON.parse(decrypted + decipher.final('utf8'));
}
```

---

## Compliance Checklist (If Storing URLs on VPS)

### Must Have (Legal)
- [ ] Privacy Policy page
- [ ] Terms of Service
- [ ] Consent checkbox (opt-in)
- [ ] "Delete My Data" button
- [ ] Data export function
- [ ] Contact email for privacy requests

### Must Have (Technical)
- [ ] Encrypt photo URLs in database
- [ ] HTTPS everywhere
- [ ] Secure session management
- [ ] Rate limiting
- [ ] SQL injection protection
- [ ] XSS protection
- [ ] CSRF tokens

### Nice to Have
- [ ] Data retention policy (auto-delete after 1 year inactive)
- [ ] Audit logs (who accessed what, when)
- [ ] 2FA for account access
- [ ] Email notifications (login from new device)
- [ ] GDPR data portability (one-click export)

---

## Cost & Scale Analysis

### 100 Users Scenario

#### Local Storage (Option 1 & 2)
- **Your VPS cost**: $0 extra
- **Storage**: 0 bytes
- **Bandwidth**: ~50MB/month (just serving HTML/JS)
- **Total cost**: **~$5/month** (your current VPS)

#### VPS Storage (Option 3)
- **Database**: ~5KB per user = 500KB total
- **Bandwidth**: ~50MB/month
- **Backup storage**: ~1MB
- **Total cost**: **~$5/month** (fits in current VPS)

### 1,000 Users Scenario

#### Local Storage
- **Your cost**: Still **$5/month** (no extra resources)

#### VPS Storage
- **Database**: 5MB
- **Bandwidth**: ~500MB/month
- **Total cost**: **~$5-10/month** (may need larger VPS)

### 10,000 Users Scenario

#### Local Storage
- **Your cost**: **$5-10/month** (need better bandwidth)

#### VPS Storage
- **Database**: 50MB
- **Bandwidth**: ~5GB/month
- **Total cost**: **$20-30/month** (need database + CDN)

---

## Recommendation

### For Launch: **Hybrid Model**

**Default: Local JSON Storage (Option 2)**
- Zero GDPR risk for you
- Works for 99% of users
- Scales to unlimited users

**Optional: VPS Sync (Option 3)**
- Opt-in with consent
- Requires simple privacy policy
- Better UX for power users

**Implementation Priority:**
1. Week 1: Ship with local-only storage
2. Week 2: Add VPS sync as opt-in beta
3. Week 3: Add privacy policy + delete data
4. Week 4: Monitor which users prefer

### GDPR Risk Mitigation

If you store URLs on VPS:
1. ✅ Add privacy policy (template above)
2. ✅ Add "Delete My Data" button
3. ✅ Encrypt photo URLs in database
4. ✅ Make it OPT-IN with clear consent

**Risk Level**: **Low** (you're only storing URLs, not photos)

**Liability**: **Minimal** (simple terms + delete function = compliant)

---

## Picker API Enhancement Ideas

Since you can't customize Google's picker UI, enhance the **after-selection** experience:

### 1. Smart Photo Manager
```
Your Selection (50 photos)
━━━━━━━━━━━━━━━━━━━━━━━━
Sort: [Date ▼] [Shuffle]
View: [2024] [2023] [All]

[Grid of thumbnails with X buttons]

[Reopen Picker] [Clear All]
[Preview Slideshow]
```

### 2. Selection History
```
Recent Selections
━━━━━━━━━━━━━━━━━━━━━━━━
📅 Feb 11: "Winter 2024" (50 photos)
📅 Jan 15: "Holiday Memories" (30 photos)
📅 Dec 20: "Family Photos" (100 photos)

[Load] [Delete]
```

### 3. Quick Filters (Post-Selection)
```
After user selects 100 photos:

"That's a lot! Would you like to filter?"
[ ] Only photos from 2024
[ ] Only landscape orientation
[ ] Skip screenshots
[ ] Remove duplicates

Applied: 72 photos remaining
```

---

## Next Steps

1. **Fix bugs** (form submission, shadow inversion)
2. **Ship local-only version** first (zero GDPR risk)
3. **Test with 5-10 users**
4. **Add VPS sync option** if users request it
5. **Write simple privacy policy** (use template above)

**Start simple, add complexity only if needed.**
