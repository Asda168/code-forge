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
    new ResizeObserver(() => activeTerm && activeTerm.fit()).observe($('#panel-terminal'));
  });

  CF.newTerminal = CF.guard(async (shellId, cwd) => {
    CF.showPanel('terminal');
    const host = h('div', { class: 'term' }); $('#panel-terminal').append(host);
    const xterm = new Terminal({ fontFamily: `"${S.settings.fontFamily}", monospace`, fontSize: Math.max(11, S.settings.fontSize - 1), cursorBlink: true, theme: CF.termTheme(), allowProposedApi: true, scrollback: 5000 });
    const fitAddon = new FitAddon.FitAddon(); xterm.loadAddon(fitAddon); xterm.open(host);
    const fit = () => { try { fitAddon.fit(); cf.term.resize(t.id, xterm.cols, xterm.rows); } catch { /* hidden */ } };
    const info = await cf.term.create({ shellId: shellId || S.settings.defaultShell || undefined, cwd: cwd || S.root, cols: xterm.cols, rows: xterm.rows });
    const t = { id: info.id, name: `${info.name} ${S.terms.filter((x) => x.name.startsWith(info.name)).length + 1}`, host, xterm, fit, cwd };
    xterm.onData((d) => cf.term.write(t.id, d));
    xterm.attachCustomKeyEventHandler((e) => { // Ctrl+Shift+C/V copy-paste
      if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyC') { navigator.clipboard.writeText(xterm.getSelection()); return false; }
      if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyV') { navigator.clipboard.readText().then((x) => cf.term.write(t.id, x)); return false; }
      return true;
    });
    S.terms.push(t); selectTerm(t);
    if (!info.pty) xterm.write('\x1b[33m[node-pty not installed: limited line-mode terminal. Run `npm i node-pty` for a full terminal.]\x1b[0m\r\n');
    return t;
  });
  function selectTerm(t) {
    activeTerm = t; S.terms.forEach((x) => x.host.classList.toggle('hidden', x !== t));
    const tabs = $('#term-tabs'); tabs.innerHTML = '';
    S.terms.forEach((x) => tabs.append(h('div', { class: 'tt' + (x === t ? ' active' : ''), onclick: () => selectTerm(x) }, x.name, ' ',
      h('span', { onclick: (e) => { e.stopPropagation(); closeTerm(x); }, style: 'opacity:.6' }, '✕'))));
    requestAnimationFrame(() => { t.fit(); t.xterm.focus(); });
  }
  function closeTerm(t) {
    cf.term.kill(t.id); t.xterm.dispose(); t.host.remove(); S.terms.splice(S.terms.indexOf(t), 1);
    if (runTerm === t) runTerm = null;
    if (S.terms.length) selectTerm(S.terms[S.terms.length - 1]); else { activeTerm = null; $('#term-tabs').innerHTML = ''; }
  }
  CF.showPanel = (name) => {
    $('#panel').classList.remove('hidden');
    $$('#panel-tabs [data-panel]').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
    ['terminal', 'problems', 'debug'].forEach((p) => ($('#panel-' + p).hidden = p !== name));
    $('#term-tabs').hidden = name !== 'terminal';
    if (name === 'terminal' && activeTerm) setTimeout(() => activeTerm.fit(), 0);
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
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => CF.runProject() }, '▶ Run'), h('button', { class: 'btn sec sm', onclick: () => CF.runProject(null, true) }, '🐞 Debug'),
        h('button', { class: 'btn sec sm', onclick: CF.stopRun }, '■ Stop'), h('button', { class: 'btn sec sm', onclick: CF.restartRun }, '↻ Restart'))));
    body.append(h('div', { class: 'sec-head' }, 'Run configurations', h('span', { class: 'grow' }), h('button', { class: 'icon-btn', onclick: addConfig }, '＋')));
    runs.forEach((c) => body.append(h('div', { class: 'gi', onclick: () => CF.runProject(c) }, h('span', {}, '▶'), h('span', { class: 'nm' }, c.name), h('span', { class: 'muted mono' }, c.command))));
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
