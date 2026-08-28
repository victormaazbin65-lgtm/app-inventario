(function (global) {
    'use strict';

    const core = global.SubliNegocioCore;
    if (!core) throw new Error('SubliNegocioCore debe cargarse antes de finanzas-negocio.js.');

    function saldoServidor(data) {
        return core.normalizarSaldosDinero(data?.saldosDinero, core.totalFondos(data?.fondos));
    }

    function cambiarSaldo(saldos, ubicacion, monto, signo = 1) {
        const salida = { ...saldos, inicializado: true };
        const centavos = core.aCentavos(salida[ubicacion]) + signo * core.aCentavos(monto);
        if (centavos < 0) throw new Error(`No hay suficiente dinero en ${ubicacion === 'banco' ? 'banco' : 'efectivo'}.`);
        salida[ubicacion] = core.desdeCentavos(centavos);
        return salida;
    }

    function movimientoCaja(tipo, monto, ubicacion, detalles = {}) {
        const timestamp = Date.now();
        return {
            id: generarIDSeguro(),
            timestamp,
            fecha: fechaHoraNegocio(timestamp),
            tipo,
            monto: core.redondearMoneda(monto),
            ubicacion,
            usuarioId: currentUserData?.id || null,
            usuarioNombre: currentUserData?.nombre || 'Dueño',
            ...detalles
        };
    }

    function desgloseVenta(venta) {
        return {
            ingresoTotal: core.redondearMoneda(venta?.ingresoTotal),
            costosProductos: core.redondearMoneda(venta?.costosProductos),
            costoTinta: core.redondearMoneda(venta?.costoTinta),
            costoEnvio: core.redondearMoneda(venta?.costoEnvio),
            costoManoObra: core.redondearMoneda(venta?.costoManoObra),
            impuestoSAT: core.redondearMoneda(venta?.impuestoSAT),
            gananciaNeta: core.redondearMoneda(venta?.ganancia),
            pideFactura: Boolean(venta?.factura),
            tasaSAT: Number(venta?.tasaSAT || 0)
        };
    }

    function asignacionVentaActual(venta) {
        return venta?.asignacionFondosCobrado
            ? core.normalizarFondos(venta.asignacionFondosCobrado)
            : core.calcularAsignacionFondos(desgloseVenta(venta), Number(venta?.montoCobradoTotal ?? venta?.ingresoTotal));
    }

    function calcularDesgloseRetiroConSAT(monto, fondosEntrada) {
        const solicitado = core.aCentavos(monto);
        if (solicitado <= 0) throw new Error('El monto debe ser mayor a cero.');
        const orden = ['gananciaLibre', 'costoLuzTinta', 'costoProducto', 'fondoImpuestos'];
        const desglose = { costoProducto: 0, costoLuzTinta: 0, gananciaLibre: 0, fondoImpuestos: 0 };
        let pendiente = solicitado;
        orden.forEach(clave => {
            const disponible = Math.max(0, core.aCentavos(fondosEntrada?.[clave]));
            const parte = Math.min(disponible, pendiente);
            desglose[clave] = core.desdeCentavos(parte);
            pendiente -= parte;
        });
        if (pendiente > 0) throw new Error('Los fondos acumulados no alcanzan para ese monto.');
        return { ...desglose, total: core.desdeCentavos(solicitado) };
    }

    function descontarDesglose(fondosEntrada, desglose) {
        const salida = core.normalizarFondos(fondosEntrada);
        core.CLAVES_FONDOS.forEach(clave => {
            const restante = core.aCentavos(salida[clave]) - core.aCentavos(desglose?.[clave]);
            if (restante < 0) throw new Error(`El fondo ${clave} ya no alcanza para completar la operación.`);
            salida[clave] = core.desdeCentavos(restante);
        });
        return salida;
    }

    async function registrarAnticipoCliente() {
        if (!exigirDueno('Solo el Dueño puede registrar anticipos.') || !navigator.onLine || isProcessingTransaction) return;
        const clienteId = document.getElementById('anticipo-cliente').value;
        const cliente = clientes.find(c => String(c.id) === String(clienteId) && !c.archivado);
        const monto = Number(document.getElementById('anticipo-monto').value);
        const metodo = document.getElementById('anticipo-metodo').value;
        const motivo = document.getElementById('anticipo-motivo').value.trim();
        if (!cliente) return alert('Selecciona un cliente guardado.');
        if (!Number.isFinite(monto) || monto <= 0) return alert('Escribe un monto válido mayor a cero.');
        if (!motivo) return alert('Escribe el motivo o trabajo del anticipo.');
        const ubicacion = core.ubicacionMetodoPago(metodo);
        if (!confirm(`Registrar ${dineroNegocio(monto)} como anticipo de ${cliente.nombreCompleto} en ${ubicacion}?`)) return;
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const anticipo = {
                id: generarIDSeguro(), clienteId: String(cliente.id), clienteNombre: cliente.nombreCompleto,
                montoOriginal: core.redondearMoneda(monto), saldoPendiente: core.redondearMoneda(monto),
                aplicadoTotal: 0, devueltoTotal: 0, metodo, ubicacion, motivo,
                timestamp, fecha: fechaHoraNegocio(timestamp), estado: 'pendiente', versionCalculo: 1
            };
            const movimiento = movimientoCaja('anticipo_recibido', monto, ubicacion, { clienteId: cliente.id, referenciaId: anticipo.id, motivo });
            const resultado = await global.runTransaction(global.db, async t => {
                const configRef = global.doc(global.db, 'sistema', 'config');
                const clienteRef = global.doc(global.db, 'clientes', String(cliente.id));
                const configSnap = await t.get(configRef);
                const clienteSnap = await t.get(clienteRef);
                if (!clienteSnap.exists() || clienteSnap.data().archivado) {
                    throw new Error('El cliente ya no está activo. Actualiza la lista e inténtalo otra vez.');
                }
                const data = configSnap.exists() ? configSnap.data() : {};
                const clienteServidor = clienteSnap.data();
                const anticipoServidor = { ...anticipo, clienteNombre: clienteServidor.nombreCompleto || cliente.nombreCompleto };
                const movimientoServidor = { ...movimiento, clienteId: String(cliente.id), referenciaId: anticipoServidor.id };
                const saldos = cambiarSaldo(saldoServidor(data), ubicacion, monto, 1);
                t.set(configRef, { ...data, saldosDinero: saldos, ultimaActualizacion: timestamp });
                t.set(global.doc(global.db, 'anticipos', String(anticipoServidor.id)), anticipoServidor);
                t.set(global.doc(global.db, 'movimientos_caja', String(movimientoServidor.id)), movimientoServidor);
                return { saldos, anticipo: anticipoServidor, movimiento: movimientoServidor };
            });
            saldosDinero = resultado.saldos;
            anticipos = fusionarPorId(anticipos, [resultado.anticipo]);
            movimientosCaja = fusionarPorId(movimientosCaja, [resultado.movimiento]);
            document.getElementById('anticipo-monto').value = '';
            document.getElementById('anticipo-motivo').value = '';
            renderFinanzasNegocio(); actualizarUI();
            alert('✅ Anticipo registrado sin contarlo todavía como venta ni ganancia.');
        } catch (error) {
            alert('No se registró el anticipo. ' + error.message);
        } finally { isProcessingTransaction = false; }
    }

    async function devolverAnticipo(idCodificado) {
        if (!exigirDueno() || !navigator.onLine || isProcessingTransaction) return;
        const id = decodeURIComponent(idCodificado);
        const local = anticipos.find(a => String(a.id) === String(id));
        if (!local || Number(local.saldoPendiente) <= 0) return;
        const texto = prompt(`Saldo disponible: ${dineroNegocio(local.saldoPendiente)}. ¿Cuánto devolver?`, Number(local.saldoPendiente).toFixed(2));
        if (texto === null) return;
        const monto = Number(texto);
        if (!Number.isFinite(monto) || monto <= 0 || core.aCentavos(monto) > core.aCentavos(local.saldoPendiente)) return alert('Monto de devolución inválido.');
        const metodo = prompt('Método de devolución: escribe efectivo, transferencia o deposito.', local.metodo || 'efectivo');
        if (metodo === null) return;
        if (!core.METODOS_PAGO[String(metodo).toLowerCase()]) return alert('Método no válido.');
        const metodoNormal = String(metodo).toLowerCase();
        const ubicacion = core.ubicacionMetodoPago(metodoNormal);
        if (!confirm(`Devolver ${dineroNegocio(monto)} a ${local.clienteNombre} desde ${ubicacion}?`)) return;
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const movimiento = movimientoCaja('anticipo_devuelto', monto, ubicacion, { clienteId: local.clienteId, referenciaId: id });
            const resultado = await global.runTransaction(global.db, async t => {
                const anticipoRef = global.doc(global.db, 'anticipos', String(id));
                const configRef = global.doc(global.db, 'sistema', 'config');
                const anticipoSnap = await t.get(anticipoRef);
                const configSnap = await t.get(configRef);
                if (!anticipoSnap.exists()) throw new Error('El anticipo ya no existe.');
                const actual = anticipoSnap.data();
                if (core.aCentavos(monto) > core.aCentavos(actual.saldoPendiente)) throw new Error('El saldo cambió desde otro dispositivo.');
                const data = configSnap.exists() ? configSnap.data() : {};
                const saldos = cambiarSaldo(saldoServidor(data), ubicacion, monto, -1);
                const saldoNuevo = core.desdeCentavos(core.aCentavos(actual.saldoPendiente) - core.aCentavos(monto));
                const actualizado = { ...actual, saldoPendiente: saldoNuevo, devueltoTotal: core.redondearMoneda(Number(actual.devueltoTotal || 0) + monto), estado: saldoNuevo === 0 ? 'devuelto' : 'pendiente', actualizadoEn: timestamp };
                t.set(anticipoRef, actualizado);
                t.set(configRef, { ...data, saldosDinero: saldos, ultimaActualizacion: timestamp });
                t.set(global.doc(global.db, 'movimientos_caja', String(movimiento.id)), movimiento);
                return { actualizado, saldos };
            });
            saldosDinero = resultado.saldos;
            anticipos = fusionarPorId(anticipos, [resultado.actualizado]);
            movimientosCaja = fusionarPorId(movimientosCaja, [movimiento]);
            renderFinanzasNegocio(); actualizarUI();
            alert('✅ Devolución de anticipo registrada.');
        } catch (error) { alert('No se realizó la devolución. ' + error.message); }
        finally { isProcessingTransaction = false; }
    }

    async function registrarTrasladoDinero() {
        if (!exigirDueno() || !navigator.onLine || isProcessingTransaction) return;
        const direccion = document.getElementById('traslado-direccion').value;
        const monto = Number(document.getElementById('traslado-monto').value);
        const motivo = document.getElementById('traslado-motivo').value.trim() || 'TRASLADO ENTRE CUENTAS';
        if (!Number.isFinite(monto) || monto <= 0) return alert('Monto inválido.');
        const origen = direccion === 'banco-efectivo' ? 'banco' : 'efectivo';
        const destino = origen === 'banco' ? 'efectivo' : 'banco';
        if (!confirm(`Mover ${dineroNegocio(monto)} de ${origen} a ${destino}? Esto no cambia la ganancia.`)) return;
        isProcessingTransaction = true;
        try {
            const movimiento = movimientoCaja('traslado', monto, origen, { destino, motivo });
            const saldos = await global.runTransaction(global.db, async t => {
                const ref = global.doc(global.db, 'sistema', 'config');
                const snap = await t.get(ref);
                const data = snap.exists() ? snap.data() : {};
                let nuevos = cambiarSaldo(saldoServidor(data), origen, monto, -1);
                nuevos = cambiarSaldo(nuevos, destino, monto, 1);
                t.set(ref, { ...data, saldosDinero: nuevos, ultimaActualizacion: Date.now() });
                t.set(global.doc(global.db, 'movimientos_caja', String(movimiento.id)), movimiento);
                return nuevos;
            });
            saldosDinero = saldos; movimientosCaja = fusionarPorId(movimientosCaja, [movimiento]);
            document.getElementById('traslado-monto').value = ''; document.getElementById('traslado-motivo').value = '';
            renderFinanzasNegocio(); actualizarUI(); alert('✅ Traslado registrado.');
        } catch (error) { alert('No se realizó el traslado. ' + error.message); }
        finally { isProcessingTransaction = false; }
    }

    function desgloseRetiro(monto, fondosEntrada, modo) {
        if (modo === 'total') return calcularDesgloseRetiroConSAT(monto, fondosEntrada);
        return calcularDesgloseRetiroInteligente(monto, fondosEntrada, modo);
    }

    async function registrarRetiroCaja() {
        if (!exigirDueno() || !navigator.onLine || isProcessingTransaction) return;
        const origen = document.getElementById('caja-retiro-origen').value;
        const modo = document.getElementById('caja-retiro-modo').value;
        const monto = Number(document.getElementById('caja-retiro-monto').value);
        const motivo = document.getElementById('caja-retiro-motivo').value.trim();
        if (!Number.isFinite(monto) || monto <= 0) return alert('Monto inválido.');
        if (!motivo) return alert('Escribe el motivo del retiro.');
        let previo;
        try { previo = desgloseRetiro(monto, fondos, modo); } catch (error) { return alert(error.message); }
        if (!confirm(`Retirar ${dineroNegocio(monto)} de ${origen}?\n\n${formatearDesgloseRetiro(previo)}`)) return;
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const retiro = { id: generarIDSeguro(), timestamp, fecha: fechaHoraNegocio(timestamp), tipo: motivo.toUpperCase(), monto: core.redondearMoneda(monto), ubicacion: origen, modoRetiro: modo, desglose: previo, usuarioNombre: currentUserData?.nombre || 'Dueño', versionCalculo: 4 };
            const movimiento = movimientoCaja('retiro', monto, origen, { referenciaId: retiro.id, motivo });
            const resultado = await global.runTransaction(global.db, async t => {
                const configRef = global.doc(global.db, 'sistema', 'config');
                const configSnap = await t.get(configRef);
                if (!configSnap.exists()) throw new Error('No se encontró la configuración.');
                const data = configSnap.data();
                const desglose = desgloseRetiro(monto, data.fondos, modo);
                const fondosNuevos = descontarDesglose(data.fondos, desglose);
                const saldos = cambiarSaldo(saldoServidor(data), origen, monto, -1);
                t.set(configRef, { ...data, fondos: fondosNuevos, saldosDinero: saldos, ultimaActualizacion: timestamp });
                t.set(global.doc(global.db, 'retiros', String(retiro.id)), { ...retiro, desglose });
                t.set(global.doc(global.db, 'movimientos_caja', String(movimiento.id)), movimiento);
                return { fondosNuevos, saldos, retiro: { ...retiro, desglose } };
            });
            fondos = resultado.fondosNuevos; saldosDinero = resultado.saldos;
            historialRetiros = fusionarPorId(historialRetiros, [resultado.retiro]); movimientosCaja = fusionarPorId(movimientosCaja, [movimiento]);
            document.getElementById('caja-retiro-monto').value = ''; document.getElementById('caja-retiro-motivo').value = '';
            guardarDatos(); renderFinanzasNegocio(); actualizarUI(); alert('✅ Retiro registrado en fondos y ubicación.');
        } catch (error) { alert('No se realizó el retiro. ' + error.message); }
        finally { isProcessingTransaction = false; }
    }

    async function registrarPrestamo() {
        if (!exigirDueno() || !navigator.onLine || isProcessingTransaction) return;
        const persona = document.getElementById('prestamo-persona').value.trim().toUpperCase();
        const motivo = document.getElementById('prestamo-motivo').value.trim();
        const monto = Number(document.getElementById('prestamo-monto').value);
        const origen = document.getElementById('prestamo-origen').value;
        const vencimiento = document.getElementById('prestamo-vencimiento').value || '';
        if (!persona || !motivo) return alert('Escribe la persona y el motivo.');
        if (!Number.isFinite(monto) || monto <= 0) return alert('Monto inválido.');
        let previo;
        try { previo = calcularDesgloseRetiroInteligente(monto, fondos, 'inteligente'); } catch (error) { return alert(error.message + ' El préstamo protege el fondo SAT.'); }
        if (!confirm(`Prestar ${dineroNegocio(monto)} a ${persona} desde ${origen}? El dinero se marcará por cobrar.`)) return;
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const prestamo = { id: generarIDSeguro(), persona, motivo, montoOriginal: core.redondearMoneda(monto), devueltoTotal: 0, saldoPendiente: core.redondearMoneda(monto), origen, vencimiento, desgloseFondos: previo, timestamp, fecha: fechaHoraNegocio(timestamp), estado: 'pendiente', abonos: [], versionCalculo: 1 };
            const movimiento = movimientoCaja('prestamo_entregado', monto, origen, { referenciaId: prestamo.id, motivo: `${persona}: ${motivo}` });
            const resultado = await global.runTransaction(global.db, async t => {
                const configRef = global.doc(global.db, 'sistema', 'config');
                const snap = await t.get(configRef);
                if (!snap.exists()) throw new Error('No se encontró la configuración.');
                const data = snap.data();
                const desglose = calcularDesgloseRetiroInteligente(monto, data.fondos, 'inteligente');
                const fondosNuevos = descontarDesglose(data.fondos, desglose);
                const saldos = cambiarSaldo(saldoServidor(data), origen, monto, -1);
                const registro = { ...prestamo, desgloseFondos: desglose };
                t.set(configRef, { ...data, fondos: fondosNuevos, saldosDinero: saldos, ultimaActualizacion: timestamp });
                t.set(global.doc(global.db, 'prestamos', String(prestamo.id)), registro);
                t.set(global.doc(global.db, 'movimientos_caja', String(movimiento.id)), movimiento);
                return { fondosNuevos, saldos, registro };
            });
            fondos = resultado.fondosNuevos; saldosDinero = resultado.saldos; prestamos = fusionarPorId(prestamos, [resultado.registro]); movimientosCaja = fusionarPorId(movimientosCaja, [movimiento]);
            ['prestamo-persona', 'prestamo-monto', 'prestamo-motivo', 'prestamo-vencimiento'].forEach(id => { document.getElementById(id).value = ''; });
            guardarDatos(); renderFinanzasNegocio(); actualizarUI(); alert('✅ Préstamo registrado.');
        } catch (error) { alert('No se registró el préstamo. ' + error.message); }
        finally { isProcessingTransaction = false; }
    }

    async function abonarPrestamo(idCodificado) {
        if (!exigirDueno() || !navigator.onLine || isProcessingTransaction) return;
        const id = decodeURIComponent(idCodificado);
        const local = prestamos.find(p => String(p.id) === String(id));
        if (!local || Number(local.saldoPendiente) <= 0) return;
        const texto = prompt(`Saldo de ${local.persona}: ${dineroNegocio(local.saldoPendiente)}. Monto devuelto:`, Number(local.saldoPendiente).toFixed(2));
        if (texto === null) return;
        const monto = Number(texto);
        if (!Number.isFinite(monto) || monto <= 0 || core.aCentavos(monto) > core.aCentavos(local.saldoPendiente)) return alert('Monto inválido.');
        const metodo = prompt('¿Cómo regresó? efectivo, transferencia o deposito.', local.origen === 'banco' ? 'transferencia' : 'efectivo');
        if (metodo === null || !core.METODOS_PAGO[String(metodo).toLowerCase()]) return alert('Método no válido.');
        const ubicacion = core.ubicacionMetodoPago(String(metodo).toLowerCase());
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const movimiento = movimientoCaja('prestamo_devuelto', monto, ubicacion, { referenciaId: id, motivo: local.persona });
            const resultado = await global.runTransaction(global.db, async t => {
                const prestamoRef = global.doc(global.db, 'prestamos', String(id));
                const configRef = global.doc(global.db, 'sistema', 'config');
                const prestamoSnap = await t.get(prestamoRef);
                const configSnap = await t.get(configRef);
                if (!prestamoSnap.exists() || !configSnap.exists()) throw new Error('El préstamo o la configuración ya no existe.');
                const actual = prestamoSnap.data();
                if (core.aCentavos(monto) > core.aCentavos(actual.saldoPendiente)) throw new Error('El saldo cambió desde otro dispositivo.');
                const restitucion = core.calcularRestitucionPrestamo(actual.desgloseFondos, actual.montoOriginal, actual.devueltoTotal, monto);
                const data = configSnap.data();
                const fondosNuevos = core.sumarAsignacion(data.fondos, restitucion.restauracion, 1);
                const saldos = cambiarSaldo(saldoServidor(data), ubicacion, restitucion.montoAplicado, 1);
                const abono = { id: movimiento.id, timestamp, fecha: fechaHoraNegocio(timestamp), monto: restitucion.montoAplicado, metodo: String(metodo).toLowerCase(), ubicacion };
                const actualizado = { ...actual, devueltoTotal: restitucion.devueltoAcumulado, saldoPendiente: core.desdeCentavos(core.aCentavos(actual.montoOriginal) - core.aCentavos(restitucion.devueltoAcumulado)), estado: restitucion.pagado ? 'pagado' : 'pendiente', abonos: [...(actual.abonos || []), abono], actualizadoEn: timestamp };
                t.set(configRef, { ...data, fondos: fondosNuevos, saldosDinero: saldos, ultimaActualizacion: timestamp });
                t.set(prestamoRef, actualizado);
                t.set(global.doc(global.db, 'movimientos_caja', String(movimiento.id)), movimiento);
                return { fondosNuevos, saldos, actualizado };
            });
            fondos = resultado.fondosNuevos; saldosDinero = resultado.saldos; prestamos = fusionarPorId(prestamos, [resultado.actualizado]); movimientosCaja = fusionarPorId(movimientosCaja, [movimiento]);
            guardarDatos(); renderFinanzasNegocio(); actualizarUI(); alert('✅ Devolución del préstamo aplicada a los mismos fondos originales.');
        } catch (error) { alert('No se aplicó el abono. ' + error.message); }
        finally { isProcessingTransaction = false; }
    }

    async function registrarAbonoCredito(idCodificado) {
        if (!exigirDueno('Solo el Dueño puede registrar abonos de crédito.') || !navigator.onLine || isProcessingTransaction) return;
        const id = decodeURIComponent(idCodificado);
        const local = ventas.find(v => String(v.id) === String(id) && !v.anulada);
        if (!local || Number(local.saldoPendiente) <= 0) return;
        const texto = prompt(`Saldo pendiente: ${dineroNegocio(local.saldoPendiente)}. Monto del abono:`, Number(local.saldoPendiente).toFixed(2));
        if (texto === null) return;
        const monto = Number(texto);
        if (!Number.isFinite(monto) || monto <= 0 || core.aCentavos(monto) > core.aCentavos(local.saldoPendiente)) return alert('Monto inválido.');
        const metodo = prompt('Método: efectivo, transferencia o deposito.', 'efectivo');
        if (metodo === null || !core.METODOS_PAGO[String(metodo).toLowerCase()]) return alert('Método no válido.');
        const metodoNormal = String(metodo).toLowerCase();
        const ubicacion = core.ubicacionMetodoPago(metodoNormal);
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const pagoId = generarIDSeguro();
            const movimiento = movimientoCaja('abono_credito', monto, ubicacion, { referenciaId: id, clienteId: local.clienteId, motivo: local.clienteNombre });
            const resultado = await global.runTransaction(global.db, async t => {
                const ventaRef = global.doc(global.db, 'ventas', String(id));
                const configRef = global.doc(global.db, 'sistema', 'config');
                const ventaSnap = await t.get(ventaRef);
                const configSnap = await t.get(configRef);
                if (!ventaSnap.exists() || !configSnap.exists()) throw new Error('La venta o configuración ya no existe.');
                const venta = ventaSnap.data();
                let clienteRef = null;
                let clienteServidor = null;
                if (venta.clienteId) {
                    clienteRef = global.doc(global.db, 'clientes', String(venta.clienteId));
                    const clienteSnap = await t.get(clienteRef);
                    if (clienteSnap.exists()) clienteServidor = clienteSnap.data();
                }
                if (venta.anulada || Number(venta.saldoPendiente) <= 0) throw new Error('La cuenta ya no tiene saldo pendiente.');
                if (core.aCentavos(monto) > core.aCentavos(venta.saldoPendiente)) throw new Error('El saldo cambió desde otro dispositivo.');
                const cobradoAnterior = core.redondearMoneda(Number(venta.montoCobradoTotal || 0));
                const cobradoNuevo = core.redondearMoneda(cobradoAnterior + monto);
                const asignacionAnterior = asignacionVentaActual(venta);
                const asignacionNueva = core.calcularAsignacionFondos(desgloseVenta(venta), cobradoNuevo);
                const delta = core.restarAsignaciones(asignacionNueva, asignacionAnterior);
                const data = configSnap.data();
                const fondosNuevos = core.sumarAsignacion(data.fondos, delta, 1);
                const saldos = cambiarSaldo(saldoServidor(data), ubicacion, monto, 1);
                const saldoPendiente = core.desdeCentavos(Math.max(0, core.aCentavos(venta.ingresoTotal) - core.aCentavos(cobradoNuevo)));
                let clienteActualizado = null;
                if (clienteServidor) {
                    const saldoBase = Number.isFinite(Number(clienteServidor.saldoCredito))
                        ? core.redondearMoneda(clienteServidor.saldoCredito)
                        : saldoCreditoCalculadoCliente(venta.clienteId);
                    clienteActualizado = { ...clienteServidor, saldoCredito: core.desdeCentavos(Math.max(0, core.aCentavos(saldoBase) - core.aCentavos(monto))), ultimaOperacionCreditoEn: timestamp };
                }
                const pago = { id: pagoId, timestamp, fecha: fechaHoraNegocio(timestamp), monto: core.redondearMoneda(monto), metodo: metodoNormal, ubicacion, tipo: 'abono' };
                const actualizada = { ...venta, montoPagadoDinero: core.redondearMoneda(Number(venta.montoPagadoDinero || 0) + monto), montoCobradoTotal: cobradoNuevo, saldoPendiente, estadoCobro: saldoPendiente === 0 ? 'pagado' : 'credito', asignacionFondosCobrado: asignacionNueva, pagos: [...(venta.pagos || []), pago], actualizadoCobroEn: timestamp };
                t.set(configRef, { ...data, fondos: fondosNuevos, saldosDinero: saldos, ultimaActualizacion: timestamp });
                t.set(ventaRef, actualizada);
                if (clienteRef && clienteActualizado) t.set(clienteRef, clienteActualizado);
                t.set(global.doc(global.db, 'pagos_clientes', String(pagoId)), { ...pago, ventaId: id, clienteId: venta.clienteId || null, clienteNombre: venta.clienteNombre || 'C/F' });
                t.set(global.doc(global.db, 'movimientos_caja', String(movimiento.id)), movimiento);
                return { fondosNuevos, saldos, actualizada, clienteActualizado };
            });
            fondos = resultado.fondosNuevos; saldosDinero = resultado.saldos; ventas = fusionarPorId(ventas, [resultado.actualizada]); movimientosCaja = fusionarPorId(movimientosCaja, [movimiento]);
            if (resultado.clienteActualizado) clientes = fusionarPorId(clientes, [resultado.clienteActualizado]);
            guardarDatos(); renderFinanzasNegocio(); actualizarUI(); alert('✅ Abono registrado. Los fondos aumentaron solo por el dinero recibido.');
        } catch (error) { alert('No se registró el abono. ' + error.message); }
        finally { isProcessingTransaction = false; }
    }

    async function registrarPerdidaInventario() {
        if (!exigirDueno() || !navigator.onLine || isProcessingTransaction) return;
        const productoId = document.getElementById('perdida-producto').value;
        const producto = inventario.find(p => String(p.id) === String(productoId) && !p.isService);
        const cantidadTexto = document.getElementById('perdida-cantidad').value;
        const motivo = document.getElementById('perdida-motivo').value.trim();
        if (!producto) return alert('Selecciona un producto.');
        let cantidad;
        try { cantidad = validarCantidadProducto(cantidadTexto, producto); } catch (error) { return alert(error.message); }
        if (cantidad <= 0 || cantidad > Number(producto.stock)) return alert('La cantidad supera la existencia disponible.');
        if (!motivo) return alert('Escribe el motivo de la pérdida.');
        const costo = core.redondearMoneda(cantidad * Number(producto.costo || 0));
        if (!confirm(`Descontar ${etiquetaUnidadProducto(producto, cantidad)} de ${producto.nombre}?\nCosto registrado de la pérdida: ${dineroNegocio(costo)}.`)) return;
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const perdida = { id: generarIDSeguro(), productoId: String(producto.id), productoNombre: producto.nombre, codigoInventario: producto.codigoInventario || null, cantidad, unidadId: producto.unidadId || 'pieza', costoUnitario: Number(producto.costo || 0), costoTotal: costo, motivo, timestamp, fecha: fechaHoraNegocio(timestamp), usuarioNombre: currentUserData?.nombre || 'Dueño' };
            const actualizado = await global.runTransaction(global.db, async t => {
                const ref = global.doc(global.db, 'inventario', String(producto.id));
                const snap = await t.get(ref);
                if (!snap.exists()) throw new Error('El producto ya no existe.');
                const actual = snap.data();
                const qty = validarCantidadProducto(cantidad, actual);
                if (core.aMilesimas(actual.stock) < core.aMilesimas(qty)) throw new Error('El stock cambió desde otro dispositivo.');
                const nuevo = { ...actual, stock: core.desdeMilesimas(core.aMilesimas(actual.stock) - core.aMilesimas(qty)), lastModified: timestamp };
                t.set(ref, nuevo);
                t.set(global.doc(global.db, 'perdidas_inventario', String(perdida.id)), perdida);
                return nuevo;
            });
            inventario = fusionarPorId(inventario, [actualizado]); perdidasInventario = fusionarPorId(perdidasInventario, [perdida]);
            document.getElementById('perdida-cantidad').value = ''; document.getElementById('perdida-motivo').value = '';
            renderFinanzasNegocio(); actualizarUI(); alert('✅ Pérdida registrada sin crear una venta ni sumar dinero.');
        } catch (error) { alert('No se registró la pérdida. ' + error.message); }
        finally { isProcessingTransaction = false; }
    }

    function ventaSeleccionadaDevolucion() {
        return ventas.find(v => String(v.id) === String(document.getElementById('devolucion-venta')?.value || '') && !v.anulada);
    }

    function actualizarOpcionesDevolucion() {
        const venta = ventaSeleccionadaDevolucion();
        const select = document.getElementById('devolucion-item');
        if (!select) return;
        if (!venta || Number(venta.versionCalculo) < 3) {
            select.innerHTML = '<option value="">Sin artículos compatibles</option>';
            actualizarPreviewDevolucion(); return;
        }
        select.innerHTML = (venta.detalleItems || []).map((item, indice) => `<option value="${indice}">${escaparHTML(item.nombre)} · ${numeroFinito(item.qty)} ${escaparHTML(item.unidadAbreviatura || 'unid')}</option>`).join('');
        const item = venta.detalleItems?.[0];
        const campo = document.getElementById('devolucion-cantidad');
        if (campo && item) { campo.value = item.qty; campo.max = item.qty; campo.step = item.unidadPaso || 1; }
        actualizarPreviewDevolucion();
    }

    function datosPreviewDevolucion() {
        const venta = ventaSeleccionadaDevolucion();
        const indice = Number(document.getElementById('devolucion-item')?.value);
        const item = venta?.detalleItems?.[indice];
        if (!venta || !item) throw new Error('Selecciona una venta y un artículo.');
        const cantidad = Number(document.getElementById('devolucion-cantidad')?.value);
        if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > Number(item.qty)) throw new Error('Cantidad devuelta inválida.');
        if (!item.isService) {
            const producto = inventario.find(p => String(p.id) === String(item.idProd));
            validarCantidadProducto(cantidad, producto || { unidadId: item.unidadId || 'pieza' });
        }
        const ingresoDevuelto = core.redondearMoneda(cantidad * Number(item.precioCobrado || 0));
        const saldoAntes = core.redondearMoneda(venta.saldoPendiente || 0);
        const cobradoAntes = core.redondearMoneda(venta.montoCobradoTotal ?? venta.ingresoTotal);
        const ingresoNuevo = core.redondearMoneda(Number(venta.ingresoTotal) - ingresoDevuelto);
        const cobradoNuevo = Math.min(cobradoAntes, ingresoNuevo);
        const reembolso = core.redondearMoneda(cobradoAntes - cobradoNuevo);
        const creditoReducido = core.redondearMoneda(Math.min(saldoAntes, ingresoDevuelto));
        return { venta, item, indice, cantidad, ingresoDevuelto, ingresoNuevo, cobradoAntes, cobradoNuevo, reembolso, creditoReducido };
    }

    function actualizarPreviewDevolucion() {
        const cont = document.getElementById('devolucion-preview');
        if (!cont) return;
        try {
            const p = datosPreviewDevolucion();
            cont.innerHTML = `Total que se reversa: <strong>${dineroNegocio(p.ingresoDevuelto)}</strong> · reduce crédito: <strong>${dineroNegocio(p.creditoReducido)}</strong> · reembolso que sale: <strong>${dineroNegocio(p.reembolso)}</strong>.`;
        } catch (error) { cont.textContent = error.message; }
    }

    async function registrarDevolucionVenta() {
        if (!exigirDueno() || !navigator.onLine || isProcessingTransaction) return;
        let preview;
        try { preview = datosPreviewDevolucion(); } catch (error) { return alert(error.message); }
        if (Number(preview.venta.versionCalculo) < 3) return alert('Esta venta es anterior al control de pagos. Usa “Deshacer” para una reversión completa segura.');
        const reingresar = Boolean(document.getElementById('devolucion-reingresar').checked && !preview.item.isService);
        const metodo = document.getElementById('devolucion-metodo').value;
        const ubicacion = core.ubicacionMetodoPago(metodo);
        const motivo = document.getElementById('devolucion-motivo').value.trim();
        if (!motivo) return alert('Escribe el motivo de la devolución.');
        if (!confirm(`Registrar devolución de ${preview.cantidad} × ${preview.item.nombre}?\nSe reversan ${dineroNegocio(preview.ingresoDevuelto)} y salen ${dineroNegocio(preview.reembolso)} como reembolso.`)) return;
        isProcessingTransaction = true;
        try {
            const timestamp = Date.now();
            const devolucionId = generarIDSeguro();
            const resultado = await global.runTransaction(global.db, async t => {
                const ventaRef = global.doc(global.db, 'ventas', String(preview.venta.id));
                const configRef = global.doc(global.db, 'sistema', 'config');
                const productoRef = !preview.item.isService ? global.doc(global.db, 'inventario', String(preview.item.idProd)) : null;
                const ventaSnap = await t.get(ventaRef);
                const configSnap = await t.get(configRef);
                const productoSnap = productoRef ? await t.get(productoRef) : null;
                if (!ventaSnap.exists() || !configSnap.exists()) throw new Error('La venta o configuración ya no existe.');
                const venta = ventaSnap.data();
                const item = venta.detalleItems?.[preview.indice];
                if (!item || core.aMilesimas(item.qty) < core.aMilesimas(preview.cantidad)) throw new Error('La venta cambió desde otro dispositivo.');
                const ingresoAnterior = Number(venta.ingresoTotal || 0);
                const ingresoDevuelto = core.redondearMoneda(preview.cantidad * Number(item.precioCobrado || 0));
                const proporcion = ingresoAnterior > 0 ? ingresoDevuelto / ingresoAnterior : 0;
                const ingresoDevueltoAntes = (venta.devoluciones || []).reduce((total, devolucion) => total + Number(devolucion.ingresoDevuelto || 0), 0);
                const ingresoBaseGastos = ingresoAnterior + ingresoDevueltoAntes;
                const proporcionGastos = ingresoBaseGastos > 0 ? ingresoDevuelto / ingresoBaseGastos : 0;
                const costoLinea = core.redondearMoneda(preview.cantidad * Number(item.costoUnitarioReal ?? item.costoBase ?? 0));
                const costoReversado = reingresar ? costoLinea : 0;
                const produccionNoRecuperada = core.redondearMoneda(Number(venta.costoTinta || 0) * proporcionGastos);
                const envioNoRecuperado = core.redondearMoneda(Number(venta.costoEnvio || 0) * proporcionGastos);
                const manoObraNoRecuperada = core.redondearMoneda(Number(venta.costoManoObra || 0) * proporcionGastos);
                const tintaReversada = 0;
                const envioReversado = 0;
                const manoReversada = 0;
                const satReversado = core.redondearMoneda(Number(venta.impuestoSAT || 0) * proporcion);
                const gananciaReversada = core.redondearMoneda(ingresoDevuelto - costoReversado - tintaReversada - envioReversado - manoReversada - satReversado);
                const nuevoDesglose = {
                    ingresoTotal: core.redondearMoneda(ingresoAnterior - ingresoDevuelto),
                    costosProductos: core.redondearMoneda(Number(venta.costosProductos || 0) - costoReversado),
                    costoTinta: core.redondearMoneda(Number(venta.costoTinta || 0) - tintaReversada),
                    costoEnvio: core.redondearMoneda(Number(venta.costoEnvio || 0) - envioReversado),
                    costoManoObra: core.redondearMoneda(Number(venta.costoManoObra || 0) - manoReversada),
                    impuestoSAT: core.redondearMoneda(Number(venta.impuestoSAT || 0) - satReversado),
                    gananciaNeta: core.redondearMoneda(Number(venta.ganancia || 0) - gananciaReversada),
                    pideFactura: Boolean(venta.factura)
                };
                const cobradoAntes = core.redondearMoneda(venta.montoCobradoTotal ?? venta.ingresoTotal);
                const cobradoNuevo = Math.min(cobradoAntes, nuevoDesglose.ingresoTotal);
                const reembolsoTotal = core.redondearMoneda(cobradoAntes - cobradoNuevo);
                const anticipoAplicado = core.redondearMoneda(venta.anticipoAplicado || 0);
                const anticipoRestaurado = Math.min(anticipoAplicado, reembolsoTotal);
                const reembolsoDinero = core.redondearMoneda(reembolsoTotal - anticipoRestaurado);
                const asignacionAnterior = asignacionVentaActual(venta);
                const asignacionNueva = core.calcularAsignacionFondos(nuevoDesglose, cobradoNuevo);
                const deltaFondos = core.restarAsignaciones(asignacionNueva, asignacionAnterior);
                const data = configSnap.data();
                const fondosNuevos = core.sumarAsignacion(data.fondos, deltaFondos, 1);
                core.CLAVES_FONDOS.forEach(clave => { if (core.aCentavos(fondosNuevos[clave]) < 0) throw new Error('Ya se retiró parte del dinero asignado a esta venta. Repón los fondos antes de devolverla.'); });
                let saldos = saldoServidor(data);
                if (reembolsoDinero > 0) saldos = cambiarSaldo(saldos, ubicacion, reembolsoDinero, -1);
                const detalleNuevo = venta.detalleItems.map((detalle, indice) => indice === preview.indice ? { ...detalle, qty: core.desdeMilesimas(core.aMilesimas(detalle.qty) - core.aMilesimas(preview.cantidad)) } : detalle).filter(detalle => core.aMilesimas(detalle.qty) > 0);
                const saldoPendiente = core.desdeCentavos(Math.max(0, core.aCentavos(nuevoDesglose.ingresoTotal) - core.aCentavos(cobradoNuevo)));
                const devolucion = { id: devolucionId, ventaId: String(venta.id), clienteId: venta.clienteId || null, clienteNombre: venta.clienteNombre || 'C/F', productoId: item.idProd || null, productoNombre: item.nombre, cantidad: preview.cantidad, unidadId: item.unidadId || 'pieza', ingresoDevuelto, creditoReducido: Math.min(Number(venta.saldoPendiente || 0), ingresoDevuelto), reembolsoDinero, anticipoRestaurado, metodo, ubicacion, reingresadoInventario: reingresar, costoReversado, produccionNoRecuperada, envioNoRecuperado, manoObraNoRecuperada, motivo, timestamp, fecha: fechaHoraNegocio(timestamp) };
                const actualizada = { ...venta, ingresoTotal: nuevoDesglose.ingresoTotal, costosProductos: nuevoDesglose.costosProductos, costoTinta: nuevoDesglose.costoTinta, costoEnvio: nuevoDesglose.costoEnvio, costoManoObra: nuevoDesglose.costoManoObra, impuestoSAT: nuevoDesglose.impuestoSAT, ganancia: nuevoDesglose.gananciaNeta, detalleItems: detalleNuevo, montoPagadoDinero: core.redondearMoneda(Math.max(0, Number(venta.montoPagadoDinero || 0) - reembolsoDinero)), montoCobradoTotal: cobradoNuevo, saldoPendiente, anticipoAplicado: core.redondearMoneda(anticipoAplicado - anticipoRestaurado), asignacionFondosCobrado: asignacionNueva, estadoCobro: saldoPendiente > 0 ? 'credito' : 'pagado', devoluciones: [...(venta.devoluciones || []), devolucion], editadoEn: timestamp };
                let productoNuevo = null;
                if (reingresar) {
                    if (!productoSnap?.exists()) throw new Error('El producto ya no existe para reingresarlo.');
                    const producto = productoSnap.data();
                    productoNuevo = { ...producto, costo: calcularCostoPromedioPonderado(producto.stock, producto.costo, preview.cantidad, Number(item.costoUnitarioReal ?? item.costoBase ?? 0)), stock: core.desdeMilesimas(core.aMilesimas(producto.stock) + core.aMilesimas(preview.cantidad)), ventasTotales: Math.max(0, Number(producto.ventasTotales || 0) - preview.cantidad), lastModified: timestamp };
                }
                const mes = getMesAnioFromDate(venta.fecha || '', venta.timestamp);
                let resumenRef = null; let resumenSnap = null;
                if (mes) { resumenRef = global.doc(global.db, 'resumen_mensual', mes); resumenSnap = await t.get(resumenRef); }
                const anticipoNuevo = anticipoRestaurado > 0 ? { id: generarIDSeguro(), clienteId: venta.clienteId || null, clienteNombre: venta.clienteNombre || 'C/F', montoOriginal: anticipoRestaurado, saldoPendiente: anticipoRestaurado, aplicadoTotal: 0, devueltoTotal: 0, metodo: 'restaurado', ubicacion: null, motivo: `RESTAURADO POR DEVOLUCIÓN ${devolucionId}`, timestamp, fecha: fechaHoraNegocio(timestamp), estado: 'pendiente', origenDevolucionId: devolucionId, versionCalculo: 1 } : null;
                t.set(configRef, { ...data, fondos: fondosNuevos, saldosDinero: saldos, ultimaActualizacion: timestamp });
                t.set(ventaRef, actualizada);
                if (productoNuevo) t.set(productoRef, productoNuevo);
                t.set(global.doc(global.db, 'devoluciones', String(devolucionId)), devolucion);
                if (anticipoNuevo) t.set(global.doc(global.db, 'anticipos', String(anticipoNuevo.id)), anticipoNuevo);
                if (resumenRef && resumenSnap?.exists()) {
                    const ajuste = { ingresoTotal: ingresoDevuelto, ganancia: gananciaReversada, costosProductos: costoReversado, costoTinta: tintaReversada, costoEnvio: envioReversado, costoManoObra: manoReversada, impuestoSAT: satReversado, detalleItems: [{ qty: preview.cantidad, rol: item.rol }] };
                    t.set(resumenRef, aplicarVentaAResumen(resumenSnap.data(), ajuste, -1));
                }
                return { fondosNuevos, saldos, actualizada, productoNuevo, devolucion, anticipoNuevo };
            });
            fondos = resultado.fondosNuevos; saldosDinero = resultado.saldos; ventas = fusionarPorId(ventas, [resultado.actualizada]);
            if (resultado.productoNuevo) inventario = fusionarPorId(inventario, [resultado.productoNuevo]);
            devoluciones = fusionarPorId(devoluciones, [resultado.devolucion]); if (resultado.anticipoNuevo) anticipos = fusionarPorId(anticipos, [resultado.anticipoNuevo]);
            document.getElementById('devolucion-motivo').value = ''; renderFinanzasNegocio(); actualizarUI();
            alert(`✅ Devolución registrada. Reembolso en dinero: ${dineroNegocio(resultado.devolucion.reembolsoDinero)}${resultado.devolucion.anticipoRestaurado ? `; anticipo restaurado: ${dineroNegocio(resultado.devolucion.anticipoRestaurado)}` : ''}.`);
        } catch (error) { alert('No se registró la devolución. ' + error.message); }
        finally { isProcessingTransaction = false; }
    }

    function renderCreditos() {
        const cont = document.getElementById('lista-creditos'); if (!cont) return;
        const cuentas = ventas.filter(v => !v.anulada && Number(v.saldoPendiente) > 0).sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
        if (!cuentas.length) return void (cont.innerHTML = '<p class="item-details">No hay créditos pendientes.</p>');
        cont.innerHTML = cuentas.map(v => `<div class="item-row"><div class="item-info"><p class="item-title">${escaparHTML(v.clienteNombre || 'CLIENTE')}</p><p class="item-details">Venta ${escaparHTML(v.fecha || '')}<br>Total: ${dineroNegocio(v.ingresoTotal)} · Pagado: ${dineroNegocio(v.montoCobradoTotal || 0)}</p></div><div style="text-align:right;"><strong style="color:var(--primary-orange);">${dineroNegocio(v.saldoPendiente)}</strong><br><button class="btn-sm btn-edit" onclick="registrarAbonoCredito('${codificarParametroHTML(v.id)}')">Abonar</button></div></div>`).join('');
    }

    function renderAnticipos() {
        const cont = document.getElementById('lista-anticipos'); if (!cont) return;
        const lista = anticipos.filter(a => !a.anulado && Number(a.saldoPendiente) > 0).sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
        if (!lista.length) return void (cont.innerHTML = '<p class="item-details">No hay anticipos pendientes.</p>');
        cont.innerHTML = lista.map(a => `<div class="item-row"><div class="item-info"><p class="item-title">${escaparHTML(a.clienteNombre || 'CLIENTE')}</p><p class="item-details">${escaparHTML(a.fecha || '')} · ${escaparHTML(a.motivo || '')}<br>Original: ${dineroNegocio(a.montoOriginal)}</p></div><div style="text-align:right;"><strong>${dineroNegocio(a.saldoPendiente)}</strong><br><button class="btn-sm btn-delete" onclick="devolverAnticipo('${codificarParametroHTML(a.id)}')">Devolver</button></div></div>`).join('');
    }

    function renderPrestamos() {
        const cont = document.getElementById('lista-prestamos'); if (!cont) return;
        const lista = prestamos.filter(p => Number(p.saldoPendiente) > 0 && p.estado !== 'anulado').sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
        if (!lista.length) return void (cont.innerHTML = '<p class="item-details">No hay préstamos activos.</p>');
        cont.innerHTML = lista.map(p => `<div class="item-row"><div class="item-info"><p class="item-title">${escaparHTML(p.persona)}</p><p class="item-details">${escaparHTML(p.motivo)}${p.vencimiento ? '<br>Fecha esperada: ' + escaparHTML(p.vencimiento) : ''}<br>Devuelto: ${dineroNegocio(p.devueltoTotal || 0)}</p></div><div style="text-align:right;"><strong style="color:var(--primary-orange);">${dineroNegocio(p.saldoPendiente)}</strong><br><button class="btn-sm btn-edit" onclick="abonarPrestamo('${codificarParametroHTML(p.id)}')">Registrar devolución</button></div></div>`).join('');
    }

    function renderPerdidas() {
        const cont = document.getElementById('lista-perdidas'); if (!cont) return;
        const lista = [...perdidasInventario].sort((a, b) => Number(b.timestamp) - Number(a.timestamp)).slice(0, 30);
        if (!lista.length) return void (cont.innerHTML = '<p class="item-details">No hay pérdidas registradas.</p>');
        cont.innerHTML = lista.map(p => `<div class="item-row"><div class="item-info"><p class="item-title">${escaparHTML(p.productoNombre)}</p><p class="item-details">${numeroFinito(p.cantidad)} · ${escaparHTML(p.motivo)} · ${escaparHTML(p.fecha || '')}</p></div><strong style="color:var(--primary-red);">${dineroNegocio(p.costoTotal)}</strong></div>`).join('');
    }

    function renderMovimientos() {
        const cont = document.getElementById('lista-movimientos-caja'); if (!cont) return;
        const lista = [...movimientosCaja].sort((a, b) => Number(b.timestamp) - Number(a.timestamp)).slice(0, 60);
        if (!lista.length) return void (cont.innerHTML = '<p class="item-details">No hay movimientos adicionales.</p>');
        cont.innerHTML = lista.map(m => `<div class="item-row"><div class="item-info"><p class="item-title">${escaparHTML(String(m.tipo || '').replaceAll('_', ' ').toUpperCase())}</p><p class="item-details">${escaparHTML(m.fecha || '')} · ${escaparHTML(m.ubicacion || '')}${m.destino ? ' → ' + escaparHTML(m.destino) : ''}${m.motivo ? '<br>' + escaparHTML(m.motivo) : ''}</p></div><strong>${dineroNegocio(m.monto)}</strong></div>`).join('');
    }

    function renderSelectoresFinanzas() {
        const productos = inventario.filter(p => !p.isService).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        const selectPerdida = document.getElementById('perdida-producto');
        if (selectPerdida) {
            const anterior = selectPerdida.value;
            selectPerdida.innerHTML = '<option value="">Selecciona un producto</option>' + productos.map(p => `<option value="${escaparHTML(p.id)}">${escaparHTML(p.nombre)} · ${etiquetaUnidadProducto(p, p.stock)}</option>`).join('');
            if (productos.some(p => String(p.id) === String(anterior))) selectPerdida.value = anterior;
        }
        const selectVenta = document.getElementById('devolucion-venta');
        if (selectVenta) {
            const anterior = selectVenta.value;
            const compatibles = ventas.filter(v => !v.anulada && Number(v.versionCalculo) >= 3 && Number(v.ingresoTotal) >= 0 && (v.detalleItems || []).length).sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
            selectVenta.innerHTML = '<option value="">Selecciona una venta</option>' + compatibles.map(v => `<option value="${escaparHTML(v.id)}">${escaparHTML(v.fecha || '')} · ${escaparHTML(v.clienteNombre || 'C/F')} · ${dineroNegocio(v.ingresoTotal)}</option>`).join('');
            if (compatibles.some(v => String(v.id) === String(anterior))) selectVenta.value = anterior;
        }
    }

    function renderFinanzasNegocio() {
        const moneda = monedaNegocio();
        const efectivo = Number(saldosDinero?.efectivo || 0); const banco = Number(saldosDinero?.banco || 0);
        const credito = ventas.filter(v => !v.anulada).reduce((t, v) => t + Math.max(0, Number(v.saldoPendiente) || 0), 0);
        const anticipo = totalAnticiposPendientes();
        const ids = {
            'dash-efectivo': efectivo, 'dash-banco': banco, 'dash-credito-pendiente': credito,
            'dash-anticipos-pendientes': anticipo, 'caja-saldo-efectivo': efectivo, 'caja-saldo-banco': banco
        };
        Object.entries(ids).forEach(([id, valor]) => { const el = document.getElementById(id); if (el) el.textContent = `${moneda} ${core.redondearMoneda(valor).toFixed(2)}`; });
        const total = document.getElementById('dash-total-caja'); if (total) total.textContent = `${moneda} ${core.redondearMoneda(efectivo + banco).toFixed(2)}`;
        renderCreditos(); renderAnticipos(); renderPrestamos(); renderPerdidas(); renderMovimientos(); renderSelectoresFinanzas();
        if (document.getElementById('devolucion-venta')?.value) actualizarOpcionesDevolucion();
    }

    global.registrarAnticipoCliente = registrarAnticipoCliente;
    global.devolverAnticipo = devolverAnticipo;
    global.registrarTrasladoDinero = registrarTrasladoDinero;
    global.registrarRetiroCaja = registrarRetiroCaja;
    global.registrarPrestamo = registrarPrestamo;
    global.abonarPrestamo = abonarPrestamo;
    global.registrarAbonoCredito = registrarAbonoCredito;
    global.registrarPerdidaInventario = registrarPerdidaInventario;
    global.actualizarOpcionesDevolucion = actualizarOpcionesDevolucion;
    global.actualizarPreviewDevolucion = actualizarPreviewDevolucion;
    global.registrarDevolucionVenta = registrarDevolucionVenta;
    global.renderFinanzasNegocio = renderFinanzasNegocio;
})(window);
