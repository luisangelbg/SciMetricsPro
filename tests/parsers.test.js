/* Readers: text helpers, names, countries, types, languages, references, every format, detection. */
'use strict';

const LIB = () => Parsers.lib();
const parse = (name, text) => LIB().parseText(name, text);

describe('parsers · text helpers', () => {
  it('decode: UTF-8 with and without BOM, UTF-16 LE, and single-byte fallback', () => {
    const P = LIB();
    const utf8 = new TextEncoder().encode('Año');
    eq(P.decode(utf8.buffer).text, 'Año');
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF, ...utf8]);
    deepEq(P.decode(bom.buffer), { text: 'Año', encoding: 'utf-8' });
    const u16 = new Uint8Array([0xFF, 0xFE, 0x41, 0x00, 0xF1, 0x00]);
    deepEq(P.decode(u16.buffer), { text: 'Añ', encoding: 'utf-16le' });
    const latin = new Uint8Array([0x41, 0xF1, 0x6F]);   // "Año" in a single-byte code page
    deepEq(P.decode(latin.buffer), { text: 'Año', encoding: 'latin1' });
  });
  it('LaTeX escapes become Unicode', () => {
    const P = LIB();
    eq(P.latex("Mar{\\'\\i}a Pe{\\~n}a M{\\\"u}ller"), 'María Peña Müller');
    eq(P.latex("\\'{e}t\\'e \\c{c}a {\\c C}ukurova"), 'été ça Çukurova');
    eq(P.latex('Smith \\& Sons, 50\\% -- 60\\%'), 'Smith & Sons, 50% – 60%');
    eq(P.latex('{DNA} of {\\ss}tra{\\ss}e'), 'DNA of ßtraße');
  });
  it('DOI, year and list helpers', () => {
    const P = LIB();
    eq(P.doiOf('https://doi.org/10.1590/EXAMPLE.2021.001.'), '10.1590/example.2021.001');
    eq(P.doiOf('doi: 10.1007/s10722-018-0733-3 [doi]'), '10.1007/s10722-018-0733-3');
    eq(P.doiOf('no doi here'), '');
    /* SICI DOIs: two papers of the same issue differ only inside "<…>" */
    const part1 = P.doiOf('BRAAM RR, 1991, J AM SOC INFORM SCI, V42, P233, DOI 10.1002/(SICI)1097-4571(199105)42:4<233::AID-ASI1>3.0.CO;2-I');
    eq(part1, '10.1002/(sici)1097-4571(199105)42:4<233::aid-asi1>3.0.co;2-i');
    ok(part1 !== P.doiOf('DOI 10.1002/(SICI)1097-4571(199105)42:4<252::AID-ASI2>3.0.CO;2-G'), 'parts I and II stay apart');
    eq(P.doiOf('10.1175/1520-0469(1988)045<0433:TSOCAI>2.0.CO;2'), '10.1175/1520-0469(1988)045<0433:tsocai>2.0.co;2');
    eq(P.doiOf('<doi>10.1000/xyz</doi>'), '10.1000/xyz', 'markup is not part of the DOI');
    eq(P.doiOf('10.1000/xyz<br>'), '10.1000/xyz');
    eq(P.yearOf('2019 Spring'), 2019);
    eq(P.yearOf('2020/05/01/'), 2020);
    eq(P.yearOf('vol 123'), null);
    deepEq(P.splitList(' a ;; b; ', ';'), ['a', 'b']);
    deepEq(P.uniq(['Café', 'cafe', 'Tea']), ['Café', 'Tea']);
  });
});

