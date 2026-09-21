/* SciMetricsPro — documents and content: most cited documents, local citations, cited references,
   reference publication year spectroscopy, word frequencies, word growth and trend topics.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   · Citations per year = TC / (reference year − publication year + 1); normalised citations = TC / mean TC
     of the documents of the same year. Aria M, Cuccurullo C (2017) Journal of Informetrics 11(4):959–975.
   · Local citations (local citation score): how many documents of the collection cite each document of the
     collection. Garfield E, Pudovkin AI, Istomin VS (2003) Journal of the American Society for Information
     Science and Technology 54(5):400–412. A reference points to a document when both have the same DOI (or
     the same catalogue identifier); otherwise when the first author's surname and the year are the same and
     the source is compatible word by word ("J Ecol" = "J. Ecol." = "Journal of Ecology"), or volume and first
     page agree, or the document's title is written in the reference (see P.localCitations for the details and
     typos). A different volume rules a document out; if several documents still qualify the reference is
     ambiguous and is not counted.
   · Cited references: occurrences of the same work are joined when they share a DOI, a catalogue identifier,
     first author + year + volume + first page, the same text without case, accents or punctuation, or a match
     to the same document of the collection (P.localCitations).
   · Reference publication year spectroscopy (RPYS): number of cited references (NCR) per reference year t and
     its deviation from the median of the five-year window t − 2 … t + 2 (years without references count 0).
     Marx W, Bornmann L, Barth A, Leydesdorff L (2014) Journal of the Association for Information Science and
     Technology 65(4):751–764.
   · Trend topics: first quartile, median and third quartile of the publication years of the documents that
     use each term, with the sample quantile of type 7 (linear interpolation between order statistics).
     Hyndman RJ, Fan Y (1996) The American Statistician 50(4):361–365.
   · Treemap: squarified layout. Bruls M, Huizing K, van Wijk JJ (2000) Squarified treemaps, in Data
     Visualization 2000, pp. 33–42. */
'use strict';

