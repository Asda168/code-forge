// CodeForge main process: the secure local bridge.
// Everything local (fs, terminal, git, processes) lives here and is reachable ONLY through
// contextBridge -> ipcMain from our own window. No local HTTP/WebSocket server is opened.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const { execFile, spawn } = require('child_process');
const sec = require('./security');

let pty = null;
try { pty = require('node-pty'); } catch { /* falls back to piped child_process */ }

const API_BASE = process.env.CODEFORGE_API || 'http://127.0.0.1:8000/api';
const userData = () => app.getPath('userData');
const storeFile = (n) => path.join(userData(), n);

function readJson(name, def) { try { return JSON.parse(fs.readFileSync(storeFile(name), 'utf8')); } catch { return def; } }
function writeJson(name, v) { fs.mkdirSync(userData(), { recursive: true }); fs.writeFileSync(storeFile(name), JSON.stringify(v, null, 2)); }

const roots = new Set();      // workspace roots the user opened via dialog / recents
let win = null;

// ---------------------------------------------------------------- window
function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#0b1020', title: 'CodeForge',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (process.env.CODEFORGE_DEBUG) win.webContents.on('console-message', (_e, level, msg, line, src) => { if (level >= 2) console.log(`[renderer:${level}] ${msg} (${path.basename(src)}:${line})`); });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (process.env.CODEFORGE_E2E) win.webContents.once('did-finish-load', () => setTimeout(async () => {
    try {
      const dir = process.env.CODEFORGE_E2E_ROOT; if (dir) registerRoot(dir);
      const out = await win.webContents.executeJavaScript(fs.readFileSync(process.env.CODEFORGE_E2E, 'utf8'));
      console.log('[e2e]', typeof out === 'string' ? out : JSON.stringify(out, null, 1));
    } catch (e) { console.log('[e2e-error]', e.message); }
    app.quit();
  }, 5000));
  if (process.env.CODEFORGE_DEBUG) setTimeout(() => win.webContents.executeJavaScript(
    `JSON.stringify({monaco:!!window.monaco,groups:document.querySelectorAll('.group').length,welcome:!document.getElementById('welcome').hidden,shells:CF.S.shells.map(s=>s.name),font:getComputedStyle(document.body).fontFamily})`
  ).then((r) => console.log('[selftest]', r)).catch((e) => console.log('[selftest-error]', e.message)), 8000);
  let forceClose = false;
  win.on('close', (e) => { if (!forceClose) { e.preventDefault(); send('ask-close'); } });
  ipcMain.removeHandler('app:forceClose');
  ipcMain.handle('app:forceClose', () => { forceClose = true; win.close(); });
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
  buildMenu();
}

function send(ch, ...a) { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); }

