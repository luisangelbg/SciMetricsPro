/* Authors: counts, fractional counting, h/g/m, production over time, Lotka's law and the Kolmogorov
   distribution, institutions, countries (SCP/MCP), the world map, the screen and figure export. */
'use strict';

/* five documents; every expected value below was worked out by hand */
function authorsDataset() {
  const P = Parsers.lib();
  const MX = 'Universidad Nacional Autónoma de México, Mexico City, Mexico', US = 'University of Arizona, Tucson, AZ, USA';
  const ES = 'Universidad de Sevilla, Sevilla, Spain', BR = 'Universidade de São Paulo, São Paulo, Brazil';
  const rec = o => {
    const r = Object.assign(P.newRecord(), o);
    r.authors = o.authors.map(a => P.person(a));
    r.authors.forEach((a, i) => { if (o.affs && o.affs[i]) a.affiliations = [o.affs[i]]; });
    delete r.affs;
    return P.finish(r);
  };
  return [
    rec({ title: 'Wild relatives of chayote in Veracruz', year: 2019, timesCited: 10, sourceTitle: 'Econ Bot', correspondingCountry: 'MX', authors: ['Lira, R.', 'Cruz, A.', 'Soto, B.'], affs: [MX, MX, US] }),
    rec({ title: 'Seed viability of squash landraces', year: 2020, timesCited: 4, sourceTitle: 'Econ Bot', authors: ['Lira, R.', 'Cruz, A.'], affs: [MX, MX] }),
    rec({ title: 'Market chains of cactus pears in Andalusia', year: 2020, timesCited: null, sourceTitle: 'Rev Esp', correspondingCountry: 'ES', authors: ['Lira, R.'], affs: [ES] }),
    rec({ title: 'Pollinators of passion fruit in orchards', year: 2021, timesCited: 2, sourceTitle: 'Rev Bras', correspondingCountry: 'US', authors: ['Soto, B.', 'Diaz, C.'], affs: [US, BR] }),
    rec({ title: 'A note on bean nomenclature', year: 2022, timesCited: 0, sourceTitle: 'Taxon', authors: ['Ruiz, D.'] }),
  ];
}

