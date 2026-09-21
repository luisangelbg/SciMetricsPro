/* Social structure: collaboration lists of authors, institutions and countries, collaboration between countries, the
   chronology of collaboration, country points of the map and the screen with its network, map, chronology, helps and exports. */
'use strict';

/* six documents with authors from Mexico, Japan, Costa Rica and the United States; every expected value was worked out by hand */
function socialDataset() {
  const P = Parsers.lib();
  const UNAM = 'Universidad Nacional Autonoma de Mexico, Mexico City, Mexico';
  const TSUKUBA = 'University of Tsukuba, Tsukuba, Japan';
  const UCR = 'Universidad de Costa Rica, San Jose, Costa Rica';
  const UF = 'University of Florida, Gainesville, USA';
  const rec = (title, year, tc, authors) => {
    const r = Object.assign(P.newRecord(), { title, year, timesCited: tc, sourceTitle: 'Economic Botany', docTypeRaw: 'Article', authorKeywords: ['chayote'] });
    r.authors = authors.map(([name, aff]) => { const a = P.person(name); if (aff) a.affiliations = [aff]; return a; });
    return P.finish(r);
  };
  return [
    rec('Chayote landraces of Veracruz and their fruit traits', 2018, 12, [['Lira, R.', UNAM], ['Cruz, A.', TSUKUBA]]),
    rec('Genetic resources of chayote in Mesoamerica', 2019, 30, [['Lira, R.', UNAM], ['Soto, B.', UCR], ['Brown, K.', UF]]),
    rec('Seed dormancy of wild chayote relatives', 2019, 8, [['Lira, R.', UNAM], ['Cruz, A.', TSUKUBA]]),
    rec('Pollination of chayote in Florida gardens', 2020, 4, [['Diaz, C.', UF], ['Brown, K.', UF]]),
    rec('Chayote markets of San Jose', 2020, 2, [['Perez, E.', UCR]]),
    rec('A note on chayote storage', 2021, 0, [['Nava, I.', null], ['Ruiz, F.', null]]),
  ];
}

