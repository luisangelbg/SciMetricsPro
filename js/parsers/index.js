/* SciMetricsPro — readers in the page and in a background worker.
   Every reader part (js/parsers/*.js, js/model/*.js) is a named function that
   fills a namespace. Parsers.lib() builds that namespace here, for direct calls
   and tests; Parsers.read() sends the same functions to a worker, which builds
   its own copy and reads the files there, reporting progress. */
'use strict';

const Parsers = {
  _lib: null,

  lib() {
    if (!Parsers._lib) {
      const P = {};
      (window.PARSER_PARTS || []).forEach(part => part(P));
      Parsers._lib = P;
    }
    return Parsers._lib;
  },

  /* files: File[] → Promise<results[]> (see P.readFiles). Options: onProgress, signal, inline */
  read(files, opts) {
    opts = opts || {};
    const job = {
      fns: window.PARSER_PARTS,
      main: async function (payload, progress) {
        const P = {};
        for (const name in __fns) __fns[name](P);
        return P.readFiles(payload, progress);
      },
      payload: Array.from(files),
      onProgress: opts.onProgress,
      signal: opts.signal,
    };
    if (opts.inline) return Work.runInline(job);
    return opts.overlay ? ProgressOverlay.run(Object.assign({ title: opts.title, delay: 250 }, job)) : Work.run(job);
  },
};

window.Parsers = Parsers;
