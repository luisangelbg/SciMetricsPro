/* Overview: indicators of a small collection computed by hand, growth rate, the screen and figure export. */
'use strict';

/* seven documents; every expected value below was worked out by hand from this list */
function overviewDataset() {
  const P = Parsers.lib();
  const rec = o => {
    const r = Object.assign(P.newRecord(), o);
    r.authors = (o.authors || []).map(a => P.person(a));
    r.authors.forEach((a, i) => { if (o.affs && o.affs[i]) a.affiliations = [].concat(o.affs[i]); });
    r.references = (o.refs || []).map(([raw, doi]) => Object.assign(P.newRef(raw), { doi: doi || '' }));
    delete r.affs; delete r.refs;
    return P.finish(r);
  };
  const MX = 'Instituto de Ecología, Xalapa, Mexico', US = 'University of California, Davis, USA';
  return [
    rec({ title: 'Morphological diversity of maize landraces in the highlands', year: 2020, sourceTitle: 'Econ Bot', timesCited: 10, docTypeRaw: 'Article',
      authors: ['Lira, R.', 'Cruz, A.'], affs: [MX, US], authorKeywords: ['maize', 'landraces'], indexKeywords: ['Zea mays'],
      refs: [['Smith J, 2001, Nature', '10.1000/x1'], ['Smith J., 2001. Nature 1:1', '10.1000/x1'], ['Lopez A, 1999, Agron J']] }),
    rec({ title: 'A review of seed conservation strategies for native crops', year: 2020, sourceTitle: 'ECON  BOT', timesCited: 0, docTypeRaw: 'Review',
      authors: ['Lira, R.'], affs: [MX], authorKeywords: ['Maize'], refs: [['Lopez A. 1999. Agron. J.']] }),
    rec({ title: 'Seed germination under drought in three bean cultivars', year: 2022, sourceTitle: 'Rev Mex', timesCited: null, docTypeRaw: 'Article',
      authors: ['Soto, B.', 'Ruiz, C.', 'Diaz, E.'], indexKeywords: ['Zea mays', 'Seeds'] }),
    rec({ title: 'Pollinator visits to squash flowers in two regions', year: 2023, sourceTitle: 'Rev Mex', timesCited: 4, docTypeRaw: 'Article',
      authors: ['Cruz, A.'], affs: [['Universidade de São Paulo, Brazil', 'Universidad de Buenos Aires, Argentina']], authorKeywords: ['corn'],
      refs: [['Perez B, 2010, Crop Sci'], ['Smith J, 2001, Nature']] }),
    rec({ title: 'Institutional report on genetic resources without a date', year: null, sourceTitle: '', timesCited: 2, docTypeRaw: '',
      affiliations: ['Instituto Nacional de Investigaciones, Mexico'] }),
    rec({ title: 'Soil microbial communities of traditional milpa systems', year: 2023, sourceTitle: 'Plant J', timesCited: 6, docTypeRaw: 'Article',
      authors: ['Gomez, F.'], affs: [US], authorKeywords: ['seed'] }),
    rec({ title: 'Chayote fruit quality after cold storage treatments', year: 2023, sourceTitle: 'Plant J', timesCited: null, docTypeRaw: 'Article',
      authors: ['Hernandez, G.', 'Lira, R.'], authorKeywords: ['Maize '] }),
  ];
}

