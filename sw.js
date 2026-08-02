/**
 * Service worker — this is what lets the NDR Control Tower launch with
 * zero internet after the first successful visit. It caches the app shell
 * (HTML/CSS/JS/manifest/icons) and serves it from cache first, updating
 * the cache in the background whenever the network is available.
 *
 * It deliberately does NOT touch requests to the Apps Script API
 * (script.google.com) — those are handled by the app's own offline queue
 * in index.html, which is a better fit for read/write data than a
 * cache-first service worker would be.
 */
const CACHE_NAME = 'ndr-tower-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests for the app shell.
  // API calls to script.google.com pass through untouched.
  if (req.method !== 'GET' || req.url.indexOf('script.google.com') !== -1) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