describe('parsers · personal names', () => {
  const cases = [
    ['Ramírez-Ojeda, Gabriela (57191977705)', 'Ramírez-Ojeda', 'Gabriela', 'G.', '57191977705'],
    ['Barrera-Guzmán L.Á.', 'Barrera-Guzmán', '', 'L.Á.'],
    ['Barrera Guzmán L.A.', 'Barrera Guzmán', '', 'L.A.'],
    ['Cadena-Iniguez, J', 'Cadena-Iniguez', '', 'J.'],
    ['Soto-Hernandez, RM', 'Soto-Hernandez', '', 'R.M.'],
    ['Ndukwe, O.O.', 'Ndukwe', '', 'O.O.'],
    ['Aguirre-Medina J. F.', 'Aguirre-Medina', '', 'J.F.'],
    ['Vieira WADS', 'Vieira', '', 'W.A.D.S.'],
    ['Vieira, Willie Anderson Dos Santos', 'Vieira', 'Willie Anderson Dos Santos', 'W.A.D.S.'],
    ['Souza, Gleyse L. F. de', 'de Souza', 'Gleyse L. F.', 'G.L.F.'],
    ['Flick, George J Jr', 'Flick', 'George J', 'G.J.'],
    ['Flick GJ Jr', 'Flick', '', 'G.J.'],
    ['Barrera-Guzmán, Luis Ángel', 'Barrera-Guzmán', 'Luis Ángel', 'L.Á.'],
    ['SMITH, JOHN', 'SMITH', 'JOHN', 'J.'],
    ['SMITH J', 'SMITH', '', 'J.'],
    ['Qiong Fan', 'Fan', 'Qiong', 'Q.'],
  ];
  it('last name, given name and initials in every export style', () => {
    const bad = [];
    for (const [raw, last, first, initials, id] of cases) {
      const p = LIB().person(raw);
      if (p.last !== last || p.first !== first || p.initials !== initials || (id && p.id !== id)) bad.push(raw + ' → ' + JSON.stringify([p.last, p.first, p.initials, p.id]));
    }
    deepEq(bad, []);
  });
  it('short form is surname plus initials; the suffix is kept apart', () => {
    const p = LIB().person('Flick, George J Jr');
    eq(p.short, 'Flick G.J.');
    eq(p.suffix, 'Jr');
    eq(LIB().person('Chayote Research Consortium').last, 'Consortium');
  });
});

describe('parsers · countries of affiliations', () => {
  const cases = [
    ['Colegio Postgrad, Campus San Luis Potosi, Salinas De Hidalgo 78600, San Luis Potosi, Mexico.', 'MX'],
    ['Univ Calif Davis, Dept Plant Sci, Davis, CA 95616 USA.', 'US'],
    ['Chinese Acad Sci, Beijing 100093, Peoples R China', 'CN'],
    ['Univ Oxford, Oxford OX1 3RB, England', 'GB'],
    ['Seoul Natl Univ, Seoul, South Korea', 'KR'],
    ['Univ Fed Vicosa, Vicosa, MG, Brazil', 'BR'],
    ['Universidade Federal da Paraíba, Areia, Brasil', 'BR'],
    ['Universidad de Costa Rica, San José', 'CR'],
    ['Instituto Tecnologico de Costa Rica (ITCR). aabdelnour@itcr.ac.cr', 'CR'],
    ['Hospital X, Mexico City 04510, Mexico. Electronic address: a@b.mx.', 'MX'],
    ['New Mexico State Univ, Las Cruces, NM 88003 USA', 'US'],
    ['New Mexico State University, Las Cruces, New Mexico', 'US'],
    ['Rutgers State Univ, New Brunswick, New Jersey', 'US'],
    ['Columbia Univ, New York, NY 10027', 'US'],
    ['Univ Witwatersrand, Johannesburg, South Africa1.', 'ZA'],
    ['Dept Agron, Coimbatore, Tamil Nadu 641003 India. ISNI: 0000 0001 2155 9899. GRID: grid.412906.8', 'IN'],
    ['Univ Kinshasa, Kinshasa, Dem Rep Congo', 'CD'],
    ['Univ Marien Ngouabi, Brazzaville, Rep Congo', 'CG'],
    ['Univ Papua New Guinea, Port Moresby, Papua N Guinea', 'PG'],
    ['Inst Pasteur, Abidjan, Cote Ivoire', 'CI'],
    ['Univ Zagreb, Zagreb, Croatia', 'HR'],
    ['Wageningen Univ, Wageningen, Netherlands', 'NL'],
    ['Natl Taiwan Univ, Taipei 10617, Taiwan', 'TW'],
    ['Univ Tehran, Karaj, Iran', 'IR'],
    ['Vietnam Acad Agr Sci, Hanoi, Vietnam', 'VN'],
    ['Univ Belgrade, Belgrade, Serbia', 'RS'],
    ['Univ Nairobi, Nairobi, Kenya', 'KE'],
    ['Universidad de Buenos Aires, Buenos Aires, Argentina', 'AR'],
    ['Postgraduate College. Campus San Luis Potosi.', null],
    ['Hopital Central, Nancy.', null],
  ];
  it('recognises 28 spellings and leaves addresses without a country empty', () => {
    const bad = cases.map(([a, c]) => [a, c, LIB().countryOf(a)]).filter(x => x[1] !== x[2]).map(x => x[0] + ' → ' + x[2] + ' (esperado ' + x[1] + ')');
    deepEq(bad, []);
  });
});

