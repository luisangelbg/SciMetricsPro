/* Import · Keywords: glossary, concepts from a title, search strings in the syntax of each database, and the screen. */
'use strict';

describe('keywords · glossary and concepts', () => {
  const P = () => Parsers.lib();
  const index = () => P().strategyIndex(window.SMP_GLOSSARY);
  const view = r => r.blocks.map(b => [b.kind, b.include, b.missing, b.label, b.terms]);

  it('the glossary is well formed: type, Spanish and English forms, no repeated spelling within a type', () => {
    const rows = window.SMP_GLOSSARY;
    ok(rows.length > 500, 'entries: ' + rows.length);
    const bad = rows.filter(r => !Array.isArray(r) || r.length !== 3 || !['n', 'a', 'o', 'p', 'g'].includes(r[0]) ||
      r.slice(1).some(f => !f || f.split(',').some(x => !x.trim())));
    deepEq(bad, []);
    const seen = new Map(), repeated = [];
    rows.forEach(([type, es]) => es.split(',').forEach(f => {
      const k = type + ':' + f.trim().split(/\s+/).map(w => P().strategyKey(w, 'es')).join(' ');
      if (seen.has(k) && seen.get(k) !== es) repeated.push(k);
      seen.set(k, es);
    }));
    deepEq(repeated, []);
    ok(rows.filter(r => r[0] === 'o').every(r => r[2].split(',').some(f => /^\p{Lu}/u.test(f.trim())) || /bamb|pez|ratón|rata|humano|teocintle/.test(r[1])), 'organisms carry a scientific name');
  });

  it('keys: plural and gender match; ñ is not n; English plurals', () => {
    const k = w => P().strategyKey(w, 'es');
    eq(k('nitrogenadas'), k('nitrogenado')); eq(k('raíces'), k('raíz')); eq(k('Flores'), k('flor')); eq(k('análisis'), 'analisis');
    ok(k('piña') !== k('pino'), 'piña and pino stay apart');
    eq(P().strategyKey('studies', 'en'), 'study'); eq(P().strategyKey('leaves', 'en'), 'leave'); eq(P().strategyKey('grass', 'en'), 'grass');
    eq(P().strategyLanguage(P().strategyTokens('Efecto del riego en el maíz'), index()), 'es');
    eq(P().strategyLanguage(P().strategyTokens('Passion fruit mineral nutrition'), index()), 'en', 'no function words: the glossary decides');
  });

  it('a Spanish title: modifiers in English order, a lone coordinated modifier, generic words out, organism, optional places', () => {
    const r = P().strategyConcepts('Efecto de la fertilización nitrogenada y potásica en el rendimiento y calidad del fruto de maracuyá (Passiflora edulis) en Veracruz, México', index());
    eq(r.lang, 'es');
    deepEq(view(r), [
      ['topic', true, false, 'fertilización nitrogenada / potásica', ['nitrogen fertilization', 'nitrogen fertilisation', 'nitrogen fertilizer', 'fertilización nitrogenada',
        'potassium fertilization', 'potassium fertilisation', 'potassium fertilizer', 'potassium fertiliser', 'fertilización potásica']],
      ['topic', true, false, 'rendimiento / calidad del fruto', ['yield', 'crop yield', 'rendimiento', 'fruit quality', 'calidad del fruto']],
      ['organism', true, false, 'maracuyá (Passiflora edulis)', ['passion fruit', 'passionfruit', 'Passiflora edulis', 'maracuyá']],
      ['place', false, false, 'Veracruz, México', ['Veracruz', 'Mexico']],
    ]);
    deepEq(r.blocks[0].pieces.map(p => p.label), ['fertilización nitrogenada', 'potásica'], 'the joined alternatives are kept');
  });

  it('English titles: a shared noun, an organism next to other nouns, Title Case, synonyms', () => {
    const a = P().strategyConcepts('Effect of nitrogen and potassium fertilization on yield of passion fruit in Brazil', index());
    eq(a.lang, 'en');
    deepEq(view(a), [
      ['topic', true, false, 'nitrogen / potassium fertilization', ['nitrogen fertilization', 'nitrogen fertilisation', 'nitrogen fertilizer', 'nitrogen fertiliser',
        'potassium fertilization', 'potassium fertilisation', 'potassium fertilizer', 'potassium fertiliser']],
      ['topic', true, false, 'yield', ['yield', 'crop yield']],
      ['organism', true, false, 'passion fruit', ['passion fruit', 'passionfruit', 'Passiflora edulis']],
      ['place', false, false, 'Brazil', ['Brazil']],
    ]);
    const b = P().strategyConcepts('Drought Tolerance Of Common Bean Landraces Under Field Conditions', index());
    deepEq(view(b).map(x => [x[0], x[3], x[4]]), [
      ['topic', 'Drought Tolerance', ['drought tolerance']],
      ['organism', 'Common Bean', ['common bean', 'Phaseolus vulgaris']],
      ['topic', 'Landraces', ['landraces', 'local varieties']],
    ], 'capitals of Title Case do not make places; field conditions are generic');
  });

  it('words the glossary does not know: flagged, scientific names and proper nouns kept; nothing to search', () => {
    const r = P().strategyConcepts('Lodos residuales y zeolita en suelos de Tuxpan con Sechium compositum', index());
    deepEq(view(r).map(x => [x[0], x[1], x[2], x[4]]), [
      ['topic', true, true, ['sewage sludge', 'biosolids', 'lodos residuales', 'zeolita']],
      ['topic', true, false, ['soil', 'soils', 'suelos']],
      ['place', false, false, ['Tuxpan']],
      ['organism', true, false, ['Sechium compositum']],
    ]);
    deepEq(P().strategyConcepts('Efecto y análisis: un estudio', index()).blocks, [], 'only generic words');
    deepEq(P().strategyConcepts('', index()).blocks, []);
  });

  it('separate and merge concepts', () => {
    const r = P().strategyConcepts('Cambio climático y distribución del aguacate', index());
    eq(r.blocks[0].label, 'Cambio climático / distribución');
    const parts = P().strategySeparate(r.blocks[0]);
    deepEq(parts.map(p => [p.label, p.terms]), [['Cambio climático', ['climate change', 'cambio climático']], ['distribución', ['distribution', 'distribución']]]);
    const joined = P().strategyMerge(parts[0], parts[1]);
    deepEq([joined.label, joined.terms, joined.pieces.length], ['Cambio climático / distribución', ['climate change', 'cambio climático', 'distribution', 'distribución'], 2]);
    deepEq(P().strategySeparate(parts[0]), [parts[0]], 'a single concept stays');
    deepEq(P().strategyUniqueTerms([' "Maize" ', 'maize', 'Maíz', 'maiz', '', null]), ['Maize', 'Maíz']);
  });
});

