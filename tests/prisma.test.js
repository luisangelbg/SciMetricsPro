/* Systematic review (PRISMA 2020): keys of the decisions, numbers of the flow diagram worked out by hand, highlighted terms,
   the screening tool with its keyboard shortcuts, the diagram, the reasons, "analyse only the included" in every module,
   the export of the decisions and the helps. */
'use strict';

/* two files of a search: 12 and 11 records, one of them repeated in both (same DOI) → 22 documents to screen */
function prismaFiles() {
  const P = Parsers.lib();
  const topics = [
    ['Salt stress tolerance of passion fruit seedlings', 'Seedlings of Passiflora edulis were grown under salt stress and their growth was measured.', ['salt stress', 'passiflora']],
    ['Nitrogen fertilization of yellow passion fruit', 'Doses of nitrogen changed yield and fruit quality of Passiflora edulis.', ['nitrogen', 'passiflora']],
    ['Potassium and fruit quality in orchards', 'Potassium doses in commercial orchards and their effect on fruit quality.', ['potassium']],
    ['Organic manure for tropical fruit crops', 'Manure and compost applied to tropical fruit crops.', ['manure']],
  ];
  const rec = (i, file) => {
    const [title, abstract, kws] = topics[i % topics.length];
    const r = Object.assign(P.newRecord(), {
      title: title + ' ' + (i + 1), abstract, year: 2010 + (i % 12), sourceTitle: 'Revista de Fruticultura', doi: '10.5555/pf.' + (i + 1),
      timesCited: i % 7, docTypeRaw: 'Article', authorKeywords: kws, fileLabel: file,
    });
    r.authors = [P.person('Lopez, A.'), P.person('Garcia, B.')];
    return P.finish(r);
  };
  const a = Array.from({ length: 12 }, (x, i) => rec(i, 'a'));
  const b = Array.from({ length: 11 }, (x, i) => rec(i + 11, 'b'));
  return { a, b };
}

describe('prisma · flow numbers', () => {
  const P = () => Parsers.lib();

  it('keys of the decisions: the DOI, else the title and the year', () => {
    eq(P().prismaKey({ doi: '10.1000/ABC', title: 'X', year: 2020 }), 'doi:10.1000/abc');
    eq(P().prismaKey({ doi: '', title: 'Salt Stress — in Passiflora!', year: 2021 }), 't:salt stress in passiflora|2021');
    eq(P().prismaKey({ title: 'Ñandú', year: null }), 't:nandu|');
  });

  it('PRISMA 2020 numbers worked out by hand: removed, screened, excluded, sought, not retrieved, assessed, reasons and included', () => {
    const keys = Array.from({ length: 10 }, (x, i) => 'k' + i);
    const decisions = {
      k0: { status: 'include' }, k1: { status: 'include' }, k2: { status: 'exclude', reason: '' }, k3: { status: 'exclude', reason: '' },
      k4: { status: 'exclude', reason: 'notRetrieved' }, k5: { status: 'exclude', reason: 'r1' }, k6: { status: 'exclude', reason: 'r2' },
      k7: { status: 'exclude', reason: 'r1' }, k8: { status: 'maybe' }, outside: { status: 'include' },
    };
    const reasons = [{ id: 'r1', label: 'Population' }, { id: 'r2', label: 'Design' }, { id: 'r3', label: 'Language' }];
    const F = P().prismaFlow({ sources: [{ label: 'A', n: 10 }, { label: 'B', n: 5 }], registers: 2, duplicates: 3, automation: 1, filtered: 1, other: 1, keys, decisions, reasons });
    deepEq([F.identified, F.duplicates, F.automation, F.other, F.removed, F.screened], [17, 3, 1, 2, 6, 11]);
    eq(F.balanced, false, '11 screened but 10 documents in the tool');
    const G = P().prismaFlow({ sources: [{ label: 'A', n: 10 }, { label: 'B', n: 5 }], registers: 2, duplicates: 3, automation: 1, filtered: 2, other: 1, keys, decisions, reasons });
    deepEq([G.identified, G.removed, G.screened, G.excluded, G.sought, G.notRetrieved, G.assessed], [17, 7, 10, 2, 8, 1, 7]);
    deepEq(G.reportsExcluded, [{ id: 'r1', label: 'Population', n: 2 }, { id: 'r2', label: 'Design', n: 1 }]);
    deepEq([G.reportsExcludedTotal, G.included, G.maybe, G.undecided, G.pending, G.documents], [3, 2, 1, 1, 2, 10]);
    eq(G.balanced, true, 'assessed − excluded with reasons = included + pending');
    const H = P().prismaFlow({ sources: [], keys: ['a'], decisions: { a: { status: 'exclude', reason: 'gone' } }, reasons });
    deepEq(H.reportsExcluded, [{ id: 'gone', label: 'gone', n: 1 }], 'a reason that was deleted keeps its count');
  });

  it('highlighted terms: whole words, without case or accents, keeping the original text', () => {
    deepEq(P().highlightTerms('salt stress, Passiflora; salt stress\n x'), ['salt stress', 'Passiflora']);
    const pieces = P().highlightPieces('Salt stress in Passiflora edulis; SALT-STRESS and salty soils in Perú', ['salt stress', 'passiflora', 'peru']);
    deepEq(pieces.filter(p => p.mark).map(p => p.text), ['Salt stress', 'Passiflora', 'Perú']);
    eq(pieces.map(p => p.text).join(''), 'Salt stress in Passiflora edulis; SALT-STRESS and salty soils in Perú');
    deepEq(P().highlightPieces('text', []), [{ text: 'text', mark: false }]);
  });
});

