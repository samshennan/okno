const express = require('express');
const router = express.Router();
const { getOAuth2ClientForUser } = require('./auth');
const photoCache = require('./photo-cache');

// GET /api/health - Detailed diagnostics endpoint
// Provides operational visibility per requirement INFRA-04
router.get('/', (req, res) => {
  try {
    const userId = req.session?.userId;

    // If no userId (e.g. startup health check), return basic status
    if (!userId) {
      return res.json({
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
          sessionId: null,
          lastRefresh: null
        },
        lastApiCall: null,
        memory: process.memoryUsage()
      });
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
        expiresIn: expiresIn  // Seconds until token expires
      },
      cache: {
        totalItems: photoCache.size(userId),
        portraitCount: photoCache.getPortraitCount(userId),
        sessionId: photoCache.getSessionId(userId) || null,
        lastRefresh: photoCache.getLastRefresh(userId) || null
      },
      lastApiCall: photoCache.getLastApiCall(userId) || null,
      memory: process.memoryUsage()
    });
  } catch (error) {
    // Even if health check fails, return 200 with error info
    // (health endpoints should not return 500 unless completely broken)
    res.json({
      status: 'error',
      error: error.message,
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export router
module.exports = router;
