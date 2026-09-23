import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const gestion = fs.readFileSync(path.join(raiz, 'gestion-negocio.js'), 'utf8');

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

test('la configuración no dibuja listas de caja ni clientes mientras el PIN está visible', () => {
  const inicio = gestion.indexOf('function aplicarConfiguracionNegocio()');
  const fin = gestion.indexOf('async function guardarConfiguracionNegocio', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const app = { style: { display: 'none' } };
  const caja = { style: { display: 'none' } };
  let renders = 0;
  const entorno = {
    core: { normalizarConfiguracionNegocio: valor => valor },
    configuracionNegocio: {
      nombreNegocio: 'SubliCosturas', moneda: 'Q', porcentajeSAT: 5,
      nombreFondoProduccion: 'Producción', nombreManoObra: 'Mano de obra',
      authPropietario: { habilitado: false, email: '' }
    },
    document: {
      title: '',
      querySelectorAll: () => [],
      getElementById: id => id === 'main-app' ? app : id === 'sec-caja' ? caja : null
    },
    renderSelectoresUnidades: () => {},
    renderUnidadesPersonalizadasConfig: () => {},
    renderGestionNegocio: () => { renders += 1; }
  };
  vm.createContext(entorno);
  vm.runInContext(gestion.slice(inicio, fin), entorno);
  entorno.aplicarConfiguracionNegocio();
  app.style.display = 'block';
  entorno.aplicarConfiguracionNegocio();
  assert.equal(renders, 0);
  caja.style.display = 'block';
  entorno.aplicarConfiguracionNegocio();
  assert.equal(renders, 1);
});

test('Firebase y el modo local comparten la lectura por etapas', () => {
  assert.match(html, /await cargarDatosLocales\(\)/);
  assert.match(html, /cargarDatosLocales\(\)\.then\(\(\) =>/);
});
