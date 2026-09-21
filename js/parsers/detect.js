/* SciMetricsPro — format detection and the reading loop.
   The content decides; the extension only breaks ties. */
'use strict';

function smpDetect(P) {
  P.SHEET_EXTENSIONS = ['xlsx', 'xls', 'xlsm', 'ods'];
  P.isSheetName = function (name) {
    const m = /\.([^./]+)$/.exec(String(name || ''));
    return !!m && P.SHEET_EXTENSIONS.includes(m[1].toLowerCase());
  };

  P.detect = function (name, text) {
    const ext = String(name || '').split('.').pop().toLowerCase();
    const head = P.stripBom(String(text || '').slice(0, 20000)).replace(/^\s+/, '');
    if (/^PMID- ?\d/m.test(head.slice(0, 2000))) return 'tagged4';
    if (/^(FN |VR |PT [A-Z]\s*$)/m.test(head.slice(0, 400)) && /^(PT|AU|TI) /m.test(head) ) return 'tagged2';
    if (/^TY  - /m.test(head.slice(0, 2000))) return 'ris';
    if (/^\s*@[A-Za-z]+\s*[{(]/m.test(head)) return 'bibtex';
    if (ext === 'bib' || ext === 'bibtex') return 'bibtex';
    if (ext === 'ris') return 'ris';
    if (ext === 'nbib') return 'tagged4';
    const firstLine = head.split(/\r?\n/)[0] || '';
    /* spreadsheets arrive here already turned into comma-separated text in the page (ImportModule.sheetToFile) */
    if (/[,\t;]/.test(firstLine) && ['csv', 'tsv', 'txt', 'tab', '', ...P.SHEET_EXTENSIONS].includes(ext)) return 'csv';
    return null;
  };

  /* one file's text → { format, source, records, warnings } */
  P.parseText = function (name, text, ctx) {
    ctx = ctx || { tick() {} };
    const format = P.detect(name, text);
    if (!format) return { format: null, source: null, records: [], warnings: [{ code: 'unknownFormat' }], error: 'unknownFormat' };
    const readers = { tagged4: P.parseTagged4, tagged2: P.parseTagged2, ris: P.parseRis, bibtex: P.parseBibtex, csv: P.parseCsv };
    const res = readers[format](text, ctx);
    let records = res.records;
    const warnings = (res.warnings || []).slice();
    const untitled = records.filter(r => !r.title).length;
    records = records.filter(r => r.title);
    if (untitled) warnings.push({ code: 'dropped', n: untitled });
    if (!records.length) return { format: res.format, source: res.source, records: [], warnings: warnings.concat([{ code: 'empty' }]), error: 'empty' };
    const completeness = P.completeness(records);
    return { format: res.format, source: res.source, records, warnings: warnings.concat(P.warningsFor(records, completeness)), completeness };
  };

  /* In the worker: File objects → results, with progress weighted by file size */
  P.readFiles = async function (files, progress) {
    const total = files.reduce((s, f) => s + (f.size || 1), 0) || 1;
    let done = 0;
    const out = [];
    for (let k = 0; k < files.length; k++) {
      const file = files[k];
      const size = file.size || 1;
      const report = f => progress && progress((done + size * Math.min(1, Math.max(0, f))) / total, file.name);
      report(0);
      let result;
      try {
        const { text, encoding } = P.decode(await file.arrayBuffer());
        result = P.parseText(file.name, text, { tick: report });
        result.encoding = encoding;
        if (encoding === 'latin1') result.warnings.unshift({ code: 'encoding' });
      } catch (e) {
        result = { format: null, source: null, records: [], warnings: [{ code: 'readError', msg: String(e && e.message || e) }], error: 'readError' };
      }
      result.name = file.name;
      result.size = file.size;
      out.push(result);
      done += size;
      report(0);
    }
    if (progress) progress(1, '');
    return out;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpDetect);
