/* SciMetricsPro — networks: document × item incidence, co-occurrence and coupling, normalisation and filters.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Incidence: a sparse document × item matrix A, one list of item indices per document (each item once).
     The same matrix serves every relation: A^T A gives co-occurrence (keywords), collaboration (authors,
     institutions, countries) or co-citation (cited references); A A^T gives bibliographic coupling (documents
     that share references; units such as authors or sources are coupled by joining the lists of their documents).
   · Normalisation of a count c_ij between items with occurrences c_i and c_j:
       association strength  c_ij / (c_i c_j)                van Eck NJ, Waltman L (2009) JASIST 60(8):1635–1651
       cosine (Salton)       c_ij / √(c_i c_j)                Salton G, McGill MJ (1983) Introduction to Modern Information Retrieval
       Jaccard               c_ij / (c_i + c_j − c_ij)        Jaccard P (1901) Bull Soc Vaud Sci Nat 37:547–579
       inclusion index       c_ij / min(c_i, c_j)             Callon M, Courtial JP, Laville F (1991) Scientometrics 22(1):155–205
       equivalence index     c_ij² / (c_i c_j)                Callon et al. (1991)
   · Graph: compressed adjacency (offsets, neighbours, weights), each undirected edge stored in both directions. */
'use strict';

function smpNetBuild(P) {
  P.NORMALIZATIONS = ['none', 'association', 'salton', 'jaccard', 'inclusion', 'equivalence'];

  P.normalizeCount = function (c, ci, cj, method) {
    if (!(c > 0)) return 0;
    switch (method) {
      case 'association': return ci > 0 && cj > 0 ? c / (ci * cj) : 0;
      case 'salton': return ci > 0 && cj > 0 ? c / Math.sqrt(ci * cj) : 0;
      case 'jaccard': return ci + cj - c > 0 ? c / (ci + cj - c) : 0;
      case 'inclusion': return Math.min(ci, cj) > 0 ? c / Math.min(ci, cj) : 0;
      case 'equivalence': return ci > 0 && cj > 0 ? (c * c) / (ci * cj) : 0;
      default: return c;
    }
  };

  /* lists: per document, the keys of its items (repeated keys count once).
     opts: { minFreq (documents, default 1), maxItems (default all) }
     → { items: [{ key, freq }] (most frequent first, ties by key), docs: [[item indices]] (one per document, sorted) } */
  P.incidence = function (lists, opts) {
    opts = opts || {};
    const minFreq = Math.max(1, +opts.minFreq || 1);
    const freq = new Map();
    for (const list of lists) {
      const seen = new Set();
      for (const k of list || []) {
        if (k == null || k === '' || seen.has(k)) continue;
        seen.add(k);
        freq.set(k, (freq.get(k) || 0) + 1);
      }
    }
    let items = [...freq.entries()].filter(e => e[1] >= minFreq).map(([key, f]) => ({ key, freq: f }));
    items.sort((a, b) => b.freq - a.freq || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    if (opts.maxItems > 0 && items.length > opts.maxItems) items = items.slice(0, opts.maxItems);
    const index = new Map(items.map((it, i) => [it.key, i]));
    const docs = lists.map(list => {
      const out = [];
      for (const k of list || []) { const i = index.get(k); if (i !== undefined && !out.includes(i)) out.push(i); }
      return out.sort((a, b) => a - b);
    });
    return { items, docs };
  };

  /* A^T A without the diagonal: pairs of items that appear in the same documents → [[i, j, count]] with i < j */
  P.cooccurrence = function (docs, nItems) {
    const counts = new Map();
    const n = Math.max(1, nItems);
    for (const d of docs) {
      for (let a = 0; a < d.length; a++) {
        for (let b = a + 1; b < d.length; b++) {
          const i = Math.min(d[a], d[b]), j = Math.max(d[a], d[b]);
          if (i === j) continue;
          const key = i * n + j;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }
    const edges = [];
    for (const [key, c] of counts) edges.push([Math.floor(key / n), key % n, c]);
    edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    return edges;
  };

  /* A A^T without the diagonal: pairs of rows (documents or units) that share items → [[a, b, shared]] with a < b */
  P.coupling = function (rows, nItems) {
    const byItem = [];
    for (let i = 0; i < nItems; i++) byItem.push([]);
    rows.forEach((row, r) => { for (const i of row) if (i >= 0 && i < nItems && byItem[i][byItem[i].length - 1] !== r) byItem[i].push(r); });
    return P.cooccurrence(byItem, rows.length);
  };

  /* incidence → network with normalised weights and filters.
     opts: { normalization, minEdge (minimum count of an edge, default 1), removeIsolated (default true) }
     → { nodes: [{ item (index in inc.items), key, freq }], edges: [[s, t, count, weight]] } (node indices renumbered) */
  P.buildNetwork = function (inc, opts) {
    opts = opts || {};
    const method = opts.normalization || 'none';
    const minEdge = Math.max(1, +opts.minEdge || 1);
    const raw = P.cooccurrence(inc.docs, inc.items.length).filter(e => e[2] >= minEdge);
    const used = new Uint8Array(inc.items.length);
    for (const e of raw) { used[e[0]] = 1; used[e[1]] = 1; }
    const keep = [];
    inc.items.forEach((it, i) => { if (opts.removeIsolated === false || used[i]) keep.push(i); });
    const newIndex = new Int32Array(inc.items.length).fill(-1);
    keep.forEach((i, k) => { newIndex[i] = k; });
    const nodes = keep.map(i => ({ item: i, key: inc.items[i].key, freq: inc.items[i].freq }));
    const edges = raw.map(([i, j, c]) => [newIndex[i], newIndex[j], c, P.normalizeCount(c, inc.items[i].freq, inc.items[j].freq, method)])
      .filter(e => e[0] >= 0 && e[1] >= 0 && e[3] > 0);
    return { nodes, edges };
  };

  /* compressed undirected graph from [[s, t, count, weight]] (weight = 4th value, or the 3rd when there is no 4th) */
  P.graph = function (n, edges) {
    const deg = new Int32Array(n);
    for (const e of edges) { deg[e[0]]++; deg[e[1]]++; }
    const offsets = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + deg[i];
    const nbr = new Int32Array(offsets[n]), wt = new Float64Array(offsets[n]);
    const fill = offsets.slice(0, n);
    const strength = new Float64Array(n);
    let total = 0;
    for (const e of edges) {
      const s = e[0], t = e[1], w = e.length > 3 ? e[3] : e[2];
      nbr[fill[s]] = t; wt[fill[s]++] = w;
      nbr[fill[t]] = s; wt[fill[t]++] = w;
      strength[s] += w; strength[t] += w;
      total += w;
    }
    return { n, m: edges.length, offsets, nbr, wt, degree: deg, strength, totalWeight: total };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpNetBuild);
