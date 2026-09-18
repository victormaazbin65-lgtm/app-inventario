import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const v126 = leer('mejoras-v126.js');
const ui = leer('profesional-ui-v130.js');
const ops = leer('profesional-operaciones-v130.js');
const sw = leer('sw.js');

test('v1.2.7 no ejecuta los paneles pesados sin respetar el debounce y la pestaña activa', () => {
  assert.match(v126, /function programarActualizacionV126\(\)/);
  assert.match(v126, /if\(pestañaActivaV126\('inicio'\)\)/);
  assert.match(v126, /pestañaActivaV126\('alertas'\).*v126-catalogo-surtido.*open/);

  const inicio = v126.indexOf('function envolverActualizacionUI');
  const fin = v126.indexOf('function instalarRefrescoPestanas', inicio);
  const bloque = v126.slice(inicio, fin);
  assert.match(bloque, /programarActualizacionV126\(\)/);
  assert.doesNotMatch(bloque, /renderResumenRango\(\)/);
  assert.doesNotMatch(bloque, /renderCatalogoSurtido\(\)/);
});

test('el catálogo de surtido oculto no construye cientos de filas durante el arranque', () => {
  const inicio = v126.indexOf('function renderCatalogoSurtido');
  const fin = v126.indexOf('function inyectarCodigoIngreso', inicio);
  const bloque = v126.slice(inicio, fin);
  assert.match(bloque, /!pestañaActivaV126\('alertas'\)/);
  assert.match(bloque, /v126-catalogo-surtido.*open/);
  assert.match(v126, /pestañaActivaV126\('alertas'\).*v126-catalogo-surtido.*open/);
});

test('el gráfico financiero no se destruye y recrea si sus datos no cambiaron', () => {
  assert.match(v126, /let firmaGraficoResumen = ''/);
  assert.match(v126, /firmaNueva === firmaGraficoResumen/);
  assert.match(v126, /if\(graficoResumen\) graficoResumen\.destroy\(\)/);
});

test('las capas profesionales solo actualizan trabajo pesado de la pestaña visible', () => {
  assert.match(ui, /function pestañaActivaProfesional\(nombre\)/);
  assert.match(ui, /if\(pestañaActivaProfesional\('inventario'\)\)/);
  assert.match(ui, /if\(pestañaActivaProfesional\('ajustes'\)\)/);
  assert.match(ui, /setInterval\(refrescar, 10000\)/);
  assert.match(ops, /function pestañaActivaOperaciones\(nombre\)/);
  assert.match(ops, /if\(pestañaActivaOperaciones\('alertas'\)\)/);
  assert.match(ops, /if\(pestañaActivaOperaciones\('inventario'\)\)/);
  assert.match(ops, /setInterval\(refrescar,12000\)/);
});

test('la PWA obliga a descargar este hotfix sin borrar datos del negocio', () => {
  assert.match(sw, /sublicosturas-v1\.2\.7-ligera-20260918-1/);
  assert.match(sw, /names\.filter\(name => name\.startsWith\('sublicosturas-v'\)/);
});
