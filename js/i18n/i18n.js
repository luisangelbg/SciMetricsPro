/* SciMetricsPro — interface language.
   Dictionaries live in js/i18n/es.js and js/i18n/en.js as plain objects
   (window.I18N_DICT.es / .en), not JSON, so they load from file://.

   I18N.t('home.title', {n: 3})  → text with {n} replaced
   <span data-i18n="nav.home">    → textContent filled by I18N.apply()
   <b data-i18n-html="key">       → innerHTML (only for trusted dictionary strings)
   <button data-i18n-attr="title:key;aria-label:key2">
   I18N.phrase('Theme')           → the figure engine writes its labels in English;
                                    this looks them up in the `phrases` table. */
'use strict';

window.I18N_DICT = window.I18N_DICT || {};

const I18N = {
  lang: 'es',
  fallback: 'es',
  available: ['es', 'en'],
  missing: new Set(),

  init() {
    const saved = Prefs.get('lang', null);
    this.lang = this.available.includes(saved) ? saved : 'es';
    document.documentElement.lang = this.lang;
  },

  lookup(lang, key) {
    let node = window.I18N_DICT[lang];
    for (const part of String(key).split('.')) {
      if (node == null || typeof node !== 'object') return undefined;
      node = node[part];
    }
    return node;
  },

  t(key, vars) {
    let s = this.lookup(this.lang, key);
    if (typeof s !== 'string') {
      this.missing.add(this.lang + ':' + key);
      s = this.lookup(this.fallback, key);
      if (typeof s !== 'string') return key;
    }
    return vars ? this.format(s, vars) : s;
  },

  has(key) { return typeof this.lookup(this.lang, key) === 'string'; },

  /* run fn with another language without changing the interface (for the report); fn must be synchronous */
  withLang(lang, fn) {
    const prev = this.lang;
    if (this.available.includes(lang)) this.lang = lang;
    try { return fn(); } finally { this.lang = prev; }
  },

  /* plural: key.one for n = 1, key.other otherwise; {n} is formatted in the active locale */
  tp(key, n, vars) {
    return this.t(key + (n === 1 ? '.one' : '.other'), Object.assign({ n: Number(n).toLocaleString(this.lang === 'en' ? 'en-US' : 'es-MX') }, vars || {}));
  },

  format(s, vars) {
    return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  },

  phrase(s, vars) {
    const dict = window.I18N_DICT[this.lang];
    let out = (dict && dict.phrases && typeof dict.phrases[s] === 'string') ? dict.phrases[s] : null;
    if (out == null) {
      if (this.lang !== 'en') this.missing.add(this.lang + ':phrase:' + s);
      out = s;
    }
    return vars ? this.format(out, vars) : out;
  },

  apply(root) {
    root = root || document;
    els('[data-i18n]', root).forEach(n => { n.textContent = this.t(n.dataset.i18n); });
    els('[data-i18n-html]', root).forEach(n => { n.innerHTML = this.t(n.dataset.i18nHtml); });
    els('[data-i18n-attr]', root).forEach(n => {
      n.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(x => x.trim());
        if (attr && key) n.setAttribute(attr, this.t(key));
      });
    });
  },

  setLang(lang) {
    if (!this.available.includes(lang) || lang === this.lang) return false;
    this.lang = lang;
    Prefs.set('lang', lang);
    document.documentElement.lang = lang;
    this.apply(document);
    emit('langchange', { lang });
    return true;
  },
};

const t = (key, vars) => I18N.t(key, vars);
const tp = (key, n, vars) => I18N.tp(key, n, vars);
Object.assign(window, { I18N, t, tp });
