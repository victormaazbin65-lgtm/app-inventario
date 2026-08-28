import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const coreSource = leer('negocio-core.js');
const gestionSource = leer('gestion-negocio.js');

function crearEntorno({ uidServidor = 'uid-dueno', permiso = true } = {}) {
  const elementos = new Map();
  const elemento = (id, extra = {}) => {
    const valor = { id, style: {}, value: '', textContent: '', ...extra };
    elementos.set(id, valor);
    return valor;
  };
  elemento('login-screen');
  elemento('main-app');
  elemento('auth-login-panel');
  elemento('pin-login-panel');
  elemento('btn-cambiar-cuenta');
  elemento('auth-login-email', { value: 'dueno@ejemplo.com' });
  elemento('auth-login-password', { value: 'secreto123' });
  elemento('auth-login-estado');
  elemento('login-nombre-negocio');
  elemento('config-auth-estado');
  elemento('btn-activar-auth');

  let recargas = 0;
  let cierres = 0;
  const contexto = {
    console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error, Promise,
    navigator: { onLine: true },
    document: {
      title: '',
      getElementById: id => elementos.get(id) || null,
      querySelectorAll: () => []
    },
    location: { reload: () => { recargas += 1; } },
    addEventListener: () => {},
    alert: () => {},
    confirm: () => true,
    currentUserData: null,
    configuracionNegocio: {},
    fondos: { costoProducto: 0, costoLuzTinta: 0, gananciaLibre: 0, fondoImpuestos: 0 },
    saldosDinero: { efectivo: 0, banco: 0, inicializado: true },
    anticipos: [], clientes: [], ventas: [], inventario: [],
    cambiarLabelCosto: () => {},
    numeroFinito: valor => Number(valor) || 0,
    escaparHTML: valor => String(valor ?? ''),
    normalizarTexto: valor => String(valor ?? ''),
    busquedaInteligente: () => true,
    comprobarIngresoInicialLibre: () => {},
    firebaseAuth: {},
    db: {},
    doc: (...partes) => partes.join('/'),
    firebaseAuthUser: null,
    firebaseSignIn: async (_auth, email) => {
      const user = { uid: uidServidor, email };
      contexto.firebaseAuthUser = user;
      return { user };
    },
    firebaseSignOut: async () => {
      cierres += 1;
      contexto.firebaseAuthUser = null;
    },
    getDoc: async () => {
      if (!permiso) {
        const error = new Error('Missing or insufficient permissions.');
        error.code = 'permission-denied';
        throw error;
      }
      return {
        exists: () => true,
        data: () => ({
          negocio: {
            nombreNegocio: 'Negocio protegido',
            authPropietario: { habilitado: true, email: 'dueno@ejemplo.com', uid: uidServidor }
          },
          fondos: { costoProducto: 10, costoLuzTinta: 5, gananciaLibre: 20, fondoImpuestos: 2 }
        })
      };
    }
  };
  contexto.window = contexto;
  vm.createContext(contexto);
  vm.runInContext(coreSource, contexto);
  vm.runInContext(gestionSource, contexto);
  return { contexto, elementos, recargas: () => recargas, cierres: () => cierres };
}

test('un equipo nuevo muestra correo aunque no pueda leer la configuración protegida', () => {
  const { contexto, elementos } = crearEntorno();
  contexto.marcarAccesoFirebaseProtegido();
  assert.equal(contexto.cuentaPropietarioAutorizada(), false);
  assert.equal(elementos.get('auth-login-panel').style.display, 'block');
  assert.equal(elementos.get('pin-login-panel').style.display, 'none');
  assert.match(elementos.get('auth-login-estado').textContent, /correo y la contraseña del Dueño/);

  contexto.confirmarAccesoFirebaseDisponible();
  assert.equal(contexto.cuentaPropietarioAutorizada(), true);
  assert.equal(elementos.get('auth-login-panel').style.display, 'none');
  assert.equal(elementos.get('pin-login-panel').style.display, 'block');
});

test('la cuenta propietaria restaura la carga protegida y recarga los listeners', async () => {
  const { contexto, elementos, recargas, cierres } = crearEntorno();
  contexto.marcarAccesoFirebaseProtegido();
  await contexto.iniciarSesionPropietario();
  assert.equal(cierres(), 0);
  assert.equal(recargas(), 1);
  assert.equal(elementos.get('auth-login-password').value, '');
  assert.match(elementos.get('auth-login-estado').textContent, /Cargando la información protegida/);
});

test('una cuenta distinta no obtiene PIN ni datos del negocio', async () => {
  const { contexto, elementos, recargas, cierres } = crearEntorno({ permiso: false });
  contexto.marcarAccesoFirebaseProtegido();
  await contexto.iniciarSesionPropietario();
  assert.equal(cierres(), 1);
  assert.equal(recargas(), 0);
  assert.equal(elementos.get('auth-login-panel').style.display, 'block');
  assert.equal(elementos.get('pin-login-panel').style.display, 'none');
  assert.match(elementos.get('auth-login-estado').textContent, /no corresponde a la cuenta propietaria/);
});
