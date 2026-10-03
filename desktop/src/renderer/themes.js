// VS Code-style colour themes (palettes inspired by the well-known VS Code themes), live-preview picker,
// and import of real VS Code theme .json files.
(() => {
  const { S, $, h } = CF;

  // token rules shared by families (Monaco token names; colours without '#')
  const R = (c) => [
    { token: 'comment', foreground: c.comment, fontStyle: c.commentStyle || '' }, { token: 'string', foreground: c.string }, { token: 'string.escape', foreground: c.escape || c.string },
    { token: 'keyword', foreground: c.keyword }, { token: 'keyword.control', foreground: c.control || c.keyword }, { token: 'number', foreground: c.number },
    { token: 'type', foreground: c.type, fontStyle: c.typeStyle || '' }, { token: 'type.identifier', foreground: c.type }, { token: 'predefined', foreground: c.fn },
    { token: 'identifier', foreground: c.variable }, { token: 'variable', foreground: c.variable }, { token: 'variable.predefined', foreground: c.fn }, { token: 'constant', foreground: c.number },
    { token: 'tag', foreground: c.tag || c.keyword }, { token: 'attribute.name', foreground: c.attr || c.variable }, { token: 'attribute.value', foreground: c.string },
    { token: 'delimiter', foreground: c.delim }, { token: 'regexp', foreground: c.regexp || c.string }, { token: 'operator', foreground: c.delim },
  ];
  const mk = (name, base, p) => ({
    name, base, vsc: true,
    ui: { '--bg': p.bg, '--side': p.side, '--panel': p.panel || p.bg, '--fg': p.fg, '--mut': p.mut, '--border': p.border, '--hover': p.hover, '--sel': p.sel, '--accent': p.accent, '--accent2': p.accent, '--cyan': p.accent2 || p.accent, '--status': p.status || p.accent, '--status-fg': p.statusFg || '#ffffff' },
    ed: { 'editor.background': p.bg, 'editor.foreground': p.fg, 'editorLineNumber.foreground': p.ln, 'editorLineNumber.activeForeground': p.fg, 'editor.lineHighlightBackground': p.line, 'editor.selectionBackground': p.edsel, 'editorCursor.foreground': p.cursor || p.accent, 'editorIndentGuide.background1': p.guide, 'editorWidget.background': p.side },
    rules: R(p.tok),
  });

  const DARKPLUS = { comment: '6A9955', string: 'CE9178', escape: 'D7BA7D', keyword: '569CD6', control: 'C586C0', number: 'B5CEA8', type: '4EC9B0', fn: 'DCDCAA', variable: '9CDCFE', tag: '569CD6', attr: '9CDCFE', delim: 'D4D4D4', regexp: 'D16969' };
  const LIGHTPLUS = { comment: '008000', string: 'A31515', escape: 'EE0000', keyword: '0000FF', control: 'AF00DB', number: '098658', type: '267F99', fn: '795E26', variable: '001080', tag: '800000', attr: 'E50000', delim: '000000', regexp: '811F3F' };

  Object.assign(CF.THEMES, {
    'vsc-dark-modern': mk('Dark Modern', 'vs-dark', { bg: '#1f1f1f', side: '#181818', panel: '#181818', fg: '#cccccc', mut: '#9d9d9d', border: '#2b2b2b', hover: '#2a2d2e', sel: '#04395e', accent: '#0078d4', status: '#181818', statusFg: '#cccccc', ln: '#6e7681', line: '#2a2d2e', edsel: '#264f78', guide: '#404040', tok: DARKPLUS }),
    'vsc-dark-plus': mk('Dark+', 'vs-dark', { bg: '#1e1e1e', side: '#252526', panel: '#1e1e1e', fg: '#d4d4d4', mut: '#969696', border: '#3c3c3c', hover: '#2a2d2e', sel: '#094771', accent: '#007acc', status: '#007acc', ln: '#858585', line: '#282828', edsel: '#264f78', guide: '#404040', tok: DARKPLUS }),
    'vsc-light-modern': mk('Light Modern', 'vs', { bg: '#ffffff', side: '#f8f8f8', panel: '#f8f8f8', fg: '#3b3b3b', mut: '#6e7681', border: '#e5e5e5', hover: '#f2f2f2', sel: '#e8e8e8', accent: '#005fb8', status: '#f8f8f8', statusFg: '#3b3b3b', ln: '#6e7681', line: '#f5f5f5', edsel: '#add6ff', guide: '#d3d3d3', tok: LIGHTPLUS }),
    'vsc-light-plus': mk('Light+', 'vs', { bg: '#ffffff', side: '#f3f3f3', panel: '#ffffff', fg: '#333333', mut: '#616161', border: '#e7e7e7', hover: '#e8e8e8', sel: '#e4e6f1', accent: '#007acc', status: '#007acc', ln: '#237893', line: '#f5f5f5', edsel: '#add6ff', guide: '#d3d3d3', tok: LIGHTPLUS }),
    monokai: mk('Monokai', 'vs-dark', { bg: '#272822', side: '#1e1f1c', panel: '#272822', fg: '#f8f8f2', mut: '#a59f85', border: '#3e3d32', hover: '#3e3d32', sel: '#49483e', accent: '#a6e22e', accent2: '#66d9ef', status: '#75715e', ln: '#90908a', line: '#3e3d32', edsel: '#49483e', guide: '#464741', tok: { comment: '75715E', string: 'E6DB74', keyword: 'F92672', number: 'AE81FF', type: '66D9EF', typeStyle: 'italic', fn: 'A6E22E', variable: 'F8F8F2', tag: 'F92672', attr: 'A6E22E', delim: 'F8F8F2' } }),
    'solarized-dark': mk('Solarized Dark', 'vs-dark', { bg: '#002b36', side: '#00252f', panel: '#002b36', fg: '#93a1a1', mut: '#657b83', border: '#003847', hover: '#073642', sel: '#094352', accent: '#268bd2', status: '#00212b', statusFg: '#93a1a1', ln: '#586e75', line: '#073642', edsel: '#274642', guide: '#12424e', tok: { comment: '586E75', commentStyle: 'italic', string: '2AA198', keyword: '859900', number: 'D33682', type: 'B58900', fn: '268BD2', variable: '93A1A1', tag: '268BD2', attr: '93A1A1', delim: '839496' } }),
    'solarized-light': mk('Solarized Light', 'vs', { bg: '#fdf6e3', side: '#eee8d5', panel: '#fdf6e3', fg: '#586e75', mut: '#93a1a1', border: '#ddd6c1', hover: '#eee8d5', sel: '#d7d0b6', accent: '#268bd2', status: '#eee8d5', statusFg: '#586e75', ln: '#93a1a1', line: '#eee8d5', edsel: '#eee8d5', guide: '#d3cbb7', tok: { comment: '93A1A1', commentStyle: 'italic', string: '2AA198', keyword: '859900', number: 'D33682', type: 'B58900', fn: '268BD2', variable: '586E75', tag: '268BD2', attr: '93A1A1', delim: '657B83' } }),
    abyss: mk('Abyss', 'vs-dark', { bg: '#000c18', side: '#060621', panel: '#000c18', fg: '#6688cc', mut: '#406385', border: '#2b2b4a', hover: '#082050', sel: '#08286b', accent: '#0063a5', status: '#10192c', statusFg: '#6688cc', ln: '#406385', line: '#082050', edsel: '#770811', guide: '#2b2b4a', tok: { comment: '384887', string: '22AA44', keyword: '225588', number: 'F280D0', type: 'FFEEBB', fn: 'DDBB88', variable: '6688CC', tag: '225588', attr: 'BBBBFF', delim: '6688CC' } }),
    'kimbie-dark': mk('Kimbie Dark', 'vs-dark', { bg: '#221a0f', side: '#131510', panel: '#221a0f', fg: '#d3af86', mut: '#a57a4c', border: '#5e452b', hover: '#2a2013', sel: '#5e452b', accent: '#a57a4c', status: '#423523', statusFg: '#d3af86', ln: '#a57a4c', line: '#5e452b55', edsel: '#84613daa', guide: '#5e452b', tok: { comment: 'A57A4C', string: '889B4A', keyword: '98676A', number: 'F79A32', type: 'F06431', fn: '8AB1B0', variable: 'D3AF86', tag: 'DC3958', attr: 'F79A32', delim: 'D3AF86' } }),
    'tomorrow-night-blue': mk('Tomorrow Night Blue', 'vs-dark', { bg: '#002451', side: '#001733', panel: '#002451', fg: '#ffffff', mut: '#7285b7', border: '#00346e', hover: '#003875', sel: '#003f8e', accent: '#3399cc', status: '#001126', ln: '#7285b7', line: '#00346e', edsel: '#003f8e', guide: '#00346e', tok: { comment: '7285B7', string: 'D1F1A9', keyword: 'EBBBFF', number: 'FFC58F', type: 'FFEEAD', fn: 'BBDAFF', variable: 'FF9DA4', tag: 'FF9DA4', attr: 'FFC58F', delim: 'FFFFFF' } }),
    'quiet-light': mk('Quiet Light', 'vs', { bg: '#f5f5f5', side: '#ececec', panel: '#f5f5f5', fg: '#333333', mut: '#777777', border: '#d9d9d9', hover: '#e4e4e4', sel: '#c4d9b1', accent: '#705697', status: '#705697', ln: '#aaaaaa', line: '#e4f6d4', edsel: '#c9d0d9', guide: '#d9d9d9', tok: { comment: 'AAAAAA', commentStyle: 'italic', string: '448C27', keyword: '4B69C6', number: 'AB6526', type: '7A3E9D', fn: '7A3E9D', variable: '333333', tag: '4B69C6', attr: '777777', delim: '777777' } }),
    'vsc-red': mk('Red', 'vs-dark', { bg: '#390000', side: '#330000', panel: '#390000', fg: '#f8f8f8', mut: '#e7c0c0', border: '#ff666633', hover: '#800000', sel: '#750000', accent: '#cc3333', status: '#cc3333', ln: '#ff6666aa', line: '#ff000033', edsel: '#750000', guide: '#ff666633', tok: { comment: 'E7C0C0', string: 'FFD2A7', keyword: 'FF6666', number: 'FFD2A7', type: 'FFAA77', fn: 'FFD2A7', variable: 'F8F8F8', tag: 'FF6666', attr: 'FFD2A7', delim: 'F8F8F8' } }),
  });

  // ---- live-preview picker (Ctrl+K Ctrl+T) ---------------------------------------------------
  CF.themePicker = () => {
    const ids = Object.keys(CF.THEMES); const original = S.settings.theme;
    const o = $('#overlay'); o.innerHTML = ''; o.className = ''; o.hidden = false;
    let sel = Math.max(0, ids.indexOf(original)); let shown = ids;
    const list = h('div', { class: 'list' });
    const preview = () => shown[sel] && CF.applyTheme(shown[sel]);
    const draw = () => { list.innerHTML = ''; shown.forEach((id, i) => { const t = CF.THEMES[id]; list.append(h('div', { class: 'it' + (i === sel ? ' sel' : ''), onclick: () => { sel = i; commit(); }, onmouseenter: () => { sel = i; preview(); [...list.children].forEach((c, j) => c.classList.toggle('sel', j === i)); } },
      h('span', {}, t.name), h('span', { class: 'muted' }, id === original ? 'current' : (t.base === 'vs' ? 'Light' : t.base === 'hc-black' ? 'High Contrast' : 'Dark')))); }); const s = list.children[sel]; s && s.scrollIntoView({ block: 'nearest' }); };
    const commit = async () => { const id = shown[sel]; CF.closeOverlay(); if (id) await CF.setSetting({ theme: id }); };
    const cancel = () => { CF.applyTheme(original); CF.closeOverlay(); };
    const input = h('input', { placeholder: 'Select Color Theme (up/down to preview, Enter to apply)', oninput: () => { const q = input.value.toLowerCase(); shown = ids.filter((i) => CF.THEMES[i].name.toLowerCase().includes(q)); sel = 0; draw(); preview(); },
      onkeydown: (e) => { if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); preview(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); preview(); e.preventDefault(); } else if (e.key === 'Enter') commit(); else if (e.key === 'Escape') cancel(); } });
    o.append(h('div', { class: 'palette' }, input, list)); o.onmousedown = (e) => { if (e.target === o) cancel(); }; draw(); input.focus();
  };

  // ---- import a real VS Code theme file ----------------------------------------------------------
  const stripJsonc = (t) => t.replace(/^\uFEFF/, '').replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str || '').replace(/,(\s*[}\]])/g, '$1');
  const hex = (c) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null);
  CF.vscodeToManifest = (json, fileName) => {
    const th = JSON.parse(stripJsonc(json)); const c = th.colors || {};
    const pick = (...keys) => { for (const k of keys) if (hex(c[k])) return c[k]; return null; };
    const type = String(th.type || '').toLowerCase(); const base = type.includes('light') ? 'vs' : type.includes('hc') || type.includes('high') ? 'hc-black' : 'vs-dark';
    const bg = pick('editor.background') || (base === 'vs' ? '#ffffff' : '#1e1e1e');
    const ui = Object.fromEntries(Object.entries({
      '--bg': bg, '--side': pick('sideBar.background', 'editor.background'), '--panel': pick('panel.background', 'editor.background'), '--fg': pick('foreground', 'editor.foreground'), '--mut': pick('descriptionForeground', 'sideBar.foreground'),
      '--border': pick('panel.border', 'sideBar.border', 'editorGroup.border', 'contrastBorder'), '--hover': pick('list.hoverBackground', 'toolbar.hoverBackground'), '--sel': pick('list.activeSelectionBackground', 'list.inactiveSelectionBackground'),
      '--accent': pick('focusBorder', 'button.background', 'activityBarBadge.background', 'statusBar.background'), '--status': pick('statusBar.background'), '--status-fg': pick('statusBar.foreground'),
    }).filter(([, v]) => v));
    const ed = Object.fromEntries(Object.entries(c).filter(([k, v]) => /^(editor|editorCursor|editorLineNumber|editorIndentGuide|editorWhitespace|editorBracketMatch|editorGutter|editorWidget|editorSuggestWidget|editorHoverWidget|scrollbar|minimap|peekView|diffEditor|list|input|dropdown|selection)[\w.]*$/.test(k) && hex(v)));
    const rules = []; for (const tc of th.tokenColors || th.settings || []) {
      const fg = tc.settings && tc.settings.foreground; if (!hex(fg) && !(tc.settings && tc.settings.fontStyle)) continue;
      const scopes = Array.isArray(tc.scope) ? tc.scope : String(tc.scope || '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const sc of scopes.slice(0, 6)) rules.push({ token: sc.replace(/\.(php|js|ts|py|html|css|json)$/, ''), foreground: hex(fg) ? fg.slice(1, 7) : undefined, fontStyle: (tc.settings.fontStyle || '').trim() });
    }
    const slug = String(th.name || fileName || 'imported').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'imported';
    return { id: 'vscode-' + slug, name: String(th.name || fileName || 'Imported theme') + ' (imported)', version: '1.0.0', description: 'Imported VS Code colour theme', icon: '🎨', color: '#007acc', themes: [{ id: 'theme', name: String(th.name || slug), base, ui, ed, rules: rules.slice(0, 400) }] };
  };
  CF.importVscodeTheme = CF.guard(async () => {
    const f = await cf.ext.pickThemeFile(); if (!f) return;
    const m = CF.vscodeToManifest(f.text, f.name.replace(/\.json$/i, ''));
    await cf.ext.saveManifest(m); await CF.loadExtensions();
    await CF.setSetting({ theme: m.id + '.theme' }); CF.toast('Imported and applied: ' + m.name);
  });
})();
