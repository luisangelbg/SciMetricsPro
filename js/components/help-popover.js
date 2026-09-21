/* SciMetricsPro — HelpPopover: contextual help with the formula and its reference.
   Texts arrive already translated (t()). `formula` and the symbols in `where` are
   trusted HTML written in the dictionaries (<var>, <sub>, <sup>, .frac).

   HelpPopover.button(spec, { label })  → a "?" button that opens the popover
   HelpPopover.open(anchor, spec) · HelpPopover.close() · HelpPopover.isOpen()
   spec: { title, text, formula, where: [[symbolHTML, meaning]], interpretation, refs: [text] } */
'use strict';

const HelpPopover = {
  node: null,
  anchor: null,

  button(spec, opts) {
    opts = opts || {};
    const b = mk('button', {
      type: 'button', class: 'help-btn',
      'aria-label': opts.label || spec.title || t('help.formula'),
      title: opts.label || null,
      'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    }, icon('help'));
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (HelpPopover.anchor === b) HelpPopover.close();
      else HelpPopover.open(b, typeof spec === 'function' ? spec() : spec);
    });
    return b;
  },

  build(spec) {
    const pop = mk('div', { class: 'help-pop', role: 'dialog', 'aria-modal': 'false', tabindex: '-1' });
    const head = mk('div', { class: 'help-head' });
    head.appendChild(mk('h3', { class: 'help-title' }, esc(spec.title || '')));
    const close = mk('button', { type: 'button', class: 'icon-btn help-close', 'aria-label': t('help.close') }, icon('close'));
    close.addEventListener('click', () => HelpPopover.close(true));
    head.appendChild(close);
    pop.appendChild(head);
    const body = mk('div', { class: 'help-body' });
    if (spec.text) body.appendChild(mk('p', null, esc(spec.text)));
    if (spec.formula) {
      body.appendChild(mk('div', { class: 'help-label' }, esc(t('help.formula'))));
      body.appendChild(mk('div', { class: 'formula' }, spec.formula));
    }
    if (spec.where && spec.where.length) {
      body.appendChild(mk('div', { class: 'help-label' }, esc(t('help.where'))));
      const dl = mk('dl', { class: 'help-where' });
      spec.where.forEach(([sym, meaning]) => {
        dl.appendChild(mk('dt', null, sym));
        dl.appendChild(mk('dd', null, esc(meaning)));
      });
      body.appendChild(dl);
    }
    if (spec.interpretation) {
      body.appendChild(mk('div', { class: 'help-label' }, esc(t('help.interpretation'))));
      body.appendChild(mk('p', null, esc(spec.interpretation)));
    }
    if (spec.refs && spec.refs.length) {
      body.appendChild(mk('div', { class: 'help-label' }, esc(t(spec.refs.length > 1 ? 'help.references' : 'help.reference'))));
      const ul = mk('ul', { class: 'help-refs' });
      spec.refs.forEach(r => ul.appendChild(mk('li', null, esc(r))));
      body.appendChild(ul);
    }
    pop.appendChild(body);
    return pop;
  },

  open(anchor, spec) {
    HelpPopover.close();
    const pop = HelpPopover.build(spec);
    document.body.appendChild(pop);
    HelpPopover.node = pop;
    HelpPopover.anchor = anchor;
    anchor.setAttribute('aria-expanded', 'true');
    HelpPopover.place();
    pop.focus({ preventScroll: true });
    document.addEventListener('click', HelpPopover.onOutside, true);
    document.addEventListener('keydown', HelpPopover.onKey);
    window.addEventListener('resize', HelpPopover.place);
    window.addEventListener('scroll', HelpPopover.place, true);
    return pop;
  },

  place() {
    const pop = HelpPopover.node, a = HelpPopover.anchor;
    if (!pop || !a) return;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    if (vw < 560) { pop.classList.add('sheet'); pop.style.left = ''; pop.style.top = ''; return; }
    pop.classList.remove('sheet');
    const r = a.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight, gap = 8;
    let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12);
    let top = r.bottom + gap;
    if (top + h > vh - 12 && r.top - gap - h > 12) top = r.top - gap - h;
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(Math.max(12, top)) + 'px';
  },

  onOutside(e) {
    const pop = HelpPopover.node;
    if (pop && !pop.contains(e.target) && !(HelpPopover.anchor && HelpPopover.anchor.contains(e.target))) HelpPopover.close();
  },
  onKey(e) { if (e.key === 'Escape') HelpPopover.close(true); },

  close(returnFocus) {
    const pop = HelpPopover.node, a = HelpPopover.anchor;
    if (!pop) return;
    pop.remove();
    HelpPopover.node = null; HelpPopover.anchor = null;
    if (a) { a.setAttribute('aria-expanded', 'false'); if (returnFocus && document.body.contains(a)) a.focus(); }
    document.removeEventListener('click', HelpPopover.onOutside, true);
    document.removeEventListener('keydown', HelpPopover.onKey);
    window.removeEventListener('resize', HelpPopover.place);
    window.removeEventListener('scroll', HelpPopover.place, true);
  },

  isOpen() { return !!HelpPopover.node; },
};

window.HelpPopover = HelpPopover;
