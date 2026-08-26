import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buscarArchivosInteligente,
  crearEntradaBuscador,
  distanciaEdicionLimitada,
  extensionArchivo,
  normalizarTextoBusqueda,
  puntuarArchivoBuscador
} from '../buscador.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const archivos = [
  crearEntradaBuscador({ nombre: 'Pastor-Aleman-Final.cdr', rutaRelativa: 'Carlos López\\Pachones\\Perros\\Pastor-Aleman-Final.cdr', carpetas: ['Carlos López', 'Pachones', 'Perros'], tamano: 2000, modificado: 30 }),
  crearEntradaBuscador({ nombre: 'Logotipo aniversario.ai', rutaRelativa: 'Clínica San José\\Playeras\\Logotipo aniversario.ai', carpetas: ['Clínica San José', 'Playeras'], tamano: 3000, modificado: 20 }),
  crearEntradaBuscador({ nombre: 'Foto familia.png', rutaRelativa: 'María\\Tazas\\Foto familia.png', carpetas: ['María', 'Tazas'], tamano: 1000, modificado: 10 })
];

test('normaliza acentos, separadores, mouse pad y extensiones', () => {
  assert.equal(normalizarTextoBusqueda('  PACHÓN / José  '), 'pachon jose');
  assert.equal(normalizarTextoBusqueda('Mouse Pad azul'), 'mousepad azul');
  assert.equal(extensionArchivo('diseño.final.CDR'), 'cdr');
  assert.equal(extensionArchivo('SIN_EXTENSION'), '');
});

test('la búsqueda combina cliente, producto, diseño y nombre en cualquier orden', () => {
  assert.deepEqual(buscarArchivosInteligente(archivos, 'pachon perro carlos').map(item => item.nombre), ['Pastor-Aleman-Final.cdr']);
  assert.deepEqual(buscarArchivosInteligente(archivos, 'aniversario playera').map(item => item.nombre), ['Logotipo aniversario.ai']);
  assert.deepEqual(buscarArchivosInteligente(archivos, 'maria taza foto').map(item => item.nombre), ['Foto familia.png']);
  assert.equal(buscarArchivosInteligente(archivos, 'pachon maria').length, 0);
});

test('sinónimos y errores pequeños encuentran la misma ubicación', () => {
  assert.equal(buscarArchivosInteligente(archivos, 'botella canino carlo')[0].nombre, 'Pastor-Aleman-Final.cdr');
  assert.equal(buscarArchivosInteligente(archivos, 'camiseta logotipo')[0].nombre, 'Logotipo aniversario.ai');
  assert.equal(distanciaEdicionLimitada('pachon', 'pacon', 1), 1);
  assert.ok(puntuarArchivoBuscador(archivos[0], 'pastor aleman') > puntuarArchivoBuscador(archivos[0], 'canino'));
});

test('filtra por formato y ordena coincidencias vacías por fecha', () => {
  assert.deepEqual(buscarArchivosInteligente(archivos, '', 'cdr').map(item => item.nombre), ['Pastor-Aleman-Final.cdr']);
  assert.deepEqual(buscarArchivosInteligente(archivos, '').map(item => item.modificado), [30, 20, 10]);
});

test('el módulo es de solo lectura y no contiene operaciones que modifiquen archivos', () => {
  const codigo = leer('buscador.js');
  assert.match(codigo, /showDirectoryPicker\(\{ id: 'sublicosturas-buscador', mode: 'read' \}\)/);
  assert.match(codigo, /Copiar ubicación/);
  assert.match(codigo, /rutaRelativa/);
  assert.doesNotMatch(codigo, /createWritable|removeEntry|getFileHandle\([^)]*create\s*:\s*true|getDirectoryHandle\([^)]*create\s*:\s*true/);
  assert.doesNotMatch(codigo, /firebase|setDoc|updateDoc|deleteDoc|runTransaction/);
});

test('la pestaña está en la navegación principal y Studio externo fue retirado', () => {
  const html = leer('index.html');
  assert.match(html, /id="tab-buscador"[^>]+cambiarPestaña\('buscador'\)/);
  assert.match(html, /id="sec-buscador"/);
  assert.match(html, /script type="module" src="\.\/buscador\.js"/);
  assert.doesNotMatch(html, /href="\.\/studio\/"|Abrir Studio/);
  assert.equal(fs.existsSync(path.join(raiz, 'studio', 'index.html')), false);
});
