/* Intellectual structure: cited first authors and sources, co-citation and bibliographic coupling worked out by hand,
   normalised citation scores, cluster labels, the coupling map, the historiograph (later-year and same-year cycles,
   families, barycentre order) and the screen with its figures, cards, helps and exports. */
'use strict';

/* ten documents: two lines of work that cite each other (squash and maize), a pair published online and in print in
   different years that cite each other, and a note without references; every expected value was worked out by hand */
function intellectualDataset() {
  const P = Parsers.lib();
  const rec = o => {
    const r = Object.assign(P.newRecord(), o);
    r.authors = o.authors.map(a => P.person(a));
    r.references = (o.refsB || []).map(P.parseRefB);
    delete r.refsB;
    return P.finish(r);
  };
  const W1 = 'Adams A, 1990, J ECOL, V1, P1', W2 = 'Brown B, 1995, ECON BOT, V2, P2', W3 = 'Clark C, 1998, Journal of Ecology, V3, P3';
  const W4 = 'Evans E, 2000, PLANT J, V4, P4', W5 = 'Fox F, 1985, MAYDICA, V5, P5', W6 = 'Gray G, 1992, ECON BOT, V6, P6', W7 = 'Hill H, 2001, GENET RESOUR CROP EV, V7, P7';
  const D = (who, year, src, doi) => `${who}, ${year}, ${src}, V1, P1, DOI ${doi}`;
  const sq = ['squash', 'bees'], mz = ['maize', 'landraces'];
  return [
    rec({ title: 'Wild squash populations in western Mexico', authors: ['Lira, R.'], year: 2010, sourceTitle: 'Economic Botany', doi: '10.1000/a0', timesCited: 50, docTypeRaw: 'Article', authorKeywords: sq, refsB: [W1, W2] }),
    rec({ title: 'Domestication of squash in Mesoamerica', authors: ['Cruz, A.', 'Lira, R.'], year: 2012, sourceTitle: 'Genetic Resources and Crop Evolution', doi: '10.1000/a1', timesCited: 30, docTypeRaw: 'Article', authorKeywords: sq,
      refsB: [D('Lira R', 2010, 'ECON BOT', '10.1000/A0'), W1, W2, W3] }),
    rec({ title: 'Pollinators of cultivated squash flowers', authors: ['Soto, B.'], year: 2014, sourceTitle: 'Economic Botany', doi: '10.1000/a2', timesCited: 20, docTypeRaw: 'Article', authorKeywords: sq,
      refsB: [D('Lira R', 2010, 'ECON BOT', '10.1000/A0'), D('Cruz A', 2012, 'GENET RESOUR CROP EV', '10.1000/A1'), W2, W3] }),
    rec({ title: 'Solitary bees visiting squash at dawn', authors: ['Diaz, C.'], year: 2016, sourceTitle: 'Economic Botany', doi: '10.1000/a3', timesCited: 10, docTypeRaw: 'Article', authorKeywords: sq,
      refsB: [D('Cruz A', 2012, 'GENET RESOUR CROP EV', '10.1000/A1'), D('Soto B', 2014, 'ECON BOT', '10.1000/A2'), W3, W4] }),
    rec({ title: 'Maize landraces of the central highlands', authors: ['Lopez, D.'], year: 2014, sourceTitle: 'Maydica', doi: '10.1000/a4', timesCited: 40, docTypeRaw: 'Article', authorKeywords: mz, refsB: [W5, W6] }),
    rec({ title: 'Genetic diversity of native maize', authors: ['Perez, E.', 'Lopez, D.'], year: 2016, sourceTitle: 'Maydica', doi: '10.1000/a5', timesCited: 15, docTypeRaw: 'Article', authorKeywords: mz,
      refsB: [D('Lopez D', 2014, 'MAYDICA', '10.1000/A4'), W5, W6, W7] }),
    rec({ title: 'Maize grown in the milpa system', authors: ['Ruiz, F.'], year: 2019, sourceTitle: 'Maydica', doi: '10.1000/a6', timesCited: 5, docTypeRaw: 'Article', authorKeywords: mz,
      refsB: [D('Lopez D', 2014, 'MAYDICA', '10.1000/A4'), D('Perez E', 2016, 'MAYDICA', '10.1000/A5'), W6, W7] }),
    rec({ title: 'A paper published online first', authors: ['Vega, G.'], year: 2020, sourceTitle: 'Plant Journal', doi: '10.1000/a7', timesCited: 2, docTypeRaw: 'Article', authorKeywords: ['seeds'],
      refsB: [D('Mora H', 2021, 'PLANT J', '10.1000/A8')] }),
    rec({ title: 'A reply printed a year later', authors: ['Mora, H.'], year: 2021, sourceTitle: 'Plant Journal', doi: '10.1000/a8', timesCited: 1, docTypeRaw: 'Article', authorKeywords: ['seeds'],
      refsB: [D('Vega G', 2020, 'PLANT J', '10.1000/A7')] }),
    rec({ title: 'A note on seed storage without references', authors: ['Nava, I.'], year: 2018, sourceTitle: 'Plant Journal', timesCited: 0, docTypeRaw: 'Note', authorKeywords: ['seeds'] }),
  ];
}

