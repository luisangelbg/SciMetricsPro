/* SciMetricsPro — Authors module: authors, Lotka's law, institutions and countries
   (screens; the indicators are in js/metrics/authors.js). Reads Pipeline.records(). */
'use strict';

const AuthorsModule = {
  tab: 'productivity',
  TABS: ['productivity', 'overTime', 'lotka', 'impact', 'institutions', 'countries'],
  MEASURES: ['h', 'g', 'm', 'citations'],
  AFFILIATION_WARNING: 0.2,
  ui: { measure: 'n', topN: 10, timeN: 10, impactMeasure: 'h', impactN: 10, instMeasure: 'documents', instN: 15, ctryN: 15, mapMeasure: 'appearances', citeMeasure: 'citations' },
  figs: {},
  cc: {},
  _cache: null,

  P() { return Parsers.lib(); },

  /* computed again only when the filtered set or the reference year change */
  data() {
    const records = Pipeline.records(), refYear = Pipeline.referenceYear();
    const c = AuthorsModule._cache;
    if (c && c.records === records && c.refYear === refYear) return c.data;
    const P = AuthorsModule.P();
    const authors = P.authorsTable(records, { refYear });
    const data = {
      refYear, authors,
      lotka: P.lotka(authors.rows.map(r => r.n)),
      institutions: P.institutionsTable(records),
      countries: P.countriesTable(records),
    };
    AuthorsModule._cache = { records, refYear, data };
    return data;
  },

  country(code) { return code ? CleaningModule.countryLabel(code) : ''; },

  rerender() {
    if (state.route !== 'authors' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('authors', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  help(key, title, refs) {
    const base = 'authors.help.' + key;
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
    const page = mk('div', { class: 'authors-page' });
    body.appendChild(page);
    const { shown, total } = Pipeline.counts();
    if (!shown) {
      page.appendChild(EmptyState.create({ icon: 'filter', title: t('overview.noDocs'), text: t('overview.noDocsText'), actions: [{ label: t('overview.reviewFilters'), icon: 'filter', primary: true, onClick: () => { CleaningModule.tab = 'filters'; App.go('cleaning'); } }] }));
      return;
    }
    if (shown < total) page.appendChild(mk('p', { class: 'note-info', id: 'auFiltered' }, icon('filter') + '<span>' + esc(tp('overview.filteredNote', shown, { total: fmtInt(total) })) + '</span>'));
    const data = AuthorsModule.data();
    if (!data.authors.rows.length) {
      page.appendChild(EmptyState.create({ icon: 'people', title: t('authors.noAuthors'), text: t('authors.noAuthorsText') }));
      return;
    }
    page.appendChild(AuthorsModule.cards(data));
    const inst = data.institutions;
    const missing = inst.documents ? inst.withoutAffiliations / inst.documents : 0;
    if (missing >= AuthorsModule.AFFILIATION_WARNING) {
      page.appendChild(mk('p', { class: 'note-warn', id: 'auAffWarning', role: 'note' }, icon('help') + '<span>' + esc(tp('authors.warnAffiliations', inst.withoutAffiliations, { pct: fmtPct(missing, 0), total: fmtInt(inst.documents) })) + '</span>'));
    }

    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('authors.tabsLabel') });
    AuthorsModule.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'atab-' + id, 'aria-controls': 'apanel', 'aria-selected': String(AuthorsModule.tab === id), tabindex: AuthorsModule.tab === id ? '0' : '-1' }, esc(t('authors.tabs.' + id)));
      b.addEventListener('click', () => { AuthorsModule.tab = id; AuthorsModule.rerender(); const nb = el('atab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = AuthorsModule.TABS.indexOf(AuthorsModule.tab);
        AuthorsModule.tab = AuthorsModule.TABS[(i + (e.key === 'ArrowRight' ? 1 : AuthorsModule.TABS.length - 1)) % AuthorsModule.TABS.length];
        AuthorsModule.rerender();
        const nb = el('atab-' + AuthorsModule.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel src-panel', role: 'tabpanel', id: 'apanel', 'aria-labelledby': 'atab-' + AuthorsModule.tab });
    AuthorsModule['render_' + AuthorsModule.tab](panel, data);
    page.appendChild(panel);
  },

  cards(data) {
    const c = 'authors.cards.';
    const rows = data.authors.rows, L = data.lotka;
    const single = rows.filter(r => r.n === 1).length;
    const topH = rows.filter(r => r.h != null).sort((a, b) => b.h - a.h || b.citations - a.citations || a.rank - b.rank)[0];
    const refs = { authors: ['aria2017'], single: ['lotka1926'], lotka: ['lotka1926', 'pao1985'], topH: ['hirsch2005'], institutions: ['aria2017'], countries: ['aria2017'] };
    const spec = (key, value, sub, iconName, tone) => ({ key, label: t(c + key), value, sub, icon: iconName, tone, help: AuthorsModule.help(key === 'institutions' ? 'institutionsCard' : key, t(c + key), refs[key]) });
    const list = [
      spec('authors', fmtInt(rows.length), tp(c + 'authorsSub', data.authors.docs), 'people', 'primary'),
      spec('single', fmtPct(single / rows.length, 1), tp(c + 'singleSub', single), 'person', 'teal'),
      spec('lotka', L && L.beta != null ? fmtNum(L.beta, 2) : null, L && L.beta != null ? t(c + 'lotkaSub', { r2: fmtNum(L.r2, 3), c: fmtNum(L.C, 3) }) : t(c + 'lotkaNone'), 'sigma', 'accent'),
      spec('topH', topH ? fmtInt(topH.h) : null, topH ? topH.label : t('sources.cards.noCitations'), 'quote', 'rose'),
      spec('institutions', fmtInt(data.institutions.rows.length), tp(c + 'institutionsSub', data.institutions.withInstitution), 'journal', 'primary'),
      spec('countries', fmtInt(data.countries.authors.length), tp(c + 'countriesSub', data.countries.withCountry), 'globe', 'teal'),
    ];
    const grid = MetricCard.grid(null, list);
    grid.id = 'auCards';
    [...grid.children].forEach((card, i) => { card.dataset.key = list[i].key; });
    return grid;
  },

  select(id, label, value, options, onChange) { return SourcesModule.select(id, label, value, options, onChange); },
  toolbar(panel, controls) {
    const bar = mk('div', { class: 'card src-toolbar' });
    controls.forEach(c => bar.appendChild(c));
    panel.appendChild(bar);
    return bar;
  },
  nOptions(list) { return list.map(v => [v, String(v)]); },
  set(key, v) { AuthorsModule.ui[key] = v; AuthorsModule.rerender(); },

  chart(host, id, o, keep) {
    const prev = AuthorsModule.figs[id];
    const defaults = Object.assign({}, o.defaults);
    if (prev) (keep || []).forEach(k => { if (prev[k] !== undefined) defaults[k] = prev[k]; });
    const cc = ChartCard.mount(host, Object.assign({}, o, { id, defaults }));
    if (cc.fig) AuthorsModule.figs[id] = cc.fig.cfg;
    AuthorsModule.cc[id] = cc;
    return cc;
  },

  tableCard(panel, id, title, helpKey, refs, dtOpts, hint) {
    const card = mk('section', { class: 'card src-card', id });
    const h = mk('h2', null, esc(title));
    if (helpKey) h.appendChild(HelpPopover.button(AuthorsModule.help(helpKey, title, refs), { label: t('metric.help') + ': ' + title }));
    card.appendChild(h);
    if (hint) card.appendChild(mk('p', { class: 'hint' }, esc(hint)));
    card.appendChild(DataTable.create(Object.assign({ pageSize: 25, fileName: slug(title), title }, dtOpts)).el);
    panel.appendChild(card);
    return card;
  },

  pal(i) { return Fig.color('scimetrics', i); },
  barKeep: ['barColor', 'maxLabel', 'showValues', 'flip', 'width'],

  /* ---------------- most productive authors ---------------- */
  render_productivity(panel, data) {
    const ui = AuthorsModule.ui;
    AuthorsModule.toolbar(panel, [
      AuthorsModule.select('auMeasure', t('authors.controls.count'), ui.measure, [['n', t('authors.counts.n')], ['fractional', t('authors.counts.fractional')]], v => AuthorsModule.set('measure', v)),
      AuthorsModule.select('auTopN', t('authors.controls.topN'), ui.topN, AuthorsModule.nOptions([5, 10, 15, 20, 25, 30, 40, 50]), v => AuthorsModule.set('topN', +v)),
    ]);
    const fr = ui.measure === 'fractional';
    const rows = data.authors.rows.slice().sort((a, b) => (fr ? b.fractional - a.fractional : 0) || b.n - a.n || a.rank - b.rank).slice(0, ui.topN);
    const title = tp('authors.top.title', rows.length);
    AuthorsModule.chart(panel, 'auTop', {
      title, subtitle: t(fr ? 'authors.top.subFractional' : 'authors.top.sub'), help: AuthorsModule.help(fr ? 'fractional' : 'top', title, ['aria2017']),
      width: 900, height: SourcesModule.barHeight(rows.length), fileName: slug(t('authors.top.file')),
      data: () => ({ columns: [{ key: 'rank', label: t('authors.col.rank') }, { key: 'label', label: t('authors.col.author') }, { key: 'n', label: t('authors.col.documents') }, { key: 'fractional', label: t('authors.col.fractional') }], rows }),
      controls: Charts.rankBarsControls({}),
      defaults: { title, subtitle: '', xlab: '', ylab: t(fr ? 'authors.counts.fractional' : 'authors.counts.n'), flip: true, barColor: AuthorsModule.pal(0), maxLabel: 50, showValues: true },
      render: cfg => Charts.rankBars(cfg, { labels: rows.map(r => r.label), values: rows.map(r => (fr ? r.fractional : r.n)), integer: !fr, decimals: 2 }),
    }, AuthorsModule.barKeep);
    AuthorsModule.tableCard(panel, 'auAll', t('authors.table.title'), 'table', ['aria2017'], {
      columns: [
        { key: 'rank', label: t('authors.col.rank'), type: 'int' },
        { key: 'label', label: t('authors.col.author'), cls: 'col-nowrap' },
        { key: 'n', label: t('authors.col.documents'), type: 'int' },
        { key: 'fractional', label: t('authors.col.fractional'), type: 'num', fmt: v => fmtNum(v, 2) },
        { key: 'citations', label: t('sources.measures.citations'), type: 'int', get: r => (r.citedDocs ? r.citations : null) },
        { key: 'firstYear', label: t('sources.col.firstYear'), type: 'year' },
        { key: 'lastYear', label: t('sources.col.lastYear'), type: 'year' },
        { key: 'institution', label: t('authors.col.institution'), cls: 'col-wide', clamp: true },
        { key: 'country', label: t('authors.col.country'), get: r => AuthorsModule.country(r.country) },
      ],
      rows: data.authors.rows, sort: { key: 'rank', dir: 'asc' },
    });
  },

  /* ---------------- production over time ---------------- */
  render_overTime(panel, data) {
    const ui = AuthorsModule.ui;
    AuthorsModule.toolbar(panel, [AuthorsModule.select('auTimeN', t('authors.controls.topN'), ui.timeN, AuthorsModule.nOptions([5, 10, 15, 20, 25, 30]), v => AuthorsModule.set('timeN', +v))]);
    const rows = data.authors.rows.slice(0, ui.timeN);
    const points = AuthorsModule.P().authorProduction(rows, data.refYear);
    const years = points.map(p => p.year);
    const span = years.length ? [Math.min(...years), Math.max(...years)] : [data.refYear, data.refYear];
    const title = tp('authors.time.title', rows.length);
    AuthorsModule.chart(panel, 'auTime', {
      title, subtitle: t('authors.time.sub', { year: data.refYear }), help: AuthorsModule.help('overTime', title, ['aria2017']),
      width: 900, height: Math.max(360, 150 + rows.length * 30), fileName: slug(t('authors.time.file')),
      data: () => ({
        columns: [{ key: 'label', label: t('authors.col.author') }, { key: 'year', label: t('sources.col.year') }, { key: 'n', label: t('authors.col.documents') },
          { key: 'citations', label: t('sources.measures.citations') }, { key: 'citationsPerYear', label: t('authors.col.citationsPerYear') }],
        rows: points,
      }),
      controls: Charts.bubblesControls(),
      defaults: { title, subtitle: '', xlab: t('sources.col.year'), colormap: 'plasma', logColor: false, maxRadius: 13, showSpans: true, maxLabel: 40 },
      render: cfg => Charts.bubbles(cfg, { rows: rows.map(r => r.label), years: span, points: points.map(p => ({ row: p.row, year: p.year, n: p.n, value: p.citationsPerYear })), sizeLabel: t('authors.col.documents'), colorLabel: t('authors.col.citationsPerYear') }),
    }, ['colormap', 'logColor', 'maxRadius', 'showSpans', 'maxLabel', 'width']);
  },

  /* ---------------- Lotka's law ---------------- */
  render_lotka(panel, data) {
    const L = data.lotka;
    const c = 'authors.lotka.';
    const ks = L.ks;
    const fits = ks.p != null && ks.p >= 0.05;
    const stats = MetricCard.grid(null, [
      { label: t(c + 'beta'), value: L.beta != null ? fmtNum(L.beta, 3) : null, sub: t(c + 'betaSub'), icon: 'sigma', tone: 'accent', help: AuthorsModule.help('lotkaFit', t(c + 'beta'), ['lotka1926', 'pao1985', 'clauset2009']) },
      { label: t(c + 'constant'), value: L.C != null ? fmtNum(L.C, 3) : null, sub: t(c + 'constantSub', { c: fmtNum(6 / (Math.PI * Math.PI), 4) }), icon: 'sigma', tone: 'primary', help: AuthorsModule.help('lotkaFit', t(c + 'constant'), ['lotka1926', 'pao1985', 'clauset2009']) },
      { label: t(c + 'r2'), value: L.r2 != null ? fmtNum(L.r2, 3) : null, sub: tp(c + 'r2Sub', L.fitPoints || 0), icon: 'trend', tone: 'teal', help: AuthorsModule.help('lotkaFit', t(c + 'r2'), ['lotka1926', 'pao1985', 'clauset2009']) },
      { label: t(c + 'ks'), value: fmtNum(ks.D, 4), sub: t(c + 'ksSub', { c05: fmtNum(ks.critical05, 4), c01: fmtNum(ks.critical01, 4) }), icon: 'gauge', tone: 'rose', help: AuthorsModule.help('lotkaKs', t(c + 'ks'), ['pao1985', 'stephens1970']) },
      { label: t(c + 'p'), value: ks.p != null ? (ks.p < 0.001 ? '< 0.001' : fmtNum(ks.p, 3)) : null, sub: t(fits ? c + 'fits' : c + 'differs'), icon: fits ? 'sparkle' : 'help', tone: fits ? 'teal' : 'neutral', help: AuthorsModule.help('lotkaKs', t(c + 'p'), ['pao1985', 'stephens1970']) },
    ]);
    stats.id = 'auLotkaStats';
    panel.appendChild(stats);
    if (L.authors <= 35) panel.appendChild(mk('p', { class: 'note-warn' }, icon('help') + '<span>' + esc(tp(c + 'fewAuthors', L.authors)) + '</span>'));
    const title = t(c + 'title');
    AuthorsModule.chart(panel, 'auLotka', {
      title, subtitle: t(c + 'sub', { beta: fmtNum(L.beta, 2) }), help: AuthorsModule.help('lotkaChart', title, ['lotka1926', 'pao1985']),
      width: 900, height: 480, fileName: slug(title),
      data: () => ({ columns: AuthorsModule.lotkaColumns(), rows: L.rows }),
      controls: Charts.lotkaControls(),
      defaults: { title, subtitle: '', xlab: t(c + 'xlab'), ylab: t(c + 'ylab'), logScale: false, maxX: 20, showFitted: true, seriesColors: [AuthorsModule.pal(0), AuthorsModule.pal(3), AuthorsModule.pal(1)] },
      render: cfg => Charts.lotka(cfg, { rows: L.rows, labels: { observed: t(c + 'observed'), theoretical: t(c + 'theoretical'), fitted: t(c + 'fittedLabel', { beta: fmtNum(L.beta, 2) }) } }),
    }, ['logScale', 'maxX', 'showFitted', 'seriesColors', 'width', 'height']);
    AuthorsModule.tableCard(panel, 'auLotkaTable', t(c + 'tableTitle'), 'lotkaKs', ['pao1985'], {
      columns: AuthorsModule.lotkaColumns(true), rows: L.rows.filter(r => r.authors > 0 || r.x <= 10), pageSize: 25, sort: { key: 'x', dir: 'asc' },
    }, t(c + 'tableHint'));
  },

  lotkaColumns(screen) {
    const c = 'authors.lotka.col.';
    const pct = { type: 'pct', fmt: v => fmtPct(v, 2) };
    return [
      { key: 'x', label: t(c + 'x'), type: 'int' },
      { key: 'authors', label: t(c + 'authors'), type: 'int' },
      Object.assign({ key: 'observed', label: t(c + 'observed') }, screen ? pct : {}),
      Object.assign({ key: 'theoretical', label: t(c + 'theoretical') }, screen ? pct : {}),
      Object.assign({ key: 'fitted', label: t(c + 'fitted') }, screen ? pct : {}),
      Object.assign({ key: 'cumObserved', label: t(c + 'cumObserved') }, screen ? pct : {}),
      Object.assign({ key: 'cumTheoretical', label: t(c + 'cumTheoretical') }, screen ? pct : {}),
      Object.assign({ key: 'diff', label: t(c + 'diff') }, screen ? { type: 'num', fmt: v => fmtNum(v, 4) } : {}),
    ];
  },

  /* ---------------- impact ---------------- */
  render_impact(panel, data) {
    const ui = AuthorsModule.ui;
    const yl = mk('label', { class: 'src-control', for: 'auRefYear' });
    yl.appendChild(mk('span', { class: 'sf-label' }, esc(t('overview.refYear'))));
    const yi = mk('input', { type: 'number', id: 'auRefYear', min: 1900, max: 2200, step: 1, value: Pipeline.referenceYear() });
    yi.addEventListener('change', () => Pipeline.setReferenceYear(yi.value));
    yl.appendChild(yi);
    AuthorsModule.toolbar(panel, [
      AuthorsModule.select('auImpactMeasure', t('sources.controls.measure'), ui.impactMeasure, AuthorsModule.MEASURES.map(m => [m, t('sources.measures.' + m)]), v => AuthorsModule.set('impactMeasure', v)),
      AuthorsModule.select('auImpactN', t('authors.controls.topN'), ui.impactN, AuthorsModule.nOptions([5, 10, 15, 20, 25, 30, 40, 50]), v => AuthorsModule.set('impactN', +v)),
      yl,
    ]);
    const cited = data.authors.rows.filter(r => r.h != null);
    if (!cited.length) panel.appendChild(mk('p', { class: 'note-info' }, icon('quote') + '<span>' + esc(t('sources.impact.noCitations')) + '</span>'));
    const m = ui.impactMeasure;
    const val = r => (m === 'citations' ? r.citations : r[m]);
    const rows = cited.slice().sort((a, b) => val(b) - val(a) || b.citations - a.citations || a.rank - b.rank).slice(0, ui.impactN);
    const label = t('sources.measures.' + m);
    const title = tp('authors.impact.title', rows.length || ui.impactN, { measure: label });
    const helpKey = { h: 'hIndex', g: 'gIndex', m: 'mIndex', citations: 'citations' }[m];
    const helpRefs = { h: ['hirsch2005'], g: ['egghe2006'], m: ['hirsch2005', 'aria2017'], citations: ['aria2017'] }[m];
    AuthorsModule.chart(panel, 'auImpact', {
      title, subtitle: t('authors.impact.sub', { year: data.refYear }), help: AuthorsModule.help(helpKey, title, helpRefs),
      width: 900, height: SourcesModule.barHeight(Math.max(rows.length, 3)), fileName: slug(t('authors.impact.file', { measure: label })),
      data: () => ({ columns: [{ key: 'label', label: t('authors.col.author') }, { key: 'h', label: t('sources.measures.h') }, { key: 'g', label: t('sources.measures.g') }, { key: 'm', label: t('sources.measures.m') }, { key: 'citations', label: t('sources.measures.citations') }, { key: 'n', label: t('authors.col.documents') }], rows }),
      controls: Charts.rankBarsControls({}),
      defaults: { title, subtitle: '', xlab: '', ylab: label, flip: true, barColor: AuthorsModule.pal(2), maxLabel: 50, showValues: true },
      render: cfg => Charts.rankBars(cfg, { labels: rows.map(r => r.label), values: rows.map(val), integer: m !== 'm', decimals: 2 }),
    }, AuthorsModule.barKeep);
    AuthorsModule.tableCard(panel, 'auImpactTable', t('authors.impact.tableTitle'), 'impactTable', ['hirsch2005', 'egghe2006', 'aria2017'], {
      columns: [
        { key: 'label', label: t('authors.col.author'), cls: 'col-nowrap' },
        { key: 'h', label: t('sources.measures.h'), type: 'int' },
        { key: 'g', label: t('sources.measures.g'), type: 'int' },
        { key: 'm', label: t('sources.measures.m'), type: 'num', fmt: v => fmtNum(v, 3) },
        { key: 'citations', label: t('sources.measures.citations'), type: 'int', get: r => (r.citedDocs ? r.citations : null) },
        { key: 'n', label: t('authors.col.documents'), type: 'int' },
        { key: 'firstYear', label: t('sources.col.firstYear'), type: 'year' },
      ],
      rows: data.authors.rows, sort: { key: 'h', dir: 'desc' },
    });
  },

  /* ---------------- institutions ---------------- */
  render_institutions(panel, data) {
    const ui = AuthorsModule.ui;
    AuthorsModule.toolbar(panel, [
      AuthorsModule.select('auInstMeasure', t('authors.controls.count'), ui.instMeasure, [['documents', t('authors.inst.documents')], ['appearances', t('authors.inst.appearances')]], v => AuthorsModule.set('instMeasure', v)),
      AuthorsModule.select('auInstN', t('authors.controls.topN'), ui.instN, AuthorsModule.nOptions([5, 10, 15, 20, 25, 30, 40, 50]), v => AuthorsModule.set('instN', +v)),
    ]);
    const inst = data.institutions;
    const m = ui.instMeasure;
    const rows = inst.rows.slice().sort((a, b) => b[m] - a[m] || a.rank - b.rank).slice(0, ui.instN);
    const title = tp('authors.inst.title', rows.length);
    AuthorsModule.chart(panel, 'auInst', {
      title, subtitle: t(m === 'documents' ? 'authors.inst.subDocuments' : 'authors.inst.subAppearances'), help: AuthorsModule.help('institutions', title, ['aria2017']),
      width: 900, height: SourcesModule.barHeight(Math.max(rows.length, 3)), fileName: slug(t('authors.inst.file')),
      data: () => ({ columns: [{ key: 'name', label: t('authors.col.institution') }, { key: 'documents', label: t('authors.inst.documents') }, { key: 'appearances', label: t('authors.inst.appearances') }, { key: 'country', label: t('authors.col.country') }], rows: rows.map(r => Object.assign({}, r, { country: AuthorsModule.country(r.country) })) }),
      controls: Charts.rankBarsControls({}),
      defaults: { title, subtitle: '', xlab: '', ylab: t(m === 'documents' ? 'authors.inst.documents' : 'authors.inst.appearances'), flip: true, barColor: AuthorsModule.pal(5), maxLabel: 60, showValues: true },
      render: cfg => Charts.rankBars(cfg, { labels: rows.map(r => r.name), values: rows.map(r => r[m]), integer: true }),
    }, AuthorsModule.barKeep);
    AuthorsModule.tableCard(panel, 'auInstTable', t('authors.inst.tableTitle'), 'institutionsTable', ['aria2017'], {
      columns: [
        { key: 'rank', label: t('authors.col.rank'), type: 'int' },
        { key: 'name', label: t('authors.col.institution'), cls: 'col-wide', clamp: true },
        { key: 'documents', label: t('authors.inst.documents'), type: 'int' },
        { key: 'share', label: t('sources.col.share'), type: 'pct' },
        { key: 'appearances', label: t('authors.inst.appearances'), type: 'int' },
        { key: 'country', label: t('authors.col.country'), get: r => AuthorsModule.country(r.country) },
      ],
      rows: inst.rows, sort: { key: 'rank', dir: 'asc' },
    }, t('authors.inst.hint'));
  },

  /* ---------------- countries ---------------- */
  render_countries(panel, data) {
    const ui = AuthorsModule.ui;
    const ct = data.countries;
    const b = ct.basis;
    panel.appendChild(mk('p', { class: 'note-info', id: 'auCountryBasis' }, icon('globe') + '<span>' + esc(t('authors.ctry.basis', { corresponding: fmtInt(b.corresponding), first: fmtInt(b.firstAuthor), affiliation: fmtInt(b.affiliation), none: fmtInt(b.none) })) + '</span>'));
    AuthorsModule.toolbar(panel, [AuthorsModule.select('auCtryN', t('authors.controls.topCountries'), ui.ctryN, AuthorsModule.nOptions([5, 10, 15, 20, 30, 40]), v => AuthorsModule.set('ctryN', +v))]);

    /* corresponding author's country: SCP and MCP */
    const rows = ct.corresponding.slice(0, ui.ctryN);
    const scpTitle = tp('authors.ctry.scpTitle', rows.length);
    const series = [t('authors.ctry.scp'), t('authors.ctry.mcp')];
    AuthorsModule.chart(panel, 'auScp', {
      title: scpTitle, subtitle: t('authors.ctry.scpSub'), help: AuthorsModule.help('scp', scpTitle, ['aria2017']),
      width: 900, height: SourcesModule.barHeight(Math.max(rows.length, 3)), fileName: slug(t('authors.ctry.scpFile')),
      data: () => ({ columns: [{ key: 'name', label: t('authors.col.country') }, { key: 'documents', label: t('authors.col.documents') }, { key: 'scp', label: t('authors.ctry.scp') }, { key: 'mcp', label: t('authors.ctry.mcp') }, { key: 'mcpRatio', label: t('authors.ctry.mcpRatio') }], rows: rows.map(r => Object.assign({ name: AuthorsModule.country(r.code) }, r)) }),
      controls: Charts.stackedBarsControls({ series }),
      defaults: { title: scpTitle, subtitle: '', xlab: '', ylab: t('authors.col.documents'), flip: true, seriesColors: [AuthorsModule.pal(0), AuthorsModule.pal(1)], maxLabel: 40, showNotes: true },
      render: cfg => Charts.stackedBars(cfg, { labels: rows.map(r => AuthorsModule.country(r.code)), series: [{ label: series[0], values: rows.map(r => r.scp) }, { label: series[1], values: rows.map(r => r.mcp) }], notes: rows.map(r => t('authors.ctry.mcpNote', { pct: fmtPct(r.mcpRatio, 0) })) }),
    }, ['seriesColors', 'maxLabel', 'showNotes', 'flip', 'width']);

    /* all authors' countries on the map */
    const mm = ui.mapMeasure;
    const mapTitle = t('authors.ctry.mapTitle');
    const values = new Map(ct.authors.map(r => [r.code, r[mm]]));
    const mapCard = AuthorsModule.chart(panel, 'auMap', {
      title: mapTitle, subtitle: t(mm === 'appearances' ? 'authors.ctry.mapSubAppearances' : 'authors.ctry.mapSubDocuments'), help: AuthorsModule.help('map', mapTitle, ['aria2017', 'savric2019']),
      width: 960, height: 540, fileName: slug(mapTitle),
      data: () => ({ columns: [{ key: 'code', label: t('authors.col.code') }, { key: 'name', label: t('authors.col.country') }, { key: 'appearances', label: t('authors.ctry.appearances') }, { key: 'documents', label: t('authors.ctry.documents') }], rows: ct.authors.map(r => Object.assign({ name: AuthorsModule.country(r.code) }, r)) }),
      controls: Charts.worldMapControls(),
      defaults: { title: mapTitle, subtitle: '', colormap: 'ylgn', logColor: true, emptyColor: '#e5e7eb', borderColor: '#ffffff' },
      render: cfg => Charts.worldMap(cfg, { values, label: t(mm === 'appearances' ? 'authors.ctry.appearances' : 'authors.ctry.documents'), names: code => AuthorsModule.country(code), noDataLabel: t('authors.ctry.noData') }),
    }, ['colormap', 'logColor', 'emptyColor', 'borderColor', 'width', 'height']);
    const mapBar = mk('div', { class: 'src-map-controls' });
    mapBar.appendChild(AuthorsModule.select('auMapMeasure', t('authors.controls.mapMeasure'), mm, [['appearances', t('authors.ctry.appearances')], ['documents', t('authors.ctry.documents')]], v => AuthorsModule.set('mapMeasure', v)));
    mapCard.el.insertBefore(mapBar, mapCard.el.querySelector('.chart-body'));

    /* citations by corresponding author's country */
    const cm = ui.citeMeasure;
    const cited = ct.corresponding.filter(r => r.citedDocs > 0);
    const crows = cited.slice().sort((a, b) => (b[cm] || 0) - (a[cm] || 0) || b.documents - a.documents).slice(0, ui.ctryN);
    const citeTitle = tp('authors.ctry.citeTitle', crows.length || ui.ctryN);
    const citeCard = AuthorsModule.chart(panel, 'auCite', {
      title: citeTitle, subtitle: t(cm === 'citations' ? 'authors.ctry.citeSubTotal' : 'authors.ctry.citeSubMean'), help: AuthorsModule.help('countryCitations', citeTitle, ['aria2017']),
      width: 900, height: SourcesModule.barHeight(Math.max(crows.length, 3)), fileName: slug(t('authors.ctry.citeFile')),
      data: () => ({ columns: [{ key: 'name', label: t('authors.col.country') }, { key: 'citations', label: t('sources.measures.citations') }, { key: 'meanTC', label: t('authors.ctry.meanTC') }, { key: 'documents', label: t('authors.col.documents') }], rows: crows.map(r => Object.assign({ name: AuthorsModule.country(r.code) }, r)) }),
      controls: Charts.rankBarsControls({}),
      defaults: { title: citeTitle, subtitle: '', xlab: '', ylab: t(cm === 'citations' ? 'sources.measures.citations' : 'authors.ctry.meanTC'), flip: true, barColor: AuthorsModule.pal(3), maxLabel: 40, showValues: true },
      render: cfg => Charts.rankBars(cfg, { labels: crows.map(r => AuthorsModule.country(r.code)), values: crows.map(r => r[cm]), integer: cm === 'citations', decimals: 2 }),
    }, AuthorsModule.barKeep);
    const citeBar = mk('div', { class: 'src-map-controls' });
    citeBar.appendChild(AuthorsModule.select('auCiteMeasure', t('sources.controls.measure'), cm, [['citations', t('sources.measures.citations')], ['meanTC', t('authors.ctry.meanTC')]], v => AuthorsModule.set('citeMeasure', v)));
    citeCard.el.insertBefore(citeBar, citeCard.el.querySelector('.chart-body'));

    const byCode = new Map(ct.authors.map(r => [r.code, r]));
    const codes = [...new Set(ct.corresponding.map(r => r.code).concat(ct.authors.map(r => r.code)))];
    const corrBy = new Map(ct.corresponding.map(r => [r.code, r]));
    AuthorsModule.tableCard(panel, 'auCountryTable', t('authors.ctry.tableTitle'), 'countriesTable', ['aria2017'], {
      columns: [
        { key: 'name', label: t('authors.col.country'), cls: 'col-nowrap' },
        { key: 'code', label: t('authors.col.code') },
        { key: 'documents', label: t('authors.ctry.corrDocuments'), type: 'int' },
        { key: 'scp', label: t('authors.ctry.scp'), type: 'int' },
        { key: 'mcp', label: t('authors.ctry.mcp'), type: 'int' },
        { key: 'mcpRatio', label: t('authors.ctry.mcpRatio'), type: 'pct' },
        { key: 'citations', label: t('sources.measures.citations'), type: 'int' },
        { key: 'meanTC', label: t('authors.ctry.meanTC'), type: 'num', fmt: v => fmtNum(v, 2) },
        { key: 'appearances', label: t('authors.ctry.appearances'), type: 'int' },
        { key: 'authorDocuments', label: t('authors.ctry.documents'), type: 'int' },
      ],
      rows: codes.map(code => {
        const c = corrBy.get(code) || {}, a = byCode.get(code) || {};
        return { code, name: AuthorsModule.country(code), documents: c.documents || 0, scp: c.scp || 0, mcp: c.mcp || 0, mcpRatio: c.documents ? c.mcpRatio : null, citations: c.citedDocs ? c.citations : null, meanTC: c.meanTC != null ? c.meanTC : null, appearances: a.appearances || 0, authorDocuments: a.documents || 0 };
      }),
      sort: { key: 'appearances', dir: 'desc' },
    });
  },
};

Modules.define('authors', { render: body => AuthorsModule.render(body) });
on('cleanchange', () => AuthorsModule.rerender());
window.AuthorsModule = AuthorsModule;
