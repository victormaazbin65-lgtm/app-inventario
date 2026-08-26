import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeProjectCode, makeProjectFolder, normalizeText, projectSearchScore, sanitizeSegment } from '../studio/app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Studio sanea nombres para carpetas visibles en Windows sin perder significado', () => {
  assert.equal(sanitizeSegment('  Cliente: López / 2026  '), 'Cliente López 2026');
  assert.equal(sanitizeSegment('CON'), '_CON');
  assert.equal(sanitizeSegment('...'), 'SIN_NOMBRE');
  assert.equal(normalizeText('Pachón ÁZUL'), 'pachon azul');
});

test('Studio crea códigos y rutas independientes por cliente, producto y proyecto', () => {
  const date = new Date(2026, 7, 25, 14, 3, 9);
  const code = makeProjectCode(date, 0);
  assert.equal(code, 'PRY-20260825-140309-00');
  const folder = makeProjectFolder({ code, createdAt: '2026-08-25T20:03:09.000Z', design: 'Logo / dorado' });
  assert.match(folder, /^20260825-PRY-20260825-140309-00-Logo dorado$/);
});

test('la búsqueda inteligente pondera cliente, diseño y producto y exige todos los términos', () => {
  const project = { code: 'PRY-1', client: 'Clínica San José', design: 'Logo aniversario dorado', product: 'Pachón', tags: ['urgente'], notes: 'fondo azul', files: [{ name: 'arte-final.cdr' }] };
  assert.ok(projectSearchScore(project, 'clinica') > 0);
  assert.ok(projectSearchScore(project, 'aniversario pachon') > 0);
  assert.ok(projectSearchScore(project, 'arte final') > 0);
  assert.equal(projectSearchScore(project, 'pachon playera'), -1);
  assert.ok(projectSearchScore(project, '', { client: 'san jose', product: 'pachon' }) > 0);
  assert.equal(projectSearchScore(project, '', { product: 'mouse pad' }), -1);
});

test('Studio guarda archivos reales, metadatos recuperables y tiene PWA separada', () => {
  const app = read('studio/app.js');
  const html = read('studio/index.html');
  assert.match(app, /showDirectoryPicker/);
  assert.match(app, /createWritable\(\)/);
  assert.match(app, /proyecto\.json/);
  assert.match(app, /scanMetadata/);
  assert.match(app, /indexedDB\.open/);
  assert.match(html, /\.cdr, \.psd, \.ai, \.svg, \.pdf/);
  assert.match(read('studio/sw.js'), /sublicosturas-studio-v1\.0\.0/);
  assert.deepEqual(JSON.parse(read('studio/manifest.json')).scope, './');
});
