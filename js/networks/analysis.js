/* SciMetricsPro — networks: the heavy part of a network analysis, in one call (what a worker runs).
   Communities and the circular layout are cheap and are computed afterwards in the page, so changing the
   algorithm or the resolution does not move the nodes. Pure functions (no window, no DOM). */
'use strict';

function smpNetAnalysis(P) {
  /* input: { items: [{ key, freq }], docs: [[item indices]] } (P.incidence), or a network already built
            { nodes, edges } (P.buildNetwork, P.couplingNetwork)
     opts: { normalization, minEdge, removeIsolated, seed, iterations }
     → { nodes: [{ item, key, freq }], edges: [[s, t, count, weight]], metrics: { degree, strength, betweenness,
         betweennessNorm, closeness, pagerank, stats }, positions: Float64Array } */
  P.networkAnalysis = function (input, opts, progress) {
    opts = opts || {};
    const report = progress || (() => {});
    const net = input.nodes && input.edges ? input : P.buildNetwork(input, opts);
    const g = P.graph(net.nodes.length, net.edges);
    report(0.05, 'metrics');
    const metrics = P.networkMetrics(g, f => report(0.05 + 0.3 * f, 'metrics'));
    report(0.35, 'layout');
    /* the pieces of a network that is not connected are drawn next to each other, not far apart */
    const positions = P.packComponents(g, P.forceAtlas2(g, { seed: opts.seed, iterations: opts.iterations }, f => report(0.35 + 0.65 * f, 'layout')));
    report(1, 'layout');
    return { nodes: net.nodes, edges: net.edges, metrics, positions };
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpNetAnalysis);