function buildMenu() {
  const cmd = (label, id, accelerator) => ({ label, accelerator, click: () => send('menu', id) });
  const mac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [cmd('Open Folder…', 'open-folder', 'CmdOrCtrl+O'), cmd('New File', 'new-file', 'CmdOrCtrl+N'), cmd('New Folder', 'new-folder'),
      cmd('Quick Open…', 'quick-open', 'CmdOrCtrl+P'), cmd('Save', 'save', 'CmdOrCtrl+S'), cmd('Close Editor', 'close-tab', 'CmdOrCtrl+W'), cmd('Next Editor', 'next-tab', 'Ctrl+Tab'), cmd('Previous Editor', 'prev-tab', 'Ctrl+Shift+Tab'), cmd('Split Editor', 'split', 'CmdOrCtrl+\\'), cmd('Save All', 'save-all', 'CmdOrCtrl+Alt+S'), { type: 'separator' }, cmd('Save Workspace', 'save-workspace'), cmd('Open Workspace', 'open-workspace'), cmd('Close Workspace', 'close-workspace'), { type: 'separator' }, mac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' }, cmd('Find in Files', 'search', 'CmdOrCtrl+Shift+F')] },
    { label: 'Selection', submenu: [cmd('Select All', 'select-all')] },
    { label: 'View', submenu: [cmd('Command Palette…', 'palette', 'CmdOrCtrl+Shift+P'), cmd('Toggle Sidebar', 'toggle-sidebar', 'CmdOrCtrl+B'), cmd('Toggle Terminal', 'toggle-terminal', 'CmdOrCtrl+`'), cmd('Explorer', 'view-explorer', 'CmdOrCtrl+Shift+E'), cmd('Source Control', 'view-git', 'Ctrl+Shift+G'), cmd('Extensions', 'view-extensions', 'CmdOrCtrl+Shift+X'),
      { type: 'separator' }, cmd('Increase Font Size', 'font-inc', 'CmdOrCtrl+='), cmd('Decrease Font Size', 'font-dec', 'CmdOrCtrl+-'), cmd('Reset Font Size', 'font-reset', 'CmdOrCtrl+0'), { type: 'separator' }, { role: 'toggleDevTools' }, { role: 'togglefullscreen' }] },
    { label: 'Go', submenu: [cmd('Go to Line…', 'goto-line', 'CmdOrCtrl+G'), cmd('Go to Definition', 'goto-def', 'F12')] },
    { label: 'Run', submenu: [cmd('Run Project', 'run', 'F5'), cmd('Stop', 'stop', 'Shift+F5'), cmd('Restart', 'restart', 'CmdOrCtrl+Shift+F5')] },
    { label: 'Terminal', submenu: [cmd('New Terminal', 'new-terminal', 'Ctrl+Shift+`'), cmd('New Git Bash', 'new-gitbash')] },
    { label: 'Git', submenu: [cmd('Clone Repository…', 'git-clone'), cmd('Initialize Repository', 'git-init'), cmd('Commit', 'git-commit'), cmd('Push', 'git-push'), cmd('Pull', 'git-pull'), cmd('Fetch', 'git-fetch')] },
    { label: 'Help', submenu: [cmd('Check for Updates…', 'check-updates'), cmd('Settings', 'settings', 'CmdOrCtrl+,')] },
  ]));
}

// ---------------------------------------------------------------- helpers
function openExternal(url) {
  try {
    const u = new URL(url);
    if (['http:', 'https:'].includes(u.protocol)) shell.openExternal(u.toString());
  } catch { /* ignore */ }
}

function assertInRoot(p) {
  if (typeof p !== 'string' || !path.isAbsolute(p)) throw new Error('Absolute path required');
  if (path.resolve(p) === path.resolve(storeFile('settings.json'))) return path.resolve(p);   // the one config file editable in-app
  if (!sec.insideAnyRoot(p, [...roots])) throw new Error('Path is outside the open workspace');
  return path.resolve(p);
}

function registerRoot(p) {
  const r = path.resolve(p);
  if (!sec.isAllowedRoot(r)) throw new Error('This folder cannot be opened as a workspace (system or home directory).');
  roots.add(r);
  const recents = readJson('recents.json', []).filter((x) => x.path !== r);
  recents.unshift({ path: r, name: path.basename(r), at: Date.now() });
  writeJson('recents.json', recents.slice(0, 15));
  return r;
}

const IGNORE_SEARCH = new Set(['node_modules', '.git', 'vendor', '__pycache__', '.venv', 'venv', 'dist', 'build', 'storage', '.next']);

