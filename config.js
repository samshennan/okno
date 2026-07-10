const db = require('./db/database');
const logger = require('./logger');

// Default config values
const defaults = {
  interval: 30,           // seconds between photo transitions
  displayMode: 'cover',   // 'cover' | 'contain' | 'dual'
  onThisDay: false,       // On This Day feature toggle
  portraitPairs: false,    // Portrait pair detection toggle
  transitionTime: 1,      // Photo transition duration in seconds
  kenBurns: true,          // Gentle zoom and pan on each photo
  blurredBackground: true, // Fill black bars with blurred version of photo
  showPhotoDate: true,     // Show when photo was taken
  showClock: false,        // Show current time on slideshow
};

// Per-user config: Map<userId, config>
const userConfigs = new Map();

// Prepared statements (lazy-initialized)
let stmtSelect = null;
let stmtUpsert = null;

function getStatements() {
  if (!stmtSelect) {
    stmtSelect = db.prepare('SELECT settings FROM user_settings WHERE user_id = ?');
    stmtUpsert = db.prepare(`
      INSERT INTO user_settings (user_id, settings, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        settings = excluded.settings,
        updated_at = datetime('now')
    `);
  }
  return { stmtSelect, stmtUpsert };
}

/**
 * Load config from database for a specific user, merging with defaults.
 * Returns defaults if no row exists yet.
 * @param {number} userId
 * @returns {object} The loaded config
 */
function loadConfig(userId) {
  try {
    const { stmtSelect } = getStatements();
    const row = stmtSelect.get(userId);
    if (row) {
      const saved = JSON.parse(row.settings);
      const config = { ...defaults, ...saved };
      userConfigs.set(userId, config);
      return config;
    }
  } catch (err) {
    logger.error('Failed to load config, using defaults:', { userId, error: err.message });
  }
  const config = { ...defaults };
  userConfigs.set(userId, config);
  return config;
}

/**
 * Save partial config updates for a specific user. Merges updates into current config and writes to DB.
 * @param {number} userId
 * @param {object} updates - Key/value pairs to update
 * @returns {object} The updated config
 */
function saveConfig(userId, updates) {
  if (!userConfigs.has(userId)) {
    loadConfig(userId);
  }

  // Validate known keys and types
  const allowedKeys = Object.keys(defaults);
  const validated = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedKeys.includes(key)) {
      continue; // Skip unknown keys
    }

    // Type-check against defaults
    const expectedType = typeof defaults[key];
    if (typeof value !== expectedType) {
      continue; // Skip mistyped values
    }

    // Additional validation
    if (key === 'interval' && (value < 5 || value > 600)) {
      continue; // Interval must be 5-600 seconds
    }
    if (key === 'displayMode' && !['cover', 'contain', 'dual'].includes(value)) {
      continue; // Must be a valid display mode
    }
    if (key === 'transitionTime' && (value < 0.5 || value > 5)) {
      continue; // Transition time must be 0.5-5 seconds
    }

    validated[key] = value;
  }

  const current = userConfigs.get(userId);
  const updated = { ...current, ...validated };
  userConfigs.set(userId, updated);

  try {
    const { stmtUpsert } = getStatements();
    stmtUpsert.run(userId, JSON.stringify(updated));
  } catch (err) {
    logger.error('Failed to save config:', { userId, error: err.message });
  }

  return updated;
}

/**
 * Get current in-memory config for a specific user. Loads from DB if not yet loaded.
 * @param {number} userId
 * @returns {object} The current config
 */
function getConfig(userId) {
  if (!userConfigs.has(userId)) {
    loadConfig(userId);
  }
  return { ...userConfigs.get(userId) };
}

/**
 * Evict a user's in-memory config (called on logout).
 * @param {number} userId
 */
function clearUserConfig(userId) {
  userConfigs.delete(userId);
}

module.exports = { loadConfig, saveConfig, getConfig, clearUserConfig, defaults };
