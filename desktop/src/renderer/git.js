// Source control: status, stage/commit, branches, history, diff viewer, clone/init.
(() => {
  const { S, $, h, base, join, rel } = CF;
  const G = { repo: false, branch: '', files: [], branches: [], commits: [], remotes: [], msg: '', fold: {} };
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
    const st = await git(['status', '--porcelain=v1', '-b', '-uall']);
    const lines = st.stdout.split('\n').filter(Boolean);
    const head = lines.shift() || '';
    G.branch = head.replace(/^## /, '').split('...')[0].replace(/^No commits yet on /, '');
    G.sync = (head.match(/\[(.+)\]/) || [])[1] || '';
    G.ahead = +((G.sync.match(/ahead (\d+)/) || [])[1] || 0); G.behind = +((G.sync.match(/behind (\d+)/) || [])[1] || 0); G.gone = /gone/.test(G.sync); G.hasUp = head.includes('...');
    CF.G = G;
    G.files = lines.map((l) => ({ x: l[0], y: l[1], path: l.slice(3).replace(/^"|"$/g, '').replace(/.* -> /, '') }));
    const total = new Set(G.files.map((f) => f.path)).size;
    setBadge(total);
    const sb = $('#sb-branch'); sb.textContent = `⎇ ${G.branch}${G.sync ? ' (' + G.sync + ')' : ''}`;
    if (total) sb.append(h('span', { class: 'sb-pending', html: CF.iconHtml('git', 12) + ' ' + total }));
    sb.title = total ? `${total} pending change${total === 1 ? '' : 's'}` : 'Working tree clean';
    if ($('#side-title').dataset.view === 'git') CF.showView('git');
  };
  const run = (label, args) => CF.guard(async () => { await must(args); CF.toast(label + ' done'); await CF.gitRefresh(); await CF.reloadOpenFiles(); CF.refreshTree && CF.refreshTree(); });
  CF.gitCmd = (label, args) => run(label, args)();

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

  function fileRow(f, staged, depth = 0) {
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
    return h('div', { class: 'gi scm-file', style: `padding-left:${10 + depth * 12 + 16}px`, tabindex: 0, role: 'button', 'aria-haspopup': 'menu', onclick: () => CF.showDiff(f, staged),
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

  // Files grouped by folder (single-child folder chains are shown as one row, like VS Code's compact folders).
  const buildTree = (files) => {
    const root = { dirs: new Map(), files: [] };
    for (const f of files) { let n = root; for (const p of f.path.split('/').slice(0, -1)) { if (!n.dirs.has(p)) n.dirs.set(p, { dirs: new Map(), files: [] }); n = n.dirs.get(p); } n.files.push(f); }
    return root;
  };
  const allFiles = (n) => [...n.files, ...[...n.dirs.values()].flatMap(allFiles)];
  const renderTree = (node, depth, key, staged, prefix = '') => {
    const out = [];
    [...node.dirs.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([name, child]) => {
      let label = name, cur = child, path = prefix + name;
      while (!cur.files.length && cur.dirs.size === 1) { const [n2, c2] = [...cur.dirs.entries()][0]; label += '/' + n2; cur = c2; path += '/' + n2; }
      const fk = `dir:${key}:${path}`, list = allFiles(cur), kids = h('div', {}), arrow = h('span', { class: 'arr' });
      renderTree(cur, depth + 1, key, staged, path + '/').forEach((k) => kids.append(k));
      const set = () => { const c = !!G.fold[fk]; arrow.innerHTML = CF.iconHtml(c ? 'chevronRight' : 'chevronDown', 12); kids.hidden = c; };
      const act = (e) => { e.stopPropagation(); (staged ? unstageMany : stageMany)(list.map((f) => f.path)); };
      const dmenu = (e) => CF.menu(e, [
        [staged ? 'Unstage Folder' : 'Stage Folder', () => (staged ? unstageMany : stageMany)(list.map((f) => f.path))],
        [G.fold[fk] ? 'Expand' : 'Collapse', () => { G.fold[fk] = !G.fold[fk]; set(); }], '-',
        ['Copy Relative Path', CF.guard(async () => { await cf.clip.write(path); CF.toast('Relative path copied'); })],
        ['Reveal in File Manager', () => cf.fs.reveal(abs(path))]]);
      out.push(h('div', { class: 'scm-dir', style: `padding-left:${10 + depth * 12}px`, tabindex: 0, oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); dmenu(e); },
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); G.fold[fk] = !G.fold[fk]; set(); } },
        onclick: () => { G.fold[fk] = !G.fold[fk]; set(); } },
        arrow, h('span', { class: 'ic', html: CF.fileIconHtml(name, true) }), h('span', { class: 'nm', title: path }, label), h('span', { class: 'cnt' }, list.length),
        h('span', { class: 'acts' }, h('button', { class: 'icon-btn', title: staged ? 'Unstage folder' : 'Stage folder', 'aria-label': staged ? 'Unstage folder' : 'Stage folder', onclick: act }, CF.icon(staged ? 'minus' : 'plus', 13)))), kids);
      set();
    });
    node.files.slice().sort((a, b) => base(a.path).localeCompare(base(b.path))).forEach((f) => out.push(fileRow(f, staged, depth)));
    return out;
  };

  // Collapsible section: header toggles a box; state survives refreshes.
  const fold = (body, key, title, count, extra, items) => {
    const box = h('div', {}); const arrow = h('span', { class: 'arr' });
    const set = () => { const c = !!G.fold[key]; arrow.innerHTML = CF.iconHtml(c ? 'chevronRight' : 'chevronDown', 12); box.hidden = c; };
    body.append(h('div', { class: 'sec-head clickable', 'data-fold': key, onclick: () => { G.fold[key] = !G.fold[key]; set(); } }, arrow, title, count != null ? h('span', { class: 'badge' }, count) : null, h('span', { class: 'grow' }), extra ? h('span', { onclick: (e) => e.stopPropagation(), style: 'display:flex' }, extra) : null), box);
    items.forEach((i) => box.append(i)); set(); return box;
  };

  CF.renderGit = async (parent) => {
    let body = parent;
    for (const k of ['Branches', 'Commits', 'Remotes']) if (!(k in G.fold)) G.fold[k] = true;     // 4 open panels is too much vertical space: secondary ones start collapsed
    if (!S.root) return body.append(h('div', { class: 'pad muted' }, 'Open a folder first.'));
    if (!G.repo) return body.append(h('div', { class: 'pad' }, h('p', { class: 'muted' }, 'This folder is not a Git repository.'),
      h('button', { class: 'btn', onclick: run('Init', ['init']) }, 'Initialize Repository'), ' ', h('button', { class: 'btn sec', onclick: () => CF.cloneDialog() }, 'Clone…')));
    const staged = G.files.filter((f) => f.x !== ' ' && f.x !== '?'), changes = G.files.filter((f) => f.y !== ' ' && f.x !== '?'), untracked = G.files.filter((f) => f.x === '?');
    const wrap = h('div', { class: 'scm' }); parent.append(wrap); body = wrap;
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
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; };
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
      tool('git', 'Branch view', () => { G.fold.Branches = false; const hd = body.querySelector('[data-fold="Branches"]'); if (hd) { hd.nextSibling && (hd.nextSibling.hidden = false); hd.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }),
      tool('plus', 'Stage all changes', () => run('Stage all', ['add', '-A'])()),
      tool('undo', 'Discard all changes', async () => {
        if (!G.files.length) return CF.toast('Nothing to discard');
        if (!(await CF.confirm(`Discard all ${total} change${total === 1 ? '' : 's'}? Untracked files are deleted. This cannot be undone.`, 'Discard all'))) return;
        for (const f of G.files) { try { if (f.x === '?') await must(['clean', '-f', '--', f.path]); else { if (f.x !== ' ') await git(['restore', '--staged', '--', f.path]); await must(['restore', '--', f.path]); } } catch (e) { /* keep going: report once below */ } }
        await CF.gitRefresh(); CF.reloadOpenFiles(); CF.refreshTree && CF.refreshTree(); CF.toast('Changes discarded');
      }));
    const secBody = h('div', { class: 'scm-secbody' }), arr = h('span', { class: 'arr' });
    const setSec = () => { const c = !!G.fold.__changes; arr.innerHTML = CF.iconHtml(c ? 'chevronRight' : 'chevronDown', 12); secBody.hidden = c; };
    body.append(h('div', { class: 'scm-sec', role: 'button', tabindex: 0, 'aria-expanded': String(!G.fold.__changes), onclick: () => { G.fold.__changes = !G.fold.__changes; setSec(); },
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); G.fold.__changes = !G.fold.__changes; setSec(); } } },
      arr, h('span', { class: 'ttl' }, 'Changes'), total ? h('span', { class: 'scm-count' }, total) : null, h('span', { class: 'grow' }), tools), secBody);
    const group = (label, list, isStaged, bulk) => {
      if (!list.length) return;
      secBody.append(h('div', { class: 'scm-group' }, h('span', {}, label), h('span', { class: 'scm-count' }, list.length), h('span', { class: 'grow' }), bulk));
      renderTree(buildTree(list), 0, label, isStaged).forEach((n) => secBody.append(n));
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

    const [br, log, rem] = await Promise.all([git(['branch', '-a', '--format=%(HEAD)|%(refname:short)']), git(['log', '--all', '--date=short', '--pretty=format:%h|%an|%ad|%s|%D', '-n', '100']), git(['remote', '-v'])]);
    G.branches = br.stdout.split('\n').filter(Boolean).map((l) => ({ cur: l[0] === '*', name: l.slice(2) }));
    fold(body, 'Branches', 'Branches', G.branches.length, h('button', { class: 'icon-btn', title: 'Create branch', onclick: newBranch }, '＋'), G.branches.map((b) => h('div', { class: 'gi', onclick: () => !b.cur && run('Checkout', ['checkout', b.name.replace(/^origin\//, '')])(), oncontextmenu: (e) => { e.preventDefault(); CF.menu(e, [
      ['Checkout', run('Checkout', ['checkout', b.name.replace(/^origin\//, '')])], ['Merge into current', run('Merge', ['merge', b.name])], ['Rebase current onto this', run('Rebase', ['rebase', b.name])],
      ['Delete branch', CF.guard(async () => { if (await CF.confirm(`Delete branch ${b.name}?`, 'Delete')) run('Delete branch', ['branch', '-d', b.name])(); })]]); } },
    h('span', { class: 'st', style: 'color:var(--cyan)' }, b.cur ? '●' : ''), h('span', { class: 'nm' }, b.name))));
    const commitRows = log.stdout.split('\n').filter(Boolean).map((l) => { const [hash, an, ad, subj, refs] = l.split('|');
      return h('div', { class: 'commit scm-cm', tabindex: 0, onclick: () => CF.showCommit(hash), onkeydown: (e) => { if (e.key === 'Enter') CF.showCommit(hash); } }, h('span', { class: 'dot' }),
        h('div', { class: 'cm-body' }, h('div', { class: 'cm-subj' }, h('span', { class: 'cm-t', title: subj }, subj), refs ? h('span', { class: 'cm-ref' }, refs.split(', ')[0].replace('HEAD -> ', '')) : null),
          h('div', { class: 'cm-meta' }, h('span', { class: 'cm-hash' }, hash), `${an} · ${ad}`))); });
    fold(body, 'Commits', 'Commits', commitRows.length, null, commitRows);
    const seen = new Set(), remRows = [];
    rem.stdout.split('\n').filter(Boolean).forEach((l) => { if (!l.includes('(fetch)')) return; const k = l.split('\t')[0]; if (seen.has(k)) return; seen.add(k); remRows.push(h('div', { class: 'gi scm-remote', title: l.replace(' (fetch)', '') }, h('span', { class: 'rn' }, k), h('span', { class: 'ru' }, l.split('\t')[1] ? l.split('\t')[1].replace(' (fetch)', '') : ''))); });
    if (!remRows.length) remRows.push(h('div', { class: 'scm-emptycard' }, h('b', {}, 'No remote yet'), h('small', {}, 'Add one to push, pull and collaborate on a Git host.'),
      h('button', { class: 'scm-btn', type: 'button', onclick: addRemote }, CF.icon('plus', 12), 'Add remote')));
    fold(body, 'Remotes', 'Remotes', seen.size, h('button', { class: 'icon-btn', title: 'Add remote', onclick: addRemote }, '＋'), remRows);
  };
  // Instant feedback: flip every Sync/Publish button to a disabled "Syncing…" state before any git process starts.
  const setBusy = (on, label) => {
    G.busy = on;
    document.querySelectorAll('.scm-commit.sync, .scm-ic[data-sync]').forEach((b) => {
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
    CF.toast('Pushed'); await CF.gitRefresh();
  };
  // Sync = pull (fetches + merges) then push, like VS Code's "Sync Changes". One status refresh, no separate fetch.
  const syncIt = CF.guard(async () => {
    if (G.busy) return;
    setBusy(true, 'Syncing…');
    try {
      const wasBehind = G.behind;
      if (G.hasUp) await must(['pull']);
      await CF.gitRefresh();
      if (G.ahead || !G.hasUp) await pushCore();
      else CF.toast(wasBehind ? 'Pulled, up to date' : 'Already up to date');
      if (wasBehind) { await CF.reloadOpenFiles(); CF.refreshTree && CF.refreshTree(); }
    } finally { setBusy(false); }
  });
  CF.gitSync = () => syncIt();
  // Keep ahead/behind current without restarting: refresh on window focus, auto-fetch every 3 minutes.
  const autoFetch = async () => { if (!S.root || !G.repo || !G.hasUp || document.hidden) return; await git(['fetch', '--quiet'], { timeout: 30000 }); CF.gitRefresh(); };
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
  const renameBranch = CF.guard(async () => { const v = await CF.ask('Rename Branch', [{ id: 'n', label: 'New name for ' + G.branch, value: G.branch }], 'Rename'); if (v && v.n && v.n !== G.branch) { if (/^[\w./-]+$/.test(v.n) && !v.n.startsWith('-')) run('Renamed to ' + v.n + ' -', ['branch', '-m', v.n])(); else CF.toast('Invalid branch name', true); } });
  const newBranch = CF.guard(async () => { const v = await CF.ask('Checkout New Branch', [{ id: 'n', label: 'New branch name (created from the current branch)', placeholder: 'feature/login' }], 'Create & checkout'); if (v && /^[\w./-]+$/.test(v.n) && !v.n.startsWith('-')) run('Checked out new branch ' + v.n + ' -', ['checkout', '-b', v.n])(); else if (v) CF.toast('Invalid branch name', true); });
  const addRemote = CF.guard(async () => { const v = await CF.ask('Add Remote', [{ id: 'n', label: 'Name', value: 'origin' }, { id: 'u', label: 'URL (https or ssh)' }]); if (v && v.u) run('Add remote', ['remote', 'add', v.n, v.u])(); });

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
  CF.gitInit = run('Init', ['init']);
})();
