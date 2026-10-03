// IDE-feel features: quick open, resizable panes, file watching, tab shortcuts, close guard, empty-editor watermark.
(() => {
  const { S, $, h, base } = CF;

  // ---- Quick Open (Ctrl+P) ---------------------------------------------------------------
  let index = null, indexRoot = null;
  const score = (name, q) => { // subsequence fuzzy match; lower is better, -1 = no match
    const n = name.toLowerCase(); let i = 0, last = -1, gaps = 0;
    for (const c of q) { const j = n.indexOf(c, i); if (j < 0) return -1; if (last >= 0) gaps += j - last - 1; last = j; i = j + 1; }
    return 100 + gaps + (n.length - q.length) * 0.01 + (base(name).toLowerCase().includes(q) ? -50 : 0);
  };
  CF.quickOpen = CF.guard(async () => {
    if (!S.root) return CF.openFolder();
    if (indexRoot !== S.root) { index = await cf.fs.files(S.root); indexRoot = S.root; }
    const o = $('#overlay'); o.innerHTML = ''; o.className = ''; o.hidden = false;
    let sel = 0, shown = [];
    const list = h('div', { class: 'list' });
    const draw = () => { list.innerHTML = ''; shown.forEach((f, i) => list.append(h('div', { class: 'it' + (i === sel ? ' sel' : ''), onclick: () => go(f) }, h('span', {}, base(f)), h('span', { class: 'muted mono', style: 'font-size:11px' }, f)))); };
    const filter = () => {
      const q = input.value.trim().toLowerCase().replace(/\\/g, '/');
      if (!q) { const open = [...S.models.keys()].map(CF.rel); shown = (open.length ? open : index).slice(0, 50); }
      else shown = index.map((f) => [f, score(f.replace(/\\/g, '/'), q)]).filter((x) => x[1] >= 0).sort((a, b) => a[1] - b[1]).slice(0, 50).map((x) => x[0]);
      sel = 0; draw();
    };
    const go = (f) => { CF.closeOverlay(); CF.openFile(CF.join(S.root, f)); };
    const input = h('input', { placeholder: 'Go to file…', oninput: filter, onkeydown: (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && shown[sel]) go(shown[sel]); else if (e.key === 'Escape') CF.closeOverlay();
      const m = input.value.match(/^(.*):(\d+)$/); if (e.key === 'Enter' && m && S.groups[S.active].active) { CF.closeOverlay(); CF.activeGroup().editor.revealLineInCenter(+m[2]); CF.activeGroup().editor.setPosition({ lineNumber: +m[2], column: 1 }); }
    } });
    o.append(h('div', { class: 'palette' }, input, list)); o.onmousedown = (e) => { if (e.target === o) CF.closeOverlay(); };
    filter(); input.focus();
  });
  CF.invalidateIndex = () => { indexRoot = null; };

  // ---- tab shortcuts --------------------------------------------------------------------------
  CF.closeActiveTab = () => { const g = CF.activeGroup(); if (g.active) CF.closeTab(g, g.active); };
  CF.cycleTab = (d) => { const g = CF.activeGroup(); if (g.tabs.length < 2) return; const i = g.tabs.indexOf(g.active); CF.openFile(g.tabs[(i + d + g.tabs.length) % g.tabs.length], { group: g }); };

  // ---- file watching: tree, open files, git ----------------------------------------------------
  CF.watchRoot = () => { CF.invalidateIndex(); S.root && cf.fs.watch(S.root).catch(() => {}); };
  let wt;
  cf.onFsChanged(() => { clearTimeout(wt); wt = setTimeout(() => { CF.invalidateIndex(); CF.refreshTree(); CF.reloadOpenFiles(); CF.gitRefresh(); }, 100); });

  // ---- resizable sidebar & panel -----------------------------------------------------------------
  const drag = (el, onMove) => el.addEventListener('mousedown', (e) => {
    e.preventDefault(); document.body.style.userSelect = 'none';
    const mv = (ev) => onMove(ev); const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.userSelect = ''; S.groups.forEach((g) => g.editor.layout()); S.terms.forEach((t) => t.fit()); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  const mk = (cls) => h('div', { class: 'splitter ' + cls });
  const sv = mk('v'), sh = mk('h');
  $('#app').append(sv); $('#main').prepend(sh);
  const place = () => { const sb = $('#sidebar'); sv.style.left = (sb.offsetLeft + sb.offsetWidth - 2) + 'px'; sv.style.display = S.settings.sidebar ? '' : 'none'; };
  const saved = JSON.parse(localStorage.getItem('cf.layout') || '{}');
  if (saved.side) $('#app').style.gridTemplateColumns = `48px ${saved.side}px 1fr`;
  if (saved.panel) $('#panel').style.height = saved.panel + 'px';
  drag(sv, (e) => { const w = Math.min(640, Math.max(160, e.clientX - 48)); $('#app').style.gridTemplateColumns = `48px ${w}px 1fr`; saved.side = w; localStorage.setItem('cf.layout', JSON.stringify(saved)); place(); });
  drag(sh, (e) => { const mainBox = $('#main').getBoundingClientRect(); const ph = Math.min(mainBox.height - 120, Math.max(80, mainBox.bottom - e.clientY)); $('#panel').style.height = ph + 'px'; saved.panel = ph; localStorage.setItem('cf.layout', JSON.stringify(saved)); });
  new ResizeObserver(place).observe($('#sidebar')); place();

  // ---- close window: warn about unsaved files -------------------------------------------------------------
  cf.onAskClose(async () => {
    const dirty = [...S.models.values()].filter((m) => m.dirty);
    if (dirty.length && S.settings.autoSave === 'off') {
      const ok = await CF.confirm(`${dirty.length} file(s) have unsaved changes (${dirty.slice(0, 3).map((m) => base(m.path)).join(', ')}). Quit and lose them?`, 'Quit without saving');
      if (!ok) return;
    } else CF.saveAll();
    setTimeout(() => cf.app2.forceClose(), 150);
  });

  // ---- empty editor watermark ----------------------------------------------------------------------------------
  const wm = h('div', { id: 'watermark' }, h('img', { src: '../../assets/logo-dark.svg', width: 96 }), h('div', {}, [['Quick Open', 'Ctrl+P'], ['Command Palette', 'Ctrl+Shift+P'], ['Toggle Terminal', 'Ctrl+`'], ['Find in Files', 'Ctrl+Shift+F']].map(([a, k]) => h('div', {}, a + '  ', h('kbd', {}, k)))));
  $('#editor-area').append(wm);
  const sync = () => { wm.style.display = !S.groups.some((g) => g.tabs.length) && $('#welcome').hidden ? '' : 'none'; };
  setInterval(sync, 300);
})();
