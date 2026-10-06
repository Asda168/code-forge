// Sidebar views, command palette, settings, extensions, updates, workspace save/load.
(() => {
  const { S, $, $$, h, base } = CF;

  // ---- sidebar views --------------------------------------------------------------------
  const TITLES = { explorer: 'Explorer', search: 'Search', git: 'Source Control', gitlens: 'GitLens', run: 'Run and Debug', extensions: 'Extensions' };
  CF.showView = CF.guard(async (view) => {
    if (view === 'settings') return CF.settingsDialog();
    const title = $('#side-title'), body = $('#side-body');
    $('#app').classList.remove('no-sidebar'); S.settings.sidebar = true;
    title.dataset.view = view; title.textContent = TITLES[view]; body.innerHTML = '';
    $$('#activitybar [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    ({ explorer: CF.renderExplorer, search: CF.renderSearch, git: CF.renderGit, gitlens: CF.renderGitLens, run: CF.renderRun, extensions: renderExtensions })[view](body);
  });
  CF.toggleSidebar = () => { S.settings.sidebar = !S.settings.sidebar; $('#app').classList.toggle('no-sidebar', !S.settings.sidebar); S.groups.forEach((g) => g.editor.layout()); };

  // ---- extensions ---------------------------------------------------------------------------
  const BUILTIN_EXT = ['PHP', 'Laravel', 'Python', 'Django', 'JavaScript', 'Vue', 'React', 'SQL', 'MySQL', 'Git'].map((n) => ({ slug: n.toLowerCase(), name: n, version: '1.0.0', description: `${n} language & tooling support` }));
  // Extensions are declarative JSON (themes, snippets, file associations); see main.js. They never execute code.
  // They come from: https URLs (Install from URL, or "extensions": [...] in settings.json) and
  // local files/folders listed under "customExtensions": [...] in settings.json.
  const snipDisposables = []; const assoc = {};
  CF.loadExtensions = CF.guard(async (sync) => {
    let list;
    if (sync) { const r = await cf.ext.sync(); list = r.list; r.errors.forEach((e) => CF.toast('Extension: ' + e, true)); } else list = await cf.ext.list();
    S.extensions = list;
    snipDisposables.splice(0).forEach((d) => d.dispose()); Object.keys(assoc).forEach((k) => delete assoc[k]);
    Object.keys(CF.THEMES).filter((k) => CF.THEMES[k].ext).forEach((k) => delete CF.THEMES[k]);
    for (const e of list.filter((x) => x.enabled && !x.error)) {
      e.themes.forEach((t) => (CF.THEMES[t.id] = { name: e.source === 'imported' ? e.name.replace(' (imported)', '') + ' (imported)' : t.name + ' (' + e.name + ')', base: t.base, ui: t.ui, ed: t.ed, rules: t.rules, ext: true }));
      Object.assign(assoc, e.fileAssociations);
      for (const [lang, snips] of Object.entries(e.snippets)) snipDisposables.push(monaco.languages.registerCompletionItemProvider(lang, { provideCompletionItems: (model, pos) => {
        const w = model.getWordUntilPosition(pos); const range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
        return { suggestions: snips.map((s) => ({ label: s.prefix, kind: monaco.languages.CompletionItemKind.Snippet, insertText: s.body, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: s.description, detail: e.name, range })) }; } }));
    }
    CF.laravelNav && CF.laravelNav.set(list.some((x) => x.enabled && !x.error && (x.navigation || []).includes('laravel')));
    CF.extAssoc = assoc; if (!CF.THEMES[S.settings.theme]) S.settings.theme = 'codeforge-dark'; CF.applyTheme(S.settings.theme);
  });
  CF.installExtensionUrl = CF.guard(async () => {
    const v = await CF.ask('Install Extension from URL', [{ id: 'u', label: 'https:// URL of an extension .json manifest' }], 'Download'); if (!v || !v.u) return;
    const m = await cf.ext.install(v.u); await CF.loadExtensions(); CF.toast(`Installed ${m.name} ${m.version}`); if ($('#side-title').dataset.view === 'extensions') CF.showView('extensions');
  });
  // Suggest a not-yet-installed catalog extension when a file it supports is opened (once per extension per session; "Don't ask again" persists).
  const suggested = new Set();
  CF.suggestExtension = CF.guard(async (path) => {
    if (S.settings.suggestExtensions === false) return;
    const n = CF.base(path).toLowerCase(), ext = n.includes('.') ? n.slice(n.lastIndexOf('.')) : n, lang = CF.langFor(path);
    const skip = new Set([...(S.settings.dismissedSuggestions || []), ...(S.extensions || []).map((x) => x.id), ...suggested]);
    const cands = (await cf.ext.catalog().catch(() => [])).filter((c) => !skip.has(c.id) && !(c.themes || []).length);
    // exact file-type match first, then the extension named after the language (python -> "python"), then any snippet provider
    const hit = cands.find((c) => c.fileAssociations && c.fileAssociations[ext]) || cands.find((c) => c.id === lang && (c.snippets || {})[lang]) || cands.find((c) => (c.snippets || {})[lang]);
    if (!hit) return;
    suggested.add(hit.id);
    const t = h('div', { class: 'toast suggest' }, h('div', {}, `💡 ${hit.name} extension is recommended for ${CF.base(path)}`), h('div', { class: 'muted' }, hit.description || ''),
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'btn sm', onclick: CF.guard(async () => { t.remove(); await cf.ext.installBundled(hit.id); await CF.loadExtensions(); CF.toast('Installed ' + hit.name); if ($('#side-title').dataset.view === 'extensions') CF.showView('extensions'); }) }, 'Install'),
        h('button', { class: 'btn sec sm', onclick: () => t.remove() }, 'Not now'),
        h('button', { class: 'btn sec sm', onclick: CF.guard(async () => { t.remove(); await CF.setSetting({ dismissedSuggestions: [...(S.settings.dismissedSuggestions || []), hit.id] }); }) }, "Don't ask again")));
    document.body.append(t); setTimeout(() => t.remove(), 15000);
  });
  CF.openSettingsJson = CF.guard(async () => { const p = await cf.settings.file(); S.settingsFile = p; CF.closeOverlay(); CF.openFile(p); });
  const extIcon = (e) => h('div', { class: 'ext-ic', style: `background:${e.color || '#8b5cf6'}` }, e.icon || (e.name || '?')[0].toUpperCase());
  let extQuery = '';
  async function renderExtensions(body) {
    const exts = S.extensions || [];
    const catalog = await cf.ext.catalog().catch(() => []);
    const have = new Set(exts.map((x) => x.id));
    const available = catalog.filter((c) => !have.has(c.id));
    const refresh = async () => { await CF.loadExtensions(); CF.showView('extensions'); };
    const setDisabled = async (id, off) => { const cur = new Set(S.settings.disabledExtensions || []); off ? cur.add(id) : cur.delete(id); await CF.setSetting({ disabledExtensions: [...cur] }); await refresh(); };
    const matches = (e, q) => !q || [e.name, e.id, e.description, ...(e.themes || []).map((t) => (typeof t === 'string' ? t : t.name))].join(' ').toLowerCase().includes(q);

    const tags = (e) => [(e.themes || []).length ? 'Theme' : null, Object.keys(e.snippets || {}).length ? 'Snippets' : null, Object.keys(e.fileAssociations || {}).length ? 'File types' : null, (e.navigation || []).length ? 'Go to definition' : null].filter(Boolean);
    const row = (e, installed) => h('div', { class: 'ext' }, extIcon(e),
      h('div', { class: 'info' }, h('b', {}, e.name), ' ', h('small', {}, 'v' + e.version + (installed ? (String(e.source).startsWith('custom') ? ' · custom' : e.source === 'imported' ? ' · imported' : ' · installed') : '')),
        e.error ? h('div', { style: 'color:var(--err)' }, e.error) : h('div', { class: 'muted' }, e.description || ''),
        h('div', { style: 'margin-top:3px' }, tags(e).map((t) => h('span', { class: 'badge', style: 'margin-right:4px;background:var(--hover);color:var(--mut)' }, t)))),
      h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
        installed ? [!e.error ? h('button', { class: 'btn sec sm', onclick: () => setDisabled(e.id, e.enabled) }, e.enabled ? 'Disable' : 'Enable') : null,
          !String(e.source).startsWith('custom') ? h('button', { class: 'btn sec sm', onclick: CF.guard(async () => { await cf.ext.uninstall(e.id); await refresh(); }) }, 'Uninstall') : null]
          : h('button', { class: 'btn sm', onclick: CF.guard(async () => { await cf.ext.installBundled(e.id); CF.toast('Installed ' + e.name); await refresh(); }) }, 'Install')));

    const results = h('div');
    const draw = () => {
      const q = extQuery.trim().toLowerCase(); results.innerHTML = '';
      const inst = exts.filter((e) => matches(e, q)), avail = available.filter((e) => matches(e, q));
      if (!q) {
        // default view: only extensions you have NOT installed yet; installed ones appear when you search for them
        results.append(h('div', { class: 'sec-head' }, 'Available', ' ', h('span', { class: 'badge' }, avail.length)));
        if (!avail.length) results.append(h('div', { class: 'pad muted' }, 'Everything in the catalog is installed.'));
        avail.forEach((e) => results.append(row(e, false)));
        if (exts.length) results.append(h('div', { class: 'pad muted', style: 'font-size:12px' }, `${exts.length} installed. Search by name to show, disable or uninstall them.`));
        return;
      }
      if (inst.length) { results.append(h('div', { class: 'sec-head' }, 'Installed', ' ', h('span', { class: 'badge' }, inst.length))); inst.forEach((e) => results.append(row(e, true))); }
      if (avail.length) { results.append(h('div', { class: 'sec-head' }, 'Available', ' ', h('span', { class: 'badge' }, avail.length))); avail.forEach((e) => results.append(row(e, false))); }
      if (!inst.length && !avail.length) results.append(h('div', { class: 'pad muted' }, `No extensions match "${extQuery}".`, h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: CF.installExtensionUrl }, 'Install from URL…'))));
    };

    const search = h('input', { type: 'search', placeholder: 'Search extensions by name…', value: extQuery, oninput: (e) => { extQuery = e.target.value; draw(); }, onkeydown: (e) => { if (e.key === 'Escape') { extQuery = ''; search.value = ''; draw(); } } });
    body.append(h('div', { class: 'pad' }, search, h('div', { class: 'row' }, h('button', { class: 'btn sec sm', onclick: CF.installExtensionUrl }, '⬇ From URL'), h('button', { class: 'btn sec sm', onclick: CF.openSettingsJson }, 'settings.json'), h('button', { class: 'btn sec sm', onclick: () => CF.importVscodeTheme() }, 'Import theme'))),
      results, h('div', { class: 'pad' }, h('button', { class: 'btn sec sm', onclick: () => CF.checkUpdates(true) }, 'Check for app updates')));
    draw(); setTimeout(() => search.focus(), 0);
  }

  // ---- settings dialog --------------------------------------------------------------------------
  CF.settingsDialog = CF.guard(async () => {
    const s = S.settings; const id = (k) => 'st-' + k;
    const row = (label, ctl) => [h('label', {}, label), ctl];
    const sel = (k, opts, fmt = (x) => x) => h('select', { id: id(k), onchange: (e) => upd(k, e.target.value) }, opts.map((o) => h('option', { value: Array.isArray(o) ? o[0] : o, selected: String(Array.isArray(o) ? o[0] : o) === String(s[k]) }, Array.isArray(o) ? o[1] : fmt(o))));
    const num = (k, step = 1, min = 0, max = 99) => h('input', { id: id(k), type: 'number', step, min, max, value: s[k], onchange: (e) => upd(k, +e.target.value) });
    const txt = (k, extra) => h('div', { style: 'display:flex;gap:6px' }, h('input', { id: id(k), value: s[k] || '', style: 'flex:1', onchange: (e) => upd(k, e.target.value) }), extra);
    const chk = (k) => h('input', { id: id(k), type: 'checkbox', checked: !!s[k], style: 'width:auto', onchange: (e) => upd(k, e.target.checked) });
    const upd = async (k, v) => { await CF.setSetting({ [k]: v }); prev.style.fontFamily = `"${S.settings.fontFamily}"`; prev.style.fontSize = S.settings.fontSize + 'px'; prev.style.lineHeight = S.settings.lineHeight; prev.style.fontWeight = S.settings.fontWeight; prev.style.letterSpacing = S.settings.letterSpacing + 'px'; prev.style.fontVariantLigatures = S.settings.ligatures ? 'normal' : 'none'; };
    const prev = h('div', { class: 'preview mono' }, 'const message = "Hello World";\n\nconsole.log(message);   // => != === <= >= ->');
    const detect = h('button', { class: 'btn sec sm', onclick: CF.guard(async () => { const p = await cf.term.detectGitBash(); if (p) { $('#' + id('gitBashPath')).value = p; await CF.setSetting({ gitBashPath: p }); CF.toast('Found Git Bash:\n' + p); } else CF.toast('Git Bash not found. Install Git for Windows or set the path.', true); }) }, 'Detect Git Bash');
    const grid = h('div', { class: 'settings-grid' },
      h('b', {}, 'Editor › Font'), h('span'),
      ...row('Font Family', sel('fontFamily', ['JetBrains Mono', 'Consolas', 'Menlo', 'Fira Code', 'Cascadia Code', 'monospace'])),
      ...row('Font Size', sel('fontSize', CF.FONT_SIZES.map((x) => [x, x + 'px']))), ...row('Line Height', num('lineHeight', 0.1, 1, 3)),
      ...row('Font Weight', sel('fontWeight', [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['700', 'Bold']])), ...row('Letter Spacing', num('letterSpacing', 0.1, -2, 5)),
      ...row('Ligatures', chk('ligatures')), ...row('Smooth Font Rendering', chk('smoothFonts')),
      h('b', {}, 'Editor'), h('span'), ...row('Minimap', chk('minimap')), ...row('Word Wrap', chk('wordWrap')), ...row('Tab Size', num('tabSize', 1, 1, 8)), ...row('Insert Spaces', chk('insertSpaces')),
      ...row('Auto Save', sel('autoSave', [['off', 'Off'], ['afterDelay', 'After Delay'], ['onFocusChange', 'When Focus Changes'], ['onWindowChange', 'When Window Changes']])), ...row('Auto Save Delay (ms)', num('autoSaveDelay', 100, 100, 60000)),
      h('b', {}, 'Terminal'), h('span'), ...row('Default Shell', sel('defaultShell', [['', 'Auto'], ...S.shells.map((x) => [x.id, x.name])])),
      ...row('Git Bash Path (Windows)', txt('gitBashPath', detect)), ...row('PowerShell Path', txt('powershellPath')), ...row('CMD Path', txt('cmdPath')),
      h('b', {}, 'Git'), h('span'), ...row('Git Path', txt('gitPath')), ...row('Default Branch', txt('gitDefaultBranch')),
      h('b', {}, 'Appearance'), h('span'), ...row('Theme', h('div', { style: 'display:flex;gap:6px' }, sel('theme', Object.entries(CF.THEMES).map(([k, v]) => [k, v.name])), h('button', { class: 'btn sec sm', onclick: () => { CF.closeOverlay(); CF.themePicker(); } }, 'Preview…'), h('button', { class: 'btn sec sm', onclick: () => { CF.closeOverlay(); CF.importVscodeTheme(); } }, 'Import VS Code theme…'))),
      ...row('File Icon Theme', sel('iconTheme', Object.entries(CF.ICON_THEMES))),
      ...row('Tab Bar Close Saved / Close All', chk('tabActions')), ...row('Sidebar', chk('sidebar')), ...row('Status Bar', chk('statusBar')), ...row('Activity Bar', chk('activityBar')),
      h('b', {}, 'Updates'), h('span'), ...row('Automatic Updates', chk('autoUpdate')));
    const loggedIn = await cf.api.loggedIn();
    const acct = h('div', { class: 'pad', style: 'padding:10px 0' }, h('b', {}, 'Account (optional)'), ' ', loggedIn ? [h('span', { class: 'muted' }, 'signed in '), h('button', { class: 'btn sec sm', onclick: CF.guard(async () => { await cf.api.logout(); CF.closeOverlay(); CF.toast('Signed out'); }) }, 'Sign out'), ' ',
      h('button', { class: 'btn sec sm', onclick: CF.guard(async () => { if (!(await CF.confirm('Upload editor settings (fonts, theme, etc.) to your account? No source code is sent.', 'Sync'))) return; await cf.api.request('PUT', '/settings/', { font_family: S.settings.fontFamily, font_size: S.settings.fontSize, line_height: S.settings.lineHeight, ligatures: S.settings.ligatures, tab_size: S.settings.tabSize, auto_save: S.settings.autoSave, auto_save_delay: S.settings.autoSaveDelay }); CF.toast('Settings synced'); }) }, 'Sync settings')]
      : h('button', { class: 'btn sec sm', onclick: loginDialog }, 'Sign in'));
    CF.modal('Settings', [grid, prev, acct], [{ label: 'Open settings.json', cls: 'sec', run: CF.openSettingsJson }, { label: 'Reset to Defaults', cls: 'sec', run: CF.guard(async () => { await CF.setSetting({ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: '400', lineHeight: 1.5, letterSpacing: 0, ligatures: true, smoothFonts: true }); CF.closeOverlay(); CF.settingsDialog(); }) }, { label: 'Done' }], { wide: true });
    upd('fontSize', S.settings.fontSize);
  });
  const loginDialog = CF.guard(async () => {
    const v = await CF.ask('Sign in to CodeCambo', [{ id: 'u', label: 'Username' }, { id: 'p', label: 'Password', type: 'password' }], 'Sign in'); if (!v) return;
    await cf.api.login(v.u, v.p); CF.toast('Signed in (token stored in OS credential storage)');
  });

  // ---- updates -------------------------------------------------------------------------------------
  CF.checkUpdates = CF.guard(async (manual) => {
    const r = await cf.app.checkUpdates();
    const b = $('#update-banner');
    if (r.update_available) { b.hidden = false; b.textContent = `New version available: ${r.release.version} — Update`; b.onclick = () => { const dl = r.release.downloads.find((d) => d.platform === ({ win32: 'windows', darwin: 'macos', linux: 'linux' })[S.platform.platform]); if (dl) cf.app.openExternal(dl.url); }; }
    else if (manual) CF.toast('You are on the latest version.');
  });

  // ---- workspaces ---------------------------------------------------------------------------------------
  const saveWorkspace = CF.guard(async () => {
    if (!S.root) return CF.toast('Open a folder first', true);
    const v = await CF.ask('Save Workspace', [{ id: 'n', label: 'Workspace name', value: base(S.root) }], 'Save'); if (!v || !v.n) return;
    await cf.ws.save({ name: v.n, folders: [S.root], files: [...new Set(S.groups.flatMap((g) => g.tabs))], split: S.groups.length > 1 ? (S.vertical ? 'down' : 'right') : null, terminals: S.terms.map((t) => t.name), runConfigs: JSON.parse(localStorage.getItem('cf.runcfg.' + S.root) || '[]') });
    CF.toast('Workspace saved');
  });
  const openWorkspace = CF.guard(async () => {
    const list = await cf.ws.list(); if (!list.length) return CF.toast('No saved workspaces', true);
    const v = await CF.ask('Open Workspace', [{ id: 'n', label: 'Workspace', type: 'select', options: list.map((w) => w.name) }], 'Open'); if (!v) return;
    const ws = await cf.ws.load(v.n); await CF.setRoot(ws.folders[0]);
    if (ws.runConfigs) localStorage.setItem('cf.runcfg.' + S.root, JSON.stringify(ws.runConfigs));
    if (ws.split) CF.split(ws.split === 'down'); for (const f of ws.files || []) await CF.openFile(f).catch(() => {});
  });
  const closeWorkspace = () => { CF.closeAllEditors(); S.root = null; S.terms.forEach((t) => cf.term.kill(t.id)); CF.showView('explorer'); CF.renderWelcome(); };

  // ---- command palette ------------------------------------------------------------------------------------
  const COMMANDS = () => [
    ['Open Folder', CF.openFolder, 'Ctrl+O'], ['Go to File…', () => CF.quickOpen(), 'Ctrl+P'], ['Find Project…', () => CF.findProject(), 'Ctrl+R'],['New File', () => CF.newFile()], ['New Folder', () => CF.newFolder()], ['Open Terminal', () => CF.newTerminal(), 'Ctrl+Shift+`'], ['Split Terminal', () => CF.splitTerminal(), 'Ctrl+Shift+5'], ['Clear Terminal', () => CF.clearTerminal(), 'Ctrl+Shift+K'], ['Kill Terminal', () => CF.killTerminal(), 'Ctrl+Shift+W'], ['Rename Terminal…', () => CF.renameTerminal()], ['Keyboard Shortcuts', () => CF.shortcutsDialog(), 'Ctrl+K Ctrl+S'], ['GitLens: Toggle Line Blame', () => CF.toggleLineBlame(), 'Alt+B'], ['GitLens: Toggle File Blame', () => CF.toggleFileBlame(), 'Alt+Shift+B'], ['GitLens: File History', () => CF.fileHistory(), 'Alt+H'], ['GitLens: Line History', () => CF.lineHistory(), 'Alt+Shift+H'], ['GitLens: Open Sidebar', () => CF.showView('gitlens'), 'Alt+G'], ['Open Git Bash', () => CF.newTerminal('gitbash')],
    ['Git Clone', () => CF.cloneDialog()], ['Git Commit', () => { CF.showView('git'); setTimeout(() => $('#commit-msg') && $('#commit-msg').focus(), 300); }], ['Git Push', () => CF.gitCmd('Push', ['push'])], ['Git Pull', () => CF.gitCmd('Pull', ['pull'])],
    ['Run Project', () => CF.runProject(), 'F5'], ['Stop', CF.stopRun], ['Restart', CF.restartRun], ['Format Document', () => CF.activeGroup().editor.getAction('editor.action.formatDocument').run()],
    ['Change Font Size: Increase', () => CF.fontStep(1)], ['Change Font Size: Decrease', () => CF.fontStep(-1)], ['Change Font Size: Reset', () => CF.fontStep(0)],
    ['Toggle Sidebar', CF.toggleSidebar, 'Ctrl+B'], ['Toggle Terminal', CF.togglePanel, 'Ctrl+`'], ['Open Settings', CF.settingsDialog, 'Ctrl+,'],
    ['New Project…', () => CF.newProjectWizard()], ['Split Editor Right', () => CF.split(false)], ['Split Editor Down', () => CF.split(true)], ['Save All', CF.saveAll],
    ['Find in Files', () => CF.showView('search'), 'Ctrl+Shift+F'], ['Go to Line…', () => CF.activeGroup().editor.getAction('editor.action.gotoLine').run()],
    ['Save Workspace', saveWorkspace], ['Open Workspace', openWorkspace], ['Close Workspace', closeWorkspace], ['Check for Updates', () => CF.checkUpdates(true)],
    ['Preferences: File Icon Theme', () => CF.iconThemePicker()], ['View: Close Saved Editors', () => CF.closeSaved(CF.activeGroup())], ['View: Close All Editors', () => CF.closeAllEditors()], ['View: Toggle Tab Bar Close Buttons', () => CF.setSetting({ tabActions: CF.S.settings.tabActions === false })],
    ['Preferences: Color Theme', () => CF.themePicker(), 'Ctrl+K Ctrl+T'], ['Preferences: Import VS Code Theme…', () => CF.importVscodeTheme()], ['Install Extension from URL…', () => CF.installExtensionUrl()], ['Reload Extensions (download from settings.json)', () => CF.loadExtensions(true)], ['Open settings.json', () => CF.openSettingsJson()],
    ['Initialize Repository', () => CF.gitInit()], ['Show Problems', () => CF.showPanel('problems')], 
    ['AI: Explain Code (requires consent — not enabled)', () => CF.toast('AI features are not enabled. Nothing is ever sent without your explicit consent.')],
  ];
  CF.palette = () => {
    const o = $('#overlay'); o.innerHTML = ''; o.className = ''; o.hidden = false;
    const all = COMMANDS(); let sel = 0, shown = all;
    const list = h('div', { class: 'list' });
    const input = h('input', { placeholder: 'Type a command…', oninput: () => { const q = input.value.toLowerCase(); shown = all.filter((c) => c[0].toLowerCase().includes(q)); sel = 0; draw(); } });
    const draw = () => { list.innerHTML = ''; shown.forEach((c, i) => list.append(h('div', { class: 'it' + (i === sel ? ' sel' : ''), onclick: () => go(c) }, c[0], c[2] ? h('kbd', {}, c[2]) : null))); };
    const go = (c) => { CF.closeOverlay(); setTimeout(() => CF.guard(c[1])(), 0); };
    input.onkeydown = (e) => { if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); } else if (e.key === 'Enter' && shown[sel]) go(shown[sel]); else if (e.key === 'Escape') CF.closeOverlay(); };
    o.append(h('div', { class: 'palette' }, input, list)); o.onmousedown = (e) => { if (e.target === o) CF.closeOverlay(); }; draw(); input.focus();
  };

  // ---- native menu & shortcuts -------------------------------------------------------------------------------
  const ed = () => CF.activeGroup().editor;
  const MENU = {
    'open-folder': CF.openFolder, 'new-file': () => CF.newFile(), 'new-folder': () => CF.newFolder(), save: () => CF.save(), 'save-all': CF.saveAll, 'save-workspace': saveWorkspace, 'open-workspace': openWorkspace, 'close-workspace': closeWorkspace,
    search: () => CF.showView('search'), 'select-all': () => ed().trigger('menu', 'selectAll'), palette: CF.palette, 'toggle-sidebar': CF.toggleSidebar, 'toggle-terminal': CF.togglePanel,
    'font-inc': () => CF.fontStep(1), 'font-dec': () => CF.fontStep(-1), 'font-reset': () => CF.fontStep(0), 'goto-line': () => ed().getAction('editor.action.gotoLine').run(), 'goto-def': () => ed().getAction('editor.action.revealDefinition').run(),
    run: () => CF.runProject(), stop: CF.stopRun, restart: CF.restartRun, 'new-terminal': () => CF.newTerminal(), 'new-gitbash': () => CF.newTerminal('gitbash'),
    'git-clone': () => CF.cloneDialog(), 'git-init': () => CF.gitInit(), 'git-commit': () => CF.showView('git'), 'git-push': () => CF.gitCmd('Push', ['push']), 'git-pull': () => CF.gitCmd('Pull', ['pull']), 'git-fetch': () => CF.gitCmd('Fetch', ['fetch', '--all']),
    'quick-open': () => CF.quickOpen(), 'close-tab': () => CF.closeActiveTab(), 'next-tab': () => CF.cycleTab(1), 'prev-tab': () => CF.cycleTab(-1), split: () => CF.split(false),
    'view-explorer': () => CF.showView('explorer'), 'view-git': () => CF.showView('git'), 'view-gitlens': () => CF.showView('gitlens'), 'split-terminal': () => CF.splitTerminal(), 'clear-terminal': () => CF.clearTerminal(), 'view-extensions': () => CF.showView('extensions'),
    'toggle-tab-actions': () => CF.setSetting({ tabActions: CF.S.settings.tabActions === false }), 'check-updates': () => CF.checkUpdates(true), settings: CF.settingsDialog,
  };
  CF.bindMenu = () => cf.onMenu((id) => MENU[id] && CF.guard(MENU[id])());
})();
