import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const html = leer('index.html');
const coreSource = leer('negocio-core.js');
const gestionSource = leer('gestion-negocio.js');
const finanzasSource = leer('finanzas-negocio.js');
const respaldoSource = leer('respaldo-negocio.js');
const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error });
vm.runInContext(coreSource, contexto);
const core = contexto.SubliNegocioCore;

const plano = valor => JSON.parse(JSON.stringify(valor));
const sumaAsignacionCentavos = asignacion => core.CLAVES_FONDOS.reduce((total, clave) => total + core.aCentavos(asignacion[clave]), 0);

test('la configuración del negocio se normaliza y conserva identificadores de unidades', () => {
  const config = core.normalizarConfiguracionNegocio({
    nombreNegocio: '  Mi tienda  ', moneda: 'GTQ', porcentajeSAT: 12.5, margenObjetivo: 40,
    nombreFondoProduccion: 'Operación', nombreManoObra: 'Trabajo',
    unidadesPersonalizadas: [{ id: 'personalizada_rollo', nombre: 'Rollo', abreviatura: 'roll', divisible: true, paso: 0.25 }],
    authPropietario: { habilitado: true, email: 'DUEÑO@EJEMPLO.COM', uid: 'abc' }
  });
  assert.equal(config.nombreNegocio, 'Mi tienda');
  assert.equal(config.porcentajeSAT, 12.5);
  assert.equal(config.unidadesPersonalizadas[0].id, 'personalizada_rollo');
  assert.equal(config.authPropietario.email, 'dueño@ejemplo.com');
  assert.equal(core.normalizarConfiguracionNegocio({ porcentajeSAT: 200 }).porcentajeSAT, 5);
});

test('las unidades y empaques convierten cantidad y costo con precisión', () => {
  const config = { unidadesPersonalizadas: [{ nombre: 'Rollo', abreviatura: 'roll', divisible: false }] };
  const unidades = core.listarUnidades(config);
  assert.ok(unidades.some(unidad => unidad.id === 'metro' && unidad.divisible));
  assert.ok(unidades.some(unidad => unidad.id === 'personalizada_rollo'));
  const convertido = core.calcularIngresoConvertido(3, 8, 10, 'total', core.obtenerUnidad('pieza', config));
  assert.equal(convertido.cantidadBase, 24);
  assert.equal(convertido.costoBase, 0.416667);
  assert.throws(() => core.normalizarCantidad(1.5, core.obtenerUnidad('pieza', config)), /cantidades enteras/);
  assert.equal(core.normalizarCantidad(1.257, core.obtenerUnidad('kilogramo', config)), 1.257);
});

test('el ingreso simple usa únicamente la cantidad real y el costo unitario', () => {
  const pieza = core.obtenerUnidad('pieza', {});
  assert.deepEqual(plano(core.calcularIngresoSimple(12, 9.9, pieza)), { cantidadBase: 12, costoBase: 9.9 });
  assert.throws(() => core.calcularIngresoSimple(0, 9.9, pieza), /mayor que cero/);
  assert.throws(() => core.calcularIngresoSimple(1.5, 9.9, pieza), /cantidades enteras/);
  assert.throws(() => core.calcularIngresoSimple(1, -1, pieza), /no negativo/);
  for (let cantidad = 1; cantidad <= 10000; cantidad += 1) {
    const resultado = core.calcularIngresoSimple(cantidad, (cantidad % 997) / 100, pieza);
    assert.equal(resultado.cantidadBase, cantidad);
    assert.equal(resultado.costoBase, (cantidad % 997) / 100);
  }
});

test('ventas y cotizaciones presentan cliente, carrito, gastos y cobro en ese orden', () => {
  const ventas = html.slice(html.indexOf('id="sec-ventas"'), html.indexOf('id="sec-cotizacion"'));
  const cotizaciones = html.slice(html.indexOf('id="sec-cotizacion"'), html.indexOf('id="sec-clientes"'));
  const posicionesVenta = ['id="venta-nombre"', 'id="buscador-venta-producto"', 'id="venta-tinta"', 'id="venta-metodo-pago"'].map(texto => ventas.indexOf(texto));
  const posicionesCotizacion = ['id="cotiza-nombre"', 'id="buscador-cotiza-producto"', 'id="cotiza-tinta"', 'id="cotiza-metodo-anticipo"'].map(texto => cotizaciones.indexOf(texto));
  assert.ok(posicionesVenta.every(posicion => posicion >= 0));
  assert.ok(posicionesCotizacion.every(posicion => posicion >= 0));
  assert.deepEqual([...posicionesVenta].sort((a, b) => a - b), posicionesVenta);
  assert.deepEqual([...posicionesCotizacion].sort((a, b) => a - b), posicionesCotizacion);
  assert.match(cotizaciones, /Generar cotización/);
});

