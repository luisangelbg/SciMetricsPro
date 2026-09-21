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

  boot(root) {
    if (App.booted) return;
    App.booted = true;
    I18N.init();
    Theme.init();
    Layout.build(root);
    document.title = t('app.title');

    window.addEventListener('hashchange', () => App.render(App.routeFromHash()));
    on('langchange', () => {
      document.title = t('app.title');
      Layout.refresh();
      App.render(state.route, { keepScroll: true, keepFocus: true });
    });
    on('themechange', () => Layout.syncTheme());
    on('datachange', () => { Layout.buildNav(); Layout.setActive(state.route); });
    on('cleanchange', () => Layout.syncCounter());

    App.render(App.routeFromHash());
    Project.init();
    Tour.maybeStart();
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
    if (route === 'home') Home.render(view);
    else if (route === 'about') About.render(view);
    else Modules.render(route, view);
    Layout.setActive(route);
    document.body.dataset.route = route;
    if (!opts.keepScroll) window.scrollTo(0, 0);
    if (!opts.keepFocus && prev !== route && App.booted) {
      const h = view.querySelector('h1');
      if (h && document.activeElement && document.activeElement !== document.body) h.focus({ preventScroll: true });
    }
    emit('routechange', { route, prev });
  },
};

window.App = App;
