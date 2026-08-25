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
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.0.7' });
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
  const formulas = scriptClasico.match(/\*\s*0\.05/g) || [];
  assert.ok(formulas.length >= 5, 'Faltan cálculos SAT esperados');
  assert.match(scriptClasico, /impuestoSAT\s*=\s*pideFactura\s*\?\s*\(ingresoTotal\s*\*\s*0\.05\)\s*:\s*0/);
  assert.match(scriptClasico, /Impuesto SAT \(5%\)/);
});

test('las operaciones críticas no conservan el fallback que escribía parcialmente', () => {
  assert.doesNotMatch(scriptClasico, /Fallback local activado|promesasOffline|usando Fallback/i);
  assert.match(scriptClasico, /venta\.versionCalculo !== 2/);
  assert.match(scriptClasico, /registro\.versionCalculo !== 2/);
  assert.match(scriptClasico, /resumenMensualContabilizado:\s*true/);
  assert.doesNotMatch(scriptClasico, /deleteDoc\(window\.doc\(window\.db,\s*["'](?:ventas|ingresos|cotizaciones|retiros)["']/);
});

test('PWA usa la misma versión y sus iconos existen', () => {
  const manifest = JSON.parse(leer('manifest.json'));
  assert.match(scriptClasico, /const APP_VERSION = "1\.0\.7"/);
  assert.match(leer('sw.js'), /sublicosturas-v1\.0\.7/);
  for(const icono of manifest.icons) {
    assert.equal(icono.type, 'image/png');
    assert.ok(fs.existsSync(path.join(raiz, icono.src)), `Falta ${icono.src}`);
  }
  assert.ok(fs.existsSync(path.join(raiz, 'apple-touch-icon.png')));
});
