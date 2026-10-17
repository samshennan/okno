const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const db = require('./db/database');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// OAuth scopes -- openid/email/profile for user identity, photospicker for photo access
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
];

// Per-user OAuth2Client cache (avoids token refresh race conditions)
const clientCache = new Map();

function getDonationUrl() {
  const value = (process.env.DONATION_URL || '').trim();
  return /^https:\/\/buy\.stripe\.com\//.test(value) ? value : null;
}

// Prepared statements (lazy-initialized)
let stmtSelectTokens = null;
let stmtUpsertTokens = null;
let stmtUpsertUser = null;

function getTokenStatements() {
  if (!stmtSelectTokens) {
    stmtSelectTokens = db.prepare('SELECT * FROM tokens WHERE user_id = ?');
    stmtUpsertTokens = db.prepare(`
      INSERT INTO tokens (user_id, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
      VALUES (?, @access_token, @refresh_token, @expiry_date, @scope, @token_type, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = @access_token,
        refresh_token = COALESCE(@refresh_token, tokens.refresh_token),
        expiry_date = @expiry_date,
        scope = @scope,
        token_type = @token_type,
        updated_at = datetime('now')
    `);
  }
  return { stmtSelectTokens, stmtUpsertTokens };
}

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

// Save tokens to database for a specific user (UPSERT preserves refresh_token via COALESCE)
function saveTokens(userId, tokens) {
  try {
    const { stmtUpsertTokens } = getTokenStatements();
    stmtUpsertTokens.run(userId, {
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      expiry_date: tokens.expiry_date || null,
      scope: tokens.scope || null,
      token_type: tokens.token_type || null
    });
    logger.info('Tokens saved to database', { userId });
  } catch (error) {
    logger.error('Failed to save tokens:', { userId, error: error.message });
  }
}

// Get or create a per-user OAuth2Client with credentials loaded from DB
function getOAuth2ClientForUser(userId) {
  if (clientCache.has(userId)) return clientCache.get(userId);

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  // Load tokens from DB
  const { stmtSelectTokens } = getTokenStatements();
  const row = stmtSelectTokens.get(userId);
  if (row) {
    client.setCredentials({
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expiry_date: row.expiry_date,
      scope: row.scope,
      token_type: row.token_type
    });
  }

  // Listen for token refresh events -- save per-user
  client.on('tokens', (tokens) => {
    logger.info('Token refresh event received', { userId });
    saveTokens(userId, tokens);
  });

  clientCache.set(userId, client);
  return client;
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
    // Verify state for CSRF protection
    if (req.query.state !== req.session.oauthState) {
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
        res.redirect('/');
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
  const donationUrl = getDonationUrl();
  if (!userId) {
    return res.json({
      authenticated: false,
      hasTokens: false,
      hasRefreshToken: false,
      tokenExpiry: null,
      donationUrl
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
      : null,
    donationUrl
  });
});

// POST /auth/logout - Sign out, clear session, redirect to login
router.post('/logout', (req, res) => {
  const userId = req.session?.userId;

  // Remove cached client if we know the user
  if (userId && clientCache.has(userId)) {
    clientCache.delete(userId);
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
