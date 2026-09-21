/* SciMetricsPro — authors, institutions and countries.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Productivity: documents per author (full counting) and fractional counting, where each document
     gives 1/n to each of its n authors, so the fractions of a document add up to 1.
   · Production over time: documents and citations per author and year; citations per year of a year t
     are its citations divided by (reference year − t + 1). Aria M, Cuccurullo C (2017) Journal of
     Informetrics 11(4):959–975.
   · Lotka's law: the share of authors with x documents is f(x) = C / x^β. β and C are estimated by least
     squares on log10 f(x) = log10 C − β log10 x over x = 1, 2 … up to the first x without authors (see the
     note in P.lotka); the observed distribution is compared
     with the theoretical law (β = 2, C = 6/π²) with the Kolmogorov–Smirnov statistic D = max |F_obs − F_exp|
     on the cumulative shares; critical values 1.36/√N (5 %) and 1.63/√N (1 %), N = authors.
     Lotka AJ (1926) Journal of the Washington Academy of Sciences 16(12):317–323.
     Pao ML (1985) Information Processing & Management 21(4):305–320.
     Clauset A, Shalizi CR, Newman MEJ (2009) SIAM Review 51(4):661–703.
     p-values from the asymptotic Kolmogorov distribution with Stephens' correction:
     Stephens MA (1970) Journal of the Royal Statistical Society B 32(1):115–122.
   · Countries: the country of the corresponding author (or of the first author with a country when the
     database gives none); single-country (SCP) and multiple-country (MCP) publications by whether the
     authors' affiliations span more than one country. */
'use strict';