// ---------------------------------------------------------------- workspace
ipcMain.handle('ws:openDialog', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : registerRoot(r.filePaths[0]);
});
ipcMain.handle('ws:recents', () => readJson('recents.json', []).filter((r) => fs.existsSync(r.path)));
ipcMain.handle('ws:openRecent', (_e, p) => {
  const known = readJson('recents.json', []).some((r) => r.path === path.resolve(p));
  if (!known) throw new Error('Not a known recent project');
  return registerRoot(p);
});
ipcMain.handle('ws:pickDir', async () => {           // for "Location" fields in wizards / clone
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('ws:saveWorkspace', (_e, ws) => {
  const all = readJson('workspaces.json', {});
  all[String(ws.name)] = ws; writeJson('workspaces.json', all); return true;
});
ipcMain.handle('ws:listWorkspaces', () => Object.values(readJson('workspaces.json', {})));
ipcMain.handle('ws:loadWorkspace', (_e, name) => {
  const ws = readJson('workspaces.json', {})[name];
  if (!ws) throw new Error('Unknown workspace');
  (ws.folders || []).forEach((f) => { if (fs.existsSync(f)) registerRoot(f); });
  return ws;
});

// ---------------------------------------------------------------- filesystem
ipcMain.handle('fs:list', async (_e, dir) => {
  dir = assertInRoot(dir);
  const ents = await fsp.readdir(dir, { withFileTypes: true });
  return ents.map((d) => ({ name: d.name, path: path.join(dir, d.name), dir: d.isDirectory(), link: d.isSymbolicLink() }))
    .sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
});
ipcMain.handle('fs:read', async (_e, p) => {
  p = assertInRoot(p);
  const st = await fsp.stat(p);
  if (st.size > 20 * 1024 * 1024) throw new Error('File too large (>20 MB)');
  const buf = await fsp.readFile(p);
  if (buf.subarray(0, 8000).includes(0)) throw new Error('Binary file');
  const text = buf.toString('utf8');
  return { text, eol: text.includes('\r\n') ? 'CRLF' : 'LF', size: st.size, mtime: st.mtimeMs };
});
ipcMain.handle('fs:write', async (_e, p, text) => { p = assertInRoot(p); await fsp.writeFile(p, text, 'utf8'); return (await fsp.stat(p)).mtimeMs; });
ipcMain.handle('fs:createFile', async (_e, dir, name) => {
  dir = assertInRoot(dir); const p = path.join(dir, sec.validateName(name));
  await fsp.writeFile(p, '', { flag: 'wx' }); return p;
});
ipcMain.handle('fs:mkdir', async (_e, dir, name) => {
  dir = assertInRoot(dir); const p = path.join(dir, sec.validateName(name));
  await fsp.mkdir(p); return p;
});
ipcMain.handle('fs:rename', async (_e, p, newName) => {
  p = assertInRoot(p); if (sec.isProtectedPath(p)) throw new Error('Protected path');
  const to = path.join(path.dirname(p), sec.validateName(newName));
  if (fs.existsSync(to)) throw new Error('Target already exists');
  await fsp.rename(p, to); return to;
});
ipcMain.handle('fs:move', async (_e, p, destDir) => {
  p = assertInRoot(p); destDir = assertInRoot(destDir);
  if (sec.isProtectedPath(p)) throw new Error('Protected path');
  if (sec.isInside(destDir, p)) throw new Error('Cannot move a folder into itself');
  const to = path.join(destDir, path.basename(p));
  if (fs.existsSync(to)) throw new Error('Target already exists');
  await fsp.rename(p, to); return to;
});
async function uniqueName(dir, base) {
  const ext = path.extname(base), stem = path.basename(base, ext);
  let n = 0, cand = base;
  while (fs.existsSync(path.join(dir, cand))) cand = `${stem} copy${n++ ? ' ' + n : ''}${ext}`;
  return path.join(dir, cand);
}
ipcMain.handle('fs:copy', async (_e, src, destDir) => {
  src = assertInRoot(src); destDir = assertInRoot(destDir);
  if ((await fsp.stat(src)).isDirectory() && sec.isInside(destDir, src)) throw new Error('Cannot copy a folder into itself');
  const to = await uniqueName(destDir, path.basename(src));
  await fsp.cp(src, to, { recursive: true, errorOnExist: true }); return to;
});
ipcMain.handle('fs:delete', async (_e, p) => {
  p = assertInRoot(p);
  if (sec.isProtectedPath(p) || [...roots].some((r) => path.resolve(r) === p)) throw new Error('Refusing to delete a protected path or workspace root');
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning', buttons: ['Move to Trash', 'Cancel'], defaultId: 1, cancelId: 1,
    message: `Delete "${path.basename(p)}"?`, detail: p,
  });
  if (response !== 0) return false;
  await shell.trashItem(p);   // recoverable; never permanent rm
  return true;
});
ipcMain.handle('fs:reveal', (_e, p) => { shell.showItemInFolder(assertInRoot(p)); });
ipcMain.handle('fs:exists', (_e, p) => fs.existsSync(assertInRoot(p)));

