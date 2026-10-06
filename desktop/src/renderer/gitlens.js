// GitLens-style features: inline current-line blame, whole-file blame gutter, file / line history, GitLens sidebar
// (current file, branches, stashes, tags, contributors, recent commits). Read-only git calls only.
(() => {
  const { S, $, h, base, join, rel } = CF;
  const git = (args) => cf.git.run(S.root, args);
  const ZERO = /^0+$/;
  const L = { line: localStorage.getItem('cf.blame.line') !== '0', file: false, cache: new Map(), user: null, decos: new Map(), fileDecos: new Map(), tick: 0 };

  const ago = (sec) => {
    const d = Date.now() / 1000 - sec; if (d < 60) return 'just now';
    const u = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
    for (const [n, name] of u) if (d >= n) { const v = Math.floor(d / n); return `${v} ${name}${v > 1 ? 's' : ''} ago`; }
    return 'just now';
  };
  const initials = (n) => (n || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const hue = (s) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 360; return x; };
  const avatar = (name, size = 22) => h('span', { class: 'avatar', style: `width:${size}px;height:${size}px;background:hsl(${hue(name || '?')} 55% 42%);font-size:${Math.round(size * .42)}px` }, initials(name));
  CF.avatar = avatar;

  async function me() { if (L.user == null) L.user = (await git(['config', 'user.name'])).stdout.trim() || ''; return L.user; }

  // ---- blame ---------------------------------------------------------------------------------
  async function blameFor(path) {
    if (!S.root || !path.startsWith(S.root) || !CF.G || !CF.G.repo) return null;
    const c = L.cache.get(path); if (c && c.tick === L.tick) return c.lines;
    const r = await git(['blame', '--line-porcelain', '--', rel(path)]);
    if (r.code !== 0) { L.cache.set(path, { tick: L.tick, lines: null }); return null; }
    const lines = []; let cur = null;
    for (const l of r.stdout.split('\n')) {
      if (l.startsWith('\t')) { cur.text = l.slice(1); lines[cur.line - 1] = cur; cur = null; continue; }
      if (!cur) { const m = l.match(/^([0-9a-f]{40}) \d+ (\d+)/); if (m) cur = { hash: m[1], line: +m[2] }; continue; }
      const sp = l.indexOf(' '); const k = sp < 0 ? l : l.slice(0, sp), v = sp < 0 ? '' : l.slice(sp + 1);
      if (k === 'author') cur.author = v; else if (k === 'author-time') cur.time = +v; else if (k === 'summary') cur.summary = v; else if (k === 'author-mail') cur.mail = v;
    }
    L.cache.set(path, { tick: L.tick, lines }); return lines;
  }
  const invalidate = () => { L.tick++; };
  const origRefresh = CF.gitRefresh; CF.gitRefresh = async (...a) => { invalidate(); const r = await origRefresh(...a); updateAll(); return r; };

  const labelFor = (b, you) => ZERO.test(b.hash) ? 'You • Uncommitted changes' : `${b.author === you ? 'You' : b.author}, ${ago(b.time)} • ${b.summary}`;
  const md = (b, you) => ({ value: ZERO.test(b.hash) ? '**Uncommitted changes**' : `**${b.author === you ? 'You' : b.author}** ${b.mail || ''}, ${ago(b.time)}  \n\`${b.hash.slice(0, 8)}\` — ${b.summary}  \n*${new Date(b.time * 1000).toLocaleString()}*`, isTrusted: false });

  async function updateLine(ed) {
    const model = ed.getModel(); if (!model) return;
    const path = model.uri.fsPath; const sb = $('#sb-blame');
    const clear = () => { const d = L.decos.get(ed); if (d) d.clear(); if (ed === CF.activeGroup().editor) { sb.textContent = ''; sb.hidden = true; sb.onclick = null; } };
    if (!L.on || !L.line || !CF.G || !CF.G.repo) return clear();
    const m = S.models.get(path); if (!m) return clear();
    const lines = m.dirty ? null : await blameFor(path);
    const pos = ed.getPosition(); if (!pos) return clear();
    const b = lines && lines[pos.lineNumber - 1];
    if (!b) { clear(); if (m.dirty && ed === CF.activeGroup().editor) { sb.hidden = false; sb.textContent = 'Unsaved changes'; } return; }
    const you = await me();
    const coll = L.decos.get(ed) || (L.decos.set(ed, ed.createDecorationsCollection()), L.decos.get(ed));
    coll.set([{ range: new monaco.Range(pos.lineNumber, 1, pos.lineNumber, model.getLineMaxColumn(pos.lineNumber)), options: { isWholeLine: false, after: { content: '   ' + labelFor(b, you), inlineClassName: 'blame-inline' }, hoverMessage: md(b, you) } }]);
    if (ed === CF.activeGroup().editor) { sb.hidden = false; sb.textContent = labelFor(b, you); sb.title = 'Click to show commit'; sb.onclick = () => !ZERO.test(b.hash) && CF.showCommit(b.hash.slice(0, 8)); }
  }

  async function updateFile(ed) {
    const coll = L.fileDecos.get(ed); if (coll) coll.clear();
    const model = ed.getModel(); if (!L.on || !L.file || !model) return;
    const m = S.models.get(model.uri.fsPath); if (!m || m.dirty) return;
    const lines = await blameFor(model.uri.fsPath); if (!lines) return;
    const you = await me();
    const c = coll || (L.fileDecos.set(ed, ed.createDecorationsCollection()), L.fileDecos.get(ed));
    const out = []; let prev = null;
    lines.forEach((b, i) => {
      if (!b) return;
      const first = !prev || prev.hash !== b.hash; prev = b;
      out.push({ range: new monaco.Range(i + 1, 1, i + 1, 1), options: { hoverMessage: md(b, you),
        before: { content: first ? ((b.author === you ? 'You' : b.author) + ' · ' + ago(b.time)).slice(0, 30) : ' ', inlineClassName: 'blame-gutter' + (first ? ' first' : '') } } });
    });
    c.set(out);
  }

  function updateAll() { S.groups.forEach((g) => { updateLine(g.editor).catch(() => {}); updateFile(g.editor).catch(() => {}); }); }
  CF.blameUpdate = updateAll;

  let timer;
  const hook = (ed) => { if (ed.__blame) return; ed.__blame = true; ed.onDidChangeCursorPosition(() => { clearTimeout(timer); timer = setTimeout(() => updateLine(ed).catch(() => {}), 120); }); ed.onDidChangeModel(() => { updateLine(ed).catch(() => {}); updateFile(ed).catch(() => {}); }); ed.onDidChangeModelContent(() => { const d = L.decos.get(ed); if (d) d.clear(); }); };
  CF.initGitLens = () => { monaco.editor.onDidCreateEditor(hook); S.groups.forEach((g) => hook(g.editor));
    const origSave = CF.save; CF.save = async (...a) => { const r = await origSave(...a); invalidate(); setTimeout(updateAll, 400); return r; }; };

  // GitLens is an extension: features switch on only while it is installed and enabled
  L.on = false;
  CF.gitlensOn = (on) => { on = !!on; if (L.on === on) return; L.on = on; const b = $('#activitybar [data-view=gitlens]'); if (b) b.hidden = !on; if (!on && $('#side-title').dataset.view === 'gitlens') CF.showView('explorer'); updateAll(); };
  const needExt = () => { if (L.on) return false; CF.toast('Install the GitLens extension (Extensions view) to use this', true); return true; };
  CF.toggleLineBlame = () => { if (needExt()) return; L.line = !L.line; localStorage.setItem('cf.blame.line', L.line ? '1' : '0'); CF.toast('Line blame ' + (L.line ? 'on' : 'off')); updateAll(); };
  CF.toggleFileBlame = () => { if (needExt()) return; L.file = !L.file; CF.toast('File blame ' + (L.file ? 'on' : 'off')); updateAll(); };

  // ---- history -------------------------------------------------------------------------------
  const FMT = '--pretty=format:%h%x1f%an%x1f%at%x1f%s%x1f%D%x1e';
  const parseLog = (out) => out.split('\x1e').map((x) => x.trim()).filter(Boolean).map((x) => { const [hash, author, at, subject, refs] = x.split('\x1f'); return { hash, author, at: +at, subject, refs }; });
  const commitRow = (c, you) => h('div', { class: 'commit', onclick: () => CF.showCommit(c.hash) }, avatar(c.author),
    h('div', { class: 'grow' }, h('div', { class: 'nm-line' }, c.subject, c.refs ? c.refs.split(', ').slice(0, 2).map((r) => h('span', { class: 'badge', style: 'margin-left:6px' }, r.replace('HEAD -> ', ''))) : null),
      h('div', { class: 'meta' }, `${c.author === you ? 'You' : c.author} · ${ago(c.at)} · `, h('span', { class: 'mono' }, c.hash))));

  async function historyModal(title, args, file, extra) {
    const r = await git(args); if (r.code !== 0) throw new Error((r.stderr || 'git failed').trim());
    const list = parseLog(r.stdout); const you = await me();
    CF.modal(title, [h('div', { class: 'muted', style: 'margin-bottom:8px' }, `${list.length} commit${list.length === 1 ? '' : 's'}${extra || ''}`),
      ...list.map((c) => h('div', { class: 'commit', onclick: () => CF.showCommit(c.hash) }, avatar(c.author, 24),
        h('div', { class: 'grow' }, h('div', {}, c.subject), h('div', { class: 'meta' }, `${c.author === you ? 'You' : c.author} · ${ago(c.at)} · ${new Date(c.at * 1000).toLocaleDateString()} · `, h('span', { class: 'mono' }, c.hash))),
        file ? h('button', { class: 'btn sec sm', onclick: (e) => { e.stopPropagation(); CF.showDiff({ x: 'M', y: ' ', path: file }, false, c.hash); } }, 'Diff') : null)),
      list.length ? null : h('div', { class: 'muted' }, 'No history.')], [{ label: 'Close' }], { wide: true });
  }
  const curFile = () => { const g = CF.activeGroup(); return g && g.active && g.active.startsWith(S.root || '\0') ? g.active : null; };
  CF.fileHistory = CF.guard(async (p) => { if (needExt()) return; p = p || curFile(); if (!p) return CF.toast('Open a file in the repository first', true); await historyModal('File History — ' + base(p), ['log', '--follow', '-n', '200', FMT, '--', rel(p)], rel(p).replace(/\\/g, '/')); });
  CF.lineHistory = CF.guard(async () => {
    if (needExt()) return;
    const p = curFile(); if (!p) return CF.toast('Open a file in the repository first', true);
    const sel = CF.activeGroup().editor.getSelection(); const a = sel.startLineNumber, b = sel.endLineNumber;
    await historyModal(`Line History — ${base(p)}:${a}${b !== a ? '-' + b : ''}`, ['log', '-s', '-n', '100', FMT, `-L${a},${b}:${rel(p).replace(/\\/g, '/')}`], null);
  });

  // ---- GitLens sidebar -------------------------------------------------------------------------
  const section = (body, title, count, content, collapsed) => {
    const box = h('div', { class: 'gl-body' }); let open = !collapsed;
    const arrow = h('span', { class: 'arr' }); const set = () => { arrow.innerHTML = CF.iconHtml(open ? 'chevronDown' : 'chevronRight', 12); box.hidden = !open; };
    body.append(h('div', { class: 'sec-head clickable', onclick: () => { open = !open; set(); } }, arrow, title, count != null ? h('span', { class: 'badge' }, count) : null), box);
    set(); content(box); return box;
  };
  CF.renderGitLens = async (body) => {
    if (!L.on) return body.append(h('div', { class: 'pad muted' }, 'GitLens is not installed. Install it from the Extensions view.'));
    if (!S.root) return body.append(h('div', { class: 'pad muted' }, 'Open a folder first.'));
    if (!CF.G || !CF.G.repo) return body.append(h('div', { class: 'pad muted' }, 'This folder is not a Git repository.'));
    const you = await me();
    const [log, br, st, tg] = await Promise.all([git(['log', '--all', '-n', '300', FMT]), git(['branch', '-vv', '--format=%(HEAD)|%(refname:short)|%(upstream:short)|%(upstream:track)|%(subject)']), git(['stash', 'list', '--format=%gd|%s|%cr']), git(['tag', '--sort=-creatordate'])]);
    const commits = parseLog(log.stdout);
    const p = curFile();

    section(body, 'Current File', null, async (box) => {
      if (!p) return box.append(h('div', { class: 'pad muted' }, 'No file open.'));
      const lines = await blameFor(p);
      box.append(h('div', { class: 'gl-file' }, h('span', { class: 'ic', html: CF.fileIconHtml(base(p), false) }), h('b', {}, base(p))));
      box.append(h('div', { class: 'row-btns' }, h('button', { class: 'btn sec sm', onclick: () => CF.fileHistory() }, CF.icon('history', 13), ' File History'), h('button', { class: 'btn sec sm', onclick: () => CF.toggleFileBlame() }, CF.icon('user', 13), ' Blame'), h('button', { class: 'btn sec sm', onclick: () => CF.lineHistory() }, 'Line History')));
      if (lines) { const by = new Map(); lines.forEach((b) => b && by.set(b.author, (by.get(b.author) || 0) + 1)); [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([a, n]) => box.append(h('div', { class: 'gi' }, avatar(a, 18), h('span', { class: 'nm' }, a === you ? 'You' : a), h('small', { class: 'muted' }, `${Math.round(n / lines.length * 100)}% · ${n} lines`)))); }
      const lh = await git(['log', '--follow', '-n', '8', FMT, '--', rel(p)]);
      parseLog(lh.stdout).forEach((c) => box.append(commitRow(c, you)));
    });

    const brs = br.stdout.split('\n').filter(Boolean).map((l) => { const [head, name, up, track, subj] = l.split('|'); return { cur: head === '*', name, up, track, subj }; });
    section(body, 'Branches', brs.length, (box) => brs.forEach((b) => box.append(h('div', { class: 'gi', onclick: () => !b.cur && CF.gitCmd('Checkout', ['checkout', b.name]), title: b.subj },
      h('span', { class: 'cur' + (b.cur ? ' on' : '') }), h('span', { class: 'nm' }, b.name), b.track ? h('small', { class: 'badge sync' }, b.track.replace(/[\[\]]/g, '').replace('ahead ', '↑').replace('behind ', '↓')) : null))));

    const stashes = st.stdout.split('\n').filter(Boolean).map((l) => { const [id, msg, when] = l.split('|'); return { id, msg, when }; });
    section(body, 'Stashes', stashes.length, (box) => { if (!stashes.length) box.append(h('div', { class: 'pad muted' }, 'No stashes.')); stashes.forEach((s) => box.append(h('div', { class: 'gi' }, CF.icon('stash', 14), h('span', { class: 'nm', title: s.msg }, s.msg), h('small', { class: 'muted' }, s.when),
      h('span', { class: 'acts' }, h('button', { class: 'icon-btn', title: 'Apply', onclick: () => CF.gitCmd('Apply stash', ['stash', 'apply', s.id]) }, CF.icon('check', 13)), h('button', { class: 'icon-btn', title: 'Drop', onclick: CF.guard(async () => { if (await CF.confirm(`Drop ${s.id}?`, 'Drop')) CF.gitCmd('Drop stash', ['stash', 'drop', s.id]); }) }, CF.icon('trash', 13)))))); }, true);

    const tags = tg.stdout.split('\n').filter(Boolean);
    section(body, 'Tags', tags.length, (box) => { if (!tags.length) box.append(h('div', { class: 'pad muted' }, 'No tags.')); tags.slice(0, 50).forEach((t) => box.append(h('div', { class: 'gi', onclick: () => CF.showCommit(t) }, CF.icon('tag', 14), h('span', { class: 'nm' }, t)))); }, true);

    const people = new Map(); commits.forEach((c) => people.set(c.author, (people.get(c.author) || 0) + 1));
    section(body, 'Contributors', people.size, (box) => [...people.entries()].sort((a, b) => b[1] - a[1]).forEach(([a, n]) => box.append(h('div', { class: 'gi' }, avatar(a, 20), h('span', { class: 'nm' }, a === you ? a + ' (you)' : a), h('small', { class: 'muted' }, n + ' commits')))), true);

    section(body, 'Commits', commits.length, (box) => commits.slice(0, 60).forEach((c) => box.append(commitRow(c, you))));
  };

  // ---- shortcuts ----------------------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.code;
    if (k === 'KeyB') { e.preventDefault(); e.shiftKey ? CF.toggleFileBlame() : CF.toggleLineBlame(); }
    else if (k === 'KeyH') { e.preventDefault(); e.shiftKey ? CF.lineHistory() : CF.fileHistory(); }
  }, true);
})();
