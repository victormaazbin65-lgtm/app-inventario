import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const html = leer('index.html');
const finanzas = leer('finanzas-negocio.js');
const coreSource = leer('negocio-core.js');
const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error });
vm.runInContext(coreSource, contexto);
const core = contexto.SubliNegocioCore;
const plano = valor => JSON.parse(JSON.stringify(valor));
const scriptsInternos = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(coincidencia => !coincidencia[1].includes('src'));
const scriptClasico = scriptsInternos.find(coincidencia => !coincidencia[1].includes('type="module"'))[2];

function extraerFuncion(nombre) {
  const inicio = scriptClasico.indexOf(`function ${nombre}(`);
  assert.notEqual(inicio, -1, `No se encontró ${nombre}`);
  const inicioLlave = scriptClasico.indexOf('{', inicio);
  let profundidad = 0;
  for (let posicion = inicioLlave; posicion < scriptClasico.length; posicion++) {
    if (scriptClasico[posicion] === '{') profundidad++;
    if (scriptClasico[posicion] === '}') {
      profundidad--;
      if (profundidad === 0) return scriptClasico.slice(inicio, posicion + 1);
    }
  }
  throw new Error(`La función ${nombre} no tiene cierre`);
}

test('los importes operativos no aceptan fracciones invisibles de centavo', () => {
  assert.equal(core.normalizarMontoMoneda('10.05'), 10.05);
  assert.equal(core.normalizarMontoMoneda(0, { permitirCero: true }), 0);
  assert.throws(() => core.normalizarMontoMoneda('10.005'), /máximo dos decimales/);
  assert.throws(() => core.normalizarMontoMoneda(0), /mayor que cero/);
  assert.throws(() => core.normalizarMontoMoneda(Number.MAX_VALUE), /demasiado grande/);
  assert.equal(core.normalizarCostoUnitario('0.416667'), 0.416667);
  assert.equal(core.redondearCostoUnitario(1 / 3), 0.333333);
  assert.throws(() => core.normalizarCostoUnitario('0.4166667'), /máximo seis decimales/);
  assert.throws(() => core.normalizarCostoUnitario(-0.01), /no negativo/);
  assert.throws(() => core.normalizarCostoUnitario(Number.MAX_VALUE), /demasiado grande/);
  assert.throws(() => core.calcularDesgloseFinanciero([
    { nombre: 'Extremo', qty: 8, precioCobrado: 0, costoBase: 10000000000000 }
  ], 10000000000000, 10000000000000, false), /gastos son demasiado grandes/);
  assert.match(html, /function redondear\(num\)\s*\{\s*return SubliNegocioCore\.redondearMoneda\(num\)/);
  assert.match(html, /function aCentavos\(valor\)\s*\{\s*return SubliNegocioCore\.aCentavos\(valor\)/);
  assert.doesNotMatch(scriptClasico, /correccionBinaria/);
});

test('el prorrateo acumulado cierra SAT y gastos exactamente en centavos', () => {
  const partes = [33.33, 33.33, 33.34];
  let aplicado = 0;
  let suma = 0;
  for (const parte of partes) {
    const tramo = core.calcularTramoProporcionalMoneda(5, 100, aplicado, parte);
    suma += core.aCentavos(tramo.tramo);
    aplicado = tramo.aplicadoAcumulado;
  }
  assert.equal(suma, 500);
  assert.equal(aplicado, 100);
  assert.deepEqual(plano(core.calcularTramoProporcionalMoneda(5, 100, 50, 50)), {
    tramo: 2.5,
    aplicadoAcumulado: 100,
    restante: 0
  });
});

test('una anulación reconstruye exactamente un cobro mixto por ubicación', () => {
  const pagos = [
    { monto: 30, metodo: 'efectivo', ubicacion: 'efectivo' },
    { monto: 12.34, metodo: 'transferencia', ubicacion: 'banco' },
    { monto: 7.66, metodo: 'deposito', ubicacion: 'banco' }
  ];
  assert.deepEqual(plano(core.calcularReembolsoPagos(pagos, 50)), {
    efectivo: 30,
    banco: 20,
    total: 50
  });
  assert.throws(() => core.calcularReembolsoPagos(pagos, 49.99), /no coincide/);
  assert.throws(() => core.calcularReembolsoPagos([{ monto: -1, metodo: 'efectivo' }], 0), /inválido/);
});

test('una huella contable alterada detiene anulaciones y abonos', () => {
  const huella = { costoProducto: 30, costoLuzTinta: 10, gananciaLibre: 55, fondoImpuestos: 5 };
  assert.deepEqual(plano(core.validarAsignacionFondos(huella, 100)), huella);
  assert.throws(() => core.validarAsignacionFondos({ ...huella, gananciaLibre: 54.99 }, 100), /no coincide/);
  assert.throws(() => core.validarAsignacionFondos({ ...huella, fondoImpuestos: 5.001 }, 100), /fracciones inválidas/);
  assert.throws(() => core.validarAsignacionFondos(null, 100), /no existe o es inválida/);
});

test('estrés acumulativo: 50000 devoluciones segmentadas no dejan residuos', () => {
  let semilla = 0x1245abcd;
  const siguiente = () => {
    semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0;
    return semilla;
  };
  for (let escenario = 0; escenario < 50000; escenario++) {
    const baseCentavos = (siguiente() % 2000000) + 1;
    const totalCentavos = siguiente() % 300000;
    const cortes = new Set([0, baseCentavos]);
    const cantidadCortes = Math.min(2 + (siguiente() % 7), Math.max(0, baseCentavos - 1));
    while (cortes.size < cantidadCortes + 2) cortes.add(siguiente() % (baseCentavos + 1));
    const ordenados = [...cortes].sort((a, b) => a - b);
    let aplicadoCentavos = 0;
    let distribuidoCentavos = 0;
    let ultimo;
    for (let indice = 1; indice < ordenados.length; indice++) {
      const tramoCentavos = ordenados[indice] - ordenados[indice - 1];
      if (tramoCentavos === 0) continue;
      ultimo = core.calcularTramoProporcionalMoneda(
        core.desdeCentavos(totalCentavos),
        core.desdeCentavos(baseCentavos),
        core.desdeCentavos(aplicadoCentavos),
        core.desdeCentavos(tramoCentavos)
      );
      aplicadoCentavos += tramoCentavos;
      distribuidoCentavos += core.aCentavos(ultimo.tramo);
    }
    assert.equal(aplicadoCentavos, baseCentavos);
    assert.equal(distribuidoCentavos, totalCentavos);
    assert.equal(core.aCentavos(ultimo.restante), 0);
  }
});

test('estrés de 50000 historiales mixtos conserva efectivo, banco y total', () => {
  let semilla = 0x51f15e;
  const siguiente = () => {
    semilla = (Math.imul(semilla, 1103515245) + 12345) >>> 0;
    return semilla;
  };
  for (let escenario = 0; escenario < 50000; escenario++) {
    const pagos = [];
    let efectivo = 0;
    let banco = 0;
    const cantidad = 1 + (siguiente() % 6);
    for (let indice = 0; indice < cantidad; indice++) {
      const montoCentavos = siguiente() % 100000;
      const metodo = siguiente() % 2 ? 'efectivo' : (siguiente() % 2 ? 'transferencia' : 'deposito');
      const ubicacion = metodo === 'efectivo' ? 'efectivo' : 'banco';
      pagos.push({ monto: core.desdeCentavos(montoCentavos), metodo, ubicacion });
      if (ubicacion === 'efectivo') efectivo += montoCentavos;
      else banco += montoCentavos;
    }
    const resultado = core.calcularReembolsoPagos(pagos, core.desdeCentavos(efectivo + banco));
    assert.deepEqual(plano(resultado), {
      efectivo: core.desdeCentavos(efectivo),
      banco: core.desdeCentavos(banco),
      total: core.desdeCentavos(efectivo + banco)
    });
  }
});

test('las devoluciones corrigen métricas aunque el producto no vuelva al inventario', () => {
  assert.match(finanzas, /if \(!item\.isService && productoSnap\?\.exists\(\)\)[\s\S]*ventasTotales/);
  assert.match(finanzas, /calcularTramoProporcionalMoneda/);
  assert.match(finanzas, /impuestoSATNuevo/);
  assert.match(finanzas, /impuestoReversado/);
});

test('la anulación falla cerrada ante cambios concurrentes o devoluciones parciales', () => {
  assert.match(html, /revisionEsperada/);
  assert.match(html, /venta\.revision[\s\S]*revisionEsperada/);
  assert.match(html, /devoluciones parciales[\s\S]*Caja/);
  assert.match(html, /calcularReembolsoPagos/);
  assert.match(html, /movimientosReembolso/);
  assert.match(html, /No se pudo identificar el resumen mensual de esta venta/);
  assert.match(html, /validarAsignacionFondos/);
});

test('Opciones permite alternar el modelo profesional y el clásico sin tocar datos', () => {
  assert.match(html, /id="modelo-visual-profesional"/);
  assert.match(html, /id="modelo-visual-clasico"/);
  assert.match(html, /modeloVisual:\s*'profesional'/);
  assert.match(html, /\['profesional', 'clasico'\]\.includes\(entrada\.modeloVisual\)/);
  assert.match(html, /document\.documentElement\.dataset\.modeloVisual/);
  assert.match(html, /html\[data-modelo-visual="profesional"\]/);
  assert.match(html, /Solo cambia la apariencia; no modifica datos, cálculos ni permisos/);
  assert.match(html, /localStorage\.setItem\(KEY_PREFERENCIAS_SISTEMA/);
  assert.match(leer('sw.js'), /\.\/visual-preferences\.js/);
});

test('la preferencia visual temprana se aplica sin red ni escritura remota', () => {
  const fuente = leer('visual-preferences.js');
  const documento = { documentElement: { dataset: {} } };
  vm.runInNewContext(fuente, {
    document: documento,
    localStorage: { getItem: () => JSON.stringify({ modeloVisual: 'clasico' }) }
  });
  assert.equal(documento.documentElement.dataset.modeloVisual, 'clasico');
  assert.doesNotMatch(fuente, /fetch|Firebase|setDoc|updateDoc|runTransaction/);
});

test('las salidas HTML de unidad y moneda quedan neutralizadas', () => {
  assert.match(finanzas, /escaparHTML\(etiquetaUnidadProducto\(p, p\.stock\)\)/);
  assert.match(coreSource, /function normalizarSimboloMoneda/);
  assert.equal(core.normalizarConfiguracionNegocio({ moneda: '<img>' }).moneda, 'img');
});

test('cantidades de servicio y mensajes de margen usan las reglas configuradas', () => {
  assert.match(html, /normalizarCantidadServicio/);
  assert.doesNotMatch(html, /margen menor al 10%/);
  assert.match(html, /margen menor al \$\{margenObjetivoTexto\}%/);
});

test('los cuatro retiros clásicos y el inteligente rechazan fracciones de centavo', () => {
  assert.match(html, /async function retirarCostoProducto\(\)/);
  assert.match(html, /async function retirarCostoLuz\(\)/);
  assert.match(html, /async function retirarGanancia\(\)/);
  assert.match(html, /async function retirarImpuesto\(\)/);
  assert.match(html, /solicitarRetiroDesdeCampo[\s\S]*normalizarMontoMoneda\(campo\.value\)/);
  assert.match(html, /calcularDesgloseRetiroInteligente[\s\S]*normalizarMontoMoneda\(montoSolicitado\)/);
});

test('venta y cotización validan pagos, anticipos, precios y gastos en el núcleo monetario', () => {
  assert.match(html, /pagoInicialSolicitado = SubliNegocioCore\.normalizarMontoMoneda/);
  assert.match(html, /anticipoSolicitado = SubliNegocioCore\.normalizarMontoMoneda/);
  assert.match(html, /item\.precioCobrado = SubliNegocioCore\.normalizarMontoMoneda/);
  assert.match(html, /anticipoCotizado = SubliNegocioCore\.normalizarMontoMoneda/);
});

test('fechas inválidas no pueden crear meses ni HTML en los filtros', () => {
  const contextoFecha = vm.createContext({ Number, String, Date, RegExp });
  vm.runInContext([
    extraerFuncion('getMesAnioFromDate'),
    extraerFuncion('formatearMesAnio')
  ].join('\n'), contextoFecha);
  assert.equal(contextoFecha.getMesAnioFromDate('05/09/2026', null), '2026-09');
  assert.equal(contextoFecha.getMesAnioFromDate('09/31/2026', null), null);
  assert.equal(contextoFecha.getMesAnioFromDate('<img>/13/2026', null), null);
  assert.equal(contextoFecha.formatearMesAnio('2026-09'), 'Septiembre 2026');
  assert.equal(contextoFecha.formatearMesAnio('2026-13<script>'), '');
  assert.match(html, /const fechaContable = ventaAnterior \? ventaAnterior\.timestamp : timestampActual/);
  assert.match(html, /timestamp: ventaAnterior \? \(ventaAnterior\.timestamp \?\? null\) : timestampActual/);
  assert.match(html, /if\(!mesAnio\) throw new Error\('No se pudo identificar el mes contable; la venta no se modificó\.'/);
  assert.match(html, /if\(ventaAnterior && !resumenSnap\.exists\(\)\) throw new Error\('No se encontró el resumen mensual original/);
  assert.doesNotMatch(html, /getMesAnioFromDate\(ventaAnterior\?\.fecha \|\| '', fechaContable\) \|\| \(new Date/);
});

test('la versión profesional mantiene coordinados aplicación y caché', () => {
  assert.equal(JSON.parse(leer('package.json')).version, '1.2.4');
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.2.4' });
  assert.match(leer('sw.js'), /sublicosturas-v1\.2\.4/);
  assert.match(html, /const APP_VERSION = "1\.2\.4"/);
});
