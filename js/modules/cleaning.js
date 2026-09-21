/* SciMetricsPro — Cleaning & filters module (screens; the logic is in js/cleaning/). */
'use strict';

const CleaningModule = {
  tab: 'summary',
  TABS: ['summary', 'duplicates', 'authors', 'places', 'terms', 'filters'],
  ui: { dupSearch: '', dupShown: 25, authorSearch: '', authorShown: 30, sourceSearch: '', canonical: {} },

  P() { return Parsers.lib(); },
  s() { return Pipeline.init(); },

  /* files by id, named without database names (this is not the import screen) */
  fileLabel(fileId) {
    const f = state.files.find(x => x.id === fileId);
    if (!f) return '';
    return f.search ? t('cleaning.searchLabel', { query: f.search.query.terms }) : f.name;
  },

  docTypeLabel(code) { return I18N.has('cleaning.docTypes.' + code) ? t('cleaning.docTypes.' + code) : code; },
  languageLabel(code) {
    if (code === 'none') return t('cleaning.filters.noLanguage');
    try { return new Intl.DisplayNames([I18N.lang], { type: 'language' }).of(code) || code; } catch (e) { return code; }
  },
  countryLabel(code) {
    try { return new Intl.DisplayNames([I18N.lang], { type: 'region' }).of(code) || code; } catch (e) { return code; }
  },

  /* re-render keeping the scroll and the focused control */
  rerender() {
    if (state.route !== 'cleaning' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('cleaning', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  render(body) {
    body.innerHTML = '';
    if (!state.clean) {
      body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…'));
      return;
    }
    const page = mk('div', { class: 'cleaning-page' });
    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('cleaning.tabsLabel') });
    CleaningModule.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'ctab-' + id, 'aria-controls': 'cpanel', 'aria-selected': String(CleaningModule.tab === id), tabindex: CleaningModule.tab === id ? '0' : '-1' },
        esc(t('cleaning.tabs.' + id)) + (id === 'filters' && CleaningModule.P().filtersActive(CleaningModule.s().filters) ? ' <span class="tab-dot" aria-hidden="true"></span>' : ''));
      b.addEventListener('click', () => { CleaningModule.tab = id; CleaningModule.rerender(); const nb = el('ctab-' + id); if (nb) nb.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = CleaningModule.TABS.indexOf(CleaningModule.tab);
        CleaningModule.tab = CleaningModule.TABS[(i + (e.key === 'ArrowRight' ? 1 : CleaningModule.TABS.length - 1)) % CleaningModule.TABS.length];
        CleaningModule.rerender();
        const nb = el('ctab-' + CleaningModule.tab); if (nb) nb.focus();
      });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel', role: 'tabpanel', id: 'cpanel', 'aria-labelledby': 'ctab-' + CleaningModule.tab });
    CleaningModule['render_' + CleaningModule.tab](panel);
    page.appendChild(panel);
    body.appendChild(page);
  },

  /* ---------------- summary ---------------- */
  render_summary(panel) {
    const st = Pipeline.stats;
    const filtered = CleaningModule.P().filtersActive(CleaningModule.s().filters);
    MetricCard.grid(panel, [
      { label: t('cleaning.summary.identified'), value: st.identified, sub: t('cleaning.summary.identifiedSub'), icon: 'upload', tone: 'primary' },
      { label: t('cleaning.summary.duplicates'), value: st.duplicatesRemoved, sub: tp('cleaning.summary.inGroups', st.mergedGroups), icon: 'filter', tone: 'accent' },
      { label: t('cleaning.summary.unique'), value: st.unique, sub: t('cleaning.summary.uniqueSub'), icon: 'doc', tone: 'teal' },
      { label: t('cleaning.summary.shown'), value: st.shown, sub: t(filtered ? 'cleaning.summary.shownSubFiltered' : 'cleaning.summary.shownSub'), icon: 'gauge', tone: 'rose' },
    ]).id = 'cleanMetrics';
    panel.appendChild(mk('p', { class: 'note-info' }, icon('sparkle') + '<span>' + esc(t('cleaning.summary.note')) + '</span>'));

    const card = mk('section', { class: 'card clean-card' });
    card.appendChild(mk('h2', null, esc(t('cleaning.summary.byFile'))));
    const table = mk('table', { class: 'dt-table', id: 'cleanByFile' });
    table.appendChild(mk('thead', null, `<tr><th scope="col"><span class="th-plain">${esc(t('cleaning.summary.file'))}</span></th><th scope="col" class="num"><span class="th-plain">${esc(t('cleaning.summary.records'))}</span></th></tr>`));
    const tb = mk('tbody');
    for (const f of state.files) tb.appendChild(mk('tr', null, `<td>${esc(CleaningModule.fileLabel(f.id))}</td><td class="num">${esc(fmtInt(f.count))}</td>`));
    table.appendChild(tb);
    const scroller = mk('div', { class: 'dt-scroll' }); scroller.appendChild(table);
    card.appendChild(scroller);
    panel.appendChild(card);
    panel.appendChild(CleaningModule.termFieldCard());
  },

  termFieldCard() {
    const card = mk('section', { class: 'card clean-card' });
    card.appendChild(mk('h2', null, esc(t('cleaning.summary.termField'))));
    card.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.summary.termFieldHint'))));
    const note = Pipeline.termFieldNote;
    if (note && note.to === CleaningModule.s().termField) card.appendChild(mk('p', { class: 'note-info', id: 'termFieldAuto', role: 'status' }, icon('info') + '<span>' + esc(Pipeline.termFieldNoteText()) + '</span>'));
    const group = mk('div', { class: 'sf-seg sf-seg-wrap', role: 'radiogroup', id: 'termField', 'aria-label': t('cleaning.summary.termField') });
    CleaningModule.P().TERM_FIELDS.forEach(f => {
      const lab = mk('label', { class: 'sf-seg-item' });
      const rb = mk('input', { type: 'radio', name: 'termField', value: f, id: 'termField-' + f });
      rb.checked = CleaningModule.s().termField === f;
      rb.addEventListener('change', () => { if (rb.checked) Pipeline.update({ termField: f }); });
      lab.appendChild(rb);
      lab.appendChild(mk('span', null, esc(t('cleaning.termFields.' + f))));
      group.appendChild(lab);
    });
    card.appendChild(group);
    return card;
  },

  /* ---------------- duplicates ---------------- */
  render_duplicates(panel) {
    const s = CleaningModule.s();
    const card = mk('section', { class: 'card clean-card' });
    card.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.dup.intro'))));
    const row = mk('div', { class: 'sf-row clean-controls' });
    const lab = mk('label', { class: 'sf-label', for: 'dupThreshold' }, esc(t('cleaning.dup.threshold')));
    const thr = mk('input', { type: 'number', id: 'dupThreshold', min: 0.8, max: 1, step: 0.01, value: s.threshold });
    thr.addEventListener('change', () => {
      const v = Math.min(1, Math.max(0.8, +thr.value || 0.95));
      Pipeline.update({ threshold: Math.round(v * 100) / 100 });
    });
    row.appendChild(lab); row.appendChild(thr);
    row.appendChild(mk('span', { class: 'sf-hint' }, esc(t('cleaning.dup.thresholdHint'))));
    card.appendChild(row);
    const groups = Pipeline.dup.groups;
    card.appendChild(mk('p', { class: 'dup-count', id: 'dupCount' }, esc(groups.length ? tp('cleaning.dup.summary', groups.length) + ' · ' + tp('cleaning.dup.mergedNow', Pipeline.stats.mergedGroups) : t('cleaning.dup.none'))));
    panel.appendChild(card);
    if (!groups.length) return;

    const search = mk('input', { type: 'search', id: 'dupSearch', placeholder: t('cleaning.dup.search'), 'aria-label': t('cleaning.dup.search'), value: CleaningModule.ui.dupSearch });
    search.addEventListener('change', () => { CleaningModule.ui.dupSearch = search.value; CleaningModule.ui.dupShown = 25; CleaningModule.rerender(); });
    panel.appendChild(search);

    const byId = new Map((state.records || []).map(r => [r.id, r]));
    const mergedByKey = new Map((state.clean || []).filter(r => r.dupGroup).map(r => [r.dupGroup, r]));
    const q = fold(CleaningModule.ui.dupSearch).trim();
    const shown = groups.filter(g => !q || g.ids.some(id => byId.has(id) && fold(byId.get(id).title).includes(q)));
    const excluded = new Set(s.excluded);
    const list = mk('div', { class: 'dup-list', id: 'dupList' });
    shown.slice(0, CleaningModule.ui.dupShown).forEach(g => {
      const item = mk('article', { class: 'dup-group card' + (excluded.has(g.key) ? ' kept-apart' : ''), 'data-key': g.key });
      const head = mk('div', { class: 'dup-head' });
      const cbl = mk('label', { class: 'sf-check', title: t('cleaning.dup.mergeTitle') });
      const cb = mk('input', { type: 'checkbox', class: 'dup-merge' });
      cb.checked = !excluded.has(g.key);
      cb.addEventListener('change', () => Pipeline.setMerged(g.key, cb.checked));
      cbl.appendChild(cb); cbl.appendChild(mk('span', null, esc(t('cleaning.dup.merge'))));
      head.appendChild(cbl);
      const reason = g.reason === 'doi' ? t('cleaning.dup.reasonDoi') : g.reason === 'mixed' ? t('cleaning.dup.reasonMixed') : t('cleaning.dup.reasonTitle', { pct: fmtNum(g.similarity * 100, 1) });
      head.appendChild(mk('span', { class: 'chip' }, esc(reason)));
      if (g.doiConflict) head.appendChild(mk('span', { class: 'chip warn dup-conflict', title: t('cleaning.dup.doiConflictHint') }, esc(t('cleaning.dup.doiConflict'))));
      item.appendChild(head);
      const ul = mk('ul', { class: 'dup-members' });
      for (const id of g.ids) {
        const r = byId.get(id);
        if (!r) continue;
        const meta = [CleaningModule.fileLabel(r.fileId), r.year != null ? String(r.year) : '', r.doi || t('cleaning.dup.noDoi'), r.timesCited != null ? tp('cleaning.dup.citations', r.timesCited) : ''].filter(Boolean);
        ul.appendChild(mk('li', null, `<span class="dup-title">${esc(r.title)}</span><span class="dup-meta">${meta.map(esc).join(' · ')}</span>`));
      }
      item.appendChild(ul);
      const m = mergedByKey.get(g.key);
      if (m && Object.keys(m.mergeLog).length) {
        const parts = Object.entries(m.mergeLog).map(([field, id]) => t('cleaning.dup.fields.' + field, {}) + ' (' + CleaningModule.fileLabel((byId.get(id) || {}).fileId) + ')');
        item.appendChild(mk('p', { class: 'dup-origin' }, esc(t('cleaning.dup.fieldsFrom', { list: parts.join('; ') }))));
      }
      list.appendChild(item);
    });
    panel.appendChild(list);
    if (shown.length > CleaningModule.ui.dupShown) {
      const more = mk('button', { type: 'button', class: 'btn btn-secondary', id: 'dupMore' }, esc(t('cleaning.dup.showMore', { n: fmtInt(Math.min(25, shown.length - CleaningModule.ui.dupShown)) })));
      more.addEventListener('click', () => { CleaningModule.ui.dupShown += 25; CleaningModule.rerender(); });
      panel.appendChild(more);
    }
  },

  /* ---------------- authors ---------------- */
  render_authors(panel) {
    const card = mk('section', { class: 'card clean-card' });
    card.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.authors.intro'))));
    const groups = Pipeline.authorGroups();
    card.appendChild(mk('p', { class: 'dup-count', id: 'authorCount' }, esc(groups.length ? tp('cleaning.authors.count', groups.length) : t('cleaning.authors.none'))));
    panel.appendChild(card);
    if (!groups.length) return;
    const search = mk('input', { type: 'search', id: 'authorSearch', placeholder: t('cleaning.authors.search'), 'aria-label': t('cleaning.authors.search'), value: CleaningModule.ui.authorSearch });
    search.addEventListener('change', () => { CleaningModule.ui.authorSearch = search.value; CleaningModule.ui.authorShown = 30; CleaningModule.rerender(); });
    panel.appendChild(search);
    const q = fold(CleaningModule.ui.authorSearch).replace(/[^a-z]/g, '');
    const shown = groups.filter(g => !q || g.surname.includes(q));
    const list = mk('div', { class: 'dup-list', id: 'authorList' });
    shown.slice(0, CleaningModule.ui.authorShown).forEach(g => {
      const item = mk('article', { class: 'dup-group card author-group status-' + g.status, 'data-gid': g.gid });
      const head = mk('div', { class: 'dup-head' });
      head.appendChild(mk('span', { class: 'chip' + (g.status === 'open' ? ' warn' : '') }, esc(t('cleaning.authors.' + (g.status === 'joined' ? 'joined' : g.status === 'kept' ? 'keptLabel' : 'open')))));
      head.appendChild(mk('span', { class: 'sf-hint' }, esc(tp('cleaning.authors.docs', g.docs))));
      item.appendChild(head);
      const ul = mk('ul', { class: 'dup-members' });
      for (const v of g.variants) {
        const extra = [tp('cleaning.authors.docs', v.docs)];
        if (v.shared != null) extra.push(tp('cleaning.authors.shared', v.shared));
        ul.appendChild(mk('li', null, `<span class="dup-title">${esc(v.label)}</span><span class="dup-meta">${extra.map(esc).join(' · ')}</span>`));
      }
      item.appendChild(ul);
      const actions = mk('div', { class: 'sf-actions' });
      if (g.status === 'open') {
        const sel = mk('select', { 'aria-label': t('cleaning.authors.joinAs'), class: 'author-canonical' });
        g.variants.forEach(v => sel.appendChild(mk('option', { value: v.key }, esc(v.label))));
        if (CleaningModule.ui.canonical[g.gid]) sel.value = CleaningModule.ui.canonical[g.gid];
        sel.addEventListener('change', () => { CleaningModule.ui.canonical[g.gid] = sel.value; });
        actions.appendChild(mk('span', { class: 'sf-hint' }, esc(t('cleaning.authors.joinAs'))));
        actions.appendChild(sel);
        const join = mk('button', { type: 'button', class: 'btn btn-primary btn-sm author-join' }, esc(t('cleaning.authors.join')));
        join.addEventListener('click', () => Pipeline.joinAuthors(g, sel.value));
        const keep = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm author-keep' }, esc(t('cleaning.authors.keep')));
        keep.addEventListener('click', () => Pipeline.keepAuthors(g));
        actions.appendChild(join); actions.appendChild(keep);
      } else {
        const undo = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm author-undo' }, esc(t('cleaning.authors.undo')));
        undo.addEventListener('click', () => Pipeline.resetAuthors(g));
        actions.appendChild(undo);
      }
      item.appendChild(actions);
      list.appendChild(item);
    });
    panel.appendChild(list);
    if (shown.length > CleaningModule.ui.authorShown) {
      const more = mk('button', { type: 'button', class: 'btn btn-secondary' }, esc(t('cleaning.dup.showMore', { n: fmtInt(Math.min(30, shown.length - CleaningModule.ui.authorShown)) })));
      more.addEventListener('click', () => { CleaningModule.ui.authorShown += 30; CleaningModule.rerender(); });
      panel.appendChild(more);
    }
  },

  /* a small editable table of pairs */
  pairEditor(o) {
    const card = mk('section', { class: 'card clean-card', id: o.id });
    card.appendChild(mk('h2', null, esc(o.title)));
    if (o.hint) card.appendChild(mk('p', { class: 'hint' }, esc(o.hint)));
    const form = mk('form', { class: 'pair-form' });
    const a = mk('input', { type: 'text', class: 'pair-from', placeholder: o.fromLabel, 'aria-label': o.fromLabel, value: o.prefill || '' });
    let b;
    if (o.countries) {
      b = mk('select', { class: 'pair-to', 'aria-label': o.toLabel });
      b.appendChild(mk('option', { value: '' }, esc(t('cleaning.places.pickCountry'))));
      const P = CleaningModule.P();
      P.COUNTRY_CODES.map(c => [c, CleaningModule.countryLabel(c)]).sort((x, y) => x[1].localeCompare(y[1], I18N.lang)).forEach(([c, name]) => b.appendChild(mk('option', { value: c }, esc(name))));
    } else {
      b = mk('input', { type: 'text', class: 'pair-to', placeholder: o.toLabel, 'aria-label': o.toLabel });
    }
    const add = mk('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, esc(t('cleaning.places.add')));
    form.appendChild(a); form.appendChild(mk('span', { class: 'pair-arrow', 'aria-hidden': 'true' }, '→')); form.appendChild(b); form.appendChild(add);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const from = a.value.trim(), to = b.value.trim();
      if (!from || !to) return;
      o.onAdd(from, to);
    });
    card.appendChild(form);
    if (o.extra) card.appendChild(o.extra);
    if (!o.rows.length) card.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.places.noRows'))));
    else {
      const ul = mk('ul', { class: 'pair-list' });
      o.rows.forEach((r, i) => {
        const li = mk('li', null, `<span>${esc(r.left)}</span><span class="pair-arrow" aria-hidden="true">→</span><span>${esc(r.right)}</span>`);
        const rm = mk('button', { type: 'button', class: 'icon-btn', 'aria-label': t('cleaning.places.remove') + ': ' + r.left, title: t('cleaning.places.remove') }, icon('close'));
        rm.addEventListener('click', () => o.onRemove(i));
        li.appendChild(rm);
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }
    return card;
  },

  /* ---------------- institutions and countries ---------------- */
  render_places(panel) {
    const s = CleaningModule.s(), P = CleaningModule.P();
    const recs = state.clean;
    /* the same table as in Authors (one row per P.institutionKey), so both screens give the same counts */
    const institutions = P.institutionsTable(recs).rows;
    const grid = mk('div', { class: 'clean-grid' });
    const instCard = mk('section', { class: 'card clean-card' });
    instCard.appendChild(mk('h2', null, esc(t('cleaning.places.institutions'))));
    instCard.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.places.institutionsHint'))));
    const instTable = DataTable.create({
      title: t('cleaning.places.institutions'), fileName: 'instituciones', pageSize: 10, sort: { key: 'docs', dir: 'desc' },
      columns: [{ key: 'name', label: t('cleaning.places.institution'), cls: 'col-mid', clamp: true }, { key: 'country', label: t('cleaning.places.country') }, { key: 'docs', label: t('cleaning.places.documents'), type: 'int' }],
      rows: institutions.filter(r => r.documents).map(r => ({ name: r.name, docs: r.documents, country: r.country ? CleaningModule.countryLabel(r.country) : '' })),
    });
    instTable.el.id = 'instTable';
    instCard.appendChild(instTable.el);
    grid.appendChild(instCard);

    const countryCount = new Map();
    /* countries of the authors and of the affiliations, as in Authors and in the collaboration network */
    for (const r of recs) for (const c of P.recordCountries(r)) countryCount.set(c, (countryCount.get(c) || 0) + 1);
    const ctyCard = mk('section', { class: 'card clean-card' });
    ctyCard.appendChild(mk('h2', null, esc(t('cleaning.places.countries'))));
    const ctyTable = DataTable.create({
      title: t('cleaning.places.countries'), fileName: 'paises', pageSize: 10, sort: { key: 'docs', dir: 'desc' },
      columns: [{ key: 'name', label: t('cleaning.places.country') }, { key: 'code', label: t('cleaning.places.iso') }, { key: 'docs', label: t('cleaning.places.documents'), type: 'int' }],
      rows: [...countryCount.entries()].map(([code, docs]) => ({ code, name: CleaningModule.countryLabel(code), docs })),
    });
    ctyTable.el.id = 'countryTable';
    ctyCard.appendChild(ctyTable.el);
    grid.appendChild(ctyCard);
    panel.appendChild(grid);

    panel.appendChild(CleaningModule.pairEditor({
      id: 'instAliases', title: t('cleaning.places.instAliases'), hint: t('cleaning.places.instAliasesHint'),
      fromLabel: t('cleaning.places.from'), toLabel: t('cleaning.places.to'),
      rows: s.institutionAliases.map(a => ({ left: a.from, right: a.to })),
      onAdd: (from, to) => Pipeline.update({ institutionAliases: s.institutionAliases.filter(a => P.fold(a.from) !== P.fold(from)).concat([{ from, to }]) }),
      onRemove: i => Pipeline.update({ institutionAliases: s.institutionAliases.filter((a, j) => j !== i) }),
    }));

    /* affiliations without a recognised country, to help write aliases */
    const aliasMap = P.countryAliasMap(s.countryAliases);
    const unmatched = new Map();
    for (const r of recs) for (const af of r.affiliations) {
      if (P.countryOf(af, aliasMap)) continue;
      const tail = af.split(',').map(x => x.trim()).filter(Boolean).pop() || af;
      unmatched.set(tail, (unmatched.get(tail) || 0) + 1);
    }
    const extra = mk('div', { class: 'unmatched' });
    extra.appendChild(mk('h3', null, esc(t('cleaning.places.unmatched'))));
    const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (!top.length) extra.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.places.allMatched'))));
    else {
      extra.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.places.unmatchedHint'))));
      const ul = mk('ul', { class: 'pair-list' });
      top.forEach(([text, n]) => {
        const li = mk('li', null, `<span>${esc(text)}</span><span class="dup-meta">${esc(fmtInt(n))}</span>`);
        const assign = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, esc(t('cleaning.places.assign')));
        assign.addEventListener('click', () => { const input = el('countryAliases').querySelector('.pair-from'); input.value = text; el('countryAliases').querySelector('.pair-to').focus(); });
        li.appendChild(assign);
        ul.appendChild(li);
      });
      extra.appendChild(ul);
    }
    panel.appendChild(CleaningModule.pairEditor({
      id: 'countryAliases', title: t('cleaning.places.countryAliases'), hint: t('cleaning.places.countryAliasesHint'), countries: true,
      fromLabel: t('cleaning.places.text'), toLabel: t('cleaning.places.country'),
      rows: s.countryAliases.map(a => ({ left: a.text, right: CleaningModule.countryLabel(a.code) })),
      onAdd: (text, code) => Pipeline.update({ countryAliases: s.countryAliases.filter(a => P.fold(a.text) !== P.fold(text)).concat([{ text, code }]) }),
      onRemove: i => Pipeline.update({ countryAliases: s.countryAliases.filter((a, j) => j !== i) }),
      extra,
    }));
  },

  /* ---------------- keywords ---------------- */
  render_terms(panel) {
    const s = CleaningModule.s(), P = CleaningModule.P();
    panel.appendChild(CleaningModule.termFieldCard());
    const counts = P.termCounts(state.filtered, s.termField, Pipeline.dict());
    const grid = mk('div', { class: 'clean-grid' });
    const countsCard = mk('section', { class: 'card clean-card' });
    countsCard.appendChild(mk('h2', null, esc(t('cleaning.terms.counts'))));
    const dt = DataTable.create({
      title: t('cleaning.terms.counts'), fileName: 'terminos', pageSize: 15, sort: { key: 'docs', dir: 'desc' },
      columns: [{ key: 'term', label: t('cleaning.terms.term') }, { key: 'docs', label: t('cleaning.terms.documents'), type: 'int' }],
      rows: counts,
    });
    dt.el.id = 'termCounts';
    countsCard.appendChild(dt.el);
    grid.appendChild(countsCard);

    /* suggestions */
    const sugCard = mk('section', { class: 'card clean-card' });
    sugCard.appendChild(mk('h2', null, esc(t('cleaning.terms.suggestions'))));
    sugCard.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.terms.suggestionsHint'))));
    const sugs = P.synonymSuggestions(counts).slice(0, 25);
    if (!sugs.length) sugCard.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.terms.noSuggestions'))));
    else {
      const ul = mk('ul', { class: 'pair-list', id: 'synSuggestions' });
      sugs.forEach(g => {
        const li = mk('li', null, `<span>${g.variants.map(v => esc(v.term)).join(', ')}</span><span class="pair-arrow" aria-hidden="true">→</span><strong>${esc(g.preferred)}</strong>`);
        const acc = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm syn-accept', title: t('cleaning.terms.accept') }, icon('sparkle') + '<span>' + esc(t('cleaning.terms.add')) + '</span>');
        acc.addEventListener('click', () => {
          const rows = s.synonyms.slice();
          for (const v of g.variants) if (!rows.some(r => P.fold(r.from) === v.key)) rows.push({ from: v.term, to: g.preferred });
          Pipeline.update({ synonyms: rows });
        });
        li.appendChild(acc);
        ul.appendChild(li);
      });
      sugCard.appendChild(ul);
    }
    grid.appendChild(sugCard);
    panel.appendChild(grid);

    /* synonym table with CSV import/export */
    const tools = mk('div', { class: 'sf-actions pair-tools' });
    const fileIn = mk('input', { type: 'file', accept: '.csv,.txt,.tsv', class: 'sr-only', id: 'synImport', tabindex: '-1', 'aria-hidden': 'true' });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0]; fileIn.value = '';
      if (!f) return;
      const rows = P.synonymsFromCsv(P.decode(await f.arrayBuffer()).text);
      if (!rows.length) { toast(t('cleaning.terms.importEmpty'), 'warn'); return; }
      const merged = s.synonyms.filter(r => !rows.some(x => P.fold(x.from) === P.fold(r.from))).concat(rows);
      await Pipeline.update({ synonyms: merged });
      toast(tp('cleaning.terms.imported', rows.length));
    });
    const imp = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, icon('upload') + '<span>' + esc(t('cleaning.terms.import')) + '</span>');
    imp.addEventListener('click', () => fileIn.click());
    const exp = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', disabled: !s.synonyms.length }, icon('download') + '<span>' + esc(t('cleaning.terms.export')) + '</span>');
    exp.addEventListener('click', () => download('﻿' + P.synonymsToCsv(s.synonyms), 'sinonimos.csv', 'text/csv;charset=utf-8'));
    const clr = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: !s.synonyms.length }, esc(t('cleaning.terms.clear')));
    clr.addEventListener('click', () => { if (window.confirm(t('cleaning.terms.confirmClear'))) Pipeline.update({ synonyms: [] }); });
    tools.appendChild(imp); tools.appendChild(exp); tools.appendChild(clr); tools.appendChild(fileIn);
    panel.appendChild(CleaningModule.pairEditor({
      id: 'synonyms', title: t('cleaning.terms.synonyms'), hint: t('cleaning.terms.synonymsHint'),
      fromLabel: t('cleaning.terms.from'), toLabel: t('cleaning.terms.to'),
      rows: s.synonyms.map(r => ({ left: r.from, right: r.to })),
      onAdd: (from, to) => Pipeline.update({ synonyms: s.synonyms.filter(r => P.fold(r.from) !== P.fold(from)).concat([{ from, to }]) }),
      onRemove: i => Pipeline.update({ synonyms: s.synonyms.filter((r, j) => j !== i) }),
      extra: tools,
    }));

    /* stop words */
    const stopCard = mk('section', { class: 'card clean-card', id: 'stopwords' });
    stopCard.appendChild(mk('h2', null, esc(t('cleaning.terms.stopwords'))));
    stopCard.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.terms.stopwordsHint'))));
    const areas = {};
    const sgrid = mk('div', { class: 'clean-grid' });
    ['es', 'en'].forEach(lang => {
      const wrap = mk('div', { class: 'sf-field' });
      wrap.appendChild(mk('label', { class: 'sf-label', for: 'stop-' + lang }, esc(t('cleaning.terms.' + lang))));
      areas[lang] = mk('textarea', { id: 'stop-' + lang, rows: 6, class: 'stop-area' });
      areas[lang].value = s.stopwords[lang].join(', ');
      wrap.appendChild(areas[lang]);
      sgrid.appendChild(wrap);
    });
    stopCard.appendChild(sgrid);
    const sact = mk('div', { class: 'sf-actions' });
    const save = mk('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'stopSave' }, esc(t('cleaning.terms.save')));
    const parse = v => [...new Set(v.split(/[,\n;]/).map(w => w.trim()).filter(Boolean))];
    save.addEventListener('click', async () => { await Pipeline.update({ stopwords: { es: parse(areas.es.value), en: parse(areas.en.value) } }); toast(t('cleaning.terms.saved')); });
    const restore = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, esc(t('cleaning.terms.restore')));
    restore.addEventListener('click', () => Pipeline.update({ stopwords: { es: P.STOPWORDS.es.slice(), en: P.STOPWORDS.en.slice() } }));
    sact.appendChild(save); sact.appendChild(restore);
    stopCard.appendChild(sact);
    panel.appendChild(stopCard);
  },

  /* ---------------- filters ---------------- */
  render_filters(panel) {
    const s = CleaningModule.s(), P = CleaningModule.P();
    const f = s.filters;
    const opts = P.filterOptions(state.clean);
    const setF = patch => Pipeline.update({ filters: Object.assign({}, f, patch) });
    const card = mk('section', { class: 'card clean-card' });
    const head = mk('div', { class: 'section-head' });
    head.appendChild(mk('p', { class: 'filter-result', id: 'filterResult', 'aria-live': 'polite' }, esc(tp('cleaning.filters.result', state.filtered.length, { docs: tp('cleaning.filters.resultDocs', state.clean.length) }))));
    const clear = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'filterClear', disabled: !P.filtersActive(f) }, icon('close') + '<span>' + esc(t('cleaning.filters.clear')) + '</span>');
    clear.addEventListener('click', () => Pipeline.update({ filters: P.emptyFilters() }));
    head.appendChild(clear);
    card.appendChild(head);
    card.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.filters.intro'))));

    const form = mk('div', { class: 'search-form' });
    const field = (cls, label, control, forId) => {
      const w = mk('div', { class: 'sf-field ' + (cls || '') });
      w.appendChild(mk('label', { class: 'sf-label', for: forId || null }, esc(label)));
      w.appendChild(control);
      form.appendChild(w);
    };
    const years = mk('div', { class: 'sf-row' });
    const y0 = mk('input', { type: 'number', id: 'fYearFrom', value: f.yearFrom, placeholder: opts.yearMin != null ? String(opts.yearMin) : '', 'aria-label': t('cleaning.filters.from') });
    const y1 = mk('input', { type: 'number', id: 'fYearTo', value: f.yearTo, placeholder: opts.yearMax != null ? String(opts.yearMax) : '', 'aria-label': t('cleaning.filters.to') });
    y0.addEventListener('change', () => setF({ yearFrom: y0.value === '' ? '' : String(Math.round(+y0.value)) }));
    y1.addEventListener('change', () => setF({ yearTo: y1.value === '' ? '' : String(Math.round(+y1.value)) }));
    years.appendChild(y0); years.appendChild(mk('span', { class: 'sf-dash', 'aria-hidden': 'true' }, '–')); years.appendChild(y1);
    field('', t('cleaning.filters.years'), years, 'fYearFrom');
    const minC = mk('input', { type: 'number', id: 'fMinCitations', min: 0, value: f.minCitations, placeholder: '0' });
    minC.addEventListener('change', () => setF({ minCitations: minC.value === '' ? '' : String(Math.max(0, Math.round(+minC.value))) }));
    field('', t('cleaning.filters.minCitations'), minC, 'fMinCitations');

    const chips = (key, options, labelOf, id, limit) => {
      const box = mk('div', { class: 'sf-checks', id, role: 'group' });
      const chosen = new Set(f[key]);
      const list = options.slice(0, limit || options.length);
      for (const o of options) if (chosen.has(o.value) && !list.includes(o)) list.push(o);
      if (!list.length) box.appendChild(mk('span', { class: 'sf-hint' }, esc(t('cleaning.filters.none'))));
      list.forEach(o => {
        const lab = mk('label', { class: 'sf-check' });
        const cb = mk('input', { type: 'checkbox', value: o.value });
        cb.checked = chosen.has(o.value);
        cb.addEventListener('change', () => { const next = new Set(f[key]); if (cb.checked) next.add(o.value); else next.delete(o.value); setF({ [key]: [...next] }); });
        lab.appendChild(cb);
        lab.appendChild(mk('span', null, esc(labelOf(o.value)) + ' <small>' + esc(fmtInt(o.n)) + '</small>'));
        box.appendChild(lab);
      });
      return box;
    };
    field('sf-wide', t('cleaning.filters.docTypes'), chips('docTypes', opts.docTypes, v => CleaningModule.docTypeLabel(v), 'fDocTypes'));
    field('sf-wide', t('cleaning.filters.languages'), chips('languages', opts.languages, v => CleaningModule.languageLabel(v), 'fLanguages'));

    const srcWrap = mk('div', { class: 'sf-key' });
    const srcSearch = mk('input', { type: 'search', id: 'fSourceSearch', placeholder: t('cleaning.filters.sourcesSearch'), 'aria-label': t('cleaning.filters.sourcesSearch'), value: CleaningModule.ui.sourceSearch });
    srcSearch.addEventListener('change', () => { CleaningModule.ui.sourceSearch = srcSearch.value; CleaningModule.rerender(); });
    srcWrap.appendChild(srcSearch);
    const q = fold(CleaningModule.ui.sourceSearch).trim();
    const srcOpts = opts.sources.filter(o => !q || fold(o.label).includes(q));
    const srcLabel = new Map(opts.sources.map(o => [o.value, o.label]));
    srcWrap.appendChild(chips('sources', srcOpts, v => srcLabel.get(v) || v, 'fSources', 30));
    if (srcOpts.length > 30) srcWrap.appendChild(mk('p', { class: 'sf-hint' }, esc(t('cleaning.filters.moreSources', { n: 30, m: fmtInt(srcOpts.length) }))));
    field('sf-wide', t('cleaning.filters.sources'), srcWrap, 'fSourceSearch');
    field('sf-wide', t('cleaning.filters.areas'), chips('areas', opts.areas, v => v, 'fAreas', 30));
    card.appendChild(form);
    panel.appendChild(card);
  },
};

Modules.define('cleaning', { render: body => CleaningModule.render(body) });
on('cleanchange', () => CleaningModule.rerender());
window.CleaningModule = CleaningModule;
