/* SciMetricsPro — reusable figure renderers for ChartCard / Fig.mount.
   Every label arrives already translated (t()); the engine's own labels go through figT.

   Charts.years(cfg, {
     years: [2001, 2002, …]               (every year of the span, gaps included)
     bars: { values, label, integer }      (null values are not drawn)
     line: { values, label, axis: 'left'|'right', integer } | null
   }) → <svg>
   cfg (editable in the figure panel): title, subtitle, xlab, ylab, y2lab, barColor, lineColor,
   showLine, showValues, legendPos ('left'|'right'|'bottom'|'none')
   Charts.yearsControls({ line }) → the controls for that panel */
'use strict';

const Charts = {
  /* a (possibly fractional) year without thousands separators: 2017.25 */
  fmtYear(v, d) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString(locale(), { useGrouping: false, maximumFractionDigits: d == null ? 2 : d }); },

  /* a year label every 1, 2, 5, 10, 20, 25, 50 or 100 years, so labels never collide */
  yearStep(nYears, plotWidth, fontSize) {
    const room = (fontSize || 11) * 3.3;
    for (const s of [1, 2, 5, 10, 20, 25, 50, 100]) if (plotWidth / Math.max(1, nYears) * s >= room) return s;
    return 100;
  },

  yearsControls(o) {
    o = o || {};
    const c = [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'ylab', label: t('charts.ylab'), type: 'text' },
    ];
    if (o.line && o.line.axis === 'right') c.push({ key: 'y2lab', label: t('charts.y2lab'), type: 'text' });
    c.push({ key: 'barColor', label: t('charts.barColor'), type: 'color' });
    if (o.line) {
      c.push({ key: 'lineColor', label: t('charts.lineColor'), type: 'color' });
      c.push({ key: 'showLine', label: t('charts.showLine', { name: o.line.label }), type: 'checkbox' });
      c.push({ key: 'legendPos', label: t('charts.legend'), type: 'select',
        options: [['left', t('charts.legendLeft')], ['right', t('charts.legendRight')], ['bottom', t('charts.legendBottom')], ['none', t('charts.legendNone')]] });
    }
    c.push({ key: 'showValues', label: t('charts.showValues'), type: 'checkbox' });
    return c;
  },

  finite(values) { return values.filter(v => v != null && isFinite(v)); },

  /* a "nice" axis from 0: domain top and its ticks (whole numbers only for counts) */
  axisFrom0(values, integer) {
    const vals = Charts.finite(values);
    let max = 0;
    for (const v of vals) if (v > max) max = v;
    const hi = Fig.niceDomain(0, max > 0 ? max : 1, true)[1];
    let ticks = Fig.ticks(0, hi, 6);
    if (integer) ticks = ticks.filter(v => Number.isInteger(v));
    return { hi, ticks };
  },

  years(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const years = o.years;
    const bars = o.bars.values;
    const line = o.line && cfg.showLine !== false ? o.line : null;
    const right = !!(line && line.axis === 'right');
    const legendPos = cfg.legendPos || 'left';
    const legend = line && legendPos !== 'none';
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis');
    const fmt = v => fmtNum(v);

    const left = Charts.axisFrom0(line && !right ? bars.concat(line.values) : bars, o.bars.integer && !(line && !right && !line.integer));
    const rightAxis = right ? Charts.axisFrom0(line.values, line.integer) : null;
    const widest = ticks => Math.max(0, ...ticks.map(v => Fig.measure(fmt(v), fsTick, font)));

    /* margins from the widest tick labels, so axis titles never overlap them */
    const margin = {
      left: Math.ceil(widest(left.ticks) + 9 + (cfg.ylab ? 30 + 8 * fsAxis : 14)),
      right: right ? Math.ceil(widest(rightAxis.ticks) + 9 + (cfg.y2lab ? 30 + 8 * fsAxis : 14)) : 28,
      bottom: Math.ceil(28 * fsAxis + (cfg.xlab ? 26 * fsAxis : 0) + 10),
    };
    const axisDepth = margin.bottom;
    if (legend && legendPos === 'bottom') margin.bottom += 30 * Fig.fs('legend');
    const f = Fig.frame(svg, cfg, { margin });
    f.axisDepth = axisDepth - 2;

    const yL = Fig.scaleLinear(0, left.hi, f.y1, f.y0);
    Fig.axisY(f, yL, Object.assign({}, cfg, { ylab: '' }), { ticks: left.ticks, fmt });
    /* the axis title just beyond the widest tick label */
    if (cfg.ylab) {
      const x = Math.max(16 * fsAxis, f.x0 - 9 - widest(left.ticks) - 14 - 7 * fsAxis);
      f.g.appendChild(Fig.text(x, (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    }

    const band = Fig.scaleBand(years, f.x0, f.x1, 0.2);

    /* bars */
    const gBars = Fig.g({ 'data-series': 'bars' });
    bars.forEach((v, i) => {
      if (v == null || !isFinite(v) || v <= 0) return;
      const y = yL(v);
      gBars.appendChild(Fig.el('rect', { x: band(i).toFixed(2), y: y.toFixed(2), width: band.bandwidth.toFixed(2), height: (f.y1 - y).toFixed(2), fill: cfg.barColor, rx: Math.min(2, band.bandwidth / 4).toFixed(2) }));
    });
    f.g.appendChild(gBars);
    if (cfg.showValues && band.step >= 18 * Fig.fs('label')) {
      bars.forEach((v, i) => {
        if (v == null || !isFinite(v)) return;
        f.g.appendChild(Fig.text(band.center(i), yL(v) - 5, o.bars.integer ? fmtInt(v) : fmtNum(v, 2), { size: 9.5, anchor: 'middle', fill: f.t.fg, font, role: 'label', halo: f.t.bg, haloWidth: 2.5 }));
      });
    }

    /* x axis: years at a readable step */
    const step = Charts.yearStep(years.length, f.x1 - f.x0, fsTick);
    const gx = Fig.g();
    years.forEach((y, i) => {
      if (step > 1 && y % step !== 0) return;
      const x = band.center(i);
      gx.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
      gx.appendChild(Fig.text(x, f.y1 + 8 + fsTick, String(y), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
    });
    gx.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
    if (cfg.xlab) gx.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 8 + fsTick + 12 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gx);

    /* line, on the left axis or on its own right axis */
    if (line) {
      let yLine = yL;
      if (right) {
        yLine = Fig.scaleLinear(0, rightAxis.hi, f.y1, f.y0);
        const g = Fig.g();
        rightAxis.ticks.forEach(v => {
          const y = yLine(v);
          g.appendChild(Fig.el('line', { x1: f.x1, x2: f.x1 + 5, y1: y, y2: y, stroke: f.t.axis, 'stroke-width': 1 }));
          g.appendChild(Fig.text(f.x1 + 9, y + 4, fmt(v), { size: 11, anchor: 'start', fill: f.t.fg, font, role: 'tick' }));
        });
        g.appendChild(Fig.el('line', { x1: f.x1, x2: f.x1, y1: f.y0, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
        if (cfg.y2lab) {
          const x = Math.min(W - 16 * fsAxis, f.x1 + 9 + widest(rightAxis.ticks) + 14 + 7 * fsAxis), yMid = (f.y0 + f.y1) / 2;
          g.appendChild(Fig.text(x, yMid, cfg.y2lab, { size: 13, anchor: 'middle', fill: f.t.fg, font, rotate: 90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
        }
        f.g.appendChild(g);
      }
      let d = '', open = false;
      line.values.forEach((v, i) => {
        if (v == null || !isFinite(v)) { open = false; return; }
        d += (open ? 'L' : 'M') + band.center(i).toFixed(1) + ' ' + yLine(v).toFixed(1);
        open = true;
      });
      const gLine = Fig.g({ 'data-series': 'line' });
      gLine.appendChild(Fig.el('path', { d, fill: 'none', stroke: cfg.lineColor, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      if (band.step >= 6) {
        line.values.forEach((v, i) => {
          if (v == null || !isFinite(v)) return;
          gLine.appendChild(Fig.el('circle', { cx: band.center(i).toFixed(1), cy: yLine(v).toFixed(1), r: 3, fill: cfg.lineColor, stroke: f.t.bg, 'stroke-width': 1 }));
        });
      }
      f.g.appendChild(gLine);
    }

    if (legend) {
      /* inside the plot (a right axis occupies the right margin) */
      const lf = Object.assign({}, f, { m: Object.assign({}, f.m, { right: 0 }), legendOutside: false });
      Fig.legend(lf, [{ label: o.bars.label, color: cfg.barColor }, { label: line.label, color: cfg.lineColor, shape: 'line' }], cfg, { pos: legendPos });
    }
    return svg;
  },

  /* long names cut with an ellipsis (tables keep the full name) */
  truncate(s, max) {
    s = String(s == null ? '' : s);
    max = +max || 0;
    return max > 0 && s.length > max ? s.slice(0, Math.max(1, max - 1)).trimEnd() + '…' : s;
  },

  integerTop(hi, integer) { return integer ? Math.max(5, Math.ceil(hi)) : hi; },

  /* ---------- ranked categories as bars (horizontal by default), optionally coloured by zone ----------
     o: { labels, values, integer, decimals, zones: [1|2|3 per bar] | null, zoneLabels: [3 labels] } */
  rankBarsControls(o) {
    o = o || {};
    const c = [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.catlab'), type: 'text' },
      { key: 'ylab', label: t('charts.vallab'), type: 'text' },
    ];
    if (o.zones) {
      c.push({ key: 'colorByZone', label: t('charts.colorByZone'), type: 'checkbox' });
      c.push({ key: 'zoneColors', label: t('charts.zoneColors'), type: 'colors', labels: o.zoneLabels });
    }
    c.push({ key: 'barColor', label: o.zones ? t('charts.barColorPlain') : t('charts.barColor'), type: 'color' });
    c.push({ key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 });
    c.push({ key: 'showValues', label: t('charts.showValues'), type: 'checkbox' });
    return c;
  },

  rankBars(cfg, o) {
    const svg = Fig.svg(+cfg.width, +cfg.height, cfg.theme);
    const labels = o.labels.map(l => Charts.truncate(l, cfg.maxLabel));
    let max = 0;
    for (const v of o.values) if (v != null && isFinite(v) && v > max) max = v;
    const dom = [0, Charts.integerTop(Fig.niceDomain(0, max > 0 ? max : 1, true)[1], o.integer)];
    const byZone = !!(o.zones && cfg.colorByZone !== false);
    const zoneColor = z => (cfg.zoneColors && cfg.zoneColors[z - 1]) || Fig.color('scimetrics', [0, 2, 1][z - 1]);
    const legendItems = byZone ? [1, 2, 3].filter(z => o.zones.includes(z)).map(z => ({ label: o.zoneLabels[z - 1], color: zoneColor(z) })) : null;
    const fmt = v => (o.integer ? fmtInt(v) : fmtNum(v, o.decimals != null ? o.decimals : 2));
    const C = Fig.bandPlot(svg, cfg, labels, dom, { fmt: v => fmtNum(v), legendLabels: legendItems ? legendItems.map(i => i.label) : null, margin: { right: 46 } });
    const g = Fig.g({ 'data-series': 'bars' });
    o.values.forEach((v, i) => {
      if (v == null || !isFinite(v)) return;
      g.appendChild(C.bar(i, v, { fill: byZone ? zoneColor(o.zones[i]) : cfg.barColor, rx: 2 }));
    });
    C.f.g.appendChild(g);
    if (cfg.showValues) o.values.forEach((v, i) => { if (v != null && isFinite(v)) C.f.g.appendChild(C.valueText(C.center(i), v, fmt(v))); });
    if (legendItems) Fig.legend(C.f, legendItems, cfg, { pos: 'right' });
    return svg;
  },

  /* ---------- lines over the years (one per series) with a legend that wraps under the plot ----------
     o: { years, series: [{ label, values }], integer, max (upper limit of the axis, e.g. 100 for percentages) } */
  linesControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'ylab', label: t('charts.ylab'), type: 'text' },
      { key: 'palette', label: t('charts.palette'), type: 'select', options: Fig.paletteOptions() },
      { key: 'markers', label: t('charts.markers'), type: 'checkbox' },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
      { key: 'legendPos', label: t('charts.legend'), type: 'select', options: [['bottom', t('charts.legendBottom')], ['right', t('charts.legendRightOut')], ['none', t('charts.legendNone')]] },
    ];
  },

  lines(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis'), fsLeg = 11 * Fig.fs('legend');
    const fmt = v => fmtNum(v);
    const years = o.years;
    const items = o.series.map((s, i) => ({ label: Charts.truncate(s.label, cfg.maxLabel), color: Fig.color(cfg.palette, i) }));
    const left = Charts.axisFrom0(o.series.flatMap(s => s.values), o.integer);
    left.hi = Charts.integerTop(left.hi, o.integer);
    if (o.integer) left.ticks = Fig.ticks(0, left.hi, 6).filter(v => Number.isInteger(v));
    /* o.max: an upper limit the axis never needs to pass (100 for percentages) */
    if (o.max != null && left.hi > o.max) { left.hi = o.max; left.ticks = Fig.ticks(0, o.max, 6); }
    const widest = Math.max(0, ...left.ticks.map(v => Fig.measure(fmt(v), fsTick, font)));
    const pos = cfg.legendPos || 'bottom';
    const itemW = it => fsLeg * 1.6 + 6 + Fig.measure(it.label, fsLeg, font) + 18;
    const margin = {
      left: Math.ceil(widest + 9 + (cfg.ylab ? 30 + 8 * fsAxis : 14)),
      right: pos === 'right' ? Math.ceil(Math.min(W * 0.45, Math.max(0, ...items.map(itemW)) + 24)) : 28,
      bottom: Math.ceil(28 * fsAxis + (cfg.xlab ? 26 * fsAxis : 0) + 10),
    };
    const axisDepth = margin.bottom;
    /* legend rows under the plot */
    const rows = [];
    if (pos === 'bottom') {
      const room = W - margin.left - margin.right;
      /* an item longer than the whole row is cut with an ellipsis */
      items.forEach(it => { it.label = Fig.fitText(it.label, room - fsLeg * 1.6 - 6 - 18, fsLeg, font); });
      let row = [], x = 0;
      items.forEach(it => { const w = itemW(it); if (row.length && x + w > room) { rows.push(row); row = []; x = 0; } row.push({ it, x }); x += w; });
      if (row.length) rows.push(row);
      margin.bottom += rows.length * fsLeg * 1.7 + 6;
    }
    const f = Fig.frame(svg, cfg, { margin });
    const y = Fig.scaleLinear(0, left.hi, f.y1, f.y0);
    Fig.axisY(f, y, Object.assign({}, cfg, { ylab: '' }), { ticks: left.ticks, fmt });
    if (cfg.ylab) {
      const x = Math.max(16 * fsAxis, f.x0 - 9 - widest - 14 - 7 * fsAxis);
      f.g.appendChild(Fig.text(x, (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    }
    const y0 = years.length ? years[0] : 0, y1 = years.length ? years[years.length - 1] : 1;
    const pad = years.length > 1 ? 0.5 : 1;
    const x = Fig.scaleLinear(y0 - pad, y1 + pad, f.x0, f.x1);
    const step = Charts.yearStep(Math.max(1, y1 - y0 + 1), f.x1 - f.x0, fsTick);
    const gx = Fig.g();
    years.forEach(yr => {
      if (step > 1 && yr % step !== 0) return;
      gx.appendChild(Fig.el('line', { x1: x(yr), x2: x(yr), y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
      gx.appendChild(Fig.text(x(yr), f.y1 + 8 + fsTick, String(yr), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
    });
    gx.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
    if (cfg.xlab) gx.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 8 + fsTick + 12 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gx);

    o.series.forEach((s, i) => {
      const g = Fig.g({ 'data-series': 'line' });
      /* a missing value (null) breaks the line */
      let d = '', pen = false;
      s.values.forEach((v, k) => { if (v == null || !isFinite(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + x(years[k]).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
      g.appendChild(Fig.el('path', { d, fill: 'none', stroke: items[i].color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      /* markers on every point when asked (up to 60 years); a point with no value on either side has no line to
         show it, so it always gets its marker */
      const has = k => k >= 0 && k < s.values.length && s.values[k] != null && isFinite(s.values[k]);
      const all = cfg.markers && years.length <= 60;
      s.values.forEach((v, k) => { if (has(k) && (all || (!has(k - 1) && !has(k + 1)))) g.appendChild(Fig.el('circle', { cx: x(years[k]).toFixed(1), cy: y(v).toFixed(1), r: 2.8, fill: items[i].color, stroke: f.t.bg, 'stroke-width': 1 })); });
      f.g.appendChild(g);
    });

    const swatch = (g, x0, yy, color) => g.appendChild(Fig.el('line', { x1: x0, x2: x0 + fsLeg * 1.6, y1: yy - fsLeg * 0.35, y2: yy - fsLeg * 0.35, stroke: color, 'stroke-width': 2.6 }));
    const gl = Fig.g({ 'data-legend': '1' });
    if (pos === 'bottom') {
      rows.forEach((row, r) => {
        const yy = f.y1 + axisDepth + 4 + fsLeg + r * fsLeg * 1.7;
        row.forEach(({ it, x: dx }) => {
          swatch(gl, f.x0 + dx, yy, it.color);
          gl.appendChild(Fig.text(f.x0 + dx + fsLeg * 1.6 + 6, yy, it.label, { size: 11, fill: f.t.fg, font, role: 'legend' }));
        });
      });
    } else if (pos === 'right') {
      items.forEach((it, i) => {
        const yy = f.y0 + 8 + fsLeg + i * fsLeg * 1.7;
        swatch(gl, f.x1 + 18, yy, it.color);
        gl.appendChild(Fig.text(f.x1 + 18 + fsLeg * 1.6 + 6, yy, it.label, { size: 11, fill: f.t.fg, font, role: 'legend' }));
      });
    }
    f.g.appendChild(gl);
    return svg;
  },

  /* ---------- stacked bars by category (horizontal by default) ----------
     o: { labels, series: [{ label, values }], notes: [text at the end of each bar] | null } */
  stackedBarsControls(o) {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.catlab'), type: 'text' },
      { key: 'ylab', label: t('charts.vallab'), type: 'text' },
      { key: 'seriesColors', label: t('charts.seriesColors'), type: 'colors', labels: o.series },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
      { key: 'showNotes', label: t('charts.showNotes'), type: 'checkbox' },
    ];
  },

  stackedBars(cfg, o) {
    const svg = Fig.svg(+cfg.width, +cfg.height, cfg.theme);
    const labels = o.labels.map(l => Charts.truncate(l, cfg.maxLabel));
    const totals = labels.map((x, i) => o.series.reduce((s, se) => s + (se.values[i] || 0), 0));
    let max = 0;
    for (const v of totals) if (v > max) max = v;
    const dom = [0, Charts.integerTop(Fig.niceDomain(0, max > 0 ? max : 1, true)[1], true)];
    const color = i => (cfg.seriesColors && cfg.seriesColors[i]) || Fig.color('scimetrics', i);
    const items = o.series.map((s, i) => ({ label: s.label, color: color(i) }));
    const C = Fig.bandPlot(svg, cfg, labels, dom, { fmt: v => fmtNum(v), legendLabels: items.map(i => i.label), margin: { right: 70 } });
    o.series.forEach((s, k) => {
      const g = Fig.g({ 'data-series': 'stack-' + k });
      s.values.forEach((v, i) => {
        if (!(v > 0)) return;
        const from = o.series.slice(0, k).reduce((acc, se) => acc + (se.values[i] || 0), 0);
        g.appendChild(C.bar(i, from + v, { fill: color(k) }, from));
      });
      C.f.g.appendChild(g);
    });
    if (cfg.showNotes !== false && o.notes) totals.forEach((v, i) => { if (o.notes[i]) C.f.g.appendChild(C.valueText(C.center(i), v, o.notes[i])); });
    Fig.legend(C.f, items, cfg, { pos: 'right' });
    return svg;
  },

  /* ---------- bubbles: categories (rows) against years; size = a count, colour = a value ----------
     o: { rows: [labels], years: [first, last], points: [{ row, year, n, value }], sizeLabel, colorLabel } */
  bubblesControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'colormap', label: t('charts.colormap'), type: 'select', options: Fig.colormapOptions() },
      { key: 'logColor', label: t('charts.logColor'), type: 'checkbox' },
      { key: 'maxRadius', label: t('charts.maxRadius'), type: 'number', min: 4, max: 40, step: 1 },
      { key: 'showSpans', label: t('charts.showSpans'), type: 'checkbox' },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
    ];
  },

  /* 0–1 position of a value on a colour scale that starts at 0 (logarithmic: log10(1 + v)) */
  colorPosition(v, max, log) {
    if (v == null || !(max > 0)) return 0;
    return log ? Math.log10(1 + v) / Math.log10(1 + max) : v / max;
  },

  bubbles(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis'), fsLeg = 11 * Fig.fs('legend');
    const labels = o.rows.map(l => Charts.truncate(l, cfg.maxLabel));
    const widest = Math.max(0, ...labels.map(l => Fig.measure(l, fsTick, font)));
    const margin = { left: Math.ceil(Math.min(W * 0.4, widest + 20)), right: 30, bottom: Math.ceil(28 * fsAxis + (cfg.xlab ? 26 * fsAxis : 0) + 58 * Fig.fs('legend')) };
    const f = Fig.frame(svg, cfg, { margin });
    const band = Fig.scaleBand(labels, f.y0, f.y1, 0);
    const [y0, y1] = o.years;
    const x = Fig.scaleLinear(y0 - 0.6, y1 + 0.6, f.x0, f.x1);
    const cmap = Fig.colormaps[cfg.colormap] || Fig.colormaps.viridis;
    let nMax = 0, vMax = 0;
    for (const p of o.points) { if (p.n > nMax) nMax = p.n; if (p.value != null && p.value > vMax) vMax = p.value; }
    const rMax = Math.max(3, Math.min(band.step * 0.48, +cfg.maxRadius || 14));
    const radius = n => Math.max(2.5, rMax * Math.sqrt(n / (nMax || 1)));
    /* rows: guide lines, labels, and the span from the first to the last year */
    const grid = Fig.g();
    labels.forEach((l, i) => {
      const cy = band.center(i);
      grid.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: cy, y2: cy, stroke: f.t.grid === 'none' ? f.t.axis : f.t.grid, 'stroke-width': 0.8, opacity: f.t.grid === 'none' ? 0.3 : 1 }));
      grid.appendChild(Fig.text(f.x0 - 8, cy, l, { size: 11, anchor: 'end', baseline: 'central', fill: f.t.fg, font, role: 'tick' }));
      if (cfg.showSpans !== false) {
        const ys = o.points.filter(p => p.row === i).map(p => p.year);
        if (ys.length) grid.appendChild(Fig.el('line', { x1: x(Math.min(...ys)), x2: x(Math.max(...ys)), y1: cy, y2: cy, stroke: f.t.muted, 'stroke-width': 1.6, opacity: 0.55 }));
      }
    });
    f.g.appendChild(grid);
    /* x axis */
    const step = Charts.yearStep(y1 - y0 + 1, f.x1 - f.x0, fsTick);
    const gx = Fig.g();
    for (let yr = y0; yr <= y1; yr++) {
      if (step > 1 && yr % step !== 0) continue;
      gx.appendChild(Fig.el('line', { x1: x(yr), x2: x(yr), y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
      gx.appendChild(Fig.text(x(yr), f.y1 + 8 + fsTick, String(yr), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
    }
    gx.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
    const xlabY = f.y1 + 8 + fsTick + 12 + 13 * fsAxis;
    if (cfg.xlab) gx.appendChild(Fig.text((f.x0 + f.x1) / 2, xlabY, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gx);
    /* bubbles, largest first so small ones stay visible */
    const gb = Fig.g({ 'data-series': 'bubbles' });
    o.points.slice().sort((a, b) => b.n - a.n).forEach(p => {
      const c = Fig.el('circle', { cx: x(p.year).toFixed(1), cy: band.center(p.row).toFixed(1), r: radius(p.n).toFixed(1), fill: cmap(Charts.colorPosition(p.value, vMax, cfg.logColor)), stroke: f.t.bg, 'stroke-width': 0.8, 'fill-opacity': 0.92 });
      c.appendChild(Fig.el('title', null, `${o.rows[p.row]} · ${p.year} · ${o.sizeLabel}: ${fmtInt(p.n)} · ${o.colorLabel}: ${fmtNum(p.value, 2)}`));
      gb.appendChild(c);
    });
    f.g.appendChild(gb);
    /* legends: sizes and colour bar */
    const ly = (cfg.xlab ? xlabY : f.y1 + 8 + fsTick) + 18 + fsLeg;
    const gl = Fig.g({ 'data-legend': '1' });
    gl.appendChild(Fig.text(f.x0, ly, o.sizeLabel, { size: 11, fill: f.t.fg, font, role: 'legend', weight: 'bold' }));
    let lx = f.x0 + Fig.measure(o.sizeLabel, fsLeg, font, 'bold') + 14;
    [...new Set([1, Math.round(nMax / 2), nMax])].filter(v => v >= 1).forEach(v => {
      const r = radius(v);
      gl.appendChild(Fig.el('circle', { cx: lx + r, cy: ly - fsLeg * 0.35, r, fill: 'none', stroke: f.t.muted, 'stroke-width': 1 }));
      gl.appendChild(Fig.text(lx + 2 * r + 4, ly, fmtInt(v), { size: 11, fill: f.t.fg, font, role: 'legend' }));
      lx += 2 * r + 12 + Fig.measure(fmtInt(v), fsLeg, font);
    });
    lx += 24;
    gl.appendChild(Fig.text(lx, ly, o.colorLabel, { size: 11, fill: f.t.fg, font, role: 'legend', weight: 'bold' }));
    lx += Fig.measure(o.colorLabel, fsLeg, font, 'bold') + 10;
    const barW = Math.max(60, Math.min(180, f.x1 - lx - 40));
    for (let k = 0; k < 30; k++) gl.appendChild(Fig.el('rect', { x: (lx + k * barW / 30).toFixed(1), y: (ly - fsLeg * 0.95).toFixed(1), width: (barW / 30 + 0.5).toFixed(1), height: (fsLeg * 0.9).toFixed(1), fill: cmap(k / 29) }));
    gl.appendChild(Fig.text(lx, ly + fsLeg * 1.3, '0', { size: 10, anchor: 'start', fill: f.t.muted, font, role: 'legend' }));
    gl.appendChild(Fig.text(lx + barW, ly + fsLeg * 1.3, fmtNum(vMax, 1), { size: 10, anchor: 'end', fill: f.t.muted, font, role: 'legend' }));
    f.g.appendChild(gl);
    return svg;
  },

  /* ---------- Lotka: share of authors by number of documents, observed against expected ----------
     o: { rows: [{ x, observed, theoretical, fitted }], labels: { observed, theoretical, fitted } } */
  lotkaControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'ylab', label: t('charts.ylab'), type: 'text' },
      { key: 'logScale', label: t('charts.logScale'), type: 'checkbox' },
      { key: 'maxX', label: t('charts.maxX'), type: 'number', min: 3, max: 1000, step: 1 },
      { key: 'showFitted', label: t('charts.showFitted'), type: 'checkbox' },
      { key: 'seriesColors', label: t('charts.seriesColors'), type: 'colors', labels: [t('authors.lotka.observed'), t('authors.lotka.theoretical'), t('authors.lotka.fitted')] },
    ];
  },

  lotka(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis');
    const log = !!cfg.logScale;
    /* on linear axes the long tail of very productive authors would squeeze the curve: cut it at maxX */
    const rows = !log && +cfg.maxX > 0 ? o.rows.filter(r => r.x <= +cfg.maxX) : o.rows;
    const xmax = rows.length ? rows[rows.length - 1].x : 1;
    const color = i => (cfg.seriesColors && cfg.seriesColors[i]) || Fig.color('scimetrics', [0, 3, 1][i]);
    const series = [
      { key: 'observed', label: o.labels.observed, dash: null, points: true },
      { key: 'theoretical', label: o.labels.theoretical, dash: '6 4', points: false },
    ];
    if (cfg.showFitted !== false && rows.some(r => r.fitted != null)) series.push({ key: 'fitted', label: o.labels.fitted, dash: '2 3', points: false });
    const pct = v => fmtNum(v * 100, 1) + ' %';
    let ymin = 1, ymax = 0;
    rows.forEach(r => series.forEach(s => { const v = r[s.key]; if (v > 0) { if (v < ymin) ymin = v; if (v > ymax) ymax = v; } }));
    let yScaleTicks, yTop, yBottom;
    if (log) { yTop = 0; yBottom = Math.floor(Math.log10(ymin || 0.001)); yScaleTicks = []; for (let e = yBottom; e <= 0; e++) yScaleTicks.push(Math.pow(10, e)); }
    else { yBottom = 0; yTop = Fig.niceDomain(0, ymax || 1, true)[1]; yScaleTicks = Fig.ticks(0, yTop, 6); }
    const fmtY = v => (log ? fmtNum(v * 100, 3) + ' %' : pct(v));
    const widest = Math.max(0, ...yScaleTicks.map(v => Fig.measure(fmtY(v), fsTick, font)));
    const margin = { left: Math.ceil(widest + 9 + (cfg.ylab ? 30 + 8 * fsAxis : 14)), right: 28, bottom: Math.ceil(28 * fsAxis + (cfg.xlab ? 26 * fsAxis : 0) + 10) };
    const f = Fig.frame(svg, cfg, { margin });
    const y = log ? (v => { const t0 = (Math.log10(v) - yBottom) / (yTop - yBottom || 1); return f.y1 - t0 * (f.y1 - f.y0); }) : Fig.scaleLinear(0, yTop, f.y1, f.y0);
    const xs = log ? (v => f.x0 + Math.log10(v) / Math.log10(Math.max(xmax, 10)) * (f.x1 - f.x0)) : Fig.scaleLinear(0.5, xmax + 0.5, f.x0, f.x1);
    /* y axis with grid */
    const gy = Fig.g();
    yScaleTicks.forEach(v => {
      const yy = y(v);
      if (cfg.grid !== false && f.t.grid !== 'none') gy.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: yy, y2: yy, stroke: f.t.grid, 'stroke-width': 1, 'stroke-dasharray': cfg.gridDash ? '3 3' : null }));
      gy.appendChild(Fig.el('line', { x1: f.x0 - 5, x2: f.x0, y1: yy, y2: yy, stroke: f.t.axis, 'stroke-width': 1 }));
      gy.appendChild(Fig.text(f.x0 - 9, yy + 4, fmtY(v), { size: 11, anchor: 'end', fill: f.t.fg, font, role: 'tick' }));
    });
    gy.appendChild(Fig.el('line', { x1: f.x0, x2: f.x0, y1: f.y0, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
    if (cfg.ylab) gy.appendChild(Fig.text(Math.max(16 * fsAxis, f.x0 - 9 - widest - 14 - 7 * fsAxis), (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gy);
    /* x axis */
    const gx = Fig.g();
    const xticks = log ? [1, 2, 5, 10, 20, 50, 100, 200, 500].filter(v => v <= Math.max(xmax, 10)) : Fig.ticks(1, xmax, Math.min(10, xmax)).filter(v => Number.isInteger(v) && v >= 1);
    xticks.forEach(v => {
      gx.appendChild(Fig.el('line', { x1: xs(v), x2: xs(v), y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
      gx.appendChild(Fig.text(xs(v), f.y1 + 8 + fsTick, fmtInt(v), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
    });
    gx.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
    if (cfg.xlab) gx.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 8 + fsTick + 12 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gx);
    /* series (on a logarithmic scale, zero shares are skipped) */
    series.forEach((s, k) => {
      const g = Fig.g({ 'data-series': s.key });
      const pts = rows.filter(r => r[s.key] != null && (!log || r[s.key] > 0)).map(r => [xs(r.x), y(r[s.key])]);
      if (pts.length) g.appendChild(Fig.el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''), fill: 'none', stroke: color(k), 'stroke-width': s.points ? 2 : 2.2, 'stroke-dasharray': s.dash }));
      if (s.points) pts.forEach(p => g.appendChild(Fig.el('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3.4, fill: color(k), stroke: f.t.bg, 'stroke-width': 1 })));
      f.g.appendChild(g);
    });
    Fig.legend(f, series.map((s, k) => ({ label: s.label, color: color(k), shape: 'line' })), cfg, { pos: 'right' });
    return svg;
  },

  /* ---------- world map (Equal Earth projection) coloured by a value per country ----------
     o: { values: Map(ISO alpha-2 → number), label, names: code → name }
     Šavrič B, Patterson T, Jenny B (2019) International Journal of Geographical Information Science 33(3):454–465. */
  worldMapControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'colormap', label: t('charts.colormap'), type: 'select', options: Fig.colormapOptions() },
      { key: 'logColor', label: t('charts.logColor'), type: 'checkbox' },
      { key: 'emptyColor', label: t('charts.emptyColor'), type: 'color' },
      { key: 'borderColor', label: t('charts.borderColor'), type: 'color' },
    ];
  },

  equalEarth(lon, lat) {
    const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    const l = lon * Math.PI / 180, th = Math.asin(M * Math.sin(lat * Math.PI / 180));
    const t2 = th * th, t6 = t2 * t2 * t2;
    return [
      2 * Math.sqrt(3) * l * Math.cos(th) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1)),
      th * (A1 + A2 * t2 + A3 * t6 + A4 * t6 * t2),
    ];
  },

  worldMap(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsLeg = 11 * Fig.fs('legend');
    const world = window.WORLD_MAP || [];
    const f = Fig.frame(svg, cfg, { margin: { top: 30 + 26 * Fig.fs('title'), left: 12, right: 12, bottom: 58 * Fig.fs('legend') } });
    /* projected bounds of the countries drawn (Antarctica is not in the data) */
    const [xE] = Charts.equalEarth(180, 0), yN = Charts.equalEarth(0, 84)[1], yS = Charts.equalEarth(0, -57)[1];
    const k = Math.min((f.x1 - f.x0) / (2 * xE), (f.y1 - f.y0) / (yN - yS));
    const cx = (f.x0 + f.x1) / 2, cy = f.y0 + ((f.y1 - f.y0) - k * (yN - yS)) / 2 + k * yN;
    const project = (lon, lat) => { const p = Charts.equalEarth(lon, lat); return [cx + k * p[0], cy - k * p[1]]; };
    const cmap = Fig.colormaps[cfg.colormap] || Fig.colormaps.viridis;
    let vMax = 0;
    for (const v of o.values.values()) if (v > vMax) vMax = v;
    const g = Fig.g({ 'data-map': '1', 'stroke-linejoin': 'round' });
    for (const [code, polygons] of world) {
      let d = '';
      for (const poly of polygons) for (const ring of poly) {
        for (let i = 0; i < ring.length; i += 2) { const [px, py] = project(ring[i], ring[i + 1]); d += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1); }
        d += 'Z';
      }
      const v = o.values.get(code);
      const path = Fig.el('path', { d, 'data-code': code, 'fill-rule': 'evenodd', fill: v > 0 ? cmap(Charts.colorPosition(v, vMax, cfg.logColor)) : cfg.emptyColor, stroke: cfg.borderColor, 'stroke-width': 0.5 });
      path.appendChild(Fig.el('title', null, (o.names(code) || code) + ': ' + (v > 0 ? fmtInt(v) : '0')));
      g.appendChild(path);
    }
    f.g.appendChild(g);
    /* colour bar */
    const gl = Fig.g({ 'data-legend': '1' });
    const barW = Math.min(360, (f.x1 - f.x0) * 0.5), bx = cx - barW / 2, by = f.y1 + 18 * Fig.fs('legend');
    gl.appendChild(Fig.text(cx, by - 6, o.label, { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'legend', weight: 'bold' }));
    for (let i = 0; i < 40; i++) gl.appendChild(Fig.el('rect', { x: (bx + i * barW / 40).toFixed(1), y: by.toFixed(1), width: (barW / 40 + 0.5).toFixed(1), height: (fsLeg * 0.9).toFixed(1), fill: cmap(i / 39) }));
    const tickVals = cfg.logColor ? [0, Math.round(Math.pow(10, Math.log10(1 + vMax) / 2) - 1), vMax] : [0, vMax / 2, vMax];
    [...new Set(tickVals)].forEach(v => {
      const tx = bx + Charts.colorPosition(v, vMax, cfg.logColor) * barW;
      gl.appendChild(Fig.text(tx, by + fsLeg * 0.9 + fsLeg + 2, fmtInt(v), { size: 10, anchor: 'middle', fill: f.t.muted, font, role: 'legend' }));
    });
    gl.appendChild(Fig.el('rect', { x: (bx - 90).toFixed(1), y: by.toFixed(1), width: 14, height: (fsLeg * 0.9).toFixed(1), fill: cfg.emptyColor, stroke: f.t.axis, 'stroke-width': 0.5 }));
    gl.appendChild(Fig.text(bx - 72, by + fsLeg * 0.8, o.noDataLabel, { size: 10, anchor: 'start', fill: f.t.muted, font, role: 'legend' }));
    f.g.appendChild(gl);
    return svg;
  },

  /* ---------- collaboration world map: countries shaded by documents and arcs whose width grows with co-authorships ----------
     o: { values: Map(code → documents), pairs: [{ a, b, documents }], names: code → name, label, noDataLabel, widthLabel }
     A country is placed at the centroid of its largest polygon in the equal-area projection; small countries missing from
     the 1:110m outlines use the point of SMALL_COUNTRIES (their capital, approximately). */
  SMALL_COUNTRIES: {
    SG: [103.82, 1.35], HK: [114.17, 22.32], MO: [113.55, 22.17], MT: [14.44, 35.9], BH: [50.56, 26.07], MU: [57.55, -20.25],
    MV: [73.51, 4.18], SC: [55.45, -4.68], BB: [-59.54, 13.19], AD: [1.52, 42.51], MC: [7.42, 43.74], LI: [9.55, 47.14],
    SM: [12.46, 43.94], VA: [12.45, 41.9], KM: [43.87, -11.88], CV: [-23.6, 15.1], ST: [6.61, 0.19], WS: [-172.1, -13.76],
    TO: [-175.2, -21.18], KI: [173.0, 1.45], FM: [158.2, 6.92], MH: [171.18, 7.1], PW: [134.58, 7.5], NR: [166.93, -0.52],
    TV: [179.2, -8.52], GD: [-61.68, 12.12], LC: [-60.98, 13.9], AG: [-61.8, 17.07], DM: [-61.37, 15.41], KN: [-62.78, 17.3],
    VC: [-61.2, 13.25], GU: [144.79, 13.44], RE: [55.53, -21.12], GP: [-61.55, 16.25], MQ: [-61.02, 14.64], CW: [-68.99, 12.17],
    AW: [-69.97, 12.52], BM: [-64.76, 32.3], FO: [-6.9, 62.0], GF: [-53.1, 3.9], YT: [45.17, -12.83], PF: [-149.57, -17.54],
  },
  _countryPoints: null,
  /* code → [x, y] in equal-area projection units (not scaled) */
  countryPoints() {
    if (Charts._countryPoints && Charts._countryPoints.world === window.WORLD_MAP) return Charts._countryPoints.points;
    const points = new Map();
    for (const [code, polygons] of window.WORLD_MAP || []) {
      let best = null, bestArea = 0;
      for (const poly of polygons) {
        const ring = poly[0];
        let a = 0, cx = 0, cy = 0;
        const n = ring.length / 2;
        for (let i = 0; i < n; i++) {
          const p = Charts.equalEarth(ring[2 * i], ring[2 * i + 1]), q = Charts.equalEarth(ring[2 * ((i + 1) % n)], ring[2 * ((i + 1) % n) + 1]);
          const cross = p[0] * q[1] - q[0] * p[1];
          a += cross; cx += (p[0] + q[0]) * cross; cy += (p[1] + q[1]) * cross;
        }
        if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
      }
      if (best) points.set(code, best);
    }
    for (const code in Charts.SMALL_COUNTRIES) if (!points.has(code)) points.set(code, Charts.equalEarth(...Charts.SMALL_COUNTRIES[code]));
    Charts._countryPoints = { world: window.WORLD_MAP, points };
    return points;
  },

  collaborationMapControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'colormap', label: t('charts.colormap'), type: 'select', options: Fig.colormapOptions() },
      { key: 'logColor', label: t('charts.logColor'), type: 'checkbox' },
      { key: 'emptyColor', label: t('charts.emptyColor'), type: 'color' },
      { key: 'borderColor', label: t('charts.borderColor'), type: 'color' },
      { key: 'arcColor', label: t('charts.arcColor'), type: 'color' },
      { key: 'arcOpacity', label: t('charts.arcOpacity'), type: 'number', min: 0.05, max: 1, step: 0.05 },
      { key: 'minWidth', label: t('charts.arcMinWidth'), type: 'number', min: 0.2, max: 10, step: 0.2 },
      { key: 'maxWidth', label: t('charts.arcMaxWidth'), type: 'number', min: 1, max: 30, step: 0.5 },
      { key: 'curvature', label: t('charts.curvature'), type: 'number', min: 0, max: 0.6, step: 0.05 },
      { key: 'labelCount', label: t('charts.labelCount'), type: 'number', min: 0, max: 100, step: 1 },
    ];
  },

  collaborationMap(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsLeg = 11 * Fig.fs('legend');
    const world = window.WORLD_MAP || [];
    const f = Fig.frame(svg, cfg, { margin: { top: 30 + 26 * Fig.fs('title'), left: 12, right: 12, bottom: 64 * Fig.fs('legend') } });
    const [xE] = Charts.equalEarth(180, 0), yN = Charts.equalEarth(0, 84)[1], yS = Charts.equalEarth(0, -57)[1];
    const k = Math.min((f.x1 - f.x0) / (2 * xE), (f.y1 - f.y0) / (yN - yS));
    const cx = (f.x0 + f.x1) / 2, cy = f.y0 + ((f.y1 - f.y0) - k * (yN - yS)) / 2 + k * yN;
    const toScreen = p => [cx + k * p[0], cy - k * p[1]];
    const cmap = Fig.colormaps[cfg.colormap] || Fig.colormaps.viridis;
    let vMax = 0;
    for (const v of o.values.values()) if (v > vMax) vMax = v;
    const g = Fig.g({ 'data-map': '1', 'stroke-linejoin': 'round' });
    for (const [code, polygons] of world) {
      let d = '';
      for (const poly of polygons) for (const ring of poly) {
        for (let i = 0; i < ring.length; i += 2) { const [px, py] = toScreen(Charts.equalEarth(ring[i], ring[i + 1])); d += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1); }
        d += 'Z';
      }
      const v = o.values.get(code);
      const path = Fig.el('path', { d, 'data-code': code, 'fill-rule': 'evenodd', fill: v > 0 ? cmap(Charts.colorPosition(v, vMax, cfg.logColor)) : cfg.emptyColor, stroke: cfg.borderColor, 'stroke-width': 0.5 });
      path.appendChild(Fig.el('title', null, (o.names(code) || code) + ': ' + (v > 0 ? fmtInt(v) : '0')));
      g.appendChild(path);
    }
    f.g.appendChild(g);
    /* arcs: quadratic curves that bend to the left of the direction west → east, widest for the most co-authorships */
    const pts = Charts.countryPoints();
    const drawn = o.pairs.filter(p => pts.has(p.a) && pts.has(p.b));
    let cMin = Infinity, cMax = 0;
    for (const p of drawn) { if (p.documents < cMin) cMin = p.documents; if (p.documents > cMax) cMax = p.documents; }
    const wMin = Math.max(0.1, +cfg.minWidth || 0.8), wMax = Math.max(wMin, +cfg.maxWidth || 8);
    const width = n => (cMax > cMin ? wMin + (wMax - wMin) * (n - cMin) / (cMax - cMin) : (wMin + wMax) / 2);
    const bend = cfg.curvature == null ? 0.25 : +cfg.curvature;
    const ga = Fig.g({ 'data-series': 'arcs', fill: 'none', 'stroke-linecap': 'round' });
    drawn.slice().sort((x, y) => x.documents - y.documents).forEach(p => {
      let A = toScreen(pts.get(p.a)), B = toScreen(pts.get(p.b));
      if (A[0] > B[0]) [A, B] = [B, A];
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1];
      const qx = mx + dy * bend, qy = my - dx * bend;
      const path = Fig.el('path', { d: `M${A[0].toFixed(1)} ${A[1].toFixed(1)}Q${qx.toFixed(1)} ${qy.toFixed(1)} ${B[0].toFixed(1)} ${B[1].toFixed(1)}`, stroke: cfg.arcColor || '#c8416a', 'stroke-opacity': cfg.arcOpacity == null ? 0.6 : +cfg.arcOpacity, 'stroke-width': width(p.documents).toFixed(2), 'data-pair': p.a + '-' + p.b });
      path.appendChild(Fig.el('title', null, (o.names(p.a) || p.a) + ' – ' + (o.names(p.b) || p.b) + ': ' + fmtInt(p.documents)));
      ga.appendChild(path);
    });
    f.g.appendChild(ga);
    /* the countries joined by arcs, with the names of those with most documents */
    const linked = [...new Set(drawn.flatMap(p => [p.a, p.b]))].sort((x, y) => (o.values.get(y) || 0) - (o.values.get(x) || 0) || (x < y ? -1 : 1));
    const gp = Fig.g({ 'data-series': 'countries' });
    linked.forEach(code => {
      const [px, py] = toScreen(pts.get(code));
      const c = Fig.el('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: 2.6, fill: f.t.fg, stroke: f.t.bg, 'stroke-width': 0.8, 'data-code': code });
      c.appendChild(Fig.el('title', null, o.names(code) || code));
      gp.appendChild(c);
    });
    f.g.appendChild(gp);
    const gt = Fig.g({ 'data-labels': '1' });
    Fig.repelLabels(gt, f, linked.slice(0, Math.max(0, cfg.labelCount == null ? 12 : +cfg.labelCount)).map(code => { const [px, py] = toScreen(pts.get(code)); return { x: px, y: py, r: 3, text: o.names(code) || code, size: 9.5, weight: 'bold' }; }),
      { obstacles: linked.map(code => { const [px, py] = toScreen(pts.get(code)); return { x: px, y: py, r: 3 }; }), maxDistance: 40, leaderMin: 10 });
    f.g.appendChild(gt);
    /* legends: colour bar for documents and line widths for co-authorships */
    const gl = Fig.g({ 'data-legend': '1' });
    const barW = Math.min(300, (f.x1 - f.x0) * 0.35), bx = f.x0 + (f.x1 - f.x0) * 0.08, by = f.y1 + 22 * Fig.fs('legend');
    gl.appendChild(Fig.text(bx + barW / 2, by - 6, o.label, { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'legend', weight: 'bold' }));
    for (let i = 0; i < 40; i++) gl.appendChild(Fig.el('rect', { x: (bx + i * barW / 40).toFixed(1), y: by.toFixed(1), width: (barW / 40 + 0.5).toFixed(1), height: (fsLeg * 0.9).toFixed(1), fill: cmap(i / 39) }));
    [0, vMax].forEach(v => gl.appendChild(Fig.text(bx + Charts.colorPosition(v, vMax, cfg.logColor) * barW, by + fsLeg * 0.9 + fsLeg + 2, fmtInt(v), { size: 10, anchor: 'middle', fill: f.t.muted, font, role: 'legend' })));
    if (drawn.length) {
      const lx = f.x0 + (f.x1 - f.x0) * 0.58, lw = 46;
      gl.appendChild(Fig.text(lx + 90, by - 6, o.widthLabel, { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'legend', weight: 'bold' }));
      [...new Set([cMin, cMax])].forEach((v, i) => {
        const x0 = lx + i * 110, yy = by + fsLeg * 0.45;
        gl.appendChild(Fig.el('line', { x1: x0, x2: x0 + lw, y1: yy, y2: yy, stroke: cfg.arcColor || '#c8416a', 'stroke-opacity': cfg.arcOpacity == null ? 0.6 : +cfg.arcOpacity, 'stroke-width': width(v).toFixed(2), 'stroke-linecap': 'round' }));
        gl.appendChild(Fig.text(x0 + lw + 8, yy + fsLeg * 0.35, fmtInt(v), { size: 10, anchor: 'start', fill: f.t.muted, font, role: 'legend' }));
      });
    }
    f.g.appendChild(gl);
    return svg;
  },

  /* ---------- PRISMA 2020 flow diagram (databases and registers) ----------
     o: { header, phases: { identification, screening, included }, boxes: { key: [lines] } } where each line is
        { text, bold, indent } and the keys are identified, removed, screened, excluded, sought, notRetrieved, assessed,
        reportsExcluded, included. Page MJ et al. (2021) BMJ 372:n71. The height grows with the lines. */
  prismaFlowControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'header', label: t('charts.prismaHeader'), type: 'text' },
      { key: 'headerFill', label: t('charts.prismaHeaderFill'), type: 'color' },
      { key: 'phaseFill', label: t('charts.prismaPhaseFill'), type: 'color' },
      { key: 'boxFill', label: t('charts.prismaBoxFill'), type: 'color' },
      { key: 'boxStroke', label: t('charts.prismaBoxStroke'), type: 'color' },
      { key: 'textSize', label: t('charts.prismaTextSize'), type: 'number', min: 8, max: 20, step: 0.5 },
    ];
  },

  wrapText(text, maxWidth, size, font, weight) {
    const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (line && Fig.measure(next, size, font, weight) > maxWidth) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  },

  prismaFlow(cfg, o) {
    const W = +cfg.width;
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const size = (+cfg.textSize || 12) * Fig.fs('label'), lh = size * 1.35, pad = 10;
    const top = (cfg.title ? 56 : 30) + (cfg.subtitle ? 16 : 0);
    const phaseW = 34, left = 16 + phaseW + 16, gapX = 56, gapY = 34;
    const colW = (W - left - 16 - gapX) / 2;
    const mainX = left, sideX = left + colW + gapX;
    /* lines of each box wrapped to its width */
    const layout = key => {
      const out = [];
      for (const ln of o.boxes[key] || []) {
        const indent = ln.indent ? 14 : 0;
        Charts.wrapText(ln.text, colW - 2 * pad - indent, size, font, ln.bold ? 'bold' : 'normal').forEach((s, i) => out.push({ text: s, bold: ln.bold, indent: indent + (i ? 8 : 0), key: ln.key }));
      }
      return out;
    };
    const rows = [['identified', 'removed'], ['screened', 'excluded'], ['sought', 'notRetrieved'], ['assessed', 'reportsExcluded'], ['included', null]];
    const boxH = lines => 2 * pad + lines.length * lh;
    const headerH = cfg.header === '' ? 0 : 34;
    let y = top + headerH + (headerH ? 18 : 0);
    const placed = rows.map(([a, b]) => {
      const la = layout(a), lb = b ? layout(b) : null;
      const h = Math.max(boxH(la), lb ? boxH(lb) : 0);
      const row = { a, b, la, lb, y, h };
      y += h + gapY;
      return row;
    });
    const H = Math.max(+cfg.height || 0, Math.ceil(y - gapY + 20));
    const svg = Fig.svg(W, H, cfg.theme);
    svg.dataset.h = H;
    const f = Fig.frame(svg, cfg, { margin: { top: 0, left: 0, right: 0, bottom: 0 } });
    const stroke = cfg.boxStroke || f.t.fg;
    const defs = Fig.el('defs');
    const marker = Fig.el('marker', { id: 'prArrow', viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 8, markerHeight: 8, markerUnits: 'userSpaceOnUse', orient: 'auto' });
    marker.appendChild(Fig.el('path', { d: 'M0 0L10 5L0 10z', fill: stroke }));
    defs.appendChild(marker);
    svg.insertBefore(defs, svg.firstChild);
    const g = f.g;
    if (headerH) {
      const hy = top;
      g.appendChild(Fig.el('rect', { x: mainX, y: hy, width: W - 16 - mainX, height: headerH, rx: 8, fill: cfg.headerFill || '#f2c14e', stroke, 'stroke-width': 1, 'data-part': 'header' }));
      g.appendChild(Fig.text((mainX + W - 16) / 2, hy + headerH / 2 + size * 0.35, cfg.header != null ? cfg.header : o.header, { size: size / Fig.fs('label') * 1.05, weight: 'bold', anchor: 'middle', fill: '#1b2433', font, role: 'label' }));
    }
    const drawBox = (key, x, yy, h, lines) => {
      const box = Fig.g({ 'data-box': key });
      box.appendChild(Fig.el('rect', { x, y: yy, width: colW, height: h, rx: 4, fill: cfg.boxFill || f.t.bg, stroke, 'stroke-width': 1.2 }));
      lines.forEach((ln, i) => box.appendChild(Fig.text(x + pad + ln.indent, yy + pad + lh * i + size, ln.text, { size: size / Fig.fs('label'), weight: ln.bold ? 'bold' : 'normal', fill: f.t.fg, font, role: 'label' })));
      g.appendChild(box);
    };
    const arrow = (x1, y1, x2, y2) => g.appendChild(Fig.el('line', { x1, y1, x2, y2, stroke, 'stroke-width': 1.3, 'marker-end': 'url(#prArrow)', 'data-part': 'arrow' }));
    placed.forEach((row, i) => {
      drawBox(row.a, mainX, row.y, row.h, row.la);
      if (row.b) {
        drawBox(row.b, sideX, row.y, row.h, row.lb);
        arrow(mainX + colW, row.y + row.h / 2, sideX - 1, row.y + row.h / 2);
      }
      if (i + 1 < placed.length) arrow(mainX + colW / 2, row.y + row.h, mainX + colW / 2, placed[i + 1].y - 1);
    });
    /* phases: blue bars on the left with the name turned */
    const phase = (key, from, to) => {
      const y0 = placed[from].y, y1 = placed[to].y + placed[to].h;
      const pg = Fig.g({ 'data-phase': key });
      pg.appendChild(Fig.el('rect', { x: 16, y: y0, width: phaseW, height: y1 - y0, rx: 8, fill: cfg.phaseFill || '#a9c7e8', stroke, 'stroke-width': 1 }));
      pg.appendChild(Fig.text(16 + phaseW / 2 + size * 0.35, (y0 + y1) / 2, o.phases[key], { size: size / Fig.fs('label') * 1.05, weight: 'bold', anchor: 'middle', fill: '#1b2433', font, rotate: -90, role: 'label' }));
      g.appendChild(pg);
    };
    phase('identification', 0, 0);
    phase('screening', 1, 3);
    phase('included', 4, 4);
    return svg;
  },

  /* ---------- Bradford: cumulative documents against the logarithm of the source rank ----------
     o: { cumulative: [documents up to each rank], cuts: [last index of zone 1, of zone 2], total, zoneLabels } */
  bradfordControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'ylab', label: t('charts.ylab'), type: 'text' },
      { key: 'lineColor', label: t('charts.lineColor'), type: 'color' },
      { key: 'zoneColor', label: t('charts.coreColor'), type: 'color' },
      { key: 'showThirds', label: t('charts.showThirds'), type: 'checkbox' },
      { key: 'markers', label: t('charts.markers'), type: 'checkbox' },
    ];
  },

  bradford(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis');
    const n = o.cumulative.length;
    const fmt = v => fmtNum(v);
    const top = Charts.integerTop(Fig.niceDomain(0, o.total > 0 ? o.total : 1, true)[1], true);
    const ticks = Fig.ticks(0, top, 6).filter(v => Number.isInteger(v));
    const widest = Math.max(0, ...ticks.map(v => Fig.measure(fmt(v), fsTick, font)));
    const margin = { left: Math.ceil(widest + 9 + (cfg.ylab ? 30 + 8 * fsAxis : 14)), right: 34, bottom: Math.ceil(28 * fsAxis + (cfg.xlab ? 26 * fsAxis : 0) + 10) };
    const f = Fig.frame(svg, cfg, { margin });
    const y = Fig.scaleLinear(0, top, f.y1, f.y0);
    Fig.axisY(f, y, Object.assign({}, cfg, { ylab: '' }), { ticks, fmt });
    if (cfg.ylab) {
      const xl = Math.max(16 * fsAxis, f.x0 - 9 - widest - 14 - 7 * fsAxis);
      f.g.appendChild(Fig.text(xl, (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    }
    const logMax = Math.log10(Math.max(n, 10));
    const x = rank => f.x0 + Math.log10(rank) / logMax * (f.x1 - f.x0);
    /* zone borders halfway (in log scale) between the last rank of a zone and the next one */
    const border = k => (k + 1 < n ? Math.sqrt((k + 1) * (k + 2)) : Math.max(n, 1));
    const [k1, k2] = o.cuts;
    const b1 = n ? border(k1) : 1, b2 = n ? border(k2) : 1;
    const gz = Fig.g({ 'data-zones': '1' });
    gz.appendChild(Fig.el('rect', { x: f.x0, y: f.y0, width: Math.max(0, x(b1) - f.x0).toFixed(1), height: f.y1 - f.y0, fill: Fig.alpha(cfg.zoneColor, 0.16), 'data-core': '1' }));
    [b1, b2].forEach(b => { if (b < Math.pow(10, logMax) && b > 1) gz.appendChild(Fig.el('line', { x1: x(b), x2: x(b), y1: f.y0, y2: f.y1, stroke: f.t.muted, 'stroke-width': 1, 'stroke-dasharray': '4 3' })); });
    const mids = [[1, b1], [b1, b2], [b2, Math.pow(10, logMax)]];
    mids.forEach(([a, b], z) => {
      if (!(b > a) || (z > 0 && !o.cuts.length)) return;
      const cx = (x(a) + x(b)) / 2;
      if (x(b) - x(a) < 24) return;
      gz.appendChild(Fig.text(cx, f.y0 + 16, o.zoneLabels[z], { size: 11, anchor: 'middle', fill: z === 0 ? Fig.darken(cfg.zoneColor, 0.2) : f.t.muted, font, weight: z === 0 ? 'bold' : 'normal', role: 'label', halo: f.t.bg, haloWidth: 3 }));
    });
    f.g.appendChild(gz);
    if (cfg.showThirds) {
      [1, 2].forEach(k => {
        const yy = y(o.total * k / 3);
        f.g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: yy, y2: yy, stroke: f.t.muted, 'stroke-width': 0.8, 'stroke-dasharray': '2 3' }));
        f.g.appendChild(Fig.text(f.x1 + 4, yy + 4, k + '/3', { size: 10, anchor: 'start', fill: f.t.muted, font, role: 'label' }));
      });
    }
    /* logarithmic x axis: labels at powers of ten, small ticks between them */
    const gx = Fig.g();
    for (let d = 0; d <= Math.ceil(logMax); d++) {
      for (let m = 1; m <= 9; m++) {
        const v = m * Math.pow(10, d);
        if (Math.log10(v) > logMax + 1e-9) break;
        const xx = x(v), major = m === 1;
        gx.appendChild(Fig.el('line', { x1: xx, x2: xx, y1: f.y1, y2: f.y1 + (major ? 6 : 3), stroke: f.t.axis, 'stroke-width': 1 }));
        if (major || logMax < 1.05) gx.appendChild(Fig.text(xx, f.y1 + 8 + fsTick, fmtInt(v), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
      }
    }
    gx.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
    if (cfg.xlab) gx.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 8 + fsTick + 12 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gx);
    if (n) {
      const g = Fig.g({ 'data-series': 'line' });
      g.appendChild(Fig.el('path', { d: o.cumulative.map((c, i) => (i ? 'L' : 'M') + x(i + 1).toFixed(1) + ' ' + y(c).toFixed(1)).join(''), fill: 'none', stroke: cfg.lineColor, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
      if (cfg.markers && n <= 120) o.cumulative.forEach((c, i) => g.appendChild(Fig.el('circle', { cx: x(i + 1).toFixed(1), cy: y(c).toFixed(1), r: 2.6, fill: cfg.lineColor, stroke: f.t.bg, 'stroke-width': 0.8 })));
      f.g.appendChild(g);
    }
    return svg;
  },

  /* ---------- RPYS: cited references per reference year (bars) and deviation from the 5-year median (line) ----------
     o: { years, counts, deviation, peaks: [{ year, text }] (most marked first), labels: { bars, line } } */
  rpysControls(o) {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'ylab', label: t('charts.ylab'), type: 'text' },
      { key: 'barColor', label: t('charts.barColor'), type: 'color' },
      { key: 'lineColor', label: t('charts.lineColor'), type: 'color' },
      { key: 'showLine', label: t('charts.showLine', { name: o.line }), type: 'checkbox' },
      { key: 'peakLabels', label: t('charts.peakLabels'), type: 'number', min: 0, max: 20, step: 1 },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
      { key: 'legendPos', label: t('charts.legend'), type: 'select',
        options: [['left', t('charts.legendLeft')], ['right', t('charts.legendRight')], ['bottom', t('charts.legendBottom')], ['none', t('charts.legendNone')]] },
    ];
  },

  rpys(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis');
    const years = o.years;
    const showLine = cfg.showLine !== false;
    const peaks = (o.peaks || []).slice(0, Math.max(0, +cfg.peakLabels || 0));
    const values = o.counts.concat(showLine ? o.deviation : []);
    let lo = 0, hi = 0;
    for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!(hi > lo)) hi = lo + 1;
    /* the axis ends at the tick just beyond the data (no extra padding below the lowest deviation) */
    const t0 = Fig.ticks(lo, hi, 6), tStep = t0.length > 1 ? t0[1] - t0[0] : 1;
    const dom = [Math.floor(lo / tStep) * tStep, Math.ceil((hi + tStep * 0.04) / tStep) * tStep];
    const ticks = Fig.ticks(dom[0], dom[1], 6).filter(v => Number.isInteger(v));
    const fmt = v => fmtNum(v);
    const widest = Math.max(0, ...ticks.map(v => Fig.measure(fmt(v), fsTick, font)));
    const legendPos = cfg.legendPos || 'left';
    const margin = { top: 56, left: Math.ceil(widest + 9 + (cfg.ylab ? 30 + 8 * fsAxis : 14)), right: 28, bottom: Math.ceil(28 * fsAxis + (cfg.xlab ? 26 * fsAxis : 0) + 10) };
    const axisDepth = margin.bottom;
    if (legendPos === 'bottom') margin.bottom += 30 * Fig.fs('legend');
    const pad = years.length > 80 ? 0.08 : 0.2;
    /* peak notes in rows above the plot, so they never cover the bars (the x positions do not depend on the top margin) */
    const fsL = 9.5 * Fig.fs('label'), lh = fsL * 1.5;
    const idx = new Map(years.map((yr, i) => [yr, i]));
    const bandX = Fig.scaleBand(years, margin.left, W - margin.right, pad);
    const notes = [], rowEnd = [];
    peaks.map(p => ({ p, i: idx.get(p.year) })).filter(n => n.i !== undefined).sort((a, b) => a.i - b.i).forEach(n => {
      const text = Charts.truncate(n.p.text, cfg.maxLabel);
      const w = Fig.measure(text, fsL, font) + 4;
      const x0 = Math.min(Math.max(bandX.center(n.i) - w / 2, margin.left), W - margin.right - w);
      let row = rowEnd.findIndex(e => e + 10 <= x0);
      if (row < 0 && rowEnd.length < 6) { row = rowEnd.length; rowEnd.push(-Infinity); }
      if (row >= 0) rowEnd[row] = x0 + w;
      notes.push({ p: n.p, i: n.i, text, x0, w, row });
    });
    margin.top += rowEnd.length ? rowEnd.length * lh + 10 : 0;
    const f = Fig.frame(svg, cfg, { margin });
    f.axisDepth = axisDepth - 2;
    const y = Fig.scaleLinear(dom[0], dom[1], f.y1, f.y0);
    Fig.axisY(f, y, Object.assign({}, cfg, { ylab: '' }), { ticks, fmt });
    if (cfg.ylab) f.g.appendChild(Fig.text(Math.max(16 * fsAxis, f.x0 - 9 - widest - 14 - 7 * fsAxis), (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    const band = Fig.scaleBand(years, f.x0, f.x1, pad);
    const y0 = y(0);
    const gb = Fig.g({ 'data-series': 'bars' });
    o.counts.forEach((v, i) => {
      if (!(v > 0)) return;
      gb.appendChild(Fig.el('rect', { x: band(i).toFixed(2), y: y(v).toFixed(2), width: Math.max(0.6, band.bandwidth).toFixed(2), height: (y0 - y(v)).toFixed(2), fill: cfg.barColor }));
    });
    f.g.appendChild(gb);
    /* x axis at zero and the year labels under the plot */
    const step = Charts.yearStep(years.length, f.x1 - f.x0, fsTick);
    const gx = Fig.g();
    years.forEach((yr, i) => {
      if (step > 1 && yr % step !== 0) return;
      const x = band.center(i);
      gx.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
      gx.appendChild(Fig.text(x, f.y1 + 8 + fsTick, String(yr), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
    });
    gx.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
    if (dom[0] < 0) gx.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y0, y2: y0, stroke: f.t.axis, 'stroke-width': 0.8 }));
    if (cfg.xlab) gx.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 8 + fsTick + 12 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gx);
    if (showLine && years.length) {
      const gl = Fig.g({ 'data-series': 'deviation' });
      gl.appendChild(Fig.el('path', { d: o.deviation.map((v, i) => (i ? 'L' : 'M') + band.center(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(''), fill: 'none', stroke: cfg.lineColor, 'stroke-width': years.length > 150 ? 1.4 : 2, 'stroke-linejoin': 'round' }));
      f.g.appendChild(gl);
    }
    /* peaks: a mark on top of the year, a dashed leader and its note (the most marked peaks keep their order in the data) */
    if (notes.length) {
      const ga = Fig.g({ 'data-peaks': '1' });
      const gt = Fig.g();
      peaks.forEach(p => {
        const n = notes.find(x => x.p === p);
        if (!n) return;
        const top = Math.max(o.counts[n.i], showLine ? o.deviation[n.i] : 0);
        const cx = band.center(n.i), cy = y(top);
        if (n.row >= 0) {
          const yb = f.y0 - 8 - n.row * lh;
          ga.appendChild(Fig.el('line', { x1: cx.toFixed(1), x2: cx.toFixed(1), y1: (yb + 3).toFixed(1), y2: (cy - 5).toFixed(1), stroke: f.t.muted, 'stroke-width': 0.7, 'stroke-dasharray': '2 2' }));
          gt.appendChild(Fig.text(n.x0 + 2, yb, n.text, { size: 9.5, fill: f.t.fg, font, role: 'label', halo: f.t.bg, haloWidth: 3 }));
        }
        ga.appendChild(Fig.el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 3.2, fill: cfg.lineColor, stroke: f.t.bg, 'stroke-width': 1, 'data-year': p.year }));
      });
      ga.appendChild(gt);
      f.g.appendChild(ga);
    }
    if (legendPos !== 'none') {
      const items = [{ label: o.labels.bars, color: cfg.barColor }];
      if (showLine) items.push({ label: o.labels.line, color: cfg.lineColor, shape: 'line' });
      Fig.legend(Object.assign({}, f, { m: Object.assign({}, f.m, { right: 0 }), legendOutside: false }), items, cfg, { pos: legendPos });
    }
    return svg;
  },

  /* ---------- word cloud: sizes by frequency, placed on a spiral without overlaps ----------
     o: { words: [{ label, value }] } (most frequent first) */
  wordCloudControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'colorBy', label: t('charts.colorBy'), type: 'select', options: [['palette', t('charts.colorByPalette')], ['value', t('charts.colorByValue')]] },
      { key: 'palette', label: t('charts.palette'), type: 'select', options: Fig.paletteOptions() },
      { key: 'colormap', label: t('charts.colormap'), type: 'select', options: Fig.colormapOptions() },
      { key: 'minFont', label: t('charts.minFont'), type: 'number', min: 6, max: 40, step: 1 },
      { key: 'maxFont', label: t('charts.maxFont'), type: 'number', min: 12, max: 120, step: 2 },
      { key: 'rotate', label: t('charts.rotate'), type: 'select', options: [['none', t('charts.rotateNone')], ['some', t('charts.rotateSome')], ['half', t('charts.rotateHalf')]] },
      { key: 'bold', label: t('charts.bold'), type: 'checkbox' },
    ];
  },

  /* the layout alone (also used by the tests): [{ index, x, y, size, rotate, box: [x0, y0, x1, y1] }] */
  cloudLayout(words, frame, o) {
    const { x0, y0, x1, y1 } = frame;
    const rw = x1 - x0, rh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const list = words.filter(w => w.value > 0);
    if (!list.length || rw <= 0 || rh <= 0) return { placed: [], dropped: 0 };
    let vmax = -Infinity, vmin = Infinity;
    for (const w of list) { if (w.value > vmax) vmax = w.value; if (w.value < vmin) vmin = w.value; }
    const pos = v => (vmax === vmin ? 1 : (Math.sqrt(v) - Math.sqrt(vmin)) / (Math.sqrt(vmax) - Math.sqrt(vmin)));
    const aspect = rw / rh;
    const cell = 32;
    let shrink = 1, placed = [], dropped = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      placed = []; dropped = 0;
      const grid = new Map();
      const cells = (b, fn) => {
        for (let i = Math.floor(b[0] / cell); i <= Math.floor(b[2] / cell); i++)
          for (let j = Math.floor(b[1] / cell); j <= Math.floor(b[3] / cell); j++) if (fn(i + ',' + j) === false) return false;
        return true;
      };
      const last = attempt === 5;
      for (let index = 0; index < list.length; index++) {
        const w = list[index];
        const size = (o.minFont + (o.maxFont - o.minFont) * pos(w.value)) * shrink;
        const tw = o.measure(w.label, size) + 2, th = size * 1.1 + 1;
        const rot = o.rotate === 'half' ? index % 2 === 1 : o.rotate === 'some' ? index % 5 === 2 : false;
        const bw = rot ? th : tw, bh = rot ? tw : th;
        let done = false;
        if (bw <= rw && bh <= rh) {
          const rMax = Math.hypot(rw, rh) / 2;
          for (let a = 0, r = 0; r <= rMax; ) {
            const px = cx + r * Math.cos(a) * aspect, py = cy + r * Math.sin(a);
            const b = [px - bw / 2, py - bh / 2, px + bw / 2, py + bh / 2];
            if (b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1 &&
              cells(b, k => !(grid.get(k) || []).some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]))) {
              cells(b, k => { if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); });
              placed.push({ index, word: w, x: px, y: py, size, rotate: rot, box: b });
              done = true;
              break;
            }
            a += Math.max(0.02, Math.min(0.35, 4 / (r + 1)));
            r = 1.6 * a;
          }
        }
        if (!done) {
          dropped++;
          if (!last && dropped > 2) break;        /* too crowded: start again with smaller type */
        }
      }
      if (!dropped || last) break;
      shrink *= 0.86;
    }
    return { placed, dropped };
  },

  wordCloud(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const weight = cfg.bold ? 'bold' : 'normal';
    const f = Fig.frame(svg, cfg, { margin: { left: 14, right: 14, bottom: 14 } });
    const fsL = Fig.fs('label');
    const minFont = Math.max(4, +cfg.minFont || 10), maxFont = Math.max(minFont, +cfg.maxFont || 56);
    const layout = Charts.cloudLayout(o.words, f, { minFont: minFont * fsL, maxFont: maxFont * fsL, rotate: cfg.rotate, measure: (s, size) => Fig.measure(s, size, font, weight) });
    const cmap = Fig.colormaps[cfg.colormap] || Fig.colormaps.viridis;
    let vmax = 0;
    for (const w of o.words) if (w.value > vmax) vmax = w.value;
    const g = Fig.g({ 'data-cloud': '1' });
    layout.placed.forEach(p => {
      const w = p.word;
      const fill = cfg.colorBy === 'value' ? cmap(0.15 + 0.85 * Charts.colorPosition(w.value, vmax, false)) : Fig.color(cfg.palette, p.index);
      const node = Fig.text(p.x, p.y, w.label, { size: p.size / fsL, anchor: 'middle', baseline: 'central', fill, font, weight, rotate: p.rotate ? -90 : 0 });
      node.setAttribute('data-word', w.label);
      node.appendChild(Fig.el('title', null, w.label + ': ' + fmtInt(w.value)));
      g.appendChild(node);
    });
    f.g.appendChild(g);
    svg.dataset.dropped = String(layout.dropped);
    return svg;
  },

  /* ---------- treemap (squarified): one rectangle per term, area ∝ frequency ----------
     o: { items: [{ label, value }] } (largest first) */
  treemapControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'colorBy', label: t('charts.colorBy'), type: 'select', options: [['palette', t('charts.colorByPalette')], ['value', t('charts.colorByValue')]] },
      { key: 'palette', label: t('charts.palette'), type: 'select', options: Fig.paletteOptions() },
      { key: 'colormap', label: t('charts.colormap'), type: 'select', options: Fig.colormapOptions() },
      { key: 'borderColor', label: t('charts.tileBorder'), type: 'color' },
      { key: 'showValues', label: t('charts.showCounts'), type: 'checkbox' },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
    ];
  },

  treemap(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const f = Fig.frame(svg, cfg, { margin: { left: 14, right: 14, bottom: 14 } });
    const items = o.items.filter(it => it.value > 0);
    const rects = Parsers.lib().squarify(items.map(it => it.value), f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
    const cmap = Fig.colormaps[cfg.colormap] || Fig.colormaps.viridis;
    const vmax = items.length ? items[0].value : 0;
    const fsL = Fig.fs('label');
    const g = Fig.g({ 'data-treemap': '1' });
    items.forEach((it, i) => {
      const r = rects[i];
      if (!(r.w > 0 && r.h > 0)) return;
      const fill = cfg.colorBy === 'value' ? cmap(0.1 + 0.8 * Charts.colorPosition(it.value, vmax, false)) : Fig.color(cfg.palette, i);
      const rect = Fig.el('rect', { x: r.x.toFixed(1), y: r.y.toFixed(1), width: r.w.toFixed(1), height: r.h.toFixed(1), fill, stroke: cfg.borderColor, 'stroke-width': 1.5, 'data-term': it.label });
      rect.appendChild(Fig.el('title', null, it.label + ': ' + fmtInt(it.value)));
      g.appendChild(rect);
      /* label inside the tile when it fits (smaller type for smaller tiles) */
      const label = Charts.truncate(it.label, cfg.maxLabel);
      const fg = Fig.onColor(fill);
      for (let size = Math.min(20, Math.max(8, Math.sqrt(r.w * r.h) / 7)); size >= 7.5; size -= 1) {
        const s = size * fsL;
        const tw = Fig.measure(label, s, font, 'bold'), vh = cfg.showValues ? s * 1.25 : 0;
        if (tw + 10 <= r.w && s * 1.3 + vh + 6 <= r.h) {
          const ty = r.y + 6 + s;
          g.appendChild(Fig.text(r.x + 6, ty, label, { size, fill: fg, font, weight: 'bold' }));
          if (cfg.showValues) g.appendChild(Fig.text(r.x + 6, ty + s * 1.25, fmtInt(it.value), { size: size * 0.85, fill: fg, font, opacity: 0.9 }));
          break;
        }
      }
    });
    f.g.appendChild(g);
    return svg;
  },

  /* ---------- trend topics: Q1–Q3 of the years of each term (segment) and its median (point, area ∝ frequency) ----------
     o: { rows: [{ label, q1, median, q3, freq }] (top to bottom), sizeLabel } */
  trendTopicsControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'lineColor', label: t('charts.segmentColor'), type: 'color' },
      { key: 'pointColor', label: t('charts.pointColor'), type: 'color' },
      { key: 'maxRadius', label: t('charts.maxRadius'), type: 'number', min: 4, max: 30, step: 1 },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
    ];
  },

  trendTopics(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis'), fsLeg = 11 * Fig.fs('legend');
    const labels = o.rows.map(r => Charts.truncate(r.label, cfg.maxLabel));
    const widest = Math.max(0, ...labels.map(l => Fig.measure(l, fsTick, font)));
    const margin = { left: Math.ceil(Math.min(W * 0.4, widest + 20)), right: 30, bottom: Math.ceil(28 * fsAxis + (cfg.xlab ? 26 * fsAxis : 0) + 40 * Fig.fs('legend')) };
    const f = Fig.frame(svg, cfg, { margin });
    const band = Fig.scaleBand(labels, f.y0, f.y1, 0);
    let yMin = Infinity, yMax = -Infinity, nMax = 0;
    o.rows.forEach(r => { if (r.q1 < yMin) yMin = r.q1; if (r.q3 > yMax) yMax = r.q3; if (r.freq > nMax) nMax = r.freq; });
    if (!o.rows.length) { yMin = 0; yMax = 1; }
    const y0 = Math.floor(yMin), y1 = Math.ceil(yMax);
    const x = Fig.scaleLinear(y0 - 0.6, y1 + 0.6, f.x0, f.x1);
    const rMax = Math.max(3, Math.min(band.step * 0.48, +cfg.maxRadius || 10));
    const radius = n => Math.max(2.5, rMax * Math.sqrt(n / (nMax || 1)));
    const grid = Fig.g();
    labels.forEach((l, i) => {
      const cy = band.center(i);
      grid.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: cy, y2: cy, stroke: f.t.grid === 'none' ? f.t.axis : f.t.grid, 'stroke-width': 0.6, opacity: f.t.grid === 'none' ? 0.25 : 1 }));
      grid.appendChild(Fig.text(f.x0 - 8, cy, l, { size: 11, anchor: 'end', baseline: 'central', fill: f.t.fg, font, role: 'tick' }));
    });
    f.g.appendChild(grid);
    const step = Charts.yearStep(y1 - y0 + 1, f.x1 - f.x0, fsTick);
    const gx = Fig.g();
    for (let yr = y0; yr <= y1; yr++) {
      if (step > 1 && yr % step !== 0) continue;
      gx.appendChild(Fig.el('line', { x1: x(yr), x2: x(yr), y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
      gx.appendChild(Fig.text(x(yr), f.y1 + 8 + fsTick, String(yr), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
    }
    gx.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
    const xlabY = f.y1 + 8 + fsTick + 12 + 13 * fsAxis;
    if (cfg.xlab) gx.appendChild(Fig.text((f.x0 + f.x1) / 2, xlabY, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gx);
    const gs = Fig.g({ 'data-series': 'segments' }), gp = Fig.g({ 'data-series': 'medians' });
    o.rows.forEach((r, i) => {
      const cy = band.center(i);
      gs.appendChild(Fig.el('line', { x1: x(r.q1).toFixed(1), x2: x(r.q3).toFixed(1), y1: cy, y2: cy, stroke: cfg.lineColor, 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
      const c = Fig.el('circle', { cx: x(r.median).toFixed(1), cy: cy.toFixed(1), r: radius(r.freq).toFixed(1), fill: cfg.pointColor, 'fill-opacity': 0.85, stroke: f.t.bg, 'stroke-width': 1 });
      c.appendChild(Fig.el('title', null, `${r.label} · Q1 ${Charts.fmtYear(r.q1)} · ${Charts.fmtYear(r.median)} · Q3 ${Charts.fmtYear(r.q3)} · ${o.sizeLabel}: ${fmtInt(r.freq)}`));
      gp.appendChild(c);
    });
    f.g.appendChild(gs); f.g.appendChild(gp);
    /* size legend */
    const ly = (cfg.xlab ? xlabY : f.y1 + 8 + fsTick) + 18 + fsLeg;
    const gl = Fig.g({ 'data-legend': '1' });
    gl.appendChild(Fig.text(f.x0, ly, o.sizeLabel, { size: 11, fill: f.t.fg, font, role: 'legend', weight: 'bold' }));
    let lx = f.x0 + Fig.measure(o.sizeLabel, fsLeg, font, 'bold') + 14;
    [...new Set([Math.max(1, Math.round(nMax / 4)), Math.round(nMax / 2), nMax])].filter(v => v >= 1).forEach(v => {
      const r = radius(v);
      gl.appendChild(Fig.el('circle', { cx: lx + r, cy: ly - fsLeg * 0.35, r, fill: 'none', stroke: f.t.muted, 'stroke-width': 1 }));
      gl.appendChild(Fig.text(lx + 2 * r + 4, ly, fmtInt(v), { size: 11, fill: f.t.fg, font, role: 'legend' }));
      lx += 2 * r + 12 + Fig.measure(fmtInt(v), fsLeg, font);
    });
    f.g.appendChild(gl);
    return svg;
  },

  /* ---------- network for publication: nodes coloured by community, size by a value, labels that repel ----------
     o: { nodes: [{ label, value, community }], edges: [[source, target, weight 0–1]], positions: [x0, y0 …],
          communities: [names, largest first] } */
  networkControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'palette', label: t('charts.palette'), type: 'select', options: Fig.paletteOptions() },
      { key: 'labelCount', label: t('charts.labelCount'), type: 'number', min: 0, max: 500, step: 1 },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
      { key: 'minRadius', label: t('charts.nodeMinRadius'), type: 'number', min: 1, max: 20, step: 0.5 },
      { key: 'maxRadius', label: t('charts.nodeMaxRadius'), type: 'number', min: 4, max: 60, step: 1 },
      { key: 'edgeOpacity', label: t('charts.edgeOpacity'), type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'edgeWidth', label: t('charts.edgeWidth'), type: 'number', min: 0.2, max: 10, step: 0.2 },
      { key: 'showLegend', label: t('charts.showLegend'), type: 'checkbox' },
      { key: 'legendMax', label: t('charts.legendMax'), type: 'number', min: 1, max: 30, step: 1 },
    ];
  },

  networkColor(cfg, community) { return Fig.color(cfg.palette || 'scimetrics', community); },

  network(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsLeg = 11 * Fig.fs('legend');
    const n = o.nodes.length;
    const legend = cfg.showLegend !== false && o.communities && o.communities.length > 0;
    const legendItems = legend ? o.communities.slice(0, Math.max(1, +cfg.legendMax || 8)).map((name, c) => ({ label: Charts.truncate(name, cfg.maxLabel), color: Charts.networkColor(cfg, c) })) : [];
    const legendW = legend ? Math.min(W * 0.35, Math.max(0, ...legendItems.map(it => Fig.measure(it.label, fsLeg, font))) + fsLeg * 2 + 30) : 0;
    const f = Fig.frame(svg, cfg, { margin: { left: 16, right: 16 + legendW, bottom: 16 } });
    const rMin = Math.max(0.5, +cfg.minRadius || 3), rMax = Math.max(rMin, +cfg.maxRadius || 16);
    /* fit the positions into the plot area, keeping proportions, with room for the largest node */
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = o.positions[2 * i], y = o.positions[2 * i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (!n) { x0 = y0 = -1; x1 = y1 = 1; }
    const pad = rMax + 4;
    const scale = Math.min((f.x1 - f.x0 - 2 * pad) / Math.max(x1 - x0, 1e-9), (f.y1 - f.y0 - 2 * pad) / Math.max(y1 - y0, 1e-9));
    const ox = (f.x0 + f.x1) / 2 - (x0 + x1) / 2 * scale, oy = (f.y0 + f.y1) / 2 - (y0 + y1) / 2 * scale;
    const X = i => ox + o.positions[2 * i] * scale, Y = i => oy + o.positions[2 * i + 1] * scale;
    let vmin = Infinity, vmax = -Infinity;
    for (const nd of o.nodes) { if (nd.value < vmin) vmin = nd.value; if (nd.value > vmax) vmax = nd.value; }
    const R = i => rMin + (rMax - rMin) * (vmax > vmin ? Math.sqrt((o.nodes[i].value - vmin) / (vmax - vmin)) : 0.5);
    const opacity = cfg.edgeOpacity == null ? 0.35 : +cfg.edgeOpacity, width = +cfg.edgeWidth || 1.5;
    const ge = Fig.g({ 'data-series': 'edges', 'stroke-linecap': 'round' });
    for (const e of o.edges) {
      const a = e[0], b = e[1], w = e[2];
      const same = o.nodes[a].community === o.nodes[b].community;
      ge.appendChild(Fig.el('line', { x1: X(a).toFixed(1), y1: Y(a).toFixed(1), x2: X(b).toFixed(1), y2: Y(b).toFixed(1),
        stroke: same ? Charts.networkColor(cfg, o.nodes[a].community) : f.t.muted, 'stroke-opacity': (opacity * (0.35 + 0.65 * w)).toFixed(3), 'stroke-width': (0.3 + width * w).toFixed(2) }));
    }
    f.g.appendChild(ge);
    const order = o.nodes.map((x, i) => i).sort((a, b) => o.nodes[b].value - o.nodes[a].value || a - b);
    const gn = Fig.g({ 'data-series': 'nodes' });
    for (let q = order.length - 1; q >= 0; q--) {
      const i = order[q];
      const c = Fig.el('circle', { cx: X(i).toFixed(1), cy: Y(i).toFixed(1), r: R(i).toFixed(1), fill: Charts.networkColor(cfg, o.nodes[i].community), stroke: f.t.bg, 'stroke-width': 0.8, 'data-node': o.nodes[i].label });
      c.appendChild(Fig.el('title', null, o.nodes[i].label));
      gn.appendChild(c);
    }
    f.g.appendChild(gn);
    const labelled = order.slice(0, Math.max(0, +cfg.labelCount || 0));
    const gl = Fig.g({ 'data-labels': '1' });
    Fig.repelLabels(gl, f, labelled.map(i => ({ x: X(i), y: Y(i), r: R(i), text: Charts.truncate(o.nodes[i].label, cfg.maxLabel), size: 10 })),
      { obstacles: order.map(i => ({ x: X(i), y: Y(i), r: R(i) })), maxDistance: 60, leaderMin: 12 });
    f.g.appendChild(gl);
    if (legend) {
      const lg = Fig.g({ 'data-legend': '1' });
      const lx = f.x1 + 22;
      lg.appendChild(Fig.text(lx, f.y0 + fsLeg, cfg.legendTitle || o.legendTitle || '', { size: 11, weight: 'bold', fill: f.t.fg, font, role: 'legend' }));
      legendItems.forEach((it, k) => {
        const yy = f.y0 + fsLeg * (2.9 + 1.7 * k);
        lg.appendChild(Fig.el('circle', { cx: lx + fsLeg * 0.5, cy: yy - fsLeg * 0.35, r: fsLeg * 0.45, fill: it.color }));
        lg.appendChild(Fig.text(lx + fsLeg * 1.4, yy, it.label, { size: 11, fill: f.t.fg, font, role: 'legend' }));
      });
      f.g.appendChild(lg);
    }
    return svg;
  },

  /* ---------- strategic diagram (thematic map): centrality × density, axes at the medians, four quadrants ----------
     o: { clusters: [{ x, y, size, label, quadrant }], medianX, medianY, quadrantLabels: { motor, niche, emerging, basic } } */
  QUADRANT_ORDER: ['motor', 'niche', 'emerging', 'basic'],
  quadrantColor(cfg, q) {
    const i = Charts.QUADRANT_ORDER.indexOf(q);
    return (cfg.quadrantColors && cfg.quadrantColors[i]) || ['#c8416a', '#1f9e8f', '#e39b2d', '#1d5bb0'][i];
  },

  thematicMapControls(o) {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'ylab', label: t('charts.ylab'), type: 'text' },
      { key: 'quadrantColors', label: t('charts.quadrantColors'), type: 'colors', labels: o.quadrants },
      { key: 'showQuadrants', label: t('charts.showQuadrants'), type: 'checkbox' },
      { key: 'maxRadius', label: t('charts.nodeMaxRadius'), type: 'number', min: 6, max: 80, step: 1 },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
    ];
  },

  /* one strategic diagram inside box = { x0, y0, x1, y1 }; used by the single map and the small multiples */
  drawThematicPanel(g, box, cfg, panel, o) {
    const t0 = o.t, font = o.font;
    const cl = panel.clusters;
    let xs = cl.map(c => c.x).concat(panel.medianX), ys = cl.map(c => c.y).concat(panel.medianY);
    let xa = Math.min(...xs), xb = Math.max(...xs), ya = Math.min(...ys), yb = Math.max(...ys);
    if (!(xb > xa)) { xa -= 1; xb += 1; }
    if (!(yb > ya)) { ya -= 1; yb += 1; }
    const px = (xb - xa) * 0.12, py = (yb - ya) * 0.12;
    const X = Fig.scaleLinear(xa - px, xb + px, box.x0, box.x1), Y = Fig.scaleLinear(ya - py, yb + py, box.y1, box.y0);
    const mx = X(panel.medianX), my = Y(panel.medianY);
    /* quadrants */
    const quads = [['niche', box.x0, box.y0, mx, my], ['motor', mx, box.y0, box.x1, my], ['emerging', box.x0, my, mx, box.y1], ['basic', mx, my, box.x1, box.y1]];
    const gq = Fig.g({ 'data-quadrants': '1' });
    quads.forEach(([q, a, b, c, d]) => gq.appendChild(Fig.el('rect', { x: a.toFixed(1), y: b.toFixed(1), width: Math.max(0, c - a).toFixed(1), height: Math.max(0, d - b).toFixed(1), fill: Fig.alpha(Charts.quadrantColor(cfg, q), 0.07), 'data-quadrant': q })));
    gq.appendChild(Fig.el('rect', { x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0, fill: 'none', stroke: t0.axis, 'stroke-width': 1 }));
    gq.appendChild(Fig.el('line', { x1: mx, x2: mx, y1: box.y0, y2: box.y1, stroke: t0.muted, 'stroke-width': 1, 'stroke-dasharray': '5 4' }));
    gq.appendChild(Fig.el('line', { x1: box.x0, x2: box.x1, y1: my, y2: my, stroke: t0.muted, 'stroke-width': 1, 'stroke-dasharray': '5 4' }));
    if (cfg.showQuadrants !== false && o.quadrantLabels) {
      const size = o.small ? 9 : 11, pad = 6;
      const ql = (q, x, y, anchor, base) => gq.appendChild(Fig.text(x, y, o.quadrantLabels[q], { size, anchor, baseline: base, fill: Fig.darken(Charts.quadrantColor(cfg, q), 0.15), font, weight: 'bold', role: 'label', opacity: 0.85 }));
      ql('niche', box.x0 + pad, box.y0 + pad, 'start', 'hanging');
      ql('motor', box.x1 - pad, box.y0 + pad, 'end', 'hanging');
      ql('emerging', box.x0 + pad, box.y1 - pad, 'start', 'auto');
      ql('basic', box.x1 - pad, box.y1 - pad, 'end', 'auto');
    }
    g.appendChild(gq);
    const rMax = Math.max(4, (+cfg.maxRadius || 34) * (o.small ? 0.55 : 1)), rMin = Math.max(3, rMax * 0.18);
    const sizeMax = o.sizeMax || Math.max(1, ...cl.map(c => c.size));
    const R = c => rMin + (rMax - rMin) * Math.sqrt(c.size / sizeMax);
    const gb = Fig.g({ 'data-series': 'themes' });
    cl.slice().sort((a, b) => b.size - a.size).forEach(c => {
      const circle = Fig.el('circle', { cx: X(c.x).toFixed(1), cy: Y(c.y).toFixed(1), r: R(c).toFixed(1), fill: Fig.alpha(Charts.quadrantColor(cfg, c.quadrant), 0.72), stroke: Charts.quadrantColor(cfg, c.quadrant), 'stroke-width': 1.2, 'data-quadrant': c.quadrant });
      circle.appendChild(Fig.el('title', null, c.title || c.label));
      gb.appendChild(circle);
    });
    g.appendChild(gb);
    const gl = Fig.g({ 'data-labels': '1' });
    const frame = { x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y1, t: t0, font, g: gl };
    Fig.repelLabels(gl, frame, cl.map(c => ({ x: X(c.x), y: Y(c.y), r: R(c), text: Charts.truncate(c.label, cfg.maxLabel), size: o.small ? 8.5 : 10.5, weight: 'bold' })),
      { obstacles: cl.map(c => ({ x: X(c.x), y: Y(c.y), r: R(c) })), maxDistance: o.small ? 50 : 90, leaderMin: rMax + 8 });
    g.appendChild(gl);
    return { X, Y };
  },

  thematicMap(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsAxis = Fig.fs('axis');
    const f = Fig.frame(svg, cfg, { margin: { left: 62 + (cfg.ylab ? 26 * fsAxis : 0), right: 20, bottom: 40 + (cfg.xlab ? 26 * fsAxis : 0) } });
    const sc = Charts.drawThematicPanel(f.g, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 }, cfg, o, { t: f.t, font, quadrantLabels: o.quadrantLabels });
    /* values on both axes */
    const fsTick = 11 * Fig.fs('tick'), gt = Fig.g();
    Fig.ticks(sc.X.domain[0], sc.X.domain[1], 6).forEach(v => { if (v < sc.X.domain[0] || v > sc.X.domain[1]) return; gt.appendChild(Fig.el('line', { x1: sc.X(v), x2: sc.X(v), y1: f.y1, y2: f.y1 + 4, stroke: f.t.axis })); gt.appendChild(Fig.text(sc.X(v), f.y1 + 6 + fsTick, fmtNum(v, 2), { size: 10, anchor: 'middle', fill: f.t.muted, font, role: 'tick' })); });
    Fig.ticks(sc.Y.domain[0], sc.Y.domain[1], 6).forEach(v => { if (v < sc.Y.domain[0] || v > sc.Y.domain[1]) return; gt.appendChild(Fig.el('line', { x1: f.x0 - 4, x2: f.x0, y1: sc.Y(v), y2: sc.Y(v), stroke: f.t.axis })); gt.appendChild(Fig.text(f.x0 - 6, sc.Y(v) + 4, fmtNum(v, 2), { size: 10, anchor: 'end', fill: f.t.muted, font, role: 'tick' })); });
    f.g.appendChild(gt);
    if (cfg.xlab) f.g.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 32 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    if (cfg.ylab) f.g.appendChild(Fig.text(f.x0 - 58, (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    return svg;
  },

  /* small multiples: one strategic diagram per period, the same bubble scale in all of them
     o: { panels: [{ title, clusters, medianX, medianY }], quadrantLabels } */
  thematicMaps(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const f = Fig.frame(svg, cfg, { margin: { left: 16, right: 16, bottom: 16 } });
    const n = Math.max(1, o.panels.length), cols = Math.min(n, +cfg.columns || (n <= 3 ? n : n === 4 ? 2 : 3)), rows = Math.ceil(n / cols);
    const gap = 18, head = 22 * Fig.fs('label');
    const cw = (f.x1 - f.x0 - gap * (cols - 1)) / cols, ch = (f.y1 - f.y0 - gap * (rows - 1)) / rows;
    const sizeMax = Math.max(1, ...o.panels.flatMap(p => p.clusters.map(c => c.size)));
    o.panels.forEach((p, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x0 = f.x0 + c * (cw + gap), y0 = f.y0 + r * (ch + gap);
      const g = Fig.g({ 'data-panel': i });
      g.appendChild(Fig.text(x0 + cw / 2, y0 + head * 0.7, p.title, { size: 12, anchor: 'middle', fill: f.t.fg, font, weight: 'bold', role: 'label' }));
      Charts.drawThematicPanel(g, { x0, y0: y0 + head, x1: x0 + cw, y1: y0 + ch }, cfg, p, { t: f.t, font, quadrantLabels: o.quadrantLabels, small: true, sizeMax });
      f.g.appendChild(g);
    });
    return svg;
  },

  /* ---------- Sankey diagram of the thematic evolution ----------
     o: { columns: [period labels], nodes: [{ col, label, value, quadrant, title }], links: [{ source, target, value (0–1), title }] } */
  sankeyControls(o) {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'quadrantColors', label: t('charts.quadrantColors'), type: 'colors', labels: o.quadrants },
      { key: 'linkOpacity', label: t('charts.edgeOpacity'), type: 'number', min: 0.05, max: 1, step: 0.05 },
      { key: 'nodeWidth', label: t('charts.nodeWidth'), type: 'number', min: 4, max: 40, step: 1 },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
    ];
  },

  sankeyLayout(o, box, nodeW) {
    const ncol = Math.max(1, o.columns.length);
    const byCol = Array.from({ length: ncol }, () => []);
    o.nodes.forEach((nd, i) => byCol[nd.col].push(i));
    const gap = Math.max(6, (box.y1 - box.y0) * 0.025);
    let scale = Infinity;
    byCol.forEach(list => {
      const sum = list.reduce((s, i) => s + o.nodes[i].value, 0);
      if (sum > 0) scale = Math.min(scale, (box.y1 - box.y0 - gap * Math.max(0, list.length - 1)) / sum);
    });
    if (!isFinite(scale)) scale = 1;
    const pos = o.nodes.map(nd => ({ x: ncol > 1 ? box.x0 + nd.col * (box.x1 - box.x0 - nodeW) / (ncol - 1) : (box.x0 + box.x1 - nodeW) / 2, y: 0, h: Math.max(2, nd.value * scale) }));
    const place = list => {
      const total = list.reduce((s, i) => s + pos[i].h, 0) + gap * Math.max(0, list.length - 1);
      let y = box.y0 + (box.y1 - box.y0 - total) / 2;
      list.forEach(i => { pos[i].y = y; y += pos[i].h + gap; });
    };
    const centre = i => pos[i].y + pos[i].h / 2;
    const bary = (list, other) => {
      const val = new Map();
      list.forEach(i => {
        let s = 0, w = 0;
        o.links.forEach(l => { const j = other === 'source' ? (l.target === i ? l.source : -1) : (l.source === i ? l.target : -1); if (j >= 0) { s += centre(j) * l.value; w += l.value; } });
        val.set(i, w > 0 ? s / w : Infinity);
      });
      /* nodes without links keep their size order after the linked ones */
      list.sort((a, b) => (val.get(a) - val.get(b)) || (o.nodes[b].value - o.nodes[a].value) || a - b);
    };
    byCol.forEach(list => list.sort((a, b) => o.nodes[b].value - o.nodes[a].value || a - b));
    byCol.forEach(place);
    for (let sweep = 0; sweep < 3; sweep++) {
      for (let c = 1; c < ncol; c++) { bary(byCol[c], 'source'); place(byCol[c]); }
      for (let c = ncol - 2; c >= 0; c--) { bary(byCol[c], 'target'); place(byCol[c]); }
    }
    /* link bands: width = value × smaller node height, stacked on each side in the order of the other end */
    const bands = o.links.map(l => ({ l, w: l.value * Math.min(pos[l.source].h, pos[l.target].h) }));
    const side = (node, key, otherKey) => {
      const list = bands.filter(b => b.l[key] === node).sort((a, b) => centre(a.l[otherKey]) - centre(b.l[otherKey]));
      const sum = list.reduce((s, b) => s + b.w, 0);
      const k = sum > pos[node].h ? pos[node].h / sum : 1;
      let y = pos[node].y + (pos[node].h - Math.min(sum, pos[node].h)) / 2;
      list.forEach(b => { b[key + 'Y'] = y; b[key + 'W'] = b.w * k; y += b.w * k; });
    };
    o.nodes.forEach((nd, i) => { side(i, 'source', 'target'); side(i, 'target', 'source'); });
    return { pos, bands };
  },

  sankey(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsL = 10.5 * Fig.fs('label');
    const nodeW = +cfg.nodeWidth || 14;
    const ncol = o.columns.length;
    const labelRoom = Math.min(W * 0.22, Math.max(60, ...o.nodes.map(nd => Fig.measure(Charts.truncate(nd.label, cfg.maxLabel), fsL, font))) + 10);
    const f = Fig.frame(svg, cfg, { margin: { left: 16, right: 16 + (ncol > 1 ? labelRoom : 0), top: 56 + 26 * Fig.fs('label'), bottom: 16 } });
    const box = { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 };
    const { pos, bands } = Charts.sankeyLayout(o, box, nodeW);
    const color = i => Charts.quadrantColor(cfg, o.nodes[i].quadrant);
    const colX = c => (ncol > 1 ? box.x0 + c * (box.x1 - box.x0 - nodeW) / (ncol - 1) : (box.x0 + box.x1 - nodeW) / 2);
    const gh = Fig.g({ 'data-columns': '1' });
    o.columns.forEach((label, c) => gh.appendChild(Fig.text(colX(c) + nodeW / 2, f.y0 - 12, label, { size: 12, anchor: c === 0 ? 'start' : c === ncol - 1 ? 'end' : 'middle', fill: f.t.fg, font, weight: 'bold', role: 'label' })));
    f.g.appendChild(gh);
    const gk = Fig.g({ 'data-series': 'links' });
    const opacity = cfg.linkOpacity == null ? 0.35 : +cfg.linkOpacity;
    bands.forEach(b => {
      const s = pos[b.l.source], tg = pos[b.l.target];
      const x0 = s.x + nodeW, x1 = tg.x, xm = (x0 + x1) / 2;
      const a0 = b.sourceY, a1 = b.sourceY + b.sourceW, c0 = b.targetY, c1 = b.targetY + b.targetW;
      const d = `M${x0.toFixed(1)} ${a0.toFixed(1)}C${xm.toFixed(1)} ${a0.toFixed(1)} ${xm.toFixed(1)} ${c0.toFixed(1)} ${x1.toFixed(1)} ${c0.toFixed(1)}L${x1.toFixed(1)} ${c1.toFixed(1)}C${xm.toFixed(1)} ${c1.toFixed(1)} ${xm.toFixed(1)} ${a1.toFixed(1)} ${x0.toFixed(1)} ${a1.toFixed(1)}Z`;
      const path = Fig.el('path', { d, fill: color(b.l.source), 'fill-opacity': opacity, stroke: 'none', 'data-link': b.l.source + '-' + b.l.target });
      if (b.l.title) path.appendChild(Fig.el('title', null, b.l.title));
      gk.appendChild(path);
    });
    f.g.appendChild(gk);
    const gn = Fig.g({ 'data-series': 'nodes' });
    o.nodes.forEach((nd, i) => {
      const p = pos[i];
      const r = Fig.el('rect', { x: p.x.toFixed(1), y: p.y.toFixed(1), width: nodeW, height: p.h.toFixed(1), fill: color(i), rx: 2, 'data-node': i });
      r.appendChild(Fig.el('title', null, nd.title || nd.label));
      gn.appendChild(r);
      const last = ncol > 1 && nd.col === ncol - 1;
      gn.appendChild(Fig.text(last ? p.x - 5 : p.x + nodeW + 5, p.y + p.h / 2, Charts.truncate(nd.label, cfg.maxLabel), { size: 10.5, anchor: last ? 'end' : 'start', baseline: 'central', fill: f.t.fg, font, role: 'label', halo: f.t.bg, haloWidth: 3 }));
    });
    f.g.appendChild(gn);
    return svg;
  },

  /* ---------- factorial map of words coloured by cluster ----------
     o: { points: [{ x, y, label, cluster }], clusterNames, legendTitle } */
  factorialMapControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'ylab', label: t('charts.ylab'), type: 'text' },
      { key: 'palette', label: t('charts.palette'), type: 'select', options: Fig.paletteOptions() },
      { key: 'labelCount', label: t('charts.labelCount'), type: 'number', min: 0, max: 500, step: 1 },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
      { key: 'showHulls', label: t('charts.showHulls'), type: 'checkbox' },
      { key: 'showLegend', label: t('charts.showLegend'), type: 'checkbox' },
    ];
  },

  convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  },

  factorialMap(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis'), fsLeg = 11 * Fig.fs('legend');
    const k = o.clusterNames.length;
    const legend = cfg.showLegend !== false && k > 0;
    const legendW = legend ? Math.min(W * 0.3, Math.max(...o.clusterNames.map(s => Fig.measure(s, fsLeg, font))) + fsLeg * 2 + 30) : 0;
    const f = Fig.frame(svg, cfg, { margin: { left: 40 + (cfg.ylab ? 26 * fsAxis : 0), right: 20 + legendW, bottom: 34 + (cfg.xlab ? 26 * fsAxis : 0) } });
    const xs = o.points.map(p => p.x).concat(0), ys = o.points.map(p => p.y).concat(0);
    let xa = Math.min(...xs), xb = Math.max(...xs), ya = Math.min(...ys), yb = Math.max(...ys);
    const padX = (xb - xa || 1) * 0.08, padY = (yb - ya || 1) * 0.08;
    xa -= padX; xb += padX; ya -= padY; yb += padY;
    /* the same unit on both axes, as factorial maps require */
    const unit = Math.min((f.x1 - f.x0) / (xb - xa), (f.y1 - f.y0) / (yb - ya));
    const cx = (f.x0 + f.x1) / 2 - unit * (xa + xb) / 2, cy = (f.y0 + f.y1) / 2 + unit * (ya + yb) / 2;
    const X = v => cx + unit * v, Y = v => cy - unit * v;
    const ga = Fig.g();
    const ticks = (a, b) => Fig.ticks(a, b, 6);
    ga.appendChild(Fig.el('rect', { x: f.x0, y: f.y0, width: f.x1 - f.x0, height: f.y1 - f.y0, fill: 'none', stroke: f.t.axis, 'stroke-width': 1 }));
    const vx0 = (f.x0 - cx) / unit, vx1 = (f.x1 - cx) / unit, vy1 = (cy - f.y0) / unit, vy0 = (cy - f.y1) / unit;
    ticks(vx0, vx1).forEach(v => { ga.appendChild(Fig.el('line', { x1: X(v), x2: X(v), y1: f.y1, y2: f.y1 + 4, stroke: f.t.axis })); ga.appendChild(Fig.text(X(v), f.y1 + 6 + fsTick, fmtNum(v, 2), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' })); });
    ticks(vy0, vy1).forEach(v => { ga.appendChild(Fig.el('line', { x1: f.x0 - 4, x2: f.x0, y1: Y(v), y2: Y(v), stroke: f.t.axis })); ga.appendChild(Fig.text(f.x0 - 7, Y(v) + 4, fmtNum(v, 2), { size: 11, anchor: 'end', fill: f.t.fg, font, role: 'tick' })); });
    if (X(0) > f.x0 && X(0) < f.x1) ga.appendChild(Fig.el('line', { x1: X(0), x2: X(0), y1: f.y0, y2: f.y1, stroke: f.t.muted, 'stroke-dasharray': '4 4' }));
    if (Y(0) > f.y0 && Y(0) < f.y1) ga.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: Y(0), y2: Y(0), stroke: f.t.muted, 'stroke-dasharray': '4 4' }));
    if (cfg.xlab) ga.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 6 + fsTick + 10 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    if (cfg.ylab) ga.appendChild(Fig.text(16 * fsAxis, (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(ga);
    const color = c => Fig.color(cfg.palette || 'scimetrics', c);
    if (cfg.showHulls !== false) {
      const gh = Fig.g({ 'data-hulls': '1' });
      for (let c = 0; c < k; c++) {
        const hull = Charts.convexHull(o.points.filter(p => p.cluster === c).map(p => [X(p.x), Y(p.y)]));
        if (hull.length >= 3) gh.appendChild(Fig.el('polygon', { points: hull.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' '), fill: Fig.alpha(color(c), 0.1), stroke: color(c), 'stroke-width': 1, 'stroke-opacity': 0.6 }));
      }
      f.g.appendChild(gh);
    }
    const gp = Fig.g({ 'data-series': 'words' });
    o.points.forEach(p => {
      const c = Fig.el('circle', { cx: X(p.x).toFixed(1), cy: Y(p.y).toFixed(1), r: 3.6, fill: color(p.cluster), stroke: f.t.bg, 'stroke-width': 0.8, 'data-word': p.label });
      c.appendChild(Fig.el('title', null, p.label));
      gp.appendChild(c);
    });
    f.g.appendChild(gp);
    const gl = Fig.g({ 'data-labels': '1' });
    Fig.repelLabels(gl, f, o.points.slice(0, Math.max(0, cfg.labelCount == null ? 60 : +cfg.labelCount)).map(p => ({ x: X(p.x), y: Y(p.y), r: 3.6, text: Charts.truncate(p.label, cfg.maxLabel), fill: Fig.darken(color(p.cluster), 0.25), size: 9.5 })),
      { obstacles: o.points.map(p => ({ x: X(p.x), y: Y(p.y), r: 3.6 })), maxDistance: 60 });
    f.g.appendChild(gl);
    if (legend) {
      const lg = Fig.g({ 'data-legend': '1' });
      const lx = f.x1 + 20;
      if (o.legendTitle) lg.appendChild(Fig.text(lx, f.y0 + fsLeg, o.legendTitle, { size: 11, weight: 'bold', fill: f.t.fg, font, role: 'legend' }));
      o.clusterNames.forEach((name, c) => {
        const yy = f.y0 + fsLeg * (2.9 + 1.7 * c);
        lg.appendChild(Fig.el('circle', { cx: lx + fsLeg * 0.5, cy: yy - fsLeg * 0.35, r: fsLeg * 0.45, fill: color(c) }));
        lg.appendChild(Fig.text(lx + fsLeg * 1.4, yy, name, { size: 11, fill: f.t.fg, font, role: 'legend' }));
      });
      f.g.appendChild(lg);
    }
    return svg;
  },

  /* ---------- dendrogram (Ward), leaves on the left, heights to the right ----------
     o: { merges: [[a, b, height, size]], order, labels, leafClusters, n } */
  dendrogramControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'palette', label: t('charts.palette'), type: 'select', options: Fig.paletteOptions() },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
    ];
  },

  dendrogram(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis');
    const n = o.n;
    const labels = o.labels.map(s => Charts.truncate(s, cfg.maxLabel));
    const widest = Math.max(0, ...labels.map(s => Fig.measure(s, 10 * Fig.fs('tick'), font)));
    const f = Fig.frame(svg, cfg, { margin: { left: Math.min(W * 0.35, widest + 16), right: 24, bottom: 30 + (cfg.xlab ? 26 * fsAxis : 0) } });
    const maxH = Math.max(1e-12, ...o.merges.map(m => m[2]));
    const X = h => f.x0 + (h / maxH) * (f.x1 - f.x0);
    const step = (f.y1 - f.y0) / Math.max(1, n);
    const y = new Map(), x = new Map(), cl = new Map();
    o.order.forEach((leaf, i) => { y.set(leaf, f.y0 + step * (i + 0.5)); x.set(leaf, 0); cl.set(leaf, o.leafClusters[leaf]); });
    const color = c => (c >= 0 ? Fig.color(cfg.palette || 'scimetrics', c) : f.t.muted);
    const gt = Fig.g({ 'data-series': 'tree', fill: 'none' });
    o.merges.forEach((m, k) => {
      const id = n + k, [a, b, h] = m;
      const ca = cl.get(a), cb = cl.get(b);
      const c = ca === cb ? ca : -1;
      const ya = y.get(a), yb = y.get(b);
      const col = color(c);
      gt.appendChild(Fig.el('path', { d: `M${X(x.get(a)).toFixed(1)} ${ya.toFixed(1)}H${X(h).toFixed(1)}V${yb.toFixed(1)}H${X(x.get(b)).toFixed(1)}`, stroke: col, 'stroke-width': 1.3 }));
      y.set(id, (ya + yb) / 2); x.set(id, h); cl.set(id, c);
    });
    f.g.appendChild(gt);
    const gl = Fig.g();
    o.order.forEach(leaf => gl.appendChild(Fig.text(f.x0 - 6, y.get(leaf), labels[leaf], { size: 10, anchor: 'end', baseline: 'central', fill: color(o.leafClusters[leaf]), font, role: 'tick' })));
    Fig.ticks(0, maxH, 6).forEach(v => {
      gl.appendChild(Fig.el('line', { x1: X(v), x2: X(v), y1: f.y1, y2: f.y1 + 4, stroke: f.t.axis }));
      gl.appendChild(Fig.text(X(v), f.y1 + 6 + fsTick, fmtNum(v, 2), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
    });
    gl.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis }));
    if (cfg.xlab) gl.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 6 + fsTick + 10 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(gl);
    return svg;
  },

  /* ---------- historiograph: documents placed by publication year and the direct citations among them ----------
     o: { years: [year of each column], nodes: [{ label, layer, y (0–1 inside the column), value (local citations),
          family (−1 = without drawn citations), title }], links: [[from (cited), to (citing)]], selected: node | −1 }
     Arrows run from the cited (older) document to the citing one. */
  historiographControls() {
    return [
      { key: 'title', label: t('charts.title'), type: 'text' },
      { key: 'subtitle', label: t('charts.subtitle'), type: 'text' },
      { key: 'xlab', label: t('charts.xlab'), type: 'text' },
      { key: 'palette', label: t('charts.palette'), type: 'select', options: Fig.paletteOptions() },
      { key: 'showLabels', label: t('charts.showLabels'), type: 'checkbox' },
      { key: 'maxLabel', label: t('charts.maxLabel'), type: 'number', min: 10, max: 200, step: 5 },
      { key: 'minRadius', label: t('charts.nodeMinRadius'), type: 'number', min: 1, max: 20, step: 0.5 },
      { key: 'maxRadius', label: t('charts.nodeMaxRadius'), type: 'number', min: 4, max: 60, step: 1 },
      { key: 'edgeOpacity', label: t('charts.edgeOpacity'), type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'edgeWidth', label: t('charts.edgeWidth'), type: 'number', min: 0.2, max: 10, step: 0.2 },
    ];
  },

  historiograph(cfg, o) {
    const W = +cfg.width, H = +cfg.height;
    const svg = Fig.svg(W, H, cfg.theme);
    const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
    const fsTick = 11 * Fig.fs('tick'), fsAxis = Fig.fs('axis');
    const f = Fig.frame(svg, cfg, { margin: { left: 20, right: 20, bottom: 30 + fsTick + (cfg.xlab ? 26 * fsAxis : 0) } });
    const nL = Math.max(1, o.years.length);
    const colW = (f.x1 - f.x0) / nL;
    const rMin = Math.max(0.5, +cfg.minRadius || 4), rMax = Math.max(rMin, +cfg.maxRadius || 14);
    const X = l => f.x0 + colW * (l + 0.5);
    const top = f.y0 + rMax + 4, bottom = f.y1 - rMax - 16;
    const Y = y => top + (bottom - top) * y;
    const vmax = Math.max(1, ...o.nodes.map(nd => nd.value));
    const R = nd => rMin + (rMax - rMin) * Math.sqrt(nd.value / vmax);
    const color = nd => (nd.family >= 0 ? Fig.color(cfg.palette || 'scimetrics', nd.family) : f.t.muted);
    /* one column per year: faint guides and the year below */
    const ga = Fig.g({ 'data-axis': 'years' });
    const widest = Math.max(1, ...o.years.map(yv => Fig.measure(String(yv), fsTick, font))) + 8;
    const every = Math.max(1, Math.ceil(widest / colW));
    o.years.forEach((year, l) => {
      if (cfg.grid !== false) ga.appendChild(Fig.el('line', { x1: X(l), x2: X(l), y1: f.y0, y2: f.y1, stroke: f.t.grid === 'none' ? f.t.axis : f.t.grid, 'stroke-width': 1, 'stroke-dasharray': '2 4', opacity: 0.8 }));
      if (l % every === 0) ga.appendChild(Fig.text(X(l), f.y1 + 8 + fsTick, String(year), { size: 11, anchor: 'middle', fill: f.t.fg, font, role: 'tick' }));
    });
    ga.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis }));
    if (cfg.xlab) ga.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 8 + fsTick + 12 + 13 * fsAxis, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
    f.g.appendChild(ga);
    const arrowColor = f.t.muted;
    const defs = Fig.el('defs');
    const marker = Fig.el('marker', { id: 'hgArrow', viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 7, markerHeight: 7, markerUnits: 'userSpaceOnUse', orient: 'auto' });
    marker.appendChild(Fig.el('path', { d: 'M0 0L10 5L0 10z', fill: arrowColor }));
    defs.appendChild(marker);
    svg.insertBefore(defs, svg.firstChild);
    const opacity = cfg.edgeOpacity == null ? 0.55 : +cfg.edgeOpacity, width = +cfg.edgeWidth || 1.2;
    const gl = Fig.g({ 'data-series': 'links', fill: 'none' });
    /* points along the arrows, so the labels keep off them */
    const onLinks = [];
    for (const [a, b] of o.links) {
      const na = o.nodes[a], nb = o.nodes[b];
      const xa = X(na.layer), ya = Y(na.y), xb = X(nb.layer), yb = Y(nb.y);
      let bz;
      if (na.layer === nb.layer) {
        /* same year: an arc on the right */
        const bend = Math.min(colW * 0.45, 46);
        bz = [xa + R(na), ya, xa + bend, ya, xb + bend, yb, xb + R(nb) + 1, yb];
      } else if (nb.layer - na.layer === 1) {
        const x0 = xa + R(na), x1 = xb - R(nb) - 1, mid = (x0 + x1) / 2;
        bz = [x0, ya, mid, ya, mid, yb, x1, yb];
      } else {
        /* across several years: an arc that bends away from the middle, so it does not run over the documents in between */
        const x0 = xa + R(na), x1 = xb - R(nb) - 1;
        const up = (na.y + nb.y) / 2 < 0.5 || ((na.y + nb.y) / 2 === 0.5 && (a + b) % 2 === 0);
        let bend = Math.min((bottom - top) * 0.3, 10 + 9 * (nb.layer - na.layer)) * (up ? -1 : 1);
        /* the curve stays inside the plot (its extreme is about 3/4 of the control offset) */
        bend = up ? Math.max(bend, (f.y0 - Math.min(ya, yb)) / 0.75) : Math.min(bend, (f.y1 - 14 - Math.max(ya, yb)) / 0.75);
        const c0 = x0 + (x1 - x0) * 0.3, c1 = x1 - (x1 - x0) * 0.3;
        bz = [x0, ya, c0, ya + bend, c1, yb + bend, x1, yb];
      }
      const p = bz.map(v => v.toFixed(1));
      const d = `M${p[0]} ${p[1]}C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}`;
      gl.appendChild(Fig.el('path', { d, stroke: arrowColor, 'stroke-opacity': opacity, 'stroke-width': width, 'marker-end': 'url(#hgArrow)', 'data-from': a, 'data-to': b }));
      const steps = Math.max(2, Math.ceil(Math.hypot(bz[6] - bz[0], bz[7] - bz[1]) / 8));
      for (let s = 1; s < steps; s++) {
        const t = s / steps, u = 1 - t;
        const k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
        onLinks.push({ x: k0 * bz[0] + k1 * bz[2] + k2 * bz[4] + k3 * bz[6], y: k0 * bz[1] + k1 * bz[3] + k2 * bz[5] + k3 * bz[7], r: 1.5 });
      }
    }
    f.g.appendChild(gl);
    const gn = Fig.g({ 'data-series': 'docs' });
    o.nodes.forEach((nd, i) => {
      const c = Fig.el('circle', { cx: X(nd.layer).toFixed(1), cy: Y(nd.y).toFixed(1), r: R(nd).toFixed(1), fill: color(nd), stroke: f.t.bg, 'stroke-width': 1.2, 'data-doc': i, class: i === o.selected ? 'hg-selected' : null });
      c.appendChild(Fig.el('title', null, nd.title || nd.label));
      gn.appendChild(c);
    });
    f.g.appendChild(gn);
    if (cfg.showLabels !== false) {
      const gt = Fig.g({ 'data-labels': '1' });
      Fig.repelLabels(gt, f, o.nodes.map(nd => ({ x: X(nd.layer), y: Y(nd.y), r: R(nd), text: Charts.truncate(nd.label, cfg.maxLabel), size: 9.5 })),
        { obstacles: o.nodes.map(nd => ({ x: X(nd.layer), y: Y(nd.y), r: R(nd) })).concat(onLinks), maxObstacles: 20000, maxDistance: 50, leaderMin: 8, leaderFromEdge: true });
      f.g.appendChild(gt);
    }
    return svg;
  },
};

window.Charts = Charts;
