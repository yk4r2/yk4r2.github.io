self.addEventListener('fetch', event => {
  // Only handle HTTP(S) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(response => {
        const responseToCache = response.clone();
        
        caches.open('v1').then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});

