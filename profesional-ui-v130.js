(function (global) {
    'use strict';

    const core = global.SubliProfesionalCore;
    if(!core) return;

    const DRAFT_PREFIX = 'subli_borrador_v130_';
    const TRAINING_KEY = 'subli_modo_capacitacion_v130';
    let ultimaFirmaSalud = '';

    function escapar(valor) {
        if(typeof global.escaparHTML === 'function') return global.escaparHTML(valor);
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    function dinero(valor) {
        let simbolo = 'Q';
        try { simbolo = configuracionNegocio?.moneda || 'Q'; } catch(_) {}
        return `${simbolo} ${core.numero(valor).toFixed(2)}`;
    }

    function usuarioActual() {
        try { return currentUserData || null; } catch(_) { return null; }
    }

    function puedeFinanzas() {
        const u = usuarioActual();
        if(!u) return false;
        if(global.SubliMejorasCore?.puedeVerFinanzas) return global.SubliMejorasCore.puedeVerFinanzas(u);
        return u.rol === 'dueno';
    }

    function contexto() {
        let inv=[], vts=[], prs=[], ants=[], cli=[], ing=[], saldos={};
        try { inv = Array.isArray(inventario) ? inventario : []; } catch(_) {}
        try { vts = Array.isArray(ventas) ? ventas : []; } catch(_) {}
        try { prs = Array.isArray(prestamos) ? prestamos : []; } catch(_) {}
        try { ants = Array.isArray(anticipos) ? anticipos : []; } catch(_) {}
        try { cli = Array.isArray(clientes) ? clientes : []; } catch(_) {}
        try { ing = Array.isArray(historialIngresos) ? historialIngresos : []; } catch(_) {}
        try { saldos = saldosDinero || {}; } catch(_) {}
        return { inventario:inv, ventas:vts, prestamos:prs, anticipos:ants, clientes:cli, ingresos:ing, saldosDinero:saldos, ahora:Date.now() };
    }

    function inyectarEstilos() {
        if(document.getElementById('v130-ui-estilos')) return;
        const style = document.createElement('style');
        style.id = 'v130-ui-estilos';
        style.textContent = `
            .v130-commandbar{display:flex;gap:9px;align-items:center;margin:0 0 14px;padding:9px;border:1px solid var(--border-color);border-radius:14px;background:var(--card-bg);box-shadow:var(--shadow)}
            .v130-command-trigger{flex:1;display:flex;align-items:center;gap:9px;min-height:42px;padding:8px 12px;border:1px solid var(--border-color);border-radius:10px;background:var(--input-bg,var(--surface-bg));color:var(--text-light);cursor:pointer;text-align:left;font:inherit}
            .v130-command-trigger strong{color:var(--text-dark);font-weight:650}.v130-shortcut{margin-left:auto;padding:2px 7px;border:1px solid var(--border-color);border-radius:6px;font-size:10px;color:var(--text-light)}
            #v130-sync{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;padding:7px 10px;border:1px solid var(--border-color);border-radius:999px;font-size:11px;font-weight:700;color:var(--text-light)}
            #v130-sync::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--primary-green)}#v130-sync.offline::before{background:var(--primary-red)}#v130-sync.saving::before{background:var(--primary-orange);animation:v130pulse 1s infinite alternate}#v130-sync.error::before{background:var(--primary-red)}
            @keyframes v130pulse{to{opacity:.35}}
            #v130-command-modal{position:fixed;inset:0;z-index:1400;display:none;align-items:flex-start;justify-content:center;padding:9vh 14px 20px;background:rgba(2,6,23,.72);backdrop-filter:blur(8px)}#v130-command-modal.open{display:flex}
            .v130-command-card{width:min(680px,100%);max-height:78vh;overflow:auto;padding:14px;border:1px solid var(--border-color);border-radius:18px;background:var(--card-bg);box-shadow:0 30px 90px rgba(0,0,0,.45)}
            #v130-command-input{font-size:17px;min-height:50px}.v130-command-results{margin-top:9px;display:grid;gap:6px}.v130-command-item{display:grid;grid-template-columns:1fr auto;gap:8px;width:100%;padding:11px;border:1px solid transparent;border-radius:11px;background:transparent;color:var(--text-dark);text-align:left;cursor:pointer}.v130-command-item:hover,.v130-command-item:focus{border-color:var(--primary-blue);background:var(--surface-soft)}.v130-command-item small{display:block;color:var(--text-light);margin-top:3px}.v130-command-key{font-size:10px;color:var(--text-light);align-self:center}
            .v130-panel{margin-bottom:14px}.v130-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.v130-kpi{padding:12px;border:1px solid var(--border-color);border-radius:12px;background:var(--surface-soft)}.v130-kpi small{display:block;color:var(--text-light);font-size:10px;margin-bottom:4px}.v130-kpi strong{display:block;font-size:19px;font-variant-numeric:tabular-nums}.v130-kpi.alert strong{color:var(--primary-red)}
            .v130-prioridad{padding:8px 0;border-bottom:1px solid var(--border-color)}.v130-prioridad:last-child{border-bottom:0}.v130-prioridad strong{font-size:12px}.v130-prioridad span{display:block;color:var(--text-light);font-size:11px;margin-top:2px}.v130-prioridad.alto strong{color:var(--primary-red)}.v130-prioridad.medio strong{color:var(--primary-orange)}
            .v130-cobro{display:grid;grid-template-columns:1fr auto;gap:8px;padding:9px 0;border-bottom:1px solid var(--border-color)}.v130-cobro:last-child{border-bottom:0}.v130-cobro small{color:var(--text-light)}.v130-cobro .vencido{color:var(--primary-red);font-weight:700}.v130-cobro .hoy{color:var(--primary-orange);font-weight:700}
            .v130-draft-banner{margin:0 0 10px;padding:10px 12px;border:1px solid var(--primary-blue);border-radius:12px;background:color-mix(in srgb,var(--primary-blue) 8%,transparent);font-size:12px}.v130-draft-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}.v130-mini-btn{padding:7px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--surface-soft);color:var(--text-dark);cursor:pointer;font-weight:650}
            .v130-history-table{width:100%;border-collapse:collapse;font-size:11px}.v130-history-table th,.v130-history-table td{padding:7px 5px;border-bottom:1px solid var(--border-color);text-align:left}.v130-history-table th{color:var(--text-light)}
            .v130-guide{margin:0 0 12px;padding:11px 13px;border:1px solid var(--primary-blue);border-radius:12px;background:color-mix(in srgb,var(--primary-blue) 7%,var(--card-bg));font-size:12px;line-height:1.5}.v130-guide strong{display:block;margin-bottom:4px}.v130-guide ol{margin:5px 0 0 18px;padding:0}
            .v130-toggle{display:flex;align-items:flex-start;gap:9px;margin-top:13px;padding:11px;border:1px solid var(--border-color);border-radius:11px;background:var(--surface-soft)}.v130-toggle input{width:18px;min-height:18px;height:18px;margin-top:1px}.v130-toggle strong{display:block;color:var(--text-dark);font-size:12px}.v130-toggle small{display:block;color:var(--text-light);font-size:10.5px;margin-top:2px}
            @media(max-width:700px){.v130-commandbar{align-items:stretch;flex-direction:column}.v130-shortcut{display:none}#v130-sync{align-self:flex-start}.v130-kpis{grid-template-columns:1fr 1fr}.v130-command-card{border-radius:14px}}
            @media(max-width:430px){.v130-kpis{grid-template-columns:1fr}}
            @media(prefers-reduced-motion:reduce){#v130-sync.saving::before{animation:none}}
        `;
        document.head.appendChild(style);
    }

    function asegurarCommandBar() {
        if(document.getElementById('v130-commandbar')) return;
        const main = document.getElementById('main-app');
        const tabs = main?.querySelector('.tabs') || document.querySelector('.tabs');
        if(!tabs) return;
        const bar = document.createElement('div');
        bar.id = 'v130-commandbar';
        bar.className = 'v130-commandbar';
        bar.innerHTML = `<button type="button" class="v130-command-trigger" onclick="abrirBuscadorAccionesV130()" aria-haspopup="dialog"><span>⌕</span><span><strong>¿Qué quieres hacer?</strong> <span style="font-size:11px">Busca una acción del sistema</span></span><span class="v130-shortcut">Ctrl K</span></button><span id="v130-sync" role="status" aria-live="polite">Sincronizado</span>`;
        tabs.parentNode.insertBefore(bar, tabs);
    }

    function asegurarModalAcciones() {
        if(document.getElementById('v130-command-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'v130-command-modal';
        modal.setAttribute('role','dialog');
        modal.setAttribute('aria-modal','true');
        modal.setAttribute('aria-label','Buscador de acciones');
        modal.innerHTML = `<div class="v130-command-card"><input id="v130-command-input" type="search" autocomplete="off" placeholder="Ej.: hacer una venta, devolver préstamo, buscar cliente…"><div id="v130-command-results" class="v130-command-results"></div><p style="margin:9px 3px 0;color:var(--text-light);font-size:10px">Esc para cerrar · Enter para abrir la primera opción</p></div>`;
        modal.addEventListener('mousedown', e => { if(e.target === modal) cerrarBuscadorAcciones(); });
        document.body.appendChild(modal);
        const input = document.getElementById('v130-command-input');
        input.addEventListener('input', renderResultadosAcciones);
        input.addEventListener('keydown', e => {
            if(e.key === 'Escape') cerrarBuscadorAcciones();
            if(e.key === 'Enter') {
                const primero = document.querySelector('.v130-command-item');
                if(primero) { e.preventDefault(); primero.click(); }
            }
        });
    }

    function opcionesAcciones() {
        const u = usuarioActual();
        return { rol:u?.rol === 'dueno' ? 'dueno' : 'empleado', puedeFinanzas:puedeFinanzas() };
    }

    function renderResultadosAcciones() {
        const salida = document.getElementById('v130-command-results');
        const input = document.getElementById('v130-command-input');
        if(!salida || !input) return;
        const resultados = core.buscarAcciones(input.value, opcionesAcciones());
        salida.innerHTML = resultados.length ? resultados.map((a,i) => `<button type="button" class="v130-command-item" data-accion="${escapar(a.id)}"><span><strong>${escapar(a.titulo)}</strong><small>${escapar(a.descripcion)}</small></span><span class="v130-command-key">${i===0?'↵':''}</span></button>`).join('') : `<div style="padding:18px;text-align:center;color:var(--text-light)">No encontré esa acción. Prueba con otra forma de escribirla.</div>`;
        salida.querySelectorAll('[data-accion]').forEach(b => b.addEventListener('click', () => ejecutarAccion(b.dataset.accion)));
    }

    function abrirBuscadorAcciones() {
        asegurarModalAcciones();
        const modal = document.getElementById('v130-command-modal');
        const input = document.getElementById('v130-command-input');
        if(!modal || !input) return;
        modal.classList.add('open');
        input.value = '';
        renderResultadosAcciones();
        setTimeout(() => input.focus(), 30);
    }

    function cerrarBuscadorAcciones() {
        document.getElementById('v130-command-modal')?.classList.remove('open');
    }

    function ejecutarAccion(id) {
        const accion = core.ACCIONES.find(a => a.id === id);
        if(!accion) return;
        cerrarBuscadorAcciones();
        if(typeof global.cambiarPestaña === 'function') global.cambiarPestaña(accion.pestana);
        if(accion.accionSecundaria === 'clientes' && typeof global.abrirSeccionConfiguracion === 'function') {
            setTimeout(() => global.abrirSeccionConfiguracion('clientes','directorio'), 80);
        }
        setTimeout(() => {
            let destino = accion.focusId ? document.getElementById(accion.focusId) : null;
            if(!destino && accion.focusText) {
                destino = Array.from(document.querySelectorAll('details')).find(d => (d.textContent || '').toLowerCase().includes(accion.focusText));
            }
            if(destino?.tagName === 'DETAILS') destino.open = true;
            destino?.scrollIntoView({ behavior:'smooth', block:'center' });
        }, 130);
    }

    function actualizarSync() {
        const el = document.getElementById('v130-sync');
        if(!el) return;
        el.className = '';
        if(!navigator.onLine) { el.classList.add('offline'); el.textContent = 'Sin conexión · modo consulta'; return; }
        let procesando = false;
        try { procesando = Boolean(isProcessingTransaction); } catch(_) {}
        if(procesando) { el.classList.add('saving'); el.textContent = 'Guardando…'; return; }
        el.textContent = 'Sincronizado';
    }

    function firmaSalud(c) {
        const s = core.resumenSalud(c);
        return JSON.stringify([s.productos,s.agotados,s.bajos,s.valorInventario,s.ventasHoy,s.utilidadHoy,s.porCobrar,s.vencidos,usuarioActual()?.id,puedeFinanzas()]);
    }

    function asegurarPanelSalud() {
        if(document.getElementById('v130-salud')) return;
        const sec = document.getElementById('sec-inicio');
        if(!sec) return;
        const details = document.createElement('details');
        details.id = 'v130-salud';
        details.className = 'fold-card v130-panel';
        details.open = true;
        details.innerHTML = `<summary>🧭 Estado del negocio y prioridades</summary><div class="fold-card-content" id="v130-salud-contenido"></div>`;
        sec.prepend(details);
    }

    function renderSalud() {
        asegurarPanelSalud();
        const salida = document.getElementById('v130-salud-contenido');
        if(!salida) return;
        const c = contexto();
        const firma = firmaSalud(c);
        if(firma === ultimaFirmaSalud && salida.childElementCount) return;
        ultimaFirmaSalud = firma;
        const salud = core.resumenSalud(c);
        const prioridades = core.prioridadesNegocio(c);
        const u = usuarioActual();
        const fin = puedeFinanzas();
        const kpisDueno = `<div class="v130-kpi"><small>Ventas de hoy</small><strong>${dinero(salud.ventasHoy)}</strong></div><div class="v130-kpi"><small>Utilidad de hoy</small><strong>${dinero(salud.utilidadHoy)}</strong></div><div class="v130-kpi"><small>Por cobrar</small><strong>${dinero(salud.porCobrar)}</strong></div>`;
        salida.innerHTML = `<p style="margin:0 0 10px;color:var(--text-light);font-size:11px">${u?.rol === 'dueno' ? 'Vista del Dueño: operación, dinero y pendientes importantes.' : 'Tu espacio muestra únicamente información útil para tus tareas permitidas.'}</p>
            <div class="v130-kpis">
                ${fin ? kpisDueno : ''}
                <div class="v130-kpi ${salud.agotados?'alert':''}"><small>Productos agotados</small><strong>${salud.agotados}</strong></div>
                <div class="v130-kpi"><small>Stock bajo</small><strong>${salud.bajos}</strong></div>
                <div class="v130-kpi"><small>Productos activos</small><strong>${salud.productos}</strong></div>
            </div>
            <h5 style="margin:13px 0 4px">Prioridades</h5>${prioridades.slice(0,6).map(p => `<div class="v130-prioridad ${escapar(p.nivel)}"><strong>${escapar(p.titulo)}</strong><span>${escapar(p.detalle)}</span></div>`).join('')}`;
    }

    function asegurarAgendaCobros() {
        const sec = document.getElementById('sec-inicio');
        if(!sec || document.getElementById('v130-agenda-cobros')) return;
        const details = document.createElement('details');
        details.id = 'v130-agenda-cobros';
        details.className = 'fold-card v130-panel';
        details.innerHTML = `<summary>📅 Agenda de cobros</summary><div class="fold-card-content" id="v130-agenda-contenido"></div>`;
        const salud = document.getElementById('v130-salud');
        if(salud) salud.insertAdjacentElement('afterend', details); else sec.prepend(details);
    }

    function renderAgendaCobros() {
        asegurarAgendaCobros();
        const details = document.getElementById('v130-agenda-cobros');
        const salida = document.getElementById('v130-agenda-contenido');
        if(!details || !salida) return;
        const visible = puedeFinanzas();
        details.style.display = visible ? '' : 'none';
        if(!visible) return;
        const c = contexto();
        const filas = core.agendaCobros(c.ventas, c.prestamos, Date.now());
        if(!filas.length) { salida.innerHTML = '<p style="color:var(--text-light);font-size:12px">No hay cuentas pendientes detectadas.</p>'; return; }
        salida.innerHTML = `<p style="margin-top:0;color:var(--text-light);font-size:11px">Créditos y préstamos se muestran juntos para seguimiento, pero conservan su contabilidad separada.</p>${filas.slice(0,50).map(f => {
            const etiqueta = f.dias === null ? 'Sin fecha' : (f.dias < 0 ? `Vencido hace ${Math.abs(f.dias)} día(s)` : (f.dias === 0 ? 'Vence hoy' : `Vence en ${f.dias} día(s)`));
            const clase = f.dias !== null && f.dias < 0 ? 'vencido' : (f.dias === 0 ? 'hoy' : '');
            return `<div class="v130-cobro"><span><strong>${escapar(f.persona)}</strong><br><small>${escapar(f.concepto)} · ${f.tipo === 'credito' ? 'Crédito' : 'Préstamo'}</small></span><span style="text-align:right"><strong>${dinero(f.saldo)}</strong><br><small class="${clase}">${escapar(etiqueta)}</small></span></div>`;
        }).join('')}`;
    }

    function capturarCampos(seccionId) {
        const sec = document.getElementById(seccionId);
        if(!sec) return {};
        const campos = {};
        sec.querySelectorAll('input[id],select[id],textarea[id]').forEach(el => {
            if(el.type === 'file' || el.type === 'password') return;
            if(el.type === 'checkbox' || el.type === 'radio') campos[el.id] = Boolean(el.checked);
            else campos[el.id] = el.value;
        });
        return campos;
    }

    function restaurarCampos(campos) {
        Object.entries(campos || {}).forEach(([id,valor]) => {
            const el = document.getElementById(id);
            if(!el || el.type === 'file' || el.type === 'password') return;
            if(el.type === 'checkbox' || el.type === 'radio') el.checked = Boolean(valor);
            else el.value = valor ?? '';
            try { el.dispatchEvent(new Event('change', { bubbles:true })); } catch(_) {}
        });
    }

    function guardarBorrador(tipo, items, seccionId) {
        if(!Array.isArray(items) || !items.length) return;
        const payload = { version:1, tipo, timestamp:Date.now(), items:JSON.parse(JSON.stringify(items)), campos:capturarCampos(seccionId) };
        try { localStorage.setItem(DRAFT_PREFIX + tipo, JSON.stringify(payload)); } catch(_) {}
    }

    function capturarBorradores() {
        try { guardarBorrador('ventas', carritoVentas, 'sec-ventas'); } catch(_) {}
        try { guardarBorrador('cotizacion', carritoCotizacion, 'sec-cotizacion'); } catch(_) {}
        try { guardarBorrador('ingreso', carritoIngresos, 'sec-ingreso'); } catch(_) {}
    }

    function leerBorrador(tipo) {
        try {
            const b = JSON.parse(localStorage.getItem(DRAFT_PREFIX + tipo) || 'null');
            return core.borradorValido(b) && Array.isArray(b.items) && b.items.length ? b : null;
        } catch(_) { return null; }
    }

    function borrarBorrador(tipo) {
        try { localStorage.removeItem(DRAFT_PREFIX + tipo); } catch(_) {}
        document.getElementById(`v130-draft-${tipo}`)?.remove();
    }

    function restaurarBorrador(tipo) {
        const b = leerBorrador(tipo);
        if(!b) return borrarBorrador(tipo);
        try {
            if(tipo === 'ventas') { carritoVentas = b.items; restaurarCampos(b.campos); global.renderCarritoVentas?.(); global.cambiarPestaña?.('ventas'); }
            else if(tipo === 'cotizacion') { carritoCotizacion = b.items; restaurarCampos(b.campos); global.renderCarritoCotizacion?.(); global.cambiarPestaña?.('cotizacion'); }
            else if(tipo === 'ingreso') { carritoIngresos = b.items; restaurarCampos(b.campos); global.renderCarritoIngresos?.(); global.cambiarPestaña?.('ingreso'); }
            borrarBorrador(tipo);
        } catch(error) { console.warn('No se pudo restaurar borrador.', error); }
    }

    function asegurarAvisosBorrador() {
        const sec = document.getElementById('sec-inicio');
        if(!sec) return;
        const tipos = [['ventas','venta'],['cotizacion','cotización'],['ingreso','ingreso']];
        tipos.forEach(([tipo,nombre]) => {
            const b = leerBorrador(tipo);
            const id = `v130-draft-${tipo}`;
            if(!b) { document.getElementById(id)?.remove(); return; }
            let carritoActual = 0;
            try { carritoActual = tipo === 'ventas' ? carritoVentas.length : (tipo === 'cotizacion' ? carritoCotizacion.length : carritoIngresos.length); } catch(_) {}
            if(carritoActual) return;
            if(document.getElementById(id)) return;
            const div = document.createElement('div');
            div.id = id; div.className = 'v130-draft-banner';
            const fecha = new Date(b.timestamp).toLocaleString('es-GT');
            div.innerHTML = `<strong>📝 ${b.items.length} línea(s) de ${nombre} sin terminar</strong><br><span style="color:var(--text-light)">Guardado automáticamente ${escapar(fecha)}.</span><div class="v130-draft-actions"><button class="v130-mini-btn" onclick="restaurarBorradorV130('${tipo}')">Continuar</button><button class="v130-mini-btn" onclick="borrarBorradorV130('${tipo}')">Descartar</button></div>`;
            const after = document.getElementById('v130-agenda-cobros') || document.getElementById('v130-salud');
            if(after) after.insertAdjacentElement('afterend', div); else sec.prepend(div);
        });
    }

    function instalarLimpiezaBorradores() {
        [['procesarVentaMultiple','ventas'],['procesarCotizacion','cotizacion'],['procesarIngresoMultiple','ingreso']].forEach(([nombre,tipo]) => {
            const original = global[nombre];
            if(typeof original !== 'function' || original.__v130draft) return;
            const envuelta = async function(...args) {
                const r = await original.apply(this,args);
                let vacio = false;
                try { vacio = tipo === 'ventas' ? carritoVentas.length===0 : (tipo === 'cotizacion' ? carritoCotizacion.length===0 : carritoIngresos.length===0); } catch(_) {}
                if(vacio) borrarBorrador(tipo); else capturarBorradores();
                return r;
            };
            envuelta.__v130draft = true;
            global[nombre] = envuelta;
        });
    }

    function asegurarHistorialCostos() {
        const sec = document.getElementById('sec-inventario');
        if(!sec || document.getElementById('v130-historial-costos')) return;
        const details = document.createElement('details');
        details.id = 'v130-historial-costos'; details.className = 'fold-card';
        details.innerHTML = `<summary>📉 Historial de costos por producto</summary><div class="fold-card-content"><div class="form-group"><label>Producto</label><select id="v130-costo-producto"><option value="">Selecciona un producto</option></select></div><div id="v130-costo-contenido"><p style="color:var(--text-light);font-size:11px">Compara los costos registrados en ingresos anteriores.</p></div></div>`;
        sec.appendChild(details);
        document.getElementById('v130-costo-producto').addEventListener('change', renderHistorialCostos);
    }

    function actualizarSelectorCostos() {
        const select = document.getElementById('v130-costo-producto');
        if(!select) return;
        const valor = select.value;
        const productos = contexto().inventario.filter(p => p && !p.isService).sort((a,b) => String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
        const firma = productos.map(p=>`${p.id}:${p.nombre}`).join('|');
        if(select.dataset.firma === firma) return;
        select.dataset.firma = firma;
        select.innerHTML = '<option value="">Selecciona un producto</option>' + productos.map(p => `<option value="${escapar(String(p.id))}">${escapar(p.codigoInventario ? `${p.codigoInventario} · ${p.nombre}` : p.nombre)}</option>`).join('');
        if(productos.some(p => String(p.id)===valor)) select.value = valor;
    }

    function renderHistorialCostos() {
        const select = document.getElementById('v130-costo-producto');
        const salida = document.getElementById('v130-costo-contenido');
        if(!select || !salida) return;
        const filas = core.historialCostos(contexto().ingresos, select.value);
        if(!select.value) return;
        if(!filas.length) { salida.innerHTML = '<p style="color:var(--text-light);font-size:11px">Todavía no hay historial de costos cargado para este producto.</p>'; return; }
        const actual = filas[0], anterior = filas[1];
        const variacion = anterior && anterior.costo ? ((actual.costo - anterior.costo) / anterior.costo * 100) : null;
        salida.innerHTML = `${variacion === null ? '' : `<p style="font-size:12px"><strong>Cambio desde la compra anterior:</strong> <span style="color:${variacion>0?'var(--primary-red)':variacion<0?'var(--primary-green)':'var(--text-light)'}">${variacion>0?'+':''}${variacion.toFixed(1)}%</span></p>`}<table class="v130-history-table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Costo</th></tr></thead><tbody>${filas.slice(0,20).map(f => `<tr><td>${escapar(f.timestamp ? new Date(f.timestamp).toLocaleDateString('es-GT') : '—')}</td><td>${escapar(f.proveedor)}</td><td>${dinero(f.costo)}</td></tr>`).join('')}</tbody></table>`;
    }

    function asegurarCRM() {
        const sec = document.getElementById('sec-clientes');
        if(!sec || document.getElementById('v130-crm')) return;
        const details = document.createElement('details');
        details.id='v130-crm'; details.className='fold-card';
        details.innerHTML=`<summary>👥 Resumen del cliente</summary><div class="fold-card-content"><div class="form-group"><label>Cliente</label><select id="v130-crm-cliente"><option value="">Selecciona un cliente</option></select></div><div id="v130-crm-contenido"></div></div>`;
        sec.appendChild(details);
        document.getElementById('v130-crm-cliente').addEventListener('change', renderCRM);
    }

    function actualizarSelectorCRM() {
        const select=document.getElementById('v130-crm-cliente'); if(!select) return;
        const cs=contexto().clientes.filter(c=>c&&!c.archivado).sort((a,b)=>String(a.nombreCompleto||'').localeCompare(String(b.nombreCompleto||''),'es'));
        const firma=cs.map(c=>`${c.id}:${c.nombreCompleto}`).join('|'); if(select.dataset.firma===firma) return; select.dataset.firma=firma;
        const valor=select.value; select.innerHTML='<option value="">Selecciona un cliente</option>'+cs.map(c=>`<option value="${escapar(String(c.id))}">${escapar(c.nombreCompleto||c.nombres||'Cliente')}</option>`).join(''); if(cs.some(c=>String(c.id)===valor)) select.value=valor;
    }

    function renderCRM() {
        const select=document.getElementById('v130-crm-cliente'), salida=document.getElementById('v130-crm-contenido'); if(!select||!salida) return;
        const c=contexto(); const cliente=c.clientes.find(x=>String(x.id)===String(select.value)); if(!cliente){salida.innerHTML='';return;}
        const r=core.resumenCliente(cliente,c.ventas,c.anticipos);
        salida.innerHTML=`<div class="v130-kpis"><div class="v130-kpi"><small>Compras registradas</small><strong>${r.compras}</strong></div>${puedeFinanzas()?`<div class="v130-kpi"><small>Total comprado</small><strong>${dinero(r.totalComprado)}</strong></div><div class="v130-kpi"><small>Saldo a crédito</small><strong>${dinero(r.saldoCredito)}</strong></div><div class="v130-kpi"><small>Anticipos disponibles</small><strong>${dinero(r.anticipos)}</strong></div>`:''}<div class="v130-kpi"><small>Última compra</small><strong style="font-size:13px">${r.ultimaCompra?escapar(new Date(r.ultimaCompra).toLocaleDateString('es-GT')):'Sin compras'}</strong></div></div>${cliente.notas?`<p style="font-size:11px;color:var(--text-light);margin-top:9px"><strong>Notas:</strong> ${escapar(cliente.notas)}</p>`:''}`;
    }

    const GUIAS = {
        inicio:['Revisa las prioridades del día.','Si hay cobros o agotados, abre el panel correspondiente.','Usa “¿Qué quieres hacer?” si no recuerdas dónde está una función.'],
        ingreso:['Elige producto existente o nuevo.','Escribe la cantidad real que entra y su costo.','Agrega a la lista y confirma el ingreso cuando todo esté correcto.'],
        inventario:['Busca por nombre o código.','Revisa stock, mínimo y costo según tus permisos.','Usa historial de costos o etiquetas solo cuando lo necesites.'],
        ventas:['Identifica al cliente.','Agrega productos y gastos del trabajo.','Revisa cobro, factura y total antes de confirmar.'],
        cotizacion:['Identifica al cliente.','Agrega productos y gastos sin tocar inventario.','Guarda la cotización y conviértela en venta cuando corresponda.'],
        alertas:['Primero revisa agotados y stock bajo.','Agrupa por proveedor para comprar más rápido.','Genera una orden de compra si quieres enviar el pedido al distribuidor.'],
        caja:['Comprueba efectivo y banco antes de retirar o prestar.','Registra el motivo de cada movimiento.','Usa el cierre diario para comparar sistema contra conteo real.'],
        ajustes:['Abre únicamente la sección que quieras cambiar.','Los temas solo cambian apariencia.','Haz un respaldo antes de cambios importantes.'],
        buscador:['Escribe palabras que recuerdes del archivo.','Combina cliente, producto o tipo de diseño.','El buscador solo localiza; no modifica tus archivos.']
    };

    function modoCapacitacion() { try { return localStorage.getItem(TRAINING_KEY)==='1'; } catch(_) { return false; } }
    function guardarModoCapacitacion(valor) { try { localStorage.setItem(TRAINING_KEY, valor?'1':'0'); } catch(_) {} renderGuiaActual(); }

    function asegurarToggleCapacitacion() {
        if(document.getElementById('v130-training-toggle')) return;
        const contenido=document.querySelector('#ajuste-interfaz .settings-section-content'); if(!contenido) return;
        const label=document.createElement('label'); label.id='v130-training-toggle'; label.className='v130-toggle';
        label.innerHTML=`<input type="checkbox" id="v130-training-check"><span><strong>🎓 Modo de capacitación</strong><small>Muestra pasos cortos en cada pantalla para usuarios nuevos. Se guarda solo en este dispositivo.</small></span>`;
        contenido.appendChild(label);
        const check=document.getElementById('v130-training-check'); check.checked=modoCapacitacion(); check.addEventListener('change',()=>guardarModoCapacitacion(check.checked));
    }

    function pestañaVisible() {
        for(const [p,id] of Object.entries({inicio:'sec-inicio',ingreso:'sec-ingreso',inventario:'sec-inventario',ventas:'sec-ventas',cotizacion:'sec-cotizacion',alertas:'sec-alertas',ajustes:'sec-ajustes',buscador:'sec-buscador'})) {
            const el=document.getElementById(id); if(el && getComputedStyle(el).display!=='none') return p;
        }
        return 'inicio';
    }

    function renderGuiaActual() {
        document.querySelectorAll('.v130-guide').forEach(x=>x.remove());
        if(!modoCapacitacion()) return;
        const p=pestañaVisible(), pasos=GUIAS[p]; if(!pasos) return;
        const sec=document.getElementById({inicio:'sec-inicio',ingreso:'sec-ingreso',inventario:'sec-inventario',ventas:'sec-ventas',cotizacion:'sec-cotizacion',alertas:'sec-alertas',ajustes:'sec-ajustes',buscador:'sec-buscador'}[p]); if(!sec) return;
        const div=document.createElement('div'); div.className='v130-guide'; div.innerHTML=`<strong>🎓 Guía rápida</strong><ol>${pasos.map(x=>`<li>${escapar(x)}</li>`).join('')}</ol>`; sec.prepend(div);
    }

    function instalarGuiaPestañas() {
        const original=global.cambiarPestaña; if(typeof original!=='function'||original.__v130guide) return;
        const envuelta=function(...args){const r=original.apply(this,args);setTimeout(()=>{renderGuiaActual();renderSalud();renderAgendaCobros();actualizarSelectorCostos();actualizarSelectorCRM();},50);return r;}; envuelta.__v130guide=true; global.cambiarPestaña=envuelta;
    }

    function refrescar() {
        actualizarSync();
        renderSalud();
        renderAgendaCobros();
        asegurarAvisosBorrador();
        asegurarHistorialCostos(); actualizarSelectorCostos();
        asegurarCRM(); actualizarSelectorCRM();
        asegurarToggleCapacitacion();
    }

    function iniciar() {
        inyectarEstilos(); asegurarCommandBar(); asegurarModalAcciones(); asegurarPanelSalud(); asegurarAgendaCobros(); asegurarHistorialCostos(); asegurarCRM(); asegurarToggleCapacitacion(); instalarLimpiezaBorradores(); instalarGuiaPestañas();
        global.addEventListener('online', actualizarSync); global.addEventListener('offline', actualizarSync); global.addEventListener('beforeunload', capturarBorradores);
        document.addEventListener('keydown', e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();abrirBuscadorAcciones();}else if(e.key==='Escape')cerrarBuscadorAcciones();});
        setInterval(capturarBorradores, 4000); setInterval(refrescar, 2500); refrescar(); renderGuiaActual();
    }

    global.abrirBuscadorAccionesV130=abrirBuscadorAcciones;
    global.restaurarBorradorV130=restaurarBorrador;
    global.borrarBorradorV130=borrarBorrador;

    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(iniciar,180)); else setTimeout(iniciar,180);
})(window);