describe('authors · indicators', () => {
  const P = () => Parsers.lib();
  const clean = () => { Pipeline.settings = null; return Pipeline.normalize(authorsDataset()); };

  it('documents, fractional counting, citations and h/g/m per author', () => {
    const t = P().authorsTable(clean(), { refYear: 2025 });
    eq(t.docs, 5);
    deepEq(t.rows.map(r => [r.label, r.n, +r.fractional.toFixed(4), r.citations, r.citedDocs, r.h, r.g, r.firstYear, r.lastYear, r.country]), [
      ['Lira, R.', 3, 1.8333, 14, 2, 2, 2, 2019, 2020, 'MX'],
      ['Cruz, A.', 2, 0.8333, 14, 2, 2, 2, 2019, 2020, 'MX'],
      ['Soto, B.', 2, 0.8333, 12, 2, 2, 2, 2019, 2021, 'US'],
      ['Ruiz, D.', 1, 1, 0, 1, 0, 0, 2022, 2022, ''],
      ['Diaz, C.', 1, 0.5, 2, 1, 1, 1, 2021, 2021, 'BR'],
    ]);
    near(t.rows.reduce((s, r) => s + r.fractional, 0), 5, 1e-12, 'fractions add up to the documents');
    near(t.rows[0].m, 2 / 7); near(t.rows[4].m, 1 / 5); eq(t.rows[3].m, 0);
    eq(t.rows[0].institution, 'Universidad Nacional Autónoma de México');
    const pts = P().authorProduction(t.rows.slice(0, 1), 2025);
    deepEq(pts.map(p => [p.year, p.n, p.citations]), [[2019, 1, 10], [2020, 2, 4]]);
    near(pts[0].citationsPerYear, 10 / 7); near(pts[1].citationsPerYear, 4 / 6);
  });

  it('Kolmogorov distribution: known quantiles; Lotka constant for β = 2 is 6/π²', () => {
    near(P().kolmogorovQ(1.3581), 0.05, 5e-4); near(P().kolmogorovQ(1.6276), 0.01, 5e-4);
    near(P().kolmogorovQ(1.2238), 0.10, 5e-4); near(P().kolmogorovQ(0.8276), 0.50, 1e-3);
    eq(P().kolmogorovQ(0), 1);
    near(P().lotkaConstant(2), 6 / (Math.PI * Math.PI), 1e-5);
    near(P().lotkaConstant(3), 1 / 1.2020569, 1e-5, 'ζ(3) = 1.2020569');
  });

  it('Lotka: a hand-worked example (fit, theoretical law and Kolmogorov-Smirnov)', () => {
    const counts = new Array(10).fill(1).concat([2, 2, 2, 3, 5]);
    const L = P().lotka(counts);
    eq(L.authors, 15); eq(L.xmax, 5); eq(L.distinctX, 4);
    eq(L.fitPoints, 3, 'x = 1, 2, 3 (no author has 4 documents)');
    near(L.beta, 2.05727, 3e-4); near(L.C, 0.70779, 3e-4);
    deepEq(L.rows.map(r => r.authors), [10, 3, 1, 0, 1]);
    near(L.rows[4].cumTheoretical, 0.8897689, 1e-6);
    near(L.ks.D, 0.1102311, 1e-6);
    near(L.ks.critical05, 1.36 / Math.sqrt(15), 1e-12);
    ok(L.ks.p > 0.9 && L.ks.p <= 1, 'p = ' + L.ks.p);
    eq(P().lotka([1, 1, 1]).beta, null, 'one distinct value cannot be fitted');
    eq(P().lotka([]), null);
  });

  it('criterion: authors drawn from Lotka’s law give a reasonable β and pass the test; a steeper law is detected', () => {
    /* draw documents per author from P(x) = C / x^b by inverting the cumulative distribution (seeded) */
    const sample = (b, n, seed) => {
      const r = rng(seed), C = 1 / Array.from({ length: 200000 }, (x, i) => Math.pow(i + 1, -b)).reduce((s, v) => s + v, 0);
      return Array.from({ length: n }, () => { const u = r(); let x = 1, F = C; while (F < u && x < 200000) { x++; F += C * Math.pow(x, -b); } return x; });
    };
    const L = P().lotka(sample(2, 2000, 1926));
    ok(L.beta > 1.5 && L.beta < 3.5, 'β in the usual range: ' + L.beta);
    ok(L.ks.D < L.ks.critical05 && L.ks.p > 0.05, 'fits the law: D = ' + L.ks.D + ', p = ' + L.ks.p);
    const S = P().lotka(sample(3.2, 2000, 1985));
    ok(S.ks.D > S.ks.critical01 && S.ks.p < 0.01, 'departure from β = 2 detected: D = ' + S.ks.D);
    ok(S.beta > L.beta, 'a steeper law gives a larger β: ' + S.beta);
  });

  it('institutions: documents where each appears and author appearances', () => {
    const s = P().institutionsTable(clean());
    deepEq(s.rows.map(r => [r.name, r.documents, r.appearances, r.country]), [
      ['Universidad Nacional Autónoma de México', 2, 4, 'MX'],
      ['University of Arizona', 2, 2, 'US'],
      ['Universidad de Sevilla', 1, 1, 'ES'],
      ['Universidade de São Paulo', 1, 1, 'BR'],
    ]);
    eq(s.withInstitution, 4); eq(s.withoutAffiliations, 1);
  });

  it('institutions: spellings that differ only in accents, case or spaces are one institution, named by the most used', () => {
    const PB = 'Universidade Federal da Paraíba, João Pessoa, Brazil', PB2 = 'UNIVERSIDADE  FEDERAL DA PARAIBA, Joao Pessoa, Brazil';
    const recs = [
      { title: 'Salt stress in yellow passion fruit', year: 2020, affs: [PB] },
      { title: 'Potassium doses in passion fruit', year: 2021, affs: [PB] },
      { title: 'Biofertilizer in passion fruit seedlings', year: 2022, affs: [PB2] },
    ].map(o => { const r = Object.assign(Parsers.lib().newRecord(), o); r.authors = [Parsers.lib().person('Silva, A.')]; r.authors[0].affiliations = o.affs; delete r.affs; return Parsers.lib().finish(r); });
    Pipeline.settings = null;
    const s = P().institutionsTable(Pipeline.normalize(recs));
    deepEq(s.rows.map(r => [r.name, r.documents, r.appearances, r.country]), [['Universidade Federal da Paraíba', 3, 3, 'BR']]);
    eq(P().institutionKey(' Universidade  Federal da PARAÍBA '), 'universidade federal da paraiba');
  });

  it('countries: corresponding author (or first author), SCP/MCP, citations and all authors', () => {
    const c = P().countriesTable(clean());
    deepEq(c.basis, { corresponding: 3, firstAuthor: 1, affiliation: 0, none: 1 });
    deepEq(c.corresponding.map(r => [r.code, r.documents, r.scp, r.mcp, r.citations, r.citedDocs]), [['MX', 2, 1, 1, 14, 2], ['US', 1, 0, 1, 2, 1], ['ES', 1, 1, 0, 0, 0]]);
    near(c.corresponding[0].mcpRatio, 0.5); near(c.corresponding[0].meanTC, 7); eq(c.corresponding[2].meanTC, null);
    deepEq(c.authors.map(r => [r.code, r.appearances, r.documents]), [['MX', 4, 2], ['US', 2, 2], ['BR', 1, 1], ['ES', 1, 1]]);
    eq(c.withCountry, 4);
  });

  it('criterion: the map data put Mexico City in Mexico and Washington in the United States', () => {
    /* ray casting on the rings of each country, written for this test */
    const inside = (code, lon, lat) => {
      const entry = WORLD_MAP.find(e => e[0] === code);
      let hit = false;
      for (const poly of entry[1]) for (const ring of poly) {
        for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
          const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
          if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
        }
      }
      return hit;
    };
    ok(inside('MX', -99.13, 19.43) && !inside('US', -99.13, 19.43), 'Mexico City');
    ok(inside('US', -77.04, 38.9) && !inside('MX', -77.04, 38.9), 'Washington');
    ok(inside('MX', -110.3, 24.1), 'La Paz, Baja California Sur');
    ok(inside('US', -149.9, 61.2), 'Anchorage, Alaska');
    ok(inside('BR', -47.9, -15.8) && inside('ES', -3.7, 40.4) && inside('FR', 2.35, 48.86), 'Brasilia, Madrid, Paris');
    eq(new Set(WORLD_MAP.map(e => e[0])).size, WORLD_MAP.length, 'one entry per country');
    ok(!WORLD_MAP.some(e => e[0] === 'AQ'), 'no Antarctica');
  });

  it('the Equal Earth projection keeps areas: bands of latitude in proportion to their true area', () => {
    const band = (lat0, lat1) => {
      const pts = [];
      for (let lon = -180; lon <= 180; lon += 2) pts.push(Charts.equalEarth(lon, lat0));
      for (let lat = lat0; lat <= lat1; lat += 1) pts.push(Charts.equalEarth(180, lat));
      for (let lon = 180; lon >= -180; lon -= 2) pts.push(Charts.equalEarth(lon, lat1));
      for (let lat = lat1; lat >= lat0; lat -= 1) pts.push(Charts.equalEarth(-180, lat));
      let a = 0;
      for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
      return Math.abs(a) / 2;
    };
    const s = d => Math.sin(d * Math.PI / 180);
    near(band(0, 30) / band(30, 60), (s(30) - s(0)) / (s(60) - s(30)), 0.01);
    near(band(10, 20) / band(60, 70), (s(20) - s(10)) / (s(70) - s(60)), 0.01);
    deepEq(Charts.equalEarth(0, 0), [0, 0]);
  });
});

