# Phase 1: Backend + Deployment - Research

**Researched:** 2026-02-08
**Domain:** Google Photos Picker API, Node.js/Express backend, OAuth 2.0, VPS deployment
**Confidence:** HIGH

## Summary

This phase builds a Node.js/Express backend that authenticates with Google via OAuth 2.0, integrates with the Google Photos Picker API for photo selection, caches media item IDs, serves random photos with fresh baseUrls, and deploys to a VPS with nginx/PM2/HTTPS.

The most critical architectural finding is that the **Picker API's baseUrl requires an OAuth 2.0 Authorization header** to fetch image bytes. Unlike the deprecated Library API (where baseUrls were direct-access), the Picker API mandates authenticated requests. This means the frontend **cannot** use baseUrls directly in `<img src>` tags. The backend must act as an **image proxy** -- fetching image bytes from Google with the bearer token and streaming them to the client. This is the single most important architectural decision for this phase.

The Picker API uses a session-based flow: create a session, redirect the user to Google's picker UI via `pickerUri`, poll for completion, then list selected media items. Media item IDs are persistent and can be stored indefinitely. BaseUrls expire after 60 minutes and must be refreshed by re-calling `mediaItems.list`. Secrets are managed via 1Password CLI (`op run`) instead of plaintext `.env` files.

**Primary recommendation:** Build an Express backend with an image proxy endpoint that streams Google Photos bytes with OAuth headers, using a background refresh interval to keep baseUrls fresh in memory.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.x | HTTP server and routing | De facto Node.js web framework, official Google samples use it |
| google-auth-library | latest | OAuth 2.0 client (OAuth2Client) | Google's official Node.js auth library, handles token refresh automatically |
| express-session | latest | Session management (cookie-based) | Standard Express middleware for session handling |
| session-file-store | latest | Persist sessions to filesystem | Simple file-based session store, no external database needed |
| node-fetch or undici | latest | HTTP client for image proxying and API calls | Needed to fetch image bytes from Google baseUrls with auth headers |
| pm2 | latest | Process management | Industry standard for Node.js production deployment, auto-restart, startup scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| morgan | latest | HTTP request logging | Verbose logging requirement -- log every request |
| helmet | latest | Security headers | Production security best practice for Express |
| cors | latest | CORS handling | If frontend is served from a different origin |
| winston or pino | latest | Structured logging | Verbose logging with timestamps, levels, and rotation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| express-session + session-file-store | No sessions (token in file only) | Since this is single-user, sessions are lightweight; file store keeps it simple without Redis |
| node-fetch | axios | Both work; node-fetch is lighter, built-in fetch in Node 18+ also works |
| winston | pino | Pino is faster but winston has more formatting options; either works |

**Installation:**
```bash
npm install express google-auth-library express-session session-file-store morgan helmet winston
```

## Architecture Patterns

### Recommended Project Structure
```
okno/
  server.js              # Entry point, Express app setup
  auth.js                # OAuth2 flow: login, callback, token persistence
  picker.js              # Picker API: session create, poll, media items list
  photo-cache.js         # In-memory cache of media items + baseUrl refresh logic
  photo-proxy.js         # Image proxy: fetch bytes from Google with auth, stream to client
  health.js              # /api/health endpoint
  tokens.json            # OAuth tokens (gitignored, persisted across restarts)
  cache.json             # Cached media item IDs + metadata (persisted)
  ecosystem.config.js    # PM2 configuration
  okno.env               # 1Password secret references (op:// URIs, safe to commit)
  public/                # Static frontend files (Phase 2)
    index.html
```

### Pattern 1: Image Proxy (Critical -- Picker API Requires Auth Headers)
**What:** Backend endpoint that fetches image bytes from Google Photos baseUrl with OAuth bearer token and streams them to the frontend client.
**When to use:** Always -- Picker API baseUrls require Authorization headers that `<img>` tags cannot provide.
**Why:** The Picker API (unlike the deprecated Library API) requires `Authorization: Bearer <token>` on all baseUrl requests. Browser `<img src="...">` cannot add custom headers. The backend must proxy.
**Example:**
```javascript
// Source: Google Photos Picker API docs + standard Express proxy pattern
app.get('/api/photo/:id', async (req, res) => {
  const item = photoCache.getItem(req.params.id);
  if (!item || !item.baseUrl) {
    return res.status(404).json({ error: 'Photo not found or URL expired' });
  }

  const accessToken = await oAuth2Client.getAccessToken();
  const imageUrl = `${item.baseUrl}=w2048-h1024`;

  const response = await fetch(imageUrl, {
    headers: { 'Authorization': `Bearer ${accessToken.token}` }
  });

  res.set('Content-Type', response.headers.get('content-type'));
  res.set('Cache-Control', 'private, max-age=3000'); // ~50 min, shorter than 60-min expiry
  response.body.pipe(res);
});
```

