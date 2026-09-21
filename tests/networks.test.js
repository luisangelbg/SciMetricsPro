/* Networks: incidence, co-occurrence, coupling, normalisations, communities (Louvain, fast greedy), metrics,
   layouts, the network view, the conceptual structure screen and figure export. */
'use strict';

/* Zachary's karate club (78 edges, nodes 0–33): the usual test network with published centralities */
const KARATE = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 10], [0, 11], [0, 12], [0, 13], [0, 17], [0, 19], [0, 21], [0, 31],
  [1, 2], [1, 3], [1, 7], [1, 13], [1, 17], [1, 19], [1, 21], [1, 30], [2, 3], [2, 7], [2, 8], [2, 9], [2, 13], [2, 27], [2, 28], [2, 32],
  [3, 7], [3, 12], [3, 13], [4, 6], [4, 10], [5, 6], [5, 10], [5, 16], [6, 16], [8, 30], [8, 32], [8, 33], [9, 33], [13, 33], [14, 32], [14, 33],
  [15, 32], [15, 33], [18, 32], [18, 33], [19, 33], [20, 32], [20, 33], [22, 32], [22, 33], [23, 25], [23, 27], [23, 29], [23, 32], [23, 33],
  [24, 25], [24, 27], [24, 31], [25, 31], [26, 29], [26, 33], [27, 33], [28, 31], [28, 33], [29, 32], [29, 33], [30, 32], [30, 33], [31, 32],
  [31, 33], [32, 33]];

/* written from the definitions on a dense matrix, independently of the fast versions */
const NetBrute = {
  matrix(n, edges) {
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const e of edges) { const w = e.length > 3 ? e[3] : e.length > 2 ? e[2] : 1; A[e[0]][e[1]] += w; A[e[1]][e[0]] += w; }
    return A;
  },
  distances(A) {
    const n = A.length, D = A.map((row, i) => row.map((w, j) => (i === j ? 0 : w > 0 ? 1 : Infinity)));
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][k] + D[k][j] < D[i][j]) D[i][j] = D[i][k] + D[k][j];
    return D;
  },
  /* shortest-path counts from the distance matrix: σ(s, t) = Σ over neighbours u of t one step closer to s */
  pathCounts(A, D) {
    const n = A.length;
    const S = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let s = 0; s < n; s++) {
      const byDist = [...Array(n).keys()].filter(t => isFinite(D[s][t])).sort((a, b) => D[s][a] - D[s][b]);
      for (const t of byDist) {
        if (t === s) { S[s][t] = 1; continue; }
        for (let u = 0; u < n; u++) if (A[t][u] > 0 && D[s][u] === D[s][t] - 1) S[s][t] += S[s][u];
      }
    }
    return S;
  },
  betweenness(A) {
    const n = A.length, D = NetBrute.distances(A), S = NetBrute.pathCounts(A, D), b = new Array(n).fill(0);
    for (let s = 0; s < n; s++) for (let t = s + 1; t < n; t++) {
      if (!isFinite(D[s][t])) continue;
      for (let v = 0; v < n; v++) if (v !== s && v !== t && D[s][v] + D[v][t] === D[s][t]) b[v] += S[s][v] * S[v][t] / S[s][t];
    }
    return b;
  },
  closeness(A) {
    const n = A.length, D = NetBrute.distances(A);
    return D.map(row => { const r = row.filter(isFinite); const sum = r.reduce((a, b) => a + b, 0); return sum > 0 ? ((r.length - 1) / (n - 1)) * ((r.length - 1) / sum) : 0; });
  },
  transitivity(A) {
    const n = A.length; let tri = 0, triples = 0;
    for (let i = 0; i < n; i++) { const d = A[i].filter(w => w > 0).length; triples += d * (d - 1) / 2; }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) if (A[i][j] > 0 && A[j][k] > 0 && A[i][k] > 0) tri++;
    return triples ? 3 * tri / triples : 0;
  },
  modularity(A, c, gamma) {
    const n = A.length, k = A.map(r => r.reduce((a, b) => a + b, 0)), m2 = k.reduce((a, b) => a + b, 0);
    let q = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (c[i] === c[j]) q += A[i][j] - gamma * k[i] * k[j] / m2;
    return q / m2;
  },
  randomGraph(seed, n, p, weighted) {
    const r = rng(seed), edges = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (r() < p) edges.push([i, j, weighted ? 1 + Math.floor(r() * 5) : 1]);
    return edges;
  },
  /* k cliques of size s joined in a ring by single edges */
  ringOfCliques(k, s) {
    const edges = [];
    for (let c = 0; c < k; c++) {
      for (let i = 0; i < s; i++) for (let j = i + 1; j < s; j++) edges.push([c * s + i, c * s + j, 1]);
      edges.push([c * s, ((c + 1) % k) * s + 1, 1]);
    }
    return edges.map(e => [Math.min(e[0], e[1]), Math.max(e[0], e[1]), 1]);
  },
};

