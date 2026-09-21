/* Report: the word-processing document writer read back (parts, styles, fields, figure size, tables, page), the methods
   written from the data (sources, searches, duplicates, cleaning, filters), plural forms, a report in English from the
   Spanish interface, the report of every section with numbered figures and tables, paragraphs and references, the
   downloads (.docx, .html, printing) and the screen (helps, texts, stale notice). */
'use strict';

const rpXml = s => { const d = new DOMParser().parseFromString(s, 'application/xml'); return d.getElementsByTagName('parsererror').length ? null : d; };
const rpParts = async blob => { const map = {}; Zip.read(new Uint8Array(await blob.arrayBuffer())).forEach(e => { map[e.name] = e.data; }); return map; };
const rpText = b => new TextDecoder().decode(b);
async function rpPng(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1d5bb0'; ctx.fillRect(0, 0, w, h);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

describe('report · document writer', () => {
  it('a valid package: parts, styles in the language, footer with the page number, caption fields, figure at its size, table with repeated header', async () => {
    const png = await rpPng(40, 20);
    const bad = 'Nota' + String.fromCharCode(1) + ' final';
    const blob = DocxWriter.build({ title: 'Prueba & <informe>', author: 'Autora', lang: 'es', page: 'letter', blocks: [
      { type: 'title', text: 'Análisis' }, { type: 'cover', text: 'Autora' }, { type: 'pagebreak' },
      { type: 'heading', level: 1, text: 'Metodología' }, { type: 'heading', level: 2, text: 'Datos' },
      { type: 'paragraph', text: 'Uno & dos < tres\nsegunda línea ' + bad },
      { type: 'figure', image: png, widthCm: 16, heightCm: 8, caption: { label: 'Figura', number: 1, seq: 'Figura', text: 'Producción anual' } },
      { type: 'table', caption: { label: 'Tabla', number: 1, seq: 'Tabla', text: 'Tipos' }, head: ['Tipo', 'Documentos'], numeric: [false, true], rows: [['Artículo', '17'], ['Revisión', '4']], note: 'Nota: ejemplo.' },
      { type: 'reference', text: 'Bradford, S. C. (1934). Engineering, 137, 85–86.' },
    ] });
    eq(blob.type, DocxWriter.MIME);
    const parts = await rpParts(blob);
    ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'word/document.xml', 'word/styles.xml', 'word/settings.xml', 'word/footer1.xml', 'word/_rels/document.xml.rels', 'word/media/image1.png']
      .forEach(n => ok(parts[n], n));
    const xml = Object.keys(parts).filter(n => /\.(xml|rels)$/.test(n)).map(n => [n, rpXml(rpText(parts[n]))]);
    deepEq(xml.filter(([, d]) => !d).map(([n]) => n), [], 'every XML part is well formed');
    const doc = rpXml(rpText(parts['word/document.xml']));
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const all = tag => [...doc.getElementsByTagNameNS(W, tag)];
    const text = all('t').map(n => n.textContent).join('');
    ok(text.includes('Uno & dos < tres') && text.includes('segunda línea Nota final'), 'escaped text, control character dropped');
    eq(all('br').filter(b => !b.getAttribute('w:type')).length, 1, 'line break');
    eq(all('br').filter(b => b.getAttribute('w:type') === 'page').length, 1, 'page break');
    const styles = all('pStyle').map(s => s.getAttribute('w:val'));
    ['Title', 'Cover', 'Heading1', 'Heading2', 'Figure', 'Caption', 'TableText', 'TableNote', 'Bibliography'].forEach(s => ok(styles.includes(s), 'style ' + s));
    const instr = all('instrText').map(n => n.textContent.trim());
    deepEq(instr, ['SEQ Figura \\* ARABIC', 'SEQ Tabla \\* ARABIC'], 'numbering fields');
    const extent = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
    deepEq([+extent.getAttribute('cx'), +extent.getAttribute('cy')], [16 * 360000, 8 * 360000], 'figure 16 × 8 cm');
    const embed = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip')[0].getAttribute('r:embed');
    const rels = rpText(parts['word/_rels/document.xml.rels']);
    ok(new RegExp('Id="' + embed + '"[^>]*Target="media/image1.png"').test(rels), 'image relationship');
    deepEq([...parts['word/media/image1.png']], [...png], 'image bytes');
    eq(all('tblHeader').length, 1, 'repeated header row');
    eq(all('tr').length, 3);
    const grid = all('gridCol').map(g => +g.getAttribute('w:w'));
    eq(+all('tblW')[0].getAttribute('w:w'), grid.reduce((a, b) => a + b, 0), 'table width = columns');
    const sz = all('pgSz')[0];
    deepEq([sz.getAttribute('w:w'), sz.getAttribute('w:h')], ['12240', '15840'], 'letter');
    ok(all('titlePg').length === 1 && all('footerReference').length === 1, 'no page number on the cover');
    ok(rpText(parts['word/footer1.xml']).includes('w:instr=" PAGE "'), 'page number');
    ok(rpText(parts['word/styles.xml']).includes('w:lang w:val="es-MX"'), 'language of the spelling');
    const core = rpXml(rpText(parts['docProps/core.xml']));
    eq(core.getElementsByTagName('dc:title')[0].textContent, 'Prueba & <informe>');
    const a4 = await rpParts(DocxWriter.build({ title: 'x', lang: 'en', page: 'a4', blocks: [{ type: 'paragraph', text: 'x' }] }));
    ok(rpText(a4['word/document.xml']).includes('w:w="11906" w:h="16838"') && rpText(a4['word/styles.xml']).includes('en-US'), 'A4 in English');
    near(DocxWriter.textWidthCm('letter'), 16.59, 0.01);
    near(DocxWriter.textWidthCm('a4'), 16.0, 0.01);
  });

  it('table widths: a narrow table keeps its width, a wide one takes the page and no word is cut', () => {
    const text = DocxWriter.textWidthCm('letter') * DocxWriter.TWIPS_PER_CM;
    const narrow = DocxWriter.tableLayout({ head: ['Indicador', 'Valor'], numeric: [false, true], rows: [['Edad promedio de los documentos (años)', '7.79']] }, text);
    ok(narrow.total < text * 0.7, 'narrow: ' + narrow.total);
    const long = 'Aguiniga-Sanchez I., 2017, Pharm Biol (5); Fick S.E., 2017, Int. J. Climatol (5); Verma V.K., 2017, Physiol. Mol. Biol. Plants (4)';
    const wide = DocxWriter.tableLayout({ head: ['Año de la referencia', 'Referencias citadas (NCR)', 'Mediana de 5 años', 'Desviación', 'Referencias más citadas del año'], numeric: [true, true, true, true, false], rows: [['2017', '75', '53', '22', long]] }, text);
    near(wide.total, text, 1, 'the page width');
    ok(wide.widths[3] >= 'Desviación'.length * DocxWriter.TWIPS_PER_CHAR + 200, 'the word «Desviación» fits');
  });
});

