(function historialVentas(global) {
    'use strict';
    const core = global.SubliNegocioCore;
    const lista = valor => Array.isArray(valor) ? valor.filter(v => v && typeof v === 'object') : [];
    const esNumero = valor => (typeof valor === 'number' || typeof valor === 'string' && valor.trim() !== '') && Number.isFinite(Number(valor));
    const dinero = valor => esNumero(valor) ? escaparHTML(dineroNegocio(Number(valor))) : 'Sin registrar';
    const cantidad = item => [esNumero(item.qty) ? Number(item.qty) : '—', item.unidadAbreviatura || item.unidadId].filter(Boolean).join(' ');
    const nombre = item => item.nombre || 'Artículo sin nombre';

    function importeLinea(item) {
        if (!esNumero(item.qty) || Number(item.qty) <= 0) return '';
        if (Number.isSafeInteger(item.ingresoLineaOriginalCentavos) && item.ingresoLineaOriginalCentavos >= 0 &&
            Number.isSafeInteger(item.cantidadOriginalMilesimas) && item.cantidadOriginalMilesimas >= core.aMilesimas(item.qty) && core.aMilesimas(item.qty) > 0) {
            return dinero(core.calcularDevolucionLinea(item, item.qty).ingresoDevuelto);
        }
        return esNumero(item.precioCobrado) ? `${dinero(core.redondearMoneda(Number(item.qty) * Number(item.precioCobrado)))} (calculado)` : '';
    }

    function filaProducto(item) {
        const incluido = item.rol === 'material' || item.rol === 'combo';
        const tipo = item.rol === 'material' ? 'Material' : item.rol === 'combo' ? 'Componente de combo' : item.isService ? 'Servicio' : 'Producto';
        const importe = importeLinea(item);
        const sinCargo = incluido && Number(item.precioCobrado) === 0 && esNumero(item.precioCobrado) && !item.ingresoLineaOriginalCentavos;
        const codigo = item.codigoInventario ? ` · Cód. ${escaparHTML(item.codigoInventario)}` : '';
        return `<li class="venta-linea"><div><strong>${escaparHTML(nombre(item))}</strong><small>${tipo}${codigo}</small></div>
            <div>${escaparHTML(cantidad(item))}${sinCargo ? '' : ` × ${dinero(item.precioCobrado)}`}<small>${sinCargo ? 'Incluido en la venta' : importe || 'Importe sin registrar'}</small></div></li>`;
    }

    function movimientos(titulo, registros, fila, clave) {
        if (!registros.length) return '';
        return `<details data-apartado="${clave}"><summary>${titulo} (${registros.length})</summary><ul class="venta-movimientos">${registros.map(m => `<li>${fila(m)}</li>`).join('')}</ul></details>`;
    }

    function tarjeta(venta) {
        const items = lista(venta.detalleItems);
        const devoluciones = lista(venta.devoluciones);
        const totalDevuelto = devoluciones.length > 0 && Array.isArray(venta.detalleItems) && !items.length;
        const clave = escaparHTML(venta.id);
        const nombres = items.filter(i => i.rol !== 'material').map(nombre);
        const vista = (nombres.length ? nombres : items.map(nombre)).slice(0, 2).join(' · ');
        const cantidadNombres = nombres.length || items.length;
        const titulo = vista ? vista + (cantidadNombres > 2 ? ` (+${cantidadNombres - 2})` : '') :
            (totalDevuelto ? venta.resumenItemsOriginal || devoluciones.map(d => d.productoNombre).filter(Boolean).join(' · ') : venta.resumenItems) || 'Venta sin detalle de productos';
        const estado = totalDevuelto ? 'Devuelta' : Number(venta.saldoPendiente) > 0 ? 'Crédito pendiente' :
            esNumero(venta.saldoPendiente) || venta.estadoCobro === 'pagado' ? 'Pagada' : 'Cobro sin desglose';
        const reembolsos = movimientos('Devoluciones', devoluciones, d => {
            const partes = [`${escaparHTML(d.fecha)} · ${escaparHTML(d.cantidad)} × ${escaparHTML(d.productoNombre)}`, `Importe devuelto ${dinero(d.ingresoDevuelto)}`];
            if (Number(d.reembolsoDinero) > 0) partes.push(`dinero reembolsado ${dinero(d.reembolsoDinero)}`);
            if (Number(d.anticipoRestaurado) > 0) partes.push(`anticipo restituido ${dinero(d.anticipoRestaurado)}`);
            if (Number(d.creditoReducido) > 0) partes.push(`crédito reducido ${dinero(d.creditoReducido)}`);
            if (d.motivo) partes.push(escaparHTML(d.motivo));
            return partes.join(' · ');
        }, 'devoluciones');
        const stock = movimientos('Movimiento de inventario al registrar', lista(venta.movimientosInventario), m =>
            `${escaparHTML(m.nombre || m.productoId)} · ${escaparHTML(m.stockAntes)} − ${escaparHTML(m.cantidad)} = ${escaparHTML(m.stockDespues)} ${escaparHTML(m.unidad)}`, 'stock');
        const pagos = movimientos('Pagos registrados', lista(venta.pagos), p =>
            `${escaparHTML(p.fecha)} · ${escaparHTML(core.METODOS_PAGO[p.metodo]?.nombre || p.metodo || 'Método sin registrar')} · ${dinero(p.monto)}`, 'pagos');
        const campos = (filas) => filas.filter(([,valor]) => esNumero(valor)).map(([etiqueta,valor]) => `<div><dt>${escaparHTML(etiqueta)}</dt><dd>${dinero(valor)}</dd></div>`).join('');
        const cobro = campos([['Cobrado y aplicado',venta.montoCobradoTotal],['Anticipo aplicado',venta.anticipoAplicado],['Saldo pendiente',venta.saldoPendiente]]);
        const finanzas = puedeConsultarFinanzasInteligentes() ? campos([
            ['Costo de productos y servicios',venta.costosProductos],[configuracionNegocio.nombreFondoProduccion,venta.costoTinta],
            [configuracionNegocio.nombreManoObra,venta.costoManoObra],['Envío',venta.costoEnvio],
            [ `Impuesto (${numeroFinito(venta.porcentajeSAT, 5)}%)`,venta.factura ? venta.impuestoSAT : null],['Ganancia neta',venta.ganancia]
        ]) : '';
        const acciones = [];
        const version = Number(venta.versionCalculo);
        if (version === 2) acciones.push(['editar','Editar venta']);
        if (version >= 3 && items.length && puedeAbrirSeccionSubli('caja')) acciones.push(['devolver','Registrar devolución']);
        if (version >= 2 && !devoluciones.length) acciones.push(['deshacer','Deshacer venta']);
        const notasStock = Array.isArray(venta.movimientosInventario) && !venta.movimientosInventario.length ? 'Sin descuento de existencias al registrar.' : '';
        const resumenOriginal = devoluciones.length && venta.resumenItemsOriginal ? `<p>Venta original · ${escaparHTML(venta.resumenItemsOriginal)}</p>` : '';
        return `<details class="venta-ficha" data-venta="${clave}" data-apartado="ficha"><summary>
            <span class="venta-encabezado"><strong>${escaparHTML(titulo)}</strong><small>${escaparHTML(venta.fecha || 'Fecha sin registrar')} · ${escaparHTML(venta.clienteNombre || 'C/F')}</small></span>
            <span class="venta-importe"><strong>${dinero(venta.ingresoTotal)}</strong><small>${estado}${venta.factura ? ' · Con factura' : ''}</small></span></summary>
            <div class="venta-cuerpo"><p class="venta-ref">Referencia ${clave}</p><h4>${devoluciones.length ? 'Productos después de devoluciones' : 'Productos de la venta'}</h4>
            ${items.length ? `<ul class="venta-productos">${items.map(filaProducto).join('')}</ul>` : `<p>${totalDevuelto ? 'Se devolvieron todos los artículos.' : 'Esta venta antigua solo conserva la información del resumen.'}</p>`}
            ${resumenOriginal}${cobro ? `<dl class="venta-cifras">${cobro}</dl>` : ''}${pagos}${reembolsos}${stock}${notasStock ? `<p>${notasStock}</p>` : ''}
            ${finanzas ? `<details data-apartado="finanzas"><summary>Costos y ganancia</summary><dl class="venta-cifras">${finanzas}</dl></details>` : ''}
            ${acciones.length ? `<div class="venta-acciones">${acciones.map(([accion,texto]) => `<button type="button" data-accion="${accion}" class="btn-sm ${accion === 'deshacer' ? 'btn-delete' : 'btn-edit'}">${texto}</button>`).join('')}</div>` : ''}</div></details>`;
    }

    function renderHistorialVentas(actualizarMeses = false) {
        const cont = document.getElementById('lista-ventas');
        if (!cont || !puedeAbrirSeccionSubli('ventas')) return;
        if (actualizarMeses) popularSelectMeses(ventas, 'filtro-mes-ventas');
        const mes = document.getElementById('filtro-mes-ventas').value || 'todos';
        const consulta = document.getElementById('buscar-historial-ventas').value.trim();
        const cargadas = ventas.filter(v => v && !v.anulada);
        const filtradas = cargadas.filter(v => {
            if (mes !== 'todos' && getMesAnioFromDate(v.fecha, v.timestamp, v) !== mes) return false;
            if (!consulta) return true;
            const campos = [v.id, v.clienteNombre, v.resumenItems, v.resumenItemsOriginal];
            for (const item of lista(v.detalleItems)) campos.push(item.nombre, item.codigoInventario);
            for (const d of lista(v.devoluciones)) campos.push(d.productoNombre);
            return busquedaInteligente(campos.join(' '), consulta);
        }).sort((a,b) => numeroFinito(b.timestamp || b.id) - numeroFinito(a.timestamp || a.id));
        const visibles = document.getElementById('limite-historial-ventas').value === 'all' ? filtradas : filtradas.slice(0,50);
        const alcance = historialCompletoCargado.ventas ? 'Historial completo cargado.' : 'Búsqueda en las ventas cargadas.';
        document.getElementById('cobertura-historial-ventas').textContent = `Mostrando ${visibles.length} de ${filtradas.length} coincidencias. ${alcance}`;
        const html = visibles.length ? visibles.map(tarjeta).join('') : `<p class="compact-note">${consulta || mes !== 'todos' ? 'Ninguna venta coincide con la búsqueda y el mes elegidos.' : 'No hay ventas registradas en los datos cargados.'}</p>`;
        if (html === cont.ultimoHistorial) return;
        const identificar = el => JSON.stringify([el.closest('[data-venta]')?.dataset.venta,el.dataset.apartado]);
        const abiertos = new Set(Array.from(cont.querySelectorAll('details[open]'), identificar));
        const foco = document.activeElement;
        const origenFoco = cont.contains(foco) ? foco.closest('details') : null;
        const fichaFoco = origenFoco && identificar(origenFoco);
        cont.innerHTML = html;
        cont.ultimoHistorial = html;
        for (const d of cont.querySelectorAll('details')) {
            const id = identificar(d);
            d.open = abiertos.has(id);
            if (id === fichaFoco) {
                const destino = foco.dataset.accion ? Array.from(d.querySelectorAll('button')).find(b => b.dataset.accion === foco.dataset.accion) : d.querySelector('summary');
                destino?.focus({preventScroll:true});
            }
        }
    }

    document.getElementById('lista-ventas').addEventListener('click', event => {
        const boton = event.target.closest('button[data-accion]');
        if (!boton || !puedeAbrirSeccionSubli('ventas')) return;
        const id = boton.closest('[data-venta]').dataset.venta;
        if (boton.dataset.accion === 'editar') return editarVenta(id);
        if (boton.dataset.accion === 'deshacer') return borrarVenta(id);
        if (!puedeAbrirSeccionSubli('caja')) return;
        cambiarPestaña('caja');
        const select = document.getElementById('devolucion-venta');
        select.value = id;
        actualizarOpcionesDevolucion();
        global.subliAbrirPanel?.(select);
        const panel = select.closest('details');
        if (panel) panel.open = true;
        select.focus();
        if (select.value !== id) alert('La venta ya no está disponible para devolución. Revisa el historial actualizado.');
    });
    global.renderHistorialVentas = renderHistorialVentas;
})(window);

