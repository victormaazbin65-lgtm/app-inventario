import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const contexto = vm.createContext({
  console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error, JSON
});
contexto.window = contexto;
vm.runInContext(leer('negocio-core.js'), contexto);
const core = contexto.SubliNegocioCore;

test('SAT se aplica únicamente cuando el cliente solicita factura', () => {
  const items = [{ nombre:'Taza 11 oz', qty:2, precioCobrado:30, costoBase:10 }];
  const configuracion = { porcentajeSAT:5 };

  const sinFactura = core.calcularDesgloseFinanciero(items, 1, 0, false, configuracion, 0);
  const conFactura = core.calcularDesgloseFinanciero(items, 1, 0, true, configuracion, 0);

  assert.equal(sinFactura.ingresoTotal, 60);
  assert.equal(conFactura.ingresoTotal, 60);
  assert.equal(sinFactura.costosProductos, 20);
  assert.equal(conFactura.costosProductos, 20);
  assert.equal(sinFactura.impuestoSAT, 0);
  assert.equal(conFactura.impuestoSAT, 3);
  assert.equal(conFactura.gananciaNeta, sinFactura.gananciaNeta - 3);
});

test('la base pública se conserva mientras el build interno avanza a 1.3.1', () => {
  const version = JSON.parse(leer('version.json'));
  const paquete = JSON.parse(leer('package.json'));
  const build = JSON.parse(leer('build-info.json'));

  assert.equal(version.version, '1.2.5');
  assert.equal(paquete.version, '1.2.5');
  assert.equal(build.basePublica, '1.2.5');
  assert.equal(build.build, '1.3.1');
});

test('Chart.js queda fijado y la PWA no precarga el logo JPEG no utilizado', () => {
  const html = leer('index.html');
  const sw = leer('sw.js');

  assert.match(html, /chart\.js@4\.5\.1\/dist\/chart\.umd\.min\.js/);
  assert.doesNotMatch(html, /src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js"/);
  assert.doesNotMatch(sw, /['"]\.\/logo\.jpeg['"]/);
});

test('la auditoría consulta solo actividad reciente y los refrescos respetan visibilidad', () => {
  const ops = leer('profesional-operaciones-v130.js');
  const ui = leer('profesional-ui-v130.js');

  assert.match(ops, /orderBy\('timestamp','desc'\)/);
  assert.match(ops, /limit\(50\)/);
  assert.match(ops, /document\.visibilityState==='hidden'/);
  assert.match(ui, /firmaAgenda/);
  assert.match(ui, /document\.visibilityState!=='hidden'/);
  assert.match(ui, /visibilitychange/);
});
