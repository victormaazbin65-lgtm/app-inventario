import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const html = leer('index.html');
const scriptsInternos = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(coincidencia => !coincidencia[1].includes('src'));
const scriptClasico = scriptsInternos.find(coincidencia => !coincidencia[1].includes('type="module"'))[2];
const scriptModulo = scriptsInternos.find(coincidencia => coincidencia[1].includes('type="module"'))[2];

function extraerFuncion(nombre) {
  const inicio = scriptClasico.indexOf(`function ${nombre}(`);
  assert.notEqual(inicio, -1, `No se encontró ${nombre}`);
  const inicioLlave = scriptClasico.indexOf('{', inicio);
  let profundidad = 0;
  for(let posicion = inicioLlave; posicion < scriptClasico.length; posicion++) {
    if(scriptClasico[posicion] === '{') profundidad++;
    if(scriptClasico[posicion] === '}') {
      profundidad--;
      if(profundidad === 0) return scriptClasico.slice(inicio, posicion + 1);
    }
  }
  throw new Error(`La función ${nombre} no tiene cierre`);
}

test('HTML, JavaScript clásico, módulo y JSON tienen sintaxis válida', () => {
  assert.equal(scriptsInternos.length, 2);
  assert.doesNotThrow(() => new Function(scriptClasico));
  assert.doesNotThrow(() => new vm.SourceTextModule(scriptModulo));
  assert.doesNotThrow(() => JSON.parse(leer('manifest.json')));
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.0.8' });
});

test('no existen identificadores HTML ni funciones globales duplicadas', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(coincidencia => coincidencia[1]);
  const funciones = [...scriptClasico.matchAll(/(?:async\s+)?function\s+([\w$]+)\s*\(/g)].map(coincidencia => coincidencia[1]);
  assert.deepEqual(ids.filter((id, indice) => ids.indexOf(id) !== indice), []);
  assert.deepEqual(funciones.filter((nombre, indice) => funciones.indexOf(nombre) !== indice), []);
});

test('el costo promedio ponderado conserva el valor del inventario', () => {
  const contexto = vm.createContext({ Math, Number, Error });
  vm.runInContext([
    extraerFuncion('numeroFinito'),
    extraerFuncion('calcularCostoPromedioPonderado')
  ].join('\n'), contexto);

  const costo = contexto.calcularCostoPromedioPonderado(10, 5, 5, 8);
  assert.equal(costo, 6);
  assert.equal((15 * costo), (10 * 5) + (5 * 8));
  assert.throws(() => contexto.calcularCostoPromedioPonderado(10, 5, -1, 8));
});

test('sumar y revertir una venta devuelve el resumen mensual al punto inicial', () => {
  const contexto = vm.createContext({ Math, Number, JSON, Error });
  vm.runInContext([
    extraerFuncion('redondear'),
    extraerFuncion('numeroFinito'),
    extraerFuncion('copiarDatos'),
    extraerFuncion('contarArticulosVenta'),
    extraerFuncion('aplicarVentaAResumen')
  ].join('\n'), contexto);

  const base = { totalVendido: 100, ganancia: 30, items: 2, costosMateriales: 50, gastosOperativos: 15, impuestos: 5, mesTexto: 'Agosto 2026' };
  const venta = { ingresoTotal: 80, ganancia: 25, costosProductos: 35, costoTinta: 5, costoEnvio: 10, impuestoSAT: 5, detalleItems: [{ rol: 'principal', qty: 2 }, { rol: 'material', qty: 3 }] };
  const agregado = contexto.aplicarVentaAResumen(base, venta, 1);
  const revertido = contexto.aplicarVentaAResumen(agregado, venta, -1);
  assert.deepEqual(JSON.parse(JSON.stringify(revertido)), base);
});

