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

    /* ---------- header ---------- */
    const bar = mk('header', { class: 'appbar' });
    const menuBtn = mk('button', { type: 'button', class: 'icon-btn menu-btn', id: 'menuBtn', 'aria-controls': 'sidebar', 'aria-expanded': 'false' },
      icon('menu') + '<span class="menu-label" data-i18n="header.menu"></span>');
    menuBtn.addEventListener('click', () => Layout.toggleMenu());
    bar.appendChild(menuBtn);

    const brand = mk('a', { class: 'brand', href: '#/home', 'data-i18n-attr': 'aria-label:header.home' });
    brand.appendChild(Layout.logo('brand-logo'));
    brand.appendChild(mk('span', { class: 'brand-text' },
      '<span class="brand-name">SciMetrics<span class="pro">Pro</span></span><span class="brand-tag" data-i18n="app.tagline"></span>'));
    bar.appendChild(brand);

    const tools = mk('div', { class: 'appbar-tools' });
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
    const lang = mk('div', { class: 'lang-switch', role: 'group', 'data-i18n-attr': 'aria-label:header.language' });
    [['es', 'ES', 'header.langEs'], ['en', 'EN', 'header.langEn']].forEach(([code, label, key]) => {
      const b = mk('button', { type: 'button', lang: code, 'data-lang': code, 'data-i18n-attr': 'title:' + key, 'aria-pressed': 'false' }, label);
      b.addEventListener('click', () => I18N.setLang(code));
      lang.appendChild(b);
    });
    tools.appendChild(lang);
    const themeBtn = mk('button', { type: 'button', class: 'icon-btn theme-btn', id: 'themeBtn' });
    themeBtn.addEventListener('click', () => Theme.toggle());
    tools.appendChild(themeBtn);
    bar.appendChild(tools);
    root.appendChild(bar);

    /* ---------- sidebar + main ---------- */
    const shell = mk('div', { class: 'shell' });
    const side = mk('nav', { class: 'sidebar', id: 'sidebar', 'data-i18n-attr': 'aria-label:nav.label' });
    side.appendChild(mk('div', { class: 'sidebar-inner', id: 'sidebarInner' }));
    shell.appendChild(side);
    const scrim = mk('div', { class: 'nav-scrim', 'aria-hidden': 'true' });
    scrim.addEventListener('click', () => Layout.closeMenu());
    shell.appendChild(scrim);
    const main = mk('main', { id: 'main', tabindex: '-1' });
    const view = mk('div', { class: 'view', id: 'view' });
    main.appendChild(view);
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
    const a = mk('a', { class: 'nav-link', href: '#/' + route, 'data-route': route }, icon(ico) + '<span>' + esc(label) + '</span>');
    if (needsData) {
      a.appendChild(mk('span', { class: 'nav-dot', title: t('nav.needsData') }));
      a.appendChild(mk('span', { class: 'sr-only' }, esc(t('nav.needsData'))));
    }
    a.addEventListener('click', () => Layout.closeMenu());
    li.appendChild(a);
    return li;
  },

  setActive(route) {
    els('.nav-link', Layout.root).forEach(a => {
      if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
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
