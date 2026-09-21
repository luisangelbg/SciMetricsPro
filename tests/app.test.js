/* Application shell: layout, navigation, language, theme, empty modules, no hard-coded text. */
'use strict';

/* Is this visible text produced by the dictionaries of the active language? */
function dictMatcher(lang) {
  const exact = new Set(), patterns = [];
  const walk = o => Object.values(o).forEach(v => {
    if (v && typeof v === 'object') walk(v);
    else if (typeof v === 'string') {
      const norm = v.replace(/\s+/g, ' ').trim().toLowerCase();
      if (/\{\w+\}/.test(norm)) patterns.push(new RegExp('^' + norm.split(/\{\w+\}/).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+?') + '$'));
      else exact.add(norm);
    }
  });
  walk(I18N_DICT[lang]);
  Object.entries(I18N_DICT[lang].phrases || {}).forEach(([k, v]) => { exact.add(k.toLowerCase()); exact.add(v.toLowerCase()); });
  const allowed = new Set(['scimetrics', 'pro', 'scimetricspro', 'es', 'en', 'sm', '«', '»', '‹', '›', '▲', '▼']);
  return s => {
    const n = s.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!n || allowed.has(n) || /^[\d\s.,%–—·×()/-]+$/.test(n)) return true;   // numbers, fractions and the "no value" dash
    return exact.has(n) || patterns.some(re => re.test(n));
  };
}
function strayTexts(root, lang) {
  const isDict = dictMatcher(lang);
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement && n.parentElement.closest('script, style')) continue;
    if (!isDict(n.textContent)) out.push(n.textContent.trim());
  }
  return out;
}

describe('app · shell', () => {
  it('boots with header, sidebar, main area and footer', () => {
    I18N.setLang('es');
    App.boot(el('app'));
    const root = el('app');
    ok(root.querySelector('header.appbar .brand-name'), 'brand');
    eq(root.querySelector('.brand-name').textContent, 'SciMetricsPro');
    ok(root.querySelector('.brand-logo'), 'logo or placeholder');
    ok(root.querySelector('nav.sidebar'), 'sidebar');
    ok(root.querySelector('main#main #view'), 'main');
    ok(root.querySelector('footer.appfoot'), 'footer');
    ok(root.querySelector('.foot-meta').textContent.includes('Versión ' + APP.version), 'version');
  });
  it('the logo file loads (no placeholder needed)', async () => {
    const img = el('app').querySelector('img.brand-logo');
    ok(img, 'img element replaced by the placeholder: img/logo.svg did not load');
    if (!img.complete) await new Promise(r => { img.onload = r; img.onerror = r; });
    ok(img.naturalWidth > 0, 'logo not decoded');
  });
  it('sidebar groups and modules follow the specification', () => {
    const groups = [...el('app').querySelectorAll('.nav-group')].map(g => [
      g.querySelector('.nav-group-title').textContent,
      [...g.querySelectorAll('.nav-link span:first-of-type')].map(s => s.textContent),
    ]);
    deepEq(groups, [
      ['Datos', ['Importar', 'Limpieza y filtros']],
      ['Descriptivos', ['Panorama general', 'Fuentes', 'Autores', 'Documentos']],
      ['Estructuras', ['Conceptual', 'Intelectual', 'Social']],
      ['Revisión sistemática', ['PRISMA']],
      ['Resultados', ['Exportar y reporte']],
    ]);
    eq(el('app').querySelectorAll('.nav-link').length, 13, 'home, eleven modules and about');
    eq(el('app').querySelector('.nav-more .nav-link').dataset.route, 'about');
  });
  it('home: what the app is, four steps, import and example enabled, guided tour', () => {
    App.render('home');
    const v = el('view');
    ok(v.querySelector('.hero h1'), 'hero');
    deepEq([...v.querySelectorAll('.step-card h3')].map(h => h.textContent), ['Importar', 'Limpiar', 'Analizar', 'Exportar']);
    eq(el('homeImport').disabled, false);
    eq(el('homeExample').disabled, false);
    ok(el('homeTour'), 'guided tour button');
    ok(v.querySelector('.hero-art svg'), 'illustration');
    eq(v.querySelectorAll('.mod-link').length, 11);
  });
  it('"Importar mis datos" navigates to the import module', async () => {
    App.render('home');
    el('homeImport').click();
    await tick(40);
    eq(state.route, 'import');
    eq(el('app').querySelector('.nav-link[aria-current="page"]').dataset.route, 'import');
  });
});