describe('intellectual · co-citation and coupling', () => {
  const P = () => Parsers.lib();

  it('cited first authors by surname and initial; cited sources with abbreviations joined only without ambiguity', () => {
    deepEq(['Smith JA', 'SMITH J', 'Toledo V.M.', 'de la Cruz M.', 'Smith, J.', 'Garcia-Oliva F.', '[Anonymous]', 'Cadena-Iñiguez J.'].map(n => P().citedAuthorKey(n)),
      ['smith|j', 'smith|j', 'toledo|v', 'delacruz|m', 'smith|j', 'garciaoliva|f', '', 'cadenainiguez|j']);
    deepEq(P().refAuthorParts('Aguirre-Medina J. F.'), { surname: 'aguirremedina', initials: 'jf' });
    /* spaced initials without dots are initials, not part of the surname; a short surname stays */
    deepEq(['NEWMAN M E J', 'NEWMAN M. E. J.', 'NEWMAN MEJ', 'WANG Y L', 'LI Y', 'HO YS', 'DE SOLLA PRICE D'].map(n => P().citedAuthorKey(n)),
      ['newman|m', 'newman|m', 'newman|m', 'wang|y', 'li|y', 'ho|y', 'desollaprice|d']);
    const G = P().citedSourceGroups(new Map([['J Ecol', 3], ['Journal of Ecology', 2], ['J. Ecol.', 1], ['J ECON', 1], ['PhytoKeys', 1], ['Phyto Keys', 1], ['Phys Rev', 1], ['Physical Review', 1], ['Physics Reviews', 1]]));
    const g = s => G.groupOf.get(s);
    ok(g('J Ecol') === g('Journal of Ecology') && g('J. Ecol.') === g('J Ecol'), 'abbreviations of the same journal');
    eq(G.labels.get(g('J Ecol')), 'Journal of Ecology', 'named after the full title');
    ok(g('J ECON') !== g('J Ecol'), 'another journal');
    eq(g('PhytoKeys'), g('Phyto Keys'), 'same letters');
    ok(g('Phys Rev') !== g('Physical Review') && g('Phys Rev') !== g('Physics Reviews') && g('Physical Review') !== g('Physics Reviews'), 'an abbreviation of two different titles stays apart');
    eq(G.joined, 2, 'J Ecol → Journal of Ecology and Phyto Keys → PhytoKeys');
  });

  it('co-citation (AᵀA) of references, first authors and sources, and coupling (AAᵀ) of documents and authors with Salton’s cosine', () => {
    const recs = intellectualDataset().slice(0, 4);
    const cl = P().referenceAnalysis(recs).clusters;
    eq(cl.byDoc.length, 4);
    deepEq(cl.byDoc.map(l => l.length), [2, 4, 4, 4], 'distinct works per document');
    const label = i => P().referenceShort(cl.rows[i], 60);
    const R = P().citedLists(cl, 'references');
    const inc = P().incidence(R.lists, { minFreq: 2 });
    const pairs = P().cooccurrence(inc.docs, inc.items.length).map(([i, j, c]) => [label(inc.items[i].key), label(inc.items[j].key)].sort().concat(c).join(' · ')).sort();
    deepEq(inc.items.map(it => [label(it.key), it.freq]).sort(), [['Adams A, 1990, J ECOL', 2], ['Brown B, 1995, ECON BOT', 3], ['Clark C, 1998, Journal of Ecology', 3], ['Cruz A, 2012, GENET RESOUR CROP EV', 2], ['Lira R, 2010, ECON BOT', 2]].sort());
    deepEq(pairs, [
      'Adams A, 1990, J ECOL · Brown B, 1995, ECON BOT · 2', 'Adams A, 1990, J ECOL · Clark C, 1998, Journal of Ecology · 1', 'Adams A, 1990, J ECOL · Lira R, 2010, ECON BOT · 1',
      'Brown B, 1995, ECON BOT · Clark C, 1998, Journal of Ecology · 2', 'Brown B, 1995, ECON BOT · Cruz A, 2012, GENET RESOUR CROP EV · 1', 'Brown B, 1995, ECON BOT · Lira R, 2010, ECON BOT · 2',
      'Clark C, 1998, Journal of Ecology · Cruz A, 2012, GENET RESOUR CROP EV · 2', 'Clark C, 1998, Journal of Ecology · Lira R, 2010, ECON BOT · 2', 'Cruz A, 2012, GENET RESOUR CROP EV · Lira R, 2010, ECON BOT · 1',
    ].sort(), 'counts of documents citing both');
    const A = P().citedLists(cl, 'authors');
    const ai = P().incidence(A.lists, { minFreq: 1 });
    deepEq(ai.items.map(it => [A.labels.get(it.key), it.freq]), [['Brown B', 3], ['Clark C', 3], ['Adams A', 2], ['Cruz A', 2], ['Lira R', 2], ['Evans E', 1], ['Soto B', 1]]);
    const S = P().citedLists(cl, 'sources');
    eq(S.joined, 1, 'J ECOL joined to Journal of Ecology');
    const si = P().incidence(S.lists, { minFreq: 1 });
    deepEq(si.items.map(it => [S.labels.get(it.key), it.freq]), [['ECON BOT', 4], ['Journal of Ecology', 4], ['GENET RESOUR CROP EV', 2], ['PLANT J', 1]]);
    deepEq(P().cooccurrence(si.docs, si.items.length).map(e => [S.labels.get(si.items[e[0]].key), S.labels.get(si.items[e[1]].key), e[2]]),
      [['ECON BOT', 'Journal of Ecology', 4], ['ECON BOT', 'GENET RESOUR CROP EV', 2], ['ECON BOT', 'PLANT J', 1], ['Journal of Ecology', 'GENET RESOUR CROP EV', 2], ['Journal of Ecology', 'PLANT J', 1], ['GENET RESOUR CROP EV', 'PLANT J', 1]]);

    /* coupling of the four documents: shared works and Salton's cosine */
    const units = P().couplingUnits(recs, cl, null, 'documents');
    const net = P().couplingNetwork(units, { normalization: 'salton' });
    const w = new Map(net.edges.map(e => [net.nodes[e[0]].key + '-' + net.nodes[e[1]].key, [e[2], e[3]]]));
    deepEq([...w.keys()], ['d0-d1', 'd0-d2', 'd1-d2', 'd1-d3', 'd2-d3']);
    deepEq([...w.values()].map(x => x[0]), [2, 1, 3, 1, 2]);
    near(w.get('d0-d1')[1], 2 / Math.sqrt(8)); near(w.get('d0-d2')[1], 1 / Math.sqrt(8)); near(w.get('d1-d2')[1], 3 / 4); near(w.get('d1-d3')[1], 1 / 4); near(w.get('d2-d3')[1], 2 / 4);
    /* authors: Lira R. wrote d0 and d1 → the works of both; Cruz A. d1 */
    const au = P().couplingUnits(recs, cl, null, 'authors');
    const lira = au.find(u => u.key === 'lira|r'), cruz = au.find(u => u.key === 'cruz|a');
    deepEq([lira.docs, lira.refs.length, cruz.docs, cruz.refs.length], [[0, 1], 4, [1], 4]);
    const an = P().couplingNetwork(au, { normalization: 'salton' });
    const lc = an.edges.find(e => [an.nodes[e[0]].key, an.nodes[e[1]].key].sort().join() === 'cruz|a,lira|r');
    deepEq([lc[2], lc[3]], [4, 1], 'identical sets of works');
  });

  it('units ranked by citations, normalised citation scores by year and cluster labels by frequency × confidence', () => {
    const units = [{ key: 'a', docs: [0], citations: 5, local: 0 }, { key: 'b', docs: [1, 2], citations: 9, local: 1 }, { key: 'c', docs: [3], citations: null, local: 4 }, { key: 'd', docs: [4, 5], citations: 5, local: 2 }];
    deepEq(P().selectUnits(units, {}).map(u => u.key), ['b', 'd', 'a', 'c']);
    deepEq(P().selectUnits(units, { minDocs: 2, maxNodes: 1 }).map(u => u.key), ['b']);
    const recs = [2020, 2020, 2021, 2021, null, 2022].map(year => ({ year }));
    deepEq(P().normalizedCitationScores(recs, [10, 30, 0, 0, 5, null]), [0.5, 1.5, 0, 0, null, null]);
    const lists = [['a', 'b'], ['a', 'c'], ['a', 'b'], ['a'], ['c']];
    const totals = new Map([['a', 4], ['b', 2], ['c', 2]]);
    deepEq(P().clusterTerms([0, 1, 2], lists, totals).map(x => [x.key, x.inCluster, x.total, +x.score.toFixed(4)]), [['a', 3, 4, 2.25], ['b', 2, 2, 2]], 'terms of one document out (at least 2 per term)');
    deepEq(P().clusterTerms([4], lists, totals).map(x => x.key), ['c'], 'a cluster of one document');
  });

  it('coupling map: Callon centrality from the edges between clusters, impact from the normalised scores, quadrants at the medians', () => {
    const units = [[1, 2, 3], [1, 2, 3], [1, 2, 4], [7, 8, 9], [7, 8, 9], [7, 8, 3]].map((refs, i) => ({ key: 'u' + i, label: 'U' + i, docs: [i], refs, citations: [10, 20, 30, 0, 0, 30][i], local: 0 }));
    const recs = units.map(() => ({ year: 2020 }));
    const scores = Parsers.lib().normalizedCitationScores(recs, [10, 20, 30, 0, 0, 30]);
    const lists = [['squash'], ['squash', 'bees'], ['squash'], ['maize'], ['maize'], ['maize', 'squash']];
    const map = P().couplingMap(units, recs, lists, scores, { minClusterSize: 2 });
    eq(map.clusters.length, 2);
    const A = map.clusters.find(c => c.docs.includes(0)), B = map.clusters.find(c => c.docs.includes(3));
    deepEq([A.docs, B.docs], [[0, 1, 2], [3, 4, 5]]);
    near(A.internal, 1 + 2 / 3 + 2 / 3, 1e-12); near(A.external, 2 / 3, 1e-12); near(A.centrality, 20 / 3, 1e-12); near(B.centrality, 20 / 3, 1e-12);
    near(A.impact, (10 + 20 + 30) / 15 / 3, 1e-12, 'mean of 10, 20, 30 over the mean of the year (15)'); near(B.impact, 2 / 3, 1e-12);
    near(map.medianImpact, (A.impact + B.impact) / 2, 1e-12);
    deepEq([A.quadrant, B.quadrant], ['motor', 'basic']);
    deepEq([A.labelKeys, B.labelKeys], [['squash'], ['maize']]);
    deepEq(A.units.map(i => map.nodes[i].key), ['u2', 'u1', 'u0'], 'most cited first');
  });
});

