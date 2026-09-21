/* Export of results: ZIP and spreadsheet writers read back, print sizes of the figures (PNG width in pixels and its dpi, SVG
   in cm, PDF page), the vector PDF (cross-reference table, fonts, text and colours), greyscale, the network files (GraphML,
   GEXF, .net and CSV), the clean set as CSV and BibTeX read back with the app's own reader, the network export buttons and
   the export module (every module, ordered names, index, helps and texts). */
'use strict';

const exBytes = async blob => new Uint8Array(await blob.arrayBuffer());
const exU32 = (b, i) => (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
const exLatin = b => { let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return s; };
const exUtf8 = b => new TextDecoder().decode(b);
function exPng(b) {
  let ppm = null;
  for (let i = 8; i < b.length - 12; i++) if (b[i] === 0x70 && b[i + 1] === 0x48 && b[i + 2] === 0x59 && b[i + 3] === 0x73) { ppm = exU32(b, i + 4); break; }
  return { png: exLatin(b.subarray(1, 4)) === 'PNG', width: exU32(b, 16), height: exU32(b, 20), ppm };
}
/* a PDF read without the writer: objects found through the cross-reference table, the page size and the content stream */
async function exPdf(bytes) {
  const s = exLatin(bytes);
  const sx = +/startxref\s+(\d+)\s+%%EOF\s*$/.exec(s)[1];
  const head = /^xref\s+0\s+(\d+)\s+/.exec(s.slice(sx));
  const count = +head[1];
  const rows = s.slice(sx + head[0].length).match(/\d{10} \d{5} [nf] /g).slice(0, count);
  const offsetsOk = rows.slice(1).every((row, k) => s.startsWith((k + 1) + ' 0 obj', +row.slice(0, 10)));
  const mb = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(s);
  const sm = /\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/.exec(s);
  const raw = bytes.subarray(sm.index + sm[0].length, sm.index + sm[0].length + +sm[1]);
  const inflated = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  return { text: s, header: s.startsWith('%PDF-1.4'), objects: count - 1, offsetsOk, width: +mb[1], height: +mb[2], content: exLatin(inflated) };
}
function exCsv(text) {
  const P = Parsers.lib();
  return P.parseDelimited(P.stripBom(text), ',', () => {}).filter(r => r.some(v => String(v).trim() !== ''));
}
function exColours(svg) {
  const out = [];
  [svg, ...svg.querySelectorAll('*')].forEach(n => ['fill', 'stroke'].forEach(a => {
    const v = n.getAttribute(a);
    if (!v || v === 'none' || /^url\(/.test(v)) return;
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v);
    out.push(m ? [+m[1], +m[2], +m[3]] : parseColor(v));
  }));
  return out;
}

describe('export · files', () => {
  it('ZIP: CRC-32, UTF-8 names and entries read back byte by byte', async () => {
    eq(Zip.crc32(new TextEncoder().encode('123456789')), 0xCBF43926, 'check value of CRC-32');
    const blob = Zip.buildSync([{ name: 'figuras/01_año.txt', data: 'hola' }, { name: 'b.bin', data: new Uint8Array([0, 1, 2, 255]) }]);
    const b = await exBytes(blob);
    eq(exLatin(b.subarray(0, 4)), 'PK' + String.fromCharCode(3, 4));
    eq(b[7] & 0x08, 0x08, 'flag 11: names in UTF-8');
    const entries = Zip.read(b);
    deepEq(entries.map(e => e.name), ['figuras/01_año.txt', 'b.bin']);
    eq(exUtf8(entries[0].data), 'hola');
    deepEq([...entries[1].data], [0, 1, 2, 255]);
    ok(entries.every(e => e.crc === Zip.crc32(e.data)), 'CRC of each entry');
    const again = await Zip.build([{ name: 'x.txt', data: new Blob(['abc']) }]);
    eq(exUtf8(Zip.read(await exBytes(again))[0].data), 'abc', 'blobs are read before writing');
  });

  it('spreadsheet: formatted header (bold, fill, border), frozen first row, filters, numbers as numbers; read back by an independent reader', async () => {
    const columns = [{ key: 'name', label: 'Fuente' }, { key: 'n', label: 'Documentos' }, { key: 'oa', label: 'Acceso abierto' }];
    const rows = [{ name: 'Revista A & <B>', n: 12, oa: true }, { name: ' con espacio', n: 3.5, oa: false }, { name: 'Sin datos', n: null, oa: null }];
    const blob = Exporter.xlsxBlob([{ name: 'Fuentes: [top] ¿?', columns, rows }, { name: 'Fuentes: [top] ¿?', columns: [{ key: 'x', label: 'X' }], rows: [] }]);
    eq(blob.type, XlsxWriter.MIME);
    const bytes = await exBytes(blob);
    const parts = Zip.read(bytes);
    const part = name => exUtf8(parts.find(p => p.name === name).data);
    ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']
      .forEach(n => ok(parts.some(p => p.name === n), n));
    const xml = s => { const d = new DOMParser().parseFromString(s, 'application/xml'); ok(!d.getElementsByTagName('parsererror').length, 'well-formed XML'); return d; };
    const styles = xml(part('xl/styles.xml'));
    const xf = styles.getElementsByTagName('cellXfs')[0].getElementsByTagName('xf')[1];
    deepEq(['fontId', 'fillId', 'borderId'].map(a => xf.getAttribute(a)), ['1', '2', '1']);
    ok(styles.getElementsByTagName('font')[1].getElementsByTagName('b').length === 1, 'bold header');
    eq(styles.getElementsByTagName('fill')[2].getElementsByTagName('fgColor')[0].getAttribute('rgb'), 'FFDCE6F2');
    eq(styles.getElementsByTagName('border')[1].getElementsByTagName('bottom')[0].getAttribute('style'), 'medium');
    const sheet = xml(part('xl/worksheets/sheet1.xml'));
    const cells = [...sheet.getElementsByTagName('row')[0].getElementsByTagName('c')];
    eq(cells.length, 3);
    ok(cells.every(c => c.getAttribute('s') === '1'), 'every header cell styled');
    ok([...sheet.getElementsByTagName('row')].slice(1).every(r => [...r.getElementsByTagName('c')].every(c => !c.hasAttribute('s'))), 'body cells plain');
    eq(sheet.getElementsByTagName('pane')[0].getAttribute('state'), 'frozen');
    eq(sheet.getElementsByTagName('autoFilter')[0].getAttribute('ref'), 'A1:C4');
    ok(!part('xl/worksheets/sheet2.xml').includes('autoFilter') && !part('xl/worksheets/sheet2.xml').includes('frozen'), 'a sheet with only its header');
    ok(part('xl/workbook.xml').includes('_xlnm._FilterDatabase'), 'filter range defined');
    const wb = XLSX.read(bytes, { type: 'array' });
    eq(wb.SheetNames.length, 2);
    ok(!/[[\]:*?/\\]/.test(wb.SheetNames.join('')), 'no forbidden characters in sheet names');
    eq(wb.SheetNames[1], wb.SheetNames[0] + ' (2)', 'names made different');
    const back = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).filter(r => r.length);
    deepEq(back.slice(0, 3), [['Fuente', 'Documentos', 'Acceso abierto'], ['Revista A & <B>', 12, true], [' con espacio', 3.5, false]]);
    eq(back[3][0], 'Sin datos');
    eq(wb.Sheets[wb.SheetNames[0]].B2.t, 'n', 'numbers stay numbers');
  });

  it('network files: GraphML and GEXF parse as XML with labels, communities, colours, positions and metrics; .net and CSV lists', () => {
    const net = {
      id: 'cn', title: 'Red & prueba', metrics: [{ key: 'degree', label: 'Grado' }, { key: 'pagerank', label: 'PageRank' }],
      nodes: [
        { label: 'maíz', community: 0, communityName: 'maíz', value: 3, x: 10, y: -5, color: '#1d5bb0', metrics: { degree: 2, pagerank: 0.4 } },
        { label: 'A & <B> "c"', community: 0, communityName: 'maíz', value: 2, x: 30, y: 15, color: '#e39b2d', metrics: { degree: 1, pagerank: 0.3 } },
        { label: 'bees', community: 1, communityName: 'bees', value: 1, x: -10, y: 5, color: '#1f9e8f', metrics: { degree: 1, pagerank: 0.3 } },
      ],
      edges: [{ source: 0, target: 1, count: 3, weight: 0.5 }, { source: 0, target: 2, count: 1, weight: 0.125 }],
    };
    const labels = { label: 'Término', community: 'N.º', communityName: 'Comunidad', source: 'Origen', target: 'Destino', sourceLabel: 'Origen', targetLabel: 'Destino', count: 'Coocurrencias', weight: 'Peso', nodesFile: 'nodos', edgesFile: 'aristas' };
    const files = GraphExport.files(net, ['graphml', 'gexf', 'net', 'csv'], labels);
    deepEq(files.map(f => f.suffix + '.' + f.ext), ['.graphml', '.gexf', '.net', '_nodos.csv', '_aristas.csv']);
    const doc = s => { const d = new DOMParser().parseFromString(s, 'application/xml'); ok(!d.getElementsByTagName('parsererror').length, 'well-formed XML'); return d; };
    const g = doc(files[0].data);
    eq(g.documentElement.namespaceURI, 'http://graphml.graphdrawing.org/xmlns');
    eq(g.getElementsByTagName('graph')[0].getAttribute('edgedefault'), 'undirected');
    const keys = {};
    [...g.getElementsByTagName('key')].forEach(k => { keys[k.getAttribute('id')] = k.getAttribute('attr.type'); });
    deepEq([keys.label, keys.community, keys.size, keys.x, keys.weight, keys.count, keys.m0], ['string', 'int', 'double', 'double', 'double', 'int', 'double']);
    const nodes = [...g.getElementsByTagName('node')];
    const data = (n, key) => [...n.getElementsByTagName('data')].find(d => d.getAttribute('key') === key).textContent;
    deepEq(nodes.map(n => data(n, 'label')), ['maíz', 'A & <B> "c"', 'bees']);
    deepEq(nodes.map(n => +data(n, 'community')), [1, 1, 2]);
    deepEq(['r', 'g', 'b'].map(k => +data(nodes[0], k)), [29, 91, 176]);
    deepEq([+data(nodes[1], 'x'), +data(nodes[1], 'y'), +data(nodes[1], 'm1')], [30, 15, 0.3]);
    const edges = [...g.getElementsByTagName('edge')];
    deepEq(edges.map(e => [e.getAttribute('source'), e.getAttribute('target'), +data(e, 'weight'), +data(e, 'count')]), [['n0', 'n1', 0.5, 3], ['n0', 'n2', 0.125, 1]]);
    const x = doc(files[1].data);
    const VIZ = 'http://www.gexf.net/1.2draft/viz';
    eq(x.documentElement.getAttribute('version'), '1.2');
    deepEq([...x.getElementsByTagName('node')].map(n => n.getAttribute('label')), ['maíz', 'A & <B> "c"', 'bees']);
    deepEq([...x.getElementsByTagName('edge')].map(e => [e.getAttribute('source'), e.getAttribute('target'), +e.getAttribute('weight')]), [['0', '1', 0.5], ['0', '2', 0.125]]);
    const col = x.getElementsByTagNameNS(VIZ, 'color')[2];
    deepEq(['r', 'g', 'b'].map(a => +col.getAttribute(a)), [31, 158, 143]);
    eq(+x.getElementsByTagNameNS(VIZ, 'position')[1].getAttribute('x'), 30);
    ok(x.getElementsByTagName('description')[0].textContent === 'Red & prueba', 'title');
    /* .net: positions scaled to 0–1 keeping proportions (span 40), CRLF lines */
    deepEq(files[2].data.split('\r\n'), ['*Vertices 3', '1 "maíz" 0.5 0', '2 "A & <B> \'c\'" 1 0.5', '3 "bees" 0 0.25', '*Edges', '1 2 0.5', '1 3 0.125', '']);
    const nodesCsv = exCsv(files[3].data), edgesCsv = exCsv(files[4].data);
    deepEq(nodesCsv[0], ['id', 'Término', 'N.º', 'Comunidad', 'x', 'y', 'Grado', 'PageRank']);
    deepEq(nodesCsv[2], ['2', 'A & <B> "c"', '1', 'maíz', '30', '15', '1', '0.3']);
    deepEq(edgesCsv, [['Origen', 'Destino', 'Origen', 'Destino', 'Coocurrencias', 'Peso'], ['1', '2', 'maíz', 'A & <B> "c"', '3', '0.5'], ['1', '3', 'maíz', 'bees', '1', '0.125']]);
  });

  it('clean set: LaTeX escapes, BibTeX keys with a, b… and entries read back by the BibTeX reader; CSV with every field', () => {
    const P = Parsers.lib();
    eq(RecordExport.tex('50% & $5 #1 a_b {x} ~ ^ \\cmd'), '50\\% \\& \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}cmd');
    const rec = o => { const r = Object.assign(P.newRecord(), o); r.authors = o.authors.map(a => P.person(a)); return P.finish(r); };
    const records = [
      rec({ title: 'Growth & yield at 50% shade: cost $12, trial #1 of first_test', authors: ['Cadena-Iñiguez, J.', 'Ruiz, M. A.'], year: 2020, sourceTitle: 'Revista de Horticultura', volume: '12', issue: '3', pages: '101-110', doi: '10.5555/ex.1', docTypeRaw: 'Article', timesCited: 5, authorKeywords: ['shade', 'yield'] }),
      rec({ title: 'Growth of chayote in two seasons', authors: ['Cadena-Iñiguez, J.'], year: 2020, sourceTitle: 'Revista de Horticultura', doi: '10.5555/ex.2', docTypeRaw: 'Article', timesCited: 0 }),
      rec({ title: 'Seed storage protocols', authors: ['Nava, I.'], year: 2018, sourceTitle: 'Actas del Congreso de Semillas', pages: '5-9', docTypeRaw: 'Conference Paper' }),
    ];
    const bib = RecordExport.bibtex(records);
    const heads = [...bib.matchAll(/^@(\w+)\{([^,]+),$/gm)].map(m => [m[1], m[2]]);
    deepEq(heads, [['article', 'cadenainiguez2020growth'], ['article', 'cadenainiguez2020growtha'], ['inproceedings', 'nava2018seed']]);
    ok(bib.includes('pages = {101--110}') && bib.includes('booktitle = {Actas del Congreso de Semillas}') && bib.includes('note = {Times cited: 5}'), 'pages, book title and citations');
    bib.split(/\n\n(?=@)/).forEach((entry, i) => {
      let depth = 0;
      for (let k = 0; k < entry.length; k++) { if (entry[k - 1] === '\\') continue; if (entry[k] === '{') depth++; else if (entry[k] === '}') depth--; ok(depth >= 0, 'braces #' + i); }
      eq(depth, 0, 'balanced braces #' + i);
    });
    const back = P.parseBibtex(bib, { tick() {} }).records;
    eq(back.length, 3);
    deepEq(back.map(r => r.title), records.map(r => r.title));
    deepEq(back.map(r => r.authors.map(a => a.last)), [['Cadena-Iñiguez', 'Ruiz'], ['Cadena-Iñiguez'], ['Nava']]);
    deepEq(back.map(r => [r.year, r.doi, r.pages, r.sourceTitle]), records.map(r => [r.year, r.doi, r.pages, r.sourceTitle]));
    const table = RecordExport.csvTable(records, key => t('export.fields.' + key));
    eq(table.columns.length, RecordExport.CSV_FIELDS.length);
    const rows = exCsv(Exporter.csvText(table.columns, table.rows));
    eq(rows.length, 4);
    const col = key => rows[0].indexOf(t('export.fields.' + key));
    eq(rows[1][col('title')], records[0].title);
    eq(rows[1][col('authorKeywords')], 'shade; yield');
    eq(rows[1][col('timesCited')], '5');
    eq(rows[3][col('docType')], 'conference');
  });

  it('BibTeX: a name with commas or the word "and" in its parts stays one author with two parts (an affiliation read as an author)', () => {
    const P = Parsers.lib();
    const r = Object.assign(P.newRecord(), { title: 'Economic evaluation of nutritional management', year: 2016, sourceTitle: 'Revista', docTypeRaw: 'Article' });
    r.authors = ['Miyake, Rodrigo Takashi', 'Agency for Agribusiness Technology, Scientific Researcher, Presidente Prudente, Brazil', 'Soil and Water Unit, Research Station', 'Narita, Nobuyoshi'].map(a => P.person(a));
    const bib = RecordExport.bibtex([P.finish(r)]);
    const field = /^ {2}author = \{(.*)\},$/m.exec(bib)[1];
    /* split as BibTeX does: " and " and commas only outside braces */
    const split = (s, re) => { const out = []; let depth = 0, cur = ''; for (let k = 0; k < s.length; k++) { const ch = s[k]; if (ch === '{') depth++; if (ch === '}') depth--; if (!depth && re.test(s.slice(k))) { const m = re.exec(s.slice(k)); out.push(cur); cur = ''; k += m[0].length - 1; continue; } cur += ch; } out.push(cur); return out; };
    const names = split(field, /^\s+and\s+/i);
    eq(names.length, 4, field);
    ok(names.every(n => split(n, /^,/).length <= 2), 'at most one comma outside braces in each name: ' + names.join(' | '));
    eq(split(names[0], /^,/)[0], 'Miyake');
  });
});

describe('export · figures at print size', () => {
  const data = { columns: [{ key: 'year', label: 'Año' }, { key: 'n', label: 'Documentos' }], rows: [{ year: 2020, n: 4 }, { year: 2021, n: 9 }] };
  const render = cfg => {
    const s = Fig.svg(cfg.width, cfg.height, cfg.theme);
    s.appendChild(Fig.el('rect', { x: 40, y: 80, width: cfg.width * 0.4, height: cfg.height * 0.5, fill: '#1d5bb0' }));
    s.appendChild(Fig.el('circle', { cx: cfg.width * 0.75, cy: cfg.height * 0.6, r: 60, fill: '#e39b2d', stroke: '#c8416a', 'stroke-width': 6 }));
    s.appendChild(Fig.text(cfg.width / 2, 40, 'Producción anual', { size: 18, anchor: 'middle', role: 'title', weight: 'bold' }));
    s.appendChild(Fig.text(40, cfg.height - 30, 'β = 2', { size: 11, role: 'tick' }));
    return s;
  };
  const mount = () => ChartCard.mount(playground(), { id: 'exFigTest', title: 'Producción anual', render, data, width: 900, height: 560 });
  const saved = {};
  const keep = () => { saved.p = Prefs.get('figexport', null); Prefs.del('figexport'); };
  const restore = () => { if (saved.p) Prefs.set('figexport', saved.p); else Prefs.del('figexport'); };

  it('layout width for the chosen width and base text; limits of the custom width', () => {
    deepEq([Fig.layoutWidth(17, 8), Fig.layoutWidth(8.5, 8), Fig.layoutWidth(8.5, 10), Fig.layoutWidth(8.5, 6), Fig.layoutWidth(5, 10), Fig.layoutWidth(60, 5)], [663, 331, 265, 442, 240, 2400]);
    deepEq([Fig.widthCm({ size: '17' }), Fig.widthCm({ size: '8.5' }), Fig.widthCm({ size: 'screen' }), Fig.widthCm({ size: 'custom', customCm: 1 }), Fig.widthCm({ size: 'custom', customCm: 99 }), Fig.widthCm({ size: 'custom', customCm: 12.4 })],
      [17, 8.5, null, 2, 60, 12.4]);
    deepEq(Fig.EXPORT_DEFAULTS, { size: '17', customCm: 12, textPt: 8, grayscale: false, background: '#ffffff', dpi: 300 }, 'two columns, 8 pt, white background, 300 dpi');
  });

  it('criterion: a PNG measures the chosen width (pixels ÷ dpi) and carries its resolution; SVG in cm and PDF page of the same size', async () => {
    keep();
    const cc = mount();
    try {
      const f = cc.fig;
      const r17 = f.renderPrint({ size: '17', textPt: 8 });
      near(r17.textPt, 8, 0.02, 'base text prints at 8 pt');
      eq(r17.svg.getAttribute('width'), '17.00cm');
      near(parseFloat(r17.svg.getAttribute('height')), 17 * 560 / 900, 0.02, 'height keeps the proportions');
      const cases = [[{ size: '17', dpi: 300 }, 2008, 11811, 17], [{ size: '8.5', dpi: 300 }, 1004, 11811, 8.5], [{ size: 'custom', customCm: 12, dpi: 600 }, 2835, 23622, 12]];
      for (const [p, px, ppm, cm] of cases) {
        const info = exPng(await exBytes(await f.printBlob('png', Object.assign({ textPt: 8 }, p))));
        ok(info.png, 'PNG');
        deepEq([info.width, info.ppm], [px, ppm], JSON.stringify(p));
        near(info.width / (info.ppm * 0.01), cm, 0.01, 'printed width in cm');
        /* the height keeps the proportions of the screen down to a layout 540 units wide, and stops shrinking there */
        const L = Fig.layoutWidth(cm, 8);
        near(info.height / info.width, Math.round(560 * Math.max(L, Fig.PRINT_HEIGHT_BASE) / 900) / L, 0.01, 'proportions');
      }
      const svgText = await (await f.printBlob('svg', { size: '8.5' })).text();
      const svgDoc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      ok(!svgDoc.querySelector('parsererror'), 'SVG parses');
      eq(svgDoc.documentElement.getAttribute('width'), '8.50cm');
      const pdfBlob = await f.printBlob('pdf', { size: '17' });
      eq(pdfBlob.type, 'application/pdf');
      const pdf = await exPdf(await exBytes(pdfBlob));
      ok(pdf.header && pdf.offsetsOk, 'header and every object where the cross-reference table says');
      near(pdf.width, 17 / 2.54 * 72, 0.01, 'page 17 cm wide');
      near(pdf.height / pdf.width, 560 / 900, 0.01);
      ok(pdf.content.includes('(Producci\\363n anual) Tj'), 'text as text, WinAnsi ó');
      ok(/\/BaseFont \/Helvetica-Bold \/Encoding \/WinAnsiEncoding/.test(pdf.text) && /\/BaseFont \/Symbol/.test(pdf.text), 'standard fonts; β from the Symbol font');
      ok(/0\.11\d* 0\.35\d* 0\.69\d* rg/.test(pdf.content), 'fill colour of the bar');
      ok(/\/Title <FEFF0050/.test(pdf.text), 'document title');
      const screen = f.renderPrint({ size: 'screen' });
      eq(screen.width, +cc.fig.svg.dataset.w, 'size on screen keeps the drawing');
    } finally { cc.el.remove(); restore(); }
  });

  it('greyscale: every colour becomes the grey of its luminance in the SVG, the PNG pixels and the PDF', async () => {
    keep();
    const cc = mount();
    try {
      const f = cc.fig;
      const r = f.renderPrint({ size: '8.5', grayscale: true });
      const colours = exColours(r.svg);
      ok(colours.length >= 4 && colours.every(c => c && c[0] === c[1] && c[1] === c[2]), 'SVG colours are greys');
      const g = Math.round(0.2126 * 29 + 0.7152 * 91 + 0.0722 * 176);
      ok(colours.some(c => c[0] === g), 'blue #1d5bb0 → grey ' + g);
      const png = await f.printBlob('png', { size: '8.5', grayscale: true });
      const bmp = await createImageBitmap(png);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      let worst = 0;
      for (let i = 0; i < px.length; i += 4) worst = Math.max(worst, Math.abs(px[i] - px[i + 1]), Math.abs(px[i + 1] - px[i + 2]));
      ok(worst <= 2, 'PNG pixels grey (largest channel difference ' + worst + ')');
      const pdf = await exPdf(await exBytes(await f.printBlob('pdf', { size: '8.5', grayscale: true })));
      const ops = [...pdf.content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (rg|RG)/g)];
      ok(ops.length >= 2 && ops.every(m => m[1] === m[2] && m[2] === m[3]), 'PDF colours are greys');
      const colour = await exPdf(await exBytes(await f.printBlob('pdf', { size: '8.5', grayscale: false })));
      ok([...colour.content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (rg|RG)/g)].some(m => m[1] !== m[2]), 'colour by default');
    } finally { cc.el.remove(); restore(); }
  });

  it('the PDF button of every figure saves the figure at the width chosen in the export options', async () => {
    keep();
    Fig.setExportPrefs({ size: '8.5' });
    const cc = mount();
    const got = [];
    const savedDl = window.download;
    window.download = (blob, name) => got.push({ blob, name });
    try {
      cc.el.querySelectorAll('.chart-actions button')[2].click();
      for (let i = 0; i < 150 && !got.length; i++) await tick(20);
    } finally { window.download = savedDl; cc.el.remove(); restore(); }
    eq(got.length, 1);
    eq(got[0].name, 'Produccion_anual.pdf');
    near((await exPdf(await exBytes(got[0].blob))).width, 8.5 / 2.54 * 72, 0.01);
  });

  /* horizontal bars with long names, a long title and a legend of long items below */
  const longNames = ['Revista Brasileira de Engenharia Agrícola e Ambiental', 'Journal of the Science of Food and Agriculture', 'Maize', 'Bees'];
  const renderLong = cfg => {
    const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
    const C = Fig.bandPlot(svg, Object.assign({}, cfg, { flip: true, xlab: '', ylab: 'Documentos' }), longNames, [0, 40], { legendBottom: true });
    longNames.forEach((l, i) => C.f.g.appendChild(C.bar(i, 10 + 8 * i, { fill: '#1d5bb0' })));
    Fig.legend(C.f, longNames.map((l, i) => ({ label: l, color: Fig.color('scimetrics', i) })), cfg, { pos: 'bottom' });
    return svg;
  };
  const mountLong = extra => ChartCard.mount(playground(), Object.assign({ id: 'exFigLong', title: 'Producción de las revistas más productivas del conjunto', render: cfg => renderLong(Object.assign({}, cfg, { title: 'Producción de las revistas más productivas del conjunto' })), data, width: 900, height: 560 }, extra || {}));

  it('criterion: one column prints the base text at the chosen size; a long title and a long legend go on more lines and long names are cut', async () => {
    keep();
    const cc = mountLong();
    try {
      const f = cc.fig;
      for (const pt of [8, 10]) {
        const r = f.renderPrint({ size: '8.5', textPt: pt });
        eq(r.width, Fig.layoutWidth(8.5, pt), 'the drawing keeps the layout width at ' + pt + ' pt');
        near(r.textPt, pt, 0.02, 'base text at ' + pt + ' pt');
        const texts = [...r.svg.querySelectorAll('text')];
        const title = texts.filter(tx => tx.getAttribute('font-weight') === 'bold' && +tx.getAttribute('font-size') === 17);
        ok(title.length >= 2, 'the title on ' + title.length + ' lines');
        const legend = texts.filter(tx => longNames.includes(tx.textContent) && tx.getAttribute('text-anchor') === 'start');
        ok(new Set(legend.map(tx => tx.getAttribute('y'))).size >= 2, 'the legend on more than one row');
        const cut = texts.filter(tx => tx.getAttribute('text-anchor') === 'end' && /…$/.test(tx.textContent));
        ok(cut.length >= 1 && cut.every(tx => longNames.some(l => l.startsWith(tx.textContent.slice(0, -1)))), 'long names cut with an ellipsis');
        const ticks = texts.filter(tx => tx.getAttribute('text-anchor') === 'middle' && /^\d+$/.test(tx.textContent))
          .map(tx => ({ x: +tx.getAttribute('x'), w: Fig.measure(tx.textContent, +tx.getAttribute('font-size'), tx.getAttribute('font-family')) })).sort((a, b) => a.x - b.x);
        ok(ticks.length >= 2 && ticks.every((tk, k) => !k || tk.x - ticks[k - 1].x >= (tk.w + ticks[k - 1].w) / 2 + 4), 'the numbers of the axis do not touch: ' + ticks.map(tk => tk.x.toFixed(0)).join(' '));
      }
      const wide = f.renderPrint({ size: '17', textPt: 8 });
      eq([...wide.svg.querySelectorAll('text')].filter(tx => tx.getAttribute('font-weight') === 'bold' && +tx.getAttribute('font-size') === 17).length, 1, 'one line at two columns');
      const r = f.renderPrint({ size: '8.5', textPt: 8 });
      ok(r.heightCm > 8.5 * 0.5, 'the plot is not flattened: ' + r.heightCm.toFixed(2) + ' cm high');
    } finally { cc.el.remove(); restore(); }
  });

  it('size on screen: the PNG measures the drawing at 96 units per inch, like its SVG and PDF', async () => {
    keep();
    const cc = mount();
    try {
      const f = cc.fig;
      const w = +f.svg.dataset.w;
      const info = exPng(await exBytes(await f.printBlob('png', { size: 'screen', dpi: 300 })));
      deepEq([info.width, info.ppm], [Math.round(w / 96 * 300), 11811]);
      const pdf = await exPdf(await exBytes(await f.printBlob('pdf', { size: 'screen' })));
      near(info.width / 300 * 72, pdf.width, 0.5, 'the same width in points as the PDF');
    } finally { cc.el.remove(); restore(); }
  });

  it('a figure with a narrowest layout keeps it at one column and prints smaller', () => {
    keep();
    const cc = mountLong({ minLayout: 600 });
    try {
      const r = cc.fig.renderPrint({ size: '8.5', textPt: 8 });
      eq(r.width, 600);
      near(r.textPt, 11 * (8.5 / 2.54 * 72) / 600, 0.02);
      eq(cc.fig.renderPrint({ size: '17', textPt: 8 }).width, 663, 'wider layouts unchanged');
    } finally { cc.el.remove(); restore(); }
  });

  it('the export bar says the size the text will print at, and warns when the labels do not fit', async () => {
    keep();
    const renderOver = cfg => { const s = render(cfg); s.appendChild(Fig.text(cfg.width - 20, 60, 'Etiquetasinespaciosmuylargaquenocabe', { size: 11, role: 'label' })); return s; };
    const cc = ChartCard.mount(playground(), { id: 'exFigOver', title: 'Producción anual', render: renderOver, data, width: 900, height: 560 });
    const cc2 = mount();
    try {
      const bar = host => { const tools = host.querySelector('.fig-tools'); const sel = tools.querySelectorAll('select'); return { fmt: sel[0], size: sel[1], info: tools.querySelector('.fig-info') }; };
      const set = (input, v) => { input.value = v; input.dispatchEvent(new Event('change')); };
      const a = bar(cc2.el);
      set(a.fmt, 'svg'); set(a.size, '17');
      await tick(150);
      ok(/letra base de 8 pt/.test(a.info.textContent) && !a.info.classList.contains('fig-warn'), a.info.textContent);
      const b = bar(cc.el);
      set(b.fmt, 'png'); set(b.size, '8.5');
      await tick(150);
      const real = cc.fig.renderPrint(Fig.exportPrefs()).textPt;
      ok(real < 7.5, 'the long label makes the text print at ' + real.toFixed(1) + ' pt');
      ok(b.info.classList.contains('fig-warn') && b.info.textContent.includes(real.toFixed(1) + ' pt'), b.info.textContent);
    } finally { cc.el.remove(); cc2.el.remove(); restore(); }
  });
});

