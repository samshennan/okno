const slideshowEl = document.getElementById('slideshow');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMessageEl = document.getElementById('errorMessage');
const currentIndexEl = document.getElementById('currentIndex');
const totalPhotosEl = document.getElementById('totalPhotos');
const playPauseBtn = document.getElementById('playPauseBtn');

let currentIndex = 0;
let photoCount = 0;
let isPlaying = true;
let intervalHandle = null;
let currentIntervalSeconds = 30; // Default 30 seconds (matches config.js default)
let displayMode = 'cover'; // 'cover', 'contain', or 'dual'
let pendingPortrait = null; // For dual mode: holds first portrait photo
let portraitPairsEnabled = false; // Portrait pairs mode from config
let onThisDayEnabled = false; // On This Day mode
let onThisDayFallback = false; // True when OTD had no photos and we fell back to random

// Ken Burns state
let kenBurnsEnabled = true; // from config, updated in loadAppConfig
const KB_PRESETS = ['kb-zoom-in-center', 'kb-zoom-in-tl', 'kb-zoom-in-br',
                    'kb-zoom-out-center', 'kb-drift-right', 'kb-drift-left'];
let lastPresetIndex = -1;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Visual effects and overlay state
let blurredBackgroundEnabled = true; // from config
let showPhotoDateEnabled = true;     // from config
let showClockEnabled = false;        // from config
let clockIntervalId = null;

// App config loaded from server (available to future features via window.appConfig)
window.appConfig = null;

// Screen wake lock using NoSleep.js (Wake Lock API broken in iOS PWAs)
let noSleep = null;
try {
  if (typeof NoSleep !== 'undefined') {
    noSleep = new NoSleep();
    console.log('NoSleep.js initialized');
  } else {
    console.warn('NoSleep.js not loaded - wake lock will be unavailable');
  }
} catch (e) {
  console.error('Failed to initialize NoSleep:', e);
}

let wakeLockEnabled = false;

function enableWakeLock() {
  if (!wakeLockEnabled && noSleep) {
    try {
      noSleep.enable();
      wakeLockEnabled = true;
      console.log('Screen wake lock enabled via NoSleep.js');
    } catch (e) {
      console.error('Failed to enable wake lock:', e);
    }
  }
}

// Ken Burns helpers
function shouldApplyKenBurns() {
  return kenBurnsEnabled && !prefersReducedMotion.matches;
}

function nextKenBurnsPreset() {
  let index;
  do {
    index = Math.floor(Math.random() * KB_PRESETS.length);
  } while (index === lastPresetIndex);
  lastPresetIndex = index;
  return KB_PRESETS[index];
}

function applyKenBurns(photoEl) {
  if (!shouldApplyKenBurns()) return;
  const preset = nextKenBurnsPreset();
  photoEl.classList.add('kenburns');
  // Duration matches slideshow interval so animation completes just as next photo loads
  photoEl.style.animationName = preset;
  photoEl.style.animationDuration = currentIntervalSeconds + 's';
}

function stopKenBurns(photoEl) {
  photoEl.style.animation = 'none';
  photoEl.style.transform = 'none';
  photoEl.classList.remove('kenburns');
}

// GPU teardown: stop animations, de-promote layers, revoke blob URLs, remove from DOM
function teardownAndRemove(element) {
  // Step 1: Stop animations
  element.style.animation = 'none';
  // Step 2: Reset transform (hints compositor to release layer)
  element.style.transform = 'none';
  // Step 3: De-promote from compositor
  element.style.willChange = 'auto';
  // Step 4: Revoke blob URLs
  const img = element.tagName === 'IMG' ? element : element.querySelector('.photo');
  if (img && img.src && img.src.startsWith('blob:')) {
    URL.revokeObjectURL(img.src);
  }
  // Step 5: Remove from DOM
  element.remove();
}

