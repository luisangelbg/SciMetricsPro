/* SciMetricsPro — text helpers shared by every reader.
   Reader parts are plain named functions that add members to a namespace P.
   They must not touch window or the DOM: the same source runs in the page and
   inside a background worker (see js/parsers/index.js). */
'use strict';

function smpText(P) {
  /* Bytes → text. Byte-order marks decide first; otherwise strict UTF-8, and
     single-byte Latin-1 (code page 1252) when the bytes are not valid UTF-8. */
  P.decode = function (buffer) {
    const b = new Uint8Array(buffer);
    if (b[0] === 0xFF && b[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(b.subarray(2)), encoding: 'utf-16le' };
    if (b[0] === 0xFE && b[1] === 0xFF) return { text: new TextDecoder('utf-16be').decode(b.subarray(2)), encoding: 'utf-16be' };
    const start = (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) ? 3 : 0;
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(start)), encoding: 'utf-8' };
    } catch (e) {
      return { text: new TextDecoder('latin1').decode(b.subarray(start)), encoding: 'latin1' };
    }
  };

  P.stripBom = s => (s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);

  P.fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();

  P.clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  /* split a delimited list, trim and drop empties */
  P.splitList = function (s, sep) {
    if (s == null || s === '') return [];
    const parts = String(s).split(sep == null ? ';' : sep);
    const out = [];
    for (const p of parts) { const v = P.clean(p); if (v) out.push(v); }
    return out;
  };

  /* unique, keeping the first spelling of values that differ only in case or accents */
  P.uniq = function (arr) {
    const seen = new Set(), out = [];
    for (const v of arr) {
      if (v == null || v === '') continue;
      const k = typeof v === 'string' ? P.fold(v) : v;
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
    return out;
  };

  P.int = function (s) {
    if (s == null) return null;
    const m = String(s).replace(/[,\s]/g, '').match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  };

  P.yearOf = function (s) {
    const m = String(s == null ? '' : s).match(/\b(1[5-9]\d\d|20\d\d)\b/);
    return m ? parseInt(m[1], 10) : null;
  };

  /* DOI in lower case, without resolver prefixes or trailing punctuation. Old DOIs in the SICI form keep their
     "<233::AID-ASI1>" part: without it, all the papers of one journal issue would share a DOI
     ("10.1002/(sici)1097-4571(199105)42:4"). Only a "<" followed by a digit counts, so markup ("</doi>", "<br>") stays out. */
  P.doiOf = function (s) {
    if (!s) return '';
    const m = String(s).match(/10\.\d{4,9}\/(?:[^\s"<>]|<\d[^\s"<>/]*>)+/i);
    if (!m) return '';
    /* trailing punctuation and file-format suffixes of resolver links ("…/pdf") are not part of the DOI */
    return m[0].replace(/[.,;:)\]}]+$/, '').replace(/\/(pdf|epdf|full|abstract|html)$/i, '').toLowerCase();
  };

  P.pages = function (start, end) {
    const a = P.clean(start), z = P.clean(end);
    if (a && z && a !== z) return a + '-' + z;
    return a || z || '';
  };

  /* LaTeX escapes used in bibliographic exports → Unicode */
  const ACCENTS = { "'": '\u0301', '`': '\u0300', '^': '\u0302', '"': '\u0308', '~': '\u0303', '=': '\u0304', '.': '\u0307',
    c: '\u0327', v: '\u030C', u: '\u0306', H: '\u030B', r: '\u030A', k: '\u0328', d: '\u0323', b: '\u0331' };
  const SYMBOLS = { ss: 'ß', o: 'ø', O: 'Ø', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', l: 'ł', L: 'Ł', i: 'ı', j: 'ȷ',
    textendash: '–', textemdash: '—', textquoteright: '’', textquoteleft: '‘', textregistered: '®', texttrademark: '™',
    copyright: '©', textdegree: '°', textperiodcentered: '·', dag: '†', S: '§', P: '¶' };
  P.latex = function (s) {
    if (!s || (s.indexOf('\\') < 0 && s.indexOf('{') < 0 && s.indexOf('--') < 0 && s.indexOf('~') < 0)) return s;
    let t = String(s);
    /* accent commands: \'{a}  {\'a}  \'a  \c{c}  \v c  (with a dotless i: \'{\i}) */
    /* the closing brace is consumed only when present, so the space after "\'e" survives */
    t = t.replace(/\\([`'^"~=.])\s*\{?\s*(\\[ij]|[A-Za-z])(?:\s*\})?/g, (m, acc, ch) => (ch === '\\i' ? 'i' : ch === '\\j' ? 'j' : ch) + ACCENTS[acc]);
    t = t.replace(/\\([cvuHrkdb])(?:\s+|\{)\s*(\\[ij]|[A-Za-z])(?:\s*\})?/g, (m, acc, ch) => (ch === '\\i' ? 'i' : ch === '\\j' ? 'j' : ch) + ACCENTS[acc]);
    t = t.replace(/\\([A-Za-z]+)\b\s?(\{\})?/g, (m, name) => (SYMBOLS[name] != null ? SYMBOLS[name] : m));
    t = t.replace(/\\([&%$#_{}])/g, '$1');
    t = t.replace(/---/g, '—').replace(/--/g, '–').replace(/(^|[^\\])~/g, '$1 ');
    t = t.replace(/\$([^$]*)\$/g, '$1');
    t = t.replace(/[{}]/g, '');
    t = t.replace(/\\\\/g, ' ').replace(/\\([A-Za-z]+)/g, '$1');
    return t.normalize('NFC');
  };

  /* Share of common English function words: picks the English abstract when a
     record carries it in two languages. */
  const EN_WORDS = new Set(['the', 'of', 'and', 'in', 'to', 'was', 'were', 'with', 'for', 'is', 'that', 'this', 'by', 'from', 'are', 'on', 'as', 'which', 'these', 'an']);
  P.englishScore = function (s) {
    const w = P.fold(s).match(/[a-z]+/g) || [];
    if (!w.length) return 0;
    let n = 0;
    for (const x of w) if (EN_WORDS.has(x)) n++;
    return n / w.length;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpText);