describe('intellectual · historiograph', () => {
  const P = () => Parsers.lib();
  const records = years => years.map(year => ({ year, timesCited: null }));
  const acyclic = H => {
    const kept = H.links.filter(l => l.status === 'kept');
    const indeg = H.nodes.map(() => 0);
    kept.forEach(l => indeg[l.to]++);
    const queue = indeg.map((d, i) => (d ? -1 : i)).filter(i => i >= 0);
    let seen = 0;
    while (queue.length) { const x = queue.pop(); seen++; kept.filter(l => l.from === x).forEach(l => { if (--indeg[l.to] === 0) queue.push(l.to); }); }
    return seen === H.nodes.length;
  };

  it('arrows from older to newer documents: a cited document published later is left out, a same-year cycle is broken', () => {
    const recs = records([2000, 2003, 2003, 2005, 2002]);
    const lc = { local: [3, 2, 2, 0, 1], cites: [[4], [0, 2], [0, 1], [1, 2, 0], []] };
    const H = P().historiograph(recs, lc, { maxNodes: 30, minLocal: 1 });
    deepEq(H.nodes.map(n => n.index), [0, 1, 2, 4], 'most locally cited first; the document without local citations out');
    deepEq(H.links.map(l => [H.nodes[l.from].index, H.nodes[l.to].index, l.status]), [[0, 1, 'kept'], [0, 2, 'kept'], [1, 2, 'kept'], [2, 1, 'cycle'], [4, 0, 'later']]);
    deepEq([H.kept, H.later, H.cycle, H.candidates], [3, 1, 1, 4]);
    deepEq(H.years, [2000, 2002, 2003]);
    deepEq(H.nodes.map(n => n.layer), [0, 2, 2, 1]);
    ok(H.links.filter(l => l.status === 'kept').every(l => recs[H.nodes[l.from].index].year <= recs[H.nodes[l.to].index].year), 'never from newer to older');
    ok(acyclic(H), 'no cycles');
    deepEq([H.components, H.nodes.map(n => n.component)], [1, [0, 0, 0, -1]], 'one family; the later-year document alone');
    const all = P().historiograph(recs, lc, { minLocal: 0 });
    deepEq([all.nodes.length, all.kept, all.later, all.cycle], [5, 6, 1, 1], 'with 0 the document that only cites enters');
    ok(acyclic(all), 'no cycles');
    const linked = P().historiograph(recs, lc, { removeIsolated: true });
    deepEq([linked.nodes.map(n => n.index), linked.later], [[0, 1, 2], 0]);
  });

  it('the order inside each year follows the barycentres and removes the crossings of the first order', () => {
    const recs = records([2000, 2000, 2001, 2001, 2002]);
    const lc = { local: [1, 5, 4, 3, 0], cites: [[], [], [0], [1], [2, 3]] };
    const crossings = H => {
      const kept = H.links.filter(l => l.status === 'kept');
      let n = 0;
      for (let a = 0; a < kept.length; a++) for (let b = a + 1; b < kept.length; b++) {
        const p = kept[a], q = kept[b];
        if (H.nodes[p.from].layer !== H.nodes[q.from].layer || H.nodes[p.to].layer !== H.nodes[q.to].layer) continue;
        if ((H.nodes[p.from].y - H.nodes[q.from].y) * (H.nodes[p.to].y - H.nodes[q.to].y) < 0) n++;
      }
      return n;
    };
    const H = P().historiograph(recs, lc, { minLocal: 0 });
    eq(H.kept, 4);
    eq(crossings(H), 0);
    const first = { nodes: H.nodes.map(n => Object.assign({}, n)), links: H.links };
    /* the order by local citations alone: 1 above 0 and 2 above 3, which crosses 0 → 2 with 1 → 3 */
    const byLocal = k => ({ 0: 0.75, 1: 0.25, 2: 0.25, 3: 0.75, 4: 0.5 })[H.nodes[k].index];
    first.nodes.forEach((n, k) => { n.y = byLocal(k); });
    eq(crossings(first), 1);
    ok(H.nodes.every(n => n.y > 0 && n.y < 1 && n.order < n.size), 'positions inside each column');
  });
});

