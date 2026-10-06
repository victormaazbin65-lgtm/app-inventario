import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
const source = file => fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const clone = data => data === undefined ? undefined : JSON.parse(JSON.stringify(data));
function entorno() {
 const base = new Map([['sistema/config',{usuarios:[{id:'owner',pin:'hash',rol:'dueno'}],revisionGlobal:0,saldosDinero:{efectivo:200,banco:0}}],['inventario/p1',{id:'p1',stock:10,costo:5}]]);
 const session = new Map(); const state = {fallaDespues:false,reintentar:false};
 const c = vm.createContext({console,crypto:webcrypto,Date,Math,JSON,Map,Set,setTimeout,navigator:{onLine:true},db:{},currentUserData:{id:'owner',pin:'hash',rol:'dueno',nombre:'Victor'},firebaseAuthUser:{uid:'uid'},sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)}});
 c.window=c;
 c.doc = (_,col,id)=>({path:col+'/'+id}); c.collection=(_,col)=>({path:col});
 c.getDoc = async ref=>({exists:()=>base.has(ref.path),data:()=>clone(base.get(ref.path)),metadata:{fromCache:false,hasPendingWrites:false}});
 c.runTransaction = async (_,fn)=>{
  let queue=[],escribiendo=false;
  const tx = {get:async ref=>{assert.equal(escribiendo,false);return c.getDoc(ref);},set:(ref,data,opts)=>{escribiendo=true;queue.push({tipo:'set',ref,data:clone(data),opts});},update:(ref,data)=>{escribiendo=true;queue.push({tipo:'set',ref,data:clone(data),opts:{merge:true}});},delete:ref=>{escribiendo=true;queue.push({tipo:'delete',ref});}};
  if(state.reintentar) {await fn(tx);queue=[];escribiendo=false;state.reintentar=false;}
  const resultado = await fn(tx);
  for(const e of queue) {if(e.tipo==='delete')base.delete(e.ref.path);else base.set(e.ref.path,e.opts?.merge?{...base.get(e.ref.path),...e.data}:e.data);}
  if(state.fallaDespues) {state.fallaDespues=false;throw Error('Respuesta perdida después del commit');}
  return resultado;
 };
 vm.runInContext(source('negocio-core.js'),c);
 vm.runInContext(source('integridad-firebase.js'),c);c.instalarIntegridadFirebase();
 return {c,base,state,session};
}
function vender(c) {return async t=>{const ref=c.doc(c.db,'inventario','p1');const s=await t.get(ref);const p={...s.data(),stock:s.data().stock-2};t.set(ref,p);return {stock:p.stock};};}
test('el commit incluye operación, revisión y bitácora; conserva campos de caja',async()=>{
 const {c,base}=entorno();const result=await c.runTransaction(c.db,vender(c));assert.equal(result.stock,8);assert.equal(base.get('inventario/p1').stock,8);
 assert.equal(base.get('sistema/config').revisionGlobal,1);assert.equal(base.get('sistema/config').saldosDinero.efectivo,200);
 const audit=[...base].find(([k])=>k.startsWith('auditoria_sistema/'))[1];assert.equal(audit.usuarioNombre,'Victor');assert.equal(audit.operaciones[0].antes.stock,10);assert.equal(audit.operaciones[0].despues.stock,8);assert.doesNotMatch(JSON.stringify(audit),/hash|pin/);
});
test('un error antes del commit no cambia documentos ni fondos',async()=>{
 const {c,base}=entorno();const inicial=JSON.stringify([...base]);await assert.rejects(c.runTransaction(c.db,async t=>{t.set(c.doc(c.db,'inventario','p1'),{stock:0});throw Error('fallo validación');}),/fallo validación/);assert.equal(JSON.stringify([...base]),inicial);
});
test('un reintento tras perder la respuesta del commit no duplica el movimiento',async()=>{
 const {c,base,state}=entorno();const accion=vender(c);state.fallaDespues=true;await assert.rejects(c.runTransaction(c.db,accion),/Respuesta perdida/);assert.equal(base.get('inventario/p1').stock,8);
 const result=await c.runTransaction(c.db,accion);assert.equal(result.stock,8);assert.equal(base.get('inventario/p1').stock,8);assert.equal(base.get('sistema/config').revisionGlobal,1);assert.equal([...base.keys()].filter(k=>k.startsWith('operaciones_sistema/')).length,1);
});
test('los reintentos internos de Firestore no duplican la bitácora',async()=>{
 const {c,base,state}=entorno();state.reintentar=true;await c.runTransaction(c.db,vender(c));assert.equal(base.get('inventario/p1').stock,8);assert.equal([...base.keys()].filter(k=>k.startsWith('auditoria_sistema/')).length,1);
});
for(const [nombre,cambiar]of [['rol revocado',c=>c.currentUserData.rol='empleado'],['usuario eliminado',c=>c.currentUserData.id='otro'],['sin PIN activo',c=>c.currentUserData=null],['permisos revocados',c=>c.currentUserData.permisos={ventas:true}]]) {
 test(nombre+' impide el commit aunque la pantalla esté desactualizada',async()=>{const {c,base}=entorno();cambiar(c);const inicial=JSON.stringify([...base]);await assert.rejects(c.runTransaction(c.db,vender(c)),/permisos cambiaron|Ingresa con tu PIN/);assert.equal(JSON.stringify([...base]),inicial);});
}
test('mantenimiento bloquea escrituras y no crea bitácoras engañosas',async()=>{const {c,base}=entorno();base.get('sistema/config').mantenimiento={activo:true};await assert.rejects(c.runTransaction(c.db,vender(c)),/recuperación/);assert.equal(base.get('inventario/p1').stock,10);});
test('una revisión corrupta falla cerrada antes de escribir',async()=>{const {c,base}=entorno();base.get('sistema/config').revisionGlobal='invalido';await assert.rejects(c.runTransaction(c.db,vender(c)),/revisión.*inválida/);assert.equal(base.get('inventario/p1').stock,10);});
test('rechaza lecturas posteriores a escritura y lotes demasiado grandes',async()=>{
 const {c,base}=entorno();await assert.rejects(c.runTransaction(c.db,async t=>{t.set(c.doc(c.db,'inventario','p1'),{});await t.get(c.doc(c.db,'inventario','p1'));}),/lecturas deben terminar/);
 await assert.rejects(c.runTransaction(c.db,t=>{for(let i=0;i<431;i++)t.set(c.doc(c.db,'inventario','p'+i),{stock:1});}),/demasiadas escrituras/);assert.equal(base.get('inventario/p1').stock,10);
});
test('las escrituras administrativas conservan autor y cambios en bitácora',async()=>{const {c,base}=entorno();await c.updateDoc(c.doc(c.db,'inventario','p1'),{stock:9});assert.equal(base.get('inventario/p1').costo,5);const a=[...base].find(([k])=>k.startsWith('auditoria_sistema/'))[1];assert.equal(a.operaciones[0].antes.stock,10);assert.equal(a.operaciones[0].despues.stock,9);});
test('fecha comercial de Guatemala no cambia con el huso del equipo',()=>{const {c}=entorno();const core=c.SubliNegocioCore;assert.equal(core.fechaDiaNegocio(Date.parse('2026-10-06T05:59:59Z')),'2026-10-05');assert.equal(core.fechaDiaNegocio(Date.parse('2026-10-06T06:00:00Z')),'2026-10-06');assert.equal(core.rangoDiaNegocio('2026-10-06').inicio,Date.parse('2026-10-06T06:00:00Z'));assert.throws(()=>core.rangoDiaNegocio('2026-02-30'));});
test('flujo de caja usa la fecha del pago y no suma dos veces anticipos o traslados',()=>{
 const {c}=entorno();const a=100,b=200;
 const r=c.SubliNegocioCore.resumirFlujoCaja([{timestamp:50,tipo:'venta_cobrada',monto:100},{timestamp:150,tipo:'abono_credito',monto:50},{timestamp:151,tipo:'anticipo_recibido',monto:20},{timestamp:152,tipo:'traslado',monto:20},{timestamp:153,tipo:'reembolso_devolucion',monto:15},{timestamp:154,tipo:'desconocido',monto:2},{tipo:'venta_cobrada',monto:100}],a,b);
 assert.equal(r.entradas,70);assert.equal(r.salidas,15);assert.equal(r.neto,55);assert.equal(r.sinClasificar,1);
});
test('la restauración compara el estado revisado y revierte todo ante concurrencia',async()=>{
 const {c,base}=entorno();c.exigirDueno=()=>true;vm.runInContext(source('respaldo-negocio.js'),c);
 const api=c.SubliRespaldoCoreV4;const plan={configFirma:JSON.stringify(base.get('sistema/config')),documentos:new Map([['inventario/p1',JSON.stringify(base.get('inventario/p1'))]])};
 base.get('inventario/p1').stock=9;const inicial=JSON.stringify([...base]);await assert.rejects(api.escribirOperacionesEnLotes([{ref:c.doc(c.db,'inventario','p1'),data:{stock:10}}],plan,'restore'),/Cambió inventario/);assert.equal(JSON.stringify([...base]),inicial);
});
test('la restauración pequeña es atómica y las grandes se cancelan antes de escribir',async()=>{
 const {c,base}=entorno();c.exigirDueno=()=>true;vm.runInContext(source('respaldo-negocio.js'),c);const api=c.SubliRespaldoCoreV4;
 await assert.rejects(api.escribirOperacionesEnLotes(Array.from({length:401},()=>({})),{},'r'),/supera 400/);
 const plan={configFirma:JSON.stringify(base.get('sistema/config')),documentos:new Map([['inventario/p1',JSON.stringify(base.get('inventario/p1'))]])};await api.escribirOperacionesEnLotes([{ref:c.doc(c.db,'inventario','p1'),data:{stock:10,costo:5}}],plan,'restore');assert.equal(base.get('restauraciones_sistema/restore').estado,'aplicada');assert.equal(base.get('sistema/config').revisionGlobal,1);
});