// project-wide text search (streams results in batches, skips heavy dirs, bounded)
ipcMain.handle('fs:search', async (_e, root, query, opts = {}) => {
  root = assertInRoot(root);
  if (!query) return [];
  let re;
  try {
    let src = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (opts.word) src = `\\b${src}\\b`;
    re = new RegExp(src, opts.case ? 'g' : 'gi');
  } catch (err) { throw new Error('Invalid regex'); }
  const results = []; let files = 0;
  const MAX = 2000;
  async function walk(dir) {
    if (results.length >= MAX) return;
    let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const d of ents) {
      if (results.length >= MAX) return;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) { if (!IGNORE_SEARCH.has(d.name) && !d.isSymbolicLink()) await walk(full); continue; }
      if (!d.isFile()) continue;
      let st; try { st = await fsp.stat(full); } catch { continue; }
      if (st.size > 2 * 1024 * 1024) continue;
      let buf; try { buf = await fsp.readFile(full); } catch { continue; }
      if (buf.subarray(0, 4000).includes(0)) continue;
      files++;
      const lines = buf.toString('utf8').split(/\r?\n/);
      for (let i = 0; i < lines.length && results.length < MAX; i++) {
        re.lastIndex = 0;
        const m = re.exec(lines[i]);
        if (m) results.push({ path: full, rel: path.relative(root, full), line: i + 1, col: m.index + 1, text: lines[i].slice(0, 300) });
      }
    }
  }
  await walk(root);
  return results;
});
ipcMain.handle('fs:replaceInFile', async (_e, p, query, repl, opts = {}) => {
  p = assertInRoot(p);
  let src = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (opts.word) src = `\\b${src}\\b`;
  const re = new RegExp(src, opts.case ? 'g' : 'gi');
  const text = await fsp.readFile(p, 'utf8');
  const out = text.replace(re, repl);
  if (out !== text) await fsp.writeFile(p, out, 'utf8');
  return out !== text;
});

// quick-open index (bounded, skips heavy dirs)
ipcMain.handle('fs:files', async (_e, root) => {
  root = assertInRoot(root); const out = []; const MAX = 50000;
  async function walk(dir) {
    if (out.length >= MAX) return;
    let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const d of ents) {
      if (d.isDirectory()) { if (!IGNORE_SEARCH.has(d.name) && !d.isSymbolicLink()) await walk(path.join(dir, d.name)); }
      else if (d.isFile()) out.push(path.relative(root, path.join(dir, d.name)));
    }
  }
  await walk(root); return out;
});
let watcher = null, watchTimer = null;
ipcMain.handle('fs:watch', (_e, root) => {
  root = assertInRoot(root);
  if (watcher) { watcher.close(); watcher = null; }
  try {
    watcher = fs.watch(root, { recursive: true }, (_ev, name) => {
      if (!name) return;
      const parts = String(name).split(/[\\/]/);
      if (parts.some((p) => p === '.git' || IGNORE_SEARCH.has(p))) return;
      clearTimeout(watchTimer); watchTimer = setTimeout(() => send('fs:changed'), 400);
    });
    watcher.on('error', () => {});
  } catch { /* unsupported: manual refresh still works */ }
  return true;
});

// ---------------------------------------------------------------- shells & terminals
function findGitBash() {
  const cfg = readJson('settings.json', {}).gitBashPath;
  const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramW6432, path.join(process.env.LOCALAPPDATA || '', 'Programs')].filter(Boolean);
  const cands = [cfg];
  for (const base of pf) {
    cands.push(path.join(base, 'Git', 'bin', 'bash.exe'), path.join(base, 'Git', 'usr', 'bin', 'bash.exe'));
  }
  cands.push('C:\\Git\\bin\\bash.exe', path.join(os.homedir(), 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'));
  // derive from `git` on PATH: <git>\cmd\git.exe -> <git>\bin\bash.exe
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (fs.existsSync(path.join(dir, 'git.exe'))) {
      cands.push(path.join(dir, '..', 'bin', 'bash.exe'), path.join(dir, '..', '..', 'bin', 'bash.exe'));
    }
  }
  return cands.filter(Boolean).map((c) => path.resolve(c)).find((c) => fs.existsSync(c)) || null;
}

function detectShells() {
  const s = readJson('settings.json', {});
  const list = [];
  if (process.platform === 'win32') {
    const gb = findGitBash();
    if (gb) list.push({ id: 'gitbash', name: 'Git Bash', file: gb, args: ['--login', '-i'] });
    const ps = s.powershellPath || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (fs.existsSync(ps)) list.push({ id: 'powershell', name: 'PowerShell', file: ps, args: ['-NoLogo'] });
    const cmd = s.cmdPath || process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    if (fs.existsSync(cmd)) list.push({ id: 'cmd', name: 'CMD', file: cmd, args: [] });
  } else {
    const candidates = process.platform === 'darwin' ? ['zsh', 'bash'] : ['bash', 'zsh'];
    for (const n of candidates) {
      const f = ['/bin/' + n, '/usr/bin/' + n, '/usr/local/bin/' + n, '/opt/homebrew/bin/' + n].find((x) => fs.existsSync(x));
      if (f) list.push({ id: n, name: n, file: f, args: ['-l'] });
    }
  }
  return list;
}
ipcMain.handle('term:shells', () => detectShells());
ipcMain.handle('term:detectGitBash', () => findGitBash());

