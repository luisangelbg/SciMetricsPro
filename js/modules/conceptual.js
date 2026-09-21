/* SciMetricsPro — Conceptual structure: co-occurrence network of the terms chosen in Cleaning, thematic map,
   thematic evolution and factorial analysis. The network tab is a NetworkScreen (js/components/network-screen.js):
   network, metrics and ForceAtlas2 in a worker, communities and the circular layout in the page, so changing the
   algorithm or the resolution recolours the same drawing. */
'use strict';

const ConceptualModule = {
  tab: 'cooccurrence',
  TABS: ['cooccurrence', 'thematicMap', 'evolution', 'factorial'],
  params: null,
  figs: {},
  cc: {},
  view: null,
  viewState: null,
  selectedKey: null,
  current: null,
  pending: Promise.resolve(),
  _net: null,
  _comm: null,
  _circle: null,

  P() { return Parsers.lib(); },

  label(data, i) { const key = data.nodes[i].key; return data.terms.labels.get(key) || key; },

  rerender() {
    if (state.route !== 'conceptual' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('conceptual', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  help(key, title, refs) {
    const base = 'network.help.' + key;
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

  render(body) {
    body.innerHTML = '';
    NetworkScreen.detach(ConceptualModule);
    if (!state.clean) { body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…')); return; }
    const page = mk('div', { class: 'authors-page conceptual-page' });
    body.appendChild(page);
    const { shown, total } = Pipeline.counts();
    if (!shown) {
      page.appendChild(EmptyState.create({ icon: 'filter', title: t('overview.noDocs'), text: t('overview.noDocsText'), actions: [{ label: t('overview.reviewFilters'), icon: 'filter', primary: true, onClick: () => { CleaningModule.tab = 'filters'; App.go('cleaning'); } }] }));
      return;
    }
    if (shown < total) page.appendChild(mk('p', { class: 'note-info', id: 'cnFiltered' }, icon('filter') + '<span>' + esc(tp('overview.filteredNote', shown, { total: fmtInt(total) })) + '</span>'));
    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('conceptual.tabsLabel') });
    ConceptualModule.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'ctab-' + id, 'aria-controls': 'cpanel', 'aria-selected': String(ConceptualModule.tab === id), tabindex: ConceptualModule.tab === id ? '0' : '-1' }, esc(t('conceptual.tabs.' + id)));
      b.addEventListener('click', () => { ConceptualModule.tab = id; ConceptualModule.rerender(); const nb = el('ctab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const T = ConceptualModule.TABS, i = T.indexOf(ConceptualModule.tab);
        ConceptualModule.tab = T[(i + (e.key === 'ArrowRight' ? 1 : T.length - 1)) % T.length];
        ConceptualModule.rerender();
        const nb = el('ctab-' + ConceptualModule.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel src-panel', role: 'tabpanel', id: 'cpanel', 'aria-labelledby': 'ctab-' + ConceptualModule.tab });
    page.appendChild(panel);
    ConceptualModule['render_' + ConceptualModule.tab](panel);
  },

  /* ---------------- co-occurrence network ---------------- */
  networkSpec() {
    const M = ConceptualModule;
    const field = () => t('cleaning.termFields.' + Pipeline.termLists().field);
    return {
      store: M, prefix: 'cn', figs: M.figs, rerender: () => M.rerender(),
      chart: (host, id, o, keep) => M.chart(host, id, o, keep),
      tableCard: (panel, id, title, helpKey, refs, dtOpts, hint) => M.tableCard(panel, id, title, helpKey, refs, dtOpts, hint),
      help: (key, title, refs) => M.help(key, title, refs),
      values: () => ({ termField: Pipeline.termLists().field }),
      onChange: (key, value) => { if (key !== 'termField') return false; Pipeline.update({ termField: value }); return true; },
      groups: () => NetworkPanel.commonGroups({
        before: [M.fieldControl()], minEdgeLabel: 'conceptual.minEdge',
        help: {
          selection: M.help('selection', t('network.params.selection'), ['callon1991']),
          weights: M.help('weights', t('network.params.weights'), ['vaneck2009', 'salton1983', 'jaccard1901', 'callon1991']),
          communities: M.help('communitiesParams', t('network.params.communities'), ['blondel2008', 'clauset2004', 'reichardt2006']),
          display: M.help('display', t('network.params.display'), ['jacomy2014']),
        },
      }),
      before: main => {
        main.appendChild(mk('p', { class: 'hint', id: 'cnFieldHint' }, esc(t('conceptual.fieldHint'))));
        const terms = Pipeline.termLists();
        if (terms.counts.length) return true;
        M.note(main, 'cnNoTerms', t('documents.words.none', { field: field().toLowerCase() }));
        return false;
      },
      deps: () => [Pipeline.termLists()],
      input: s => {
        const terms = Pipeline.termLists();
        const inc = M.P().incidence(terms.lists, { minFreq: s.minFreq, maxItems: s.maxNodes });
        /* only documents with two or more of the selected terms can create edges */
        return { input: { items: inc.items, docs: inc.docs.filter(d => d.length > 1) }, extra: { inc, terms } };
      },
      label: (data, i) => M.label(data, i),
      measures: { freq: t('network.measures.freq') },
      documents: (data, i) => {
        const key = data.nodes[i].key, out = [];
        data.terms.lists.forEach((list, r) => { if (list.includes(key)) out.push(r); });
        return out;
      },
      texts: {
        item: t('network.col.term'), search: t('network.view.search'), notFound: t('network.view.notFound'),
        tooFew: data => tp('network.tooFew', data.inc.items.length),
        viewTitle: t('conceptual.viewTitle'), viewHelp: M.help('view', t('conceptual.viewTitle'), ['jacomy2014', 'blondel2008']),
        viewSub: data => t('conceptual.viewSub', { field: t('cleaning.termFields.' + data.terms.field), normalization: t('network.normalizationsInline.' + M.params.normalization) }),
        figureTitle: t('conceptual.figureTitle'), figureFile: t('conceptual.figureFile'),
        figureHelp: M.help('figure', t('conceptual.figureTitle'), ['jacomy2014', 'blondel2008']),
        figureSub: (data, comm) => tp('conceptual.figureSub', comm.communities, { nodes: fmtInt(data.nodes.length), q: fmtNum(comm.q1, 3) }),
        neighbours: t('network.node.neighbours'), neighbourCount: n => tp('network.node.cooccurrences', n), documents: n => tp('network.node.documents', n),
        freqSum: t('network.col.occurrences'), members: t('network.col.terms'), count: t('network.col.count'), source: t('network.col.source'), target: t('network.col.target'),
      },
    };
  },

  render_cooccurrence(panel) { NetworkScreen.render(panel, ConceptualModule.networkSpec()); },

  chart(host, id, o, keep) {
    const prev = ConceptualModule.figs[id];
    const defaults = Object.assign({}, o.defaults);
    if (prev) (keep || []).forEach(k => { if (prev[k] !== undefined) defaults[k] = prev[k]; });
    const cc = ChartCard.mount(host, Object.assign({}, o, { id, defaults }));
    if (cc.fig) ConceptualModule.figs[id] = cc.fig.cfg;
    ConceptualModule.cc[id] = cc;
    return cc;
  },

  tableCard(panel, id, title, helpKey, refs, dtOpts, hint) {
    const card = mk('section', { class: 'card src-card', id });
    const h = mk('h2', null, esc(title));
    if (helpKey) h.appendChild(HelpPopover.button(ConceptualModule.help(helpKey, title, refs), { label: t('metric.help') + ': ' + title }));
    card.appendChild(h);
    if (hint) card.appendChild(mk('p', { class: 'hint' }, esc(hint)));
    card.appendChild(DataTable.create(Object.assign({ pageSize: 25, fileName: slug(title), title }, dtOpts)).el);
    panel.appendChild(card);
    return card;
  },

  /* ================= thematic map, thematic evolution and factorial analysis (Step 10) ================= */
  TM_DEFAULTS: { minFreq: 2, maxNodes: 250, minEdge: 1, resolution: 1, minClusterWords: 2, labelWords: 3 },
  EV_DEFAULTS: { cut1: null, cut2: null, cut3: null, cut4: null, minFreq: 2, maxNodes: 250, minEdge: 1, resolution: 1, minClusterWords: 2, labelWords: 3, minInclusion: 0 },
  FA_DEFAULTS: { method: 'mca', maxItems: 50, minFreq: 2, k: 0, dendrogram: false, labelCount: 50 },
  tm: null,
  ev: null,
  fa: null,
  _tm: null,
  _ev: null,
  _fa: null,

  tabParams(kind) {
    const key = kind, def = ConceptualModule[kind.toUpperCase() + '_DEFAULTS'];
    if (!ConceptualModule[key]) ConceptualModule[key] = Object.assign({}, def);
    return ConceptualModule[key];
  },
  setParam(kind, key, value) {
    if (key === 'termField') { Pipeline.update({ termField: value }); return; }
    ConceptualModule.tabParams(kind)[key] = value;
    ConceptualModule.rerender();
  },
  cached(slot, deps, compute) {
    const c = ConceptualModule[slot];
    if (c && c.deps.length === deps.length && c.deps.every((d, i) => d === deps[i])) return c.value;
    const value = compute();
    ConceptualModule[slot] = { deps, value };
    return value;
  },

  termLabel(terms, key) { return terms.labels.get(key) || key; },
  themeLabel(terms, cluster) { return cluster.labelKeys.map(k => ConceptualModule.termLabel(terms, k)).join(', '); },
  quadrantLabels() { const o = {}; Parsers.lib().QUADRANTS.forEach(q => { o[q] = t('conceptual.quadrants.' + q); }); return o; },
  fieldControl() {
    return { key: 'termField', type: 'select', label: t('conceptual.field'), options: Parsers.lib().TERM_FIELDS.map(f => [f, t('cleaning.termFields.' + f)]) };
  },
  selectionControls(p) {
    return [
      ConceptualModule.fieldControl(),
      { key: 'minFreq', type: 'number', label: t('network.params.minFreq'), min: 1, max: 1000, step: 1 },
      { key: p === 'fa' ? 'maxItems' : 'maxNodes', type: 'number', label: t('conceptual.params.words'), min: 3, max: p === 'fa' ? 200 : 1000, step: 1 },
    ].concat(p === 'fa' ? [] : [{ key: 'minEdge', type: 'number', label: t('conceptual.minEdge'), min: 1, max: 1000, step: 1 }]);
  },
  themeControls() {
    return [
      { key: 'resolution', type: 'range', label: t('network.params.resolution'), min: 0.1, max: 3, step: 0.1, format: v => fmtNum(+v, 1) },
      { key: 'minClusterWords', type: 'number', label: t('conceptual.params.minClusterWords'), min: 1, max: 100, step: 1 },
      { key: 'labelWords', type: 'number', label: t('conceptual.params.labelWords'), min: 1, max: 10, step: 1 },
    ];
  },

  thematic() {
    const terms = Pipeline.termLists(), s = ConceptualModule.tabParams('tm');
    return ConceptualModule.cached('_tm', [terms, s.minFreq, s.maxNodes, s.minEdge, s.resolution, s.minClusterWords, s.labelWords], () => {
      const P = ConceptualModule.P();
      const map = P.thematicMap(P.incidence(terms.lists, { minFreq: s.minFreq, maxItems: s.maxNodes }), s);
      return { terms, map, docs: P.themeDocuments(terms.lists, map.clusters) };
    });
  },

  quadrantCards(id, clusters, terms, extra) {
    const c = 'conceptual.cards.';
    const list = extra.slice();
    Parsers.lib().QUADRANTS.forEach((q, i) => {
      const inQ = clusters.filter(x => x.quadrant === q);
      list.push({ key: q, label: t('conceptual.quadrants.' + q), value: fmtInt(inQ.length), sub: inQ[0] ? ConceptualModule.themeLabel(terms, inQ[0]) : t(c + 'emptyQuadrant'), icon: 'concept', tone: ['rose', 'teal', 'accent', 'primary'][i], help: ConceptualModule.help('quadrant_' + q, t('conceptual.quadrants.' + q), ['cobo2011', 'callon1991']) });
    });
    const grid = MetricCard.grid(null, list);
    grid.id = id;
    grid.classList.add('net-stats');
    [...grid.children].forEach((card, i) => { card.dataset.key = list[i].key; });
    return grid;
  },

  themeRows(terms, clusters, counts) {
    return clusters.map(c => ({
      id: c.id + 1, label: ConceptualModule.themeLabel(terms, c), quadrant: t('conceptual.quadrants.' + c.quadrant), words: c.keys.length, freq: c.freq,
      centrality: c.centrality, density: c.density, documents: counts ? counts[c.id] : null, all: c.keys.map(k => ConceptualModule.termLabel(terms, k)).join('; '),
    }));
  },
  themeColumns(withDocs) {
    const c = 'conceptual.col.';
    return [
      { key: 'id', label: t(c + 'theme'), type: 'int' },
      { key: 'label', label: t(c + 'label'), cls: 'col-nowrap' },
      { key: 'quadrant', label: t(c + 'quadrant') },
      { key: 'words', label: t(c + 'words'), type: 'int' },
      { key: 'freq', label: t(c + 'freq'), type: 'int' },
      { key: 'centrality', label: t(c + 'centrality'), type: 'num', fmt: v => fmtNum(v, 4) },
      { key: 'density', label: t(c + 'density'), type: 'num', fmt: v => fmtNum(v, 4) },
    ].concat(withDocs ? [{ key: 'documents', label: t(c + 'documents'), type: 'int' }] : []).concat([{ key: 'all', label: t(c + 'allWords'), cls: 'col-wide', clamp: true }]);
  },

  layoutWithPanel(panel, id, kind, groups) {
    const layout = mk('div', { class: 'net-layout' });
    panel.appendChild(layout);
    const values = Object.assign({ termField: Pipeline.init().termField }, ConceptualModule.tabParams(kind));
    layout.appendChild(NetworkPanel.create({ id, values, groups, title: t('network.params.' + { tm: 'titleMap', ev: 'titleEvolution', fa: 'titleAnalysis' }[kind]), onChange: (k, v) => ConceptualModule.setParam(kind, k, v) }));
    const main = mk('div', { class: 'net-main' });
    layout.appendChild(main);
    return main;
  },

  /* ---------------- thematic map ---------------- */
  render_thematicMap(panel) {
    const s = ConceptualModule.tabParams('tm');
    const main = ConceptualModule.layoutWithPanel(panel, 'tmParams', 'tm', [
      { key: 'selection', title: t('network.params.selection'), help: ConceptualModule.help('selection', t('network.params.selection'), ['callon1991']), controls: ConceptualModule.selectionControls('tm') },
      { key: 'themes', title: t('conceptual.params.themes'), help: ConceptualModule.help('themesParams', t('conceptual.params.themes'), ['vaneck2009', 'blondel2008', 'callon1991']), controls: ConceptualModule.themeControls() },
    ]);
    main.appendChild(mk('p', { class: 'hint', id: 'tmHint' }, esc(t('conceptual.thematic.hint'))));
    const terms = Pipeline.termLists();
    if (!terms.counts.length) { ConceptualModule.note(main, 'tmNoTerms', t('documents.words.none', { field: t('cleaning.termFields.' + terms.field).toLowerCase() })); return; }
    const { map, docs } = ConceptualModule.thematic();
    if (map.clusters.length < 2) { ConceptualModule.note(main, 'tmTooFew', tp('conceptual.thematic.tooFew', map.clusters.length), true); return; }
    const c = 'conceptual.cards.';
    main.appendChild(ConceptualModule.quadrantCards('tmStats', map.clusters, terms, [
      { key: 'themes', label: t(c + 'themes'), value: fmtInt(map.clusters.length), sub: tp(c + 'wordsSub', map.nodes.length), icon: 'concept', tone: 'primary', help: ConceptualModule.help('themesCard', t(c + 'themes'), ['cobo2011', 'blondel2008']) },
      { key: 'documents', label: t(c + 'documents'), value: fmtInt(docs.byDoc.filter(x => x >= 0).length), sub: tp(c + 'documentsSub', terms.lists.length), icon: 'doc', tone: 'teal', help: ConceptualModule.help('themeDocs', t(c + 'documents'), ['cobo2011']) },
    ]));
    const title = t('conceptual.thematic.title');
    const clusters = map.clusters.map(cl => ({ x: cl.centrality, y: cl.density, size: cl.freq, quadrant: cl.quadrant, label: ConceptualModule.themeLabel(terms, cl), title: cl.keys.map(k => ConceptualModule.termLabel(terms, k)).join(', ') }));
    ConceptualModule.chart(main, 'tmMap', {
      title, subtitle: t('conceptual.thematic.sub', { themes: fmtInt(map.clusters.length), field: t('cleaning.termFields.' + terms.field) }),
      help: ConceptualModule.help('thematicMap', title, ['cobo2011', 'callon1991']),
      width: 960, height: 720, fileName: slug(t('conceptual.thematic.file')),
      data: () => ({ columns: ConceptualModule.themeColumns(true), rows: ConceptualModule.themeRows(terms, map.clusters, docs.counts) }),
      controls: Charts.thematicMapControls({ quadrants: Parsers.lib().QUADRANTS.map(q => t('conceptual.quadrants.' + q)) }),
      defaults: { title, subtitle: '', xlab: t('conceptual.thematic.xlab'), ylab: t('conceptual.thematic.ylab'), showQuadrants: true, maxRadius: 34, maxLabel: 60 },
      render: cfg => Charts.thematicMap(cfg, { clusters, medianX: map.medianCentrality, medianY: map.medianDensity, quadrantLabels: ConceptualModule.quadrantLabels() }),
    }, ['quadrantColors', 'showQuadrants', 'maxRadius', 'maxLabel', 'width', 'height']);
    ConceptualModule.tableCard(panel, 'tmThemes', t('conceptual.thematic.tableTitle'), 'themesTable', ['callon1991', 'cobo2011'], {
      columns: ConceptualModule.themeColumns(true), rows: ConceptualModule.themeRows(terms, map.clusters, docs.counts), sort: { key: 'id', dir: 'asc' },
    }, t('conceptual.thematic.tableHint', { medC: fmtNum(map.medianCentrality, 4), medD: fmtNum(map.medianDensity, 4) }));
    const records = Pipeline.records(), P = ConceptualModule.P();
    const rows = [];
    docs.byDoc.forEach((th, i) => {
      if (th < 0) return;
      const r = records[i];
      rows.push({ label: P.documentLabel(r), title: r.title, year: r.year, citations: r.timesCited, theme: ConceptualModule.themeLabel(terms, map.clusters[th]), matched: docs.matched[i].map(k => ConceptualModule.termLabel(terms, k)).join('; ') });
    });
    ConceptualModule.tableCard(panel, 'tmDocs', t('conceptual.thematic.docsTitle'), 'themeDocs', ['cobo2011'], {
      columns: [
        { key: 'label', label: t('documents.col.document'), cls: 'col-nowrap' },
        { key: 'title', label: t('documents.col.title'), cls: 'col-wide', clamp: true },
        { key: 'year', label: t('sources.col.year'), type: 'year' },
        { key: 'citations', label: t('documents.measures.citations'), type: 'int' },
        { key: 'theme', label: t('conceptual.col.label') },
        { key: 'matched', label: t('conceptual.col.matched') },
      ],
      rows, sort: { key: 'citations', dir: 'desc' },
    }, t('conceptual.thematic.docsHint'));
  },

  /* ---------------- thematic evolution ---------------- */
  evolution() {
    const terms = Pipeline.termLists(), s = ConceptualModule.tabParams('ev'), records = Pipeline.records();
    const cuts = [s.cut1, s.cut2, s.cut3, s.cut4].filter(v => v != null);
    return ConceptualModule.cached('_ev', [terms, records, cuts.join(','), s.minFreq, s.maxNodes, s.minEdge, s.resolution, s.minClusterWords, s.labelWords, s.minInclusion], () => {
      const P = ConceptualModule.P();
      const years = records.map(r => r.year);
      const known = years.filter(y => y != null).sort((a, b) => a - b);
      let used = cuts, byDefault = false;
      if (!used.length && known.length) {
        /* by default one cut at the median year, so that both periods have documents */
        let cut = known[Math.floor((known.length - 1) / 2)];
        if (cut >= known[known.length - 1]) cut = known[known.length - 1] - 1;
        used = [cut];
        byDefault = true;
      }
      /* the panel calls the number of words maxNodes, as in the thematic map; the engine reads maxItems */
      const ev = P.thematicEvolution(years, terms.lists, used, Object.assign({}, s, { maxItems: s.maxNodes }));
      return { terms, ev, cuts: used, byDefault, noYear: years.length - known.length };
    });
  },

  render_evolution(panel) {
    const main = ConceptualModule.layoutWithPanel(panel, 'evParams', 'ev', [
      { key: 'periods', title: t('conceptual.params.periods'), help: ConceptualModule.help('periods', t('conceptual.params.periods'), ['cobo2011']), controls: [1, 2, 3, 4].map(i => ({ key: 'cut' + i, type: 'optnumber', label: t('conceptual.params.cut', { n: i }), min: 1500, max: 2200, step: 1 })) },
      { key: 'selection', title: t('network.params.selection'), help: ConceptualModule.help('selection', t('network.params.selection'), ['callon1991']), controls: ConceptualModule.selectionControls('ev') },
      { key: 'themes', title: t('conceptual.params.themes'), help: ConceptualModule.help('themesParams', t('conceptual.params.themes'), ['vaneck2009', 'blondel2008', 'callon1991']), controls: ConceptualModule.themeControls() },
      { key: 'links', title: t('conceptual.params.links'), help: ConceptualModule.help('inclusion', t('conceptual.params.links'), ['cobo2011']), controls: [{ key: 'minInclusion', type: 'range', label: t('conceptual.params.minInclusion'), min: 0, max: 1, step: 0.05, format: v => fmtNum(+v, 2) }] },
    ]);
    main.appendChild(mk('p', { class: 'hint', id: 'evHint' }, esc(t('conceptual.evolution.hint'))));
    const terms = Pipeline.termLists();
    if (!terms.counts.length) { ConceptualModule.note(main, 'evNoTerms', t('documents.words.none', { field: t('cleaning.termFields.' + terms.field).toLowerCase() })); return; }
    const { ev, cuts, byDefault, noYear } = ConceptualModule.evolution();
    const periodLabel = p => (p.from === p.to ? String(p.from) : p.from + '–' + p.to);
    const summary = ev.periods.map(p => t('conceptual.evolution.period', { range: periodLabel(p), docs: tp('conceptual.evolution.periodDocs', p.docs), themes: tp('conceptual.evolution.periodThemes', p.map.clusters.length) })).join(' · ');
    ConceptualModule.note(main, 'evPeriods', (byDefault ? t('conceptual.evolution.defaultCut', { cut: cuts[0] }) + ' ' : '') + summary, false, 'calendar');
    if (noYear) ConceptualModule.note(main, 'evNoYear', tp('conceptual.evolution.noYear', noYear), true);
    if (ev.periods.length < 2) { ConceptualModule.note(main, 'evOnePeriod', t('conceptual.evolution.onePeriod'), true); return; }
    /* Sankey: nodes are the themes of each period */
    const nodes = [], index = [];
    ev.periods.forEach((p, pi) => {
      index.push([]);
      p.map.clusters.forEach(cl => {
        index[pi][cl.id] = nodes.length;
        nodes.push({ col: pi, label: ConceptualModule.themeLabel(terms, cl), value: cl.freq, quadrant: cl.quadrant, title: periodLabel(p) + ' · ' + t('conceptual.quadrants.' + cl.quadrant) + ' · ' + cl.keys.map(k => ConceptualModule.termLabel(terms, k)).join(', ') });
      });
    });
    const links = ev.links.map(l => ({
      source: index[l.period][l.from], target: index[l.period + 1][l.to], value: l.inclusion,
      title: t('conceptual.evolution.linkTitle', { inclusion: fmtNum(l.inclusion, 2), words: l.shared.map(k => ConceptualModule.termLabel(terms, k)).join(', ') }),
    }));
    const quadrants = Parsers.lib().QUADRANTS.map(q => t('conceptual.quadrants.' + q));
    const title = t('conceptual.evolution.title');
    ConceptualModule.chart(main, 'evSankey', {
      title, subtitle: t('conceptual.evolution.sub', { periods: tp('conceptual.evolution.subPeriods', ev.periods.length), links: tp('conceptual.evolution.subLinks', links.length) }),
      help: ConceptualModule.help('sankey', title, ['cobo2011']),
      width: 1000, height: Math.max(460, 90 + 34 * Math.max(...ev.periods.map(p => p.map.clusters.length))), fileName: slug(t('conceptual.evolution.file')),
      data: () => ({ columns: ConceptualModule.linkColumns(), rows: ConceptualModule.linkRows(ev, terms) }),
      controls: Charts.sankeyControls({ quadrants }),
      defaults: { title, subtitle: '', linkOpacity: 0.35, nodeWidth: 14, maxLabel: 40 },
      render: cfg => Charts.sankey(cfg, { columns: ev.periods.map(periodLabel), nodes, links }),
    }, ['quadrantColors', 'linkOpacity', 'nodeWidth', 'maxLabel', 'width', 'height']);
    const mapsTitle = t('conceptual.evolution.mapsTitle');
    const n = ev.periods.length, cols = n <= 3 ? n : n === 4 ? 2 : 3;
    ConceptualModule.chart(main, 'evMaps', {
      title: mapsTitle, subtitle: t('conceptual.evolution.mapsSub'), help: ConceptualModule.help('thematicMap', mapsTitle, ['cobo2011', 'callon1991']),
      width: 1000, height: Math.ceil(n / cols) * (cols >= 3 ? 330 : 420) + 60, fileName: slug(t('conceptual.evolution.mapsFile')),
      data: () => ({ columns: ConceptualModule.periodThemeColumns(), rows: ConceptualModule.periodThemeRows(ev, terms) }),
      controls: Charts.thematicMapControls({ quadrants }).filter(c => c.key !== 'xlab' && c.key !== 'ylab'),
      defaults: { title: mapsTitle, subtitle: '', showQuadrants: true, maxRadius: 34, maxLabel: 40 },
      render: cfg => Charts.thematicMaps(cfg, { quadrantLabels: ConceptualModule.quadrantLabels(), panels: ev.periods.map(p => ({ title: periodLabel(p), medianX: p.map.medianCentrality, medianY: p.map.medianDensity, clusters: p.map.clusters.map(cl => ({ x: cl.centrality, y: cl.density, size: cl.freq, quadrant: cl.quadrant, label: ConceptualModule.themeLabel(terms, cl) })) })) }),
    }, ['quadrantColors', 'showQuadrants', 'maxRadius', 'maxLabel', 'width', 'height']);
    ConceptualModule.tableCard(panel, 'evLinks', t('conceptual.evolution.linksTitle'), 'inclusion', ['cobo2011'], {
      columns: ConceptualModule.linkColumns(), rows: ConceptualModule.linkRows(ev, terms), sort: { key: 'inclusion', dir: 'desc' },
    });
    ConceptualModule.tableCard(panel, 'evThemes', t('conceptual.evolution.themesTitle'), 'themesTable', ['callon1991', 'cobo2011'], {
      columns: ConceptualModule.periodThemeColumns(), rows: ConceptualModule.periodThemeRows(ev, terms), sort: { key: 'period', dir: 'asc' },
    });
  },

  linkColumns() {
    const c = 'conceptual.col.';
    return [
      { key: 'fromPeriod', label: t(c + 'fromPeriod') }, { key: 'fromTheme', label: t(c + 'fromTheme'), cls: 'col-nowrap' },
      { key: 'toPeriod', label: t(c + 'toPeriod') }, { key: 'toTheme', label: t(c + 'toTheme'), cls: 'col-nowrap' },
      { key: 'shared', label: t(c + 'shared'), cls: 'col-wide', clamp: true },
      { key: 'inclusion', label: t(c + 'inclusion'), type: 'num', fmt: v => fmtNum(v, 3) },
    ];
  },
  linkRows(ev, terms) {
    const lab = p => (p.from === p.to ? String(p.from) : p.from + '–' + p.to);
    return ev.links.map(l => {
      const a = ev.periods[l.period], b = ev.periods[l.period + 1];
      return { fromPeriod: lab(a), fromTheme: ConceptualModule.themeLabel(terms, a.map.clusters[l.from]), toPeriod: lab(b), toTheme: ConceptualModule.themeLabel(terms, b.map.clusters[l.to]), shared: l.shared.map(k => ConceptualModule.termLabel(terms, k)).join('; '), inclusion: l.inclusion };
    });
  },
  periodThemeColumns() { return [{ key: 'period', label: t('conceptual.col.period') }].concat(ConceptualModule.themeColumns(false)); },
  periodThemeRows(ev, terms) {
    const lab = p => (p.from === p.to ? String(p.from) : p.from + '–' + p.to);
    return ev.periods.flatMap(p => ConceptualModule.themeRows(terms, p.map.clusters, null).map(r => Object.assign({ period: lab(p) }, r)));
  },

  /* ---------------- factorial analysis ---------------- */
  factorial() {
    const terms = Pipeline.termLists(), s = ConceptualModule.tabParams('fa');
    return ConceptualModule.cached('_fa', [terms, s.method, s.maxItems, s.minFreq, s.k], () => ({ terms, f: ConceptualModule.P().conceptualFactorial(terms.lists, { method: s.method, maxItems: s.maxItems, minFreq: s.minFreq, k: +s.k }) }));
  },

  render_factorial(panel) {
    const s = ConceptualModule.tabParams('fa');
    const kOptions = [['0', t('conceptual.factorial.kAuto')]].concat([2, 3, 4, 5, 6, 7, 8].map(k => [String(k), String(k)]));
    const main = ConceptualModule.layoutWithPanel(panel, 'faParams', 'fa', [
      { key: 'selection', title: t('network.params.selection'), help: ConceptualModule.help('faSelection', t('network.params.selection'), ['greenacre2007']), controls: [ConceptualModule.fieldControl(),
        { key: 'method', type: 'select', label: t('conceptual.params.method'), options: [['mca', t('conceptual.factorial.methods.mca')], ['ca', t('conceptual.factorial.methods.ca')]] }].concat(ConceptualModule.selectionControls('fa').slice(1)) },
      { key: 'clusters', title: t('conceptual.params.clusters'), help: ConceptualModule.help('kmeans', t('conceptual.params.clusters'), ['lloyd1982', 'hartigan1979', 'arthur2007', 'rousseeuw1987']), controls: [{ key: 'k', type: 'select', label: t('conceptual.params.k'), options: kOptions }] },
      { key: 'display', title: t('network.params.display'), help: ConceptualModule.help('dendrogram', t('network.params.display'), ['ward1963']), controls: [
        { key: 'labelCount', type: 'number', label: t('network.params.labelCount'), min: 0, max: 500, step: 1 },
        { key: 'dendrogram', type: 'checkbox', label: t('conceptual.params.dendrogram') },
      ] },
    ]);
    ConceptualModule.note(main, 'faNote', t('conceptual.factorial.familyNote'), false, 'sparkle');
    const terms = Pipeline.termLists();
    if (!terms.counts.length) { ConceptualModule.note(main, 'faNoTerms', t('documents.words.none', { field: t('cleaning.termFields.' + terms.field).toLowerCase() })); return; }
    const { f } = ConceptualModule.factorial();
    if (f.empty) { ConceptualModule.note(main, 'faTooFew', t('conceptual.factorial.tooFew'), true); return; }
    const mca = f.method === 'mca', res = f.res;
    const pct = d => (mca && res.pctAdjusted[d] > 0 ? res.pctAdjusted[d] : res.pct[d]);
    const c = 'conceptual.cards.';
    const clusterWords = Array.from({ length: f.k }, () => []);
    f.inc.items.forEach((it, i) => clusterWords[f.kmeans.labels[i]].push(i));
    const clusterNames = clusterWords.map((list, g) => t('conceptual.factorial.clusterName', { n: g + 1, words: list.slice(0, 3).map(i => ConceptualModule.termLabel(terms, f.inc.items[i].key)).join(', ') }));
    const best = f.suggestion.scores.find(x => x.k === f.suggestion.best);
    const list = [
      { key: 'words', label: t(c + 'words'), value: fmtInt(f.inc.items.length), sub: tp(c + 'docsSub', f.docs), icon: 'tag', tone: 'primary', help: ConceptualModule.help('faSelection', t(c + 'words'), ['greenacre2007']) },
      { key: 'dim1', label: t(c + 'dim', { n: 1 }), value: fmtPct(pct(0), 1), sub: t(mca ? c + 'adjusted' : c + 'raw'), icon: 'sigma', tone: 'accent', help: ConceptualModule.help(mca ? 'mca' : 'ca', t(c + 'dim', { n: 1 }), mca ? ['greenacre2007', 'benzecri1979'] : ['greenacre2007']) },
      { key: 'dim2', label: t(c + 'dim', { n: 2 }), value: fmtPct(pct(1), 1), sub: t(mca ? c + 'adjusted' : c + 'raw'), icon: 'sigma', tone: 'accent', help: ConceptualModule.help(mca ? 'mca' : 'ca', t(c + 'dim', { n: 2 }), mca ? ['greenacre2007', 'benzecri1979'] : ['greenacre2007']) },
      { key: 'clusters', label: t(c + 'clusters'), value: fmtInt(f.k), sub: t(c + 'silhouetteSub', { s: fmtNum(f.silhouette.mean, 3) }), icon: 'people', tone: 'teal', help: ConceptualModule.help('kmeans', t(c + 'clusters'), ['lloyd1982', 'hartigan1979', 'arthur2007', 'rousseeuw1987']) },
      { key: 'suggested', label: t(c + 'suggested'), value: fmtInt(f.suggestion.best), sub: best ? t(c + 'silhouetteSub', { s: fmtNum(best.silhouette, 3) }) : '', icon: 'sparkle', tone: 'rose', help: ConceptualModule.help('silhouette', t(c + 'suggested'), ['rousseeuw1987']) },
    ];
    const grid = MetricCard.grid(null, list);
    grid.id = 'faStats';
    grid.classList.add('net-stats');
    [...grid.children].forEach((card, i) => { card.dataset.key = list[i].key; });
    main.appendChild(grid);
    const dimLabel = d => t('conceptual.factorial.dimLabel', { n: d + 1, pct: fmtPct(pct(d), 1) });
    const title = t('conceptual.factorial.title', { method: t('conceptual.factorial.methods.' + f.method) });
    const points = f.inc.items.map((it, i) => ({ x: f.coord[i][0], y: f.coord[i][1], label: ConceptualModule.termLabel(terms, it.key), cluster: f.kmeans.labels[i] }));
    ConceptualModule.chart(main, 'faMap', {
      title, subtitle: t('conceptual.factorial.sub', { words: fmtInt(points.length), k: fmtInt(f.k) }),
      help: ConceptualModule.help(mca ? 'mca' : 'ca', title, mca ? ['greenacre2007', 'benzecri1979', 'aria2017'] : ['greenacre2007', 'aria2017']),
      width: 960, height: 720, fileName: slug(t('conceptual.factorial.file')),
      data: () => ({ columns: ConceptualModule.wordColumns(false), rows: ConceptualModule.wordRows(f, terms, clusterNames) }),
      controls: Charts.factorialMapControls(),
      defaults: { title, subtitle: '', xlab: dimLabel(0), ylab: dimLabel(1), palette: 'scimetrics', labelCount: s.labelCount, maxLabel: 40, showHulls: true, showLegend: true },
      render: cfg => Charts.factorialMap(cfg, { points, clusterNames, legendTitle: t('conceptual.col.cluster') }),
    }, ['palette', 'maxLabel', 'showHulls', 'showLegend', 'width', 'height']);
    if (s.dendrogram) {
      const dTitle = t('conceptual.factorial.dendroTitle');
      ConceptualModule.chart(main, 'faDendrogram', {
        title: dTitle, subtitle: t('conceptual.factorial.dendroSub'), help: ConceptualModule.help('dendrogram', dTitle, ['ward1963']),
        width: 900, height: Math.max(420, 60 + points.length * 14), fileName: slug(t('conceptual.factorial.dendroFile')),
        data: () => ({ columns: [{ key: 'step', label: t('conceptual.col.step') }, { key: 'a', label: t('conceptual.col.joinA') }, { key: 'b', label: t('conceptual.col.joinB') }, { key: 'height', label: t('conceptual.col.height') }, { key: 'size', label: t('conceptual.col.size') }], rows: f.ward.merges.map((m, i) => ({ step: i + 1, a: m[0], b: m[1], height: m[2], size: m[3] })) }),
        controls: Charts.dendrogramControls(),
        defaults: { title: dTitle, subtitle: '', xlab: t('conceptual.factorial.height'), palette: 'scimetrics', maxLabel: 40 },
        render: cfg => Charts.dendrogram(cfg, { merges: f.ward.merges, order: f.ward.order, labels: points.map(p => p.label), leafClusters: points.map(p => p.cluster), n: points.length }),
      }, ['palette', 'maxLabel', 'width', 'height']);
    }
    const eigRows = res.values.slice(0, res.dims).map((v, d) => ({ dim: d + 1, value: v, pct: res.pct[d], cum: res.pct.slice(0, d + 1).reduce((a, b) => a + b, 0), adjusted: mca ? res.pctAdjusted[d] : null, cumAdjusted: mca ? res.pctAdjusted.slice(0, d + 1).reduce((a, b) => a + b, 0) : null }));
    ConceptualModule.tableCard(panel, 'faEigen', t('conceptual.factorial.eigenTitle'), mca ? 'mca' : 'ca', mca ? ['greenacre2007', 'benzecri1979'] : ['greenacre2007'], {
      columns: [
        { key: 'dim', label: t('conceptual.col.dim'), type: 'int' },
        { key: 'value', label: t('conceptual.col.eigenvalue'), type: 'num', fmt: v => fmtNum(v, 5) },
        { key: 'pct', label: t('conceptual.col.pct'), type: 'pct', fmt: v => fmtPct(v, 2) },
        { key: 'cum', label: t('conceptual.col.cum'), type: 'pct', fmt: v => fmtPct(v, 2) },
      ].concat(mca ? [{ key: 'adjusted', label: t('conceptual.col.adjusted'), type: 'pct', fmt: v => fmtPct(v, 2) }, { key: 'cumAdjusted', label: t('conceptual.col.cumAdjusted'), type: 'pct', fmt: v => fmtPct(v, 2) }] : []),
      rows: eigRows, sort: { key: 'dim', dir: 'asc' }, pageSize: 10,
    });
    ConceptualModule.tableCard(panel, 'faWords', t('conceptual.factorial.wordsTitle'), 'faWords', ['greenacre2007'], {
      columns: ConceptualModule.wordColumns(true), rows: ConceptualModule.wordRows(f, terms, clusterNames), sort: { key: 'freq', dir: 'desc' },
    });
    ConceptualModule.tableCard(panel, 'faSilhouette', t('conceptual.factorial.silhouetteTitle'), 'silhouette', ['rousseeuw1987'], {
      columns: [{ key: 'k', label: t('conceptual.col.k'), type: 'int' }, { key: 'silhouette', label: t('conceptual.col.silhouette'), type: 'num', fmt: v => fmtNum(v, 3) }, { key: 'withinSS', label: t('conceptual.col.withinSS'), type: 'num', fmt: v => fmtNum(v, 4) }],
      rows: f.suggestion.scores, sort: { key: 'k', dir: 'asc' }, pageSize: 10, search: false,
    });
  },

  wordColumns(screen) {
    const c = 'conceptual.col.';
    const num = d => (screen ? { type: 'num', fmt: v => fmtNum(v, d) } : {});
    return [
      { key: 'word', label: t('network.col.term'), cls: screen ? 'col-nowrap' : undefined },
      Object.assign({ key: 'freq', label: t('network.measures.freq') }, screen ? { type: 'int' } : {}),
      { key: 'cluster', label: t(c + 'cluster') },
      Object.assign({ key: 'dim1', label: t(c + 'coord', { n: 1 }) }, num(4)),
      Object.assign({ key: 'dim2', label: t(c + 'coord', { n: 2 }) }, num(4)),
      Object.assign({ key: 'contrib1', label: t(c + 'contrib', { n: 1 }) }, num(2)),
      Object.assign({ key: 'contrib2', label: t(c + 'contrib', { n: 2 }) }, num(2)),
      Object.assign({ key: 'cos2', label: t(c + 'cos2') }, num(3)),
    ];
  },
  wordRows(f, terms, clusterNames) {
    const contrib = f.method === 'mca' ? f.res.wordContrib : f.res.colContrib, cos2 = f.method === 'mca' ? f.res.wordCos2 : f.res.colCos2;
    return f.inc.items.map((it, i) => ({
      word: ConceptualModule.termLabel(terms, it.key), freq: it.freq, cluster: clusterNames[f.kmeans.labels[i]],
      dim1: f.coord[i][0], dim2: f.coord[i][1], contrib1: contrib[i][0], contrib2: contrib[i][1], cos2: cos2[i][0] + cos2[i][1],
    }));
  },
};

Modules.define('conceptual', { render: body => ConceptualModule.render(body) });
on('cleanchange', () => ConceptualModule.rerender());
window.ConceptualModule = ConceptualModule;
