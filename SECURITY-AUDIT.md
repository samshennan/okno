# Okno Security Audit
**Date:** 2026-02-10
**Auditor:** Claude (AI Assistant)
**Scope:** Multi-user session isolation and authentication security

---

## Executive Summary

🔴 **CRITICAL SECURITY ISSUE FOUND**: The current implementation uses a **single shared OAuth token** stored in `tokens.json` that is used by ALL users. This means:

1. **Anyone who uses the app sees the same photos** - whoever authenticated first
2. **Your wife will see YOUR photos** (or vice versa) instead of her own
3. **No user isolation** - the app is single-tenant, not multi-tenant

---

## Detailed Findings

### 🔴 CRITICAL: Shared OAuth Credentials (Single-Tenant Design)

**Location:** `auth.js:32-48`

**Issue:**
```javascript
// Token storage file - SHARED BY ALL USERS
const TOKEN_PATH = './tokens.json';

function loadTokens() {
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(tokens);  // ❌ SHARED GLOBALLY
  }
}
```

**Impact:**
- When User A authenticates, their tokens are saved to `tokens.json`
- When User B visits the site, they use User A's tokens
- User B sees User A's photos, not their own
- Only one Google account can be "active" at a time

**Evidence from code:**
1. `auth.js:33` - Single global `TOKEN_PATH = './tokens.json'`
2. `auth.js:40` - `oAuth2Client.setCredentials(tokens)` - shared OAuth client
3. `photo-cache.js:21` - Single global `CACHE_PATH = './cache.json'`
4. `picker.js:177` - `photoCache.setItems()` overwrites global cache

---

### 🔴 CRITICAL: Shared Photo Cache

**Location:** `photo-cache.js:20-32`

**Issue:**
```javascript
// Cache file path - SHARED BY ALL USERS
const CACHE_PATH = './cache.json';

// In-memory cache - GLOBAL STATE
let cache = {
  sessionId: null,
  mediaItems: [],  // ❌ ONE CACHE FOR EVERYONE
  lastRefresh: null
};
```

**Impact:**
- All users share the same photo cache
- When User B selects photos, it overwrites User A's photos
- Only one user's photo selection can exist at a time

---

### 🟡 MODERATE: Session-Based Authentication Flag

**Location:** `server.js:57-70`, `auth.js:144`

**Issue:**
```javascript
// In auth.js callback:
req.session.authenticated = true;  // ✅ Per-user session flag

// But this is meaningless because tokens are shared globally!
```

**Assessment:**
- Sessions ARE properly isolated (express-session with FileStore)
- Each browser gets its own session cookie
- BUT the session only stores `authenticated: true` flag
- The actual OAuth tokens are shared globally via `tokens.json`

**This creates a false sense of security** - sessions are isolated, but the underlying data is not.

---

### 🟢 SECURE: Session Management

**Location:** `server.js:57-70`

**Positive findings:**
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,  // ✅ Environment-based secret
  resave: false,
  saveUninitialized: false,
  store: new FileStore({
    path: './sessions',
    ttl: 86400 * 365  // 1 year
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // ✅ HTTPS in prod
    httpOnly: true,  // ✅ Prevents XSS
    maxAge: 365 * 24 * 60 * 60 * 1000
  }
}));
```

**Assessment:** Session management is properly configured with security best practices.

---

### 🟢 SECURE: CSRF Protection

**Location:** `auth.js:102-103`, `auth.js:125-128`

**Positive findings:**
```javascript
// Generate random state for CSRF protection
const state = crypto.randomBytes(32).toString('hex');
req.session.oauthState = state;

