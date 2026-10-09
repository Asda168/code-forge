# Asta (repo: CodeForge)

Lightweight IDE: Electron desktop app (`desktop/`) + Django backend (`backend/`) for accounts, settings sync and the release/download feed. See `docs/` for architecture and technology.

## Commands
```
# desktop (run in desktop/)
npm install && npm run icons && npm start      # run from source
npm run dist:win | dist:mac | dist:linux       # installers (build on matching OS)
node scripts/security-test.js                  # path/command safety tests
node scripts/e2e*.js                           # Electron end-to-end scripts

# backend (run in backend/)
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
python manage.py migrate && python manage.py seed && python manage.py runserver
python manage.py test core
```
`CODEFORGE_API` env var points the app at the backend (default `http://127.0.0.1:8000/api`).

## Layout
- `desktop/src/main.js` – Electron main process: all `ipcMain.handle` channels (fs, git, term, project, settings, ext, api), `DEFAULT_SETTINGS`.
- `desktop/src/security.js` – pure path/command safety helpers (no Electron imports, unit-testable).
- `desktop/src/preload.js` – `contextBridge` exposing `window.cf.*`; the only door between renderer and main.
- `desktop/src/renderer/*.js` – plain browser scripts (no bundler/modules) sharing one global `CF` namespace; load order is set in `index.html`. `core.js` (state `CF.S`, themes, Monaco, tabs), `explorer.js`, `git.js`, `gitlens.js`, `terminal.js`, `icons.js`, `themes.js`, `ui.js` (settings dialog, palette, extensions UI), `laravel.js`, `ide.js`, `boot.js` (startup).
- `desktop/src/catalog/*.json` – bundled declarative extensions (themes, snippets, file associations). Synced from `backend/core/catalog.json` via `scripts/sync-catalog.py`.
- `backend/codeforge/` Django project; `backend/core/` app (models, DRF views, Channels consumers, seed command).

## Conventions
- Renderer files are IIFEs/scripts attaching to `CF`; no imports. Dense, compact style: arrow functions, `h(tag, attrs, ...children)` DOM helper, `CF.guard(async fn)` wraps handlers to toast errors.
- Settings: add new keys to `DEFAULT_SETTINGS` in `main.js`; change via `CF.setSetting({k: v})` (persists + `applySettings`). Settings UI rows live in `renderer/settings.js` (`settings://main` editor tab; add an `item(label, control, description)` to a card).
- Commands appear in the palette list in `ui.js` (search `Preferences: Color Theme`).
- Keyboard shortcuts: commands are registered in `renderer/keybindings.js` (id, title, optional `when: 'terminal'|'!terminal'`); defaults are `DEFAULT_KEYS` + `KEY_META` (group/title, drives the generated `keyboard.json`) in `main.js`; users override them in `<userData>/keyboard.json` (`{ "command-id": "ctrl+shift+b", "x": "" }`) or by clicking a binding in the Keyboard Shortcuts tab (`kbd://shortcuts`). One document-level dispatcher handles every shortcut (chords supported); menu accelerators are display-only (`registerAccelerator: false`). New shortcut = add a command + a default key, never a separate `keydown` listener.
- Non-file editor tabs use `ext://` / `kbd://` paths and `CF.pages[scheme] = { icon, title, render }` (drawn into `g.page`).
- File icons: `icons.js` (`KIND` by extension, `NAMED` by filename, `FOLDERS`; icon themes via the `iconTheme` setting).
- Extensions are declarative JSON only and must never execute code.

## Security rules (do not weaken)
- Renderer has no Node access; every fs/git/process action goes through IPC and must pass the path allow-list (only folders the user opened) and protected-dir checks in `security.js`.
- Git is restricted to an allow-list of subcommands/options. Deletes go to Trash after confirmation. Tokens live in OS credential storage. Source code is never sent to the server.
- After touching IPC handlers or `security.js`, run `node desktop/scripts/security-test.js`.

## Gotchas
- Windows paths mix `/` and `\`; normalise before comparing (see the explorer reveal fix).
- Syntax-check renderer edits with `node --check file.js`; one syntax error breaks the whole UI (panel resize, Quick Open etc.).
- `node-pty` is an optional dependency and is unpacked from asar in builds.
