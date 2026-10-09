// Settings page (editor tab "settings://main"): category nav, grouped cards, searchable rows. Every control writes through CF.setSetting.
(() => {
  const { S, $, h } = CF;
  const id = (k) => 'st-' + k;
  const ST = { q: '', cat: 'editor' };

  const render = async (g) => {
    const s = S.settings, loggedIn = await cf.api.loggedIn().catch(() => false);
    const prev = h('div', { class: 'st-preview mono', 'aria-label': 'Font preview' }, 'const message = "Hello World";\n\nconsole.log(message);   // => != === <= >= ->');
    const syncPreview = () => { const t = S.settings; Object.assign(prev.style, { fontFamily: `"${t.fontFamily}"`, fontSize: t.fontSize + 'px', lineHeight: String(t.lineHeight), fontWeight: t.fontWeight, letterSpacing: t.letterSpacing + 'px', fontVariantLigatures: t.ligatures ? 'normal' : 'none' }); };
    const upd = async (k, v) => { await CF.setSetting({ [k]: v }); syncPreview(); };

    // ---- controls ----
    const sel = (k, opts) => h('select', { id: id(k), 'aria-label': k, onchange: (e) => upd(k, e.target.value) }, opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(s[k]) }, l); }));
    const num = (k, step = 1, min = 0, max = 99) => h('input', { id: id(k), type: 'number', step, min, max, value: s[k], onchange: (e) => upd(k, +e.target.value) });
    const txt = (k, ...extra) => h('div', { class: 'st-multi' }, h('input', { id: id(k), type: 'text', value: s[k] || '', spellcheck: 'false', onchange: (e) => upd(k, e.target.value) }), ...extra);
    const sw = (k) => h('label', { class: 'st-sw' }, h('input', { id: id(k), type: 'checkbox', role: 'switch', checked: !!s[k], onchange: (e) => upd(k, e.target.checked) }), h('span', { class: 'st-track' }));
    const btn = (label, fn, cls = 'sec') => h('button', { class: 'xbtn ' + cls, onclick: CF.guard(fn) }, label);
    const setTok = (k, v) => { const tc = { ...(S.settings.tokenColors || {}) }; if (v) tc[k] = v; else delete tc[k]; return CF.setSetting({ tokenColors: tc }); };
    const detect = btn('Detect', async () => { const p = await cf.term.detectGitBash(); if (p) { $('#' + id('gitBashPath')).value = p; await CF.setSetting({ gitBashPath: p }); CF.toast('Found Git Bash:\n' + p); } else CF.toast('Git Bash not found. Install Git for Windows or set the path.', true); });

    const item = (label, ctl, desc = '', tags = '') => h('div', { class: 'st-item', 'data-s': `${label} ${desc} ${tags}`.toLowerCase() },
      h('div', { class: 'st-lab' }, h('div', { class: 'st-t' }, label), desc ? h('div', { class: 'st-d' }, desc) : null), h('div', { class: 'st-ctl' }, ctl));
    const card = (title, ...kids) => h('section', { class: 'st-card' }, h('h3', { class: 'st-gh' }, title), ...kids);

    const tokenRows = CF.TOKEN_KEYS.map(([k, label]) => {
      const cur = (S.settings.tokenColors || {})[k]; const pick = h('input', { type: 'color', value: cur || '#cccccc', 'aria-label': label + ' color', onchange: (e) => setTok(k, e.target.value) });
      return item(label, h('div', { class: 'st-multi' }, pick, h('button', { class: 'xbtn ghost', title: 'Use the theme color', onclick: () => { setTok(k, null); pick.value = '#cccccc'; } }, 'Reset')), '', 'syntax color token');
    });

    // ---- categories -> cards -> rows ----
    const CATS = [
      ['editor', 'Editor', [
        card('Font', item('Font family', sel('fontFamily', ['JetBrains Mono', 'Consolas', 'Menlo', 'Fira Code', 'Cascadia Code', 'monospace']), 'Falls back to JetBrains Mono, Consolas, then any monospace font.'),
          item('Font size', sel('fontSize', CF.FONT_SIZES.map((x) => [x, x + 'px'])), 'Also changed by the font size shortcuts.'), item('Line height', num('lineHeight', 0.1, 1, 3), 'A multiple of the font size (1.5 = 150%).'),
          item('Font weight', sel('fontWeight', [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['700', 'Bold']])), item('Letter spacing', num('letterSpacing', 0.1, -2, 5), 'In pixels.'),
          item('Ligatures', sw('ligatures'), 'Join characters such as => and != into single symbols.'), item('Smooth font rendering', sw('smoothFonts'), 'Use antialiased text.'), h('div', { class: 'st-item st-prevrow', 'data-s': 'font preview' }, prev)),
        card('Behavior', item('Minimap', sw('minimap'), 'Show the code overview on the right edge.'), item('Word wrap', sw('wordWrap'), 'Wrap long lines instead of scrolling sideways.'), item('Tab size', num('tabSize', 1, 1, 8), 'Spaces per tab.'),
          item('Insert spaces', sw('insertSpaces'), 'Insert spaces when you press Tab.'), item('Bracket pair colors', sw('bracketColors'), 'Color matching brackets by nesting level.'), item('Sticky scroll', sw('stickyScroll'), 'Keep the current scope header pinned while scrolling.')),
        card('Saving', item('Auto save', sel('autoSave', [['off', 'Off'], ['afterDelay', 'After delay'], ['onFocusChange', 'When focus changes'], ['onWindowChange', 'When window changes']])), item('Auto save delay (ms)', num('autoSaveDelay', 100, 100, 60000), 'Used when Auto save is “After delay”.'),
          item('Trim trailing whitespace', sw('trimWhitespace'), 'Remove spaces at the end of lines on save (never for Markdown).'), item('Insert final newline', sw('finalNewline'), 'Make sure files end with a newline on save.')),
        card('Syntax colors', h('div', { class: 'st-note' }, 'Override individual token colors. “Reset” goes back to the active theme.'), ...tokenRows)]],
      ['terminal', 'Terminal', [
        card('Appearance', item('Font family', txt('termFontFamily'), 'Leave blank to use the editor font.'), item('Font size', num('termFontSize', 1, 8, 32)), item('Line height', num('termLineHeight', 0.05, 1, 2)),
          item('Cursor style', sel('termCursorStyle', [['block', 'Block'], ['bar', 'Bar'], ['underline', 'Underline']])), item('Cursor blink', sw('termCursorBlink'))),
        card('Shell', item('Default shell', sel('defaultShell', [['', 'Auto'], ...S.shells.map((x) => [x.id, x.name])]), 'Used for new terminals. Auto picks the platform default.'),
          item('Git Bash path', txt('gitBashPath', detect), 'Windows only. Leave blank to detect it automatically.'), item('PowerShell path', txt('powershellPath'), 'Leave blank for the default.'), item('CMD path', txt('cmdPath'), 'Leave blank for the default.'))]],
      ['git', 'Git', [card('Repository', item('Git path', txt('gitPath'), 'Leave blank to use the git found on your system.'), item('Default branch', txt('gitDefaultBranch'), 'Branch name used when you initialize a repository.'))]],
      ['appearance', 'Appearance', [
        card('Theme', item('Color theme', h('div', { class: 'st-multi' }, sel('theme', Object.entries(CF.THEMES).map(([k, v]) => [k, v.name])), btn('Preview…', () => CF.themePicker()), btn('Import…', () => CF.importVscodeTheme())), 'Applies to the whole app. Import brings in a VS Code theme file.'),
          item('File icon theme', sel('iconTheme', Object.entries(CF.ICON_THEMES)))),
        card('Layout', item('Sidebar', sw('sidebar')), item('Activity bar', sw('activityBar')), item('Status bar', sw('statusBar')), item('Tab bar buttons', sw('tabActions'), 'Show “Close Saved” and “Close All” in the tab bar.'))]],
      ['keyboard', 'Keyboard', [card('Shortcuts', item('Keyboard shortcuts', btn('Open', () => CF.shortcutsDialog()), 'See every command and click a shortcut to change it.'), item('keyboard.json', btn('Open file', () => CF.openKeyboardJson()), 'Edit the same bindings by hand. Changes apply when you save.'))]],
      ['account', 'Updates & account', [
        card('Updates', item('Automatic updates', sw('autoUpdate'), 'Check for new Asta versions automatically.'), item('Check now', btn('Check for updates', () => CF.checkUpdates(true)))),
        card('Account (optional)', loggedIn
          ? item('Signed in', h('div', { class: 'st-multi' }, btn('Sync settings', async () => { if (!(await CF.confirm('Upload editor settings (fonts, theme, etc.) to your account? No source code is sent.', 'Sync'))) return; await cf.api.request('PUT', '/settings/', { font_family: S.settings.fontFamily, font_size: S.settings.fontSize, line_height: S.settings.lineHeight, ligatures: S.settings.ligatures, tab_size: S.settings.tabSize, auto_save: S.settings.autoSave, auto_save_delay: S.settings.autoSaveDelay }); CF.toast('Settings synced'); }), btn('Sign out', async () => { await cf.api.logout(); CF.toast('Signed out'); CF.renderPage(g); })), 'Syncing uploads editor settings only. Source code is never sent.')
          : item('Not signed in', btn('Sign in', () => CF.loginDialog()), 'An account is optional and only used to sync editor settings.'))]],
    ];

    // ---- shell: header, nav (one tab per category), search + content ----
    const empty = h('div', { class: 'xempty', hidden: true }, h('b', {}, 'No settings match your search'), h('div', {}, 'Try a different word, or pick a category on the left.'));
    const content = h('div', { class: 'st-content' }, ...CATS.map(([cid, title, cards]) => h('div', { class: 'st-cat', id: 'st-cat-' + cid, 'data-cat': cid }, h('h2', { class: 'st-ch' }, title), ...cards)), empty);
    const counts = {};
    const nav = h('nav', { class: 'st-nav', 'aria-label': 'Settings categories' }, ...CATS.map(([cid, title]) => { const cnt = h('span', { class: 'st-cnt', hidden: true }); counts[cid] = cnt;
      return h('button', { class: 'st-nb', 'data-cat': cid, 'aria-current': 'false', onclick: () => { ST.q = ''; search.value = ''; ST.cat = cid; filter(); g.page.scrollTop = 0; } }, title, cnt); }));
    const filter = () => {
      const q = ST.q.trim().toLowerCase(); let any = false; clearBtn.hidden = !q;
      content.querySelectorAll('.st-cat').forEach((c) => { const cid = c.dataset.cat; let n = 0;
        c.querySelectorAll('.st-card').forEach((cd) => { let m = 0; cd.querySelectorAll('.st-item').forEach((it) => { const ok = !q || (it.dataset.s || '').includes(q) || (cd.firstChild.textContent + ' ' + c.firstChild.textContent).toLowerCase().includes(q); it.hidden = !ok; if (ok) m++; }); cd.hidden = !m; n += m; });
        counts[cid].hidden = !q || !n; counts[cid].textContent = n;
        c.hidden = q ? !n : cid !== ST.cat;           // no query: only the selected tab; query: every category with a match
        if (!c.hidden) any = true; });
      nav.querySelectorAll('.st-nb').forEach((b) => { const on = !q && b.dataset.cat === ST.cat; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
      empty.hidden = any;
    };
    const search = h('input', { type: 'text', placeholder: 'Search all settings…', 'aria-label': 'Search all settings', value: ST.q, spellcheck: 'false', oninput: (e) => { ST.q = e.target.value; filter(); },
      onkeydown: (e) => { if (e.key === 'Escape' && ST.q) { e.stopPropagation(); ST.q = ''; search.value = ''; filter(); } } });
    const clearBtn = h('button', { class: 'xbtn ghost', title: 'Clear search (Esc)', 'aria-label': 'Clear search', hidden: true, onclick: () => { ST.q = ''; search.value = ''; filter(); search.focus(); } }, CF.icon('close', 13));
    const el = h('div', { class: 'xdlg stpage' },
      h('header', { class: 'st-head' }, h('div', {}, h('h1', {}, 'Settings'), h('p', {}, 'Changes apply immediately and are saved to settings.json.')),
        h('div', { class: 'st-hact' }, h('button', { class: 'xbtn sec', title: 'Open settings.json in the editor', onclick: CF.guard(async () => CF.openSettingsJson()) }, CF.icon('settings', 13), 'settings.json'),
          h('button', { class: 'xbtn sec', title: 'Reset the editor font settings to their defaults', onclick: CF.guard(async () => { await CF.setSetting({ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: '400', lineHeight: 1.5, letterSpacing: 0, ligatures: true, smoothFonts: true }); CF.toast('Editor font settings reset'); CF.renderPage(g); }) }, 'Reset fonts'))),
      h('div', { class: 'st-body' }, nav, h('div', { class: 'st-main' }, h('div', { class: 'xsearch st-search' }, CF.icon('search', 14), search, clearBtn), content)));
    const top = g.page.scrollTop; g.page.replaceChildren(el); g.page.scrollTop = top; syncPreview(); filter();
  };
  CF.pages.settings = { icon: 'settings', title: () => 'Settings', render };
  CF.settingsDialog = () => CF.openFile('settings://main');
})();
