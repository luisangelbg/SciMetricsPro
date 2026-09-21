/* SciMetricsPro — networks: thematic map and thematic evolution.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Themes: communities (Louvain) of the co-occurrence network normalised by association strength.
   · Callon centrality = 10 × Σ weights of the edges between the theme's words and words of other themes;
     Callon density = 100 × Σ weights of the edges inside the theme / number of words of the theme.
     Callon M, Courtial JP, Laville F (1991) Scientometrics 22(1):155–205.
   · Strategic diagram with axes at the median of centrality and density (Cobo MJ, López-Herrera AG,
     Herrera-Viedma E, Herrera F 2011, Journal of Informetrics 5(1):146–166):
       centrality ≥ median, density ≥ median → motor themes;  centrality < median, density ≥ median → niche themes;
       centrality < median, density < median → emerging or declining themes;  centrality ≥ median, density < median → basic themes.
   · Thematic evolution: one thematic map per period and links between themes of consecutive periods weighted by the
     inclusion index = shared words / min(words of both themes) (Cobo et al. 2011). */
'use strict';

function smpThematic(P) {
  P.QUADRANTS = ['motor', 'niche', 'emerging', 'basic'];

  P.quadrantOf = function (centrality, density, medC, medD) {
    const high = centrality >= medC, dense = density >= medD;
    return high ? (dense ? 'motor' : 'basic') : (dense ? 'niche' : 'emerging');
  };

  /* inc: P.incidence of the documents; opts: { minEdge (1), resolution (1), minClusterWords (2), labelWords (3) }
     → { nodes, edges, membership, communities, modularity, clusters: [{ id, words: [node indices, most frequent first],
         keys, freq, internal, external, centrality, density, quadrant, label }], medianCentrality, medianDensity } */
  P.thematicMap = function (inc, opts) {
    opts = opts || {};
    const net = P.buildNetwork(inc, { normalization: 'association', minEdge: opts.minEdge || 1, removeIsolated: true });
    const n = net.nodes.length;
    const g = P.graph(n, net.edges);
    const L = P.louvain(g, { resolution: opts.resolution == null ? 1 : opts.resolution });
    const k = L.communities;
    const internal = new Float64Array(k), external = new Float64Array(k);
    for (const e of net.edges) {
      const a = L.membership[e[0]], b = L.membership[e[1]];
      if (a === b) internal[a] += e[3];
      else { external[a] += e[3]; external[b] += e[3]; }
    }
    const members = Array.from({ length: k }, () => []);
    net.nodes.forEach((nd, i) => members[L.membership[i]].push(i));
    const minWords = Math.max(1, opts.minClusterWords == null ? 2 : +opts.minClusterWords);
    const labelWords = Math.max(1, opts.labelWords || 3);
    let clusters = members.map((list, c) => {
      const words = list.slice().sort((x, y) => net.nodes[y].freq - net.nodes[x].freq || (net.nodes[x].key < net.nodes[y].key ? -1 : 1));
      return {
        community: c, words, keys: words.map(i => net.nodes[i].key),
        freq: words.reduce((s, i) => s + net.nodes[i].freq, 0),
        internal: internal[c], external: external[c],
        centrality: 10 * external[c], density: 100 * internal[c] / words.length,
      };
    }).filter(c => c.words.length >= minWords);
    const medC = clusters.length ? P.median(clusters.map(c => c.centrality)) : 0;
    const medD = clusters.length ? P.median(clusters.map(c => c.density)) : 0;
    clusters.sort((a, b) => b.freq - a.freq || a.community - b.community);
    clusters.forEach((c, i) => {
      c.id = i;
      c.quadrant = P.quadrantOf(c.centrality, c.density, medC, medD);
      c.labelKeys = c.keys.slice(0, labelWords);
    });
    return { nodes: net.nodes, edges: net.edges, membership: L.membership, communities: k, modularity: L.modularity, clusters, medianCentrality: medC, medianDensity: medD };
  };

  /* documents of each theme: a document belongs to the theme with most of its words (ties: the more frequent theme)
     → { byDoc: [theme id | -1], matched: [[words matched]], counts: [documents with at least one word per theme] } */
  P.themeDocuments = function (lists, clusters) {
    const themeOf = new Map();
    clusters.forEach(c => c.keys.forEach(k => themeOf.set(k, c.id)));
    const counts = new Array(clusters.length).fill(0);
    const byDoc = [], matched = [];
    for (const list of lists) {
      const hits = new Map(), words = [];
      for (const k of list) { const t = themeOf.get(k); if (t !== undefined) { hits.set(t, (hits.get(t) || 0) + 1); words.push(k); } }
      let best = -1, bn = 0;
      for (const [t, v] of hits) { counts[t]++; if (v > bn || (v === bn && t < best)) { best = t; bn = v; } }
      byDoc.push(best);
      matched.push(best >= 0 ? words.filter(w => themeOf.get(w) === best) : []);
    }
    return { byDoc, matched, counts };
  };

  /* cut years → periods [first … cut₁], [cut₁ + 1 … cut₂] … [last cut + 1 … last year]; cuts outside the span are ignored */
  P.periodsFromCuts = function (years, cuts) {
    const ys = years.filter(y => y != null && isFinite(y));
    if (!ys.length) return [];
    let y0 = Infinity, y1 = -Infinity;
    for (const y of ys) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const valid = [...new Set((cuts || []).map(c => parseInt(c, 10)).filter(c => isFinite(c) && c >= y0 && c < y1))].sort((a, b) => a - b).slice(0, 4);
    const periods = [];
    let from = y0;
    for (const c of valid) { periods.push({ from, to: c }); from = c + 1; }
    periods.push({ from, to: y1 });
    return periods;
  };

  P.inclusionIndex = function (a, b) {
    if (!a.length || !b.length) return { shared: [], inclusion: 0 };
    const set = new Set(b);
    const shared = a.filter(k => set.has(k));
    return { shared, inclusion: shared.length / Math.min(a.length, b.length) };
  };

  /* years: publication year per document; lists: terms per document; cuts: up to 4 cut years
     opts: { minFreq, maxItems, minEdge, resolution, minClusterWords, labelWords, minInclusion }
     → { periods: [{ from, to, docs, map }], links: [{ period, from, to, shared, inclusion }] } */
  P.thematicEvolution = function (years, lists, cuts, opts) {
    opts = opts || {};
    const periods = P.periodsFromCuts(years, cuts).map(p => {
      const sub = [];
      years.forEach((y, i) => { if (y != null && y >= p.from && y <= p.to) sub.push(lists[i]); });
      const inc = P.incidence(sub, { minFreq: opts.minFreq, maxItems: opts.maxItems });
      return Object.assign(p, { docs: sub.length, map: P.thematicMap(inc, opts) });
    });
    const minInclusion = opts.minInclusion || 0;
    const links = [];
    for (let p = 0; p + 1 < periods.length; p++) {
      for (const a of periods[p].map.clusters) {
        for (const b of periods[p + 1].map.clusters) {
          const r = P.inclusionIndex(a.keys, b.keys);
          if (r.shared.length && r.inclusion >= minInclusion) links.push({ period: p, from: a.id, to: b.id, shared: r.shared, inclusion: r.inclusion });
        }
      }
    }
    return { periods, links };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpThematic);
