# Phase 4: Multi-Tenant Requirements

**Goal:** Make Okno usable by anyone with a Google Photos account, not just Sam + Alicja.

---

## Current Limitations (Single-Tenant)

### 🔴 Blocking Issues for Public Use

1. **Shared OAuth Tokens** (`tokens.json`)
   - Problem: ALL users share the same Google account's tokens
   - Impact: User B sees User A's photos
   - File: `auth.js:33-48`

2. **Shared Photo Cache** (`cache.json`)
   - Problem: Only one photo collection can exist at a time
   - Impact: When User B selects photos, User A's photos are erased
   - File: `photo-cache.js:20-32`

3. **Global OAuth Client** (`oAuth2Client`)
   - Problem: Single OAuth client instance for all users
   - Impact: Token refresh affects everyone
   - File: `auth.js:27-30`

4. **Email Allowlist** (`ALLOWED_EMAILS`)
   - Problem: Hardcoded list of authorized emails
   - Impact: Can't add new users without code deployment
   - File: `okno.env:10`

---

## What Phase 4 Needs to Change

### 1. Per-User OAuth Tokens (Session-Based)

**Current (Single-Tenant):**
```javascript
// auth.js - SHARED BY ALL USERS
const TOKEN_PATH = './tokens.json';
oAuth2Client.setCredentials(tokens); // Global
```

**Needed (Multi-Tenant):**
```javascript
// auth.js - PER-USER STORAGE
router.get('/callback', async (req, res) => {
  const { tokens } = await oAuth2Client.getToken(req.query.code);

  // Store tokens in session, NOT global file
  req.session.tokens = tokens;
  req.session.userId = userInfo.email; // or database user ID
  req.session.authenticated = true;

  // Don't save to tokens.json!
  res.redirect('/');
});
```

**Changes Required:**
- ✅ Remove `tokens.json` file storage
- ✅ Store tokens in `req.session.tokens`
- ✅ Create OAuth client per-request: `getOAuthClient(req)`
- ✅ Update all endpoints to use session tokens

---

### 2. Per-User Photo Cache (Database or Session)

**Current (Single-Tenant):**
```javascript
// photo-cache.js - SHARED BY ALL USERS
const CACHE_PATH = './cache.json';
let cache = { mediaItems: [] }; // Global
```

**Needed (Multi-Tenant):**

**Option A: Session Storage (Simple, No Database)**
```javascript
// photo-cache.js
function setItems(sessionId, items) {
  req.session.photoCache = {
    sessionId,
    mediaItems: items,
    lastRefresh: new Date().toISOString()
  };
}

function getRandomItem(sessionId) {
  const cache = req.session.photoCache;
  if (!cache || cache.mediaItems.length === 0) return null;
  return cache.mediaItems[Math.floor(Math.random() * cache.mediaItems.length)];
}
```

**Option B: Database Storage (Scalable, Persistent)**
```javascript
// Using SQLite, PostgreSQL, or MongoDB
function setItems(userId, sessionId, items) {
  await db.upsert('photo_caches', {
    user_id: userId,
    session_id: sessionId,
    media_items: JSON.stringify(items),
    last_refresh: new Date()
  });
}

function getRandomItem(userId) {
  const cache = await db.findOne('photo_caches', { user_id: userId });
  if (!cache || cache.media_items.length === 0) return null;
  const items = JSON.parse(cache.media_items);
  return items[Math.floor(Math.random() * items.length)];
}
```

**Changes Required:**
- ✅ Remove global `cache.json` file
- ✅ Add `userId` parameter to all cache functions
- ✅ Store cache per-user (session or database)
- ✅ Update all cache calls to pass `userId`

---

### 3. Remove Email Allowlist

**Current (Single-Tenant):**
```javascript
// auth.js - HARDCODED FAMILY
const allowedEmails = process.env.ALLOWED_EMAILS || '';
if (!allowedList.includes(userEmail)) {
  return res.status(403).send('Access denied');
}
```