// Blur background helpers
function createTinyBlurDataUri(imgElement) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, 32, 24);
    return canvas.toDataURL('image/jpeg', 0.4);
  } catch (e) {
    console.warn('Failed to create blur thumbnail:', e);
    return null;
  }
}

function wrapWithBlurBackground(img) {
  const wrapper = document.createElement('div');
  wrapper.className = 'photo-wrapper preload';

  // Create blur background
  const bg = document.createElement('div');
  bg.className = 'photo-bg';

  // Generate tiny blur data URI from the loaded image
  const dataUri = createTinyBlurDataUri(img);
  if (dataUri) {
    bg.style.backgroundImage = `url(${dataUri})`;
  }

  // Reset img classes -- wrapper handles opacity transition now
  img.className = 'photo';
  // img already has dataset.createTime and dataset.onThisDayCount from createPhotoElement

  wrapper.appendChild(bg);
  wrapper.appendChild(img);

  return wrapper;
}

// Photo date overlay
function formatPhotoDate(createTimeISO) {
  if (!createTimeISO) return null;
  try {
    const d = new Date(createTimeISO);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
}

function updatePhotoDateOverlay(createTimeISO) {
  const el = document.getElementById('photoDateOverlay');
  if (!showPhotoDateEnabled) {
    el.classList.remove('visible');
    return;
  }
  const formatted = formatPhotoDate(createTimeISO);
  if (formatted) {
    el.textContent = formatted;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

// Clock overlay
function updateClock() {
  const el = document.getElementById('clockOverlay');
  if (!showClockEnabled) {
    el.classList.remove('visible');
    return;
  }
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  el.classList.add('visible');
}

function startClock() {
  if (clockIntervalId) clearInterval(clockIntervalId);
  updateClock(); // Show immediately
  clockIntervalId = setInterval(updateClock, 60000); // Update every minute
}

function stopClock() {
  if (clockIntervalId) {
    clearInterval(clockIntervalId);
    clockIntervalId = null;
  }
}

// Respond to OS-level reduced motion preference changes at runtime
prefersReducedMotion.addEventListener('change', (e) => {
  if (e.matches) {
    // Immediately stop any running Ken Burns animations
    document.querySelectorAll('.photo.kenburns').forEach(el => {
      stopKenBurns(el);
    });
  }
});

function exitSlideshow() {
  stopClock();
  if (wakeLockEnabled && noSleep) {
    try {
      noSleep.disable();
      wakeLockEnabled = false;
    } catch (e) {
      console.error('Failed to disable wake lock:', e);
    }
  }
  window.location.href = '/';
}

// URL params (applied after config load; URL params take precedence over saved config)
const urlParams = new URLSearchParams(window.location.search);
const urlInterval = parseInt(urlParams.get('interval'));
const urlMode = urlParams.get('mode');

// Load config from server, then apply URL param overrides
async function loadAppConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.status === 401) {
      showReconnectOverlay();
      return;
    }
    if (res.ok) {
      window.appConfig = await res.json();

      // Apply config values as base
      if (window.appConfig.interval) {
        currentIntervalSeconds = window.appConfig.interval;
      }
      if (window.appConfig.displayMode && ['cover', 'contain', 'dual'].includes(window.appConfig.displayMode)) {
        displayMode = window.appConfig.displayMode;
      }
      if (window.appConfig.onThisDay === true) {
        onThisDayEnabled = true;
      }
      if (window.appConfig.portraitPairs === true) {
        portraitPairsEnabled = true;
      }
      if (window.appConfig.transitionTime) {
        document.documentElement.style.setProperty('--transition-time', window.appConfig.transitionTime + 's');
      }
      if (window.appConfig.kenBurns === false) {
        kenBurnsEnabled = false;
      }
      if (window.appConfig.blurredBackground === false) {
        blurredBackgroundEnabled = false;
      }
      if (window.appConfig.showPhotoDate === false) {
        showPhotoDateEnabled = false;
      }
      if (window.appConfig.showClock === true) {
        showClockEnabled = true;
      }
    }
  } catch (err) {
    console.warn('Failed to load config, using defaults:', err);
    window.appConfig = {};
  }

  // URL params override saved config (for testing/manual override)
  if (urlInterval && urlInterval > 0) {
    currentIntervalSeconds = urlInterval;
  }
  if (urlMode && ['cover', 'contain', 'dual'].includes(urlMode)) {
    displayMode = urlMode;
  }
}

