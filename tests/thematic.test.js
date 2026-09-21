/* Thematic map, thematic evolution and the factorial analysis of the conceptual structure (engines and screens). */
'use strict';

describe('thematic map and evolution · engine', () => {
  const P = () => Parsers.lib();
  /* two themes {a, b, c} and {d, e, f} joined by one document; values worked out by hand */
  const lists = [['a', 'b'], ['a', 'b'], ['a', 'c'], ['b', 'c'], ['d', 'e'], ['d', 'e'], ['d', 'f'], ['e', 'f'], ['c', 'd']];

  it('Callon centrality and density of two themes, and their quadrants', () => {
    deepEq(['motor', 'niche', 'emerging', 'basic'].map(q => q), P().QUADRANTS);
    eq(P().quadrantOf(2, 2, 1, 1), 'motor'); eq(P().quadrantOf(0, 2, 1, 1), 'niche'); eq(P().quadrantOf(0, 0, 1, 1), 'emerging'); eq(P().quadrantOf(2, 0, 1, 1), 'basic');
    const inc = P().incidence(lists, { minFreq: 1 });
    const m = P().thematicMap(inc, { minClusterWords: 2 });
    eq(m.clusters.length, 2);
    const byFirst = new Map(m.clusters.map(c => [c.keys.slice().sort().join(''), c]));
    const A = byFirst.get('abc'), B = byFirst.get('def');
    ok(A && B, 'themes {a, b, c} and {d, e, f}');
    near(A.internal, 4 / 9); near(A.external, 1 / 12); near(A.centrality, 10 / 12); near(A.density, 100 * (4 / 9) / 3);
    near(B.internal, 1 / 6 + 1 / 8 + 1 / 6); near(B.centrality, 10 / 12); near(B.density, 100 * (11 / 24) / 3);
    eq(A.freq, 9); eq(B.freq, 9);
    near(m.medianDensity, (A.density + B.density) / 2);
    eq(B.quadrant, 'motor'); eq(A.quadrant, 'basic', 'centrality at the median counts as high');
    deepEq(B.labelKeys, ['d', 'e', 'f']);
    const docs = P().themeDocuments(lists, m.clusters);
    deepEq(docs.counts[A.id], 5); deepEq(docs.counts[B.id], 5);
    eq(docs.byDoc[8], Math.min(A.id, B.id), 'a tie goes to the more frequent theme (the first)');
    deepEq(docs.matched[0], ['a', 'b']);
  });

  it('periods from cut years, the inclusion index and the links between periods', () => {
    const years = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2020, null];
    deepEq(P().periodsFromCuts(years, [2015, 2012, 2030, 2015, 2020]), [{ from: 2010, to: 2012 }, { from: 2013, to: 2015 }, { from: 2016, to: 2020 }]);
    deepEq(P().periodsFromCuts(years, []), [{ from: 2010, to: 2020 }]);
    const r = P().inclusionIndex(['x', 'y', 'z'], ['y', 'z', 'w', 'v']);
    deepEq(r.shared, ['y', 'z']); near(r.inclusion, 2 / 3);
    eq(P().inclusionIndex([], ['a']).inclusion, 0);
    const ys = [2001, 2001, 2002, 2002, 2003, 2003, 2004, 2004, 2004, 2005, 2005, 2006];
    const ls = [['a', 'b'], ['a', 'b'], ['c', 'd'], ['c', 'd'], ['a', 'b', 'e'], ['a', 'e'], ['b', 'e'], ['c', 'd'], ['c', 'f'], ['d', 'f'], ['c', 'd', 'f'], ['x']];
    const ev = P().thematicEvolution(ys, ls, [2002], { minFreq: 2, minClusterWords: 2 });
    eq(ev.periods.length, 2);
    deepEq([ev.periods[0].docs, ev.periods[1].docs], [4, 8]);
    const keys = (p, id) => ev.periods[p].map.clusters[id].keys.slice().sort().join('');
    const pairs = ev.links.map(l => keys(0, l.from) + '→' + keys(1, l.to) + ' ' + l.inclusion.toFixed(3)).sort();
    deepEq(pairs, ['ab→abe 1.000', 'cd→cdf 1.000']);
  });
});

