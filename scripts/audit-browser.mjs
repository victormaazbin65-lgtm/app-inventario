import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
let playwright;
try { playwright = await import('playwright'); }
catch(error) {
 if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
 playwright = await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')));
}
const root=path.resolve(new URL('..',import.meta.url).pathname);
const mime={'.js':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const target=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!target.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
 try {res.setHeader('Content-Type',mime[path.extname(target)]||'text/plain');res.end(fs.readFileSync(target));}
 catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const pin=createHash('sha256').update('1234').digest('hex');
const mock=`
const f=window.__fixture;
const ordenar=v=>Array.isArray(v)?v.map(ordenar):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordenar(v[k])])):v;
const clone=v=>v===undefined?v:ordenar(JSON.parse(JSON.stringify(v)));
const snapshot=(ref)=>({id:ref.id,exists:()=>f.base.has(ref.path),data:()=>clone(f.base.get(ref.path)),metadata:{fromCache:false,hasPendingWrites:false}});
export const doc=(_,col,id)=>({path:col+'/'+id,id:String(id),type:'doc'});
export const collection=(_,col)=>({path:col,type:'collection'});
export const where=(key,op,value)=>({kind:'where',key,op,value});
export const orderBy=(key,direction='asc')=>({kind:'order',key,direction});
export const limit=n=>({kind:'limit',n});
export const startAfter=ref=>({kind:'cursor',ref});
export const query=(ref,...parts)=>({...ref,parts});
export const getDoc=async ref=>{if(f.failConfirmation&&!f.allowConfirmation&&ref.path.startsWith('operaciones_sistema/'))throw Error('Sin red para confirmar');return snapshot(ref);};
export const getDocs=async ref=>{
 let docs=[...f.base].filter(([k])=>k.split('/')[0]===ref.path).map(([k])=>snapshot({path:k,id:k.split('/')[1]}));
 for(const p of ref.parts||[]) {
  if(p.kind==='where') docs=docs.filter(d=>{const v=d.data()[p.key];return p.op==='>='?v>=p.value:p.op==='<='?v<=p.value:p.op==='>'?v>p.value:p.op==='<'?v<p.value:v===p.value;});
  if(p.kind==='order') docs.sort((a,b)=>{const x=a.data()[p.key],y=b.data()[p.key];return (x<y?-1:x>y?1:a.id.localeCompare(b.id))*(p.direction==='desc'?-1:1);});
  if(p.kind==='cursor') {const i=docs.findIndex(d=>d.id===p.ref.id);docs=docs.slice(i+1);}
  if(p.kind==='limit') docs=docs.slice(0,p.n);
 }
 return {docs,size:docs.length,metadata:{fromCache:false,hasPendingWrites:false},forEach:fn=>docs.forEach(fn)};
};
const emitir=()=>setTimeout(()=>{for(const l of f.listeners)Promise.resolve(l.ref.type==='doc'?snapshot(l.ref):getDocs(l.ref)).then(l.fn);},0);
export const onSnapshot=(ref,options,fn)=>{if(typeof options==='function')fn=options;f.listeners.push({ref,fn});setTimeout(()=>Promise.resolve(ref.type==='doc'?snapshot(ref):getDocs(ref)).then(fn),0);return ()=>{};};
export const runTransaction=async(_,action)=>{f.failConfirmation=false;let writing=false;const queue=[];const t={get:async ref=>{if(writing)throw Error('Lectura después de escribir');return snapshot(ref);},set:(ref,data,opts)=>{writing=true;queue.push({ref,data:clone(data),opts});},update:(ref,data)=>{writing=true;queue.push({ref,data:clone(data),opts:{merge:true}});},delete:ref=>{writing=true;queue.push({ref,deleted:true});}};const result=await action(t);if(f.failBefore && queue.some(q=>q.ref.path===f.failBefore || q.ref.path.startsWith(f.failBefore+'/'))){f.failBefore=null;const e=Error('Rechazo simulado antes del commit');e.code='permission-denied';throw e;}for(const q of queue){if(q.deleted)f.base.delete(q.ref.path);else f.base.set(q.ref.path,q.opts?.merge?{...f.base.get(q.ref.path),...q.data}:q.data);}if(queue.length)emitir();if(f.failAfter && queue.some(q=>q.ref.path.startsWith(f.failAfter+'/'))){f.failAfter=null;f.failConfirmation=true;throw Error('Respuesta perdida después del commit simulado');}return result;};
export const setDoc=(ref,data,opts)=>runTransaction(null,t=>t.set(ref,data,opts));
export const updateDoc=(ref,data)=>runTransaction(null,t=>t.update(ref,data));
export const deleteDoc=ref=>runTransaction(null,t=>t.delete(ref));
export const writeBatch=()=>{const q=[];return {set:(ref,data)=>q.push({ref,data}),commit:async()=>runTransaction(null,t=>q.forEach(x=>t.set(x.ref,x.data)))};};
export const serverTimestamp=()=>Date.now();
export const initializeApp=()=>({});
export const initializeFirestore=()=>({});
export const memoryLocalCache=()=>({});
export const persistentLocalCache=()=>({});
export const persistentMultipleTabManager=()=>({});
export const getAuth=()=>({});
export const onAuthStateChanged=(_,fn)=>setTimeout(()=>fn({uid:'fixture-owner',email:'fixture@example.invalid'}),0);
export const createUserWithEmailAndPassword=async()=>({user:{uid:'fixture-owner'}});
export const signInWithEmailAndPassword=createUserWithEmailAndPassword;
export const sendPasswordResetEmail=async()=>{};
export const signOut=async()=>{};
`;
const browser=await playwright.chromium.launch({headless:true});

let checks=0;
const ownerPin=pin;
async function login(page,pin='1234') {
 await page.locator('#login-pass').fill(pin);await page.locator('#login-pass').press('Enter');
}
async function listo(page) {
 await page.waitForFunction(()=>configuracionUsuariosConfirmada && window.firebaseAuthUser?.uid==='fixture-owner');
}
async function lineas(page) {
 await page.evaluate(()=>{
  const costos=[100,150,200,250,300,180,220,156,200];
  carritoIngresos=costos.map((c,i)=>({tempId:i+1,isNew:true,idOriginal:null,nombre:'PRUEBA AUDITORIA '+(i+1),stock:1,min:0,costoBase:c,costoTotalCompra:c,costoIngresado:c,formaIngreso:'unidad',cantidadComprada:1,contenidoPorCompra:1,unidadId:'pieza',unidadNombre:'Pieza',unidadAbreviatura:'pza',unidadPaso:1,unidadDivisible:false,proveedor:'SIMULADO',nit:'',factura:'',categoria:'OTROS'}));
  document.getElementById('ingreso-transporte-global').value='50.50';renderCarritoIngresos();guardarBorradoresV130();
 });
}
async function cuenta(page,col){return page.evaluate(col=>[...__fixture.base.keys()].filter(k=>k.startsWith(col+'/')).length,col);}
async function revisarIngreso(page) {
 const r=await page.evaluate(()=>{
  const ingresos=[...__fixture.base].filter(([k])=>k.startsWith('ingresos/')).map(([,v])=>v);
  const x=ingresos[0];return {registros:ingresos.length,lineas:x?.items.length,base:x?.items.reduce((t,i)=>t+Math.round(i.costoTotalCompra*100),0),transporte:x?.items.reduce((t,i)=>t+Math.round(i.transporteAsignado*100),0),total:x?.items.reduce((t,i)=>t+Math.round(i.costoTotalConTransporte*100),0),ids:x?.items.map(i=>i.idFinal)};
 });
 assert.equal(r.registros,1);assert.equal(r.lineas,9);assert.equal(r.base,175600);assert.equal(r.transporte,5050);assert.equal(r.total,180650);
 assert.equal(new Set(r.ids).size,9);
 for(const id of r.ids)assert.equal(await page.evaluate(id=>__fixture.base.get('inventario/'+id).stock,id),1);
}
async function escenario(viewport,nombre,accion,{acceso=true,zona='America/Guatemala'}={}) {
 const context=await browser.newContext({viewport,serviceWorkers:'block',timezoneId:zona});
 const page=await context.newPage();const errors=[],dialogs=[],blocked=[];
 page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
 await context.route('**/*',async route=>{
  const url=route.request().url();if(url.startsWith(origin))return route.continue();
  if(url.startsWith('https://www.gstatic.com/firebasejs/10.8.0/'))return route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:mock});
  blocked.push(url);return route.abort();
 });
 await page.addInitScript(({pin})=>{
  const owner={id:'owner',nombre:'Victor',pin,rol:'dueno',permisos:{ventas:true,cotizacion:true,ingreso:true,inventario:true,alertas:true}};
  window.__fixture={listeners:[],base:new Map([
   ['sistema/config',{usuarios:[owner],usuariosRevision:7,revisionGlobal:0,fondos:{costoProducto:100,costoLuzTinta:0,gananciaLibre:100,fondoImpuestos:0},saldosDinero:{efectivo:200,banco:0,inicializado:true},negocio:{nombreNegocio:'SubliCosturas',moneda:'Q',porcentajeSAT:5,authPropietario:{habilitado:true,uid:'fixture-owner',email:'fixture@example.invalid'}},registroCodigosVersion:1,categorias:['OTROS']}],
   ['inventario/p1',{id:'p1',nombre:'TAZA',stock:10,min:2,costo:5,unidadId:'pieza',codigoInventario:'1001',categoria:'OTROS',lastModified:1}],
   ['inventario/srv_creacion_01',{id:'srv_creacion_01',nombre:'CREACIÓN',isService:true,stock:9999,costo:0,unidadId:'servicio'}]
  ])};
 },{pin:ownerPin});
 try {
  await page.goto(origin+'/index.html');await listo(page);
  if(acceso){await login(page);await page.waitForFunction(()=>Boolean(window.guardarBorradoresV130)&&inventario.some(p=>p.id==='p1'));}
  await accion(page,dialogs);
  assert.deepEqual(errors,[],JSON.stringify({nombre,errors,dialogs}));
  assert.equal(blocked.some(u=>/firestore.googleapis|identitytoolkit|securetoken/.test(u)),false,'Nunca debe salir una solicitud de datos reales');
  checks++;console.log(JSON.stringify({escenario:nombre,viewport,resultado:'OK',pageErrors:errors.length,externasBloqueadas:blocked.length}));
 } catch(error) {console.error(JSON.stringify({escenario:nombre,viewport,dialogs,errors}));throw error;}
 finally {await context.close();}
}
try {
for(const viewport of [{width:1365,height:900},{width:393,height:852}]) {
 await escenario(viewport,'auditoría integral: empleado cotiza sin datos internos y Ayuda respeta sus secciones',async(page,dialogs)=>{
  await page.evaluate(async()=>{
   const employee={id:'employee',nombre:'PRUEBA EMPLEADO',pin:await hashPIN('2468'),rol:'empleado',permisos:{cotizacion:true,verFinanzas:false}};
   __fixture.base.get('sistema/config').usuarios.push(employee);currentUserData=JSON.parse(JSON.stringify(employee));aplicarPermisos(currentUserData);
   carritoCotizacion=[{tempId:1,idProd:'p1',nombre:'TAZA',qty:2,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];await procesarCotizacion();
  });
  assert.equal(await cuenta(page,'cotizaciones'),1);assert.match(dialogs.at(-1),/30.00/);assert.doesNotMatch(dialogs.at(-1),/GANANCIA LIBRE|GASTOS TOTALES|Costos de Materiales/);
  await page.locator('#v128-ayuda-global').click();assert.equal(await page.locator('#sec-inicio').isVisible(),false);
  assert.equal(await page.evaluate(()=>cambiarPestaña('caja')),false);assert.equal(await page.locator('#sec-caja').isVisible(),false);
 });
 await escenario(viewport,'auditoría integral: análisis usa la venta vigente y descarta su anulación',async page=>{
  const result=await page.evaluate(()=>{
   const old={id:'sale',timestamp:Date.now(),ingresoTotal:30,ganancia:20,costosProductos:10,detalleItems:[]};ventasAnalisis30=[old];ventas=[{...old,ingresoTotal:15,ganancia:10,costosProductos:5,revision:2}];
   const before=analizarSistemaInteligente([],obtenerVentasAnalisis(),{},Date.now());ventas[0].anulada=true;
   return {total:before.resumenHoy.ingreso,utilidad:before.resumenMes.ganancia,despues:analizarSistemaInteligente([],obtenerVentasAnalisis(),{},Date.now()).resumenHoy.operaciones};
  });assert.deepEqual(result,{total:15,utilidad:10,despues:0});
 });
 await escenario(viewport,'auditoría integral: traslado recupera una respuesta confirmada sin duplicar movimientos',async(page,dialogs)=>{
  await page.evaluate(async()=>{document.getElementById('traslado-direccion').value='efectivo-banco';document.getElementById('traslado-monto').value='20';document.getElementById('traslado-motivo').value='PRUEBA';__fixture.allowConfirmation=true;__fixture.failAfter='movimientos_caja';await registrarTrasladoDinero();});
  assert.match(dialogs.at(-1),/Traslado registrado/);assert.equal(await page.evaluate(()=>__fixture.base.get('sistema/config').saldosDinero.banco),20);
  assert.equal(await cuenta(page,'movimientos_caja'),1);assert.equal(await page.locator('#traslado-monto').inputValue(),'');
 });
 await escenario(viewport,'auditoría integral: consultar un guardado pendiente solo lee y limpia campos ya confirmados',async(page,dialogs)=>{
  await page.evaluate(async()=>{document.getElementById('traslado-direccion').value='efectivo-banco';document.getElementById('traslado-monto').value='20';document.getElementById('traslado-motivo').value='PRUEBA';__fixture.failAfter='movimientos_caja';await registrarTrasladoDinero();});
  assert.match(dialogs.at(-1),/confirmar/);const antes=await cuenta(page,'operaciones_sistema');
  await page.evaluate(()=>{__fixture.failConfirmation=false;});await page.locator('#subli-guardados-pendientes button').click();
  await page.waitForFunction(()=>listarGuardadosPendientesSubli().length===0 && document.getElementById('traslado-monto').value==='');
  assert.equal(await page.locator('#traslado-monto').inputValue(),'');assert.equal(await page.evaluate(()=>listarGuardadosPendientesSubli().length),0);
  assert.equal(await cuenta(page,'operaciones_sistema'),antes);assert.equal(await page.evaluate(()=>__fixture.base.get('sistema/config').saldosDinero.banco),20);
 });
 await escenario(viewport,'auditoría integral: consultar de nuevo el análisis completo trae los cambios del servidor',async page=>{
  const r=await page.evaluate(async()=>{
   const id='analysis-fixture';__fixture.base.set('ventas/'+id,{id,timestamp:Date.now(),ingresoTotal:30,ganancia:20});
   await cargarVentasAnalisisUltimos30Dias(true);const primero=ventasAnalisis30.find(v=>v.id===id)?.ingresoTotal;
   __fixture.base.get('ventas/'+id).ingresoTotal=15;
   await cargarVentasAnalisisUltimos30Dias(true);
   return {primero,segundo:ventasAnalisis30.find(v=>v.id===id)?.ingresoTotal,completo:analisisVentas30Completo};
  });assert.deepEqual(r,{primero:30,segundo:15,completo:true});
 });
 await escenario(viewport,'auditoría integral: devolución conserva selección e historial original y neto',async(page,dialogs)=>{
  await page.evaluate(async()=>{
   carritoVentas=[2,1].map((qty,i)=>({tempId:i+1,idProd:'p1',nombre:'TAZA',qty,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}));
   document.getElementById('venta-tipo-cobro').value='contado';document.getElementById('venta-metodo-pago').value='efectivo';await procesarVentaMultiple();cambiarPestaña('caja');
   document.getElementById('devolucion-venta').value=ventas[0].id;actualizarOpcionesDevolucion();document.getElementById('devolucion-item').value='1';document.getElementById('devolucion-cantidad').value='1';renderFinanzasNegocio();
  });
  assert.equal(await page.locator('#devolucion-item').inputValue(),'1');assert.equal(await page.locator('#devolucion-cantidad').inputValue(),'1');
  await page.locator('#sec-caja summary').filter({hasText:'Devolución o reembolso'}).click();
  await page.locator('#devolucion-reingresar').check();await page.locator('#devolucion-motivo').fill('PRUEBA DEVOLUCION');await page.evaluate(()=>registrarDevolucionVenta());
  assert.equal(await cuenta(page,'devoluciones'),1,dialogs.join('\n'));const sale=await page.evaluate(()=>[...__fixture.base].find(([k])=>k.startsWith('ventas/'))[1]);
  assert.equal(sale.ingresoTotal,30);assert.equal(sale.resumenItems,'2x TAZA');assert.match(sale.resumenItemsOriginal,/2x TAZA.*1x TAZA/);
 });
 await escenario(viewport,'auditoría integral: una dependencia fallida se descarga de nuevo al reintentar',async page=>{
  let intentos=0;await page.route('https://fixture.invalid/auditoria.js',async route=>{intentos++;if(intentos===1)return route.abort();return route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:'window.__auditLibReady=true;'});});
  const primera=await page.evaluate(()=>cargarScriptExternoUnaVez('audit-lib','https://fixture.invalid/auditoria.js',()=>Boolean(window.__auditLibReady)).then(()=>true,()=>false));assert.equal(primera,false);
  await page.evaluate(()=>cargarScriptExternoUnaVez('audit-lib','https://fixture.invalid/auditoria.js',()=>Boolean(window.__auditLibReady)));assert.equal(intentos,2);
 });
 await escenario(viewport,'auditoría integral: una venta en equipo UTC conserva fecha y mes de Guatemala',async(page,dialogs)=>{
  await page.evaluate(async()=>{Date.now=()=>Date.parse('2026-11-01T04:00:00Z');carritoVentas=[{tempId:1,idProd:'p1',nombre:'TAZA',qty:1,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];document.getElementById('venta-tipo-cobro').value='contado';document.getElementById('venta-metodo-pago').value='efectivo';await procesarVentaMultiple();});
  const sale=await page.evaluate(()=>[...__fixture.base].find(([k])=>k.startsWith('ventas/'))?.[1]);assert.ok(sale,dialogs.join('\n'));assert.equal(sale.mesContable,'2026-10');assert.equal(sale.fechaNegocio,'2026-10-31');assert.equal(await page.evaluate(()=>__fixture.base.has('resumen_mensual/2026-10')),true);
 },{zona:'UTC'});
 await escenario(viewport,'Dueño con casillas desactualizadas guarda ingreso, inventario, venta, cotización, finanzas y PIN',async(page,dialogs)=>{
  await page.evaluate(async()=>{
   __fixture.base.get('sistema/config').usuarios[0].permisos={ingreso:false,ventas:false,cotizacion:false,inventario:false,alertas:false,verFinanzas:false};
   carritoIngresos=[{tempId:71,isNew:true,idOriginal:null,nombre:'ARTICULO PRUEBA DUEÑO',stock:3,min:0,costoBase:10,costoTotalCompra:30,costoIngresado:10,formaIngreso:'unidad',cantidadComprada:3,contenidoPorCompra:1,unidadId:'pieza',unidadNombre:'Pieza',unidadAbreviatura:'pza',unidadPaso:1,unidadDivisible:false,proveedor:'SIMULADO',nit:'',factura:'',categoria:'OTROS'}];
   await procesarIngresoMultiple();
  });
  assert.equal(await cuenta(page,'ingresos'),1,dialogs.join('\n'));
  const nuevo=await page.evaluate(()=>[...__fixture.base].find(([k,v])=>k.startsWith('inventario/')&&v.nombre==='ARTICULO PRUEBA DUEÑO')?.[1]);
  assert.equal(nuevo.stock,3);assert.equal(nuevo.costo,10);
  await page.evaluate(()=>{void abrirModalEditar('p1');});
  await page.locator('#pass-input').fill('1234');await page.locator('#btn-pass-confirm').click();
  await page.waitForFunction(()=>document.getElementById('modal-editar').style.display==='flex');
  await page.locator('#edit-min').fill('4');await page.evaluate(()=>guardarEdicionInventario());
  assert.equal(await page.evaluate(()=>__fixture.base.get('inventario/p1').min),4,dialogs.join('\n'));
  await page.evaluate(async()=>{
   carritoVentas=[{tempId:72,idProd:'p1',nombre:'TAZA',qty:2,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];
   document.getElementById('venta-tipo-cobro').value='contado';document.getElementById('venta-metodo-pago').value='efectivo';await procesarVentaMultiple();
   carritoCotizacion=[{tempId:73,idProd:'p1',nombre:'TAZA',qty:1,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];await procesarCotizacion();
   document.getElementById('traslado-direccion').value='efectivo-banco';document.getElementById('traslado-monto').value='10';document.getElementById('traslado-motivo').value='PRUEBA DE ACCESO DEL DUEÑO';await registrarTrasladoDinero();
  });
  assert.equal(await cuenta(page,'ventas'),1);assert.equal(await cuenta(page,'cotizaciones'),1);
  assert.equal(await page.evaluate(()=>__fixture.base.get('inventario/p1').stock),8);
  const saldos=await page.evaluate(()=>__fixture.base.get('sistema/config').saldosDinero);assert.equal(saldos.efectivo,220);assert.equal(saldos.banco,10);
  await page.evaluate(()=>{abrirModalEditarUser('owner');currentUserData.permisos={copiaAntigua:true};});
  await page.locator('#edit-user-pin').fill('4321');await page.locator('#modal-editar-user button[onclick="guardarEdicionUser()"]').click();
  assert.equal(await page.evaluate(()=>currentUserData===null),true);await login(page,'4321');
  assert.equal(await page.evaluate(()=>currentUserData.rol),'dueno');
  for(const tab of ['ingreso','inventario','ventas','cotizacion','alertas','ajustes'])assert.equal(await page.locator('#tab-'+tab).isVisible(),true,tab);
  assert.equal(dialogs.some(d=>/Tus permisos cambiaron|No se actualizó|Error al guardar/.test(d)),false,dialogs.join('\n'));
 });
 await escenario(viewport,'el acceso completo del Dueño sigue rechazando rol o PIN revocados',async(page,dialogs)=>{
  await page.evaluate(async()=>{
   carritoIngresos=[{tempId:74,isNew:true,idOriginal:null,nombre:'PRUEBA RECHAZADA',stock:1,min:0,costoBase:10,costoTotalCompra:10,unidadId:'pieza',proveedor:'SIMULADO',categoria:'OTROS'}];
   __fixture.base.get('sistema/config').usuarios[0].rol='empleado';await procesarIngresoMultiple();
  });
  assert.equal(await cuenta(page,'ingresos'),0);assert.match(dialogs.at(-1),/permisos cambiaron/);
  await page.evaluate(async()=>{
   const servidor=__fixture.base.get('sistema/config').usuarios[0];servidor.rol='dueno';servidor.pin=await hashPIN('4321');await procesarIngresoMultiple();
  });
  assert.equal(await cuenta(page,'ingresos'),0);assert.equal(await page.evaluate(()=>carritoIngresos.length),1);assert.match(dialogs.at(-1),/permisos cambiaron/);
 });
 await escenario(viewport,'PIN propio, PIN anterior rechazado, 9 líneas intactas y un ingreso',async(page,dialogs)=>{
  await lineas(page);
  await page.evaluate(()=>abrirModalEditarUser('owner'));await page.locator('#edit-user-pin').fill('4321');
  await page.locator('#modal-editar-user button[onclick="guardarEdicionUser()"]').click();
  await page.waitForFunction(()=>currentUserData===null);
  assert.equal(await page.locator('#main-app').isVisible(),false);
  await login(page,'1234');assert.match(dialogs.at(-1),/incorrecto/);
  await login(page,'4321');assert.equal(await page.locator('#main-app').isVisible(),true);
  assert.equal(await page.evaluate(()=>carritoIngresos.length),9);assert.equal(await page.locator('#ingreso-transporte-global').inputValue(),'50.50');
  await page.evaluate(()=>procesarIngresoMultiple());await revisarIngreso(page);
  await page.evaluate(()=>procesarIngresoMultiple());await revisarIngreso(page);
 });
 await escenario(viewport,'rechazo remoto de PIN preserva credenciales y lista',async(page,dialogs)=>{
  await lineas(page);await page.evaluate(()=>{__fixture.failBefore='sistema/config';abrirModalEditarUser('owner');});
  await page.locator('#edit-user-pin').fill('4321');await page.locator('#modal-editar-user button[onclick="guardarEdicionUser()"]').click();
  assert.match(dialogs.at(-1),/No se actualizó/);assert.equal(await page.evaluate(()=>currentUserData.pin===__fixture.base.get('sistema/config').usuarios[0].pin),true);
  assert.equal(await page.evaluate(()=>carritoIngresos.length),9);assert.equal(await cuenta(page,'ingresos'),0);
 });
 await escenario(viewport,'un snapshot pendiente no autoriza PIN',async(page,dialogs)=>{
  await page.evaluate(()=>{
   configuracionUsuariosConfirmada=false;
   const data=JSON.parse(JSON.stringify(__fixture.base.get('sistema/config')));
   for(const l of __fixture.listeners.filter(l=>l.ref.path==='sistema/config'))l.fn({exists:()=>true,data:()=>data,metadata:{fromCache:false,hasPendingWrites:true}});
  });
  await login(page);assert.equal(await page.evaluate(()=>currentUserData===null && !configuracionUsuariosConfirmada),true);
  assert.match(dialogs.at(-1),/Firebase confirme/);
 },{acceso:false});
 await escenario(viewport,'conflicto de revisión rechaza sobrescribir otro dispositivo',async(page,dialogs)=>{
  await page.evaluate(()=>{__fixture.base.get('sistema/config').usuariosRevision=8;abrirModalEditarUser('owner');});
  await page.locator('#edit-user-nombre').fill('CAMBIO NO CONFIRMADO');await page.locator('#modal-editar-user button[onclick="guardarEdicionUser()"]').click();
  assert.match(dialogs.at(-1),/Otro dispositivo/);assert.equal(await page.evaluate(()=>__fixture.base.get('sistema/config').usuarios[0].nombre),'Victor');
 });
 await escenario(viewport,'ingreso sin permiso se bloquea; permiso otorgado permite ingresar',async(page,dialogs)=>{
  await lineas(page);
  await page.evaluate(async()=>{
   const empleado={id:'e',nombre:'Empleado',pin:await hashPIN('5555'),rol:'empleado',permisos:{ventas:true,ingreso:false,cotizacion:true}};
   __fixture.base.get('sistema/config').usuarios.push(empleado);usuarios.push(copiarDatos(empleado));currentUserData=copiarDatos(empleado);
   await procesarIngresoMultiple();
  });
  assert.equal(await cuenta(page,'ingresos'),0);assert.match(dialogs.at(-1),/permiso para ingreso/);assert.equal(await page.evaluate(()=>carritoIngresos.length),9);
  await page.evaluate(async()=>{const e=__fixture.base.get('sistema/config').usuarios[1];e.permisos.ingreso=true;currentUserData=copiarDatos(e);await procesarIngresoMultiple();});
  await revisarIngreso(page);
 });
 await escenario(viewport,'respuesta perdida del ingreso se recupera sin duplicarlo',async(page,dialogs)=>{
  await lineas(page);await page.evaluate(async()=>{__fixture.failAfter='ingresos';await procesarIngresoMultiple();});
  assert.equal(await cuenta(page,'ingresos'),1);assert.equal(await page.evaluate(()=>carritoIngresos.length),9);assert.match(dialogs.at(-1),/No se pudo confirmar/);
  await page.evaluate(()=>procesarIngresoMultiple());await revisarIngreso(page);assert.equal(await page.evaluate(()=>carritoIngresos.length),0);
 });
 await escenario(viewport,'una respuesta anterior no descarta una lista cambiada',async(page,dialogs)=>{
  await lineas(page);await page.evaluate(async()=>{__fixture.failAfter='ingresos';await procesarIngresoMultiple();carritoIngresos[0].stock=2;await procesarIngresoMultiple();});
  assert.equal(await cuenta(page,'ingresos'),1);assert.equal(await page.evaluate(()=>carritoIngresos[0].stock),2);assert.match(dialogs.at(-1),/anterior sin confirmación/);
 });
 await escenario(viewport,'recuperar el borrador conserva copia y transporte al recargar',async(page)=>{
  await lineas(page);await page.reload();await listo(page);await login(page);
  await page.waitForFunction(()=>Boolean(window.restaurarBorradorV130));await page.evaluate(()=>restaurarBorradorV130('ingreso'));
  assert.equal(await page.evaluate(()=>carritoIngresos.length),9);assert.equal(await page.locator('#ingreso-transporte-global').inputValue(),'50.50');
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.endsWith('_owner_ingreso')&&JSON.parse(localStorage.getItem(k)).items.length===9)),true);
  assert.equal(await cuenta(page,'ingresos'),0);
 });
 await escenario(viewport,'venta, cotización y conversión conservan stock, caja e historiales',async(page)=>{
  await page.evaluate(async()=>{
   carritoVentas=[{tempId:1,idProd:'p1',nombre:'TAZA',qty:2,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];
   document.getElementById('venta-tipo-cobro').value='contado';document.getElementById('venta-metodo-pago').value='efectivo';await procesarVentaMultiple();
   carritoCotizacion=[{tempId:2,idProd:'p1',nombre:'TAZA',qty:1,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];await procesarCotizacion();
  });
  assert.equal(await page.evaluate(()=>__fixture.base.get('inventario/p1').stock),8);assert.equal(await page.evaluate(()=>__fixture.base.get('sistema/config').saldosDinero.efectivo),230);
  assert.equal(await cuenta(page,'ventas'),1);assert.equal(await cuenta(page,'cotizaciones'),1);
  await page.evaluate(async()=>{
   const c=[...__fixture.base].find(([k])=>k.startsWith('cotizaciones/'))[1];
   cargarCotizacionEnFormularioVenta(c,c.id,versionCotizacion(c));await procesarVentaMultiple();
  });
  assert.equal(await page.evaluate(()=>__fixture.base.get('inventario/p1').stock),7);assert.equal(await page.evaluate(()=>__fixture.base.get('sistema/config').saldosDinero.efectivo),245);assert.equal(await cuenta(page,'ventas'),2);
  assert.equal(await page.evaluate(()=>Boolean([...__fixture.base].find(([k])=>k.startsWith('cotizaciones/'))[1].convertidaEnVentaId)),true);
 });
 await escenario(viewport,'una venta con respuesta perdida descuenta stock y caja una sola vez',async(page,dialogs)=>{
  await page.evaluate(async()=>{
   carritoVentas=[{tempId:1,idProd:'p1',nombre:'TAZA',qty:2,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];
   document.getElementById('venta-tipo-cobro').value='contado';document.getElementById('venta-metodo-pago').value='efectivo';__fixture.failAfter='ventas';await procesarVentaMultiple();
  });
  assert.equal(await cuenta(page,'ventas'),1);assert.match(dialogs.at(-1),/No se pudo confirmar/);assert.equal(await page.evaluate(()=>carritoVentas.length),1);
  await page.evaluate(()=>procesarVentaMultiple());assert.equal(await cuenta(page,'ventas'),1);
  assert.equal(await page.evaluate(()=>__fixture.base.get('inventario/p1').stock),8);assert.equal(await page.evaluate(()=>__fixture.base.get('sistema/config').saldosDinero.efectivo),230);
 });
 await escenario(viewport,'cambiar el rol propio exige PIN y aplica los nuevos permisos',async(page,dialogs)=>{
  await page.evaluate(async()=>{
   document.getElementById('nuevo-user-nombre').value='SEGUNDO DUEÑO';document.getElementById('nuevo-user-pin').value='9999';document.getElementById('nuevo-user-rol').value='dueno';await crearUsuario();abrirModalEditarUser('owner');
  });
  await page.locator('#edit-user-rol').selectOption('empleado');await page.locator('#edit-perm-ingreso').uncheck();await page.locator('#edit-perm-finanzas').check();
  await page.locator('#modal-editar-user button[onclick="guardarEdicionUser()"]').click();
  assert.equal(await page.evaluate(()=>currentUserData===null),true);await login(page);
  assert.equal(await page.evaluate(()=>currentUserData.rol),'empleado');assert.equal(await page.locator('#tab-ingreso').isVisible(),false);assert.equal(await page.evaluate(()=>__fixture.base.get('sistema/config').usuarios[0].permisos.verFinanzas),true);assert.equal(dialogs.some(d=>/edición principal se guardó/.test(d)),false);
  await lineas(page);await page.evaluate(()=>procesarIngresoMultiple());assert.equal(await cuenta(page,'ingresos'),0);assert.match(dialogs.at(-1),/permiso para ingreso/);
 });
 await escenario(viewport,'un cambio de PIN no entrega el carrito pendiente a otro usuario',async(page,dialogs)=>{
  await page.evaluate(async()=>{
   document.getElementById('nuevo-user-nombre').value='OTRO USUARIO';document.getElementById('nuevo-user-pin').value='9999';document.getElementById('nuevo-user-rol').value='dueno';await crearUsuario();
  });
  await lineas(page);await page.evaluate(()=>abrirModalEditarUser('owner'));await page.locator('#edit-user-pin').fill('4321');
  await page.locator('#modal-editar-user button[onclick="guardarEdicionUser()"]').click();await login(page,'9999');
  assert.equal(await page.locator('#main-app').isVisible(),false);assert.match(dialogs.at(-1),/operación pendiente del usuario anterior/);
  await login(page,'4321');assert.equal(await page.evaluate(()=>carritoIngresos.length),9);assert.equal(await page.locator('#ingreso-transporte-global').inputValue(),'50.50');
 });
 await escenario(viewport,'una respuesta perdida de cotización no la duplica',async(page,dialogs)=>{
  await page.evaluate(async()=>{carritoCotizacion=[{tempId:2,idProd:'p1',nombre:'TAZA',qty:1,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];__fixture.failAfter='cotizaciones';await procesarCotizacion();});
  assert.equal(await cuenta(page,'cotizaciones'),1);assert.match(dialogs.at(-1),/No se pudo confirmar/);
  await page.evaluate(()=>procesarCotizacion());assert.equal(await cuenta(page,'cotizaciones'),1);assert.equal(await page.evaluate(()=>carritoCotizacion.length),0);
 });
}
console.log(`Auditoría de navegador: ${checks} escenarios correctos; Firebase simulado y solicitudes externas bloqueadas.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
