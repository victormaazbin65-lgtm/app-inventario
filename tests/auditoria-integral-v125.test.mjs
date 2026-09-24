import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const fuenteCore = leer('profesional-core-v130.js');
const fuenteRespaldo = leer('respaldo-negocio.js');
const html = leer('index.html');

function crearCore() {
  const entorno = vm.createContext({ console, Date, Math, Number, String, Object, Array, Map, Set });
  entorno.window = entorno;
  vm.runInContext(fuenteCore, entorno);
  return entorno.SubliProfesionalCore;
}

function crearRespaldo({ leerColeccion, leerDocumento }) {
  const entorno = vm.createContext({
    console, Date, Math, Number, String, Object, Array, Map, Set, TextEncoder, setTimeout,
    navigator: { onLine: true }, crypto: webcrypto,
    db: {},
    collection: (_, nombre) => nombre,
    doc: (_, coleccion, id) => `${coleccion}/${id}`,
    getDocs: leerColeccion,
    getDoc: leerDocumento
  });
  entorno.window = entorno;
  const codigo = fuenteRespaldo.replace('global.SubliRespaldoCoreV4 =',
    'global.__funcionesRespaldo = { construirCopiaSeguridad, verificarMuestraRestaurada }; global.SubliRespaldoCoreV4 =');
  vm.runInContext(codigo, entorno);
  return entorno.__funcionesRespaldo;
}

const servidor = { metadata: { fromCache: false, hasPendingWrites: false } };
const cache = { metadata: { fromCache: true, hasPendingWrites: false } };

test('un crédito pagado en cero no reaparece por campos legados ni por cobros viejos', () => {
  const core = crearCore();
  const pagada = { id: 'pagada', clienteId:'ana', saldoPendiente:0, saldoCredito:90,
    ingresoTotal:100, montoCobradoTotal:10 };
  assert.equal(core.saldoCreditoVenta(pagada), 0);
  assert.equal(core.saldoCreditoVenta({ ingresoTotal:80, montoCobradoTotal:10, saldoPendiente:null }), 70);
  assert.equal(core.saldoCreditoVenta({ ingresoTotal:80, montoCobradoTotal:10, saldoPendiente:'' }), 70);
  assert.equal(core.saldoCreditoVenta({ saldoPendiente:12.345 }), 12.35);
  assert.equal(core.agendaCobros([pagada], [], Date.now()).length, 0);
  assert.equal(core.resumenCliente({ id:'ana' }, [pagada], [], { creditosPendientes:[], creditosConfirmados:true }).saldoCredito, 0);
});

test('el panel y el asistente usan créditos completos aunque sean más antiguos que las últimas 50 ventas', () => {
  const core = crearCore();
  const pagadas = Array.from({ length:50 }, (_, n) => ({ id:`v${n}`, clienteId:'ana', ingresoTotal:10,
    montoCobradoTotal:10, saldoPendiente:0 }));
  const antigua = { id:'anterior', clienteId:'ana', ingresoTotal:90, montoCobradoTotal:15,
    saldoPendiente:75, vencimiento:'2026-09-01' };
  const ahora = new Date(2026, 8, 24, 12).getTime();
  const contexto = { ventas:pagadas, creditosPendientes:[antigua], creditosConfirmados:true, ahora };
  const lista = core.ventasParaCobros(contexto.ventas, contexto.creditosPendientes, true);
  assert.equal(lista.length, 1);
  assert.equal(core.agendaCobros(lista, [], ahora)[0].saldo, 75);
  assert.equal(core.resumenSalud(contexto).porCobrar, 75);
  assert.equal(core.prioridadesNegocio(contexto)[0].tipo, 'cobros');
  assert.equal(core.resumenCliente({ id:'ana', saldoCredito:0 }, pagadas, [], contexto).saldoCredito, 75);

  // Si aún no llegó el servidor, una venta pagada recién cargada reemplaza el
  // crédito de la copia local con el mismo identificador.
  const atrasada = { ...antigua, id:'v0', saldoPendiente:40 };
  assert.equal(core.ventasParaCobros(pagadas, [atrasada], false).find(v => v.id === 'v0').saldoPendiente, 0);
});

test('un stock negativo se alerta sin convertir el inventario en valor negativo y un préstamo pagado no cuenta como pendiente', () => {
  const core = crearCore();
  const salud = core.resumenSalud({
    inventario:[{ id:'x', stock:-4, min:2, costo:15 }, { id:'y', stock:3, min:1, costo:7 }],
    prestamos:[{ id:'p', saldoPendiente:12, estado:'pagado' }]
  });
  assert.equal(salud.agotados, 1);
  assert.equal(salud.valorInventario, 21);
  assert.equal(salud.prestamosPendientes, 0);
  assert.equal(salud.porCobrar, 0);
});

test('el respaldo se cancela si alguna colección proviene de caché, aunque el dispositivo diga estar en línea', async () => {
  const respaldo = crearRespaldo({
    leerColeccion: async nombre => ({ ...(nombre === 'ventas' ? cache : servidor), forEach: () => {} }),
    leerDocumento: async () => ({ ...servidor, exists: () => true, data: () => ({ ultimaActualizacion:1 }) })
  });
  await assert.rejects(respaldo.construirCopiaSeguridad(), /servidor no confirmó la colección ventas/);
});

