import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const archivosRuntime = [
  'index.html',
  'asistente-ajustes-v127.js','asistente-ajustes-v128.js','asistente-ajustes-v130.js',
  'asistente-core.js','buscador.js','finanzas-negocio.js','gestion-negocio.js',
  'mejoras-core.js','mejoras-v126.js','mejoras-v127.js','mejoras-v128.js',
  'negocio-core.js','profesional-compat-v130.js','profesional-core-ajustes-v130.js',
  'profesional-core-v130.js','profesional-operaciones-v130.js','profesional-ui-v130.js',
  'respaldo-negocio.js','vendor-cache-v130.js','visual-preferences.js'
];

test('no quedan temporizadores periódicos en el runtime', () => {
  for(const archivo of archivosRuntime) {
    assert.doesNotMatch(leer(archivo), /setInterval\s*\(/, archivo + ' no debe usar setInterval');
  }
});

test('actualizarUI emite un evento solamente cuando procesa un cambio', () => {
  const html = leer('index.html');
  assert.match(html, /function actualizarUI\(\)/);
  assert.match(html, /debouncedEjecucion\('render_global'/);
  assert.match(html, /dispatchEvent\(new Event\('subli:ui-actualizada'\)\)/);
});

test('las capas profesionales escuchan cambios reales en lugar de sondear por tiempo', () => {
  const ui = leer('profesional-ui-v130.js');
  const ops = leer('profesional-operaciones-v130.js');
  assert.match(ui, /addEventListener\('subli:ui-actualizada', refrescar\)/);
  assert.match(ops, /addEventListener\('subli:ui-actualizada',refrescar\)/);
  assert.match(ui, /addEventListener\('input', programarCapturaBorrador\)/);
  assert.match(ui, /addEventListener\('change', programarCapturaBorrador\)/);
});

test('los setTimeout restantes son diferidos por evento, no ciclos automáticos', () => {
  const ui = leer('profesional-ui-v130.js');
  const ops = leer('profesional-operaciones-v130.js');
  assert.match(ui, /setTimeout\(capturarBorradoresSeguro, 900\)/);
  assert.match(ui, /focusout/);
  assert.match(ops, /focusout.*setTimeout\(refrescar,180\)/);
});

test('la versión 1.2.8 fuerza caché nueva sin borrar datos', () => {
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.2.8' });
  assert.equal(JSON.parse(leer('package.json')).version, '1.2.8');
  assert.match(leer('sw.js'), /sublicosturas-v1\.2\.8-eventos-20260918-1/);
  assert.doesNotMatch(leer('sw.js'), /localStorage\.clear|indexedDB\.deleteDatabase/);
});
