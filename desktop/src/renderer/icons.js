// SVG icon set: stroke UI icons (activity bar, toolbars) and Symbols-style file / folder icons for the Explorer.
(() => {
  const { h } = CF;

  // ---- UI icons (24x24 viewBox, stroke) ------------------------------------------------------
  const UI = {
    explorer: '<path d="M14 3H8a2 2 0 0 0-2 2v10"/><path d="M10 7h6l4 4v8a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="M16 7v4h4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
    git: '<circle cx="6" cy="5.5" r="2.3"/><circle cx="6" cy="18.5" r="2.3"/><circle cx="18" cy="9" r="2.3"/><path d="M6 7.8v8.4"/><path d="M18 11.3c0 3.8-4 4.4-10 5.6"/>',
    gitlens: '<circle cx="8.5" cy="12" r="3.2"/><path d="M2 12h3.3M11.7 12h1.3"/><circle cx="17" cy="14" r="3.6"/><path d="m19.7 16.7 2.8 2.8"/><path d="M8.5 3.5v5.3M8.5 15.2v5.3"/>',
    run: '<path d="M6 4.5v13l10-6.5z"/><circle cx="17.5" cy="17.5" r="3"/><path d="M15.8 14.6l-.8-1.1M19.2 14.6l.8-1.1"/>',
    extensions: '<rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="14.5" y="2.8" width="6.5" height="6.5" rx="1.5" transform="rotate(14 17.7 6)"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    maximize: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    restore: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    minus: '<path d="M5 12h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronUp: '<path d="m6 15 6-6 6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    newFile: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    newFolder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>',
    collapse: '<path d="M7 9l5-5 5 5M7 15l5 5 5-5"/>',
    split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
    splitDown: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    clearTerm: '<path d="M4 20h9M14.5 4.5l5 5L11 18l-5-5z"/><path d="m8.5 9 6 6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    bug: '<rect x="8" y="8" width="8" height="11" rx="4"/><path d="M12 8V5M5 12h3M16 12h3M6 18l2.5-2M18 18l-2.5-2M6 7l2.5 2M18 7l-2.5 2"/>',
    restart: '<path d="M4 12a8 8 0 1 1 2.3 5.7"/><path d="M4 19v-6h6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    stash: '<path d="M4 8h16v12H4zM6 8V4h12v4M9 13h6"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    caseSens: '<path d="M3 17 8 6l5 11M5 13h6M15 10.5a3 3 0 0 1 5 1.5V17M15 15a2 2 0 0 1 5 0"/>',
    word: '<path d="M3 6v12M21 6v12M7 15l3-8 3 8M8 13h4"/>',
    regex: '<path d="M6 8l12 8M6 16 18 8M12 5v14"/>',
    pin: '<path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/>',
  };
  CF.icon = (name, size = 16, extra = '') => h('span', { class: 'svg ' + extra, html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${UI[name] || ''}</svg>` });
  CF.iconHtml = (name, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${UI[name] || ''}</svg>`;

  // ---- "Symbols"-style file icons: flat, glyph-only marks (no badge box), one soft colour per file kind ------
  const G = {
    code: 'M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9.2 3 6.8 13',
    braces: 'M6 2.5c-1.5 0-2 .6-2 2v1.9c0 1-.6 1.6-1.5 1.6.9 0 1.5.6 1.5 1.6v1.9c0 1.4.5 2 2 2M10 2.5c1.5 0 2 .6 2 2v1.9c0 1 .6 1.6 1.5 1.6-.9 0-1.5.6-1.5 1.6v1.9c0 1.4-.5 2-2 2',
    hash: 'M6.2 2.5 5.2 13.5M11.2 2.5l-1 11M2.8 6h10.7M2.5 10h10.7',
    term: 'M2.5 3.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM4.5 6.5 6.5 8.2l-2 1.7M8 10h3',
    lines: 'M3 4h10M3 8h10M3 12h6',
    image: 'M2.5 3h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM2 11.5l3.5-3.5 3 3 2-2 3.5 3.5M10.8 6.3a.4.4 0 1 0 .01 0',
    gear: 'M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
    db: 'M3 4c0-1 2.2-1.8 5-1.8s5 .8 5 1.8-2.2 1.8-5 1.8S3 5 3 4zM3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8',
    lock: 'M4 7.5h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM5.5 7.5V5.5a2.5 2.5 0 0 1 5 0v2',
    box: 'M8 1.8 13.5 4.6v6.8L8 14.2 2.5 11.4V4.6zM2.5 4.6 8 7.4l5.5-2.8M8 7.4v6.8',
    git: 'M5 3v7.5M5 10.5a2 2 0 1 0 .01 0M5 3a1.5 1.5 0 1 0 .01 0M11 5.5a1.5 1.5 0 1 0 .01 0M11 7c0 2.5-3 3-6 3.5',
    md: 'M2 12V4l3 4 3-4v8M11 4v7.5M9.2 9.7 11 11.5l1.8-1.8',
    angle: 'M2.5 12.5 8 3l5.5 9.5zM8 7v2.5',
    doc: 'M4 1.8h5l3.5 3.5V13a1.2 1.2 0 0 1-1.2 1.2H4A1.2 1.2 0 0 1 2.8 13V3A1.2 1.2 0 0 1 4 1.8zM9 1.9v3.6h3.5',
    zip: 'M4 1.8h8a1 1 0 0 1 1 1v10.4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2.8a1 1 0 0 1 1-1zM8 2v2M8 5v1M8 7v1M7 9.5h2v3H7z',
    pdf: 'M4 1.8h5l3.5 3.5V13a1.2 1.2 0 0 1-1.2 1.2H4A1.2 1.2 0 0 1 2.8 13V3A1.2 1.2 0 0 1 4 1.8zM5.5 12c1.5-1 2.3-3 2.5-5.5.3 2.5 1.5 4 3 4.5-2 0-4 .2-5.5 1z',
    key: 'M5.5 7.5a3 3 0 1 0 .01 0M8.2 7.5H14M12 7.5V10M10 7.5V9.5',
    flask: 'M6 2h4M7 2v4.5L3 12.5a1 1 0 0 0 .9 1.5h8.2a1 1 0 0 0 .9-1.5L9 6.5V2M4.8 10h6.4',
    // elephant (PHP): side view facing left, trunk, ear, eye, two legs
    elephant: 'M3 6.5a3 3 0 0 1 3-3h4.5a3 3 0 0 1 3 3v6h-2.2V10H7v2.5H4.8V9.6M3 6.5v5.4c0 .8-1.2 1-1.4.2M7.6 5.6c1 0 1.6.8 1.6 1.7S8.4 9 7.6 8.6M5.2 5.6h.01',
    // snake (Python): S-curve body, head with eye at upper right
    snake: 'M12 4.6a2 2 0 0 0-2-2H6.4a2.8 2.8 0 0 0 0 5.6h3.2a2.8 2.8 0 0 1 0 5.6H3.5M12 4.6v1.2M10.4 4.2h.01',
  };
  // Icon themes: symbols (flat coloured glyphs), badges (glyph on a tinted tile), minimal (monochrome).
  CF.ICON_THEMES = { symbols: 'Symbols (default)', badges: 'Colour Badges', minimal: 'Minimal (monochrome)' };
  const theme = () => (CF.S && CF.S.settings && CF.S.settings.iconTheme) || 'symbols';
  const glyph = (color, g) => {
    const t = theme(); if (t === 'minimal') color = '#9AA0A6';
    const tile = t === 'badges' ? `<rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="${color}" fill-opacity=".18" stroke="none"/>` : '';
    const inner = t === 'badges' ? 'transform="translate(2.4 2.4) scale(.7)"' : '';
    return `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="${color}" stroke-width="${t === 'badges' ? 1.5 : 1.3}" stroke-linecap="round" stroke-linejoin="round">${tile}<path ${inner} d="${G[g]}"/></svg>`;
  };

  const KIND = {
    html: ['#E37933', 'code'], htm: ['#E37933', 'code'], xml: ['#E37933', 'code'], vue: ['#6FBF8B', 'code'], svg: ['#E6B450', 'angle'],
    js: ['#E6C84F', 'braces'], mjs: ['#E6C84F', 'braces'], cjs: ['#E6C84F', 'braces'], jsx: ['#5CC8E0', 'braces'], ts: ['#5A9BD5', 'braces'], tsx: ['#5CC8E0', 'braces'],
    json: ['#CBCB41', 'braces'], php: ['#8E9AD6', 'elephant'], py: ['#5A9BD5', 'snake'], java: ['#E8744F', 'code'], go: ['#5CC8E0', 'code'], rs: ['#E8744F', 'code'], rb: ['#E8605A', 'code'],
    c: ['#6C8BD6', 'code'], h: ['#9B8BD6', 'code'], cpp: ['#6C8BD6', 'code'], cs: ['#A579D0', 'code'], kt: ['#A579D0', 'code'], swift: ['#E8744F', 'code'], dart: ['#5CC8E0', 'code'],
    css: ['#5A9BD5', 'hash'], scss: ['#D670A6', 'hash'], sass: ['#D670A6', 'hash'], less: ['#5A7DB5', 'hash'],
    sh: ['#8BC46A', 'term'], bash: ['#8BC46A', 'term'], bat: ['#8BC46A', 'term'], ps1: ['#5A9BD5', 'term'], cmd: ['#8BC46A', 'term'],
    md: ['#7FB4DA', 'md'], txt: ['#9AA0A6', 'lines'], log: ['#9AA0A6', 'lines'], csv: ['#8BC46A', 'lines'],
    sql: ['#E8A23D', 'db'], sqlite: ['#E8A23D', 'db'], db: ['#E8A23D', 'db'],
    yml: ['#E8605A', 'gear'], yaml: ['#E8605A', 'gear'], toml: ['#9AA0A6', 'gear'], ini: ['#9AA0A6', 'gear'], conf: ['#9AA0A6', 'gear'], env: ['#E6C84F', 'key'],
    lock: ['#9AA0A6', 'lock'], png: ['#4DB6AC', 'image'], jpg: ['#4DB6AC', 'image'], jpeg: ['#4DB6AC', 'image'], gif: ['#4DB6AC', 'image'], webp: ['#4DB6AC', 'image'], ico: ['#4DB6AC', 'image'], bmp: ['#4DB6AC', 'image'],
    zip: ['#C9A26B', 'zip'], gz: ['#C9A26B', 'zip'], tar: ['#C9A26B', 'zip'], '7z': ['#C9A26B', 'zip'], pdf: ['#E8605A', 'pdf'],
  };
  const NAMED = {
    'package.json': ['#E8605A', 'box'], 'package-lock.json': ['#E8605A', 'lock'], 'composer.json': ['#C98A5A', 'box'], 'composer.lock': ['#C98A5A', 'lock'], 'artisan': ['#F0604D', 'term'],
    'manage.py': ['#4DB68A', 'snake'], 'requirements.txt': ['#5A9BD5', 'box'], 'dockerfile': ['#5AA9E6', 'box'], 'docker-compose.yml': ['#5AA9E6', 'box'], '.gitignore': ['#F0794D', 'git'], '.gitattributes': ['#F0794D', 'git'],
    'readme.md': ['#7FB4DA', 'md'], 'vite.config.js': ['#A579D0', 'gear'], 'vite.config.ts': ['#A579D0', 'gear'], 'tsconfig.json': ['#5A9BD5', 'gear'], 'webpack.config.js': ['#8DD6F9', 'gear'],
    'license': ['#C0A060', 'doc'], 'makefile': ['#9AA0A6', 'gear'],
  };

  // ---- Symbols-style folders: outlined, tinted by purpose --------------------------------------
  const FOLDERS = {
    src: '#5A9BD5', app: '#5A9BD5', lib: '#5A9BD5', source: '#5A9BD5', components: '#5A9BD5', pages: '#5A9BD5', views: '#5A9BD5',
    tests: '#8BC46A', test: '#8BC46A', __tests__: '#8BC46A', spec: '#8BC46A',
    node_modules: '#C9A26B', vendor: '#C9A26B', dist: '#C9A26B', build: '#C9A26B', '.venv': '#C9A26B', venv: '#C9A26B', __pycache__: '#C9A26B', storage: '#C9A26B', '.next': '#C9A26B', target: '#C9A26B',
    public: '#A579D0', static: '#A579D0', assets: '#A579D0', resources: '#A579D0', media: '#A579D0',
    config: '#9AA0A6', '.github': '#9AA0A6', '.vscode': '#5A9BD5', '.idea': '#9AA0A6', docs: '#4DB6AC', migrations: '#E8A23D', database: '#E8A23D', routes: '#E37933', scripts: '#8BC46A', bin: '#8BC46A', '.git': '#F0794D',
  };
  const folderSvg = (color, open) => open
    ? `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round"><path d="M2 12.5V3.8a1 1 0 0 1 1-1h3l1.5 1.5H12a1 1 0 0 1 1 1V6"/><path d="M2 12.5 3.6 7.2a1 1 0 0 1 .95-.7H14a.6.6 0 0 1 .58.78L13.1 12.1a1 1 0 0 1-.95.7H2z" fill="${color}" fill-opacity=".25"/></svg>`
    : `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round"><path d="M2 4a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" fill="${color}" fill-opacity=".2"/></svg>`;

  CF.fileIconHtml = (name, isDir, open) => {
    const n = name.toLowerCase();
    if (isDir) return folderSvg(theme() === 'minimal' ? '#9AA0A6' : (FOLDERS[n] || '#8FA9BF'), open);
    if (NAMED[n]) return glyph(...NAMED[n]);
    if (n.endsWith('.blade.php')) return glyph('#F0604D', 'code');
    if (/\.(pyw|pyi)$/.test(n)) return glyph(...KIND.py);
    if (/\.(phtml|php\d)$/.test(n)) return glyph(...KIND.php);
    if (/\.(test|spec)\.[jt]sx?$/.test(n)) return glyph('#8BC46A', 'flask');
    if (n.startsWith('.env')) return glyph(...KIND.env);
    const ext = n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : '';
    return KIND[ext] ? glyph(...KIND[ext]) : glyph('#9AA0A6', 'doc');
  };

  CF.iconThemePicker = () => {
    const { h } = CF; const o = document.getElementById('overlay'); o.innerHTML = ''; o.className = ''; o.hidden = false;
    const cur = theme();
    const list = h('div', { class: 'list' }, Object.entries(CF.ICON_THEMES).map(([id, name]) => h('div', { class: 'it' + (id === cur ? ' sel' : ''), onclick: async () => { CF.closeOverlay(); await CF.setSetting({ iconTheme: id }); } },
      h('span', { html: ['a.js', 'b.py', 'c.css', 'd.json'].map((f) => CF.fileIconHtml(f, false)).join(' ') }), h('span', {}, name), h('span', { class: 'muted' }, id === cur ? 'current' : ''))));
    o.append(h('div', { class: 'palette' }, list)); o.onmousedown = (e) => { if (e.target === o) CF.closeOverlay(); };
  };

  document.querySelectorAll('i[data-ic]').forEach((el) => { el.innerHTML = CF.iconHtml(el.dataset.ic, el.closest('#activitybar') ? 24 : 15); });
})();
