(function aplicarModeloVisualAntesDelRender() {
    'use strict';

    const TEMA_KEY = 'subli_tema_visual_v1';
    const TEMAS = new Set(['sistema', 'noche', 'claro', 'grafito', 'contraste']);

    function temaGuardado() {
        try {
            const valor = String(localStorage.getItem(TEMA_KEY) || 'noche');
            return TEMAS.has(valor) ? valor : 'noche';
        } catch (_) {
            return 'noche';
        }
    }

    // Las preferencias visuales son locales al dispositivo: nunca escriben en Firebase.
    try {
        const guardada = JSON.parse(localStorage.getItem('subli_preferencias_sistema_v1') || 'null');
        document.documentElement.dataset.modeloVisual = guardada?.modeloVisual === 'clasico' ? 'clasico' : 'profesional';
    } catch (error) {
        document.documentElement.dataset.modeloVisual = 'profesional';
    }
    document.documentElement.dataset.temaVisual = temaGuardado();

    // Paletas cargadas antes del primer render. La doble condición aumenta la
    // especificidad para que el tema elegido tenga prioridad sobre el modelo visual.
    function inyectarPaletasTempranas() {
        if(!document || typeof document.getElementById !== 'function' || typeof document.createElement !== 'function' || !document.head || typeof document.head.appendChild !== 'function') return;
        if(document.getElementById('subli-temas-preload-v128')) return;
        const style = document.createElement('style');
        style.id = 'subli-temas-preload-v128';
        style.textContent = `
html[data-modelo-visual][data-tema-visual="noche"]{color-scheme:dark;--bg-color:#050914;--card-bg:rgba(10,20,37,.94);--surface-bg:#0d1b30;--surface-soft:rgba(20,38,63,.72);--surface-elevated:#0d1b30;--input-bg:rgba(5,14,28,.90);--nav-bg:rgba(5,12,25,.92);--primary-blue:#38bdf8;--primary-green:#2dd4bf;--primary-red:#fb7185;--primary-purple:#a78bfa;--primary-orange:#f59e0b;--text-dark:#f2f9ff;--text-light:#9fb0c7;--border-color:rgba(125,159,196,.22);--shadow:0 24px 64px -38px rgba(0,0,0,.98),0 1px 0 rgba(255,255,255,.025) inset;--focus-ring:0 0 0 3px rgba(56,189,248,.22);--app-background:radial-gradient(circle at 15% -15%,rgba(14,116,144,.23),transparent 33rem),radial-gradient(circle at 92% 8%,rgba(30,64,175,.17),transparent 34rem),#050914;}
html[data-modelo-visual][data-tema-visual="claro"]{color-scheme:light;--bg-color:#f3f6fb;--card-bg:rgba(255,255,255,.97);--surface-bg:#eef3f9;--surface-soft:rgba(226,233,243,.78);--surface-elevated:#ffffff;--input-bg:#ffffff;--nav-bg:rgba(255,255,255,.94);--primary-blue:#2563eb;--primary-green:#059669;--primary-red:#dc2626;--primary-purple:#7c3aed;--primary-orange:#d97706;--text-dark:#172033;--text-light:#64748b;--border-color:#d9e2ec;--shadow:0 18px 50px -34px rgba(15,23,42,.35),0 1px 0 rgba(255,255,255,.9) inset;--focus-ring:0 0 0 3px rgba(37,99,235,.18);--app-background:radial-gradient(circle at 12% -12%,rgba(37,99,235,.10),transparent 32rem),linear-gradient(180deg,#f8fbff,#f1f5f9);}
html[data-modelo-visual][data-tema-visual="grafito"]{color-scheme:dark;--bg-color:#0d0f13;--card-bg:rgba(23,26,33,.96);--surface-bg:#20242c;--surface-soft:rgba(45,50,61,.72);--surface-elevated:#191d24;--input-bg:#12151a;--nav-bg:rgba(18,21,27,.94);--primary-blue:#8ab4f8;--primary-green:#5bd6a2;--primary-red:#ff7b8b;--primary-purple:#b8a5ff;--primary-orange:#ffad66;--text-dark:#f5f7fa;--text-light:#aeb7c4;--border-color:#343a46;--shadow:0 22px 58px -36px rgba(0,0,0,.96),0 1px 0 rgba(255,255,255,.025) inset;--focus-ring:0 0 0 3px rgba(138,180,248,.22);--app-background:radial-gradient(circle at 80% -15%,rgba(138,180,248,.08),transparent 32rem),#0d0f13;}
html[data-modelo-visual][data-tema-visual="contraste"]{color-scheme:dark;--bg-color:#000;--card-bg:#090909;--surface-bg:#111;--surface-soft:#181818;--surface-elevated:#0b0b0b;--input-bg:#000;--nav-bg:#050505;--primary-blue:#64c8ff;--primary-green:#58ff9d;--primary-red:#ff6b80;--primary-purple:#cbb7ff;--primary-orange:#ffd24a;--text-dark:#fff;--text-light:#e2e8f0;--border-color:#f8fafc;--shadow:none;--focus-ring:0 0 0 4px #ffd24a;--app-background:#000;}
html[data-modelo-visual][data-tema-visual="sistema"]{color-scheme:light;--bg-color:#f3f6fb;--card-bg:rgba(255,255,255,.97);--surface-bg:#eef3f9;--surface-soft:rgba(226,233,243,.78);--surface-elevated:#fff;--input-bg:#fff;--nav-bg:rgba(255,255,255,.94);--primary-blue:#2563eb;--primary-green:#059669;--primary-red:#dc2626;--primary-purple:#7c3aed;--primary-orange:#d97706;--text-dark:#172033;--text-light:#64748b;--border-color:#d9e2ec;--shadow:0 18px 50px -34px rgba(15,23,42,.35);--focus-ring:0 0 0 3px rgba(37,99,235,.18);--app-background:linear-gradient(180deg,#f8fbff,#f1f5f9);}
@media(prefers-color-scheme:dark){html[data-modelo-visual][data-tema-visual="sistema"]{color-scheme:dark;--bg-color:#050914;--card-bg:rgba(10,20,37,.94);--surface-bg:#0d1b30;--surface-soft:rgba(20,38,63,.72);--surface-elevated:#0d1b30;--input-bg:rgba(5,14,28,.90);--nav-bg:rgba(5,12,25,.92);--primary-blue:#38bdf8;--primary-green:#2dd4bf;--primary-red:#fb7185;--primary-purple:#a78bfa;--primary-orange:#f59e0b;--text-dark:#f2f9ff;--text-light:#9fb0c7;--border-color:rgba(125,159,196,.22);--shadow:0 24px 64px -38px rgba(0,0,0,.98);--focus-ring:0 0 0 3px rgba(56,189,248,.22);--app-background:#050914;}}
        `;
        document.head.appendChild(style);
    }

    inyectarPaletasTempranas();

    function cargarScript(id, src, alCargar) {
        if(document.getElementById(id)) return;
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        if(typeof alCargar === 'function') script.onload = alCargar;
        document.head.appendChild(script);
    }

    // Mejoras incrementales: se cargan separadas del archivo principal para no
    // duplicar ni reescribir la lógica contable ya probada.
    function cargarMejoras() {
        // Las pruebas de arranque usan un documento mínimo. En navegador real
        // estas funciones existen; si no existen, se conserva únicamente la
        // preferencia visual y no se intenta manipular el DOM.
        if(!document || typeof document.getElementById !== 'function'
            || typeof document.createElement !== 'function'
            || !document.head || typeof document.head.appendChild !== 'function') return;
        if(document.getElementById('subli-mejoras-core-v126')) return;

        cargarScript('subli-mejoras-core-v126', './mejoras-core.js', () => {
            cargarScript('subli-mejoras-ui-v126', './mejoras-v126.js', () => {
                cargarScript('subli-asistente-core-v127', './asistente-core.js', () => {
                    cargarScript('subli-asistente-ajustes-v127', './asistente-ajustes-v127.js', () => {
                        cargarScript('subli-asistente-ajustes-v128', './asistente-ajustes-v128.js', () => {
                            cargarScript('subli-mejoras-ui-v127', './mejoras-v127.js', () => {
                                cargarScript('subli-mejoras-ui-v128', './mejoras-v128.js');
                            });
                        });
                    });
                });
            });
        });
    }

    cargarMejoras();
})();