describe('parsers · document types and languages', () => {
  it('normalises document types from every source', () => {
    const P = LIB();
    const cases = [['Article', 'article'], ['Review', 'review'], ['Conference paper', 'conference'], ['Book chapter', 'chapter'],
      ['Article; Proceedings Paper', 'conference'], ['Article; Early Access', 'article'], ['Journal Article; Review', 'review'],
      ['Case Reports; Journal Article', 'article'], ['Editorial Material', 'editorial'], ['Erratum', 'erratum'], ['Letter', 'letter'],
      ['Book Review', 'other'], ['JOUR', 'article'], ['CHAP', 'chapter'], ['THES', 'thesis'], ['inproceedings', 'conference'],
      ['Journal Article; Retracted Publication', 'retracted'], ['Short survey', 'note'], ['Data paper', 'data'], ['Book', 'book']];
    deepEq(cases.map(([raw, code]) => [raw, P.docType(raw)]).filter(([raw, got], i) => got !== cases[i][1]), []);
  });
  it('language names and codes → ISO 639-1', () => {
    const P = LIB();
    deepEq(P.languages('Spanish; English'), ['es', 'en']);
    deepEq(P.languages('eng'), ['en']);
    deepEq(P.languages('por'), ['pt']);
    deepEq(P.languages('pt'), ['pt']);
    deepEq(P.languages('Portuguese'), ['pt']);
    deepEq(P.languages('Español'), ['es']);
    deepEq(P.languages('Chinese'), ['zh']);
    deepEq(P.languages(''), []);
  });
});

describe('parsers · cited references', () => {
  it('index B style: author, year, source, volume, page, DOI', () => {
    const P = LIB();
    const r = P.parseRefB('Newstrom LE, 1991, ECON BOT, V45, P175, DOI 10.1007/BF02862046');
    deepEq([r.firstAuthor, r.year, r.source, r.volume, r.page, r.doi], ['Newstrom LE', 1991, 'ECON BOT', '45', '175', '10.1007/bf02862046']);
    const a = P.parseRefB('[Anonymous], 2010, CATALOGO NACL VARIED');
    deepEq([a.firstAuthor, a.year, a.source], ['', 2010, 'CATALOGO NACL VARIED']);
    const b = P.parseRefB('Smith J, J ECOL, V12, P3');
    deepEq([b.firstAuthor, b.year, b.source], ['Smith J', null, 'J ECOL']);
    /* sources that start with P or V are not pages or volumes */
    deepEq(['Evans E, 2000, PLANT J, V4, P4', 'Lee K, 2005, P NATL ACAD SCI USA, V102, P1', 'Kim S, 2011, VIROLOGY, V410, P36', 'Ruiz A, 2019, PHYTOKEYS, V12, PE1234'].map(s => { const x = P.parseRefB(s); return [x.source, x.volume, x.page]; }),
      [['PLANT J', '4', '4'], ['P NATL ACAD SCI USA', '102', '1'], ['VIROLOGY', '410', '36'], ['PHYTOKEYS', '12', 'E1234']]);
    const c = P.parseRefB('Diaz M, 2001, V12, P3');
    deepEq([c.source, c.volume, c.page], ['', '12', '3']);
  });
  it('index A current style', () => {
    const P = LIB();
    const r = P.parseRefA('Montano N.M., Ayala F., Et al., Almacenes y flujos de carbono, Terra Latinoam, 34, pp. 39-59, (2016)');
    deepEq([r.firstAuthor, r.year, r.source, r.volume, r.page], ['Montano N.M.', 2016, 'Terra Latinoam', '34', '39']);
    const s = P.parseRefA('Aguirre-Medina J. F., Cadena-Iniguez J., Chayote in home gardens, Rev Mex Cienc Agric, 12, 3, pp. 1-9, (2021)');
    deepEq([s.firstAuthor, s.year, s.source, s.volume], ['Aguirre-Medina J. F.', 2021, 'Rev Mex Cienc Agric', '12']);
    const t = P.parseRefA('Kassambara A., Practical Guide to Principal Component Methods in R, (2017)');
    deepEq([t.firstAuthor, t.year, t.source], ['Kassambara A.', 2017, '']);
    const u = P.parseRefA('R: A Language and Environment for Statistical Computing, (2020)');
    deepEq([u.firstAuthor, u.year], ['', 2020]);
  });
  it('index A older style', () => {
    const r = LIB().parseRefA('Smith, J., Brown, A., Old style title (2010) Example Journal, 12 (3), pp. 45-67.');
    deepEq([r.firstAuthor, r.year, r.source, r.volume], ['Smith J.', 2010, 'Example Journal', '12']);
  });
  it('splitting a reference list keeps "; " that belongs inside one reference', () => {
    const list = LIB().splitRefsA('Agency, One health. Example Press; 2024, pp. 1-21; Lira R., Title, Journal, 2, (2001); Diario Oficial; declaratoria de vigencias, (2003); pdfLindsay WL, Soil test, SSSAJ, 42, (1978)');
    deepEq(list, ['Agency, One health. Example Press; 2024, pp. 1-21', 'Lira R., Title, Journal, 2, (2001)', 'Diario Oficial; declaratoria de vigencias, (2003)', 'pdfLindsay WL, Soil test, SSSAJ, 42, (1978)']);
  });
});

