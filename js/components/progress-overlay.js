/* SciMetricsPro — ProgressOverlay: covers the page while a long process runs.
   const p = ProgressOverlay.show({ title, message, onCancel })   (onCancel adds a Cancel button)
   p.update(fraction 0..1 | null (indeterminate), message) · p.close()
   p.close({ ok: false, message })   the process failed: the window says so (without a message it just closes)
   p.close({ quiet: true })          close without the closing check mark (e.g. another wait follows)

   ProgressOverlay.run({ title, ...Work.run options }) runs a worker behind the
   overlay, with Cancel wired to an AbortController. Resolves with the result, or
   with undefined when the user cancels.

   With the LABG Suite core loaded (js/core/labg-core.js), the window is LABG.work: the
   animated wait of the suite that ends in a check mark when the work succeeds, closes
   quietly when it is cancelled and shows a cross when it fails. With Efectos LABG
   (js/core/labg-fx.js) that same wait is a layer over the results panel instead of a
   window; showLabg finds either one. Without the core, the overlay of always. The
   public API and its behaviour are the same in all three. */
'use strict';

const ProgressOverlay = {
  node: null,
  _w: null,
  /* a success shown for less than this (ms) closes quietly: a celebration for a wait
     the person hardly saw would only get in the way */
  MIN_SHOWN: 400,

  labg() { return !!(window.LABG && typeof LABG.work === 'function'); },

  show(opts) {
    opts = opts || {};
    ProgressOverlay.close();
    return ProgressOverlay.labg() ? ProgressOverlay.showLabg(opts) : ProgressOverlay.showOwn(opts);
  },

  /* the suite's animated window, with the class names of the old overlay on its parts
     (callers and tests find the bar, the percentage, the message and Cancel by them) */
  showLabg(opts) {
    const w = LABG.work({ title: opts.title || t('progress.working'), message: opts.message || '', cancel: opts.onCancel || null });
    /* the suite's window (.lw-backdrop) or, with Efectos LABG (labg-fx.js), its layer over the results panel */
    let back = w.el && w.el.closest ? w.el.closest('.lfx-layer') : null;
    if (!back) { const all = document.querySelectorAll('body > .lw-backdrop'); back = all[all.length - 1]; }
    const bar = back.querySelector('.lw-bar, .lfx-bar');
    const msgNode = back.querySelector('.lw-msg, .lfx-msg'), pctNode = back.querySelector('.lw-meta > span, .lfx-meta > span');
    const cancelBtn = back.querySelector('.lw-actions button, .lfx-actions button');
    back.classList.add('progress-overlay');
    bar.classList.add('indeterminate');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
    if (msgNode) msgNode.classList.add('progress-msg');
    if (pctNode) pctNode.classList.add('progress-pct');
    if (cancelBtn) cancelBtn.classList.add('progress-cancel');
    const t0 = performance.now();
    ProgressOverlay.node = back;
    ProgressOverlay._w = w;
    const handle = {
      node: back,
      labg: true,
      update(f, message) {
        const indet = f == null || !isFinite(f);
        w.update(indet ? null : f, message != null ? message : null);
        bar.classList.toggle('indeterminate', indet);
      },
      close(o) {
        if (ProgressOverlay.node !== back) return;   // already closed or replaced by another window
        ProgressOverlay.node = null; ProgressOverlay._w = null;
        /* the window leaves the page a moment later: drop its hooks now, so nothing finds
           the closing window (its Cancel button included) as if it were still the open one */
        back.classList.remove('progress-overlay');
        back.querySelectorAll('.progress-cancel, .progress-msg, .progress-pct').forEach(n => n.classList.remove('progress-cancel', 'progress-msg', 'progress-pct'));
        o = o || {};
        if (w.closed || w.ended || w.cancelled) return;   // cancelled from its own button, or already finishing
        if (o.ok === false) { if (o.message) w.fail(o.message); else w.close(); return; }
        /* the tests page moves on at once: no closing animation that outlives its test */
        if (o.quiet || window.SMP_TEST || performance.now() - t0 < ProgressOverlay.MIN_SHOWN) { w.close(); return; }
        w.done(o.message);
      },
    };
    if (opts.fraction != null) handle.update(opts.fraction);
    return handle;
  },

  showOwn(opts) {
    const back = mk('div', { class: 'progress-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-busy': 'true' });
    const box = mk('div', { class: 'progress-box' });
    const title = mk('h3', { class: 'progress-title', id: 'progressTitle' }, esc(opts.title || t('progress.working')));
    back.setAttribute('aria-labelledby', 'progressTitle');
    const bar = mk('div', { class: 'progress-bar indeterminate', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-labelledby': 'progressTitle' });
    const fill = mk('div', { class: 'progress-fill' });
    bar.appendChild(fill);
    const row = mk('div', { class: 'progress-row' });
    const msg = mk('span', { class: 'progress-msg' }, esc(opts.message || ''));
    const pct = mk('span', { class: 'progress-pct' });
    row.appendChild(msg); row.appendChild(pct);
    box.appendChild(title); box.appendChild(bar); box.appendChild(row);
    if (opts.onCancel) {
      const cancel = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm progress-cancel' }, esc(t('progress.cancel')));
      cancel.addEventListener('click', () => { cancel.disabled = true; opts.onCancel(); });
      box.appendChild(cancel);
    }
    back.appendChild(box);
    document.body.appendChild(back);
    ProgressOverlay.node = back;
    const handle = {
      node: back,
      update(f, message) {
        if (f == null || !isFinite(f)) {
          bar.classList.add('indeterminate'); bar.removeAttribute('aria-valuenow'); fill.style.width = ''; pct.textContent = '';
        } else {
          const p = Math.max(0, Math.min(100, Math.round(f * 100)));
          bar.classList.remove('indeterminate'); bar.setAttribute('aria-valuenow', String(p));
          fill.style.width = p + '%'; pct.textContent = t('progress.percent', { p });
        }
        if (message != null) msg.textContent = message;
      },
      close() { if (ProgressOverlay.node === back) ProgressOverlay.close(); },
    };
    if (opts.fraction != null) handle.update(opts.fraction);
    return handle;
  },

  /* closes whatever window is open, quietly */
  close() {
    const w = ProgressOverlay._w;
    if (ProgressOverlay.node) {
      if (w) {
        ProgressOverlay.node.classList.remove('progress-overlay');
        ProgressOverlay.node.querySelectorAll('.progress-cancel, .progress-msg, .progress-pct').forEach(n => n.classList.remove('progress-cancel', 'progress-msg', 'progress-pct'));
      }
      else ProgressOverlay.node.remove();
      ProgressOverlay.node = null;
    }
    ProgressOverlay._w = null;
    if (w && !w.closed) w.close();
  },

  isOpen() { return !!ProgressOverlay.node && !(ProgressOverlay._w && ProgressOverlay._w.closed); },

  /* opts.delay (ms): show the overlay only if the work lasts longer, so quick jobs do not flash it.
     opts.formatMessage(info): turns what the worker reports into the text shown. */
  async run(opts) {
    const ctrl = new AbortController();
    let p = null, lastF = null, lastM = opts.message;
    const open = () => { if (!p) { p = ProgressOverlay.show({ title: opts.title, message: lastM, onCancel: () => ctrl.abort() }); p.update(lastF, lastM); } };
    const timer = opts.delay ? setTimeout(open, opts.delay) : (open(), null);
    try {
      return await Work.run(Object.assign({}, opts, {
        signal: ctrl.signal,
        onProgress: (f, m) => {
          const text = opts.formatMessage ? opts.formatMessage(m) : m;
          lastF = f; lastM = text;
          if (p) p.update(f, text);
          if (opts.onProgress) opts.onProgress(f, m);
        },
      }));
    } catch (e) {
      if (e.name === 'AbortError') {
        if (p) p.close({ ok: false });
        toast(t('progress.cancelled'));
        return undefined;
      }
      const text = t('progress.failed', { msg: e.message });
      /* the suite's window says it with a cross; without it (or if it never showed), a message */
      if (p && p.labg) p.close({ ok: false, message: text });
      else toast(text, 'error');
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
      if (p) p.close();   // success: the check mark (a no-op after a cancel or an error)
    }
  },
};

window.ProgressOverlay = ProgressOverlay;
