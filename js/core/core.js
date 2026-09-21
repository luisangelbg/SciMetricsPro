/* SciMetricsPro — global state, event bus and shared utilities.
   No ES modules: everything hangs from window so the app also works when
   index.html is opened with a double click (file://). */
'use strict';

const APP = {
  name: 'SciMetricsPro',
  version: '1.0.0',
  year: 2026,
  authors: [
    { name: 'Luis Ángel Barrera-Guzmán', orcid: '0000-0001-8057-2583' },
    { name: 'Gabriela Ramírez-Ojeda', orcid: '0000-0001-9679-6514' },
  ],
  /* the names joined for the footer and the credits, in the language of the interface */
  authorNames() { return APP.authors.map(a => a.name).join(' ' + t('report.and') + ' '); },
  /* concept DOI: it always resolves to the latest version */
  doi: '10.5281/zenodo.22879993',
  repo: 'https://github.com/luisangelbg/SciMetricsPro',
  storagePrefix: 'scimetricspro:',
  assetBase: '',       // prefix for img/ when the page lives in a subfolder (tests)
};

/* The single source of truth. Every module reads `state.records`, never the
   raw files, so all sources travel through the same analysis pipeline. */
const state = {
  files: [],          // imported files: [{name, size, format, source, count}]
  records: null,      // BiblioRecord[] after import (null = nothing loaded)
  filtered: null,     // BiblioRecord[] after cleaning and filters
  route: 'home',
};

/* ---------------- event bus ----------------
   on('datachange', fn) · off('datachange', fn) · emit('datachange', detail)
   Events in use: langchange, themechange, routechange, datachange. */
const Bus = (() => {
  const handlers = {};
  return {
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); return fn; },
    off(evt, fn) { handlers[evt] = (handlers[evt] || []).filter(h => h !== fn); },
    emit(evt, detail) {
      (handlers[evt] || []).slice().forEach(fn => {
        try { fn(detail); } catch (e) { console.error(`[${evt}]`, e); }
      });
    },
    count(evt) { return (handlers[evt] || []).length; },
  };
})();
const on = Bus.on, off = Bus.off, emit = Bus.emit;

function hasData() { return Array.isArray(state.records) && state.records.length > 0; }

