/* Core utilities, tabular export, background workers. */
'use strict';

describe('core · utilities', () => {
  it('esc escapes the HTML metacharacters', () => {
    eq(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
    eq(esc(null), '');
  });
  it('fold removes accents and case', () => {
    eq(fold('Árbol ÑANDÚ Çedilla'), 'arbol nandu cedilla');
  });
  it('slug makes safe file names', () => {
    eq(slug('Producción anual (2020–2024).csv'), 'Produccion_anual_2020_2024');
    eq(slug(''), 'scimetricspro');
  });
  it('csvEscape quotes separators, quotes and line breaks', () => {
    eq(csvEscape('plain'), 'plain');
    eq(csvEscape('a,b'), '"a,b"');
    eq(csvEscape('say "hi"'), '"say ""hi"""');
    eq(csvEscape('two\nlines'), '"two\nlines"');
    eq(csvEscape('a;b', ';'), '"a;b"');
  });
  it('event bus: on, emit, off, and a failing handler does not stop the others', () => {
    const seen = [];
    const origError = console.error; console.error = () => {};
    const h1 = on('unit-test', d => seen.push('a' + d));
    on('unit-test', () => { throw new Error('boom'); });
    const h3 = on('unit-test', d => seen.push('c' + d));
    emit('unit-test', 1);
    console.error = origError;
    deepEq(seen, ['a1', 'c1']);
    off('unit-test', h1); off('unit-test', h3);
    eq(Bus.count('unit-test'), 1);
  });
  it('number formats follow the interface language', () => {
    const prev = I18N.lang;
    I18N.lang = 'es';
    eq(fmtInt(1234567), '1,234,567');
    eq(fmtNum(0.12345, 2), '0.12');
    eq(fmtPct(0.4567), '45.7 %');
    I18N.lang = 'en';
    eq(fmtInt(1234567), '1,234,567');
    eq(fmtNum(null), '—');
    I18N.lang = prev;
  });
  it('Prefs survives unavailable storage and uses the test prefix', () => {
    eq(APP.storagePrefix, 'scimetricspro-test:');
    Prefs.set('unit', { a: 1 });
    deepEq(Prefs.get('unit', null), { a: 1 });
    Prefs.del('unit');
    eq(Prefs.get('unit', 'fallback'), 'fallback');
  });
});

describe('export · tables', () => {
  const columns = [{ key: 'name', label: 'Name' }, { key: 'n', label: 'Docs' }, { key: 'kw', label: 'Keywords' }];
  const rows = [{ name: 'Beta, A.', n: 12, kw: ['maize', 'landraces'] }, { name: 'Álvarez "J"', n: NaN, kw: null }];
  it('matrix keeps numbers as numbers, joins lists and blanks invalid values', () => {
    deepEq(Exporter.matrix(columns, rows), [['Name', 'Docs', 'Keywords'], ['Beta, A.', 12, 'maize; landraces'], ['Álvarez "J"', '', '']]);
  });
  it('CSV text has a byte-order mark, CRLF rows and correct quoting', () => {
    const txt = Exporter.csvText(columns, rows);
    eq(txt.charCodeAt(0), 0xFEFF);
    eq(txt.slice(1), 'Name,Docs,Keywords\r\n"Beta, A.",12,maize; landraces\r\n"Álvarez ""J""",,');
  });
  it('sheet names are valid and unique', () => {
    const used = new Set();
    eq(Exporter.sheetName('Tabla: autores [2024]/*?', used), 'Tabla  autores  2024');
    eq(Exporter.sheetName('Datos', used), 'Datos');
    eq(Exporter.sheetName('datos', used), 'datos (2)');
    eq(Exporter.sheetName('x'.repeat(40), used).length, 31);
  });
  it('the spreadsheet writer is loaded and round-trips a table', () => {
    ok(window.XLSX, 'vendor/xlsx.full.min.js not loaded');
    const ws = XLSX.utils.aoa_to_sheet(Exporter.matrix(columns, rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'T');
    const back = XLSX.read(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), { type: 'array' });
    const aoa = XLSX.utils.sheet_to_json(back.Sheets.T, { header: 1, defval: '' });
    deepEq(aoa, [['Name', 'Docs', 'Keywords'], ['Beta, A.', 12, 'maize; landraces'], ['Álvarez "J"', '', '']]);
  });
});

describe('core · background workers (Blob worker, works from file://)', () => {
  function sumTo(n) { let s = 0; for (let i = 1; i <= n; i++) s += i; return s; }
  const opts = {
    fns: [sumTo],
    consts: { OFFSET: 10 },
    main: function (payload, progress) {
      const out = [];
      for (let k = 0; k < payload.length; k++) { out.push(sumTo(payload[k]) + OFFSET); progress((k + 1) / payload.length, 'step ' + (k + 1)); }
      return out;
    },
    payload: [10, 100, 1000],
  };
  it('runs pure helpers and constants in a worker and reports progress', async () => {
    ok(Work.supported, 'Worker not supported');
    const seen = [];
    const res = await Work.run(Object.assign({}, opts, { onProgress: (f, m) => seen.push([f, m]) }));
    deepEq(res, [65, 5060, 500510]);
    ok(seen.length >= 1, 'no progress messages');
    eq(seen[seen.length - 1][0], 1);
  });
  it('object form of helpers and async main', async () => {
    const res = await Work.run({ fns: { twice: x => 2 * x }, main: async p => twice(p), payload: 21 });
    eq(res, 42);
  });
  it('the inline fallback gives the same result', async () => {
    deepEq(await Work.runInline(opts), [65, 5060, 500510]);
  });
  it('errors thrown inside the worker reject with their message', async () => {
    const e = await rejects(Work.run({ main: () => { throw new Error('bad input'); }, payload: null }));
    eq(e.message, 'bad input');
  });
  it('an abort signal terminates the worker', async () => {
    const ctrl = new AbortController();
    const p = Work.run({ main: () => { const t = Date.now(); while (Date.now() - t < 3000) { /* busy */ } return 1; }, payload: null, signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 50);
    const e = await rejects(p);
    eq(e.name, 'AbortError');
  });
});
