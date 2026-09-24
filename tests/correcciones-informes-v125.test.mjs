import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = nombre => fs.readFileSync(path.join(raiz, nombre), 'utf8');
const html = leer('index.html');
const tramo = (fuente, desde, hasta) => {
  const inicio = fuente.indexOf(desde);
  const fin = fuente.indexOf(hasta, inicio + desde.length);
  assert.ok(inicio >= 0 && fin > inicio, `No se encontró ${desde}`);
  return fuente.slice(inicio, fin);
};
const dinero = {
  aCentavos: valor => Math.round((Number(valor) || 0) * 100),
  desdeCentavos: valor => valor / 100
};

test('el resumen confirmado consulta todas las páginas del día, ignora anuladas y suma centavos', async () => {
  const ahora = Date.now();
  const documentos = Array.from({ length: 125 }, (_, id) => ({
    id, data: () => ({ timestamp:ahora - 30000, ingresoTotal:10.05, ganancia:6,
      costosProductos:3.03, costoTinta:1.02 })
  }));
  documentos.push({ id:125, data: () => ({ timestamp:ahora - 30000, anulada:true, ingresoTotal:10000 }) });
  const paginas = [], eventos = [];
  const entorno = vm.createContext({
    Date, console:{ warn() {} }, navigator:{ onLine:true }, Event:class { constructor(type) { this.type=type; } },
    SubliNegocioCore:dinero, versionVentasObservadas:0, resumenDiaCargando:false,
    inicioDiaLocal: ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); },
    puedeConsultarFinanzasInteligentes:() => true, actualizarUI:() => eventos.push('render'),
    alert:mensaje => eventos.push(mensaje), setTimeout
  });
  entorno.window = {
    db:{}, subliResumenDiaConfirmado:null,
    where:(campo,operador,valor) => ({ campo, operador, valor }),
    orderBy:(campo,orden) => ({ campo, orden }), limit:cantidad => ({ cantidad }),
    startAfter:ultimo => ({ ultimo }), collection:(_,coleccion) => coleccion,
    query:(_, ...condiciones) => condiciones,
    getDocs:async condiciones => {
      paginas.push(condiciones);
      const inicio = condiciones.some(p => p.ultimo) ? 100 : 0;
      return { metadata:{ fromCache:false, hasPendingWrites:false }, docs:documentos.slice(inicio, inicio + 100) };
    },
    dispatchEvent:evento => eventos.push(evento.type)
  };
  vm.runInContext(tramo(html, 'async function cargarResumenDiaConfirmado()', 'async function cargarVentasAnalisisUltimos30Dias'), entorno);
  assert.equal(await entorno.cargarResumenDiaConfirmado(), true);
  assert.equal(paginas.length, 2);
  assert.equal(paginas[0].filter(p => p.campo === 'timestamp').length, 3);
  assert.ok(paginas[1].some(p => p.ultimo));
  assert.equal(entorno.window.subliResumenDiaConfirmado.operaciones, 125);
  assert.equal(entorno.window.subliResumenDiaConfirmado.ventasHoy, 1256.25);
  assert.equal(entorno.window.subliResumenDiaConfirmado.gastosHoy, 506.25);
  assert.equal(entorno.window.subliResumenDiaConfirmado.utilidadHoy, 750);
  assert.ok(eventos.includes('subli:resumen-dia'));
});

