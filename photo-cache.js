const db = require('./db/database');
const logger = require('./logger');
const { getOAuth2ClientForUser } = require('./oauth-clients');

// Refresh interval: 50 minutes (before 60-minute expiry)
const REFRESH_INTERVAL_MS = 50 * 60 * 1000;

// Treat a refresh lock as stale after 10 minutes
const REFRESH_LOCK_STALE_MS = 10 * 60 * 1000;

// Skip refreshing users whose last photo request is older than 2 hours
const DORMANT_THRESHOLD_MS = 2 * 60 * 60 * 1000;

// Per-user cache: Map<userId, CacheData>
const userCaches = new Map();

// Refresh interval handle
let refreshIntervalHandle = null;

// Prepared statements (lazy-initialized)
let stmts = null;

function getStatements() {
  if (!stmts) {
    stmts = {
      selectAll: db.prepare('SELECT media_item_id, media_item_data, session_id, hidden FROM photo_cache WHERE user_id = ?'),
      insertItem: db.prepare(`
        INSERT OR IGNORE INTO photo_cache (user_id, session_id, media_item_id, media_item_data, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `),
      updateSessionId: db.prepare('UPDATE photo_cache SET session_id = ? WHERE user_id = ?'),
      updateItem: db.prepare('UPDATE photo_cache SET media_item_data = ?, session_id = ? WHERE user_id = ? AND media_item_id = ?'),
      hideItem: db.prepare('UPDATE photo_cache SET hidden = 1 WHERE user_id = ? AND media_item_id = ?'),
      unhideItem: db.prepare('UPDATE photo_cache SET hidden = 0 WHERE user_id = ? AND media_item_id = ?'),
      unhideAll: db.prepare('UPDATE photo_cache SET hidden = 0 WHERE user_id = ?'),
      selectHidden: db.prepare('SELECT media_item_id, media_item_data FROM photo_cache WHERE user_id = ? AND hidden = 1'),
      countHidden: db.prepare('SELECT COUNT(*) as count FROM photo_cache WHERE user_id = ? AND hidden = 1'),
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
      refreshInProgress: false,
      refreshInProgressSince: null
    };

    try {
      const { selectAll } = getStatements();
      const rows = selectAll.all(userId);
      if (rows.length > 0) {
        cacheData.mediaItems = rows.map(row => {
          const item = JSON.parse(row.media_item_data);
          item.hidden = !!row.hidden;
          return item;
        });
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

// Get random item from cache (excludes hidden items)
function getRandomItem(userId) {
  const cache = getUserCache(userId);
  const visible = cache.mediaItems.filter(item => !item.hidden);
  if (visible.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * visible.length);
  return visible[randomIndex];
}

// Get items matching today's month+day across all years ("On This Day")
function getOnThisDayItems(userId) {
  const cache = getUserCache(userId);
  const now = new Date();
  const todayMonth = now.getMonth(); // 0-11
  const todayDay = now.getDate();    // 1-31

  return cache.mediaItems.filter(item => {
    if (item.hidden) return false;
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
    if (item.hidden) return false;
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

// Get cache size (visible items only)
function size(userId) {
  const cache = getUserCache(userId);
  return cache.mediaItems.filter(item => !item.hidden).length;
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

  // Skip users with no session or no photos (avoids API calls for empty caches)
  if (!cache.sessionId || cache.mediaItems.length === 0) {
    logger.info('Skipping baseUrl refresh - no session or items in cache', { userId });
    return;
  }

  // Check for stale lock (treat as unlocked after REFRESH_LOCK_STALE_MS)
  if (cache.refreshInProgress) {
    const lockAge = cache.refreshInProgressSince
      ? Date.now() - cache.refreshInProgressSince
      : Infinity;
    if (lockAge < REFRESH_LOCK_STALE_MS) {
      logger.info('Refresh already in progress, skipping', { userId });
      return;
    }
    logger.warn('Refresh lock was stale, proceeding', { userId, lockAgeMs: lockAge });
  }

  cache.refreshInProgress = true;
  cache.refreshInProgressSince = Date.now();

  try {
    logger.info('Starting baseUrl refresh', { userId, sessionId: cache.sessionId });

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
        cache.refreshInProgress = false;
        cache.refreshInProgressSince = null;
        return;
      }

      const data = await response.json();
      const items = data.mediaItems || [];
      allItems.push(...items);
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Update cache with fresh baseUrls (match by ID), preserving hidden flag
    const itemMap = new Map(allItems.map(item => [item.id, item]));
    cache.mediaItems = cache.mediaItems.map(existingItem => {
      const freshItem = itemMap.get(existingItem.id);
      if (freshItem) {
        freshItem.hidden = existingItem.hidden || false;
        return freshItem;
      }
      return existingItem; // Keep existing if not found in fresh data
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
    cache.refreshInProgressSince = null;
  } catch (error) {
    cache.refreshInProgress = false;
    cache.refreshInProgressSince = null;
    logger.error('Failed to refresh baseUrls:', { userId, error: error.message });
  }
}

// Start the refresh interval that iterates all active user caches
function startRefreshInterval() {
  if (refreshIntervalHandle) return;
  logger.info(`Starting baseUrl refresh interval (every ${REFRESH_INTERVAL_MS / 60000} minutes)`);
  refreshIntervalHandle = setInterval(async () => {
    for (const [userId, cache] of userCaches) {
      // Skip dormant users (no photo request in the last 2 hours)
      if (cache.lastApiCall) {
        const idleMs = Date.now() - new Date(cache.lastApiCall).getTime();
        if (idleMs > DORMANT_THRESHOLD_MS) {
          logger.info('Skipping dormant user during scheduled refresh', { userId, idleMs });
          continue;
        }
      } else if (cache.lastRefresh) {
        // If there has never been an API call but there was a refresh, treat as dormant
        // to avoid burning quota on users who set up but never opened the slideshow
        const idleMs = Date.now() - new Date(cache.lastRefresh).getTime();
        if (idleMs > DORMANT_THRESHOLD_MS) {
          logger.info('Skipping dormant user (no lastApiCall) during scheduled refresh', { userId, idleMs });
          continue;
        }
      }

      try {
        await refreshBaseUrls(userId);
      } catch (error) {
        logger.error('Failed to refresh baseUrls for user', { userId, error: error.message });
      }
    }
  }, REFRESH_INTERVAL_MS);
}

// Hide a photo (persists to DB and updates in-memory cache)
function hideItem(userId, mediaItemId) {
  const cache = getUserCache(userId);
  const item = cache.mediaItems.find(i => i.id === mediaItemId);
  if (!item) return false;
  const { hideItem: hideStmt } = getStatements();
  hideStmt.run(userId, mediaItemId);
  item.hidden = true;
  return true;
}

// Unhide a photo (persists to DB and updates in-memory cache)
function unhideItem(userId, mediaItemId) {
  const cache = getUserCache(userId);
  const item = cache.mediaItems.find(i => i.id === mediaItemId);
  if (!item) return false;
  const { unhideItem: unhideStmt } = getStatements();
  unhideStmt.run(userId, mediaItemId);
  item.hidden = false;
  return true;
}

// Unhide all photos for a user
function unhideAll(userId) {
  const cache = getUserCache(userId);
  const { unhideAll: unhideAllStmt } = getStatements();
  unhideAllStmt.run(userId);
  let count = 0;
  for (const item of cache.mediaItems) {
    if (item.hidden) {
      item.hidden = false;
      count++;
    }
  }
  return count;
}

// Get all hidden items from DB (source of truth)
function getHiddenItems(userId) {
  const { selectHidden } = getStatements();
  const rows = selectHidden.all(userId);
  return rows.map(row => JSON.parse(row.media_item_data));
}

// Get count of hidden items from DB
function hiddenCount(userId) {
  const { countHidden } = getStatements();
  const row = countHidden.get(userId);
  return row.count;
}

// Evict a user's in-memory cache (called on logout)
function clearUserCache(userId) {
  userCaches.delete(userId);
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
  refreshBaseUrls,
  hideItem,
  unhideItem,
  unhideAll,
  getHiddenItems,
  hiddenCount,
  clearUserCache
};
