(function(global) {
    'use strict';
    // Solo consulta registros confirmados. No reenvía comandos ni borra datos del servidor.
    const CAMPOS = Object.freeze({
        anticipo_recibido:['anticipo-monto','anticipo-motivo'],
        anticipo_devuelto:[], traslado_dinero:['traslado-monto','traslado-motivo'],
        retiro_caja:['caja-retiro-monto','caja-retiro-motivo','caja-retiro-referencia'],
        prestamo_entregado:['prestamo-persona','prestamo-monto','prestamo-motivo','prestamo-vencimiento'],
        prestamo_devuelto:[], abono_credito:[], perdida_inventario:['perdida-cantidad','perdida-motivo'],
        devolucion_venta:['devolucion-cantidad','devolucion-motivo'],
        retiro_rapido:['ret-prod','ret-luz','ret-ganancia','ret-impuesto'],
        retiro_inteligente:['ret-int-monto']
    });
    function capturarCampos(tipo, soloIds = null) {
        return Object.fromEntries((CAMPOS[tipo] || []).filter(id => !soloIds || soloIds.includes(id)).map(id => [id,String(document.getElementById(id)?.value || '')]));
    }
    function limpiarCamposConfirmados(pendiente) {
        for(const id of CAMPOS[pendiente.tipo] || []) {
            const el = document.getElementById(id);
            if(el && Object.hasOwn(pendiente.campos || {},id) && String(el.value) === pendiente.campos[id]) el.value = '';
        }
    }
    function mostrar() {
        const pendientes = global.listarGuardadosPendientesSubli?.() || [];
        let panel = document.getElementById('subli-guardados-pendientes');
        if(!pendientes.length) {panel?.remove();return;}
        if(!panel) {
            const main = document.getElementById('main-app');
            if(!main) return;
            panel = document.createElement('section');panel.id='subli-guardados-pendientes';panel.className='card';
            const texto = document.createElement('p');texto.textContent='Hay un guardado pendiente de confirmar. Compruébalo antes de repetirlo.';
            const boton = document.createElement('button');boton.type='button';boton.className='btn-main';boton.textContent='Comprobar guardados pendientes';boton.addEventListener('click',comprobar);
            panel.append(texto,boton);main.prepend(panel);
        }
    }
    async function comprobar() {
        try {
            if(typeof isProcessingTransaction !== 'undefined' && isProcessingTransaction) return alert('Espera a que termine la operación en curso.');
            const pendientes = await global.consultarGuardadosPendientesSubli();
            for(const pendiente of pendientes) {
                const nombre = String(pendiente.tipo || 'operación').replaceAll('_',' ');
                if(!pendiente.confirmada) {
                    alert(`El servidor todavía no confirma ${nombre}. Se conserva el marcador. Revisa el historial; no repitas otra solicitud cambiada.`);
                    continue;
                }
                if(!Object.hasOwn(CAMPOS,pendiente.tipo)) {
                    alert(`El servidor confirmó ${nombre}, referencia ${pendiente.id}. Vuelve al formulario original y confirma la misma lista para recuperar su resultado sin duplicarlo. La lista se conserva.`);
                    continue;
                }
                if(!confirm(`El servidor confirmó ${nombre}.\nReferencia: ${pendiente.id}\n\n¿Marcarla como revisada? No se volverá a enviar. Se limpiarán los campos que conservan esos mismos datos; los campos que cambiaste se mantendrán.`)) continue;
                // Volver a consultar evita liberar un marcador usando una respuesta de caché.
                const confirmada = await global.reconocerGuardadoConfirmadoSubli(pendiente.id);
                limpiarCamposConfirmados(confirmada);
                global.actualizarUI?.();
                alert('Guardado confirmado y revisado. Comprueba el historial antes de registrar una operación nueva.');
            }
        } catch(error) {alert('No se pudo comprobar el guardado. '+error.message);}
        finally {mostrar();}
    }
    global.capturarCamposOperacionSubli = capturarCampos;
    global.limpiarCamposOperacionConfirmadaSubli = limpiarCamposConfirmados;
    global.comprobarGuardadosPendientesSubli = comprobar;
    global.refrescarGuardadosPendientesSubli = mostrar;
    global.addEventListener('subli:guardados-pendientes',mostrar);
    global.addEventListener('subli:app-activa',mostrar);
    global.addEventListener('online',mostrar);
    mostrar();
})(window);