describe('networks · build', () => {
  const P = () => Parsers.lib();

  it('normalisations of a co-occurrence count, by their formulas', () => {
    const f = m => P().normalizeCount(2, 4, 5, m);
    eq(f('none'), 2);
    near(f('association'), 2 / 20); near(f('salton'), 2 / Math.sqrt(20)); near(f('jaccard'), 2 / 7);
    near(f('inclusion'), 0.5); near(f('equivalence'), 4 / 20);
    eq(P().normalizeCount(0, 4, 5, 'salton'), 0);
    deepEq(P().NORMALIZATIONS, ['none', 'association', 'salton', 'jaccard', 'inclusion', 'equivalence']);
  });

  it('incidence, co-occurrence (AᵀA), coupling (AAᵀ) and the filtered network, worked out by hand', () => {
    const lists = [['a', 'b', 'c', 'a'], ['a', 'b'], ['b', 'c'], ['a', 'd'], []];
    const inc = P().incidence(lists, { minFreq: 2 });
    deepEq(inc.items, [{ key: 'a', freq: 3 }, { key: 'b', freq: 3 }, { key: 'c', freq: 2 }]);
    deepEq(inc.docs, [[0, 1, 2], [0, 1], [1, 2], [0], []]);
    deepEq(P().cooccurrence(inc.docs, 3), [[0, 1, 2], [0, 2, 1], [1, 2, 2]]);
    const all = P().incidence(lists);
    deepEq(P().coupling(all.docs, all.items.length), [[0, 1, 2], [0, 2, 2], [0, 3, 1], [1, 2, 1], [1, 3, 1]]);
    deepEq(P().incidence(lists, { maxItems: 2 }).items.map(x => x.key), ['a', 'b'], 'ties by key');
    const net = P().buildNetwork(inc, { normalization: 'salton', minEdge: 2 });
    deepEq(net.nodes.map(x => x.key), ['a', 'b', 'c']);
    deepEq(net.edges.map(e => [e[0], e[1], e[2]]), [[0, 1, 2], [1, 2, 2]]);
    near(net.edges[0][3], 2 / 3); near(net.edges[1][3], 2 / Math.sqrt(6));
    const iso = P().buildNetwork(P().incidence(lists, { minFreq: 1 }), { minEdge: 2 });
    deepEq(iso.nodes.map(x => x.key), ['a', 'b', 'c'], 'd has no edge with two co-occurrences');
    eq(P().buildNetwork(P().incidence(lists, { minFreq: 1 }), { minEdge: 2, removeIsolated: false }).nodes.length, 4);
    const g = P().graph(3, net.edges);
    deepEq([...g.degree], [1, 2, 1]); near(g.strength[1], 2 / 3 + 2 / Math.sqrt(6)); eq(g.m, 2);
  });
});