test('la interfaz de ingreso y clientes permanece simple y plegable', () => {
  assert.match(html, /id="inv-medida-descripcion"/);
  assert.match(html, /calcularIngresoSimple\(cantidadIngresada, costoIngresado, unidad\)/);
  assert.doesNotMatch(html, /id="inv-contenido-compra"/);
  assert.doesNotMatch(html, /id="inv-tipo-costo"/);
  ['formulario', 'directorio', 'creditos', 'anticipos'].forEach(opcion => {
    assert.match(html, new RegExp(`id="cliente-opcion-${opcion}"`));
    assert.match(html, new RegExp(`id="cliente-panel-${opcion}"[^>]*hidden`));
  });
  assert.match(gestionSource, /function mostrarOpcionClientes/);
  assert.match(gestionSource, /localeCompare/);
  assert.match(finanzasSource, /clienteNombre[\s\S]*localeCompare/);
  assert.match(html, /input, select, textarea/);
});

test('el anticipo cotizado se informa sin registrarlo en caja antes de la venta', () => {
  assert.match(html, /id="cotiza-anticipo"/);
  assert.match(html, /id="cotiza-metodo-anticipo"/);
  assert.match(html, /anticipoCotizado, metodoAnticipoCotizado, anticipoRegistrado: false/);
  assert.match(html, /No se ha sumado a caja ni registrado como recibido/);
  assert.match(html, /esPagoParcialAcordado/);
  assert.match(html, /pendiente de registrar/);
});

test('la distribución por centavos siempre conserva el total exacto', () => {
  assert.deepEqual(plano(core.distribuirCentavos(2, { a: 10, b: 10, c: 10 })), { a: 1, b: 1, c: 0 });
  assert.deepEqual(plano(core.distribuirCentavos(2, { a: 0, b: 0, c: 0 })), { a: 1, b: 1, c: 0 });
  assert.equal(Object.values(core.distribuirCentavos(-17, { a: 1, b: 2, c: 4 })).reduce((a, b) => a + b, 0), -17);
  for (let total = 1; total <= 1000; total += 1) {
    const resultado = core.distribuirCentavos(total, { a: total % 7, b: total % 11, c: total % 13, d: total % 17 });
    assert.equal(Object.values(resultado).reduce((a, b) => a + b, 0), total);
  }
});

test('SAT, mano de obra y operación mantienen la identidad financiera', () => {
  const desglose = core.calcularDesgloseFinanciero(
    [{ nombre: 'Trabajo', qty: 2, precioCobrado: 100, costoBase: 40 }],
    10, 7, true, { porcentajeSAT: 8, nombreFondoProduccion: 'Operación' }, 13
  );
  assert.equal(desglose.ingresoTotal, 200);
  assert.equal(desglose.impuestoSAT, 16);
  assert.equal(desglose.totalGastos, 126);
  assert.equal(desglose.gananciaNeta, 74);
  assert.equal(desglose.totalGastos + desglose.gananciaNeta, desglose.ingresoTotal);
  assert.equal(desglose.nombreProduccion, 'Operación');
});

test('un pago parcial asigna exactamente los centavos cobrados', () => {
  const desglose = core.calcularDesgloseFinanciero([{ nombre: 'Pedido', qty: 1, precioCobrado: 100, costoBase: 30 }], 5, 4, true, { porcentajeSAT: 5 }, 6);
  const asignacion = core.calcularAsignacionFondos(desglose, 33.33);
  assert.equal(sumaAsignacionCentavos(asignacion), 3333);
  assert.equal(core.aCentavos(asignacion.costoLuzTinta), 500);
  const completa = core.calcularAsignacionFondos(desglose, 100);
  assert.equal(core.aCentavos(completa.costoLuzTinta), 1500);
  assert.equal(sumaAsignacionCentavos(completa), 10000);
});

