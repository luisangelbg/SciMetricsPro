/* SciMetricsPro — MetricCard: one indicator with its value and optional help.
   MetricCard.create({ label, value, sub, icon, tone: 'primary'|'accent'|'teal'|'rose'|'neutral', help })
     → element with .update({ value, sub })
   MetricCard.grid(host, [spec, ...]) → the grid element */
'use strict';

const MetricCard = {
  create(spec) {
    const card = mk('div', { class: 'metric-card tone-' + (spec.tone || 'primary') });
    const top = mk('div', { class: 'metric-top' });
    if (spec.icon) top.appendChild(mk('span', { class: 'metric-icon' }, icon(spec.icon)));
    top.appendChild(mk('span', { class: 'metric-label' }, esc(spec.label || '')));
    if (spec.help) top.appendChild(HelpPopover.button(spec.help, { label: t('metric.help') + ': ' + (spec.label || '') }));
    card.appendChild(top);
    const value = mk('div', { class: 'metric-value' });
    const sub = mk('div', { class: 'metric-sub' });
    card.appendChild(value);
    card.appendChild(sub);
    card.update = ({ value: v, sub: s } = {}) => {
      if (v !== undefined) value.textContent = (v === null || v === '') ? '—' : (typeof v === 'number' ? fmtNum(v) : String(v));
      if (s !== undefined) { sub.textContent = s || ''; sub.hidden = !s; }
    };
    card.update({ value: spec.value, sub: spec.sub || '' });
    return card;
  },

  grid(host, specs) {
    host = hostOf(host);
    const g = mk('div', { class: 'metric-grid' });
    specs.forEach(s => g.appendChild(MetricCard.create(s)));
    if (host) host.appendChild(g);
    return g;
  },
};

window.MetricCard = MetricCard;
