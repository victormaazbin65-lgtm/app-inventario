(function (global) {
    'use strict';

    const base = global.SubliAsistenteCore;
    if(!base) return;

    function normalizar(valor) {
        return base.normalizarTexto ? base.normalizarTexto(valor) : String(valor || '').toLowerCase();
    }

    function contieneAlguno(texto, fragmentos) {
        return fragmentos.some(f => texto.includes(normalizar(f)));
    }

    function guia(id) {
        const entrada = (base.catalogo || []).find(x => x.id === id);
        return entrada ? { tipo:'ayuda', ...entrada, puntos:99, alternativas:[] } : null;
    }

    function esPreguntaDeUso(texto) {
        return contieneAlguno(texto, ['como','donde','ayuda','que significa','para que sirve','como hago','como puedo','quiero hacer']);
    }

    function esConsultaDeDatosExistente(texto) {
        if(esPreguntaDeUso(texto)) return false;
        return contieneAlguno(texto, [
            'ventas de hoy','ventas del dia','venta de hoy','utilidad de hoy','utilidad del dia',
            'cuanto hay en caja','cuanto tengo en caja','dinero en caja','fondos disponibles',
            'que debo surtir','productos por surtir','productos agotados','stock bajo',
            'productos sin codigo','sin codigo de inventario'
        ]);
    }

    function responderConsulta(consultaEntrada, contexto = {}) {
        const texto = normalizar(consultaEntrada);
        if(!texto) return base.responderConsulta(consultaEntrada, contexto);

        // Las consultas que ya sabe calcular el Centro Inteligente original se
        // mantienen en ese motor para conservar cifras y análisis en tiempo real.
        if(esConsultaDeDatosExistente(texto)) return { tipo:'delegar' };

        const respuestaBase = base.responderConsulta(consultaEntrada, contexto);
        if(['disponibilidad_prestamo','prestamos_pendientes','capacidades'].includes(respuestaBase?.tipo)) return respuestaBase;

        const hablaPrestamo = contieneAlguno(texto, ['prestamo','prestar','prestado']);
        if(hablaPrestamo) {
            // Tolera conjugaciones naturales: regreso/regresó/devolvió/abonó, etc.
            if(contieneAlguno(texto, ['regres','devol','abon','pagar prestamo','pago del prestamo'])) {
                return guia('prestamo_devolver') || respuestaBase;
            }
            if(contieneAlguno(texto, ['registr','prestar','presto','hacer prestamo','dar prestamo'])) {
                return guia('prestamo_registrar') || respuestaBase;
            }
        }

        return respuestaBase;
    }

    global.SubliAsistenteCore = Object.freeze({
        ...base,
        responderConsulta
    });
})(typeof window !== 'undefined' ? window : globalThis);
