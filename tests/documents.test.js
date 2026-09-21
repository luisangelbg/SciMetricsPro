/* Documents: most cited documents, local citations, reference clusters, RPYS, word frequencies, growth,
   trend topics, the squarified treemap, the word cloud layout, the screen and figure export. */
'use strict';

/* six documents that cite each other; every expected value below was worked out by hand */
function documentsDataset() {
  const P = Parsers.lib();
  const rec = o => {
    const r = Object.assign(P.newRecord(), o);
    r.authors = o.authors.map(a => P.person(a));
    r.references = [].concat((o.refsB || []).map(P.parseRefB), (o.refsA || []).map(P.parseRefA), (o.refsRaw || []).map(P.newRef));
    delete r.refsB; delete r.refsA; delete r.refsRaw;
    return P.finish(r);
  };
  return [
    rec({ title: 'Maize landraces of the central highlands', authors: ['Lira, R.', 'Cruz, A.'], year: 2015, sourceTitle: 'Economic Botany', sourceAbbrev: 'Econ. Bot.', volume: '69', pages: '120-130', doi: '10.1000/eb.1', accession: 'W999', timesCited: 30, docTypeRaw: 'Article', authorKeywords: ['maize', 'landraces'] }),
    rec({ title: 'Genetic diversity of native maize populations', authors: ['Soto, B.'], year: 2016, sourceTitle: 'Genetic Resources and Crop Evolution', sourceAbbrev: 'Genet. Resour. Crop Evol.', volume: '63', pages: '45-60', timesCited: 12, docTypeRaw: 'Article', authorKeywords: ['maize', 'diversity'],
      refsB: ['Lira R, 2015, ECON BOT, V69, P120, DOI 10.1000/EB.1', 'Garcia M, 1990, J ECOL, V10, P5', 'Lira R, 2015, ECON BOT, V69, P120'] }),
    rec({ title: 'Seed banks for squash conservation', authors: ['Cruz, A.', 'Lira, R.'], year: 2018, sourceTitle: 'Economic Botany', sourceAbbrev: 'Econ. Bot.', volume: '72', pages: '1-10', doi: '10.1000/eb.2', timesCited: 5, docTypeRaw: 'Article', authorKeywords: ['landraces', 'seed banks'],
      refsA: ['Lira R., Cruz A., Maize landraces of the highlands, Economic Botany, 69, pp. 120-130, (2015)', 'Soto B., Diversity of maize, Genet. Resour. Crop Evol., 63, pp. 45-60, (2016)', 'Garcia M., Title, Journal of Ecology, 10, pp. 5-9, (1990)'] }),
    rec({ title: 'Chayote fruit morphology in Veracruz markets', authors: ['Lira, R.'], year: 2018, sourceTitle: 'Economic Botany', volume: '72', pages: '50-60', timesCited: 0, docTypeRaw: 'Article', authorKeywords: ['maize'] }),
    rec({ title: 'Ethnobotany of wild tomatoes in Oaxaca', authors: ['Lira, R.'], year: 2018, sourceTitle: 'Econ Bot', volume: '72', pages: '200-210', timesCited: 0, docTypeRaw: 'Article', authorKeywords: ['seed banks'],
      refsB: ['Lira R, 2018, ECON BOT', 'Lira R, 2018, ECON BOT, V72, P50', 'Cruz A, 2018, ECON BOT, V72, P1, DOI 10.1000/eb.2'] }),
    rec({ title: 'Pollinators of squash flowers in two regions', authors: ['Diaz, C.'], year: 2020, sourceTitle: 'Plant J', timesCited: null, docTypeRaw: 'Article', authorKeywords: ['seed banks', 'maize'],
      refsRaw: ['W999'], refsB: ['Lira R, 2015, J ECOL, V70, P9', 'Soto B, 2016, GENET RESOUR CROP EV, V63, P45'] }),
  ];
}