describe('parsers · delimited text', () => {
  it('RFC 4180: quotes, doubled quotes, line breaks inside fields, CRLF', () => {
    const rows = LIB().parseDelimited('a,"b,1","say ""hi"""\r\n"two\nlines",,x\r\n', ',');
    deepEq(rows, [['a', 'b,1', 'say "hi"'], ['two\nlines', '', 'x']]);
  });
  it('separator sniffing (comma, semicolon, tab)', () => {
    const P = LIB();
    eq(P.sniffSeparator('"a;b",c,d\n'), ',');
    eq(P.sniffSeparator('a;b;c\n'), ';');
    eq(P.sniffSeparator('PT\tAU\tTI\n'), '\t');
  });
  it('index A export: records, authors with ids, split affiliations, references, citations, open access', () => {
    const res = parse('export.csv', FIXTURES.idxaCsv);
    eq(res.source, 'idxA'); eq(res.format, 'csv');
    eq(res.records.length, 2);
    ok(res.warnings.some(w => w.code === 'dropped' && w.n === 1), 'untitled record dropped');
    const [a, b] = res.records;
    eq(a.title, 'Ecogeography of forage grasses, from arid to "semi-arid" regions');
    deepEq(a.authors.map(x => [x.full, x.short, x.id]), [['Ramírez-Ojeda, Gabriela', 'Ramírez-Ojeda G.', '57191977705'], ['Cadena-Iñiguez, Jorge', 'Cadena-Iñiguez J.', '23032961600']]);
    eq(a.authors[1].affiliations.length, 2);
    eq(a.affiliations.length, 3);
    deepEq(a.countries, ['MX']);
    eq(a.abstract, 'Arid areas are productive ecosystems. Grasses stand out among their species.');
    deepEq(a.authorKeywords, ['arid regions', 'climate change', 'Ecogeography']);
    deepEq(a.indexKeywords, ['grassland', 'climate']);
    eq(a.references.length, 3);
    eq(a.references[1].firstAuthor, 'Aguirre-Medina J. F.');
    eq(a.references[2].raw, 'Example Agency, One health approach. Advancing global health security. Example Press; 2024, pp. 1-21');
    eq(a.timesCited, 12); eq(a.year, 2024); eq(a.pages, '110-129'); eq(a.doi, '10.3390/grasses3020008');
    deepEq(a.languages, ['es', 'en']); eq(a.language, 'es');
    eq(a.docType, 'article'); eq(a.openAccess, true); eq(a.accession, '2-s2.0-105009505729');
    eq(a.correspondingAuthor, 'G. Ramírez-Ojeda'); eq(a.correspondingCountry, 'MX');
    deepEq(b.authors.map(x => x.short), ['Smith J.', 'Jones K.L.']);
    eq(b.abstract, ''); eq(b.timesCited, 0); eq(b.docType, 'conference'); eq(b.articleNumber, '4'); eq(b.openAccess, false);
    deepEq([b.references[0].firstAuthor, b.references[0].year, b.references[0].source], ['Smith J.', 2010, 'Example Journal']);
    ok(a.originalRaw.includes('EID: 2-s2.0-105009505729'), 'original row kept');
  });
  it('biomedical summary table and any other table, with empty fields (synthetic rows)', () => {
    const biomed = parse('csv-medline.csv', '﻿PMID,Title,Authors,Citation,First Author,Journal/Book,Publication Year,Create Date,PMCID,NIHMS ID,DOI\r\n' +
      '"30000011","Seed oil of chayote cultivars","Lira R, de Oliveira Filho ASB, Cruz A.","Econ Bot. 2021 Mar;75(2):101-110. doi: 10.1000/eb.21. Epub 2021 Jan 3.","Lira R","Econ Bot","2021","2021/01/04","","","10.1000/eb.21"\r\n' +
      '"30000012","Fruit set without a year column","Soto B.","Plants (Basel). 2019 Feb 24;8(5):1035.","Soto B","Plants (Basel)","","2019/03/11","","",""\r\n' +
      '"","","","","","","","","","",""\r\n');
    eq(biomed.source, 'biomed'); eq(biomed.records.length, 2, 'the empty row is skipped');
    const [a, b] = biomed.records;
    deepEq([a.pmid, a.accession, a.year, a.sourceTitle, a.doi, a.volume, a.issue, a.pages, a.docType], ['30000011', '30000011', 2021, 'Econ Bot', '10.1000/eb.21', '75', '2', '101-110', 'article']);
    deepEq(a.authors.map(x => x.last), ['Lira', 'de Oliveira Filho', 'Cruz']);
    deepEq([b.year, b.doi, b.volume, b.issue, b.pages, b.authors.length, b.timesCited], [2019, '', '8', '5', '1035', 1, null], 'year from the citation, no DOI, no citation count');
    const table = parse('tabla.csv', 'Título;Autores;Año;Revista;DOI;Palabras clave;Citations;Idioma\n' +
      'Diversidad del chayote;"Lira, R.; Cruz, A.";2020;Rev Mex;10.1000/rm.1;chayote, diversidad;7;Spanish\n' +
      'Registro casi vacío;;;;;;;\n');
    eq(table.source, 'table'); eq(table.records.length, 2);
    const [c, d] = table.records;
    deepEq([c.title, c.authors.map(x => x.last), c.year, c.sourceTitle, c.doi, c.authorKeywords, c.timesCited, c.languages], ['Diversidad del chayote', ['Lira', 'Cruz'], 2020, 'Rev Mex', '10.1000/rm.1', ['chayote', 'diversidad'], 7, ['es']]);
    deepEq([d.title, d.authors, d.year, d.sourceTitle, d.doi, d.authorKeywords, d.timesCited, d.languages], ['Registro casi vacío', [], null, '', '', [], null, []], 'empty fields stay empty');
    const ov = LIB().overview(table.records.concat(biomed.records), { refYear: 2026 });
    ok([ov.meanAge, ov.authorsPerDoc, ov.growthRate, ov.citations.mean].every(v => v === null || isFinite(v)), 'indicators of records with empty fields are numbers or empty');
  });
  it('a note above the headers is skipped (exports that start with a line such as "Exported on …")', () => {
    const P = LIB();
    eq(P.headerRow([['Exported on 17 Sep 2026'], ['Title', 'Authors', 'PubYear'], ['A', 'B', '2020']]), 1);
    eq(P.headerRow([['Title', 'Authors'], ['A', 'B']]), 0);
    eq(P.headerRow([['Title'], ['A'], ['B']]), 0, 'a one-column table keeps its header');
    eq(P.headerRow([['Note'], [''], ['', ''], ['Title', 'Authors']]), 3);
    const res = parse('export.csv', '"Exported on 17 Sep 2026, criteria: chayote"\nTitle,Authors,PubYear,Source title,DOI,Times cited\n' +
      '"Seed oil of chayote","Lira, R.; Cruz, A.",2021,Econ Bot,10.1000/eb.21,4\n');
    eq(res.source, 'table'); eq(res.records.length, 1);
    const r = res.records[0];
    deepEq([r.title, r.authors.map(a => a.last), r.year, r.sourceTitle, r.doi, r.timesCited], ['Seed oil of chayote', ['Lira', 'Cruz'], 2021, 'Econ Bot', '10.1000/eb.21', 4]);
    ok(!/Exported/.test(r.originalRaw), 'the note is not part of the record');
  });
  it('index B tab-delimited export gives the same record as the plain text', () => {
    const tab = parse('savedrecs.txt', FIXTURES.idxbTabbed);
    const txt = parse('savedrecs.txt', FIXTURES.idxbTagged);
    eq(tab.format, 'tabbed2'); eq(tab.source, 'idxB');
    const a = tab.records[0], b = txt.records[0];
    const pick = r => [r.title, r.year, r.doi, r.accession, r.timesCited, r.authors.map(x => x.short + '|' + x.affiliations.length), r.authorKeywords, r.indexKeywords, r.references.map(x => x.firstAuthor + '|' + x.year), r.correspondingCountry, r.docType, r.countries];
    deepEq(pick(a), pick(b));
  });
});

