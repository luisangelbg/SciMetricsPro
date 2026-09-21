/* SciMetricsPro — Import · search the open catalogue through its API.
   Form → count (one request, in the page) → confirmation → download in a
   background worker with progress, retries and Cancel. The query, its filters
   and the date are kept with the downloaded set for the methods report.
   Part of the import screen, so the service may be named in its texts. */
'use strict';

const SearchPanel = {
  LANGS: ['en', 'es', 'pt', 'fr', 'de', 'zh'],
  form: null,          // current values (survive re-rendering and language changes)
  result: null,        // { count, query } after "count"
  busy: false,
  /* tests replace these: env for the network, inline to download without a worker */
  env: null,
  inline: false,

  defaults() {
    return { terms: '', yearFrom: '', yearTo: '', types: [], languages: [], oa: 'all', limit: 5000,
      apiKey: Prefs.get('openapiKey', ''), rememberKey: !!Prefs.get('openapiKey', '') };
  },

  pageEnv() {
    return SearchPanel.env || { fetch: (u, o) => fetch(u, o), sleep: ms => new Promise(r => setTimeout(r, ms)) };
  },

  query() {
    const f = SearchPanel.form;
    return { terms: f.terms.trim(), yearFrom: f.yearFrom, yearTo: f.yearTo, types: f.types.slice(), languages: f.languages.slice(), oa: f.oa };
  },

  validate() {
    const f = SearchPanel.form;
    if (!f.terms.trim()) return 'import.search.noTerms';
    const y0 = f.yearFrom === '' ? null : +f.yearFrom, y1 = f.yearTo === '' ? null : +f.yearTo;
    const bad = y => y != null && (!Number.isInteger(y) || y < 1500 || y > 2100);
    if (bad(y0) || bad(y1) || (y0 != null && y1 != null && y0 > y1)) return 'import.search.badYears';
    if (!(+f.limit >= 1)) return 'import.search.badLimit';
    return null;
  },

  errorText(err) {
    const info = Parsers.lib().openapiErrorInfo(err);
    if (!info) return t('errors.generic', { msg: err && err.message || String(err) });
    return t('import.search.errors.' + info.code, { status: info.status, msg: info.detail || String(info.status) });
  },

  async count(host) {
    const key = SearchPanel.validate();
    if (key) { SearchPanel.showMessage(host, t(key), 'error'); return null; }
    SearchPanel.saveKey();
    SearchPanel.busy = true;
    SearchPanel.render(host);
    try {
      const q = SearchPanel.query();
      const n = await Parsers.lib().openapiCount(q, SearchPanel.pageEnv(), SearchPanel.form.apiKey.trim());
      SearchPanel.result = { count: n, query: q, limit: Math.floor(+SearchPanel.form.limit) };
    } catch (e) {
      SearchPanel.result = null;
      SearchPanel.busy = false;
      SearchPanel.render(host);
      SearchPanel.showMessage(host, SearchPanel.errorText(e), 'error');
      return null;
    }
    SearchPanel.busy = false;
    SearchPanel.render(host);
    return SearchPanel.result.count;
  },

  async download(host) {
    const res = SearchPanel.result;
    if (!res || !res.count) return null;
    const payload = { query: res.query, limit: res.limit, apiKey: SearchPanel.form.apiKey.trim(), sort: 'cited_by_count:desc' };
    const started = new Date();
    let out;
    try {
      if (SearchPanel.inline) {
        out = await Parsers.lib().openapiDownload(payload, SearchPanel.pageEnv());
      } else {
        out = await ProgressOverlay.run({
          title: t('import.search.downloading'),
          fns: window.PARSER_PARTS,
          main: async function (p, progress) {
            const P = {};
            for (const name in __fns) __fns[name](P);
            return P.openapiDownload(p, { fetch: (u, o) => fetch(u, o), sleep: ms => new Promise(r => setTimeout(r, ms)), progress });
          },
          payload,
          formatMessage: info => SearchPanel.progressText(info),
        });
      }
    } catch (e) {
      if (SearchPanel.inline) throw e;
      SearchPanel.showMessage(host, SearchPanel.errorText(e), 'error');
      return null;
    }
    if (!out) return null;   // cancelled: nothing is added
    const P = Parsers.lib();
    const completeness = P.completeness(out.records);
    const warnings = P.warningsFor(out.records, completeness).filter(w => w.code !== 'noReferences' || out.records.every(r => !r.references.length));
    if (out.records.some(r => r.references.length)) warnings.unshift({ code: 'refsAsIds' });
    const search = {
      service: 'openapi', query: res.query, filter: P.openapiFilter(res.query), sort: payload.sort,
      date: started.toISOString(), count: out.count, limit: res.limit, downloaded: out.records.length, withKey: !!payload.apiKey,
    };
    /* cleared before adding: adding the data re-renders the screen, and the confirmation must be gone */
    SearchPanel.result = null;
    ImportModule.addResult({
      name: '', size: null, format: 'json', source: 'openapi', encoding: null,
      records: out.records, warnings, completeness, search,
    });
    toast(tp('import.search.done', out.records.length));
    return out;
  },

  saveKey() {
    const f = SearchPanel.form;
    if (f.rememberKey && f.apiKey.trim()) Prefs.set('openapiKey', f.apiKey.trim());
    else Prefs.del('openapiKey');
  },

  progressText(info) {
    if (!info || typeof info !== 'object') return '';
    if (info.retry) return t('import.search.retrying', { attempt: info.retry, max: info.max, s: info.seconds });
    return tp('import.search.progress', info.count, { page: fmtInt(info.page), done: fmtInt(info.n) });
  },

  showMessage(host, text, kind) {
    const box = host.querySelector('.search-message');
    if (!box) return;
    box.hidden = false;
    box.className = 'search-message note-' + (kind || 'info');
    box.textContent = text;
  },

  /* ---------------- form ---------------- */
  render(host) {
    if (!SearchPanel.form) SearchPanel.form = SearchPanel.defaults();
    const f = SearchPanel.form;
    host.innerHTML = '';
    const card = mk('section', { class: 'card search-card', id: 'searchPanel' });
    card.appendChild(mk('h2', null, esc(t('import.search.title'))));
    card.appendChild(mk('p', { class: 'hint' }, esc(t('import.search.intro'))));

    const form = mk('form', { class: 'search-form', novalidate: true });
    form.addEventListener('submit', e => { e.preventDefault(); SearchPanel.count(host); });
    const field = (cls, labelKey, control, hintKey, forId) => {
      const wrap = mk('div', { class: 'sf-field ' + (cls || '') });
      wrap.appendChild(mk('label', { class: 'sf-label', for: forId || null }, esc(t(labelKey))));
      wrap.appendChild(control);
      if (hintKey) wrap.appendChild(mk('p', { class: 'sf-hint' }, esc(t(hintKey))));
      form.appendChild(wrap);
      return wrap;
    };
    const bind = (input, key, num) => input.addEventListener('input', () => { f[key] = num ? input.value : input.value; SearchPanel.result = null; SearchPanel.clearResult(host); });

    const terms = mk('input', { type: 'text', id: 'searchTerms', value: f.terms, placeholder: t('import.search.termsPlaceholder'), autocomplete: 'off' });
    bind(terms, 'terms');
    field('sf-wide', 'import.search.terms', terms, 'import.search.termsHint', 'searchTerms');

    const years = mk('div', { class: 'sf-row' });
    const y0 = mk('input', { type: 'number', id: 'searchYearFrom', min: 1500, max: 2100, step: 1, value: f.yearFrom, placeholder: t('import.search.yearAny'), 'aria-label': t('import.search.yearFrom') });
    const y1 = mk('input', { type: 'number', id: 'searchYearTo', min: 1500, max: 2100, step: 1, value: f.yearTo, placeholder: t('import.search.yearAny'), 'aria-label': t('import.search.yearTo') });
    bind(y0, 'yearFrom'); bind(y1, 'yearTo');
    years.appendChild(y0); years.appendChild(mk('span', { class: 'sf-dash', 'aria-hidden': 'true' }, '–')); years.appendChild(y1);
    field('', 'import.search.years', years, null, 'searchYearFrom');

    const limit = mk('input', { type: 'number', id: 'searchLimit', min: 1, max: 100000, step: 100, value: f.limit });
    bind(limit, 'limit', true);
    field('', 'import.search.limit', limit, 'import.search.limitHint', 'searchLimit');

    const checks = (key, values, labelOf, id) => {
      const box = mk('div', { class: 'sf-checks', id, role: 'group' });
      values.forEach(v => {
        const lab = mk('label', { class: 'sf-check' });
        const cb = mk('input', { type: 'checkbox', value: v });
        cb.checked = f[key].includes(v);
        cb.addEventListener('change', () => {
          f[key] = values.filter(x => (x === v ? cb.checked : f[key].includes(x)));
          SearchPanel.result = null; SearchPanel.clearResult(host);
        });
        lab.appendChild(cb);
        lab.appendChild(mk('span', null, esc(labelOf(v))));
        box.appendChild(lab);
      });
      return box;
    };
    const P = Parsers.lib();
    const typesBox = checks('types', P.OPENAPI_TYPES, v => t('import.search.types.' + v.replace('-', '_')), 'searchTypes');
    typesBox.setAttribute('aria-label', t('import.search.type'));
    field('sf-wide', 'import.search.type', typesBox, 'import.search.allWhenEmpty');
    const langBox = checks('languages', SearchPanel.LANGS, v => t('import.search.langs.' + v), 'searchLangs');
    langBox.setAttribute('aria-label', t('import.search.language'));
    field('sf-wide', 'import.search.language', langBox, 'import.search.allWhenEmpty');

    const oa = mk('div', { class: 'sf-seg', role: 'radiogroup', id: 'searchOa', 'aria-label': t('import.search.oa') });
    ['all', 'yes', 'no'].forEach(v => {
      const lab = mk('label', { class: 'sf-seg-item' });
      const rb = mk('input', { type: 'radio', name: 'searchOa', value: v });
      rb.checked = f.oa === v;
      rb.addEventListener('change', () => { if (rb.checked) { f.oa = v; SearchPanel.result = null; SearchPanel.clearResult(host); } });
      lab.appendChild(rb);
      lab.appendChild(mk('span', null, esc(t('import.search.oa_' + v))));
      oa.appendChild(lab);
    });
    field('', 'import.search.oa', oa);

    const keyWrap = mk('div', { class: 'sf-key' });
    const key = mk('input', { type: 'password', id: 'searchKey', value: f.apiKey, autocomplete: 'off', spellcheck: 'false' });
    key.addEventListener('input', () => { f.apiKey = key.value; });
    const remember = mk('label', { class: 'sf-check' });
    const rcb = mk('input', { type: 'checkbox', id: 'searchRemember' });
    rcb.checked = f.rememberKey;
    rcb.addEventListener('change', () => { f.rememberKey = rcb.checked; SearchPanel.saveKey(); });
    remember.appendChild(rcb);
    remember.appendChild(mk('span', null, esc(t('import.search.rememberKey'))));
    keyWrap.appendChild(key);
    keyWrap.appendChild(remember);
    field('sf-wide', 'import.search.apiKey', keyWrap, 'import.search.apiKeyHint', 'searchKey');

    const actions = mk('div', { class: 'sf-actions sf-wide' });
    const countBtn = mk('button', { type: 'submit', class: 'btn btn-primary', id: 'searchCount', disabled: SearchPanel.busy },
      icon('search') + '<span>' + esc(t(SearchPanel.busy ? 'import.search.counting' : 'import.search.count')) + '</span>');
    actions.appendChild(countBtn);
    form.appendChild(actions);
    card.appendChild(form);

    card.appendChild(mk('p', { class: 'search-message', role: 'status', hidden: true }));
    const resultBox = mk('div', { class: 'search-result', id: 'searchResult' });
    card.appendChild(resultBox);
    SearchPanel.renderResult(host, resultBox);
    host.appendChild(card);

    const note = mk('aside', { class: 'card search-note' });
    note.appendChild(mk('h3', null, icon('sparkle') + '<span>' + esc(t('import.search.noteTitle')) + '</span>'));
    note.appendChild(mk('p', null, esc(t('import.search.note'))));
    host.appendChild(note);
  },

  clearResult(host) {
    const box = host.querySelector('#searchResult');
    if (box) box.innerHTML = '';
    const msg = host.querySelector('.search-message');
    if (msg) msg.hidden = true;
  },

  renderResult(host, box) {
    const res = SearchPanel.result;
    box.innerHTML = '';
    if (!res) return;
    const get = Math.min(res.count, res.limit);
    const pages = Math.ceil(get / 200);
    const panel = mk('div', { class: 'search-confirm' });
    panel.appendChild(mk('p', { class: 'search-count', id: 'searchCountText' }, esc(tp('import.search.found', res.count))));
    if (!res.count) {
      panel.appendChild(mk('p', { class: 'hint' }, esc(t('import.search.nothing'))));
      box.appendChild(panel);
      return;
    }
    panel.appendChild(mk('p', null, esc(t('import.search.willDownload', { records: tp('import.search.records', get), pages: tp('import.search.pages', pages) }))));
    if (res.count > res.limit) panel.appendChild(mk('p', { class: 'hint' }, esc(tp('import.search.limited', res.limit))));
    if (!SearchPanel.form.apiKey.trim() && pages > 80) panel.appendChild(mk('p', { class: 'note-warn' }, esc(t('import.search.budget'))));
    const row = mk('div', { class: 'sf-actions' });
    const go = mk('button', { type: 'button', class: 'btn btn-primary', id: 'searchDownload' }, icon('download') + '<span>' + esc(t('import.search.confirm')) + '</span>');
    go.addEventListener('click', () => SearchPanel.download(host));
    const back = mk('button', { type: 'button', class: 'btn btn-secondary', id: 'searchChange' }, esc(t('import.search.change')));
    back.addEventListener('click', () => { SearchPanel.result = null; SearchPanel.clearResult(host); const tEl = host.querySelector('#searchTerms'); if (tEl) tEl.focus(); });
    row.appendChild(go); row.appendChild(back);
    panel.appendChild(row);
    box.appendChild(panel);
  },
};

window.SearchPanel = SearchPanel;