describe('networks · metrics', () => {
  const P = () => Parsers.lib();
  const karate = () => P().graph(34, KARATE.map(e => [e[0], e[1], 1]));

  it('Zachary karate club: published betweenness, closeness, PageRank, density, transitivity and diameter', () => {
    const g = karate(), M = P().networkMetrics(g);
    near(M.betweenness[0], 231.0714286, 1e-6); near(M.betweenness[33], 160.5515873, 1e-6); near(M.betweennessNorm[33], 0.30407497594997596, 1e-9); near(M.betweenness[32], 76.6904762, 1e-6); near(M.betweenness[2], 75.8507937, 1e-6);
    near(M.betweennessNorm[0], 0.4376352813852815, 1e-9);
    near(M.closeness[0], 0.5689655172413793, 1e-12); near(M.closeness[2], 0.559322033898305, 1e-12); near(M.closeness[33], 0.55, 1e-12);
    /* the published PageRank stops when the total change is below n × 10⁻⁶: with that rule every digit agrees; converged values differ by less than 10⁻⁵ */
    const early = P().pagerank(g, { tol: 34e-6 });
    near(early[33], 0.1009179167487121, 1e-15); near(early[0], 0.09700181758983709, 1e-15); near(early[32], 0.07169213006588289, 1e-15);
    near(M.pagerank[33], 0.1009179167487121, 1e-5); near(M.pagerank[0], 0.09700181758983709, 1e-5);
    near(M.stats.density, 78 / 561, 1e-12); near(M.stats.transitivity, 0.2556818181818182, 1e-12);
    eq(M.stats.diameter, 5); eq(M.stats.components, 1); eq(M.stats.edges, 78); eq(M.stats.triangles, 45);
    near([...M.pagerank].reduce((a, b) => a + b, 0), 1, 1e-9);
  });

  it('betweenness, closeness, transitivity and PageRank agree with brute force on 40 random weighted graphs', () => {
    const bad = [];
    for (let s = 1; s <= 40; s++) {
      const n = 8 + (s % 17), edges = NetBrute.randomGraph(s * 7919, n, 0.12 + (s % 5) * 0.05, true);
      const g = P().graph(n, edges), A = NetBrute.matrix(n, edges);
      const M = P().networkMetrics(g);
      const b = NetBrute.betweenness(A), c = NetBrute.closeness(A);
      if (b.some((v, i) => Math.abs(v - M.betweenness[i]) > 1e-9)) bad.push('betweenness ' + s);
      if (c.some((v, i) => Math.abs(v - M.closeness[i]) > 1e-12)) bad.push('closeness ' + s);
      if (Math.abs(NetBrute.transitivity(A) - M.stats.transitivity) > 1e-12) bad.push('transitivity ' + s);
      /* PageRank is the fixed point of its own equation */
      const k = A.map(r => r.reduce((x, y) => x + y, 0)), pr = M.pagerank;
      const dangling = pr.reduce((acc, v, i) => acc + (k[i] > 0 ? 0 : v), 0);
      for (let i = 0; i < n; i++) {
        let v = 0.15 / n + 0.85 * dangling / n;
        for (let j = 0; j < n; j++) if (A[j][i] > 0) v += 0.85 * pr[j] * A[j][i] / k[j];
        if (Math.abs(v - pr[i]) > 1e-9) { bad.push('pagerank ' + s); break; }
      }
      if (NetBrute.distances(A).flat().filter(isFinite).reduce((a, x) => Math.max(a, x), 0) !== M.stats.diameter) bad.push('diameter ' + s);
    }
    deepEq(bad, []);
  });
});

