const slideshowEl = document.getElementById('slideshow');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMessageEl = document.getElementById('errorMessage');

// Demo mode defaults (per context decision: Ken Burns ON, blur ON, photo date ON, clock OFF)
let currentIntervalSeconds = 8;
let displayMode = 'contain'; // Show full photos to demo the blur background effect
let onThisDayEnabled = false;
let portraitPairsEnabled = true; // Showcase portrait pairs feature
let kenBurnsEnabled = true;
let blurredBackgroundEnabled = true;
let showPhotoDateEnabled = true;
let showClockEnabled = false;

let currentIndex = 0;
let isPlaying = true;
let intervalHandle = null;
let pendingPortrait = null; // For dual portrait pairing

// Demo one-cycle tracking
let demoPhotosDisplayed = 0; // Count total displays (not unique -- random endpoint may repeat)
let totalDemoPhotos = 0; // Set from /api/demo/health response

// Ken Burns state
const KB_PRESETS = ['kb-zoom-in-center', 'kb-zoom-in-tl', 'kb-zoom-in-br',
                    'kb-zoom-out-center', 'kb-drift-right', 'kb-drift-left'];
let lastPresetIndex = -1;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Visual effects and overlay state
let clockIntervalId = null;

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
  element.style.animation = 'none';
  element.style.transform = 'none';
  element.style.willChange = 'auto';
  const img = element.tagName === 'IMG' ? element : element.querySelector('.photo');
  if (img && img.src && img.src.startsWith('blob:')) {
    URL.revokeObjectURL(img.src);
  }
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

  const bg = document.createElement('div');
  bg.className = 'photo-bg';

  const dataUri = createTinyBlurDataUri(img);
  if (dataUri) {
    bg.style.backgroundImage = `url(${dataUri})`;
  }

  img.className = 'photo';

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
  updateClock();
  clockIntervalId = setInterval(updateClock, 60000);
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
    document.querySelectorAll('.photo.kenburns').forEach(el => {
      stopKenBurns(el);
    });
  }
});

// Demo one-cycle tracking
function onDemoPhotoDisplayed() {
  demoPhotosDisplayed++;
  if (totalDemoPhotos > 0 && demoPhotosDisplayed >= totalDemoPhotos) {
    // Wait for current photo's display time, then show CTA
    setTimeout(showEndOfDemoCTA, currentIntervalSeconds * 1000);
  }
}

function showEndOfDemoCTA() {
  // Stop the slideshow interval
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  isPlaying = false;
  stopClock();
  stopProgressBar();

  // Show the CTA overlay with fade-in
  const cta = document.getElementById('endOfDemoCTA');
  cta.style.display = 'flex';
}

function restartDemo() {
  const cta = document.getElementById('endOfDemoCTA');
  cta.style.display = 'none';
  demoPhotosDisplayed = 0;
  isPlaying = true;
  startSlideshow();
}

