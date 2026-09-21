/* Paso 17: end to end, as a person uses the app (clicks on links, tabs and buttons, the file input, keys):
   example data from the home page → files through the file input → a filter in Cleaning → every module and tab →
   screening with the keyboard → report (.docx and web page) → project file, in Spanish and English; without errors in
   the console, error messages, untranslated keys, NaN/undefined in the screens or calculations left pending.
   Then extreme collections: one document, one year, titles only, nothing left after the filters, no citations. */
'use strict';

const E2E = {
  BAD: /\bNaN\b|\bInfinity\b|\bundefined\b|\bnull\b|\[object Object\]|\{[a-zA-Z]+\}/,
  textOf(node) { return node.innerText + '\n' + [...node.querySelectorAll('svg text, svg title')].map(x => x.textContent).join('\n'); },
  badLines(text) { return [...new Set(text.split('\n').filter(line => E2E.BAD.test(line)).map(line => line.trim().slice(0, 120)))]; },
  /* console errors, uncaught errors, error messages and downloads while fn runs */
  async watch(fn) {
    const log = { errors: [], toasts: [], files: [] };
    const origError = console.error, origToast = window.toast, origDownload = window.download;
    const onError = e => log.errors.push('error: ' + (e.message || (e.reason && e.reason.message) || e.reason));
    console.error = (...a) => { log.errors.push('console: ' + a.map(String).join(' ')); };
    window.toast = (text, kind) => { if (kind === 'error') log.toasts.push(text); return origToast(text, kind); };
    window.download = (content, name) => { log.files.push({ name, blob: content instanceof Blob ? content : new Blob([content]) }); };
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onError);
    try { await fn(log); } finally {
      console.error = origError; window.toast = origToast; window.download = origDownload;
      window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onError);
    }
    return log;
  },
  /* wait for the calculations in workers and the screens that redraw themselves when they finish */
  async settle() {
    for (let i = 0; i < 80; i++) {
      const w = ExportCollector.waits();
      if (!w.length) break;
      await Promise.all(w.map(p => p.catch(() => null)));
      await tick(20);
    }
    await tick(40);
  },
  async until(test, ms) { const end = performance.now() + (ms || 20000); while (!test() && performance.now() < end) await tick(25); return test(); },
  async go(route) {
    const link = document.querySelector('.nav-link[data-route="' + route + '"]');
    ok(link, 'link to ' + route);
    link.click();
    await E2E.until(() => state.route === route);
    await E2E.settle();
  },
  tabIds() { return [...Layout.view.querySelectorAll('.tabs [role="tab"]')].map(b => b.id); },
};

