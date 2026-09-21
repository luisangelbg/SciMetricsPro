/* SciMetricsPro — main information about a collection (overview indicators).
   Pure functions (no window, no DOM): they run in the page and in a worker.

   Definitions follow the main-information table of
   Aria M, Cuccurullo C (2017) Journal of Informetrics 11(4):959–975. doi:10.1016/j.joi.2017.08.007
   · timespan: first and last publication year
   · annual growth rate (%) = ((N_last / N_first)^(1 / (years − 1)) − 1) × 100, with N the documents
     of the first and last year of the timespan and years = last − first + 1
   · document average age = mean(reference year − publication year)
   · average citations per document = mean of the citation counts reported by the databases
   · co-authors per document = mean number of authors per document
   · international co-authorship (%) = documents with authors from more than one country / documents × 100
   · average citations per year: for the documents of year t, mean citations and mean citations
     divided by the citable years (reference year − t + 1). */
'use strict';

function smpOverview(P) {
  /* compound annual growth rate in %, or null when it cannot be computed */
  P.annualGrowthRate = function (nFirst, nLast, years) {
    if (!(years > 1) || !(nFirst > 0) || !(nLast >= 0)) return null;
    return (Math.pow(nLast / nFirst, 1 / (years - 1)) - 1) * 100;
  };

  /* Records are rebuilt on every cleaning run, but their keyword lists are shared with the imported
     ones, so their terms are kept between runs (per dictionary). Distinct cited references are the
     clusters of P.referenceClusters (js/metrics/documents.js), which keeps its own keys per reference. */
  const termCache = new WeakMap();
  const keywordTerms = (r, field, dict) => {
    const list = r[field];
    let byList = termCache.get(dict);
    if (!byList) { byList = new WeakMap(); termCache.set(dict, byList); }
    let terms = byList.get(list);
    if (!terms) { terms = P.termsOf(r, field, dict); byList.set(list, terms); }
    return terms;
  };

  const authorKeyOf = a => a.key || P.authorKey(a);
  const hasSurname = key => key && key.charAt(0) !== '|';

  /* records → indicators. opts: { refYear (default: current year), dict: { synonyms, stop },
     distinctReferences: already counted (null while it is being computed; left out = counted here) } */
  P.overview = function (records, opts) {
    opts = opts || {};
    const refYear = opts.refYear != null ? +opts.refYear : new Date().getFullYear();
    const dict = opts.dict || {};
    const n = records.length;

    let yMin = Infinity, yMax = -Infinity, withYear = 0, ageSum = 0;
    const byYear = new Map();
    const sources = new Set(), authors = new Set(), singleAuthors = new Set();
    let appearances = 0, docsWithAuthors = 0, singleDocs = 0;
    let tcSum = 0, tcDocs = 0;
    let intl = 0, withCountry = 0;
    const authorKw = new Set(), indexKw = new Set();
    let refTotal = 0, refDocs = 0;
    const types = new Map();

    for (const r of records) {
      const cited = r.timesCited != null && isFinite(r.timesCited);
      if (r.year != null) {
        const y = r.year;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
        withYear++;
        ageSum += refYear - y;
        let e = byYear.get(y);
        if (!e) { e = { n: 0, tcSum: 0, tcDocs: 0 }; byYear.set(y, e); }
        e.n++;
        if (cited) { e.tcSum += r.timesCited; e.tcDocs++; }
      }

      const src = r.sourceKey != null ? r.sourceKey : P.sourceKey(r.sourceTitle);
      if (src) sources.add(src);

      if (r.authors.length) {
        docsWithAuthors++;
        appearances += r.authors.length;
        for (const a of r.authors) { const k = authorKeyOf(a); if (hasSurname(k)) authors.add(k); }
        if (r.authors.length === 1) {
          singleDocs++;
          const k = authorKeyOf(r.authors[0]);
          if (hasSurname(k)) singleAuthors.add(k);
        }
      }

      if (cited) { tcSum += r.timesCited; tcDocs++; }

      const countries = new Set(r.countries);
      if (countries.size) withCountry++;
      if (countries.size > 1) intl++;

      for (const k of keywordTerms(r, 'authorKeywords', dict)) authorKw.add(k);
      for (const k of keywordTerms(r, 'indexKeywords', dict)) indexKw.add(k);

      if (r.references.length) { refDocs++; refTotal += r.references.length; }

      let tp = types.get(r.docType);
      if (!tp) { tp = { n: 0, tcSum: 0, tcDocs: 0, raw: new Map() }; types.set(r.docType, tp); }
      tp.n++;
      if (cited) { tp.tcSum += r.timesCited; tp.tcDocs++; }
      const raw = P.clean(r.docTypeRaw);
      if (raw) tp.raw.set(raw, (tp.raw.get(raw) || 0) + 1);
    }

    /* every year of the timespan, including years without documents */
    const annual = [];
    if (withYear) {
      let cumulative = 0;
      for (let y = yMin; y <= yMax; y++) {
        const e = byYear.get(y) || { n: 0, tcSum: 0, tcDocs: 0 };
        cumulative += e.n;
        const citableYears = refYear - y + 1;
        const meanTC = e.tcDocs ? e.tcSum / e.tcDocs : null;
        annual.push({
          year: y, n: e.n, cumulative, citations: e.tcSum, citedDocs: e.tcDocs, meanTC,
          citableYears, meanTCperYear: meanTC != null && citableYears > 0 ? meanTC / citableYears : null,
        });
      }
    }
    const years = withYear ? yMax - yMin + 1 : 0;

    const docTypes = [...types.entries()].map(([type, e]) => ({
      type, n: e.n, share: n ? e.n / n : null, citations: e.tcSum, citedDocs: e.tcDocs,
      meanTC: e.tcDocs ? e.tcSum / e.tcDocs : null,
      raw: [...e.raw.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(x => x[0]),
    })).sort((a, b) => b.n - a.n || a.type.localeCompare(b.type));

    return {
      refYear,
      documents: n,
      period: withYear ? { from: yMin, to: yMax, years } : null,
      noYear: n - withYear,
      sources: sources.size,
      authors: authors.size,
      authorAppearances: appearances,
      docsWithAuthors,
      singleAuthoredDocs: singleDocs,
      singleAuthors: singleAuthors.size,
      authorsPerDoc: docsWithAuthors ? appearances / docsWithAuthors : null,
      growthRate: withYear ? P.annualGrowthRate(byYear.get(yMin).n, byYear.get(yMax).n, years) : null,
      meanAge: withYear ? ageSum / withYear : null,
      citations: { total: tcSum, docs: tcDocs, mean: tcDocs ? tcSum / tcDocs : null },
      international: { docs: intl, withCountry, share: n ? intl / n : null },
      authorKeywords: authorKw.size,
      indexKeywords: indexKw.size,
      references: { total: refTotal, distinct: opts.distinctReferences !== undefined ? opts.distinctReferences : P.distinctReferences(records), docs: refDocs },
      annual,
      docTypes,
    };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpOverview);
