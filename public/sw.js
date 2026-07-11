const CACHE_VERSION = 'okno-v1.7';
const PHOTO_CACHE = 'okno-photos-v1.7';
const PHOTO_CACHE_MAX_ENTRIES = 50;

// Random photos are stored under stable synthetic keys ('/__photo/<id>') --
// the real request URLs carry ?t= cache-busters, so caching by request URL
// would store every photo under a unique never-matched key (unbounded growth)
const PHOTO_KEY_PREFIX = '/__photo/';

// Only precache public assets -- auth-gated pages (slideshow.html, index.html, settings.html)
// must NOT be precached: they redirect to /login when unauthenticated, breaking SW install
const STATIC_ASSETS = [
  '/demo.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Install: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION && cacheName !== PHOTO_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Store a photo under its stable '/__photo/<id>' key, then evict the oldest
// entries beyond the cap. cache.keys() is insertion-ordered, so eviction is
// FIFO by first-cached, not LRU
function cachePhoto(photoId, response) {
  return caches.open(PHOTO_CACHE).then((cache) => {
    const key = new Request(PHOTO_KEY_PREFIX + encodeURIComponent(photoId));
    return cache.put(key, response).then(() => {
      return cache.keys().then((keys) => {
        const photoKeys = keys.filter((request) => {
          return new URL(request.url).pathname.startsWith(PHOTO_KEY_PREFIX);
        });
        const excess = photoKeys.slice(0, Math.max(0, photoKeys.length - PHOTO_CACHE_MAX_ENTRIES));
        return Promise.all(excess.map((request) => cache.delete(request)));
      });
    });
  });
}

// Pick a uniformly random cached photo; resolves undefined when none are
// cached (surfaces to the page as a network error, exactly like no SW)
function randomCachedPhoto() {
  return caches.open(PHOTO_CACHE).then((cache) => {
    return cache.keys().then((keys) => {
      const photoKeys = keys.filter((request) => {
        return new URL(request.url).pathname.startsWith(PHOTO_KEY_PREFIX);
      });
      if (photoKeys.length === 0) return undefined;
      const pick = photoKeys[Math.floor(Math.random() * photoKeys.length)];
      return cache.match(pick);
    });
  });
}

// Fetch: network-first for photos, cache-first for static
self.addEventListener('fetch', (event) => {
  // Non-GETs (e.g. POST /api/photo/hide) must bypass the SW entirely --
  // cache.put on a POST rejects silently
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for random photos (prioritize fresh photos). Successful
  // responses are cached under '/__photo/<id>' keys; on network failure a
  // random cached photo keeps an offline frame rotating its last ~50 photos
  if (url.pathname === '/api/photo/random' || url.pathname === '/api/demo/random') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses -- never cache 502s or other errors
          const photoId = response.headers.get('X-Photo-Id');
          if (response.ok && photoId) {
            // Cache in the background -- don't make the page wait for the write
            event.waitUntil(cachePhoto(photoId, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return randomCachedPhoto();
        })
    );
  }
  // Network-first for other photo APIs (thumbnails, hidden list) -- these
  // URLs are stable, so exact-key matching works for offline fallback. They
  // don't count toward the photo cap ('/__photo/' prefix filter handles that)
  else if (url.pathname.startsWith('/api/photo')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses -- never cache 502s or other errors
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(PHOTO_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - return cached version if available
          return caches.match(event.request);
        })
    );
  }
  // Cache-first for static assets (remaining same-origin GETs)
  else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