describe('social · collaboration', () => {
  const P = () => Parsers.lib();

  it('collaboration lists of authors, institutions and countries, and the co-authored documents between units', () => {
    const recs = socialDataset();
    deepEq(recs.map(r => P().recordCountries(r)), [['JP', 'MX'], ['CR', 'MX', 'US'], ['JP', 'MX'], ['US'], ['CR'], []]);
    const A = P().collaborationLists(recs, 'authors');
    deepEq(A.lists.map(l => l.length), [2, 3, 2, 2, 1, 2]);
    const ai = P().incidence(A.lists, { minFreq: 2 });
    deepEq(ai.items.map(it => [A.labels.get(it.key), it.freq]), [['Lira, R.', 3], ['Brown, K.', 2], ['Cruz, A.', 2]]);
    deepEq(P().cooccurrence(ai.docs, ai.items.length).map(e => [A.labels.get(ai.items[e[0]].key), A.labels.get(ai.items[e[1]].key), e[2]]), [['Lira, R.', 'Brown, K.', 1], ['Lira, R.', 'Cruz, A.', 2]]);
    const I = P().collaborationLists(recs, 'institutions');
    const ii = P().incidence(I.lists, { minFreq: 1 });
    deepEq(ii.items.map(it => [I.labels.get(it.key), it.freq]), [['Universidad Nacional Autonoma de Mexico', 3], ['Universidad de Costa Rica', 2], ['University of Florida', 2], ['University of Tsukuba', 2]]);
    deepEq(I.lists[3].length, 1, 'two authors of the same institution count it once');
    const Cn = P().collaborationLists(recs, 'countries');
    const ci = P().incidence(Cn.lists, { minFreq: 1 });
    deepEq(P().cooccurrence(ci.docs, ci.items.length).map(e => [ci.items[e[0]].key, ci.items[e[1]].key, e[2]]).sort(), [['CR', 'US', 1], ['MX', 'CR', 1], ['MX', 'JP', 2], ['MX', 'US', 1]].sort());
  });

  it('collaboration between countries: documents, international documents, partners and pairs', () => {
    const C = P().countryCollaboration(socialDataset());
    deepEq([C.withCountry, C.international, C.documents], [5, 3, 6]);
    deepEq(C.pairs.map(p => [p.a, p.b, p.documents]), [['JP', 'MX', 2], ['CR', 'MX', 1], ['CR', 'US', 1], ['MX', 'US', 1]]);
    deepEq(C.countries.map(c => [c.code, c.documents, c.international, c.partners, c.collaborations, c.top, c.topDocuments]),
      [['MX', 3, 3, 3, 4, 'JP', 2], ['CR', 2, 1, 2, 2, 'MX', 1], ['JP', 2, 2, 1, 2, 'MX', 2], ['US', 2, 1, 2, 2, 'CR', 1]]);
    deepEq(C.countries[0].partnerList, [{ code: 'JP', documents: 2 }, { code: 'CR', documents: 1 }, { code: 'US', documents: 1 }]);
  });

  it('chronology: means per document among the documents with the information, years without documents included', () => {
    const recs = socialDataset().concat([Object.assign(Parsers.lib().newRecord(), { title: 'Old', year: 2015, authors: [] })]);
    const T = P().collaborationTimeline(recs);
    deepEq(T.rows.map(r => r.year), [2015, 2016, 2017, 2018, 2019, 2020, 2021]);
    const row = y => T.rows.find(r => r.year === y);
    deepEq([row(2016).documents, row(2016).countries, row(2016).international], [0, null, null]);
    deepEq([row(2018).documents, row(2018).authors, row(2018).countries, row(2018).institutions, row(2018).international], [1, 2, 2, 2, 1]);
    deepEq([row(2019).authors, row(2019).countries, row(2019).institutions, row(2019).international], [2.5, 2.5, 2.5, 1]);
    deepEq([row(2020).authors, row(2020).countries, row(2020).institutions, row(2020).international], [1.5, 1, 1, 0]);
    deepEq([row(2021).documents, row(2021).withCountry, row(2021).countries, row(2021).institutions], [1, 0, null, null]);
    deepEq([row(2015).documents, row(2015).authors], [1, null], 'a document without authors');
    const tot = T.totals;
    deepEq([tot.documents, tot.withCountry, tot.withInstitution], [7, 5, 5]);
    near(tot.countries, 9 / 5); near(tot.institutions, 9 / 5); near(tot.international, 3 / 5); near(tot.authors, 12 / 6);
  });

  it('map points: each country at the centroid of its largest polygon; small countries at their capital', () => {
    const pts = Charts.countryPoints();
    const inside = (code, pt) => {
      const entry = WORLD_MAP.find(e => e[0] === code);
      return entry[1].some(poly => {
        const ring = poly[0].reduce((acc, v, i, arr) => (i % 2 ? acc : acc.concat([Charts.equalEarth(arr[i], arr[i + 1])])), []);
        let c = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
        }
        return c;
      });
    };
    ['MX', 'US', 'FR', 'BR', 'JP', 'CR', 'ES', 'IN', 'CN', 'AR'].forEach(code => ok(inside(code, pts.get(code)), code + ' point inside the country'));
    const fr = pts.get('FR'), guiana = Charts.equalEarth(-53, 4);
    ok(Math.hypot(fr[0] - guiana[0], fr[1] - guiana[1]) > 0.5, 'France in Europe, not in South America');
    deepEq(pts.get('SG'), Charts.equalEarth(103.82, 1.35));
    ok(!WORLD_MAP.some(e => e[0] === 'SG'), 'Singapore is not drawn at this scale');
  });
});