const terms = new Map(); let termSeq = 0;
ipcMain.handle('term:create', (_e, { shellId, cwd, cols = 80, rows = 24 }) => {
  const sh = detectShells().find((x) => x.id === shellId) || detectShells()[0];
  if (!sh) throw new Error('No shell found');
  const dir = cwd && sec.insideAnyRoot(cwd, [...roots]) ? cwd : (roots.size ? [...roots][0] : os.homedir());
  const id = ++termSeq;
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
  if (pty) {
    const p = pty.spawn(sh.file, sh.args, { name: 'xterm-256color', cols, rows, cwd: dir, env });
    p.onData((d) => send('term:data', id, d));
    p.onExit(({ exitCode }) => { terms.delete(id); send('term:exit', id, exitCode); });
    terms.set(id, { write: (d) => p.write(d), resize: (c, r) => p.resize(c, r), kill: () => p.kill() });
  } else {
    // Fallback without a PTY: line-oriented, no full-screen apps. Install node-pty for the real thing.
    const p = spawn(sh.file, sh.args, { cwd: dir, env, windowsHide: true });
    p.stdout.on('data', (d) => send('term:data', id, d.toString().replace(/\r?\n/g, '\r\n')));
    p.stderr.on('data', (d) => send('term:data', id, d.toString().replace(/\r?\n/g, '\r\n')));
    p.on('exit', (c) => { terms.delete(id); send('term:exit', id, c); });
    let line = '';
    terms.set(id, {
      write: (d) => { for (const ch of d) { if (ch === '\r') { send('term:data', id, '\r\n'); p.stdin.write(line + '\n'); line = ''; } else if (ch === '\x7f') { if (line) { line = line.slice(0, -1); send('term:data', id, '\b \b'); } } else { line += ch; send('term:data', id, ch); } } },
      resize() {}, kill: () => p.kill(),
    });
  }
  return { id, name: sh.name, pty: !!pty };
});
ipcMain.on('term:write', (_e, id, d) => terms.get(id)?.write(String(d)));
ipcMain.on('term:resize', (_e, id, c, r) => { try { terms.get(id)?.resize(c, r); } catch { /* ignore */ } });
ipcMain.on('term:kill', (_e, id) => { terms.get(id)?.kill(); terms.delete(id); });

