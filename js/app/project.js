/* SciMetricsPro — projects. The whole work is kept in one object: the imported records and files, the cleaning decisions
   (merges undone, author unions, aliases, synonyms, stop words, term field, filters, reference year), the duplicate groups,
   the PRISMA decisions, the parameters, tabs and figure settings of every module and the export and report options.
   · Project.save() downloads it as a .smp.json file compressed with gzip; Project.open(file) reads it back (compressed or
     plain JSON) and rebuilds the clean set from the records and the decisions, so it is the same as when it was saved.
   · Autosave: the same object is kept in the browser (IndexedDB) a moment after every change and when the page is hidden;
     on the next visit the app asks whether to recover it.
   Records travel whole: the clean set is recomputed from them with the saved decisions (merges can still be undone). */
'use strict';

const Project = {
  FORMAT: 'scimetricspro-project',
  VERSION: 1,
  STORE: 'session',
  DELAY: 1500,
  enabled: !window.SMP_TEST,   // autosave and the recovery question (off in the tests unless a test turns them on)
  ready: false,         // nothing is autosaved until the question about the previous session is answered
  pendingRecovery: null,
  _db: null,
  _timer: null,
  _dataSig: null,
  _stateSig: null,

  /* module state kept in a project (paths inside each module object) */
  MODULE_STATE: {
    import: ['tab', 'kw'],
    cleaning: ['tab', 'ui'],
    overview: ['figs'],
    sources: ['tab', 'ui', 'figs'],
    authors: ['tab', 'ui', 'figs'],
    documents: ['tab', 'ui', 'figs'],
    conceptual: ['tab', 'params', 'tm', 'ev', 'fa', 'figs'],
    intellectual: ['tab', 'co.params', 'cp.params', 'cm', 'hg', 'figs'],
    social: ['tab', 'net.params', 'map', 'figs'],
    prisma: ['tab', 'view', 'advance', 'reason', 'figs'],
    export: ['tab'],
  },
  /* preferences that belong to the work, not to the person */
  PREFS: ['exportOptions', 'figexport', 'reportOptions', 'reportSources'],
  /* settings the pipeline also remembers in the browser */
  PERSISTED: ['countryAliases', 'institutionAliases', 'synonyms', 'stopwords', 'termField'],

  moduleObject(id) { return window[id.charAt(0).toUpperCase() + id.slice(1) + 'Module'] || null; },
  getPath(o, path) { return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o); },
  setPath(o, path, value) {
    const keys = path.split('.');
    let cur = o;
    for (let i = 0; i < keys.length - 1; i++) { if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {}; cur = cur[keys[i]]; }
    cur[keys[keys.length - 1]] = value;
  },
  copy(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); },

  /* ---------- the object ---------- */
  stateSnapshot() {
    const modules = {};
    for (const [id, keys] of Object.entries(Project.MODULE_STATE)) {
      const M = Project.moduleObject(id);
      if (!M) continue;
      modules[id] = {};
      keys.forEach(k => { const v = Project.getPath(M, k); if (v !== undefined) modules[id][k] = Project.copy(v); });
    }
    const prefs = {};
    Project.PREFS.forEach(k => { const v = Prefs.get(k, null); if (v != null) prefs[k] = v; });
    return { settings: Project.copy(Pipeline.init()), modules, prefs, route: state.route };
  },
  dataSnapshot() {
    return { files: state.files, records: state.records || [], nextFileId: ImportModule.nextFileId, dup: Pipeline.dup };
  },
  snapshot() {
    return Object.assign({ format: Project.FORMAT, version: Project.VERSION, app: APP.version, savedAt: new Date().toISOString() }, Project.dataSnapshot(), Project.stateSnapshot());
  },

  /* ---------- rebuild ---------- */
  check(p) {
    if (!p || typeof p !== 'object' || p.format !== Project.FORMAT || !Array.isArray(p.records) || !Array.isArray(p.files)) throw new Error(t('project.errors.invalid'));
    if (+p.version > Project.VERSION) throw new Error(t('project.errors.version', { version: p.app || p.version }));
  },

  async restore(p) {
    Project.check(p);
    Project.closeRecovery();
    /* forget what the modules computed and drew for the previous data */
    ['intellectual', 'social', 'prisma'].forEach(id => { const M = Project.moduleObject(id); if (M && M.reset) M.reset(); });
    const C = window.ConceptualModule;
    if (C) { if (window.NetworkScreen) NetworkScreen.detach(C); Object.assign(C, { params: null, tm: null, ev: null, fa: null, _net: null, _comm: null, _circle: null, _tm: null, _ev: null, _fa: null, selectedKey: null, figs: {}, cc: {} }); }
    ['overview', 'sources', 'authors', 'documents'].forEach(id => { const M = Project.moduleObject(id); if (M) { M._cache = null; M.figs = {}; M.cc = {}; } });
    if (window.ExportModule) { ExportModule.catalog = null; ExportModule.selected = null; ExportModule.report = { model: null, busy: false }; }
    Pipeline._refs = null;
    /* data and decisions */
    state.files = Project.copy(p.files);
    state.records = p.records.length ? p.records : null;
    state.clean = null; state.screening = null; state.filtered = null;
    ImportModule.nextFileId = Math.max(+p.nextFileId || 1, ...state.files.map(f => f.id + 1), 1);
    Pipeline.settings = Object.assign(Pipeline.defaults(), Project.copy(p.settings || {}));
    Pipeline._dict = null;
    Pipeline.dup = p.dup && Array.isArray(p.dup.groups) ? Project.copy(p.dup) : { signature: '', threshold: null, groups: [] };
    Project.PERSISTED.forEach(k => { if (Pipeline.settings[k] != null) Prefs.set(k, Pipeline.settings[k]); });
    Pipeline.savePrisma();
    Object.entries(p.prefs || {}).forEach(([k, v]) => { if (Project.PREFS.includes(k)) Prefs.set(k, v); });
    /* parameters, tabs and figure settings */
    for (const [id, values] of Object.entries(p.modules || {})) {
      const M = Project.moduleObject(id), keys = Project.MODULE_STATE[id];
      if (!M || !keys) continue;
      keys.forEach(k => { if (values[k] !== undefined) Project.setPath(M, k, Project.copy(values[k])); });
    }
    emit('datachange', { reason: 'project' });
    await Pipeline.pending;
    const route = App.routes().includes(p.route) ? p.route : 'overview';
    App.go(route);
    Project._dataSig = null; Project._stateSig = null;
    Project.ready = true;
    Project.schedule();
    return { documents: state.records ? state.records.length : 0, files: state.files.length };
  },

  /* ---------- files ---------- */
  async gzip(text) {
    if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' });
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Blob([await new Response(stream).arrayBuffer()], { type: 'application/gzip' });
  },
  async parse(bytes) {
    let text;
    if (bytes[0] === 0x1F && bytes[1] === 0x8B) text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    else text = new TextDecoder().decode(bytes);
    try { return JSON.parse(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text); } catch (e) { throw new Error(t('project.errors.invalid')); }
  },
  fileName() { return 'scimetricspro_' + slug(t('project.file')) + '_' + new Date().toISOString().slice(0, 10) + '.smp.json'; },

  async save() {
    if (!hasData()) { toast(t('project.nothing'), 'error'); return null; }
    /* large collections take a few seconds: say so before the work blocks the page */
    if (state.records.length > 2000) { toast(t('project.saving')); await new Promise(r => setTimeout(r, 60)); }
    const blob = await Project.gzip(JSON.stringify(Project.snapshot()));
    const name = Project.fileName();
    download(blob, name);
    toast(t('project.saved', { name }));
    return { blob, name };
  },

  async open(file) {
    try {
      const p = await Project.parse(new Uint8Array(await file.arrayBuffer()));
      Project.check(p);
      if (hasData() && !window.confirm(t('project.confirmReplace'))) return false;
      const res = await Project.restore(p);
      toast(tp('project.opened', res.documents, { files: tp('status.files', res.files) }));
      return true;
    } catch (e) {
      toast(t('project.errors.open', { msg: e.message }), 'error');
      return false;
    }
  },

  /* ---------- autosave in the browser ---------- */
  dbName() { return APP.storagePrefix + 'project'; },
  db() {
    if (!Project._db) {
      Project._db = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('indexedDB')); return; }
        const req = indexedDB.open(Project.dbName(), 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(Project.STORE)) req.result.createObjectStore(Project.STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      Project._db.catch(() => { Project._db = null; });
    }
    return Project._db;
  },
  async tx(mode, fn) {
    const db = await Project.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(Project.STORE, mode);
      const req = fn(tx.objectStore(Project.STORE));
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
  get(key) { return Project.tx('readonly', s => s.get(key)); },
  put(key, value) { return Project.tx('readwrite', s => s.put(value, key)); },
  clearStored() { Project._dataSig = null; Project._stateSig = null; return Project.tx('readwrite', s => s.clear()); },

  schedule() {
    if (!Project.enabled || !Project.ready) return;
    clearTimeout(Project._timer);
    Project._timer = setTimeout(() => Project.saveNow(), Project.DELAY);
  },

  /* the records are written again only when the imported files changed; the rest is small */
  async saveNow() {
    if (!Project.enabled || !Project.ready) return false;
    clearTimeout(Project._timer);
    try {
      if (!hasData()) {
        if (Project._stateSig !== 'empty') { await Project.clearStored(); Project._stateSig = 'empty'; }
        return true;
      }
      const dataSig = Pipeline.signature() + '|' + state.records.length;
      if (dataSig !== Project._dataSig) {
        await Project.put('data', Object.assign({ sig: dataSig }, Project.dataSnapshot()));
        Project._dataSig = dataSig;
      }
      const st = Project.stateSnapshot();
      const stateSig = JSON.stringify(st) + dataSig + JSON.stringify(Pipeline.dup.groups.length);
      if (stateSig !== Project._stateSig) {
        await Project.put('state', Object.assign({ format: Project.FORMAT, version: Project.VERSION, app: APP.version, savedAt: new Date().toISOString(), sig: dataSig, documents: state.records.length, fileCount: state.files.length }, st));
        Project._stateSig = stateSig;
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  async stored() {
    try {
      const st = await Project.get('state');
      if (!st || !st.documents) return null;
      const data = await Project.get('data');
      if (!data || data.sig !== st.sig) return null;
      return Object.assign({}, data, st, { format: Project.FORMAT });
    } catch (e) { return null; }
  },

  /* ---------- the question on the next visit ---------- */
  showRecovery(saved) {
    Project.closeRecovery();
    Project.pendingRecovery = saved;
    const back = mk('div', { class: 'modal-backdrop', id: 'recoverDialog' });
    const box = mk('div', { class: 'modal card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'recoverTitle', 'aria-describedby': 'recoverText' });
    box.appendChild(mk('h2', { id: 'recoverTitle' }, icon('clock') + '<span>' + esc(t('project.recover.title')) + '</span>'));
    const when = new Date(saved.savedAt);
    box.appendChild(mk('p', { id: 'recoverText' }, esc(t('project.recover.text', { documents: tp('status.records', saved.documents), files: tp('status.files', saved.fileCount || saved.files.length), date: isNaN(when) ? '' : when.toLocaleString(locale()) }))));
    const row = mk('div', { class: 'modal-actions' });
    const yes = mk('button', { type: 'button', class: 'btn btn-primary', id: 'recoverYes' }, esc(t('project.recover.yes')));
    const no = mk('button', { type: 'button', class: 'btn btn-secondary', id: 'recoverNo' }, esc(t('project.recover.no')));
    yes.addEventListener('click', async () => {
      yes.disabled = no.disabled = true;
      try { await Project.restore(saved); toast(tp('project.recovered', saved.documents)); } catch (e) { toast(t('project.errors.open', { msg: e.message }), 'error'); Project.closeRecovery(); Project.ready = true; }
    });
    no.addEventListener('click', async () => {
      Project.closeRecovery();
      try { await Project.clearStored(); } catch (e) { /* nothing to clear */ }
      Project.ready = true;
      Project.schedule();
    });
    row.appendChild(yes); row.appendChild(no);
    box.appendChild(row);
    /* the focus stays inside the question */
    box.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const first = yes, last = no;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    back.appendChild(box);
    document.body.appendChild(back);
    yes.focus();
    return back;
  },
  closeRecovery() {
    const d = el('recoverDialog');
    if (d) d.remove();
    Project.pendingRecovery = null;
  },

  async init() {
    on('datachange', () => {
      /* new data before answering: the new work replaces the previous session */
      if (Project.pendingRecovery && hasData()) { Project.closeRecovery(); Project.ready = true; }
      Project.schedule();
      Layout.syncProject();
    });
    ['cleanchange', 'prismachange', 'routechange', 'langchange'].forEach(ev => on(ev, () => Project.schedule()));
    /* parameters and tabs change without events: a light check every few seconds */
    setInterval(() => { if (hasData()) Project.schedule(); }, 10000);
    window.addEventListener('pagehide', () => { Project.saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Project.saveNow(); });
    if (!Project.enabled) return;
    const saved = await Project.stored();
    if (saved && !hasData()) Project.showRecovery(saved);
    else Project.ready = true;
  },
};

window.Project = Project;