test('el respaldo válido incluye todas las colecciones, tiene firma y rechaza cambios simultáneos en configuración', async () => {
  let versionConfig = 1;
  const crear = () => crearRespaldo({
    leerColeccion: async nombre => ({ ...servidor, forEach: callback => {
      if(nombre === 'inventario') callback({ id:'a', data: () => ({ id:'a', nombre:'Producto', stock:3 }) });
    } }),
    leerDocumento: async referencia => ({ ...servidor, exists: () => true,
      data: () => referencia === 'sistema/config' ? ({ ultimaActualizacion:versionConfig++ }) : ({ logo:'negocio' }) })
  });
  await assert.rejects(crear().construirCopiaSeguridad(), /configuración cambió durante el respaldo/);
  versionConfig = 1;
  const estable = crearRespaldo({
    leerColeccion: async nombre => ({ ...servidor, forEach: callback => {
      if(nombre === 'inventario') callback({ id:'a', data: () => ({ id:'a', nombre:'Producto', stock:3 }) });
    } }),
    leerDocumento: async referencia => ({ ...servidor, exists: () => true,
      data: () => referencia === 'sistema/config' ? ({ ultimaActualizacion:1 }) : ({ logo:'negocio' }) })
  });
  const copia = await estable.construirCopiaSeguridad();
  assert.equal(copia.conteos.inventario, 1);
  assert.equal(copia.conteos.ventas, 0);
  assert.match(copia.integridad.hash, /^[a-f0-9]{64}$/);
});

test('la verificación de restauración comprueba valores reales del servidor y rechaza respuestas de caché', async () => {
  const datos = { inventario:[{ id:'a', data:{ id:'a', nombre:'Producto', stock:3 } }] };
  const crear = (stock, metadata = servidor.metadata) => crearRespaldo({
    leerColeccion: async () => ({ ...servidor, forEach: () => {} }),
    leerDocumento: async () => ({ metadata, exists: () => true,
      data: () => ({ stock, nombre:'Producto', id:'a' }) })
  });
  await assert.rejects(crear(2).verificarMuestraRestaurada({ colecciones:datos }), /no coinciden/);
  await assert.rejects(crear(3, cache.metadata).verificarMuestraRestaurada({ colecciones:datos }), /servidor no confirmó/);
  assert.equal(await crear(3).verificarMuestraRestaurada({ colecciones:datos }), true);
});

test('descargar historial completo no sustituye ventas con una respuesta parcial de caché', async () => {
  const inicio = html.indexOf('async function cargarHistorialCompleto(tipo) {');
  const fin = html.indexOf('async function cargarVentasAnalisisUltimos30Dias(', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const entorno = vm.createContext({
    console:{ error() {} }, navigator:{ onLine:true }, historialCompletoCargado:{ ventas:false },
    ventas:[{ id:'guardada', ingresoTotal:10 }], historialIngresos:[], historialCotizaciones:[], historialRetiros:[],
    alert: () => {}, guardarDatos: () => {}, actualizarUI: () => {}
  });
  entorno.window = { db:{}, getDocs:async () => ({ ...cache, forEach: callback => callback({ data: () => ({ id:'otra' }) }) }),
    collection: (_, nombre) => nombre };
  vm.runInContext(html.slice(inicio, fin), entorno);
  assert.equal(await entorno.cargarHistorialCompleto('ventas'), false);
  assert.equal(entorno.ventas[0].id, 'guardada');
  assert.equal(entorno.historialCompletoCargado.ventas, false);
  entorno.window.getDocs = async () => ({ ...servidor, forEach: callback => callback({ data: () => ({ id:'servidor' }) }) });
  assert.equal(await entorno.cargarHistorialCompleto('ventas'), true);
  assert.equal(entorno.ventas[0].id, 'servidor');
  assert.equal(entorno.historialCompletoCargado.ventas, true);
});

test('el estado de sincronización exige las siete lecturas confirmadas y vuelve a pendiente al desconectarse', () => {
  const inicio = html.indexOf('const fuentesSincronizacion = Object.fromEntries(');
  const fin = html.indexOf('function programarActualizacionSincronizacion()', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const eventos = new Map();
  const entorno = vm.createContext({
    Object, Boolean, Set, Event: class { constructor(tipo) { this.type = tipo; } },
    navigator:{ onLine:true },
    window:{ dispatchEvent: () => {}, addEventListener: (nombre, accion) => eventos.set(nombre, accion) }
  });
  vm.runInContext(html.slice(inicio, fin), entorno);
  const confirmar = nombre => entorno.registrarEstadoSincronizacion(nombre, servidor);
  for(const nombre of ['config','inventario','ventas','creditos','clientes','anticipos']) confirmar(nombre);
  assert.equal(entorno.window.obtenerEstadoSincronizacion().confirmado, false);
  confirmar('prestamos');
  assert.equal(entorno.window.obtenerEstadoSincronizacion().confirmado, true);
  entorno.registrarEstadoSincronizacion('creditos', cache);
  assert.equal(entorno.window.obtenerEstadoSincronizacion().confirmado, false);
  confirmar('creditos');
  entorno.registrarEstadoSincronizacion('ventas', null, new Error('permiso'));
  assert.equal(entorno.window.obtenerEstadoSincronizacion().error, true);
  confirmar('ventas');
  assert.equal(entorno.window.obtenerEstadoSincronizacion().error, false);
  eventos.get('offline')();
  assert.equal(entorno.window.obtenerEstadoSincronizacion().confirmado, false);
});
