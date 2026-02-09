const fs = require('fs');
const { oAuth2Client } = require('./auth');
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

// Cache file path
const CACHE_PATH = './cache.json';

// Refresh interval: 50 minutes (before 60-minute expiry)
const REFRESH_INTERVAL_MS = 50 * 60 * 1000;

// In-memory cache
let cache = {
  sessionId: null,
  mediaItems: [],
  lastRefresh: null,
  lastApiCall: null
};

// Refresh interval handle
let refreshIntervalHandle = null;

// Load cache from disk
function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const data = fs.readFileSync(CACHE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      cache = {
        sessionId: parsed.sessionId || null,
        mediaItems: parsed.mediaItems || [],
        lastRefresh: parsed.lastRefresh || null,
        lastApiCall: parsed.lastApiCall || null
      };
      logger.info(`Loaded ${cache.mediaItems.length} items from cache`);
      return true;
    }
  } catch (error) {
    logger.error('Failed to load cache:', { error: error.message });
  }
  return false;
}

// Save cache to disk
function saveCache() {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    logger.info('Cache saved to disk');
  } catch (error) {
    logger.error('Failed to save cache:', { error: error.message });
  }
}

// Set items in cache (called after Picker completion)
function setItems(items, sessionId) {
  cache.mediaItems = items;
  cache.sessionId = sessionId;
  cache.lastRefresh = new Date().toISOString();
  saveCache();

  // Start refresh interval if not already running
  if (!refreshIntervalHandle && items.length > 0) {
    logger.info(`Starting baseUrl refresh interval (every ${REFRESH_INTERVAL_MS / 60000} minutes)`);
    refreshIntervalHandle = setInterval(refreshBaseUrls, REFRESH_INTERVAL_MS);
  }
}

// Get item by ID
function getItem(id) {
  return cache.mediaItems.find(item => item.id === id) || null;
}

// Get random item from cache
function getRandomItem() {
  if (cache.mediaItems.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * cache.mediaItems.length);
  return cache.mediaItems[randomIndex];
}

// Get cache size
function size() {
  return cache.mediaItems.length;
}

// Get session ID
function getSessionId() {
  return cache.sessionId;
}

// Get last refresh timestamp
function getLastRefresh() {
  return cache.lastRefresh;
}

// Get last API call timestamp
function getLastApiCall() {
  return cache.lastApiCall;
}

// Refresh baseUrls by re-calling mediaItems.list
async function refreshBaseUrls() {
  if (!cache.sessionId || cache.mediaItems.length === 0) {
    logger.info('Skipping baseUrl refresh - no session or items in cache');
    return;
  }

  try {
    logger.info('Starting baseUrl refresh', { sessionId: cache.sessionId });

    // Get access token
    const { token } = await oAuth2Client.getAccessToken();

    // Re-call mediaItems.list with stored sessionId to get fresh baseUrls
    let allItems = [];
    let pageToken = null;

    do {
      const url = new URL('https://photospicker.googleapis.com/v1/mediaItems');
      url.searchParams.set('sessionId', cache.sessionId);
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
        logger.error('BaseUrl refresh failed:', {
          status: response.status,
          error: errorData
        });
        // Don't throw - just log and continue with stale baseUrls
        return;
      }

      const data = await response.json();
      const items = data.mediaItems || [];
      allItems.push(...items);
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Update cache with fresh baseUrls (match by ID)
    const itemMap = new Map(allItems.map(item => [item.id, item]));
    cache.mediaItems = cache.mediaItems.map(existingItem => {
      const freshItem = itemMap.get(existingItem.id);
      return freshItem || existingItem; // Keep existing if not found in fresh data
    });

    cache.lastRefresh = new Date().toISOString();
    cache.lastApiCall = new Date().toISOString();
    saveCache();

    logger.info(`Refreshed ${allItems.length} baseUrls`);
  } catch (error) {
    logger.error('Failed to refresh baseUrls:', { error: error.message });
  }
}

// Load cache on module initialization
loadCache();

// Export public API
module.exports = {
  getItem,
  getRandomItem,
  setItems,
  size,
  getSessionId,
  getLastRefresh,
  getLastApiCall,
  refreshBaseUrls
};
