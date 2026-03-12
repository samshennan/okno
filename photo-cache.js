const db = require('./db/database');
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

// Per-user cache: Map<userId, CacheData>
const userCaches = new Map();

// Refresh interval handle
let refreshIntervalHandle = null;

// Prepared statements (lazy-initialized)
let stmts = null;

function getStatements() {
  if (!stmts) {
    stmts = {
      selectAll: db.prepare('SELECT media_item_id, media_item_data, session_id FROM photo_cache WHERE user_id = ?'),
      insertItem: db.prepare(`
        INSERT OR IGNORE INTO photo_cache (user_id, session_id, media_item_id, media_item_data, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `),
      updateSessionId: db.prepare('UPDATE photo_cache SET session_id = ? WHERE user_id = ?'),
      updateItem: db.prepare('UPDATE photo_cache SET media_item_data = ?, session_id = ? WHERE user_id = ? AND media_item_id = ?'),
    };
  }
  return stmts;
}

// Get or create per-user cache (loads from DB on first access)
function getUserCache(userId) {
  if (!userCaches.has(userId)) {
    const cacheData = {
      sessionId: null,
      mediaItems: [],
      lastRefresh: null,
      lastApiCall: null,
      refreshInProgress: false
    };

    try {
      const { selectAll } = getStatements();
      const rows = selectAll.all(userId);
      if (rows.length > 0) {
        cacheData.mediaItems = rows.map(row => JSON.parse(row.media_item_data));
        cacheData.sessionId = rows.find(r => r.session_id)?.session_id || null;
        logger.info(`Loaded ${cacheData.mediaItems.length} items from cache`, { userId });

        // Trigger immediate baseUrl refresh (fire-and-forget, keeps getUserCache synchronous)
        setImmediate(() => refreshBaseUrls(userId));
        startRefreshInterval();
      }
    } catch (error) {
      logger.error('Failed to load cache:', { userId, error: error.message });
    }

    userCaches.set(userId, cacheData);
  }
  return userCaches.get(userId);
}

// Set items in cache (called after Picker completion)
// Merges new items with existing cache (deduplicates by item.id)
function setItems(userId, items, sessionId) {
  const cache = getUserCache(userId);

  // Build a Set of existing item IDs for O(1) dedup lookup
  const existingIds = new Set(cache.mediaItems.map(item => item.id));

  // Filter incoming items to only those not already cached
  const newItems = items.filter(item => !existingIds.has(item.id));

  // Append new items (never replace existing)
  cache.mediaItems = [...cache.mediaItems, ...newItems];

  // Always update sessionId to the latest (only latest session can refresh baseUrls)
  cache.sessionId = sessionId;
  cache.lastRefresh = new Date().toISOString();

  logger.info(`Merged ${newItems.length} new items (${items.length - newItems.length} duplicates skipped), total: ${cache.mediaItems.length}`, { userId });

  // Persist new items to DB in a transaction
  try {
    const { insertItem, updateSessionId } = getStatements();
    const insertMany = db.transaction((newItems, sessionId, userId) => {
      for (const item of newItems) {
        insertItem.run(userId, sessionId, item.id, JSON.stringify(item));
      }
      // Update session_id for all rows for this user
      updateSessionId.run(sessionId, userId);
    });
    insertMany(newItems, sessionId, userId);
  } catch (error) {
    logger.error('Failed to persist items to DB:', { userId, error: error.message });
  }

  // Start refresh interval if not already running
  startRefreshInterval();
}

// Get item by ID
function getItem(userId, id) {
  const cache = getUserCache(userId);
  return cache.mediaItems.find(item => item.id === id) || null;
}

// Get random item from cache
function getRandomItem(userId) {
  const cache = getUserCache(userId);
  if (cache.mediaItems.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * cache.mediaItems.length);
  return cache.mediaItems[randomIndex];
}

// Get items matching today's month+day across all years ("On This Day")
function getOnThisDayItems(userId) {
  const cache = getUserCache(userId);
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
function getRandomOnThisDayItem(userId) {
  const items = getOnThisDayItems(userId);
  if (items.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

// Get count of On This Day matching photos
function getOnThisDayCount(userId) {
  return getOnThisDayItems(userId).length;
}

// Get portrait items (height > width) from cache
function getPortraitItems(userId) {
  const cache = getUserCache(userId);
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
function getRandomPortraitItem(userId) {
  const portraits = getPortraitItems(userId);
  if (portraits.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * portraits.length);
  return portraits[randomIndex];
}

// Get count of portrait photos in cache
function getPortraitCount(userId) {
  return getPortraitItems(userId).length;
}

// Get cache size
function size(userId) {
  const cache = getUserCache(userId);
  return cache.mediaItems.length;
}

// Get session ID
function getSessionId(userId) {
  const cache = getUserCache(userId);
  return cache.sessionId;
}

// Get last refresh timestamp
function getLastRefresh(userId) {
  const cache = getUserCache(userId);
  return cache.lastRefresh;
}

// Get last API call timestamp
function getLastApiCall(userId) {
  const cache = getUserCache(userId);
  return cache.lastApiCall;
}

// Refresh baseUrls by re-calling mediaItems.list for a specific user
async function refreshBaseUrls(userId) {
  const cache = getUserCache(userId);
  if (!cache.sessionId || cache.mediaItems.length === 0) {
    logger.info('Skipping baseUrl refresh - no session or items in cache', { userId });
    return;
  }

  if (cache.refreshInProgress) {
    logger.info('Refresh already in progress, skipping', { userId });
    return;
  }
  cache.refreshInProgress = true;

  try {
    logger.info('Starting baseUrl refresh', { userId, sessionId: cache.sessionId });

    // Lazy require to avoid circular dependency (auth.js does not require photo-cache)
    const { getOAuth2ClientForUser } = require('./auth');
    const client = getOAuth2ClientForUser(userId);

    // Get access token
    const { token } = await client.getAccessToken();

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
          userId,
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
      const updateMany = db.transaction((allItems, sessionId, userId) => {
        for (const item of allItems) {
          updateItem.run(JSON.stringify(item), sessionId, userId, item.id);
        }
      });
      updateMany(allItems, cache.sessionId, userId);
    } catch (dbError) {
      logger.error('Failed to persist refreshed items to DB:', { userId, error: dbError.message });
    }

    logger.info(`Refreshed ${allItems.length} baseUrls`, { userId });
    cache.refreshInProgress = false;
  } catch (error) {
    cache.refreshInProgress = false;
    logger.error('Failed to refresh baseUrls:', { userId, error: error.message });
  }
}

// Start the refresh interval that iterates all active user caches
function startRefreshInterval() {
  if (refreshIntervalHandle) return;
  logger.info(`Starting baseUrl refresh interval (every ${REFRESH_INTERVAL_MS / 60000} minutes)`);
  refreshIntervalHandle = setInterval(async () => {
    for (const [userId] of userCaches) {
      try {
        await refreshBaseUrls(userId);
      } catch (error) {
        logger.error('Failed to refresh baseUrls for user', { userId, error: error.message });
      }
    }
  }, REFRESH_INTERVAL_MS);
}

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
