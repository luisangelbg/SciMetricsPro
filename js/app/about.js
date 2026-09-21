/* SciMetricsPro — "About" page: version, author, licence, how to cite, privacy and the third-party parts with their
   licences (the full notices are in vendor/THIRD-PARTY-NOTICES.txt). */
'use strict';

const About = {
  /* the accents of each name, written the way BibTeX needs them */
  TEX: {
    'Luis Ángel Barrera-Guzmán': 'Barrera-Guzm{\\\'a}n, Luis {\\\'A}ngel',
    'Gabriela Ramírez-Ojeda': 'Ram{\\\'i}rez-Ojeda, Gabriela',
  },

  bibtex() {
    return '@software{barreraguzman' + APP.year + 'scimetricspro,\n'
      + '  author = {' + APP.authors.map(a => About.TEX[a.name] || a.name).join(' and ') + '},\n'
      + '  title = {{SciMetricsPro}: ' + t('about.cite.subtitle') + '},\n'
      + '  version = {' + APP.version + '},\n'
      + '  year = {' + APP.year + '},\n'
      + '  doi = {' + APP.doi + '},\n'
      + '  url = {https://doi.org/' + APP.doi + '},\n'
      + '  note = {' + t('about.cite.note') + '}\n}';
  },

  card(page, id, iconName, titleKey) {
    const card = mk('section', { class: 'card about-card', id, 'aria-labelledby': id + 'Title' });
    card.appendChild(mk('h2', { id: id + 'Title' }, icon(iconName) + '<span>' + esc(t(titleKey)) + '</span>'));
    page.appendChild(card);
    return card;
  },

  render(host) {
    host.innerHTML = '';
    const page = mk('article', { class: 'module-page about-page', 'data-module': 'about' });
    const head = mk('header', { class: 'page-head' });
    head.appendChild(mk('h1', { tabindex: '-1' }, esc(t('about.title'))));
    head.appendChild(mk('p', { class: 'page-desc' }, esc(t('about.desc'))));
    page.appendChild(head);
    const grid = mk('div', { class: 'about-grid' });
    page.appendChild(grid);

    const app = About.card(grid, 'aboutApp', 'sparkle', 'about.app.title');
    app.appendChild(mk('p', { class: 'about-version' }, '<strong>SciMetricsPro</strong> · ' + esc(t('footer.version', { v: APP.version }))));
    app.appendChild(mk('p', { class: 'about-version' },
      esc(t('about.app.doi')) + `: <a href="https://doi.org/${APP.doi}" target="_blank" rel="noopener noreferrer">${APP.doi}</a>`
      + ` · <a href="${APP.repo}" target="_blank" rel="noopener noreferrer">${esc(t('about.app.code'))}</a>`));
    app.appendChild(mk('p', null, esc(t('about.app.text'))));
    app.appendChild(mk('p', { class: 'hint' }, icon('lock') + '<span>' + esc(t('about.app.privacy')) + '</span>'));

    const author = About.card(grid, 'aboutAuthor', 'person', 'about.author.title');
    const dl = mk('dl', { class: 'about-list' });
    const row = (k, v) => { dl.appendChild(mk('dt', null, esc(t(k)))); dl.appendChild(mk('dd', null, v)); };
    row('about.author.name', APP.authors.map(a => esc(a.name)).join('<br>'));
    row('about.author.orcid', APP.authors.map(a => `<a href="https://orcid.org/${a.orcid}" target="_blank" rel="noopener noreferrer">${a.orcid}</a>`).join('<br>'));
    row('about.author.role', esc(t('about.author.roleText')));
    row('about.author.family', esc(t('about.author.familyText')));
    author.appendChild(dl);

    const lic = About.card(grid, 'aboutLicense', 'doc', 'about.license.title');
    lic.appendChild(mk('p', null, '<strong>' + esc(t('about.license.name')) + '</strong>'));
    lic.appendChild(mk('p', null, esc(t('about.license.text'))));
    lic.appendChild(mk('p', null, `<a href="${APP.assetBase}LICENSE" target="_blank" rel="noopener">${esc(t('about.license.link'))}</a>`));

    const cite = About.card(grid, 'aboutCite', 'quote', 'about.cite.title');
    cite.appendChild(mk('p', { id: 'aboutCiteText', class: 'about-cite' }, esc(Report.softwareCitation())));
    const pre = mk('pre', { class: 'about-bibtex', id: 'aboutBibtex', tabindex: '0', 'aria-label': t('about.cite.bibtex') });
    pre.textContent = About.bibtex();
    cite.appendChild(pre);
    const copy = mk('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'aboutCopy' }, esc(t('about.cite.copy')));
    copy.addEventListener('click', async () => {
      const text = Report.softwareCitation() + '\n\n' + About.bibtex();
      try { await navigator.clipboard.writeText(text); toast(t('about.cite.copied')); } catch (e) { toast(t('about.cite.copyFailed'), 'error'); }
    });
    cite.appendChild(copy);

    const third = About.card(grid, 'aboutThird', 'table', 'about.third.title');
    third.appendChild(mk('p', null, esc(t('about.third.text'))));
    const tbl = mk('table', { class: 'about-table' });
    tbl.appendChild(mk('thead', null, `<tr><th scope="col">${esc(t('about.third.component'))}</th><th scope="col">${esc(t('about.third.use'))}</th><th scope="col">${esc(t('about.third.license'))}</th></tr>`));
    const tbody = mk('tbody');
    ['spreadsheet', 'map', 'example'].forEach(k => tbody.appendChild(mk('tr', null, `<td><code>${esc(t('about.third.items.' + k + '.file'))}</code></td><td>${esc(t('about.third.items.' + k + '.use'))}</td><td>${esc(t('about.third.items.' + k + '.license'))}</td>`)));
    tbl.appendChild(tbody);
    const wrap = mk('div', { class: 'dt-scroll' });
    wrap.appendChild(tbl);
    third.appendChild(wrap);
    third.appendChild(mk('p', null, `<a href="${APP.assetBase}vendor/THIRD-PARTY-NOTICES.txt" target="_blank" rel="noopener">${esc(t('about.third.link'))}</a>`));
    third.appendChild(mk('p', { class: 'hint' }, esc(t('about.third.methods'))));

    host.appendChild(page);
  },
};

window.About = About;
