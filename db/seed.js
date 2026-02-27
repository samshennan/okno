// db/seed.js
// One-time migration: reads legacy JSON files, inserts as first user, renames to .migrated
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, '..', 'tokens.json');
const CACHE_PATH = path.join(__dirname, '..', 'cache.json');
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function seedFromJson(db) {
  // Only seed if users table is empty (prevents re-migration)
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  const hasTokens = fs.existsSync(TOKEN_PATH);
  const hasCache = fs.existsSync(CACHE_PATH);
  const hasConfig = fs.existsSync(CONFIG_PATH);

  // Fresh install: no JSON files, no users -- skip seeding entirely (Pitfall 5)
  if (!hasTokens && !hasCache && !hasConfig) return;

  console.log('Migrating JSON files to database...');

  db.transaction(() => {
    // 1. Create first user from ALLOWED_EMAILS env var
    const email = process.env.ALLOWED_EMAILS?.split(',')[0]?.trim() || 'owner@local';
    const insertUser = db.prepare(
      "INSERT INTO users (email, display_name, created_at) VALUES (?, ?, datetime('now'))"
    );
    const { lastInsertRowid: userId } = insertUser.run(email, 'Owner');
    console.log(`Created user ${userId}: ${email}`);

    // 2. Migrate tokens (skip if no refresh_token -- dead token, Pitfall 4)
    if (hasTokens) {
      try {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        if (tokens.refresh_token) {
          db.prepare(`
            INSERT INTO tokens (user_id, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            userId,
            tokens.access_token || '',
            tokens.refresh_token,
            tokens.expiry_date || null,
            tokens.scope || null,
            tokens.token_type || null
          );
          console.log('Migrated tokens (refresh_token present)');
        } else {
          console.log('Skipped tokens migration (no refresh_token -- dead token)');
        }
      } catch (err) {
        console.error('Failed to migrate tokens.json:', err.message);
      }
    }

    // 3. Migrate photo cache
    if (hasCache) {
      try {
        const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
        const items = cache.mediaItems || [];
        const sessionId = cache.sessionId || null;

        const insertItem = db.prepare(`
          INSERT OR IGNORE INTO photo_cache (user_id, session_id, media_item_id, media_item_data, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `);

        let migrated = 0;
        for (const item of items) {
          if (!item.id) continue; // Skip items without ID
          insertItem.run(userId, sessionId, item.id, JSON.stringify(item));
          migrated++;
        }
        console.log(`Migrated ${migrated}/${items.length} photo cache items`);
      } catch (err) {
        console.error('Failed to migrate cache.json:', err.message);
      }
    }

    // 4. Migrate config/settings
    if (hasConfig) {
      try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        db.prepare(`
          INSERT INTO user_settings (user_id, settings, updated_at)
          VALUES (?, ?, datetime('now'))
        `).run(userId, JSON.stringify(config));
        console.log('Migrated config settings');
      } catch (err) {
        console.error('Failed to migrate config.json:', err.message);
      }
    }
  })(); // Execute transaction immediately -- MUST commit before renaming files (Pitfall 6)

  // 5. Rename JSON files to .migrated AFTER transaction commits
  const renameIfExists = (filePath) => {
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, filePath + '.migrated');
      console.log(`Renamed ${path.basename(filePath)} -> ${path.basename(filePath)}.migrated`);
    }
  };

  renameIfExists(TOKEN_PATH);
  renameIfExists(CACHE_PATH);
  renameIfExists(CONFIG_PATH);

  console.log('JSON-to-DB migration complete');
}

module.exports = { seedFromJson };