describe('parsers · index B plain text', () => {
  it('records, continuation lines, full names, addresses per author, reprint author', () => {
    const res = parse('savedrecs.txt', FIXTURES.idxbTagged);
    eq(res.format, 'tagged2'); eq(res.source, 'idxB');
    eq(res.records.length, 2);
    const r = res.records[0];
    eq(r.title, 'Morphological diversity of chayote (Sechium edule) landraces in central Mexico');
    deepEq(r.authors.map(a => [a.full, a.short]), [['Cadena-Iniguez, Jorge', 'Cadena-Iniguez J.'], ['Barrera-Guzman, Luis A.', 'Barrera-Guzman L.A.'], ['Soto-Hernandez, Ramon Marcos', 'Soto-Hernandez R.M.']]);
    deepEq(r.authors.map(a => a.affiliations.length), [1, 1, 2]);
    deepEq(r.authors.map(a => a.country), ['MX', 'MX', 'MX']);
    deepEq(r.countries.sort(), ['MX', 'US']);
    deepEq(r.authorKeywords, ['chayote', 'landraces', 'morphological diversity', 'conservation']);
    deepEq(r.indexKeywords, ['GENETIC-DIVERSITY', 'CUCURBITACEAE']);
    eq(r.abstract, 'Chayote is a cucurbit domesticated in Mesoamerica. We describe the morphological diversity of 120 accessions.');
    eq(r.references.length, 4);
    eq(r.references[2].doi, '10.1007/bf02862046');
    eq(r.timesCited, 12); eq(r.year, 2019); eq(r.volume, '66'); eq(r.pages, '575-590');
    eq(r.sourceAbbrev, 'Genet. Resour. Crop Evol.'); eq(r.docType, 'conference');
    eq(r.correspondingAuthor, 'Cadena-Iniguez, J'); eq(r.correspondingCountry, 'MX');
    deepEq(r.issn, ['0925-9864', '1573-5109']); eq(r.openAccess, true); eq(r.accession, 'ABC:000459191200004');
    deepEq(r.subjectAreas, ['Agriculture', 'Plant Sciences']);
    ok(r.originalRaw.startsWith('PT J') && r.originalRaw.endsWith('ER'), 'raw record');
    const s = res.records[1];
    eq(s.docType, 'review'); eq(s.timesCited, 0); eq(s.references.length, 0);
    ok(!res.warnings.some(w => w.code === 'fewDoi'), 'half of the records with DOI is not below the 50 % threshold');
  });
});

