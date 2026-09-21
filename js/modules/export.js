/* SciMetricsPro — Export: every figure, table and network of the analysis modules (each tab drawn out of sight with the
   parameters the user chose), the clean data (CSV, BibTeX and the synonyms), chosen with check boxes and saved in one ZIP
   with ordered names (figuras/01_produccion_cientifica_anual.png …) and an index. */
'use strict';

/* collects what the modules create while they are drawn out of sight */
const ExportCollector = {
  active: false,
  items: [],
  context: null,
  MODULES: ['overview', 'sources', 'authors', 'documents', 'conceptual', 'intellectual', 'social', 'prisma'],

  add(kind, o) { ExportCollector.items.push(Object.assign({ kind }, ExportCollector.context, o)); },
  addFigure(o) { ExportCollector.add('figure', o); },
  addTable(o) { ExportCollector.add('table', o); },
  addNetwork(o) { ExportCollector.add('network', o); },

  moduleObject(id) { return window[id.charAt(0).toUpperCase() + id.slice(1) + 'Module'] || null; },

  /* calculations that a screen started in a worker: wait for them and draw the tab again */
  waits() {
    const out = [];
    if (Pipeline._refs && !Pipeline._refs.data && Pipeline._refs.pending) out.push(Pipeline._refs.pending);
    for (const store of [window.ConceptualModule, window.IntellectualModule && IntellectualModule.co, window.IntellectualModule && IntellectualModule.cp, window.SocialModule && SocialModule.net]) {
      if (store && store._net && !store._net.data && store._net.pending) out.push(store._net.pending);
    }
    return out;
  },

  /* opts.lang: draw in another language (the report); the labels of the progress stay in the language of the interface */
  async collect(progress, opts) {
    const C = ExportCollector;
    const lang = opts && opts.lang;
    const inLang = fn => (lang ? I18N.withLang(lang, fn) : fn());
    const host = mk('div', { class: 'export-offscreen', 'aria-hidden': 'true', style: 'position:absolute;left:-30000px;top:0;width:1200px;visibility:hidden' });
    document.body.appendChild(host);
    C.items = [];
    C.active = true;
    const plan = [];
    for (const id of C.MODULES) {
      const M = C.moduleObject(id), impl = Modules.impl[id];
      if (!impl || !impl.render) continue;
      const tabs = M && Array.isArray(M.TABS) ? M.TABS : [null];
      tabs.forEach(tab => plan.push({ id, M, impl, tab }));
    }
    try {
      for (let k = 0; k < plan.length; k++) {
        const { id, M, impl, tab } = plan[k];
        if (progress) progress(k / plan.length, t('mod.' + id + '.title'));
        const saved = M ? M.tab : null;
        if (tab && M) M.tab = tab;
        for (let attempt = 0; attempt < 4; attempt++) {
          const before = C.items.length;
          host.innerHTML = '';
          const body = mk('div', { class: 'module-body' });
          host.appendChild(body);
          C.context = inLang(() => ({ module: id, tab, moduleLabel: t('mod.' + id + '.title'), tabLabel: '' }));
          inLang(() => impl.render(body));
          const selected = body.querySelector('[role="tab"][aria-selected="true"]');
          /* a table knows the id of its card from the page */
          C.items.slice(before).forEach(it => {
            it.tabLabel = selected ? selected.textContent : '';
            if (!it.id && it.el) { const card = it.el.closest('[id]'); it.id = card ? card.id : ''; }
          });
          const waits = C.waits();
          if (!waits.length) break;
          C.items.length = before;
          await Promise.all(waits.map(p => p.catch(() => null)));
        }
        if (tab && M) M.tab = saved;
        await new Promise(r => setTimeout(r, 0));
      }
    } finally {
      C.active = false;
      C.context = null;
      [window.ConceptualModule, window.IntellectualModule && IntellectualModule.co, window.IntellectualModule && IntellectualModule.cp, window.SocialModule && SocialModule.net]
        .forEach(store => { if (store) NetworkScreen.detach(store); });
      host.remove();
    }
    C.items.forEach((it, i) => { it.uid = i + 1; });
    return C.items;
  },
};

