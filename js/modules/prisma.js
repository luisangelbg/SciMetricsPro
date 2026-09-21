/* SciMetricsPro — systematic review (PRISMA 2020): screening tool with one card per document, decisions with reasons,
   the flow diagram whose numbers follow the decisions, the option to analyse only the included documents in every module
   and the export of the decisions to a spreadsheet (js/metrics/prisma.js; decisions kept by Pipeline). */
'use strict';

const PrismaModule = {
  tab: 'screening',
  TABS: ['screening', 'diagram'],
  VIEWS: ['pending', 'all', 'include', 'exclude', 'maybe'],
  view: 'pending',
  index: 0,
  advance: true,
  reason: '',
  figs: {},
  cc: {},

  P() { return Parsers.lib(); },
  S() { return Pipeline.prisma(); },

  reset() { const M = PrismaModule; M.tab = 'screening'; M.view = 'pending'; M.index = 0; M.advance = true; M.reason = ''; M.figs = {}; M.cc = {}; },

  rerender() {
    if (state.route !== 'prisma' || !Layout.view) return;
    const active = document.activeElement && document.activeElement.id;
    App.render('prisma', { keepScroll: true, keepFocus: true });
    if (active) { const n = el(active); if (n) n.focus({ preventScroll: true }); }
  },

  help(key, title) {
    const base = 'prisma.help.' + key;
    const where = [];
    for (let i = 1; I18N.has(base + '.s' + i); i++) where.push([t(base + '.s' + i), t(base + '.m' + i)]);
    return {
      title, text: t(base + '.text'),
      formula: I18N.has(base + '.formula') ? t(base + '.formula') : '',
      where,
      interpretation: I18N.has(base + '.interpretation') ? t(base + '.interpretation') : '',
      refs: [t('refs.page2021')],
    };
  },

  note(host, id, text, warn, iconName) { return NetworkScreen.note(host, id, text, warn, iconName); },

  chart(host, id, o, keep) {
    const prev = PrismaModule.figs[id];
    const defaults = Object.assign({}, o.defaults);
    if (prev) (keep || []).forEach(k => { if (prev[k] !== undefined) defaults[k] = prev[k]; });
    const cc = ChartCard.mount(host, Object.assign({}, o, { id, defaults }));
    if (cc.fig) PrismaModule.figs[id] = cc.fig.cfg;
    PrismaModule.cc[id] = cc;
    return cc;
  },

  cards(id, list) {
    const grid = MetricCard.grid(null, list);
    grid.id = id;
    grid.classList.add('net-stats');
    [...grid.children].forEach((card, i) => { card.dataset.key = list[i].key; });
    return grid;
  },

  /* reasons with their text: typed by the user, or the default text in the current language */
  reasons() { return PrismaModule.S().reasons.map(r => ({ id: r.id, label: r.label || t('prisma.reasons.' + r.id) })); },
  reasonLabel(id) {
    if (!id) return t('prisma.reasonScreening');
    if (id === PrismaModule.P().PRISMA_NOT_RETRIEVED) return t('prisma.reasonNotRetrieved');
    const r = PrismaModule.reasons().find(x => x.id === id);
    return r ? r.label : id;
  },
  statusLabel(status) { return status ? t('prisma.status.' + status) : t('prisma.status.pending'); },

  /* the documents of the current view, in the order of the collection */
  list() {
    const M = PrismaModule, P = M.P(), d = M.S().decisions;
    const docs = Pipeline.screening();
    if (M.view === 'all') return docs;
    return docs.filter(r => {
      const x = d[P.prismaKey(r)];
      const status = x && x.status;
      return M.view === 'pending' ? !status || status === 'maybe' : status === M.view;
    });
  },

  flow() {
    const M = PrismaModule, P = M.P(), s = M.S();
    const stats = Pipeline.stats || {};
    const files = state.files.filter(f => f.count);
    const base = f => f.name.replace(/\.[a-z0-9]{2,5}$/i, '');
    /* the file name without its extension, unless two files would get the same name */
    const sources = files.map(f => ({ label: s.sourceLabels[f.name] || (files.filter(g => base(g) === base(f)).length > 1 ? f.name : base(f)), n: f.count, file: f }));
    return P.prismaFlow({
      sources, registers: s.manual.registers, duplicates: stats.duplicatesRemoved, automation: s.manual.automation,
      filtered: stats.filteredOut, other: s.manual.other,
      keys: Pipeline.screening().map(r => P.prismaKey(r)), decisions: s.decisions, reasons: M.reasons(),
    });
  },

  render(body) {
    const M = PrismaModule;
    body.innerHTML = '';
    if (!state.clean) { body.appendChild(mk('p', { class: 'hint' }, esc(t('cleaning.detecting')) + '…')); return; }
    const page = mk('div', { class: 'authors-page prisma-page' });
    body.appendChild(page);
    page.appendChild(M.onlyIncludedCard());
    const tabs = mk('div', { class: 'tabs', role: 'tablist', 'aria-label': t('prisma.tabsLabel') });
    M.TABS.forEach(id => {
      const b = mk('button', { type: 'button', role: 'tab', class: 'tab', id: 'ptab-' + id, 'aria-controls': 'ppanel', 'aria-selected': String(M.tab === id), tabindex: M.tab === id ? '0' : '-1' }, esc(t('prisma.tabs.' + id)));
      b.addEventListener('click', () => { M.tab = id; M.rerender(); const nb = el('ptab-' + id); if (nb) nb.focus(); });
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    showSelectedTab(tabs);
    const panel = mk('div', { class: 'tab-panel src-panel', role: 'tabpanel', id: 'ppanel', 'aria-labelledby': 'ptab-' + M.tab });
    page.appendChild(panel);
    M['render_' + M.tab](panel);
  },

  /* "analyse only the included documents": every module reads Pipeline.records() */
  includedCount() {
    const M = PrismaModule, P = M.P(), d = M.S().decisions;
    return Pipeline.screening().filter(r => { const x = d[P.prismaKey(r)]; return x && x.status === 'include'; }).length;
  },

  onlyIncludedCard() {
    const M = PrismaModule;
    const included = M.includedCount();
    const card = mk('section', { class: 'card pr-only', id: 'prOnlyCard' });
    const lab = mk('label', { class: 'pr-only-label', for: 'prOnly' });
    const input = mk('input', { type: 'checkbox', id: 'prOnly' });
    input.checked = Pipeline.onlyIncluded();
    /* the count is read again when the box changes: decisions made since the card was drawn count too */
    input.addEventListener('change', () => { Pipeline.setOnlyIncluded(input.checked); toast(input.checked ? tp('prisma.only.on', M.includedCount()) : t('prisma.only.off')); });
    lab.appendChild(input);
    lab.appendChild(mk('span', null, '<strong>' + esc(t('prisma.only.label')) + '</strong> ' + esc(tp('prisma.only.count', included))));
    card.appendChild(lab);
    card.appendChild(mk('p', { class: 'hint' }, esc(t(Pipeline.onlyIncluded() ? 'prisma.only.activeHint' : 'prisma.only.hint'))));
    if (Pipeline.onlyIncluded() && !included) card.appendChild(mk('p', { class: 'note-warn', id: 'prOnlyEmpty' }, icon('help') + '<span>' + esc(t('prisma.only.empty')) + '</span>'));
    return card;
  },

  /* ================= screening ================= */
  render_screening(panel) {
    const M = PrismaModule, s = M.S();
    const bar = mk('div', { class: 'card src-toolbar pr-toolbar' });
    const terms = mk('label', { class: 'src-control pr-terms', for: 'psTerms' });
    terms.appendChild(mk('span', { class: 'sf-label' }, esc(t('prisma.screen.terms'))));
    const ti = mk('input', { type: 'text', id: 'psTerms', value: s.terms, placeholder: t('prisma.screen.termsPlaceholder') });
    ti.addEventListener('change', () => { s.terms = ti.value; Pipeline.savePrisma(); M.renderCard(); });
    terms.appendChild(ti);
    bar.appendChild(terms);
    bar.appendChild(SourcesModule.select('psView', t('prisma.screen.view'), M.view, M.VIEWS.map(v => [v, t('prisma.views.' + v)]), v => { M.view = v; M.index = 0; M.renderScreening(); }));
    const adv = mk('label', { class: 'src-control', for: 'psAdvance' });
    const ai = mk('input', { type: 'checkbox', id: 'psAdvance' });
    ai.checked = M.advance;
    ai.addEventListener('change', () => { M.advance = ai.checked; });
    adv.appendChild(ai);
    adv.appendChild(mk('span', null, esc(t('prisma.screen.advance'))));
    bar.appendChild(adv);
    const exp = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'psExport' }, icon('table') + '<span>' + esc(t('prisma.screen.export')) + '</span>');
    exp.addEventListener('click', () => M.exportDecisions());
    bar.appendChild(exp);
    const clear = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'psClearAll' }, esc(t('prisma.screen.clearAll')));
    clear.addEventListener('click', () => {
      if (!window.confirm(t('prisma.screen.confirmClear'))) return;
      const P = M.P();
      Pipeline.screening().forEach(r => { delete s.decisions[P.prismaKey(r)]; });
      Pipeline.savePrisma();
      if (Pipeline.onlyIncluded()) Pipeline.refilter(); else M.renderScreening();
    });
    bar.appendChild(clear);
    panel.appendChild(bar);
    panel.appendChild(mk('div', { id: 'psBody', class: 'pr-body' }));
    M.renderScreening();
  },

  renderScreening() {
    const M = PrismaModule;
    const host = el('psBody');
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(mk('div', { id: 'psProgress', class: 'card pr-progress' }));
    host.appendChild(mk('section', { id: 'psCard', class: 'card pr-card', 'aria-live': 'polite' }));
    host.appendChild(mk('p', { class: 'hint pr-keys', id: 'psKeys' }, esc(t('prisma.screen.keys'))));
    M.renderCard();
  },

  renderProgress() {
    const M = PrismaModule, F = M.flow();
    const host = el('psProgress');
    if (!host) return;
    const excludedAll = F.excluded + F.notRetrieved + F.reportsExcludedTotal;
    const decided = F.included + excludedAll;
    const pct = F.documents ? decided / F.documents : 0;
    host.innerHTML = '';
    const barBox = mk('div', { class: 'pr-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': F.documents, 'aria-valuenow': decided, 'aria-label': t('prisma.screen.progressLabel') });
    const seg = (cls, n) => { if (n > 0) barBox.appendChild(mk('span', { class: 'pr-seg ' + cls, style: 'width:' + (100 * n / Math.max(1, F.documents)).toFixed(2) + '%' })); };
    seg('pr-include', F.included); seg('pr-exclude', excludedAll); seg('pr-maybe', F.maybe);
    host.appendChild(barBox);
    host.appendChild(mk('p', { class: 'pr-counts', id: 'psCounts' }, esc(tp('prisma.screen.counts', F.documents, {
      decided: fmtInt(decided), pct: fmtPct(pct, 0), include: fmtInt(F.included), exclude: fmtInt(excludedAll), maybe: fmtInt(F.maybe), pending: fmtInt(F.undecided),
    }))));
  },

  highlight(parent, text, terms) {
    for (const piece of PrismaModule.P().highlightPieces(text, terms)) {
      if (piece.mark) parent.appendChild(mk('mark', null, esc(piece.text)));
      else parent.appendChild(document.createTextNode(piece.text));
    }
  },

  renderCard() {
    const M = PrismaModule, P = M.P();
    M.renderProgress();
    const host = el('psCard');
    if (!host) return;
    host.innerHTML = '';
    const list = M.list();
    if (!Pipeline.screening().length) { host.appendChild(mk('p', { class: 'hint', id: 'psNone' }, esc(t('prisma.screen.none')))); return; }
    if (!list.length) { host.appendChild(mk('p', { class: 'note-info', id: 'psEmptyView' }, icon('sparkle') + '<span>' + esc(t(M.view === 'pending' ? 'prisma.screen.allDone' : 'prisma.screen.emptyView')) + '</span>')); return; }
    if (M.index >= list.length) M.index = list.length - 1;
    if (M.index < 0) M.index = 0;
    const r = list[M.index];
    const d = Pipeline.decisionOf(r);
    const terms = P.highlightTerms(M.S().terms);
    host.dataset.key = P.prismaKey(r);
    const head = mk('header', { class: 'pr-card-head' });
    head.appendChild(mk('span', { class: 'pr-pos', id: 'psPos' }, esc(t('prisma.screen.position', { k: fmtInt(M.index + 1), n: fmtInt(list.length), view: t('prisma.views.' + M.view).toLowerCase() }))));
    head.appendChild(mk('span', { class: 'pr-status pr-status-' + (d ? d.status : 'pending'), id: 'psStatus' }, esc(M.statusLabel(d && d.status) + (d && d.status === 'exclude' ? ' · ' + M.reasonLabel(d.reason) : ''))));
    host.appendChild(head);
    const title = mk('h2', { class: 'pr-title', id: 'psTitle' });
    M.highlight(title, P.clean(r.title) || t('prisma.screen.noTitle'), terms);
    host.appendChild(title);
    const meta = mk('p', { class: 'pr-meta', id: 'psMeta' });
    const authors = r.authors.map(a => P.clean(a.label || a.short || a.full)).filter(Boolean);
    meta.appendChild(mk('span', { class: 'pr-authors' }, esc(authors.slice(0, 12).join('; ') + (authors.length > 12 ? ' … (' + authors.length + ')' : ''))));
    const src = [r.year, P.clean(r.sourceName || r.sourceTitle)].filter(v => v != null && v !== '').join(' · ');
    if (src) meta.appendChild(mk('span', { class: 'pr-source' }, esc(src)));
    if (r.doi) { const a = mk('a', { href: 'https://doi.org/' + encodeURI(r.doi), target: '_blank', rel: 'noopener noreferrer', class: 'in-doi' }, esc(r.doi)); meta.appendChild(a); }
    host.appendChild(meta);
    const abs = mk('p', { class: 'pr-abstract', id: 'psAbstract' });
    if (r.abstract) M.highlight(abs, P.clean(r.abstract), terms); else abs.appendChild(mk('em', null, esc(t('prisma.screen.noAbstract'))));
    host.appendChild(abs);
    const kws = [...new Set((r.authorKeywords || []).concat(r.indexKeywords || []).map(P.clean).filter(Boolean))];
    if (kws.length) {
      const kw = mk('p', { class: 'pr-keywords', id: 'psKeywords' });
      kw.appendChild(mk('strong', null, esc(t('prisma.screen.keywords')) + ' '));
      M.highlight(kw, kws.join('; '), terms);
      host.appendChild(kw);
    }
    /* decisions */
    const actions = mk('div', { class: 'pr-actions' });
    const btn = (id, status, cls, key) => {
      const b = mk('button', { type: 'button', class: 'btn ' + cls, id, 'aria-pressed': String(!!d && d.status === status), 'aria-keyshortcuts': key }, esc(t('prisma.actions.' + status)) + ' <kbd>' + key + '</kbd>');
      b.addEventListener('click', () => M.decide(status));
      actions.appendChild(b);
    };
    btn('psInclude', 'include', 'btn-primary pr-btn-include', 'I');
    btn('psExclude', 'exclude', 'btn-secondary pr-btn-exclude', 'E');
    btn('psMaybe', 'maybe', 'btn-secondary pr-btn-maybe', 'D');
    const undo = mk('button', { type: 'button', class: 'btn btn-ghost', id: 'psUndo', disabled: !d, 'aria-keyshortcuts': 'U' }, esc(t('prisma.actions.undo')) + ' <kbd>U</kbd>');
    undo.addEventListener('click', () => M.decide(null));
    actions.appendChild(undo);
    host.appendChild(actions);
    const reasonRow = mk('label', { class: 'src-control pr-reason', for: 'psReason' });
    reasonRow.appendChild(mk('span', { class: 'sf-label' }, esc(t('prisma.screen.reason'))));
    const sel = mk('select', { id: 'psReason' });
    const current = d && d.status === 'exclude' ? d.reason : M.reason;
    [['', t('prisma.reasonScreening')], [P.PRISMA_NOT_RETRIEVED, t('prisma.reasonNotRetrieved')]].concat(M.reasons().map(x => [x.id, x.label])).forEach(([v, text]) => {
      const o = mk('option', { value: v }, esc(text));
      if (v === (current || '')) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      M.reason = sel.value;
      if (Pipeline.decisionOf(r) && Pipeline.decisionOf(r).status === 'exclude') { Pipeline.decide(r, 'exclude', sel.value); M.afterDecision(r, false); }
    });
    reasonRow.appendChild(sel);
    host.appendChild(reasonRow);
    const nav = mk('div', { class: 'pr-nav' });
    const prev = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'psPrev', disabled: M.index === 0 }, '← ' + esc(t('prisma.actions.prev')));
    prev.addEventListener('click', () => M.move(-1));
    const next = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'psNext', disabled: M.index >= list.length - 1 }, esc(t('prisma.actions.next')) + ' →');
    next.addEventListener('click', () => M.move(1));
    nav.appendChild(prev); nav.appendChild(next);
    host.appendChild(nav);
  },

  current() { const list = PrismaModule.list(); return list[Math.min(PrismaModule.index, list.length - 1)] || null; },

  move(step) {
    const M = PrismaModule, n = M.list().length;
    M.index = Math.max(0, Math.min(n - 1, M.index + step));
    M.renderCard();
  },

  decide(status) {
    const M = PrismaModule;
    const r = M.current();
    if (!r) return;
    const reason = status === 'exclude' ? (el('psReason') ? el('psReason').value : M.reason) : '';
    Pipeline.decide(r, status, reason);
    M.afterDecision(r, !!status);
  },

  /* after a decision: in the pending view the document leaves the list (the next one takes its place); otherwise move on */
  afterDecision(r, moveOn) {
    const M = PrismaModule;
    const list = M.list();
    const still = list.indexOf(r);
    if (still >= 0) { M.index = still; if (moveOn && M.advance && M.index < list.length - 1) M.index++; }
    if (state.route === 'prisma' && el('psCard')) M.renderCard();
  },

  /* keys I, E, D, U and the arrows while the screening tab is open (not while typing) */
  onKey(e) {
    const M = PrismaModule;
    if (state.route !== 'prisma' || M.tab !== 'screening' || !el('psCard') || e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target;
    if (tg && (tg.closest && tg.closest('input, textarea, select, [contenteditable="true"], .fig-editor'))) return;
    const k = e.key;
    if (k === 'ArrowRight') { M.move(1); e.preventDefault(); }
    else if (k === 'ArrowLeft') { M.move(-1); e.preventDefault(); }
    else if (k === 'i' || k === 'I') { M.decide('include'); e.preventDefault(); }
    else if (k === 'e' || k === 'E') { M.decide('exclude'); e.preventDefault(); }
    else if (k === 'd' || k === 'D') { M.decide('maybe'); e.preventDefault(); }
    else if (k === 'u' || k === 'U') { M.decide(null); e.preventDefault(); }
  },

  exportDecisions() {
    const M = PrismaModule, P = M.P(), F = M.flow();
    const rows = Pipeline.screening().map((r, i) => {
      const d = Pipeline.decisionOf(r);
      return {
        n: i + 1, key: P.prismaKey(r), title: P.clean(r.title), authors: r.authors.map(a => P.clean(a.label || a.short || a.full)).join('; '), year: r.year,
        source: P.clean(r.sourceName || r.sourceTitle), doi: r.doi || '', decision: M.statusLabel(d && d.status),
        stage: !d || d.status !== 'exclude' ? '' : d.reason ? t('prisma.stage.fulltext') : t('prisma.stage.screening'),
        reason: d && d.status === 'exclude' ? M.reasonLabel(d.reason) : '', time: d ? d.time : '',
      };
    });
    const c = 'prisma.col.';
    Exporter.xlsx([
      { name: t('prisma.sheets.decisions'), columns: ['n', 'key', 'title', 'authors', 'year', 'source', 'doi', 'decision', 'stage', 'reason', 'time'].map(k => ({ key: k, label: t(c + k) })), rows },
      { name: t('prisma.sheets.diagram'), columns: [{ key: 'box', label: t(c + 'box') }, { key: 'n', label: t(c + 'count') }], rows: M.diagramRows(F) },
    ], t('prisma.screen.exportFile'));
  },

  /* ================= flow diagram ================= */
  diagramRows(F) {
    const b = 'prisma.boxes.';
    return [
      { box: t(b + 'identified'), n: F.identified },
    ].concat(F.databases.map(s => ({ box: '  ' + s.label, n: s.n }))).concat([
      { box: t(b + 'registers'), n: F.registers },
      { box: t(b + 'duplicates'), n: F.duplicates },
      { box: t(b + 'automation'), n: F.automation },
      { box: t(b + 'other'), n: F.other },
      { box: t(b + 'screened'), n: F.screened },
      { box: t(b + 'excluded'), n: F.excluded },
      { box: t(b + 'sought'), n: F.sought },
      { box: t(b + 'notRetrieved'), n: F.notRetrieved },
      { box: t(b + 'assessed'), n: F.assessed },
      { box: t(b + 'reportsExcluded'), n: F.reportsExcludedTotal },
    ]).concat(F.reportsExcluded.map(x => ({ box: '  ' + x.label, n: x.n }))).concat([
      { box: t(b + 'included'), n: F.included },
      { box: t(b + 'reports'), n: F.included },
      { box: t(b + 'pending'), n: F.pending },
    ]);
  },

  flowBoxes(F, showPending) {
    const b = 'prisma.boxes.', nn = n => ' (n = ' + fmtInt(n) + ')';
    return {
      identified: [{ text: t(b + 'identifiedFrom'), bold: true }, { text: t(b + 'databases') + nn(F.identified - F.registers), key: 'databases' }]
        .concat(F.databases.map(s => ({ text: s.label + nn(s.n), indent: true }))).concat([{ text: t(b + 'registers') + nn(F.registers), key: 'registers' }]),
      removed: [{ text: t(b + 'removedBefore'), bold: true }, { text: t(b + 'duplicates') + nn(F.duplicates) }, { text: t(b + 'automation') + nn(F.automation) }, { text: t(b + 'other') + nn(F.other) }],
      screened: [{ text: t(b + 'screened') + nn(F.screened) }],
      excluded: [{ text: t(b + 'excluded') + nn(F.excluded) }],
      sought: [{ text: t(b + 'sought') + nn(F.sought) }],
      notRetrieved: [{ text: t(b + 'notRetrieved') + nn(F.notRetrieved) }],
      assessed: [{ text: t(b + 'assessed') + nn(F.assessed) }],
      reportsExcluded: [{ text: t(b + 'reportsExcluded') + (F.reportsExcluded.length ? '' : nn(0)), bold: !!F.reportsExcluded.length }].concat(F.reportsExcluded.map(x => ({ text: x.label + nn(x.n), indent: true }))),
      included: [{ text: t(b + 'included') + nn(F.included) }, { text: t(b + 'reports') + nn(F.included) }].concat(showPending && F.pending ? [{ text: t(b + 'pending') + nn(F.pending) }] : []),
    };
  },

  render_diagram(panel) {
    const M = PrismaModule, s = M.S(), F = M.flow();
    const layout = mk('div', { class: 'net-layout' });
    panel.appendChild(layout);
    const values = Object.assign({}, s.manual);
    const files = state.files.filter(f => f.count);
    files.forEach(f => { values['src' + f.id] = s.sourceLabels[f.name] || ''; });
    layout.appendChild(NetworkPanel.create({
      id: 'prParams', values, title: t('network.params.titleDiagram'),
      groups: [
        { key: 'sources', title: t('prisma.params.sources'), help: M.help('sources', t('prisma.params.sources')), controls: files.map(f => ({ key: 'src' + f.id, type: 'text', label: t('prisma.params.sourceLabel', { file: f.name, n: fmtInt(f.count) }), placeholder: f.name.replace(/\.[a-z0-9]{2,5}$/i, '') })) },
        { key: 'manual', title: t('prisma.params.manual'), help: M.help('manual', t('prisma.params.manual')), controls: [
          { key: 'registers', type: 'number', label: t('prisma.params.registers'), min: 0, max: 1e7, step: 1 },
          { key: 'automation', type: 'number', label: t('prisma.params.automation'), min: 0, max: 1e7, step: 1 },
          { key: 'other', type: 'number', label: t('prisma.params.other'), min: 0, max: 1e7, step: 1 },
        ] },
      ],
      onChange: (k, v) => {
        if (k.startsWith('src')) { const file = files.find(f => 'src' + f.id === k); if (file) { if (v) s.sourceLabels[file.name] = v; else delete s.sourceLabels[file.name]; } }
        else s.manual[k] = Math.max(0, Math.round(+v || 0));
        Pipeline.savePrisma();
        M.rerender();
      },
    }));
    const main = mk('div', { class: 'net-main' });
    layout.appendChild(main);
    main.appendChild(mk('p', { class: 'hint', id: 'prHint' }, esc(t('prisma.diagram.hint'))));
    if (F.pending) M.note(main, 'prPending', tp('prisma.diagram.pending', F.pending, { maybe: fmtInt(F.maybe), undecided: fmtInt(F.undecided) }), false, 'clock');
    if (F.screened !== F.documents) M.note(main, 'prMismatch', t('prisma.diagram.mismatch', { screened: fmtInt(F.screened), docs: fmtInt(F.documents) }), true);
    const c = 'prisma.cards.';
    main.appendChild(M.cards('prStats', [
      { key: 'identified', label: t(c + 'identified'), value: fmtInt(F.identified), sub: tp(c + 'identifiedSub', F.databases.length), icon: 'upload', tone: 'primary', help: M.help('identification', t(c + 'identified')) },
      { key: 'removed', label: t(c + 'removed'), value: fmtInt(F.removed), sub: tp(c + 'removedSub', F.duplicates, { other: fmtInt(F.automation + F.other) }), icon: 'filter', tone: 'rose', help: M.help('removed', t(c + 'removed')) },
      { key: 'screened', label: t(c + 'screened'), value: fmtInt(F.screened), sub: tp(c + 'screenedSub', F.excluded), icon: 'doc', tone: 'teal', help: M.help('screening', t(c + 'screened')) },
      { key: 'assessed', label: t(c + 'assessed'), value: fmtInt(F.assessed), sub: tp(c + 'assessedSub', F.reportsExcludedTotal) + ' · ' + tp(c + 'notRetrievedSub', F.notRetrieved), icon: 'journal', tone: 'accent', help: M.help('eligibility', t(c + 'assessed')) },
      { key: 'included', label: t(c + 'included'), value: fmtInt(F.included), sub: tp(c + 'pendingSub', F.pending), icon: 'sparkle', tone: 'primary', help: M.help('included', t(c + 'included')) },
    ]));
    const title = t('prisma.diagram.title');
    const boxes = cfg => M.flowBoxes(F, cfg.showPending !== false);
    const cc = M.chart(main, 'prFlow', {
      title, subtitle: t('prisma.diagram.sub'), help: M.help('diagram', title),
      /* two columns of boxes with their text wrapped: narrower than this, the boxes cannot hold their lines, so a one-column
         figure keeps this layout and prints smaller */
      width: 1000, height: 300, minLayout: 600, fileName: slug(t('prisma.diagram.file')),
      data: () => ({ columns: [{ key: 'box', label: t('prisma.col.box') }, { key: 'n', label: t('prisma.col.count') }], rows: M.diagramRows(F) }),
      controls: Charts.prismaFlowControls().concat([{ key: 'showPending', label: t('charts.prismaShowPending'), type: 'checkbox' }]),
      defaults: { title: '', subtitle: '', header: t('prisma.boxes.header'), headerFill: '#f2c14e', phaseFill: '#a9c7e8', boxFill: '#ffffff', boxStroke: '#2b3a55', textSize: 14, showPending: true },
      render: cfg => Charts.prismaFlow(cfg, { header: t('prisma.boxes.header'), phases: { identification: t('prisma.phases.identification'), screening: t('prisma.phases.screening'), included: t('prisma.phases.included') }, boxes: boxes(cfg) }),
    }, ['header', 'headerFill', 'phaseFill', 'boxFill', 'boxStroke', 'textSize', 'showPending', 'width']);
    void cc;
    M.renderReasons(main);
  },

  /* the list of reasons for excluding full texts: rename, add, delete the unused ones */
  renderReasons(main) {
    const M = PrismaModule, s = M.S(), F = M.flow();
    const card = mk('section', { class: 'card src-card pr-reasons', id: 'prReasons' });
    const h = mk('h2', null, esc(t('prisma.reasonsEditor.title')));
    h.appendChild(HelpPopover.button(M.help('reasons', t('prisma.reasonsEditor.title')), { label: t('metric.help') + ': ' + t('prisma.reasonsEditor.title') }));
    card.appendChild(h);
    card.appendChild(mk('p', { class: 'hint' }, esc(t('prisma.reasonsEditor.hint'))));
    const used = new Map(F.reportsExcluded.map(x => [x.id, x.n]));
    const list = mk('ul', { class: 'pr-reason-list' });
    M.reasons().forEach((r, i) => {
      const li = mk('li');
      const input = mk('input', { type: 'text', id: 'prReason-' + r.id, value: r.label, 'aria-label': t('prisma.reasonsEditor.rename') });
      input.addEventListener('change', () => { const v = input.value.trim(); s.reasons[i].label = v || null; Pipeline.savePrisma(); M.rerender(); });
      li.appendChild(input);
      li.appendChild(mk('span', { class: 'muted' }, esc(tp('prisma.reasonsEditor.used', used.get(r.id) || 0))));
      const del = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'prReasonDel-' + r.id, disabled: used.has(r.id) || Object.values(s.decisions).some(d => d.reason === r.id), title: t('prisma.reasonsEditor.deleteTitle') }, esc(t('prisma.reasonsEditor.delete')));
      del.addEventListener('click', () => { s.reasons.splice(i, 1); Pipeline.savePrisma(); M.rerender(); });
      li.appendChild(del);
      list.appendChild(li);
    });
    card.appendChild(list);
    const addRow = mk('div', { class: 'pr-reason-add' });
    const input = mk('input', { type: 'text', id: 'prReasonNew', placeholder: t('prisma.reasonsEditor.newPlaceholder'), 'aria-label': t('prisma.reasonsEditor.newPlaceholder') });
    const add = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'prReasonAdd' }, esc(t('prisma.reasonsEditor.add')));
    const doAdd = () => {
      const v = input.value.trim();
      if (!v) return;
      let id = 'c' + Date.now().toString(36);
      while (s.reasons.some(x => x.id === id)) id += 'x';
      s.reasons.push({ id, label: v });
      Pipeline.savePrisma();
      M.rerender();
    };
    add.addEventListener('click', doAdd);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    addRow.appendChild(input); addRow.appendChild(add);
    card.appendChild(addRow);
    main.appendChild(card);
  },
};

Modules.define('prisma', { render: body => PrismaModule.render(body) });
on('cleanchange', () => PrismaModule.rerender());
on('prismachange', () => {
  if (state.route !== 'prisma') return;
  /* the number of included documents next to «Analyse only the included» follows every decision */
  const only = el('prOnlyCard');
  if (only) only.replaceWith(PrismaModule.onlyIncludedCard());
  if (PrismaModule.tab === 'screening' && el('psCard')) PrismaModule.renderCard();
});
document.addEventListener('keydown', e => PrismaModule.onKey(e));
window.PrismaModule = PrismaModule;
