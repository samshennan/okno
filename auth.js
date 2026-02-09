const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const fs = require('fs');
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

// Token storage file
const TOKEN_PATH = './tokens.json';

// Load tokens from file on startup
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(tokens);
      logger.info('Tokens loaded from disk');
      return true;
    }
  } catch (error) {
    logger.error('Failed to load tokens:', { error: error.message });
  }
  return false;
}

// Save tokens to file
function saveTokens(tokens) {
  try {
    // Load existing tokens to preserve refresh_token
    let existingTokens = {};
    if (fs.existsSync(TOKEN_PATH)) {
      existingTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    }

    // Merge tokens - preserve refresh_token if not in new tokens
    // (Google only sends refresh_token on first authorization)
    const mergedTokens = {
      ...existingTokens,
      ...tokens
    };

    // If refresh_token exists in new tokens, use it; otherwise keep existing
    if (tokens.refresh_token) {
      mergedTokens.refresh_token = tokens.refresh_token;
    } else if (existingTokens.refresh_token) {
      mergedTokens.refresh_token = existingTokens.refresh_token;
    }

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(mergedTokens, null, 2));
    logger.info('Tokens saved to disk');
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

    // Save tokens to disk
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
    authenticated: !!req.session.authenticated,
    hasTokens: !!credentials.access_token,
    hasRefreshToken: !!credentials.refresh_token,
    tokenExpiry: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null
  });
});

// Export router and oAuth2Client (needed by picker.js and photo-proxy.js)
module.exports = router;
module.exports.oAuth2Client = oAuth2Client;
