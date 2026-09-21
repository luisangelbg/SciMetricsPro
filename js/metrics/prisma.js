/* SciMetricsPro — systematic review: screening decisions and the numbers of the PRISMA 2020 flow diagram for new
   reviews that searched databases and registers. Page MJ, McKenzie JE, Bossuyt PM, et al. (2021) The PRISMA 2020
   statement: an updated guideline for reporting systematic reviews. BMJ 372:n71.
   Pure functions (no window, no DOM).

   · Identification: records per database (imported files) + registers (typed by the user).
   · Removed before screening: duplicates (merged in Cleaning), marked as ineligible by automation tools (typed) and removed
     for other reasons (documents left out by the filters of Cleaning + typed).
   · Screening: records screened = identified − removed; records excluded = documents excluded without a reason (title and
     abstract); reports sought for retrieval = screened − excluded; reports not retrieved = excluded with the reason "not
     retrieved"; reports assessed for eligibility = sought − not retrieved; reports excluded = excluded with any other reason,
     one line per reason.
   · Included: studies included = documents marked "include"; documents doubtful or not yet screened are pending, so that
     assessed − reports excluded = included + pending. */
'use strict';

function smpPrisma(P) {
  P.PRISMA_STATUSES = ['include', 'exclude', 'maybe'];
  P.PRISMA_NOT_RETRIEVED = 'notRetrieved';

  /* key of a document for its decision, stable between sessions and imports: the DOI, else the title and the year */
  const keyCache = new WeakMap();
  P.prismaKey = function (r) {
    let k = keyCache.get(r);
    if (k) return k;
    const doi = r.doi ? String(r.doi).toLowerCase().trim() : '';
    k = doi ? 'doi:' + doi : 't:' + P.fold(r.title).replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 150) + '|' + (r.year == null ? '' : r.year);
    keyCache.set(r, k);
    return k;
  };

  /* input: { sources: [{ label, n }], registers, duplicates, automation, filtered (removed by filters), other (typed),
             keys: [prisma keys of the documents to screen], decisions: { key: { status, reason } }, reasons: [{ id, label }] }
     → every number of the diagram, the reasons with their counts and whether the diagram balances */
  P.prismaFlow = function (input) {
    const num = v => Math.max(0, Math.round(+v || 0));
    const databases = (input.sources || []).map(s => ({ label: s.label, n: num(s.n) }));
    const registers = num(input.registers);
    const identified = databases.reduce((acc, s) => acc + s.n, 0) + registers;
    const duplicates = num(input.duplicates), automation = num(input.automation), filtered = num(input.filtered), otherTyped = num(input.other);
    const other = filtered + otherTyped;
    const removed = duplicates + automation + other;
    const screened = Math.max(0, identified - removed);
    const keys = input.keys || [];
    const decisions = input.decisions || {};
    let included = 0, maybe = 0, excluded = 0, notRetrieved = 0, undecided = 0;
    const byReason = new Map();
    for (const key of new Set(keys)) {
      const d = decisions[key];
      if (!d || !d.status) { undecided++; continue; }
      if (d.status === 'include') included++;
      else if (d.status === 'maybe') maybe++;
      else if (d.status === 'exclude') {
        if (!d.reason) excluded++;
        else if (d.reason === P.PRISMA_NOT_RETRIEVED) notRetrieved++;
        else byReason.set(d.reason, (byReason.get(d.reason) || 0) + 1);
      } else undecided++;
    }
    const known = new Map((input.reasons || []).map(r => [r.id, r.label]));
    const reportsExcluded = [];
    for (const r of input.reasons || []) if (byReason.get(r.id)) reportsExcluded.push({ id: r.id, label: r.label, n: byReason.get(r.id) });
    for (const [id, n] of byReason) if (!known.has(id)) reportsExcluded.push({ id, label: id, n });
    const reportsExcludedTotal = reportsExcluded.reduce((acc, r) => acc + r.n, 0);
    const sought = Math.max(0, screened - excluded);
    const assessed = Math.max(0, sought - notRetrieved);
    const pending = maybe + undecided;
    return {
      databases, registers, identified, duplicates, automation, filtered, otherTyped, other, removed, screened,
      excluded, sought, notRetrieved, assessed, reportsExcluded, reportsExcludedTotal, included, maybe, undecided, pending,
      documents: new Set(keys).size, decided: included + maybe + excluded + notRetrieved + reportsExcludedTotal,
      balanced: assessed - reportsExcludedTotal === included + pending && screened === new Set(keys).size,
    };
  };

  /* terms to highlight: "salt stress, passiflora; yield" → ['salt stress', 'passiflora', 'yield'] (longest first) */
  P.highlightTerms = function (text) {
    return [...new Set(String(text == null ? '' : text).split(/[,;\n]+/).map(s => P.clean(s)).filter(s => s.length >= 2))]
      .sort((a, b) => b.length - a.length);
  };

  /* pieces of a text with the terms marked, without case or accents: [{ text, mark }] */
  P.highlightPieces = function (text, terms) {
    const s = String(text == null ? '' : text);
    if (!s || !terms || !terms.length) return s ? [{ text: s, mark: false }] : [];
    /* fold letter by letter so the positions of the folded text are those of the original */
    const folded = [...s].map(ch => P.fold(ch).charAt(0) || ch).join('');
    const marks = new Uint8Array(s.length);
    for (const term of terms) {
      const ft = [...term].map(ch => P.fold(ch).charAt(0) || ch).join('');
      if (!ft) continue;
      let i = folded.indexOf(ft);
      while (i >= 0) {
        const before = i === 0 || !/[\p{L}\p{N}]/u.test(folded[i - 1]);
        const after = i + ft.length >= folded.length || !/[\p{L}\p{N}]/u.test(folded[i + ft.length]);
        if (before && after) for (let j = i; j < i + ft.length; j++) marks[j] = 1;
        i = folded.indexOf(ft, i + 1);
      }
    }
    const out = [];
    let start = 0;
    for (let i = 1; i <= s.length; i++) {
      if (i === s.length || marks[i] !== marks[start]) { out.push({ text: s.slice(start, i), mark: !!marks[start] }); start = i; }
    }
    return out;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpPrisma);
