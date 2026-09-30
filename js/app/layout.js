/* SciMetricsPro — application shell: header, sidebar, main area and footer.
   Everything is generated here from the module registry and the dictionaries,
   so index.html holds no visible text. */
'use strict';

const Layout = {
  root: null,
  view: null,

  build(root) {
    Layout.root = root;
    root.innerHTML = '';

    root.appendChild(mk('a', { class: 'skip-link', href: '#main', 'data-i18n': 'a11y.skip',
      onclick: e => { e.preventDefault(); el('main').focus(); } }));

    /* ---------- header ----------
       Common LABG Suite bar, in its fixed order: brand · (this app's own tools)
       · LABG Suite · ES | EN · theme · keyboard shortcuts (?). */
    const bar = mk('header', { class: 'appbar topbar' });
    const barInner = mk('div', { class: 'topbar-inner' });
    const row = mk('div', { class: 'topbar-row' });
    barInner.appendChild(row);
    bar.appendChild(barInner);
    const menuBtn = mk('button', { type: 'button', class: 'icon-btn menu-btn', id: 'menuBtn', 'aria-controls': 'sidebar', 'aria-expanded': 'false' },
      icon('menu') + '<span class="menu-label" data-i18n="header.menu"></span>');
    menuBtn.addEventListener('click', () => Layout.toggleMenu());
    row.appendChild(menuBtn);

    const brand = mk('a', { class: 'brand', href: '#/home', 'data-i18n-attr': 'aria-label:header.home' });
    brand.appendChild(Layout.logo('brand-logo'));
    brand.appendChild(mk('span', { class: 'brand-text' },
      '<span class="brand-name">SciMetrics<span class="brand-pro">Pro</span></span>' +
      '<span class="brand-sub brand-tag"><span aria-hidden="true">· </span><span data-i18n="app.tagline"></span></span>'));
    row.appendChild(brand);

    const tools = mk('div', { class: 'top-tools appbar-tools' });
    /* "N of M documents": what the analyses use; a click opens the filters */
    const counter = mk('button', { type: 'button', class: 'doc-counter', id: 'docCounter', hidden: true });
    counter.addEventListener('click', () => { if (Pipeline.onlyIncluded()) { App.go('prisma'); return; } if (window.CleaningModule) CleaningModule.tab = 'filters'; App.go('cleaning'); });
    tools.appendChild(counter);
    /* project: open a saved work or save the current one */
    const proj = mk('div', { class: 'project-tools', role: 'group', 'data-i18n-attr': 'aria-label:project.group' });
    const fileInput = mk('input', { type: 'file', id: 'projFile', accept: '.json,.smp,.gz,application/json,application/gzip', hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
    fileInput.addEventListener('change', async () => { const f = fileInput.files[0]; fileInput.value = ''; if (f) await Project.open(f); });
    const openBtn = mk('button', { type: 'button', class: 'icon-btn tool-btn', id: 'projOpen', 'data-i18n-attr': 'title:project.openTitle;aria-label:project.openTitle' }, icon('folder') + '<span class="tool-label" data-i18n="project.open"></span>');
    openBtn.addEventListener('click', () => fileInput.click());
    const saveBtn = mk('button', { type: 'button', class: 'icon-btn tool-btn', id: 'projSave', 'data-i18n-attr': 'title:project.saveTitle;aria-label:project.saveTitle' }, icon('save') + '<span class="tool-label" data-i18n="project.save"></span>');
    saveBtn.addEventListener('click', () => Project.save());
    proj.appendChild(fileInput); proj.appendChild(openBtn); proj.appendChild(saveBtn);
    tools.appendChild(proj);
    /* back to the portal of the suite */
    const suite = mk('a', { class: 'suite-link', href: window.LABG ? LABG.SUITE_URL : 'https://luisangelbg.github.io/',
      'data-i18n-attr': 'title:header.suiteTitle;aria-label:header.suiteTitle' },
      (window.LABG && LABG.isotipo ? LABG.isotipo('labg-iso', 'labgIsoH') : icon('grid')) + '<span class="suite-text" data-i18n="header.suite"></span>');
    tools.appendChild(suite);
    const lang = mk('div', { class: 'seg lang-seg lang-switch', role: 'group', 'data-i18n-attr': 'aria-label:header.language' });
    [['es', 'ES', 'header.langEs'], ['en', 'EN', 'header.langEn']].forEach(([code, label, key]) => {
      const b = mk('button', { type: 'button', lang: code, 'data-lang': code, 'data-i18n-attr': 'title:' + key, 'aria-pressed': 'false' }, label);
      b.addEventListener('click', () => I18N.setLang(code));
      lang.appendChild(b);
    });
    tools.appendChild(lang);
    const themeBtn = mk('button', { type: 'button', class: 'icon-btn theme-btn', id: 'themeBtn' });
    themeBtn.addEventListener('click', () => Theme.toggle());
    tools.appendChild(themeBtn);
    const helpBtn = mk('button', { type: 'button', class: 'icon-btn help-keys-btn', id: 'helpBtn',
      'data-i18n-attr': 'title:header.shortcutsTitle;aria-label:header.shortcuts' }, icon('help'));
    helpBtn.addEventListener('click', () => { if (window.LABG) LABG.showShortcuts(); });
    if (!window.LABG) helpBtn.hidden = true;
    tools.appendChild(helpBtn);
    row.appendChild(tools);
    root.appendChild(bar);

    /* ---------- sidebar + main ----------
       The modules stay in the grouped side menu (a drop-down below 900 px): it is
       the structure the tests, the guided tour and the manual describe. It takes
       the states of the suite's block bar: current (aria-current), reviewed (✓),
       needs data (dashed circle), Alt+← / Alt+→ and a Previous / Next footer. */
    const shell = mk('div', { class: 'shell' });
    const side = mk('nav', { class: 'sidebar stepper', id: 'sidebar', 'data-i18n-attr': 'aria-label:nav.label' });
    side.appendChild(mk('div', { class: 'sidebar-inner', id: 'sidebarInner' }));
    shell.appendChild(side);
    const scrim = mk('div', { class: 'nav-scrim', 'aria-hidden': 'true' });
    scrim.addEventListener('click', () => Layout.closeMenu());
    shell.appendChild(scrim);
    const main = mk('main', { id: 'main', tabindex: '-1' });
    const view = mk('div', { class: 'view', id: 'view' });
    main.appendChild(view);
    /* Previous / Next at the end of every section (outside #view, so a module
       that redraws its page does not remove it) */
    const pager = mk('nav', { class: 'step-footer view-pager no-print', id: 'stepFooter', 'data-i18n-attr': 'aria-label:nav.pager', hidden: true });
    pager.addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (b && !b.disabled) App.go(b.dataset.go); });
    main.appendChild(pager);
    shell.appendChild(main);
    root.appendChild(shell);
    Layout.view = view;

    /* ---------- footer ---------- */
    const foot = mk('footer', { class: 'appfoot' });
    const inner = mk('div', { class: 'foot-inner' });
    const fb = mk('div', { class: 'foot-brand' });
    fb.appendChild(Layout.logo('brand-logo'));
    fb.appendChild(mk('div', null, '<strong>SciMetricsPro</strong><span data-i18n="footer.tagline"></span>'));
    inner.appendChild(fb);
    inner.appendChild(mk('div', { class: 'foot-privacy' }, icon('lock') + '<span data-i18n="footer.privacy"></span>'));
    inner.appendChild(mk('div', { class: 'foot-meta', id: 'footMeta' }));
    const aboutLink = mk('a', { class: 'foot-about', href: '#/about', 'data-i18n': 'nav.about' });
    inner.appendChild(aboutLink);
    foot.appendChild(inner);
    root.appendChild(foot);

    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { Layout.closeMenu(); el('menuBtn').focus(); } });
    window.addEventListener('resize', () => { if (!Layout.isNarrow()) Layout.closeMenu(); });

    Layout.refresh();
  },

  /* logo image; if the file is missing, a placeholder with the initials */
  logo(cls) {
    const img = mk('img', { class: cls, src: APP.assetBase + 'img/logo.svg', alt: '', width: '36', height: '36' });
    img.addEventListener('error', () => {
      const ph = mk('span', { class: cls + ' placeholder', 'aria-hidden': 'true' }, 'SM');
      img.replaceWith(ph);
    });
    return img;
  },

  buildNav() {
    const inner = el('sidebarInner');
    inner.innerHTML = '';
    const top = mk('ul', { class: 'nav-list' });
    top.appendChild(Layout.navItem('home', 'home', t('nav.home'), false));
    inner.appendChild(top);
    Modules.groups.forEach(g => {
      const grp = mk('div', { class: 'nav-group' });
      const titleId = 'navg-' + g;
      grp.appendChild(mk('div', { class: 'nav-group-title', id: titleId }, esc(t('nav.groups.' + g))));
      const ul = mk('ul', { class: 'nav-list', 'aria-labelledby': titleId });
      Modules.inGroup(g).forEach(m => ul.appendChild(Layout.navItem(m.id, m.icon, t('mod.' + m.id + '.title'), m.needsData && !hasData())));
      grp.appendChild(ul);
      inner.appendChild(grp);
    });
    /* what is loaded */
    const st = mk('div', { class: 'nav-status' + (hasData() ? ' has-data' : ''), 'aria-live': 'polite' });
    if (hasData()) {
      st.appendChild(mk('strong', null, esc(tp('status.records', state.records.length))));
      st.appendChild(mk('span', null, esc(tp('status.files', state.files.length))));
    } else {
      st.appendChild(mk('span', null, esc(t('status.noData'))));
    }
    inner.appendChild(st);
    const more = mk('ul', { class: 'nav-list nav-more' });
    more.appendChild(Layout.navItem('about', 'info', t('nav.about'), false));
    inner.appendChild(more);
  },

  navItem(route, ico, label, needsData) {
    const li = mk('li');
    /* home and the modules are the "blocks" of the suite (class step-btn,
       data-step = route): LABG.markStep and Alt+← / Alt+→ find them */
    const block = route !== 'about';
    const a = mk('a', { class: 'nav-link' + (block ? ' step-btn' : '') + (needsData ? ' locked' : ''), href: '#/' + route, 'data-route': route, 'data-step': block ? route : null },
      icon(ico) + '<span>' + esc(label) + '</span>');
    if (needsData) {
      a.appendChild(mk('span', { class: 'nav-dot', title: t('nav.needsData') }));
      a.appendChild(mk('span', { class: 'sr-only' }, esc(t('nav.needsData'))));
    }
    a.addEventListener('click', () => Layout.closeMenu());
    li.appendChild(a);
    return li;
  },

  /* reading order of the blocks for Previous / Next (About stays out) */
  order() { return ['home'].concat(Modules.ids()); },

  /* modules visited with data in this session; cleared when new data arrive */
  visited: new Set(),

  setActive(route) {
    els('.nav-link', Layout.root).forEach(a => {
      const on = a.dataset.route === route;
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
      a.classList.toggle('active', on);
    });
    Layout.revealActive();
    Layout.syncMarks();
    Layout.syncFooter(route);
  },

  /* keep the current module in view inside the side menu (without moving the page) */
  revealActive() {
    const inner = el('sidebarInner'), a = inner && inner.querySelector('.nav-link.active');
    if (!a || Layout.isNarrow() || inner.scrollHeight <= inner.clientHeight) return;
    const top = a.offsetTop - inner.offsetTop, bottom = top + a.offsetHeight;
    if (top < inner.scrollTop) inner.scrollTop = top - 8;
    else if (bottom > inner.scrollTop + inner.clientHeight) inner.scrollTop = bottom - inner.clientHeight + 8;
  },

  /* reviewed (✓): Import once there are data; any other module once it was
     opened with data. The state is also said to screen readers. */
  syncMarks() {
    const data = hasData();
    Modules.ids().forEach(id => {
      const done = data && (id === 'import' || Layout.visited.has(id));
      if (window.LABG) LABG.markStep(id, done ? 'done' : null);
      const a = Layout.root && Layout.root.querySelector('.nav-link[data-route="' + id + '"]');
      if (!a) return;
      a.classList.toggle('done', done);
      let s = a.querySelector('.step-state');
      if (!s) { s = mk('span', { class: 'sr-only step-state' }); a.appendChild(s); }
      s.textContent = done ? ' ' + t('nav.stateDone') : '';
    });
  },

  /* Previous / Next under the current section, named after the block */
  syncFooter(route) {
    const f = el('stepFooter');
    if (!f) return;
    const order = Layout.order(), i = order.indexOf(route);
    if (i < 0) { f.hidden = true; f.innerHTML = ''; return; }
    const name = id => id === 'home' ? t('nav.home') : t('mod.' + id + '.title');
    const prev = order[i - 1], next = order[i + 1];
    let html = '';
    if (prev) html += '<button type="button" class="btn btn-secondary prev" data-go="' + prev + '">' + icon('back') +
      '<span><small>' + esc(t('nav.prev')) + '</small>' + esc(name(prev)) + '</span></button>';
    if (next) {
      const m = Modules.get(next), locked = !!(m && m.needsData && !hasData());
      html += '<button type="button" class="btn btn-primary next" data-go="' + next + '"' + (locked ? ' disabled' : '') + '>' +
        '<span><small>' + esc(t('nav.next')) + '</small>' + esc(name(next)) + '</span>' + icon('chevron') + '</button>';
    }
    f.innerHTML = html;
    f.hidden = !html;
  },

  syncLang() {
    els('.lang-switch button', Layout.root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === I18N.lang)));
  },

  syncCounter() {
    const b = el('docCounter');
    if (!b) return;
    if (!state.clean) { b.hidden = true; b.textContent = ''; return; }
    const { shown, total } = Pipeline.counts();
    const included = Pipeline.onlyIncluded();
    const filtered = included || Parsers.lib().filtersActive(Pipeline.init().filters);
    b.hidden = false;
    b.classList.toggle('filtered', filtered);
    b.innerHTML = icon('filter') + '<span>' + esc(tp(included ? 'cleaning.counterIncluded' : 'cleaning.counter', total, { shown: fmtInt(shown) })) + '</span>';
    b.title = t(included ? 'cleaning.counterIncludedTitle' : 'cleaning.counterTitle');
  },

  syncTheme() {
    const b = el('themeBtn');
    if (!b) return;
    const dark = Theme.current() === 'dark';
    b.innerHTML = icon(dark ? 'sun' : 'moon');
    const label = t(dark ? 'header.themeToLight' : 'header.themeToDark');
    b.setAttribute('aria-label', label);
    b.title = label;
  },

  /* texts that depend on the language */
  refresh() {
    Layout.buildNav();
    I18N.apply(Layout.root);
    Layout.syncLang();
    Layout.syncTheme();
    el('footMeta').innerHTML = '<span>' + esc(t('footer.version', { v: APP.version })) + '</span> · <span>' + esc(t('footer.rights', { year: APP.year, author: APP.authorNames() })) + '</span>';
    Layout.syncMenuLabel();
    Layout.syncCounter();
    Layout.syncProject();
    if (state.route) Layout.setActive(state.route);
  },

  syncProject() {
    const b = el('projSave');
    if (b) b.disabled = !hasData();
  },

  isNarrow() { return window.matchMedia('(max-width: 900px)').matches; },

  toggleMenu() { document.body.classList.contains('nav-open') ? Layout.closeMenu() : Layout.openMenu(); },
  openMenu() { document.body.classList.add('nav-open'); Layout.syncMenuLabel(); },
  closeMenu() { document.body.classList.remove('nav-open'); Layout.syncMenuLabel(); },
  syncMenuLabel() {
    const b = el('menuBtn');
    if (!b) return;
    const open = document.body.classList.contains('nav-open');
    b.setAttribute('aria-expanded', String(open));
    b.setAttribute('aria-label', t(open ? 'header.closeMenu' : 'header.openMenu'));
    b.querySelector('svg').outerHTML = icon(open ? 'close' : 'menu');
  },
};

window.Layout = Layout;
