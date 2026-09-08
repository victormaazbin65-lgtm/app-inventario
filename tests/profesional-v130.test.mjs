import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const negocioSrc = leer('negocio-core.js');
const coreSrc = leer('profesional-core-v130.js');
const ui = leer('profesional-ui-v130.js');
const ops = leer('profesional-operaciones-v130.js');
const assistant = leer('asistente-ajustes-v130.js');
const compat = leer('profesional-compat-v130.js');
const vendor = leer('vendor-cache-v130.js');
const visual = leer('visual-preferences.js');
const sw = leer('sw.js');
const respaldo = leer('respaldo-negocio.js');
const build = JSON.parse(leer('build-info.json'));

function crearCore() {
  const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error, JSON });
  vm.runInContext(negocioSrc, contexto);
  vm.runInContext(coreSrc, contexto);
  return contexto.SubliProfesionalCore;
}

const core = crearCore();

test('el buscador global encuentra acciones y respeta visibilidad financiera', () => {
  const venta = core.buscarAcciones('hacer una venta', { rol:'empleado', puedeFinanzas:false });
  assert.equal(venta[0].id, 'venta');
  const empleado = core.buscarAcciones('', { rol:'empleado', puedeFinanzas:false });
  assert.equal(empleado.some(x => x.id === 'caja' || x.id === 'prestamo' || x.id === 'cierre'), false);
  const dueno = core.buscarAcciones('cierre diario', { rol:'dueno', puedeFinanzas:true });
  assert.equal(dueno[0].id, 'cierre');
});

test('la agenda de cobros mantiene crédito y préstamo separados y prioriza vencidos', () => {
  const hoy = new Date(2026, 8, 7, 12).getTime();
  const ventas = [
    { id:'v1', timestamp:hoy - 1000, clienteNombre:'Ana', ingresoTotal:100, montoCobradoTotal:40, vencimiento:'2026-09-06' },
    { id:'v2', timestamp:hoy, clienteNombre:'Luis', ingresoTotal:50, montoCobradoTotal:50 }
  ];
  const prestamos = [{ id:'p1', timestamp:hoy, persona:'Carlos', motivo:'Compra', saldoPendiente:25, vencimiento:'2026-09-08' }];
  const filas = core.agendaCobros(ventas, prestamos, hoy);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].tipo, 'credito');
  assert.equal(filas[0].saldo, 60);
  assert.equal(filas[0].dias, -1);
  assert.equal(filas[1].tipo, 'prestamo');
  assert.equal(filas[1].saldo, 25);
});

test('salud y prioridades del negocio no inventan dinero', () => {
  const ahora = new Date(2026, 8, 7, 12).getTime();
  const salud = core.resumenSalud({
    ahora,
    inventario:[
      { id:'1', stock:0, min:2, costo:10 },
      { id:'2', stock:2, min:2, costo:5 },
      { id:'3', stock:8, min:2, costo:3 }
    ],
    ventas:[{ id:'v', timestamp:ahora, ingresoTotal:100, montoCobradoTotal:70, ganancia:20 }],
    prestamos:[{ id:'p', saldoPendiente:15, vencimiento:'2026-09-06' }]
  });
  assert.equal(salud.agotados, 1);
  assert.equal(salud.bajos, 1);
  assert.equal(salud.valorInventario, 34);
  assert.equal(salud.ventasHoy, 100);
  assert.equal(salud.utilidadHoy, 20);
  assert.equal(salud.porCobrar, 45);
  assert.equal(salud.vencidos, 1);
  const prioridades = core.prioridadesNegocio({
    ahora,
    inventario:[{ id:'1', stock:0, min:2, costo:10 }],
    ventas:[],
    prestamos:[{ id:'p', saldoPendiente:15, vencimiento:'2026-09-06' }]
  });
  assert.equal(prioridades[0].nivel, 'alto');
});

test('historial de costos y orden de compra conservan fechas, proveedor y centavos', () => {
  const historial = core.historialCostos([
    { timestamp:10, items:[{ idFinal:'a', costoDespues:9.9, proveedor:'Proveedor 1' }] },
    { timestamp:20, items:[{ idFinal:'a', costoDespues:10.25, proveedor:'Proveedor 2' }] }
  ], 'a');
  assert.deepEqual(historial.map(x => x.costo), [10.25, 9.9]);
  const orden = core.crearOrdenCompra([
    { id:'a', nombre:'Taza', proveedorSurtido:'DIST A', cantidadSugerida:3, costo:9.9, stockNormalizado:0, minimoNormalizado:2 },
    { id:'b', nombre:'Playera', proveedorSurtido:'DIST B', cantidadSugerida:2, costo:12.5, stockNormalizado:1, minimoNormalizado:2 }
  ], 'DIST A');
  assert.equal(orden.items.length, 1);
  assert.equal(orden.total, 29.7);
});

