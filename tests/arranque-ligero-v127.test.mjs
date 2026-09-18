import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const html = leer('index.html');
const visual = leer('visual-preferences.js');
const sw = leer('sw.js');
const vendor = leer('vendor-cache-v130.js');
const ops = leer('profesional-operaciones-v130.js');

test('el arranque no carga Chart, XLSX ni el buscador antes del login', () => {
  assert.doesNotMatch(html, /<script[^>]+chart\.js/i);
  assert.doesNotMatch(html, /<script[^>]+xlsx/i);
  assert.doesNotMatch(html, /<script[^>]+buscador\.js/i);
  assert.match(html, /function asegurarChartJS\(\)/);
  assert.match(html, /function asegurarXLSX\(\)/);
  assert.match(html, /import\('\.\/buscador\.js'\)/);
});

test('inventario e historiales empiezan después de que el usuario entra', () => {
  const inicio = html.indexOf('async function cargarDatos()');
  const fin = html.indexOf('function cambiarPestaña', inicio);
  const bloqueLogin = html.slice(inicio, fin);
  assert.match(bloqueLogin, /sistema", "config"/);
  assert.match(bloqueLogin, /sistema', 'branding'/);
  assert.doesNotMatch(bloqueLogin, /collection\(window\.db, "inventario"\)/);
  assert.doesNotMatch(bloqueLogin, /collection\(window\.db, "ventas"\)/);

  assert.match(html, /function activarDatosPostAcceso\(\)/);
  assert.match(html, /function activarSincronizacionNegocio\(\)/);
  assert.match(html, /activarDatosPostAcceso\(\);/);
  assert.match(html, /programarEtapaSincronizacion\(80/);
  assert.match(html, /programarEtapaSincronizacion\(420/);
  assert.match(html, /programarEtapaSincronizacion\(760/);
  assert.match(html, /programarEtapaSincronizacion\(1120/);
  assert.match(html, /programarEtapaSincronizacion\(1500/);
});

test('el respaldo grande local no se parsea antes del acceso', () => {
  const inicio = html.indexOf('async function cargarDatos()');
  const fin = html.indexOf('function cambiarPestaña', inicio);
  assert.doesNotMatch(html.slice(inicio, fin), /cargarDatosLocales\(\)/);
  assert.match(html, /function cargarRespaldoLocalPostAcceso\(\)/);
  assert.match(html, /if\(!datosNegocioCargadosDeLaNube\) cargarRespaldoLocalPostAcceso\(\)/);
});

test('lectura y guardado local ceden el hilo entre bloques grandes', () => {
  assert.match(html, /async function cargarDatosLocales\(\)/);
  assert.match(html, /\(indice \+ 1\) % 3 === 0/);
  assert.match(html, /let secuenciaGuardadoLocal = 0/);
  assert.match(html, /requestIdleCallback\(siguiente/);
});

test('las mejoras se solicitan por evento después del login y se escalonan', () => {
  assert.match(visual, /addEventListener\?\.\('subli:app-activa', cargarMejoras\)/);
  assert.match(visual, /programarCargaLigera/);
  assert.doesNotMatch(visual, /\n\s*cargarMejoras\(\);\s*\n\}\)\(\);/);
  assert.match(visual, /cargarProfesionalV130/);
});

test('Chart.js solo se solicita cuando un gráfico se vuelve visible o se abre', () => {
  assert.match(html, /function prepararChartBajoDemanda\(\)/);
  assert.match(html, /new IntersectionObserver/);
  const v126 = leer('mejoras-v126.js');
  assert.match(v126, /details\.open = false/);
  assert.match(v126, /asegurarChartJS/);
});

test('Excel se mantiene fuera de memoria hasta una exportación', () => {
  assert.match(html, /await asegurarXLSX\(\)/);
  assert.doesNotMatch(vendor, /cargarScript\('subli-xlsx-fijo-v130'/);
  assert.match(ops, /global\.asegurarXLSX/);
});

test('APP_SHELL es ligero y las capas opcionales se cachean en tiempo de uso', () => {
  const entradas = [...sw.matchAll(/^\s*'\.\/([^']+)'/gm)].map(m => m[1]).filter(Boolean);
  for (const pesado of ['mejoras-v126.js','mejoras-v127.js','mejoras-v128.js','profesional-ui-v130.js','profesional-operaciones-v130.js','buscador.js']) {
    assert.ok(!entradas.includes(pesado), pesado + ' no debe precargarse');
  }
  for (const nucleo of ['index.html','visual-preferences.js','negocio-core.js','gestion-negocio.js','finanzas-negocio.js']) {
    assert.ok(entradas.includes(nucleo), nucleo + ' debe estar en el núcleo');
  }
  assert.match(sw, /return cacheada \|\| actualizacion/);
  assert.match(sw, /sublicosturas-v1\.2\.8-eventos-20260918-1/);
});

test('la versión 1.2.8 está coordinada en aplicación y paquete', () => {
  assert.match(html, /const APP_VERSION = "1\.2\.8"/);
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.2.8' });
  assert.equal(JSON.parse(leer('package.json')).version, '1.2.8');
  assert.equal(JSON.parse(leer('build-info.json')).basePublica, '1.2.8');
});
