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
export const getDoc=async ref=>snapshot(ref);
export const getDocs=async ref=>{
 let docs=[...f.base].filter(([k])=>k.split('/')[0]===ref.path).map(([k])=>snapshot({path:k,id:k.split('/')[1]}));
 for(const p of ref.parts||[]) {
  if(p.kind==='where') docs=docs.filter(d=>{const v=d.data()[p.key];return p.op==='>='?v>=p.value:p.op==='<='?v<=p.value:p.op==='>'?v>p.value:p.op==='<'?v<p.value:v===p.value;});
  if(p.kind==='order') docs.sort((a,b)=>{const x=a.data()[p.key],y=b.data()[p.key];return (x<y?-1:x>y?1:a.id.localeCompare(b.id))*(p.direction==='desc'?-1:1);});
  if(p.kind==='cursor') {const i=docs.findIndex(d=>d.id===p.ref.id);docs=docs.slice(i+1);}
  if(p.kind==='limit') docs=docs.slice(0,p.n);
 }
 return {docs,metadata:{fromCache:false,hasPendingWrites:false},forEach:fn=>docs.forEach(fn)};
};
const emitir=()=>setTimeout(()=>{for(const l of f.listeners)Promise.resolve(l.ref.type==='doc'?snapshot(l.ref):getDocs(l.ref)).then(l.fn);},0);
export const onSnapshot=(ref,options,fn)=>{if(typeof options==='function')fn=options;f.listeners.push({ref,fn});setTimeout(()=>Promise.resolve(ref.type==='doc'?snapshot(ref):getDocs(ref)).then(fn),0);return ()=>{};};
export const runTransaction=async(_,action)=>{let writing=false;const queue=[];const t={get:async ref=>{if(writing)throw Error('Lectura después de escribir');return snapshot(ref);},set:(ref,data,opts)=>{writing=true;queue.push({ref,data:clone(data),opts});},update:(ref,data)=>{writing=true;queue.push({ref,data:clone(data),opts:{merge:true}});},delete:ref=>{writing=true;queue.push({ref,deleted:true});}};const result=await action(t);if(f.failBefore && queue.some(q=>q.ref.path===f.failBefore || q.ref.path.startsWith(f.failBefore+'/'))){f.failBefore=null;const e=Error('Rechazo simulado antes del commit');e.code='permission-denied';throw e;}for(const q of queue){if(q.deleted)f.base.delete(q.ref.path);else f.base.set(q.ref.path,q.opts?.merge?{...f.base.get(q.ref.path),...q.data}:q.data);}if(queue.length)emitir();if(f.failAfter && queue.some(q=>q.ref.path.startsWith(f.failAfter+'/'))){f.failAfter=null;throw Error('Respuesta perdida después del commit simulado');}return result;};
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
async function escenario(viewport,nombre,accion,{acceso=true}={}) {
 const context=await browser.newContext({viewport,serviceWorkers:'block',timezoneId:'America/Guatemala'});
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
  await page.locator('#edit-user-rol').selectOption('empleado');await page.locator('#edit-perm-ingreso').uncheck();
  await page.locator('#modal-editar-user button[onclick="guardarEdicionUser()"]').click();
  assert.equal(await page.evaluate(()=>currentUserData===null),true);await login(page);
  assert.equal(await page.evaluate(()=>currentUserData.rol),'empleado');assert.equal(await page.locator('#tab-ingreso').isVisible(),false);
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