describe('networks · communities', () => {
  const P = () => Parsers.lib();
  const karate = () => P().graph(34, KARATE.map(e => [e[0], e[1], 1]));

  it('modularity with resolution matches its definition on random partitions', () => {
    const bad = [];
    const r = rng(2004);
    for (let s = 1; s <= 20; s++) {
      const n = 12 + s, edges = NetBrute.randomGraph(s * 131, n, 0.2, true);
      const g = P().graph(n, edges), A = NetBrute.matrix(n, edges);
      const c = Array.from({ length: n }, () => Math.floor(r() * 4));
      for (const gamma of [0.5, 1, 1.7]) if (Math.abs(P().modularity(g, c, gamma) - NetBrute.modularity(A, c, gamma)) > 1e-12) bad.push(s + ' γ ' + gamma);
    }
    deepEq(bad, []);
  });

  it('karate club: Louvain reaches Q ≥ 0.41 (best known 0.4198); fast greedy gives the published 3 communities with Q = 0.3807', () => {
    const g = karate(), A = NetBrute.matrix(34, KARATE);
    const L = P().louvain(g);
    ok(L.modularity >= 0.41, 'Louvain Q ' + L.modularity);
    near(L.modularity, NetBrute.modularity(A, L.membership, 1), 1e-12);
    const F = P().fastGreedy(g);
    near(F.modularity, 0.3806706114398422, 1e-6);
    eq(F.communities, 3);
    const groups = [...new Set(F.membership)].map(c => F.membership.reduce((acc, x, i) => (x === c ? acc.concat(i) : acc), []).join(','));
    deepEq(groups.sort(), ['0,4,5,6,10,11,16,19', '1,2,3,7,9,12,13,17,21', '8,14,15,18,20,22,23,24,25,26,27,28,29,30,31,32,33'].sort());
  });

  it('ring of cliques: one community per clique at γ = 1, fewer with a low resolution, and the result is reproducible', () => {
    const edges = NetBrute.ringOfCliques(8, 5), g = P().graph(40, edges);
    for (const algorithm of ['louvain', 'fastgreedy']) {
      const C = P().communities(g, { algorithm, resolution: 1 });
      eq(C.communities, 8, algorithm);
      ok([...Array(8).keys()].every(c => new Set(C.membership.slice(c * 5, c * 5 + 5)).size === 1), algorithm + ': each clique together');
      ok(P().communities(g, { algorithm, resolution: 0.1 }).communities < 8, algorithm + ' low resolution');
      ok(P().communities(g, { algorithm, resolution: 3 }).communities >= 8, algorithm + ' high resolution');
    }
    deepEq([...P().louvain(g).membership], [...P().louvain(g).membership]);
    deepEq([...P().relabelCommunities([5, 5, 2, 9, 2, 2])], [1, 1, 0, 2, 0, 0], 'largest first');
    eq(P().louvain(P().graph(3, [])).modularity, 0, 'no edges');
  });
});

