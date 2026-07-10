const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const db = require('./db/database');
const logger = require('./logger');
const { getOAuth2ClientForUser, deleteClient, saveTokens } = require('./oauth-clients');

// OAuth scopes -- openid/email/profile for user identity, photospicker for photo access
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
];

// Prepared statements (lazy-initialized)
let stmtUpsertUser = null;

function getUserStatements() {
  if (!stmtUpsertUser) {
    stmtUpsertUser = db.prepare(`
      INSERT INTO users (email, display_name, last_login)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(email) DO UPDATE SET
        display_name = excluded.display_name,
        last_login = datetime('now')
      RETURNING id
    `);
  }
  return { stmtUpsertUser };
}

// requireAuth middleware -- gates protected routes
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    // Use originalUrl to check the full path (req.path is relative to mount point)
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'authentication_required' });
    }
    return res.redirect('/login');
  }
  next();
}

// Allowlist of destinations that ?next= may redirect to after login
const POST_LOGIN_ALLOWLIST = ['/', '/slideshow.html', '/settings.html'];

// GET /auth/login - Start OAuth flow
router.get('/login', (req, res) => {
  try {
    // Create a transient client for URL generation (no user known yet)
    const tempClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/callback`;
    tempClient.redirectUri = redirectUri;

    // Generate random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    req.session.oauthState = state;

    // Store post-login redirect destination if supplied and on the allowlist
    const next = req.query.next;
    if (next && POST_LOGIN_ALLOWLIST.includes(next)) {
      req.session.postLoginRedirect = next;
    }

    // Generate authorization URL
    const authUrl = tempClient.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: state,
      prompt: 'consent'
    });

    logger.info('OAuth login initiated', { redirectUri, state: state.substring(0, 8) + '...' });
    res.redirect(authUrl);
  } catch (error) {
    logger.error('OAuth login failed:', { error: error.message });
    res.redirect('/login?error=oauth_failed');
  }
});

// GET /auth/callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    // Verify state for CSRF protection — consume the token (one-time use)
    const expectedState = req.session.oauthState;
    const postLoginRedirect = req.session.postLoginRedirect;
    delete req.session.oauthState;
    if (!expectedState || req.query.state !== expectedState) {
      logger.error('OAuth state mismatch - possible CSRF attack');
      return res.status(403).send('State mismatch - possible CSRF attack');
    }

    // Check for error from Google
    if (req.query.error) {
      logger.error('OAuth error from Google:', { error: req.query.error });
      return res.redirect('/login?error=oauth_failed');
    }

    // Create a transient client for token exchange (no user known yet)
    const tempClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    tempClient.redirectUri = `${req.protocol}://${req.get('host')}/auth/callback`;

    // Exchange authorization code for tokens
    const { tokens } = await tempClient.getToken(req.query.code);

    // Get user info (email + display name)
    const oauth2Response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!oauth2Response.ok) {
      logger.error('Failed to get user info');
      return res.redirect('/login?error=oauth_failed');
    }

    const userInfo = await oauth2Response.json();
    const userEmail = userInfo.email?.toLowerCase();
    const displayName = userInfo.name || userEmail;

    // Optional ALLOWED_EMAILS enforcement (comma-separated, case-insensitive)
    // Unset or empty = open to all Google accounts
    const allowedRaw = process.env.ALLOWED_EMAILS;
    if (allowedRaw && allowedRaw.trim()) {
      const allowed = allowedRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      if (allowed.length > 0 && !allowed.includes(userEmail)) {
        logger.warn('Access denied: email not in ALLOWED_EMAILS', { email: userEmail });
        return res.redirect('/login?error=access_denied');
      }
    }

    // UPSERT user record
    const { stmtUpsertUser } = getUserStatements();
    const userRow = stmtUpsertUser.get(userEmail, displayName);
    const userId = userRow.id;

    // Save tokens for this user
    saveTokens(userId, tokens);

    // Create/update per-user OAuth2Client with fresh credentials
    const userClient = getOAuth2ClientForUser(userId);
    userClient.setCredentials(tokens);

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed:', { error: err.message });
        return res.redirect('/login?error=session_error');
      }

      // Set userId on the NEW session
      req.session.userId = userId;

      // Save session before redirect to ensure it's persisted
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error('Session save failed:', { error: saveErr.message });
          return res.redirect('/login?error=session_error');
        }
        logger.info('OAuth callback successful', { userId, email: userEmail });
        res.redirect(postLoginRedirect || '/');
      });
    });
  } catch (error) {
    logger.error('OAuth callback failed:', { error: error.message });
    res.redirect('/login?error=oauth_failed');
  }
});

// GET /auth/status - Check authentication status
router.get('/status', (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.json({
      authenticated: false,
      hasTokens: false,
      hasRefreshToken: false,
      tokenExpiry: null
    });
  }

  const client = getOAuth2ClientForUser(userId);
  const credentials = client.credentials;
  res.json({
    authenticated: true,
    hasTokens: !!credentials.access_token,
    hasRefreshToken: !!credentials.refresh_token,
    tokenExpiry: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null
  });
});

// POST /auth/logout - Sign out, clear session, evict caches, redirect to login
router.post('/logout', (req, res) => {
  const userId = req.session?.userId;

  if (userId) {
    // Evict OAuth client
    deleteClient(userId);

    // Evict photo cache and config (lazy imports to avoid circular deps at module load time)
    try {
      const photoCache = require('./photo-cache');
      photoCache.clearUserCache(userId);
    } catch (e) {
      logger.warn('Could not clear photo cache on logout', { userId, error: e.message });
    }

    try {
      const config = require('./config');
      config.clearUserConfig(userId);
    } catch (e) {
      logger.warn('Could not clear config on logout', { userId, error: e.message });
    }
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout failed:', { error: err.message });
      return res.status(500).json({ error: 'Failed to sign out' });
    }
    logger.info('User signed out', { userId });
    res.redirect('/login');
  });
});

// Export router, per-user client factory, and auth middleware
module.exports = router;
module.exports.getOAuth2ClientForUser = getOAuth2ClientForUser;
module.exports.requireAuth = requireAuth;
