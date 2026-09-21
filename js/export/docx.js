/* SciMetricsPro — word-processing document writer (.docx, Office Open XML WordprocessingML, ECMA-376) built on the own ZIP
   writer. A document is a list of blocks:
     { type: 'title' | 'subtitle' | 'cover', text }                 cover lines
     { type: 'heading', level: 1 | 2, text }
     { type: 'paragraph', text | runs: [{ text, bold, italic }], style? }
     { type: 'figure', image: Uint8Array (PNG), widthCm, heightCm, name, caption: { label, text }, alt }
     { type: 'table', caption: { label, text }, head: [..], rows: [[..]], numeric: [bool], note }
     { type: 'reference', text }                                      hanging indent
     { type: 'pagebreak' }
   Captions carry a SEQ field (renumbered when the fields are updated), the page number sits in the footer (not on the
   cover), images are inline at their physical size and tables have a repeated header row with rules above and below.
   DocxWriter.build({ title, author, lang, page: 'letter' | 'a4', blocks }) → Blob. */
'use strict';

const DocxWriter = {
  MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  EMU_PER_CM: 360000,
  TWIPS_PER_CM: 1440 / 2.54,
  PAGES: { letter: { w: 12240, h: 15840 }, a4: { w: 11906, h: 16838 } },
  MARGIN: 1418,   /* 2.5 cm */
  NS: 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',

  esc(s) {
    let clean = '';
    for (const ch of String(s == null ? '' : s)) { const c = ch.charCodeAt(0); if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 0xFFFE && c !== 0xFFFF)) clean += ch; }
    return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  /* text width of the page in cm (page minus both margins) */
  textWidthCm(page) {
    const p = DocxWriter.PAGES[page] || DocxWriter.PAGES.letter;
    return (p.w - 2 * DocxWriter.MARGIN) / DocxWriter.TWIPS_PER_CM;
  },

  run(text, o) {
    o = o || {};
    const props = (o.bold ? '<w:b/>' : '') + (o.italic ? '<w:i/>' : '');
    const rPr = props ? '<w:rPr>' + props + '</w:rPr>' : '';
    return String(text == null ? '' : text).split('\n').map((line, i) =>
      (i ? '<w:r>' + rPr + '<w:br/></w:r>' : '') + line.split('\t').map((part, j) => (j ? '<w:r>' + rPr + '<w:tab/></w:r>' : '') + (part ? `<w:r>${rPr}<w:t xml:space="preserve">${DocxWriter.esc(part)}</w:t></w:r>` : '')).join('')).join('');
  },

  para(content, o) {
    o = o || {};
    const pPr = (o.style ? `<w:pStyle w:val="${o.style}"/>` : '') + (o.keepNext ? '<w:keepNext/>' : '') + (o.align ? `<w:jc w:val="${o.align}"/>` : '');
    return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + content + '</w:p>';
  },

  /* "Figura 1. Title": the number is a SEQ field with its current result */
  caption(c, seq, o) {
    const D = DocxWriter;
    const label = D.run(c.label + ' ', { bold: true });
    /* a complex field keeps the bold of its result (a simple field loses it when the document is opened) */
    const b = '<w:rPr><w:b/></w:rPr>';
    const number = `<w:r>${b}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${b}<w:instrText xml:space="preserve"> SEQ ${D.esc(seq)} \\* ARABIC </w:instrText></w:r>`
      + `<w:r>${b}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${b}<w:t>${D.esc(c.number)}</w:t></w:r><w:r>${b}<w:fldChar w:fldCharType="end"/></w:r>`;
    return D.para(label + number + D.run('. ', { bold: true }) + D.run(c.text), { style: 'Caption', keepNext: o && o.keepNext });
  },

  drawing(block, rid, id) {
    const D = DocxWriter;
    const cx = Math.round(block.widthCm * D.EMU_PER_CM), cy = Math.round(block.heightCm * D.EMU_PER_CM);
    const name = D.esc(block.name || 'figure' + id + '.png'), alt = D.esc(block.alt || '');
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
      + `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="${name}" descr="${alt}"/>`
      + '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
      + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
      + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr="${alt}"/><pic:cNvPicPr/></pic:nvPicPr>`
      + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`
      + '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  },

  /* column widths in twips: each column as wide as its longest text (header and first rows, in characters), never narrower
     than its longest word (so words are not cut) and at most 40 characters; the table takes the page width only when it
     needs it. About 105 twips per character at 9 pt, plus the cell margins. */
  TWIPS_PER_CHAR: 105,
  tableLayout(block, textTwips) {
    const D = DocxWriter;
    const n = Math.max(1, block.head.length);
    const longestWord = s => Math.max(0, ...String(s == null ? '' : s).split(/\s+/).map(w => w.length));
    const need = block.head.map((h, j) => {
      let len = String(h == null ? '' : h).length * 0.6, word = longestWord(h);
      block.rows.slice(0, 60).forEach(r => { const v = r[j]; len = Math.max(len, String(v == null ? '' : v).length); word = Math.max(word, longestWord(v)); });
      return { len: Math.min(40, Math.max(4, len)), word: Math.min(30, Math.max(3, word)) };
    });
    const pad = 200;
    const natural = need.map(c => Math.max(c.len, c.word) * D.TWIPS_PER_CHAR + pad);
    const minimum = need.map(c => c.word * D.TWIPS_PER_CHAR + pad);
    let widths;
    const sumNatural = natural.reduce((a, b) => a + b, 0);
    if (sumNatural <= textTwips) widths = natural.map(Math.round);
    else {
      /* shrink the columns above their minimum, in proportion to their room */
      const sumMin = minimum.reduce((a, b) => a + b, 0);
      if (sumMin >= textTwips) widths = minimum.map(w => Math.floor(textTwips * w / sumMin));
      else {
        const room = natural.map((w, j) => w - minimum[j]), sumRoom = room.reduce((a, b) => a + b, 0) || 1;
        const k = (textTwips - sumMin) / sumRoom;
        widths = minimum.map((w, j) => Math.floor(w + room[j] * k));
      }
      widths[n - 1] += textTwips - widths.reduce((a, b) => a + b, 0);
    }
    return { widths, total: widths.reduce((a, b) => a + b, 0) };
  },

  table(block, textTwips) {
    const D = DocxWriter;
    const layout = D.tableLayout(block, textTwips), widths = layout.widths;
    const cell = (value, j, header) => {
      const align = block.numeric && block.numeric[j] ? '<w:jc w:val="right"/>' : '';
      const borders = header ? '<w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/></w:tcBorders>' : '';
      return `<w:tc><w:tcPr><w:tcW w:w="${widths[j]}" w:type="dxa"/>${borders}</w:tcPr><w:p><w:pPr><w:pStyle w:val="TableText"/>${align}</w:pPr>${D.run(value == null ? '' : value, { bold: header })}</w:p></w:tc>`;
    };
    const out = ['<w:tbl><w:tblPr><w:tblStyle w:val="ReportTable"/>' + `<w:tblW w:w="${layout.total}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>`];
    out.push('<w:tblGrid>' + widths.map(w => `<w:gridCol w:w="${w}"/>`).join('') + '</w:tblGrid>');
    out.push('<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' + block.head.map((h, j) => cell(h, j, true)).join('') + '</w:tr>');
    block.rows.forEach(r => out.push('<w:tr><w:trPr><w:cantSplit/></w:trPr>' + block.head.map((h, j) => cell(r[j], j, false)).join('') + '</w:tr>'));
    out.push('</w:tbl>');
    return out.join('');
  },

  STYLES: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="23"/><w:szCs w:val="23"/><w:lang w:val="{LANG}"/></w:rPr></w:rPrDefault>'
    + '<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="both"/></w:pPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="3600" w:after="360"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="720"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Cover"><w:name w:val="Cover"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="480" w:after="160"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="320" w:after="120"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="60" w:after="240" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Figure"><w:name w:val="Figure"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr></w:style>'
    + '<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableNote"><w:name w:val="Table Note"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="60" w:after="240" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:i/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Bibliography"><w:name w:val="Bibliography"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="100"/><w:ind w:left="567" w:hanging="567"/><w:jc w:val="left"/></w:pPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>'
    + '<w:style w:type="table" w:customStyle="1" w:styleId="ReportTable"><w:name w:val="Report Table"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/></w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
    + '</w:styles>',

  build(doc) {
    const D = DocxWriter;
    const page = D.PAGES[doc.page] ? doc.page : 'letter';
    const size = D.PAGES[page];
    const textTwips = size.w - 2 * D.MARGIN;
    const lang = doc.lang === 'en' ? 'en-US' : 'es-MX';
    const body = [], rels = [], media = [];
    let drawingId = 0;
    for (const b of doc.blocks) {
      if (b.type === 'title') body.push(D.para(D.run(b.text), { style: 'Title' }));
      else if (b.type === 'subtitle') body.push(D.para(D.run(b.text), { style: 'Subtitle' }));
      else if (b.type === 'cover') body.push(D.para(D.run(b.text), { style: 'Cover' }));
      else if (b.type === 'heading') body.push(D.para(D.run(b.text), { style: b.level === 2 ? 'Heading2' : 'Heading1' }));
      else if (b.type === 'paragraph') body.push(D.para((b.runs || [{ text: b.text }]).map(r => D.run(r.text, r)).join(''), { style: b.style }));
      else if (b.type === 'reference') body.push(D.para(D.run(b.text), { style: 'Bibliography' }));
      else if (b.type === 'pagebreak') body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      else if (b.type === 'figure') {
        drawingId++;
        const rid = 'rIdImg' + drawingId, file = 'media/image' + drawingId + '.png';
        rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${file}"/>`);
        media.push({ name: 'word/' + file, data: b.image });
        body.push(D.para(D.drawing(b, rid, drawingId), { style: 'Figure' }));
        if (b.caption) body.push(D.caption(b.caption, b.caption.seq || 'Figure'));
      } else if (b.type === 'table') {
        if (b.caption) body.push(D.caption(b.caption, b.caption.seq || 'Table', { keepNext: true }));
        body.push(D.table(b, textTwips));
        body.push(b.note ? D.para(D.run(b.note), { style: 'TableNote' }) : '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>');
      }
    }
    const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter1"/><w:pgSz w:w="${size.w}" w:h="${size.h}"/>`
      + `<w:pgMar w:top="${D.MARGIN}" w:right="${D.MARGIN}" w:bottom="${D.MARGIN}" w:left="${D.MARGIN}" w:header="709" w:footer="709" w:gutter="0"/><w:titlePg/></w:sectPr>`;
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${D.NS}><w:body>${body.join('')}${sect}</w:body></w:document>`;
    const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${D.esc(doc.title || '')}</dc:title><dc:creator>${D.esc(doc.author || 'SciMetricsPro')}</dc:creator><dc:language>${lang}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>` },
      { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SciMetricsPro</Application></Properties>' },
      { name: 'word/document.xml', data: document },
      { name: 'word/styles.xml', data: D.STYLES.replace('{LANG}', lang) },
      { name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` },
      { name: 'word/footer1.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${D.NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>` },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' + rels.join('') + '</Relationships>' },
    ].concat(media);
    return Zip.buildSync(files, D.MIME);
  },
};

window.DocxWriter = DocxWriter;