describe('end to end · a whole session through the interface', () => {
  it('example → file input → filter → every module and tab → screening → report and project, without errors', async () => {
    const visited = [], problems = [];
    I18N.setLang('es'); App.boot(el('app')); pjReset(); I18N.missing.clear();
    const check = where => {
      E2E.badLines(E2E.textOf(Layout.view)).forEach(x => problems.push(where + ' → ' + x));
      const pending = Layout.view.querySelector('[id$="Pending"]:not(#prPending)');
      if (pending) problems.push(where + ' → still pending: ' + pending.id);
    };
    const log = await E2E.watch(async log => {
      /* home page: the example button */
      location.hash = '#/home'; await E2E.until(() => state.route === 'home'); App.render('home');
      el('homeExample').click();
      ok(await E2E.until(() => state.route === 'overview' && state.records.length === 300, 30000), 'example loaded and the overview opened');
      await E2E.settle();

      /* Import: five files through the file input */
      await E2E.go('import');
      el('tab-files').click(); await E2E.settle();
      const dt = new DataTransfer();
      [['indice_a.csv', FIXTURES.idxaCsv], ['indice_biomedico.txt', FIXTURES.biomedTagged], ['gestor.ris', FIXTURES.risGeneric],
        ['indice_b.txt', FIXTURES.idxbTagged], ['indice_a.bib', FIXTURES.bibIdxA]].forEach(([name, text]) => dt.items.add(new File([text], name)));
      const input = el('importInput');
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
      ok(await E2E.until(() => state.files.length === 6 && !ImportModule.busy, 30000), 'six files read');
      await Pipeline.pending; await E2E.settle();
      for (const id of E2E.tabIds()) { el(id).click(); await E2E.settle(); visited.push('import/' + id); check('import/' + id); }

      /* Cleaning: every tab, then a filter typed in the year field */
      await E2E.go('cleaning');
      for (const id of E2E.tabIds()) { el(id).click(); await E2E.settle(); visited.push('cleaning/' + id); check('cleaning/' + id); }
      el('ctab-filters').click(); await E2E.settle();
      const before = Pipeline.records().length;
      const from = el('fYearFrom');
      from.value = '2015'; from.dispatchEvent(new Event('change'));
      await Pipeline.pending; await E2E.settle();
      ok(Pipeline.records().length < before && Pipeline.records().length > 0, 'the filter left ' + Pipeline.records().length + ' of ' + before);
      ok(!el('docCounter').hidden, 'the header counter shows the filter');

      /* every analysis module and every tab */
      for (const route of ['overview', 'sources', 'authors', 'documents', 'conceptual', 'intellectual', 'social', 'prisma']) {
        await E2E.go(route);
        const ids = E2E.tabIds();
        if (!ids.length) { visited.push(route); check(route); }
        for (const id of ids) {
          el(id).click();
          await E2E.settle();
          visited.push(route + '/' + id);
          check(route + '/' + id);
        }
      }

      /* PRISMA screening with the keyboard: include, exclude */
      el('ptab-screening').click(); await E2E.settle();
      document.body.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true }));
      await tick(30);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      await tick(30);
      eq(Object.values(Pipeline.prisma().decisions).map(d => d.status).sort().join(), 'exclude,include', 'two decisions by keyboard');

      /* report: build, .docx and web page */
      await E2E.go('export');
      for (const id of E2E.tabIds()) { el(id).click(); await E2E.settle(); visited.push('export/' + id); check('export/' + id); }
      el('extab-report').click(); await E2E.settle();
      el('rpBuild').click();
      ok(await E2E.until(() => ExportModule.report.model && !ExportModule.report.busy && el('rpDocx'), 60000), 'report built');
      check('export/report preview');
      el('rpDocx').click();
      ok(await E2E.until(() => log.files.some(f => /\.docx$/.test(f.name)), 60000), '.docx saved');
      el('rpHtml').click();
      ok(log.files.some(f => /\.html$/.test(f.name)), 'web page saved');

      /* project file */
      el('projSave').click();
      ok(await E2E.until(() => log.files.some(f => /\.smp\.json$/.test(f.name)), 30000), 'project saved');

      /* the same screens in English */
      document.querySelector('.lang-switch [data-lang="en"]').click();
      eq(I18N.lang, 'en');
      for (const route of ['overview', 'documents', 'prisma', 'export']) { await E2E.go(route); visited.push('en ' + route); check('en ' + route); }
      document.querySelector('.lang-switch [data-lang="es"]').click();
    });
    try {
      ok(visited.length >= 46, 'screens visited: ' + visited.length);
      deepEq(log.errors, [], 'console and uncaught errors');
      deepEq(log.toasts, [], 'error messages');
      deepEq([...I18N.missing], [], 'untranslated keys');
      deepEq(problems, [], 'NaN, undefined, unfilled variables or pending calculations');
      const docx = log.files.find(f => /\.docx$/.test(f.name));
      const bytes = new Uint8Array(await docx.blob.arrayBuffer());
      ok(bytes[0] === 0x50 && bytes[1] === 0x4B && bytes.length > 100000, 'the .docx is a package of ' + bytes.length + ' bytes');
      const project = log.files.find(f => /\.smp\.json$/.test(f.name));
      const opened = await Project.parse(new Uint8Array(await project.blob.arrayBuffer()));
      eq(opened.records.length, state.records.length, 'the project holds every record');
    } finally { I18N.setLang('es'); pjReset(); location.hash = ''; }
  });

  it('the checks catch what they look for (a planted NaN, a pending note and a console error)', async () => {
    const host = document.createElement('div');
    host.innerHTML = '<p>Media: NaN</p><p>{documents} documentos</p><svg><text>undefined</text></svg><p>2 documentos</p>';
    document.body.appendChild(host);
    try {
      deepEq(E2E.badLines(E2E.textOf(host)), ['Media: NaN', '{documents} documentos', 'undefined']);
      const log = await E2E.watch(async () => { console.error('planted'); toast('planted error', 'error'); download('x', 'x.txt'); });
      eq(log.errors.length, 1); deepEq(log.toasts, ['planted error']); eq(log.files[0].name, 'x.txt');
    } finally { host.remove(); document.querySelectorAll('.toast').forEach(x => x.remove()); }
  });
});

