/* SciMetricsPro — networks: layouts.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · ForceAtlas2 (Jacomy M, Venturini T, Heymann S, Bastian M 2014, PLoS ONE 9(6):e98679), written from the
     formulas of the article:
       repulsion   F_r = k_r (deg₁ + 1)(deg₂ + 1) / d            (Barnes–Hut approximation with θ = 1.2 above 400 nodes)
       attraction  F_a = w^δ · d                               (w = edge weight / largest weight, δ = 1)
       gravity     F_g = k_g (deg + 1), towards the centre
       speed       swing(n) = |F_t − F_{t−1}|, traction(n) = |F_t + F_{t−1}| / 2,
                   global speed s = τ Σ(deg+1) traction / Σ(deg+1) swing (rising at most 50 % per step),
                   node speed s_n = k_s s / (1 + s √swing(n)) with k_s = 0.1, and s_n |F| ≤ k_smax = 10.
     Initial positions come from a seeded generator, so the same network always gets the same drawing.
   · Circular: nodes around a circle in the order given (for example by community, then by frequency).
   · Pieces of a network that is not connected, packed next to each other after ForceAtlas2 (P.packComponents). */
'use strict';

function smpNetLayout(P) {
  /* small seeded generator (mulberry32) */
  P.seededRandom = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  P.circularLayout = function (n, order) {
    const pos = new Float64Array(2 * n);
    const seq = order && order.length === n ? order : Array.from({ length: n }, (x, i) => i);
    seq.forEach((node, k) => {
      const a = -Math.PI / 2 + 2 * Math.PI * k / Math.max(1, n);
      pos[2 * node] = Math.cos(a);
      pos[2 * node + 1] = Math.sin(a);
    });
    return pos;
  };

  /* quadtree of point masses for the Barnes–Hut repulsion */
  function buildTree(pos, mass, n) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pos[2 * i], y = pos[2 * i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const size = Math.max(x1 - x0, y1 - y0, 1e-9) * 1.0001;
    const nodes = [{ x: x0, y: y0, size, mass: 0, cx: 0, cy: 0, body: -1, kids: null }];
    const insert = (idx, i, depth) => {
      const q = nodes[idx];
      const px = pos[2 * i], py = pos[2 * i + 1], m = mass[i];
      if (q.kids === null && q.body < 0 && q.mass === 0) { q.body = i; q.mass = m; q.cx = px; q.cy = py; return; }
      if (q.kids === null) {
        if (depth > 40) { q.cx = (q.cx * q.mass + px * m) / (q.mass + m); q.cy = (q.cy * q.mass + py * m) / (q.mass + m); q.mass += m; return; }
        q.kids = [];
        const h = q.size / 2;
        for (let k = 0; k < 4; k++) { q.kids.push(nodes.length); nodes.push({ x: q.x + (k % 2) * h, y: q.y + (k >> 1) * h, size: h, mass: 0, cx: 0, cy: 0, body: -1, kids: null }); }
        const old = q.body;
        q.body = -1;
        const ox = q.cx, oy = q.cy, om = q.mass;
        q.mass = 0; q.cx = 0; q.cy = 0;
        insertInto(idx, old, ox, oy, om, depth);
      }
      insertInto(idx, i, px, py, m, depth);
    };
    const insertInto = (idx, i, px, py, m, depth) => {
      const q = nodes[idx];
      q.cx = (q.cx * q.mass + px * m) / (q.mass + m); q.cy = (q.cy * q.mass + py * m) / (q.mass + m); q.mass += m;
      const h = q.size / 2;
      const k = (px >= q.x + h ? 1 : 0) + (py >= q.y + h ? 2 : 0);
      insert(q.kids[k], i, depth + 1);
    };
    for (let i = 0; i < n; i++) insert(0, i, 0);
    return nodes;
  }

  /* opts: { iterations, scaling (k_r), gravity (k_g), seed, barnesHut (true above 400 nodes), theta } → Float64Array [x0, y0, x1, y1 …] */
  P.forceAtlas2 = function (g, opts, progress) {
    opts = opts || {};
    const n = g.n;
    const pos = new Float64Array(2 * n);
    if (!n) return pos;
    const rand = P.seededRandom(opts.seed == null ? 20140610 : opts.seed);
    const spread = Math.sqrt(n) * 10;
    for (let i = 0; i < 2 * n; i++) pos[i] = (rand() - 0.5) * spread;
    if (n === 1) { pos[0] = 0; pos[1] = 0; return pos; }
    const iterations = opts.iterations || (n <= 100 ? 1200 : n <= 500 ? 700 : 400);
    const kr = opts.scaling || (n < 100 ? 10 : 2), kg = opts.gravity == null ? 1 : opts.gravity;
    const bh = opts.barnesHut == null ? n > 400 : opts.barnesHut, theta = opts.theta || 1.2;
    const mass = new Float64Array(n);
    for (let i = 0; i < n; i++) mass[i] = g.degree[i] + 1;
    let maxW = 0;
    for (let e = 0; e < g.wt.length; e++) if (g.wt[e] > maxW) maxW = g.wt[e];
    const fx = new Float64Array(n), fy = new Float64Array(n), ofx = new Float64Array(n), ofy = new Float64Array(n);
    let speed = 1;
    const ks = 0.1, ksMax = 10, tau = opts.tolerance || 1;
    for (let it = 0; it < iterations; it++) {
      if (progress && it % 25 === 0) progress(it / iterations);
      fx.fill(0); fy.fill(0);
      /* repulsion */
      if (bh) {
        const tree = buildTree(pos, mass, n);
        for (let i = 0; i < n; i++) {
          const px = pos[2 * i], py = pos[2 * i + 1], mi = mass[i];
          const stack = [0];
          while (stack.length) {
            const q = tree[stack.pop()];
            if (q.mass === 0 || q.body === i) continue;
            const dx = px - q.cx, dy = py - q.cy, d2 = dx * dx + dy * dy;
            if (q.kids === null || (q.size * q.size) / d2 < theta * theta) {
              if (d2 > 0) { const f = kr * mi * q.mass / d2; fx[i] += dx * f; fy[i] += dy * f; }
            } else for (const k of q.kids) stack.push(k);
          }
        }
      } else {
        for (let i = 0; i < n; i++) {
          const px = pos[2 * i], py = pos[2 * i + 1], mi = mass[i];
          for (let j = i + 1; j < n; j++) {
            const dx = px - pos[2 * j], dy = py - pos[2 * j + 1];
            const d2 = dx * dx + dy * dy;
            if (d2 > 0) {
              const f = kr * mi * mass[j] / d2;                   /* (k_r m_i m_j / d) along the unit vector */
              fx[i] += dx * f; fy[i] += dy * f; fx[j] -= dx * f; fy[j] -= dy * f;
            }
          }
        }
      }
      /* gravity */
      for (let i = 0; i < n; i++) {
        const px = pos[2 * i], py = pos[2 * i + 1], d = Math.sqrt(px * px + py * py);
        if (d > 0) { const f = kg * mass[i] / d; fx[i] -= px * f; fy[i] -= py * f; }
      }
      /* attraction */
      for (let i = 0; i < n; i++) {
        for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) {
          const j = g.nbr[e];
          if (j <= i) continue;
          const w = maxW > 0 ? g.wt[e] / maxW : 1;
          const dx = pos[2 * i] - pos[2 * j], dy = pos[2 * i + 1] - pos[2 * j + 1];
          fx[i] -= dx * w; fy[i] -= dy * w; fx[j] += dx * w; fy[j] += dy * w;
        }
      }
      /* adaptive speed */
      let swingG = 0, tractionG = 0;
      for (let i = 0; i < n; i++) {
        const sx = fx[i] - ofx[i], sy = fy[i] - ofy[i], tx = fx[i] + ofx[i], ty = fy[i] + ofy[i];
        swingG += mass[i] * Math.sqrt(sx * sx + sy * sy);
        tractionG += mass[i] * Math.sqrt(tx * tx + ty * ty) / 2;
      }
      const target = swingG > 0 ? tau * tractionG / swingG : speed;
      speed = it === 0 ? Math.min(target, 1) : Math.min(target, speed * 1.5);
      for (let i = 0; i < n; i++) {
        const sx = fx[i] - ofx[i], sy = fy[i] - ofy[i];
        const swing = mass[i] * Math.sqrt(sx * sx + sy * sy);
        let s = ks * speed / (1 + speed * Math.sqrt(swing));
        const f = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]);
        if (f > 0 && s * f > ksMax) s = ksMax / f;
        pos[2 * i] += fx[i] * s; pos[2 * i + 1] += fy[i] * s;
        ofx[i] = fx[i]; ofy[i] = fy[i];
      }
    }
    /* centred on the origin */
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += pos[2 * i]; cy += pos[2 * i + 1]; }
    cx /= n; cy /= n;
    for (let i = 0; i < n; i++) { pos[2 * i] -= cx; pos[2 * i + 1] -= cy; }
    return pos;
  };

  /* Pieces of a network that is not connected: ForceAtlas2 pushes the small pieces far away (the repulsion of the
     big piece outweighs their gravity), and the drawing, fitted to all the nodes, shrinks the main piece to a spot.
     Each piece keeps its own drawing and is moved next to the others: the largest stays at the centre and the rest,
     from larger to smaller, take the free place closest to it (circles around each piece that do not overlap,
     with a gap of one typical edge length; the search prefers places to the sides, as the drawing is wider than tall).
     g: P.graph; pos: [x0, y0 …] (changed in place and returned) */
  P.packComponents = function (g, pos, opts) {
    opts = opts || {};
    const n = g.n;
    if (n < 2) return pos;
    const comp = new Int32Array(n).fill(-1), members = [];
    for (let s = 0; s < n; s++) {
      if (comp[s] >= 0) continue;
      const list = [s];
      comp[s] = members.length;
      for (let k = 0; k < list.length; k++) {
        const v = list[k];
        for (let e = g.offsets[v]; e < g.offsets[v + 1]; e++) { const w = g.nbr[e]; if (comp[w] < 0) { comp[w] = members.length; list.push(w); } }
      }
      members.push(list);
    }
    if (members.length < 2) return pos;
    /* typical edge length: the median over the edges (nodes of one-node pieces are spaced by it too) */
    const lengths = [];
    for (let i = 0; i < n; i++) for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) { const j = g.nbr[e]; if (j > i) lengths.push(Math.hypot(pos[2 * i] - pos[2 * j], pos[2 * i + 1] - pos[2 * j + 1])); }
    lengths.sort((a, b) => a - b);
    let unit = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0;
    if (!(unit > 0)) unit = 1;
    const gap = unit * (opts.gap == null ? 1 : opts.gap), aspect = opts.aspect || 1.4;
    const pieces = members.map((list, c) => {
      let cx = 0, cy = 0;
      for (const v of list) { cx += pos[2 * v]; cy += pos[2 * v + 1]; }
      cx /= list.length; cy /= list.length;
      let r = 0;
      for (const v of list) r = Math.max(r, Math.hypot(pos[2 * v] - cx, pos[2 * v + 1] - cy));
      return { c, list, cx, cy, r: Math.max(r, unit / 2) };
    });
    /* larger pieces first; ties keep the order of the nodes, so the drawing is reproducible */
    pieces.sort((a, b) => b.list.length - a.list.length || b.r - a.r || a.list[0] - b.list[0]);
    const placed = [];
    const score = (x, y) => Math.hypot(x / aspect, y);
    for (const p of pieces) {
      let bx = 0, by = 0;
      if (placed.length) {
        let best = Infinity;
        for (const q of placed) {
          const d = q.r + p.r + gap;
          for (let k = 0; k < 48; k++) {
            const a = 2 * Math.PI * k / 48;
            const x = q.x + d * Math.cos(a), y = q.y + d * Math.sin(a);
            if (placed.some(o => Math.hypot(x - o.x, y - o.y) < o.r + p.r + gap - 1e-9)) continue;
            const sc = score(x, y);
            if (sc < best - 1e-12) { best = sc; bx = x; by = y; }
          }
        }
      }
      for (const v of p.list) { pos[2 * v] += bx - p.cx; pos[2 * v + 1] += by - p.cy; }
      placed.push({ x: bx, y: by, r: p.r });
    }
    return pos;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpNetLayout);
