// Dependency-free stub server for UI tests.
// Serves public/ as-is with faked API endpoints so pages can be exercised
// in a real browser without Google OAuth or a photo cache.
//
// Standalone:  node test/stub-server.js   -> http://localhost:3199
// From tests:  const { start } = require('./stub-server'); await start(0);
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Tiny valid 1x1 JPEG (landscape-ish placeholder photo)
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
);

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function start(port = 3199) {
  const state = {
    config: {
      interval: 30, displayMode: 'cover', onThisDay: false, portraitPairs: false,
      transitionTime: 1, kenBurns: true, blurredBackground: true,
      showPhotoDate: true, showClock: false,
    },
    requestLog: [],
    photoCounter: 0,
  };

  const json = (res, obj, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  const readBody = (req) => new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    const p = u.pathname;

    if (p.startsWith('/api/') || p.startsWith('/auth/')) {
      state.requestLog.push({ method: req.method, url: req.url });
    }

    // --- stubbed APIs ---
    if (p === '/api/config' && req.method === 'GET') return json(res, state.config);
    if (p === '/api/config' && req.method === 'POST') {
      const body = await readBody(req);
      state.requestLog[state.requestLog.length - 1].body = body;
      state.config = { ...state.config, ...body };
      return json(res, state.config);
    }
    if (p === '/api/health' && req.method === 'GET') {
      return json(res, { status: 'ok', cache: { totalItems: 12, portraitCount: 4, onThisDayCount: 7 } });
    }
    if (p === '/api/health/refresh') return json(res, { ok: true });
    if (p === '/api/photo/random' || p === '/api/demo/random') {
      state.photoCounter++;
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'X-Photo-Id': 'photo-' + state.photoCounter,
        'X-Photo-CreateTime': '2024-05-01T12:00:00Z',
      });
      return res.end(TINY_JPEG);
    }
    if (p === '/api/demo/health') {
      return json(res, { status: 'ok', cache: { totalItems: 5 } });
    }
    if (p.startsWith('/api/photo/hide/')) return json(res, { success: true });
    if (p.startsWith('/api/photo/unhide/')) return json(res, { success: true });
    if (p === '/api/photo/unhide-all') return json(res, { success: true, count: 2 });
    if (p === '/api/photo/hidden') {
      return json(res, { items: [{ id: 'h1' }, { id: 'h2' }], count: 2 });
    }
    if (p.startsWith('/api/photo/thumbnail/')) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      return res.end(TINY_JPEG);
    }
    if (p === '/auth/status') return json(res, { authenticated: true });
    if (p === '/auth/logout') return json(res, { ok: true });
    if (p === '/auth/login') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<title>LOGIN STUB</title>LOGIN PAGE STUB');
    }

    // --- introspection for tests ---
    if (p === '/__requests') return json(res, state.requestLog);
    if (p === '/__reset') { state.requestLog.length = 0; return json(res, { ok: true }); }

    // --- static files from public/ ---
    const filePath = p === '/' ? '/index.html' : p;
    const abs = path.join(PUBLIC_DIR, path.normalize(filePath));
    if (!abs.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    fs.readFile(abs, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found: ' + p); }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream',
      });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ server, port: server.address().port, state });
    });
  });
}

module.exports = { start };

if (require.main === module) {
  start(3199).then(({ port }) =>
    console.log(`stub server on http://localhost:${port}`)
  );
}
