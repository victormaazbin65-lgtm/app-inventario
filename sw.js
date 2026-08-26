const CACHE_NAME = 'sublicosturas-v1.1.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './logo.jpeg',
  './logo-192.png',
  './logo-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name.startsWith('sublicosturas-v') && name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;

  const url = new URL(request.url);
  // Studio tiene su propio shell y service worker; el inventario no debe
  // responder con index.html cuando se navega dentro de /studio/.
  if(url.pathname.includes('/studio/')) return;
  if(url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if(request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copia = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copia));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if(url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cacheada => {
      const actualizacion = fetch(request).then(response => {
        if(response && response.ok) {
          const copia = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copia));
        }
        return response;
      });
      return cacheada || actualizacion;
    })
  );
});
