/* SciMetricsPro — SVG figure engine (shared with the other LABG apps).
   Every figure is drawn as "pure" SVG (inline style attributes, no external CSS)
   so that export to PNG / JPG / WEBP / TIFF / SVG is faithful at any resolution.

   Fig.mount(host, spec) draws a figure with an editor panel (titles, palettes,
   fonts, sizes) and an export bar. spec.render(cfg) must return a new <svg>.

   The engine writes its own labels in English and passes them through figT(), which
   looks them up in the interface dictionary (I18N.phrase). Labels supplied by a
   figure spec are expected to be translated already. */
'use strict';

const Fig = {};
const NS = 'http://www.w3.org/2000/svg';
const figT = (s, vars) => (window.I18N ? I18N.phrase(s, vars)
  : (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s));
/* option lists for figure specs, already translated */
Fig.paletteOptions = () => Object.entries(Fig.paletteNames).map(([k, v]) => [k, figT(v)]);
Fig.colormapOptions = () => Object.entries(Fig.colormapNames).map(([k, v]) => [k, figT(v)]);

/* ================= palettes ================= */
Fig.palettes = {
  scimetrics: ['#1d5bb0', '#e39b2d', '#1f9e8f', '#c8416a', '#6fa83d', '#7b5cc4', '#2f8fb8', '#b8742a', '#9aa22e', '#6d6e71'],
  vivid:    ['#d7263d', '#1b6ca8', '#2e9e5b', '#7b3fa0', '#f08a24', '#8a5a2b', '#e45fa3', '#7d7d7d', '#39a9a0', '#e8c228'],
  harvest:  ['#3a5a40', '#a3b18a', '#dda15e', '#bc6c25', '#588157', '#e9c46a', '#8c5a3c', '#344e41', '#f4a261', '#264653'],
  soil:     ['#5b3a29', '#8c6a4a', '#b89b74', '#d9c8a9', '#3f5f3a', '#7f9f6d', '#c7b446', '#2f4a3a', '#a0522d', '#6b6b6b'],
  ocean:    ['#0b4f6c', '#21a6d6', '#1f9e57', '#f2a93b', '#e8603c', '#5e548e', '#9f86c0', '#2b2d5c', '#c79bc9', '#7aa82a'],
  sunset:   ['#7a0c14', '#c0161b', '#e2461c', '#f07a0b', '#f8a90a', '#fccb3e', '#3d405b', '#81b29a', '#5f7fa8', '#b56576'],
  meadow:   ['#264653', '#2a9d8f', '#8ab17d', '#e9c46a', '#f4a261', '#e76f51', '#6d597a', '#b56576', '#355070', '#d99a6c'],
  bold:     ['#b83227', '#2471a3', '#239954', '#7d3c98', '#d68910', '#9c4a13', '#cf5489', '#5d6d7e', '#17a589', '#b7950b'],
  soft:     ['#7fc8a9', '#f3a683', '#9aa8d6', '#e7a1c8', '#b5d56a', '#f7d86b', '#dcc19e', '#bfbfbf', '#6fae3e', '#dfad2e'],
  deep:     ['#157a62', '#c65d1b', '#6b63a8', '#cf2f7f', '#5d9b2c', '#c9971a', '#98702a', '#5e5e5e', '#2f76a8', '#a94a25'],
  okabe:    ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#000000', '#999999', '#661100'],
  tol:      ['#4477AA', '#EE6677', '#228833', '#CCBB44', '#66CCEE', '#AA3377', '#BBBBBB', '#000000', '#EE7733', '#009988'],
  pastel:   ['#a8c8ec', '#f7bd92', '#9ddcaf', '#f3a6a3', '#cdbff5', '#dcc0a3', '#f2b6de', '#d3d3d3', '#f6f2a4', '#bde8e5'],
  greys:    ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#4b5563', '#1f2937', '#e5e7eb', '#111827', '#6b7280'],
};
Fig.paletteNames = {
  scimetrics: 'SciMetricsPro', vivid: 'Vivid', harvest: 'Harvest', soil: 'Soil & crop', ocean: 'Ocean', sunset: 'Sunset',
  meadow: 'Meadow', bold: 'Bold', soft: 'Soft', deep: 'Deep',
  okabe: 'Okabe & Ito 2008 (colour-blind safe)', tol: 'Tol 2021 (colour-blind safe)', pastel: 'Pastel', greys: 'Greyscale',
};

