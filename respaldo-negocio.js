(function (global) {
    'use strict';

    const COLECCIONES_RESPALDO = [
        'inventario', 'ventas', 'ingresos', 'cotizaciones', 'retiros', 'resumen_mensual',
        'codigos_inventario', 'ajustes_inventario', 'clientes', 'anticipos', 'prestamos',
        'movimientos_caja', 'pagos_clientes', 'devoluciones', 'perdidas_inventario'
    ];

    function descargarArchivo(nombre, contenido, tipo) {
        const blob = new Blob([contenido], { type: tipo });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url; enlace.download = nombre; enlace.style.display = 'none';
        document.body.appendChild(enlace); enlace.click(); enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function leerColeccionCompleta(nombre) {
        const snap = await global.getDocs(global.collection(global.db, nombre));
        const docs = [];
        snap.forEach(documento => docs.push({ id: documento.id, data: documento.data() }));
        return docs;
    }

    async function construirCopiaSeguridad() {
        if (!global.db || !navigator.onLine) throw new Error('Necesitas conexión para incluir todos los datos de Firebase.');
        const resultados = await Promise.all(COLECCIONES_RESPALDO.map(async nombre => [nombre, await leerColeccionCompleta(nombre)]));
        const configSnap = await global.getDoc(global.doc(global.db, 'sistema', 'config'));
        const brandingSnap = await global.getDoc(global.doc(global.db, 'sistema', 'branding'));
        return {
            formato: 'sublicosturas-backup',
            schemaVersion: 3,
            appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : 'desconocida',
            creadoEnISO: new Date().toISOString(),
            creadoEnTimestamp: Date.now(),
            instrucciones: 'Este JSON es para restauración. El archivo Excel es únicamente para consulta.',
            sistema: {
                config: configSnap.exists() ? configSnap.data() : null,
                branding: brandingSnap.exists() ? brandingSnap.data() : null
            },
            colecciones: Object.fromEntries(resultados),
            conteos: Object.fromEntries(resultados.map(([nombre, docs]) => [nombre, docs.length]))
        };
    }

    async function crearCopiaSeguridadJSON(silenciosa = false) {
        if (!exigirDueno('Solo el Dueño puede descargar una copia completa.')) return null;
        const estado = document.getElementById('estado-restauracion');
        if (estado) estado.textContent = 'Preparando copia completa…';
        try {
            const copia = await construirCopiaSeguridad();
            const fecha = new Date().toISOString().replaceAll(':', '-').replace('T', '_').slice(0, 19);
            descargarArchivo(`SubliCosturas_Respaldo_${fecha}.json`, JSON.stringify(copia, null, 2), 'application/json;charset=utf-8');
            if (estado) estado.textContent = `Copia creada: ${Object.values(copia.conteos).reduce((a, b) => a + b, 0)} documentos, además de la configuración.`;
            if (!silenciosa) alert('✅ Copia completa descargada. Guárdala en un lugar seguro.');
            return copia;
        } catch (error) {
            if (estado) estado.textContent = 'No se pudo crear la copia: ' + error.message;
            if (!silenciosa) alert('No se pudo crear la copia. ' + error.message);
            return null;
        }
    }

    function validarDocumentoRespaldo(documento, coleccion, ids) {
        if (!documento || typeof documento !== 'object' || typeof documento.data !== 'object' || documento.data === null) {
            throw new Error(`Hay un documento inválido en ${coleccion}.`);
        }
        const id = String(documento.id || '').trim();
        if (!id || id.includes('/')) throw new Error(`Hay un identificador inválido en ${coleccion}.`);
        if (ids.has(id)) throw new Error(`El identificador ${id} está repetido en ${coleccion}.`);
        ids.add(id);
        return { id, data: documento.data };
    }

    function validarCopiaSeguridad(copia) {
        if (!copia || copia.formato !== 'sublicosturas-backup' || Number(copia.schemaVersion) < 1) {
            throw new Error('El archivo no es una copia compatible de esta aplicación.');
        }
        if (!copia.colecciones || typeof copia.colecciones !== 'object') throw new Error('La copia no contiene colecciones.');
        const normalizada = { sistema: copia.sistema || {}, colecciones: {} };
        let total = 0;
        Object.entries(copia.colecciones).forEach(([coleccion, documentos]) => {
            if (!COLECCIONES_RESPALDO.includes(coleccion)) return;
            if (!Array.isArray(documentos)) throw new Error(`La colección ${coleccion} no es válida.`);
            const ids = new Set();
            normalizada.colecciones[coleccion] = documentos.map(doc => validarDocumentoRespaldo(doc, coleccion, ids));
            total += documentos.length;
        });
        if (!normalizada.colecciones.inventario) throw new Error('La copia no contiene la colección de inventario.');
        if (normalizada.sistema.config !== null && normalizada.sistema.config !== undefined && typeof normalizada.sistema.config !== 'object') throw new Error('La configuración de la copia es inválida.');
        normalizada.total = total;
        return normalizada;
    }

    async function escribirOperacionesEnLotes(operaciones) {
        const TAMANO = 400;
        for (let inicio = 0; inicio < operaciones.length; inicio += TAMANO) {
            const lote = global.writeBatch(global.db);
            operaciones.slice(inicio, inicio + TAMANO).forEach(operacion => lote.set(operacion.ref, operacion.data));
            await lote.commit();
        }
    }

    async function prepararRestauracion(evento) {
        const archivo = evento?.target?.files?.[0];
        if (!archivo) return;
        evento.target.value = '';
        if (!exigirDueno('Solo el Dueño puede restaurar una copia.') || !global.db || !navigator.onLine || isProcessingTransaction) return;
        const estado = document.getElementById('estado-restauracion');
        try {
            if (archivo.size > 40 * 1024 * 1024) throw new Error('El archivo supera el límite de seguridad de 40 MB.');
            if (estado) estado.textContent = 'Validando la copia seleccionada…';
            const copia = JSON.parse(await archivo.text());
            const validada = validarCopiaSeguridad(copia);
            const fecha = copia.creadoEnISO ? new Date(copia.creadoEnISO).toLocaleString('es-GT') : 'fecha desconocida';
            if (!confirm(`La copia contiene ${validada.total} documentos y fue creada el ${fecha}.\n\nLa restauración actualizará o creará esos documentos, pero no borrará otros. ¿Deseas continuar?`)) return;
            if (!confirm('Se descargará primero una copia del estado actual. Después se restaurarán los datos. ¿Confirmas la operación?')) return;
            isProcessingTransaction = true;
            if (estado) estado.textContent = 'Creando punto de restauración del estado actual…';
            const punto = await crearCopiaSeguridadJSON(true);
            if (!punto) throw new Error('No se pudo crear el punto de restauración previo; se canceló sin cambiar datos.');
            const configActualSnap = await global.getDoc(global.doc(global.db, 'sistema', 'config'));
            const configActual = configActualSnap.exists() ? configActualSnap.data() : {};
            const authActual = global.SubliNegocioCore
                ? global.SubliNegocioCore.normalizarConfiguracionNegocio(configActual.negocio || {}).authPropietario
                : (configActual.negocio?.authPropietario || { habilitado: false, email: '', uid: '' });
            const operaciones = [];
            Object.entries(validada.colecciones).forEach(([coleccion, documentos]) => {
                documentos.forEach(documento => operaciones.push({ ref: global.doc(global.db, coleccion, documento.id), data: documento.data }));
            });
            if (validada.sistema.config) {
                const configRestaurada = { ...validada.sistema.config };
                const negocioRestaurado = global.SubliNegocioCore
                    ? global.SubliNegocioCore.normalizarConfiguracionNegocio(configRestaurada.negocio || {})
                    : (configRestaurada.negocio || {});
                configRestaurada.negocio = { ...negocioRestaurado, authPropietario: authActual };
                if (Object.prototype.hasOwnProperty.call(configActual, 'ultimaActualizacionAuth')) {
                    configRestaurada.ultimaActualizacionAuth = configActual.ultimaActualizacionAuth;
                } else {
                    delete configRestaurada.ultimaActualizacionAuth;
                }
                operaciones.push({ ref: global.doc(global.db, 'sistema', 'config'), data: configRestaurada });
            }
            if (validada.sistema.branding) operaciones.push({ ref: global.doc(global.db, 'sistema', 'branding'), data: validada.sistema.branding });
            if (estado) estado.textContent = `Restaurando ${operaciones.length} documentos en lotes seguros…`;
            await escribirOperacionesEnLotes(operaciones);
            if (estado) estado.textContent = 'Restauración completada. Firebase actualizará las pantallas automáticamente.';
            alert('✅ Restauración completada. Se descargó antes una copia del estado que tenías.');
        } catch (error) {
            if (estado) estado.textContent = 'Restauración cancelada o incompleta: ' + error.message;
            alert('No se completó la restauración. ' + error.message);
        } finally {
            isProcessingTransaction = false;
        }
    }

    global.crearCopiaSeguridadJSON = crearCopiaSeguridadJSON;
    global.prepararRestauracion = prepararRestauracion;
})(window);
