const BUSCADOR_DB = 'sublicosturas-buscador';
const BUSCADOR_DB_VERSION = 1;
const BUSCADOR_STORE = 'datos';
const MAX_ARCHIVOS_BUSCADOR = 50000;
const MAX_PROFUNDIDAD_BUSCADOR = 30;

const GRUPOS_SINONIMOS = [
  ['pachon', 'pachones', 'botella', 'botellas', 'termo', 'termos'],
  ['playera', 'playeras', 'camiseta', 'camisetas', 'camisa', 'camisas'],
  ['mousepad', 'alfombrilla', 'alfombrillas', 'pad'],
  ['taza', 'tazas', 'mug', 'mugs'],
  ['llavero', 'llaveros'],
  ['perro', 'perros', 'canino', 'caninos', 'mascota', 'mascotas'],
  ['logo', 'logos', 'logotipo', 'logotipos'],
  ['vaso', 'vasos', 'tomatodo', 'tomatodos']
];

const SINONIMOS = new Map();
GRUPOS_SINONIMOS.forEach(grupo => {
  const normalizado = grupo.map(valor => normalizarTextoBusqueda(valor));
  normalizado.forEach(valor => SINONIMOS.set(valor, normalizado));
});

let carpetaBuscador = null;
let archivosBuscador = [];
let escaneoBuscadorActivo = false;
let temporizadorBusqueda = null;
let secuenciaBusqueda = 0;

export function normalizarTextoBusqueda(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/mouse\s+pad/g, 'mousepad')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extensionArchivo(nombre) {
  const limpio = String(nombre ?? '').trim();
  const posicion = limpio.lastIndexOf('.');
  return posicion > 0 && posicion < limpio.length - 1 ? limpio.slice(posicion + 1).toLowerCase() : '';
}

function variantesTermino(termino) {
  const variantes = new Set([termino]);
  const grupo = SINONIMOS.get(termino);
  if(grupo) grupo.forEach(valor => variantes.add(valor));
  if(termino.length > 4 && termino.endsWith('s')) variantes.add(termino.slice(0, -1));
  return [...variantes];
}

export function distanciaEdicionLimitada(a, b, limite = 2) {
  const izquierda = String(a ?? '');
  const derecha = String(b ?? '');
  if(izquierda === derecha) return 0;
  if(Math.abs(izquierda.length - derecha.length) > limite) return limite + 1;
  let anterior = Array.from({ length: derecha.length + 1 }, (_, indice) => indice);
  for(let i = 1; i <= izquierda.length; i++) {
    const actual = [i];
    let minimoFila = actual[0];
    for(let j = 1; j <= derecha.length; j++) {
      const costo = izquierda[i - 1] === derecha[j - 1] ? 0 : 1;
      actual[j] = Math.min(actual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + costo);
      minimoFila = Math.min(minimoFila, actual[j]);
    }
    if(minimoFila > limite) return limite + 1;
    anterior = actual;
  }
  return anterior[derecha.length];
}

function puntuarTerminoEnCampo(campo, palabras, variantes, peso) {
  let mejor = -1;
  variantes.forEach(variante => {
    if(campo === variante) mejor = Math.max(mejor, peso + 24);
    else if(campo.includes(variante)) mejor = Math.max(mejor, peso);
    else if(variante.length >= 3 && palabras.some(palabra => palabra.startsWith(variante) || variante.startsWith(palabra))) mejor = Math.max(mejor, Math.round(peso * .72));
    else if(variante.length >= 4) {
      const limite = variante.length >= 8 ? 2 : 1;
      if(palabras.some(palabra => palabra.length >= 4 && distanciaEdicionLimitada(variante, palabra, limite) <= limite)) {
        mejor = Math.max(mejor, Math.round(peso * .48));
      }
    }
  });
  return mejor;
}

export function crearEntradaBuscador(datos) {
  const nombre = String(datos?.nombre ?? '');
  const rutaRelativa = String(datos?.rutaRelativa ?? nombre);
  const carpetas = Array.isArray(datos?.carpetas) ? datos.carpetas.map(String) : [];
  const nombreNormalizado = normalizarTextoBusqueda(nombre.replace(/\.[^.]+$/, ''));
  const carpetasNormalizadas = normalizarTextoBusqueda(carpetas.join(' '));
  const rutaNormalizada = normalizarTextoBusqueda(rutaRelativa);
  return {
    id: String(datos?.id ?? rutaRelativa),
    nombre,
    rutaRelativa,
    carpetas,
    extension: extensionArchivo(nombre),
    tamano: Number(datos?.tamano) || 0,
    modificado: Number(datos?.modificado) || 0,
    nombreNormalizado,
    carpetasNormalizadas,
    rutaNormalizada
  };
}