describe('report · text', () => {
  const reset = () => {
    ImportModule.clear(); Pipeline.settings = null;
    ['synonyms', 'stopwords', 'termField', 'prisma', 'reportOptions', 'reportSources', 'exportOptions', 'figexport'].forEach(k => Prefs.del(k));
    ConceptualModule.params = null; ConceptualModule._net = null; ConceptualModule.selectedKey = null; ConceptualModule.figs = {}; ConceptualModule.tab = 'cooccurrence';
    IntellectualModule.reset(); SocialModule.reset(); PrismaModule.reset();
    ExportModule.catalog = null; ExportModule.selected = null; ExportModule.report = { model: null, busy: false }; ExportModule.tab = 'files';
  };
  const paragraphs = model => model.blocks.filter(b => b.type === 'paragraph').map(b => b.text);

  it('methods written from the data: names, searches and dates of the sources, duplicates, cleaning, filters and the collection', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    const { a, b } = prismaFiles();
    ImportModule.addResult({ name: 'busqueda-a.ris', size: 1, format: 'ris', source: 'ris', records: a, warnings: [], completeness: Parsers.lib().completeness(a) });
    ImportModule.addResult({ name: 'busqueda-b.ris', size: 1, format: 'ris', source: 'ris', records: b, warnings: [], completeness: Parsers.lib().completeness(b) });
    await Pipeline.pending;
    eq(Pipeline.stats.identified, 23);
    eq(Pipeline.stats.duplicatesRemoved, 1, 'one document in both files');
    const fa = state.files[0];
    Report.setSourceInfo(fa, { label: 'Índice A', query: 'TITLE-ABS("passion fruit")', date: '2026-03-12' });
    eq(Pipeline.prisma().sourceLabels['busqueda-a.ris'], 'Índice A', 'the same name as in the PRISMA diagram');
    Pipeline.update({ synonyms: [{ from: 'passiflora', to: 'passion fruit' }], filters: Object.assign(Parsers.lib().emptyFilters(), { yearFrom: '2012' }) });
    await Pipeline.pending;
    const model = await Report.build({ sections: ['overview'], lang: 'es', title: '', author: 'Autora de prueba' });
    const p = paragraphs(model);
    eq(p[0], 'Los registros bibliográficos se obtuvieron de 2 fuentes de datos: Índice A (archivo bibliográfico; 12 registros; archivo «busqueda-a.ris»; búsqueda: TITLE-ABS("passion fruit"); consulta: 12 de marzo de 2026) y archivo bibliográfico (11 registros; archivo «busqueda-b.ris»).');
    ok(p[1].startsWith('En total se reunieron 23 registros.') && p[1].includes('≥ 0.95') && p[1].includes('(grupos: 1; registros eliminados: 1)') && p[1].endsWith('quedaron 22 documentos.'), p[1]);
    ok(p[2].includes('«palabras clave de autor» (sinónimos unificados: 1;'), p[2]);
    eq(p[3], 'Se aplicaron los siguientes filtros: años desde 2012; quedaron ' + tp('report.n.documents', Pipeline.stats.screening) + '.');
    const ov = OverviewModule._cache.stats;
    ok(p[4].startsWith('El conjunto analizado reúne ' + fmtInt(ov.documents) + ' documentos (2012–2021) de 1 fuente; por tipo de documento: artículo (' + ov.documents + ').'), p[4]);
    ok(p.some(x => x.includes('Aria y Cuccurullo (2017)')), 'the overview cites its definitions');
    deepEq(model.blocks.slice(0, 5).map(x => x.type + ':' + x.text), ['title:Análisis bibliométrico', 'subtitle:Informe de ' + ov.documents + ' documentos (2012–2021)', 'cover:Autora de prueba', 'cover:' + Report.dateText(new Date().toISOString().slice(0, 10)), 'cover:Generado con SciMetricsPro ' + APP.version]);
    const main = model.blocks.find(x => x.type === 'table' && x.id === 'main');
    deepEq(main.rows.slice(0, 3), [['Periodo', '2012–2021'], ['Documentos', String(ov.documents)], ['Fuentes', '1']]);
    ok(main.caption.number === 1 && main.caption.label === 'Tabla', 'Tabla 1');
    deepEq(model.refs, ['aria2017', 'software'], 'only the references cited in the text');
  });

  it('plural forms and a report in English from the Spanish interface, without changing the interface', async () => {
    eq(Report.n('documents', 1), '1 documento');
    eq(Report.n('documents', 1234), '1,234 documentos');
    eq(tp('report.methods.sources', 1, { list: 'X' }), 'Los registros bibliográficos se obtuvieron de una fuente de datos: X.');
    eq(Report.join(['a', 'b', 'c']), 'a, b y c');
    const model = await Report.build({ sections: ['overview', 'sources'], lang: 'en' });
    eq(I18N.lang, 'es', 'the interface stays in Spanish');
    const heads = model.blocks.filter(b => b.type === 'heading').map(b => b.text);
    deepEq(heads, ['Methods', 'Data', 'Analysis', 'Results', 'Overview', 'Sources', 'References', 'How to cite SciMetricsPro']);
    const p = paragraphs(model);
    ok(p[0].startsWith('The bibliographic records were obtained from 2 data sources: Índice A (bibliographic file; 12 records; file “busqueda-a.ris”; search: TITLE-ABS("passion fruit"); retrieved: March 12, 2026)'), p[0]);
    const figs = model.blocks.filter(b => b.type === 'figure');
    ok(figs.length >= 3 && figs.every(f => f.caption.label === 'Figure'), 'English captions');
    eq(figs[0].caption.text, I18N.withLang('en', () => t('overview.production.title')), 'the figure title in English');
    ok(/Annual|Documents/.test(decodeURIComponent(figs[0].svg)) && !/Documentos/.test(figs[0].svg), 'the figure drawn in English');
    const spanish = /\b(documentos|fuentes|autores|según|entre los)\b/i;
    deepEq(p.filter(x => spanish.test(x.replace(/busqueda-[ab]\.ris|Revista de Fruticultura/g, ''))), [], 'no Spanish text');
    ok(model.blocks.some(b => b.type === 'reference' && b.text.startsWith('Barrera-Guzmán, L. Á., & Ramírez-Ojeda, G. (2026). SciMetricsPro: bibliometric and scientometric analysis')), 'suggested citation');
    App.render('overview');
    ok(el('ovProductionCard').textContent.includes('Producción científica anual'), 'the screen is still in Spanish');
  });

  it('the share of the first source says it counts the documents with a source when some have none', () => {
    const saved = SourcesModule._cache;
    const rows = [{ label: 'Revista A', n: 15, share: 15 / 282 }, { label: 'Revista B', n: 14, share: 14 / 282 }];
    try {
      SourcesModule._cache = { data: { rows, withoutSource: 18 } };
      const some = I18N.withLang('es', () => Report.FACTS.srcTop().text);
      ok(some.includes('(5.3 % de los documentos con fuente)'), some);
      SourcesModule._cache = { data: { rows, withoutSource: 0 } };
      ok(I18N.withLang('es', () => Report.FACTS.srcTop().text).includes('(5.3 % del total)'), 'every document with a source');
      SourcesModule._cache = { data: { rows, withoutSource: 18 } };
      ok(I18N.withLang('en', () => Report.FACTS.srcTop().text).includes('of the documents with a source'), 'in English');
    } finally { SourcesModule._cache = saved; }
  });
});