function smpDocuments(P) {
  /* ---------------- most cited documents ---------------- */

  /* "Surname I.N., 2020, Source" */
  P.documentLabel = function (r) {
    const a = r.authors && r.authors[0];
    const who = a ? P.clean(a.short || P.authorLabel(a)) : '';
    const src = P.clean(r.sourceAbbrev || r.sourceName || r.sourceTitle);
    return [who, r.year != null ? String(r.year) : '', src].filter(Boolean).join(', ') || P.clean(r.title).slice(0, 80);
  };

  P.citationsPerYear = function (tc, year, refYear) {
    if (tc == null || !isFinite(tc) || year == null) return null;
    const span = refYear - year + 1;
    return span > 0 ? tc / span : null;
  };

  /* records → { rows: [{ index, rank, label, citations, perYear, normalized, year }] (documents with a
     citation count, most cited first), withCitations, total, refYear } */
  P.citedDocuments = function (records, opts) {
    opts = opts || {};
    const refYear = opts.refYear != null ? +opts.refYear : new Date().getFullYear();
    const byYear = new Map();
    let total = 0;
    records.forEach(r => {
      if (r.timesCited == null || !isFinite(r.timesCited)) return;
      total += r.timesCited;
      if (r.year == null) return;
      const e = byYear.get(r.year) || { sum: 0, n: 0 };
      e.sum += r.timesCited; e.n++;
      byYear.set(r.year, e);
    });
    const rows = [];
    records.forEach((r, index) => {
      if (r.timesCited == null || !isFinite(r.timesCited)) return;
      const e = r.year != null ? byYear.get(r.year) : null;
      const mean = e && e.n ? e.sum / e.n : null;
      rows.push({
        index, label: P.documentLabel(r), year: r.year, citations: r.timesCited,
        perYear: P.citationsPerYear(r.timesCited, r.year, refYear),
        normalized: mean > 0 ? r.timesCited / mean : null,
      });
    });
    rows.sort((a, b) => b.citations - a.citations || (b.perYear || 0) - (a.perYear || 0) || a.index - b.index);
    rows.forEach((row, i) => { row.rank = i + 1; });
    return { rows, withCitations: rows.length, total, refYear };
  };

  /* ---------------- matching references to documents ---------------- */

  const DOTTED_INITIALS = /^(?:\p{Lu}\.-?)+$/u;
  const BARE_INITIALS = /^\p{Lu}{1,4}$/u;

  /* surname and initials of a reference's first author: "Smith JA", "SMITH J", "Toledo V.M.", "de la Cruz M.", "Smith, J."
     → { surname: 'smith', initials: 'ja' } (letters only, without case or accents) */
  P.refAuthorParts = function (name) {
    const s = P.clean(P.clean(name).replace(/^\*/, '').replace(/,/g, ' '));
    if (!s || /^\[?anonymous\]?$/i.test(s)) return { surname: '', initials: '' };
    const all = s.split(' ');
    const words = all.slice();
    while (words.length > 1 && DOTTED_INITIALS.test(words[words.length - 1])) words.pop();
    /* initials without dots ("Smith JA") only when no dotted initials were found; spaced single letters before them
       are initials too ("NEWMAN M E J"), but not a short surname ("LI Y" keeps "LI") */
    if (words.length === all.length && words.length > 1 && BARE_INITIALS.test(words[words.length - 1])) {
      words.pop();
      while (words.length > 1 && /^\p{Lu}$/u.test(words[words.length - 1])) words.pop();
    }
    return { surname: P.fold(words.join('')).replace(/[^a-z]/g, ''), initials: P.fold(all.slice(words.length).join('')).replace(/[^a-z]/g, '') };
  };
  P.refSurname = name => P.refAuthorParts(name).surname;

  P.surnameOf = a => P.fold(a && (a.last || a.short || a.full) || '').replace(/[^a-z]/g, '');

  /* words of a source title or abbreviation; connectors are dropped unless they are the last word ("Phys Rev E") */
  const CONNECTORS = new Set('of the and de del la las los el y e et for in on des du und fur der da do dos das a an en di della van von'.split(' '));
  P.sourceWords = function (title) {
    const w = P.sourceKey(title).split(' ').filter(Boolean);
    return w.filter((x, i) => i === w.length - 1 || !CONNECTORS.has(x));
  };

  const subsequence = (s, l) => { let j = 0; for (let i = 0; i < l.length && j < s.length; i++) if (l[i] === s[j]) j++; return j === s.length; };
  const wordMatch = (a, b) => {
    if (a === b) return true;
    const s = a.length <= b.length ? a : b, l = s === a ? b : a;
    return l.startsWith(s) || (s.length >= 3 && s[0] === l[0] && subsequence(s, l));
  };
  /* "genet resour crop ev" ~ "genetic resources crop evolution"; "natl" ~ "national" */
  P.sourceWordsMatch = function (a, b) {
    if (!a.length || !b.length) return false;
    if (a.join('') === b.join('')) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!wordMatch(a[i], b[i])) return false;
    return true;
  };

  const numKey = s => P.fold(s).replace(/[^a-z0-9]/g, '');
  const firstPage = s => numKey(String(s == null ? '' : s).split(/[-–]/)[0]);
  const CATALOGUE_ID = /^W\d+$/i;

  /* normalised start of a title (the first language of "English; [Spanish]"), at most 60 characters; '' when too short to be telling */
  P.titleProbe = function (title) {
    const first = String(title == null ? '' : title).split(/;\s*\[|\s\[/)[0];
    let s = P.fold(first).replace(/[^a-z0-9]+/g, ' ').trim();
    if (s.length > 60) s = s.slice(0, 61).replace(/\s\S*$/, '');
    return s.length >= 20 ? s : '';
  };

  /* at most one inserted, deleted or changed letter */
  P.withinOneEdit = function (a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  };

  const textCache = new WeakMap();
  const refText = ref => { let s = textCache.get(ref); if (s === undefined) { s = ' ' + P.referenceText(ref) + ' '; textCache.set(ref, s); } return s; };

  /* records → { local: [count per record], citedBy: [[citing indices]], cites: [[cited indices]], refDoc: Map(ref → index),
                 stats: { references, matched, byDoi, byId, byBib, ambiguous, self, citingDocs, citedDocs, links } }
     Author-year candidates: the same surname, or one letter apart for surnames of six letters or more (typos).
     A candidate is accepted with the evidence below; a different DOI or volume always rules it out.
       · its title appears in the reference text (styles that write titles), or
       · same surname, compatible source and no contradicting first page, or
       · same surname, same volume and first page, or
       · surname one letter apart, compatible source and same volume, without contradicting first page.
     Several accepted candidates: title evidence first, then the same first page, then the exact surname. */
  P.localCitations = function (records, progress) {
    const byDoi = new Map(), byId = new Map(), bib = new Map(), near = new Map();
    records.forEach((r, i) => {
      if (r.doi && !byDoi.has(r.doi)) byDoi.set(r.doi, i);
      if (r.accession && CATALOGUE_ID.test(r.accession) && !byId.has(r.accession.toUpperCase())) byId.set(r.accession.toUpperCase(), i);
      const sur = P.surnameOf(r.authors[0]);
      if (!sur || r.year == null) return;
      const c = {
        i, sur, doi: r.doi, sources: [r.sourceTitle, r.sourceAbbrev, r.sourceName].map(P.sourceWords).filter(w => w.length),
        volume: numKey(r.volume), page: firstPage(r.pages), article: numKey(r.articleNumber), probe: P.titleProbe(r.title),
      };
      const key = sur + '|' + r.year;
      if (!bib.has(key)) bib.set(key, []);
      bib.get(key).push(c);
      if (sur.length >= 6) {
        const nk = r.year + '|' + sur.slice(0, 3);
        if (!near.has(nk)) near.set(nk, []);
        near.get(nk).push(c);
      }
    });

    const match = ref => {
      if (ref.doi && byDoi.has(ref.doi)) return [byDoi.get(ref.doi), 'doi'];
      const raw = String(ref.raw == null ? '' : ref.raw).trim();
      if (CATALOGUE_ID.test(raw)) return byId.has(raw.toUpperCase()) ? [byId.get(raw.toUpperCase()), 'id'] : null;
      if (ref.year == null) return null;
      const sur = P.refSurname(ref.firstAuthor);
      if (!sur) return null;
      const cands = (bib.get(sur + '|' + ref.year) || []).slice();
      if (sur.length >= 6) for (const c of near.get(ref.year + '|' + sur.slice(0, 3)) || []) if (c.sur !== sur && P.withinOneEdit(c.sur, sur)) cands.push(c);
      if (!cands.length) return null;
      const src = P.sourceWords(ref.source), vol = numKey(ref.volume), page = firstPage(ref.page);
      const ok = [];
      for (const c of cands) {
        if (ref.doi && c.doi && c.doi !== ref.doi) continue;
        if (vol && c.volume && vol !== c.volume) continue;
        const exact = c.sur === sur;
        const title = !!c.probe && refText(ref).includes(' ' + c.probe + ' ');
        const source = src.length > 0 && c.sources.some(w => P.sourceWordsMatch(src, w));
        const pageEq = !!page && (page === c.page || page === c.article);
        const pageDiff = !!page && !!(c.page || c.article) && !pageEq;
        const accept = title || (exact && ((source && !pageDiff) || (vol && vol === c.volume && pageEq))) || (!exact && source && vol && vol === c.volume && !pageDiff);
        if (accept) ok.push({ c, title, pageEq, exact });
      }
      let best = ok;
      for (const k of ['title', 'pageEq', 'exact']) { if (best.length > 1 && best.some(x => x[k])) best = best.filter(x => x[k]); }
      if (best.length === 1) return [best[0].c.i, 'bib'];
      return best.length > 1 ? [-1, 'ambiguous'] : null;
    };

    const n = records.length;
    const citedBy = records.map(() => []), cites = records.map(() => []);
    const refDoc = new Map();
    const stats = { references: 0, matched: 0, byDoi: 0, byId: 0, byBib: 0, ambiguous: 0, self: 0, citingDocs: 0, citedDocs: 0, links: 0 };
    for (let i = 0; i < n; i++) {
      if (progress && i % 500 === 0) progress(0.5 * i / n);
      const seen = new Set();
      for (const ref of records[i].references) {
        stats.references++;
        const m = match(ref);
        if (!m) continue;
        if (m[0] < 0) { stats.ambiguous++; continue; }
        if (m[0] === i) { stats.self++; continue; }
        refDoc.set(ref, m[0]);
        stats.matched++;
        if (m[1] === 'doi') stats.byDoi++; else if (m[1] === 'id') stats.byId++; else stats.byBib++;
        if (!seen.has(m[0])) { seen.add(m[0]); citedBy[m[0]].push(i); cites[i].push(m[0]); }
      }
      if (seen.size) stats.citingDocs++;
    }
    const local = citedBy.map(c => c.length);
    stats.citedDocs = local.filter(v => v > 0).length;
    stats.links = local.reduce((s, v) => s + v, 0);
    return { local, citedBy, cites, refDoc, stats };
  };

  /* local against global citations per document, most locally cited first */
  P.localCitationTable = function (records, lc) {
    const rows = records.map((r, index) => {
      const global = r.timesCited != null && isFinite(r.timesCited) ? r.timesCited : null;
      const local = lc.local[index];
      return {
        index, label: P.documentLabel(r), year: r.year, local, global,
        ratio: global > 0 ? local / global : null,
        exceeds: global != null && local > global,
        localReferences: lc.cites[index].length,
      };
    });
    rows.sort((a, b) => b.local - a.local || (b.global || 0) - (a.global || 0) || a.index - b.index);
    rows.forEach((row, i) => { row.rank = i + 1; });
    return rows;
  };

  /* ---------------- cited references ---------------- */

  const NON_ASCII = /[^\x00-\x7F]/;
  P.referenceText = function (ref) {
    const s = String(ref.raw == null ? '' : ref.raw);
    return (NON_ASCII.test(s) ? P.fold(s) : s.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
  };

  /* the keys that identify a cited work; kept per reference object (shared between cleaning runs) */
  const keyCache = new WeakMap();
  P.referenceKeys = function (ref) {
    let k = keyCache.get(ref);
    if (k) return k;
    k = [];
    if (ref.doi) k.push('d:' + ref.doi);
    const raw = String(ref.raw == null ? '' : ref.raw).trim();
    if (CATALOGUE_ID.test(raw)) k.push('w:' + raw.toUpperCase());
    else {
      const sur = P.refSurname(ref.firstAuthor), vol = numKey(ref.volume), page = firstPage(ref.page);
      if (sur && ref.year != null && vol && page) k.push('b:' + sur + '|' + ref.year + '|' + vol + '|' + page);
      const text = P.referenceText(ref);
      if (text) k.push('t:' + text);
    }
    keyCache.set(ref, k);
    return k;
  };

  /* cluster id of every reference occurrence, in reading order (-1 = no key); references matched to the same
     document of the collection (refDoc, from P.localCitations) cite the same work */
  function clusterIds(records, refDoc) {
    const ids = new Map(), parent = [];
    const node = k => { let x = ids.get(k); if (x === undefined) { x = parent.length; ids.set(k, x); parent.push(x); } return x; };
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const occ = [];
    for (const r of records) {
      for (const ref of r.references) {
        const keys = refDoc && refDoc.has(ref) ? P.referenceKeys(ref).concat('l:' + refDoc.get(ref)) : P.referenceKeys(ref);
        let first = -1;
        for (const k of keys) {
          const x = node(k);
          if (first < 0) first = x;
          else { const a = find(first), b = find(x); if (a !== b) parent[b] = a; }
        }
        occ.push(first);
      }
    }
    return occ.map(x => (x < 0 ? -1 : find(x)));
  }

  P.distinctReferences = function (records, refDoc) {
    const set = new Set();
    for (const c of clusterIds(records, refDoc || P.localCitations(records).refDoc)) if (c >= 0) set.add(c);
    return set.size;
  };

  /* records → { rows: [{ id, label, firstAuthor, year, source, doi, citations (citing documents), occurrences, local }],
                 total (occurrences), withYear, docs (documents with references),
                 byDoc: [[row indices of the works each document cites, each once, ascending]] }
     opts.refDoc: Map(reference → document index) from P.localCitations */
  P.referenceClusters = function (records, opts) {
    opts = opts || {};
    const occ = clusterIds(records, opts.refDoc);
    const byId = new Map();
    const docIds = [];
    let o = 0, total = 0, withYear = 0, docs = 0;
    records.forEach((r, i) => {
      if (r.references.length) docs++;
      const mine = new Set();
      docIds.push(mine);
      for (const ref of r.references) {
        const id = occ[o++];
        total++;
        if (ref.year != null) withYear++;
        if (id < 0) continue;
        mine.add(id);
        let c = byId.get(id);
        if (!c) { c = { id, citations: 0, occurrences: 0, lastDoc: -1, raws: new Map(), years: new Map(), doi: '', local: new Map() }; byId.set(id, c); }
        c.occurrences++;
        if (c.lastDoc !== i) { c.lastDoc = i; c.citations++; }
        const raw = ref.raw == null ? '' : String(ref.raw);
        const spelling = c.raws.get(raw);
        if (spelling) spelling.n++; else c.raws.set(raw, { n: 1, ref });
        if (ref.year != null) c.years.set(ref.year, (c.years.get(ref.year) || 0) + 1);
        if (!c.doi && ref.doi) c.doi = ref.doi;
        if (opts.refDoc && opts.refDoc.has(ref)) { const d = opts.refDoc.get(ref); c.local.set(d, (c.local.get(d) || 0) + 1); }
      }
    });
    /* the most frequent value; ties go to the longest text */
    const top = (m, count) => { let best = null, bn = -1; for (const [k, v] of m) { const n = count ? count(v) : v; if (n > bn || (n === bn && String(k).length > String(best).length)) { best = k; bn = n; } } return best; };
    const rows = [...byId.values()].map(c => {
      const raw = top(c.raws, v => v.n);
      const ref = c.raws.get(raw).ref;
      return {
        id: c.id, label: P.clean(raw), firstAuthor: P.clean(ref.firstAuthor), year: c.years.size ? top(c.years) : null, source: P.clean(ref.source),
        volume: P.clean(ref.volume), page: P.clean(ref.page),
        doi: c.doi, citations: c.citations, occurrences: c.occurrences, local: c.local.size ? top(c.local) : -1,
      };
    });
    rows.sort((a, b) => b.citations - a.citations || b.occurrences - a.occurrences || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    const rowOf = new Map();
    rows.forEach((row, i) => { row.rank = i + 1; rowOf.set(row.id, i); });
    const byDoc = docIds.map(set => [...set].map(id => rowOf.get(id)).sort((a, b) => a - b));
    return { rows, total, withYear, docs, byDoc };
  };

  /* local citations and reference clusters together: what the Documents and Overview screens share.
     opts.progress(fraction); opts.plain leaves out the Map of matched references (a worker sends plain data back) */
  P.referenceAnalysis = function (records, opts) {
    opts = opts || {};
    const progress = opts.progress || null;
    const lc = P.localCitations(records, progress);
    if (progress) progress(0.55);
    const clusters = P.referenceClusters(records, { refDoc: lc.refDoc });
    if (progress) progress(1);
    if (opts.plain) delete lc.refDoc;
    return { lc, clusters };
  };

  /* "Smith J, 2001, Nature" from a cluster (or the start of its text) */
  P.referenceShort = function (row, max, detail) {
    const parts = [row.firstAuthor, row.year != null ? String(row.year) : '', row.source].filter(Boolean);
    let s = parts.length >= 2 ? parts.join(', ') : row.label;
    /* detail: volume and first page ("7:391"), or the DOI, to tell apart works with the same author, year and source */
    if (detail && parts.length >= 2) {
      const where = [row.volume, row.page].filter(Boolean).join(':') || row.doi || '';
      if (where) s += ', ' + where;
    }
    max = max || 90;
    return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
  };

  /* short names for a list of works shown together: two different works with the same author, year and source
     (two papers of one author in the same journal and year) take their volume and first page, so they do not look alike */
  P.referenceShortList = function (rows, max) {
    const plain = rows.map(r => P.referenceShort(r, Infinity));
    const count = new Map();
    plain.forEach(s => count.set(s, (count.get(s) || 0) + 1));
    return rows.map((r, i) => P.referenceShort(r, max, count.get(plain[i]) > 1));
  };

  /* ---------------- reference publication year spectroscopy ---------------- */

  P.median = function (values) {
    const s = values.slice().sort((a, b) => a - b);
    const n = s.length;
    if (!n) return null;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  };

  /* records → { rows: [{ year, n, median, deviation, peak, top: [cluster rows] }], minYear, maxYear, withYear, total, peaks }
     opts: { from, to, clusters (P.referenceClusters result), top: references per year } */
  P.rpys = function (records, opts) {
    opts = opts || {};
    const counts = new Map();
    let total = 0, withYear = 0, minYear = Infinity, maxYear = -Infinity;
    for (const r of records) {
      for (const ref of r.references) {
        total++;
        const y = ref.year;
        if (y == null) continue;
        withYear++;
        counts.set(y, (counts.get(y) || 0) + 1);
        if (y < minYear) minYear = y;
        if (y > maxYear) maxYear = y;
      }
    }
    if (!withYear) return { rows: [], minYear: null, maxYear: null, withYear, total, peaks: [] };
    const from = Math.max(minYear, opts.from != null ? +opts.from : minYear);
    const to = Math.max(from, Math.min(maxYear, opts.to != null ? +opts.to : maxYear));
    const nOf = y => counts.get(y) || 0;
    const dev = y => nOf(y) - P.median([nOf(y - 2), nOf(y - 1), nOf(y), nOf(y + 1), nOf(y + 2)]);
    const byYear = new Map();
    if (opts.clusters) {
      for (const c of opts.clusters.rows) {
        if (c.year == null || c.year < from || c.year > to) continue;
        if (!byYear.has(c.year)) byYear.set(c.year, []);
        byYear.get(c.year).push(c);
      }
    }
    const k = opts.top != null ? opts.top : 3;
    const rows = [];
    for (let y = from; y <= to; y++) {
      const d = dev(y);
      const list = (byYear.get(y) || []).sort((a, b) => b.occurrences - a.occurrences || b.citations - a.citations || a.rank - b.rank);
      rows.push({ year: y, n: nOf(y), median: nOf(y) - d, deviation: d, peak: d > 0 && d > dev(y - 1) && d >= dev(y + 1), top: list.slice(0, k) });
    }
    const peaks = rows.filter(r => r.peak).sort((a, b) => b.deviation - a.deviation || a.year - b.year);
    return { rows, minYear, maxYear, from, to, withYear, total, peaks };
  };

  /* ---------------- words ---------------- */

  /* documents per term, years spanned and the counts per year of some terms */
  P.termGrowth = function (records, lists, keys) {
    let y0 = Infinity, y1 = -Infinity;
    records.forEach(r => { if (r.year != null) { if (r.year < y0) y0 = r.year; if (r.year > y1) y1 = r.year; } });
    if (y0 > y1) return { years: [], series: keys.map(key => ({ key, annual: [], cumulative: [] })) };
    const years = [];
    for (let y = y0; y <= y1; y++) years.push(y);
    const idx = new Map(keys.map((k, i) => [k, i]));
    const annual = keys.map(() => new Array(years.length).fill(0));
    records.forEach((r, i) => {
      if (r.year == null) return;
      for (const term of lists[i]) { const k = idx.get(term); if (k !== undefined) annual[k][r.year - y0]++; }
    });
    return {
      years,
      series: keys.map((key, k) => {
        let s = 0;
        return { key, annual: annual[k], cumulative: annual[k].map(v => (s += v)) };
      }),
    };
  };

  /* sample quantile of type 7 (sorted values): x[⌊h⌋] + (h − ⌊h⌋)(x[⌊h⌋+1] − x[⌊h⌋]), h = (n − 1)p */
  P.quantile7 = function (sorted, p) {
    const n = sorted.length;
    if (!n) return null;
    const h = (n - 1) * p, lo = Math.floor(h), hi = Math.min(n - 1, lo + 1);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  };

  /* records, term lists → { terms: [{ key, freq, first, last, q1, median, q3 }] (freq ≥ minFreq; ordered by median year,
     then frequency), selected: the perYear most frequent terms of each (rounded) median year } */
  P.trendTopics = function (records, lists, opts) {
    opts = opts || {};
    const minFreq = Math.max(1, +opts.minFreq || 1), perYear = Math.max(1, +opts.perYear || 3);
    const years = new Map();
    records.forEach((r, i) => {
      if (r.year == null) return;
      for (const term of lists[i]) { if (!years.has(term)) years.set(term, []); years.get(term).push(r.year); }
    });
    const terms = [];
    for (const [key, ys] of years) {
      if (ys.length < minFreq) continue;
      ys.sort((a, b) => a - b);
      terms.push({ key, freq: ys.length, first: ys[0], last: ys[ys.length - 1], q1: P.quantile7(ys, 0.25), median: P.quantile7(ys, 0.5), q3: P.quantile7(ys, 0.75) });
    }
    terms.sort((a, b) => a.median - b.median || b.freq - a.freq || (a.key < b.key ? -1 : 1));
    const byYear = new Map();
    for (const t of terms) {
      const y = Math.round(t.median);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(t);
    }
    const selected = [];
    [...byYear.keys()].sort((a, b) => a - b).forEach(y => {
      byYear.get(y).slice().sort((a, b) => b.freq - a.freq || a.median - b.median || (a.key < b.key ? -1 : 1)).slice(0, perYear)
        .sort((a, b) => a.median - b.median || b.freq - a.freq || (a.key < b.key ? -1 : 1)).forEach(t => selected.push(t));
    });
    return { terms, selected };
  };

  /* squarified treemap: values (largest first) laid out in a rectangle → [{ x, y, w, h }] in the same order */
  P.squarify = function (values, x, y, w, h) {
    const sum = values.reduce((s, v) => s + Math.max(0, v), 0);
    const out = new Array(values.length);
    if (!(sum > 0) || !(w > 0) || !(h > 0)) { values.forEach((v, i) => { out[i] = { x, y, w: 0, h: 0 }; }); return out; }
    const areas = values.map(v => Math.max(0, v) * w * h / sum);
    const worst = (s, mx, mn, len) => Math.max(len * len * mx / (s * s), (s * s) / (len * len * mn));
    let row = [], rs = 0, rmx = 0, rmn = Infinity, i = 0;
    const place = () => {
      if (!row.length) return;
      if (w >= h) {
        const cw = h > 0 ? rs / h : 0;
        let yy = y;
        row.forEach(k => { const hh = cw > 0 ? areas[k] / cw : 0; out[k] = { x, y: yy, w: cw, h: hh }; yy += hh; });
        x += cw; w -= cw;
      } else {
        const rh = w > 0 ? rs / w : 0;
        let xx = x;
        row.forEach(k => { const ww = rh > 0 ? areas[k] / rh : 0; out[k] = { x: xx, y, w: ww, h: rh }; xx += ww; });
        y += rh; h -= rh;
      }
      row = []; rs = 0; rmx = 0; rmn = Infinity;
    };
    while (i < areas.length) {
      const a = areas[i];
      if (a <= 0) { out[i] = { x, y, w: 0, h: 0 }; i++; continue; }
      const len = Math.min(w, h);
      if (!row.length || worst(rs + a, Math.max(rmx, a), Math.min(rmn, a), len) <= worst(rs, rmx, rmn, len)) {
        row.push(i); rs += a; rmx = Math.max(rmx, a); rmn = Math.min(rmn, a); i++;
      } else place();
    }
    place();
    return out;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpDocuments);
