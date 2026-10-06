// Service worker for the Earthlungs Mangrove Monitor PWA.
//
// Caches the site "shell" (pages, stylesheet, logo, hero image, icons) so
// the app opens instantly and still works with a flaky or no connection.
// It deliberately does NOT try to cache the Earth Engine App itself
// (app.html just links out to it) - that's Google's own hosted page,
// cross-origin, and needs a live connection to run its analysis anyway.
//
// Bump CACHE_NAME any time you change which files are listed below, or
// update any of the cached files themselves - that's what makes the
// service worker fetch fresh copies and replace the old cache instead of
// serving stale content forever.
const CACHE_NAME = 'mangrove-monitor-shell-v1';

const SHELL_FILES = [
  'index.html',
  'about.html',
  'app.html',
  'contact.html',
  'style.css',
  'logo.png',
  'hero-bg.jpeg',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll fails entirely if even one file 404s, so missing files here
      // would silently break install - keep SHELL_FILES in sync with what
      // actually exists in the repo.
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle same-origin GET requests - let everything else (the
  // Earth Engine App link, EmailJS CDN script on the contact page, etc.)
  // go straight to the network untouched.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      var networkFetch = fetch(request)
        .then(function (response) {
          // Keep the cache fresh with whatever the network returns, so the
          // next offline visit has the latest version.
          if (response && response.status === 200) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(function () {
          // Offline and not cached: for a page navigation, fall back to
          // the cached home page rather than showing a browser error.
          if (request.mode === 'navigate') {
            return caches.match('index.html');
          }
          return undefined;
        });

      // Cache-first for speed; network still runs in the background to
      // refresh the cache for next time.
      return cached || networkFetch;
    })
  );
});
