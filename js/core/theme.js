/* SciMetricsPro — light / dark mode.
   The design tokens live in css/style.css (:root). With no saved choice the app
   follows the operating system; the header button stores an explicit choice in
   <html data-theme="light|dark">, which wins over the system setting. */
'use strict';

const Theme = {
  media: null,

  init() {
    const saved = Prefs.get('theme', null);
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    try {
      this.media = window.matchMedia('(prefers-color-scheme: dark)');
      const onSystem = () => { if (!document.documentElement.dataset.theme) emit('themechange', { theme: this.current() }); };
      if (this.media.addEventListener) this.media.addEventListener('change', onSystem);
    } catch (e) { this.media = null; }
  },

  /* the theme actually shown: the explicit choice, else the system preference */
  current() {
    const explicit = document.documentElement.dataset.theme;
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return this.media && this.media.matches ? 'dark' : 'light';
  },

  set(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    document.documentElement.dataset.theme = theme;
    Prefs.set('theme', theme);
    emit('themechange', { theme });
  },

  toggle() { this.set(this.current() === 'dark' ? 'light' : 'dark'); return this.current(); },

  /* value of a design token, e.g. Theme.token('--primary') */
  token(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); },
};

window.Theme = Theme;
