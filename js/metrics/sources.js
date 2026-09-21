/* SciMetricsPro — sources (journals, books, proceedings): identity, productivity, Bradford zones, impact, dynamics.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Source identity: the title without case, accents or punctuation ("&" = "and"); spellings that share
     an ISSN are the same source. The label is the most frequent spelling, preferring mixed case.
   · h-index: the largest h such that h documents have at least h citations each.
     Hirsch JE (2005) PNAS 102(46):16569–16572.
   · g-index: the largest g ≤ N such that the g most cited documents have at least g² citations together.
     Egghe L (2006) Scientometrics 69(1):131–152.
   · m-index: h / (reference year − first publication year in the collection + 1). Hirsch (2005);
     Aria M, Cuccurullo C (2017) Journal of Informetrics 11(4):959–975.
   · Bradford zones: sources ranked by number of documents are cut into three zones with about one third
     of the documents each; each cut is placed at the rank whose cumulative count is closest to 1/3 and 2/3
     of the total. Bradford SC (1934) Engineering 137:85–86. */
'use strict';

function smpSources(P) {
  P.sourceKey = function (title) {
    return P.fold(title).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  };

  P.issnKey = function (s) {
    const m = String(s == null ? '' : s).toUpperCase().replace(/[^0-9X]/g, '');
    return /^\d{7}[\dX]$/.test(m) ? m : '';
  };

  /* records → { keyOf: [group key per record, '' without source], labels: Map(key → label),
                 spellings: Map(key → [distinct spellings]) } */
  P.sourceGroups = function (records) {
    const parent = new Map();
    const find = k => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
    const union = (a, b) => { const x = find(a), y = find(b); if (x !== y) parent.set(y, x); };
    const nameKeys = records.map(r => P.sourceKey(r.sourceTitle));
    const byIssn = new Map();
    records.forEach((r, i) => {
      const k = nameKeys[i];
      if (!k) return;
      if (!parent.has(k)) parent.set(k, k);
      for (const s of r.issn || []) {
        const issn = P.issnKey(s);
        if (!issn) continue;
        if (byIssn.has(issn)) union(byIssn.get(issn), k); else byIssn.set(issn, k);
      }
    });
    /* each group is named by its most used name key, so keys stay stable when a variant is added */
    const members = new Map();
    records.forEach((r, i) => {
      const k = nameKeys[i];
      if (!k) return;
      const root = find(k);
      let g = members.get(root);
      if (!g) { g = { keys: new Map(), spellings: new Map() }; members.set(root, g); }
      g.keys.set(k, (g.keys.get(k) || 0) + 1);
      const sp = P.clean(r.sourceTitle);
      g.spellings.set(sp, (g.spellings.get(sp) || 0) + 1);
    });
    const caseScore = s => (s === s.toUpperCase() ? 0 : s === s.toLowerCase() ? 1 : 2);
    const rootKey = new Map(), labels = new Map(), spellings = new Map();
    for (const [root, g] of members) {
      const key = [...g.keys.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
      const label = [...g.spellings.entries()].sort((a, b) => caseScore(b[0]) - caseScore(a[0]) || b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      rootKey.set(root, key);
      labels.set(key, label);
      spellings.set(key, [...g.spellings.keys()]);
    }
    return { keyOf: nameKeys.map(k => (k ? rootKey.get(find(k)) : '')), labels, spellings };
  };

  const citationList = cites => cites.filter(c => c != null && isFinite(c)).sort((a, b) => b - a);

  P.hIndex = function (cites) {
    const c = citationList(cites);
    let h = 0;
    while (h < c.length && c[h] >= h + 1) h++;
    return h;
  };

  P.gIndex = function (cites) {
    const c = citationList(cites);
    let sum = 0, g = 0;
    for (let i = 0; i < c.length; i++) {
      sum += c[i];
      if (sum >= (i + 1) * (i + 1)) g = i + 1;
    }
    return g;
  };

  P.mIndex = function (h, firstYear, refYear) {
    if (h == null || firstYear == null || refYear == null) return null;
    const years = refYear - firstYear + 1;
    return years > 0 ? h / years : null;
  };

  /* counts sorted from most to least productive → { zoneOf: [1|2|3 per rank], cuts: [last index of zone 1, of zone 2], zones } */
  P.bradfordZones = function (counts) {
    const n = counts.length;
    const total = counts.reduce((s, x) => s + x, 0);
    if (!n || !total) return { zoneOf: [], cuts: [], zones: [], total: 0 };
    const cum = [];
    counts.reduce((s, x, i) => (cum[i] = s + x), 0);
    const cut = (target, from) => {
      if (from >= n) return n - 1;
      let best = from, bestD = Math.abs(cum[from] - target);
      for (let k = from + 1; k < n; k++) {
        const d = Math.abs(cum[k] - target);
        if (d < bestD) { bestD = d; best = k; } else if (cum[k] > target) break;
      }
      return best;
    };
    const k1 = cut(total / 3, 0);
    const k2 = Math.max(k1, cut(2 * total / 3, k1 + 1));
    const zoneOf = counts.map((x, i) => (i <= k1 ? 1 : i <= k2 ? 2 : 3));
    const zones = [1, 2, 3].map(z => {
      const idx = zoneOf.map((v, i) => (v === z ? i : -1)).filter(i => i >= 0);
      const docs = idx.reduce((s, i) => s + counts[i], 0);
      return { zone: z, sources: idx.length, documents: docs, shareDocuments: docs / total, shareSources: idx.length / n };
    });
    return { zoneOf, cuts: [k1, k2], zones, total };
  };

  /* records → { rows (one per source, most productive first), total, withoutSource, bradford, refYear } */
  P.sourcesTable = function (records, opts) {
    opts = opts || {};
    const refYear = opts.refYear != null ? +opts.refYear : new Date().getFullYear();
    const hasKeys = records.every(r => r.sourceKey != null);
    const groups = hasKeys ? null : P.sourceGroups(records);
    const byKey = new Map();
    let withoutSource = 0;
    records.forEach((r, i) => {
      const key = hasKeys ? r.sourceKey : groups.keyOf[i];
      if (!key) { withoutSource++; return; }
      let s = byKey.get(key);
      if (!s) {
        s = { key, label: hasKeys ? (r.sourceName || r.sourceTitle) : groups.labels.get(key), abbrevs: new Map(), issn: new Set(), n: 0, cites: [], citations: 0, citedDocs: 0, firstYear: null, lastYear: null, byYear: new Map() };
        byKey.set(key, s);
      }
      s.n++;
      if (r.timesCited != null && isFinite(r.timesCited)) { s.cites.push(r.timesCited); s.citations += r.timesCited; s.citedDocs++; }
      if (r.year != null) {
        if (s.firstYear == null || r.year < s.firstYear) s.firstYear = r.year;
        if (s.lastYear == null || r.year > s.lastYear) s.lastYear = r.year;
        s.byYear.set(r.year, (s.byYear.get(r.year) || 0) + 1);
      }
      const ab = P.clean(r.sourceAbbrev);
      if (ab) s.abbrevs.set(ab, (s.abbrevs.get(ab) || 0) + 1);
      for (const x of r.issn || []) { const k = P.issnKey(x); if (k) s.issn.add(k.slice(0, 4) + '-' + k.slice(4)); }
    });
    const rows = [...byKey.values()].sort((a, b) => b.n - a.n || b.citations - a.citations || a.label.localeCompare(b.label));
    const total = rows.reduce((s, x) => s + x.n, 0);
    const bradford = P.bradfordZones(rows.map(x => x.n));
    let cumulative = 0;
    rows.forEach((s, i) => {
      cumulative += s.n;
      const cited = s.citedDocs > 0;
      Object.assign(s, {
        rank: i + 1, share: s.n / total, cumulative, cumulativeShare: cumulative / total, zone: bradford.zoneOf[i],
        abbrev: s.abbrevs.size ? [...s.abbrevs.entries()].sort((a, b) => b[1] - a[1])[0][0] : '',
        issn: [...s.issn],
        meanTC: cited ? s.citations / s.citedDocs : null,
        h: cited ? P.hIndex(s.cites) : null,
        g: cited ? P.gIndex(s.cites) : null,
      });
      s.m = cited ? P.mIndex(s.h, s.firstYear, refYear) : null;
      delete s.abbrevs;
      delete s.cites;
    });
    return { rows, total, withoutSource, bradford, refYear };
  };

  /* cumulative documents per year of the given sources, over the years of the whole collection */
  P.sourceDynamics = function (records, rows) {
    let yMin = Infinity, yMax = -Infinity;
    for (const r of records) if (r.year != null) { if (r.year < yMin) yMin = r.year; if (r.year > yMax) yMax = r.year; }
    if (yMin === Infinity) return { years: [], series: [] };
    const years = [];
    for (let y = yMin; y <= yMax; y++) years.push(y);
    const series = rows.map(s => {
      let c = 0;
      return { key: s.key, label: s.label, annual: years.map(y => s.byYear.get(y) || 0), values: years.map(y => (c += s.byYear.get(y) || 0)) };
    });
    return { years, series };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpSources);
