import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');
const coreSource = leer('asistente-core.js');
const ajustesSource = leer('asistente-ajustes-v127.js');
const uiSource = leer('mejoras-v127.js');
const bootstrap = leer('visual-preferences.js');
const sw = leer('sw.js');

const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error, JSON });
vm.runInContext(coreSource, contexto);
vm.runInContext(ajustesSource, contexto);
const asistente = contexto.SubliAsistenteCore;

test('la disponibilidad de préstamo respeta ubicación y protege SAT', () => {
  const d = asistente.calcularDisponibilidadPrestamo(
    { efectivo:500, banco:2000 },
    { costoProducto:200, costoLuzTinta:100, gananciaLibre:150, fondoImpuestos:250 }
  );
  assert.equal(d.efectivo, 500);
  assert.equal(d.banco, 2000);
  assert.equal(d.disponibleSinSAT, 450);
  assert.equal(d.satProtegido, 250);
  assert.equal(d.maximoEfectivo, 450);
  assert.equal(d.maximoBanco, 450);
});

test('el préstamo se rechaza antes de confirmar si supera el saldo del origen', () => {
  const r = asistente.validarPrestamoLocal(
    700,
    'efectivo',
    { efectivo:500, banco:2000 },
    { costoProducto:1000, costoLuzTinta:0, gananciaLibre:0, fondoImpuestos:0 }
  );
  assert.equal(r.ok, false);
  assert.equal(r.razon, 'ubicacion');
  assert.equal(r.saldoOrigen, 500);
});

test('el préstamo se rechaza si solo alcanzaría tocando el fondo SAT', () => {
  const r = asistente.validarPrestamoLocal(
    400,
    'efectivo',
    { efectivo:1000, banco:0 },
    { costoProducto:100, costoLuzTinta:50, gananciaLibre:50, fondoImpuestos:800 }
  );
  assert.equal(r.ok, false);
  assert.equal(r.razon, 'sat');
  assert.equal(r.maximo, 200);
});

test('el asistente reconoce guías de préstamo, ingreso, SAT y crédito', () => {
  assert.equal(asistente.buscarAyuda('registrar prestamo').coincidencia.id, 'prestamo_registrar');
  assert.equal(asistente.buscarAyuda('devolver prestamo').coincidencia.id, 'prestamo_devolver');
  assert.equal(asistente.buscarAyuda('como ingresar producto').coincidencia.id, 'ingreso_producto');
  assert.equal(asistente.buscarAyuda('donde cambiar porcentaje sat').coincidencia.id, 'sat');
  assert.equal(asistente.buscarAyuda('venta a credito').coincidencia.id, 'venta_credito');
});

test('tolera preguntas naturales sobre registrar o regresar préstamos', () => {
  assert.equal(asistente.responderConsulta('¿Cómo registro un préstamo?', {}).id, 'prestamo_registrar');
  assert.equal(asistente.responderConsulta('¿Cómo regreso un préstamo?', {}).id, 'prestamo_devolver');
  assert.equal(asistente.responderConsulta('¿Dónde anoto que me devolvieron lo prestado?', {}).id, 'prestamo_devolver');
});

test('las consultas de datos existentes se delegan al analizador anterior', () => {
  assert.equal(asistente.responderConsulta('ventas de hoy', {}).tipo, 'delegar');
  assert.equal(asistente.responderConsulta('cuanto hay en caja', {}).tipo, 'delegar');
  assert.equal(asistente.responderConsulta('que debo surtir', {}).tipo, 'delegar');
  assert.equal(asistente.responderConsulta('productos sin codigo', {}).tipo, 'delegar');
});

test('el asistente puede resumir préstamos pendientes sin escribir datos', () => {
  const r = asistente.responderConsulta('quien me debe prestamos pendientes', {
    ahora: new Date(2026, 8, 7, 12).getTime(),
    prestamos: [
      { persona:'ANA', saldoPendiente:100, vencimiento:'2026-09-06', estado:'pendiente' },
      { persona:'LUIS', saldoPendiente:50, vencimiento:'2026-09-09', estado:'pendiente' },
      { persona:'PAGADO', saldoPendiente:0, vencimiento:'2026-09-01', estado:'pagado' }
    ]
  });
  assert.equal(r.tipo, 'prestamos_pendientes');
  assert.equal(r.prestamos.length, 2);
  assert.equal(r.prestamos[0].persona, 'ANA');
  assert.equal(r.prestamos[0].dias, -1);
});

test('la interfaz v1.2.7 reutiliza las operaciones existentes y solo agrega ayuda/presentación', () => {
  assert.match(uiSource, /registrarPrestamo/);
  assert.match(uiSource, /ejecutarConsultaInteligente/);
  assert.match(uiSource, /renderPanelInteligente/);
  assert.match(uiSource, /renderFinanzasNegocio/);
  assert.match(uiSource, /Prestado desde:/);
  assert.match(uiSource, /Máximo prestable sin tocar SAT/);
  assert.doesNotMatch(coreSource, /setDoc|updateDoc|runTransaction/);
  assert.doesNotMatch(ajustesSource, /setDoc|updateDoc|runTransaction/);
  assert.doesNotMatch(uiSource, /setDoc|updateDoc|runTransaction/);
});

test('la PWA carga y cachea los módulos del asistente sin alterar la versión contable', () => {
  assert.match(bootstrap, /asistente-core\.js/);
  assert.match(bootstrap, /asistente-ajustes-v127\.js/);
  assert.match(bootstrap, /mejoras-v127\.js/);
  assert.match(sw, /'\.\/asistente-core\.js'/);
  assert.match(sw, /'\.\/asistente-ajustes-v127\.js'/);
  assert.match(sw, /'\.\/mejoras-v127\.js'/);
  assert.match(sw, /sublicosturas-v1\.2\.5/);
});