describe('networks · layouts', () => {
  const P = () => Parsers.lib();
  const twoCliques = () => {
    const edges = [];
    for (const off of [0, 8]) for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) edges.push([off + i, off + j, 1]);
    edges.push([0, 8, 1]);
    return P().graph(16, edges);
  };
  const separation = pos => {
    const d = (i, j) => Math.hypot(pos[2 * i] - pos[2 * j], pos[2 * i + 1] - pos[2 * j + 1]);
    let intra = 0, ni = 0, inter = 0, ne = 0;
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) { if ((i < 8) === (j < 8)) { intra += d(i, j); ni++; } else { inter += d(i, j); ne++; } }
    return (intra / ni) / (inter / ne);
  };

  it('ForceAtlas2 separates two cliques joined by one edge (exact and Barnes–Hut repulsion) and is reproducible', () => {
    const g = twoCliques();
    const exact = P().forceAtlas2(g, { seed: 7 }), bh = P().forceAtlas2(g, { seed: 7, barnesHut: true });
    ok(separation(exact) < 0.5, 'exact ' + separation(exact));
    ok(separation(bh) < 0.5, 'Barnes–Hut ' + separation(bh));
    deepEq([...P().forceAtlas2(g, { seed: 7 })], [...exact], 'same seed, same drawing');
    ok([...exact].every(isFinite), 'finite positions');
  });

  it('pieces of a network that is not connected: each keeps its drawing and they are packed next to each other', () => {
    /* a clique of 8, a path of 3 and two pairs */
    const edges = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) edges.push([i, j, 1]);
    edges.push([8, 9, 1], [9, 10, 1], [11, 12, 1], [13, 14, 1]);
    const g = P().graph(15, edges);
    const fa = P().forceAtlas2(g, { seed: 5 });
    const pos = P().packComponents(g, Float64Array.from(fa));
    const pieces = [[0, 1, 2, 3, 4, 5, 6, 7], [8, 9, 10], [11, 12], [13, 14]];
    const d = (p, i, j) => Math.hypot(p[2 * i] - p[2 * j], p[2 * i + 1] - p[2 * j + 1]);
    ok(pieces.every(list => list.every(i => list.every(j => Math.abs(d(pos, i, j) - d(fa, i, j)) < 1e-9))), 'distances inside each piece unchanged');
    const circle = list => {
      const cx = list.reduce((s, i) => s + pos[2 * i], 0) / list.length, cy = list.reduce((s, i) => s + pos[2 * i + 1], 0) / list.length;
      return { cx, cy, r: Math.max(...list.map(i => Math.hypot(pos[2 * i] - cx, pos[2 * i + 1] - cy))) };
    };
    const c = pieces.map(circle);
    near(c[0].cx, 0, 1e-9, 'the largest piece at the centre'); near(c[0].cy, 0, 1e-9);
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ok(Math.hypot(c[a].cx - c[b].cx, c[a].cy - c[b].cy) >= c[a].r + c[b].r - 1e-9, 'pieces ' + a + ' and ' + b + ' do not overlap');
    const span = p => { const xs = [], ys = []; for (let i = 0; i < 15; i++) { xs.push(p[2 * i]); ys.push(p[2 * i + 1]); } return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); };
    ok(span(pos) < 4 * 2 * c[0].r, 'the drawing is not much wider than the main piece: ' + span(pos).toFixed(1) + ' vs ' + (2 * c[0].r).toFixed(1) + ' (before ' + span(fa).toFixed(1) + ')');
    const one = P().graph(3, [[0, 1, 1], [1, 2, 1]]), p1 = P().forceAtlas2(one, { seed: 2 });
    deepEq([...P().packComponents(one, Float64Array.from(p1))], [...p1], 'a connected network is not moved');
  });

  it('circular layout: nodes on the unit circle in the order given', () => {
    const pos = P().circularLayout(4, [2, 0, 3, 1]);
    near(pos[4], 0, 1e-12); near(pos[5], -1, 1e-12, 'first in the order at the top');
    near(pos[0], 1, 1e-12); near(pos[1], 0, 1e-12);
    ok([0, 1, 2, 3].every(i => Math.abs(Math.hypot(pos[2 * i], pos[2 * i + 1]) - 1) < 1e-12));
  });

  it('the whole analysis of a small collection runs in a worker from file:// and gives the same result as in the page', async () => {
    const lists = [['maize', 'landraces', 'diversity'], ['maize', 'diversity'], ['maize', 'landraces'], ['seed banks', 'conservation'], ['seed banks', 'conservation', 'maize'], ['conservation', 'diversity']];
    const inc = P().incidence(lists, { minFreq: 2 });
    const opts = { normalization: 'association', minEdge: 1, removeIsolated: true, seed: 3, iterations: 200 };
    const here = P().networkAnalysis(inc, opts);
    const there = await Work.run({ fns: window.PARSER_PARTS, payload: { inc, opts }, main: function (p, progress) { const Q = {}; for (const name in __fns) __fns[name](Q); return Q.networkAnalysis(p.inc, p.opts, progress); } });
    deepEq(there.edges, here.edges);
    deepEq([...there.positions], [...here.positions]);
    deepEq([...there.metrics.betweenness], [...here.metrics.betweenness]);
    eq(here.nodes.length, 5); eq(here.metrics.stats.edges, here.edges.length);
  });
});