test('el cierre diario compara conteo real sin modificar saldos', () => {
  const cierre = core.calcularCierre({ efectivo:100, banco:250 }, { efectivo:98.5, banco:251 });
  assert.equal(cierre.diferenciaEfectivo, -1.5);
  assert.equal(cierre.diferenciaBanco, 1);
  assert.equal(cierre.diferenciaTotal, -0.5);
  assert.equal(cierre.cuadra, false);

  const inicio = ops.indexOf('async function guardarCierre');
  const fin = ops.indexOf('function asegurarEtiquetas', inicio);
  const bloque = ops.slice(inicio, fin);
  assert.match(bloque, /cierres_diarios/);
  assert.doesNotMatch(bloque, /saldosDinero\s*=/);
  assert.doesNotMatch(bloque, /['"]sistema['"]\s*,\s*['"]config['"]/);
});

test('el código de barras local es determinista y no depende de servicios externos', () => {
  const uno = core.code39('1234-AB');
  const dos = core.code39('1234-AB');
  assert.equal(uno.texto, '1234-AB');
  assert.equal(uno.ancho, dos.ancho);
  assert.deepEqual(JSON.parse(JSON.stringify(uno.modulos)), JSON.parse(JSON.stringify(dos.modulos)));
  assert.ok(uno.modulos.some(x => x.barra));
  assert.doesNotMatch(coreSrc, /barcode\.tec|api\.qr|googleapis|quickchart/);
});

test('los borradores locales caducan y las capas visuales no escriben a Firebase', () => {
  const ahora = 1_000_000_000;
  assert.equal(core.borradorValido({ timestamp:ahora - 1000 }, ahora), true);
  assert.equal(core.borradorValido({ timestamp:ahora - 73 * 3600000 }, ahora), false);
  assert.match(ui, /subli_borrador_v130_/);
  assert.match(ui, /beforeunload/);
  assert.doesNotMatch(coreSrc + ui, /runTransaction|setDoc|updateDoc|deleteDoc|writeBatch/);
});

test('auditoría, cierre, órdenes y errores usan colecciones separadas y serverTimestamp', () => {
  for (const coleccion of ['auditoria_sistema','cierres_diarios','ordenes_compra','errores_sistema']) {
    assert.match(ops, new RegExp(coleccion));
  }
  assert.match(ops, /serverTimestamp/);
  assert.match(ops, /La auditoría agregada por esta capa es secundaria/);
  assert.match(ops, /Esto NO modifica los saldos del sistema/);
});

test('las reservas concurrentes cubren productos y clientes sin prohibir homónimos por nombre', () => {
  assert.match(ops, /indices_nombres/);
  assert.match(ops, /producto_\$\{clave\}/);
  assert.match(ops, /cliente_\$\{identidad\}/);
  assert.match(ops, /nit-/);
  assert.match(ops, /tel-/);
  assert.match(ops, /Ya existe un producto equivalente/);
  assert.match(ops, /Ya existe “\$\{duplicado\.nombreCompleto\}”/);
});

test('el Centro Inteligente entiende salud, pendientes, cobros y costos con permisos', () => {
  assert.match(assistant, /como va mi negocio/);
  assert.match(assistant, /que tengo pendiente/);
  assert.match(assistant, /que debo cobrar/);
  assert.match(assistant, /ultimo costo/);
  assert.match(assistant, /Tu usuario no tiene permiso para ver saldos internos/);
  assert.match(assistant, /Tu usuario no tiene permiso para consultar costos internos/);
});

test('la navegación profesional corrige aliases antiguos sin crear pestañas nuevas', () => {
  assert.match(compat, /opciones:\s*'ajustes'/);
  assert.match(compat, /disenos:\s*'buscador'/);
  assert.match(ui, /¿Qué quieres hacer\?/);
  assert.match(ui, /Ctrl K/);
  assert.doesNotMatch(ui, /crearPestaña|nuevaPestaña/);
});

test('las dependencias quedan fijadas y se cachean después de su primera carga', () => {
  assert.match(vendor, /chart\.js@4\.5\.1/);
  assert.match(vendor, /xlsx\/0\.18\.5/);
  assert.match(sw, /chart\.js@4\.5\.1/);
  assert.match(sw, /xlsx\/0\.18\.5/);
  assert.match(sw, /VENDOR_URLS/);
  assert.match(sw, /caches\.match\(request\)/);
});

test('la PWA carga todos los módulos v1.3.0 y conserva el corte público coordinado', () => {
  for (const archivo of ['profesional-core-v130.js','profesional-ui-v130.js','profesional-operaciones-v130.js','profesional-compat-v130.js','asistente-ajustes-v130.js','vendor-cache-v130.js','build-info.json']) {
    assert.match(visual + sw, new RegExp(archivo.replaceAll('.', '\\.')));
    assert.ok(fs.existsSync(path.join(raiz, archivo)));
  }
  assert.equal(build.build, '1.3.0');
  assert.equal(build.basePublica, '1.2.5');
  assert.match(sw, /sublicosturas-v1\.2\.5/);
});

test('el respaldo v4 firma SHA-256, valida tipos y rechaza esquemas posteriores', () => {
  assert.match(respaldo, /schemaVersion:\s*4/);
  assert.match(respaldo, /SHA-256/);
  assert.match(respaldo, /schemaVersion > 4/);
  assert.match(respaldo, /validarEsquemaDocumento/);
  assert.match(respaldo, /restauraciones_sistema/);
  assert.match(respaldo, /estado:\s*'incompleta'/);
  assert.match(respaldo, /verificarMuestraRestaurada/);
});

test('la profesionalización respeta las dos funciones expresamente descartadas', () => {
  const nuevos = [coreSrc, ui, ops, assistant, compat, vendor].join('\n').toLowerCase();
  assert.doesNotMatch(nuevos, /createuserwithemailandpassword|firebasecreateuser|empleado.*firebase auth|auth individual por empleado/);
  assert.doesNotMatch(nuevos, /favoritos|producto favorito|repetir última venta|repetir ultima venta/);
});

test('los módulos nuevos tienen sintaxis válida como scripts clásicos', () => {
  for (const archivo of ['profesional-core-v130.js','profesional-ui-v130.js','profesional-operaciones-v130.js','profesional-compat-v130.js','asistente-ajustes-v130.js','vendor-cache-v130.js']) {
    assert.doesNotThrow(() => new vm.Script(leer(archivo), { filename:archivo }));
  }
});