**Needed (Multi-Tenant):**
```javascript
// auth.js - ALLOW ANYONE
// Just remove the email verification entirely!
// Or add user registration system

router.get('/callback', async (req, res) => {
  const { tokens } = await oAuth2Client.getToken(req.query.code);
  const userInfo = await getUserInfo(tokens);

  // Create or find user in database
  let user = await db.findOne('users', { email: userInfo.email });
  if (!user) {
    user = await db.insert('users', {
      email: userInfo.email,
      name: userInfo.name,
      created_at: new Date()
    });
  }

  // Store user ID in session
  req.session.userId = user.id;
  req.session.tokens = tokens;
  req.session.authenticated = true;

  res.redirect('/');
});
```

**Changes Required:**
- ✅ Remove `ALLOWED_EMAILS` check
- ✅ Add user database table
- ✅ Auto-create users on first login
- ✅ Store `userId` in session

---

### 4. Authentication Middleware

**Needed for all API endpoints:**

```javascript
// middleware/auth.js
function requireAuth(req, res, next) {
  if (!req.session.tokens || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function getOAuthClient(req) {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${req.protocol}://${req.get('host')}/auth/callback`
  );

  if (req.session.tokens) {
    client.setCredentials(req.session.tokens);
  }

  return client;
}

module.exports = { requireAuth, getOAuthClient };
```

**Apply to all routes:**
```javascript
// server.js
const { requireAuth } = require('./middleware/auth');

app.use('/api/picker', requireAuth, pickerRouter);
app.use('/api/photo', requireAuth, photoRouter);
app.use('/slideshow.html', requireAuth);
```

---

### 5. Database Schema (If Using Database)

**Minimal schema for multi-user:**

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Photo caches table (optional - can use sessions instead)
CREATE TABLE photo_caches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_id TEXT,
  media_items TEXT, -- JSON array
  last_refresh DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Hidden photos table (Phase 2 feature)
CREATE TABLE hidden_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  photo_id TEXT NOT NULL,
  hidden BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, photo_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Or use sessions (no database):**
```javascript
// Session structure
req.session = {
  userId: 'sam@samshennan.com',
  authenticated: true,
  tokens: { access_token: '...', refresh_token: '...' },
  photoCache: {
    sessionId: 'picker-session-123',
    mediaItems: [...],
    lastRefresh: '2026-02-10T22:51:59.620Z'
  },
  hiddenPhotos: ['photo-id-1', 'photo-id-2'] // Phase 2 feature
};
```

---

## File Changes Summary

### Files to Modify

1. **`auth.js`** (Major changes)
   - Remove `tokens.json` file storage
   - Store tokens in session
   - Remove email allowlist check (or add user registration)
   - Add `getOAuthClient(req)` helper
   - Update OAuth callback to create/find users

2. **`photo-cache.js`** (Major changes)
   - Remove global `cache.json` file
   - Add `userId` parameter to all functions
   - Store cache per-user (session or database)
   - Update refresh logic to use per-user tokens

3. **`picker.js`** (Minor changes)
   - Get OAuth client from `getOAuthClient(req)`
   - Store picker sessionId per-user

4. **`photo-proxy.js`** (Minor changes)
   - Get OAuth client from `getOAuthClient(req)`
   - Get photo from user's cache, not global cache

5. **`health.js`** (Minor changes)
   - Get OAuth client from `getOAuthClient(req)`
   - Get user's cache, not global cache

6. **`server.js`** (Minor changes)
   - Add `requireAuth` middleware to protected routes
   - Increase session storage (more users = more sessions)

### New Files to Create

1. **`middleware/auth.js`**
   - `requireAuth(req, res, next)` middleware
   - `getOAuthClient(req)` helper
   - `getUserId(req)` helper

2. **`database/schema.sql`** (if using database)
   - Users table
   - Photo caches table
   - Hidden photos table (Phase 2)

3. **`database/db.js`** (if using database)
   - Database connection
   - Query helpers (findOne, insert, update, etc.)

---

## Testing Requirements

### Multi-User Test Scenarios

1. **Two users, different browsers:**
   - User A logs in with alice@example.com → Selects 100 photos
   - User B logs in with bob@example.com → Selects 50 photos
   - ✅ User A still sees 100 photos (not Bob's 50)
   - ✅ User B still sees 50 photos (not Alice's 100)

2. **Token expiry:**
   - User A's token expires
   - ✅ Only User A gets 401, not User B
   - ✅ User A can re-authenticate without affecting User B

3. **Session isolation:**
   - User A signs out
   - ✅ User B's session unaffected
   - ✅ User A's photos cleared from session

4. **Concurrent usage:**
   - 10 users viewing slideshows simultaneously
   - ✅ No photo mixing between users
   - ✅ No performance degradation

---

## Deployment Considerations

### Session Storage

**Current (File-based):**
```javascript
// server.js
store: new FileStore({
  path: './sessions',
  ttl: 86400 * 365
})
```

**Problem:** File-based sessions don't scale well (100+ concurrent users)

**Solutions:**

1. **Redis (Recommended for production):**
```javascript
const RedisStore = require('connect-redis')(session);
const redis = require('redis');

