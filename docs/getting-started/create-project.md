The **New Project** wizard shows you the exact commands for a new project, runs them in the integrated terminal, and opens the result.

## Requirements

- The tool for your project type installed ([System Requirements](requirements.md)): Composer for Laravel, Python for Django/Python, Node.js for Node/React/Vue.

## Steps

1. Open the Command Palette (<kbd>Ctrl+Shift+P</kbd>) and run **New Project…**.
2. Choose a **Project type**, a **Project name** and a **Location** (click Browse).
3. Click **Create Project**. AstaIDE displays the commands first, then runs them in the terminal.
4. When they finish, the new folder opens in the Explorer.

## What each type runs

| Type | Commands |
|---|---|
| `laravel` | `composer create-project laravel/laravel "<name>"` |
| `django` | `python -m venv "<name>/.venv"`, install Django into it, then `django-admin startproject config "<name>"` |
| `python` | `mkdir "<name>"`, `python -m venv "<name>/.venv"` |
| `node` | `mkdir "<name>"`, `cd "<name>" && npm init -y` |
| `vue` | `npm create vue@latest "<name>"` |
| `react` | `npm create vite@latest "<name>" -- --template react` |
| `php` | `mkdir "<name>"` |
| `empty` | `mkdir "<name>"` |

## Expected result

A new folder named after your project exists in the chosen location and is open in AstaIDE. The **Run and Debug** view shows the detected project type.

## Common problems

- **"Protected location":** choose a normal folder such as `Documents/Projects`.
- **`composer` / `python` / `npm` not found:** install it and restart AstaIDE ([PHP, Python and Node.js Not Found](../troubleshooting/runtimes.md)).
- **Interactive prompts (Vue, Vite):** answer them in the terminal panel; the wizard waits for the command to finish.

## Related

- [Understanding Run and Debug](../run-debug/overview.md)
- [Tutorial: Laravel](../tutorials/laravel.md) and [Tutorial: Django](../tutorials/django.md)
