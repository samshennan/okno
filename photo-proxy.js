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
    const onThisDay = req.query.onThisDay === 'true';
    const wantPortrait = req.query.portrait === 'true';
    let item;

    if (onThisDay) {
      try {
        item = photoCache.getRandomOnThisDayItem();
      } catch (err) {
        logger.error('Error getting On This Day item', { error: err.message });
        // Fall through to 404 logic
        item = null;
      }

      // No photos match today's date
      if (!item) {
        return res.status(404).json({
          error: 'no_photos_today',
          message: 'No photos from this day in history',
          count: 0
        });
      }
    } else if (wantPortrait) {
      item = photoCache.getRandomPortraitItem();
      // Fall back to any random item if no portraits available
      if (!item) {
        item = photoCache.getRandomItem();
      }
    } else {
      item = photoCache.getRandomItem();
    }

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

    // Set response headers
    res.set('Content-Type', imageResponse.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'no-store'); // Don't cache proxied images (baseUrls expire)
    res.set('X-Photo-Id', item.id);
    res.set('X-Photo-CreateTime', item.createTime || '');

    // On This Day headers
    if (onThisDay) {
      res.set('X-Photo-OnThisDay', 'true');
      res.set('X-Photo-OnThisDayCount', String(photoCache.getOnThisDayCount()));
    }

    // Portrait detection header based on item metadata
    const metadata = item.mediaFile?.mediaFileMetadata;
    const itemWidth = metadata ? parseInt(metadata.width, 10) : 0;
    const itemHeight = metadata ? parseInt(metadata.height, 10) : 0;
    const isPortrait = itemHeight > itemWidth;
    res.set('X-Photo-IsPortrait', String(isPortrait));

    // Convert response to buffer and send
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info('Served random photo', {
      photoId: item.id,
      contentType: imageResponse.headers.get('content-type'),
      size: buffer.length
    });

    res.send(buffer);

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
