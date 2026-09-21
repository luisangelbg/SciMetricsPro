/* SciMetricsPro — Intellectual structure: co-citation (references, cited first authors, cited sources), bibliographic
   coupling (documents, authors, sources), coupling map and direct citation historiograph (js/networks/intellectual.js).
   Everything starts from the cited references of the filtered set (Pipeline.references(): local citations and
   reference clusters, shared with Overview and Documents). The two network tabs are NetworkScreens. */
'use strict';

/* a cited reference that is only an open catalogue identifier ("W123…") */
const CATALOGUE_WORK = /^W\d+$/i;

const IntellectualModule = {
  tab: 'cocitation',
  TABS: ['cocitation', 'coupling', 'couplingMap', 'historiograph'],
  CO_DEFAULTS: { unit: 'references', normalization: 'association', minFreq: 2, maxNodes: 50, minEdge: 1, removeIsolated: true, algorithm: 'louvain', resolution: 1, layout: 'fa2', sizeBy: 'freq', labelCount: 20 },
  CP_DEFAULTS: { unit: 'documents', normalization: 'salton', minFreq: 1, maxNodes: 50, minEdge: 1, removeIsolated: true, algorithm: 'louvain', resolution: 1, layout: 'fa2', sizeBy: 'citations', labelCount: 20 },
  CM_DEFAULTS: { unit: 'documents', minFreq: 1, maxNodes: 250, minEdge: 1, resolution: 1, minClusterSize: 2, labelTerms: 3, impact: null },
  HG_DEFAULTS: { maxNodes: 30, minLocal: 1, removeIsolated: false, labelBy: 'short' },
  figs: {},
  cc: {},
  co: { params: null },
  cp: { params: null },
  cm: null,
  hg: null,
  hgSelected: null,
  _cited: null,
  _units: null,
  _cm: null,
  _hg: null,

  P() { return Parsers.lib(); },

  /* forget parameters, selections and results (tests) */
  reset() {
    const M = IntellectualModule;
    NetworkScreen.detach(M.co); NetworkScreen.detach(M.cp);
    M.co = { params: null }; M.cp = { params: null };
    M.cm = null; M.hg = null; M.hgSelected = null;
    M._cited = null; M._units = null; M._cm = null; M._hg = null;
    M.figs = {}; M.cc = {};
  },

  rerender() {
    if (state.route !== 'intellectual' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('intellectual', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  /* help from intellectual.help.<screen>_<key>, intellectual.help.<key> or the shared network.help.<key> */
  help(key, title, refs, screen) {
    const own = k => I18N.has('intellectual.help.' + k + '.text');
    const base = screen && own(screen + '_' + key) ? 'intellectual.help.' + screen + '_' + key : own(key) ? 'intellectual.help.' + key : 'network.help.' + key;
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

  note(host, id, text, warn, iconName) { return NetworkScreen.note(host, id, text, warn, iconName); },

  chart(host, id, o, keep) {
    const prev = IntellectualModule.figs[id];
    const defaults = Object.assign({}, o.defaults);
    if (prev) (keep || []).forEach(k => { if (prev[k] !== undefined) defaults[k] = prev[k]; });
    const cc = ChartCard.mount(host, Object.assign({}, o, { id, defaults }));
    if (cc.fig) IntellectualModule.figs[id] = cc.fig.cfg;
    IntellectualModule.cc[id] = cc;
    return cc;
  },

  tableCard(panel, id, title, helpKey, refs, dtOpts, hint) {
    const card = mk('section', { class: 'card src-card', id });
    const h = mk('h2', null, esc(title));
    if (helpKey) h.appendChild(HelpPopover.button(IntellectualModule.help(helpKey, title, refs), { label: t('metric.help') + ': ' + title }));
    card.appendChild(h);
    if (hint) card.appendChild(mk('p', { class: 'hint' }, esc(hint)));
    card.appendChild(DataTable.create(Object.assign({ pageSize: 25, fileName: slug(title), title }, dtOpts)).el);
    panel.appendChild(card);
    return card;
  },

  cards(id, list) {
    const grid = MetricCard.grid(null, list);
    grid.id = id;
    grid.classList.add('net-stats');
    [...grid.children].forEach((card, i) => { card.dataset.key = list[i].key; });
    return grid;
  },

  cached(slot, deps, compute) {
    const c = IntellectualModule[slot];
    if (c && c.deps.length === deps.length && c.deps.every((d, i) => d === deps[i])) return c.value;
    const value = compute();
    IntellectualModule[slot] = { deps, value };
    return value;
  },

  /* cited items per document (co-citation) and units with the works they cite (coupling) */
  cited(refs, unit) { return IntellectualModule.cached('_cited', [refs, unit], () => IntellectualModule.P().citedLists(refs.clusters, unit)); },
  units(refs, unit) {
    const records = Pipeline.records();
    return IntellectualModule.cached('_units', [refs, records, unit], () => IntellectualModule.P().couplingUnits(records, refs.clusters, refs.lc.local, unit));
  },

  unitName(kind, unit) { return t('intellectual.units.' + kind + '.' + unit); },
  unitControl(kind) {
    const list = kind === 'cited' ? Parsers.lib().CITED_UNITS : Parsers.lib().COUPLING_UNITS;
    return { key: 'unit', type: 'select', label: t('intellectual.params.unit'), options: list.map(u => [u, IntellectualModule.unitName(kind, u)]) };
  },

  doiLink(doi) {
    const a = mk('a', { href: 'https://doi.org/' + encodeURI(doi), target: '_blank', rel: 'noopener noreferrer', class: 'in-doi' }, esc(doi));
    return a;
  },

  render(body) {
    const M = IntellectualModule;
    body.innerHTML = '';
    NetworkScreen.detach(M.co); NetworkScreen.detach(M.cp);
    if (!state.clean) { body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…')); return; }
    const page = mk('div', { class: 'authors-page intellectual-page' });
    body.appendChild(page);
    const { shown, total } = Pipeline.counts();
    if (!shown) {
      page.appendChild(EmptyState.create({ icon: 'filter', title: t('overview.noDocs'), text: t('overview.noDocsText'), actions: [{ label: t('overview.reviewFilters'), icon: 'filter', primary: true, onClick: () => { CleaningModule.tab = 'filters'; App.go('cleaning'); } }] }));
      return;
    }
    if (shown < total) page.appendChild(mk('p', { class: 'note-info', id: 'inFiltered' }, icon('filter') + '<span>' + esc(tp('overview.filteredNote', shown, { total: fmtInt(total) })) + '</span>'));
    const refs = Pipeline.references();
    if (!refs) { M.note(page, 'inPending', t('documents.pending'), false, 'clock'); return; }
    if (refs.cancelled) {
      const p = M.note(page, 'inCancelled', t('documents.cancelled'), true);
      const retry = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'inRetry' }, esc(t('documents.retry')));
      retry.addEventListener('click', () => { Pipeline.retryReferences(); M.rerender(); });
      p.appendChild(retry);
      return;
    }
    if (!refs.lc.stats.references) { page.appendChild(M.noReferences()); return; }
    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('intellectual.tabsLabel') });
    M.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'itab-' + id, 'aria-controls': 'ipanel', 'aria-selected': String(M.tab === id), tabindex: M.tab === id ? '0' : '-1' }, esc(t('intellectual.tabs.' + id)));
      b.addEventListener('click', () => { M.tab = id; M.rerender(); const nb = el('itab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = M.TABS.indexOf(M.tab);
        M.tab = M.TABS[(i + (e.key === 'ArrowRight' ? 1 : M.TABS.length - 1)) % M.TABS.length];
        M.rerender();
        const nb = el('itab-' + M.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel src-panel', role: 'tabpanel', id: 'ipanel', 'aria-labelledby': 'itab-' + M.tab });
    page.appendChild(panel);
    M['render_' + M.tab](panel, refs);
  },

  /* without cited references: what they are needed for and how to export them */
  noReferences() {
    const box = mk('section', { class: 'card in-norefs', id: 'inNoRefs', role: 'status' });
    box.appendChild(mk('h2', null, icon('quote') + '<span>' + esc(t('intellectual.noRefs.title')) + '</span>'));
    box.appendChild(mk('p', null, esc(t('intellectual.noRefs.text'))));
    const ol = mk('ol', { class: 'in-steps' });
    ['csv', 'tagged', 'none', 'catalogue'].forEach(k => ol.appendChild(mk('li', null, esc(t('intellectual.noRefs.steps.' + k)))));
    box.appendChild(ol);
    const row = mk('div', { class: 'empty-actions' });
    const go = mk('button', { type: 'button', class: 'btn btn-primary', id: 'inHowTo' }, icon('upload') + '<span>' + esc(t('intellectual.noRefs.howTo')) + '</span>');
    go.addEventListener('click', () => { ImportModule.tab = 'files'; ImportModule.showFormats = true; App.go('import'); });
    row.appendChild(go);
    box.appendChild(row);
    return box;
  },

  /* ================= co-citation ================= */
  cocitationSpec(refs) {
    const M = IntellectualModule, P = M.P();
    const unitNow = () => M.co.params.unit;
    const rowOf = (data, key) => data.refs.clusters.rows[key];
    const label = (data, i) => {
      const key = data.nodes[i].key;
      if (data.unit !== 'references') return data.cited.labels.get(key) || String(key);
      /* a catalogue identifier that is a document of the collection is named after that document; two works that
         would look alike (same author, year and source) take their volume and page. Computed once per network. */
      if (!data.refNames) {
        const rows = data.nodes.map(n => rowOf(data, n.key));
        const names = P.referenceShortList(rows, 70);
        data.refNames = rows.map((row, j) => (CATALOGUE_WORK.test(row.label) && row.local >= 0 ? P.documentLabel(Pipeline.records()[row.local]) : names[j]));
      }
      return data.refNames[i];
    };
    return {
      store: M.co, prefix: 'cc', figs: M.figs, defaults: M.CO_DEFAULTS, rerender: () => M.rerender(),
      buildKeys: ['unit', 'normalization', 'minFreq', 'maxNodes', 'minEdge', 'removeIsolated'],
      chart: (host, id, o, keep) => M.chart(host, id, o, keep),
      tableCard: (panel, id, title, helpKey, refsList, dtOpts, hint) => M.tableCard(panel, id, title, helpKey, refsList, dtOpts, hint),
      help: (key, title, list) => M.help(key, title, list, 'cocitation'),
      nodesRefs: ['small1973'],
      groups: () => NetworkPanel.commonGroups({
        before: [M.unitControl('cited')], minFreqLabel: 'intellectual.params.minCitations', minEdgeLabel: 'intellectual.params.minCocitations',
        help: {
          selection: M.help('cocitationSelection', t('network.params.selection'), ['small1973', 'white1981', 'mccain1991']),
          weights: M.help('weights', t('network.params.weights'), ['vaneck2009', 'salton1983', 'jaccard1901', 'callon1991']),
          communities: M.help('communitiesParams', t('network.params.communities'), ['blondel2008', 'clauset2004', 'reichardt2006']),
          display: M.help('display', t('network.params.display'), ['jacomy2014']),
        },
      }),
      onChange: key => { if (key === 'unit') M.co.selectedKey = null; return false; },
      before: main => {
        main.appendChild(mk('p', { class: 'hint', id: 'ccHint' }, esc(t('intellectual.cocitation.hint.' + unitNow()))));
        if (unitNow() === 'references' && refs.clusters.rows.some(row => CATALOGUE_WORK.test(row.label))) M.note(main, 'ccIds', t('intellectual.cocitation.ids'));
        const C = M.cited(refs, unitNow());
        if (C.lists.some(l => l.length)) return true;
        M.note(main, 'ccNoUnit', t('intellectual.cocitation.noUnit', { unit: M.unitName('cited', unitNow()).toLowerCase() }), true);
        return false;
      },
      deps: () => [refs],
      input: s => {
        const C = M.cited(refs, s.unit);
        const inc = P.incidence(C.lists, { minFreq: s.minFreq, maxItems: s.maxNodes });
        return { input: { items: inc.items, docs: inc.docs.filter(d => d.length > 1) }, extra: { inc, cited: C, unit: s.unit, refs } };
      },
      label,
      measures: { freq: t('intellectual.measures.citingDocs') },
      documents: (data, i) => {
        const key = data.nodes[i].key, out = [];
        data.cited.lists.forEach((list, r) => { if (list.includes(key)) out.push(r); });
        return out;
      },
      details: (box, data, i) => {
        if (data.unit !== 'references') return;
        const row = rowOf(data, data.nodes[i].key);
        const doc = row.local >= 0 ? Pipeline.records()[row.local] : null;
        const p = mk('p', { class: 'in-ref-text' }, esc(CATALOGUE_WORK.test(row.label) && doc ? row.label + ' · ' + P.clean(doc.title) : row.label));
        if (row.doi) { p.appendChild(document.createTextNode(' ')); p.appendChild(M.doiLink(row.doi)); }
        box.appendChild(p);
      },
      texts: {
        item: M.unitName('citedItem', unitNow()), search: t('intellectual.search.' + unitNow()), notFound: t('intellectual.notFound'),
        tooFew: data => tp('intellectual.cocitation.tooFew', data.inc.items.length),
        viewTitle: t('intellectual.cocitation.viewTitle', { unit: M.unitName('cited', unitNow()).toLowerCase() }),
        viewHelp: M.help('cocitationView', t('intellectual.cocitation.viewTitle', { unit: M.unitName('cited', unitNow()).toLowerCase() }), ['small1973', 'jacomy2014', 'blondel2008']),
        viewSub: () => t('intellectual.cocitation.viewSub', { normalization: t('network.normalizationsInline.' + M.co.params.normalization) }),
        figureTitle: t('intellectual.cocitation.figureTitle', { unit: M.unitName('cited', unitNow()).toLowerCase() }),
        figureFile: t('intellectual.cocitation.figureFile', { unit: M.unitName('cited', unitNow()).toLowerCase() }),
        figureHelp: M.help('cocitationView', t('intellectual.cocitation.figureTitle', { unit: M.unitName('cited', unitNow()).toLowerCase() }), ['small1973', 'jacomy2014', 'blondel2008']),
        figureSub: (data, comm) => tp('intellectual.figureSub', comm.communities, { nodes: fmtInt(data.nodes.length), q: fmtNum(comm.q1, 3) }),
        neighbours: t('intellectual.cocitation.neighbours'), neighbourCount: n => tp('intellectual.cocitation.count', n), documents: n => tp('intellectual.cocitation.documents', n),
        freqSum: t('intellectual.col.citationsSum'), members: M.unitName('cited', unitNow()), count: t('intellectual.col.cocitations'),
        source: t('intellectual.col.item1'), target: t('intellectual.col.item2'),
      },
    };
  },

  render_cocitation(panel, refs) {
    const M = IntellectualModule;
    if (!M.co.params) M.co.params = Object.assign({}, M.CO_DEFAULTS);
    NetworkScreen.render(panel, M.cocitationSpec(refs));
  },

  /* ================= bibliographic coupling ================= */
  couplingSpec(refs) {
    const M = IntellectualModule, P = M.P(), records = Pipeline.records();
    const unitNow = () => M.cp.params.unit;
    const unitOf = (data, i) => data.units[data.nodes[i].item];
    return {
      store: M.cp, prefix: 'cp', figs: M.figs, defaults: M.CP_DEFAULTS, rerender: () => M.rerender(),
      buildKeys: ['unit', 'normalization', 'minFreq', 'maxNodes', 'minEdge', 'removeIsolated'],
      chart: (host, id, o, keep) => M.chart(host, id, o, keep),
      tableCard: (panel, id, title, helpKey, refsList, dtOpts, hint) => M.tableCard(panel, id, title, helpKey, refsList, dtOpts, hint),
      help: (key, title, list) => M.help(key, title, list, 'coupling'),
      nodesRefs: ['kessler1963'],
      edgesRefs: ['kessler1963', 'salton1983'],
      groups: () => NetworkPanel.commonGroups({
        before: [M.unitControl('coupling')], minFreqLabel: 'intellectual.params.minDocs', maxNodesLabel: 'intellectual.params.maxUnits', minEdgeLabel: 'intellectual.params.minShared',
        omit: unitNow() === 'documents' ? ['minFreq'] : [],
        sizeBy: [['citations', t('intellectual.measures.globalCitations')], ['freq', t('intellectual.measures.references')]].concat(['degree', 'strength', 'betweenness', 'pagerank'].map(m => [m, t('network.measures.' + m)])),
        help: {
          selection: M.help('couplingSelection', t('network.params.selection'), ['kessler1963', 'zhao2008']),
          weights: M.help('couplingWeights', t('network.params.weights'), ['salton1983', 'vaneck2009']),
          communities: M.help('communitiesParams', t('network.params.communities'), ['blondel2008', 'clauset2004', 'reichardt2006']),
          display: M.help('display', t('network.params.display'), ['jacomy2014']),
        },
      }),
      onChange: key => { if (key === 'unit') M.cp.selectedKey = null; return false; },
      before: main => {
        main.appendChild(mk('p', { class: 'hint', id: 'cpHint' }, esc(t('intellectual.coupling.hint.' + unitNow()))));
        if (M.units(refs, unitNow()).length > 1) return true;
        M.note(main, 'cpNoUnit', t('intellectual.coupling.noUnit', { unit: M.unitName('coupling', unitNow()).toLowerCase() }), true);
        return false;
      },
      deps: () => [refs, records],
      input: s => {
        const units = P.selectUnits(M.units(refs, s.unit), { minDocs: s.unit === 'documents' ? 1 : s.minFreq, maxNodes: s.maxNodes });
        const net = P.couplingNetwork(units, { normalization: s.normalization, minEdge: s.minEdge, removeIsolated: s.removeIsolated });
        return { input: net, extra: { units, unit: s.unit, refs } };
      },
      label: (data, i) => unitOf(data, i).label,
      value: (data, i, measure) => (measure === 'citations' ? data.nodes[i].citations || 0 : undefined),
      nameValue: (data, i) => (data.nodes[i].citations == null ? -1 : data.nodes[i].citations),
      measures: { freq: t('intellectual.measures.references'), citations: t('intellectual.measures.globalCitations') },
      documents: (data, i) => unitOf(data, i).docs,
      details: (box, data, i) => {
        if (data.unit !== 'documents') return;
        const r = records[unitOf(data, i).docs[0]];
        const p = mk('p', { class: 'in-ref-text' }, esc(r.title));
        if (r.doi) { p.appendChild(document.createTextNode(' ')); p.appendChild(M.doiLink(r.doi)); }
        box.appendChild(p);
      },
      texts: {
        item: M.unitName('couplingItem', unitNow()), search: t('intellectual.search.' + unitNow()), notFound: t('intellectual.notFound'),
        tooFew: data => tp('intellectual.coupling.tooFew', data.units.length),
        viewTitle: t('intellectual.coupling.viewTitle', { unit: M.unitName('coupling', unitNow()).toLowerCase() }),
        viewHelp: M.help('couplingView', t('intellectual.coupling.viewTitle', { unit: M.unitName('coupling', unitNow()).toLowerCase() }), ['kessler1963', 'jacomy2014', 'blondel2008']),
        viewSub: () => t('intellectual.coupling.viewSub', { normalization: t('network.normalizationsInline.' + M.cp.params.normalization) }),
        figureTitle: t('intellectual.coupling.figureTitle', { unit: M.unitName('coupling', unitNow()).toLowerCase() }),
        figureFile: t('intellectual.coupling.figureFile', { unit: M.unitName('coupling', unitNow()).toLowerCase() }),
        figureHelp: M.help('couplingView', t('intellectual.coupling.figureTitle', { unit: M.unitName('coupling', unitNow()).toLowerCase() }), ['kessler1963', 'jacomy2014', 'blondel2008']),
        figureSub: (data, comm) => tp('intellectual.figureSub', comm.communities, { nodes: fmtInt(data.nodes.length), q: fmtNum(comm.q1, 3) }),
        neighbours: t('intellectual.coupling.neighbours'), neighbourCount: n => tp('intellectual.coupling.count', n), documents: n => tp('intellectual.coupling.documents', n),
        freqSum: t('intellectual.col.referencesSum'), members: M.unitName('coupling', unitNow()), count: t('intellectual.col.shared'),
        source: t('intellectual.col.unit1'), target: t('intellectual.col.unit2'),
        nodesHint: t('intellectual.coupling.nodesHint'),
      },
    };
  },

  render_coupling(panel, refs) {
    const M = IntellectualModule;
    if (!M.cp.params) M.cp.params = Object.assign({}, M.CP_DEFAULTS);
    NetworkScreen.render(panel, M.couplingSpec(refs));
  },

  /* ================= coupling map ================= */
  cmParams() {
    const M = IntellectualModule;
    if (!M.cm) M.cm = Object.assign({}, M.CM_DEFAULTS);
    if (M.cm.impact == null) M.cm.impact = Pipeline.records().some(r => r.timesCited != null && isFinite(r.timesCited)) ? 'global' : 'local';
    return M.cm;
  },

  couplingMap(refs) {
    const M = IntellectualModule, s = M.cmParams(), records = Pipeline.records(), terms = Pipeline.termLists();
    return M.cached('_cm', [refs, records, terms, s.unit, s.minFreq, s.maxNodes, s.minEdge, s.resolution, s.minClusterSize, s.labelTerms, s.impact], () => {
      const P = M.P();
      const units = P.selectUnits(M.units(refs, s.unit), { minDocs: s.unit === 'documents' ? 1 : s.minFreq, maxNodes: s.maxNodes });
      const values = s.impact === 'local' ? refs.lc.local : records.map(r => r.timesCited);
      const scores = P.normalizedCitationScores(records, values);
      const map = P.couplingMap(units, records, terms.lists, scores, { minEdge: s.minEdge, resolution: s.resolution, minClusterSize: s.minClusterSize, labelTerms: s.labelTerms });
      return { units, scores, map, terms };
    });
  },

  quadrantLabels() { const o = {}; Parsers.lib().QUADRANTS.forEach(q => { o[q] = t('intellectual.quadrants.' + q); }); return o; },

  clusterLabel(res, c) {
    const terms = res.terms, P = IntellectualModule.P();
    if (c.labelKeys.length) return c.labelKeys.map(k => terms.labels.get(k) || k).join(', ');
    const u = res.units[res.map.nodes[c.units[0]].item];
    return u ? u.label : '';
  },

  render_couplingMap(panel, refs) {
    const M = IntellectualModule, s = M.cmParams(), P = M.P();
    const layout = mk('div', { class: 'net-layout' });
    panel.appendChild(layout);
    const values = Object.assign({ termField: Pipeline.init().termField }, s);
    layout.appendChild(NetworkPanel.create({
      id: 'cmParams', values, title: t('network.params.titleMap'),
      groups: [
        { key: 'selection', title: t('network.params.selection'), help: M.help('couplingSelection', t('network.params.selection'), ['kessler1963', 'zhao2008']), controls: [
          M.unitControl('coupling'),
          { key: 'minFreq', type: 'number', label: t('intellectual.params.minDocs'), min: 1, max: 1000, step: 1 },
          { key: 'maxNodes', type: 'number', label: t('intellectual.params.maxUnits'), min: 3, max: 1000, step: 1 },
          { key: 'minEdge', type: 'number', label: t('intellectual.params.minShared'), min: 1, max: 1000, step: 1 },
        ].filter(c => !(s.unit === 'documents' && c.key === 'minFreq')) },
        { key: 'clusters', title: t('intellectual.params.clusters'), help: M.help('couplingClusters', t('intellectual.params.clusters'), ['blondel2008', 'callon1991', 'aria2020']), controls: [
          { key: 'impact', type: 'select', label: t('intellectual.params.impact'), options: ['global', 'local'].map(v => [v, t('intellectual.impact.' + v)]) },
          { key: 'resolution', type: 'range', label: t('network.params.resolution'), min: 0.1, max: 3, step: 0.1, format: v => fmtNum(+v, 1) },
          { key: 'minClusterSize', type: 'number', label: t('intellectual.params.minClusterSize'), min: 1, max: 100, step: 1 },
        ] },
        { key: 'labels', title: t('intellectual.params.labels'), help: M.help('couplingLabels', t('intellectual.params.labels'), ['aria2020']), controls: [
          { key: 'termField', type: 'select', label: t('conceptual.field'), options: P.TERM_FIELDS.map(f => [f, t('cleaning.termFields.' + f)]) },
          { key: 'labelTerms', type: 'number', label: t('intellectual.params.labelTerms'), min: 1, max: 10, step: 1 },
        ] },
      ],
      onChange: (k, v) => { if (k === 'termField') { Pipeline.update({ termField: v }); return; } s[k] = v; M.rerender(); },
    }));
    const main = mk('div', { class: 'net-main' });
    layout.appendChild(main);
    main.appendChild(mk('p', { class: 'hint', id: 'cmHint' }, esc(t('intellectual.map.hint'))));
    const res = M.couplingMap(refs);
    const map = res.map;
    if (map.clusters.length < 2) { M.note(main, 'cmTooFew', tp('intellectual.map.tooFew', map.clusters.length, { units: tp('intellectual.map.tooFewUnits', res.units.length) }), true); return; }
    if (map.clusters.every(c => !c.scored)) M.note(main, 'cmNoImpact', t('intellectual.map.noImpact.' + s.impact), true);
    const c = 'intellectual.cards.';
    const list = [
      { key: 'clusters', label: t(c + 'clusters'), value: fmtInt(map.clusters.length), sub: tp(c + 'unitsSub', map.nodes.length, { unit: M.unitName('coupling', s.unit).toLowerCase() }), icon: 'people', tone: 'primary', help: M.help('couplingClusters', t(c + 'clusters'), ['blondel2008', 'aria2020']) },
    ];
    P.QUADRANTS.forEach((q, i) => {
      const inQ = map.clusters.filter(x => x.quadrant === q);
      list.push({ key: q, label: t('intellectual.quadrants.' + q), value: fmtInt(inQ.length), sub: inQ[0] ? M.clusterLabel(res, inQ[0]) : t('conceptual.cards.emptyQuadrant'), icon: 'quote', tone: ['rose', 'teal', 'accent', 'primary'][i], help: M.help('mapQuadrant_' + q, t('intellectual.quadrants.' + q), ['aria2020', 'callon1991']) });
    });
    main.appendChild(M.cards('cmStats', list));
    const title = t('intellectual.map.title', { unit: M.unitName('coupling', s.unit).toLowerCase() });
    const clusters = map.clusters.map(cl => ({ x: cl.centrality, y: cl.impact, size: cl.size, quadrant: cl.quadrant, label: M.clusterLabel(res, cl), title: M.clusterLabel(res, cl) + ' · ' + tp('intellectual.map.docsTitle', cl.size) }));
    M.chart(main, 'cmMap', {
      title, subtitle: t('intellectual.map.sub', { clusters: fmtInt(map.clusters.length), impact: t('intellectual.impact.' + s.impact).toLowerCase() }),
      help: M.help('couplingMap', title, ['aria2020', 'callon1991', 'waltman2011']),
      width: 960, height: 720, fileName: slug(t('intellectual.map.file')),
      data: () => ({ columns: M.clusterColumns(), rows: M.clusterRows(res) }),
      controls: Charts.thematicMapControls({ quadrants: P.QUADRANTS.map(q => t('intellectual.quadrants.' + q)) }),
      defaults: { title, subtitle: '', xlab: t('intellectual.map.xlab'), ylab: t('intellectual.map.ylab', { impact: t('intellectual.impact.' + s.impact).toLowerCase() }), showQuadrants: true, maxRadius: 34, maxLabel: 60 },
      render: cfg => Charts.thematicMap(cfg, { clusters, medianX: map.medianCentrality, medianY: map.medianImpact, quadrantLabels: M.quadrantLabels() }),
    }, ['quadrantColors', 'showQuadrants', 'maxRadius', 'maxLabel', 'width', 'height']);
    M.tableCard(panel, 'cmClusters', t('intellectual.map.clustersTitle'), 'couplingMap', ['aria2020', 'callon1991'], {
      columns: M.clusterColumns(), rows: M.clusterRows(res), sort: { key: 'id', dir: 'asc' },
    }, t('intellectual.map.clustersHint', { medC: fmtNum(map.medianCentrality, 4), medI: fmtNum(map.medianImpact, 4) }));
    const records = Pipeline.records();
    const rows = [];
    map.clusters.forEach(cl => cl.docs.forEach(d => {
      const r = records[d];
      rows.push({ label: P.documentLabel(r), title: r.title, year: r.year, citations: r.timesCited, local: refs.lc.local[d], score: res.scores[d], cluster: cl.id + 1, clusterLabel: M.clusterLabel(res, cl) });
    }));
    M.tableCard(panel, 'cmDocs', t('intellectual.map.docsTableTitle'), 'couplingImpact', ['waltman2011'], {
      columns: [
        { key: 'label', label: t('documents.col.document'), cls: 'col-nowrap' },
        { key: 'title', label: t('documents.col.title'), cls: 'col-wide', clamp: true },
        { key: 'year', label: t('sources.col.year'), type: 'year' },
        { key: 'citations', label: t('intellectual.measures.globalCitations'), type: 'int' },
        { key: 'local', label: t('intellectual.measures.localCitations'), type: 'int' },
        { key: 'score', label: t('intellectual.col.score', { impact: t('intellectual.impact.' + s.impact).toLowerCase() }), type: 'num', fmt: v => fmtNum(v, 3) },
        { key: 'cluster', label: t('intellectual.col.cluster'), type: 'int' },
        { key: 'clusterLabel', label: t('intellectual.col.clusterLabel') },
      ],
      rows, sort: { key: 'score', dir: 'desc' },
    }, t('intellectual.map.docsHint'));
  },

  clusterColumns() {
    const c = 'intellectual.col.';
    return [
      { key: 'id', label: t(c + 'cluster'), type: 'int' },
      { key: 'label', label: t(c + 'clusterLabel'), cls: 'col-nowrap' },
      { key: 'quadrant', label: t('conceptual.col.quadrant') },
      { key: 'units', label: t(c + 'units'), type: 'int' },
      { key: 'documents', label: t(c + 'documents'), type: 'int' },
      { key: 'centrality', label: t('conceptual.col.centrality'), type: 'num', fmt: v => fmtNum(v, 4) },
      { key: 'impact', label: t(c + 'impact'), type: 'num', fmt: v => fmtNum(v, 4) },
      { key: 'top', label: t(c + 'topUnits'), cls: 'col-wide', clamp: true },
      { key: 'terms', label: t(c + 'terms'), cls: 'col-wide', clamp: true },
    ];
  },
  clusterRows(res) {
    const M = IntellectualModule, terms = res.terms;
    return res.map.clusters.map(cl => ({
      id: cl.id + 1, label: M.clusterLabel(res, cl), quadrant: t('intellectual.quadrants.' + cl.quadrant), units: cl.units.length, documents: cl.size,
      centrality: cl.centrality, impact: cl.impact,
      top: cl.units.slice(0, 5).map(i => res.units[res.map.nodes[i].item].label).join('; '),
      terms: cl.terms.slice(0, 10).map(x => (terms.labels.get(x.key) || x.key) + ' (' + x.inCluster + '/' + x.total + ')').join('; '),
    }));
  },

  /* ================= historiograph ================= */
  hgParams() { if (!IntellectualModule.hg) IntellectualModule.hg = Object.assign({}, IntellectualModule.HG_DEFAULTS); return IntellectualModule.hg; },

  historiograph(refs) {
    const M = IntellectualModule, s = M.hgParams(), records = Pipeline.records();
    return M.cached('_hg', [refs, records, s.maxNodes, s.minLocal, s.removeIsolated], () => M.P().historiograph(records, refs.lc, s));
  },

  docLabel(r, labelBy) {
    const P = IntellectualModule.P();
    if (labelBy === 'title') return Charts.truncate(P.clean(r.title), 48);
    const a = r.authors && r.authors[0];
    const who = a ? P.clean(a.last || a.short || a.full) : '';
    return [who, r.year].filter(v => v !== '' && v != null).join(', ');
  },

  render_historiograph(panel, refs) {
    const M = IntellectualModule, s = M.hgParams(), P = M.P(), records = Pipeline.records();
    const layout = mk('div', { class: 'net-layout' });
    panel.appendChild(layout);
    layout.appendChild(NetworkPanel.create({
      id: 'hgParams', values: s,
      groups: [
        { key: 'selection', title: t('network.params.selection'), help: M.help('hgSelection', t('network.params.selection'), ['garfield2004', 'garfield2003']), controls: [
          { key: 'maxNodes', type: 'number', label: t('intellectual.params.hgDocs'), min: 2, max: 200, step: 1 },
          { key: 'minLocal', type: 'number', label: t('intellectual.params.minLocal'), min: 0, max: 1000, step: 1 },
          { key: 'removeIsolated', type: 'checkbox', label: t('intellectual.params.hgIsolated') },
        ] },
        { key: 'display', title: t('network.params.display'), help: M.help('hgLayout', t('network.params.display'), ['sugiyama1981']), controls: [
          { key: 'labelBy', type: 'select', label: t('intellectual.params.labelBy'), options: ['short', 'title'].map(v => [v, t('intellectual.labelBy.' + v)]) },
        ] },
      ],
      onChange: (k, v) => { s[k] = v; M.rerender(); },
    }));
    const main = mk('div', { class: 'net-main' });
    layout.appendChild(main);
    main.appendChild(mk('p', { class: 'hint', id: 'hgHint' }, esc(t('intellectual.hg.hint'))));
    if (!refs.lc.stats.links) { M.note(main, 'hgNone', tp('intellectual.hg.none', refs.lc.stats.references), true); return; }
    const H = M.historiograph(refs);
    if (H.nodes.length < 2) { M.note(main, 'hgTooFew', t('intellectual.hg.tooFew'), true); return; }
    if (H.later || H.cycle) M.note(main, 'hgExcluded', [H.later ? tp('intellectual.hg.later', H.later) : '', H.cycle ? tp('intellectual.hg.cycle', H.cycle) : ''].filter(Boolean).join(' '), true);
    const c = 'intellectual.cards.';
    main.appendChild(M.cards('hgStats', [
      { key: 'documents', label: t(c + 'hgDocs'), value: fmtInt(H.nodes.length), sub: tp(c + 'hgCandidates', H.candidates), icon: 'doc', tone: 'primary', help: M.help('hgSelection', t(c + 'hgDocs'), ['garfield2004']) },
      { key: 'links', label: t(c + 'hgLinks'), value: fmtInt(H.kept), sub: tp(c + 'hgLinksSub', refs.lc.stats.links), icon: 'network', tone: 'teal', help: M.help('hgLinks', t(c + 'hgLinks'), ['garfield2004', 'garfield2003']) },
      { key: 'families', label: t(c + 'hgFamilies'), value: fmtInt(H.components), sub: tp(c + 'hgAlone', H.nodes.filter(nd => nd.component < 0).length), icon: 'people', tone: 'accent', help: M.help('hgFamilies', t(c + 'hgFamilies'), ['garfield2004']) },
      { key: 'span', label: t(c + 'hgSpan'), value: H.years[0] === H.years[H.years.length - 1] ? String(H.years[0]) : H.years[0] + '–' + H.years[H.years.length - 1], sub: tp(c + 'hgYears', H.years.length), icon: 'calendar', tone: 'rose', help: M.help('hgLayout', t(c + 'hgSpan'), ['sugiyama1981']) },
      { key: 'top', label: t(c + 'hgTop'), value: fmtInt(H.nodes[0].local), sub: P.documentLabel(records[H.nodes[0].index]), icon: 'quote', tone: 'primary', help: M.help('hgSelection', t(c + 'hgTop'), ['garfield2003']) },
      { key: 'excluded', label: t(c + 'hgExcluded'), value: fmtInt(H.later + H.cycle), sub: t(c + 'hgExcludedSub', { later: fmtInt(H.later), cycle: fmtInt(H.cycle) }), icon: 'filter', tone: 'teal', help: M.help('hgLinks', t(c + 'hgExcluded'), ['garfield2004']) },
    ]));
    if (M.hgSelected != null && !H.nodes.some(nd => nd.index === M.hgSelected)) M.hgSelected = null;
    const nodes = H.nodes.map(nd => {
      const r = records[nd.index];
      return { label: M.docLabel(r, s.labelBy), layer: nd.layer, y: nd.y, value: nd.local, family: nd.component, title: P.documentLabel(r) + ' · ' + P.clean(r.title) + ' · ' + tp('intellectual.hg.localTitle', nd.local) };
    });
    const links = H.links.filter(l => l.status === 'kept').map(l => [l.from, l.to]);
    const title = t('intellectual.hg.title');
    const selectedNode = () => H.nodes.findIndex(nd => nd.index === M.hgSelected);
    const cc = M.chart(main, 'hgFigure', {
      title, subtitle: tp('intellectual.hg.sub', links.length, { docs: fmtInt(nodes.length) }),
      help: M.help('historiograph', title, ['garfield2004', 'garfield2003', 'sugiyama1981']),
      width: 1000, height: Math.max(520, 120 + 46 * Math.max(...H.nodes.map(nd => nd.size))), fileName: slug(t('intellectual.hg.file')),
      data: () => ({ columns: M.hgDocColumns(false), rows: M.hgDocRows(H) }),
      controls: Charts.historiographControls(),
      defaults: { title, subtitle: '', xlab: t('intellectual.hg.xlab'), palette: 'scimetrics', showLabels: true, maxLabel: 40, minRadius: 4, maxRadius: 14, edgeOpacity: 0.55, edgeWidth: 1.2 },
      render: cfg => {
        const svg = Charts.historiograph(cfg, { years: H.years, nodes, links, selected: selectedNode() });
        svg.querySelectorAll('[data-doc]').forEach(circle => {
          circle.setAttribute('tabindex', '0');
          circle.setAttribute('role', 'button');
          circle.setAttribute('aria-label', nodes[+circle.getAttribute('data-doc')].title);
        });
        return svg;
      },
    }, ['palette', 'showLabels', 'maxLabel', 'minRadius', 'maxRadius', 'edgeOpacity', 'edgeWidth', 'width', 'height']);
    const body = el('hgFigure');
    if (body) {
      const pick = target => { const circle = target.closest && target.closest('[data-doc]'); if (circle) M.showDoc(H, +circle.getAttribute('data-doc'), true); };
      body.addEventListener('click', e => pick(e.target));
      body.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-doc]')) { e.preventDefault(); pick(e.target); } });
    }
    const card = mk('section', { class: 'card net-node hg-doc', id: 'hgDoc', hidden: true, 'aria-live': 'polite' });
    main.appendChild(card);
    if (M.hgSelected != null) M.showDoc(H, selectedNode(), false);
    M.tableCard(panel, 'hgDocs', t('intellectual.hg.docsTitle'), 'hgSelection', ['garfield2004'], {
      columns: M.hgDocColumns(true), rows: M.hgDocRows(H), sort: { key: 'year', dir: 'asc' },
    });
    const statusText = st => t('intellectual.hg.status.' + st);
    M.tableCard(panel, 'hgLinks', t('intellectual.hg.linksTitle'), 'hgLinks', ['garfield2004'], {
      columns: [
        { key: 'cited', label: t('intellectual.col.cited'), cls: 'col-nowrap' },
        { key: 'citedYear', label: t('intellectual.col.citedYear'), type: 'year' },
        { key: 'citing', label: t('intellectual.col.citing'), cls: 'col-nowrap' },
        { key: 'citingYear', label: t('intellectual.col.citingYear'), type: 'year' },
        { key: 'status', label: t('intellectual.col.status') },
      ],
      rows: H.links.map(l => {
        const a = records[H.nodes[l.from].index], b = records[H.nodes[l.to].index];
        return { cited: P.documentLabel(a), citedYear: a.year, citing: P.documentLabel(b), citingYear: b.year, status: statusText(l.status) };
      }),
      sort: { key: 'citedYear', dir: 'asc' },
    }, t('intellectual.hg.linksHint'));
    void cc;
  },

  hgDocColumns(screen) {
    const int = screen ? { type: 'int' } : {};
    return [
      { key: 'label', label: t('documents.col.document'), cls: screen ? 'col-nowrap' : undefined },
      { key: 'title', label: t('documents.col.title'), cls: screen ? 'col-wide' : undefined, clamp: screen },
      Object.assign({ key: 'year', label: t('sources.col.year') }, screen ? { type: 'year' } : {}),
      Object.assign({ key: 'local', label: t('intellectual.measures.localCitations') }, int),
      Object.assign({ key: 'global', label: t('intellectual.measures.globalCitations') }, int),
      Object.assign({ key: 'cites', label: t('intellectual.col.citesIn') }, int),
      Object.assign({ key: 'citedBy', label: t('intellectual.col.citedByIn') }, int),
      Object.assign({ key: 'family', label: t('intellectual.col.family') }, int),
      { key: 'doi', label: t('documents.col.doi') },
    ];
  },
  hgDocRows(H) {
    const records = Pipeline.records(), P = IntellectualModule.P();
    const kept = H.links.filter(l => l.status === 'kept');
    return H.nodes.map((nd, k) => {
      const r = records[nd.index];
      return {
        label: P.documentLabel(r), title: r.title, year: r.year, local: nd.local, global: nd.global,
        cites: kept.filter(l => l.to === k).length, citedBy: kept.filter(l => l.from === k).length,
        family: nd.component >= 0 ? nd.component + 1 : null, doi: r.doi || '',
      };
    });
  },

  /* the card of a document of the historiograph: title, authors, DOI and its drawn citations */
  showDoc(H, k, focusCard) {
    const M = IntellectualModule, P = M.P(), records = Pipeline.records();
    const card = el('hgDoc'), fig = el('hgFigure');
    if (!card) return;
    if (fig) fig.querySelectorAll('[data-doc]').forEach(c => c.classList.toggle('hg-selected', +c.getAttribute('data-doc') === k));
    card.innerHTML = '';
    if (k < 0) { M.hgSelected = null; card.hidden = true; return; }
    const nd = H.nodes[k], r = records[nd.index];
    M.hgSelected = nd.index;
    card.hidden = false;
    const head = mk('header', { class: 'net-node-head' });
    head.appendChild(mk('h3', null, esc(P.clean(r.title))));
    const close = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'hgDocClose' }, esc(t('network.node.close')));
    close.addEventListener('click', () => M.showDoc(H, -1));
    head.appendChild(close);
    card.appendChild(head);
    const dl = mk('dl', { class: 'net-node-metrics hg-doc-meta' });
    const row = (label, value) => { const dd = mk('dd'); if (value instanceof Node) dd.appendChild(value); else dd.textContent = value; dl.appendChild(mk('dt', null, esc(label))); dl.appendChild(dd); };
    row(t('intellectual.hg.authors'), r.authors.map(a => P.clean(a.full || a.short || P.authorLabel(a))).join('; ') || '—');
    row(t('sources.col.year'), r.year != null ? String(r.year) : '—');
    row(t('intellectual.hg.source'), P.clean(r.sourceTitle) || '—');
    row(t('documents.col.doi'), r.doi ? M.doiLink(r.doi) : '—');
    row(t('intellectual.measures.localCitations'), fmtInt(nd.local));
    row(t('intellectual.measures.globalCitations'), nd.global != null ? fmtInt(nd.global) : '—');
    card.appendChild(dl);
    const kept = H.links.filter(l => l.status === 'kept');
    const cols = mk('div', { class: 'net-node-cols hg-doc-cols' });
    const listBox = (heading, items) => {
      const box = mk('div');
      box.appendChild(mk('h4', null, esc(heading)));
      const ul = mk('ul', { class: 'net-node-list' });
      items.forEach(j => {
        const li = mk('li');
        const b = mk('button', { type: 'button', class: 'linklike' }, esc(P.documentLabel(records[H.nodes[j].index])));
        b.addEventListener('click', () => M.showDoc(H, j, true));
        li.appendChild(b);
        ul.appendChild(li);
      });
      if (!items.length) ul.appendChild(mk('li', { class: 'muted' }, esc(t('intellectual.hg.noneInGraph'))));
      box.appendChild(ul);
      return box;
    };
    cols.appendChild(listBox(tp('intellectual.hg.cites', kept.filter(l => l.to === k).length), kept.filter(l => l.to === k).map(l => l.from)));
    cols.appendChild(listBox(tp('intellectual.hg.citedBy', kept.filter(l => l.from === k).length), kept.filter(l => l.from === k).map(l => l.to)));
    card.appendChild(cols);
    if (focusCard) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
};

Modules.define('intellectual', { render: body => IntellectualModule.render(body) });
on('cleanchange', () => IntellectualModule.rerender());
on('refsready', () => IntellectualModule.rerender());
window.IntellectualModule = IntellectualModule;
