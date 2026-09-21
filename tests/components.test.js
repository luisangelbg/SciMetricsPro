/* Common components: EmptyState, MetricCard, HelpPopover, ProgressOverlay, DataTable, ChartCard. */
'use strict';

function withLang(lang, fn) {
  const prev = I18N.lang; I18N.lang = lang;
  try { return fn(); } finally { I18N.lang = prev; }
}
const playground = () => { let p = el('playground'); if (!p) { p = mk('div', { id: 'playground' }); document.body.appendChild(p); } return p; };

describe('components · EmptyState', () => {
  it('noData() says "Primero importa datos" with an enabled import button and a disabled example button', () => withLang('es', () => {
    const n = EmptyState.noData();
    eq(n.querySelector('.empty-title').textContent, 'Primero importa datos');
    const [imp, ex] = n.querySelectorAll('button');
    eq(imp.textContent.trim(), 'Importar mis datos');
    eq(imp.disabled, false);
    eq(ex.disabled, true);
    ok(n.querySelector('.empty-note').textContent.includes('Disponible pronto'));
  }));
  it('custom actions call their handlers', () => {
    let clicked = 0;
    const n = EmptyState.create({ title: 'x', actions: [{ label: 'go', onClick: () => clicked++ }] });
    n.querySelector('button').click();
    eq(clicked, 1);
  });
});

describe('components · MetricCard', () => {
  it('formats the value, updates it and shows help when given', () => withLang('es', () => {
    const c = MetricCard.create({ label: 'Documentos', value: 12345, sub: '1990–2024', icon: 'doc', tone: 'teal', help: { title: 'Documentos', text: 'n' } });
    eq(c.querySelector('.metric-value').textContent, '12,345');
    eq(c.querySelector('.metric-sub').textContent, '1990–2024');
    ok(c.querySelector('.help-btn'), 'help button');
    ok(c.classList.contains('tone-teal'));
    c.update({ value: 0.5, sub: '' });
    eq(c.querySelector('.metric-value').textContent, '0.5');
    eq(c.querySelector('.metric-sub').hidden, true);
    c.update({ value: null });
    eq(c.querySelector('.metric-value').textContent, '—');
  }));
});

