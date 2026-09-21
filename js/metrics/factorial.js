/* SciMetricsPro — factorial analysis of the conceptual structure: correspondence analysis (CA) and multiple
   correspondence analysis (MCA) of the document × word matrix, k-means on the coordinates with the silhouette,
   and Ward's hierarchical clustering for the dendrogram. Pure functions (no window, no DOM).

   · CA of a table N with total T, row masses r = N 1 / T and column masses c = Nᵀ 1 / T:
       Z = D_r^(−1/2) (N/T − r cᵀ) D_c^(−1/2) = U Σ Vᵀ;  principal inertias λ = σ²;
       column principal coordinates G = D_c^(−1/2) V Σ;  row principal coordinates F = D_r^(−1) (N/T) G Σ^(−1).
     The decomposition uses the eigenvectors of ZᵀZ (Jacobi rotations); with a binary document × word matrix
     ZᵀZ_jk = Σ_{d ∋ j,k} (1/n_d) / (T √(c_j c_k)) − √(c_j c_k), so only the word pairs of each document are visited.
     Greenacre M (2007) Correspondence Analysis in Practice, 2nd ed., Chapman & Hall/CRC.
   · MCA: CA of the indicator matrix with two categories per word (present, absent); Q words, so the total inertia is 1.
     Adjusted inertias (Benzécri JP 1979, Cahiers de l'Analyse des Données 4(3):377–378): for λ > 1/Q,
     λ' = (Q/(Q − 1))² (λ − 1/Q)², shown as percentages of Σλ'.
   · k-means (Lloyd SP 1982, IEEE Trans Inf Theory 28(2):129–137) with k-means++ seeding (Arthur D, Vassilvitskii S
     2007, Proc. 18th ACM-SIAM SODA:1027–1035), several seeded starts, the lowest within sum of squares kept.
   · Silhouette s(i) = (b − a) / max(a, b) (Rousseeuw PJ 1987, J Comput Appl Math 20:53–65), 0 for single members.
   · Ward (1963, JASA 58(301):236–244): merge the pair with the smallest increase of the within sum of squares;
     height = √(2 n_a n_b / (n_a + n_b)) ‖c_a − c_b‖ (the Euclidean form). */
'use strict';

