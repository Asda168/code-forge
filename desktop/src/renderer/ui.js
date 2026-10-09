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
  CF.toggleSidebar = () => { S.settings.sidebar = !S.settings.sidebar; $('#app').classList.toggle('no-sidebar', !S.settings.sidebar); const relayout = () => { S.groups.forEach((g) => g.editor.layout()); S.terms.forEach((t) => t.fit()); }; relayout(); requestAnimationFrame(relayout); };

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
    CF.gitblameOn && CF.gitblameOn(list.some((x) => x.enabled && !x.error && (x.navigation || []).includes('gitblame')));
    CF.gitlensOn && CF.gitlensOn(list.some((x) => x.enabled && !x.error && (x.navigation || []).includes('gitlens')));
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
  // ---- extensions view: search, filters, cards, details. All data comes from real manifests (catalog + installed). ----
  const X = { q: '', filter: 'all', sort: 'relevance' };
  const xBusy = new Map(), xErr = new Map(); let xRedraw = null; const xNames = new Map();
  const srcLabel = (e) => { const s = String(e.source || ''); if (s === 'bundled') return 'Asta catalog'; if (s === 'imported') return 'Imported theme'; if (s.startsWith('custom')) return 'Local file'; try { return new URL(s).hostname; } catch { return s || 'Unknown source'; } };
  const catsOf = (e) => [(e.themes || []).length && 'Themes', (Object.keys(e.snippets || {}).length || Object.keys(e.fileAssociations || {}).length) && 'Languages', (e.navigation || []).length && 'Productivity', (e.navigation || []).some((n) => n === 'gitlens' || n === 'gitblame') && 'Git'].filter(Boolean);
  const featuresOf = (e) => [...Object.entries(e.snippets || {}).map(([l, s]) => `${s.length} ${l} snippet${s.length === 1 ? '' : 's'}`), ...Object.entries(e.fileAssociations || {}).map(([x, l]) => `Opens ${x} files as ${l}`),
    ...(e.navigation || []).map((n) => ({ laravel: 'Laravel go-to-definition navigation', gitlens: 'GitLens history and blame view', gitblame: 'Git blame in the status bar' })[n])].filter(Boolean);
  const themeBase = (t) => (t.base === 'vs' ? '#1f2328' : '#e6e6e6');
  const swatch = (t, cls = '') => { const u = t.ui || {}, ed = t.ed || {}; return h('div', { class: 'sw ' + cls, title: t.name + ' colors', 'aria-hidden': 'true' }, h('i', { style: `background:${ed['editor.background'] || u['--bg'] || '#1e1e1e'}` }), h('i', { style: `background:${u['--accent'] || '#8ab4f8'}` }), h('i', { style: `background:${u['--cyan'] || u['--side'] || '#444'}` })); };
  const extIcon = (e) => (e.themes || [])[0] ? swatch(e.themes[0], 'ext-ic') : h('div', { class: 'ext-ic', style: `background:${e.color || '#8b5cf6'}`, 'aria-hidden': 'true' }, e.icon || (e.name || '?')[0].toUpperCase());
  const themeActive = (t) => S.settings.theme === t.id;
  const xApply = CF.guard(async (t) => { const cur = S.settings.theme; if (cur !== t.id) try { localStorage.setItem('cf.prevTheme', cur); } catch { /* optional */ } await CF.setSetting({ theme: t.id }); CF.toast(`Theme: ${t.name}`); xPaint(); });
  const prevTheme = () => { try { const p = localStorage.getItem('cf.prevTheme'); return p && p !== S.settings.theme && CF.THEMES[p] ? p : null; } catch { return null; } };
  const xData = async () => { const cat = await cf.ext.catalog().catch(() => []); const have = new Set((S.extensions || []).map((x) => x.id)); const all = [...(S.extensions || []).map((e) => ({ e, installed: true })), ...cat.filter((c) => !have.has(c.id)).map((e) => ({ e, installed: false }))]; all.forEach(({ e }) => xNames.set(e.id, e.name)); return all; };
  const xPaint = () => { xRedraw && xRedraw(false); refreshPages(); };
  const xAfter = async () => { await CF.loadExtensions(); xRedraw && await xRedraw(true); refreshPages(); };
  const xRun = async (e, label, fn, ok) => {
    if (xBusy.has(e.id)) return;                                  // no duplicate requests while one is running
    xBusy.set(e.id, label); xErr.delete(e.id); xPaint();
    try { await fn(); ok && CF.toast(ok); } catch (err) { xErr.set(e.id, String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); }
    finally { xBusy.delete(e.id); }
    await xAfter();
  };
  const setDisabled = (e, off) => xRun(e, off ? 'Disabling…' : 'Enabling…', async () => { const cur = new Set(S.settings.disabledExtensions || []); off ? cur.add(e.id) : cur.delete(e.id); await CF.setSetting({ disabledExtensions: [...cur] }); });
  const xInstall = (e) => xRun(e, 'Installing…', () => cf.ext.installBundled(e.id), `Installed ${e.name}`);
  const xUninstall = (e) => xRun(e, 'Uninstalling…', () => cf.ext.uninstall(e.id), `Uninstalled ${e.name}`);
  const stop = (fn) => (ev) => { ev.stopPropagation(); fn(ev); };
  const pill = (txt, cls = '') => h('span', { class: 'xpill ' + cls }, cls === 'ok' ? CF.icon('check', 11) : null, txt);
  const actions = (e, installed) => {
    const busy = xBusy.get(e.id), out = [];
    if (busy) return [h('button', { class: 'xbtn sec', disabled: true, 'aria-busy': 'true' }, h('span', { class: 'spin' }), busy)];
    if (!installed) return [h('button', { class: 'xbtn', onclick: stop(() => xInstall(e)) }, xErr.has(e.id) ? 'Retry install' : 'Install')];
    const custom = String(e.source).startsWith('custom');
    const more = (items) => h('button', { class: 'xbtn ghost', title: 'Manage ' + e.name, 'aria-label': 'Manage ' + e.name, onclick: stop((ev) => CF.menu(ev, items)) }, CF.icon('more', 15));
    const items = [[e.enabled ? 'Disable' : 'Enable', () => setDisabled(e, e.enabled)], ['Details', () => openDetails(e.id)], ...(custom ? [] : [['Uninstall', () => xUninstall(e)]])];
    if (e.error) return [pill('Error', 'err')];
    const t = (e.themes || [])[0];
    if (!e.enabled) out.push(pill('Disabled', 'off'), h('button', { class: 'xbtn sec', onclick: stop(() => setDisabled(e, false)) }, 'Enable'));
    else { out.push(pill('Installed', 'ok')); if (t) out.push((e.themes.length === 1 && themeActive(t)) ? pill('Active theme', 'acc') : h('button', { class: 'xbtn', onclick: stop(() => (e.themes.length === 1 ? xApply(t) : openDetails(e.id))) }, e.themes.length === 1 ? 'Apply' : 'Themes…')); }
    out.push(more(items)); return out;
  };
  const xrow = ({ e, installed }) => {
    const err = xErr.get(e.id);
    return h('div', { class: 'xrow' + (installed && !e.enabled ? ' off' : ''), role: 'listitem', tabindex: '0', 'aria-label': `${e.name} ${e.version}`, onclick: (ev) => { if (!ev.target.closest('button')) openDetails(e.id); },
      onkeydown: (ev) => { if (ev.target !== ev.currentTarget) return; const rows = $$('.xrow', ev.currentTarget.parentNode), i = rows.indexOf(ev.currentTarget);
        if (ev.key === 'Enter') openDetails(e.id); else if (ev.key === 'ArrowDown' && rows[i + 1]) { ev.preventDefault(); rows[i + 1].focus(); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); (rows[i - 1] || $('.xsearch input')).focus(); } } },
      extIcon(e),
      h('div', { class: 'xmain' },
        h('div', { class: 'xtitle' }, h('b', { title: e.name }, e.name), h('small', {}, 'v' + e.version)),
        h('div', { class: 'xsrc' }, srcLabel(e)),
        e.error ? h('div', { class: 'xerr' }, e.error) : h('div', { class: 'xdesc' }, e.description || ''),
        err ? h('div', { class: 'xerr', role: 'alert' }, `⚠ ${installed ? 'Action' : 'Install'} failed: ${err}`) : null,
        h('div', { class: 'xtags' }, catsOf(e).map((c) => h('span', { class: 'xtag' }, c)))),
      h('div', { class: 'xact' }, ...actions(e, installed)));
  };
  const textOf = ({ e }) => [e.name, e.id, e.description, srcLabel(e), ...catsOf(e), ...(e.themes || []).map((t) => t.name), ...Object.keys(e.snippets || {})].join(' ').toLowerCase();
  const FILTERS = [['all', 'All'], ['installed', 'Installed'], ['enabled', 'Enabled'], ['disabled', 'Disabled'], ['Themes', 'Themes'], ['Languages', 'Languages'], ['Productivity', 'Productivity']];
  const passes = (it) => ({ all: () => true, installed: () => it.installed, enabled: () => it.installed && it.e.enabled && !it.e.error, disabled: () => it.installed && !it.e.enabled })[X.filter]?.() ?? catsOf(it.e).includes(X.filter);
  const score = ({ e }, q) => (e.name.toLowerCase().startsWith(q) ? 3 : e.name.toLowerCase().includes(q) ? 2 : 1);
  const sorter = (q) => ({
    relevance: (a, b) => (q ? score(b, q) - score(a, q) : 0) || (a.installed - b.installed) || a.e.name.localeCompare(b.e.name),
    name: (a, b) => a.e.name.localeCompare(b.e.name),
    recent: (a, b) => (b.e.installedAt || 0) - (a.e.installedAt || 0) || a.e.name.localeCompare(b.e.name),
    installed: (a, b) => (b.installed - a.installed) || a.e.name.localeCompare(b.e.name),
  })[X.sort];
  async function renderExtensions(body) {
    let data = await xData(); const wrap = h('div', { class: 'xv' }); body.append(wrap);
    const count = h('span', { class: 'xcount' }), sub = h('div', { class: 'xsub' }), list = h('div', { class: 'xlist', role: 'list' });
    const chips = h('div', { class: 'xchips', role: 'group', 'aria-label': 'Filter extensions' });
    const drawChips = () => { chips.innerHTML = ''; FILTERS.forEach(([k, label]) => chips.append(h('button', { class: 'xchip' + (X.filter === k ? ' on' : ''), 'aria-pressed': String(X.filter === k), onclick: () => { X.filter = k; drawChips(); draw(); } }, label))); };
    const draw = () => {
      const q = X.q.trim().toLowerCase(), shown = data.filter(passes).filter((it) => !q || textOf(it).includes(q)).sort(sorter(q));
      count.textContent = data.length; const n = data.filter((d) => d.installed).length;
      sub.textContent = `${n} installed · ${data.length - n} available`; list.innerHTML = '';
      shown.forEach((it) => list.append(xrow(it)));
      if (!shown.length) list.append(h('div', { class: 'xempty' }, h('b', {}, q ? `No extensions match “${X.q.trim()}”` : 'Nothing here yet'), h('div', {}, q || X.filter !== 'all' ? 'Try a different search or clear the filters.' : 'No extensions found.'),
        h('div', { class: 'xempty-act' }, (q || X.filter !== 'all') ? h('button', { class: 'xbtn sec', onclick: () => { X.q = ''; X.filter = 'all'; input.value = ''; clear.hidden = true; drawChips(); draw(); } }, 'Clear search and filters') : null, h('button', { class: 'xbtn sec', onclick: CF.installExtensionUrl }, 'Install from URL…'))));
      list.setAttribute('aria-label', `${shown.length} extensions`);
    };
    xRedraw = async (reload) => { if (!document.body.contains(wrap)) return; if (reload) data = await xData(); draw(); };
    let tm; const input = h('input', { type: 'text', 'aria-label': 'Search extensions', placeholder: 'Search extensions in Marketplace', value: X.q, spellcheck: 'false',
      oninput: (e) => { X.q = e.target.value; clear.hidden = !X.q; clearTimeout(tm); tm = setTimeout(draw, 120); },
      onkeydown: (e) => { if (e.key === 'Escape') { X.q = ''; input.value = ''; clear.hidden = true; draw(); } else if (e.key === 'ArrowDown') { const r = $('.xrow', list); if (r) { e.preventDefault(); r.focus(); } } } });
    const clear = h('button', { class: 'xbtn ghost', title: 'Clear search', 'aria-label': 'Clear search', hidden: !X.q, onclick: () => { X.q = ''; input.value = ''; clear.hidden = true; draw(); input.focus(); } }, CF.icon('close', 13));
    const menu = (ev) => { const r = ev.currentTarget.getBoundingClientRect(); CF.menu({ clientX: Math.max(8, r.right - 200), clientY: r.bottom + 4 }, [['Install from URL…', CF.installExtensionUrl], ['Import VS Code theme…', () => CF.importVscodeTheme()], ['Sync extension sources', async () => { await CF.loadExtensions(true); xRedraw(true); }], '-', ['Open settings.json', CF.openSettingsJson], ['Settings…', () => CF.settingsDialog()], ['Check for app updates', () => CF.checkUpdates(true)]]); };
    const sortSel = h('select', { 'aria-label': 'Sort extensions', onchange: (e) => { X.sort = e.target.value; draw(); } }, [['relevance', 'Relevance'], ['name', 'Name'], ['recent', 'Recently installed'], ['installed', 'Installed first']].map(([v, l]) => h('option', { value: v, selected: X.sort === v }, l)));
    wrap.append(
      h('div', { class: 'xhead' }, h('div', { class: 'xhead-t' }, h('h2', {}, 'Extensions'), count), h('button', { class: 'xbtn ghost', title: 'More actions', 'aria-label': 'More extension actions', onclick: menu }, CF.icon('more', 16))),
      sub,
      h('div', { class: 'xsearch' }, CF.icon('search', 14), input, clear, h('kbd', { title: 'Open Extensions' }, 'Ctrl+Shift+X')),
      chips,
      h('div', { class: 'xsort' }, h('label', {}, 'Sort by'), sortSel),
      list);
    drawChips(); draw(); setTimeout(() => input.focus(), 0);
  }

  // ---- details ---------------------------------------------------------------------------------
  // a small, accurate mock window drawn only from the theme's own colors
  const themePreview = (t) => {
    const u = t.ui || {}, ed = t.ed || {}, c = (k, d) => u[k] || d, bg = ed['editor.background'] || c('--bg', '#1e1e1e'), fg = c('--fg', themeBase(t));
    const line = (w, col) => h('i', { style: `width:${w}%;background:${col}` });
    return h('div', { class: 'tp', role: 'img', 'aria-label': `${t.name} preview`, style: `background:${c('--bg', bg)};border-color:${c('--border', '#333')}` },
      h('div', { class: 'tp-side', style: `background:${c('--side', bg)};border-color:${c('--border', '#333')}` }, line(70, c('--mut', fg)), line(50, c('--mut', fg)), line(60, c('--accent', fg))),
      h('div', { class: 'tp-ed', style: `background:${bg}` }, line(40, c('--accent', fg)), line(75, fg), line(55, c('--cyan', fg)), line(65, fg), line(30, c('--accent2', c('--accent', fg)))),
      h('div', { class: 'tp-bar', style: `background:${c('--status', c('--side', bg))};border-color:${c('--border', '#333')}` }, h('i', { style: `width:22%;background:${c('--accent', fg)}` })));
  };
  // Extension details open as an editor tab ("ext://<id>"), drawn into the group's page layer instead of a modal.
  const openDetails = (id) => CF.openFile('ext://' + id);
  const refreshPages = () => S.groups.forEach((g) => { if (CF.isPage(g.active)) CF.renderPage(g); });
  const renderExtPage = async (g) => {
    const id = String(g.active).slice(6), tok = (g.pageTok = (g.pageTok || 0) + 1);
    const data = await xData(); if (tok !== g.pageTok || g.active !== 'ext://' + id) return;    // a newer render / another tab won
    const el = detailsPage(data.find((d) => d.e.id === id), id), top = g.page.scrollTop;
    g.page.replaceChildren(el); g.page.scrollTop = top; CF.renderTabs();
  };
  CF.pages.ext = { icon: 'extensions', title: (p) => { const id = String(p).slice(6); return xNames.get(id) || id; }, render: renderExtPage };
  // ---- richer details: explanation text, an illustration drawn from the extension's own contents, optional screenshots ----
  const NAV_INFO = {
    laravel: ['Laravel navigation', 'Ctrl+click (or press F12) on a view name, class, controller method, config key, route name, Blade component or asset path to jump straight to its file.'],
    gitlens: ['GitLens', 'Adds the GitLens sidebar plus inline blame. Toggle line blame, file blame, file history and line history from the keyboard or the command palette.'],
    gitblame: ['Git blame in the status bar', 'Shows who last changed the line under your cursor (author, time and commit message) in the bottom status bar.'],
  };
  const keyOfCmd = (id) => (CF.keyLabel ? CF.keyLabel(id) : '');
  const para = (txt) => String(txt).split(/\n{2,}/).map((t) => h('p', { class: 'xd-p' }, t.trim())).filter((p) => p.textContent);
  // renders "${1:name}" placeholders as highlighted text without touching innerHTML
  const snipLine = (body) => { const out = []; let last = 0; body.replace(/\$\{\d+:([^}]*)\}|\$\{?\d+\}?/g, (m, def, i) => { out.push(body.slice(last, i)); if (def) out.push(h('mark', {}, def)); last = i + m.length; return m; }); out.push(body.slice(last)); return out; };
  const fig = (title, caption, ...kids) => h('figure', { class: 'xfig' }, h('div', { class: 'xwin' }, h('div', { class: 'xwin-bar' }, h('i'), h('i'), h('i'), h('span', {}, title)), h('div', { class: 'xwin-body' }, ...kids)), h('figcaption', {}, caption));
  const code = (...lines) => h('pre', { class: 'xcode' }, ...lines.flatMap((l, i) => [i ? '\n' : '', l]));
  const illustration = (e) => {
    const t = (e.themes || [])[0];
    if (t) { const u = t.ui || {}, ed = t.ed || {}, bg = ed['editor.background'] || u['--bg'] || '#1e1e1e', fg = u['--fg'] || themeBase(t), ac = u['--accent'] || fg, cy = u['--cyan'] || ac, mut = u['--mut'] || fg, side = u['--side'] || bg, bd = u['--border'] || '#333';
      const sp = (c, txt) => h('span', { style: `color:${c}` }, txt);
      return h('figure', { class: 'xfig' }, h('div', { class: 'xbig', style: `background:${bg};border-color:${bd};color:${fg}` },
        h('div', { class: 'xbig-side', style: `background:${side};border-color:${bd};color:${mut}` }, h('b', { style: `color:${ac}` }, 'EXPLORER'), h('div', {}, 'src'), h('div', {}, 'index.js'), h('div', {}, 'style.css')),
        h('div', { class: 'xbig-ed' }, code(h('span', {}, [sp(ac, 'function '), sp(cy, 'greet'), '(name) {'].map((x) => x)), h('span', {}, ['  ', sp(ac, 'return '), sp(cy, '`Hello, ${name}`'), ';']), '}', h('span', { style: `color:${mut}` }, '// the colors above come from this theme'))),
        h('div', { class: 'xbig-bar', style: `background:${u['--status'] || side};border-color:${bd};color:${mut}` }, h('span', { style: `color:${ac}` }, '⎇ main'), h('span', {}, 'Ln 3, Col 1'))),
        h('figcaption', {}, `Preview of ${t.name}, drawn from the theme's own colors.`)); }
    const snipLang = Object.keys(e.snippets || {})[0], first = snipLang && (e.snippets[snipLang] || [])[0];
    if (first && !(e.navigation || []).length) return fig(`example.${snipLang}`, `Illustration: type “${first.prefix}” in a ${snipLang} file, pick it from the suggestions, and it expands into the code shown.`,
      code(h('span', { class: 'xtype' }, first.prefix, h('span', { class: 'xcaret' }, '▏'))),
      h('div', { class: 'xsug' }, h('div', { class: 'xsug-i sel' }, h('b', {}, first.prefix), h('small', {}, 'Snippet'), h('span', {}, first.description || e.name))),
      h('div', { class: 'xarrow' }, '↓ expands to'),
      code(...first.body.split('\n').slice(0, 8).map((l) => h('span', {}, snipLine(l.replace(/\t/g, '    '))))));
    const nav = (e.navigation || [])[0];
    if (nav === 'gitblame' || nav === 'gitlens') return fig('app/Models/User.php', 'Illustration: the status bar shows who last changed the current line, with the author, how long ago, and the commit message.',
      code('class User extends Model', '{', h('span', { class: 'xhl' }, '    protected $fillable = [\'name\', \'email\'];  ', h('em', {}, '  you, 3 days ago · commit message')), '}'),
      h('div', { class: 'xstatus' }, h('span', {}, '⎇ main'), h('span', { class: 'grow' }), h('span', {}, 'you, 3 days ago · commit message')));
    if (nav === 'laravel') return fig('routes/web.php', 'Illustration: Ctrl+click a view, controller or config key and the editor opens the file it points to.',
      code(h('span', {}, ['Route::get(\'/\', fn () => ', h('u', {}, 'view(\'welcome\')'), ');']), h('span', { class: 'xarrow' }, '↓ Ctrl+click opens'), h('span', { class: 'xfile' }, 'resources/views/welcome.blade.php')));
    const fa = Object.entries(e.fileAssociations || {});
    if (fa.length) return fig('Explorer', 'Illustration: files with these extensions open with the matching language support.', h('div', { class: 'xfiles' }, ...fa.slice(0, 6).map(([x, l]) => h('div', {}, h('b', {}, 'example' + x), h('span', { class: 'xarrow' }, '→'), l))));
    return null;
  };
  const detailExtras = (e) => {
    const kids = [], fig0 = illustration(e); if (fig0) kids.push(fig0);
    if (e.readme) kids.push(h('section', { class: 'xd-sec' }, h('h4', {}, 'About'), ...para(e.readme)));
    const nav = (e.navigation || []).map((n) => NAV_INFO[n]).filter(Boolean);
    if (nav.length) kids.push(h('section', { class: 'xd-sec' }, h('h4', {}, 'What it adds'), ...nav.map(([t, d]) => h('div', { class: 'xd-feat' }, h('b', {}, t), h('div', {}, d)))));
    if ((e.screenshots || []).length) kids.push(h('section', { class: 'xd-sec' }, h('h4', {}, 'Screenshots'), h('div', { class: 'xshots' }, ...e.screenshots.map((s) => h('figure', {}, h('img', { src: s.src, alt: s.caption || e.name + ' screenshot', loading: 'lazy' }), s.caption ? h('figcaption', {}, s.caption) : null)))));
    for (const [lang, list] of Object.entries(e.snippets || {})) if (list.length) kids.push(h('section', { class: 'xd-sec' }, h('h4', {}, `${lang} snippets (${list.length})`), h('div', { class: 'xd-hint' }, `Type a prefix in a ${lang} file and choose it from the suggestions.`),
      h('div', { class: 'xsnips' }, ...list.slice(0, 40).map((s) => h('details', { class: 'xsnip' }, h('summary', {}, h('b', {}, s.prefix), h('span', {}, s.description || '')), code(...s.body.split('\n').slice(0, 14).map((l) => h('span', {}, snipLine(l.replace(/\t/g, '    '))))))))));

    const used = (e.navigation || []).includes('gitlens') ? [['Toggle line blame', 'blame-line'], ['Toggle file blame', 'blame-file'], ['File history', 'file-history'], ['Line history', 'line-history']].map(([l, id]) => [l, keyOfCmd(id)]).filter((x) => x[1]) : [];
    if (used.length) kids.push(h('section', { class: 'xd-sec' }, h('h4', {}, 'Keyboard shortcuts'), h('div', { class: 'xkeys' }, ...used.flatMap(([l, k]) => [h('span', {}, l), h('kbd', {}, k)])), h('div', { class: 'xd-hint' }, 'Change these in Keyboard Shortcuts.')));
    return kids;
  };
  function detailsPage(it, id) {
    if (!it) return h('div', { class: 'xdlg xdpage' }, h('div', { class: 'xempty' }, h('b', {}, 'This extension is no longer available'), h('div', {}, id), h('div', { class: 'xempty-act' }, h('button', { class: 'xbtn sec', onclick: () => { const g = CF.activeGroup(); CF.closeTab(g, 'ext://' + id, true); } }, 'Close tab'))));
    const { e, installed } = it; const err = xErr.get(id);
    const sec = (title, ...kids) => h('section', { class: 'xd-sec' }, h('h4', {}, title), ...kids);
    const st = !installed ? 'Not installed' : e.error ? 'Error' : e.enabled ? 'Installed and enabled' : 'Installed, disabled';
    const kids = [h('div', { class: 'xd-head' }, extIcon(e), h('div', { class: 'xd-id' }, h('div', { class: 'xtitle' }, h('b', {}, e.name), h('small', {}, 'v' + e.version)), h('div', { class: 'xsrc' }, srcLabel(e)), h('div', { class: 'xtags' }, catsOf(e).map((c) => h('span', { class: 'xtag' }, c)))), h('div', { class: 'xact' }, ...actions(e, installed))),
      h('p', { class: 'xd-desc' }, e.description || 'No description provided.'),
      err ? h('div', { class: 'xerr', role: 'alert' }, `⚠ Failed: ${err}`) : null, e.error ? h('div', { class: 'xerr' }, e.error) : null];
    kids.push(...detailExtras(e));
    const back = prevTheme();
    if ((e.themes || []).length) kids.push(sec('Color themes', ...e.themes.map((t) => h('div', { class: 'xd-theme' }, themePreview(t), h('div', { class: 'xd-theme-i' }, h('b', {}, t.name), h('div', { class: 'xsrc' }, t.base === 'vs' ? 'Light theme' : 'Dark theme'),
      installed && e.enabled ? (themeActive(t) ? h('div', { class: 'xrowbtns' }, pill('Active theme', 'acc'), back ? h('button', { class: 'xbtn sec', onclick: () => xApply({ id: back, name: CF.THEMES[back].name }) }, `Switch back to ${CF.THEMES[back].name}`) : null) : h('div', { class: 'xrowbtns' }, h('button', { class: 'xbtn', onclick: () => xApply(t) }, 'Apply theme')))
        : h('div', { class: 'xsrc' }, installed ? 'Enable the extension to apply this theme.' : 'Install the extension to apply this theme.'))))));
    const feats = featuresOf(e);
    if (feats.length) kids.push(sec('Features', h('ul', { class: 'xd-list' }, feats.map((f) => h('li', {}, f)))));
    const langs = [...new Set([...Object.keys(e.snippets || {}), ...Object.values(e.fileAssociations || {})])];
    if (langs.length) kids.push(sec('Supported languages', h('div', { class: 'xtags' }, langs.map((l) => h('span', { class: 'xtag' }, l)))));
    const meta = [['Status', st], ['Identifier', e.id], ['Version', e.version], ['Source', srcLabel(e)], e.installedAt ? ['Installed', new Date(e.installedAt).toLocaleString()] : null].filter(Boolean);
    kids.push(sec('Details', h('dl', { class: 'xd-meta' }, meta.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))));
    return h('div', { class: 'xdlg xdpage' }, ...kids);
  }

  // The settings UI lives in settings.js (an editor tab); it calls CF.loginDialog for the optional account sign-in.
  const loginDialog = CF.guard(async () => {
    const v = await CF.ask('Sign in to Asta IDE', [{ id: 'u', label: 'Username' }, { id: 'p', label: 'Password', type: 'password' }], 'Sign in'); if (!v) return;
    await cf.api.login(v.u, v.p); CF.toast('Signed in (token stored in OS credential storage)');
  });
  CF.loginDialog = loginDialog;

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
    await cf.ws.save({ name: v.n, folders: [S.root], files: [...new Set(S.groups.flatMap((g) => g.tabs))].filter((p) => !CF.isPage(p)), split: S.groups.length > 1 ? (S.vertical ? 'down' : 'right') : null, terminals: S.terms.map((t) => t.name), runConfigs: JSON.parse(localStorage.getItem('cf.runcfg.' + S.root) || '[]') });
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
    ['Toggle Sidebar', CF.toggleSidebar, 'Ctrl+B'], ['Toggle Terminal', CF.togglePanel, 'Ctrl+`'], ['Open Settings', () => CF.settingsDialog(), 'Ctrl+,'],
    ['New Project…', () => CF.newProjectWizard()], ['Split Editor Right', () => CF.split(false)], ['Split Editor Down', () => CF.split(true)], ['Save All', CF.saveAll],
    ['Find in Files', () => CF.showView('search'), 'Ctrl+Shift+F'], ['Go to Line…', () => CF.activeGroup().editor.getAction('editor.action.gotoLine').run()],
    ['Save Workspace', saveWorkspace], ['Open Workspace', openWorkspace], ['Close Workspace', closeWorkspace], ['Check for Updates', () => CF.checkUpdates(true)],
    ['Preferences: File Icon Theme', () => CF.iconThemePicker()], ['Preview: Toggle File Preview (Markdown, HTML, SVG)', () => CF.toggleMdPreview()], ['Git: Sync Changes', () => CF.gitSync && CF.gitSync()], ['View: Close Saved Editors', () => CF.closeSaved(CF.activeGroup())], ['View: Close All Editors', () => CF.closeAllEditors()], ['View: Toggle Tab Bar Close Buttons', () => CF.setSetting({ tabActions: CF.S.settings.tabActions === false })],
    ['New Window', () => cf.win.new(null)], ['Open Folder in New Window…', () => cf.win.newPick()], ['Open Project in New Window…', () => CF.findProject(true)],
    ['Preferences: Color Theme', () => CF.themePicker(), 'Ctrl+K Ctrl+T'], ['Preferences: Import VS Code Theme…', () => CF.importVscodeTheme()], ['Install Extension from URL…', () => CF.installExtensionUrl()], ['Reload Extensions (download from settings.json)', () => CF.loadExtensions(true)], ['Open settings.json', () => CF.openSettingsJson()],
    ['Preferences: Open Keyboard Shortcuts', () => CF.shortcutsDialog()], ['Preferences: Open keyboard.json', () => CF.openKeyboardJson()], ['Initialize Repository', () => CF.gitInit()], ['Show Problems', () => CF.showPanel('problems')], 
    ['AI: Explain Code (requires consent — not enabled)', () => CF.toast('AI features are not enabled. Nothing is ever sent without your explicit consent.')],
  ];
  CF.palette = () => {
    const o = $('#overlay'); o.innerHTML = ''; o.className = ''; o.hidden = false;
    const all = COMMANDS(); let sel = 0, shown = all;
    const list = h('div', { class: 'list' });
    const input = h('input', { placeholder: 'Type a command…', oninput: () => { const q = input.value.toLowerCase(); shown = all.filter((c) => c[0].toLowerCase().includes(q)); sel = 0; draw(); } });
    const draw = () => { list.innerHTML = ''; shown.forEach((c, i) => list.append(h('div', { class: 'it' + (i === sel ? ' sel' : ''), onclick: () => go(c) }, c[0], (() => { const k = CF.keyForTitle ? CF.keyForTitle(c[0], c[2]) : c[2]; return k ? h('kbd', {}, k) : null; })()))); };
    const go = (c) => { CF.closeOverlay(); setTimeout(() => CF.guard(c[1])(), 0); };
    input.onkeydown = (e) => { if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); } else if (e.key === 'Enter' && shown[sel]) go(shown[sel]); else if (e.key === 'Escape') CF.closeOverlay(); };
    o.append(h('div', { class: 'palette' }, input, list)); o.onmousedown = (e) => { if (e.target === o) CF.closeOverlay(); }; draw(); input.focus();
  };

  // ---- native menu & shortcuts -------------------------------------------------------------------------------
  const ed = () => CF.activeGroup().editor;
  const MENU = {
    'open-folder': CF.openFolder, 'new-window': () => cf.win.new(null), 'open-folder-new-window': () => cf.win.newPick(), 'new-file': () => CF.newFile(), 'new-folder': () => CF.newFolder(), save: () => CF.save(), 'save-all': CF.saveAll, 'save-workspace': saveWorkspace, 'open-workspace': openWorkspace, 'close-workspace': closeWorkspace,
    search: () => CF.showView('search'), 'select-all': () => ed().trigger('menu', 'selectAll'), palette: CF.palette, 'toggle-sidebar': CF.toggleSidebar, 'toggle-terminal': CF.togglePanel,
    'font-inc': () => CF.fontStep(1), 'font-dec': () => CF.fontStep(-1), 'font-reset': () => CF.fontStep(0), 'goto-line': () => ed().getAction('editor.action.gotoLine').run(), 'goto-def': () => ed().getAction('editor.action.revealDefinition').run(),
    run: () => CF.runProject(), stop: CF.stopRun, restart: CF.restartRun, 'new-terminal': () => CF.newTerminal(), 'new-gitbash': () => CF.newTerminal('gitbash'),
    'git-clone': () => CF.cloneDialog(), 'git-init': () => CF.gitInit(), 'git-commit': () => CF.showView('git'), 'git-push': () => CF.gitCmd('Push', ['push']), 'git-pull': () => CF.gitCmd('Pull', ['pull']), 'git-fetch': () => CF.gitCmd('Fetch', ['fetch', '--all']),
    'quick-open': () => CF.quickOpen(), 'close-tab': () => CF.closeActiveTab(), 'next-tab': () => CF.cycleTab(1), 'prev-tab': () => CF.cycleTab(-1), split: () => CF.split(false),
    'view-explorer': () => CF.showView('explorer'), 'view-git': () => CF.showView('git'), 'view-gitlens': () => CF.showView('gitlens'), 'split-terminal': () => CF.splitTerminal(), 'clear-terminal': () => CF.clearTerminal(), 'view-extensions': () => CF.showView('extensions'),
    'toggle-tab-actions': () => CF.setSetting({ tabActions: CF.S.settings.tabActions === false }), 'check-updates': () => CF.checkUpdates(true), settings: () => CF.settingsDialog(),
  };
  CF.menuCommands = MENU;
  CF.bindMenu = () => cf.onMenu((id) => (MENU[id] ? CF.guard(MENU[id])() : CF.runCommand && CF.runCommand(id)));
})();
