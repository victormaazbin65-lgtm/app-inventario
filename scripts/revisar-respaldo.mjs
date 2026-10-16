import {readFile} from 'node:fs/promises';
import {webcrypto, createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

// Reutilizar los validadores de la app sin Firebase, credenciales ni acceso de red.
const contexto = vm.createContext({crypto:webcrypto, TextEncoder});
contexto.window = contexto;
for(const archivo of ['negocio-core.js','respaldo-negocio.js']) {
    vm.runInContext(await readFile(new URL('../'+archivo,import.meta.url),'utf8'),contexto,{filename:archivo});
}
const api = contexto.SubliRespaldoCoreV4;
export const coleccionesRequeridas = [...api.COLECCIONES_RESPALDO];

export async function analizarRespaldo(copia) {
    const validada = api.validarCopiaSeguridad(copia);
    const integridad = await api.validarIntegridadCopia(copia);
    const capacidad = api.evaluarRecuperacionCopia(copia);
    const faltantes = coleccionesRequeridas.filter(nombre => !Array.isArray(validada.colecciones[nombre]));
    const desconocidas = Object.keys(copia.colecciones).filter(nombre => !coleccionesRequeridas.includes(nombre));
    const configuracionCompleta = Boolean(validada.sistema.config?.fondos && validada.sistema.config?.saldosDinero);
    const candidata = integridad.verificada && !faltantes.length && !desconocidas.length && configuracionCompleta && capacidad.automatica;
    return {
        formato:'sublicosturas-revision-respaldo', schemaVersion:validada.schemaVersion,
        appVersion:copia.appVersion || null, creadoEnISO:copia.creadoEnISO || null,
        integridad, documentos:validada.total,
        conteos:Object.fromEntries(Object.entries(validada.colecciones).map(([nombre,filas]) => [nombre,filas.length])),
        coleccionesFaltantes:faltantes, coleccionesDesconocidas:desconocidas, configuracionCompleta,
        capacidad, candidataAComprobacionAutomatica:candidata,
        procedimiento:candidata ? 'Comprobar destino completo desde la app; este informe no autoriza restaurarlo.'
            : 'Preparar y verificar una recuperación administrativa en un destino separado; no dividir esta copia.',
        consultaProduccion:false, escribeDatos:false,
        alcance:'La firma detecta cambios del archivo. No prueba su origen ni la consistencia contable y no se comparó con una base de datos.'
    };
}

if(process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    try {
        if(process.argv.length !== 3) throw new Error('Uso: node scripts/revisar-respaldo.mjs /ruta/copia.json');
        const contenido = await readFile(process.argv[2]);
        const informe = await analizarRespaldo(JSON.parse(contenido.toString('utf8')));
        console.log(JSON.stringify({archivoSHA256:createHash('sha256').update(contenido).digest('hex'),...informe},null,2));
    } catch(error) {
        console.error('No se validó la copia: '+error.message);
        process.exitCode = 1;
    }
}
