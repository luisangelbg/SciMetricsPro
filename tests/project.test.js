/* Project, example data, help, about page, guided tour and accessibility: the project saved to a compressed file and opened
   again, the automatic copy in the browser recovered on a new visit (criterion of the step), invalid and newer files, the
   example data through the search reader, every help of every screen with definition, formula, interpretation and
   reference in both languages, the about page, the tour with its keyboard, and an accessibility pass over every screen
   (names, labels, alternative texts, repeated ids and text contrast in light and dark themes). */
'use strict';

const pjReset = () => {
  ImportModule.clear(); Pipeline.settings = null; ImportModule.tab = 'files'; ImportModule.kw = null;
  ['synonyms', 'stopwords', 'termField', 'prisma', 'exportOptions', 'figexport', 'reportOptions', 'reportSources', 'countryAliases', 'institutionAliases', 'tourDone'].forEach(k => Prefs.del(k));
  const C = ConceptualModule;
  Object.assign(C, { params: null, tm: null, ev: null, fa: null, _net: null, _comm: null, _tm: null, _ev: null, _fa: null, selectedKey: null, figs: {}, cc: {}, tab: 'cooccurrence' });
  IntellectualModule.reset(); SocialModule.reset(); PrismaModule.reset();
  SourcesModule.tab = 'productivity'; SourcesModule.ui = { topN: 10, impactN: 10, measure: 'h', dynN: 5 }; AuthorsModule.tab = 'productivity';
  OverviewModule.figs = {};
  ExportModule.catalog = null; ExportModule.selected = null; ExportModule.report = { model: null, busy: false }; ExportModule.tab = 'files';
};
/* what the work is: data, cleaning, decisions, parameters and a few results */
const pjFingerprint = () => {
  const P = Parsers.lib(), s = Pipeline.init(), pr = Pipeline.prisma();
  const ov = P.overview(Pipeline.records(), { refYear: Pipeline.referenceYear(), dict: Pipeline.dict() });
  return JSON.stringify({
    files: state.files.map(f => [f.id, f.name, f.count]), records: state.records ? state.records.length : 0, recordsJson: state.records ? JSON.stringify(state.records).length : 0,
    clean: (state.clean || []).length, screening: (state.screening || []).length, filtered: (state.filtered || []).length, stats: Pipeline.stats,
    settings: { synonyms: s.synonyms, filters: s.filters, termField: s.termField, referenceYear: s.referenceYear, excluded: s.excluded, onlyIncluded: s.prismaOnlyIncluded },
    decisions: Object.keys(pr.decisions).sort().map(k => k + '=' + pr.decisions[k].status + ':' + (pr.decisions[k].reason || '')), labels: pr.sourceLabels,
    modules: { cn: ConceptualModule.params, srcUi: SourcesModule.ui, srcTab: SourcesModule.tab, auTab: AuthorsModule.tab, fig: OverviewModule.figs.ovProduction ? OverviewModule.figs.ovProduction.barColor : null },
    results: [ov.documents, ov.sources, ov.authors, ov.growthRate],
    prefs: Prefs.get('reportOptions', null),
  });
};
async function pjWork() {
  I18N.setLang('es'); App.boot(el('app')); pjReset();
  const { a, b } = prismaFiles();
  ImportModule.addResult({ name: 'busqueda-a.ris', size: 1, format: 'ris', source: 'ris', records: a, warnings: [], completeness: Parsers.lib().completeness(a) });
  ImportModule.addResult({ name: 'busqueda-b.ris', size: 1, format: 'ris', source: 'ris', records: b, warnings: [], completeness: Parsers.lib().completeness(b) });
  await Pipeline.pending;
  Pipeline.update({ synonyms: [{ from: 'passiflora', to: 'passion fruit' }], filters: Object.assign(Parsers.lib().emptyFilters(), { yearFrom: '2011' }) });
  await Pipeline.pending;
  Pipeline.setReferenceYear(2024);
  await Pipeline.pending;
  Pipeline.screening().slice(0, 6).forEach((r, i) => Pipeline.decide(r, ['include', 'exclude', 'maybe'][i % 3], i % 3 === 1 ? 'design' : ''));
  Pipeline.prisma().sourceLabels['busqueda-a.ris'] = 'Índice A';
  Pipeline.savePrisma();
  ConceptualModule.params = Object.assign({}, NetworkPanel.DEFAULTS, { maxNodes: 30, resolution: 1.4 });
  SourcesModule.ui.topN = 15; SourcesModule.tab = 'bradford'; AuthorsModule.tab = 'lotka';
  OverviewModule.figs.ovProduction = { barColor: '#c8416a' };
  Report.setOptions({ lang: 'en', rows: 7 });
  location.hash = '#/sources';
  App.render('sources');
}

