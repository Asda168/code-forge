// Find in Files, VS Code / Antigravity style: toggle replace, match case / whole word / regex (Alt+C / Alt+W / Alt+R), search details
// (include / exclude globs), collapse all, list or tree results, refresh, clear and "open in a new Search Editor" tab.
// One component serves the sidebar view and search:// editor tabs. Ctrl+Shift+F seeds the query from the editor selection and searches.
(() => {
  const { S, $, h, base } = CF;
  const rdir = (p) => { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); };
  const fresh = (o = {}) => ({ q: '', r: '', o: { case: false, word: false, regex: false }, inc: '', exc: '', rep: false, det: false, tree: false, res: null, closed: new Set(), msg: '', err: false, api: null, ...o });
  const SR = fresh();                      // sidebar state: survives switching to other views
  const SE = new Map(); let seN = 0;       // search:// editor tabs, one state each
  let active = null;                       // api of the search UI that last had focus (target of Alt+C / Alt+W / Alt+R)
  const MAX = 2000;
  const cleanErr = (e) => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

  function build(host, st, big) {
    let seq = 0, timer = 0, keys = [];
    const dom = {};
    const key = (id) => { const k = CF.keyLabel(id); return k ? ` (${k})` : ''; };
    const abtn = (icon, title, fn) => h('button', { class: 'sv-b', title, 'aria-label': title, onclick: CF.guard(async () => fn()) }, CF.icon(icon, 15));
    const tgl = (k, icon, title, cmd) => {
      const b = h('button', { class: 'sv-t' + (st.o[k] ? ' on' : ''), title: title + key(cmd), 'aria-label': title, 'aria-pressed': String(!!st.o[k]), onclick: () => api.toggle(k) }, CF.icon(icon, 15));
      dom['t' + k] = b; return b;
    };

    // ---- running the search ------------------------------------------------------------------------------------------------
    const run = async () => {
      clearTimeout(timer);
      if (!S.root) { st.res = null; st.err = false; st.msg = 'Open a folder to search in it.'; return draw(); }
      if (!st.q) { st.res = null; st.err = false; st.msg = ''; return draw(); }
      const my = ++seq; st.err = false; st.msg = 'Searching…'; dom.sum.textContent = st.msg;
      try {
        const res = await cf.fs.search(S.root, st.q, { ...st.o, include: st.inc, exclude: st.exc });
        if (my !== seq) return;
        st.res = res; st.msg = ''; st.closed.clear();
      } catch (e) { if (my !== seq) return; st.res = null; st.err = true; st.msg = cleanErr(e); }
      draw(); if (big) CF.renderTabs();
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(run, 350); };      // search as you type

    // ---- replace ----------------------------------------------------------------------------------------------------------
    const ropts = () => ({ ...st.o });
    const afterReplace = async (n) => { await CF.reloadOpenFiles(); CF.toast(`Replaced in ${n} file${n === 1 ? '' : 's'}`); await run(); };
    const replaceAll = CF.guard(async () => {
      if (!st.q || !st.res || !st.res.length) return;
      const files = [...new Set(st.res.map((x) => x.path))];
      const more = st.res.length >= MAX ? ' (the result list is capped; search again afterwards to catch the rest)' : '';
      if (!(await CF.confirm(`Replace “${st.q}” with “${st.r}” in ${files.length} file(s)? This writes to disk.${more}`, 'Replace All'))) return;
      for (const f of files) await cf.fs.replaceInFile(f, st.q, st.r, ropts());
      await afterReplace(files.length);
    });
    const replaceFile = CF.guard(async (path) => { await cf.fs.replaceInFile(path, st.q, st.r, ropts()); await afterReplace(1); });
    const replaceLine = CF.guard(async (x) => { await cf.fs.replaceInFile(x.path, st.q, st.r, { ...ropts(), line: x.line }); await afterReplace(1); });
    const preview = (mid) => {                                  // what the match becomes (regex groups resolved on the matched text)
      if (!st.o.regex) return st.r;
      try { return mid.replace(new RegExp(st.o.word ? `\\b(?:${st.q})\\b` : st.q, st.o.case ? '' : 'i'), st.r); } catch { return st.r; }
    };

    // ---- results ------------------------------------------------------------------------------------------------------------
    const flip = (k, rerender = true) => { if (st.closed.has(k)) st.closed.delete(k); else st.closed.add(k); if (rerender) draw(); };
    const chev = (open) => h('span', { class: 'sv-chev' + (open ? ' open' : '') }, CF.icon('chevronRight', 12));
    const hitRow = (x, depth) => {
      const t = x.text, lead = t.length - t.trimStart().length, a = x.col - 1, b = a + x.len;
      const s0 = Math.max(lead, a - 24), rep = st.rep && st.q;
      return h('div', { class: 'sv-hit', style: `padding-left:${16 + depth * 12}px`, title: `${x.rel}:${x.line}:${x.col}`, onclick: () => CF.openFile(x.path, { line: x.line, col: x.col }) },
        h('span', { class: 'sv-txt' }, (s0 > lead ? '…' : '') + t.slice(s0, a), h('mark', { class: rep ? 'del' : '' }, t.slice(a, b)),
          rep ? h('mark', { class: 'ins' }, preview(t.slice(a, b))) : null, t.slice(b, b + 200)),
        rep ? h('button', { class: 'sv-b sm', title: 'Replace matches on this line', onclick: (e) => { e.stopPropagation(); replaceLine(x); } }, CF.icon('check', 13)) : null,
        h('span', { class: 'sv-ln' }, x.line));
    };
    const fileBlock = (rel, hits, depth, list) => {
      const k = 'f:' + rel, open = !st.closed.has(k); keys.push(k);
      const dismiss = () => { st.res = st.res.filter((x) => x.rel !== rel); draw(); };
      list.append(h('div', { class: 'sv-file', style: `padding-left:${4 + depth * 12}px`, title: rel, onclick: () => flip(k) },
        chev(open), h('span', { class: 'ic', html: CF.fileIconHtml(base(rel), false) }), h('span', { class: 'nm' }, base(rel)),
        st.tree ? null : h('small', { class: 'muted' }, rdir(rel)), h('span', { class: 'grow' }),
        h('span', { class: 'sv-acts' },
          st.rep ? h('button', { class: 'sv-b sm', title: 'Replace in this file', onclick: (e) => { e.stopPropagation(); replaceFile(hits[0].path); } }, CF.icon('check', 13)) : null,
          h('button', { class: 'sv-b sm', title: 'Dismiss', onclick: (e) => { e.stopPropagation(); dismiss(); } }, CF.icon('close', 13))),
        h('span', { class: 'badge' }, hits.length)));
      if (open) hits.forEach((x) => list.append(hitRow(x, depth + 1)));
    };
    const draw = () => {
      const list = dom.list; list.replaceChildren(); keys = [];
      dom.sum.className = 'sv-sum' + (st.err ? ' err' : '');
      if (st.msg) { dom.sum.textContent = st.msg; return; }
      if (!st.res) { dom.sum.textContent = ''; return; }
      const by = new Map(); st.res.forEach((x) => { if (!by.has(x.rel)) by.set(x.rel, []); by.get(x.rel).push(x); });
      const rels = [...by.keys()].sort((a, b) => a.localeCompare(b));
      const n = st.res.length;
      dom.sum.textContent = n ? `${n}${n >= MAX ? '+' : ''} result${n === 1 ? '' : 's'} in ${rels.length} file${rels.length === 1 ? '' : 's'}` : 'No results found. Review your search details (include / exclude) or try different options.';
      if (!st.tree) { rels.forEach((r) => fileBlock(r, by.get(r), 0, list)); return; }
      const root = { dirs: new Map(), files: [] };                  // tree view: nested folders, files inside
      rels.forEach((r) => { let node = root; rdir(r).split('/').filter(Boolean).forEach((seg) => { if (!node.dirs.has(seg)) node.dirs.set(seg, { dirs: new Map(), files: [] }); node = node.dirs.get(seg); }); node.files.push(r); });
      const count = (nd) => nd.files.reduce((s, r) => s + by.get(r).length, 0) + [...nd.dirs.values()].reduce((s, d) => s + count(d), 0);
      const walk = (nd, prefix, depth) => {
        [...nd.dirs.keys()].sort((a, b) => a.localeCompare(b)).forEach((name) => {
          const d = nd.dirs.get(name), path = prefix ? prefix + '/' + name : name, k = 'd:' + path, open = !st.closed.has(k); keys.push(k);
          list.append(h('div', { class: 'sv-file', style: `padding-left:${4 + depth * 12}px`, title: path, onclick: () => flip(k) },
            chev(open), h('span', { class: 'ic', html: CF.fileIconHtml(name, true, open) }), h('span', { class: 'nm' }, name), h('span', { class: 'grow' }), h('span', { class: 'badge' }, count(d))));
          if (open) walk(d, path, depth + 1);
        });
        nd.files.forEach((r) => fileBlock(r, by.get(r), depth, list));
      };
      walk(root, '', 0);
    };

    // ---- inputs ---------------------------------------------------------------------------------------------------------------
    const q = h('input', { class: 'sv-in', placeholder: 'Search', value: st.q, spellcheck: 'false', 'aria-label': 'Search', oninput: (e) => { st.q = e.target.value; later(); },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } } });
    const r = h('input', { class: 'sv-in', placeholder: 'Replace', value: st.r, spellcheck: 'false', 'aria-label': 'Replace',
      oninput: (e) => { st.r = e.target.value; if (st.res && st.rep) draw(); },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); replaceAll(); } } });
    const inc = h('input', { class: 'sv-in', placeholder: 'e.g. *.ts, src/**/include', value: st.inc, spellcheck: 'false', 'aria-label': 'Files to include', oninput: (e) => { st.inc = e.target.value; later(); } });
    const exc = h('input', { class: 'sv-in', placeholder: 'e.g. *.min.js, dist', value: st.exc, spellcheck: 'false', 'aria-label': 'Files to exclude', oninput: (e) => { st.exc = e.target.value; later(); } });
    dom.q = q; dom.r = r;
    dom.sum = h('div', { class: 'sv-sum', role: 'status', 'aria-live': 'polite' });
    dom.list = h('div', { class: 'sv-list' });
    dom.repRow = h('div', { class: 'sv-field', hidden: !st.rep }, r, h('button', { class: 'sv-t', title: 'Replace All' + key('search-replace-all'), 'aria-label': 'Replace All', onclick: replaceAll }, CF.icon('check', 15)));
    dom.det = h('div', { class: 'sv-det', hidden: !st.det }, h('label', {}, 'files to include', inc), h('label', {}, 'files to exclude', exc));
    dom.exp = h('button', { class: 'sv-exp' + (st.rep ? ' open' : ''), title: 'Toggle Replace' + key('search-replace'), 'aria-label': 'Toggle Replace', 'aria-expanded': String(!!st.rep), onclick: () => api.toggle('replace') }, CF.icon('chevronRight', 14));
    dom.detBtn = h('button', { class: 'sv-det-b' + (st.det ? ' on' : ''), title: 'Toggle Search Details' + key('search-toggle-details'), 'aria-label': 'Toggle Search Details', 'aria-expanded': String(!!st.det), onclick: () => api.toggle('details') }, CF.icon('more', 15));

    dom.treeBtn = abtn(st.tree ? 'listView' : 'treeView', st.tree ? 'View as List' : 'View as Tree', () => api.toggle('tree'));
    dom.colBtn = abtn('collapse', 'Collapse All', () => api.collapse());
    const bar = h('div', { class: 'sv-bar' }, h('span', { class: 'sv-title' }, big ? 'Search Editor' : ''), h('span', { class: 'grow' }),
      abtn('refresh', 'Refresh', () => run()),
      abtn('clearTerm', 'Clear Search Results', () => { st.q = ''; st.r = ''; st.res = null; st.msg = ''; q.value = ''; r.value = ''; draw(); q.focus(); }),
      big ? null : abtn('newSearch', 'Open New Search Editor' + key('search-new-editor'), () => CF.newSearchEditor()),
      dom.colBtn, dom.treeBtn);

    const api = st.api = {
      focus(which) { const el = which === 'r' && st.rep ? r : q; el.focus(); el.select(); },
      run,
      toggle(k) {
        if (k === 'case' || k === 'word' || k === 'regex') { st.o[k] = !st.o[k]; dom['t' + k].classList.toggle('on', st.o[k]); dom['t' + k].setAttribute('aria-pressed', String(st.o[k])); run(); return; }
        if (k === 'replace') { st.rep = !st.rep; dom.repRow.hidden = !st.rep; dom.exp.classList.toggle('open', st.rep); dom.exp.setAttribute('aria-expanded', String(st.rep)); draw(); if (st.rep) r.focus(); else q.focus(); return; }
        if (k === 'details') { st.det = !st.det; dom.det.hidden = !st.det; dom.detBtn.classList.toggle('on', st.det); dom.detBtn.setAttribute('aria-expanded', String(st.det)); if (st.det) inc.focus(); return; }
        if (k === 'tree') { st.tree = !st.tree; dom.treeBtn.replaceChildren(CF.icon(st.tree ? 'listView' : 'treeView', 15)); dom.treeBtn.title = st.tree ? 'View as List' : 'View as Tree'; st.closed.clear(); draw(); }
      },
      collapse() { if (st.closed.size < keys.length) keys.forEach((k) => st.closed.add(k)); else st.closed.clear(); draw(); },
    };
    const rootEl = h('div', { class: 'sv' + (big ? ' big' : ''), onfocusin: () => { active = api; } }, bar,
      h('div', { class: 'sv-form' }, dom.exp,
        h('div', { class: 'sv-fields' }, h('div', { class: 'sv-field' }, q, tgl('case', 'caseSens', 'Match Case', 'search-toggle-case'), tgl('word', 'word', 'Match Whole Word', 'search-toggle-word'), tgl('regex', 'regex', 'Use Regular Expression', 'search-toggle-regex')), dom.repRow)),
      h('div', { class: 'sv-detrow' }, dom.detBtn), dom.det, dom.sum, dom.list);
    api.el = rootEl; host.replaceChildren(rootEl);
    draw();
    return api;
  }

  // ---- sidebar view -----------------------------------------------------------------------------------------------------
  CF.renderSearch = (body) => { build(body, SR, false); };

  const selectedText = () => {
    try {
      const g = CF.activeGroup(), ed = g && g.editor, m = ed && ed.getModel && ed.getModel();
      if (!ed || !m || CF.isPage(g.active)) return '';
      const sel = ed.getSelection();
      let t = sel && !sel.isEmpty() ? m.getValueInRange(sel) : '';
      if (!t) { const w = m.getWordAtPosition(ed.getPosition()); t = w ? w.word : ''; }
      return t.split(/\r?\n/)[0].trim().slice(0, 200);
    } catch { return ''; }
  };
  // Ctrl+Shift+F: open the Search view, seed the query from the selection (or the word at the cursor) and search straight away.
  CF.findInFiles = CF.guard(async (opt = {}) => {
    const seed = selectedText();
    if (seed) SR.q = seed;
    if (opt.replace) SR.rep = true;
    await CF.showView('search');
    if (!SR.api) return;
    SR.api.focus(opt.replace && SR.q ? 'r' : 'q');
    if (seed) SR.api.run();
  });
  CF.searchToggle = CF.guard(async (k) => {
    let a = active && document.body.contains(active.el) ? active : null;
    if (!a) { await CF.findInFiles(); a = SR.api; }
    a && a.toggle(k);
  });

  // ---- Search Editor: the same UI in an editor tab, results kept while other tabs are used ---------------------------
  CF.newSearchEditor = CF.guard(async () => {
    const id = 'search://' + (++seN);
    SE.set(id, fresh({ q: SR.q, r: SR.r, o: { ...SR.o }, inc: SR.inc, exc: SR.exc, rep: SR.rep, det: SR.det || !!(SR.inc || SR.exc), tree: SR.tree, res: SR.res }));
    await CF.openFile(id);
  });
  CF.pages.search = {
    icon: 'search',
    title: (p) => { const st = SE.get(p); return st && st.q ? 'Search: ' + st.q : 'Search Editor'; },
    render: (g) => {
      let st = SE.get(g.active); if (!st) SE.set(g.active, st = fresh());
      const host = h('div', { class: 'svpage' });
      const api = build(host, st, true);
      g.page.replaceChildren(host);
      if (!st.q) api.focus('q');
    },
  };
})();
