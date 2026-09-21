/* SciMetricsPro — search strategy from a tentative title or research idea (Import · Keywords).
   Pure functions (no window, no DOM); the glossary (js/search/glossary.js) is passed in.

   · Concepts: the title is cut at prepositions, articles and punctuation; "and/or" joins alternatives of the same
     concept; generic research words (effect, analysis, study…) are dropped; the longest glossary phrase wins
     ("calidad del fruto" → fruit quality); a Spanish noun with modifiers is written in English order
     ("fertilización orgánica" → organic fertilization); a lone coordinated modifier takes the previous noun
     ("… nitrogenada y potásica" → potassium fertilization); text in parentheses joins the previous concept
     (scientific names); places start unchecked. Words without translation keep their spelling and are flagged.
   · Search strings: terms of a concept joined with OR, concepts with AND (the block strategy of systematic
     searches), written in the syntax of each database: field codes, phrase quotes, truncation rules (minimum
     letters before *, no wildcards inside phrases, $ instead of *, or no truncation at all) and years. */
'use strict';

function smpStrategy(P) {
  /* database codes (their names are only written on the import screen) */
  P.STRATEGY_ENGINES = ['idxA', 'idxB', 'biomed', 'scholar', 'linked', 'regional', 'openapi', 'generic'];

  const ES_ARTICLES = new Set('el la los las lo un una unos unas su sus'.split(' '));
  const ES_BREAK = new Set('de del en con para por sobre bajo entre a al sin mediante desde hacia segun durante ante tras contra como que cual cuales donde'.split(' '));
  const ES_COORD = new Set(['y', 'e', 'o', 'u']);
  const EN_ARTICLES = new Set('the a an its their'.split(' '));
  const EN_BREAK = new Set('of in on with for by under between at from to into through using via across among within during against as that versus vs'.split(' '));
  const EN_COORD = new Set(['and', 'or']);
  const TYPES = new Set(['n', 'a', 'o', 'p', 'g']);

  /* lower case without accents; ñ stays apart from n */
  const foldKey = s => String(s == null ? '' : s).normalize('NFC').toLowerCase().split('ñ')
    .map(x => x.normalize('NFD').replace(/\p{M}/gu, '')).join('ñ');

  /* the same key for singular and plural and for both genders (applied to the glossary and to the title alike) */
  P.strategyKey = function (word, lang) {
    let w = foldKey(word);
    if (lang === 'en') {
      if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
      if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
      return w;
    }
    if (w.length <= 3) return w;
    if (/ces$/.test(w)) w = w.slice(0, -3) + 'z';
    else if (/[lnrdjy]es$/.test(w)) w = w.slice(0, -2);
    else if (/s$/.test(w) && !/(is|us)$/.test(w)) w = w.slice(0, -1);
    if (w.length > 3 && /[ao]$/.test(w)) w = w.slice(0, -1);
    return w;
  };

  const splitForms = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  const wordsOf = s => String(s).split(/\s+/).filter(Boolean);
  /* a capitalised English form is a scientific name, an acronym or a proper noun: it takes no modifiers */
  const isProper = s => /^\p{Lu}/u.test(s);
  const isBinomial = s => /^\p{Lu}\p{Ll}{2,}( [\p{Ll}][\p{Ll}-]{2,})+$/u.test(s);

  /* key of a phrase: articles dropped, "del"/"al" as "de"/"a", each word keyed */
  const phraseKey = (words, lang) => {
    const art = lang === 'en' ? EN_ARTICLES : ES_ARTICLES;
    return words.map(foldKey).filter(w => !art.has(w))
      .map(w => (lang === 'es' && w === 'del' ? 'de' : lang === 'es' && w === 'al' ? 'a' : w))
      .map(w => P.strategyKey(w, lang)).join(' ');
  };

  /* glossary rows → { entries, es: Map(key → [entries]), en: Map(key → [entries]), maxWords }
     (scientific names of organisms are found in Spanish titles too) */
  P.strategyIndex = function (rows) {
    const index = { entries: [], es: new Map(), en: new Map(), maxWords: 1 };
    const add = (map, words, lang, entry) => {
      const key = phraseKey(words, lang);
      if (!key) return;
      index.maxWords = Math.max(index.maxWords, words.length);
      if (!map.has(key)) map.set(key, []);
      if (!map.get(key).includes(entry)) map.get(key).push(entry);
    };
    for (const row of rows || []) {
      if (!Array.isArray(row) || !TYPES.has(row[0])) continue;
      const entry = { type: row[0], es: splitForms(row[1]), en: splitForms(row[2]) };
      if (!entry.en.length) continue;
      index.entries.push(entry);
      for (const f of entry.es) add(index.es, wordsOf(f), 'es', entry);
      for (const f of entry.en) {
        add(index.en, wordsOf(f), 'en', entry);
        if (entry.type === 'o' && isProper(f)) add(index.es, wordsOf(f), 'es', entry);
      }
    }
    return index;
  };

  /* words (with their place in the text), punctuation and parentheses */
  P.strategyTokens = function (text) {
    const out = [];
    const re = /(\()|(\))|([,;:.!?¿¡]+)|(\/)|([\p{L}\p{N}][\p{L}\p{N}'’.-]*[\p{L}\p{N}]|[\p{L}\p{N}])/gu;
    let m;
    const s = String(text || '');
    while ((m = re.exec(s))) {
      const kind = m[1] ? 'open' : m[2] ? 'close' : m[3] ? 'punct' : m[4] ? 'slash' : 'word';
      out.push({ kind, raw: m[0], start: m.index, end: m.index + m[0].length, fold: foldKey(m[0]) });
    }
    return out;
  };

  /* Spanish or English: function words and accents first, then the words each glossary knows */
  P.strategyLanguage = function (tokens, index) {
    let es = 0, en = 0;
    for (const t of tokens) {
      if (t.kind !== 'word') continue;
      if (ES_BREAK.has(t.fold) || ES_ARTICLES.has(t.fold) || ES_COORD.has(t.fold) || /[áéíóúñü]/.test(t.raw.toLowerCase())) es += 2;
      if (EN_BREAK.has(t.fold) || EN_ARTICLES.has(t.fold) || EN_COORD.has(t.fold)) en += 2;
      if (index) {
        if (index.es.has(P.strategyKey(t.raw, 'es'))) es++;
        if (index.en.has(P.strategyKey(t.raw, 'en'))) en++;
      }
    }
    return en > es ? 'en' : 'es';
  };

  /* title or idea → { lang, blocks: [{ label, kind: 'topic'|'organism'|'place', include, missing, terms: [...] }] } */
  P.strategyConcepts = function (text, index) {
    index = index || P.strategyIndex([]);
    const source = String(text || '');
    const tokens = P.strategyTokens(source);
    const lang = P.strategyLanguage(tokens, index);
    const map = index[lang];
    const ART = lang === 'en' ? EN_ARTICLES : ES_ARTICLES, BRK = lang === 'en' ? EN_BREAK : ES_BREAK, CRD = lang === 'en' ? EN_COORD : ES_COORD;
    /* in a Title Case Title capitals say nothing about places */
    const words = tokens.filter(x => x.kind === 'word' && !BRK.has(x.fold) && !ART.has(x.fold) && !CRD.has(x.fold));
    const capsMean = words.slice(1).filter(x => /^\p{Lu}/u.test(x.raw)).length <= words.slice(1).length / 2;

    /* 1. items: glossary matches (longest first), unknown words, breaks, alternatives, parentheses */
    const items = [];
    let first = true;
    for (let i = 0; i < tokens.length;) {
      const tok = tokens[i];
      if (tok.kind === 'open') {
        let j = i + 1;
        while (j < tokens.length && tokens[j].kind !== 'close') j++;
        const inner = source.slice(tok.end, j < tokens.length ? tokens[j].start : source.length).trim();
        if (inner) items.push({ kind: 'paren', text: inner });
        i = j + 1;
        continue;
      }
      if (tok.kind === 'close') { i++; continue; }
      if (tok.kind === 'punct') { items.push({ kind: 'break', comma: /^,$/.test(tok.raw) }); i++; continue; }
      if (tok.kind === 'slash') { items.push({ kind: 'coord' }); i++; continue; }
      const cap = capsMean && !first && /^\p{Lu}/u.test(tok.raw);
      let best = null;
      if (!ART.has(tok.fold) && !CRD.has(tok.fold) && !BRK.has(tok.fold)) {
        const run = [];
        for (let j = i; j < tokens.length && tokens[j].kind === 'word' && run.length < index.maxWords + 3; j++) {
          run.push(tokens[j].raw);
          const found = BRK.has(tokens[j].fold) || ART.has(tokens[j].fold) ? null : map.get(phraseKey(run, lang));
          if (found) best = { end: j + 1, entries: found };
        }
      }
      first = false;
      if (best) {
        /* one spelling with several meanings: organisms and concepts before modifiers and generic words; a place
           only with a capital letter ("Chile" the country, "chile" the pepper) */
        const rank = e => (e.type === 'p' ? (cap ? 0 : 4) : { o: 1, n: 2, a: 3, g: 5 }[e.type]);
        const entries = best.entries.slice().sort((a, b) => rank(a) - rank(b));
        const end = tokens[best.end - 1].end;
        items.push({ kind: 'entry', entry: entries[0], start: tok.start, end, raw: source.slice(tok.start, end), cap });
        i = best.end;
        continue;
      }
      if (CRD.has(tok.fold)) items.push({ kind: 'coord' });
      else if (BRK.has(tok.fold)) items.push({ kind: 'break' });
      else if (!ART.has(tok.fold) && !/^\d+$/.test(tok.fold)) items.push({ kind: 'word', raw: tok.raw, start: tok.start, end: tok.end, cap });
      i++;
    }

    /* 2. segments: runs of content items; "and/or" makes the next segment an alternative of the previous one */
    const segments = [];
    let seg = null, pendingCoord = false, afterComma = false;
    const flush = () => { if (seg) segments.push(seg); seg = null; };
    for (const it of items) {
      if (it.kind === 'break') { flush(); pendingCoord = false; afterComma = !!it.comma; continue; }
      if (it.kind === 'coord') { flush(); pendingCoord = true; continue; }
      if (it.kind === 'paren') { flush(); if (segments.length) segments[segments.length - 1].extra.push(it.text); continue; }
      if (!seg) { seg = { parts: [], coord: pendingCoord, afterComma, extra: [] }; pendingCoord = false; afterComma = false; }
      seg.parts.push(it);
    }
    flush();
    /* an organism next to other nouns is a concept of its own ("common bean landraces" → common bean + landraces) */
    for (let k = 0; k < segments.length; k++) {
      const s = segments[k];
      const at = s.parts.findIndex(p => p.kind === 'entry' && p.entry.type === 'o');
      const others = s.parts.filter(p => p.kind === 'entry' && (p.entry.type === 'n' || p.entry.type === 'p'));
      if (at < 0 || !others.length) continue;
      const pieces = [s.parts.slice(0, at), [s.parts[at]], s.parts.slice(at + 1)].filter(x => x.length);
      if (pieces.length < 2) continue;
      const split = pieces.map((parts, n) => ({ parts, coord: n === 0 ? s.coord : false, afterComma: n === 0 ? s.afterComma : false, extra: [] }));
      split[split.length - 1].extra = s.extra;
      segments.splice(k, 1, ...split);
      k += split.length - 1;
    }
    /* English "nitrogen and potassium fertilization": the first word shares the noun that ends the next segment */
    if (lang === 'en') {
      for (let k = 0; k + 1 < segments.length; k++) {
        const a = segments[k], b = segments[k + 1], last = b.parts[b.parts.length - 1];
        if (b.coord && a.parts.length === 1 && b.parts.length >= 2 && last.kind === 'entry' && last.entry.type === 'n') a.sharedHead = last;
      }
    }

    /* 3. the terms of each segment */
    const common = forms => forms.filter(f => !isProper(f));
    const compose = (mods, noun) => { const base = common(noun.en).slice(0, 4); return (base.length ? base : noun.en.slice(0, 1)).map(f => mods + ' ' + f); };
    /* the noun a lone modifier refers to: the only noun of the previous segment, or the first word of its phrase */
    const headOf = s => {
      const nouns = s.parts.filter(p => p.kind === 'entry' && p.entry.type === 'n');
      if (nouns.length === 1 && s.parts.length > 1) return { entry: nouns[0].entry, raw: nouns[0].raw };
      const e = s.parts.find(p => p.kind === 'entry');
      if (!e) return null;
      const w = wordsOf(e.raw)[0];
      const found = (map.get(phraseKey([w], lang)) || []).find(x => x.type === 'n');
      return found ? { entry: found, raw: w } : null;
    };
    const blocks = [];
    let previous = null;
    for (const s of segments) {
      const parts = s.parts.filter(p => !(p.kind === 'entry' && p.entry.type === 'g'));
      if (!parts.length && !s.extra.length) { previous = null; continue; }
      const entries = parts.filter(p => p.kind === 'entry');
      const unknown = parts.filter(p => p.kind === 'word');
      const nouns = entries.filter(p => p.entry.type === 'n' || p.entry.type === 'o');
      const mods = entries.filter(p => p.entry.type === 'a');
      const label = parts.length ? source.slice(parts[0].start, parts[parts.length - 1].end) : '';
      const lower = label.toLowerCase();
      let kind = entries.some(p => p.entry.type === 'o') ? 'organism' : 'topic';
      let terms = [], missing = false;
      if (!parts.length) {
        terms = [];
      } else if (s.sharedHead) {
        const head = s.sharedHead;
        terms = [lower + ' ' + head.raw.toLowerCase(), ...compose(lower, head.entry)];
      } else if (unknown.length) {
        /* words the glossary does not know: scientific names and proper nouns (not at the start of the title) stay as
           written; the rest are flagged */
        if (!entries.length && parts[0].cap && isBinomial(label)) { kind = 'organism'; terms = [label]; }
        else if (!entries.length && unknown.every(p => p.cap)) { kind = 'place'; terms = [label]; }
        else { terms = [lower]; missing = lang === 'es'; }
      } else if (entries.every(p => p.entry.type === 'p')) {
        kind = 'place';
        entries.forEach(p => terms.push(...p.entry.en));
      } else if (lang === 'es') {
        if (nouns.length === 1) {
          terms = mods.length ? compose(mods.map(m => m.entry.en[0]).join(' '), nouns[0].entry) : nouns[0].entry.en.slice();
          terms.push(lower);
        } else if (!nouns.length && s.coord && previous && headOf(previous.seg)) {
          /* "… y potásica": the modifier of the previous concept's noun */
          const h = headOf(previous.seg);
          terms = compose(mods.map(m => m.entry.en[0]).join(' '), h.entry);
          terms.push(h.raw.toLowerCase() + ' ' + lower);
        } else if (!nouns.length) {
          terms = mods[0].entry.en.slice();
          terms.push(lower);
        } else {
          /* several nouns without a phrase in the glossary: English order */
          terms = [nouns.map(p => common(p.entry.en)[0] || p.entry.en[0]).reverse().join(' '), lower];
        }
      } else {
        /* English: the words as written, then the synonyms the glossary knows */
        terms = [lower];
        const last = parts[parts.length - 1];
        if (parts.length === 1) terms.push(...last.entry.en);
        else if (last.kind === 'entry' && (last.entry.type === 'n' || last.entry.type === 'o')) {
          terms.push(...compose(source.slice(parts[0].start, last.start).trim().toLowerCase(), last.entry));
        }
      }
      terms.push(...s.extra);
      if (kind === 'topic' && s.extra.some(isBinomial)) kind = 'organism';
      const block = { label: label + (s.extra.length ? (label ? ' ' : '') + '(' + s.extra.join('; ') + ')' : ''), kind, include: kind !== 'place', missing, terms };
      const last = blocks[blocks.length - 1];
      const joinPlaces = last && kind === 'place' && last.kind === 'place' && s.afterComma;
      if (last && ((s.coord && previous) || joinPlaces)) {
        /* alternatives of one concept; the pieces are kept so the person can separate them again */
        if (!last.pieces) last.pieces = [{ label: last.label, kind: last.kind, missing: last.missing, terms: last.terms.slice() }];
        last.pieces.push({ label: block.label, kind: block.kind, missing: block.missing, terms: block.terms.slice() });
        last.label += (joinPlaces ? ', ' : ' / ') + block.label;
        last.terms.push(...block.terms);
        last.missing = last.missing || block.missing;
        if (kind === 'organism') last.kind = 'organism';
      } else blocks.push(block);
      previous = { seg: s };
    }
    blocks.forEach(b => {
      b.terms = P.strategyUniqueTerms(b.terms).slice(0, 16);
      if (b.pieces) b.pieces.forEach(p => { p.terms = P.strategyUniqueTerms(p.terms); });
    });
    return { lang, blocks: blocks.filter(b => b.terms.length) };
  };

  /* a concept made of joined alternatives → one concept per piece (the person decides they are different concepts) */
  P.strategySeparate = function (block) {
    if (!block || !block.pieces || block.pieces.length < 2) return [block];
    return block.pieces.map(p => ({ label: p.label, kind: p.kind, include: p.kind !== 'place', missing: !!p.missing, terms: p.terms.slice() }));
  };

  /* two concepts → one concept whose terms are alternatives (joined with OR) */
  P.strategyMerge = function (a, b) {
    const pieces = [].concat(a.pieces || [{ label: a.label, kind: a.kind, missing: a.missing, terms: a.terms }], b.pieces || [{ label: b.label, kind: b.kind, missing: b.missing, terms: b.terms }]);
    return { label: a.label + ' / ' + b.label, kind: a.kind === 'organism' || b.kind === 'organism' ? 'organism' : a.kind === 'place' && b.kind === 'place' ? 'place' : 'topic',
      include: a.include !== false || b.include !== false, missing: !!(a.missing || b.missing), terms: P.strategyUniqueTerms(a.terms.concat(b.terms)), pieces: pieces.map(p => Object.assign({}, p, { terms: p.terms.slice() })) };
  };

  /* each term once (without case, accents or quotes) */
  P.strategyUniqueTerms = function (terms) {
    const seen = new Set(), out = [];
    for (const t of terms || []) {
      const clean = String(t == null ? '' : t).replace(/"/g, '').replace(/\s+/g, ' ').trim();
      const k = foldKey(clean);
      if (!clean || seen.has(k)) continue;
      seen.add(k);
      out.push(clean);
    }
    return out;
  };

  /* one term in the syntax of a database → { text } or { skip: true, stripped } when it cannot be written there */
  P.strategyTerm = function (term, engine, field) {
    let t = String(term == null ? '' : term).replace(/"/g, '').replace(/\$/g, '*').replace(/\s+/g, ' ').trim();
    if (!t || !/[\p{L}\p{N}]/u.test(t)) return { skip: true };
    const quote = s => (/\s/.test(s) ? '"' + s + '"' : s);
    /* a wildcard needs enough letters before it in its word; otherwise the term cannot be written there */
    const early = (s, n) => s.split(' ').some(w => { const k = w.search(/[*?]/); return k >= 0 && k < n; });
    const cannot = s => ({ skip: true, stripped: quote(s.replace(/[*?]/g, '')) });
    const andWords = s => '(' + s.split(' ').join(' AND ') + ')';
    const wild = s => /[*?]/.test(s), phrase = s => /\s/.test(s);
    switch (engine) {
      case 'idxA': return { text: quote(t) };
      case 'idxB': return early(t, 3) ? cannot(t) : { text: quote(t) };
      case 'biomed': {
        const tag = field === 'title' ? '[ti]' : '[tiab]';
        t = t.replace(/\?/g, '*');
        const r = early(t, 4) ? cannot(t) : { text: quote(t) + tag };
        if (r.skip) r.stripped += tag;
        return r;
      }
      case 'scholar':
      case 'linked': return { text: wild(t) && phrase(t) ? andWords(t) : quote(t) };
      case 'regional':
        t = t.replace(/[*?]/g, '$');
        return { text: /\$/.test(t) && phrase(t) ? andWords(t) : quote(t) };
      default:
        if (wild(t)) return { skip: true, stripped: quote(t.replace(/[*?]/g, '')) };
        return { text: quote(t) };
    }
  };

  /* blocks → the search string of one database
     opts: { field: 'tak' (title, abstract and keywords) | 'title', yearFrom, yearTo, currentYear } → { text, blocks, dropped } */
  P.strategyQuery = function (engine, blocks, opts) {
    opts = opts || {};
    const field = opts.field === 'title' ? 'title' : 'tak';
    const y0 = parseInt(opts.yearFrom, 10) || null, y1 = parseInt(opts.yearTo, 10) || null;
    let dropped = 0;
    const groups = [];
    for (const b of blocks || []) {
      if (!b || b.include === false) continue;
      const rendered = [], stripped = [];
      for (const term of P.strategyUniqueTerms(b.terms)) {
        const r = P.strategyTerm(term, engine, field);
        if (r.skip) { if (r.stripped) { stripped.push(r.stripped); dropped++; } continue; }
        if (!rendered.includes(r.text)) rendered.push(r.text);
      }
      /* a concept made only of truncated terms keeps their stems where there is no truncation */
      if (!rendered.length && stripped.length) { [...new Set(stripped)].forEach(x => rendered.push(x)); dropped -= stripped.length; }
      if (rendered.length) groups.push(rendered);
    }
    if (!groups.length) return { text: '', blocks: 0, dropped };
    const orList = g => (g.length > 1 ? '(' + g.join(' OR ') + ')' : g[0]);
    const all = () => groups.map(orList).join(' AND ');
    let text;
    switch (engine) {
      case 'idxA':
        text = (field === 'title' ? 'TITLE(' : 'TITLE-ABS-KEY(') + all() + ')';
        if (y0) text += ' AND PUBYEAR > ' + (y0 - 1);
        if (y1) text += ' AND PUBYEAR < ' + (y1 + 1);
        break;
      case 'idxB':
        text = (field === 'title' ? 'TI=(' : 'TS=(') + all() + ')';
        if (y0 || y1) text += ' AND PY=(' + (y0 || 1900) + '-' + (y1 || opts.currentYear || new Date().getFullYear()) + ')';
        break;
      case 'biomed':
        text = all();
        if (y0 || y1) text += ' AND ' + (y0 || 1800) + ':' + (y1 || 3000) + '[dp]';
        break;
      case 'scholar': {
        const inner = g => '(' + g.join(' OR ') + ')';
        text = groups.map(g => (field === 'title' ? 'title:' + inner(g) : '(title:' + inner(g) + ' OR abstract:' + inner(g) + ' OR keyword:' + inner(g) + ')')).join(' AND ');
        if (y0 || y1) text += ' AND year_published:[' + (y0 || '*') + ' TO ' + (y1 || '*') + ']';
        break;
      }
      default:
        text = all();
    }
    return { text, blocks: groups.length, dropped };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpStrategy);
