/* Import screen: several files, warnings, available fields, preview, removing files. */
'use strict';

describe('import · screen', () => {
  const files = () => [
    new File([FIXTURES.idxaCsv], 'export_indice_a.csv', { type: 'text/csv' }),
    new File([FIXTURES.idxbTagged], 'savedrecs.txt', { type: 'text/plain' }),
    new File([FIXTURES.biomedTagged], 'biomed-set.txt', { type: 'text/plain' }),
  ];

  it('adds several files from different databases and shows them with their detected format', async () => {
    I18N.setLang('es');
    App.boot(el('app'));
    ImportModule.clear();
    App.render('import');
    await ImportModule.addFiles(files(), { quiet: true });
    eq(state.files.length, 3);
    eq(state.records.length, 2 + 2 + 2);
    const rows = [...el('view').querySelectorAll('.files-table tbody tr')];
    eq(rows.length, 3);
    const label = (s, f) => t('import.detected', { source: t('import.sourceNames.' + s), format: t('import.formatNames.' + f) });
    deepEq(rows.map(r => r.querySelector('.chip').textContent), [label('idxA', 'csv'), label('idxB', 'tagged2'), label('biomed', 'tagged4')]);
    deepEq(rows.map(r => r.children[2].textContent), ['2', '2', '2']);
    ok(el('view').querySelector('.note-info'), 'mixed sources note');
    eq(el('importSummary').textContent, '6 registros · 3 archivos');
  });

  it('warns about missing information in plain language', () => {
    const notes = [...el('view').querySelectorAll('.files-table tbody tr')].map(r => r.querySelector('.file-notes').textContent);
    ok(notes[2].includes('No trae referencias citadas'), 'no references');
    ok(notes[2].includes('No trae número de citas'), 'no citations');
    ok(notes[0].includes('Se omitió 1 registro sin título'), 'dropped untitled');
  });

  it('shows the share of records with each field, per file and in total', () => {
    const table = el('completenessTable');
    ok(table, 'table');
    const refs = table.querySelector('tr[data-field="references"]');
    deepEq([...refs.querySelectorAll('.comp-pct')].map(x => x.textContent), ['50 %', '100 %', '50 %', '0 %'], 'total first, then each file');
    eq(table.querySelectorAll('tbody tr').length, 11);
  });

  it('previews the records with authors, year, source, citations, keywords and references', () => {
    const preview = el('importPreview');
    ok(preview, 'preview');
    const first = preview.querySelector('tbody tr');
    const cells = [...first.children].map(td => td.textContent);
    eq(cells[1], 'Ramírez-Ojeda G.; Cadena-Iñiguez J.');
    eq(cells[2], '2024');
    eq(cells[4], 'Grasses');
    eq(cells[5], '12');
    eq(cells[7], '3');
    eq(preview.querySelector('.dt-count').textContent, '1–6 de 6');
  });

  it('the sidebar shows what is loaded and the analysis modules stop asking for data', () => {
    const status = el('app').querySelector('.nav-status');
    eq(status.textContent, '6 registrosde 3 archivos');
    ok(!el('app').querySelector('.nav-link[data-route="overview"] .nav-dot'), 'no needs-data dot');
    Modules.list.forEach(m => { App.render(m.id); ok(!el('view').textContent.includes('Este análisis estará disponible pronto'), m.id + ' is implemented'); });
    App.render('import');
  });

  it('skips a file that was already imported, removes files and clears everything', async () => {
    const origToast = window.toast; let warned = '';
    window.toast = (msg) => { warned = msg; };
    await ImportModule.addFiles([new File([FIXTURES.idxbTagged], 'savedrecs.txt')], { quiet: true });
    window.toast = origToast;
    eq(state.files.length, 3);
    ok(warned.includes('ya estaba importado'), 'duplicate warning');
    const id = state.files[1].id;
    ImportModule.removeFile(id);
    eq(state.files.length, 2);
    eq(state.records.length, 4);
    ok(state.records.every(r => r.fileId !== id));
    eq(el('view').querySelectorAll('.files-table tbody tr').length, 2);
    ImportModule.clear();
    eq(state.records, null);
    ok(!el('view').querySelector('.files-table'), 'files table gone');
    eq(el('app').querySelector('.nav-status').textContent, 'Sin datos cargados');
  });

  it('reads spreadsheets (.xlsx, .ods): the first sheet with data gives the same records as the CSV', async () => {
    I18N.setLang('es');
    ImportModule.clear();
    const L = Parsers.lib();
    const rows = L.parseDelimited(L.stripBom(FIXTURES.idxaCsv), ',').filter(r => r.some(v => String(v).trim()));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['']]), 'Notas');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Registros');
    const xlsx = new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'export_indice_a.xlsx');
    const ods = new File([XLSX.write(book, { type: 'array', bookType: 'ods' })], 'export_indice_a.ods');
    const csv = new File([FIXTURES.idxaCsv], 'export_indice_a.csv', { type: 'text/csv' });
    await ImportModule.addFiles([csv, xlsx, ods], { quiet: true });
    deepEq(state.files.map(f => [f.source, f.format, f.count]), [['idxA', 'csv', 2], ['idxA', 'sheet', 2], ['idxA', 'sheet', 2]]);
    eq(state.files[1].size, xlsx.size, 'the size of the original file, so importing it again is detected');
    const pick = r => [r.title, r.year, r.doi, r.timesCited, r.authors.map(a => a.short + '|' + a.affiliations.length), r.countries, r.authorKeywords,
      r.indexKeywords, r.references.map(x => x.raw), r.abstract, r.languages, r.docType, r.openAccess, r.accession];
    const of = f => state.records.filter(r => r.fileId === f.id).map(pick);
    deepEq(of(state.files[1]), of(state.files[0]), '.xlsx');
    deepEq(of(state.files[2]), of(state.files[0]), '.ods');
    ok(state.records.filter(r => r.fileId === state.files[1].id).every(r => r.format === 'sheet'));
    ImportModule.tab = 'files'; App.render('import');
    const chips = [...el('view').querySelectorAll('.files-table tbody tr')].map(r => r.querySelector('.chip').textContent);
    eq(chips[1], t('import.detected', { source: t('import.sourceNames.idxA'), format: t('import.formatNames.sheet') }));
    await ImportModule.addFiles([xlsx], { quiet: true });
    eq(state.files.length, 3, 'the same spreadsheet is not imported twice');
    await ImportModule.addFiles([new File(['nothing tabular here'], 'roto.xlsx')], { quiet: true });
    const bad = state.files[state.files.length - 1];
    ok(bad.error && bad.count === 0, 'a spreadsheet without a table is reported: ' + bad.error);
    const accept = el('importInput').getAttribute('accept');
    ok(['.xlsx', '.xls', '.ods'].every(x => accept.includes(x)), accept);
    ok(el('impFormats').textContent.includes('Hojas de cálculo y tablas'), 'listed among the formats');
    ImportModule.clear();
  });

  it('record ids are unique across files', async () => {
    await ImportModule.addFiles(files(), { quiet: true });
    const ids = state.records.map(r => r.id);
    eq(new Set(ids).size, ids.length);
    ImportModule.clear();
  });
});
