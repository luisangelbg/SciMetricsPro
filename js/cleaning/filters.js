/* SciMetricsPro — global filters: years, document type, language, source, subject area, minimum citations.
   An empty selection means "all". */
'use strict';

function smpFilters(P) {
  /* sources are chosen by key (see js/metrics/sources.js): clean records carry it, others get it from the title */
  const sourceKeyOf = r => (r.sourceKey != null ? r.sourceKey : P.sourceKey(r.sourceTitle));

  P.emptyFilters = () => ({ yearFrom: '', yearTo: '', docTypes: [], languages: [], sources: [], areas: [], minCitations: '' });

  P.filtersActive = f => !!(f && (f.yearFrom !== '' || f.yearTo !== '' || f.docTypes.length || f.languages.length || f.sources.length || f.areas.length || f.minCitations !== ''));

  P.applyFilters = function (records, f) {
    if (!P.filtersActive(f)) return records.slice();
    const y0 = f.yearFrom === '' ? -Infinity : +f.yearFrom, y1 = f.yearTo === '' ? Infinity : +f.yearTo;
    const types = new Set(f.docTypes), langs = new Set(f.languages);
    const sources = new Set(f.sources), areas = new Set(f.areas.map(s => P.fold(s)));
    const minC = f.minCitations === '' ? null : +f.minCitations;
    return records.filter(r => {
      if (f.yearFrom !== '' || f.yearTo !== '') { if (r.year == null || r.year < y0 || r.year > y1) return false; }
      if (types.size && !types.has(r.docType)) return false;
      if (langs.size && !(r.languages.length ? r.languages.some(l => langs.has(l)) : langs.has('none'))) return false;
      if (sources.size && !sources.has(sourceKeyOf(r))) return false;
      if (areas.size && !r.subjectAreas.some(a => areas.has(P.fold(a)))) return false;
      if (minC != null && !(r.timesCited != null && r.timesCited >= minC)) return false;
      return true;
    });
  };

  /* choices with their counts, for the filter controls */
  P.filterOptions = function (records) {
    const count = (list) => {
      const m = new Map();
      for (const v of list) if (v !== '' && v != null) m.set(v, (m.get(v) || 0) + 1);
      return [...m.entries()].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n || String(a.value).localeCompare(String(b.value)));
    };
    const years = records.map(r => r.year).filter(y => y != null);
    const sourceLabel = new Map();
    for (const r of records) { const k = sourceKeyOf(r); if (k && !sourceLabel.has(k)) sourceLabel.set(k, r.sourceName || r.sourceTitle); }
    const areaLabel = new Map();
    for (const r of records) for (const a of r.subjectAreas) { const k = P.fold(a); if (!areaLabel.has(k)) areaLabel.set(k, a); }
    return {
      yearMin: years.length ? Math.min(...years) : null,
      yearMax: years.length ? Math.max(...years) : null,
      docTypes: count(records.map(r => r.docType)),
      languages: count(records.flatMap(r => (r.languages.length ? r.languages : ['none']))),
      sources: count(records.map(sourceKeyOf)).map(x => ({ value: x.value, label: sourceLabel.get(x.value), n: x.n })),
      areas: count(records.flatMap(r => [...new Set(r.subjectAreas.map(a => P.fold(a)))])).map(x => ({ value: areaLabel.get(x.value), n: x.n })),
      citedMax: records.reduce((m, r) => (r.timesCited != null && r.timesCited > m ? r.timesCited : m), 0),
    };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpFilters);
