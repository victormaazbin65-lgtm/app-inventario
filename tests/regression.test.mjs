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
const archivosNegocio = ['negocio-core.js', 'gestion-negocio.js', 'finanzas-negocio.js', 'respaldo-negocio.js'];
const scriptsNegocio = archivosNegocio.map(leer);
const coreSource = scriptsNegocio[0];
const codigoClasicoCompleto = [scriptClasico, ...scriptsNegocio].join('\n');

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
  scriptsNegocio.forEach((codigo, indice) => assert.doesNotThrow(() => new Function(codigo), archivosNegocio[indice]));
  assert.doesNotThrow(() => new vm.SourceTextModule(scriptModulo));
  assert.doesNotThrow(() => JSON.parse(leer('manifest.json')));
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.2.4' });
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

test('la medida opcional completa la descripción sin participar en los cálculos', () => {
  const contexto = vm.createContext({ String });
  vm.runInContext(extraerFuncion('descripcionProductoConMedida'), contexto);
  assert.equal(contexto.descripcionProductoConMedida('Taza blanca', '11', 'oz'), 'TAZA BLANCA 11 OZ');
  assert.equal(contexto.descripcionProductoConMedida('Taza blanca 11 oz', '11', 'oz'), 'TAZA BLANCA 11 OZ');
  assert.equal(contexto.descripcionProductoConMedida('Vaso', 'caja de 36', ''), 'VASO CAJA DE 36');
  assert.equal(contexto.descripcionProductoConMedida('Vaso', '', ''), 'VASO');
  assert.match(scriptClasico, /descripcionActualizada[\s\S]*?producto\.nombre = item\.nombreAnterior/);
});

test('sumar y revertir una venta devuelve el resumen mensual al punto inicial', () => {
  const contexto = vm.createContext({ Math, Number, JSON, Error });
  vm.runInContext(coreSource, contexto);
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
  vm.runInContext(coreSource, contexto);
  vm.runInContext(extraerFuncion('calcularDesgloseFinanciero'), contexto);

  const items = [{ nombre: 'Taza', qty: 2, precioCobrado: 50, costoBase: 20 }];
  assert.equal(contexto.calcularDesgloseFinanciero(items, 0, 0, true).impuestoSAT, 5);
  assert.equal(contexto.calcularDesgloseFinanciero(items, 0, 0, false).impuestoSAT, 0);
  assert.equal(contexto.calcularDesgloseFinanciero(items, 0, 0, true, 0, { porcentajeSAT: 12 }).impuestoSAT, 12);
  assert.match(extraerFuncion('calcularDesgloseFinanciero'), /SubliNegocioCore\.calcularDesgloseFinanciero/);
  assert.match(html, /data-porcentaje-sat/);
});

