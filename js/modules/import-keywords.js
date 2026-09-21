/* SciMetricsPro — Import · Keywords: from a tentative title or research idea to a search string for each database.
   The app does not search: the person copies the string, pastes it in the database of their choice and exports the
   results. Concepts come from js/search/strategy.js with the glossary of js/search/glossary.js; everything is local.
   Part of the import screen, so the databases may be named in its texts. The state lives in ImportModule.kw
   (it travels with the project). */
'use strict';

const KeywordsPanel = {
  ENGINES: ['idxA', 'idxB', 'biomed', 'scholar', 'linked', 'regional', 'openapi', 'generic'],
  MANY: 4,
  _index: null,

  defaults() { return { idea: '', field: 'tak', yearFrom: '', yearTo: '', blocks: null, lang: null }; },
  S() {
    if (!ImportModule.kw) ImportModule.kw = KeywordsPanel.defaults();
    return ImportModule.kw;
  },
  index() {
    if (!KeywordsPanel._index) KeywordsPanel._index = Parsers.lib().strategyIndex(window.SMP_GLOSSARY || []);
    return KeywordsPanel._index;
  },

  /* the concepts of the idea (replaces the ones on screen) */
  build() {
    const s = KeywordsPanel.S();
    const r = Parsers.lib().strategyConcepts(s.idea, KeywordsPanel.index());
    s.blocks = r.blocks;
    s.lang = r.lang;
    return r;
  },

  query(engine) {
    const s = KeywordsPanel.S();
    return Parsers.lib().strategyQuery(engine, s.blocks || [], { field: s.field, yearFrom: s.yearFrom, yearTo: s.yearTo, currentYear: new Date().getFullYear() });
  },

  help(key, title) {
    const base = 'import.keywords.help.' + key;
    return { title, text: t(base + '.text'), formula: t(base + '.formula'), where: [], interpretation: t(base + '.interpretation'), refs: [] };
  },
  heading(tag, textKey, helpKey) {
    const h = mk(tag, null, esc(t(textKey)));
    if (helpKey) h.appendChild(HelpPopover.button(KeywordsPanel.help(helpKey, t(textKey)), { label: t('metric.help') + ': ' + t(textKey) }));
    return h;
  },

  rerender(focusId) {
    App.render('import', { keepScroll: true, keepFocus: true });
    const n = focusId && el(focusId);
    if (n) n.focus({ preventScroll: true });
  },

  render(host) {
    const s = KeywordsPanel.S();
    host.innerHTML = '';

    /* 1. the idea */
    const card = mk('section', { class: 'card search-card kw-card', id: 'kwIdeaCard' });
    card.appendChild(KeywordsPanel.heading('h2', 'import.keywords.title', 'idea'));
    card.appendChild(mk('p', { class: 'hint' }, esc(t('import.keywords.intro'))));
    const form = mk('form', { class: 'search-form', id: 'kwForm', novalidate: true });
    const field = (cls, labelKey, control, hintKey, forId) => {
      const wrap = mk('div', { class: 'sf-field ' + (cls || '') });
      wrap.appendChild(mk('label', { class: 'sf-label', for: forId || null }, esc(t(labelKey))));
      wrap.appendChild(control);
      if (hintKey) wrap.appendChild(mk('p', { class: 'sf-hint' }, esc(t(hintKey))));
      form.appendChild(wrap);
    };
    const idea = mk('textarea', { id: 'kwIdea', rows: 3, placeholder: t('import.keywords.ideaPlaceholder'), spellcheck: 'true' });
    idea.value = s.idea;
    idea.addEventListener('input', () => { s.idea = idea.value; });
    field('sf-wide', 'import.keywords.ideaLabel', idea, 'import.keywords.ideaHint', 'kwIdea');
    const where = mk('select', { id: 'kwField' });
    ['tak', 'title'].forEach(v => { const o = mk('option', { value: v }, esc(t('import.keywords.fields.' + v))); o.selected = s.field === v; where.appendChild(o); });
    where.addEventListener('change', () => { s.field = where.value; KeywordsPanel.refreshQueries(); });
    field('', 'import.keywords.fieldLabel', where, null, 'kwField');
    const years = mk('div', { class: 'sf-row' });
    const y0 = mk('input', { type: 'number', id: 'kwFrom', min: 1500, max: 2100, step: 1, value: s.yearFrom, placeholder: t('import.search.yearAny'), 'aria-label': t('import.search.yearFrom') });
    const y1 = mk('input', { type: 'number', id: 'kwTo', min: 1500, max: 2100, step: 1, value: s.yearTo, placeholder: t('import.search.yearAny'), 'aria-label': t('import.search.yearTo') });
    y0.addEventListener('input', () => { s.yearFrom = y0.value; KeywordsPanel.refreshQueries(); });
    y1.addEventListener('input', () => { s.yearTo = y1.value; KeywordsPanel.refreshQueries(); });
    years.appendChild(y0); years.appendChild(mk('span', { class: 'sf-dash', 'aria-hidden': 'true' }, '–')); years.appendChild(y1);
    field('', 'import.keywords.years', years, null, 'kwFrom');
    const actions = mk('div', { class: 'sf-actions sf-wide' });
    actions.appendChild(mk('button', { type: 'submit', class: 'btn btn-primary', id: 'kwBuild' }, icon('sparkle') + '<span>' + esc(t(s.blocks ? 'import.keywords.rebuild' : 'import.keywords.build')) + '</span>'));
    form.appendChild(actions);
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!s.idea.trim()) { KeywordsPanel.message(t('import.keywords.noIdea')); idea.focus(); return; }
      if (s.blocks && s.edited && !window.confirm(t('import.keywords.confirmRebuild'))) return;
      KeywordsPanel.build();
      s.edited = false;
      KeywordsPanel.rerender('kwConceptsTitle');
    });
    card.appendChild(form);
    card.appendChild(mk('p', { class: 'search-message note-error', id: 'kwMessage', role: 'status', hidden: true }));
    host.appendChild(card);

    if (s.blocks) {
      KeywordsPanel.renderConcepts(host);
      KeywordsPanel.renderQueries(host);
    }
    KeywordsPanel.renderReminder(host);
  },

  message(text) {
    const box = el('kwMessage');
    if (!box) return;
    box.hidden = !text;
    box.textContent = text || '';
  },

  /* 2. concepts, editable */
  renderConcepts(host) {
    const s = KeywordsPanel.S();
    const card = mk('section', { class: 'card search-card kw-card', id: 'kwConcepts' });
    const h = KeywordsPanel.heading('h2', 'import.keywords.conceptsTitle', 'concepts');
    h.id = 'kwConceptsTitle';
    h.tabIndex = -1;
    card.appendChild(h);
    card.appendChild(mk('p', { class: 'hint' }, esc(t('import.keywords.conceptsHint'))));
    if (s.lang) card.appendChild(mk('p', { class: 'sf-hint', id: 'kwLang' }, esc(t('import.keywords.lang.' + s.lang))));
    const warn = mk('p', { class: 'note-warn', id: 'kwTooMany', hidden: true });
    card.appendChild(warn);
    if (!s.blocks.length) card.appendChild(mk('p', { class: 'note-warn', id: 'kwNone' }, esc(t('import.keywords.noConcepts'))));
    const list = mk('div', { class: 'kw-blocks' });
    s.blocks.forEach((b, i) => {
      const n = i + 1;
      const box = mk('div', { class: 'kw-block' + (b.include === false ? ' off' : ''), id: 'kwBlock-' + i });
      const head = mk('div', { class: 'kw-block-head' });
      const lab = mk('label', { class: 'kw-include' });
      const cb = mk('input', { type: 'checkbox', id: 'kwInc-' + i, 'aria-label': t('import.keywords.include', { n }) });
      cb.checked = b.include !== false;
      cb.addEventListener('change', () => { b.include = cb.checked; box.classList.toggle('off', !cb.checked); KeywordsPanel.refreshQueries(); });
      lab.appendChild(cb);
      lab.appendChild(mk('span', { class: 'kw-num' }, esc(t('import.keywords.concept', { n }))));
      head.appendChild(lab);
      head.appendChild(mk('span', { class: 'kw-kind kw-kind-' + (b.kind || 'topic') }, esc(t('import.keywords.kinds.' + (b.kind || 'topic')))));
      if (b.label) head.appendChild(mk('span', { class: 'kw-label' }, esc(b.label)));
      const tools = mk('div', { class: 'kw-tools' });
      const tool = (id, key, titleKey, ico, disabled, fn) => {
        const btn = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id, title: t(titleKey, { n }), 'aria-label': t(titleKey, { n }), disabled }, icon(ico) + '<span>' + esc(t(key)) + '</span>');
        btn.addEventListener('click', fn);
        tools.appendChild(btn);
      };
      const P = Parsers.lib();
      tool('kwSplit-' + i, 'import.keywords.split', 'import.keywords.splitTitle', 'network', !(b.pieces && b.pieces.length > 1), () => {
        s.blocks.splice(i, 1, ...P.strategySeparate(b));
        KeywordsPanel.rerender('kwTerms-' + i);
      });
      tool('kwMerge-' + i, 'import.keywords.merge', 'import.keywords.mergeTitle', 'flow', i === 0, () => {
        s.blocks.splice(i - 1, 2, P.strategyMerge(s.blocks[i - 1], b));
        s.edited = true;
        KeywordsPanel.rerender('kwTerms-' + (i - 1));
      });
      tool('kwDel-' + i, 'import.keywords.remove', 'import.keywords.removeTitle', 'close', false, () => {
        s.blocks.splice(i, 1);
        s.edited = true;
        KeywordsPanel.rerender(s.blocks.length ? 'kwTerms-' + Math.max(0, i - 1) : 'kwAdd');
      });
      head.appendChild(tools);
      box.appendChild(head);
      const ta = mk('textarea', { id: 'kwTerms-' + i, rows: Math.min(10, Math.max(2, b.terms.length)), spellcheck: 'false', 'aria-label': t('import.keywords.terms', { n }) });
      ta.value = b.terms.join('\n');
      ta.addEventListener('input', () => {
        b.terms = ta.value.split('\n').map(x => x.trim()).filter(Boolean);
        delete b.pieces;
        s.edited = true;
        const split = el('kwSplit-' + i);
        if (split) split.disabled = true;
        KeywordsPanel.refreshQueries();
      });
      box.appendChild(ta);
      if (b.missing) box.appendChild(mk('p', { class: 'sf-hint kw-missing' }, esc(t('import.keywords.missing'))));
      if (b.kind === 'place') box.appendChild(mk('p', { class: 'sf-hint' }, esc(t('import.keywords.placeNote'))));
      list.appendChild(box);
    });
    card.appendChild(list);
    const add = mk('button', { type: 'button', class: 'btn btn-secondary', id: 'kwAdd' }, icon('tag') + '<span>' + esc(t('import.keywords.add')) + '</span>');
    add.addEventListener('click', () => {
      s.blocks.push({ label: '', kind: 'topic', include: true, missing: false, terms: [] });
      s.edited = true;
      KeywordsPanel.rerender('kwTerms-' + (s.blocks.length - 1));
    });
    card.appendChild(add);
    host.appendChild(card);
    KeywordsPanel.updateWarning(card);
  },

  updateWarning(scope) {
    const s = KeywordsPanel.S(), warn = (scope || document).querySelector('#kwTooMany');
    if (!warn || !s.blocks) return;
    const n = s.blocks.filter(b => b.include !== false && b.terms.length).length;
    warn.hidden = n <= KeywordsPanel.MANY;
    warn.textContent = n > KeywordsPanel.MANY ? t('import.keywords.tooMany', { n: fmtInt(n) }) : '';
  },

  /* 3. one string per database */
  renderQueries(host) {
    const card = mk('section', { class: 'card search-card kw-card', id: 'kwQueries' });
    card.appendChild(KeywordsPanel.heading('h2', 'import.keywords.queriesTitle', 'queries'));
    card.appendChild(mk('p', { class: 'hint' }, esc(t('import.keywords.queriesHint'))));
    const grid = mk('div', { class: 'kw-engines' });
    KeywordsPanel.ENGINES.forEach(code => {
      const name = t('import.keywords.engines.' + code + '.name');
      const art = mk('article', { class: 'kw-engine', id: 'kwE-' + code });
      const head = mk('div', { class: 'kw-engine-head' });
      head.appendChild(mk('h3', null, esc(name)));
      const copy = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'kwCopy-' + code, 'aria-label': t('import.keywords.copyLabel', { name }) }, icon('doc') + '<span>' + esc(t('import.keywords.copy')) + '</span>');
      copy.addEventListener('click', async () => {
        const q = KeywordsPanel.query(code);
        if (!q.text) return;
        const done = await KeywordsPanel.copy(q.text);
        toast(done ? t('import.keywords.copied', { name }) : t('import.keywords.copyFailed'), done ? null : 'warn');
      });
      head.appendChild(copy);
      art.appendChild(head);
      art.appendChild(mk('pre', { class: 'kw-query', id: 'kwQ-' + code, tabindex: '0', 'aria-label': t('import.keywords.queryLabel', { name }) }));
      art.appendChild(mk('p', { class: 'sf-hint kw-meta', id: 'kwMeta-' + code }));
      art.appendChild(mk('p', { class: 'sf-hint' }, esc(t('import.keywords.engines.' + code + '.where'))));
      art.appendChild(mk('p', { class: 'sf-hint' }, '<strong>' + esc(t('import.keywords.forApp')) + '</strong> ' + esc(t('import.keywords.engines.' + code + '.export'))));
      if (code === 'openapi') {
        const go = mk('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'kwToCatalogue' }, icon('search') + '<span>' + esc(t('import.keywords.toCatalogue')) + '</span>');
        go.addEventListener('click', () => KeywordsPanel.toCatalogue());
        art.appendChild(go);
      }
      grid.appendChild(art);
    });
    card.appendChild(grid);
    host.appendChild(card);
    KeywordsPanel.refreshQueries(card);
  },

  /* scope: the element that holds the cards (the document once they are on the page) */
  refreshQueries(scope) {
    const root = scope || document, find = id => root.querySelector('#' + id);
    KeywordsPanel.updateWarning(root);
    KeywordsPanel.ENGINES.forEach(code => {
      const pre = find('kwQ-' + code), meta = find('kwMeta-' + code), copy = find('kwCopy-' + code);
      if (!pre) return;
      const q = KeywordsPanel.query(code);
      pre.textContent = q.text || t('import.keywords.queryEmpty');
      pre.classList.toggle('empty', !q.text);
      if (copy) copy.disabled = !q.text;
      const notes = [];
      if (q.text) notes.push(tp('import.keywords.chars', q.text.length));
      if (q.dropped > 0) notes.push(tp('import.keywords.dropped', q.dropped));
      if (meta) meta.textContent = notes.join(' · ');
      const go = code === 'openapi' && find('kwToCatalogue');
      if (go) go.disabled = !q.text;
    });
  },

  async copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall back below */ }
    const ta = mk('textarea', { class: 'sr-only', 'aria-hidden': 'true' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  },

  /* the string and the years go to the search in the open catalogue (the person runs it there) */
  toCatalogue() {
    const s = KeywordsPanel.S(), q = KeywordsPanel.query('openapi');
    if (!q.text) return;
    SearchPanel.form = Object.assign(SearchPanel.form || SearchPanel.defaults(), { terms: q.text, yearFrom: s.yearFrom, yearTo: s.yearTo });
    SearchPanel.result = null;
    ImportModule.tab = 'search';
    KeywordsPanel.rerender('searchTerms');
  },

  /* 4. several files, several formats */
  renderReminder(host) {
    const note = mk('aside', { class: 'card search-note kw-reminder', id: 'kwReminder' });
    note.appendChild(mk('h3', null, icon('inbox') + '<span>' + esc(t('import.keywords.reminderTitle')) + '</span>'));
    note.appendChild(mk('p', null, esc(t('import.keywords.reminder'))));
    const list = mk('ul', { class: 'kw-formats', 'aria-label': t('import.keywords.formatsLabel') });
    ['csv', 'txt', 'ris', 'bib', 'nbib', 'sheet'].forEach(k => list.appendChild(mk('li', null, esc(t('import.keywords.formats.' + k)))));
    note.appendChild(list);
    const go = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'kwGoFiles' }, icon('upload') + '<span>' + esc(t('import.keywords.goFiles')) + '</span>');
    go.addEventListener('click', () => { ImportModule.tab = 'files'; KeywordsPanel.rerender('importChoose'); });
    note.appendChild(go);
    host.appendChild(note);
  },
};

window.KeywordsPanel = KeywordsPanel;
