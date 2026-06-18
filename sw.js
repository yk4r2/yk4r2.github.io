// yk4r2 — network-first service worker.
// Cache-first (the old behaviour) served stale CSS forever, which made the
// site look half-restyled. We now go to the network first and only fall back
// to cache when offline. Bumping CACHE drops every old cached response.
const CACHE = 'yk4r2-v3';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http') || event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