/* two topics (maize, pollination) joined by one document; expected values worked out by hand */
function networkDataset() {
  const P = Parsers.lib();
  const rec = (title, year, tc, kws) => P.finish(Object.assign(P.newRecord(), { title, year, timesCited: tc, docTypeRaw: 'Article', sourceTitle: 'Econ Bot', authors: [P.person('Lira, R.')], authorKeywords: kws }));
  return [
    rec('Maize landraces and their genetic diversity in the highlands', 2015, 12, ['maize', 'landraces', 'genetic diversity']),
    rec('Domestication of maize in central Mesoamerica', 2016, 30, ['maize', 'domestication', 'genetic diversity']),
    rec('Landraces conserved on farm by indigenous communities', 2017, 4, ['landraces', 'domestication', 'maize']),
    rec('Population structure of native corn varieties', 2018, 7, ['genetic diversity', 'landraces']),
    rec('Native bees visiting squash flowers at dawn', 2019, 9, ['bees', 'squash', 'flowers', 'pollination']),
    rec('Pollination of cultivated squash by solitary bees', 2020, 3, ['pollination', 'bees', 'squash']),
    rec('Floral traits that attract pollinators in cucurbits', 2021, 1, ['flowers', 'pollination']),
    rec('Visits of bumblebees to pumpkin blossoms', 2022, 0, ['squash', 'flowers', 'bees']),
    rec('Maize and squash grown together in the milpa system', 2023, 5, ['maize', 'squash']),
    rec('A note without keywords on seed storage', 2024, 0, []),
  ];
}