test('SAT conserva el cálculo existente del cinco por ciento', () => {
  const contexto = vm.createContext({ Math, Number, Error, Array, Boolean });
  vm.runInContext(extraerFuncion('calcularDesgloseFinanciero'), contexto);

  const items = [{ nombre: 'Taza', qty: 2, precioCobrado: 50, costoBase: 20 }];
  assert.equal(contexto.calcularDesgloseFinanciero(items, 0, 0, true).impuestoSAT, 5);
  assert.equal(contexto.calcularDesgloseFinanciero(items, 0, 0, false).impuestoSAT, 0);
  assert.match(extraerFuncion('calcularDesgloseFinanciero'), /impuestoSAT\s*=\s*pideFactura\s*\?\s*\(ingresoTotal\s*\*\s*0\.05\)\s*:\s*0/);
  assert.match(scriptClasico, /Impuesto SAT \(5%\)/);
});

test('ventas y cotizaciones comparten un único desglose de gastos y ganancia', () => {
  const contexto = vm.createContext({ Math, Number, Error, Array, Boolean });
  vm.runInContext(extraerFuncion('calcularDesgloseFinanciero'), contexto);

  const items = [
    { nombre: 'Producto', qty: 2, precioCobrado: 75, costoBase: 30 },
    { nombre: 'Material', qty: 3, precioCobrado: 0, costoBase: 5 }
  ];
  const desglose = contexto.calcularDesgloseFinanciero(items, 10, 12.50, true);
  assert.equal(desglose.ingresoTotal, 150);
  assert.equal(desglose.costosProductos, 75);
  assert.equal(desglose.costoTinta, 10);
  assert.equal(desglose.costoEnvio, 12.50);
  assert.equal(desglose.impuestoSAT, 7.50);
  assert.equal(desglose.totalGastos, 105);
  assert.equal(desglose.gananciaNeta, 45);
  assert.equal(desglose.margen, 0.30);
  assert.throws(() => contexto.calcularDesgloseFinanciero(items, -1, 0, false));
  assert.throws(() => contexto.calcularDesgloseFinanciero([{ ...items[0], qty: 0 }], 0, 0, false));
  assert.throws(() => contexto.calcularDesgloseFinanciero([{ ...items[0], qty: 100, precioCobrado: 1e308 }], 0, 0, false), /demasiado grandes/);

  const usos = scriptClasico.match(/calcularDesgloseFinanciero\(/g) || [];
  assert.ok(usos.length >= 6, 'El cálculo no está centralizado en todos los flujos esperados');
  assert.match(html, /GASTOS TOTALES/);
  assert.match(html, /GANANCIA LIBRE/);
  assert.match(html, /aria-live="polite"/);
});

test('la vista previa cambia al instante al modificar producción, envío o factura', () => {
  const elementos = {
    'lista-carrito-ventas': { innerHTML: '' },
    'venta-factura': { checked: false },
    'venta-tinta': { value: '10' },
    'venta-envio': { value: '5' },
    'venta-total-preview': { innerHTML: '' },
    'lista-carrito-cotizacion': { innerHTML: '' },
    'cotiza-factura': { checked: false },
    'cotiza-tinta': { value: '10' },
    'cotiza-envio': { value: '5' },
    'cotiza-total-preview': { innerHTML: '' }
  };
  const contexto = vm.createContext({
    Math, Number, Error, Array, Boolean, JSON, Map,
    document: { getElementById: id => elementos[id] }
  });
  vm.runInContext(`
    const ALERTA_MARGEN_MINIMO = 0.10;
    let carritoVentas = [{ tempId: 1, idProd: 'p1', nombre: 'Taza', rol: 'principal', qty: 2, precioCobrado: 50, costoBase: 20, isService: false }];
    let carritoCotizacion = [
      { tempId: 2, idProd: 'p1', nombre: 'Taza', rol: 'principal', qty: 2, precioCobrado: 50, costoBase: 20, isService: false },
      { tempId: 3, idProd: 'p1', nombre: 'Taza', rol: 'material', qty: 3, precioCobrado: 0, costoBase: 20, isService: false }
    ];
    let inventario = [{ id: 'p1', nombre: 'Taza', stock: 4, costo: 20 }];
    ${extraerFuncion('escaparHTML')}
    ${extraerFuncion('numeroFinito')}
    ${extraerFuncion('calcularDesgloseFinanciero')}
    ${extraerFuncion('generarHTMLDesgloseFinanciero')}
    ${extraerFuncion('renderCarritoVentas')}
    ${extraerFuncion('renderCarritoCotizacion')}
  `, contexto);

  contexto.renderCarritoVentas();
  assert.match(elementos['venta-total-preview'].innerHTML, /GASTOS TOTALES/);
  assert.match(elementos['venta-total-preview'].innerHTML, /GANANCIA LIBRE<\/span><span>Q 45\.00/);

  elementos['venta-tinta'].value = '20';
  contexto.renderCarritoVentas();
  assert.match(elementos['venta-total-preview'].innerHTML, /GANANCIA LIBRE<\/span><span>Q 35\.00/);

  elementos['venta-factura'].checked = true;
  contexto.renderCarritoVentas();
  assert.match(elementos['venta-total-preview'].innerHTML, /SAT \(5% con factura\)<\/span><span>Q 5\.00/);
  assert.match(elementos['venta-total-preview'].innerHTML, /GANANCIA LIBRE<\/span><span>Q 30\.00/);

  contexto.renderCarritoCotizacion();
  assert.match(elementos['cotiza-total-preview'].innerHTML, /GASTOS TOTALES/);
  assert.match(elementos['lista-carrito-cotizacion'].innerHTML, /Faltan 1 en el total cotizado/);
  assert.match(html, /id="venta-tinta"[^>]+oninput="renderCarritoVentas\(\)"/);
  assert.match(html, /id="venta-envio"[^>]+oninput="renderCarritoVentas\(\)"/);
  assert.match(html, /id="cotiza-tinta"[^>]+oninput="renderCarritoCotizacion\(\)"/);
  assert.match(html, /id="cotiza-envio"[^>]+oninput="renderCarritoCotizacion\(\)"/);
});

test('estrés matemático: 50000 escenarios conservan las identidades financieras', () => {
  const contexto = vm.createContext({ Math, Number, Error, Array, Boolean });
  vm.runInContext([
    extraerFuncion('numeroFinito'),
    extraerFuncion('calcularCostoPromedioPonderado'),
    extraerFuncion('calcularDesgloseFinanciero')
  ].join('\n'), contexto);

  let semilla = 0x5EED1234;
  const aleatorio = () => {
    semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0;
    return semilla / 0x100000000;
  };

  for(let escenario = 0; escenario < 50000; escenario++) {
    const cantidadItems = 1 + Math.floor(aleatorio() * 8);
    const items = [];
    for(let indice = 0; indice < cantidadItems; indice++) {
      items.push({
        nombre: `Artículo ${indice}`,
        qty: 1 + Math.floor(aleatorio() * 100),
        precioCobrado: Math.floor(aleatorio() * 100000) / 100,
        costoBase: Math.floor(aleatorio() * 80000) / 100
      });
    }
    const tinta = Math.floor(aleatorio() * 50000) / 100;
    const envio = Math.floor(aleatorio() * 50000) / 100;
    const factura = aleatorio() >= 0.5;
    const desglose = contexto.calcularDesgloseFinanciero(items, tinta, envio, factura);

    assert.ok(Number.isFinite(desglose.gananciaNeta));
    assert.ok(Math.abs(desglose.totalGastos - (desglose.costosProductos + tinta + envio + desglose.impuestoSAT)) < 1e-7);
    assert.ok(Math.abs(desglose.gananciaNeta - (desglose.ingresoTotal - desglose.totalGastos)) < 1e-7);
    assert.ok(Math.abs(desglose.impuestoSAT - (factura ? desglose.ingresoTotal * 0.05 : 0)) < 1e-7);

    const stockActual = Math.floor(aleatorio() * 10000);
    const cantidadNueva = 1 + Math.floor(aleatorio() * 10000);
    const costoActual = Math.floor(aleatorio() * 100000) / 100;
    const costoNuevo = Math.floor(aleatorio() * 100000) / 100;
    const promedio = contexto.calcularCostoPromedioPonderado(stockActual, costoActual, cantidadNueva, costoNuevo);
    const valorAntes = (stockActual * costoActual) + (cantidadNueva * costoNuevo);
    assert.ok(Math.abs(((stockActual + cantidadNueva) * promedio) - valorAntes) < 1e-6);
  }
});

test('estrés contable: 5000 ventas simuladas se agregan y revierten sin residuo', () => {
  const contexto = vm.createContext({ Math, Number, JSON, Error });
  vm.runInContext([
    extraerFuncion('redondear'),
    extraerFuncion('numeroFinito'),
    extraerFuncion('copiarDatos'),
    extraerFuncion('contarArticulosVenta'),
    extraerFuncion('aplicarVentaAResumen')
  ].join('\n'), contexto);

  const base = { totalVendido: 0, ganancia: 0, items: 0, costosMateriales: 0, gastosOperativos: 0, impuestos: 0, mesTexto: 'Estrés' };
  const ventasSimuladas = [];
  let resumen = base;
  for(let indice = 1; indice <= 5000; indice++) {
    const venta = {
      ingresoTotal: (indice % 997) + 0.25,
      ganancia: (indice % 389) + 0.10,
      costosProductos: (indice % 431) + 0.05,
      costoTinta: (indice % 17) + 0.03,
      costoEnvio: (indice % 23) + 0.02,
      impuestoSAT: indice % 2 === 0 ? ((indice % 997) + 0.25) * 0.05 : 0,
      detalleItems: [{ rol: 'principal', qty: (indice % 7) + 1 }]
    };
    ventasSimuladas.push(venta);
    resumen = contexto.aplicarVentaAResumen(resumen, venta, 1);
  }
  for(let indice = ventasSimuladas.length - 1; indice >= 0; indice--) {
    resumen = contexto.aplicarVentaAResumen(resumen, ventasSimuladas[indice], -1);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(resumen)), base);
});

