const CACHE_VERSION = 'okno-v1.6';
const PHOTO_CACHE = 'okno-photos-v1.6';

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

// Fetch: network-first for photos, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for photo API (prioritize fresh photos)
  if (url.pathname.startsWith('/api/photo') || url.pathname.startsWith('/api/demo/random')) {
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
  // Cache-first for static assets (same-origin only)
  else if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
