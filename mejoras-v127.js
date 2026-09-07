(function (global) {
    'use strict';

    const asistente = global.SubliAsistenteCore;
    if(!asistente) return;

    function numero(valor) {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    }

    function escapar(valor) {
        if(typeof global.escaparHTML === 'function') return global.escaparHTML(valor);
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    function simboloMoneda() {
        try {
            return typeof configuracionNegocio === 'object' && configuracionNegocio?.moneda ? configuracionNegocio.moneda : 'Q';
        } catch(_) { return 'Q'; }
    }

    function dinero(valor) {
        return `${simboloMoneda()} ${numero(valor).toFixed(2)}`;
    }

    function puedeVerFinanzas() {
        try {
            if(typeof currentUserData === 'undefined' || !currentUserData) return true;
            if(global.SubliMejorasCore?.puedeVerFinanzas) return global.SubliMejorasCore.puedeVerFinanzas(currentUserData);
            return currentUserData.rol === 'dueno';
        } catch(_) { return false; }
    }

    function contextoSeguro() {
        const finanzas = puedeVerFinanzas();
        let saldos = {}, fnd = {}, prs = [], inv = [], vts = [];
        try { if(finanzas && typeof saldosDinero !== 'undefined') saldos = saldosDinero || {}; } catch(_) {}
        try { if(finanzas && typeof fondos !== 'undefined') fnd = fondos || {}; } catch(_) {}
        try { if(finanzas && typeof prestamos !== 'undefined') prs = Array.isArray(prestamos) ? prestamos : []; } catch(_) {}
        try { if(typeof inventario !== 'undefined') inv = Array.isArray(inventario) ? inventario : []; } catch(_) {}
        try { if(typeof ventas !== 'undefined') vts = Array.isArray(ventas) ? ventas : []; } catch(_) {}
        return { saldosDinero:saldos, fondos:fnd, prestamos:prs, inventario:inv, ventas:vts, ahora:Date.now(), puedeVerFinanzas:finanzas };
    }

    function inyectarEstilos() {
        if(document.getElementById('v127-estilos')) return;
        const style = document.createElement('style');
        style.id = 'v127-estilos';
        style.textContent = `
            .v127-loan-state{margin-top:8px;padding:9px 10px;border:1px solid var(--border-color);border-radius:9px;background:rgba(15,23,42,.45);font-size:12px;line-height:1.45}
            .v127-loan-state.ok{border-color:var(--primary-green);background:rgba(52,211,153,.08)}
            .v127-loan-state.error{border-color:var(--primary-red);background:rgba(251,113,133,.08);color:var(--primary-red)}
            .v127-loan-origin{display:inline-block;margin-top:5px;padding:3px 7px;border:1px solid var(--border-color);border-radius:999px;color:var(--text-light);font-size:11px}
            .v127-sugerencias{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
            .v127-sugerencia{border:1px solid var(--border-color);background:var(--surface-soft,rgba(30,41,59,.65));color:var(--text-dark);border-radius:999px;padding:7px 10px;font-size:11px;cursor:pointer}
            .v127-sugerencia:hover{border-color:var(--primary-blue)}
            .v127-answer{margin-top:10px;padding:12px;border:1px solid var(--border-color);border-radius:10px;background:rgba(15,23,42,.45);line-height:1.5}
            .v127-answer h5{margin:0 0 8px;color:var(--primary-blue);font-size:14px}
            .v127-answer ol,.v127-answer ul{margin:7px 0 7px 20px;padding:0}
            .v127-answer li{margin:5px 0}
            .v127-answer-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
            .v127-answer-kpi{padding:9px;border:1px solid var(--border-color);border-radius:8px}
            .v127-answer-kpi small{display:block;color:var(--text-light);font-size:10px}
            .v127-answer-kpi strong{font-size:15px}
            .v127-prioridad{padding:7px 0;border-bottom:1px solid var(--border-color);font-size:12px}
            .v127-prioridad:last-child{border-bottom:none}
            @media(max-width:480px){.v127-answer-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    function disponibilidadActual() {
        const c = contextoSeguro();
        return asistente.calcularDisponibilidadPrestamo(c.saldosDinero, c.fondos);
    }

    function textoOrigen(origen) {
        return origen === 'banco' ? 'Banco' : 'Efectivo';
    }

    function mensajeValidacionPrestamo(validacion) {
        if(validacion.razon === 'ubicacion') {
            return `⚠️ No puedes prestar ${dinero(validacion.monto)} desde ${textoOrigen(validacion.origen)}. Disponible en esa ubicación: ${dinero(validacion.saldoOrigen)}.`;
        }
        if(validacion.razon === 'sat') {
            return `⚠️ Aunque hay dinero en ${textoOrigen(validacion.origen)}, el máximo prestable sin tocar el fondo SAT protegido es ${dinero(validacion.maximo)}.`;
        }
        if(validacion.ok) {
            const restante = Math.max(0, validacion.saldoOrigen - validacion.monto);
            return `✅ Disponible. Después del préstamo quedarían ${dinero(restante)} en ${textoOrigen(validacion.origen)}. El fondo SAT sigue protegido.`;
        }
        return '';
    }

    function actualizarEtiquetasOrigen(select, d) {
        if(!select) return;
        const ef = Array.from(select.options).find(o => o.value === 'efectivo');
        const ba = Array.from(select.options).find(o => o.value === 'banco');
        if(ef) ef.textContent = `Efectivo — disponible ${dinero(d.efectivo)}`;
        if(ba) ba.textContent = `Banco — disponible ${dinero(d.banco)}`;
    }

    function asegurarEstadoPrestamo() {
        const origen = document.getElementById('prestamo-origen');
        const monto = document.getElementById('prestamo-monto');
        if(!origen || !monto) return;
        let estado = document.getElementById('v127-prestamo-disponible');
        if(!estado) {
            estado = document.createElement('div');
            estado.id = 'v127-prestamo-disponible';
            estado.className = 'v127-loan-state';
            const grupo = origen.closest('.form-group') || origen.parentElement;
            grupo?.appendChild(estado);
        }
        const d = disponibilidadActual();
        actualizarEtiquetasOrigen(origen, d);
        const valor = numero(monto.value);
        const validacion = asistente.validarPrestamoLocal(valor, origen.value, contextoSeguro().saldosDinero, contextoSeguro().fondos);
        estado.classList.remove('ok','error');
        if(valor > 0) {
            estado.textContent = mensajeValidacionPrestamo(validacion);
            estado.classList.add(validacion.ok ? 'ok' : 'error');
            monto.setAttribute('aria-invalid', validacion.ok ? 'false' : 'true');
        } else {
            const maximo = origen.value === 'banco' ? d.maximoBanco : d.maximoEfectivo;
            estado.textContent = `Disponible en ${textoOrigen(origen.value)}: ${dinero(origen.value === 'banco' ? d.banco : d.efectivo)} · Máximo prestable sin tocar SAT: ${dinero(maximo)} · SAT protegido: ${dinero(d.satProtegido)}.`;
            monto.removeAttribute('aria-invalid');
        }
        const boton = document.querySelector('button[onclick="registrarPrestamo()"]');
        if(boton) boton.disabled = valor > 0 && !validacion.ok;
    }

    function asegurarEstadoPrestamoModal() {
        const tipo = document.getElementById('v126-tipo-salida');
        const origen = document.getElementById('ret-int-origen');
        const monto = document.getElementById('ret-int-monto');
        if(!tipo || !origen || !monto) return;
        const d = disponibilidadActual();
        if(tipo.value === 'prestamo') actualizarEtiquetasOrigen(origen, d);
        let estado = document.getElementById('v127-prestamo-modal-disponible');
        if(!estado) {
            estado = document.createElement('div');
            estado.id = 'v127-prestamo-modal-disponible';
            estado.className = 'v127-loan-state';
            const extra = document.getElementById('v126-prestamo-campos');
            extra?.appendChild(estado);
        }
        estado.style.display = tipo.value === 'prestamo' ? 'block' : 'none';
        if(tipo.value !== 'prestamo') return;
        const valor = numero(monto.value);
        const validacion = asistente.validarPrestamoLocal(valor, origen.value, contextoSeguro().saldosDinero, contextoSeguro().fondos);
        estado.classList.remove('ok','error');
        if(valor > 0) {
            estado.textContent = mensajeValidacionPrestamo(validacion);
            estado.classList.add(validacion.ok ? 'ok' : 'error');
        } else {
            const maximo = origen.value === 'banco' ? d.maximoBanco : d.maximoEfectivo;
            estado.textContent = `Disponible: ${dinero(origen.value === 'banco' ? d.banco : d.efectivo)} · Máximo sin tocar SAT: ${dinero(maximo)}.`;
        }
    }

    function instalarValidacionPrestamos() {
        const origen = document.getElementById('prestamo-origen');
        const monto = document.getElementById('prestamo-monto');
        origen?.addEventListener('change', actualizarPrestamosVisuales);
        monto?.addEventListener('input', actualizarPrestamosVisuales);
        document.getElementById('ret-int-origen')?.addEventListener('change', actualizarPrestamosVisuales);
        document.getElementById('ret-int-monto')?.addEventListener('input', actualizarPrestamosVisuales);
        document.getElementById('v126-tipo-salida')?.addEventListener('change', actualizarPrestamosVisuales);

        const original = global.registrarPrestamo;
        if(typeof original === 'function' && !original.__v127) {
            const envuelta = async function(...args) {
                const campoMonto = document.getElementById('prestamo-monto');
                const campoOrigen = document.getElementById('prestamo-origen');
                const valor = numero(campoMonto?.value);
                const c = contextoSeguro();
                const validacion = asistente.validarPrestamoLocal(valor, campoOrigen?.value, c.saldosDinero, c.fondos);
                if(valor > 0 && !validacion.ok) {
                    actualizarPrestamosVisuales();
                    alert(mensajeValidacionPrestamo(validacion));
                    return;
                }
                return original.apply(this, args);
            };
            envuelta.__v127 = true;
            envuelta.__v126 = original.__v126;
            global.registrarPrestamo = envuelta;
        }
        actualizarPrestamosVisuales();
    }

    function decorarListaPrestamos() {
        const cont = document.getElementById('lista-prestamos');
        if(!cont) return;
        let lista = [];
        try {
            if(typeof prestamos !== 'undefined' && Array.isArray(prestamos)) {
                lista = prestamos.filter(p => numero(p.saldoPendiente) > 0 && p.estado !== 'anulado').sort((a,b) => numero(a.timestamp) - numero(b.timestamp));
            }
        } catch(_) {}
        const filas = Array.from(cont.querySelectorAll('.item-row'));
        filas.forEach((fila, i) => {
            if(fila.querySelector('.v127-loan-origin')) return;
            const p = lista[i];
            if(!p) return;
            const info = fila.querySelector('.item-info');
            if(!info) return;
            const tag = document.createElement('span');
            tag.className = 'v127-loan-origin';
            tag.textContent = `Prestado desde: ${textoOrigen(p.origen)} · Original: ${dinero(p.montoOriginal)}`;
            info.appendChild(tag);
        });
    }

    function actualizarPrestamosVisuales() {
        try { asegurarEstadoPrestamo(); } catch(error) { console.warn('No se pudo actualizar vista de préstamo.', error); }
        try { asegurarEstadoPrestamoModal(); } catch(error) { console.warn('No se pudo actualizar vista de préstamo inteligente.', error); }
        try { decorarListaPrestamos(); } catch(error) { console.warn('No se pudo decorar lista de préstamos.', error); }
    }

    function instalarRefrescoFinanzas() {
        const original = global.renderFinanzasNegocio;
        if(typeof original === 'function' && !original.__v127) {
            const envuelta = function(...args) {
                const r = original.apply(this, args);
                actualizarPrestamosVisuales();
                return r;
            };
            envuelta.__v127 = true;
            global.renderFinanzasNegocio = envuelta;
        }
    }

    const PREGUNTAS = [
        '¿Cómo registro un préstamo?',
        '¿Cómo regreso un préstamo?',
        '¿Cómo ingreso un producto?',
        '¿Cómo hago una venta a crédito?',
        '¿Dónde cambio el porcentaje SAT?',
        '¿Qué puedo preguntarte?'
    ];

    function mejorarCajaPreguntas() {
        const cont = document.getElementById('consulta-inteligente-contenedor');
        if(!cont) return;
        const titulo = cont.querySelector('h4');
        const texto = cont.querySelector('p');
        if(titulo) titulo.textContent = '💬 Pregunta al sistema';
        if(texto) texto.textContent = 'Pregunta cómo usar SubliCosturas o consulta datos del negocio. La ayuda funciona localmente y no realiza operaciones por ti.';
        const input = document.getElementById('consulta-inteligente');
        if(input) input.placeholder = 'Ej.: ¿Cómo registro un préstamo?';
        if(!document.getElementById('v127-sugerencias')) {
            const sugerencias = document.createElement('div');
            sugerencias.id = 'v127-sugerencias';
            sugerencias.className = 'v127-sugerencias';
            sugerencias.innerHTML = PREGUNTAS.map(p => `<button type="button" class="v127-sugerencia" onclick="preguntarAsistenteSistema('${escapar(p).replace(/'/g, '&#39;')}')">${escapar(p)}</button>`).join('');
            const query = cont.querySelector('.smart-query');
            query?.insertAdjacentElement('afterend', sugerencias);
        }
    }

    function botonIr(pestana, etiqueta) {
        if(!pestana) return '';
        return `<button class="smart-action" style="margin-top:9px" onclick="irSeccionAsistente('${escapar(pestana)}')">${escapar(etiqueta || 'Ir a la sección')}</button>`;
    }

    function renderRespuesta(respuesta, salida) {
        if(!salida) return;
        if(respuesta.tipo === 'ayuda') {
            salida.innerHTML = `<div class="v127-answer"><h5>${escapar(respuesta.titulo)}</h5><ol>${respuesta.pasos.map(p => `<li>${escapar(p)}</li>`).join('')}</ol>${botonIr(respuesta.pestana, 'Abrir esta sección')}</div>`;
            return;
        }
        if(respuesta.tipo === 'capacidades') {
            salida.innerHTML = `<div class="v127-answer"><h5>${escapar(respuesta.titulo)}</h5><p>${escapar(respuesta.texto)}</p><ul>${respuesta.ejemplos.map(e => `<li>${escapar(e)}</li>`).join('')}</ul></div>`;
            return;
        }
        if(respuesta.tipo === 'disponibilidad_prestamo') {
            if(!puedeVerFinanzas()) {
                salida.innerHTML = '<div class="v127-answer"><h5>Información restringida</h5><p>Tu usuario no tiene permiso para ver saldos financieros.</p></div>';
                return;
            }
            const d = respuesta.disponibilidad;
            salida.innerHTML = `<div class="v127-answer"><h5>🤝 ${escapar(respuesta.titulo)}</h5>
                <div class="v127-answer-grid">
                    <div class="v127-answer-kpi"><small>Efectivo disponible</small><strong>${dinero(d.efectivo)}</strong></div>
                    <div class="v127-answer-kpi"><small>Banco disponible</small><strong>${dinero(d.banco)}</strong></div>
                    <div class="v127-answer-kpi"><small>Máximo desde efectivo sin tocar SAT</small><strong>${dinero(d.maximoEfectivo)}</strong></div>
                    <div class="v127-answer-kpi"><small>Máximo desde banco sin tocar SAT</small><strong>${dinero(d.maximoBanco)}</strong></div>
                </div>
                <p style="margin-bottom:0">Fondo SAT protegido: <strong>${dinero(d.satProtegido)}</strong>. El límite real es el menor entre el saldo del origen y los fondos disponibles sin SAT.</p>
                ${botonIr('caja','Ir a préstamos')}</div>`;
            return;
        }
        if(respuesta.tipo === 'prestamos_pendientes') {
            if(!puedeVerFinanzas()) {
                salida.innerHTML = '<div class="v127-answer"><h5>Información restringida</h5><p>Tu usuario no tiene permiso para ver préstamos y saldos financieros.</p></div>';
                return;
            }
            const lista = respuesta.prestamos;
            salida.innerHTML = `<div class="v127-answer"><h5>🤝 ${escapar(respuesta.titulo)}</h5>${lista.length ? `<ul>${lista.slice(0,10).map(p => {
                const estado = p.dias === null ? 'sin fecha' : p.dias < 0 ? `vencido hace ${Math.abs(p.dias)} día(s)` : p.dias === 0 ? 'vence hoy' : `vence en ${p.dias} día(s)`;
                return `<li><strong>${escapar(p.persona)}</strong> · ${dinero(p.saldoPendiente)} · ${escapar(estado)}</li>`;
            }).join('')}</ul>` : '<p>No hay préstamos pendientes.</p>'}${botonIr('caja','Ver préstamos')}</div>`;
            return;
        }
        if(respuesta.tipo === 'no_encontrada') {
            const alternativas = respuesta.alternativas || [];
            salida.innerHTML = `<div class="v127-answer"><h5>No encontré una guía exacta</h5><p>Prueba indicando la acción que quieres hacer, por ejemplo “cómo registrar un anticipo” o “dónde cambio el margen”.</p>${alternativas.length ? `<p>Tal vez buscas:</p><ul>${alternativas.map(a => `<li>${escapar(a.titulo)}</li>`).join('')}</ul>` : ''}</div>`;
        }
    }

    function instalarPreguntasInteligentes() {
        mejorarCajaPreguntas();
        const original = global.ejecutarConsultaInteligente;
        if(typeof original === 'function' && !original.__v127) {
            const envuelta = function(...args) {
                const entrada = document.getElementById('consulta-inteligente');
                const salida = document.getElementById('resultado-consulta-inteligente');
                const texto = entrada?.value?.trim() || '';
                const respuesta = asistente.responderConsulta(texto, contextoSeguro());
                if(respuesta.tipo === 'delegar' || respuesta.tipo === 'vacia') return original.apply(this, args);
                renderRespuesta(respuesta, salida);
            };
            envuelta.__v127 = true;
            global.ejecutarConsultaInteligente = envuelta;
        }

        global.preguntarAsistenteSistema = function(texto) {
            const entrada = document.getElementById('consulta-inteligente');
            if(!entrada) return;
            entrada.value = texto;
            global.ejecutarConsultaInteligente?.();
            entrada.focus();
        };
        global.irSeccionAsistente = function(pestana) {
            if(typeof global.cambiarPestaña === 'function') global.cambiarPestaña(pestana);
        };
    }

    function renderPrioridadesCentro() {
        const cont = document.getElementById('contenido-inteligente');
        if(!cont) return;
        document.getElementById('v127-prioridades')?.remove();
        try {
            if(typeof preferenciasSistema !== 'undefined' && !preferenciasSistema.inteligenciaActiva) return;
            if(typeof global.moduloInteligenteActivo === 'function' && !global.moduloInteligenteActivo('alertas')) return;
        } catch(_) {}

        const c = contextoSeguro();
        const prioridades = [];
        const fisicos = c.inventario.filter(p => !p?.isService);
        const agotados = fisicos.filter(p => numero(p.stock) <= 0).length;
        const bajos = fisicos.filter(p => numero(p.stock) > 0 && numero(p.stock) <= numero(p.min)).length;
        const sinCodigo = fisicos.filter(p => !p.codigoInventario).length;
        if(agotados) prioridades.push({ nivel:3, texto:`${agotados} producto(s) agotado(s).`, pestana:'alertas' });
        if(bajos) prioridades.push({ nivel:2, texto:`${bajos} producto(s) con existencia baja.`, pestana:'alertas' });
        if(sinCodigo) prioridades.push({ nivel:1, texto:`${sinCodigo} producto(s) físico(s) todavía sin código de inventario.`, pestana:'inventario' });

        if(c.puedeVerFinanzas) {
            const hoy = new Date(); hoy.setHours(0,0,0,0);
            const activos = c.prestamos.filter(p => numero(p.saldoPendiente) > 0 && p.estado !== 'anulado');
            const vencidos = activos.filter(p => {
                if(!p.vencimiento) return false;
                const f = new Date(`${p.vencimiento}T00:00:00`);
                return !Number.isNaN(f.getTime()) && f.getTime() < hoy.getTime();
            });
            if(vencidos.length) prioridades.push({ nivel:4, texto:`${vencidos.length} préstamo(s) vencido(s) por ${dinero(vencidos.reduce((t,p) => t + numero(p.saldoPendiente), 0))}.`, pestana:'caja' });
            const creditos = c.ventas.filter(v => !v.anulada && numero(v.saldoPendiente) > 0);
            if(creditos.length) prioridades.push({ nivel:2, texto:`${creditos.length} venta(s) a crédito con ${dinero(creditos.reduce((t,v) => t + numero(v.saldoPendiente),0))} pendiente.`, pestana:'caja' });
        }

        if(!prioridades.length) return;
        prioridades.sort((a,b) => b.nivel - a.nivel);
        const card = document.createElement('div');
        card.id = 'v127-prioridades';
        card.className = 'smart-card';
        card.innerHTML = `<h4>🧭 Prioridades del sistema</h4><p style="margin:0;color:var(--text-light);font-size:12px">Cruza inventario, créditos y préstamos para señalar lo que conviene revisar primero.</p>${prioridades.slice(0,5).map(p => `<div class="v127-prioridad">${escapar(p.texto)} <button class="smart-action" style="margin-left:6px" onclick="irSeccionAsistente('${escapar(p.pestana)}')">Revisar</button></div>`).join('')}`;
        cont.prepend(card);
    }

    function instalarRefrescoCentro() {
        const original = global.renderPanelInteligente;
        if(typeof original === 'function' && !original.__v127) {
            const envuelta = function(...args) {
                const r = original.apply(this, args);
                mejorarCajaPreguntas();
                renderPrioridadesCentro();
                return r;
            };
            envuelta.__v127 = true;
            global.renderPanelInteligente = envuelta;
        }
        mejorarCajaPreguntas();
        renderPrioridadesCentro();
    }

    function instalar() {
        if(document.documentElement.dataset.v127Instalado === '1') return;
        document.documentElement.dataset.v127Instalado = '1';
        inyectarEstilos();
        instalarRefrescoFinanzas();
        instalarValidacionPrestamos();
        instalarPreguntasInteligentes();
        instalarRefrescoCentro();
        actualizarPrestamosVisuales();
    }

    if(document.readyState === 'complete') instalar();
    else global.addEventListener('load', instalar, { once:true });
})(typeof window !== 'undefined' ? window : globalThis);
