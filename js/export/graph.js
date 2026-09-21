/* SciMetricsPro — network files. A network travels as
   { title, nodes: [{ label, community, communityName, value, x, y, color: '#rrggbb', metrics: { key: number } }],
     edges: [{ source, target, count, weight }] (node indices), metrics: [{ key, label }], weightLabel }
   · GraphML 1.0 (graphml.graphdrawing.org): keys for label, community, size, x, y, r, g, b and the metrics; undirected edges
     with weight and count. Brandes U, Eiglsperger M, Herman I, Himsolt M, Marshall MS (2002) GraphML progress report, in
     Graph Drawing 2001, LNCS 2265:501–512.
   · GEXF 1.2 (gexf.net) with node attributes and the viz module (colour, position, size).
   · NET: the plain text list of *Vertices (number, "label", x, y in 0–1) and *Edges (source, target, weight) read by most
     network programs.
   · Nodes and edges as CSV (UTF-8 with BOM). */
'use strict';

const GraphExport = {
  xml(s) {
    let clean = '';
    for (const ch of String(s == null ? '' : s)) { const c = ch.charCodeAt(0); if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 0xFFFE && c !== 0xFFFF)) clean += ch; }
    return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  num(v) { return v == null || !isFinite(v) ? '' : String(Math.round(v * 1e8) / 1e8); },
  rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return [128, 128, 128];
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  },

  graphml(net) {
    const X = GraphExport.xml, N = GraphExport.num;
    const metrics = net.metrics || [];
    const out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">',
      '  <key id="label" for="node" attr.name="label" attr.type="string"/>',
      '  <key id="community" for="node" attr.name="community" attr.type="int"/>',
      '  <key id="communityName" for="node" attr.name="community_name" attr.type="string"/>',
      '  <key id="size" for="node" attr.name="size" attr.type="double"/>',
      '  <key id="x" for="node" attr.name="x" attr.type="double"/>',
      '  <key id="y" for="node" attr.name="y" attr.type="double"/>',
      '  <key id="r" for="node" attr.name="r" attr.type="int"/>',
      '  <key id="g" for="node" attr.name="g" attr.type="int"/>',
      '  <key id="b" for="node" attr.name="b" attr.type="int"/>'];
    metrics.forEach((m, i) => out.push(`  <key id="m${i}" for="node" attr.name="${X(m.key)}" attr.type="double"><desc>${X(m.label)}</desc></key>`));
    out.push('  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>', '  <key id="count" for="edge" attr.name="count" attr.type="int"/>');
    out.push(`  <graph id="${X(net.id || 'network')}" edgedefault="undirected">`);
    net.nodes.forEach((nd, i) => {
      const [r, g, b] = GraphExport.rgb(nd.color);
      out.push(`    <node id="n${i}"><data key="label">${X(nd.label)}</data><data key="community">${nd.community + 1}</data><data key="communityName">${X(nd.communityName)}</data>`
        + `<data key="size">${N(nd.value)}</data><data key="x">${N(nd.x)}</data><data key="y">${N(nd.y)}</data><data key="r">${r}</data><data key="g">${g}</data><data key="b">${b}</data>`
        + metrics.map((m, j) => (nd.metrics && nd.metrics[m.key] != null ? `<data key="m${j}">${N(nd.metrics[m.key])}</data>` : '')).join('') + '</node>');
    });
    net.edges.forEach((e, i) => out.push(`    <edge id="e${i}" source="n${e.source}" target="n${e.target}"><data key="weight">${N(e.weight)}</data><data key="count">${e.count}</data></edge>`));
    out.push('  </graph>', '</graphml>', '');
    return out.join('\n');
  },

  gexf(net) {
    const X = GraphExport.xml, N = GraphExport.num;
    const metrics = net.metrics || [];
    const date = new Date().toISOString().slice(0, 10);
    const out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<gexf xmlns="http://www.gexf.net/1.2draft" xmlns:viz="http://www.gexf.net/1.2draft/viz" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.gexf.net/1.2draft http://www.gexf.net/1.2draft/gexf.xsd" version="1.2">',
      `  <meta lastmodifieddate="${date}"><creator>SciMetricsPro</creator><description>${X(net.title || '')}</description></meta>`,
      '  <graph mode="static" defaultedgetype="undirected">',
      '    <attributes class="node">',
      '      <attribute id="community" title="community" type="integer"/>',
      '      <attribute id="community_name" title="community_name" type="string"/>'];
    metrics.forEach(m => out.push(`      <attribute id="${X(m.key)}" title="${X(m.label)}" type="double"/>`));
    out.push('    </attributes>', '    <attributes class="edge">', '      <attribute id="count" title="count" type="integer"/>', '    </attributes>', '    <nodes>');
    net.nodes.forEach((nd, i) => {
      const [r, g, b] = GraphExport.rgb(nd.color);
      out.push(`      <node id="${i}" label="${X(nd.label)}"><attvalues><attvalue for="community" value="${nd.community + 1}"/><attvalue for="community_name" value="${X(nd.communityName)}"/>`
        + metrics.map(m => (nd.metrics && nd.metrics[m.key] != null ? `<attvalue for="${X(m.key)}" value="${N(nd.metrics[m.key])}"/>` : '')).join('')
        + `</attvalues><viz:size value="${N(nd.size != null ? nd.size : nd.value)}"/><viz:position x="${N(nd.x)}" y="${N(nd.y)}" z="0"/><viz:color r="${r}" g="${g}" b="${b}"/></node>`);
    });
    out.push('    </nodes>', '    <edges>');
    net.edges.forEach((e, i) => out.push(`      <edge id="${i}" source="${e.source}" target="${e.target}" weight="${N(e.weight)}"><attvalues><attvalue for="count" value="${e.count}"/></attvalues></edge>`));
    out.push('    </edges>', '  </graph>', '</gexf>', '');
    return out.join('\n');
  },

  /* coordinates scaled to 0–1 keeping the proportions (y grows downwards, as in the drawing) */
  net(net) {
    const N = GraphExport.num;
    const xs = net.nodes.map(n => n.x), ys = net.nodes.map(n => n.y);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
    const out = ['*Vertices ' + net.nodes.length];
    net.nodes.forEach((nd, i) => out.push(`${i + 1} "${String(nd.label).replace(/"/g, "'")}" ${N((nd.x - x0) / span)} ${N((nd.y - y0) / span)}`));
    out.push('*Edges');
    net.edges.forEach(e => out.push(`${e.source + 1} ${e.target + 1} ${N(e.weight)}`));
    return out.join('\r\n') + '\r\n';
  },

  nodeTable(net, labels) {
    const metrics = net.metrics || [];
    return {
      columns: [{ key: 'id', label: 'id' }, { key: 'label', label: labels.label }, { key: 'community', label: labels.community }, { key: 'communityName', label: labels.communityName },
        { key: 'x', label: 'x' }, { key: 'y', label: 'y' }].concat(metrics.map(m => ({ key: m.key, label: m.label }))),
      rows: net.nodes.map((nd, i) => Object.assign({ id: i + 1, label: nd.label, community: nd.community + 1, communityName: nd.communityName, x: nd.x, y: nd.y }, nd.metrics || {})),
    };
  },
  edgeTable(net, labels) {
    return {
      columns: [{ key: 'source', label: labels.source }, { key: 'target', label: labels.target }, { key: 'sourceLabel', label: labels.sourceLabel }, { key: 'targetLabel', label: labels.targetLabel }, { key: 'count', label: labels.count }, { key: 'weight', label: labels.weight }],
      rows: net.edges.map(e => ({ source: e.source + 1, target: e.target + 1, sourceLabel: net.nodes[e.source].label, targetLabel: net.nodes[e.target].label, count: e.count, weight: e.weight })),
    };
  },

  /* every file of a network: [{ ext, name suffix, data (string), type }] for the formats asked */
  files(net, formats, labels) {
    const out = [];
    if (formats.includes('graphml')) out.push({ suffix: '', ext: 'graphml', data: GraphExport.graphml(net), type: 'application/xml' });
    if (formats.includes('gexf')) out.push({ suffix: '', ext: 'gexf', data: GraphExport.gexf(net), type: 'application/xml' });
    if (formats.includes('net')) out.push({ suffix: '', ext: 'net', data: GraphExport.net(net), type: 'text/plain' });
    if (formats.includes('csv')) {
      const nt = GraphExport.nodeTable(net, labels), et = GraphExport.edgeTable(net, labels);
      out.push({ suffix: '_' + labels.nodesFile, ext: 'csv', data: Exporter.csvText(nt.columns, nt.rows), type: 'text/csv' });
      out.push({ suffix: '_' + labels.edgesFile, ext: 'csv', data: Exporter.csvText(et.columns, et.rows), type: 'text/csv' });
    }
    return out;
  },
};

window.GraphExport = GraphExport;
