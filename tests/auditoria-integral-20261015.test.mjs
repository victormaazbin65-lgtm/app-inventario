import test from 'node:test';
import {env,extract,read,vm,assert} from './sistema-fixture.mjs';

function cargar(c,nombre,archivo='index.html'){vm.runInContext(extract(nombre,read(archivo)),c);}
function finanzas(c){
 c.creditosPendientesConfirmados=false;c.monedaNegocio=()=> 'Q';c.escaparHTML=String;c.etiquetaUnidadProducto=(p,q)=>String(q);
 vm.runInContext(read('finanzas-negocio.js'),c);
}
function integridad(c,base){
 const session=new Map();c.sessionStorage={getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k),get length(){return session.size;},key:i=>[...session.keys()][i]};
 c.firebaseAuthUser={uid:'owner-fixture'};c.currentUserData.pin='hash-fixture';
 base.get('sistema/config').usuarios=[JSON.parse(JSON.stringify(c.currentUserData))];
 vm.runInContext(read('integridad-firebase.js'),c);c.instalarIntegridadFirebase();return session;
}

test('AUD-01: cotizar sin permiso financiero no revela costos ni utilidad en el aviso',async()=>{
 const {c,el,line,alerts}=env();c.currentUserData={id:'employee',rol:'empleado',permisos:{cotizacion:true,verFinanzas:false}};
 cargar(c,'puedeConsultarFinanzasInteligentes');c.carritoCotizacion=[line(2)];el('cotiza-anticipo').value='0';
 cargar(c,'procesarCotizacion');await c.procesarCotizacion();
 assert.equal(c.historialCotizaciones.length,1,alerts.join(';'));assert.match(alerts.at(-1),/30.00/);
 assert.doesNotMatch(alerts.at(-1),/Costos de Materiales|GANANCIA LIBRE|GASTOS TOTALES|10.00|20.00/);
});

test('AUD-01: el Dueño conserva el desglose completo de sus cotizaciones',async()=>{
 const {c,el,line,alerts}=env();cargar(c,'puedeConsultarFinanzasInteligentes');c.carritoCotizacion=[line(2)];el('cotiza-anticipo').value='0';
 cargar(c,'procesarCotizacion');await c.procesarCotizacion();assert.match(alerts.at(-1),/GANANCIA LIBRE ESTIMADA: Q 20.00/);
});

test('AUD-02: navegar valida los permisos aunque la pestaña se intente abrir por un atajo',()=>{
 const {c,el}=env();c.currentUserData={id:'employee',rol:'empleado',permisos:{ventas:true,verFinanzas:false}};
 for(const id of ['inicio','ingreso','inventario','ventas','cotizacion','caja','alertas','buscador','ajustes'])el('tab-'+id).classList={add(){},remove(){}};
 el('sec-ventas').style.display='block';el('sec-inicio').style.display='none';el('sec-caja').style.display='none';el('sec-ajustes').style.display='none';
 cargar(c,'puedeAbrirSeccionSubli');cargar(c,'cambiarPestaña');
 for(const section of ['inicio','caja','ajustes','ingreso']){assert.equal(c.cambiarPestaña(section),false);assert.notEqual(el('sec-'+section).style.display,'block');}
 assert.equal(el('sec-ventas').style.display,'block');assert.notEqual(c.cambiarPestaña('ventas'),false);
});

test('AUD-03: una respuesta incierta se anuncia como pendiente y el reintento recupera el traslado sin duplicar',async()=>{
 const {c,base,el,alerts}=env();finanzas(c);const native=c.runTransaction,originalGet=c.getDoc;let perder=true,bloquearLectura=false;
 c.runTransaction=async(...args)=>{const result=await native(...args);if(perder){perder=false;bloquearLectura=true;const e=Error('Red perdida tras commit');e.code='unavailable';throw e;}return result;};
 c.getDoc=async ref=>{if(bloquearLectura&&String(ref).startsWith('operaciones_sistema/'))throw Error('Sin red');return originalGet(ref);};
 integridad(c,base);el('traslado-direccion').value='efectivo-banco';el('traslado-monto').value='20';el('traslado-motivo').value='PRUEBA';
 await c.registrarTrasladoDinero();assert.equal(base.get('sistema/config').saldosDinero.banco,20);
 assert.match(alerts.at(-1),/confirmar|pendiente/i);assert.doesNotMatch(alerts.at(-1),/No se realizó el traslado/);
 bloquearLectura=false;await c.registrarTrasladoDinero();assert.match(alerts.at(-1),/Traslado registrado/);
 assert.equal(base.get('sistema/config').saldosDinero.banco,20);assert.equal([...base.keys()].filter(k=>k.startsWith('movimientos_caja/')).length,1);
 const guardados=[...base].filter(([k])=>k.startsWith('movimientos_caja/')).map(([,v])=>v.id);
 assert.deepEqual(c.movimientosCaja.map(x=>x.id),guardados,'La pantalla usa la referencia original, no un movimiento fantasma generado al reintentar');
 el('traslado-monto').value='10';el('traslado-motivo').value='OTRO';await c.registrarTrasladoDinero();assert.equal(base.get('sistema/config').saldosDinero.banco,30);
});

