/* Search in the open catalogue: query URL, mapping of works, paging with retries, errors, and the search panel. */
'use strict';

/* a fake network: pages of results, and failures on demand */
function fakeApi(opts) {
  const calls = [];
  const total = opts.total;
  const perPage = () => 200;
  const failures = (opts.failures || []).slice();   // e.g. [429, 500] answered before the next real page
  const fetch = async (url) => {
    calls.push(url);
    if (opts.networkDown) throw new TypeError('Failed to fetch');
    if (failures.length) {
      const status = failures.shift();
      return { ok: false, status, json: async () => ({ error: 'Error', message: status === 400 ? 'Invalid query parameters error.' : 'Failure ' + status }) };
    }
    const u = new URL(url);
    if (u.searchParams.get('per_page') === '1') return { ok: true, status: 200, json: async () => ({ meta: { count: total }, results: [{ id: 'W0' }] }) };
    const cursor = u.searchParams.get('cursor');
    const page = cursor === '*' ? 0 : +cursor.replace('c', '');
    const start = page * perPage();
    const n = Math.max(0, Math.min(perPage(), total - start));
    const results = Array.from({ length: n }, (x, i) => Object.assign({}, FIXTURES.openapiWork, { id: 'https://example.org/W' + (start + i + 1), cited_by_count: total - start - i }));
    const next = start + n < total ? 'c' + (page + 1) : null;
    return { ok: true, status: 200, json: async () => ({ meta: { count: total, next_cursor: next }, results }) };
  };
  const sleeps = [];
  return { fetch, calls, sleeps, sleep: async ms => { sleeps.push(ms); } };
}

describe('open catalogue · query', () => {
  const P = () => Parsers.lib();
  it('builds the filter from terms, years, types, languages and open access', () => {
    eq(P().openapiFilter({ terms: '"Sechium edule" OR chayote', yearFrom: '2000', yearTo: '2024', types: ['article', 'review'], languages: ['en', 'es'], oa: 'yes' }),
      'title_and_abstract.search:"Sechium edule" OR chayote,publication_year:2000-2024,type:article|review,language:en|es,is_oa:true');
    eq(P().openapiFilter({ terms: 'maize, landraces', yearFrom: '2010', types: [], languages: [], oa: 'all' }), 'title_and_abstract.search:maize landraces,publication_year:>2009');
    eq(P().openapiFilter({ terms: 'x', yearTo: '1999', oa: 'no' }), 'title_and_abstract.search:x,publication_year:<2000,is_oa:false');
    eq(P().openapiFilter({ terms: 'x', yearFrom: '2024', yearTo: '2000' }), 'title_and_abstract.search:x,publication_year:2000-2024');
  });
  it('builds the URL with page size, cursor, order, fields and key', () => {
    const url = P().openapiUrl({ terms: '"Sechium edule"' }, { perPage: 200, cursor: '*', sort: 'cited_by_count:desc', apiKey: 'k 1' });
    ok(url.startsWith(P().OPENAPI_ENDPOINT + '?filter=title_and_abstract.search:%22Sechium%20edule%22&per_page=200&cursor=*&sort=cited_by_count:desc&select=id,doi,'), url);
    ok(url.endsWith('&api_key=k%201'), 'key encoded');
    const u = new URL(url);
    eq(u.searchParams.get('filter'), 'title_and_abstract.search:"Sechium edule"');
    eq(u.searchParams.get('select').split(',').length, P().OPENAPI_SELECT.length);
    const count = new URL(P().openapiUrl({ terms: 'x' }, { perPage: 1, select: false }));
    eq(count.searchParams.get('select'), 'id'); eq(count.searchParams.get('api_key'), null);
  });
  it('rebuilds the abstract from the inverted index, including tokens with spaces', () => {
    eq(Parsers.lib().invertedAbstract(FIXTURES.openapiWork.abstract_inverted_index), 'Chayote is a cucurbit with antioxidant activity');
    eq(Parsers.lib().invertedAbstract(null), '');
  });
});

