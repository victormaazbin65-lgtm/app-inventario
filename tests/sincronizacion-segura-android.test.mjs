import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const html = leer('index.html');
const sw = leer('sw.js');

test('los snapshots guardan solo el grupo que cambió', () => {
  assert.match(html, /const GUARDADO_LOCAL = \{/);
  assert.match(html, /function guardarDatosParcial\(\.\.\.grupos\)/);
  assert.match(html, /programarGuardadoSnapshot\('inventario', 'inventario'\)/);
  assert.match(html, /programarGuardadoSnapshot\('ventas', 'ventas'\)/);
  assert.match(html, /programarGuardadoSnapshot\('config', 'fondos', 'codigos', 'negocio', 'saldos'\)/);
  assert.doesNotMatch(html, /debouncedEjecucion\('guardar_snapshot', guardarDatos, 500\)/);
});

test('una caché vacía no reemplaza respaldos locales válidos', () => {
  assert.match(html, /if\(datos\.length === 0 && snap\.metadata\.fromCache\) return;/);
  assert.match(html, /if\(pendientes\.length === 0 && snap\.metadata\.fromCache && ventasCreditoPendiente\.length > 0\) return;/);
  assert.match(html, /if\(temp\.length === 0 && snap\.metadata\.fromCache && resumenMensualNube\.length > 0\) return;/);
});

test('la sincronización se reparte en el tiempo y agrupa renders', () => {
  assert.match(html, /function programarEscuchaFirebase\(tarea, retraso = 0\)/);
  assert.match(html, /escucharColeccionNegocio\('clientes'.*2600\)/);
  assert.match(html, /escucharColeccionNegocio\('perdidas_inventario'.*4600\)/);
  assert.match(html, /function programarActualizacionSincronizacion\(\)/);
  assert.match(html, /debouncedEjecucion\('render_sincronizacion', actualizarUI, 850\)/);
});

test('el análisis ampliado no compite con el arranque inmediato', () => {
  assert.match(html, /cargarVentasAnalisisUltimos30Dias/);
  assert.match(html, /requestIdleCallback\(cargar, \{ timeout: 5000 \}\)/);
  assert.match(html, /\}, 12000\);/);
});

test('las transacciones financieras siguen requiriendo servidor y no se convirtieron en cola offline', () => {
  assert.match(html, /Para evitar ventas duplicadas o stock negativo, finalizar una venta requiere conexión/);
  assert.match(html, /window\.runTransaction\(window\.db/);
  assert.doesNotMatch(html, /localStorage\.clear\(\)|indexedDB\.deleteDatabase/);
});

test('la PWA usa una caché nueva sin cambiar la versión funcional', () => {
  assert.match(sw, /sublicosturas-v1\.2\.5-sync-segura-20260918/);
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.2.5' });
  assert.equal(JSON.parse(leer('package.json')).version, '1.2.5');
});
