/* SciMetricsPro — networks: social structure. Collaboration of authors, institutions and countries, collaboration between
   countries for the world map and the chronology of collaboration.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Collaboration network: two units are joined by the number of documents they sign together (co-authorship counted
     once per document, whatever the number of authors from each unit). C = AᵀA with A the document × unit matrix.
     Glänzel W, Schubert A (2004) Analysing scientific networks through co-authorship, in Moed HF, Glänzel W,
     Schmoch U (eds.) Handbook of Quantitative Science and Technology Research, pp. 257–276; Newman MEJ (2001)
     Proceedings of the National Academy of Sciences 98(2):404–409.
   · Authors: the author key of Cleaning (surname and initials, with the merges chosen there); institutions: the
     top-level institution of each affiliation (Cleaning), without case or accents; countries: every country of the
     document (authors' countries and affiliations).
   · Chronology: for each publication year, the mean number of countries per document among documents with at least one
     country, the mean number of institutions per document among documents with at least one institution, the mean
     number of authors and the share of documents with more than one country. */
'use strict';

function smpSocial(P) {
  P.SOCIAL_UNITS = ['authors', 'institutions', 'countries'];

  const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  /* institutions are compared with P.institutionKey (js/cleaning/institutions.js) */

  /* the countries of a record: countries of its authors and of its affiliations */
  P.recordCountries = function (r) {
    const set = new Set(r.countries || []);
    for (const a of r.authors || []) if (a.country) set.add(a.country);
    return [...set].sort();
  };

  /* the institutions of a record: those normalised in Cleaning, or else the top-level institution of each affiliation */
  P.recordInstitutions = function (r) {
    if (Array.isArray(r.institutions)) return r.institutions;
    const fromAuthors = (r.authors || []).flatMap(a => (a.affiliations || []).map(P.institutionOf)).filter(Boolean);
    return P.uniq(fromAuthors.length ? fromAuthors : (r.affiliations || []).map(P.institutionOf).filter(Boolean));
  };

  /* the units of each record for a collaboration network
     → { lists: [[keys]], labels: Map(key → most used spelling) (countries: the code) } */
  P.collaborationLists = function (records, unit) {
    const votes = new Map();
    const vote = (key, label) => { let m = votes.get(key); if (!m) { m = new Map(); votes.set(key, m); } m.set(label, (m.get(label) || 0) + 1); };
    const lists = records.map(r => {
      const keys = new Set();
      if (unit === 'institutions') {
        for (const name of P.recordInstitutions(r)) { const k = P.institutionKey(name); if (k) { keys.add(k); vote(k, P.clean(name)); } }
      } else if (unit === 'countries') {
        for (const c of P.recordCountries(r)) { keys.add(c); vote(c, c); }
      } else {
        for (const a of r.authors || []) {
          const k = a.key || P.authorKey(a);
          if (k && k.charAt(0) !== '|') { keys.add(k); vote(k, a.label || P.authorLabel(a)); }
        }
      }
      return [...keys];
    });
    const labels = new Map();
    for (const [k, m] of votes) labels.set(k, [...m.entries()].sort((a, b) => b[1] - a[1] || byKey(a[0], b[0]))[0][0]);
    return { lists, labels };
  };

  /* collaboration between countries
     → { countries: [{ code, documents, international, partners, collaborations, top, topDocuments }] (most documents first),
         pairs: [{ a, b, documents }] (a < b; most documents first), withCountry, international } */
  P.countryCollaboration = function (records) {
    const stats = new Map(), pairs = new Map();
    let withCountry = 0, international = 0;
    const entry = code => { let s = stats.get(code); if (!s) { s = { code, documents: 0, international: 0, partnerDocs: new Map() }; stats.set(code, s); } return s; };
    for (const r of records) {
      const cs = P.recordCountries(r);
      if (!cs.length) continue;
      withCountry++;
      if (cs.length > 1) international++;
      for (const c of cs) { const s = entry(c); s.documents++; if (cs.length > 1) s.international++; }
      for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
          const k = cs[i] + '|' + cs[j];
          pairs.set(k, (pairs.get(k) || 0) + 1);
          const a = stats.get(cs[i]), b = stats.get(cs[j]);
          a.partnerDocs.set(cs[j], (a.partnerDocs.get(cs[j]) || 0) + 1);
          b.partnerDocs.set(cs[i], (b.partnerDocs.get(cs[i]) || 0) + 1);
        }
      }
    }
    const countries = [...stats.values()].map(s => {
      const partners = [...s.partnerDocs.entries()].sort((x, y) => y[1] - x[1] || byKey(x[0], y[0]));
      return {
        code: s.code, documents: s.documents, international: s.international, partners: partners.length,
        collaborations: partners.reduce((acc, p) => acc + p[1], 0), top: partners.length ? partners[0][0] : '', topDocuments: partners.length ? partners[0][1] : 0,
        partnerList: partners.map(p => ({ code: p[0], documents: p[1] })),
      };
    }).sort((a, b) => b.documents - a.documents || b.collaborations - a.collaborations || byKey(a.code, b.code));
    const pairList = [...pairs.entries()].map(([k, n]) => { const [a, b] = k.split('|'); return { a, b, documents: n }; })
      .sort((x, y) => y.documents - x.documents || byKey(x.a, y.a) || byKey(x.b, y.b));
    return { countries, pairs: pairList, withCountry, international, documents: records.length };
  };

  /* chronology of collaboration: one row per year from the first to the last (years without documents included)
     → { rows: [{ year, documents, authors (mean), withCountry, countries (mean), withInstitution, institutions (mean), international (share) }], totals } */
  P.collaborationTimeline = function (records) {
    const byYear = new Map();
    const total = { documents: 0, authorSum: 0, withAuthors: 0, withCountry: 0, countrySum: 0, international: 0, withInstitution: 0, institutionSum: 0 };
    for (const r of records) {
      if (r.year == null) continue;
      let e = byYear.get(r.year);
      if (!e) { e = { documents: 0, authorSum: 0, withAuthors: 0, withCountry: 0, countrySum: 0, international: 0, withInstitution: 0, institutionSum: 0 }; byYear.set(r.year, e); }
      const nAuthors = (r.authors || []).length, nCountries = P.recordCountries(r).length;
      const nInst = new Set(P.recordInstitutions(r).map(P.institutionKey).filter(Boolean)).size;
      for (const acc of [e, total]) {
        acc.documents++;
        if (nAuthors) { acc.withAuthors++; acc.authorSum += nAuthors; }
        if (nCountries) { acc.withCountry++; acc.countrySum += nCountries; if (nCountries > 1) acc.international++; }
        if (nInst) { acc.withInstitution++; acc.institutionSum += nInst; }
      }
    }
    const row = (year, e) => ({
      year, documents: e.documents,
      authors: e.withAuthors ? e.authorSum / e.withAuthors : null,
      withCountry: e.withCountry, countries: e.withCountry ? e.countrySum / e.withCountry : null,
      withInstitution: e.withInstitution, institutions: e.withInstitution ? e.institutionSum / e.withInstitution : null,
      international: e.withCountry ? e.international / e.withCountry : null,
    });
    const years = [...byYear.keys()].sort((a, b) => a - b);
    const rows = [];
    if (years.length) for (let y = years[0]; y <= years[years.length - 1]; y++) rows.push(row(y, byYear.get(y) || { documents: 0, authorSum: 0, withAuthors: 0, withCountry: 0, countrySum: 0, international: 0, withInstitution: 0, institutionSum: 0 }));
    return { rows, totals: row(null, total) };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpSocial);
