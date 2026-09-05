import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error });
vm.runInContext(leer('negocio-core.js'), contexto);
const core = contexto.SubliNegocioCore;

test('los importes con mitad de centavo redondean simétricamente', () => {
  assert.equal(core.aCentavos(1.005), 101);
  assert.equal(core.aCentavos(-1.005), -101);
  assert.equal(core.redondearMoneda(10.075), 10.08);
  assert.equal(core.redondearMoneda(-10.075), -10.08);
  assert.equal(core.aCentavos(45000000000000), 4500000000000000);
  assert.equal(core.redondearCostoUnitario(4500000000), 4500000000);
});

test('las cantidades respetan el paso y el contenido de cada lote', () => {
  const cuarto = core.normalizarConfiguracionNegocio({
    unidadesPersonalizadas: [{ nombre: 'Cuarto', abreviatura: 'cto', divisible: true, paso: 0.25 }]
  }).unidadesPersonalizadas[0];
  assert.equal(core.normalizarCantidad(1.25, cuarto), 1.25);
  assert.throws(() => core.normalizarCantidad(0.1, cuarto), /pasos de 0.25/);
  assert.throws(() => core.normalizarCantidad(1.0001, cuarto), /máximo tres decimales/);
  assert.throws(() => core.calcularIngresoConvertido(2, 0.5, 10, 'total', core.obtenerUnidad('pieza', {})), /cantidades enteras/);
  const pasoInvalido = core.normalizarConfiguracionNegocio({
    unidadesPersonalizadas: [{ nombre: 'Micro', abreviatura: 'mi', divisible: true, paso: 0.0001 }]
  }).unidadesPersonalizadas[0];
  assert.equal(pasoInvalido.paso, 0.01);
});

test('una referencia de línea nunca cambia silenciosamente a otro producto', () => {
  const lineaA = { lineId: 'v1-L001', idProd: 'A', nombre: 'TAZA', unidadId: 'pieza', precioCobrado: 10, costoBase: 5, qty: 1 };
  const lineaB = { lineId: 'v1-L002', idProd: 'B', nombre: 'PLAYERA', unidadId: 'pieza', precioCobrado: 25, costoBase: 12, qty: 1 };
  const referencia = core.crearReferenciaLineaVenta(lineaA, 0);
  assert.equal(core.localizarLineaVenta([lineaA, lineaB], referencia), 0);
  assert.equal(core.localizarLineaVenta([lineaB], referencia), -1);
  assert.equal(core.localizarLineaVenta([lineaB, lineaA], referencia), 1);
  assert.equal(core.localizarLineaVenta([{ ...lineaA, idProd: 'ALTERADO' }], referencia), -1);

  const legado = { idProd: 'A', nombre: 'TAZA', unidadId: 'pieza', precioCobrado: 10, costoBase: 5, qty: 1 };
  const referenciaLegada = core.crearReferenciaLineaVenta(legado, 0);
  assert.equal(core.localizarLineaVenta([lineaB], referenciaLegada), -1);
});

test('las devoluciones fraccionarias cierran exactamente el total original', () => {
  let linea = {
    qty: 1,
    precioCobrado: 10.05,
    costoUnitarioReal: 3.33,
    cantidadOriginalMilesimas: 1000,
    ingresoLineaOriginalCentavos: 1005,
    costoLineaOriginalCentavos: 333
  };
  const primera = core.calcularDevolucionLinea(linea, 0.5);
  linea = { ...linea, qty: primera.cantidadRestante };
  const segunda = core.calcularDevolucionLinea(linea, 0.5);
  assert.deepEqual([primera.ingresoDevueltoCentavos, segunda.ingresoDevueltoCentavos], [503, 502]);
  assert.equal(primera.ingresoDevueltoCentavos + segunda.ingresoDevueltoCentavos, 1005);
  assert.equal(primera.costoDevueltoCentavos + segunda.costoDevueltoCentavos, 333);
});

test('estrés de 100000 líneas: ningún fraccionamiento crea o pierde centavos', () => {
  let semilla = 0x123bca9;
  const siguiente = () => (semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0);
  for (let escenario = 0; escenario < 100000; escenario += 1) {
    const original = 2 + (siguiente() % 4999);
    const totalIngreso = siguiente() % 1000000;
    const totalCosto = siguiente() % 800000;
    const primeraCantidad = 1 + (siguiente() % (original - 1));
    let linea = {
      qty: core.desdeMilesimas(original),
      cantidadOriginalMilesimas: original,
      ingresoLineaOriginalCentavos: totalIngreso,
      costoLineaOriginalCentavos: totalCosto,
      precioCobrado: 0,
      costoUnitarioReal: 0
    };
    const primera = core.calcularDevolucionLinea(linea, core.desdeMilesimas(primeraCantidad));
    linea = { ...linea, qty: primera.cantidadRestante };
    const segunda = core.calcularDevolucionLinea(linea, linea.qty);
    assert.equal(primera.ingresoDevueltoCentavos + segunda.ingresoDevueltoCentavos, totalIngreso);
    assert.equal(primera.costoDevueltoCentavos + segunda.costoDevueltoCentavos, totalCosto);
    assert.equal(segunda.cantidadRestante, 0);
  }
});

