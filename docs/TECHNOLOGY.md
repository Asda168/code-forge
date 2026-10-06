# Technology

## Desktop
| Tech | Version | Use |
|---|---|---|
| Electron | ^33 | Desktop shell, main/renderer split, `contextBridge` |
| Monaco Editor | ^0.52 | Code editor, markers/problems, themes |
| xterm.js (+ addon-fit) | ^5.5 / ^0.10 | Terminal emulator UI |
| node-pty | ^1 (optional) | Real PTY shells (PowerShell, CMD, Git Bash, bash) |
| JetBrains Mono (@fontsource) | ^5.1 | Default editor font |
| electron-builder | ^25 | NSIS / DMG / AppImage / deb / rpm installers |
| sharp | ^0.33 | Icon generation (`npm run icons`) |
| Vanilla JS + CSS | - | Renderer UI, no framework or bundler |

## Backend
| Tech | Use |
|---|---|
| Django 5 | Web framework, admin, ORM |
| Django REST Framework | JSON API (auth, settings, releases, extensions) |
| Channels + Daphne + channels-redis | WebSocket/ASGI consumers |
| PostgreSQL (psycopg 3) via dj-database-url | Database |
| Redis | Channel layer |
| django-cors-headers | CORS for the desktop client |

## Tooling
- GitHub Actions: cross-platform release builds.
- Tests: `desktop/scripts/security-test.js`, Electron e2e scripts (`e2e*.js`), `python manage.py test core`.
- Bundled catalog: Laravel, PHP, Python, Django, JavaScript, Vue, React, SQL, MySQL, Git, and colour themes (Monokai Dimmed default, Forest, Neon, Ocean, Paper, Sunset).

## Design choices
- Local-first: files, git and terminals never leave the machine; backend features are opt-in.
- Declarative extensions instead of executable plugins, to keep the attack surface small.
- No bundler: renderer scripts load directly, for simple startup and debugging.
