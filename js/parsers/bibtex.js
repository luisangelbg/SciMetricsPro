/* SciMetricsPro — BibTeX.
   A small reader for @type{key, field = {value} | "value" | number | macro # …}
   with @string macros, @comment/@preamble, nested braces and LaTeX escapes.
   Dialects are recognised by their own fields:
   idxA   author_keywords, abbrev_source_title, publication_stage, note = {Cited by: N}, references
   idxB   keywords-plus, times-cited, cited-references, unique-id, research-areas, *-categories */
'use strict';

function smpBibtex(P) {
  const MONTHS = { jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June', jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December' };

  /* → [{ type, key, fields: { lowercase name: raw value (braces kept) }, raw }] */
  P.bibtexEntries = function (text, ctx) {
    const s = P.stripBom(text);
    const n = s.length;
    const entries = [];
    const macros = Object.assign({}, MONTHS);
    let i = 0, nextTick = 100000;

    const skipWs = () => { while (i < n && /\s/.test(s[i])) i++; };
    const readIdent = () => { const st = i; while (i < n && /[^\s{}(),=#"]/.test(s[i])) i++; return s.slice(st, i); };
    const readBraced = () => {            // s[i] === '{' → content without the outer braces
      let depth = 0; const st = i + 1;
      for (; i < n; i++) {
        if (s[i] === '\\') { i++; continue; }
        if (s[i] === '{') depth++;
        else if (s[i] === '}') { depth--; if (depth === 0) { i++; return s.slice(st, i - 1); } }
      }
      return s.slice(st);
    };
    const readQuoted = () => {            // s[i] === '"'
      let depth = 0; const st = i + 1; i++;
      for (; i < n; i++) {
        if (s[i] === '\\') { i++; continue; }
        if (s[i] === '{') depth++;
        else if (s[i] === '}') depth--;
        else if (s[i] === '"' && depth === 0) { i++; return s.slice(st, i - 1); }
      }
      return s.slice(st);
    };
    const readValue = () => {
      const parts = [];
      for (;;) {
        skipWs();
        if (s[i] === '{') parts.push(readBraced());
        else if (s[i] === '"') parts.push(readQuoted());
        else { const id = readIdent(); parts.push(/^\d+$/.test(id) ? id : (macros[id.toLowerCase()] != null ? macros[id.toLowerCase()] : id)); }
        skipWs();
        if (s[i] === '#') { i++; continue; }
        return parts.join('');
      }
    };

    while (i < n) {
      const at = s.indexOf('@', i);
      if (at < 0) break;
      i = at + 1;
      const type = readIdent().toLowerCase();
      skipWs();
      const open = s[i];
      if (open !== '{' && open !== '(') continue;
      const close = open === '{' ? '}' : ')';
      const start = at;
      if (type === 'comment' || type === 'preamble') {
        if (open === '{') readBraced(); else { const e = s.indexOf(')', i); i = e < 0 ? n : e + 1; }
        continue;
      }
      i++;
      skipWs();
      const fields = {};
      let key = '';
      if (type !== 'string') {
        const st = i;
        while (i < n && s[i] !== ',' && s[i] !== close && s[i] !== '\n') i++;
        key = s.slice(st, i).trim();
        if (s[i] === ',') i++;
      }
      for (;;) {
        skipWs();
        if (i >= n) break;
        if (s[i] === close) { i++; break; }
        if (s[i] === ',') { i++; continue; }
        let name = readIdent().toLowerCase();
        skipWs();
        /* numbered fields written with a space: "funding_text 1 = {…}" */
        if (/\d/.test(s[i] || '')) { const st = i; while (i < n && /\d/.test(s[i])) i++; name += ' ' + s.slice(st, i); skipWs(); }
        if (s[i] !== '=') {            // malformed field: jump to the next comma or the end of the entry
          while (i < n && s[i] !== ',' && s[i] !== close) i++;
          if (!name) { if (s[i] === close) { i++; break; } }
          continue;
        }
        i++;
        const value = readValue();
        if (type === 'string') macros[name] = value;
        else fields[name] = value;
      }
      if (type !== 'string') entries.push({ type, key, fields, raw: s.slice(start, i) });
      if (ctx && i > nextTick) { ctx.tick(i / n); nextTick = i + 100000; }
    }
    return entries;
  };

  /* split "A and B and {C and D}" at the top brace level */
  function splitAuthors(v) {
    const out = [];
    let depth = 0, cur = '';
    const words = v.split(/(\s+and\s+|[{}])/i);
    for (const w of words) {
      if (w === '{') depth++;
      if (w === '}') depth--;
      if (depth === 0 && /^\s+and\s+$/i.test(w)) { out.push(cur); cur = ''; continue; }
      cur += w;
    }
    if (cur.trim()) out.push(cur);
    return out.map(x => x.trim()).filter(Boolean);
  }
  /* "{World Health Organization}" is one corporate name, not "Organization, World Health" */
  function authorOf(raw) {
    if (/^\{[^{}]*\}$/.test(raw)) {
      const name = P.clean(P.latex(raw));
      return { full: name, last: name, first: '', initials: '', short: name, affiliations: [], country: null };
    }
    return P.person(P.latex(raw));
  }

  P.bibtexDialect = function (entries) {
    let a = 0, b = 0;
    for (const e of entries) {
      const f = e.fields;
      if ('author_keywords' in f || 'abbrev_source_title' in f || 'publication_stage' in f || /Cited by\s*:/i.test(f.note || '')) a++;
      if ('keywords-plus' in f || 'times-cited' in f || 'cited-references' in f || 'unique-id' in f || 'research-areas' in f) b++;
    }
    if (a === 0 && b === 0) return 'bibtex';
    return a >= b ? 'idxA' : 'idxB';
  };

  P.parseBibtex = function (text, ctx) {
    const entries = P.bibtexEntries(text, ctx);
    const source = P.bibtexDialect(entries);
    const records = entries.map(e => mapEntry(e, source));
    return { source, format: 'bibtex', records };
  };

  function mapEntry(e, source) {
    const f = {};
    for (const k in e.fields) f[k] = e.fields[k];
    const txt = k => (f[k] != null ? P.clean(P.latex(f[k])) : '');
    const r = P.newRecord();
    r.source = source; r.format = 'bibtex';
    r.originalRaw = e.raw;
    r.title = txt('title');
    r.authors = f.author ? splitAuthors(f.author).map(authorOf) : [];
    r.year = P.yearOf(txt('year') || txt('date'));
    r.sourceTitle = txt('journal') || txt('booktitle') || txt('series') || txt('school') || txt('institution');
    r.sourceAbbrev = txt('abbrev_source_title') || txt('journal-iso') || txt('journal-abbreviation') || txt('shortjournal');
    r.volume = txt('volume');
    r.issue = txt('number') || txt('issue');
    r.pages = txt('pages').replace(/\s*[–-]+\s*/, '-');
    r.articleNumber = txt('art_number') || txt('article-number') || txt('eid');
    r.doi = txt('doi') || P.doiOf(txt('url'));
    r.issn = P.splitList(txt('issn'), /[;,]/).concat(P.splitList(txt('eissn'), /[;,]/));
    r.isbn = P.splitList(txt('isbn'), /[;,]/);
    r.abstract = txt('abstract');
    r.publisher = txt('publisher');
    r.languages = P.languages(txt('language') || txt('langid'));
    r.pmid = txt('pubmed_id') || txt('pubmed-id') || txt('pmid');
    r.docTypeRaw = txt('type') || txt('document_type') || e.type;
    r.accession = txt('unique-id') || txt('source_id') || e.key;
    r.fundingText = txt('funding_text') || txt('funding_text 1') || txt('funding-text') || txt('funding_details') || txt('funding-acknowledgement');
    const kSep = /;/;

    if (source === 'idxA') {
      r.authorKeywords = P.splitList(txt('author_keywords'), kSep);
      r.indexKeywords = P.splitList(txt('keywords'), kSep);
      r.references = P.splitRefsA(txt('references')).map(P.parseRefA);
      const note = txt('note');
      const cited = note.match(/Cited by\s*:\s*(\d+)/i);
      r.timesCited = cited ? parseInt(cited[1], 10) : 0;
      r.openAccess = /open access/i.test(note) ? true : (f.note != null ? false : null);
      r.affiliations = P.splitList(txt('affiliations') || txt('affiliation'), ';');
      const corr = txt('correspondence_address') || txt('correspondence_address1');
      if (corr) {
        const parts = corr.split(/;\s*/);
        r.correspondingAuthor = parts[0];
        r.correspondingCountry = P.countryOf(parts.slice(1).filter(p => !/^email\s*:/i.test(p)).join(', '));
      }
    } else if (source === 'idxB') {
      r.authorKeywords = P.splitList(txt('keywords'), kSep);
      r.indexKeywords = P.splitList(txt('keywords-plus'), kSep);
      const cats = Object.keys(f).filter(k => /-categories$/.test(k)).map(txt).join('; ');
      r.subjectAreas = P.splitList(txt('research-areas') || cats, kSep);
      const tc = txt('times-cited');
      r.timesCited = tc === '' ? null : P.int(tc);
      r.openAccess = txt('oa') ? true : null;
      /* cited references: one per line in the raw value */
      r.references = String(f['cited-references'] || '').split(/\r?\n/).map(x => P.clean(P.latex(x)).replace(/\.$/, '')).filter(Boolean).map(P.parseRefB);
      /* affiliation lines: "Last, I (Corresponding Author), Organisation, Country." ·
         "Last, I, Organisation, Country." · "Last, First; Last2, First2, Organisation, Country." */
      const affLines = String(f.affiliation || f.affiliations || '').split(/\r?\n/).map(x => P.clean(P.latex(x))).filter(Boolean);
      for (const line0 of affLines) {
        const corr = /\((?:corresponding|reprint) author\)/i.test(line0);
        const line = line0.replace(/\s*\((?:corresponding|reprint) author\)/i, '');
        const semi = line.lastIndexOf(';', 400);
        const head = semi > 0 ? line.slice(semi + 1) : line;
        const parts = head.split(',');
        if (parts.length < 3) { r.affiliations.push(line); continue; }
        const namesText = (semi > 0 ? line.slice(0, semi + 1) : '') + parts.slice(0, 2).join(',');
        const address = P.clean(parts.slice(2).join(','));
        const people = namesText.split(';').map(x => x.trim()).filter(Boolean).map(P.person);
        if (corr) {
          if (!r.correspondingAuthor && people[0]) { r.correspondingAuthor = people[0].short; r.correspondingCountry = P.countryOf(address); }
          continue;
        }
        r.affiliations.push(address);
        for (const who of people) {
          const a = r.authors.find(x => P.fold(x.last) === P.fold(who.last) && (P.fold(x.initials)[0] || '') === (P.fold(who.initials)[0] || ''));
          if (a) a.affiliations.push(address);
        }
      }
    } else {
      r.authorKeywords = P.splitList(txt('keywords') || txt('author_keywords'), /[;,]/);
      r.affiliations = P.splitList(txt('affiliation') || txt('affiliations'), ';');
      const note = txt('note');
      const cited = note.match(/Cited by\s*:?\s*(\d+)/i);
      if (cited) r.timesCited = parseInt(cited[1], 10);
    }
    return P.finish(r);
  }
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpBibtex);
