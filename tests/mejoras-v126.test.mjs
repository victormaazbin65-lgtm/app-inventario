import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const coreSource = leer('mejoras-core.js');
const uiSource = leer('mejoras-v126.js');
const bootstrap = leer('visual-preferences.js');
const sw = leer('sw.js');

const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error, JSON });
vm.runInContext(coreSource, contexto);
const core = contexto.SubliMejorasCore;

test('el catálogo por proveedor muestra agotados, bajos y productos con buena existencia', () => {
  const productos = [
    { id:'a', nombre:'Taza', stock:0, min:5, proveedor:'Empresa Uno', codigoInventario:1001 },
    { id:'b', nombre:'Playera', stock:3, min:5, proveedor:'Empresa Uno', codigoInventario:1002 },
    { id:'c', nombre:'Vinil', stock:20, min:5, proveedor:'Empresa Uno', codigoInventario:1003 },
    { id:'d', nombre:'Diseño', stock:0, min:0, proveedor:'Empresa Uno', isService:true }
  ];
  const todos = core.catalogoProveedor(productos, { proveedor:'EMPRESA UNO' });
  assert.equal(todos.length, 3);
  assert.deepEqual(todos.map(p => p.estadoStock), ['agotado','bajo','bien']);
  const pendientes = core.catalogoProveedor(productos, { proveedor:'EMPRESA UNO', soloPendientes:true });
  assert.equal(pendientes.length, 2);
});

test('las alertas de préstamos distinguen vencidos, hoy y próximos', () => {
  const ahora = new Date(2026, 8, 7, 12, 0, 0).getTime();
  const alertas = core.alertasPrestamos([
    { id:'v', persona:'A', saldoPendiente:100, vencimiento:'2026-09-05', estado:'pendiente' },
    { id:'h', persona:'B', saldoPendiente:80, vencimiento:'2026-09-07', estado:'pendiente' },
    { id:'p', persona:'C', saldoPendiente:50, vencimiento:'2026-09-09', estado:'pendiente' },
    { id:'ok', persona:'D', saldoPendiente:0, vencimiento:'2026-09-01', estado:'pagado' }
  ], ahora, 3);
  assert.deepEqual(alertas.map(a => a.estadoAlerta), ['vencido','hoy','proximo']);
  assert.equal(alertas[0].diasParaVencer, -2);
});

test('el resumen por rango conserva ventas, costos, producción, SAT y utilidad por día', () => {
  const d1 = new Date(2026, 8, 6, 10).getTime();
  const d2 = new Date(2026, 8, 7, 11).getTime();
  const inicio = core.inicioDiaLocal(d1);
  const fin = core.finDiaLocal(d2);
  const resumen = core.resumenVentasRango([
    { id:'1', timestamp:d1, ingresoTotal:100, montoCobradoTotal:80, costosProductos:30, costoTinta:5, costoManoObra:10, costoEnvio:5, impuestoSAT:5, ganancia:45 },
    { id:'2', timestamp:d2, ingresoTotal:200, montoCobradoTotal:200, costosProductos:80, costoTinta:10, costoManoObra:20, costoEnvio:10, impuestoSAT:10, ganancia:70 },
    { id:'x', timestamp:d2, ingresoTotal:999, anulada:true }
  ], inicio, fin);
  assert.equal(resumen.ventas, 300);
  assert.equal(resumen.cobrado, 280);
  assert.equal(resumen.costoProductos, 110);
  assert.equal(resumen.produccion, 60);
  assert.equal(resumen.sat, 15);
  assert.equal(resumen.utilidad, 115);
  assert.equal(resumen.operaciones, 2);
  assert.equal(resumen.dias.length, 2);
});

test('el código opcional rechaza duplicados y números reservados de bloque', () => {
  assert.equal(core.validarCodigoManual(1001, [2001, 3001]), 1001);
  assert.throws(() => core.validarCodigoManual(1001, [1001]), /ocupado/);
  assert.throws(() => core.validarCodigoManual(2000, []), /bloque/);
  assert.throws(() => core.validarCodigoManual(1.5, []), /entero/);
});

test('los dueños siempre ven finanzas y los empleados dependen del permiso explícito', () => {
  assert.equal(core.puedeVerFinanzas({ rol:'dueno', permisos:{} }), true);
  assert.equal(core.puedeVerFinanzas({ rol:'empleado', permisos:{ verFinanzas:true } }), true);
  assert.equal(core.puedeVerFinanzas({ rol:'empleado', permisos:{ verFinanzas:false } }), false);
});

test('la mejora reutiliza préstamos, reserva transaccional, trazabilidad y permisos sin duplicar la contabilidad', () => {
  assert.match(uiSource, /registrarPrestamo/);
  assert.match(uiSource, /reservarCodigoInventarioEnTransaccion/);
  assert.match(uiSource, /creadoPorNombre/);
  assert.match(uiSource, /verFinanzas/);
  assert.match(uiSource, /v126-resumen-financiero/);
  assert.match(uiSource, /v126-catalogo-surtido/);
  assert.doesNotMatch(coreSource, /setDoc|updateDoc|runTransaction|Firebase/);
});

test('la PWA carga y cachea los módulos de mejora sin cambiar la versión contable vigente', () => {
  assert.match(bootstrap, /mejoras-core\.js/);
  assert.match(bootstrap, /mejoras-v126\.js/);
  assert.match(sw, /'\.\/mejoras-core\.js'/);
  assert.match(sw, /'\.\/mejoras-v126\.js'/);
  assert.match(sw, /sublicosturas-v1\.2\.5/);
});