### Pattern 2: Picker API Session Flow
**What:** Create session, redirect user to Google's Picker UI, poll for completion, list selected items.
**When to use:** When user wants to select/re-select photos.
**Example:**
```javascript
// Source: https://developers.google.com/photos/picker/guides/sessions

// Step 1: Create session
app.post('/api/picker/start', async (req, res) => {
  const accessToken = await oAuth2Client.getAccessToken();
  const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken.token}` }
  });
  const session = await response.json();
  // session contains: { id, pickerUri, pollingConfig, mediaItemsSet }
  // Append /autoclose for web apps (auto-closes tab after selection)
  res.json({
    sessionId: session.id,
    pickerUrl: session.pickerUri + '/autoclose',
    pollInterval: session.pollingConfig.pollInterval,
    timeout: session.pollingConfig.timeoutIn
  });
});

// Step 2: Poll session (called by frontend on interval)
app.get('/api/picker/status/:sessionId', async (req, res) => {
  const accessToken = await oAuth2Client.getAccessToken();
  const response = await fetch(
    `https://photospicker.googleapis.com/v1/sessions/${req.params.sessionId}`,
    { headers: { 'Authorization': `Bearer ${accessToken.token}` } }
  );
  const session = await response.json();
  res.json({ done: session.mediaItemsSet === true });
});