function smpAuthorMetrics(P) {
  const keyOf = a => a.key || P.authorKey(a);
  const labelOf = a => a.label || P.authorLabel(a);
  const hasSurname = k => k && k.charAt(0) !== '|';
  const top = m => { let best = null, n = -1; for (const [k, v] of m) if (v > n || (v === n && String(k) < String(best))) { best = k; n = v; } return best; };

  /* records → { rows (authors, most productive first), docs (documents with authors), refYear } */
  P.authorsTable = function (records, opts) {
    opts = opts || {};
    const refYear = opts.refYear != null ? +opts.refYear : new Date().getFullYear();
    const byKey = new Map();
    let docs = 0;
    for (const r of records) {
      const seen = new Map();
      for (const a of r.authors) { const k = keyOf(a); if (hasSurname(k) && !seen.has(k)) seen.set(k, a); }
      if (!seen.size) continue;
      docs++;
      const cited = r.timesCited != null && isFinite(r.timesCited);
      for (const [k, a] of seen) {
        let s = byKey.get(k);
        if (!s) { s = { key: k, label: labelOf(a), n: 0, fractional: 0, cites: [], citations: 0, citedDocs: 0, firstYear: null, lastYear: null, byYear: new Map(), inst: new Map(), ctry: new Map() }; byKey.set(k, s); }
        s.n++;
        s.fractional += 1 / seen.size;
        if (cited) { s.cites.push(r.timesCited); s.citations += r.timesCited; s.citedDocs++; }
        if (r.year != null) {
          if (s.firstYear == null || r.year < s.firstYear) s.firstYear = r.year;
          if (s.lastYear == null || r.year > s.lastYear) s.lastYear = r.year;
          let y = s.byYear.get(r.year);
          if (!y) { y = { n: 0, citations: 0 }; s.byYear.set(r.year, y); }
          y.n++;
          if (cited) y.citations += r.timesCited;
        }
        for (const inst of a.institutions || []) s.inst.set(inst, (s.inst.get(inst) || 0) + 1);
        if (a.country) s.ctry.set(a.country, (s.ctry.get(a.country) || 0) + 1);
      }
    }
    const rows = [...byKey.values()].sort((a, b) => b.n - a.n || b.fractional - a.fractional || b.citations - a.citations || a.label.localeCompare(b.label));
    rows.forEach((s, i) => {
      const cited = s.citedDocs > 0;
      s.rank = i + 1;
      s.h = cited ? P.hIndex(s.cites) : null;
      s.g = cited ? P.gIndex(s.cites) : null;
      s.m = cited ? P.mIndex(s.h, s.firstYear, refYear) : null;
      s.institution = top(s.inst) || '';
      s.country = top(s.ctry) || '';
      delete s.cites; delete s.inst; delete s.ctry;
    });
    return { rows, docs, refYear };
  };

  /* documents and citations per year of the given authors (bubbles of the production over time) */
  P.authorProduction = function (rows, refYear) {
    const points = [];
    rows.forEach((s, i) => {
      for (const [year, y] of [...s.byYear.entries()].sort((a, b) => a[0] - b[0])) {
        const citable = refYear - year + 1;
        points.push({ row: i, key: s.key, label: s.label, year, n: y.n, citations: y.citations, citationsPerYear: citable > 0 ? y.citations / citable : null });
      }
    });
    return points;
  };

  /* ---------- Lotka ---------- */
  /* Kolmogorov distribution: Q(λ) = 2 Σ (−1)^(j−1) exp(−2 j² λ²), the probability of exceeding λ */
  P.kolmogorovQ = function (lambda) {
    if (!(lambda > 0)) return 1;
    let sum = 0, prev = 0;
    for (let j = 1; j <= 200; j++) {
      const term = Math.exp(-2 * j * j * lambda * lambda);
      sum += (j % 2 ? 1 : -1) * term;
      if (term < 1e-12 || Math.abs(term - prev) < 1e-15) break;
      prev = term;
    }
    return Math.min(1, Math.max(0, 2 * sum));
  };
  /* p-value of a one-sample statistic D with n observations (Stephens' correction) */
  P.ksPValue = function (D, n) {
    if (!(n > 0)) return null;
    const s = Math.sqrt(n);
    return P.kolmogorovQ((s + 0.12 + 0.11 / s) * D);
  };

  /* Lotka's constant for an exponent β, as in Pao (1985): C = 1 / (Σ_{x<P} x^−β + 1/((β−1)P^(β−1)) + 1/(2P^β) + β/(24(P−1)^(β+1))), P = 20 */
  P.lotkaConstant = function (beta) {
    if (!(beta > 1)) return null;
    const Pn = 20;
    let s = 0;
    for (let x = 1; x < Pn; x++) s += Math.pow(x, -beta);
    s += 1 / ((beta - 1) * Math.pow(Pn, beta - 1)) + 1 / (2 * Math.pow(Pn, beta)) + beta / (24 * Math.pow(Pn - 1, beta + 1));
    return 1 / s;
  };

  /* least squares of y on x → { slope, intercept, r2 } */
  P.linearFit = function (xs, ys) {
    const n = xs.length;
    if (n < 2) return null;
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    if (!sxx) return null;
    const slope = sxy / sxx;
    return { slope, intercept: my - slope * mx, r2: syy ? (sxy * sxy) / (sxx * syy) : 1 };
  };

  /* documents per author (one number per author) → the Lotka analysis */
  P.lotka = function (counts) {
    const N = counts.length;
    if (!N) return null;
    const freq = new Map();
    let xmax = 0;
    for (const c of counts) { freq.set(c, (freq.get(c) || 0) + 1); if (c > xmax) xmax = c; }
    const xs = [...freq.keys()].sort((a, b) => a - b);
    /* the fit uses x = 1, 2, 3 … up to the first value without authors: beyond it the few very productive
       authors appear one by one at a constant share of 1/N and flatten the line (least squares on the
       tail of a power law is biased; Clauset, Shalizi & Newman 2009). With fewer than three such values,
       every observed x is used. */
    let run = 0;
    while (freq.has(run + 1)) run++;
    const fitXs = run >= 3 ? xs.filter(x => x <= run) : xs;
    const fit = fitXs.length >= 2 ? P.linearFit(fitXs.map(x => Math.log10(x)), fitXs.map(x => Math.log10(freq.get(x) / N))) : null;
    const beta = fit ? -fit.slope : null;
    const C = fit ? Math.pow(10, fit.intercept) : null;
    const C2 = 6 / (Math.PI * Math.PI);
    const Cfit = beta != null ? P.lotkaConstant(beta) : null;
    const rows = [];
    let cumObs = 0, cumTh = 0, cumFit = 0, D = 0, Dfit = 0;
    for (let x = 1; x <= xmax; x++) {
      const authors = freq.get(x) || 0;
      const observed = authors / N, theoretical = C2 / (x * x), fitted = Cfit != null ? Cfit * Math.pow(x, -beta) : null;
      cumObs += observed; cumTh += theoretical;
      if (fitted != null) cumFit += fitted;
      D = Math.max(D, Math.abs(cumObs - cumTh));
      if (fitted != null) Dfit = Math.max(Dfit, Math.abs(cumObs - cumFit));
      rows.push({ x, authors, observed, theoretical, fitted, cumObserved: cumObs, cumTheoretical: cumTh, diff: Math.abs(cumObs - cumTh) });
    }
    const sq = Math.sqrt(N);
    return {
      authors: N, xmax, distinctX: xs.length, fitPoints: fitXs.length, fitMax: fitXs.length ? fitXs[fitXs.length - 1] : null, rows,
      beta, C, r2: fit ? fit.r2 : null, Cfit,
      ks: { D, critical05: 1.36 / sq, critical01: 1.63 / sq, p: P.ksPValue(D, N) },
      ksFitted: Cfit != null ? { D: Dfit, p: P.ksPValue(Dfit, N) } : null,
    };
  };

  /* ---------- institutions ---------- */
  /* documents where each institution appears and author appearances (author–institution pairs);
     spellings with the same P.institutionKey are one institution, named by its most used spelling */
  P.institutionsTable = function (records) {
    const byKey = new Map();
    let withInstitution = 0, withoutAffiliations = 0;
    const add = (name, field, amount) => {
      const k = P.institutionKey(name);
      if (!k) return null;
      let s = byKey.get(k);
      if (!s) { s = { key: k, name, documents: 0, appearances: 0, ctry: new Map(), spell: new Map() }; byKey.set(k, s); }
      s[field] += amount;
      return s;
    };
    const spelled = (s, name) => { const sp = P.clean(name); s.spell.set(sp, (s.spell.get(sp) || 0) + 1); };
    for (const r of records) {
      const hasAff = r.affiliations.length || r.authors.some(a => a.affiliations.length);
      if (!hasAff) withoutAffiliations++;
      const names = r.institutions || [];
      if (names.length) withInstitution++;
      const inDoc = new Set();
      for (const name of names) { const s = add(name, 'documents', 0); if (s && !inDoc.has(s.key)) { s.documents++; inDoc.add(s.key); spelled(s, name); } }
      let linked = false;
      for (const a of r.authors) {
        for (const name of a.institutions || []) { const s = add(name, 'appearances', 1); if (s && a.country) s.ctry.set(a.country, (s.ctry.get(a.country) || 0) + 1); linked = true; }
      }
      if (!linked) for (const name of names) add(name, 'appearances', 1);
    }
    const rows = [...byKey.values()].sort((a, b) => b.documents - a.documents || b.appearances - a.appearances || a.name.localeCompare(b.name));
    rows.forEach(s => { if (s.spell.size) s.name = top(s.spell); delete s.spell; });
    rows.sort((a, b) => b.documents - a.documents || b.appearances - a.appearances || a.name.localeCompare(b.name));
    rows.forEach((s, i) => { s.rank = i + 1; s.share = records.length ? s.documents / records.length : null; s.country = top(s.ctry) || ''; delete s.ctry; });
    return { rows, documents: records.length, withInstitution, withoutAffiliations };
  };

  /* ---------- countries ---------- */
  P.countriesTable = function (records) {
    const corr = new Map(), all = new Map();
    const basis = { corresponding: 0, firstAuthor: 0, affiliation: 0, none: 0 };
    let withCountry = 0;
    const entry = (map, code, init) => { let s = map.get(code); if (!s) { s = Object.assign({ code }, init); map.set(code, s); } return s; };
    for (const r of records) {
      const countries = new Set(r.countries);
      for (const a of r.authors) if (a.country) countries.add(a.country);
      if (countries.size) withCountry++;
      /* country of the document: corresponding author, else first author with a country, else first affiliation */
      let code = r.correspondingCountry || null, how = 'corresponding';
      if (!code) { const a = r.authors.find(x => x.country); if (a) { code = a.country; how = 'firstAuthor'; } }
      if (!code && r.countries.length) { code = r.countries[0]; how = 'affiliation'; }
      if (!code) { basis.none++; } else {
        basis[how]++;
        const s = entry(corr, code, { documents: 0, scp: 0, mcp: 0, citations: 0, citedDocs: 0 });
        s.documents++;
        if (countries.size > 1) s.mcp++; else s.scp++;
        if (r.timesCited != null && isFinite(r.timesCited)) { s.citations += r.timesCited; s.citedDocs++; }
      }
      /* every author counts once for their country; affiliations without an author count once per country */
      let linked = false;
      for (const a of r.authors) if (a.country) { entry(all, a.country, { appearances: 0, documents: 0 }).appearances++; linked = true; }
      if (!linked) for (const c of new Set(r.countries)) entry(all, c, { appearances: 0, documents: 0 }).appearances++;
      for (const c of countries) entry(all, c, { appearances: 0, documents: 0 }).documents++;
    }
    const corresponding = [...corr.values()].map(s => Object.assign(s, { mcpRatio: s.documents ? s.mcp / s.documents : null, meanTC: s.citedDocs ? s.citations / s.citedDocs : null }))
      .sort((a, b) => b.documents - a.documents || b.citations - a.citations || a.code.localeCompare(b.code));
    const authors = [...all.values()].sort((a, b) => b.appearances - a.appearances || b.documents - a.documents || a.code.localeCompare(b.code));
    return { corresponding, authors, basis, withCountry, documents: records.length };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpAuthorMetrics);
