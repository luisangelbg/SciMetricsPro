/* SciMetricsPro — DataTable: sort, search, paginate and export.
   const dt = DataTable.create({
     columns: [{ key, label, type: 'text'|'num'|'int'|'pct'|'year', get(row), fmt(value,row),
                 html(value,row) (trusted HTML), sortValue(row), exportValue(value,row),
                 cls: extra CSS class for the column (col-wide, col-mid, col-nowrap),
                 clamp: true → long text cut at three lines, full text on hover }],
     rows, pageSize: 25, pageSizes: [10, 25, 50, 100], fileName, title, search: true,
     sort: { key, dir: 'asc'|'desc' },
   })
   dt.el · dt.setRows(rows) · dt.view() → rows after search and sort (every page)
   dt.sortBy(key, dir) · dt.search(text) · dt.page(n) · dt.exportMatrix() */
'use strict';

const DataTable = {
  create(o) {
    const columns = o.columns;
    const st = {
      rows: [], index: [], query: '', sortKey: o.sort ? o.sort.key : null, sortDir: o.sort ? o.sort.dir : 'asc',
      page: 0, pageSize: o.pageSize || 25, view: [],
    };
    /* the size in use is always one of the choices (a table asking for 15 rows adds 15 to the list) */
    const pageSizes = (o.pageSizes || [10, 25, 50, 100]).includes(st.pageSize)
      ? (o.pageSizes || [10, 25, 50, 100])
      : (o.pageSizes || [10, 25, 50, 100]).concat([st.pageSize]).sort((a, b) => a - b);
    /* 'year' sorts as a number but is shown without thousands separators */
    const numeric = c => c.type === 'num' || c.type === 'int' || c.type === 'pct' || c.type === 'year';
    const value = (c, r, i) => (c.get ? c.get(r, i) : (Array.isArray(r) ? r[columns.indexOf(c)] : r[c.key]));
    const display = (c, r, i) => {
      const v = value(c, r, i);
      if (c.fmt) return c.fmt(v, r);
      if (v == null || v === '') return '—';
      if (c.type === 'int') return fmtInt(v);
      if (c.type === 'pct') return fmtPct(v);
      if (c.type === 'num') return fmtNum(v);
      return Array.isArray(v) ? v.join('; ') : String(v);
    };

    const root = mk('div', { class: 'data-table' });
    /* toolbar */
    const bar = mk('div', { class: 'dt-bar' });
    let input = null;
    if (o.search !== false) {
      const wrap = mk('label', { class: 'dt-search' });
      wrap.innerHTML = icon('search');
      input = mk('input', { type: 'search', placeholder: t('table.searchPlaceholder'), 'aria-label': t('table.search') });
      let timer = null;
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => api.search(input.value), 120); });
      wrap.appendChild(input);
      bar.appendChild(wrap);
    }
    const count = mk('span', { class: 'dt-count', 'aria-live': 'polite' });
    bar.appendChild(count);
    const exp = mk('div', { class: 'dt-export' });
    const bX = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: t('table.exportXlsxTitle') }, icon('table') + '<span>' + esc(t('table.exportXlsx')) + '</span>');
    const bC = mk('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: t('table.exportCsvTitle') }, icon('download') + '<span>' + esc(t('table.exportCsv')) + '</span>');
    bX.addEventListener('click', () => Exporter.xlsx([{ name: o.title || t('table.sheet'), columns: exportColumns(), rows: st.view }], o.fileName || o.title || 'table'));
    bC.addEventListener('click', () => Exporter.csv(exportColumns(), st.view, o.fileName || o.title || 'table'));
    exp.appendChild(bX); exp.appendChild(bC);
    bar.appendChild(exp);
    root.appendChild(bar);

    /* table */
    const scroller = mk('div', { class: 'dt-scroll' });
    const table = mk('table', { class: 'dt-table' });
    if (o.title) table.appendChild(mk('caption', { class: 'sr-only' }, esc(o.title)));
    const thead = mk('thead'), trh = mk('tr');
    const heads = columns.map(c => {
      const th = mk('th', { scope: 'col', class: [numeric(c) ? 'num' : '', c.cls || ''].join(' ').trim() || null, 'aria-sort': 'none' });
      const b = mk('button', { type: 'button', class: 'dt-sort', title: t('table.sortBy', { col: c.label || c.key }) },
        '<span>' + esc(c.label || c.key) + '</span><span class="dt-arrow" aria-hidden="true"></span>');
      b.addEventListener('click', () => {
        const dir = st.sortKey === c.key ? (st.sortDir === 'asc' ? 'desc' : 'asc') : (numeric(c) ? 'desc' : 'asc');
        api.sortBy(c.key, dir);
      });
      th.appendChild(b);
      trh.appendChild(th);
      return th;
    });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = mk('tbody');
    table.appendChild(tbody);
    scroller.appendChild(table);
    root.appendChild(scroller);
    const emptyMsg = mk('p', { class: 'dt-empty', hidden: true });
    root.appendChild(emptyMsg);

    /* pager */
    const pager = mk('div', { class: 'dt-pager' });
    const sizeLab = mk('label', { class: 'dt-size' }, '<span>' + esc(t('table.perPage')) + '</span>');
    const sizeSel = mk('select');
    pageSizes.forEach(n => sizeSel.appendChild(mk('option', { value: n }, String(n))));
    sizeSel.value = String(st.pageSize);
    sizeSel.addEventListener('change', () => { st.pageSize = +sizeSel.value; st.page = 0; render(); });
    sizeLab.appendChild(sizeSel);
    pager.appendChild(sizeLab);
    const nav = mk('div', { class: 'dt-nav' });
    const pBtn = (label, sym, fn) => { const b = mk('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label }, sym); b.addEventListener('click', fn); nav.appendChild(b); return b; };
    const bFirst = pBtn(t('table.first'), '«', () => api.page(0));
    const bPrev = pBtn(t('table.prev'), '‹', () => api.page(st.page - 1));
    const pageInfo = mk('span', { class: 'dt-page' });
    nav.appendChild(pageInfo);
    const bNext = pBtn(t('table.next'), '›', () => api.page(st.page + 1));
    const bLast = pBtn(t('table.last'), '»', () => api.page(Infinity));
    pager.appendChild(nav);
    root.appendChild(pager);

    function exportColumns() {
      return columns.map(c => ({
        key: c.key, label: c.label || c.key,
        get: (r) => { const v = value(c, r); return c.exportValue ? c.exportValue(v, r) : v; },
      }));
    }

    function searchText(r, i) {
      return fold(columns.map(c => {
        const v = value(c, r, i);
        return v == null ? '' : (Array.isArray(v) ? v.join(' ') : String(v)) + ' ' + display(c, r, i);
      }).join('  '));
    }

    function compute() {
      let idx = st.rows.map((r, i) => i);
      const q = fold(st.query).trim();
      if (q) {
        const terms = q.split(/\s+/);
        idx = idx.filter(i => {
          if (st.index[i] == null) st.index[i] = searchText(st.rows[i], i);
          return terms.every(term => st.index[i].includes(term));
        });
      }
      const c = columns.find(x => x.key === st.sortKey);
      if (c) {
        const coll = new Intl.Collator(locale(), { numeric: true, sensitivity: 'base' });
        const sign = st.sortDir === 'desc' ? -1 : 1;
        const keyed = idx.map(i => ({ i, v: c.sortValue ? c.sortValue(st.rows[i]) : value(c, st.rows[i], i) }));
        const empty = v => v == null || v === '' || (typeof v === 'number' && isNaN(v));
        keyed.sort((a, b) => {
          const ea = empty(a.v), eb = empty(b.v);
          if (ea || eb) return ea === eb ? a.i - b.i : (ea ? 1 : -1);   /* blanks always last */
          let d;
          if (numeric(c) || (typeof a.v === 'number' && typeof b.v === 'number')) d = (+a.v) - (+b.v);
          else d = coll.compare(Array.isArray(a.v) ? a.v.join('; ') : String(a.v), Array.isArray(b.v) ? b.v.join('; ') : String(b.v));
          return d !== 0 ? sign * d : a.i - b.i;
        });
        idx = keyed.map(k => k.i);
      }
      st.view = idx.map(i => st.rows[i]);
    }

    function render() {
      const total = st.view.length;
      const pages = Math.max(1, Math.ceil(total / st.pageSize));
      st.page = Math.max(0, Math.min(st.page, pages - 1));
      const from = st.page * st.pageSize;
      const slice = st.view.slice(from, from + st.pageSize);
      tbody.innerHTML = '';
      const frag = document.createDocumentFragment();
      slice.forEach((r, k) => {
        const tr = mk('tr');
        columns.forEach(c => {
          const td = mk('td', { class: [numeric(c) ? 'num' : '', c.cls || ''].join(' ').trim() || null });
          if (c.html) td.innerHTML = c.html(value(c, r, from + k), r);
          else if (c.clamp) {
            const text = display(c, r, from + k);
            td.appendChild(mk('div', { class: 'clamp', title: text.length > 90 ? text : null })).textContent = text;
          } else td.textContent = display(c, r, from + k);
          tr.appendChild(td);
        });
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
      heads.forEach((th, j) => {
        const c = columns[j];
        const s = st.sortKey === c.key ? (st.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
        th.setAttribute('aria-sort', s);
        th.classList.toggle('sorted', s !== 'none');
        th.querySelector('.dt-arrow').textContent = s === 'ascending' ? '▲' : s === 'descending' ? '▼' : '';
      });
      const none = total === 0;
      emptyMsg.hidden = !none;
      emptyMsg.textContent = st.rows.length === 0 ? t('table.empty') : t('table.noMatch');
      scroller.hidden = none;
      count.textContent = none ? '' : t(total < st.rows.length ? 'table.rangeFiltered' : 'table.range', {
        from: fmtInt(from + 1), to: fmtInt(Math.min(total, from + st.pageSize)), total: fmtInt(total), all: fmtInt(st.rows.length),
      });
      pageInfo.textContent = t('table.page', { page: fmtInt(st.page + 1), pages: fmtInt(pages) });
      bFirst.disabled = bPrev.disabled = st.page === 0;
      bNext.disabled = bLast.disabled = st.page >= pages - 1;
      pager.hidden = none;
      bX.disabled = bC.disabled = none;
    }

    const api = {
      el: root,
      setRows(rows) { st.rows = rows || []; st.index = []; st.page = 0; compute(); render(); return api; },
      sortBy(key, dir) { st.sortKey = key; st.sortDir = dir === 'desc' ? 'desc' : 'asc'; st.page = 0; compute(); render(); return api; },
      search(text) { st.query = text || ''; if (input && input.value !== st.query) input.value = st.query; st.page = 0; compute(); render(); return api; },
      page(n) { st.page = n === Infinity ? Number.MAX_SAFE_INTEGER : n; render(); return api; },
      view() { return st.view.slice(); },
      pageRows() { return st.view.slice(st.page * st.pageSize, st.page * st.pageSize + st.pageSize); },
      state() { return { query: st.query, sortKey: st.sortKey, sortDir: st.sortDir, page: st.page, pageSize: st.pageSize, total: st.view.length }; },
      exportMatrix() { return Exporter.matrix(exportColumns(), st.view); },
    };
    api.setRows(o.rows || []);
    if (window.ExportCollector && ExportCollector.active && o.title) ExportCollector.addTable({
      title: o.title, file: o.fileName || o.title, columns: exportColumns(), rows: () => st.view, el: root,
      /* the cells as they are shown (formatted in the active language), for the report */
      cells: () => ({ head: columns.map(c => c.label || c.key), numeric: columns.map(numeric), rows: st.view.map((r, i) => columns.map(c => display(c, r, i))) }),
    });
    return api;
  },

  mount(host, o) {
    host = hostOf(host);
    const dt = DataTable.create(o);
    host.innerHTML = '';
    host.appendChild(dt.el);
    return dt;
  },
};

window.DataTable = DataTable;
