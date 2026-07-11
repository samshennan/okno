// UI button wiring regression tests.
//
// Guards against the class of bug where buttons show a press animation but the
// action never runs -- most notably the body touchend preventDefault() that
// swallowed synthetic clicks on touch devices (iPad, the primary target).
//
// Run:  npm run test:ui
// Uses playwright-core with an installed Chrome/Edge (no browser download).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { start } = require('./stub-server');

let stub, browser, baseUrl;

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
});

// Selected-button greens: #8FB5A5 base, #7DA594 when hover sticks after a tap
const ACTIVE_GREENS = ['rgb(143, 181, 165)', 'rgb(125, 165, 148)'];
const assertActiveGreen = (colour, msg) =>
  assert.ok(ACTIVE_GREENS.includes(colour), `${msg} (got ${colour})`);

async function openSlideshow(context) {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/slideshow.html`);
  // init(): health fetch + first photo + startSlideshow
  await page.waitForFunction('typeof photoCount !== "undefined" && photoCount > 0');
  await page.waitForTimeout(300);
  return page;
}

// Attach click counters to buttons so we can assert an action fired exactly once
async function instrumentClicks(page, selectors) {
  await page.evaluate((sels) => {
    window.__clicks = {};
    for (const [name, sel] of Object.entries(sels)) {
      window.__clicks[name] = 0;
      document.querySelector(sel).addEventListener('click', () => window.__clicks[name]++);
    }
  }, selectors);
}

// ---------------------------------------------------------------------------
// Desktop (mouse) -- every control button must act on click
// ---------------------------------------------------------------------------

test('desktop: play/pause, interval, display mode, next and hide all act on click', async () => {
  const context = await browser.newContext();
  const page = await openSlideshow(context);

  // controls appear on mouse movement
  await page.mouse.move(500, 400);
  await page.mouse.move(520, 420);

  // Pause
  await page.click('#playPauseBtn', { timeout: 3000 });
  assert.equal(await page.evaluate('isPlaying'), false, 'Pause click should stop playback');

  // Play again
  await page.mouse.move(500, 400);
  await page.click('#playPauseBtn', { timeout: 3000 });
  assert.equal(await page.evaluate('isPlaying'), true, 'Play click should resume playback');

  // Interval
  await page.mouse.move(500, 400);
  await page.click('#intervalControls button[data-interval="60"]', { timeout: 3000 });
  assert.equal(await page.evaluate('currentIntervalSeconds'), 60);

  // Display mode
  await page.mouse.move(500, 400);
  await page.click('#displayModeControls button[data-mode="contain"]', { timeout: 3000 });
  assert.equal(await page.evaluate('displayMode'), 'contain');

  // Next appends a new photo element
  const photosBefore = await page.evaluate(
    `document.querySelectorAll('#slideshow .photo, #slideshow .photo-wrapper').length`
  );
  await page.mouse.move(500, 400);
  await page.click('#controls button:nth-child(3)', { timeout: 3000 });
  await page.waitForTimeout(400);
  const photosAfter = await page.evaluate(
    `document.querySelectorAll('#slideshow .photo, #slideshow .photo-wrapper').length`
  );
  assert.ok(photosAfter > photosBefore, 'Next click should load a new photo');

  // Hide shows the undo toast
  await page.mouse.move(500, 400);
  await page.click('#hideBtn', { timeout: 3000 });
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(`document.getElementById('hideToast').classList.contains('visible')`),
    true, 'Hide click should show the undo toast'
  );

  await context.close();
});

test('desktop: play/pause button keeps its icon after other buttons are used', async () => {
  const context = await browser.newContext();
  const page = await openSlideshow(context);

  const hasIcon = () =>
    page.evaluate(`!!document.getElementById('playPauseBtn').querySelector('svg')`);

  assert.equal(await hasIcon(), true, 'icon should be present after init');

  await page.mouse.move(500, 400);
  await page.click('#intervalControls button[data-interval="10"]', { timeout: 3000 });
  assert.equal(await hasIcon(), true, 'icon should survive an interval change');

  await page.mouse.move(500, 400);
  await page.click('#controls button:nth-child(3)', { timeout: 3000 }); // Next
  assert.equal(await hasIcon(), true, 'icon should survive Next');

  await page.mouse.move(500, 400);
  await page.click('#playPauseBtn', { timeout: 3000 });
  assert.equal(await hasIcon(), true, 'icon should survive pausing');

  await context.close();
});

// ---------------------------------------------------------------------------
// Touch (emulated iPad) -- the regression that shipped: taps animated but
// never acted because body touchend preventDefault() swallowed the click
// ---------------------------------------------------------------------------

function touchContext() {
  return browser.newContext({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  });
}

test('touch: background tap toggles controls exactly once per tap', async () => {
  const context = await touchContext();
  const page = await openSlideshow(context);

  // wait out the show-on-load auto-hide (500ms show + 4s timer)
  await page.waitForFunction(
    `!document.getElementById('controls').classList.contains('visible')`,
    null, { timeout: 7000 }
  );

  await page.touchscreen.tap(400, 300);
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(`document.getElementById('controls').classList.contains('visible')`),
    true, 'first tap should show controls (a double-fire would hide them again)'
  );

  await page.touchscreen.tap(400, 300);
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(`document.getElementById('controls').classList.contains('visible')`),
    false, 'second tap should hide controls'
  );

  await context.close();
});

test('touch: every slideshow control acts on tap, exactly once', async () => {
  const context = await touchContext();
  const page = await openSlideshow(context);

  await instrumentClicks(page, {
    playPause: '#playPauseBtn',
    interval120: '#intervalControls button[data-interval="120"]',
    modeContain: '#displayModeControls button[data-mode="contain"]',
  });

  // Pause
  await page.evaluate('showControls()');
  await page.tap('#playPauseBtn');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate('isPlaying'), false, 'tap on Pause must stop playback');
  assert.equal(await page.evaluate('window.__clicks.playPause'), 1, 'exactly one click');

  // Interval
  await page.evaluate('showControls()');
  await page.tap('#intervalControls button[data-interval="120"]');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate('currentIntervalSeconds'), 120, 'tap must change interval');
  assert.equal(await page.evaluate('window.__clicks.interval120'), 1, 'exactly one click');

  // Display mode
  await page.evaluate('showControls()');
  await page.tap('#displayModeControls button[data-mode="contain"]');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate('displayMode'), 'contain', 'tap must change display mode');
  assert.equal(await page.evaluate('window.__clicks.modeContain'), 1, 'exactly one click');

  await context.close();
});

test('touch: tapped interval/display buttons turn the active colour', async () => {
  const context = await touchContext();
  const page = await openSlideshow(context);

  await page.evaluate('showControls()');
  await page.tap('#intervalControls button[data-interval="120"]');
  await page.waitForTimeout(300); // allow the 0.25s background transition to settle

  const intervalColours = await page.evaluate(`(() => {
    const active = document.querySelector('#intervalControls button[data-interval="120"]');
    const other = document.querySelector('#intervalControls button[data-interval="30"]');
    return {
      activeClass: active.classList.contains('active'),
      activeBg: getComputedStyle(active).backgroundColor,
      otherClass: other.classList.contains('active'),
    };
  })()`);
  assert.equal(intervalColours.activeClass, true, 'tapped interval button gets .active');
  assertActiveGreen(intervalColours.activeBg, 'tapped interval button turns green');
  assert.equal(intervalColours.otherClass, false, 'previous selection is cleared');

  await page.evaluate('showControls()');
  await page.tap('#displayModeControls button[data-mode="dual"]');
  await page.waitForTimeout(300);

  const modeColours = await page.evaluate(`(() => {
    const active = document.querySelector('#displayModeControls button[data-mode="dual"]');
    return {
      activeClass: active.classList.contains('active'),
      activeBg: getComputedStyle(active).backgroundColor,
    };
  })()`);
  assert.equal(modeColours.activeClass, true, 'tapped display-mode button gets .active');
  assertActiveGreen(modeColours.activeBg, 'tapped display-mode button turns green');

  await context.close();
});

test('touch: tapping the icon inside a button acts and does not dismiss controls', async () => {
  const context = await touchContext();
  const page = await openSlideshow(context);

  await page.evaluate('showControls()');
  const wasPlaying = await page.evaluate('isPlaying');

  // tap dead-centre of the pause icon <svg> inside the play/pause button
  const box = await page.evaluate(`(() => {
    const svg = document.querySelector('#playPauseBtn svg');
    const r = svg.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await page.touchscreen.tap(box.x, box.y);
  await page.waitForTimeout(150);

  assert.equal(await page.evaluate('isPlaying'), !wasPlaying, 'icon tap must trigger the button');
  assert.equal(
    await page.evaluate(`document.getElementById('controls').classList.contains('visible')`),
    true, 'icon tap must not toggle the control panel away'
  );

  await context.close();
});

test('touch: hide button hides exactly once and undo works', async () => {
  const context = await touchContext();
  const page = await openSlideshow(context);
  await page.request.post(`${baseUrl}/__reset`);

  await page.evaluate('showControls()');
  await page.tap('#hideBtn');
  await page.waitForTimeout(300);

  assert.equal(
    await page.evaluate(`document.getElementById('hideToast').classList.contains('visible')`),
    true, 'hide tap should show the undo toast'
  );
  const reqs = await (await page.request.get(`${baseUrl}/__requests`)).json();
  const hides = reqs.filter((r) => r.method === 'POST' && r.url.startsWith('/api/photo/hide/'));
  assert.equal(hides.length, 1, 'exactly one hide request (no double-fire)');

  await page.tap('#undoHideBtn');
  await page.waitForTimeout(200);
  const reqs2 = await (await page.request.get(`${baseUrl}/__requests`)).json();
  const unhides = reqs2.filter((r) => r.method === 'POST' && r.url.startsWith('/api/photo/unhide/'));
  assert.equal(unhides.length, 1, 'undo tap should send exactly one unhide request');

  await context.close();
});

// ---------------------------------------------------------------------------
// Keyboard edge cases
// ---------------------------------------------------------------------------

test('keyboard: Escape in fullscreen leaves fullscreen without exiting the slideshow', async () => {
  const context = await browser.newContext();
  const page = await openSlideshow(context);

  await page.mouse.move(500, 400);
  await page.click('#fullscreenBtn', { timeout: 3000 });
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate('!!document.fullscreenElement'), true, 'should enter fullscreen');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  assert.ok(page.url().includes('/slideshow.html'),
    'Escape in fullscreen must not navigate away from the slideshow');
  // NOTE: a synthesized Esc does not trigger the browser-level fullscreen exit
  // (only physical key presses do), so leave fullscreen programmatically
  await page.evaluate('document.exitFullscreen()');
  await page.waitForTimeout(300);

  // Escape when NOT in fullscreen still exits the slideshow
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  assert.ok(!page.url().includes('/slideshow.html'),
    'Escape outside fullscreen should exit to home');

  await context.close();
});

