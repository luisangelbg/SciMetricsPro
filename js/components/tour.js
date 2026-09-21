/* SciMetricsPro — guided tour of the first visit: seven short steps that point at the parts of the app (import, cleaning,
   analyses, systematic review, export and report, project and language). It can be skipped at any step, starts by itself
   only once (Prefs 'tourDone') and can be started again from the home page. Keyboard: → next, ← back, Esc closes. */
'use strict';

const Tour = {
  STEPS: [
    { key: 'welcome', target: null },
    { key: 'import', target: '.nav-link[data-route="import"]' },
    { key: 'cleaning', target: '.nav-link[data-route="cleaning"]' },
    { key: 'analysis', target: '.nav-link[data-route="overview"]' },
    { key: 'review', target: '.nav-link[data-route="prisma"]' },
    { key: 'export', target: '.nav-link[data-route="export"]' },
    { key: 'project', target: '#projSave' },
  ],
  index: 0,
  node: null,
  spot: null,
  opener: null,

  shouldStart() { return !window.SMP_TEST && !Prefs.get('tourDone', false); },

  maybeStart() {
    if (!Tour.shouldStart()) return;
    setTimeout(() => { if (Tour.shouldStart() && !Tour.node && !el('recoverDialog') && state.route === 'home') Tour.start(); }, 700);
  },

  start(index) {
    Tour.close(false);
    Tour.opener = document.activeElement;
    Tour.index = Math.max(0, Math.min(Tour.STEPS.length - 1, index || 0));
    document.addEventListener('keydown', Tour.onKey, true);
    window.addEventListener('resize', Tour.place);
    window.addEventListener('scroll', Tour.place, true);
    Tour.render();
  },

  target() {
    const step = Tour.STEPS[Tour.index];
    if (!step.target) return null;
    const n = document.querySelector(step.target);
    if (!n) return null;
    /* the sidebar is a drop-down menu on narrow screens */
    if (n.closest('#sidebar') && Layout.isNarrow()) Layout.openMenu();
    const r = n.getBoundingClientRect();
    return r.width && r.height ? n : null;
  },

  render() {
    const step = Tour.STEPS[Tour.index];
    if (!Tour.node) {
      Tour.spot = mk('div', { class: 'tour-spot', 'aria-hidden': 'true' });
      Tour.node = mk('div', { class: 'tour-pop card', id: 'tourDialog', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'tourTitle', 'aria-describedby': 'tourText' });
      document.body.appendChild(Tour.spot);
      document.body.appendChild(Tour.node);
    }
    const n = Tour.STEPS.length, last = Tour.index === n - 1;
    const p = Tour.node;
    p.innerHTML = '';
    p.appendChild(mk('p', { class: 'tour-progress', id: 'tourProgress' }, esc(t('tour.step', { n: Tour.index + 1, total: n }))));
    p.appendChild(mk('h2', { id: 'tourTitle' }, esc(t('tour.steps.' + step.key + '.title'))));
    p.appendChild(mk('p', { id: 'tourText' }, esc(t('tour.steps.' + step.key + '.text'))));
    const dots = mk('div', { class: 'tour-dots', 'aria-hidden': 'true' });
    Tour.STEPS.forEach((s, i) => dots.appendChild(mk('span', { class: 'tour-dot' + (i === Tour.index ? ' on' : '') })));
    p.appendChild(dots);
    const row = mk('div', { class: 'tour-actions' });
    const skip = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'tourSkip' }, esc(t(last ? 'tour.close' : 'tour.skip')));
    skip.addEventListener('click', () => Tour.close(true));
    row.appendChild(skip);
    const nav = mk('div', { class: 'tour-nav' });
    const prev = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'tourPrev', disabled: Tour.index === 0 }, esc(t('tour.prev')));
    prev.addEventListener('click', () => Tour.go(-1));
    const next = mk('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'tourNext' }, esc(t(last ? 'tour.finish' : 'tour.next')));
    next.addEventListener('click', () => (last ? Tour.close(true) : Tour.go(1)));
    nav.appendChild(prev); nav.appendChild(next);
    row.appendChild(nav);
    p.appendChild(row);
    Tour.place();
    next.focus({ preventScroll: true });
  },

  go(step) {
    const i = Tour.index + step;
    if (i < 0 || i >= Tour.STEPS.length) return;
    if (Layout.isNarrow()) Layout.closeMenu();
    Tour.index = i;
    Tour.render();
  },

  place() {
    if (!Tour.node) return;
    const target = Tour.target();
    const pop = Tour.node, spot = Tour.spot;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight, gap = 12;
    pop.classList.toggle('centered', !target);
    if (!target) {
      spot.hidden = true;
      pop.style.left = Math.max(12, (vw - pop.offsetWidth) / 2) + 'px';
      pop.style.top = Math.max(12, (vh - pop.offsetHeight) / 2) + 'px';
      return;
    }
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = target.getBoundingClientRect();
    spot.hidden = false;
    Object.assign(spot.style, { left: (r.left - 6) + 'px', top: (r.top - 6) + 'px', width: (r.width + 12) + 'px', height: (r.height + 12) + 'px' });
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left, top;
    if (r.right + gap + w <= vw - 12) { left = r.right + gap; top = r.top + r.height / 2 - h / 2; }
    else if (r.bottom + gap + h <= vh - 12) { left = r.left + r.width / 2 - w / 2; top = r.bottom + gap; }
    else { left = r.left + r.width / 2 - w / 2; top = r.top - gap - h; }
    pop.style.left = Math.min(Math.max(12, left), vw - w - 12) + 'px';
    pop.style.top = Math.min(Math.max(12, top), vh - h - 12) + 'px';
  },

  onKey(e) {
    if (!Tour.node) return;
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape') { e.preventDefault(); Tour.close(true); }
    else if (e.key === 'ArrowRight' && !typing) { e.preventDefault(); if (Tour.index === Tour.STEPS.length - 1) Tour.close(true); else Tour.go(1); }
    else if (e.key === 'ArrowLeft' && !typing) { e.preventDefault(); Tour.go(-1); }
    else if (e.key === 'Tab' && Tour.node.contains(document.activeElement)) {
      const buttons = [...Tour.node.querySelectorAll('button:not([disabled])')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  },

  /* done: remembered, so the tour does not start again by itself */
  close(done) {
    if (done) Prefs.set('tourDone', true);
    document.removeEventListener('keydown', Tour.onKey, true);
    window.removeEventListener('resize', Tour.place);
    window.removeEventListener('scroll', Tour.place, true);
    if (Tour.node) { Tour.node.remove(); Tour.spot.remove(); Tour.node = null; Tour.spot = null; if (Layout.isNarrow()) Layout.closeMenu(); }
    const back = Tour.opener;
    Tour.opener = null;
    if (done && back && back.isConnected && back.focus) back.focus({ preventScroll: true });
  },
};

window.Tour = Tour;