app.use(session({
  store: new RedisStore({ client: redis.createClient() }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

2. **PostgreSQL (If already using database):**
```javascript
const pgSession = require('connect-pg-simple')(session);

app.use(session({
  store: new pgSession({
    conString: process.env.DATABASE_URL
  }),
  secret: process.env.SESSION_SECRET
}));
```

3. **Keep FileStore (OK for <100 users):**
- Works fine for small deployments
- No additional infrastructure needed
- Just ensure filesystem has enough space

---

## Security Considerations (Multi-User)

### New Attack Vectors

1. **Session hijacking**
   - Mitigation: httpOnly cookies ✅ (already implemented)
   - Mitigation: secure cookies ✅ (already implemented)
   - Mitigation: Short session timeouts (consider reducing from 1 year)

2. **User enumeration**
   - Mitigation: Don't reveal if email exists during login
   - Mitigation: Rate limit login attempts

3. **Photo leakage**
   - Mitigation: Always verify `userId` matches session
   - Mitigation: Add database foreign key constraints
   - Mitigation: Add unit tests for user isolation

4. **Cache poisoning**
   - Mitigation: Validate all photo IDs before storing
   - Mitigation: Sanitize user input (photo metadata)

---

## Effort Estimate

### Time to Complete Phase 4

**Small deployment (session-based, no database):**
- Refactor auth.js: 2 hours
- Refactor photo-cache.js: 2 hours
- Update all endpoints: 2 hours
- Testing: 2 hours
- **Total: 8 hours (1 day)**

**Large deployment (database + Redis):**
- Database setup: 2 hours
- Refactor auth.js: 3 hours
- Refactor photo-cache.js: 3 hours
- Add user management: 2 hours
- Update all endpoints: 3 hours
- Redis integration: 2 hours
- Testing: 3 hours
- **Total: 18 hours (2-3 days)**

---

## Recommended Approach

### Option A: Session-Based (Recommended for MVP)

**Pros:**
- ✅ No database needed
- ✅ Fast to implement (1 day)
- ✅ Works for <100 concurrent users
- ✅ Easy to test

**Cons:**
- ❌ Sessions lost on server restart (use Redis for persistence)
- ❌ Photo cache lost when session expires
- ❌ Hard to implement features like "user dashboard"

### Option B: Database + Sessions (Recommended for Scale)

**Pros:**
- ✅ Persistent user accounts
- ✅ Photo cache survives restarts
- ✅ Can build user dashboard, analytics
- ✅ Scales to 1,000+ users

**Cons:**
- ❌ Requires database setup
- ❌ More complex (2-3 days to implement)
- ❌ Additional infrastructure cost

---

## Decision Point

**For GitHub open-source release:**
- Start with **Option A (Session-Based)** for simplicity
- Self-hosters can add database if needed
- Document both approaches in README

**For managed hosting (monetization):**
- Use **Option B (Database + Redis)** for scalability
- Charge $49.99/year per account
- Need user dashboard, billing integration

---

## Next Steps (When Ready for Phase 4)

1. Decide: Session-based or database?
2. Set up local test environment with 2 Google accounts
3. Refactor auth.js (remove tokens.json, use sessions)
4. Refactor photo-cache.js (add userId parameter)
5. Add authentication middleware
6. Update all endpoints (picker, photo, health)
7. Test with 2 users simultaneously
8. Deploy to staging environment
9. Document multi-user setup in README
10. Launch public beta!

---

**Phase 4 Complexity:** Medium (8-18 hours depending on approach)
**Blocking for:** Public GitHub release, monetization
**Priority:** After Phase 2 (Photo Management) and Phase 3 (Video Support)
