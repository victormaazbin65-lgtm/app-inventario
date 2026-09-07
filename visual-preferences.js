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
    function cargarMejorasV126() {
        if(document.getElementById('subli-mejoras-core-v126')) return;
        const core = document.createElement('script');
        core.id = 'subli-mejoras-core-v126';
        core.src = './mejoras-core.js';
        core.onload = () => {
            if(document.getElementById('subli-mejoras-ui-v126')) return;
            const ui = document.createElement('script');
            ui.id = 'subli-mejoras-ui-v126';
            ui.src = './mejoras-v126.js';
            document.head.appendChild(ui);
        };
        document.head.appendChild(core);
    }

    cargarMejorasV126();
})();