// Exponential backoff retry for network resilience
async function fetchWithRetry(url, maxRetries = 7) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // 4xx errors are intentional, not transient -- return immediately
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Fetch failed after ${maxRetries} retries:`, error);
        throw error;
      }

      // Exponential backoff: 10ms, 20ms, 40ms, 80ms, 160ms, 320ms, 640ms
      const baseDelay = Math.pow(2, attempt) * 10;
      const jitter = Math.random() * baseDelay * 0.1;
      const delay = baseDelay + jitter;

      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function init() {
  try {
    // Get demo photo count
    const healthRes = await fetch('/api/demo/health');
    const health = await healthRes.json();

    if (!health.cache || health.cache.totalItems === 0) {
      showError('No demo photos available');
      return;
    }

    totalDemoPhotos = health.cache.totalItems;

    // Hide loading
    loadingEl.classList.add('hidden');

    // Enable screen wake lock
    enableWakeLock();

    // Load first photo
    await loadPhoto(0);

    // Start slideshow
    startSlideshow();

    // Start clock if enabled (it's not by default in demo)
    startClock();

  } catch (error) {
    console.error('Demo initialization failed:', error);
    showError(error.message);
  }
}

async function loadPhoto(index) {
  try {
    const img = await createPhotoElement();

    if (!img) {
      console.warn('Skipping photo due to load failure - keeping previous photo visible');
      return;
    }

    // Check if portrait (taller than wide)
    const isPortrait = img.naturalHeight > img.naturalWidth;

    // Portrait pairs: when enabled and photo is portrait, fetch a guaranteed portrait companion
    if (portraitPairsEnabled && isPortrait) {
      const companion = await createPhotoElement();
      if (companion && companion.naturalHeight > companion.naturalWidth) {
        await showDualPortraits(img, companion);
        return;
      } else if (companion) {
        // Companion is landscape -- show both as singles sequentially
        await showSinglePhoto(img);
        // Queue companion as next
        setTimeout(() => showSinglePhoto(companion), 100);
        return;
      }
      // If companion fetch failed, show single photo
    }

    pendingPortrait = null;
    await showSinglePhoto(img);

  } catch (error) {
    console.error('Failed to load photo:', error);
  }
}

async function createPhotoElement() {
  const img = document.createElement('img');
  img.className = 'photo preload';

  try {
    const url = `/api/demo/random?t=${Date.now()}`;

    let response;
    try {
      response = await fetchWithRetry(url);
    } catch (err) {
      throw err;
    }

    if (response.status >= 400 && response.status < 500) {
      console.error(`Client error: HTTP ${response.status}`);
      return null;
    }

    // Extract photo metadata from headers
    const photoId = response.headers.get('X-Photo-Id');
    const createTime = response.headers.get('X-Photo-CreateTime');

    const blob = await response.blob();
    img.src = URL.createObjectURL(blob);
    img.dataset.createTime = createTime || '';
    img.dataset.photoId = photoId || '';

    // Apply display mode class
    if (displayMode === 'contain') {
      img.classList.add('contain-mode');
    }

    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // Track demo photo for one-cycle completion
    onDemoPhotoDisplayed();

    return img;
  } catch (error) {
    console.error('Failed to load photo after retries:', error);
    return null;
  }
}

async function showSinglePhoto(img) {
  // STEP 1: Stop Ken Burns on ALL current photos BEFORE crossfade
  slideshowEl.querySelectorAll('.photo.kenburns').forEach(el => {
    stopKenBurns(el);
  });

  // Determine if we should use blur wrapper
  const useBlur = blurredBackgroundEnabled && displayMode !== 'cover';

  let displayElement;

  if (useBlur) {
    displayElement = wrapWithBlurBackground(img);
  } else {
    displayElement = img;
    if (!img.classList.contains('preload')) {
      img.classList.add('preload');
    }
  }

  // Remove old elements that aren't active (cleanup from >1 cycle ago)
  const oldElements = slideshowEl.querySelectorAll('.photo-wrapper, .photo');
  oldElements.forEach(el => {
    if (el.closest('.photo-wrapper.active')) return;
    if (el.classList.contains('active') || el.classList.contains('preload')) return;
    teardownAndRemove(el);
  });

  slideshowEl.appendChild(displayElement);

  // STEP 2: Trigger crossfade
  setTimeout(() => {
    slideshowEl.querySelectorAll('.photo-wrapper.active, .photo.active').forEach(el => {
      el.classList.remove('active');
    });

    displayElement.classList.add('active');
    displayElement.classList.remove('preload');

    currentIndex++;

    // Update overlays
    const photoImg = useBlur ? displayElement.querySelector('.photo') : displayElement;
    updatePhotoDateOverlay(photoImg.dataset.createTime);

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

    currentIndex += 2;

    // Update photo date from left portrait
    updatePhotoDateOverlay(img1.dataset.createTime);

    // STEP 3: Start Ken Burns on EACH portrait independently (different presets)
    setTimeout(() => {
      applyKenBurns(img1);
      applyKenBurns(img2);
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

// Progress bar state
const progressBarEl = document.getElementById('progressBar');

function startProgressBar() {
  stopProgressBar();
  progressBarEl.style.transition = 'none';
  progressBarEl.style.width = '0%';
  progressBarEl.offsetWidth; // Force reflow
  progressBarEl.style.transition = `width ${currentIntervalSeconds}s linear`;
  progressBarEl.style.width = '100%';
}

function stopProgressBar() {
  const computed = getComputedStyle(progressBarEl);
  progressBarEl.style.transition = 'none';
  progressBarEl.style.width = computed.width;
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
  startProgressBar();
}

function showError(message) {
  loadingEl.classList.add('hidden');
  errorMessageEl.textContent = message;
  errorEl.classList.add('visible');
}

// Initialize on load
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  if (action === 'home') window.location.href = '/';
  if (action === 'restart-demo') restartDemo();
});

init();

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
