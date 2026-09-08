(function (global) {
    'use strict';

    const core = global.SubliProfesionalCore;
    const negocio = global.SubliNegocioCore;
    if(!core || !negocio) return;

    const ERROR_KEY = 'subli_errores_locales_v130';
    let firmaOrden = '';
    let serverTimestampPromise = null;

    function escapar(valor) {
        if(typeof global.escaparHTML === 'function') return global.escaparHTML(valor);
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    function dinero(valor) {
        let simbolo='Q'; try{simbolo=configuracionNegocio?.moneda||'Q';}catch(_){}
        return `${simbolo} ${core.numero(valor).toFixed(2)}`;
    }

    function idSeguro(prefijo='reg') {
        try { if(typeof global.generarIDSeguro === 'function') return `${prefijo}_${global.generarIDSeguro()}`; } catch(_) {}
        try { return `${prefijo}_${crypto.randomUUID()}`; } catch(_) { return `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
    }

    function esDueno() { try { return currentUserData?.rol === 'dueno'; } catch(_) { return false; } }
    function usuario() { try { return currentUserData || null; } catch(_) { return null; } }

    async function valorServerTimestamp() {
        try {
            if(!serverTimestampPromise) serverTimestampPromise = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js').then(m => m.serverTimestamp).catch(()=>null);
            const fn = await serverTimestampPromise;
            return typeof fn === 'function' ? fn() : null;
        } catch(_) { return null; }
    }

    function contextoDatos() {
        let inv=[], vts=[], prs=[], ing=[], cli=[], ants=[], saldos={};
        try{inv=Array.isArray(inventario)?inventario:[];}catch(_){}
        try{vts=Array.isArray(ventas)?ventas:[];}catch(_){}
        try{prs=Array.isArray(prestamos)?prestamos:[];}catch(_){}
        try{ing=Array.isArray(historialIngresos)?historialIngresos:[];}catch(_){}
        try{cli=Array.isArray(clientes)?clientes:[];}catch(_){}
        try{ants=Array.isArray(anticipos)?anticipos:[];}catch(_){}
        try{saldos=saldosDinero||{};}catch(_){}
        return {inventario:inv,ventas:vts,prestamos:prs,ingresos:ing,clientes:cli,anticipos:ants,saldosDinero:saldos,ahora:Date.now()};
    }

    function inyectarEstilos() {
        if(document.getElementById('v130-op-estilos')) return;
        const s=document.createElement('style'); s.id='v130-op-estilos'; s.textContent=`
            .v130-op-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v130-op-note{margin:5px 0 12px;color:var(--text-light);font-size:11px;line-height:1.5}.v130-op-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.v130-op-actions button{flex:1 1 150px;min-height:40px;padding:8px 10px;border:1px solid var(--border-color);border-radius:9px;background:var(--surface-soft);color:var(--text-dark);font-weight:700;cursor:pointer}.v130-op-actions button.primary{background:var(--primary-blue);color:white;border-color:var(--primary-blue)}
            .v130-order-table{width:100%;border-collapse:collapse;font-size:11px}.v130-order-table th,.v130-order-table td{padding:7px 5px;border-bottom:1px solid var(--border-color);text-align:left}.v130-order-table td:nth-last-child(-n+3),.v130-order-table th:nth-last-child(-n+3){text-align:right}.v130-order-total{text-align:right;font-size:16px;font-weight:800;margin-top:9px}
            .v130-diff{padding:9px;border:1px solid var(--border-color);border-radius:9px;background:var(--surface-soft)}.v130-diff.ok{border-left:4px solid var(--primary-green)}.v130-diff.bad{border-left:4px solid var(--primary-red)}
            #v130-barcode-svg{max-width:100%;height:auto;background:white;padding:10px;border-radius:8px}.v130-label-preview{text-align:center;padding:14px;border:1px dashed var(--border-color);border-radius:12px;background:white;color:#111}.v130-label-preview strong{display:block;margin-bottom:6px}.v130-label-preview small{display:block;margin-top:6px}
            .v130-log-row{padding:8px 0;border-bottom:1px solid var(--border-color);font-size:11px}.v130-log-row:last-child{border-bottom:0}.v130-log-row small{display:block;color:var(--text-light);margin-top:2px}.v130-error{border-left:3px solid var(--primary-red);padding-left:8px}.v130-ok{color:var(--primary-green)}
            @media(max-width:650px){.v130-op-grid{grid-template-columns:1fr}.v130-order-wrap{overflow:auto}.v130-order-table{min-width:620px}}
        `; document.head.appendChild(s);
    }

    async function registrarAuditoria(tipo, detalles={}) {
        if(!global.db || !navigator.onLine) return false;
        const u=usuario();
        try {
            const servidorEn=await valorServerTimestamp();
            const timestamp=Date.now();
            const registro={
                tipo:String(tipo||'evento').slice(0,80), timestamp,
                servidorEn:servidorEn || null,
                usuarioId:u?.id || null, usuarioNombre:u?.nombre || 'Usuario', usuarioRol:u?.rol || 'desconocido',
                detalles:JSON.parse(JSON.stringify(detalles||{})), build:'1.3.0'
            };
            await global.setDoc(global.doc(global.db,'auditoria_sistema',idSeguro('aud')),registro);
            return true;
        } catch(error) { console.warn('No se pudo registrar auditoría secundaria.',error); return false; }
    }

    function firmaEstado(nombre) {
        try {
            if(nombre==='venta') return JSON.stringify((ventas||[]).slice(0,3).map(x=>[x.id,x.timestamp,x.revision]));
            if(nombre==='cotizacion') return JSON.stringify((historialCotizaciones||[]).slice(0,3).map(x=>[x.id,x.timestamp]));
            if(nombre==='ingreso') return JSON.stringify((historialIngresos||[]).slice(0,3).map(x=>[x.id,x.timestamp]));
            if(nombre==='prestamo') return JSON.stringify((prestamos||[]).map(x=>[x.id,x.saldoPendiente,x.actualizadoEn]).slice(0,30));
            if(nombre==='anticipo') return JSON.stringify((anticipos||[]).map(x=>[x.id,x.saldoPendiente,x.actualizadoEn]).slice(0,30));
            if(nombre==='cliente') return JSON.stringify((clientes||[]).map(x=>[x.id,x.actualizadoEn]).slice(0,50));
            if(nombre==='caja') return JSON.stringify([saldosDinero?.efectivo,saldosDinero?.banco,(movimientosCaja||[]).slice(0,2).map(x=>x.id)]);
        } catch(_) {}
        return '';
    }

    function instalarAuditoriaOperaciones() {
        const mapa=[
            ['procesarVentaMultiple','venta','venta_guardada'],['procesarCotizacion','cotizacion','cotizacion_guardada'],['procesarIngresoMultiple','ingreso','ingreso_guardado'],
            ['registrarPrestamo','prestamo','prestamo_registrado'],['abonarPrestamo','prestamo','prestamo_abonado'],['registrarAnticipoCliente','anticipo','anticipo_registrado'],['devolverAnticipo','anticipo','anticipo_devuelto'],['registrarTrasladoDinero','caja','traslado_dinero']
        ];
        mapa.forEach(([fn,estado,tipo])=>{
            const original=global[fn]; if(typeof original!=='function'||original.__v130audit) return;
            const envuelta=async function(...args){const antes=firmaEstado(estado); const r=await original.apply(this,args); const despues=firmaEstado(estado); if(antes!==despues) registrarAuditoria(tipo,{referencia:args[0]??null}); return r;}; envuelta.__v130audit=true; global[fn]=envuelta;
        });
    }

    function leerErrores() { try { const x=JSON.parse(localStorage.getItem(ERROR_KEY)||'[]'); return Array.isArray(x)?x:[]; } catch(_){return [];} }
    function guardarErrores(lista) { try { localStorage.setItem(ERROR_KEY,JSON.stringify(lista.slice(-30))); } catch(_){} }
    function capturarError(error,contexto) { const lista=leerErrores(); lista.push(core.sanitizarError(error,contexto)); guardarErrores(lista); renderDiagnosticoErrores(); }

    function instalarCapturaErrores() {
        global.addEventListener('error',e=>capturarError(e.error||e.message,'window.error'));
        global.addEventListener('unhandledrejection',e=>capturarError(e.reason,'unhandledrejection'));
    }

    async function subirDiagnosticoErrores() {
        if(!esDueno()) return alert('Solo el Dueño puede guardar diagnósticos en la nube.');
        if(!navigator.onLine||!global.db) return alert('Necesitas conexión.');
        const errores=leerErrores(); if(!errores.length) return alert('No hay errores locales para guardar.');
        try{
            const servidorEn=await valorServerTimestamp();
            await global.setDoc(global.doc(global.db,'errores_sistema',idSeguro('diag')),{timestamp:Date.now(),servidorEn:servidorEn||null,usuario:usuario()?.nombre||'Dueño',build:'1.3.0',errores});
            alert('✅ Diagnóstico guardado. No modifica datos del negocio.');
            registrarAuditoria('diagnostico_guardado',{errores:errores.length});
        }catch(error){alert('No se pudo guardar el diagnóstico. '+error.message);}
    }

    function asegurarPanelAuditoria() {
        if(document.getElementById('v130-auditoria')) return;
        const sec=document.getElementById('sec-ajustes')||document.querySelector('#ajuste-interfaz')?.parentElement; if(!sec) return;
        const d=document.createElement('details'); d.id='v130-auditoria'; d.className='settings-section';
        d.innerHTML=`<summary>🧾 Actividad y errores del sistema</summary><div class="settings-section-content"><p class="v130-op-note">El registro ayuda a saber qué operación ocurrió y quién la realizó. La auditoría agregada por esta capa es secundaria: nunca puede hacer fallar una venta ya confirmada.</p><div class="v130-op-actions"><button onclick="cargarAuditoriaV130()">Actualizar actividad</button><button onclick="subirDiagnosticoV130()">Guardar diagnóstico de errores</button><button onclick="limpiarErroresV130()">Limpiar errores locales</button></div><h4>Actividad reciente</h4><div id="v130-auditoria-lista"><small>Presiona “Actualizar actividad”.</small></div><h4>Errores recientes de este dispositivo</h4><div id="v130-errores-lista"></div></div>`;
        sec.appendChild(d); renderDiagnosticoErrores();
    }

    async function cargarAuditoria() {
        const salida=document.getElementById('v130-auditoria-lista'); if(!salida) return;
        if(!navigator.onLine||!global.db){salida.innerHTML='<small>Sin conexión.</small>';return;}
        salida.innerHTML='<small>Cargando…</small>';
        try{
            const snap=await global.getDocs(global.collection(global.db,'auditoria_sistema')); const filas=[]; snap.forEach(x=>filas.push({id:x.id,...x.data()})); filas.sort((a,b)=>core.numero(b.timestamp)-core.numero(a.timestamp));
            salida.innerHTML=filas.length?filas.slice(0,50).map(x=>`<div class="v130-log-row"><strong>${escapar(x.tipo)}</strong> · ${escapar(x.usuarioNombre||'Usuario')}<small>${escapar(x.timestamp?new Date(x.timestamp).toLocaleString('es-GT'):'Sin fecha')}</small></div>`).join(''):'<small>No hay actividad registrada por esta capa todavía.</small>';
        }catch(error){salida.innerHTML=`<small>No se pudo cargar: ${escapar(error.message)}</small>`;}
    }

    function renderDiagnosticoErrores() {
        const salida=document.getElementById('v130-errores-lista'); if(!salida) return; const lista=leerErrores().slice().reverse();
        salida.innerHTML=lista.length?lista.slice(0,10).map(e=>`<div class="v130-log-row v130-error"><strong>${escapar(e.nombre)}: ${escapar(e.mensaje)}</strong><small>${escapar(new Date(e.timestamp).toLocaleString('es-GT'))} · ${escapar(e.contexto)}</small></div>`).join(''):'<small class="v130-ok">No hay errores JavaScript recientes guardados en este dispositivo.</small>';
    }

    function limpiarErrores(){guardarErrores([]);renderDiagnosticoErrores();}

    function proveedorPlan() {
        try{return negocio.crearPlanSurtido(inventario,configuracionNegocio);}catch(_){return [];}
    }

    function asegurarOrdenCompra() {
        const sec=document.getElementById('sec-alertas'); if(!sec||document.getElementById('v130-orden-compra')) return;
        const d=document.createElement('details'); d.id='v130-orden-compra'; d.className='fold-card'; d.open=false;
        d.innerHTML=`<summary>🧾 Orden de compra a proveedor</summary><div class="fold-card-content"><p class="v130-op-note">Usa el cálculo de Por Surtir para preparar un pedido. Generarlo no aumenta inventario; el ingreso se hace cuando recibes la mercadería.</p><div class="form-group"><label>Proveedor</label><select id="v130-orden-proveedor"></select></div><div id="v130-orden-contenido"></div><div class="v130-op-actions"><button onclick="imprimirOrdenV130()">Imprimir</button><button onclick="exportarOrdenV130()">Excel / CSV</button><button class="primary" onclick="guardarOrdenV130()">Guardar orden</button></div></div>`;
        sec.appendChild(d); document.getElementById('v130-orden-proveedor').addEventListener('change',renderOrdenCompra); actualizarOrdenCompra();
    }

    function actualizarOrdenCompra() {
        const select=document.getElementById('v130-orden-proveedor'); if(!select) return; const plan=proveedorPlan(); const proveedores=Array.from(new Set(plan.map(x=>x.proveedorSurtido||x.proveedor||'NO ESPECIFICADO'))).sort((a,b)=>String(a).localeCompare(String(b),'es'));
        const firma=proveedores.join('|'); if(firma===firmaOrden) return; firmaOrden=firma; const val=select.value; select.innerHTML=proveedores.length?proveedores.map(p=>`<option value="${escapar(p)}">${escapar(p)}</option>`).join(''):'<option value="">Sin compras pendientes</option>'; if(proveedores.includes(val))select.value=val; renderOrdenCompra();
    }

    function ordenActual(){const prov=document.getElementById('v130-orden-proveedor')?.value||'';return core.crearOrdenCompra(proveedorPlan(),prov);}

    function renderOrdenCompra(){const salida=document.getElementById('v130-orden-contenido');if(!salida)return;const orden=ordenActual();if(!orden.items.length){salida.innerHTML='<p class="v130-op-note">No hay productos pendientes para este proveedor.</p>';return;}salida.innerHTML=`<div class="v130-order-wrap"><table class="v130-order-table"><thead><tr><th>Código</th><th>Producto</th><th>Stock</th><th>Comprar</th><th>Costo u.</th><th>Subtotal</th></tr></thead><tbody>${orden.items.map(i=>`<tr><td>${escapar(i.codigo||'—')}</td><td>${escapar(i.nombre)}</td><td>${i.stock}</td><td>${i.cantidad}</td><td>${dinero(i.costoUnitario)}</td><td>${dinero(i.subtotal)}</td></tr>`).join('')}</tbody></table></div><div class="v130-order-total">Estimado: ${dinero(orden.total)}</div>`;}

    function imprimirOrden(){const o=ordenActual();if(!o.items.length)return alert('No hay productos en la orden.');const w=open('','_blank','width=900,height=700');if(!w)return alert('El navegador bloqueó la ventana de impresión.');const nombre=(()=>{try{return configuracionNegocio?.nombreNegocio||'SubliCosturas';}catch(_){return'SubliCosturas';}})();w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Orden de compra</title><style>body{font-family:Arial;padding:30px;color:#111}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}td:nth-last-child(-n+3),th:nth-last-child(-n+3){text-align:right}h1{margin-bottom:4px}.total{text-align:right;font-size:18px;font-weight:bold;margin-top:15px}</style></head><body><h1>${escapar(nombre)}</h1><p><b>Orden de compra</b><br>Proveedor: ${escapar(o.proveedor)}<br>Fecha: ${escapar(new Date().toLocaleString('es-GT'))}</p><table><thead><tr><th>Código</th><th>Producto</th><th>Stock</th><th>Comprar</th><th>Costo u.</th><th>Subtotal</th></tr></thead><tbody>${o.items.map(i=>`<tr><td>${escapar(i.codigo)}</td><td>${escapar(i.nombre)}</td><td>${i.stock}</td><td>${i.cantidad}</td><td>${dinero(i.costoUnitario)}</td><td>${dinero(i.subtotal)}</td></tr>`).join('')}</tbody></table><div class="total">Total estimado: ${dinero(o.total)}</div></body></html>`);w.document.close();setTimeout(()=>w.print(),150);}

    function descargar(nombre,contenido,tipo){const blob=new Blob([contenido],{type:tipo});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

    function exportarOrden(){const o=ordenActual();if(!o.items.length)return alert('No hay productos en la orden.');const filas=o.items.map(i=>({Codigo:i.codigo,Producto:i.nombre,Proveedor:i.proveedor,Stock:i.stock,Minimo:i.minimo,Comprar:i.cantidad,CostoUnitario:i.costoUnitario,Subtotal:i.subtotal}));if(global.XLSX){const ws=global.XLSX.utils.json_to_sheet(filas);const wb=global.XLSX.utils.book_new();global.XLSX.utils.book_append_sheet(wb,ws,'Orden');global.XLSX.writeFile(wb,`Orden_${core.claveUnica(o.proveedor)}_${new Date().toISOString().slice(0,10)}.xlsx`);return;}const cab=Object.keys(filas[0]);const csv=[cab.join(','),...filas.map(f=>cab.map(k=>`"${String(f[k]??'').replaceAll('"','""')}"`).join(','))].join('\n');descargar(`Orden_${core.claveUnica(o.proveedor)}.csv`,csv,'text/csv;charset=utf-8');}

    async function guardarOrden(){if(!esDueno())return alert('Solo el Dueño puede guardar órdenes de compra en la nube.');if(!navigator.onLine||!global.db)return alert('Necesitas conexión.');const o=ordenActual();if(!o.items.length)return alert('No hay productos en la orden.');if(!confirm(`Guardar orden para ${o.proveedor} por un estimado de ${dinero(o.total)}?`))return;try{const servidorEn=await valorServerTimestamp();const id=idSeguro('oc');await global.setDoc(global.doc(global.db,'ordenes_compra',id),{...o,id,estado:'pendiente',creadoPor:usuario()?.nombre||'Dueño',servidorEn:servidorEn||null});await registrarAuditoria('orden_compra_guardada',{id,proveedor:o.proveedor,total:o.total,lineas:o.items.length});alert('✅ Orden guardada. Cuando llegue el pedido, regístralo desde Ingreso.');}catch(error){alert('No se guardó la orden. '+error.message);}}

    function asegurarCierreDiario(){const sec=document.getElementById('sec-inicio');if(!sec||document.getElementById('v130-cierre-diario'))return;const d=document.createElement('details');d.id='v130-cierre-diario';d.className='fold-card';d.innerHTML=`<summary>🌙 Cierre diario y conteo de caja</summary><div class="fold-card-content"><p class="v130-op-note">Compara lo que el sistema espera contra lo que realmente contaste. Registrar una diferencia no cambia los saldos: deja evidencia para revisión.</p><div class="v130-op-grid"><div class="form-group"><label>Efectivo contado</label><input id="v130-cierre-efectivo" type="number" step="0.01" min="0"></div><div class="form-group"><label>Saldo bancario comprobado</label><input id="v130-cierre-banco" type="number" step="0.01" min="0"></div></div><div id="v130-cierre-resultado"></div><div class="v130-op-actions"><button onclick="calcularCierreV130()">Comparar</button><button class="primary" onclick="guardarCierreV130()">Registrar cierre</button></div></div>`;const agenda=document.getElementById('v130-agenda-cobros');if(agenda)agenda.insertAdjacentElement('afterend',d);else sec.appendChild(d);['v130-cierre-efectivo','v130-cierre-banco'].forEach(id=>document.getElementById(id).addEventListener('input',renderCierre));renderCierre();}

    function renderCierre(){const d=document.getElementById('v130-cierre-diario'),salida=document.getElementById('v130-cierre-resultado');if(!d||!salida)return;d.style.display=esDueno()?'':'none';if(!esDueno())return;const c=contextoDatos();const ef=document.getElementById('v130-cierre-efectivo'),ba=document.getElementById('v130-cierre-banco');if(!ef.value)ef.placeholder=core.numero(c.saldosDinero.efectivo).toFixed(2);if(!ba.value)ba.placeholder=core.numero(c.saldosDinero.banco).toFixed(2);const conteo={efectivo:ef.value===''?c.saldosDinero.efectivo:ef.value,banco:ba.value===''?c.saldosDinero.banco:ba.value};const r=core.calcularCierre(c.saldosDinero,conteo);salida.innerHTML=`<div class="v130-op-grid"><div class="v130-diff ${negocio.aCentavos(r.diferenciaEfectivo)===0?'ok':'bad'}"><small>Efectivo esperado ${dinero(r.esperadoEfectivo)}</small><br><strong>Diferencia ${dinero(r.diferenciaEfectivo)}</strong></div><div class="v130-diff ${negocio.aCentavos(r.diferenciaBanco)===0?'ok':'bad'}"><small>Banco esperado ${dinero(r.esperadoBanco)}</small><br><strong>Diferencia ${dinero(r.diferenciaBanco)}</strong></div></div>`;return r;}

    async function guardarCierre(){if(!esDueno())return alert('Solo el Dueño puede registrar el cierre.');if(!navigator.onLine||!global.db)return alert('Necesitas conexión para registrar el cierre.');const ef=document.getElementById('v130-cierre-efectivo'),ba=document.getElementById('v130-cierre-banco');if(!ef?.value||!ba?.value)return alert('Escribe el efectivo contado y el saldo bancario comprobado.');let e,b;try{e=negocio.normalizarMontoMoneda(ef.value,{permitirCero:true});b=negocio.normalizarMontoMoneda(ba.value,{permitirCero:true});}catch(error){return alert(error.message);}const c=contextoDatos();const r=core.calcularCierre(c.saldosDinero,{efectivo:e,banco:b});if(!confirm(`Registrar cierre con diferencia total de ${dinero(r.diferenciaTotal)}? Esto NO modifica los saldos del sistema.`))return;try{const desde=core.inicioDia(Date.now()),hasta=desde+core.MS_DIA-1;const resumen=global.SubliMejorasCore?.resumenVentasRango?global.SubliMejorasCore.resumenVentasRango(c.ventas,desde,hasta):null;const servidorEn=await valorServerTimestamp();const id=`${new Date().toISOString().slice(0,10)}_${Date.now()}`;await global.setDoc(global.doc(global.db,'cierres_diarios',id),{id,timestamp:Date.now(),servidorEn:servidorEn||null,usuarioId:usuario()?.id||null,usuarioNombre:usuario()?.nombre||'Dueño',...r,resumenDia:resumen,cobrosPendientes:core.agendaCobros(c.ventas,c.prestamos).length,build:'1.3.0'});await registrarAuditoria('cierre_diario',{id,diferenciaTotal:r.diferenciaTotal,cuadra:r.cuadra});alert(r.cuadra?'✅ Cierre registrado y cuadrado.':'✅ Cierre registrado con diferencia para revisión.');}catch(error){alert('No se registró el cierre. '+error.message);}}

    function asegurarEtiquetas(){const sec=document.getElementById('sec-inventario');if(!sec||document.getElementById('v130-etiquetas'))return;const d=document.createElement('details');d.id='v130-etiquetas';d.className='fold-card';d.innerHTML=`<summary>🏷️ Etiqueta con código de barras</summary><div class="fold-card-content"><p class="v130-op-note">Usa el código permanente de inventario. Puedes imprimir la etiqueta y después escribir o escanear ese código para identificar el producto.</p><div class="form-group"><label>Producto</label><select id="v130-etiqueta-producto"></select></div><div id="v130-etiqueta-preview"></div><div class="v130-op-actions"><button onclick="imprimirEtiquetaV130()">Imprimir etiqueta</button></div></div>`;sec.appendChild(d);document.getElementById('v130-etiqueta-producto').addEventListener('change',renderEtiqueta);actualizarEtiquetas();}

    function actualizarEtiquetas(){const select=document.getElementById('v130-etiqueta-producto');if(!select)return;let inv=[];try{inv=(inventario||[]).filter(p=>p&&!p.isService&&Number(p.codigoInventario)).sort((a,b)=>Number(a.codigoInventario)-Number(b.codigoInventario));}catch(_){}const firma=inv.map(p=>`${p.id}:${p.codigoInventario}:${p.nombre}`).join('|');if(select.dataset.firma===firma)return;const val=select.value;select.dataset.firma=firma;select.innerHTML=inv.length?inv.map(p=>`<option value="${escapar(String(p.id))}">${escapar(p.codigoInventario)} · ${escapar(p.nombre)}</option>`).join(''):'<option value="">No hay productos con código</option>';if(inv.some(p=>String(p.id)===val))select.value=val;renderEtiqueta();}

    function svgBarcode(codigo){const b=core.code39(codigo);const scale=2,h=64;let x=4;const rects=[];for(const m of b.modulos){if(m.barra)rects.push(`<rect x="${x}" y="2" width="${m.ancho*scale}" height="${h}" fill="#000"/>`);x+=m.ancho*scale;}return `<svg id="v130-barcode-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x+4} ${h+4}" role="img" aria-label="Código de barras ${escapar(b.texto)}">${rects.join('')}</svg>`;}
    function productoEtiqueta(){let inv=[];try{inv=inventario||[];}catch(_){}return inv.find(p=>String(p.id)===String(document.getElementById('v130-etiqueta-producto')?.value||''));}
    function renderEtiqueta(){const salida=document.getElementById('v130-etiqueta-preview');if(!salida)return;const p=productoEtiqueta();if(!p){salida.innerHTML='<p class="v130-op-note">No hay producto seleccionado.</p>';return;}salida.innerHTML=`<div class="v130-label-preview"><strong>${escapar(p.nombre)}</strong>${svgBarcode(p.codigoInventario)}<small>Código ${escapar(p.codigoInventario)}${p.categoria?' · '+escapar(p.categoria):''}</small></div>`;}
    function imprimirEtiqueta(){const p=productoEtiqueta();if(!p)return;const w=open('','_blank','width=500,height=400');if(!w)return alert('El navegador bloqueó la ventana de impresión.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta</title><style>@page{size:70mm 40mm;margin:3mm}body{font-family:Arial;text-align:center;margin:0}.label{width:64mm}.label strong{font-size:14px;display:block;margin-bottom:3mm}svg{width:60mm;height:18mm}small{display:block;margin-top:2mm}</style></head><body><div class="label"><strong>${escapar(p.nombre)}</strong>${svgBarcode(p.codigoInventario)}<small>Código ${escapar(p.codigoInventario)}</small></div></body></html>`);w.document.close();setTimeout(()=>w.print(),120);}

    function claveProducto(p){return core.claveUnica(`${p?.categoria||''}|${p?.nombre||''}|${p?.descripcion||''}`);}
    function identidadCliente(c){const nit=String(c?.nit||'').trim().toUpperCase();if(nit&&nit!=='C/F'&&nit!=='CF')return `nit-${core.claveUnica(nit)}`;const tel=String(c?.telefono||'').replace(/\D/g,'');return tel.length>=6?`tel-${tel.slice(0,30)}`:'';}

    function instalarReservaProductos(){const original=global.reservarCodigoInventarioEnTransaccion;if(typeof original!=='function'||original.__v130names)return;const envuelta=async function(t,producto,estado,ocupados,timestamp){const resultado=await original.call(this,t,producto,estado,ocupados,timestamp);const p=resultado?.producto||producto;if(!p||p.isService||!p.id)return resultado;const clave=claveProducto(p);const ref=global.doc(global.db,'indices_nombres',`producto_${clave}`);const snap=await t.get(ref);if(snap.exists()&&String(snap.data()?.entidadId||'')!==String(p.id))throw new Error(`Ya existe un producto equivalente a “${p.nombre}”. Actualiza el inventario antes de continuar.`);let anterior=null;try{anterior=(inventario||[]).find(x=>String(x.id)===String(p.id));}catch(_){}const claveAnterior=anterior?claveProducto(anterior):clave;if(claveAnterior!==clave){const refAnt=global.doc(global.db,'indices_nombres',`producto_${claveAnterior}`);const snapAnt=await t.get(refAnt);if(snapAnt.exists()&&String(snapAnt.data()?.entidadId||'')===String(p.id))t.delete(refAnt);}t.set(ref,{tipo:'producto',entidadId:String(p.id),clave,nombre:String(p.nombre||''),actualizadoEn:timestamp||Date.now()},{merge:true});return resultado;};envuelta.__v130names=true;global.reservarCodigoInventarioEnTransaccion=envuelta;}

    function instalarClienteSeguro(){const original=global.guardarCliente;if(typeof original!=='function'||original.__v130names)return;const seguro=async function(){if(!global.exigirDueno?.('Solo el Dueño puede crear o modificar fichas de clientes.')||!navigator.onLine||!global.db)return;if(typeof isProcessingTransaction!=='undefined'&&isProcessingTransaction)return;let cliente;try{cliente=negocio.validarCliente({id:document.getElementById('cliente-id').value||global.generarIDSeguro(),nombres:document.getElementById('cliente-nombres').value,apellidos:document.getElementById('cliente-apellidos').value,telefono:document.getElementById('cliente-telefono').value,direccion:document.getElementById('cliente-direccion').value,nit:document.getElementById('cliente-nit').value,notas:document.getElementById('cliente-notas').value,limiteCredito:document.getElementById('cliente-limite').value});}catch(error){return alert(error.message);}const duplicado=(clientes||[]).find(c=>!c.archivado&&c.nombreCompleto===cliente.nombreCompleto&&String(c.id)!==String(cliente.id));if(duplicado&&!confirm(`Ya existe “${duplicado.nombreCompleto}”. ¿Guardar de todos modos como otra ficha?`))return;isProcessingTransaction=true;try{const registro=await global.runTransaction(global.db,async t=>{const ref=global.doc(global.db,'clientes',String(cliente.id));const snap=await t.get(ref);const anteriorServidor=snap.exists()?snap.data():null;const anteriorLocal=(clientes||[]).find(c=>String(c.id)===String(cliente.id));const anterior=anteriorServidor||anteriorLocal||{};const identidad=identidadCliente(cliente),identidadAnterior=identidadCliente(anterior);let refIdentidad=null;if(identidad){refIdentidad=global.doc(global.db,'indices_nombres',`cliente_${identidad}`);const s=await t.get(refIdentidad);if(s.exists()&&String(s.data()?.entidadId||'')!==String(cliente.id))throw new Error(identidad.startsWith('nit-')?'Ese NIT ya pertenece a otra ficha de cliente.':'Ese teléfono ya pertenece a otra ficha de cliente.');}let refAnterior=null;if(identidadAnterior&&identidadAnterior!==identidad){refAnterior=global.doc(global.db,'indices_nombres',`cliente_${identidadAnterior}`);const s=await t.get(refAnterior);if(!(s.exists()&&String(s.data()?.entidadId||'')===String(cliente.id)))refAnterior=null;}const saldo=Number.isFinite(Number(anteriorServidor?.saldoCredito))?negocio.redondearMoneda(anteriorServidor.saldoCredito):global.saldoCreditoCalculadoCliente(cliente.id);const actualizado={...anterior,...cliente,saldoCredito:saldo,creadoEn:anterior.creadoEn||Date.now(),actualizadoEn:Date.now(),archivado:false};t.set(ref,actualizado);if(refAnterior)t.delete(refAnterior);if(refIdentidad)t.set(refIdentidad,{tipo:'cliente',entidadId:String(cliente.id),clave:identidad,nombre:cliente.nombreCompleto,actualizadoEn:Date.now()},{merge:true});return actualizado;});clientes=global.fusionarPorId?global.fusionarPorId(clientes,[registro]):[...clientes.filter(c=>String(c.id)!==String(registro.id)),registro];global.limpiarFormularioCliente?.();global.renderGestionNegocio?.();registrarAuditoria('cliente_guardado',{clienteId:registro.id});alert('✅ Cliente guardado.');}catch(error){alert('No se guardó el cliente. '+error.message);}finally{isProcessingTransaction=false;}};seguro.__v130names=true;seguro.__original=original;global.guardarCliente=seguro;}

    function refrescar(){asegurarOrdenCompra();actualizarOrdenCompra();asegurarCierreDiario();renderCierre();asegurarEtiquetas();actualizarEtiquetas();asegurarPanelAuditoria();}

    function init(){inyectarEstilos();instalarCapturaErrores();instalarReservaProductos();instalarClienteSeguro();instalarAuditoriaOperaciones();asegurarOrdenCompra();asegurarCierreDiario();asegurarEtiquetas();asegurarPanelAuditoria();setInterval(refrescar,3000);refrescar();}

    global.registrarAuditoriaV130=registrarAuditoria;global.cargarAuditoriaV130=cargarAuditoria;global.subirDiagnosticoV130=subirDiagnosticoErrores;global.limpiarErroresV130=limpiarErrores;
    global.renderOrdenV130=renderOrdenCompra;global.imprimirOrdenV130=imprimirOrden;global.exportarOrdenV130=exportarOrden;global.guardarOrdenV130=guardarOrden;global.calcularCierreV130=renderCierre;global.guardarCierreV130=guardarCierre;global.imprimirEtiquetaV130=imprimirEtiqueta;

    if(document.readyState==='complete')init();else global.addEventListener('load',init,{once:true});
})(window);
