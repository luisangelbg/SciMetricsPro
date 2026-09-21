/* SciMetricsPro — the unified bibliographic record (BiblioRecord) and its helpers.

   @typedef {Object} Author
   @property {string} full      "Ramírez-Ojeda, Gabriela" (or the short form when no full name is given)
   @property {string} last      "Ramírez-Ojeda"
   @property {string} first     "Gabriela" ('' when only initials are known)
   @property {string} initials  "G."
   @property {string} short     "Ramírez-Ojeda G."
   @property {string[]} affiliations
   @property {?string} country  ISO 3166-1 alpha-2 code of the first affiliation with a recognised country
   @property {string} [id]      author identifier given by the database

   @typedef {Object} Reference
   @property {string} raw          the cited reference exactly as exported
   @property {string} firstAuthor
   @property {?number} year
   @property {string} source
   @property {string} volume
   @property {string} page
   @property {string} doi

   @typedef {Object} BiblioRecord
   @property {string} id           unique in the session ("f2-17": file 2, record 17)
   @property {number} fileId
   @property {string} source       'idxA'|'idxB'|'biomed'|'scholar'|'linked'|'openapi'|'ris'|'bibtex'|'table'
   @property {string} format       'csv'|'tabbed2'|'tagged2'|'tagged4'|'bibtex'|'ris'|'json'|'sheet' (a spreadsheet read as a table)
   @property {string} accession    the record identifier in its database
   @property {string} title
   @property {Author[]} authors
   @property {?number} year
   @property {string} sourceTitle
   @property {string} sourceAbbrev
   @property {string[]} issn
   @property {string[]} isbn
   @property {string} volume
   @property {string} issue
   @property {string} pages
   @property {string} articleNumber
   @property {string} doi          lower case, without resolver prefix
   @property {string} docType      normalised: article|review|conference|chapter|book|letter|editorial|erratum|note|thesis|report|data|preprint|retracted|other
   @property {string} docTypeRaw
   @property {?string} language    ISO 639-1 of the first language
   @property {string[]} languages
   @property {string} abstract
   @property {string[]} authorKeywords
   @property {string[]} indexKeywords
   @property {Reference[]} references
   @property {?number} timesCited  null when the source does not report citations
   @property {string} correspondingAuthor
   @property {?string} correspondingCountry
   @property {string} fundingText
   @property {string[]} subjectAreas
   @property {?boolean} openAccess
   @property {string} pmid
   @property {string} publisher
   @property {string[]} affiliations  every affiliation of the record (also when they are not tied to authors)
   @property {string[]} countries     ISO codes found in the affiliations, unique
   @property {string} originalRaw     the record as it came in the file */
'use strict';

