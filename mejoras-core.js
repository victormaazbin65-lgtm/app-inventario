(function (global) {
    'use strict';

    const MS_DIA = 24 * 60 * 60 * 1000;

    function numero(valor, predeterminado = 0) {
        const n = Number(valor);
        return Number.isFinite(n) ? n : predeterminado;
    }

    function normalizarTexto(valor) {
        return String(valor ?? '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase().replace(/\s+/g, ' ').trim();
    }

    function inicioDiaLocal(timestamp) {
        const fecha = new Date(timestamp);
        fecha.setHours(0, 0, 0, 0);
        return fecha.getTime();
    }

    function finDiaLocal(timestamp) {
        return inicioDiaLocal(timestamp) + MS_DIA - 1;
    }

    function claveDiaLocal(timestamp) {
        const fecha = new Date(timestamp);
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseFechaLocal(fecha) {
        const texto = String(fecha || '').trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
        if(!match) return NaN;
        const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
        const valor = new Date(y, m - 1, d);
        if(valor.getFullYear() !== y || valor.getMonth() !== m - 1 || valor.getDate() !== d) return NaN;
        valor.setHours(0, 0, 0, 0);
        return valor.getTime();
    }

    function clasificarStock(stock, minimo) {
        const actual = numero(stock);
        const min = Math.max(0, numero(minimo));
        if(actual <= 0) return 'agotado';
        if(actual <= min) return 'bajo';
        return 'bien';
    }

    function normalizarProveedor(valor) {
        const texto = normalizarTexto(valor);
        return !texto || texto === 'NO ESPECIFICADO' ? 'SIN DISTRIBUIDOR ASIGNADO' : texto.slice(0, 120);
    }

    function catalogoProveedor(productos, opciones = {}) {
        const proveedorFiltro = normalizarTexto(opciones.proveedor);
        const busqueda = normalizarTexto(opciones.busqueda);
        const soloPendientes = Boolean(opciones.soloPendientes);
        const prioridad = { agotado: 0, bajo: 1, bien: 2 };

        return (Array.isArray(productos) ? productos : [])
            .filter(p => p && !p.isService)
            .map(p => {
                const proveedor = normalizarProveedor(p.proveedor);
                const estado = clasificarStock(p.stock, p.min);
                return { ...p, proveedorNormalizado: proveedor, estadoStock: estado };
            })
            .filter(p => !proveedorFiltro || proveedorFiltro === 'TODOS' || p.proveedorNormalizado === proveedorFiltro)
            .filter(p => !soloPendientes || p.estadoStock !== 'bien')
            .filter(p => {
                if(!busqueda) return true;
                const hay = normalizarTexto(`${p.codigoInventario || ''} ${p.nombre || ''} ${p.categoria || ''} ${p.proveedorNormalizado}`);
                return busqueda.split(' ').every(token => hay.includes(token));
            })
            .sort((a, b) =>
                (prioridad[a.estadoStock] - prioridad[b.estadoStock]) ||
                String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
            );
    }

    function resumenVentasRango(ventas, desde, hasta) {
        const inicio = Number(desde);
        const fin = Number(hasta);
        const dias = new Map();
        const total = {
            ventas: 0,
            cobrado: 0,
            costoProductos: 0,
            produccion: 0,
            sat: 0,
            utilidad: 0,
            operaciones: 0
        };
        if(!Number.isFinite(inicio) || !Number.isFinite(fin) || fin < inicio) return { ...total, dias: [] };

        for(const venta of Array.isArray(ventas) ? ventas : []) {
            if(!venta || venta.anulada) continue;
            const ts = Number(venta.timestamp);
            if(!Number.isFinite(ts) || ts < inicio || ts > fin) continue;

            const fila = {
                ventas: numero(venta.ingresoTotal),
                cobrado: numero(venta.montoCobradoTotal, numero(venta.ingresoTotal)),
                costoProductos: numero(venta.costosProductos),
                produccion: numero(venta.costoTinta) + numero(venta.costoManoObra) + numero(venta.costoEnvio),
                sat: numero(venta.impuestoSAT),
                utilidad: numero(venta.ganancia, numero(venta.gananciaNeta)),
                operaciones: 1
            };

            Object.keys(total).forEach(clave => { total[clave] += fila[clave]; });
            const dia = claveDiaLocal(ts);
            if(!dias.has(dia)) dias.set(dia, { dia, ventas: 0, cobrado: 0, costoProductos: 0, produccion: 0, sat: 0, utilidad: 0, operaciones: 0 });
            const acumulado = dias.get(dia);
            Object.keys(total).forEach(clave => { acumulado[clave] += fila[clave]; });
        }

        const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
        ['ventas', 'cobrado', 'costoProductos', 'produccion', 'sat', 'utilidad'].forEach(clave => {
            total[clave] = redondear(total[clave]);
        });
        const diasOrdenados = Array.from(dias.values()).sort((a, b) => a.dia.localeCompare(b.dia));
        diasOrdenados.forEach(fila => ['ventas', 'cobrado', 'costoProductos', 'produccion', 'sat', 'utilidad'].forEach(clave => fila[clave] = redondear(fila[clave])));
        return { ...total, dias: diasOrdenados };
    }

    function alertasPrestamos(prestamos, ahora = Date.now(), diasProximos = 3) {
        const hoy = inicioDiaLocal(ahora);
        return (Array.isArray(prestamos) ? prestamos : [])
            .filter(p => p && numero(p.saldoPendiente) > 0 && p.estado !== 'pagado' && p.estado !== 'anulado')
            .map(p => {
                const vencimiento = parseFechaLocal(p.vencimiento);
                let estado = 'sin_fecha';
                let dias = null;
                if(Number.isFinite(vencimiento)) {
                    dias = Math.round((vencimiento - hoy) / MS_DIA);
                    estado = dias < 0 ? 'vencido' : (dias === 0 ? 'hoy' : (dias <= diasProximos ? 'proximo' : 'pendiente'));
                }
                return { ...p, estadoAlerta: estado, diasParaVencer: dias, vencimientoTimestamp: vencimiento };
            })
            .sort((a, b) => {
                const prioridad = { vencido: 0, hoy: 1, proximo: 2, pendiente: 3, sin_fecha: 4 };
                return (prioridad[a.estadoAlerta] - prioridad[b.estadoAlerta]) ||
                    (numero(a.vencimientoTimestamp, Number.MAX_SAFE_INTEGER) - numero(b.vencimientoTimestamp, Number.MAX_SAFE_INTEGER));
            });
    }

    function validarCodigoManual(codigo, ocupados = []) {
        const n = Number(codigo);
        if(!Number.isInteger(n) || n <= 0) throw new Error('El código debe ser un número entero positivo.');
        if(n % 1000 === 0) throw new Error('El número exacto del bloque se reserva para la categoría. Usa un código interno del bloque.');
        const usados = new Set((Array.isArray(ocupados) ? ocupados : []).map(Number).filter(Number.isInteger));
        if(usados.has(n)) throw new Error(`El código ${n} ya está ocupado.`);
        return n;
    }

    function puedeVerFinanzas(usuario) {
        if(!usuario || typeof usuario !== 'object') return false;
        return usuario.rol === 'dueno' || Boolean(usuario.permisos?.verFinanzas);
    }

    global.SubliMejorasCore = Object.freeze({
        MS_DIA,
        numero,
        normalizarTexto,
        inicioDiaLocal,
        finDiaLocal,
        claveDiaLocal,
        parseFechaLocal,
        clasificarStock,
        normalizarProveedor,
        catalogoProveedor,
        resumenVentasRango,
        alertasPrestamos,
        validarCodigoManual,
        puedeVerFinanzas
    });
})(typeof window !== 'undefined' ? window : globalThis);
