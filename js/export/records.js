/* SciMetricsPro — the clean set as data files.
   · CSV (UTF-8 with BOM): one row per document with the fields of the unified record; lists joined with "; ".
   · BibTeX: one entry per document (article, inproceedings, incollection, book, phdthesis, techreport or misc) with
     authors "Surname, Given and …", title in double braces to keep its capitals, journal or book title, year, volume,
     number, pages with "--", DOI, ISSN, ISBN, publisher, language, abstract and keywords; LaTeX special characters escaped.
     Keys: surname of the first author + year + first word of the title, with a, b, c… when repeated.
     Patashnik O (1988) BibTeXing. Documentation for general BibTeX users. */
'use strict';

const RecordExport = {
  CSV_FIELDS: ['key', 'docType', 'authors', 'authorsFull', 'title', 'year', 'sourceTitle', 'sourceAbbrev', 'volume', 'issue', 'pages', 'articleNumber', 'doi',
    'issn', 'isbn', 'publisher', 'language', 'abstract', 'authorKeywords', 'indexKeywords', 'affiliations', 'institutions', 'countries', 'timesCited', 'references',
    'pmid', 'accession', 'database', 'openAccess', 'fundingText'],

  csvTable(records, label) {
    const P = Parsers.lib();
    const clean = v => P.clean(v == null ? '' : v);
    return {
      columns: RecordExport.CSV_FIELDS.map(key => ({ key, label: label ? label(key) : key })),
      rows: records.map(r => ({
        key: P.prismaKey ? P.prismaKey(r) : '', docType: r.docType, authors: r.authors.map(a => clean(a.label || a.short || a.full)).join('; '),
        authorsFull: r.authors.map(a => clean(a.full || a.short)).join('; '), title: clean(r.title), year: r.year, sourceTitle: clean(r.sourceName || r.sourceTitle),
        sourceAbbrev: clean(r.sourceAbbrev), volume: clean(r.volume), issue: clean(r.issue), pages: clean(r.pages), articleNumber: clean(r.articleNumber), doi: r.doi || '',
        issn: (r.issn || []).join('; '), isbn: (r.isbn || []).join('; '), publisher: clean(r.publisher), language: r.language || '', abstract: clean(r.abstract),
        authorKeywords: (r.authorKeywords || []).join('; '), indexKeywords: (r.indexKeywords || []).join('; '), affiliations: (r.affiliations || []).join('; '),
        institutions: (r.institutions || []).join('; '), countries: P.recordCountries ? P.recordCountries(r).join('; ') : (r.countries || []).join('; '),
        timesCited: r.timesCited, references: (r.references || []).map(x => clean(x.raw)).join('; '), pmid: r.pmid || '', accession: r.accession || '',
        database: (r.sources && r.sources.length ? r.sources : [r.source]).filter(Boolean).join('; '), openAccess: r.openAccess == null ? '' : r.openAccess, fundingText: clean(r.fundingText),
      })),
    };
  },

  tex(s) {
    /* backslashes first become a private character, so the braces of their command are not escaped again */
    const mark = String.fromCharCode(0xE000);
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().split('\\').join(mark)
      .replace(/([{}&%$#_])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}')
      .split(mark).join('\\textbackslash{}');
  },

  TYPES: { article: 'article', review: 'article', letter: 'article', editorial: 'article', note: 'article', erratum: 'article', retracted: 'article', conference: 'inproceedings', chapter: 'incollection', book: 'book', thesis: 'phdthesis', report: 'techreport' },

  bibtex(records) {
    const P = Parsers.lib(), X = RecordExport.tex;
    const used = new Map();
    const entries = records.map(r => {
      const type = RecordExport.TYPES[r.docType] || 'misc';
      const first = r.authors[0];
      const sur = first ? P.fold(first.last || first.short || first.full).replace(/[^a-z]/g, '') : 'anon';
      const word = (P.fold(r.title).match(/[a-z]{4,}/) || ['doc'])[0];
      let key = (sur || 'anon') + (r.year || '') + word;
      const n = used.get(key) || 0;
      used.set(key, n + 1);
      if (n) key += String.fromCharCode(96 + n);
      const fields = [];
      const add = (name, value, raw) => { if (value != null && value !== '') fields.push(`  ${name} = {${raw ? value : X(value)}}`); };
      /* a part with a comma or the word "and" goes in braces: otherwise BibTeX reads more parts of the name (three
         commas make it invalid) or more authors (catalogue records sometimes carry an affiliation as an author) */
      const part = v => (/,|\sand\s/i.test(v) ? `{${X(v)}}` : X(v));
      const names = r.authors.map(a => {
        const last = P.clean(a.last || a.short || a.full), given = P.clean(a.first || a.initials || '');
        return given ? `${part(last)}, ${part(given)}` : `{${X(last)}}`;
      });
      if (names.length) fields.push(`  author = {${names.join(' and ')}}`);
      add('title', '{' + X(r.title) + '}', true);
      const source = P.clean(r.sourceName || r.sourceTitle);
      if (type === 'article') add('journal', source);
      else if (type === 'inproceedings' || type === 'incollection') add('booktitle', source);
      else if (type === 'phdthesis') add('school', r.publisher || source);
      else if (type === 'techreport') add('institution', r.publisher || source);
      else add('howpublished', source);
      add('year', r.year);
      add('volume', r.volume);
      add('number', r.issue);
      add('pages', r.pages ? X(r.pages).replace(/\s*[-–]+\s*/g, '--') : r.articleNumber ? X(r.articleNumber) : '', true);
      add('doi', r.doi);
      add('issn', (r.issn || []).join(', '));
      add('isbn', (r.isbn || []).join(', '));
      if (type !== 'phdthesis' && type !== 'techreport') add('publisher', r.publisher);
      add('language', r.language);
      add('abstract', r.abstract);
      add('keywords', [...new Set((r.authorKeywords || []).concat(r.indexKeywords || []))].join('; '));
      if (r.timesCited != null && isFinite(r.timesCited)) add('note', 'Times cited: ' + r.timesCited);
      return `@${type}{${key},\n${fields.join(',\n')}\n}`;
    });
    return entries.join('\n\n') + '\n';
  },
};

window.RecordExport = RecordExport;
