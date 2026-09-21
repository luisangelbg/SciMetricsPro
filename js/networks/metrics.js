/* SciMetricsPro — networks: node and network metrics.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Degree: number of neighbours; strength: sum of the weights of the node's edges.
   · Betweenness (paths counted in steps, weights not used as distances): C_B(v) = Σ_{s<t} σ_st(v) / σ_st,
     Brandes U (2001) Journal of Mathematical Sociology 25(2):163–177; normalised by (n − 1)(n − 2) / 2.
   · Closeness (Freeman LC 1979, Social Networks 1(3):215–239) with the correction of Wasserman S, Faust K (1994)
     for graphs in pieces: C(v) = ((r − 1) / (n − 1)) · ((r − 1) / Σ_u d(v, u)), r = nodes reachable from v (v included).
   · PageRank with damping d = 0.85 on the weighted graph (a step follows an edge with probability ∝ its weight;
     nodes without edges jump anywhere): Brin S, Page L (1998) Computer Networks and ISDN Systems 30:107–117.
   · Density 2E / (n(n − 1)); transitivity 3 × triangles / connected triples (Newman MEJ 2003, SIAM Review 45:167–256);
     diameter: the longest shortest path (in steps) between connected nodes; components: connected pieces. */
'use strict';

function smpNetMetrics(P) {
  /* one breadth-first search per node: betweenness (Brandes), closeness, eccentricities → diameter, mean distance */
  P.pathMetrics = function (g, progress) {
    const n = g.n;
    const between = new Float64Array(n), closeness = new Float64Array(n);
    const dist = new Int32Array(n), sigma = new Float64Array(n), delta = new Float64Array(n);
    const order = new Int32Array(n), queue = new Int32Array(n);
    let diameter = 0, pathSum = 0, pathCount = 0;
    for (let s = 0; s < n; s++) {
      if (progress && s % 50 === 0) progress(s / n);
      dist.fill(-1); sigma.fill(0); delta.fill(0);
      const pred = [];
      dist[s] = 0; sigma[s] = 1;
      let head = 0, tail = 0, cnt = 0, sum = 0;
      queue[tail++] = s;
      while (head < tail) {
        const v = queue[head++];
        order[cnt++] = v;
        sum += dist[v];
        if (dist[v] > diameter) diameter = dist[v];
        for (let e = g.offsets[v]; e < g.offsets[v + 1]; e++) {
          const w = g.nbr[e];
          if (dist[w] < 0) { dist[w] = dist[v] + 1; queue[tail++] = w; }
          if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; (pred[w] || (pred[w] = [])).push(v); }
        }
      }
      for (let k = cnt - 1; k > 0; k--) {
        const w = order[k];
        const pw = pred[w];
        if (pw) for (const v of pw) delta[v] += sigma[v] / sigma[w] * (1 + delta[w]);
        between[w] += delta[w];
      }
      if (cnt > 1 && sum > 0) closeness[s] = ((cnt - 1) / (n - 1)) * ((cnt - 1) / sum);
      pathSum += sum; pathCount += cnt - 1;
    }
    for (let v = 0; v < n; v++) between[v] /= 2;                 /* undirected: each pair was counted from both ends */
    const scale = n > 2 ? 2 / ((n - 1) * (n - 2)) : 0;
    return { betweenness: between, betweennessNorm: Float64Array.from(between, b => b * scale), closeness, diameter, meanDistance: pathCount ? pathSum / pathCount : null };
  };

  P.pagerank = function (g, opts) {
    opts = opts || {};
    const n = g.n, d = opts.damping == null ? 0.85 : opts.damping;
    const tol = opts.tol || 1e-12, maxIter = opts.maxIter || 1000;
    const weighted = opts.weighted !== false;
    if (!n) return new Float64Array(0);
    let pr = new Float64Array(n).fill(1 / n), next = new Float64Array(n);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = weighted ? g.strength[i] : g.degree[i];
    for (let it = 0; it < maxIter; it++) {
      let dangling = 0;
      for (let i = 0; i < n; i++) if (!(out[i] > 0)) dangling += pr[i];
      const base = (1 - d) / n + d * dangling / n;
      next.fill(base);
      for (let i = 0; i < n; i++) {
        if (!(out[i] > 0)) continue;
        const share = d * pr[i] / out[i];
        for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) next[g.nbr[e]] += share * (weighted ? g.wt[e] : 1);
      }
      let diff = 0;
      for (let i = 0; i < n; i++) diff += Math.abs(next[i] - pr[i]);
      const tmp = pr; pr = next; next = tmp;
      if (diff < tol) break;
    }
    return pr;
  };

  /* triangles through each pair of neighbours, counted once per triangle */
  P.transitivity = function (g) {
    const n = g.n, mark = new Int32Array(n).fill(-1);
    let triangles = 0, triples = 0;
    for (let i = 0; i < n; i++) {
      const d = g.degree[i];
      triples += d * (d - 1) / 2;
      for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) mark[g.nbr[e]] = i;
      for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) {
        const j = g.nbr[e];
        if (j <= i) continue;
        for (let f = g.offsets[j]; f < g.offsets[j + 1]; f++) { const k = g.nbr[f]; if (k > j && mark[k] === i) triangles++; }
      }
    }
    return { triangles, triples, transitivity: triples > 0 ? 3 * triangles / triples : 0 };
  };

  P.components = function (g) {
    const comp = new Int32Array(g.n).fill(-1), stack = [];
    let count = 0, largest = 0;
    for (let s = 0; s < g.n; s++) {
      if (comp[s] >= 0) continue;
      let size = 0;
      comp[s] = count; stack.push(s);
      while (stack.length) {
        const v = stack.pop(); size++;
        for (let e = g.offsets[v]; e < g.offsets[v + 1]; e++) { const w = g.nbr[e]; if (comp[w] < 0) { comp[w] = count; stack.push(w); } }
      }
      if (size > largest) largest = size;
      count++;
    }
    return { membership: comp, count, largest };
  };

  /* every node metric and the network summary */
  P.networkMetrics = function (g, progress) {
    const paths = P.pathMetrics(g, progress);
    const tr = P.transitivity(g), comps = P.components(g);
    const n = g.n;
    return {
      degree: g.degree, strength: g.strength,
      betweenness: paths.betweenness, betweennessNorm: paths.betweennessNorm, closeness: paths.closeness,
      pagerank: P.pagerank(g),
      stats: {
        nodes: n, edges: g.m, density: n > 1 ? 2 * g.m / (n * (n - 1)) : 0,
        transitivity: tr.transitivity, triangles: tr.triangles, diameter: paths.diameter, meanDistance: paths.meanDistance,
        components: comps.count, largestComponent: comps.largest,
      },
    };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpNetMetrics);