describe('documents · indicators', () => {
  const P = () => Parsers.lib();

  it('surnames of cited first authors and compatible source names', () => {
    const s = n => P().refSurname(n);
    deepEq(['Smith JA', 'SMITH J', 'Toledo V.M.', 'Toledo V. M.', 'de la Cruz M.', 'Garcia-Oliva F.', 'LI J', 'Smith, J.', 'Cadena-Iñiguez J.', '[Anonymous]', 'Aguirre-Medina J. F.'].map(s),
      ['smith', 'smith', 'toledo', 'toledo', 'delacruz', 'garciaoliva', 'li', 'smith', 'cadenainiguez', '', 'aguirremedina']);
    const m = (a, b) => P().sourceWordsMatch(P().sourceWords(a), P().sourceWords(b));
    ok(m('J Ecol', 'Journal of Ecology'), 'abbreviation of the full title');
    ok(m('J. Ecol.', 'J ECOL'), 'two abbreviation styles');
    ok(m('GENET RESOUR CROP EV', 'Genetic Resources and Crop Evolution'), 'truncated abbreviation');
    ok(m('Proc Natl Acad Sci', 'Proceedings of the National Academy of Sciences'), 'contraction');
    ok(m('PhytoKeys', 'Phyto Keys'), 'spaces');
    ok(!m('J Ecol', 'J Econ'), 'different journals');
    ok(!m('Phys Rev E', 'Physical Review B'), 'a final letter is kept');
    ok(!m('Plant Cell', 'Plant Cell and Environment'), 'another journal with more words');
  });

  it('most cited documents: citations per year and normalised by the mean of their year', () => {
    const c = P().citedDocuments(documentsDataset(), { refYear: 2025 });
    eq(c.total, 47); eq(c.withCitations, 5);
    deepEq(c.rows.map(r => [r.index, r.citations, r.rank]), [[0, 30, 1], [1, 12, 2], [2, 5, 3], [3, 0, 4], [4, 0, 5]]);
    near(c.rows[0].perYear, 30 / 11); near(c.rows[2].perYear, 5 / 8);
    near(c.rows[0].normalized, 1); near(c.rows[2].normalized, 3, 1e-12, '5 / mean(5, 0, 0)'); eq(c.rows[3].normalized, 0);
    eq(c.rows[0].label, 'Lira R., 2015, Econ. Bot.');
  });

  it('local citations: DOI, catalogue identifier, author + year + source, ambiguity and contradicting pages', () => {
    const recs = documentsDataset();
    const lc = P().localCitations(recs);
    deepEq(lc.local, [3, 2, 1, 1, 0, 0]);
    deepEq(lc.citedBy.map(c => c.slice().sort()), [[1, 2, 5], [2, 5], [4], [4], [], []]);
    deepEq(lc.stats, { references: 12, matched: 8, byDoi: 2, byId: 1, byBib: 5, ambiguous: 1, self: 0, citingDocs: 4, citedDocs: 4, links: 7 });
    const rows = P().localCitationTable(recs, lc);
    deepEq(rows.map(r => [r.index, r.local, r.global, r.localReferences, r.exceeds]),
      [[0, 3, 30, 0, false], [1, 2, 12, 1, false], [2, 1, 5, 2, false], [3, 1, 0, 0, true], [4, 0, 0, 2, false], [5, 0, null, 2, false]]);
    near(rows[0].ratio, 0.1); eq(rows[3].ratio, null, 'no ratio without total citations');
    ok(rows.filter(r => r.global != null && !r.exceeds).every(r => r.local <= r.global), 'criterion: local ≤ total');
  });

  it('local citations: the title written in a reference, pages that disagree and one-letter typos in surnames', () => {
    const P2 = P();
    const rec = (o, refsA, refsB) => {
      const r = Object.assign(P2.newRecord(), o, { authors: o.authors.map(a => P2.person(a)) });
      r.references = (refsA || []).map(P2.parseRefA).concat((refsB || []).map(P2.parseRefB));
      return P2.finish(r);
    };
    const recs = [
      rec({ title: 'Wild relatives of squash in western Mexico; [Parientes silvestres de la calabaza en el occidente de México]', authors: ['Hernandez-Xolocotzi, E.'], year: 2012, sourceTitle: 'Botanical Sciences', volume: '90', pages: '340-352' }),
      rec({ title: 'A', authors: ['Uno, A.'], year: 2020 }, ['Hernandez-Xolocotzi E., Wild relatives of squash in western Mexico, Bot Sci, 90, pp. 302-314, (2012)']),
      rec({ title: 'B', authors: ['Dos, B.'], year: 2020 }, ['Hernandez-Xolocotz E., Wild relatives of squash in western Mexico, Botanical Sciences, 90, (2012)']),
      rec({ title: 'C', authors: ['Tres, C.'], year: 2020 }, [], ['Hernandez-Xolocotzi E, 2012, BOT SCI, V90, P302', 'Hernandez X E, 2012, BOT SCI, V90']),
      rec({ title: 'D', authors: ['Cuatro, D.'], year: 2020 }, [], ['Hernandez-Xolocotz E, 2012, BOT SCI, V90']),
    ];
    eq(P2.titleProbe(recs[0].title), 'wild relatives of squash in western mexico', 'first language of a bilingual title');
    eq(P2.titleProbe('Short title'), '', 'too short to be telling');
    ok(P2.withinOneEdit('hernandezxolocotzi', 'hernandezxolocotz') && P2.withinOneEdit('lopez', 'lopes') && !P2.withinOneEdit('lopez', 'lopezz1'), 'one edit');
    const lc = P2.localCitations(recs);
    deepEq(lc.citedBy[0], [1, 2, 4], 'title despite other pages · title despite a typo · typo with source and volume; not a page that disagrees without title');
    eq(lc.stats.matched, 3);
  });

  it('cited references: occurrences of the same work are joined by DOI, author-year-volume-page, text and local match', () => {
    const recs = documentsDataset();
    const lc = P().localCitations(recs);
    const cl = P().referenceClusters(recs, { refDoc: lc.refDoc });
    eq(cl.total, 12); eq(cl.docs, 4); eq(cl.rows.length, 7);
    deepEq(cl.rows.map(r => [r.citations, r.occurrences, r.year, r.local]), [[3, 4, 2015, 0], [2, 2, 1990, -1], [2, 2, 2016, 1], [1, 1, 2018, 2], [1, 1, 2015, -1], [1, 1, 2018, -1], [1, 1, 2018, 3]]);
    eq(cl.rows[0].label, 'Lira R., Cruz A., Maize landraces of the highlands, Economic Botany, 69, pp. 120-130, (2015)', 'longest of the equally frequent spellings');
    eq(cl.rows[0].doi, '10.1000/eb.1');
    eq(P().referenceShort(cl.rows[0]), 'Lira R., 2015, Economic Botany');
    deepEq([cl.rows[0].volume, cl.rows[0].page], ['69', '120'], 'volume and first page kept for the short names');
    /* two works of one author in the same journal and year get their volume and page; the others stay short */
    const small = [
      { firstAuthor: 'SMALL H', year: 1985, source: 'SCIENTOMETRICS', volume: '7', page: '391' },
      { firstAuthor: 'SMALL H', year: 1985, source: 'SCIENTOMETRICS', volume: '8', page: '321' },
      { firstAuthor: 'SMALL H', year: 1973, source: 'J AM SOC INFORM SCI', volume: '24', page: '265' },
      { firstAuthor: 'KESSLER MM', year: 1963, source: 'AM DOC', volume: '', page: '', doi: '10.1002/asi.1' },
      { firstAuthor: 'KESSLER MM', year: 1963, source: 'AM DOC', volume: '', page: '', doi: '10.1002/asi.2' },
    ];
    deepEq(P().referenceShortList(small, 90), ['SMALL H, 1985, SCIENTOMETRICS, 7:391', 'SMALL H, 1985, SCIENTOMETRICS, 8:321', 'SMALL H, 1973, J AM SOC INFORM SCI', 'KESSLER MM, 1963, AM DOC, 10.1002/asi.1', 'KESSLER MM, 1963, AM DOC, 10.1002/asi.2']);
    eq(P().referenceShortList(small, 20)[0], 'SMALL H, 1985, SCIE…', 'cut at the maximum length');
    eq(P().referenceClusters(recs).rows.length, 8, 'without local matches the catalogue identifier W999 stays apart');
    eq(P().distinctReferences(recs), 7, 'local matches found on the way');
  });

  it('RPYS: counts per reference year, deviation from the 5-year median and peaks', () => {
    const recs = documentsDataset();
    const cl = P().referenceClusters(recs);
    const R = P().rpys(recs, { clusters: cl, from: 2012, to: 2018 });
    eq(R.withYear, 11); eq(R.total, 12); eq(R.minYear, 1990); eq(R.maxYear, 2018);
    deepEq(R.rows.map(r => [r.year, r.n, r.median, r.deviation]), [[2012, 0, 0, 0], [2013, 0, 0, 0], [2014, 0, 0, 0], [2015, 4, 0, 4], [2016, 2, 2, 0], [2017, 0, 2, -2], [2018, 3, 0, 3]]);
    deepEq(R.peaks.map(p => p.year), [2015, 2018]);
    deepEq(R.peaks[1].top.map(x => x.label), ['Cruz A, 2018, ECON BOT, V72, P1, DOI 10.1000/eb.2', 'Lira R, 2018, ECON BOT', 'Lira R, 2018, ECON BOT, V72, P50']);
    deepEq(P().rpys(recs, { clusters: cl }).peaks.map(p => [p.year, p.deviation]), [[2015, 4], [2018, 3], [1990, 2]]);
    eq(P().median([3, 1, 2]), 2); eq(P().median([4, 1, 2, 3]), 2.5); eq(P().median([]), null);
    eq(P().rpys([documentsDataset()[0]]).rows.length, 0, 'no references');
  });

  it('type 7 quantiles, word growth and trend topics', () => {
    const q = P().quantile7;
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    near(q(x, 0.25), 3.25); near(q(x, 0.5), 5.5); near(q(x, 0.9), 9.1); eq(q([7], 0.75), 7); eq(q([], 0.5), null);
    const recs = documentsDataset();
    const dict = { synonyms: new Map(), stop: new Set() };
    const lists = recs.map(r => P().termsOf(r, 'authorKeywords', dict));
    deepEq(P().termCounts(recs, 'authorKeywords', dict, lists).map(c => [c.term, c.docs]), [['maize', 4], ['seed banks', 3], ['landraces', 2], ['diversity', 1]]);
    const G = P().termGrowth(recs, lists, ['maize', 'seed banks']);
    deepEq(G.years, [2015, 2016, 2017, 2018, 2019, 2020]);
    deepEq(G.series[0].cumulative, [1, 2, 2, 3, 3, 4]); deepEq(G.series[1].annual, [0, 0, 0, 2, 0, 1]);
    const T = P().trendTopics(recs, lists, { minFreq: 2, perYear: 3 });
    deepEq(T.terms.map(t => [t.key, t.freq, t.q1, t.median, t.q3]), [['landraces', 2, 2015.75, 2016.5, 2017.25], ['maize', 4, 2015.75, 2017, 2018.5], ['seed banks', 3, 2018, 2018, 2019]]);
    deepEq(T.selected.map(t => t.key), ['landraces', 'maize', 'seed banks']);
    deepEq(P().trendTopics(recs, lists, { minFreq: 2, perYear: 1 }).selected.map(t => t.key), ['maize', 'seed banks'], 'the most frequent term of each rounded median year');
  });

  it('squarified treemap: the layout worked out by hand from the published algorithm', () => {
    const r = P().squarify([6, 6, 4, 3, 2, 2, 1], 0, 0, 6, 4);
    const exp = [[0, 0, 3, 2], [0, 2, 3, 2], [3, 0, 12 / 7, 7 / 3], [3 + 12 / 7, 0, 9 / 7, 7 / 3], [3, 7 / 3, 1.2, 5 / 3], [4.2, 7 / 3, 1.2, 5 / 3], [5.4, 7 / 3, 0.6, 5 / 3]];
    exp.forEach((e, i) => ['x', 'y', 'w', 'h'].forEach((k, j) => near(r[i][k], e[j], 1e-9, i + k)));
    /* random values: areas in proportion, inside the rectangle, no overlaps */
    const rand = rng(2000), vals = Array.from({ length: 40 }, () => 1 + Math.floor(rand() * 50)).sort((a, b) => b - a);
    const R = P().squarify(vals, 10, 20, 500, 300);
    const sum = vals.reduce((s, v) => s + v, 0);
    let bad = 0;
    R.forEach((q, i) => {
      if (Math.abs(q.w * q.h - vals[i] / sum * 150000) > 1e-6) bad++;
      if (q.x < 10 - 1e-9 || q.y < 20 - 1e-9 || q.x + q.w > 510 + 1e-9 || q.y + q.h > 320 + 1e-9) bad++;
      for (let j = 0; j < i; j++) { const p = R[j]; if (Math.min(q.x + q.w, p.x + p.w) - Math.max(q.x, p.x) > 1e-6 && Math.min(q.y + q.h, p.y + p.h) - Math.max(q.y, p.y) > 1e-6) bad++; }
    });
    eq(bad, 0);
  });

  it('word cloud layout: words inside the frame, without overlaps, larger words first', () => {
    const words = Array.from({ length: 80 }, (x, i) => ({ label: 'term' + i + (i % 3 ? ' pair' : ''), value: 200 - i * 2 }));
    const L = Charts.cloudLayout(words, { x0: 10, y0: 40, x1: 910, y1: 590 }, { minFont: 10, maxFont: 54, rotate: 'some', measure: (s, size) => s.length * size * 0.6 });
    eq(L.placed.length + L.dropped, 80);
    ok(L.placed.length >= 70, 'most words placed: ' + L.placed.length);
    let bad = 0;
    L.placed.forEach((p, i) => {
      const b = p.box;
      if (b[0] < 10 || b[1] < 40 || b[2] > 910 || b[3] > 590) bad++;
      for (let j = 0; j < i; j++) { const q = L.placed[j].box; if (b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]) bad++; }
      if (i && p.size > L.placed[i - 1].size + 1e-9) bad++;
    });
    eq(bad, 0);
    ok(L.placed.some(p => p.rotate), 'some vertical words');
    near(L.placed[0].x, 460, 1e-9, 'the most frequent word in the centre');
  });
});

