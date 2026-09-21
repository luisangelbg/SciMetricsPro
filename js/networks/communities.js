/* SciMetricsPro — networks: communities.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Modularity with resolution γ of a partition of a weighted undirected graph:
       Q = Σ_c [ W_in(c) / 2m − γ (K(c) / 2m)² ]
     W_in(c) = Σ_{i,j ∈ c} A_ij (both directions), K(c) = Σ_{i ∈ c} k_i, 2m = Σ_i k_i.
     Newman MEJ, Girvan M (2004) Physical Review E 69:026113; resolution: Reichardt J, Bornholdt S (2006)
     Physical Review E 74:016110. γ > 1 favours more and smaller communities; γ < 1 fewer and larger.
   · Louvain: local moves of single nodes to the neighbouring community with the largest gain
     k_i,in(C) − γ K(C) k_i / 2m, then aggregation of communities into nodes, repeated while anything moves.
     Blondel VD, Guillaume J-L, Lambiotte R, Lefebvre E (2008) J Stat Mech P10008. Nodes are visited in
     index order, so the result is reproducible.
   · Fast greedy: starting from single nodes, the pair of adjacent communities with the largest
     ΔQ = 2 (e_ij − γ a_i a_j) is merged until one community per component remains; the partition with the
     highest modularity along the way is kept. Clauset A, Newman MEJ, Moore C (2004) Physical Review E 70:066111. */
'use strict';

