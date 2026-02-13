const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Default config values
const defaults = {
  interval: 30,           // seconds between photo transitions
  displayMode: 'cover',   // 'cover' | 'contain' | 'dual'
  onThisDay: false,       // On This Day feature toggle
  portraitPairs: false,    // Portrait pair detection toggle
};

// In-memory config (populated on first load)
let currentConfig = null;

/**
 * Load config from config.json, merging with defaults for any missing keys.
 * Creates config.json with defaults if it doesn't exist.
 * @returns {object} The loaded config
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const saved = JSON.parse(raw);
      // Merge: defaults first, then saved values override
      currentConfig = { ...defaults, ...saved };
    } else {
      currentConfig = { ...defaults };
      // Write defaults to disk so config.json exists
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Failed to load config, using defaults:', err.message);
    currentConfig = { ...defaults };
  }
  return currentConfig;
}

/**
 * Save partial config updates. Merges updates into current config and writes to disk.
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

    validated[key] = value;
  }

  currentConfig = { ...currentConfig, ...validated };

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config:', err.message);
  }

  return currentConfig;
}

/**
 * Get current in-memory config. Loads from disk if not yet loaded.
 * @returns {object} The current config
 */
function getConfig() {
  if (!currentConfig) {
    loadConfig();
  }
  return { ...currentConfig };
}

module.exports = { loadConfig, saveConfig, getConfig, defaults };