describe('open catalogue · works → records', () => {
  it('maps identifiers, source, authors, countries, keywords, funding and references', () => {
    const r = Parsers.lib().mapOpenapiWork(FIXTURES.openapiWork);
    eq(r.source, 'openapi'); eq(r.format, 'json'); eq(r.accession, 'W1000000001');
    eq(r.doi, '10.1016/j.example.2019.01.001'); eq(r.pmid, '30000001');
    eq(r.year, 2019); eq(r.language, 'en'); eq(r.docType, 'article');
    eq(r.sourceTitle, 'Journal of Example Food Science'); deepEq(r.issn, ['1234-5678', '8765-4321']); eq(r.publisher, 'Example Publisher');
    eq(r.volume, '12'); eq(r.issue, '2'); eq(r.pages, '101-110'); eq(r.timesCited, 42); eq(r.openAccess, true);
    eq(r.abstract, 'Chayote is a cucurbit with antioxidant activity');
    deepEq(r.authors.map(a => a.short), ['Yen G.C.', 'Cadena-Iñiguez J.', 'GOMEZ J.']);
    deepEq(r.authors.map(a => a.id), ['A1', 'A2', 'A3']);
    eq(r.authors[0].orcid, '0000-0000-0000-0001');
    deepEq(r.authors.map(a => a.country), ['TW', 'MX', null]);
    deepEq(r.authors[0].affiliations, ['Department of Food Science, National Chung Hsing University, Taichung, Taiwan']);
    deepEq(r.authors[1].affiliations, ['Colegio de Postgraduados', 'Example Research Group']);
    deepEq(r.countries, ['TW', 'MX']);
    eq(r.correspondingAuthor, 'Cadena-Iñiguez J.'); eq(r.correspondingCountry, 'MX');
    deepEq(r.indexKeywords, ['Chayote', 'antioxidant', 'Phytochemicals and antioxidant activity', 'Cucurbitaceae']);
    deepEq(r.subjectAreas, ['Food Science', 'Agricultural and Biological Sciences']);
    eq(r.fundingText, 'Example Science Council (ABC-123); Example Foundation');
    deepEq(r.references.map(x => x.raw), ['W2', 'W3']);
    ok(!r.originalRaw.includes('abstract_inverted_index') && r.originalRaw.includes('"cited_by_count":42'), 'raw record without the index');
  });
  it('document types of the catalogue', () => {
    const P = Parsers.lib();
    const t = (type, extra) => P.mapOpenapiWork(Object.assign({}, FIXTURES.openapiWork, { type }, extra || {})).docType;
    deepEq([t('book-chapter'), t('dissertation'), t('dataset'), t('peer-review'), t('review'), t('preprint'), t('article', { is_retracted: true })],
      ['chapter', 'thesis', 'data', 'other', 'review', 'preprint', 'retracted']);
  });
  it('names written "Given Surname"', () => {
    const P = Parsers.lib();
    const cases = [['Adriana A.L. Ordóñez', 'Ordóñez', 'A.A.L.'], ['J GOMEZ', 'GOMEZ', 'J.'], ['María de la Cruz', 'de la Cruz', 'M.'],
      ['Gow\u2010Chin Yen', 'Yen', 'G.C.'], ['George J. Flick Jr.', 'Flick', 'G.J.'], ['Madonna', 'Madonna', '']];
    deepEq(cases.map(([raw]) => { const p = P.personFirstLast(raw); return [p.last, p.initials]; }), cases.map(c => [c[1], c[2]]));
  });
});