// ---------------------------------------------------------------------------
// Settings page -- buttons, colour feedback, and save round-trip
// ---------------------------------------------------------------------------

test('settings: tapped buttons update state, turn green, and save posts the config', async () => {
  const context = await touchContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/settings.html`);
  await page.waitForTimeout(400);
  await page.request.post(`${baseUrl}/__reset`);

  await page.tap('#intervalGroup button[data-value="120"]');
  await page.tap('#displayModeGroup button[data-value="dual"]');
  await page.tap('#transitionTimeGroup button[data-value="2"]');
  await page.tap('#kenBurns + .toggle-slider');
  await page.waitForTimeout(300);

  const state = await page.evaluate(`(() => {
    const btn = document.querySelector('#intervalGroup button[data-value="120"]');
    return {
      interval: settings.interval,
      displayMode: settings.displayMode,
      transitionTime: settings.transitionTime,
      kenBurns: settings.kenBurns,
      activeBg: getComputedStyle(btn).backgroundColor,
    };
  })()`);
  assert.equal(state.interval, 120);
  assert.equal(state.displayMode, 'dual');
  assert.equal(state.transitionTime, 2);
  assert.equal(state.kenBurns, false);
  assertActiveGreen(state.activeBg, 'selected settings button turns green');

  await page.tap('.btn-save');
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(`document.getElementById('toast').textContent`),
    'Settings saved'
  );
  const reqs = await (await page.request.get(`${baseUrl}/__requests`)).json();
  const post = reqs.find((r) => r.method === 'POST' && r.url === '/api/config');
  assert.ok(post, 'save must POST /api/config');
  assert.equal(post.body.interval, 120);
  assert.equal(post.body.displayMode, 'dual');
  assert.equal(post.body.kenBurns, false);

  await context.close();
});
