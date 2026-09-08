(function (global) {
    'use strict';

    const COLECCIONES_RESPALDO = [
        'inventario', 'ventas', 'ingresos', 'cotizaciones', 'retiros', 'resumen_mensual',
        'codigos_inventario', 'ajustes_inventario', 'clientes', 'anticipos', 'prestamos',
        'movimientos_caja', 'pagos_clientes', 'devoluciones', 'perdidas_inventario',
        'cierres_diarios', 'ordenes_compra', 'auditoria_sistema', 'errores_sistema', 'indices_nombres'
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
        docs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        return docs;
    }

    function bytesAHex(buffer) {
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function sha256(texto) {
        if (!global.crypto?.subtle) return null;
        const bytes = new TextEncoder().encode(texto);
        return bytesAHex(await global.crypto.subtle.digest('SHA-256', bytes));
    }

    function contenidoFirmable(copia) {
        return JSON.stringify({
            formato: copia.formato,
            schemaVersion: copia.schemaVersion,
            appVersion: copia.appVersion,
            creadoEnISO: copia.creadoEnISO,
            creadoEnTimestamp: copia.creadoEnTimestamp,
            sistema: copia.sistema,
            colecciones: copia.colecciones,
            conteos: copia.conteos
        });
    }

    async function construirCopiaSeguridad() {
        if (!global.db || !navigator.onLine) throw new Error('Necesitas conexión para incluir todos los datos de Firebase.');
        const resultados = await Promise.all(COLECCIONES_RESPALDO.map(async nombre => [nombre, await leerColeccionCompleta(nombre)]));
        const configSnap = await global.getDoc(global.doc(global.db, 'sistema', 'config'));
        const brandingSnap = await global.getDoc(global.doc(global.db, 'sistema', 'branding'));
        const copia = {
            formato: 'sublicosturas-backup',
            // Compatibilidad: las copias antiguas con schemaVersion: 3 siguen aceptándose al restaurar.
            schemaVersion: 4,
            appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '1.3.0-interno',
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
        const hash = await sha256(contenidoFirmable(copia));
        copia.integridad = hash ? { algoritmo: 'SHA-256', hash } : { algoritmo: 'NO-DISPONIBLE', hash: null };
        return copia;
    }

    async function crearCopiaSeguridadJSON(silenciosa = false) {
        if (!exigirDueno('Solo el Dueño puede descargar una copia completa.')) return null;
        const estado = document.getElementById('estado-restauracion');
        if (estado) estado.textContent = 'Preparando copia completa y comprobando integridad…';
        try {
            const copia = await construirCopiaSeguridad();
            const fecha = new Date().toISOString().replaceAll(':', '-').replace('T', '_').slice(0, 19);
            descargarArchivo(`SubliCosturas_Respaldo_${fecha}.json`, JSON.stringify(copia, null, 2), 'application/json;charset=utf-8');
            if (estado) estado.textContent = `Copia creada: ${Object.values(copia.conteos).reduce((a, b) => a + b, 0)} documentos. Integridad: ${copia.integridad?.algoritmo || 'sin firma'}.`;
            if (!silenciosa) alert('✅ Copia completa descargada y validada. Guárdala en un lugar seguro.');
            return copia;
        } catch (error) {
            if (estado) estado.textContent = 'No se pudo crear la copia: ' + error.message;
            if (!silenciosa) alert('No se pudo crear la copia. ' + error.message);
            return null;
        }
    }

    function objetoPlano(valor) {
        return Boolean(valor && typeof valor === 'object' && !Array.isArray(valor));
    }

    function validarNumeroNoNegativo(valor, etiqueta) {
        if (valor === undefined || valor === null || valor === '') return;
        const n = Number(valor);
        if (!Number.isFinite(n) || n < 0) throw new Error(`${etiqueta} contiene un número inválido.`);
    }

    function validarEsquemaDocumento(coleccion, data) {
        if (!objetoPlano(data)) throw new Error(`Hay datos inválidos en ${coleccion}.`);
        if (coleccion === 'inventario') {
            if (!String(data.nombre || '').trim()) throw new Error('Un producto del inventario no tiene nombre.');
            validarNumeroNoNegativo(data.stock, 'Inventario/stock');
            validarNumeroNoNegativo(data.min, 'Inventario/mínimo');
            validarNumeroNoNegativo(data.costo, 'Inventario/costo');
        } else if (coleccion === 'ventas') {
            validarNumeroNoNegativo(data.ingresoTotal, 'Ventas/total');
            validarNumeroNoNegativo(data.montoCobradoTotal, 'Ventas/cobrado');
            if (data.detalleItems !== undefined && !Array.isArray(data.detalleItems)) throw new Error('Una venta contiene detalleItems inválido.');
        } else if (coleccion === 'clientes') {
            if (!String(data.nombreCompleto || `${data.nombres || ''} ${data.apellidos || ''}`).trim()) throw new Error('Una ficha de cliente no tiene nombre.');
            validarNumeroNoNegativo(data.limiteCredito, 'Clientes/límite');
            validarNumeroNoNegativo(data.saldoCredito, 'Clientes/saldo');
        } else if (coleccion === 'prestamos') {
            validarNumeroNoNegativo(data.montoOriginal, 'Préstamos/original');
            validarNumeroNoNegativo(data.saldoPendiente, 'Préstamos/saldo');
            validarNumeroNoNegativo(data.devueltoTotal, 'Préstamos/devuelto');
        } else if (coleccion === 'anticipos') {
            validarNumeroNoNegativo(data.montoOriginal, 'Anticipos/original');
            validarNumeroNoNegativo(data.saldoPendiente, 'Anticipos/saldo');
        } else if (coleccion === 'cierres_diarios') {
            validarNumeroNoNegativo(data.esperadoEfectivo, 'Cierre/efectivo esperado');
            validarNumeroNoNegativo(data.esperadoBanco, 'Cierre/banco esperado');
            validarNumeroNoNegativo(data.realEfectivo, 'Cierre/efectivo real');
            validarNumeroNoNegativo(data.realBanco, 'Cierre/banco real');
        } else if (coleccion === 'ordenes_compra') {
            if (data.items !== undefined && !Array.isArray(data.items)) throw new Error('Una orden de compra contiene líneas inválidas.');
            validarNumeroNoNegativo(data.total, 'Orden/total');
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
        validarEsquemaDocumento(coleccion, documento.data);
        return { id, data: documento.data };
    }

    function validarCopiaSeguridad(copia) {
        const schemaVersion = Number(copia?.schemaVersion);
        if (!copia || copia.formato !== 'sublicosturas-backup' || !Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 4) {
            throw new Error('El archivo no es una copia compatible de esta aplicación.');
        }
        if (!copia.colecciones || typeof copia.colecciones !== 'object') throw new Error('La copia no contiene colecciones.');
        const normalizada = { sistema: copia.sistema || {}, colecciones: {}, schemaVersion };
        let total = 0;
        Object.entries(copia.colecciones).forEach(([coleccion, documentos]) => {
            if (!COLECCIONES_RESPALDO.includes(coleccion)) return;
            if (!Array.isArray(documentos)) throw new Error(`La colección ${coleccion} no es válida.`);
            const ids = new Set();
            normalizada.colecciones[coleccion] = documentos.map(doc => validarDocumentoRespaldo(doc, coleccion, ids));
            if (copia.conteos && Object.prototype.hasOwnProperty.call(copia.conteos, coleccion)
                && Number(copia.conteos[coleccion]) !== documentos.length) {
                throw new Error(`El conteo declarado de ${coleccion} no coincide con el contenido del archivo.`);
            }
            total += documentos.length;
        });
        if (!normalizada.colecciones.inventario) throw new Error('La copia no contiene la colección de inventario.');
        if (normalizada.sistema.config !== null && normalizada.sistema.config !== undefined && typeof normalizada.sistema.config !== 'object') throw new Error('La configuración de la copia es inválida.');
        normalizada.total = total;
        return normalizada;
    }

    async function validarIntegridadCopia(copia) {
        if (Number(copia?.schemaVersion) < 4) return { verificada: false, legado: true };
        const esperado = String(copia?.integridad?.hash || '');
        if (!esperado || copia?.integridad?.algoritmo !== 'SHA-256') throw new Error('La copia v4 no contiene una firma de integridad válida.');
        const calculado = await sha256(contenidoFirmable(copia));
        if (!calculado) throw new Error('Este navegador no puede verificar SHA-256; usa un navegador moderno para restaurar esta copia.');
        if (calculado !== esperado) throw new Error('La firma SHA-256 no coincide. El archivo pudo modificarse o dañarse.');
        return { verificada: true, legado: false };
    }

    async function escribirOperacionesEnLotes(operaciones) {
        const TAMANO = 400;
        for (let inicio = 0; inicio < operaciones.length; inicio += TAMANO) {
            const lote = global.writeBatch(global.db);
            operaciones.slice(inicio, inicio + TAMANO).forEach(operacion => lote.set(operacion.ref, operacion.data));
            await lote.commit();
        }
    }

    async function verificarMuestraRestaurada(validada) {
        for (const [coleccion, documentos] of Object.entries(validada.colecciones)) {
            if (!documentos.length) continue;
            const muestras = documentos.length === 1 ? [documentos[0]] : [documentos[0], documentos[documentos.length - 1]];
            for (const muestra of muestras) {
                const snap = await global.getDoc(global.doc(global.db, coleccion, muestra.id));
                if (!snap.exists()) throw new Error(`No se pudo verificar ${coleccion}/${muestra.id} después de restaurar.`);
            }
        }
        return true;
    }

    async function registrarEstadoRestauracion(id, data) {
        try {
            await global.setDoc(global.doc(global.db, 'restauraciones_sistema', id), data, { merge: true });
        } catch (error) {
            console.warn('No se pudo actualizar la bitácora de restauración.', error);
        }
    }

    async function prepararRestauracion(evento) {
        const archivo = evento?.target?.files?.[0];
        if (!archivo) return;
        evento.target.value = '';
        if (!exigirDueno('Solo el Dueño puede restaurar una copia.') || !global.db || !navigator.onLine || isProcessingTransaction) return;
        const estado = document.getElementById('estado-restauracion');
        let restauracionId = null;
        try {
            if (archivo.size > 40 * 1024 * 1024) throw new Error('El archivo supera el límite de seguridad de 40 MB.');
            if (estado) estado.textContent = 'Validando estructura, tipos y firma de la copia…';
            const copia = JSON.parse(await archivo.text());
            const validada = validarCopiaSeguridad(copia);
            const integridad = await validarIntegridadCopia(copia);
            const fecha = copia.creadoEnISO ? new Date(copia.creadoEnISO).toLocaleString('es-GT') : 'fecha desconocida';
            const firmaTexto = integridad.verificada ? 'Firma SHA-256 verificada.' : 'Copia antigua sin firma SHA-256.';
            if (!confirm(`La copia contiene ${validada.total} documentos y fue creada el ${fecha}.\n${firmaTexto}\n\nLa restauración actualizará o creará esos documentos, pero no borrará otros. ¿Deseas continuar?`)) return;
            if (!confirm('Se descargará primero una copia completa del estado actual. Después se iniciará la restauración. ¿Confirmas la operación?')) return;
            isProcessingTransaction = true;
            if (estado) estado.textContent = 'Creando punto de restauración del estado actual…';
            const punto = await crearCopiaSeguridadJSON(true);
            if (!punto) throw new Error('No se pudo crear el punto de restauración previo; se canceló sin cambiar datos.');

            restauracionId = `restore_${Date.now()}`;
            await registrarEstadoRestauracion(restauracionId, {
                estado: 'validada', iniciadoEn: Date.now(), archivoCreadoEn: copia.creadoEnISO || null,
                documentos: validada.total, integridadVerificada: integridad.verificada
            });

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

            await registrarEstadoRestauracion(restauracionId, { estado: 'aplicando', operaciones: operaciones.length, aplicandoEn: Date.now() });
            if (estado) estado.textContent = `Restaurando ${operaciones.length} documentos en lotes de hasta 400…`;
            await escribirOperacionesEnLotes(operaciones);
            if (estado) estado.textContent = 'Verificando una muestra de cada colección restaurada…';
            await verificarMuestraRestaurada(validada);
            await registrarEstadoRestauracion(restauracionId, { estado: 'completa', completadoEn: Date.now(), verificacionMuestra: true });
            if (estado) estado.textContent = 'Restauración completada y verificada. Firebase actualizará las pantallas automáticamente.';
            alert('✅ Restauración completada. Se descargó antes una copia del estado anterior y se verificó una muestra de cada colección.');
        } catch (error) {
            if (restauracionId) await registrarEstadoRestauracion(restauracionId, { estado: 'incompleta', falloEn: Date.now(), error: String(error.message || error).slice(0, 500) });
            if (estado) estado.textContent = 'Restauración cancelada o incompleta: ' + error.message;
            alert('No se completó la restauración. ' + error.message);
        } finally {
            isProcessingTransaction = false;
        }
    }

    global.SubliRespaldoCoreV4 = Object.freeze({ COLECCIONES_RESPALDO, validarCopiaSeguridad, validarIntegridadCopia, contenidoFirmable });
    global.crearCopiaSeguridadJSON = crearCopiaSeguridadJSON;
    global.prepararRestauracion = prepararRestauracion;
})(window);
