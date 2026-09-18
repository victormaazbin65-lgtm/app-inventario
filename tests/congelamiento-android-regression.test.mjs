import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');

test('el arranque limita historiales locales para evitar bloquear Android', () => {
  assert.match(html, /const MAX_HISTORIAL_LOCAL = 80/);
  assert.match(html, /const MAX_TAMANO_CACHE_HISTORIAL = 900000/);
  assert.match(html, /ventas = historialLocalReciente\(valor\)/);
  assert.match(html, /KEY_INGRESOS, valor => historialIngresos = historialLocalReciente\(valor\)/);
  assert.match(html, /localStorage\.removeItem\(clave\)/);
  assert.match(html, /JSON\.stringify\(historialLocalReciente\(ventas\)\)/);
  assert.match(html, /JSON\.stringify\(historialLocalReciente\(historialIngresos\)\)/);
});

test('el render global no reconstruye pestañas pesadas que están ocultas', () => {
  assert.match(html, /function pestañaActiva\(nombre\)/);
  assert.match(html, /if\(pestañaActiva\('inventario'\)\) renderInventario\(\)/);
  assert.match(html, /if\(pestañaActiva\('inicio'\)\) renderResumenMensual\(\)/);
  assert.match(html, /if\(pestañaActiva\('caja'\)\) renderHistorialRetiros\(\)/);
  assert.match(html, /if\(pestañaActiva\('ventas'\)\)/);
  assert.match(html, /if\(pestañaActiva\('cotizacion'\)\) renderHistorialCotizaciones\(\)/);
  assert.match(html, /if\(pestañaActiva\('ingreso'\)\) renderHistorialIngresos\(\)/);
  assert.match(html, /if\(pestaña === 'ventas'\) actualizarUI\(\)/);
});

test('el gráfico de ventas no se destruye y recrea cuando sus datos no cambiaron', () => {
  assert.match(html, /let firmaGraficoVentas = ''/);
  assert.match(html, /firmaNueva === firmaGraficoVentas/);
  assert.match(html, /document\.visibilityState === 'hidden'/);
  assert.match(html, /if\(chartVentas\) chartVentas\.destroy\(\)/);
});

test('la corrección conserva la lógica SAT existente en ventas', () => {
  assert.match(html, /document\.getElementById\('venta-factura'\)\.checked/);
  assert.match(html, /impuestoSAT/);
});
