/* Sources: identity and ISSN merging, h/g/m indices, Bradford zones, dynamics, the screen and figure export. */
'use strict';

/* thirteen documents in five sources (plus one without source); expected values worked out by hand */
function sourcesDataset() {
  const P = Parsers.lib();
  const rec = (title, sourceTitle, year, timesCited, issn) => P.finish(Object.assign(P.newRecord(), { title, sourceTitle, year, timesCited, issn: issn ? [issn] : [], docTypeRaw: 'Article', authors: [P.person('Lira, R.')] }));
  return [
    rec('Seed banks of wild squash in western Mexico', 'Genetic Resources and Crop Evolution', 2015, 10, '0925-9864'),
    rec('Morphology of chayote fruits from Veracruz', 'Genetic Resources and Crop Evolution', 2018, 6, '0925-9864'),
    rec('Diversity of runner bean landraces in Puebla', 'GENETIC RESOURCES AND CROP EVOLUTION', 2020, 3, '09259864'),
    rec('Maize races of the central highlands revisited', 'Genetic Resources and Crop Evolution', 2022, 0, null),
    rec('Yield of tomato hybrids under shade nets', 'Rev. Fitotec. Mex.', 2019, 4, '01877380'),
    rec('Nitrogen fertilization of husk tomato crops', 'Revista Fitotecnia Mexicana', 2021, 2, '0187-7380'),
    rec('Heat tolerance of common bean cultivars', 'Revista Fitotecnia Mexicana', 2023, null, '0187-7380'),
    rec('Uses of wild plants in Oaxacan markets', 'Economic Botany', 2010, 25, '0013-0001'),
    rec('Trade of medicinal herbs along the Gulf coast', 'Economic Botany', 2016, 1, '0013-0001'),
    rec('Traditional knowledge of edible insects in Hidalgo', 'Journal of Ethnobiology & Ethnomedicine', 2017, 8, null),
    rec('Ethnobotany of cactus fruits in the Bajio region', 'Journal of Ethnobiology and Ethnomedicine', 2024, 8, null),
    rec('Leaf proteome of avocado under drought', 'Plant J', 2020, 0, null),
    rec('Technical bulletin on orchard irrigation', '', 2021, 5, null),
  ];
}

