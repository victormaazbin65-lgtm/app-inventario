import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const gestion = fs.readFileSync(path.join(raiz, 'gestion-negocio.js'), 'utf8');
const finanzas = fs.readFileSync(path.join(raiz, 'finanzas-negocio.js'), 'utf8');

test('el respaldo se lee por etapas y una sola vez aunque dos arranques lo pidan', async () => {
  const inicio = html.indexOf('let cargaDatosLocalesPromesa = null;');
  const fin = html.indexOf('function fusionarPorId', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const lecturas = [];
  let turnos = 0;
  const datos = new Map([
    ['inv', JSON.stringify([{ id: 'producto-1' }])],
    ['ventas', JSON.stringify([{ id: 'venta-1', saldoPendiente: 10 }])],
    ['clientes', JSON.stringify([{ id: 'cliente-1' }])]
  ]);
  const claves = [
    'INV', 'VENTAS', 'FONDOS', 'INGRESOS', 'COTIZ_HIST', 'RETIROS',
    'CODIGOS_INV', 'NEGOCIO', 'SALDOS_DINERO', 'CLIENTES', 'ANTICIPOS',
    'PRESTAMOS', 'MOVIMIENTOS_CAJA', 'DEVOLUCIONES', 'PERDIDAS'
  ];
  const entorno = {
    console: { warn: () => {} },
    setTimeout: (funcion, retraso) => { turnos += 1; return setTimeout(funcion, retraso); },
    localStorage: { getItem: clave => { lecturas.push(clave); return datos.get(clave) || null; } },
    SubliNegocioCore: {
      aCentavos: monto => Number(monto) * 100,
      normalizarConfiguracionNegocio: valor => valor,
      normalizarSaldosDinero: valor => valor,
      totalFondos: () => 0
    },
    totalAnticiposPendientes: () => 0,
    fondos: {},
    normalizarEstadoCodigosInventario: valor => valor
  };
  claves.forEach(clave => {
    entorno['KEY_' + clave] = ({ INV: 'inv', VENTAS: 'ventas', CLIENTES: 'clientes' })[clave] || clave;
  });
  vm.createContext(entorno);
  vm.runInContext(html.slice(inicio, fin), entorno);

  const primera = entorno.cargarDatosLocales();
  const segunda = entorno.cargarDatosLocales();
  assert.strictEqual(primera, segunda);
  assert.equal(lecturas.length, 0);
  await primera;

  assert.equal(lecturas.length, claves.length);
  assert.equal(new Set(lecturas).size, claves.length);
  assert.equal(turnos, claves.length);
  assert.deepEqual(JSON.parse(JSON.stringify(entorno.inventario)), [{ id: 'producto-1' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(entorno.ventasCreditoPendiente)), [{ id: 'venta-1', saldoPendiente: 10 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(entorno.clientes)), [{ id: 'cliente-1' }]);
  assert.equal(datos.size, 3);
});

test('cada pantalla recupera su resumen y sus clientes sin dibujar listas durante el PIN', () => {
  const inicio = gestion.indexOf('function aplicarConfiguracionNegocio()');
  const fin = gestion.indexOf('async function guardarConfiguracionNegocio', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const vistas = Object.fromEntries(['main-app', 'sec-inicio', 'sec-caja', 'sec-ajustes', 'ajuste-clientes', 'sec-ventas', 'sec-cotizacion']
    .map(id => [id, { style: { display: id === 'sec-inicio' ? 'block' : 'none' }, open: false }]));
  let resumen = 0;
  let caja = 0;
  let clientes = 0;
  let listaVenta = 0;
  let cobro = 0;
  const entorno = {
    core: { normalizarConfiguracionNegocio: valor => valor },
    global: { actualizarResumenFinanzasNegocio: () => { resumen++; } },
    configuracionNegocio: {
      nombreNegocio: 'SubliCosturas', moneda: 'Q', porcentajeSAT: 5,
      nombreFondoProduccion: 'Producción', nombreManoObra: 'Mano de obra',
      authPropietario: { habilitado: false, email: '' }
    },
    document: {
      title: '',
      querySelectorAll: () => [],
      getElementById: id => vistas[id] || null
    },
    renderSelectoresUnidades: () => {},
    renderUnidadesPersonalizadasConfig: () => {},
    renderGestionNegocio: () => { caja++; },
    renderGestionClientes: () => { clientes++; },
    renderListaClientesVenta: () => { listaVenta++; },
    actualizarCamposCobroVenta: () => { cobro++; }
  };
  vm.createContext(entorno);
  vm.runInContext(gestion.slice(inicio, fin), entorno);
  entorno.aplicarConfiguracionNegocio();
  assert.deepEqual([resumen, caja, clientes, listaVenta, cobro], [0, 0, 0, 0, 0]);

  vistas['main-app'].style.display = 'block';
  entorno.aplicarConfiguracionNegocio();
  assert.deepEqual([resumen, caja, clientes, listaVenta, cobro], [1, 0, 0, 0, 0]);

  vistas['sec-inicio'].style.display = 'none';
  vistas['sec-caja'].style.display = 'block';
  entorno.aplicarConfiguracionNegocio();
  assert.deepEqual([resumen, caja, clientes, listaVenta, cobro], [1, 1, 0, 0, 0]);

  vistas['sec-caja'].style.display = 'none';
  vistas['sec-ajustes'].style.display = 'block';
  vistas['ajuste-clientes'].open = true;
  entorno.aplicarConfiguracionNegocio();
  assert.deepEqual([resumen, caja, clientes, listaVenta, cobro], [1, 1, 1, 0, 0]);

  vistas['sec-ajustes'].style.display = 'none';
  vistas['sec-ventas'].style.display = 'block';
  entorno.aplicarConfiguracionNegocio();
  assert.deepEqual([resumen, caja, clientes, listaVenta, cobro], [1, 1, 1, 1, 1]);

  vistas['sec-ventas'].style.display = 'none';
  vistas['sec-cotizacion'].style.display = 'block';
  entorno.aplicarConfiguracionNegocio();
  assert.deepEqual([resumen, caja, clientes, listaVenta, cobro], [1, 1, 1, 2, 1]);
  assert.match(html, /if\(pestaña === 'cotizacion'\) \{\s*window\.renderListaClientesVenta\?\.\(\)/);
});

test('el resumen muestra los saldos guardados sin construir listas financieras', () => {
  const inicio = finanzas.indexOf('function actualizarResumenFinanzasNegocio()');
  const fin = finanzas.indexOf('function renderFinanzasNegocio()', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const codigo = finanzas.slice(inicio, fin);
  const elementos = new Map();
  const entorno = {
    monedaNegocio: () => 'Q',
    saldosDinero: { efectivo: 123.45, banco: 67.89 },
    clientes: [{ id: 'cliente-1', saldoCredito: 25, archivado: false }],
    creditosPendientesConfirmados: false,
    ventasCreditoPendiente: [],
    ventas: [],
    totalAnticiposPendientes: () => 10,
    core: (() => { const c = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(raiz, 'negocio-core.js'), 'utf8'), c); return c.SubliNegocioCore; })(),
    document: { getElementById: id => {
      if(!elementos.has(id)) elementos.set(id, { textContent: '' });
      return elementos.get(id);
    } },
    renderCreditos: () => { throw new Error('No debe dibujar créditos'); },
    renderMovimientos: () => { throw new Error('No debe dibujar movimientos'); }
  };
  vm.createContext(entorno);
  vm.runInContext(codigo, entorno);
  entorno.actualizarResumenFinanzasNegocio();
  assert.equal(elementos.get('dash-efectivo').textContent, 'Q 123.45');
  assert.equal(elementos.get('dash-banco').textContent, 'Q 67.89');
  assert.equal(elementos.get('dash-total-caja').textContent, 'Q 191.34');
  assert.equal(elementos.get('dash-credito-pendiente').textContent, 'Q 25.00');
  assert.equal(elementos.get('dash-anticipos-pendientes').textContent, 'Q 10.00');
  assert.equal(elementos.get('caja-saldo-efectivo').textContent, 'Q 123.45');
});

test('Firebase y el modo local comparten la lectura por etapas', () => {
  assert.match(html, /await cargarDatosLocales\(\)/);
  assert.match(html, /cargarDatosLocales\(\)\.then\(\(\) =>/);
});
