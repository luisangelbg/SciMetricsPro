/* SciMetricsPro — Import module.
   Several files at once (even from different databases): each one is read in a
   background worker, its format is detected, and its records are appended to
   state.records. The screen lists the files with their warnings, shows which
   fields are available and previews the first records.
   This is the only screen where database names may appear (see CLAUDE.md). */
'use strict';

const ImportModule = {
  nextFileId: 1,
  busy: false,
  PREVIEW: 100,

  /* files: FileList | File[] → Promise (resolves when state is updated) */
  async addFiles(files, opts) {
    opts = opts || {};
    const list = Array.from(files || []);
    const fresh = list.filter(f => {
      const dup = state.files.some(x => x.name === f.name && x.size === f.size);
      if (dup) toast(t('import.duplicateFile', { name: f.name }), 'warn');
      return !dup;
    });
    if (!fresh.length) return [];
    ImportModule.busy = true;
    const P = Parsers.lib();
    let results;
    try {
      /* spreadsheets become comma-separated text here, where the spreadsheet component lives; then every file
         goes through the same readers */
      const sheets = fresh.filter(f => P.isSheetName(f.name));
      const failed = new Map(), converted = new Map();
      if (sheets.length) {
        const overlay = opts.inline || opts.quiet ? null : ProgressOverlay.show({ title: t('import.reading') });
        try {
          for (const f of sheets) {
            if (overlay) { overlay.update(null, f.name); await new Promise(r => setTimeout(r, 30)); }
            try { converted.set(f, await ImportModule.sheetToFile(f)); }
            catch (e) { failed.set(f, { name: f.name, size: f.size, format: null, source: null, records: [], warnings: [{ code: 'readError', msg: String(e && e.message || e) }], error: 'readError' }); }
          }
        } finally { if (overlay) overlay.close(); }
      }
      const toRead = fresh.filter(f => !failed.has(f)).map(f => converted.get(f) || f);
      const read = toRead.length ? await Parsers.read(toRead, { overlay: !opts.inline && !opts.quiet, inline: opts.inline, title: t('import.reading') }) : [];
      if (read) {
        let k = 0;
        results = fresh.map(f => {
          if (failed.has(f)) return failed.get(f);
          const res = read[k++];
          if (converted.has(f)) {
            res.size = f.size;
            if (res.format) { res.format = 'sheet'; res.records.forEach(r => { r.format = 'sheet'; }); }
          }
          return res;
        });
      }
    } finally {
      ImportModule.busy = false;
    }
    if (!results) return [];   // cancelled
    let added = 0;
    for (const res of results) {
      if (res.error) toast(t('import.failed', { name: res.name }), 'error');
      added += ImportModule.addResult(res, { silent: true });
    }
    emit('datachange', { reason: 'import' });
    if (added) toast(tp('import.added', added));
    return results;
  },

  /* a spreadsheet (.xlsx, .xls, .xlsm, .ods) → a File with the same name holding comma-separated text: the first sheet
     with at least two filled rows, cells as they are displayed. Runs in the page (the worker cannot load the component). */
  async sheetToFile(file) {
    if (!window.XLSX) throw new Error(t('import.sheetReaderMissing'));
    const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    let text = '';
    for (const name of book.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(book.Sheets[name], { FS: ',', RS: '\n', blankrows: false });
      if (csv.split('\n').filter(line => line.replace(/[",]/g, '').trim()).length >= 2) { text = csv; break; }
    }
    return new File([text], file.name, { type: 'text/csv' });
  },

  /* one read file or one downloaded search → state.files + state.records.
     res: { name, size, format, source, encoding, records, warnings, completeness, error, search } */
  addResult(res, opts) {
    const fileId = ImportModule.nextFileId++;
    res.records.forEach((r, i) => { r.id = 'f' + fileId + '-' + (i + 1); r.fileId = fileId; });
    state.files.push({
      id: fileId, name: res.name, size: res.size, format: res.format, source: res.source, encoding: res.encoding || null,
      count: res.records.length, warnings: res.warnings || [], completeness: res.completeness || null, error: res.error || null,
      search: res.search || null, label: res.label || null,
    });
    state.records = (state.records || []).concat(res.records);
    if (!state.records.length) state.records = null;
    state.filtered = null;
    if (!(opts && opts.silent)) emit('datachange', { reason: res.search ? 'search' : 'import' });
    return res.records.length;
  },

  /* the searches behind the loaded data, for the methods report */
  searches() { return state.files.filter(f => f.search).map(f => f.search); },

  fileLabel(f) {
    if (f.label) return f.label;
    return f.search ? t('import.search.rowName', { query: f.search.query.terms }) : f.name;
  },

  removeFile(id) {
    state.files = state.files.filter(f => f.id !== id);
    const records = (state.records || []).filter(r => r.fileId !== id);
    state.records = records.length ? records : null;
    state.filtered = null;
    emit('datachange', { reason: 'remove' });
  },

  clear() {
    state.files = [];
    state.records = null;
    state.filtered = null;
    emit('datachange', { reason: 'clear' });
  },

  sourceLabel(file) {
    if (!file.format) return t('import.unknown');
    /* a file of unidentified origin is named by its format alone ("RIS", not "RIS · RIS") */
    if (['ris', 'bibtex', 'table'].includes(file.source)) return t('import.formatNames.' + file.format);
    return t('import.detected', { source: t('import.sourceNames.' + file.source), format: t('import.formatNames.' + file.format) });
  },

  warningText(w) {
    const key = 'import.warn.' + w.code;
    const vars = { pct: w.pct, msg: w.msg || '' };
    return w.n != null ? tp(key, w.n, vars) : t(key, vars);
  },

  sizeLabel(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return fmtInt(bytes) + ' B';
    if (bytes < 1048576) return fmtNum(bytes / 1024, 1) + ' KB';
    return fmtNum(bytes / 1048576, 1) + ' MB';
  },

  /* ---------------- screen ---------------- */
  TABS: ['keywords', 'files', 'search'],
  tab: 'files',
  kw: null,            // keywords tab: idea, field, years and concepts (js/modules/import-keywords.js)
  showFormats: false,
  formatsOpen: null,

  render(body) {
    body.innerHTML = '';
    const page = mk('div', { class: 'import-page' });

    /* three steps in: prepare the keywords, bring files, or search the open catalogue */
    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('import.tabsLabel') });
    const icons = { keywords: 'tag', files: 'upload', search: 'search' };
    ImportModule.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'tab-' + id, 'aria-controls': 'panel-' + id,
        'aria-selected': String(ImportModule.tab === id), tabindex: ImportModule.tab === id ? '0' : '-1' }, icon(icons[id]) + '<span>' + esc(t('import.tabs.' + id)) + '</span>');
      b.addEventListener('click', () => { ImportModule.tab = id; App.render('import', { keepScroll: true, keepFocus: true }); const nb = el('tab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const list = ImportModule.TABS, k = list.indexOf(ImportModule.tab);
        ImportModule.tab = list[(k + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
        App.render('import', { keepScroll: true, keepFocus: true });
        const nb = el('tab-' + ImportModule.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    if (!ImportModule.TABS.includes(ImportModule.tab)) ImportModule.tab = 'files';

    if (ImportModule.tab === 'keywords') {
      const panel = mk('div', { class: 'tab-panel', role: 'tabpanel', id: 'panel-keywords', 'aria-labelledby': 'tab-keywords' });
      KeywordsPanel.render(panel);
      page.appendChild(panel);
      ImportModule.renderLoaded(page);
      body.appendChild(page);
      return;
    }
    if (ImportModule.tab === 'search') {
      const panel = mk('div', { class: 'tab-panel', role: 'tabpanel', id: 'panel-search', 'aria-labelledby': 'tab-search' });
      SearchPanel.render(panel);
      page.appendChild(panel);
      ImportModule.renderLoaded(page);
      body.appendChild(page);
      return;
    }
    const filesPanel = mk('div', { class: 'tab-panel', role: 'tabpanel', id: 'panel-files', 'aria-labelledby': 'tab-files' });
    page.appendChild(filesPanel);

    /* drop zone */
    const input = mk('input', { type: 'file', id: 'importInput', multiple: true, class: 'sr-only', tabindex: '-1',
      accept: '.csv,.tsv,.txt,.tab,.bib,.bibtex,.ris,.nbib,.xlsx,.xls,.xlsm,.ods', 'aria-hidden': 'true' });
    input.addEventListener('change', () => { if (input.files.length) ImportModule.addFiles(input.files); input.value = ''; });
    const dz = mk('div', { class: 'dropzone' + (hasData() ? ' compact' : ''), id: 'importDrop' });
    dz.appendChild(mk('div', { class: 'empty-icon' }, icon('upload')));
    const dzText = mk('div', { class: 'dz-text' });
    dzText.appendChild(mk('h2', null, esc(t('import.dropTitle'))));
    dzText.appendChild(mk('p', null, esc(t('import.dropText'))));
    dz.appendChild(dzText);
    const choose = mk('button', { type: 'button', class: 'btn btn-primary', id: 'importChoose' },
      icon('upload') + '<span>' + esc(t(hasData() ? 'import.addMore' : 'import.choose')) + '</span>');
    choose.addEventListener('click', () => input.click());
    dz.appendChild(choose);
    if (!hasData()) {
      /* no files yet: the keywords tab prepares the search in each database */
      const kwLink = mk('p', { class: 'dz-link' }, '<span>' + esc(t('import.keywords.filesLinkText')) + '</span> ');
      const kwBtn = mk('button', { type: 'button', class: 'link-btn', id: 'impKwLink' }, icon('tag') + '<span>' + esc(t('import.keywords.filesLink')) + '</span>');
      kwBtn.addEventListener('click', () => { ImportModule.tab = 'keywords'; App.render('import', { keepScroll: true, keepFocus: true }); const n = el('kwIdea'); if (n) n.focus(); });
      kwLink.appendChild(kwBtn);
      dz.appendChild(kwLink);
    }
    dz.appendChild(input);
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'dragend'].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove('over')));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('over');
      if (e.dataTransfer && e.dataTransfer.files.length) ImportModule.addFiles(e.dataTransfer.files);
    });
    filesPanel.appendChild(dz);

    /* supported formats */
    /* open while there are no data, or when another screen asks for the export instructions (kept open across redraws) */
    const showFormats = ImportModule.showFormats;
    ImportModule.showFormats = false;
    if (showFormats) ImportModule.formatsOpen = true;
    const fmts = mk('details', { class: 'card formats-card', id: 'impFormats', open: ImportModule.formatsOpen != null ? ImportModule.formatsOpen : !hasData() });
    const fsum = mk('summary', null, esc(t('import.formatsTitle')));
    fsum.addEventListener('click', () => { ImportModule.formatsOpen = !fmts.open; });
    fmts.appendChild(fsum);
    const grid = mk('div', { class: 'formats-grid' });
    ['idxA', 'idxB', 'biomed', 'other', 'sheet'].forEach(k => grid.appendChild(mk('div', { class: 'format-item' },
      `<strong>${esc(t('import.formats.' + k + '.name'))}</strong><span>${esc(t('import.formats.' + k + '.text'))}</span>`)));
    fmts.appendChild(grid);
    filesPanel.appendChild(fmts);
    /* arriving from a screen that needs other exports (e.g. without cited references) */
    if (showFormats) requestAnimationFrame(() => { fmts.scrollIntoView({ block: 'center' }); const s = fmts.querySelector('summary'); if (s) s.focus({ preventScroll: true }); });

    ImportModule.renderLoaded(page);
    body.appendChild(page);
  },

  /* what is loaded, below either tab */
  renderLoaded(page) {
    if (state.files.length) {
      page.appendChild(ImportModule.filesSection());
      if (hasData()) {
        page.appendChild(ImportModule.completenessSection());
        page.appendChild(ImportModule.previewSection());
        const next = mk('div', { class: 'import-next' });
        const go = mk('button', { type: 'button', class: 'btn btn-secondary' }, esc(t('import.next')) + icon('chevron'));
        go.addEventListener('click', () => App.go('cleaning'));
        next.appendChild(go);
        page.appendChild(next);
      }
    }
  },

  filesSection() {
    const sec = mk('section', { class: 'card import-files' });
    const head = mk('header', { class: 'section-head' });
    const title = mk('div');
    title.appendChild(mk('h2', null, esc(t('import.filesTitle'))));
    const total = state.records ? state.records.length : 0;
    title.appendChild(mk('p', { class: 'hint', id: 'importSummary' }, esc(tp('import.summary', total) + ' · ' + tp('import.fileCount', state.files.length))));
    head.appendChild(title);
    const clear = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'importClear' }, icon('close') + '<span>' + esc(t('import.clearAll')) + '</span>');
    clear.addEventListener('click', () => { if (window.confirm(t('import.confirmClear'))) ImportModule.clear(); });
    head.appendChild(clear);
    sec.appendChild(head);

    const sources = new Set(state.files.filter(f => f.count).map(f => f.source));
    if (sources.size > 1) sec.appendChild(mk('p', { class: 'note-info' }, icon('sparkle') + '<span>' + esc(t('import.mixedSources')) + '</span>'));

    const scroller = mk('div', { class: 'dt-scroll' });
    const table = mk('table', { class: 'dt-table files-table' });
    table.appendChild(mk('thead', null, '<tr>' + ['file', 'format', 'records', 'size', 'notes'].map(k =>
      `<th scope="col"${k === 'records' || k === 'size' ? ' class="num"' : ''}><span class="th-plain">${esc(t('import.col.' + k))}</span></th>`).join('') + '<th></th></tr>'));
    const tbody = mk('tbody');
    for (const f of state.files) {
      const tr = mk('tr', { 'data-file': f.id, class: f.error ? 'file-error' : null });
      const nameCell = mk('td', { class: 'file-name' }, icon(f.search ? 'search' : 'doc') + '<span>' + esc(ImportModule.fileLabel(f)) + '</span>');
      if (f.search) nameCell.querySelector('span').appendChild(mk('small', { class: 'file-sub' }, esc(t('import.search.rowDate', { date: new Date(f.search.date).toLocaleString(locale()) }))));
      tr.appendChild(nameCell);
      tr.appendChild(mk('td', null, '<span class="chip' + (f.error ? ' warn' : '') + '">' + esc(ImportModule.sourceLabel(f)) + '</span>'));
      tr.appendChild(mk('td', { class: 'num' }, esc(fmtInt(f.count))));
      tr.appendChild(mk('td', { class: 'num' }, esc(f.size == null ? '—' : ImportModule.sizeLabel(f.size))));
      const notes = mk('td', { class: 'file-notes' });
      if (!f.warnings.length) notes.appendChild(mk('span', { class: 'ok-note' }, esc(t('import.noWarnings'))));
      else {
        const ul = mk('ul', { class: 'warn-list' });
        f.warnings.forEach(w => ul.appendChild(mk('li', { class: /unknownFormat|empty|readError/.test(w.code) ? 'bad' : null },
          esc(ImportModule.warningText(w)))));
        notes.appendChild(ul);
      }
      tr.appendChild(notes);
      const rm = mk('button', { type: 'button', class: 'icon-btn', 'aria-label': t('import.remove', { name: ImportModule.fileLabel(f) }), title: t('import.remove', { name: ImportModule.fileLabel(f) }) }, icon('close'));
      rm.addEventListener('click', () => ImportModule.removeFile(f.id));
      const td = mk('td', { class: 'file-remove' }); td.appendChild(rm);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    scroller.appendChild(table);
    sec.appendChild(scroller);
    return sec;
  },

  completenessSection() {
    const P = Parsers.lib();
    const files = state.files.filter(f => f.count && f.completeness);
    const sec = mk('section', { class: 'card import-completeness' });
    sec.appendChild(mk('h2', null, esc(t('import.completenessTitle'))));
    sec.appendChild(mk('p', { class: 'hint' }, esc(t('import.completenessSub'))));
    const all = P.completeness(state.records || []);
    /* the total goes first, next to the field names: with many files the last columns need scrolling */
    const cols = (files.length > 1 ? [{ label: t('import.total'), comp: all, total: true }] : []).concat(files.map(f => ({ label: ImportModule.fileLabel(f), comp: f.completeness })));
    const scroller = mk('div', { class: 'dt-scroll' });
    const table = mk('table', { class: 'dt-table comp-table', id: 'completenessTable' });
    table.appendChild(mk('thead', null, '<tr><th scope="col"><span class="th-plain">' + esc(t('import.field')) + '</span></th>' +
      cols.map(c => `<th scope="col" class="num${c.total ? ' total' : ''}" title="${esc(c.label)}"><span class="th-plain">${esc(c.label)}</span></th>`).join('') + '</tr>'));
    const tbody = mk('tbody');
    for (const field of P.COMPLETENESS_FIELDS) {
      const tr = mk('tr', { 'data-field': field });
      tr.appendChild(mk('th', { scope: 'row' }, esc(t('import.fields.' + field))));
      for (const c of cols) {
        const v = c.comp[field] || 0;
        const level = v >= 0.8 ? 'hi' : v >= 0.3 ? 'mid' : v > 0 ? 'lo' : 'none';
        tr.appendChild(mk('td', { class: 'num comp-cell ' + level + (c.total ? ' total' : '') },
          `<span class="comp-bar"><span style="width:${Math.round(v * 100)}%"></span></span><span class="comp-pct">${esc(fmtPct(v, 0))}</span>`));
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    scroller.appendChild(table);
    sec.appendChild(scroller);
    return sec;
  },

  previewSection() {
    const recs = state.records || [];
    const rows = recs.slice(0, ImportModule.PREVIEW);
    const fileName = new Map(state.files.map(f => [f.id, ImportModule.fileLabel(f)]));
    const sec = mk('section', { class: 'import-preview' });
    sec.appendChild(mk('h2', { class: 'section-title' }, esc(t('import.previewTitle'))));
    sec.appendChild(mk('p', { class: 'section-sub' }, esc(tp('import.previewSub', rows.length, { total: fmtInt(recs.length) }))));
    const authors = r => {
      const names = r.authors.slice(0, 3).map(a => a.short);
      return names.join('; ') + (r.authors.length > 3 ? ' ' + t('import.etal') : '');
    };
    const dt = DataTable.create({
      title: t('import.previewTitle'), fileName: 'vista_previa', pageSize: 10,
      columns: [
        { key: 'n', label: t('import.pcol.n'), type: 'int', get: r => rows.indexOf(r) + 1 },
        { key: 'authors', label: t('import.pcol.authors'), get: authors, cls: 'col-mid', clamp: true },
        { key: 'year', label: t('import.pcol.year'), type: 'year' },
        { key: 'title', label: t('import.pcol.title'), cls: 'col-wide', clamp: true },
        { key: 'sourceTitle', label: t('import.pcol.source'), cls: 'col-mid', clamp: true },
        { key: 'timesCited', label: t('import.pcol.cited'), type: 'int' },
        { key: 'keywords', label: t('import.pcol.keywords'), get: r => (r.authorKeywords.length ? r.authorKeywords : r.indexKeywords).slice(0, 6).join('; '), cls: 'col-mid', clamp: true },
        { key: 'refs', label: t('import.pcol.refs'), type: 'int', get: r => r.references.length },
        { key: 'countries', label: t('import.pcol.countries'), get: r => r.countries.join(', '), cls: 'col-nowrap' },
        { key: 'doi', label: t('import.pcol.doi'), cls: 'col-nowrap' },
        { key: 'origin', label: t('import.pcol.origin'), get: r => fileName.get(r.fileId) || '', cls: 'col-nowrap' },
      ],
      rows,
    });
    dt.el.id = 'importPreview';
    sec.appendChild(dt.el);
    return sec;
  },
};

Modules.define('import', { render: body => ImportModule.render(body) });
on('datachange', () => { if (state.route === 'import' && Layout.view) App.render('import', { keepScroll: true, keepFocus: true }); });

window.ImportModule = ImportModule;
