/**
 * Service worker — lets the NDR Control Tower launch with zero internet
 * after the first successful visit.
 *
 * IMPORTANT CHANGE (v2): this used to be cache-first (serve the cached
 * copy instantly, refresh the cache quietly in the background for NEXT
 * time). That caused a real problem: whenever the app was updated, some
 * devices kept showing an old, stale, possibly-buggy cached copy for a
 * long time instead of the fix, with no obvious sign anything was wrong.
 *
 * Now it's NETWORK-FIRST: whenever there's a connection, it always tries
 * to fetch the live version first and only falls back to the cached copy
 * if the network request fails (i.e. you're genuinely offline). This
 * guarantees you get the latest version whenever you have internet, while
 * still keeping the "launch with zero internet" ability intact.
 *
 * It deliberately does NOT touch requests to the Apps Script API
 * (script.google.com) — those are handled by the app's own offline queue
 * in index.html, which is a better fit for read/write data than a
 * service-worker cache would be.
 */
const CACHE_NAME = 'ndr-tower-v2';
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
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