describe('overview · indicators', () => {
  const P = () => Parsers.lib();

  it('annual growth rate: the published formula and its limits', () => {
    near(P().annualGrowthRate(10, 40, 11), (Math.pow(4, 1 / 10) - 1) * 100, 1e-12);
    near(P().annualGrowthRate(10, 40, 11), 14.869835499703509, 1e-9);
    eq(P().annualGrowthRate(5, 5, 1), null, 'one year');
    eq(P().annualGrowthRate(0, 5, 3), null, 'no documents in the first year');
    eq(P().annualGrowthRate(8, 2, 3), -50);
  });

  it('a seven-document collection gives the values worked out by hand', () => {
    const s = P().overview(overviewDataset(), { refYear: 2025 });
    deepEq(s.period, { from: 2020, to: 2023, years: 4 });
    eq(s.documents, 7); eq(s.noYear, 1);
    eq(s.sources, 3, 'Econ Bot = ECON  BOT, Rev Mex, Plant J');
    eq(s.authors, 7); eq(s.authorAppearances, 10); eq(s.docsWithAuthors, 6);
    near(s.authorsPerDoc, 10 / 6);
    eq(s.singleAuthoredDocs, 3); eq(s.singleAuthors, 3);
    near(s.growthRate, (Math.pow(3 / 2, 1 / 3) - 1) * 100, 1e-12);
    near(s.meanAge, 19 / 6);
    deepEq(s.citations, { total: 22, docs: 5, mean: 4.4 });
    eq(s.international.docs, 2); eq(s.international.withCountry, 5); near(s.international.share, 2 / 7);
    eq(s.authorKeywords, 4, 'maize, landraces, corn, seed');
    eq(s.indexKeywords, 2, 'zea mays, seeds');
    deepEq(s.references, { total: 6, distinct: 3, docs: 3 }, 'Smith 2001 with and without DOI is one work (same text as an occurrence with DOI)');
    deepEq(s.annual.map(a => [a.year, a.n, a.cumulative, a.citations, a.citedDocs, a.meanTC, a.citableYears]),
      [[2020, 2, 2, 10, 2, 5, 6], [2021, 0, 2, 0, 0, null, 5], [2022, 1, 3, 0, 0, null, 4], [2023, 3, 6, 10, 2, 5, 3]]);
    near(s.annual[0].meanTCperYear, 5 / 6); eq(s.annual[1].meanTCperYear, null); near(s.annual[3].meanTCperYear, 5 / 3);
    deepEq(s.docTypes.map(d => [d.type, d.n, d.citations, d.citedDocs, d.raw]), [['article', 5, 20, 3, ['Article']], ['other', 1, 2, 1, []], ['review', 1, 0, 1, ['Review']]]);
    near(s.docTypes[0].share, 5 / 7); near(s.docTypes[0].meanTC, 20 / 3);
  });

  it('synonyms and stop words change the keyword counts; the reference year changes age and citable years', () => {
    const data = overviewDataset();
    const s = P().overview(data, { refYear: 2030, dict: { synonyms: P().synonymMap([{ from: 'corn', to: 'maize' }]), stop: new Set(['seed']) } });
    eq(s.authorKeywords, 2, 'maize, landraces');
    near(s.meanAge, 49 / 6);
    eq(s.annual[0].citableYears, 11);
    eq(P().overview(data).refYear, new Date().getFullYear(), 'current year by default');
  });

  it('an empty collection and one without years or citations', () => {
    const e = P().overview([]);
    eq(e.period, null); eq(e.growthRate, null); eq(e.meanAge, null); eq(e.citations.mean, null); eq(e.international.share, null); deepEq(e.annual, []);
    const one = P().overview([overviewDataset()[4]]);
    eq(one.period, null); eq(one.noYear, 1); eq(one.authorsPerDoc, null); eq(one.citations.mean, 2);
  });
});