describe('app · every section opens', () => {
  it('each module without data shows "Primero importa datos"', () => {
    I18N.setLang('es');
    const bad = [];
    Modules.list.forEach(m => {
      App.render(m.id);
      const v = el('view');
      const h1 = v.querySelector('h1');
      if (!h1 || h1.textContent !== t('mod.' + m.id + '.heading')) bad.push(m.id + ': heading');
      if (m.needsData) {
        const e = v.querySelector('.empty-state .empty-title');
        if (!e || e.textContent !== 'Primero importa datos') bad.push(m.id + ': empty state');
        if (!v.querySelector('.chip.warn')) bad.push(m.id + ': no-data chip');
      }
      if (el('app').querySelector('.nav-link[aria-current="page"]').dataset.route !== m.id) bad.push(m.id + ': active link');
    });
    deepEq(bad, []);
  });
  it('the import section shows the (disabled) drop zone', () => {
    App.render('import');
    ok(el('view').querySelector('.dropzone'), 'dropzone');
    ok(!el('view').querySelector('.empty-state'), 'no empty state in import');
  });
  it('the empty-state import button leads to the import section', async () => {
    App.render('authors');
    el('view').querySelector('.empty-state .btn-primary').click();
    await tick(40);
    eq(state.route, 'import');
  });
  it('unknown routes fall back to home', () => {
    eq(App.routeFromHash('#/nope'), 'home');
    eq(App.routeFromHash('#/social'), 'social');
    eq(App.routeFromHash(''), 'home');
  });
});

describe('app · language', () => {
  it('switching to English re-renders header, sidebar, footer and the current view', () => {
    I18N.setLang('es');
    App.render('sources');
    el('app').querySelector('.lang-switch button[data-lang="en"]').click();
    eq(I18N.lang, 'en');
    eq(document.documentElement.lang, 'en');
    eq(el('app').querySelector('.lang-switch button[data-lang="en"]').getAttribute('aria-pressed'), 'true');
    eq(el('app').querySelector('.nav-group-title').textContent, 'Data');
    eq(el('view').querySelector('.empty-title').textContent, 'Import data first');
    eq(el('view').querySelector('h1').textContent, 'Sources');
    ok(el('app').querySelector('.foot-meta').textContent.startsWith('Version '), 'footer');
    eq(state.route, 'sources');
    el('app').querySelector('.lang-switch button[data-lang="es"]').click();
    eq(el('view').querySelector('.empty-title').textContent, 'Primero importa datos');
  });
  it('no visible text outside the dictionaries, and no missing keys, in both languages', () => {
    const problems = [];
    I18N.missing.clear();
    ['es', 'en'].forEach(lang => {
      I18N.setLang(lang);
      App.routes().forEach(r => {
        App.render(r);
        strayTexts(el('app'), lang).forEach(s => problems.push(lang + ' #/' + r + ': ' + s));
      });
    });
    I18N.setLang('es');
    App.render('home');
    deepEq({ stray: [...new Set(problems)], missing: [...I18N.missing] }, { stray: [], missing: [] });
  });
  it('the chosen language is remembered', () => {
    I18N.setLang('en');
    eq(Prefs.get('lang'), 'en');
    I18N.setLang('es');
    eq(Prefs.get('lang'), 'es');
  });
});

describe('app · theme and menu', () => {
  it('the theme button switches light/dark, changes the tokens and is remembered', () => {
    const btn = el('themeBtn');
    Theme.set('light');
    const lightBg = getComputedStyle(document.body).backgroundColor;
    eq(btn.getAttribute('aria-label'), 'Cambiar a modo oscuro');
    btn.click();
    eq(document.documentElement.dataset.theme, 'dark');
    eq(Prefs.get('theme'), 'dark');
    ok(getComputedStyle(document.body).backgroundColor !== lightBg, 'background did not change');
    eq(btn.getAttribute('aria-label'), 'Cambiar a modo claro');
    btn.click();
    eq(document.documentElement.dataset.theme, 'light');
    eq(getComputedStyle(document.body).backgroundColor, lightBg);
  });
  it('the narrow-screen menu opens and closes (button, Escape, choosing a module)', async () => {
    const b = el('menuBtn');
    b.click();
    ok(document.body.classList.contains('nav-open'));
    eq(b.getAttribute('aria-expanded'), 'true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ok(!document.body.classList.contains('nav-open'), 'Escape');
    b.click();
    el('app').querySelector('.nav-link[data-route="documents"]').click();
    ok(!document.body.classList.contains('nav-open'), 'link');
    await tick(40);
    eq(state.route, 'documents');
  });
  /* The drop-down itself depends on the window width (a CSS media query) and a page
     opened from file:// cannot read its own stylesheet rules, so it is checked with
     screenshots at phone width rather than here. */
  it('leaving the narrow layout closes an open menu', () => {
    Layout.openMenu();
    ok(document.body.classList.contains('nav-open'));
    window.dispatchEvent(new Event('resize'));
    eq(document.body.classList.contains('nav-open'), Layout.isNarrow(), 'menu state after resize');
    Layout.closeMenu();
  });
});