export function puntuarArchivoBuscador(archivo, consulta) {
  const consultaNormalizada = normalizarTextoBusqueda(consulta);
  if(!consultaNormalizada) return 1;
  const terminos = consultaNormalizada.split(' ').filter(Boolean);
  const nombre = archivo.nombreNormalizado || normalizarTextoBusqueda(String(archivo.nombre || '').replace(/\.[^.]+$/, ''));
  const carpetas = archivo.carpetasNormalizadas || normalizarTextoBusqueda((archivo.carpetas || []).join(' '));
  const ruta = archivo.rutaNormalizada || normalizarTextoBusqueda(archivo.rutaRelativa);
  const palabrasNombre = nombre.split(' ').filter(Boolean);
  const palabrasCarpetas = carpetas.split(' ').filter(Boolean);
  const palabrasRuta = ruta.split(' ').filter(Boolean);
  let total = 0;

  if(nombre === consultaNormalizada) total += 180;
  else if(nombre.includes(consultaNormalizada)) total += 90;
  if(carpetas.includes(consultaNormalizada)) total += 55;

  for(const termino of terminos) {
    const variantes = variantesTermino(termino);
    const enNombre = puntuarTerminoEnCampo(nombre, palabrasNombre, variantes, 42);
    const enCarpetas = puntuarTerminoEnCampo(carpetas, palabrasCarpetas, variantes, 27);
    const enRuta = puntuarTerminoEnCampo(ruta, palabrasRuta, variantes, 18);
    const enExtension = variantes.includes(String(archivo.extension || '').toLowerCase()) ? 30 : -1;
    const mejor = Math.max(enNombre, enCarpetas, enRuta, enExtension);
    if(mejor < 0) return -1;
    total += mejor;
  }
  return total || 1;
}

export function buscarArchivosInteligente(archivos, consulta = '', extension = '') {
  const filtroExtension = String(extension || '').toLowerCase();
  return (Array.isArray(archivos) ? archivos : [])
    .filter(archivo => !filtroExtension || archivo.extension === filtroExtension)
    .map(archivo => ({ archivo, puntuacion: puntuarArchivoBuscador(archivo, consulta) }))
    .filter(resultado => resultado.puntuacion >= 0)
    .sort((a, b) => b.puntuacion - a.puntuacion || Number(b.archivo.modificado || 0) - Number(a.archivo.modificado || 0) || String(a.archivo.nombre).localeCompare(String(b.archivo.nombre)))
    .map(resultado => resultado.archivo);
}

function compararResultadosBuscador(a, b) {
  return b.puntuacion - a.puntuacion
    || Number(b.archivo.modificado || 0) - Number(a.archivo.modificado || 0)
    || String(a.archivo.nombre).localeCompare(String(b.archivo.nombre));
}

async function buscarArchivosEnLotes(archivos, consulta, extension, limite, secuencia) {
  const fuente = Array.isArray(archivos) ? archivos : [];
  const filtroExtension = String(extension || '').toLowerCase();
  let total = 0;
  let mejores = [];
  const TAMANO_LOTE = 750;
  for(let inicio = 0; inicio < fuente.length; inicio += TAMANO_LOTE) {
    if(secuencia !== secuenciaBusqueda) return null;
    const fin = Math.min(fuente.length, inicio + TAMANO_LOTE);
    for(let indice = inicio; indice < fin; indice += 1) {
      const archivo = fuente[indice];
      if(filtroExtension && archivo.extension !== filtroExtension) continue;
      const puntuacion = puntuarArchivoBuscador(archivo, consulta);
      if(puntuacion < 0) continue;
      total += 1;
      mejores.push({ archivo, puntuacion });
    }
    if(mejores.length > limite * 2) mejores = mejores.sort(compararResultadosBuscador).slice(0, limite);
    if(fin < fuente.length) await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { total, archivos: mejores.sort(compararResultadosBuscador).slice(0, limite).map(resultado => resultado.archivo) };
}

function abrirBaseBuscador() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(BUSCADOR_DB, BUSCADOR_DB_VERSION);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      if(!db.objectStoreNames.contains(BUSCADOR_STORE)) db.createObjectStore(BUSCADOR_STORE, { keyPath: 'clave' });
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function operarBaseBuscador(modo, operacion) {
  const db = await abrirBaseBuscador();
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(BUSCADOR_STORE, modo);
    const solicitud = operacion(transaccion.objectStore(BUSCADOR_STORE));
    let resultado;
    solicitud.onsuccess = () => { resultado = solicitud.result; };
    solicitud.onerror = () => reject(solicitud.error);
    transaccion.oncomplete = () => { db.close(); resolve(resultado); };
    transaccion.onabort = () => { db.close(); reject(transaccion.error); };
    transaccion.onerror = () => { db.close(); reject(transaccion.error); };
  });
}

