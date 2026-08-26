const DB_NAME = 'sublicosturas-studio';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';
const SETTINGS_STORE = 'settings';
const WORKSPACE_NAME = 'SubliCosturas_Proyectos';

export function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function sanitizeSegment(value, fallback = 'SIN_NOMBRE') {
  let clean = String(value ?? '').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  clean = clean.replace(/[. ]+$/g, '').slice(0, 80);
  if(!clean) clean = fallback;
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
  if(reserved.test(clean)) clean = `_${clean}`;
  return clean;
}

export function makeProjectCode(date = new Date(), randomValue = Math.random()) {
  const pad = value => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const suffix = Math.floor(Math.max(0, Math.min(.999999, randomValue)) * 1296).toString(36).padStart(2, '0').toUpperCase();
  return `PRY-${day}-${time}-${suffix}`;
}

export function makeProjectFolder(project) {
  return sanitizeSegment(`${String(project.createdAt || '').slice(0, 10).replaceAll('-', '')}-${project.code}-${project.design}`, project.code);
}

export function projectSearchScore(project, query = '', filters = {}) {
  const client = normalizeText(project.client);
  const design = normalizeText(project.design);
  const product = normalizeText(project.product);
  const tags = normalizeText((project.tags || []).join(' '));
  const notes = normalizeText(project.notes);
  const files = normalizeText((project.files || []).map(file => file.name).join(' '));
  const code = normalizeText(project.code);
  const filterClient = normalizeText(filters.client);
  const filterDesign = normalizeText(filters.design);
  const filterProduct = normalizeText(filters.product);
  if(filterClient && !client.includes(filterClient)) return -1;
  if(filterDesign && !design.includes(filterDesign)) return -1;
  if(filterProduct && !product.includes(filterProduct)) return -1;

  const normalizedQuery = normalizeText(query);
  if(!normalizedQuery) return 1;
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const combined = `${client} ${design} ${product} ${tags} ${notes} ${files} ${code}`;
  if(!tokens.every(token => combined.includes(token))) return -1;

  let score = 0;
  if(client === normalizedQuery) score += 120;
  else if(client.startsWith(normalizedQuery)) score += 75;
  else if(client.includes(normalizedQuery)) score += 45;
  if(design === normalizedQuery) score += 110;
  else if(design.startsWith(normalizedQuery)) score += 68;
  else if(design.includes(normalizedQuery)) score += 42;
  if(product === normalizedQuery) score += 105;
  else if(product.startsWith(normalizedQuery)) score += 64;
  else if(product.includes(normalizedQuery)) score += 40;
  if(code.includes(normalizedQuery)) score += 90;
  tokens.forEach(token => {
    if(client.includes(token)) score += 18;
    if(design.includes(token)) score += 17;
    if(product.includes(token)) score += 16;
    if(tags.includes(token)) score += 8;
    if(files.includes(token)) score += 6;
    if(notes.includes(token)) score += 3;
  });
  return score || 1;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if(!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      if(!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbRequest(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => reject(transaction.error);
  });
}

const getAllProjects = () => idbRequest(PROJECT_STORE, 'readonly', store => store.getAll());
const saveProject = project => idbRequest(PROJECT_STORE, 'readwrite', store => store.put(project));
const clearProjects = () => idbRequest(PROJECT_STORE, 'readwrite', store => store.clear());
const getSetting = key => idbRequest(SETTINGS_STORE, 'readonly', store => store.get(key));
const saveSetting = (key, value) => idbRequest(SETTINGS_STORE, 'readwrite', store => store.put({ key, value }));

async function verifyPermission(handle, request = false) {
  if(!handle) return false;
  const options = { mode: 'readwrite' };
  if((await handle.queryPermission(options)) === 'granted') return true;
  return request && (await handle.requestPermission(options)) === 'granted';
}

async function getWorkspace(rootHandle, create = true) {
  return rootHandle.getDirectoryHandle(WORKSPACE_NAME, { create });
}

async function getNestedDirectory(root, segments, create = false) {
  let current = root;
  for(const segment of segments) current = await current.getDirectoryHandle(segment, { create });
  return current;
}

async function writeBlob(directory, name, blob) {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return handle;
}

async function uniqueFileName(directory, originalName) {
  const safe = sanitizeSegment(originalName, 'ARCHIVO');
  const dot = safe.lastIndexOf('.');
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const extension = dot > 0 ? safe.slice(dot) : '';
  for(let index = 0; index < 1000; index++) {
    const candidate = index === 0 ? safe : `${base} (${index})${extension}`;
    try {
      await directory.getFileHandle(candidate);
    } catch(error) {
      if(error.name === 'NotFoundError') return candidate;
      throw error;
    }
  }
  throw new Error('Hay demasiados archivos con el mismo nombre.');
}

function publicProject(project) {
  return {
    schemaVersion: 1,
    id: String(project.id), code: String(project.code), client: String(project.client), design: String(project.design),
    product: String(project.product), tags: Array.isArray(project.tags) ? project.tags.map(String) : [], notes: String(project.notes || ''),
    createdAt: String(project.createdAt), updatedAt: String(project.updatedAt), relativePath: Array.isArray(project.relativePath) ? project.relativePath.map(String) : [],
    files: Array.isArray(project.files) ? project.files.map(file => ({ name: String(file.name), size: Number(file.size || 0), type: String(file.type || ''), lastModified: Number(file.lastModified || 0) })) : []
  };
}

async function writeProjectMetadata(directory, project) {
  const contents = JSON.stringify(publicProject(project), null, 2);
  await writeBlob(directory, 'proyecto.json', new Blob([contents], { type: 'application/json' }));
}

let projects = [];
let rootHandle = null;
let pendingFiles = [];
let activeProject = null;
let objectUrls = [];

const dom = typeof document === 'undefined' ? {} : {
  form: document.getElementById('project-form'), client: document.getElementById('client'), design: document.getElementById('design'), product: document.getElementById('product'),
  tags: document.getElementById('tags'), notes: document.getElementById('notes'), files: document.getElementById('files'), fileSummary: document.getElementById('file-summary'),
  chooseFolder: document.getElementById('choose-folder'), folderStatus: document.getElementById('folder-status'), folderDot: document.getElementById('folder-dot'), supportNote: document.getElementById('support-note'),
  search: document.getElementById('search'), filterClient: document.getElementById('filter-client'), filterDesign: document.getElementById('filter-design'), filterProduct: document.getElementById('filter-product'),
  results: document.getElementById('results'), empty: document.getElementById('empty-state'), resultCount: document.getElementById('result-count'), clientsList: document.getElementById('clients-list'),
  rebuild: document.getElementById('rebuild'), exportButton: document.getElementById('export'), saveButton: document.getElementById('save-project'), drop: document.getElementById('file-drop'),
  dialog: document.getElementById('files-dialog'), dialogCode: document.getElementById('dialog-code'), dialogTitle: document.getElementById('dialog-title'), dialogPath: document.getElementById('dialog-path'), dialogFiles: document.getElementById('dialog-files'), addFiles: document.getElementById('add-files'), toast: document.getElementById('toast')
};

function toast(message, error = false) {
  if(!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.toggle('error', error);
  dom.toast.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => dom.toast.classList.remove('show'), 4200);
}

function updateFolderStatus(granted = false) {
  if(!dom.folderStatus) return;
  dom.folderStatus.textContent = rootHandle ? `${rootHandle.name} / ${WORKSPACE_NAME}` : 'No seleccionada';
  dom.folderDot.classList.toggle('ready', Boolean(rootHandle && granted));
  dom.chooseFolder.textContent = rootHandle ? (granted ? 'Cambiar carpeta' : 'Reconectar carpeta') : 'Elegir carpeta';
}

function updateFileSummary() {
  const bytes = pendingFiles.reduce((total, file) => total + Number(file.size || 0), 0);
  dom.fileSummary.textContent = pendingFiles.length ? `${pendingFiles.length} archivo(s) · ${formatBytes(bytes)}` : 'Ningún archivo seleccionado';
}

function formatBytes(bytes) {
  if(bytes < 1024) return `${bytes} B`;
  if(bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if(bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function setPendingFiles(files) {
  pendingFiles = Array.from(files || []);
  updateFileSummary();
}

function renderCatalog() {
  if(!dom.results) return;
  const filters = { client: dom.filterClient.value, design: dom.filterDesign.value, product: dom.filterProduct.value };
  const matches = projects.map(project => ({ project, score: projectSearchScore(project, dom.search.value, filters) }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score || String(b.project.updatedAt).localeCompare(String(a.project.updatedAt)));

  dom.results.replaceChildren();
  dom.empty.style.display = matches.length ? 'none' : 'block';
  dom.empty.querySelector('h3').textContent = projects.length ? 'No se encontraron coincidencias' : 'Tu catálogo está listo';
  dom.empty.querySelector('p').textContent = projects.length ? 'Prueba con menos palabras o limpia uno de los tres filtros.' : 'El primer proyecto que guardes aparecerá aquí.';
  dom.resultCount.textContent = `${matches.length} ${matches.length === 1 ? 'proyecto' : 'proyectos'}`;

  matches.forEach(({ project }) => {
    const card = document.createElement('article'); card.className = 'project-card';
    const info = document.createElement('div');
    const code = document.createElement('span'); code.className = 'code'; code.textContent = project.code;
    const title = document.createElement('h3'); title.textContent = project.design;
    const description = document.createElement('p'); description.textContent = `${project.client} · ${project.files.length} archivo(s) · ${new Date(project.updatedAt).toLocaleDateString('es-GT')}`;
    const chips = document.createElement('div'); chips.className = 'chips';
    [project.product, ...(project.tags || [])].filter(Boolean).forEach((label, index) => { const chip = document.createElement('span'); chip.className = `chip${index === 0 ? ' product' : ''}`; chip.textContent = label; chips.append(chip); });
    info.append(code, title, description, chips);
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'button subtle'; open.textContent = 'Ver archivos'; open.addEventListener('click', () => openProject(project));
    actions.append(open); card.append(info, actions); dom.results.append(card);
  });

  const clients = [...new Set(projects.map(project => project.client).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  dom.clientsList.replaceChildren(...clients.map(client => { const option = document.createElement('option'); option.value = client; return option; }));
}

async function requireRootPermission(prompt = true) {
  if(!rootHandle) throw new Error('Primero elige la carpeta principal.');
  if(!(await verifyPermission(rootHandle, prompt))) throw new Error('No se concedió permiso para escribir en la carpeta.');
  updateFolderStatus(true);
  return rootHandle;
}

async function chooseRoot() {
  if(!('showDirectoryPicker' in window)) return toast('Esta función requiere Chrome o Edge de escritorio y una conexión HTTPS.', true);
  try {
    const selected = await window.showDirectoryPicker({ id: 'sublicosturas-studio-root', mode: 'readwrite' });
    if(!(await verifyPermission(selected, true))) throw new Error('No se concedió permiso de escritura.');
    await getWorkspace(selected, true);
    rootHandle = selected;
    await saveSetting('rootHandle', selected);
    if(navigator.storage?.persist) await navigator.storage.persist();
    updateFolderStatus(true);
    toast('Carpeta conectada. Los archivos se guardarán fuera de la aplicación.');
  } catch(error) {
    if(error.name !== 'AbortError') toast(error.message, true);
  }
}

async function createProject(event) {
  event.preventDefault();
  dom.saveButton.disabled = true;
  dom.saveButton.textContent = 'Guardando archivos…';
  try {
    const root = await requireRootPermission(true);
    const now = new Date();
    const code = makeProjectCode(now);
    const project = {
      schemaVersion: 1, id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, code,
      client: dom.client.value.trim(), design: dom.design.value.trim(), product: dom.product.value.trim(),
      tags: dom.tags.value.split(',').map(tag => tag.trim()).filter(Boolean), notes: dom.notes.value.trim(),
      createdAt: now.toISOString(), updatedAt: now.toISOString(), files: []
    };
    if(!project.client || !project.design || !project.product) throw new Error('Completa cliente, nombre del diseño y producto.');
    const segments = [sanitizeSegment(project.client), sanitizeSegment(project.product), makeProjectFolder(project)];
    const workspace = await getWorkspace(root, true);
    const directory = await getNestedDirectory(workspace, segments, true);
    project.relativePath = [WORKSPACE_NAME, ...segments];

    for(const file of pendingFiles) {
      const name = await uniqueFileName(directory, file.name);
      await writeBlob(directory, name, file);
      project.files.push({ name, size: file.size, type: file.type || '', lastModified: file.lastModified || Date.now() });
    }
    await writeProjectMetadata(directory, project);
    await saveProject(publicProject(project));
    projects = [publicProject(project), ...projects.filter(item => item.id !== project.id)];
    dom.form.reset(); setPendingFiles([]); renderCatalog();
    toast(`Proyecto ${code} guardado en ${project.relativePath.join(' / ')}`);
  } catch(error) {
    toast(`No se guardó el proyecto: ${error.message}`, true);
  } finally {
    dom.saveButton.disabled = false;
    dom.saveButton.textContent = 'Guardar proyecto y archivos';
  }
}

async function getProjectDirectory(project) {
  const root = await requireRootPermission(true);
  const segments = project.relativePath?.[0] === WORKSPACE_NAME ? project.relativePath.slice(1) : project.relativePath;
  const workspace = await getWorkspace(root, false);
  return getNestedDirectory(workspace, segments, false);
}

async function openProject(project) {
  try {
    const directory = await getProjectDirectory(project);
    activeProject = project;
    objectUrls.forEach(URL.revokeObjectURL); objectUrls = [];
    dom.dialogCode.textContent = project.code;
    dom.dialogTitle.textContent = project.design;
    dom.dialogPath.textContent = project.relativePath.join(' / ');
    dom.dialogFiles.replaceChildren();
    const entries = [];
    for await(const [name, handle] of directory.entries()) if(handle.kind === 'file' && name !== 'proyecto.json') entries.push([name, handle]);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    if(!entries.length) {
      const empty = document.createElement('p'); empty.className = 'path'; empty.textContent = 'Este proyecto todavía no contiene archivos.'; dom.dialogFiles.append(empty);
    }
    for(const [name, handle] of entries) {
      const file = await handle.getFile();
      const url = URL.createObjectURL(file); objectUrls.push(url);
      const row = document.createElement('div'); row.className = 'file-row';
      const label = document.createElement('span'); label.textContent = `${name} · ${formatBytes(file.size)}`;
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Abrir';
      row.append(label, link); dom.dialogFiles.append(row);
    }
    dom.dialog.showModal();
  } catch(error) {
    toast(`No se pudo abrir la carpeta: ${error.message}`, true);
  }
}

async function addFilesToActiveProject() {
  if(!activeProject) return;
  try {
    await requireRootPermission(true);
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true;
    input.addEventListener('change', async () => {
      try {
        const directory = await getProjectDirectory(activeProject);
        for(const file of Array.from(input.files || [])) {
          const name = await uniqueFileName(directory, file.name);
          await writeBlob(directory, name, file);
          activeProject.files.push({ name, size: file.size, type: file.type || '', lastModified: file.lastModified || Date.now() });
        }
        activeProject.updatedAt = new Date().toISOString();
        await writeProjectMetadata(directory, activeProject); await saveProject(publicProject(activeProject));
        projects = projects.map(project => project.id === activeProject.id ? publicProject(activeProject) : project);
        renderCatalog(); dom.dialog.close(); await openProject(activeProject); toast('Archivos añadidos al proyecto.');
      } catch(error) { toast(error.message, true); }
    }, { once: true });
    input.click();
  } catch(error) { toast(error.message, true); }
}

async function scanMetadata(directory, path = [], depth = 0, found = []) {
  if(depth > 5) return found;
  for await(const [name, handle] of directory.entries()) {
    if(handle.kind === 'file' && name === 'proyecto.json') {
      try {
        const parsed = JSON.parse(await (await handle.getFile()).text());
        if(parsed.id && parsed.client && parsed.design && parsed.product) found.push(publicProject({ ...parsed, relativePath: [WORKSPACE_NAME, ...path] }));
      } catch(error) { console.warn('Metadatos de proyecto no válidos en', path.join('/'), error); }
    } else if(handle.kind === 'directory') {
      await scanMetadata(handle, [...path, name], depth + 1, found);
    }
  }
  return found;
}

async function rebuildCatalog() {
  dom.rebuild.disabled = true;
  try {
    const root = await requireRootPermission(true);
    const workspace = await getWorkspace(root, false);
    const found = await scanMetadata(workspace);
    await clearProjects();
    for(const project of found) await saveProject(project);
    projects = found; renderCatalog(); toast(`Catálogo reconstruido: ${found.length} proyecto(s).`);
  } catch(error) { toast(`No se reconstruyó el catálogo: ${error.message}`, true); }
  finally { dom.rebuild.disabled = false; }
}

function exportCatalog() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), projects: projects.map(publicProject) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `SubliCosturas_Studio_Indice_${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function initialize() {
  const supported = 'showDirectoryPicker' in window && window.isSecureContext;
  dom.supportNote.textContent = supported
    ? 'Recomendado: Chrome o Edge en computadora. El navegador pedirá permiso al volver a abrir una carpeta guardada.'
    : 'Tu navegador no permite escribir directamente en carpetas. Abre Studio con Chrome o Edge de escritorio desde HTTPS o localhost.';
  dom.chooseFolder.disabled = !supported;
  try {
    projects = await getAllProjects();
    const saved = await getSetting('rootHandle'); rootHandle = saved?.value || null;
    updateFolderStatus(rootHandle ? await verifyPermission(rootHandle, false) : false);
  } catch(error) { toast('No se pudo abrir el índice local: ' + error.message, true); }
  renderCatalog();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => console.warn('Studio sin modo offline', error));
}

if(typeof document !== 'undefined') {
  dom.chooseFolder.addEventListener('click', chooseRoot);
  dom.form.addEventListener('submit', createProject);
  dom.files.addEventListener('change', () => setPendingFiles(dom.files.files));
  ['dragenter', 'dragover'].forEach(type => dom.drop.addEventListener(type, event => { event.preventDefault(); dom.drop.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(type => dom.drop.addEventListener(type, event => { event.preventDefault(); dom.drop.classList.remove('dragging'); }));
  dom.drop.addEventListener('drop', event => setPendingFiles(event.dataTransfer.files));
  [dom.search, dom.filterClient, dom.filterDesign, dom.filterProduct].forEach(input => input.addEventListener('input', renderCatalog));
  dom.rebuild.addEventListener('click', rebuildCatalog); dom.exportButton.addEventListener('click', exportCatalog); dom.addFiles.addEventListener('click', addFilesToActiveProject);
  dom.dialog.addEventListener('close', () => { objectUrls.forEach(URL.revokeObjectURL); objectUrls = []; activeProject = null; });
  initialize();
}
