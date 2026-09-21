/* SciMetricsPro — NetworkScreen: one network tab (side panel of parameters, statistics, interactive view, card of the
   selected node, figure for publication and tables of nodes, communities and edges). Shared by the conceptual,
   intellectual and social structures; the network itself, its metrics and its layout are computed in a worker
   (P.networkAnalysis), communities and the circular layout in the page, so changing them recolours the same drawing.

   NetworkScreen.render(panel, spec)       draws the tab inside panel
   NetworkScreen.detach(store)             before a module redraws: keeps the zoom and frees the canvas
   spec: {
     store        object that keeps the state between renders: params, _net, _comm, _circle, view, viewState,
                  selectedKey, current, pending (it may be the module itself)
     prefix       prefix of the element ids: <prefix>Params, Stats, View, Node, NodeClose, Figure, Nodes, Communities,
                  Edges, Pending, Cancelled, Retry, TooFew
     defaults     starting parameters (NetworkPanel.DEFAULTS by default); buildKeys: parameters computed in the worker
     groups(values) → NetworkPanel groups;  onChange(key, value) → true when the module handled it
     before(main) → false to stop (the module wrote its own notice)
     deps()       values that, when one changes, rebuild the network (compared with ===)
     input(params) → { input: P.incidence | { nodes, edges }, extra (merged into the result: labels, units…) }
     label(data, i), measures: { freq: text, citations?: text }, value(data, i, measure)? , nameValue(data, i)?
     help(key, title, refs) → HelpPopover spec (keys of network.help)
     texts: { item, search, notFound, tooFew(data), viewTitle, viewSub(data), viewHelp, figureTitle, figureSub(data, comm),
              figureFile, figureHelp, neighbours, neighbourCount(n), documents(n), freqSum, count, source, target, nodesHint }
     documents(data, i) → record indices shown in the node card;  details(box, data, i) adds content to the card
     chart(host, id, o, keep), tableCard(panel, id, title, helpKey, refs, dtOpts, hint), rerender()
   } */
'use strict';

