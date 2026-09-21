/* SciMetricsPro — home page: what the app is, how it is used, what it analyses. */
'use strict';

const Home = {
  render(host) {
    host.innerHTML = '';
    const page = mk('article', { class: 'home' });

    /* ---------- hero ---------- */
    const hero = mk('section', { class: 'hero' });
    const inner = mk('div', { class: 'hero-inner' });
    const copy = mk('div', { class: 'hero-copy' });
    copy.appendChild(mk('div', { class: 'eyebrow' }, esc(t('home.eyebrow'))));
    copy.appendChild(mk('h1', { tabindex: '-1' }, esc(t('home.titleA')) + ' <span class="accent">' + esc(t('home.titleB')) + '</span>'));
    copy.appendChild(mk('p', { class: 'lead' }, esc(t('home.lead'))));
    const cta = mk('div', { class: 'hero-cta' });
    const bImport = mk('button', { type: 'button', class: 'btn btn-primary btn-lg', id: 'homeImport' }, icon('upload') + '<span>' + esc(t('home.ctaImport')) + '</span>');
    bImport.addEventListener('click', () => App.go('import'));
    const bExample = mk('button', { type: 'button', class: 'btn btn-secondary btn-lg', id: 'homeExample' },
      icon('sparkle') + '<span>' + esc(t('home.ctaExample')) + '</span>');
    bExample.addEventListener('click', () => Home.loadExample());
    cta.appendChild(bImport); cta.appendChild(bExample);
    copy.appendChild(cta);
    const note = mk('p', { class: 'hero-note' }, esc(t('home.example.note')) + ' ');
    const bTour = mk('button', { type: 'button', class: 'link-btn', id: 'homeTour' }, icon('compass') + '<span>' + esc(t('tour.start')) + '</span>');
    bTour.addEventListener('click', () => Tour.start());
    note.appendChild(bTour);
    copy.appendChild(note);
    const badges = mk('div', { class: 'badge-row' });
    ['local', 'formulas', 'dpi', 'bilingual'].forEach(k => badges.appendChild(mk('span', { class: 'badge' },
      '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' + esc(t('home.badges.' + k)))));
    copy.appendChild(badges);
    inner.appendChild(copy);
    const art = mk('div', { class: 'hero-art' });
    art.appendChild(Home.art());
    inner.appendChild(art);
    hero.appendChild(inner);
    page.appendChild(hero);

    /* ---------- steps ---------- */
    page.appendChild(mk('h2', { class: 'section-title' }, esc(t('home.stepsTitle'))));
    page.appendChild(mk('p', { class: 'section-sub' }, esc(t('home.stepsSub'))));
    const steps = mk('div', { class: 'steps' });
    [['s1', 'import', 'upload'], ['s2', 'cleaning', 'filter'], ['s3', 'overview', 'gauge'], ['s4', 'export', 'download']].forEach(([k, route, ico], i) => {
      const card = mk('button', { type: 'button', class: 'step-card', 'data-route': route });
      card.appendChild(mk('div', { class: 'step-top' },
        `<span class="step-num">${i + 1}</span><span class="step-kicker">${esc(t('home.stepLabel', { n: i + 1 }))}</span><span class="step-icon">${icon(ico)}</span>`));
      card.appendChild(mk('h3', null, esc(t('home.steps.' + k + '.title'))));
      card.appendChild(mk('p', null, esc(t('home.steps.' + k + '.text'))));
      card.addEventListener('click', () => App.go(route));
      steps.appendChild(card);
    });
    page.appendChild(steps);

    /* ---------- modules ---------- */
    page.appendChild(mk('h2', { class: 'section-title' }, esc(t('home.modulesTitle'))));
    page.appendChild(mk('p', { class: 'section-sub' }, esc(t('home.modulesSub'))));
    const groups = mk('div', { class: 'group-grid' });
    /* four columns: the two one-module groups (review, results) share the last one */
    const cols = [0, 1, 2, 3].map(() => groups.appendChild(mk('div', { class: 'group-col' })));
    const colOf = { data: 0, descriptive: 1, structures: 2, review: 3, results: 3 };
    Modules.groups.forEach(g => {
      const card = mk('section', { class: 'card group-card' });
      card.appendChild(mk('h3', null, esc(t('nav.groups.' + g))));
      Modules.inGroup(g).forEach(m => {
        const b = mk('button', { type: 'button', class: 'mod-link', 'data-route': m.id },
          `<span class="mod-ico">${icon(m.icon)}</span><span><strong>${esc(t('mod.' + m.id + '.heading'))}</strong><span class="mod-desc">${esc(t('mod.' + m.id + '.desc'))}</span></span>`);
        b.addEventListener('click', () => App.go(m.id));
        card.appendChild(b);
      });
      cols[colOf[g] != null ? colOf[g] : 3].appendChild(card);
    });
    page.appendChild(groups);

    /* ---------- principles ---------- */
    page.appendChild(mk('h2', { class: 'section-title' }, esc(t('home.whyTitle'))));
    const why = mk('div', { class: 'why-grid' });
    [['local', 'lock'], ['rigor', 'sigma'], ['publish', 'image'], ['bilingual', 'globe']].forEach(([k, ico]) => {
      why.appendChild(mk('div', { class: 'card why' },
        `<span class="w-icon">${icon(ico)}</span><h3>${esc(t('home.why.' + k + '.title'))}</h3><p>${esc(t('home.why.' + k + '.text'))}</p>`));
    });
    page.appendChild(why);

    host.appendChild(page);
  },

  /* Hero illustration: annual output with its trend, a co-authorship network with
     three communities, and a thematic map. Drawn for this app; coloured by CSS tokens. */
  art() {
    const s = svgEl('svg', { viewBox: '0 0 540 420', role: 'img', 'aria-label': t('home.artLabel') });
    const panel = (x, y, w, h) => {
      s.appendChild(svgEl('rect', { x: x + 3, y: y + 6, width: w, height: h, rx: 16, class: 'art-shadow' }));
      s.appendChild(svgEl('rect', { x, y, width: w, height: h, rx: 16, class: 'art-panel' }));
    };
    const label = (x, y, text) => s.appendChild(svgEl('text', { x, y, class: 'art-label' }, text.toUpperCase()));

    /* panel 1 — annual output */
    panel(18, 16, 300, 190);
    label(36, 42, t('home.art.growth'));
    const base = 186, x0 = 40, bw = 16, gap = 5.6;
    const counts = [3, 4, 4, 6, 5, 8, 9, 12, 11, 15, 19, 24];
    [66, 110, 154].forEach(y => s.appendChild(svgEl('line', { x1: 36, y1: y, x2: 300, y2: y, class: 'art-grid' })));
    s.appendChild(svgEl('line', { x1: 36, y1: base, x2: 300, y2: base, class: 'art-axis' }));
    const pts = [];
    counts.forEach((c, i) => {
      const h = c * 4.9, x = x0 + i * (bw + gap);
      s.appendChild(svgEl('rect', { x, y: base - h, width: bw, height: h, rx: 3, class: i >= counts.length - 3 ? 'art-bar' : 'art-bar-soft' }));
      pts.push([x + bw / 2, base - 3.1 * Math.exp(0.186 * i) * 4.9]);   /* exponential growth fitted to the bars */
    });
    s.appendChild(svgEl('path', { d: 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L'), class: 'art-trend' }));
    [0, 4, 8, 11].forEach(i => s.appendChild(svgEl('circle', { cx: pts[i][0], cy: pts[i][1], r: 4, class: 'art-dot' })));

    /* panel 2 — co-authorship network */
    panel(222, 128, 300, 250);
    label(240, 154, t('home.art.network'));
    const nodes = [
      [300, 220, 13, 1], [262, 196, 7, 1], [268, 252, 8, 1], [330, 190, 7, 1], [318, 262, 6, 1],
      [420, 206, 15, 2], [454, 178, 7, 2], [470, 232, 9, 2], [402, 244, 7, 2], [440, 262, 6, 2],
      [372, 318, 12, 3], [334, 340, 7, 3], [410, 346, 8, 3], [392, 292, 6, 3], [352, 294, 6, 4],
    ];
    const edges = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [3, 4], [5, 6], [5, 7], [5, 8], [5, 9], [7, 9], [6, 7],
      [10, 11], [10, 12], [10, 13], [11, 12], [0, 5, 1], [5, 10, 1], [0, 10, 1], [4, 14], [14, 10], [8, 13], [3, 8]];
    edges.forEach(([a, b, strong]) => s.appendChild(svgEl('line', {
      x1: nodes[a][0], y1: nodes[a][1], x2: nodes[b][0], y2: nodes[b][1], class: strong ? 'art-edge-strong' : 'art-edge',
    })));
    nodes.forEach(([x, y, r, c]) => {
      s.appendChild(svgEl('circle', { cx: x, cy: y, r, class: 'art-n' + c }));
      s.appendChild(svgEl('circle', { cx: x, cy: y, r, class: 'art-halo' }));
    });

    /* panel 3 — thematic map */
    panel(18, 228, 196, 176);
    label(36, 254, t('home.art.themes'));
    s.appendChild(svgEl('line', { x1: 116, y1: 266, x2: 116, y2: 390, class: 'art-axis' }));
    s.appendChild(svgEl('line', { x1: 32, y1: 328, x2: 200, y2: 328, class: 'art-axis' }));
    [[160, 294, 17, 1], [74, 296, 11, 2], [156, 360, 12, 3], [68, 364, 9, 4], [138, 312, 7, 2], [92, 348, 6, 1]]
      .forEach(([x, y, r, c]) => s.appendChild(svgEl('circle', { cx: x, cy: y, r, class: 'art-bubble' + c })));
    return s;
  },

  /* ---------- example data ----------
     data/example.js (about 1.3 MB) is loaded only when asked for, as a script, which also works from file://. The works go
     through the same reader and the same import path as a search in the open catalogue, with the search written down. */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = mk('script', { src });
      s.addEventListener('load', resolve);
      s.addEventListener('error', () => reject(new Error(src)));
      document.head.appendChild(s);
    });
  },

  exampleRecords() {
    const ex = window.SMP_EXAMPLE, P = Parsers.lib();
    const records = ex.works.map(w => P.mapOpenapiWork(w));
    const completeness = P.completeness(records);
    const warnings = [{ code: 'refsAsIds' }].concat(P.warningsFor(records, completeness).filter(w => w.code !== 'noReferences'));
    return {
      name: t('home.example.file'), label: t('home.example.label'), size: 0, format: 'json', source: 'openapi', records, warnings, completeness,
      search: { service: 'openapi', query: ex.query, filter: ex.filter, sort: ex.sort, date: ex.date, count: ex.count, limit: ex.downloaded, downloaded: ex.downloaded, withKey: false, example: true },
    };
  },

  async loadExample() {
    if (hasData() && !window.confirm(t('home.example.confirm'))) return false;
    const btn = el('homeExample');
    if (btn) btn.disabled = true;
    try {
      if (!window.SMP_EXAMPLE) await Home.loadScript(APP.assetBase + 'data/example.js');
      const res = Home.exampleRecords();
      if (hasData()) ImportModule.clear();
      ImportModule.addResult(res);
      await Pipeline.pending;
      toast(tp('home.example.loaded', res.records.length));
      App.go('overview');
      return true;
    } catch (e) {
      toast(t('home.example.failed'), 'error');
      return false;
    } finally {
      if (btn && btn.isConnected) btn.disabled = false;
    }
  },
};

window.Home = Home;
