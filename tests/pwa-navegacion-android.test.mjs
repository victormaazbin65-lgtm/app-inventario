import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const origen = 'https://ejemplo.test/app-inventario/';

function simularServiceWorker() {
  const eventos = new Map();
  const archivos = new Map();
  let conectado = true;
  let solicitudes = 0;
  const urlArchivo = ruta => new URL(ruta, origen).href;
  const respuesta = texto => ({ texto, ok: true, headers: { get: () => 'text/html' }, clone() { return respuesta(texto); } });
  const cache = {
    async addAll(rutas) { rutas.forEach(ruta => archivos.set(urlArchivo(ruta), respuesta(ruta))); },
    async put(ruta, valor) { archivos.set(typeof ruta === 'string' ? urlArchivo(ruta) : ruta.url, valor); }
  };
  const caches = {
    open: async () => cache,
    match: async ruta => archivos.get(typeof ruta === 'string' ? urlArchivo(ruta) : ruta.url)
  };
  const entorno = {
    URL, caches,
    self: { location: { origin: new URL(origen).origin, href: urlArchivo('sw.js') }, skipWaiting: () => {}, addEventListener: (tipo, fn) => eventos.set(tipo, fn) },
    fetch: async solicitud => {
      solicitudes++;
      if(!conectado) throw new Error('sin conexión');
      return respuesta(solicitud.url.endsWith('/diagnostico.html') ? 'DIAGNOSTICO' : 'APP');
    }
  };
  vm.runInNewContext(sw, entorno);
  const instalar = async () => {
    let promesa;
    eventos.get('install')({ waitUntil: valor => { promesa = valor; } });
    await promesa;
  };
  const navegar = async ruta => {
    const solicitud = { url: urlArchivo(ruta), method: 'GET', mode: 'navigate' };
    let promesa;
    eventos.get('fetch')({ request: solicitud, respondWith: valor => { promesa = valor; } });
    return promesa;
  };
  return { instalar, navegar, desconectar: () => { conectado = false; }, archivos, solicitudes: () => solicitudes };
}

test('visitar diagnóstico conserva la entrada offline de la app y permite volver al reporte offline', async () => {
  const sitio = simularServiceWorker();
  await sitio.instalar();
  assert.equal((await sitio.navegar('diagnostico.html')).texto, 'DIAGNOSTICO');
  sitio.desconectar();
  assert.equal((await sitio.navegar('index.html')).texto, './index.html');
  assert.equal((await sitio.navegar('./')).texto, './index.html');
  assert.equal((await sitio.navegar('SUBLI.html')).texto, './index.html');
  assert.equal((await sitio.navegar('diagnostico.html')).texto, './diagnostico.html');
  assert.equal(sitio.archivos.get(new URL('index.html', origen).href).texto, './index.html');
});
