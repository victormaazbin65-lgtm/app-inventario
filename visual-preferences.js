(function aplicarModeloVisualAntesDelRender() {
    'use strict';
    // Esta preferencia vive solo en el dispositivo y nunca escribe datos remotos.
    try {
        const guardada = JSON.parse(localStorage.getItem('subli_preferencias_sistema_v1') || 'null');
        document.documentElement.dataset.modeloVisual = guardada?.modeloVisual === 'clasico' ? 'clasico' : 'profesional';
    } catch (error) {
        document.documentElement.dataset.modeloVisual = 'profesional';
    }
})();
