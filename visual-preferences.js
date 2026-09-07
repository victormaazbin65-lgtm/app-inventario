(function aplicarModeloVisualAntesDelRender() {
    'use strict';
    // Esta preferencia vive solo en el dispositivo y nunca escribe datos remotos.
    try {
        const guardada = JSON.parse(localStorage.getItem('subli_preferencias_sistema_v1') || 'null');
        document.documentElement.dataset.modeloVisual = guardada?.modeloVisual === 'clasico' ? 'clasico' : 'profesional';
    } catch (error) {
        document.documentElement.dataset.modeloVisual = 'profesional';
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

        const core = document.createElement('script');
        core.id = 'subli-mejoras-core-v126';
        core.src = './mejoras-core.js';
        core.onload = () => {
            if(document.getElementById('subli-mejoras-ui-v126')) return;
            const ui126 = document.createElement('script');
            ui126.id = 'subli-mejoras-ui-v126';
            ui126.src = './mejoras-v126.js';
            ui126.onload = () => {
                if(document.getElementById('subli-asistente-core-v127')) return;
                const asistenteCore = document.createElement('script');
                asistenteCore.id = 'subli-asistente-core-v127';
                asistenteCore.src = './asistente-core.js';
                asistenteCore.onload = () => {
                    if(document.getElementById('subli-asistente-ajustes-v127')) return;
                    const ajustes = document.createElement('script');
                    ajustes.id = 'subli-asistente-ajustes-v127';
                    ajustes.src = './asistente-ajustes-v127.js';
                    ajustes.onload = () => {
                        if(document.getElementById('subli-mejoras-ui-v127')) return;
                        const ui127 = document.createElement('script');
                        ui127.id = 'subli-mejoras-ui-v127';
                        ui127.src = './mejoras-v127.js';
                        document.head.appendChild(ui127);
                    };
                    document.head.appendChild(ajustes);
                };
                document.head.appendChild(asistenteCore);
            };
            document.head.appendChild(ui126);
        };
        document.head.appendChild(core);
    }

    cargarMejoras();
})();