const leerDatoBuscador = clave => operarBaseBuscador('readonly', store => store.get(clave));
const guardarDatoBuscador = (clave, valor) => operarBaseBuscador('readwrite', store => store.put({ clave, valor }));
const limpiarDatosBuscador = () => operarBaseBuscador('readwrite', store => store.clear());

async function permisoCarpetaBuscador(handle, solicitar = false) {
  if(!handle) return false;
  const opciones = { mode: 'read' };
  if(typeof handle.queryPermission !== 'function') return true;
  if((await handle.queryPermission(opciones)) === 'granted') return true;
  return Boolean(solicitar && typeof handle.requestPermission === 'function' && (await handle.requestPermission(opciones)) === 'granted');
}

function elementoBuscador(id) {
  return typeof document === 'undefined' ? null : document.getElementById(id);
}

function actualizarEstadoBuscador(mensaje, tipo = '') {
  const estado = elementoBuscador('buscador-estado');
  if(!estado) return;
  estado.textContent = mensaje;
  estado.dataset.tipo = tipo;
}

function formatoTamanoBuscador(bytes) {
  const valor = Number(bytes) || 0;
  if(valor < 1024) return `${valor} B`;
  if(valor < 1024 ** 2) return `${(valor / 1024).toFixed(1)} KB`;
  if(valor < 1024 ** 3) return `${(valor / 1024 ** 2).toFixed(1)} MB`;
  return `${(valor / 1024 ** 3).toFixed(1)} GB`;
}

function rutaVisibleBuscador(archivo) {
  return [carpetaBuscador?.name, archivo.rutaRelativa].filter(Boolean).join('\\');
}

function renderExtensionesBuscador() {
  const select = elementoBuscador('buscador-extension');
  if(!select) return;
  const seleccion = select.value;
  const extensiones = [...new Set(archivosBuscador.map(archivo => archivo.extension).filter(Boolean))].sort();
  select.replaceChildren();
  const todas = document.createElement('option');
  todas.value = '';
  todas.textContent = 'Todos los formatos';
  select.append(todas);
  extensiones.forEach(extension => {
    const option = document.createElement('option');
    option.value = extension;
    option.textContent = `.${extension}`;
    select.append(option);
  });
  if(extensiones.includes(seleccion)) select.value = seleccion;
}

function crearResultadoBuscador(archivo) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'buscador-resultado';

  const icono = document.createElement('div');
  icono.className = 'buscador-tipo';
  icono.textContent = archivo.extension ? archivo.extension.toUpperCase().slice(0, 5) : 'FILE';

  const contenido = document.createElement('div');
  contenido.className = 'buscador-resultado-info';
  const titulo = document.createElement('h4');
  titulo.textContent = archivo.nombre;
  const ruta = document.createElement('p');
  ruta.className = 'buscador-ruta';
  ruta.textContent = rutaVisibleBuscador(archivo);
  const detalle = document.createElement('small');
  const fecha = archivo.modificado ? new Date(archivo.modificado).toLocaleDateString('es-GT') : 'Fecha desconocida';
  detalle.textContent = `${formatoTamanoBuscador(archivo.tamano)} · ${fecha}`;
  contenido.append(titulo, ruta, detalle);

  const acciones = document.createElement('div');
  acciones.className = 'buscador-acciones';
  const copiar = document.createElement('button');
  copiar.type = 'button';
  copiar.className = 'btn-sm btn-label';
  copiar.textContent = '📋 Copiar ubicación';
  copiar.addEventListener('click', () => copiarUbicacionBuscador(archivo.id));
  acciones.append(copiar);
  tarjeta.append(icono, contenido, acciones);
  return tarjeta;
}

