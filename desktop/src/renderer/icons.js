// SVG icon set: stroke UI icons (activity bar, toolbars) and JetBrains-style file / folder icons for the Explorer.
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
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    minus: '<path d="M5 12h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    newFile: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    newFolder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>',
    collapse: '<path d="M7 9l5-5 5 5M7 15l5 5 5-5"/>',
    split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
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

  // ---- JetBrains-style file icons: rounded badge with a language mark --------------------------
  const BADGES = {
    php: ['#7A86B8', 'php'], py: ['#3C78AA', 'Py'], js: ['#E8B400', 'JS', '#1b1b1b'], mjs: ['#E8B400', 'JS', '#1b1b1b'], cjs: ['#E8B400', 'JS', '#1b1b1b'], jsx: ['#08A7C9', 'JSX'],
    ts: ['#3178C6', 'TS'], tsx: ['#3178C6', 'TSX'], vue: ['#3FB27F', 'V'], html: ['#E4572E', 'H'], htm: ['#E4572E', 'H'], css: ['#2D8FDD', 'CSS'], scss: ['#CD6799', 'Sc'], sass: ['#CD6799', 'Sa'], less: ['#2B5797', 'Le'],
    json: ['#8F8F8F', '{ }', '#fff'], md: ['#5B8DB8', 'MD'], sql: ['#E48E00', 'SQL'], yml: ['#CB171E', 'Y'], yaml: ['#CB171E', 'Y'], xml: ['#D2691E', '</>'], sh: ['#4EAA25', '$_'], bash: ['#4EAA25', '$_'], bat: ['#4EAA25', '$_'], ps1: ['#2F6DB5', 'PS'],
    env: ['#E6B422', 'env', '#1b1b1b'], txt: ['#8E9AAF', 'txt'], log: ['#8E9AAF', 'log'], lock: ['#8E9AAF', 'lck'], svg: ['#F5A623', 'SVG', '#1b1b1b'], java: ['#E76F00', 'J'], go: ['#00ADD8', 'Go'], rs: ['#CE4A1D', 'Rs'],
    rb: ['#CC342D', 'Rb'], c: ['#5C6BC0', 'C'], h: ['#5C6BC0', 'H'], cpp: ['#00599C', 'C+'], cs: ['#68217A', 'C#'], kt: ['#7F52FF', 'Kt'], swift: ['#F05138', 'Sw'], dart: ['#0175C2', 'Da'], ini: ['#8E9AAF', 'ini'], toml: ['#8E9AAF', 'tml'],
    png: ['#46A2A8', 'img'], jpg: ['#46A2A8', 'img'], jpeg: ['#46A2A8', 'img'], gif: ['#46A2A8', 'img'], webp: ['#46A2A8', 'img'], ico: ['#46A2A8', 'ico'], zip: ['#B8892D', 'zip'], pdf: ['#D93025', 'pdf'],
  };
  const NAMED = {
    'package.json': ['#CB3837', 'npm'], 'package-lock.json': ['#CB3837', 'npm'], 'composer.json': ['#885630', 'cmp'], 'composer.lock': ['#885630', 'cmp'], 'artisan': ['#FF2D20', 'L'],
    'manage.py': ['#0C4B33', 'Dj'], 'requirements.txt': ['#3C78AA', 'Py'], 'dockerfile': ['#2496ED', 'Dk'], '.gitignore': ['#F05033', 'git'], '.gitattributes': ['#F05033', 'git'], 'readme.md': ['#5B8DB8', 'i'],
    'vite.config.js': ['#8B5CF6', 'Vi'], 'vite.config.ts': ['#8B5CF6', 'Vi'], 'tsconfig.json': ['#3178C6', 'TS'], 'webpack.config.js': ['#8DD6F9', 'Wp', '#1b1b1b'], '.env': ['#E6B422', 'env', '#1b1b1b'],
    'license': ['#C0A060', 'Li'], 'makefile': ['#6D8086', 'Mk'],
  };
  const badge = (bg, txt, fg = '#fff') => {
    const fs = txt.length > 2 ? 6.2 : txt.length === 2 ? 7.4 : 9;
    return `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="3.2" fill="${bg}"/><text x="8" y="11.1" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="${fs}" fill="${fg}">${txt.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;
  };
  const GENERIC = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 1.5h5.2L13 5.3V13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V3A1.5 1.5 0 0 1 4 1.5z" fill="#9AA7B0" fill-opacity=".25" stroke="#9AA7B0" stroke-width="1"/><path d="M9 1.8V5.5h3.7" fill="none" stroke="#9AA7B0" stroke-width="1"/></svg>';

  // ---- JetBrains-style folders (flat, blue-grey; special folders tinted) -------------------------
  const FOLDERS = {
    src: '#4E9BD6', app: '#4E9BD6', lib: '#4E9BD6', source: '#4E9BD6', components: '#4E9BD6', pages: '#4E9BD6', views: '#4E9BD6',
    tests: '#62B543', test: '#62B543', __tests__: '#62B543', spec: '#62B543',
    node_modules: '#C9A26B', vendor: '#C9A26B', dist: '#C9A26B', build: '#C9A26B', '.venv': '#C9A26B', venv: '#C9A26B', __pycache__: '#C9A26B', storage: '#C9A26B', '.next': '#C9A26B', target: '#C9A26B',
    public: '#9B7BD6', static: '#9B7BD6', assets: '#9B7BD6', resources: '#9B7BD6', media: '#9B7BD6',
    config: '#7E8E9A', '.github': '#8E9AAF', '.vscode': '#4E9BD6', '.idea': '#8E9AAF', docs: '#5BA8A0', migrations: '#E48E00', database: '#E48E00', routes: '#E4572E', scripts: '#4EAA25', bin: '#4EAA25',
  };
  const folderSvg = (color, open) => open
    ? `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.5 1.5H12A1.5 1.5 0 0 1 13.5 5.5V6H4.2a1.5 1.5 0 0 0-1.45 1.1L1.5 11.8z" fill="${color}" fill-opacity=".75"/><path d="M3.1 7.2A1 1 0 0 1 4.05 6.5H14.4a.8.8 0 0 1 .77 1.02l-1.35 4.9a1.2 1.2 0 0 1-1.15.88H2.6z" fill="${color}"/></svg>`
    : `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5.5v6.8A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12z" fill="${color}"/><path d="M1.5 6h13" stroke="#fff" stroke-opacity=".18"/></svg>`;

  CF.fileIconHtml = (name, isDir, open) => {
    const n = name.toLowerCase();
    if (isDir) return folderSvg(FOLDERS[n] || '#8FA1B3', open);
    if (NAMED[n]) return badge(...NAMED[n]);
    if (n.endsWith('.blade.php')) return badge('#FF2D20', 'Bl');
    if (n.startsWith('.env')) return badge(...BADGES.env);
    const ext = n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : '';
    return BADGES[ext] ? badge(...BADGES[ext]) : GENERIC;
  };

  document.querySelectorAll('i[data-ic]').forEach((el) => { el.innerHTML = CF.iconHtml(el.dataset.ic, el.closest('#activitybar') ? 24 : 15); });
})();
