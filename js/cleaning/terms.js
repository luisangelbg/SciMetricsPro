/* SciMetricsPro — the terms analysed across the app, synonyms and stop words.
   Field: author keywords, index keywords, or two-word terms (bigrams) of titles or
   abstracts. Terms are compared without case or accents; a synonym table maps
   variants to a preferred term; stop words cut bigrams (a bigram never spans a removed word), and
   the words the user adds to the built-in list also drop whole keywords. */
'use strict';

function smpTerms(P) {
  P.TERM_FIELDS = ['authorKeywords', 'indexKeywords', 'titles', 'abstracts'];

  P.STOPWORDS = {
    en: ('a about above after again against all almost also although always am among an and another any are as at be because been before being ' +
      'below between both but by can could did do does doing done down due during each either else etc even ever every few for from further ' +
      'had has have having he her here hers herself him himself his how however i if in into is it its itself just less made main many may ' +
      'me might more most much must my myself no nor not now of off often on once one only or other others our ours ourselves out over own ' +
      'per rather same she should since so some such than that the their theirs them themselves then there therefore these they this those ' +
      'though three through thus to too two under until up upon us use used using very via was we well were what when where whether which ' +
      'while who whom whose why will with within without would yet you your yours yourself yourselves study studies result results show ' +
      'shows showed shown present presents based effect effects different high higher low lower new obtained found analysis evaluated among').split(' '),
    es: ('a al algo algunas algunos ante antes aquel aquella aquellas aquellos aqui asi aun aunque bajo bien cada casi como con contra cual ' +
      'cuales cuando de del desde donde dos durante e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estaba estado estan ' +
      'estar este esto estos fue fueron ha han hasta hay la las le les lo los mas me mediante mi mientras muy nada ni no nos o otra otras otro ' +
      'otros para pero poco por porque que se segun ser si sido sin sobre son su sus tal tambien tan tanto te tiene tienen todo todos tras tres ' +
      'tu u un una unas uno unos y ya estudio estudios resultados presente trabajo mayor menor diferentes fueron evaluo evaluaron analisis').split(' '),
  };

  /* words of a text: lower case without accents, letters and digits, keeping inner hyphens */
  P.tokens = function (text) {
    return (P.fold(text).match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []).filter(w => w.length > 1 && !/^\d+$/.test(w));
  };

  /* two-word terms that do not cross a stop word */
  P.bigrams = function (text, stop) {
    const out = [];
    let prev = null;
    for (const w of P.tokens(text)) {
      if (stop.has(w)) { prev = null; continue; }
      if (prev) out.push(prev + ' ' + w);
      prev = w;
    }
    return out;
  };

  /* does the record bring anything for the field? (before synonyms and stop words) */
  P.hasFieldData = function (r, field) {
    if (field === 'titles') return !!(r.title && String(r.title).trim());
    if (field === 'abstracts') return !!(r.abstract && String(r.abstract).trim());
    const list = field === 'indexKeywords' ? r.indexKeywords : r.authorKeywords;
    return !!(list && list.some(k => k && String(k).trim()));
  };

  /* the field to analyse: the chosen one if at least one record brings it; otherwise the first field of
     TERM_FIELDS that some record brings (a catalogue without author keywords falls to its index keywords) */
  P.termFieldFor = function (records, chosen) {
    const has = f => records.some(r => P.hasFieldData(r, f));
    if (!records.length || has(chosen)) return chosen;
    return P.TERM_FIELDS.find(has) || chosen;
  };

  /* dict: { synonyms: Map(folded variant → preferred), stop: Set(folded), keywordStop?: Set(folded) }
     keywordStop (when given) is the part of the stop words that excludes whole keywords */
  P.termsOf = function (r, field, dict) {
    const text = field === 'titles' || field === 'abstracts';
    const stop = (text ? dict.stop : dict.keywordStop || dict.stop) || new Set();
    const syn = dict.synonyms || new Map();
    let raw;
    if (field === 'titles') raw = P.bigrams(r.title, stop);
    else if (field === 'abstracts') raw = P.bigrams(r.abstract, stop);
    else raw = (field === 'indexKeywords' ? r.indexKeywords : r.authorKeywords).map(k => P.clean(k));
    const seen = new Set(), out = [];
    const folded = field === 'titles' || field === 'abstracts';     // bigrams are already folded, one space apart
    for (const term of raw) {
      let key = folded ? term : P.fold(term).replace(/\s+/g, ' ').trim();
      if (!key || stop.has(key)) continue;
      if (syn.has(key)) { const to = syn.get(key); key = P.fold(to).replace(/\s+/g, ' ').trim(); }
      if (!key || stop.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  };

  /* document counts per term, with the most frequent spelling as label (label spelling uses the preferred form of synonyms);
     lists: the terms of each record when they were already computed */
  P.termCounts = function (records, field, dict, lists) {
    const counts = new Map();
    const syn = dict.synonyms || new Map();
    const spell = new Map();
    const note = (key, label) => { let m = spell.get(key); if (!m) { m = new Map(); spell.set(key, m); } m.set(label, (m.get(label) || 0) + 1); };
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      for (const key of (lists ? lists[i] : P.termsOf(r, field, dict))) counts.set(key, (counts.get(key) || 0) + 1);
      if (field === 'authorKeywords' || field === 'indexKeywords') {
        for (const k of (field === 'indexKeywords' ? r.indexKeywords : r.authorKeywords)) {
          const folded = P.fold(k).replace(/\s+/g, ' ').trim();
          const key = syn.has(folded) ? P.fold(syn.get(folded)).replace(/\s+/g, ' ').trim() : folded;
          note(key, syn.has(folded) ? P.clean(syn.get(folded)) : P.clean(k));
        }
      }
    }
    return [...counts.entries()].map(([key, docs]) => {
      const m = spell.get(key);
      const label = m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : key;
      return { key, term: label, docs };
    }).sort((a, b) => b.docs - a.docs || a.key.localeCompare(b.key));
  };

  /* Suggested synonyms among counted terms: the same after removing hyphens, spaces and
     punctuation, singular/plural, and very similar spellings. → [{ preferred, variants: [...] }] */
  P.synonymSuggestions = function (counts, opts) {
    opts = opts || {};
    const minSim = opts.similarity || 0.9;
    const items = counts.slice(0, opts.max || 3000);
    const parent = items.map((x, i) => i);
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    const squash = s => s.replace(/[\s.,;:()[\]'"’‐-―-]+/g, '');   // spaces, hyphens and punctuation: "sw." = "sw"
    const stem = s => s.split(' ').map(w => (w.length > 4 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 4 && /(ses|xes|ches|shes)$/.test(w) ? w.slice(0, -2) : w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)).join(' ');
    const byKey = new Map();
    items.forEach((x, i) => {
      for (const k of ['s:' + squash(x.key), 'p:' + squash(stem(x.key))]) {
        if (k.length === 2) continue;   // nothing left after removing punctuation
        if (byKey.has(k)) union(byKey.get(k), i); else byKey.set(k, i);
      }
    });
    /* similar spellings: sorted neighbours */
    const order = items.map((x, i) => i).sort((a, b) => (items[a].key < items[b].key ? -1 : 1));
    for (let p = 0; p < order.length; p++) {
      for (let q = p + 1; q < Math.min(order.length, p + 3); q++) {
        const a = items[order[p]].key, b = items[order[q]].key;
        if (a.length < 6 || b.length < 6) continue;
        if (P.titleSimilarity(a, b, minSim) >= minSim) union(order[p], order[q]);
      }
    }
    const groups = new Map();
    items.forEach((x, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(x); });
    return [...groups.values()].filter(g => g.length > 1).map(g => {
      g.sort((a, b) => b.docs - a.docs || a.key.length - b.key.length);
      return { preferred: g[0].term, preferredKey: g[0].key, variants: g.slice(1), docs: g.reduce((s, x) => s + x.docs, 0) };
    }).sort((a, b) => b.docs - a.docs);
  };

  /* synonym table ⇄ CSV ("term,preferred term") */
  P.synonymsToCsv = function (rows) {
    const q = s => (/[",\r\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));
    return ['term,preferred'].concat(rows.map(r => q(r.from) + ',' + q(r.to))).join('\r\n') + '\r\n';
  };
  P.synonymsFromCsv = function (text) {
    const sep = P.sniffSeparator(P.stripBom(text));
    const rows = P.parseDelimited(P.stripBom(text), sep);
    const out = [];
    rows.forEach((r, i) => {
      const from = P.clean(r[0]), to = P.clean(r[1]);
      if (!from || !to) return;
      if (i === 0 && /^(term|termino|término|from|variant|variante)$/i.test(P.fold(from))) return;
      out.push({ from, to });
    });
    return out;
  };

  P.synonymMap = function (rows) {
    const m = new Map();
    for (const r of rows || []) {
      const from = P.fold(r.from).replace(/\s+/g, ' ').trim(), to = P.clean(r.to);
      if (from && to && from !== P.fold(to).trim()) m.set(from, to);
    }
    return m;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpTerms);
