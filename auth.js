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

// Google Photos Picker API scope
const SCOPES = ['https://www.googleapis.com/auth/photospicker.mediaitems.readonly'];

// OAuth2 client (redirectUri will be set dynamically per request)
const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Prepared statements for token persistence (lazy-initialized)
let stmtSelectTokens = null;
let stmtUpsertTokens = null;

function getTokenStatements() {
  if (!stmtSelectTokens) {
    stmtSelectTokens = db.prepare('SELECT * FROM tokens WHERE user_id = 1');
    stmtUpsertTokens = db.prepare(`
      INSERT INTO tokens (user_id, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
      VALUES (1, @access_token, @refresh_token, @expiry_date, @scope, @token_type, datetime('now'))
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

// Load tokens from database on startup
function loadTokens() {
  try {
    const { stmtSelectTokens } = getTokenStatements();
    const row = stmtSelectTokens.get();
    if (row) {
      oAuth2Client.setCredentials({
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expiry_date: row.expiry_date,
        scope: row.scope,
        token_type: row.token_type
      });
      logger.info('Tokens loaded from database');
      return true;
    }
  } catch (error) {
    logger.error('Failed to load tokens:', { error: error.message });
  }
  return false;
}

// Save tokens to database (UPSERT preserves refresh_token via COALESCE)
function saveTokens(tokens) {
  try {
    const { stmtUpsertTokens } = getTokenStatements();
    stmtUpsertTokens.run({
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      expiry_date: tokens.expiry_date || null,
      scope: tokens.scope || null,
      token_type: tokens.token_type || null
    });
    logger.info('Tokens saved to database');
  } catch (error) {
    logger.error('Failed to save tokens:', { error: error.message });
  }
}

// Listen for token refresh events
oAuth2Client.on('tokens', (tokens) => {
  logger.info('Token refresh event received');
  saveTokens(tokens);
});

// Load tokens on module initialization
const hasTokens = loadTokens();
if (hasTokens) {
  logger.info('OAuth client initialized with existing tokens');
} else {
  logger.info('OAuth client initialized - no existing tokens');
}

// GET /auth/login - Start OAuth flow
router.get('/login', (req, res) => {
  try {
    // Set redirectUri dynamically based on request
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/callback`;
    oAuth2Client.redirectUri = redirectUri;

    // Generate random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    req.session.oauthState = state;

    // Generate authorization URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',  // Required for refresh token
      scope: SCOPES,
      state: state,
      prompt: 'consent'  // Force consent to ensure refresh token
    });

    logger.info('OAuth login initiated', { redirectUri, state: state.substring(0, 8) + '...' });
    res.redirect(authUrl);
  } catch (error) {
    logger.error('OAuth login failed:', { error: error.message });
    res.status(500).send('Failed to initiate OAuth login');
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
      return res.status(400).send(`OAuth error: ${req.query.error}`);
    }

    // Exchange authorization code for tokens
    const { tokens } = await oAuth2Client.getToken(req.query.code);
    oAuth2Client.setCredentials(tokens);

    // Verify user email is in allowlist
    const allowedEmails = process.env.ALLOWED_EMAILS || '';
    if (allowedEmails) {
      const allowedList = allowedEmails.split(',').map(e => e.trim().toLowerCase());

      // Get user info to check email
      const oauth2Response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      if (!oauth2Response.ok) {
        logger.error('Failed to get user info');
        return res.status(500).send('Failed to verify user identity');
      }

      const userInfo = await oauth2Response.json();
      const userEmail = userInfo.email?.toLowerCase();

      if (!allowedList.includes(userEmail)) {
        logger.warn('Unauthorized email attempted login', { email: userEmail });
        return res.status(403).send(`Access denied. This photo frame is for family use only. Your email (${userEmail}) is not authorized.`);
      }

      logger.info('Email verified', { email: userEmail });
    }

    // Save tokens to database
    saveTokens(tokens);

    // Mark session as authenticated
    req.session.authenticated = true;

    logger.info('OAuth callback successful - tokens obtained and saved');
    res.redirect('/');
  } catch (error) {
    logger.error('OAuth callback failed:', { error: error.message });
    res.status(500).send('Failed to complete OAuth flow');
  }
});

// GET /auth/status - Check authentication status
router.get('/status', (req, res) => {
  const credentials = oAuth2Client.credentials;
  res.json({
    authenticated: !!req.session.authenticated || (!!credentials.access_token && !!credentials.refresh_token),
    hasTokens: !!credentials.access_token,
    hasRefreshToken: !!credentials.refresh_token,
    tokenExpiry: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null
  });
});

// POST /auth/logout - Sign out and clear session
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout failed:', { error: err.message });
      return res.status(500).json({ error: 'Failed to sign out' });
    }
    logger.info('User signed out');
    res.json({ success: true });
  });
});

// Export router and oAuth2Client (needed by picker.js and photo-proxy.js)
module.exports = router;
module.exports.oAuth2Client = oAuth2Client;