// Verify state in callback
if (req.query.state !== req.session.oauthState) {
  return res.status(403).send('State mismatch - possible CSRF attack');
}
```

**Assessment:** OAuth CSRF protection is properly implemented.

---

### 🟡 MODERATE: Environment Variables

**Location:** `server.js:58`, `auth.js:27-29`

**Issue:**
```javascript
secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
```

**Assessment:**
- Fallback to hardcoded secret in development
- Should fail loudly in production if not set
- Using 1Password for production secrets is ✅ good practice

---

## Attack Scenarios

### Scenario 1: Photo Stealing
1. Attacker visits okno.moonacle.com
2. Clicks "Select Photos" and authenticates with their Google account
3. Their tokens overwrite `tokens.json`
4. Legitimate user (you) visits the site
5. You see the attacker's photos instead of yours
6. You select YOUR photos
7. Attacker now has access to YOUR photos via the shared cache

### Scenario 2: Unintentional Family Photo Sharing
1. You authenticate and select family photos
2. Your wife visits the site from her device
3. She sees YOUR photos instead of her own
4. She can't select her own photos without erasing yours
5. Confusion and potential privacy breach

---

## Recommendations

### Option 1: Single-User Application (Quick Fix)
**If this app is only for you (not your wife or anyone else):**

✅ Add basic authentication/password protection
✅ Add warning banner: "This app is for personal use only"
✅ Don't share the link publicly
✅ Accept that tokens.json and cache.json are single-user

**Pros:** No code changes needed
**Cons:** Not suitable for multiple users

---

### Option 2: Multi-User Support (Proper Fix)

**Change token storage from file to session:**

1. **Store tokens in session instead of `tokens.json`:**
   ```javascript
   // In auth.js callback
   req.session.tokens = tokens;  // Per-user tokens
   req.session.authenticated = true;

   // Don't save to global tokens.json
   ```

2. **Create per-user OAuth client:**
   ```javascript
   function getOAuthClient(req) {
     const client = new OAuth2Client(...);
     if (req.session.tokens) {
       client.setCredentials(req.session.tokens);
     }
     return client;
   }
   ```

3. **Store photo cache per session:**
   ```javascript
   // In photo-cache.js
   const caches = new Map(); // sessionId -> cache

   function setItems(sessionId, items) {
     caches.set(sessionId, { mediaItems: items, ... });
   }
   ```

4. **Add session validation middleware:**
   ```javascript
   function requireAuth(req, res, next) {
     if (!req.session.tokens) {
       return res.status(401).json({ error: 'Not authenticated' });
     }
     next();
   }
   ```

**Pros:** Proper multi-user isolation
**Cons:** Requires significant refactoring

---

### Option 3: Hybrid Approach (Recommended for Now)

**Make it explicitly single-user with protection:**

1. Add environment variable `ALLOWED_EMAIL` to restrict who can authenticate
2. Check user email during OAuth callback
3. Reject authentication if email doesn't match
4. Add warning in UI: "Personal photo frame for [your-email]"

**Code changes needed:**
```javascript
// In auth.js callback
const { tokens } = await oAuth2Client.getToken(req.query.code);
oAuth2Client.setCredentials(tokens);

// Get user info to verify email
const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
const userInfo = await oauth2.userinfo.get();

// Check against allowed email
if (userInfo.data.email !== process.env.ALLOWED_EMAIL) {
  return res.status(403).send('Unauthorized email address');
}

// Continue with token save...
```

**Pros:** Quick fix, explicitly single-user, secure
**Cons:** Still single-user, not suitable for wife/family

---

## Immediate Actions Required

### 1. Decide on Use Case
**Question:** Do you want:
- **A) Personal photo frame (just you)** → Use Option 3 (Hybrid)
- **B) Family photo frame (you + wife + others)** → Use Option 2 (Multi-user)

### 2. If Personal (Option A):
- [ ] Add `ALLOWED_EMAIL` environment variable
- [ ] Add email validation in OAuth callback
- [ ] Add warning banner in UI
- [ ] Document that this is single-user only

### 3. If Family (Option B):
- [ ] Refactor to session-based token storage
- [ ] Refactor photo cache to be per-session
- [ ] Add authentication middleware
- [ ] Test multi-user isolation

---

## Additional Security Considerations

### ✅ Already Secure:
- HTTPS enforced in production (via nginx)
- Session cookies are httpOnly and secure
- CSRF protection for OAuth flow
- Helmet.js security headers
- OAuth tokens have refresh capability
- baseUrl refresh prevents expired URLs

### 🔍 Future Improvements:
- Rate limiting (prevent abuse)
- Request validation middleware
- Input sanitization
- Logging of authentication events
- Session timeout warnings
- "Remember this device" feature

---

## Conclusion

The current implementation is **suitable for a single-user personal photo frame** but **NOT suitable for multiple users** due to shared OAuth tokens and photo cache.

**Recommendation:** Implement Option 3 (email allowlist) immediately to prevent unauthorized access, then decide if Option 2 (full multi-user) is needed based on your use case.

---

## Questions for Decision Making

1. **Who will use this app?** (just you, you + wife, public)
2. **Should each user see their own photos?** (yes → multi-user needed)
3. **Is it okay if users share the same photo collection?** (yes → single-user is fine)
4. **How important is privacy between users?** (high → multi-user needed)

Let me know your answers and I'll implement the appropriate solution.