describe('parsers · biomedical tagged text', () => {
  it('author blocks, affiliations, collective author, DOI, headings, types', () => {
    const res = parse('biomed-set.nbib', FIXTURES.biomedTagged);
    eq(res.format, 'tagged4'); eq(res.source, 'biomed');
    eq(res.records.length, 2);
    const r = res.records[0];
    eq(r.pmid, '30000001');
    eq(r.title, 'Chayote (Sechium edule) extracts: a review of their antioxidant and antiproliferative properties');
    deepEq(r.authors.map(a => a.short), ['Vieira W.A.D.S.', 'Flick G.J.', 'Aguiniga-Sanchez I.', 'Chayote Research Consortium']);
    deepEq(r.authors.map(a => a.country), ['BR', 'US', 'MX', null]);
    eq(r.doi, '10.1016/j.example.2019.01.001');
    eq(r.year, 2019); eq(r.language, 'es'); eq(r.docType, 'review');
    deepEq(r.indexKeywords, ['Antioxidants', 'Cucurbitaceae', 'Humans']);
    deepEq(r.authorKeywords, ['chayote', 'antioxidants']);
    eq(r.sourceTitle, 'Journal of example food science'); eq(r.sourceAbbrev, 'J Example Food');
    eq(r.pages, '101-110'); deepEq(r.issn, ['1234-5678']); eq(r.timesCited, null);
    eq(r.abstract, 'Chayote is consumed in Mexico. Results show antioxidant activity in several genotypes.');
    eq(res.records[1].year, 2020);
    ok(res.warnings.some(w => w.code === 'noCitations'), 'no citation counts');
    ok(res.warnings.some(w => w.code === 'noReferences'), 'no references');
  });
});