const ExportModule = {
  DEFAULTS: { figures: ['png'], tables: ['xlsx'], networks: ['graphml', 'csv'], data: ['csv', 'bibtex', 'synonyms'] },
  catalog: null,
  selected: null,
  busy: false,

  opts() { return Object.assign({}, ExportModule.DEFAULTS, Prefs.get('exportOptions', {})); },
  setOpts(patch) { Prefs.set('exportOptions', Object.assign(ExportModule.opts(), patch)); },

  rerender() {
    if (state.route !== 'export' || !Layout.view) return;
    App.render('export', { keepScroll: true, keepFocus: true });
  },

  help(key, title) {
    const base = 'export.help.' + key;
    return { title, text: t(base + '.text'), formula: I18N.has(base + '.formula') ? t(base + '.formula') : '', where: [], interpretation: I18N.has(base + '.interpretation') ? t(base + '.interpretation') : '', refs: (I18N.has(base + '.refs') ? t(base + '.refs').split('|') : []).map(r => t('refs.' + r)) };
  },

  card(page, id, titleKey, helpKey) {
    const card = mk('section', { class: 'card src-card ex-card', id });
    const h = mk('h2', null, esc(t(titleKey)));
    if (helpKey) h.appendChild(HelpPopover.button(ExportModule.help(helpKey, t(titleKey)), { label: t('metric.help') + ': ' + t(titleKey) }));
    card.appendChild(h);
    page.appendChild(card);
    return card;
  },

  checks(host, id, labelKey, values, chosen, onChange) {
    const fs = mk('fieldset', { class: 'ex-checks', id });
    fs.appendChild(mk('legend', null, esc(t(labelKey))));
    values.forEach(([value, text]) => {
      const lab = mk('label', { class: 'ex-check' });
      const input = mk('input', { type: 'checkbox', id: id + '-' + value, value });
      input.checked = chosen.includes(value);
      input.addEventListener('change', () => onChange([...fs.querySelectorAll('input:checked')].map(i => i.value)));
      lab.appendChild(input);
      lab.appendChild(mk('span', null, esc(text)));
      fs.appendChild(lab);
    });
    host.appendChild(fs);
    return fs;
  },

  TABS: ['files', 'report'],
  tab: 'files',

  render(body) {
    const M = ExportModule;
    body.innerHTML = '';
    if (!state.clean) { body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…')); return; }
    const page = mk('div', { class: 'authors-page export-page' });
    body.appendChild(page);
    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('export.tabsLabel') });
    M.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'extab-' + id, 'aria-controls': 'expanel', 'aria-selected': String(M.tab === id), tabindex: M.tab === id ? '0' : '-1' }, esc(t('export.tabs.' + id)));
      b.addEventListener('click', () => { M.tab = id; M.rerender(); const nb = el('extab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = M.TABS.indexOf(M.tab);
        M.tab = M.TABS[(i + (e.key === 'ArrowRight' ? 1 : M.TABS.length - 1)) % M.TABS.length];
        M.rerender();
        const nb = el('extab-' + M.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel src-panel', role: 'tabpanel', id: 'expanel', 'aria-labelledby': 'extab-' + M.tab });
    page.appendChild(panel);
    if (M.tab === 'report') M.renderReport(panel); else M.renderFiles(panel);
  },

  /* ---------------- report ---------------- */
  report: { model: null, busy: false },

  reportHelp(key, title) {
    const base = 'export.report.help.' + key;
    return { title, text: t(base + '.text'), formula: t(base + '.formula'), where: [], interpretation: t(base + '.interpretation'), refs: [] };
  },
  reportCard(page, id, titleKey, helpKey) {
    const card = mk('section', { class: 'card src-card ex-card', id });
    const h = mk('h2', null, esc(t(titleKey)));
    if (helpKey) h.appendChild(HelpPopover.button(ExportModule.reportHelp(helpKey, t(titleKey)), { label: t('metric.help') + ': ' + t(titleKey) }));
    card.appendChild(h);
    page.appendChild(card);
    return card;
  },

  textInput(id, label, value, onChange, attrs) {
    const lab = mk('label', { class: 'src-control rp-control', for: id });
    lab.appendChild(mk('span', { class: 'sf-label' }, esc(label)));
    const input = mk('input', Object.assign({ type: 'text', id, value: value == null ? '' : value }, attrs || {}));
    input.addEventListener('change', () => onChange(input.value.trim()));
    lab.appendChild(input);
    return lab;
  },

  renderReport(page) {
    const M = ExportModule, R = M.report, o = Report.options();
    const options = M.reportCard(page, 'rpOptions', 'export.report.options', 'options');
    const row = mk('div', { class: 'src-toolbar rp-options' });
    row.appendChild(M.textInput('rpTitle', t('export.report.title'), o.title, v => Report.setOptions({ title: v }), { placeholder: I18N.withLang(o.lang, () => t('report.defaults.title')) }));
    row.appendChild(M.textInput('rpAuthor', t('export.report.author'), o.author, v => Report.setOptions({ author: v })));
    row.appendChild(SourcesModule.select('rpLang', t('export.report.lang'), o.lang, I18N.available.map(l => [l, t('export.report.langs.' + l)]), v => { Report.setOptions({ lang: v }); M.rerender(); }));
    row.appendChild(SourcesModule.select('rpPage', t('export.report.page'), o.page, [['letter', t('export.report.pages.letter')], ['a4', t('export.report.pages.a4')]], v => Report.setOptions({ page: v })));
    const rows = mk('label', { class: 'src-control', for: 'rpRows' });
    rows.appendChild(mk('span', { class: 'sf-label' }, esc(t('export.report.rows'))));
    const ri = mk('input', { type: 'number', id: 'rpRows', min: 3, max: 50, step: 1, value: o.rows });
    ri.addEventListener('change', () => { const v = Math.min(50, Math.max(3, Math.round(+ri.value) || 10)); ri.value = v; Report.setOptions({ rows: v }); });
    rows.appendChild(ri);
    row.appendChild(rows);
    const grey = mk('label', { class: 'src-control', for: 'rpGrey' });
    const gi = mk('input', { type: 'checkbox', id: 'rpGrey' });
    gi.checked = !!o.grayscale;
    gi.addEventListener('change', () => Report.setOptions({ grayscale: gi.checked }));
    grey.appendChild(gi);
    grey.appendChild(mk('span', null, esc(t('export.report.grey'))));
    row.appendChild(grey);
    options.appendChild(row);
    M.checks(options, 'rpSec', 'export.report.sections', Report.SECTIONS.map(s => [s, t('report.sections.' + s)]), o.sections, v => { Report.setOptions({ sections: v }); const b = el('rpBuild'); if (b) b.disabled = R.busy || !v.length; });

    /* data sources */
    const sources = M.reportCard(page, 'rpSources', 'export.report.sourcesTitle', 'sources');
    sources.appendChild(mk('p', { class: 'hint' }, esc(t('export.report.sourcesHint'))));
    state.files.filter(f => f.count).forEach(f => {
      const info = Report.sourceInfo(f);
      const box = mk('div', { class: 'rp-source', 'data-file': f.id });
      box.appendChild(mk('p', { class: 'rp-source-file' }, esc(t('export.report.fileLabel', { file: ImportModule.fileLabel(f), records: tp('report.n.records', f.count) }))));
      const line = mk('div', { class: 'src-toolbar rp-source-row' });
      const generic = I18N.has('report.bases.' + f.source) ? t('report.bases.' + f.source) : t('report.bases.file');
      line.appendChild(M.textInput('rpLabel-' + f.id, t('export.report.label'), info.label, v => Report.setSourceInfo(f, { label: v }), { placeholder: generic }));
      line.appendChild(M.textInput('rpQuery-' + f.id, t('export.report.query'), info.query, v => Report.setSourceInfo(f, { query: v }), { class: 'rp-query' }));
      line.appendChild(M.textInput('rpDate-' + f.id, t('export.report.date'), info.date, v => Report.setSourceInfo(f, { date: v }), { type: 'date' }));
      box.appendChild(line);
      sources.appendChild(box);
    });

    /* build */
    const build = mk('section', { class: 'card src-card ex-card', id: 'rpBuildCard' });
    const bar = mk('div', { class: 'net-export-row' });
    const bb = mk('button', { type: 'button', class: 'btn btn-primary', id: 'rpBuild', disabled: R.busy || !o.sections.length }, icon('doc') + '<span>' + esc(t(R.model ? 'export.report.again' : 'export.report.build')) + '</span>');
    bb.addEventListener('click', () => M.buildReport());
    bar.appendChild(bb);
    build.appendChild(bar);
    build.appendChild(mk('p', { class: 'hint', id: 'rpStatus', 'aria-live': 'polite' }, esc(R.busy ? t('export.report.building') : '')));
    if (!o.sections.length) build.appendChild(mk('p', { class: 'note-warn', id: 'rpNoSections' }, icon('help') + '<span>' + esc(t('export.report.noSections')) + '</span>'));
    if (!R.model) build.appendChild(mk('p', { class: 'hint', id: 'rpEmpty' }, esc(t('export.report.empty'))));
    else if (R.model.records !== Pipeline.records()) build.appendChild(mk('p', { class: 'note-warn', id: 'rpStale' }, icon('help') + '<span>' + esc(t('export.report.stale')) + '</span>'));
    page.appendChild(build);
    if (!R.model) return;

    /* preview */
    const model = R.model;
    const prev = M.reportCard(page, 'rpPreview', 'export.report.preview', 'preview');
    prev.appendChild(mk('p', { class: 'hint', id: 'rpSummary' }, esc(t('export.report.summary', { figures: tp('export.report.figures', model.figures), tables: tp('export.report.tables', model.tables), lang: t('export.report.langs.' + model.lang) }))));
    const actions = mk('div', { class: 'net-export-row' });
    [['rpDocx', 'docx', 'download', () => M.downloadDocx()], ['rpPrint', 'print', 'doc', () => M.printReport()], ['rpHtml', 'html', 'download', () => M.downloadHtml()]].forEach(([id, key, ic, fn]) => {
      const b = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id, disabled: R.busy }, icon(ic) + '<span>' + esc(t('export.report.' + key)) + '</span>');
      b.addEventListener('click', fn);
      actions.appendChild(b);
    });
    prev.appendChild(actions);
    prev.appendChild(mk('p', { class: 'hint', id: 'rpFileStatus', 'aria-live': 'polite' }));
    const paper = mk('div', { class: 'report-preview' });
    paper.appendChild(mk('style', null, Report.CSS));
    const doc = mk('article', { class: 'report-doc', id: 'rpDoc', lang: model.lang });
    doc.innerHTML = Report.html(model);
    paper.appendChild(doc);
    prev.appendChild(paper);
  },

  async buildReport() {
    const M = ExportModule, R = M.report;
    if (R.busy) return null;
    const o = Report.options();
    if (!o.sections.length) return null;
    R.busy = true;
    M.rerender();
    const status = () => el('rpStatus');
    try {
      R.model = await Report.build(o, (f, label) => { const s = status(); if (s) s.textContent = t('export.report.buildingModule', { module: label, pct: fmtPct(f, 0) }); });
    } catch (e) {
      toast(t('export.report.failed', { msg: e.message }), 'error');
    } finally {
      R.busy = false;
      M.rerender();
    }
    return R.model;
  },

  reportFileName(ext) { return 'scimetricspro_' + slug(t('export.report.file')) + '_' + new Date().toISOString().slice(0, 10) + '.' + ext; },

  async downloadDocx() {
    const M = ExportModule, R = M.report;
    if (!R.model || R.busy) return null;
    R.busy = true;
    const buttons = ['rpDocx', 'rpPrint', 'rpHtml', 'rpBuild'].map(el).filter(Boolean);
    buttons.forEach(b => { b.disabled = true; });
    const status = el('rpFileStatus');
    try {
      const blob = await Report.docx(R.model, (f, title) => { if (status) status.textContent = t('export.report.preparing', { pct: fmtPct(f, 0), title }); });
      const name = M.reportFileName('docx');
      download(blob, name);
      if (status) status.textContent = t('export.report.done', { file: name });
      return { blob, name };
    } catch (e) {
      toast(t('export.report.failed', { msg: e.message }), 'error');
      if (status) status.textContent = '';
      return null;
    } finally {
      R.busy = false;
      buttons.forEach(b => { b.disabled = false; });
    }
  },

  downloadHtml() {
    const M = ExportModule, R = M.report;
    if (!R.model) return null;
    const blob = new Blob([Report.standalone(R.model)], { type: 'text/html;charset=utf-8' });
    const name = M.reportFileName('html');
    download(blob, name);
    return { blob, name };
  },

  /* the printable page in a hidden frame; the print dialog saves it as PDF */
  printWindow(win) { win.focus(); win.print(); },
  printReport() {
    const M = ExportModule, R = M.report;
    if (!R.model) return null;
    const old = el('rpPrintFrame');
    if (old) old.remove();
    const frame = mk('iframe', { id: 'rpPrintFrame', title: t('export.report.print'), 'aria-hidden': 'true', tabindex: '-1', style: 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0' });
    frame.addEventListener('load', () => { try { M.printWindow(frame.contentWindow); } catch (e) { toast(t('export.report.failed', { msg: e.message }), 'error'); } }, { once: true });
    frame.srcdoc = Report.standalone(R.model);
    document.body.appendChild(frame);
    return frame;
  },

  /* ---------------- files ---------------- */
  renderFiles(page) {
    const M = ExportModule;
    const o = M.opts(), fp = Fig.exportPrefs();

    /* formats */
    const formats = M.card(page, 'exFormats', 'export.formats.title', 'formats');
    const row = mk('div', { class: 'ex-format-grid' });
    M.checks(row, 'exFig', 'export.formats.figures', [['png', 'PNG'], ['tiff', 'TIFF'], ['svg', 'SVG'], ['pdf', 'PDF']], o.figures, v => M.setOpts({ figures: v }));
    M.checks(row, 'exTab', 'export.formats.tables', [['xlsx', t('export.formats.xlsx')], ['csv', 'CSV (UTF-8)']], o.tables, v => M.setOpts({ tables: v }));
    M.checks(row, 'exNet', 'export.formats.networks', [['graphml', 'GraphML'], ['gexf', 'GEXF'], ['net', t('network.export.net')], ['csv', t('network.export.csv')]], o.networks, v => M.setOpts({ networks: v }));
    M.checks(row, 'exData', 'export.formats.data', [['csv', t('export.data.csv')], ['bibtex', t('export.data.bibtex')], ['synonyms', t('export.data.synonyms')]], o.data, v => M.setOpts({ data: v }));
    formats.appendChild(row);
    /* size of the figures (shared with the export bar of every figure) */
    const size = mk('div', { class: 'src-toolbar ex-size' });
    const sel = SourcesModule.select('exWidth', t('export.size.width'), fp.size, [['8.5', t('export.size.one')], ['17', t('export.size.two')], ['custom', t('export.size.custom')], ['screen', t('export.size.screen')]], v => { Fig.setExportPrefs({ size: v }); M.rerender(); });
    size.appendChild(sel);
    const num = (id, label, value, min, max, step, key) => {
      const lab = mk('label', { class: 'src-control', for: id });
      lab.appendChild(mk('span', { class: 'sf-label' }, esc(label)));
      const input = mk('input', { type: 'number', id, min, max, step, value });
      input.addEventListener('change', () => { const v = Math.min(max, Math.max(min, +input.value || value)); input.value = v; Fig.setExportPrefs({ [key]: v }); });
      lab.appendChild(input);
      return lab;
    };
    if (fp.size === 'custom') size.appendChild(num('exCustom', t('export.size.cm'), fp.customCm, 2, 60, 0.1, 'customCm'));
    size.appendChild(num('exText', t('export.size.text'), fp.textPt, 5, 16, 0.5, 'textPt'));
    size.appendChild(SourcesModule.select('exDpi', t('export.size.dpi'), String(fp.dpi), [['300', '300 dpi'], ['600', '600 dpi'], ['1200', '1200 dpi']], v => Fig.setExportPrefs({ dpi: +v })));
    const grey = mk('label', { class: 'src-control', for: 'exGrey' });
    const gi = mk('input', { type: 'checkbox', id: 'exGrey' });
    gi.checked = !!fp.grayscale;
    gi.addEventListener('change', () => Fig.setExportPrefs({ grayscale: gi.checked }));
    grey.appendChild(gi);
    grey.appendChild(mk('span', null, esc(t('export.size.grey'))));
    size.appendChild(grey);
    formats.appendChild(size);
    formats.appendChild(mk('p', { class: 'hint', id: 'exSizeHint' }, esc(t('export.size.hint'))));

    /* data files, one by one */
    const data = M.card(page, 'exDataCard', 'export.data.title', 'data');
    data.appendChild(mk('p', { class: 'hint' }, esc(tp('export.data.hint', Pipeline.records().length))));
    const drow = mk('div', { class: 'net-export-row' });
    [['exDataCsv', 'csv'], ['exDataBib', 'bibtex'], ['exDataSyn', 'synonyms']].forEach(([id, kind]) => {
      const b = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id }, icon('download') + '<span>' + esc(t('export.data.' + kind)) + '</span>');
      b.addEventListener('click', () => { const f = M.dataFiles([kind])[0]; if (f) download(new Blob([f.data], { type: f.type }), f.name.split('/').pop()); });
      drow.appendChild(b);
    });
    data.appendChild(drow);

    /* figures, tables and networks of every module */
    const list = M.card(page, 'exList', 'export.list.title', 'list');
    const bar = mk('div', { class: 'net-export-row' });
    const find = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'exCollect', disabled: M.busy }, icon('search') + '<span>' + esc(t(M.catalog ? 'export.list.again' : 'export.list.find')) + '</span>');
    find.addEventListener('click', () => M.collect());
    bar.appendChild(find);
    if (M.catalog) {
      const all = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'exAll' }, esc(t('export.list.all')));
      all.addEventListener('click', () => { M.catalog.items.forEach(it => M.selected.add(it.uid)); M.rerender(); });
      const none = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'exNone' }, esc(t('export.list.none')));
      none.addEventListener('click', () => { M.selected.clear(); M.rerender(); });
      bar.appendChild(all); bar.appendChild(none);
    }
    list.appendChild(bar);
    if (M.catalog && M.catalog.records !== Pipeline.records()) list.appendChild(mk('p', { class: 'note-warn', id: 'exStale' }, icon('help') + '<span>' + esc(t('export.list.stale')) + '</span>'));
    if (!M.catalog) list.appendChild(mk('p', { class: 'hint', id: 'exEmpty' }, esc(t('export.list.empty'))));
    else M.renderCatalog(list);

    /* the package */
    const zip = M.card(page, 'exZipCard', 'export.zip.title', 'zip');
    const count = M.catalog ? M.catalog.items.filter(it => M.selected.has(it.uid)).length : 0;
    zip.appendChild(mk('p', { class: 'hint', id: 'exZipHint' }, esc(tp('export.zip.hint', count))));
    const zb = mk('button', { type: 'button', class: 'btn btn-primary', id: 'exZip', disabled: M.busy }, icon('download') + '<span>' + esc(t('export.zip.button')) + '</span>');
    zb.addEventListener('click', () => M.downloadZip());
    zip.appendChild(zb);
    zip.appendChild(mk('p', { class: 'hint', id: 'exZipStatus', 'aria-live': 'polite' }));
  },

  renderCatalog(host) {
    const M = ExportModule;
    const items = M.catalog.items;
    const counts = { figure: 0, table: 0, network: 0 };
    items.forEach(it => { counts[it.kind]++; });
    host.appendChild(mk('p', { class: 'hint', id: 'exFound' }, esc(t('export.list.found', { figures: tp('export.list.foundFigures', counts.figure), tables: tp('export.list.foundTables', counts.table), networks: tp('export.list.foundNetworks', counts.network) }))));
    const groups = new Map();
    items.forEach(it => { const k = it.module + '|' + (it.tab || ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
    const wrap = mk('div', { class: 'ex-groups' });
    for (const [k, list] of groups) {
      const first = list[0];
      const det = mk('details', { class: 'ex-group', 'data-group': k });
      const sum = mk('summary');
      const gcheck = mk('input', { type: 'checkbox', 'aria-label': first.moduleLabel + (first.tabLabel ? ' · ' + first.tabLabel : '') });
      gcheck.checked = list.every(it => M.selected.has(it.uid));
      gcheck.indeterminate = !gcheck.checked && list.some(it => M.selected.has(it.uid));
      gcheck.addEventListener('click', e => e.stopPropagation());
      gcheck.addEventListener('change', () => { list.forEach(it => (gcheck.checked ? M.selected.add(it.uid) : M.selected.delete(it.uid))); M.rerender(); });
      sum.appendChild(gcheck);
      sum.appendChild(mk('span', null, '<strong>' + esc(first.moduleLabel) + '</strong>' + (first.tabLabel ? ' · ' + esc(first.tabLabel) : '') + ' <span class="muted">(' + esc(tp('export.list.items', list.length)) + ')</span>'));
      det.appendChild(sum);
      const ul = mk('ul', { class: 'ex-items' });
      list.forEach(it => {
        const li = mk('li');
        const lab = mk('label', { for: 'exItem-' + it.uid });
        const input = mk('input', { type: 'checkbox', id: 'exItem-' + it.uid });
        input.checked = M.selected.has(it.uid);
        input.addEventListener('change', () => { if (input.checked) M.selected.add(it.uid); else M.selected.delete(it.uid); const hint = el('exZipHint'); if (hint) hint.textContent = tp('export.zip.hint', M.catalog.items.filter(x => M.selected.has(x.uid)).length); });
        lab.appendChild(input);
        lab.appendChild(mk('span', { class: 'ex-kind ex-kind-' + it.kind }, esc(t('export.kinds.' + it.kind))));
        lab.appendChild(mk('span', null, esc(it.title)));
        li.appendChild(lab);
        ul.appendChild(li);
      });
      det.appendChild(ul);
      wrap.appendChild(det);
    }
    host.appendChild(wrap);
  },

  async collect() {
    const M = ExportModule;
    if (M.busy) return;
    M.busy = true;
    M.rerender();
    const status = el('exList');
    const note = status ? mk('p', { class: 'note-info', id: 'exCollecting' }, icon('clock') + '<span>' + esc(t('export.list.collecting')) + '</span>') : null;
    if (note) status.appendChild(note);
    try {
      const items = await ExportCollector.collect((f, label) => { if (note) note.querySelector('span').textContent = t('export.list.collectingModule', { module: label, pct: fmtPct(f, 0) }); });
      M.catalog = { items, records: Pipeline.records() };
      M.selected = new Set(items.map(it => it.uid));
    } finally {
      M.busy = false;
      M.rerender();
    }
    return M.catalog;
  },

  /* file names: folder/NN_name.ext, numbered in the order of the modules */
  dataFiles(kinds) {
    const records = Pipeline.records(), out = [], folder = slug(t('export.folders.data'));
    if (kinds.includes('csv')) {
      const table = RecordExport.csvTable(records, key => t('export.fields.' + key));
      out.push({ name: folder + '/' + slug(t('export.files.records')) + '.csv', data: Exporter.csvText(table.columns, table.rows), type: 'text/csv;charset=utf-8' });
    }
    if (kinds.includes('bibtex')) out.push({ name: folder + '/' + slug(t('export.files.records')) + '.bib', data: RecordExport.bibtex(records), type: 'application/x-bibtex;charset=utf-8' });
    if (kinds.includes('synonyms')) out.push({ name: folder + '/' + slug(t('export.files.synonyms')) + '.csv', data: String.fromCharCode(0xFEFF) + Parsers.lib().synonymsToCsv(Pipeline.init().synonyms || []), type: 'text/csv;charset=utf-8' });
    return out;
  },

  async buildFiles(progress) {
    const M = ExportModule, o = M.opts();
    const files = [], index = [];
    const counters = { figure: 0, table: 0, network: 0 };
    const folders = { figure: slug(t('export.folders.figures')).toLowerCase(), table: slug(t('export.folders.tables')).toLowerCase(), network: slug(t('export.folders.networks')).toLowerCase() };
    const chosen = M.catalog ? M.catalog.items.filter(it => M.selected.has(it.uid)) : [];
    for (let i = 0; i < chosen.length; i++) {
      const it = chosen[i];
      if (progress) progress(i / Math.max(1, chosen.length), it.title);
      const n = String(++counters[it.kind]).padStart(2, '0');
      const base = folders[it.kind] + '/' + n + '_' + slug(it.file || it.title).toLowerCase();
      const record = name => index.push({ n: index.length + 1, kind: t('export.kinds.' + it.kind), module: it.moduleLabel, tab: it.tabLabel, title: it.title, file: name });
      if (it.kind === 'figure') {
        for (const format of o.figures) {
          /* white background, as the Export screen says, whatever was chosen in the bar of a figure */
          const blob = await it.fig.printBlob(format, { background: '#ffffff' });
          const name = base + '.' + (format === 'tiff' ? 'tif' : format);
          files.push({ name, data: blob });
          record(name);
        }
      } else if (it.kind === 'table') {
        const rows = it.rows();
        if (o.tables.includes('xlsx')) { const name = base + '.xlsx'; files.push({ name, data: Exporter.xlsxBlob([{ name: it.title, columns: it.columns, rows }]) }); record(name); }
        if (o.tables.includes('csv')) { const name = base + '.csv'; files.push({ name, data: Exporter.csvText(it.columns, rows) }); record(name); }
      } else {
        for (const f of GraphExport.files(it.net(), o.networks, it.labels)) { const name = base + f.suffix + '.' + f.ext; files.push({ name, data: f.data }); record(name); }
      }
      await new Promise(r => setTimeout(r, 0));
    }
    M.dataFiles(o.data).forEach(f => { files.push({ name: f.name, data: f.data }); index.push({ n: index.length + 1, kind: t('export.kinds.data'), module: t('mod.cleaning.title'), tab: '', title: f.name.split('/').pop(), file: f.name }); });
    const c = 'export.index.';
    files.unshift({ name: slug(t('export.files.index')) + '.csv', data: Exporter.csvText(['n', 'kind', 'module', 'tab', 'title', 'file'].map(k => ({ key: k, label: t(c + k) })), index) });
    return files;
  },

  async downloadZip() {
    const M = ExportModule;
    if (M.busy) return null;
    const status = el('exZipStatus');
    M.busy = true;
    const btn = el('exZip');
    if (btn) btn.disabled = true;
    try {
      const files = await M.buildFiles((f, title) => { if (status) status.textContent = t('export.zip.progress', { pct: fmtPct(f, 0), title }); });
      const blob = await Zip.build(files);
      const name = 'scimetricspro_' + slug(t('export.zip.file')) + '_' + new Date().toISOString().slice(0, 10) + '.zip';
      download(blob, name);
      if (status) status.textContent = tp('export.zip.done', files.length, { size: (blob.size / 1048576).toFixed(1) });
      return { blob, files, name };
    } catch (e) {
      toast(t('export.zip.failed', { msg: e.message }), 'error');
      if (status) status.textContent = '';
      return null;
    } finally {
      M.busy = false;
      if (btn) btn.disabled = false;
    }
  },
};

Modules.define('export', { render: body => ExportModule.render(body) });
on('cleanchange', () => ExportModule.rerender());
window.ExportCollector = ExportCollector;
window.ExportModule = ExportModule;