function smpRecord(P) {
  P.newRecord = function () {
    return {
      id: '', fileId: 0, source: '', format: '', accession: '',
      title: '', authors: [], year: null, sourceTitle: '', sourceAbbrev: '', issn: [], isbn: [],
      volume: '', issue: '', pages: '', articleNumber: '', doi: '', docType: 'other', docTypeRaw: '',
      language: null, languages: [], abstract: '', authorKeywords: [], indexKeywords: [], references: [],
      timesCited: null, correspondingAuthor: '', correspondingCountry: null, fundingText: '', subjectAreas: [],
      openAccess: null, pmid: '', publisher: '', affiliations: [], countries: [], originalRaw: '',
    };
  };

  /* ---------- personal names ---------- */
  const PARTICLES = new Set(['de', 'da', 'das', 'do', 'dos', 'del', 'della', 'di', 'du', 'la', 'le', 'van', 'von', 'der', 'den', 'ten', 'ter', 'y', 'e', 'bin', 'al', 'el']);
  const UPPER = /\p{Lu}/u;

  function initialsOf(given) {
    const parts = given.split(/[\s.]+/).filter(Boolean);
    const letters = [];
    for (const p of parts) {
      if (PARTICLES.has(p.toLowerCase()) && p === p.toLowerCase()) continue;
      p.split(/[-\u2010\u2011]/).forEach(h => { const c = [...h][0]; if (c && UPPER.test(c)) letters.push(c); });
    }
    return letters.length ? letters.join('.') + '.' : '';
  }
  /* "JA", "J.A.", "J. A.", "O.O.", "L.Á." are initials; "JOHN" (an old upper-case given name) is not */
  function isInitials(s) {
    const t = s.replace(/[\s.\-]/g, '');
    if (!t.length || ![...t].every(c => UPPER.test(c))) return false;
    if (/[.\s\-]/.test(s.trim())) return s.trim().split(/[.\s\-]+/).filter(Boolean).every(ch => [...ch].length <= 2) && [...t].length <= 5;
    return [...t].length <= 3;
  }

  /* Accepts "Last, First", "Last, F.M.", "Last FM", "Last F.M.", "First Last" and a
     trailing database id "(57191977705)". */
  const SUFFIX = /[,\s]+(Jr\.?|Sr\.?|II|III|IV)$/;
  P.person = function (raw) {
    let s = P.clean(raw).replace(/\s*\((\d{5,})\)\s*$/, '');
    const idm = P.clean(raw).match(/\((\d{5,})\)\s*$/);
    let suffix = '';
    const sx = s.match(SUFFIX);
    if (sx) { suffix = sx[1]; s = s.slice(0, sx.index).trim(); }
    let last = '', first = '', initials = '';
    const comma = s.indexOf(',');
    if (comma > 0) {
      last = s.slice(0, comma).trim();
      let rest = s.slice(comma + 1).trim();
      const rx = rest.match(SUFFIX);
      if (rx) { suffix = rx[1]; rest = rest.slice(0, rx.index).trim(); }
      /* particles written after the given name belong to the surname: "Souza, Gleyse L. F. de" */
      const words = rest.split(' ');
      const tail = [];
      while (words.length > 1 && PARTICLES.has(words[words.length - 1]) ) tail.unshift(words.pop());
      if (tail.length) { last = tail.join(' ') + ' ' + last; rest = words.join(' '); }
      if (isInitials(rest)) initials = [...rest.replace(/[\s.\-]/g, '')].join('.') + '.';
      else { first = rest; initials = initialsOf(rest); }
    } else {
      /* "Vieira WADS": up to six initials after a surname written in mixed case */
      const m = s.match(/^(.*?\S)\s+((?:\p{Lu}\.?-?\s?){1,6})$/u);
      const letters = m ? [...m[2].replace(/[\s.\-]/g, '')].length : 0;
      if (m && ((/\p{Ll}/u.test(m[1]) && letters <= 6) || (isInitials(m[2]) && letters <= 3))) {
        last = m[1].trim();
        initials = [...m[2].replace(/[\s.\-]/g, '')].join('.') + '.';
      } else if (s.includes(' ') && !/\p{Lu}{3,}/u.test(s)) {
        const w = s.split(' ');
        last = w.pop(); first = w.join(' '); initials = initialsOf(first);
      } else {
        last = s;
      }
    }
    const short = initials ? last + ' ' + initials : last;
    const out = { full: first ? last + ', ' + first : short, last, first, initials, short, affiliations: [], country: null };
    if (idm) out.id = idm[1];
    if (suffix) out.suffix = suffix;
    return out;
  };

  /* Names written "Given Surname" (the open catalogue: "Adriana A.L. Ordóñez", "J GOMEZ",
     "María de la Cruz"). The surname is the last word with any particles before it;
     a double surname without a hyphen cannot be told apart from a middle name. */
  P.personFirstLast = function (raw) {
    let s = P.clean(raw);
    let suffix = '';
    const sx = s.match(SUFFIX);
    if (sx) { suffix = sx[1]; s = s.slice(0, sx.index).trim(); }
    const words = s.split(' ').filter(Boolean);
    if (words.length < 2 || s.includes(',')) return P.person(raw);
    let i = words.length - 1;
    while (i > 1 && PARTICLES.has(words[i - 1]) && words[i - 1] === words[i - 1].toLowerCase()) i--;
    const last = words.slice(i).join(' ');
    const first = words.slice(0, i).join(' ');
    const initials = initialsOf(first);
    const out = { full: last + ', ' + first, last, first, initials, short: initials ? last + ' ' + initials : last, affiliations: [], country: null };
    if (suffix) out.suffix = suffix;
    return out;
  };

  /* ---------- document types ---------- */
  const DOC_RULES = [
    ['retracted', /retract/],
    ['erratum', /errat|correction|corrigend/],
    ['review', /(^|[^k] )review|^review|systematic review|meta-analysis/],
    ['conference', /conference|proceeding|meeting|congress|symposium|^cpaper$|^conf$|inproceedings/],
    ['chapter', /chapter|^chap$|incollection|inbook/],
    ['book', /^book$|^books$|^ebook$|^edbook$|^book;|monograph/],
    ['letter', /letter|comment|correspondence/],
    ['editorial', /editorial/],
    ['note', /^note$|short survey|short communication/],
    ['thesis', /thesis|dissertation|^thes$|phdthesis|mastersthesis/],
    ['report', /(^|[^e] )report|^report|^rprt$|techreport/],
    ['data', /data paper|dataset/],
    ['preprint', /preprint/],
    ['article', /article|^jour$|journal|research support|comparative study|clinical trial|case report|^j$/],
  ];
  const DOC_ORDER = DOC_RULES.map(r => r[0]);
  /* One or several labels ("Article; Proceedings Paper", PT lines) → the most specific type */
  P.docType = function (labels) {
    const list = (Array.isArray(labels) ? labels : String(labels || '').split(';')).map(x => P.fold(x).trim()).filter(Boolean);
    let best = null;
    for (const l of list) {
      if (/^book review/.test(l)) { if (best == null) best = 'other'; continue; }
      for (const [code, re] of DOC_RULES) {
        if (re.test(l)) {
          if (best == null || best === 'other' || DOC_ORDER.indexOf(code) < DOC_ORDER.indexOf(best)) best = code;
          break;
        }
      }
    }
    return best || 'other';
  };

  /* ---------- languages ---------- */
  const LANG_CODES = 'af ar bg ca cs cy da de el en eo es et eu fa fi fr ga gl he hi hr hu hy id is it ja ka kk ko ku la lt lv mk ml mn mr ms mt nb nl nn no pl pt ro ru sk sl sq sr sv sw ta th tl tr uk ur uz vi zh'.split(' ');
  const LANG3 = { eng: 'en', spa: 'es', por: 'pt', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', ita: 'it', chi: 'zh', zho: 'zh', jpn: 'ja',
    rus: 'ru', kor: 'ko', tur: 'tr', pol: 'pl', cze: 'cs', ces: 'cs', dut: 'nl', nld: 'nl', ara: 'ar', per: 'fa', fas: 'fa', ind: 'id',
    hun: 'hu', hrv: 'hr', srp: 'sr', ukr: 'uk', rum: 'ro', ron: 'ro', slo: 'sk', slk: 'sk', swe: 'sv', may: 'ms', msa: 'ms', cat: 'ca',
    gre: 'el', ell: 'el', heb: 'he', lit: 'lt', slv: 'sl', afr: 'af', bul: 'bg', nor: 'no', dan: 'da', fin: 'fi', est: 'et', lav: 'lv',
    tha: 'th', vie: 'vi', glg: 'gl', baq: 'eu', eus: 'eu', lat: 'la', wel: 'cy', cym: 'cy', ice: 'is', isl: 'is', mac: 'mk', mkd: 'mk',
    alb: 'sq', sqi: 'sq', arm: 'hy', hye: 'hy', geo: 'ka', kat: 'ka', hin: 'hi', urd: 'ur', ben: 'bn', mul: null, und: null };
  let langIndex = null;
  function languageIndex() {
    if (langIndex) return langIndex;
    langIndex = Object.create(null);
    for (const loc of ['en', 'es', 'pt']) {
      let dn = null;
      try { dn = new Intl.DisplayNames([loc], { type: 'language' }); } catch (e) { dn = null; }
      if (!dn) continue;
      for (const c of LANG_CODES) { try { const n = dn.of(c); if (n && n !== c) { const k = P.fold(n); if (!(k in langIndex)) langIndex[k] = c; } } catch (e) { /* skip */ } }
    }
    langIndex.portugese = 'pt'; langIndex.castilian = 'es'; langIndex.chinese = 'zh'; langIndex.norwegian = 'no';
    return langIndex;
  }
  P.languages = function (raw) {
    const parts = String(raw || '').split(/[;,/]| and /).map(x => P.fold(x).trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
      let code = null;
      if (/^[a-z]{2}$/.test(p) && LANG_CODES.includes(p)) code = p;
      else if (/^[a-z]{3}$/.test(p) && p in LANG3) code = LANG3[p];
      else code = languageIndex()[p] || languageIndex()[p.replace(/\s*\(.*\)$/, '')] || null;
      if (code && !out.includes(code)) out.push(code);
    }
    return out;
  };

  /* ---------- finishing touches shared by every reader ---------- */
  P.finish = function (r) {
    r.title = P.clean(r.title).replace(/\.$/, '');
    r.abstract = P.clean(r.abstract);
    if (/^\[?no abstract available\]?$/i.test(r.abstract)) r.abstract = '';
    r.sourceTitle = P.clean(r.sourceTitle);
    r.sourceAbbrev = P.clean(r.sourceAbbrev);
    r.doi = P.doiOf(r.doi);
    r.authorKeywords = P.uniq(r.authorKeywords.map(P.clean));
    r.indexKeywords = P.uniq(r.indexKeywords.map(P.clean));
    r.subjectAreas = P.uniq(r.subjectAreas.map(P.clean));
    r.issn = P.uniq(r.issn.map(x => P.clean(x).replace(/\s*\(.*?\)\s*/g, '')).filter(Boolean));
    r.isbn = P.uniq(r.isbn.map(x => P.clean(x).replace(/\s*\(.*?\)\s*/g, '')).filter(Boolean));
    if (!r.docType || r.docType === 'other') r.docType = P.docType(r.docTypeRaw);
    if (!r.languages.length && r.language) r.languages = P.languages(r.language);
    r.language = r.languages[0] || null;
    /* authors: countries from their affiliations */
    const affs = [];
    for (const a of r.authors) {
      a.affiliations = P.uniq(a.affiliations.map(P.clean));
      if (!a.country) for (const af of a.affiliations) { const c = P.countryOf(af); if (c) { a.country = c; break; } }
      affs.push(...a.affiliations);
    }
    r.affiliations = P.uniq(r.affiliations.map(P.clean).concat(affs));
    const countries = [];
    for (const a of r.authors) if (a.country) countries.push(a.country);
    for (const af of r.affiliations) { const c = P.countryOf(af); if (c) countries.push(c); }
    r.countries = [...new Set(countries)];
    return r;
  };

  /* share of records that carry each field — shown in the import preview */
  P.COMPLETENESS_FIELDS = ['title', 'authors', 'year', 'sourceTitle', 'doi', 'abstract', 'keywords', 'references', 'affiliations', 'countries', 'timesCited'];
  P.completeness = function (records) {
    const n = records.length || 1;
    const count = { title: 0, authors: 0, year: 0, sourceTitle: 0, doi: 0, abstract: 0, keywords: 0, references: 0, affiliations: 0, countries: 0, timesCited: 0 };
    for (const r of records) {
      if (r.title) count.title++;
      if (r.authors.length) count.authors++;
      if (r.year != null) count.year++;
      if (r.sourceTitle) count.sourceTitle++;
      if (r.doi) count.doi++;
      if (r.abstract) count.abstract++;
      if (r.authorKeywords.length || r.indexKeywords.length) count.keywords++;
      if (r.references.length) count.references++;
      if (r.affiliations.length) count.affiliations++;
      if (r.countries.length) count.countries++;
      if (r.timesCited != null) count.timesCited++;
    }
    const out = {};
    for (const k in count) out[k] = records.length ? count[k] / n : 0;
    return out;
  };

  /* warnings about missing information, from the completeness shares */
  P.warningsFor = function (records, comp) {
    const w = [];
    if (!records.length) return w;
    if (comp.references === 0) w.push({ code: 'noReferences' });
    else if (comp.references < 0.5) w.push({ code: 'fewReferences', pct: Math.round(comp.references * 100) });
    if (comp.abstract === 0) w.push({ code: 'noAbstract' });
    if (comp.keywords === 0) w.push({ code: 'noKeywords' });
    if (comp.affiliations === 0) w.push({ code: 'noAffiliations' });
    else if (comp.countries < 0.5) w.push({ code: 'fewCountries', pct: Math.round(comp.countries * 100) });
    if (comp.timesCited === 0) w.push({ code: 'noCitations' });
    if (comp.doi < 0.5) w.push({ code: 'fewDoi', pct: Math.round(comp.doi * 100) });
    const noYear = records.filter(r => r.year == null).length;
    if (noYear) w.push({ code: 'noYear', n: noYear });
    return w;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpRecord);