describe('components · HelpPopover', () => {
  const spec = {
    title: 'Índice h', text: 'El mayor h…',
    formula: '<var>h</var> = max { <var>i</var> : <var>c</var><sub><var>i</var></sub> ≥ <var>i</var> }',
    where: [['<var>c</var><sub><var>i</var></sub>', 'citas del i-ésimo documento']],
    interpretation: 'Mayor es mejor.', refs: ['Hirsch, J. E. (2005). An index to quantify an individual’s scientific research output. PNAS, 102(46), 16569–16572.'],
  };
  it('opens with formula, symbols and reference; closes with Escape and returns focus', () => withLang('es', () => {
    const host = playground();
    const b = HelpPopover.button(spec);
    host.appendChild(b);
    b.click();
    ok(HelpPopover.isOpen(), 'not open');
    const pop = document.querySelector('.help-pop');
    ok(pop.querySelector('.formula var'), 'formula markup');
    eq(pop.querySelector('.help-where dd').textContent, 'citas del i-ésimo documento');
    eq(pop.querySelectorAll('.help-refs li').length, 1);
    eq(pop.querySelectorAll('.help-label')[3].textContent, 'Referencia');
    eq(b.getAttribute('aria-expanded'), 'true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ok(!HelpPopover.isOpen(), 'still open after Escape');
    eq(b.getAttribute('aria-expanded'), 'false');
    eq(document.activeElement, b);
    b.remove();
  }));
  it('a click outside closes it; a second click on the button toggles it', () => {
    const host = playground();
    const b = HelpPopover.button(spec);
    host.appendChild(b);
    b.click(); ok(HelpPopover.isOpen());
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    ok(!HelpPopover.isOpen(), 'outside click');
    b.click(); ok(HelpPopover.isOpen());
    b.click(); ok(!HelpPopover.isOpen(), 'toggle');
    b.remove();
  });
});

describe('components · ProgressOverlay', () => {
  it('shows determinate and indeterminate progress and closes', () => withLang('es', () => {
    const p = ProgressOverlay.show({ title: 'Leyendo archivos', message: 'inicio' });
    const bar = document.querySelector('.progress-overlay [role=progressbar]');
    ok(bar.classList.contains('indeterminate'));
    p.update(0.424, 'archivo 2 de 5');
    eq(bar.getAttribute('aria-valuenow'), '42');
    eq(document.querySelector('.progress-pct').textContent, '42 %');
    eq(document.querySelector('.progress-msg').textContent, 'archivo 2 de 5');
    p.update(null);
    ok(bar.classList.contains('indeterminate'));
    p.close();
    ok(!document.querySelector('.progress-overlay'));
  }));
  it('run() drives a worker, and Cancel stops it', async () => {
    const res = await ProgressOverlay.run({ title: 'x', main: (n, progress) => { progress(1, 'ok'); return n * 2; }, payload: 4 });
    eq(res, 8);
    ok(!ProgressOverlay.isOpen());
    const p = ProgressOverlay.run({ title: 'y', main: () => { const t = Date.now(); while (Date.now() - t < 3000) { /* busy */ } return 1; }, payload: 0 });
    await tick(60);
    document.querySelector('.progress-cancel').click();
    eq(await p, undefined);
    ok(!ProgressOverlay.isOpen());
  });
});

describe('components · DataTable', () => {
  const names = ['Zea mays', 'Árbol', 'arbol', 'Sechium edule', 'Beta', 'álamo', 'Cucurbita', 'Phaseolus'];
  const rows = [];
  for (let i = 0; i < 57; i++) rows.push({ name: names[i % names.length] + ' ' + (i + 1), docs: (i * 37) % 23, cites: i === 5 ? null : i * 3.5, kw: ['k' + (i % 4)] });
  const columns = [
    { key: 'name', label: 'Nombre' },
    { key: 'docs', label: 'Documentos', type: 'int' },
    { key: 'cites', label: 'Citas', type: 'num' },
    { key: 'kw', label: 'Palabras clave' },
  ];

  it('paginates 57 rows in pages of 25', () => withLang('es', () => {
    const dt = DataTable.create({ columns, rows, pageSize: 25 });
    eq(dt.el.querySelectorAll('tbody tr').length, 25);
    eq(dt.el.querySelector('.dt-count').textContent, '1–25 de 57');
    eq(dt.el.querySelector('.dt-page').textContent, 'Página 1 de 3');
    dt.page(Infinity);
    eq(dt.el.querySelectorAll('tbody tr').length, 7);
    eq(dt.el.querySelector('.dt-count').textContent, '51–57 de 57');
    ok(dt.el.querySelector('.dt-nav button[aria-label="Página siguiente"]').disabled);
  }));
  it('numeric columns sort descending on first click; blanks always last', () => {
    const dt = DataTable.create({ columns, rows });
    const th = dt.el.querySelectorAll('thead th')[2];
    th.querySelector('button').click();
    eq(th.getAttribute('aria-sort'), 'descending');
    const v = dt.view().map(r => r.cites);
    eq(v[0], 56 * 3.5);
    eq(v[v.length - 1], null);
    th.querySelector('button').click();
    eq(th.getAttribute('aria-sort'), 'ascending');
    const w = dt.view().map(r => r.cites);
    eq(w[0], 0);
    eq(w[w.length - 1], null);
  });
  it('text sorts ignore case and accents; ties keep their original order', () => {
    const dt = DataTable.create({ columns, rows: rows.slice(0, 8) });
    dt.sortBy('name', 'asc');
    deepEq(dt.view().map(r => r.name), ['álamo 6', 'Árbol 2', 'arbol 3', 'Beta 5', 'Cucurbita 7', 'Phaseolus 8', 'Sechium edule 4', 'Zea mays 1']);
  });
  it('search is accent-insensitive, multi-word, and updates the count', () => withLang('es', () => {
    const dt = DataTable.create({ columns, rows });
    dt.search('ARBOL');
    eq(dt.view().length, 14);
    ok(dt.view().every(r => fold(r.name).includes('arbol')));
    eq(dt.el.querySelector('.dt-count').textContent, '1–14 de 14 (de 57 filas)');
    dt.search('arbol k1');
    ok(dt.view().every(r => r.kw[0] === 'k1'));
    dt.search('no-existe');
    ok(!dt.el.querySelector('.dt-empty').hidden);
    eq(dt.el.querySelector('.dt-empty').textContent, 'Ninguna fila coincide con la búsqueda.');
    ok(dt.el.querySelector('.dt-export button').disabled);
  }));
  it('exports the searched and sorted view (all pages), with raw values', () => {
    const dt = DataTable.create({ columns, rows, pageSize: 10 });
    dt.search('sechium').sortBy('docs', 'desc');
    const m = dt.exportMatrix();
    deepEq(m[0], ['Nombre', 'Documentos', 'Citas', 'Palabras clave']);
    eq(m.length, 1 + 7);
    ok(m.slice(1).every((r, i, a) => i === 0 || a[i - 1][1] >= r[1]), 'sorted');
    eq(typeof m[1][1], 'number');
  });
  it('the rows-per-page menu always shows the size in use', () => {
    const dt = DataTable.create({ columns, rows, pageSize: 15 });
    const sel = dt.el.querySelector('.dt-size select');
    deepEq([...sel.options].map(o => o.value), ['10', '15', '25', '50', '100']);
    eq(sel.value, '15');
    eq(dt.el.querySelectorAll('tbody tr').length, 15);
    const std = DataTable.create({ columns, rows, pageSize: 25 });
    deepEq([...std.el.querySelector('.dt-size select').options].map(o => o.value), ['10', '25', '50', '100']);
  });
  it('an empty table says so', () => withLang('es', () => {
    const dt = DataTable.create({ columns, rows: [] });
    eq(dt.el.querySelector('.dt-empty').textContent, 'La tabla no tiene filas.');
    ok(dt.el.querySelector('.dt-scroll').hidden);
  }));
});

describe('components · ChartCard and figure export', () => {
  const data = { columns: [{ key: 'year', label: 'Año' }, { key: 'n', label: 'Documentos' }], rows: [{ year: 2020, n: 4 }, { year: 2021, n: 9 }, { year: 2022, n: 6 }] };
  const render = cfg => {
    const s = Fig.svg(cfg.width, cfg.height, cfg.theme);
    data.rows.forEach((r, i) => s.appendChild(Fig.el('rect', { x: 60 + i * 120, y: 400 - r.n * 30, width: 80, height: r.n * 30, fill: Fig.color('scimetrics', 0) })));
    s.appendChild(Fig.text(cfg.width / 2, 40, 'Producción anual', { size: 18, anchor: 'middle', role: 'title' }));
    return s;
  };
  it('mounts a figure with title, help and export buttons, and exposes its data', () => withLang('es', () => {
    const cc = ChartCard.mount(playground(), { id: 'figTest', title: 'Producción anual', help: { title: 'x', text: 'y' }, render, data, width: 520, height: 420 });
    ok(cc.el.querySelector('.chart-body svg'), 'svg');
    ok(cc.el.querySelector('.chart-title .help-btn'), 'help');
    eq([...cc.el.querySelectorAll('.chart-actions button')].filter(b => !b.disabled).length, 4, 'PNG, SVG, PDF and data');
    deepEq(cc.dataMatrix(), [['Año', 'Documentos'], [2020, 4], [2021, 9], [2022, 6]]);
    ok(cc.el.querySelector('.fig-editor summary').textContent.includes('Editar figura'), 'editor translated');
    ok(Fig.registry.figTest, 'registered');
    eq([...I18N.missing].filter(k => k.includes('phrase')).length, 0);
    cc.el.remove();
  }));
  it('with no rows it shows a message and disables exports', () => withLang('es', () => {
    const cc = ChartCard.create({ title: 'Vacía', render, data: { columns: data.columns, rows: [] } });
    eq(cc.el.querySelector('.chart-empty').textContent, 'No hay datos para dibujar esta figura.');
    ok([...cc.el.querySelectorAll('.chart-actions button')].every(b => b.disabled));
    eq(cc.fig, null);
  }));
  it('PNG export at 300 dpi writes the resolution into the file (pHYs = 11811 px/m)', async () => {
    const svg = render({ width: 300, height: 200, theme: 'light' });
    svg.dataset.w = 300; svg.dataset.h = 200;
    const blob = await Fig.toRaster(svg, { format: 'png', scale: 4, dpi: 300 });
    const b = new Uint8Array(await blob.arrayBuffer());
    deepEq([...b.slice(1, 4)].map(c => String.fromCharCode(c)).join(''), 'PNG');
    const w = (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0;
    eq(w, 1200);
    let ppm = null;
    for (let i = 8; i < b.length - 12; i++) {
      if (b[i] === 0x70 && b[i + 1] === 0x48 && b[i + 2] === 0x59 && b[i + 3] === 0x73) { ppm = (b[i + 4] << 24 | b[i + 5] << 16 | b[i + 6] << 8 | b[i + 7]) >>> 0; break; }
    }
    eq(ppm, 11811);
  });
});