function smpNetCommunities(P) {
  P.modularity = function (g, membership, gamma) {
    gamma = gamma == null ? 1 : +gamma;
    const m2 = 2 * g.totalWeight;
    if (!(m2 > 0)) return 0;
    const inside = new Map(), tot = new Map();
    for (let i = 0; i < g.n; i++) {
      const c = membership[i];
      tot.set(c, (tot.get(c) || 0) + g.strength[i]);
      for (let k = g.offsets[i]; k < g.offsets[i + 1]; k++) if (membership[g.nbr[k]] === c) inside.set(c, (inside.get(c) || 0) + g.wt[k]);
    }
    let q = 0;
    for (const [c, K] of tot) q += (inside.get(c) || 0) / m2 - gamma * (K / m2) * (K / m2);
    return q;
  };

  /* communities numbered 0, 1, 2 … from the largest (ties: the one holding the smallest node index) */
  P.relabelCommunities = function (membership) {
    const size = new Map(), first = new Map();
    membership.forEach((c, i) => { size.set(c, (size.get(c) || 0) + 1); if (!first.has(c)) first.set(c, i); });
    const order = [...size.keys()].sort((a, b) => size.get(b) - size.get(a) || first.get(a) - first.get(b));
    const map = new Map(order.map((c, k) => [c, k]));
    return Int32Array.from(membership, c => map.get(c));
  };

  P.louvain = function (g, opts) {
    opts = opts || {};
    const gamma = opts.resolution == null ? 1 : +opts.resolution;
    const n0 = g.n;
    const m2 = 2 * g.totalWeight;
    let membership = new Int32Array(n0);
    for (let i = 0; i < n0; i++) membership[i] = i;
    if (!(m2 > 0) || n0 === 0) return { membership: P.relabelCommunities(membership), communities: n0, modularity: 0, levels: 0 };

    /* level graph: adjacency lists without self-loops, self-loop weight apart (counted once), strength k */
    let adj = [], self = new Float64Array(n0), k = Float64Array.from(g.strength);
    for (let i = 0; i < n0; i++) {
      const nb = [], w = [];
      for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) { nb.push(g.nbr[e]); w.push(g.wt[e]); }
      adj.push({ nb, w });
    }
    let levels = 0;
    const maxLevels = opts.maxLevels || 50;
    while (levels < maxLevels) {
      const n = adj.length;
      const comm = new Int32Array(n), tot = new Float64Array(n);
      for (let i = 0; i < n; i++) { comm[i] = i; tot[i] = k[i]; }
      const wsum = new Float64Array(n), touched = new Int32Array(n);
      let movedAny = false, passes = 0;
      for (;;) {
        let moved = 0;
        for (let i = 0; i < n; i++) {
          const ci = comm[i], ki = k[i], { nb, w } = adj[i];
          let nt = 0;
          for (let e = 0; e < nb.length; e++) {
            const c = comm[nb[e]];
            if (wsum[c] === 0) touched[nt++] = c;
            wsum[c] += w[e];
          }
          tot[ci] -= ki;
          let best = ci, bestGain = wsum[ci] - gamma * tot[ci] * ki / m2;
          for (let t = 0; t < nt; t++) {
            const c = touched[t];
            const gain = wsum[c] - gamma * tot[c] * ki / m2;
            if (gain > bestGain + 1e-12) { bestGain = gain; best = c; }
          }
          tot[best] += ki;
          if (best !== ci) { comm[i] = best; moved++; }
          for (let t = 0; t < nt; t++) wsum[touched[t]] = 0;
          wsum[ci] = 0;
        }
        passes++;
        if (moved) movedAny = true;
        if (!moved || passes > 1000) break;
      }
      /* renumber and aggregate */
      const map = new Int32Array(n).fill(-1);
      let nc = 0;
      for (let i = 0; i < n; i++) if (map[comm[i]] < 0) map[comm[i]] = nc++;
      membership = membership.map(c => map[comm[c]]);
      levels++;
      if (!movedAny || nc === n) break;
      const links = []; for (let c = 0; c < nc; c++) links.push(new Map());
      const self2 = new Float64Array(nc), k2 = new Float64Array(nc);
      for (let i = 0; i < n; i++) {
        const ci = map[comm[i]];
        k2[ci] += k[i];
        self2[ci] += self[i];
        const { nb, w } = adj[i];
        for (let e = 0; e < nb.length; e++) {
          const cj = map[comm[nb[e]]];
          if (cj === ci) self2[ci] += w[e] / 2;                  /* each internal edge is seen from both ends */
          else links[ci].set(cj, (links[ci].get(cj) || 0) + w[e]);
        }
      }
      adj = links.map(mp => { const nb = [], w = []; for (const [c, v] of mp) { nb.push(c); w.push(v); } return { nb, w }; });
      self = self2; k = k2;
    }
    const rel = P.relabelCommunities(membership);
    let count = 0;
    for (const c of rel) if (c + 1 > count) count = c + 1;
    return { membership: rel, communities: count, modularity: P.modularity(g, rel, gamma), levels };
  };

  P.fastGreedy = function (g, opts) {
    opts = opts || {};
    const gamma = opts.resolution == null ? 1 : +opts.resolution;
    const n = g.n;
    const m2 = 2 * g.totalWeight;
    const identity = () => { const mm = new Int32Array(n); for (let i = 0; i < n; i++) mm[i] = i; return mm; };
    if (!(m2 > 0) || n === 0) return { membership: P.relabelCommunities(identity()), communities: n, modularity: 0, merges: 0 };
    /* e[i]: Map(j → e_ij) with e_ij = A_ij / 2m for adjacent communities; a_i = k_i / 2m */
    const e = [], a = new Float64Array(n), alive = new Uint8Array(n).fill(1);
    for (let i = 0; i < n; i++) {
      const mp = new Map();
      for (let t = g.offsets[i]; t < g.offsets[i + 1]; t++) { const j = g.nbr[t]; if (j !== i) mp.set(j, (mp.get(j) || 0) + g.wt[t] / m2); }
      e.push(mp);
      a[i] = g.strength[i] / m2;
    }
    let q = 0;
    for (let i = 0; i < n; i++) q -= gamma * a[i] * a[i];
    let bestQ = q, bestStep = 0;
    const merges = [];
    for (;;) {
      let bi = -1, bj = -1, bd = -Infinity;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        for (const [j, eij] of e[i]) {
          if (j <= i) continue;
          const d = 2 * (eij - gamma * a[i] * a[j]);
          if (d > bd + 1e-15) { bd = d; bi = i; bj = j; }
        }
      }
      if (bi < 0) break;
      /* merge j into i */
      for (const [k, ejk] of e[bj]) {
        if (k === bi) continue;
        e[bi].set(k, (e[bi].get(k) || 0) + ejk);
        const ek = e[k];
        ek.set(bi, (ek.get(bi) || 0) + ejk);
        ek.delete(bj);
      }
      e[bi].delete(bj);
      e[bj] = new Map();
      alive[bj] = 0;
      a[bi] += a[bj]; a[bj] = 0;
      q += bd;
      merges.push([bi, bj]);
      if (q > bestQ + 1e-12) { bestQ = q; bestStep = merges.length; }
    }
    /* replay the merges up to the best partition */
    const parent = identity();
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let s = 0; s < bestStep; s++) parent[find(merges[s][1])] = find(merges[s][0]);
    const membership = P.relabelCommunities(Int32Array.from({ length: n }, (x, i) => find(i)));
    let count = 0;
    for (const c of membership) if (c + 1 > count) count = c + 1;
    return { membership, communities: count, modularity: P.modularity(g, membership, gamma), merges: bestStep };
  };

  P.communities = function (g, opts) {
    opts = opts || {};
    return opts.algorithm === 'fastgreedy' ? P.fastGreedy(g, opts) : P.louvain(g, opts);
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpNetCommunities);
