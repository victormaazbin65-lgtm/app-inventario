(function (global) {
    'use strict';

    const MS_DIA = 86400000;

    function numero(valor, predeterminado = 0) {
        const n = Number(valor);
        return Number.isFinite(n) ? n : predeterminado;
    }

    function centavos(valor) {
        if(global.SubliNegocioCore?.aCentavos) return global.SubliNegocioCore.aCentavos(valor);
        return Math.round((numero(valor) + Number.EPSILON) * 100);
    }

    function monedaDesdeCentavos(valor) {
        if(global.SubliNegocioCore?.desdeCentavos) return global.SubliNegocioCore.desdeCentavos(valor);
        return numero(valor) / 100;
    }

    function normalizarTexto(valor) {
        return String(valor ?? '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function claveUnica(valor) {
        const base = normalizarTexto(valor).replace(/\s+/g, '-').slice(0, 120);
        return base || 'sin-nombre';
    }

    function inicioDia(ts = Date.now()) {
        const d = new Date(ts);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    function parseFecha(fecha) {
        if(!fecha) return NaN;
        if(Number.isFinite(Number(fecha)) && Number(fecha) > 100000000000) return Number(fecha);
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha).trim());
        if(!m) return NaN;
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if(d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return NaN;
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    const ACCIONES = Object.freeze([
        { id:'venta', titulo:'Registrar venta', descripcion:'Crear una venta de contado, crédito o con anticipo.', palabras:'vender venta cobrar cliente', pestana:'ventas', roles:['dueno','empleado'] },
        { id:'cotizacion', titulo:'Crear cotización', descripcion:'Preparar un precio sin afectar inventario ni caja.', palabras:'cotizar presupuesto precio', pestana:'cotizacion', roles:['dueno','empleado'] },
        { id:'ingreso', titulo:'Ingresar producto', descripcion:'Aumentar existencias o crear un producto.', palabras:'comprar ingresar entrada inventario proveedor', pestana:'ingreso', roles:['dueno','empleado'] },
        { id:'inventario', titulo:'Buscar inventario', descripcion:'Consultar existencias, códigos y productos.', palabras:'stock existencia producto codigo buscar', pestana:'inventario', roles:['dueno','empleado'] },
        { id:'surtir', titulo:'Ver por surtir', descripcion:'Revisar agotados y compras por proveedor.', palabras:'surtir proveedor distribuidor comprar agotado', pestana:'alertas', roles:['dueno','empleado'] },
        { id:'clientes', titulo:'Ver clientes', descripcion:'Abrir fichas, créditos, anticipos e historial.', palabras:'cliente crm credito anticipo historial', pestana:'opciones', accionSecundaria:'clientes', roles:['dueno','empleado'] },
        { id:'caja', titulo:'Abrir Finanzas / Caja', descripcion:'Revisar efectivo, banco, retiros, anticipos y préstamos.', palabras:'caja banco efectivo finanzas fondos dinero', pestana:'caja', requiereFinanzas:true, roles:['dueno','empleado'] },
        { id:'prestamo', titulo:'Registrar o devolver préstamo', descripcion:'Administrar dinero prestado que regresará.', palabras:'prestamo prestar devolver abono', pestana:'caja', requiereFinanzas:true, roles:['dueno','empleado'] },
        { id:'cobros', titulo:'Agenda de cobros', descripcion:'Ver créditos y préstamos pendientes.', palabras:'cobrar cuentas por cobrar vencido deuda', pestana:'inicio', focusId:'v130-agenda-cobros', requiereFinanzas:true, roles:['dueno','empleado'] },
        { id:'orden', titulo:'Generar orden de compra', descripcion:'Preparar una compra desde Por Surtir.', palabras:'orden compra proveedor surtir pedido', pestana:'alertas', focusId:'v130-orden-compra', roles:['dueno','empleado'] },
        { id:'cierre', titulo:'Cierre diario', descripcion:'Comparar caja/banco esperados contra el conteo real.', palabras:'cierre diario cuadrar caja conteo', pestana:'inicio', focusId:'v130-cierre-diario', requiereDueno:true, roles:['dueno'] },
        { id:'etiquetas', titulo:'Imprimir etiqueta de inventario', descripcion:'Crear una etiqueta con código de barras.', palabras:'etiqueta barcode codigo barras imprimir qr', pestana:'inventario', focusId:'v130-etiquetas', roles:['dueno','empleado'] },
        { id:'temas', titulo:'Cambiar tema', descripcion:'Elegir apariencia Profesional/Clásico y colores.', palabras:'tema color oscuro claro apariencia interfaz', pestana:'opciones', focusId:'ajuste-interfaz', roles:['dueno','empleado'] },
        { id:'respaldo', titulo:'Crear respaldo', descripcion:'Abrir copia de seguridad y restauración.', palabras:'backup respaldo copia restaurar seguridad', pestana:'opciones', focusText:'respaldo', requiereDueno:true, roles:['dueno'] },
        { id:'diagnostico', titulo:'Diagnóstico del sistema', descripcion:'Comprobar módulos, conexión y errores recientes.', palabras:'diagnostico error sistema revisar salud tecnica', pestana:'opciones', focusId:'v128-diagnostico', roles:['dueno','empleado'] },
        { id:'disenos', titulo:'Buscar diseños', descripcion:'Localizar archivos de diseño por palabras.', palabras:'diseno archivo corel buscar carpeta', pestana:'disenos', roles:['dueno','empleado'] }
    ]);

    function buscarAcciones(consulta, opciones = {}) {
        const texto = normalizarTexto(consulta);
        const rol = opciones.rol || 'empleado';
        const puedeFinanzas = Boolean(opciones.puedeFinanzas || rol === 'dueno');
        return ACCIONES
            .filter(a => a.roles.includes(rol) && (!a.requiereDueno || rol === 'dueno') && (!a.requiereFinanzas || puedeFinanzas))
            .map(a => {
                const corpus = normalizarTexto(`${a.titulo} ${a.descripcion} ${a.palabras}`);
                if(!texto) return { ...a, puntuacion:1 };
                const tokens = texto.split(' ').filter(Boolean);
                let puntuacion = 0;
                for(const token of tokens) {
                    if(normalizarTexto(a.titulo).includes(token)) puntuacion += 6;
                    if(corpus.includes(token)) puntuacion += 2;
                }
                if(corpus.includes(texto)) puntuacion += 8;
                return { ...a, puntuacion };
            })
            .filter(a => !texto || a.puntuacion > 0)
            .sort((a,b) => b.puntuacion - a.puntuacion || a.titulo.localeCompare(b.titulo, 'es'))
            .slice(0, 10);
    }

    function saldoCreditoVenta(venta) {
        if(!venta || venta.anulada) return 0;
        const candidatos = [venta.saldoPendiente, venta.saldoCredito, venta.saldoCreditoPendiente, venta.pendienteCobro];
        for(const valor of candidatos) {
            if(Number.isFinite(Number(valor)) && Number(valor) > 0) return numero(valor);
        }
        const total = numero(venta.ingresoTotal);
        const cobrado = numero(venta.montoCobradoTotal, total);
        return Math.max(0, monedaDesdeCentavos(centavos(total) - centavos(cobrado)));
    }

    function agendaCobros(ventas, prestamos, ahora = Date.now()) {
        const hoy = inicioDia(ahora);
        const filas = [];
        for(const venta of Array.isArray(ventas) ? ventas : []) {
            const saldo = saldoCreditoVenta(venta);
            if(saldo <= 0) continue;
            const venc = parseFecha(venta.fechaVencimiento || venta.vencimiento || venta.fechaLimite);
            filas.push({
                tipo:'credito', id:String(venta.id || ''), persona:venta.clienteNombre || venta.cliente || 'Cliente',
                concepto:'Venta a crédito', saldo, timestamp:numero(venta.timestamp), vencimiento:Number.isFinite(venc) ? venc : null,
                dias:Number.isFinite(venc) ? Math.round((venc - hoy) / MS_DIA) : null
            });
        }
        for(const p of Array.isArray(prestamos) ? prestamos : []) {
            const saldo = numero(p?.saldoPendiente);
            if(saldo <= 0 || p?.estado === 'anulado' || p?.estado === 'pagado') continue;
            const venc = parseFecha(p.vencimiento);
            filas.push({
                tipo:'prestamo', id:String(p.id || ''), persona:p.persona || 'Persona', concepto:p.motivo || 'Préstamo', saldo,
                timestamp:numero(p.timestamp), vencimiento:Number.isFinite(venc) ? venc : null,
                dias:Number.isFinite(venc) ? Math.round((venc - hoy) / MS_DIA) : null
            });
        }
        const prioridad = f => f.dias === null ? 3 : (f.dias < 0 ? 0 : (f.dias === 0 ? 1 : 2));
        return filas.sort((a,b) => prioridad(a) - prioridad(b) || numero(a.vencimiento, Number.MAX_SAFE_INTEGER) - numero(b.vencimiento, Number.MAX_SAFE_INTEGER) || a.timestamp - b.timestamp);
    }

    function resumenSalud(contexto = {}) {
        const inventario = Array.isArray(contexto.inventario) ? contexto.inventario : [];
        const ventas = Array.isArray(contexto.ventas) ? contexto.ventas : [];
        const prestamos = Array.isArray(contexto.prestamos) ? contexto.prestamos : [];
        const hoy = inicioDia(contexto.ahora || Date.now());
        let valorInventarioCent = 0, agotados = 0, bajos = 0;
        for(const p of inventario) {
            if(!p || p.isService) continue;
            const stock = numero(p.stock), minimo = Math.max(0, numero(p.min));
            if(stock <= 0) agotados++;
            else if(stock <= minimo) bajos++;
            const valor = stock * Math.max(0, numero(p.costo));
            if(Number.isFinite(valor)) valorInventarioCent += centavos(valor);
        }
        let ventasHoyCent = 0, utilidadHoyCent = 0;
        for(const v of ventas) {
            if(!v || v.anulada || numero(v.timestamp) < hoy || numero(v.timestamp) >= hoy + MS_DIA) continue;
            ventasHoyCent += centavos(v.ingresoTotal);
            utilidadHoyCent += centavos(v.ganancia ?? v.gananciaNeta);
        }
        const cobros = agendaCobros(ventas, prestamos, contexto.ahora || Date.now());
        const porCobrarCent = cobros.reduce((a,c) => a + centavos(c.saldo), 0);
        const vencidos = cobros.filter(c => c.dias !== null && c.dias < 0).length;
        return {
            productos: inventario.filter(p => p && !p.isService).length,
            agotados, bajos,
            valorInventario: monedaDesdeCentavos(valorInventarioCent),
            ventasHoy: monedaDesdeCentavos(ventasHoyCent),
            utilidadHoy: monedaDesdeCentavos(utilidadHoyCent),
            porCobrar: monedaDesdeCentavos(porCobrarCent), vencidos,
            prestamosPendientes: prestamos.filter(p => numero(p?.saldoPendiente) > 0 && p?.estado !== 'anulado').length
        };
    }

    function prioridadesNegocio(contexto = {}) {
        const salud = resumenSalud(contexto);
        const cobros = agendaCobros(contexto.ventas, contexto.prestamos, contexto.ahora);
        const prioridades = [];
        if(salud.vencidos) prioridades.push({ nivel:'alto', tipo:'cobros', titulo:`${salud.vencidos} cobro(s) vencido(s)`, detalle:'Revisa créditos y préstamos con fecha vencida.' });
        if(salud.agotados) prioridades.push({ nivel:'alto', tipo:'stock', titulo:`${salud.agotados} producto(s) agotado(s)`, detalle:'Conviene revisar Por Surtir.' });
        if(salud.bajos) prioridades.push({ nivel:'medio', tipo:'stock', titulo:`${salud.bajos} producto(s) con stock bajo`, detalle:'Agrúpalos por proveedor antes de comprar.' });
        const sinCodigo = (contexto.inventario || []).filter(p => p && !p.isService && !Number(p.codigoInventario)).length;
        if(sinCodigo) prioridades.push({ nivel:'medio', tipo:'inventario', titulo:`${sinCodigo} producto(s) sin código`, detalle:'Puedes asignarlos gradualmente desde Ingreso.' });
        if(cobros.length && !salud.vencidos) prioridades.push({ nivel:'bajo', tipo:'cobros', titulo:`${cobros.length} cuenta(s) por cobrar`, detalle:'No están vencidas, pero conviene darles seguimiento.' });
        if(!prioridades.length) prioridades.push({ nivel:'ok', tipo:'estado', titulo:'Sin alertas críticas', detalle:'No se detectan pendientes urgentes con los datos cargados.' });
        return prioridades;
    }

    function historialCostos(historialIngresos, productoId) {
        const id = String(productoId || '');
        const filas = [];
        for(const ingreso of Array.isArray(historialIngresos) ? historialIngresos : []) {
            const ts = numero(ingreso?.timestamp);
            for(const item of Array.isArray(ingreso?.items) ? ingreso.items : []) {
                const itemId = String(item.idFinal ?? item.idProd ?? item.productoId ?? '');
                if(itemId !== id) continue;
                const costo = numero(item.costoDespues, numero(item.costoIngresado, numero(item.costoFinal, NaN)));
                if(!Number.isFinite(costo) || costo < 0) continue;
                filas.push({ timestamp:ts, costo, proveedor:item.proveedor || ingreso.proveedor || 'NO ESPECIFICADO', cantidad:numero(item.stock, numero(item.cantidadComprada)) });
            }
        }
        filas.sort((a,b) => b.timestamp - a.timestamp);
        return filas;
    }

    function crearOrdenCompra(plan, proveedorEntrada) {
        const proveedor = normalizarTexto(proveedorEntrada);
        const items = (Array.isArray(plan) ? plan : []).filter(p => !proveedor || normalizarTexto(p.proveedorSurtido || p.proveedor) === proveedor);
        let totalCent = 0;
        const lineas = items.map(p => {
            const cantidad = Math.max(0, numero(p.cantidadSugerida));
            const costoUnitario = Math.max(0, numero(p.costo));
            const subtotalCent = centavos(cantidad * costoUnitario);
            totalCent += subtotalCent;
            return {
                id:String(p.id || ''), codigo:p.codigoInventario || '', nombre:p.nombre || 'Producto', proveedor:p.proveedorSurtido || p.proveedor || 'NO ESPECIFICADO',
                stock:numero(p.stockNormalizado, numero(p.stock)), minimo:numero(p.minimoNormalizado, numero(p.min)), cantidad,
                costoUnitario, subtotal:monedaDesdeCentavos(subtotalCent), estado:p.estadoSurtido || ''
            };
        });
        return { proveedor:proveedorEntrada || 'TODOS', items:lineas, total:monedaDesdeCentavos(totalCent), creadoEn:Date.now() };
    }

    function calcularCierre(saldos = {}, conteo = {}) {
        const esperadoEfectivo = Math.max(0, numero(saldos.efectivo));
        const esperadoBanco = Math.max(0, numero(saldos.banco));
        const realEfectivo = Math.max(0, numero(conteo.efectivo));
        const realBanco = Math.max(0, numero(conteo.banco));
        const diferenciaEfectivo = monedaDesdeCentavos(centavos(realEfectivo) - centavos(esperadoEfectivo));
        const diferenciaBanco = monedaDesdeCentavos(centavos(realBanco) - centavos(esperadoBanco));
        return {
            esperadoEfectivo, esperadoBanco, realEfectivo, realBanco,
            diferenciaEfectivo, diferenciaBanco,
            diferenciaTotal:monedaDesdeCentavos(centavos(diferenciaEfectivo) + centavos(diferenciaBanco)),
            cuadra:centavos(diferenciaEfectivo) === 0 && centavos(diferenciaBanco) === 0
        };
    }

    const CODE39 = Object.freeze({
        '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
        'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
        'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
        'U':'wwwnnnnnw','V':'nwwnnnnnw','W':'wwnnnnnnn','X':'nwnnwnnnw','Y':'wwwnwnnnn','Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwwnnnwnn',' ':'nwwnnnwnn','$':'nwnwnwnnn','/':'nwnwnnnwn','+':'nwnnnwnwn','%':'nnnwnwnwn','*':'nwnnwnwnn'
    });

    function code39(valor) {
        const limpio = String(valor ?? '').toUpperCase().replace(/[^0-9A-Z. $/+%\-]/g, '-').slice(0, 40);
        const texto = `*${limpio || '0'}*`;
        const modulos = [];
        for(const caracter of texto) {
            const patron = CODE39[caracter] || CODE39['-'];
            patron.split('').forEach((ancho, indice) => modulos.push({ barra:indice % 2 === 0, ancho:ancho === 'w' ? 3 : 1 }));
            modulos.push({ barra:false, ancho:1 });
        }
        return { texto:limpio || '0', modulos, ancho:modulos.reduce((a,m) => a + m.ancho, 0) };
    }

    function resumenCliente(cliente, ventas, anticipos) {
        const id = String(cliente?.id || '');
        const propias = (Array.isArray(ventas) ? ventas : []).filter(v => !v?.anulada && String(v?.clienteId || '') === id);
        const totalCent = propias.reduce((a,v) => a + centavos(v.ingresoTotal), 0);
        const saldoCent = propias.reduce((a,v) => a + centavos(saldoCreditoVenta(v)), 0);
        const ult = propias.sort((a,b) => numero(b.timestamp) - numero(a.timestamp))[0];
        const antCent = (Array.isArray(anticipos) ? anticipos : []).filter(a => String(a?.clienteId || '') === id && numero(a?.saldoPendiente) > 0).reduce((a,v) => a + centavos(v.saldoPendiente), 0);
        return { compras:propias.length, totalComprado:monedaDesdeCentavos(totalCent), saldoCredito:monedaDesdeCentavos(saldoCent), anticipos:monedaDesdeCentavos(antCent), ultimaCompra:ult?.timestamp || null };
    }

    function sanitizarError(error, contexto = '') {
        const mensaje = String(error?.message || error || 'Error desconocido').replace(/[\r\n]+/g, ' ').slice(0, 500);
        const nombre = String(error?.name || 'Error').slice(0, 80);
        const pila = String(error?.stack || '').split('\n').slice(0, 5).join(' | ').slice(0, 1200);
        return { nombre, mensaje, pila, contexto:String(contexto || '').slice(0,120), timestamp:Date.now() };
    }

    function borradorValido(borrador, ahora = Date.now(), maxHoras = 72) {
        return Boolean(borrador && typeof borrador === 'object' && Number.isFinite(Number(borrador.timestamp)) && ahora - Number(borrador.timestamp) <= maxHoras * 3600000 && ahora >= Number(borrador.timestamp));
    }

    global.SubliProfesionalCore = Object.freeze({
        MS_DIA, ACCIONES, numero, centavos, monedaDesdeCentavos, normalizarTexto, claveUnica, inicioDia, parseFecha,
        buscarAcciones, saldoCreditoVenta, agendaCobros, resumenSalud, prioridadesNegocio, historialCostos, crearOrdenCompra,
        calcularCierre, code39, resumenCliente, sanitizarError, borradorValido
    });
})(typeof window !== 'undefined' ? window : globalThis);
