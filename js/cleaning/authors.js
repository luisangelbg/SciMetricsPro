/* SciMetricsPro — author names in one form ("Surname, I.J.") and possible variants of the same author.
   Spelling differences that vanish when accents, hyphens, spaces and case are ignored
   ("Cadena-Iñiguez J." = "Cadena Iniguez J") are the same key automatically. Keys that
   share surname and first initial but differ in the other initials ("J." and "J.C.")
   are only suggested; the user decides, helped by the co-authors they share. */
'use strict';

function smpAuthors(P) {
  const initialsKey = a => P.fold(a.initials || '').replace(/[^a-z]/g, '');

  P.authorKey = function (a) {
    const last = P.fold(a.last || a.short || a.full || '').replace(/[^a-z]/g, '');
    return last + '|' + initialsKey(a);
  };

  P.authorLabel = function (a) {
    const last = P.clean(a.last || a.short || a.full || '');
    return a.initials ? last + ', ' + a.initials : last;
  };

  /* records → [{ gid, surname, initial, variants: [{ key, label, docs, coauthors: Set }] }] */
  P.authorVariantGroups = function (records) {
    const byKey = new Map();
    for (const r of records) {
      const keys = r.authors.map(a => P.authorKey(a));
      r.authors.forEach((a, i) => {
        const k = keys[i];
        if (!k.split('|')[0]) return;
        let v = byKey.get(k);
        if (!v) { v = { key: k, labels: new Map(), docs: 0, coauthors: new Set() }; byKey.set(k, v); }
        v.docs++;
        const label = P.authorLabel(a);
        v.labels.set(label, (v.labels.get(label) || 0) + 1);
        keys.forEach((other, j) => { if (j !== i) v.coauthors.add(other); });
      });
    }
    const groups = new Map();
    for (const v of byKey.values()) {
      const [sur, ini] = v.key.split('|');
      const gid = sur + '|' + (ini[0] || '');
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid).push(v);
    }
    const out = [];
    for (const [gid, list] of groups) {
      if (list.length < 2) continue;
      list.sort((a, b) => b.docs - a.docs || a.key.localeCompare(b.key));
      const variants = list.map(v => ({
        key: v.key, docs: v.docs, coauthors: v.coauthors,
        label: [...v.labels.entries()].sort((a, b) => b[1] - a[1])[0][0],
      }));
      /* co-authors shared with the most frequent variant: evidence that they are one person */
      const main = variants[0];
      variants.forEach(v => { v.shared = v === main ? null : [...v.coauthors].filter(k => main.coauthors.has(k) && k !== v.key && k !== main.key).length; });
      const [surname, initials] = gid.split('|');
      out.push({ gid, surname, initial: initials, variants, docs: variants.reduce((s, v) => s + v.docs, 0) });
    }
    out.sort((a, b) => b.docs - a.docs || a.gid.localeCompare(b.gid));
    return out;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpAuthors);