describe('parsers · RIS', () => {
  it('reference manager RIS: particles, English abstract, DOI, dates, chapters', () => {
    const res = parse('library.ris', FIXTURES.risGeneric);
    eq(res.source, 'ris'); eq(res.records.length, 2);
    const r = res.records[0];
    deepEq(r.authors.map(a => a.short), ['de Souza G.L.F.', 'Cavalcante L.F.']);
    ok(r.abstract.startsWith('Passion fruit is a tropical fruit'), 'English abstract chosen');
    eq(r.doi, '10.1590/example.2021.001'); eq(r.year, 2021); eq(r.pages, '12-20');
    eq(r.sourceTitle, 'Revista Example de Agronomia'); eq(r.sourceAbbrev, 'Rev. Ex. Agron.');
    deepEq(r.authorKeywords, ['passion fruit', 'salinity', 'calcium']);
    eq(r.language, 'pt'); deepEq(r.issn, ['1415-4366']);
    const c = res.records[1];
    eq(c.docType, 'chapter'); eq(c.sourceTitle, 'Handbook of Tropical Fruits'); eq(c.year, 2020);
    deepEq(c.isbn, ['978-0-00-000000-2']); deepEq(c.issn, []);
  });
  it('index A RIS: notes with citations, correspondence and references; byte-order mark', () => {
    const res = parse('export.ris', FIXTURES.risIdxA);
    eq(res.source, 'idxA'); eq(res.records.length, 1);
    const r = res.records[0];
    eq(r.timesCited, 8); eq(r.correspondingAuthor, 'O.O. Ndukwe'); eq(r.correspondingCountry, 'NG');
    eq(r.references.length, 2); deepEq([r.references[0].firstAuthor, r.references[0].year], ['Smith J.', 2010]);
    deepEq(r.countries, ['NG']); eq(r.docType, 'article'); eq(r.sourceAbbrev, 'Afr. J. Ex. Econ.');
  });
});

describe('parsers · BibTeX', () => {
  it('index A dialect', () => {
    const res = parse('export.bib', FIXTURES.bibIdxA);
    eq(res.source, 'idxA'); eq(res.format, 'bibtex');
    const r = res.records[0];
    deepEq(r.authors.map(a => a.short), ['Ramírez-Ojeda G.', 'Barrera-Guzmán L.Á.']);
    eq(r.pages, '110-129'); eq(r.timesCited, 6); eq(r.openAccess, true);
    deepEq(r.authorKeywords, ['arid regions', 'climate change', 'ecogeography']);
    deepEq(r.indexKeywords, ['grassland', 'climate']);
    eq(r.references.length, 2); eq(r.references[1].source, 'Terra Latinoam');
    eq(r.affiliations.length, 2); deepEq(r.countries, ['MX']);
    eq(r.correspondingCountry, 'MX'); eq(r.fundingText, 'Funded by an example grant.');
    eq(r.sourceAbbrev, 'Grasses'); eq(r.docType, 'article'); eq(r.language, 'en');
  });
  it('index B dialect', () => {
    const res = parse('savedrecs.bib', FIXTURES.bibIdxB);
    eq(res.source, 'idxB');
    const r = res.records[0];
    eq(r.title, 'Morphological diversity of chayote landraces');
    eq(r.timesCited, 12); eq(r.accession, 'ABC:000459191200004');
    deepEq(r.authorKeywords, ['chayote', 'landraces']); deepEq(r.indexKeywords, ['GENETIC-DIVERSITY']);
    deepEq(r.references.map(x => [x.firstAuthor, x.year, x.page, x.doi]), [['Aung LH', 1990, '418', ''], ['Newstrom LE', 1991, '175', '10.1007/bf02862046']]);
    eq(r.correspondingAuthor, 'Cadena-Iniguez J.'); eq(r.correspondingCountry, 'MX');
    deepEq(r.authors.map(a => a.affiliations.length), [1, 1]);
    deepEq(r.subjectAreas, ['Agriculture', 'Plant Sciences']); deepEq(r.issn, ['0925-9864', '1573-5109']);
    eq(r.sourceAbbrev, 'Genet. Resour. Crop Evol.'); eq(r.openAccess, true);
  });
  it('hand-written file: comments, macros, concatenation, LaTeX, corporate authors, quoted values', () => {
    const res = parse('refs.bib', FIXTURES.bibGeneric);
    eq(res.source, 'bibtex'); eq(res.records.length, 2);
    const r = res.records[0];
    deepEq(r.authors.map(a => a.last), ['Smith', 'World Health Organization', 'Müller', 'Peña']);
    eq(r.authors[3].first, 'María');
    eq(r.title, 'The DNA of Çukurova plants – a review');
    eq(r.sourceTitle, 'Journal of Ecology (Special issue)');
    eq(r.year, 2010); eq(r.pages, '45-67'); eq(r.timesCited, 5);
    deepEq(r.authorKeywords, ['ecology', 'genetics', 'plants']);
    const b = res.records[1];
    eq(b.title, 'A Book'); eq(b.docType, 'book'); eq(b.publisher, 'Example Press');
  });
});

