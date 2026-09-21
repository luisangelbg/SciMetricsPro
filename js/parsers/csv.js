/* SciMetricsPro — delimited text (CSV / tab-separated) and its column profiles.
   Columns are found by header name, never by position, so a partial export
   (fewer fields) is still read. Profiles:
   idxA    comma-separated export with "Author full names", "Source title", "EID", "References"…
   idxB    tab-separated export whose headers are two-letter field tags (PT AU TI SO … UT)
   biomed  comma-separated summary export (PMID, Title, Authors, Citation, Journal/Book …)
   table   any other table with recognisable headers (title, authors, year, doi …) */
'use strict';

function smpCsv(P) {
  /* RFC 4180: quoted fields may hold separators, quotes ("") and line breaks */
  P.parseDelimited = function (text, sep, onProgress) {
    const rows = [];
    let row = [], field = '', i = 0, q = false;
    const n = text.length;
    let nextTick = 200000;
    while (i < n) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { q = true; i++; continue; }
      if (c === sep) { row.push(field); field = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
        i += (c === '\r' && text[i + 1] === '\n') ? 2 : 1;
        if (onProgress && i > nextTick) { onProgress(i / n); nextTick = i + 200000; }
        continue;
      }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  };

  /* separator: the candidate that appears most often in the first line, outside quotes */
  P.sniffSeparator = function (text) {
    let line = '', q = false;
    for (let i = 0; i < Math.min(text.length, 20000); i++) {
      const c = text[i];
      if (c === '"') q = !q;
      if (!q && (c === '\n' || c === '\r')) break;
      if (!q) line += c;
    }
    let best = ',', bestN = 0;
    for (const s of [',', '\t', ';']) { const k = line.split(s).length - 1; if (k > bestN) { best = s; bestN = k; } }
    return best;
  };

  function headerIndex(header) {
    const idx = {};
    header.forEach((h, i) => { const k = P.fold(P.stripBom(h)).trim(); if (!(k in idx)) idx[k] = i; });
    return idx;
  }

  /* index of the header row: the first row, unless it holds a single note (some exports and spreadsheets start with
     a line such as "Exported on …") and one of the next five rows has at least two columns */
  P.headerRow = function (rows) {
    const wide = row => !!row && row.filter(v => String(v).trim()).length >= 2;
    if (!rows.length || wide(rows[0])) return 0;
    for (let i = 1; i < Math.min(rows.length, 6); i++) if (wide(rows[i])) return i;
    return 0;
  };

  P.csvProfile = function (header) {
    const h = headerIndex(header);
    if (('author full names' in h || 'authors with affiliations' in h || 'eid' in h) && ('source title' in h || 'title' in h)) return 'idxA';
    if ('pt' in h && 'au' in h && 'ti' in h && ('ut' in h || 'so' in h)) return 'idxB';
    if ('pmid' in h && 'citation' in h) return 'biomed';
    return 'table';
  };

  P.parseCsv = function (text, ctx) {
    text = P.stripBom(text);
    const sep = P.sniffSeparator(text);
    const rows = P.parseDelimited(text, sep, f => ctx.tick(f * 0.5));
    if (!rows.length) return { source: 'table', format: 'csv', records: [] };
    const start = P.headerRow(rows);
    const header = rows[start].map(x => P.stripBom(x).trim());
    const profile = P.csvProfile(header);
    const h = headerIndex(header);
    const get = (row, ...names) => {
      for (const nm of names) { const j = h[nm]; if (j != null && row[j] != null && String(row[j]).trim() !== '') return String(row[j]); }
      return '';
    };
    const records = [];
    const map = profile === 'idxA' ? mapIdxA : profile === 'idxB' ? mapTabbedB : profile === 'biomed' ? mapBiomedCsv : mapTable;
    for (let k = start + 1; k < rows.length; k++) {
      const row = rows[k];
      if (row.every(v => !String(v).trim())) continue;
      const r = map(row, get, header);
      r.originalRaw = header.map((name, j) => row[j] ? name + ': ' + row[j] : '').filter(Boolean).join('\n');
      records.push(r);
      if (k % 500 === 0) ctx.tick(0.5 + 0.5 * k / rows.length);
    }
    return {
      source: profile, format: profile === 'idxB' ? 'tabbed2' : 'csv', records,
      warnings: profile === 'table' ? [{ code: 'genericTable' }] : [],
    };
  };

  /* ---------- idxA comma-separated export ---------- */
  function mapIdxA(row, get) {
    const r = P.newRecord();
    r.source = 'idxA'; r.format = 'csv';
    r.title = get(row, 'title');
    r.year = P.int(get(row, 'year'));
    r.sourceTitle = get(row, 'source title');
    r.sourceAbbrev = get(row, 'abbreviated source title');
    r.volume = get(row, 'volume');
    r.issue = get(row, 'issue');
    r.articleNumber = get(row, 'art. no.', 'art no');
    r.pages = P.pages(get(row, 'page start'), get(row, 'page end'));
    r.timesCited = P.int(get(row, 'cited by'));
    if (r.timesCited == null) r.timesCited = 0;   /* this export leaves the field empty when there are no citations */
    r.doi = get(row, 'doi');
    r.abstract = get(row, 'abstract');
    r.authorKeywords = P.splitList(get(row, 'author keywords'), ';');
    r.indexKeywords = P.splitList(get(row, 'index keywords'), ';');
    r.references = P.splitRefsA(get(row, 'references')).map(P.parseRefA);
    r.fundingText = get(row, 'funding texts', 'funding text 1', 'funding details');
    r.publisher = get(row, 'publisher');
    r.issn = P.splitList(get(row, 'issn'), ';');
    r.isbn = P.splitList(get(row, 'isbn'), ';');
    r.pmid = get(row, 'pubmed id');
    r.languages = P.languages(get(row, 'language of original document'));
    r.docTypeRaw = get(row, 'document type');
    const oa = get(row, 'open access');
    r.openAccess = oa ? true : false;
    r.accession = get(row, 'eid');

    /* authors: full names with identifiers, else the short list */
    const full = get(row, 'author full names');
    const short = get(row, 'authors');
    if (full) {
      r.authors = P.splitList(full, ';').map(P.person);
      const shorts = splitShortAuthorsA(short);
      if (shorts.length === r.authors.length) shorts.forEach((s, i) => { const p = P.person(s); if (p.initials) { r.authors[i].short = p.short; } });
    } else {
      r.authors = splitShortAuthorsA(short).map(P.person);
    }
    if (/^\[no author name available\]$/i.test(short)) r.authors = [];

    /* affiliations tied to authors: "Name I., affiliation; Name I., affiliation" in author order */
    const known = P.splitList(get(row, 'affiliations'), ';');
    const withAff = P.splitList(get(row, 'authors with affiliations'), ';');
    if (withAff.length && r.authors.length) {
      let ai = 0;
      for (const entry of withAff) {
        const comma = entry.indexOf(',');
        const name = comma > 0 ? entry.slice(0, comma).trim() : entry;
        const aff = comma > 0 ? entry.slice(comma + 1).trim() : '';
        /* same author again (a second affiliation) or the next one */
        let target = ai < r.authors.length ? ai : -1;
        if (ai > 0 && sameShort(r.authors[ai - 1], name)) target = ai - 1;
        else ai++;
        if (target >= 0 && aff) r.authors[target].affiliations.push(...splitAffiliations(aff, known));
      }
    }
    r.affiliations = known;

    const corr = get(row, 'correspondence address');
    if (corr) {
      const parts = corr.split(/;\s*/);
      r.correspondingAuthor = P.clean(parts[0]);
      const address = parts.slice(1).filter(p => !/^email\s*:/i.test(p.trim())).join(', ');
      r.correspondingCountry = P.countryOf(address);
    }
    return P.finish(r);
  }
  /* An author with two affiliations gets them joined by a comma ("…, Mexico, Grupo …, Mexico").
     The record's affiliation list tells where one ends and the next begins. */
  function splitAffiliations(text, known) {
    const found = known.filter(a => text.includes(a));
    if (!found.length) return [text];
    const covered = found.reduce((n, a) => n + a.length, 0);
    return covered >= text.length - 2 * found.length ? found : [text];
  }
  function sameShort(author, name) { return P.fold(author.short).replace(/[^a-z]/g, '') === P.fold(name).replace(/[^a-z]/g, ''); }

  /* "Ramírez-Ojeda G.; Barrera-Guzmán L.Á." (current) or "Smith J., Jones K.L." (older) */
  function splitShortAuthorsA(s) {
    if (!s) return [];
    if (s.includes(';')) return P.splitList(s, ';');
    return String(s).split(/(?<=\.),\s+/).map(P.clean).filter(Boolean);
  }

  /* ---------- idxB tab-separated export: headers are field tags ---------- */
  function mapTabbedB(row, get, header) {
    const tags = {};
    header.forEach((name, j) => {
      const tag = name.trim().toUpperCase();
      const v = row[j];
      if (!/^[A-Z][A-Z0-9]$/.test(tag) || v == null || !String(v).trim()) return;
      const multi = P.TAGGED2_MULTI.has(tag);
      tags[tag] = multi ? String(v).split(/;\s(?=\S)/).map(x => x.trim()).filter(Boolean) : [String(v).trim()];
      if (tag === 'C1') tags[tag] = splitC1(String(v));
      if (tag === 'CR') tags[tag] = String(v).split(/;\s(?=[^\s])/).map(x => x.trim()).filter(Boolean);
    });
    const r = P.mapTagged2(tags);
    r.format = 'tabbed2';
    return r;
  }
  /* "[A; B] Addr 1; [C] Addr 2" — the semicolons inside brackets separate names, not addresses */
  function splitC1(s) {
    const out = [];
    let depth = 0, cur = '';
    for (const c of s) {
      if (c === '[') depth++;
      if (c === ']') depth--;
      if (c === ';' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /* ---------- biomed summary table ---------- */
  function mapBiomedCsv(row, get) {
    const r = P.newRecord();
    r.source = 'biomed'; r.format = 'csv';
    r.pmid = get(row, 'pmid');
    r.accession = r.pmid;
    r.title = get(row, 'title');
    r.authors = get(row, 'authors').replace(/\.$/, '').split(/,\s+/).filter(Boolean).map(P.person);
    r.year = P.int(get(row, 'publication year')) || P.yearOf(get(row, 'citation'));
    r.sourceAbbrev = get(row, 'journal/book');
    r.sourceTitle = r.sourceAbbrev;
    r.doi = get(row, 'doi') || P.doiOf(get(row, 'citation'));
    const cit = get(row, 'citation');
    const vi = cit.match(/;(\d+[A-Za-z]?)(?:\(([^)]+)\))?:([\w-]+)/);
    if (vi) { r.volume = vi[1]; r.issue = vi[2] || ''; r.pages = vi[3]; }
    r.docTypeRaw = 'Journal Article';
    return P.finish(r);
  }

  /* ---------- any other table ---------- */
  function mapTable(row, get) {
    const r = P.newRecord();
    r.source = 'table'; r.format = 'csv';
    r.title = get(row, 'title', 'article title', 'document title', 'titulo');
    const au = get(row, 'authors', 'author', 'author names', 'autores');
    r.authors = (au.includes(';') ? P.splitList(au, ';') : au ? au.split(/,\s+(?=[^,]+,)|\s+and\s+/) : []).map(P.person);
    r.year = P.int(get(row, 'year', 'publication year', 'pubyear', 'ano', 'año', 'date')) || null;
    if (r.year && (r.year < 1500 || r.year > 2100)) r.year = P.yearOf(get(row, 'year', 'publication year', 'date'));
    r.sourceTitle = get(row, 'source title', 'journal', 'source', 'publication title', 'revista');
    r.doi = get(row, 'doi');
    r.abstract = get(row, 'abstract', 'resumen');
    r.authorKeywords = P.splitList(get(row, 'author keywords', 'keywords', 'palabras clave'), /[;,]/);
    r.timesCited = get(row, 'cited by', 'times cited', 'citations', 'citation count') ? P.int(get(row, 'cited by', 'times cited', 'citations', 'citation count')) : null;
    r.docTypeRaw = get(row, 'document type', 'type', 'publication type');
    r.languages = P.languages(get(row, 'language', 'idioma'));
    return P.finish(r);
  }
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpCsv);