describe('project · save, open and recover', () => {
  it('a saved project (gzip) opened again after clearing is the same work: data, cleaning, decisions, parameters and figure settings', async () => {
    await pjWork();
    const before = pjFingerprint(), nextId = ImportModule.nextFileId;
    const saved = window.download;
    let got = null;
    window.download = (blob, name) => { got = { blob, name }; };
    try { await Project.save(); } finally { window.download = saved; }
    ok(got && /^scimetricspro_proyecto_\d{4}-\d{2}-\d{2}\.smp\.json$/.test(got.name), got && got.name);
    const bytes = new Uint8Array(await got.blob.arrayBuffer());
    deepEq([bytes[0], bytes[1]], [0x1F, 0x8B], 'gzip');
    const p = await Project.parse(bytes);
    deepEq([p.format, p.version, p.app, p.records.length, p.files.length], ['scimetricspro-project', 1, APP.version, 23, 2]);
    eq(JSON.stringify(p.records), JSON.stringify(state.records), 'records travel whole');
    ImportModule.clear();
    await Pipeline.pending;
    pjReset();
    await Pipeline.pending;
    eq(state.records, null);
    const okOpen = await Project.open(new File([got.blob], got.name));
    eq(okOpen, true);
    eq(pjFingerprint(), before, 'the same work');
    eq(state.route, 'sources', 'back on the screen where it was saved');
    eq(ImportModule.nextFileId, nextId, 'new files keep their own ids');
    ok(Project.parse(new TextEncoder().encode(JSON.stringify(p))), 'a plain JSON project also opens');
    const plain = await Project.parse(new TextEncoder().encode(JSON.stringify(p)));
    eq(plain.records.length, 23);
  });

  it('invalid, newer and replacing: clear messages and a confirmation before replacing loaded data', async () => {
    const errors = [];
    const savedToast = window.toast;
    window.toast = (text, kind) => { if (kind === 'error') errors.push(text); };
    const savedConfirm = window.confirm;
    let asked = 0;
    window.confirm = () => { asked++; return false; };
    try {
      eq(await Project.open(new File(['{"hello": 1}'], 'x.smp.json')), false);
      eq(await Project.open(new File([new Uint8Array([1, 2, 3])], 'y.smp.json')), false);
      const newer = JSON.stringify({ format: 'scimetricspro-project', version: 99, app: '9.0.0', files: [], records: [] });
      eq(await Project.open(new File([newer], 'z.smp.json')), false);
      const good = JSON.stringify(Object.assign(Project.snapshot(), {}));
      eq(await Project.open(new File([good], 'w.smp.json')), false, 'cancelled');
    } finally { window.toast = savedToast; window.confirm = savedConfirm; }
    deepEq(errors, ['No se pudo abrir el proyecto: El archivo no es un proyecto de SciMetricsPro.', 'No se pudo abrir el proyecto: El archivo no es un proyecto de SciMetricsPro.', 'No se pudo abrir el proyecto: El proyecto se guardó con una versión más reciente (9.0.0).']);
    eq(asked, 1, 'asked once, before replacing');
    ok(hasData(), 'nothing replaced');
  });

  it('criterion: the automatic copy in the browser is offered on the next visit and recovers all the work; discarding forgets it', async () => {
    await pjWork();
    const before = pjFingerprint();
    Project.enabled = true; Project.ready = true;
    try {
      await Project.clearStored();
      eq(await Project.saveNow(), true);
      const stored = await Project.stored();
      eq(stored.documents, 23, 'kept in the browser');
      /* a new visit: nothing loaded, the question appears */
      Project.ready = false;
      ImportModule.clear(); await Pipeline.pending; pjReset(); await Pipeline.pending;
      const dialog = Project.showRecovery(await Project.stored());
      ok(dialog && el('recoverDialog').querySelector('[role="dialog"][aria-modal="true"]'), 'modal question');
      eq(document.activeElement.id, 'recoverYes', 'focus on «Recuperar»');
      eq(el('recoverTitle').textContent, '¿Recuperar la sesión anterior?');
      ok(/: 23 registros de 2 archivos, con su limpieza/.test(el('recoverText').textContent), el('recoverText').textContent);
      const keyTab = shift => el('recoverNo').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true }));
      el('recoverNo').focus(); keyTab(false);
      eq(document.activeElement.id, 'recoverYes', 'the focus stays inside the question');
      el('recoverYes').click();
      for (let i = 0; i < 100 && !hasData(); i++) await tick(20);
      await Pipeline.pending;
      await tick(50);
      ok(!el('recoverDialog'), 'question closed');
      eq(pjFingerprint(), before, 'the recovered work is the same');
      /* discard */
      Project.ready = false;
      ImportModule.clear(); await Pipeline.pending; pjReset(); await Pipeline.pending;
      await pjWork();
      Project.ready = true;
      await Project.saveNow();
      Project.ready = false;
      ImportModule.clear(); await Pipeline.pending;
      Project.showRecovery(await Project.stored());
      el('recoverNo').click();
      await tick(50);
      eq(await Project.stored(), null, 'discarded');
      eq(Project.ready, true, 'the autosave works again');
      /* clearing the data while autosaving forgets the copy too */
      await pjWork();
      await Project.saveNow();
      ok(await Project.stored(), 'saved');
      ImportModule.clear(); await Pipeline.pending;
      await Project.saveNow();
      eq(await Project.stored(), null, 'cleared data leave nothing to recover');
    } finally {
      Project.enabled = false; Project.ready = false;
      Project.closeRecovery();
      try { await Project.clearStored(); } catch (e) { /* nothing */ }
      pjReset();
      await Pipeline.pending;
    }
  });
});