/* ---------------- DOM ---------------- */
function el(id) { return document.getElementById(id); }
function els(sel, root) { return [...(root || document).querySelectorAll(sel)]; }
function mk(tag, attrs, html) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'style') n.setAttribute('style', attrs[k]);
    else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] === true) n.setAttribute(k, '');
    else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
  }
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function svgEl(tag, attrs, text) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}
function hostOf(h) { return typeof h === 'string' ? el(h) : h; }
/* a tab bar wider than the screen scrolls sideways: keep the selected tab in view after a redraw */
function showSelectedTab(tabs) {
  requestAnimationFrame(() => {
    const sel = tabs.querySelector('[aria-selected="true"]');
    if (sel && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = Math.max(0, sel.offsetLeft - tabs.offsetLeft - 24);
  });
}

/* Small inline icons (24×24, stroke = currentColor), drawn for this app. */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  upload: '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 15v4.5h16V15"/>',
  filter: '<path d="M3.5 5h17l-6.5 8v6l-4 1.5V13z"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-6"/><circle cx="12" cy="18" r="1.3"/>',
  journal: '<path d="M6 3.5h11.5v17H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"/><path d="M8 3.5v17"/><path d="M11 8h4M11 11h4"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M15.8 14.3c2.3.1 4 1.6 4.6 4.2"/>',
  doc: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/><path d="M9 12.5h7M9 16h7"/>',
  concept: '<circle cx="7" cy="8" r="2.6"/><circle cx="17" cy="7" r="2"/><circle cx="12.5" cy="16.5" r="3"/><path d="m9.3 9.4 1.8 4.4M15.6 8.6l-1.8 5.1M9.6 7.8l5.4-.6"/>',
  quote: '<path d="M5 17.5c0-4.5 1.5-8 5-10"/><path d="M5 17.5h4.5V13H5"/><path d="M13.5 17.5c0-4.5 1.5-8 5-10"/><path d="M13.5 17.5H18V13h-4.5"/>',
  network: '<circle cx="5.5" cy="6" r="2"/><circle cx="18.5" cy="5.5" r="2"/><circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="18.5" r="2"/><circle cx="18.5" cy="18" r="2"/><path d="m7.2 7.2 3 3.1M16.8 6.9l-3.1 3.3M10.3 13.7l-3.6 3.4M13.8 13.6l3.2 2.9"/>',
  flow: '<rect x="4" y="3" width="16" height="4" rx="1"/><rect x="4" y="10" width="16" height="4" rx="1"/><rect x="4" y="17" width="9" height="4" rx="1"/><path d="M12 7v3M8.5 14v3"/><path d="M15 19h5"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 15v4.5h16V15"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.8" r=".6"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="9.5" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  sparkle: '<path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  sigma: '<path d="M18 4.5H6.5l6 7.5-6 7.5H18"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5z"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  inbox: '<path d="M3.5 13.5 6 5h12l2.5 8.5V19H3.5z"/><path d="M3.5 13.5H9l1 2h4l1-2h5.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  trend: '<path d="M3.5 17.5 9 12l4 3.5 7.5-8"/><path d="M15 7.5h5.5V13"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  person: '<circle cx="12" cy="8" r="3.3"/><path d="M5.5 20c.7-3.8 3.2-5.8 6.5-5.8s5.8 2 6.5 5.8"/>',
  tag: '<path d="M3.5 12.2V4.5h7.7l9 9-7.7 7.7z"/><circle cx="8" cy="9" r="1.4"/>',
  save: '<path d="M5 3.5h11.5L20.5 7.5v13H5z"/><path d="M8 3.5v5h8v-5"/><rect x="8" y="13" width="8" height="7.5" rx="1"/>',
  folder: '<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".7"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
};
function icon(name, cls) {
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

/* ---------------- numbers (locale follows the interface language) ---------------- */
function locale() { return (window.I18N && I18N.lang === 'en') ? 'en-US' : 'es-MX'; }
function fmtNum(v, d) {
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 1e-4 || abs >= 1e9) return n.toExponential(d != null ? d : 2);
  return n.toLocaleString(locale(), { maximumFractionDigits: d != null ? d : 3 });
}
function fmtInt(v) { return (v == null || !isFinite(v)) ? '—' : Math.round(v).toLocaleString(locale()); }
function fmtPct(x, d) {
  if (x == null || !isFinite(x)) return '—';
  return (x * 100).toLocaleString(locale(), { maximumFractionDigits: d == null ? 1 : d }) + ' %';
}

/* Case- and accent-insensitive text for searching and matching. */
function fold(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/* ---------------- files ---------------- */
function csvEscape(v, sep) {
  const s = String(v ?? '');
  return new RegExp(`["\\n\\r${sep || ','}]`).test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function download(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = mk('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function slug(s) {
  /* «año» → «anio» (without the tilde «ano» is another word) */
  return String(s || 'scimetricspro').replace(/\.[^.]+$/, '')
    .replace(/ñ/g, 'ni').replace(/Ñ/g, 'NI')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'scimetricspro';
}

/* Persisted preferences (language, theme, figure style). localStorage may be
   unavailable (private windows, blocked storage): every access is guarded. */
const Prefs = {
  get(k, d) { try { const v = localStorage.getItem(APP.storagePrefix + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(APP.storagePrefix + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem(APP.storagePrefix + k); } catch (e) { /* ignore */ } },
};

/* Seeded generator: anything stochastic must be reproducible and reportable. */
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

/* Short, non-blocking notice at the bottom of the screen. */
function toast(text, kind) {
  let box = el('toasts');
  if (!box) { box = mk('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
  const t = mk('div', { class: 'toast' + (kind ? ' toast-' + kind : ''), role: kind === 'error' ? 'alert' : 'status' });
  t.textContent = text;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3800);
}

Object.assign(window, {
  APP, state, Bus, on, off, emit, hasData, el, els, mk, esc, svgEl, hostOf, showSelectedTab, ICONS, icon,
  locale, fmtNum, fmtInt, fmtPct, fold, csvEscape, download, slug, Prefs, rng, toast,
});