describe('open catalogue · download', () => {
  const P = () => Parsers.lib();
  const q = { terms: 'x', yearFrom: '', yearTo: '', types: [], languages: [], oa: 'all' };
  it('follows the cursor to the end and reports progress', async () => {
    const api = fakeApi({ total: 450 });
    const seen = [];
    const out = await P().openapiDownload({ query: q, limit: 5000 }, { fetch: api.fetch, sleep: api.sleep, progress: (f, info) => seen.push([f, info.page]) });
    eq(out.records.length, 450); eq(out.count, 450); eq(out.pages, 3);
    deepEq(out.records.slice(0, 2).map(r => r.accession), ['W1', 'W2']);
    eq(new URL(api.calls[1]).searchParams.get('cursor'), 'c1');
    ok(api.calls.every(u => new URL(u).searchParams.get('sort') === 'cited_by_count:desc'), 'sorted by citations');
    deepEq(seen.map(s => s[1]), [1, 2, 3]);
    eq(seen[seen.length - 1][0], 1);
  });
  it('stops at the limit', async () => {
    const api = fakeApi({ total: 1546 });
    const out = await P().openapiDownload({ query: q, limit: 250 }, { fetch: api.fetch, sleep: api.sleep });
    eq(out.records.length, 250); eq(out.pages, 2); eq(api.calls.length, 2);
  });
  it('waits and retries after 429 and 5xx, with growing pauses', async () => {
    const api = fakeApi({ total: 10, failures: [429, 503, 500] });
    const retries = [];
    const out = await P().openapiDownload({ query: q, limit: 100 }, { fetch: api.fetch, sleep: api.sleep, progress: (f, info) => { if (info.retry) retries.push(info.retry); } });
    eq(out.records.length, 10);
    deepEq(api.sleeps, [1000, 2000, 4000]);
    deepEq(retries, [1, 2, 3]);
  });
  it('gives up after the retries with a usage-limit error', async () => {
    const api = fakeApi({ total: 10, failures: [429, 429, 429, 429, 429, 429] });
    const e = await rejects(P().openapiDownload({ query: q, limit: 100 }, { fetch: api.fetch, sleep: api.sleep }));
    deepEq(P().openapiErrorInfo(e), { code: 'rateLimit', status: 429, detail: 'Failure 429' });
    eq(api.sleeps.length, 5);
  });
  it('network, key and query errors are told apart', async () => {
    const net = fakeApi({ total: 10, networkDown: true });
    eq(P().openapiErrorInfo(await rejects(P().openapiCount(q, { fetch: net.fetch, sleep: net.sleep }))).code, 'network');
    const auth = fakeApi({ total: 10, failures: [401] });
    eq(P().openapiErrorInfo(await rejects(P().openapiCount(q, { fetch: auth.fetch, sleep: auth.sleep }, 'bad'))).code, 'auth');
    const bad = fakeApi({ total: 10, failures: [400] });
    deepEq(P().openapiErrorInfo(await rejects(P().openapiCount(q, { fetch: bad.fetch, sleep: bad.sleep }))), { code: 'badRequest', status: 400, detail: 'Invalid query parameters error.' });
    eq(P().openapiErrorInfo(new Error('something else')), null);
  });
  it('the count asks for a single identifier', async () => {
    const api = fakeApi({ total: 1546 });
    eq(await P().openapiCount(q, { fetch: api.fetch, sleep: api.sleep }), 1546);
    eq(new URL(api.calls[0]).searchParams.get('per_page'), '1');
  });
});