function smpFactorial(P) {
  /* Symmetric eigen-decomposition: Householder reduction to tridiagonal form and implicit QL iterations
     (the EISPACK routines tred2 and tql2; Wilkinson JH, Reinsch C 1971, Handbook for Automatic Computation II).
     → { values (descending), vectors: vectors[j][k] = component k of eigenvector j } */
  P.eigenSym = function (M) {
    const n = M.length;
    const V = M.map(r => Float64Array.from(r));
    const d = new Float64Array(n), e = new Float64Array(n);
    if (!n) return { values: [], vectors: [] };
    /* tred2 */
    for (let j = 0; j < n; j++) d[j] = V[n - 1][j];
    for (let i = n - 1; i > 0; i--) {
      let scale = 0, h = 0;
      for (let k = 0; k < i; k++) scale += Math.abs(d[k]);
      if (scale === 0) {
        e[i] = d[i - 1];
        for (let j = 0; j < i; j++) { d[j] = V[i - 1][j]; V[i][j] = 0; V[j][i] = 0; }
      } else {
        for (let k = 0; k < i; k++) { d[k] /= scale; h += d[k] * d[k]; }
        let f = d[i - 1], g = Math.sqrt(h);
        if (f > 0) g = -g;
        e[i] = scale * g;
        h -= f * g;
        d[i - 1] = f - g;
        for (let j = 0; j < i; j++) e[j] = 0;
        for (let j = 0; j < i; j++) {
          f = d[j];
          V[j][i] = f;
          g = e[j] + V[j][j] * f;
          for (let k = j + 1; k <= i - 1; k++) { g += V[k][j] * d[k]; e[k] += V[k][j] * f; }
          e[j] = g;
        }
        f = 0;
        for (let j = 0; j < i; j++) { e[j] /= h; f += e[j] * d[j]; }
        const hh = f / (h + h);
        for (let j = 0; j < i; j++) e[j] -= hh * d[j];
        for (let j = 0; j < i; j++) {
          f = d[j]; g = e[j];
          for (let k = j; k <= i - 1; k++) V[k][j] -= (f * e[k] + g * d[k]);
          d[j] = V[i - 1][j];
          V[i][j] = 0;
        }
      }
      d[i] = h;
    }
    for (let i = 0; i < n - 1; i++) {
      V[n - 1][i] = V[i][i];
      V[i][i] = 1;
      const h = d[i + 1];
      if (h !== 0) {
        for (let k = 0; k <= i; k++) d[k] = V[k][i + 1] / h;
        for (let j = 0; j <= i; j++) {
          let g = 0;
          for (let k = 0; k <= i; k++) g += V[k][i + 1] * V[k][j];
          for (let k = 0; k <= i; k++) V[k][j] -= g * d[k];
        }
      }
      for (let k = 0; k <= i; k++) V[k][i + 1] = 0;
    }
    for (let j = 0; j < n; j++) { d[j] = V[n - 1][j]; V[n - 1][j] = 0; }
    V[n - 1][n - 1] = 1;
    e[0] = 0;
    /* tql2 */
    for (let i = 1; i < n; i++) e[i - 1] = e[i];
    e[n - 1] = 0;
    let f = 0, tst1 = 0;
    const eps = Math.pow(2, -52);
    for (let l = 0; l < n; l++) {
      tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
      let m = l;
      while (m < n) { if (Math.abs(e[m]) <= eps * tst1) break; m++; }
      if (m > l) {
        let iter = 0;
        do {
          iter++;
          let g = d[l];
          let p = (d[l + 1] - g) / (2 * e[l]);
          let r = Math.hypot(p, 1);
          if (p < 0) r = -r;
          d[l] = e[l] / (p + r);
          d[l + 1] = e[l] * (p + r);
          const dl1 = d[l + 1];
          let h = g - d[l];
          for (let i = l + 2; i < n; i++) d[i] -= h;
          f += h;
          p = d[m];
          let c = 1, c2 = c, c3 = c, s = 0, s2 = 0;
          const el1 = e[l + 1];
          for (let i = m - 1; i >= l; i--) {
            c3 = c2; c2 = c; s2 = s;
            g = c * e[i]; h = c * p;
            r = Math.hypot(p, e[i]);
            e[i + 1] = s * r;
            s = e[i] / r; c = p / r;
            p = c * d[i] - s * g;
            d[i + 1] = h + s * (c * g + s * d[i]);
            for (let k = 0; k < n; k++) { h = V[k][i + 1]; V[k][i + 1] = s * V[k][i] + c * h; V[k][i] = c * V[k][i] - s * h; }
          }
          p = -s * s2 * c3 * el1 * e[l] / dl1;
          e[l] = s * p;
          d[l] = c * p;
        } while (Math.abs(e[l]) > eps * tst1 && iter < 60);
      }
      d[l] += f;
      e[l] = 0;
    }
    const order = Array.from({ length: n }, (x, i) => i).sort((a, b) => d[b] - d[a]);
    const values = order.map(i => d[i]);
    /* each vector with its largest component positive, so signs are reproducible */
    const vectors = order.map(i => {
      const v = V.map(row => row[i]);
      let big = 0;
      for (let k = 1; k < n; k++) if (Math.abs(v[k]) > Math.abs(v[big])) big = k;
      return v[big] < 0 ? v.map(x => -x) : v;
    });
    return { values, vectors };
  };

  /* from ZᵀZ, column masses and the row transition → the common CA result */
  function caFromCross(ZtZ, colMass, rowCoordOf, opts) {
    const p = colMass.length;
    const eig = P.eigenSym(ZtZ);
    const eps = 1e-11 * Math.max(1, eig.values[0] || 0);
    const dims = [];
    eig.values.forEach((v, k) => { if (v > eps) dims.push(k); });
    const nd = Math.min(dims.length, opts.maxDims || 10);
    const values = dims.map(k => eig.values[k]);
    const total = values.reduce((a, b) => a + b, 0);
    const colCoord = Array.from({ length: p }, () => new Float64Array(nd));
    for (let d = 0; d < nd; d++) {
      const vec = eig.vectors[dims[d]], sigma = Math.sqrt(values[d]);
      for (let j = 0; j < p; j++) colCoord[j][d] = colMass[j] > 0 ? vec[j] * sigma / Math.sqrt(colMass[j]) : 0;
    }
    const colContrib = colCoord.map((g, j) => Array.from(g, (x, d) => 100 * colMass[j] * x * x / values[d]));
    const colCos2 = colCoord.map(g => { const s = g.reduce((a, x) => a + x * x, 0); return Array.from(g, x => (s > 0 ? x * x / s : 0)); });
    return {
      values, total, pct: values.map(v => v / total), dims: nd,
      colMass, colCoord, colContrib, colCos2,
      rowCoord: rowCoordOf ? rowCoordOf(colCoord, values.slice(0, nd)) : null,
    };
  }

  /* CA of a dense table (counts) */
  P.correspondenceAnalysis = function (N, opts) {
    opts = opts || {};
    const n = N.length, p = N[0].length;
    let T = 0;
    const rs = new Float64Array(n), cs = new Float64Array(p);
    for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) { T += N[i][j]; rs[i] += N[i][j]; cs[j] += N[i][j]; }
    const r = Array.from(rs, v => v / T), c = Array.from(cs, v => v / T);
    const Z = N.map((row, i) => row.map((v, j) => (r[i] > 0 && c[j] > 0 ? (v / T - r[i] * c[j]) / Math.sqrt(r[i] * c[j]) : 0)));
    const ZtZ = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) { const zij = Z[i][j]; if (!zij) continue; for (let k = j; k < p; k++) ZtZ[j][k] += zij * Z[i][k]; }
    for (let j = 0; j < p; j++) for (let k = 0; k < j; k++) ZtZ[j][k] = ZtZ[k][j];
    const res = caFromCross(ZtZ, c, (G, values) => N.map((row, i) => Float64Array.from(values, (lam, d) => {
      let s = 0;
      for (let j = 0; j < p; j++) s += row[j] * G[j][d];
      return r[i] > 0 ? s / (T * r[i]) / Math.sqrt(lam) : 0;
    })), opts);
    res.rowMass = r;
    return res;
  };

  /* CA of a binary document × word matrix given as word lists per document (documents without words are left out) */
  P.correspondenceBinary = function (docs, p, opts) {
    const rows = docs.filter(d => d.length);
    let T = 0;
    const cs = new Float64Array(p);
    for (const d of rows) { T += d.length; for (const j of d) cs[j]++; }
    const c = Array.from(cs, v => v / T);
    const S = Array.from({ length: p }, () => new Float64Array(p));
    for (const d of rows) { const w = 1 / d.length; for (const j of d) for (const k of d) S[j][k] += w; }
    const ZtZ = Array.from({ length: p }, (x, j) => Array.from({ length: p }, (y, k) => (c[j] > 0 && c[k] > 0 ? S[j][k] / (T * Math.sqrt(c[j] * c[k])) - Math.sqrt(c[j] * c[k]) : 0)));
    return caFromCross(ZtZ, c, (G, values) => rows.map(d => Float64Array.from(values, (lam, dd) => {
      let s = 0;
      for (const j of d) s += G[j][dd];
      return s / d.length / Math.sqrt(lam);
    })), opts || {});
  };

  /* MCA of Q binary variables (words present or absent), from the co-occurrence counts:
     categories 0 … Q−1 = present, Q … 2Q−1 = absent */
  P.mcaBinary = function (docs, Q, opts) {
    const n = docs.length;
    const f = new Float64Array(Q);
    for (const d of docs) for (const j of d) f[j]++;
    const C = Array.from({ length: Q }, () => new Float64Array(Q));
    for (const d of docs) for (const j of d) for (const k of d) C[j][k]++;
    const J = 2 * Q, T = n * Q;
    const mass = new Float64Array(J);
    for (let j = 0; j < Q; j++) { mass[j] = f[j] / T; mass[Q + j] = (n - f[j]) / T; }
    /* Burt matrix entries between categories */
    const burt = (a, b) => {
      const ja = a % Q, pa = a < Q, jb = b % Q, pb = b < Q;
      const both = C[ja][jb];
      if (ja === jb) return pa === pb ? (pa ? f[ja] : n - f[ja]) : 0;
      if (pa && pb) return both;
      if (pa && !pb) return f[ja] - both;
      if (!pa && pb) return f[jb] - both;
      return n - f[ja] - f[jb] + both;
    };
    /* each row has mass 1/n: Σ_i a_ia a_ib = Burt(a, b) / (T² (1/n) √(c_a c_b)) */
    const ZtZ = Array.from({ length: J }, () => new Array(J).fill(0));
    for (let a = 0; a < J; a++) for (let b = a; b < J; b++) {
      const v = mass[a] > 0 && mass[b] > 0 ? burt(a, b) * n / (T * T * Math.sqrt(mass[a] * mass[b])) - Math.sqrt(mass[a] * mass[b]) : 0;
      ZtZ[a][b] = v; ZtZ[b][a] = v;
    }
    const res = caFromCross(ZtZ, Array.from(mass), null, opts || {});
    const threshold = 1 / Q;
    const adjusted = res.values.map(v => (v > threshold && Q > 1 ? Math.pow(Q / (Q - 1) * (v - threshold), 2) : 0));
    const sumAdj = adjusted.reduce((a, b) => a + b, 0);
    res.adjusted = adjusted;
    res.pctAdjusted = adjusted.map(v => (sumAdj > 0 ? v / sumAdj : 0));
    res.Q = Q;
    /* the words are the "present" categories */
    res.wordCoord = res.colCoord.slice(0, Q);
    res.wordContrib = res.colContrib.slice(0, Q);
    res.wordCos2 = res.colCos2.slice(0, Q);
    return res;
  };

  /* ---------------- clustering of the coordinates ---------------- */

  const dist2 = (a, b) => { let s = 0; for (let d = 0; d < a.length; d++) { const x = a[d] - b[d]; s += x * x; } return s; };

  /* points: [[x, y …]] → { labels (0 = largest cluster), centers, withinSS } */
  P.kmeans = function (points, k, opts) {
    opts = opts || {};
    const n = points.length, dim = n ? points[0].length : 0;
    k = Math.max(1, Math.min(k, n));
    const restarts = opts.restarts || 20, maxIter = opts.maxIter || 100;
    const rand = P.seededRandom(opts.seed == null ? 1982 : opts.seed);
    let best = null;
    for (let r = 0; r < restarts; r++) {
      /* k-means++ seeding */
      const centers = [Array.from(points[Math.floor(rand() * n)])];
      const d2 = points.map(pt => dist2(pt, centers[0]));
      while (centers.length < k) {
        const sum = d2.reduce((a, b) => a + b, 0);
        let pick = 0;
        if (sum > 0) { let u = rand() * sum; for (pick = 0; pick < n - 1; pick++) { u -= d2[pick]; if (u <= 0) break; } }
        else pick = centers.length;
        centers.push(Array.from(points[pick]));
        points.forEach((pt, i) => { const v = dist2(pt, centers[centers.length - 1]); if (v < d2[i]) d2[i] = v; });
      }
      const labels = new Int32Array(n).fill(-1);
      for (let it = 0; it < maxIter; it++) {
        let moved = 0;
        points.forEach((pt, i) => {
          let bj = 0, bd = Infinity;
          for (let j = 0; j < k; j++) { const v = dist2(pt, centers[j]); if (v < bd) { bd = v; bj = j; } }
          if (labels[i] !== bj) { labels[i] = bj; moved++; }
        });
        for (let j = 0; j < k; j++) {
          const sum = new Float64Array(dim);
          let cnt = 0;
          points.forEach((pt, i) => { if (labels[i] === j) { cnt++; for (let d = 0; d < dim; d++) sum[d] += pt[d]; } });
          if (cnt) centers[j] = Array.from(sum, v => v / cnt);
        }
        if (!moved) break;
      }
      /* Hartigan's exchange step (Hartigan and Wong 1979): Lloyd stops when every point is nearest to its own centre, but
         moving a point can still lower the sum of squares because both centres move too. x leaves A for B when
         n_B/(n_B+1)·|x − c_B|² < n_A/(n_A−1)·|x − c_A|² (an empty B costs nothing). */
      const cnt = new Array(k).fill(0);
      labels.forEach(l => { cnt[l]++; });
      for (let pass = 0; pass < maxIter; pass++) {
        let moved = 0;
        points.forEach((pt, i) => {
          const a = labels[i];
          if (cnt[a] <= 1) return;
          let bj = -1, bv = cnt[a] / (cnt[a] - 1) * dist2(pt, centers[a]);
          for (let j = 0; j < k; j++) {
            if (j === a) continue;
            const v = cnt[j] / (cnt[j] + 1) * dist2(pt, centers[j]);
            if (v < bv - 1e-12) { bv = v; bj = j; }
          }
          if (bj < 0) return;
          for (let d = 0; d < dim; d++) {
            centers[a][d] = (centers[a][d] * cnt[a] - pt[d]) / (cnt[a] - 1);
            centers[bj][d] = (centers[bj][d] * cnt[bj] + pt[d]) / (cnt[bj] + 1);
          }
          cnt[a]--; cnt[bj]++; labels[i] = bj; moved++;
        });
        if (!moved) break;
      }
      /* centres again from the labels, without the rounding of the running updates */
      for (let j = 0; j < k; j++) {
        if (!cnt[j]) continue;
        const sum = new Float64Array(dim);
        points.forEach((pt, i) => { if (labels[i] === j) for (let d = 0; d < dim; d++) sum[d] += pt[d]; });
        centers[j] = Array.from(sum, v => v / cnt[j]);
      }
      let wss = 0;
      points.forEach((pt, i) => { wss += dist2(pt, centers[labels[i]]); });
      if (!best || wss < best.withinSS - 1e-12) best = { labels, centers, withinSS: wss };
    }
    /* clusters numbered from the largest */
    const size = new Array(k).fill(0);
    best.labels.forEach(l => size[l]++);
    const order = size.map((s, j) => j).sort((a, b) => size[b] - size[a] || a - b);
    const map = new Int32Array(k);
    order.forEach((j, pos) => { map[j] = pos; });
    return { labels: Int32Array.from(best.labels, l => map[l]), centers: order.map(j => best.centers[j]), withinSS: best.withinSS, sizes: order.map(j => size[j]) };
  };

  P.silhouette = function (points, labels) {
    const n = points.length;
    if (n < 2) return { mean: 0, values: [] };
    const k = Math.max(...labels) + 1;
    const size = new Array(k).fill(0);
    for (const l of labels) size[l]++;
    const values = points.map((pt, i) => {
      if (size[labels[i]] <= 1) return 0;
      const sum = new Array(k).fill(0);
      points.forEach((q, j) => { if (j !== i) sum[labels[j]] += Math.sqrt(dist2(pt, q)); });
      const a = sum[labels[i]] / (size[labels[i]] - 1);
      let b = Infinity;
      for (let c = 0; c < k; c++) if (c !== labels[i] && size[c] > 0) b = Math.min(b, sum[c] / size[c]);
      if (!isFinite(b)) return 0;
      const m = Math.max(a, b);
      return m > 0 ? (b - a) / m : 0;
    });
    return { mean: values.reduce((x, y) => x + y, 0) / n, values };
  };

  /* silhouette for k = kMin … kMax → { best, scores: [{ k, silhouette, withinSS }] } */
  P.suggestK = function (points, kMin, kMax, opts) {
    const scores = [];
    for (let k = Math.max(2, kMin || 2); k <= Math.min(kMax || 8, points.length - 1); k++) {
      const km = P.kmeans(points, k, opts);
      scores.push({ k, silhouette: P.silhouette(points, km.labels).mean, withinSS: km.withinSS });
    }
    let best = scores.length ? scores[0] : null;
    for (const s of scores) if (s.silhouette > best.silhouette + 1e-12) best = s;
    return { best: best ? best.k : 1, scores };
  };

  /* Ward's hierarchical clustering → { merges: [[a, b, height, size]] (leaves 0 … n−1, new clusters n, n+1 …), order } */
  P.ward = function (points) {
    const n = points.length;
    const active = new Map();
    points.forEach((pt, i) => active.set(i, { center: Array.from(pt), size: 1 }));
    const merges = [];
    let next = n;
    const children = new Map();
    while (active.size > 1) {
      let ba = -1, bb = -1, bc = Infinity;
      const ids = [...active.keys()];
      for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
        const A = active.get(ids[x]), B = active.get(ids[y]);
        const cost = A.size * B.size / (A.size + B.size) * dist2(A.center, B.center);
        if (cost < bc - 1e-15) { bc = cost; ba = ids[x]; bb = ids[y]; }
      }
      const A = active.get(ba), B = active.get(bb), s = A.size + B.size;
      const center = A.center.map((v, d) => (v * A.size + B.center[d] * B.size) / s);
      active.delete(ba); active.delete(bb);
      active.set(next, { center, size: s });
      merges.push([ba, bb, Math.sqrt(2 * bc), s]);
      children.set(next, [ba, bb]);
      next++;
    }
    /* leaf order for drawing */
    const order = [];
    const walk = id => { if (id < n) order.push(id); else children.get(id).forEach(walk); };
    if (n) walk(n > 1 ? next - 1 : 0);
    return { merges, order };
  };

  /* the whole factorial analysis of the conceptual structure.
     lists: terms per document; opts: { method: 'mca'|'ca', maxItems, minFreq, k (0 = by silhouette), kMax, dims (for clustering, 2) } */
  P.conceptualFactorial = function (lists, opts) {
    opts = opts || {};
    const inc = P.incidence(lists, { minFreq: opts.minFreq, maxItems: opts.maxItems });
    const p = inc.items.length;
    if (p < 3) return { inc, empty: true };
    const docs = inc.docs.filter(d => d.length);
    const res = opts.method === 'ca' ? P.correspondenceBinary(docs, p) : P.mcaBinary(docs, p);
    if (res.dims < 2) return { inc, empty: true };
    const coord = opts.method === 'ca' ? res.colCoord : res.wordCoord;
    const dims = Math.min(res.dims, Math.max(2, opts.dims || 2));
    const points = coord.map(g => Array.from(g).slice(0, dims));
    const suggestion = P.suggestK(points, 2, Math.min(opts.kMax || 8, p - 1), { seed: 1982 });
    const k = opts.k > 1 ? Math.min(opts.k, p - 1) : suggestion.best;
    const km = P.kmeans(points, k, { seed: 1982 });
    return { inc, docs: docs.length, method: opts.method === 'ca' ? 'ca' : 'mca', res, coord, points, suggestion, k, kmeans: km, silhouette: P.silhouette(points, km.labels), ward: P.ward(points) };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpFactorial);
