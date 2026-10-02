/* SciMetricsPro — router and start-up.
   Routes live in the URL hash (#/home, #/import, #/overview …), which works from
   file:// and keeps the browser's back button meaningful. */
'use strict';

const App = {
  booted: false,

  routes() { return ['home', 'about'].concat(Modules.ids()); },

  routeFromHash(hash) {
    const m = String(hash == null ? location.hash : hash).match(/^#\/?([\w-]+)/);
    return m && App.routes().includes(m[1]) ? m[1] : 'home';
  },

  /* a tab of the module in the address (#/sources/bradford), or null when that module has no such tab */
  tabFromHash(hash) {
    const m = String(hash == null ? location.hash : hash).match(/^#\/?([\w-]+)\/([\w-]+)/);
    if (!m || !App.routes().includes(m[1])) return null;
    return Modules.tabs(m[1]).some(x => x.id === m[2]) ? m[2] : null;
  },
  tabHash(route, tab) { return '#/' + route + (tab ? '/' + tab : ''); },
  /* the tabs of a module, for the LABG navigator ([] when it has none) */
  tabs(route) { return Modules.tabs(route); },
  /* open a tab of a module; the address keeps it, so Back returns to the previous place */
  goTab(route, tab) {
    if (!App.routes().includes(route)) return;
    const h = App.tabHash(route, Modules.tabs(route).some(x => x.id === tab) ? tab : null);
    if (location.hash === h) App.render(route, { tab });
    else location.hash = h;
  },
  /* the address follows the open tab without a new history entry, only while it already
     points to the module on screen (the start page without # and the tests page stay as they are).
     It is written a moment later, once per burst of redraws: browsers ignore an address that
     changes hundreds of times in a few seconds, and then a link would not open. */
  _tabHashTimer: null,
  syncTabHash() {
    clearTimeout(App._tabHashTimer);
    App._tabHashTimer = setTimeout(() => {
      const route = state.route, s = Modules.screen(route);
      if (!s || !Array.isArray(s.TABS) || !s.TABS.includes(s.tab)) return;
      if (!/^#\//.test(location.hash) || App.routeFromHash() !== route) return;
      const h = App.tabHash(route, s.tab);
      if (location.hash !== h) try { history.replaceState(history.state, '', h); } catch (e) { /* some viewers do not allow it */ }
    }, 120);
  },

  boot(root) {
    if (App.booted) return;
    App.booted = true;
    I18N.init();
    Theme.init();
    Layout.build(root);
    document.title = t('app.title');

    /* a change that arrives late, when the address has moved on again (another navigation, or the tab
       written by syncTabHash after the page was already drawn), is skipped: the newer one draws */
    window.addEventListener('hashchange', e => {
      if (e && e.newURL && e.newURL !== location.href) return;
      App.render(App.routeFromHash(), { tab: App.tabFromHash() });
    });
    on('langchange', () => {
      document.title = t('app.title');
      Layout.refresh();
      App.render(state.route, { keepScroll: true, keepFocus: true });
    });
    on('themechange', () => Layout.syncTheme());
    on('datachange', () => { Layout.visited.clear(); if (hasData() && Modules.get(state.route)) Layout.visited.add(state.route); Layout.buildNav(); Layout.setActive(state.route); });
    on('cleanchange', () => Layout.syncCounter());

    App.render(App.routeFromHash(), { tab: App.tabFromHash() });
    Project.init();
    Tour.maybeStart();
    App.bindSuite();
  },

  /* Behaviour shared by the LABG Suite: Alt+← / Alt+→ between blocks, the «?»
     list of shortcuts and the question before closing with data loaded. Only
     in the app: the tests page may run without js/core/labg-core.js. */
  bindSuite() {
    if (!window.LABG) return;
    /* the animated wait of the suite (behind ProgressOverlay): points that gather in groups, as the
       communities of a network, and advice of this app in both languages next to the common ones */
    if (LABG.work) {
      LABG.work.scene = 'cluster';
      const tips = k => [I18N_DICT.es.progress.tips[k], I18N_DICT.en.progress.tips[k]];
      LABG.work.tips = ['prisma', 'zip', 'report'].map(tips);
    }
    LABG.bindStepKeys(route => App.go(route));
    LABG.shortcuts([]);
    /* the tests page loads data on purpose: no question when it is closed */
    if (!window.SMP_TEST) LABG.guardUnload(() => hasData());
  },

  go(route) {
    if (!App.routes().includes(route)) route = 'home';
    if (App.routeFromHash() === route && location.hash) App.render(route);
    else location.hash = '#/' + route;
  },

  render(route, opts) {
    opts = opts || {};
    if (!App.routes().includes(route)) route = 'home';
    const prev = state.route;
    state.route = route;
    HelpPopover.close();
    Layout.closeMenu();
    const view = Layout.view;
    /* a tab asked for in the address (#/sources/bradford) */
    const scr = opts.tab ? Modules.screen(route) : null;
    if (scr && Array.isArray(scr.TABS) && scr.TABS.includes(opts.tab)) scr.tab = opts.tab;
    if (route === 'home') Home.render(view);
    else if (route === 'about') About.render(view);
    else Modules.render(route, view);
    App.syncTabHash();
    if (hasData() && Modules.get(route)) Layout.visited.add(route);
    Layout.setActive(route);
    document.body.dataset.route = route;
    if (!opts.keepScroll) window.scrollTo(0, 0);
    if (!opts.keepFocus && prev !== route && App.booted) {
      const h = view.querySelector('h1');
      if (h && document.activeElement && document.activeElement !== document.body) h.focus({ preventScroll: true });
    }
    if (window.LABG && App.booted && prev && prev !== route) LABG.announce(t('nav.announce', { name: route === 'home' ? t('nav.home') : route === 'about' ? t('nav.about') : t('mod.' + route + '.title') }));
    emit('routechange', { route, prev });
  },
};

window.App = App;