function lerp(a, b, t) { return a + (b - a) * t; }
function rgb(r, g, b) { return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`; }
function rampFrom(stops) {
  return t => {
    t = Math.max(0, Math.min(1, isFinite(t) ? t : 0));
    const n = stops.length - 1;
    const i = Math.min(n - 1, Math.floor(t * n));
    const u = t * n - i;
    const a = stops[i], b = stops[i + 1];
    return rgb(lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u));
  };
}
Fig.colormaps = {
  viridis: rampFrom([[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]]),
  magma:   rampFrom([[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]]),
  inferno: rampFrom([[0,0,4],[87,16,110],[188,55,84],[249,142,9],[252,255,164]]),
  plasma:  rampFrom([[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]]),
  cividis: rampFrom([[0,32,77],[60,86,120],[124,123,120],[192,164,98],[255,234,70]]),
  /* the diverging and sequential ramps below are original to this program: their stops come from
     anchors in the OKLCH colour space, with lightness rising to the centre and falling to the ends
     (diverging) or falling steadily (sequential), and ends that stay apart under red–green colour blindness */
  rdylbu:  rampFrom([[39,67,135],[105,174,213],[252,245,199],[237,156,85],[165,30,36]]),
  rdbu:    rampFrom([[2,56,105],[151,197,222],[246,239,230],[229,166,146],[144,40,34]]),
  spectral:rampFrom([[86,69,151],[82,200,180],[241,244,182],[248,154,86],[166,31,71]]),
  bluered: rampFrom([[30,71,152],[243,237,230],[190,48,37]]),
  greens:  rampFrom([[241,247,221],[89,180,125],[0,63,51]]),
  ylgn:    rampFrom([[252,250,203],[189,224,126],[71,148,76],[3,71,65]]),
  browns:  rampFrom([[253,245,230],[204,153,102],[102,51,0]]),
  heat:    rampFrom([[255,247,217],[253,146,62],[158,18,43]]),
};
Fig.colormapNames = {
  viridis: 'Viridis', magma: 'Magma', inferno: 'Inferno', plasma: 'Plasma', cividis: 'Cividis (colour-blind safe)',
  rdylbu: 'Red–Yellow–Blue', rdbu: 'Red–Blue (diverging)', spectral: 'Spectral', bluered: 'Blue–White–Red',
  greens: 'Greens', ylgn: 'Yellow–Green', browns: 'Browns (soil)', heat: 'Heat',
};

function parseColor(col) {
  let m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(col);
  if (m) return [+m[1], +m[2], +m[3]];
  m = /^#([0-9a-f]{6})$/i.exec(col);
  if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  m = /^#([0-9a-f]{3})$/i.exec(col);
  if (m) return m[1].split('').map(h => parseInt(h + h, 16));
  return null;
}
Fig.darken = (col, amount) => {
  const c = parseColor(col); if (!c) return col;
  const k = 1 - (amount == null ? 0.35 : amount);
  return rgb(c[0] * k, c[1] * k, c[2] * k);
};
Fig.lighten = (col, amount) => {
  const c = parseColor(col); if (!c) return col;
  const k = amount == null ? 0.5 : amount;
  return rgb(c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k);
};
Fig.alpha = (col, a) => { const c = parseColor(col); return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : col; };
Fig.luminance = col => {
  const c = parseColor(col); if (!c) return 1;
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
};
Fig.onColor = (col, darkFg) => Fig.luminance(col) > 0.55 ? (darkFg || '#1b1f2a') : '#ffffff';
Fig.color = (palette, i) => {
  const p = Fig.palettes[palette] || Fig.palettes.scimetrics;
  return p[i % p.length];
};

/* ================= themes & typography ================= */
Fig.themes = {
  light:   { bg: '#ffffff', fg: '#1b1f2a', muted: '#667085', grid: '#e6e9ef', axis: '#9aa3b2' },
  paper:   { bg: '#fbf9f4', fg: '#2b2b28', muted: '#6b6a63', grid: '#e8e2d6', axis: '#a8a294' },
  dark:    { bg: '#171a22', fg: '#e9edf3', muted: '#98a1b3', grid: '#2a2f3d', axis: '#4b5364' },
  minimal: { bg: '#ffffff', fg: '#111111', muted: '#555555', grid: 'none',    axis: '#111111' },
  journal: { bg: '#ffffff', fg: '#000000', muted: '#333333', grid: 'none',    axis: '#000000' },
};
Fig.themeNames = { light: 'Light', paper: 'Paper', dark: 'Dark', minimal: 'Minimal', journal: 'Journal (black & white axes)' };
/* Only the generic CSS font families: each computer renders them with the sans-serif,
   serif or monospace typeface installed, and no font is named or distributed. */
Fig.fonts = {
  sans: 'sans-serif',
  system: 'system-ui, sans-serif',
  serif: 'serif',
  mono: 'monospace',
};
Fig.fontNames = { sans: 'Sans-serif', system: 'System interface font', serif: 'Serif', mono: 'Monospace' };

/* ================= SVG constructors ================= */
Fig.svg = (w, h, theme) => {
  const t = Fig.themes[theme] || Fig.themes.light;
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('xmlns', NS);
  s.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('width', w);
  s.setAttribute('height', h);
  s.dataset.w = w; s.dataset.h = h;
  s.appendChild(Fig.el('rect', { x: 0, y: 0, width: w, height: h, fill: t.bg, 'data-bg': '1' }));
  return s;
};
Fig.el = (tag, attrs, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
};
Fig.g = attrs => Fig.el('g', attrs);

/* ---------- typographic scale ----------
   Multipliers in force while a figure is drawn. Fig.mount sets them before
   calling render, so EVERY text that goes through Fig.text is affected.
   Roles: 'title'/'subtitle' → titles · 'axis'/'tick' → axes and ticks ·
   'legend'/'label' (default) → labels and legends. */
Fig._fs = { title: 1, axis: 1, label: 1 };
Fig.fsGroup = role =>
  (role === 'title' || role === 'subtitle') ? 'title'
    : (role === 'axis' || role === 'tick') ? 'axis' : 'label';
Fig.fs = role => Fig._fs[Fig.fsGroup(role)] || 1;
Fig.setFontScale = cfg => {
  const g = +cfg.fontScale || 1;
  Fig._fs = { title: g * (+cfg.fsTitle || 1), axis: g * (+cfg.fsAxis || 1), label: g * (+cfg.fsLabel || 1) };
};

/* Statistic names written with an underscore (F_ST, Φ_PT, N_e, r̄_d …) are set
   with a true subscript. Only these symbols qualify, so sample or locus names
   that contain underscores (Oaxaca_north, 7945_2) are left as they are. */
Fig.SUB_RE = /(?<![A-Za-z0-9])(r̄|G′|G'|F|Φ|G|P|Q|N|H|I|D|θ)_(ST|IS|IT|CT|SC|PT|RT|S|T|e|A|d|B|ij)(?![A-Za-z0-9])/g;
Fig.subHTML = str => esc(String(str)).replace(Fig.SUB_RE, '$1<sub>$2</sub>');
function setSubscripts(node, str, size) {
  const s = String(str);
  Fig.SUB_RE.lastIndex = 0;
  if (!Fig.SUB_RE.test(s)) return;
  Fig.SUB_RE.lastIndex = 0;
  node.textContent = '';
  const drop = +(size * 0.28).toFixed(2);
  let cur = 0, last = 0, m;
  const add = (txt, sub) => {
    if (!txt) return;
    const want = sub ? drop : 0;
    const t = document.createElementNS(NS, 'tspan');
    if (want !== cur) t.setAttribute('dy', +(want - cur).toFixed(2));
    if (sub) t.setAttribute('font-size', +(size * 0.72).toFixed(2));
    t.textContent = txt;
    node.appendChild(t);
    cur = want;
  };
  while ((m = Fig.SUB_RE.exec(s))) {
    add(s.slice(last, m.index) + m[1], false);
    add(m[2], true);
    last = m.index + m[0].length;
  }
  add(s.slice(last), false);
}

Fig.text = (x, y, str, o) => {
  o = o || {};
  const size = (o.size || 12) * Fig.fs(o.role);
  const node = Fig.el('text', {
    stroke: o.halo || null,
    'stroke-width': o.halo ? (o.haloWidth || 3) * Fig.fs(o.role) : null,
    'stroke-linejoin': o.halo ? 'round' : null,
    'paint-order': o.halo ? 'stroke fill' : null,
    x, y,
    'font-family': o.font || Fig.fonts.sans,
    'font-size': +size.toFixed(2),
    'font-weight': o.weight || 'normal',
    'font-style': o.italic ? 'italic' : null,
    fill: o.fill || '#1b1f2a',
    'text-anchor': o.anchor || 'start',
    'dominant-baseline': o.baseline || null,
    transform: o.rotate ? `rotate(${o.rotate} ${x} ${y})` : null,
    opacity: o.opacity != null ? o.opacity : null,
  }, str);
  if (str != null) setSubscripts(node, str, size);
  return node;
};

/* ================= scales & axes ================= */
Fig.scaleLinear = (d0, d1, r0, r1) => {
  const span = (d1 - d0) || 1;
  const f = v => r0 + (v - d0) / span * (r1 - r0);
  f.invert = q => d0 + (q - r0) / ((r1 - r0) || 1) * span;
  f.domain = [d0, d1]; f.range = [r0, r1];
  return f;
};
Fig.scaleBand = (labels, r0, r1, padding) => {
  padding = padding == null ? 0.2 : padding;
  const n = labels.length || 1;
  const step = (r1 - r0) / n;
  const bw = step * (1 - padding);
  const f = i => r0 + step * (typeof i === 'number' ? i : labels.indexOf(i)) + step * padding / 2;
  f.bandwidth = bw; f.step = step; f.center = i => f(i) + bw / 2;
  return f;
};
Fig.ticks = (min, max, count) => {
  count = count || 6;
  const span = (max - min) || 1;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toFixed(10));
  }
  return out;
};
Fig.fmtTick = v => {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-4 || a >= 1e6) return v.toExponential(1);
  return String(+v.toFixed(6));
};
/* "nice" domain padded a little, with optional zero inclusion */
Fig.niceDomain = (min, max, includeZero) => {
  if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.05;
  const t = Fig.ticks(min - pad, max + pad, 6);
  const step = t.length > 1 ? t[1] - t[0] : (max - min) / 5;
  const lo = includeZero && min === 0 ? 0 : Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;
  return [lo, hi];
};

/* Standard frame: title, subtitle, axes, gridlines. Returns {g, x, y} helpers.
   cfg keys used: theme, font, title, subtitle, xlab, ylab, grid, box */
Fig.frame = (svg, cfg, o) => {
  const t = Fig.themes[cfg.theme] || Fig.themes.light;
  const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
  const W = +svg.dataset.w, H = +svg.dataset.h;
  const m = Object.assign({ top: 56, right: 24, bottom: 62, left: 74 }, o.margin || {});
  if (!cfg.title) m.top -= 22;
  if (cfg.subtitle) m.top += 16;
  /* a title wider than the figure goes on more lines (a one-column figure printed at its text size is narrow) */
  const titleLines = cfg.title ? Fig.wrapLines(cfg.title, W - 16, 17 * Fig.fs('title'), font, 'bold') : [];
  const titleLh = 17 * Fig.fs('title') * 1.2;
  const extra = Math.max(0, titleLines.length - 1) * titleLh;
  m.top += extra;
  const x0 = m.left, x1 = W - m.right, y0 = m.top, y1 = H - m.bottom;
  const g = Fig.g({ 'font-family': font });
  svg.appendChild(g);
  titleLines.forEach((line, k) => g.appendChild(Fig.text(W / 2, 26 + k * titleLh, line, { size: 17, weight: 'bold', anchor: 'middle', fill: t.fg, font, role: 'title' })));
  if (cfg.subtitle) g.appendChild(Fig.text(W / 2, 26 + extra + 18 * Fig.fs('title'), cfg.subtitle, { size: 12, anchor: 'middle', fill: t.muted, font, role: 'subtitle' }));
  return { g, x0, x1, y0, y1, W, H, t, font, m };
};
/* draw linear y axis with grid; sc = Fig.scaleLinear; f = frame */
Fig.axisY = (f, sc, cfg, o) => {
  o = o || {};
  const ticks = o.ticks || Fig.ticks(sc.domain[0], sc.domain[1], o.count || 6);
  const g = Fig.g();
  ticks.forEach(v => {
    if (v < sc.domain[0] - 1e-9 || v > sc.domain[1] + 1e-9) return;
    const y = sc(v);
    if (cfg.grid !== false && f.t.grid !== 'none')
      g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y, y2: y, stroke: f.t.grid, 'stroke-width': 1, 'stroke-dasharray': cfg.gridDash ? '3 3' : null }));
    g.appendChild(Fig.el('line', { x1: f.x0 - 5, x2: f.x0, y1: y, y2: y, stroke: f.t.axis, 'stroke-width': 1 }));
    g.appendChild(Fig.text(f.x0 - 9, y + 4, o.fmt ? o.fmt(v) : Fig.fmtTick(v), { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick' }));
  });
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x0, y1: f.y0, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
  if (cfg.ylab) g.appendChild(Fig.text(20, (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font: f.font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
  f.g.appendChild(g);
  return g;
};
Fig.axisX = (f, sc, cfg, o) => {
  o = o || {};
  let ticks = o.ticks;
  /* fewer ticks when their labels would touch each other (a narrow figure printed at one column) */
  if (!ticks) {
    for (let count = o.count || 6; ; count--) {
      ticks = Fig.ticks(sc.domain[0], sc.domain[1], count);
      const shown = ticks.filter(v => v >= sc.domain[0] - 1e-9 && v <= sc.domain[1] + 1e-9);
      const widest = Math.max(0, ...shown.map(v => Fig.measure(o.fmt ? o.fmt(v) : Fig.fmtTick(v), 11 * Fig.fs('tick'), f.font)));
      if (count <= 2 || shown.length * (widest + 10) <= Math.abs(f.x1 - f.x0)) break;
    }
  }
  const g = Fig.g();
  ticks.forEach(v => {
    if (v < sc.domain[0] - 1e-9 || v > sc.domain[1] + 1e-9) return;
    const x = sc(v);
    if (cfg.grid !== false && f.t.grid !== 'none' && o.grid !== false)
      g.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y0, y2: f.y1, stroke: f.t.grid, 'stroke-width': 1, 'stroke-dasharray': cfg.gridDash ? '3 3' : null }));
    g.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
    g.appendChild(Fig.text(x, f.y1 + 18, o.fmt ? o.fmt(v) : Fig.fmtTick(v), { size: 11, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'tick' }));
  });
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
  if (cfg.xlab) g.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 44, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
  f.g.appendChild(g);
  return g;
};
/* ---------- text measurement (for layouts that must not overlap) ---------- */
let measureCtx = null;
Fig.measure = (str, size, font, weight) => {
  if (!measureCtx) { try { measureCtx = document.createElement('canvas').getContext('2d'); } catch (e) { measureCtx = null; } }
  if (!measureCtx) return String(str).length * size * 0.58;
  measureCtx.font = `${weight || 'normal'} ${size}px ${font || 'sans-serif'}`;
  return measureCtx.measureText(String(str)).width;
};
/* words of a text on lines no wider than room (a single long word keeps its own line) */
Fig.wrapLines = (str, room, size, font, weight) => {
  const lines = [];
  let cur = '';
  String(str).split(/\s+/).filter(Boolean).forEach(w => {
    const next = cur ? cur + ' ' + w : w;
    if (!cur || Fig.measure(next, size, font, weight) <= room) cur = next; else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines;
};
/* a text cut with an ellipsis so that it is no wider than room */
Fig.fitText = (str, room, size, font, weight) => {
  let s = String(str);
  if (room <= 0 || Fig.measure(s, size, font, weight) <= room) return s;
  while (s.length > 1 && Fig.measure(s + '…', size, font, weight) > room) s = s.slice(0, -1);
  return s.trimEnd() + '…';
};

/* How category labels fit under a band axis. cfg.tickAngle: 'auto' | '0' | '45' | '90'.
   Horizontal labels wrap onto up to three lines before the app turns them. */
Fig.bandLabelLayout = (labels, step, cfg, o) => {
  o = o || {};
  const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
  let size = 11 * Fig.fs('tick');
  const room = step * 0.94;
  const wrap = lab => {
    const words = String(lab).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (!cur || Fig.measure(t, size, font) <= room) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  };
  const longest = Math.max(0, ...labels.map(l => Fig.measure(String(l), size, font)));
  const pref = String(cfg.tickAngle || 'auto');
  let angle = 0, lines = null;
  if (pref === '45') angle = -45;
  else if (pref === '90') angle = -90;
  else if (pref === '0') {
    lines = labels.map(wrap);
    /* a single word still too long: shrink the type, down to 70% */
    const worst = Math.max(...lines.map(ls => Math.max(...ls.map(t => Fig.measure(t, size, font)))));
    if (worst > room) size = Math.max(size * 0.7, size * room / worst);
  } else {
    if (o.rotate === 0 || longest <= room) angle = 0;
    else {
      const wrapped = labels.map(wrap);
      const ok = wrapped.every(ls => ls.length <= 3 && ls.every(t => Fig.measure(t, size, font) <= room));
      if (ok) lines = wrapped; else angle = o.rotate != null ? o.rotate : -45;
    }
  }
  const lh = size * 1.15;
  const depth = angle === 0
    ? (lines ? Math.max(...lines.map(l => l.length)) : 1) * lh + 12
    : Math.abs(Math.sin(angle * Math.PI / 180)) * longest + size + 12;
  return { angle, lines, size, depth, lh };
};

/* categorical x axis */
Fig.axisXBand = (f, band, labels, cfg, o) => {
  o = o || {};
  const L = o.layout || Fig.bandLabelLayout(labels, band.step, cfg, o);
  const g = Fig.g();
  labels.forEach((lab, i) => {
    const x = band.center(i);
    g.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
    if (String(lab) === '') return;
    if (L.angle === 0) {
      const ls = L.lines ? L.lines[i] : [String(lab)];
      const t = Fig.el('text', { x, y: f.y1 + 8 + L.lh * 0.85, 'font-family': f.font, 'font-size': +L.size.toFixed(2), fill: f.t.fg, 'text-anchor': 'middle' });
      ls.forEach((s, k) => t.appendChild(Fig.el('tspan', { x, dy: k ? L.lh.toFixed(2) : null }, s)));
      g.appendChild(t);
    } else {
      /* nudge so the rotated text's middle, not its baseline, sits under the tick */
      g.appendChild(Fig.text(x + L.size * (L.angle === -90 ? 0.35 : 0.25), f.y1 + 12, String(lab), { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick', rotate: L.angle }));
    }
  });
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
  if (cfg.xlab) g.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + L.depth + 18 * Fig.fs('axis'), cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
  f.g.appendChild(g);
  return g;
};

/* categorical y axis (flipped charts): labels at the left, read horizontally */
Fig.axisYBand = (f, band, labels, cfg) => {
  const g = Fig.g();
  let longest = 0;
  /* a name longer than the margin (at most half the figure) is cut with an ellipsis: otherwise the drawing grows to hold
     it and a figure printed at a given width prints all its text smaller */
  const size = 11 * Fig.fs('tick');
  const room = f.x0 - 13 - (cfg.xlab ? 26 * Fig.fs('axis') : 0);
  labels.forEach((lab, i) => {
    const y = band.center(i);
    const text = Fig.fitText(lab, room, size, f.font);
    g.appendChild(Fig.el('line', { x1: f.x0 - 5, x2: f.x0, y1: y, y2: y, stroke: f.t.axis, 'stroke-width': 1 }));
    g.appendChild(Fig.text(f.x0 - 9, y, text, { size: 11, anchor: 'end', baseline: 'central', fill: f.t.fg, font: f.font, role: 'tick' }));
    longest = Math.max(longest, Fig.measure(text, size, f.font));
  });
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x0, y1: f.y0, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
  if (cfg.xlab) g.appendChild(Fig.text(f.x0 - longest - 24 * Fig.fs('axis'), (f.y0 + f.y1) / 2, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font: f.font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
  f.g.appendChild(g);
  return g;
};

/* A chart of categories against values that can be drawn upright or flipped
   (horizontal bars, like coord_flip). Plots place their marks through C, never
   through raw x/y, so every bar, whisker, reference line and value label follows
   the orientation. pos = pixel position along the category axis. */
Fig.bandPlot = (svg, cfg, labels, dom, o) => {
  o = o || {};
  const flip = !!cfg.flip;
  svg.dataset.band = '1';
  const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
  const W = +svg.dataset.w, H = +svg.dataset.h;
  const base = Object.assign({ top: 56, right: 30, bottom: 96, left: 74 }, o.margin || {});
  const catLab = cfg.xlab || o.catLabel, valLab = cfg.ylab || o.valueLabel;
  let margin, layout = null;
  if (flip) {
    const longest = Math.max(0, ...labels.map(l => Fig.measure(String(l), 11 * Fig.fs('tick'), font)));
    margin = Object.assign({}, base, { left: Math.min(W * 0.5, longest + 22 + (catLab ? 26 * Fig.fs('axis') : 0)), bottom: 50 + (valLab ? 22 * Fig.fs('axis') : 0), right: Math.max(base.right, 40) });
  } else {
    const step = (W - base.left - base.right) / Math.max(1, labels.length);
    layout = Fig.bandLabelLayout(labels, step, cfg, o);
    margin = Object.assign({}, base, { bottom: Math.max(40, layout.depth + 16 + (catLab ? 26 * Fig.fs('axis') : 0)) });
  }
  const axisDepth = margin.bottom;
  if (o.legendBottom) margin.bottom += 30 * Fig.fs('legend');
  /* flipped bars run to the right edge, where a legend would cover them: move it outside */
  const legendOut = flip && o.legendLabels && o.legendLabels.length && (cfg.legendPos || 'right') === 'right';
  if (legendOut) {
    const fsL = 11 * Fig.fs('legend');
    margin.right = Math.max(margin.right, Math.max(...o.legendLabels.map(s => String(s).length)) * fsL * 0.58 + 26 + 24);
  }
  const f = Fig.frame(svg, cfg, { margin });
  f.axisDepth = axisDepth;
  f.legendOutside = !!legendOut;
  const cat = Fig.scaleBand(labels, flip ? f.y0 : f.x0, flip ? f.y1 : f.x1, o.padding == null ? 0.3 : o.padding);
  const val = flip ? Fig.scaleLinear(dom[0], dom[1], f.x0, f.x1) : Fig.scaleLinear(dom[0], dom[1], f.y1, f.y0);
  if (flip) {
    Fig.axisX(f, val, Object.assign({}, cfg, { xlab: valLab }), { fmt: o.fmt });
    Fig.axisYBand(f, cat, labels, Object.assign({}, cfg, { xlab: catLab }));
  } else {
    Fig.axisY(f, val, Object.assign({}, cfg, { ylab: valLab }), { fmt: o.fmt });
    Fig.axisXBand(f, cat, labels, Object.assign({}, cfg, { xlab: catLab }), { layout });
  }
  const clampV = v => Math.min(Math.max(v, Math.min(dom[0], dom[1])), Math.max(dom[0], dom[1]));
  const baseV = clampV(0);
  const P = (pos, v) => (flip ? [val(v), pos] : [pos, val(v)]);
  const C = {
    f, flip, cat, val, bw: cat.bandwidth, step: cat.step, dom,
    start: i => cat(i), center: i => cat.center(i), P,
    rect(pos, width, v0, v1, attrs) {
      const a = val(v0), b = val(v1);
      const r = flip ? { x: Math.min(a, b), y: pos, width: Math.abs(b - a), height: width } : { x: pos, y: Math.min(a, b), width, height: Math.abs(b - a) };
      return Fig.el('rect', Object.assign(r, attrs || {}));
    },
    bar(i, v, attrs, from) { return C.rect(cat(i), cat.bandwidth, from == null ? baseV : from, v, attrs); },
    line(pos0, v0, pos1, v1, attrs) { const [x1, y1] = P(pos0, v0), [x2, y2] = P(pos1, v1); return Fig.el('line', Object.assign({ x1, y1, x2, y2 }, attrs || {})); },
    whisker(pos, v0, v1, capHalf, attrs) {
      const g = Fig.g();
      g.appendChild(C.line(pos, v0, pos, v1, attrs));
      if (capHalf) [v0, v1].forEach(v => g.appendChild(C.line(pos - capHalf, v, pos + capHalf, v, attrs)));
      return g;
    },
    ref(v, attrs) { return flip ? Fig.el('line', Object.assign({ x1: val(v), x2: val(v), y1: f.y0, y2: f.y1 }, attrs || {})) : Fig.el('line', Object.assign({ x1: f.x0, x2: f.x1, y1: val(v), y2: val(v) }, attrs || {})); },
    span(v0, v1, attrs) { const a = val(v0), b = val(v1); return Fig.el('rect', Object.assign(flip ? { x: Math.min(a, b), y: f.y0, width: Math.abs(b - a), height: f.y1 - f.y0 } : { x: f.x0, y: Math.min(a, b), width: f.x1 - f.x0, height: Math.abs(b - a) }, attrs || {})); },
    refLabel(v, str, opts) {
      return flip ? Fig.text(val(v) + 5, f.y0 + 12, str, Object.assign({ size: 10, font: f.font, role: 'label', halo: f.t.bg }, opts, { anchor: 'start' }))
        : Fig.text(f.x1 - 4, val(v) - 6, str, Object.assign({ size: 10, font: f.font, role: 'label', halo: f.t.bg }, opts, { anchor: 'end' }));
    },
    /* a value written just beyond the end of its bar (or whisker) */
    valueText(pos, v, str, opts, gap) {
      gap = gap == null ? 6 : gap;
      const neg = v < baseV;
      const base = { size: 10, fill: f.t.fg, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2.5 };
      return flip ? Fig.text(val(v) + (neg ? -gap : gap), pos, str, Object.assign(base, opts, { anchor: neg ? 'end' : 'start', baseline: 'central' }))
        : Fig.text(pos, val(v) + (neg ? gap + 10 : -gap), str, Object.assign(base, opts, { anchor: 'middle' }));
    },
    textAt(pos, v, str, opts) { const [x, y] = P(pos, v); return Fig.text(x, y, str, Object.assign({ size: 10, font: f.font, role: 'label' }, opts, { anchor: 'middle', baseline: 'central' })); },
    marker(pos, v, r, shape, attrs) { const [x, y] = P(pos, v); return Fig.marker(x, y, r, shape, attrs); },
    path(points) { return points.map((p, k) => { const [x, y] = P(p[0], p[1]); return (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join(' '); },
    /* a note along the category axis end (e.g. "Σ 43%" above each bar, or at the right when flipped) */
    edgeText(pos, str, opts) {
      return flip ? Fig.text(f.x1 + 4, pos, str, Object.assign({ size: 9, font: f.font, role: 'label' }, opts, { anchor: 'start', baseline: 'central' }))
        : Fig.text(pos, f.y0 + 12, str, Object.assign({ size: 9, font: f.font, role: 'label' }, opts, { anchor: 'middle' }));
    },
  };
  return C;
};

/* ---------- labels that push each other apart (like ggrepel) ----------
   items: [{x, y, text, size?, weight?, fill?, r?}] anchored at data points;
   o.obstacles: unlabelled points to keep clear. Labels stay inside the plot
   area, and a thin leader joins a label that had to move away from its point. */
Fig.repelLabels = (g, f, items, o) => {
  o = o || {};
  if (!items.length) return;
  const font = f.font;
  const pad = 2;
  const L = items.map(it => {
    const size = (it.size || 9.5) * Fig.fs('label');
    const w = Fig.measure(it.text, size, font, it.weight) + 2 * pad, h = size * 1.2 + pad;
    const dx = 6, dy = -5;
    return { it, size, w, h, cx: it.x + dx + w / 2, cy: it.y + dy - h / 2 + size * 0.35, ax: it.x, ay: it.y, r: it.r || 4 };
  });
  const x0 = f.x0 + 2, x1 = f.x1 - 2, y0 = f.y0 + 2, y1 = f.y1 - 2;
  /* unlabelled points also push labels off them (skipped for very crowded plots) */
  const others = (o.obstacles || []).length <= (o.maxObstacles || 800) ? (o.obstacles || []) : [];
  const pts = items.map(it => [it.x, it.y, it.r || 4]).concat(others.map(p => [p.x, p.y, p.r || 4]));
  /* Greedy placement. Each label tries positions on growing rings around its
     point (nearest first) and takes the first one that covers no placed label
     and no point; if none is free, the one with the least overlap. Bold labels
     (group names) are placed first, then the most crowded points. */
  const gap = 1.5, cell = 40;
  const key = (i, j) => i + ',' + j;
  const ptGrid = new Map(), boxGrid = new Map();
  const put = (grid, x0_, y0_, x1_, y1_, v) => {
    for (let i = Math.floor(x0_ / cell); i <= Math.floor(x1_ / cell); i++)
      for (let j = Math.floor(y0_ / cell); j <= Math.floor(y1_ / cell); j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(v); }
  };
  pts.forEach(p => put(ptGrid, p[0] - p[2], p[1] - p[2], p[0] + p[2], p[1] + p[2], p));
  const near = (grid, bx0, by0, bx1, by1) => {
    const seen = new Set();
    for (let i = Math.floor(bx0 / cell); i <= Math.floor(bx1 / cell); i++)
      for (let j = Math.floor(by0 / cell); j <= Math.floor(by1 / cell); j++) (grid.get(key(i, j)) || []).forEach(v => seen.add(v));
    return seen;
  };
  const crowd = L.map(l => near(ptGrid, l.ax - 30, l.ay - 30, l.ax + 30, l.ay + 30).size);
  const order = L.map((_, i) => i).sort((a, b) => (L[b].it.weight === 'bold') - (L[a].it.weight === 'bold') || crowd[b] - crowd[a]);
  const dirs = [];
  const NA = 24;
  for (let k = 0; k < NA; k++) dirs.push((-Math.PI / 4) + k * 2 * Math.PI / NA);   /* start at upper right */
  const maxRing = o.maxDistance || 160, step = 4;
  order.forEach(idx => {
    const l = L[idx];
    let best = null, bestCost = Infinity;
    search:
    for (let r = 0; r <= maxRing; r += step) {
      for (const a of dirs) {
        const ca = Math.cos(a), sa = -Math.sin(a);
        /* a ring that hugs the box: the label's near edge sits r px beyond the point */
        const cx = l.ax + ca * (l.w / 2 + l.r + 2 + r), cy = l.ay + sa * (l.h / 2 + l.r + 1 + r);
        const bx0 = cx - l.w / 2, by0 = cy - l.h / 2, bx1 = cx + l.w / 2, by1 = cy + l.h / 2;
        if (bx0 < x0 || bx1 > x1 || by0 < y0 || by1 > y1) continue;
        let cost = 0;
        near(boxGrid, bx0 - gap, by0 - gap, bx1 + gap, by1 + gap).forEach(b => {
          const ox = Math.min(bx1, b[2]) + gap - Math.max(bx0, b[0]), oy = Math.min(by1, b[3]) + gap - Math.max(by0, b[1]);
          if (ox > 0 && oy > 0) cost += ox * oy;
        });
        near(ptGrid, bx0, by0, bx1, by1).forEach(p => {
          const ox = Math.min(bx1, p[0] + p[2]) - Math.max(bx0, p[0] - p[2]), oy = Math.min(by1, p[1] + p[2]) - Math.max(by0, p[1] - p[2]);
          if (ox > 0 && oy > 0) cost += ox * oy * 2;
        });
        if (cost === 0) { best = [cx, cy]; break search; }
        const total = cost + r * 0.5;
        if (total < bestCost) { bestCost = total; best = [cx, cy]; }
      }
    }
    if (!best) best = [Math.min(Math.max(l.ax + 6 + l.w / 2, x0 + l.w / 2), x1 - l.w / 2), Math.min(Math.max(l.ay - l.h / 2, y0 + l.h / 2), y1 - l.h / 2)];
    l.cx = best[0]; l.cy = best[1];
    const box = [l.cx - l.w / 2, l.cy - l.h / 2, l.cx + l.w / 2, l.cy + l.h / 2];
    put(boxGrid, box[0], box[1], box[2], box[3], box);
  });
  L.forEach(l => {
    const tx = l.cx - l.w / 2 + pad, ty = l.cy + l.size * 0.35;
    /* the nearest point of the label box to its anchor */
    const nx = Math.min(Math.max(l.ax, l.cx - l.w / 2), l.cx + l.w / 2), ny = Math.min(Math.max(l.ay, l.cy - l.h / 2), l.cy + l.h / 2);
    const dist = Math.hypot(nx - l.ax, ny - l.ay);
    /* o.leaderFromEdge: the leader starts at the edge of a large marker instead of its centre */
    const skip = o.leaderFromEdge ? Math.min(l.r, dist) : 0;
    if (o.leaders !== false && dist - skip > (o.leaderMin || 9)) g.appendChild(Fig.el('line', { x1: l.ax + (nx - l.ax) * skip / dist, y1: l.ay + (ny - l.ay) * skip / dist, x2: nx, y2: ny, stroke: o.leaderColour || f.t.muted, 'stroke-width': 0.6, opacity: 0.8 }));
    g.appendChild(Fig.text(tx, ty, l.it.text, { size: l.it.size || 9.5, fill: l.it.fill || f.t.fg, font, weight: l.it.weight, role: 'label', halo: f.t.bg, haloWidth: 2.5 }));
  });
};
/* legend: items [{label, color, shape?}] placed at top-right inside plot */
Fig.legend = (f, items, cfg, o) => {
  o = o || {};
  const g = Fig.g();
  const fs = 11 * Fig.fs('legend');
  const lh = fs * 1.55;
  const pos = cfg.legendPos || o.pos || 'right';
  if (pos === 'none') return g;
  let x, y;
  const longest = Math.max(...items.map(i => String(i.label).length)) * fs * 0.58 + 26;
  /* a plot that reserved a right margin wide enough gets its legend there, off the data */
  const outside = f.legendOutside || (f.m && f.m.right >= longest + 24);
  if (pos === 'right') { x = outside ? f.x1 + 20 : f.x1 - longest; y = f.y0 + 8; }
  else if (pos === 'left') { x = f.x0 + 10; y = f.y0 + 8; }
  else if (pos === 'bottom') { x = f.x0; y = f.y1 + (f.axisDepth != null ? f.axisDepth : 40 * Fig.fs('axis') + 18) + (f.axisDepth != null ? 6 : 0); }
  else { x = f.x1 - longest; y = f.y0 + 8; }
  if (pos === 'bottom') {
    /* one row while it fits in the figure; otherwise the items go on to more rows (the figure grows downwards, so a figure
       printed at a given width keeps its text size) */
    const right = (f.W || f.x1) - 6;
    /* an item longer than the whole row is cut with an ellipsis */
    const room = right - 8 - fs - 5;
    const labels = items.map(it => Fig.fitText(it.label, room, fs, f.font));
    const widths = labels.map(s => fs + 5 + Fig.measure(s, fs, f.font) + 18);
    /* aligned with the plot, or further left when its widest item would not fit there */
    x = Math.max(8, Math.min(x, right - Math.max(...widths) + 18));
    let cx = x, cy = y;
    items.forEach((it, i) => {
      if (cx > x && cx + widths[i] - 18 > right) { cx = x; cy += lh; }
      if (it.shape === 'line') g.appendChild(Fig.el('line', { x1: cx, x2: cx + fs, y1: cy - fs * 0.35, y2: cy - fs * 0.35, stroke: it.color, 'stroke-width': 2.5 }));
      else if (it.shape === 'circle') g.appendChild(Fig.el('circle', { cx: cx + fs / 2, cy: cy - fs * 0.35, r: fs * 0.45, fill: it.color }));
      else g.appendChild(Fig.el('rect', { x: cx, y: cy - fs * 0.85, width: fs, height: fs, fill: it.color, rx: 2 }));
      const tx = Fig.text(cx + fs + 5, cy, labels[i], { size: 11, fill: f.t.fg, font: f.font, role: 'legend' });
      g.appendChild(tx);
      cx += widths[i];
    });
  } else {
    if (o.box !== false) g.appendChild(Fig.el('rect', { x: x - 8, y: y - 6, width: longest + 4, height: items.length * lh + 8, fill: f.t.bg, stroke: f.t.grid === 'none' ? f.t.axis : f.t.grid, rx: 4, opacity: 0.92 }));
    items.forEach((it, i) => {
      const yy = y + i * lh + fs * 0.85;
      if (it.shape === 'line') g.appendChild(Fig.el('line', { x1: x, x2: x + fs, y1: yy - fs * 0.35, y2: yy - fs * 0.35, stroke: it.color, 'stroke-width': 2.5 }));
      else if (it.shape === 'circle') g.appendChild(Fig.el('circle', { cx: x + fs / 2, cy: yy - fs * 0.35, r: fs * 0.45, fill: it.color, stroke: it.stroke || null, 'stroke-width': it.stroke ? 1 : null }));
      else g.appendChild(Fig.el('rect', { x, y: yy - fs * 0.85, width: fs, height: fs, fill: it.color, rx: 2 }));
      g.appendChild(Fig.text(x + fs + 6, yy, it.label, { size: 11, fill: f.t.fg, font: f.font, role: 'legend' }));
    });
  }
  f.g.appendChild(g);
  return g;
};
/* point marker of a given shape */
Fig.marker = (x, y, r, shape, attrs) => {
  attrs = attrs || {};
  switch (shape) {
    case 'square': return Fig.el('rect', Object.assign({ x: x - r, y: y - r, width: 2 * r, height: 2 * r }, attrs));
    case 'triangle': return Fig.el('polygon', Object.assign({ points: `${x},${y - r * 1.2} ${x - r * 1.1},${y + r * 0.8} ${x + r * 1.1},${y + r * 0.8}` }, attrs));
    case 'diamond': return Fig.el('polygon', Object.assign({ points: `${x},${y - r * 1.3} ${x + r * 1.3},${y} ${x},${y + r * 1.3} ${x - r * 1.3},${y}` }, attrs));
    case 'cross': { const g = Fig.g(attrs); g.appendChild(Fig.el('line', { x1: x - r, x2: x + r, y1: y - r, y2: y + r, stroke: attrs.fill || '#000', 'stroke-width': 1.8 })); g.appendChild(Fig.el('line', { x1: x - r, x2: x + r, y1: y + r, y2: y - r, stroke: attrs.fill || '#000', 'stroke-width': 1.8 })); return g; }
    default: return Fig.el('circle', Object.assign({ cx: x, cy: y, r }, attrs));
  }
};
Fig.shapes = ['circle', 'square', 'triangle', 'diamond', 'cross'];

/* ================= export ================= */
Fig.serialize = svg => {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
    new XMLSerializer().serializeToString(clone);
};

/* ---- CRC32 (for PNG chunk injection) ---- */
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
/* Insert a pHYs chunk so the PNG carries its DPI (journals check this). */
Fig.pngWithDpi = (buf, dpi) => {
  const src = new Uint8Array(buf);
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);            // 'pHYs'
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  /* IHDR is always first: 8 sig + 4 len + 4 type + 13 data + 4 crc = 33 */
  const out = new Uint8Array(src.length + chunk.length);
  out.set(src.subarray(0, 33), 0); out.set(chunk, 33); out.set(src.subarray(33), 33 + chunk.length);
  return out;
};
/* The browser writes JPEGs with a JFIF header of "no units, 1:1"; programs then read them
   at 72 or 96 dpi. Setting units to dots per inch carries the chosen resolution. */
Fig.jpgWithDpi = (buf, dpi) => {
  const b = new Uint8Array(buf);
  const jfif = b[2] === 0xFF && b[3] === 0xE0 && b[6] === 0x4A && b[7] === 0x46 && b[8] === 0x49 && b[9] === 0x46 && b[10] === 0;
  if (jfif) { const d = Math.max(1, Math.min(65535, Math.round(dpi))); b[13] = 1; b[14] = d >> 8; b[15] = d & 255; b[16] = d >> 8; b[17] = d & 255; }
  return b;
};
/* Minimal uncompressed RGB TIFF encoder with resolution tags (baseline TIFF 6.0). */
Fig.encodeTiff = (imageData, dpi) => {
  const { width: w, height: h, data } = imageData;
  const nPix = w * h, rgbBytes = nPix * 3;
  const nEntries = 12;
  const ifdOffset = 8;
  const ifdSize = 2 + nEntries * 12 + 4;
  const extraOffset = ifdOffset + ifdSize;          // bitsPerSample (6) + xres (8) + yres (8)
  const dataOffset = extraOffset + 6 + 8 + 8;
  const buf = new ArrayBuffer(dataOffset + rgbBytes);
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  u8[0] = 0x49; u8[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, ifdOffset, true);
  let p = ifdOffset;
  dv.setUint16(p, nEntries, true); p += 2;
  const entry = (tag, type, count, value) => { dv.setUint16(p, tag, true); dv.setUint16(p + 2, type, true); dv.setUint32(p + 4, count, true); if (type === 3 && count === 1) dv.setUint16(p + 8, value, true); else dv.setUint32(p + 8, value, true); p += 12; };
  entry(256, 4, 1, w);                    // ImageWidth
  entry(257, 4, 1, h);                    // ImageLength
  entry(258, 3, 3, extraOffset);          // BitsPerSample → offset
  entry(259, 3, 1, 1);                    // Compression: none
  entry(262, 3, 1, 2);                    // Photometric: RGB
  entry(273, 4, 1, dataOffset);           // StripOffsets
  entry(277, 3, 1, 3);                    // SamplesPerPixel
  entry(278, 4, 1, h);                    // RowsPerStrip
  entry(279, 4, 1, rgbBytes);             // StripByteCounts
  entry(282, 5, 1, extraOffset + 6);      // XResolution
  entry(283, 5, 1, extraOffset + 14);     // YResolution
  entry(296, 3, 1, 2);                    // ResolutionUnit: inch
  dv.setUint32(p, 0, true);               // next IFD
  dv.setUint16(extraOffset, 8, true); dv.setUint16(extraOffset + 2, 8, true); dv.setUint16(extraOffset + 4, 8, true);
  dv.setUint32(extraOffset + 6, dpi, true); dv.setUint32(extraOffset + 10, 1, true);
  dv.setUint32(extraOffset + 14, dpi, true); dv.setUint32(extraOffset + 18, 1, true);
  let q = dataOffset;
  for (let i = 0; i < nPix; i++) { u8[q++] = data[i * 4]; u8[q++] = data[i * 4 + 1]; u8[q++] = data[i * 4 + 2]; }
  return new Blob([buf], { type: 'image/tiff' });
};

/* Browsers cannot draw canvases beyond a certain size: past it, some refuse to
   create the image and others silently shrink one side, which squashes the figure.
   These limits are safe in every current desktop and mobile browser. */
Fig.MAX_SIDE = 16000;   /* WEBP stops at 16383 px per side */
Fig.MAX_AREA = 120e6;
/* the largest scale ≤ the requested one whose image fits those limits */
Fig.safeScale = (svg, scale) => {
  const w = +svg.dataset.w || 900, h = +svg.dataset.h || 600;
  const s = Math.min(scale, Fig.MAX_SIDE / w, Fig.MAX_SIDE / h, Math.sqrt(Fig.MAX_AREA / (w * h)));
  if (s >= scale) return scale;
  return Math.max(0.5, Math.floor(s * 100) / 100);
};

/* Raster export. scale multiplies the base size. dpi is only metadata (PNG, TIFF, JPG). */
Fig.toRaster = (svg, { format = 'png', scale = 4, background = '#ffffff', dpi = 300 } = {}) =>
  new Promise((resolve, reject) => {
    const w = +svg.dataset.w || svg.viewBox.baseVal.width || 900;
    const h = +svg.dataset.h || svg.viewBox.baseVal.height || 600;
    /* a figure too large for the requested resolution is exported at the largest one
       that fits, keeping its proportions; the dpi written in the file follows */
    const safe = Fig.safeScale(svg, scale);
    if (safe < scale) { dpi = Math.round(dpi * safe / scale); scale = safe; }
    /* a transparent PNG needs the figure's own background rectangle out of the way */
    let node = svg;
    if (format === 'png' && !background) { node = svg.cloneNode(true); node.querySelectorAll('[data-bg]').forEach(r => r.remove()); }
    const src = Fig.serialize(node);
    const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      const ctx = c.getContext('2d');
      /* never hand back an image whose canvas the browser resized or refused */
      if (!ctx || c.width !== Math.round(w * scale) || c.height !== Math.round(h * scale)) {
        URL.revokeObjectURL(url);
        reject(new Error(figT('The browser could not create an image this large. Choose a lower resolution or export as SVG.')));
        return;
      }
      if (format !== 'png' || background) {
        ctx.fillStyle = background || '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      if (format === 'tiff') {
        try { resolve(Fig.encodeTiff(ctx.getImageData(0, 0, c.width, c.height), dpi)); }
        catch (e) { reject(e); }
        return;
      }
      const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      c.toBlob(b => {
        if (!b) return reject(new Error(figT('Could not generate the image')));
        if (format === 'png') b.arrayBuffer().then(ab => resolve(new Blob([Fig.pngWithDpi(ab, dpi)], { type: 'image/png' })));
        else if (format === 'jpg') b.arrayBuffer().then(ab => resolve(new Blob([Fig.jpgWithDpi(ab, dpi)], { type: 'image/jpeg' })));
        else resolve(b);
      }, mime, 0.97);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(figT('Could not rasterize the SVG'))); };
    img.src = url;
  });

/* ---- print size, greyscale and PDF ----
   Figures for journals are exported at a physical width (8.5 cm one column, 17 cm two columns, or any width): the figure is
   drawn again with a layout width chosen so that the base text (11 units) prints at the chosen size in points, and PNG and
   TIFF get exactly that width at the chosen dpi, SVG gets width and height in cm and PDF a page of that size. */
/* narrowest layout (in drawing units) and the layout width below which the height stops shrinking: the title, the axes
   and the legend keep their size in text units, so a one-column figure drawn with the proportions of the screen left the plot
   a thin strip with its ticks on top of each other */
Fig.PRINT_MIN_LAYOUT = 240;
Fig.PRINT_HEIGHT_BASE = 540;
Fig.EXPORT_DEFAULTS = { size: '17', customCm: 12, textPt: 8, grayscale: false, background: '#ffffff', dpi: 300 };
Fig.exportPrefs = () => Object.assign({}, Fig.EXPORT_DEFAULTS, Prefs.get('figexport', {}));
Fig.setExportPrefs = patch => { const p = Object.assign(Fig.exportPrefs(), patch); Prefs.set('figexport', p); return p; };
Fig.widthCm = p => (p.size === 'screen' ? null : p.size === 'custom' ? Math.min(60, Math.max(2, +p.customCm || 12)) : parseFloat(p.size));
Fig.layoutWidth = (widthCm, textPt) => Math.round(Math.min(2400, Math.max(Fig.PRINT_MIN_LAYOUT, widthCm / 2.54 * 72 / ((+textPt || 8) / 11))));
/* every colour of the figure as the grey of the same luminance (Rec. 709 weights) */
Fig.toGrayscale = svg => {
  const grey = v => {
    const s = String(v).trim();
    let m = /^rgba\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*([\d.]+)\)$/.exec(s);
    const c = m ? [+m[1], +m[2], +m[3]] : parseColor(s);
    if (!c) return v;
    const g = Math.round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]);
    return m ? `rgba(${g},${g},${g},${m[4]})` : rgb(g, g, g);
  };
  [svg, ...svg.querySelectorAll('*')].forEach(n => ['fill', 'stroke', 'stop-color', 'flood-color'].forEach(a => { if (n.hasAttribute(a)) n.setAttribute(a, grey(n.getAttribute(a))); }));
  return svg;
};

Fig.exportFigure = async (svg, { format = 'png', scale = 4, name = 'figure', background = '#ffffff', dpi = 300 } = {}) => {
  if (format === 'svg') {
    download(new Blob([Fig.serialize(svg)], { type: 'image/svg+xml;charset=utf-8' }), name + '.svg');
    return;
  }
  const blob = await Fig.toRaster(svg, { format, scale, background, dpi });
  download(blob, name + '.' + (format === 'jpg' ? 'jpg' : format === 'tiff' ? 'tif' : format));
};

/* ================= figure block with editor + export bar ================= */
Fig.registry = {};

let measureHost = null;
function measured(svg, fn) {
  if (!measureHost) {
    measureHost = document.createElement('div');
    measureHost.setAttribute('style',
      'position:fixed;left:-100000px;top:0;width:6000px;height:6000px;visibility:hidden;pointer-events:none');
    document.body.appendChild(measureHost);
  }
  measureHost.appendChild(svg);
  try { fn(svg); } finally { measureHost.removeChild(svg); }
}
/* If enlarging fonts pushes text outside the canvas, grow the viewBox instead of clipping. */
function fitViewBox(svg) {
  let b = null;
  /* the background rectangle covers the whole canvas: measure the drawing without it (with it, every figure grew by the
     padding on each side, and a figure exported at a print width printed its text smaller than chosen) */
  const bg0 = svg.firstElementChild && svg.firstElementChild.getAttribute('data-bg') === '1' ? svg.firstElementChild : null;
  if (bg0) bg0.setAttribute('display', 'none');
  try { b = svg.getBBox(); } catch (e) { b = null; } finally { if (bg0) bg0.removeAttribute('display'); }
  if (!b || (!b.width && !b.height)) return;
  const w = +svg.dataset.w, h = +svg.dataset.h, pad = 5;
  const x0 = b.x < 0 ? b.x - pad : 0, y0 = b.y < 0 ? b.y - pad : 0;
  const x1 = b.x + b.width > w ? b.x + b.width + pad : w, y1 = b.y + b.height > h ? b.y + b.height + pad : h;
  if (x0 === 0 && y0 === 0 && x1 === w && y1 === h) return;
  const nw = x1 - x0, nh = y1 - y0;
  svg.setAttribute('viewBox', `${x0.toFixed(1)} ${y0.toFixed(1)} ${nw.toFixed(1)} ${nh.toFixed(1)}`);
  svg.setAttribute('width', nw.toFixed(1));
  svg.setAttribute('height', nh.toFixed(1));
  svg.dataset.w = nw; svg.dataset.h = nh;
  const bg = svg.firstElementChild;
  if (bg && bg.tagName === 'rect') {
    bg.setAttribute('x', x0.toFixed(1)); bg.setAttribute('y', y0.toFixed(1));
    bg.setAttribute('width', nw.toFixed(1)); bg.setAttribute('height', nh.toFixed(1));
  }
}

/* Controls shared by every figure: style + typography. Their values persist
   across figures and sessions (the user's preferred look is remembered).
   `own: true` marks labels written by the engine (translated with figT). */
Fig.STYLE_CONTROLS = [
  { key: 'theme', label: 'Theme', type: 'select', options: Object.entries(Fig.themeNames), shared: true, own: true },
  { key: 'font', label: 'Font family', type: 'select', options: Object.entries(Fig.fontNames), shared: true, own: true },
  { key: 'fontScale', label: 'Font size: all', type: 'range', min: 0.6, max: 2.6, step: 0.05, shared: true, own: true },
  { key: 'fsTitle', label: 'Font size: titles', type: 'range', min: 0.6, max: 3, step: 0.05, shared: true, own: true },
  { key: 'fsAxis', label: 'Font size: axes & ticks', type: 'range', min: 0.6, max: 3, step: 0.05, shared: true, own: true },
  { key: 'fsLabel', label: 'Font size: labels & legend', type: 'range', min: 0.6, max: 3, step: 0.05, shared: true, own: true },
  { key: 'axisBold', label: 'Bold axis titles', type: 'checkbox', shared: true, own: true },
  { key: 'grid', label: 'Gridlines', type: 'checkbox', shared: true, own: true },
  { key: 'gridDash', label: 'Dashed gridlines', type: 'checkbox', shared: true, own: true },
  { key: 'tickAngle', label: 'Category labels', type: 'select', shared: true, bandOnly: true, own: true,
    options: [['auto', 'Auto (wrap, then tilt)'], ['0', 'Horizontal (wrap)'], ['45', 'Tilted 45°'], ['90', 'Vertical']] },
  { key: 'width', label: 'Width (px)', type: 'number', min: 400, max: 2400, step: 20, own: true },
  { key: 'height', label: 'Height (px)', type: 'number', min: 300, max: 2000, step: 20, own: true },
];
const SHARED_DEFAULTS = { theme: 'light', font: 'sans', fontScale: 1, fsTitle: 1, fsAxis: 1, fsLabel: 1, axisBold: false, grid: true, gridDash: false, tickAngle: 'auto' };
/* Shown only for charts drawn with Fig.bandPlot (category against value). */
const FLIP_CONTROL = { key: 'flip', label: 'Flip axes (horizontal bars)', type: 'checkbox', own: true };

/* spec: { title, render(cfg) → <svg>, controls?, defaults?, width?, height?, fileName?, minLayout? (narrowest print layout),
           bare? (true: no title row, for hosts that draw their own header) } */
Fig.mount = (host, spec) => {
  if (typeof host === 'string') host = el(host);
  const hostId = host.id || ('fig_' + Math.random().toString(36).slice(2, 8));
  host.innerHTML = '';
  host.classList.add('fig-block');
  if (spec.bare) host.classList.add('fig-bare');
  const saved = Prefs.get('figstyle', {});
  const cfg = Object.assign({}, SHARED_DEFAULTS, saved, spec.defaults || {});
  if (cfg.width == null) cfg.width = spec.width || 900;
  if (cfg.height == null) cfg.height = spec.height || 560;

  if (!spec.bare) {
    const head = mk('div', { class: 'fig-head' });
    head.appendChild(mk('h4', null, Fig.subHTML(spec.title || figT('Figure'))));
    host.appendChild(head);
  }
  const canvas = mk('div', { class: 'fig-canvas' });
  host.appendChild(canvas);

  let current = null;
  function redraw() {
    canvas.innerHTML = '';
    Fig.setFontScale(cfg);
    try { current = spec.render(cfg); } finally { Fig._fs = { title: 1, axis: 1, label: 1 }; }
    measured(current, fitViewBox);
    /* the figure on screen is announced as an image with its title */
    current.setAttribute('role', 'img');
    current.setAttribute('aria-label', cfg.title || spec.title || '');
    canvas.appendChild(current);
    updateInfo();
  }
  function persistShared() {
    const s = {};
    Fig.STYLE_CONTROLS.forEach(c => { if (c.shared) s[c.key] = cfg[c.key]; });
    Prefs.set('figstyle', s);
  }

  /* --- editor --- */
  const det = mk('details', { class: 'fig-editor' });
  det.appendChild(mk('summary', null, esc(figT('⚙ Edit figure — titles, colours, fonts, sizes'))));
  const tabs = mk('div', { class: 'fig-tabs' });
  const groups = [
    { name: figT('Content & colours'), controls: spec.controls || [] },
    { name: figT('Style & typography'), controls: Fig.STYLE_CONTROLS },
  ];
  groups.forEach((gr, gi) => {
    const tab = mk('button', { class: 'fig-tab' + (gi === 0 ? ' active' : ''), type: 'button' }, esc(gr.name));
    tab.addEventListener('click', () => {
      els('.fig-tab', det).forEach(b => b.classList.remove('active'));
      els('.fig-opts', det).forEach(g => g.style.display = 'none');
      tab.classList.add('active'); gr.grid.style.display = '';
    });
    tabs.appendChild(tab);
  });
  det.appendChild(tabs);
  groups.forEach((gr, gi) => {
    const grid = mk('div', { class: 'fig-opts' });
    if (gi > 0) grid.style.display = 'none';
    gr.grid = grid;
    gr.controls.forEach(c => { if (!c.bandOnly) addControl(c, grid); });
    det.appendChild(grid);
  });
  host.appendChild(det);

  function addControl(c, grid) {
    const tr = s => (c.own ? figT(s) : s);
    if (cfg[c.key] == null && c.type === 'range') cfg[c.key] = 1;
    const lab = mk('label', { class: 'inline-label', 'data-key': c.key });
    lab.appendChild(document.createTextNode(tr(c.label) + ' '));
    let input;
    const commit = () => { if (c.shared) persistShared(); redraw(); };
    if (c.type === 'select') {
      input = mk('select');
      (c.options || []).forEach(o => {
        const [val, txt] = Array.isArray(o) ? o : [o, o];
        const op = mk('option', { value: val }, esc(tr(txt)));
        if (String(cfg[c.key]) === String(val)) op.selected = true;
        input.appendChild(op);
      });
      input.addEventListener('change', () => { cfg[c.key] = input.value; commit(); });
    } else if (c.type === 'checkbox') {
      input = mk('input', { type: 'checkbox' });
      input.checked = !!cfg[c.key];
      input.addEventListener('change', () => { cfg[c.key] = input.checked; commit(); });
      lab.insertBefore(input, lab.firstChild);
      grid.appendChild(lab);
      return;
    } else if (c.type === 'color') {
      input = mk('input', { type: 'color', value: cfg[c.key] || '#1d5bb0' });
      input.addEventListener('input', () => { cfg[c.key] = input.value; commit(); });
    } else if (c.type === 'range') {
      input = mk('input', { type: 'range', min: c.min, max: c.max, step: c.step || 1, value: cfg[c.key] });
      const out = mk('span', { class: 'range-val' }, String(cfg[c.key]));
      input.addEventListener('input', () => { cfg[c.key] = +input.value; out.textContent = String(cfg[c.key]); commit(); });
      lab.appendChild(input); lab.appendChild(out);
      grid.appendChild(lab);
      return;
    } else if (c.type === 'number') {
      input = mk('input', { type: 'number', min: c.min, max: c.max, step: c.step || 1, value: cfg[c.key], style: 'width:90px' });
      input.addEventListener('change', () => { cfg[c.key] = +input.value; commit(); });
    } else if (c.type === 'colors') {
      /* one colour picker per series */
      const wrap = mk('div', { class: 'color-row' });
      (c.labels || []).forEach((l, i) => {
        const cur = (cfg[c.key] && cfg[c.key][i]) || Fig.color(cfg.palette, i);
        const ci = mk('input', { type: 'color', value: cur, title: l });
        ci.addEventListener('input', () => { cfg[c.key] = cfg[c.key] || []; cfg[c.key][i] = ci.value; commit(); });
        const sl = mk('span', { class: 'color-item' }); sl.appendChild(ci); sl.appendChild(mk('small', null, esc(l)));
        wrap.appendChild(sl);
      });
      lab.appendChild(wrap);
      grid.appendChild(lab);
      return;
    } else {
      input = mk('input', { type: 'text', value: cfg[c.key] != null ? cfg[c.key] : '', style: 'width:200px' });
      input.addEventListener('change', () => { cfg[c.key] = input.value; commit(); });
    }
    lab.appendChild(input);
    grid.appendChild(lab);
  }

  /* --- export bar --- */
  /* the figure drawn again for a physical width (see Fig.EXPORT_DEFAULTS); p: export preferences */
  function renderPrint(p) {
    p = Object.assign(Fig.exportPrefs(), p || {});
    const wcm = Fig.widthCm(p);
    const c = Object.assign({}, cfg);
    /* p.layoutCm: drawn for that width and printed at wcm (a tall figure shrunk to fit a page keeps its layout) */
    if (wcm) { const L = Math.max(Fig.layoutWidth(+p.layoutCm || wcm, p.textPt), +spec.minLayout || 0); c.height = Math.round((+cfg.height || 560) * Math.max(L, Fig.PRINT_HEIGHT_BASE) / (+cfg.width || 900)); c.width = L; }
    Fig.setFontScale(c);
    let svg;
    try { svg = spec.render(c); } finally { Fig._fs = { title: 1, axis: 1, label: 1 }; }
    measured(svg, fitViewBox);
    if (p.grayscale) Fig.toGrayscale(svg);
    const w = +svg.dataset.w, h = +svg.dataset.h;
    const widthPt = wcm ? wcm / 2.54 * 72 : w * 0.75, heightPt = h * widthPt / w;
    if (wcm) { svg.setAttribute('width', wcm.toFixed(2) + 'cm'); svg.setAttribute('height', (heightPt / 72 * 2.54).toFixed(2) + 'cm'); }
    return { svg, widthPt, heightPt, widthCm: wcm, heightCm: heightPt / 72 * 2.54, textPt: 11 * widthPt / w, width: w, height: h };
  }
  async function printBlob(format, p) {
    p = Object.assign(Fig.exportPrefs(), p || {});
    const r = renderPrint(p);
    if (format === 'svg') return new Blob([Fig.serialize(r.svg)], { type: 'image/svg+xml;charset=utf-8' });
    if (format === 'pdf') return new Blob([await SvgPdf.build(r.svg, { widthPt: r.widthPt, heightPt: r.heightPt, title: spec.title })], { type: 'application/pdf' });
    const dpi = +p.dpi || 300;
    /* the size on screen prints at 96 drawing units per inch, the same size as its SVG and PDF */
    const scale = r.widthCm ? (r.widthCm / 2.54 * dpi) / r.width : dpi / 96;
    return Fig.toRaster(r.svg, { format, scale, background: p.background === 'transparent' ? null : (p.background || '#ffffff'), dpi });
  }
  const extOf = format => (format === 'jpg' ? 'jpg' : format === 'tiff' ? 'tif' : format);
  async function exportPrint(format, p) {
    const blob = await printBlob(format, p);
    download(blob, (spec.fileName || slug(spec.title || 'figure')) + '.' + extOf(format));
    return blob;
  }
  const prefs = Fig.exportPrefs();
  const tools = mk('div', { class: 'fig-tools' });
  const fmt = mk('select', { 'aria-label': figT('Format') });
  [['png', 'PNG'], ['tiff', 'TIFF (journal submission)'], ['pdf', 'PDF (vector)'], ['svg', 'SVG (vector, editable)'], ['jpg', 'JPG'], ['webp', 'WEBP']]
    .forEach(([v, s]) => fmt.appendChild(mk('option', { value: v }, esc(figT(s)))));
  const size = mk('select', { 'aria-label': figT('Width') });
  [['8.5', 'One column · 8.5 cm'], ['17', 'Two columns · 17 cm'], ['custom', 'Custom width (cm)'], ['screen', 'Size on screen']]
    .forEach(([v, s]) => size.appendChild(mk('option', { value: v }, esc(figT(s)))));
  size.value = prefs.size;
  const custom = mk('input', { type: 'number', min: 2, max: 60, step: 0.1, value: prefs.customCm, style: 'width:72px', 'aria-label': figT('Width (cm)') });
  const textPt = mk('input', { type: 'number', min: 5, max: 16, step: 0.5, value: prefs.textPt, style: 'width:64px', 'aria-label': figT('Text (pt)') });
  const res = mk('select', { 'aria-label': figT('Resolution') });
  [['300', '300 dpi'], ['600', '600 dpi'], ['1200', '1200 dpi (line art)']].forEach(([v, s]) => res.appendChild(mk('option', { value: v }, esc(figT(s)))));
  res.value = String(prefs.dpi);
  const bgSel = mk('select', { 'aria-label': figT('Background') });
  [['#ffffff', 'White background'], ['transparent', 'Transparent (PNG)']].forEach(([v, s]) => bgSel.appendChild(mk('option', { value: v }, esc(figT(s)))));
  bgSel.value = prefs.background === 'transparent' ? 'transparent' : '#ffffff';
  const greyLab = mk('label', { class: 'inline-label fig-grey' });
  const grey = mk('input', { type: 'checkbox' });
  grey.checked = !!prefs.grayscale;
  greyLab.appendChild(grey);
  greyLab.appendChild(document.createTextNode(' ' + figT('Greyscale')));
  const btn = mk('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, esc(figT('⬇ Download figure')));
  const info = mk('span', { class: 'hint fig-info', style: 'margin:0' });
  const readPrefs = () => ({ size: size.value, customCm: +custom.value || 12, textPt: +textPt.value || 8, dpi: +res.value || 300, background: bgSel.value, grayscale: grey.checked });
  /* the size of the file and the size its base text will print at: the figure is drawn for the chosen width (labels that
     do not fit make the drawing wider, and then the text prints smaller than asked); drawn a moment after the last change */
  let infoTimer = null;
  function updateInfo() {
    if (!current) return;
    const p = readPrefs();
    custom.hidden = p.size !== 'custom';
    textPt.disabled = p.size === 'screen';
    clearTimeout(infoTimer);
    infoTimer = setTimeout(() => writeInfo(p), 80);
  }
  function writeInfo(p) {
    if (!current || !document.body.contains(info)) return;
    const wcm = Fig.widthCm(p);
    let wc, hc, pt;
    if (wcm) { const r = renderPrint(p); wc = r.widthCm; hc = r.heightCm; pt = r.textPt; } else { wc = +current.dataset.w * 2.54 / 96; hc = +current.dataset.h * 2.54 / 96; pt = 11 * 0.75; }
    const small = wcm && pt < p.textPt - 0.25;
    const note = small ? figT('The labels do not fit at this width: the text prints at {pt} pt. Shorten them in Edit figure or choose a wider figure.', { pt: pt.toFixed(1) }) : '';
    if (fmt.value === 'svg' || fmt.value === 'pdf') {
      info.textContent = figT('Vector at {w} × {h} cm; base text {pt} pt.', { w: wc.toFixed(1), h: hc.toFixed(1), pt: +pt.toFixed(1) }) + (note ? ' ' + note : '');
      info.classList.toggle('fig-warn', !!small);
      return;
    }
    const px = Math.round(wc / 2.54 * p.dpi), py = Math.round(hc / 2.54 * p.dpi);
    info.textContent = figT('{w} × {h} px · {wcm} × {hcm} cm at {dpi} dpi', { w: px, h: py, wcm: wc.toFixed(1), hcm: hc.toFixed(1), dpi: p.dpi }) + (note ? '. ' + note : '');
    info.classList.toggle('fig-warn', !!small || px > Fig.MAX_SIDE || py > Fig.MAX_SIDE || px * py > Fig.MAX_AREA);
  }
  [fmt, size, custom, textPt, res, bgSel, grey].forEach(input => input.addEventListener('change', () => { Fig.setExportPrefs(readPrefs()); updateInfo(); }));
  async function exportAs(format, scale) {
    /* the older call: a scale of the size on screen */
    await Fig.exportFigure(current, {
      format, scale, dpi: scale * 75,
      name: (spec.fileName || slug(spec.title || 'figure')),
      background: bgSel.value === 'transparent' ? null : bgSel.value,
    });
  }
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try { await exportPrint(fmt.value, readPrefs()); } catch (e) {
      const msg = figT('Export failed: {msg}', { msg: e.message });
      if (window.toast) toast(msg, 'error'); else alert(msg);
    }
    btn.disabled = false;
  });
  tools.appendChild(mk('span', { class: 'inline-label' }, esc(figT('Format'))));
  tools.appendChild(fmt);
  tools.appendChild(mk('span', { class: 'inline-label' }, esc(figT('Width'))));
  tools.appendChild(size);
  tools.appendChild(custom);
  tools.appendChild(mk('span', { class: 'inline-label' }, esc(figT('Text (pt)'))));
  tools.appendChild(textPt);
  tools.appendChild(mk('span', { class: 'inline-label' }, esc(figT('Resolution'))));
  tools.appendChild(res);
  tools.appendChild(bgSel);
  tools.appendChild(greyLab);
  tools.appendChild(btn);
  tools.appendChild(info);
  host.appendChild(tools);

  redraw();
  if (current && current.dataset.band === '1') {
    const first = groups[0].grid;
    addControl(FLIP_CONTROL, first);
    first.insertBefore(first.lastChild, first.firstChild);
    const style = groups[1].grid;
    const sizeLabel = style.querySelector('[data-key="width"]');
    Fig.STYLE_CONTROLS.filter(c => c.bandOnly).forEach(c => { addControl(c, style); if (sizeLabel) style.insertBefore(style.lastChild, sizeLabel); });
  }
  const api = {
    redraw, cfg, hostId, title: spec.title || hostId,
    fileName: spec.fileName || slug(spec.title || hostId),
    get svg() { return current; },
    exportAs, renderPrint, printBlob, exportPrint,
  };
  Fig.registry[hostId] = api;
  return api;
};
/* figures currently on screen (for the report and the ZIP) */
Fig.mounted = () => Object.values(Fig.registry).filter(a => {
  const h = document.getElementById(a.hostId);
  if (!h || !a.svg || !document.body.contains(h)) return false;
  for (let n = h; n && n !== document.body; n = n.parentElement) {
    if (n.hidden || (n.style && n.style.display === 'none')) return false;
  }
  return true;
});

window.Fig = Fig;
