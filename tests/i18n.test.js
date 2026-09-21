/* Dictionaries: parity between languages, placeholders, naming rules. */
'use strict';

/* every string leaf of a dictionary as { 'a.b.c': 'text' } (phrases excluded) */
function flatten(obj, prefix, out) {
  out = out || {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (!prefix && k === 'phrases') continue;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
const placeholders = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

/* Names that may appear only on the import screen (keys under import / importStub),
   and names that may never appear anywhere. */
const DATABASE_NAMES = [/\bscopus\b/i, /\bweb of science\b/i, /\bWoS\b/, /\bpubmed\b/i, /\bMEDLINE\b/, /\bopenalex\b/i,
  /\bThe Lens\b/, /\blens\.org\b/i, /\bDimensions\b/, /\bcrossref\b/i, /\bclarivate\b/i, /\belsevier\b/i];
const NEVER = [/chapingo/i, /\bUACh\b/i, /\bCRUO\b/i, /\bexcel\b/i, /\bmicrosoft\b/i, /\bgoogle\b/i, /\bzotero\b/i,
  /\bmendeley\b/i, /\bendnote\b/i, /\bvosviewer\b/i, /\bcitespace\b/i, /\bbibliometrix\b/i, /\bbiblioshiny\b/i];

describe('i18n · dictionaries', () => {
  const es = flatten(I18N_DICT.es), en = flatten(I18N_DICT.en);

  it('Spanish and English have exactly the same keys', () => {
    const onlyEs = Object.keys(es).filter(k => !(k in en));
    const onlyEn = Object.keys(en).filter(k => !(k in es));
    deepEq({ onlyEs, onlyEn }, { onlyEs: [], onlyEn: [] });
  });
  it('every entry is a non-empty string', () => {
    const bad = Object.entries(Object.assign({}, es, en)).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k);
    deepEq(bad, []);
  });
  it('placeholders match between languages', () => {
    const bad = Object.keys(es).filter(k => k in en && placeholders(es[k]) !== placeholders(en[k]));
    deepEq(bad, []);
  });
  it('database names appear only in the import screen texts', () => {
    const bad = [];
    for (const [lang, dict] of [['es', es], ['en', en]]) {
      for (const [k, v] of Object.entries(dict)) {
        if (/^import(Stub)?\./.test(k)) continue;
        if (DATABASE_NAMES.some(re => re.test(v))) bad.push(lang + ':' + k);
      }
    }
    deepEq(bad, []);
  });
  it('no institution, commercial program or other package is named anywhere', () => {
    const all = [];
    for (const [lang, dict] of [['es', I18N_DICT.es], ['en', I18N_DICT.en]]) {
      const flat = flatten(dict);
      Object.entries(flat).forEach(([k, v]) => all.push([lang + ':' + k, v]));
      Object.entries(dict.phrases || {}).forEach(([k, v]) => { all.push([lang + ':phrase-key', k]); all.push([lang + ':phrase', v]); });
    }
    const bad = all.filter(([, v]) => NEVER.some(re => re.test(v))).map(([k, v]) => k + ' → ' + v);
    deepEq(bad, []);
  });
  it('the figure engine labels all have a Spanish translation', () => {
    const own = [];
    Fig.STYLE_CONTROLS.forEach(c => { own.push(c.label); (c.options || []).forEach(o => own.push(Array.isArray(o) ? o[1] : o)); });
    [Fig.themeNames, Fig.fontNames, Fig.paletteNames, Fig.colormapNames].forEach(o => Object.values(o).forEach(v => own.push(v)));
    const missing = own.filter(s => typeof I18N_DICT.es.phrases[s] !== 'string');
    deepEq(missing, []);
  });
});

describe('i18n · runtime', () => {
  it('t() interpolates and falls back to the key when missing', () => {
    const prev = I18N.lang;
    I18N.lang = 'es';
    eq(t('home.stepLabel', { n: 3 }), 'Paso 3');
    eq(t('footer.version', { v: '9.9' }), 'Versión 9.9');
    I18N.missing.clear();
    eq(t('no.such.key'), 'no.such.key');
    ok(I18N.missing.has('es:no.such.key'));
    I18N.missing.clear();
    I18N.lang = 'en';
    eq(t('home.stepLabel', { n: 3 }), 'Step 3');
    I18N.lang = prev;
  });
  it('top-N titles have a singular form without the number', () => {
    const keys = ['sources.top.title', 'sources.impact.title', 'sources.dynamics.sub', 'authors.top.title', 'authors.time.title',
      'authors.impact.title', 'authors.inst.title', 'authors.ctry.scpTitle', 'authors.ctry.citeTitle', 'documents.cited.title',
      'documents.local.title', 'documents.refs.title', 'documents.words.titleBars', 'documents.words.titleCloud',
      'documents.words.titleTreemap', 'documents.growth.titleCumulative', 'documents.growth.titleAnnual'];
    const prev = I18N.lang;
    const bad = [];
    for (const lang of ['es', 'en']) {
      I18N.lang = lang;
      keys.forEach(k => {
        const one = tp(k, 1, { measure: 'X' }), many = tp(k, 12, { measure: 'X' });
        if (/\{|\b1\b/.test(one) || !/\b12\b/.test(many) || /\{/.test(many)) bad.push(lang + ':' + k + ' → ' + one + ' | ' + many);
      });
    }
    I18N.lang = 'es';
    eq(tp('authors.ctry.citeTitle', 1), 'El país más citado');
    eq(tp('authors.ctry.citeTitle', 7), 'Los 7 países más citados');
    eq(tp('sources.impact.title', 1, { measure: 'Índice h' }), 'Índice h de la fuente con mayor valor');
    I18N.lang = 'en';
    eq(tp('authors.ctry.citeTitle', 1), 'The most cited country');
    I18N.lang = prev;
    deepEq(bad, []);
  });
  it('count sentences agree in number when n = 1', () => {
    const prev = I18N.lang;
    const vars = { total: '5', docs: '5 documentos', unit: 'autores', pct: '100 %', maybe: '1', undecided: '0' };
    const one = {
      'import.previewSub': 'El único registro importado.',
      'cleaning.filters.result': '1 de 5 documentos cumple los filtros.',
      'authors.lotka.fewAuthors': 'Solo hay 1 autor: con 35 o menos, los valores críticos de Kolmogorov-Smirnov no son confiables.',
      'social.network.coverage': '1 de 5 documentos trae autores reconocibles; los demás no entran en la red.',
      'social.cards.internationalSub': '100 % de 1 documento con país',
      'social.map.coverage': '1 de 5 documentos trae al menos un país; los demás no cuentan en el mapa.',
      'prisma.only.on': 'Los análisis usan ahora solo el documento incluido.',
      'prisma.cards.screenedSub': '1 excluido por título y resumen',
      'prisma.cards.assessedSub': '1 excluido con motivo',
      'prisma.cards.notRetrievedSub': '1 no recuperado',
      'prisma.diagram.pending': '1 documento sigue pendiente (dudosos: 1; sin decidir: 0): aparece en la caja final y el diagrama queda completo cuando tenga decisión.',
      'export.zip.hint': '1 figura, tabla o red marcada, más los datos elegidos y un índice de archivos.',
    };
    I18N.lang = 'es';
    const got = Object.fromEntries(Object.keys(one).map(k => [k, tp(k, 1, vars)]));
    const plural = tp('prisma.cards.notRetrievedSub', 2);
    I18N.lang = 'en';
    const bad = Object.keys(one).filter(k => /\{|^\S+$/.test(tp(k, 1, vars)) || !/\b2\b/.test(tp(k, 2, vars)));
    I18N.lang = prev;
    deepEq(got, one);
    eq(plural, '2 no recuperados');
    deepEq(bad, [], 'English forms');
  });
  it('a collection of a single document reads in the singular', () => {
    const prev = I18N.lang;
    const texts = () => [
      tp('cleaning.counter', 1, { shown: '1' }),
      tp('cleaning.counterIncluded', 1, { shown: '0' }),
      tp('cleaning.filters.result', 1, { docs: tp('cleaning.filters.resultDocs', 1) }),
      tp('import.search.progress', 1, { page: '1', done: '1' }),
      tp('import.search.limited', 1),
      tp('overview.cards.citationsSub', 1, { citations: tp('overview.cards.citationsCount', 1) }),
      tp('overview.cards.referencesSub', 1, { distinct: tp('overview.cards.referencesDistinct', 1) }),
      tp('sources.bradford.zonesNote', 1),
      tp('documents.cards.referencesSub', 1, { citations: tp('documents.cards.referencesCitations', 1) }),
      tp('documents.refs.hint', 1, { refs: tp('documents.refs.hintRefs', 1) }).split('.')[0],
      tp('documents.rpys.missing', 1, { refs: tp('documents.rpys.missingRefs', 1) }),
      tp('documents.words.hint', 1, { docs: tp('documents.words.hintDocs', 1) }),
      t('documents.local.matched', { matched: '1', references: '1', doi: '1', id: '0', bib: '0' }).split(';')[0],
      tp('conceptual.cards.documentsSub', 1),
      tp('social.network.coverage', 1, { docs: tp('social.network.coverageDocs', 2), unit: 'x' }).split(' x')[0],
      tp('prisma.screen.counts', 1, { decided: '1', pct: '100 %', include: '1', exclude: '0', maybe: '0', pending: '0' }).split(' ·')[0],
      tp('export.zip.done', 1, { size: '0.1' }),
    ];
    I18N.lang = 'es';
    const es = texts();
    I18N.lang = 'en';
    const en = texts();
    I18N.lang = prev;
    deepEq(es, ['1 de 1 documento', '0 de 1 documento · solo incluidos', '1 de 1 documento cumple los filtros.', 'Página 1 · 1 de 1 registro',
      'La búsqueda supera el máximo: se descargará el registro más citado.', '1 cita en 1 documento con conteo', '1 distinta · en 1 documento',
      'Las tres zonas suman 1 documento con fuente.', '1 cita en 1 documento', '1 obra distinta en 1 referencia',
      '1 de 1 referencia no trae año y queda fuera del espectro.', '1 de 1 documento tiene términos en este campo.',
      'Referencias emparejadas con documentos del conjunto: 1 de 1', 'de 1 documento', '1 de 2 documentos trae', '1 de 1 documento decidido (100 %)',
      'Listo: 1 archivo (0.1 MB).']);
    deepEq(en, ['1 of 1 document', '0 of 1 document · included only', '1 of 1 document meets the filters.', 'Page 1 · 1 of 1 record',
      'The search exceeds the maximum: the most cited record will be downloaded.', '1 citation in 1 document with a count', '1 distinct · in 1 document',
      'The three zones add up to 1 document with a source.', '1 citation in 1 document', '1 distinct work in 1 reference',
      '1 of 1 reference has no year and is left out of the spectrum.', '1 of 1 document has terms in this field.',
      'References matched to documents of the collection: 1 of 1', 'of 1 document', '1 of 2 documents carries recognisable','1 of 1 document decided (100 %)',
      'Ready: 1 file (0.1 MB).']);
  });
  it('subtitles and notes with several counts agree in number with each one', () => {
    const prev = I18N.lang;
    const texts = () => [
      t('sources.cards.coreSub', { sources: tp('sources.cards.coreSources', 1), docs: tp('sources.cards.coreDocs', 1), pct: '10 %' }),
      t('conceptual.evolution.period', { range: '2020', docs: tp('conceptual.evolution.periodDocs', 1), themes: tp('conceptual.evolution.periodThemes', 1) }),
      t('conceptual.evolution.sub', { periods: tp('conceptual.evolution.subPeriods', 1), links: tp('conceptual.evolution.subLinks', 1) }).split(' · ').slice(0, 2).join(' · '),
      t('social.map.sub', { arcs: tp('social.map.subArcs', 1), countries: tp('social.map.subCountries', 1) }),
      t('export.list.found', { figures: tp('export.list.foundFigures', 1), tables: tp('export.list.foundTables', 1), networks: tp('export.list.foundNetworks', 1) }),
      tp('conceptual.figureSub', 1, { nodes: '5', q: '0.1' }),
      tp('intellectual.figureSub', 1, { nodes: '5', q: '0.1' }),
      tp('intellectual.hg.sub', 1, { docs: '2' }),
      tp('prisma.cards.removedSub', 1, { other: '0' }),
      tp('conceptual.thematic.tooFew', 1).split('.')[0],
      tp('intellectual.map.tooFew', 1, { units: tp('intellectual.map.tooFewUnits', 1) }).split(':')[0],
      tp('intellectual.cocitation.tooFew', 1).match(/\(.*\)/)[0],
      tp('intellectual.coupling.tooFew', 1).match(/\(.*\)/)[0],
      tp('social.network.tooFew', 1, { unit: 'x' }).match(/\(.*\)/)[0],
      tp('network.tooFew', 1).match(/\(.*\)/)[0],
      tp('intellectual.hg.none', 1).match(/\(.*\)/)[0],
    ];
    I18N.lang = 'es';
    const es = texts();
    I18N.lang = 'en';
    const en = texts();
    I18N.lang = prev;
    deepEq(es, ['fuente con 1 documento (10 %)', '2020: 1 documento, 1 tema', '1 periodo · 1 enlace', '1 arco · 1 país', '1 figura, 1 tabla y 1 red.',
      '5 términos en 1 comunidad · modularidad Q = 0.1', '5 nodos en 1 comunidad · modularidad Q = 0.1', '2 documentos · 1 cita', '1 duplicado · 0 por otras razones',
      'Con estos parámetros solo hay 1 tema', 'Con estos parámetros hay 1 grupo entre 1 unidad', '(1 seleccionado)', '(1 seleccionada)', '(1 seleccionado)',
      '(1 término seleccionado)', '(1 referencia revisada)']);
    deepEq(en, ['source with 1 document (10 %)', '2020: 1 document, 1 theme', '1 period · 1 link', '1 arc · 1 country', '1 figure, 1 table and 1 network.',
      '5 terms in 1 community · modularity Q = 0.1', '5 nodes in 1 community · modularity Q = 0.1', '2 documents · 1 citation', '1 duplicate · 0 for other reasons',
      'With these parameters there is only 1 theme', 'With these parameters there is 1 cluster among 1 unit', '(1 selected)', '(1 selected)', '(1 selected)',
      '(1 term selected)', '(1 reference checked)']);
  });
  it('phrase() translates engine labels in Spanish and leaves English as is', () => {
    const prev = I18N.lang;
    I18N.lang = 'es'; eq(I18N.phrase('Theme'), 'Tema');
    eq(I18N.phrase('{w} × {h} px · {wcm} × {hcm} cm at {dpi} dpi', { w: 1, h: 2, wcm: 3, hcm: 4, dpi: 300 }), '1 × 2 px · 3 × 4 cm a 300 dpi');
    I18N.lang = 'en'; eq(I18N.phrase('Theme'), 'Theme');
    I18N.lang = prev;
    I18N.missing.clear();
  });
  it('apply() fills data-i18n text and attributes', () => {
    const prev = I18N.lang;
    I18N.lang = 'es';
    const box = mk('div', null, '<span data-i18n="nav.home"></span><button data-i18n-attr="title:header.menu;aria-label:header.openMenu"></button>');
    I18N.apply(box);
    eq(box.querySelector('span').textContent, 'Inicio');
    eq(box.querySelector('button').title, 'Menú');
    eq(box.querySelector('button').getAttribute('aria-label'), 'Abrir el menú de módulos');
    I18N.lang = prev;
  });
});
