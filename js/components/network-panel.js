/* SciMetricsPro — NetworkPanel: the side panel of parameters shared by every network screen.

   NetworkPanel.DEFAULTS                      the usual starting values
   NetworkPanel.create({ id, values, groups, title, onChange(key, value) }) → element (title: the heading, «Network parameters» by default)
     groups: [{ key, title, help (HelpPopover spec) | null, controls: [{ key, type: 'select'|'number'|'range'|'checkbox',
               label, options: [[value, text]], min, max, step, format(value) }] }]
   NetworkPanel.commonGroups(opts) → the standard groups (selection, weights, communities, display); opts.before and
     opts.help ({ selection, weights, communities, display }) add module controls and help; opts.minFreqLabel,
     opts.maxNodesLabel and opts.minEdgeLabel (dictionary keys), opts.sizeBy ([[value, text]]) and opts.omit ([keys]) adapt it. */
'use strict';

const NetworkPanel = {
  DEFAULTS: { normalization: 'association', minFreq: 2, maxNodes: 50, minEdge: 1, removeIsolated: true, algorithm: 'louvain', resolution: 1, layout: 'fa2', sizeBy: 'freq', labelCount: 20 },
  SIZE_BY: ['freq', 'degree', 'strength', 'betweenness', 'pagerank'],

  commonGroups(o) {
    o = o || {};
    const p = 'network.params.';
    const help = o.help || {};
    return [
      { key: 'selection', title: t(p + 'selection'), help: help.selection || null, controls: (o.before || []).concat([
        { key: 'minFreq', type: 'number', label: t(o.minFreqLabel || p + 'minFreq'), min: 1, max: 1000, step: 1 },
        { key: 'maxNodes', type: 'number', label: t(o.maxNodesLabel || p + 'maxNodes'), min: 2, max: 500, step: 1 },
        { key: 'minEdge', type: 'number', label: t(o.minEdgeLabel || p + 'minEdge'), min: 1, max: 1000, step: 1 },
        { key: 'removeIsolated', type: 'checkbox', label: t(p + 'removeIsolated') },
      ]) },
      { key: 'weights', title: t(p + 'weights'), help: help.weights || null, controls: [
        { key: 'normalization', type: 'select', label: t(p + 'normalization'), options: Parsers.lib().NORMALIZATIONS.map(m => [m, t('network.normalizations.' + m)]) },
      ] },
      { key: 'communities', title: t(p + 'communities'), help: help.communities || null, controls: [
        { key: 'algorithm', type: 'select', label: t(p + 'algorithm'), options: [['louvain', t('network.algorithms.louvain')], ['fastgreedy', t('network.algorithms.fastgreedy')]] },
        { key: 'resolution', type: 'range', label: t(p + 'resolution'), min: 0.1, max: 3, step: 0.1, format: v => fmtNum(+v, 1) },
      ] },
      { key: 'display', title: t(p + 'display'), help: help.display || null, controls: [
        { key: 'layout', type: 'select', label: t(p + 'layout'), options: [['fa2', t('network.layouts.fa2')], ['circular', t('network.layouts.circular')]] },
        { key: 'sizeBy', type: 'select', label: t(p + 'sizeBy'), options: o.sizeBy || NetworkPanel.SIZE_BY.map(m => [m, t('network.measures.' + m)]) },
        { key: 'labelCount', type: 'number', label: t(p + 'labelCount'), min: 0, max: 500, step: 1 },
      ] },
    ].map(gr => Object.assign(gr, { controls: gr.controls.filter(c => !(o.omit || []).includes(c.key)) }));
  },

  create(o) {
    const title = o.title || t('network.params.title');
    const panel = mk('aside', { class: 'card net-panel', id: o.id || null, 'aria-label': title });
    panel.appendChild(mk('h2', { class: 'net-panel-title' }, esc(title)));
    const idOf = key => (o.id || 'np') + '-' + key;
    for (const gr of o.groups) {
      const fs = mk('fieldset', { class: 'net-group', 'data-group': gr.key });
      const lg = mk('legend', null, esc(gr.title));
      if (gr.help) lg.appendChild(HelpPopover.button(gr.help, { label: t('metric.help') + ': ' + gr.title }));
      fs.appendChild(lg);
      for (const c of gr.controls) {
        const id = idOf(c.key), value = o.values[c.key];
        const row = mk('div', { class: 'net-control net-' + c.type });
        if (c.type === 'checkbox') {
          const lab = mk('label', { for: id });
          const input = mk('input', { type: 'checkbox', id });
          input.checked = !!value;
          input.addEventListener('change', () => o.onChange(c.key, input.checked));
          lab.appendChild(input);
          lab.appendChild(mk('span', null, esc(c.label)));
          row.appendChild(lab);
        } else {
          const lab = mk('label', { for: id, class: 'sf-label' }, esc(c.label));
          row.appendChild(lab);
          let input;
          if (c.type === 'select') {
            input = mk('select', { id });
            c.options.forEach(([v, text]) => { const op = mk('option', { value: v }, esc(text)); if (String(v) === String(value)) op.selected = true; input.appendChild(op); });
            input.addEventListener('change', () => o.onChange(c.key, input.value));
          } else if (c.type === 'range') {
            const wrap = mk('div', { class: 'net-range-box' });
            const range = mk('input', { type: 'range', id, min: c.min, max: c.max, step: c.step, value });
            const out = mk('output', { for: id }, esc(c.format ? c.format(value) : String(value)));
            range.addEventListener('input', () => { out.textContent = c.format ? c.format(range.value) : range.value; });
            range.addEventListener('change', () => o.onChange(c.key, +range.value));
            wrap.appendChild(range); wrap.appendChild(out);
            row.appendChild(wrap);
          } else if (c.type === 'text') {
            input = mk('input', { type: 'text', id, value: value == null ? '' : value, placeholder: c.placeholder || null });
            input.addEventListener('change', () => o.onChange(c.key, input.value.trim()));
          } else if (c.type === 'optnumber') {
            /* a number that may be left empty (null) */
            input = mk('input', { type: 'number', id, min: c.min, max: c.max, step: c.step, value: value == null ? '' : value, placeholder: c.placeholder || null });
            input.addEventListener('change', () => {
              if (String(input.value).trim() === '') { o.onChange(c.key, null); return; }
              let v = Math.round(+input.value);
              if (!isFinite(v)) { input.value = ''; o.onChange(c.key, null); return; }
              v = Math.min(c.max, Math.max(c.min, v));
              input.value = v;
              o.onChange(c.key, v);
            });
          } else {
            input = mk('input', { type: 'number', id, min: c.min, max: c.max, step: c.step, value });
            input.addEventListener('change', () => {
              let v = +input.value;
              if (!isFinite(v)) v = o.values[c.key];
              v = Math.min(c.max, Math.max(c.min, v));
              input.value = v;
              o.onChange(c.key, v);
            });
          }
          if (input) row.appendChild(input);
        }
        fs.appendChild(row);
      }
      panel.appendChild(fs);
    }
    return panel;
  },
};

window.NetworkPanel = NetworkPanel;
