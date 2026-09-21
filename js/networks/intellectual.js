/* SciMetricsPro — networks: intellectual structure. Co-citation of cited references, cited first authors and cited
   sources; bibliographic coupling of documents, authors and sources; the coupling map; the direct citation historiograph.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Co-citation: two cited items are co-cited when one document cites both. C = AᵀA, with A the document × cited
     item matrix (each item once per citing document). Small H (1973) Journal of the American Society for Information
     Science 24(4):265–269; cited first authors: White HD, Griffith BC (1981) JASIS 32(3):163–171; cited sources:
     McCain KW (1991) JASIS 42(4):290–296. Cited works are the reference clusters of P.referenceClusters; cited first
     authors are joined by surname and first initial; cited sources by their words, and an abbreviation joins the full
     title when every fuller compatible spelling is the same source ("J Ecol" = "Journal of Ecology").
   · Bibliographic coupling: two units are coupled when they cite the same works. B = A Aᵀ, every unit with the set of
     works cited by its documents. Kessler MM (1963) American Documentation 14(1):10–25; authors and sources:
     Zhao D, Strotmann A (2008) JASIST 59(13):2070–2086. Salton's cosine b_ab / √(r_a r_b), r = distinct works cited by
     the unit (Salton G, McGill MJ 1983, Introduction to Modern Information Retrieval).
   · Coupling map: communities (Louvain) of the coupling network. Callon centrality = 10 × Σ weights of the edges that
     leave the cluster (Callon M, Courtial JP, Laville F 1991, Scientometrics 22(1):155–205); impact = mean normalised
     citation score of the cluster's documents (citations / mean citations of the collection's documents of the same
     year, global or local); labels = the terms with the highest frequency × confidence in the cluster (documents of the
     cluster with the term² / documents of the collection with the term). Axes at the medians. Aria M, Misuraca M,
     Spano M (2020) Social Indicators Research 149(3):803–831.
   · Historiograph: the documents most cited inside the collection and the direct citations among them, placed by
     publication year. Garfield E (2004) Journal of Information Science 30(2):119–145. A citation to a document
     published after the citing one cannot run from past to present and is left out (online and print years); within
     one year a citation that would close a cycle is left out too. The order inside each year reduces crossings with
     barycentres: Sugiyama K, Tagawa S, Toda M (1981) IEEE Transactions on Systems, Man, and Cybernetics 11(2):109–125. */
'use strict';

