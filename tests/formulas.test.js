/* Paso 17: every function of the engines (indicators, networks, cleaning rules) is named by a test, and the ones that
   were only exercised through other functions get their own small case worked out by hand. The p-values and the
   least-squares line were checked with an independent statistics program. */
'use strict';

describe('formulas · small cases worked out by hand', () => {
  const P = () => Parsers.lib();

  it('least-squares line: slope, intercept and R² of three points', () => {
    const f = P().linearFit([1, 2, 3], [2, 4, 7]);
    near(f.slope, 2.5, 1e-12); near(f.intercept, -2 / 3, 1e-12);
    near(f.r2, 1 - (1 / 6) / (38 / 3), 1e-12, 'R² = 1 − SSE/SST = 1 − 0.1667/12.667');
    eq(P().linearFit([1], [1]), null, 'one point');
    eq(P().linearFit([2, 2], [1, 5]), null, 'no spread in x');
    eq(P().linearFit([1, 2], [3, 3]).r2, 1, 'a flat line fits exactly');
  });

  it('Kolmogorov-Smirnov p-value with Stephens’ correction: λ = (√n + 0.12 + 0.11/√n)·D', () => {
    near(P().ksPValue(0.1102311, 15), 0.989389679805006, 1e-9);
    near(P().ksPValue(0.15, 100), 0.0197317547498698, 1e-9);
    near(P().ksPValue(0.3, 40), 0.00108837293666464, 1e-9);
    eq(P().ksPValue(0.2, 0), null);
    eq(P().ksPValue(0, 30), 1);
  });

  it('paths: betweenness, closeness, diameter and mean distance of a path and of a graph in two pieces', () => {
    const path = P().pathMetrics(P().graph(4, [[0, 1, 1, 1], [1, 2, 1, 1], [2, 3, 1, 1]]));
    deepEq([...path.betweenness], [0, 2, 2, 0], 'the middle nodes lie on 2 shortest paths each');
    near(path.betweennessNorm[1], 2 / 3, 1e-12, 'divided by (n − 1)(n − 2)/2 = 3');
    deepEq([...path.closeness].map(x => +x.toFixed(12)), [0.5, 0.75, 0.75, 0.5], '3 / Σ distances');
    eq(path.diameter, 3); near(path.meanDistance, 20 / 12, 1e-12);
    const pieces = P().pathMetrics(P().graph(3, [[0, 1, 1, 1]]));
    deepEq([...pieces.closeness], [0.5, 0.5, 0], 'Wasserman–Faust: (reached/(n−1)) · (reached/Σd)');
    eq(pieces.diameter, 1); eq(pieces.meanDistance, 1);
  });

  it('seeded random numbers: reproducible, in [0, 1) and even', () => {
    const a = P().seededRandom(42), b = P().seededRandom(42), c = P().seededRandom(43);
    const xa = Array.from({ length: 5 }, a), xb = Array.from({ length: 5 }, b), xc = Array.from({ length: 5 }, c);
    deepEq(xa, xb); ok(xa.join() !== xc.join(), 'another seed, another sequence');
    near(P().seededRandom(1)(), 0.6270739405881613, 1e-15, 'first value of the published generator (mulberry32) with seed 1');
    eq(P().seededRandom(0)(), P().seededRandom(1)(), 'seed 0 is taken as 1');
    const r = P().seededRandom(7);
    let sum = 0, min = 1, max = 0;
    for (let i = 0; i < 20000; i++) { const x = r(); sum += x; if (x < min) min = x; if (x > max) max = x; }
    ok(min >= 0 && max < 1, 'range'); near(sum / 20000, 0.5, 0.01, 'mean of 20,000 draws');
  });

  it('surnames, reference texts and the keys of a cited work', () => {
    eq(P().surnameOf({ last: 'Cadena-Iñiguez' }), 'cadenainiguez');
    eq(P().surnameOf({ last: 'O’Brien' }), 'obrien');
    eq(P().surnameOf(null), '');
    eq(P().referenceText({ raw: 'SMITH J, 2001, NATURE, V1, P1' }), 'smith j 2001 nature v1 p1');
    eq(P().referenceText({ raw: 'Lira R., (2018) Econ. Bót. 72: 1–10' }), 'lira r 2018 econ bot 72 1 10', 'accents and dashes');
    const ref = Object.assign(P().newRef('Lira R, 2018, ECON BOT, V72, P50'), { firstAuthor: 'Lira R', year: 2018, volume: '72', page: '50-60', doi: '10.1000/eb.2' });
    deepEq(P().referenceKeys(ref), ['d:10.1000/eb.2', 'b:lira|2018|72|50', 't:lira r 2018 econ bot v72 p50']);
    ok(P().referenceKeys(ref) === P().referenceKeys(ref), 'kept per reference object');
    deepEq(P().referenceKeys(P().newRef('w2741809807')), ['w:W2741809807'], 'catalogue identifier');
    deepEq(P().referenceKeys(Object.assign(P().newRef('Anonymous report'), { year: 2010 })), ['t:anonymous report'], 'without volume and page only the text');
  });

  it('institution keys and names, and the institutions of a record', () => {
    eq(P().institutionKey('Universidad Nacional  Autónoma de México '), 'universidad nacional autonoma de mexico');
    eq(P().normalizeInstitution('[Lira, R.] Univ. Natl. Autonoma Mexico.'), 'University National Autonoma Mexico');
    eq(P().normalizeInstitution('USDA ARS, BELTSVILLE AGR RES CTR'), 'USDA Ars, Beltsville Agricultural Research Center');
    eq(P().normalizeInstitution('  '), '');
    const affA = 'Department of Plant Sciences, University of California, Davis, USA', affB = 'Instituto de Ecología A.C., Xalapa, Mexico';
    const rec = Object.assign(P().newRecord(), { authors: [P().person('Soto, B.'), P().person('Ruiz, C.')], affiliations: [affB] });
    rec.authors[0].affiliations = [affA]; rec.authors[1].affiliations = [affA];
    deepEq(P().recordInstitutions(rec), [P().institutionOf(affA)], 'from the authors, once');
    rec.authors.forEach(a => { a.affiliations = []; });
    deepEq(P().recordInstitutions(rec), [P().institutionOf(affB)], 'authors without affiliations: those of the record');
    rec.institutions = ['Cleaned name'];
    deepEq(P().recordInstitutions(rec), ['Cleaned name'], 'the names from Cleaning win');
  });

  it('cited sources and authors written several ways are named by the mixed-case spelling, then the most cited', () => {
    const G = P().citedSourceGroups(new Map([['ECONOMIC BOTANY', 5], ['Economic Botany', 2], ['economic botany', 1]]));
    eq(new Set(G.groupOf.values()).size, 1, 'one source');
    eq([...G.labels.values()][0], 'Economic Botany');
    const T = P().citedSourceGroups(new Map([['PLANT J', 4], ['plant j', 3]]));
    eq([...T.labels.values()][0], 'plant j', 'without mixed case, lower case before capitals');
    const clusters = { rows: [{ firstAuthor: 'LIRA R', citations: 3 }, { firstAuthor: 'Lira R.', citations: 1 }, { firstAuthor: 'Cruz A', citations: 2 }], byDoc: [] };
    const A = P().citedLists(clusters, 'authors');
    deepEq([A.labels.get('lira|r'), A.labels.get('cruz|a')], ['Lira R.', 'Cruz A']);
  });

  it('duplicates: DOI of a link, surname of the first author and completeness score', () => {
    eq(P().normDoi('https://doi.org/10.1000/ABC.1'), '10.1000/abc.1');
    eq(P().firstSurname({ authors: [{ last: 'Cadena-Iñiguez' }, { last: 'Lira' }] }), 'cadenainiguez');
    eq(P().firstSurname({ authors: [] }), '');
    const r = P().newRecord();
    eq(P().recordScore(r), 0, 'an empty record');
    Object.assign(r, { title: 'T', doi: '10.1/x', authorKeywords: ['a'], timesCited: 0, authors: [P().person('Lira, R.')] });
    r.authors[0].affiliations = ['Instituto de Ecología, Mexico'];
    eq(P().recordScore(r), 6, 'title + DOI + authors + affiliations + keywords + a citation count (0 counts)');
  });
});

