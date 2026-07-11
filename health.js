const express = require('express');
const router = express.Router();
const { getOAuth2ClientForUser } = require('./oauth-clients');
const photoCache = require('./photo-cache');
const logger = require('./logger');

// Full diagnostics (memory usage) only outside production unless explicitly enabled
const includeDiagnostics =
  process.env.NODE_ENV !== 'production' || process.env.OKNO_DEBUG_HEALTH === 'true';

// GET /api/health - Detailed diagnostics endpoint
// Provides operational visibility per requirement INFRA-04
router.get('/', (req, res) => {
  try {
    const userId = req.session?.userId;

    // If no userId (e.g. startup health check), return basic status
    if (!userId) {
      const payload = {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        auth: {
          hasTokens: false,
          tokenExpiry: null,
          hasRefreshToken: false,
          expiresIn: null
        },
        cache: {
          totalItems: 0,
          portraitCount: 0,
          onThisDayCount: 0,
          sessionId: null,
          lastRefresh: null
        },
        lastApiCall: null
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

    // Return comprehensive diagnostics
    const payload = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      auth: {
        hasTokens: !!tokens.access_token,
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: expiresIn  // Seconds until token expires
      },
      cache: {
        totalItems: photoCache.size(userId),
        portraitCount: photoCache.getPortraitCount(userId),
        onThisDayCount: photoCache.getOnThisDayCount(userId),
        sessionId: photoCache.getSessionId(userId) || null,
        lastRefresh: photoCache.getLastRefresh(userId) || null
      },
      lastApiCall: photoCache.getLastApiCall(userId) || null
    };
    if (includeDiagnostics) {
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
