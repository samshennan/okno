const express = require('express');
const router = express.Router();
const { oAuth2Client } = require('./auth');
const photoCache = require('./photo-cache');

// GET /api/health - Detailed diagnostics endpoint
// Provides operational visibility per requirement INFRA-04
router.get('/', (req, res) => {
  try {
    // Get current OAuth credentials
    const tokens = oAuth2Client.credentials;

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
        totalItems: photoCache.size(),
        portraitCount: photoCache.getPortraitCount(),
        sessionId: photoCache.getSessionId() || null,
        lastRefresh: photoCache.getLastRefresh() || null
      },
      lastApiCall: photoCache.getLastApiCall() || null,
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
    await photoCache.refreshBaseUrls();
    res.json({
      success: true,
      message: 'Cache refresh initiated',
      lastRefresh: photoCache.getLastRefresh()
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
