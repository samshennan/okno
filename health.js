const express = require('express');
const router = express.Router();
const { getOAuth2ClientForUser } = require('./auth');
const photoCache = require('./photo-cache');
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

const includeDiagnostics =
  process.env.NODE_ENV !== 'production' || process.env.OKNO_DEBUG_HEALTH === 'true';

// GET /api/health - User-safe health endpoint
// Returns compact operational data by default and full diagnostics only in debug mode.
router.get('/', (req, res) => {
  try {
    const userId = req.session?.userId;
    const basePayload = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    // If no userId (e.g. startup health check), return basic status
    if (!userId) {
      const payload = {
        ...basePayload,
        auth: {
          hasTokens: false,
          hasRefreshToken: false
        },
        cache: {
          totalItems: 0,
          portraitCount: 0
        }
      };

      if (includeDiagnostics) {
        payload.memory = process.memoryUsage();
      }

      return res.json(payload);
    }

    // Get current OAuth credentials for this user
    const client = getOAuth2ClientForUser(userId);
    const tokens = client.credentials;

    // Calculate token expiry time in seconds
    let expiresIn = null;
    if (tokens.expiry_date) {
      expiresIn = Math.floor((tokens.expiry_date - Date.now()) / 1000);
      // Clamp negative values to 0 (token already expired)
      if (expiresIn < 0) expiresIn = 0;
    }

    const payload = {
      ...basePayload,
      auth: {
        hasTokens: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token
      },
      cache: {
        totalItems: photoCache.size(userId),
        portraitCount: photoCache.getPortraitCount(userId)
      }
    };

    if (includeDiagnostics) {
      payload.auth.tokenExpiry = tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null;
      payload.auth.expiresIn = expiresIn;
      payload.cache.sessionId = photoCache.getSessionId(userId) || null;
      payload.cache.lastRefresh = photoCache.getLastRefresh(userId) || null;
      payload.lastApiCall = photoCache.getLastApiCall(userId) || null;
      payload.memory = process.memoryUsage();
    }

    res.json(payload);
  } catch (error) {
    // Even if health check fails, return 200 with error info
    // (health endpoints should not return 500 unless completely broken)
    logger.error('Health check failed:', { error: error.message });
    res.json({
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/health/refresh - Manually refresh cache baseUrls
router.post('/refresh', async (req, res) => {
  try {
    const userId = req.session.userId;
    await photoCache.refreshBaseUrls(userId);
    res.json({
      success: true,
      message: 'Cache refresh initiated',
      lastRefresh: photoCache.getLastRefresh(userId)
    });
  } catch (error) {
    logger.error('Cache refresh failed:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Cache refresh failed'
    });
  }
});

// Export router
module.exports = router;