describe('parsers · detection', () => {
  it('each fixture is recognised by its content', () => {
    const P = LIB();
    deepEq([
      P.detect('x.csv', FIXTURES.idxaCsv), P.detect('x.txt', FIXTURES.idxbTagged), P.detect('x.txt', FIXTURES.idxbTabbed),
      P.detect('x.txt', FIXTURES.biomedTagged), P.detect('x.txt', FIXTURES.risGeneric), P.detect('x.txt', FIXTURES.risIdxA),
      P.detect('x.txt', FIXTURES.bibIdxA), P.detect('x.txt', FIXTURES.bibGeneric),
    ], ['csv', 'tagged2', 'csv', 'tagged4', 'ris', 'ris', 'bibtex', 'bibtex']);
  });
  it('spreadsheet files are recognised by name and read as tables once turned into text', () => {
    const P = LIB();
    ok(P.isSheetName('Resultados.XLSX') && P.isSheetName('a.xls') && P.isSheetName('a.xlsm') && P.isSheetName('a.ods'));
    ok(!P.isSheetName('a.csv') && !P.isSheetName('xlsx'));
    eq(P.detect('export.xlsx', FIXTURES.idxaCsv), 'csv');
    eq(P.detect('vacio.xlsx', ''), null, 'an empty sheet is not a table');
  });
  it('unknown content is reported, not guessed', () => {
    const res = parse('notes.docx', 'Just some notes without structure');
    eq(res.format, null); eq(res.error, 'unknownFormat');
    eq(parse('empty.ris', 'TY  - JOUR\nER  - \n').error, 'empty');
  });
});

describe('parsers · background worker', () => {
  it('reads File objects in a worker with progress, same records as in the page', async () => {
    const files = [
      new File([FIXTURES.idxbTagged], 'savedrecs.txt'),
      new File([FIXTURES.biomedTagged], 'biomed.nbib'),
      new File([new Uint8Array([0x54, 0x59, 0x20, 0x20, 0x2D, 0x20, 0x4A, 0x4F, 0x55, 0x52, 0x0A, 0x54, 0x49, 0x20, 0x20, 0x2D, 0x20, 0x43, 0x61, 0xF1, 0x61, 0x0A, 0x45, 0x52, 0x20, 0x20, 0x2D, 0x20, 0x0A])], 'latin1.ris'),
    ];
    const seen = [];
    const res = await Parsers.read(files, { onProgress: f => seen.push(f) });
    deepEq(res.map(r => [r.name, r.format, r.records.length]), [['savedrecs.txt', 'tagged2', 2], ['biomed.nbib', 'tagged4', 2], ['latin1.ris', 'ris', 1]]);
    eq(res[2].records[0].title, 'Caña');
    ok(res[2].warnings.some(w => w.code === 'encoding'), 'encoding warning');
    eq(seen[seen.length - 1], 1);
    const inline = LIB().parseText('savedrecs.txt', FIXTURES.idxbTagged).records;
    deepEq(res[0].records.map(r => [r.title, r.authors.length, r.references.length, r.countries]), inline.map(r => [r.title, r.authors.length, r.references.length, r.countries]));
  });
});
