/* SciMetricsPro — Sources module (screens; the indicators are in js/metrics/sources.js).
   Reads the clean and filtered set (Pipeline.records()); sources carry the key and name given by the pipeline. */
'use strict';

const SourcesModule = {
  tab: 'productivity',
  TABS: ['productivity', 'bradford', 'impact', 'dynamics', 'table'],
  MEASURES: ['h', 'g', 'm', 'citations'],
  ui: { topN: 10, impactN: 10, measure: 'h', dynN: 5 },
  figs: {},
  cc: {},
  _cache: null,

  P() { return Parsers.lib(); },

  /* computed again only when the filtered set or the reference year change */
  data() {
    const records = Pipeline.records(), refYear = Pipeline.referenceYear();
    const c = SourcesModule._cache;
    if (c && c.records === records && c.refYear === refYear) return c.data;
    const data = SourcesModule.P().sourcesTable(records, { refYear });
    SourcesModule._cache = { records, refYear, data };
    return data;
  },

  zoneLabels() { return [t('sources.zones.z1'), t('sources.zones.z2'), t('sources.zones.z3')]; },
  measureLabel(m) { return t('sources.measures.' + m); },

  rerender() {
    if (state.route !== 'sources' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('sources', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  /* help from the dictionary: sources.help.<key> = { text, formula, s1, m1 …, interpretation } with its references */
  help(key, title, refs) {
    const base = 'sources.help.' + key;
    const where = [];
    for (let i = 1; I18N.has(base + '.s' + i); i++) where.push([t(base + '.s' + i), t(base + '.m' + i)]);
    return {
      title,
      text: t(base + '.text'),
      formula: I18N.has(base + '.formula') ? t(base + '.formula') : '',
      where,
      interpretation: I18N.has(base + '.interpretation') ? t(base + '.interpretation') : '',
      refs: refs.map(r => t('refs.' + r)),
    };
  },

  render(body) {
    body.innerHTML = '';
    if (!state.clean) {
      body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…'));
      return;
    }
    const page = mk('div', { class: 'sources-page' });
    body.appendChild(page);
    const { shown, total } = Pipeline.counts();
    if (!shown) {
      page.appendChild(EmptyState.create({ icon: 'filter', title: t('overview.noDocs'), text: t('overview.noDocsText'), actions: [{ label: t('overview.reviewFilters'), icon: 'filter', primary: true, onClick: () => { CleaningModule.tab = 'filters'; App.go('cleaning'); } }] }));
      return;
    }
    if (shown < total) page.appendChild(mk('p', { class: 'note-info', id: 'srcFiltered' }, icon('filter') + '<span>' + esc(tp('overview.filteredNote', shown, { total: fmtInt(total) })) + '</span>'));
    const data = SourcesModule.data();
    if (!data.rows.length) {
      page.appendChild(EmptyState.create({ icon: 'journal', title: t('sources.noSources'), text: t('sources.noSourcesText') }));
      return;
    }
    page.appendChild(SourcesModule.cards(data));

    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('sources.tabsLabel') });
    SourcesModule.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'stab-' + id, 'aria-controls': 'spanel', 'aria-selected': String(SourcesModule.tab === id), tabindex: SourcesModule.tab === id ? '0' : '-1' }, esc(t('sources.tabs.' + id)));
      b.addEventListener('click', () => { SourcesModule.tab = id; SourcesModule.rerender(); const nb = el('stab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = SourcesModule.TABS.indexOf(SourcesModule.tab);
        SourcesModule.tab = SourcesModule.TABS[(i + (e.key === 'ArrowRight' ? 1 : SourcesModule.TABS.length - 1)) % SourcesModule.TABS.length];
        SourcesModule.rerender();
        const nb = el('stab-' + SourcesModule.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel src-panel', role: 'tabpanel', id: 'spanel', 'aria-labelledby': 'stab-' + SourcesModule.tab });
    SourcesModule['render_' + SourcesModule.tab](panel, data);
    page.appendChild(panel);
  },

  cards(data) {
    const c = 'sources.cards.';
    const rows = data.rows;
    const spellings = Pipeline.sourceSpellings || new Map();
    const variants = rows.reduce((s, r) => s + Math.max(0, (spellings.get(r.key) || [r.label]).length - 1), 0);
    const [z1, z2, z3] = data.bradford.zones;
    const ratios = [z1.sources ? z2.sources / z1.sources : null, z2.sources ? z3.sources / z2.sources : null].filter(v => v != null && v > 0);
    const k = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
    const topH = rows.filter(r => r.h != null).sort((a, b) => b.h - a.h || b.citations - a.citations || a.rank - b.rank)[0];
    const refs = { sources: ['aria2017'], perSource: ['aria2017'], core: ['bradford1934'], multiplier: ['bradford1934'], topSource: ['aria2017'], topH: ['hirsch2005'] };
    const spec = (key, value, sub, iconName, tone) => ({ key, label: t(c + key), value, sub, icon: iconName, tone, help: SourcesModule.help(key, t(c + key), refs[key]) });
    const list = [
      spec('sources', fmtInt(rows.length), variants ? tp(c + 'sourcesSub', variants) : t(c + 'sourcesSubNone'), 'journal', 'primary'),
      spec('perSource', fmtNum(data.total / rows.length, 2), data.withoutSource ? tp(c + 'perSourceSub', data.withoutSource) : t(c + 'perSourceSubNone'), 'doc', 'teal'),
      spec('core', fmtInt(z1.sources), t(c + 'coreSub', { sources: tp(c + 'coreSources', z1.sources), docs: tp(c + 'coreDocs', z1.documents), pct: fmtPct(z1.shareDocuments, 1) }), 'sparkle', 'accent'),
      spec('multiplier', k == null ? null : fmtNum(k, 2), t(c + 'multiplierSub', { s1: fmtInt(z1.sources), s2: fmtInt(z2.sources), s3: fmtInt(z3.sources) }), 'sigma', 'rose'),
      spec('topSource', fmtInt(rows[0].n), rows[0].label, 'trend', 'primary'),
      spec('topH', topH ? fmtInt(topH.h) : null, topH ? topH.label : t(c + 'noCitations'), 'quote', 'teal'),
    ];
    const grid = MetricCard.grid(null, list);
    grid.id = 'srcCards';
    [...grid.children].forEach((card, i) => { card.dataset.key = list[i].key; });
    return grid;
  },

  /* a select in a panel toolbar that redraws the page */
  select(id, label, value, options, onChange) {
    const wrap = mk('label', { class: 'src-control', for: id });
    wrap.appendChild(mk('span', { class: 'sf-label' }, esc(label)));
    const s = mk('select', { id });
    options.forEach(([v, text]) => { const o = mk('option', { value: v }, esc(text)); if (String(v) === String(value)) o.selected = true; s.appendChild(o); });
    s.addEventListener('change', () => onChange(s.value));
    wrap.appendChild(s);
    return wrap;
  },

  chart(host, id, o, keep) {
    const prev = SourcesModule.figs[id];
    const defaults = Object.assign({}, o.defaults);
    if (prev) (keep || []).forEach(k => { if (prev[k] !== undefined) defaults[k] = prev[k]; });
    const cc = ChartCard.mount(host, Object.assign({}, o, { id, defaults }));
    if (cc.fig) SourcesModule.figs[id] = cc.fig.cfg;
    SourcesModule.cc[id] = cc;
    return cc;
  },

  barHeight(n) { return Math.max(320, Math.min(1800, 110 + n * 28)); },

  /* ---------------- most productive sources ---------------- */
  render_productivity(panel, data) {
    const bar = mk('div', { class: 'card src-toolbar' });
    bar.appendChild(SourcesModule.select('srcTopN', t('sources.controls.topN'), SourcesModule.ui.topN, [5, 10, 15, 20, 25, 30, 40, 50].map(v => [v, String(v)]),
      v => { SourcesModule.ui.topN = +v; SourcesModule.rerender(); }));
    panel.appendChild(bar);
    const rows = data.rows.slice(0, SourcesModule.ui.topN);
    const title = tp('sources.top.title', rows.length);
    const pal = i => Fig.color('scimetrics', i);
    SourcesModule.chart(panel, 'srcTop', {
      title, subtitle: t('sources.top.sub'), help: SourcesModule.help('top', title, ['aria2017', 'bradford1934']),
      width: 900, height: SourcesModule.barHeight(rows.length), fileName: slug(t('sources.top.file')),
      data: () => ({
        columns: [{ key: 'rank', label: t('sources.col.rank') }, { key: 'label', label: t('sources.col.source') }, { key: 'n', label: t('sources.col.documents') },
          { key: 'share', label: t('sources.col.share') }, { key: 'zone', label: t('sources.col.zone') }],
        rows,
      }),
      controls: Charts.rankBarsControls({ zones: true, zoneLabels: SourcesModule.zoneLabels() }),
      defaults: { title, subtitle: '', xlab: '', ylab: t('sources.top.vallab'), flip: true, colorByZone: true, zoneColors: [pal(0), pal(2), pal(1)], barColor: pal(0), maxLabel: 60, showValues: true },
      render: cfg => Charts.rankBars(cfg, { labels: rows.map(r => r.label), values: rows.map(r => r.n), integer: true, zones: rows.map(r => r.zone), zoneLabels: SourcesModule.zoneLabels() }),
    }, ['colorByZone', 'zoneColors', 'barColor', 'maxLabel', 'showValues', 'flip', 'width']);
  },

  /* ---------------- Bradford's law ---------------- */
  render_bradford(panel, data) {
    const b = data.bradford;
    const title = t('sources.bradford.title');
    const pal = i => Fig.color('scimetrics', i);
    SourcesModule.chart(panel, 'srcBradford', {
      title, subtitle: t('sources.bradford.sub'), help: SourcesModule.help('bradford', title, ['bradford1934']),
      width: 900, height: 480, fileName: slug(title),
      data: () => ({
        columns: [{ key: 'rank', label: t('sources.col.rank') }, { key: 'label', label: t('sources.col.source') }, { key: 'n', label: t('sources.col.documents') },
          { key: 'cumulative', label: t('sources.col.cumulative') }, { key: 'cumulativeShare', label: t('sources.col.cumulativeShare') }, { key: 'zone', label: t('sources.col.zone') }],
        rows: data.rows,
      }),
      controls: Charts.bradfordControls(),
      defaults: { title, subtitle: '', xlab: t('sources.bradford.xlab'), ylab: t('sources.bradford.ylab'), lineColor: pal(0), zoneColor: pal(1), showThirds: true, markers: true },
      render: cfg => Charts.bradford(cfg, { cumulative: data.rows.map(r => r.cumulative), cuts: b.cuts, total: b.total, zoneLabels: SourcesModule.zoneLabels() }),
    }, ['lineColor', 'zoneColor', 'showThirds', 'markers', 'width', 'height']);

    const zcard = mk('section', { class: 'card src-card', id: 'srcZones' });
    const h = mk('h2', null, esc(t('sources.bradford.zonesTitle')));
    h.appendChild(HelpPopover.button(SourcesModule.help('zones', t('sources.bradford.zonesTitle'), ['bradford1934']), { label: t('metric.help') + ': ' + t('sources.bradford.zonesTitle') }));
    zcard.appendChild(h);
    const zt = DataTable.create({
      columns: [
        { key: 'zone', label: t('sources.col.zone'), get: r => SourcesModule.zoneLabels()[r.zone - 1] },
        { key: 'sources', label: t('sources.col.sources'), type: 'int' },
        { key: 'shareSources', label: t('sources.col.shareSources'), type: 'pct' },
        { key: 'documents', label: t('sources.col.documents'), type: 'int' },
        { key: 'shareDocuments', label: t('sources.col.shareDocuments'), type: 'pct' },
        { key: 'ratio', label: t('sources.col.ratio'), type: 'num', fmt: v => fmtNum(v, 2) },
      ],
      rows: b.zones.map((z, i) => Object.assign({}, z, { ratio: i > 0 && b.zones[i - 1].sources ? z.sources / b.zones[i - 1].sources : null })), pageSize: 10, search: false, fileName: slug(t('sources.bradford.zonesTitle')), title: t('sources.bradford.zonesTitle'),
    });
    zcard.appendChild(zt.el);
    zcard.appendChild(mk('p', { class: 'hint' }, esc(tp('sources.bradford.zonesNote', b.total))));
    panel.appendChild(zcard);

    const scard = mk('section', { class: 'card src-card', id: 'srcByZone' });
    scard.appendChild(mk('h2', null, esc(t('sources.bradford.byZoneTitle'))));
    const st = DataTable.create({
      columns: [
        { key: 'zone', label: t('sources.col.zone'), type: 'int' },
        { key: 'rank', label: t('sources.col.rank'), type: 'int' },
        { key: 'label', label: t('sources.col.source'), cls: 'col-wide', clamp: true },
        { key: 'n', label: t('sources.col.documents'), type: 'int' },
        { key: 'cumulative', label: t('sources.col.cumulative'), type: 'int' },
        { key: 'cumulativeShare', label: t('sources.col.cumulativeShare'), type: 'pct' },
      ],
      rows: data.rows, pageSize: 25, sort: { key: 'rank', dir: 'asc' }, fileName: slug(t('sources.bradford.byZoneTitle')), title: t('sources.bradford.byZoneTitle'),
    });
    scard.appendChild(st.el);
    panel.appendChild(scard);
  },

  /* ---------------- impact ---------------- */
  render_impact(panel, data) {
    const ui = SourcesModule.ui;
    const bar = mk('div', { class: 'card src-toolbar' });
    bar.appendChild(SourcesModule.select('srcImpactMeasure', t('sources.controls.measure'), ui.measure, SourcesModule.MEASURES.map(m => [m, SourcesModule.measureLabel(m)]),
      v => { ui.measure = v; SourcesModule.rerender(); }));
    bar.appendChild(SourcesModule.select('srcImpactN', t('sources.controls.topN'), ui.impactN, [5, 10, 15, 20, 25, 30, 40, 50].map(v => [v, String(v)]),
      v => { ui.impactN = +v; SourcesModule.rerender(); }));
    const yl = mk('label', { class: 'src-control', for: 'srcRefYear' });
    yl.appendChild(mk('span', { class: 'sf-label' }, esc(t('overview.refYear'))));
    const yi = mk('input', { type: 'number', id: 'srcRefYear', min: 1900, max: 2200, step: 1, value: Pipeline.referenceYear() });
    yi.addEventListener('change', () => Pipeline.setReferenceYear(yi.value));
    yl.appendChild(yi);
    bar.appendChild(yl);
    bar.appendChild(mk('p', { class: 'sf-hint' }, esc(t('sources.impact.refYearHint'))));
    panel.appendChild(bar);

    const cited = data.rows.filter(r => r.h != null);
    if (!cited.length) panel.appendChild(mk('p', { class: 'note-info', id: 'srcNoCitations' }, icon('quote') + '<span>' + esc(t('sources.impact.noCitations')) + '</span>'));
    const m = ui.measure;
    const val = r => (m === 'citations' ? r.citations : r[m]);
    const rows = cited.slice().sort((a, b) => val(b) - val(a) || b.citations - a.citations || a.rank - b.rank).slice(0, ui.impactN);
    const title = tp('sources.impact.title', rows.length || ui.impactN, { measure: SourcesModule.measureLabel(m) });
    const pal = i => Fig.color('scimetrics', i);
    const helpKey = { h: 'hIndex', g: 'gIndex', m: 'mIndex', citations: 'citations' }[m];
    const helpRefs = { h: ['hirsch2005'], g: ['egghe2006'], m: ['hirsch2005', 'aria2017'], citations: ['aria2017'] }[m];
    SourcesModule.chart(panel, 'srcImpact', {
      title, subtitle: t('sources.impact.sub', { year: data.refYear }), help: SourcesModule.help(helpKey, title, helpRefs),
      width: 900, height: SourcesModule.barHeight(Math.max(rows.length, 3)), fileName: slug(t('sources.impact.file', { measure: SourcesModule.measureLabel(m) })),
      data: () => ({
        columns: [{ key: 'label', label: t('sources.col.source') }, { key: 'h', label: t('sources.measures.h') }, { key: 'g', label: t('sources.measures.g') },
          { key: 'm', label: t('sources.measures.m') }, { key: 'citations', label: t('sources.measures.citations') }, { key: 'n', label: t('sources.col.documents') },
          { key: 'firstYear', label: t('sources.col.firstYear') }],
        rows,
      }),
      controls: Charts.rankBarsControls({ zones: true, zoneLabels: SourcesModule.zoneLabels() }),
      defaults: { title, subtitle: '', xlab: '', ylab: SourcesModule.measureLabel(m), flip: true, colorByZone: false, zoneColors: [pal(0), pal(2), pal(1)], barColor: pal(2), maxLabel: 60, showValues: true },
      render: cfg => Charts.rankBars(cfg, { labels: rows.map(r => r.label), values: rows.map(val), integer: m !== 'm', decimals: 2, zones: rows.map(r => r.zone), zoneLabels: SourcesModule.zoneLabels() }),
    }, ['colorByZone', 'zoneColors', 'barColor', 'maxLabel', 'showValues', 'flip', 'width']);

    const card = mk('section', { class: 'card src-card', id: 'srcImpactTable' });
    const h = mk('h2', null, esc(t('sources.impact.tableTitle')));
    h.appendChild(HelpPopover.button(SourcesModule.help('impactTable', t('sources.impact.tableTitle'), ['hirsch2005', 'egghe2006', 'aria2017']), { label: t('metric.help') + ': ' + t('sources.impact.tableTitle') }));
    card.appendChild(h);
    const dt = DataTable.create({
      columns: [
        { key: 'label', label: t('sources.col.source'), cls: 'col-wide', clamp: true },
        { key: 'h', label: t('sources.measures.h'), type: 'int' },
        { key: 'g', label: t('sources.measures.g'), type: 'int' },
        { key: 'm', label: t('sources.measures.m'), type: 'num', fmt: v => fmtNum(v, 3) },
        { key: 'citations', label: t('sources.measures.citations'), type: 'int', get: r => (r.citedDocs ? r.citations : null) },
        { key: 'n', label: t('sources.col.documents'), type: 'int' },
        { key: 'firstYear', label: t('sources.col.firstYear'), type: 'year' },
      ],
      rows: data.rows, pageSize: 25, sort: { key: 'h', dir: 'desc' }, fileName: slug(t('sources.impact.tableTitle')), title: t('sources.impact.tableTitle'),
    });
    card.appendChild(dt.el);
    panel.appendChild(card);
  },

  /* ---------------- production over time ---------------- */
  render_dynamics(panel, data) {
    const bar = mk('div', { class: 'card src-toolbar' });
    bar.appendChild(SourcesModule.select('srcDynN', t('sources.controls.dynN'), SourcesModule.ui.dynN, [5, 6, 7, 8, 9, 10].map(v => [v, String(v)]),
      v => { SourcesModule.ui.dynN = +v; SourcesModule.rerender(); }));
    panel.appendChild(bar);
    const top = data.rows.slice(0, SourcesModule.ui.dynN);
    const dyn = SourcesModule.P().sourceDynamics(Pipeline.records(), top);
    const title = t('sources.dynamics.title');
    SourcesModule.chart(panel, 'srcDynamics', {
      title, subtitle: tp('sources.dynamics.sub', top.length), help: SourcesModule.help('dynamics', title, ['aria2017']),
      width: 900, height: 520, fileName: slug(title),
      data: () => ({
        columns: [{ key: 'year', label: t('sources.col.year') }].concat(dyn.series.map((s, i) => ({ key: 's' + i, label: s.label }))),
        rows: dyn.years.map((y, k) => Object.assign({ year: y }, ...dyn.series.map((s, i) => ({ ['s' + i]: s.values[k] })))),
      }),
      controls: Charts.linesControls(),
      defaults: { title, subtitle: '', xlab: t('sources.col.year'), ylab: t('sources.dynamics.ylab'), palette: 'scimetrics', markers: dyn.years.length <= 30, maxLabel: 55, legendPos: 'bottom' },
      render: cfg => Charts.lines(cfg, { years: dyn.years, series: dyn.series, integer: true }),
    }, ['palette', 'markers', 'maxLabel', 'legendPos', 'width', 'height']);
  },

  /* ---------------- all sources ---------------- */
  render_table(panel, data) {
    const card = mk('section', { class: 'card src-card', id: 'srcAll' });
    const title = t('sources.table.title');
    const h = mk('h2', null, esc(title));
    h.appendChild(HelpPopover.button(SourcesModule.help('table', title, ['bradford1934', 'hirsch2005', 'egghe2006', 'aria2017']), { label: t('metric.help') + ': ' + title }));
    card.appendChild(h);
    card.appendChild(mk('p', { class: 'hint' }, esc(t('sources.table.hint'))));
    const spellings = Pipeline.sourceSpellings || new Map();
    const dt = DataTable.create({
      columns: [
        { key: 'rank', label: t('sources.col.rank'), type: 'int' },
        { key: 'label', label: t('sources.col.source'), cls: 'col-wide', clamp: true },
        { key: 'variants', label: t('sources.col.variants'), cls: 'col-mid', clamp: true, get: r => (spellings.get(r.key) || []).filter(s => s !== r.label) },
        { key: 'abbrev', label: t('sources.col.abbrev'), cls: 'col-nowrap' },
        { key: 'issn', label: t('sources.col.issn'), cls: 'col-nowrap' },
        { key: 'n', label: t('sources.col.documents'), type: 'int' },
        { key: 'share', label: t('sources.col.share'), type: 'pct' },
        { key: 'cumulativeShare', label: t('sources.col.cumulativeShare'), type: 'pct' },
        { key: 'zone', label: t('sources.col.zone'), type: 'int' },
        { key: 'citations', label: t('sources.measures.citations'), type: 'int', get: r => (r.citedDocs ? r.citations : null) },
        { key: 'meanTC', label: t('sources.col.meanTC'), type: 'num', fmt: v => fmtNum(v, 2) },
        { key: 'h', label: t('sources.measures.h'), type: 'int' },
        { key: 'g', label: t('sources.measures.g'), type: 'int' },
        { key: 'm', label: t('sources.measures.m'), type: 'num', fmt: v => fmtNum(v, 3) },
        { key: 'firstYear', label: t('sources.col.firstYear'), type: 'year' },
        { key: 'lastYear', label: t('sources.col.lastYear'), type: 'year' },
      ],
      rows: data.rows, pageSize: 25, sort: { key: 'rank', dir: 'asc' }, fileName: slug(title), title,
    });
    card.appendChild(dt.el);
    panel.appendChild(card);
  },
};

Modules.define('sources', { render: body => SourcesModule.render(body) });
on('cleanchange', () => SourcesModule.rerender());
window.SourcesModule = SourcesModule;
