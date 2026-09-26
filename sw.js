const CACHE_NAME = 'sublicosturas-v1.2.5-estabilidad-android-20260926';
const APP_SHELL = [
  './index.html',
  './diagnostico.html',
  './visual-preferences.js',
  './build-info.json',
  './negocio-core.js',
  './gestion-negocio.js',
  './finanzas-negocio.js',
  './respaldo-negocio.js',
  './manifest.json',
  './logo-192.png',
  './logo-512.png',
  './apple-touch-icon.png'
];

const VENDOR_URLS = new Set([
  'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
]);

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
  if(url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if(request.mode === 'navigate') {
    const rutaInicio = new URL('./index.html', self.location.href).pathname;
    const rutaRaiz = new URL('./', self.location.href).pathname;
    const rutaAnterior = new URL('./SUBLI.html', self.location.href).pathname;
    const rutaDiagnostico = new URL('./diagnostico.html', self.location.href).pathname;
    const esEntradaApp = [rutaInicio, rutaRaiz, rutaAnterior].includes(url.pathname);
    event.respondWith(
      fetch(request)
        // La copia de index.html ya se instala junto con sus módulos. Una página
        // auxiliar jamás debe sobrescribir la entrada de la aplicación.
        .catch(() => esEntradaApp ? caches.match('./index.html')
          : url.pathname === rutaDiagnostico ? caches.match('./diagnostico.html')
          : caches.match(request))
    );
    return;
  }

  // Dependencias externas fijadas: no hacen fallar la instalación de la PWA,
  // pero una vez descargadas quedan disponibles para usos posteriores sin red.
  if(VENDOR_URLS.has(url.href)) {
    event.respondWith(
      caches.match(request).then(cacheada => {
        if(cacheada) return cacheada;
        return fetch(request).then(response => {
          if(response && (response.ok || response.type === 'opaque')) {
            const copia = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copia));
          }
          return response;
        }).catch(() => cacheada || Response.error());
      })
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
      }).catch(() => cacheada || Response.error());
      return cacheada || actualizacion;
    })
  );
});