test('el total diario no se confirma sin permiso, con caché ni si cambian las ventas durante la lectura', async () => {
  const alertas = [];
  let permiso = false, caché = false, consultas = 0;
  const entorno = vm.createContext({
    Date, console:{ warn() {} }, navigator:{ onLine:true }, Event:class { constructor(tipo) { this.type=tipo; } },
    SubliNegocioCore:dinero, versionVentasObservadas:0, resumenDiaCargando:false, setTimeout,
    inicioDiaLocal:ts => { const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); },
    puedeConsultarFinanzasInteligentes:() => permiso, actualizarUI:() => {}, alert:m => alertas.push(m)
  });
  entorno.window = {
    db:{}, subliResumenDiaConfirmado:null, where:()=>({}), orderBy:()=>({}), limit:()=>({}),
    startAfter:()=>({}), collection:()=>({}), query:()=>({}), dispatchEvent:()=>{},
    getDocs:async () => {
      consultas++;
      if(!caché) entorno.versionVentasObservadas++;
      return { metadata:{ fromCache:caché, hasPendingWrites:false }, docs:[] };
    }
  };
  vm.runInContext(tramo(html, 'async function cargarResumenDiaConfirmado()', 'async function cargarVentasAnalisisUltimos30Dias'), entorno);
  assert.equal(await entorno.cargarResumenDiaConfirmado(), false);
  assert.equal(consultas, 0);
  permiso = true;
  caché = true;
  assert.equal(await entorno.cargarResumenDiaConfirmado(), false);
  caché = false;
  assert.equal(await entorno.cargarResumenDiaConfirmado(), false);
  assert.equal(entorno.window.subliResumenDiaConfirmado, null);
  assert.equal(alertas.length, 2);
});

test('los paneles y consultas inteligentes respetan el permiso financiero sin ocultar inventario', () => {
  const elementos = Object.fromEntries(['panel-inteligente','contenido-inteligente','consulta-inteligente-contenedor',
    'consulta-inteligente','resultado-consulta-inteligente'].map(id => [id,{ style:{}, innerHTML:'', textContent:'', value:'' }]));
  let permiso=false, analisisLlamadas=0;
  const analisis = {
    agotados:[], stockBajo:[{ nombre:'Tela', stock:0 }], sinCodigo:[], abastecimiento:[],
    resumenHoy:{ operaciones:1, ingreso:100, gastos:40, ganancia:60 },
    resumenMes:{ operaciones:1, ingreso:100, ganancia:60 },
    fondos:{ totalCaja:100, disponibleSinSAT:80, gananciaLibre:50, sat:20 },
    anomalias:{ stockNegativo:[], costosInvalidos:[], codigosDuplicados:[],
      ventasConDiferencia:[], margenesBajos:[] }
  };
  const entorno = vm.createContext({
    Date, document:{ getElementById:id => elementos[id] }, window:{ subliResumenDiaConfirmado:null },
    preferenciasSistema:{ inteligenciaActiva:true }, inventario:[], ventas:[], ventasAnalisis30:[],
    fondos:{}, configuracionNegocio:{ margenObjetivo:30 }, analisisVentas30Completo:true,
    analisisVentas30Cargando:false, fusionarPorId:()=>[], numeroFinito:valor => Number(valor) || 0,
    escaparHTML:valor => String(valor), normalizarTexto:valor => valor.toLowerCase(),
    inicioDiaLocal:ts => { const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); },
    botonAyudaInteligente:() => '', modoModuloInteligente:() => 'ayudar',
    moduloInteligenteActivo:() => true, puedeConsultarFinanzasInteligentes:() => permiso,
    analizarSistemaInteligente:() => { analisisLlamadas++; return analisis; }
  });
  vm.runInContext(tramo(html, 'function renderPanelInteligente()', 'function copiarDatos(objeto)'), entorno);
  entorno.renderPanelInteligente();
  const panel = elementos['contenido-inteligente'].innerHTML;
  assert.match(panel, /Predicción para surtir/);
  assert.doesNotMatch(panel, /Resumen de hoy|Caja y retiro|Precio y margen|margen menor/);
  elementos['consulta-inteligente'].value = 'ventas de hoy';
  entorno.ejecutarConsultaInteligente();
  assert.match(elementos['resultado-consulta-inteligente'].textContent, /no tiene permiso/);
  assert.equal(analisisLlamadas, 1);
  elementos['consulta-inteligente'].value = 'que debo surtir';
  entorno.ejecutarConsultaInteligente();
  assert.match(elementos['resultado-consulta-inteligente'].innerHTML, /Tela/);
  permiso = true;
  entorno.renderPanelInteligente();
  assert.match(elementos['contenido-inteligente'].innerHTML, /Resumen de hoy|Caja y retiro/);
});

