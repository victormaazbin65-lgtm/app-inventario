(function(global) {
    'use strict';

    function usuarioOperativo() {
        try { return currentUserData || null; } catch { return null; }
    }

    function claveOperacion(texto) {
        let hash = 2166136261;
        for(const caracter of String(texto)) hash = Math.imul(hash ^ caracter.charCodeAt(0), 16777619);
        return (hash >>> 0).toString(36);
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
        const claveRef = ref => ref.path || String(ref);
        const idNuevo = () => global.crypto?.randomUUID?.() || `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const obtenerId = clave => {
            let id = pendientes.get(clave);
            try { id ||= global.sessionStorage?.getItem(clave); } catch {}
            id ||= idNuevo(); pendientes.set(clave, id);
            try { global.sessionStorage?.setItem(clave, id); } catch {}
            return id;
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
            const usuario = usuarioOperativo();
            const clave = `subli_op_pendiente_${global.firebaseAuthUser?.uid || 'local'}_${usuario?.id || 'inicio'}_${claveOperacion(opciones.claveOperacion || accion.toString())}`;
            const opId = opciones.opId || obtenerId(clave);
            const resultado = await nativo(db, async original => {
                const configRef = global.doc(db,'sistema','config');
                const configSnap = await original.get(configRef);
                const data = configSnap.exists() ? configSnap.data() : {};
                const registroRef = global.doc(db,'operaciones_sistema',opId);
                const previa = await original.get(registroRef);
                if(previa.exists()) return previa.data().tieneResultado ? previa.data().resultado : undefined;
                if(data.mantenimiento?.activo) throw new Error('El sistema está en recuperación. Las operaciones están pausadas para proteger tus datos.');
                if(Array.isArray(data.usuarios) && data.usuarios.length) {
                    if(!usuario) throw new Error('Ingresa con tu PIN antes de registrar una operación.');
                    const vigente = data.usuarios.find(u => String(u.id) === String(usuario.id) && u.pin === usuario.pin);
                    if(!vigente || vigente.rol !== usuario.rol || JSON.stringify(vigente.permisos || {}) !== JSON.stringify(usuario.permisos || {})) {
                        throw new Error('Tus permisos cambiaron. Actualiza el acceso antes de registrar otra operación.');
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
                for(const e of escrituras) {
                    if(e.tipo === 'delete') original.delete(e.ref);
                    else original[e.tipo](e.ref, e.datos, ...(e.opciones ? [e.opciones] : []));
                }
                const timestamp = Date.now();
                original.set(configRef, { revisionGlobal:revision + 1, ultimaOperacionEn:timestamp }, { merge:true });
                original.set(registroRef, { id:opId, timestamp, usuarioId:usuario?.id || null, tieneResultado:valor !== undefined, resultado:resultadoGuardado });
                original.set(global.doc(db,'auditoria_sistema',opId), {
                    id:opId, timestamp, tipo:'operacion_atomica', usuarioId:usuario?.id || null,
                    usuarioNombre:usuario?.nombre || 'Acceso del propietario', autorUID:global.firebaseAuthUser?.uid || null,
                    operaciones, version:'1.4.0'
                });
                return valor;
            }, { maxAttempts:opciones.maxAttempts || 5 });
            olvidarId(clave);
            return resultado;
        };
        // Las escrituras administrativas también participan de revisión, permisos y bitácora.
        global.setDoc = (ref,datos,opciones) => global.runTransaction(global.db, async t => { await t.get(ref); t.set(ref,datos,opciones); }, { claveOperacion:`set:${claveRef(ref)}:${JSON.stringify(datos)}:${JSON.stringify(opciones)}` });
        global.updateDoc = (ref,datos) => global.runTransaction(global.db, async t => { await t.get(ref); t.update(ref,datos); }, { claveOperacion:`update:${claveRef(ref)}:${JSON.stringify(datos)}` });
        global.deleteDoc = ref => global.runTransaction(global.db, async t => { await t.get(ref); t.delete(ref); }, { claveOperacion:`delete:${claveRef(ref)}` });
        global.subliIntegridadFirebase = Object.freeze({ instalada:true, version:'1.4.0' });
    }
    global.instalarIntegridadFirebase = instalarIntegridadFirebase;
    global.leerRangoConfirmadoSubli = leerRangoConfirmado;
})(typeof window !== 'undefined' ? window : globalThis);
