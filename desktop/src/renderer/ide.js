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
    CF.restorePanel();
    if (indexRoot !== S.root) { index = await cf.fs.files(S.root); indexRoot = S.root; }
    const o = $('#overlay'); o.innerHTML = ''; o.className = ''; o.hidden = false;
    let sel = 0, shown = [];
    const list = h('div', { class: 'list' });
    const draw = () => { list.innerHTML = ''; shown.forEach((f, i) => list.append(h('div', { class: 'it' + (i === sel ? ' sel' : ''), onclick: () => go(f) }, h('span', { class: 'qo-name' }, h('span', { class: 'ic', html: CF.fileIconHtml(base(f), false) }), base(f)), h('span', { class: 'muted mono', style: 'font-size:11px' }, f)))); };
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

  // ---- Find / switch project (Ctrl+R) ------------------------------------------------------------
  const normPath = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  CF.findProject = CF.guard(async (newWin = false) => {
    const prevFocus = document.activeElement, cur = S.root ? normPath(S.root) : null, seen = new Set();
    const recents = (await cf.ws.recents()).reduce((a, r) => {   // recents come newest first; drop the open project and duplicate paths
      const k = normPath(r.path); if (k === cur || seen.has(k)) return a; seen.add(k);
      a.push({ ...r, nl: r.name.toLowerCase(), pl: r.path.replace(/\\/g, '/').toLowerCase() }); return a;
    }, []);
    const o = $('#overlay'); o.innerHTML = ''; o.className = ''; o.hidden = false;
    let sel = 0, shown = recents, tokens = [], rows = [];
    const list = h('div', { class: 'list fp-list', role: 'listbox' });
    const hl = (text, lower) => {   // wrap matched substrings in <mark>
      if (!tokens.length) return text;
      const hit = new Array(text.length).fill(false);
      for (const t of tokens) for (let i = lower.indexOf(t); i >= 0; i = lower.indexOf(t, i + t.length)) for (let j = i; j < i + t.length; j++) hit[j] = true;
      const out = []; let i = 0;
      while (i < text.length) { let j = i; while (j < text.length && hit[j] === hit[i]) j++; out.push(hit[i] ? h('mark', {}, text.slice(i, j)) : text.slice(i, j)); i = j; }
      return out;
    };
    const close = () => { CF.closeOverlay(); if (prevFocus && prevFocus.isConnected && prevFocus.focus) try { prevFocus.focus(); } catch { /* ignore */ } };
    const go = (r, inNew) => { CF.closeOverlay(); CF.guard(async () => { if (inNew) await cf.win.new(r.path); else CF.setRoot(await cf.ws.openRecent(r.path)); })(); };
    const mark = () => { rows.forEach((el, i) => { el.classList.toggle('sel', i === sel); el.setAttribute('aria-selected', i === sel); }); const el = rows[sel]; if (el) el.scrollIntoView({ block: 'nearest' }); };
    const draw = () => {
      list.innerHTML = ''; rows = [];
      shown.forEach((r, i) => {
        const el = h('div', { class: 'fp-it', role: 'option', title: r.path, onmousemove: () => { if (sel !== i) { sel = i; mark(); } }, onclick: (e) => go(r, newWin || e.ctrlKey || e.shiftKey) },
          h('span', { class: 'fp-ic', html: CF.fileIconHtml(r.name, true) }),
          h('span', { class: 'fp-txt' }, h('span', { class: 'fp-name' }, hl(r.name, r.nl)), h('span', { class: 'fp-path' }, hl(r.path.replace(/\\/g, '/'), r.pl))),
          h('button', { class: 'fp-new', tabindex: '-1', title: 'Open in New Window (Ctrl+Enter)', onclick: (e) => { e.stopPropagation(); go(r, true); } }, CF.icon('open', 14)));
        rows.push(el); list.append(el);
      });
      if (!shown.length) list.append(h('div', { class: 'fp-empty' }, h('div', {}, recents.length ? 'No matching projects found' : 'No other recent projects'),
        h('button', { class: 'btn sec', onclick: () => { CF.closeOverlay(); CF.openFolder(); } }, 'Browse for folder…')));
      mark();
    };
    const filter = () => {
      const q = input.value.trim().toLowerCase().replace(/\\/g, '/'); clear.hidden = !input.value;
      tokens = q ? q.split(/\s+/) : [];
      if (!q) shown = recents;
      else {
        const sub = recents.map((r) => [r, tokens.every((t) => r.nl.includes(t) || r.pl.includes(t)) ? (tokens.some((t) => r.nl.includes(t)) ? 0 : 1) : -1]).filter((x) => x[1] >= 0);
        shown = sub.length ? sub.sort((a, b) => a[1] - b[1]).map((x) => x[0])   // stable sort keeps recency within a rank
          : recents.map((r) => [r, score(r.nl + ' ' + r.pl, q)]).filter((x) => x[1] >= 0).sort((a, b) => a[1] - b[1]).map((x) => x[0]);   // fuzzy fallback
      }
      sel = 0; draw();
    };
    const input = h('input', { placeholder: 'Search projects or folders...', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Search projects or folders', oninput: filter });
    const clear = h('button', { class: 'fp-clear', hidden: true, title: 'Clear', 'aria-label': 'Clear search', onclick: () => { input.value = ''; filter(); input.focus(); } }, CF.icon('close', 14));
    const box = h('div', { class: 'palette fp', role: 'dialog', 'aria-label': 'Find project', onkeydown: (e) => {
      const k = e.key, n = shown.length;
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); if (n) { sel = (sel + (k === 'ArrowDown' ? 1 : -1) + n) % n; mark(); } }
      else if (k === 'Enter') { e.preventDefault(); e.stopPropagation(); if (shown[sel]) go(shown[sel], newWin || e.ctrlKey || e.metaKey || e.shiftKey); }
      else if (k === 'Tab') { const f = [input, ...(clear.hidden ? [] : [clear])]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
      else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'r') { e.preventDefault(); e.stopPropagation(); }   // Ctrl+R while open: stay put
    } },
      h('div', { class: 'fp-search' }, h('span', { class: 'fp-sic' }, CF.icon('search', 16)), input, clear), list,
      h('div', { class: 'fp-foot' }, ...[['↑ ↓', 'Navigate'], ['Enter', 'Open Project'], ['Ctrl + Enter', 'New Window'], ['Esc', 'Close']].map(([k, t]) => h('span', {}, h('kbd', {}, k), t))));
    o.append(box); o.onmousedown = (e) => { if (e.target === o) close(); };
    draw(); input.focus();
  });
  // Find / Replace in the active file: the `find` / `replace` commands (keybindings.js). Works from any focus (tab, explorer, preview) except text fields and the terminal.
  CF.findInFile = (replace) => {
    const ae = document.activeElement;
    // only a visible text field keeps its own Ctrl+F; a stale/hidden one (left over from another panel or project) must not swallow it
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !ae.closest('.monaco-editor') && ae.offsetParent !== null) return;
    const g = CF.activeGroup && CF.activeGroup();
    if (!g || !g.active) return replace ? null : CF.quickOpen();   // no file open: Ctrl+F finds a file instead
    if (CF.isPage(g.active)) return CF.toast('Find in file works in text editors only');
    const id = replace ? 'editor.action.startFindReplaceAction' : 'actions.find';
    g.editor.focus(); setTimeout(() => { g.editor.focus(); const a = g.editor.getAction(id); a ? a.run() : g.editor.trigger('keyboard', id, null); }, 0);
  };
  // ---- tab shortcuts --------------------------------------------------------------------------
  CF.closeActiveTab = () => { const g = CF.activeGroup(); if (g.active) CF.closeTab(g, g.active); };
  CF.cycleTab = (d) => { const g = CF.activeGroup(); if (g.tabs.length < 2) return; const i = g.tabs.indexOf(g.active); CF.openFile(g.tabs[(i + d + g.tabs.length) % g.tabs.length], { group: g }); };

  // ---- file watching: tree, open files, git ----------------------------------------------------
  CF.watchRoot = () => { CF.invalidateIndex(); S.root && cf.fs.watch(S.root).catch(() => {}); };
  let wt;
  cf.onFsChanged(() => { CF.gitRefresh(); clearTimeout(wt); wt = setTimeout(() => { CF.invalidateIndex(); CF.refreshTree(); CF.reloadOpenFiles(); }, 60); });

  // ---- resizable sidebar & panel -----------------------------------------------------------------
  const drag = (el, onMove) => el.addEventListener('mousedown', (e) => {
    e.preventDefault(); document.body.style.userSelect = 'none';
    const mv = (ev) => onMove(ev); const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.userSelect = ''; S.groups.forEach((g) => g.editor.layout()); S.terms.forEach((t) => t.fit()); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  const mk = (cls) => h('div', { class: 'splitter ' + cls });
  const sv = mk('v'), sh = mk('h');
  $('#app').append(sv); $('#panel').before(sh);
  const place = () => { const sb = $('#sidebar'); sv.style.left = (sb.offsetLeft + sb.offsetWidth - 2) + 'px'; sv.style.display = S.settings.sidebar ? '' : 'none'; };
  const saved = JSON.parse(localStorage.getItem('cf.layout') || '{}');
  if (saved.side) $('#app').style.setProperty('--side-w', saved.side + 'px');   // a variable, not inline columns, so .no-sidebar can still collapse the column
  if (saved.panel) $('#panel').style.height = saved.panel + 'px';
  drag(sv, (e) => { const w = Math.min(640, Math.max(160, e.clientX - 48)); $('#app').style.setProperty('--side-w', w + 'px'); saved.side = w; localStorage.setItem('cf.layout', JSON.stringify(saved)); place(); });
  const setPanel = (ph) => { $('#panel').classList.remove('max'); $('#panel').style.height = ph + 'px'; saved.panel = ph; localStorage.setItem('cf.layout', JSON.stringify(saved)); S.groups.forEach((g) => g.editor.layout()); S.terms.forEach((t) => t.fit()); };
  CF.toggleMaxPanel = () => { const p = $('#panel'); p.classList.remove('hidden'); const on = p.classList.toggle('max'); sh.hidden = on; $('#panel-max').innerHTML = CF.iconHtml(on ? 'chevronDown' : 'chevronUp', 15); setTimeout(() => { S.groups.forEach((g) => g.editor.layout()); S.terms.forEach((t) => t.fit()); }, 30); };
  // Leave the maximized state (used when the panel is closed or a file is opened) so the editor is visible again.
  CF.restorePanel = () => { const p = $('#panel'); if (!p.classList.contains('max')) return; p.classList.remove('max'); sh.hidden = false; $('#panel-max').innerHTML = CF.iconHtml('chevronUp', 15); setTimeout(() => { S.groups.forEach((g) => g.editor.layout()); S.terms.forEach((t) => t.fit()); }, 30); };
  sh.addEventListener('dblclick', () => setPanel(260));
  drag(sh, (e) => { const mainBox = $('#main').getBoundingClientRect(); const ph = Math.min(mainBox.height - 120, Math.max(80, mainBox.bottom - e.clientY)); $('#panel').style.height = ph + 'px'; saved.panel = ph; localStorage.setItem('cf.layout', JSON.stringify(saved)); });
  new ResizeObserver(place).observe($('#sidebar')); place();
  // Window resize: CSS caps the panel (max-height) so the editor always keeps room; refit terminals to whatever size they ended up with.
  let rz; new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => S.terms.forEach((t) => t.fit()), 60); }).observe($('#panel'));

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
  const wm = h('div', { id: 'watermark' }, h('img', { src: '../../assets/asda.png', width: 96 }), h('div', {}, [['Quick Open', 'Ctrl+P'], ['Command Palette', 'Ctrl+Shift+P'], ['Toggle Terminal', 'Ctrl+`'], ['Find in Files', 'Ctrl+Shift+F']].map(([a, k]) => h('div', {}, a + '  ', h('kbd', {}, k)))));
  $('#editor-area').append(wm);
  const sync = () => { const wl = $('#welcome'), mini = !wl.hidden && wl.classList.contains('wl-mini'); wm.style.display = !S.groups.some((g) => g.tabs.length) && (wl.hidden || mini) ? '' : 'none'; if (wl.hidden) wm.querySelectorAll('.wl-home').forEach((n) => n.remove()); };   // new-window start page keeps the placeholder and sits below it
  setInterval(sync, 300);
})();