describe('prisma · screen', () => {
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('prisma'); Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('termField'); PrismaModule.reset(); };
  const press = k => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const box = key => el('prFlow').querySelector(`[data-box="${key}"]`).textContent;
  const value = (grid, key) => el(grid).querySelector(`[data-key="${key}"] .metric-value`).textContent;
  const tab = id => { PrismaModule.tab = id; App.render('prisma'); };

  it('the screening card, the shortcuts I, E, D, U and the arrows, reasons and highlighted terms', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    const { a, b } = prismaFiles();
    ImportModule.addResult({ name: 'busqueda-a.ris', size: 1, format: 'ris', source: 'ris', records: a, warnings: [], completeness: Parsers.lib().completeness(a) });
    ImportModule.addResult({ name: 'busqueda-b.ris', size: 1, format: 'ris', source: 'ris', records: b, warnings: [], completeness: Parsers.lib().completeness(b) });
    await Pipeline.pending;
    eq(state.records.length, 23);
    eq(Pipeline.screening().length, 22, 'one duplicate merged');
    location.hash = '#/prisma';
    tab('screening');
    ok(el('psCard'), 'card');
    eq(el('psPos').textContent, 'Documento 1 de 22 · pendientes (sin decidir y dudosos)');
    eq(el('psTitle').textContent, 'Salt stress tolerance of passion fruit seedlings 1');
    ok(el('psAbstract').textContent.startsWith('Seedlings of Passiflora'), 'abstract');
    ok(el('psKeywords').textContent.includes('salt stress'), 'keywords');
    press('i');
    eq(Pipeline.decisionOf(Pipeline.screening()[0]).status, 'include');
    eq(el('psTitle').textContent, 'Nitrogen fertilization of yellow passion fruit 2', 'the next pending document');
    press('ArrowRight');
    eq(el('psTitle').textContent, 'Potassium and fruit quality in orchards 3');
    press('ArrowLeft');
    press('d');
    eq(Pipeline.decisionOf(Pipeline.screening()[1]).status, 'maybe');
    eq(el('psTitle').textContent, 'Potassium and fruit quality in orchards 3', 'a doubtful document stays pending; the card moves on');
    press('ArrowLeft');
    press('u');
    eq(Pipeline.decisionOf(Pipeline.screening()[1]), null, 'decision cleared');
    el('psTerms').value = 'fruit quality, nitrogen';
    el('psTerms').dispatchEvent(new Event('change'));
    deepEq([...el('psCard').querySelectorAll('mark')].map(m => m.textContent), ['Nitrogen', 'nitrogen', 'fruit quality', 'nitrogen'], 'title, abstract and keywords');
    el('psReason').value = 'design';
    press('e');
    const d = Pipeline.decisionOf(Pipeline.screening()[1]);
    deepEq([d.status, d.reason], ['exclude', 'design']);
    const typing = mk('input');
    el('psCard').appendChild(typing);
    typing.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true }));
    eq(Object.keys(Pipeline.prisma().decisions).length, 2, 'no shortcut while typing');
    deepEq(Pipeline.loadPrisma().decisions, Pipeline.prisma().decisions, 'decisions are remembered on this computer');
  });

  it('criterion: screening 20 documents updates the flow diagram', async () => {
    Object.keys(Pipeline.prisma().decisions).forEach(k => delete Pipeline.prisma().decisions[k]);
    Pipeline.savePrisma();
    PrismaModule.view = 'pending'; PrismaModule.index = 0;
    tab('screening');
    /* 20 documents: 8 included, 6 excluded by title and abstract, 2 not retrieved, 3 excluded with reasons, 1 doubtful */
    const plan = ['i', 'i', 'e', 'i', 'e', 'd', 'i', 'e', 'i', 'e', 'i', 'e', 'i', 'i', 'e', 'notRetrieved', 'notRetrieved', 'population', 'design', 'population'];
    for (const step of plan) {
      if (step.length > 1) { el('psReason').value = step; press('e'); } else { el('psReason').value = ''; press(step); }
    }
    eq(el('psCounts').textContent, '19 de 22 documentos decididos (86 %) · incluidos 8 · excluidos 11 · dudosos 1 · sin decidir 2');
    ok(el('prOnlyCard').textContent.includes('(8 documentos incluidos)'), 'the count next to the box follows the decisions: ' + el('prOnlyCard').textContent);
    tab('diagram');
    eq(box('identified'), 'Registros identificados desde:Bases de datos (n = 23)busqueda-a (n = 12)busqueda-b (n = 11)Registros (n = 0)');
    ok(box('removed').includes('Registros duplicados (n = 1)'), box('removed'));
    eq(box('screened'), 'Registros cribados (n = 22)');
    eq(box('excluded'), 'Registros excluidos (n = 6)');
    eq(box('sought'), 'Publicaciones buscadas para su recuperación (n = 16)');
    eq(box('notRetrieved'), 'Publicaciones no recuperadas (n = 2)');
    eq(box('assessed'), 'Publicaciones evaluadas para decidir su elegibilidad (n = 14)');
    eq(box('reportsExcluded'), 'Publicaciones excluidas:Población no pertinente (n = 2)Diseño de estudio no pertinente (n = 1)');
    eq(box('included'), 'Estudios incluidos en la revisión (n = 8)Informes de los estudios incluidos (n = 8)Pendientes de decisión (n = 3)');
    deepEq(['identified', 'removed', 'screened', 'assessed', 'included'].map(k => value('prStats', k)), ['23', '1', '22', '14', '8']);
    const cardSub = key => el('prStats').querySelector(`[data-key="${key}"] .metric-sub`).textContent;
    deepEq([cardSub('screened'), cardSub('assessed')], ['6 excluidos por título y resumen', '3 excluidos con motivo · 2 no recuperados']);
    ok(cardSub('removed').startsWith('1 duplicado · '), cardSub('removed'));
    ok(el('prPending').textContent.includes('3 documentos siguen pendientes'), 'pending note');
    ok(!el('prMismatch'), 'the numbers add up');
    const svg = el('prFlow').querySelector('svg');
    eq(svg.querySelectorAll('[data-part="arrow"]').length, 8, '4 down, 4 across');
    eq(svg.querySelectorAll('[data-phase]').length, 3);
    /* one more decision changes the diagram */
    tab('screening');
    PrismaModule.view = 'maybe'; PrismaModule.index = 0;
    PrismaModule.renderScreening();
    press('i');
    tab('diagram');
    eq(box('included'), 'Estudios incluidos en la revisión (n = 9)Informes de los estudios incluidos (n = 9)Pendientes de decisión (n = 2)');
  });

  it('source names, typed numbers and the list of reasons', async () => {
    const setNum = (id, v) => { const i = el(id); i.value = String(v); i.dispatchEvent(new Event('change')); };
    const fileA = state.files[0];
    eq(el('prParams').querySelector('.net-panel-title').textContent, 'Parámetros del diagrama');
    setNum('prParams-src' + fileA.id, 'Índice A, 12 de marzo');
    ok(box('identified').includes('Índice A, 12 de marzo (n = 12)'), box('identified'));
    setNum('prParams-registers', 3);
    ok(box('identified').includes('Registros (n = 3)') && box('identified').includes('Bases de datos (n = 23)'), 'registers apart from databases');
    ok(el('prMismatch'), 'screened (25) no longer matches the 22 documents');
    setNum('prParams-registers', 0);
    ok(!el('prMismatch'), 'balanced again');
    ok(el('prReasonDel-population').disabled, 'a used reason cannot be deleted');
    ok(!el('prReasonDel-language').disabled, 'an unused one can');
    el('prReasonDel-language').click();
    ok(!el('prReason-language'), 'deleted');
    el('prReasonNew').value = 'Sin datos de rendimiento';
    el('prReasonAdd').click();
    ok([...el('prReasons').querySelectorAll('input')].some(i => i.value === 'Sin datos de rendimiento'), 'added');
    const pop = el('prReason-population');
    pop.value = 'Especie distinta';
    pop.dispatchEvent(new Event('change'));
    ok(box('reportsExcluded').includes('Especie distinta (n = 2)'), 'renamed in the diagram');
    PrismaModule.view = 'all'; PrismaModule.index = 0;
    tab('screening');
    ok([...el('psReason').options].some(o => o.textContent === 'Sin datos de rendimiento'), 'new reason in the card');
  });

  it('criterion: "analyse only the included" changes the overview and every module', async () => {
    location.hash = '#/overview';
    App.render('overview');
    eq(el('ovCards').querySelector('[data-key="documents"] .metric-value').textContent, '22');
    location.hash = '#/prisma';
    tab('screening');
    el('prOnly').click();
    ok(Pipeline.onlyIncluded(), 'on');
    eq(Pipeline.records().length, 9);
    ok(el('docCounter').textContent.includes('9 de 22 documentos · solo incluidos'), el('docCounter').textContent);
    location.hash = '#/overview';
    App.render('overview');
    eq(el('ovCards').querySelector('[data-key="documents"] .metric-value').textContent, '9');
    location.hash = '#/sources';
    App.render('sources');
    ok(el('srcCards'), 'sources with the included');
    /* a new inclusion while the option is on reaches the analyses at once */
    location.hash = '#/prisma';
    PrismaModule.view = 'pending'; PrismaModule.index = 0;
    tab('screening');
    press('i');
    eq(Pipeline.records().length, 10);
    el('prOnly').click();
    eq(Pipeline.records().length, 22, 'off again');
  });

  it('the decisions export to a spreadsheet with the decision, the stage and the reason', async () => {
    const saved = window.download;
    let got = null;
    window.download = (blob, name) => { got = { blob, name }; };
    try { el('psExport').click(); } finally { window.download = saved; }
    ok(got && got.name.endsWith('.xlsx'), 'xlsx');
    const wb = XLSX.read(new Uint8Array(await got.blob.arrayBuffer()), { type: 'array' });
    deepEq(wb.SheetNames, ['Decisiones', 'Diagrama PRISMA']);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Decisiones, { header: 1 });
    eq(rows.length, 23, 'header + 22 documents');
    deepEq(rows[0].slice(0, 10), ['N.º', 'Clave', 'Título', 'Autores', 'Año', 'Fuente', 'DOI', 'Decisión', 'Etapa', 'Motivo']);
    const byTitle = t0 => rows.find(r => r[2] === t0);
    eq(byTitle('Salt stress tolerance of passion fruit seedlings 1')[7], 'Incluido');
    const excluded = rows.filter(r => r[7] === 'Excluido');
    eq(excluded.length, 11);
    ok(excluded.some(r => r[8] === 'Evaluación del texto completo' && r[9] === 'Especie distinta'), 'renamed reason');
    ok(excluded.some(r => r[8] === 'Cribado de título y resumen' && r[9] === 'Sin motivo (cribado de título y resumen)'), 'title and abstract');
    const diagram = XLSX.utils.sheet_to_json(wb.Sheets['Diagrama PRISMA'], { header: 1 });
    ok(diagram.some(r => r[0] === 'Registros cribados' && r[1] === 22), 'numbers of the diagram');
  });

  it('every help has a definition, a formula and its reference; no visible text outside the dictionaries; the diagram exports', async () => {
    const data = new Set(['busqueda-a', 'busqueda-b', 'Índice A, 12 de marzo', 'Sin datos de rendimiento', 'Especie distinta', 'Lopez, A.', 'Garcia, B.', 'Revista de Fruticultura', 'fruit quality, nitrogen']);
    const { a, b } = prismaFiles();
    a.concat(b).forEach(r => { data.add(r.title); data.add(r.abstract); r.authorKeywords.forEach(k => data.add(k)); });
    const problems = [], bad = [];
    let helps = 0;
    for (const lang of ['es', 'en']) {
      I18N.setLang(lang);
      for (const id of PrismaModule.TABS) {
        tab(id);
        const record = s => [...data].some(d => d.includes(s) || s.includes(d)) || /^10\.5555\/pf\.\d+$/.test(s) || /^\d{4}( · .*)?$/.test(s) || /^[IEDU]$/.test(s) || /^\(n = \d+\)$/.test(s);
        strayTexts(el('view'), lang).filter(s => !record(s)).forEach(s => problems.push(lang + ' ' + id + ': ' + s));
        if (lang === 'es') {
          const buttons = [...el('view').querySelectorAll('.prisma-page .help-btn')];
          helps += buttons.length;
          buttons.forEach((btn, i) => {
            btn.click();
            const pop = document.querySelector('.help-pop');
            if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(id + ' #' + i);
            HelpPopover.close();
          });
        }
      }
    }
    I18N.setLang('es');
    ok(helps >= 8, 'helps: ' + helps);
    deepEq({ problems: [...new Set(problems)], bad }, { problems: [], bad: [] });
    tab('diagram');
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    try {
      const buttons = PrismaModule.cc.prFlow.el.querySelectorAll('.chart-actions button');
      buttons[0].click(); buttons[1].click();
      for (let i = 0; i < 150 && got.length < 2; i++) await tick(30);
    } finally { window.download = saved; }
    eq(got.length, 2);
    const png = got.find(x => x.name.endsWith('.png'));
    const bytes = new Uint8Array(await png.blob.arrayBuffer());
    let ppm = null;
    for (let i = 8; i < bytes.length - 12; i++) if (bytes[i] === 0x70 && bytes[i + 1] === 0x48 && bytes[i + 2] === 0x59 && bytes[i + 3] === 0x73) { ppm = (bytes[i + 4] << 24 | bytes[i + 5] << 16 | bytes[i + 6] << 8 | bytes[i + 7]) >>> 0; break; }
    eq(ppm, 11811);
    const doc = new DOMParser().parseFromString(await got.find(x => x.name.endsWith('.svg')).blob.text(), 'image/svg+xml');
    ok(!doc.querySelector('parsererror') && doc.querySelector('marker#prArrow'), 'svg with arrows');
    reset();
    await Pipeline.pending;
  });
});