test('estrés de crédito: 20000 pagos, incluso con pérdida, no crean ni pierden centavos', () => {
  let semilla = 0x1202026;
  const siguiente = () => (semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0);
  for (let escenario = 0; escenario < 20000; escenario += 1) {
    const ingreso = 1 + (siguiente() % 100000);
    const costo = siguiente() % 160000;
    const produccion = siguiente() % 20000;
    const mano = siguiente() % 10000;
    const envio = siguiente() % 10000;
    const desglose = core.calcularDesgloseFinanciero(
      [{ nombre: 'Prueba', qty: 1, precioCobrado: ingreso / 100, costoBase: costo / 100 }],
      produccion / 100, envio / 100, (siguiente() & 1) === 1, { porcentajeSAT: (siguiente() % 1500) / 100 }, mano / 100
    );
    const pagado = siguiente() % (core.aCentavos(desglose.ingresoTotal) + 1);
    const asignacion = core.calcularAsignacionFondos(desglose, pagado / 100);
    assert.equal(sumaAsignacionCentavos(asignacion), pagado);
  }
});

test('efectivo, transferencia y depósito se ubican sin cambiar el total', () => {
  assert.equal(core.ubicacionMetodoPago('efectivo'), 'efectivo');
  assert.equal(core.ubicacionMetodoPago('transferencia'), 'banco');
  assert.equal(core.ubicacionMetodoPago('deposito'), 'banco');
  assert.deepEqual(plano(core.normalizarSaldosDinero(null, 125.50)), { efectivo: 125.5, banco: 0, inicializado: true, migradoAutomaticamente: true });
  const normalizados = core.normalizarSaldosDinero({ efectivo: 25.25, banco: 100.25, inicializado: true }, 0);
  assert.equal(normalizados.efectivo + normalizados.banco, 125.5);
});

test('los abonos de préstamo restauran exactamente el desglose original', () => {
  const original = { costoProducto: 43.21, costoLuzTinta: 12.34, gananciaLibre: 44.44, fondoImpuestos: 0.01 };
  let devuelto = 0;
  const acumulado = { costoProducto: 0, costoLuzTinta: 0, gananciaLibre: 0, fondoImpuestos: 0 };
  for (const abono of [0.01, 1.23, 17.89, 30, 50.87]) {
    const resultado = core.calcularRestitucionPrestamo(original, 100, devuelto, abono);
    assert.equal(sumaAsignacionCentavos(resultado.restauracion), core.aCentavos(resultado.montoAplicado));
    core.CLAVES_FONDOS.forEach(clave => { acumulado[clave] += resultado.restauracion[clave]; });
    devuelto = resultado.devueltoAcumulado;
  }
  assert.equal(devuelto, 100);
  assert.deepEqual(plano(core.normalizarFondos(acumulado)), original);
});

test('las fichas de clientes validan identidad y límite de crédito', () => {
  const cliente = core.validarCliente({ id: 'c1', nombres: ' Ana ', apellidos: ' López ', nit: '', limiteCredito: '250.505' });
  assert.equal(cliente.nombreCompleto, 'ANA LÓPEZ');
  assert.equal(cliente.nit, 'C/F');
  assert.equal(cliente.limiteCredito, 250.51);
  assert.throws(() => core.validarCliente({ nombres: '', apellidos: '' }), /nombre o apellido/);
});

test('la interfaz integra clientes, caja, unidades, respaldo y los módulos en orden', () => {
  ['tab-clientes', 'tab-caja', 'sec-clientes', 'sec-caja', 'config-porcentaje-sat', 'config-margen-objetivo', 'config-unidad-nombre', 'archivo-restauracion'].forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
  const posiciones = ['negocio-core.js', 'gestion-negocio.js', 'finanzas-negocio.js', 'respaldo-negocio.js'].map(archivo => html.indexOf(`src="./${archivo}"`));
  assert.ok(posiciones.every(posicion => posicion > 0));
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
  assert.match(html, /cargarCotizacionEnFormularioVenta/);
});