describe('formulas · every engine function is named by a test', () => {
  const ENGINE_PARTS = ['smpOverview', 'smpSources', 'smpAuthorMetrics', 'smpDocuments', 'smpFactorial', 'smpPrisma', 'smpNetBuild',
    'smpNetCommunities', 'smpNetMetrics', 'smpNetLayout', 'smpNetAnalysis', 'smpThematic', 'smpIntellectual', 'smpSocial',
    'smpDedup', 'smpAuthors', 'smpInstitutions', 'smpTerms', 'smpFilters', 'smpStrategy'];

  it('each function the engine parts define appears in the code of at least one test suite', () => {
    const P = Parsers.lib();
    const parts = window.PARSER_PARTS.filter(fn => ENGINE_PARTS.includes(fn.name));
    eq(parts.length, ENGINE_PARTS.length, 'all the engine parts are loaded');
    /* the names each part assigns (reads fall back to the full library, writes are only recorded) */
    const defined = [];
    for (const part of parts) {
      const names = [];
      const probe = new Proxy(Object.create(P), { set(target, key, value) { if (typeof value === 'function') names.push(key); return true; } });
      part(probe);
      names.forEach(n => defined.push([part.name, n]));
    }
    ok(defined.length > 100, 'functions found: ' + defined.length);
    const bodies = TestHarness.suites.map(s => s.source).join('\n');   // each describe with its tests and helpers
    const missing = defined.filter(([, n]) => !new RegExp('\\b' + n + '\\b').test(bodies)).map(([p, n]) => p + '.' + n);
    deepEq(missing, []);
  });
});