const NetworkScreen = {
  BUILD_KEYS: ['normalization', 'minFreq', 'maxNodes', 'minEdge', 'removeIsolated'],
  VIEW_HEIGHT: 580,

  params(spec) {
    const st = spec.store;
    if (!st.params) st.params = Object.assign({}, spec.defaults || NetworkPanel.DEFAULTS);
    return st.params;
  },

  detach(store) {
    if (store.view) {
      const st = store.view.state;
      store.viewState = { data: store.current && store.current.data, layout: store.current && store.current.layout, k: st.k, tx: st.tx, ty: st.ty };
      store.view.destroy();
      store.view = null;
    }
    store.current = null;
  },

  /* network, metrics and layout for the current data and parameters; null while the worker computes them */
  network(spec) {
    const st = spec.store, s = NetworkScreen.params(spec);
    const deps = spec.deps().concat((spec.buildKeys || NetworkScreen.BUILD_KEYS).map(k => s[k]));
    const c = st._net;
    if (c && c.deps.length === deps.length && c.deps.every((d, i) => d === deps[i])) return c.data;
    const src = spec.input(s);
    const entry = { deps, data: null };
    st._net = entry;
    st._comm = null; st._circle = null;
    const opts = { normalization: s.normalization, minEdge: s.minEdge, removeIsolated: s.removeIsolated, seed: 20140610 };
    entry.pending = ProgressOverlay.run({
      title: t('network.computing'), message: t('network.progress.metrics'), delay: 400, fns: window.PARSER_PARTS, payload: { input: src.input, opts },
      formatMessage: m => (m ? t('network.progress.' + m) : t('network.progress.metrics')),
      main: function (p, progress) { const Q = {}; for (const name in __fns) __fns[name](Q); return Q.networkAnalysis(p.input, p.opts, progress); },
    }).then(res => {
      if (st._net !== entry) return;
      entry.data = res ? Object.assign(res, src.extra || {}) : { cancelled: true };
      spec.rerender();
    }, err => {
      if (st._net !== entry) return;
      entry.data = { error: (err && err.message) || String(err) };
      spec.rerender();
    });
    st.pending = entry.pending;
    return null;
  },

  /* communities with the chosen algorithm and resolution; each named after its node with the largest nameValue */
  communities(spec, data) {
    const st = spec.store, s = NetworkScreen.params(spec), P = Parsers.lib();
    const c = st._comm;
    if (c && c.data === data && c.algorithm === s.algorithm && c.resolution === s.resolution) return c.result;
    if (!data.g) data.g = P.graph(data.nodes.length, data.edges);
    const r = P.communities(data.g, { algorithm: s.algorithm, resolution: s.resolution });
    r.q1 = s.resolution === 1 ? r.modularity : P.modularity(data.g, r.membership, 1);
    const nameValue = spec.nameValue || ((d, i) => d.nodes[i].freq);
    const best = new Array(r.communities).fill(-1), sizes = new Array(r.communities).fill(0);
    data.nodes.forEach((nd, i) => {
      const k = r.membership[i];
      sizes[k]++;
      if (best[k] < 0 || nameValue(data, i) > nameValue(data, best[k])) best[k] = i;
    });
    r.sizes = sizes;
    r.names = best.map(i => spec.label(data, i));
    st._comm = { data, algorithm: s.algorithm, resolution: s.resolution, result: r };
    return r;
  },

  positions(spec, data, comm) {
    const st = spec.store;
    if (NetworkScreen.params(spec).layout !== 'circular') return data.positions;
    const c = st._circle;
    if (c && c.comm === comm) return c.pos;
    const order = data.nodes.map((nd, i) => i).sort((a, b) => comm.membership[a] - comm.membership[b] || data.nodes[b].freq - data.nodes[a].freq || a - b);
    const pos = Parsers.lib().circularLayout(data.nodes.length, order);
    st._circle = { comm, pos };
    return pos;
  },

  value(spec, data, i, measure) {
    if (spec.value) { const v = spec.value(data, i, measure); if (v !== undefined) return v; }
    const m = data.metrics;
    switch (measure) {
      case 'degree': return m.degree[i];
      case 'strength': return m.strength[i];
      case 'betweenness': return m.betweennessNorm[i];
      case 'pagerank': return m.pagerank[i];
      default: return data.nodes[i].freq;
    }
  },

  note(host, id, text, warn, iconName) {
    const p = mk('p', { class: warn ? 'note-warn' : 'note-info', id }, icon(iconName || (warn ? 'help' : 'concept')) + '<span>' + esc(text) + '</span>');
    host.appendChild(p);
    return p;
  },

  onChange(spec, key, value) {
    if (spec.onChange && spec.onChange(key, value)) return;
    NetworkScreen.params(spec)[key] = value;
    spec.rerender();
  },

  render(panel, spec) {
    const s = NetworkScreen.params(spec), x = spec.prefix;
    const layout = mk('div', { class: 'net-layout' });
    panel.appendChild(layout);
    layout.appendChild(NetworkPanel.create({ id: x + 'Params', values: Object.assign({}, spec.values ? spec.values() : {}, s), groups: spec.groups(), onChange: (k, v) => NetworkScreen.onChange(spec, k, v) }));
    const main = mk('div', { class: 'net-main' });
    layout.appendChild(main);
    if (spec.before && spec.before(main) === false) return;
    const data = NetworkScreen.network(spec);
    if (!data) { NetworkScreen.note(main, x + 'Pending', t('network.pending'), false, 'clock'); return; }
    if (data.cancelled || data.error) {
      const p = NetworkScreen.note(main, x + 'Cancelled', data.error ? t('network.failed', { msg: data.error }) : t('network.cancelled'), true);
      const retry = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: x + 'Retry' }, esc(t('documents.retry')));
      retry.addEventListener('click', () => { spec.store._net = null; spec.rerender(); });
      p.appendChild(retry);
      return;
    }
    if (data.nodes.length < 2 || !data.edges.length) { NetworkScreen.note(main, x + 'TooFew', spec.texts.tooFew(data), true); return; }
    const comm = NetworkScreen.communities(spec, data);
    const pos = NetworkScreen.positions(spec, data, comm);
    spec.store.current = { data, comm, pos, layout: s.layout };
    main.appendChild(NetworkScreen.stats(spec, data, comm));
    NetworkScreen.renderView(spec, main, data, comm, pos);
    NetworkScreen.renderBelow(spec, panel, data, comm, pos);
  },

  stats(spec, data, comm) {
    const s = NetworkScreen.params(spec), st = data.metrics.stats, c = 'network.stats.';
    const card = (key, value, sub, iconName, tone, refs) => ({ key, label: t(c + key), value, sub, icon: iconName, tone, help: spec.help(key, t(c + key), refs) });
    const list = [
      card('nodes', fmtInt(st.nodes), tp(c + 'edgesSub', st.edges), 'concept', 'primary', spec.nodesRefs || ['callon1991']),
      card('communities', fmtInt(comm.communities), t('network.algorithms.' + s.algorithm), 'people', 'teal', s.algorithm === 'fastgreedy' ? ['clauset2004'] : ['blondel2008']),
      card('modularity', fmtNum(comm.q1, 3), s.resolution === 1 ? t(c + 'modularitySub') : t(c + 'modularityGamma', { gamma: fmtNum(s.resolution, 1), q: fmtNum(comm.modularity, 3) }), 'sparkle', 'accent', ['newman2004', 'reichardt2006']),
      card('density', fmtNum(st.density, 3), tp(c + 'densitySub', st.edges), 'network', 'rose', ['wasserman1994']),
      card('transitivity', fmtNum(st.transitivity, 3), tp(c + 'trianglesSub', st.triangles), 'sigma', 'primary', ['newman2003']),
      card('diameter', fmtInt(st.diameter), tp(c + 'componentsSub', st.components), 'trend', 'teal', ['wasserman1994']),
    ];
    const grid = MetricCard.grid(null, list);
    grid.id = spec.prefix + 'Stats';
    grid.classList.add('net-stats');
    [...grid.children].forEach((el2, i) => { el2.dataset.key = list[i].key; });
    return grid;
  },

  palette(spec) { const f = spec.figs && spec.figs[spec.prefix + 'Figure']; return (f && f.palette) || 'scimetrics'; },

  renderView(spec, main, data, comm, pos) {
    const s = NetworkScreen.params(spec), st = spec.store, x = spec.prefix, T = spec.texts;
    const palette = NetworkScreen.palette(spec);
    let maxW = 0;
    for (const e of data.edges) if (e[3] > maxW) maxW = e[3];
    const card = mk('section', { class: 'card net-card', id: x + 'ViewCard' });
    const head = mk('header', { class: 'chart-head' });
    const titles = mk('div', { class: 'chart-titles' });
    const h = mk('h3', { class: 'chart-title' }, esc(T.viewTitle));
    h.appendChild(HelpPopover.button(T.viewHelp, { label: t('chart.help') + ': ' + T.viewTitle }));
    titles.appendChild(h);
    titles.appendChild(mk('p', { class: 'chart-sub' }, esc(T.viewSub(data))));
    head.appendChild(titles);
    card.appendChild(head);
    const host = mk('div', { id: x + 'View' });
    card.appendChild(host);
    main.appendChild(card);
    const nodePanel = mk('section', { class: 'card net-node', id: x + 'Node', hidden: true, 'aria-live': 'polite' });
    main.appendChild(nodePanel);
    const view = NetworkView.create({
      nodes: data.nodes.map((nd, i) => ({ label: spec.label(data, i), value: NetworkScreen.value(spec, data, i, s.sizeBy), color: Fig.color(palette, comm.membership[i]) })),
      edges: data.edges.map(e => [e[0], e[1], maxW > 0 ? e[3] / maxW : 1]),
      positions: pos, labelCount: s.labelCount, height: NetworkScreen.VIEW_HEIGHT, searchLabel: T.search, notFound: T.notFound,
      onSelect: i => NetworkScreen.showNode(spec, i),
    });
    host.appendChild(view.el);
    view.resize();
    st.view = view;
    const vs = st.viewState;
    if (vs && vs.data === data && vs.layout === s.layout) { view.state.k = vs.k; view.state.tx = vs.tx; view.state.ty = vs.ty; }
    if (st.selectedKey != null) {
      const i = data.nodes.findIndex(nd => nd.key === st.selectedKey);
      if (i >= 0) view.select(i); else st.selectedKey = null;
    }
  },

  /* the card of the selected node: its metrics, strongest neighbours and documents */
  showNode(spec, i) {
    const x = spec.prefix, st = spec.store, T = spec.texts;
    const host = el(x + 'Node'), cur = st.current;
    if (!host || !cur) return;
    host.innerHTML = '';
    if (i < 0) { st.selectedKey = null; host.hidden = true; return; }
    const { data, comm } = cur, m = data.metrics, nd = data.nodes[i];
    st.selectedKey = nd.key;
    host.hidden = false;
    const head = mk('header', { class: 'net-node-head' });
    head.appendChild(mk('span', { class: 'net-swatch', style: 'background:' + Fig.color(NetworkScreen.palette(spec), comm.membership[i]) }));
    head.appendChild(mk('h3', null, esc(spec.label(data, i))));
    const close = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: x + 'NodeClose' }, esc(t('network.node.close')));
    close.addEventListener('click', () => { if (st.view) st.view.select(-1); });
    head.appendChild(close);
    host.appendChild(head);
    if (spec.details) spec.details(host, data, i);
    const dl = mk('dl', { class: 'net-node-metrics' });
    const row = (label, value) => { dl.appendChild(mk('dt', null, esc(label))); dl.appendChild(mk('dd', null, esc(value))); };
    row(t('network.col.community'), comm.names[comm.membership[i]]);
    row(spec.measures.freq, fmtInt(nd.freq));
    if (spec.measures.citations && nd.citations != null) row(spec.measures.citations, fmtInt(nd.citations));
    row(t('network.measures.degree'), fmtInt(m.degree[i]));
    row(t('network.measures.strength'), fmtNum(m.strength[i], 4));
    row(t('network.measures.betweenness'), fmtNum(m.betweennessNorm[i], 4));
    row(t('network.measures.closeness'), fmtNum(m.closeness[i], 4));
    row(t('network.measures.pagerank'), fmtNum(m.pagerank[i], 4));
    host.appendChild(dl);
    const cols = mk('div', { class: 'net-node-cols' });
    const neighbours = data.edges.filter(e => e[0] === i || e[1] === i).map(e => ({ j: e[0] === i ? e[1] : e[0], count: e[2] }))
      .sort((a, b) => b.count - a.count || data.nodes[b.j].freq - data.nodes[a.j].freq).slice(0, 8);
    const nbBox = mk('div');
    nbBox.appendChild(mk('h4', null, esc(T.neighbours)));
    const nl = mk('ul', { class: 'net-node-list' });
    neighbours.forEach(nb => {
      const li = mk('li');
      const b = mk('button', { type: 'button', class: 'linklike' }, esc(spec.label(data, nb.j)));
      b.addEventListener('click', () => st.view.select(nb.j, true));
      li.appendChild(b);
      li.appendChild(mk('span', { class: 'muted' }, ' ' + esc(T.neighbourCount(nb.count))));
      nl.appendChild(li);
    });
    nbBox.appendChild(nl);
    cols.appendChild(nbBox);
    if (spec.documents) {
      /* documents of the node, most cited first */
      const records = Pipeline.records();
      const docs = spec.documents(data, i).map(r => records[r]);
      docs.sort((a, b) => (b.timesCited || 0) - (a.timesCited || 0) || (b.year || 0) - (a.year || 0));
      const dBox = mk('div');
      dBox.appendChild(mk('h4', null, esc(T.documents(docs.length))));
      const dlist = mk('ol', { class: 'net-node-list net-node-docs' });
      docs.slice(0, 8).forEach(r => {
        const li = mk('li');
        li.appendChild(mk('span', { class: 'net-doc-title' }, esc(r.title)));
        li.appendChild(mk('span', { class: 'muted' }, ' ' + esc([r.year, r.timesCited != null ? tp('network.node.citations', r.timesCited) : ''].filter(v => v !== '' && v != null).join(' · '))));
        dlist.appendChild(li);
      });
      dBox.appendChild(dlist);
      cols.appendChild(dBox);
    }
    host.appendChild(cols);
  },

  nodeRows(spec, data, comm) {
    const m = data.metrics;
    return data.nodes.map((nd, i) => Object.assign({
      label: spec.label(data, i), community: comm.membership[i] + 1, communityName: comm.names[comm.membership[i]], freq: nd.freq,
    }, spec.measures.citations ? { citations: nd.citations } : {}, {
      degree: m.degree[i], strength: m.strength[i], betweenness: m.betweennessNorm[i], closeness: m.closeness[i], pagerank: m.pagerank[i],
    }));
  },

  nodeColumns(spec, screen) {
    const num = d => (screen ? { type: 'num', fmt: v => fmtNum(v, d) } : {});
    const int = screen ? { type: 'int' } : {};
    return [
      { key: 'label', label: spec.texts.item, cls: screen ? 'col-nowrap' : undefined },
      Object.assign({ key: 'community', label: t('network.col.communityNumber') }, int),
      { key: 'communityName', label: t('network.col.community') },
      Object.assign({ key: 'freq', label: spec.measures.freq }, int),
    ].concat(spec.measures.citations ? [Object.assign({ key: 'citations', label: spec.measures.citations }, int)] : []).concat([
      Object.assign({ key: 'degree', label: t('network.measures.degree') }, int),
      Object.assign({ key: 'strength', label: t('network.measures.strength') }, num(4)),
      Object.assign({ key: 'betweenness', label: t('network.measures.betweenness') }, num(4)),
      Object.assign({ key: 'closeness', label: t('network.measures.closeness') }, num(4)),
      Object.assign({ key: 'pagerank', label: t('network.measures.pagerank') }, num(4)),
    ]);
  },

  /* the network as it is drawn (labels, communities, colours, positions and metrics) for GraphExport */
  graphData(spec, data, comm, pos) {
    const s = NetworkScreen.params(spec), palette = NetworkScreen.palette(spec), m = data.metrics;
    const T = spec.texts;
    const metrics = [
      { key: 'freq', label: spec.measures.freq }, { key: 'degree', label: t('network.measures.degree') }, { key: 'strength', label: t('network.measures.strength') },
      { key: 'betweenness', label: t('network.measures.betweenness') }, { key: 'closeness', label: t('network.measures.closeness') }, { key: 'pagerank', label: t('network.measures.pagerank') },
    ].concat(spec.measures.citations ? [{ key: 'citations', label: spec.measures.citations }] : []);
    return {
      id: spec.prefix, title: T.figureTitle, metrics,
      nodes: data.nodes.map((nd, i) => ({
        label: spec.label(data, i), community: comm.membership[i], communityName: comm.names[comm.membership[i]],
        value: NetworkScreen.value(spec, data, i, s.sizeBy), x: pos[2 * i], y: pos[2 * i + 1], color: Fig.color(palette, comm.membership[i]),
        metrics: Object.assign({ freq: nd.freq, degree: m.degree[i], strength: m.strength[i], betweenness: m.betweennessNorm[i], closeness: m.closeness[i], pagerank: m.pagerank[i] }, nd.citations != null ? { citations: nd.citations } : {}),
      })),
      edges: data.edges.map(e => ({ source: e[0], target: e[1], count: e[2], weight: e[3] })),
    };
  },
  graphLabels(spec) {
    const T = spec.texts;
    return {
      label: T.item, community: t('network.col.communityNumber'), communityName: t('network.col.community'), source: T.source, target: T.target,
      sourceLabel: T.source, targetLabel: T.target, count: T.count, weight: t('network.export.weight'),
      nodesFile: slug(t('network.export.nodesFile')), edgesFile: slug(t('network.export.edgesFile')),
    };
  },

  /* buttons to save the network for other network programs */
  exportCard(spec, panel, data, comm, pos) {
    const x = spec.prefix, T = spec.texts;
    const card = mk('section', { class: 'card src-card net-export', id: x + 'Export' });
    const h = mk('h2', null, esc(t('network.export.title')));
    h.appendChild(HelpPopover.button({ title: t('network.export.title'), text: t('network.export.help'), formula: t('network.export.formula'), where: [], interpretation: t('network.export.interpretation'), refs: [t('refs.brandes2002')] }, { label: t('metric.help') + ': ' + t('network.export.title') }));
    card.appendChild(h);
    const row = mk('div', { class: 'net-export-row' });
    const file = slug(T.figureFile);
    const save = formats => {
      const net = NetworkScreen.graphData(spec, data, comm, pos);
      for (const f of GraphExport.files(net, formats, NetworkScreen.graphLabels(spec))) download(new Blob([f.data], { type: f.type + ';charset=utf-8' }), file + f.suffix + '.' + f.ext);
    };
    [['graphml', 'GraphML (.graphml)'], ['gexf', 'GEXF (.gexf)'], ['net', t('network.export.net')], ['csv', t('network.export.csv')]].forEach(([format, label]) => {
      const b = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: x + 'Export-' + format }, icon('download') + '<span>' + esc(label) + '</span>');
      b.addEventListener('click', () => save([format]));
      row.appendChild(b);
    });
    card.appendChild(row);
    panel.appendChild(card);
    if (window.ExportCollector && ExportCollector.active) ExportCollector.addNetwork({ title: T.figureTitle, file, net: () => NetworkScreen.graphData(spec, data, comm, pos), labels: NetworkScreen.graphLabels(spec) });
  },

  renderBelow(spec, panel, data, comm, pos) {
    const s = NetworkScreen.params(spec), x = spec.prefix, T = spec.texts;
    const nodes = data.nodes.map((nd, i) => ({ label: spec.label(data, i), value: NetworkScreen.value(spec, data, i, s.sizeBy), community: comm.membership[i] }));
    let maxW = 0;
    for (const e of data.edges) if (e[3] > maxW) maxW = e[3];
    const edges = data.edges.map(e => [e[0], e[1], maxW > 0 ? e[3] / maxW : 1]);
    spec.chart(panel, x + 'Figure', {
      title: T.figureTitle, subtitle: T.figureSub(data, comm), help: T.figureHelp,
      width: 1000, height: 760, fileName: slug(T.figureFile),
      data: () => ({ columns: NetworkScreen.nodeColumns(spec, false), rows: NetworkScreen.nodeRows(spec, data, comm) }),
      controls: Charts.networkControls(),
      defaults: { title: T.figureTitle, subtitle: '', palette: 'scimetrics', labelCount: Math.min(30, s.labelCount || 30), maxLabel: 40, minRadius: 3, maxRadius: 18, edgeOpacity: 0.35, edgeWidth: 1.8, showLegend: true, legendMax: 10 },
      render: cfg => Charts.network(cfg, { nodes, edges, positions: pos, communities: comm.names, legendTitle: t('network.col.community') }),
    }, ['palette', 'labelCount', 'maxLabel', 'minRadius', 'maxRadius', 'edgeOpacity', 'edgeWidth', 'showLegend', 'legendMax', 'width', 'height']);
    NetworkScreen.exportCard(spec, panel, data, comm, pos);
    spec.tableCard(panel, x + 'Nodes', t('network.tables.nodes'), 'nodesTable', ['freeman1979', 'brandes2001', 'brin1998'], {
      columns: NetworkScreen.nodeColumns(spec, true), rows: NetworkScreen.nodeRows(spec, data, comm), sort: { key: 'freq', dir: 'desc' }, fileName: slug(T.figureFile + ' ' + t('network.tables.nodes')),
    }, T.nodesHint || t('network.tables.nodesHint'));
    const members = comm.names.map(() => []);
    data.nodes.forEach((nd, i) => members[comm.membership[i]].push(i));
    spec.tableCard(panel, x + 'Communities', t('network.tables.communities'), 'communitiesTable', s.algorithm === 'fastgreedy' ? ['clauset2004'] : ['blondel2008'], {
      columns: [
        { key: 'id', label: t('network.col.communityNumber'), type: 'int' },
        { key: 'name', label: t('network.col.community'), cls: 'col-nowrap' },
        { key: 'size', label: t('network.col.nodes'), type: 'int' },
        { key: 'docs', label: T.freqSum, type: 'int' },
        { key: 'terms', label: T.members, cls: 'col-wide', clamp: true },
      ],
      rows: members.map((list, k) => ({
        id: k + 1, name: comm.names[k], size: list.length, docs: list.reduce((acc, i) => acc + data.nodes[i].freq, 0),
        terms: list.slice().sort((a, b) => data.nodes[b].freq - data.nodes[a].freq).map(i => spec.label(data, i)).join('; '),
      })),
      sort: { key: 'id', dir: 'asc' }, fileName: slug(T.figureFile + ' ' + t('network.tables.communities')),
    });
    spec.tableCard(panel, x + 'Edges', t('network.tables.edges'), 'edgesTable', spec.edgesRefs || ['vaneck2009'], {
      columns: [
        { key: 'source', label: T.source, cls: 'col-nowrap' },
        { key: 'target', label: T.target, cls: 'col-nowrap' },
        { key: 'count', label: T.count, type: 'int' },
        { key: 'weight', label: t('network.col.weight', { normalization: t('network.normalizationsInline.' + s.normalization) }), type: 'num', fmt: v => fmtNum(v, 5) },
      ],
      rows: data.edges.map(e => ({ source: spec.label(data, e[0]), target: spec.label(data, e[1]), count: e[2], weight: e[3] })),
      sort: { key: 'count', dir: 'desc' }, fileName: slug(T.figureFile + ' ' + t('network.tables.edges')),
    });
  },
};

window.NetworkScreen = NetworkScreen;
