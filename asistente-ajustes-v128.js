(function (global) {
    'use strict';

    const base = global.SubliAsistenteCore;
    if(!base) return;

    const responderAnterior = base.responderConsulta;

    function normalizar(valor) {
        return base.normalizarTexto ? base.normalizarTexto(valor) : String(valor || '').toLowerCase();
    }

    function contiene(texto, fragmentos) {
        return fragmentos.some(f => texto.includes(normalizar(f)));
    }

    function guiaTema() {
        return {
            tipo: 'ayuda',
            id: 'tema_visual_v128',
            titulo: 'Cambiar el tema visual',
            pestana: 'opciones',
            pasos: [
                'Abre Opciones → Apariencia e interfaz.',
                'En “Tema visual” elige Automático, Azul Noche, Claro, Grafito o Alto contraste.',
                'El cambio se aplica inmediatamente en este dispositivo y no modifica ventas, inventario, cálculos ni permisos.',
                'El modelo Profesional o Clásico sigue siendo independiente del tema; puedes combinar ambos ajustes.'
            ],
            alternativas: []
        };
    }

    function guiaAyudaGlobal() {
        return {
            tipo: 'ayuda',
            id: 'ayuda_global_v128',
            titulo: 'Usar la ayuda rápida',
            pestana: 'inicio',
            pasos: [
                'Pulsa “Ayuda” en la esquina inferior para abrir el Centro Inteligente.',
                'Escribe lo que quieres hacer con palabras normales, por ejemplo: “¿cómo ingreso un producto?” o “¿cómo regreso un préstamo?”.',
                'El asistente explica los pasos y puede llevarte a la sección correcta, pero no realiza movimientos de dinero ni inventario sin tu confirmación.'
            ],
            alternativas: []
        };
    }

    function responderConsulta(consultaEntrada, contexto = {}) {
        const texto = normalizar(consultaEntrada);
        if(texto && contiene(texto, ['tema', 'modo claro', 'modo oscuro', 'grafito', 'alto contraste', 'color de la interfaz'])) {
            if(contiene(texto, ['como', 'donde', 'cambiar', 'poner', 'usar', 'quiero', 'tema'])) return guiaTema();
        }
        if(texto && contiene(texto, ['ayuda rapida', 'boton ayuda', 'como pedir ayuda', 'como te pregunto'])) {
            return guiaAyudaGlobal();
        }
        return responderAnterior.call(base, consultaEntrada, contexto);
    }

    global.SubliAsistenteCore = Object.freeze({
        ...base,
        responderConsulta
    });
})(typeof window !== 'undefined' ? window : globalThis);