describe('networks · conceptual structure screen', () => {
  const card = key => el('cnStats').querySelector(`[data-key="${key}"]`);
  const value = key => card(key).querySelector('.metric-value').textContent;
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('termField'); };
  const change = (id, v) => { const s = el(id); s.value = String(v); s.dispatchEvent(new Event('change')); };
  const view = () => ConceptualModule.view;
  const index = label => view().state.nodes.findIndex(n => n.label === label);

  it('the network of a small collection: statistics with the modularity, two communities and the view', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    ConceptualModule.params = null; ConceptualModule._net = null; ConceptualModule.selectedKey = null; ConceptualModule.figs = {};
    const records = networkDataset();
    ImportModule.addResult({ name: 'net.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    eq(Pipeline.records().length, 10, 'no duplicates merged');
    location.hash = '#/conceptual';
    App.render('conceptual');
    ok(el('cnPending') || el('cnStats'), 'waiting or ready');
    await ConceptualModule.pending;
    ok(el('cnStats'), 'statistics');
    deepEq(['nodes', 'communities', 'diameter'].map(value), ['8', '2', '3']);
    ok(/^0\.\d{3}$/.test(value('modularity')), 'modularity shown next to the network: ' + value('modularity'));
    near(+value('modularity'), ConceptualModule.current.comm.q1, 5e-4);
    ok(el('cnView').querySelector('canvas'), 'canvas');
    eq(view().state.nodes.length, 8);
    const col = l => view().state.nodes[index(l)].color;
    ok(col('maize') === col('landraces') && col('bees') === col('squash') && col('maize') !== col('bees'), 'one colour per topic');
    ok(view().draw() >= 0 && view().state.labelsDrawn >= 6, 'labels drawn: ' + view().state.labelsDrawn);
  });

  it('search and click on a node: neighbours are highlighted and its card shows metrics and documents', () => {
    eq(view().search('mai'), index('maize'), 'partial search');
    ok(!el('cnNode').hidden, 'node card');
    ok(el('cnNode').textContent.includes('Aparece en 4 documentos'), 'documents');
    const neighbours = [...el('cnNode').querySelectorAll('.net-node-list button')].map(b => b.textContent);
    deepEq(neighbours.slice().sort(), ['domestication', 'genetic diversity', 'landraces', 'squash'].sort());
    ok(view().state.neighbours.has(index('squash')) && !view().state.neighbours.has(index('bees')), 'neighbours of maize');
    eq(el('cnNode').querySelector('.net-doc-title').textContent, 'Domestication of maize in central Mesoamerica', 'most cited first');
    App.render('conceptual');
    ok(!el('cnNode').hidden && view().state.selected === index('maize'), 'the selection survives a redraw');
    el('cnNodeClose').click();
    ok(el('cnNode').hidden && view().state.selected === -1, 'cleared');
    eq(view().search('no such term'), -1);
  });

  it('criterion: the resolution and the normalisation change the communities; the circular layout keeps them', async () => {
    change('cnParams-resolution', 0.1);
    const low = +value('communities');
    ok(low <= 2, 'a low resolution never splits more: ' + low);
    ok(el('cnStats').textContent.includes('con resolución γ = 0.1'), 'Qγ shown');
    change('cnParams-resolution', 3);
    ok(+value('communities') >= 3 && +value('communities') > low, 'a high resolution splits the topics: ' + value('communities'));
    change('cnParams-resolution', 1);
    eq(value('communities'), '2');
    change('cnParams-algorithm', 'fastgreedy');
    eq(value('communities'), '2');
    change('cnParams-algorithm', 'louvain');
    change('cnParams-normalization', 'none');
    await ConceptualModule.pending;
    ok(ConceptualModule.current.data.edges.every(e => e[3] === e[2]), 'weights are counts without normalisation');
    change('cnParams-normalization', 'jaccard');
    await ConceptualModule.pending;
    ok(ConceptualModule.current.data.edges.every(e => e[3] > 0 && e[3] <= 1), 'Jaccard between 0 and 1');
    change('cnParams-layout', 'circular');
    const pos = view().state.pos;
    ok([...Array(8).keys()].every(i => Math.abs(Math.hypot(pos[2 * i], pos[2 * i + 1]) - 1) < 1e-9), 'nodes on a circle');
    change('cnParams-layout', 'fa2');
    change('cnParams-minEdge', 3);
    await ConceptualModule.pending;
    eq(value('nodes'), '2', 'only bees and squash appear together in three documents');
    change('cnParams-minEdge', 1);
    change('cnParams-normalization', 'association');
    await ConceptualModule.pending;
    eq(value('nodes'), '8');
  });

  it('figure for publication and the tables of nodes, communities and edges', () => {
    const svg = el('cnFigure').querySelector('svg');
    eq(svg.querySelectorAll('[data-series="nodes"] circle').length, 8);
    ok(svg.querySelector('[data-legend]'), 'legend of communities');
    eq(el('cnNodes').querySelectorAll('tbody tr').length, 8);
    eq(el('cnCommunities').querySelectorAll('tbody tr').length, 2);
    eq(el('cnEdges').querySelectorAll('tbody tr').length, ConceptualModule.current.data.edges.length);
    const m = ConceptualModule.cc.cnFigure.dataMatrix();
    eq(m.length, 9);
    const maize = m.find(r => r[0] === 'maize');
    eq(maize[3], 4, 'frequency');
    eq(maize[4], 4, 'degree');
  });

  it('every help has a definition, a formula and its reference; no visible text outside the dictionaries', () => {
    const data = new Set(['maize', 'landraces', 'genetic diversity', 'domestication', 'bees', 'squash', 'flowers', 'pollination']);
    networkDataset().forEach(r => data.add(r.title));
    const problems = [], bad = [];
    view().search('maize');
    ['es', 'en'].forEach(lang => {
      I18N.setLang(lang);
      App.render('conceptual');
      const engine = s => lang === 'en' && typeof I18N_DICT.es.phrases[s] === 'string';
      strayTexts(el('view'), lang).filter(s => !data.has(s) && !engine(s) && ![...data].some(d => s.includes(d))).forEach(s => problems.push(lang + ': ' + s));
    });
    I18N.setLang('es');
    App.render('conceptual');
    const buttons = [...el('view').querySelectorAll('.conceptual-page .help-btn')];
    buttons.forEach((b, i) => {
      b.click();
      const pop = document.querySelector('.help-pop');
      if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li') || pop.querySelector('.help-body p').textContent.length < 30) bad.push('#' + i);
      HelpPopover.close();
    });
    ok(buttons.length >= 14, 'helps: ' + buttons.length);
    deepEq({ problems, bad }, { problems: [], bad: [] });
  });

  it('criterion: a network of 300 nodes draws and moves fluidly', () => {
    const P = Parsers.lib();
    const edges = NetBrute.randomGraph(300, 300, 0.02, true);
    const g = P.graph(300, edges);
    const t0 = performance.now();
    const pos = P.forceAtlas2(g, { seed: 1 });
    const layoutMs = performance.now() - t0;
    let maxW = 0;
    for (const e of edges) maxW = Math.max(maxW, e[2]);
    const host = mk('div', { style: 'width:900px' });
    document.body.appendChild(host);
    const v = NetworkView.create({ nodes: Array.from({ length: 300 }, (x, i) => ({ label: 'term ' + i, value: g.degree[i], color: Fig.color('scimetrics', i % 7) })), edges: edges.map(e => [e[0], e[1], e[2] / maxW]), positions: pos, labelCount: 30 });
    host.appendChild(v.el);
    v.resize();
    const times = [];
    for (let k = 0; k < 20; k++) {
      if (k % 4 === 0) v.zoomBy(1.15, 300, 200); else { v.state.tx += 7; v.state.ty -= 5; }
      times.push(v.draw());
    }
    v.select(0, true);
    times.push(v.draw());
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    v.destroy();
    host.remove();
    ok(mean < 16, '300 nodes, ' + edges.length + ' edges: ' + mean.toFixed(1) + ' ms per frame (layout ' + Math.round(layoutMs) + ' ms)');
    ok(layoutMs < 3000, 'layout of 300 nodes in ' + Math.round(layoutMs) + ' ms');
  });

  it('a label of a node at the right edge of the view is written to its left, whole', () => {
    const host = mk('div', { style: 'width:600px' });
    document.body.appendChild(host);
    const v = NetworkView.create({ nodes: [{ label: 'a', value: 1, color: '#1d5bb0' }, { label: 'A rather long label, Kondo T.', value: 2, color: '#e39b2d' }], edges: [], positions: Float64Array.from([0, 0, 10, 0]), labelCount: 5 });
    host.appendChild(v.el);
    v.resize();
    const proto = CanvasRenderingContext2D.prototype, fill = proto.fillText, drawn = [];
    proto.fillText = function (text, x) { drawn.push({ text, x, w: this.measureText(text).width }); return fill.apply(this, arguments); };
    try { v.draw(); } finally { proto.fillText = fill; }
    const long = drawn.find(d => d.text.startsWith('A rather'));
    ok(long && long.x >= 0 && long.x + long.w <= v.state.width, 'inside the canvas: ' + JSON.stringify(long) + ' width ' + v.state.width);
    v.destroy();
    host.remove();
  });

  it('criterion: the network figure exports to PNG (300 dpi) and SVG', async () => {
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    try {
      const buttons = ConceptualModule.cc.cnFigure.el.querySelectorAll('.chart-actions button');
      buttons[0].click(); buttons[1].click();
      for (let i = 0; i < 150 && got.length < 2; i++) await tick(30);
    } finally { window.download = saved; }
    eq(got.length, 2);
    const png = got.find(x => x.name.endsWith('.png'));
    const b = new Uint8Array(await png.blob.arrayBuffer());
    let ppm = null;
    for (let i = 8; i < b.length - 12; i++) if (b[i] === 0x70 && b[i + 1] === 0x48 && b[i + 2] === 0x59 && b[i + 3] === 0x73) { ppm = (b[i + 4] << 24 | b[i + 5] << 16 | b[i + 6] << 8 | b[i + 7]) >>> 0; break; }
    eq(ppm, 11811);
    const doc = new DOMParser().parseFromString(await got.find(x => x.name.endsWith('.svg')).blob.text(), 'image/svg+xml');
    ok(!doc.querySelector('parsererror'), 'svg parses');
    reset();
    await Pipeline.pending;
  });
});
