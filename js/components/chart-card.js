/* SciMetricsPro — ChartCard: the common container of every figure.
   Title, help (?), quick export (PNG at 300 dpi, SVG and PDF at the chosen print width) and the figure data as a
   spreadsheet; the editor and the full export bar come from Fig.mount.

   const cc = ChartCard.create({
     id, title, subtitle, help (HelpPopover spec),
     render(cfg) → <svg>, controls, defaults, width, height, fileName, minLayout (narrowest print layout),
     data: { columns, rows } | () => ({ columns, rows }),
   })
   cc.el · cc.fig (Fig API, null when there are no data) · cc.redraw() · cc.dataMatrix() */
'use strict';

const ChartCard = {
  create(o) {
    const card = mk('section', { class: 'card chart-card', id: o.id ? o.id + 'Card' : null });
    const head = mk('header', { class: 'chart-head' });
    const titles = mk('div', { class: 'chart-titles' });
    const h = mk('h3', { class: 'chart-title' }, esc(o.title || ''));
    if (o.help) h.appendChild(HelpPopover.button(o.help, { label: t('chart.help') + ': ' + (o.title || '') }));
    titles.appendChild(h);
    if (o.subtitle) titles.appendChild(mk('p', { class: 'chart-sub' }, esc(o.subtitle)));
    head.appendChild(titles);
    const actions = mk('div', { class: 'chart-actions' });
    const bPng = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: t('chart.pngTitle') }, icon('image') + '<span>' + esc(t('chart.png')) + '</span>');
    const bSvg = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: t('chart.svgTitle') }, icon('download') + '<span>' + esc(t('chart.svg')) + '</span>');
    const bPdf = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: t('chart.pdfTitle') }, icon('download') + '<span>' + esc(t('chart.pdf')) + '</span>');
    const bDat = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: t('chart.dataTitle') }, icon('table') + '<span>' + esc(t('chart.data')) + '</span>');
    actions.appendChild(bPng); actions.appendChild(bSvg); actions.appendChild(bPdf); actions.appendChild(bDat);
    head.appendChild(actions);
    card.appendChild(head);

    const body = mk('div', { class: 'chart-body', id: o.id || null });
    card.appendChild(body);

    const getData = () => (typeof o.data === 'function' ? o.data() : o.data) || null;
    const data = getData();
    const empty = !o.render || (data && Array.isArray(data.rows) && data.rows.length === 0);
    const fileName = o.fileName || slug(o.title || 'figure');
    let fig = null;
    if (empty) {
      body.appendChild(mk('p', { class: 'chart-empty' }, esc(t('chart.noData'))));
      bPng.disabled = bSvg.disabled = bPdf.disabled = bDat.disabled = true;
    } else {
      fig = Fig.mount(body, {
        title: o.title, bare: true, render: o.render, controls: o.controls, defaults: o.defaults,
        width: o.width, height: o.height, fileName, minLayout: o.minLayout,
      });
      if (!data) bDat.disabled = true;
      if (window.ExportCollector && ExportCollector.active) ExportCollector.addFigure({ id: o.id || '', title: o.title || '', file: fileName, fig, data: getData });
    }

    const guard = fn => async () => {
      try { await fn(); } catch (e) { toast(t('chart.exportError', { msg: e.message }), 'error'); }
    };
    /* quick export at the size, text and colours chosen in the export bar (17 cm, 8 pt and 300 dpi by default) */
    bPng.addEventListener('click', guard(() => fig.exportPrint('png')));
    bSvg.addEventListener('click', guard(() => fig.exportPrint('svg')));
    bPdf.addEventListener('click', guard(() => fig.exportPrint('pdf')));
    bDat.addEventListener('click', guard(() => {
      const d = getData();
      Exporter.xlsx([{ name: t('chart.sheet'), columns: d.columns, rows: d.rows }], fileName + '_' + slug(t('chart.data')));
    }));

    return {
      el: card,
      fig,
      redraw() { if (fig) fig.redraw(); },
      dataMatrix() { const d = getData(); return d ? Exporter.matrix(d.columns, d.rows) : null; },
    };
  },

  mount(host, o) {
    host = hostOf(host);
    const cc = ChartCard.create(o);
    host.appendChild(cc.el);
    return cc;
  },
};

window.ChartCard = ChartCard;
