/* SciMetricsPro — Overview module (screens; the indicators are in js/metrics/overview.js).
   Reads the clean and filtered set (Pipeline.records()) and the reference year. */
'use strict';

const OverviewModule = {
  figs: {},          // last figure settings per chart, so colours and options survive a redraw
  cc: {},            // chart cards on screen, by id

  P() { return Parsers.lib(); },

  /* computed again only when the filtered set, the reference year or the dictionaries change
     (not when the language or the theme changes) */
  _cache: null,
  stats() {
    const records = Pipeline.records(), refYear = Pipeline.referenceYear(), dict = Pipeline.dict();
    /* distinct cited references come from the analysis shared with Documents (null while a worker computes it) */
    const refs = Pipeline.references();
    const c = OverviewModule._cache;
    if (c && c.records === records && c.refYear === refYear && c.dict === dict && c.refs === refs) return c.stats;
    const stats = OverviewModule.P().overview(records, { refYear, dict, distinctReferences: refs && !refs.cancelled ? refs.clusters.rows.length : null });
    OverviewModule._cache = { records, refYear, dict, refs, stats };
    return stats;
  },

  rerender() {
    if (state.route !== 'overview' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('overview', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  /* help from the dictionary: overview.help.<key> = { text, formula, s1, m1, s2, m2 …, interpretation } */
  help(key, title) {
    const base = 'overview.help.' + key;
    const where = [];
    for (let i = 1; I18N.has(base + '.s' + i); i++) where.push([t(base + '.s' + i), t(base + '.m' + i)]);
    return {
      title,
      text: t(base + '.text'),
      formula: I18N.has(base + '.formula') ? t(base + '.formula') : '',
      where,
      interpretation: I18N.has(base + '.interpretation') ? t(base + '.interpretation') : '',
      refs: [t('refs.aria2017')],
    };
  },

  render(body) {
    body.innerHTML = '';
    if (!state.clean) {
      body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…'));
      return;
    }
    const page = mk('div', { class: 'overview-page' });
    body.appendChild(page);
    page.appendChild(OverviewModule.toolbar());

    const { shown, total } = Pipeline.counts();
    if (!shown) {
      const empty = EmptyState.create({ icon: 'filter', title: t('overview.noDocs'), text: t('overview.noDocsText'), actions: [{ label: t('overview.reviewFilters'), icon: 'filter', primary: true, onClick: () => { CleaningModule.tab = 'filters'; App.go('cleaning'); } }] });
      page.appendChild(empty);
      return;
    }
    if (shown < total) page.appendChild(mk('p', { class: 'note-info', id: 'ovFiltered' }, icon('filter') + '<span>' + esc(tp('overview.filteredNote', shown, { total: fmtInt(total) })) + '</span>'));

    const st = OverviewModule.stats();
    OverviewModule.last = st;
    page.appendChild(OverviewModule.cards(st));
    OverviewModule.charts(page, st);
    page.appendChild(OverviewModule.typesTable(st));
  },

  toolbar() {
    const bar = mk('section', { class: 'card ov-toolbar' });
    const lab = mk('label', { class: 'sf-label', for: 'ovRefYear' }, esc(t('overview.refYear')));
    const input = mk('input', { type: 'number', id: 'ovRefYear', min: 1900, max: 2200, step: 1, value: Pipeline.referenceYear() });
    input.addEventListener('change', () => Pipeline.setReferenceYear(input.value));
    bar.appendChild(lab);
    bar.appendChild(input);
    bar.appendChild(mk('p', { class: 'sf-hint' }, esc(t('overview.refYearHint', { year: new Date().getFullYear() }))));
    return bar;
  },

  cards(st) {
    const c = 'overview.cards.';
    const years = st.period ? tp(c + 'periodSub', st.period.years) : '';
    const spec = (key, value, sub, iconName, tone) => ({ key, label: t(c + key), value, sub, icon: iconName, tone, help: OverviewModule.help(key, t(c + key)) });
    const list = [
      spec('period', st.period ? (st.period.from === st.period.to ? String(st.period.from) : st.period.from + '–' + st.period.to) : null,
        st.noYear ? tp(c + 'periodNoYear', st.noYear, { years }) : years, 'calendar', 'primary'),
      spec('documents', fmtInt(st.documents), t(c + 'documentsSub'), 'doc', 'teal'),
      spec('sources', fmtInt(st.sources), t(c + 'sourcesSub'), 'journal', 'accent'),
      spec('authors', fmtInt(st.authors), tp(c + 'authorsSub', st.authorAppearances), 'people', 'rose'),
      spec('singleAuthors', fmtInt(st.singleAuthors), tp(c + 'singleAuthorsSub', st.singleAuthoredDocs), 'person', 'neutral'),
      spec('growth', st.growthRate == null ? null : fmtNum(st.growthRate, 2) + ' %',
        st.growthRate == null ? t(c + 'growthNone') : t(c + 'growthSub', { from: st.period.from, to: st.period.to }), 'trend', 'primary'),
      spec('age', st.meanAge == null ? null : fmtNum(st.meanAge, 2), t(c + 'ageSub', { year: st.refYear }), 'clock', 'accent'),
      spec('citations', st.citations.mean == null ? null : fmtNum(st.citations.mean, 2),
        st.citations.docs ? tp(c + 'citationsSub', st.citations.docs, { citations: tp(c + 'citationsCount', st.citations.total) }) : t(c + 'citationsNone'), 'quote', 'teal'),
      spec('coauthors', st.authorsPerDoc == null ? null : fmtNum(st.authorsPerDoc, 2), t(c + 'coauthorsSub'), 'people', 'rose'),
      spec('international', st.international.share == null ? null : fmtPct(st.international.share, 2),
        tp(c + 'internationalSub', st.international.docs, { m: fmtInt(st.international.withCountry) }), 'globe', 'primary'),
      spec('authorKeywords', fmtInt(st.authorKeywords), t(c + 'authorKeywordsSub'), 'tag', 'accent'),
      spec('indexKeywords', fmtInt(st.indexKeywords), t(c + 'indexKeywordsSub'), 'tag', 'teal'),
      spec('references', fmtInt(st.references.total), tp(c + 'referencesSub', st.references.docs, { distinct: tp(c + 'referencesDistinct', st.references.distinct) }), 'sigma', 'rose'),
    ];
    const section = mk('section', { class: 'ov-section' });
    section.appendChild(mk('h2', { class: 'ov-h2' }, esc(t('overview.cardsTitle'))));
    const grid = MetricCard.grid(section, list);
    grid.id = 'ovCards';
    [...grid.children].forEach((card, i) => { card.dataset.key = list[i].key; });
    return section;
  },

  /* a figure whose colours and options are kept when the page is drawn again */
  chart(host, id, o) {
    const prev = OverviewModule.figs[id];
    const keep = ['barColor', 'lineColor', 'showLine', 'showValues', 'legendPos', 'width', 'height'];
    const defaults = Object.assign({}, o.defaults);
    if (prev) keep.forEach(k => { if (prev[k] !== undefined) defaults[k] = prev[k]; });
    const cc = ChartCard.mount(host, Object.assign({}, o, { id, defaults }));
    if (cc.fig) OverviewModule.figs[id] = cc.fig.cfg;
    OverviewModule.cc[id] = cc;
    return cc;
  },

  charts(page, st) {
    const years = st.annual.map(a => a.year);
    const pal = i => Fig.color('scimetrics', i);

    const prod = t('overview.production.title');
    const prodLine = { values: st.annual.map(a => a.cumulative), label: t('overview.production.line'), axis: 'right', integer: true };
    OverviewModule.chart(page, 'ovProduction', {
      title: prod, subtitle: t('overview.production.sub'), help: OverviewModule.help('production', prod),
      width: 900, height: 460, fileName: slug(prod),
      data: () => ({
        columns: [{ key: 'year', label: t('overview.col.year') }, { key: 'n', label: t('overview.col.documents') }, { key: 'cumulative', label: t('overview.col.cumulative') }],
        rows: st.annual,
      }),
      controls: Charts.yearsControls({ line: prodLine }),
      defaults: {
        title: prod, subtitle: '', xlab: t('overview.production.xlab'), ylab: t('overview.production.ylab'), y2lab: t('overview.production.y2lab'),
        barColor: pal(0), lineColor: pal(1), showLine: true, showValues: false, legendPos: 'bottom',
      },
      render: cfg => Charts.years(cfg, { years, bars: { values: st.annual.map(a => a.n), label: t('overview.production.bars'), integer: true }, line: prodLine }),
    });

    const cit = t('overview.citations.title');
    const citLine = { values: st.annual.map(a => a.meanTCperYear), label: t('overview.citations.line'), axis: 'right' };
    OverviewModule.chart(page, 'ovCitations', {
      title: cit, subtitle: t('overview.citations.sub', { year: st.refYear }), help: OverviewModule.help('citationsYear', cit),
      width: 900, height: 460, fileName: slug(cit),
      data: () => ({
        columns: [
          { key: 'year', label: t('overview.col.year') }, { key: 'n', label: t('overview.col.documents') },
          { key: 'citedDocs', label: t('overview.col.citedDocs') }, { key: 'citations', label: t('overview.col.citations') },
          { key: 'meanTC', label: t('overview.col.meanTC') }, { key: 'citableYears', label: t('overview.col.citableYears') },
          { key: 'meanTCperYear', label: t('overview.col.meanTCperYear') },
        ],
        rows: st.citations.docs ? st.annual : [],
      }),
      controls: Charts.yearsControls({ line: citLine }),
      defaults: {
        title: cit, subtitle: '', xlab: t('overview.citations.xlab'), ylab: t('overview.citations.ylab'), y2lab: t('overview.citations.y2lab'),
        barColor: pal(2), lineColor: pal(3), showLine: true, showValues: false, legendPos: 'bottom',
      },
      render: cfg => Charts.years(cfg, { years, bars: { values: st.annual.map(a => a.meanTC), label: t('overview.citations.bars') }, line: citLine }),
    });
  },

  typesTable(st) {
    const card = mk('section', { class: 'card ov-types', id: 'ovTypes' });
    const title = t('overview.types.title');
    const h = mk('h2', null, esc(title));
    h.appendChild(HelpPopover.button(OverviewModule.help('types', title), { label: t('metric.help') + ': ' + title }));
    card.appendChild(h);
    const dt = DataTable.create({
      columns: [
        { key: 'type', label: t('overview.types.type'), get: r => CleaningModule.docTypeLabel(r.type) },
        { key: 'n', label: t('overview.types.documents'), type: 'int' },
        { key: 'share', label: t('overview.types.share'), type: 'pct' },
        { key: 'meanTC', label: t('overview.types.meanTC'), type: 'num', fmt: v => fmtNum(v, 2) },
        { key: 'raw', label: t('overview.types.raw'), cls: 'col-wide', clamp: true },
      ],
      rows: st.docTypes, pageSize: 25, search: false, sort: { key: 'n', dir: 'desc' }, fileName: slug(title), title,
    });
    card.appendChild(dt.el);
    return card;
  },
};

Modules.define('overview', { render: body => OverviewModule.render(body) });
on('cleanchange', () => OverviewModule.rerender());
on('refsready', () => OverviewModule.rerender());
window.OverviewModule = OverviewModule;