describe('keywords · search strings', () => {
  const P = () => Parsers.lib();
  const blocks = [
    { include: true, terms: ['passion fruit', 'Passiflora edulis'] },
    { include: true, terms: ['fertiliz*', 'nitrogen fertilization'] },
    { include: false, terms: ['Mexico'] },
  ];

  it('one term in the syntax of each database: phrases, field tags and truncation rules', () => {
    const term = (t, e, f) => { const r = P().strategyTerm(t, e, f); return r.skip ? 'skip:' + (r.stripped || '') : r.text; };
    eq(term('passion fruit', 'idxA'), '"passion fruit"'); eq(term('"yield"', 'idxA'), 'yield');
    eq(term('mai*', 'idxB'), 'mai*'); eq(term('ma*', 'idxB'), 'skip:ma', 'Web of Science: 3 letters before *');
    eq(term('soyb*', 'biomed'), 'soyb*[tiab]'); eq(term('soy*', 'biomed'), 'skip:soy[tiab]', 'PubMed: 4 letters before *');
    eq(term('nitrogen fertiliz*', 'biomed', 'title'), '"nitrogen fertiliz*"[ti]');
    eq(term('wom?n', 'biomed'), 'skip:womn[tiab]', '? becomes * and needs 4 letters');
    eq(term('nitrogen fertiliz*', 'scholar'), '(nitrogen AND fertiliz*)', 'Lens: no wildcard inside a phrase');
    eq(term('nitrogen fertiliz*', 'linked'), '(nitrogen AND fertiliz*)');
    eq(term('fertiliz*', 'regional'), 'fertiliz$'); eq(term('nitrogen fertiliz$', 'regional'), '(nitrogen AND fertiliz$)', 'SciELO: $');
    eq(term('fertiliz*', 'openapi'), 'skip:fertiliz'); eq(term('passion fruit', 'generic'), '"passion fruit"');
    eq(term(' - ', 'idxA'), 'skip:');
  });

  it('whole strings, worked out by hand, with fields and years', () => {
    const q = (e, o) => P().strategyQuery(e, blocks, Object.assign({ currentYear: 2026 }, o));
    eq(q('idxA', { yearFrom: 2010, yearTo: 2020 }).text, 'TITLE-ABS-KEY(("passion fruit" OR "Passiflora edulis") AND (fertiliz* OR "nitrogen fertilization")) AND PUBYEAR > 2009 AND PUBYEAR < 2021');
    eq(q('idxA', { field: 'title' }).text, 'TITLE(("passion fruit" OR "Passiflora edulis") AND (fertiliz* OR "nitrogen fertilization"))');
    eq(q('idxB', { field: 'title', yearFrom: '2010' }).text, 'TI=(("passion fruit" OR "Passiflora edulis") AND (fertiliz* OR "nitrogen fertilization")) AND PY=(2010-2026)');
    eq(q('idxB', { yearTo: 2000 }).text, 'TS=(("passion fruit" OR "Passiflora edulis") AND (fertiliz* OR "nitrogen fertilization")) AND PY=(1900-2000)');
    eq(q('biomed', { yearTo: 2020 }).text, '("passion fruit"[tiab] OR "Passiflora edulis"[tiab]) AND (fertiliz*[tiab] OR "nitrogen fertilization"[tiab]) AND 1800:2020[dp]');
    const g1 = '("passion fruit" OR "Passiflora edulis")', g2 = '(fertiliz* OR "nitrogen fertilization")';
    eq(q('scholar', { yearFrom: 2010, yearTo: 2020 }).text, '(title:' + g1 + ' OR abstract:' + g1 + ' OR keyword:' + g1 + ') AND (title:' + g2 + ' OR abstract:' + g2 + ' OR keyword:' + g2 + ') AND year_published:[2010 TO 2020]');
    eq(q('scholar', { field: 'title', yearFrom: 2010 }).text, 'title:' + g1 + ' AND title:' + g2 + ' AND year_published:[2010 TO *]');
    eq(q('linked', { yearFrom: 2010 }).text, g1 + ' AND ' + g2, 'years are chosen with the filter');
    eq(q('regional').text, g1 + ' AND (fertiliz$ OR "nitrogen fertilization")');
    deepEq([q('openapi').text, q('openapi').dropped], [g1 + ' AND "nitrogen fertilization"', 1]);
    deepEq([q('generic').text, q('generic').blocks], [g1 + ' AND "nitrogen fertilization"', 2]);
    deepEq(P().strategyQuery('openapi', [{ terms: ['fertiliz*'] }]), { text: 'fertiliz', blocks: 1, dropped: 0 }, 'only truncated terms: their stems');
    deepEq(P().strategyQuery('idxA', [{ include: false, terms: ['x'] }, { terms: [] }]), { text: '', blocks: 0, dropped: 0 });
    deepEq(P().STRATEGY_ENGINES, ['idxA', 'idxB', 'biomed', 'scholar', 'linked', 'regional', 'openapi', 'generic']);
  });
});