// ---------------------------------------------------------------- git
let gitPath = 'git';
ipcMain.handle('git:run', (_e, cwd, args, opts = {}) => new Promise((resolve) => {
  try {
    sec.validateGitArgs(args);
    if (args[0] !== 'clone' && args[0] !== 'init') cwd = assertInRoot(cwd);
    else if (cwd) cwd = path.resolve(cwd);
  } catch (err) { return resolve({ code: -1, stdout: '', stderr: err.message }); }
  const s = readJson('settings.json', {});
  execFile(s.gitPath || gitPath, args, { cwd, maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: opts.timeout || 120000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true' } },
  (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr }));
}));
ipcMain.handle('git:clone', async (_e, url, parentDir) => {
  if (!/^(https:\/\/|git@|ssh:\/\/)/.test(url)) throw new Error('Only https:// and ssh URLs are supported');
  parentDir = path.resolve(parentDir);
  if (!sec.isAllowedRoot(parentDir)) throw new Error('Protected location');
  const name = path.basename(url.replace(/\.git$/, '').replace(/[\\/]+$/, '').split(':').pop());
  const target = path.join(parentDir, sec.validateName(name));
  return new Promise((resolve, reject) => {
    execFile(readJson('settings.json', {}).gitPath || gitPath, ['clone', '--', url, target], { timeout: 600000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (err, _o, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(registerRoot(target))));
  });
});
ipcMain.handle('git:detect', (_e, root) => fs.existsSync(path.join(assertInRoot(root), '.git')));

// ---------------------------------------------------------------- project detection
function detectProject(root) {
  const has = (f) => fs.existsSync(path.join(root, f));
  const pkg = has('package.json') ? readJson2(path.join(root, 'package.json')) : null;
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const out = { kinds: [], runs: [] };
  if (has('artisan') && has('composer.json')) { out.kinds.push('laravel'); out.runs.push({ name: 'Laravel Development', command: 'php artisan serve', url: 'http://127.0.0.1:8000' }); }
  if (has('manage.py')) { out.kinds.push('django'); out.runs.push({ name: 'Django Development', command: 'python manage.py runserver', url: 'http://127.0.0.1:8000' }); }
  if (pkg) {
    const kind = deps.vue ? 'vue' : deps.react ? 'react' : 'node';
    out.kinds.push(kind);
    const script = pkg.scripts?.dev ? 'dev' : pkg.scripts?.start ? 'start' : null;
    if (script) out.runs.push({ name: `${kind} (${script})`, command: `npm run ${script}`.replace('run start', 'start') });
  }
  if (!out.runs.length && (has('index.php') || has('public/index.php'))) { out.kinds.push('php'); out.runs.push({ name: 'PHP built-in server', command: 'php -S localhost:8000', url: 'http://localhost:8000' }); }
  if (!out.kinds.length && fs.readdirSync(root).some((f) => f.endsWith('.py'))) out.kinds.push('python');
  return out;
}
function readJson2(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
ipcMain.handle('project:detect', (_e, root) => detectProject(assertInRoot(root)));
ipcMain.handle('project:confirmDangerous', async (_e, command) => {
  if (!sec.isDangerousCommand(command)) return true;
  const { response } = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancel', 'Run anyway'], defaultId: 0, cancelId: 0, message: 'This command looks destructive.', detail: command });
  return response === 1;
});
ipcMain.handle('project:scaffold', async (_e, { kind, name, location }) => {
  // Returns the commands to run in the integrated terminal; the renderer shows them first.
  name = sec.validateName(name);
  const loc = path.resolve(location);
  if (!sec.isAllowedRoot(loc)) throw new Error('Protected location');
  fs.mkdirSync(loc, { recursive: true });
  const cmds = {
    laravel: [`composer create-project laravel/laravel "${name}"`],
    django: [`python -m venv "${name}/.venv"`, `"${name}/.venv/${process.platform === 'win32' ? 'Scripts' : 'bin'}/python" -m pip install django`, `"${name}/.venv/${process.platform === 'win32' ? 'Scripts' : 'bin'}/django-admin" startproject config "${name}"`],
    python: [`mkdir "${name}"`, `python -m venv "${name}/.venv"`],
    node: [`mkdir "${name}"`, `cd "${name}" && npm init -y`],
    vue: [`npm create vue@latest "${name}"`],
    react: [`npm create vite@latest "${name}" -- --template react`],
    php: [`mkdir "${name}"`],
    empty: [`mkdir "${name}"`],
  }[kind];
  if (!cmds) throw new Error('Unknown project kind');
  return { cwd: loc, commands: cmds, target: path.join(loc, name) };
});
ipcMain.handle('project:openRoot', (_e, p) => {            // after scaffold completes
  if (!fs.existsSync(p)) throw new Error('Folder not found');
  return registerRoot(p);
});

// ---------------------------------------------------------------- settings, credentials, API
const DEFAULT_SETTINGS = {
  fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: '400', lineHeight: 1.5, letterSpacing: 0, ligatures: true, smoothFonts: true,
  minimap: true, wordWrap: false, tabSize: 4, insertSpaces: true, autoSave: 'afterDelay', autoSaveDelay: 1000,
  theme: 'codeforge-dark', gitBashPath: '', powershellPath: '', cmdPath: '', gitPath: '', gitUser: '', gitDefaultBranch: 'main',
  defaultShell: '', autoUpdate: true, sidebar: true, statusBar: true, activityBar: true,
  // Extensions: https URLs to download, and local manifest files/folders. Both are declarative JSON only.
  extensions: [], customExtensions: [], disabledExtensions: [],
};
ipcMain.handle('settings:get', () => ({ ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) }));
ipcMain.handle('settings:set', (_e, patch) => {
  const clean = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in patch) clean[k] = patch[k];
  const cur = { ...DEFAULT_SETTINGS, ...readJson('settings.json', {}), ...clean };
  writeJson('settings.json', cur); return cur;
});