describe('factorial analysis · engine', () => {
  const P = () => Parsers.lib();

  it('Jacobi eigen-decomposition: known values, orthonormal vectors and reconstruction', () => {
    const e = P().eigenSym([[2, 1], [1, 2]]);
    near(e.values[0], 3, 1e-12); near(e.values[1], 1, 1e-12);
    const r = rng(7), n = 12;
    const M = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { const v = r() * 2 - 1; M[i][j] = v; M[j][i] = v; }
    const E = P().eigenSym(M);
    let err = 0, orth = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      let s = 0, o = 0;
      for (let k = 0; k < n; k++) { s += E.vectors[k][i] * E.values[k] * E.vectors[k][j]; o += E.vectors[i][k] * E.vectors[j][k]; }
      err = Math.max(err, Math.abs(s - M[i][j])); orth = Math.max(orth, Math.abs(o - (i === j ? 1 : 0)));
    }
    ok(err < 1e-10 && orth < 1e-10, 'reconstruction ' + err + ', orthogonality ' + orth);
    ok(E.values.every((v, i) => i === 0 || v <= E.values[i - 1]), 'descending');
  });

  it('correspondence analysis of the published smoking table (Greenacre): inertias and coordinates', () => {
    const smoke = [[4, 2, 3, 2], [4, 3, 7, 4], [25, 10, 12, 4], [18, 24, 33, 13], [10, 6, 7, 2]];
    const ca = P().correspondenceAnalysis(smoke);
    eq(ca.dims, 3);
    near(ca.values[0], 0.07476, 5e-6); near(ca.values[1], 0.01002, 5e-6); near(ca.values[2], 0.00041, 5e-6);
    near(ca.total, 0.08519, 5e-6);
    near(ca.pct[0], 0.8776, 5e-4);
    deepEq(ca.rowCoord.map(f => +Math.abs(f[0]).toFixed(3)), [0.066, 0.259, 0.381, 0.233, 0.201]);
    deepEq(ca.colCoord.map(g => +Math.abs(g[0]).toFixed(3)), [0.393, 0.099, 0.196, 0.294]);
    /* transition formula: rows are the weighted averages of the columns, stretched by 1/σ */
    const f0 = ca.rowCoord[2][0], g = ca.colCoord.map(x => x[0]);
    near(f0, (25 * g[0] + 10 * g[1] + 12 * g[2] + 4 * g[3]) / 51 / Math.sqrt(ca.values[0]), 1e-12);
    near(ca.colContrib.reduce((s, c) => s + c[0], 0), 100, 1e-9);
  });

  it('the sparse CA of a binary document × word matrix equals the dense CA; MCA identities for binary variables', () => {
    const r = rng(11), n = 40, p = 7;
    const docs = Array.from({ length: n }, () => { const d = []; for (let j = 0; j < p; j++) if (r() < 0.35 + 0.05 * j) d.push(j); return d; }).filter(d => d.length);
    const dense = docs.map(d => Array.from({ length: p }, (x, j) => (d.includes(j) ? 1 : 0)));
    const a = P().correspondenceBinary(docs, p), b = P().correspondenceAnalysis(dense);
    eq(a.dims, b.dims);
    ok(a.values.every((v, i) => Math.abs(v - b.values[i]) < 1e-12), 'eigenvalues');
    ok(a.colCoord.every((g, j) => Array.from(g).every((x, d) => Math.abs(Math.abs(x) - Math.abs(b.colCoord[j][d])) < 1e-9)), 'word coordinates');
    ok(a.rowCoord.every((f, i) => Array.from(f).every((x, d) => Math.abs(Math.abs(x) - Math.abs(b.rowCoord[i][d])) < 1e-9)), 'document coordinates');
    /* MCA = CA of the indicator matrix with present and absent categories */
    const all = Array.from({ length: n }, () => { const d = []; for (let j = 0; j < p; j++) if (r() < 0.3 + 0.08 * j) d.push(j); return d; });
    const m = P().mcaBinary(all, p);
    const indicator = all.map(d => Array.from({ length: 2 * p }, (x, c) => (c < p ? (d.includes(c) ? 1 : 0) : (d.includes(c - p) ? 0 : 1))));
    const ind = P().correspondenceAnalysis(indicator);
    ok(m.values.every((v, i) => Math.abs(v - ind.values[i]) < 1e-12), 'MCA eigenvalues = CA of the indicator matrix');
    near(m.total, 1, 1e-12, 'total inertia (J − Q) / Q = 1 with two categories per word');
    /* binary variables: MCA eigenvalues = eigenvalues of the correlation matrix / Q */
    const cols = Array.from({ length: p }, (x, j) => all.map(d => (d.includes(j) ? 1 : 0)));
    const corr = cols.map(x => cols.map(y => {
      const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
      return sxy / Math.sqrt(sxx * syy);
    }));
    const mu = P().eigenSym(corr).values;
    ok(m.values.every((v, i) => Math.abs(v - mu[i] / p) < 1e-10), 'λ = μ / Q');
    const k = m.values.findIndex(v => v <= 1 / p);
    near(m.adjusted[0], Math.pow(p / (p - 1) * (m.values[0] - 1 / p), 2), 1e-15, 'Benzécri');
    ok(k < 0 || m.adjusted[k] === 0, 'no adjusted inertia at or below 1/Q');
    near(m.pctAdjusted.reduce((s, v) => s + v, 0), 1, 1e-12);
  });

  it('k-means, the silhouette worked out by hand, the suggested k and Ward heights', () => {
    const s = P().silhouette([[0], [1], [10], [11]], [0, 0, 1, 1]);
    near(s.values[0], 9.5 / 10.5); near(s.values[1], 8.5 / 9.5); near(s.mean, (2 * 9.5 / 10.5 + 2 * 8.5 / 9.5) / 4);
    const r = rng(3), blobs = [];
    [[0, 0], [5, 5], [0, 6]].forEach(([cx, cy], c) => { for (let i = 0; i < 12 + c * 3; i++) blobs.push([cx + (r() - 0.5), cy + (r() - 0.5)]); });
    const km = P().kmeans(blobs, 3);
    deepEq(km.sizes, [18, 15, 12], 'largest cluster first');
    ok([0, 12, 27].every(start => new Set(km.labels.slice(start, start + [12, 15, 18][[0, 12, 27].indexOf(start)])).size === 1), 'each blob in one cluster');
    eq(P().suggestK(blobs, 2, 6).best, 3);
    deepEq([...P().kmeans(blobs, 3).labels], [...km.labels], 'reproducible');
    const w = P().ward([[0], [1], [5], [6], [20]]);
    deepEq(w.merges.map(x => [x[0], x[1], +x[2].toFixed(4), x[3]]), [[0, 1, 1, 2], [2, 3, 1, 2], [5, 6, 7.0711, 4], [4, 7, 21.5035, 5]]);
    deepEq(w.order.slice().sort(), [0, 1, 2, 3, 4]);
  });

  it('k-means: no single move lowers the sum of squares, and small sets reach the minimum over every partition', () => {
    const r = rng(11);
    const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    const centres = (pts, lab, k) => Array.from({ length: k }, (_, g) => {
      const m = pts.filter((p, i) => lab[i] === g);
      return [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length, m.length];
    });
    /* Hartigan's condition: moving x from A to B changes the sum by n_B/(n_B+1)·|x − c_B|² − n_A/(n_A−1)·|x − c_A|² */
    let sets = 0;
    for (let rep = 0; rep < 12; rep++) {
      const pts = Array.from({ length: 60 }, () => [r() * 10, r() * 10]);
      for (const k of [4, 6, 8]) {
        const km = P().kmeans(pts, k, { restarts: 1, seed: rep });
        const c = centres(pts, km.labels, k);
        const worst = Math.min(...pts.map((p, i) => {
          const a = c[km.labels[i]];
          if (a[2] < 2) return 0;
          return Math.min(...c.filter((b, g) => g !== km.labels[i]).map(b => b[2] / (b[2] + 1) * sq(p, b) - a[2] / (a[2] - 1) * sq(p, a)));
        }));
        ok(worst > -1e-9, 'a move would lower the sum of squares by ' + (-worst) + ' (k = ' + k + ')');
        near(km.withinSS, pts.reduce((s, p, i) => s + sq(p, c[km.labels[i]]), 0), 1e-9);
        sets++;
      }
    }
    eq(sets, 36);
    /* every partition of 9 points into 3 or 4 clusters */
    const minimum = (pts, k) => {
      let min = Infinity;
      const lab = new Array(pts.length);
      for (let code = 0; code < Math.pow(k, pts.length); code++) {
        let x = code;
        for (let i = 0; i < pts.length; i++) { lab[i] = x % k; x = Math.floor(x / k); }
        const c = centres(pts, lab, k);
        if (c.some(g => !g[2])) continue;
        min = Math.min(min, pts.reduce((s, p, i) => s + sq(p, c[lab[i]]), 0));
      }
      return min;
    };
    for (let rep = 0; rep < 6; rep++) {
      const pts = Array.from({ length: 9 }, () => [r() * 10, r() * 10]);
      const k = rep < 4 ? 3 : 4;
      near(P().kmeans(pts, k).withinSS, minimum(pts, k), 1e-9, 'set ' + rep);
    }
  });

  it('the factorial analysis of a collection: words, clusters and dimensions', () => {
    const r = rng(5), lists = [];
    const A = ['maize', 'landraces', 'diversity', 'domestication'], B = ['bees', 'squash', 'flowers', 'pollination'];
    for (let i = 0; i < 60; i++) { const topic = i % 2 ? A : B; lists.push(topic.filter(() => r() < 0.7).concat(r() < 0.1 ? [(i % 2 ? B : A)[0]] : [])); }
    for (const method of ['mca', 'ca']) {
      const auto = P().conceptualFactorial(lists, { method, maxItems: 8, minFreq: 2 });
      ok(!auto.empty && auto.points.length === 8, method);
      if (method === 'mca') eq(auto.k, 2, 'the silhouette suggests the two topics');
      else ok(auto.k === 2 || auto.k === 3, 'CA: a close call between 2 and 3 (silhouette ' + auto.suggestion.scores.map(s => s.k + ':' + s.silhouette.toFixed(3)).join(' ') + ')');
      const f = P().conceptualFactorial(lists, { method, maxItems: 8, minFreq: 2, k: 2 });
      const lab = w => f.kmeans.labels[f.inc.items.findIndex(x => x.key === w)];
      ok(A.every(w => lab(w) === lab('maize')) && B.every(w => lab(w) === lab('bees')) && lab('maize') !== lab('bees'), method + ': one cluster per topic');
    }
  });
});

