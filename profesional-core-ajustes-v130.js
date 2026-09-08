(function (global) {
    'use strict';

    const base = global.SubliProfesionalCore;
    if(!base) return;

    const PALABRAS_VACIAS = new Set([
        'a','al','de','del','el','la','las','los','lo','un','una','unos','unas','y','o','que','quiero','quieres','hacer','hago','puedo','para','por','en','mi','me'
    ]);

    function buscarAcciones(consulta, opciones = {}) {
        const texto = base.normalizarTexto(consulta);
        const rol = opciones.rol || 'empleado';
        const puedeFinanzas = Boolean(opciones.puedeFinanzas || rol === 'dueno');
        const tokens = texto.split(' ').filter(token => token && !PALABRAS_VACIAS.has(token));
        return base.ACCIONES
            .filter(a => a.roles.includes(rol) && (!a.requiereDueno || rol === 'dueno') && (!a.requiereFinanzas || puedeFinanzas))
            .map(a => {
                if(!texto) return { ...a, puntuacion:1 };
                const titulo = base.normalizarTexto(a.titulo);
                const corpus = base.normalizarTexto(`${a.titulo} ${a.descripcion} ${a.palabras}`);
                let puntuacion = 0;
                for(const token of tokens) {
                    if(titulo === token) puntuacion += 14;
                    else if(titulo.includes(token)) puntuacion += 8;
                    if(corpus.includes(token)) puntuacion += 3;
                }
                if(tokens.length && tokens.every(token => corpus.includes(token))) puntuacion += 12;
                if(corpus.includes(texto)) puntuacion += 10;
                return { ...a, puntuacion };
            })
            .filter(a => !texto || a.puntuacion > 0)
            .sort((a,b) => b.puntuacion - a.puntuacion || a.titulo.localeCompare(b.titulo, 'es'))
            .slice(0,10);
    }

    global.SubliProfesionalCore = Object.freeze({ ...base, PALABRAS_VACIAS, buscarAcciones });
})(window);