test('una edición conserva al creador original y registra al editor por separado',async()=>{
 const {c,base}=entorno();base.set('ventas/v1',{id:'v1',ingresoTotal:30,creadoPorId:'primero',creadoPorNombre:'Ana',creadoPorRol:'empleado'});
 await c.runTransaction(c.db,async t=>{const ref=c.doc(c.db,'ventas','v1');await t.get(ref);t.set(ref,{id:'v1',ingresoTotal:35});});
 const venta=base.get('ventas/v1');assert.equal(venta.creadoPorNombre,'Ana');assert.equal(venta.editadoPorNombre,'Victor');assert.equal(venta.ingresoTotal,35);
});
test('las páginas del período completo incluyen más de 50 registros',async()=>{
 const {c}=entorno();let pagina=0;const rows=Array.from({length:121},(_,i)=>({id:String(i),data:()=>({timestamp:100+i,ingresoTotal:1})}));
 c.query=(ref,...p)=>({ref,p});c.where=(...p)=>p;c.orderBy=(...p)=>p;c.limit=n=>n;c.startAfter=ref=>ref;
 c.getDocs=async()=>({metadata:{fromCache:false,hasPendingWrites:false},docs:pagina++===0?rows.slice(0,100):rows.slice(100)});
 const r=await c.leerRangoConfirmadoSubli(['ventas'],100,500);assert.equal(r.ventas.length,121);assert.equal(pagina,2);
});
test('una consulta de período falla si la configuración cambia entre páginas',async()=>{
 const {c,base}=entorno();c.query=ref=>ref;c.where=()=>{};c.orderBy=()=>{};c.limit=()=>{};
 c.getDocs=async()=>{base.get('sistema/config').revisionGlobal++;return {metadata:{fromCache:false,hasPendingWrites:false},docs:[]};};
 await assert.rejects(c.leerRangoConfirmadoSubli(['ventas'],100,200),/cambiaron durante la consulta/);
});

test('editar un registro histórico sin autor no inventa un creador nuevo',async()=>{
 const {c,base}=entorno();base.set('ventas/legacy',{id:'legacy',ingresoTotal:10});
 await c.updateDoc(c.doc(c.db,'ventas','legacy'),{ingresoTotal:12});
 assert.equal(base.get('ventas/legacy').creadoPorId,null);assert.equal(base.get('ventas/legacy').creadoPorNombre,'Usuario anterior sin registrar');assert.equal(base.get('ventas/legacy').editadoPorNombre,'Victor');
});