describe('end to end · extreme collections', () => {
  const P = () => Parsers.lib();
  const rec = o => {
    const r = Object.assign(P().newRecord(), o);
    r.authors = (o.authors || []).map((a, i) => { const p = P().person(a); if (o.affs && o.affs[i]) p.affiliations = [o.affs[i]]; return p; });
    r.references = (o.refs || []).map(x => Object.assign(P().newRef(x[0]), x[1] || {}));
    delete r.affs; delete r.refs;
    return P().finish(r);
  };
  const SETS = {
    'one document': () => [rec({ title: 'Seed banks of chayote in Veracruz', year: 2020, sourceTitle: 'Econ Bot', timesCited: 4, docTypeRaw: 'Article', doi: '10.1000/one.1',
      authors: ['Lira, R.', 'Cruz, A.'], affs: ['Instituto de Ecologia, Xalapa, Mexico', 'University of California, Davis, USA'],
      authorKeywords: ['chayote', 'seed banks'], indexKeywords: ['Sechium edule'], abstract: 'Seed banks of chayote were studied in two regions of Veracruz.',
      refs: [['Smith J, 2001, NATURE, V1, P1', { firstAuthor: 'Smith J', year: 2001, source: 'NATURE', volume: '1', page: '1' }]] })],
    'one year': () => Array.from({ length: 5 }, (x, i) => rec({ title: 'Fruit quality of chayote landraces number ' + (i + 1), year: 2021, sourceTitle: i < 3 ? 'Econ Bot' : 'Rev Mex', timesCited: i,
      docTypeRaw: 'Article', authors: ['Lira, R.', 'Soto, B.'].slice(0, 1 + (i % 2)), affs: ['Instituto de Ecologia, Xalapa, Mexico', 'Universidad de Buenos Aires, Argentina'],
      authorKeywords: ['chayote', i % 2 ? 'fruit quality' : 'landraces', 'mexico'], refs: [['Lira R, 2015, ECON BOT, V69, P10', { firstAuthor: 'Lira R', year: 2015, source: 'ECON BOT', volume: '69', page: '10' }]] })),
    'titles only': () => ['Notes on a garden plant', 'Another short report', 'A third note'].map(title => rec({ title, timesCited: null })),
    'nothing left after the filters': () => SETS['one year'](),
    'no citations and references without year': () => [0, 1].map(i => rec({ title: 'Uncited study of squash pollinators ' + i, year: 2018 + i, sourceTitle: 'Plant J', timesCited: 0,
      docTypeRaw: 'Review', authors: ['Ruiz, C.'], authorKeywords: ['squash'], refs: [['Anonymous report on pollinators']] })),
  };
  const screens = () => {
    const list = [];
    ['cleaning', 'overview', 'sources', 'authors', 'documents', 'conceptual', 'intellectual', 'social', 'prisma', 'export'].forEach(id => {
      const M = window[id.charAt(0).toUpperCase() + id.slice(1) + 'Module'];
      (M && M.TABS ? M.TABS : [null]).forEach(tab => list.push([id, tab, M]));
    });
    return list;
  };

  Object.keys(SETS).forEach(name => {
    /* the richest collection is checked on screen in both languages; every report is written in both */
    const screenLangs = name === 'one document' ? ['es', 'en'] : ['es'];
    it(name + ': every screen (' + screenLangs.join(', ') + ') and the report in Spanish and English, without errors, NaN or divisions by zero', async () => {
      const problems = [];
      I18N.missing.clear();
      const log = await E2E.watch(async () => {
        for (const lang of screenLangs) {
          I18N.setLang(lang); App.boot(el('app')); pjReset();
          const records = SETS[name]();
          ImportModule.addResult({ name: 'extremo.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: P().completeness(records) });
          await Pipeline.pending;
          if (name === 'nothing left after the filters') { await Pipeline.update({ filters: Object.assign(P().emptyFilters(), { yearFrom: '2030' }) }); eq(Pipeline.records().length, 0); }
          for (const [id, tab, M] of screens()) {
            if (tab && M) M.tab = tab;
            location.hash = '#/' + id;
            App.render(id);
            await E2E.settle();
            E2E.badLines(E2E.textOf(Layout.view)).forEach(x => problems.push(lang + ' ' + id + '/' + tab + ' → ' + x));
          }
        }
        for (const lang of ['es', 'en']) {
          const model = await Report.build({ lang });
          E2E.badLines(Report.html(model).replace(/<[^>]+>/g, '\n')).forEach(x => problems.push(lang + ' report → ' + x));
          const blob = await Report.docx(model);
          ok(blob.size > 5000, 'the .docx is written');
        }
      });
      try {
        deepEq(log.errors, []); deepEq(log.toasts, []);
        deepEq([...I18N.missing], []);
        deepEq(problems, []);
      } finally { I18N.setLang('es'); pjReset(); location.hash = ''; }
    });
  });
});