describe('sources · indicators', () => {
  const P = () => Parsers.lib();

  it('source names: case, accents, punctuation and "&" do not split a source; ISSN joins abbreviations', () => {
    eq(P().sourceKey('Journal of Ethnobiology & Ethnomedicine'), P().sourceKey('JOURNAL OF ETHNOBIOLOGY AND ETHNOMEDICINE'));
    eq(P().sourceKey('Rev. Fitotéc. Mex.'), 'rev fitotec mex');
    eq(P().issnKey('0187-7380'), '01877380'); eq(P().issnKey('1234-567x'), '1234567X'); eq(P().issnKey('978-3-16'), '');
    const g = P().sourceGroups(sourcesDataset());
    eq(new Set(g.keyOf.filter(Boolean)).size, 5);
    const label = i => g.labels.get(g.keyOf[i]);
    eq(label(2), 'Genetic Resources and Crop Evolution', 'mixed case preferred to capitals');
    eq(label(4), 'Revista Fitotecnia Mexicana', 'abbreviation joined by ISSN, most used spelling');
    eq(g.keyOf[4], g.keyOf[6]);
    eq(g.keyOf[12], '', 'no source');
    deepEq(g.spellings.get(g.keyOf[9]).sort(), ['Journal of Ethnobiology & Ethnomedicine', 'Journal of Ethnobiology and Ethnomedicine']);
  });

  it('h and g indices agree with their definitions on 500 random citation lists', () => {
    /* written from the definitions, independently of the fast versions */
    const hBrute = c => { for (let h = c.length; h > 0; h--) if (c.filter(x => x >= h).length >= h) return h; return 0; };
    const gBrute = c => { const s = c.slice().sort((a, b) => b - a); for (let g = s.length; g > 0; g--) if (s.slice(0, g).reduce((a, b) => a + b, 0) >= g * g) return g; return 0; };
    const r = rng(1934), bad = [];
    for (let i = 0; i < 500; i++) {
      const c = Array.from({ length: Math.floor(r() * 30) }, () => Math.floor(r() * r() * 60));
      if (P().hIndex(c) !== hBrute(c) || P().gIndex(c) !== gBrute(c)) bad.push(c);
    }
    deepEq(bad, []);
    eq(P().hIndex([10, 8, 5, 4, 3]), 4); eq(P().hIndex([25, 8, 5, 3, 3]), 3); eq(P().hIndex([]), 0); eq(P().hIndex([0, 0]), 0);
    eq(P().gIndex([10, 8, 5, 4, 3]), 5); eq(P().gIndex([3, 3, 3, 3, 3]), 3); eq(P().gIndex([0]), 0);
    eq(P().hIndex([4, null, 2]), 2, 'documents without a count are left out');
    near(P().mIndex(4, 2016, 2025), 0.4); eq(P().mIndex(2, 2026, 2025), null);
  });

  it('Bradford zones: a hand-worked example, the closest cut, and zones that add up to the total', () => {
    const counts = [10, 8, 6, 4, 3, 3, 2, 2].concat(new Array(12).fill(1));
    const b = P().bradfordZones(counts);
    deepEq(b.cuts, [1, 5]);
    deepEq(b.zones.map(z => [z.sources, z.documents]), [[2, 18], [4, 16], [14, 16]]);
    /* exhaustive check of the first cut on random decreasing distributions */
    const r = rng(85), bad = [];
    for (let i = 0; i < 300; i++) {
      const c = Array.from({ length: 1 + Math.floor(r() * 80) }, () => 1 + Math.floor(r() * r() * 40)).sort((a, b) => b - a);
      const z = P().bradfordZones(c);
      const T = c.reduce((a, x) => a + x, 0);
      let best = 0, cum = 0, bestD = Infinity;
      c.forEach((x, k) => { cum += x; const d = Math.abs(cum - T / 3); if (d < bestD - 1e-12) { bestD = d; best = k; } });
      if (z.cuts[0] !== best || z.zones.reduce((a, x) => a + x.documents, 0) !== T || z.zones.reduce((a, x) => a + x.sources, 0) !== c.length) bad.push(c);
    }
    deepEq(bad, []);
    deepEq(P().bradfordZones([7]).zones.map(z => z.sources), [1, 0, 0]);
    deepEq(P().bradfordZones([]).zones, []);
  });

  it('criterion: with a Bradford-like distribution the zones add up to the total and zone 1 holds few sources', () => {
    const counts = Array.from({ length: 400 }, (x, i) => Math.max(1, Math.round(80 / Math.pow(i + 1, 0.95))));
    const z = P().bradfordZones(counts);
    eq(z.zones.reduce((a, x) => a + x.documents, 0), counts.reduce((a, x) => a + x, 0));
    ok(z.zones[0].sources < z.zones[1].sources && z.zones[1].sources < z.zones[2].sources, 'sources grow from zone to zone: ' + z.zones.map(x => x.sources));
    ok(z.zones[0].shareSources < 0.05, 'zone 1 has under 5% of the sources');
    z.zones.forEach(x => ok(Math.abs(x.shareDocuments - 1 / 3) < 0.05, 'about a third of the documents in each zone'));
  });

  it('the sources table of the example gives the values worked out by hand', () => {
    const s = P().sourcesTable(sourcesDataset(), { refYear: 2025 });
    eq(s.total, 12); eq(s.withoutSource, 1);
    deepEq(s.rows.map(r => [r.label, r.n, r.citations, r.citedDocs, r.h, r.g, r.firstYear, r.lastYear, r.zone]), [
      ['Genetic Resources and Crop Evolution', 4, 19, 4, 3, 4, 2015, 2022, 1],
      ['Revista Fitotecnia Mexicana', 3, 6, 2, 2, 2, 2019, 2023, 2],
      ['Economic Botany', 2, 26, 2, 1, 2, 2010, 2016, 3],
      ['Journal of Ethnobiology & Ethnomedicine', 2, 16, 2, 2, 2, 2017, 2024, 3],
      ['Plant J', 1, 0, 1, 0, 0, 2020, 2020, 3],
    ]);
    near(s.rows[0].m, 3 / 11); near(s.rows[1].m, 2 / 7); near(s.rows[2].m, 1 / 16); eq(s.rows[4].m, 0);
    deepEq(s.rows[1].issn, ['0187-7380']);
    deepEq(s.rows.map(r => r.cumulative), [4, 7, 9, 11, 12]);
    near(s.rows[1].cumulativeShare, 7 / 12);
    const d = P().sourceDynamics(sourcesDataset(), s.rows.slice(0, 2));
    eq(d.years[0], 2010); eq(d.years[d.years.length - 1], 2024);
    const at = (series, y) => series.values[d.years.indexOf(y)];
    deepEq([2014, 2015, 2018, 2020, 2022, 2024].map(y => at(d.series[0], y)), [0, 1, 2, 3, 4, 4]);
    deepEq([2019, 2021, 2023].map(y => at(d.series[1], y)), [1, 2, 3]);
  });
});

