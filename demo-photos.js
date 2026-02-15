// demo-photos.js -- serves random demo photos from public/demo/
// ISOLATION: This module must NEVER import auth.js, photo-cache.js, or photo-proxy.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DEMO_DIR = path.join(__dirname, 'public', 'demo');
let manifest = [];

// Load manifest on module init
try {
  manifest = JSON.parse(fs.readFileSync(path.join(DEMO_DIR, 'manifest.json'), 'utf8'));
  console.log(`Demo photos loaded: ${manifest.length} photos`);
} catch (e) {
  console.warn('Demo manifest not found:', e.message);
}

// GET /api/demo/random -- serve a random demo photo
router.get('/random', (req, res) => {
  if (manifest.length === 0) {
    return res.status(503).json({ error: 'No demo photos available' });
  }

  const item = manifest[Math.floor(Math.random() * manifest.length)];
  const filePath = path.join(DEMO_DIR, item.file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Photo file not found', id: item.id });
  }

  const isPortrait = item.height > item.width;

  res.set({
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=3600',
    'X-Photo-Id': item.id,
    'X-Photo-CreateTime': item.createTime,
    'X-Photo-IsPortrait': String(isPortrait),
  });

  res.sendFile(filePath);
});

// GET /api/demo/health -- demo status
router.get('/health', (req, res) => {
  const portraitCount = manifest.filter(m => m.height > m.width).length;

  res.json({
    status: 'ok',
    demoMode: true,
    cache: {
      totalItems: manifest.length,
      portraitCount: portraitCount,
    },
  });
});

module.exports = router;
