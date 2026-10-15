// Asta main process: the secure local bridge.
// Everything local (fs, terminal, git, processes) lives here and is reachable ONLY through
// contextBridge -> ipcMain from our own window. No local HTTP/WebSocket server is kept open; the only listener is the
// short-lived 127.0.0.1 redirect receiver used during "Sign in with Google" (random port, one request, closed right after).
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage, session, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const sec = require('./security');
const ga = require('./google-auth');

let pty = null;
try { pty = require('node-pty'); } catch { /* falls back to piped child_process */ }

const API_BASE = process.env.CODEFORGE_API || (app.isPackaged ? 'https://astaide.vercel.app/api' : 'http://127.0.0.1:8000/api');
const userData = () => app.getPath('userData');
const storeFile = (n) => path.join(userData(), n);

// Asta was called FastForge and, before that, CodeCambo (the data folder is named after the product). On the first run copy the
// user's data across once from the newest old folder: settings, shortcuts, recent projects, workspaces, sign-in token, extensions
// and the saved session/layout.
(function migrateFromOldName() {
  try {
    const to = userData();
    const from = ['FastForge', 'CodeCambo'].map((n) => path.join(app.getPath('appData'), n)).find((d) => path.resolve(d) !== path.resolve(to) && fs.existsSync(path.join(d, 'settings.json')));
    if (!from || fs.existsSync(path.join(to, 'settings.json'))) return;
    fs.mkdirSync(to, { recursive: true });
    for (const n of ['settings.json', 'keyboard.json', 'recents.json', 'workspaces.json', 'token.bin', 'Local State', 'extensions', 'Local Storage']) {
      const s = path.join(from, n), d = path.join(to, n);
      if (fs.existsSync(s) && !fs.existsSync(d)) fs.cpSync(s, d, { recursive: true });
    }
  } catch { /* starting fresh is fine */ }
})();

function readJson(name, def) { try { return JSON.parse(fs.readFileSync(storeFile(name), 'utf8')); } catch { return def; } }
function writeJson(name, v) { fs.mkdirSync(userData(), { recursive: true }); fs.writeFileSync(storeFile(name), JSON.stringify(v, null, 2)); }

const roots = new Set();      // workspace roots the user opened via dialog / recents
const wins = new Set();       // every open Asta window (each one hosts one project)

// ---------------------------------------------------------------- window
// "Hide Layout Header": hides the in-app header (renderer) and the native menu bar. The menu stays reachable with Alt (auto-hide) on Windows/Linux.
function applyHeaderSetting(win) {
  if (!win || win.isDestroyed() || process.platform === 'darwin') return;       // macOS keeps its global menu bar
  const hide = !!({ ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) }).hideHeader;
  win.setAutoHideMenuBar(hide); win.setMenuBarVisibility(!hide);
}
function createWindow(query = {}) {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#0b1020', title: 'Asta IDE',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (process.env.CODEFORGE_DEBUG) win.webContents.on('console-message', (_e, level, msg, line, src) => { if (level >= 2) console.log(`[renderer:${level}] ${msg} (${path.basename(src)}:${line})`); });
  wins.add(win); currentWin = win; if (process.env.CODEFORGE_DEBUG) console.log('[windows]', wins.size, JSON.stringify(query));
  win.on('focus', () => { currentWin = win; });
  win.on('closed', () => { wins.delete(win); if (currentWin === win) currentWin = [...wins].pop() || null; });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query });
  if (process.env.CODEFORGE_E2E) win.webContents.once('did-finish-load', () => setTimeout(async () => {
    try {
      const dir = process.env.CODEFORGE_E2E_ROOT; if (dir) registerRoot(dir);
      const out = await win.webContents.executeJavaScript(fs.readFileSync(process.env.CODEFORGE_E2E, 'utf8'));
      if (process.env.CODEFORGE_SHOT) { win.show(); win.focus(); await new Promise((r) => setTimeout(r, 2000)); fs.writeFileSync(process.env.CODEFORGE_SHOT, (await win.webContents.capturePage()).toPNG()); }
      console.log('[e2e]', typeof out === 'string' ? out : JSON.stringify(out, null, 1));
    } catch (e) { console.log('[e2e-error]', e.message); }
    app.quit();
  }, 5000));
  if (process.env.CODEFORGE_DEBUG) setTimeout(() => win.webContents.executeJavaScript(
    `JSON.stringify({root:CF.S.root,tabs:[...CF.S.models.keys()],monaco:!!window.monaco,groups:document.querySelectorAll('.group').length,welcome:!document.getElementById('welcome').hidden,shells:CF.S.shells.map(s=>s.name),font:getComputedStyle(document.body).fontFamily})`
  ).then((r) => console.log('[selftest]', r)).catch((e) => console.log('[selftest-error]', e.message)), 8000);
  let forceClose = false;
  // Closing asks the renderer (unsaved-files prompt) unless the app is already quitting (installer/OS shutdown/app.quit) or the renderer is gone.
  win.on('close', (e) => { if (!forceClose && !quitting && !win.webContents.isCrashed()) { e.preventDefault(); win.webContents.send('ask-close'); } });
  win.on('session-end', () => shutdown('session-end'));
  forceCloses.set(win.webContents.id, () => { forceClose = true; win.close(); });
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
  ensureKeyFile();
  if (!Menu.getApplicationMenu()) buildMenu();
  applyHeaderSetting(win);
  return win;
}
const forceCloses = new Map();
// System clipboard through the main process: the renderer's navigator.clipboard.readText() is blocked by the permission handler below.
ipcMain.handle('clip:read', () => clipboard.readText());
ipcMain.handle('clip:write', (_e, t) => { clipboard.writeText(String(t == null ? '' : t).slice(0, 5 * 1024 * 1024)); return true; });
ipcMain.handle('app:forceClose', (e) => forceCloses.get(e.sender.id)?.());
let currentWin = null;
function send(ch, ...a) { const w = BrowserWindow.getFocusedWindow() || currentWin; if (w && !w.isDestroyed()) w.webContents.send(ch, ...a); }
const sendTo = (wc, ch, ...a) => { try { if (!wc.isDestroyed()) wc.send(ch, ...a); } catch { /* window closed */ } };

