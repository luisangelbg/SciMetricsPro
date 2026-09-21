/* SciMetricsPro — institution of an affiliation string.
   The affiliation is split at commas; the part naming the whole organisation
   (university, institute, college, centre …) is preferred over departments and
   laboratories. Abbreviations of the tagged exports ("Univ Calif Davis",
   "Natl Inst Agr") are written out, and upper-case names are put in title case. */
'use strict';

function smpInstitutions(P) {
  /* words that name a whole organisation; the \w* tails cover university/universidad/universität… */
  const TOP = /\b(univ\w*|institut\w*|inst|colleg\w*|colegio|coll|academ\w*|acad|polytechn\w*|politecn\w*|hospital\w*|hosp|muse\w*|botanic\w*|jardin|foundation|fundac\w*|council|consejo|conselho|ministr\w*|minist|agenc\w*|servic\w*|corporation|company|inc|ltd|gmbh|cinvestav|csic|cnrs|inrae?|inifap|embrapa|conah?cyt|usda|cgiar|cimmyt|icrisat|iita|ciat|cirad)\b/;
  const CENTRE = /\b(centro|center|centre|ctr|research station|estacion experimental|campo experimental|laboratorio nacional|national laboratory)\b/;
  const SUBUNIT = /\b(dept|department|departamento|departament|faculty|facultad|faculdade|fac|school|escuela|division|lab|laboratory|laboratorio|unit|unidad|program|programa|graduate|posgrado|section|grupo|group|chair|catedra)\b/;

  const ABBREV = {
    univ: 'University', inst: 'Institute', natl: 'National', coll: 'College', ctr: 'Center', acad: 'Academy', agr: 'Agricultural',
    sci: 'Science', technol: 'Technology', res: 'Research', fed: 'Federal', postgrad: 'Postgraduate', dept: 'Department', lab: 'Laboratory',
    hosp: 'Hospital', minist: 'Ministry', int: 'International',
    calif: 'California', penn: 'Pennsylvania', agron: 'Agronomy', biol: 'Biology', chem: 'Chemistry', environm: 'Environmental',
    med: 'Medicine', vet: 'Veterinary', engn: 'Engineering', ecol: 'Ecology', dev: 'Development', mol: 'Molecular', appl: 'Applied',
    polytech: 'Polytechnic', assoc: 'Association', soc: 'Society', syst: 'Systems', stn: 'Station', expt: 'Experimental', cent: 'Central',
  };

  function titleCase(s) {
    const small = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'das', 'of', 'and', 'for', 'the', 'y', 'e', 'en', 'et', 'in']);
    return s.toLowerCase().split(' ').map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }

  /* one key per institution in every screen (cleaning table, authors, collaboration network): the name without
     case, accents or repeated spaces, so «Paraíba» and «Paraiba» are the same institution */
  P.institutionKey = name => P.fold(name).replace(/\s+/g, ' ').trim();

  P.normalizeInstitution = function (s) {
    let t = P.clean(String(s || '').replace(/^\[[^\]]*\]\s*/, '').replace(/\.$/, ''));
    if (!t) return '';
    const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
    const upper = letters && letters === letters.toUpperCase() && letters.length > 4;
    /* abbreviations are written out when they stand alone ("Univ", "Natl.", "UNIV") */
    t = t.split(' ').map(w => { const k = P.fold(w).replace(/\.$/, ''); return ABBREV[k] || w; }).join(' ');
    if (upper) t = titleCase(t).replace(/\b(Usa|Uk|Unam|Csic|Cnrs|Inifap|Usda|Cinvestav|Embrapa|Ipn|Cimmyt|Inra|Inrae|Cirad)\b/g, m => m.toUpperCase());
    return t;
  };

  /* affiliation string → institution name ('' when none can be told) */
  P.institutionOf = function (affiliation) {
    /* parts at commas and semicolons, and at a slash between two names («Universidade …/Programa de Pós-Graduação …») */
    const parts = String(affiliation || '').replace(/^\[[^\]]*\]\s*/, '').replace(/\S+@\S+/g, '').split(/[,;]|(?<=\p{L})\s*\/\s*(?=\p{L})/u).map(x => x.trim()).filter(Boolean);
    if (!parts.length) return '';
    const folded = parts.map(p => ' ' + P.fold(p).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ');
    /* a part with an organisation word that is also a unit («Academic Unit of …», «Unidad Académica de …», «Graduate School of …») gives way to another part that names the whole organisation */
    let pick = folded.findIndex(f => TOP.test(f) && !SUBUNIT.test(f));
    if (pick < 0) pick = folded.findIndex(f => TOP.test(f));
    if (pick < 0) pick = folded.findIndex(f => CENTRE.test(f));
    /* no organisation word: the first part names the organisation when it is a name of several words
       ("Grupo Interdisciplinario de …, Texcoco, 56153, Mexico"), otherwise the first part that is not a unit or an address */
    if (pick < 0 && parts.length > 1 && folded[0].trim().split(' ').length >= 3 && !/\d/.test(folded[0])) pick = 0;
    if (pick < 0) pick = folded.findIndex(f => !SUBUNIT.test(f) && !/\d/.test(f));
    if (pick < 0) pick = 0;
    let name = parts[pick];
    /* names with a comma inside: "Instituto Federal de Educação, Ciência e Tecnologia da Paraíba" */
    if (pick + 1 < parts.length && /\b(educacao|education)$/.test(folded[pick].trim()) && /^ (ciencia|science)/.test(folded[pick + 1])) name += ', ' + parts[pick + 1];
    return P.normalizeInstitution(name);
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpInstitutions);
