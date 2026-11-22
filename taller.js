(function(global){
 'use strict';
 const $=id=>document.getElementById(id);
 const core=global.SubliNegocioCore;
 const escapar=valor=>escaparHTML(String(valor ?? ''));
 const opcionesDiseno={pendiente:'Pendiente de aprobación',aprobado:'Aprobado','no-aplica':'No aplica'};
 const estadosEntrega={preparacion:'En preparación',listo:'Listo',entregado:'Entregado'};
 let ordenes=new Map(), entregas=new Map(), editor=null, busquedaOrden=0, busquedaEntrega=0;
 const idUsuario=()=>currentUserData?.id;
 async function consultar(coleccion,campo,valor){
     if(!navigator.onLine || !global.db) throw new Error('Necesitas conexión para consultar estos registros.');
     const snap=await global.getDocs(global.query(global.collection(global.db,coleccion),global.where(campo,'==',valor)));
     if(!snap.metadata || snap.metadata.fromCache || snap.metadata.hasPendingWrites) throw new Error('El servidor todavía no confirmó los datos. Vuelve a actualizar.');
     const lista=new Map();
     snap.forEach(d=>lista.set(String(d.id),{...d.data(),id:String(d.id)}));
     return lista;
 }
 global.bloquearFormularioVenta=function(activo){
     $('formulario-venta').disabled=activo;
     $('formulario-venta').inert=activo;
     $('estado-guardado-venta').textContent=activo?'Guardando venta…':'';
 };
 global.pendienteElegirAnticipo=()=>!$('anticipo-conversion').hidden && !$('anticipo-conversion').dataset.eleccion;
 global.mostrarAnticipoCotizado=function(monto,total,eleccion=''){
     const panel=$('anticipo-conversion');
     panel.hidden=!(monto>0);
     panel.dataset.eleccion=eleccion;
     panel.dataset.monto=String(monto||0);
     panel.dataset.total=String(total||0);
     if(monto>0) $('anticipo-conversion-titulo').textContent='Anticipo acordado · '+dineroNegocio(monto);
 };
 global.elegirAnticipoCotizado=function(opcion){
     if(isProcessingTransaction) return;
     const monto=Number($('anticipo-conversion').dataset.monto);
     const disponible=totalAnticiposCliente($('venta-cliente-id').value);
     if(opcion==='existente' && !disponible) return alert('Selecciona un cliente con anticipo disponible.');
     const aplicado=opcion==='existente'?Math.min(disponible,monto):0;
     const recibido=opcion==='hoy'?monto:0;
     $('venta-tipo-cobro').value=(aplicado+recibido>=Number($('anticipo-conversion').dataset.total))?'contado':'credito';
     $('anticipo-conversion').dataset.eleccion=opcion;
     $('venta-aplicar-anticipo').value=String(aplicado);
     $('venta-pago-inicial').value=String(recibido);
     actualizarCamposCobroVenta();renderCarritoVentas();
     $('venta-anticipo-disponible').scrollIntoView({block:'nearest'});
 };
 global.consultarHuellasIngresos=async function(){
     const usuario=idUsuario();
     if(currentUserData?.rol!=='dueno') return alert('Esta revisión corresponde al dueño.');
     if(!await cargarHistorialCompleto('ingresos') || idUsuario()!==usuario) return;
     const afectados=historialIngresos.filter(r=>!r.anulada && Number(r.versionCalculo)>=2 && (!Array.isArray(r.items) || !r.items.length || !r.items.every(i=>i && [r.aplicadoEn,i.stockAntes,i.costoAntes,i.stockDespues,i.costoDespues].every(core.esDatoReversion))));
     $('consulta-huellas').textContent=afectados.length?'Ingresos con datos de reversión incompletos: '+afectados.map(r=>`${r.fecha || 'Sin fecha'} · ${r.id}`).join(' | '):'Todos los ingresos vigentes con control de reversión conservan los datos necesarios.';
 };
 global.abrirRecepcionOrden=function(){
     if(!puedeAbrirSeccionSubli('ingreso')) return alert('Necesitas acceso a Ingreso para recibir mercadería.');
     cambiarPestaña('ingreso');if ($('recepcion-orden').open) global.cargarOrdenesPendientes();
     global.subliAbrirPanel?.('recepcion-orden');$('recepcion-orden').open=true;$('recepcion-orden').scrollIntoView({block:'start'});
 };
 global.cargarOrdenesPendientes=async function(){
     const token=++busquedaOrden, usuario=idUsuario();
     ordenes=new Map();$('orden-pendiente').replaceChildren();$('orden-recepcion-lineas').textContent='';
     if(!puedeAbrirSeccionSubli('ingreso')) return;
     try{
         const datos=await consultar('ordenes_compra','estado','pendiente');
         if(token!==busquedaOrden || usuario!==idUsuario())return;
         ordenes=datos;
         $('orden-pendiente').add(new Option(datos.size?'Selecciona una orden':'Sin órdenes pendientes',''));
         for(const o of [...datos.values()].sort((a,b)=>b.creadoEn-a.creadoEn)) $('orden-pendiente').add(new Option(`${o.proveedor} · ${o.creadoEn?fechaHoraNegocio(o.creadoEn):''} · ${o.id}`,o.id));
     }catch(e){if(token===busquedaOrden && usuario===idUsuario()) $('orden-recepcion-lineas').textContent=e.message;}
 };
 global.mostrarOrdenPendiente=function(){
     const o=ordenes.get($('orden-pendiente').value);
     const cont=$('orden-recepcion-lineas');
     cont.innerHTML='';
     if(!o)return;
     cont.innerHTML=o.items.map((i,indice)=>{
         const pendiente=core.desdeMilesimas(core.aMilesimas(i.cantidad)-core.aMilesimas(i.recibido||0));
         if(pendiente<=0)return '';
         const p=inventario.find(p=>String(p.id)===String(i.id));
         const unidad=core.obtenerUnidad(p?.unidadId || 'pieza',configuracionNegocio);
         return `<article data-indice="${indice}"><strong>${escapar(i.nombre)}</strong><p>Pendiente ${escapar(pendiente)} ${escapar(i.unidadAbreviatura||unidad.abreviatura)}</p><div class="grid-2"><label>Cantidad recibida<input type="number" data-cantidad min="0" max="${escapar(pendiente)}" step="${escapar(unidad.paso)}" value="${escapar(pendiente)}"></label><label>Costo por unidad<input data-costo type="number" min="0" step="any" value="${escapar(i.costoUnitario)}"></label></div></article>`;
     }).join('');
 };
 global.prepararIngresoOrden=function(){
     if(isProcessingTransaction || !puedeAbrirSeccionSubli('ingreso'))return;
     const o=ordenes.get($('orden-pendiente').value);
     if(!o)return alert('Selecciona una orden pendiente.');
     if(ingresoEnEdicion || carritoIngresos.some(i=>i.ordenCompraId && i.ordenCompraId!==o.id)) return alert('Termina la recepción que ya está en preparación.');
     try{
         const nuevas=[];
         for(const fila of $('orden-recepcion-lineas').querySelectorAll('[data-indice]')){
             const i=o.items[Number(fila.dataset.indice)], cantidad=fila.querySelector('[data-cantidad]').value, costo=fila.querySelector('[data-costo]').value;
             if(cantidad==='' || Number(cantidad)===0) continue;
             const p=inventario.find(p=>String(p.id)===String(i.id));
             if(!p || p.isService || i.unidadId && i.unidadId!==(p.unidadId||'pieza')) throw new Error('Revisa el producto y la unidad de '+i.nombre);
             if(carritoIngresos.some(l=>String(l.idOriginal)===String(i.id))) throw new Error(i.nombre+' ya está en la lista previa.');
             const u=core.obtenerUnidad(p.unidadId||'pieza',configuracionNegocio);
             if(!core.esDatoReversion(costo)) throw new Error('Revisa el costo de '+i.nombre);
             const {cantidadBase:stock,costoBase}=core.calcularIngresoSimple(cantidad,costo,u);
             if(core.aMilesimas(stock)+core.aMilesimas(i.recibido||0)>core.aMilesimas(i.cantidad)) throw new Error('La cantidad supera el pendiente de '+i.nombre);
             nuevas.push({tempId:Date.now()+Math.random(),ordenCompraId:o.id,revisionOrden:Number(o.revisionRecepcion||0),idOriginal:String(p.id),isNew:false,nombre:p.nombre,nombreOriginal:p.nombre,formaIngreso:'unidad',stock,cantidadComprada:stock,contenidoPorCompra:1,min:p.min??0,costoBase,costoIngresado:costoBase,costoTotalCompra:core.redondearMoneda(stock*costoBase),tipoCosto:'unitario',proveedor:i.proveedor || o.proveedor,nit:$('inv-nit').value.trim(),factura:$('inv-factura').value.trim(),categoria:p.categoria || 'OTROS',unidadId:u.id,unidadNombre:u.nombre,unidadAbreviatura:u.abreviatura,unidadPaso:u.paso,unidadDivisible:u.divisible});
         }
         if(!nuevas.length) throw new Error('Indica al menos una cantidad recibida.');
         carritoIngresos.push(...nuevas);renderCarritoIngresos();global.guardarBorradoresV130?.();global.subliAbrirPanel?.('lista-ingresos-pendientes');$('lista-ingresos-pendientes').scrollIntoView({block:'center'});
     }catch(e){alert(e.message);}
 };
 global.prepararActualizacionOrden=async function(t,nuevas,anterior){
     const previas=anterior?.items||[];
     const vinculadas=[...previas,...nuevas].filter(i=>i.ordenCompraId);
     const ids=new Set(vinculadas.map(i=>i.ordenCompraId));
     if(ids.size!==1) throw new Error('La recepción debe corresponder a una sola orden.');
     const id=vinculadas[0].ordenCompraId,ref=global.doc(global.db,'ordenes_compra',id),snap=await t.get(ref);
     if(!snap.exists())throw new Error('La orden vinculada ya no existe.');
     const orden=snap.data(),rev=Number(orden.revisionRecepcion||0);
     if(!['pendiente','recibida'].includes(orden.estado) || nuevas.some(i=>i.ordenCompraId && (i.revisionOrden!==undefined ? Number(i.revisionOrden)!==rev : !previas.some(p=>p.ordenCompraId===id && String(p.idFinal)===String(i.idFinal)))))throw new Error('La orden cambió. Actualiza las órdenes pendientes y vuelve a preparar la recepción.');
     const cambios=new Map();
     for(const [items,signo] of [[previas,-1],[nuevas,1]])for(const i of items.filter(i=>i.ordenCompraId)){
         const clave=String(i.idFinal),linea=orden.items.find(p=>String(p.id)===clave);
         if(!linea || linea.unidadId && linea.unidadId!==i.unidadId)throw new Error('El producto o su unidad no coincide con la orden.');
         cambios.set(clave,(cambios.get(clave)||0)+signo*core.aMilesimas(i.stock));
     }
     const items=orden.items.map(p=>{
         const recibido=core.aMilesimas(p.recibido||0)+(cambios.get(String(p.id))||0);
         if(recibido<0 || recibido>core.aMilesimas(p.cantidad)) throw new Error('La recepción supera el pendiente de '+p.nombre);
         return {...p,recibido:core.desdeMilesimas(recibido)};
     });
     return ()=>t.update(ref,{items,revisionRecepcion:rev+1,estado:items.every(i=>core.aMilesimas(i.recibido)===core.aMilesimas(i.cantidad))?'recibida':'pendiente'});
 };
 global.abrirEntregasHoy=function(){
     if (!puedeAbrirSeccionSubli('ventas')) return;
     $('entregas-fecha').value=core.fechaDiaNegocio(Date.now());cambiarPestaña('ventas');
     if ($('panel-entregas').open) global.cargarEntregasDia();
     global.subliAbrirPanel?.('panel-entregas');$('panel-entregas').open=true;$('panel-entregas').scrollIntoView({block:'start'});
 };
 global.limpiarConsultasTaller=function(){
     busquedaOrden++;busquedaEntrega++;ordenes.clear();entregas.clear();editor=null;
     if ($('dialogo-entrega').open) $('dialogo-entrega').close();
     $('entregas-lista').replaceChildren();$('orden-pendiente').replaceChildren();$('orden-recepcion-lineas').replaceChildren();$('consulta-huellas').textContent='';
     $('panel-entregas').open=false;$('recepcion-orden').open=false;
 };
 const disponibleEntrega=v=>v && !v.anulada && !(v.devoluciones?.length && !v.detalleItems?.length);
 global.cargarEntregasDia=async function(){
     const token=++busquedaEntrega,usuario=idUsuario(),cont=$('entregas-lista');
     entregas=new Map();cont.textContent='';
     if(!puedeAbrirSeccionSubli('ventas'))return;
     const dia=$('entregas-fecha').value||core.fechaDiaNegocio(Date.now());$('entregas-fecha').value=dia;cont.textContent='Consultando entregas…';
     try{
         const datos=await consultar('ventas','fechaEntrega',dia);
         if(token!==busquedaEntrega || usuario!==idUsuario())return;
         entregas=datos;
         const filas=[...datos.values()].filter(disponibleEntrega).sort((a,b)=>(a.entrega?.hora||'24').localeCompare(b.entrega?.hora||'24'));
         cont.innerHTML=filas.map(v=>{
             const e=v.entrega||{},items=(v.detalleItems||[]).filter(i=>i.rol!=='material').map(i=>i.qty+' × '+i.nombre).join(', ') || v.resumenItems || 'Detalle sin registrar';
             return `<article><strong>${escapar(v.clienteNombre||'C/F')}</strong><p>${escapar(items)}</p><p>${escapar(e.hora||'Sin hora')} · ${escapar(estadosEntrega[e.estado]||'En preparación')} · Diseño: ${escapar(opcionesDiseno[e.diseno]||'Pendiente de aprobación')}</p><p>Saldo: ${core.esDatoReversion(v.saldoPendiente)?escapar(dineroNegocio(v.saldoPendiente)):'Sin registrar'}</p><button type="button" class="btn-sm btn-edit" data-entrega="${escapar(v.id)}">Actualizar entrega</button></article>`;
         }).join('')||'Sin entregas programadas para esta fecha.';
     }catch(e){if(token===busquedaEntrega && usuario===idUsuario())cont.textContent=e.message;}
 };
 $('entregas-lista').addEventListener('click',ev=>{const b=ev.target.closest('[data-entrega]');if(b)global.editarEntregaVenta(b.dataset.entrega,true);});
 const firmaEntrega=v=>JSON.stringify([v.fechaEntrega||'',v.entrega?.hora||'',v.entrega?.estado||'',v.entrega?.diseno||'',v.entrega?.revision||0]);
 global.editarEntregaVenta=function(id,desdeAgenda=false){
     if(isProcessingTransaction || !puedeAbrirSeccionSubli('ventas'))return;
     const v=desdeAgenda?entregas.get(id):ventas.find(v=>String(v.id)===String(id));
     if(!disponibleEntrega(v))return alert('La venta ya no está disponible.');
     editor={id:String(id),firma:firmaEntrega(v),usuario:idUsuario()};
     $('cliente-entrega').textContent=(v.clienteNombre||'C/F')+' · '+id;$('entrega-fecha').value=v.fechaEntrega||core.fechaDiaNegocio(Date.now());
     $('entrega-hora').value=v.entrega?.hora||'';$('entrega-diseno').value=v.entrega?.diseno||'pendiente';$('entrega-estado').value=v.entrega?.estado||'preparacion';
     $('dialogo-entrega').showModal();
 };
 $('form-entrega').addEventListener('submit',async ev=>{
     ev.preventDefault();
     if(isProcessingTransaction || !editor || editor.usuario!==idUsuario() || !puedeAbrirSeccionSubli('ventas'))return;
     const actual=editor,fecha=$('entrega-fecha').value,hora=$('entrega-hora').value,estado=$('entrega-estado').value,diseno=$('entrega-diseno').value;
     if(!fecha || !estadosEntrega[estado] || !opcionesDiseno[diseno])return;
     isProcessingTransaction=true;const boton=ev.target.querySelector('[type=submit]');boton.disabled=true;
     try{
         const venta=await global.runTransaction(global.db,async t=>{
             const ref=global.doc(global.db,'ventas',actual.id),snap=await t.get(ref);
             const v=snap.exists() && snap.data();
             if(!disponibleEntrega(v) || actual.firma!==firmaEntrega(v))throw new Error('La venta o su entrega cambió. Abre de nuevo el detalle actualizado.');
             const cambio={fechaEntrega:fecha,entrega:{hora,estado,diseno,revision:Number(v.entrega?.revision||0)+1}};
             t.update(ref,cambio);return {...v,...cambio,id:actual.id};
         },{tipoOperacion:'programar_entrega',permisoRequerido:'ventas',claveOperacion:JSON.stringify([actual,fecha,hora,estado,diseno])});
         if(idUsuario()!==actual.usuario)return;
         if(ventas.some(v=>String(v.id)===actual.id))ventas=fusionarPorId(ventas,[venta]);
         $('dialogo-entrega').close();global.renderHistorialVentas();if($('panel-entregas').open) await global.cargarEntregasDia();
     }catch(e){alert(e.message);}finally{isProcessingTransaction=false;boton.disabled=false;}
 });
 })(window);