test('el retiro inteligente distribuye centavos con prioridad y protege SAT', () => {
  const contexto = vm.createContext({ Math, Number, Error });
  vm.runInContext([
    extraerFuncion('aCentavos'),
    extraerFuncion('desdeCentavos'),
    extraerFuncion('calcularDesgloseRetiroInteligente')
  ].join('\n'), contexto);

  const fondos = { gananciaLibre: 1000, costoLuzTinta: 300, costoProducto: 700, fondoImpuestos: 250 };
  const inteligente = contexto.calcularDesgloseRetiroInteligente(1400, fondos, 'inteligente');
  assert.deepEqual(JSON.parse(JSON.stringify(inteligente)), {
    costoProducto: 100,
    costoLuzTinta: 300,
    gananciaLibre: 1000,
    fondoImpuestos: 0,
    total: 1400
  });
  assert.throws(() => contexto.calcularDesgloseRetiroInteligente(2000.01, fondos, 'inteligente'), /sin usar SAT/);

  const ganancia = contexto.calcularDesgloseRetiroInteligente(125.35, fondos, 'ganancia');
  assert.equal(ganancia.gananciaLibre, 125.35);
  assert.equal(ganancia.costoProducto, 0);
  assert.equal(ganancia.fondoImpuestos, 0);

  const total = contexto.calcularDesgloseRetiroInteligente(null, fondos, 'total');
  assert.equal(total.total, 2250);
  assert.equal(total.fondoImpuestos, 250);

  const centavos = contexto.calcularDesgloseRetiroInteligente(0.30, { gananciaLibre: 0.10, costoLuzTinta: 0.20 }, 'inteligente');
  assert.equal(centavos.total, 0.30);
  assert.equal(centavos.gananciaLibre, 0.10);
  assert.equal(centavos.costoLuzTinta, 0.20);

  let semilla = 0xCAFE2026;
  const siguiente = () => {
    semilla = (Math.imul(semilla, 1103515245) + 12345) >>> 0;
    return semilla;
  };
  for(let escenario = 0; escenario < 20000; escenario++) {
    const fondosAleatorios = {
      gananciaLibre: (siguiente() % 1000000) / 100,
      costoLuzTinta: (siguiente() % 1000000) / 100,
      costoProducto: (siguiente() % 1000000) / 100,
      fondoImpuestos: (siguiente() % 1000000) / 100
    };
    const disponibleSinSAT = contexto.aCentavos(fondosAleatorios.gananciaLibre) + contexto.aCentavos(fondosAleatorios.costoLuzTinta) + contexto.aCentavos(fondosAleatorios.costoProducto);
    if(disponibleSinSAT <= 0) continue;
    const solicitadoCentavos = 1 + (siguiente() % disponibleSinSAT);
    const desglose = contexto.calcularDesgloseRetiroInteligente(solicitadoCentavos / 100, fondosAleatorios, 'inteligente');
    assert.equal(contexto.aCentavos(desglose.total), solicitadoCentavos);
    assert.equal(contexto.aCentavos(desglose.fondoImpuestos), 0);
    assert.equal(contexto.aCentavos(desglose.gananciaLibre) + contexto.aCentavos(desglose.costoLuzTinta) + contexto.aCentavos(desglose.costoProducto), solicitadoCentavos);
    assert.ok(contexto.aCentavos(desglose.gananciaLibre) <= contexto.aCentavos(fondosAleatorios.gananciaLibre));
    assert.ok(contexto.aCentavos(desglose.costoLuzTinta) <= contexto.aCentavos(fondosAleatorios.costoLuzTinta));
    assert.ok(contexto.aCentavos(desglose.costoProducto) <= contexto.aCentavos(fondosAleatorios.costoProducto));
  }
});

