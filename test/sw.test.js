// Service worker photo-cache regression tests.
//
// Guards against the class of bug where ?t= cache-busted photo URLs made
// every cache.put land under a unique never-matched key -- unbounded cache
// growth and a dead offline fallback. Photos are now stored under stable
// '/__photo/<id>' keys, capped at 50 entries (FIFO), and a random cached
// photo is served when the network is down.
//
// Gotcha: the first load of a page is never controlled by its service worker
// (sw.js calls clients.claim(), but we don't rely on it), so every test
// reloads after registration -- see openControlledDemo().
//
// Run:  npm run test:ui
// Uses playwright-core with an installed Chrome/Edge (no browser download).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { start } = require('./stub-server');

let stub, browser, baseUrl, stub2;

// Prefer system browsers so no playwright browser download is needed
async function launchBrowser() {
  const candidates = [{ channel: 'chrome' }, { channel: 'msedge' }, {}];
  let lastErr;
  for (const opts of candidates) {
    try { return await chromium.launch(opts); } catch (err) { lastErr = err; }
  }
  throw new Error(
    'No Chromium-based browser found (tried Chrome, Edge, bundled). ' +
    'Install Chrome/Edge or run: npx playwright install chromium\n' + lastErr
  );
}

before(async () => {
  stub = await start(0); // ephemeral port
  baseUrl = `http://localhost:${stub.port}`;
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  stub?.server.close();
  try { stub2?.server.close(); } catch { /* already closed by the offline test */ }
});

// Open demo.html and get it under service worker control: the first load
// registers the SW but is not controlled by it, so reload once it's ready
async function openControlledDemo(context, url) {
  const page = await context.newPage();
  await page.goto(`${url}/demo.html`);
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  await page.reload();
  await page.waitForFunction('navigator.serviceWorker.controller !== null');
  return page;
}

// Count '/__photo/' keys in the photo cache (runs in the page)
const PHOTO_KEY_COUNT = `(async () => {
  const cache = await caches.open('okno-photos-v1.7');
  const keys = await cache.keys();
  return keys.filter((r) => new URL(r.url).pathname.startsWith('/__photo/')).length;
})()`;

test('sw: registers, precaches, and controls the demo page after reload', async () => {
  const context = await browser.newContext();
  const page = await openControlledDemo(context, baseUrl);

  const cacheNames = await page.evaluate('caches.keys()');
  assert.ok(cacheNames.includes('okno-v1.7'), `static cache missing (got ${cacheNames})`);
  assert.equal(
    await page.evaluate('navigator.serviceWorker.controller !== null'),
    true, 'page must be SW-controlled after reload'
  );

  await context.close();
});

test('sw: photo cache is bounded at 50 entries (FIFO eviction)', async () => {
  const context = await browser.newContext();
  const page = await openControlledDemo(context, baseUrl);

  // 60 unique photos (stub sends X-Photo-Id: photo-1, photo-2, ...) -- the
  // demo slideshow adds a few more of its own, which only pushes evictions
  await page.evaluate(`(async () => {
    for (let i = 0; i < 60; i++) await fetch('/api/demo/random?t=' + i);
  })()`);

  // Cache writes happen async via waitUntil -- poll until eviction lands
  await page.waitForFunction(`${PHOTO_KEY_COUNT}.then((n) => n === 50)`, null, { timeout: 10000 });
  assert.equal(await page.evaluate(PHOTO_KEY_COUNT), 50, 'cache must hold exactly 50 photos');

  await context.close();
});

test('sw: offline fallback serves a cached photo when the network dies', async () => {
  // Dedicated stub + context so killing the server cannot affect other tests
  stub2 = await start(0);
  const context = await browser.newContext();
  const page = await openControlledDemo(context, `http://localhost:${stub2.port}`);

  // Seed the cache and wait for at least one photo to land
  await page.evaluate(`(async () => {
    for (let i = 0; i < 5; i++) await fetch('/api/demo/random?t=seed' + i);
  })()`);
  await page.waitForFunction(`${PHOTO_KEY_COUNT}.then((n) => n >= 1)`, null, { timeout: 10000 });

  // Kill the server for real -- closeAllConnections is required, otherwise
  // keep-alive sockets would let fetches keep succeeding
  stub2.server.close();
  stub2.server.closeAllConnections();

  // The fallback must be stable, not a one-off -- fetch offline three times
  for (let i = 1; i <= 3; i++) {
    const result = await page.evaluate(`(async () => {
      const r = await fetch('/api/demo/random?t=offline${i}');
      return { ok: r.ok, type: r.headers.get('Content-Type'), size: (await r.blob()).size };
    })()`);
    assert.equal(result.ok, true, `offline fetch #${i} must resolve from cache`);
    assert.equal(result.type, 'image/jpeg', `offline fetch #${i} must be a photo`);
    assert.ok(result.size > 0, `offline fetch #${i} must have a body`);
  }

  await context.close();
});