export async function renderBuscadorDisenos() {
  const resultados = elementoBuscador('buscador-resultados');
  const contador = elementoBuscador('buscador-contador');
  if(!resultados || !contador) return;
  const consulta = elementoBuscador('buscador-consulta')?.value || '';
  const extension = elementoBuscador('buscador-extension')?.value || '';
  const secuencia = ++secuenciaBusqueda;
  contador.textContent = archivosBuscador.length > 2000 ? 'Buscando sin bloquear la pantalla…' : 'Buscando…';
  const coincidencias = await buscarArchivosEnLotes(archivosBuscador, consulta, extension, 150, secuencia);
  if(!coincidencias || secuencia !== secuenciaBusqueda) return;
  const visibles = coincidencias.archivos;
  resultados.replaceChildren();
  contador.textContent = `${coincidencias.total} ${coincidencias.total === 1 ? 'archivo encontrado' : 'archivos encontrados'}${coincidencias.total > visibles.length ? ' · mostrando los primeros 150' : ''}`;
  if(!visibles.length) {
    const vacio = document.createElement('div');
    vacio.className = 'buscador-vacio';
    vacio.textContent = archivosBuscador.length ? 'No se encontraron coincidencias. Prueba con menos palabras.' : 'Elige una carpeta para crear el catálogo local.';
    resultados.append(vacio);
    return;
  }
  visibles.forEach(archivo => resultados.append(crearResultadoBuscador(archivo)));
}

