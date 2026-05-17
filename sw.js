const CACHE_NAME = 'sublicosturas-v1';
const urlsToCache = [
  './',
  './index.html',
  './logo.png' // Asegúrate de que el nombre aquí también coincida con tu logo
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
