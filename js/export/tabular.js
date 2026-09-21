/* SciMetricsPro — tabular export (spreadsheet .xlsx and CSV).
   A table travels as { columns: [{key, label}], rows: [object | array] }.
   Exporter.matrix() turns it into a header + rows array of plain values, which is
   what both writers use (and what the tests check). */
'use strict';

const Exporter = {
  matrix(columns, rows) {
    const head = columns.map(c => c.label != null ? String(c.label) : String(c.key));
    const body = rows.map((r, i) => columns.map((c, j) => {
      let v = c.get ? c.get(r, i) : (Array.isArray(r) ? r[j] : r[c.key]);
      if (c.exportValue) v = c.exportValue(v, r);
      if (v == null || (typeof v === 'number' && !isFinite(v))) return '';
      if (Array.isArray(v)) return v.join('; ');
      return typeof v === 'number' || typeof v === 'boolean' ? v : String(v);
    }));
    return [head, ...body];
  },

  /* sheets: [{ name, columns, rows }] → spreadsheet with formatted headers (js/export/xlsx.js) */
  xlsxBlob(sheets) {
    return XlsxWriter.buildSync(sheets.map((s, i) => ({ name: s.name || ('Sheet' + (i + 1)), rows: Exporter.matrix(s.columns, s.rows) })));
  },
  xlsx(sheets, fileName) {
    download(Exporter.xlsxBlob(sheets), slug(fileName) + '.xlsx');
    return true;
  },

  /* sheet names: max 31 characters, no []:*?/\ and unique */
  sheetName(name, used) {
    let base = String(name).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
    let n = base, k = 2;
    while (used.has(n.toLowerCase())) { const suffix = ' (' + (k++) + ')'; n = base.slice(0, 31 - suffix.length) + suffix; }
    used.add(n.toLowerCase());
    return n;
  },

  csvText(columns, rows, sep) {
    sep = sep || ',';
    return '\uFEFF' + Exporter.matrix(columns, rows).map(r => r.map(v => csvEscape(v, sep)).join(sep)).join('\r\n');
  },

  csv(columns, rows, fileName, sep) {
    download(Exporter.csvText(columns, rows, sep), slug(fileName) + '.csv', 'text/csv;charset=utf-8');
  },
};

window.Exporter = Exporter;
