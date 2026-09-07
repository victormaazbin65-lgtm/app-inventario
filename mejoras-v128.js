(function (global) {
    'use strict';

    const TEMA_KEY = 'subli_tema_visual_v1';
    const TEMAS = Object.freeze([
        { id:'sistema', nombre:'Automático', descripcion:'Sigue el modo claro u oscuro del dispositivo.', icono:'◐', colores:['#f8fafc','#0f172a','#2563eb'] },
        { id:'noche', nombre:'Azul Noche', descripcion:'Profesional, sobrio y cómodo para jornadas largas.', icono:'🌙', colores:['#050914','#0d1b30','#38bdf8'] },
        { id:'claro', nombre:'Claro', descripcion:'Luminoso y limpio para oficinas o espacios con mucha luz.', icono:'☀️', colores:['#f3f6fb','#ffffff','#2563eb'] },
        { id:'grafito', nombre:'Grafito', descripcion:'Oscuro neutral, con menos azul y contraste moderado.', icono:'◆', colores:['#0d0f13','#20242c','#8ab4f8'] },
        { id:'contraste', nombre:'Alto contraste', descripcion:'Bordes y texto más fuertes para máxima legibilidad.', icono:'◑', colores:['#000000','#111111','#ffd24a'] }
    ]);

    const IDS_TEMA = new Set(TEMAS.map(t => t.id));

    function escapar(valor) {
        if(typeof global.escaparHTML === 'function') return global.escaparHTML(valor);
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    function temaActual() {
        const actual = document.documentElement.dataset.temaVisual;
        if(IDS_TEMA.has(actual)) return actual;
        try {
            const guardado = String(localStorage.getItem(TEMA_KEY) || 'noche');
            return IDS_TEMA.has(guardado) ? guardado : 'noche';
        } catch (_) {
            return 'noche';
        }
    }

    function colorBarra(tema) {
        if(tema === 'claro') return '#f3f6fb';
        if(tema === 'grafito') return '#0d0f13';
        if(tema === 'contraste') return '#000000';
        if(tema === 'sistema') {
            try { return matchMedia('(prefers-color-scheme: dark)').matches ? '#050914' : '#f3f6fb'; }
            catch (_) { return '#050914'; }
        }
        return '#050914';
    }

    function actualizarMetaTema(tema) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if(meta) meta.setAttribute('content', colorBarra(tema));
    }

    function aplicarTema(temaEntrada, guardar = true) {
        const tema = IDS_TEMA.has(temaEntrada) ? temaEntrada : 'noche';
        document.documentElement.dataset.temaVisual = tema;
        if(guardar) {
            try { localStorage.setItem(TEMA_KEY, tema); } catch (_) {}
        }
        actualizarMetaTema(tema);
        document.querySelectorAll('input[name="tema-visual-v128"]').forEach(input => {
            input.checked = input.value === tema;
        });
        try {
            if(typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                global.dispatchEvent(new CustomEvent('subli:tema-cambiado', { detail:{ tema } }));
            }
        } catch (_) {}
        return tema;
    }

    function inyectarEstilos() {
        if(document.getElementById('v128-estilos')) return;
        const style = document.createElement('style');
        style.id = 'v128-estilos';
        style.textContent = `
            html[data-modelo-visual][data-tema-visual] body{background:var(--app-background)!important;color:var(--text-dark);transition:background-color .18s ease,color .18s ease}
            html[data-modelo-visual][data-tema-visual] .card,
            html[data-modelo-visual][data-tema-visual] .fold-card,
            html[data-modelo-visual][data-tema-visual] .settings-section,
            html[data-modelo-visual][data-tema-visual] .modal-card{background:var(--card-bg)!important;border-color:var(--border-color)!important;color:var(--text-dark)}
            html[data-modelo-visual][data-tema-visual] .tabs{background:var(--nav-bg)!important;border-color:var(--border-color)!important}
            html[data-modelo-visual][data-tema-visual] input,
            html[data-modelo-visual][data-tema-visual] select,
            html[data-modelo-visual][data-tema-visual] textarea,
            html[data-modelo-visual][data-tema-visual] .autocomplete-input,
            html[data-modelo-visual][data-tema-visual] .cart-container,
            html[data-modelo-visual][data-tema-visual] .financial-breakdown,
            html[data-modelo-visual][data-tema-visual] .management-card,
            html[data-modelo-visual][data-tema-visual] .smart-card,
            html[data-modelo-visual][data-tema-visual] .v127-answer,
            html[data-modelo-visual][data-tema-visual] .v127-loan-state{background:var(--input-bg)!important;color:var(--text-dark);border-color:var(--border-color)!important}
            html[data-modelo-visual][data-tema-visual] input::placeholder,
            html[data-modelo-visual][data-tema-visual] textarea::placeholder{color:var(--text-light)}
            html[data-modelo-visual][data-tema-visual] input:focus,
            html[data-modelo-visual][data-tema-visual] select:focus,
            html[data-modelo-visual][data-tema-visual] textarea:focus,
            html[data-modelo-visual][data-tema-visual] button:focus-visible,
            html[data-modelo-visual][data-tema-visual] summary:focus-visible{outline:none;box-shadow:var(--focus-ring)!important}
            html[data-modelo-visual="profesional"][data-tema-visual] body{padding:clamp(10px,2vw,24px)}
            html[data-modelo-visual="profesional"][data-tema-visual] .container{max-width:1280px}
            html[data-modelo-visual="profesional"][data-tema-visual] .card{border-radius:18px;box-shadow:var(--shadow)}
            html[data-modelo-visual="profesional"][data-tema-visual] .settings-section,
            html[data-modelo-visual="profesional"][data-tema-visual] .fold-card{border-radius:16px;overflow:clip}
            html[data-modelo-visual="profesional"][data-tema-visual] .tab-btn{min-height:44px;border-radius:11px;font-weight:650;transition:transform .16s ease,background-color .16s ease,border-color .16s ease}
            html[data-modelo-visual="profesional"][data-tema-visual] .tab-btn:hover{transform:translateY(-1px)}
            html[data-modelo-visual="profesional"][data-tema-visual] input,
            html[data-modelo-visual="profesional"][data-tema-visual] select,
            html[data-modelo-visual="profesional"][data-tema-visual] textarea,
            html[data-modelo-visual="profesional"][data-tema-visual] .autocomplete-input{min-height:44px;border-radius:11px}
            html[data-modelo-visual="profesional"][data-tema-visual] button.btn-main{min-height:46px;border-radius:11px;box-shadow:0 12px 28px -20px var(--primary-blue)}
            html[data-modelo-visual="profesional"][data-tema-visual] .section-title{font-size:clamp(18px,2vw,22px);letter-spacing:-.015em}
            html[data-modelo-visual="profesional"][data-tema-visual] .item-row{gap:14px}
            html[data-modelo-visual="profesional"][data-tema-visual] .dash-value,
            html[data-modelo-visual="profesional"][data-tema-visual] .financial-row span:last-child,
            html[data-modelo-visual="profesional"][data-tema-visual] input[type="number"]{font-variant-numeric:tabular-nums}
            @media(min-width:900px){html[data-modelo-visual="profesional"][data-tema-visual] body:not(.layout-lateral) .tabs{position:sticky;top:8px;z-index:80;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}}
            @media(max-width:680px){html[data-modelo-visual="profesional"][data-tema-visual] body{padding:10px}html[data-modelo-visual="profesional"][data-tema-visual] .card{padding:16px;border-radius:15px}html[data-modelo-visual="profesional"][data-tema-visual] .tab-btn{min-width:calc(50% - 6px);font-size:13px}html[data-modelo-visual="profesional"][data-tema-visual] .item-row{gap:9px}}
            .v128-theme-section{margin-top:22px;padding-top:18px;border-top:1px solid var(--border-color)}
            .v128-theme-section h4{margin:0 0 5px;color:var(--text-dark);font-size:15px}
            .v128-theme-section>p{margin:0 0 12px;color:var(--text-light);font-size:12px;line-height:1.5}
            .v128-theme-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
            .v128-theme-card{position:relative;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;padding:12px;border:1px solid var(--border-color);border-radius:13px;background:var(--surface-soft);cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
            .v128-theme-card:hover{transform:translateY(-1px);border-color:var(--primary-blue)}
            .v128-theme-card:has(input:checked){border-color:var(--primary-blue);box-shadow:var(--focus-ring)}
            .v128-theme-card input{position:absolute;opacity:0;pointer-events:none}
            .v128-theme-preview{display:flex;width:58px;height:42px;border-radius:10px;overflow:hidden;border:1px solid var(--border-color)}
            .v128-theme-preview span{flex:1}
            .v128-theme-copy strong{display:block;color:var(--text-dark);font-size:13px}
            .v128-theme-copy small{display:block;margin-top:3px;color:var(--text-light);font-size:10.5px;line-height:1.35}
            .v128-theme-icon{margin-right:4px}
            #v128-ayuda-global{position:fixed;left:18px;bottom:18px;z-index:900;display:flex;align-items:center;gap:7px;min-height:42px;padding:9px 13px;border:1px solid var(--border-color);border-radius:999px;background:var(--card-bg);color:var(--text-dark);box-shadow:var(--shadow);font-weight:700;cursor:pointer;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
            #v128-ayuda-global:hover{border-color:var(--primary-blue);transform:translateY(-1px)}
            .v128-diagnostico{margin-top:12px}
            .v128-diagnostico-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
            .v128-check{padding:9px;border:1px solid var(--border-color);border-radius:10px;background:var(--surface-soft);font-size:11px}
            .v128-check.ok{border-left:3px solid var(--primary-green)}
            .v128-check.warn{border-left:3px solid var(--primary-orange)}
            @media(max-width:600px){.v128-theme-grid,.v128-diagnostico-grid{grid-template-columns:1fr}#v128-ayuda-global{left:10px;bottom:10px;padding:9px 11px}#v128-ayuda-global span{display:none}}
            @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
            @media print{#v128-ayuda-global{display:none!important}}
        `;
        document.head.appendChild(style);
    }

    function tarjetaTema(tema) {
        const muestra = tema.colores.map(c => `<span style="background:${escapar(c)}"></span>`).join('');
        return `<label class="v128-theme-card">
            <input type="radio" name="tema-visual-v128" value="${escapar(tema.id)}" onchange="cambiarTemaVisualV128(this.value)">
            <span class="v128-theme-preview" aria-hidden="true">${muestra}</span>
            <span class="v128-theme-copy"><strong><span class="v128-theme-icon">${escapar(tema.icono)}</span>${escapar(tema.nombre)}</strong><small>${escapar(tema.descripcion)}</small></span>
        </label>`;
    }

    function inyectarSelectorTema() {
        if(document.getElementById('v128-temas')) return;
        const contenido = document.querySelector('#ajuste-interfaz .settings-section-content');
        if(!contenido) return;
        const bloque = document.createElement('section');
        bloque.id = 'v128-temas';
        bloque.className = 'v128-theme-section';
        bloque.setAttribute('aria-labelledby', 'v128-temas-titulo');
        bloque.innerHTML = `<h4 id="v128-temas-titulo">🎨 Tema visual</h4>
            <p>Elige los colores de este dispositivo. Es independiente de Profesional/Clásico y no modifica datos ni cálculos.</p>
            <div class="v128-theme-grid" role="radiogroup" aria-label="Tema visual">${TEMAS.map(tarjetaTema).join('')}</div>`;
        const gridModelo = contenido.querySelector('.visual-model-grid');
        if(gridModelo) gridModelo.insertAdjacentElement('afterend', bloque);
        else contenido.appendChild(bloque);
        aplicarTema(temaActual(), false);
    }

    function abrirAyuda() {
        try {
            if(typeof global.cambiarPestaña === 'function') global.cambiarPestaña('inicio');
            const panel = document.getElementById('panel-inteligente');
            const details = panel?.closest('details');
            if(details) details.open = true;
            const contenedor = document.getElementById('consulta-inteligente-contenedor');
            if(contenedor && getComputedStyle(contenedor).display === 'none') {
                alert('Activa el módulo de preguntas del Centro Inteligente desde Opciones para usar la ayuda rápida.');
                return;
            }
            const input = document.getElementById('consulta-inteligente');
            input?.scrollIntoView({ behavior:'smooth', block:'center' });
            setTimeout(() => input?.focus(), 220);
        } catch (error) {
            console.warn('No se pudo abrir la ayuda rápida.', error);
        }
    }

    function inyectarAyudaGlobal() {
        if(document.getElementById('v128-ayuda-global') || !document.getElementById('consulta-inteligente')) return;
        const boton = document.createElement('button');
        boton.id = 'v128-ayuda-global';
        boton.type = 'button';
        boton.title = 'Preguntar cómo usar SubliCosturas';
        boton.setAttribute('aria-label', 'Abrir ayuda rápida del sistema');
        boton.innerHTML = '💬 <span>Ayuda</span>';
        boton.addEventListener('click', abrirAyuda);
        document.body.appendChild(boton);
    }

    function diagnostico() {
        return [
            { nombre:'Núcleo matemático', ok:Boolean(global.SubliNegocioCore), detalle:'Cálculos y redondeos principales' },
            { nombre:'Centro Inteligente', ok:Boolean(global.SubliAsistenteCore), detalle:'Ayuda y consultas del sistema' },
            { nombre:'Módulo financiero', ok:typeof global.renderFinanzasNegocio === 'function', detalle:'Caja, préstamos y devoluciones' },
            { nombre:'Interfaz principal', ok:Boolean(document.getElementById('main-app')), detalle:'Navegación y secciones' },
            { nombre:'Service Worker', ok:'serviceWorker' in navigator, detalle:'Soporte de modo instalable/offline' },
            { nombre:'Conexión', ok:navigator.onLine, detalle:navigator.onLine ? 'En línea' : 'Sin conexión: algunas operaciones se bloquean' }
        ];
    }

    function ejecutarDiagnostico() {
        const salida = document.getElementById('v128-diagnostico-salida');
        if(!salida) return;
        const checks = diagnostico();
        salida.innerHTML = `<div class="v128-diagnostico-grid">${checks.map(c => `<div class="v128-check ${c.ok ? 'ok' : 'warn'}"><strong>${c.ok ? '✅' : '⚠️'} ${escapar(c.nombre)}</strong><br><span>${escapar(c.detalle)}</span></div>`).join('')}</div>
            <p style="margin:9px 0 0;color:var(--text-light);font-size:11px;">Diagnóstico de lectura: no modifica inventario, ventas, caja ni configuración en la nube.</p>`;
    }

    function inyectarDiagnostico() {
        if(document.getElementById('v128-diagnostico')) return;
        const sec = document.getElementById('sec-ajustes');
        if(!sec) return;
        const details = document.createElement('details');
        details.id = 'v128-diagnostico';
        details.className = 'settings-section';
        details.innerHTML = `<summary>🩺 Diagnóstico del sistema</summary>
            <div class="settings-section-content v128-diagnostico">
                <h3 class="section-title">🩺 Diagnóstico rápido</h3>
                <p class="settings-note">Comprueba que los módulos esenciales estén cargados. No realiza escrituras.</p>
                <button type="button" class="btn-main" onclick="ejecutarDiagnosticoV128()">Ejecutar diagnóstico</button>
                <div id="v128-diagnostico-salida" aria-live="polite"></div>
            </div>`;
        sec.appendChild(details);
    }

    function escucharTemaSistema() {
        try {
            const media = matchMedia('(prefers-color-scheme: dark)');
            const refrescar = () => { if(temaActual() === 'sistema') actualizarMetaTema('sistema'); };
            if(typeof media.addEventListener === 'function') media.addEventListener('change', refrescar);
            else if(typeof media.addListener === 'function') media.addListener(refrescar);
        } catch (_) {}
    }

    function iniciar() {
        inyectarEstilos();
        aplicarTema(temaActual(), false);
        inyectarSelectorTema();
        inyectarAyudaGlobal();
        inyectarDiagnostico();
        escucharTemaSistema();
    }

    global.cambiarTemaVisualV128 = tema => aplicarTema(tema, true);
    global.abrirAyudaV128 = abrirAyuda;
    global.ejecutarDiagnosticoV128 = ejecutarDiagnostico;
    global.SubliTemasV128 = Object.freeze({ temas:TEMAS.map(t => ({ ...t })), aplicarTema, temaActual, diagnostico });

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
    else iniciar();
})(typeof window !== 'undefined' ? window : globalThis);