// Step 3: List selected media items (after mediaItemsSet is true)
app.post('/api/picker/complete/:sessionId', async (req, res) => {
  const accessToken = await oAuth2Client.getAccessToken();
  let allItems = [];
  let pageToken = null;
  do {
    const url = new URL('https://photospicker.googleapis.com/v1/mediaItems');
    url.searchParams.set('sessionId', req.params.sessionId);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken.token}` }
    });
    const data = await response.json();
    allItems.push(...(data.mediaItems || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Cache the items
  photoCache.setItems(allItems);
  res.json({ count: allItems.length });
});
```

### Pattern 3: Token Persistence with File Storage
**What:** Save OAuth tokens to `tokens.json` on disk, load on startup, listen for refresh events.
**When to use:** Always -- tokens must persist across server restarts (AUTH-01).
**Example:**
```javascript
// Source: https://github.com/googleapis/google-auth-library-nodejs

const fs = require('fs');
const TOKEN_PATH = './tokens.json';

// Load tokens on startup
function loadTokens() {
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(tokens);
    return true;
  } catch (e) {
    return false; // No tokens yet, need to authenticate
  }
}

// Listen for token refresh events -- save updated tokens
oAuth2Client.on('tokens', (tokens) => {
  const current = loadTokensFromFile() || {};
  // Only update refresh_token if present (it's only sent on first auth)
  if (tokens.refresh_token) {
    current.refresh_token = tokens.refresh_token;
  }
  current.access_token = tokens.access_token;
  current.expiry_date = tokens.expiry_date;
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(current, null, 2));
  logger.info('Tokens refreshed and saved');
});
```

### Pattern 4: BaseUrl Refresh Strategy
**What:** Periodically re-fetch baseUrls for all cached media items before the 60-minute expiry.
**When to use:** Background process that runs on a 50-minute interval.
**Example:**
```javascript
// Refresh baseUrls every 50 minutes (before 60-min expiry)
const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes

async function refreshBaseUrls() {
  if (!photoCache.hasItems()) return;

  const accessToken = await oAuth2Client.getAccessToken();
  // Re-list media items from the last session to get fresh baseUrls
  // NOTE: This requires a valid session. Alternative: store session ID
  // and re-call mediaItems.list, or create a new session each time.
  // The Picker API mediaItems.list returns fresh baseUrls each call.
  logger.info('Refreshing baseUrls for cached items');

  // Approach: Re-call mediaItems.list with stored sessionId
  let allItems = [];
  let pageToken = null;
  do {
    const url = new URL('https://photospicker.googleapis.com/v1/mediaItems');
    url.searchParams.set('sessionId', photoCache.getSessionId());
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken.token}` }
    });
    const data = await response.json();
    allItems.push(...(data.mediaItems || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  photoCache.updateBaseUrls(allItems);
  logger.info(`Refreshed ${allItems.length} baseUrls`);
}

setInterval(refreshBaseUrls, REFRESH_INTERVAL_MS);
```

### Pattern 5: 1Password CLI Integration with PM2
**What:** Use `op run` to inject secrets at process start time, wrapping PM2 start command.
**When to use:** Production deployment on VPS.
**Example:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'okno',
    script: './server.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    combine_logs: true,
    env: {
      NODE_ENV: 'production',
      PORT: 3100  // Choose port not conflicting with n8n etc
    }
  }]
};
```

```bash
# okno.env -- 1Password secret references (safe to commit)
GOOGLE_CLIENT_ID="op://Personal/Okno Google OAuth/client_id"
GOOGLE_CLIENT_SECRET="op://Personal/Okno Google OAuth/client_secret"
SESSION_SECRET="op://Personal/Okno/session_secret"

# Start with 1Password secrets injected
op run --env-file=okno.env -- pm2 start ecosystem.config.js

# Or create a start script
# start.sh:
#!/bin/bash
op run --env-file=/path/to/okno/okno.env -- pm2 start /path/to/okno/ecosystem.config.js
```

### Anti-Patterns to Avoid
- **Storing baseUrls in persistent cache:** BaseUrls expire after 60 minutes. Only store media item IDs persistently. BaseUrls must be refreshed from the API.
- **Exposing OAuth tokens to frontend:** The backend must handle all authenticated Google API calls. Frontend only talks to your backend API.
- **Using Library API scopes:** The `photoslibrary.readonly` and related scopes were removed March 31, 2025. Only use `photospicker.mediaitems.readonly`.
- **Opening pickerUri in an iframe:** Google explicitly prohibits this. Must open in a new tab/window.
- **Hardcoding secrets in env files on VPS:** User decision is to use 1Password CLI `op run`. Do not store plaintext secrets in `.env` files.
- **Using MemoryStore for sessions in production:** Express default MemoryStore leaks memory. Use session-file-store.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 token management | Custom token refresh logic | `google-auth-library` OAuth2Client | Handles token refresh, expiry detection, and retry automatically |
| CSRF protection for OAuth | Custom state parameter handling | `crypto.randomBytes` + session state | Standard pattern from Google's own docs |
| Session management | Custom cookie/token system | `express-session` + `session-file-store` | Battle-tested, handles serialization, expiry, cookie signing |
| Process management | Custom restart scripts | PM2 ecosystem config | Auto-restart, log management, startup scripts, cluster mode |
| SSL certificate management | Manual cert renewal | Certbot with auto-renewal | Handles Let's Encrypt cert issuance and 60-day auto-renewal |
| HTTP security headers | Manual header setting | `helmet` middleware | Covers HSTS, CSP, X-Frame-Options, etc. in one line |
| Request logging | Custom `console.log` calls | `morgan` + `winston` | Structured logging with timestamps, levels, rotation |

**Key insight:** This project uses standard, well-documented Google APIs with established Node.js patterns. Every building block has an official or battle-tested library. The only custom logic needed is the image proxy endpoint and the baseUrl refresh scheduler.

## Common Pitfalls

### Pitfall 1: BaseUrl Requires Auth Header (Picker API)
**What goes wrong:** Developer puts baseUrl directly in `<img src>` and gets 401 errors. Images never load.
**Why it happens:** The deprecated Library API allowed direct baseUrl access without auth. The new Picker API changed this behavior.
**How to avoid:** Always proxy images through the backend. The backend fetches from Google with `Authorization: Bearer <token>` and streams bytes to the client.
**Warning signs:** 401 errors in browser console when loading images, images showing as broken.

### Pitfall 2: Refresh Token Only Sent Once
**What goes wrong:** Token refresh fails because `refresh_token` was overwritten with `undefined`.
**Why it happens:** Google only sends the `refresh_token` on the first authorization. Subsequent token refreshes only include `access_token` and `expiry_date`. If you blindly overwrite your stored tokens, you lose the refresh token.
**How to avoid:** In the `tokens` event handler, merge new tokens with existing ones. Only update `refresh_token` if the new tokens actually contain one.
**Warning signs:** App works for 1 hour then breaks, "invalid_grant" errors.

### Pitfall 3: Session Expiry Before User Completes Selection
**What goes wrong:** Picker session times out while user is browsing photos.
**Why it happens:** Picker sessions have a `timeoutIn` value. If polling exceeds this, the session is dead.
**How to avoid:** Respect the `pollingConfig.timeoutIn` from the session response. Show user-friendly timeout messages and allow creating a new session.
**Warning signs:** FAILED_PRECONDITION errors when calling mediaItems.list.

### Pitfall 4: Missing Size Parameters on BaseUrl
**What goes wrong:** Fetching baseUrl without width/height parameters returns an error or unexpected result.
**Why it happens:** Google requires you to append `=w{width}-h{height}` or `=d` (download) to baseUrls. A raw baseUrl without parameters is not valid.
**How to avoid:** Always append size parameters: `${baseUrl}=w2048-h1024` for display, or `=d` for download.
**Warning signs:** Empty responses or errors from baseUrl requests.

### Pitfall 5: PM2 startup vs save Order
**What goes wrong:** App doesn't restart after VPS reboot.
**Why it happens:** Running `pm2 startup` generates the systemd service, but `pm2 save` snapshots the current process list. Both must be run, in order, for reboot persistence.
**How to avoid:** Run `pm2 startup` first (and execute the command it outputs), then `pm2 save` after starting your app.
**Warning signs:** App runs fine but disappears after reboot.

### Pitfall 6: 1Password CLI Requires Authentication on VPS
**What goes wrong:** `op run` fails on VPS because 1Password CLI is not authenticated.
**Why it happens:** 1Password CLI needs to be signed in on the VPS. For unattended use (like PM2 startup on reboot), you need a 1Password Service Account or cached auth.
**How to avoid:** Set up a 1Password Service Account with access to the vault containing Okno secrets. Export `OP_SERVICE_ACCOUNT_TOKEN` as an environment variable on the VPS. The `op` CLI uses this token for non-interactive authentication.
**Warning signs:** `op run` prompts for sign-in interactively, fails in non-interactive contexts.

### Pitfall 7: Picker API Session ID Needed for BaseUrl Refresh
**What goes wrong:** Cannot refresh baseUrls because the session was deleted or expired.
**Why it happens:** `mediaItems.list` requires a valid `sessionId`. If you delete the session after initial selection, you cannot re-list items to get fresh baseUrls.
**How to avoid:** Keep the session ID alive. Do NOT call `sessions.delete` until the user re-selects photos. Store the sessionId alongside your cache. If the session does expire, you may need to create a new session and have the user re-select.
**Warning signs:** FAILED_PRECONDITION or NOT_FOUND errors on mediaItems.list when trying to refresh.

### Pitfall 8: Port Conflict on Shared VPS
**What goes wrong:** App fails to start because port is in use by n8n or another service.
**Why it happens:** VPS already runs n8n, Gemini CLI, Claude Code.
**How to avoid:** Explicitly choose a port that doesn't conflict (e.g., 3100). Check existing services with `ss -tlnp` or `netstat -tlnp` before deploying.
**Warning signs:** EADDRINUSE error on startup.

## Code Examples

### OAuth 2.0 Login Flow
```javascript
// Source: https://developers.google.com/identity/protocols/oauth2/web-server
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://yourdomain.com/auth/callback'
);

const SCOPES = ['https://www.googleapis.com/auth/photospicker.mediaitems.readonly'];

app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',   // Required for refresh token
    scope: SCOPES,
    state: state,
    prompt: 'consent'         // Force consent to ensure refresh token
  });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  if (req.query.state !== req.session.oauthState) {
    return res.status(403).send('State mismatch -- possible CSRF');
  }
  const { tokens } = await oAuth2Client.getToken(req.query.code);
  oAuth2Client.setCredentials(tokens);
  // Save tokens to file (tokens event handler also saves)
  saveTokens(tokens);
  req.session.authenticated = true;
  res.redirect('/');
});
```

### Health Check Endpoint
```javascript
// Source: Requirement INFRA-04
app.get('/api/health', (req, res) => {
  const tokens = oAuth2Client.credentials;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    auth: {
      hasTokens: !!tokens.access_token,
      tokenExpiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      hasRefreshToken: !!tokens.refresh_token,
    },
    cache: {
      totalItems: photoCache.size(),
      sessionId: photoCache.getSessionId() || null,
      lastRefresh: photoCache.getLastRefresh() || null,
    },
    lastApiCall: photoCache.getLastApiCall() || null,
    memory: process.memoryUsage(),
  });
});
```

### Random Photo Endpoint
```javascript
// Source: Requirement AUTH-04, image proxy pattern
app.get('/api/photo/random', async (req, res) => {
  const item = photoCache.getRandomItem();
  if (!item) {
    return res.status(503).json({
      error: 'no_photos',
      message: 'No photos in cache. Use the picker to select photos first.'
    });
  }

  try {
    const accessToken = await oAuth2Client.getAccessToken();
    // Append size params -- w2048-h1536 covers most displays
    const imageUrl = `${item.baseUrl}=w2048-h1536`;

    const imageResponse = await fetch(imageUrl, {
      headers: { 'Authorization': `Bearer ${accessToken.token}` }
    });

    if (!imageResponse.ok) {
      throw new Error(`Google returned ${imageResponse.status}`);
    }

    res.set('Content-Type', imageResponse.headers.get('content-type'));
    res.set('Cache-Control', 'no-store'); // Don't cache proxied images
    res.set('X-Photo-Id', item.id);
    res.set('X-Photo-CreateTime', item.createTime || '');
    imageResponse.body.pipe(res);
  } catch (err) {
    logger.error('Failed to proxy photo:', err.message);
    res.status(502).json({ error: 'proxy_failed', message: err.message });
  }
});
```

### Nginx Reverse Proxy Configuration
```nginx
# /etc/nginx/sites-available/okno
server {
    listen 80;
    server_name okno.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name okno.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/okno.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/okno.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for image proxying
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Library API with `photoslibrary.readonly` scope | Picker API with `photospicker.mediaitems.readonly` scope | March 31, 2025 | Cannot browse full library. User must explicitly select photos via Google's Picker UI |
| Direct baseUrl in `<img src>` (Library API) | Backend image proxy with auth headers (Picker API) | March 31, 2025 | Picker API baseUrls require OAuth bearer token. Backend must proxy all image requests |
| Library API `mediaItems.list` for full library | Picker API session-based selection | March 31, 2025 | No more paginating entire library. User picks specific photos. Backend caches their selection |
| `.env` files with plaintext secrets | 1Password CLI `op run` with secret references | User decision | Secrets never stored in plaintext on disk. Injected at runtime from 1Password vault |

**Deprecated/outdated:**
- **Library API scopes (`photoslibrary.readonly`, `photoslibrary.sharing`, `photoslibrary`):** Removed March 31, 2025. Return 403 PERMISSION_DENIED.
- **Direct baseUrl access without auth:** Only worked with Library API. Picker API always requires Authorization header.
- **`googlephotos` npm package:** Third-party wrapper for the old Library API. Not compatible with Picker API.

## Open Questions

1. **Picker API session longevity for baseUrl refresh**
   - What we know: `mediaItems.list` requires a valid `sessionId`. Sessions have a `timeoutIn` value.
   - What's unclear: How long a session remains valid after the user finishes selecting. Can we keep re-listing media items from the same session indefinitely, or do sessions expire after some time?
   - Recommendation: Test session longevity during implementation. If sessions expire, implement a fallback: store media item IDs persistently, and when the session expires, the user may need to re-select (or find if there's a way to get baseUrls from IDs without a session). If sessions are long-lived, just keep the session ID and re-list periodically.

2. **1Password Service Account setup on VPS for unattended startup**
   - What we know: `op run` needs authentication. Service Accounts provide non-interactive auth via `OP_SERVICE_ACCOUNT_TOKEN`.
   - What's unclear: Whether the user already has a 1Password Service Account set up, and whether the VPS has `op` CLI installed.
   - Recommendation: Include VPS setup tasks for installing `op` CLI and configuring the service account token. Fall back to regular `op` CLI with cached auth if Service Account is not available.

3. **Optimal image size parameters for iPad Pro**
   - What we know: iPad Pro 1st Gen has 2732x2048 display. BaseUrl requires width/height params.
   - What's unclear: Whether requesting full resolution causes performance issues or if Google throttles large requests differently.
   - Recommendation: Use `=w2048-h1536` as default (covers landscape display well). The frontend (Phase 2) could pass desired dimensions as query params to the proxy endpoint.

4. **Google OAuth app verification for Picker API scope**
   - What we know: The `photospicker.mediaitems.readonly` scope requires OAuth verification review for production apps. Unverified apps show warning screens.
   - What's unclear: Whether this scope is classified as "sensitive" or "restricted" by Google, and how long verification takes.
   - Recommendation: For personal use, the unverified app warning can be bypassed by the user (click "Advanced" -> "Go to app"). If publishing as portfolio, may need to go through verification. Start without verification for speed.

## Sources

### Primary (HIGH confidence)
- [Google Photos Picker API - Get Started](https://developers.google.com/photos/picker/guides/get-started-picker) - Complete session flow
- [Google Photos Picker API - Sessions](https://developers.google.com/photos/picker/guides/sessions) - Session lifecycle, pollingConfig, autoclose
- [Google Photos Picker API - Media Items](https://developers.google.com/photos/picker/guides/media-items) - baseUrl usage, auth requirement, 60-min expiry, size parameters
- [Google Photos Picker API - REST Reference](https://developers.google.com/photos/picker/reference/rest) - Endpoint base URL: `photospicker.googleapis.com`
- [Google Photos Picker API - mediaItems resource](https://developers.google.com/photos/picker/reference/rest/v1/mediaItems) - PickedMediaItem JSON schema
- [Google Photos Picker API - mediaItems.list](https://developers.google.com/photos/picker/reference/rest/v1/mediaItems/list) - Pagination, pageSize max 100
- [Google Photos API Best Practices](https://developers.google.com/photos/overview/best-practices) - Caching, error handling, exponential backoff
- [Google Photos API Quotas](https://developers.google.com/photos/overview/api-limits-quotas) - Picker: 100K req/min; media bytes: 1M req/min
- [Google Photos Authorization Scopes](https://developers.google.com/photos/overview/authorization) - Picker scope, no service accounts
- [Google OAuth2 Web Server Flow](https://developers.google.com/identity/protocols/oauth2/web-server) - Node.js OAuth2Client example
- [google-auth-library-nodejs](https://github.com/googleapis/google-auth-library-nodejs) - Token events, automatic refresh, setCredentials
- [PM2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/) - All config options
- [1Password CLI - op run](https://developer.1password.com/docs/cli/reference/commands/run/) - Secret injection at runtime
- [1Password CLI - Environment Variables](https://developer.1password.com/docs/cli/secrets-environment-variables/) - .env file with op:// references

### Secondary (MEDIUM confidence)
- [Google Photos API Updates](https://developers.google.com/photos/support/updates) - Library API deprecation timeline
- [Google Developers Blog - Picker API Launch](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/) - Migration context
- [Library API vs Picker API baseUrl auth](https://developers.google.com/photos/library/guides/access-media-items) - Library API baseUrl does NOT need auth (contrast with Picker)
- [PM2 Nginx Production Setup](https://pm2.keymetrics.io/docs/tutorials/pm2-nginx-production-setup) - Standard deployment pattern

### Tertiary (LOW confidence)
- [Doppler PM2 integration](https://docs.doppler.com/docs/pm2) - Pattern for secrets manager + PM2 (parallel to 1Password approach)
- Community reports about Picker API session longevity - Insufficient data for definitive answers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Google docs, official libraries, well-established patterns
- Architecture: HIGH - Picker API docs are explicit about auth headers on baseUrl; proxy pattern is the only viable approach
- Pitfalls: HIGH - Most pitfalls verified from official documentation (baseUrl auth requirement, token refresh behavior, session lifecycle)
- BaseUrl refresh via session re-list: MEDIUM - Docs confirm mediaItems.list returns fresh baseUrls, but session longevity after completion is not explicitly documented
- 1Password + PM2 integration: MEDIUM - op run is well-documented, but PM2 startup integration pattern is inferred from parallel tools

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days -- Google Photos APIs are stable, Picker API is past initial launch)