test('la cuenta real y los controles del Dueño están conectados a Firebase Auth', () => {
  assert.match(html, /signInWithEmailAndPassword/);
  assert.match(html, /sendPasswordResetEmail/);
  assert.match(html, /createUserWithEmailAndPassword/);
  assert.match(html, /let firebaseListoEmitido = false/);
  assert.match(html, /if \(!firebaseListoEmitido\)/);
  assert.match(gestionSource, /authPropietario/);
  assert.match(gestionSource, /credencial\.user\.uid !== authConfig\.uid/);
  assert.match(gestionSource, /function marcarAccesoFirebaseProtegido/);
  assert.match(gestionSource, /global\.location\.reload\(\)/);
  assert.match(gestionSource, /function exigirDueno/);
  assert.match(leer('SEGURIDAD_FIREBASE.md'), /firebase deploy --only firestore:rules/);
});

test('clientes y unidades se guardan de forma coherente y transaccional', () => {
  assert.match(gestionSource, /async function guardarConfiguracionNegocio\(unidadesPersonalizadasForzadas = null\)/);
  assert.match(gestionSource, /async function agregarUnidadPersonalizada/);
  assert.match(gestionSource, /inventario\.some\(producto => String\(producto\.unidadId/);
  assert.match(gestionSource, /const registro = await global\.runTransaction/);
  assert.match(gestionSource, /saldoServidor/);
  assert.match(gestionSource, /async function archivarCliente/);
  assert.match(gestionSource, /Tiene .* por cobrar/);
});

test('la venta a crédito descuenta inventario pero solo suma dinero cobrado', () => {
  assert.match(html, /const montoCobradoTotal = ventaAnterior \? ingresoTotal : redondear\(pagoDinero \+ anticipoSolicitado\)/);
  assert.match(html, /saldoPendiente = ventaAnterior \? 0 : desdeCentavos/);
  assert.match(html, /calcularAsignacionFondos\(desglose, montoCobradoTotal\)/);
  assert.match(html, /clienteServidor\.limiteCredito/);
  assert.match(html, /normalizarCantidad\(entrada\.qtyNueva, unidadServidor\)/);
  assert.match(finanzasSource, /Los fondos aumentaron solo por el dinero recibido/);
});

test('anticipos, devoluciones, pérdidas y anulaciones mantienen trazabilidad', () => {
  assert.match(finanzasSource, /El cliente ya no está activo/);
  assert.match(finanzasSource, /produccionNoRecuperada/);
  assert.match(finanzasSource, /reingresadoInventario/);
  assert.match(finanzasSource, /perdidas_inventario/);
  assert.match(html, /reembolso_anulacion/);
  assert.match(html, /anticipoRestaurado/);
  assert.match(html, /ajuste_venta_antigua_(?:entrada|salida)/);
  assert.match(html, /deltaEdicion/);
});

test('la copia completa valida, crea punto previo y conserva el UID actual', () => {
  assert.match(respaldoSource, /schemaVersion: 3/);
  assert.match(respaldoSource, /40 \* 1024 \* 1024/);
  assert.match(respaldoSource, /crearCopiaSeguridadJSON\(true\)/);
  assert.match(respaldoSource, /if \(!punto\) throw new Error/);
  assert.match(respaldoSource, /authPropietario: authActual/);
  assert.match(respaldoSource, /hasOwnProperty\.call\(configActual, 'ultimaActualizacionAuth'\)/);
  assert.doesNotMatch(respaldoSource, /lote\.delete/);
});

test('reglas, PWA y versión 1.2.1 quedan listas para activación controlada', () => {
  const reglas = leer('firestore.rules');
  assert.match(reglas, /request\.auth\.uid == authPropietario\(\)\.get\('uid'/);
  assert.match(reglas, /activacionPropiaValida/);
  assert.match(reglas, /!proteccionActivada\(\) \|\| esPropietarioAutenticado\(\)/);
  assert.deepEqual(JSON.parse(leer('firebase.json')), { firestore: { rules: 'firestore.rules' } });
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.2.1' });
  assert.equal(JSON.parse(leer('package.json')).version, '1.2.1');
  assert.match(leer('sw.js'), /sublicosturas-v1\.2\.1/);
  ['negocio-core.js', 'gestion-negocio.js', 'finanzas-negocio.js', 'respaldo-negocio.js'].forEach(archivo => assert.match(leer('sw.js'), new RegExp(archivo.replace('.', '\\.'))));
});
