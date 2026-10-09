// Keyboard shortcuts: one registry of commands, user overrides from keyboard.json, a single key dispatcher (with chords),
// and the "Keyboard Shortcuts" editor tab where a binding is changed by clicking it and pressing the new keys.
// Defaults live in main.js (DEFAULT_KEYS); the user file is <userData>/keyboard.json: { "command-id": "ctrl+shift+b", "other": "" }.
(() => {
  const { S, $, h } = CF;
  const MAC = () => !!S.platform && S.platform.platform === 'darwin';
  const run = (id) => () => { const f = (CF.menuCommands || {})[id]; return f && f(); };

  // ---- command registry (title/alias match the command palette so it can show the current key) -----------------------------------
  const C = (id, title, cat, fn, extra = {}) => ({ id, title, cat, run: fn || run(id), ...extra });
  const COMMANDS = [
    C('palette', 'Command Palette…', 'General'), C('quick-open', 'Go to File…', 'General', null, { alias: 'Go to File…' }), C('find-project', 'Find Project…', 'General', () => CF.findProject(), { alias: 'Find Project…' }),
    C('settings', 'Open Settings', 'General', null, { alias: 'Open Settings' }), C('keyboard-shortcuts', 'Open Keyboard Shortcuts', 'General', () => CF.shortcutsDialog()), C('color-theme', 'Preferences: Color Theme', 'General', () => CF.themePicker()),
    C('toggle-preview', 'Toggle File Preview', 'General', () => CF.toggleMdPreview(), { when: '!terminal', alias: 'Preview: Toggle File Preview (Markdown, HTML, SVG)' }),
    C('new-window', 'New Window', 'File', null, { alias: 'New Window' }), C('open-folder-new-window', 'Open Folder in New Window…', 'File', null, { alias: 'Open Folder in New Window…' }),
    C('open-folder', 'Open Folder', 'File', null, { alias: 'Open Folder' }), C('new-file', 'New File', 'File', null, { alias: 'New File' }), C('save', 'Save', 'File'), C('save-all', 'Save All', 'File', null, { alias: 'Save All' }),
    C('close-tab', 'Close Editor', 'Editor'), C('next-tab', 'Next Editor', 'Editor'), C('prev-tab', 'Previous Editor', 'Editor'), C('split', 'Split Editor Right', 'Editor', null, { alias: 'Split Editor Right' }),
    C('goto-line', 'Go to Line…', 'Editor', null, { alias: 'Go to Line…' }), C('goto-def', 'Go to Definition', 'Editor'),
    C('view-explorer', 'Show Explorer', 'View'), C('search', 'Find in Files', 'View', null, { alias: 'Find in Files' }), C('view-git', 'Show Source Control', 'View'), C('view-gitlens', 'Show GitLens', 'View', () => CF.showView('gitlens')),
    C('view-run', 'Show Run and Debug', 'View', () => CF.showView('run')), C('view-extensions', 'Show Extensions', 'View'), C('toggle-sidebar', 'Toggle Sidebar', 'View', null, { alias: 'Toggle Sidebar' }),
    C('toggle-panel', 'Toggle Panel', 'View', () => CF.togglePanel()), C('toggle-terminal', 'Toggle Terminal', 'View', null, { alias: 'Toggle Terminal' }), C('show-problems', 'Show Problems', 'View', () => CF.showPanel('problems'), { alias: 'Show Problems' }),
    C('show-debug', 'Show Debug Console', 'View', () => CF.showPanel('debug')),
    C('font-inc', 'Increase Editor Font Size', 'View', null, { alias: 'Change Font Size: Increase', when: '!terminal' }), C('font-dec', 'Decrease Editor Font Size', 'View', null, { alias: 'Change Font Size: Decrease', when: '!terminal' }), C('font-reset', 'Reset Editor Font Size', 'View', null, { alias: 'Change Font Size: Reset', when: '!terminal' }),
    C('new-terminal', 'New Terminal', 'Terminal', null, { alias: 'Open Terminal' }), C('split-terminal', 'Split Terminal Right', 'Terminal', () => CF.splitTerminal('row'), { alias: 'Split Terminal' }), C('term-split-down', 'Split Terminal Down', 'Terminal', () => CF.splitTerminal('col')),
    C('term-close-pane', 'Close Terminal Pane', 'Terminal', () => CF.closeActivePane && CF.closeActivePane(), { when: 'terminal' }), C('clear-terminal', 'Clear Terminal', 'Terminal', () => CF.clearTerminal(), { alias: 'Clear Terminal', when: 'terminal' }),
    C('term-font-inc', 'Increase Terminal Font Size', 'Terminal', () => CF.termFontStep(1), { when: 'terminal' }), C('term-font-dec', 'Decrease Terminal Font Size', 'Terminal', () => CF.termFontStep(-1), { when: 'terminal' }), C('term-font-reset', 'Reset Terminal Font Size', 'Terminal', () => CF.termFontStep(0), { when: 'terminal' }),
    C('run', 'Run Project', 'Run', null, { alias: 'Run Project' }), C('stop', 'Stop', 'Run', null, { alias: 'Stop' }), C('restart', 'Restart', 'Run', null, { alias: 'Restart' }),
    C('blame-line', 'GitLens: Toggle Line Blame', 'GitLens', () => CF.toggleLineBlame()), C('blame-file', 'GitLens: Toggle File Blame', 'GitLens', () => CF.toggleFileBlame()),
    C('file-history', 'GitLens: File History', 'GitLens', () => CF.fileHistory()), C('line-history', 'GitLens: Line History', 'GitLens', () => CF.lineHistory()),
  ];
  const BY_ID = new Map(COMMANDS.map((c) => [c.id, c]));
  CF.runCommand = (id) => { const c = BY_ID.get(id); return c ? CF.guard(c.run)() : null; };

  // ---- key strings: "ctrl+shift+p", chords "ctrl+k ctrl+s" (modifier order ctrl, alt, shift, cmd; "mod" = cmd on macOS, ctrl elsewhere) ----------
  const PUNCT = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Space: 'space', Tab: 'tab', Enter: 'enter', Escape: 'escape', Backspace: 'backspace',
    Delete: 'delete', Insert: 'insert', Home: 'home', End: 'end', PageUp: 'pageup', PageDown: 'pagedown', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', NumpadAdd: 'numpadadd', NumpadSubtract: 'numpadsubtract', NumpadMultiply: 'numpadmultiply', NumpadDivide: 'numpaddivide' };
  const keyOf = (e) => { const c = e.code || ''; if (/^Key[A-Z]$/.test(c)) return c.slice(3).toLowerCase(); if (/^Digit\d$/.test(c)) return c.slice(5); if (/^F\d{1,2}$/.test(c)) return c.toLowerCase(); if (/^Numpad\d$/.test(c)) return 'numpad' + c.slice(6); return PUNCT[c] || null; };
  const comboOf = (e) => { const k = keyOf(e); if (!k) return null; return [e.ctrlKey && 'ctrl', e.altKey && 'alt', e.shiftKey && 'shift', e.metaKey && 'cmd', k].filter(Boolean).join('+'); };
  const ALIAS = { control: 'ctrl', command: 'cmd', meta: 'cmd', win: 'cmd', super: 'cmd', option: 'alt', esc: 'escape', return: 'enter', del: 'delete', ins: 'insert', pgup: 'pageup', pgdn: 'pagedown', arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down', plus: '+', backtick: '`' };
  const normCombo = (s) => {
    const parts = String(s).trim().toLowerCase().replace(/\+\+$/, '+plus').split('+').map((x) => x.trim()).filter(Boolean); if (!parts.length) return '';
    const mods = new Set(); let key = '';
    parts.forEach((p, i) => { p = ALIAS[p] || p; if (p === 'mod') p = MAC() ? 'cmd' : 'ctrl'; if (['ctrl', 'alt', 'shift', 'cmd'].includes(p) && i < parts.length - 1) mods.add(p); else key = p; });
    return key ? [...['ctrl', 'alt', 'shift', 'cmd'].filter((m) => mods.has(m)), key].join('+') : '';
  };
  const normSeq = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(normCombo).filter(Boolean).join(' ');
  const SYM = { ctrl: '⌃', alt: '⌥', shift: '⇧', cmd: '⌘', left: '←', right: '→', up: '↑', down: '↓', enter: '↵', escape: 'Esc', backspace: '⌫', tab: 'Tab', space: 'Space', pageup: 'PgUp', pagedown: 'PgDn', delete: 'Del', insert: 'Ins', numpadadd: 'Num +', numpadsubtract: 'Num -' };
  const prettyCombo = (c) => c.split('+').map((p, i, a) => { if (MAC() && SYM[p] && i < a.length - 1) return SYM[p]; if (i === a.length - 1) return SYM[p] && p.length > 1 && !['ctrl', 'alt', 'shift', 'cmd'].includes(p) ? SYM[p] : p.length === 1 ? p.toUpperCase() : /^f\d/.test(p) ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1); return p[0].toUpperCase() + p.slice(1); }).join(MAC() ? '' : '+');
  const prettySeq = (s) => s.split(' ').map(prettyCombo).join(' ');

  // ---- state: defaults from main.js + the user's keyboard.json ---------------------------------------------------------------------
  let defaults = {}, user = {}, fileError = null, table = new Map(), prefixes = new Set(), pending = null, pendingAt = 0;
  const effective = (c) => normSeq(c.id in user ? user[c.id] : defaults[c.id]);
  const defaultOf = (c) => normSeq(defaults[c.id]);
  const rebuild = () => {
    table = new Map(); prefixes = new Set();
    COMMANDS.forEach((c) => { const s = effective(c); if (!s) return; (table.get(s) || table.set(s, []).get(s)).push(c); const p = s.split(' '); if (p.length > 1) prefixes.add(p[0]); });
  };
  CF.keyLabel = (id) => { const c = BY_ID.get(id); const s = c && effective(c); return s ? prettySeq(s) : ''; };
  CF.keyForTitle = (title, fallback) => { const c = COMMANDS.find((x) => x.title === title || x.alias === title); if (!c) return fallback; const s = effective(c); return s ? prettySeq(s) : ''; };
  CF.loadKeys = async () => {
    const r = await cf.keys.get(); defaults = r.defaults || {}; user = r.user || {}; S.keyboardFile = r.file;
    if (r.error && r.error !== fileError) CF.toast('keyboard.json is not valid JSON, using defaults: ' + r.error, true);
    fileError = r.error; rebuild(); S.groups.forEach((g) => { if (/^kbd:/.test(g.active || '')) CF.renderPage(g); });
  };

  // ---- dispatcher ---------------------------------------------------------------------------------------------------------------------
  // Inside a terminal only keys the terminal hands to the app (CF.termAppKey) and never the terminal's own copy/paste keys are used.
  const TERM_RESERVED = new Set(['ctrl+shift+c', 'ctrl+shift+v', 'ctrl+c', 'ctrl+v', 'cmd+c', 'cmd+v', 'shift+insert', 'ctrl+insert', 'alt+left', 'alt+right', 'ctrl+pageup', 'ctrl+pagedown']);
  document.addEventListener('keydown', (e) => {
    if (CF.kbRecording || e.isComposing) return;
    const combo = comboOf(e); if (!combo) return;
    const t = e.target, el = t && t.closest ? t : null;
    const inTerm = !!(el && el.closest('.xterm')), inMonaco = !!(el && el.closest('.monaco-editor'));
    const editable = !inTerm && !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (editable && !(e.ctrlKey || e.altKey || e.metaKey || /^f\d/.test(keyOf(e)))) { pending = null; return; }
    if (inTerm && (TERM_RESERVED.has(combo) || !(CF.termAppKey && CF.termAppKey(e)))) { pending = null; return; }
    const ctx = inTerm ? 'terminal' : '!terminal';
    const pick = (list) => { const l = (list || []).filter((c) => !c.when || c.when === ctx); return l.find((c) => c.when) || l[0]; };
    let seq = combo, had = false;
    if (pending && Date.now() - pendingAt < 1500) { seq = pending + ' ' + combo; had = true; }
    pending = null;
    let cmd = pick(table.get(seq));
    if (!cmd && had) { seq = combo; cmd = pick(table.get(seq)); }
    if (cmd) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); CF.guard(cmd.run)(); return; }
    if (prefixes.has(seq)) { pending = seq; pendingAt = Date.now(); if (!inMonaco) { e.preventDefault(); e.stopPropagation(); } }   // Monaco keeps seeing Ctrl+K so its own chords still work
  }, true);

  // ---- Keyboard Shortcuts tab -----------------------------------------------------------------------------------------------------
  const KB = { q: '' };
  const whenLabel = (c) => (c.when === 'terminal' ? 'In terminal' : c.when === '!terminal' ? 'Outside terminal' : '');
  const overlap = (a, b) => !a.when || !b.when || a.when === b.when;
  const chips = (seq) => h('span', { class: 'kb-keys' }, seq.split(' ').map((c) => h('kbd', {}, prettyCombo(c))));
  const conflictsOf = (cmd, seq) => COMMANDS.filter((c) => c !== cmd && effective(c) === seq && overlap(c, cmd));
  const shadowsOf = (cmd, seq) => COMMANDS.filter((c) => { const s = effective(c); return c !== cmd && s && overlap(c, cmd) && (s.startsWith(seq + ' ') || seq.startsWith(s + ' ')); });
  const save = async (cmd, seq) => {   // seq '' = unassign; conflicting commands lose the key so every binding stays unambiguous
    const next = { ...user };
    if (seq) conflictsOf(cmd, seq).forEach((c) => { next[c.id] = ''; });
    next[cmd.id] = seq;
    COMMANDS.forEach((c) => { if (c.id in next && next[c.id] === defaultOf(c)) delete next[c.id]; });
    await cf.keys.set(next); await CF.loadKeys();
  };
  const reset = async (cmd) => { const next = { ...user }; delete next[cmd.id]; await cf.keys.set(next); await CF.loadKeys(); };
  function record(cmd, cell) {
    CF.kbRecording = true; const seq = []; let note = '';
    const box = h('div', { class: 'kb-rec', tabindex: '-1' });
    const draw = () => {
      const s = seq.join(' '), cf2 = s ? conflictsOf(cmd, s) : [], sh = s ? shadowsOf(cmd, s) : [];
      box.replaceChildren(
        h('div', { class: 'kb-rec-top' }, s ? chips(s) : h('span', { class: 'kb-hint' }, 'Press the keys you want…'),
          h('span', { class: 'grow' }), h('button', { class: 'xbtn', disabled: !s, onclick: () => finish(true) }, 'Save'), h('button', { class: 'xbtn sec', onclick: () => finish(false) }, 'Cancel')),
        h('div', { class: 'kb-rec-note' }, note || 'Enter saves, Esc cancels, Backspace removes the last key. Press two combinations for a chord (e.g. Ctrl+K Ctrl+S).'),
        cf2.length ? h('div', { class: 'kb-warn' }, `⚠ Already used by ${cf2.map((c) => c.title).join(', ')}. Saving removes it from there.`) : null,
        sh.length ? h('div', { class: 'kb-warn' }, `⚠ Overlaps with the chord used by ${sh.map((c) => c.title).join(', ')}.`) : null);
    };
    const onKey = (e) => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const bare = !(e.ctrlKey || e.altKey || e.metaKey || e.shiftKey);
      if (bare && e.key === 'Escape') return finish(false);
      if (bare && e.key === 'Enter' && seq.length) return finish(true);
      if (bare && e.key === 'Backspace') { seq.pop(); note = ''; return draw(); }
      const c = comboOf(e); if (!c) return;
      if (!(e.ctrlKey || e.altKey || e.metaKey || /^f\d/.test(c))) { note = 'Add Ctrl, Alt or ' + (MAC() ? '⌘' : 'Win') + ' (or use an F-key) so normal typing keeps working.'; return draw(); }
      if (seq.length >= 2) seq.length = 0; seq.push(c); note = ''; draw();
    };
    const away = (e) => { if (!box.contains(e.target)) finish(false); };
    const finish = async (ok) => {
      document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', away, true); CF.kbRecording = false;
      try { if (ok && seq.length) await save(cmd, seq.join(' ')); else S.groups.forEach((g) => { if (/^kbd:/.test(g.active || '')) CF.renderPage(g); }); } catch (err) { CF.toast(String(err.message || err), true); }
    };
    cell.replaceChildren(box); draw(); box.focus();
    document.addEventListener('keydown', onKey, true); document.addEventListener('mousedown', away, true);
  }
  const rowFor = (c) => {
    const eff = effective(c), custom = c.id in user, cell = h('div', { class: 'kb-cell', title: 'Click to change' });
    const show = () => cell.replaceChildren(eff ? chips(eff) : h('span', { class: 'kb-none' }, 'Not assigned'), h('span', { class: 'kb-edit' }, 'Change'));
    show(); cell.onclick = () => record(c, cell);
    return h('div', { class: 'kb-row', role: 'row', tabindex: '0', onkeydown: (e) => { if (e.target === e.currentTarget && e.key === 'Enter') record(c, cell); } },
      h('div', { class: 'kb-cmd' }, h('b', {}, c.title), h('small', {}, c.id)), cell,
      h('div', { class: 'kb-src' }, custom ? h('span', { class: 'xpill acc' }, 'Custom') : eff ? h('span', { class: 'xpill' }, 'Default') : h('span', { class: 'xpill' }, ''), whenLabel(c) ? h('small', {}, whenLabel(c)) : null),
      h('div', { class: 'kb-act' },
        custom ? h('button', { class: 'xbtn ghost', title: 'Reset to default', 'aria-label': 'Reset ' + c.title, onclick: () => reset(c) }, CF.icon('restart', 13)) : null,
        eff ? h('button', { class: 'xbtn ghost', title: 'Remove keybinding', 'aria-label': 'Remove keybinding for ' + c.title, onclick: () => save(c, '') }, CF.icon('close', 13)) : null));
  };
  const renderKbPage = (g) => {
    const list = h('div', { class: 'kb-list', role: 'table' });
    const draw = () => {
      const q = KB.q.trim().toLowerCase(), qs = normSeq(q); list.replaceChildren(); let cat = '', n = 0;
      COMMANDS.forEach((c) => {
        const eff = effective(c), hay = [c.title, c.id, c.cat, eff, eff && prettySeq(eff).toLowerCase()].join(' ').toLowerCase();
        if (q && !hay.includes(q) && !(qs && eff && eff === qs)) return;
        if (c.cat !== cat) { cat = c.cat; list.append(h('div', { class: 'kb-cat' }, cat)); } list.append(rowFor(c)); n++;
      });
      if (!n) list.append(h('div', { class: 'xempty' }, h('b', {}, `No commands match “${KB.q}”`)));
    };
    const search = h('input', { type: 'text', placeholder: 'Search commands or keys (for example: toggle, ctrl+b)', 'aria-label': 'Search keyboard shortcuts', value: KB.q, spellcheck: 'false', oninput: (e) => { KB.q = e.target.value; draw(); } });
    const el = h('div', { class: 'xdlg xdpage kbpage' },
      h('div', { class: 'kb-head' }, h('h2', {}, 'Keyboard Shortcuts'), h('span', { class: 'grow' }),
        h('button', { class: 'xbtn sec', onclick: CF.guard(async () => { const p = await cf.keys.file(); S.keyboardFile = p; CF.openFile(p); }) }, 'Open keyboard.json'),
        h('button', { class: 'xbtn sec', onclick: CF.guard(async () => { if (!Object.keys(user).length) return CF.toast('Already using the defaults'); if (await CF.confirm('Reset every shortcut to its default?', 'Reset all')) { await cf.keys.set({}); await CF.loadKeys(); } }) }, 'Reset all')),
      h('p', { class: 'xd-hint' }, 'Click a shortcut to change it, then press the new keys. Your changes are stored in keyboard.json and apply immediately.'),
      fileError ? h('div', { class: 'xerr', role: 'alert' }, 'keyboard.json could not be read, so the defaults are in use: ' + fileError) : null,
      h('div', { class: 'xsearch' }, CF.icon('search', 14), search), list,
      h('details', { class: 'kb-notes' }, h('summary', {}, 'What can and cannot be changed'),
        h('ul', { class: 'xd-list' }, h('li', {}, 'Inside a terminal, only shortcuts with Ctrl+Shift, Alt, or an F-key reach the app. Plain Ctrl keys (such as Ctrl+W or Ctrl+R) go to the shell.'),
          h('li', {}, 'Text-editing keys inside the editor (Monaco) and the terminal’s copy/paste keys are built in and are not listed here.'),
          h('li', {}, 'In keyboard.json, use "" to unbind a command and “mod” for Ctrl (Cmd on macOS), for example "toggle-sidebar": "mod+shift+b".'))));
    const top = g.page.scrollTop; g.page.replaceChildren(el); g.page.scrollTop = top; draw();
  };
  CF.pages.kbd = { icon: 'keyboard', title: () => 'Keyboard Shortcuts', render: renderKbPage };
  CF.shortcutsDialog = () => CF.openFile('kbd://shortcuts');
  CF.openKeyboardJson = CF.guard(async () => { const p = await cf.keys.file(); S.keyboardFile = p; CF.openFile(p); });

  CF.loadKeys().catch(() => rebuild());
})();