async function recorrerCarpetaBuscador(directorio, carpetas = [], encontrados = [], profundidad = 0) {
  if(profundidad > MAX_PROFUNDIDAD_BUSCADOR) return encontrados;
  const entradas = [];
  for await(const entrada of directorio.values()) entradas.push(entrada);
  entradas.sort((a, b) => a.name.localeCompare(b.name));
  for(const handle of entradas) {
    if(encontrados.length >= MAX_ARCHIVOS_BUSCADOR) return encontrados;
    if(handle.kind === 'directory') {
      await recorrerCarpetaBuscador(handle, [...carpetas, handle.name], encontrados, profundidad + 1);
    } else if(handle.kind === 'file') {
      try {
        const archivo = await handle.getFile();
        const rutaRelativa = [...carpetas, handle.name].join('\\');
        encontrados.push(crearEntradaBuscador({
          id: rutaRelativa,
          nombre: handle.name,
          rutaRelativa,
          carpetas,
          tamano: archivo.size,
          modificado: archivo.lastModified
        }));
        if(encontrados.length % 100 === 0) {
          actualizarEstadoBuscador(`Revisando… ${encontrados.length.toLocaleString('es-GT')} archivos`, 'cargando');
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } catch(error) {
        console.warn('No se pudo leer un archivo durante el catálogo.', error);
      }
    }
  }
  return encontrados;
}

export async function actualizarCatalogoBuscador() {
  if(escaneoBuscadorActivo) return;
  if(!carpetaBuscador) return seleccionarCarpetaBuscador();
  if(!(await permisoCarpetaBuscador(carpetaBuscador, true))) {
    actualizarEstadoBuscador('No se concedió permiso para leer la carpeta.', 'error');
    return;
  }
  escaneoBuscadorActivo = true;
  const botones = ['btn-buscador-carpeta', 'btn-buscador-actualizar', 'btn-buscador-olvidar'].map(elementoBuscador).filter(Boolean);
  botones.forEach(boton => { boton.disabled = true; });
  actualizarEstadoBuscador('Preparando catálogo de solo lectura…', 'cargando');
  try {
    const encontrados = await recorrerCarpetaBuscador(carpetaBuscador);
    archivosBuscador = encontrados;
    await guardarDatoBuscador('indice', { actualizado: Date.now(), archivos: encontrados });
    if(navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    renderExtensionesBuscador();
    renderBuscadorDisenos();
    const limite = encontrados.length >= MAX_ARCHIVOS_BUSCADOR ? ` Se alcanzó el límite seguro de ${MAX_ARCHIVOS_BUSCADOR.toLocaleString('es-GT')}.` : '';
    actualizarEstadoBuscador(`Carpeta conectada: ${carpetaBuscador.name}. ${encontrados.length.toLocaleString('es-GT')} archivos catalogados.${limite}`, 'ok');
  } catch(error) {
    actualizarEstadoBuscador(`No se pudo actualizar el catálogo: ${error.message}`, 'error');
  } finally {
    escaneoBuscadorActivo = false;
    botones.forEach(boton => { boton.disabled = false; });
  }
}

export async function seleccionarCarpetaBuscador() {
  if(!window.isSecureContext || !('showDirectoryPicker' in window)) {
    actualizarEstadoBuscador('Esta función necesita Chrome o Edge de escritorio, usando HTTPS o localhost.', 'error');
    return;
  }
  try {
    const seleccionada = await window.showDirectoryPicker({ id: 'sublicosturas-buscador', mode: 'read' });
    if(!(await permisoCarpetaBuscador(seleccionada, true))) throw new Error('No se concedió permiso de lectura.');
    carpetaBuscador = seleccionada;
    await guardarDatoBuscador('carpeta', seleccionada);
    await actualizarCatalogoBuscador();
  } catch(error) {
    if(error.name !== 'AbortError') actualizarEstadoBuscador(`No se seleccionó la carpeta: ${error.message}`, 'error');
  }
}

export async function copiarUbicacionBuscador(id) {
  const archivo = archivosBuscador.find(item => item.id === id);
  if(!archivo) return;
  const ruta = rutaVisibleBuscador(archivo);
  try {
    await navigator.clipboard.writeText(ruta);
    actualizarEstadoBuscador(`Ubicación copiada: ${ruta}`, 'ok');
  } catch(error) {
    actualizarEstadoBuscador(`Ubicación: ${ruta}`, 'ok');
  }
}

export async function olvidarCarpetaBuscador() {
  if(!confirm('¿Olvidar esta carpeta y borrar solamente el índice local? Los archivos originales no se modificarán.')) return;
  carpetaBuscador = null;
  archivosBuscador = [];
  await limpiarDatosBuscador();
  renderExtensionesBuscador();
  renderBuscadorDisenos();
  actualizarEstadoBuscador('Carpeta olvidada. Ningún archivo fue borrado ni modificado.', 'ok');
}

async function inicializarBuscadorDisenos() {
  const compatible = window.isSecureContext && 'showDirectoryPicker' in window;
  const nota = elementoBuscador('buscador-compatibilidad');
  if(nota) nota.textContent = compatible
    ? 'Funciona localmente en Chrome o Edge de computadora. Los archivos nunca se suben a internet.'
    : 'Para elegir carpetas usa Chrome o Edge de computadora mediante HTTPS o localhost.';
  try {
    const [carpetaGuardada, indiceGuardado] = await Promise.all([leerDatoBuscador('carpeta'), leerDatoBuscador('indice')]);
    carpetaBuscador = carpetaGuardada?.valor || null;
    archivosBuscador = Array.isArray(indiceGuardado?.valor?.archivos) ? indiceGuardado.valor.archivos : [];
    renderExtensionesBuscador();
    renderBuscadorDisenos();
    if(carpetaBuscador) {
      const permiso = await permisoCarpetaBuscador(carpetaBuscador, false);
      actualizarEstadoBuscador(`${permiso ? 'Carpeta conectada' : 'Carpeta recordada; pulsa Actualizar para reconectarla'}: ${carpetaBuscador.name}. ${archivosBuscador.length.toLocaleString('es-GT')} archivos en el índice.`, permiso ? 'ok' : '');
    } else {
      actualizarEstadoBuscador('Elige la carpeta principal donde guardas tus trabajos.', '');
    }
  } catch(error) {
    actualizarEstadoBuscador(`No se pudo abrir el índice local: ${error.message}`, 'error');
  }
  if('indexedDB' in window) indexedDB.deleteDatabase('sublicosturas-studio');
}

if(typeof document !== 'undefined') {
  window.renderBuscadorDisenos = renderBuscadorDisenos;
  window.seleccionarCarpetaBuscador = seleccionarCarpetaBuscador;
  window.actualizarCatalogoBuscador = actualizarCatalogoBuscador;
  window.olvidarCarpetaBuscador = olvidarCarpetaBuscador;
  const iniciar = () => {
    elementoBuscador('btn-buscador-carpeta')?.addEventListener('click', seleccionarCarpetaBuscador);
    elementoBuscador('btn-buscador-actualizar')?.addEventListener('click', actualizarCatalogoBuscador);
    elementoBuscador('btn-buscador-olvidar')?.addEventListener('click', olvidarCarpetaBuscador);
    elementoBuscador('buscador-extension')?.addEventListener('change', renderBuscadorDisenos);
    elementoBuscador('buscador-consulta')?.addEventListener('input', () => {
      clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(renderBuscadorDisenos, 180);
    });
    inicializarBuscadorDisenos();
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
}
