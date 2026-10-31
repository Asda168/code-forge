// Source control: status, stage/commit, branches, history, diff viewer, clone/init.
(() => {
  const { S, $, h, base, join, rel } = CF;
  const G = { repo: false, branch: '', files: [], branches: [], commits: [], remotes: [], msg: '', fold: {}, q: { branches: '', commits: '' }, logN: 100, lastSync: 0, rsync: {}, scroll: 0, focusQ: null, dock: null };
  const git = async (args, opts) => cf.git.run(S.root, args, opts);
  const must = async (args) => { const r = await git(args); if (r.code !== 0) throw new Error((r.stderr || r.stdout || 'git failed').trim()); return r.stdout; };
  const abs = (p) => join(S.root, p.replace(/\//g, S.platform.platform === 'win32' ? '\\' : '/'));

  // Only one status pass runs at a time; calls that arrive meanwhile collapse into a single follow-up pass, so a slow older result can never overwrite newer state.
  let rfInflight = null, rfDirty = false;
  CF.gitRefresh = () => {
    if (rfInflight) { rfDirty = true; return rfInflight; }
    rfInflight = (async () => { try { do { rfDirty = false; await refreshCore(); } while (rfDirty); } finally { rfInflight = null; } })();
    return rfInflight;
  };
  const refreshCore = async () => {
    if (!S.root) return;
    G.repo = await cf.git.detect(S.root).catch(() => false);
    const setBadge = (n) => { const b = $('#activitybar [data-view="git"]'); if (!b) return; let el = b.querySelector('.act-badge'); if (!n) return el && el.remove(); if (!el) { el = h('span', { class: 'act-badge' }); b.append(el); } el.textContent = n > 99 ? '99+' : n; b.title = `Source Control (${n} pending change${n === 1 ? '' : 's'})`; };
    if (!G.repo) { setBadge(0); $('#sb-branch').textContent = '⑂ no repo'; if ($('#side-title').dataset.view === 'git') CF.showView('git'); return; }
    const st = await git(['status', '--porcelain=v1', '-z', '-b', '-uall']);    // -z: NUL-separated, paths are never quoted/escaped
    const lines = [], parts = st.stdout.split('\0').filter(Boolean);
    for (let i = 0; i < parts.length; i++) { lines.push(parts[i]); if (i > 0 && /[RC]/.test(parts[i].slice(0, 2))) i++; }     // a rename/copy entry is followed by its original path: skip it
    const head = lines.shift() || '';
    G.branch = head.replace(/^## /, '').split('...')[0].replace(/^No commits yet on /, '');
    G.sync = (head.match(/\[(.+)\]/) || [])[1] || '';
    G.ahead = +((G.sync.match(/ahead (\d+)/) || [])[1] || 0); G.behind = +((G.sync.match(/behind (\d+)/) || [])[1] || 0); G.gone = /gone/.test(G.sync); G.hasUp = head.includes('...');
    CF.G = G;
    G.files = lines.map((l) => ({ x: l[0], y: l[1], path: l.slice(3) }));
    const total = new Set(G.files.map((f) => f.path)).size;
    setBadge(total);
    const sb = $('#sb-branch'); sb.textContent = `⎇ ${G.branch}${G.sync ? ' (' + G.sync + ')' : ''}`;
    if (total) sb.append(h('span', { class: 'sb-pending', html: CF.iconHtml('git', 12) + ' ' + total }));
    sb.title = total ? `${total} pending change${total === 1 ? '' : 's'}` : 'Working tree clean';
    if ($('#side-title').dataset.view === 'git') CF.showView('git');
  };
  const run = (label, args) => CF.guard(async () => { await must(args); CF.toast(label + ' done'); await CF.gitRefresh(); await CF.reloadOpenFiles(); CF.refreshTree && CF.refreshTree(); });
  CF.gitCmd = (label, args) => run(label, args)();

  // New repositories start on the 'Default branch' from Settings > Git (git >= 2.28 understands -b).
  const initArgs = () => { const b = String(S.settings.gitDefaultBranch || '').trim(); return /^[\w./-]+$/.test(b) && !b.startsWith('-') ? ['init', '-b', b] : ['init']; };
  const stage = (p) => run('Stage', ['add', '--', p])();
  const unstage = (p) => run('Unstage', ['restore', '--staged', '--', p])();
  const discard = CF.guard(async (f) => {
    if (!(await CF.confirm(`Discard changes to ${f.path}? This cannot be undone.`, 'Discard'))) return;
    if (f.x === '?' ) await must(['clean', '-f', '--', f.path]); else await must(['restore', '--', f.path]);
    await CF.gitRefresh(); CF.reloadOpenFiles(); CF.refreshTree();
  });
  // Returns true when a commit was made. `amend` rewrites the last commit with the message in the box.
  const doCommit = async (amend) => {
    const box = $('#commit-msg'), msg = (box ? box.value : G.msg).trim();
    const unresolved = G.files.filter(isConflict).length;
    if (unresolved) { CF.toast(`Resolve ${unresolved} conflicted file${unresolved === 1 ? '' : 's'} first (then stage them).`, true); return false; }
    if (!msg) { CF.toast('Enter a commit message', true); return false; }
    if (amend) { if (!(await CF.confirm('Replace the last commit with the staged changes and this message? Do not do this to commits you already pushed.', 'Amend'))) return false; }
    else if (!G.files.some((f) => f.x !== ' ' && f.x !== '?')) { if (!(await CF.confirm('Nothing staged. Stage all changes and commit?', 'Stage all & commit'))) return false; await must(['add', '-A']); }
    await must(amend ? ['commit', '--amend', '-m', msg] : ['commit', '-m', msg]); G.msg = ''; await CF.gitRefresh();
    CF.toast((amend ? 'Commit amended' : 'Committed') + (G.hasUp || G.ahead ? '. Click Sync Changes to push.' : ''));
    return true;
  };
  const commit = CF.guard(async () => {
    if (G.busy) return;
    const b = document.querySelector('.scm-commit:not(.sync)'), html = b && b.innerHTML;
    if (b) { b.disabled = true; b.textContent = 'Committing…'; }
    G.busy = true;
    try { await doCommit(false); } finally { G.busy = false; if (b && b.isConnected && html) { b.disabled = false; b.innerHTML = html; } }
  });
  const commitPush = CF.guard(async () => { if (await doCommit(false)) await pushIt(); });
  const amendIt = CF.guard(() => doCommit(true));
  const stageMany = (paths) => run('Stage', ['add', '--', ...paths])();
  const unstageMany = (paths) => run('Unstage', ['restore', '--staged', '--', ...paths])();

  // "Generate": a conventional-commit style message built locally from the file list. Nothing leaves the machine.
  const suggest = () => {
    const stg = G.files.filter((f) => f.x !== ' ' && f.x !== '?'), list = stg.length ? stg : G.files;
    if (!list.length) return '';
    const code = (f) => (f.x === '?' ? 'A' : stg.length ? f.x : (f.y === ' ' ? f.x : f.y));
    const names = [...new Set(list.map((f) => base(f.path)))];
    const kinds = new Set(list.map(code)), only = (re) => list.every((f) => re.test(f.path));
    let type = '';
    if (only(/\.(md|mdx|txt|rst)$|(^|\/)docs?\//i)) type = 'docs: ';
    else if (only(/(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\./i)) type = 'test: ';
    else if (only(/\.(css|scss|less|sass)$/i)) type = 'style: ';
    else if (only(/(^|\/)(package(-lock)?\.json|composer\.(json|lock)|requirements\.txt|\.github\/|\.gitignore|Dockerfile)/i)) type = 'chore: ';
    else if (kinds.size === 1 && kinds.has('A')) type = 'feat: ';
    const verb = kinds.size === 1 ? ({ A: 'Add', D: 'Remove', R: 'Rename', M: 'Update' }[[...kinds][0]] || 'Update') : 'Update';
    const shown = names.slice(0, 3).join(', '), more = names.length - 3;
    const dirs = [...new Set(list.map((f) => (f.path.includes('/') ? f.path.split('/')[0] : '')).filter(Boolean))];
    const scope = dirs.length === 1 && names.length > 1 ? ` in ${dirs[0]}` : '';
    return `${type}${verb} ${shown}${more > 0 ? ` and ${more} more file${more === 1 ? '' : 's'}` : ''}${scope}`;
  };

  function fileRow(f, staged) {
    const code = staged ? f.x : (f.y === ' ' ? f.x : f.y);
    const label = f.x === '?' ? 'U' : code;
    const btn = (t, ti, fn) => h('button', { class: 'icon-btn', title: ti, 'aria-label': ti, onclick: (e) => { e.stopPropagation(); fn(); } }, t);
    const gone = label === 'D';                                              // a deleted file cannot be opened or revealed
    const menu = (e) => CF.menu(e, [
      ['Open Changes', () => CF.showDiff(f, staged)],
      ...(gone ? [] : [['Open File', () => CF.openFile(abs(f.path))]]),
      '-',
      staged ? ['Unstage Changes', () => unstage(f.path)] : ['Stage Changes', () => stage(f.path)],
      ...(staged ? [] : [['Discard Changes', () => discard(f)]]),
      '-',
      ['Copy Path', CF.guard(async () => { await cf.clip.write(abs(f.path)); CF.toast('Path copied'); })],
      ['Copy Relative Path', CF.guard(async () => { await cf.clip.write(f.path); CF.toast('Relative path copied'); })],
      ...(gone ? [] : [['Reveal in Explorer', () => CF.revealInTree && CF.revealInTree(abs(f.path))], ['Reveal in File Manager', () => cf.fs.reveal(abs(f.path))]]),
    ]);
    const more = (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); menu({ clientX: Math.max(8, r.right - 180), clientY: r.bottom + 4, preventDefault() {}, stopPropagation() {} }); };
    return h('div', { class: 'gi scm-file', style: 'padding-left:10px', title: f.path, tabindex: 0, role: 'button', 'aria-haspopup': 'menu', onclick: () => CF.showDiff(f, staged),
      oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); menu(e); },
      onkeydown: (e) => { if (e.key === 'Enter') CF.showDiff(f, staged); else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); menu({ clientX: r.left + 40, clientY: r.bottom, preventDefault() {}, stopPropagation() {} }); } } },
      h('span', { class: 'ic', html: CF.fileIconHtml(base(f.path), false) }), h('span', { class: 'nm', title: f.path }, base(f.path)),
      h('span', { class: 'acts' }, gone ? null : btn(CF.icon('open', 13), 'Open File', () => CF.openFile(abs(f.path))), staged ? btn(CF.icon('minus', 13), 'Unstage', () => unstage(f.path)) : [btn(CF.icon('undo', 13), 'Discard', () => discard(f)), btn(CF.icon('plus', 13), 'Stage', () => stage(f.path))],
        h('button', { class: 'icon-btn', title: 'More options', 'aria-label': 'More options', 'aria-haspopup': 'menu', onclick: more }, CF.icon('more', 13))),
      h('span', { class: 'st ' + label, title: ({ M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', U: 'Untracked', C: 'Copied' })[label] || label }, label));
  }

  // Git porcelain codes for an unmerged path (both modified, both added, deleted by one side, ...).
  const isConflict = (f) => ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(f.x + f.y);
  // Whole-file resolution: keep one side's version and stage it (the editor's inline actions resolve individual blocks).
  const acceptSide = CF.guard(async (side, f) => {
    await must(['checkout', side === 'ours' ? '--ours' : '--theirs', '--', f.path]);
    await must(['add', '--', f.path]);
    CF.toast(`Kept the ${side === 'ours' ? 'current' : 'incoming'} version of ${base(f.path)}`);
    await CF.gitRefresh(); await CF.reloadOpenFiles(); CF.refreshTree && CF.refreshTree();
  });
  const bothEdited = (f) => f.x + f.y === 'UU' || f.x + f.y === 'AA';          // "accept one side" only makes sense when both sides have the file
  function conflictRow(f) {
    const btn = (t, ti, fn) => h('button', { class: 'icon-btn', title: ti, 'aria-label': ti, onclick: (e) => { e.stopPropagation(); fn(); } }, t);
    const open = () => CF.openFile(abs(f.path));
    const kind = ({ UU: 'Both modified', AA: 'Both added', DD: 'Both deleted', AU: 'Added by us', UA: 'Added by them', DU: 'Deleted by us', UD: 'Deleted by them' })[f.x + f.y] || 'Conflict';
    const menu = (e) => CF.menu(e, [['Open File', open], '-',
      ...(bothEdited(f) ? [['Accept Current Version', () => acceptSide('ours', f)], ['Accept Incoming Version', () => acceptSide('theirs', f)], '-'] : []),
      ['Mark as Resolved', () => CF.markResolved(abs(f.path))], '-',
      ['Copy Relative Path', CF.guard(async () => { await cf.clip.write(f.path); CF.toast('Relative path copied'); })], ['Reveal in File Manager', () => cf.fs.reveal(abs(f.path))]]);
    const more = (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); menu({ clientX: Math.max(8, r.right - 190), clientY: r.bottom + 4, preventDefault() {}, stopPropagation() {} }); };
    return h('div', { class: 'gi scm-file scm-conflict', style: 'padding-left:10px', tabindex: 0, role: 'button', 'aria-haspopup': 'menu', title: `${f.path} — ${kind}`, onclick: open,
      oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); menu(e); },
      onkeydown: (e) => { if (e.key === 'Enter') open(); else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); menu({ clientX: r.left + 40, clientY: r.bottom, preventDefault() {}, stopPropagation() {} }); } } },
      h('span', { class: 'ic', html: CF.fileIconHtml(base(f.path), false) }), h('span', { class: 'nm' }, base(f.path), h('small', {}, f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '')),
      h('span', { class: 'acts' }, btn(CF.icon('open', 13), 'Open File', open),
        ...(bothEdited(f) ? [btn(CF.icon('up', 13), 'Accept Current Version', () => acceptSide('ours', f)), btn(CF.icon('down', 13), 'Accept Incoming Version', () => acceptSide('theirs', f))] : []),
        btn(CF.icon('check', 13), 'Mark as Resolved (stage)', () => CF.markResolved(abs(f.path))), h('button', { class: 'icon-btn', title: 'More options', 'aria-label': 'More options', 'aria-haspopup': 'menu', onclick: more }, CF.icon('more', 13))),
      h('span', { class: 'st X', title: kind }, '!'));
  }

  // Changed files as a flat list (file name only; the full relative path is in the tooltip), sorted by name then path.
  const renderFlat = (files, staged) => files.slice().sort((a, b) => base(a.path).localeCompare(base(b.path)) || a.path.localeCompare(b.path)).map((f) => fileRow(f, staged));

  // ---- shared bits for the Branches / Commits / Remotes sections ----------------------------------------------
  const ago = (sec) => {
    const d = Math.max(0, Date.now() / 1000 - sec); if (d < 45) return 'just now';
    const m = Math.round(d / 60); if (m < 60) return m + 'm ago';
    const hr = Math.round(m / 60); if (hr < 24) return hr + 'h ago';
    const dy = Math.round(hr / 24); if (dy < 30) return dy + 'd ago';
    const mo = Math.round(dy / 30.4); return mo < 12 ? mo + 'mo ago' : Math.round(dy / 365) + 'y ago';
  };
  const lastSyncText = () => (G.lastSync ? 'Synced ' + ago(G.lastSync / 1000) : 'Not synced yet');
  const maskUrl = (u) => (u || '').replace(/\/\/[^/@\s]+@/, '//***@');                // never show embedded credentials (https://user:token@host/...)
  const okName = (n) => /^[\w./-]+$/.test(n) && !n.startsWith('-') && !n.includes('..') && !n.endsWith('/') && !n.endsWith('.lock');
  const copy = (text, what) => CF.guard(async () => { await cf.clip.write(text); CF.toast(what + ' copied'); })();
  const ibtn = (icon, title, fn) => h('button', { class: 'scm-ic sm', type: 'button', title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); fn(e); } }, CF.icon(icon, 13));
  const menuBelow = (el, items) => { const r = el.getBoundingClientRect(); CF.menu({ clientX: Math.max(8, r.right - 190), clientY: r.bottom + 4 }, items); };
  // Keyboard model shared by all rows: Enter = primary action, Up/Down = move between rows, Menu key / Shift+F10 = context menu.
  const rowProps = (open, menu) => ({ tabindex: 0, role: 'button', 'data-row': '', 'aria-haspopup': 'menu', onclick: open,
    oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); menu(e); },
    onkeydown: (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter') { e.preventDefault(); open(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const rows = [...e.currentTarget.parentElement.querySelectorAll('[data-row]')], n = rows[rows.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); }
      else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); menu({ clientX: r.left + 40, clientY: r.bottom, preventDefault() {}, stopPropagation() {} }); } } });

  // Filter box. The text lives in G.q so it survives a panel refresh; only the list is rebuilt while typing.
  const filterBox = (key, placeholder, onChange) => {
    const inp = h('input', { type: 'text', 'data-q': key, placeholder, spellcheck: 'false', 'aria-label': placeholder, value: G.q[key] || '' });
    const clr = h('button', { class: 'scm-ic sm', type: 'button', title: 'Clear filter', 'aria-label': 'Clear filter', onclick: () => { inp.value = ''; sync(); inp.focus(); } }, CF.icon('close', 12));
    const sync = () => { G.q[key] = inp.value; clr.hidden = !inp.value; onChange(); };
    inp.addEventListener('input', sync);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Escape' && inp.value) { e.stopPropagation(); inp.value = ''; sync(); } });
    inp.addEventListener('focus', () => { G.focusQ = key; });
    inp.addEventListener('blur', () => setTimeout(() => { if (inp.isConnected && G.focusQ === key) G.focusQ = null; }, 0));   // a blur caused by the panel being rebuilt (not connected) keeps the marker
    clr.hidden = !inp.value;
    return h('div', { class: 'scm-q' }, h('span', { class: 'qi', html: CF.iconHtml('search', 12) }), inp, clr);
  };

  // Collapsible section with an animated body (grid-rows 0fr<->1fr). `inert` keeps collapsed rows out of the tab order.
  const section = (key, title, tools) => {
    const arrow = h('span', { class: 'arr' }), count = h('span', { class: 'scm-count' }), inner = h('div', { class: 'scm-fold-in' }), box = h('div', { class: 'scm-fold' }, inner);
    const set = () => { const c = !!G.fold[key]; arrow.innerHTML = CF.iconHtml(c ? 'chevronRight' : 'chevronDown', 12); box.classList.toggle('closed', c); inner.inert = c; head.setAttribute('aria-expanded', String(!c)); };
    const toggle = (v) => { G.fold[key] = v === undefined ? !G.fold[key] : !v; set(); };
    const head = h('div', { class: 'scm-sec', role: 'button', tabindex: 0, 'data-fold': key, 'aria-label': title, onclick: () => toggle(),
      onkeydown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } } },
      arrow, h('span', { class: 'ttl' }, title), count, h('span', { class: 'grow' }), tools ? h('span', { class: 'scm-tools', onclick: (e) => e.stopPropagation(), onkeydown: (e) => e.stopPropagation() }, tools) : null);
    set();
    return { key, head, box, inner, count, open: () => toggle(true), setCount: (n) => { count.textContent = n; } };
  };
  const stateRow = (kind, text, action) => h('div', { class: 'scm-state ' + kind, role: kind === 'err' ? 'alert' : 'status' }, h('span', {}, text), action || null);

  CF.renderGit = async (parent) => {
    let body = parent;
    for (const k of ['Branches', 'Commits', 'Remotes']) if (!(k in G.fold)) G.fold[k] = true;     // 4 open panels is too much vertical space: secondary ones start collapsed
    if (!S.root) return body.append(h('div', { class: 'pad muted' }, 'Open a folder first.'));
    if (!G.repo) return body.append(h('div', { class: 'pad' }, h('p', { class: 'muted' }, 'This folder is not a Git repository.'),
      h('button', { class: 'btn', onclick: run('Init', initArgs()) }, 'Initialize Repository'), ' ', h('button', { class: 'btn sec', onclick: () => CF.cloneDialog() }, 'Clone…')));
    const staged = G.files.filter((f) => f.x !== ' ' && f.x !== '?'), changes = G.files.filter((f) => f.y !== ' ' && f.x !== '?'), untracked = G.files.filter((f) => f.x === '?');
    // Three fixed regions: top (branch, message, commit button) and footer never scroll; only `scroll` does.
    const wrap = h('div', { class: 'scm' }), top = h('div', { class: 'scm-top' }), scroll = h('div', { class: 'scm-scroll', tabindex: -1 }), foot = h('footer', { class: 'scm-foot', 'aria-label': 'Repository status' });
    wrap.append(top, scroll, foot); parent.append(wrap); body = top;
    let ready = false;                                                       // ignore the scroll events caused by our own restore while content is still loading
    scroll.addEventListener('scroll', () => { if (ready) G.scroll = scroll.scrollTop; }, { passive: true });
    const restoreView = () => {                                             // the panel is rebuilt on every refresh: put the user back where they were
      if (scroll.scrollTop !== G.scroll) scroll.scrollTop = G.scroll;
      if (G.focusQ) { const q = scroll.querySelector(`[data-q="${G.focusQ}"]`); if (q && document.activeElement !== q) { q.focus({ preventScroll: true }); q.setSelectionRange(q.value.length, q.value.length); } }
    };
    const lum = (() => { const m = (getComputedStyle(document.body).backgroundColor || '').match(/\d+/g); return m ? (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) : 0; })();
    if (lum > 150) wrap.classList.add('scm-light');                        // light themes keep their own surface colours
    const total = new Set(G.files.map((f) => f.path)).size;
    const conflicts = G.files.filter(isConflict), normal = G.files.filter((f) => !isConflict(f));
    const unstaged = normal.filter((f) => f.y !== ' ' || f.x === '?');
    const openFirst = () => { const c = conflicts[0]; if (c) CF.openFile(abs(c.path)); };

    // header actions (next to the "Source Control" title)
    const moreMenu = (e) => { const r = e.currentTarget.getBoundingClientRect(); CF.menu({ clientX: Math.max(8, r.right - 190), clientY: r.bottom + 4 }, [
      ['Pull', run('Pull', ['pull'])], ['Push', pushIt], ['Fetch', run('Fetch', ['fetch', '--all'])], ['Sync Changes', syncIt], '-',
      ['Stash changes', run('Stash', ['stash', 'push', '-u'])], ['Pop stash', run('Stash pop', ['stash', 'pop'])], '-', ['Checkout new branch…', newBranch]]); };
    const tt = $('#side-title');
    if (tt.dataset.view === 'git') {
      tt.querySelectorAll('.scm-acts, .badge, .grow').forEach((n) => n.remove());
      tt.append(h('span', { class: 'grow' }), h('span', { class: 'scm-acts' },
        h('button', { class: 'scm-ic', title: 'Refresh', 'aria-label': 'Refresh', onclick: CF.guard(async () => { await CF.gitRefresh(); }) }, CF.icon('refresh', 14)),
        h('button', { class: 'scm-ic', title: 'More actions', 'aria-label': 'More actions', 'aria-haspopup': 'menu', onclick: moreMenu }, CF.icon('more', 14))));
    }

    // branch + sync state
    body.append(h('div', { class: 'scm-meta' }, h('button', { class: 'scm-branch', type: 'button', title: 'Current branch - click to switch, create, rename or delete', 'aria-haspopup': 'menu', onclick: branchMenu }, CF.icon('git', 12), h('b', {}, G.branch || 'HEAD'), CF.icon('chevronDown', 11)),
      G.ahead ? h('span', { class: 'scm-chip', title: `${G.ahead} commit(s) to push` }, '↑' + G.ahead) : null, G.behind ? h('span', { class: 'scm-chip', title: `${G.behind} commit(s) to pull` }, '↓' + G.behind) : null));

    // conflicts: ONE banner that carries the explanation and the action (no second warning, no orange commit button)
    if (conflicts.length) {
      const n = conflicts.length;
      body.append(h('div', { class: 'scm-banner', role: 'status' }, h('span', { class: 'ico', html: CF.iconHtml('bug', 16) }),
        h('div', { class: 'tx' }, h('b', {}, `${n} merge conflict${n === 1 ? '' : 's'}`), h('small', {}, 'Resolve and stage each file, then commit.')),
        h('button', { class: 'scm-btn', type: 'button', onclick: openFirst, title: 'Open the first conflicted file' }, 'Resolve')));
    }

    // commit message: auto-growing field with an embedded Generate pill
    const ta = h('textarea', { id: 'commit-msg', rows: 1, placeholder: 'Message (Ctrl+Enter to commit…)', spellcheck: 'false', 'aria-label': 'Commit message' });
    ta.value = G.msg;
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
    ta.addEventListener('input', () => { G.msg = ta.value; fit(); });
    let primaryAct = commit;                                                    // set below once the button mode is known
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); primaryAct(); } });
    const gen = h('button', { class: 'scm-gen', type: 'button', title: 'Generate a message from your changes (built locally, nothing is sent anywhere)', 'aria-label': 'Generate commit message',
      onclick: () => { const s = suggest(); if (!s) return CF.toast('No changes to describe', true); ta.value = G.msg = s; fit(); ta.focus(); } }, CF.icon('sparkle', 12), 'Generate');
    const stagedCount = normal.filter((f) => f.x !== ' ' && f.x !== '?').length;
    // After a commit the primary button becomes "Sync Changes" (what `git push` / `git pull` do), like VS Code.
    let mode = 'commit';
    if (conflicts.length) mode = 'merge';
    else if (!G.files.length) {
      if (G.ahead || G.behind) mode = 'sync';
      else if (!G.hasUp) {
        const [rem0, head0] = await Promise.all([git(['remote']), git(['rev-parse', '--verify', 'HEAD'])]);
        if (rem0.stdout.trim() && head0.code === 0) mode = 'publish';
      }
    }
    primaryAct = { commit, sync: syncIt, publish: pushIt, merge: openFirst }[mode];
    const arrows = (G.ahead ? '↑' + G.ahead : '') + (G.ahead && G.behind ? ' ' : '') + (G.behind ? '↓' + G.behind : '');
    const MAC = !!(S.platform && S.platform.platform === 'darwin'), KB = MAC ? '⌘↵' : 'Ctrl ↵';     // the shortcut lives inside the button, so it can never be clipped
    const kb = () => h('span', { class: 'k', 'aria-hidden': 'true' }, KB);
    const primary = mode === 'merge'
      ? h('button', { class: 'scm-commit', type: 'button', disabled: true, title: `Resolve ${conflicts.length} conflicted file${conflicts.length === 1 ? '' : 's'} and stage them to enable commit` }, CF.icon('check', 14), 'Commit')
      : mode === 'commit'
      ? h('button', { class: 'scm-commit', type: 'button', onclick: commit, title: `Commit (${MAC ? 'Cmd' : 'Ctrl'}+Enter)` }, CF.icon('check', 14), 'Commit', stagedCount ? h('span', { class: 'n' }, stagedCount) : null, kb())
      : mode === 'sync'
        ? h('button', { class: 'scm-commit sync', type: 'button', onclick: syncIt, title: `${G.ahead ? `Push ${G.ahead} commit${G.ahead === 1 ? '' : 's'}` : ''}${G.ahead && G.behind ? ' and ' : ''}${G.behind ? `pull ${G.behind}` : ''} (Ctrl+Enter)` },
          CF.icon('refresh', 14), 'Sync Changes', arrows ? h('span', { class: 'n' }, arrows) : null, kb())
        : h('button', { class: 'scm-commit sync', type: 'button', onclick: pushIt, title: 'Publish this branch to the remote (Ctrl+Enter)' }, CF.icon('up', 14), 'Publish Branch', kb());
    const chev = h('button', { class: 'scm-chev', type: 'button', 'aria-label': 'More commit actions', 'aria-haspopup': 'menu', title: 'More commit actions',
      onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); CF.menu({ clientX: Math.max(8, r.right - 190), clientY: r.bottom + 4 }, mode === 'merge' ? [['Open first conflict', openFirst], ['Abort merge', run('Abort merge', ['merge', '--abort'])]] : mode === 'commit' ? [['Commit', commit], ['Commit & Push', commitPush], '-', ['Commit (Amend)', amendIt]] : [['Sync Changes', syncIt], ['Push', pushIt], ['Pull', run('Pull', ['pull'])], ['Fetch', run('Fetch', ['fetch', '--all'])], '-', ['Commit (Amend)', amendIt]]); } }, CF.icon('chevronDown', 14));
    body.append(h('div', { class: 'scm-commitbox' },
      h('div', { class: 'scm-field' }, ta, gen),
      h('div', { class: 'scm-actions' }, h('div', { class: 'scm-split' + (mode === 'merge' ? ' off' : '') }, primary, chev))));
    setTimeout(fit, 0);


    // Changes: one collapsible section with a compact toolbar; staged and unstaged trees inside
    const tool = (icon, title, fn) => h('button', { class: 'scm-ic', type: 'button', title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); fn(e); } }, CF.icon(icon, 14));
    const tools = h('span', { class: 'scm-tools' },
      tool('sparkle', 'Generate commit message', () => gen.click()),
      (() => { const b = tool('refresh', 'Sync changes (pull & push)', () => syncIt()); b.dataset.sync = '1'; return b; })(),
      tool('git', 'Branch view', () => { G.dock = null; openDock('Branches'); }),
      tool('plus', 'Stage all changes', () => run('Stage all', ['add', '-A'])()),
      tool('undo', 'Discard all changes', async () => {
        if (!G.files.length) return CF.toast('Nothing to discard');
        if (!(await CF.confirm(`Discard all ${total} change${total === 1 ? '' : 's'}? Untracked files are deleted. This cannot be undone.`, 'Discard all'))) return;
        for (const f of G.files) { try { if (f.x === '?') await must(['clean', '-f', '--', f.path]); else { if (f.x !== ' ') await git(['restore', '--staged', '--', f.path]); await must(['restore', '--', f.path]); } } catch (e) { /* keep going: report once below */ } }
        await CF.gitRefresh(); CF.reloadOpenFiles(); CF.refreshTree && CF.refreshTree(); CF.toast('Changes discarded');
      }));
    const secBody = h('div', { class: 'scm-secbody' }), arr = h('span', { class: 'arr' });
    const setSec = () => { const c = !!G.fold.__changes; arr.innerHTML = CF.iconHtml(c ? 'chevronRight' : 'chevronDown', 12); secBody.hidden = c; chHead.setAttribute('aria-expanded', String(!c)); };
    const chHead = h('div', { class: 'scm-sec', role: 'button', tabindex: 0, 'aria-expanded': String(!G.fold.__changes), onclick: () => { G.fold.__changes = !G.fold.__changes; setSec(); },
      onkeydown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); G.fold.__changes = !G.fold.__changes; setSec(); } } },
      arr, h('span', { class: 'ttl' }, 'Changes'), total ? h('span', { class: 'scm-count' }, total) : null, h('span', { class: 'grow' }), tools);
    scroll.append(chHead, secBody);
    const group = (label, list, isStaged, bulk) => {
      if (!list.length) return;
      secBody.append(h('div', { class: 'scm-group' }, h('span', {}, label), h('span', { class: 'scm-count' }, list.length), h('span', { class: 'grow' }), bulk));
      renderFlat(list, isStaged).forEach((n) => secBody.append(n));
    };
    if (conflicts.length) {
      secBody.append(h('div', { class: 'scm-group scm-group-conflict' }, h('span', {}, 'Merge Changes'), h('span', { class: 'scm-count' }, conflicts.length), h('span', { class: 'grow' })));
      conflicts.forEach((f) => secBody.append(conflictRow(f)));
    }
    group('Staged', normal.filter((f) => f.x !== ' ' && f.x !== '?'), true,
      h('button', { class: 'icon-btn', title: 'Unstage all', 'aria-label': 'Unstage all', onclick: run('Unstage all', ['reset']) }, CF.icon('minus', 13)));
    group('Unstaged', unstaged, false,
      h('button', { class: 'icon-btn', title: 'Stage all', 'aria-label': 'Stage all', onclick: run('Stage all', ['add', '-A']) }, CF.icon('plus', 13)));
    if (!G.files.length && !conflicts.length) secBody.append(h('div', { class: 'scm-empty' }, h('span', { html: CF.iconHtml('check', 18) }), h('b', {}, 'Working tree clean'), h('small', {}, 'No changes to commit.')));
    setSec();

    // ---- Branches / Commits / Remotes: independent animated sections. Each loads on its own and has loading / empty / error states. ----
    const dock = h('div', { class: 'scm-dock', hidden: !G.dock }), tabCount = {}, tabBtn = {}, wraps = {};
    scroll.after(dock);                                                      // Branches / Commits / Remotes live in a dock above the footer; the footer tabs pick which one is shown
    const applyDock = () => { dock.hidden = !G.dock; for (const k in wraps) wraps[k].hidden = G.dock !== k; for (const k in tabBtn) { tabBtn[k].classList.toggle('on', G.dock === k); tabBtn[k].setAttribute('aria-pressed', String(G.dock === k)); } };
    const mk = (key, title, tools) => { G.fold[key] = false; const s = section(key, title, tools), sc = s.setCount; s.setCount = (n) => { sc(n); if (tabCount[key]) tabCount[key].textContent = n; };
      s.head.addEventListener('click', () => { G.dock = null; applyDock(); }); wraps[key] = h('div', { class: 'scm-dockpane', hidden: G.dock !== key }, s.head, s.box); dock.append(wraps[key]); return s; };
    const openDock = (k) => { G.dock = G.dock === k ? null : k; if (G.dock) { const s = { Branches: secBr, Commits: secCm, Remotes: secRm }[k]; s.open(); } applyDock(); };
    const secBr = mk('Branches', 'Branches', [ibtn('plus', 'Create branch…', () => newBranch())]);
    const secCm = mk('Commits', 'Commits', [ibtn('refresh', 'Reload commits', () => loadCommits())]);
    const secRm = mk('Remotes', 'Remotes', [ibtn('download', 'Fetch all remotes', () => fetchIt()), ibtn('plus', 'Add remote…', () => addRemote())]);
    const loading = (s) => { s.inner.replaceChildren(stateRow('load', 'Loading…')); };
    const failed = (s, e, retry) => { s.setCount('!'); s.inner.replaceChildren(stateRow('err', (e && e.message) || String(e), h('button', { class: 'scm-btn', type: 'button', onclick: retry }, 'Retry'))); };
    const chip = (t, title, cls) => h('span', { class: 'scm-chip' + (cls ? ' ' + cls : ''), title }, t);
    let drawRemotes = null;

    // Branches: current branch pinned on top, local and remote-tracking in separate groups, live filter.
    const loadBranches = async () => {
      loading(secBr);
      try {
        const r = await git(['branch', '-a', '--format=%(HEAD)%09%(refname)%09%(refname:short)%09%(upstream:short)%09%(upstream:track)%09%(objectname:short)']);
        if (r.code !== 0) throw new Error((r.stderr || 'git branch failed').trim());
        G.branches = r.stdout.split('\n').filter(Boolean).map((l) => { const [hd, ref, short, up, track, sha] = l.split('\t'), remote = ref.startsWith('refs/remotes/');
          return { cur: hd === '*', ref, remote, name: remote ? ref.slice(13) : short, up: up || '', sha: sha || '', ahead: +((track || '').match(/ahead (\d+)/) || [])[1] || 0, behind: +((track || '').match(/behind (\d+)/) || [])[1] || 0, gone: /gone/.test(track || '') }; })
          .filter((b) => b.ref.startsWith('refs/heads/') || (b.remote && !/\/HEAD$/.test(b.ref)));
      } catch (e) { return failed(secBr, e, loadBranches); }
      const list = h('div', { class: 'scm-list', role: 'list', 'aria-label': 'Branches' });
      const row = (b) => {
        const items = branchItems(b), open = () => { if (!b.cur) checkoutBranch(b); };
        return h('div', { ...rowProps(open, (e) => CF.menu(e, items)), class: 'gi scm-br' + (b.cur ? ' is-cur' : '') + (b.remote ? ' rem' : ''), 'aria-current': b.cur ? 'true' : null,
          title: `${b.name}${b.cur ? ' (current branch)' : b.remote ? ' (remote-tracking)' : ''}${b.up ? '\nTracks ' + b.up : ''}${b.sha ? '\n' + b.sha : ''}` },
          h('span', { class: 'ic', html: CF.iconHtml(b.remote ? 'cloud' : 'git', 13) }), h('span', { class: 'nm' }, b.name),
          b.cur ? chip('current', 'You are on this branch', 'now') : null, b.ahead ? chip('↑' + b.ahead, `${b.ahead} commit(s) to push`) : null, b.behind ? chip('↓' + b.behind, `${b.behind} commit(s) to pull`) : null, b.gone ? chip('gone', 'The upstream branch no longer exists', 'warn') : null,
          h('span', { class: 'acts' }, b.cur ? null : ibtn('check', 'Checkout', open), ibtn('more', 'More actions', (e) => menuBelow(e.currentTarget, items))));
      };
      const draw = () => {
        const q = (G.q.branches || '').trim().toLowerCase(), hit = (b) => !q || b.name.toLowerCase().includes(q), by = (a, b) => (b.cur - a.cur) || a.name.localeCompare(b.name);
        const local = G.branches.filter((b) => !b.remote && hit(b)).sort(by), remote = G.branches.filter((b) => b.remote && hit(b)).sort(by), nodes = [];
        const grp = (label, n) => h('div', { class: 'scm-grp' }, h('span', {}, label), h('span', { class: 'scm-count' }, n));
        if (local.length) nodes.push(grp('Local', local.length), ...local.map(row));
        if (remote.length) nodes.push(grp('Remote', remote.length), ...remote.map(row));
        if (!nodes.length) nodes.push(stateRow('empty', G.branches.length ? `No branches match “${q}”` : 'No branches yet. Make the first commit.'));
        list.replaceChildren(...nodes);
      };
      secBr.inner.replaceChildren(filterBox('branches', 'Filter branches…', draw), list);
      secBr.setCount(G.branches.length); draw();
      if (drawRemotes) drawRemotes();                                       // remote rows show how many branches each remote has
    };

    // Commits: compact rows with a graph rail (filled dot = HEAD, ring = merge commit), short hash, author, relative time.
    const loadCommits = async () => {
      loading(secCm);
      let rows;
      try {
        const r = await git(['log', '--all', '-n', String(G.logN), '--pretty=format:%H%x1f%h%x1f%an%x1f%at%x1f%P%x1f%s%x1f%D']);
        if (r.code !== 0 && !/does not have any commits|bad default revision|unknown revision/i.test(r.stderr)) throw new Error((r.stderr || 'git log failed').trim());
        rows = r.code ? [] : r.stdout.split('\n').filter(Boolean).map((l) => { const [full, hash, author, at, parents, subj, refs] = l.split('\x1f'), rf = (refs || '').split(', ').filter(Boolean);
          return { full, hash, author, at: +at, merge: (parents || '').trim().split(' ').filter(Boolean).length > 1, subj: subj || '', refs: rf, head: rf.some((x) => x === 'HEAD' || x.startsWith('HEAD -> ')) }; });
      } catch (e) { return failed(secCm, e, loadCommits); }
      const more = rows.length >= G.logN;
      const list = h('div', { class: 'scm-list', role: 'list', 'aria-label': 'Commits' });
      const row = (c) => {
        const items = commitItems(c), open = () => CF.showCommit(c.hash);
        const pill = (x) => h('span', { class: 'cm-ref' + (x.startsWith('tag: ') ? ' tag' : ''), title: x }, x.replace('HEAD -> ', '').replace('tag: ', ''));
        const refs = c.refs.slice().sort((a, b) => (b.startsWith('HEAD') - a.startsWith('HEAD')));
        return h('div', { ...rowProps(open, (e) => CF.menu(e, items)), class: 'commit scm-cm' + (c.head ? ' head' : '') + (c.merge ? ' merge' : ''),
          title: `${c.subj}\n${c.hash} · ${c.author} · ${new Date(c.at * 1000).toLocaleString()}${c.merge ? '\nMerge commit' : ''}` },
          h('span', { class: 'dot' }),
          h('div', { class: 'cm-body' }, h('div', { class: 'cm-subj' }, h('span', { class: 'cm-t' }, c.subj || '(no message)'), ...refs.slice(0, 1).map(pill), refs.length > 1 ? h('span', { class: 'cm-more', title: refs.slice(1).join('\n') }, '+' + (refs.length - 1)) : null),
            h('div', { class: 'cm-meta' }, h('span', { class: 'cm-hash' }, c.hash), h('span', { class: 'cm-au' }, c.author), h('span', { class: 'cm-ago' }, ago(c.at)))),
          h('span', { class: 'acts' }, ibtn('copy', 'Copy hash', () => copy(c.full, 'Hash')), ibtn('more', 'More actions', (e) => menuBelow(e.currentTarget, items))));
      };
      const draw = () => {
        const q = (G.q.commits || '').trim().toLowerCase(), hit = (c) => !q || (c.subj + ' ' + c.author + ' ' + c.full + ' ' + c.refs.join(' ')).toLowerCase().includes(q), shown = rows.filter(hit);
        const nodes = shown.map(row);
        if (!nodes.length) nodes.push(stateRow('empty', rows.length ? `No loaded commits match “${q}”` : 'No commits yet.'));
        if (more) nodes.push(h('button', { class: 'scm-more', type: 'button', onclick: () => { G.logN += 100; loadCommits(); } }, q ? 'Load more history to search…' : 'Load more commits'));
        list.replaceChildren(...nodes);
      };
      secCm.inner.replaceChildren(filterBox('commits', 'Filter commits (message, author, hash)…', draw), list);
      secCm.setCount(more ? rows.length + '+' : rows.length); draw();
    };

    // Remotes: name, masked URL, branch count / sync info, fetch + push, full management in the menu.
    const loadRemotes = async () => {
      loading(secRm);
      try {
        const r = await git(['remote', '-v']);
        if (r.code !== 0) throw new Error((r.stderr || 'git remote failed').trim());
        const map = new Map();
        r.stdout.split('\n').filter(Boolean).forEach((l) => { const m = l.match(/^(\S+)\t(.*) \((fetch|push)\)$/); if (!m) return; const o = map.get(m[1]) || { name: m[1], fetch: '', push: '' }; o[m[3]] = m[2]; map.set(m[1], o); });
        G.remotes = [...map.values()];
      } catch (e) { return failed(secRm, e, loadRemotes); }
      secRm.setCount(G.remotes.length);
      const list = h('div', { class: 'scm-list', role: 'list', 'aria-label': 'Remotes' });
      secRm.inner.replaceChildren(list);
      drawRemotes = () => {
        if (!G.remotes.length) return list.replaceChildren(h('div', { class: 'scm-emptycard' }, h('b', {}, 'No remote yet'), h('small', {}, 'Add one to push, pull and collaborate on a Git host.'),
          h('button', { class: 'scm-btn', type: 'button', onclick: addRemote }, CF.icon('plus', 12), 'Add remote')));
        const curBr = G.branches.find((b) => b.cur);
        list.replaceChildren(...G.remotes.map((rm) => {
          const items = remoteItems(rm), nb = G.branches.filter((b) => b.remote && b.name.startsWith(rm.name + '/')).length;
          const tracked = curBr && curBr.up.startsWith(rm.name + '/'), when = Math.max(G.rsync[rm.name] || 0, G.lastSync || 0);
          const status = [nb ? `${nb} branch${nb === 1 ? '' : 'es'}` : null, when ? 'fetched ' + ago(when / 1000) : 'not fetched yet'].filter(Boolean).join(' · ');
          const diffUrl = rm.push && rm.push !== rm.fetch;
          const el = h('div', { ...rowProps(() => fetchRemote(rm.name, el), (e) => CF.menu(e, items)), class: 'gi scm-remote', 'data-remote': rm.name,
            title: `${rm.name}\nFetch: ${maskUrl(rm.fetch)}${diffUrl ? '\nPush: ' + maskUrl(rm.push) : ''}\n${status}\n(Enter = fetch, right-click for more)` },
            h('span', { class: 'ic', html: CF.iconHtml('cloud', 14) }),
            h('div', { class: 'rbody' }, h('div', { class: 'rl1' }, h('span', { class: 'rn' }, rm.name), tracked && G.ahead ? chip('↑' + G.ahead, `${G.ahead} commit(s) to push`) : null, tracked && G.behind ? chip('↓' + G.behind, `${G.behind} commit(s) to pull`) : null),
              h('div', { class: 'ru' }, maskUrl(rm.fetch) || '(no URL)'), h('div', { class: 'rs' }, status)),
            h('span', { class: 'acts' }, ibtn('download', 'Fetch ' + rm.name, () => fetchRemote(rm.name, el)), ibtn('up', `Push ${G.branch || 'HEAD'} to ${rm.name}`, () => pushRemote(rm.name, el)), ibtn('more', 'More actions', (e) => menuBelow(e.currentTarget, items))));
          return el;
        }));
      };
      drawRemotes();
    };

    // Footer: always visible. Repo state, ahead/behind, last sync and Fetch / Pull / Push.
    const fbtn = (icon, title, fn, n) => h('button', { class: 'scm-ic' + (n ? ' has' : ''), type: 'button', title, 'aria-label': title, 'data-sync': '1', onclick: fn }, CF.icon(icon, 14), n ? h('span', { class: 'fn' }, n) : null);
    const tab = (key, icon, label) => { const c = h('span', { class: 'tc' }, ({ Branches: G.branches, Commits: null, Remotes: G.remotes }[key] || []).length || ''); tabCount[key] = c; const b = h('button', { class: 'ft-tab', type: 'button', title: label + ' (click to show or hide)', 'aria-label': label, 'aria-pressed': 'false', onclick: () => openDock(key) }, CF.icon(icon, 13), h('span', { class: 'tl' }, label), c); tabBtn[key] = b; return b; };
    foot.append(h('span', { class: 'ft-tabs' }, tab('Branches', 'git', 'Branches'), tab('Commits', 'history', 'Commits'), tab('Remotes', 'cloud', 'Remotes')), h('span', { class: 'grow' }),
      h('span', { class: 'ft-acts' }, fbtn('download', 'Fetch from all remotes', () => fetchIt()), fbtn('down', G.behind ? `Pull (${G.behind} behind)` : 'Pull', () => pullIt(), G.behind || 0), fbtn('up', G.ahead ? `Push (${G.ahead} ahead)` : 'Push', () => pushIt(), G.ahead || 0)));
    applyDock();
    foot.querySelectorAll('button').forEach((b) => { b.disabled = !!G.busy; });
    restoreView();
    await Promise.all([loadBranches(), loadCommits(), loadRemotes()]);
    restoreView(); setTimeout(() => { restoreView(); ready = true; }, 60);
  };
  // Instant feedback: flip every Sync/Publish button to a disabled "Syncing…" state before any git process starts.
  const setBusy = (on, label) => {
    G.busy = on;
    document.querySelectorAll('.scm-commit.sync, .scm-ic[data-sync], .scm-foot button').forEach((b) => {
      b.disabled = on; b.classList.toggle('busy', on);
      if (b.classList.contains('scm-commit')) { if (on) { b.dataset.html = b.innerHTML; b.textContent = label; } else if (b.dataset.html) b.innerHTML = b.dataset.html; }
    });
  };
  const pushIt = CF.guard(async () => {
    if (G.busy) return;
    setBusy(true, 'Publishing…');
    try { await pushCore(); } finally { setBusy(false); }
  });
  const pushCore = async () => {
    const r = await git(['push']);
    if (r.code !== 0 && /no upstream/.test(r.stderr)) { if (await CF.confirm(`No upstream for ${G.branch}. Publish branch to origin?`, 'Publish')) await must(['push', '-u', 'origin', G.branch]); }
    else if (r.code !== 0) {
      if (/rejected|fetch first|non-fast-forward|behind/i.test(r.stderr)) { setBusy(false); await CF.gitRefresh(); if (await CF.confirm('Remote has newer commits (not up to date). Pull then push?', 'Pull & push')) return syncIt(); return; }
      throw new Error(r.stderr.trim());
    }
    G.lastSync = Date.now(); CF.toast('Pushed'); await CF.gitRefresh();
  };
  // Sync = pull (fetches + merges) then push, like VS Code's "Sync Changes". One status refresh, no separate fetch.
  const syncIt = CF.guard(async () => {
    if (G.busy) return;
    setBusy(true, 'Syncing…');
    try {
      const wasBehind = G.behind;
      if (G.hasUp) await must(['pull']);
      G.lastSync = Date.now();
      await CF.gitRefresh();
      if (G.ahead || !G.hasUp) await pushCore();
      else CF.toast(wasBehind ? 'Pulled, up to date' : 'Already up to date');
      if (wasBehind) { await CF.reloadOpenFiles(); CF.refreshTree && CF.refreshTree(); }
    } finally { setBusy(false); }
  });
  CF.gitSync = () => syncIt();
  // Keep ahead/behind current without restarting: refresh on window focus, auto-fetch every 3 minutes.
  const autoFetch = async () => { if (!S.root || !G.repo || !G.hasUp || document.hidden) return; const r = await git(['fetch', '--quiet'], { timeout: 30000 }); if (r.code === 0) G.lastSync = Date.now(); CF.gitRefresh(); };
  setInterval(() => { const el = document.querySelector('.scm-foot .ft-ls'); if (el) el.textContent = lastSyncText(); }, 30000);
  setInterval(autoFetch, 180000);
  window.addEventListener('focus', () => { if (S.root) { CF.gitRefresh(); setTimeout(autoFetch, 500); } });
  // Branch selector: local branches (switch), plus create / rename / delete.
  const branchMenu = CF.guard(async (e) => {
    const r = e.currentTarget.getBoundingClientRect(), at = { clientX: r.left, clientY: r.bottom + 4 };
    const out = await git(['branch', '--format=%(HEAD)|%(refname:short)']);
    if (out.code !== 0) throw new Error((out.stderr || 'git branch failed').trim());
    const local = out.stdout.split('\n').filter(Boolean).map((l) => ({ cur: l[0] === '*', name: l.slice(2) })).filter((b) => b.name && !/^\(/.test(b.name));
    const detached = !local.some((b) => b.cur);
    const items = local.map((b) => [(b.cur ? '✓ ' : '   ') + b.name, () => { if (!b.cur) run('Switched to ' + b.name + ' -', ['checkout', b.name])(); }]);
    if (detached) items.unshift(['✓ (detached HEAD) ' + (G.branch || ''), () => {}]);
    items.push('-', ['＋ Create new branch…', newBranch]);
    if (!detached) items.push(['Rename current branch…', renameBranch]);
    const del = local.filter((b) => !b.cur);
    if (del.length) items.push(['Delete branch…', () => CF.menu(at, del.map((b) => ['Delete ' + b.name, CF.guard(async () => { if (await CF.confirm(`Delete branch ${b.name}? (only works if it is fully merged)`, 'Delete')) run('Deleted ' + b.name + ' -', ['branch', '-d', b.name])(); })]))]);
    CF.menu(at, items);
  });
  // ---- branch / commit / remote actions (all go through the same allow-listed `git` IPC as everything else) ----
  const branchOf = (b) => (b && b.name) || G.branch;
  const shortOf = (b) => b.name.slice(b.name.indexOf('/') + 1);                    // origin/feature/x -> feature/x
  const checkoutBranch = (b) => {
    if (!b.remote) return run('Switched to ' + b.name + ' -', ['checkout', b.name])();
    const local = G.branches.find((x) => !x.remote && x.name === shortOf(b));
    return local ? run('Switched to ' + local.name + ' -', ['checkout', local.name])() : run('Checked out ' + shortOf(b) + ' (tracking ' + b.name + ') -', ['checkout', '--track', b.name])();
  };
  const mergeBranch = CF.guard(async (b) => { if (await CF.confirm(`Merge ${b.name} into ${G.branch}?`, 'Merge')) run('Merge', ['merge', b.name])(); });
  const rebaseOnto = CF.guard(async (b) => { if (await CF.confirm(`Rebase ${G.branch} onto ${b.name}? This rewrites ${G.branch}'s commits.`, 'Rebase')) run('Rebase', ['rebase', b.name])(); });
  const deleteBranch = CF.guard(async (b) => {
    if (b.remote) {
      const rn = b.name.slice(0, b.name.indexOf('/'));
      if (await CF.confirm(`Delete branch ${shortOf(b)} on remote ${rn}? This removes it from the server for everyone.`, 'Delete remote branch')) run('Deleted ' + b.name + ' -', ['push', rn, '--delete', shortOf(b)])();
      return;
    }
    if (!(await CF.confirm(`Delete branch ${b.name}?`, 'Delete'))) return;
    const r = await git(['branch', '-d', b.name]);
    if (r.code === 0) { CF.toast('Deleted ' + b.name); return CF.gitRefresh(); }
    if (/not fully merged/i.test(r.stderr) && await CF.confirm(`${b.name} has commits that are not merged anywhere. Delete it anyway? Those commits may be lost.`, 'Force delete')) { await must(['branch', '-D', b.name]); CF.toast('Deleted ' + b.name); return CF.gitRefresh(); }
    if (!/not fully merged/i.test(r.stderr)) throw new Error((r.stderr || 'Delete failed').trim());
  });
  const renameBranch = CF.guard(async (b) => {
    const cur = b && b.name && !b.remote ? b.name : G.branch;
    const v = await CF.ask('Rename Branch', [{ id: 'n', label: 'New name for ' + cur, value: cur }], 'Rename');
    if (!v || !v.n || v.n === cur) return;
    if (!okName(v.n)) return CF.toast('Invalid branch name', true);
    run('Renamed to ' + v.n + ' -', ['branch', '-m', cur, v.n])();
  });
  // Create (and switch to) a branch, optionally starting from another branch or a commit.
  const branchFrom = CF.guard(async (start, label) => {
    const v = await CF.ask('Checkout New Branch', [{ id: 'n', label: `New branch name (created from ${label || 'the current branch'})`, placeholder: 'feature/login' }], 'Create & checkout');
    if (!v) return;
    if (!okName(v.n || '')) return CF.toast('Invalid branch name', true);
    run('Checked out new branch ' + v.n + ' -', start ? ['checkout', '-b', v.n, start] : ['checkout', '-b', v.n])();
  });
  const newBranch = () => branchFrom();
  const branchItems = (b) => {
    const i = [];
    if (!b.cur) i.push(['Checkout', () => checkoutBranch(b)], ['Merge into ' + G.branch, () => mergeBranch(b)], ['Rebase ' + G.branch + ' onto this', () => rebaseOnto(b)], '-');
    i.push(['Create branch from here…', () => branchFrom(b.name, b.name)]);
    if (!b.remote) i.push(['Rename…', () => renameBranch(b)]);
    if (!b.cur) i.push([b.remote ? 'Delete remote branch…' : 'Delete branch', () => deleteBranch(b)]);
    i.push('-', ['Copy branch name', () => copy(b.name, 'Branch name')]);
    return i;
  };

  const checkoutCommit = CF.guard(async (c) => { if (await CF.confirm(`Check out ${c.hash}? You will be on a detached HEAD; create a branch to keep new commits.`, 'Checkout')) run('Checked out ' + c.hash + ' -', ['checkout', c.full])(); });
  const cherryPick = CF.guard(async (c) => { if (await CF.confirm(`Apply commit ${c.hash} onto ${G.branch}?`, 'Cherry-pick')) run('Cherry-pick', ['cherry-pick', ...(c.merge ? ['-m', '1'] : []), c.full])(); });
  const revertCommit = CF.guard(async (c) => { if (await CF.confirm(`Create a new commit that undoes ${c.hash}?`, 'Revert')) run('Revert', ['revert', '--no-edit', ...(c.merge ? ['-m', '1'] : []), c.full])(); });
  const commitItems = (c) => [['Inspect details', () => CF.showCommit(c.hash)], '-', ['Copy hash', () => copy(c.full, 'Hash')], ['Copy message', () => copy(c.subj, 'Message')], '-',
    ['Checkout commit (detached)', () => checkoutCommit(c)], ['Create branch from here…', () => branchFrom(c.full, c.hash)], ['Cherry-pick', () => cherryPick(c)], ['Revert', () => revertCommit(c)]];

  // Network operations: disable the sync buttons while running (setBusy), remember when it last worked, refresh once at the end.
  const netOp = (label, fn) => CF.guard(async () => {
    if (G.busy) return;
    setBusy(true, label);
    try { await fn(); } finally { setBusy(false); await CF.gitRefresh(); }
  });
  const fetchIt = netOp('Fetching…', async () => { await must(['fetch', '--all']); G.lastSync = Date.now(); CF.toast('Fetched'); });
  const pullIt = netOp('Pulling…', async () => { await must(['pull']); G.lastSync = Date.now(); CF.toast('Pulled'); await CF.reloadOpenFiles(); CF.refreshTree && CF.refreshTree(); });
  // Per-remote actions show a busy state on that row.
  const onRow = async (el, fn) => {
    if (G.busy) return;
    G.busy = true; if (el) { el.classList.add('busy'); el.setAttribute('aria-busy', 'true'); }
    try { await fn(); } finally { G.busy = false; if (el) { el.classList.remove('busy'); el.removeAttribute('aria-busy'); } await CF.gitRefresh(); }
  };
  const fetchRemote = CF.guard((name, el) => onRow(el, async () => { await must(['fetch', name]); G.rsync[name] = G.lastSync = Date.now(); CF.toast('Fetched ' + name); }));
  const pushRemote = CF.guard(async (name, el) => {
    if (!G.branch) return CF.toast('No branch to push', true);
    if (!(await CF.confirm(`Push ${G.branch} to ${name}?`, 'Push'))) return;
    await onRow(el, async () => { await must(['push', ...(G.hasUp ? [] : ['-u']), name, G.branch]); G.rsync[name] = G.lastSync = Date.now(); CF.toast(`Pushed ${G.branch} to ${name}`); });
  });
  const okRemote = (v) => /^[\w.-]+$/.test(v.n || '') && !v.n.startsWith('-') && (v.u || '').trim() && !v.u.trim().startsWith('-');
  const addRemote = CF.guard(async () => {
    const v = await CF.ask('Add Remote', [{ id: 'n', label: 'Name', value: G.remotes.length ? '' : 'origin' }, { id: 'u', label: 'URL (https or ssh)' }], 'Add');
    if (!v) return;
    if (!okRemote(v)) return CF.toast('Enter a valid remote name and URL', true);
    if (G.remotes.some((r) => r.name === v.n)) return CF.toast(`Remote “${v.n}” already exists`, true);
    run('Added remote ' + v.n + ' -', ['remote', 'add', v.n, v.u.trim()])();
  });
  const editRemote = CF.guard(async (rm) => {
    const v = await CF.ask('Edit Remote', [{ id: 'n', label: 'Name', value: rm.name }, { id: 'u', label: 'URL' + (/\/\/[^/@\s]+@/.test(rm.fetch) ? ' (contains credentials - shown in full here)' : ''), value: rm.fetch }], 'Save');
    if (!v) return;
    if (!okRemote(v)) return CF.toast('Enter a valid remote name and URL', true);
    if (v.n !== rm.name && G.remotes.some((r) => r.name === v.n)) return CF.toast(`Remote “${v.n}” already exists`, true);
    if (v.n === rm.name && v.u.trim() === rm.fetch && rm.push === rm.fetch) return;
    if (v.n !== rm.name) await must(['remote', 'rename', rm.name, v.n]);
    if (v.u.trim() !== rm.fetch || rm.push !== rm.fetch) await must(['remote', 'set-url', v.n, v.u.trim()]);
    CF.toast('Remote updated'); await CF.gitRefresh();
  });
  const removeRemote = CF.guard(async (rm) => { if (await CF.confirm(`Remove remote ${rm.name}? Its remote-tracking branches are deleted locally; nothing changes on the server.`, 'Remove')) run('Removed remote ' + rm.name + ' -', ['remote', 'remove', rm.name])(); });
  const remoteItems = (rm) => [['Fetch', () => fetchRemote(rm.name)], [`Push ${G.branch || 'branch'}…`, () => pushRemote(rm.name)], '-', ['Edit remote…', () => editRemote(rm)], ['Copy URL', () => copy(rm.fetch, 'URL')], '-', ['Remove remote…', () => removeRemote(rm)]];

  // ---- diff viewer --------------------------------------------------------------------------------
  CF.showDiff = CF.guard(async (f, staged, commitRef) => {
    let orig = '', mod = '';
    if (commitRef) { orig = (await git(['show', `${commitRef}^:${f.path}`])).stdout; mod = (await git(['show', `${commitRef}:${f.path}`])).stdout; }
    else {
      orig = f.x === '?' ? '' : (await git(['show', staged ? `HEAD:${f.path}` : `:${f.path}`])).stdout;
      mod = staged ? (await git(['show', `:${f.path}`])).stdout : (await cf.fs.read(abs(f.path)).then((r) => r.text, () => ''));
    }
    const host = h('div', { class: 'diff-host' });
    const stats = h('span', { class: 'diff-stats' });
    const opts = { sideBySide: true, ignoreWs: false, collapse: false };
    let cur = -1, ed, mo, mm;
    const lang = CF.langFor(f.path);
    const title = commitRef ? `${commitRef.slice(0, 7)}^  ↔  ${commitRef.slice(0, 7)}` : staged ? 'HEAD  ↔  Index (staged)' : f.x === '?' ? 'New file (untracked)' : 'Index  ↔  Working tree';
    const tb = (label, tip, fn, on) => { const b = h('button', { class: 'btn sec sm' + (on ? ' on' : ''), title: tip, onclick: () => fn(b) }, label); return b; };
    const changes = () => (ed.getLineChanges() || []);
    const jump = (dir) => {
      const ch = changes(); if (!ch.length) return CF.toast('No changes');
      cur = (cur + dir + ch.length) % ch.length; const c = ch[cur];
      const line = c.modifiedEndLineNumber ? c.modifiedStartLineNumber : Math.max(1, c.modifiedStartLineNumber);
      ed.getModifiedEditor().revealLineInCenter(line); ed.getModifiedEditor().setPosition({ lineNumber: line, column: 1 });
      stats.dataset.pos = `${cur + 1}/${ch.length}`; updateStats();
    };
    const updateStats = () => {
      const ch = changes(); let add = 0, del = 0;
      ch.forEach((c) => { del += c.originalEndLineNumber ? c.originalEndLineNumber - c.originalStartLineNumber + 1 : 0; add += c.modifiedEndLineNumber ? c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1 : 0; });
      stats.innerHTML = ''; stats.append(h('b', { style: 'color:var(--green,#73c991)' }, `+${add}`), ' ', h('b', { style: 'color:var(--err,#f87171)' }, `−${del}`), `  ·  ${ch.length} change${ch.length === 1 ? '' : 's'}`, ch.length && cur >= 0 ? `  ·  ${cur + 1}/${ch.length}` : '');
      if (!ch.length && ed.getModel().original.getValue() === ed.getModel().modified.getValue()) stats.append('  ·  no differences');
    };
    const bar = h('div', { class: 'diff-bar' },
      tb('↑', 'Previous change (Shift+F7)', () => jump(-1)), tb('↓', 'Next change (F7)', () => jump(1)),
      tb('Inline', 'Toggle side-by-side / inline view', (b) => { opts.sideBySide = !opts.sideBySide; ed.updateOptions({ renderSideBySide: opts.sideBySide }); b.textContent = opts.sideBySide ? 'Inline' : 'Side by side'; }),
      tb('Ignore whitespace', 'Ignore trimmed whitespace differences', (b) => { opts.ignoreWs = !opts.ignoreWs; ed.updateOptions({ ignoreTrimWhitespace: opts.ignoreWs }); b.classList.toggle('on', opts.ignoreWs); cur = -1; }),
      tb('Collapse unchanged', 'Hide unchanged regions', (b) => { opts.collapse = !opts.collapse; ed.updateOptions({ hideUnchangedRegions: { enabled: opts.collapse, contextLineCount: 3, minimumLineCount: 5 } }); b.classList.toggle('on', opts.collapse); }),
      stats);
    const labels = h('div', { class: 'diff-labels' }, h('span', {}, title));
    const d = CF.modal(`Diff — ${f.path}`, [bar, labels, host], [
      commitRef ? null : { label: staged ? 'Unstage' : 'Stage', cls: 'sec', run: () => { CF.closeOverlay(); (staged ? unstage : stage)(f.path); } },
      commitRef || staged ? null : { label: 'Discard', cls: 'danger', run: () => { CF.closeOverlay(); discard(f); } },
      { label: 'Open File', cls: 'sec', run: () => { CF.closeOverlay(); CF.openFile(abs(f.path), { line: Math.max(1, ed.getModifiedEditor().getPosition().lineNumber) }); } }, { label: 'Close' }].filter(Boolean), { wide: true });
    d.classList.add('diff-dlg');
    ed = monaco.editor.createDiffEditor(host, { ...CF.editorOptions(), readOnly: true, renderSideBySide: true, renderSideBySideInlineBreakpoint: 700, automaticLayout: true, ignoreTrimWhitespace: false, renderOverviewRuler: true, enableSplitViewResizing: true, originalEditable: false, diffAlgorithm: 'advanced', renderIndicators: true });
    mo = monaco.editor.createModel(orig, lang); mm = monaco.editor.createModel(mod, lang);
    ed.setModel({ original: mo, modified: mm });
    ed.onDidUpdateDiff(() => { updateStats(); if (cur < 0 && changes().length) { cur = 0; const c = changes()[0]; ed.getModifiedEditor().revealLineInCenter(c.modifiedStartLineNumber || 1); updateStats(); } });
    d.addEventListener('keydown', (e) => { if (e.key === 'F7') { e.preventDefault(); jump(e.shiftKey ? -1 : 1); } });
    const obs = new MutationObserver(() => { if ($('#overlay').hidden) { obs.disconnect(); ed.dispose(); mo.dispose(); mm.dispose(); } }); obs.observe($('#overlay'), { attributes: true });
  });
  CF.showCommit = CF.guard(async (hash) => {
    const info = (await must(['show', '--no-patch', '--date=iso', '--pretty=format:%an <%ae>%n%ad%n%B', hash])).split('\n');
    const files = (await must(['show', '--name-status', '--pretty=format:', hash])).split('\n').filter(Boolean).map((l) => { const [s, ...p] = l.split('\t'); return { x: s[0], y: ' ', path: p[p.length - 1] }; });
    CF.modal(`Commit ${hash}`, [h('div', { class: 'mono', style: 'font-size:12px;white-space:pre-wrap' }, `Author: ${info[0]}\nDate:   ${info[1]}\n\n${info.slice(2).join('\n')}`), h('h4', {}, `Changed files (${files.length})`),
      ...files.map((f) => h('div', { class: 'gi', onclick: () => CF.showDiff(f, false, hash) }, h('span', { class: 'st ' + f.x }, f.x), h('span', { class: 'nm' }, f.path)))], [{ label: 'Close' }], { wide: true });
  });

  // ---- clone ----------------------------------------------------------------------------------------------
  CF.cloneDialog = CF.guard(async () => {
    const v = await CF.ask('Clone Repository', [{ id: 'url', label: 'Repository URL (HTTPS or SSH)', placeholder: 'https://github.com/user/project.git' }, { id: 'dir', label: 'Clone into', browse: true }], 'Clone');
    if (!v || !v.url || !v.dir) return;
    CF.toast('Cloning…'); CF.setRoot(await cf.git.clone(v.url, v.dir));
  });
  CF.gitInit = () => run('Init', initArgs())();
})();
