import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const leer = nombre => fs.readFileSync(new URL('../' + nombre, import.meta.url), 'utf8');
const html = leer('index.html');
function tramo(fuente, inicio, fin) {
  const desde = fuente.indexOf(inicio);
  const hasta = fuente.indexOf(fin, desde + inicio.length);
  assert.ok(desde >= 0 && hasta > desde, inicio);
  return fuente.slice(desde, hasta);
}
function entornoResumen() {
  // Los identificadores proceden del HTML real: no se inventa tab-caja.
  const elementos = new Map([...html.slice(0, html.indexOf('<script src="./negocio-core.js"')).matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, {
    style: { display: id === 'main-app' || id === 'sec-inicio' ? 'block' : 'none' },
    classList: { contains: () => id === 'tab-inicio' }, textContent: '', innerText: '', value: '', open: false
  }]));
  const c = vm.createContext({ console, addEventListener() {}, document: { getElementById: id => elementos.get(id) || null, querySelectorAll: () => [] },
    inventario: [], fondos: { costoProducto: 904.41, costoLuzTinta: 113, gananciaLibre: 158.09, fondoImpuestos: 35 },
    saldosDinero: { efectivo: 1000.50, banco: 210, inicializado: true }, clientes: [], anticipos: [], ventas: [], ventasCreditoPendiente: [], creditosPendientesConfirmados: false,
    prestamos: [], perdidasInventario: [], movimientosCaja: [], cambiarLabelCosto() {}, escaparHTML: String, normalizarTexto: v => String(v || "").toLowerCase(),
    numeroFinito: v => Number(v) || 0, actualizarListaCategorias() {}, actualizarGraficoVentas() {}, renderResumenMensual() {}, renderPanelInteligente() {},
    renderSelectoresUnidades() {}, renderUnidadesPersonalizadasConfig() {}, renderHistorialRetiros() {},
    renderHistorialCotizaciones() {}, renderHistorialIngresos() {}, renderAlertas() {}
  });
  c.window = c;
  vm.runInContext(leer('negocio-core.js') + '\n' + leer('gestion-negocio.js') + '\n' + leer('finanzas-negocio.js'), c);
  c.configuracionNegocio = c.SubliNegocioCore.normalizarConfiguracionNegocio({});
  vm.runInContext(tramo(html, 'function renderizarTodo()', 'function actualizarUI()'), c);
  return { c, elementos };
}
test('Inicio actualiza dinero y fondos por el recorrido completo aunque Caja no tenga botón', () => {
  const { c, elementos } = entornoResumen();
  assert.equal(elementos.has('tab-caja'), false);
  assert.doesNotThrow(() => c.renderizarTodo());
  assert.equal(elementos.get('dash-total-caja').textContent, 'Q 1210.50');
  assert.equal(elementos.get('dash-efectivo').textContent, 'Q 1000.50');
  assert.equal(elementos.get('dash-banco').textContent, 'Q 210.00');
  assert.equal(elementos.get('dash-costo-producto').innerText, 'Q 904.41');
  c.saldosDinero = { efectivo: 0, banco: 0, inicializado: true };
  c.renderizarTodo();
  assert.equal(elementos.get('dash-total-caja').textContent, 'Q 0.00');
});
test('Caja actualiza retiros cuando se abre desde Inicio', () => {
  const { c, elementos } = entornoResumen();
  elementos.get('sec-inicio').style.display = 'none';
  elementos.get('sec-caja').style.display = 'block';
  let retiros = 0;
  c.renderHistorialRetiros = () => retiros++;
  c.renderGestionNegocio = () => {};
  c.renderizarTodo();
  assert.equal(retiros, 1);
});
test('el crédito confirmado incluye cuentas antiguas y no depende de fichas parcialmente migradas', () => {
  const { c, elementos } = entornoResumen();
  c.clientes = [{ id: 'A', saldoCredito: 20 }, { id: 'B' }, { id: 'C', archivado: true, saldoCredito: 30 }];
  c.ventasCreditoPendiente = [{ clienteId: 'A', saldoPendiente: 20 }, { clienteId: 'B', saldoPendiente: 40 }, { clienteId: 'C', saldoPendiente: 30 }, { saldoPendiente: 10 }, { saldoPendiente: 80, anulada: true }];
  c.creditosPendientesConfirmados = true;
  c.actualizarResumenFinanzasNegocio();
  assert.equal(elementos.get('dash-credito-pendiente').textContent, 'Q 100.00');
  c.ventasCreditoPendiente = [];
  c.actualizarResumenFinanzasNegocio();
  assert.equal(elementos.get('dash-credito-pendiente').textContent, 'Q 0.00');
  c.creditosPendientesConfirmados = false;
  c.ventas = [{ clienteId: 'A', saldoPendiente: 10 }, { clienteId: 'B', saldoPendiente: 40 }, { saldoPendiente: 10 }];
  c.actualizarResumenFinanzasNegocio();
  assert.equal(elementos.get('dash-credito-pendiente').textContent, 'Q 100.00');
});
test('el respaldo local antiguo recupera saldos tras leer fondos y anticipos, conservando ceros explícitos', async () => {
  for (const saldo of [undefined, { efectivo: 0, banco: 0, inicializado: true }, { efectivo: 10, banco: 125.5, inicializado: true }]) {
    const { c } = entornoResumen();
    const claves = ['INV','VENTAS','FONDOS','INGRESOS','COTIZ_HIST','RETIROS','CODIGOS_INV','NEGOCIO','SALDOS_DINERO','CLIENTES','ANTICIPOS','PRESTAMOS','MOVIMIENTOS_CAJA','DEVOLUCIONES','PERDIDAS'];
    claves.forEach(k => c['KEY_' + k] = k);
    const datos = { FONDOS: { costoProducto: 125.5 }, ANTICIPOS: [{ saldoPendiente: 10 }] };
    if(saldo) datos.SALDOS_DINERO = saldo;
    c.saldosDinero = c.SubliNegocioCore.normalizarSaldosDinero(null, 0);
    c.setTimeout = setTimeout;
    c.localStorage = { getItem: k => datos[k] === undefined ? null : JSON.stringify(datos[k]) };
    c.normalizarEstadoCodigosInventario = v => v;
    vm.runInContext(tramo(html, 'let cargaDatosLocalesPromesa = null;', 'function fusionarPorId'), c);
    await c.cargarDatosLocales();
    assert.equal(c.saldosDinero.efectivo, saldo ? saldo.efectivo : 135.5);
    assert.equal(c.saldosDinero.banco, saldo ? saldo.banco : 0);
  }
});
function entornoReservas() {
  const c = vm.createContext({ inventario: [], console });
  c.global = c;
  c.db = {};
  c.doc = (_, coleccion, id) => ({ path: coleccion + '/' + id });
  c.core = { claveUnica: valor => valor.toLowerCase().replace(/[^a-z0-9]/g, '_') };
  c.reservarCodigoInventarioEnTransaccion = async (t, producto, estado, ocupados) => {
    const ref = c.doc(c.db, 'codigos_inventario', String(producto.codigoInventario));
    await t.get(ref);
    return { producto, estado, codigosOcupados: ocupados, reserva: { ref, datos: { productoId: producto.id } } };
  };
  const ops = leer('profesional-operaciones-v130.js');
  vm.runInContext(tramo(ops, 'function claveProducto(', 'function instalarClienteSeguro()'), c);
  c.instalarReservaProductos();
  const escrituras = [];
  let escribiendo = false;
  c.t = {
    get: async () => { if(escribiendo) throw new Error('Todas las lecturas deben preceder escrituras'); return { exists: () => false }; },
    set: (ref, datos) => { escribiendo = true; escrituras.push({ path: ref.path, datos }); },
    delete: ref => { escribiendo = true; escrituras.push({ path: ref.path, eliminar: true }); }
  };
  return { c, escrituras };
}
test('reservar dos productos no escribe antes de terminar las lecturas', async () => {
  const { c, escrituras } = entornoReservas();
  const reservas = [];
  for (const [id, nombre, codigo] of [['A','TAZA',1001],['B','BOLSA',1002]]) {
    const r = await c.reservarCodigoInventarioEnTransaccion(c.t, { id, nombre, categoria: 'OTROS', codigoInventario: codigo }, {}, new Set(), 1);
    reservas.push(r.reserva);
  }
  assert.equal(escrituras.length, 0);
  vm.runInContext(tramo(html, 'function escribirReservasInventario(', 'function renombrarCategoriaEnEstadoCodigos('), c);
  c.escribirReservasInventario(c.t, reservas);
  assert.equal(escrituras.length, 4);
  assert.equal(escrituras.filter(e => e.path.startsWith('indices_nombres/')).length, 2);
});
test('nombres duplicados en el mismo ingreso se rechazan sin escribir reservas', async () => {
  const { c, escrituras } = entornoReservas();
  const reservas = [];
  for (const [id, codigo] of [['A',1001],['B',1002]]) {
    const r = await c.reservarCodigoInventarioEnTransaccion(c.t, { id, nombre: 'TAZA', categoria: 'OTROS', codigoInventario: codigo }, {}, new Set(), 1);
    reservas.push(r.reserva);
  }
  vm.runInContext(tramo(html, 'function escribirReservasInventario(', 'function renombrarCategoriaEnEstadoCodigos('), c);
  assert.throws(() => c.escribirReservasInventario(c.t, reservas), /equivalentes/);
  assert.equal(escrituras.length, 0);
});
test('ingreso completo de dos productos conserva cantidades, costo con transporte y fondos', async () => {
  const c = vm.createContext({ console, navigator: { onLine: true }, inventario: [], historialIngresos: [], ingresoEnEdicion: null, isProcessingTransaction: false,
    guardarDatos() {}, actualizarUI() {}, renderCarritoIngresos() {}, renderHistorialIngresos() {}, localStorage: { setItem() {} } });
  c.window = c; c.global = c;
  vm.runInContext(leer('negocio-core.js'), c);
  vm.runInContext(leer('profesional-core-v130.js'), c);
  c.core = c.SubliProfesionalCore;
  c.numeroFinito = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  c.aCentavos = c.SubliNegocioCore.aCentavos; c.desdeCentavos = c.SubliNegocioCore.desdeCentavos;
  c.aMilesimas = c.SubliNegocioCore.aMilesimas; c.desdeMilesimas = c.SubliNegocioCore.desdeMilesimas;
  c.copiarDatos = v => JSON.parse(JSON.stringify(v));
  c.fusionarPorId = (actual, nuevos) => [...actual, ...nuevos];
  let id = 0; c.generarIDSeguro = () => 'test-' + ++id;
  c.configuracionNegocio = c.SubliNegocioCore.normalizarConfiguracionNegocio({});
  const alertas = []; c.alert = mensaje => alertas.push(mensaje);
  const campos = new Map();
  c.document = { getElementById: id => { if(!campos.has(id)) campos.set(id, { value: id === 'ingreso-transporte-global' ? '5' : '', style: {} }); return campos.get(id); } };
  vm.runInContext(tramo(html, 'const TAMANO_BLOQUE_CATEGORIA', 'function renombrarCategoriaEnEstadoCodigos('), c);
  c.estadoCodigosInventario = c.normalizarEstadoCodigosInventario();
  const ops = leer('profesional-operaciones-v130.js');
  vm.runInContext(tramo(ops, 'function claveProducto(', 'function instalarClienteSeguro()'), c);
  c.instalarReservaProductos();
  vm.runInContext(tramo(html, 'async function procesarIngresoMultiple()', 'function renderHistorialIngresos()'), c);
  const fondos = { costoProducto: 904.41, costoLuzTinta: 113, gananciaLibre: 158.09, fondoImpuestos: 35 };
  const docs = new Map([['sistema/config', { fondos, registroCodigosVersion: 1 }]]);
  c.db = {};
  c.doc = (_, col, id) => ({ path: col + '/' + id, id });
  c.runTransaction = async (_, callback) => {
    let escribiendo = false; const cambios = [];
    const t = {
      get: async ref => { assert.equal(escribiendo, false, 'lectura después de escritura'); const data = docs.get(ref.path); return { exists: () => data !== undefined, data: () => structuredClone(data) }; },
      set: (ref, data) => { escribiendo = true; cambios.push([ref.path, data]); },
      update: (ref, data) => { escribiendo = true; cambios.push([ref.path, { ...docs.get(ref.path), ...data }]); },
      delete: ref => { escribiendo = true; cambios.push([ref.path, null]); }
    };
    const result = await callback(t);
    for(const [path, data] of cambios) data === null ? docs.delete(path) : docs.set(path, structuredClone(data));
    return result;
  };
  c.carritoIngresos = ['TAZA PRUEBA', 'BOLSA PRUEBA'].map((nombre, tempId) => ({ tempId, isNew: true, nombre, categoria: 'PRUEBA', stock: 2, min: 1, costoBase: 10, unidadId: 'pieza', proveedor: 'PRUEBA', cantidadComprada: 2, contenidoPorCompra: 1 }));
  await c.procesarIngresoMultiple();
  assert.equal(alertas.length, 1);
  assert.match(alertas[0], /✅.*Guardado/);
  const productos = [...docs].filter(([p]) => p.startsWith('inventario/')).map(([,p]) => p);
  assert.deepEqual(productos.map(p => [p.stock, p.costo]), [[2,11.25],[2,11.25]]);
  assert.equal(new Set(productos.map(p => p.codigoInventario)).size, 2);
  assert.equal([...docs.keys()].filter(p => p.startsWith('indices_nombres/')).length, 2);
  assert.deepEqual(docs.get('sistema/config').fondos, fondos);
  assert.equal(c.carritoIngresos.length, 0);
});
