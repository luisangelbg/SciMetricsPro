/* SciMetricsPro — spreadsheet writer (.xlsx, Office Open XML SpreadsheetML, ECMA-376): one sheet per table with the header
   row in bold on a light fill with a bottom border, frozen, with filters, and column widths from the content. Numbers stay
   numbers; text is written inline. XlsxWriter.build([{ name, rows: [[header…], [values…]…] }]) → Promise<Blob>. */
'use strict';

const XlsxWriter = {
  MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  esc(s) {
    /* characters that XML 1.0 does not allow are dropped */
    let clean = '';
    for (const ch of String(s)) { const c = ch.charCodeAt(0); if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 0xFFFE && c !== 0xFFFF)) clean += ch; }
    return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  column(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; },

  sheetXml(rows) {
    const X = XlsxWriter;
    const nCols = Math.max(1, ...rows.map(r => r.length));
    const widths = new Array(nCols).fill(8);
    rows.slice(0, 201).forEach((r, ri) => r.forEach((v, j) => {
      const len = v == null ? 0 : String(v).length + (ri === 0 ? 3 : 1);
      widths[j] = Math.min(60, Math.max(widths[j], len));
    }));
    const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'];
    out.push(rows.length > 1 ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>');
    out.push('<sheetFormatPr defaultRowHeight="15"/><cols>' + widths.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols><sheetData>');
    rows.forEach((r, ri) => {
      const cells = [];
      r.forEach((v, j) => {
        if (v == null || v === '') return;
        const ref = X.column(j) + (ri + 1);
        const style = ri === 0 ? ' s="1"' : '';
        if (typeof v === 'number' && isFinite(v)) cells.push(`<c r="${ref}"${style}><v>${v}</v></c>`);
        else if (typeof v === 'boolean') cells.push(`<c r="${ref}"${style} t="b"><v>${v ? 1 : 0}</v></c>`);
        else {
          const s = String(v).slice(0, 32767);
          const space = /^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : '';
          cells.push(`<c r="${ref}"${style} t="inlineStr"><is><t${space}>${X.esc(s)}</t></is></c>`);
        }
      });
      out.push(`<row r="${ri + 1}"${ri === 0 ? ' ht="20" customHeight="1"' : ''}>${cells.join('')}</row>`);
    });
    out.push('</sheetData>');
    if (rows.length > 1) out.push(`<autoFilter ref="A1:${X.column(nCols - 1)}${rows.length}"/>`);
    out.push('<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>');
    return out.join('');
  },

  STYLES: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF1B2433"/><name val="Calibri"/><family val="2"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F2"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="medium"><color rgb="FF1D5BB0"/></bottom><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',

  /* sheet names: at most 31 characters, without []:*?/\ and different from each other */
  names(sheets) {
    const used = new Set();
    return sheets.map((s, i) => {
      const base = String(s.name || ('Sheet' + (i + 1))).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet' + (i + 1);
      let n = base, k = 2;
      while (used.has(n.toLowerCase())) { const suffix = ' (' + (k++) + ')'; n = base.slice(0, 31 - suffix.length) + suffix; }
      used.add(n.toLowerCase());
      return n;
    });
  },

  build(sheets) { return Promise.resolve(XlsxWriter.buildSync(sheets)); },

  buildSync(sheets) {
    const X = XlsxWriter;
    const names = X.names(sheets);
    const files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' });
    const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    files.push({ name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>SciMetricsPro</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created></cp:coreProperties>` });
    const defined = sheets.map((s, i) => (s.rows.length > 1 ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${X.esc(names[i].replace(/'/g, "''"))}'!$A$1:$${X.column(Math.max(1, ...s.rows.map(r => r.length)) - 1)}$${s.rows.length}</definedName>` : '')).join('');
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'
      + names.map((n, i) => `<sheet name="${X.esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>' + (defined ? '<definedNames>' + defined + '</definedNames>' : '') + '</workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
    files.push({ name: 'xl/styles.xml', data: X.STYLES });
    sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: X.sheetXml(s.rows) }));
    return Zip.buildSync(files, X.MIME);
  },
};

window.XlsxWriter = XlsxWriter;
