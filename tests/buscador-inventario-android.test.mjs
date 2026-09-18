import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

test('el buscador de inventario usa debounce y limita resultados masivos', () => {
  const html = leer('index.html');
  assert.match(html, /oninput="programarBusquedaInventario\(\)"/);
  assert.match(html, /const MAX_RESULTADOS_BUSQUEDA_INV = 80/);
  assert.match(html, /setTimeout\(\(\) => \{/);
  assert.match(html, /}, 220\);/);
  assert.match(html, /invFiltrado = invFiltrado\.slice\(0, MAX_RESULTADOS_BUSQUEDA_INV\)/);
});

test('los refrescos profesionales ocurren por cambios y no por temporizadores periódicos', () => {
  const ui = leer('profesional-ui-v130.js');
  const ops = leer('profesional-operaciones-v130.js');
  assert.match(ui, /function campoEdicionActivo\(\)/);
  assert.match(ui, /subli:ui-actualizada/);
  assert.match(ui, /document\.addEventListener\('input', programarCapturaBorrador\)/);
  assert.match(ui, /document\.addEventListener\('change', programarCapturaBorrador\)/);
  assert.doesNotMatch(ui, /setInterval\(/);
  assert.match(ops, /function campoEdicionActivo\(\)/);
  assert.match(ops, /subli:ui-actualizada/);
  assert.doesNotMatch(ops, /setInterval\(/);
});

test('esta corrección no toca archivos de lógica de negocio', () => {
  assert.ok(fs.existsSync(path.join(raiz, 'negocio-core.js')));
  assert.ok(fs.existsSync(path.join(raiz, 'finanzas-negocio.js')));
});
