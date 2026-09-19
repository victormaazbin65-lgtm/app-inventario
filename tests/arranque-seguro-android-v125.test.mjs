import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const html = leer('index.html');
const visual = leer('visual-preferences.js');
const vendor = leer('vendor-cache-v130.js');
const sw = leer('sw.js');
const ops = leer('profesional-operaciones-v130.js');

test('Chart y XLSX ya no bloquean el arranque', () => {
  assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*chart\.js/i);
  assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*xlsx[^"']*\.js/i);
  assert.match(html, /function asegurarChartJS\(/);
  assert.match(html, /function asegurarXLSX\(/);
  assert.match(vendor, /function cargarChart\(/);
  assert.match(vendor, /function cargarXLSX\(/);
  assert.match(vendor, /function instalar\(\) \{\s*return true;/);
});

test('los módulos profesionales esperan hasta después del acceso', () => {
  assert.match(visual, /subli:app-activa/);
  assert.match(visual, /MODULOS_DIFERIDOS/);
  assert.match(visual, /await cargarScriptPromesa/);
  assert.doesNotMatch(visual, /\bcargarMejoras\(\);\s*\}\)\(\);/);
  assert.match(html, /function notificarAplicacionActiva\(/);
  assert.match(html, /notificarAplicacionActiva\(\);/);
});

test('buscador se importa solo al abrir su pestaña', () => {
  assert.doesNotMatch(html, /<script type=["']module["'] src=["']\.\/buscador\.js["']/);
  assert.match(html, /import\('\.\/buscador\.js'\)/);
  assert.match(html, /if\(pestaña === 'buscador'\)/);
});

test('la app no construye listas grandes mientras el login está visible', () => {
  assert.match(html, /if\(!appPrincipal \|\| appPrincipal\.style\.display === 'none'\) return;/);
  assert.match(html, /tab-inventario.*contains\('active'\).*renderInventario/s);
  assert.match(html, /tab-ventas.*contains\('active'\)/);
  assert.match(html, /if\(pestaña === 'ventas'\) actualizarUI\(\)/);
});

test('Excel profesional conserva fallback y carga bajo demanda', () => {
  assert.match(ops, /typeof global\.asegurarXLSX==='function'/);
  assert.match(ops, /await global\.asegurarXLSX\(\)/);
  assert.match(ops, /se exportará CSV/);
});

test('la PWA precarga solo archivos esenciales y mantiene vendors cacheables bajo demanda', () => {
  assert.match(sw, /sublicosturas-v1\.2\.5-arranque-seguro-20260918/);
  assert.doesNotMatch(sw.match(/const APP_SHELL = \[[\s\S]*?\];/)?.[0] || '', /mejoras-v128|profesional-ui-v130|buscador\.js/);
  assert.match(sw, /VENDOR_URLS/);
  assert.match(sw, /chart\.js@4\.5\.1/);
  assert.match(sw, /xlsx\/0\.18\.5/);
});

test('no se borran datos locales ni bases durante el arranque seguro', () => {
  const fuentes = [html, visual, vendor, sw, ops].join('\n');
  assert.doesNotMatch(fuentes, /localStorage\.clear\(\)/);
  assert.doesNotMatch(fuentes, /indexedDB\.deleteDatabase\(/);
});
