(function(global) {
    'use strict';

    function usuarioOperativo() {
        try { return currentUserData || null; } catch { return null; }
    }

    async function claveOperacion(texto) {
        const bytes = new TextEncoder().encode(String(texto));
        const digest = await global.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }

    function serializarEstable(valor) {
        if(Array.isArray(valor)) return '[' + valor.map(serializarEstable).join(',') + ']';
        if(valor && typeof valor === 'object') return '{' + Object.keys(valor).sort().map(k => JSON.stringify(k) + ':' + serializarEstable(valor[k])).join(',') + '}';
        return JSON.stringify(valor);
    }

    async function leerRangoConfirmado(colecciones, inicio, fin) {
        if(!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio > fin) throw new Error('Rango de fechas inválido.');
        if(!global.db || !global.navigator?.onLine) throw new Error('Necesitas conexión para confirmar el período completo.');
        const configRef = global.doc(global.db,'sistema','config');
        const comprobar = snap => {
            if(!snap.metadata || snap.metadata.fromCache || snap.metadata.hasPendingWrites) throw new Error('El servidor no confirmó todos los datos. Intenta otra vez con conexión estable.');
            return snap;
        };
        const inicial = comprobar(await global.getDoc(configRef));
        const firmaInicial = JSON.stringify(inicial.data());
        const resultado = {};
        for(const nombre of colecciones) {
            const filas = []; let ultima = null;
            while(true) {
                const condiciones = [global.where('timestamp','>=',inicio), global.where('timestamp','<=',fin),global.orderBy('timestamp','asc'),global.limit(100)];
                if(ultima) condiciones.push(global.startAfter(ultima));
                const snap = comprobar(await global.getDocs(global.query(global.collection(global.db,nombre),...condiciones)));
                filas.push(...snap.docs.map(d => ({...d.data(),id:d.id})));
                if(snap.docs.length < 100) break;
                ultima = snap.docs[snap.docs.length - 1];
                await new Promise(resolve => setTimeout(resolve,0));
            }
            resultado[nombre] = filas;
        }
        const final = comprobar(await global.getDoc(configRef));
        if(firmaInicial !== JSON.stringify(final.data())) throw new Error('Los datos cambiaron durante la consulta. Vuelve a confirmar el período.');
        return {...resultado,config:final.data(),confirmadoEn:Date.now(),inicio,fin};
    }

    function instalarIntegridadFirebase() {
        if(global.subliIntegridadFirebase || typeof global.runTransaction !== 'function') return;
        const nativo = global.runTransaction;
        const pendientes = new Map();
        const enVuelo = new Map();
        const claveRef = ref => ref.path || String(ref);
        const idNuevo = () => global.crypto?.randomUUID?.() || `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const obtenerId = (clave, solicitud) => {
            let pendiente = pendientes.get(clave);
            try { pendiente ||= JSON.parse(global.sessionStorage?.getItem(clave) || 'null'); } catch {}
            const preexistente = Boolean(pendiente);
            if(pendiente && pendiente.solicitud !== solicitud) {
                const error = new Error('Hay una operación anterior sin confirmación. Conserva esta lista y revisa el historial antes de cambiar o repetir la operación.');
                error.commitIncierto = true;
                throw error;
            }
            pendiente ||= {id:idNuevo(), solicitud};
            pendientes.set(clave, pendiente);
            try { global.sessionStorage?.setItem(clave, JSON.stringify(pendiente)); } catch {}
            return {id:pendiente.id, preexistente};
        };
        const olvidarId = clave => {
            pendientes.delete(clave);
            try { global.sessionStorage?.removeItem(clave); } catch {}
        };
        const camposAuditoria = data => {
            if(!data || typeof data !== 'object') return null;
            const campos = ['stock','costo','unidadId','nombre','categoria','ingresoTotal','ganancia','saldoPendiente',
                'montoCobradoTotal','saldoCredito','saldoAnticipos','estado','anulada','revision','fondos','saldosDinero'];
            return Object.fromEntries(campos.filter(k => data[k] !== undefined).map(k => [k,data[k]]));
        };

        global.runTransaction = async function(db, accion, opciones = {}) {
            const usuario = JSON.parse(JSON.stringify(usuarioOperativo()));
            const autorUID = global.firebaseAuthUser?.uid || null;
            const textoGrupo = opciones.tipoOperacion || opciones.claveOperacion || accion.toString();
            const textoSolicitud = opciones.claveOperacion || accion.toString();
            const claveVuelo = JSON.stringify([autorUID, usuario?.id ?? null, textoGrupo]);
            if(enVuelo.has(claveVuelo)) {
                const actual = enVuelo.get(claveVuelo);
                if(!opciones.claveOperacion && !opciones.opId) throw new Error('Hay una operación en proceso. Espera antes de repetir una solicitud sin firma de datos.');
                if(actual.solicitud !== textoSolicitud) throw new Error('Hay una operación anterior sin confirmación. Espera a que termine antes de cambiar la solicitud.');
                return actual.promesa;
            }
            const operacion = (async () => {
                const grupo = await claveOperacion(textoGrupo);
                const solicitud = await claveOperacion(textoSolicitud);
                const clave = `subli_op_pendiente_${autorUID || 'local'}_${usuario?.id ?? 'inicio'}_${grupo}`;
                const pendiente = opciones.opId ? {id:opciones.opId, preexistente:true} : obtenerId(clave, solicitud);
                const opId = pendiente.id;
                let escrituraIntentada = false;
                const promesa = nativo(db, async original => {
                    const configRef = global.doc(db,'sistema','config');
                    const configSnap = await original.get(configRef);
                    const data = configSnap.exists() ? configSnap.data() : {};
                    const registroRef = global.doc(db,'operaciones_sistema',opId);
                    const previa = await original.get(registroRef);
                    if(previa.exists()) {
                        const registro = previa.data();
                        if(!opciones.claveOperacion && !opciones.opId) throw new Error('Hay una operación anterior sin confirmación que necesita revisión del historial antes de repetirse.');
                        if(registro.solicitud && registro.solicitud !== solicitud) throw new Error('La operación anterior corresponde a otra solicitud. Revisa el historial antes de continuar.');
                        if(String(registro.usuarioId ?? '') !== String(usuario?.id ?? '')) throw new Error('La operación pertenece a otro usuario.');
                        return registro.tieneResultado ? registro.resultado : undefined;
                    }
                    if(data.mantenimiento?.activo) throw new Error('El sistema está en recuperación. Las operaciones están pausadas para proteger tus datos.');
                    if(Array.isArray(data.usuarios) && data.usuarios.length) {
                        if(!usuario) throw new Error('Ingresa con tu PIN antes de registrar una operación.');
                        const vigente = data.usuarios.find(u => String(u.id) === String(usuario.id) && u.pin === usuario.pin);
                        if(!vigente || vigente.rol !== usuario.rol || serializarEstable(vigente.permisos || {}) !== serializarEstable(usuario.permisos || {})) {
                            throw new Error('Tus permisos cambiaron. Actualiza el acceso antes de registrar otra operación.');
                        }
                        if(opciones.soloDueno && vigente.rol !== 'dueno') throw new Error('Solo el Dueño puede realizar esta operación.');
                        if(opciones.permisoRequerido && vigente.rol !== 'dueno' && vigente.permisos?.[opciones.permisoRequerido] !== true) {
                            throw new Error('No tienes permiso para ' + opciones.permisoRequerido + '.');
                        }
                    }
                    const lecturas = new Map([[claveRef(configRef), configSnap], [claveRef(registroRef), previa]]);
                    const escrituras = [];
                    const t = {
                        get: async ref => {
                            if(escrituras.length) throw new Error('Todas las lecturas deben terminar antes de escribir en una transacción.');
                            const clave = claveRef(ref);
                            if(!lecturas.has(clave)) lecturas.set(clave, await original.get(ref));
                            return lecturas.get(clave);
                        },
                        set:(ref,datos,opciones) => { escrituras.push({ tipo:'set',ref,datos,opciones }); return t; },
                        update:(ref,datos) => { escrituras.push({ tipo:'update',ref,datos }); return t; },
                        delete:ref => { escrituras.push({ tipo:'delete',ref }); return t; }
                    };
                    const valor = await accion(t);
                    if(!escrituras.length) return valor;
                    if(escrituras.length > 430) throw new Error('La operación contiene demasiadas escrituras. Divide la lista antes de confirmar.');
                    const coleccionesConAutor = new Set(['ventas','ingresos','cotizaciones','retiros','clientes','anticipos','prestamos','devoluciones','perdidas_inventario','movimientos_caja','pagos_clientes','ordenes_compra','cierres_diarios']);
                    if(!opciones.preservarMetadatos) for(const e of escrituras) {
                        if(e.tipo === 'delete' || !coleccionesConAutor.has(claveRef(e.ref).split('/')[0])) continue;
                        const anterior = lecturas.get(claveRef(e.ref));
                        const datosAntes = anterior?.exists?.() ? anterior.data() : null;
                        Object.assign(e.datos, {
                            creadoPorId:datosAntes ? datosAntes.creadoPorId ?? datosAntes.usuarioId ?? null : e.datos.creadoPorId ?? usuario?.id ?? null,
                            creadoPorNombre:datosAntes ? datosAntes.creadoPorNombre || datosAntes.usuarioNombre || 'Usuario anterior sin registrar' : e.datos.creadoPorNombre || usuario?.nombre || 'Usuario',
                            creadoPorRol:datosAntes?.creadoPorRol || e.datos.creadoPorRol || (datosAntes ? 'desconocido' : usuario?.rol || 'desconocido'),
                            ...(datosAntes ? {editadoPorId:usuario?.id || null,editadoPorNombre:usuario?.nombre || 'Usuario',editadoEnUsuario:Date.now()} : {})
                        });
                    }
                    const revision = Number(data.revisionGlobal || 0);
                    if(!Number.isSafeInteger(revision) || revision < 0) throw new Error('La revisión del sistema es inválida. Revisa la configuración antes de continuar.');
                    const operaciones = escrituras.map(e => ({
                        documento:claveRef(e.ref), accion:e.tipo,
                        antes:camposAuditoria(lecturas.get(claveRef(e.ref))?.data?.()),
                        despues:e.tipo === 'delete' ? null : camposAuditoria(e.datos)
                    }));
                    // Los resultados de los comandos son datos JSON. Nunca guardar referencias/credenciales.
                    const resultadoGuardado = valor === undefined ? null : JSON.parse(JSON.stringify(valor));
                    if(JSON.stringify(resultadoGuardado).length > 600000) throw new Error('El resultado de la operación es demasiado grande para confirmar de forma segura.');
                    escrituraIntentada = true;
                    for(const e of escrituras) {
                        if(e.tipo === 'delete') original.delete(e.ref);
                        else original[e.tipo](e.ref, e.datos, ...(e.opciones ? [e.opciones] : []));
                    }
                    const timestamp = Date.now();
                    original.set(configRef, { revisionGlobal:revision + 1, ultimaOperacionEn:timestamp }, { merge:true });
                    original.set(registroRef, { id:opId, timestamp, usuarioId:usuario?.id ?? null, autorUID, solicitud, tieneResultado:valor !== undefined, resultado:resultadoGuardado });
                    original.set(global.doc(db,'auditoria_sistema',opId), {
                        id:opId, timestamp, tipo:'operacion_atomica', usuarioId:usuario?.id || null,
                        usuarioNombre:usuario?.nombre || 'Acceso del propietario', autorUID,
                        operaciones, version:'1.4.1'
                    });
                    return valor;
                }, { maxAttempts:opciones.maxAttempts || 5 });
                try {
                    const resultado = await promesa;
                    olvidarId(clave);
                    return resultado;
                } catch(error) {
                    // Una validación que falló antes de enviar escrituras no deja un commit incierto.
                    if(!pendiente.preexistente && (!escrituraIntentada || ['permission-denied','unauthenticated','invalid-argument','failed-precondition','aborted'].includes(error?.code))) olvidarId(clave);
                    else error.commitIncierto = true;
                    throw error;
                }
            })();
            enVuelo.set(claveVuelo, {solicitud:textoSolicitud, promesa:operacion});
            try { return await operacion; }
            finally { enVuelo.delete(claveVuelo); }
        };
        // Las escrituras administrativas también participan de revisión, permisos y bitácora.
        global.setDoc = (ref,datos,opciones) => global.runTransaction(global.db, async t => { await t.get(ref); t.set(ref,datos,opciones); }, { claveOperacion:`set:${claveRef(ref)}:${JSON.stringify(datos)}:${JSON.stringify(opciones)}` });
        global.updateDoc = (ref,datos) => global.runTransaction(global.db, async t => { await t.get(ref); t.update(ref,datos); }, { claveOperacion:`update:${claveRef(ref)}:${JSON.stringify(datos)}` });
        global.deleteDoc = ref => global.runTransaction(global.db, async t => { await t.get(ref); t.delete(ref); }, { claveOperacion:`delete:${claveRef(ref)}` });
        global.subliIntegridadFirebase = Object.freeze({ instalada:true, version:'1.4.1' });
    }
    global.instalarIntegridadFirebase = instalarIntegridadFirebase;
    global.leerRangoConfirmadoSubli = leerRangoConfirmado;
})(typeof window !== 'undefined' ? window : globalThis);
