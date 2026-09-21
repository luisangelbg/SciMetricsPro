/* SciMetricsPro — EmptyState: what a module shows when it has nothing to work with.
   EmptyState.create({ icon, title, text, actions: [{ label, onClick, primary, disabled, title }] })
   EmptyState.noData()  → the standard "Import data first" panel */
'use strict';

const EmptyState = {
  create(spec) {
    const box = mk('section', { class: 'empty-state', role: 'status' });
    box.appendChild(mk('div', { class: 'empty-icon' }, icon(spec.icon || 'inbox')));
    box.appendChild(mk('h2', { class: 'empty-title' }, esc(spec.title || '')));
    if (spec.text) box.appendChild(mk('p', { class: 'empty-text' }, esc(spec.text)));
    if (spec.actions && spec.actions.length) {
      const row = mk('div', { class: 'empty-actions' });
      spec.actions.forEach(a => {
        const b = mk('button', {
          type: 'button',
          class: 'btn ' + (a.primary ? 'btn-primary' : 'btn-secondary'),
          disabled: !!a.disabled,
          title: a.title || null,
        }, (a.icon ? icon(a.icon) : '') + '<span>' + esc(a.label) + '</span>');
        if (a.onClick && !a.disabled) b.addEventListener('click', a.onClick);
        row.appendChild(b);
      });
      box.appendChild(row);
      const notes = spec.actions.filter(a => a.disabled && a.title).map(a => a.title);
      if (notes.length) box.appendChild(mk('p', { class: 'empty-note' }, esc(notes.join(' · '))));
    }
    return box;
  },

  noData() {
    return EmptyState.create({
      icon: 'inbox',
      title: t('empty.title'),
      text: t('empty.text'),
      actions: [
        { label: t('empty.import'), icon: 'upload', primary: true, onClick: () => App.go('import') },
        { label: t('empty.example'), icon: 'sparkle', disabled: true, title: t('empty.soon') },
      ],
    });
  },

  mount(host, spec) {
    host = hostOf(host);
    host.innerHTML = '';
    const node = spec ? EmptyState.create(spec) : EmptyState.noData();
    host.appendChild(node);
    return node;
  },
};

window.EmptyState = EmptyState;
