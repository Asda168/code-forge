// Explorer (virtualized lazy tree), file operations, global search, welcome screen.
(() => {
  const { S, $, h, base, dirOf, join, rel } = CF;
  const ROW = 22;
  const T = { expanded: new Set(), kids: new Map(), flat: [], sel: null, clip: null };
  CF.T = T;
  const ICONS = { php: '🐘', py: '🐍', js: '🟨', ts: '🔷', vue: '🟩', html: '🌐', css: '🎨', sql: '🛢', json: '{}', md: '📝', env: '🔑' };
  const icon = (n) => (n.dir ? (T.expanded.has(n.path) ? '📂' : '📁') : ICONS[n.name.split('.').pop().toLowerCase()] || '📄');

  async function load(dir) { T.kids.set(dir, await cf.fs.list(dir)); }
  function flatten() {
    const out = [];
    (function walk(dir, depth) {
      for (const n of T.kids.get(dir) || []) {
        out.push({ ...n, depth });
        if (n.dir && T.expanded.has(n.path)) walk(n.path, depth + 1);
      }
    })(S.root, 0);
    T.flat = out;
  }
  CF.refreshTree = CF.guard(async (dirs) => {
    if (!S.root) return;
    const targets = dirs || [S.root, ...T.expanded];
    for (const d of targets) { try { await load(d); } catch { T.expanded.delete(d); T.kids.delete(d); } }
    flatten(); paint();
  });

  function paint() {
    const tree = $('#tree'); if (!tree) return;
    const spacer = $('#tree-spacer'); spacer.style.height = T.flat.length * ROW + 'px';
    const top = Math.max(0, Math.floor(tree.scrollTop / ROW) - 5), n = Math.ceil(tree.clientHeight / ROW) + 10;
    spacer.innerHTML = '';
    T.flat.slice(top, top + n).forEach((node, i) => {
      const row = h('div', { class: 'row-n' + (T.sel === node.path ? ' sel' : '') + (T.clip && T.clip.cut && T.clip.path === node.path ? ' cut' : ''), style: `top:${(top + i) * ROW}px;padding-left:${6 + node.depth * 14}px`, draggable: 'true',
        onclick: () => select(node), oncontextmenu: (e) => { e.preventDefault(); T.sel = node.path; paint(); itemMenu(e, node); },
        ondragstart: (e) => e.dataTransfer.setData('text/cf-path', node.path),
        ondragover: (e) => { if (node.dir) e.preventDefault(); },
        ondrop: CF.guard(async (e) => { e.preventDefault(); const src = e.dataTransfer.getData('text/cf-path'); if (!src || !node.dir) return; await cf.fs.move(src, node.path); T.expanded.add(node.path); CF.refreshTree(); }),
      }, h('span', { class: 'arr' }, node.dir ? (T.expanded.has(node.path) ? '▼' : '▶') : ''), h('span', { class: 'ic' }, icon(node)), h('span', { class: 'nm' }, node.name));
      spacer.append(row);
    });
  }
  const select = CF.guard(async (node) => {
    T.sel = node.path;
    if (node.dir) { if (T.expanded.has(node.path)) T.expanded.delete(node.path); else { T.expanded.add(node.path); await load(node.path); } flatten(); paint(); }
    else { paint(); CF.openFile(node.path); }
  });
  const targetDir = () => { const sel = T.sel; if (!sel) return S.root; const n = T.flat.find((x) => x.path === sel); return n && !n.dir ? dirOf(sel) : sel; };

  CF.newFile = CF.guard(async (dir) => {
    dir = dir || targetDir();
    const v = await CF.ask('New File', [{ id: 'name', label: 'File name', placeholder: 'example.php' }], 'Create'); if (!v || !v.name) return;
    const p = await cf.fs.createFile(dir, v.name); T.expanded.add(dir); await CF.refreshTree([dir]); CF.openFile(p);
    CF.toast(`Created ${v.name} (${CF.langLabel(p)})`);
  });
  CF.newFolder = CF.guard(async (dir) => {
    dir = dir || targetDir();
    const v = await CF.ask('Create Folder', [{ id: 'name', label: 'Folder name', placeholder: 'services' }], 'Create'); if (!v || !v.name) return;
    await cf.fs.mkdir(dir, v.name); T.expanded.add(dir); CF.refreshTree([dir]);
  });
  const rename = CF.guard(async (node) => {
    const v = await CF.ask('Rename', [{ id: 'name', label: 'New name', value: node.name }], 'Rename'); if (!v || !v.name || v.name === node.name) return;
    const to = await cf.fs.rename(node.path, v.name);
    if (S.models.has(node.path)) { CF.closeAllEditors(); CF.toast('Closed open editors after rename'); } // models are keyed by path
    CF.refreshTree([dirOf(node.path)]); return to;
  });
  const del = CF.guard(async (node) => {
    if (await cf.fs.delete(node.path)) { S.groups.forEach((g) => g.tabs.filter((p) => p.startsWith(node.path)).forEach((p) => CF.closeTab(g, p, true))); CF.refreshTree([dirOf(node.path)]); }
  });
  const paste = CF.guard(async (dir) => {
    if (!T.clip) return;
    if (T.clip.cut) await cf.fs.move(T.clip.path, dir); else await cf.fs.copy(T.clip.path, dir);
    const srcDir = dirOf(T.clip.path); T.clip = null; T.expanded.add(dir); CF.refreshTree([...new Set([dir, srcDir])]);
  });
  function itemMenu(e, node) {
    const dir = node.dir ? node.path : dirOf(node.path);
    CF.menu(e, [
      ['New File', () => CF.newFile(dir)], ['New Folder', () => CF.newFolder(dir)], '-',
      ['Rename', () => rename(node)], ['Delete', () => del(node)], '-',
      ['Copy', () => { T.clip = { path: node.path, cut: false }; }], ['Cut (Move)', () => { T.clip = { path: node.path, cut: true }; paint(); }], ['Paste', () => paste(dir)],
      ['Duplicate', CF.guard(async () => { await cf.fs.copy(node.path, dirOf(node.path)); CF.refreshTree([dirOf(node.path)]); })], '-',
      ['Open in Terminal', () => CF.newTerminal(undefined, dir)], ['Open in Git Bash', () => CF.newTerminal('gitbash', dir)],
      ['Copy Path', () => navigator.clipboard.writeText(node.path)], ['Copy Relative Path', () => navigator.clipboard.writeText(rel(node.path))],
      ['Reveal in File Manager', () => cf.fs.reveal(node.path)], ['Refresh', () => CF.refreshTree()],
    ]);
  }

  CF.renderExplorer = (body) => {
    if (!S.root) { body.append(h('div', { class: 'pad muted' }, 'No folder opened.'), h('div', { class: 'pad' }, h('button', { class: 'btn', onclick: CF.openFolder }, 'Open Folder'))); return; }
    const head = h('div', { class: 'sec-head' }, h('span', {}, base(S.root)), h('span', { class: 'grow' }),
      ...[['＋📄', 'New File', () => CF.newFile()], ['＋📁', 'New Folder', () => CF.newFolder()], ['⟳', 'Refresh', () => CF.refreshTree()]].map(([t, ti, f]) => h('button', { class: 'icon-btn', title: ti, onclick: f }, t)));
    const tree = h('div', { id: 'tree', tabindex: '0', onscroll: paint, oncontextmenu: (e) => { if (e.target.id === 'tree' || e.target.id === 'tree-spacer') { e.preventDefault(); CF.menu(e, [['New File', () => CF.newFile(S.root)], ['New Folder', () => CF.newFolder(S.root)], ['Paste', () => paste(S.root)], ['Open in Terminal', () => CF.newTerminal(undefined, S.root)]]); } },
      onkeydown: (e) => { const n = T.flat.find((x) => x.path === T.sel); if (!n) return; if (e.key === 'F2') rename(n); if (e.key === 'Delete') del(n); if ((e.ctrlKey || e.metaKey) && e.key === 'c') T.clip = { path: n.path, cut: false }; if ((e.ctrlKey || e.metaKey) && e.key === 'v') paste(n.dir ? n.path : dirOf(n.path)); } },
      h('div', { id: 'tree-spacer' }));
    body.append(head, tree); new ResizeObserver(paint).observe(tree); CF.refreshTree();
  };
  new MutationObserver(() => {}).disconnect();

  // ---- open folder / welcome -----------------------------------------------------------
  CF.setRoot = CF.guard(async (root) => {
    CF.closeAllEditors(); S.root = root; T.expanded.clear(); T.kids.clear(); T.sel = null; $('#welcome').hidden = true;
    document.title = `${base(root)} — CodeForge`;
    CF.watchRoot && CF.watchRoot(); CF.showView('explorer'); CF.gitRefresh && CF.gitRefresh(); CF.detectProject && CF.detectProject();
    CF.newTerminal && !S.terms.length && CF.newTerminal();
  });
  CF.openFolder = CF.guard(async () => { const r = await cf.ws.openDialog(); if (r) CF.setRoot(r); });

  CF.renderWelcome = async () => {
    const w = $('#welcome'); w.hidden = false; w.innerHTML = '';
    const recents = await cf.ws.recents();
    w.append(h('div', { class: 'welcome-in' },
      h('img', { src: '../../assets/logo-dark.svg', width: 64 }), h('h1', {}, 'Code', h('span', {}, 'Forge')),
      h('div', { class: 'sub' }, 'Your development workspace.  ·  Code. Build. Run. Ship.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: CF.openFolder }, 'Open Folder'), h('button', { class: 'btn sec', onclick: () => CF.cloneDialog() }, 'Clone Repository'), h('button', { class: 'btn sec', onclick: () => CF.newProjectWizard() }, 'New Project')),
      h('h3', {}, 'Recent'), recents.length ? recents.map((r) => h('div', { class: 'recent', onclick: CF.guard(async () => CF.setRoot(await cf.ws.openRecent(r.path))) }, h('span', {}, r.name), h('small', {}, r.path))) : h('div', { class: 'muted' }, 'No recent projects yet.')));
  };

  // ---- global search ------------------------------------------------------------------------
  CF.renderSearch = (body) => {
    const o = { case: false, word: false, regex: false };
    const q = h('input', { placeholder: 'Search', onkeydown: (e) => e.key === 'Enter' && run() });
    const r = h('input', { placeholder: 'Replace' });
    const tog = (k, label, ti) => { const b = h('button', { class: 'btn sec sm', title: ti, onclick: () => { o[k] = !o[k]; b.style.outline = o[k] ? '1px solid var(--cyan)' : ''; } }, label); return b; };
    const res = h('div', { style: 'flex:1;overflow:auto' });
    let last = [];
    const run = CF.guard(async () => {
      if (!S.root) return CF.toast('Open a folder first', true);
      res.innerHTML = '<div class="pad muted">Searching…</div>';
      last = await cf.fs.search(S.root, q.value, o);
      res.innerHTML = ''; const by = {}; last.forEach((x) => (by[x.rel] = by[x.rel] || []).push(x));
      res.append(h('div', { class: 'pad muted' }, `${last.length}${last.length >= 2000 ? '+' : ''} results in ${Object.keys(by).length} files`));
      for (const [f, hits] of Object.entries(by)) {
        res.append(h('div', { class: 'file-h' }, f, ' ', h('span', { class: 'badge' }, hits.length)));
        hits.forEach((x) => res.append(h('div', { class: 'hit', onclick: () => CF.openFile(x.path, { line: x.line, col: x.col }) }, h('span', { class: 'muted' }, x.line + ': '), x.text.trim())));
      }
    });
    const replaceAll = CF.guard(async () => {
      const files = [...new Set(last.map((x) => x.path))];
      if (!files.length || !(await CF.confirm(`Replace "${q.value}" with "${r.value}" in ${files.length} files? This writes to disk.`, 'Replace All'))) return;
      for (const f of files) await cf.fs.replaceInFile(f, q.value, r.value, o);
      await CF.reloadOpenFiles(); CF.toast(`Replaced in ${files.length} files`); run();
    });
    body.append(h('div', { class: 'pad' }, q, r, h('div', { class: 'row' }, tog('case', 'Aa', 'Case sensitive'), tog('word', 'ab', 'Whole word'), tog('regex', '.*', 'Regex'),
      h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: run }, 'Search'), h('button', { class: 'btn sec sm', onclick: replaceAll }, 'Replace All'))), res);
    setTimeout(() => q.focus(), 0);
  };
})();