describe('authors · screen', () => {
  const card = key => el('auCards').querySelector(`[data-key="${key}"]`);
  const value = key => card(key).querySelector('.metric-value').textContent;
  const sub = key => card(key).querySelector('.metric-sub').textContent;
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('countryAliases'); Prefs.del('institutionAliases'); Prefs.del('termField'); };
  const tab = id => { AuthorsModule.tab = id; App.render('authors'); };
  const change = (id, v) => { const s = el(id); s.value = String(v); s.dispatchEvent(new Event('change')); };

  it('cards and the missing-affiliations warning', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    AuthorsModule.ui = { measure: 'n', topN: 10, timeN: 10, impactMeasure: 'h', impactN: 10, instMeasure: 'documents', instN: 15, ctryN: 15, mapMeasure: 'appearances', citeMeasure: 'citations' };
    const records = authorsDataset();
    ImportModule.addResult({ name: 'authors.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    Pipeline.setReferenceYear(2025);
    tab('productivity');
    deepEq(['authors', 'single', 'topH', 'institutions', 'countries'].map(value), ['5', '40 %', '2', '4', '4']);
    eq(sub('single'), '2 autores');
    eq(sub('topH'), 'Lira, R.');
    eq(el('auAffWarning').textContent, '1 documento de 5 (20 %) no trae afiliaciones: instituciones y países se calculan sin él.');
  });

  it('most productive authors: full and fractional counting', () => {
    tab('productivity');
    eq(el('auTop').querySelectorAll('[data-series="bars"] rect').length, 5);
    deepEq(AuthorsModule.cc.auTop.dataMatrix().slice(1).map(r => r[1]), ['Lira, R.', 'Cruz, A.', 'Soto, B.', 'Ruiz, D.', 'Diaz, C.']);
    change('auMeasure', 'fractional');
    const m = AuthorsModule.cc.auTop.dataMatrix();
    deepEq(m.slice(1).map(r => r[1]), ['Lira, R.', 'Ruiz, D.', 'Cruz, A.', 'Soto, B.', 'Diaz, C.']);
    change('auMeasure', 'n');
    eq(el('auAll').querySelectorAll('tbody tr').length, 5);
  });

  it('production over time: one bubble per author and year', () => {
    tab('overTime');
    eq(el('auTime').querySelectorAll('[data-series="bubbles"] circle').length, 8);
    const rows = AuthorsModule.cc.auTime.dataMatrix();
    deepEq(rows[1].slice(0, 4), ['Lira, R.', 2019, 1, 10]);
  });

  it('Lotka: statistics, chart and distribution table', () => {
    tab('lotka');
    const L = AuthorsModule.data().lotka;
    eq(L.authors, 5);
    ok(el('auLotkaStats'), 'statistics');
    ok(el('auLotka').querySelector('[data-series="observed"] circle'), 'observed points');
    ok(el('auLotka').querySelector('[data-series="theoretical"] path'), 'theoretical curve');
    eq(el('auLotkaTable').querySelectorAll('tbody tr').length, 3);
    ok(el('view').textContent.includes('con 35 o menos'), 'few authors warning');
  });

  it('impact and institutions', () => {
    tab('impact');
    deepEq([...el('auImpactTable').querySelector('tbody tr').children].slice(0, 5).map(td => td.textContent), ['Lira, R.', '2', '2', '0.286', '14']);
    tab('institutions');
    deepEq(AuthorsModule.cc.auInst.dataMatrix().slice(1).map(r => [r[0], r[1]]), [['Universidad Nacional Autónoma de México', 2], ['University of Arizona', 2], ['Universidad de Sevilla', 1], ['Universidade de São Paulo', 1]]);
    change('auInstMeasure', 'appearances');
    eq(AuthorsModule.cc.auInst.dataMatrix()[1][2], 4);
    change('auInstMeasure', 'documents');
  });

  it('criterion: countries on the map, SCP/MCP bars and citations', () => {
    tab('countries');
    const path = code => el('auMap').querySelector(`path[data-code="${code}"]`);
    const empty = AuthorsModule.figs.auMap.emptyColor;
    ok(path('MX').getAttribute('fill') !== empty && path('US').getAttribute('fill') !== empty, 'Mexico and the United States are coloured');
    eq(path('FR').getAttribute('fill'), empty, 'France has no data');
    eq(path('MX').querySelector('title').textContent, 'México: 4');
    eq(path('US').querySelector('title').textContent, 'Estados Unidos: 2');
    ok(path('MX').getAttribute('fill') !== path('US').getAttribute('fill'), 'different values, different colours');
    const scp = AuthorsModule.cc.auScp.dataMatrix();
    deepEq(scp[1], ['México', 2, 1, 1, 0.5]);
    eq(el('auScp').querySelectorAll('[data-series^="stack-"] rect').length, 4);
    ok(el('auScp').querySelector('svg').textContent.includes('MCP 50 %'), 'MCP note');
    deepEq(AuthorsModule.cc.auCite.dataMatrix().slice(1).map(r => [r[0], r[1]]), [['México', 14], ['Estados Unidos', 2]]);
    change('auMapMeasure', 'documents');
    eq(el('auMap').querySelector('path[data-code="MX"] title').textContent, 'México: 2');
    change('auMapMeasure', 'appearances');
    ok(el('auCountryBasis').textContent.includes('3 por el autor de correspondencia, 1 por el primer autor con país'), 'basis');
  });

  it('every help has a definition, a formula and its reference; no visible text outside the dictionaries', () => {
    const data = new Set();
    authorsDataset().forEach(r => r.authors.forEach(a => data.add(P_label(a))));
    function P_label(a) { return Parsers.lib().authorLabel(a); }
    ['Universidad Nacional Autónoma de México', 'University of Arizona', 'Universidad de Sevilla', 'Universidade de São Paulo'].forEach(s => data.add(s));
    const problems = [], bad = [];
    AuthorsModule.TABS.forEach(id => {
      ['es', 'en'].forEach(lang => {
        I18N.setLang(lang); tab(id);
        ['MX', 'US', 'ES', 'BR', 'FR'].forEach(c => data.add(CleaningModule.countryLabel(c)));
        const engine = s => lang === 'en' && typeof I18N_DICT.es.phrases[s] === 'string';
        strayTexts(el('view'), lang).filter(s => !data.has(s) && !engine(s) && !/^[A-Z]{2}$/.test(s) && !/: [\d,]+$/.test(s)).forEach(s => problems.push(lang + ' ' + id + ': ' + s));
      });
      I18N.setLang('es'); tab(id);
      [...el('view').querySelectorAll('.authors-page .help-btn')].forEach((b, i) => {
        b.click();
        const pop = document.querySelector('.help-pop');
        if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(id + ' #' + i);
        HelpPopover.close();
      });
    });
    deepEq({ problems, bad }, { problems: [], bad: [] });
  });

  it('criterion: the new figures export to PNG (300 dpi) and SVG', async () => {
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    try {
      const charts = [['overTime', 'auTime'], ['lotka', 'auLotka'], ['countries', 'auScp'], ['countries', 'auMap']];
      for (let k = 0; k < charts.length; k++) {
        tab(charts[k][0]);
        const buttons = AuthorsModule.cc[charts[k][1]].el.querySelectorAll('.chart-actions button');
        buttons[0].click(); buttons[1].click();
        for (let i = 0; i < 150 && got.length < 2 * (k + 1); i++) await tick(30);
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
      ok(!doc.querySelector('parsererror'), g.name + ' parses');
    }
    reset();
    await Pipeline.pending;
  });
});
