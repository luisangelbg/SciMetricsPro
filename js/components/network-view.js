/* SciMetricsPro — NetworkView: an interactive network drawn on a canvas (fluid with hundreds of nodes).
   Colour per node (community), size by a value, labels of the main nodes without overlaps, zoom with the wheel,
   the buttons or the keyboard, panning by dragging, search, and a click that selects a node and highlights its
   neighbours. The figure for publication is drawn separately in SVG (Charts.network).

   const view = NetworkView.create({
     nodes: [{ label, value, color }], edges: [[source, target, weight 0–1]], positions: [x0, y0, x1, y1 …],
     labelCount, height, onSelect(index | -1), searchLabel, notFound (texts of the search box),
   })
   view.el · view.select(i, center) · view.search(text) → index · view.zoomBy(f) · view.fit() · view.draw() → ms
   view.update({ nodes, labelCount }) (same network, new colours, sizes or labels) · view.destroy() */
'use strict';

const NetworkView = {
  MIN_R: 3.5,
  MAX_R: 18,

  create(o) {
    const st = {
      nodes: o.nodes, edges: o.edges, pos: o.positions, labelCount: o.labelCount == null ? 20 : o.labelCount,
      k: 1, tx: 0, ty: 0, selected: -1, hover: -1, width: 0, height: o.height || 560, dpr: 1,
      neighbours: null, frame: 0, lastMs: 0,
    };
    const root = mk('div', { class: 'netview' });
    const bar = mk('div', { class: 'netview-bar' });
    const searchWrap = mk('label', { class: 'netview-search' });
    searchWrap.innerHTML = icon('search');
    const listId = 'nv' + Math.random().toString(36).slice(2, 8);
    const input = mk('input', { type: 'search', placeholder: o.searchLabel || t('network.view.search'), 'aria-label': o.searchLabel || t('network.view.search'), list: listId, class: 'netview-input' });
    const datalist = mk('datalist', { id: listId });
    searchWrap.appendChild(input);
    searchWrap.appendChild(datalist);
    bar.appendChild(searchWrap);
    const status = mk('span', { class: 'netview-status', 'aria-live': 'polite' });
    bar.appendChild(status);
    const btn = (name, label, fn, text) => {
      const b = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm netview-btn', title: label, 'aria-label': label, 'data-action': name }, text ? esc(text) : icon(name));
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    };
    btn('zoomin', t('network.view.zoomIn'), () => api.zoomBy(1.4), t('network.view.zoomInShort'));
    btn('zoomout', t('network.view.zoomOut'), () => api.zoomBy(1 / 1.4), t('network.view.zoomOutShort'));
    btn('fit', t('network.view.fit'), () => api.fit(), t('network.view.fitShort'));
    root.appendChild(bar);
    const box = mk('div', { class: 'netview-canvas', style: 'height:' + st.height + 'px' });
    const canvas = mk('canvas', { tabindex: '0', role: 'img', 'aria-label': t('network.view.canvasLabel') });
    box.appendChild(canvas);
    root.appendChild(box);
    root.appendChild(mk('p', { class: 'hint netview-help' }, esc(t('network.view.help'))));
    const ctx = canvas.getContext('2d');

    /* world → screen */
    let bounds = null;
    const computeBounds = () => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < st.nodes.length; i++) {
        const x = st.pos[2 * i], y = st.pos[2 * i + 1];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (!isFinite(x0)) { x0 = y0 = -1; x1 = y1 = 1; }
      bounds = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(x1 - x0, 1e-9), h: Math.max(y1 - y0, 1e-9) };
    };
    const base = () => Math.min((st.width - 60) / bounds.w, (st.height - 60) / bounds.h);
    const sx = i => (st.pos[2 * i] - bounds.cx) * base() * st.k + st.width / 2 + st.tx;
    const sy = i => (st.pos[2 * i + 1] - bounds.cy) * base() * st.k + st.height / 2 + st.ty;
    let vmin = 0, vmax = 1;
    const computeValues = () => {
      vmin = Infinity; vmax = -Infinity;
      for (const n of st.nodes) { if (n.value < vmin) vmin = n.value; if (n.value > vmax) vmax = n.value; }
      if (!isFinite(vmin)) { vmin = 0; vmax = 1; }
    };
    const radius = i => {
      const v = st.nodes[i].value;
      const f = vmax > vmin ? Math.sqrt((v - vmin) / (vmax - vmin)) : 0.5;
      return (NetworkView.MIN_R + (NetworkView.MAX_R - NetworkView.MIN_R) * f) * Math.min(3, Math.max(0.6, Math.sqrt(st.k)));
    };
    const order = () => st.nodes.map((n, i) => i).sort((a, b) => st.nodes[b].value - st.nodes[a].value || a - b);
    let byValue = [];
    const neighboursOf = i => {
      const s = new Set([i]);
      for (const e of st.edges) { if (e[0] === i) s.add(e[1]); else if (e[1] === i) s.add(e[0]); }
      return s;
    };
    const cssVar = (name, fallback) => { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch (e) { return fallback; } };
    /* rgba strings are cached: an edge colour is asked for thousands of times per frame */
    const alphaCache = new Map();
    const withAlpha = (col, a) => { const key = col + '|' + Math.round(a * 50); let s = alphaCache.get(key); if (!s) { s = Fig.alpha(col, Math.round(a * 50) / 50); alphaCache.set(key, s); } return s; };

    const api = {
      el: root, canvas,
      get state() { return st; },
      draw() {
        const t0 = performance.now();
        st.frame = 0;
        if (!st.width) return 0;
        const bg = cssVar('--card-bg', '#ffffff'), fg = cssVar('--text', '#13233b');
        ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
        ctx.clearRect(0, 0, st.width, st.height);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, st.width, st.height);
        const n = st.nodes.length;
        const X = new Float64Array(n), Y = new Float64Array(n), R = new Float64Array(n);
        for (let i = 0; i < n; i++) { X[i] = sx(i); Y[i] = sy(i); R[i] = radius(i); }
        const sel = st.selected, nb = st.neighbours;
        /* edges */
        ctx.lineCap = 'round';
        for (const e of st.edges) {
          const a = e[0], b = e[1], w = e[2];
          const on = sel < 0 || a === sel || b === sel;
          ctx.strokeStyle = withAlpha(st.nodes[a].color, on ? (sel < 0 ? 0.16 + 0.34 * w : 0.75) : 0.05);
          ctx.lineWidth = 0.5 + 2.5 * w;
          ctx.beginPath(); ctx.moveTo(X[a], Y[a]); ctx.lineTo(X[b], Y[b]); ctx.stroke();
        }
        /* nodes, larger last so small ones stay visible under labels */
        for (let q = byValue.length - 1; q >= 0; q--) {
          const i = byValue[q];
          const dim = sel >= 0 && !nb.has(i);
          ctx.beginPath(); ctx.arc(X[i], Y[i], R[i], 0, 2 * Math.PI);
          ctx.fillStyle = dim ? withAlpha(st.nodes[i].color, 0.2) : st.nodes[i].color;
          ctx.fill();
          ctx.lineWidth = i === sel ? 3 : 1;
          ctx.strokeStyle = i === sel ? fg : bg;
          ctx.stroke();
        }
        /* labels: selected, neighbours, hovered, then the largest nodes, skipping those that would overlap */
        const want = [];
        if (sel >= 0) { want.push(sel); for (const i of byValue) if (i !== sel && nb.has(i)) want.push(i); }
        if (st.hover >= 0) want.push(st.hover);
        const extra = Math.round(st.labelCount * Math.max(1, st.k));
        for (let q = 0; q < byValue.length && q < extra; q++) want.push(byValue[q]);
        const boxes = [], done = new Set();
        ctx.textBaseline = 'middle';
        for (const i of want) {
          if (done.has(i)) continue;
          done.add(i);
          const bold = i === sel || i === st.hover;
          ctx.font = (bold ? '600 ' : '') + '12px system-ui, sans-serif';
          const label = st.nodes[i].label;
          const w = ctx.measureText(label).width;
          /* to the right of the node; to its left when it would run past the right edge of the canvas */
          let x = X[i] + R[i] + 3;
          if (x + w + 2 > st.width && X[i] - R[i] - 3 - w >= 0) x = X[i] - R[i] - 3 - w;
          const y = Y[i];
          const b = [x - 2, y - 8, x + w + 2, y + 8];
          if (b[2] < 0 || b[0] > st.width || b[3] < 0 || b[1] > st.height) continue;
          if (!bold && boxes.some(o2 => b[0] < o2[2] && b[2] > o2[0] && b[1] < o2[3] && b[3] > o2[1])) continue;
          boxes.push(b);
          ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.lineJoin = 'round';
          ctx.strokeText(label, x, y);
          ctx.fillStyle = sel >= 0 && !nb.has(i) && !bold ? withAlpha(fg, 0.45) : fg;
          ctx.fillText(label, x, y);
        }
        st.lastMs = performance.now() - t0;
        st.labelsDrawn = boxes.length;
        return st.lastMs;
      },
      requestDraw() { if (!st.frame) st.frame = requestAnimationFrame(() => api.draw()); },
      resize() {
        const w = Math.max(200, Math.floor(box.clientWidth || st.width || 600));
        st.dpr = window.devicePixelRatio || 1;
        st.width = w;
        canvas.width = Math.round(w * st.dpr); canvas.height = Math.round(st.height * st.dpr);
        canvas.style.width = w + 'px'; canvas.style.height = st.height + 'px';
        api.draw();
      },
      fit() { st.k = 1; st.tx = 0; st.ty = 0; api.requestDraw(); },
      zoomBy(f, cx, cy) {
        const k = Math.min(40, Math.max(0.2, st.k * f));
        const real = k / st.k;
        const px = cx == null ? st.width / 2 : cx, py = cy == null ? st.height / 2 : cy;
        /* keep the point under the cursor in place */
        st.tx = px - st.width / 2 - (px - st.width / 2 - st.tx) * real;
        st.ty = py - st.height / 2 - (py - st.height / 2 - st.ty) * real;
        st.k = k;
        api.requestDraw();
      },
      hit(px, py) {
        let best = -1, bd = Infinity;
        for (let i = 0; i < st.nodes.length; i++) {
          const d = Math.hypot(sx(i) - px, sy(i) - py);
          if (d <= radius(i) + 4 && d < bd) { bd = d; best = i; }
        }
        return best;
      },
      select(i, center) {
        st.selected = i == null ? -1 : i;
        st.neighbours = st.selected >= 0 ? neighboursOf(st.selected) : null;
        if (st.selected >= 0 && center) { st.tx -= sx(st.selected) - st.width / 2; st.ty -= sy(st.selected) - st.height / 2; }
        api.draw();
        if (o.onSelect) o.onSelect(st.selected);
      },
      search(text) {
        const q = fold(String(text || '').trim());
        if (!q) { status.textContent = ''; return -1; }
        let idx = st.nodes.findIndex(n => fold(n.label) === q);
        if (idx < 0) idx = byValue.find(i => fold(st.nodes[i].label).includes(q));
        if (idx == null || idx < 0) { status.textContent = o.notFound || t('network.view.notFound'); return -1; }
        status.textContent = '';
        api.select(idx, true);
        return idx;
      },
      update(p) {
        if (p.nodes) { st.nodes = p.nodes; computeValues(); byValue = order(); fillList(); }
        if (p.labelCount != null) st.labelCount = p.labelCount;
        api.draw();
      },
      destroy() { if (ro) ro.disconnect(); if (st.frame) cancelAnimationFrame(st.frame); },
    };

    const fillList = () => {
      datalist.innerHTML = '';
      byValue.slice(0, 800).forEach(i => datalist.appendChild(mk('option', { value: st.nodes[i].label })));
    };
    computeBounds(); computeValues(); byValue = order(); fillList();

    /* pointer: drag to pan, click to select */
    let down = null;
    canvas.addEventListener('pointerdown', e => {
      down = { x: e.offsetX, y: e.offsetY, tx: st.tx, ty: st.ty, moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    });
    canvas.addEventListener('pointermove', e => {
      if (down) {
        const dx = e.offsetX - down.x, dy = e.offsetY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true;
        if (down.moved) { st.tx = down.tx + dx; st.ty = down.ty + dy; api.requestDraw(); }
        return;
      }
      const h = api.hit(e.offsetX, e.offsetY);
      if (h !== st.hover) { st.hover = h; canvas.style.cursor = h >= 0 ? 'pointer' : 'grab'; api.requestDraw(); }
    });
    canvas.addEventListener('pointerup', e => {
      if (down && !down.moved) api.select(api.hit(e.offsetX, e.offsetY));
      down = null;
    });
    canvas.addEventListener('pointerleave', () => { if (st.hover >= 0) { st.hover = -1; api.requestDraw(); } });
    canvas.addEventListener('wheel', e => { e.preventDefault(); api.zoomBy(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
    canvas.addEventListener('dblclick', e => api.zoomBy(1.6, e.offsetX, e.offsetY));
    canvas.addEventListener('keydown', e => {
      const step = 40;
      if (e.key === '+' || e.key === '=') api.zoomBy(1.25);
      else if (e.key === '-') api.zoomBy(0.8);
      else if (e.key === '0') api.fit();
      else if (e.key === 'ArrowLeft') { st.tx += step; api.requestDraw(); }
      else if (e.key === 'ArrowRight') { st.tx -= step; api.requestDraw(); }
      else if (e.key === 'ArrowUp') { st.ty += step; api.requestDraw(); }
      else if (e.key === 'ArrowDown') { st.ty -= step; api.requestDraw(); }
      else if (e.key === 'Escape') api.select(-1);
      else return;
      e.preventDefault();
    });
    input.addEventListener('change', () => api.search(input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); api.search(input.value); } });
    input.addEventListener('search', () => { if (!input.value) api.select(-1); });

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (Math.floor(box.clientWidth) !== st.width) api.resize(); });
      ro.observe(box);
    }
    requestAnimationFrame(() => api.resize());
    return api;
  },
};

window.NetworkView = NetworkView;
