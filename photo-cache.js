const db = require('./db/database');
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

// Prepared statements (lazy-initialized)
let stmts = null;

function getStatements() {
  if (!stmts) {
    stmts = {
      selectAll: db.prepare('SELECT media_item_id, media_item_data, session_id FROM photo_cache WHERE user_id = 1'),
      insertItem: db.prepare(`
        INSERT OR IGNORE INTO photo_cache (user_id, session_id, media_item_id, media_item_data, created_at)
        VALUES (1, ?, ?, ?, datetime('now'))
      `),
      updateSessionId: db.prepare('UPDATE photo_cache SET session_id = ? WHERE user_id = 1'),
      updateItem: db.prepare('UPDATE photo_cache SET media_item_data = ?, session_id = ? WHERE user_id = 1 AND media_item_id = ?'),
    };
  }
  return stmts;
}

// Load cache from database
function loadCache() {
  try {
    const { selectAll } = getStatements();
    const rows = selectAll.all();
    if (rows.length > 0) {
      cache.mediaItems = rows.map(row => JSON.parse(row.media_item_data));
      // All rows for a user share the same session_id; use the first non-null
      cache.sessionId = rows.find(r => r.session_id)?.session_id || null;
      // Runtime-only values -- baseUrls expire every 60min, no point persisting
      cache.lastRefresh = null;
      cache.lastApiCall = null;
      logger.info(`Loaded ${cache.mediaItems.length} items from cache`);
      return true;
    }
  } catch (error) {
    logger.error('Failed to load cache:', { error: error.message });
  }
  return false;
}

// saveCache is now a no-op -- persistence happens inline in setItems and refreshBaseUrls
function saveCache() {
  /* persisted on write */
}

// Set items in cache (called after Picker completion)
// Merges new items with existing cache (deduplicates by item.id)
function setItems(items, sessionId) {
  // Build a Set of existing item IDs for O(1) dedup lookup
  const existingIds = new Set(cache.mediaItems.map(item => item.id));

  // Filter incoming items to only those not already cached
  const newItems = items.filter(item => !existingIds.has(item.id));

  // Append new items (never replace existing)
  cache.mediaItems = [...cache.mediaItems, ...newItems];

  // Always update sessionId to the latest (only latest session can refresh baseUrls)
  cache.sessionId = sessionId;
  cache.lastRefresh = new Date().toISOString();

  logger.info(`Merged ${newItems.length} new items (${items.length - newItems.length} duplicates skipped), total: ${cache.mediaItems.length}`);

  // Persist new items to DB in a transaction
  try {
    const { insertItem, updateSessionId } = getStatements();
    const insertMany = db.transaction((newItems, sessionId) => {
      for (const item of newItems) {
        insertItem.run(sessionId, item.id, JSON.stringify(item));
      }
      // Update session_id for all rows for this user
      updateSessionId.run(sessionId);
    });
    insertMany(newItems, sessionId);
  } catch (error) {
    logger.error('Failed to persist items to DB:', { error: error.message });
  }

  // Start refresh interval if not already running
  if (!refreshIntervalHandle && cache.mediaItems.length > 0) {
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

// Get items matching today's month+day across all years ("On This Day")
function getOnThisDayItems() {
  const now = new Date();
  const todayMonth = now.getMonth(); // 0-11
  const todayDay = now.getDate();    // 1-31

  return cache.mediaItems.filter(item => {
    if (!item.createTime) return false;
    try {
      const d = new Date(item.createTime);
      return d.getMonth() === todayMonth && d.getDate() === todayDay;
    } catch {
      return false;
    }
  });
}

// Get random item from On This Day set
function getRandomOnThisDayItem() {
  const items = getOnThisDayItems();
  if (items.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

// Get count of On This Day matching photos
function getOnThisDayCount() {
  return getOnThisDayItems().length;
}

// Get portrait items (height > width) from cache
function getPortraitItems() {
  return cache.mediaItems.filter(item => {
    // Picker API stores dimensions in mediaFile.mediaFileMetadata
    const metadata = item.mediaFile?.mediaFileMetadata;
    if (!metadata) return false;
    const width = parseInt(metadata.width, 10);
    const height = parseInt(metadata.height, 10);
    if (isNaN(width) || isNaN(height)) return false;
    return height > width;
  });
}

// Get random portrait item from cache
function getRandomPortraitItem() {
  const portraits = getPortraitItems();
  if (portraits.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * portraits.length);
  return portraits[randomIndex];
}

// Get count of portrait photos in cache
function getPortraitCount() {
  return getPortraitItems().length;
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

    // Persist updated items to DB in a transaction
    try {
      const { updateItem } = getStatements();
      const updateMany = db.transaction((allItems, sessionId) => {
        for (const item of allItems) {
          updateItem.run(JSON.stringify(item), sessionId, item.id);
        }
      });
      updateMany(allItems, cache.sessionId);
    } catch (dbError) {
      logger.error('Failed to persist refreshed items to DB:', { error: dbError.message });
    }

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
  getRandomOnThisDayItem,
  getOnThisDayCount,
  getRandomPortraitItem,
  getPortraitCount,
  setItems,
  size,
  getSessionId,
  getLastRefresh,
  getLastApiCall,
  refreshBaseUrls
};