describe('open catalogue · search panel', () => {
  const setup = total => {
    const api = fakeApi({ total });
    SearchPanel.env = { fetch: api.fetch, sleep: api.sleep };
    SearchPanel.inline = true;
    SearchPanel.form = null; SearchPanel.result = null;
    ImportModule.clear();
    ImportModule.tab = 'search';
    App.render('import');
    return { api, host: el('panel-search') };
  };
  const teardown = () => { SearchPanel.env = null; SearchPanel.inline = false; SearchPanel.form = null; SearchPanel.result = null; ImportModule.tab = 'files'; ImportModule.clear(); };

  it('shows the form with its note and no text outside the dictionaries', () => {
    I18N.setLang('es');
    setup(0);
    ok(el('searchTerms') && el('searchYearFrom') && el('searchLimit') && el('searchKey'), 'fields');
    eq(el('searchLimit').value, '5000');
    eq(el('tab-search').getAttribute('aria-selected'), 'true');
    ok(el('view').querySelector('.search-note'), 'coverage note');
    const stray = [];
    ['es', 'en'].forEach(lang => { I18N.setLang(lang); strayTexts(el('app'), lang).forEach(s => stray.push(lang + ': ' + s)); });
    I18N.setLang('es');
    deepEq(stray, []);
    teardown();
  });

  it('validates the form before asking', async () => {
    const { host, api } = setup(10);
    await SearchPanel.count(host);
    eq(host.querySelector('.search-message').textContent, 'Escribe al menos un término de búsqueda.');
    SearchPanel.form.terms = 'x'; SearchPanel.form.yearFrom = '2024'; SearchPanel.form.yearTo = '2000';
    await SearchPanel.count(host);
    ok(host.querySelector('.search-message').textContent.startsWith('Revisa los años'), 'years');
    eq(api.calls.length, 0);
    teardown();
  });

  it('counts, asks for confirmation and downloads into the imported sets', async () => {
    const { host } = setup(450);
    SearchPanel.form.terms = '"Sechium edule"'; SearchPanel.form.limit = 300; SearchPanel.form.types = ['article'];
    const n = await SearchPanel.count(host);
    eq(n, 450);
    eq(el('searchCountText').textContent, 'Se encontraron 450 registros.');
    ok(el('searchResult').textContent.includes('Se descargarán 300 registros en 2 páginas.'), 'will download');
    ok(el('searchResult').textContent.includes('los 300 registros más citados'), 'limited');
    const out = await SearchPanel.download(el('panel-search'));
    eq(out.records.length, 300);
    eq(state.files.length, 1);
    const f = state.files[0];
    eq(f.source, 'openapi'); eq(f.count, 300);
    deepEq([f.search.query.terms, f.search.filter, f.search.count, f.search.downloaded, f.search.limit, f.search.withKey],
      ['"Sechium edule"', 'title_and_abstract.search:"Sechium edule",type:article', 450, 300, 300, false]);
    ok(!isNaN(Date.parse(f.search.date)), 'date kept');
    deepEq(ImportModule.searches().length, 1);
    ok(f.warnings.some(w => w.code === 'refsAsIds'), 'references as identifiers');
    const row = el('view').querySelector('.files-table tbody tr');
    eq(row.querySelector('.file-name span').firstChild.textContent, t('import.search.rowName', { query: '"Sechium edule"' }));
    eq(row.querySelector('.chip').textContent, t('import.detected', { source: t('import.sourceNames.openapi'), format: t('import.formatNames.json') }));
    ok(el('importPreview'), 'preview shown under the search tab');
    eq(el('searchResult').textContent, '', 'the confirmation disappears after downloading');
    eq(el('searchDownload'), null);
    teardown();
  });

  it('a failed count shows the reason and nothing is downloaded', async () => {
    const { host } = setup(10);
    SearchPanel.env.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    SearchPanel.form.terms = 'x';
    eq(await SearchPanel.count(host), null);
    eq(el('panel-search').querySelector('.search-message').textContent, t('import.search.errors.auth'));
    eq(state.files.length, 0);
    teardown();
  });

  it('the key is remembered only when asked', () => {
    SearchPanel.form = SearchPanel.defaults();
    SearchPanel.form.apiKey = 'secret'; SearchPanel.form.rememberKey = false; SearchPanel.saveKey();
    eq(Prefs.get('openapiKey', null), null);
    SearchPanel.form.rememberKey = true; SearchPanel.saveKey();
    eq(Prefs.get('openapiKey', null), 'secret');
    SearchPanel.form.rememberKey = false; SearchPanel.saveKey();
    eq(Prefs.get('openapiKey', null), null);
    SearchPanel.form = null;
  });
});