/* 72 documents, 12 years, three topics with a few shared words (synthetic; titles all different) */
function thematicDataset() {
  const P = Parsers.lib();
  const r = rng(2011);
  const topics = [
    ['maize', 'landraces', 'genetic diversity', 'domestication', 'seed conservation'],
    ['pollination', 'bees', 'flowers', 'squash', 'nectar'],
    ['salinity', 'irrigation', 'soil', 'drought', 'water use'],
  ];
  const nouns = ['survey', 'analysis', 'assessment', 'review', 'experiment', 'census'];
  const places = ['Oaxaca', 'Puebla', 'Chiapas', 'Veracruz', 'Jalisco', 'Yucatan', 'Sonora', 'Hidalgo', 'Morelos', 'Guerrero', 'Tlaxcala', 'Durango'];
  const out = [];
  for (let i = 0; i < 72; i++) {
    const t = i % 3, year = 2010 + (i % 12);
    const kws = topics[t].filter(() => r() < 0.6);
    if (r() < 0.25) kws.push(topics[(t + 1) % 3][Math.floor(r() * 5)]);
    if (kws.length < 2) kws.push(topics[t][0], topics[t][1]);
    out.push(P.finish(Object.assign(P.newRecord(), {
      title: `${nouns[i % 6]} of ${topics[t][2]} number ${i + 1} in ${places[(i * 7) % 12]}`, year, timesCited: (i * 13) % 17, docTypeRaw: 'Article',
      sourceTitle: 'Econ Bot', authors: [P.person(['Lira, R.', 'Soto, B.', 'Cruz, A.'][t])], authorKeywords: [...new Set(kws)],
    })));
  }
  return out;
}

