/* SciMetricsPro — records from the open bibliographic catalogue queried through its API ('openapi').
   Builds the query URL, counts results, downloads with cursor paging and retries,
   and maps each work to a BiblioRecord. Runs in the page (count) and in a
   background worker (download); network access goes through env.fetch so the
   tests can replace it.

   The endpoint address and the JSON field names are data of the external service
   and are written as they are. */
'use strict';

function smpOpenapi(P) {
  P.OPENAPI_ENDPOINT = 'https://api.openalex.org/works';
  P.OPENAPI_SELECT = ['id', 'doi', 'title', 'display_name', 'publication_year', 'publication_date', 'ids', 'language',
    'primary_location', 'type', 'open_access', 'authorships', 'cited_by_count', 'biblio', 'is_retracted', 'topics',
    'keywords', 'concepts', 'mesh', 'funders', 'awards', 'referenced_works', 'abstract_inverted_index'];
  P.OPENAPI_TYPES = ['article', 'review', 'book-chapter', 'book', 'preprint', 'dissertation', 'dataset', 'other'];

  const shortId = s => String(s || '').replace(/^https?:\/\/[^/]+\//, '');

  /* query: { terms, yearFrom, yearTo, types: [], languages: [], oa: 'all'|'yes'|'no' } */
  P.openapiFilter = function (query) {
    const parts = [];
    /* commas separate filters, so they cannot appear inside the search terms */
    const terms = P.clean(String(query.terms || '').replace(/,/g, ' '));
    if (terms) parts.push('title_and_abstract.search:' + terms);
    const y0 = parseInt(query.yearFrom, 10), y1 = parseInt(query.yearTo, 10);
    if (y0 && y1) parts.push('publication_year:' + Math.min(y0, y1) + '-' + Math.max(y0, y1));
    else if (y0) parts.push('publication_year:>' + (y0 - 1));
    else if (y1) parts.push('publication_year:<' + (y1 + 1));
    if (query.types && query.types.length) parts.push('type:' + query.types.join('|'));
    if (query.languages && query.languages.length) parts.push('language:' + query.languages.join('|'));
    if (query.oa === 'yes') parts.push('is_oa:true');
    if (query.oa === 'no') parts.push('is_oa:false');
    return parts.join(',');
  };

  /* opts: { perPage, cursor, select (bool), apiKey, sort } */
  P.openapiUrl = function (query, opts) {
    opts = opts || {};
    const params = [['filter', P.openapiFilter(query)], ['per_page', String(opts.perPage || 200)]];
    if (opts.cursor) params.push(['cursor', opts.cursor]);
    if (opts.sort) params.push(['sort', opts.sort]);
    params.push(['select', opts.select === false ? 'id' : P.OPENAPI_SELECT.join(',')]);
    if (opts.apiKey) params.push(['api_key', opts.apiKey]);
    return P.OPENAPI_ENDPOINT + '?' + params.map(([k, v]) => k + '=' + encodeURIComponent(v).replace(/%2C/g, ',').replace(/%7C/g, '|').replace(/%3A/g, ':')).join('&');
  };

  /* {word: [positions]} → text */
  P.invertedAbstract = function (index) {
    if (!index || typeof index !== 'object') return '';
    const words = [];
    for (const w of Object.keys(index)) for (const pos of index[w]) words[pos] = w;
    return words.filter(x => x != null).join(' ');
  };

  const TYPE_MAP = { 'book-chapter': 'chapter', dissertation: 'thesis', dataset: 'data', 'peer-review': 'other', paratext: 'other',
    standard: 'other', libguides: 'other', 'supplementary-materials': 'other', retraction: 'retracted', other: 'other' };

  P.mapOpenapiWork = function (w) {
    const r = P.newRecord();
    r.source = 'openapi'; r.format = 'json';
    r.accession = shortId(w.id);
    r.title = w.title || w.display_name || '';
    r.year = w.publication_year != null ? w.publication_year : null;
    r.doi = w.doi || (w.ids && w.ids.doi) || '';
    r.pmid = w.ids && w.ids.pmid ? String(w.ids.pmid).replace(/\D/g, '') : '';
    r.languages = w.language ? P.languages(w.language) : [];
    r.docTypeRaw = w.type || '';
    r.docType = w.is_retracted ? 'retracted' : (TYPE_MAP[w.type] || P.docType(w.type || ''));
    const loc = w.primary_location || {};
    const src = loc.source || {};
    r.sourceTitle = src.display_name || loc.raw_source_name || '';
    r.issn = Array.isArray(src.issn) && src.issn.length ? src.issn.slice() : (src.issn_l ? [src.issn_l] : []);
    r.publisher = src.host_organization_name || '';
    const b = w.biblio || {};
    r.volume = b.volume || '';
    r.issue = b.issue || '';
    r.pages = P.pages(b.first_page, b.last_page);
    r.timesCited = w.cited_by_count != null ? w.cited_by_count : null;
    r.openAccess = w.open_access ? !!w.open_access.is_oa : null;
    r.abstract = P.invertedAbstract(w.abstract_inverted_index);

    const countries = [];
    for (const au of w.authorships || []) {
      const who = au.author || {};
      /* the name as printed in the source when it is written "Surname, Initials"; otherwise the catalogue's "Given Surname" */
      const rawName = au.raw_author_name || '';
      const p = rawName.includes(',') && !rawName.includes(';') ? P.person(rawName) : P.personFirstLast(who.display_name || rawName);
      if (who.id) p.id = shortId(who.id);
      if (who.orcid) p.orcid = shortId(who.orcid);
      const raw = (au.raw_affiliation_strings || []).filter(Boolean);
      p.affiliations = raw.length ? raw.slice() : (au.institutions || []).map(i => i.display_name).filter(Boolean);
      const codes = (au.countries || []).concat((au.institutions || []).map(i => i.country_code)).filter(Boolean).map(c => String(c).toUpperCase());
      p.country = codes[0] || null;
      countries.push(...codes);
      if (au.is_corresponding && !r.correspondingAuthor) { r.correspondingAuthor = p.short; r.correspondingCountry = p.country; }
      r.authors.push(p);
    }

    const kw = [];
    for (const k of w.keywords || []) if (k.display_name) kw.push(k.display_name);
    for (const tp of w.topics || []) if (tp.display_name) kw.push(tp.display_name);
    for (const c of w.concepts || []) if (c.display_name && c.level >= 1 && c.score >= 0.3) kw.push(c.display_name);
    for (const m of w.mesh || []) if (m.descriptor_name) kw.push(m.descriptor_name);
    r.indexKeywords = kw;
    const areas = [];
    for (const tp of w.topics || []) { if (tp.subfield && tp.subfield.display_name) areas.push(tp.subfield.display_name); if (tp.field && tp.field.display_name) areas.push(tp.field.display_name); }
    r.subjectAreas = areas;

    const funding = [];
    const awarded = new Set();
    for (const a of w.awards || []) {
      if (!a.funder_display_name) continue;
      funding.push(a.funder_display_name + (a.funder_award_id ? ' (' + a.funder_award_id + ')' : ''));
      awarded.add(a.funder_id);
    }
    for (const f of w.funders || []) if (f.display_name && !awarded.has(f.id)) funding.push(f.display_name);
    r.fundingText = P.uniq(funding).join('; ');

    r.references = (w.referenced_works || []).map(id => { const x = P.newRef(shortId(id)); return x; });

    /* the raw record without the two largest fields, which are already kept above */
    const raw = {};
    for (const k in w) if (k !== 'abstract_inverted_index' && k !== 'referenced_works') raw[k] = w[k];
    r.originalRaw = JSON.stringify(raw);

    P.finish(r);
    r.countries = [...new Set(countries)];
    return r;
  };

  /* ---------- network ---------- */
  function apiError(code, status, detail) {
    const e = new Error('openapi:' + code + ':' + (status || 0) + ':' + (detail || ''));
    e.code = code; e.status = status || 0; e.detail = detail || '';
    return e;
  }
  /* "openapi:rateLimit:429:…" (a worker only passes the message across) → { code, status, detail } */
  P.openapiErrorInfo = function (err) {
    const m = String(err && err.message || err).match(/^openapi:(\w+):(\d+):([\s\S]*)$/);
    return m ? { code: m[1], status: +m[2], detail: m[3] } : null;
  };

  /* env: { fetch, sleep(ms), progress(f, info), maxRetries } */
  async function getJson(url, env, onRetry) {
    const max = env.maxRetries != null ? env.maxRetries : 5;
    for (let attempt = 0; ; attempt++) {
      let resp = null, networkError = null;
      try { resp = await env.fetch(url); } catch (e) { networkError = e; }
      if (resp && resp.ok) return resp.json();
      const status = resp ? resp.status : 0;
      const retryable = networkError || status === 429 || status >= 500;
      if (retryable && attempt < max) {
        const wait = Math.min(30, Math.pow(2, attempt)) * 1000;
        if (onRetry) onRetry(attempt + 1, max, wait / 1000, status);
        await env.sleep(wait);
        continue;
      }
      if (networkError) throw apiError('network', 0, String(networkError.message || networkError));
      let detail = '';
      try { const body = await resp.json(); detail = body.message || body.error || ''; } catch (e) { /* not JSON */ }
      if (status === 429) throw apiError('rateLimit', status, detail);
      if (status === 401 || status === 403) throw apiError('auth', status, detail);
      if (status >= 500) throw apiError('server', status, detail);
      throw apiError('badRequest', status, detail);
    }
  }

  P.openapiCount = async function (query, env, apiKey) {
    const json = await getJson(P.openapiUrl(query, { perPage: 1, select: false, apiKey }), Object.assign({ maxRetries: 2 }, env));
    return json && json.meta ? json.meta.count : 0;
  };

  /* opts: { query, limit, apiKey, sort } → { records, count, pages, requests, perPage } */
  P.openapiDownload = async function (opts, env) {
    const limit = Math.max(1, Math.floor(opts.limit || 5000));
    const records = [];
    let cursor = '*', pages = 0, count = null, perPage = 200;
    const report = info => env.progress && env.progress(count ? Math.min(1, records.length / Math.max(1, Math.min(count, limit))) : null, info);
    while (records.length < limit) {
      const url = P.openapiUrl(opts.query, { perPage, cursor, apiKey: opts.apiKey, sort: opts.sort || 'cited_by_count:desc' });
      let json;
      try {
        json = await getJson(url, env, (attempt, max, seconds, status) => report({ retry: attempt, max, seconds, status }));
      } catch (e) {
        /* a smaller page size if the service stops accepting 200 per page */
        if (e.code === 'badRequest' && perPage > 100 && /per.?page/i.test(e.detail)) { perPage = 100; continue; }
        throw e;
      }
      pages++;
      if (count == null) count = json.meta ? json.meta.count : 0;
      for (const w of json.results || []) {
        if (records.length >= limit) break;
        records.push(P.mapOpenapiWork(w));
      }
      report({ page: pages, n: records.length, count });
      cursor = json.meta && json.meta.next_cursor;
      if (!cursor || !(json.results || []).length) break;
    }
    return { records, count: count || 0, pages, requests: pages, perPage };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpOpenapi);