function smpIntellectual(P) {
  P.CITED_UNITS = ['references', 'authors', 'sources'];
  P.COUPLING_UNITS = ['documents', 'authors', 'sources'];

  const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const caseScore = s => (s === s.toUpperCase() ? 0 : s === s.toLowerCase() ? 1 : 2);
  /* the spelling with mixed case first, then the most used, then alphabetical */
  const bestSpelling = m => [...m.entries()].sort((a, b) => caseScore(b[0]) - caseScore(a[0]) || b[1] - a[1] || byKey(a[0], b[0]))[0][0];

  /* ---------------- co-citation ---------------- */

  /* "Lira R.", "LIRA R", "Lira, R.A." → 'lira|r'; '' without a surname */
  P.citedAuthorKey = function (name) {
    const p = P.refAuthorParts(name);
    return p.surname ? p.surname + '|' + p.initials.charAt(0) : '';
  };

  /* counts: Map(spelling of a cited source → weight) → { groupOf: Map(spelling → key), labels: Map(key → label),
     spellings: Map(key → [spellings]), joined (spellings with other words joined to a fuller one) } */
  P.citedSourceGroups = function (counts) {
    const byWords = new Map();
    for (const [spelling, n] of counts) {
      const words = P.sourceWords(spelling);
      if (!words.length) continue;
      const key = words.join(' ');
      let g = byWords.get(key);
      if (!g) { g = { key, words, letters: words.join(''), spellings: new Map() }; byWords.set(key, g); }
      g.spellings.set(spelling, (g.spellings.get(spelling) || 0) + n);
    }
    const groups = [...byWords.values()].sort((a, b) => b.letters.length - a.letters.length || byKey(a.key, b.key));
    const parent = new Map(groups.map(g => [g.key, g.key]));
    const find = k => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
    /* the fuller spelling stays as the root */
    const join = (full, short) => { const a = find(full.key), b = find(short.key); if (a !== b) parent.set(b, a); };
    const byLetters = new Map();
    for (const g of groups) { const o = byLetters.get(g.letters); if (o) join(o, g); else byLetters.set(g.letters, g); }
    /* compatible spellings have the same number of words and the same initial letters */
    const buckets = new Map();
    for (const g of groups) {
      const b = g.words.length + '|' + g.words.map(w => w.charAt(0)).join('');
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(g);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      for (const g of list) {
        const fuller = list.filter(h => h.letters.length > g.letters.length && P.sourceWordsMatch(g.words, h.words));
        if (!fuller.length) continue;
        const top = fuller[0];
        if (fuller.every(h => h === top || P.sourceWordsMatch(h.words, top.words))) join(top, g);
      }
    }
    const members = new Map();
    for (const g of groups) {
      const root = find(g.key);
      if (!members.has(root)) members.set(root, []);
      members.get(root).push(g);
    }
    const groupOf = new Map(), labels = new Map(), spellings = new Map();
    let joined = 0;
    for (const [root, list] of members) {
      /* named after the fullest spelling */
      const fullest = list.slice().sort((a, b) => b.letters.length - a.letters.length || byKey(a.key, b.key))[0];
      labels.set(root, bestSpelling(fullest.spellings));
      const all = [];
      list.forEach(g => { for (const s of g.spellings.keys()) { groupOf.set(s, root); all.push(s); } });
      spellings.set(root, all);
      joined += list.length - 1;
    }
    return { groupOf, labels, spellings, joined };
  };

  /* the cited items of every document for co-citation, from P.referenceClusters
     unit 'references' → row indices of the clusters; 'authors' → first author keys; 'sources' → source keys
     → { lists: [[keys]], labels: Map(key → label) | null (references), keyOfRow: [key per cluster row], joined } */
  P.citedLists = function (clusters, unit) {
    const rows = clusters.rows;
    if (unit !== 'authors' && unit !== 'sources') return { lists: clusters.byDoc, labels: null, keyOfRow: rows.map((r, i) => i), joined: 0 };
    const keyOfRow = new Array(rows.length).fill('');
    let labels, joined = 0;
    if (unit === 'authors') {
      const spell = new Map();
      rows.forEach((row, i) => {
        const k = P.citedAuthorKey(row.firstAuthor);
        if (!k) return;
        keyOfRow[i] = k;
        if (!spell.has(k)) spell.set(k, new Map());
        const m = spell.get(k), s = P.clean(row.firstAuthor);
        m.set(s, (m.get(s) || 0) + row.citations);
      });
      labels = new Map([...spell].map(([k, m]) => [k, bestSpelling(m)]));
    } else {
      const counts = new Map();
      rows.forEach(row => { const s = P.clean(row.source); if (s) counts.set(s, (counts.get(s) || 0) + row.citations); });
      const G = P.citedSourceGroups(counts);
      rows.forEach((row, i) => { const s = P.clean(row.source); if (s && G.groupOf.has(s)) keyOfRow[i] = G.groupOf.get(s); });
      labels = G.labels;
      joined = G.joined;
    }
    const lists = clusters.byDoc.map(list => {
      const seen = new Set();
      for (const i of list) if (keyOfRow[i]) seen.add(keyOfRow[i]);
      return [...seen];
    });
    return { lists, labels, keyOfRow, joined };
  };

  /* ---------------- bibliographic coupling ---------------- */

  /* units that cite something and the works they cite
     local: local citations per record (P.localCitations) or null
     → [{ key, label, docs: [record indices], refs: [cluster rows, ascending], citations (sum of known global citations | null), local }] */
  P.couplingUnits = function (records, clusters, local, unit) {
    const units = new Map();
    const add = (key, label, i) => {
      let u = units.get(key);
      if (!u) { u = { key, label, docs: [] }; units.set(key, u); }
      if (u.docs[u.docs.length - 1] !== i) u.docs.push(i);
    };
    records.forEach((r, i) => {
      if (!clusters.byDoc[i] || !clusters.byDoc[i].length) return;
      if (unit === 'authors') {
        for (const a of r.authors) {
          const k = a.key || P.authorKey(a);
          if (k && k.charAt(0) !== '|') add(k, a.label || P.authorLabel(a), i);
        }
      } else if (unit === 'sources') {
        const k = r.sourceKey != null ? r.sourceKey : P.sourceKey(r.sourceTitle);
        if (k) add(k, P.clean(r.sourceName || r.sourceTitle), i);
      } else add('d' + i, P.documentLabel(r), i);
    });
    return [...units.values()].map(u => {
      const refs = new Set();
      let citations = null, loc = 0;
      for (const i of u.docs) {
        for (const x of clusters.byDoc[i]) refs.add(x);
        const tc = records[i].timesCited;
        if (tc != null && isFinite(tc)) citations = (citations || 0) + tc;
        if (local) loc += local[i];
      }
      return Object.assign(u, { refs: [...refs].sort((a, b) => a - b), citations, local: loc });
    });
  };

  /* the units that enter a coupling network: at least minDocs documents, then the most cited (global, then local citations,
     then documents), at most maxNodes */
  P.selectUnits = function (units, opts) {
    opts = opts || {};
    const minDocs = Math.max(1, +opts.minDocs || 1);
    const out = units.filter(u => u.docs.length >= minDocs);
    out.sort((a, b) => (b.citations == null ? -1 : b.citations) - (a.citations == null ? -1 : a.citations) || b.local - a.local || b.docs.length - a.docs.length || byKey(a.key, b.key));
    return opts.maxNodes > 0 ? out.slice(0, opts.maxNodes) : out;
  };

  /* units → { nodes: [{ item (unit index), key, freq (distinct works cited), docs, citations }], edges: [[a, b, shared, weight]] }
     opts: { normalization (salton), minEdge (shared works, 1), removeIsolated (true) } */
  P.couplingNetwork = function (units, opts) {
    opts = opts || {};
    const method = opts.normalization || 'salton';
    const minEdge = Math.max(1, +opts.minEdge || 1);
    let nItems = 0;
    for (const u of units) for (const x of u.refs) if (x + 1 > nItems) nItems = x + 1;
    const raw = P.coupling(units.map(u => u.refs), nItems).filter(e => e[2] >= minEdge);
    const used = new Uint8Array(units.length);
    for (const e of raw) { used[e[0]] = 1; used[e[1]] = 1; }
    const keep = [];
    units.forEach((u, i) => { if (opts.removeIsolated === false || used[i]) keep.push(i); });
    const newIndex = new Int32Array(units.length).fill(-1);
    keep.forEach((i, k) => { newIndex[i] = k; });
    const nodes = keep.map(i => ({ item: i, key: units[i].key, freq: units[i].refs.length, docs: units[i].docs.length, citations: units[i].citations }));
    const edges = raw.map(([a, b, c]) => [newIndex[a], newIndex[b], c, P.normalizeCount(c, units[a].refs.length, units[b].refs.length, method)])
      .filter(e => e[0] >= 0 && e[1] >= 0 && e[3] > 0);
    return { nodes, edges };
  };

  /* ---------------- coupling map ---------------- */

  /* per record: its citations / mean citations of the collection's records of the same year with a known value
     (null without a value or a year; 0 when that mean is 0) */
  P.normalizedCitationScores = function (records, values) {
    const byYear = new Map();
    records.forEach((r, i) => {
      const v = values[i];
      if (v == null || !isFinite(v) || r.year == null) return;
      const e = byYear.get(r.year) || { sum: 0, n: 0 };
      e.sum += v; e.n++;
      byYear.set(r.year, e);
    });
    return records.map((r, i) => {
      const v = values[i];
      if (v == null || !isFinite(v) || r.year == null) return null;
      const e = byYear.get(r.year);
      return e.sum > 0 ? v / (e.sum / e.n) : 0;
    });
  };

  /* terms of a cluster ranked by frequency × confidence = (documents of the cluster with the term)² / documents of the collection */
  P.clusterTerms = function (docs, lists, totals) {
    const m = new Map();
    for (const i of docs) for (const k of new Set(lists[i] || [])) m.set(k, (m.get(k) || 0) + 1);
    const rank = min => [...m].filter(e => e[1] >= min).map(([key, c]) => ({ key, inCluster: c, total: totals.get(key), score: c * c / totals.get(key) }))
      .sort((a, b) => b.score - a.score || b.inCluster - a.inCluster || byKey(a.key, b.key));
    const out = docs.length >= 2 ? rank(2) : [];
    return out.length ? out : rank(1);
  };

  /* units (selected), records, lists: terms per record, scores: normalised citation score per record
     opts: { normalization (salton), minEdge (1), resolution (1), minClusterSize (2), labelTerms (3) }
     → { nodes, edges, membership, communities, modularity, clusters: [{ id, community, units: [node indices, most cited first],
         docs: [record indices], size, internal, external, centrality, impact, scored, quadrant, terms, labelKeys }],
         medianCentrality, medianImpact } */
  P.couplingMap = function (units, records, lists, scores, opts) {
    opts = opts || {};
    const net = P.couplingNetwork(units, { normalization: opts.normalization || 'salton', minEdge: opts.minEdge, removeIsolated: true });
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
    const totals = new Map();
    for (const list of lists) for (const key of new Set(list || [])) totals.set(key, (totals.get(key) || 0) + 1);
    const members = Array.from({ length: k }, () => []);
    net.nodes.forEach((nd, i) => members[L.membership[i]].push(i));
    const minSize = Math.max(1, opts.minClusterSize == null ? 2 : +opts.minClusterSize);
    const labelTerms = Math.max(1, opts.labelTerms || 3);
    const cite = i => (net.nodes[i].citations == null ? -1 : net.nodes[i].citations);
    let clusters = members.map((list, c) => {
      const ordered = list.slice().sort((a, b) => cite(b) - cite(a) || byKey(net.nodes[a].key, net.nodes[b].key));
      const docSet = new Set();
      for (const i of ordered) for (const d of units[net.nodes[i].item].docs) docSet.add(d);
      const docs = [...docSet].sort((a, b) => a - b);
      let sum = 0, scored = 0;
      for (const d of docs) if (scores[d] != null) { sum += scores[d]; scored++; }
      return {
        community: c, units: ordered, docs, size: docs.length, internal: internal[c], external: external[c],
        centrality: 10 * external[c], impact: scored ? sum / scored : 0, scored,
      };
    }).filter(c => c.units.length >= minSize);
    const medC = clusters.length ? P.median(clusters.map(c => c.centrality)) : 0;
    const medI = clusters.length ? P.median(clusters.map(c => c.impact)) : 0;
    clusters.sort((a, b) => b.size - a.size || b.units.length - a.units.length || a.community - b.community);
    clusters.forEach((c, i) => {
      c.id = i;
      c.quadrant = P.quadrantOf(c.centrality, c.impact, medC, medI);
      c.terms = P.clusterTerms(c.docs, lists, totals);
      c.labelKeys = c.terms.slice(0, labelTerms).map(x => x.key);
    });
    return { nodes: net.nodes, edges: net.edges, membership: L.membership, communities: k, modularity: L.modularity, clusters, medianCentrality: medC, medianImpact: medI };
  };

  /* ---------------- historiograph ---------------- */

  /* records, lc: P.localCitations ({ local, cites }); opts: { maxNodes (30), minLocal (1; 0 also takes documents that only cite), removeIsolated (false) }
     candidates: at least minLocal local citations, the most cited first (ties: documents citing others in the collection, then global citations)
     → { nodes: [{ index, year, local, global, layer, order, size (documents in the layer), y (0–1), component }],
         links: [{ from, to, status: 'kept' | 'later' | 'cycle' }] (from = cited node, to = citing node),
         years (one per layer), candidates, kept, later, cycle, components } */
  P.historiograph = function (records, lc, opts) {
    opts = opts || {};
    const maxNodes = Math.max(2, +opts.maxNodes || 30), minLocal = opts.minLocal == null ? 1 : Math.max(0, +opts.minLocal || 0);
    const global = i => (records[i].timesCited != null && isFinite(records[i].timesCited) ? records[i].timesCited : null);
    const cand = [];
    records.forEach((r, i) => { if (r.year != null && lc.local[i] >= minLocal && (lc.local[i] > 0 || lc.cites[i].length > 0)) cand.push(i); });
    cand.sort((a, b) => lc.local[b] - lc.local[a] || (lc.cites[b].length > 0) - (lc.cites[a].length > 0) || (global(b) || 0) - (global(a) || 0) || records[a].year - records[b].year || a - b);
    let chosen = cand.slice(0, maxNodes);
    const linksOf = list => {
      const nodeOf = new Map(list.map((i, k) => [i, k]));
      const out = [];
      list.forEach((i, to) => {
        for (const j of lc.cites[i]) {
          const from = nodeOf.get(j);
          if (from !== undefined) out.push({ from, to, status: records[j].year > records[i].year ? 'later' : 'kept' });
        }
      });
      /* same-year citations in a fixed order (the most cited first); one that closes a cycle is left out */
      const same = out.filter(l => l.status === 'kept' && records[list[l.from]].year === records[list[l.to]].year)
        .sort((a, b) => lc.local[list[b.from]] - lc.local[list[a.from]] || a.from - b.from || a.to - b.to);
      const adj = new Map();
      const reaches = (s, t) => {
        const stack = [s], seen = new Set([s]);
        while (stack.length) { const x = stack.pop(); if (x === t) return true; for (const y of adj.get(x) || []) if (!seen.has(y)) { seen.add(y); stack.push(y); } }
        return false;
      };
      for (const l of same) {
        if (reaches(l.to, l.from)) { l.status = 'cycle'; continue; }
        if (!adj.has(l.from)) adj.set(l.from, []);
        adj.get(l.from).push(l.to);
      }
      out.sort((a, b) => a.from - b.from || a.to - b.to);
      return out;
    };
    let links = linksOf(chosen);
    if (opts.removeIsolated) {
      const linked = new Set();
      links.forEach(l => { if (l.status === 'kept') { linked.add(l.from); linked.add(l.to); } });
      chosen = chosen.filter((i, k) => linked.has(k));
      links = linksOf(chosen);
    }
    const years = [...new Set(chosen.map(i => records[i].year))].sort((a, b) => a - b);
    const layerOf = new Map(years.map((y, l) => [y, l]));
    const nodes = chosen.map(i => ({ index: i, year: records[i].year, local: lc.local[i], global: global(i), layer: layerOf.get(records[i].year) }));
    const kept = links.filter(l => l.status === 'kept');
    /* order inside each year: barycentres of the neighbours in other years, sweeping forwards and backwards */
    const pred = nodes.map(() => []), succ = nodes.map(() => []);
    for (const l of kept) if (nodes[l.from].layer !== nodes[l.to].layer) { succ[l.from].push(l.to); pred[l.to].push(l.from); }
    const layers = years.map(() => []);
    nodes.forEach((nd, k) => layers[nd.layer].push(k));
    const y = new Float64Array(nodes.length);
    const place = L => L.forEach((k, r) => { y[k] = (r + 0.5) / L.length; });
    layers.forEach(L => { L.sort((a, b) => nodes[b].local - nodes[a].local || nodes[a].index - nodes[b].index); place(L); });
    for (let sweep = 0; sweep < 8; sweep++) {
      const forward = sweep % 2 === 0;
      for (let q = 0; q < layers.length; q++) {
        const L = layers[forward ? q : layers.length - 1 - q];
        const bary = new Map();
        for (const k of L) {
          const nb = forward ? pred[k] : succ[k];
          bary.set(k, nb.length ? nb.reduce((s, x) => s + y[x], 0) / nb.length : y[k]);
        }
        L.sort((a, b) => bary.get(a) - bary.get(b) || y[a] - y[b] || a - b);
        place(L);
      }
    }
    /* heights: keeping that order and a minimum gap inside each year, every document moves towards the mean height of the
       documents it is linked to in other years (so a lone document of a year does not stay in the middle) */
    const gap = 1 / Math.max(1, ...layers.map(L => L.length));
    layers.forEach(L => L.forEach((k, r) => { y[k] = 0.5 + (r - (L.length - 1) / 2) * gap; }));
    const settle = L => {
      const lo = gap / 2, hi = 1 - gap / 2;
      const v = L.map(k => {
        const nb = pred[k].concat(succ[k]);
        return Math.min(hi, Math.max(lo, nb.length ? nb.reduce((s, x) => s + y[x], 0) / nb.length : y[k]));
      });
      for (let r = 1; r < v.length; r++) v[r] = Math.max(v[r], v[r - 1] + gap);
      if (v.length && v[v.length - 1] > hi) { v[v.length - 1] = hi; for (let r = v.length - 2; r >= 0; r--) v[r] = Math.min(v[r], v[r + 1] - gap); }
      L.forEach((k, r) => { y[k] = v[r]; });
    };
    for (let pass = 0; pass < 6; pass++) {
      const forward = pass % 2 === 0;
      for (let q = 0; q < layers.length; q++) settle(layers[forward ? q : layers.length - 1 - q]);
    }
    layers.forEach(L => L.forEach((k, r) => { nodes[k].order = r; nodes[k].size = L.length; nodes[k].y = y[k]; }));
    /* families: weakly connected groups of documents joined by the drawn citations (−1 = alone) */
    const parent = nodes.map((nd, k) => k);
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (const l of kept) { const a = find(l.from), b = find(l.to); if (a !== b) parent[b] = a; }
    const groups = new Map();
    nodes.forEach((nd, k) => { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(k); });
    const families = [...groups.values()].filter(g => g.length > 1)
      .sort((a, b) => b.length - a.length || Math.min(...a.map(k => nodes[k].year)) - Math.min(...b.map(k => nodes[k].year)) || a[0] - b[0]);
    nodes.forEach(nd => { nd.component = -1; });
    families.forEach((g, c) => g.forEach(k => { nodes[k].component = c; }));
    return {
      nodes, links, years, candidates: cand.length,
      kept: kept.length, later: links.filter(l => l.status === 'later').length, cycle: links.filter(l => l.status === 'cycle').length,
      components: families.length,
    };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpIntellectual);
