(function (global) {
    'use strict';

    const ALIAS_PESTANAS = Object.freeze({
        opciones: 'ajustes',
        disenos: 'buscador',
        diseños: 'buscador'
    });

    function normalizarPestana(pestana) {
        const clave = String(pestana || '').toLowerCase();
        return ALIAS_PESTANAS[clave] || pestana;
    }

    function instalar() {
        const original = global.cambiarPestaña;
        if (typeof original === 'function' && !original.__v130aliases) {
            const envuelta = function(pestana, ...args) {
                return original.call(this, normalizarPestana(pestana), ...args);
            };
            envuelta.__v130aliases = true;
            envuelta.__original = original;
            global.cambiarPestaña = envuelta;
        }

        const abrirConfig = global.abrirSeccionConfiguracion;
        if (typeof abrirConfig === 'function' && !abrirConfig.__v130aliases) {
            const envueltaConfig = function(apartado, ...args) {
                if (typeof global.cambiarPestaña === 'function') global.cambiarPestaña('ajustes');
                return abrirConfig.call(this, apartado, ...args);
            };
            envueltaConfig.__v130aliases = true;
            global.abrirSeccionConfiguracion = envueltaConfig;
        }
    }

    global.SubliCompatV130 = Object.freeze({ ALIAS_PESTANAS, normalizarPestana });
    if (document.readyState === 'complete') instalar();
    else global.addEventListener('load', instalar, { once:true });
})(window);
