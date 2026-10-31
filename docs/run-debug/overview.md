The **Run and Debug** view detects what kind of project you opened and offers ready-made run configurations. Open it with <kbd>Ctrl+Shift+D</kbd>.

## Project detection

AstaIDE looks at the files in your project folder:

| If the folder contains | Detected as | Run configuration |
|---|---|---|
| `artisan` and `composer.json` | `laravel` | **Laravel Development**: `php artisan serve` (http://127.0.0.1:8000) |
| `manage.py` | `django` | **Django Development**: `python manage.py runserver` (http://127.0.0.1:8000) |
| `package.json` with `vue` | `vue` | `npm run dev` (or `npm start` if there is no `dev` script) |
| `package.json` with `react` | `react` | `npm run dev` (or `npm start`) |
| any other `package.json` | `node` | `npm run dev` (or `npm start`) |
| `index.php` or `public/index.php`, nothing else detected | `php` | **PHP built-in server**: `php -S localhost:8000` |
| only `.py` files | `python` | no automatic command |

The view shows *Detected: laravel, node* (or *No project type detected*).

## Run, stop and restart

| Button | Shortcut | Does |
|---|---|---|
| **Run** | <kbd>F5</kbd> | Runs the selected (or first) configuration in a terminal named after it |
| **Debug** | | Runs it with debug options (below) |
| **Stop** | <kbd>Shift+F5</kbd> | Stops the last run |
| **Stop all** | | Stops every running task |
| **Restart** | <kbd>Ctrl+Shift+F5</kbd> | Stops, then runs again |

Click a configuration in the list to run it. When a configuration has a URL, AstaIDE shows a notice such as *Open http://127.0.0.1:8000*.

## Run configurations

Click **+** next to *Run configurations* to add your own:

| Field | Meaning | Example |
|---|---|---|
| Name | Label and terminal name | `Queue worker` |
| Command | What to run | `php artisan queue:work` |
| Working Directory | Folder to run in; `${workspaceFolder}` is your project | `${workspaceFolder}` |
| Environment | `KEY=VALUE` pairs separated by spaces | `APP_ENV=local APP_DEBUG=true` |

Custom configurations belong to the project folder and are stored by the app (not in `settings.json`). They appear in the list with the detected ones.

## Debug mode

**Debug** changes the command for a few common cases and logs it in the **Debug Console**:

| Command starts with | Debug version |
|---|---|
| `node ` | `node --inspect ...` |
| `npm run <script>` | `node --inspect-brk node_modules/.bin/<script> #` |
| `python ` | `python -X dev -m pdb ...` |
| `php` | adds `XDEBUG_MODE=debug` and `XDEBUG_SESSION=1` to the environment (needs Xdebug installed) |

## Manage running processes

Each configuration runs in its own terminal tab, and running it again reuses that tab. End it with <kbd>Ctrl+C</kbd> in the terminal, **Stop**, or **Stop all**. The **Problems** tab lists problems the editor finds; the **Debug Console** records the commands AstaIDE ran.

## Expected result

Clicking **Run** opens a terminal that prints your server's start-up output, for example `Server running on [http://127.0.0.1:8000]`.

## Common problems

- **"No run configuration detected":** add one with **+**, or open the project root folder.
- **The command is not found:** install the tool ([PHP, Python and Node.js Not Found](../troubleshooting/runtimes.md)).
- **Port already in use:** stop the earlier run, or change the port in the command (`php artisan serve --port=8001`).

## Related

- [Laravel and Artisan](laravel.md)
- [Run Commands](../terminal/run-commands.md)
