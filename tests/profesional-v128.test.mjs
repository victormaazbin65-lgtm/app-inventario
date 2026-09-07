import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const index = leer('index.html');
const visual = leer('visual-preferences.js');
const ui128 = leer('mejoras-v128.js');
const ajuste128 = leer('asistente-ajustes-v128.js');
const sw = leer('sw.js');
const workflow = leer('.github/workflows/tests.yml');
const negocio = leer('negocio-core.js');
const asistente = leer('asistente-core.js');
const ajuste127 = leer('asistente-ajustes-v127.js');

test('los cinco temas son locales, independientes del modelo visual y no escriben datos remotos', () => {
  const visualNormalizado = visual.replace(/\\"/g, '"');
  for (const tema of ['sistema','noche','claro','grafito','contraste']) {
    assert.match(visualNormalizado, new RegExp(`data-tema-visual="${tema}"`));
    assert.match(ui128, new RegExp(`id:'${tema}'`));
  }
  assert.match(visual, /subli_tema_visual_v1/);
  assert.match(ui128, /Tema visual/);
  assert.match(ui128, /Profesional\/Clásico/);
  assert.doesNotMatch(ui128 + ajuste128, /runTransaction|setDoc|updateDoc|addDoc|deleteDoc|Firebase/);
});

test('el tema se carga antes de las mejoras y la PWA conserva todos los módulos necesarios', () => {
  assert.match(visual, /dataset\.temaVisual = temaGuardado\(\)/);
  assert.match(visual, /asistente-ajustes-v128\.js/);
  assert.match(visual, /mejoras-v128\.js/);
  assert.match(sw, /'\.\/asistente-ajustes-v128\.js'/);
  assert.match(sw, /'\.\/mejoras-v128\.js'/);
});

test('el asistente sabe explicar temas y conserva el motor anterior para las demás preguntas', () => {
  const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error, JSON });
  vm.runInContext(asistente, contexto);
  vm.runInContext(ajuste127, contexto);
  vm.runInContext(ajuste128, contexto);
  const core = contexto.SubliAsistenteCore;
  const tema = core.responderConsulta('¿Cómo cambio al tema claro?');
  assert.equal(tema.tipo, 'ayuda');
  assert.match(tema.titulo, /tema/i);
  assert.equal(tema.pestana, 'opciones');
  assert.ok(tema.pasos.length >= 3);
  assert.equal(core.responderConsulta('ventas de hoy').tipo, 'delegar');
});

test('la capacidad de préstamo jamás permite superar ubicación ni fondos sin SAT en 20000 escenarios', () => {
  const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error, JSON });
  vm.runInContext(asistente, contexto);
  const core = contexto.SubliAsistenteCore;
  for (let i = 1; i <= 20000; i++) {
    const efectivo = ((i * 37) % 500000) / 100;
    const banco = ((i * 53) % 700000) / 100;
    const costoProducto = ((i * 71) % 300000) / 100;
    const costoLuzTinta = ((i * 19) % 100000) / 100;
    const gananciaLibre = ((i * 29) % 250000) / 100;
    const fondoImpuestos = ((i * 11) % 80000) / 100;
    const saldos = { efectivo, banco, inicializado:true };
    const fondos = { costoProducto, costoLuzTinta, gananciaLibre, fondoImpuestos };
    const d = core.calcularDisponibilidadPrestamo(saldos, fondos);
    assert.ok(d.maximoEfectivo <= efectivo + 1e-9);
    assert.ok(d.maximoBanco <= banco + 1e-9);
    assert.ok(d.maximoEfectivo <= d.disponibleSinSAT + 1e-9);
    assert.ok(d.maximoBanco <= d.disponibleSinSAT + 1e-9);
    if (d.maximoEfectivo >= 0.01) assert.equal(core.validarPrestamoLocal(d.maximoEfectivo, 'efectivo', saldos, fondos).ok, true);
    if (d.maximoBanco >= 0.01) assert.equal(core.validarPrestamoLocal(d.maximoBanco, 'banco', saldos, fondos).ok, true);
    const excesoEfectivo = Math.round((d.maximoEfectivo + 0.01) * 100) / 100;
    if (excesoEfectivo > Math.min(efectivo, d.disponibleSinSAT) + 1e-9) {
      assert.equal(core.validarPrestamoLocal(excesoEfectivo, 'efectivo', saldos, fondos).ok, false);
    }
  }
});

test('el núcleo monetario sigue rechazando precisión inválida y magnitudes inseguras', () => {
  const contexto = vm.createContext({ console, Math, Number, String, Boolean, Object, Array, Map, Set, Date, Error, JSON });
  vm.runInContext(negocio, contexto);
  const core = contexto.SubliNegocioCore;
  assert.equal(core.normalizarMontoMoneda('10.25'), 10.25);
  assert.throws(() => core.normalizarMontoMoneda('10.251'), /dos decimales/);
  assert.throws(() => core.normalizarMontoMoneda(-1), /negativo/);
  assert.throws(() => core.normalizarMontoMoneda(Infinity), /número válido/);
  assert.throws(() => core.normalizarMontoMoneda(Number.MAX_SAFE_INTEGER), /demasiado grandes/);
});

test('los botones y selectores HTML simples apuntan a funciones que existen en el código cargado', () => {
  const archivosJs = fs.readdirSync(raiz).filter(nombre => nombre.endsWith('.js'));
  const fuentes = [index, ...archivosJs.map(leer)].join('\n').replace(/\\"/g, '"');
  const handlers = new Set();
  const regex = /\bon(?:click|change|input|submit)="\s*([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = regex.exec(fuentes))) handlers.add(m[1]);

  const definidas = new Set();
  for (const match of fuentes.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) definidas.add(match[1]);
  for (const match of fuentes.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)) definidas.add(match[1]);
  for (const match of fuentes.matchAll(/\b(?:global|window)\.([A-Za-z_$][\w$]*)\s*=/g)) definidas.add(match[1]);

  const permitidas = new Set(['alert','confirm','prompt','setTimeout','clearTimeout','parseInt','parseFloat']);
  const faltantes = [...handlers].filter(nombre => !definidas.has(nombre) && !permitidas.has(nombre)).sort();
  assert.deepEqual(faltantes, []);
});

test('todos los archivos locales del APP_SHELL existen y los módulos nuevos son cacheables', () => {
  const entradas = [...sw.matchAll(/^\s*'\.\/([^']+)'/gm)].map(m => m[1]).filter(Boolean);
  const faltantes = entradas.filter(rel => rel !== '' && !fs.existsSync(path.join(raiz, rel)));
  assert.deepEqual(faltantes, []);
  assert.ok(entradas.includes('mejoras-v128.js'));
  assert.ok(entradas.includes('asistente-ajustes-v128.js'));
});

test('la CI usa Node 24 y acciones compatibles con el runtime actual', () => {
  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/setup-node@v5/);
  assert.match(workflow, /node-version:\s*24/);
});

test('la modernización mantiene accesibilidad, reducción de movimiento y ayuda global', () => {
  assert.match(ui128, /focus-visible/);
  assert.match(ui128, /prefers-reduced-motion/);
  assert.match(ui128, /aria-label/);
  assert.match(ui128, /v128-ayuda-global/);
  assert.match(ui128, /Diagnóstico del sistema/);
});
