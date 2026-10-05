// Source control: status, stage/commit, branches, history, diff viewer, clone/init.
(() => {
  const { S, $, h, base, join, rel } = CF;
  const G = { repo: false, branch: '', files: [], branches: [], commits: [], remotes: [], msg: '', fold: {} };
  const git = async (args, opts) => cf.git.run(S.root, args, opts);
  const must = async (args) => { const r = await git(args); if (r.code !== 0) throw new Error((r.stderr || r.stdout || 'git failed').trim()); return r.stdout; };
  const abs = (p) => join(S.root, p.replace(/\//g, S.platform.platform === 'win32' ? '\\' : '/'));

  CF.gitRefresh = async () => {
    if (!S.root) return;
    G.repo = await cf.git.detect(S.root).catch(() => false);
    const setBadge = (n) => { const b = $('#activitybar [data-view="git"]'); if (!b) return; let el = b.querySelector('.act-badge'); if (!n) return el && el.remove(); if (!el) { el = h('span', { class: 'act-badge' }); b.append(el); } el.textContent = n > 99 ? '99+' : n; b.title = `Source Control (${n} changed file${n === 1 ? '' : 's'})`; };
    if (!G.repo) { setBadge(0); $('#sb-branch').textContent = '⑂ no repo'; if ($('#side-title').dataset.view === 'git') CF.showView('git'); return; }
    const st = await git(['status', '--porcelain=v1', '-b', '-uall']);
    const lines = st.stdout.split('\n').filter(Boolean);
    const head = lines.shift() || '';
    G.branch = head.replace(/^## /, '').split('...')[0].replace(/^No commits yet on /, '');
    G.sync = (head.match(/\[(.+)\]/) || [])[1] || '';
    CF.G = G;
    G.files = lines.map((l) => ({ x: l[0], y: l[1], path: l.slice(3).replace(/^"|"$/g, '').replace(/.* -> /, '') }));
    const total = new Set(G.files.map((f) => f.path)).size;
    setBadge(total);
    $('#sb-branch').textContent = `⎇ ${G.branch}${G.sync ? ' (' + G.sync + ')' : ''}${total ? ' ●' + total : ''}`;
    $('#sb-branch').title = total ? `${total} changed file${total === 1 ? '' : 's'}` : 'Working tree clean';
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
  const commit = CF.guard(async () => {
    const msg = $('#commit-msg').value.trim(); if (!msg) return CF.toast('Enter a commit message', true);
    if (!G.files.some((f) => f.x !== ' ' && f.x !== '?')) { if (!(await CF.confirm('Nothing staged. Stage all changes and commit?', 'Stage all & commit'))) return; await must(['add', '-A']); }
    await must(['commit', '-m', msg]); G.msg = ''; CF.toast('Committed'); CF.gitRefresh();
  });

  function fileRow(f, staged) {
    const code = staged ? f.x : (f.y === ' ' ? f.x : f.y);
    const label = f.x === '?' ? 'U' : code;
    const btn = (t, ti, fn) => h('button', { class: 'icon-btn', title: ti, onclick: (e) => { e.stopPropagation(); fn(); } }, t);
    return h('div', { class: 'gi', onclick: () => CF.showDiff(f, staged) }, h('span', { class: 'ic', html: CF.fileIconHtml(base(f.path), false) }), h('span', { class: 'nm', title: f.path }, base(f.path), h('small', { class: 'muted', style: 'margin-left:6px' }, f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '')), h('span', { class: 'st ' + label }, label),
      h('span', { class: 'acts' }, btn(CF.icon('open', 13), 'Open File', () => CF.openFile(abs(f.path))), staged ? btn(CF.icon('minus', 13), 'Unstage', () => unstage(f.path)) : [btn(CF.icon('undo', 13), 'Discard', () => discard(f)), btn(CF.icon('plus', 13), 'Stage', () => stage(f.path))]));
  }

  // Collapsible section: header toggles a box; state survives refreshes.
  const fold = (body, key, title, count, extra, items) => {
    const box = h('div', {}); const arrow = h('span', { class: 'arr' });
    const set = () => { const c = !!G.fold[key]; arrow.innerHTML = CF.iconHtml(c ? 'chevronRight' : 'chevronDown', 12); box.hidden = c; };
    body.append(h('div', { class: 'sec-head clickable', onclick: () => { G.fold[key] = !G.fold[key]; set(); } }, arrow, title, count != null ? h('span', { class: 'badge' }, count) : null, h('span', { class: 'grow' }), extra ? h('span', { onclick: (e) => e.stopPropagation(), style: 'display:flex' }, extra) : null), box);
    items.forEach((i) => box.append(i)); set(); return box;
  };

  CF.renderGit = async (body) => {
    if (!S.root) return body.append(h('div', { class: 'pad muted' }, 'Open a folder first.'));
    if (!G.repo) return body.append(h('div', { class: 'pad' }, h('p', { class: 'muted' }, 'This folder is not a Git repository.'),
      h('button', { class: 'btn', onclick: run('Init', ['init']) }, 'Initialize Repository'), ' ', h('button', { class: 'btn sec', onclick: () => CF.cloneDialog() }, 'Clone…')));
    const staged = G.files.filter((f) => f.x !== ' ' && f.x !== '?'), changes = G.files.filter((f) => f.y !== ' ' && f.x !== '?'), untracked = G.files.filter((f) => f.x === '?');
    const msg = h('input', { id: 'commit-msg', placeholder: 'Commit message (e.g. Fix user authentication)', value: G.msg, oninput: (e) => (G.msg = e.target.value) });
    body.append(h('div', { class: 'pad' }, msg, h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: commit }, CF.icon('check', 13), ' Commit'),
      h('button', { class: 'btn sec sm', title: 'Pull', onclick: run('Pull', ['pull']) }, CF.icon('down', 13)), h('button', { class: 'btn sec sm', title: 'Push', onclick: pushIt }, CF.icon('up', 13)), h('button', { class: 'btn sec sm', title: 'Fetch', onclick: run('Fetch', ['fetch', '--all']) }, CF.icon('refresh', 13)),
      h('button', { class: 'btn sec sm', title: 'Stash', onclick: run('Stash', ['stash', 'push', '-u']) }, 'Stash'), h('button', { class: 'btn sec sm', title: 'Pop stash', onclick: run('Stash pop', ['stash', 'pop']) }, 'Pop'))));
    const total = new Set(G.files.map((f) => f.path)).size;
    if (total) { const t = $('#side-title'); if (t.dataset.view === 'git') t.append(h('span', { class: 'grow' }), h('span', { class: 'badge' }, total)); }
    const chip = (n, label, cls) => n ? h('span', { class: 'chip ' + cls, title: `${n} ${label}` }, `${n} ${label}`) : null;
    body.append(h('div', { class: 'pad git-summary' }, h('b', {}, `${total} changed file${total === 1 ? '' : 's'}`), chip(staged.length, 'staged', 'S'), chip(changes.length, 'modified', 'M'), chip(untracked.length, 'untracked', 'U')));
    const section = (title, list, stagedSec, extra) => { if (!list.length && !stagedSec) return; fold(body, title, title, list.length, extra, list.map((f) => fileRow(f, stagedSec))); };
    section('Staged Changes', staged, true, h('button', { class: 'icon-btn', title: 'Unstage all', onclick: run('Unstage all', ['reset']) }, CF.icon('minus', 14)));
    section('Changes', changes, false, h('button', { class: 'icon-btn', title: 'Stage all', onclick: run('Stage all', ['add', '-u']) }, CF.icon('plus', 14)));
    section('Untracked Files', untracked, false, h('button', { class: 'icon-btn', title: 'Stage all', onclick: run('Stage all', ['add', '-A']) }, CF.icon('plus', 14)));
    if (!G.files.length) fold(body, 'Clean', 'Changes', 0, null, [h('div', { class: 'pad muted' }, 'Working tree clean.')]);

    const [br, log, rem] = await Promise.all([git(['branch', '-a', '--format=%(HEAD)|%(refname:short)']), git(['log', '--all', '--date=short', '--pretty=format:%h|%an|%ad|%s|%D', '-n', '100']), git(['remote', '-v'])]);
    G.branches = br.stdout.split('\n').filter(Boolean).map((l) => ({ cur: l[0] === '*', name: l.slice(2) }));
    fold(body, 'Branches', 'Branches', G.branches.length, h('button', { class: 'icon-btn', title: 'Create branch', onclick: newBranch }, '＋'), G.branches.map((b) => h('div', { class: 'gi', onclick: () => !b.cur && run('Checkout', ['checkout', b.name.replace(/^origin\//, '')])(), oncontextmenu: (e) => { e.preventDefault(); CF.menu(e, [
      ['Checkout', run('Checkout', ['checkout', b.name.replace(/^origin\//, '')])], ['Merge into current', run('Merge', ['merge', b.name])], ['Rebase current onto this', run('Rebase', ['rebase', b.name])],
      ['Delete branch', CF.guard(async () => { if (await CF.confirm(`Delete branch ${b.name}?`, 'Delete')) run('Delete branch', ['branch', '-d', b.name])(); })]]); } },
    h('span', { class: 'st', style: 'color:var(--cyan)' }, b.cur ? '●' : ''), h('span', { class: 'nm' }, b.name))));
    const commitRows = log.stdout.split('\n').filter(Boolean).map((l) => { const [hash, an, ad, subj, refs] = l.split('|');
      return h('div', { class: 'commit', onclick: () => CF.showCommit(hash) }, h('span', { class: 'dot' }, '●'), h('div', {}, h('div', {}, subj, refs ? h('span', { class: 'badge', style: 'margin-left:6px' }, refs.split(', ')[0]) : null), h('div', { class: 'meta' }, `${hash} · ${an} · ${ad}`))); });
    fold(body, 'Commits', 'Commits', commitRows.length, null, commitRows);
    const seen = new Set(), remRows = [];
    rem.stdout.split('\n').filter(Boolean).forEach((l) => { if (!l.includes('(fetch)')) return; const k = l.split('\t')[0]; if (seen.has(k)) return; seen.add(k); remRows.push(h('div', { class: 'gi mono', style: 'font-size:11px' }, l.replace(' (fetch)', ''))); });
    if (!remRows.length) remRows.push(h('div', { class: 'pad muted' }, 'No remotes. Pull requests & issues live on your Git host.'));
    fold(body, 'Remotes', 'Remotes', seen.size, h('button', { class: 'icon-btn', title: 'Add remote', onclick: addRemote }, '＋'), remRows);
  };
  const pushIt = CF.guard(async () => {
    const r = await git(['push']);
    if (r.code !== 0 && /no upstream/.test(r.stderr)) { if (await CF.confirm(`No upstream for ${G.branch}. Publish branch to origin?`, 'Publish')) await must(['push', '-u', 'origin', G.branch]); }
    else if (r.code !== 0) throw new Error(r.stderr.trim());
    CF.toast('Pushed'); CF.gitRefresh();
  });
  const newBranch = CF.guard(async () => { const v = await CF.ask('Create Branch', [{ id: 'n', label: 'Branch name', placeholder: 'feature/login' }]); if (v && /^[\w./-]+$/.test(v.n) && !v.n.startsWith('-')) run('Create branch', ['checkout', '-b', v.n])(); else if (v) CF.toast('Invalid branch name', true); });
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
    const stats = h('div', { class: 'muted', style: 'margin:8px 0' });
    const d = CF.modal(`Diff — ${f.path}`, [stats, host], [
      commitRef ? null : { label: staged ? 'Unstage' : 'Stage', cls: 'sec', run: () => { CF.closeOverlay(); (staged ? unstage : stage)(f.path); } },
      commitRef || staged ? null : { label: 'Discard', cls: 'danger', run: () => { CF.closeOverlay(); discard(f); } },
      { label: 'Open File', cls: 'sec', run: () => { CF.closeOverlay(); CF.openFile(abs(f.path)); } }, { label: 'Close' }].filter(Boolean), { wide: true });
    const ed = monaco.editor.createDiffEditor(host, { ...CF.editorOptions(), readOnly: true, renderSideBySide: true, automaticLayout: true });
    const lang = CF.langFor(f.path);
    const mo = monaco.editor.createModel(orig, lang), mm = monaco.editor.createModel(mod, lang);
    ed.setModel({ original: mo, modified: mm });
    ed.onDidUpdateDiff(() => { const ch = ed.getLineChanges() || []; let a = 0, dl = 0; ch.forEach((c) => { dl += c.originalEndLineNumber ? c.originalEndLineNumber - c.originalStartLineNumber + 1 : 0; a += c.modifiedEndLineNumber ? c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1 : 0; }); stats.textContent = `+${a} added  −${dl} removed  (${ch.length} hunks)`; });
    new MutationObserver(() => { if ($('#overlay').hidden) { ed.dispose(); mo.dispose(); mm.dispose(); } }).observe($('#overlay'), { attributes: true });
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