describe('project · example data, about page and guided tour', () => {
  it('example data: the 300 works of the example load through the search reader, without abstracts, and open the overview', async () => {
    I18N.setLang('es'); App.boot(el('app')); pjReset(); await Pipeline.pending;
    App.render('home');
    const done = await Home.loadExample();
    eq(done, true);
    await Pipeline.pending;
    eq(state.records.length, 300);
    const f = state.files[0];
    deepEq([f.source, f.format, f.name, ImportModule.fileLabel(f)], ['openapi', 'json', 'ejemplo-nutricion-mineral-maracuya.json', 'Datos de ejemplo: nutrición mineral del maracuyá (300 obras)']);
    ok(f.search && /^title: \(passiflora OR "passion fruit"/.test(f.search.query.terms) && f.search.count >= 300 && /^\d{4}-\d{2}-\d{2}$/.test(f.search.date), 'the search is written down');
    ok(state.records.every(r => r.source === 'openapi' && !r.abstract), 'no abstracts');
    ok(state.records.filter(r => r.references.length).length > 200 && state.records.filter(r => r.indexKeywords.length).length > 250, 'references and index keywords');
    ok(state.records.every(r => NEVER.slice(0, 3).every(re => !re.test(JSON.stringify(r)))), 'no institution named in the rules');
    for (let i = 0; i < 50 && state.route !== 'overview'; i++) await tick(20);
    eq(state.route, 'overview');
    ok(Report.sourceLine(f).includes('búsqueda: title: (passiflora'), 'the methods of the report use the search');
    const years = state.records.map(r => r.year).filter(Boolean);
    ok(Math.min(...years) < 2000 && Math.max(...years) >= 2024, 'years ' + Math.min(...years) + '–' + Math.max(...years));
  });

  it('about page: version, author, licence with its text, citation (text and BibTeX) and third-party parts with their licences, in both languages', async () => {
    const problems = [];
    for (const lang of ['es', 'en']) {
      I18N.setLang(lang);
      location.hash = '#/about';
      App.render('about');
      ok(el('aboutApp') && el('aboutAuthor') && el('aboutLicense') && el('aboutCite') && el('aboutThird'), 'cards');
      ok(el('aboutApp').textContent.includes(APP.version), 'version');
      ok(APP.authors.every(a => el('aboutAuthor').textContent.includes(a.name) && el('aboutAuthor').querySelector(`a[href="https://orcid.org/${a.orcid}"]`)), 'every author with their ORCID');
      ok(el('aboutLicense').querySelector('a[href="../LICENSE"]') && /GPL-3\.0-or-later/.test(el('aboutLicense').textContent), 'licence');
      eq(el('aboutCiteText').textContent, Report.softwareCitation());
      ok(el('aboutBibtex').textContent.includes('version = {' + APP.version + '}'), 'BibTeX');
      eq(el('aboutThird').querySelectorAll('tbody tr').length, 3);
      ok(el('aboutThird').querySelector('a[href="../vendor/THIRD-PARTY-NOTICES.txt"]'), 'notices');
      eq(document.querySelector('.nav-link[aria-current="page"]').dataset.route, 'about');
      const dict = dictMatcher(lang);
      strayTexts(el('view'), lang).filter(s => !dict(s) && !/^(SciMetricsPro|0000-0001-8057-2583|0000-0001-9679-6514|Luis Ángel Barrera-Guzmán|Gabriela Ramírez-Ojeda|10\.5281\/zenodo\.\d+|@software[\s\S]*|vendor\/xlsx\.full\.min\.js|data\/world\.js|data\/example\.js)$/.test(s) && !s.startsWith('Barrera-Guzmán, L. Á.')).forEach(s => problems.push(lang + ': ' + s));
    }
    I18N.setLang('es');
    deepEq(problems, []);
    NEVER.forEach(re => ok(!re.test(el('app').textContent), 'no ' + re));
    const text = await (await fetch('../LICENSE').catch(() => null) || { text: async () => '' }).text().catch(() => '');
    ok(text === '' || text.includes('GNU GENERAL PUBLIC LICENSE'), 'licence file');
  });

  it('guided tour: seven steps pointing at the parts of the app, next and back, keyboard, skip remembered; it does not start by itself in the tests', async () => {
    location.hash = '#/home';
    App.render('home');
    eq(Tour.shouldStart(), false, 'SMP_TEST');
    el('homeTour').click();
    ok(el('tourDialog'), 'open');
    const title = () => el('tourTitle').textContent;
    eq(el('tourProgress').textContent, 'Paso 1 de 7');
    eq(title(), 'Te damos la bienvenida a SciMetricsPro');
    ok(el('tourDialog').classList.contains('centered'), 'the first step in the middle');
    eq(document.activeElement.id, 'tourNext');
    el('tourNext').click();
    eq(el('tourProgress').textContent, 'Paso 2 de 7');
    const spot = document.querySelector('.tour-spot').getBoundingClientRect();
    const target = document.querySelector('.nav-link[data-route="import"]').getBoundingClientRect();
    ok(!document.querySelector('.tour-spot').hidden && spot.left <= target.left && spot.right >= target.right && spot.top <= target.top && spot.bottom >= target.bottom, 'the spotlight surrounds «Importar»');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    eq(el('tourProgress').textContent, 'Paso 3 de 7');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    eq(el('tourProgress').textContent, 'Paso 2 de 7');
    eq(el('tourPrev').disabled, false);
    const titles = [title()];
    for (let i = 0; i < 5; i++) { el('tourNext').click(); titles.push(title()); }
    eq(el('tourProgress').textContent, 'Paso 7 de 7');
    eq(el('tourNext').textContent, 'Terminar');
    deepEq(titles, ['Importa tus registros', 'Limpia y filtra', 'Analiza', 'Revisión sistemática', 'Exporta y redacta', 'Guarda tu trabajo']);
    const dict = dictMatcher('es');
    deepEq(strayTexts(el('tourDialog'), 'es').filter(s => !dict(s)), [], 'texts from the dictionary');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ok(!el('tourDialog') && !document.querySelector('.tour-spot'), 'closed with Esc');
    eq(Prefs.get('tourDone', false), true, 'remembered');
    Tour.start();
    el('tourSkip').click();
    ok(!el('tourDialog'), 'skipped');
    Prefs.del('tourDone');
  });
});

describe('project · every help and accessibility of every screen', () => {
  const screens = () => {
    const list = [['home', null], ['about', null]];
    ['import', 'cleaning', 'overview', 'sources', 'authors', 'documents', 'conceptual', 'intellectual', 'social', 'prisma', 'export'].forEach(id => {
      const M = window[id.charAt(0).toUpperCase() + id.slice(1) + 'Module'];
      (M && M.TABS ? M.TABS : [null]).forEach(tab => list.push([id, tab]));
    });
    return list;
  };
  const visit = async (id, tab) => {
    const M = window[id.charAt(0).toUpperCase() + id.slice(1) + 'Module'];
    if (tab && M) M.tab = tab;
    location.hash = '#/' + id;
    App.render(id);
    for (let i = 0; i < 40; i++) { const w = ExportCollector.waits(); if (!w.length) break; await Promise.all(w.map(p => p.catch(() => null))); App.render(id); }
  };
  const load = async () => {
    I18N.setLang('es'); App.boot(el('app')); pjReset();
    const a = intellectualDataset(), b = socialDataset();
    ImportModule.addResult({ name: 'ayuda-a.csv', size: 1, format: 'csv', source: 'idxA', records: a, warnings: [], completeness: Parsers.lib().completeness(a) });
    ImportModule.addResult({ name: 'ayuda-b.csv', size: 1, format: 'csv', source: 'table', records: b, warnings: [], completeness: Parsers.lib().completeness(b) });
    await Pipeline.pending;
  };

  it('every help of the analyses has a definition, a formula, how to interpret it and its reference, in Spanish and English', async () => {
    await load();
    const orig = HelpPopover.button;
    const found = [];
    let where = '';
    HelpPopover.button = (spec, opts) => { found.push({ where, spec, label: opts && opts.label }); return orig(spec, opts); };
    const bad = [];
    const counts = {};
    try {
      for (const lang of ['es', 'en']) {
        I18N.setLang(lang);
        found.length = 0;
        for (const [id, tab] of screens()) { where = id; await visit(id, tab); }
        const seen = new Set();
        for (const f of found) {
          const s = typeof f.spec === 'function' ? f.spec() : f.spec;
          const key = f.where + '|' + (s.title || f.label);
          if (seen.has(key)) continue;
          seen.add(key);
          const analysis = !['import', 'cleaning', 'export'].includes(f.where);
          const miss = [];
          if (!s.text || s.text.length < 30) miss.push('text');
          if (!s.formula) miss.push('formula');
          if (!s.interpretation) miss.push('interpretation');
          if (analysis && (!s.refs || !s.refs.length)) miss.push('refs');
          if (miss.length) bad.push(lang + ' ' + key + ' → ' + miss.join(','));
        }
        counts[lang] = seen.size;
      }
    } finally { HelpPopover.button = orig; I18N.setLang('es'); }
    ok(counts.es >= 150 && counts.es === counts.en, `helps: ${counts.es} and ${counts.en}`);
    deepEq(bad, []);
  });

  it('accessibility: names of buttons and links, labels of fields, alternative texts, named figures, no repeated ids and text contrast (WCAG AA) in light and dark themes', async () => {
    const parse = c => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const blend = (top, bottom) => { const a = top[3]; return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1]; };
    const background = node => {
      const layers = [];
      for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
        const c = parse(cs.backgroundColor);
        if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      }
      let bg = document.documentElement.dataset.theme === 'dark' ? [12, 19, 32, 1] : [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg);
      return bg;
    };
    const visible = n => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const name = n => (n.getAttribute('aria-label') || n.getAttribute('title') || n.textContent || '').trim();
    const issues = new Set();
    const audit = (theme, where) => {
      const root = el('app');
      if (theme === 'light') {
        root.querySelectorAll('button, a[href]').forEach(b => { if (visible(b) && !name(b)) issues.add('no name: ' + where + ' ' + b.outerHTML.slice(0, 60)); });
        root.querySelectorAll('input, select, textarea').forEach(i => {
          if (i.type === 'hidden' || i.hidden || i.getAttribute('aria-hidden') === 'true' || !visible(i)) return;
          if (!(i.getAttribute('aria-label') || i.getAttribute('aria-labelledby') || i.closest('label') || (i.id && root.querySelector('label[for="' + CSS.escape(i.id) + '"]')) || i.title)) issues.add('no label: ' + where + ' ' + i.outerHTML.slice(0, 60));
        });
        root.querySelectorAll('img').forEach(i => { if (!i.hasAttribute('alt')) issues.add('no alt: ' + where); });
        root.querySelectorAll('.chart-body svg[data-w]').forEach(s => { if (s.getAttribute('role') !== 'img' || !s.getAttribute('aria-label')) issues.add('figure without name: ' + where + ' ' + (s.closest('[id]') || {}).id); });
        root.querySelectorAll('canvas').forEach(c => { if (!c.getAttribute('aria-label')) issues.add('canvas without name: ' + where); });
        const ids = new Map();
        root.querySelectorAll('[id]').forEach(n => ids.set(n.id, (ids.get(n.id) || 0) + 1));
        [...ids].filter(([, c]) => c > 1).forEach(([id]) => issues.add('repeated id: ' + where + ' ' + id));
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const p = t.parentElement;
        if (!p || seen.has(p) || !t.textContent.trim() || p.closest('svg, .sr-only, [aria-hidden="true"]') || !visible(p)) continue;
        seen.add(p);
        let opacity = 1;
        for (let n = p; n && n.nodeType === 1; n = n.parentElement) opacity *= +getComputedStyle(n).opacity;
        if (opacity < 0.99) continue;
        const cs = getComputedStyle(p), fg = parse(cs.color), bg = background(p);
        if (!fg || !bg) continue;
        const size = parseFloat(cs.fontSize), large = size >= 24 || (+cs.fontWeight >= 700 && size >= 18.66);
        const l1 = lum(blend(fg, bg)), l2 = lum(bg), r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (r < (large ? 3 : 4.5)) issues.add(theme + ' contrast ' + r.toFixed(2) + ': ' + where + ' «' + t.textContent.trim().slice(0, 30) + '»');
      }
    };
    await load();
    const html = document.documentElement, before = html.dataset.theme;
    try {
      for (const theme of ['light', 'dark']) {
        html.dataset.theme = theme;
        for (const [id, tab] of screens()) { await visit(id, tab); audit(theme, id + (tab ? '/' + tab : '')); }
      }
    } finally { if (before) html.dataset.theme = before; else delete html.dataset.theme; }
    deepEq([...issues], []);
    ok(el('app').querySelector('.skip-link'), 'skip link');
    pjReset();
    await Pipeline.pending;
  });
});
