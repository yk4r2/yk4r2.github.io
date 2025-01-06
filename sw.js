self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(response => {
        // Clone the response
        const responseToCache = response.clone();
        
        caches.open('v1').then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});

