/* SciMetricsPro — minimal test harness that runs in the browser (file:// included).
   describe('suite', () => { it('does x', async () => { eq(a, b); }); });
   When everything has run, window.__testResult = { done, passed, failed, total, failures }
   and the page shows the list in green or red. */
'use strict';

const TestHarness = (() => {
  const suites = [];
  let current = null;

  function describe(name, fn) {
    const s = { name, tests: [], source: fn.toString() };
    suites.push(s);
    current = s;
    fn();
    current = null;
  }
  function it(name, fn) {
    if (!current) throw new Error('it() outside describe()');
    current.tests.push({ name, fn });
  }

  function fmt(v) {
    try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v, (k, x) => (x instanceof Set ? [...x] : x)); }
    catch (e) { return String(v); }
  }
  class AssertionError extends Error {}
  function fail(msg) { throw new AssertionError(msg); }
  function ok(v, msg) { if (!v) fail(msg || `expected truthy, got ${fmt(v)}`); }
  function eq(a, b, msg) { if (a !== b) fail((msg ? msg + ': ' : '') + `expected ${fmt(b)}, got ${fmt(a)}`); }
  function deepEq(a, b, msg) { if (fmt(a) !== fmt(b)) fail((msg ? msg + ': ' : '') + `expected ${fmt(b)}, got ${fmt(a)}`); }
  function near(a, b, tol, msg) { if (!(Math.abs(a - b) <= (tol == null ? 1e-9 : tol))) fail((msg ? msg + ': ' : '') + `expected ${b} ± ${tol}, got ${a}`); }
  async function rejects(p, msg) {
    try { await (typeof p === 'function' ? p() : p); } catch (e) { return e; }
    fail(msg || 'expected a rejection');
  }
  const tick = ms => new Promise(r => setTimeout(r, ms || 0));

  async function run() {
    const out = document.getElementById('results');
    const summary = document.getElementById('summary');
    const failures = [];
    let passed = 0, total = 0;
    const t0 = performance.now();
    for (const s of suites) {
      const sec = document.createElement('section');
      sec.className = 'suite';
      const h = document.createElement('h2');
      h.textContent = s.name;
      sec.appendChild(h);
      const ul = document.createElement('ul');
      sec.appendChild(ul);
      out.appendChild(sec);
      for (const tc of s.tests) {
        total++;
        const li = document.createElement('li');
        const t1 = performance.now();
        try {
          await tc.fn();
          passed++;
          li.className = 'pass';
          li.textContent = '✓ ' + tc.name;
        } catch (e) {
          li.className = 'fail';
          li.textContent = '✗ ' + tc.name + ' — ' + (e && e.message ? e.message : String(e));
          failures.push({ suite: s.name, test: tc.name, message: e && e.message ? e.message : String(e) });
          console.error('[test]', s.name, '›', tc.name, e);
        }
        const ms = performance.now() - t1;
        if (ms > 250) { const small = document.createElement('small'); small.textContent = ` (${Math.round(ms)} ms)`; li.appendChild(small); }
        ul.appendChild(li);
      }
    }
    const failed = total - passed;
    const result = { done: true, passed, failed, total, failures, ms: Math.round(performance.now() - t0) };
    window.__testResult = result;
    document.body.classList.add(failed ? 'has-fail' : 'all-pass');
    summary.textContent = failed ? `✗ ${failed} of ${total} tests failed` : `✓ ${total} tests passed`;
    document.getElementById('resultJson').textContent = JSON.stringify(result);
    document.title = (failed ? 'FAIL ' : 'PASS ') + passed + '/' + total;
    return result;
  }

  return { describe, it, ok, eq, deepEq, near, rejects, tick, run, suites };
})();

const { describe, it, ok, eq, deepEq, near, rejects, tick } = TestHarness;