test('la devolución transaccional actualiza venta, cliente, caja y resumen', () => {
  const finanzas = leer('finanzas-negocio.js');
  const html = leer('index.html');
  assert.match(finanzas, /if \(venta\.anulada\) throw new Error/);
  assert.match(finanzas, /venta\.revision[\s\S]*preview\.revisionVenta/);
  assert.match(finanzas, /core\.localizarLineaVenta/);
  assert.match(finanzas, /clienteActualizado[\s\S]*saldoCredito/);
  assert.match(finanzas, /reembolso_devolucion/);
  assert.match(finanzas, /No se encontró el resumen mensual asociado/);
  assert.match(html, /cantidadOriginalMilesimas/);
  assert.match(html, /ingresoLineaOriginalCentavos/);
  assert.match(html, /versionCalculo: ventaAnterior \? 2 : 4/);
});

test('el arranque no ejecuta la migración heredada que reemplazaba la configuración', () => {
  const html = leer('index.html');
  assert.doesNotMatch(html, /migrado_v10/);
  assert.doesNotMatch(html, /docViejoRef/);
  assert.match(html, /La migración v10 ya fue retirada/);
});

test('créditos pendientes se consultan sin depender de las últimas 50 ventas', () => {
  const html = leer('index.html');
  const finanzas = leer('finanzas-negocio.js');
  assert.match(html, /window\.where\("saldoPendiente", ">", 0\)/);
  assert.match(finanzas, /creditosPendientesConfirmados \|\| ventasCreditoPendiente\.length \? ventasCreditoPendiente : ventas/);
  assert.match(finanzas, /saldosClientes\.reduce/);
});

test('las reglas nuevas quedan cerradas y vinculadas al UID propietario', () => {
  const reglas = leer('firestore.rules');
  assert.match(reglas, /request\.auth != null/);
  assert.match(reglas, /request\.auth\.uid == authPropietario\(\)\.get\('uid', ''\)/);
  assert.match(reglas, /allow read, write: if esPropietarioAutenticado\(\)/);
  assert.doesNotMatch(reglas, /allow read, write: if true/);
  assert.doesNotMatch(reglas, /request\.auth\.uid == resource\.data/);
});

test('la restauración rechaza esquemas futuros y conteos alterados', () => {
  const respaldo = leer('respaldo-negocio.js');
  assert.match(respaldo, /schemaVersion > 3/);
  assert.match(respaldo, /Number\(copia\.conteos\[coleccion\]\) !== documentos\.length/);
  assert.match(respaldo, /El conteo declarado de \$\{coleccion\} no coincide/);
});

test('la búsqueda grande cede el hilo, limita la vista y cancela resultados obsoletos', () => {
  const buscador = leer('buscador.js');
  assert.match(buscador, /const TAMANO_LOTE = 750/);
  assert.match(buscador, /await new Promise\(resolve => setTimeout\(resolve, 0\)\)/);
  assert.match(buscador, /if\(secuencia !== secuenciaBusqueda\) return null/);
  assert.match(buscador, /buscarArchivosEnLotes\(archivosBuscador, consulta, extension, 150, secuencia\)/);
  assert.match(buscador, /transaccion\.oncomplete[\s\S]*resolve\(resultado\)/);
});

test('la actualización PWA sólo limpia cachés propias y evita ciclos de recarga', () => {
  const html = leer('index.html');
  const sw = leer('sw.js');
  assert.match(html, /names\.filter\(name => name\.startsWith\('sublicosturas-v'\)\)/);
  assert.doesNotMatch(html, /getRegistrations\(\)/);
  assert.doesNotMatch(html, /\.unregister\(\)/);
  assert.match(html, /subli_actualizacion_intentada/);
  assert.match(sw, /response\.ok && tipo\.includes\('text\/html'\)/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
});

test('operaciones sensibles fallan cerradas y los importes exigen centavos válidos', () => {
  const html = leer('index.html');
  const gestion = leer('gestion-negocio.js');
  const finanzas = leer('finanzas-negocio.js');
  assert.match(html, /if \(!currentUserData \|\| currentUserData\.rol !== 'dueno'\) return alert\("No tienes permisos para crear usuarios\."\)/);
  assert.match(html, /if\(pinCrudo\.length < 4\)/);
  assert.match(gestion, /if \(!exigirDueno\('Solo el Dueño puede crear o modificar fichas de clientes\.'/);
  assert.match(finanzas, /function normalizarMontoMoneda\(valor\)/);
  assert.match(finanzas, /return core\.normalizarMontoMoneda\(valor\)/);
  assert.match(leer('negocio-core.js'), /Math\.abs\(numero - normalizado\) > 1e-9/);
});