// New window: empty (welcome screen) or on a project the user already opened/registered. Never restores the last session.
function openProjectWindow(root) {
  const w = createWindow(root ? { root } : { fresh: '1' });
  return w;
}
ipcMain.handle('win:new', (_e, p) => {
  if (p == null) { openProjectWindow(null); return true; }
  const r = path.resolve(String(p));
  if (!roots.has(r) && !readJson('recents.json', []).some((x) => x.path === r)) throw new Error('Not a known project');
  openProjectWindow(registerRoot(r)); return true;
});
ipcMain.handle('win:newPick', async () => {                // pick a folder and open it in its own window
  const r = await dialog.showOpenDialog(currentWin, { properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled) return false;
  openProjectWindow(registerRoot(r.filePaths[0])); return true;
});

// ---------------------------------------------------------------- keyboard shortcuts
// Defaults live here; the user overrides them in <userData>/keyboard.json ({ "command-id": "ctrl+shift+b", "other": "" }).
// "mod" = Cmd on macOS, Ctrl elsewhere; a space separates the two parts of a chord ("mod+k mod+s").
// The renderer (keybindings.js) dispatches every shortcut; menu accelerators are only shown, never registered.
const DEFAULT_KEYS = {
  'open-folder': 'mod+o', 'new-window': 'mod+shift+n', 'new-file': 'mod+n', 'quick-open': 'mod+p', save: 'mod+s', 'close-tab': 'mod+w', 'next-tab': 'ctrl+tab', 'prev-tab': 'ctrl+shift+tab', split: 'mod+\\', 'save-all': 'mod+alt+s',
  search: 'mod+shift+f', palette: 'mod+shift+p', 'toggle-sidebar': 'mod+b', 'toggle-header': 'mod+alt+h', 'toggle-terminal': 'mod+`', 'view-explorer': 'mod+shift+e', 'view-git': 'ctrl+shift+g', 'view-extensions': 'mod+shift+x', 'view-gitlens': 'alt+g', 'view-run': 'mod+shift+d',
  'font-inc': 'mod+=', 'font-dec': 'mod+-', 'font-reset': 'mod+0', 'goto-line': 'mod+g', 'goto-def': 'f12', run: 'f5', stop: 'shift+f5', restart: 'mod+shift+f5', settings: 'mod+,',
  'new-terminal': 'ctrl+shift+`', 'split-terminal': 'mod+shift+5', 'term-split-down': 'mod+shift+6', 'term-close-pane': 'mod+shift+w', 'clear-terminal': 'mod+shift+k', 'term-font-inc': 'mod+=', 'term-font-dec': 'mod+-', 'term-font-reset': 'mod+0',
  'toggle-panel': 'mod+j', 'show-problems': 'mod+shift+m', 'show-debug': 'mod+shift+y', 'find-project': 'mod+r', 'toggle-preview': 'mod+shift+v',
  'search-replace': 'mod+shift+h', 'search-toggle-details': 'mod+shift+j', 'search-toggle-case': 'alt+c', 'search-toggle-word': 'alt+w', 'search-toggle-regex': 'alt+r',
  'keyboard-shortcuts': 'mod+k mod+s', 'color-theme': 'mod+k mod+t', 'blame-line': 'alt+b', 'blame-file': 'alt+shift+b', 'file-history': 'alt+h', 'line-history': 'alt+shift+h',
};
const keyFile = () => storeFile('keyboard.json');
const KEY_ID = /^[\w.:-]{1,64}$/, KEY_SEQ = /^[a-z0-9+=,.\\\/`\[\]';\- ]{0,60}$/;
function cleanKeys(o) {
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) if (KEY_ID.test(k) && (v === null || (typeof v === 'string' && KEY_SEQ.test(v.trim().toLowerCase())))) out[k] = v === null ? '' : v.trim().toLowerCase();
  return out;
}
// Group and title of every command, in the order they are listed in keyboard.json (commands without a default key are listed too).
const KEY_META = {
  palette: ['General', 'Command Palette'], 'quick-open': ['General', 'Go to File'], 'find-project': ['General', 'Find Project'], settings: ['General', 'Open Settings'], 'keyboard-shortcuts': ['General', 'Open Keyboard Shortcuts'], 'color-theme': ['General', 'Color Theme'], 'toggle-preview': ['General', 'Toggle File Preview'],
  'open-folder': ['File', 'Open Folder'], 'new-window': ['File', 'New Window'], 'open-folder-new-window': ['File', 'Open Folder in New Window'], 'new-file': ['File', 'New File'], save: ['File', 'Save'], 'save-all': ['File', 'Save All'],
  'close-tab': ['Editor', 'Close Editor'], 'next-tab': ['Editor', 'Next Editor'], 'prev-tab': ['Editor', 'Previous Editor'], split: ['Editor', 'Split Editor Right'], 'goto-line': ['Editor', 'Go to Line'], 'goto-def': ['Editor', 'Go to Definition'],
  'view-explorer': ['View', 'Show Explorer'], search: ['View', 'Find in Files'], 'search-replace': ['View', 'Replace in Files'], 'search-toggle-details': ['View', 'Search: Toggle Search Details'], 'search-toggle-case': ['View', 'Search: Match Case (search focused)'], 'search-toggle-word': ['View', 'Search: Match Whole Word (search focused)'], 'search-toggle-regex': ['View', 'Search: Use Regular Expression (search focused)'], 'search-new-editor': ['View', 'Search: Open New Search Editor'], 'view-git': ['View', 'Show Source Control'], 'view-gitlens': ['View', 'Show GitLens'], 'view-run': ['View', 'Show Run and Debug'], 'view-extensions': ['View', 'Show Extensions'],
  'toggle-sidebar': ['View', 'Toggle Sidebar'], 'toggle-header': ['View', 'Toggle Layout Header'], 'toggle-panel': ['View', 'Toggle Panel'], 'toggle-terminal': ['View', 'Toggle Terminal'], 'show-problems': ['View', 'Show Problems'], 'show-debug': ['View', 'Show Debug Console'],
  'font-inc': ['View', 'Increase Editor Font Size'], 'font-dec': ['View', 'Decrease Editor Font Size'], 'font-reset': ['View', 'Reset Editor Font Size'],
  'new-terminal': ['Terminal', 'New Terminal'], 'split-terminal': ['Terminal', 'Split Terminal Right'], 'term-split-down': ['Terminal', 'Split Terminal Down'], 'term-close-pane': ['Terminal', 'Close Terminal Pane (terminal focused)'], 'clear-terminal': ['Terminal', 'Clear Terminal (terminal focused)'],
  'term-font-inc': ['Terminal', 'Increase Terminal Font Size (terminal focused)'], 'term-font-dec': ['Terminal', 'Decrease Terminal Font Size (terminal focused)'], 'term-font-reset': ['Terminal', 'Reset Terminal Font Size (terminal focused)'],
  run: ['Run', 'Run Project'], stop: ['Run', 'Stop'], restart: ['Run', 'Restart'],
  'blame-line': ['GitLens', 'Toggle Line Blame'], 'blame-file': ['GitLens', 'Toggle File Blame'], 'file-history': ['GitLens', 'File History'], 'line-history': ['GitLens', 'Line History'],
};
const KEYS_MARK = '// ---- Default shortcuts';
function readKeys() {                    // { map, error } — a broken file never disables shortcuts, it just reports the problem
  try { return { map: cleanKeys(JSON.parse(fs.readFileSync(keyFile(), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*})/g, '$1').replace(/"(\s*\n\s*)"/g, '",$1"'))) }; }   // forgiving: full-line // comments, a trailing comma, and a missing comma between lines
  catch (e) { return e.code === 'ENOENT' ? { map: {} } : { map: {}, error: e.message }; }
}
// keyboard.json = the user's overrides as real lines, plus every default as a commented-out line to uncomment and edit.
function writeKeys(map) {
  fs.mkdirSync(userData(), { recursive: true });
  const groups = [];
  for (const [id, [g, title]] of Object.entries(KEY_META)) { let e = groups.find((x) => x[0] === g); if (!e) groups.push((e = [g, []])); e[1].push([id, title]); }
  const lines = [];
  for (const [g, cmds] of groups) {
    lines.push({ t: `  ${KEYS_MARK}: ${g} ----` });
    for (const [id, title] of cmds) {
      if (id in map) lines.push({ t: `  ${JSON.stringify(id)}: ${JSON.stringify(map[id])}`, real: true });
      else lines.push({ t: `  // ${JSON.stringify(id)}: ${JSON.stringify(DEFAULT_KEYS[id] || '')},` });
    }
  }
  for (const id of Object.keys(map)) if (!(id in KEY_META)) lines.push({ t: `  ${JSON.stringify(id)}: ${JSON.stringify(map[id])}`, real: true });
  const last = lines.map((l) => !!l.real).lastIndexOf(true);
  const body = lines.map((l, i) => l.t + (l.real && i !== last ? ',' : '')).join('\n');
  const header = [
    '// Asta keyboard shortcuts (keyboard.json).',
    '// Add a line like  "toggle-sidebar": "mod+shift+b"  to change a shortcut, or "" to remove it. Changes apply when you save.',
    '// Every default is listed below as a commented line: remove the leading // and edit the keys to override it.',
    '// "mod" is Cmd on macOS and Ctrl elsewhere. A space makes a chord, for example "mod+k mod+s". Keys: ctrl alt shift cmd + a key.',
    '// You can also change shortcuts from Preferences > Keyboard Shortcuts (Ctrl+K Ctrl+S).', '',
  ].join('\n');
  fs.writeFileSync(keyFile(), header + '{\n' + body + '\n}\n');
}
// make sure the file exists and uses the current layout (older versions only wrote a header and the overrides)
function ensureKeyFile() {
  try {
    if (!fs.existsSync(keyFile())) return writeKeys({});
    const r = readKeys(); if (r.error) return;                      // never overwrite a file the user broke
    if (!fs.readFileSync(keyFile(), 'utf8').includes(KEYS_MARK)) writeKeys(r.map);
  } catch { /* the shortcuts keep working from the built-in defaults */ }
}
// shortcut text for the menu ("mod+shift+p" -> "CmdOrCtrl+Shift+P"); chords and unknown keys have no menu label
function toAccel(seq) {
  if (!seq || /\s/.test(seq)) return undefined;
  const names = { mod: 'CmdOrCtrl', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', cmd: 'Cmd', tab: 'Tab', left: 'Left', right: 'Right', up: 'Up', down: 'Down', pageup: 'PageUp', pagedown: 'PageDown', home: 'Home', end: 'End', enter: 'Enter', space: 'Space', escape: 'Escape', backspace: 'Backspace', delete: 'Delete', insert: 'Insert' };
  const parts = seq.split('+'); if (seq.endsWith('++')) return undefined;
  const out = parts.map((p) => names[p] || (/^f\d{1,2}$/.test(p) ? p.toUpperCase() : p.length === 1 ? p.toUpperCase() : null));
  return out.includes(null) ? undefined : out.join('+');
}

function buildMenu() {
  const user = readKeys().map;
  const cmd = (label, id) => { const k = id in user ? user[id] : DEFAULT_KEYS[id]; return { label, id: 'cf-' + id, accelerator: toAccel(k), registerAccelerator: false, click: () => send('menu', id) }; };
  const mac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [cmd('New Window', 'new-window'), cmd('Open Folder…', 'open-folder'), cmd('Open Folder in New Window…', 'open-folder-new-window'), cmd('New File', 'new-file'), cmd('New Folder', 'new-folder'),
      cmd('Quick Open…', 'quick-open'), cmd('Save', 'save'), cmd('Close Editor', 'close-tab'), cmd('Next Editor', 'next-tab'), cmd('Previous Editor', 'prev-tab'), cmd('Split Editor', 'split'), cmd('Save All', 'save-all'), { type: 'separator' }, cmd('Save Workspace', 'save-workspace'), cmd('Open Workspace', 'open-workspace'), cmd('Close Workspace', 'close-workspace'), { type: 'separator' }, mac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' }, cmd('Find in Files', 'search')] },
    { label: 'Selection', submenu: [cmd('Select All', 'select-all')] },
    { label: 'View', submenu: [cmd('Command Palette…', 'palette'), cmd('Toggle Sidebar', 'toggle-sidebar'), cmd('Toggle Terminal', 'toggle-terminal'), cmd('Explorer', 'view-explorer'), cmd('Source Control', 'view-git'), cmd('GitLens', 'view-gitlens'), cmd('Extensions', 'view-extensions'),
      { label: 'Hide Layout Header', type: 'checkbox', checked: !!({ ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) }).hideHeader, click: () => send('menu', 'toggle-header') },
      { label: 'Tab Bar: Close Saved / Close All Buttons', type: 'checkbox', checked: ({ ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) }).tabActions !== false, click: () => send('menu', 'toggle-tab-actions') },
      { type: 'separator' }, cmd('Increase Font Size', 'font-inc'), cmd('Decrease Font Size', 'font-dec'), cmd('Reset Font Size', 'font-reset'), { type: 'separator' }, { role: 'toggleDevTools' }, { role: 'togglefullscreen' }] },
    { label: 'Go', submenu: [cmd('Go to Line…', 'goto-line'), cmd('Go to Definition', 'goto-def')] },
    { label: 'Run', submenu: [cmd('Run Project', 'run'), cmd('Stop', 'stop'), cmd('Restart', 'restart')] },
    { label: 'Terminal', submenu: [cmd('New Terminal', 'new-terminal'), cmd('Split Terminal', 'split-terminal'), cmd('Split Terminal Down', 'term-split-down'), cmd('Clear Terminal', 'clear-terminal'), cmd('New Git Bash', 'new-gitbash')] },
    { label: 'Git', submenu: [cmd('Clone Repository…', 'git-clone'), cmd('Initialize Repository', 'git-init'), cmd('Commit', 'git-commit'), cmd('Push', 'git-push'), cmd('Pull', 'git-pull'), cmd('Fetch', 'git-fetch')] },
    { label: 'Help', submenu: [cmd('Keyboard Shortcuts', 'keyboard-shortcuts'), cmd('Settings', 'settings'), cmd('Check for Updates…', 'check-updates')] },
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
  if (path.resolve(p) === path.resolve(storeFile('settings.json')) || path.resolve(p) === path.resolve(keyFile())) return path.resolve(p);   // the two config files editable in-app
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
  const r = await dialog.showOpenDialog(currentWin, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : registerRoot(r.filePaths[0]);
});
ipcMain.handle('ws:recents', () => readJson('recents.json', []).filter((r) => fs.existsSync(r.path)));
ipcMain.handle('ws:openRecent', (_e, p) => {
  const known = readJson('recents.json', []).some((r) => r.path === path.resolve(p));
  if (!known) throw new Error('Not a known recent project');
  return registerRoot(p);
});
ipcMain.handle('ws:pickDir', async () => {           // for "Location" fields in wizards / clone
  const r = await dialog.showOpenDialog(currentWin, { properties: ['openDirectory', 'createDirectory'] });
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
  const { response } = await dialog.showMessageBox(currentWin, {
    type: 'warning', buttons: ['Move to Trash', 'Cancel'], defaultId: 1, cancelId: 1,
    message: `Delete "${path.basename(p)}"?`, detail: p,
  });
  if (response !== 0) return false;
  await shell.trashItem(p);   // recoverable; never permanent rm
  return true;
});
ipcMain.handle('fs:reveal', (_e, p) => { shell.showItemInFolder(assertInRoot(p)); });
ipcMain.handle('fs:exists', (_e, p) => fs.existsSync(assertInRoot(p)));