describe('thematic map, evolution and factorial analysis · screens', () => {
  const card = (grid, key) => el(grid).querySelector(`[data-key="${key}"] .metric-value`).textContent;
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('termField'); };
  const change = (id, v) => { const s = el(id); if (s.type === 'checkbox') s.checked = !!v; else s.value = v == null ? '' : String(v); s.dispatchEvent(new Event('change')); };
  const tab = id => { ConceptualModule.tab = id; App.render('conceptual'); };

  it('thematic map: quadrant cards, the strategic diagram and the tables', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    ConceptualModule.tm = null; ConceptualModule.ev = null; ConceptualModule.fa = null; ConceptualModule.figs = {};
    const records = thematicDataset();
    ImportModule.addResult({ name: 'themes.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    eq(Pipeline.records().length, 72, 'no duplicates merged');
    location.hash = '#/conceptual';
    tab('thematicMap');
    const { map } = ConceptualModule.thematic();
    eq(el('tmParams').querySelector('.net-panel-title').textContent, 'Parámetros del mapa');
    ok(map.clusters.length >= 3, 'themes: ' + map.clusters.length);
    const themes = +card('tmStats', 'themes');
    eq(themes, map.clusters.length);
    eq(['motor', 'niche', 'emerging', 'basic'].reduce((s, q) => s + +card('tmStats', q), 0), themes, 'every theme in one quadrant');
    const svg = el('tmMap').querySelector('svg');
    eq(svg.querySelectorAll('[data-series="themes"] circle').length, themes);
    eq(svg.querySelectorAll('[data-quadrants] rect[data-quadrant]').length, 4);
    ok(svg.textContent.includes('Temas motores') && svg.textContent.includes('Temas básicos'), 'quadrant names');
    eq(el('tmThemes').querySelectorAll('tbody tr').length, themes);
    ok(el('tmDocs').querySelectorAll('tbody tr').length > 0, 'documents of each theme');
    const first = map.clusters[0];
    ok(el('tmThemes').textContent.includes(first.keys[0]), 'theme words listed');
    change('tmParams-minClusterWords', 50);
    ok(el('tmTooFew'), 'too few themes');
    change('tmParams-minClusterWords', 2);
  });

  it('thematic evolution: periods from the cut years, Sankey with links and one small map per period', () => {
    tab('evolution');
    ok(el('evPeriods').textContent.includes('Sin años de corte: se usa el año mediano'), el('evPeriods').textContent);
    change('evParams-cut1', 2013);
    change('evParams-cut2', 2017);
    const { ev } = ConceptualModule.evolution();
    deepEq(ev.periods.map(p => [p.from, p.to]), [[2010, 2013], [2014, 2017], [2018, 2021]]);
    const svg = el('evSankey').querySelector('svg');
    const themes = ev.periods.reduce((s, p) => s + p.map.clusters.length, 0);
    eq(svg.querySelectorAll('[data-series="nodes"] rect').length, themes);
    eq(svg.querySelectorAll('[data-series="links"] path').length, ev.links.length);
    ok(ev.links.length > 0, 'links between periods');
    ok([...svg.querySelectorAll('path, rect')].every(n => !/NaN/.test(n.getAttribute('d') || '') && !/NaN/.test(n.getAttribute('y') || '')), 'no NaN in the drawing');
    eq(el('evMaps').querySelectorAll('svg [data-panel]').length, 3);
    eq(el('evLinks').querySelectorAll('tbody tr').length, Math.min(25, ev.links.length));
    change('evParams-cut2', null);
    eq(ConceptualModule.evolution().ev.periods.length, 2, 'an empty cut is ignored');
    change('evParams-minInclusion', 1);
    ok(ConceptualModule.evolution().ev.links.every(l => l.inclusion === 1), 'only complete inclusions');
    change('evParams-minInclusion', 0);
    ok(ConceptualModule.evolution().ev.periods.some(p => p.map.nodes.length > 5), 'periods with more than 5 words');
    change('evParams-maxNodes', 5);
    ok(ConceptualModule.evolution().ev.periods.every(p => p.map.nodes.length <= 5), 'the number of words applies to every period');
    change('evParams-maxNodes', 250);
  });

  it('factorial analysis: map of words by cluster, k chosen by the silhouette or by hand, dendrogram', () => {
    tab('factorial');
    ok(el('faNote').textContent.includes('PCAPro y ClusteringPro'), 'family note');
    eq(el('faParams').querySelector('.net-panel-title').textContent, 'Parámetros del análisis', 'the panel is not called a network');
    eq(el('faParams').getAttribute('aria-label'), 'Parámetros del análisis');
    const { f } = ConceptualModule.factorial();
    eq(el('faMap').querySelectorAll('svg [data-series="words"] circle').length, f.inc.items.length);
    eq(card('faStats', 'clusters'), String(f.suggestion.best), 'automatic k = best silhouette');
    change('faParams-k', 4);
    eq(card('faStats', 'clusters'), '4');
    eq(el('faMap').querySelectorAll('svg [data-legend] circle').length, 4);
    ok(!el('faDendrogram'), 'no dendrogram by default');
    change('faParams-dendrogram', true);
    eq(el('faDendrogram').querySelectorAll('svg [data-series="tree"] path').length, f.inc.items.length - 1);
    change('faParams-method', 'ca');
    ok(el('faStats').querySelector('[data-key="dim1"] .metric-sub').textContent.includes('de la inercia total'), 'CA percentages');
    eq(el('faEigen').querySelectorAll('thead th').length, 4, 'no adjusted columns for CA');
    change('faParams-method', 'mca');
    eq(el('faEigen').querySelectorAll('thead th').length, 6);
    ok(el('faWords').querySelectorAll('tbody tr').length > 0 && el('faSilhouette').querySelectorAll('tbody tr').length >= 5, 'tables');
  });

  it('every help has a definition, a formula and its reference; no visible text outside the dictionaries', () => {
    const data = new Set(['maize', 'landraces', 'genetic diversity', 'domestication', 'seed conservation', 'pollination', 'bees', 'flowers', 'squash', 'nectar', 'salinity', 'irrigation', 'soil', 'drought', 'water use']);
    thematicDataset().forEach(r => { data.add(r.title); data.add(Parsers.lib().documentLabel(r)); });
    const dataLike = s => [...data].some(d => s.includes(d));
    const problems = [], bad = [];
    ['thematicMap', 'evolution', 'factorial'].forEach(id => {
      ['es', 'en'].forEach(lang => {
        I18N.setLang(lang); tab(id);
        const engine = s => lang === 'en' && typeof I18N_DICT.es.phrases[s] === 'string';
        strayTexts(el('view'), lang).filter(s => !data.has(s) && !engine(s) && !dataLike(s)).forEach(s => problems.push(lang + ' ' + id + ': ' + s));
      });
      I18N.setLang('es'); tab(id);
      [...el('view').querySelectorAll('.conceptual-page .help-btn')].forEach((b, i) => {
        b.click();
        const pop = document.querySelector('.help-pop');
        if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(id + ' #' + i);
        HelpPopover.close();
      });
    });
    deepEq({ problems, bad }, { problems: [], bad: [] });
  });

  it('criterion: the new figures export to PNG (300 dpi) and SVG', async () => {
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    const charts = [['thematicMap', 'tmMap'], ['evolution', 'evSankey'], ['evolution', 'evMaps'], ['factorial', 'faMap'], ['factorial', 'faDendrogram']];
    try {
      for (let k = 0; k < charts.length; k++) {
        tab(charts[k][0]);
        const buttons = ConceptualModule.cc[charts[k][1]].el.querySelectorAll('.chart-actions button');
        buttons[0].click(); buttons[1].click();
        for (let i = 0; i < 150 && got.length < 2 * (k + 1); i++) await tick(30);
      }
    } finally { window.download = saved; }
    eq(got.length, 10, 'ten files');
    for (const g of got.filter(x => x.name.endsWith('.png'))) {
      const b = new Uint8Array(await g.blob.arrayBuffer());
      let ppm = null;
      for (let i = 8; i < b.length - 12; i++) if (b[i] === 0x70 && b[i + 1] === 0x48 && b[i + 2] === 0x59 && b[i + 3] === 0x73) { ppm = (b[i + 4] << 24 | b[i + 5] << 16 | b[i + 6] << 8 | b[i + 7]) >>> 0; break; }
      eq(ppm, 11811, g.name);
    }
    for (const g of got.filter(x => x.name.endsWith('.svg'))) {
      const doc = new DOMParser().parseFromString(await g.blob.text(), 'image/svg+xml');
      ok(!doc.querySelector('parsererror'), g.name + ' parses');
    }
    ConceptualModule.fa = null;
    reset();
    await Pipeline.pending;
  });
});
