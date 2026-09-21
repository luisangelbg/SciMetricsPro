/* SciMetricsPro — ProgressOverlay: covers the page while a long process runs.
   const p = ProgressOverlay.show({ title, message, onCancel })   (onCancel adds a Cancel button)
   p.update(fraction 0..1 | null (indeterminate), message) · p.close()

   ProgressOverlay.run({ title, ...Work.run options }) runs a worker behind the
   overlay, with Cancel wired to an AbortController. Resolves with the result, or
   with undefined when the user cancels. */
'use strict';

const ProgressOverlay = {
  node: null,

  show(opts) {
    opts = opts || {};
    ProgressOverlay.close();
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

  close() {
    if (ProgressOverlay.node) { ProgressOverlay.node.remove(); ProgressOverlay.node = null; }
  },

  isOpen() { return !!ProgressOverlay.node; },

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
      if (e.name === 'AbortError') { toast(t('progress.cancelled')); return undefined; }
      toast(t('progress.failed', { msg: e.message }), 'error');
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
      if (p) p.close();
    }
  },
};

window.ProgressOverlay = ProgressOverlay;
