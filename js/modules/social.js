/* SciMetricsPro — Social structure: collaboration networks of authors, institutions and countries (a NetworkScreen),
   the world map of collaboration between countries and the chronology of collaboration (js/networks/social.js).
   Reads the filtered set with the authors, institutions and countries normalised in Cleaning. */
'use strict';

const SocialModule = {
  tab: 'network',
  TABS: ['network', 'worldMap', 'timeline'],
  NET_DEFAULTS: { unit: 'authors', normalization: 'association', minFreq: 2, maxNodes: 50, minEdge: 1, removeIsolated: true, algorithm: 'louvain', resolution: 1, layout: 'fa2', sizeBy: 'freq', labelCount: 20 },
  UNIT_MIN_FREQ: { authors: 2, institutions: 2, countries: 1 },
  MAP_DEFAULTS: { minEdge: 1, maxLinks: 100, shading: 'documents' },
  figs: {},
  cc: {},
  net: { params: null },
  map: null,
  _lists: null,
  _collab: null,
  _timeline: null,

  P() { return Parsers.lib(); },

  reset() {
    const M = SocialModule;
    NetworkScreen.detach(M.net);
    M.net = { params: null }; M.map = null;
    M._lists = null; M._collab = null; M._timeline = null;
    M.figs = {}; M.cc = {};
  },

  country(code) { return code ? CleaningModule.countryLabel(code) : ''; },

  rerender() {
    if (state.route !== 'social' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('social', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  /* help from social.help.<screen>_<key>, social.help.<key> or the shared network.help.<key> */
  help(key, title, refs, screen) {
    const own = k => I18N.has('social.help.' + k + '.text');
    const base = screen && own(screen + '_' + key) ? 'social.help.' + screen + '_' + key : own(key) ? 'social.help.' + key : 'network.help.' + key;
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
    const prev = SocialModule.figs[id];
    const defaults = Object.assign({}, o.defaults);
    if (prev) (keep || []).forEach(k => { if (prev[k] !== undefined) defaults[k] = prev[k]; });
    const cc = ChartCard.mount(host, Object.assign({}, o, { id, defaults }));
    if (cc.fig) SocialModule.figs[id] = cc.fig.cfg;
    SocialModule.cc[id] = cc;
    return cc;
  },

  tableCard(panel, id, title, helpKey, refs, dtOpts, hint) {
    const card = mk('section', { class: 'card src-card', id });
    const h = mk('h2', null, esc(title));
    if (helpKey) h.appendChild(HelpPopover.button(SocialModule.help(helpKey, title, refs), { label: t('metric.help') + ': ' + title }));
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
    const c = SocialModule[slot];
    if (c && c.deps.length === deps.length && c.deps.every((d, i) => d === deps[i])) return c.value;
    const value = compute();
    SocialModule[slot] = { deps, value };
    return value;
  },

  lists(unit) {
    const records = Pipeline.records();
    return SocialModule.cached('_lists', [records, unit], () => SocialModule.P().collaborationLists(records, unit));
  },
  collaboration() {
    const records = Pipeline.records();
    return SocialModule.cached('_collab', [records], () => SocialModule.P().countryCollaboration(records));
  },
  timeline() {
    const records = Pipeline.records();
    return SocialModule.cached('_timeline', [records], () => SocialModule.P().collaborationTimeline(records));
  },

  unitName(kind, unit) { return t('social.units.' + kind + '.' + unit); },

  render(body) {
    const M = SocialModule;
    body.innerHTML = '';
    NetworkScreen.detach(M.net);
    if (!state.clean) { body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…')); return; }
    const page = mk('div', { class: 'authors-page social-page' });
    body.appendChild(page);
    const { shown, total } = Pipeline.counts();
    if (!shown) {
      page.appendChild(EmptyState.create({ icon: 'filter', title: t('overview.noDocs'), text: t('overview.noDocsText'), actions: [{ label: t('overview.reviewFilters'), icon: 'filter', primary: true, onClick: () => { CleaningModule.tab = 'filters'; App.go('cleaning'); } }] }));
      return;
    }
    if (shown < total) page.appendChild(mk('p', { class: 'note-info', id: 'soFiltered' }, icon('filter') + '<span>' + esc(tp('overview.filteredNote', shown, { total: fmtInt(total) })) + '</span>'));
    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('social.tabsLabel') });
    M.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'stab-' + id, 'aria-controls': 'spanel', 'aria-selected': String(M.tab === id), tabindex: M.tab === id ? '0' : '-1' }, esc(t('social.tabs.' + id)));
      b.addEventListener('click', () => { M.tab = id; M.rerender(); const nb = el('stab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = M.TABS.indexOf(M.tab);
        M.tab = M.TABS[(i + (e.key === 'ArrowRight' ? 1 : M.TABS.length - 1)) % M.TABS.length];
        M.rerender();
        const nb = el('stab-' + M.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel src-panel', role: 'tabpanel', id: 'spanel', 'aria-labelledby': 'stab-' + M.tab });
    page.appendChild(panel);
    M['render_' + M.tab](panel);
  },

  /* ================= collaboration network ================= */
  networkSpec() {
    const M = SocialModule, P = M.P();
    const unitNow = () => M.net.params.unit;
    const label = (data, i) => {
      const key = data.nodes[i].key;
      return data.unit === 'countries' ? M.country(key) : (data.lists.labels.get(key) || String(key));
    };
    const unitLower = () => M.unitName('plural', unitNow()).toLowerCase();
    return {
      store: M.net, prefix: 'sn', figs: M.figs, defaults: M.NET_DEFAULTS, rerender: () => M.rerender(),
      buildKeys: ['unit', 'normalization', 'minFreq', 'maxNodes', 'minEdge', 'removeIsolated'],
      chart: (host, id, o, keep) => M.chart(host, id, o, keep),
      tableCard: (panel, id, title, helpKey, refs, dtOpts, hint) => M.tableCard(panel, id, title, helpKey, refs, dtOpts, hint),
      help: (key, title, refs) => M.help(key, title, refs, 'collab'),
      nodesRefs: ['newman2001'],
      edgesRefs: ['glanzel2004', 'vaneck2009'],
      groups: () => NetworkPanel.commonGroups({
        before: [{ key: 'unit', type: 'select', label: t('social.params.unit'), options: P.SOCIAL_UNITS.map(u => [u, M.unitName('plural', u)]) }],
        minFreqLabel: 'social.params.minDocs', minEdgeLabel: 'social.params.minCoauthored',
        sizeBy: [['freq', t('social.measures.documents')]].concat(['degree', 'strength', 'betweenness', 'pagerank'].map(m => [m, t('network.measures.' + m)])),
        help: {
          selection: M.help('collabSelection', t('network.params.selection'), ['newman2001', 'glanzel2004']),
          weights: M.help('collabWeights', t('network.params.weights'), ['vaneck2009', 'salton1983', 'jaccard1901']),
          communities: M.help('communitiesParams', t('network.params.communities'), ['blondel2008', 'clauset2004', 'reichardt2006']),
          display: M.help('display', t('network.params.display'), ['jacomy2014']),
        },
      }),
      onChange: (key, value) => {
        if (key !== 'unit') return false;
        M.net.selectedKey = null;
        M.net.params.unit = value;
        M.net.params.minFreq = M.UNIT_MIN_FREQ[value];
        M.rerender();
        return true;
      },
      before: main => {
        main.appendChild(mk('p', { class: 'hint', id: 'snHint' }, esc(t('social.network.hint.' + unitNow()))));
        const L = M.lists(unitNow());
        const withUnits = L.lists.filter(l => l.length).length;
        if (withUnits < L.lists.length) M.note(main, 'snCoverage', tp('social.network.coverage', withUnits, { docs: tp('social.network.coverageDocs', L.lists.length), unit: unitLower() }), withUnits < L.lists.length * 0.8);
        if (L.lists.some(l => l.length > 1)) return true;
        M.note(main, 'snNoUnit', t('social.network.noUnit', { unit: unitLower() }), true);
        return false;
      },
      deps: () => [Pipeline.records()],
      input: s => {
        const L = M.lists(s.unit);
        const inc = P.incidence(L.lists, { minFreq: s.minFreq, maxItems: s.maxNodes });
        return { input: { items: inc.items, docs: inc.docs.filter(d => d.length > 1) }, extra: { inc, lists: L, unit: s.unit } };
      },
      label,
      measures: { freq: t('social.measures.documents') },
      documents: (data, i) => {
        const key = data.nodes[i].key, out = [];
        data.lists.lists.forEach((list, r) => { if (list.includes(key)) out.push(r); });
        return out;
      },
      texts: {
        item: M.unitName('singular', unitNow()), search: t('social.search.' + unitNow()), notFound: t('social.notFound'),
        tooFew: data => tp('social.network.tooFew', data.inc.items.length, { unit: unitLower() }),
        viewTitle: t('social.network.viewTitle', { unit: unitLower() }),
        viewHelp: M.help('collabView', t('social.network.viewTitle', { unit: unitLower() }), ['newman2001', 'jacomy2014', 'blondel2008']),
        viewSub: () => t('social.network.viewSub', { normalization: t('network.normalizationsInline.' + M.net.params.normalization) }),
        figureTitle: t('social.network.figureTitle', { unit: unitLower() }),
        figureFile: t('social.network.figureFile', { unit: unitLower() }),
        figureHelp: M.help('collabView', t('social.network.figureTitle', { unit: unitLower() }), ['newman2001', 'jacomy2014', 'blondel2008']),
        figureSub: (data, comm) => tp('intellectual.figureSub', comm.communities, { nodes: fmtInt(data.nodes.length), q: fmtNum(comm.q1, 3) }),
        neighbours: t('social.network.neighbours'), neighbourCount: n => tp('social.network.count', n), documents: n => tp('social.network.documents', n),
        freqSum: t('social.col.documentsSum'), members: M.unitName('plural', unitNow()), count: t('social.col.coauthored'),
        source: t('social.col.unit1', { unit: M.unitName('singular', unitNow()) }), target: t('social.col.unit2', { unit: M.unitName('singular', unitNow()) }),
      },
    };
  },

  render_network(panel) {
    const M = SocialModule;
    if (!M.net.params) M.net.params = Object.assign({}, M.NET_DEFAULTS);
    NetworkScreen.render(panel, M.networkSpec());
  },

  /* ================= world map of collaboration ================= */
  mapParams() { if (!SocialModule.map) SocialModule.map = Object.assign({}, SocialModule.MAP_DEFAULTS); return SocialModule.map; },

  render_worldMap(panel) {
    const M = SocialModule, s = M.mapParams(), C = M.collaboration();
    const layout = mk('div', { class: 'net-layout' });
    panel.appendChild(layout);
    layout.appendChild(NetworkPanel.create({
      id: 'swParams', values: s, title: t('network.params.titleMap'),
      groups: [
        { key: 'selection', title: t('social.params.arcs'), help: M.help('mapArcs', t('social.params.arcs'), ['glanzel2004']), controls: [
          { key: 'minEdge', type: 'number', label: t('social.params.minCoauthored'), min: 1, max: 1000, step: 1 },
          { key: 'maxLinks', type: 'number', label: t('social.params.maxLinks'), min: 1, max: 1000, step: 1 },
        ] },
        { key: 'display', title: t('network.params.display'), help: M.help('mapShading', t('network.params.display'), ['savric2019']), controls: [
          { key: 'shading', type: 'select', label: t('social.params.shading'), options: ['documents', 'international', 'partners'].map(v => [v, t('social.shading.' + v)]) },
        ] },
      ],
      onChange: (k, v) => { s[k] = v; M.rerender(); },
    }));
    const main = mk('div', { class: 'net-main' });
    layout.appendChild(main);
    main.appendChild(mk('p', { class: 'hint', id: 'swHint' }, esc(t('social.map.hint'))));
    if (!C.withCountry) { M.note(main, 'swNoCountries', t('social.map.noCountries'), true); return; }
    if (C.withCountry < C.documents) M.note(main, 'swCoverage', tp('social.map.coverage', C.withCountry, { total: fmtInt(C.documents) }), C.withCountry < C.documents * 0.8);
    const pts = Charts.countryPoints();
    const eligible = C.pairs.filter(p => p.documents >= s.minEdge);
    const shown = eligible.slice(0, s.maxLinks);
    const unlocated = [...new Set(shown.flatMap(p => [p.a, p.b]).filter(c => !pts.has(c)))];
    if (unlocated.length) M.note(main, 'swUnlocated', t('social.map.unlocated', { countries: unlocated.map(M.country).join(', ') }), true);
    const byPartners = C.countries.slice().sort((a, b) => b.partners - a.partners || b.documents - a.documents || (a.code < b.code ? -1 : 1));
    const c = 'social.cards.';
    const strongest = C.pairs[0];
    main.appendChild(M.cards('swStats', [
      { key: 'countries', label: t(c + 'countries'), value: fmtInt(C.countries.length), sub: tp(c + 'countriesSub', C.countries.filter(x => x.partners).length), icon: 'globe', tone: 'primary', help: M.help('mapCountries', t(c + 'countries'), ['glanzel2004']) },
      { key: 'international', label: t(c + 'international'), value: fmtInt(C.international), sub: tp(c + 'internationalSub', C.withCountry, { pct: fmtPct(C.withCountry ? C.international / C.withCountry : 0, 1) }), icon: 'people', tone: 'teal', help: M.help('mapInternational', t(c + 'international'), ['katz1997']) },
      { key: 'pairs', label: t(c + 'pairs'), value: fmtInt(C.pairs.length), sub: tp(c + 'pairsSub', shown.length - shown.filter(p => !pts.has(p.a) || !pts.has(p.b)).length), icon: 'network', tone: 'accent', help: M.help('mapArcs', t(c + 'pairs'), ['glanzel2004']) },
      { key: 'strongest', label: t(c + 'strongest'), value: strongest ? fmtInt(strongest.documents) : '—', sub: strongest ? M.country(strongest.a) + ' – ' + M.country(strongest.b) : t(c + 'none'), icon: 'sparkle', tone: 'rose', help: M.help('mapArcs', t(c + 'strongest'), ['glanzel2004']) },
      { key: 'partners', label: t(c + 'mostPartners'), value: byPartners[0] && byPartners[0].partners ? fmtInt(byPartners[0].partners) : '—', sub: byPartners[0] && byPartners[0].partners ? M.country(byPartners[0].code) : t(c + 'none'), icon: 'globe', tone: 'primary', help: M.help('mapCountries', t(c + 'mostPartners'), ['glanzel2004']) },
    ]));
    const measure = s.shading;
    const values = new Map(C.countries.map(x => [x.code, measure === 'international' ? x.international : measure === 'partners' ? x.partners : x.documents]));
    const title = t('social.map.title');
    M.chart(main, 'swMap', {
      title, subtitle: t('social.map.sub', { arcs: tp('social.map.subArcs', shown.length), countries: tp('social.map.subCountries', C.countries.length) }),
      help: M.help('collabMap', title, ['glanzel2004', 'savric2019']),
      width: 1100, height: 640, fileName: slug(t('social.map.file')),
      data: () => ({ columns: M.pairColumns(), rows: M.pairRows(shown) }),
      controls: Charts.collaborationMapControls(),
      defaults: { title, subtitle: '', colormap: 'ylgn', logColor: true, emptyColor: '#e9edf2', borderColor: '#ffffff', arcColor: '#c8416a', arcOpacity: 0.6, minWidth: 0.8, maxWidth: 8, curvature: 0.25, labelCount: 12 },
      render: cfg => Charts.collaborationMap(cfg, { values, pairs: shown, names: code => M.country(code), label: t('social.shading.' + measure), noDataLabel: t('authors.ctry.noData'), widthLabel: t('social.map.widthLabel') }),
    }, ['colormap', 'logColor', 'emptyColor', 'borderColor', 'arcColor', 'arcOpacity', 'minWidth', 'maxWidth', 'curvature', 'labelCount', 'width', 'height']);
    M.tableCard(panel, 'swPairs', t('social.map.pairsTitle'), 'mapArcs', ['glanzel2004'], {
      columns: M.pairColumns(), rows: M.pairRows(eligible), sort: { key: 'documents', dir: 'desc' },
    }, t('social.map.pairsHint'));
    M.tableCard(panel, 'swCountries', t('social.map.countriesTitle'), 'mapCountries', ['glanzel2004', 'katz1997'], {
      columns: [
        { key: 'country', label: t('social.col.country'), cls: 'col-nowrap' },
        { key: 'documents', label: t('social.col.documents'), type: 'int' },
        { key: 'international', label: t('social.col.international'), type: 'int' },
        { key: 'share', label: t('social.col.internationalShare'), type: 'pct', fmt: v => fmtPct(v, 1) },
        { key: 'partners', label: t('social.col.partners'), type: 'int' },
        { key: 'collaborations', label: t('social.col.collaborations'), type: 'int' },
        { key: 'top', label: t('social.col.topPartner') },
        { key: 'all', label: t('social.col.allPartners'), cls: 'col-wide', clamp: true },
      ],
      rows: C.countries.map(x => ({
        country: M.country(x.code), documents: x.documents, international: x.international, share: x.documents ? x.international / x.documents : null,
        partners: x.partners, collaborations: x.collaborations, top: x.top ? M.country(x.top) + ' (' + fmtInt(x.topDocuments) + ')' : '',
        all: x.partnerList.map(p => M.country(p.code) + ' (' + fmtInt(p.documents) + ')').join('; '),
      })),
      sort: { key: 'documents', dir: 'desc' },
    });
  },

  pairColumns() {
    return [
      { key: 'a', label: t('social.col.country1'), cls: 'col-nowrap' },
      { key: 'b', label: t('social.col.country2'), cls: 'col-nowrap' },
      { key: 'documents', label: t('social.col.coauthored'), type: 'int' },
    ];
  },
  pairRows(pairs) { return pairs.map(p => ({ a: SocialModule.country(p.a), b: SocialModule.country(p.b), documents: p.documents })); },

  /* ================= chronology ================= */
  render_timeline(panel) {
    const M = SocialModule, T = M.timeline();
    const rows = T.rows, tot = T.totals;
    panel.appendChild(mk('p', { class: 'hint', id: 'stHint' }, esc(t('social.timeline.hint'))));
    if (!rows.length) { M.note(panel, 'stNoYears', t('social.timeline.noYears'), true); return; }
    const c = 'social.cards.';
    const num = v => (v == null ? '—' : fmtNum(v, 2));
    panel.appendChild(M.cards('stStats', [
      { key: 'authors', label: t(c + 'authorsPerDoc'), value: num(tot.authors), sub: tp(c + 'docsSub', tot.documents), icon: 'person', tone: 'primary', help: M.help('timelineAuthors', t(c + 'authorsPerDoc'), ['katz1997']) },
      { key: 'institutions', label: t(c + 'institutionsPerDoc'), value: num(tot.institutions), sub: tp(c + 'withInstitution', tot.withInstitution), icon: 'journal', tone: 'teal', help: M.help('timelineMeans', t(c + 'institutionsPerDoc'), ['katz1997', 'glanzel2004']) },
      { key: 'countries', label: t(c + 'countriesPerDoc'), value: num(tot.countries), sub: tp(c + 'withCountry', tot.withCountry), icon: 'globe', tone: 'accent', help: M.help('timelineMeans', t(c + 'countriesPerDoc'), ['katz1997', 'glanzel2004']) },
      { key: 'international', label: t(c + 'internationalShare'), value: tot.international == null ? '—' : fmtPct(tot.international, 1), sub: tp(c + 'withCountry', tot.withCountry), icon: 'people', tone: 'rose', help: M.help('mapInternational', t(c + 'internationalShare'), ['katz1997']) },
    ]));
    const known = rows.filter(r => r.withCountry || r.withInstitution);
    if (!known.length) { M.note(panel, 'stNoAffiliations', t('social.timeline.noAffiliations'), true); }
    else {
      const years = rows.map(r => r.year);
      const title = t('social.timeline.title');
      const series = [
        { label: t('social.timeline.countries'), values: rows.map(r => r.countries) },
        { label: t('social.timeline.institutions'), values: rows.map(r => r.institutions) },
      ];
      M.chart(panel, 'stTimeline', {
        title, subtitle: t('social.timeline.sub'), help: M.help('timelineMeans', title, ['katz1997', 'glanzel2004']),
        width: 960, height: 480, fileName: slug(t('social.timeline.file')),
        data: () => ({ columns: M.timelineColumns(), rows }),
        controls: Charts.linesControls(),
        defaults: { title, subtitle: '', xlab: t('social.timeline.xlab'), ylab: t('social.timeline.ylab'), palette: 'scimetrics', markers: true, maxLabel: 60, legendPos: 'bottom' },
        render: cfg => Charts.lines(cfg, { years, series }),
      }, ['palette', 'markers', 'legendPos', 'width', 'height']);
      const shareTitle = t('social.timeline.shareTitle');
      M.chart(panel, 'stShare', {
        title: shareTitle, subtitle: t('social.timeline.shareSub'), help: M.help('mapInternational', shareTitle, ['katz1997']),
        width: 960, height: 420, fileName: slug(t('social.timeline.shareFile')),
        data: () => ({ columns: M.timelineColumns(), rows }),
        controls: Charts.linesControls(),
        defaults: { title: shareTitle, subtitle: '', xlab: t('social.timeline.xlab'), ylab: t('social.timeline.shareYlab'), palette: 'scimetrics', markers: true, maxLabel: 60, legendPos: 'none' },
        render: cfg => Charts.lines(cfg, { years, max: 100, series: [{ label: t('social.timeline.share'), values: rows.map(r => (r.international == null ? null : 100 * r.international)) }] }),
      }, ['palette', 'markers', 'legendPos', 'width', 'height']);
    }
    M.tableCard(panel, 'stYears', t('social.timeline.tableTitle'), 'timelineMeans', ['katz1997'], {
      columns: M.timelineColumns(true), rows, sort: { key: 'year', dir: 'asc' },
    }, t('social.timeline.tableHint'));
  },

  timelineColumns(screen) {
    const num = screen ? { type: 'num', fmt: v => (v == null ? '—' : fmtNum(v, 2)) } : {};
    const int = screen ? { type: 'int' } : {};
    return [
      Object.assign({ key: 'year', label: t('sources.col.year') }, screen ? { type: 'year' } : {}),
      Object.assign({ key: 'documents', label: t('social.col.documents') }, int),
      Object.assign({ key: 'authors', label: t('social.col.authorsPerDoc') }, num),
      Object.assign({ key: 'withInstitution', label: t('social.col.withInstitution') }, int),
      Object.assign({ key: 'institutions', label: t('social.col.institutionsPerDoc') }, num),
      Object.assign({ key: 'withCountry', label: t('social.col.withCountry') }, int),
      Object.assign({ key: 'countries', label: t('social.col.countriesPerDoc') }, num),
      Object.assign({ key: 'international', label: t('social.col.internationalShare') }, screen ? { type: 'pct', fmt: v => (v == null ? '—' : fmtPct(v, 1)) } : {}),
    ];
  },
};

Modules.define('social', { render: body => SocialModule.render(body) });
on('cleanchange', () => SocialModule.rerender());
window.SocialModule = SocialModule;
