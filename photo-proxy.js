const express = require('express');
const router = express.Router();
const { Readable } = require('stream');
const { getOAuth2ClientForUser } = require('./oauth-clients');
const photoCache = require('./photo-cache');
const logger = require('./logger');

// GET /api/photo/random - Serve a random photo from cache
// This is the CRITICAL architectural piece - Picker API baseUrls require auth headers
// Browser <img> tags cannot add headers, so backend must proxy
router.get('/random', async (req, res) => {
  try {
    const userId = req.session.userId;
    const client = getOAuth2ClientForUser(userId);

    const onThisDay = req.query.onThisDay === 'true';
    const wantPortrait = req.query.portrait === 'true';
    let item;

    if (onThisDay) {
      try {
        item = photoCache.getRandomOnThisDayItem(userId);
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
      item = photoCache.getRandomPortraitItem(userId);
      // Fall back to any random item if no portraits available
      if (!item) {
        item = photoCache.getRandomItem(userId);
      }
    } else {
      item = photoCache.getRandomItem(userId);
    }

    // If no item (empty cache), return 503 with helpful message
    if (!item) {
      return res.status(503).json({
        error: 'no_photos',
        message: 'No photos in cache. Use the picker to select photos first.'
      });
    }

    // Get access token for Authorization header
    const { token } = await client.getAccessToken();

    // Extract baseUrl from Picker API structure (nested in mediaFile)
    const baseUrl = item.mediaFile?.baseUrl || item.baseUrl;

    if (!baseUrl) {
      logger.error('No baseUrl found in cached item', { itemId: item.id });
      return res.status(500).json({
        error: 'invalid_cache'
      });
    }

    // Append size parameters to baseUrl (w2048-h1536 for iPad Pro landscape)
    // Research: Google requires width/height params on baseUrls
    const imageUrl = `${baseUrl}=w2048-h1536`;

    logger.info('Fetching image from Google', {
      photoId: item.id,
      createTime: item.createTime || 'unknown'
    });

    // Fetch image from Google with Authorization header
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // 401/403 from Google means the token or baseUrl is no longer valid;
    // return 401 so the slideshow reconnect overlay triggers
    if (imageResponse.status === 401 || imageResponse.status === 403) {
      logger.error('Google image fetch returned auth error', {
        photoId: item.id,
        status: imageResponse.status
      });
      return res.status(401).json({ error: 'authentication_required' });
    }

    // Other non-ok responses → generic 502
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

    // Set response headers before streaming
    res.set('Content-Type', imageResponse.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'no-store'); // Don't cache proxied images (baseUrls expire)
    res.set('X-Photo-Id', item.id);
    res.set('X-Photo-CreateTime', item.createTime || '');

    // On This Day headers
    if (onThisDay) {
      res.set('X-Photo-OnThisDay', 'true');
      res.set('X-Photo-OnThisDayCount', String(photoCache.getOnThisDayCount(userId)));
    }

    // Portrait detection header based on item metadata
    const metadata = item.mediaFile?.mediaFileMetadata;
    const itemWidth = metadata ? parseInt(metadata.width, 10) : 0;
    const itemHeight = metadata ? parseInt(metadata.height, 10) : 0;
    const isPortrait = itemHeight > itemWidth;
    res.set('X-Photo-IsPortrait', String(isPortrait));

    // Stream response body directly instead of buffering the whole image
    Readable.fromWeb(imageResponse.body).pipe(res);

    logger.info('Streaming random photo', {
      photoId: item.id,
      contentType: imageResponse.headers.get('content-type')
    });

  } catch (error) {
    logger.error('Failed to proxy photo:', { error: error.message, stack: error.stack });

    // Detect token errors (revoked/expired refresh token) and return 401
    // so the frontend shows the reconnect overlay instead of retrying silently.
    const isTokenError = error.response?.status === 401
      || error.message?.includes('invalid_grant')
      || error.message?.includes('Token has been expired or revoked');

    if (isTokenError) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Google token expired or revoked. Please re-authenticate.'
      });
    }

    res.status(502).json({
      error: 'proxy_failed'
    });
  }
});

// POST /api/photo/hide/:mediaItemId - Hide a photo from slideshow
router.post('/hide/:mediaItemId', (req, res) => {
  try {
    const found = photoCache.hideItem(req.session.userId, req.params.mediaItemId);
    if (!found) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to hide photo:', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/photo/unhide/:mediaItemId - Unhide a photo
router.post('/unhide/:mediaItemId', (req, res) => {
  try {
    const found = photoCache.unhideItem(req.session.userId, req.params.mediaItemId);
    if (!found) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to unhide photo:', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/photo/unhide-all - Unhide all hidden photos
router.post('/unhide-all', (req, res) => {
  try {
    const count = photoCache.unhideAll(req.session.userId);
    res.json({ success: true, count });
  } catch (error) {
    logger.error('Failed to unhide all photos:', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/photo/hidden - List all hidden photos
router.get('/hidden', (req, res) => {
  try {
    const items = photoCache.getHiddenItems(req.session.userId);
    res.json({ items, count: items.length });
  } catch (error) {
    logger.error('Failed to get hidden photos:', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/photo/thumbnail/:mediaItemId - Serve a 240x240 thumbnail
router.get('/thumbnail/:mediaItemId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const item = photoCache.getItem(userId, req.params.mediaItemId);

    if (!item) {
      return res.status(404).json({ error: 'not_found' });
    }

    const baseUrl = item.mediaFile?.baseUrl || item.baseUrl;
    if (!baseUrl) {
      return res.status(500).json({ error: 'invalid_cache' });
    }

    const thumbnailUrl = `${baseUrl}=w240-h240-c`;

    const client = getOAuth2ClientForUser(userId);
    const { token } = await client.getAccessToken();

    const imageResponse = await fetch(thumbnailUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 401/403 → auth error so slideshow overlay triggers
    if (imageResponse.status === 401 || imageResponse.status === 403) {
      logger.error('Thumbnail fetch returned auth error', {
        mediaItemId: req.params.mediaItemId,
        status: imageResponse.status
      });
      return res.status(401).json({ error: 'authentication_required' });
    }

    if (!imageResponse.ok) {
      logger.warn('Thumbnail fetch failed from Google', {
        mediaItemId: req.params.mediaItemId,
        status: imageResponse.status
      });
      return res.status(502).json({ error: 'proxy_failed', message: `Google returned ${imageResponse.status}` });
    }

    res.set('Content-Type', imageResponse.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=1800'); // 30 min cache for thumbnails

    // Stream thumbnail instead of buffering
    Readable.fromWeb(imageResponse.body).pipe(res);
  } catch (error) {
    logger.error('Failed to proxy thumbnail:', { error: error.message });
    res.status(502).json({ error: 'proxy_failed' });
  }
});

// Export router
module.exports = router;