describe('report · screen and downloads', () => {
  const reset = () => {
    ImportModule.clear(); Pipeline.settings = null;
    ['synonyms', 'stopwords', 'termField', 'prisma', 'reportOptions', 'reportSources', 'exportOptions', 'figexport'].forEach(k => Prefs.del(k));
    ConceptualModule.params = null; ConceptualModule._net = null; ConceptualModule.selectedKey = null; ConceptualModule.figs = {}; ConceptualModule.tab = 'cooccurrence';
    IntellectualModule.reset(); SocialModule.reset(); PrismaModule.reset();
    ExportModule.catalog = null; ExportModule.selected = null; ExportModule.report = { model: null, busy: false }; ExportModule.tab = 'files';
  };
  let model = null;

  it('criterion: a report of every section with its methods, numbered figures and tables, a paragraph with the numbers of each figure and the references of the methods', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    const records = intellectualDataset();
    ImportModule.addResult({ name: 'informe.csv', size: 1, format: 'csv', source: 'idxA', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    location.hash = '#/export';
    ExportModule.tab = 'report';
    App.render('export');
    ok(el('extab-report').getAttribute('aria-selected') === 'true' && el('rpOptions') && el('rpSources') && el('rpEmpty'), 'report tab before building');
    eq(el('rpSec').querySelectorAll('input:checked').length, 8, 'every section by default');
    eq(el('rpLabel-' + state.files[0].id).getAttribute('placeholder'), 'índice de citas multidisciplinario', 'generic name of the source');
    const date = el('rpDate-' + state.files[0].id);
    date.value = '2026-09-01'; date.dispatchEvent(new Event('change'));
    model = await ExportModule.buildReport();
    ok(model && el('rpPreview') && el('rpDoc'), 'preview');
    eq(I18N.lang, 'es');
    const figs = model.blocks.filter(b => b.type === 'figure'), tabs = model.blocks.filter(b => b.type === 'table');
    ok(figs.length >= 15 && tabs.length >= 6, `${figs.length} figures and ${tabs.length} tables`);
    deepEq(figs.map(f => f.caption.number), figs.map((f, i) => i + 1), 'figures numbered 1…n');
    deepEq(tabs.map(f => f.caption.number), tabs.map((f, i) => i + 1), 'tables numbered 1…n');
    eq(el('rpDoc').querySelectorAll('figure').length, figs.length);
    eq(el('rpDoc').querySelectorAll('.rp-table').length, tabs.length);
    eq(el('rpSummary').textContent, `${figs.length} figuras y ${tabs.length} tablas · idioma: español`);
    const heads = model.blocks.filter(b => b.type === 'heading' && b.level === 2).map(b => b.text);
    ['Datos', 'Análisis', 'Panorama general', 'Fuentes', 'Autores, instituciones y países', 'Documentos y contenido', 'Estructura conceptual', 'Estructura intelectual', 'Revisión sistemática'].forEach(h => ok(heads.includes(h), 'heading ' + h));
    const text = model.blocks.filter(b => b.type === 'paragraph').map(b => b.text);
    ok(text[0].includes('consulta: 1 de septiembre de 2026'), 'the typed date');
    /* a paragraph with numbers before most figures, referring to its number */
    const withText = figs.filter(f => text.some(x => x.endsWith('(Figura ' + f.caption.number + ').'))).length;
    ok(withText >= figs.length - 2, `${withText} of ${figs.length} figures with their paragraph`);
    deepEq(text.filter(x => /undefined|NaN|\{\w+\}|report\.|—\)/.test(x)), [], 'every variable filled');
    ok(text.some(x => /^El documento más citado es Lira R\., 2010, Economic Botany, con 50 citas/.test(x)), 'the most cited document with its citations');
    ok(text.some(x => x.startsWith('La historiografía reúne ')), 'historiograph');
    /* references of the methods of the guide that apply to these data, and the software */
    ['aria2017', 'bradford1934', 'lotka1926', 'blondel2008', 'vaneck2009', 'page2021', 'small1973', 'kessler1963', 'garfield2004', 'software'].forEach(k => ok(model.refs.includes(k), 'reference ' + k));
    const body = text.join(' ');
    model.blocks.filter(b => b.type === 'reference' && b.key !== 'software').forEach(r => {
      const surname = r.text.split(',')[0].replace(/^van /, '');
      ok(body.includes(surname), 'cited in the text: ' + surname);
    });
    const refs = model.blocks.filter(b => b.type === 'reference').map(b => b.text);
    deepEq(refs, refs.slice().sort((x, y) => x.localeCompare(y, 'es-MX')), 'alphabetical');
    NEVER.forEach(re => ok(!re.test(el('rpDoc').textContent), 'no ' + re));
    figs.forEach(f => ok(f.widthCm <= 16.001 && f.heightCm <= Report.MAX_HEIGHT_CM + 0.02, f.id + ' ' + f.widthCm + ' × ' + f.heightCm));
  });

  it('downloads: the .docx with every figure at 300 dpi and every table, the printable page and printing', async () => {
    const got = [];
    const saved = window.download;
    window.download = (blob, name) => got.push({ blob, name });
    let res;
    try { res = await ExportModule.downloadDocx(); } finally { window.download = saved; }
    eq(got.length, 1);
    ok(/^scimetricspro_informe_\d{4}-\d{2}-\d{2}\.docx$/.test(got[0].name), got[0].name);
    const parts = await rpParts(res.blob);
    const doc = rpText(parts['word/document.xml']);
    ok(rpXml(doc), 'document.xml well formed');
    const figs = model.blocks.filter(b => b.type === 'figure');
    eq((doc.match(/<w:drawing>/g) || []).length, figs.length, 'every figure');
    eq((doc.match(/<w:tbl>/g) || []).length, model.tables, 'every table');
    eq(Object.keys(parts).filter(n => /^word\/media\/image\d+\.png$/.test(n)).length, figs.length);
    const png = parts['word/media/image1.png'];
    const u32 = i => (png[i] << 24 | png[i + 1] << 16 | png[i + 2] << 8 | png[i + 3]) >>> 0;
    let ppm = 0;
    for (let i = 8; i < png.length - 12; i++) if (png[i] === 0x70 && png[i + 1] === 0x48 && png[i + 2] === 0x59 && png[i + 3] === 0x73) { ppm = u32(i + 4); break; }
    eq(ppm, 11811, '300 dpi');
    near(u32(16) / 300 * 2.54, figs[0].widthCm, 0.01, 'pixels for the width of the figure');
    const cx = +/<wp:extent cx="(\d+)"/.exec(doc)[1];
    near(cx / 360000, figs[0].widthCm, 0.001, 'inserted at that width');
    ok(doc.includes('Análisis bibliométrico') && doc.includes('SEQ Figura') && doc.includes('SEQ Tabla'), 'title and numbering');
    const html = await ExportModule.downloadHtml().blob.text();
    ok(html.startsWith('<!DOCTYPE html>') && html.includes('@page{size:letter;margin:2.5cm}'), 'printable page');
    eq((html.match(/<figure /g) || []).length, figs.length);
    const printed = await new Promise(resolve => {
      const orig = ExportModule.printWindow;
      ExportModule.printWindow = w => { ExportModule.printWindow = orig; resolve(w); };
      ExportModule.printReport();
    });
    eq(printed.document.querySelectorAll('figure').length, figs.length, 'printing the same report');
    el('rpPrintFrame').remove();
  });

  it('every help has a text and a formula; no visible text outside the dictionaries; greyscale; a change of the documents asks to build again', async () => {
    const problems = [], bad = [];
    let helps = 0;
    for (const lang of ['es', 'en']) {
      I18N.setLang(lang);
      App.render('export');
      const view = el('view').cloneNode(true);
      view.querySelectorAll('.report-preview').forEach(n => n.remove());
      const dict = dictMatcher(lang);
      strayTexts(view, lang).filter(s => !dict(s.replace(/^·\s*/, '')) && !/^informe\.csv · \d+ (registros|records)$/.test(s) && s !== 'A4').forEach(s => problems.push(lang + ': ' + s));
      const buttons = [...el('view').querySelectorAll('#rpOptions .help-btn, #rpSources .help-btn, #rpPreview .help-btn')];
      helps += buttons.length;
      buttons.forEach((btn, i) => {
        btn.click();
        const pop = document.querySelector('.help-pop');
        if (!pop || !pop.querySelector('.formula') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(lang + ' #' + i);
        HelpPopover.close();
      });
    }
    I18N.setLang('es');
    eq(helps, 6, 'three helps in each language');
    deepEq({ problems: [...new Set(problems)], bad }, { problems: [], bad: [] });
    const fig = model.blocks.find(b => b.type === 'figure');
    const grey = Report.figureSize(fig.fig, { page: 'letter', grayscale: true });
    const colours = [...grey.svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6}|rgb\([^)]*\))"/gi)].map(m => parseColor(m[1])).filter(Boolean);
    ok(colours.length > 3 && colours.every(c => c[0] === c[1] && c[1] === c[2]), 'greyscale figures');
    App.render('export');
    ok(!el('rpStale'), 'up to date');
    Pipeline.setOnlyIncluded(true);
    await Pipeline.pending;
    ok(el('rpStale'), 'asks to build again');
    Pipeline.setOnlyIncluded(false);
    await Pipeline.pending;
    reset();
    await Pipeline.pending;
  });
});
