/* Cleaning, merging and filters: edit distance, duplicates, merging, authors, institutions,
   country aliases, terms and synonyms, filters, the pipeline and its screens. */
'use strict';

function mkRec(o) {
  const P = Parsers.lib();
  const r = Object.assign(P.newRecord(), o);
  r.authors = (o.authors || []).map(a => (typeof a === 'string' ? P.person(a) : a));
  r.authors.forEach((a, i) => { if (o.affs && o.affs[i]) a.affiliations = [o.affs[i]]; });
  return P.finish(r);
}

describe('cleaning · edit distance', () => {
  /* classic full dynamic programming, written independently of the banded version */
  function levenshtein(a, b) {
    const d = Array.from({ length: a.length + 1 }, (x, i) => [i].concat(new Array(b.length).fill(0)));
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[a.length][b.length];
  }
  it('the banded distance agrees with the full computation on 400 random pairs', () => {
    const r = rng(20260916), P = Parsers.lib();
    const alphabet = 'abcde fgh';
    const word = n => Array.from({ length: n }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
    const mutate = s => { let t = s; const k = Math.floor(r() * 5); for (let i = 0; i < k; i++) { const p = Math.floor(r() * (t.length + 1)); const op = r(); t = op < 0.33 ? t.slice(0, p) + word(1) + t.slice(p) : op < 0.66 ? t.slice(0, p) + t.slice(p + 1) : t.slice(0, p) + word(1) + t.slice(p + 1); } return t; };
    const bad = [];
    for (let i = 0; i < 400; i++) {
      const a = word(5 + Math.floor(r() * 40)), b = r() < 0.7 ? mutate(a) : word(5 + Math.floor(r() * 40));
      const max = Math.floor(r() * 8);
      const full = levenshtein(a, b);
      const band = P.levenshteinWithin(a, b, max);
      const expected = full <= max ? full : max + 1;
      if (band !== expected) bad.push([a, b, max, full, band]);
    }
    deepEq(bad, []);
  });
  it('title similarity and normalisation', () => {
    const P = Parsers.lib();
    eq(P.normTitle('Morphological <i>Diversity</i> of Chayote: a “Review”!'), 'morphological diversity of chayote a review');
    near(P.titleSimilarity('morphological diversity of chayote landraces', 'morphologic diversity of chayote landraces', 0.9), 1 - 2 / 44, 1e-9);
    eq(P.titleSimilarity('abcdefghij', 'zzzzzzzzzz', 0.95), 0);
  });
});

describe('cleaning · duplicates', () => {
  const T = 'Morphological diversity of chayote (Sechium edule) landraces in central Mexico';
  const items = [
    { id: 'a', doi: '10.1000/ABC.1', title: 'First title here', year: 2019, surname: 'lira' },
    { id: 'b', doi: 'https://doi.org/10.1000/abc.1', title: 'A different title altogether', year: 2020, surname: 'lira' },
    { id: 'c', doi: '', title: T, year: 2019, surname: 'cadenainiguez' },
    { id: 'd', doi: '10.2000/x', title: T.replace('Morphological', 'Morphologic'), year: 2019, surname: 'cadenainiguez' },
    { id: 'e', doi: '10.3000/e', title: 'Same title with conflicting identifiers', year: 2018, surname: 'smith' },
    { id: 'f', doi: '10.3000/f', title: 'Same title with conflicting identifiers', year: 2018, surname: 'smith' },
    { id: 'g', doi: '', title: 'Same title but different years apart', year: 2010, surname: 'smith' },
    { id: 'h', doi: '', title: 'Same title but different years apart', year: 2012, surname: 'smith' },
    { id: 'i', doi: '', title: 'Same title different first authors', year: 2015, surname: 'smith' },
    { id: 'j', doi: '', title: 'Same title different first authors', year: 2015, surname: 'jones' },
    { id: 'k', doi: '10.4000/k', title: 'Transitive chain of records number one', year: 2021, surname: 'barreraguzman' },
    { id: 'l', doi: '10.4000/K', title: 'Transitive chain of records number one', year: 2021, surname: 'guzman' },
    { id: 'm', doi: '', title: 'Transitive chain of records number one.', year: 2021, surname: 'barreraguzman' },
  ];
  it('same DOI, similar title, and never across conflicting DOIs, years or surnames', () => {
    const groups = Parsers.lib().findDuplicateGroups(items, { threshold: 0.95 });
    deepEq(groups.map(g => [g.ids.join(''), g.reason]), [['ab', 'doi'], ['cd', 'title'], ['klm', 'mixed']]);
    ok(groups[1].similarity >= 0.95 && groups[1].similarity < 1, 'similarity kept');
  });
  it('a higher threshold stops near matches', () => {
    const groups = Parsers.lib().findDuplicateGroups(items, { threshold: 0.99 });
    ok(!groups.some(g => g.ids.includes('c')), 'c and d stay apart at 0.99');
  });
  it('one year apart only across files; numbered parts stay apart; DOI suffixes of links are ignored', () => {
    const P = Parsers.lib();
    const S = 'Fruit set of chayote under greenhouse conditions in the highlands';
    const list = [
      { id: 'y1', doi: '', title: S, year: 2002, surname: 'lira', file: 1 },
      { id: 'y2', doi: '', title: S + '.', year: 2003, surname: 'lira', file: 2 },          // print vs online year, other file → same
      { id: 'y3', doi: '', title: S.toUpperCase(), year: 2005, surname: 'lira', file: 1 },  // two or more years apart → different
      { id: 'w1', doi: '', title: 'Seed dormancy of chayote cultivars stored at low temperature', year: 2011, surname: 'ruiz', file: 1 },
      { id: 'w2', doi: '', title: 'Seed dormancy of chayote cultivars stored at low temperatures', year: 2012, surname: 'ruiz', file: 1 }, // same file → different
      { id: 'z1', doi: '', title: 'Chayote germplasm in southern Mexico part I', year: 2010, surname: 'cruz', file: 1 },
      { id: 'z2', doi: '', title: 'Chayote germplasm in southern Mexico part II', year: 2010, surname: 'cruz', file: 2 },
      { id: 'q1', doi: '10.5000/q1', title: 'Pollination biology of chayote in orchards', year: 2015, surname: 'soto', file: 1 },
      { id: 'q2', doi: '', title: 'Pollination biology of chayote in orchards', year: 2015, surname: 'soto', file: 2 },
      { id: 'q3', doi: '10.5000/q3', title: 'Pollination biology of chayote in orchard', year: 2015, surname: 'soto', file: 3 },
    ];
    const groups = P.findDuplicateGroups(list, { threshold: 0.95 });
    deepEq(groups.map(g => g.ids.join(' ')), ['q1 q2 q3', 'y1 y2']);
    eq(groups[0].doiConflict, true, 'a record without DOI joined two different DOIs');
    eq(groups[1].doiConflict, false);
    eq(P.findDuplicateGroups(list, { threshold: 0.95, yearTolerance: 0 }).some(g => g.ids.includes('y2')), false, 'tolerance 0 keeps exact years');
    ok(P.numbersDiffer('study 1 of maize', 'study 2 of maize') && !P.numbersDiffer('maize 2019 trial', 'maize trial 2019'), 'numbers compared as sets');
    eq(P.doiOf('https://doi.org/10.1051/agro:19820705/pdf'), '10.1051/agro:19820705');
    eq(P.doiOf('10.3389/fpls.2020.00001/full'), '10.3389/fpls.2020.00001');
  });
  it('finds every planted near-duplicate among 3,000 random titles, without false positives', () => {
    const r = rng(7), P = Parsers.lib();
    const words = 'plant maize chayote diversity genetic landrace soil yield water stress fruit analysis growth seed leaf root climate model network population'.split(' ');
    const title = () => Array.from({ length: 8 + Math.floor(r() * 6) }, () => words[Math.floor(r() * words.length)]).join(' ') + ' ' + Math.floor(r() * 1e6);
    const list = [];
    for (let i = 0; i < 3000; i++) list.push({ id: 'r' + i, doi: '', title: title(), year: 2000 + Math.floor(r() * 25), surname: 'author' + Math.floor(r() * 400) });
    const planted = [];
    for (let k = 0; k < 60; k++) {
      const src = list[Math.floor(r() * 3000)];
      const copy = { id: 'p' + k, doi: '', title: src.title.toUpperCase().replace(/ /, '  ') + '.', year: src.year, surname: src.surname };
      list.push(copy); planted.push([src.id, copy.id]);
    }
    const groups = P.findDuplicateGroups(list, { threshold: 0.95 });
    const together = (a, b) => groups.some(g => g.ids.includes(a) && g.ids.includes(b));
    eq(planted.filter(([a, b]) => !together(a, b)).length, 0, 'missed planted pairs');
    const extra = groups.filter(g => !g.ids.some(id => id.startsWith('p')));
    eq(extra.length, 0, 'groups without a planted copy');
  });
  it('merging keeps the most complete fields, the highest citation count and where each came from', () => {
    const P = Parsers.lib();
    const a = mkRec({ id: 'x1', fileId: 1, source: 'idxA', title: 'Chayote landraces', year: 2019, doi: '10.1/a', timesCited: 12, abstract: 'Short.',
      authors: ['Lira, R'], issn: ['1111-1111'], openAccess: false, references: [P.newRef('r1')], docTypeRaw: 'Article' });
    const b = mkRec({ id: 'x2', fileId: 2, source: 'idxB', title: 'Chayote landraces', year: 2019, doi: '10.1/a', timesCited: 15, abstract: 'A much longer abstract text.',
      authors: ['Lira, Rafael', 'Cadena, Jorge'], affs: ['Univ Example, Mexico City, Mexico', 'Colegio Example, Texcoco, Mexico'], issn: ['2222-2222'], openAccess: true,
      references: [P.newRef('r1'), P.newRef('r2')], authorKeywords: ['chayote'] });
    const m = P.mergeGroup([a, b]);
    eq(m.timesCited, 15); eq(m.abstract, 'A much longer abstract text.'); eq(m.authors.length, 2); eq(m.references.length, 2);
    deepEq(m.issn.slice().sort(), ['1111-1111', '2222-2222']); eq(m.openAccess, true); deepEq(m.authorKeywords, ['chayote']);
    deepEq(m.sources.sort(), ['idxA', 'idxB']);
    deepEq(m.mergedFrom.map(x => x.id), ['x1', 'x2']);
    eq(m.baseId, 'x2');
    deepEq(Object.keys(m.mergeLog).sort(), ['docType', 'docTypeRaw']);
    const m2 = P.mergeGroup([mkRec({ id: 'y1', title: 'T', abstract: 'Longest abstract of both records.', timesCited: 3, authors: ['A, B'], authorKeywords: ['k1', 'k2'], references: [P.newRef('r')], doi: '10.1/y' }),
      mkRec({ id: 'y2', title: 'T', abstract: 'Short', timesCited: 9, authors: ['A, B'], affs: ['Univ X, Lima, Peru'], doi: '10.1/y', indexKeywords: ['i'], subjectAreas: ['s'], language: 'en', languages: ['en'] })]);
    eq(m2.baseId, 'y2'); eq(m2.timesCited, 9); eq(m2.mergeLog.timesCited, undefined);
    deepEq([m2.mergeLog.abstract, m2.mergeLog.references, m2.mergeLog.authorKeywords], ['y1', 'y1', 'y1']);
    eq(m2.abstract, 'Longest abstract of both records.'); deepEq(m2.indexKeywords, ['i']);
  });
});

describe('cleaning · authors, institutions and countries', () => {
  it('author keys ignore accents, hyphens and case; labels are "Surname, I."', () => {
    const P = Parsers.lib();
    const k = s => P.authorKey(P.person(s));
    eq(k('Cadena-Iñiguez, Jorge'), k('Cadena Iniguez J'));
    eq(k('Cadena-Iñiguez, Jorge'), 'cadenainiguez|j');
    ok(k('Cadena-Iñiguez J.C.') !== k('Cadena-Iñiguez J.'));
    eq(P.authorLabel(P.person('Barrera-Guzmán L.Á.')), 'Barrera-Guzmán, L.Á.');
  });
  it('variants with the same surname and first initial are grouped with their shared co-authors', () => {
    const P = Parsers.lib();
    const recs = [
      mkRec({ title: 'a', authors: ['Soares, L.A.A.', 'Lima, G.S.', 'Nobre, R.G.'] }),
      mkRec({ title: 'b', authors: ['Soares, L.A.A.', 'Lima, G.S.'] }),
      mkRec({ title: 'c', authors: ['Soares, L.A.D.A.', 'Lima, G.S.', 'Nobre, R.G.'] }),
      mkRec({ title: 'd', authors: ['Pereira, W.E.'] }),
    ];
    const groups = P.authorVariantGroups(recs);
    eq(groups.length, 1);
    deepEq(groups[0].variants.map(v => [v.label, v.docs, v.shared]), [['Soares, L.A.A.', 2, null], ['Soares, L.A.D.A.', 1, 2]]);
  });
  it('institution of an affiliation', () => {
    const P = Parsers.lib();
    const cases = [
      ['Department of Food Science, National Chung Hsing University, Taichung, Taiwan', 'National Chung Hsing University'],
      ['Univ Calif Davis, Dept Plant Sci, Davis, CA 95616 USA', 'University California Davis'],
      ['NATL INST AGR RES, TOKYO, JAPAN', 'National Institute Agricultural Research'],
      ['Colegio de Postgraduados, Campus San Luis Potosí, Salinas de Hidalgo, 78600, Mexico', 'Colegio de Postgraduados'],
      ['Grupo Interdisciplinario de Investigación en Sechium edule (GISeM), Texcoco, 56153, Mexico', 'Grupo Interdisciplinario de Investigación en Sechium edule (GISeM)'],
      ['Instituto Federal de Educação, Ciência e Tecnologia da Paraíba, Sousa, PB, Brazil', 'Instituto Federal de Educação, Ciência e Tecnologia da Paraíba'],
      ['[Lira, Rafael] Hospital Example, Lima, Peru.', 'Hospital Example'],
      /* units whose names carry an organisation word give way to the university */
      ['Academic Unit of Agricultural Sciences, Center of Agrifood Science and Technology, Universidade Federal de Campina Grande, Pombal, PB, Brazil', 'Universidade Federal de Campina Grande'],
      ['Unidad Académica de Agricultura, Universidad Autónoma de Nayarit, Xalisco, Mexico', 'Universidad Autónoma de Nayarit'],
      ['Graduate School of Agriculture, Kyoto University, Kyoto, Japan', 'Kyoto University'],
      ['Facultad de Ciencias, Escuela Superior Politécnica de Chimborazo, Riobamba, Ecuador', 'Escuela Superior Politécnica de Chimborazo'],
      ['Institute of Plant Science, University of Example, Example, UK', 'Institute of Plant Science'],
      ['Universidade Federal de Campina Grande/Programa de Pos-Graduacao em Engenharia Agricola, Campina Grande, PB, Brazil', 'Universidade Federal de Campina Grande'],
      ['Programa de Pós-Graduação em Agronomia / Universidade Federal da Paraíba, Areia, Brazil', 'Universidade Federal da Paraíba'],
    ];
    deepEq(cases.map(c => P.institutionOf(c[0])), cases.map(c => c[1]));
  });
  it('user country aliases are consulted before the built-in table', () => {
    const P = Parsers.lib();
    const aliases = P.countryAliasMap([{ text: 'Puerto Rico', code: 'US' }, { text: 'MD', code: 'US' }, { text: 'bad', code: 'xx' }]);
    eq(aliases.size, 2);
    eq(P.countryOf('Univ Puerto Rico, Mayaguez, Puerto Rico'), 'PR');
    eq(P.countryOf('Univ Puerto Rico, Mayaguez, Puerto Rico', aliases), 'US');
    eq(P.countryOf('USDA-ARS, Beltsville, MD.'), null);
    eq(P.countryOf('USDA-ARS, Beltsville, MD.', aliases), 'US');
  });
});

describe('cleaning · terms and synonyms', () => {
  const P = () => Parsers.lib();
  const stop = new Set(['of', 'the', 'in', 'and', 'a']);
  it('bigrams do not cross stop words', () => {
    deepEq(P().bigrams('Genetic diversity of maize landraces in the Mexican highlands', stop), ['genetic diversity', 'maize landraces', 'mexican highlands']);
    deepEq(P().tokens('Post-harvest quality: 2020 results'), ['post-harvest', 'quality', 'results']);
  });
  it('synonyms and stop words apply to keywords, without accents or case', () => {
    const r = mkRec({ title: 'x', authorKeywords: ['Corn', 'maize', 'Maïze landraces', 'Mexico'] });
    const dict = { synonyms: P().synonymMap([{ from: 'corn', to: 'maize' }, { from: 'maize landraces', to: 'Landraces' }]), stop: new Set(['mexico']) };
    deepEq(P().termsOf(r, 'authorKeywords', dict), ['maize', 'landraces']);
  });
  it('built-in stop words cut word pairs but keep keywords such as ITS; words the user adds exclude whole keywords', async () => {
    Pipeline.settings = null; Prefs.del('stopwords'); Pipeline._dict = null;
    const r = mkRec({ title: 'ITS sequences reveal cryptic species', authorKeywords: ['ITS', 'Mexico', 'Phylogeny'] });
    const builtIn = Pipeline.dict();
    ok(builtIn.stop.has('its') && !builtIn.keywordStop.size, 'the built-in list cuts pairs only');
    deepEq(P().termsOf(r, 'authorKeywords', builtIn), ['its', 'mexico', 'phylogeny']);
    deepEq(P().termsOf(r, 'titles', builtIn), ['sequences reveal', 'reveal cryptic', 'cryptic species']);
    await Pipeline.update({ stopwords: { es: P().STOPWORDS.es.slice(), en: P().STOPWORDS.en.concat(['México']) } });
    const added = Pipeline.dict();
    deepEq([...added.keywordStop], ['mexico']);
    deepEq(P().termsOf(r, 'authorKeywords', added), ['its', 'phylogeny']);
    Prefs.del('stopwords'); Pipeline.settings = null; Pipeline._dict = null;
  });
  it('counts per document use the preferred spelling', () => {
    const recs = [mkRec({ title: 'a', authorKeywords: ['Corn'] }), mkRec({ title: 'b', authorKeywords: ['maize'] }), mkRec({ title: 'c', authorKeywords: ['Maize', 'corn'] })];
    const none = { synonyms: new Map(), stop: new Set() };
    deepEq(P().termCounts(recs, 'authorKeywords', none).map(x => [fold(x.term), x.docs]), [['corn', 2], ['maize', 2]]);
    const dict = { synonyms: P().synonymMap([{ from: 'corn', to: 'maize' }]), stop: new Set() };
    deepEq(P().termCounts(recs, 'authorKeywords', dict).map(x => [x.term, x.docs]), [['maize', 3]]);
  });
  it('suggests hyphen, punctuation, plural and near-spelling variants', () => {
    const counts = [{ key: 'post-harvest', term: 'post-harvest', docs: 9 }, { key: 'postharvest', term: 'postharvest', docs: 3 }, { key: 'post harvest', term: 'post harvest', docs: 1 },
      { key: 'landraces', term: 'landraces', docs: 5 }, { key: 'landrace', term: 'landrace', docs: 2 }, { key: 'antioxidant activity', term: 'antioxidant activity', docs: 4 },
      { key: 'antioxidant activities', term: 'antioxidant activities', docs: 1 }, { key: 'stress', term: 'stress', docs: 3 }, { key: 'chayote', term: 'chayote', docs: 8 },
      { key: 'sechium edule (jacq.) sw.', term: 'Sechium edule (Jacq.) Sw.', docs: 2 }, { key: 'sechium edule (jacq.) sw', term: 'Sechium edule (Jacq.) Sw', docs: 1 }];
    const sug = P().synonymSuggestions(counts);
    deepEq(sug.map(g => [g.preferred, g.variants.map(v => v.term).sort()]), [
      ['post-harvest', ['post harvest', 'postharvest']], ['landraces', ['landrace']], ['antioxidant activity', ['antioxidant activities']], ['Sechium edule (Jacq.) Sw.', ['Sechium edule (Jacq.) Sw']]]);
  });
  it('synonym tables survive a CSV round trip, with commas and quotes', () => {
    const rows = [{ from: 'corn', to: 'maize' }, { from: 'Zea mays, L.', to: 'maize' }, { from: 'the "chayote"', to: 'Sechium edule' }];
    deepEq(P().synonymsFromCsv(P().synonymsToCsv(rows)), rows);
    deepEq(P().synonymsFromCsv('﻿término;preferido\r\nmaiz;maize\r\n;empty\r\n'), [{ from: 'maiz', to: 'maize' }]);
  });
});

describe('cleaning · filters', () => {
  const P = () => Parsers.lib();
  const recs = [
    mkRec({ title: 'a', year: 2010, docTypeRaw: 'Article', languages: ['en'], sourceTitle: 'Econ Bot', subjectAreas: ['Plant Sciences'], timesCited: 50 }),
    mkRec({ title: 'b', year: 2015, docTypeRaw: 'Review', languages: ['es', 'en'], sourceTitle: 'Rev Mex', subjectAreas: ['Agriculture'], timesCited: 5 }),
    mkRec({ title: 'c', year: 2020, docTypeRaw: 'Article', languages: [], sourceTitle: 'econ bot', subjectAreas: [], timesCited: null }),
  ];
  const run = patch => P().applyFilters(recs, Object.assign(P().emptyFilters(), patch)).map(r => r.title).join('');
  it('each filter narrows the set; empty selections include everything', () => {
    eq(run({}), 'abc');
    eq(run({ yearFrom: '2012' }), 'bc'); eq(run({ yearTo: '2015' }), 'ab'); eq(run({ yearFrom: '2011', yearTo: '2019' }), 'b');
    eq(run({ docTypes: ['article'] }), 'ac'); eq(run({ languages: ['en'] }), 'ab'); eq(run({ languages: ['none'] }), 'c');
    eq(run({ sources: ['econ bot'] }), 'ac'); eq(run({ areas: ['agriculture'] }), 'b'); eq(run({ minCitations: '10' }), 'a');
    eq(run({ docTypes: ['article'], minCitations: '1' }), 'a');
    eq(P().filtersActive(P().emptyFilters()), false); eq(P().filtersActive(Object.assign(P().emptyFilters(), { areas: ['x'] })), true);
  });
  it('options come with their counts', () => {
    const o = P().filterOptions(recs);
    eq(o.yearMin, 2010); eq(o.yearMax, 2020);
    deepEq(o.docTypes, [{ value: 'article', n: 2 }, { value: 'review', n: 1 }]);
    deepEq(o.languages, [{ value: 'en', n: 2 }, { value: 'es', n: 1 }, { value: 'none', n: 1 }]);
    deepEq(o.sources, [{ value: 'econ bot', label: 'Econ Bot', n: 2 }, { value: 'rev mex', label: 'Rev Mex', n: 1 }]);
    eq(o.citedMax, 50);
  });
});

describe('cleaning · pipeline and screens', () => {
  const P = () => Parsers.lib();
  const load = async (records, name) => {
    ImportModule.addResult({ name: name || 'synthetic.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: P().completeness(records) });
    await Pipeline.pending;
  };
  const dataset = () => [
    mkRec({ title: 'Maize landraces of Mexico', year: 2015, doi: '10.9999/one', authors: ['Perales, H.', 'Golicher, D.'], authorKeywords: ['corn', 'landraces'], docTypeRaw: 'Article', languages: ['en'], timesCited: 40, sourceTitle: 'Econ Bot' }),
    mkRec({ title: 'Maize landraces of Mexico.', year: 2015, doi: '', authors: ['Perales H', 'Golicher D'], authorKeywords: ['maize', 'landraces'], docTypeRaw: 'Article', languages: ['en'], timesCited: 45, sourceTitle: 'Econ Bot' }),
    mkRec({ title: 'Chayote genetic resources', year: 2021, doi: '10.9999/two', authors: ['Cadena-Iñiguez, J.'], authorKeywords: ['chayote', 'corn'], docTypeRaw: 'Review', languages: ['es'], timesCited: 3, sourceTitle: 'Rev Mex' }),
    mkRec({ title: 'Seed systems of maize', year: 2008, doi: '10.9999/three', authors: ['Bellon, M.R.'], authorKeywords: ['maize'], docTypeRaw: 'Article', languages: ['en'], timesCited: 90, sourceTitle: 'Econ Bot' }),
  ];
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('countryAliases'); Prefs.del('institutionAliases'); Prefs.del('termField'); CleaningModule.tab = 'summary'; };

  it('duplicates are merged, the counter reads "N de M documentos" and merges can be undone', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    await load(dataset());
    eq(Pipeline.stats.identified, 4); eq(Pipeline.stats.duplicatesRemoved, 1); eq(Pipeline.stats.unique, 3);
    eq(el('docCounter').textContent, '3 de 3 documentos');
    ok(!el('docCounter').hidden, 'counter visible');
    const merged = state.clean.find(r => r.dupGroup);
    eq(merged.timesCited, 45); eq(merged.doi, '10.9999/one');
    const key = Pipeline.dup.groups[0].key;
    await Pipeline.setMerged(key, false);
    eq(state.clean.length, 4); eq(el('docCounter').textContent, '4 de 4 documentos');
    await Pipeline.setMerged(key, true);
    eq(state.clean.length, 3);
  });

  it('screen: the duplicates tab lists the group and its checkbox undoes the merge', async () => {
    CleaningModule.tab = 'duplicates'; App.render('cleaning');
    const group = el('dupList').querySelector('.dup-group');
    ok(group, 'group listed');
    eq(group.querySelectorAll('.dup-members li').length, 2);
    ok(group.querySelector('.dup-origin').textContent.includes('citas'), 'origin of the citation count');
    ok(!group.querySelector('.dup-conflict'), 'no DOI warning when the DOIs agree');
    group.querySelector('.dup-merge').click();
    await Pipeline.pending;
    eq(state.clean.length, 4);
    ok(el('dupList').querySelector('.dup-group').classList.contains('kept-apart'), 'shown as kept apart');
    el('dupList').querySelector('.dup-merge').click();
    await Pipeline.pending;
    eq(state.clean.length, 3);
  });

  it('criterion: a synonym (corn → maize) changes the keyword counts', async () => {
    CleaningModule.tab = 'terms'; App.render('cleaning');
    const count = term => { const row = [...el('termCounts').querySelectorAll('tbody tr')].find(tr => fold(tr.children[0].textContent) === term); return row ? +row.children[1].textContent : 0; };
    eq(count('corn'), 2); eq(count('maize'), 1);   // the merged record keeps the keywords of the more complete one (corn)
    const form = el('synonyms').querySelector('form');
    form.querySelector('.pair-from').value = 'corn';
    form.querySelector('.pair-to').value = 'maize';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await Pipeline.pending;
    eq(count('corn'), 0); eq(count('maize'), 3);
    deepEq(Prefs.get('synonyms'), [{ from: 'corn', to: 'maize' }]);
    ok(el('synonyms').querySelector('.pair-list').textContent.includes('corn'), 'listed');
  });

  it('criterion: filters change the document counter', async () => {
    CleaningModule.tab = 'filters'; App.render('cleaning');
    const chip = [...el('fDocTypes').querySelectorAll('input')].find(i => i.value === 'review');
    chip.click();
    await Pipeline.pending;
    eq(el('docCounter').textContent, '1 de 3 documentos');
    ok(el('docCounter').classList.contains('filtered'), 'highlighted');
    eq(el('filterResult').textContent, '1 de 3 documentos cumple los filtros.', 'singular verb with one document');
    const y = el('fYearFrom'); y.value = '2016'; y.dispatchEvent(new Event('change'));
    await Pipeline.pending;
    eq(el('docCounter').textContent, '1 de 3 documentos');
    el('filterClear').click();
    await Pipeline.pending;
    eq(el('docCounter').textContent, '3 de 3 documentos');
    eq(Pipeline.records().length, 3);
  });

  it('the term field is chosen once for the whole app', async () => {
    await Pipeline.update({ termField: 'titles' });
    const r = state.filtered.find(x => x.title.startsWith('Chayote'));
    deepEq(Pipeline.terms(r), ['chayote genetic', 'genetic resources']);
    await Pipeline.update({ termField: 'authorKeywords' });
  });

  it('when no record brings the chosen term field, the first field they bring is used and the user is told', async () => {
    const L = P();
    const rec = o => Object.assign(L.newRecord(), o);
    ok(!L.hasFieldData(rec({ authorKeywords: [' ', ''] }), 'authorKeywords'), 'blank keywords do not count');
    ok(L.hasFieldData(rec({ indexKeywords: ['maize'] }), 'indexKeywords'));
    ok(L.hasFieldData(rec({ title: 'Maize' }), 'titles') && !L.hasFieldData(rec({ title: 'Maize' }), 'abstracts'));
    const some = [rec({ title: 'A', indexKeywords: ['maize'] }), rec({ title: 'B' })];
    eq(L.termFieldFor(some, 'authorKeywords'), 'indexKeywords');
    eq(L.termFieldFor(some, 'titles'), 'titles', 'a field that some record brings is kept');
    eq(L.termFieldFor([rec({ title: 'Only a title' })], 'authorKeywords'), 'titles');
    eq(L.termFieldFor([rec({})], 'indexKeywords'), 'indexKeywords', 'nothing to choose from: unchanged');
    eq(L.termFieldFor([], 'abstracts'), 'abstracts');

    reset();
    eq(Pipeline.init().termField, 'authorKeywords');
    const shown = [];
    const realToast = window.toast;
    window.toast = (text, kind) => { shown.push(text); return realToast(text, kind); };
    try {
      await load([mkRec({ title: 'Passion fruit nutrition', year: 2020, authors: ['Lima, G.S.'], indexKeywords: ['Potassium', 'Passiflora'] }),
        mkRec({ title: 'Nitrogen doses', year: 2021, authors: ['Soares, L.A.A.'], indexKeywords: ['Nitrogen'] })]);
    } finally { window.toast = realToast; }
    eq(Pipeline.init().termField, 'indexKeywords');
    eq(Prefs.get('termField', null), null, 'the remembered choice is not changed');
    eq(shown.filter(x => x.includes('Palabras clave de índice')).length, 1, shown.join(' | '));
    eq(Pipeline.termLists().counts.length, 3, 'the terms of the index keywords are counted');
    CleaningModule.tab = 'summary'; App.render('cleaning');
    eq(el('termFieldAuto').textContent, 'Los documentos no traen palabras clave de autor: se eligió «Palabras clave de índice» como campo de términos; puedes cambiarlo en Limpieza y filtros.');
    ok(el('termField-indexKeywords').checked);
    el('termField-titles').checked = true; el('termField-titles').dispatchEvent(new Event('change'));
    await Pipeline.pending;
    App.render('cleaning');
    ok(!el('termFieldAuto'), 'the note goes away once the user chooses');
    eq(Pipeline.init().termField, 'titles');
    reset();
  });

  it('author variants can be joined and undone; every tab renders', async () => {
    reset();
    await load([
      mkRec({ title: 'one', year: 2020, authors: ['Soares, L.A.A.', 'Lima, G.S.'] }),
      mkRec({ title: 'two', year: 2021, authors: ['Soares, L.A.D.A.', 'Lima, G.S.'] }),
    ]);
    CleaningModule.tab = 'authors'; App.render('cleaning');
    const g = el('authorList').querySelector('.author-group');
    ok(g.classList.contains('status-open'), 'to review');
    g.querySelector('.author-join').click();
    await Pipeline.pending;
    deepEq(state.clean.map(r => r.authors[0].label), ['Soares, L.A.A.', 'Soares, L.A.A.']);
    eq(new Set(state.clean.map(r => r.authors[0].key)).size, 1);
    ok(el('authorList').querySelector('.author-group').classList.contains('status-joined'), 'joined');
    el('authorList').querySelector('.author-undo').click();
    await Pipeline.pending;
    eq(new Set(state.clean.map(r => r.authors[0].key)).size, 2);
    for (const tab of CleaningModule.TABS) { CleaningModule.tab = tab; App.render('cleaning'); ok(el('cpanel').textContent.length > 20, tab); }
    reset();
    await load([
      mkRec({ title: 'Pollination biology of chayote in orchards', year: 2015, doi: '10.9999/q1', authors: ['Soto, A.'] }),
      mkRec({ title: 'Pollination biology of chayote in orchards', year: 2015, doi: '', authors: ['Soto, A.'] }),
      mkRec({ title: 'Pollination biology of chayote in orchard', year: 2015, doi: '10.9999/q3', authors: ['Soto, A.'] }),
    ]);
    CleaningModule.tab = 'duplicates'; App.render('cleaning');
    eq(el('dupList').querySelectorAll('.dup-conflict').length, 1, 'records with different DOIs joined through one without DOI are flagged');
    reset();
    await Pipeline.pending;
    eq(state.clean, null);
    ok(el('docCounter').hidden, 'counter hidden without data');
  });

  it('screen: the institutions table counts like Authors (one row for «Paraíba» and «Paraiba»)', async () => {
    I18N.setLang('es'); reset();
    await load([
      mkRec({ title: 'Salt stress in yellow passion fruit', year: 2020, doi: '10.9999/p1', authors: ['Silva, A.'], affs: ['Universidade Federal da Paraíba, João Pessoa, Brazil'] }),
      mkRec({ title: 'Potassium doses in passion fruit', year: 2021, doi: '10.9999/p2', authors: ['Silva, A.'], affs: ['Universidade Federal da Paraíba, João Pessoa, Brazil'] }),
      mkRec({ title: 'Biofertilizer in passion fruit seedlings', year: 2022, doi: '10.9999/p3', authors: ['Lima, B.'], affs: ['Universidade Federal da Paraiba, Joao Pessoa, Brazil'] }),
      mkRec({ title: 'Irrigation of passion fruit', year: 2022, doi: '10.9999/p4', authors: ['Souza, C.'], affs: ['Federal University of Campina Grande, Campina Grande, Brazil'] }),
    ]);
    CleaningModule.tab = 'places'; App.render('cleaning');
    const cells = [...el('instTable').querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));
    deepEq(cells.map(c => [c[0], c[2]]), [['Universidade Federal da Paraíba', '3'], ['Federal University of Campina Grande', '1']]);
    deepEq(Parsers.lib().institutionsTable(state.clean).rows.map(r => [r.name, r.documents]), [['Universidade Federal da Paraíba', 3], ['Federal University of Campina Grande', 1]]);
    /* an alias written with other accents and spaces still applies */
    await Pipeline.update({ institutionAliases: [{ from: 'federal  university of campina grande', to: 'Universidade Federal de Campina Grande' }] });
    CleaningModule.tab = 'places'; App.render('cleaning');
    ok(el('instTable').textContent.includes('Universidade Federal de Campina Grande'), 'alias applied');
    reset();
  });

  it('screen: the countries table counts the countries of the authors too (as Authors does)', async () => {
    I18N.setLang('es'); reset();
    /* the catalogue linked one author to an institution of another country; the others' country comes from their text */
    const r = mkRec({ title: 'Stem bulging of passion fruit', year: 2019, doi: '10.9999/lk1', authors: ['Rajapaksha, R.', 'Edirimanna, E.'], affs: ['Horticultural Crop Research and Development Institute, Gannoruwa, Sri Lanka', 'Fruit Crop Research and Development Institute, Horana'] });
    r.countries = ['CN']; r.authors[1].country = 'CN';
    await load([r]);
    CleaningModule.tab = 'places'; App.render('cleaning');
    const codes = [...el('countryTable').querySelectorAll('tbody tr')].map(tr => tr.querySelectorAll('td')[1].textContent.trim()).sort();
    deepEq(codes, ['CN', 'LK']);
    deepEq(Parsers.lib().countriesTable(state.clean).authors.map(x => x.code).sort(), codes, 'same countries as Authors');
    reset();
  });
});
