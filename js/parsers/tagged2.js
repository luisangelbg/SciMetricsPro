/* SciMetricsPro — tagged text with two-letter field tags (idxB plain-text export).
   Layout: a tag in columns 1–2, a space, the value; continuation lines start with
   three spaces; "ER" closes a record and "EF" the file. For AU, AF, CR, C1 … every
   continuation line is a new item; for the rest it continues the same text. */
'use strict';

function smpTagged2(P) {
  P.TAGGED2_MULTI = new Set(['AU', 'AF', 'BA', 'BF', 'CA', 'GP', 'BE', 'CR', 'C1', 'C3', 'EM', 'RI', 'OI', 'FU', 'SE']);

  P.parseTagged2 = function (text, ctx) {
    text = P.stripBom(text);
    const lines = text.split(/\r?\n/);
    const records = [];
    let tags = null, raw = [], last = null;
    const total = lines.length;
    for (let li = 0; li < total; li++) {
      const line = lines[li];
      if (li % 2000 === 0) ctx.tick(li / total);
      if (/^ER\s*$/.test(line)) {
        if (tags) { raw.push('ER'); const r = P.mapTagged2(tags); r.originalRaw = raw.join('\n'); records.push(r); }
        tags = null; raw = []; last = null;
        continue;
      }
      if (/^EF\s*$/.test(line)) break;
      const m = line.match(/^([A-Z][A-Z0-9])(?: (.*))?$/);
      if (m) {
        const tag = m[1], value = m[2] == null ? '' : m[2];
        if (!tags && (tag === 'FN' || tag === 'VR')) continue;
        if (!tags) tags = {};
        (tags[tag] = tags[tag] || []).push(value);
        last = tag;
        raw.push(line);
      } else if (tags && last && /^\s+\S/.test(line)) {
        const v = line.trim();
        if (P.TAGGED2_MULTI.has(last)) tags[last].push(v);
        else tags[last][tags[last].length - 1] += ' ' + v;
        raw.push(line);
      }
    }
    if (tags) { const r = P.mapTagged2(tags); r.originalRaw = raw.join('\n'); records.push(r); }
    return { source: 'idxB', format: 'tagged2', records };
  };

  /* shared by the plain-text and the tab-separated exports */
  P.mapTagged2 = function (tags) {
    const one = t => (tags[t] && tags[t].length ? P.clean(tags[t].join(' ')) : '');
    const list = t => (tags[t] || []).map(P.clean).filter(Boolean);
    const r = P.newRecord();
    r.source = 'idxB'; r.format = 'tagged2';
    r.title = one('TI');
    r.sourceTitle = one('SO');
    r.sourceAbbrev = one('JI') || one('J9');
    r.year = P.int(one('PY')) || P.yearOf(one('EY')) || P.yearOf(one('EA'));
    r.volume = one('VL');
    r.issue = one('IS');
    r.articleNumber = one('AR');
    r.pages = P.pages(one('BP'), one('EP'));
    r.doi = one('DI');
    r.pmid = one('PM');
    r.accession = one('UT');
    r.abstract = one('AB');
    r.authorKeywords = P.splitList(one('DE'), ';');
    r.indexKeywords = P.splitList(one('ID'), ';');
    r.subjectAreas = P.splitList(one('SC') || one('WC'), ';');
    const tc = one('TC');
    r.timesCited = tc === '' ? null : P.int(tc);
    r.docTypeRaw = one('DT') || ({ J: 'Article', B: 'Book', S: 'Book in series', P: 'Patent' })[one('PT')] || '';
    r.languages = P.languages(one('LA'));
    r.publisher = one('PU');
    r.issn = [one('SN'), one('EI')].filter(Boolean);
    r.isbn = P.splitList(one('BN'), ';');
    r.fundingText = one('FX') || list('FU').join('; ');
    const oa = one('OA');
    r.openAccess = oa ? true : null;

    /* authors: full names when both lists agree, short ones otherwise */
    const au = list('AU'), af = list('AF');
    const names = af.length === au.length && af.length ? af : au;
    r.authors = names.map(P.person);
    if (af.length === au.length) au.forEach((s, i) => { const p = P.person(s); if (p.initials) r.authors[i].short = p.short; });
    if (!r.authors.length) r.authors = list('CA').map(n => P.person(n));

    /* addresses: "[Last, First; Last2, First2] Organisation, City, Country." */
    for (const line of list('C1')) {
      const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      const address = P.clean(m ? m[2] : line);
      if (!address) continue;
      r.affiliations.push(address);
      if (m) {
        for (const nm of m[1].split(';')) {
          const key = P.fold(nm).replace(/[^a-z]/g, '');
          const a = r.authors.find(x => P.fold(x.full).replace(/[^a-z]/g, '') === key || P.fold(x.short).replace(/[^a-z]/g, '') === key);
          if (a) a.affiliations.push(address);
        }
      }
    }
    /* reprint (corresponding) author: "Smith, J (corresponding author), Organisation, City, Country." */
    const rp = one('RP');
    if (rp) {
      const first = rp.split(/;\s*(?=[^;]*\(corresponding author\))/i)[0];
      const m = first.match(/^(.*?)\s*\((?:corresponding|reprint) author\),?\s*(.*)$/i);
      r.correspondingAuthor = P.clean(m ? m[1] : first.split(',').slice(0, 2).join(','));
      r.correspondingCountry = P.countryOf(m ? m[2] : first);
    }
    r.references = list('CR').map(P.parseRefB);
    return P.finish(r);
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpTagged2);
