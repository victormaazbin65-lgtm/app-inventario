(function (global) {
    'use strict';

    const core = global.SubliMejorasCore;
    if(!core) return;

    let graficoResumen = null;
    let limiteCatalogo = 500;

    function dinero(valor) {
        const simbolo = typeof configuracionNegocio === 'object' ? (configuracionNegocio.moneda || 'Q') : 'Q';
        return `${simbolo} ${core.numero(valor).toFixed(2)}`;
    }

    function escapar(valor) {
        if(typeof global.escaparHTML === 'function') return global.escaparHTML(valor);
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    function inyectarEstilos() {
        if(document.getElementById('v126-estilos')) return;
        const style = document.createElement('style');
        style.id = 'v126-estilos';
        style.textContent = `
            .v126-resumen-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}
            .v126-kpi{padding:14px;border:1px solid var(--border-color);border-radius:12px;background:rgba(15,23,42,.5)}
            .v126-kpi small{display:block;color:var(--text-light);font-size:11px;margin-bottom:4px}
            .v126-kpi strong{font-size:20px;color:var(--text-dark)}
            .v126-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end}
            .v126-toolbar .form-group{flex:1 1 160px;margin-bottom:0}
            .v126-stock-row{display:grid;grid-template-columns:minmax(180px,2fr) 1fr 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border-color)}
            .v126-stock-row:last-child{border-bottom:none}
            .v126-stock-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px}
            .v126-stock-agotado .v126-stock-dot{background:var(--primary-red)}
            .v126-stock-bajo .v126-stock-dot{background:var(--primary-orange)}
            .v126-stock-bien .v126-stock-dot{background:var(--primary-green)}
            .v126-user-tag{display:inline-block;margin-top:6px;padding:3px 7px;border:1px solid var(--border-color);border-radius:999px;color:var(--text-light);font-size:11px}
            .v126-loan-alert{border-left:4px solid var(--primary-orange);padding:9px 10px;margin-top:8px;background:rgba(251,146,60,.08);border-radius:8px}
            .v126-loan-alert.vencido{border-left-color:var(--primary-red);background:rgba(251,113,133,.08)}
            .v126-loan-alert.hoy{border-left-color:var(--primary-red)}
            body.v126-ocultar-finanzas .cost-text,
            body.v126-ocultar-finanzas .profit-text,
            body.v126-ocultar-finanzas .financial-breakdown,
            body.v126-ocultar-finanzas .financial-warning,
            body.v126-ocultar-finanzas .smart-price-help{display:none!important}
            .v126-compact-details{margin-bottom:14px}
            .v126-compact-details>.v126-content>.card{margin-bottom:0}
            @media(max-width:700px){
                .v126-resumen-grid{grid-template-columns:1fr 1fr}
                .v126-stock-row{grid-template-columns:1fr;gap:4px}
            }
            @media(max-width:420px){.v126-resumen-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    function envolverElemento(elemento, titulo, abierto = false) {
        if(!elemento || elemento.closest('.v126-compact-details')) return null;
        const details = document.createElement('details');
        details.className = 'fold-card v126-compact-details';
        details.open = abierto;
        const summary = document.createElement('summary');
        summary.textContent = titulo;
        const content = document.createElement('div');
        content.className = 'fold-card-content v126-content';
        elemento.parentNode.insertBefore(details, elemento);
        details.append(summary, content);
        content.appendChild(elemento);
        return details;
    }

    function compactarInterfaz() {
        const inicio = document.getElementById('sec-inicio');
        const panel = document.getElementById('panel-inteligente');
        if(panel) envolverElemento(panel, '✨ Centro inteligente', false);

        if(inicio) {
            const finanzas = Array.from(inicio.children).find(el =>
                el.classList?.contains('card') && /Panel de Finanzas/i.test(el.textContent || '')
            );
            if(finanzas) envolverElemento(finanzas, '💰 Panel de Finanzas', false);
        }

        [
            ['sec-ingreso', 'Historial de Ingresos', '📚 Historial de ingresos'],
            ['sec-ventas', 'Historial de Ventas', '📚 Historial de ventas'],
            ['sec-cotizacion', 'Historial de Cotizaciones', '📚 Historial de cotizaciones']
        ].forEach(([secId, texto, titulo]) => {
            const sec = document.getElementById(secId);
            if(!sec) return;
            const card = Array.from(sec.children).find(el => el.classList?.contains('card') && (el.textContent || '').includes(texto));
            if(card) envolverElemento(card, titulo, false);
        });
    }

    function actualizarWrapperCentro() {
        const panel = document.getElementById('panel-inteligente');
        const details = panel?.closest('.v126-compact-details');
        if(details) details.style.display = panel.style.display === 'none' ? 'none' : '';
    }

    function instalarAlertasPrestamo() {
        const original = global.renderPanelInteligente;
        if(typeof original === 'function' && !original.__v126) {
            const envuelta = function(...args) {
                const r = original.apply(this, args);
                renderAlertasPrestamosCentro();
                actualizarWrapperCentro();
                return r;
            };
            envuelta.__v126 = true;
            global.renderPanelInteligente = envuelta;
        }
        renderAlertasPrestamosCentro();
    }

    function renderAlertasPrestamosCentro() {
        const cont = document.getElementById('contenido-inteligente');
        if(!cont || typeof prestamos === 'undefined') return;
        const anterior = document.getElementById('v126-alertas-prestamos');
        if(anterior) anterior.remove();

        if(typeof preferenciasSistema === 'object' && !preferenciasSistema.inteligenciaActiva) return;
        if(typeof global.moduloInteligenteActivo === 'function' && !global.moduloInteligenteActivo('alertas')) return;

        const alertas = core.alertasPrestamos(prestamos, Date.now(), 3);
        const importantes = alertas.filter(a => ['vencido','hoy','proximo'].includes(a.estadoAlerta));
        if(!importantes.length) return;

        const card = document.createElement('div');
        card.id = 'v126-alertas-prestamos';
        card.className = 'smart-card';
        card.innerHTML = `<h4>🤝 Préstamos por regresar</h4>
            <p style="margin:0;color:var(--text-light);font-size:12px;">El sistema avisa por fecha sin modificar fondos automáticamente.</p>
            ${importantes.slice(0,8).map(p => {
                const etiqueta = p.estadoAlerta === 'vencido' ? `VENCIDO hace ${Math.abs(p.diasParaVencer)} día(s)` :
                    p.estadoAlerta === 'hoy' ? 'VENCE HOY' : `Vence en ${p.diasParaVencer} día(s)`;
                return `<div class="v126-loan-alert ${p.estadoAlerta}">
                    <strong>${escapar(p.persona || 'PERSONA')}</strong> · ${dinero(p.saldoPendiente)}<br>
                    <span style="font-size:11px;color:var(--text-light);">${escapar(p.motivo || '')} · ${escapar(p.vencimiento || '')} · ${etiqueta}</span>
                </div>`;
            }).join('')}
            <button class="smart-action" style="margin-top:8px;" onclick="cambiarPestaña('caja')">Ver préstamos</button>`;
        cont.prepend(card);
    }

    function inyectarPrestamoEnRetiro() {
        const modal = document.getElementById('modal-retiro-inteligente');
        const modo = document.getElementById('ret-int-modo');
        if(!modal || !modo || document.getElementById('v126-tipo-salida')) return;

        const grupoModo = modo.closest('.form-group');
        const selector = document.createElement('div');
        selector.className = 'form-group';
        selector.innerHTML = `<label>Tipo de salida</label>
            <select id="v126-tipo-salida">
                <option value="retiro">Retiro definitivo</option>
                <option value="prestamo">Dinero prestado que regresará</option>
            </select>`;
        grupoModo.parentNode.insertBefore(selector, grupoModo);

        const extra = document.createElement('div');
        extra.id = 'v126-prestamo-campos';
        extra.style.display = 'none';
        extra.innerHTML = `
            <div class="form-group"><label>Persona que recibe el préstamo</label><input id="v126-prestamo-persona" type="text" maxlength="100"></div>
            <div class="form-group"><label>¿Por qué se presta?</label><input id="v126-prestamo-motivo" type="text" maxlength="180"></div>
            <div class="form-group"><label>Fecha esperada de regreso</label><input id="v126-prestamo-fecha" type="date"></div>
            <p class="compact-note">El préstamo usa el retiro inteligente que protege SAT y, cuando regresa, restaura los mismos fondos originales.</p>`;
        grupoModo.parentNode.insertBefore(extra, document.getElementById('ret-int-grupo-monto'));

        document.getElementById('v126-tipo-salida').addEventListener('change', actualizarTipoSalida);
        actualizarTipoSalida();

        const fechaDirecta = document.getElementById('prestamo-vencimiento');
        if(fechaDirecta) fechaDirecta.required = true;

        const originalPrestamo = global.registrarPrestamo;
        if(typeof originalPrestamo === 'function' && !originalPrestamo.__v126) {
            const envuelta = async function(...args) {
                const fecha = document.getElementById('prestamo-vencimiento')?.value || '';
                if(!fecha) return alert('Selecciona la fecha esperada de devolución del préstamo.');
                return originalPrestamo.apply(this, args);
            };
            envuelta.__v126 = true;
            global.registrarPrestamo = envuelta;
        }

        const originalProcesar = global.procesarRetiroInteligente;
        if(typeof originalProcesar === 'function' && !originalProcesar.__v126) {
            const envuelta = async function(...args) {
                const tipo = document.getElementById('v126-tipo-salida')?.value || 'retiro';
                if(tipo !== 'prestamo') return originalProcesar.apply(this, args);

                const persona = document.getElementById('v126-prestamo-persona').value.trim();
                const motivo = document.getElementById('v126-prestamo-motivo').value.trim();
                const fecha = document.getElementById('v126-prestamo-fecha').value;
                const monto = document.getElementById('ret-int-monto').value;
                if(!persona || !motivo || !fecha) return alert('Completa persona, motivo y fecha esperada de devolución.');
                if(!monto || Number(monto) <= 0) return alert('Escribe un monto válido para el préstamo.');

                document.getElementById('prestamo-persona').value = persona;
                document.getElementById('prestamo-motivo').value = motivo;
                document.getElementById('prestamo-vencimiento').value = fecha;
                document.getElementById('prestamo-monto').value = monto;
                document.getElementById('prestamo-origen').value = document.getElementById('ret-int-origen').value;
                if(typeof global.cerrarRetiroInteligente === 'function') global.cerrarRetiroInteligente();
                const resultado = await global.registrarPrestamo();
                renderAlertasPrestamosCentro();
                return resultado;
            };
            envuelta.__v126 = true;
            global.procesarRetiroInteligente = envuelta;
        }
    }

    function actualizarTipoSalida() {
        const esPrestamo = document.getElementById('v126-tipo-salida')?.value === 'prestamo';
        const extra = document.getElementById('v126-prestamo-campos');
        const modo = document.getElementById('ret-int-modo')?.closest('.form-group');
        if(extra) extra.style.display = esPrestamo ? 'block' : 'none';
        if(modo) modo.style.display = esPrestamo ? 'none' : '';
        if(esPrestamo) {
            document.getElementById('ret-int-modo').value = 'inteligente';
            if(typeof global.actualizarVistaRetiroInteligente === 'function') global.actualizarVistaRetiroInteligente();
        }
    }

    function inyectarResumenRango() {
        if(document.getElementById('v126-resumen-financiero')) return;
        const sec = document.getElementById('sec-inicio');
        if(!sec) return;

        const details = document.createElement('details');
        details.id = 'v126-resumen-financiero';
        details.className = 'fold-card';
        details.open = true;
        details.innerHTML = `<summary>📈 Ventas y utilidad por día, mes o rango</summary>
            <div class="fold-card-content">
                <div class="v126-toolbar">
                    <div class="form-group"><label>Ver</label>
                        <select id="v126-resumen-modo"><option value="hoy">Hoy</option><option value="mes">Mes</option><option value="rango">Rango personalizado</option></select>
                    </div>
                    <div class="form-group" id="v126-grupo-dia"><label>Día</label><input id="v126-resumen-dia" type="date"></div>
                    <div class="form-group" id="v126-grupo-mes" style="display:none"><label>Mes</label><input id="v126-resumen-mes" type="month"></div>
                    <div class="form-group" id="v126-grupo-desde" style="display:none"><label>Desde</label><input id="v126-resumen-desde" type="date"></div>
                    <div class="form-group" id="v126-grupo-hasta" style="display:none"><label>Hasta</label><input id="v126-resumen-hasta" type="date"></div>
                </div>
                <div class="v126-resumen-grid">
                    <div class="v126-kpi"><small>Ventas realizadas</small><strong id="v126-kpi-ventas">Q 0.00</strong></div>
                    <div class="v126-kpi"><small>Dinero cobrado/aplicado</small><strong id="v126-kpi-cobrado">Q 0.00</strong></div>
                    <div class="v126-kpi"><small>Costo de productos</small><strong id="v126-kpi-productos">Q 0.00</strong></div>
                    <div class="v126-kpi"><small>Gastos de producción, trabajo y envío</small><strong id="v126-kpi-produccion">Q 0.00</strong></div>
                    <div class="v126-kpi"><small>SAT separado</small><strong id="v126-kpi-sat">Q 0.00</strong></div>
                    <div class="v126-kpi"><small>Utilidad neta</small><strong id="v126-kpi-utilidad">Q 0.00</strong></div>
                </div>
                <p id="v126-resumen-nota" class="compact-note"></p>
                <div style="min-height:220px"><canvas id="v126-grafico-financiero"></canvas></div>
            </div>`;

        const primer = sec.firstElementChild;
        sec.insertBefore(details, primer);

        const hoy = new Date();
        const iso = fechaInputLocal(hoy);
        document.getElementById('v126-resumen-dia').value = iso;
        document.getElementById('v126-resumen-desde').value = iso;
        document.getElementById('v126-resumen-hasta').value = iso;
        document.getElementById('v126-resumen-mes').value = iso.slice(0,7);

        ['v126-resumen-modo','v126-resumen-dia','v126-resumen-mes','v126-resumen-desde','v126-resumen-hasta'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => { actualizarControlesResumen(); renderResumenRango(); });
        });
        actualizarControlesResumen();
        renderResumenRango();
    }

    function fechaInputLocal(fecha) {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth()+1).padStart(2,'0');
        const d = String(fecha.getDate()).padStart(2,'0');
        return `${y}-${m}-${d}`;
    }

    function actualizarControlesResumen() {
        const modo = document.getElementById('v126-resumen-modo')?.value || 'hoy';
        document.getElementById('v126-grupo-dia').style.display = modo === 'hoy' ? '' : 'none';
        document.getElementById('v126-grupo-mes').style.display = modo === 'mes' ? '' : 'none';
        document.getElementById('v126-grupo-desde').style.display = modo === 'rango' ? '' : 'none';
        document.getElementById('v126-grupo-hasta').style.display = modo === 'rango' ? '' : 'none';
    }

    function rangoSeleccionado() {
        const modo = document.getElementById('v126-resumen-modo')?.value || 'hoy';
        if(modo === 'mes') {
            const valor = document.getElementById('v126-resumen-mes').value;
            const match = /^(\d{4})-(\d{2})$/.exec(valor);
            if(!match) return null;
            const inicio = new Date(Number(match[1]), Number(match[2]) - 1, 1).getTime();
            const fin = new Date(Number(match[1]), Number(match[2]), 1).getTime() - 1;
            return { inicio, fin, etiqueta: valor };
        }
        if(modo === 'rango') {
            const desde = core.parseFechaLocal(document.getElementById('v126-resumen-desde').value);
            const hastaInicio = core.parseFechaLocal(document.getElementById('v126-resumen-hasta').value);
            if(!Number.isFinite(desde) || !Number.isFinite(hastaInicio) || hastaInicio < desde) return null;
            return { inicio: desde, fin: hastaInicio + core.MS_DIA - 1, etiqueta: 'rango' };
        }
        const dia = core.parseFechaLocal(document.getElementById('v126-resumen-dia').value);
        return Number.isFinite(dia) ? { inicio: dia, fin: dia + core.MS_DIA - 1, etiqueta: 'día' } : null;
    }

    function renderResumenRango() {
        if(typeof ventas === 'undefined') return;
        const rango = rangoSeleccionado();
        const nota = document.getElementById('v126-resumen-nota');
        if(!rango) {
            if(nota) nota.textContent = 'Selecciona un rango válido.';
            return;
        }
        const resumen = core.resumenVentasRango(ventas, rango.inicio, rango.fin);
        const asignar = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = dinero(val); };
        asignar('v126-kpi-ventas', resumen.ventas);
        asignar('v126-kpi-cobrado', resumen.cobrado);
        asignar('v126-kpi-productos', resumen.costoProductos);
        asignar('v126-kpi-produccion', resumen.produccion);
        asignar('v126-kpi-sat', resumen.sat);
        asignar('v126-kpi-utilidad', resumen.utilidad);
        if(nota) nota.textContent = `${resumen.operaciones} operación(es). “Ventas” muestra lo vendido; “cobrado” muestra dinero recibido o anticipos aplicados.`;

        const canvas = document.getElementById('v126-grafico-financiero');
        if(!canvas || typeof global.Chart !== 'function') return;
        if(graficoResumen) graficoResumen.destroy();
        graficoResumen = new global.Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: resumen.dias.map(d => d.dia),
                datasets: [
                    { label: 'Ventas', data: resumen.dias.map(d => d.ventas), tension: .2 },
                    { label: 'Costo producto', data: resumen.dias.map(d => d.costoProductos), tension: .2 },
                    { label: 'Producción', data: resumen.dias.map(d => d.produccion), tension: .2 },
                    { label: 'Utilidad', data: resumen.dias.map(d => d.utilidad), tension: .2 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode:'index', intersect:false }, scales: { y: { beginAtZero:true } } }
        });
    }

    function inyectarCatalogoSurtido() {
        if(document.getElementById('v126-catalogo-surtido')) return;
        const sec = document.getElementById('sec-alertas');
        if(!sec) return;
        const details = document.createElement('details');
        details.id = 'v126-catalogo-surtido';
        details.className = 'fold-card';
        details.open = true;
        details.innerHTML = `<summary>🏭 Catálogo completo por proveedor</summary>
            <div class="fold-card-content">
                <p class="compact-note">Selecciona una empresa para ver todos sus productos, incluso los que todavía tienen buena existencia.</p>
                <div class="v126-toolbar">
                    <div class="form-group"><label>Proveedor / distribuidor</label><select id="v126-surtido-proveedor"></select></div>
                    <div class="form-group"><label>Buscar producto o código</label><input id="v126-surtido-busqueda" type="search" placeholder="Producto, código, categoría..."></div>
                    <div class="form-group"><label style="display:flex;gap:8px;align-items:center"><input id="v126-surtido-pendientes" type="checkbox" style="width:auto"> Solo pendientes</label></div>
                </div>
                <div id="v126-surtido-resumen" class="compact-note"></div>
                <div id="v126-surtido-lista" style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden;margin-top:10px"></div>
                <button id="v126-surtido-mas" class="btn-main" style="display:none;margin-top:10px">Mostrar más</button>
            </div>`;
        sec.prepend(details);

        document.getElementById('v126-surtido-proveedor').addEventListener('change', () => { limiteCatalogo = 500; renderCatalogoSurtido(); });
        document.getElementById('v126-surtido-busqueda').addEventListener('input', () => { limiteCatalogo = 500; renderCatalogoSurtido(); });
        document.getElementById('v126-surtido-pendientes').addEventListener('change', () => { limiteCatalogo = 500; renderCatalogoSurtido(); });
        document.getElementById('v126-surtido-mas').addEventListener('click', () => { limiteCatalogo += 500; renderCatalogoSurtido(); });
        renderCatalogoSurtido();
    }

    function renderCatalogoSurtido() {
        if(typeof inventario === 'undefined') return;
        const select = document.getElementById('v126-surtido-proveedor');
        const busqueda = document.getElementById('v126-surtido-busqueda');
        const pendientes = document.getElementById('v126-surtido-pendientes');
        const lista = document.getElementById('v126-surtido-lista');
        const resumen = document.getElementById('v126-surtido-resumen');
        if(!select || !lista) return;

        const proveedores = Array.from(new Set(inventario.filter(p => p && !p.isService).map(p => core.normalizarProveedor(p.proveedor)))).sort((a,b)=>a.localeCompare(b,'es'));
        const valorActual = select.value || 'TODOS';
        select.innerHTML = `<option value="TODOS">Todos los proveedores</option>${proveedores.map(p => `<option value="${escapar(p)}">${escapar(p)}</option>`).join('')}`;
        select.value = proveedores.includes(valorActual) ? valorActual : 'TODOS';

        const catalogo = core.catalogoProveedor(inventario, {
            proveedor: select.value,
            busqueda: busqueda?.value || '',
            soloPendientes: pendientes?.checked
        });
        const visibles = catalogo.slice(0, limiteCatalogo);
        const cont = { agotado:0, bajo:0, bien:0 };
        catalogo.forEach(p => cont[p.estadoStock]++);
        if(resumen) resumen.textContent = `${catalogo.length} producto(s) · ${cont.agotado} agotado(s) · ${cont.bajo} bajo(s) · ${cont.bien} con existencia suficiente.`;
        lista.innerHTML = visibles.length ? visibles.map(p => {
            const etiqueta = p.estadoStock === 'agotado' ? 'AGOTADO' : p.estadoStock === 'bajo' ? 'BAJO' : 'BIEN';
            const clase = `v126-stock-${p.estadoStock}`;
            const unidad = p.unidadAbreviatura || 'unid';
            return `<div class="v126-stock-row ${clase}">
                <div><strong><span class="v126-stock-dot"></span>${p.codigoInventario ? escapar(p.codigoInventario) + ' · ' : ''}${escapar(p.nombre || '')}</strong><br><small style="color:var(--text-light)">${escapar(p.proveedorNormalizado)}</small></div>
                <div>Existencia: <strong>${core.numero(p.stock)} ${escapar(unidad)}</strong></div>
                <div>Mínimo: <strong>${Math.max(0,core.numero(p.min))}</strong></div>
                <div><strong>${etiqueta}</strong></div>
            </div>`;
        }).join('') : '<p class="item-details" style="padding:14px">No hay productos con este filtro.</p>';
        const mas = document.getElementById('v126-surtido-mas');
        if(mas) mas.style.display = catalogo.length > visibles.length ? '' : 'none';
    }

    function inyectarCodigoIngreso() {
        if(document.getElementById('inv-codigo-opcional')) return;
        const referencia = document.getElementById('grupo-min-producto') || document.getElementById('grupo-categoria-producto');
        if(!referencia) return;
        const grupo = document.createElement('div');
        grupo.className = 'form-group';
        grupo.id = 'v126-grupo-codigo-ingreso';
        grupo.innerHTML = `<label>Código de inventario (Opcional)</label>
            <input id="inv-codigo-opcional" type="number" min="1" step="1" inputmode="numeric" placeholder="Déjalo vacío para asignarlo después">
            <p class="compact-note" id="v126-nota-codigo">Si escribes uno, se reservará en Firestore dentro de la misma transacción y no podrá duplicarse.</p>`;
        referencia.parentNode.insertBefore(grupo, referencia.nextSibling);

        const originalAgregar = global.agregarAlCarritoIngreso;
        if(typeof originalAgregar === 'function' && !originalAgregar.__v126) {
            const envuelta = function(...args) {
                const campo = document.getElementById('inv-codigo-opcional');
                const texto = campo?.value.trim() || '';
                const idExistente = document.getElementById('ingreso-producto-id')?.value || '';
                const producto = typeof inventario !== 'undefined' ? inventario.find(p => String(p.id) === String(idExistente)) : null;
                let codigoManual = null;

                if(texto) {
                    if(producto?.codigoInventario && Number(producto.codigoInventario) !== Number(texto)) {
                        return alert(`El producto ya tiene el código permanente ${producto.codigoInventario}; no puede cambiarse desde Ingreso.`);
                    }
                    const ocupados = [];
                    if(typeof inventario !== 'undefined') inventario.forEach(p => { if(p?.codigoInventario) ocupados.push(Number(p.codigoInventario)); });
                    if(typeof carritoIngresos !== 'undefined') carritoIngresos.forEach(i => { if(i?.codigoInventarioManual) ocupados.push(Number(i.codigoInventarioManual)); });
                    if(producto?.codigoInventario) codigoManual = Number(producto.codigoInventario);
                    else {
                        try { codigoManual = core.validarCodigoManual(texto, ocupados); }
                        catch(error) { return alert(error.message); }
                    }
                }

                const antes = typeof carritoIngresos !== 'undefined' ? carritoIngresos.length : 0;
                const r = originalAgregar.apply(this, args);
                if(typeof carritoIngresos !== 'undefined' && carritoIngresos.length > antes) {
                    const item = carritoIngresos[carritoIngresos.length - 1];
                    if(codigoManual) item.codigoInventarioManual = codigoManual;
                    if(campo) campo.value = '';
                    if(typeof global.renderCarritoIngresos === 'function') global.renderCarritoIngresos();
                }
                return r;
            };
            envuelta.__v126 = true;
            global.agregarAlCarritoIngreso = envuelta;
        }

        const originalReservar = global.reservarCodigoInventarioEnTransaccion;
        if(typeof originalReservar === 'function' && !originalReservar.__v126) {
            const envuelta = async function(t, producto, estado, ocupados, timestamp) {
                let preparado = producto;
                if(preparado && !preparado.codigoInventario && typeof carritoIngresos !== 'undefined') {
                    const item = carritoIngresos.find(i =>
                        (i.isNew && String(i.nombre) === String(preparado.nombre)) ||
                        (!i.isNew && String(i.idOriginal) === String(preparado.id))
                    );
                    if(item?.codigoInventarioManual) preparado = { ...preparado, codigoInventario: Number(item.codigoInventarioManual) };
                }
                return originalReservar.call(this, t, preparado, estado, ocupados, timestamp);
            };
            envuelta.__v126 = true;
            global.reservarCodigoInventarioEnTransaccion = envuelta;
        }

        const originalRender = global.renderCarritoIngresos;
        if(typeof originalRender === 'function' && !originalRender.__v126) {
            const envuelta = function(...args) {
                const r = originalRender.apply(this, args);
                const filas = document.querySelectorAll('#lista-ingresos-pendientes .item-row');
                filas.forEach((fila, i) => {
                    const item = typeof carritoIngresos !== 'undefined' ? carritoIngresos[i] : null;
                    if(item?.codigoInventarioManual && !fila.querySelector('.v126-user-tag')) {
                        const tag = document.createElement('span');
                        tag.className = 'v126-user-tag';
                        tag.textContent = `Código solicitado: ${item.codigoInventarioManual}`;
                        fila.querySelector('.item-info')?.appendChild(tag);
                    }
                });
                return r;
            };
            envuelta.__v126 = true;
            global.renderCarritoIngresos = envuelta;
        }

        document.getElementById('inv-modo')?.addEventListener('change', actualizarCampoCodigoIngreso);
        document.getElementById('sugerencias-ingreso-box')?.addEventListener('click', () => setTimeout(actualizarCampoCodigoIngreso, 0));
        actualizarCampoCodigoIngreso();
    }

    function actualizarCampoCodigoIngreso() {
        const campo = document.getElementById('inv-codigo-opcional');
        const nota = document.getElementById('v126-nota-codigo');
        if(!campo || typeof inventario === 'undefined') return;
        const modo = document.getElementById('inv-modo')?.value || 'existente';
        if(modo === 'nuevo') {
            campo.readOnly = false;
            campo.value = '';
            if(nota) nota.textContent = 'Opcional. Si lo dejas vacío, el sistema puede asignarlo después desde Inventario.';
            return;
        }
        const id = document.getElementById('ingreso-producto-id')?.value || '';
        const producto = inventario.find(p => String(p.id) === String(id));
        if(producto?.codigoInventario) {
            campo.value = producto.codigoInventario;
            campo.readOnly = true;
            if(nota) nota.textContent = 'Este producto ya tiene un código permanente y no se puede duplicar ni cambiar aquí.';
        } else {
            campo.value = '';
            campo.readOnly = false;
            if(nota) nota.textContent = 'Este producto todavía no tiene código. Puedes asignarlo ahora o hacerlo después en Inventario.';
        }
    }

    async function guardarMarcaUsuario(coleccion, registros) {
        if(!global.db || !navigator.onLine || !currentUserData) return;
        for(const registro of registros) {
            const campos = {
                creadoPorId: currentUserData.id || null,
                creadoPorNombre: currentUserData.nombre || 'Usuario',
                creadoPorRol: currentUserData.rol || 'empleado'
            };
            if(registro.__editado) {
                campos.editadoPorId = currentUserData.id || null;
                campos.editadoPorNombre = currentUserData.nombre || 'Usuario';
                campos.editadoEnUsuario = Date.now();
            }
            Object.assign(registro, campos);
            try {
                await global.setDoc(global.doc(global.db, coleccion, String(registro.id)), campos, { merge: true });
            } catch(error) {
                console.warn(`No se pudo guardar la marca de usuario en ${coleccion}.`, error);
            }
            delete registro.__editado;
        }
    }

    function instalarTrazabilidadUsuario() {
        const envolver = (nombreFuncion, coleccion, obtenerLista) => {
            const original = global[nombreFuncion];
            if(typeof original !== 'function' || original.__v126) return;
            const envuelta = async function(...args) {
                const listaAntes = obtenerLista();
                const mapaAntes = new Map(listaAntes.map(r => [String(r.id), `${r.revision || 0}|${r.editadoEn || ''}`]));
                const r = await original.apply(this, args);
                const listaDespues = obtenerLista();
                const tocados = listaDespues.filter(reg => {
                    const previo = mapaAntes.get(String(reg.id));
                    const firma = `${reg.revision || 0}|${reg.editadoEn || ''}`;
                    if(previo === undefined) return true;
                    if(previo !== firma) { reg.__editado = true; return true; }
                    return false;
                });
                if(tocados.length) await guardarMarcaUsuario(coleccion, tocados);
                decorarUsuariosHistorial();
                renderResumenRango();
                return r;
            };
            envuelta.__v126 = true;
            global[nombreFuncion] = envuelta;
        };
        envolver('procesarVentaMultiple', 'ventas', () => typeof ventas !== 'undefined' ? ventas : []);
        envolver('procesarCotizacion', 'cotizaciones', () => typeof historialCotizaciones !== 'undefined' ? historialCotizaciones : []);
    }

    function extraerIdFila(fila) {
        const botones = fila.querySelectorAll('[onclick*="decodeURIComponent"]');
        for(const boton of botones) {
            const texto = boton.getAttribute('onclick') || '';
            const match = /decodeURIComponent\('([^']+)'\)/.exec(texto);
            if(match) {
                try { return decodeURIComponent(match[1]); } catch(_) { return match[1]; }
            }
        }
        return '';
    }

    function decorarContenedor(contenedor, registros) {
        if(!contenedor) return;
        contenedor.querySelectorAll('.item-row').forEach(fila => {
            if(fila.querySelector('.v126-user-tag')) return;
            const id = extraerIdFila(fila);
            if(!id) return;
            const registro = registros.find(r => String(r.id) === String(id));
            if(!registro) return;
            const nombre = registro.creadoPorNombre || registro.usuarioNombre;
            if(!nombre) return;
            const tag = document.createElement('span');
            tag.className = 'v126-user-tag';
            tag.textContent = `Realizado por: ${nombre}${registro.editadoPorNombre ? ` · Editado por: ${registro.editadoPorNombre}` : ''}`;
            (fila.querySelector('.item-info') || fila).appendChild(tag);
        });
    }

    function decorarUsuariosHistorial() {
        if(typeof ventas !== 'undefined') decorarContenedor(document.getElementById('lista-ventas'), ventas);
        if(typeof historialCotizaciones !== 'undefined') decorarContenedor(document.getElementById('lista-cotizaciones'), historialCotizaciones);
    }

    function observarHistoriales() {
        ['lista-ventas','lista-cotizaciones'].forEach(id => {
            const el = document.getElementById(id);
            if(!el || el.__v126Observer) return;
            const obs = new MutationObserver(() => decorarUsuariosHistorial());
            obs.observe(el, { childList:true, subtree:true });
            el.__v126Observer = obs;
        });
        decorarUsuariosHistorial();
    }

    function inyectarPermisoFinanzas() {
        const nuevoBox = document.querySelector('#nuevo-permisos-box > div');
        const editBox = document.querySelector('#edit-permisos-box > div');
        if(nuevoBox && !document.getElementById('nuevo-perm-finanzas')) {
            nuevoBox.insertAdjacentHTML('beforeend', '<label><input type="checkbox" id="nuevo-perm-finanzas"> 💰 Ver costos, márgenes y utilidades internas</label>');
        }
        if(editBox && !document.getElementById('edit-perm-finanzas')) {
            editBox.insertAdjacentHTML('beforeend', '<label><input type="checkbox" id="edit-perm-finanzas"> 💰 Ver costos, márgenes y utilidades internas</label>');
        }

        const abrirOriginal = global.abrirModalEditarUser;
        if(typeof abrirOriginal === 'function' && !abrirOriginal.__v126) {
            const envuelta = function(id, ...rest) {
                const r = abrirOriginal.call(this, id, ...rest);
                const user = typeof usuarios !== 'undefined' ? usuarios.find(u => String(u.id) === String(id)) : null;
                const cb = document.getElementById('edit-perm-finanzas');
                if(cb) cb.checked = Boolean(user?.permisos?.verFinanzas);
                return r;
            };
            envuelta.__v126 = true;
            global.abrirModalEditarUser = envuelta;
        }

        const crearOriginal = global.crearUsuario;
        if(typeof crearOriginal === 'function' && !crearOriginal.__v126) {
            const envuelta = async function(...args) {
                const ids = new Set((typeof usuarios !== 'undefined' ? usuarios : []).map(u => String(u.id)));
                const permiso = Boolean(document.getElementById('nuevo-perm-finanzas')?.checked);
                const r = await crearOriginal.apply(this, args);
                const nuevo = typeof usuarios !== 'undefined' ? usuarios.find(u => !ids.has(String(u.id))) : null;
                if(nuevo && nuevo.rol === 'empleado') {
                    nuevo.permisos = { ...(nuevo.permisos || {}), verFinanzas: permiso };
                    try { await global.guardarUsuarios(); } catch(error) { alert('El usuario se creó, pero no se pudo guardar el permiso financiero: ' + error.message); }
                }
                return r;
            };
            envuelta.__v126 = true;
            global.crearUsuario = envuelta;
        }

        const editarOriginal = global.guardarEdicionUser;
        if(typeof editarOriginal === 'function' && !editarOriginal.__v126) {
            const envuelta = async function(...args) {
                const id = document.getElementById('edit-user-id')?.value || '';
                const permiso = Boolean(document.getElementById('edit-perm-finanzas')?.checked);
                const r = await editarOriginal.apply(this, args);
                const user = typeof usuarios !== 'undefined' ? usuarios.find(u => String(u.id) === String(id)) : null;
                if(user && user.rol === 'empleado') {
                    user.permisos = { ...(user.permisos || {}), verFinanzas: permiso };
                    try { await global.guardarUsuarios(); } catch(error) { alert('La edición principal se guardó, pero no se pudo actualizar el permiso financiero: ' + error.message); }
                }
                aplicarVisibilidadFinanciera();
                return r;
            };
            envuelta.__v126 = true;
            global.guardarEdicionUser = envuelta;
        }

        const permisosOriginal = global.aplicarPermisos;
        if(typeof permisosOriginal === 'function' && !permisosOriginal.__v126) {
            const envuelta = function(...args) {
                const r = permisosOriginal.apply(this, args);
                aplicarVisibilidadFinanciera();
                return r;
            };
            envuelta.__v126 = true;
            global.aplicarPermisos = envuelta;
        }
        aplicarVisibilidadFinanciera();
    }

    function aplicarVisibilidadFinanciera() {
        const ocultar = typeof currentUserData !== 'undefined' && currentUserData && !core.puedeVerFinanzas(currentUserData);
        document.body.classList.toggle('v126-ocultar-finanzas', Boolean(ocultar));
    }

    function envolverActualizacionUI() {
        const original = global.actualizarUI;
        if(typeof original !== 'function' || original.__v126) return;
        const envuelta = function(...args) {
            const r = original.apply(this, args);
            renderResumenRango();
            renderCatalogoSurtido();
            renderAlertasPrestamosCentro();
            decorarUsuariosHistorial();
            aplicarVisibilidadFinanciera();
            return r;
        };
        envuelta.__v126 = true;
        global.actualizarUI = envuelta;
    }

    function init() {
        inyectarEstilos();
        compactarInterfaz();
        inyectarPrestamoEnRetiro();
        inyectarResumenRango();
        inyectarCatalogoSurtido();
        inyectarCodigoIngreso();
        inyectarPermisoFinanzas();
        instalarTrazabilidadUsuario();
        instalarAlertasPrestamo();
        observarHistoriales();
        envolverActualizacionUI();
        renderResumenRango();
        renderCatalogoSurtido();
        renderAlertasPrestamosCentro();
        aplicarVisibilidadFinanciera();
    }

    global.SubliMejorasV126 = Object.freeze({
        init,
        renderResumenRango,
        renderCatalogoSurtido,
        renderAlertasPrestamosCentro,
        aplicarVisibilidadFinanciera
    });

    if(document.readyState === 'complete') init();
    else global.addEventListener('load', init, { once:true });
})(typeof window !== 'undefined' ? window : globalThis);
