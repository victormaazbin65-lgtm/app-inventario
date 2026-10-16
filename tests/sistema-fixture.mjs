import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
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
 c.runTransaction=async(_,f)=>{let writing=false;const ops=[];const r=await f({get:async ref=>{assert.equal(writing,false,'read after write');return c.getDoc(ref);},set:(ref,data,opts)=>{writing=true;ops.push(['set',ref,clone(data),opts]);},update:(ref,data)=>{writing=true;ops.push(['set',ref,clone(data),{merge:true}]);},delete:ref=>{writing=true;ops.push(['delete',ref]);}});for(const [op,ref,data,opts]of ops){if(op==='delete')base.delete(ref);else base.set(ref,opts?.merge?{...base.get(ref),...data}:data);}return r;};
 const line=(qty=2)=>({idProd:'p1',nombre:'TAZA',qty,precioCobrado:15,costoBase:5,rol:'principal',unidadId:'pieza',unidadAbreviatura:'pza'});
 el('venta-tipo-cobro').value='contado';el('venta-metodo-pago').value='efectivo';
 c.inventario=[clone(base.get('inventario/p1'))];
 return {c,base,el,alerts,line,clone};
}

export {env,extract,read,html,vm,assert,webcrypto};
