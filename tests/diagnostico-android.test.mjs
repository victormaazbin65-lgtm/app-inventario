import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const pagina = fs.readFileSync(path.join(raiz, 'diagnostico.html'), 'utf8');
const bootstrap = html.match(/<script>\s*\(function \(\) \{[\s\S]*?<\/script>/)?.[0];
assert.ok(bootstrap, 'falta el arranque opcional del diagnóstico');
const codigo = bootstrap.replace(/^<script>/, '').replace(/<\/script>$/, '');

function entorno(search) {
  const accesos = [];
  const datos = new Map();
  const ventana = {};
  const contexto = {
    URLSearchParams, Date, Math, JSON,
    location: { search },
    window: ventana,
    performance: { now: () => 10 },
    localStorage: {
      getItem: clave => { accesos.push('leer:' + clave); return datos.get(clave) || null; },
      setItem: (clave, valor) => { accesos.push('guardar:' + clave); datos.set(clave, valor); }
    },
    PerformanceObserver: class { observe() {} }
  };
  vm.runInNewContext(codigo, contexto);
  return { ventana, accesos, datos };
}

test('la apertura normal no registra ni lee el diagnóstico', () => {
  const { ventana, accesos } = entorno('');
  assert.equal(ventana.subliMarcar, undefined);
  assert.deepEqual(accesos, []);
});

test('el diagnóstico registra etapas sin valores del negocio', () => {
  const { ventana, datos } = entorno('?diagnostico=1&cache=memoria');
  ventana.subliMarcar('prueba', { duracion: 12 });
  const traza = JSON.parse(datos.get('subli_diag_traza_v1'));
  assert.equal(traza[0].paso, 'documento');
  assert.equal(traza[0].cache, 'memoria');
  assert.equal(traza[1].paso, 'prueba');
  assert.equal(traza[1].duracion, 12);
  assert.equal(datos.size, 1);
});

test('la comparación de caché solo se activa durante el diagnóstico', () => {
  assert.match(html, /parametrosDiagnostico\.get\('diagnostico'\) === '1' && parametrosDiagnostico\.get\('cache'\) === 'memoria'/);
  assert.match(html, /memoryLocalCache\(\)/);
  assert.match(html, /persistentLocalCache\(\{tabManager: persistentMultipleTabManager\(\)\}\)/);
  assert.match(pagina, /index\.html/);
  assert.doesNotMatch(pagina, /firebasejs|subli_inv_v10|subli_vent_v10|localStorage\.clear\(\)/);
});