// project-wide text search (bounded, skips heavy dirs). opts: case, word, regex, include, exclude ("a, b" glob lists, relative to the folder).
function searchRegex(query, opts) {
  let src = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (opts.word) src = `\\b(?:${src})\\b`;
  try { return new RegExp(src, opts.case ? 'g' : 'gi'); } catch { throw new Error('Invalid regular expression'); }
}
function globList(list) {
  const pats = String(list || '').split(',').map((x) => x.trim().replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '')).filter(Boolean).slice(0, 50);
  const tests = pats.map((p) => {
    const esc = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0000').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
      .replace(/\u0000/g, '(?:.*/)?').replace(/\u0001/g, '.*');
    const re = new RegExp('^' + esc + '(?:/.*)?$', 'i');
    return p.includes('/') ? (rel) => re.test(rel) : (rel) => rel.split('/').some((seg) => re.test(seg));   // "*.js" / "node_modules" match any path segment
  });
  return tests.length ? (rel) => tests.some((t) => t(rel)) : null;
}
ipcMain.handle('fs:search', async (_e, root, query, opts = {}) => {
  root = assertInRoot(root);
  if (!query) return [];
  const re = searchRegex(query, opts), inc = globList(opts.include), exc = globList(opts.exclude);
  const results = []; const MAX = 2000;
  async function walk(dir) {
    if (results.length >= MAX) return;
    let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const d of ents) {
      if (results.length >= MAX) return;
      const full = path.join(dir, d.name), rel = path.relative(root, full).split(path.sep).join('/');
      if (exc && exc(rel)) continue;
      if (d.isDirectory()) { if (!IGNORE_SEARCH.has(d.name) && !d.isSymbolicLink()) await walk(full); continue; }
      if (!d.isFile() || (inc && !inc(rel))) continue;
      let st; try { st = await fsp.stat(full); } catch { continue; }
      if (st.size > 2 * 1024 * 1024) continue;
      let buf; try { buf = await fsp.readFile(full); } catch { continue; }
      if (buf.subarray(0, 4000).includes(0)) continue;
      const lines = buf.toString('utf8').split(/\r?\n/);
      for (let i = 0; i < lines.length && results.length < MAX; i++) {
        re.lastIndex = 0; let m, n = 0;
        while ((m = re.exec(lines[i])) && n++ < 20 && results.length < MAX) {
          if (m[0] === '') { re.lastIndex++; continue; }
          results.push({ path: full, rel, line: i + 1, col: m.index + 1, len: m[0].length, text: lines[i].slice(0, 300) });
        }
      }
    }
  }
  await walk(root);
  return results;
});
ipcMain.handle('fs:replaceInFile', async (_e, p, query, repl, opts = {}) => {
  p = assertInRoot(p);
  const re = searchRegex(query, opts), sub = opts.regex ? String(repl) : () => String(repl);   // plain mode: "$1" is literal text
  const text = await fsp.readFile(p, 'utf8');
  let out;
  if (opts.line > 0) {                                                                         // replace only the matches on one line
    const eol = text.includes('\r\n') ? '\r\n' : '\n', lines = text.split(/\r?\n/);
    if (lines[opts.line - 1] !== undefined) lines[opts.line - 1] = lines[opts.line - 1].replace(re, sub);
    out = lines.join(eol);
  } else out = text.replace(re, sub);
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
const watchers = new Map();   // webContents id -> { watcher, timer }
ipcMain.handle('fs:watch', (e, root) => {
  root = assertInRoot(root);
  const wc = e.sender, st = watchers.get(wc.id) || {}; watchers.set(wc.id, st);
  if (st.watcher) { st.watcher.close(); st.watcher = null; }
  wc.once('destroyed', () => { try { st.watcher && st.watcher.close(); } catch { /* gone */ } watchers.delete(wc.id); });
  const ping = () => { clearTimeout(st.timer); st.timer = setTimeout(() => sendTo(wc, 'fs:changed'), 400); };
  try {
    st.watcher = fs.watch(root, { recursive: true }, (_ev, name) => {
      if (!name) return;
      const parts = String(name).split(/[\\/]/);
      if (parts[0] === '.git') {      // commits/pushes/fetches done in a terminal move HEAD or refs: refresh source control
        if (parts[1] === 'HEAD' || parts[1] === 'ORIG_HEAD' || parts[1] === 'MERGE_HEAD' || parts[1] === 'refs') ping();
        return;
      }
      if (parts.some((p) => IGNORE_SEARCH.has(p))) return;
      ping();
    });
    st.watcher.on('error', () => {});
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
ipcMain.handle('term:create', (e, { shellId, cwd, cols = 80, rows = 24 }) => {
  const sh = detectShells().find((x) => x.id === shellId) || detectShells()[0];
  if (!sh) throw new Error('No shell found');
  const dir = cwd && sec.insideAnyRoot(cwd, [...roots]) ? cwd : (roots.size ? [...roots][0] : os.homedir());
  const id = ++termSeq, wc = e.sender, send = (...a) => sendTo(wc, ...a);
  wc.once('destroyed', () => { terms.get(id)?.kill(); terms.delete(id); });   // window closed: its shells go with it
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
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true', GIT_OPTIONAL_LOCKS: '0' } },
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
  const { response } = await dialog.showMessageBox(currentWin, { type: 'warning', buttons: ['Cancel', 'Run anyway'], defaultId: 0, cancelId: 0, message: 'This command looks destructive.', detail: command });
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
  gitlensSeeded: false,
  fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: '400', lineHeight: 1.5, letterSpacing: 0, ligatures: true, smoothFonts: true,
  termFontFamily: '', termFontSize: 13, termLineHeight: 1.4, termCursorStyle: 'block', termCursorBlink: true,
  minimap: true, wordWrap: false, tabSize: 4, insertSpaces: true, autoSave: 'afterDelay', autoSaveDelay: 1000,
  theme: 'monokai-dimmed', iconTheme: 'symbols', gitBashPath: '', powershellPath: '', cmdPath: '', gitPath: '', gitUser: '', gitDefaultBranch: 'main',
  defaultShell: '', autoUpdate: true, sidebar: true, statusBar: true, activityBar: true, hideHeader: false, tabActions: true, autoSync: true,
  trimWhitespace: false, finalNewline: false, bracketColors: true, stickyScroll: true,
  tokenColors: {}, // syntax colour overrides: { comment: '#rrggbb', class: ..., ... }
  // Extensions: https URLs to download, and local manifest files/folders. Both are declarative JSON only.
  extensions: [], customExtensions: [], disabledExtensions: [], dismissedSuggestions: [], suggestExtensions: true,
};
ipcMain.handle('settings:get', () => {
  const saved = readJson('settings.json', {});
  // One-time: sticky scroll became default-on; older settings files still carry the old `false`.
  if (!saved.stickyScrollMigrated && Object.keys(saved).length) { saved.stickyScroll = true; saved.stickyScrollMigrated = true; writeJson('settings.json', { ...DEFAULT_SETTINGS, ...saved }); }
  return { ...DEFAULT_SETTINGS, ...saved };
});
ipcMain.handle('settings:set', (_e, patch) => {
  const clean = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in patch) clean[k] = patch[k];
  const cur = { ...DEFAULT_SETTINGS, ...readJson('settings.json', {}), ...clean };
  writeJson('settings.json', cur); buildMenu(); if ('hideHeader' in clean) wins.forEach((w) => { applyHeaderSetting(w); sendTo(w.webContents, 'header-hidden', !!cur.hideHeader); }); scheduleSyncPush(); return cur;
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
  const out = { id: m.id, name: String(m.name || m.id).slice(0, 80), version: String(m.version || '0.0.0').slice(0, 20), description: String(m.description || '').slice(0, 300), source,
    icon: String(m.icon || '').slice(0, 4), color: /^#[0-9a-f]{6}$/i.test(String(m.color)) ? m.color : '#8b5cf6' };
  out.themes = (Array.isArray(m.themes) ? m.themes : []).filter((t) => t && EXT_ID.test(String(t.id))).map((t) => ({ id: `${m.id}.${t.id}`, name: String(t.name || t.id), base: ['vs', 'vs-dark', 'hc-black'].includes(t.base) ? t.base : 'vs-dark', ui: Object.fromEntries(Object.entries(t.ui || {}).filter(([k, v]) => /^--[a-z0-9-]+$/.test(k) && /^#[0-9a-f]{3,8}$/i.test(String(v)))), ed: Object.fromEntries(Object.entries(t.ed || {}).filter(([k, v]) => /^[\w.]+$/.test(k) && /^#[0-9a-f]{3,8}$/i.test(String(v)))),
    rules: (Array.isArray(t.rules) ? t.rules : []).slice(0, 400).filter((r) => r && /^[\w.-]{1,80}$/.test(String(r.token))).map((r) => ({ token: String(r.token), foreground: /^[0-9a-f]{6}$/i.test(String(r.foreground)) ? String(r.foreground) : undefined, fontStyle: /^(italic|bold|underline|\s)*$/.test(String(r.fontStyle || '')) ? String(r.fontStyle || '') : '' })) }));
  out.snippets = {};
  for (const [lang, list] of Object.entries(m.snippets || {})) if (/^[\w-]+$/.test(lang) && Array.isArray(list)) out.snippets[lang] = list.slice(0, 500).filter((s) => s && s.prefix && s.body).map((s) => ({ prefix: String(s.prefix), body: Array.isArray(s.body) ? s.body.join('\n') : String(s.body), description: String(s.description || '') }));
  out.readme = String(m.readme || '').slice(0, 4000);   // optional long description (plain text, blank line = new paragraph)
  out.screenshots = (Array.isArray(m.screenshots) ? m.screenshots : []).slice(0, 6).filter((x) => x && /^https:\/\/[^\s"'<>]{4,300}$/.test(String(x.src))).map((x) => ({ src: String(x.src), caption: String(x.caption || '').slice(0, 120) }));   // https images only
  out.navigation = (Array.isArray(m.navigation) ? m.navigation : []).filter((n) => n === 'laravel' || n === 'gitlens' || n === 'gitblame');   // built-in navigation features an extension can switch on
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
    } catch (e) { out.push({ id: 'invalid-' + out.length, name: String(entry), error: e.message, source: 'custom', themes: [], snippets: {}, fileAssociations: {}, navigation: [] }); }
  }
  return out;
}
// bundled extensions installed earlier pick up newer catalog manifests (e.g. new navigation features)
function refreshBundled(m) {
  if (m.source !== 'bundled' || !EXT_ID.test(String(m.id))) return m;
  try { return cleanManifest(JSON.parse(fs.readFileSync(path.join(catalogDir, m.id + '.json'), 'utf8')), 'bundled'); } catch { return m; }
}
function listExtensions() {
  const dis = new Set(readJson('settings.json', {}).disabledExtensions || []);
  let installed = [];
  try { installed = fs.readdirSync(extDir()).filter((f) => f.endsWith('.json')).map((f) => { const m = readJson(path.join('extensions', f), null); return m && { m, at: fs.statSync(path.join(extDir(), f)).mtimeMs }; }).filter(Boolean).map(({ m, at }) => ({ ...refreshBundled(m), installedAt: at })); } catch { /* none */ }
  return [...installed, ...readLocalManifests()].map((m) => ({ ...m, enabled: !dis.has(m.id) }));
}
const catalogDir = path.join(__dirname, 'catalog');
ipcMain.handle('ext:catalog', () => fs.readdirSync(catalogDir).filter((f) => f.endsWith('.json')).map((f) => cleanManifest(JSON.parse(fs.readFileSync(path.join(catalogDir, f), 'utf8')), 'bundled')));
ipcMain.handle('ext:installBundled', (_e, id) => {
  if (!EXT_ID.test(String(id))) throw new Error('Bad id');
  const f = path.join(catalogDir, id + '.json'); if (!fs.existsSync(f)) throw new Error('Unknown extension');
  const m = cleanManifest(JSON.parse(fs.readFileSync(f, 'utf8')), 'bundled');
  fs.mkdirSync(extDir(), { recursive: true }); fs.writeFileSync(path.join(extDir(), m.id + '.json'), JSON.stringify(m, null, 2)); scheduleSyncPush(); return m;
});
ipcMain.handle('ext:pickThemeFile', async () => {       // user explicitly picks a VS Code theme .json
  const r = await dialog.showOpenDialog(currentWin, { title: 'Import VS Code theme', properties: ['openFile'], filters: [{ name: 'Theme JSON', extensions: ['json', 'jsonc'] }] });
  if (r.canceled) return null;
  const st = fs.statSync(r.filePaths[0]); if (st.size > 2 * 1024 * 1024) throw new Error('Theme file too large (>2 MB)');
  return { name: path.basename(r.filePaths[0]), text: fs.readFileSync(r.filePaths[0], 'utf8') };
});
ipcMain.handle('ext:saveManifest', (_e, m) => {          // used for imported themes; same sanitizer as downloads
  const clean = cleanManifest(m, 'imported');
  fs.mkdirSync(extDir(), { recursive: true }); fs.writeFileSync(path.join(extDir(), clean.id + '.json'), JSON.stringify(clean, null, 2)); scheduleSyncPush(); return clean;
});
ipcMain.handle('ext:list', () => listExtensions());
ipcMain.handle('ext:install', async (_e, url) => { const m = await installFromUrl(String(url)); scheduleSyncPush(); return m; });
ipcMain.handle('ext:uninstall', (_e, id) => { if (!EXT_ID.test(String(id))) throw new Error('Bad id'); try { fs.unlinkSync(path.join(extDir(), id + '.json')); } catch { /* not installed */ } scheduleSyncPush(); return true; });
ipcMain.handle('ext:sync', async () => {          // download everything listed under "extensions" in settings.json
  const s = readJson('settings.json', {}); const errors = [];
  for (const url of s.extensions || []) { try { await installFromUrl(String(url)); } catch (e) { errors.push(`${url}: ${e.message}`); } }
  return { errors, list: listExtensions() };
});
ipcMain.handle('keys:get', () => { const r = readKeys(); return { defaults: DEFAULT_KEYS, user: r.map, error: r.error || null, file: keyFile() }; });
ipcMain.handle('keys:set', (_e, map) => { const clean = cleanKeys(map); writeKeys(clean); buildMenu(); scheduleSyncPush(); return clean; });
ipcMain.handle('keys:file', () => { ensureKeyFile(); return keyFile(); });
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
  if (!res.ok) {
    let msg = data && data.detail;                  // DRF field errors look like { username: ["…"] }
    if (!msg && data && typeof data === 'object') msg = Object.values(data).flat().find((x) => typeof x === 'string');
    throw new Error(msg || `API ${res.status}`);
  }
  return data;
}
// After any sign-in: an account that already has saved settings restores them (reinstall), otherwise this machine seeds the account.
async function afterSignIn(email) {
  writeJson('sync.json', { version: 0, email: email || '' });
  const res = await syncPull(true);
  if (!res.restored) await syncPush().catch(() => { /* offline: next change retries */ });
  return !!res.restored;
}
ipcMain.handle('api:login', async (_e, username, password) => {
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || username.length > 150 || password.length > 256) throw new Error('Enter a username and password.');
  const r = await api('POST', '/auth/login/', { username, password }); setToken(r.token);
  const p = await api('GET', '/profile/').catch(() => ({}));
  writeJson('account.json', { email: p.email || '', name: p.display_name || p.username || username, picture: '' });
  return { email: p.email || p.username || username, name: p.display_name || p.username || username, restored: await afterSignIn(p.email || p.username || username) };
});
ipcMain.handle('api:register', async (_e, username, email, password) => {
  if ([username, email, password].some((v) => v != null && typeof v !== 'string') || !String(username || '').trim() || String(username).length > 150 || String(email || '').length > 254 || String(password || '').length > 256) throw new Error('Check the username, email and password.');
  await api('POST', '/auth/register/', { username: String(username || '').trim(), email: String(email || '').trim(), password: String(password || '') });
  const r = await api('POST', '/auth/login/', { username: String(username || '').trim(), password: String(password || '') }); setToken(r.token);
  writeJson('account.json', { email: String(email || '').trim(), name: String(username).trim(), picture: '' });
  return { email: String(email || '').trim() || String(username).trim(), name: String(username).trim(), restored: await afterSignIn(String(email || username).trim()) };
});
ipcMain.handle('api:logout', async () => { if (getToken()) { try { await api('POST', '/auth/logout/'); } catch { /* offline */ } } setToken(null); setGoogleRefresh(null); gAccess = { token: '', exp: 0 }; for (const f of ['sync.json', 'account.json']) { try { fs.unlinkSync(storeFile(f)); } catch { /* none */ } } return true; });
ipcMain.handle('api:loggedIn', () => signedIn());

// ---------------------------------------------------------------- Google sign-in + settings sync
// Sign-in: system browser -> Google (PKCE) -> redirect to a one-shot listener on 127.0.0.1 -> the authorization code goes to
// our backend, which holds the client secret, verifies the ID token and returns an Asta token (stored in OS credential storage).
// Sync: settings.json, keyboard overrides and installed declarative extensions. Never source code, paths or tokens.
function focusIde() {
  const w = currentWin && !currentWin.isDestroyed() ? currentWin : [...wins][0];
  if (!w) return;
  if (w.isMinimized()) w.restore();
  w.show(); w.focus();
  if (process.platform === 'win32') { w.setAlwaysOnTop(true); w.setAlwaysOnTop(false); }   // Windows otherwise only flashes the taskbar
}
// The Google picture is fetched here (not by the page) and kept as a small data: URL, so the renderer never contacts Google.
async function fetchAvatar(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'https:' || !/(^|\.)googleusercontent\.com$/.test(u.hostname)) return '';
    const res = await fetch(u, { redirect: 'follow' });
    const type = String(res.headers.get('content-type') || '');
    if (!res.ok || !/^image\/(png|jpe?g|webp|gif)$/.test(type)) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 && buf.length < 300 * 1024 ? `data:${type};base64,${buf.toString('base64')}` : '';
  } catch { return ''; }
}
const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let activeAuth = null;            // at most one Google sign-in at a time
function googleAuthorize(cfg) {
  const rq = ga.newAuthRequest();
  return new Promise((resolve, reject) => {
    let done = false, timer = null, redirect = '';
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); activeAuth = null; try { srv.close(); } catch { /* closed */ } fn(v); };
    const page = (title, msg) => `<!doctype html><meta charset="utf-8"><title>Asta IDE</title><body style="font:16px system-ui;background:#0b0d10;color:#f5f7fa;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>${title}</h2><p style="color:#9aa3ad">${msg}</p></div>`;
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method !== 'GET' || u.pathname !== '/cb') { res.writeHead(404).end(); return; }
      if (done) { res.writeHead(410).end(); return; }                 // a code is only ever processed once
      const r = ga.parseCallback(u.searchParams, rq.state);
      res.writeHead(r.ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        .end(page(r.ok ? 'Signed in to Asta IDE' : 'Sign-in did not complete', r.ok ? 'You can close this tab and return to Asta IDE.' : r.message));
      if (r.ok) { focusIde(); finish(resolve, { code: r.code, verifier: rq.verifier, nonce: rq.nonce, redirect }); }
      else finish(reject, new ga.GoogleAuthError(r.code, r.message));
    });
    srv.on('error', (e) => finish(reject, new ga.GoogleAuthError('listen', 'Could not start the local sign-in listener: ' + e.message)));
    srv.listen(0, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${srv.address().port}/cb`;
      if (!ga.isLoopbackRedirect(redirect)) return finish(reject, new ga.GoogleAuthError('listen', 'Unexpected redirect address.'));
      const url = ga.buildAuthUrl(G.auth, { clientId: cfg.clientId, redirect, challenge: rq.challenge, state: rq.state, nonce: rq.nonce });
      if (process.env.CODEFORGE_GOOGLE_TEST_BASE) fetch(url).catch(() => {});   // test mock: no browser
      else openExternal(url);
      timer = setTimeout(() => finish(reject, new ga.GoogleAuthError('timeout', 'Sign-in timed out.')), 180000);
    });
    activeAuth = { cancel: () => finish(reject, new ga.GoogleAuthError('cancelled', 'Google sign-in was cancelled.')) };
  });
}
// ---- Google account, straight from the app: no Asta server, no database --------------------------------------------------
// The OAuth client (a Google "Desktop app" client) comes from CODEFORGE_GOOGLE_CLIENT_ID / _SECRET or google-oauth.json.
// A desktop client's secret is not confidential (Google's own guidance), but it is still kept out of git.
// Tests only: point every Google endpoint at a local mock (CODEFORGE_GOOGLE_TEST_BASE=http://127.0.0.1:PORT).
const GTEST = process.env.CODEFORGE_GOOGLE_TEST_BASE || '';
const G = { auth: GTEST ? GTEST + '/auth' : 'https://accounts.google.com/o/oauth2/v2/auth', token: GTEST ? GTEST + '/token' : 'https://oauth2.googleapis.com/token',
  certs: GTEST ? GTEST + '/certs' : 'https://www.googleapis.com/oauth2/v3/certs',
  drive: GTEST ? GTEST + '/drive/v3/files' : 'https://www.googleapis.com/drive/v3/files', upload: GTEST ? GTEST + '/upload/drive/v3/files' : 'https://www.googleapis.com/upload/drive/v3/files' };
function googleCfg() {
  const file = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
  const r = ga.resolveConfig([
    { clientId: process.env.CODEFORGE_GOOGLE_CLIENT_ID, clientSecret: process.env.CODEFORGE_GOOGLE_CLIENT_SECRET },   // 1. environment (CI, dev)
    file(path.join(userData(), 'google-oauth.json')),                                                                   // 2. per-user override
    file(path.join(__dirname, 'google-oauth.json')),                                                                    // 3. bundled with the build
  ]);
  if (!r.ok) throw new ga.GoogleAuthError(r.code, r.message);
  return r;
}
async function googleFetch(url, opts) {
  try { return await fetch(url, opts); } catch { throw new ga.GoogleAuthError('network', 'Cannot reach Google.'); }
}
async function googleToken(form) {
  const c = googleCfg();
  const body = new URLSearchParams({ client_id: c.clientId, ...form });
  if (c.clientSecret) body.set('client_secret', c.clientSecret);       // Google "Desktop app" clients still ask for it; it is not confidential and never leaves this process
  const res = await googleFetch(G.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ga.GoogleAuthError(j.error === 'invalid_grant' ? 'expired' : 'token', j.error === 'invalid_grant' ? 'Google sign-in expired. Please sign in again.' : `Google sign-in failed (${String(j.error || res.status).slice(0, 60)}).`);
  return j;
}
let jwksCache = { at: 0, jwks: null };
async function googleJwks() {
  if (jwksCache.jwks && Date.now() - jwksCache.at < 3600000) return jwksCache.jwks;
  const res = await googleFetch(G.certs);
  if (!res.ok) throw new ga.GoogleAuthError('network', 'Could not load Google signing keys.');
  jwksCache = { at: Date.now(), jwks: await res.json() };
  return jwksCache.jwks;
}
const gRefreshFile = () => storeFile('google.bin');
function getGoogleRefresh() {
  try { const raw = fs.readFileSync(gRefreshFile()); return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : null; } catch { return null; }
}
function setGoogleRefresh(t) {
  if (!t) { try { fs.unlinkSync(gRefreshFile()); } catch { /* none */ } return; }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential storage unavailable; not saving login.');
  fs.mkdirSync(userData(), { recursive: true });
  fs.writeFileSync(gRefreshFile(), safeStorage.encryptString(t), { mode: 0o600 });
}
let gAccess = { token: '', exp: 0 };
async function googleAccess() {
  if (gAccess.token && Date.now() < gAccess.exp - 60000) return gAccess.token;
  const rt = getGoogleRefresh(); if (!rt) throw new Error('Not signed in to Google.');
  const j = await googleToken({ grant_type: 'refresh_token', refresh_token: rt });
  gAccess = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return gAccess.token;
}
const signedIn = () => !!getGoogleRefresh() || !!getToken();
// settings snapshot lives in the user's own Google Drive app-data folder (file "asta-sync.json")
async function driveFile() {
  const t = await googleAccess();
  const q = new URLSearchParams({ spaces: 'appDataFolder', q: "name='asta-sync.json'", fields: 'files(id)' });
  const res = await googleFetch(G.drive + '?' + q, { headers: { Authorization: 'Bearer ' + t } });
  if (!res.ok) throw new Error(res.status === 403 ? 'Google Drive access was not granted. Sign in again and allow Asta to store its settings.' : `Google Drive error (${res.status}).`);
  return ((await res.json()).files || [])[0] || null;
}
async function drivePull() {
  const f = await driveFile(); if (!f) return { version: 0, data: null };
  const t = await googleAccess();
  const res = await googleFetch(`${G.drive}/${f.id}?alt=media`, { headers: { Authorization: 'Bearer ' + t } });
  if (!res.ok) throw new Error(`Google Drive error (${res.status}).`);
  const j = await res.json().catch(() => null);
  return j && typeof j === 'object' ? { version: Number(j.version) || 0, data: j.data || null } : { version: 0, data: null };
}
async function drivePush(data) {
  const t = await googleAccess(), f = await driveFile(), cur = f ? await drivePull().catch(() => ({ version: 0 })) : { version: 0 };
  const version = (cur.version || 0) + 1, body = JSON.stringify({ version, data });
  let res;
  if (f) res = await googleFetch(`${G.upload}/${f.id}?uploadType=media`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body });
  else {
    const b = 'asta' + crypto.randomBytes(8).toString('hex');
    const multi = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: 'asta-sync.json', parents: ['appDataFolder'] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
    res = await googleFetch(`${G.upload}?uploadType=multipart`, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': `multipart/related; boundary=${b}` }, body: multi });
  }
  if (!res.ok) throw new Error(`Google Drive error (${res.status}).`);
  return version;
}
const googleFail = (e) => {
  const f = ga.friendlyError(e);
  return new Error(`${f.code}::${f.message}`);           // IPC keeps only the message: the renderer splits "code::text"
};
ipcMain.handle('google:status', () => {
  try { googleCfg(); return { configured: true }; } catch (e) { const f = ga.friendlyError(e); return { configured: false, code: f.code, message: f.message }; }
});
ipcMain.handle('google:saveConfig', (_e, clientId, clientSecret) => {      // setup dialog: stored per user, never sent back to the renderer
  if (typeof clientId !== 'string' || (clientSecret != null && typeof clientSecret !== 'string') || clientId.length > 200 || String(clientSecret || '').length > 200) throw googleFail(new ga.GoogleAuthError('config_invalid', 'Check the client ID and secret.'));
  const r = ga.resolveConfig([{ clientId, clientSecret: clientSecret || '' }]);
  if (!r.ok) throw googleFail(new ga.GoogleAuthError(r.code, r.message));
  fs.mkdirSync(userData(), { recursive: true });
  fs.writeFileSync(path.join(userData(), 'google-oauth.json'), JSON.stringify({ clientId: r.clientId, clientSecret: r.clientSecret }, null, 2), { mode: 0o600 });
  return { configured: true };
});
ipcMain.handle('google:cancel', () => { if (activeAuth) activeAuth.cancel(); return true; });
ipcMain.handle('api:google', async () => {
  if (activeAuth) throw googleFail(new ga.GoogleAuthError('busy', 'A Google sign-in is already in progress. Finish it in your browser or cancel it.'));
  try {
    const cfg = googleCfg();
    const g = await googleAuthorize(cfg);
    const tok = await googleToken({ grant_type: 'authorization_code', code: g.code, code_verifier: g.verifier, redirect_uri: g.redirect });
    const id = ga.verifyIdToken(tok.id_token, { clientId: cfg.clientId, nonce: g.nonce, jwks: await googleJwks() });
    if (!tok.refresh_token) throw new ga.GoogleAuthError('no_refresh', 'Google did not return an offline session. Remove Asta from your Google account permissions (myaccount.google.com/permissions) and sign in again.');
    if (!String(tok.scope || '').includes('drive.appdata')) throw new ga.GoogleAuthError('scope', 'Asta needs permission to store its settings in your Google Drive app data. Sign in again and allow it.');
    setGoogleRefresh(tok.refresh_token); gAccess = { token: tok.access_token, exp: Date.now() + (tok.expires_in || 3600) * 1000 };
    const picture = await fetchAvatar(id.picture);
    writeJson('account.json', { sub: id.sub, email: id.email, name: id.name, picture });
    focusIde();
    return { email: id.email, name: id.name, picture, restored: await afterSignIn(id.email) };   // reinstall: restore first; first device: seed the Drive file
  } catch (e) { throw googleFail(e); }
});

const SYNC_SKIP = new Set(['gitBashPath', 'powershellPath', 'cmdPath', 'gitPath', 'customExtensions', 'gitlensSeeded', 'autoSync']);   // machine-specific or per-device
const syncOn = () => signedIn() && ({ ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) }).autoSync !== false;
function buildSnapshot() {
  const s = { ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) };
  const settings = Object.fromEntries(Object.entries(s).filter(([k]) => k in DEFAULT_SETTINGS && !SYNC_SKIP.has(k)));
  const extensions = [];
  try { for (const f of fs.readdirSync(extDir()).filter((n) => n.endsWith('.json'))) { const m = readJson(path.join('extensions', f), null); if (m) try { extensions.push(cleanManifest(m, String(m.source || 'synced'))); } catch { /* skip invalid */ } } } catch { /* none */ }
  return { settings, keys: cleanKeys(readKeys().map), extensions };
}
function applySnapshot(d) {
  const cur = { ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) };
  for (const [k, v] of Object.entries((d && d.settings) || {})) {
    if (!(k in DEFAULT_SETTINGS) || SYNC_SKIP.has(k)) continue;
    const def = DEFAULT_SETTINGS[k];
    if (typeof v === typeof def && Array.isArray(v) === Array.isArray(def)) cur[k] = v;
  }
  writeJson('settings.json', cur);
  writeKeys(cleanKeys(d && d.keys));
  const keep = new Set();
  fs.mkdirSync(extDir(), { recursive: true });
  for (const raw of Array.isArray(d && d.extensions) ? d.extensions.slice(0, 200) : []) {
    try { const m = cleanManifest(raw, String((raw && raw.source) || 'synced')); fs.writeFileSync(path.join(extDir(), m.id + '.json'), JSON.stringify(m, null, 2)); keep.add(m.id + '.json'); } catch { /* skip invalid */ }
  }
  for (const f of fs.readdirSync(extDir())) if (f.endsWith('.json') && !keep.has(f)) { try { fs.unlinkSync(path.join(extDir(), f)); } catch { /* ignore */ } }
  buildMenu(); wins.forEach((w) => { applyHeaderSetting(w); });
}
let syncBusy = false, syncTimer = null;
async function syncPush() {
  if (!signedIn()) return { ok: false };
  if (getGoogleRefresh()) {
    const version = await drivePush(buildSnapshot());
    writeJson('sync.json', { ...readJson('sync.json', {}), version });
    return { ok: true, version };
  }
  const r = await api('PUT', '/sync/', { data: buildSnapshot() });
  writeJson('sync.json', { ...readJson('sync.json', {}), version: r.version });
  return { ok: true, version: r.version };
}
async function syncPull(force) {
  if (!signedIn()) return { restored: false };
  const local = readJson('sync.json', {}), r = getGoogleRefresh() ? await drivePull() : await api('GET', '/sync/');
  if (!r.data || (!force && r.version <= (local.version || 0))) return { restored: false };
  syncBusy = true;
  try { applySnapshot(r.data); writeJson('sync.json', { ...local, version: r.version }); } finally { syncBusy = false; }
  wins.forEach((w) => sendTo(w.webContents, 'sync-applied'));
  return { restored: true, version: r.version };
}
function scheduleSyncPush() {                      // debounced; silent when signed out, offline, or auto-sync is off
  if (syncBusy || !syncOn()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncPush().catch(() => { /* offline: the next change retries */ }); }, 4000);
}
ipcMain.handle('sync:push', async () => syncPush());
ipcMain.handle('sync:pull', async () => syncPull(true));
ipcMain.handle('sync:status', async () => {
  const a = readJson('account.json', {}), s = readJson('sync.json', {});
  return { signedIn: signedIn(), email: a.email || s.email || '', name: a.name || '', picture: a.picture || '', version: s.version || 0 };
});
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
// Shutdown: kill every terminal Asta started (PTY + its conpty/OpenConsole helpers live under the install dir and
// would otherwise keep files locked, making the installer report "Asta cannot be closed").
let quitting = false;
const dlog = (...a) => { if (process.env.CODEFORGE_DEBUG) console.log('[Asta]', ...a); };
function killTerminals() {
  dlog('Closing terminal sessions:', terms.size);
  for (const t of [...terms.values()]) { try { t.kill(); } catch { /* already gone */ } }
  terms.clear();
}
function shutdown(why) {
  if (quitting) return;
  quitting = true; dlog('Shutdown requested:', why);
  killTerminals();
}
app.on('before-quit', () => shutdown('before-quit'));
app.on('will-quit', () => { shutdown('will-quit'); dlog('Shutdown complete'); });
process.on('exit', () => { try { killTerminals(); } catch { /* ignore */ } });
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', (_e, argv, cwd) => {
    const w = createWindow(argvTarget(argv, cwd) || { fresh: '1' });   // launched again: its own window (empty when no path given)
    w.show(); w.focus();
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    createWindow(argvTarget(process.argv) || {});
    if (syncOn()) setTimeout(() => syncPull(false).catch(() => { /* offline */ }), 2500);
  });
  app.on('window-all-closed', () => { shutdown('window-all-closed'); app.quit(); });
}
function argvTarget(argv, cwd) {
  // "Open with Asta": the user explicitly chose this path in the OS shell. Returns window query { root, file? } or null.
  const p = argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-')).map((a) => path.resolve(cwd || process.cwd(), a))
    .find((a) => a !== path.resolve(app.getAppPath()) && fs.existsSync(a));
  if (!p) return null;
  try {
    const st = fs.statSync(p);
    const root = registerRoot(st.isDirectory() ? p : path.dirname(p));
    return st.isFile() ? { root, file: p } : { root };
  } catch (e) { return null; /* protected folder */ }
}
