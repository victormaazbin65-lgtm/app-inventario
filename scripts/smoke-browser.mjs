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
const clone=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
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
export const runTransaction=async(_,action)=>{let writing=false;const queue=[];const t={get:async ref=>{if(writing)throw Error('Lectura después de escribir');return snapshot(ref);},set:(ref,data,opts)=>{writing=true;queue.push({ref,data:clone(data),opts});},update:(ref,data)=>{writing=true;queue.push({ref,data:clone(data),opts:{merge:true}});},delete:ref=>{writing=true;queue.push({ref,deleted:true});}};const result=await action(t);for(const q of queue){if(q.deleted)f.base.delete(q.ref.path);else f.base.set(q.ref.path,q.opts?.merge?{...f.base.get(q.ref.path),...q.data}:q.data);}if(queue.length)emitir();return result;};
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
try {
 for(const viewport of [{width:1365,height:900},{width:393,height:852}]) {
  const context=await browser.newContext({viewport,serviceWorkers:'block',timezoneId:'UTC'});
  const page=await context.newPage();const errors=[],dialogs=[],externas=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
  await context.route('**/*',async route=>{const url=route.request().url();if(url.startsWith(origin))return route.continue();if(url.startsWith('https://www.gstatic.com/firebasejs/10.8.0/'))return route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:mock});externas.push(url);return route.abort();});
  await page.addInitScript(({pin})=>{
   const owner={id:'owner',nombre:'Victor',pin,rol:'dueno',permisos:{}};
   window.__fixture={listeners:[],base:new Map([['sistema/config',{usuarios:[owner],revisionGlobal:0,fondos:{costoProducto:100,costoLuzTinta:0,gananciaLibre:100,fondoImpuestos:0},saldosDinero:{efectivo:200,banco:0,inicializado:true},negocio:{nombreNegocio:'SubliCosturas',moneda:'Q',porcentajeSAT:5,authPropietario:{habilitado:true,uid:'fixture-owner',email:'fixture@example.invalid'}},registroCodigosVersion:1,categorias:['OTROS']}],['inventario/p1',{id:'p1',nombre:'TAZA',stock:10,min:2,costo:5,unidadId:'pieza',codigoInventario:'1001',categoria:'OTROS',lastModified:1}],['inventario/srv_creacion_01',{id:'srv_creacion_01',nombre:'CREACIÓN',isService:true,stock:9999,costo:0,unidadId:'servicio'}]])};
  },{pin});
  await page.goto(origin+'/index.html');
  await page.waitForFunction(()=>typeof configuracionUsuariosConfirmada!=='undefined'&&configuracionUsuariosConfirmada&&window.firebaseAuthUser?.uid==='fixture-owner');
  assert.equal(await page.locator('#main-app').isVisible(),false);assert.equal(await page.evaluate(()=>Boolean(window.SubliProfesionalCore)),false);checks++;
  await page.locator('#login-pass').fill('1234');await page.locator('#login-pass').press('Enter');
  await page.waitForFunction(()=>Boolean(window.guardarCierreV130)&&Boolean(window.renderProfesionalV130)||Boolean(window.guardarCierreV130)&&document.getElementById('v130-cierre-diario'));
  await page.waitForFunction(()=>inventario.some(p=>p.id==='p1'));
  assert.equal(await page.locator('#main-app').isVisible(),true);checks++;
  await page.evaluate(async()=>{carritoVentas=[{tempId:1,idProd:'p1',nombre:'TAZA',qty:2,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza'}];document.getElementById('venta-tipo-cobro').value='contado';document.getElementById('venta-metodo-pago').value='efectivo';await window.procesarVentaMultiple();});
  assert.equal(await page.evaluate(()=>window.__fixture.base.get('inventario/p1').stock),8);assert.equal(await page.evaluate(()=>window.__fixture.base.get('sistema/config').saldosDinero.efectivo),230);checks++;
  await page.evaluate(async()=>{await window.procesarVentaMultiple();});assert.equal(await page.evaluate(()=>window.__fixture.base.get('inventario/p1').stock),8);checks++;
  await page.evaluate(async()=>{currentUserData={...currentUserData,rol:'empleado'};try{await window.updateDoc(window.doc(window.db,'inventario','p1'),{stock:99});}catch(e){window.__fixture.permError=e.message;}});
  assert.match(await page.evaluate(()=>window.__fixture.permError),/permisos cambiaron/);assert.equal(await page.evaluate(()=>window.__fixture.base.get('inventario/p1').stock),8);checks++;
  assert.deepEqual(errors,[],JSON.stringify({errors,dialogs}));checks++;
  console.log(JSON.stringify({viewport,checks:6,pageErrors:errors.length,ultimaAlerta:dialogs.at(-1),externasBloqueadas:externas.length}));
  await context.close();
 }
 console.log(`Smoke de navegador: ${checks} comprobaciones correctas. Firebase simulado; cero conexiones de negocio reales.`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
