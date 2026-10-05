// Integrated terminals (xterm.js over the main-process PTY), project runner, Laravel/Django tools, project wizard.
(() => {
  const { S, $, h, base, join } = CF;
  S.terms = []; S.shells = []; let activeTerm = null; let runTerm = null; S.project = { kinds: [], runs: [] };

  CF.initTerminal = CF.guard(async () => {
    S.shells = await cf.term.shells();
    const sel = $('#shell-select'); sel.innerHTML = '';
    S.shells.forEach((s) => sel.append(h('option', { value: s.id, selected: s.id === S.settings.defaultShell }, s.name)));
    cf.term.onData((id, d) => { const t = S.terms.find((x) => x.id === id); if (t) t.xterm.write(d); });
    cf.term.onExit((id) => { const t = S.terms.find((x) => x.id === id); if (t) { t.xterm.write('\r\n[process exited]\r\n'); t.exited = true; } });
    $('#term-new').onclick = () => CF.newTerminal($('#shell-select').value);
    $('#term-split').onclick = CF.splitTerminal; $('#term-kill').onclick = CF.killTerminal;
    new ResizeObserver(() => activeTerm && activeTerm.grp.terms.forEach((x) => x.fit())).observe($('#panel-terminal'));
  });

  S.tgroups = [];
  const quoteFor = (t, p) => {
    if (t.posix) { const x = S.platform.platform === 'win32' ? p.replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase()).replace(/\\/g, '/') : p; return "'" + x.replace(/'/g, "'\\''") + "'"; }
    return '"' + p.replace(/"/g, '') + '"';
  };
  const dropPaths = (e) => {
    const out = []; const dt = e.dataTransfer;
    const internal = dt.getData('text/cf-path'); if (internal) out.push(internal);
    for (const f of dt.files || []) { try { const p = cf.pathFor(f); if (p) out.push(p); } catch { /* ignore */ } }
    return out;
  };
  function wireDrop(t) {
    const host = t.host;
    host.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; host.classList.add('drop'); });
    host.addEventListener('dragleave', () => host.classList.remove('drop'));
    host.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation(); host.classList.remove('drop');
      const paths = dropPaths(e); if (!paths.length) return;
      selectTerm(t); cf.term.write(t.id, paths.map((p) => quoteFor(t, p)).join(' ') + ' ');
    });
  }

  const APP_KEYS = new Set(['KeyB', 'KeyP', 'KeyJ', 'Backquote', 'Equal', 'Minus', 'Digit0', 'Comma', 'Backslash', 'Tab', 'NumpadAdd', 'NumpadSubtract']);
  const APP_CHARS = new Set(['b', 'p', 'j', '`', '=', '+', '-', '0', ',', '\\', 'tab']);   // fallback when e.code is empty / non-QWERTY layouts
  CF.newTerminal = CF.guard(async (shellId, cwd, opts = {}) => {
    CF.showPanel('terminal');
    const host = h('div', { class: 'term' }); $('#panel-terminal').append(host);
    const xterm = new Terminal({ fontFamily: `"${S.settings.fontFamily}", monospace`, fontSize: Math.max(11, S.settings.fontSize - 1), cursorBlink: true, theme: CF.termTheme(), allowProposedApi: true, scrollback: 5000 });
    const fitAddon = new FitAddon.FitAddon(); xterm.loadAddon(fitAddon); xterm.open(host);
    const fit = () => { try { fitAddon.fit(); cf.term.resize(t.id, xterm.cols, xterm.rows); } catch { /* hidden */ } };
    const split = opts.split && activeTerm;
    const sh = shellId || (split && activeTerm.shellId) || undefined;
    const info = await cf.term.create({ shellId: sh || S.settings.defaultShell || undefined, cwd: cwd || (split && activeTerm.cwd) || S.root, cols: xterm.cols, rows: xterm.rows });
    const t = { id: info.id, name: `${info.name} ${S.terms.filter((x) => x.name.startsWith(info.name)).length + 1}`, host, xterm, fit, cwd, shellId: sh, posix: /bash|zsh|wsl/i.test(info.name) || /(^|\s)sh$/i.test(info.name) };
    xterm.onData((d) => cf.term.write(t.id, d));
    xterm.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') { navigator.clipboard.writeText(xterm.getSelection()); return false; }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') { navigator.clipboard.readText().then((x) => cf.term.write(t.id, x)); return false; }
      if (e.ctrlKey && e.shiftKey && e.code === 'Digit5') { CF.splitTerminal(); return false; }
      if (e.ctrlKey && e.shiftKey && e.code === 'Backquote') { CF.newTerminal(); return false; }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyW') { closeTerm(t); return false; }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyK') { xterm.clear(); return false; }
      if (e.altKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight') && t.grp.terms.length > 1) { CF.focusPane(e.code === 'ArrowLeft' ? -1 : 1); return false; }
      if (e.ctrlKey && (e.code === 'PageUp' || e.code === 'PageDown')) { CF.cycleTerminal(e.code === 'PageUp' ? -1 : 1); return false; }
      // App shortcuts: xterm must not consume these (it would send them to the shell and cancel the menu accelerator).
      // Readline keys (Ctrl+C/D/L/R/W/A/E/K/U...) still go to the shell.
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.shiftKey || APP_KEYS.has(e.code) || APP_CHARS.has(e.key.toLowerCase()))) return false;
      if ((e.altKey && (e.code === 'KeyG' || e.key.toLowerCase() === 'g')) || e.code === 'F5' || e.code === 'F12') return false;
      return true;
    });
    host.addEventListener('mousedown', () => { if (activeTerm !== t) selectTerm(t); });
    wireDrop(t);
    if (split) { t.grp = activeTerm.grp; t.grp.terms.splice(t.grp.terms.indexOf(activeTerm) + 1, 0, t); }
    else { t.grp = { terms: [t] }; S.tgroups.push(t.grp); }
    S.terms.push(t); selectTerm(t);
    if (!info.pty) xterm.write('\x1b[33m[node-pty not installed: limited line-mode terminal. Run `npm i node-pty` for a full terminal.]\x1b[0m\r\n');
    return t;
  });
  CF.splitTerminal = () => (activeTerm ? CF.newTerminal(undefined, undefined, { split: true }) : CF.newTerminal());
  CF.cycleTerminal = (d) => { if (S.terms.length < 2) return; const i = S.terms.indexOf(activeTerm); selectTerm(S.terms[(i + d + S.terms.length) % S.terms.length]); };
  CF.focusPane = (d) => { const l = activeTerm.grp.terms; selectTerm(l[(l.indexOf(activeTerm) + d + l.length) % l.length]); };
  CF.clearTerminal = () => activeTerm && activeTerm.xterm.clear();
  CF.killTerminal = () => activeTerm && closeTerm(activeTerm);
  CF.renameTerminal = CF.guard(async () => { if (!activeTerm) return; const v = await CF.ask('Rename Terminal', [{ id: 'n', label: 'Name', value: activeTerm.name }], 'Rename'); if (v && v.n) { activeTerm.name = v.n; renderTermTabs(); } });

  function renderTermTabs() {
    const tabs = $('#term-tabs'); tabs.innerHTML = '';
    S.tgroups.forEach((g) => {
      const on = activeTerm && g === activeTerm.grp;
      const tab = h('div', { class: 'tt' + (on ? ' active' : ''), draggable: 'true', onclick: () => selectTerm(g.last && g.terms.includes(g.last) ? g.last : g.terms[0]),
        oncontextmenu: (e) => { e.preventDefault(); selectTerm(g.terms[0]); CF.menu(e, [['Split Terminal', CF.splitTerminal], ['New Terminal', () => CF.newTerminal()], ['Rename…', CF.renameTerminal], ['Clear', CF.clearTerminal], '-', ['Kill Terminal', CF.killTerminal]]); },
        ondragstart: (e) => { e.dataTransfer.setData('text/cf-tab', String(S.tgroups.indexOf(g))); },
        ondragover: (e) => { if (e.dataTransfer.types.includes('text/cf-tab')) { e.preventDefault(); tab.classList.add('drop'); } },
        ondragleave: () => tab.classList.remove('drop'),
        ondrop: (e) => { e.preventDefault(); tab.classList.remove('drop'); const from = +e.dataTransfer.getData('text/cf-tab'); const to = S.tgroups.indexOf(g); if (isNaN(from) || from === to) return; const [m] = S.tgroups.splice(from, 1); S.tgroups.splice(to, 0, m); renderTermTabs(); } },
        CF.icon('terminal', 13), h('span', {}, g.terms.map((x) => x.name).join(' | ')),
        h('span', { class: 'x', title: 'Kill terminal', onclick: (e) => { e.stopPropagation(); [...g.terms].forEach(closeTerm); } }, CF.icon('close', 12)));
      tabs.append(tab);
    });
  }
  function selectTerm(t) {
    activeTerm = t; t.grp.last = t;
    S.terms.forEach((x) => { x.host.classList.toggle('hidden', x.grp !== t.grp); x.host.classList.toggle('focus', x === t && t.grp.terms.length > 1); });
    t.grp.terms.forEach((x, i) => { x.host.style.order = i * 2; });
    layoutDividers();
    renderTermTabs();
    requestAnimationFrame(() => { t.grp.terms.forEach((x) => x.fit()); t.xterm.focus(); });
  }
  // draggable dividers between split panes
  function layoutDividers() {
    $$('#panel-terminal .pane-div').forEach((d) => d.remove());
    const g = activeTerm && activeTerm.grp; if (!g) return;
    g.terms.slice(0, -1).forEach((a, i) => {
      const b = g.terms[i + 1]; const d = h('div', { class: 'pane-div', style: `order:${i * 2 + 1}` });
      d.onmousedown = (e) => {
        e.preventDefault(); document.body.style.userSelect = 'none';
        const wa = a.host.getBoundingClientRect().width, wb = b.host.getBoundingClientRect().width, x0 = e.clientX;
        const mv = (ev) => { const dx = Math.max(-wa + 120, Math.min(wb - 120, ev.clientX - x0)); a.host.style.flex = `0 0 ${wa + dx}px`; b.host.style.flex = `0 0 ${wb - dx}px`; a.fit(); b.fit(); };
        const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.userSelect = ''; };
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      };
      d.ondblclick = () => { g.terms.forEach((x) => (x.host.style.flex = '')); g.terms.forEach((x) => x.fit()); };
      $('#panel-terminal').append(d);
    });
  }
  function closeTerm(t) {
    cf.term.kill(t.id); t.xterm.dispose(); t.host.remove();
    S.terms.splice(S.terms.indexOf(t), 1); const g = t.grp; g.terms.splice(g.terms.indexOf(t), 1);
    if (!g.terms.length) S.tgroups.splice(S.tgroups.indexOf(g), 1);
    if (runTerm === t) runTerm = null;
    if (g.terms.length) selectTerm(g.terms[0]);
    else if (S.terms.length) selectTerm(S.tgroups[S.tgroups.length - 1].terms[0]);
    else { activeTerm = null; $('#term-tabs').innerHTML = ''; }
  }
  CF.showPanel = (name) => {
    $('#panel').classList.remove('hidden');
    $$('#panel-tabs [data-panel]').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
    ['terminal', 'problems', 'debug'].forEach((p) => ($('#panel-' + p).hidden = p !== name));
    $('#term-tabs').hidden = name !== 'terminal';
    if (name === 'terminal' && activeTerm) setTimeout(() => activeTerm.grp.terms.forEach((x) => x.fit()), 0);
  };
  const $$ = CF.$$;
  CF.togglePanel = () => $('#panel').classList.toggle('hidden');

  // Programmatic commands (Run buttons, wizard) are shown in the terminal before Enter is sent,
  // and obviously destructive ones need an extra confirmation.
  CF.runInTerminal = CF.guard(async (command, { reuse = 'run', cwd } = {}) => {
    if (!(await cf.project.confirmDangerous(command))) return;
    let t = reuse === 'run' ? runTerm : null;
    if (!t || t.exited || !S.terms.includes(t)) { t = await CF.newTerminal(undefined, cwd); if (reuse === 'run') { runTerm = t; t.name = 'Run'; selectTerm(t); } }
    setTimeout(() => cf.term.write(t.id, command + '\r'), 250);
  });

  // ---- project runner ------------------------------------------------------------------
  const cfgKey = () => 'cf.runcfg.' + S.root;
  const customRuns = () => { try { return JSON.parse(localStorage.getItem(cfgKey()) || '[]'); } catch { return []; } };
  CF.detectProject = CF.guard(async () => { S.project = await cf.project.detect(S.root); if ($('#side-title').dataset.view === 'run') CF.showView('run'); });
  const sub = (s) => s.replace(/\$\{workspaceFolder\}/g, S.root);
  function runConfig(c, debug) {
    const env = (c.env || '').split(/[\s;]+/).filter((x) => /^[A-Za-z_]\w*=/.test(x));
    let cmd = c.command;
    if (debug) {
      if (/^npm|^node/.test(cmd)) cmd = cmd.replace(/^node /, 'node --inspect ').replace(/^npm run (\w+)/, 'node --inspect-brk node_modules/.bin/$1 #');
      else if (/^python/.test(cmd)) cmd = cmd.replace(/^python /, 'python -X dev -m pdb ');
      else if (/^php/.test(cmd)) env.push('XDEBUG_MODE=debug', 'XDEBUG_SESSION=1');
    }
    const prefix = env.length ? (S.platform.platform === 'win32' ? env.map((e) => `set ${e}&& `).join('') : env.join(' ') + ' ') : '';
    CF.debugLog(`${debug ? '[debug] ' : ''}$ ${prefix}${cmd}`);
    CF.runInTerminal(prefix + cmd, { cwd: c.cwd ? sub(c.cwd) : S.root });
    if (c.url) setTimeout(() => CF.toast(`Open ${c.url}`), 1500);
  }
  CF.debugLog = (line) => { const d = $('#panel-debug'); d.append(h('div', {}, line)); d.scrollTop = d.scrollHeight; };
  CF.stopRun = () => { if (runTerm && !runTerm.exited) cf.term.write(runTerm.id, '\x03'); };
  let lastCfg = null;
  CF.runProject = (c, debug) => { c = c || lastCfg || S.project.runs[0] || customRuns()[0]; if (!c) return CF.toast('No run configuration detected. Add one in the Run panel.', true); lastCfg = c; runConfig(c, debug); };
  CF.restartRun = () => { CF.stopRun(); setTimeout(() => CF.runProject(lastCfg), 800); };

  const LARAVEL_DIRS = { Routes: 'routes', Models: 'app/Models', Controllers: 'app/Http/Controllers', Middleware: 'app/Http/Middleware', Migrations: 'database/migrations', Views: 'resources/views', Jobs: 'app/Jobs', Events: 'app/Events' };
  async function listDir(sub) { try { return (await cf.fs.list(join(S.root, sub.replace(/\//g, S.platform.platform === 'win32' ? '\\' : '/')))).filter((x) => !x.dir); } catch { return []; } }

  CF.renderRun = (body) => {
    if (!S.root) return body.append(h('div', { class: 'pad muted' }, 'Open a folder first.'));
    const kinds = S.project.kinds;
    const runs = [...S.project.runs, ...customRuns()];
    body.append(h('div', { class: 'pad' },
      h('div', { class: 'muted', style: 'margin-bottom:8px' }, kinds.length ? 'Detected: ' + kinds.join(', ') : 'No project type detected'),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => CF.runProject() }, CF.icon('play', 13), ' Run'), h('button', { class: 'btn sec sm', onclick: () => CF.runProject(null, true) }, CF.icon('bug', 13), ' Debug'),
        h('button', { class: 'btn sec sm', onclick: CF.stopRun }, CF.icon('stop', 13), ' Stop'), h('button', { class: 'btn sec sm', onclick: CF.restartRun }, CF.icon('restart', 13), ' Restart'))));
    body.append(h('div', { class: 'sec-head' }, 'Run configurations', h('span', { class: 'grow' }), h('button', { class: 'icon-btn', title: 'Add configuration', onclick: addConfig }, CF.icon('plus', 14))));
    runs.forEach((c) => body.append(h('div', { class: 'gi run-cfg', onclick: () => CF.runProject(c) }, CF.icon('play', 12, 'ok'), h('span', { class: 'nm' }, c.name), h('span', { class: 'muted mono' }, c.command))));
    if (kinds.includes('laravel')) {
      body.append(h('div', { class: 'sec-head' }, 'Laravel'));
      [['route:list'], ['migrate'], ['optimize:clear'], ['make:model', 'Model name'], ['make:controller', 'Controller name'], ['make:migration', 'Migration name']].forEach(([a, ask]) =>
        body.append(h('div', { class: 'gi', onclick: async () => { let extra = ''; if (ask) { const v = await CF.ask('php artisan ' + a, [{ id: 'n', label: ask }]); if (!v || !/^[\w\\/]+$/.test(v.n)) return v && CF.toast('Invalid name', true); extra = ' ' + v.n; } CF.runInTerminal(`php artisan ${a}${extra}`, { reuse: 'new' }); } }, h('span', { class: 'nm mono' }, 'php artisan ' + a))));
      Object.entries(LARAVEL_DIRS).forEach(([label, dir]) => body.append(dirSection(label, dir)));
    }
    if (kinds.includes('django')) {
      body.append(h('div', { class: 'sec-head' }, 'Django'));
      ['runserver', 'makemigrations', 'migrate', 'createsuperuser', 'shell'].forEach((c) => body.append(h('div', { class: 'gi', onclick: () => CF.runInTerminal(`python manage.py ${c}`, { reuse: c === 'runserver' ? 'run' : 'new' }) }, h('span', { class: 'nm mono' }, 'python manage.py ' + c))));
      ['models.py', 'urls.py', 'views.py'].forEach((f) => body.append(djangoFiles(f)));
    }
  };
  function dirSection(label, dir) {
    const box = h('div'); let open = false;
    const head = h('div', { class: 'gi', onclick: async () => { open = !open; box.innerHTML = ''; if (open) (await listDir(dir)).forEach((f) => box.append(h('div', { class: 'hit', onclick: () => CF.openFile(f.path) }, f.name))); head.firstChild.textContent = open ? '▼' : '▶'; } }, h('span', {}, '▶'), label);
    return h('div', {}, head, box);
  }
  function djangoFiles(name) {
    const box = h('div'); let open = false;
    const head = h('div', { class: 'gi', onclick: async () => { open = !open; box.innerHTML = ''; head.firstChild.textContent = open ? '▼' : '▶'; if (!open) return;
      for (const d of await cf.fs.list(S.root)) if (d.dir && !d.name.startsWith('.')) { const f = (await cf.fs.list(d.path).catch(() => [])).find((x) => x.name === name); if (f) box.append(h('div', { class: 'hit', onclick: () => CF.openFile(f.path) }, `${d.name}/${name}`)); } } }, h('span', {}, '▶'), name);
    return h('div', {}, head, box);
  }
  const addConfig = CF.guard(async () => {
    const v = await CF.ask('Run Configuration', [{ id: 'name', label: 'Name', value: 'Laravel Development' }, { id: 'command', label: 'Command', value: 'php artisan serve' },
      { id: 'cwd', label: 'Working Directory', value: '${workspaceFolder}' }, { id: 'env', label: 'Environment (KEY=VALUE …)', value: 'APP_ENV=local' }], 'Save');
    if (!v || !v.name || !v.command) return;
    localStorage.setItem(cfgKey(), JSON.stringify([...customRuns(), { name: v.name, command: v.command, cwd: v.cwd, env: v.env }])); CF.showView('run');
  });

  // ---- New Project wizard & Clone -------------------------------------------------------------
  CF.newProjectWizard = CF.guard(async () => {
    const v = await CF.ask('New Project', [
      { id: 'kind', label: 'Project type', type: 'select', options: ['laravel', 'django', 'python', 'node', 'vue', 'react', 'php', 'empty'] },
      { id: 'name', label: 'Project name', value: 'my-app' }, { id: 'location', label: 'Location', value: '', browse: true, placeholder: 'Choose a folder' }], 'Create Project');
    if (!v) return; if (!v.location) return CF.toast('Choose a location', true);
    const plan = await cf.project.scaffold(v);
    if (!(await CF.confirm('These commands will run in the terminal:\n\n' + plan.commands.join('\n') + '\n\nin ' + plan.cwd, 'Run'))) return;
    CF.showPanel('terminal');
    const t = await CF.newTerminal(undefined, undefined); // cwd must be inside a root; scaffold runs via cd
    const cd = (S.platform.platform === 'win32' ? 'cd /d ' : 'cd ') + `"${plan.cwd}"`;
    setTimeout(() => cf.term.write(t.id, [cd, ...plan.commands].join(' && ') + '\r'), 300);
    CF.toast('When setup finishes, click "Open Project" in the notification.');
    CF.modal('Project setup running', [h('p', {}, `Watch the terminal. When it finishes, open ${plan.target}.`)], [{ label: 'Later', cls: 'sec' }, { label: 'Open Project', run: CF.guard(async () => { CF.closeOverlay(); CF.setRoot(await cf.project.openRoot(plan.target)); }) }]);
  });
})();
