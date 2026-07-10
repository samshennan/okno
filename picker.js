const express = require('express');
const router = express.Router();
const { getOAuth2ClientForUser } = require('./oauth-clients');
const photoCache = require('./photo-cache');
const logger = require('./logger');

// POST /api/picker/start - Create Picker API session
router.post('/start', async (req, res) => {
  try {
    const userId = req.session.userId;
    const client = getOAuth2ClientForUser(userId);

    // Get access token
    const { token } = await client.getAccessToken();

    // Create Picker API session
    const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('Picker session creation failed:', {
        status: response.status,
        error: errorData
      });
      return res.status(response.status).json({
        error: 'session_creation_failed'
      });
    }

    const session = await response.json();

    // Store session ID in session for tracking
    req.session.pickerSessionId = session.id;

    logger.info('Picker session created', {
      sessionId: session.id,
      pollingInterval: session.pollingConfig?.pollInterval
    });

    // Return session details with autoclose appended to pickerUri
    res.json({
      sessionId: session.id,
      pickerUrl: session.pickerUri + '/autoclose',
      pollInterval: session.pollingConfig?.pollInterval || '5s',
      timeout: session.pollingConfig?.timeoutIn || '600s'
    });
  } catch (error) {
    logger.error('Failed to create Picker session:', { error: error.message });
    res.status(500).json({
      error: 'internal_error'
    });
  }
});

// GET /api/picker/status/:sessionId - Poll Picker session status
router.get('/status/:sessionId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const client = getOAuth2ClientForUser(userId);

    // Get access token
    const { token } = await client.getAccessToken();

    // Fetch session status
    const response = await fetch(
      `https://photospicker.googleapis.com/v1/sessions/${req.params.sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('Picker status check failed:', {
        sessionId: req.params.sessionId,
        status: response.status,
        error: errorData
      });
      return res.status(response.status).json({
        error: 'status_check_failed'
      });
    }

    const session = await response.json();

    // Return done status based on mediaItemsSet flag
    const done = session.mediaItemsSet === true;

    logger.info('Picker status checked', {
      sessionId: req.params.sessionId,
      done,
      mediaItemsSet: session.mediaItemsSet,
      fullSession: JSON.stringify(session)
    });

    res.json({ done });
  } catch (error) {
    logger.error('Failed to check Picker status:', { error: error.message });
    res.status(500).json({
      error: 'internal_error'
    });
  }
});

// POST /api/picker/complete/:sessionId - List selected media items and cache them
router.post('/complete/:sessionId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const client = getOAuth2ClientForUser(userId);

    // Get access token
    const { token } = await client.getAccessToken();

    // Paginate through all selected media items
    let allItems = [];
    let pageToken = null;

    logger.info('Starting media items listing', { sessionId: req.params.sessionId });

    do {
      const url = new URL('https://photospicker.googleapis.com/v1/mediaItems');
      url.searchParams.set('sessionId', req.params.sessionId);
      url.searchParams.set('pageSize', '100');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error('Media items listing failed:', {
          sessionId: req.params.sessionId,
          status: response.status,
          error: errorData
        });
        return res.status(response.status).json({
          error: 'listing_failed'
        });
      }

      const data = await response.json();
      const items = data.mediaItems || [];
      allItems.push(...items);
      pageToken = data.nextPageToken;

      logger.info('Media items page retrieved', {
        count: items.length,
        hasMore: !!pageToken
      });
    } while (pageToken);

    logger.info('All media items retrieved', { totalCount: allItems.length });

    // Cache the items with session ID for future refresh (userId is first parameter)
    photoCache.setItems(userId, allItems, req.params.sessionId);

    logger.info('Media items cached', { count: allItems.length });

    res.json({ count: allItems.length });
  } catch (error) {
    logger.error('Failed to complete Picker flow:', { error: error.message });
    res.status(500).json({
      error: 'internal_error'
    });
  }
});

module.exports = router;
