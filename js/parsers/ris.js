/* SciMetricsPro — RIS ("TY  - JOUR" … "ER  - ").
   Written by reference managers and by several databases. When the notes field
   carries the export date and citation count ("Export Date: …; Cited By: 8;
   Correspondence Address: …; References: …") the file comes from idxA and those
   parts are read too. */
'use strict';

function smpRis(P) {
  P.parseRis = function (text, ctx) {
    text = P.stripBom(text);
    const lines = text.split(/\r?\n/);
    const records = [];
    let tags = null, raw = [], last = null;
    const total = lines.length;
    for (let li = 0; li < total; li++) {
      const line = lines[li];
      if (li % 2000 === 0) ctx.tick(li / total);
      const m = P.stripBom(line).match(/^([A-Z][A-Z0-9])  -(?: (.*))?$/);
      if (m) {
        const tag = m[1], value = m[2] == null ? '' : m[2];
        if (tag === 'TY') { tags = {}; raw = []; }
        if (!tags) tags = {};
        raw.push(line);
        if (tag === 'ER') { records.push(mapRis(tags, raw.join('\n'))); tags = null; raw = []; last = null; continue; }
        (tags[tag] = tags[tag] || []).push(value);
        last = tag;
      } else if (tags && last && line.trim()) {
        tags[last][tags[last].length - 1] += ' ' + line.trim();
        raw.push(line);
      }
    }
    if (tags && Object.keys(tags).length > 1) records.push(mapRis(tags, raw.join('\n')));
    const fromIdxA = records.length > 0 && records.filter(r => r._idxA).length >= records.length / 2;
    for (const r of records) { r.source = fromIdxA ? 'idxA' : 'ris'; delete r._idxA; }
    return { source: fromIdxA ? 'idxA' : 'ris', format: 'ris', records };
  };

  const TYPES = { JOUR: 'Article', JFULL: 'Article', MGZN: 'Article', NEWS: 'Article', EJOUR: 'Article', CHAP: 'Book chapter', ECHAP: 'Book chapter',
    BOOK: 'Book', EBOOK: 'Book', EDBOOK: 'Book', CONF: 'Conference paper', CPAPER: 'Conference paper', THES: 'Thesis', RPRT: 'Report',
    GEN: 'Other', DATA: 'Data paper', UNPB: 'Preprint', SER: 'Book', ELEC: 'Other' };

  function mapRis(tags, raw) {
    const all = t => (tags[t] || []).map(P.clean).filter(Boolean);
    const one = (...ts) => { for (const t of ts) { const v = all(t); if (v.length) return v[0]; } return ''; };
    const r = P.newRecord();
    r.format = 'ris';
    r.originalRaw = raw;
    r.title = one('TI', 'T1', 'CT', 'BT');
    const ty = one('TY').toUpperCase();
    if (ty === 'CHAP' || ty === 'ECHAP') r.sourceTitle = one('T2', 'BT', 'JO', 'JF');
    else r.sourceTitle = one('T2', 'JO', 'JF', 'JA', 'T3');
    const j2 = one('J2', 'JA');
    r.sourceAbbrev = j2 !== r.sourceTitle ? j2 : '';
    r.authors = all('AU').concat(all('A1')).map(P.person);
    r.year = P.yearOf(one('PY', 'Y1', 'DA', 'Y2'));
    r.volume = one('VL');
    r.issue = one('IS', 'CP');
    r.pages = P.pages(one('SP'), one('EP'));
    r.doi = one('DO') || P.doiOf(all('UR').concat(all('L3'), all('M3')).join(' '));
    r.issn = all('SN').filter(v => !/^97[89]/.test(v.replace(/\D/g, '')) || v.replace(/\D/g, '').length === 8);
    r.isbn = all('SN').filter(v => v.replace(/[^\dX]/gi, '').length >= 10);
    r.publisher = one('PB');
    r.languages = P.languages(all('LA').join(';'));
    r.authorKeywords = all('KW').flatMap(k => k.includes(';') ? P.splitList(k, ';') : [k]);
    r.affiliations = all('AD').concat(all('C1').filter(v => /,/.test(v) && !/^\d/.test(v)));
    r.accession = one('AN', 'ID', 'M1');
    /* two abstracts (two languages): keep the English one */
    const abs = all('AB').concat(all('N2'));
    r.abstract = abs.length > 1 ? abs.slice().sort((a, b) => P.englishScore(b) - P.englishScore(a))[0] : (abs[0] || '');
    r.docTypeRaw = one('M3') && !/^10\./.test(one('M3')) ? one('M3') : (TYPES[ty] || ty);

    /* notes written by idxA */
    const notes = all('N1').join('; ');
    if (/Export Date\s*:/i.test(notes) || /Cited By\s*:?\s*\d+/i.test(notes)) {
      r._idxA = true;
      const cited = notes.match(/Cited By\s*:?\s*(\d+)/i);
      r.timesCited = cited ? parseInt(cited[1], 10) : 0;
      const corr = notes.match(/Correspondence Address\s*:\s*(.*?)(?:;\s*email\s*:[^;]*)?(?:;\s*(?:References|Funding [A-Za-z]+|Chemicals\/CAS|Tradenames|Manufacturers|Molecular Sequence Numbers)\s*:|$)/i);
      if (corr) {
        const parts = corr[1].split(/;\s*/);
        r.correspondingAuthor = P.clean(parts[0]);
        r.correspondingCountry = P.countryOf(parts.slice(1).join(', '));
      }
      const refs = notes.match(/References\s*:\s*(.*)$/i);
      if (refs) r.references = P.splitRefsA(refs[1]).map(P.parseRefA);
      const fund = notes.match(/Funding (?:text|details)(?: \d+)?\s*:\s*(.*?)(?:;\s*[A-Z][A-Za-z ]+\s*:|$)/i);
      if (fund) r.fundingText = fund[1];
    }
    return P.finish(r);
  }
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpRis);