// Exponential backoff retry for network resilience
async function fetchWithRetry(url, maxRetries = 7) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // 4xx errors are intentional (e.g. 404 = no OTD photos, 401 = session expired), not transient -- return immediately
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // 502 with authentication_required: token refresh failed server-side -- return immediately (not transient)
      if (response.status === 502) {
        try {
          const bodyText = await response.clone().text();
          if (bodyText.includes('authentication_required')) {
            return response;
          }
        } catch (e) {
          // Ignore clone/parse errors, fall through to normal retry
        }
      }

      // 502: trigger proactive baseUrl refresh on first occurrence, then retry normally
      if (response.status === 502 && attempt === 0) {
        console.warn('502 from backend, triggering proactive baseUrl refresh');
        fetch('/api/health/refresh', { method: 'POST' }).catch(() => {});
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Fetch failed after ${maxRetries} retries:`, error);
        throw error; // Final attempt failed
      }

      // Exponential backoff: 10ms, 20ms, 40ms, 80ms, 160ms, 320ms, 640ms
      const baseDelay = Math.pow(2, attempt) * 10;
      const jitter = Math.random() * baseDelay * 0.1; // +/- 10% jitter to prevent thundering herd
      const delay = baseDelay + jitter;

      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Reconnect overlay helpers
function showReconnectOverlay() {
  document.getElementById('reconnect-overlay').style.display = 'flex';
  // Stop the slideshow so we don't keep fetching and hitting 401
  stopSlideshow();
}

function hideReconnectOverlay() {
  document.getElementById('reconnect-overlay').style.display = 'none';
}

// Wire reconnect button -- sends user through Google OAuth flow
document.getElementById('reconnect-btn').addEventListener('click', () => {
  window.location.href = '/auth/login';
});

async function init() {
  try {
    // Load saved config before anything else
    await loadAppConfig();

    // Show On This Day indicator immediately (before any photo loads)
    if (onThisDayEnabled) {
      const today = new Date();
      const formatted = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      document.getElementById('onThisDayDate').textContent = formatted;
      document.getElementById('onThisDayIndicator').classList.add('visible');
    }

    // Get photo count from health endpoint
    const healthRes = await fetch('/api/health');

    if (healthRes.status === 401) {
      showReconnectOverlay();
      return;
    }

    const health = await healthRes.json();

    if (!health.cache || health.cache.totalItems === 0) {
      // No photos available - redirect to home page
      window.location.href = '/';
      return;
    }

    photoCount = health.cache.totalItems;
    totalPhotosEl.textContent = photoCount;

    // Hide loading
    loadingEl.classList.add('hidden');

    // Enable screen wake lock after first successful load
    enableWakeLock();

    // Update button states
    updateIntervalButtons();
    updateDisplayModeButtons();

    // Load first photo
    await loadPhoto(0);

    // Start slideshow
    startSlideshow();

    // Start clock overlay if enabled
    startClock();

  } catch (error) {
    console.error('Initialization failed:', error);
    showError(error.message);
  }
}

async function loadPhoto(index) {
  try {
    // Load new random photo
    const img = await createPhotoElement();

    // If fetch failed after all retries, skip this photo
    if (!img) {
      console.warn('Skipping photo due to load failure - keeping previous photo visible');
      return;
    }

    // Check if portrait (taller than wide)
    const isPortrait = img.naturalHeight > img.naturalWidth;

    // Portrait pairs: when enabled and photo is portrait, fetch a guaranteed portrait companion
    if (portraitPairsEnabled && isPortrait) {
      const companion = await createPhotoElement({ portrait: true });
      if (companion) {
        await showDualPortraits(img, companion);
        return;
      }
      // If companion fetch failed, show single photo
    }

    // Handle legacy dual display mode (manual "2 Portraits" button)
    if (displayMode === 'dual' && isPortrait) {
      if (!pendingPortrait) {
        // First portrait - save it and load another
        pendingPortrait = img;
        await loadPhoto(index); // Recursive call to get second photo
        return;
      } else {
        // Second portrait - show both side-by-side
        await showDualPortraits(pendingPortrait, img);
        pendingPortrait = null;
        return;
      }
    } else if (displayMode === 'dual' && !isPortrait) {
      // Landscape in dual mode: show as full-width single
      // Flush any pending portrait first (don't discard it)
      if (pendingPortrait) {
        await showSinglePhoto(pendingPortrait);
        pendingPortrait = null;
      }
      await showSinglePhoto(img);
    } else {
      // Not dual mode -- show as single
      pendingPortrait = null;
      await showSinglePhoto(img);
    }

  } catch (error) {
    console.error('Failed to load photo:', error);
  }
}

async function createPhotoElement(options = {}) {
  const img = document.createElement('img');
  img.className = 'photo preload';

  try {
    // Build URL with query params
    let url = `/api/photo/random?t=${Date.now()}`;
    if (onThisDayEnabled && !onThisDayFallback) {
      url += '&onThisDay=true';
    }
    if (options.portrait) {
      url += '&portrait=true';
    }

    // Use retry wrapper instead of direct fetch
    // fetchWithRetry returns 4xx responses immediately (no retry), retries 5xx/network errors
    let response;
    try {
      response = await fetchWithRetry(url);
    } catch (err) {
      // All retries exhausted (5xx or network error)
      throw err;
    }

    // Handle 401 (session expired) -- show reconnect overlay
    if (response.status === 401) {
      console.warn('Session expired (401), showing reconnect overlay');
      showReconnectOverlay();
      return null;
    }

    // Handle 502 with authentication_required in body (token refresh failed server-side)
    if (response.status === 502) {
      try {
        const body = await response.clone().text();
        if (body.includes('authentication_required')) {
          console.warn('Token refresh failed (502 authentication_required), showing reconnect overlay');
          showReconnectOverlay();
          return null;
        }
      } catch (e) {
        // Ignore clone/parse errors, fall through to normal handling
      }
    }

    // Handle other 4xx responses (returned immediately by fetchWithRetry, no retries wasted)
    if (response.status >= 400 && response.status < 500) {
      if (onThisDayEnabled && !onThisDayFallback) {
        console.log('On This Day: no photos for today, falling back to random');
        showOnThisDayMessage('No photos from today in history');
        onThisDayFallback = true;
        // Load a random photo immediately (OTD message stays visible until photo appears)
        loadPhoto(currentIndex);
        return null;
      }
      console.error(`Client error: HTTP ${response.status}`);
      return null;
    }

    // Successful fetch -- hide reconnect overlay if it was visible
    if (document.getElementById('reconnect-overlay').style.display !== 'none') {
      hideReconnectOverlay();
    }

    // Store photo ID and create time from response headers
    const photoId = response.headers.get('X-Photo-Id');
    const createTime = response.headers.get('X-Photo-CreateTime');
    const onThisDayCount = response.headers.get('X-Photo-OnThisDayCount');

    const blob = await response.blob();
    img.src = URL.createObjectURL(blob);
    img.dataset.photoId = photoId || '';
    img.dataset.createTime = createTime || '';
    img.dataset.onThisDayCount = onThisDayCount || '';

    // Apply display mode class
    if (displayMode === 'contain') {
      img.classList.add('contain-mode');
    }

    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // Update On This Day indicator
    if (onThisDayEnabled && !onThisDayFallback && createTime) {
      updateOnThisDayIndicator(createTime, onThisDayCount);
    } else {
      hideOnThisDayIndicator();
    }

    return img;
  } catch (error) {
    console.error('Failed to load photo after retries:', error);
    // Return null to keep showing previous photo
    return null;
  }
}


async function showSinglePhoto(img) {
  // Hide On This Day fallback message if visible
  const otdMsg = document.getElementById('onThisDayMessage');
  if (otdMsg) otdMsg.classList.remove('visible');

  // STEP 1: Stop Ken Burns on ALL current photos BEFORE crossfade
  slideshowEl.querySelectorAll('.photo.kenburns').forEach(el => {
    stopKenBurns(el);
  });

  // Determine if we should use blur wrapper
  const useBlur = blurredBackgroundEnabled && displayMode !== 'cover';

  // The element we append to slideshow (either wrapper or bare img)
  let displayElement;

  if (useBlur) {
    displayElement = wrapWithBlurBackground(img);
  } else {
    displayElement = img;
    // Ensure img has preload class for transition
    if (!img.classList.contains('preload')) {
      img.classList.add('preload');
    }
  }

  // Remove old elements that aren't active (cleanup from >1 cycle ago)
  const oldElements = slideshowEl.querySelectorAll('.photo-wrapper, .photo');
  oldElements.forEach(el => {
    // Skip if inside an active wrapper (don't remove children of active wrappers)
    if (el.closest('.photo-wrapper.active')) return;
    if (el.classList.contains('active') || el.classList.contains('preload')) return;
    teardownAndRemove(el);
  });

  slideshowEl.appendChild(displayElement);

  // STEP 2: Trigger crossfade
  setTimeout(() => {
    // Remove active from all current elements
    slideshowEl.querySelectorAll('.photo-wrapper.active, .photo.active').forEach(el => {
      el.classList.remove('active');
    });

    displayElement.classList.add('active');
    displayElement.classList.remove('preload');

    currentIndex = (currentIndex + 1) % photoCount;
    currentIndexEl.textContent = currentIndex + 1;

    // Update overlays
    const photoImg = useBlur ? displayElement.querySelector('.photo') : displayElement;
    updatePhotoDateOverlay(photoImg.dataset.createTime);

    // Enable hide button if photo has an ID
    const hideBtn = document.getElementById('hideBtn');
    hideBtn.disabled = !photoImg.dataset.photoId;

    // STEP 3: Start Ken Burns on the photo (inner img if wrapped)
    setTimeout(() => {
      const targetImg = useBlur ? displayElement.querySelector('.photo') : displayElement;
      applyKenBurns(targetImg);
    }, 100);

    // STEP 4: Clean up old elements after transition completes
    setTimeout(() => {
      const oldWrappers = slideshowEl.querySelectorAll('.photo-wrapper:not(.active)');
      oldWrappers.forEach(w => teardownAndRemove(w));
      const oldPhotos = slideshowEl.querySelectorAll('.photo:not(.active)');
      oldPhotos.forEach(p => {
        // Skip photos inside active wrappers
        if (p.closest('.photo-wrapper.active')) return;
        teardownAndRemove(p);
      });
    }, 1500);
  }, 50);
}

async function showDualPortraits(img1, img2) {
  // STEP 1: Stop Ken Burns on ALL current photos BEFORE crossfade
  slideshowEl.querySelectorAll('.photo.kenburns').forEach(el => {
    stopKenBurns(el);
  });

  // Remove old photos that aren't active (cleanup from >1 cycle ago)
  const oldPhotos = slideshowEl.querySelectorAll('.photo');
  oldPhotos.forEach(photo => {
    if (!photo.classList.contains('active') && !photo.classList.contains('preload')) {
      teardownAndRemove(photo);
    }
  });

  // Position photos side-by-side
  img1.classList.add('dual-left');
  img2.classList.add('dual-right');

  slideshowEl.appendChild(img1);
  slideshowEl.appendChild(img2);

  // STEP 2: Trigger crossfade
  setTimeout(() => {
    const allPhotos = slideshowEl.querySelectorAll('.photo');
    allPhotos.forEach(photo => photo.classList.remove('active'));

    img1.classList.add('active');
    img2.classList.add('active');
    img1.classList.remove('preload');
    img2.classList.remove('preload');

    currentIndex = (currentIndex + 2) % photoCount;
    currentIndexEl.textContent = currentIndex + 1;

    // Update photo date from left portrait
    updatePhotoDateOverlay(img1.dataset.createTime);

    // Enable hide button (uses left portrait's ID)
    const hideBtn = document.getElementById('hideBtn');
    hideBtn.disabled = !img1.dataset.photoId;

    // STEP 3: Start Ken Burns on EACH portrait independently (different presets)
    setTimeout(() => {
      applyKenBurns(img1);
      applyKenBurns(img2); // Gets next preset automatically (different from img1)
    }, 100);

    // STEP 4: Clean up old photos after transition completes
    setTimeout(() => {
      const oldPhotos = slideshowEl.querySelectorAll('.photo:not(.active)');
      oldPhotos.forEach(photo => {
        teardownAndRemove(photo);
      });
    }, 1500);
  }, 50);
}

// On This Day helpers
function updateOnThisDayIndicator(createTimeISO, count) {
  const indicator = document.getElementById('onThisDayIndicator');
  const dateEl = document.getElementById('onThisDayDate');

  try {
    const d = new Date(createTimeISO);
    const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    dateEl.textContent = formatted + (count ? ` (${count} photos)` : '');
  } catch {
    dateEl.textContent = 'On This Day';
  }

  indicator.classList.add('visible');
}

function hideOnThisDayIndicator() {
  document.getElementById('onThisDayIndicator').classList.remove('visible');
}

function showOnThisDayMessage(text) {
  const msg = document.getElementById('onThisDayMessage');
  document.getElementById('onThisDayMsgText').textContent = text;
  msg.classList.add('visible');
  // No auto-hide -- message stays visible until first fallback photo loads (hidden in showSinglePhoto)
}

// Progress bar state
let progressAnimationHandle = null;
const progressBarEl = document.getElementById('progressBar');

function startProgressBar() {
  stopProgressBar();
  progressBarEl.style.transition = 'none';
  progressBarEl.style.width = '0%';
  // Force reflow so the reset takes effect before starting animation
  progressBarEl.offsetWidth;
  progressBarEl.style.transition = `width ${currentIntervalSeconds}s linear`;
  progressBarEl.style.width = '100%';
}

function stopProgressBar() {
  // Freeze at current position
  const computed = getComputedStyle(progressBarEl);
  progressBarEl.style.transition = 'none';
  progressBarEl.style.width = computed.width;
}

function resetProgressBar() {
  progressBarEl.style.transition = 'none';
  progressBarEl.style.width = '0%';
}

function updatePlayPauseButton() {
  const icon = isPlaying ? 'pause' : 'play';
  const text = isPlaying ? ' Pause' : ' Play';
  playPauseBtn.innerHTML = `<i data-lucide="${icon}"></i>${text}`;
  lucide.createIcons();
}

function startSlideshow() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }
  const intervalMs = currentIntervalSeconds * 1000;
  intervalHandle = setInterval(() => {
    if (isPlaying) {
      loadPhoto(currentIndex);
      startProgressBar();
    }
  }, intervalMs);
  isPlaying = true;
  updatePlayPauseButton();
  startProgressBar();
}

function stopSlideshow() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  isPlaying = false;
  updatePlayPauseButton();
  stopProgressBar();
}

function togglePlayPause() {
  if (isPlaying) {
    stopSlideshow();
  } else {
    startSlideshow();
  }
}

function nextPhoto() {
  loadPhoto(currentIndex);
  if (isPlaying) {
    // Restart interval timer and progress bar from scratch
    startSlideshow();
  }
}

function previousPhoto() {
  // Just load a new random photo (we don't track history)
  loadPhoto(currentIndex);
  if (isPlaying) {
    startSlideshow();
  }
}

function showError(message) {
  loadingEl.classList.add('hidden');
  errorMessageEl.textContent = message;
  errorEl.classList.add('visible');
}

// Change slideshow interval
function changeInterval(seconds) {
  currentIntervalSeconds = seconds;
  updateIntervalButtons();
  if (isPlaying) {
    startSlideshow(); // Restart with new interval
  }
}

// Update active state of interval buttons
function updateIntervalButtons() {
  const buttons = document.querySelectorAll('#intervalControls button');
  buttons.forEach(btn => {
    const btnInterval = parseInt(btn.dataset.interval);
    if (btnInterval === currentIntervalSeconds) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Set display mode
function setDisplayMode(mode) {
  displayMode = mode;
  pendingPortrait = null; // Clear pending portrait when changing modes
  updateDisplayModeButtons();

  // Reload current photo with new mode
  loadPhoto(currentIndex);
}

// Update active state of display mode buttons
function updateDisplayModeButtons() {
  const buttons = document.querySelectorAll('#displayModeControls button');
  buttons.forEach(btn => {
    const btnMode = btn.dataset.mode;
    if (btnMode === displayMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Toggle fullscreen
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Fullscreen request failed:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// Hide photo state
let lastHiddenPhotoId = null;
let hideToastTimeout = null;

function hideCurrentPhoto() {
  // Find the currently active photo element
  const activeWrapper = slideshowEl.querySelector('.photo-wrapper.active');
  const activeImg = activeWrapper
    ? activeWrapper.querySelector('.photo')
    : slideshowEl.querySelector('.photo.active');

  if (!activeImg) return;

  const photoId = activeImg.dataset.photoId;
  if (!photoId) return; // Guard against undefined/empty -- do NOT POST to hide/undefined

  // Fire-and-forget hide request
  fetch(`/api/photo/hide/${photoId}`, { method: 'POST' }).catch(() => {});

  // Show toast with undo
  showHideToast(photoId);

  // Hide controls immediately
  hideControls();

  // Advance to next photo after a brief beat
  setTimeout(() => nextPhoto(), 500);
}

function showHideToast(photoId) {
  lastHiddenPhotoId = photoId;
  const toast = document.getElementById('hideToast');
  toast.classList.add('visible');

  // Clear any previous timeout
  if (hideToastTimeout) clearTimeout(hideToastTimeout);

  // Auto-hide after 4 seconds
  hideToastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 4000);
}

function undoHide() {
  if (!lastHiddenPhotoId) return;

  // Unhide the photo
  fetch(`/api/photo/unhide/${lastHiddenPhotoId}`, { method: 'POST' }).catch(() => {});

  // Hide toast immediately
  const toast = document.getElementById('hideToast');
  toast.classList.remove('visible');
  if (hideToastTimeout) clearTimeout(hideToastTimeout);

  lastHiddenPhotoId = null;
}

// Control visibility
let controlsVisible = false;
let hideControlsTimeout = null;

function showControls() {
  controlsVisible = true;
  document.getElementById('controls').classList.add('visible');
  document.getElementById('intervalControls').classList.add('visible');
  document.getElementById('displayModeControls').classList.add('visible');
  document.getElementById('info').classList.add('visible');
  document.getElementById('keyboardHelp').classList.add('visible');
  document.getElementById('sleepReminder').classList.add('visible');
  document.getElementById('hideBtn').classList.add('visible');

  // Auto-hide after 4 seconds
  clearTimeout(hideControlsTimeout);
  hideControlsTimeout = setTimeout(hideControls, 4000);
}

function hideControls() {
  controlsVisible = false;
  document.getElementById('controls').classList.remove('visible');
  document.getElementById('intervalControls').classList.remove('visible');
  document.getElementById('displayModeControls').classList.remove('visible');
  document.getElementById('info').classList.remove('visible');
  document.getElementById('keyboardHelp').classList.remove('visible');
  document.getElementById('sleepReminder').classList.remove('visible');
  document.getElementById('hideBtn').classList.remove('visible');
}

function toggleControls() {
  if (controlsVisible) {
    hideControls();
  } else {
    showControls();
  }
}

// Tap/click anywhere to toggle controls
// Use touchend on touch devices to avoid the double-fire issue on iOS:
// touchend fires when finger lifts; calling preventDefault() stops the
// subsequent synthetic click from also firing (which would show then
// immediately hide the controls on the same gesture).
function handleControlToggle(e) {
  if (e.target.tagName === 'BUTTON' && controlsVisible) {
    clearTimeout(hideControlsTimeout);
    hideControlsTimeout = setTimeout(hideControls, 4000);
    return;
  }
  toggleControls();
}

document.body.addEventListener('touchend', (e) => {
  // Only handle single-finger taps (not pinch/swipe)
  if (e.changedTouches.length === 1) {
    e.preventDefault(); // Stops the synthetic click from firing
    handleControlToggle(e);
  }
});

// Desktop fallback (mouse click, no touch events)
document.body.addEventListener('click', (e) => {
  if (e.pointerType === 'touch') return; // Already handled by touchend
  handleControlToggle(e);
});

// Show controls on any mouse movement (desktop)
let mouseMoveTimeout;
document.addEventListener('mousemove', () => {
  showControls();
  clearTimeout(mouseMoveTimeout);
  mouseMoveTimeout = setTimeout(() => {
    // Don't auto-hide on desktop, just when they stop moving
  }, 100);
});

// Hide button and undo button: use touchend + click with stopPropagation
// to prevent body touchend handler (which calls preventDefault) from blocking clicks
const hideBtnEl = document.getElementById('hideBtn');
const undoHideBtnEl = document.getElementById('undoHideBtn');

document.getElementById('intervalControls').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-interval]');
  if (!button) return;
  changeInterval(parseInt(button.dataset.interval, 10));
});

document.getElementById('displayModeControls').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (!button) return;
  setDisplayMode(button.dataset.mode);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  if (action === 'previous') previousPhoto();
  if (action === 'play-pause') togglePlayPause();
  if (action === 'next') nextPhoto();
  if (action === 'fullscreen') toggleFullscreen();
  if (action === 'exit') exitSlideshow();
});

hideBtnEl.addEventListener('touchend', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!hideBtnEl.disabled) hideCurrentPhoto();
});
hideBtnEl.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!hideBtnEl.disabled) hideCurrentPhoto();
});

undoHideBtnEl.addEventListener('touchend', (e) => {
  e.preventDefault();
  e.stopPropagation();
  undoHide();
});
undoHideBtnEl.addEventListener('click', (e) => {
  e.stopPropagation();
  undoHide();
});

// Initialize on load
init();

// Show controls briefly on load so user knows they exist
setTimeout(() => {
  showControls();
}, 500);

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    togglePlayPause();
  } else if (e.key === 'p' || e.key === 'P') {
    togglePlayPause();
  } else if (e.key === 's' || e.key === 'S') {
    nextPhoto();
  } else if (e.key === 'ArrowRight') {
    nextPhoto();
  } else if (e.key === 'ArrowLeft') {
    previousPhoto();
  } else if (e.key === 'Escape') {
    exitSlideshow();
  }
});

window.addEventListener('beforeunload', () => {
  stopClock();
});

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration.scope);
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}

// Initialize Lucide icons
lucide.createIcons();