describe('overview · screen', () => {
  const card = key => el('ovCards').querySelector(`[data-key="${key}"]`);
  const value = key => card(key).querySelector('.metric-value').textContent;
  const sub = key => card(key).querySelector('.metric-sub').textContent;
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('countryAliases'); Prefs.del('institutionAliases'); Prefs.del('termField'); };

  it('cards show the hand-computed values, both charts and the document types', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    const records = overviewDataset();
    ImportModule.addResult({ name: 'overview.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    Pipeline.setReferenceYear(2025);
    App.render('overview');
    eq(el('ovCards').children.length, 13);
    deepEq(['period', 'documents', 'sources', 'authors', 'singleAuthors', 'growth', 'age', 'citations', 'coauthors', 'international', 'authorKeywords', 'indexKeywords', 'references'].map(value),
      ['2020–2023', '7', '3', '7', '3', '14.47 %', '3.17', '4.4', '1.67', '28.57 %', '4', '2', '6']);
    eq(sub('period'), '4 años · 1 documento sin año');
    eq(sub('citations'), '22 citas en 5 documentos con conteo');
    eq(sub('references'), '3 distintas · en 3 documentos');
    eq(sub('international'), '2 documentos · país reconocido en 5');

    const prod = el('ovProduction').querySelector('svg');
    ok(prod, 'production chart');
    eq(prod.querySelectorAll('[data-series="bars"] rect').length, 3, 'a bar per year with documents');
    ok(prod.querySelector('[data-series="line"] path').getAttribute('d').startsWith('M'), 'cumulative line');
    deepEq(OverviewModule.cc.ovProduction.dataMatrix(), [['Año', 'Documentos', 'Documentos acumulados'], [2020, 2, 2], [2021, 0, 2], [2022, 1, 3], [2023, 3, 6]]);
    const cit = OverviewModule.cc.ovCitations.dataMatrix();
    deepEq(cit[0], ['Año', 'Documentos', 'Documentos con número de citas', 'Citas', 'Citas promedio por documento', 'Años citables', 'Citas promedio por año citable']);
    deepEq(cit[1].slice(0, 6), [2020, 2, 2, 10, 5, 6]);
    eq(cit[2][4], '', 'no citation count in 2021');
    eq(el('ovCitations').querySelectorAll('[data-series="bars"] rect').length, 2);

    const rows = [...el('ovTypes').querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent));
    deepEq(rows.map(r => r.slice(0, 4)), [['Artículo', '5', '71.4 %', '6.67'], ['Otro', '1', '14.3 %', '2'], ['Revisión', '1', '14.3 %', '0']]);
    eq(el('view').querySelectorAll('.overview-page .help-btn').length, 16, '13 cards, 2 charts, 1 table');
  });

  it('every help has a definition, a formula and the reference', () => {
    const buttons = [...el('view').querySelectorAll('.overview-page .help-btn')];
    const bad = [];
    buttons.forEach((b, i) => {
      b.click();
      const pop = document.querySelector('.help-pop');
      if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs').textContent.includes('Journal of Informetrics, 11(4), 959–975') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(i);
      HelpPopover.close();
    });
    deepEq(bad, []);
  });

  it('no visible text outside the dictionaries (data labels aside), in both languages', () => {
    const problems = [];
    ['es', 'en'].forEach(lang => {
      I18N.setLang(lang);
      /* the figure engine writes its own labels in English (their Spanish is in `phrases`) */
      const engine = s => lang === 'en' && typeof I18N_DICT.es.phrases[s] === 'string';
      strayTexts(el('view'), lang).filter(s => !['Article', 'Review'].includes(s) && !engine(s)).forEach(s => problems.push(lang + ': ' + s));
    });
    I18N.setLang('es');
    deepEq(problems, []);
  });

  it('the reference year and the filters recompute the page', async () => {
    const y = el('ovRefYear');
    y.value = '2030'; y.dispatchEvent(new Event('change'));
    eq(value('age'), '8.17');
    eq(sub('age'), 'años, respecto a 2030');
    await Pipeline.update({ filters: Object.assign(Parsers.lib().emptyFilters(), { docTypes: ['review'] }) });
    eq(el('ovFiltered').textContent, 'Los indicadores usan el único documento que cumple los filtros (de 7).');
    eq(value('documents'), '1'); eq(value('growth'), '—'); eq(sub('growth'), 'requiere un periodo de al menos dos años');
    await Pipeline.update({ filters: Object.assign(Parsers.lib().emptyFilters(), { docTypes: ['letter'] }) });
    eq(el('view').querySelector('.empty-title').textContent, 'Ningún documento cumple los filtros');
    await Pipeline.update({ filters: Parsers.lib().emptyFilters() });
    Pipeline.setReferenceYear(2025);
    eq(value('documents'), '7');
  });

  it('criterion: both charts export to PNG (300 dpi) and SVG', async () => {
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    try {
      for (const id of ['ovProduction', 'ovCitations']) {
        const buttons = OverviewModule.cc[id].el.querySelectorAll('.chart-actions button');
        buttons[0].click();   // PNG
        buttons[1].click();   // SVG
      }
      for (let i = 0; i < 100 && got.length < 4; i++) await tick(30);
    } finally { window.download = saved; }
    eq(got.length, 4, 'four files');
    const png = got.filter(g => g.name.endsWith('.png')), svg = got.filter(g => g.name.endsWith('.svg'));
    deepEq(png.map(g => g.name).sort(), ['Citas_promedio_por_anio.png', 'Produccion_cientifica_anual.png']);
    for (const g of png) {
      const b = new Uint8Array(await g.blob.arrayBuffer());
      eq(String.fromCharCode(b[1], b[2], b[3]), 'PNG');
      let ppm = null;
      for (let i = 8; i < b.length - 12; i++) if (b[i] === 0x70 && b[i + 1] === 0x48 && b[i + 2] === 0x59 && b[i + 3] === 0x73) { ppm = (b[i + 4] << 24 | b[i + 5] << 16 | b[i + 6] << 8 | b[i + 7]) >>> 0; break; }
      eq(ppm, 11811, g.name + ' at 300 dpi');
    }
    for (const g of svg) {
      const text = await g.blob.text();
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      ok(!doc.querySelector('parsererror'), g.name + ' parses');
      ok(doc.documentElement.querySelectorAll('rect').length > 2 && doc.documentElement.querySelector('path'), g.name + ' has bars and the line');
    }
    reset();
    await Pipeline.pending;
  });
});
