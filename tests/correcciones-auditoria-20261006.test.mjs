import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const results=[];
function extract(name,source=html){
 const re=new RegExp('(?:async\\s+)?function\\s+'+name+'\\(');
 const start=source.search(re); assert.ok(start>=0,name);
 const brace=start+source.slice(start).search(/\)\s*\{/)+source.slice(start).match(/\)\s*\{/)[0].length-1;
 let n=0; for(let i=brace;i<source.length;i++){if(source[i]==='{')n++;if(source[i]==='}'&&--n===0)return source.slice(start,i+1);}throw Error(name);
}
function env(){
 const els=new Map(), alerts=[];let seq=0;
 const el=id=>{if(!els.has(id))els.set(id,{value:'',checked:false,style:{},dataset:{},textContent:'',innerHTML:'',remove(){},dispatchEvent(){}});return els.get(id);};
 const c=vm.createContext({console,Date,Math,Number,JSON,Map,Set,Object,Array,String,Error,Boolean,parseInt,setTimeout,clearTimeout,TextEncoder,crypto:webcrypto,Blob,URL,
  Event:class{constructor(type){this.type=type;}},navigator:{onLine:true},document:{getElementById:el,querySelectorAll:()=>[]},alert:m=>alerts.push(m),confirm:()=>true,
  isProcessingTransaction:false,currentUserData:{id:'owner',nombre:'Victor',rol:'dueno'},
  carritoVentas:[],carritoCotizacion:[],carritoIngresos:[],inventario:[],ventas:[],ventasCreditoPendiente:[],historialCotizaciones:[],historialIngresos:[],historialRetiros:[],movimientosCaja:[],clientes:[],anticipos:[],prestamos:[],devoluciones:[],perdidasInventario:[],
  ventaEnEdicion:null,ventaEdicionVersion:null,cotizacionOrigenVentaId:null,cotizacionOrigenVentaVersion:null,cotizacionBorradorOrigenId:null,cotizacionBorradorVersion:null,ingresoEnEdicion:null,
  generarIDSeguro:()=>String(++seq),guardarDatos(){},actualizarUI(){},renderCarritoVentas(){},renderCarritoCotizacion(){},renderHistorialCotizaciones(){},actualizarCamposCobroVenta(){},renderCarritoIngresos(){},renderHistorialIngresos(){},cerrarModalEditar(){},
  saldoCreditoCalculadoCliente:()=>0,totalAnticiposCliente:()=>0,totalAnticiposPendientes:()=>0,exigirDueno:()=>true,
  getMesAnioFromDate:()=> '2026-10',formatearMesAnio:()=> 'Octubre 2026',fechaHoraNegocio:()=> '5/10/2026',dineroNegocio:v=>'Q '+Number(v).toFixed(2)
 });
 c.window=c;c.global=c;c.db={};c.addEventListener=()=>{};c.dispatchEvent=()=>{};
 vm.runInContext(read('negocio-core.js'),c);c.core=c.SubliNegocioCore;
 const names=['prepararIndiceProductoEnTransaccion','escribirIndiceProducto','copiarDatos','numeroFinito','redondear','aCentavos','desdeCentavos','aMilesimas','desdeMilesimas','normalizarCantidadServicio','calcularDesgloseFinanciero','calcularCostoPromedioPonderado','contarArticulosVenta','aplicarVentaAResumen','fusionarPorId','versionCotizacion','normalizarDetalleRetiro','procesarVentaMultiple','guardarEdicionInventario','normalizarCategoriaCodigo','esCodigoInventarioValido','normalizarEstadoCodigosInventario','incorporarCodigosExistentes','asegurarBloqueCategoria','asignarSiguienteCodigoInventario','crearRegistroCodigoInventario','reservarCodigoInventarioEnTransaccion','escribirReservasInventario','procesarIngresoMultiple','editarIngreso','borrarProducto','calcularDesgloseRetiroInteligente'];
 c.TAMANO_BLOQUE_CATEGORIA=1000;c.PRIMER_BLOQUE_CATEGORIA=1000;c.MAX_PRODUCTOS_POR_BLOQUE=999;
 for(const n of names)vm.runInContext(extract(n),c);
 c.configuracionNegocio=c.core.normalizarConfiguracionNegocio({});
 c.unidadProducto=p=>c.core.obtenerUnidad(p.unidadId,c.configuracionNegocio);
 c.validarCantidadProducto=(v,p)=>c.core.normalizarCantidad(v,c.unidadProducto(p));
 c.fondos=c.core.normalizarFondos({costoProducto:100,gananciaLibre:100});
 c.saldosDinero={efectivo:200,banco:0,inicializado:true};
 const base=new Map([['sistema/config',{fondos:c.fondos,saldosDinero:c.saldosDinero,registroCodigosVersion:1}],['inventario/p1',{id:'p1',nombre:'TAZA',stock:10,min:0,costo:5,ventasTotales:0,unidadId:'pieza',categoria:'OTROS',lastModified:1}]]);
 const clone=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
 c.doc=(_,col,id)=>col+'/'+id;c.collection=(_,col)=>col;
 c.getDoc=async ref=>({exists:()=>base.has(ref),data:()=>clone(base.get(ref)),metadata:{fromCache:false,hasPendingWrites:false}});
 c.getDocs=async col=>({metadata:{fromCache:false,hasPendingWrites:false},forEach:cb=>{for(const [k,v]of base)if(k.startsWith(col+'/'))cb({id:k.slice(col.length+1),data:()=>clone(v)});}});
 c.setDoc=async(ref,data,opts)=>base.set(ref,clone(opts?.merge?{...base.get(ref),...data}:data));
 c.runTransaction=async(_,f)=>{let writing=false;const ops=[];const r=await f({get:async ref=>{assert.equal(writing,false,'read after write');return c.getDoc(ref);},set:(ref,data,opts)=>{writing=true;ops.push(['set',ref,clone(opts?.merge?{...base.get(ref),...data}:data)]);},update:(ref,data)=>{writing=true;ops.push(['set',ref,clone({...base.get(ref),...data})]);},delete:ref=>{writing=true;ops.push(['delete',ref]);}});for(const [op,ref,data]of ops){if(op==='delete')base.delete(ref);else base.set(ref,data);}return r;};
 const line=(qty=2)=>({idProd:'p1',nombre:'TAZA',qty,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza',unidadAbreviatura:'pza'});
 el('venta-tipo-cobro').value='contado';el('venta-metodo-pago').value='efectivo';
 c.inventario=[clone(base.get('inventario/p1'))];
 return {c,base,el,alerts,line,clone};
}
function prove(id,title,fn){ test(id + ' · ' + title, fn); }
await prove('SC-01','Edición abierta sobrescribe una venta recibida por snapshot',async()=>{
 const {c,base,el,clone}=env();
 // Values were captured when stock=10; another device sells 2 and the listener updates inventario.
 for(const [id,val]of Object.entries({'edit-id':'p1','edit-nombre':'TAZA NUEVA','edit-stock':'10','edit-min':'0','edit-tipo-costo':'unitario','edit-costo':'5','edit-proveedor':'PROVEEDOR','edit-unidad':'pieza','edit-categoria':'OTROS'}))el(id).value=val;
 el('edit-id').dataset.versionProducto='1';
 base.set('inventario/p1',{...base.get('inventario/p1'),stock:8,lastModified:2});c.inventario=[clone(base.get('inventario/p1'))];
 await c.guardarEdicionInventario();assert.equal(base.get('inventario/p1').stock,8);
 return {stockAntesDeGuardar:8,stockGuardado:10,unidadesRecreadas:2};
});
await prove('SC-02','Venta interpreta un carrito antiguo con la nueva unidad del servidor',async()=>{
 const {c,base,el,line,alerts}=env();c.carritoVentas=[{...line(1),nombre:'TELA',unidadId:'metro',unidadAbreviatura:'m',costoBase:10,precioCobrado:20}];
 base.set('inventario/p1',{...base.get('inventario/p1'),nombre:'TELA',unidadId:'centimetro',stock:1000,costo:0.10,lastModified:2});
 await c.procesarVentaMultiple();assert.equal(c.ventas.length,0,alerts.join(';'));assert.equal(base.get('inventario/p1').stock,1000);
 return {unidadCarrito:'metro',unidadServidor:'centimetro',cantidadVendida:1,stockFinal:999,costoRegistrado:c.ventas[0]?.costosProductos,stockEsperadoParaUnMetro:900};
});
await prove('SC-03','Una devolución válida queda bloqueada al generar pérdida',async()=>{
 const {c,base,el,line,alerts}=env();c.fondos=c.core.normalizarFondos({});c.saldosDinero={efectivo:0,banco:0,inicializado:true};base.set('sistema/config',{fondos:c.fondos,saldosDinero:c.saldosDinero});
 el('venta-tinta').value='12';c.carritoVentas=[line(2)];await c.procesarVentaMultiple();assert.equal(c.ventas.length,1,alerts.join(';'));
 vm.runInContext(read('finanzas-negocio.js'),c);c.renderFinanzasNegocio=()=>{};
 const v=c.ventas[0];el('devolucion-venta').value=v.id;el('devolucion-item').value='0';el('devolucion-cantidad').value='1';el('devolucion-reingresar').checked=true;el('devolucion-metodo').value='efectivo';el('devolucion-motivo').value='Producto devuelto';
 await c.registrarDevolucionVenta();assert.doesNotMatch(alerts.at(-1),/Repón los fondos/);assert.equal(base.get('ventas/'+v.id).ingresoTotal,15);assert.equal(base.get('sistema/config').saldosDinero.efectivo,15);assert.equal(base.get('ventas/'+v.id).ganancia,-2);
 return {venta:30,costoProducto:10,produccion:12,gananciaAntes:8,reembolsoSolicitado:15,cajaAntes:30,error:alerts.at(-1)};
});
await prove('SC-04','Error de pantalla informa un anticipo fallido ya confirmado',async()=>{
 const {c,base,el,alerts}=env();vm.runInContext(read('finanzas-negocio.js'),c);c.creditosPendientesConfirmados=false;c.monedaNegocio=()=> 'Q';c.escaparHTML=String;c.etiquetaUnidadProducto=(p,q)=>String(q);Object.defineProperty(el('dash-total-caja'),'textContent',{set(){throw Error('Fallo visual simulado');}});
 c.clientes=[{id:'c1',nombreCompleto:'ANA'}];base.set('clientes/c1',c.clientes[0]);el('anticipo-cliente').value='c1';el('anticipo-monto').value='20';el('anticipo-metodo').value='efectivo';el('anticipo-motivo').value='Pedido';
 await c.registrarAnticipoCliente();assert.match(alerts.at(-1),/sí quedó registrad/);assert.match(alerts.at(-1),/Fallo visual simulado/);assert.equal(base.get('sistema/config').saldosDinero.efectivo,220);
 return {anticiposGuardados:[...base.keys()].filter(k=>k.startsWith('anticipos/')).length,efectivo:220,mensaje:alerts.at(-1)};
});
await prove('SC-05','Índice de nombre huérfano bloquea reutilizar un producto eliminado',async()=>{
 const {c,base}=env();vm.runInContext(read('profesional-core-v130.js'),c);c.core=c.SubliProfesionalCore;
 for(const n of ['claveProducto','instalarReservaProductos'])vm.runInContext(extract(n,read('profesional-operaciones-v130.js')),c);
 c.instalarReservaProductos();const key='indices_nombres/producto_'+c.claveProducto(base.get('inventario/p1'));base.set(key,{entidadId:'p1'});
 c.solicitarPassword=async()=> 'PIN';c.esDueno=async()=>true;await c.borrarProducto('p1');assert.ok(!base.has('inventario/p1'));assert.ok(!base.has(key));
 let error='';try{await c.runTransaction(c.db,t=>c.reservarCodigoInventarioEnTransaccion(t,{id:'p2',nombre:'TAZA',categoria:'OTROS'},{},[],2));}catch(e){error=e.message;}assert.equal(error,'');
 return {productoEliminado:true,indiceConservado:key,error};
});
await prove('SC-06','Vaciar un carrito quitando su última línea conserva el borrador viejo',async()=>{
 const {c,line}=env();const mem=new Map();c.localStorage={getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};c.DRAFT_PREFIX='draft_';c.tiposBorradorActivos=new Set();c.capturarCampos=()=>({});
 vm.runInContext(read('profesional-core-v130.js'),c);c.core=c.SubliProfesionalCore;
 for(const n of ['usuarioActual','claveBorrador','guardarBorrador','leerBorrador','borrarBorrador'])vm.runInContext(extract(n,read('profesional-ui-v130.js')),c);
 c.guardarBorrador('ingreso',[line()],'sec-ingreso');c.guardarBorrador('ingreso',[],'sec-ingreso');assert.equal(c.leerBorrador('ingreso'),null);
 return {lineasActuales:0,lineasRecuperablesObsoletas:c.leerBorrador('ingreso')?.items.length || 0};
});
await prove('SC-07','Historial de costos incluye compras anuladas y muestra costo promedio',async()=>{
 const {c}=env();vm.runInContext(read('profesional-core-v130.js'),c);
 const rows=c.SubliProfesionalCore.historialCostos([{timestamp:1,items:[{idFinal:'p1',costoIngresado:8,costoDespues:6,stock:5}]},{timestamp:2,anulada:true,items:[{idFinal:'p1',costoIngresado:50,costoDespues:20,stock:1}]}],'p1');
 assert.equal(rows.length,1);assert.equal(rows[0].costo,8);return {filas:rows,costoCompraAnteriorReal:8,costoMostradoParaCompraAnterior:rows[0].costo};
});
await prove('SC-08','Resumen cobrado asigna un abono a la fecha antigua de la venta',async()=>{
 const {c}=env();vm.runInContext(read('mejoras-core.js'),c);
 const old=new Date(2026,8,1,12).getTime(),today=new Date(2026,9,5,12).getTime();
 const v={timestamp:old,ingresoTotal:100,montoCobradoTotal:100,pagos:[{timestamp:today,monto:100}]};
 const r=c.SubliMejorasCore.resumenVentasRango([v],c.SubliMejorasCore.inicioDiaLocal(today),c.SubliMejorasCore.finDiaLocal(today));assert.equal(r.cobradoVentasPeriodo,0);assert.equal(r.tipoCobrado,'acumulado_ventas_del_periodo');
 return {cobradoRealHoy:100,cobradoMostradoHoy:r.cobrado};
});
await prove('SC-09','Restaurar una copia anterior mezcla saldos viejos con ventas posteriores',async()=>{
 const {c,base,el,alerts}=env();c.document.body={appendChild(){}};c.document.createElement=()=>({style:{},click(){},remove(){}});
 c.writeBatch=()=>{const ops=[];return {set:(ref,data)=>ops.push([ref,data]),commit:async()=>{for(const [ref,data]of ops)base.set(ref,JSON.parse(JSON.stringify(data)));}};};
 vm.runInContext(read('respaldo-negocio.js'),c);
 base.set('inventario/p1',{id:'p1',nombre:'TAZA',stock:8,costo:5});base.set('ventas/posterior',{id:'posterior',ingresoTotal:30,detalleItems:[{idProd:'p1',qty:2}]});
 const backup={formato:'sublicosturas-backup',schemaVersion:4,creadoEnISO:'2026-09-01T00:00:00Z',sistema:{config:{fondos:c.core.normalizarFondos({}),saldosDinero:{efectivo:0,banco:0,inicializado:true}}},colecciones:{inventario:[{id:'p1',data:{id:'p1',nombre:'TAZA',stock:10,costo:5}}],ventas:[]},conteos:{inventario:1,ventas:0}};
 for(const nombre of c.SubliRespaldoCoreV4.COLECCIONES_RESPALDO) {backup.colecciones[nombre] ??= [];backup.conteos[nombre]=backup.colecciones[nombre].length;}
 backup.integridad={algoritmo:'SHA-256',hash:Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(c.SubliRespaldoCoreV4.contenidoFirmable(backup)))).toString('hex')};
 await c.prepararRestauracion({target:{files:[{size:2000,text:async()=>JSON.stringify(backup)}],value:'x'}});
 assert.equal(base.get('inventario/p1').stock,8,alerts.join(';'));assert.ok(base.has('ventas/posterior'));assert.equal(base.get('sistema/config').saldosDinero.efectivo,200);assert.doesNotMatch(alerts.at(-1),/Restauración completada/);
 return {stockAntes:8,stockRestaurado:10,ventaPosteriorConservada:true,efectivoRestaurado:0,mensaje:alerts.at(-1)};
});
await prove('SC-10','La validación admite un respaldo con cantidades ausentes y fondos inválidos',async()=>{
 const {c}=env();vm.runInContext(read('respaldo-negocio.js'),c);
 assert.throws(()=>c.SubliRespaldoCoreV4.validarCopiaSeguridad({formato:'sublicosturas-backup',schemaVersion:3,sistema:{config:{fondos:{gananciaLibre:'incorrecto'}}},colecciones:{inventario:[{id:'p1',data:{nombre:'TAZA'}}],ventas:[{id:'v1',data:{}}]}}),/stock|fondo|total|obligatorio|inválido/);
});
await prove('SC-11','La vista de orden se queda vieja cuando cambia stock del mismo proveedor',async()=>{
 const {c,el}=env();c.firmaOrden='';c.escapar=String;c.proveedorPlan=()=>[{proveedorSurtido:'PROVEEDOR'}];let renders=0;c.renderOrdenCompra=()=>renders++;
 vm.runInContext(extract('actualizarOrdenCompra',read('profesional-operaciones-v130.js')),c);
 c.actualizarOrdenCompra();c.proveedorPlan=()=>[{proveedorSurtido:'PROVEEDOR',cantidadSugerida:50}];c.actualizarOrdenCompra();assert.equal(renders,2);
 return {cambiosDeDatos:2,renderizaciones:1,segundoCambioIgnorado:true};
});
await prove('SC-12','Service worker entrega HTML nuevo y módulo anterior',async()=>{
 const handlers={},responses=[];
 const c=vm.createContext({URL,Response,self:{location:{href:'https://example.test/app/sw.js',origin:'https://example.test'},addEventListener:(n,f)=>handlers[n]=f},caches:{match:async req=>String(req.url||req).endsWith('negocio-core.js')?new Response('MODULO_ANTERIOR'):undefined,open:async()=>({put:async()=>{}})},fetch:async req=>new Response(String(req.url||req).endsWith('index.html')?'HTML_NUEVO':'MODULO_NUEVO')});
 vm.runInContext(read('sw.js'),c);
 for(const [file,mode]of [['index.html','navigate'],['negocio-core.js','cors']]){let p;handlers.fetch({request:{url:'https://example.test/app/'+file,method:'GET',mode},waitUntil:()=>{},respondWith:x=>p=x});responses.push(await (await p).text());}
 assert.deepEqual(responses,['HTML_NUEVO','MODULO_NUEVO']);return {htmlRecibido:responses[0],moduloRecibido:responses[1]};
});
await prove('SC-13','El redondeo del costo de lote puede perder centavos de compra',async()=>{
 const {c}=env();const r=c.SubliNegocioCore.calcularIngresoConvertido(1,30000,100,'total',c.SubliNegocioCore.obtenerUnidad('pieza'));
 assert.equal(r.costoTotalCompra,100);assert.equal(c.SubliNegocioCore.redondearMoneda(r.cantidadBase*r.costoBase+r.residuoCostoTotal),100);return {costoCompra:100,cantidad:30000,costoUnitario:r.costoBase,valorReconstruido:99.99};
});

await prove('SC-14','Cambiar rol remoto conserva el rol viejo en la sesión abierta',async()=>{
 const {c,el}=env();c.usuarios=[{id:'owner',nombre:'Victor',rol:'empleado',pin:'same',permisos:{ventas:false}}];c.currentUserData={id:'owner',nombre:'Victor',rol:'dueno',pin:'same'};c.configuracionUsuariosConfirmada=true;c.cuentaPropietarioAutorizada=()=>true;c.document.querySelector=()=>null;c.aplicarPermisos=()=>{};c.reiniciarTemporizador=()=>{};c.notificarAplicacionActiva=()=>{};
 vm.runInContext(extract('comprobarIngresoInicialLibre'),c);
 // Keep a second owner in the registry, matching the UI rule against removing the last owner.
 c.usuarios.push({id:'other',rol:'dueno',pin:'different'});c.comprobarIngresoInicialLibre();assert.equal(c.currentUserData.rol,'empleado');
 return {rolServidor:'empleado',rolSesion:'dueno',pinSinCambio:true};
});
