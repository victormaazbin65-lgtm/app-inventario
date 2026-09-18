import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const html = leer('index.html');
const visual = leer('visual-preferences.js');
const gestion = leer('gestion-negocio.js');
const finanzas = leer('finanzas-negocio.js');
const v126 = leer('mejoras-v126.js');
const sw = leer('sw.js');

test('la app no reconstruye la interfaz completa mientras el login mantiene main-app oculto', () => {
  const inicio = html.indexOf('function renderizarTodo()');
  const bloque = html.slice(inicio, inicio + 700);
  assert.match(bloque, /const appPrincipal = document\.getElementById\('main-app'\)/);
  assert.match(bloque, /appPrincipal\.style\.display === 'none'/);
  assert.ok(bloque.indexOf("appPrincipal.style.display === 'none'") < bloque.indexOf('inventario.reduce'));
});

test('el acceso exitoso reactiva el render una sola vez y habilita las capas diferidas', () => {
  assert.match(html, /function notificarAplicacionActiva\(\)/);
  assert.match(html, /dispatchEvent\(new Event\('subli:app-activa'\)\)/);
  assert.match(html, /debouncedEjecucion\('render_post_login'/);
  const llamadas = html.match(/notificarAplicacionActiva\(\);/g) || [];
  assert.equal(llamadas.length, 2);
});

test('las listas financieras pesadas solo se construyen al abrir Caja', () => {
  assert.match(finanzas, /function pestañaCajaActiva\(\)/);
  const inicio = finanzas.indexOf('function renderFinanzasNegocio()');
  const bloque = finanzas.slice(inicio, inicio + 700);
  assert.match(bloque, /renderResumenFinanzasNegocio\(\)/);
  assert.match(bloque, /if \(!pestañaCajaActiva\(\)\) return/);
  assert.ok(bloque.indexOf('if (!pestañaCajaActiva()) return') < bloque.indexOf('renderCreditos()'));
});

test('la lista completa de clientes no se reconstruye fuera de Ajustes > Clientes', () => {
  assert.match(gestion, /function clientesGestionVisibles\(\)/);
  assert.match(gestion, /if \(clientesGestionVisibles\(\)\) renderGestionClientes\(false\)/);
  assert.match(gestion, /dataset\.firmaClientes/);
});

test('el resumen v1.2.7 espera a que la aplicación esté visible', () => {
  assert.match(v126, /function appPrincipalVisibleV126\(\)/);
  assert.match(v126, /if\(!appPrincipalVisibleV126\(\)\) return/);
  assert.match(v126, /subli:app-activa/);
});

test('los módulos profesionales se cargan después del acceso y en tiempo ocioso', () => {
  assert.match(visual, /entornoGlobal\.addEventListener\?\.\('subli:app-activa', cargarMejoras\)/);
  assert.match(visual, /requestIdleCallback/);
  assert.match(visual, /mejorasBaseListas = true/);
  assert.match(visual, /function cargarProfesionalV130\(\)/);
});

test('la actualización 1.2.7 fuerza archivos nuevos sin tocar los datos locales', () => {
  assert.match(html, /const APP_VERSION = "1\.2\.7"/);
  assert.match(html, /chart\.js@4\.5\.1/);
  assert.deepEqual(JSON.parse(leer('version.json')), { version: '1.2.7' });
  assert.equal(JSON.parse(leer('package.json')).version, '1.2.7');
  assert.match(sw, /sublicosturas-v1\.2\.7-ligera-20260918-1/);
  assert.doesNotMatch(sw, /localStorage\.clear|indexedDB\.deleteDatabase/);
});
