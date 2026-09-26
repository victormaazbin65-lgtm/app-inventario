import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inicio = html.indexOf('let inventarioSnapshotAplicado = false;');
const fin = html.indexOf('programarEscuchaFirebase(() => window.onSnapshot(window.query(window.collection(window.db, "ventas")', inicio);
assert.ok(inicio > 0 && fin > inicio);

test('la confirmación de Firebase no recopia inventario, y un vacío confirmado sí sustituye la caché local', () => {
  let recibir;
  let lecturas = 0;
  let guardados = 0;
  const estados = [];
  const contexto = {
    window: { db: {}, collection: (_, nombre) => nombre, onSnapshot: (_, __, fn) => { recibir = fn; } },
    inventario: [{ id: 'respaldo-local' }],
    datosCargadosDeLaNube: false,
    registrarEstadoSincronizacion: (_, snap) => estados.push(snap.metadata.fromCache),
    asegurarServicioCreacion: () => {},
    programarGuardadoSnapshot: () => { guardados++; },
    programarActualizacionSincronizacion: () => {},
    programarEscuchaFirebase: tarea => tarea(),
    console: { warn: () => {} }
  };
  vm.createContext(contexto);
  vm.runInContext(html.slice(inicio, fin), contexto);
  assert.equal(typeof recibir, 'function');

  const crearSnapshot = (registros, fromCache, cambios = registros.length) => ({
    metadata: { fromCache },
    docChanges: () => Array(cambios).fill({}),
    forEach: fn => { lecturas++; registros.forEach(registro => fn({ data: () => registro })); }
  });

  recibir(crearSnapshot([], true, 0));
  assert.equal(contexto.inventario[0].id, 'respaldo-local');
  assert.equal(guardados, 0);

  recibir(crearSnapshot([], false, 0));
  assert.equal(contexto.inventario.length, 0);
  assert.equal(guardados, 1);

  recibir(crearSnapshot([{ id: 'producto-1' }], false, 1));
  assert.equal(contexto.inventario[0].id, 'producto-1');
  const lecturasTrasCambio = lecturas;
  recibir(crearSnapshot([{ id: 'producto-1' }], false, 0));
  assert.equal(lecturas, lecturasTrasCambio);
  assert.equal(guardados, 2);
  assert.deepEqual(estados, [true, false, false, false]);
});
