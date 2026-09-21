/* SciMetricsPro — Documents module: most cited documents, local citations, cited references, RPYS,
   frequent words, word growth and trend topics (screens; the indicators are in js/metrics/documents.js).
   Reads Pipeline.records() and the term field chosen in Cleaning (Pipeline.terms). */
'use strict';

const DocumentsModule = {
  tab: 'cited',
  TABS: ['cited', 'local', 'references', 'rpys', 'words', 'growth', 'trends'],
  DEFAULT_UI: { citedMeasure: 'citations', citedN: 10, localN: 10, refN: 10, rpysFrom: null, rpysTo: null, wordsView: 'bars', wordsN: 20, cloudN: 100, treemapN: 30, growthN: 5, growthMode: 'cumulative', trendMin: 5, trendPerYear: 3 },
  ui: null,
  figs: {},
  cc: {},
  _cache: null,

  P() { return Parsers.lib(); },
  UI() { if (!DocumentsModule.ui) DocumentsModule.ui = Object.assign({}, DocumentsModule.DEFAULT_UI); return DocumentsModule.ui; },

  /* citations, local citations and reference clusters: again only when the filtered set or the reference year change.
     null while a worker computes the references of a large set; { cancelled: true } if the user cancelled it */
  data() {
    const records = Pipeline.records(), refYear = Pipeline.referenceYear();
    const refs = Pipeline.references();
    if (!refs || refs.cancelled) return refs;
    const c = DocumentsModule._cache;
    if (c && c.records === records && c.refYear === refYear && c.refs === refs) return c.data;
    const P = DocumentsModule.P();
    const { lc, clusters } = refs;
    const data = {
      refYear, records, lc, clusters,
      cited: P.citedDocuments(records, { refYear }),
      localRows: P.localCitationTable(records, lc),
      rpysAll: P.rpys(records, { clusters, top: 3 }),
    };
    DocumentsModule._cache = { records, refYear, refs, data };
    return data;
  },

  /* terms of the field chosen in Cleaning, per record, and their document counts */
  terms() { return Pipeline.termLists(); },

  rpysData(data) {
    const ui = DocumentsModule.UI();
    if (ui.rpysFrom == null && ui.rpysTo == null) return data.rpysAll;
    return DocumentsModule.P().rpys(data.records, { clusters: data.clusters, top: 3, from: ui.rpysFrom, to: ui.rpysTo });
  },

  rerender() {
    if (state.route !== 'documents' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('documents', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  help(key, title, refs) {
    const base = 'documents.help.' + key;
    const where = [];
    for (let i = 1; I18N.has(base + '.s' + i); i++) where.push([t(base + '.s' + i), t(base + '.m' + i)]);
    return {
      title, text: t(base + '.text'),
      formula: I18N.has(base + '.formula') ? t(base + '.formula') : '',
      where,
      interpretation: I18N.has(base + '.interpretation') ? t(base + '.interpretation') : '',
      refs: refs.map(r => t('refs.' + r)),
    };
  },

  render(body) {
    body.innerHTML = '';
    if (!state.clean) { body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…')); return; }
    const page = mk('div', { class: 'authors-page documents-page' });
    body.appendChild(page);
    const { shown, total } = Pipeline.counts();
    if (!shown) {
      page.appendChild(EmptyState.create({ icon: 'filter', title: t('overview.noDocs'), text: t('overview.noDocsText'), actions: [{ label: t('overview.reviewFilters'), icon: 'filter', primary: true, onClick: () => { CleaningModule.tab = 'filters'; App.go('cleaning'); } }] }));
      return;
    }
    if (shown < total) page.appendChild(mk('p', { class: 'note-info', id: 'dcFiltered' }, icon('filter') + '<span>' + esc(tp('overview.filteredNote', shown, { total: fmtInt(total) })) + '</span>'));
    const data = DocumentsModule.data();
    if (!data) { DocumentsModule.note(page, 'dcPending', t('documents.pending'), false, 'clock'); return; }
    if (data.cancelled) {
      const p = DocumentsModule.note(page, 'dcCancelled', t('documents.cancelled'), true);
      const retry = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'dcRetry' }, esc(t('documents.retry')));
      retry.addEventListener('click', () => { Pipeline.retryReferences(); DocumentsModule.rerender(); });
      p.appendChild(retry);
      return;
    }
    page.appendChild(DocumentsModule.cards(data, DocumentsModule.terms()));

    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('documents.tabsLabel') });
    const TABS = DocumentsModule.TABS;
    TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'dtab-' + id, 'aria-controls': 'dpanel', 'aria-selected': String(DocumentsModule.tab === id), tabindex: DocumentsModule.tab === id ? '0' : '-1' }, esc(t('documents.tabs.' + id)));
      b.addEventListener('click', () => { DocumentsModule.tab = id; DocumentsModule.rerender(); const nb = el('dtab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = TABS.indexOf(DocumentsModule.tab);
        DocumentsModule.tab = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
        DocumentsModule.rerender();
        const nb = el('dtab-' + DocumentsModule.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel src-panel', role: 'tabpanel', id: 'dpanel', 'aria-labelledby': 'dtab-' + DocumentsModule.tab });
    DocumentsModule['render_' + DocumentsModule.tab](panel, data);
    page.appendChild(panel);
  },

  cards(data, terms) {
    const c = 'documents.cards.';
    const top = data.cited.rows[0];
    const st = data.lc.stats;
    const noRefs = !st.references;
    const peak = data.rpysAll.peaks[0];
    const P = DocumentsModule.P();
    const refs = { citations: ['aria2017'], topCited: ['aria2017'], local: ['garfield2003'], references: ['aria2017'], rpysPeak: ['marx2014'], terms: ['aria2017'] };
    const spec = (key, value, sub, iconName, tone) => ({ key, label: t(c + key), value, sub, icon: iconName, tone, help: DocumentsModule.help(key + 'Card', t(c + key), refs[key]) });
    const list = [
      spec('citations', data.cited.withCitations ? fmtInt(data.cited.total) : null, data.cited.withCitations ? tp(c + 'citationsSub', data.cited.withCitations) : t('sources.cards.noCitations'), 'quote', 'primary'),
      spec('topCited', top ? fmtInt(top.citations) : null, top ? top.label : t('sources.cards.noCitations'), 'doc', 'accent'),
      spec('local', noRefs ? null : fmtInt(st.links), noRefs ? t(c + 'noReferences') : tp(c + 'localSub', st.citedDocs), 'network', 'teal'),
      spec('references', noRefs ? null : fmtInt(data.clusters.rows.length), noRefs ? t(c + 'noReferences') : tp(c + 'referencesSub', data.clusters.docs, { citations: tp(c + 'referencesCitations', data.clusters.total) }), 'sigma', 'rose'),
      spec('rpysPeak', peak ? String(peak.year) : null, peak ? (peak.top[0] ? P.referenceShort(peak.top[0], 70) : tp(c + 'rpysSub', peak.n)) : t(c + 'noYears'), 'calendar', 'primary'),
      spec('terms', terms.counts.length ? fmtInt(terms.counts.length) : null, t(c + 'termsSub', { field: t('cleaning.termFields.' + terms.field) }), 'tag', 'teal'),
    ];
    const grid = MetricCard.grid(null, list);
    grid.id = 'dcCards';
    [...grid.children].forEach((card, i) => { card.dataset.key = list[i].key; });
    return grid;
  },

  select(id, label, value, options, onChange) { return SourcesModule.select(id, label, value, options, onChange); },
  toolbar(panel, controls) { return AuthorsModule.toolbar(panel, controls); },
  nOptions(list) { return list.map(v => [v, String(v)]); },
  set(key, v) { DocumentsModule.UI()[key] = v; DocumentsModule.rerender(); },
  /* text: one sentence, or several (each from the dictionaries) written one after another */
  note(panel, id, text, warn, iconName) {
    const p = mk('p', { class: warn ? 'note-warn' : 'note-info', id, role: warn ? 'note' : null }, icon(iconName || (warn ? 'help' : 'quote')) + '<span>' + [].concat(text).filter(Boolean).map(s => '<span>' + esc(s) + '</span>').join(' ') + '</span>');
    panel.appendChild(p);
    return p;
  },
  yearInput(id, label, value, min, max, onChange) {
    const wrap = mk('label', { class: 'src-control', for: id });
    wrap.appendChild(mk('span', { class: 'sf-label' }, esc(label)));
    const input = mk('input', { type: 'number', id, min, max, step: 1, value: value != null ? value : '' });
    input.addEventListener('change', () => onChange(input.value));
    wrap.appendChild(input);
    return wrap;
  },

  chart(host, id, o, keep) {
    const prev = DocumentsModule.figs[id];
    const defaults = Object.assign({}, o.defaults);
    if (prev) (keep || []).forEach(k => { if (prev[k] !== undefined) defaults[k] = prev[k]; });
    const cc = ChartCard.mount(host, Object.assign({}, o, { id, defaults }));
    if (cc.fig) DocumentsModule.figs[id] = cc.fig.cfg;
    DocumentsModule.cc[id] = cc;
    return cc;
  },

  tableCard(panel, id, title, helpKey, refs, dtOpts, hint) {
    const card = mk('section', { class: 'card src-card', id });
    const h = mk('h2', null, esc(title));
    if (helpKey) h.appendChild(HelpPopover.button(DocumentsModule.help(helpKey, title, refs), { label: t('metric.help') + ': ' + title }));
    card.appendChild(h);
    if (hint) card.appendChild(mk('p', { class: 'hint' }, esc(hint)));
    card.appendChild(DataTable.create(Object.assign({ pageSize: 25, fileName: slug(title), title }, dtOpts)).el);
    panel.appendChild(card);
    return card;
  },

  pal(i) { return Fig.color('scimetrics', i); },
  barKeep: ['barColor', 'maxLabel', 'showValues', 'flip', 'width'],
  col(key) { return t('documents.col.' + key); },

  /* document columns shared by the tables */
  docColumns(data) {
    const rec = r => data.records[r.index];
    return {
      label: { key: 'label', label: DocumentsModule.col('document'), cls: 'col-nowrap' },
      title: { key: 'title', label: DocumentsModule.col('title'), cls: 'col-wide', clamp: true, get: r => rec(r).title },
      year: { key: 'year', label: t('sources.col.year'), type: 'year' },
      doi: { key: 'doi', label: DocumentsModule.col('doi'), get: r => rec(r).doi || '' },
    };
  },

  noReferences(panel, data) {
    if (data.lc.stats.references) return false;
    DocumentsModule.note(panel, 'dcNoRefs', t('documents.noReferences'));
    return true;
  },

  /* ---------------- most cited documents ---------------- */
  render_cited(panel, data) {
    const ui = DocumentsModule.UI();
    const yi = DocumentsModule.yearInput('dcRefYear', t('overview.refYear'), Pipeline.referenceYear(), 1900, 2200, v => Pipeline.setReferenceYear(v));
    DocumentsModule.toolbar(panel, [
      DocumentsModule.select('dcCitedMeasure', t('sources.controls.measure'), ui.citedMeasure, ['citations', 'perYear', 'normalized'].map(m => [m, t('documents.measures.' + m)]), v => DocumentsModule.set('citedMeasure', v)),
      DocumentsModule.select('dcCitedN', t('authors.controls.topN'), ui.citedN, DocumentsModule.nOptions([5, 10, 15, 20, 25, 30, 40, 50]), v => DocumentsModule.set('citedN', +v)),
      yi,
    ]);
    const cited = data.cited;
    if (!cited.rows.length) { DocumentsModule.note(panel, 'dcNoCitations', t('sources.impact.noCitations')); return; }
    const m = ui.citedMeasure;
    const rows = cited.rows.filter(r => r[m] != null).sort((a, b) => b[m] - a[m] || b.citations - a.citations || a.rank - b.rank).slice(0, ui.citedN);
    const label = t('documents.measures.' + m);
    const title = tp('documents.cited.title', rows.length, { measure: label.toLowerCase() });
    const helpKey = { citations: 'cited', perYear: 'perYear', normalized: 'normalized' }[m];
    DocumentsModule.chart(panel, 'dcTop', {
      title, subtitle: t('documents.cited.sub', { year: data.refYear }), help: DocumentsModule.help(helpKey, title, ['aria2017']),
      width: 900, height: SourcesModule.barHeight(Math.max(rows.length, 3)), fileName: slug(t('documents.cited.file')),
      data: () => ({ columns: [{ key: 'label', label: DocumentsModule.col('document') }, { key: 'title', label: DocumentsModule.col('title') }, { key: 'year', label: t('sources.col.year') }, { key: 'citations', label: t('documents.measures.citations') }, { key: 'perYear', label: t('documents.measures.perYear') }, { key: 'normalized', label: t('documents.measures.normalized') }],
        rows: rows.map(r => Object.assign({ title: data.records[r.index].title }, r)) }),
      controls: Charts.rankBarsControls({}),
      defaults: { title, subtitle: '', xlab: '', ylab: label, flip: true, barColor: DocumentsModule.pal(0), maxLabel: 60, showValues: true },
      render: cfg => Charts.rankBars(cfg, { labels: rows.map(r => r.label), values: rows.map(r => r[m]), integer: m === 'citations', decimals: 2 }),
    }, DocumentsModule.barKeep);
    const dc = DocumentsModule.docColumns(data);
    DocumentsModule.tableCard(panel, 'dcCitedTable', t('documents.cited.tableTitle'), 'citedTable', ['aria2017'], {
      columns: [
        { key: 'rank', label: t('authors.col.rank'), type: 'int' },
        dc.label, dc.title, dc.year,
        { key: 'citations', label: t('documents.measures.citations'), type: 'int' },
        { key: 'perYear', label: t('documents.measures.perYear'), type: 'num', fmt: v => (v == null ? '—' : fmtNum(v, 2)) },
        { key: 'normalized', label: t('documents.measures.normalized'), type: 'num', fmt: v => (v == null ? '—' : fmtNum(v, 2)) },
        dc.doi,
      ],
      rows: cited.rows, sort: { key: 'rank', dir: 'asc' },
    }, cited.withCitations < data.records.length ? tp('documents.cited.hint', data.records.length - cited.withCitations) : '');
  },

  /* ---------------- local citations ---------------- */
  render_local(panel, data) {
    if (DocumentsModule.noReferences(panel, data)) return;
    const ui = DocumentsModule.UI();
    const st = data.lc.stats;
    DocumentsModule.note(panel, 'dcMatchInfo', [t('documents.local.matched', { matched: fmtInt(st.matched), references: fmtInt(st.references), doi: fmtInt(st.byDoi), id: fmtInt(st.byId), bib: fmtInt(st.byBib) }), st.ambiguous ? tp('documents.local.ambiguous', st.ambiguous) : ''], false, 'network');
    const exceeds = data.localRows.filter(r => r.exceeds);
    if (exceeds.length) DocumentsModule.note(panel, 'dcExceeds', tp('documents.local.exceeds', exceeds.length), true);
    DocumentsModule.toolbar(panel, [DocumentsModule.select('dcLocalN', t('authors.controls.topN'), ui.localN, DocumentsModule.nOptions([5, 10, 15, 20, 25, 30, 40, 50]), v => DocumentsModule.set('localN', +v))]);
    const rows = data.localRows.filter(r => r.local > 0).slice(0, ui.localN);
    if (!rows.length) DocumentsModule.note(panel, 'dcNoLocal', t('documents.local.none'));
    else {
      const title = tp('documents.local.title', rows.length);
      DocumentsModule.chart(panel, 'dcLocal', {
        title, subtitle: t('documents.local.sub'), help: DocumentsModule.help('local', title, ['garfield2003']),
        width: 900, height: SourcesModule.barHeight(Math.max(rows.length, 3)), fileName: slug(t('documents.local.file')),
        data: () => ({ columns: [{ key: 'label', label: DocumentsModule.col('document') }, { key: 'title', label: DocumentsModule.col('title') }, { key: 'local', label: t('documents.measures.local') }, { key: 'global', label: t('documents.measures.global') }, { key: 'ratio', label: t('documents.measures.ratio') }],
          rows: rows.map(r => Object.assign({ title: data.records[r.index].title }, r)) }),
        controls: Charts.rankBarsControls({}),
        defaults: { title, subtitle: '', xlab: '', ylab: t('documents.measures.local'), flip: true, barColor: DocumentsModule.pal(2), maxLabel: 60, showValues: true },
        render: cfg => Charts.rankBars(cfg, { labels: rows.map(r => r.label), values: rows.map(r => r.local), integer: true }),
      }, DocumentsModule.barKeep);
    }
    const dc = DocumentsModule.docColumns(data);
    DocumentsModule.tableCard(panel, 'dcLocalTable', t('documents.local.tableTitle'), 'localTable', ['garfield2003'], {
      columns: [
        { key: 'rank', label: t('authors.col.rank'), type: 'int' },
        dc.label, dc.title, dc.year,
        { key: 'local', label: t('documents.measures.local'), type: 'int' },
        { key: 'global', label: t('documents.measures.global'), type: 'int' },
        { key: 'ratio', label: t('documents.measures.ratio'), type: 'pct', fmt: (v, r) => (v == null ? '—' : fmtPct(v, 1) + (r.exceeds ? ' ▲' : '')) },
        { key: 'localReferences', label: t('documents.measures.localReferences'), type: 'int' },
        dc.doi,
      ],
      rows: data.localRows, sort: { key: 'rank', dir: 'asc' },
    }, t('documents.local.hint'));
  },

  /* ---------------- most cited references ---------------- */
  render_references(panel, data) {
    if (DocumentsModule.noReferences(panel, data)) return;
    const ui = DocumentsModule.UI();
    const P = DocumentsModule.P();
    const cl = data.clusters;
    if (data.records.some(r => r.source === 'openapi' && r.references.length)) DocumentsModule.note(panel, 'dcRefIds', t('documents.refs.catalogueIds'));
    DocumentsModule.toolbar(panel, [DocumentsModule.select('dcRefN', t('authors.controls.topN'), ui.refN, DocumentsModule.nOptions([5, 10, 15, 20, 25, 30, 40, 50]), v => DocumentsModule.set('refN', +v))]);
    const rows = cl.rows.slice(0, ui.refN);
    const title = tp('documents.refs.title', rows.length);
    DocumentsModule.chart(panel, 'dcRefs', {
      title, subtitle: t('documents.refs.sub'), help: DocumentsModule.help('references', title, ['aria2017']),
      width: 900, height: SourcesModule.barHeight(Math.max(rows.length, 3)), fileName: slug(t('documents.refs.file')),
      data: () => ({ columns: [{ key: 'label', label: DocumentsModule.col('reference') }, { key: 'year', label: t('sources.col.year') }, { key: 'citations', label: t('documents.measures.citingDocs') }, { key: 'occurrences', label: t('documents.measures.occurrences') }, { key: 'doi', label: DocumentsModule.col('doi') }], rows }),
      controls: Charts.rankBarsControls({}),
      defaults: { title, subtitle: '', xlab: '', ylab: t('documents.measures.citingDocs'), flip: true, barColor: DocumentsModule.pal(3), maxLabel: 60, showValues: true },
      render: cfg => Charts.rankBars(cfg, { labels: P.referenceShortList(rows, 200), values: rows.map(r => r.citations), integer: true }),
    }, DocumentsModule.barKeep);
    DocumentsModule.tableCard(panel, 'dcRefTable', t('documents.refs.tableTitle'), 'referencesTable', ['aria2017'], {
      columns: [
        { key: 'rank', label: t('authors.col.rank'), type: 'int' },
        { key: 'label', label: DocumentsModule.col('reference'), cls: 'col-wide', clamp: true },
        { key: 'year', label: t('sources.col.year'), type: 'year' },
        { key: 'citations', label: t('documents.measures.citingDocs'), type: 'int' },
        { key: 'occurrences', label: t('documents.measures.occurrences'), type: 'int' },
        { key: 'doi', label: DocumentsModule.col('doi') },
        { key: 'local', label: t('documents.refs.inCollection'), get: r => (r.local >= 0 ? P.documentLabel(data.records[r.local]) : '') },
      ],
      rows: cl.rows, sort: { key: 'rank', dir: 'asc' },
    }, tp('documents.refs.hint', cl.rows.length, { refs: tp('documents.refs.hintRefs', cl.total) }));
  },

  /* ---------------- reference publication year spectroscopy ---------------- */
  render_rpys(panel, data) {
    if (DocumentsModule.noReferences(panel, data)) return;
    const all = data.rpysAll;
    if (!all.withYear) { DocumentsModule.note(panel, 'dcNoRefYears', t('documents.rpys.noYears')); return; }
    const ui = DocumentsModule.UI();
    const P = DocumentsModule.P();
    const R = DocumentsModule.rpysData(data);
    const reset = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'dcRpysReset' }, esc(t('documents.rpys.reset')));
    reset.addEventListener('click', () => { ui.rpysFrom = null; ui.rpysTo = null; DocumentsModule.rerender(); });
    const yearOf = v => { const y = parseInt(v, 10); return isFinite(y) ? y : null; };
    DocumentsModule.toolbar(panel, [
      DocumentsModule.yearInput('dcRpysFrom', t('documents.rpys.from'), R.from, all.minYear, all.maxYear, v => DocumentsModule.set('rpysFrom', yearOf(v))),
      DocumentsModule.yearInput('dcRpysTo', t('documents.rpys.to'), R.to, all.minYear, all.maxYear, v => DocumentsModule.set('rpysTo', yearOf(v))),
      reset,
    ]);
    if (all.withYear < all.total) DocumentsModule.note(panel, 'dcRpysMissing', tp('documents.rpys.missing', all.total - all.withYear, { refs: tp('documents.rpys.missingRefs', all.total) }));
    const title = t('documents.rpys.title');
    /* the note of a peak: its most cited reference (which already carries the year) or the year alone */
    const peakText = p => (p.top[0] ? (p.top[0].year != null && p.top[0].firstAuthor ? '' : p.year + ' · ') + P.referenceShortList(p.top, 200)[0] : String(p.year));
    DocumentsModule.chart(panel, 'dcRpys', {
      title, subtitle: t('documents.rpys.sub', { from: R.from, to: R.to }), help: DocumentsModule.help('rpys', title, ['marx2014']),
      width: 960, height: 520, fileName: slug(t('documents.rpys.file')),
      data: () => ({ columns: [{ key: 'year', label: t('documents.rpys.col.year') }, { key: 'n', label: t('documents.rpys.col.n') }, { key: 'median', label: t('documents.rpys.col.median') }, { key: 'deviation', label: t('documents.rpys.col.deviation') }, { key: 'top', label: t('documents.rpys.col.top') }],
        rows: R.rows.map(r => Object.assign({}, r, { top: P.referenceShortList(r.top, 200).join('; ') })) }),
      controls: Charts.rpysControls({ line: t('documents.rpys.deviation') }),
      defaults: { title, subtitle: '', xlab: t('documents.rpys.xlab'), ylab: t('documents.rpys.ylab'), barColor: DocumentsModule.pal(0), lineColor: DocumentsModule.pal(3), showLine: true, peakLabels: 5, maxLabel: 45, legendPos: 'left' },
      render: cfg => Charts.rpys(cfg, { years: R.rows.map(r => r.year), counts: R.rows.map(r => r.n), deviation: R.rows.map(r => r.deviation), peaks: R.peaks.map(p => ({ year: p.year, text: peakText(p) })), labels: { bars: t('documents.rpys.bars'), line: t('documents.rpys.deviation') } }),
    }, ['barColor', 'lineColor', 'showLine', 'peakLabels', 'maxLabel', 'legendPos', 'width', 'height']);
    const cols = [
      { key: 'year', label: t('documents.rpys.col.year'), type: 'year' },
      { key: 'n', label: t('documents.rpys.col.n'), type: 'int' },
      { key: 'median', label: t('documents.rpys.col.median'), type: 'num', fmt: v => fmtNum(v, 1) },
      { key: 'deviation', label: t('documents.rpys.col.deviation'), type: 'num', fmt: v => fmtNum(v, 1) },
      { key: 'top', label: t('documents.rpys.col.top'), cls: 'col-wide', clamp: true, get: r => { const names = P.referenceShortList(r.top, 200); return r.top.map((x, i) => names[i] + ' (' + fmtInt(x.occurrences) + ')').join('; '); } },
    ];
    DocumentsModule.tableCard(panel, 'dcPeaks', t('documents.rpys.peaksTitle'), 'rpysPeaks', ['marx2014'], { columns: cols, rows: R.peaks, sort: { key: 'deviation', dir: 'desc' }, pageSize: 10 }, t('documents.rpys.peaksHint'));
    DocumentsModule.tableCard(panel, 'dcRpysTable', t('documents.rpys.tableTitle'), 'rpysTable', ['marx2014'], { columns: cols, rows: R.rows, sort: { key: 'year', dir: 'asc' } });
  },

  /* ---------------- frequent words ---------------- */
  fieldSelect() {
    const P = DocumentsModule.P();
    return DocumentsModule.select('dcField', t('documents.words.field'), Pipeline.init().termField, P.TERM_FIELDS.map(f => [f, t('cleaning.termFields.' + f)]), v => Pipeline.update({ termField: v }));
  },

  noTerms(panel, terms) {
    if (terms.counts.length) return false;
    DocumentsModule.note(panel, 'dcNoTerms', t('documents.words.none', { field: t('cleaning.termFields.' + terms.field).toLowerCase() }));
    return true;
  },

  render_words(panel) {
    const ui = DocumentsModule.UI();
    const terms = DocumentsModule.terms();
    const view = ui.wordsView;
    const nKey = { bars: 'wordsN', cloud: 'cloudN', treemap: 'treemapN' }[view];
    const nList = { bars: [10, 15, 20, 25, 30, 40, 50], cloud: [25, 50, 75, 100, 150, 200], treemap: [10, 20, 30, 40, 50, 75, 100] }[view];
    DocumentsModule.toolbar(panel, [
      DocumentsModule.fieldSelect(),
      DocumentsModule.select('dcWordsView', t('documents.words.view'), view, ['bars', 'cloud', 'treemap'].map(v => [v, t('documents.words.views.' + v)]), v => DocumentsModule.set('wordsView', v)),
      DocumentsModule.select('dcWordsN', t('documents.words.topN'), ui[nKey], DocumentsModule.nOptions(nList), v => DocumentsModule.set(nKey, +v)),
    ]);
    const hint = mk('p', { class: 'hint', id: 'dcFieldHint' }, esc(t('documents.words.fieldHint')));
    panel.appendChild(hint);
    if (DocumentsModule.noTerms(panel, terms)) return;
    const n = Math.min(ui[nKey], terms.counts.length);
    const items = terms.counts.slice(0, n);
    const fieldName = t('cleaning.termFields.' + terms.field);
    const dataFn = () => ({ columns: [{ key: 'term', label: DocumentsModule.col('term') }, { key: 'docs', label: t('authors.col.documents') }], rows: items });
    const docsLabel = t('authors.col.documents');
    if (view === 'bars') {
      const title = tp('documents.words.titleBars', n);
      DocumentsModule.chart(panel, 'dcWordBars', {
        title, subtitle: t('documents.words.sub', { field: fieldName }), help: DocumentsModule.help('words', title, ['aria2017']),
        width: 900, height: SourcesModule.barHeight(Math.max(n, 3)), fileName: slug(t('documents.words.file')), data: dataFn,
        controls: Charts.rankBarsControls({}),
        defaults: { title, subtitle: '', xlab: '', ylab: docsLabel, flip: true, barColor: DocumentsModule.pal(1), maxLabel: 50, showValues: true },
        render: cfg => Charts.rankBars(cfg, { labels: items.map(x => x.term), values: items.map(x => x.docs), integer: true }),
      }, DocumentsModule.barKeep);
    } else if (view === 'cloud') {
      const title = tp('documents.words.titleCloud', n);
      DocumentsModule.chart(panel, 'dcCloud', {
        title, subtitle: t('documents.words.sub', { field: fieldName }), help: DocumentsModule.help('cloud', title, ['aria2017']),
        width: 960, height: 600, fileName: slug(t('documents.words.cloudFile')), data: dataFn,
        controls: Charts.wordCloudControls(),
        defaults: { title, subtitle: '', colorBy: 'palette', palette: 'scimetrics', colormap: 'viridis', minFont: 11, maxFont: 60, rotate: 'none', bold: true },
        render: cfg => Charts.wordCloud(cfg, { words: items.map(x => ({ label: x.term, value: x.docs })) }),
      }, ['colorBy', 'palette', 'colormap', 'minFont', 'maxFont', 'rotate', 'bold', 'width', 'height']);
    } else {
      const title = tp('documents.words.titleTreemap', n);
      DocumentsModule.chart(panel, 'dcTreemap', {
        title, subtitle: t('documents.words.sub', { field: fieldName }), help: DocumentsModule.help('treemap', title, ['bruls2000']),
        width: 960, height: 600, fileName: slug(t('documents.words.treemapFile')), data: dataFn,
        controls: Charts.treemapControls(),
        defaults: { title, subtitle: '', colorBy: 'palette', palette: 'scimetrics', colormap: 'viridis', borderColor: '#ffffff', showValues: true, maxLabel: 40 },
        render: cfg => Charts.treemap(cfg, { items: items.map(x => ({ label: x.term, value: x.docs })) }),
      }, ['colorBy', 'palette', 'colormap', 'borderColor', 'showValues', 'maxLabel', 'width', 'height']);
    }
    const docs = Pipeline.records().length;
    DocumentsModule.tableCard(panel, 'dcWordTable', t('documents.words.tableTitle'), 'wordTable', ['aria2017'], {
      columns: [
        { key: 'rank', label: t('authors.col.rank'), type: 'int' },
        { key: 'term', label: DocumentsModule.col('term'), cls: 'col-wide' },
        { key: 'docs', label: t('authors.col.documents'), type: 'int' },
        { key: 'share', label: t('sources.col.share'), type: 'pct' },
      ],
      rows: terms.counts.map((x, i) => ({ rank: i + 1, term: x.term, docs: x.docs, share: docs ? x.docs / docs : null })), sort: { key: 'rank', dir: 'asc' },
    }, tp('documents.words.hint', terms.withTerms, { docs: tp('documents.words.hintDocs', docs) }));
  },

  /* ---------------- word growth ---------------- */
  render_growth(panel) {
    const ui = DocumentsModule.UI();
    const terms = DocumentsModule.terms();
    DocumentsModule.toolbar(panel, [
      DocumentsModule.fieldSelect(),
      DocumentsModule.select('dcGrowthN', t('documents.words.topN'), ui.growthN, DocumentsModule.nOptions([3, 5, 8, 10, 15]), v => DocumentsModule.set('growthN', +v)),
      DocumentsModule.select('dcGrowthMode', t('documents.growth.mode'), ui.growthMode, ['cumulative', 'annual'].map(v => [v, t('documents.growth.modes.' + v)]), v => DocumentsModule.set('growthMode', v)),
    ]);
    if (DocumentsModule.noTerms(panel, terms)) return;
    const top = terms.counts.slice(0, ui.growthN);
    const G = DocumentsModule.P().termGrowth(Pipeline.records(), terms.lists, top.map(x => x.key));
    if (!G.years.length) { DocumentsModule.note(panel, 'dcNoGrowthYears', t('documents.growth.noYears')); return; }
    const cum = ui.growthMode === 'cumulative';
    const title = tp(cum ? 'documents.growth.titleCumulative' : 'documents.growth.titleAnnual', top.length);
    const series = G.series.map((s, i) => ({ label: top[i].term, values: cum ? s.cumulative : s.annual }));
    DocumentsModule.chart(panel, 'dcGrowth', {
      title, subtitle: t('documents.words.sub', { field: t('cleaning.termFields.' + terms.field) }), help: DocumentsModule.help('growth', title, ['aria2017']),
      width: 900, height: 480, fileName: slug(t('documents.growth.file')),
      data: () => ({ columns: [{ key: 'year', label: t('sources.col.year') }].concat(series.map((s, i) => ({ key: 's' + i, label: s.label }))), rows: G.years.map((y, k) => Object.assign({ year: y }, ...series.map((s, i) => ({ ['s' + i]: s.values[k] })))) }),
      controls: Charts.linesControls(),
      defaults: { title, subtitle: '', xlab: t('sources.col.year'), ylab: t(cum ? 'documents.growth.ylabCumulative' : 'documents.growth.ylabAnnual'), palette: 'scimetrics', markers: G.years.length <= 30, maxLabel: 40, legendPos: 'bottom' },
      render: cfg => Charts.lines(cfg, { years: G.years, series, integer: true }),
    }, ['palette', 'markers', 'maxLabel', 'legendPos', 'width', 'height']);
  },

  /* ---------------- trend topics ---------------- */
  render_trends(panel) {
    const ui = DocumentsModule.UI();
    const terms = DocumentsModule.terms();
    DocumentsModule.toolbar(panel, [
      DocumentsModule.fieldSelect(),
      DocumentsModule.select('dcTrendMin', t('documents.trends.minFreq'), ui.trendMin, DocumentsModule.nOptions([2, 3, 4, 5, 8, 10, 15, 20, 30, 50]), v => DocumentsModule.set('trendMin', +v)),
      DocumentsModule.select('dcTrendPerYear', t('documents.trends.perYear'), ui.trendPerYear, DocumentsModule.nOptions([1, 2, 3, 4, 5, 8, 10]), v => DocumentsModule.set('trendPerYear', +v)),
    ]);
    if (DocumentsModule.noTerms(panel, terms)) return;
    const T = DocumentsModule.P().trendTopics(Pipeline.records(), terms.lists, { minFreq: ui.trendMin, perYear: ui.trendPerYear });
    const label = x => terms.labels.get(x.key) || x.key;
    if (!T.selected.length) { DocumentsModule.note(panel, 'dcNoTrends', t('documents.trends.none', { min: ui.trendMin })); return; }
    const rows = T.selected.map(x => Object.assign({ label: label(x) }, x));
    const title = t('documents.trends.title');
    DocumentsModule.chart(panel, 'dcTrends', {
      title, subtitle: t('documents.trends.sub', { min: ui.trendMin, perYear: ui.trendPerYear }), help: DocumentsModule.help('trends', title, ['aria2017', 'hyndman1996']),
      width: 900, height: Math.max(360, 150 + rows.length * 22), fileName: slug(t('documents.trends.file')),
      data: () => ({ columns: DocumentsModule.trendColumns(false), rows }),
      controls: Charts.trendTopicsControls(),
      defaults: { title, subtitle: '', xlab: t('sources.col.year'), lineColor: DocumentsModule.pal(0), pointColor: DocumentsModule.pal(1), maxRadius: 9, maxLabel: 40 },
      render: cfg => Charts.trendTopics(cfg, { rows, sizeLabel: t('authors.col.documents') }),
    }, ['lineColor', 'pointColor', 'maxRadius', 'maxLabel', 'width']);
    DocumentsModule.tableCard(panel, 'dcTrendTable', t('documents.trends.tableTitle'), 'trendTable', ['hyndman1996'], {
      columns: DocumentsModule.trendColumns(true), rows: T.terms.map(x => Object.assign({ label: label(x) }, x)), sort: { key: 'median', dir: 'asc' },
    }, tp('documents.trends.hint', T.terms.length, { min: ui.trendMin }));
  },

  trendColumns(screen) {
    const c = 'documents.trends.col.';
    const yr = screen ? { type: 'num', fmt: v => Charts.fmtYear(v) } : {};
    return [
      { key: 'label', label: DocumentsModule.col('term'), cls: screen ? 'col-wide' : undefined },
      Object.assign({ key: 'freq', label: t('authors.col.documents') }, screen ? { type: 'int' } : {}),
      Object.assign({ key: 'first', label: t(c + 'first') }, screen ? { type: 'year' } : {}),
      Object.assign({ key: 'q1', label: t(c + 'q1') }, yr),
      Object.assign({ key: 'median', label: t(c + 'median') }, yr),
      Object.assign({ key: 'q3', label: t(c + 'q3') }, yr),
      Object.assign({ key: 'last', label: t(c + 'last') }, screen ? { type: 'year' } : {}),
    ];
  },
};

Modules.define('documents', { render: body => DocumentsModule.render(body) });
on('cleanchange', () => DocumentsModule.rerender());
on('refsready', () => DocumentsModule.rerender());
window.DocumentsModule = DocumentsModule;
