/* Preferencias de presentación locales. Nunca cambian datos ni permisos del negocio. */
(function(global) {
    'use strict';
    const registros = new Map();
    const nombres = {inicio:'Resumen',ingreso:'Ingreso',inventario:'Inventario',ventas:'Ventas',cotizacion:'Cotización',alertas:'Por surtir',buscador:'Diseños',caja:'Caja',ajustes:'Opciones'};
    let claveActual = '', preferencias = {}, firma = '';
    const usuario = () => typeof currentUserData !== 'undefined' ? currentUserData : null;
    const clave = () => 'subli_pantallas_v1_' + String(usuario()?.id || usuario()?.rol || 'local');
    const escapar = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function cargar() {
        const k = clave();
        if(k === claveActual) return;
        claveActual = k;
        try { const datos = JSON.parse(localStorage.getItem(k) || '{}'); preferencias = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {}; }
        catch(_) { preferencias = {}; }
        firma = '';
    }
    function registrar(nodo, id, grupo, etiqueta, fijo = false) {
        if(!nodo || registros.has(id)) return;
        registros.set(id, {nodo,id,grupo,etiqueta,fijo,original:registros.size});
    }
    function descubrir() {
        Object.entries(nombres).forEach(([sec,nombre]) => {
            registrar(document.getElementById('tab-'+sec), 'nav-'+sec, 'Menú principal', nombre, ['inicio','ajustes'].includes(sec));
            document.querySelectorAll(`#sec-${sec} > details, #sec-${sec} > .management-grid > details, #sec-${sec} [data-pantalla-panel]`).forEach(n => {
                if(!n.id && n.querySelector('#panel-inteligente')) n.id = 'panel-centro-inteligente';
                if(n.id === 'ajuste-pantallas' || !n.id) return;
                registrar(n, n.id, nombre, n.querySelector(':scope > summary')?.textContent.trim() || nombre);
            });
        });
        document.querySelectorAll('#sec-inicio .dash-card').forEach(n => {
            const id = n.querySelector('[id]')?.id;
            if(id) registrar(n, 'indicador-'+id, 'Indicadores de finanzas', n.querySelector('.dash-title')?.textContent.trim() || id);
        });
    }
    const orden = r => Number.isFinite(preferencias[r.id]?.orden) ? preferencias[r.id].orden : r.original;
    function aplicar() {
        cargar(); descubrir();
        const grupos = new Map();
        registros.forEach(r => {
            r.nodo.classList.toggle('subli-panel-oculto', !r.fijo && preferencias[r.id]?.oculto === true);
            const padre = r.nodo.parentNode;
            if(!padre) return;
            if(!grupos.has(padre)) grupos.set(padre, []);
            grupos.get(padre).push(r);
        });
        grupos.forEach(items => {
            const padre = items[0].nodo.parentNode;
            const actual = Array.from(padre.children).filter(n => items.some(r => r.nodo === n));
            const deseado = [...items].sort((a,b) => orden(a)-orden(b) || a.original-b.original).map(r => r.nodo);
            if(actual.every((n,i) => n === deseado[i])) return;
            // Los controles no configurables conservan exactamente su posición.
            const marcadores = actual.map(n => { const m = document.createComment('panel'); padre.replaceChild(m,n); return m; });
            marcadores.forEach((m,i) => padre.replaceChild(deseado[i],m));
        });
    }
    function guardar() {
        try { localStorage.setItem(claveActual, JSON.stringify(preferencias)); }
        catch(_) { alert('No se pudo guardar la distribución en este dispositivo. Revisa el espacio disponible.'); }
        aplicar(); renderOpciones();
    }
    function renderOpciones() {
        const cont = document.getElementById('pantallas-lista');
        if(!cont) return;
        const abiertos = new Set(Array.from(cont.querySelectorAll('details[open] > summary')).map(n => n.textContent));
        const grupos = new Map();
        registros.forEach(r => { if(!grupos.has(r.grupo)) grupos.set(r.grupo,[]); grupos.get(r.grupo).push(r); });
        cont.innerHTML = Array.from(grupos, ([nombre,items]) => `<details class="pantallas-grupo" ${abiertos.has(nombre) ? 'open' : ''}><summary>${escapar(nombre)}</summary><div>${items.sort((a,b) => orden(a)-orden(b) || a.original-b.original).map(r => {
            const vecinos = items.filter(i => i.nodo.parentNode === r.nodo.parentNode);
            const pos = vecinos.indexOf(r);
            return `<div class="pantallas-fila"><label><input type="checkbox" data-ver="${escapar(r.id)}" ${r.fijo || preferencias[r.id]?.oculto !== true ? 'checked' : ''} ${r.fijo ? 'disabled' : ''}>${escapar(r.etiqueta)}${r.fijo ? ' (siempre accesible)' : ''}</label><span><button type="button" data-mover="${escapar(r.id)}" data-paso="-1" ${pos === 0 ? 'disabled' : ''} aria-label="Subir ${escapar(r.etiqueta)}">↑</button><button type="button" data-mover="${escapar(r.id)}" data-paso="1" ${pos === vecinos.length-1 ? 'disabled' : ''} aria-label="Bajar ${escapar(r.etiqueta)}">↓</button></span></div>`;
        }).join('')}</div></details>`).join('');
    }
    function instalarOpciones() {
        const sec = document.getElementById('sec-ajustes');
        if(!sec || document.getElementById('ajuste-pantallas')) return;
        const d = document.createElement('details');
        d.id = 'ajuste-pantallas'; d.className = 'settings-section';
        d.innerHTML = '<summary>🧩 Pantallas: qué ver y en qué orden</summary><div class="fold-card-content"><p>Marca los apartados que quieres ver. Usa ↑ y ↓ para ordenarlos dentro de su grupo. Al iniciar, los apartados están plegados; toca su título para abrirlos. Estos ajustes se guardan para tu usuario en este dispositivo.</p><p>Ocultar un apartado conserva sus datos. Los permisos de cada usuario siguen vigentes.</p><div id="pantallas-lista"></div><button type="button" id="pantallas-restablecer">Mostrar todo y restaurar orden</button></div>';
        sec.prepend(d);
        d.addEventListener('toggle', () => { if(d.open) { aplicar(); renderOpciones(); } });
        d.addEventListener('change', e => {
            const id = e.target.dataset.ver;
            if(!registros.has(id) || registros.get(id).fijo) return;
            preferencias[id] = {...preferencias[id], oculto:!e.target.checked}; guardar();
        });
        d.addEventListener('click', e => {
            const btn = e.target.closest('button[data-mover]');
            if(!btn) return;
            const r = registros.get(btn.dataset.mover);
            if(!r) return;
            const vecinos = [...registros.values()].filter(i => i.nodo.parentNode === r.nodo.parentNode).sort((a,b) => orden(a)-orden(b) || a.original-b.original);
            const i = vecinos.indexOf(r), j = i+Number(btn.dataset.paso);
            if(j<0 || j>=vecinos.length) return;
            [vecinos[i],vecinos[j]] = [vecinos[j],vecinos[i]];
            vecinos.forEach((v,k) => { preferencias[v.id] = {...preferencias[v.id],orden:k}; }); guardar();
        });
        document.getElementById('pantallas-restablecer').onclick = () => {
            if(!confirm('¿Mostrar todos los apartados y restaurar su orden en este dispositivo? Tus datos no cambian.')) return;
            preferencias = {}; guardar();
        };
        global.prepararSeccionesConfiguracion?.();
    }
    global.subliAbrirPanel = function(id) {
        let nodo = typeof id === 'string' ? document.getElementById(id) : id;
        while(nodo && nodo !== document.body) {
            nodo.classList?.remove('subli-panel-oculto');
            if(nodo.tagName === 'DETAILS') nodo.open = true;
            nodo = nodo.parentElement;
        }
    };
    const estilo = document.createElement('style');
    estilo.textContent = '.subli-panel-oculto{display:none!important}.pantallas-grupo{margin:10px 0;border:1px solid var(--border-color);border-radius:10px;padding:10px}.pantallas-grupo>summary{cursor:pointer;font-weight:700}.pantallas-fila{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border-color)}.pantallas-fila label{display:flex;gap:8px;align-items:center;flex:1;min-width:0;font-size:13px}.pantallas-fila input{width:auto;flex:none}.pantallas-fila span{display:flex;gap:4px}.pantallas-fila button{min-width:36px;min-height:36px}.subli-panel>summary{cursor:pointer}.subli-panel .card{margin-bottom:0}';
    document.head.appendChild(estilo);
    instalarOpciones(); aplicar(); renderOpciones();
    const original = global.cambiarPestaña;
    if(typeof original === 'function') global.cambiarPestaña = function(...args) {
        const resultado = original.apply(this,args);
        // Solo trabajo de presentación al navegar, sin temporizadores ni consultas.
        const nuevaFirma = clave() + ':' + registros.size;
        descubrir();
        if(firma !== nuevaFirma) { aplicar(); firma = clave()+':'+registros.size; }
        const tab = document.querySelector('.tab-btn.active');
        tab?.classList.remove('subli-panel-oculto');
        return resultado;
    };
    document.addEventListener('click', e => {
        const boton = e.target.closest('button');
        if(!boton) return;
        const accion = boton.getAttribute('onclick') || '';
        const destino = /agregarAlCarritoVenta/.test(accion) ? 'lista-carrito-ventas' : /agregarAlCarritoCotizacion/.test(accion) ? 'lista-carrito-cotizacion' : /agregarAlCarritoIngreso/.test(accion) ? 'lista-ingresos-pendientes' : null;
        if(destino) global.subliAbrirPanel(destino);
    });
})(window);
