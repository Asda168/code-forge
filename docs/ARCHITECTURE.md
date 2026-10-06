# Architecture

## Overview
```
 +------------------------- Electron app (desktop/) -------------------------+
 |  Renderer (Chromium, no Node)          Main process (Node)                |
 |  index.html + renderer/*.js   --IPC--> main.js --> fs / git / node-pty    |
 |  Monaco, xterm.js, global CF           preload.js (contextBridge: cf.*)   |
 |                                        security.js (allow-lists)          |
 +---------------------------------------------+-----------------------------+
                                               | HTTPS (optional: login,
                                               |  settings sync, update check)
                                     +---------v---------+
                                     | Django backend    |  DRF, Channels,
                                     +-------------------+  Postgres/Redis
```
All local work (files, git, terminals, running projects) happens in the main process. No local server is opened. The backend is optional.

## Desktop
- **Main process** (`src/main.js`): window lifecycle, workspace/recents, and the `fs:*`, `git:*`, `term:*`, `project:*`, `settings:*`, `ext:*`, `api:*`, `app:*` IPC channels. Settings are stored as `settings.json` in user data and merged over `DEFAULT_SETTINGS`.
- **Security** (`src/security.js`): path allow-list (opened folders only), protected system dirs per OS, filesystem-root guard. Pure functions, tested by `scripts/security-test.js`.
- **Preload** (`src/preload.js`): exposes `window.cf` namespaces.
- **Renderer**: classic scripts sharing a global `CF` object (state in `CF.S`). No bundler; load order in `index.html`.

| File | Responsibility |
|---|---|
| `core.js` | state, theme engine, Monaco setup, editor groups, tabs, save/close |
| `explorer.js` | virtualised file tree, search/replace, context menus |
| `git.js`, `gitlens.js` | source control view, blame/lens annotations |
| `terminal.js` | xterm.js tabs backed by node-pty |
| `icons.js` | UI SVG icons, file/folder icons, icon themes (Symbols, Colour Badges, Minimal) |
| `themes.js` | colour themes, live-preview picker, VS Code theme import |
| `ui.js` | settings dialog, command palette, extensions view, modals |
| `laravel.js` | Laravel-aware navigation and completions |
| `ide.js`, `shortcuts.js`, `boot.js` | layout/panels, key bindings, startup |

## Editor tabs
Tabs belong to editor groups (`S.groups`, each with `tabs`, `active`, `pinned`, a Monaco editor). Right-click a tab for Close, Close Others, Close Saved (only tabs without unsaved changes), Close All, Pin, Split and Move. The palette has View: Close Saved Editors and View: Close All Editors.

## Extensions
Declarative JSON manifests (themes, snippets, file associations, navigation rules). Sources: bundled `src/catalog/*.json`, HTTPS URLs and local folders listed in `settings.json`. They never run code. Imported VS Code themes are converted to this format in `themes.js`.

## Settings flow
`CF.setSetting(patch)` -> IPC `settings:set` -> merged and persisted -> `CF.applySettings()` re-applies fonts, layout and theme; a change to `iconTheme` also redraws tabs and the file tree. Users can edit `settings.json` directly; saving it reloads settings and extensions.

## Backend
Django 5 + DRF + Channels (`backend/core`). Models: UserProfile, Theme, EditorSettings, TerminalProfile, Project, Repository, GitRemote, RunConfiguration, Workspace, Extension, InstalledExtension, Release, Download, UserPreference.

REST endpoints under `/api/`: `auth/{login,logout,register}`, `profile`, `settings`, `releases[/latest]`, `extensions`, `projects`, `workspaces`. A download page (`core/download.html`) serves installers; the `seed` command loads the extension catalog.

## Build and release
electron-builder targets: NSIS (Windows x64/arm64), DMG (macOS universal), AppImage/deb/rpm (Linux). `.github/workflows/release.yml` builds all three on a version tag and attaches them to a GitHub Release.

## Known gaps
No LSP, no real debugger adapter, no PR/issue integration, auto-update opens the download page instead of patching, macOS/Linux installers untested.
