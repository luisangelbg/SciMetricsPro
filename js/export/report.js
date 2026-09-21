/* SciMetricsPro — automatic report: cover, a methods section written from the real data (files, searches, duplicates,
   cleaning, filters, the parameters of every analysis), the chosen figures and tables numbered with their captions, one
   short paragraph per figure filled with its key numbers (templates with variables, no interpretation), the references of
   the methods and the suggested citation of the app. The report is written in the chosen language (Spanish or English)
   whatever the language of the interface: the modules are drawn out of sight in that language (ExportCollector) and
   every text is taken with I18N.withLang. Numbers that a noun follows use plural forms (report.n.*).
   Report.build(options, progress) → model · Report.html(model) → preview · Report.standalone(model) → printable page ·
   Report.docx(model, progress) → Blob (.docx) */
'use strict';

const Report = {
  SECTIONS: ['overview', 'sources', 'authors', 'documents', 'conceptual', 'intellectual', 'social', 'prisma'],
  /* figures (f) and tables (t) of each section, by the id of their card; the first one present of a|b|c is used */
  PLAN: {
    overview: ['t:main', 'f:ovProduction', 'f:ovCitations', 't:ovTypes'],
    sources: ['f:srcTop', 'f:srcBradford', 't:srcZones'],
    authors: ['f:auTop', 'f:auLotka', 't:auLotkaTable', 'f:auScp', 'f:auMap', 't:auCountryTable'],
    documents: ['f:dcTop', 't:dcCitedTable', 'f:dcLocal', 'f:dcRpys', 't:dcPeaks', 'f:dcWordBars|dcCloud|dcTreemap'],
    conceptual: ['f:cnFigure', 't:cnCommunities', 'f:tmMap', 't:tmThemes', 'f:evSankey|evMaps', 'f:faMap'],
    intellectual: ['f:ccFigure', 'f:cpFigure', 'f:cmMap', 't:cmClusters', 'f:hgFigure'],
    social: ['f:snFigure', 'f:swMap', 't:swPairs', 'f:stTimeline', 'f:stShare'],
    prisma: ['f:prFlow'],
  },
  DEFAULTS: { title: '', author: '', lang: '', page: 'letter', rows: 10, grayscale: false, sections: null },
  FIGURE_CM: 16,
  MAX_HEIGHT_CM: 19,
  TEXT_PT: 9,
  DPI: 300,
  YEAR: 2026,

  options() {
    const o = Object.assign({}, Report.DEFAULTS, Prefs.get('reportOptions', {}));
    if (!Array.isArray(o.sections)) o.sections = Report.SECTIONS.slice();
    o.sections = Report.SECTIONS.filter(s => o.sections.includes(s));
    if (!I18N.available.includes(o.lang)) o.lang = I18N.lang;
    if (!DocxWriter.PAGES[o.page]) o.page = 'letter';
    o.rows = Math.min(50, Math.max(3, Math.round(+o.rows) || 10));
    return o;
  },
  setOptions(patch) { Prefs.set('reportOptions', Object.assign({}, Prefs.get('reportOptions', {}), patch)); },

  /* name, search string and date of each data source; the name is the one of the PRISMA diagram */
  sourceInfo(f) {
    const saved = (Prefs.get('reportSources', {}) || {})[f.name] || {};
    const s = f.search;
    return {
      label: Pipeline.prisma().sourceLabels[f.name] || '',
      query: saved.query != null ? saved.query : (s && s.query ? s.query.terms || '' : ''),
      date: saved.date != null ? saved.date : (s && s.date ? String(s.date).slice(0, 10) : ''),
    };
  },
  setSourceInfo(f, patch) {
    if ('label' in patch) {
      const pr = Pipeline.prisma();
      if (patch.label) pr.sourceLabels[f.name] = patch.label; else delete pr.sourceLabels[f.name];
      Pipeline.savePrisma();
    }
    const all = Object.assign({}, Prefs.get('reportSources', {}));
    const cur = Object.assign({}, all[f.name]);
    ['query', 'date'].forEach(k => { if (k in patch) cur[k] = patch[k]; });
    all[f.name] = cur;
    Prefs.set('reportSources', all);
  },

  /* ---------- text helpers (they use the active language: call them inside I18N.withLang) ---------- */
  n(key, value) { return tp('report.n.' + key, value); },
  join(list) {
    list = list.filter(x => x != null && x !== '');
    if (list.length <= 1) return list[0] || '';
    return list.slice(0, -1).join(', ') + ' ' + t('report.and') + ' ' + list[list.length - 1];
  },
  dateText(iso) {
    if (!iso) return '';
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso);
    return isNaN(d) ? String(iso) : d.toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' });
  },
  range(a, b) { return a === b ? String(a) : a + '–' + b; },
  period(p) { return p ? Report.range(p.from, p.to) : t('report.noPeriod'); },
  num(v, d) { return fmtNum(v, d == null ? 2 : d); },
  text(key, vars) { return t('report.text.' + key, vars); },
  cite(key) { return t('report.cite.' + key); },
  topList(rows, label, value, n) { return Report.join(rows.slice(0, n || 3).map(r => label(r) + ' (' + value(r) + ')')); },
  weights(normalization) {
    const ref = Report.NORMALIZATION_REFS[normalization];
    return t('report.weights.' + normalization) + (ref ? ' (' + Report.cite(ref) + ')' : '');
  },
  algorithm(p) { return t('report.algorithms.' + (p.algorithm === 'fastgreedy' ? 'fastgreedy' : 'louvain')) + ' (' + Report.cite(p.algorithm === 'fastgreedy' ? 'clauset2004' : 'blondel2008') + ')'; },
  networkRefs(p) {
    const refs = [p.algorithm === 'fastgreedy' ? 'clauset2004' : 'blondel2008'];
    if (Report.NORMALIZATION_REFS[p.normalization]) refs.push(Report.NORMALIZATION_REFS[p.normalization]);
    if (p.layout === 'fa2') refs.push('jacomy2014');
    return refs;
  },
  layout(p) { return p.layout === 'fa2' ? t('report.layouts.fa2') + ' (' + Report.cite('jacomy2014') + ')' : t('report.layouts.circular'); },
  NORMALIZATION_REFS: { association: 'vaneck2009', salton: 'salton1983', jaccard: 'jaccard1901', inclusion: 'callon1991', equivalence: 'callon1991' },

  /* ---------- methods ---------- */
  sourceLine(f) {
    const info = Report.sourceInfo(f);
    const kind = I18N.has('report.bases.' + f.source) ? t('report.bases.' + f.source) : t('report.bases.file');
    const parts = [Report.n('records', f.count), t('report.methods.file', { file: f.name })];
    if (f.search) parts.push(t('report.methods.api', { downloaded: fmtInt(f.search.downloaded != null ? f.search.downloaded : f.count), count: fmtInt(f.search.count || f.count) }));
    if (info.query) parts.push(t('report.methods.query', { query: info.query }));
    if (info.date) parts.push(t('report.methods.date', { date: Report.dateText(info.date) }));
    return (info.label ? info.label + ' (' + kind + '; ' : kind + ' (') + parts.join('; ') + ')';
  },

  filtersText(f) {
    const P = Parsers.lib();
    if (!P.filtersActive(f)) return '';
    const parts = [];
    if (f.yearFrom !== '' && f.yearTo !== '') parts.push(t('report.filters.years', { from: f.yearFrom, to: f.yearTo }));
    else if (f.yearFrom !== '') parts.push(t('report.filters.from', { from: f.yearFrom }));
    else if (f.yearTo !== '') parts.push(t('report.filters.to', { to: f.yearTo }));
    if (f.docTypes.length) parts.push(t('report.filters.types', { list: Report.join(f.docTypes.map(c => CleaningModule.docTypeLabel(c).toLowerCase())) }));
    if (f.languages.length) parts.push(t('report.filters.languages', { list: Report.join(f.languages.map(c => CleaningModule.languageLabel(c).toLowerCase())) }));
    if (f.sources.length) parts.push(tp('report.filters.sources', f.sources.length));
    if (f.areas.length) parts.push(t('report.filters.areas', { list: Report.join(f.areas) }));
    if (f.minCitations !== '') parts.push(t('report.filters.citations', { n: fmtInt(+f.minCitations) }));
    return Report.join(parts);
  },

  methods(ctx) {
    const s = Pipeline.init(), stats = Pipeline.stats || {}, ov = ctx.overview;
    const out = { data: [], analysis: [] };
    const add = (list, text, refs) => { (refs || []).forEach(r => ctx.refs.add(r)); list.push(text); };
    const files = state.files.filter(f => f.count);
    const field = t('cleaning.termFields.' + s.termField).toLowerCase();
    add(out.data, tp('report.methods.sources', files.length, { list: Report.join(files.map(Report.sourceLine)) }));
    const threshold = fmtNum(s.threshold, 2);
    add(out.data, stats.duplicatesRemoved
      ? t('report.methods.duplicates', { identified: Report.n('records', stats.identified), threshold, groups: fmtInt(stats.mergedGroups), removed: fmtInt(stats.duplicatesRemoved), unique: Report.n('documents', stats.unique) })
      : t('report.methods.noDuplicates', { identified: Report.n('records', stats.identified), threshold, unique: Report.n('documents', stats.unique) }));
    const norm = [t('report.methods.authors')];
    const merges = Object.keys(s.authorMerges || {}).filter(k => s.authorMerges[k] && s.authorMerges[k] !== k).length;
    if (merges) norm.push(tp('report.methods.authorMerges', merges));
    norm.push(t('report.methods.institutions'));
    const aliases = (s.institutionAliases || []).length, countryAliases = (s.countryAliases || []).length;
    if (aliases || countryAliases) norm.push(t('report.methods.aliases', { institutions: fmtInt(aliases), countries: fmtInt(countryAliases) }));
    norm.push(t('report.methods.terms', { field, synonyms: fmtInt((s.synonyms || []).length), stopwords: fmtInt((s.stopwords.es || []).length + (s.stopwords.en || []).length) }));
    add(out.data, norm.join(' '));
    const filters = Report.filtersText(s.filters);
    add(out.data, filters ? t('report.methods.filters', { list: filters, documents: Report.n('documents', stats.screening) }) : t('report.methods.noFilters'));
    if (Pipeline.onlyIncluded()) add(out.data, t('report.methods.onlyIncluded', { documents: Report.n('documents', stats.shown) }), ['page2021']);
    if (ov) {
      const types = ov.docTypes.slice().sort((a, b) => b.n - a.n).map(d => CleaningModule.docTypeLabel(d.type).toLowerCase() + ' (' + fmtInt(d.n) + ')');
      add(out.data, t('report.methods.final', { documents: Report.n('documents', ov.documents), period: Report.period(ov.period), sources: Report.n('sources', ov.sources), types: Report.join(types), refYear: ov.refYear }));
    }

    /* analyses of the chosen sections */
    add(out.analysis, t('report.methods.software', { version: APP.version, year: Report.YEAR }), ['software']);
    const has = id => !!ctx.byId[id];
    const sec = ctx.sections;
    if (sec.includes('overview')) add(out.analysis, t('report.methods.overview'), ['aria2017']);
    if (sec.includes('sources') && (has('srcTop') || has('srcBradford'))) add(out.analysis, t('report.methods.sourcesAnalysis'), ['bradford1934', 'hirsch2005', 'egghe2006']);
    if (sec.includes('authors') && (has('auTop') || has('auLotka'))) {
      const L = AuthorsModule._cache && AuthorsModule._cache.data.lotka;
      add(out.analysis, t('report.methods.authorsAnalysis', { fitMax: L ? L.fitMax : '—' }), ['lotka1926', 'pao1985']);
    }
    if (sec.includes('documents') && (has('dcTop') || has('dcLocal') || has('dcRpys'))) add(out.analysis, t('report.methods.documentsAnalysis', { field }), ['garfield2003', 'marx2014']);
    if (sec.includes('conceptual')) {
      const p = ConceptualModule.params || NetworkPanel.DEFAULTS;
      if (has('cnFigure')) add(out.analysis, t('report.methods.cooccurrence', { field, maxNodes: fmtInt(p.maxNodes), minFreq: fmtInt(p.minFreq), minEdge: fmtInt(p.minEdge), weights: Report.weights(p.normalization), algorithm: Report.algorithm(p), resolution: fmtNum(p.resolution, 2), layout: Report.layout(p) }), Report.networkRefs(p));
      if (has('tmMap')) { const q = ConceptualModule.tm || {}; add(out.analysis, t('report.methods.thematic', { maxNodes: fmtInt(q.maxNodes), minFreq: fmtInt(q.minFreq), minWords: fmtInt(q.minClusterWords) }), ['callon1991', 'cobo2011']); }
      const ev = ConceptualModule._ev && ConceptualModule._ev.value;
      if ((has('evSankey') || has('evMaps')) && ev) add(out.analysis, t('report.methods.evolution', { periods: Report.join(ev.ev.periods.map(pr => Report.range(pr.from, pr.to))) }), ['cobo2011']);
      const fa = ConceptualModule._fa && ConceptualModule._fa.value;
      if (has('faMap') && fa && fa.f) {
        const mca = fa.f.method === 'mca';
        add(out.analysis, t('report.methods.factorial', { method: t('report.factorial.' + fa.f.method), words: fmtInt(fa.f.inc.items.length), k: fmtInt(fa.f.k) }) + (mca ? ' ' + t('report.methods.benzecri') : ''),
          mca ? ['greenacre2007', 'benzecri1979', 'lloyd1982', 'hartigan1979', 'rousseeuw1987'] : ['greenacre2007', 'lloyd1982', 'hartigan1979', 'rousseeuw1987']);
      }
    }
    if (sec.includes('intellectual')) {
      const co = IntellectualModule.co.params, cp = IntellectualModule.cp.params;
      if (has('ccFigure')) add(out.analysis, t('report.methods.cocitation', { unit: IntellectualModule.unitName('cited', co.unit).toLowerCase(), maxNodes: fmtInt(co.maxNodes), minFreq: fmtInt(co.minFreq), weights: Report.weights(co.normalization), algorithm: Report.algorithm(co) }), ['small1973'].concat(Report.networkRefs(co)));
      if (has('cpFigure')) add(out.analysis, t('report.methods.coupling', { unit: IntellectualModule.unitName('coupling', cp.unit).toLowerCase(), maxNodes: fmtInt(cp.maxNodes), weights: Report.weights(cp.normalization), algorithm: Report.algorithm(cp) }), ['kessler1963'].concat(Report.networkRefs(cp)));
      if (has('cmMap')) add(out.analysis, t('report.methods.couplingMap', { unit: IntellectualModule.unitName('coupling', IntellectualModule.cm.unit).toLowerCase(), impact: t('report.impact.' + (IntellectualModule.cm.impact === 'local' ? 'local' : 'global')) }), ['aria2020', 'callon1991', 'salton1983']);
      if (has('hgFigure')) add(out.analysis, t('report.methods.historiograph', { maxNodes: fmtInt(IntellectualModule.hg.maxNodes), minLocal: fmtInt(IntellectualModule.hg.minLocal) }), ['garfield2004']);
    }
    if (sec.includes('social')) {
      const p = SocialModule.net.params;
      if (has('snFigure')) add(out.analysis, t('report.methods.collaboration', { unit: SocialModule.unitName('plural', p.unit).toLowerCase(), maxNodes: fmtInt(p.maxNodes), minFreq: fmtInt(p.minFreq), weights: Report.weights(p.normalization), algorithm: Report.algorithm(p) }), ['newman2001'].concat(Report.networkRefs(p)));
      if (has('swMap') || has('stTimeline')) add(out.analysis, t('report.methods.countries'), ['glanzel2004', 'katz1997']);
    }
    if (sec.includes('prisma') && has('prFlow')) add(out.analysis, t('report.methods.prisma'), ['page2021']);
    return out;
  },

  /* ---------- one paragraph per figure: { text, refs } or null ---------- */
  network(store, key, nodesId, unit, by, ctx) {
    const net = store && store._net && store._net.data, comm = store && store._comm && store._comm.result;
    if (!net || !comm || !net.metrics) return null;
    const st = net.metrics.stats, p = store.params || {};
    const table = ctx.byId[nodesId];
    const rows = table ? table.rows().slice() : [];
    const top = rows.sort((a, b) => (b[by] || 0) - (a[by] || 0))[0];
    return {
      text: Report.text(key, {
        unit, nodes: Report.n(key === 'cnFigure' ? 'terms' : 'nodes', st.nodes), edges: Report.n('links', st.edges), density: fmtNum(st.density, 3),
        algorithm: t('report.algorithms.' + (p.algorithm === 'fastgreedy' ? 'fastgreedy' : 'louvain')), communities: Report.n('communities', comm.communities), modularity: fmtNum(comm.q1, 3),
        size: Report.n(key === 'cnFigure' ? 'terms' : 'nodes', comm.sizes[0] || 0), largest: comm.names[0] || '',
        top: top ? top.label : '—', value: top ? fmtInt(top[by]) : '—',
      }),
      refs: [p.algorithm === 'fastgreedy' ? 'clauset2004' : 'blondel2008'],
    };
  },

  FACTS: {
    main(ctx) {
      const S = ctx.overview;
      if (!S) return null;
      return { text: Report.text(S.citations.docs ? 'main' : 'mainNoCitations', { documents: Report.n('documents', S.documents), period: Report.period(S.period), sources: Report.n('sources', S.sources), authors: Report.n('authors', S.authors), perDoc: Report.num(S.authorsPerDoc), growth: Report.num(S.growthRate) + ' %', citations: Report.num(S.citations.mean) }), refs: ['aria2017'] };
    },
    ovProduction(ctx) {
      const rows = ctx.overview && ctx.overview.annual;
      if (!rows || rows.length < 2) return null;
      const peak = rows.reduce((a, b) => (b.n > a.n ? b : a));
      const last = rows[rows.length - 1];
      return { text: Report.text('ovProduction', { first: Report.n('documents', rows[0].n), from: rows[0].year, last: Report.n('documents', last.n), to: last.year, peakYear: peak.year, peakN: Report.n('documents', peak.n) }), refs: [] };
    },
    ovCitations(ctx) {
      const rows = (ctx.overview && ctx.overview.annual || []).filter(r => r.citedDocs > 0);
      if (!rows.length) return null;
      const peak = rows.reduce((a, b) => (b.meanTC > a.meanTC ? b : a));
      return { text: Report.text('ovCitations', { year: peak.year, mean: Report.num(peak.meanTC), perYear: Report.num(peak.meanTCperYear) }), refs: [] };
    },
    ovTypes(ctx) {
      const types = ctx.overview && ctx.overview.docTypes.slice().sort((a, b) => b.n - a.n);
      if (!types || !types.length) return null;
      return { text: Report.text('ovTypes', { types: Report.topList(types, d => CleaningModule.docTypeLabel(d.type).toLowerCase(), d => fmtInt(d.n) + '; ' + fmtPct(d.share)) }), refs: [] };
    },
    srcTop() {
      const D = SourcesModule._cache && SourcesModule._cache.data;
      if (!D || !D.rows.length) return null;
      const [a, b] = D.rows;
      /* the share counts the documents with a source: say so when some have none */
      return { text: Report.text(b ? (D.withoutSource ? 'srcTopWithSource' : 'srcTop') : 'srcTopOne', { source: a.label, n: Report.n('documents', a.n), share: fmtPct(a.share), second: b ? b.label : '', n2: b ? Report.n('documents', b.n) : '' }), refs: [] };
    },
    srcBradford() {
      const D = SourcesModule._cache && SourcesModule._cache.data;
      const z = D && D.bradford && D.bradford.zones;
      if (!z || z.length < 3) return null;
      const docs = i => Report.n('documents', z[i].documents), srcs = i => Report.n('sources', z[i].sources);
      return { text: Report.text('srcBradford', { z1d: docs(0), z1p: fmtPct(z[0].shareDocuments), z1s: srcs(0), z2d: docs(1), z2s: srcs(1), z3d: docs(2), z3s: srcs(2) }), refs: ['bradford1934'] };
    },
    auTop() {
      const A = AuthorsModule._cache && AuthorsModule._cache.data;
      if (!A || !A.authors.rows.length) return null;
      const rows = A.authors.rows.slice().sort((x, y) => y.n - x.n || x.rank - y.rank);
      const [a, b] = rows;
      return { text: Report.text(b ? 'auTop' : 'auTopOne', { authors: Report.n('authors', rows.length), author: a.label, n: Report.n('documents', a.n), fractional: Report.num(a.fractional), second: b ? b.label : '', n2: b ? Report.n('documents', b.n) : '' }), refs: [] };
    },
    auLotka() {
      const L = AuthorsModule._cache && AuthorsModule._cache.data.lotka;
      if (!L || !L.ks || !isFinite(L.beta)) return null;
      const fits = L.ks.D <= L.ks.critical05;
      return { text: Report.text('auLotka', { beta: Report.num(L.beta), C: Report.num(L.C, 3), r2: Report.num(L.r2, 3), D: Report.num(L.ks.D, 3), critical: Report.num(L.ks.critical05, 3), verdict: t('report.text.lotka' + (fits ? 'Fits' : 'Rejects')) }), refs: ['lotka1926', 'pao1985'] };
    },
    auScp() {
      const C = AuthorsModule._cache && AuthorsModule._cache.data.countries;
      const rows = C && C.corresponding.slice().sort((a, b) => b.documents - a.documents);
      if (!rows || !rows.length) return null;
      const a = rows[0];
      return { text: Report.text(rows.length > 1 ? 'auScp' : 'auScpOne', { country: CleaningModule.countryLabel(a.code), n: Report.n('documents', a.documents), share: fmtPct(a.mcpRatio), countries: Report.n('countries', rows.length) }), refs: [] };
    },
    auMap() {
      const C = AuthorsModule._cache && AuthorsModule._cache.data.countries;
      const rows = C && C.authors.slice().sort((a, b) => b.appearances - a.appearances);
      if (!rows || !rows.length) return null;
      return { text: Report.text(rows.length > 1 ? 'auMap' : 'auMapOne', { countries: Report.n('countries', rows.length), top: Report.topList(rows, r => CleaningModule.countryLabel(r.code), r => fmtInt(r.appearances)) }), refs: [] };
    },
    dcTop() {
      const D = DocumentsModule._cache && DocumentsModule._cache.data;
      const rows = D && D.cited && D.cited.rows.slice().sort((a, b) => b.citations - a.citations);
      if (!rows || !rows.length || !D.cited.withCitations) return null;
      return { text: Report.text('dcTop', { label: rows[0].label, citations: Report.n('citations', rows[0].citations), perYear: Report.num(rows[0].perYear) }), refs: [] };
    },
    dcLocal() {
      const D = DocumentsModule._cache && DocumentsModule._cache.data;
      const rows = D && D.localRows && D.localRows.filter(r => r.local > 0).sort((a, b) => b.local - a.local);
      if (!rows || !rows.length) return null;
      return { text: Report.text('dcLocal', { links: Report.n('localLinks', D.lc.stats.links), cited: Report.n('documents', rows.length), label: rows[0].label, local: fmtInt(rows[0].local), global: fmtInt(rows[0].global) }), refs: ['garfield2003'] };
    },
    dcRpys() {
      const D = DocumentsModule._cache && DocumentsModule._cache.data;
      const R = D && D.rpysAll;
      if (!R || !R.peaks || !R.peaks.length) return null;
      const peaks = R.peaks.slice().sort((a, b) => b.deviation - a.deviation).slice(0, 3);
      return { text: Report.text('dcRpys', { references: Report.n('datedReferences', R.withYear), period: Report.range(R.minYear, R.maxYear), peaks: Report.topList(peaks, p => String(p.year), p => fmtInt(p.n)) }), refs: ['marx2014'] };
    },
    words() {
      const T = Pipeline.termLists();
      if (!T || !T.counts.length) return null;
      return { text: Report.text('words', { distinct: Report.n('distinctTerms', T.counts.length), field: t('cleaning.termFields.' + T.field).toLowerCase(), terms: Report.topList(T.counts, c => c.term, c => fmtInt(c.docs), 5) }), refs: [] };
    },
    cnFigure(ctx) { return Report.network(ConceptualModule, 'cnFigure', 'cnNodes', '', 'freq', ctx); },
    tmMap() {
      const V = ConceptualModule._tm && ConceptualModule._tm.value;
      if (!V || !V.map || !V.map.clusters.length) return null;
      const by = q => Report.join(V.map.clusters.filter(c => c.quadrant === q).map(c => '«' + ConceptualModule.themeLabel(V.terms, c) + '»')) || t('report.none');
      return { text: Report.text('tmMap', { themes: Report.n('themes', V.map.clusters.length), motor: by('motor'), niche: by('niche'), emerging: by('emerging'), basic: by('basic') }), refs: ['callon1991', 'cobo2011'] };
    },
    evolution() {
      const V = ConceptualModule._ev && ConceptualModule._ev.value;
      if (!V || !V.ev || !V.ev.periods.length) return null;
      return { text: Report.text('evolution', { periods: Report.n('periods', V.ev.periods.length), ranges: Report.join(V.ev.periods.map(p => Report.range(p.from, p.to) + ' (' + Report.n('themes', p.map.clusters.length) + ')')), links: Report.n('links', V.ev.links.length) }), refs: ['cobo2011'] };
    },
    faMap() {
      const V = ConceptualModule._fa && ConceptualModule._fa.value;
      const F = V && V.f;
      if (!F || !F.res) return null;
      const pct = F.method === 'mca' && F.res.pctAdjusted ? F.res.pctAdjusted : F.res.pct;
      return { text: Report.text('faMap', { method: t('report.factorial.' + F.method), words: Report.n('words', F.inc.items.length), docs: Report.n('documents', F.docs), d1: fmtPct(pct[0]), d2: fmtPct(pct[1] || 0), k: Report.n('groups', F.k), silhouette: Report.num(F.silhouette ? F.silhouette.mean : null, 3) }), refs: F.method === 'mca' ? ['benzecri1979', 'rousseeuw1987'] : ['greenacre2007', 'rousseeuw1987'] };
    },
    ccFigure(ctx) { const p = IntellectualModule.co.params; return Report.network(IntellectualModule.co, 'ccFigure', 'ccNodes', IntellectualModule.unitName('cited', p.unit).toLowerCase(), 'freq', ctx); },
    cpFigure(ctx) { const p = IntellectualModule.cp.params; return Report.network(IntellectualModule.cp, 'cpFigure', 'cpNodes', IntellectualModule.unitName('coupling', p.unit).toLowerCase(), 'citations', ctx); },
    cmMap() {
      const V = IntellectualModule._cm && IntellectualModule._cm.value;
      if (!V || !V.map || !V.map.clusters.length) return null;
      const largest = V.map.clusters.slice().sort((a, b) => b.size - a.size)[0];
      return { text: Report.text('cmMap', { unit: IntellectualModule.unitName('coupling', IntellectualModule.cm.unit).toLowerCase(), units: Report.n('units', V.map.nodes.length), clusters: Report.n('groups', V.map.clusters.length), size: Report.n('units', largest.size), largest: IntellectualModule.clusterLabel(V, largest) }), refs: ['aria2020'] };
    },
    hgFigure() {
      const V = IntellectualModule._hg && IntellectualModule._hg.value;
      const D = DocumentsModule._cache && DocumentsModule._cache.data;
      if (!V || !V.nodes.length || !D) return null;
      const top = V.nodes.slice().sort((a, b) => b.local - a.local)[0];
      const years = V.nodes.map(n => n.year);
      return { text: Report.text('hgFigure', { docs: Report.n('documents', V.nodes.length), period: Report.range(Math.min(...years), Math.max(...years)), links: Report.n('directLinks', V.links.filter(l => l.status === 'kept').length), top: Parsers.lib().documentLabel(D.records[top.index]), local: fmtInt(top.local) }), refs: ['garfield2004'] };
    },
    snFigure(ctx) { const p = SocialModule.net.params; return Report.network(SocialModule.net, 'snFigure', 'snNodes', SocialModule.unitName('plural', p.unit).toLowerCase(), 'freq', ctx); },
    swMap() {
      const V = SocialModule._collab && SocialModule._collab.value;
      if (!V || !V.countries.length) return null;
      const pair = V.pairs.slice().sort((a, b) => b.documents - a.documents)[0];
      const vars = { countries: Report.n('countries', V.countries.length), international: Report.n('documents', V.international), share: fmtPct(V.documents ? V.international / V.documents : 0) };
      if (!pair) return { text: Report.text('swMapNoPairs', vars), refs: ['glanzel2004'] };
      return { text: Report.text('swMap', Object.assign(vars, { a: CleaningModule.countryLabel(pair.a), b: CleaningModule.countryLabel(pair.b), n: fmtInt(pair.documents) })), refs: ['glanzel2004'] };
    },
    stTimeline() {
      const V = SocialModule._timeline && SocialModule._timeline.value;
      if (!V) return null;
      const T = V.totals;
      return { text: Report.text('stTimeline', { authors: Report.num(T.authors), countries: Report.num(T.countries), institutions: Report.num(T.institutions) }), refs: [] };
    },
    stShare() {
      const V = SocialModule._timeline && SocialModule._timeline.value;
      const rows = V && V.rows.filter(r => r.withCountry > 0 && r.international != null);
      if (!rows || !rows.length) return null;
      const peak = rows.reduce((a, b) => (b.international > a.international ? b : a));
      return { text: Report.text('stShare', { share: fmtPct(V.totals.international), peak: fmtPct(peak.international), year: peak.year }), refs: ['katz1997'] };
    },
    prFlow() {
      const F = PrismaModule.flow();
      return { text: Report.text(F.pending ? 'prFlowPending' : 'prFlow', { identified: fmtInt(F.identified), removed: fmtInt(F.removed), screened: fmtInt(F.screened), excluded: fmtInt(F.excluded), assessed: fmtInt(F.assessed), reportsExcluded: fmtInt(F.reportsExcludedTotal), included: fmtInt(F.included), pending: fmtInt(F.pending) }), refs: ['page2021'] };
    },
  },
  FACT_OF: { dcWordBars: 'words', dcCloud: 'words', dcTreemap: 'words', evSankey: 'evolution', evMaps: 'evolution' },

  /* ---------- the model ---------- */
  async build(opts, progress) {
    opts = Object.assign(Report.options(), opts || {});
    const items = await ExportCollector.collect(progress || null, { lang: opts.lang });
    const byId = {};
    items.forEach(it => { if (it.id && !byId[it.id]) byId[it.id] = it; });
    const model = I18N.withLang(opts.lang, () => Report.compose(opts, byId));
    model.records = Pipeline.records();
    return model;
  },

  compose(opts, byId) {
    const ctx = { byId, sections: opts.sections, refs: new Set(), overview: OverviewModule._cache ? OverviewModule._cache.stats : null };
    const blocks = [];
    const counters = { figure: 0, table: 0 };
    const title = opts.title || t('report.defaults.title');
    const ov = ctx.overview;
    blocks.push({ type: 'title', text: title });
    if (ov) blocks.push({ type: 'subtitle', text: t('report.cover.subtitle', { documents: Report.n('documents', ov.documents), period: Report.period(ov.period) }) });
    if (opts.author) blocks.push({ type: 'cover', text: opts.author });
    blocks.push({ type: 'cover', text: Report.dateText(new Date().toISOString().slice(0, 10)) });
    blocks.push({ type: 'cover', text: t('report.cover.generated', { version: APP.version }) });
    blocks.push({ type: 'pagebreak' });

    const m = Report.methods(ctx);
    blocks.push({ type: 'heading', level: 1, text: t('report.headings.methods') });
    blocks.push({ type: 'heading', level: 2, text: t('report.headings.data') });
    m.data.forEach(text => blocks.push({ type: 'paragraph', text }));
    blocks.push({ type: 'heading', level: 2, text: t('report.headings.analysis') });
    m.analysis.forEach(text => blocks.push({ type: 'paragraph', text }));

    blocks.push({ type: 'heading', level: 1, text: t('report.headings.results') });
    const used = new Set();
    for (const section of opts.sections) {
      const entries = [];
      for (const spec of Report.PLAN[section]) {
        const kind = spec[0], ids = spec.slice(2).split('|');
        if (ids[0] === 'main') { if (ov) entries.push({ kind: 'main', id: 'main' }); continue; }
        const id = ids.find(x => byId[x] && byId[x].kind === (kind === 'f' ? 'figure' : 'table'));
        if (id) entries.push({ kind: kind === 'f' ? 'figure' : 'table', id, item: byId[id] });
      }
      if (!entries.length) continue;
      blocks.push({ type: 'heading', level: 2, text: t('report.sections.' + section) });
      for (const e of entries) {
        const factKey = Report.FACT_OF[e.id] || e.id;
        let fact = null;
        if (!used.has(factKey) && Report.FACTS[factKey]) {
          used.add(factKey);
          try { fact = Report.FACTS[factKey](ctx); } catch (err) { fact = null; }
        }
        const isFigure = e.kind === 'figure';
        const label = isFigure ? t('report.figure') : t('report.table');
        const number = ++counters[isFigure ? 'figure' : 'table'];
        if (fact && fact.text) {
          fact.refs.forEach(r => ctx.refs.add(r));
          blocks.push({ type: 'paragraph', text: fact.text + ' (' + label + ' ' + number + ').' });
        }
        const caption = { label, number, seq: label };
        if (isFigure) blocks.push(Object.assign({ type: 'figure', id: e.id, fig: e.item.fig, caption: Object.assign(caption, { text: e.item.title }) }, Report.figureSize(e.item.fig, opts)));
        else if (e.kind === 'main') blocks.push(Object.assign({ type: 'table', id: 'main', caption: Object.assign(caption, { text: t('report.main.title') }) }, Report.mainTable(ov)));
        else blocks.push(Object.assign({ type: 'table', id: e.id, caption: Object.assign(caption, { text: e.item.title }) }, Report.tableCells(e.item, opts.rows)));
      }
    }

    blocks.push({ type: 'heading', level: 1, text: t('report.headings.references') });
    ctx.refs.delete('software');
    const refs = [...ctx.refs].filter(k => I18N.has('refs.' + k)).map(k => ({ key: k, text: t('refs.' + k) }));
    refs.push({ key: 'software', text: Report.softwareCitation() });
    refs.sort((a, b) => a.text.localeCompare(b.text, locale()));
    refs.forEach(r => blocks.push({ type: 'reference', key: r.key, text: r.text }));
    blocks.push({ type: 'heading', level: 2, text: t('report.headings.cite') });
    blocks.push({ type: 'paragraph', text: t('report.citeText', { citation: Report.softwareCitation() }) });
    return { lang: opts.lang, page: opts.page, title, author: opts.author, grayscale: !!opts.grayscale, blocks, figures: counters.figure, tables: counters.table, refs: refs.map(r => r.key) };
  },

  softwareCitation() { return t('report.software', { year: Report.YEAR, version: APP.version }); },

  figureSize(fig, opts) {
    const textCm = Math.min(Report.FIGURE_CM, DocxWriter.textWidthCm(opts.page));
    /* a figure taller than the page keeps the layout of the full width and is printed smaller (its text shrinks with it);
       drawing it narrower would wrap its labels again and could push them out of their boxes */
    let r = fig.renderPrint({ size: 'custom', customCm: textCm, textPt: Report.TEXT_PT, grayscale: !!opts.grayscale });
    let layoutCm = null;
    if (r.heightCm > Report.MAX_HEIGHT_CM) {
      layoutCm = textCm;
      const widthCm = Math.floor(textCm * Report.MAX_HEIGHT_CM / r.heightCm * 100) / 100;
      r = fig.renderPrint({ size: 'custom', customCm: widthCm, layoutCm, textPt: Report.TEXT_PT, grayscale: !!opts.grayscale });
    }
    return { widthCm: r.widthCm, heightCm: r.heightCm, layoutCm, textPt: r.textPt, svg: Fig.serialize(r.svg) };
  },

  mainTable(S) {
    const row = (key, value) => [t('report.main.' + key), value];
    const rows = [
      row('period', Report.period(S.period)), row('documents', fmtInt(S.documents)), row('sources', fmtInt(S.sources)),
      row('growth', Report.num(S.growthRate) + ' %'), row('age', Report.num(S.meanAge)), row('citations', S.citations.docs ? Report.num(S.citations.mean) : '—'),
      row('authors', fmtInt(S.authors)), row('appearances', fmtInt(S.authorAppearances)), row('singleAuthors', fmtInt(S.singleAuthors)),
      row('perDoc', Report.num(S.authorsPerDoc)), row('international', fmtPct(S.international.share)),
      row('authorKeywords', fmtInt(S.authorKeywords)), row('indexKeywords', fmtInt(S.indexKeywords)), row('references', fmtInt(S.references.distinct)),
    ];
    return { head: [t('report.main.indicator'), t('report.main.value')], numeric: [false, true], rows };
  },

  tableCells(item, maxRows) {
    const c = item.cells();
    const rows = c.rows.slice(0, maxRows);
    return { head: c.head, numeric: c.numeric, rows, note: c.rows.length > rows.length ? t('report.tableNote', { shown: fmtInt(rows.length), total: fmtInt(c.rows.length) }) : '' };
  },

  /* ---------- outputs ---------- */
  CSS: '.report-doc{font-family:"Times New Roman",Times,serif;font-size:11.5pt;line-height:1.4;color:#111;background:#fff}'
    + '.report-doc h1.rp-title{font-size:24pt;text-align:center;margin:6cm 0 .6cm;line-height:1.2}'
    + '.report-doc p.rp-subtitle{font-size:15pt;text-align:center;margin:0 0 1.2cm}'
    + '.report-doc p.rp-cover{font-size:12pt;text-align:center;margin:.15cm 0}'
    + '.report-doc .rp-break{break-after:page;page-break-after:always;height:0}'
    + '.report-doc h2.rp-h1{font-size:16pt;margin:.9cm 0 .3cm;break-after:avoid;page-break-after:avoid}'
    + '.report-doc h3.rp-h2{font-size:13pt;margin:.6cm 0 .2cm;break-after:avoid;page-break-after:avoid}'
    + '.report-doc p{text-align:justify;margin:0 0 .25cm}'
    + '.report-doc figure{margin:.3cm 0 .45cm;break-inside:avoid;page-break-inside:avoid}'
    + '.report-doc figure img{max-width:100%;height:auto;display:block;margin:0 auto}'
    + '.report-doc figcaption,.report-doc p.rp-caption{font-size:10pt;text-align:left;margin:.12cm 0 0;line-height:1.3}'
    + '.report-doc .rp-table{break-inside:avoid;page-break-inside:avoid;margin:.3cm 0 .45cm}'
    + '.report-doc table{border-collapse:collapse;table-layout:fixed;max-width:100%;font-size:9pt;border-top:1.2pt solid #000;border-bottom:1.2pt solid #000;margin-top:.1cm}'
    + '.report-doc th{text-align:left;border-bottom:.8pt solid #000;padding:2pt 4pt}'
    + '.report-doc td{padding:1.5pt 4pt;vertical-align:top}'
    + '.report-doc th.num,.report-doc td.num{text-align:right}'
    + '.report-doc p.rp-note{font-size:9pt;font-style:italic;margin:.08cm 0 0;text-align:left}'
    + '.report-doc p.rp-ref{text-align:left;padding-left:1cm;text-indent:-1cm}',

  html(model) {
    const E = s => esc(s == null ? '' : String(s));
    const out = [];
    for (const b of model.blocks) {
      if (b.type === 'title') out.push(`<h1 class="rp-title">${E(b.text)}</h1>`);
      else if (b.type === 'subtitle') out.push(`<p class="rp-subtitle">${E(b.text)}</p>`);
      else if (b.type === 'cover') out.push(`<p class="rp-cover">${E(b.text)}</p>`);
      else if (b.type === 'pagebreak') out.push('<div class="rp-break"></div>');
      else if (b.type === 'heading') out.push(b.level === 2 ? `<h3 class="rp-h2">${E(b.text)}</h3>` : `<h2 class="rp-h1">${E(b.text)}</h2>`);
      else if (b.type === 'paragraph') out.push(`<p>${E(b.text)}</p>`);
      else if (b.type === 'reference') out.push(`<p class="rp-ref" data-ref="${E(b.key)}">${E(b.text)}</p>`);
      else if (b.type === 'figure') {
        const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(b.svg);
        out.push(`<figure data-id="${E(b.id)}"><img src="${src}" alt="${E(b.caption.text)}" style="width:${b.widthCm}cm"><figcaption><b>${E(b.caption.label)} ${b.caption.number}.</b> ${E(b.caption.text)}</figcaption></figure>`);
      } else if (b.type === 'table') {
        const cell = (v, j, tag) => `<${tag}${b.numeric[j] ? ' class="num"' : ''}>${E(v)}</${tag}>`;
        /* the same column widths as in the .docx */
        const layout = DocxWriter.tableLayout(b, DocxWriter.textWidthCm(model.page) * DocxWriter.TWIPS_PER_CM);
        const cols = layout.widths.map(w => `<col style="width:${(100 * w / layout.total).toFixed(2)}%">`).join('');
        out.push(`<div class="rp-table" data-id="${E(b.id)}"><p class="rp-caption"><b>${E(b.caption.label)} ${b.caption.number}.</b> ${E(b.caption.text)}</p><table style="width:${(layout.total / DocxWriter.TWIPS_PER_CM).toFixed(2)}cm"><colgroup>${cols}</colgroup><thead><tr>${b.head.map((h, j) => cell(h, j, 'th')).join('')}</tr></thead><tbody>`
          + b.rows.map(r => '<tr>' + b.head.map((h, j) => cell(r[j], j, 'td')).join('') + '</tr>').join('') + '</tbody></table>'
          + (b.note ? `<p class="rp-note">${E(b.note)}</p>` : '') + '</div>');
      }
    }
    return out.join('\n');
  },

  standalone(model) {
    const size = model.page === 'a4' ? 'A4' : 'letter';
    return `<!DOCTYPE html>\n<html lang="${model.lang}">\n<head>\n<meta charset="utf-8">\n<meta name="generator" content="SciMetricsPro ${APP.version}">\n<title>${esc(model.title)}</title>\n`
      + `<style>@page{size:${size};margin:2.5cm}body{margin:0;background:#fff}${Report.CSS}@media screen{body{padding:1.5cm 0}.report-doc{max-width:17cm;margin:0 auto;padding:0 1cm}}</style>\n</head>\n`
      + `<body>\n<article class="report-doc">\n${Report.html(model)}\n</article>\n</body>\n</html>\n`;
  },

  async docx(model, progress) {
    const blocks = [];
    const figures = model.blocks.filter(b => b.type === 'figure');
    let done = 0;
    for (const b of model.blocks) {
      if (b.type !== 'figure') { blocks.push(b); continue; }
      if (progress) progress(done / Math.max(1, figures.length), b.caption.text);
      const blob = await I18N.withLang(model.lang, () => b.fig.printBlob('png', { size: 'custom', customCm: b.widthCm, layoutCm: b.layoutCm, textPt: Report.TEXT_PT, dpi: Report.DPI, grayscale: model.grayscale, background: '#ffffff' }));
      blocks.push(Object.assign({}, b, { image: new Uint8Array(await blob.arrayBuffer()), name: 'figure' + b.caption.number + '.png', alt: b.caption.text }));
      done++;
      await new Promise(r => setTimeout(r, 0));
    }
    return DocxWriter.build({ title: model.title, author: model.author, lang: model.lang, page: model.page, blocks });
  },
};

window.Report = Report;
