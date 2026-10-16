import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const copia = valor => JSON.parse(JSON.stringify(valor));

function funcion(nombre, siguiente) {
  const desde = html.indexOf('        ' + nombre);
  const hasta = html.indexOf('        ' + siguiente, desde + nombre.length);
  assert.ok(desde >= 0 && hasta > desde, 'No se pudo extraer ' + nombre);
  return html.slice(desde, hasta);
}

const guardar = funcion('async function guardarUsuarios(', 'function renderUsuarios()');
const editar = funcion('async function guardarEdicionUser()', 'async function borrarUsuario(');
const ingresar = funcion('async function verificarLogin()', 'function comprobarIngresoInicialLibre()');

function entorno({fallar=false, empleados=false}={}) {
  const propietario = {id:'propietario', nombre:'Dueño',pin:'hash-1234',rol:'dueno',permisos:{}};
  const empleado = {id:'empleado', nombre:'Ayudante',pin:'hash-5555',rol:'empleado',permisos:{ingreso:false,ventas:true}};
  const usuarios = empleados ? [propietario,empleado] : [propietario];
  const servidor = {usuarios:copia(usuarios),usuariosRevision:7};
  const elementos = new Map();
  const alertas = [];
  const local = new Map();
  const campos = {
    'edit-user-id':propietario.id,
    'edit-user-nombre':'Dueño',
    'edit-user-pin':'4321',
    'edit-user-rol':'dueno',
    'login-pass':'1234'
  };
  for (const [clave, valor] of Object.entries(campos)) elementos.set(clave,{value:valor,style:{},checked:false});
  for (const permiso of ['ventas','cotizacion','inventario','ingreso','alertas']) elementos.set('edit-perm-'+permiso,{checked:false,style:{},value:''});
  elementos.set('main-app',{style:{display:'block'}});
  elementos.set('login-screen',{style:{display:'none'}});
  const contexto = {
    usuarios,
    currentUserData:usuarios[0], // Reproduce la referencia compartida del fallo anterior.
    usuariosRevision:7,
    configuracionUsuariosConfirmada:true,
    window:{
      db:{},
      doc:(_db,coleccion,id)=>({path:coleccion+'/'+id}),
      subliMarcar(){},
      async runTransaction(_db,callback) {
        let staged;
        const resultado = await callback({
          get:async()=>({exists:()=>true,data:()=>copia(servidor)}),
          update:(_ref, cambios)=>{staged=copia(cambios);}
        });
        // La sesión usada para autorizar tiene que seguir intacta hasta el commit.
        const vigente=servidor.usuarios.find(u=>String(u.id)===String(contexto.currentUserData?.id));
        if(!vigente || vigente.pin!==contexto.currentUserData.pin || vigente.rol!==contexto.currentUserData.rol) {
          throw new Error('Tus permisos cambiaron. Actualiza el acceso antes de registrar otra operación.');
        }
        if(fallar) throw new Error('Fallo simulado antes del commit');
        if(staged) Object.assign(servidor,staged);
        return resultado;
      }
    },
    document:{getElementById(id){
      if(!elementos.has(id)) elementos.set(id,{value:'',style:{},checked:false});
      return elementos.get(id);
    }},
    navigator:{onLine:true},
    localStorage:{setItem:(k,v)=>local.set(k,v)},
    copiarDatos:copia,
    hashPIN:async pin=>'hash-'+pin,
    cuentaPropietarioAutorizada:()=>true,
    actualizarPanelAccesoReal(){},
    aplicarPermisos(){},
    reiniciarTemporizador(){},
    notificarAplicacionActiva(){},
    cerrarModalEditarUser(){},
    renderUsuarios(){},
    alert:message=>alertas.push(message)
  };
  runInNewContext(guardar+'\n'+editar+'\n'+ingresar,contexto);
  return {ctx:contexto,servidor,elementos,alertas,local};
}

test('cambiar el PIN propio mantiene las credenciales anteriores durante la transacción',async()=>{
  const {ctx,servidor,elementos,alertas}=entorno();
  await ctx.guardarEdicionUser();
  assert.equal(servidor.usuarios[0].pin,'hash-4321');
  assert.equal(ctx.usuarios[0].pin,'hash-4321');
  assert.equal(ctx.currentUserData,null,'Exige volver a identificarse tras cambiar PIN');
  assert.equal(elementos.get('login-screen').style.display,'flex');
  assert.match(alertas.at(-1),/PIN vigente/);
});

test('si falla guardar el nuevo PIN, conserva la sesión y los usuarios originales',async()=>{
  const {ctx,servidor,elementos,alertas}=entorno({fallar:true});
  await ctx.guardarEdicionUser();
  assert.equal(servidor.usuarios[0].pin,'hash-1234');
  assert.equal(ctx.usuarios[0].pin,'hash-1234');
  assert.equal(ctx.currentUserData.pin,'hash-1234');
  assert.equal(elementos.get('main-app').style.display,'block');
  assert.match(alertas.at(-1),/No se actualizó el usuario/);
});

test('editar permisos de un empleado no altera la sesión autenticada del dueño',async()=>{
  const {ctx,servidor,elementos}=entorno({empleados:true});
  elementos.get('edit-user-id').value='empleado';
  elementos.get('edit-user-nombre').value='Ayudante';
  elementos.get('edit-user-pin').value='';
  elementos.get('edit-user-rol').value='empleado';
  elementos.get('edit-perm-ingreso').checked=true;
  await ctx.guardarEdicionUser();
  assert.equal(servidor.usuarios[1].permisos.ingreso,true);
  assert.equal(ctx.currentUserData.pin,'hash-1234');
  assert.equal(elementos.get('main-app').style.display,'block');
});

test('un PIN local no inicia sesión hasta que Firebase confirme los usuarios',async()=>{
  const {ctx,elementos,alertas}=entorno();
  ctx.currentUserData=null;
  ctx.configuracionUsuariosConfirmada=false;
  await ctx.verificarLogin();
  assert.equal(ctx.currentUserData,null);
  assert.equal(elementos.get('main-app').style.display,'block'); // No mostrar el formulario como autenticación nueva.
  assert.match(alertas.at(-1),/Espera a que Firebase confirme/);
  ctx.configuracionUsuariosConfirmada=true;
  await ctx.verificarLogin();
  assert.equal(ctx.currentUserData.pin,'hash-1234');
  assert.notEqual(ctx.currentUserData,ctx.usuarios[0], 'No debe compartir la referencia editable');
  assert.equal(elementos.get('main-app').style.display,'block');
});
