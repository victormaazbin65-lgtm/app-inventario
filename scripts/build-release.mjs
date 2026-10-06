import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
if(!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Versión de entrega inválida');
const publicVersion = JSON.parse(fs.readFileSync(path.join(root,'version.json'))).version;
const info = JSON.parse(fs.readFileSync(path.join(root,'build-info.json')));
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw = fs.readFileSync(path.join(root,'sw.js'),'utf8');
const visual = fs.readFileSync(path.join(root,'visual-preferences.js'),'utf8');
if(publicVersion !== version || info.build !== version || info.basePublica !== version
    || !html.includes(`const APP_VERSION = "${version}"`)
    || !sw.includes(`const RELEASE = '${version}'`)
    || !visual.includes(`./assets/${version}/`)) throw Error('La versión del paquete, app, PWA y módulos debe coincidir antes de construir.');
for(const match of html.matchAll(/(?:src=["']|import\(["'])(\.\/assets\/([^/]+)\/[^"']+)/g)) {
    if(match[2] !== version) throw Error(`La app apunta a un módulo de otra versión: ${match[1]}`);
}
const folder = path.join(root, 'assets', version);
fs.mkdirSync(folder, { recursive:true });
const files = fs.readdirSync(root).filter(n => n.endsWith('.js') && n !== 'sw.js').sort();
const manifest = { version, files:{} };
for(const file of files) {
    const source = fs.readFileSync(path.join(root, file));
    const destination = path.join(folder, file);
    let published = false;
    try { execFileSync('git', ['cat-file','-e',`origin/main:assets/${version}/${file}`], { cwd:root, stdio:'ignore' }); published = true; } catch {}
    if(published) {
        const previous = execFileSync('git', ['show',`origin/main:assets/${version}/${file}`], { cwd:root });
        if(!previous.equals(source)) throw Error(`La versión ${version} ya está publicada. Incrementa la versión antes de cambiar ${file}.`);
    }
    fs.writeFileSync(destination, source);
    manifest.files[file] = crypto.createHash('sha256').update(source).digest('hex');
}
fs.writeFileSync(path.join(folder, 'manifest.sha256.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(`Entrega ${version}: ${files.length} módulos con rutas inmutables.`);