describe('keywords · screen', () => {
  const open = () => {
    I18N.setLang('es'); App.boot(el('app')); pjReset();
    ImportModule.tab = 'keywords';
    App.go('import'); App.render('import');
  };
  const type = (id, value) => { const n = el(id); n.value = value; n.dispatchEvent(new Event('input')); };
  const submit = () => el('kwForm').dispatchEvent(new Event('submit', { cancelable: true }));
  const TITLE = 'Efecto de la fertilización nitrogenada en el rendimiento del maracuyá en Veracruz';

  it('the tab comes first; the files tab links to it while there are no data', () => {
    I18N.setLang('es'); App.boot(el('app')); pjReset();
    App.go('import'); App.render('import');
    deepEq([...Layout.view.querySelectorAll('.tabs [role="tab"]')].map(b => b.id), ['tab-keywords', 'tab-files', 'tab-search']);
    eq(el('tab-files').getAttribute('aria-selected'), 'true', 'files is still the default tab');
    el('impKwLink').click();
    eq(ImportModule.tab, 'keywords'); ok(el('kwIdea'), 'the idea field is shown');
    el('tab-keywords').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    eq(ImportModule.tab, 'search', 'arrow keys go round the three tabs');
    pjReset();
  });

  it('criterion: from a title to concepts and a string per database; editing a concept changes every string', async () => {
    open();
    ok(!el('kwConcepts') && el('kwReminder'), 'before building only the idea and the reminder');
    submit();
    ok(el('kwMessage') && !el('kwMessage').hidden, 'an empty idea is reported');
    type('kwIdea', TITLE);
    type('kwFrom', '2015');
    submit();
    const s = ImportModule.kw;
    deepEq(s.blocks.map(b => b.label), ['fertilización nitrogenada', 'rendimiento', 'maracuyá', 'Veracruz']);
    eq(el('kwInc-3').checked, false, 'the place starts unchecked');
    ok(el('kwLang').textContent.includes('español'));
    const scopus = () => el('kwQ-idxA').textContent;
    eq(scopus(), 'TITLE-ABS-KEY(("nitrogen fertilization" OR "nitrogen fertilisation" OR "nitrogen fertilizer" OR "fertilización nitrogenada") AND (yield OR "crop yield" OR rendimiento) AND ("passion fruit" OR passionfruit OR "Passiflora edulis" OR maracuyá)) AND PUBYEAR > 2014');
    ok(el('kwQ-biomed').textContent.endsWith(' AND 2015:3000[dp]'), el('kwQ-biomed').textContent);
    ok(/caracteres/.test(el('kwMeta-idxA').textContent));
    const inc = el('kwInc-3'); inc.checked = true; inc.dispatchEvent(new Event('change'));
    ok(scopus().includes('AND (Veracruz OR Mexico)') || scopus().includes('AND Veracruz'), 'the place joins the string: ' + scopus());
    type('kwTerms-1', 'yield\nfruit yield');
    ok(scopus().includes('(yield OR "fruit yield")'), 'edited terms reach the string');
    ok(el('kwQ-openapi').textContent.includes('"fruit yield"'));
    const field = el('kwField'); field.value = 'title'; field.dispatchEvent(new Event('change'));
    ok(scopus().startsWith('TITLE((') && el('kwQ-biomed').textContent.includes('[ti]'), 'title only');
    /* merge, separate, remove and add */
    el('kwMerge-1').click();
    eq(ImportModule.kw.blocks.length, 3); eq(ImportModule.kw.blocks[0].label, 'fertilización nitrogenada / rendimiento');
    ok(!el('kwSplit-0').disabled);
    el('kwSplit-0').click();
    deepEq(ImportModule.kw.blocks.map(b => b.label), ['fertilización nitrogenada', 'rendimiento', 'maracuyá', 'Veracruz']);
    el('kwDel-3').click();
    eq(ImportModule.kw.blocks.length, 3);
    el('kwAdd').click();
    eq(document.activeElement && document.activeElement.id, 'kwTerms-3', 'the new concept is ready to type');
    type('kwTerms-3', 'greenhouse');
    ok(scopus().includes(' AND greenhouse) AND PUBYEAR > 2014'), scopus());
    /* many concepts */
    ['a', 'b'].forEach(x => { el('kwAdd').click(); type('kwTerms-' + (ImportModule.kw.blocks.length - 1), x); });
    ok(!el('kwTooMany').hidden, 'too many concepts joined with AND are warned');
    /* rebuilding asks before replacing edits */
    const confirm = window.confirm;
    let asked = 0;
    window.confirm = () => { asked++; return false; };
    try { submit(); } finally { window.confirm = confirm; }
    eq(asked, 1); eq(ImportModule.kw.blocks.length, 6, 'kept after saying no');
    pjReset();
  });

  it('copy, the open catalogue and the reminder of several files and formats', async () => {
    open();
    type('kwIdea', TITLE); type('kwFrom', '2015'); type('kwTo', '2025');
    submit();
    const clip = navigator.clipboard, copied = [];
    const toasts = [];
    const origToast = window.toast;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async x => { copied.push(x); } } });
    window.toast = (text, kind) => toasts.push([text, kind || '']);
    try {
      el('kwCopy-idxB').click();
      await tick(20);
      deepEq(copied, [el('kwQ-idxB').textContent]);
      deepEq(toasts, [['Cadena de Web of Science copiada.', '']]);
    } finally {
      window.toast = origToast;
      if (clip) Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clip }); else delete navigator.clipboard;
    }
    const reminder = el('kwReminder').textContent;
    ok(/varios archivos/.test(reminder) && ['CSV', 'RIS', 'BibTeX', '.nbib', 'Texto etiquetado'].every(x => reminder.includes(x)), reminder);
    const q = el('kwQ-openapi').textContent;
    el('kwToCatalogue').click();
    eq(ImportModule.tab, 'search');
    deepEq([el('searchTerms').value, el('searchYearFrom').value, el('searchYearTo').value], [q, '2015', '2025']);
    eq(document.activeElement && document.activeElement.id, 'searchTerms');
    SearchPanel.form = null;
    ImportModule.tab = 'keywords'; App.render('import');
    el('kwGoFiles').click();
    eq(ImportModule.tab, 'files');
    pjReset();
  });

  it('the concepts travel with the project; texts and helps in Spanish and English', async () => {
    open();
    type('kwIdea', TITLE); submit();
    const snap = JSON.parse(JSON.stringify(Project.snapshot().modules.import));
    deepEq([snap.tab, snap.kw.idea, snap.kw.blocks.length], ['keywords', TITLE, 4]);
    const texts = {};
    for (const lang of ['es', 'en']) {
      I18N.setLang(lang);
      App.render('import');
      texts[lang] = [el('kwIdeaCard').querySelector('h2').textContent, el('kwE-generic').querySelector('h3').textContent, el('kwReminder').querySelector('h3').textContent];
      ['idea', 'concepts', 'queries'].forEach(k => {
        const s = KeywordsPanel.help(k, 'x');
        ok(s.text.length > 30 && s.formula && s.interpretation, lang + ' help ' + k);
      });
    }
    deepEq(texts, { es: ['Prepara tu búsqueda', 'Otros buscadores', 'Puedes subir varios archivos a la vez'], en: ['Prepare your search', 'Other databases', 'You can upload several files at once'] });
    I18N.setLang('es');
    pjReset();
  });
});
