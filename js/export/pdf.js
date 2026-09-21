/* SciMetricsPro — vector PDF from the SVG figures (PDF 1.4, ISO 32000 subset). The figure is written as PDF drawing operators:
   paths (M L H V C S Q T A Z), lines, rectangles with rounded corners, circles, ellipses, polygons and polylines; fill and
   stroke colours with their opacities (graphics states), dashes, caps and joins; group transforms; arrow markers at line
   ends; and text with the standard fonts (Helvetica, Times, Courier and Symbol for Greek letters and signs) placed with its
   anchor, baseline, rotation, subscripts and halo. Nothing is rasterised: text stays selectable.
   SvgPdf.build(svg, { widthPt, heightPt, title }) → Promise<Uint8Array>. */
'use strict';

const SvgPdf = {
  /* Unicode code points outside Latin-1 that WinAnsiEncoding has (and a few look-alikes) */
  WIN: new Map([[0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
    [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94],
    [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C], [0x017E, 0x9E],
    [0x0178, 0x9F], [0x2212, 0x2D], [0x2010, 0x2D], [0x2011, 0x2D], [0x2009, 0x20], [0x200A, 0x20], [0x202F, 0x20], [0x2007, 0x20], [0x2032, 0x27]]),
  /* Greek letters and mathematical signs in the Symbol font */
  SYMBOL: (() => {
    const m = new Map();
    'abgdezhqiklmnxoprVstufcyw'.split('').forEach((ch, i) => m.set(0x3B1 + i, ch.charCodeAt(0)));
    'ABGDEZHQIKLMNXOPR'.split('').forEach((ch, i) => m.set(0x391 + i, ch.charCodeAt(0)));
    'STUFCYW'.split('').forEach((ch, i) => m.set(0x3A3 + i, ch.charCodeAt(0)));
    [[0x2264, 0xA3], [0x2265, 0xB3], [0x2260, 0xB9], [0x2248, 0xBB], [0x221E, 0xA5], [0x221A, 0xD6], [0x2192, 0xAE], [0x2190, 0xAC], [0x2191, 0xAD],
      [0x2193, 0xAF], [0x2211, 0xE5], [0x2208, 0xCE], [0x2202, 0xB6], [0x2033, 0xB2], [0x2229, 0xC7], [0x222A, 0xC8], [0x21D4, 0xDB], [0x223C, 0x7E],
      [0x21DD, 0xAE], [0x2206, 0x44], [0x2219, 0xD7]].forEach(([u, c]) => m.set(u, c));
    return m;
  })(),
  NAMED: { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128] },

  num(v) { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); },

  color(value, current) {
    if (value == null) return null;
    const s = String(value).trim().toLowerCase();
    if (!s || s === 'none' || s === 'transparent') return null;
    if (s === 'currentcolor') return current || { rgb: [0, 0, 0], a: 1 };
    let m;
    if ((m = s.match(/^#([0-9a-f]{3})$/))) return { rgb: m[1].split('').map(h => parseInt(h + h, 16)), a: 1 };
    if ((m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/))) return { rgb: [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16)), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
    if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(x => (x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x)));
      return { rgb: p.slice(0, 3), a: p.length > 3 ? (String(m[1]).includes('%') && p[3] > 1 ? p[3] / 255 : p[3]) : 1 };
    }
    if (SvgPdf.NAMED[s]) return { rgb: SvgPdf.NAMED[s], a: 1 };
    return { rgb: [0, 0, 0], a: 1 };
  },

  matrix(transform) {
    let M = [1, 0, 0, 1, 0, 0];
    const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(String(transform || '')))) {
      const a = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
      let T;
      switch (m[1]) {
        case 'matrix': T = a.slice(0, 6); break;
        case 'translate': T = [1, 0, 0, 1, a[0] || 0, a[1] || 0]; break;
        case 'scale': T = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0]; break;
        case 'rotate': {
          const r = (a[0] || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
          T = [c, s, -s, c, 0, 0];
          if (a.length >= 3) T = mul(mul([1, 0, 0, 1, a[1], a[2]], T), [1, 0, 0, 1, -a[1], -a[2]]);
          break;
        }
        case 'skewX': T = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0]; break;
        default: T = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      }
      M = mul(M, T);
    }
    return M;
  },

  /* path data → PDF operators, with the last point and the direction at the end (for markers) */
  path(d) {
    const N = SvgPdf.num;
    const tokens = String(d || '').match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
    const out = [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = null, cy = null, qx = null, qy = null, px = 0, py = 0;
    const next = () => parseFloat(tokens[i++]);
    const isNum = () => i < tokens.length && !/^[A-Za-z]$/.test(tokens[i]);
    const curve = (x1, y1, x2, y2, x3, y3) => { out.push(`${N(x1)} ${N(y1)} ${N(x2)} ${N(y2)} ${N(x3)} ${N(y3)} c`); px = x2; py = y2; x = x3; y = y3; };
    while (i < tokens.length) {
      if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++];
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === 'Z') { out.push('h'); x = sx; y = sy; px = x; py = y; cx = cy = qx = qy = null; continue; }
      if (!isNum()) { i++; continue; }
      if (C === 'M') {
        x = (rel ? x : 0) + next(); y = (rel ? y : 0) + next(); sx = x; sy = y; px = x; py = y;
        out.push(`${N(x)} ${N(y)} m`);
        cmd = rel ? 'l' : 'L';
        cx = cy = qx = qy = null;
      } else if (C === 'L') { px = x; py = y; x = (rel ? x : 0) + next(); y = (rel ? y : 0) + next(); out.push(`${N(x)} ${N(y)} l`); cx = cy = qx = qy = null; }
      else if (C === 'H') { px = x; py = y; x = (rel ? x : 0) + next(); out.push(`${N(x)} ${N(y)} l`); cx = cy = qx = qy = null; }
      else if (C === 'V') { px = x; py = y; y = (rel ? y : 0) + next(); out.push(`${N(x)} ${N(y)} l`); cx = cy = qx = qy = null; }
      else if (C === 'C') {
        const b = rel ? [x, y] : [0, 0];
        const x1 = b[0] + next(), y1 = b[1] + next(), x2 = b[0] + next(), y2 = b[1] + next(), x3 = b[0] + next(), y3 = b[1] + next();
        curve(x1, y1, x2, y2, x3, y3); cx = x2; cy = y2; qx = qy = null;
      } else if (C === 'S') {
        const b = rel ? [x, y] : [0, 0];
        const x1 = cx == null ? x : 2 * x - cx, y1 = cy == null ? y : 2 * y - cy;
        const x2 = b[0] + next(), y2 = b[1] + next(), x3 = b[0] + next(), y3 = b[1] + next();
        curve(x1, y1, x2, y2, x3, y3); cx = x2; cy = y2; qx = qy = null;
      } else if (C === 'Q' || C === 'T') {
        const b = rel ? [x, y] : [0, 0];
        let x1, y1;
        if (C === 'Q') { x1 = b[0] + next(); y1 = b[1] + next(); } else { x1 = qx == null ? x : 2 * x - qx; y1 = qy == null ? y : 2 * y - qy; }
        const x3 = b[0] + next(), y3 = b[1] + next();
        const x0 = x, y0 = y;
        curve(x0 + 2 / 3 * (x1 - x0), y0 + 2 / 3 * (y1 - y0), x3 + 2 / 3 * (x1 - x3), y3 + 2 / 3 * (y1 - y3), x3, y3);
        qx = x1; qy = y1; cx = cy = null;
      } else if (C === 'A') {
        let rx = Math.abs(next()), ry = Math.abs(next());
        const rot = next() * Math.PI / 180, large = next() !== 0, sweep = next() !== 0;
        const x2 = (rel ? x : 0) + next(), y2 = (rel ? y : 0) + next();
        SvgPdf.arc(x, y, rx, ry, rot, large, sweep, x2, y2).forEach(c => curve(...c));
        x = x2; y = y2; cx = cy = qx = qy = null;
      } else i++;
    }
    return { ops: out.join('\n'), end: [x, y], from: [px, py] };
  },

  /* elliptical arc → cubic curves (SVG 1.1 implementation notes, F.6.5 and F.6.6) */
  arc(x1, y1, rx, ry, phi, large, sweep, x2, y2) {
    if (!rx || !ry || (x1 === x2 && y1 === y2)) return [[x1, y1, x2, y2, x2, y2]];
    const c = Math.cos(phi), s = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const xp = c * dx + s * dy, yp = -s * dx + c * dy;
    const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
    const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp, den = rx * rx * yp * yp + ry * ry * xp * xp;
    let k = Math.sqrt(Math.max(0, num / den));
    if (large === sweep) k = -k;
    const cxp = k * rx * yp / ry, cyp = -k * ry * xp / rx;
    const cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
    const angle = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
    const t1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
    const step = dt / n, kk = 4 / 3 * Math.tan(step / 4);
    const pt = (t) => [cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c];
    const der = (t) => [-rx * Math.sin(t) * c - ry * Math.cos(t) * s, -rx * Math.sin(t) * s + ry * Math.cos(t) * c];
    const out = [];
    for (let j = 0; j < n; j++) {
      const a = t1 + j * step, b = a + step;
      const p0 = pt(a), p3 = pt(b), d0 = der(a), d3 = der(b);
      out.push([p0[0] + kk * d0[0], p0[1] + kk * d0[1], p3[0] - kk * d3[0], p3[1] - kk * d3[1], p3[0], p3[1]]);
    }
    return out;
  },

  ellipse(cx, cy, rx, ry) {
    const N = SvgPdf.num, k = 0.5522847498;
    return [`${N(cx + rx)} ${N(cy)} m`,
      `${N(cx + rx)} ${N(cy + k * ry)} ${N(cx + k * rx)} ${N(cy + ry)} ${N(cx)} ${N(cy + ry)} c`,
      `${N(cx - k * rx)} ${N(cy + ry)} ${N(cx - rx)} ${N(cy + k * ry)} ${N(cx - rx)} ${N(cy)} c`,
      `${N(cx - rx)} ${N(cy - k * ry)} ${N(cx - k * rx)} ${N(cy - ry)} ${N(cx)} ${N(cy - ry)} c`,
      `${N(cx + k * rx)} ${N(cy - ry)} ${N(cx + rx)} ${N(cy - k * ry)} ${N(cx + rx)} ${N(cy)} c`, 'h'].join('\n');
  },

  /* the font of a text run: family (Helvetica, Times, Courier) × weight × style */
  fontName(family, weight, style) {
    const f = String(family || '').toLowerCase();
    const bold = /bold|[6-9]00/.test(String(weight || '')), italic = /italic|oblique/.test(String(style || ''));
    if (/mono|courier/.test(f)) return 'Courier' + (bold || italic ? '-' + (bold ? 'Bold' : '') + (italic ? 'Oblique' : '') : '');
    if (/(^|[\s,'"])serif|times|georgia/.test(f) && !/sans-serif/.test(f)) return bold && italic ? 'Times-BoldItalic' : bold ? 'Times-Bold' : italic ? 'Times-Italic' : 'Times-Roman';
    return 'Helvetica' + (bold || italic ? '-' + (bold ? 'Bold' : '') + (italic ? 'Oblique' : '') : '');
  },
  _ctx: null,
  measure(text, fontName, size) {
    if (!SvgPdf._ctx) SvgPdf._ctx = document.createElement('canvas').getContext('2d');
    const ctx = SvgPdf._ctx;
    const family = /^Times/.test(fontName) ? '"Times New Roman", Times, serif' : /^Courier/.test(fontName) ? '"Courier New", Courier, monospace' : /^Symbol/.test(fontName) ? 'Arial, Helvetica, sans-serif' : 'Arial, Helvetica, sans-serif';
    ctx.font = `${/Italic|Oblique/.test(fontName) ? 'italic ' : ''}${/Bold/.test(fontName) ? 'bold ' : ''}100px ${family}`;
    return ctx.measureText(text).width / 100 * size;
  },
  /* text → runs of [font, bytes, text] in WinAnsi or Symbol */
  encode(text, fontName) {
    const runs = [];
    let cur = null;
    for (const ch of String(text)) {
      const u = ch.codePointAt(0);
      let font = fontName, byte;
      if (u < 0x80 || (u >= 0xA0 && u <= 0xFF)) byte = u;
      else if (SvgPdf.WIN.has(u)) byte = SvgPdf.WIN.get(u);
      else if (SvgPdf.SYMBOL.has(u)) { font = 'Symbol'; byte = SvgPdf.SYMBOL.get(u); }
      else {
        const base = ch.normalize('NFD').codePointAt(0);
        byte = base < 0x80 || (base >= 0xA0 && base <= 0xFF) ? base : 0x3F;
      }
      if (!cur || cur.font !== font) { cur = { font, bytes: [], text: '' }; runs.push(cur); }
      cur.bytes.push(byte);
      cur.text += ch;
    }
    return runs;
  },
  pdfString(bytes) {
    let s = '(';
    for (const b of bytes) {
      if (b === 0x28 || b === 0x29 || b === 0x5C) s += '\\' + String.fromCharCode(b);
      else if (b < 0x20 || b > 0x7E) s += '\\' + b.toString(8).padStart(3, '0');
      else s += String.fromCharCode(b);
    }
    return s + ')';
  },

  STYLE_KEYS: ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
    'dominant-baseline', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'paint-order', 'visibility'],

  async build(svg, o) {
    o = o || {};
    const P = SvgPdf, N = P.num;
    const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : { x: 0, y: 0, width: +svg.dataset.w || +svg.getAttribute('width') || 900, height: +svg.dataset.h || +svg.getAttribute('height') || 600 };
    const pageW = o.widthPt || vb.width * 0.75;
    const pageH = o.heightPt || vb.height * pageW / vb.width;
    const sx = pageW / vb.width, sy = pageH / vb.height;
    const ops = [`${N(sx)} 0 0 ${N(-sy)} ${N(-vb.x * sx)} ${N(pageH + vb.y * sy)} cm`];
    const fonts = new Map(), states = new Map();
    const fontRef = name => { if (!fonts.has(name)) fonts.set(name, 'F' + (fonts.size + 1)); return fonts.get(name); };
    const stateRef = (fa, sa) => {
      const key = N(fa) + '|' + N(sa);
      if (!states.has(key)) states.set(key, { name: 'G' + (states.size + 1), fa, sa });
      return states.get(key).name;
    };
    const markers = new Map();
    svg.querySelectorAll('marker[id]').forEach(m => markers.set(m.getAttribute('id'), m));

    const styleOf = (node, parent) => {
      const st = Object.assign({}, parent);
      st.opacity = (parent.opacity == null ? 1 : parent.opacity) * (node.hasAttribute('opacity') ? parseFloat(node.getAttribute('opacity')) : 1);
      for (const k of P.STYLE_KEYS) if (node.hasAttribute(k)) st[k] = node.getAttribute(k);
      const inline = node.getAttribute('style');
      if (inline) inline.split(';').forEach(decl => { const [k, v] = decl.split(':').map(x => x && x.trim()); if (k && v && (P.STYLE_KEYS.includes(k) || k === 'opacity')) { if (k === 'opacity') st.opacity *= parseFloat(v); else st[k] = v; } });
      return st;
    };
    const paint = (st, geometry, closed) => {
      if (st.visibility === 'hidden') return;
      const fill = closed ? P.color(st.fill == null ? 'black' : st.fill) : null;
      const stroke = P.color(st.stroke);
      const sw = st['stroke-width'] == null ? 1 : parseFloat(st['stroke-width']);
      const fa = fill ? fill.a * (st['fill-opacity'] == null ? 1 : parseFloat(st['fill-opacity'])) * st.opacity : 1;
      const sa = stroke ? stroke.a * (st['stroke-opacity'] == null ? 1 : parseFloat(st['stroke-opacity'])) * st.opacity : 1;
      const doStroke = stroke && sw > 0 && sa > 0, doFill = fill && fa > 0;
      if (!doFill && !doStroke) return;
      ops.push('q');
      if (fa < 1 || sa < 1) ops.push(`/${stateRef(doFill ? fa : 1, doStroke ? sa : 1)} gs`);
      if (doFill) ops.push(fill.rgb.map(v => N(v / 255)).join(' ') + ' rg');
      if (doStroke) {
        ops.push(stroke.rgb.map(v => N(v / 255)).join(' ') + ' RG', `${N(sw)} w`);
        const cap = { round: 1, square: 2 }[st['stroke-linecap']] || 0, join = { round: 1, bevel: 2 }[st['stroke-linejoin']] || 0;
        if (cap) ops.push(cap + ' J');
        if (join) ops.push(join + ' j');
        const dash = st['stroke-dasharray'];
        if (dash && dash !== 'none') ops.push('[' + dash.split(/[\s,]+/).filter(Boolean).map(Number).map(N).join(' ') + '] 0 d');
      }
      ops.push(geometry);
      const even = st['fill-rule'] === 'evenodd';
      ops.push(doFill && doStroke ? (even ? 'B*' : 'B') : doFill ? (even ? 'f*' : 'f') : 'S');
      ops.push('Q');
    };
    const drawMarker = (node, st, end, from) => {
      const ref = node.getAttribute('marker-end');
      const m = ref && ref.match(/url\(#([^)]+)\)/);
      const marker = m && markers.get(m[1]);
      if (!marker) return;
      const angle = Math.atan2(end[1] - from[1], end[0] - from[0]);
      const mvb = (marker.getAttribute('viewBox') || '0 0 10 10').split(/[\s,]+/).map(Number);
      const units = marker.getAttribute('markerUnits') === 'userSpaceOnUse' ? 1 : (st['stroke-width'] == null ? 1 : parseFloat(st['stroke-width']));
      const mw = parseFloat(marker.getAttribute('markerWidth') || 3) * units, mh = parseFloat(marker.getAttribute('markerHeight') || 3) * units;
      const kx = mw / (mvb[2] || 1), ky = mh / (mvb[3] || 1);
      const refX = parseFloat(marker.getAttribute('refX') || 0), refY = parseFloat(marker.getAttribute('refY') || 0);
      const c = Math.cos(angle), s = Math.sin(angle);
      ops.push('q', `${N(c)} ${N(s)} ${N(-s)} ${N(c)} ${N(end[0])} ${N(end[1])} cm`, `${N(kx)} 0 0 ${N(ky)} ${N(-refX * kx)} ${N(-refY * ky)} cm`);
      for (const child of marker.children) walk(child, { opacity: st.opacity });
      ops.push('Q');
    };
    const text = (node, st) => {
      if (st.visibility === 'hidden') return;
      const size0 = parseFloat(st['font-size'] || 12);
      const fontName0 = P.fontName(st['font-family'], st['font-weight'], st['font-style']);
      /* runs from the text and its tspans (dy and font-size, as the figures write subscripts) */
      const pieces = [];
      let dy = 0;
      const collect = (el, size, fontName) => {
        for (const child of el.childNodes) {
          if (child.nodeType === 3) { if (child.nodeValue) pieces.push({ text: child.nodeValue, size, fontName, dy }); }
          else if (child.nodeType === 1 && child.tagName.toLowerCase() === 'tspan') {
            if (child.hasAttribute('dy')) dy += parseFloat(child.getAttribute('dy'));
            const cs = child.hasAttribute('font-size') ? parseFloat(child.getAttribute('font-size')) : size;
            const cf = P.fontName(child.getAttribute('font-family') || st['font-family'], child.getAttribute('font-weight') || st['font-weight'], child.getAttribute('font-style') || st['font-style']);
            collect(child, cs, cf);
          }
        }
      };
      collect(node, size0, fontName0);
      const runs = [];
      pieces.forEach(pc => P.encode(pc.text.replace(/\s+/g, ' '), pc.fontName).forEach(r => runs.push({ font: r.font, bytes: r.bytes, size: pc.size, dy: pc.dy, width: P.measure(r.text, r.font, pc.size) })));
      if (!runs.length) return;
      const total = runs.reduce((acc, r) => acc + r.width, 0);
      const anchor = st['text-anchor'];
      let x = parseFloat(node.getAttribute('x') || 0) - (anchor === 'middle' ? total / 2 : anchor === 'end' ? total : 0);
      const base = st['dominant-baseline'];
      const shift = base === 'central' || base === 'middle' ? 0.35 * size0 : base === 'hanging' || base === 'text-before-edge' ? 0.75 * size0 : base === 'text-after-edge' || base === 'ideographic' ? -0.2 * size0 : 0;
      const y = parseFloat(node.getAttribute('y') || 0) + shift;
      const fill = P.color(st.fill == null ? 'black' : st.fill), stroke = P.color(st.stroke);
      const sw = st['stroke-width'] == null ? 1 : parseFloat(st['stroke-width']);
      const pass = mode => {
        const c = mode === 'stroke' ? stroke : fill;
        if (!c) return;
        const alpha = c.a * st.opacity * (mode === 'stroke' ? (st['stroke-opacity'] == null ? 1 : parseFloat(st['stroke-opacity'])) : (st['fill-opacity'] == null ? 1 : parseFloat(st['fill-opacity'])));
        if (alpha <= 0) return;
        ops.push('q');
        if (alpha < 1) ops.push(`/${stateRef(mode === 'stroke' ? 1 : alpha, mode === 'stroke' ? alpha : 1)} gs`);
        ops.push(c.rgb.map(v => N(v / 255)).join(' ') + (mode === 'stroke' ? ' RG' : ' rg'));
        if (mode === 'stroke') ops.push(`${N(sw)} w`, '1 j', '1 J');
        ops.push('BT', mode === 'stroke' ? '1 Tr' : '0 Tr');
        let cx = x;
        for (const r of runs) {
          ops.push(`/${fontRef(r.font)} ${N(r.size)} Tf`, `1 0 0 -1 ${N(cx)} ${N(y + r.dy)} Tm`, P.pdfString(r.bytes) + ' Tj');
          cx += r.width;
        }
        ops.push('ET', 'Q');
      };
      if (stroke && sw > 0 && /stroke/.test(st['paint-order'] || '')) { pass('stroke'); pass('fill'); } else { pass('fill'); if (stroke && sw > 0) pass('stroke'); }
    };
    const walk = (node, parent) => {
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (['defs', 'title', 'desc', 'marker', 'style', 'clippath', 'script', 'metadata'].includes(tag)) return;
      if (node.getAttribute('display') === 'none') return;
      const st = styleOf(node, parent);
      const tr = node.getAttribute('transform');
      if (tr) { const M = P.matrix(tr); ops.push('q', M.map(N).join(' ') + ' cm'); }
      const A = k => parseFloat(node.getAttribute(k) || 0);
      if (tag === 'g' || tag === 'svg' || tag === 'a') { for (const child of node.children) walk(child, st); }
      else if (tag === 'rect') {
        const x = A('x'), y = A('y'), w = A('width'), h = A('height');
        let rx = node.hasAttribute('rx') ? A('rx') : A('ry'), ry = node.hasAttribute('ry') ? A('ry') : rx;
        rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
        if (w > 0 && h > 0) {
          if (rx > 0 && ry > 0) {
            const k = 0.5522847498;
            paint(st, [`${N(x + rx)} ${N(y)} m`, `${N(x + w - rx)} ${N(y)} l`, `${N(x + w - rx + k * rx)} ${N(y)} ${N(x + w)} ${N(y + ry - k * ry)} ${N(x + w)} ${N(y + ry)} c`,
              `${N(x + w)} ${N(y + h - ry)} l`, `${N(x + w)} ${N(y + h - ry + k * ry)} ${N(x + w - rx + k * rx)} ${N(y + h)} ${N(x + w - rx)} ${N(y + h)} c`,
              `${N(x + rx)} ${N(y + h)} l`, `${N(x + rx - k * rx)} ${N(y + h)} ${N(x)} ${N(y + h - ry + k * ry)} ${N(x)} ${N(y + h - ry)} c`,
              `${N(x)} ${N(y + ry)} l`, `${N(x)} ${N(y + ry - k * ry)} ${N(x + rx - k * rx)} ${N(y)} ${N(x + rx)} ${N(y)} c`, 'h'].join('\n'), true);
          } else paint(st, `${N(x)} ${N(y)} ${N(w)} ${N(h)} re`, true);
        }
      } else if (tag === 'circle') { const r = A('r'); if (r > 0) paint(st, P.ellipse(A('cx'), A('cy'), r, r), true); }
      else if (tag === 'ellipse') { if (A('rx') > 0 && A('ry') > 0) paint(st, P.ellipse(A('cx'), A('cy'), A('rx'), A('ry')), true); }
      else if (tag === 'line') {
        const x1 = A('x1'), y1 = A('y1'), x2 = A('x2'), y2 = A('y2');
        paint(st, `${N(x1)} ${N(y1)} m\n${N(x2)} ${N(y2)} l`, false);
        drawMarker(node, st, [x2, y2], [x1, y1]);
      } else if (tag === 'polyline' || tag === 'polygon') {
        const p = (node.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
        if (p.length >= 4) {
          const parts = [`${N(p[0])} ${N(p[1])} m`];
          for (let k = 2; k + 1 < p.length; k += 2) parts.push(`${N(p[k])} ${N(p[k + 1])} l`);
          if (tag === 'polygon') parts.push('h');
          paint(st, parts.join('\n'), true);
        }
      } else if (tag === 'path') {
        const res = P.path(node.getAttribute('d'));
        if (res.ops) { paint(st, res.ops, true); drawMarker(node, st, res.end, res.from); }
      } else if (tag === 'text') text(node, st);
      if (tr) ops.push('Q');
    };
    const rootStyle = styleOf(svg, { opacity: 1 });
    for (const child of svg.children) walk(child, rootStyle);

    /* assemble the file */
    let content = new TextEncoder().encode(ops.join('\n'));
    let filter = '';
    if (typeof CompressionStream !== 'undefined') {
      try {
        const stream = new Blob([content]).stream().pipeThrough(new CompressionStream('deflate'));
        content = new Uint8Array(await new Response(stream).arrayBuffer());
        filter = ' /Filter /FlateDecode';
      } catch (e) { /* uncompressed */ }
    }
    const objects = [];
    const add = body => { objects.push(body); return objects.length; };
    const catalog = add(null), pages = add(null), page = add(null);
    const fontObjs = [...fonts.entries()].map(([name, ref]) => [ref, add(name === 'Symbol' ? '<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>' : `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`)]);
    const contents = add({ stream: content, dict: `<< /Length ${content.length}${filter} >>` });
    const hexTitle = s => '<FEFF' + [...String(s)].map(ch => { const u = ch.codePointAt(0); if (u > 0xFFFF) { const v = u - 0x10000; return ((0xD800 + (v >> 10)).toString(16) + (0xDC00 + (v & 0x3FF)).toString(16)).toUpperCase(); } return u.toString(16).padStart(4, '0').toUpperCase(); }).join('') + '>';
    const info = add(`<< /Producer ${hexTitle('SciMetricsPro')} /Creator ${hexTitle('SciMetricsPro')}${o.title ? ' /Title ' + hexTitle(o.title) : ''} >>`);
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
    objects[pages - 1] = `<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
    const gs = [...states.values()].map(g => `/${g.name} << /ca ${N(g.fa)} /CA ${N(g.sa)} >>`).join(' ');
    objects[page - 1] = `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${N(pageW)} ${N(pageH)}] /Resources << /ProcSet [/PDF /Text] /Font << ${fontObjs.map(([ref, id]) => `/${ref} ${id} 0 R`).join(' ')} >>${gs ? ' /ExtGState << ' + gs + ' >>' : ''} >> /Contents ${contents} 0 R >>`;
    const chunks = [];
    let length = 0;
    const push = part => { const bytes = typeof part === 'string' ? Uint8Array.from(part, ch => ch.charCodeAt(0) & 0xFF) : part; chunks.push(bytes); length += bytes.length; };
    push('%PDF-1.4\n%' + String.fromCharCode(0xE2, 0xE3, 0xCF, 0xD3) + '\n');
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(length);
      if (body && body.stream) { push(`${i + 1} 0 obj\n${body.dict}\nstream\n`); push(body.stream); push('\nendstream\nendobj\n'); }
      else push(`${i + 1} 0 obj\n${body}\nendobj\n`);
    });
    const xref = length;
    push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(off => String(off).padStart(10, '0') + ' 00000 n \n').join(''));
    push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(length);
    let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  },
};

window.SvgPdf = SvgPdf;