describe('export · networks and the package of results', () => {
  const reset = () => {
    ImportModule.clear(); Pipeline.settings = null;
    ['synonyms', 'stopwords', 'termField', 'prisma', 'exportOptions', 'figexport'].forEach(k => Prefs.del(k));
    ConceptualModule.params = null; ConceptualModule._net = null; ConceptualModule.selectedKey = null; ConceptualModule.figs = {}; ConceptualModule.tab = 'cooccurrence';
    IntellectualModule.reset(); SocialModule.reset(); PrismaModule.reset();
    ExportModule.catalog = null; ExportModule.selected = null;
  };
  const load = async records => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    ImportModule.addResult({ name: 'export.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
  };
  const catchDownloads = async (fn, n) => {
    const got = [], savedDl = window.download;
    window.download = (blob, name) => got.push({ blob, name });
    try { fn(); for (let i = 0; i < 400 && got.length < n; i++) await tick(25); } finally { window.download = savedDl; }
    return got;
  };

  it('the network screens save GraphML, GEXF, .net text and lists of nodes and edges of the network as drawn', async () => {
    await load(networkDataset());
    location.hash = '#/conceptual';
    App.render('conceptual');
    await ConceptualModule.pending;
    ok(el('cnExport'), 'export card');
    const net = ConceptualModule._net.data;
    const got = await catchDownloads(() => ['graphml', 'gexf', 'net', 'csv'].forEach(f => el('cnExport-' + f).click()), 5);
    deepEq(got.map(g => g.name), ['Red_de_coocurrencia.graphml', 'Red_de_coocurrencia.gexf', 'Red_de_coocurrencia.net', 'Red_de_coocurrencia_nodos.csv', 'Red_de_coocurrencia_aristas.csv']);
    const g = new DOMParser().parseFromString(await got[0].blob.text(), 'application/xml');
    ok(!g.getElementsByTagName('parsererror').length, 'GraphML parses');
    const nodes = [...g.getElementsByTagName('node')];
    eq(nodes.length, net.nodes.length);
    eq(g.getElementsByTagName('edge').length, net.edges.length);
    const value = (n, key) => [...n.getElementsByTagName('data')].find(d => d.getAttribute('key') === key).textContent;
    const byLabel = new Map(nodes.map(n => [value(n, 'label'), n]));
    deepEq([...byLabel.keys()].sort(), ConceptualModule.view.state.nodes.map(n => n.label).sort(), 'the same terms as the view');
    eq(value(byLabel.get('maize'), 'community'), value(byLabel.get('landraces'), 'community'));
    ok(value(byLabel.get('maize'), 'community') !== value(byLabel.get('bees'), 'community'), 'two communities');
    const netLines = (await got[2].blob.text()).split('\r\n');
    eq(netLines[0], '*Vertices ' + net.nodes.length);
    ok(netLines.slice(1, 1 + net.nodes.length).every(l => { const m = /^\d+ ".+" ([\d.]+) ([\d.]+)$/.exec(l); return m && +m[1] <= 1 && +m[2] <= 1; }), 'coordinates in 0–1');
    eq(exCsv(await got[3].blob.text()).length, net.nodes.length + 1);
    eq(exCsv(await got[4].blob.text()).length, net.edges.length + 1);
    const help = el('cnExport').querySelector('.help-btn');
    help.click();
    const pop = document.querySelector('.help-pop');
    ok(pop && pop.querySelector('.formula') && pop.querySelector('.help-refs li'), 'help with formula and reference');
    HelpPopover.close();
  });

  it('criterion: the export module finds figures, tables and networks of every module and saves the chosen ones in one ZIP with ordered names and an index', async () => {
    await load(intellectualDataset());
    location.hash = '#/export';
    App.render('export');
    ok(el('exEmpty') && el('exFormats') && el('exDataCard') && el('exZipCard'), 'cards before the search');
    ExportModule.setOpts({ figures: ['png', 'svg', 'pdf'], tables: ['xlsx', 'csv'], networks: ['graphml', 'gexf', 'net', 'csv'], data: ['csv', 'bibtex', 'synonyms'] });
    Fig.setExportPrefs({ size: '8.5', textPt: 8, dpi: 300, grayscale: false, background: 'transparent' });
    await ExportModule.collect();
    const items = ExportModule.catalog.items;
    const count = kind => items.filter(it => it.kind === kind).length;
    ok(count('figure') >= 20 && count('table') >= 20 && count('network') >= 3, `found ${count('figure')} figures, ${count('table')} tables, ${count('network')} networks`);
    const order = items.map(it => ExportCollector.MODULES.indexOf(it.module));
    ok(order.every((v, i) => v >= 0 && (i === 0 || order[i - 1] <= v)), 'in the order of the modules');
    deepEq([...new Set(items.map(it => it.module))], ['overview', 'sources', 'authors', 'documents', 'conceptual', 'intellectual', 'social', 'prisma']);
    ok(items.filter(it => it.module !== 'overview').every(it => it.tabLabel), 'each item knows its tab');
    ok(!document.querySelector('.export-offscreen'), 'the hidden drawing area is removed');
    eq(el('exFound').textContent, `${count('figure')} figuras, ${count('table')} tablas y ${count('network')} redes.`);
    eq(el('exList').querySelectorAll('input[id^="exItem-"]').length, items.length);
    ok(el('exList').querySelectorAll('input[id^="exItem-"]:checked').length === items.length, 'all ticked');
    /* a quicker package: two figures, every table and every network */
    const figures = items.filter(it => it.kind === 'figure').slice(0, 2);
    ExportModule.selected = new Set(items.filter(it => it.kind !== 'figure').concat(figures).map(it => it.uid));
    ExportModule.rerender();
    ok(el('exZipHint').textContent.startsWith(String(ExportModule.selected.size)), 'count of ticked items');
    const got = await catchDownloads(() => el('exZip').click(), 1);
    eq(got.length, 1);
    ok(/^scimetricspro_resultados_\d{4}-\d{2}-\d{2}\.zip$/.test(got[0].name), got[0].name);
    const entries = Zip.read(await exBytes(got[0].blob));
    const names = entries.map(e => e.name);
    ok(entries.every(e => e.crc === Zip.crc32(e.data)), 'CRC of every file');
    eq(names[0], 'indice.csv');
    const bad = names.filter(n => !/^(indice\.csv|datos\/(documentos\.csv|documentos\.bib|sinonimos\.csv)|(figuras|tablas|redes)\/\d{2}_[a-z0-9_]+\.(png|svg|pdf|xlsx|csv|graphml|gexf|net))$/.test(n));
    deepEq(bad, [], 'lowercase names without accents: folder/NN_title.ext');
    deepEq(names.filter(n => n.startsWith('figuras/')), ['figuras/01_produccion_cientifica_anual.png', 'figuras/01_produccion_cientifica_anual.svg', 'figuras/01_produccion_cientifica_anual.pdf',
      'figuras/02_citas_promedio_por_anio.png', 'figuras/02_citas_promedio_por_anio.svg', 'figuras/02_citas_promedio_por_anio.pdf']);
    for (const folder of ['tablas', 'redes']) {
      const nums = [...new Set(names.filter(n => n.startsWith(folder + '/')).map(n => +n.split('/')[1].slice(0, 2)))];
      deepEq(nums, nums.map((x, i) => i + 1), folder + ' numbered 01, 02… without gaps');
    }
    eq(names.filter(n => /^tablas\/.*\.xlsx$/.test(n)).length, count('table'));
    eq(names.filter(n => /^tablas\/.*\.csv$/.test(n)).length, count('table'));
    const graphml = names.filter(n => n.endsWith('.graphml'));
    eq(graphml.length, count('network'));
    graphml.forEach(n => { const base = n.replace(/\.graphml$/, ''); ['.gexf', '.net', '_nodos.csv', '_aristas.csv'].forEach(s => ok(names.includes(base + s), base + s)); });
    eq(new Set(names).size, names.length, 'no repeated names');
    const file = n => entries.find(e => e.name === n).data;
    const png = exPng(file('figuras/01_produccion_cientifica_anual.png'));
    deepEq([png.width, png.ppm], [1004, 11811], '8.5 cm at 300 dpi');
    const bmp = await createImageBitmap(new Blob([file('figuras/01_produccion_cientifica_anual.png')]));
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    const alpha = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.filter((v, i) => i % 4 === 3);
    ok(alpha.every(v => v === 255), 'white background in the package even with a transparent background chosen in a figure bar');
    eq(new DOMParser().parseFromString(exUtf8(file('figuras/01_produccion_cientifica_anual.svg')), 'image/svg+xml').documentElement.getAttribute('width'), '8.50cm');
    const pdf = await exPdf(file('figuras/01_produccion_cientifica_anual.pdf'));
    ok(pdf.offsetsOk, 'PDF cross references');
    near(pdf.width, 8.5 / 2.54 * 72, 0.01);
    /* index */
    const index = exCsv(exUtf8(file('indice.csv')));
    deepEq(index[0], ['N.º', 'Tipo', 'Módulo', 'Pestaña', 'Título', 'Archivo']);
    deepEq(index.slice(1).map(r => r[5]), names.slice(1), 'the index lists every file in order');
    ok(index.slice(1).every((r, i) => +r[0] === i + 1 && r[1] && r[2] && r[4]), 'number, kind, module and title');
    deepEq(index.find(r => r[5] === 'figuras/01_produccion_cientifica_anual.png').slice(1, 5), ['Figura', 'Panorama general', '', 'Producción científica anual']);
    /* a table read back */
    const tableName = names.find(n => /^tablas\/01_.*\.xlsx$/.test(n));
    const wb = XLSX.read(file(tableName), { type: 'array' });
    const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).filter(r => r.length);
    const csvRows = exCsv(exUtf8(file(tableName.replace(/\.xlsx$/, '.csv'))));
    deepEq(sheetRows[0], csvRows[0], 'same header in both formats');
    eq(sheetRows.length, csvRows.length, 'same rows');
    /* data */
    const docs = exCsv(exUtf8(file('datos/documentos.csv')));
    eq(docs.length, Pipeline.records().length + 1);
    const bib = Parsers.lib().parseBibtex(exUtf8(file('datos/documentos.bib')), { tick() {} }).records;
    deepEq(bib.map(r => r.title).sort(), Pipeline.records().map(r => r.title).sort());
    deepEq([...file('datos/sinonimos.csv').subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'synonyms in UTF-8 with BOM');
    /* nothing ticked: only the data and the index */
    el('exNone').click();
    eq(el('exZipHint').textContent.split(' ')[0], '0');
    const item = document.querySelector('input[id^="exItem-"]');
    item.checked = true; item.dispatchEvent(new Event('change'));
    ok(el('exZipHint').textContent.startsWith('1 figura, tabla o red marcada'), el('exZipHint').textContent);
    item.checked = false; item.dispatchEvent(new Event('change'));
    ExportModule.setOpts({ data: ['bibtex'] });
    deepEq((await ExportModule.buildFiles()).map(f => f.name), ['indice.csv', 'datos/documentos.bib']);
    el('exAll').click();
    eq(ExportModule.selected.size, items.length);
  });

  it('every help has a text and a formula; no visible text outside the dictionaries; a change of the documents asks to search again', async () => {
    const problems = [], bad = [];
    let helps = 0;
    const literal = s => /^(PNG|TIFF|SVG|PDF|GraphML|GEXF|CSV \(UTF-8\)|\d+ dpi)$/.test(s);
    for (const lang of ['es', 'en']) {
      I18N.setLang(lang);
      App.render('export');
      const dict = dictMatcher(lang);
      const known = s => literal(s) || dict(s.replace(/^·\s*/, '').replace(/^\((.+)\)$/, '$1'));
      strayTexts(el('view'), lang).filter(s => !known(s)).forEach(s => problems.push(lang + ': ' + s));
      el('view').querySelectorAll('details.ex-group').forEach(d => { d.open = true; });
      const buttons = [...el('view').querySelectorAll('.export-page .help-btn')];
      helps += buttons.length;
      buttons.forEach((btn, i) => {
        btn.click();
        const pop = document.querySelector('.help-pop');
        if (!pop || !pop.querySelector('.formula') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(lang + ' #' + i);
        HelpPopover.close();
      });
    }
    I18N.setLang('es');
    eq(helps, 8, 'four helps in each language');
    deepEq({ problems: [...new Set(problems)], bad }, { problems: [], bad: [] });
    App.render('export');
    ok(!el('exStale'), 'results up to date');
    Pipeline.setOnlyIncluded(true);
    await Pipeline.pending;
    ok(el('exStale'), 'asks to search again');
    Pipeline.setOnlyIncluded(false);
    await Pipeline.pending;
    reset();
    await Pipeline.pending;
  });
});