test('ventas y cotizaciones comparten un único desglose de gastos y ganancia', () => {
  const contexto = vm.createContext({ Math, Number, Error, Array, Boolean });
  vm.runInContext(coreSource, contexto);
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
  vm.runInContext(coreSource, contexto);
  vm.runInContext(`
    const ALERTA_MARGEN_MINIMO = 0.10;
    let carritoVentas = [{ tempId: 1, idProd: 'p1', nombre: 'Taza', rol: 'principal', qty: 2, precioCobrado: 50, costoBase: 20, isService: false }];
    let carritoCotizacion = [
      { tempId: 2, idProd: 'p1', nombre: 'Taza', rol: 'principal', qty: 2, precioCobrado: 50, costoBase: 20, isService: false },
      { tempId: 3, idProd: 'p1', nombre: 'Taza', rol: 'material', qty: 3, precioCobrado: 0, costoBase: 20, isService: false }
    ];
    let inventario = [{ id: 'p1', nombre: 'Taza', stock: 4, costo: 20 }];
    ${extraerFuncion('escaparHTML')}
    ${extraerFuncion('redondear')}
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

test('el anticipo acordado solo se vuelve pago al cargar y confirmar la venta', () => {
  const ids = ['venta-tinta', 'venta-mano-obra', 'venta-envio', 'venta-nombre', 'venta-cliente-id', 'venta-nit', 'venta-factura', 'venta-tipo-cobro', 'venta-metodo-pago', 'venta-pago-inicial', 'venta-aplicar-anticipo'];
  const elementos = Object.fromEntries(ids.map(id => [id, { value: '', checked: false }]));
  const contexto = vm.createContext({
    Math, Number, JSON, Date,
    document: { getElementById: id => elementos[id] },
    window: { scrollTo() {} }
  });
  vm.runInContext(coreSource, contexto);
  contexto.SubliNegocioCore = contexto.window.SubliNegocioCore;
  vm.runInContext(`
    let carritoVentas = [];
    let cotizacionOrigenVentaId = null;
    function actualizarCamposCobroVenta() {}
    function renderCarritoVentas() {}
    function cambiarPestaña() {}
    ${extraerFuncion('copiarDatos')}
    ${extraerFuncion('numeroFinito')}
    ${extraerFuncion('aCentavos')}
    ${extraerFuncion('cargarCotizacionEnFormularioVenta')}
  `, contexto);

  contexto.cargarCotizacionEnFormularioVenta({
    detalleItems: [{ idProd: 'p1', qty: 1, precioCobrado: 100, costoBase: 40 }],
    ingresoTotal: 100, anticipoCotizado: 30, metodoAnticipoCotizado: 'transferencia', clienteId: 'c1', clienteNombre: 'ANA', clienteNit: '1'
  }, 'cot-1');
  assert.equal(elementos['venta-tipo-cobro'].value, 'credito');
  assert.equal(elementos['venta-metodo-pago'].value, 'transferencia');
  assert.equal(elementos['venta-pago-inicial'].value, '30');
  assert.equal(elementos['venta-aplicar-anticipo'].value, '0');

  contexto.cargarCotizacionEnFormularioVenta({
    detalleItems: [{ idProd: 'p1', qty: 1, precioCobrado: 100, costoBase: 40 }],
    ingresoTotal: 100, anticipoCotizado: 100, metodoAnticipoCotizado: 'efectivo'
  });
  assert.equal(elementos['venta-tipo-cobro'].value, 'contado');
  assert.equal(elementos['venta-metodo-pago'].value, 'efectivo');
  assert.equal(elementos['venta-pago-inicial'].value, '0');
});

test('estrés matemático: 50000 escenarios conservan las identidades financieras', () => {
  const contexto = vm.createContext({ Math, Number, Error, Array, Boolean });
  vm.runInContext(coreSource, contexto);
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
    assert.equal(contexto.SubliNegocioCore.aCentavos(desglose.impuestoSAT), contexto.SubliNegocioCore.aCentavos(factura ? desglose.ingresoTotal * 0.05 : 0));

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
  vm.runInContext(coreSource, contexto);
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
  const contexto = vm.createContext({ Math, Number, Error, Boolean, String, Object, Array, Map });
  vm.runInContext(coreSource, contexto);
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
  assert.throws(() => contexto.calcularDesgloseRetiroInteligente(0.301, fondos, 'inteligente'), /máximo dos decimales/);

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
  assert.match(scriptClasico, /ventaAnterior\.versionCalculo !== 2/);
  assert.match(scriptClasico, /Number\(registro\.versionCalculo\) < 2/);
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
  assert.equal((funcionRetiro.match(/t\.update\(/g) || []).length, 0);
  assert.equal((funcionRetiro.match(/t\.set\(/g) || []).length, 3);
  assert.doesNotMatch(funcionRetiro, /window\.(?:setDoc|updateDoc|deleteDoc)\(/);
  assert.match(funcionRetiro, /modoRetiro:\s*solicitud\.modo/);
  assert.match(funcionRetiro, /desglose:\s*\{/);
  assert.match(funcionRetiro, /versionCalculo:\s*3/);
  assert.match(funcionRetiro, /Los fondos cambiaron después de la confirmación/);
});

test('los códigos usan bloques de 1000, no se repiten y conservan el bloque al renombrar', () => {
  const contexto = vm.createContext({ Math, Number, Error, String, Object, Array, Set, Map });
  vm.runInContext(`
    const TAMANO_BLOQUE_CATEGORIA = 1000;
    const PRIMER_BLOQUE_CATEGORIA = 1000;
    const MAX_PRODUCTOS_POR_BLOQUE = 999;
    ${extraerFuncion('numeroFinito')}
    ${extraerFuncion('normalizarCategoriaCodigo')}
    ${extraerFuncion('normalizarEstadoCodigosInventario')}
    ${extraerFuncion('asegurarBloqueCategoria')}
    ${extraerFuncion('asignarSiguienteCodigoInventario')}
    ${extraerFuncion('incorporarCodigosExistentes')}
    ${extraerFuncion('renombrarCategoriaEnEstadoCodigos')}
  `, contexto);

  let estado = {};
  const textil = contexto.asegurarBloqueCategoria(estado, 'textil');
  estado = textil.estado;
  const ceramica = contexto.asegurarBloqueCategoria(estado, 'cerámica');
  estado = ceramica.estado;
  assert.equal(textil.bloque, 1000);
  assert.equal(ceramica.bloque, 2000);

  let ocupados = new Set();
  const primero = contexto.asignarSiguienteCodigoInventario(estado, 'TEXTIL', ocupados);
  assert.equal(primero.codigo, 1001);
  assert.equal(primero.bloque, 1000);
  estado = primero.estado;
  ocupados = primero.codigosOcupados;
  const segundo = contexto.asignarSiguienteCodigoInventario(estado, 'TEXTIL', ocupados);
  assert.equal(segundo.codigo, 1002);

  const renombrado = contexto.renombrarCategoriaEnEstadoCodigos(segundo.estado, 'TEXTIL', 'TELAS');
  assert.equal(renombrado.bloques.TELAS, 1000);
  assert.equal(renombrado.bloques.TEXTIL, undefined);
  assert.equal(renombrado.siguientes.TELAS, 1003);

  assert.throws(() => contexto.incorporarCodigosExistentes({}, [
    { id: 'a', categoria: 'A', codigoInventario: 1001 },
    { id: 'b', categoria: 'A', codigoInventario: 1001 }
  ]), /repetido/);
});

test('estrés de códigos: 9990 productos mantienen bloque, capacidad y unicidad', () => {
  const contexto = vm.createContext({ Math, Number, Error, String, Object, Array, Set, Map });
  vm.runInContext(`
    const TAMANO_BLOQUE_CATEGORIA = 1000;
    const PRIMER_BLOQUE_CATEGORIA = 1000;
    const MAX_PRODUCTOS_POR_BLOQUE = 999;
    ${extraerFuncion('numeroFinito')}
    ${extraerFuncion('normalizarCategoriaCodigo')}
    ${extraerFuncion('normalizarEstadoCodigosInventario')}
    ${extraerFuncion('asegurarBloqueCategoria')}
    ${extraerFuncion('asignarSiguienteCodigoInventario')}
  `, contexto);

  let estado = {};
  let ocupados = new Set();
  for(let categoria = 0; categoria < 10; categoria++) {
    const nombre = `CAT-${String(categoria).padStart(2, '0')}`;
    const esperada = (categoria + 1) * 1000;
    for(let producto = 1; producto <= 999; producto++) {
      const asignacion = contexto.asignarSiguienteCodigoInventario(estado, nombre, ocupados);
      assert.equal(asignacion.bloque, esperada);
      assert.equal(asignacion.codigo, esperada + producto);
      estado = asignacion.estado;
      ocupados = asignacion.codigosOcupados;
    }
  }
  assert.equal(ocupados.size, 9990);
  assert.throws(() => contexto.asignarSiguienteCodigoInventario(estado, 'CAT-00', ocupados), /agotó sus 999 códigos/);
});

test('la asignación existente es explícita, transaccional y no altera huellas contables', () => {
  const asignacion = extraerFuncion('asignarCodigosInventarioFaltantes');
  const ingreso = extraerFuncion('procesarIngresoMultiple');
  const reserva = extraerFuncion('reservarCodigoInventarioEnTransaccion');
  const crearCategoria = extraerFuncion('crearCategoriaVacia');
  const renombrarCategoria = extraerFuncion('confirmarRenombrarCat');
  const eliminarCategoria = extraerFuncion('confirmarEliminarCat');
  assert.match(html, /id="btn-asignar-codigos"/);
  assert.match(html, /imprimirEtiquetaProducto/);
  assert.match(html, /Buscar por código, producto o categoría/);
  assert.match(asignacion, /window\.runTransaction/);
  assert.match(asignacion, /codigosInventario:/);
  assert.match(asignacion, /NO cambia existencias, costos, ventas, fondos/);
  assert.doesNotMatch(asignacion, /lastModified\s*:/);
  assert.match(ingreso, /reservarCodigoInventarioEnTransaccion/);
  assert.match(reserva, /codigos_inventario/);
  assert.match(asignacion, /registroCodigosVersion:\s*1/);
  assert.match(ingreso, /t\.update\(configRef, \{ codigosInventario:/);
  [crearCategoria, renombrarCategoria, eliminarCategoria].forEach(funcion => {
    assert.match(funcion, /window\.runTransaction/);
    assert.doesNotMatch(funcion, /window\.(?:setDoc|updateDoc|deleteDoc)\(/);
  });
  assert.doesNotMatch(renombrarCategoria, /lastModified\s*:/);
  assert.doesNotMatch(eliminarCategoria, /lastModified\s*:/);
});

test('la búsqueda incluye código y las etiquetas escapan los datos del producto', () => {
  const contexto = vm.createContext({ Math, Number, Error, String, Object, Array, Set, Map });
  vm.runInContext(`
    const TAMANO_BLOQUE_CATEGORIA = 1000;
    const PRIMER_BLOQUE_CATEGORIA = 1000;
    ${extraerFuncion('normalizarTexto')}
    ${extraerFuncion('busquedaInteligente')}
    ${extraerFuncion('escaparHTML')}
    ${extraerFuncion('normalizarCategoriaCodigo')}
    ${extraerFuncion('esCodigoInventarioValido')}
    ${extraerFuncion('coincideBusquedaProducto')}
    ${extraerFuncion('generarDocumentoEtiquetas')}
  `, contexto);
  const producto = { id: 'p1', codigoInventario: 2007, nombre: '<TAZA & ROJA>', categoria: 'CERÁMICA' };
  assert.equal(contexto.coincideBusquedaProducto(producto, '2007'), true);
  assert.equal(contexto.coincideBusquedaProducto(producto, 'ceramica roja'), true);
  assert.equal(contexto.coincideBusquedaProducto(producto, 'textil'), false);
  assert.equal(contexto.esCodigoInventarioValido(1000), false);
  assert.equal(contexto.esCodigoInventarioValido(0), false);
  assert.equal(contexto.esCodigoInventarioValido(2007), true);
  const etiqueta = contexto.generarDocumentoEtiquetas([producto]);
  assert.match(etiqueta, /2007/);
  assert.match(etiqueta, /&lt;TAZA &amp; ROJA&gt;/);
  assert.doesNotMatch(etiqueta, /<TAZA & ROJA>/);
});

test('el rediseño conserva el modo oscuro e incluye accesibilidad y adaptación móvil', () => {
  assert.match(html, /--bg-color:\s*#070b14/);
  assert.match(html, /backdrop-filter:\s*blur/);
  assert.match(html, /position:\s*sticky/);
  assert.match(html, /@media \(max-width:\s*680px\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.deepEqual(JSON.parse(leer('manifest.json')).theme_color, '#070b14');
});

test('las dos interfaces reutilizan la misma navegación y el celular conserva su diseño', () => {
  assert.match(html, /id="ui-superior"/);
  assert.match(html, /id="ui-lateral"/);
  assert.match(html, /body\.layout-lateral \.tabs/);
  assert.match(html, /@media \(min-width: 900px\)/);
  assert.match(html, /@media \(max-width: 680px\)/);
  assert.equal((html.match(/id="tab-inicio"/g) || []).length, 1);
  assert.equal((html.match(/id="tab-inventario"/g) || []).length, 1);
  assert.equal((html.match(/id="tab-ventas"/g) || []).length, 1);
  assert.match(extraerFuncion('aplicarPreferenciasSistema'), /classList\.toggle\('layout-lateral'/);
});

test('la inteligencia tiene interruptor maestro y control independiente por módulo', () => {
  const modulos = ['alertas', 'abastecimiento', 'precios', 'retiros', 'anomalias', 'cierre', 'busqueda', 'etiquetas'];
  assert.match(html, /id="inteligencia-activa"/);
  modulos.forEach(modulo => {
    assert.match(html, new RegExp(`id="smart-${modulo}"`));
    assert.match(html, new RegExp(`id="smart-${modulo}-modo"`));
  });
  assert.match(extraerFuncion('guardarPreferenciasSistemaDesdeUI'), /localStorage\.setItem\(KEY_PREFERENCIAS_SISTEMA/);
  assert.doesNotMatch(extraerFuncion('guardarPreferenciasSistemaDesdeUI'), /window\.(?:setDoc|updateDoc|deleteDoc|runTransaction)/);
  assert.match(html, /Nunca vende, retira, borra ni cambia existencias por sí solo/);

  const contexto = vm.createContext({ Boolean, Object, Array });
  vm.runInContext([
    extraerFuncion('crearPreferenciasSistemaPorDefecto'),
    extraerFuncion('normalizarPreferenciasSistema')
  ].join('\n'), contexto);
  const normalizadas = contexto.normalizarPreferenciasSistema({
    interfazPc: 'desconocida',
    menuLateral: 'expandido',
    inteligenciaActiva: false,
    modulos: { precios: { activo: false, modo: 'invalido' }, retiros: { activo: true, modo: 'informar' } }
  });
  assert.equal(normalizadas.interfazPc, 'superior');
  assert.equal(normalizadas.menuLateral, 'expandido');
  assert.equal(normalizadas.inteligenciaActiva, false);
  assert.equal(normalizadas.modulos.precios.activo, false);
  assert.equal(normalizadas.modulos.precios.modo, 'ayudar');
  assert.equal(normalizadas.modulos.retiros.modo, 'informar');
});

test('el precio sugerido alcanza el margen objetivo sin cambiar la regla SAT', () => {
  const contexto = vm.createContext({ Math, Number, Error });
  vm.runInContext([
    extraerFuncion('numeroFinito'),
    extraerFuncion('calcularPrecioObjetivoInteligente')
  ].join('\n'), contexto);

  const sinFactura = { costosProductos: 60, costoTinta: 10, costoEnvio: 0, pideFactura: false };
  const conFactura = { ...sinFactura, pideFactura: true };
  assert.equal(contexto.calcularPrecioObjetivoInteligente(sinFactura, 0.30), 100);
  assert.equal(contexto.calcularPrecioObjetivoInteligente(conFactura, 0.30), 107.70);

  for(let costoCentavos = 0; costoCentavos <= 100000; costoCentavos += 37) {
    const costo = costoCentavos / 100;
    for(const factura of [false, true]) {
      const precio = contexto.calcularPrecioObjetivoInteligente({ costosProductos: costo, costoTinta: 0, costoEnvio: 0, pideFactura: factura }, 0.30);
      if(precio === 0) continue;
      const ganancia = precio - costo - (factura ? precio * 0.05 : 0);
      assert.ok((ganancia / precio) >= 0.30 - 1e-12);
    }
  }
});

test('el análisis inteligente detecta surtido, anomalías y cierre sin escribir datos', () => {
  const contexto = vm.createContext({ Math, Number, Error, Array, Boolean, String, Object, Map, Set, Date });
  vm.runInContext(coreSource, contexto);
  vm.runInContext(`
    const ALERTA_MARGEN_MINIMO = 0.10;
    const TAMANO_BLOQUE_CATEGORIA = 1000;
    const PRIMER_BLOQUE_CATEGORIA = 1000;
    ${extraerFuncion('normalizarTexto')}
    ${extraerFuncion('redondear')}
    ${extraerFuncion('numeroFinito')}
    ${extraerFuncion('esCodigoInventarioValido')}
    ${extraerFuncion('inicioDiaLocal')}
    ${extraerFuncion('analizarSistemaInteligente')}
  `, contexto);

  const ahora = new Date(2026, 7, 24, 12, 0, 0).getTime();
  const inventarioPrueba = [
    { id: 'a', nombre: 'Pachón azul', stock: 2, min: 3, costo: 10, codigoInventario: 1001 },
    { id: 'b', nombre: 'Taza', stock: 0, min: 2, costo: 8 },
    { id: 'c', nombre: 'Error', stock: -1, min: 0, costo: 5, codigoInventario: 1001 }
  ];
  const ventasPrueba = [
    { id: 'v1', timestamp: ahora - 1000, ingresoTotal: 100, costosProductos: 40, costoTinta: 10, costoEnvio: 0, impuestoSAT: 5, ganancia: 45, detalleItems: [{ idProd: 'a', nombre: 'Pachón azul', qty: 30 }] },
    { id: 'v2', timestamp: ahora - 86400000, ingresoTotal: 50, costosProductos: 20, costoTinta: 0, costoEnvio: 0, impuestoSAT: 0, ganancia: 50, detalleItems: [{ idProd: 'b', nombre: 'Taza', qty: 2 }] }
  ];
  const fondosPrueba = { costoProducto: 300, costoLuzTinta: 100, gananciaLibre: 200, fondoImpuestos: 50 };
  const copiaAntes = JSON.stringify({ inventarioPrueba, ventasPrueba, fondosPrueba });
  const analisis = contexto.analizarSistemaInteligente(inventarioPrueba, ventasPrueba, fondosPrueba, ahora);

  assert.equal(analisis.agotados.length, 2);
  assert.equal(analisis.stockBajo.length, 3);
  assert.equal(analisis.sinCodigo.length, 1);
  assert.equal(analisis.anomalias.stockNegativo.length, 1);
  assert.deepEqual(Array.from(analisis.anomalias.codigosDuplicados), ['1001']);
  assert.equal(analisis.anomalias.ventasConDiferencia.length, 1);
  assert.equal(analisis.resumenHoy.operaciones, 1);
  assert.equal(analisis.resumenHoy.ganancia, 45);
  assert.equal(analisis.fondos.totalCaja, 650);
  assert.equal(analisis.fondos.disponibleSinSAT, 600);
  assert.equal(analisis.abastecimiento[0].id, 'b');
  assert.equal(JSON.stringify({ inventarioPrueba, ventasPrueba, fondosPrueba }), copiaAntes);
  assert.doesNotMatch(extraerFuncion('analizarSistemaInteligente'), /window\.(?:setDoc|updateDoc|deleteDoc|runTransaction)/);
});

test('PWA usa la misma versión y sus iconos existen', () => {
  const manifest = JSON.parse(leer('manifest.json'));
  assert.match(scriptClasico, /const APP_VERSION = "1\.2\.4"/);
  assert.match(leer('sw.js'), /sublicosturas-v1\.2\.4/);
  assert.match(leer('sw.js'), /\.\/buscador\.js/);
  archivosNegocio.forEach(archivo => assert.match(leer('sw.js'), new RegExp(`\\.\\/${archivo.replace('.', '\\.')}`)));
  for(const icono of manifest.icons) {
    assert.equal(icono.type, 'image/png');
    assert.ok(fs.existsSync(path.join(raiz, icono.src)), `Falta ${icono.src}`);
  }
  assert.ok(fs.existsSync(path.join(raiz, 'apple-touch-icon.png')));
});

test('los importes se contabilizan en centavos y no dejan residuos al revertir', () => {
  const contexto = vm.createContext({ Math, Number, Error, Array, Boolean });
  vm.runInContext(coreSource, contexto);
  vm.runInContext(`
    ${extraerFuncion('aCentavos')}
    ${extraerFuncion('desdeCentavos')}
    ${extraerFuncion('calcularDesgloseFinanciero')}
  `, contexto);
  const venta = contexto.calcularDesgloseFinanciero([{ nombre: 'Prueba', qty: 1, precioCobrado: 100.10, costoBase: 33.37 }], 0.10, 0.20, true);
  const fondos = { costoProducto: 0, costoLuzTinta: 0, gananciaLibre: 0, fondoImpuestos: 0 };
  fondos.costoProducto = contexto.desdeCentavos(contexto.aCentavos(fondos.costoProducto) + contexto.aCentavos(venta.costosProductos));
  fondos.costoProducto = contexto.desdeCentavos(contexto.aCentavos(fondos.costoProducto) - contexto.aCentavos(venta.costosProductos));
  fondos.costoLuzTinta = contexto.desdeCentavos(contexto.aCentavos(venta.costoTinta) - contexto.aCentavos(venta.costoTinta));
  fondos.gananciaLibre = contexto.desdeCentavos(contexto.aCentavos(venta.gananciaNeta) - contexto.aCentavos(venta.gananciaNeta));
  fondos.fondoImpuestos = contexto.desdeCentavos(contexto.aCentavos(venta.impuestoSAT) - contexto.aCentavos(venta.impuestoSAT));
  assert.deepEqual(JSON.parse(JSON.stringify(fondos)), { costoProducto: 0, costoLuzTinta: 0, gananciaLibre: 0, fondoImpuestos: 0 });
});

test('la rueda del mouse no modifica inputs numéricos y conserva el desplazamiento', () => {
  const funcion = extraerFuncion('desactivarRuedaEnCamposNumericos');
  let desenfocado = false;
  const contexto = vm.createContext({});
  vm.runInContext(funcion, contexto);
  contexto.desactivarRuedaEnCamposNumericos({ target: { matches: selector => selector === 'input[type="number"]', blur: () => { desenfocado = true; } } });
  assert.equal(desenfocado, true);
  assert.doesNotMatch(funcion, /preventDefault/);
  assert.match(scriptClasico, /addEventListener\('wheel',\s*desactivarRuedaEnCamposNumericos,\s*\{\s*capture:\s*true,\s*passive:\s*true\s*\}\)/);
});

test('el acceso inicial espera confirmación de Firebase y los usuarios usan revisión transaccional', () => {
  const acceso = extraerFuncion('comprobarIngresoInicialLibre');
  const guardado = extraerFuncion('guardarUsuarios');
  assert.match(acceso, /!dueñosRegistrados\s*&&\s*!configuracionUsuariosConfirmada/);
  assert.match(acceso, /app\.style\.display\s*=\s*'none'/);
  assert.match(guardado, /window\.runTransaction/);
  assert.match(guardado, /usuariosRevision/);
  assert.doesNotMatch(guardado, /\.catch\(e=>\{\}\)/);
});

test('editar una venta crea un borrador y el reemplazo final es atómico', () => {
  const editar = extraerFuncion('editarVenta');
  const procesar = extraerFuncion('procesarVentaMultiple');
  assert.doesNotMatch(editar, /revertirVentaAtomica/);
  assert.match(editar, /ventaEnEdicion\s*=\s*String\(id\)/);
  assert.match(procesar, /ventaEditadaId\s*=\s*ventaEnEdicion/);
  assert.match(procesar, /resumenSinAnterior/);
  assert.match(procesar, /t\.set\(ventaRef,\s*nuevaVenta\)/);
  assert.match(html, /id="aviso-venta-edicion"/);
});

test('el registro permanente evita reutilizar códigos al borrar productos', () => {
  const reserva = extraerFuncion('reservarCodigoInventarioEnTransaccion');
  const borrar = extraerFuncion('borrarProducto');
  assert.match(reserva, /codigos_inventario/);
  assert.match(reserva, /registroSnap\.exists\(\)/);
  assert.match(borrar, /'retirado'/);
  assert.match(borrar, /t\.delete\(productoRef\)/);
});

test('el reporte completo descarga los cuatro historiales y conserva números en Excel', () => {
  const reporte = extraerFuncion('generarReporteExcel');
  ['ventas', 'ingresos', 'cotizaciones', 'retiros'].forEach(tipo => assert.match(reporte, new RegExp(`cargarHistorialCompleto\\('${tipo}'\\)`)));
  ['Ingresos', 'Cotizaciones', 'Clientes', 'Anticipos', 'Préstamos', 'Devoluciones', 'Pérdidas'].forEach(hoja => assert.match(reporte, new RegExp(`['"]${hoja}['"]`)));
  assert.doesNotMatch(reporte, /\.toFixed\(/);
});

test('la copia heredada SUBLI redirige a la aplicación vigente', () => {
  const legacy = leer('SUBLI.html');
  assert.match(legacy, /http-equiv="refresh"[^>]+\.\/index\.html/);
  assert.match(legacy, /window\.location\.replace\('\.\/index\.html'\)/);
});
