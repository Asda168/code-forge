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
    'monokai-dimmed': mk('Monokai Dimmed', 'vs-dark', { bg: '#1e1e1e', side: '#272727', panel: '#1e1e1e', fg: '#c5c8c6', mut: '#9a9b99', border: '#303030', hover: '#303030', sel: '#4e5254', accent: '#6089b4', accent2: '#9aa83a', status: '#505050', statusFg: '#c5c8c6', ln: '#707070', line: '#303030', edsel: '#676b7180', guide: '#3a3a3a', cursor: '#c07020', tok: { comment: '9A9B99', commentStyle: 'italic', string: '9AA83A', escape: 'C07020', keyword: '6089B4', control: '6089B4', number: 'C07020', type: '9B0000', fn: 'CE6700', variable: 'C5C8C6', tag: '6089B4', attr: '9B0000', delim: '676867', regexp: '9AA83A' } }),
    'solarized-dark': mk('Solarized Dark', 'vs-dark', { bg: '#002b36', side: '#00252f', panel: '#002b36', fg: '#93a1a1', mut: '#657b83', border: '#003847', hover: '#073642', sel: '#094352', accent: '#268bd2', status: '#00212b', statusFg: '#93a1a1', ln: '#586e75', line: '#073642', edsel: '#274642', guide: '#12424e', tok: { comment: '586E75', commentStyle: 'italic', string: '2AA198', keyword: '859900', number: 'D33682', type: 'B58900', fn: '268BD2', variable: '93A1A1', tag: '268BD2', attr: '93A1A1', delim: '839496' } }),
    'solarized-light': mk('Solarized Light', 'vs', { bg: '#fdf6e3', side: '#eee8d5', panel: '#fdf6e3', fg: '#586e75', mut: '#93a1a1', border: '#ddd6c1', hover: '#eee8d5', sel: '#d7d0b6', accent: '#268bd2', status: '#eee8d5', statusFg: '#586e75', ln: '#93a1a1', line: '#eee8d5', edsel: '#eee8d5', guide: '#d3cbb7', tok: { comment: '93A1A1', commentStyle: 'italic', string: '2AA198', keyword: '859900', number: 'D33682', type: 'B58900', fn: '268BD2', variable: '586E75', tag: '268BD2', attr: '93A1A1', delim: '657B83' } }),
    abyss: mk('Abyss', 'vs-dark', { bg: '#000c18', side: '#060621', panel: '#000c18', fg: '#6688cc', mut: '#406385', border: '#2b2b4a', hover: '#082050', sel: '#08286b', accent: '#0063a5', status: '#10192c', statusFg: '#6688cc', ln: '#406385', line: '#082050', edsel: '#770811', guide: '#2b2b4a', tok: { comment: '384887', string: '22AA44', keyword: '225588', number: 'F280D0', type: 'FFEEBB', fn: 'DDBB88', variable: '6688CC', tag: '225588', attr: 'BBBBFF', delim: '6688CC' } }),
    'kimbie-dark': mk('Kimbie Dark', 'vs-dark', { bg: '#221a0f', side: '#131510', panel: '#221a0f', fg: '#d3af86', mut: '#a57a4c', border: '#5e452b', hover: '#2a2013', sel: '#5e452b', accent: '#a57a4c', status: '#423523', statusFg: '#d3af86', ln: '#a57a4c', line: '#5e452b55', edsel: '#84613daa', guide: '#5e452b', tok: { comment: 'A57A4C', string: '889B4A', keyword: '98676A', number: 'F79A32', type: 'F06431', fn: '8AB1B0', variable: 'D3AF86', tag: 'DC3958', attr: 'F79A32', delim: 'D3AF86' } }),
    'tomorrow-night-blue': mk('Tomorrow Night Blue', 'vs-dark', { bg: '#002451', side: '#001733', panel: '#002451', fg: '#ffffff', mut: '#7285b7', border: '#00346e', hover: '#003875', sel: '#003f8e', accent: '#3399cc', status: '#001126', ln: '#7285b7', line: '#00346e', edsel: '#003f8e', guide: '#00346e', tok: { comment: '7285B7', string: 'D1F1A9', keyword: 'EBBBFF', number: 'FFC58F', type: 'FFEEAD', fn: 'BBDAFF', variable: 'FF9DA4', tag: 'FF9DA4', attr: 'FFC58F', delim: 'FFFFFF' } }),
    'quiet-light': mk('Quiet Light', 'vs', { bg: '#f5f5f5', side: '#ececec', panel: '#f5f5f5', fg: '#333333', mut: '#777777', border: '#d9d9d9', hover: '#e4e4e4', sel: '#c4d9b1', accent: '#705697', status: '#705697', ln: '#aaaaaa', line: '#e4f6d4', edsel: '#c9d0d9', guide: '#d9d9d9', tok: { comment: 'AAAAAA', commentStyle: 'italic', string: '448C27', keyword: '4B69C6', number: 'AB6526', type: '7A3E9D', fn: '7A3E9D', variable: '333333', tag: '4B69C6', attr: '777777', delim: '777777' } }),
    'vsc-red': mk('Red', 'vs-dark', { bg: '#390000', side: '#330000', panel: '#390000', fg: '#f8f8f8', mut: '#e7c0c0', border: '#ff666633', hover: '#800000', sel: '#750000', accent: '#cc3333', status: '#cc3333', ln: '#ff6666aa', line: '#ff000033', edsel: '#750000', guide: '#ff666633', tok: { comment: 'E7C0C0', string: 'FFD2A7', keyword: 'FF6666', number: 'FFD2A7', type: 'FFAA77', fn: 'FFD2A7', variable: 'F8F8F8', tag: 'FF6666', attr: 'FFD2A7', delim: 'F8F8F8' } }),
  });

  // JetBrains / PhpStorm "Darcula" (New UI dark). Monaco's PHP tokenizer cannot tell class names, calls and properties apart,
  // so a small semantic-token provider (active only while this theme is selected) classifies them from the source text.
  const DARCULA = 'jetbrains-darcula';
  CF.THEMES[DARCULA] = mk('JetBrains Darcula (PhpStorm)', 'vs-dark', {
    bg: '#19191c', side: '#1e1f22', panel: '#19191c', fg: '#bcbec4', mut: '#7a7e85', border: '#2b2d30', hover: '#2a2c31', sel: '#2e436e', accent: '#3574f0', accent2: '#56a8f5',
    status: '#1a1a1a', statusFg: '#bcbec4', ln: '#5a5d63', line: '#23252a', edsel: '#214283', cursor: '#ced0d6', guide: '#2e3138',
    tok: { comment: '6f737a', commentStyle: 'italic', string: '6aab73', escape: 'cf8e6d', keyword: 'cf8e6d', control: 'cf8e6d', number: '6c95eb', type: 'cf8e6d', fn: '56a8f5',
      variable: 'bcbec4', tag: 'd5b778', attr: 'bcbec4', delim: 'bcbec4', regexp: '42c3d4' },
  });
  CF.THEMES[DARCULA].ui['--chrome'] = '#1a1a1a';          // title bar + activity bar are darker than the side bar
  Object.assign(CF.THEMES[DARCULA].ed, {
    'editor.lineHighlightBorder': '#2e3138', 'editorInlayHint.foreground': '#6e7681', 'editorInlayHint.background': '#00000000', 'editorCodeLens.foreground': '#6e7681', 'breadcrumb.background': '#1e1f22', 'editorGroupHeader.tabsBackground': '#1e1f22',
    'editorLineNumber.activeForeground': '#bcbec4', 'editorBracketMatch.border': '#3574f0', 'editorBracketMatch.background': '#3574f033',
  });
  CF.THEMES[DARCULA].rules.push(
    { token: 'constant', foreground: 'cf8e6d' }, { token: 'constant.php', foreground: 'cf8e6d' }, { token: 'metatag.php', foreground: 'cf8e6d' }, { token: 'variable.php', foreground: 'bcbec4' },
    { token: 'class', foreground: 'f75464' }, { token: 'function', foreground: '56a8f5' }, { token: 'selfVar', foreground: 'df4c53' }, { token: 'property', foreground: 'c77dbb' });

  const PHP_LEGEND = { tokenTypes: ['class', 'function', 'selfVar', 'property'], tokenModifiers: [] };
  const PHP_KW = new Set(['if', 'else', 'elseif', 'while', 'for', 'foreach', 'switch', 'match', 'catch', 'return', 'echo', 'print', 'array', 'list', 'isset', 'unset', 'empty', 'exit', 'die', 'fn', 'function', 'and', 'or', 'xor', 'use', 'new', 'static', 'self', 'parent', 'null', 'true', 'false', 'int', 'string', 'bool', 'float', 'array', 'mixed', 'void', 'object', 'callable', 'iterable', 'never']);
  const phpSemantic = (text) => {
    const data = []; let pl = 0, pc = 0, inBlock = false;
    const push = (line, col, len, type) => { data.push(line - pl, line === pl ? col - pc : col, len, type, 0); pl = line; pc = col; };
    text.split(/\r?\n/).forEach((src, line) => {
      let i = 0; const n = src.length;
      while (i < n) {
        if (inBlock) { const e = src.indexOf('*/', i); if (e < 0) return; inBlock = false; i = e + 2; continue; }
        const c = src[i], two = src.substr(i, 2);
        if (two === '/*') { inBlock = true; i += 2; continue; }
        if (two === '//' || c === '#') return;
        if (c === "'" || c === '"') { let j = i + 1; while (j < n && src[j] !== c) j += src[j] === '\\' ? 2 : 1; i = j + 1; continue; }
        if (c === '$') { const m = /^\$[A-Za-z_]\w*/.exec(src.slice(i)); if (m) { if (m[0] === '$this') push(line, i, 5, 2); i += m[0].length; continue; } }
        const m = /^[A-Za-z_\\][\w\\]*/.exec(src.slice(i));
        if (!m) { i++; continue; }
        const word = m[0], start = i; i += word.length;
        const before = src.slice(0, start).trimEnd(), after = src.slice(i).trimStart();
        const last = word.split('\\').pop();
        const afterNew = /(?:\bnew|\bextends|\bimplements|\binstanceof|\buse|\bcatch\s*\(|\btrait|\bclass\s+\w+\s+extends)$/.test(before);
        if (/(?:->|\?->)$/.test(before)) { push(line, start, word.length, after[0] === '(' ? 1 : 3); continue; }
        if (/::$/.test(before)) { if (after[0] === '(') push(line, start, word.length, 1); continue; }
        if (/\bfunction$/.test(before)) { push(line, start, word.length, 1); continue; }
        if (PHP_KW.has(word.toLowerCase())) continue;
        if (/^\s*::/.test(after) || afterNew || (/^[A-Z]/.test(last) && !/^[A-Z0-9_]+$/.test(last) && after[0] !== '(')) { push(line, start, word.length, 0); continue; }
        if (after[0] === '(') push(line, start, word.length, 1);
      }
    });
    return new Uint32Array(data);
  };
  let fireSem = () => {};
  const registerPhpSemantic = () => {
    if (!window.monaco || registerPhpSemantic.done) return; registerPhpSemantic.done = true;
    const em = new monaco.Emitter(); fireSem = () => em.fire();
    monaco.languages.registerDocumentSemanticTokensProvider('php', {
      onDidChange: em.event,
      getLegend: () => PHP_LEGEND,
      provideDocumentSemanticTokens: (model) => ({ data: S.settings.theme === DARCULA ? phpSemantic(model.getValue()) : new Uint32Array(0) }),
      releaseDocumentSemanticTokens: () => {},
    });
  };
  const initBase = CF.initMonaco;
  CF.initMonaco = async (...a) => { const r = await initBase(...a); registerPhpSemantic(); return r; };
  const applyBase = CF.applyTheme;
  CF.applyTheme = (id) => { applyBase(id); fireSem(); };

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
