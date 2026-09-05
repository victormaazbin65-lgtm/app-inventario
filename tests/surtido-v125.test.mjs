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
const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error });
vm.runInContext(coreSource, contexto);
const core = contexto.SubliNegocioCore;
const plano = valor => JSON.parse(JSON.stringify(valor));

test('el plan de surtido calcula una compra mínima que supera la alerta', () => {
  const inventario = [
    { id: 'minimo', nombre: 'Taza', stock: 5, min: 5, costo: 2.5, proveedor: ' Empresa Uno ', unidadId: 'pieza', unidadPaso: 1, unidadDivisible: false },
    { id: 'bajo', nombre: 'Playera', stock: 2, min: 5, costo: 1.25, proveedor: 'empresa   uno', unidadId: 'pieza', unidadPaso: 1, unidadDivisible: false, ventasTotales: 10 },
    { id: 'fraccion', nombre: 'Tinta', stock: 0.4, min: 0.5, costo: 10, proveedor: 'Empresa Dos', unidadId: 'litro', unidadPaso: 0.1, unidadDivisible: true },
    { id: 'sin-proveedor', nombre: 'Papel', stock: 0, min: 0, costo: 'incorrecto', proveedor: 'NO ESPECIFICADO', unidadId: 'pieza' },
    { id: 'suficiente', nombre: 'Vinil', stock: 6, min: 5, costo: 3, proveedor: 'Empresa Dos' },
    { id: 'servicio', nombre: 'Diseño', stock: 0, min: 10, costo: 0, proveedor: 'Interno', isService: true }
  ];
  const copia = plano(inventario);
  const plan = core.crearPlanSurtido(inventario);
  const porId = Object.fromEntries(plan.map(producto => [producto.id, producto]));

  assert.equal(plan.length, 4);
  assert.deepEqual(plano(inventario), copia, 'el cálculo no debe modificar el inventario');
  assert.equal(porId.minimo.cantidadSugerida, 1);
  assert.equal(porId.minimo.stockObjetivo, 6);
  assert.equal(porId.minimo.costoCompraEstimado, 2.5);
  assert.equal(porId.bajo.cantidadSugerida, 4);
  assert.equal(porId.bajo.stockObjetivo, 6);
  assert.equal(porId.bajo.costoCompraEstimado, 5);
  assert.equal(porId.fraccion.cantidadSugerida, 0.2);
  assert.equal(porId.fraccion.stockObjetivo, 0.6);
  assert.equal(porId.fraccion.costoCompraEstimado, 2);
  assert.equal(porId['sin-proveedor'].cantidadSugerida, 1);
  assert.equal(porId['sin-proveedor'].costoCompraEstimado, null);
  assert.equal(porId['sin-proveedor'].proveedorSurtido, core.PROVEEDOR_SIN_ASIGNAR);
});

test('la vista por distribuidor consolida productos y centavos exactamente', () => {
  const plan = core.crearPlanSurtido([
    { id: 'a', nombre: 'A', stock: 1, min: 2, costo: 1.005, proveedor: 'Distribuidora Central', unidadId: 'pieza' },
    { id: 'b', nombre: 'B', stock: 2, min: 2, costo: 2.335, proveedor: 'DISTRIBUIDORA CENTRAL', unidadId: 'pieza' },
    { id: 'c', nombre: 'C', stock: 0, min: 0, costo: 5, proveedor: '', unidadId: 'pieza' }
  ]);
  const grupos = core.agruparPlanSurtido(plan);

  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].proveedor, 'DISTRIBUIDORA CENTRAL');
  assert.equal(grupos[0].cantidadProductos, 2);
  assert.equal(grupos[0].costoCompraEstimado, 4.35);
  assert.equal(grupos[1].proveedor, core.PROVEEDOR_SIN_ASIGNAR);
  assert.equal(grupos[1].agotados, 1);
  assert.equal(grupos[1].costoCompraEstimado, 5);
});

test('estrés de 20000 productos conserva totales por distribuidor', () => {
  const inventario = [];
  let esperadoCentavos = 0;
  for(let indice = 0; indice < 20000; indice++) {
    const costoCentavos = (indice % 997) + 1;
    inventario.push({
      id: `p-${indice}`,
      nombre: `Producto ${indice}`,
      stock: 10,
      min: 10,
      costo: core.desdeCentavos(costoCentavos),
      proveedor: `Empresa ${indice % 40}`,
      unidadId: 'pieza',
      ventasTotales: indice % 200
    });
    esperadoCentavos += costoCentavos;
  }
  const plan = core.crearPlanSurtido(inventario);
  const grupos = core.agruparPlanSurtido(plan);
  const totalCentavos = grupos.reduce((total, grupo) => total + core.aCentavos(grupo.costoCompraEstimado), 0);

  assert.equal(plan.length, 20000);
  assert.equal(grupos.length, 40);
  assert.equal(totalCentavos, esperadoCentavos);
  assert.ok(plan.every(producto => producto.cantidadSugerida === 1 && producto.stockObjetivo === 11));
});

test('Por Surtir permite alternar productos y distribuidores sin escribir datos', () => {
  assert.match(html, /id="surtido-vista"/);
  assert.match(html, /value="productos">Productos/);
  assert.match(html, /value="distribuidores">Distribuidores/);
  assert.match(html, /id="surtido-proveedor"/);
  assert.match(html, /id="surtido-busqueda"/);
  assert.match(html, /function cambiarVistaSurtido/);
  assert.match(html, /SubliNegocioCore\.crearPlanSurtido\(inventario, configuracionNegocio\)/);
  assert.match(html, /SubliNegocioCore\.agruparPlanSurtido/);
  assert.match(html, /localStorage\.setItem\(KEY_VISTA_SURTIDO, vistaSurtido\)/);
  assert.match(html, /Resumen empresas/);
  assert.match(html, /Compra mínima sugerida/);
  assert.match(html, /@media \(max-width: 520px\)[\s\S]*\.supply-toolbar/);
  assert.doesNotMatch(coreSource.slice(coreSource.indexOf('function crearPlanSurtido'), coreSource.indexOf('function validarCliente')), /setDoc|updateDoc|deleteDoc|runTransaction|Firebase/);
});

test('la versión 1.2.5 y la regla de facturación permanecen coordinadas', () => {
  assert.equal(JSON.parse(leer('package.json')).version, '1.2.5');
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.2.5' });
  assert.match(leer('sw.js'), /sublicosturas-v1\.2\.5/);
  assert.match(html, /const APP_VERSION = "1\.2\.5"/);
  assert.match(coreSource, /const tasaSAT = pideFactura \? config\.porcentajeSAT \/ 100 : 0/);
});
