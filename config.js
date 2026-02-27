const db = require('./db/database');

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

// In-memory config (populated on first load)
let currentConfig = null;

// Prepared statements (lazy-initialized)
let stmtSelect = null;
let stmtUpsert = null;

function getStatements() {
  if (!stmtSelect) {
    stmtSelect = db.prepare('SELECT settings FROM user_settings WHERE user_id = 1');
    stmtUpsert = db.prepare(`
      INSERT INTO user_settings (user_id, settings, updated_at)
      VALUES (1, @settings, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        settings = excluded.settings,
        updated_at = datetime('now')
    `);
  }
  return { stmtSelect, stmtUpsert };
}

/**
 * Load config from database, merging with defaults for any missing keys.
 * Returns defaults if no row exists yet.
 * @returns {object} The loaded config
 */
function loadConfig() {
  try {
    const { stmtSelect } = getStatements();
    const row = stmtSelect.get();
    if (row) {
      const saved = JSON.parse(row.settings);
      currentConfig = { ...defaults, ...saved };
    } else {
      currentConfig = { ...defaults };
    }
  } catch (err) {
    console.error('Failed to load config, using defaults:', err.message);
    currentConfig = { ...defaults };
  }
  return currentConfig;
}

/**
 * Save partial config updates. Merges updates into current config and writes to DB.
 * @param {object} updates - Key/value pairs to update
 * @returns {object} The updated config
 */
function saveConfig(updates) {
  if (!currentConfig) {
    loadConfig();
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

  currentConfig = { ...currentConfig, ...validated };

  try {
    const { stmtUpsert } = getStatements();
    stmtUpsert.run({ settings: JSON.stringify(currentConfig) });
  } catch (err) {
    console.error('Failed to save config:', err.message);
  }

  return currentConfig;
}

/**
 * Get current in-memory config. Loads from DB if not yet loaded.
 * @returns {object} The current config
 */
function getConfig() {
  if (!currentConfig) {
    loadConfig();
  }
  return { ...currentConfig };
}

module.exports = { loadConfig, saveConfig, getConfig, defaults };
