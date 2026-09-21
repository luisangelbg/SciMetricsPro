/* SciMetricsPro — cited references.
   Every reference keeps its original string (raw) plus the parts that the
   co-citation and coupling analyses need: first author, year, source, volume,
   first page and DOI.

   Styles:
   'idxB'  "Smith J, 2010, J ECOL, V12, P45, DOI 10.1111/xyz"   (comma-separated positions)
   'idxA'  "Toledo V.M., Ordonez M., Title, Source, 12, 3, pp. 739-755, (1993)"   (current)
           "Smith, J., Jones, K., Title (2010) Source, 12 (3), pp. 45-67."        (older) */
'use strict';

function smpReferences(P) {
  /* "Montano N.M."  "Garcia-Oliva F."  "Aguirre-Medina J. F."  "Abdelnour EA"  "de la Cruz M." */
  const AUTHOR_A = /^[\p{L}'’][\p{L}'’\- ]*\s(?:(?:\p{Lu}\.\s?){1,4}(?:-\p{Lu}\.)?|\p{Lu}{1,4})$/u;
  const AUTHOR_A_OLD = /^[\p{Lu}'’][\p{L}'’\- ]*$/u;                               // "Smith" followed by "J."
  const INITIALS_ONLY = /^(?:\p{Lu}\.\s?){1,4}(?:-\p{Lu}\.)?$/u;

  P.newRef = raw => ({ raw: raw, firstAuthor: '', year: null, source: '', volume: '', page: '', doi: '' });

  P.parseRefB = function (raw) {
    const r = P.newRef(raw);
    const s = P.clean(raw);
    const doi = s.match(/\bDOI\s+\[?(10\.[^\s,\]]+)/i);
    if (doi) r.doi = P.doiOf(doi[1]);
    const parts = s.split(/,\s*/);
    let i = 0;
    if (parts.length && !/^\d{4}$/.test(parts[0])) { r.firstAuthor = parts[0].replace(/^\*/, '').trim(); i = 1; }
    if (i < parts.length && /^\d{4}$/.test(parts[i])) { r.year = parseInt(parts[i], 10); i++; }
    /* a source may start with P or V ("PLANT J", "P NATL ACAD SCI USA", "VIROLOGY"): a volume is V + digits, a page P + digits */
    if (i < parts.length && !/^(V\s?\d|P[A-Za-z]?\s?\d|DOI\s)/.test(parts[i])) { r.source = parts[i].trim(); i++; }
    for (; i < parts.length; i++) {
      const p = parts[i];
      if (/^V\d/.test(p) || /^V\s?\d/.test(p)) r.volume = p.replace(/^V\s?/, '');
      else if (/^P\w/.test(p) && !r.page) r.page = p.replace(/^P\s?/, '');
    }
    if (r.firstAuthor === '[Anonymous]') r.firstAuthor = '';
    return r;
  };

  P.parseRefA = function (raw) {
    const r = P.newRef(raw);
    const s = P.clean(raw);
    r.doi = P.doiOf(s);
    /* older style: "... Title (2010) Source, 12 (3), pp. 45-67." */
    const old = s.match(/\((\d{4})\)\s+([^,(]+?)\s*(?:,|$)/);
    const tailYear = s.match(/\((\d{4})[a-z]?\)\s*\.?$/);
    if (tailYear) r.year = parseInt(tailYear[1], 10);
    else if (old) r.year = parseInt(old[1], 10);
    else r.year = P.yearOf(s);

    const parts = s.split(/,\s+/);
    /* authors at the start */
    let i = 0;
    const authors = [];
    while (i < parts.length) {
      const p = parts[i].trim();
      if (AUTHOR_A.test(p)) { authors.push(p); i++; continue; }
      if (/^et al\.?$/i.test(p)) { i++; continue; }
      if (AUTHOR_A_OLD.test(p) && i + 1 < parts.length && INITIALS_ONLY.test(parts[i + 1].trim())) {
        authors.push(p + ' ' + parts[i + 1].trim()); i += 2; continue;
      }
      break;
    }
    if (authors.length) r.firstAuthor = authors[0];

    if (!tailYear && old) {
      r.source = old[2].trim();
      const after = s.slice(s.indexOf(old[0]) + old[0].length);
      const vol = after.match(/^\s*(\d+[A-Za-z]?)\s*(?:\(|,|$)/);
      if (vol) r.volume = vol[1];
    } else {
      /* current style: authors, title, source, volume, issue, pp., (year) */
      const rest = parts.slice(i);
      const numeric = p => /^\(?\d{4}[a-z]?\)?\.?$/.test(p) || /^pp?\.\s?[\w-]+/.test(p) || /^\d+[A-Za-z]?$/.test(p) || /^[A-Z]?\d+[-–]\d+$/.test(p) || /^10\.\d{4,9}\//.test(p);
      let end = rest.length;
      while (end > 0 && numeric(rest[end - 1].trim())) end--;
      const nums = rest.slice(end).map(x => x.trim());
      const texts = rest.slice(0, end);
      if (texts.length >= 2) r.source = texts[texts.length - 1].trim();
      const vol = nums.find(x => /^\d+[A-Za-z]?$/.test(x));
      if (vol && texts.length >= 2) r.volume = vol;
      const pp = nums.find(x => /^pp?\.\s?/.test(x));
      if (pp) r.page = pp.replace(/^pp?\.\s?/, '').split(/[-–]/)[0];
    }
    return r;
  };

  /* A list of references exported as one text with "; " between them. A "; "
     inside a title would split a reference in two, so a fragment that does not
     start like a reference is glued back to the previous one. */
  P.splitRefsA = function (text) {
    if (!text) return [];
    const pieces = String(text).split(/;\s+/);
    const out = [];
    for (const piece of pieces) {
      const p = piece.trim();
      if (!p) continue;
      const startsLikeRef = /^[\p{Lu}'’\[(]/u.test(p) && (/^[^,]+,/.test(p) || /\(\d{4}\)/.test(p));
      const prevClosed = !out.length || /\(\d{4}[a-z]?\)\s*\.?$/.test(out[out.length - 1]) || /\d\.?$/.test(out[out.length - 1]);
      if (out.length && !startsLikeRef && !prevClosed) out[out.length - 1] += '; ' + p;
      else out.push(p);
    }
    return out;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpReferences);
