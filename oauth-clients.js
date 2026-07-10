// oauth-clients.js
// Owns the per-user OAuth2Client cache (Map<userId, OAuth2Client>).
// Extracted from auth.js to break the auth <-> photo-cache circular dependency.
// photo-cache.js imports this directly instead of lazy-requiring auth.js.
const { OAuth2Client } = require('google-auth-library');
const db = require('./db/database');
const logger = require('./logger');

// Per-user OAuth2Client cache (avoids token refresh race conditions)
const clientCache = new Map();

// Prepared statements (lazy-initialized)
let stmtSelectTokens = null;
let stmtUpsertTokens = null;

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

// Delete a user's client from the cache (called on logout)
function deleteClient(userId) {
  clientCache.delete(userId);
}

// Check whether a client exists in the cache
function hasClient(userId) {
  return clientCache.has(userId);
}

module.exports = { getOAuth2ClientForUser, deleteClient, hasClient, saveTokens };
