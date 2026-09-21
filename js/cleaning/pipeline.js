/* SciMetricsPro — the clean and filtered set that every analysis reads.

   state.records (imported) ─ duplicates merged ─ authors, institutions and countries
   normalised ─▶ state.clean ─ global filters ─▶ state.screening ─ (only the documents included
   in the systematic review, when chosen) ─▶ state.filtered

   Pipeline.records() is what the analysis modules use. Any change (new files, an
   undone merge, a synonym, a filter) runs the pipeline again and emits
   'cleanchange'. Duplicate detection runs again only when the imported records
   or the similarity threshold change (in a worker for large sets). */
'use strict';

const Pipeline = {
  settings: null,
  dup: { signature: '', threshold: null, groups: [] },
  stats: null,
  pending: Promise.resolve(),
  INLINE_LIMIT: 3000,
  _dict: null,

  lib() { return Parsers.lib(); },

  defaults() {
    const P = Pipeline.lib();
    return {
      threshold: 0.95,
      excluded: [],                                   // duplicate groups kept apart (group keys)
      authorMerges: {},                               // author key → key it was joined to
      authorKept: [],                                 // variant groups marked "keep separate"
      countryAliases: Prefs.get('countryAliases', []),        // [{ text, code }]
      institutionAliases: Prefs.get('institutionAliases', []), // [{ from, to }]
      synonyms: Prefs.get('synonyms', []),                    // [{ from, to }]
      stopwords: Prefs.get('stopwords', null) || { es: P.STOPWORDS.es.slice(), en: P.STOPWORDS.en.slice() },
      termField: Prefs.get('termField', 'authorKeywords'),
      filters: P.emptyFilters(),
      referenceYear: null,                            // null = the current year
      prisma: Pipeline.loadPrisma(),                  // screening decisions, reasons and typed numbers (remembered)
      prismaOnlyIncluded: false,                      // analyse only the included documents (this session)
    };
  },

  /* ---------- systematic review (PRISMA) ---------- */
  PRISMA_REASONS: ['population', 'design', 'intervention', 'outcomes', 'language', 'duplicate'],
  loadPrisma() {
    const saved = Prefs.get('prisma', null) || {};
    return {
      decisions: saved.decisions || {},
      reasons: Array.isArray(saved.reasons) ? saved.reasons : Pipeline.PRISMA_REASONS.map(id => ({ id, label: null })),
      manual: Object.assign({ registers: 0, automation: 0, other: 0 }, saved.manual || {}),
      sourceLabels: saved.sourceLabels || {},
      terms: saved.terms || '',
    };
  },
  prisma() { return Pipeline.init().prisma; },
  savePrisma() { const p = Pipeline.prisma(); Prefs.set('prisma', { decisions: p.decisions, reasons: p.reasons, manual: p.manual, sourceLabels: p.sourceLabels, terms: p.terms }); },
  screening() { return state.screening || []; },
  decisionOf(r) { return Pipeline.prisma().decisions[Pipeline.lib().prismaKey(r)] || null; },
  /* status: 'include' | 'exclude' | 'maybe' | null (undo); reason: '' (title and abstract), 'notRetrieved' or a reason id */
  decide(r, status, reason) {
    const p = Pipeline.prisma(), key = Pipeline.lib().prismaKey(r);
    if (!status) delete p.decisions[key];
    else p.decisions[key] = { status, reason: status === 'exclude' ? (reason || '') : '', time: new Date().toISOString() };
    Pipeline.savePrisma();
    if (Pipeline.init().prismaOnlyIncluded) Pipeline.refilter(); else emit('prismachange', {});
  },
  setOnlyIncluded(on) {
    Pipeline.init().prismaOnlyIncluded = !!on;
    Pipeline.refilter();
  },
  onlyIncluded() { return !!(Pipeline.settings && Pipeline.settings.prismaOnlyIncluded); },
  applyPrisma(records) {
    if (!Pipeline.init().prismaOnlyIncluded) return records;
    const P = Pipeline.lib(), d = Pipeline.prisma().decisions;
    return records.filter(r => { const x = d[P.prismaKey(r)]; return !!x && x.status === 'include'; });
  },
  /* the included documents changed: a new filtered set without running the whole pipeline again */
  refilter() {
    if (!state.screening) { emit('prismachange', {}); return; }
    state.filtered = Pipeline.applyPrisma(state.screening);
    if (Pipeline.stats) Pipeline.stats.shown = state.filtered.length;
    emit('cleanchange', Pipeline.stats);
    emit('prismachange', {});
  },

  /* year used for document ages, citable years and indices that depend on time */
  referenceYear() { return Pipeline.init().referenceYear || new Date().getFullYear(); },
  setReferenceYear(year) {
    const y = parseInt(year, 10);
    Pipeline.init().referenceYear = y >= 1900 && y <= 2200 ? y : null;
    if (state.clean) emit('cleanchange', Pipeline.stats);
  },

  init() { if (!Pipeline.settings) { Pipeline.settings = Pipeline.defaults(); Pipeline._dict = null; Pipeline.termFieldNote = null; } return Pipeline.settings; },

  /* When the data change and no record brings the chosen term field (for example, catalogue records without
     author keywords), the first field the records do bring is used for this session and the user is told.
     The remembered choice is not changed: it comes back with data that bring it. */
  termFieldNote: null,
  checkTermField(raw) {
    const s = Pipeline.init();
    const field = Pipeline.lib().termFieldFor(raw, s.termField);
    if (field === s.termField) return;
    Pipeline.termFieldNote = { from: s.termField, to: field };
    s.termField = field;
    toast(Pipeline.termFieldNoteText());
  },
  termFieldNoteText() {
    const n = Pipeline.termFieldNote;
    return n ? t('cleaning.summary.termFieldAuto', { from: t('cleaning.termFields.' + n.from).toLowerCase(), to: t('cleaning.termFields.' + n.to) }) : '';
  },

  /* change settings; persistent ones (dictionaries, term field) are remembered on this computer */
  update(patch) {
    const s = Pipeline.init();
    if ('termField' in patch) Pipeline.termFieldNote = null;
    Object.assign(s, patch);
    const persist = ['countryAliases', 'institutionAliases', 'synonyms', 'stopwords', 'termField'];
    for (const k of Object.keys(patch)) if (persist.includes(k)) Prefs.set(k, s[k]);
    if ('synonyms' in patch || 'stopwords' in patch) Pipeline._dict = null;
    if ('threshold' in patch) return Pipeline.refresh();
    Pipeline.run();
    return Pipeline.pending;
  },

  dict() {
    if (!Pipeline._dict) {
      const P = Pipeline.lib(), s = Pipeline.init();
      const stop = new Set([...s.stopwords.es, ...s.stopwords.en].map(w => P.fold(w).trim()).filter(Boolean));
      /* the built-in function words only cut word pairs; a keyword is excluded only by a word the user added
         (otherwise "ITS", the internal transcribed spacer, would vanish as the English "its") */
      const builtIn = new Set([...P.STOPWORDS.es, ...P.STOPWORDS.en].map(w => P.fold(w).trim()));
      const keywordStop = new Set([...stop].filter(w => !builtIn.has(w)));
      Pipeline._dict = { synonyms: P.synonymMap(s.synonyms), stop, keywordStop };
    }
    return Pipeline._dict;
  },

  records() { return state.filtered || []; },
  terms(r) { return Pipeline.lib().termsOf(r, Pipeline.init().termField, Pipeline.dict()); },

  /* Local citations and cited-reference clusters of the filtered set (P.referenceAnalysis), shared by
     Overview and Documents and kept until the set changes. Up to REF_INLINE_LIMIT references they are
     computed at once; above it a worker computes them with a progress bar, this returns null meanwhile,
     and 'refsready' is emitted when they arrive. { cancelled: true } if the user cancelled. */
  REF_INLINE_LIMIT: 25000,
  _refs: null,
  references() {
    const records = Pipeline.records();
    const c = Pipeline._refs;
    if (c && c.records === records) return c.data;
    const P = Pipeline.lib();
    let n = 0;
    for (const r of records) n += r.references.length;
    if (n <= Pipeline.REF_INLINE_LIMIT) {
      Pipeline._refs = { records, data: P.referenceAnalysis(records) };
      return Pipeline._refs.data;
    }
    const entry = { records, data: null };
    Pipeline._refs = entry;
    /* only what the matching needs travels to the worker */
    const slim = records.map(r => ({
      doi: r.doi, accession: r.accession, year: r.year, title: r.title, sourceTitle: r.sourceTitle, sourceAbbrev: r.sourceAbbrev,
      sourceName: r.sourceName, volume: r.volume, pages: r.pages, articleNumber: r.articleNumber,
      authors: r.authors.slice(0, 1).map(a => ({ last: a.last, short: a.short, full: a.full })), references: r.references,
    }));
    entry.pending = ProgressOverlay.run({
      title: t('documents.computing'), delay: 300, fns: window.PARSER_PARTS, payload: { records: slim },
      main: function (p, progress) { const Q = {}; for (const name in __fns) __fns[name](Q); return Q.referenceAnalysis(p.records, { progress, plain: true }); },
    }).then(data => {
      if (Pipeline._refs !== entry) return;
      entry.data = data || { cancelled: true };
      emit('refsready', entry.data);
    }, () => {
      if (Pipeline._refs === entry) { entry.data = { cancelled: true }; emit('refsready', entry.data); }
    });
    return null;
  },
  /* forget a cancelled calculation so the next screen asks again */
  retryReferences() { Pipeline._refs = null; },

  /* terms of the chosen field for every document of the filtered set, with their document counts
     (shared by Documents and the conceptual structure; again only when the set, the field or the dictionaries change) */
  _terms: null,
  termLists() {
    const records = Pipeline.records(), field = Pipeline.init().termField, dict = Pipeline.dict();
    const c = Pipeline._terms;
    if (c && c.records === records && c.field === field && c.dict === dict) return c.data;
    const P = Pipeline.lib();
    const lists = records.map(r => P.termsOf(r, field, dict));
    const counts = P.termCounts(records, field, dict, lists);
    const data = { field, lists, counts, labels: new Map(counts.map(x => [x.key, x.term])), withTerms: lists.filter(l => l.length).length };
    Pipeline._terms = { records, field, dict, data };
    return data;
  },
  counts() { return { shown: (state.filtered || []).length, total: (state.clean || []).length }; },

  signature() { return state.files.map(f => f.id + ':' + f.count).join(','); },

  /* recompute duplicates if needed, then the rest; returns a promise (also kept in Pipeline.pending) */
  refresh(opts) {
    opts = opts || {};
    Pipeline.pending = (async () => {
      const s = Pipeline.init();
      const raw = state.records || [];
      if (!raw.length) {
        Pipeline.dup = { signature: '', threshold: null, groups: [] };
        s.excluded = []; s.authorMerges = {}; Pipeline.termFieldNote = null; s.authorKept = []; s.filters = Pipeline.lib().emptyFilters();
        state.clean = null; state.screening = null; state.filtered = null; Pipeline.stats = null;
        emit('cleanchange', {});
        return;
      }
      Pipeline.checkTermField(raw);
      const sig = Pipeline.signature();
      if (sig !== Pipeline.dup.signature || s.threshold !== Pipeline.dup.threshold) {
        const P = Pipeline.lib();
        const items = raw.map(r => ({ id: r.id, doi: r.doi, title: r.title, year: r.year, surname: P.firstSurname(r), file: r.fileId }));
        let groups;
        if (raw.length <= Pipeline.INLINE_LIMIT || opts.inline) groups = P.findDuplicateGroups(items, { threshold: s.threshold });
        else {
          groups = await ProgressOverlay.run({
            title: t('cleaning.detecting'), delay: 300, fns: window.PARSER_PARTS, payload: { items, threshold: s.threshold },
            main: function (p, progress) { const Q = {}; for (const name in __fns) __fns[name](Q); return Q.findDuplicateGroups(p.items, { threshold: p.threshold }, progress); },
          });
          if (!groups) groups = [];
        }
        Pipeline.dup = { signature: sig, threshold: s.threshold, groups };
      }
      Pipeline.run();
    })();
    return Pipeline.pending;
  },

  run() {
    const P = Pipeline.lib(), s = Pipeline.init();
    const raw = state.records || [];
    if (!raw.length) { state.clean = null; state.screening = null; state.filtered = null; Pipeline.stats = null; emit('cleanchange', {}); return; }
    const byId = new Map(raw.map(r => [r.id, r]));
    const excluded = new Set(s.excluded);
    const active = Pipeline.dup.groups.filter(g => !excluded.has(g.key));
    const groupOf = new Map();
    for (const g of active) for (const id of g.ids) groupOf.set(id, g);

    const merged = [];
    const emitted = new Set();
    for (const r of raw) {
      const g = groupOf.get(r.id);
      if (!g) { merged.push(r); continue; }
      if (emitted.has(g.key)) continue;
      emitted.add(g.key);
      const m = P.mergeGroup(g.ids.map(id => byId.get(id)).filter(Boolean));
      m.dupGroup = g.key;
      merged.push(m);
    }
    state.clean = Pipeline.normalize(merged);
    state.screening = P.applyFilters(state.clean, s.filters);
    state.filtered = Pipeline.applyPrisma(state.screening);

    const bySource = {};
    for (const f of state.files) bySource[f.source] = (bySource[f.source] || 0) + f.count;
    Pipeline.stats = {
      identified: raw.length,
      bySource,
      groups: Pipeline.dup.groups.length,
      mergedGroups: active.length,
      duplicatesRemoved: raw.length - state.clean.length,
      unique: state.clean.length,
      filteredOut: state.clean.length - state.screening.length,
      screening: state.screening.length,
      shown: state.filtered.length,
    };
    emit('cleanchange', Pipeline.stats);
  },

  /* new record objects with normalised authors, institutions and countries (the imported ones are not modified) */
  normalize(records) {
    const P = Pipeline.lib(), s = Pipeline.init();
    const merges = s.authorMerges || {};
    const instAlias = new Map((s.institutionAliases || []).map(a => [P.institutionKey(a.from), P.clean(a.to)]));
    const countryAlias = P.countryAliasMap(s.countryAliases);
    const useCountryAlias = countryAlias.size > 0;
    const instCache = new Map();
    const institution = aff => {
      if (!instCache.has(aff)) {
        const name = P.institutionOf(aff);
        instCache.set(aff, name ? (instAlias.get(P.institutionKey(name)) || name) : '');
      }
      return instCache.get(aff);
    };
    const canonical = key => { let k = key, guard = 0; while (merges[k] && merges[k] !== k && guard++ < 20) k = merges[k]; return k; };
    const labelVotes = new Map();
    const out = records.map(r => {
      const authors = r.authors.map(a => {
        const key = canonical(P.authorKey(a));
        const label = P.authorLabel(a);
        let votes = labelVotes.get(key);
        if (!votes) { votes = new Map(); labelVotes.set(key, votes); }
        votes.set(label, (votes.get(label) || 0) + 1);
        let country = a.country;
        if (useCountryAlias) for (const af of a.affiliations) { const c = P.countryOf(af, countryAlias); if (c) { country = c; break; } }
        return Object.assign({}, a, { key, label, country, institutions: P.uniq(a.affiliations.map(institution).filter(Boolean)) });
      });
      const nr = Object.assign({}, r, { authors });
      const fromAuthors = authors.flatMap(a => a.institutions);
      nr.institutions = P.uniq(fromAuthors.length ? fromAuthors : r.affiliations.map(institution).filter(Boolean));
      if (useCountryAlias) {
        const codes = authors.map(a => a.country).filter(Boolean);
        for (const af of r.affiliations) { const c = P.countryOf(af, countryAlias); if (c) codes.push(c); }
        nr.countries = [...new Set(codes.length ? codes : r.countries)];
      }
      return nr;
    });
    /* one spelling per author key: the most frequent one */
    const best = new Map();
    for (const [key, votes] of labelVotes) best.set(key, [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
    for (const r of out) for (const a of r.authors) a.label = best.get(a.key) || a.label;
    /* one key and one name per source: spellings without case, accents or punctuation, or sharing an ISSN */
    const sg = P.sourceGroups(out);
    out.forEach((r, i) => { r.sourceKey = sg.keyOf[i]; r.sourceName = sg.keyOf[i] ? sg.labels.get(sg.keyOf[i]) : ''; });
    Pipeline.sourceSpellings = sg.spellings;
    return out;
  },

  /* ---------- helpers for the screens ---------- */
  authorGroups() {
    const s = Pipeline.init();
    const groups = Pipeline.lib().authorVariantGroups(state.clean ? state.clean.map(r => Object.assign({}, r, { authors: r.authors })) : []);
    const merges = s.authorMerges || {};
    const kept = new Set(s.authorKept);
    for (const g of groups) {
      const targets = new Set(g.variants.map(v => { let k = v.key, guard = 0; while (merges[k] && merges[k] !== k && guard++ < 20) k = merges[k]; return k; }));
      g.status = targets.size === 1 ? 'joined' : kept.has(g.gid) ? 'kept' : 'open';
    }
    return groups;
  },

  joinAuthors(group, canonicalKey) {
    const s = Pipeline.init();
    const merges = Object.assign({}, s.authorMerges);
    for (const v of group.variants) if (v.key !== canonicalKey) merges[v.key] = canonicalKey;
    delete merges[canonicalKey];
    return Pipeline.update({ authorMerges: merges, authorKept: s.authorKept.filter(g => g !== group.gid) });
  },
  keepAuthors(group) {
    const s = Pipeline.init();
    const merges = Object.assign({}, s.authorMerges);
    for (const v of group.variants) delete merges[v.key];
    return Pipeline.update({ authorMerges: merges, authorKept: [...new Set(s.authorKept.concat(group.gid))] });
  },
  resetAuthors(group) {
    const s = Pipeline.init();
    const merges = Object.assign({}, s.authorMerges);
    for (const v of group.variants) delete merges[v.key];
    return Pipeline.update({ authorMerges: merges, authorKept: s.authorKept.filter(g => g !== group.gid) });
  },

  setMerged(groupKey, merged) {
    const s = Pipeline.init();
    const ex = new Set(s.excluded);
    if (merged) ex.delete(groupKey); else ex.add(groupKey);
    return Pipeline.update({ excluded: [...ex] });
  },
};

on('datachange', () => { Pipeline.refresh(); });
window.Pipeline = Pipeline;