test('AUD-03: si el servidor ya confirma el resultado, recupera automáticamente la respuesta perdida',async()=>{
 const {c,base,el,alerts}=env();finanzas(c);const native=c.runTransaction;let perder=true;
 c.runTransaction=async(...args)=>{const result=await native(...args);if(perder){perder=false;throw Error('Respuesta perdida');}return result;};
 integridad(c,base);el('traslado-direccion').value='efectivo-banco';el('traslado-monto').value='20';el('traslado-motivo').value='PRUEBA';
 await c.registrarTrasladoDinero();assert.match(alerts.at(-1),/Traslado registrado/);assert.equal(base.get('sistema/config').saldosDinero.banco,20);assert.equal(el('traslado-monto').value,'');
});

test('AUD-04: el mes comercial es Guatemala aun si el equipo usa UTC',()=>{
 const {c}=env();cargar(c,'getMesAnioFromDate');const ts=Date.parse('2026-11-01T04:00:00Z'),previous=process.env.TZ;
 try{for(const zone of ['UTC','America/Guatemala','Asia/Tokyo']){process.env.TZ=zone;assert.equal(c.getMesAnioFromDate('',ts),'2026-10');}}
 finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('AUD-04: una venta anterior conserva el mes del resumen originalmente contabilizado',()=>{
 const {c}=env();cargar(c,'getMesAnioFromDate');const ts=Date.parse('2026-11-01T04:00:00Z');
 const legacy={fecha:'1/11/2026 04:00',timestamp:ts,resumenMensualContabilizado:true};
 assert.equal(c.getMesAnioFromDate(legacy.fecha,ts,legacy),'2026-11');
 assert.equal(c.getMesAnioFromDate(legacy.fecha,ts,{...legacy,mesContable:'2026-10'}),'2026-10');
});

test('AUD-05: el reintento de una dependencia fallida crea otra descarga y se completa',async()=>{
 const scripts=new Map();let created=0;const c=vm.createContext({console,Promise,Error,clearTimeout,setTimeout,promesasDependencias:{},document:{
  getElementById:id=>scripts.get(id),createElement:()=>({addEventListener(){},remove(){scripts.delete(this.id);}}),head:{appendChild:n=>{scripts.set(n.id,n);created++;}}
 }});cargar(c,'cargarScriptExternoUnaVez');
 const first=c.cargarScriptExternoUnaVez('xlsx-fixture','https://fixture.invalid/excel.js',()=>false);const handled=first.catch(e=>e.message);scripts.get('xlsx-fixture').onerror();assert.match(await handled,/No se pudo cargar/);
 const second=c.cargarScriptExternoUnaVez('xlsx-fixture','https://fixture.invalid/excel.js',()=>true);
 // A caller whose library is now available must settle without waiting for the failed node.
 assert.equal(await second,true);
 let disponible=false;const third=c.cargarScriptExternoUnaVez('xlsx-fixture','https://fixture.invalid/excel.js',()=>disponible);
 assert.equal(created,2);disponible=true;scripts.get('xlsx-fixture').onload();assert.equal(await third,true);
});

test('AUD-06: refrescar finanzas conserva el artículo y cantidad preparados para devolver',()=>{
 const {c,el,line}=env();finanzas(c);c.ventas=[{id:'sale',timestamp:Date.now(),versionCalculo:4,revision:1,ingresoTotal:75,montoCobradoTotal:75,detalleItems:[{...line(4),lineId:'a'},{...line(1),idProd:'p2',lineId:'b',nombre:'OTRO'}]}];
 el('devolucion-venta').value='sale';c.actualizarOpcionesDevolucion();el('devolucion-item').value='1';el('devolucion-cantidad').value='1';
 Object.defineProperty(el('devolucion-item'),'innerHTML',{set(v){this.value='0';},get(){return '';},configurable:true});
 c.renderFinanzasNegocio();assert.equal(el('devolucion-item').value,'1');assert.equal(Number(el('devolucion-cantidad').value),1);
});

test('AUD-07: el historial distingue resumen original y cantidades netas después de devolver',async()=>{
 const {c,base,el,line,alerts}=env();cargar(c,'puedeConsultarFinanzasInteligentes');c.carritoVentas=[line(2)];await c.procesarVentaMultiple();assert.equal(c.ventas.length,1,alerts.join(';'));
 const sale=c.ventas[0];finanzas(c);el('devolucion-venta').value=sale.id;el('devolucion-item').value='0';el('devolucion-cantidad').value='1';el('devolucion-reingresar').checked=true;el('devolucion-metodo').value='efectivo';el('devolucion-motivo').value='PRUEBA';
 await c.registrarDevolucionVenta();const saved=base.get('ventas/'+sale.id);assert.equal(saved.detalleItems[0].qty,1);assert.equal(saved.ingresoTotal,15);
 assert.match(saved.resumenItems,/1x TAZA/);assert.match(saved.resumenItemsOriginal,/2x TAZA/);
});

test('AUD-08: una copia grande informa su tipo de recuperación sin retirar el límite seguro',()=>{
 const {c}=env();vm.runInContext(read('respaldo-negocio.js'),c);const api=c.SubliRespaldoCoreV4;
 const large={colecciones:{inventario:Array.from({length:399},()=>({}))}};assert.equal(api.evaluarRecuperacionCopia(large).automatica,false);
 assert.equal(api.evaluarRecuperacionCopia({colecciones:{inventario:[]}}).automatica,true);
});

test('AUD-09: la escritura administrativa genérica exige Dueño y no altera el inventario de un empleado',async()=>{
 const {c,base}=env();c.currentUserData={id:'employee',rol:'empleado',permisos:{ventas:true,inventario:false}};integridad(c,base);
 await assert.rejects(c.updateDoc(c.doc(c.db,'inventario','p1'),{stock:9}),/Dueño|permiso/);assert.equal(base.get('inventario/p1').stock,10);
});

test('AUD-10: el análisis prefiere la venta vigente y no vuelve a contar una anulada',()=>{
 const {c}=env();cargar(c,'obtenerVentasAnalisis');const now=Date.now();
 const old={id:'sale',timestamp:now,ingresoTotal:30,ganancia:20};c.ventasAnalisis30=[old];c.ventas=[{...old,ingresoTotal:15,ganancia:10,revision:2}];
 assert.equal(c.obtenerVentasAnalisis()[0].ingresoTotal,15);c.ventas[0].anulada=true;assert.equal(c.obtenerVentasAnalisis().filter(v=>!v.anulada).length,0);
});

test('consultar y reconocer un guardado pendiente confirmado no genera escrituras',async()=>{
 const {c,base}=env();let perder=true;const native=c.runTransaction;
 c.runTransaction=async(...args)=>{const result=await native(...args);if(perder){perder=false;throw Error('Red perdida');}return result;};
 const get=c.getDoc;let offline=true;
 c.getDoc=async ref=>{if(offline&&String(ref).startsWith('operaciones_sistema/'))throw Error('Sin red');return get(ref);};
 integridad(c,base);
 // La transacción lee con conexión y pierde solamente la confirmación externa.
 c.runTransaction=c.runTransaction.bind(c);offline=false;
 const opts={tipoOperacion:'traslado_dinero',claveOperacion:'traslado-fixture',soloDueno:true};
 const original=c.getDoc;c.getDoc=async ref=>{if(!perder&&String(ref).startsWith('operaciones_sistema/'))throw Error('Confirmación inaccesible');return original(ref);};
 await assert.rejects(c.runTransaction(c.db,async t=>{const ref=c.doc(c.db,'inventario','p1');await t.get(ref);t.update(ref,{stock:9});return {stock:9};},opts),/Red perdida/);
 c.getDoc=get;const antes=JSON.stringify([...base]);const pendientes=await c.consultarGuardadosPendientesSubli();assert.equal(pendientes.length,1);assert.equal(pendientes[0].confirmada,true);
 await c.reconocerGuardadoConfirmadoSubli(pendientes[0].id);assert.equal(c.listarGuardadosPendientesSubli().length,0);assert.equal(JSON.stringify([...base]),antes);
});

test('un resultado desde caché o de otro actor nunca libera el marcador',async()=>{
 const {c,base}=env();integridad(c,base);
 // Registrar una solicitud pendiente sin respuesta definitiva del servidor.
 const original=c.runTransaction;c.getDoc=async()=>({exists:()=>false,data:()=>null,metadata:{fromCache:true,hasPendingWrites:false}});
 const usuario=c.currentUserData;const session=c.sessionStorage;
 const key='subli_op_pendiente_owner-fixture_owner_fixture';session.setItem(key,JSON.stringify({id:'pending',solicitud:'firma',tipo:'traslado_dinero'}));
 await assert.rejects(c.reconocerGuardadoConfirmadoSubli('pending'),/no confirmó|no se confirmó/i);assert.equal(c.listarGuardadosPendientesSubli().length,1);
 c.currentUserData={...usuario,id:'otro'};assert.equal(c.listarGuardadosPendientesSubli().length,0);
});

test('revisar un guardado solo limpia campos iguales y conserva los que cambió el usuario',()=>{
 const {c,el}=env();c.document.getElementById=id=>id==='main-app'?null:el(id);vm.runInContext(read('operaciones-pendientes.js'),c);
 el('traslado-monto').value='20';el('traslado-motivo').value='NUEVO MOTIVO';el('login-pass').value='PIN VIGENTE';
 c.limpiarCamposOperacionConfirmadaSubli({tipo:'traslado_dinero',campos:{'traslado-monto':'20','traslado-motivo':'MOTIVO ANTERIOR','login-pass':'PIN VIGENTE'}});
 assert.equal(el('traslado-monto').value,'');assert.equal(el('traslado-motivo').value,'NUEVO MOTIVO');assert.equal(el('login-pass').value,'PIN VIGENTE');
});

test('el límite del día y los avisos de préstamos usan Guatemala en cualquier huso',()=>{
 const {c}=env();cargar(c,'inicioDiaLocal');vm.runInContext(read('mejoras-core.js'),c);vm.runInContext(read('profesional-core-v130.js'),c);
 const ts=Date.parse('2026-11-01T04:00:00Z'),previous=process.env.TZ;
 try{for(const zone of ['UTC','America/Guatemala','Asia/Tokyo']){process.env.TZ=zone;const expected=Date.parse('2026-10-31T06:00:00Z');assert.equal(c.inicioDiaLocal(ts),expected);assert.equal(c.SubliMejorasCore.inicioDiaLocal(ts),expected);assert.equal(c.SubliProfesionalCore.inicioDia(ts),expected);}}
 finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('una línea retirada de la venta deja la devolución sin selección incluso tras otro refresco',()=>{
 const {c,el,line}=env();finanzas(c);c.ventas=[{id:'sale',versionCalculo:4,detalleItems:[{...line(2),lineId:'a'},{...line(1),lineId:'b'}]}];
 el('devolucion-venta').value='sale';c.actualizarOpcionesDevolucion();el('devolucion-item').value='1';el('devolucion-cantidad').value='1';
 c.ventas[0].detalleItems.pop();c.actualizarOpcionesDevolucion();c.actualizarOpcionesDevolucion();
 assert.equal(el('devolucion-item').value,'');assert.equal(el('devolucion-cantidad').value,'');
 assert.match(el('devolucion-preview').textContent,/Selecciona/);
});

test('la actualización se bloquea mientras exista un guardado pendiente de confirmar',async()=>{
 const {c,alerts}=env();c.listarGuardadosPendientesSubli=()=>[{id:'pending'}];cargar(c,'forzarActualizacionApp');
 assert.equal(await c.forzarActualizacionApp('1.4.3'),false);assert.match(alerts.at(-1),/operación pendiente/);
});

test('forzar un análisis completo vuelve a consultar y un cambio durante la lectura lo deja incompleto',async()=>{
 const {c,alerts}=env();c.console={...console,warn(){}};c.analisisVentas30Cargando=false;c.analisisVentas30Completo=true;c.ventasAnalisis30=[];c.firmaConfigAnalisis30='anterior';
 let consultas=0,revision=1;
 c.getDoc=async()=>({data:()=>({revisionGlobal:revision}),metadata:{fromCache:false,hasPendingWrites:false}});
 c.query=(...x)=>x;c.where=()=>null;c.orderBy=()=>null;c.limit=()=>null;c.startAfter=()=>null;
 c.getDocs=async()=>{consultas++;return {size:0,docs:[],forEach(){},metadata:{fromCache:false,hasPendingWrites:false}};};
 cargar(c,'cargarVentasAnalisisUltimos30Dias');await c.cargarVentasAnalisisUltimos30Dias(true);
 assert.equal(consultas,1);assert.equal(c.analisisVentas30Completo,true);
 c.getDocs=async()=>{revision++;return {size:0,docs:[],forEach(){},metadata:{fromCache:false,hasPendingWrites:false}};};
 await c.cargarVentasAnalisisUltimos30Dias(true);assert.equal(c.analisisVentas30Completo,false);assert.equal(c.firmaConfigAnalisis30,null);assert.match(alerts.at(-1),/No se completó/);
});

test('devolver una venta antigua revierte el mes originalmente contabilizado y no el mes del equipo actual',async()=>{
 const {c,base,el,line,alerts}=env();cargar(c,'puedeConsultarFinanzasInteligentes');c.carritoVentas=[line(2)];await c.procesarVentaMultiple();
 const sale=c.ventas[0],anterior=base.get('resumen_mensual/2026-10');assert.ok(anterior,alerts.join(';'));
 const legacy={...sale,fecha:'1/11/2026 04:00',timestamp:Date.parse('2026-11-01T04:00:00Z')};delete legacy.mesContable;delete legacy.fechaNegocio;
 base.delete('resumen_mensual/2026-10');base.set('resumen_mensual/2026-11',anterior);base.set('ventas/'+sale.id,legacy);c.ventas=[legacy];
 cargar(c,'getMesAnioFromDate');finanzas(c);el('devolucion-venta').value=sale.id;el('devolucion-item').value='0';el('devolucion-cantidad').value='1';el('devolucion-reingresar').checked=true;el('devolucion-metodo').value='efectivo';el('devolucion-motivo').value='PRUEBA';
 await c.registrarDevolucionVenta();assert.equal(base.get('ventas/'+sale.id).ingresoTotal,15,alerts.join(';'));
 assert.equal(base.get('resumen_mensual/2026-11').totalVendido,15);assert.equal(base.has('resumen_mensual/2026-10'),false);
});

test('reintentar una cotización tras medianoche conserva la solicitud y no crea otro documento',async()=>{
 const {c,base,el,line,alerts}=env();let now=Date.parse('2026-11-01T05:59:00Z');
 c.Date=class extends Date {static now(){return now;}};cargar(c,'puedeConsultarFinanzasInteligentes');cargar(c,'procesarCotizacion');
 const native=c.runTransaction,get=c.getDoc;let perder=true,bloqueada=false;
 c.runTransaction=async(...args)=>{const r=await native(...args);if(perder){perder=false;bloqueada=true;throw Error('Respuesta perdida');}return r;};
 c.getDoc=async ref=>{if(bloqueada&&String(ref).startsWith('operaciones_sistema/'))throw Error('Sin red');return get(ref);};
 integridad(c,base);c.carritoCotizacion=[line(2)];el('cotiza-anticipo').value='0';await c.procesarCotizacion();
 assert.equal(c.carritoCotizacion.length,1,alerts.join(';'));now=Date.parse('2026-11-01T06:01:00Z');bloqueada=false;
 await c.procesarCotizacion();assert.equal([...base.keys()].filter(k=>k.startsWith('cotizaciones/')).length,1);assert.equal(c.carritoCotizacion.length,0,alerts.join(';'));
 assert.equal(c.historialCotizaciones[0].fechaNegocio,'2026-10-31');
});

test('una firma o cuenta Firebase distinta nunca permite reconocer un guardado ajeno',async()=>{
 const {c,base}=env();integridad(c,base);const key='subli_op_pendiente_owner-fixture_owner_fixture';
 c.sessionStorage.setItem(key,JSON.stringify({id:'pending',solicitud:'firma',tipo:'traslado_dinero'}));
 for(const registro of [{solicitud:'otra',usuarioId:'owner',autorUID:'owner-fixture'},{solicitud:'firma',usuarioId:'owner',autorUID:'otro-uid'}]) {
  c.getDoc=async()=>({exists:()=>true,data:()=>registro,metadata:{fromCache:false,hasPendingWrites:false}});
  await assert.rejects(c.reconocerGuardadoConfirmadoSubli('pending'),/No se confirmó/);assert.equal(c.listarGuardadosPendientesSubli().length,1);
 }
});
