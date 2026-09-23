import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = nombre => fs.readFileSync(path.join(raiz, nombre), 'utf8');
const html = leer('index.html');

function fragmento(fuente, inicio, fin) {
  const a = fuente.indexOf(inicio);
  const b = fuente.indexOf(fin, a + inicio.length);
  assert.ok(a >= 0 && b > a, `No se encontró el bloque ${inicio}`);
  return fuente.slice(a, b);
}

test('Android no consulta 30 días al arrancar y sí carga todas las páginas a petición', async () => {
  const codigo = fragmento(html,
    'async function cargarVentasAnalisisUltimos30Dias(forzar = false)',
    'async function cambiarLimiteHistorial(tipo)');
  const crear = new Function('window', 'navigator', 'actualizarUI', 'alert', 'console', 'setTimeout',
    `let ventasAnalisis30=[]; let analisisVentas30Completo=false; let analisisVentas30Cargando=false; ${codigo}
     return { cargar:cargarVentasAnalisisUltimos30Dias, estado:()=>({ ventasAnalisis30, analisisVentas30Completo, analisisVentas30Cargando }) };`);
  const documentos = Array.from({ length:250 }, (_, id) => ({ id, data:() => ({ id, timestamp:Date.now() }) }));
  let consultas = 0;
  const ventana = {
    db:{}, collection:() => ({}),
    where:() => ({ tipo:'where' }), orderBy:() => ({ tipo:'orderBy' }),
    limit:n => ({ tipo:'limit', n }), startAfter:doc => ({ tipo:'startAfter', doc }),
    query:(_coleccion, ...condiciones) => ({ condiciones }),
    getDocs:async consulta => {
      consultas++;
      const despues = consulta.condiciones.find(c => c.tipo === 'startAfter')?.doc?.id ?? -1;
      const lote = documentos.slice(despues + 1, despues + 101);
      return { docs:lote, size:lote.length, metadata:{ fromCache:false }, forEach:cb => lote.forEach(cb) };
    }
  };
  const app = crear(ventana, { userAgent:'Android', onLine:true }, () => {}, () => {}, console, cb => cb());
  await app.cargar();
  assert.equal(consultas, 0);
  await app.cargar(true);
  assert.equal(consultas, 3);
  assert.equal(app.estado().ventasAnalisis30.length, 250);
  assert.equal(app.estado().analisisVentas30Completo, true);
});

test('un resultado incompleto de caché no se presenta como análisis completo y permite reintentar', async () => {
  const codigo = fragmento(html,
    'async function cargarVentasAnalisisUltimos30Dias(forzar = false)',
    'async function cambiarLimiteHistorial(tipo)');
  const crear = new Function('window', 'navigator', 'actualizarUI', 'alert', 'console', 'setTimeout',
    `let ventasAnalisis30=[]; let analisisVentas30Completo=false; let analisisVentas30Cargando=false; ${codigo}
     return { cargar:cargarVentasAnalisisUltimos30Dias, estado:()=>({ ventasAnalisis30, analisisVentas30Completo, analisisVentas30Cargando }) };`);
  let soloCache = true;
  const documento = { data:() => ({ id:1 }) };
  const ventana = {
    db:{}, collection:() => ({}), where:() => ({}), orderBy:() => ({}),
    limit:() => ({}), startAfter:() => ({}), query:() => ({}),
    getDocs:async () => ({ docs:[documento], size:1, metadata:{ fromCache:soloCache }, forEach:cb => cb(documento) })
  };
  const app = crear(ventana, { userAgent:'Android', onLine:true }, () => {}, () => {},
    { warn:() => {} }, cb => cb());
  await app.cargar(true);
  assert.equal(app.estado().analisisVentas30Completo, false);
  assert.equal(app.estado().analisisVentas30Cargando, false);
  soloCache = false;
  await app.cargar(true);
  assert.equal(app.estado().analisisVentas30Completo, true);
});

test('una descarga opcional fallida se reintenta sin saltar módulos dependientes', async () => {
  const visual = leer('visual-preferences.js');
  const codigo = fragmento(visual, 'function esperar(ms)', '})();');
  const crear = new Function('document', 'window', 'console', 'setTimeout',
    `${codigo} return { cargarMejoras, estado:()=>({ cargaMejorasIniciada, mejorasCompletas }) };`);
  const elementos = new Map();
  let fallar = true;
  let intentos = 0;
  const documento = {
    getElementById:id => elementos.get(id) || null,
    createElement:() => ({ remove() { elementos.delete(this.id); } }),
    head:{ appendChild(script) {
      elementos.set(script.id, script);
      intentos++;
      if(fallar) { fallar = false; script.onerror(); }
      else script.onload();
    } }
  };
  const app = crear(documento, { addEventListener:() => {} }, { warn:() => {} }, cb => { cb(); return 1; });
  await assert.rejects(app.cargarMejoras(), /Falta el módulo/);
  assert.equal(app.estado().mejorasCompletas, false);
  assert.equal(elementos.size, 0);
  await app.cargarMejoras();
  assert.equal(app.estado().mejorasCompletas, true);
  assert.equal(elementos.size, 14);
  assert.equal(intentos, 15);
});

test('el borrador se guarda al ocultar la pestaña, además del guardado diferido durante edición', () => {
  const codigo = fragmento(leer('profesional-ui-v130.js'),
    'let guardadoBorradorPendiente = null', 'function leerBorrador(tipo)');
  const crear = new Function('document', 'capturarBorradores', 'setTimeout', 'clearTimeout',
    `${codigo} return { programarGuardadoBorrador, guardarBorradoresAlOcultar };`);
  let guardados = 0;
  let tarea = null;
  const documento = { visibilityState:'visible' };
  const app = crear(documento, () => guardados++, cb => { tarea = cb; return 1; }, () => { tarea = null; });
  app.programarGuardadoBorrador({ target:{ closest:selector => selector.includes('#sec-ventas') } });
  assert.equal(guardados, 0);
  tarea();
  assert.equal(guardados, 1);
  documento.visibilityState = 'hidden';
  app.guardarBorradoresAlOcultar();
  assert.equal(guardados, 2);
});

