/* SciMetricsPro — module registry.
   The sidebar, the home page and the router are all built from this list, so a
   module is added in one place. Each later step fills a module with
   Modules.define(id, { render(body, ctx) }); until then the module shows its
   header and the "Import data first" panel. */
'use strict';

const Modules = {
  groups: ['data', 'descriptive', 'structures', 'review', 'results'],

  list: [
    { id: 'import', group: 'data', icon: 'upload', needsData: false },
    { id: 'cleaning', group: 'data', icon: 'filter', needsData: true },
    { id: 'overview', group: 'descriptive', icon: 'gauge', needsData: true },
    { id: 'sources', group: 'descriptive', icon: 'journal', needsData: true },
    { id: 'authors', group: 'descriptive', icon: 'people', needsData: true },
    { id: 'documents', group: 'descriptive', icon: 'doc', needsData: true },
    { id: 'conceptual', group: 'structures', icon: 'concept', needsData: true },
    { id: 'intellectual', group: 'structures', icon: 'quote', needsData: true },
    { id: 'social', group: 'structures', icon: 'network', needsData: true },
    { id: 'prisma', group: 'review', icon: 'flow', needsData: true },
    { id: 'export', group: 'results', icon: 'download', needsData: true },
  ],

  impl: {},

  get(id) { return Modules.list.find(m => m.id === id) || null; },
  inGroup(group) { return Modules.list.filter(m => m.group === group); },
  ids() { return Modules.list.map(m => m.id); },
  define(id, impl) { Modules.impl[id] = impl; },

  render(id, host) {
    const m = Modules.get(id);
    if (!m) return;
    host.innerHTML = '';
    const page = mk('article', { class: 'module-page', 'data-module': id });

    const head = mk('header', { class: 'page-head' });
    head.appendChild(mk('div', { class: 'crumb' },
      esc(t('nav.groups.' + m.group)) + icon('chevron') + esc(t('mod.' + id + '.title'))));
    const row = mk('div', { class: 'page-title-row' });
    row.appendChild(mk('h1', { tabindex: '-1' }, esc(t('mod.' + id + '.heading'))));
    if (m.needsData && !hasData()) row.appendChild(mk('span', { class: 'chip warn' }, esc(t('module.noData'))));
    head.appendChild(row);
    head.appendChild(mk('p', { class: 'page-desc' }, esc(t('mod.' + id + '.desc'))));
    page.appendChild(head);

    const body = mk('div', { class: 'module-body' });
    page.appendChild(body);
    host.appendChild(page);

    const impl = Modules.impl[id];
    if (m.needsData && !hasData()) body.appendChild(EmptyState.noData());
    else if (impl && impl.render) impl.render(body, { module: m });
    else body.appendChild(EmptyState.create({ icon: 'sparkle', title: t('module.pendingTitle'), text: t('module.pendingText') }));
  },
};

window.Modules = Modules;