test('las operaciones críticas no conservan el fallback que escribía parcialmente', () => {
  assert.doesNotMatch(scriptClasico, /Fallback local activado|promesasOffline|usando Fallback/i);
  assert.match(scriptClasico, /venta\.versionCalculo !== 2/);
  assert.match(scriptClasico, /registro\.versionCalculo !== 2/);
  assert.match(scriptClasico, /resumenMensualContabilizado:\s*true/);
  assert.doesNotMatch(scriptClasico, /deleteDoc\(window\.doc\(window\.db,\s*["'](?:ventas|ingresos|cotizaciones|retiros)["']/);
});

test('el retiro inteligente conserva los retiros manuales y escribe un registro con desglose', () => {
  const funcionRetiro = extraerFuncion('procesarRetiroInteligente');
  assert.match(html, /id="btn-retiro-inteligente"/);
  assert.match(scriptClasico, /async function retirarCostoProducto\(/);
  assert.match(scriptClasico, /async function retirarCostoLuz\(/);
  assert.match(scriptClasico, /async function retirarGanancia\(/);
  assert.match(scriptClasico, /async function retirarImpuesto\(/);
  assert.match(funcionRetiro, /window\.runTransaction/);
  assert.equal((funcionRetiro.match(/t\.update\(/g) || []).length, 1);
  assert.equal((funcionRetiro.match(/t\.set\(/g) || []).length, 1);
  assert.doesNotMatch(funcionRetiro, /window\.(?:setDoc|updateDoc|deleteDoc)\(/);
  assert.match(funcionRetiro, /modoRetiro:\s*solicitud\.modo/);
  assert.match(funcionRetiro, /desglose:\s*\{/);
  assert.match(funcionRetiro, /versionCalculo:\s*3/);
  assert.match(funcionRetiro, /Los fondos cambiaron después de la confirmación/);
});

test('PWA usa la misma versión y sus iconos existen', () => {
  const manifest = JSON.parse(leer('manifest.json'));
  assert.match(scriptClasico, /const APP_VERSION = "1\.0\.8"/);
  assert.match(leer('sw.js'), /sublicosturas-v1\.0\.8/);
  for(const icono of manifest.icons) {
    assert.equal(icono.type, 'image/png');
    assert.ok(fs.existsSync(path.join(raiz, icono.src)), `Falta ${icono.src}`);
  }
  assert.ok(fs.existsSync(path.join(raiz, 'apple-touch-icon.png')));
});
