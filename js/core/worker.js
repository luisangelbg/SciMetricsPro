/* SciMetricsPro — background processes.
   A page opened from file:// cannot start `new Worker('file.js')` nor call
   importScripts, so each worker is built from source text: the pure functions
   it needs (fn.toString()) plus a main function, packed into a Blob URL.

   Work.run({
     fns:     [namedFunction, ...]  or  { name: fn, ... }   helpers available inside
     consts:  { NAME: jsonValue }                            constants available inside
     main:    function (payload, progress) { ... return result; }   may be async
     payload: any structured-cloneable value,
     onProgress: (fraction 0..1 | null, message) => {},
     signal:  AbortSignal (optional)
   }) → Promise<result>

   Inside main, progress(fraction, message) reports advance; it is throttled so a
   tight loop does not flood the page with messages. */
'use strict';

const Work = {
  supported: typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined',

  source({ fns, consts, main }) {
    const parts = ['"use strict";'];
    for (const [name, value] of Object.entries(consts || {})) {
      parts.push(`const ${name} = ${JSON.stringify(value)};`);
    }
    const names = [];
    if (Array.isArray(fns)) {
      fns.forEach(fn => {
        if (typeof fn !== 'function' || !fn.name) throw new Error('Work.run: helper functions must be named');
        parts.push(Work.fnSource(fn.name, fn));
        names.push(fn.name);
      });
    } else if (fns) {
      for (const [name, fn] of Object.entries(fns)) { parts.push(Work.fnSource(name, fn)); names.push(name); }
    }
    /* the helpers by name, in the order given (main can iterate over them) */
    parts.push(`const __fns = { ${names.join(', ')} };`);
    parts.push(`
let __last = 0;
function progress(f, msg) {
  const now = Date.now();
  if (f === 1 || now - __last > 60) { __last = now; postMessage({ type: 'progress', f: f, msg: msg }); }
}
${Work.fnSource('__main', main)}
onmessage = async function (e) {
  try {
    const result = await __main(e.data, progress);
    postMessage({ type: 'done', result: result });
  } catch (err) {
    postMessage({ type: 'error', message: (err && err.message) || String(err) });
  }
};`);
    return parts.join('\n');
  },

  /* a method shorthand (`foo(x) {}`) is not valid on its own, so everything is bound to a name */
  fnSource(name, fn) {
    const src = fn.toString();
    if (/^(async\s+)?function\b/.test(src) || /^(async\s*)?(\([^)]*\)|[\w$]+)\s*=>/.test(src)) return `const ${name} = ${src};`;
    const isAsync = /^async\s+/.test(src);
    return `const ${name} = ${isAsync ? 'async ' : ''}function ${src.replace(/^async\s+/, '')};`;
  },

  run(opts) {
    const { payload, onProgress, signal } = opts;
    if (!Work.supported) return Work.runInline(opts);
    return new Promise((resolve, reject) => {
      let url, worker;
      try {
        url = URL.createObjectURL(new Blob([Work.source(opts)], { type: 'text/javascript' }));
        worker = new Worker(url);
      } catch (e) {
        if (url) URL.revokeObjectURL(url);
        /* some browsers refuse Blob workers from file://: compute in the page instead */
        Work.runInline(opts).then(resolve, reject);
        return;
      }
      const finish = () => { worker.terminate(); URL.revokeObjectURL(url); if (signal) signal.removeEventListener('abort', onAbort); };
      const onAbort = () => { finish(); reject(Work.abortError()); };
      if (signal) {
        if (signal.aborted) { finish(); reject(Work.abortError()); return; }
        signal.addEventListener('abort', onAbort);
      }
      worker.onmessage = e => {
        const m = e.data || {};
        if (m.type === 'progress') { if (onProgress) onProgress(m.f, m.msg); }
        else if (m.type === 'done') { finish(); resolve(m.result); }
        else if (m.type === 'error') { finish(); reject(new Error(m.message)); }
      };
      worker.onerror = e => { finish(); reject(new Error(e.message || 'Worker error')); };
      worker.postMessage(payload);
    });
  },

  /* same contract, on the main thread (fallback) */
  async runInline({ fns, consts, main, payload, onProgress, signal }) {
    const factory = new Function(Work.source({ fns, consts, main: main }).replace(/onmessage = async function[\s\S]*$/, 'return __main;'));
    const fn = factory.call(null);
    let result;
    const progress = (f, msg) => { if (onProgress) onProgress(f, msg); };
    if (signal && signal.aborted) throw Work.abortError();
    result = await fn(payload, progress);
    if (signal && signal.aborted) throw Work.abortError();
    return result;
  },

  abortError() { const e = new Error('aborted'); e.name = 'AbortError'; return e; },
};

window.Work = Work;
