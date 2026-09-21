/* SciMetricsPro — duplicate detection and merging.
   Pure functions (no window, no DOM): they run in the page and in a worker.

   Two records are the same document when
   1. their normalised DOIs are equal, or
   2. neither DOI contradicts the other and the normalised titles are equal or
      similar (1 − Levenshtein / longer length ≥ threshold, 0.95 by default), the
      publication years agree (or differ by one year between different files:
      databases give online-first or print year), the numbers in the titles are
      the same ("Part I" ≠ "Part II") and the first authors' surnames are compatible.
   Similar titles are found with the sorted-neighbourhood method (titles sorted
   forwards and backwards, each compared with its next neighbours) and a banded
   edit distance, so large sets are checked in near-linear time.
   Levenshtein VI (1966) Binary codes capable of correcting deletions, insertions and reversals. Soviet Physics Doklady 10(8):707–710.
   Hernández MA, Stolfo SJ (1995) The merge/purge problem for large databases. ACM SIGMOD Record 24(2):127–138. */
'use strict';

function smpDedup(P) {
  P.normTitle = function (s) {
    return P.fold(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/[^a-z0-9]+/g, ' ').trim();
  };

  P.normDoi = function (s) { return P.doiOf(s); };

  /* surname letters of the first author ("Cadena-Iñiguez" → "cadenainiguez") */
  P.firstSurname = function (r) {
    const a = r.authors && r.authors[0];
    return a ? P.fold(a.last || a.short || '').replace(/[^a-z]/g, '') : '';
  };

  /* edit distance if it is ≤ max, otherwise max + 1 (only a diagonal band is filled) */
  P.levenshteinWithin = function (a, b, max) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    if (la === 0 || lb === 0) return Math.max(la, lb) <= max ? Math.max(la, lb) : max + 1;
    const BIG = max + 1;
    let prev = new Array(lb + 1), cur = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j <= max ? j : BIG;
    for (let i = 1; i <= la; i++) {
      const from = Math.max(1, i - max), to = Math.min(lb, i + max);
      cur[0] = i <= max ? i : BIG;
      if (from > 1) cur[from - 1] = BIG;
      let rowMin = cur[0];
      const ca = a.charCodeAt(i - 1);
      for (let j = from; j <= to; j++) {
        const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        let v = prev[j - 1] + cost;
        const up = (j <= i - 1 + max ? prev[j] : BIG) + 1;
        const left = cur[j - 1] + 1;
        if (up < v) v = up;
        if (left < v) v = left;
        if (v > BIG) v = BIG;
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (to < lb) cur[to + 1] = BIG;
      if (rowMin > max) return max + 1;
      const tmp = prev; prev = cur; cur = tmp;
    }
    return prev[lb] <= max ? prev[lb] : max + 1;
  };

  /* 1 − distance / longer length, or 0 when it is below the threshold */
  P.titleSimilarity = function (a, b, threshold) {
    const L = Math.max(a.length, b.length);
    if (!L) return 1;
    const max = Math.floor((1 - (threshold == null ? 0 : threshold)) * L);
    const d = P.levenshteinWithin(a, b, max);
    return d > max ? 0 : 1 - d / L;
  };

  function compatibleSurnames(a, b) {
    if (!a || !b) return true;
    return a === b || a.includes(b) || b.includes(a);
  }

  /* "Part I" and "Part II", "Study 1" and "Study 2": similar titles whose numbers differ are different documents */
  P.numbersDiffer = function (a, b) {
    const nums = s => (s.match(/\b(\d+|[ivx]{1,4})\b/g) || []).sort().join(' ');
    return nums(a) !== nums(b);
  };

  /* items: [{ id, doi, title (raw), year, surname, file }] (light, so a worker can receive many)
     opts: { threshold, window, yearTolerance (1) }
     → groups: [{ key, ids: [...], reason: 'doi'|'title'|'mixed', similarity, doiConflict }] */
  P.findDuplicateGroups = function (items, opts, progress) {
    opts = opts || {};
    const threshold = opts.threshold != null ? opts.threshold : 0.95;
    const window = opts.window || 4;
    const n = items.length;
    const parent = Array.from({ length: n }, (x, i) => i);
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const edges = [];
    const link = (i, j, reason, sim) => {
      edges.push([i, j, reason, sim]);
      const a = find(i), b = find(j);
      if (a !== b) parent[b] = a;
    };
    const doi = items.map(x => P.normDoi(x.doi));
    const t = items.map(x => P.normTitle(x.title));
    const sur = items.map(x => x.surname || '');
    const doiConflict = (i, j) => doi[i] && doi[j] && doi[i] !== doi[j];
    /* the same year; one year apart only between different files (print and online-first years differ across databases) */
    const yearTolerance = opts.yearTolerance != null ? opts.yearTolerance : 1;
    const yearsAgree = (i, j) => {
      const a = items[i].year, b = items[j].year;
      if (a == null || b == null || a === b) return true;
      return Math.abs(a - b) <= yearTolerance && items[i].file != null && items[i].file !== items[j].file;
    };

    /* 1. same DOI */
    const byDoi = new Map();
    for (let i = 0; i < n; i++) {
      if (!doi[i]) continue;
      if (byDoi.has(doi[i])) link(byDoi.get(doi[i]), i, 'doi', 1);
      else byDoi.set(doi[i], i);
    }
    if (progress) progress(0.2);

    /* 2. same normalised title and year */
    const byTitle = new Map();
    for (let i = 0; i < n; i++) {
      if (t[i].length < 10) continue;
      const k = t[i] + '|' + (items[i].year == null ? '' : items[i].year);
      const list = byTitle.get(k);
      if (!list) { byTitle.set(k, [i]); continue; }
      for (const j of list) {
        if (!doiConflict(i, j) && compatibleSurnames(sur[i], sur[j]) && find(i) !== find(j)) link(j, i, 'title', 1);
      }
      list.push(i);
    }
    if (progress) progress(0.4);

    /* 3. similar titles: sorted neighbourhood, forwards and on the reversed strings */
    const candidates = [];
    for (let i = 0; i < n; i++) if (t[i].length >= 10) candidates.push(i);
    const passes = [
      candidates.slice().sort((a, b) => (t[a] < t[b] ? -1 : t[a] > t[b] ? 1 : a - b)),
    ];
    const rev = t.map(s => s.split('').reverse().join(''));
    passes.push(candidates.slice().sort((a, b) => (rev[a] < rev[b] ? -1 : rev[a] > rev[b] ? 1 : a - b)));
    let done = 0;
    for (const order of passes) {
      for (let p = 0; p < order.length; p++) {
        const i = order[p];
        for (let q = p + 1; q < Math.min(order.length, p + 1 + window); q++) {
          const j = order[q];
          if (find(i) === find(j) || doiConflict(i, j) || !yearsAgree(i, j) || !compatibleSurnames(sur[i], sur[j])) continue;
          const sim = P.titleSimilarity(t[i], t[j], threshold);
          if (sim >= threshold && !P.numbersDiffer(t[i], t[j])) link(i, j, 'title', sim);
        }
        if (progress && ++done % 2000 === 0) progress(0.4 + 0.6 * done / (2 * order.length));
      }
    }

    /* groups from the union-find forest */
    const groups = new Map();
    for (const [i, j, reason, sim] of edges) {
      const root = find(i);
      let g = groups.get(root);
      if (!g) { g = { members: new Set(), reasons: new Set(), similarity: 1 }; groups.set(root, g); }
      g.members.add(i); g.members.add(j); g.reasons.add(reason);
      if (sim < g.similarity) g.similarity = sim;
    }
    const out = [];
    for (const g of groups.values()) {
      const idx = [...g.members].sort((a, b) => a - b);
      const ids = idx.map(k => items[k].id);
      /* a record without DOI can join two records whose DOIs differ: worth a look */
      const distinctDois = new Set(idx.map(k => doi[k]).filter(Boolean));
      out.push({ key: ids.join('+'), ids, reason: g.reasons.size > 1 ? 'mixed' : [...g.reasons][0], similarity: g.similarity, doiConflict: distinctDois.size > 1 });
    }
    out.sort((a, b) => (a.ids[0] < b.ids[0] ? -1 : 1));
    if (progress) progress(1);
    return out;
  };

  /* ---------- merging ---------- */
  const SCORE_FIELDS = ['title', 'abstract', 'doi', 'sourceTitle', 'volume', 'pages', 'language', 'fundingText', 'publisher'];
  P.recordScore = function (r) {
    let s = 0;
    for (const f of SCORE_FIELDS) if (r[f]) s++;
    if (r.authors.length) s++;
    if (r.authors.some(a => a.affiliations.length)) s++;
    if (r.authorKeywords.length) s++;
    if (r.indexKeywords.length) s++;
    if (r.references.length) s++;
    if (r.timesCited != null) s++;
    if (r.subjectAreas.length) s++;
    return s;
  };

  /* records of one group → one record with the most complete fields; mergeLog says where each came from */
  P.mergeGroup = function (records) {
    const scored = records.map((r, i) => ({ r, i, s: P.recordScore(r) })).sort((a, b) => b.s - a.s || a.i - b.i);
    const base = scored[0].r;
    const m = Object.assign({}, base);
    const log = {};
    const pick = (field, better) => {
      let best = base;
      for (const { r } of scored) if (better(r[field], best[field])) best = r;
      m[field] = best[field];
      if (best !== base) log[field] = best.id;
    };
    const longerText = (a, b) => String(a || '').length > String(b || '').length;
    const filledText = (a, b) => !b && !!a;
    const longerList = (a, b) => (a || []).length > (b || []).length;
    ['abstract', 'fundingText', 'title'].forEach(f => pick(f, f === 'title' ? filledText : longerText));
    ['sourceTitle', 'sourceAbbrev', 'volume', 'issue', 'pages', 'articleNumber', 'doi', 'pmid', 'publisher', 'correspondingAuthor', 'docTypeRaw'].forEach(f => pick(f, filledText));
    pick('correspondingCountry', (a, b) => !b && !!a);
    pick('year', (a, b) => b == null && a != null);
    pick('language', (a, b) => !b && !!a);
    pick('languages', longerList);
    ['authorKeywords', 'indexKeywords', 'references', 'subjectAreas', 'affiliations'].forEach(f => pick(f, longerList));
    const affiliated = list => list.filter(a => a.affiliations.length).length;
    let bestAuthors = base;
    for (const { r } of scored) {
      if (affiliated(r.authors) > affiliated(bestAuthors.authors) || (affiliated(r.authors) === affiliated(bestAuthors.authors) && r.authors.length > bestAuthors.authors.length)) bestAuthors = r;
    }
    m.authors = bestAuthors.authors;
    if (bestAuthors !== base) log.authors = bestAuthors.id;
    let cited = null;
    for (const { r } of scored) if (r.timesCited != null && (cited == null || r.timesCited > cited.timesCited)) cited = r;
    m.timesCited = cited ? cited.timesCited : null;
    if (cited && cited !== base) log.timesCited = cited.id;
    m.openAccess = records.some(r => r.openAccess === true) ? true : records.some(r => r.openAccess === false) ? false : null;
    m.issn = P.uniq(records.flatMap(r => r.issn));
    m.isbn = P.uniq(records.flatMap(r => r.isbn));
    m.countries = [...new Set(records.flatMap(r => r.countries))];
    if (m.docType === 'other') { const typed = records.find(r => r.docType !== 'other'); if (typed) { m.docType = typed.docType; log.docType = typed.id; } }
    m.mergedFrom = records.map(r => ({ id: r.id, fileId: r.fileId, source: r.source, format: r.format, accession: r.accession, timesCited: r.timesCited }));
    m.sources = [...new Set(records.map(r => r.source))];
    m.baseId = base.id;
    m.mergeLog = log;
    return m;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpDedup);