describe('social · screen', () => {
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('termField'); Prefs.del('countryAliases'); Prefs.del('institutionAliases'); SocialModule.reset(); };
  const change = (id, v) => { const s = el(id); if (s.type === 'checkbox') s.checked = !!v; else s.value = String(v); s.dispatchEvent(new Event('change')); };
  const value = (grid, key) => el(grid).querySelector(`[data-key="${key}"] .metric-value`).textContent;
  const sub = (grid, key) => el(grid).querySelector(`[data-key="${key}"] .metric-sub`).textContent;
  const tab = async id => { SocialModule.tab = id; App.render('social'); if (id === 'network') await SocialModule.net.pending; };

  it('collaboration network of authors, institutions and countries', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    const records = socialDataset();
    ImportModule.addResult({ name: 'social.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    location.hash = '#/social';
    eq(Pipeline.records().length, 6);
    await tab('network');
    ok(el('snStats'), 'statistics');
    deepEq(['nodes', 'communities'].map(k => value('snStats', k)), ['3', '1']);
    const view = SocialModule.net.view;
    eq(view.search('Lira'), view.state.nodes.findIndex(n => n.label === 'Lira, R.'));
    ok(el('snNode').textContent.includes('3 documentos'), 'node card with documents');
    change('snParams-unit', 'countries');
    await SocialModule.net.pending;
    eq(el('snParams-minFreq').value, '1', 'countries start with 1 document');
    eq(value('snStats', 'nodes'), '4');
    const labels = SocialModule.net.view.state.nodes.map(n => n.label).sort();
    deepEq(labels, ['Costa Rica', 'Estados Unidos', 'Japón', 'México']);
    ok(el('snCoverage').textContent.includes('5 de 6 documentos'), 'coverage note');
    const edges = [...el('snEdges').querySelectorAll('tbody tr')].map(tr => [...tr.children].slice(0, 3).map(td => td.textContent));
    ok(edges.some(r => r.includes('México') && r.includes('Japón') && r[2] === '2'), JSON.stringify(edges));
    change('snParams-unit', 'institutions');
    await SocialModule.net.pending;
    eq(value('snStats', 'nodes'), '4');
    ok(el('snNodes').textContent.includes('Universidad Nacional Autonoma de Mexico'), 'institutions');
    change('snParams-unit', 'authors');
    await SocialModule.net.pending;
  });

  it('criterion: on the world map Mexico is linked with its real collaborators, with arcs as wide as the co-authorships', async () => {
    await tab('worldMap');
    deepEq(['countries', 'international', 'pairs', 'strongest', 'partners'].map(k => value('swStats', k)), ['4', '3', '4', '2', '3']);
    eq(sub('swStats', 'strongest'), 'Japón – México');
    eq(sub('swStats', 'partners'), 'México');
    eq(sub('swStats', 'international'), '60 % de 5 documentos con país');
    const svg = el('swMap').querySelector('svg');
    const arcs = [...svg.querySelectorAll('[data-series="arcs"] path')];
    deepEq(arcs.map(a => a.dataset.pair).sort(), ['CR-MX', 'CR-US', 'JP-MX', 'MX-US']);
    const w = pair => +arcs.find(a => a.dataset.pair === pair).getAttribute('stroke-width');
    ok(w('JP-MX') > w('CR-MX') && w('CR-MX') === w('MX-US'), 'the widest arc is the strongest collaboration');
    deepEq([...svg.querySelectorAll('[data-series="countries"] circle')].map(c => c.dataset.code).sort(), ['CR', 'JP', 'MX', 'US']);
    ok(svg.querySelector('path[data-code="MX"]').getAttribute('fill') !== svg.querySelector('path[data-code="FR"]').getAttribute('fill'), 'Mexico shaded, France without data');
    const mexico = [...el('swCountries').querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent)).find(r => r[0] === 'México');
    deepEq(mexico.slice(0, 7), ['México', '3', '3', '100 %', '3', '4', 'Japón (2)']);
    eq(mexico[7], 'Japón (2); Costa Rica (1); Estados Unidos (1)');
    eq(el('swPairs').querySelectorAll('tbody tr').length, 4);
    eq(el('swParams').querySelector('.net-panel-title').textContent, 'Parámetros del mapa');
    change('swParams-minEdge', 2);
    deepEq([...el('swMap').querySelectorAll('[data-series="arcs"] path')].map(a => a.dataset.pair), ['JP-MX']);
    change('swParams-shading', 'partners');
    ok(el('swMap').textContent.includes('Países colaboradores'), 'legend of the shading');
    change('swParams-minEdge', 1);
    change('swParams-shading', 'documents');
  });

  it('chronology of collaboration: countries and institutions per document by year', async () => {
    await tab('timeline');
    deepEq(['authors', 'institutions', 'countries', 'international'].map(k => value('stStats', k)), ['2', '1.8', '1.8', '60 %']);
    const svg = el('stTimeline').querySelector('svg');
    eq(svg.querySelectorAll('[data-series="line"] path').length, 2);
    ok(!/NaN/.test(svg.innerHTML), 'no invalid coordinates');
    const rows = [...el('stYears').querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent));
    deepEq(rows.map(r => r[0]), ['2018', '2019', '2020', '2021']);
    deepEq(rows[1], ['2019', '2', '2.5', '2', '2.5', '2', '2.5', '100 %']);
    deepEq(rows[3].slice(3), ['0', '—', '0', '—', '—']);
    const path = svg.querySelector('[data-series="line"] path').getAttribute('d');
    eq((path.match(/M/g) || []).length, 1, 'the year without countries ends the line');
    ok(el('stShare').querySelector('svg'), 'share of international documents');
  });

  it('lines over many years: a lone value between empty years keeps its point, and a percentage axis stops at 100', () => {
    const years = Array.from({ length: 71 }, (x, i) => 1956 + i);
    const values = years.map(y => (y === 1976 ? 100 : y >= 2005 ? 20 + (y % 3) * 10 : null));
    const cfg = { width: 800, height: 360, palette: 'scimetrics', markers: true, legendPos: 'none', title: '', subtitle: '', xlab: 'Año', ylab: '%', maxLabel: 60 };
    const svg = Charts.lines(cfg, { years, max: 100, series: [{ label: 'internacional', values }] });
    const dots = svg.querySelectorAll('[data-series="line"] circle');
    eq(dots.length, 1, 'only the lone point gets a marker with more than 60 years');
    const path = svg.querySelector('[data-series="line"] path').getAttribute('d');
    eq((path.match(/M/g) || []).length, 2, 'the lone point opens its own piece of path');
    const ticks = [...svg.querySelectorAll('text')].map(n => n.textContent).filter(s => /^\d+$/.test(s) && +s <= 1000).map(Number);
    eq(Math.max(...ticks), 100, 'no tick above 100 %');
  });

  it('every help has a definition, a formula and its reference; no visible text outside the dictionaries', async () => {
    const data = new Set(['Lira, R.', 'Cruz, A.', 'Soto, B.', 'Brown, K.', 'Diaz, C.', 'Perez, E.', 'Nava, I.', 'Ruiz, F.', 'chayote']);
    socialDataset().forEach(r => { data.add(r.title); r.affiliations.forEach(a => data.add(a)); });
    const problems = [], bad = [];
    let helps = 0;
    for (const lang of ['es', 'en']) {
      I18N.setLang(lang);
      for (const id of SocialModule.TABS) {
        await tab(id);
        const engine = s => lang === 'en' && typeof I18N_DICT.es.phrases[s] === 'string';
        const record = s => [...data].some(d => d.includes(s) || s.includes(d)) || /^(Universidad|University)/.test(s) || /^\d{4}$/.test(s);
        strayTexts(el('view'), lang).filter(s => !engine(s) && !record(s)).forEach(s => problems.push(lang + ' ' + id + ': ' + s));
        if (lang === 'es') {
          const buttons = [...el('view').querySelectorAll('.social-page .help-btn')];
          helps += buttons.length;
          buttons.forEach((b, i) => {
            b.click();
            const pop = document.querySelector('.help-pop');
            if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(id + ' #' + i);
            HelpPopover.close();
          });
        }
      }
    }
    I18N.setLang('es');
    ok(helps >= 25, 'helps: ' + helps);
    deepEq({ problems: [...new Set(problems)], bad }, { problems: [], bad: [] });
  });

  it('the collaboration map and the chronology export to PNG (300 dpi) and SVG', async () => {
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    try {
      await tab('worldMap');
      let buttons = SocialModule.cc.swMap.el.querySelectorAll('.chart-actions button');
      buttons[0].click(); buttons[1].click();
      for (let i = 0; i < 150 && got.length < 2; i++) await tick(30);
      await tab('timeline');
      buttons = SocialModule.cc.stTimeline.el.querySelectorAll('.chart-actions button');
      buttons[0].click(); buttons[1].click();
      for (let i = 0; i < 150 && got.length < 4; i++) await tick(30);
    } finally { window.download = saved; }
    eq(got.length, 4);
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
