const RELEASE = '1.4.0';
const CACHE_NAME = 'sublicosturas-v1.4.0-integridad-20261006';
const ASSET_BASE = `./assets/${RELEASE}/`;
const APP_SHELL = [
  './index.html',
  './diagnostico.html',
  `${ASSET_BASE}visual-preferences.js`,
  './build-info.json',
  `${ASSET_BASE}negocio-core.js`,
  `${ASSET_BASE}integridad-firebase.js`,
  `${ASSET_BASE}gestion-negocio.js`,
  `${ASSET_BASE}finanzas-negocio.js`,
  `${ASSET_BASE}respaldo-negocio.js`,
  './manifest.json',
  './logo-192.png',
  './logo-512.png',
  './apple-touch-icon.png'
];

// Descargar no ejecuta los módulos opcionales: el arranque continúa diferido.
const OPTIONAL_ASSETS = [
  'mejoras-core.js', 'mejoras-v126.js', 'mejoras-v127.js', 'mejoras-v128.js',
  'asistente-core.js', 'asistente-ajustes-v127.js', 'asistente-ajustes-v128.js', 'asistente-ajustes-v130.js',
  'profesional-core-v130.js', 'profesional-core-ajustes-v130.js', 'profesional-ui-v130.js',
  'profesional-operaciones-v130.js', 'profesional-compat-v130.js', 'pantallas-v131.js',
  'vendor-cache-v130.js', 'buscador.js'
].map(file => ASSET_BASE + file);

const VENDOR_URLS = new Set([
  'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([...APP_SHELL, ...OPTIONAL_ASSETS]))
  );
});

self.addEventListener('message', event => {
  if(event.data?.tipo === 'ACTIVAR_VERSION') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(paginas => paginas.length ? [] : caches.keys())
      .then(names => Promise.all(names.filter(name => name.startsWith('sublicosturas-v') && name !== CACHE_NAME).map(name => caches.delete(name))))
      // El controlador nuevo solo se activa automáticamente al cerrar las páginas antiguas.
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
        .catch(() => caches.open(CACHE_NAME).then(cache => esEntradaApp ? cache.match('./index.html')
          : url.pathname === rutaDiagnostico ? cache.match('./diagnostico.html')
          : cache.match(request)))
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
            event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copia)));
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
      if(url.pathname.includes('/assets/') && cacheada) return cacheada;
      const actualizacion = fetch(request).then(response => {
        if(response && response.ok) {
          const copia = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copia)));
        }
        return response;
      }).catch(() => cacheada || Response.error());
      // Una URL inmutable de entrega conserva su conjunto incluso después de publicar otra.
      return actualizacion;
    })
  );
});
