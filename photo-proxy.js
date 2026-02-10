const express = require('express');
const router = express.Router();
const { oAuth2Client } = require('./auth');
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

// GET /api/photo/random - Serve a random photo from cache
// This is the CRITICAL architectural piece - Picker API baseUrls require auth headers
// Browser <img> tags cannot add headers, so backend must proxy
router.get('/random', async (req, res) => {
  try {
    // Get random item from cache
    const item = photoCache.getRandomItem();

    // If no item (empty cache), return 503 with helpful message
    if (!item) {
      return res.status(503).json({
        error: 'no_photos',
        message: 'No photos in cache. Use the picker to select photos first.'
      });
    }

    // Get access token for Authorization header
    const { token } = await oAuth2Client.getAccessToken();

    // Extract baseUrl from Picker API structure (nested in mediaFile)
    const baseUrl = item.mediaFile?.baseUrl || item.baseUrl;

    if (!baseUrl) {
      logger.error('No baseUrl found in cached item', { itemId: item.id });
      return res.status(500).json({
        error: 'invalid_cache',
        message: 'Cached item missing baseUrl'
      });
    }

    // Append size parameters to baseUrl (w2048-h1536 for iPad Pro landscape)
    // Research: Google requires width/height params on baseUrls
    const imageUrl = `${baseUrl}=w2048-h1536`;

    logger.info('Fetching image from Google', {
      photoId: item.id,
      createTime: item.createTime || 'unknown'
    });

    // Fetch image bytes from Google with Authorization header
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // If fetch fails, return 502 error
    if (!imageResponse.ok) {
      logger.error('Google image fetch failed', {
        photoId: item.id,
        status: imageResponse.status,
        statusText: imageResponse.statusText
      });
      return res.status(502).json({
        error: 'proxy_failed',
        message: `Google returned ${imageResponse.status}`
      });
    }

    // Stream image to client with appropriate headers
    res.set('Content-Type', imageResponse.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'no-store'); // Don't cache proxied images (baseUrls expire)
    res.set('X-Photo-Id', item.id);
    res.set('X-Photo-CreateTime', item.createTime || '');

    logger.info('Served random photo', {
      photoId: item.id,
      contentType: imageResponse.headers.get('content-type')
    });

    // Pipe image bytes to response
    // Node.js fetch returns a ReadableStream that can be piped
    imageResponse.body.pipe(res);

  } catch (error) {
    logger.error('Failed to proxy photo:', { error: error.message, stack: error.stack });
    res.status(502).json({
      error: 'proxy_failed',
      message: error.message
    });
  }
});

// Export router
module.exports = router;
