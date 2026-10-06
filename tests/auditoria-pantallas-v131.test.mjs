import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const leer = p => fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
const html=leer('index.html');
function funcion(nombre, fuente=html) {
 if(!fuente.includes('function '+nombre+'(')) fuente=leer('gestion-negocio.js');
 const inicio=fuente.search(new RegExp('(?:async )?function '+nombre+'\\('));
 assert.ok(inicio>=0,nombre);
 const args=fuente.indexOf(') {',inicio);
 let llave=args>=0 ? args+2 : fuente.indexOf('{',inicio), n=0;
 // Las funciones probadas usan plantillas con llaves equilibradas.
 for(let i=llave;i<fuente.length;i++){if(fuente[i]==='{')n++; if(fuente[i]==='}'&&--n===0)return fuente.slice(inicio,i+1);}
 throw Error(nombre);
}
function entorno() {
 const elementos=new Map(); const avisos=[]; let seq=0;
 const el=id=>{if(!elementos.has(id))elementos.set(id,{value:'',checked:false,style:{},textContent:'',innerHTML:''});return elementos.get(id);};
 const c=vm.createContext({console,Date,Math,Number,JSON,Map,Set,Object,Array,String,Error,Boolean,parseInt,
  navigator:{onLine:true},document:{getElementById:el},alert:m=>avisos.push(m),confirm:()=>true,
  isProcessingTransaction:false,currentUserData:{id:'owner',nombre:'Victor',rol:'dueno'},
  carritoVentas:[],carritoCotizacion:[],inventario:[],ventas:[],ventasCreditoPendiente:[],historialCotizaciones:[],historialRetiros:[],movimientosCaja:[],clientes:[],anticipos:[],
  ventaEnEdicion:null,ventaEdicionVersion:null,cotizacionOrigenVentaId:null,cotizacionOrigenVentaVersion:null,cotizacionBorradorOrigenId:null,cotizacionBorradorVersion:null,
  generarIDSeguro:()=>String(++seq),guardarDatos(){},actualizarUI(){},renderCarritoVentas(){},renderCarritoCotizacion(){},renderHistorialCotizaciones(){},actualizarCamposCobroVenta(){},
  saldoCreditoCalculadoCliente:()=>0,totalAnticiposCliente:()=>0,
  getMesAnioFromDate:()=> '2026-09', formatearMesAnio:()=> 'Septiembre 2026', fechaHoraNegocio:()=> '27/9/2026',
 });
 c.window=c; c.db={}; c.addEventListener=()=>{};
 vm.runInContext(leer('negocio-core.js'),c); c.core=c.SubliNegocioCore;
 for(const nombre of ['copiarDatos','numeroFinito','redondear','aCentavos','desdeCentavos','aMilesimas','desdeMilesimas','normalizarCantidadServicio','validarCantidadProducto','calcularDesgloseFinanciero','calcularCostoPromedioPonderado','contarArticulosVenta','aplicarVentaAResumen','fusionarPorId','versionCotizacion','normalizarDetalleRetiro','procesarVentaMultiple','procesarCotizacion','procesarRetiro']) vm.runInContext(funcion(nombre),c);
 c.configuracionNegocio=c.SubliNegocioCore.normalizarConfiguracionNegocio({});
 c.unidadProducto=p=>c.SubliNegocioCore.obtenerUnidad(p.unidadId,c.configuracionNegocio);
 c.fondos=c.SubliNegocioCore.normalizarFondos({costoProducto:100,gananciaLibre:100});
 c.saldosDinero={efectivo:200,banco:0,inicializado:true};
 const base=new Map([['sistema/config',{fondos:c.fondos,saldosDinero:c.saldosDinero}],['inventario/p1',{id:'p1',nombre:'TAZA',stock:10,costo:5,ventasTotales:0,unidadId:'pieza'}]]);
 c.doc=(_,col,id)=>col+'/'+id;
 const copiar=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
 c.setDoc=async (ref,data)=>base.set(ref,copiar(data));
 c.runTransaction=async (_,fn)=>{ const pendientes=[]; let escribiendo=false;
  const r=await fn({get:async ref=>{assert.equal(escribiendo,false,'Todas las lecturas preceden a las escrituras');return {exists:()=>base.has(ref),data:()=>copiar(base.get(ref))};},set:(ref,data)=>{escribiendo=true;pendientes.push([ref,copiar(data)]);},update:(ref,data)=>{escribiendo=true;pendientes.push([ref,{...copiar(base.get(ref)),...copiar(data)}]);}});
  for(const [ref,data] of pendientes)base.set(ref,data);return r;
 };
 el('venta-tipo-cobro').value='contado';el('venta-metodo-pago').value='efectivo';
 const linea=(qty=2)=>({idProd:'p1',nombre:'TAZA',qty,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'});
 return {c,base,el,avisos,linea};
}
test('venta confirmada descuenta una sola vez cantidades agregadas y deja huella de stock',async()=>{
 const {c,base,linea,avisos}=entorno();c.carritoVentas=[linea(2),linea(1)];
 await c.procesarVentaMultiple();
 assert.equal(base.get('inventario/p1').stock,7,avisos.join('\n'));
 assert.equal(c.ventas.length,1); assert.equal(c.ventas[0].ingresoTotal,45);
 assert.equal(c.ventas[0].movimientosInventario[0].stockAntes,10);assert.equal(c.ventas[0].movimientosInventario[0].stockDespues,7);
 assert.equal(c.saldosDinero.efectivo,245);assert.equal(c.carritoVentas.length,0);
 await c.procesarVentaMultiple(); assert.equal(base.get('inventario/p1').stock,7);
});
test('stock insuficiente cancela toda la venta y conserva el carrito',async()=>{
 const {c,base,linea,avisos}=entorno(); c.carritoVentas=[linea(11)];const antes=JSON.stringify([...base]);
 await c.procesarVentaMultiple();assert.equal(JSON.stringify([...base]),antes);assert.equal(c.carritoVentas.length,1);assert.match(avisos.join(' '),/Stock insuficiente/);
});
test('cotización no mueve inventario ni dinero; editar actualiza el mismo documento',async()=>{
 const {c,base,linea,avisos}=entorno();c.carritoCotizacion=[linea(2)];await c.procesarCotizacion();
 assert.equal(base.get('inventario/p1').stock,10);assert.equal(base.get('sistema/config').saldosDinero.efectivo,200);
 let quotes=[...base].filter(([k])=>k.startsWith('cotizaciones/')); assert.equal(quotes.length,1,avisos.join('\n'));
 c.cotizacionBorradorOrigenId=quotes[0][1].id;c.cotizacionBorradorVersion=1;c.carritoCotizacion=[linea(3)];await c.procesarCotizacion();
 quotes=[...base].filter(([k])=>k.startsWith('cotizaciones/'));assert.equal(quotes.length,1);assert.equal(quotes[0][1].revision,2);assert.equal(quotes[0][1].ingresoTotal,45);
});
test('convertir cotización descuenta stock y no permite vender el mismo origen otra vez',async()=>{
 const {c,base,linea,avisos}=entorno();base.set('cotizaciones/q1',{id:'q1',revision:3});
 c.cotizacionOrigenVentaId='q1';c.cotizacionOrigenVentaVersion=3;c.carritoVentas=[linea(2)];await c.procesarVentaMultiple();
 assert.equal(base.get('inventario/p1').stock,8,avisos.join('\n'));assert.ok(base.get('cotizaciones/q1').convertidaEnVentaId);
 c.cotizacionOrigenVentaId='q1';c.cotizacionOrigenVentaVersion=3;c.carritoVentas=[linea(2)];await c.procesarVentaMultiple();
 assert.equal(base.get('inventario/p1').stock,8);assert.equal(c.ventas.length,1);assert.match(avisos.at(-1),/ya fue usada/);
});
test('cotización modificada en otro equipo no se vende ni se sobrescribe con un borrador viejo',async()=>{
 const {c,base,linea,avisos}=entorno();base.set('cotizaciones/q1',{id:'q1',revision:4});c.carritoVentas=[linea()];c.cotizacionOrigenVentaId='q1';c.cotizacionOrigenVentaVersion=3;
 await c.procesarVentaMultiple();assert.equal(base.get('inventario/p1').stock,10);assert.match(avisos.at(-1),/cambió en otro/);
 c.carritoCotizacion=[linea()];c.cotizacionBorradorOrigenId='q1';c.cotizacionBorradorVersion=3;await c.procesarCotizacion();assert.equal(base.get('cotizaciones/q1').revision,4);
});
test('venta a crédito descuenta productos, cobra solo el abono y separa deuda',async()=>{
 const {c,base,linea,el,avisos}=entorno();base.set('clientes/c1',{id:'c1',nombreCompleto:'ANA',saldoCredito:0});el('venta-cliente-id').value='c1';el('venta-tipo-cobro').value='credito';el('venta-pago-inicial').value='10';c.carritoVentas=[linea(2)];
 await c.procesarVentaMultiple();assert.equal(base.get('inventario/p1').stock,8,avisos.join('\n'));assert.equal(c.saldosDinero.efectivo,210);assert.equal(c.ventas[0].saldoPendiente,20);assert.equal(base.get('clientes/c1').saldoCredito,20);
});
test('servicios vendidos no descuentan productos físicos',async()=>{
 const {c,base,linea,avisos}=entorno();c.carritoVentas=[{...linea(1),idProd:'servicio',isService:true}];await c.procesarVentaMultiple();assert.equal(c.ventas.length,1,avisos.join('\n'));assert.equal(base.get('inventario/p1').stock,10);assert.equal(c.ventas[0].movimientosInventario.length,0);
});
test('retiro exige motivo, conserva referencia y descuenta caja y fondo exactamente',async()=>{
 const {c,base,avisos}=entorno();assert.equal(await c.procesarRetiro('Ganancia',25,'gananciaLibre'),false);assert.equal(base.get('sistema/config').saldosDinero.efectivo,200);
 assert.equal(await c.procesarRetiro('Ganancia',25,'gananciaLibre',{motivo:'  Compra de hilo  ',referencia:' F-15 '}),true,avisos.join('\n'));
 assert.equal(c.saldosDinero.efectivo,175);assert.equal(c.fondos.gananciaLibre,75);assert.equal(c.historialRetiros[0].motivo,'Compra de hilo');assert.equal(c.movimientosCaja[0].referencia,'F-15');
});
test('retiro sin saldo en el origen conserva íntegra la contabilidad',async()=>{
 const {c,base}=entorno();base.set('sistema/config',{fondos:c.fondos,saldosDinero:{efectivo:0,banco:200,inicializado:true}});
 const antes=JSON.stringify([...base]);assert.equal(await c.procesarRetiro('Ganancia',25,'gananciaLibre',{motivo:'Hilo'}),false);assert.equal(JSON.stringify([...base]),antes);
});
test('los paneles nuevos inician cerrados y el módulo de opciones no escribe datos de negocio',()=>{
 const panels=[...html.matchAll(/<details[^>]*data-pantalla-panel=[^>]*>/g)];assert.ok(panels.length>=20);for(const p of panels)assert.doesNotMatch(p[0],/\sopen(?:\s|=|>)/);
 const ui=leer('pantallas-v131.js');assert.doesNotThrow(()=>new Function(ui));assert.doesNotMatch(ui,/setDoc|runTransaction|setInterval|MutationObserver/);assert.match(ui,/subli-panel-oculto/);
});
test('un fallo visual después de confirmar nunca informa que la venta se canceló',async()=>{
 const {c,base,linea,avisos}=entorno();c.carritoVentas=[linea(2)];c.actualizarUI=()=>{throw Error('Pantalla no disponible');};
 await c.procesarVentaMultiple();assert.equal(base.get('inventario/p1').stock,8);assert.equal(c.carritoVentas.length,0);assert.match(avisos.at(-1),/sí quedó registrada/);assert.doesNotMatch(avisos.at(-1),/No se aplicó/);
});
test('el historial de retiros muestra motivo y referencia escapados y consulta páginas confirmadas',async()=>{
 const {c,el}=entorno();Object.assign(c,{puedeConsultarFinanzasInteligentes:()=>true,retirosCursor:null,retirosHistorialAmpliado:false,retirosMasDisponibles:true,retirosCargando:false,retirosLimiteVista:50,historialCompletoCargado:{retiros:false},guardarDatosParcial(){},formatearDesgloseRetiro:()=>''});
 for(const n of ['normalizarTexto','escaparHTML','renderHistorialRetiros','cargarMasRetiros','toggleHistorial'])vm.runInContext(funcion(n),c);
 c.historialRetiros=[{id:'2',monto:10,motivo:'Hilo <script>',referencia:'A & B'}];el('lista-retiros-historial').style.display='none';c.toggleHistorial('lista-retiros-historial');assert.match(el('lista-retiros-historial').innerHTML,/Hilo &lt;script&gt;/);assert.match(el('lista-retiros-historial').innerHTML,/A &amp; B/);
 c.collection=()=> 'retiros';c.orderBy=()=>({order:true});c.limit=()=>({limit:50});c.query=(...args)=>args;c.startAfter=cursor=>({cursor});const doc={id:'1',data:()=>({id:'1',monto:5,motivo:'Anterior'})};c.getDocs=async()=>({metadata:{fromCache:false,hasPendingWrites:false},docs:[doc]});
 await c.cargarMasRetiros();assert.equal(c.historialRetiros.length,2);assert.equal(c.historialCompletoCargado.retiros,true);assert.equal(c.retirosCursor,doc);
 c.historialCompletoCargado.retiros=false;c.retirosLimiteVista=100;c.getDocs=async()=>({metadata:{fromCache:true},docs:[]});await c.cargarMasRetiros();assert.equal(c.historialCompletoCargado.retiros,false);assert.equal(c.historialRetiros.length,2);
});
test('los errores repetidos generan aviso rojo y no crecen sin límite',()=>{
 const memoria=new Map(),nodos=new Map();
 const c=vm.createContext({Date,Math,JSON,String,Number,Array,Error,console,localStorage:{getItem:k=>memoria.get(k),setItem:(k,v)=>memoria.set(k,v)},ERROR_KEY:'errores',renderDiagnosticoErrores(){}});
 c.window=c; c.document={getElementById:id=>nodos.get(id),createElement:()=>({style:{},setAttribute(){}})};
 nodos.set('main-app',{prepend:n=>{nodos.set(n.id,n);nodos.set('subli-error-aviso-texto',{});}});
 vm.runInContext(leer('profesional-core-v130.js'),c);c.core=c.SubliProfesionalCore;
 for(const n of ['leerErrores','guardarErrores','actualizarAvisoErrores','capturarError'])vm.runInContext(funcion(n,leer('profesional-operaciones-v130.js')),c);
 c.capturarError(new Error('classList nulo'),'prueba',{archivo:'index.html',linea:80});c.capturarError(new Error('classList nulo'),'prueba',{archivo:'index.html',linea:80});
 assert.equal(c.leerErrores().length,1);assert.equal(c.leerErrores()[0].repeticiones,2);assert.equal(c.leerErrores()[0].linea,80);assert.equal(nodos.get('subli-error-aviso').hidden,false);assert.match(nodos.get('subli-error-aviso').style.cssText,/#591d2a/);
 memoria.set('subli_errores_vistos_v1',String(Date.now()+1));c.actualizarAvisoErrores();assert.equal(nodos.get('subli-error-aviso').hidden,true);assert.equal(c.leerErrores().length,1);
 for(let i=0;i<40;i++)c.capturarError(new Error('Error '+i),'prueba');assert.equal(c.leerErrores().length,30);
});
test('los borradores preservan el origen de venta, cotización e ingreso al recuperarlos',()=>{
 const {c,linea}=entorno();const memoria=new Map();Object.assign(c,{tiposBorradorActivos:new Set(), DRAFT_PREFIX:'draft_',localStorage:{getItem:k=>memoria.get(k),setItem:(k,v)=>memoria.set(k,v)},capturarCampos:()=>({}),restaurarCampos(){},borrarBorrador(){},cambiarPestaña(){},ingresoEnEdicion:'i-original',carritoIngresos:[]});
 for(const n of ['usuarioActual','claveBorrador','guardarBorrador','restaurarBorrador'])vm.runInContext(funcion(n,leer('profesional-ui-v130.js')),c);
 c.global=c;c.leerBorrador=t=>JSON.parse(memoria.get(c.claveBorrador(t)));c.ventaEnEdicion='v-original';c.ventaEdicionVersion=77;c.cotizacionOrigenVentaId='q-origen';c.cotizacionOrigenVentaVersion=3;c.cotizacionBorradorOrigenId='q-edit';c.cotizacionBorradorVersion=5;
 for(const t of ['ventas','cotizacion','ingreso'])c.guardarBorrador(t,[linea()], 'sec-'+t);
 c.ventaEnEdicion=null;c.cotizacionOrigenVentaId=null;c.cotizacionBorradorOrigenId=null;c.ingresoEnEdicion=null;
 for(const t of ['ventas','cotizacion','ingreso'])c.restaurarBorrador(t);
 assert.equal(c.ventaEnEdicion,'v-original');assert.equal(c.ventaEdicionVersion,77);assert.equal(c.cotizacionOrigenVentaId,'q-origen');assert.equal(c.cotizacionOrigenVentaVersion,3);assert.equal(c.cotizacionBorradorOrigenId,'q-edit');assert.equal(c.cotizacionBorradorVersion,5);assert.equal(c.ingresoEnEdicion,'i-original');
});