describe('documents · screen', () => {
  const card = key => el('dcCards').querySelector(`[data-key="${key}"]`);
  const value = key => card(key).querySelector('.metric-value').textContent;
  const sub = key => card(key).querySelector('.metric-sub').textContent;
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('countryAliases'); Prefs.del('institutionAliases'); Prefs.del('termField'); };
  const tab = id => { DocumentsModule.tab = id; App.render('documents'); };
  const change = (id, v) => { const s = el(id); s.value = String(v); s.dispatchEvent(new Event('change')); };

  it('cards', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    DocumentsModule.ui = null;
    const records = documentsDataset();
    ImportModule.addResult({ name: 'documents.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    Pipeline.setReferenceYear(2025);
    eq(Pipeline.records().length, 6, 'no duplicates merged');
    tab('cited');
    deepEq(['citations', 'topCited', 'local', 'references', 'rpysPeak', 'terms'].map(value), ['47', '30', '7', '7', '2015', '4']);
    eq(sub('topCited'), 'Lira R., 2015, Econ. Bot.');
    eq(sub('local'), '4 documentos citados dentro del conjunto');
    eq(sub('references'), '12 citas en 4 documentos');
    eq(sub('rpysPeak'), 'Lira R., 2015, Economic Botany');
    eq(sub('terms'), 'Campo: Palabras clave de autor');
  });

  it('large sets: the references are computed in a worker, the screens wait and get the same values', async () => {
    const limit = Pipeline.REF_INLINE_LIMIT;
    Pipeline.REF_INLINE_LIMIT = 0; Pipeline._refs = null;
    let fn;
    try {
      const ready = new Promise(resolve => { fn = on('refsready', resolve); });
      tab('cited');
      ok(el('dcPending'), 'waiting note');
      ok(!el('dcCards'), 'no cards yet');
      const d = await ready;
      ok(d && d.clusters && !d.lc.refDoc, 'plain data from the worker');
      deepEq(['citations', 'topCited', 'local', 'references', 'rpysPeak', 'terms'].map(value), ['47', '30', '7', '7', '2015', '4']);
      eq(sub('local'), '4 documentos citados dentro del conjunto');
      App.render('overview');
      ok(el('ovCards').querySelector('[data-key="references"] .metric-sub').textContent.startsWith('7 distintas'), 'the overview uses the same count');
    } finally {
      off('refsready', fn);
      Pipeline.REF_INLINE_LIMIT = limit; Pipeline._refs = null;
    }
  });

  it('most cited documents by total, per year and normalised citations', () => {
    tab('cited');
    deepEq(DocumentsModule.cc.dcTop.dataMatrix().slice(1).map(r => [r[0], r[3]]), [['Lira R., 2015, Econ. Bot.', 30], ['Soto B., 2016, Genet. Resour. Crop Evol.', 12], ['Cruz A., 2018, Econ. Bot.', 5], ['Lira R., 2018, Economic Botany', 0], ['Lira R., 2018, Econ Bot', 0]]);
    change('dcCitedMeasure', 'normalized');
    deepEq(DocumentsModule.cc.dcTop.dataMatrix().slice(1).map(r => r[0]), ['Cruz A., 2018, Econ. Bot.', 'Lira R., 2015, Econ. Bot.', 'Soto B., 2016, Genet. Resour. Crop Evol.', 'Lira R., 2018, Economic Botany', 'Lira R., 2018, Econ Bot']);
    change('dcCitedMeasure', 'citations');
    eq(el('dcCitedTable').querySelectorAll('tbody tr').length, 5);
    ok(el('dcCitedTable').textContent.includes('1 documento no trae número de citas'), 'hint');
  });

  it('local citations: matching summary, the ▲ warning and the table', () => {
    tab('local');
    ok(el('dcMatchInfo').textContent === ('Referencias emparejadas con documentos del conjunto: 8 de 12; 2 por DOI, 1 por identificador del catálogo y 5 por primer autor y año (con fuente, páginas o título). 1 referencia ambigua no se contó.'), el('dcMatchInfo').textContent);
    ok(el('dcExceeds').textContent.startsWith('1 documento tiene más citas locales'), 'exceeds warning');
    deepEq(DocumentsModule.cc.dcLocal.dataMatrix().slice(1).map(r => [r[0], r[2], r[3]]), [['Lira R., 2015, Econ. Bot.', 3, 30], ['Soto B., 2016, Genet. Resour. Crop Evol.', 2, 12], ['Cruz A., 2018, Econ. Bot.', 1, 5], ['Lira R., 2018, Economic Botany', 1, 0]]);
    const first = [...el('dcLocalTable').querySelector('tbody tr').children].map(td => td.textContent);
    deepEq([first[4], first[5], first[6], first[7]], ['3', '30', '10 %', '0']);
    ok(el('dcLocalTable').textContent.includes('▲'), 'the document above its total is marked');
  });

  it('most cited references and RPYS with its peaks and year range', () => {
    tab('references');
    const m = DocumentsModule.cc.dcRefs.dataMatrix();
    deepEq(m[1].slice(1, 4), [2015, 3, 4]);
    eq(el('dcRefTable').querySelectorAll('tbody tr').length, 7);
    tab('rpys');
    eq(el('dcRpys').querySelectorAll('[data-series="bars"] rect').length, 4, '1990, 2015, 2016, 2018');
    deepEq([...el('dcRpys').querySelectorAll('[data-peaks] circle')].map(c => c.getAttribute('data-year')), ['2015', '2018', '1990']);
    ok(el('dcRpys').querySelector('svg').textContent.includes('Lira R., 2015, Economic Botany'), 'peak note');
    eq(el('dcPeaks').querySelectorAll('tbody tr').length, 3);
    change('dcRpysFrom', 2012);
    eq(el('dcRpysTable').querySelectorAll('tbody tr').length, 7);
    eq(el('dcRpysFrom').value, '2012');
    el('dcRpysReset').click();
    eq(el('dcRpysTable').querySelectorAll('tbody tr').length, 25, 'first page of 29 years');
  });

  it('frequent words as bars, cloud and treemap; growth and trend topics', async () => {
    tab('words');
    deepEq(DocumentsModule.cc.dcWordBars.dataMatrix().slice(1), [['maize', 4], ['seed banks', 3], ['landraces', 2], ['diversity', 1]]);
    change('dcWordsView', 'cloud');
    eq(el('dcCloud').querySelectorAll('text[data-word]').length, 4);
    change('dcWordsView', 'treemap');
    eq(el('dcTreemap').querySelectorAll('rect[data-term]').length, 4);
    change('dcWordsView', 'bars');
    tab('growth');
    deepEq(DocumentsModule.cc.dcGrowth.dataMatrix().find(r => r[0] === 2018), [2018, 3, 2, 2, 1]);
    tab('trends');
    change('dcTrendMin', 2);
    deepEq(DocumentsModule.cc.dcTrends.dataMatrix().slice(1).map(r => [r[0], r[1], r[3], r[4], r[5]]), [['landraces', 2, 2015.75, 2016.5, 2017.25], ['maize', 4, 2015.75, 2017, 2018.5], ['seed banks', 3, 2018, 2018, 2019]]);
    eq(el('dcTrends').querySelectorAll('[data-series="medians"] circle').length, 3);
    change('dcField', 'indexKeywords');
    await Pipeline.pending;
    ok(el('dcNoTerms'), 'no index keywords in these documents');
    eq(value('terms'), '—');
    change('dcField', 'authorKeywords');
    await Pipeline.pending;
    ok(!el('dcNoTerms'), 'back to author keywords');
  });

  it('every help has a definition, a formula and its reference; no visible text outside the dictionaries', () => {
    const P = Parsers.lib();
    const data = new Set();
    const recs = Pipeline.records();
    recs.forEach(r => { data.add(P.documentLabel(r)); data.add(r.title); if (r.doi) data.add(r.doi); });
    const cl = P.referenceClusters(recs);
    cl.rows.forEach(r => { data.add(r.label); data.add(P.referenceShort(r, 200)); if (r.doi) data.add(r.doi); });
    ['maize', 'seed banks', 'landraces', 'diversity'].forEach(s => data.add(s));
    const dataLike = s => [...data].some(d => s.includes(d) || d.startsWith(s.replace(/…$/, '')));
    const problems = [], bad = [];
    DocumentsModule.TABS.forEach(id => {
      ['es', 'en'].forEach(lang => {
        I18N.setLang(lang); tab(id);
        const engine = s => lang === 'en' && typeof I18N_DICT.es.phrases[s] === 'string';
        strayTexts(el('view'), lang).filter(s => !data.has(s) && !engine(s) && !dataLike(s) && !/^Q[13] [\d.]+/.test(s)).forEach(s => problems.push(lang + ' ' + id + ': ' + s));
      });
      I18N.setLang('es'); tab(id);
      [...el('view').querySelectorAll('.documents-page .help-btn')].forEach((b, i) => {
        b.click();
        const pop = document.querySelector('.help-pop');
        if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(id + ' #' + i);
        HelpPopover.close();
      });
    });
    ['cloud', 'treemap'].forEach(view => {
      DocumentsModule.ui.wordsView = view; tab('words');
      [...el('view').querySelectorAll('.chart-card .help-btn')].forEach((b, i) => {
        b.click();
        const pop = document.querySelector('.help-pop');
        if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li')) bad.push(view + ' #' + i);
        HelpPopover.close();
      });
    });
    DocumentsModule.ui.wordsView = 'bars';
    deepEq({ problems, bad }, { problems: [], bad: [] });
  });

  it('criterion: the new figures export to PNG (300 dpi) and SVG', async () => {
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    const charts = [['rpys', 'dcRpys', null], ['words', 'dcCloud', 'cloud'], ['words', 'dcTreemap', 'treemap'], ['trends', 'dcTrends', null]];
    try {
      for (let k = 0; k < charts.length; k++) {
        if (charts[k][2]) DocumentsModule.ui.wordsView = charts[k][2];
        tab(charts[k][0]);
        const buttons = DocumentsModule.cc[charts[k][1]].el.querySelectorAll('.chart-actions button');
        buttons[0].click(); buttons[1].click();
        for (let i = 0; i < 150 && got.length < 2 * (k + 1); i++) await tick(30);
      }
    } finally { window.download = saved; DocumentsModule.ui.wordsView = 'bars'; }
    eq(got.length, 8, 'eight files');
    for (const g of got.filter(x => x.name.endsWith('.png'))) {
      const b = new Uint8Array(await g.blob.arrayBuffer());
      let ppm = null;
      for (let i = 8; i < b.length - 12; i++) if (b[i] === 0x70 && b[i + 1] === 0x48 && b[i + 2] === 0x59 && b[i + 3] === 0x73) { ppm = (b[i + 4] << 24 | b[i + 5] << 16 | b[i + 6] << 8 | b[i + 7]) >>> 0; break; }
      eq(ppm, 11811, g.name);
    }
    for (const g of got.filter(x => x.name.endsWith('.svg'))) {
      const doc = new DOMParser().parseFromString(await g.blob.text(), 'image/svg+xml');
      ok(!doc.querySelector('parsererror'), g.name + ' parses');
    }
    reset();
    await Pipeline.pending;
  });
});
