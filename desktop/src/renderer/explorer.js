// Explorer (virtualized lazy tree), file operations, welcome screen. Find in Files lives in search.js.
(() => {
  const { S, $, h, base, dirOf, join, rel } = CF;
  const ROW = 22;
  const T = { expanded: new Set(), kids: new Map(), flat: [], sel: null, clip: null };
  CF.T = T;
  const icon = (n) => CF.fileIconHtml(n.name, n.dir, n.dir && T.expanded.has(n.path));

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
      }, h('span', { class: 'arr', html: node.dir ? CF.iconHtml(T.expanded.has(node.path) ? 'chevronDown' : 'chevronRight', 12) : '' }), h('span', { class: 'ic', html: icon(node) }), h('span', { class: 'nm' }, node.name));
      spacer.append(row);
    });
  }
  const select = CF.guard(async (node) => {
    T.sel = node.path;
    if (node.dir) { if (T.expanded.has(node.path)) T.expanded.delete(node.path); else { T.expanded.add(node.path); await load(node.path); } flatten(); paint(); }
    else { paint(); CF.openFile(node.path); }
  });
  // Highlight the active editor file in the tree: expand its folders, select it and scroll it into view.
  // Paths mix "/" (root, editor) and backslash (fs.list), so walk the tree level by level matching normalized paths.
  const norm = (p) => p.split('\\').join('/').toLowerCase();
  let lastRevealed = null;
  CF.revealInTree = CF.guard(async (path, force) => {
    if (!path || !S.root || !norm(path).startsWith(norm(S.root) + '/') || (!force && path === lastRevealed)) return;
    lastRevealed = path;
    const target = norm(path); let dir = S.root, real = null;
    while (true) {
      if (!T.kids.has(dir)) { try { await load(dir); } catch { return; } }
      const hit = (T.kids.get(dir) || []).find((k) => { const n = norm(k.path); return n === target || (k.dir && target.startsWith(n + '/')); });
      if (!hit) return;
      if (norm(hit.path) === target) { real = hit.path; break; }
      T.expanded.add(hit.path); dir = hit.path;
    }
    T.sel = real; flatten();
    const i = T.flat.findIndex((x) => x.path === real), tree = $('#tree');
    if (i >= 0 && tree) { const y = i * ROW; if (y < tree.scrollTop || y + ROW > tree.scrollTop + tree.clientHeight) tree.scrollTop = Math.max(0, y - tree.clientHeight / 2); }
    paint();
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
  // Rename keeps editors open: unsaved edits are saved first, then every tab on the old path (or inside a renamed folder) is re-opened on the new path in the same group.
  const rename = CF.guard(async (node) => {
    const v = await CF.ask('Rename', [{ id: 'name', label: 'New name', value: node.name }], 'Rename'); if (!v || !v.name || v.name === node.name) return;
    const inside = (p) => p === node.path || p.startsWith(node.path + '/') || p.startsWith(node.path + '\\');
    for (const p of [...S.models.keys()].filter(inside)) if (S.models.get(p).dirty) await CF.save(p);
    const to = (await cf.fs.rename(node.path, v.name)).split('\\').join('/');     // tabs use forward slashes
    const moved = S.groups.map((g) => ({ g, tabs: g.tabs.filter(inside), active: g.active && inside(g.active) ? g.active : null }));
    for (const { g, tabs } of moved) for (const p of tabs) await CF.closeTab(g, p, true);
    for (const { g, tabs, active } of moved) {
      for (const p of tabs) if (p !== active) await CF.openFile(to + p.slice(node.path.length), { group: g }).catch(() => {});
      if (active) await CF.openFile(to + active.slice(node.path.length), { group: g }).catch(() => {});
    }
    CF.refreshTree([dirOf(node.path)]); CF.toast(`Renamed to ${v.name}`); return to;
  });
  // F2: the selected Explorer item when the tree has focus, otherwise the file open in the active editor.
  CF.renameCurrent = CF.guard(async () => {
    const tree = document.getElementById('tree'), n = tree && tree.contains(document.activeElement) ? T.flat.find((x) => x.path === T.sel) : null;
    if (n) return rename(n);
    const g = CF.activeGroup && CF.activeGroup(), p = g && g.active;
    if (!p || CF.isPage(p)) return CF.toast('Select a file to rename');
    return rename({ path: p, name: base(p), dir: false });
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
      ['Copy Path', () => cf.clip.write(node.path)], ['Copy Relative Path', () => cf.clip.write(rel(node.path))],
      ['Reveal in File Manager', () => cf.fs.reveal(node.path)], ['Refresh', () => CF.refreshTree()],
    ]);
  }

  CF.renderExplorer = (body) => {
    if (!S.root) {
      body.append(h('div', { class: 'pad muted' }, 'You have not yet opened a folder.'),
        h('div', { class: 'pad' }, h('button', { class: 'btn', style: 'width:100%', onclick: CF.openFolder }, 'Open Folder')),
        h('div', { class: 'pad' }, h('button', { class: 'btn sec', style: 'width:100%', onclick: () => CF.cloneDialog() }, 'Clone Repository')),
        h('div', { class: 'pad muted' }, 'Tip: click the Explorer icon or press Ctrl+B to show/hide this sidebar.'));
      return;
    }
    const head = h('div', { class: 'sec-head' }, h('span', {}, base(S.root)), h('span', { class: 'grow' }),
      ...[['newFile', 'New File', () => CF.newFile()], ['newFolder', 'New Folder', () => CF.newFolder()], ['refresh', 'Refresh', () => CF.refreshTree()], ['collapse', 'Collapse All', () => { T.expanded.clear(); CF.refreshTree(); }]].map(([t, ti, f]) => h('button', { class: 'icon-btn', title: ti, onclick: f }, CF.icon(t, 15))));
    const tree = h('div', { id: 'tree', tabindex: '0', onscroll: paint, oncontextmenu: (e) => { if (e.target.id === 'tree' || e.target.id === 'tree-spacer') { e.preventDefault(); CF.menu(e, [['New File', () => CF.newFile(S.root)], ['New Folder', () => CF.newFolder(S.root)], ['Paste', () => paste(S.root)], ['Open in Terminal', () => CF.newTerminal(undefined, S.root)]]); } },
      onkeydown: (e) => { const n = T.flat.find((x) => x.path === T.sel); if (!n) return; if (e.key === 'Delete') del(n); if ((e.ctrlKey || e.metaKey) && e.key === 'c') T.clip = { path: n.path, cut: false }; if ((e.ctrlKey || e.metaKey) && e.key === 'v') paste(n.dir ? n.path : dirOf(n.path)); } },
      h('div', { id: 'tree-spacer' }));
    body.append(head, tree); new ResizeObserver(paint).observe(tree); CF.refreshTree();
  };
  new MutationObserver(() => {}).disconnect();

  // ---- open folder / welcome -----------------------------------------------------------
  CF.setRoot = CF.guard(async (root) => {
    const norm = (p) => p.split('\\').join('/').toLowerCase(); const switched = !!S.root && norm(S.root) !== norm(root);
    if (switched && CF.closeAllTerminals) CF.closeAllTerminals();   // terminals belong to the project they were opened in
    CF.closeAllEditors(); S.root = root; T.expanded.clear(); T.kids.clear(); T.sel = null; $('#welcome').hidden = true;
    document.title = `${base(root)} — Asta IDE`; { const sp = $('#sb-project'); sp.textContent = base(root); sp.title = root; sp.hidden = false; }
    CF.watchRoot && CF.watchRoot(); CF.showView('explorer'); CF.gitRefresh && CF.gitRefresh(); CF.detectProject && CF.detectProject();
    CF.newTerminal && !S.terms.length && CF.newTerminal(undefined, root);   // new project -> fresh terminal opened in the new folder
  });
  CF.openFolder = CF.guard(async () => { const r = await cf.ws.openDialog(); if (r) CF.setRoot(r); });

  // Welcome / start page: start actions + searchable recent projects (pin, remove, missing-folder state, keyboard navigation).
  const ago = (t) => { if (!t) return ''; const m = Math.floor((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`; const hr = Math.floor(m / 60); if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`; const d = Math.floor(hr / 24); return d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : new Date(t).toLocaleDateString(); };
  const shortPath = (p) => (p.length <= 54 ? p : p.slice(0, 20) + '…' + p.slice(-32));
  CF.renderWelcome = async () => {
    const w = $('#welcome'); w.hidden = false; w.innerHTML = ''; w.classList.add('wl-mini');
    let recents = []; try { recents = await cf.ws.recents(); } catch { /* history unreadable: show the empty state */ }
    let busy = false;
    const sorted = () => recents.slice().sort((x, y) => (y.pinned - x.pinned) || (y.at - x.at));
    const open = async (r, row) => {
      if (busy) return;
      if (r.missing) return CF.toast('This folder no longer exists. Remove it from the list.', true);
      busy = true; row && row.classList.add('loading');
      try { closeAll(); w.classList.remove('wl-mini'); home.remove(); await CF.setRoot(await cf.ws.openRecent(r.path)); }
      catch (e) { CF.toast('Could not open project: ' + String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true); busy = false; w.classList.add('wl-mini'); row && row.classList.remove('loading'); }
    };
    const refresh = async () => { recents = await cf.ws.recents(); drawHome(); if (all) drawAll(); };
    const pin = CF.guard(async (r) => { await cf.ws.recentPin(r.path); await refresh(); });
    const remove = CF.guard(async (r) => { await cf.ws.recentRemove(r.path); await refresh(); });
    const menu = (e, r, row) => CF.menu(e, [['Open', () => open(r, row)], ['Open in New Window', CF.guard(async () => { if (r.missing) return CF.toast('This folder no longer exists', true); await cf.win.new(r.path); })], '-',
      [r.pinned ? 'Unpin' : 'Pin', () => pin(r)], ['Copy Path', CF.guard(async () => { await cf.clip.write(r.path); CF.toast('Path copied'); })], ...(r.missing ? [] : [['Reveal in File Manager', () => cf.fs.reveal(r.path)]]), '-', ['Remove from Recent', () => remove(r)]]);
    const ibtn = (icon, title, fn, cls = '') => h('button', { class: 'wl-ib ' + cls, type: 'button', title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); fn(e); } }, CF.icon(icon, 14));
    const rowFor = (r, selected) => {
      const row = h('div', { class: 'wl-item' + (selected ? ' sel' : '') + (r.missing ? ' missing' : ''), role: 'option', 'aria-selected': String(!!selected), tabindex: -1, title: r.path,
        onclick: () => open(r, row), oncontextmenu: (e) => { e.preventDefault(); menu(e, r, row); } },
        h('span', { class: 'wl-pi' }, CF.icon('folder', 18)),
        h('span', { class: 'wl-pm' }, h('b', {}, r.name, r.type ? h('em', {}, r.type) : null, r.missing ? h('em', { class: 'warn' }, 'Missing') : null), h('small', {}, shortPath(r.path)), h('small', { class: 'when' }, r.missing ? 'Folder not found' : 'Opened ' + ago(r.at))),
        h('span', { class: 'wl-acts' }, ibtn('pin', r.pinned ? 'Unpin' : 'Pin to top', () => pin(r), r.pinned ? 'on' : ''), ibtn('more', 'More actions', (e) => { const b = e.currentTarget.getBoundingClientRect(); menu({ clientX: Math.max(8, b.right - 180), clientY: b.bottom + 4, preventDefault() {}, stopPropagation() {} }, r, row); }), ibtn('close', 'Remove from recent', () => remove(r))));
      row._r = r; return row;
    };

    // Home: the 3 most recent projects (pinned first) + a centred "Show more" when there are more.
    const home = h('div', { class: 'wl wl-home' });
    const drawHome = () => {
      home.innerHTML = '';
      if (!recents.length) return home.append(h('div', { class: 'wl-none' }, 'No recent projects yet. Open a folder with Ctrl+O.'));
      home.append(h('h2', { class: 'wl-h' }, 'Recent projects'), h('div', { class: 'wl-list', role: 'listbox', 'aria-label': 'Recent projects' }, ...sorted().slice(0, 3).map((r) => rowFor(r))));
      if (recents.length > 3) home.append(h('div', { class: 'wl-more' }, h('button', { class: 'wl-morebtn', type: 'button', onclick: () => showAll() }, `Show more (${recents.length - 3})`)));
    };

    // All recent folders: searchable overlay (Up/Down + Enter, Escape closes).
    let all = null, allList = null, allSearch = null, sel = 0, q = '';
    const closeAll = () => { if (all) { all.remove(); all = null; } };
    const visible = () => { const t = q.trim().toLowerCase(); return sorted().filter((r) => !t || r.name.toLowerCase().includes(t) || r.path.toLowerCase().includes(t) || (r.type || '').toLowerCase().includes(t)); };
    function drawAll() {
      const items = visible(); sel = Math.min(sel, Math.max(0, items.length - 1)); allList.innerHTML = '';
      if (!items.length) return allList.append(h('div', { class: 'wl-empty' }, CF.icon('search', 28), h('b', {}, recents.length ? 'No matching projects' : 'No recent projects yet'), h('small', {}, recents.length ? 'Try a different name or path.' : 'Projects you open will show up here.')));
      items.forEach((r, i) => allList.append(rowFor(r, i === sel)));
    }
    function showAll() {
      if (all) return; q = ''; sel = 0;
      allSearch = h('input', { class: 'wl-search', type: 'search', placeholder: 'Search recent folders', 'aria-label': 'Search recent folders', spellcheck: 'false' });
      allList = h('div', { class: 'wl-list wl-all', role: 'listbox', 'aria-label': 'All recent projects' });
      const clear = h('button', { class: 'wl-link', type: 'button', onclick: CF.guard(async () => {
        if (!recents.some((r) => !r.pinned)) return CF.toast('Nothing to clear');
        if (await CF.confirm('Clear recent project history? Pinned projects are kept. Your files are not touched.', 'Clear')) { await cf.ws.recentClear(); await refresh(); if (recents.length <= 3) closeAll(); }
      }) }, 'Clear history');
      all = h('div', { class: 'wl-ov', onmousedown: (e) => { if (e.target === all) closeAll(); } },
        h('div', { class: 'wl-dlg', role: 'dialog', 'aria-label': 'Recent projects' },
          h('div', { class: 'wl-dh' }, h('h2', { class: 'wl-h' }, 'Recent projects'), h('span', { class: 'grow' }), clear, ibtn('close', 'Close', closeAll)),
          h('div', { class: 'wl-searchbox' }, CF.icon('search', 14), allSearch), allList));
      allSearch.addEventListener('input', () => { q = allSearch.value; sel = 0; drawAll(); });
      all.addEventListener('keydown', (e) => {
        const n = visible().length;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (allSearch.value) { allSearch.value = q = ''; drawAll(); } else closeAll(); }
        else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n) { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; drawAll(); const el = allList.children[sel]; el && el.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'Enter' && n && e.target === allSearch) { e.preventDefault(); const row = allList.children[sel]; row && open(row._r, row); }
      });
      w.append(all); drawAll(); setTimeout(() => allSearch.focus(), 0);
    }
    drawHome();
    const wm = $('#watermark'); if (wm) { wm.querySelectorAll('.wl-home').forEach((n) => n.remove()); wm.append(home); } else w.append(home);   // joins the placeholder's centred column, so it stays centred when the terminal panel opens/closes
  };
})();