describe('intellectual · screen', () => {
  const reset = () => { ImportModule.clear(); Pipeline.settings = null; Prefs.del('synonyms'); Prefs.del('stopwords'); Prefs.del('termField'); IntellectualModule.reset(); };
  const change = (id, v) => { const s = el(id); if (s.type === 'checkbox') s.checked = !!v; else s.value = String(v); s.dispatchEvent(new Event('change')); };
  const value = (grid, key) => el(grid).querySelector(`[data-key="${key}"] .metric-value`).textContent;
  const sub = (grid, key) => el(grid).querySelector(`[data-key="${key}"] .metric-sub`).textContent;
  const tab = async id => {
    IntellectualModule.tab = id;
    App.render('intellectual');
    if (id === 'cocitation') await IntellectualModule.co.pending;
    if (id === 'coupling') await IntellectualModule.cp.pending;
  };
  const load = async records => {
    ImportModule.addResult({ name: 'intellectual.csv', size: 1, format: 'csv', source: 'table', records, warnings: [], completeness: Parsers.lib().completeness(records) });
    await Pipeline.pending;
    location.hash = '#/intellectual';
  };

  it('without cited references: a clear message on how to export them, and a button to the export instructions', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    await load(networkDataset());
    App.render('intellectual');
    ok(el('inNoRefs'), 'message');
    ok(!el('ipanel'), 'no tabs');
    const text = el('inNoRefs').textContent;
    ok(text.includes('referencias citadas') && text.includes('campo CR') && text.includes('incluye las referencias'), text);
    el('inHowTo').click();
    await tick(40);
    eq(state.route, 'import');
    ok(el('impFormats').open, 'export instructions open');
    reset();
    await Pipeline.pending;
  });

  it('co-citation of references, cited authors and cited sources', async () => {
    I18N.setLang('es'); App.boot(el('app')); reset();
    await load(intellectualDataset());
    eq(Pipeline.records().length, 10);
    await tab('cocitation');
    ok(el('ccStats'), 'statistics');
    deepEq(['nodes', 'communities'].map(k => value('ccStats', k)), ['9', '2']);
    eq(sub('ccStats', 'diameter'), '2 componentes conexos', 'squash and maize literatures');
    const data = IntellectualModule.co.current.data;
    const labels = data.nodes.map((n, i) => IntellectualModule.cocitationSpec(Pipeline.references()).label(data, i));
    ok(labels.includes('Brown B, 1995, ECON BOT') && labels.includes('Lira R, 2010, ECON BOT'), labels.join(' | '));
    const view = IntellectualModule.co.view;
    eq(view.search('Brown'), labels.indexOf('Brown B, 1995, ECON BOT'));
    ok(!el('ccNode').hidden && el('ccNode').textContent.includes('Citado por 3 documentos'), 'node card');
    eq(el('ccNode').querySelector('.in-ref-text').textContent, 'Brown B, 1995, ECON BOT, V2, P2');
    eq(el('ccFigure').querySelectorAll('[data-series="nodes"] circle').length, 9);
    eq(el('ccEdges').querySelector('thead').textContent.includes('Cocitaciones'), true);
    change('ccParams-unit', 'authors');
    await IntellectualModule.co.pending;
    eq(value('ccStats', 'nodes'), '9');
    ok(el('ccNodes').textContent.includes('Autor citado') && el('ccNodes').textContent.includes('Brown B'), 'cited authors');
    change('ccParams-unit', 'sources');
    await IntellectualModule.co.pending;
    const srcLabels = IntellectualModule.co.current.data.nodes.map(n => IntellectualModule.co.current.data.cited.labels.get(n.key));
    ok(srcLabels.includes('Journal of Ecology') && !srcLabels.includes('J ECOL'), srcLabels.join(' | '));
    change('ccParams-unit', 'references');
    await IntellectualModule.co.pending;
  });

  it('bibliographic coupling of documents with Salton’s cosine, and of authors', async () => {
    await tab('coupling');
    deepEq(['nodes', 'communities'].map(k => value('cpStats', k)), ['7', '2']);
    ok(el('ipanel').textContent.includes('Pesos: coseno de Salton'), 'the proper name keeps its capital inside the sentence');
    ok(el('cpEdges').querySelector('thead').textContent.includes('Peso (coseno de Salton)'), el('cpEdges').querySelector('thead').textContent);
    const rows = [...el('cpEdges').querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent));
    const find = (a, b) => rows.find(r => (r[0].startsWith(a) && r[1].startsWith(b)) || (r[0].startsWith(b) && r[1].startsWith(a)));
    deepEq(find('Cruz A., 2012', 'Soto B., 2014').slice(2), ['3', '0.75']);
    deepEq(find('Lira R., 2010', 'Cruz A., 2012').slice(2), ['2', '0.70711']);
    eq(el('cpFigure').querySelectorAll('[data-series="nodes"] circle').length, 7);
    const v = IntellectualModule.cp.view;
    v.search('Soto');
    ok(el('cpNode').querySelector('.in-doi') && el('cpNode').querySelector('.in-doi').getAttribute('href') === 'https://doi.org/10.1000/a2', 'DOI link of the document');
    change('cpParams-unit', 'authors');
    await IntellectualModule.cp.pending;
    ok(el('cpParams-minFreq'), 'minimum documents for authors');
    ok(+value('cpStats', 'nodes') >= 7, 'authors coupled');
    change('cpParams-unit', 'documents');
    await IntellectualModule.cp.pending;
  });

  it('coupling map: clusters by Callon centrality and normalised impact, named after their terms', async () => {
    await tab('couplingMap');
    eq(value('cmStats', 'clusters'), '2');
    eq(sub('cmStats', 'motor'), 'landraces, maize');
    eq(sub('cmStats', 'basic'), 'bees, squash');
    eq(el('cmMap').querySelectorAll('[data-series="themes"] circle').length, 2);
    ok(el('cmMap').textContent.includes('Centrales y de alto impacto'), 'quadrant names');
    const res = IntellectualModule.couplingMap(Pipeline.references());
    const maize = res.map.clusters.find(c => c.quadrant === 'motor');
    near(maize.impact, (40 / 30 + 15 / 12.5 + 1) / 3, 1e-12, 'mean normalised score of d4, d5, d6');
    eq(el('cmClusters').querySelectorAll('tbody tr').length, 2);
    eq(el('cmDocs').querySelectorAll('tbody tr').length, 7);
    change('cmParams-impact', 'local');
    ok(el('cmMap'), 'local impact');
    change('cmParams-impact', 'global');
  });

  it('criterion: the historiograph draws arrows from older to newer documents, without impossible cycles; a click shows title, authors and DOI', async () => {
    await tab('historiograph');
    deepEq(['documents', 'links', 'families', 'top', 'excluded'].map(k => value('hgStats', k)), ['7', '5', '3', '2', '1']);
    eq(sub('hgStats', 'excluded'), '1 al citado posterior · 0 que cerrarían ciclos');
    ok(el('hgExcluded') && el('hgExcluded').textContent.includes('1 cita no se dibuja'), 'the later-year citation is reported');
    const warnStyle = getComputedStyle(el('hgExcluded'));
    ok(warnStyle.display === 'flex' && parseFloat(warnStyle.columnGap) >= 8, 'the icon of a warning sits apart from its text: ' + warnStyle.display + ' ' + warnStyle.columnGap);
    const svg = el('hgFigure').querySelector('svg');
    const H = IntellectualModule.historiograph(Pipeline.references());
    const recs = Pipeline.records();
    const paths = [...svg.querySelectorAll('[data-series="links"] path')];
    eq(paths.length, 5);
    ok(paths.every(p => recs[H.nodes[+p.dataset.from].index].year <= recs[H.nodes[+p.dataset.to].index].year), 'every arrow goes forward in time');
    ok(paths.every(p => p.getAttribute('marker-end') === 'url(#hgArrow)'), 'arrow heads');
    const xs = [...svg.querySelectorAll('[data-series="docs"] circle')].map(c => [+c.getAttribute('cx'), recs[H.nodes[+c.dataset.doc].index].year]);
    ok(xs.every(a => xs.every(b => a[1] >= b[1] || a[0] < b[0])), 'x grows with the year');
    const soto = H.nodes.findIndex(n => recs[n.index].title.startsWith('Pollinators'));
    svg.querySelector(`[data-doc="${soto}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    ok(!el('hgDoc').hidden, 'card');
    eq(el('hgDoc').querySelector('h3').textContent, 'Pollinators of cultivated squash flowers');
    eq(el('hgDoc').querySelector('.in-doi').getAttribute('href'), 'https://doi.org/10.1000/a2');
    ok(el('hgDoc').textContent.includes('Soto, B.') || el('hgDoc').textContent.includes('Soto B'), 'authors');
    ok(el('hgDoc').textContent.includes('Cita a 2 documentos de la figura'), el('hgDoc').textContent);
    ok(svg.querySelector(`[data-doc="${soto}"]`).classList.contains('hg-selected'), 'highlighted');
    el('hgDoc').querySelector('.net-node-list .linklike').click();
    ok(el('hgDoc').querySelector('h3').textContent !== 'Pollinators of cultivated squash flowers', 'another document from the card');
    App.render('intellectual');
    ok(!el('hgDoc').hidden, 'the selection survives a redraw');
    eq(el('hgLinks').querySelectorAll('tbody tr').length, 6);
    ok(el('hgLinks').textContent.includes('No: el citado es posterior'), 'status of the excluded citation');
    change('hgParams-minLocal', 0);
    eq(value('hgStats', 'documents'), '9', 'documents that only cite enter');
    change('hgParams-minLocal', 1);
  });

  it('every help has a definition, a formula and its reference; no visible text outside the dictionaries', async () => {
    const data = new Set();
    intellectualDataset().forEach(r => { data.add(r.title); r.references.forEach(x => data.add(x.raw)); r.authorKeywords.forEach(k => data.add(k)); });
    const problems = [], bad = [];
    let helps = 0;
    for (const lang of ['es', 'en']) {
      I18N.setLang(lang);
      for (const id of IntellectualModule.TABS) {
        await tab(id);
        const engine = s => lang === 'en' && typeof I18N_DICT.es.phrases[s] === 'string';
        const record = s => [...data].some(d => d.includes(s) || s.includes(d)) || /^[A-Z][a-z]+ [A-Z]\.?(, \d{4})?/.test(s) || /^\d{4}$/.test(s) || /^(10\.1000\/a\d)$/.test(s);
        strayTexts(el('view'), lang).filter(s => !engine(s) && !record(s)).forEach(s => problems.push(lang + ' ' + id + ': ' + s));
        if (lang === 'es') {
          const buttons = [...el('view').querySelectorAll('.intellectual-page .help-btn')];
          helps += buttons.length;
          buttons.forEach((b, i) => {
            b.click();
            const pop = document.querySelector('.help-pop');
            if (!pop || !pop.querySelector('.formula') || !pop.querySelector('.help-refs li') || pop.querySelector('.help-body p').textContent.length < 30) bad.push(id + ' #' + i);
            HelpPopover.close();
          });
        }
      }
    }
    I18N.setLang('es');
    ok(helps >= 40, 'helps: ' + helps);
    deepEq({ problems: [...new Set(problems)], bad }, { problems: [], bad: [] });
  });

  it('the historiograph and the coupling map export to PNG (300 dpi) and SVG', async () => {
    await tab('historiograph');
    const saved = window.download;
    const got = [];
    window.download = (blob, name) => got.push({ blob, name });
    try {
      for (const id of ['hgFigure']) {
        const buttons = IntellectualModule.cc[id].el.querySelectorAll('.chart-actions button');
        buttons[0].click(); buttons[1].click();
      }
      for (let i = 0; i < 150 && got.length < 2; i++) await tick(30);
      await tab('couplingMap');
      const buttons = IntellectualModule.cc.cmMap.el.querySelectorAll('.chart-actions button');
      buttons[0].click(); buttons[1].click();
      for (let i = 0; i < 150 && got.length < 4; i++) await tick(30);
    } finally { window.download = saved; }
    eq(got.length, 4);
    for (const g of got.filter(x => x.name.endsWith('.png'))) {
      const b = new Uint8Array(await g.blob.arrayBuffer());
      let ppm = null;
      for (let i = 8; i < b.length - 12; i++) if (b[i] === 0x70 && b[i + 1] === 0x48 && b[i + 2] === 0x59 && b[i + 3] === 0x73) { ppm = (b[i + 4] << 24 | b[i + 5] << 16 | b[i + 6] << 8 | b[i + 7]) >>> 0; break; }
      eq(ppm, 11811, g.name);
    }
    for (const g of got.filter(x => x.name.endsWith('.svg'))) {
      const doc = new DOMParser().parseFromString(await g.blob.text(), 'image/svg+xml');
      ok(!doc.querySelector('parsererror'), g.name + ' parses');
      if (g.name.startsWith('historio')) ok(doc.querySelector('marker#hgArrow'), 'arrow marker in the file');
    }
    reset();
    await Pipeline.pending;
  });

  it('references that are catalogue identifiers: a document of the collection is named after its author, year and source', async () => {
    const P = Parsers.lib();
    const rec = (id, title, who, year, refs) => { const r = Object.assign(P.newRecord(), { accession: id, title, year, sourceTitle: 'Economic Botany', timesCited: 3, docTypeRaw: 'Article' }); r.authors = [P.person(who)]; r.references = refs.map(P.newRef); return P.finish(r); };
    await load([
      rec('W101', 'Chayote landraces of Veracruz', 'Lira, R.', 2001, ['W900']),
      rec('W102', 'Wild relatives of chayote', 'Cruz, A.', 2005, ['W101', 'W900']),
      rec('W103', 'Seed dispersal of chayote', 'Soto, B.', 2010, ['W101', 'W102', 'W900']),
      rec('W104', 'Markets of chayote fruit', 'Diaz, C.', 2012, ['W101', 'W102', 'W900']),
    ]);
    await tab('cocitation');
    ok(el('ccIds'), 'note about identifiers');
    const data = IntellectualModule.co.current.data;
    const spec = IntellectualModule.cocitationSpec(Pipeline.references());
    deepEq(data.nodes.map((n, i) => spec.label(data, i)).sort(), ['Cruz A., 2005, Economic Botany', 'Lira R., 2001, Economic Botany', 'W900']);
    await tab('historiograph');
    deepEq(['documents', 'links'].map(k => value('hgStats', k)), ['2', '1'], 'W101 and W102 are cited inside the collection');
    reset();
    await Pipeline.pending;
  });
});