// ---------------------------------------------------------------- extensions
// Extensions are declarative JSON manifests (themes, snippets, file associations). They never run code,
// so installing one from a URL cannot execute anything on the machine.
//   { "id":"my-ext", "name":"My Ext", "version":"1.0.0", "description":"…",
//     "themes":[{"id":"x","name":"X","base":"vs-dark","ui":{"--bg":"#000"},"ed":{"editor.background":"#000"}}],
//     "snippets":{"php":[{"prefix":"dd","body":"dd($1);","description":"dump"}]},
//     "fileAssociations":{".tpl":"html"} }
const extDir = () => path.join(userData(), 'extensions');
const EXT_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
function cleanManifest(m, source) {
  if (!m || typeof m !== 'object' || !EXT_ID.test(String(m.id))) throw new Error('Invalid extension: "id" must be lowercase letters, digits, . _ -');
  const out = { id: m.id, name: String(m.name || m.id).slice(0, 80), version: String(m.version || '0.0.0').slice(0, 20), description: String(m.description || '').slice(0, 300), source };
  out.themes = (Array.isArray(m.themes) ? m.themes : []).filter((t) => t && EXT_ID.test(String(t.id))).map((t) => ({ id: `${m.id}.${t.id}`, name: String(t.name || t.id), base: ['vs', 'vs-dark', 'hc-black'].includes(t.base) ? t.base : 'vs-dark', ui: Object.fromEntries(Object.entries(t.ui || {}).filter(([k, v]) => /^--[a-z0-9-]+$/.test(k) && /^#[0-9a-f]{3,8}$/i.test(String(v)))), ed: Object.fromEntries(Object.entries(t.ed || {}).filter(([k, v]) => /^[\w.]+$/.test(k) && /^#[0-9a-f]{3,8}$/i.test(String(v)))) }));
  out.snippets = {};
  for (const [lang, list] of Object.entries(m.snippets || {})) if (/^[\w-]+$/.test(lang) && Array.isArray(list)) out.snippets[lang] = list.slice(0, 500).filter((s) => s && s.prefix && s.body).map((s) => ({ prefix: String(s.prefix), body: Array.isArray(s.body) ? s.body.join('\n') : String(s.body), description: String(s.description || '') }));
  out.fileAssociations = Object.fromEntries(Object.entries(m.fileAssociations || {}).filter(([k, v]) => /^\.[\w.-]+$/.test(k) && /^[\w-]+$/.test(String(v))));
  return out;
}
async function installFromUrl(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('Extensions must be downloaded over https://');
  const res = await fetch(u, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const txt = await res.text();
  if (txt.length > 1024 * 1024) throw new Error('Extension too large (>1 MB)');
  const m = cleanManifest(JSON.parse(txt), url);
  fs.mkdirSync(extDir(), { recursive: true });
  fs.writeFileSync(path.join(extDir(), m.id + '.json'), JSON.stringify(m, null, 2));
  return m;
}
function readLocalManifests() {
  const s = readJson('settings.json', {}); const out = [];
  for (const entry of s.customExtensions || []) {
    try {
      let p = path.resolve(String(entry)); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'extension.json');
      out.push(cleanManifest(JSON.parse(fs.readFileSync(p, 'utf8')), 'custom:' + p));
    } catch (e) { out.push({ id: 'invalid-' + out.length, name: String(entry), error: e.message, source: 'custom', themes: [], snippets: {}, fileAssociations: {} }); }
  }
  return out;
}
function listExtensions() {
  const dis = new Set(readJson('settings.json', {}).disabledExtensions || []);
  let installed = [];
  try { installed = fs.readdirSync(extDir()).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join('extensions', f), null)).filter(Boolean); } catch { /* none */ }
  return [...installed, ...readLocalManifests()].map((m) => ({ ...m, enabled: !dis.has(m.id) }));
}
const catalogDir = path.join(__dirname, 'catalog');
ipcMain.handle('ext:catalog', () => fs.readdirSync(catalogDir).filter((f) => f.endsWith('.json')).map((f) => cleanManifest(JSON.parse(fs.readFileSync(path.join(catalogDir, f), 'utf8')), 'bundled')));
ipcMain.handle('ext:installBundled', (_e, id) => {
  if (!EXT_ID.test(String(id))) throw new Error('Bad id');
  const f = path.join(catalogDir, id + '.json'); if (!fs.existsSync(f)) throw new Error('Unknown extension');
  const m = cleanManifest(JSON.parse(fs.readFileSync(f, 'utf8')), 'bundled');
  fs.mkdirSync(extDir(), { recursive: true }); fs.writeFileSync(path.join(extDir(), m.id + '.json'), JSON.stringify(m, null, 2)); return m;
});
ipcMain.handle('ext:list', () => listExtensions());
ipcMain.handle('ext:install', async (_e, url) => installFromUrl(String(url)));
ipcMain.handle('ext:uninstall', (_e, id) => { if (!EXT_ID.test(String(id))) throw new Error('Bad id'); try { fs.unlinkSync(path.join(extDir(), id + '.json')); } catch { /* not installed */ } return true; });
ipcMain.handle('ext:sync', async () => {          // download everything listed under "extensions" in settings.json
  const s = readJson('settings.json', {}); const errors = [];
  for (const url of s.extensions || []) { try { await installFromUrl(String(url)); } catch (e) { errors.push(`${url}: ${e.message}`); } }
  return { errors, list: listExtensions() };
});
ipcMain.handle('settings:file', () => { const p = storeFile('settings.json'); if (!fs.existsSync(p)) writeJson('settings.json', { ...DEFAULT_SETTINGS }); return p; });

function getToken() {
  try {
    const raw = fs.readFileSync(storeFile('token.bin'));
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : null;   // never fall back to plaintext
  } catch { return null; }
}
function setToken(t) {
  if (!t) { try { fs.unlinkSync(storeFile('token.bin')); } catch { /* none */ } return; }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential storage unavailable; not saving login.');
  fs.mkdirSync(userData(), { recursive: true });
  fs.writeFileSync(storeFile('token.bin'), safeStorage.encryptString(t), { mode: 0o600 });
}
async function api(method, p, body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken(); if (t) headers.Authorization = `Token ${t}`;
  const res = await fetch(API_BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text(); let data; try { data = JSON.parse(txt); } catch { data = txt; }
  if (!res.ok) throw new Error((data && data.detail) || `API ${res.status}`);
  return data;
}
ipcMain.handle('api:login', async (_e, username, password) => { const r = await api('POST', '/auth/login/', { username, password }); setToken(r.token); return true; });
ipcMain.handle('api:logout', async () => { try { await api('POST', '/auth/logout/'); } catch { /* offline */ } setToken(null); return true; });
ipcMain.handle('api:loggedIn', () => !!getToken());
// Only fixed, whitelisted API paths; sync of settings is opt-in and contains no source code.
const API_ALLOW = [/^\/profile\/$/, /^\/settings\/$/, /^\/workspaces\/$/, /^\/projects\/$/, /^\/extensions\/$/, /^\/releases\/$/];
ipcMain.handle('api:request', (_e, method, p, body) => {
  if (!API_ALLOW.some((r) => r.test(p)) || !['GET', 'PUT', 'POST'].includes(method)) throw new Error('API path not allowed');
  return api(method, p, body);
});
ipcMain.handle('app:checkUpdates', async () => {
  const r = await api('GET', `/releases/latest/?current=${app.getVersion()}`);
  return r;
});
ipcMain.handle('app:openExternal', (_e, url) => openExternal(url));
ipcMain.handle('app:platform', () => ({ platform: process.platform, arch: process.arch, version: app.getVersion(), pty: !!pty }));

// ---------------------------------------------------------------- lifecycle
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', (_e, argv) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    openArgvPath(argv);
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    createWindow();
    win.webContents.once('did-finish-load', () => openArgvPath(process.argv));
  });
  app.on('window-all-closed', () => { terms.forEach((t) => t.kill()); app.quit(); });
}
function openArgvPath(argv) {
  // "Open with CodeForge": the user explicitly chose this path in the OS shell.
  const p = argv.slice(app.isPackaged ? 1 : 2).find((a) => !a.startsWith('-') && fs.existsSync(a));
  if (!p) return;
  try {
    const st = fs.statSync(p);
    const root = registerRoot(st.isDirectory() ? p : path.dirname(p));
    send('open-path', { root, file: st.isFile() ? path.resolve(p) : null });
  } catch (e) { /* protected folder */ }
}
