(function (global) {
    'use strict';

    const core = global.SubliNegocioCore;
    if (!core) throw new Error('SubliNegocioCore debe cargarse antes de gestion-negocio.js.');

    // Cuando las reglas ya están protegidas, un equipo nuevo no puede leer
    // sistema/config antes de iniciar sesión. Este estado permite mostrar el
    // acceso por correo sin exponer públicamente la configuración del negocio.
    let accesoFirebaseProtegido = false;

    function esDuenoActual() {
        return Boolean(currentUserData && currentUserData.rol === 'dueno');
    }

    function exigirDueno(mensaje = 'Solo el Dueño puede realizar esta operación.') {
        if (esDuenoActual()) return true;
        alert(mensaje);
        return false;
    }

    function exigirConexion() {
        if (global.db && navigator.onLine) return true;
        alert('📡 Esta operación necesita conexión para mantenerse igual en todos los dispositivos.');
        return false;
    }

    function fechaHoraNegocio(timestamp = Date.now()) {
        const fecha = new Date(timestamp);
        return fecha.toLocaleDateString('es-GT') + ' ' + fecha.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    }

    function monedaNegocio() {
        return core.normalizarConfiguracionNegocio(configuracionNegocio).moneda;
    }

    function dineroNegocio(valor) {
        return `${monedaNegocio()} ${core.redondearMoneda(valor).toFixed(2)}`;
    }

    function obtenerConfiguracionDocumento(data) {
        return core.normalizarConfiguracionNegocio(data && data.negocio ? data.negocio : data);
    }

    function sincronizarEstadoNegocio(data) {
        const totalFondos = core.totalFondos(data && data.fondos ? data.fondos : fondos);
        configuracionNegocio = obtenerConfiguracionDocumento(data || {});
        saldosDinero = core.normalizarSaldosDinero(data && data.saldosDinero, totalFondos + totalAnticiposPendientes());
        aplicarConfiguracionNegocio();
        actualizarPanelAccesoReal();
    }

    function aplicarConfiguracionNegocio() {
        const config = core.normalizarConfiguracionNegocio(configuracionNegocio);
        configuracionNegocio = config;
        document.title = `${config.nombreNegocio} - Inventario`;
        const nombreLogin = document.getElementById('login-nombre-negocio');
        if (nombreLogin) nombreLogin.textContent = config.nombreNegocio;
        document.querySelectorAll('[data-moneda]').forEach(el => { el.textContent = config.moneda; });
        document.querySelectorAll('[data-label-produccion]').forEach(el => { el.textContent = config.nombreFondoProduccion; });
        document.querySelectorAll('[data-label-mano-obra]').forEach(el => { el.textContent = config.nombreManoObra; });
        document.querySelectorAll('[data-porcentaje-sat]').forEach(el => { el.textContent = String(config.porcentajeSAT); });

        const valores = {
            'config-nombre-negocio': config.nombreNegocio,
            'config-moneda': config.moneda,
            'config-porcentaje-sat': config.porcentajeSAT,
            'config-margen-objetivo': config.margenObjetivo,
            'config-nombre-produccion': config.nombreFondoProduccion,
            'config-nombre-mano-obra': config.nombreManoObra,
            'config-auth-email': config.authPropietario.email
        };
        const ajustesVisibles = document.getElementById('sec-ajustes')?.style.display === 'block';
        if (!ajustesVisibles) {
            Object.entries(valores).forEach(([id, valor]) => {
                const campo = document.getElementById(id);
                if (campo) campo.value = valor;
            });
        }
        const estadoAuth = document.getElementById('config-auth-estado');
        const botonAuth = document.getElementById('btn-activar-auth');
        if (estadoAuth) {
            estadoAuth.textContent = config.authPropietario.habilitado
                ? `Cuenta activa: ${config.authPropietario.email}. La recuperación se envía a este correo.`
                : 'Cuenta real todavía no activada.';
        }
        if (botonAuth) botonAuth.textContent = config.authPropietario.habilitado ? 'Cuenta real activada' : 'Activar cuenta real';
        renderSelectoresUnidades();
        renderUnidadesPersonalizadasConfig();
        renderGestionNegocio();
    }

    async function guardarConfiguracionNegocio(unidadesPersonalizadasForzadas = null) {
        if (!exigirDueno() || !exigirConexion() || isProcessingTransaction) return false;
        const candidata = core.normalizarConfiguracionNegocio({
            ...configuracionNegocio,
            nombreNegocio: document.getElementById('config-nombre-negocio').value,
            moneda: document.getElementById('config-moneda').value,
            porcentajeSAT: document.getElementById('config-porcentaje-sat').value,
            margenObjetivo: document.getElementById('config-margen-objetivo').value,
            nombreFondoProduccion: document.getElementById('config-nombre-produccion').value,
            nombreManoObra: document.getElementById('config-nombre-mano-obra').value,
            unidadesPersonalizadas: Array.isArray(unidadesPersonalizadasForzadas)
                ? unidadesPersonalizadasForzadas
                : configuracionNegocio.unidadesPersonalizadas
        });
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const resultado = await global.runTransaction(global.db, async t => {
                const ref = global.doc(global.db, 'sistema', 'config');
                const snap = await t.get(ref);
                const data = snap.exists() ? snap.data() : {};
                const anterior = obtenerConfiguracionDocumento(data);
                const negocio = { ...candidata, authPropietario: anterior.authPropietario };
                t.set(ref, {
                    ...data,
                    negocio,
                    negocioRevision: Number(data.negocioRevision || 0) + 1,
                    ultimaActualizacionNegocio: timestamp
                });
                return negocio;
            });
            configuracionNegocio = resultado;
            aplicarConfiguracionNegocio();
            actualizarUI();
            alert('✅ Configuración guardada. Las ventas anteriores conservaron sus cifras originales.');
            return true;
        } catch (error) {
            alert('No se aplicó ningún cambio. ' + error.message);
            return false;
        } finally {
            isProcessingTransaction = false;
        }
    }

    function cuentaPropietarioAutorizada() {
        if (accesoFirebaseProtegido) return false;
        const auth = core.normalizarConfiguracionNegocio(configuracionNegocio).authPropietario;
        return !auth.habilitado || Boolean(global.firebaseAuthUser && global.firebaseAuthUser.uid === auth.uid);
    }

    function confirmarAccesoFirebaseDisponible() {
        accesoFirebaseProtegido = false;
        actualizarPanelAccesoReal();
    }

    function marcarAccesoFirebaseProtegido() {
        accesoFirebaseProtegido = true;
        currentUserData = null;
        const usuarioFirebase = global.firebaseAuthUser;
        actualizarPanelAccesoReal();
        if (usuarioFirebase) {
            mensajeAuth('La cuenta abierta no tiene acceso a este negocio. Inicia con la cuenta del Dueño.', true);
            if (global.firebaseAuth && global.firebaseSignOut) {
                global.firebaseSignOut(global.firebaseAuth).catch(error => {
                    console.warn('No se pudo cerrar la cuenta sin acceso.', error);
                });
            }
        } else {
            mensajeAuth('Esta información está protegida. Inicia con el correo y la contraseña del Dueño.');
        }
    }

    function actualizarPanelAccesoReal() {
        const login = document.getElementById('login-screen');
        const app = document.getElementById('main-app');
        const authPanel = document.getElementById('auth-login-panel');
        const pinPanel = document.getElementById('pin-login-panel');
        const cambiarCuenta = document.getElementById('btn-cambiar-cuenta');
        if (!login || !app || !authPanel || !pinPanel) return;
        const configAuth = core.normalizarConfiguracionNegocio(configuracionNegocio).authPropietario;
        const autorizado = cuentaPropietarioAutorizada();
        const requiereCuenta = accesoFirebaseProtegido || (configAuth.habilitado && !autorizado);
        authPanel.style.display = requiereCuenta ? 'block' : 'none';
        pinPanel.style.display = requiereCuenta ? 'none' : 'block';
        if (cambiarCuenta) cambiarCuenta.style.display = !accesoFirebaseProtegido && configAuth.habilitado && autorizado ? 'inline-block' : 'none';
        if (requiereCuenta) {
            currentUserData = null;
            app.style.display = 'none';
            login.style.display = 'flex';
            const email = document.getElementById('auth-login-email');
            if (email && !email.value) email.value = configAuth.email;
        }
    }

    function mensajeAuth(texto, esError = false) {
        const estado = document.getElementById('auth-login-estado');
        if (!estado) return;
        estado.textContent = texto;
        estado.style.color = esError ? 'var(--primary-red)' : 'var(--primary-green)';
    }

    async function iniciarSesionPropietario() {
        const email = String(document.getElementById('auth-login-email')?.value || '').trim().toLowerCase();
        const password = String(document.getElementById('auth-login-password')?.value || '');
        if (!email || !password) return mensajeAuth('Escribe el correo y la contraseña.', true);
        if (!global.firebaseAuth || !global.firebaseSignIn) return mensajeAuth('Firebase Auth todavía no está disponible.', true);
        mensajeAuth('Verificando cuenta…');
        try {
            const credencial = await global.firebaseSignIn(global.firebaseAuth, email, password);
            let authConfig = core.normalizarConfiguracionNegocio(configuracionNegocio).authPropietario;
            if (accesoFirebaseProtegido) {
                let dataServidor;
                try {
                    const snap = await global.getDoc(global.doc(global.db, 'sistema', 'config'));
                    if (!snap.exists()) throw new Error('No existe la configuración del negocio.');
                    dataServidor = snap.data() || {};
                } catch (errorServidor) {
                    await global.firebaseSignOut(global.firebaseAuth);
                    if (errorServidor?.code === 'permission-denied') {
                        throw new Error('Este correo no corresponde a la cuenta propietaria de este negocio.');
                    }
                    throw new Error('No se pudo confirmar la cuenta con el servidor. Revisa Internet e inténtalo otra vez.');
                }
                authConfig = obtenerConfiguracionDocumento(dataServidor).authPropietario;
                if (!authConfig.habilitado || !authConfig.uid || credencial.user.uid !== authConfig.uid) {
                    await global.firebaseSignOut(global.firebaseAuth);
                    throw new Error('Este correo no corresponde a la cuenta propietaria de este negocio.');
                }
                sincronizarEstadoNegocio(dataServidor);
                confirmarAccesoFirebaseDisponible();
                document.getElementById('auth-login-password').value = '';
                mensajeAuth('Cuenta verificada. Cargando la información protegida…');
                global.location.reload();
                return;
            }
            if (authConfig.habilitado && credencial.user.uid !== authConfig.uid) {
                await global.firebaseSignOut(global.firebaseAuth);
                throw new Error('Este correo no corresponde a la cuenta propietaria de este negocio.');
            }
            document.getElementById('auth-login-password').value = '';
            mensajeAuth('Cuenta verificada. Ahora ingresa tu PIN.');
            actualizarPanelAccesoReal();
            comprobarIngresoInicialLibre();
        } catch (error) {
            const comunes = {
                'auth/invalid-credential': 'Correo o contraseña incorrectos.',
                'auth/too-many-requests': 'Demasiados intentos. Espera un momento o recupera la contraseña.',
                'auth/network-request-failed': 'No se pudo conectar. Revisa Internet.'
            };
            mensajeAuth(comunes[error.code] || error.message || 'No fue posible iniciar sesión.', true);
        }
    }

    async function recuperarContrasenaPropietario(desdeAjustes = false) {
        const config = core.normalizarConfiguracionNegocio(configuracionNegocio);
        const campo = document.getElementById(desdeAjustes ? 'config-auth-email' : 'auth-login-email');
        const email = String(campo?.value || config.authPropietario.email || '').trim().toLowerCase();
        if (!email) return alert('Escribe primero el correo del Dueño.');
        if (!global.firebaseAuth || !global.firebaseSendPasswordReset) return alert('Firebase Auth todavía no está disponible.');
        try {
            await global.firebaseSendPasswordReset(global.firebaseAuth, email);
            alert(`✅ Se envió el enlace de recuperación a ${email}. Revisa también correo no deseado.`);
        } catch (error) {
            alert('No se pudo enviar la recuperación. ' + (error.message || 'Revisa el correo y la conexión.'));
        }
    }

    async function activarCuentaPropietario() {
        if (!exigirDueno() || !exigirConexion() || isProcessingTransaction) return;
        const email = String(document.getElementById('config-auth-email')?.value || '').trim().toLowerCase();
        const password = String(document.getElementById('config-auth-password')?.value || '');
        if (!/^\S+@\S+\.\S+$/.test(email)) return alert('Escribe un correo válido.');
        if (password.length < 6) return alert('La contraseña debe tener al menos 6 caracteres.');
        if (!confirm(`Se vinculará ${email} como cuenta propietaria. Ese correo podrá recuperar la contraseña. ¿Continuar?`)) return;
        isProcessingTransaction = true;
        try {
            let credencial;
            try {
                credencial = await global.firebaseCreateUser(global.firebaseAuth, email, password);
            } catch (error) {
                if (error.code !== 'auth/email-already-in-use') throw error;
                credencial = await global.firebaseSignIn(global.firebaseAuth, email, password);
            }
            const uid = credencial.user.uid;
            const negocio = await global.runTransaction(global.db, async t => {
                const ref = global.doc(global.db, 'sistema', 'config');
                const snap = await t.get(ref);
                const data = snap.exists() ? snap.data() : {};
                const actual = obtenerConfiguracionDocumento(data);
                if (actual.authPropietario.habilitado && actual.authPropietario.uid !== uid) {
                    throw new Error('Ya existe otra cuenta propietaria. No se reemplazó.');
                }
                const actualizado = core.normalizarConfiguracionNegocio({
                    ...actual,
                    authPropietario: { habilitado: true, email, uid }
                });
                t.set(ref, { ...data, negocio: actualizado, ultimaActualizacionAuth: Date.now() });
                return actualizado;
            });
            configuracionNegocio = negocio;
            document.getElementById('config-auth-password').value = '';
            aplicarConfiguracionNegocio();
            alert('✅ Cuenta real activada. Desde otro celular o computadora se pedirá este correo antes del PIN.');
        } catch (error) {
            alert('No se activó la cuenta. ' + (error.message || 'Revisa los datos.'));
        } finally {
            isProcessingTransaction = false;
        }
    }

    async function cerrarSesionPropietario() {
        try {
            if (global.firebaseAuth && global.firebaseSignOut) await global.firebaseSignOut(global.firebaseAuth);
        } catch (error) {
            console.warn('No se pudo cerrar Firebase Auth.', error);
        }
        currentUserData = null;
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        actualizarPanelAccesoReal();
    }

    async function guardarLogoNegocio(dataUrl) {
        if (!global.db || !navigator.onLine || !esDuenoActual()) return;
        try {
            await global.setDoc(global.doc(global.db, 'sistema', 'branding'), {
                logoDataUrl: dataUrl,
                actualizadoEn: Date.now(),
                actualizadoPor: currentUserData?.nombre || 'Dueño'
            }, { merge: true });
        } catch (error) {
            console.warn('El logo quedó guardado en este dispositivo, pero no se sincronizó.', error);
        }
    }

    function aplicarLogoSincronizado(data) {
        const logo = String(data?.logoDataUrl || '');
        if (!logo.startsWith('data:image/')) return;
        try { localStorage.setItem('subli_logo', logo); } catch (error) { console.warn('No se pudo guardar el logo local.', error); }
        mostrarLogo();
    }

    function limpiarFormularioCliente() {
        ['cliente-id', 'cliente-nombres', 'cliente-apellidos', 'cliente-telefono', 'cliente-direccion', 'cliente-notas'].forEach(id => {
            const campo = document.getElementById(id);
            if (campo) campo.value = '';
        });
        const nit = document.getElementById('cliente-nit');
        const limite = document.getElementById('cliente-limite');
        if (nit) nit.value = '';
        if (limite) limite.value = '0';
    }

    async function guardarCliente() {
        if (!exigirDueno('Solo el Dueño puede crear o modificar fichas de clientes.') || !exigirConexion() || isProcessingTransaction) return;
        let cliente;
        try {
            cliente = core.validarCliente({
                id: document.getElementById('cliente-id').value || generarIDSeguro(),
                nombres: document.getElementById('cliente-nombres').value,
                apellidos: document.getElementById('cliente-apellidos').value,
                telefono: document.getElementById('cliente-telefono').value,
                direccion: document.getElementById('cliente-direccion').value,
                nit: document.getElementById('cliente-nit').value,
                notas: document.getElementById('cliente-notas').value,
                limiteCredito: document.getElementById('cliente-limite').value
            });
        } catch (error) {
            return alert(error.message);
        }
        const duplicado = clientes.find(c => !c.archivado && c.nombreCompleto === cliente.nombreCompleto && String(c.id) !== String(cliente.id));
        if (duplicado && !confirm(`Ya existe “${duplicado.nombreCompleto}”. ¿Guardar de todos modos como otra ficha?`)) return;
        isProcessingTransaction = true;
        try {
            const registro = await global.runTransaction(global.db, async t => {
                const ref = global.doc(global.db, 'clientes', String(cliente.id));
                const snap = await t.get(ref);
                const anteriorServidor = snap.exists() ? snap.data() : null;
                const anteriorLocal = clientes.find(c => String(c.id) === String(cliente.id));
                const anterior = anteriorServidor || anteriorLocal || {};
                const saldoServidor = Number.isFinite(Number(anteriorServidor?.saldoCredito))
                    ? core.redondearMoneda(anteriorServidor.saldoCredito)
                    : saldoCreditoCalculadoCliente(cliente.id);
                const actualizado = {
                    ...anterior,
                    ...cliente,
                    saldoCredito: saldoServidor,
                    creadoEn: anterior.creadoEn || Date.now(),
                    actualizadoEn: Date.now(),
                    archivado: false
                };
                t.set(ref, actualizado);
                return actualizado;
            });
            clientes = fusionarPorId(clientes, [registro]);
            limpiarFormularioCliente();
            renderGestionNegocio();
            alert('✅ Cliente guardado.');
        } catch (error) {
            alert('No se guardó el cliente. ' + error.message);
        } finally {
            isProcessingTransaction = false;
        }
    }

    function editarCliente(id) {
        const cliente = clientes.find(c => String(c.id) === String(id));
        if (!cliente) return;
        const valores = {
            'cliente-id': cliente.id,
            'cliente-nombres': cliente.nombres,
            'cliente-apellidos': cliente.apellidos,
            'cliente-telefono': cliente.telefono,
            'cliente-direccion': cliente.direccion,
            'cliente-nit': cliente.nit === 'C/F' ? '' : cliente.nit,
            'cliente-notas': cliente.notas,
            'cliente-limite': cliente.limiteCredito
        };
        Object.entries(valores).forEach(([idCampo, valor]) => { document.getElementById(idCampo).value = valor ?? ''; });
        document.getElementById('sec-clientes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function archivarCliente(id) {
        if (!exigirDueno() || !exigirConexion() || isProcessingTransaction) return;
        const cliente = clientes.find(c => String(c.id) === String(id));
        if (!cliente) return;
        const credito = saldoCreditoCalculadoCliente(id);
        const anticiposPendientes = totalAnticiposCliente(id);
        if (core.aCentavos(credito) > 0 || core.aCentavos(anticiposPendientes) > 0) {
            return alert(`No se puede archivar: tiene ${dineroNegocio(credito)} por cobrar y ${dineroNegocio(anticiposPendientes)} en anticipos pendientes.`);
        }
        if (!confirm(`¿Archivar a ${cliente.nombreCompleto}? Las ventas y movimientos anteriores no se borrarán.`)) return;
        isProcessingTransaction = true;
        try {
            await global.runTransaction(global.db, async t => {
                const ref = global.doc(global.db, 'clientes', String(id));
                const snap = await t.get(ref);
                if (!snap.exists()) throw new Error('La ficha ya no existe en el servidor.');
                const actual = snap.data();
                if (core.aCentavos(actual.saldoCredito) > 0) {
                    throw new Error(`Tiene ${dineroNegocio(actual.saldoCredito)} por cobrar. Actualiza la lista antes de archivarlo.`);
                }
                t.update(ref, { archivado: true, archivadoEn: Date.now() });
            });
            clientes = clientes.map(c => String(c.id) === String(id) ? { ...c, archivado: true } : c);
            renderGestionNegocio();
        } catch (error) {
            alert('No se archivó. ' + error.message);
        } finally {
            isProcessingTransaction = false;
        }
    }

    function clientesActivos() {
        return clientes.filter(c => c && !c.archivado).sort((a, b) => String(a.nombreCompleto).localeCompare(String(b.nombreCompleto)));
    }

    function renderSelectoresClientes() {
        const activos = clientesActivos();
        const datalist = document.getElementById('lista-clientes');
        if (datalist) datalist.innerHTML = activos.map(c => `<option value="${escaparHTML(c.nombreCompleto)}">${escaparHTML(c.telefono || c.nit || '')}</option>`).join('');
        const selectAnticipo = document.getElementById('anticipo-cliente');
        if (selectAnticipo) {
            const anterior = selectAnticipo.value;
            selectAnticipo.innerHTML = '<option value="">Selecciona un cliente</option>' + activos.map(c => `<option value="${escaparHTML(c.id)}">${escaparHTML(c.nombreCompleto)}</option>`).join('');
            if (activos.some(c => String(c.id) === String(anterior))) selectAnticipo.value = anterior;
        }
    }

    function totalAnticiposCliente(clienteId) {
        return core.redondearMoneda(anticipos
            .filter(a => !a.anulado && String(a.clienteId) === String(clienteId))
            .reduce((total, a) => total + Math.max(0, Number(a.saldoPendiente) || 0), 0));
    }

    function totalAnticiposPendientes() {
        return core.redondearMoneda(anticipos.filter(a => !a.anulado).reduce((total, a) => total + Math.max(0, Number(a.saldoPendiente) || 0), 0));
    }

    function saldoCreditoCalculadoCliente(clienteId) {
        return core.redondearMoneda(ventas
            .filter(v => !v.anulada && String(v.clienteId) === String(clienteId))
            .reduce((total, v) => total + Math.max(0, Number(v.saldoPendiente) || 0), 0));
    }

    function sincronizarClienteEnFormulario(prefijo) {
        const nombre = String(document.getElementById(`${prefijo}-nombre`)?.value || '').trim().toUpperCase();
        const cliente = clientesActivos().find(c => String(c.nombreCompleto).toUpperCase() === nombre);
        const oculto = document.getElementById(`${prefijo}-cliente-id`);
        if (oculto) oculto.value = cliente ? cliente.id : '';
        if (cliente) {
            const nit = document.getElementById(`${prefijo}-nit`);
            if (nit && (!nit.value || nit.value === 'C/F')) nit.value = cliente.nit || 'C/F';
        }
        if (prefijo === 'venta') actualizarCamposCobroVenta();
    }

    function actualizarCamposCobroVenta() {
        const tipo = document.getElementById('venta-tipo-cobro')?.value || 'contado';
        const grupoPago = document.getElementById('grupo-venta-pago-inicial');
        const clienteId = document.getElementById('venta-cliente-id')?.value || '';
        const campoAnticipo = document.getElementById('venta-aplicar-anticipo');
        const disponible = totalAnticiposCliente(clienteId);
        if (grupoPago) grupoPago.style.display = tipo === 'credito' ? 'block' : 'none';
        if (campoAnticipo) {
            campoAnticipo.disabled = !clienteId || disponible <= 0;
            campoAnticipo.max = String(disponible);
            if (Number(campoAnticipo.value) > disponible || !clienteId) campoAnticipo.value = '0';
        }
        const aviso = document.getElementById('venta-anticipo-disponible');
        if (aviso) aviso.textContent = clienteId ? `Disponible: ${dineroNegocio(disponible)}.` : 'Selecciona un cliente guardado para usar anticipos.';
        if (tipo === 'credito' && !clienteId) {
            const nombre = document.getElementById('venta-nombre')?.value.trim();
            if (nombre) aviso.textContent += ' El crédito requiere elegir una ficha guardada.';
        }
    }

    function renderGestionClientes() {
        renderSelectoresClientes();
        const cont = document.getElementById('lista-clientes-gestion');
        if (!cont) return;
        const consulta = normalizarTexto(document.getElementById('buscar-cliente')?.value || '');
        const filtrados = clientesActivos().filter(c => busquedaInteligente(`${c.nombreCompleto} ${c.telefono} ${c.nit} ${c.direccion}`, consulta));
        if (!filtrados.length) {
            cont.innerHTML = '<p class="item-details">No hay clientes que coincidan.</p>';
            return;
        }
        cont.innerHTML = filtrados.map(c => {
            const pendiente = saldoCreditoCalculadoCliente(c.id);
            const limite = Number(c.limiteCredito || 0) > 0 ? dineroNegocio(c.limiteCredito) : 'sin límite';
            return `<div class="item-row"><div class="item-info"><p class="item-title">${escaparHTML(c.nombreCompleto)}</p><p class="item-details">${c.telefono ? '📞 ' + escaparHTML(c.telefono) + '<br>' : ''}NIT: ${escaparHTML(c.nit || 'C/F')} · Crédito: ${dineroNegocio(pendiente)} / ${escaparHTML(limite)} · Anticipos: ${dineroNegocio(totalAnticiposCliente(c.id))}</p></div><div style="display:flex;gap:5px;flex-wrap:wrap;"><button class="btn-sm btn-edit" onclick="editarCliente('${codificarParametroHTML(c.id)}')">Editar</button><button class="btn-sm btn-delete" onclick="archivarCliente('${codificarParametroHTML(c.id)}')">Archivar</button></div></div>`;
        }).join('');
    }

    function renderGestionNegocio() {
        renderGestionClientes();
        if (typeof global.renderFinanzasNegocio === 'function') global.renderFinanzasNegocio();
        actualizarCamposCobroVenta();
    }

    function unidadProducto(producto) {
        return core.obtenerUnidad(producto?.unidadId || 'pieza', configuracionNegocio);
    }

    function etiquetaUnidadProducto(producto, cantidad) {
        const unidad = unidadProducto(producto);
        return `${numeroFinito(cantidad)} ${unidad.abreviatura}`;
    }

    function renderSelectoresUnidades() {
        const unidades = core.listarUnidades(configuracionNegocio);
        ['inv-unidad', 'edit-unidad'].forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const anterior = select.value || 'pieza';
            select.innerHTML = unidades.map(u => `<option value="${escaparHTML(u.id)}">${escaparHTML(u.nombre)} (${escaparHTML(u.abreviatura)})${u.divisible ? ' · fraccionable' : ''}</option>`).join('');
            select.value = unidades.some(u => u.id === anterior) ? anterior : 'pieza';
        });
        actualizarUnidadIngreso();
        actualizarPasoEdicionUnidad();
    }

    function actualizarPasoUnidadPersonalizada() {
        const divisible = Boolean(document.getElementById('config-unidad-divisible')?.checked);
        const paso = document.getElementById('config-unidad-paso');
        if (!paso) return;
        paso.disabled = !divisible;
        if (!divisible) paso.value = '1';
        else if (Number(paso.value) <= 0 || Number(paso.value) >= 1) paso.value = '0.01';
    }

    function renderUnidadesPersonalizadasConfig() {
        const contenedor = document.getElementById('lista-unidades-personalizadas');
        if (!contenedor) return;
        const unidades = core.normalizarConfiguracionNegocio(configuracionNegocio).unidadesPersonalizadas;
        if (!unidades.length) {
            contenedor.innerHTML = '<p class="item-details">No hay unidades personalizadas.</p>';
            return;
        }
        contenedor.innerHTML = unidades.map(unidad => `<div class="item-row"><div class="item-info"><p class="item-title">${escaparHTML(unidad.nombre)} (${escaparHTML(unidad.abreviatura)})</p><p class="item-details">${unidad.divisible ? `Fraccionable · paso ${numeroFinito(unidad.paso)}` : 'Solo cantidades enteras'}</p></div><button class="btn-sm btn-delete" onclick="eliminarUnidadPersonalizada('${codificarParametroHTML(unidad.id)}')">Eliminar</button></div>`).join('');
    }

    async function agregarUnidadPersonalizada() {
        if (!exigirDueno()) return;
        const nombre = String(document.getElementById('config-unidad-nombre')?.value || '').trim();
        const abreviatura = String(document.getElementById('config-unidad-abreviatura')?.value || '').trim();
        const divisible = Boolean(document.getElementById('config-unidad-divisible')?.checked);
        const paso = divisible ? Number(document.getElementById('config-unidad-paso')?.value) : 1;
        if (!nombre) return alert('Escribe el nombre de la unidad.');
        if (!abreviatura) return alert('Escribe una abreviatura para la unidad.');
        if (divisible && (!Number.isFinite(paso) || paso <= 0 || paso > 1)) return alert('El paso debe estar entre 0.001 y 1.');
        const actual = core.normalizarConfiguracionNegocio(configuracionNegocio).unidadesPersonalizadas;
        const normalizada = core.normalizarConfiguracionNegocio({
            ...configuracionNegocio,
            unidadesPersonalizadas: [{ nombre, abreviatura, divisible, paso }]
        }).unidadesPersonalizadas[0];
        if (!normalizada) return alert('No se pudo crear una unidad válida con esos datos.');
        const todas = core.listarUnidades(configuracionNegocio);
        if (todas.some(unidad => unidad.id === normalizada.id || String(unidad.nombre).toLowerCase() === normalizada.nombre.toLowerCase())) {
            return alert('Ya existe una unidad con ese nombre.');
        }
        if (!(await guardarConfiguracionNegocio([...actual, normalizada]))) return;
        document.getElementById('config-unidad-nombre').value = '';
        document.getElementById('config-unidad-abreviatura').value = '';
        document.getElementById('config-unidad-divisible').checked = false;
        actualizarPasoUnidadPersonalizada();
    }

    async function eliminarUnidadPersonalizada(idCodificado) {
        if (!exigirDueno()) return;
        const id = decodeURIComponent(idCodificado);
        const actual = core.normalizarConfiguracionNegocio(configuracionNegocio).unidadesPersonalizadas;
        const unidad = actual.find(item => item.id === id);
        if (!unidad) return;
        if (inventario.some(producto => String(producto.unidadId || 'pieza') === id)) {
            return alert(`No puedes eliminar “${unidad.nombre}” porque está asignada a productos del inventario.`);
        }
        if (!confirm(`¿Eliminar la unidad “${unidad.nombre}”?`)) return;
        await guardarConfiguracionNegocio(actual.filter(item => item.id !== id));
    }

    function actualizarUnidadIngresoDesdeProducto(idProducto) {
        const producto = inventario.find(p => String(p.id) === String(idProducto));
        if (!producto) return;
        const select = document.getElementById('inv-unidad');
        if (select) select.value = producto.unidadId || 'pieza';
        actualizarUnidadIngreso(producto);
    }

    function actualizarUnidadIngreso(productoForzado) {
        const modo = document.getElementById('inv-modo')?.value || 'existente';
        const producto = productoForzado || inventario.find(p => String(p.id) === String(document.getElementById('ingreso-producto-id')?.value || ''));
        const unidadId = modo === 'nuevo' ? document.getElementById('inv-unidad')?.value : (producto?.unidadId || 'pieza');
        const unidad = core.obtenerUnidad(unidadId, configuracionNegocio);
        const stock = document.getElementById('inv-stock');
        const contenido = document.getElementById('inv-contenido-compra');
        if (stock) stock.step = unidad.divisible ? String(unidad.paso) : '1';
        if (contenido) contenido.step = unidad.divisible ? String(unidad.paso) : '1';
        const ayuda = document.getElementById('ayuda-contenido-compra');
        if (ayuda) ayuda.textContent = `El resultado se guardará en ${unidad.nombre.toLowerCase()} (${unidad.abreviatura}). Ejemplo: cantidad comprada × contenido por compra.`;
        cambiarLabelCosto();
    }

    function actualizarPasoEdicionUnidad() {
        const unidad = core.obtenerUnidad(document.getElementById('edit-unidad')?.value || 'pieza', configuracionNegocio);
        ['edit-stock', 'edit-min'].forEach(id => {
            const campo = document.getElementById(id);
            if (campo) campo.step = unidad.divisible ? String(unidad.paso) : '1';
        });
    }

    function validarCantidadProducto(valor, producto) {
        return core.normalizarCantidad(valor, unidadProducto(producto));
    }

    global.esDuenoActual = esDuenoActual;
    global.exigirDueno = exigirDueno;
    global.fechaHoraNegocio = fechaHoraNegocio;
    global.monedaNegocio = monedaNegocio;
    global.dineroNegocio = dineroNegocio;
    global.sincronizarEstadoNegocio = sincronizarEstadoNegocio;
    global.aplicarConfiguracionNegocio = aplicarConfiguracionNegocio;
    global.guardarConfiguracionNegocio = guardarConfiguracionNegocio;
    global.cuentaPropietarioAutorizada = cuentaPropietarioAutorizada;
    global.confirmarAccesoFirebaseDisponible = confirmarAccesoFirebaseDisponible;
    global.marcarAccesoFirebaseProtegido = marcarAccesoFirebaseProtegido;
    global.actualizarPanelAccesoReal = actualizarPanelAccesoReal;
    global.iniciarSesionPropietario = iniciarSesionPropietario;
    global.recuperarContrasenaPropietario = recuperarContrasenaPropietario;
    global.activarCuentaPropietario = activarCuentaPropietario;
    global.cerrarSesionPropietario = cerrarSesionPropietario;
    global.guardarLogoNegocio = guardarLogoNegocio;
    global.aplicarLogoSincronizado = aplicarLogoSincronizado;
    global.guardarCliente = guardarCliente;
    global.editarCliente = id => editarCliente(decodeURIComponent(id));
    global.archivarCliente = id => archivarCliente(decodeURIComponent(id));
    global.limpiarFormularioCliente = limpiarFormularioCliente;
    global.renderGestionClientes = renderGestionClientes;
    global.renderGestionNegocio = renderGestionNegocio;
    global.sincronizarClienteEnFormulario = sincronizarClienteEnFormulario;
    global.actualizarCamposCobroVenta = actualizarCamposCobroVenta;
    global.totalAnticiposCliente = totalAnticiposCliente;
    global.totalAnticiposPendientes = totalAnticiposPendientes;
    global.saldoCreditoCalculadoCliente = saldoCreditoCalculadoCliente;
    global.unidadProducto = unidadProducto;
    global.etiquetaUnidadProducto = etiquetaUnidadProducto;
    global.renderSelectoresUnidades = renderSelectoresUnidades;
    global.actualizarPasoUnidadPersonalizada = actualizarPasoUnidadPersonalizada;
    global.renderUnidadesPersonalizadasConfig = renderUnidadesPersonalizadasConfig;
    global.agregarUnidadPersonalizada = agregarUnidadPersonalizada;
    global.eliminarUnidadPersonalizada = eliminarUnidadPersonalizada;
    global.actualizarUnidadIngresoDesdeProducto = actualizarUnidadIngresoDesdeProducto;
    global.actualizarUnidadIngreso = actualizarUnidadIngreso;
    global.actualizarPasoEdicionUnidad = actualizarPasoEdicionUnidad;
    global.validarCantidadProducto = validarCantidadProducto;

    global.addEventListener('firebaseAuthCambio', actualizarPanelAccesoReal);
})(window);
