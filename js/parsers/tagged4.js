/* SciMetricsPro — tagged text with four-character field tags (biomed export, also .nbib).
   Layout: "TAG - value" with the tag padded to four characters, continuation lines
   indented six spaces, records separated by blank lines and starting with "PMID-".
   Author blocks: FAU (full name), AU (short name), AD lines for that author. */
'use strict';

function smpTagged4(P) {
  P.parseTagged4 = function (text, ctx) {
    text = P.stripBom(text);
    const lines = text.split(/\r?\n/);
    const records = [];
    let fields = null, raw = [];
    const total = lines.length;
    const flush = () => {
      if (fields && fields.length) { const r = mapTagged4(fields); r.originalRaw = raw.join('\n'); records.push(r); }
      fields = null; raw = [];
    };
    for (let li = 0; li < total; li++) {
      const line = lines[li];
      if (li % 2000 === 0) ctx.tick(li / total);
      const m = line.match(/^([A-Z][A-Z0-9]{1,3})\s*- (.*)$/);
      if (m) {
        if (m[1] === 'PMID') flush();
        if (!fields) fields = [];
        fields.push([m[1], m[2]]);
        raw.push(line);
      } else if (fields && /^\s{2,}\S/.test(line) && fields.length) {
        fields[fields.length - 1][1] += ' ' + line.trim();
        raw.push(line);
      }
    }
    flush();
    return { source: 'biomed', format: 'tagged4', records };
  };

  function mapTagged4(fields) {
    const r = P.newRecord();
    r.source = 'biomed'; r.format = 'tagged4';
    const types = [];
    let author = null, prev = null;
    const funding = [];
    for (const [tag, value0] of fields) {
      const value = P.clean(value0);
      const prevTag = prev; prev = tag;
      switch (tag) {
        case 'PMID': r.pmid = value; r.accession = value; break;
        case 'TI': r.title = value; break;
        case 'BTI': if (!r.title) r.title = value; break;
        case 'AB': r.abstract = r.abstract ? r.abstract + ' ' + value : value; break;
        case 'FAU': author = P.person(value); r.authors.push(author); break;
        case 'AU': {
          const p = P.person(value);
          /* AU right after its FAU is the short form of the same author; otherwise it is a new author */
          if (author && prevTag === 'FAU') { if (p.initials) author.short = p.short; }
          else { author = p; r.authors.push(author); }
          break;
        }
        case 'CN': author = P.person(value); author.last = value; author.short = value; author.full = value; r.authors.push(author); break;
        case 'AD':
          for (const a of value.split(/;\s+(?=[A-Z])/)) {
            if (author) author.affiliations.push(a);
            else r.affiliations.push(a);
          }
          break;
        case 'DP': r.year = P.yearOf(value); break;
        case 'TA': r.sourceAbbrev = value; break;
        case 'JT': r.sourceTitle = value; break;
        case 'VI': r.volume = value; break;
        case 'IP': r.issue = value; break;
        case 'PG': r.pages = value; break;
        case 'LID': case 'AID': if (/\[doi\]/i.test(value) && !r.doi) r.doi = value.replace(/\s*\[doi\]/i, ''); break;
        case 'IS': r.issn.push(value.replace(/\s*\(.*\)$/, '')); break;
        case 'LA': r.languages.push(...P.languages(value)); break;
        case 'PT': types.push(value); break;
        case 'MH': r.indexKeywords.push(value.replace(/^\*/, '').split('/')[0].trim()); break;
        case 'OT': r.authorKeywords.push(value.replace(/^\*/, '')); break;
        case 'GR': funding.push(value.replace(/\/+$/, '').replace(/\//g, ', ')); break;
        case 'PB': r.publisher = value; break;
        case 'ISBN': r.isbn.push(value); break;
        default: break;
      }
    }
    if (!r.sourceTitle) r.sourceTitle = r.sourceAbbrev;
    r.docTypeRaw = types.join('; ');
    r.docType = P.docType(types);
    r.fundingText = funding.join('; ');
    r.languages = [...new Set(r.languages)];
    return P.finish(r);
  }
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpTagged4);
