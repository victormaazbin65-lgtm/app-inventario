(function (global) {
    'use strict';

    const base = global.SubliProfesionalCore;
    if(!base) return;

    const PALABRAS_VACIAS = new Set([
        'a','al','de','del','el','la','las','los','lo','un','una','unos','unas','y','o','que','quiero','quieres','hacer','hago','puedo','para','por','en','mi','me'
    ]);

    function palabras(valor) {
        return base.normalizarTexto(valor).split(' ').filter(Boolean);
    }

    function coincide(palabra, token) {
        if(palabra === token) return true;
        if(token.length >= 4 && palabra.startsWith(token)) return true;
        if(palabra.length >= 4 && token.startsWith(palabra)) return true;
        return false;
    }

    function contieneToken(lista, token) {
        return lista.some(palabra => coincide(palabra, token));
    }

    function buscarAcciones(consulta, opciones = {}) {
        const texto = base.normalizarTexto(consulta);
        const rol = opciones.rol || 'empleado';
        const puedeFinanzas = Boolean(opciones.puedeFinanzas || rol === 'dueno');
        const tokens = palabras(texto).filter(token => !PALABRAS_VACIAS.has(token));
        return base.ACCIONES
            .filter(a => a.roles.includes(rol) && (!a.requiereDueno || rol === 'dueno') && (!a.requiereFinanzas || puedeFinanzas))
            .map(a => {
                if(!texto) return { ...a, puntuacion:1 };
                const tituloPalabras = palabras(a.titulo);
                const corpusPalabras = palabras(`${a.titulo} ${a.descripcion} ${a.palabras}`);
                let puntuacion = 0;
                for(const token of tokens) {
                    if(tituloPalabras.includes(token)) puntuacion += 14;
                    else if(contieneToken(tituloPalabras, token)) puntuacion += 8;
                    if(corpusPalabras.includes(token)) puntuacion += 5;
                    else if(contieneToken(corpusPalabras, token)) puntuacion += 2;
                }
                if(tokens.length && tokens.every(token => contieneToken(corpusPalabras, token))) puntuacion += 12;
                return { ...a, puntuacion };
            })
            .filter(a => !texto || a.puntuacion > 0)
            .sort((a,b) => b.puntuacion - a.puntuacion || a.titulo.localeCompare(b.titulo, 'es'))
            .slice(0,10);
    }

    global.SubliProfesionalCore = Object.freeze({ ...base, PALABRAS_VACIAS, buscarAcciones });
})(window);