describe('sources · screen', () => {
  const card = key => el('srcCards').querySelector(`[data-key="${key}"]`);
  const value = key => card(key).querySelector('.metric-value').textContent;
  const sub = key => card(key).querySelector('.metric-sub').textContent;
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('countryAliases'); Prefs.del('institutionAliases'); Prefs.del('termField'); };
  const tab = id => { SourcesModule.tab = id; App.render('sources'); };
  const change = (id, v) => { const s = el(id); s.value = String(v); s.dispatchEvent(new Event('change')); };

  it('the pipeline gives every record its source key and name; cards show the hand-worked values', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    SourcesModule.ui = { topN: 10, impactN: 10, measure: 'h', dynN: 5 };
    const records = sourcesDataset();
    ImportModule.addResult({ name: 'sources.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    Pipeline.setReferenceYear(2025);
    eq(state.clean.length, 13, 'no duplicates merged');
    eq(state.clean.find(r => r.sourceTitle === 'Rev. Fitotec. Mex.').sourceName, 'Revista Fitotecnia Mexicana');
    tab('productivity');
    deepEq(['sources', 'perSource', 'core', 'multiplier', 'topSource', 'topH'].map(value), ['5', '2.4', '1', '2', '4', '3']);
    eq(sub('sources'), '3 variantes de nombre unidas');
    eq(sub('perSource'), 'promedio · 1 documento sin fuente');
    eq(sub('core'), 'fuente con 4 documentos (33.3 %)', 'one source in the core');
    eq(sub('multiplier'), 'fuentes por zona: 1 : 1 : 3');
    eq(sub('topH'), 'Genetic Resources and Crop Evolution');
    eq(Parsers.lib().overview(Pipeline.records()).sources, 5, 'the overview counts the same sources');
  });

  it('most productive sources: bars coloured by zone and a configurable number of sources', () => {
    tab('productivity');
    eq(el('srcTop').querySelectorAll('[data-series="bars"] rect').length, 5);
    deepEq(SourcesModule.cc.srcTop.dataMatrix().slice(0, 3), [['Rango', 'Fuente', 'Documentos', 'Porcentaje', 'Zona'], [1, 'Genetic Resources and Crop Evolution', 4, 1 / 3, 1], [2, 'Revista Fitotecnia Mexicana', 3, 0.25, 2]]);
    const fills = [...el('srcTop').querySelectorAll('[data-series="bars"] rect')].map(r => r.getAttribute('fill'));
    ok(fills[0] !== fills[1] && fills[1] !== fills[2] && fills[2] === fills[3], 'one colour per zone');
    change('srcTopN', 5);
    eq(SourcesModule.ui.topN, 5);
    eq(el('srcTop').querySelectorAll('[data-series="bars"] rect').length, 5);
    ok(el('srcTop').querySelector('svg').textContent.includes('Zona 1 (núcleo)'), 'zone legend');
    const heading = () => el('srcTopCard').querySelector('.chart-title').firstChild.textContent;
    eq(heading(), 'Las 5 fuentes más productivas');
    SourcesModule.ui.topN = 1;
    SourcesModule.rerender();
    eq(heading(), 'La fuente más productiva', 'singular title with one source');
    ok(el('srcTop').querySelector('svg').textContent.includes('La fuente más productiva'), 'singular title in the figure');
    SourcesModule.ui.topN = 5;
    SourcesModule.rerender();
  });

  it('criterion: Bradford zones add up to the documents with a source', () => {
    tab('bradford');
    ok(el('srcBradford').querySelector('[data-core]'), 'shaded core');
    ok(el('srcBradford').querySelector('[data-series="line"] path'), 'curve');
    const rows = [...el('srcZones').querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent));
    deepEq(rows.map(r => r.slice(0, 5)), [['Zona 1 (núcleo)', '1', '20 %', '4', '33.3 %'], ['Zona 2', '1', '20 %', '3', '25 %'], ['Zona 3', '3', '60 %', '5', '41.7 %']]);
    eq(rows.reduce((s, r) => s + +r[3], 0), 12);
    eq(rows[2][5], '3');
    eq(el('srcByZone').querySelectorAll('tbody tr').length, 5);
  });

  it('impact: h, g and m by source, the measure selector and the reference year', async () => {
    tab('impact');
    deepEq(SourcesModule.cc.srcImpact.dataMatrix().slice(1).map(r => [r[0], r[1]]),
      [['Genetic Resources and Crop Evolution', 3], ['Journal of Ethnobiology & Ethnomedicine', 2], ['Revista Fitotecnia Mexicana', 2], ['Economic Botany', 1], ['Plant J', 0]]);
    const first = [...el('srcImpactTable').querySelector('tbody tr').children].map(td => td.textContent);
    deepEq(first.slice(0, 7), ['Genetic Resources and Crop Evolution', '3', '4', '0.273', '19', '4', '2015']);
    change('srcImpactMeasure', 'g');
    deepEq(SourcesModule.cc.srcImpact.dataMatrix().slice(1).map(r => r[0]), ['Genetic Resources and Crop Evolution', 'Economic Botany', 'Journal of Ethnobiology & Ethnomedicine', 'Revista Fitotecnia Mexicana', 'Plant J']);
    change('srcImpactMeasure', 'm');
    const y = el('srcRefYear'); y.value = '2020'; y.dispatchEvent(new Event('change'));
    near(SourcesModule.data().rows[0].m, 3 / 6, 1e-12);
    Pipeline.setReferenceYear(2025);
    change('srcImpactMeasure', 'h');
  });

  it('dynamics: cumulative documents of the leading sources', () => {
    tab('dynamics');
    eq(el('srcDynamics').querySelectorAll('[data-series="line"]').length, 5);
    change('srcDynN', 6);
    eq(el('srcDynamics').querySelectorAll('[data-series="line"]').length, 5, 'only five sources exist');
    const m = SourcesModule.cc.srcDynamics.dataMatrix();
    eq(m[0][0], 'Año'); eq(m[0][1], 'Genetic Resources and Crop Evolution');
    eq(m.find(r => r[0] === 2022)[1], 4);
  });

  it('the full table lists every source with its joined variants', () => {
    tab('table');
    const rows = [...el('srcAll').querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent));
    eq(rows.length, 5);
    eq(rows[1][1], 'Revista Fitotecnia Mexicana'); eq(rows[1][2], 'Rev. Fitotec. Mex.'); eq(rows[1][4], '0187-7380');
  });

  it('every help has a definition, a formula and its reference; no visible text outside the dictionaries', () => {
    const data = new Set();
    sourcesDataset().forEach(r => { data.add(r.sourceTitle); });
    const problems = [], bad = [];
    SourcesModule.TABS.forEach(id => {
      ['es', 'en'].forEach(lang => {
        I18N.setLang(lang); tab(id);
        const engine = s => lang === 'en' && typeof I18N_DICT.es.phrases[s] === 'string';
        strayTexts(el('view'), lang).filter(s => !data.has(s) && !engine(s)).forEach(s => problems.push(lang + ' ' + id + ': ' + s));
      });
      I18N.setLang('es'); tab(id);
      [...el('view').querySelectorAll('.sources-page .help-btn')].forEach((b, i) => {
        b.click();
        const pop = document.querySelector('.help-pop');
        if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(id + ' #' + i);
        HelpPopover.close();
      });
    });
    deepEq({ problems, bad }, { problems: [], bad: [] });
  });

  it('the source filter in Cleaning uses the unified sources, named by their label', async () => {
    CleaningModule.tab = 'filters'; App.render('cleaning');
    const names = [...el('fSources').querySelectorAll('label span')].map(s => s.childNodes[0].textContent.trim());
    eq(names.length, 5);
    ok(names.includes('Revista Fitotecnia Mexicana') && !names.includes('Rev. Fitotec. Mex.'), names.join(' | '));
    const cb = [...el('fSources').querySelectorAll('input')].find(i => i.parentElement.textContent.startsWith('Revista Fitotecnia Mexicana'));
    cb.click();
    await Pipeline.pending;
    eq(el('docCounter').textContent, '3 de 13 documentos');
    await Pipeline.update({ filters: Parsers.lib().emptyFilters() });
    eq(el('docCounter').textContent, '13 de 13 documentos');
  });

  it('criterion: the four figures export to PNG (300 dpi) and SVG', async () => {
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    try {
      const charts = [['productivity', 'srcTop'], ['bradford', 'srcBradford'], ['impact', 'srcImpact'], ['dynamics', 'srcDynamics']];
      for (let k = 0; k < charts.length; k++) {
        tab(charts[k][0]);
        const buttons = SourcesModule.cc[charts[k][1]].el.querySelectorAll('.chart-actions button');
        buttons[0].click(); buttons[1].click();
        for (let i = 0; i < 100 && got.length < 2 * (k + 1); i++) await tick(30);   // wait for both files before leaving the tab
      }
    } finally { window.download = saved; }
    eq(got.length, 8, 'eight files');
    for (const g of got.filter(x => x.name.endsWith('.png'))) {
      const b = new Uint8Array(await g.blob.arrayBuffer());
      let ppm = null;
      for (let i = 8; i < b.length - 12; i++) if (b[i] === 0x70 && b[i + 1] === 0x48 && b[i + 2] === 0x59 && b[i + 3] === 0x73) { ppm = (b[i + 4] << 24 | b[i + 5] << 16 | b[i + 6] << 8 | b[i + 7]) >>> 0; break; }
      eq(ppm, 11811, g.name);
    }
    for (const g of got.filter(x => x.name.endsWith('.svg'))) {
      const doc = new DOMParser().parseFromString(await g.blob.text(), 'image/svg+xml');
      ok(!doc.querySelector('parsererror') && doc.documentElement.querySelectorAll('text').length > 5, g.name + ' parses');
    }
    eq(got.filter(x => x.name.endsWith('.png')).length, 4);
    reset();
    await Pipeline.pending;
  });
});