test('el asistente y el inicio ocultan prioridades de cobro a empleados sin permiso', () => {
  const fuente = leer('asistente-ajustes-v130.js');
  const entorno = vm.createContext({
    finanzas:() => false, escapar:valor => String(valor), dinero:valor => `Q ${valor}`,
    boton:() => '', pro:{ numero:valor => Number(valor) || 0 }
  });
  vm.runInContext(tramo(fuente, 'function render(r,salida)', 'function instalar()'), entorno);
  const salida = { innerHTML:'' };
  entorno.render({ tipo:'prioridades', filas:[
    { tipo:'cobros', titulo:'Cobrar Q 500', detalle:'Crédito vencido' },
    { tipo:'stock', titulo:'Stock bajo', detalle:'Tela' }
  ] }, salida);
  assert.match(salida.innerHTML, /Stock bajo/);
  assert.doesNotMatch(salida.innerHTML, /Cobrar|Crédito/);
  assert.match(leer('profesional-ui-v130.js'), /prioridades\.filter\(p => fin \|\| p\.tipo !== 'cobros'\)/);
});

test('el módulo de mejoras no interpreta la ausencia de usuario como acceso financiero', () => {
  const fuente = leer('mejoras-v127.js');
  const entorno = vm.createContext({ window:{ SubliMejorasCore:{ puedeVerFinanzas:u => u.rol === 'dueno' } } });
  entorno.global = entorno.window;
  vm.runInContext(tramo(fuente, 'function puedeVerFinanzas()', 'function contextoSeguro()'), entorno);
  assert.equal(entorno.puedeVerFinanzas(), false);
  entorno.currentUserData = { rol:'empleado', permisos:{ verFinanzas:false } };
  assert.equal(entorno.puedeVerFinanzas(), false);
  entorno.currentUserData = { rol:'dueno' };
  assert.equal(entorno.puedeVerFinanzas(), true);
});

test('el resumen de salud usa el día paginado y vuelve a ventas cargadas en otra fecha', () => {
  const entorno = vm.createContext({ console, Date, Math, Number, String, Object, Array, Map, Set });
  entorno.window = entorno;
  vm.runInContext(leer('profesional-core-v130.js'), entorno);
  const ahora = new Date(2026,8,24,12).getTime();
  const resumenDia = { diaInicio:entorno.SubliProfesionalCore.inicioDia(ahora), ventasHoy:1200, utilidadHoy:600 };
  const ventas = Array.from({ length:50 }, (_, id) => ({ id, timestamp:ahora, ingresoTotal:10, ganancia:5 }));
  assert.equal(entorno.SubliProfesionalCore.resumenSalud({ ventas, ahora, resumenDia }).ventasHoy, 1200);
  assert.equal(entorno.SubliProfesionalCore.resumenSalud({ ventas, ahora, resumenDia }).utilidadHoy, 600);
  assert.equal(entorno.SubliProfesionalCore.resumenSalud({ ventas, ahora, resumenDia:{ ...resumenDia, diaInicio:0 } }).ventasHoy, 500);
});

test('el respaldo reduce a tres las lecturas simultáneas sin omitir colecciones', async () => {
  let activas=0, maximo=0;
  const entorno = vm.createContext({
    Date, Math, Number, String, Object, Array, Map, Set, TextEncoder, setTimeout, console,
    crypto:webcrypto, navigator:{ onLine:true }, db:{},
    collection:(_,nombre) => nombre, doc:(_,c,id) => `${c}/${id}`,
    getDocs:async () => {
      activas++; maximo=Math.max(maximo, activas);
      await new Promise(resolve => setTimeout(resolve, 1));
      activas--;
      return { metadata:{ fromCache:false, hasPendingWrites:false }, forEach:() => {} };
    },
    getDoc:async () => ({ metadata:{ fromCache:false, hasPendingWrites:false },
      exists:() => true, data:() => ({ ultimaActualizacion:1 }) })
  });
  entorno.window = entorno;
  vm.runInContext(leer('respaldo-negocio.js').replace('global.SubliRespaldoCoreV4 =',
    'global.__respaldar = construirCopiaSeguridad; global.SubliRespaldoCoreV4 ='), entorno);
  const copia = await entorno.__respaldar();
  assert.equal(Object.keys(copia.colecciones).length, 20);
  assert.ok(maximo <= 3 && maximo >= 2);
});
