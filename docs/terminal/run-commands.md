The terminal is a normal shell: type a command and press <kbd>Enter</kbd>. AstaIDE also runs project tasks in terminals for you.

## Type commands yourself

```bash
git status
npm install
php artisan migrate
python manage.py makemigrations
```

The terminal starts in the folder you opened, so commands run against your project.

## Run project tasks

The **Run and Debug** view and the *Run* shortcut (<kbd>F5</kbd>) start your project's command in a terminal named after the run configuration (for example *Laravel Development*). Running the same configuration again reuses that terminal. Use <kbd>Shift+F5</kbd> to stop and <kbd>Ctrl+Shift+F5</kbd> to restart. See [Understanding Run and Debug](../run-debug/overview.md).

## Start a terminal in a folder

Right-click a folder in the Explorer, then **Open in Terminal** (default shell) or **Open in Git Bash**.

## Copy and paste

- **Copy:** select text, then press <kbd>Ctrl+C</kbd>. With nothing selected, <kbd>Ctrl+C</kbd> interrupts the running command, as in any terminal.
- **Paste:** <kbd>Ctrl+V</kbd>, <kbd>Ctrl+Shift+V</kbd> or <kbd>Shift+Insert</kbd>.
- **Drop a file or folder** from the Explorer onto the terminal to insert its path.

## Safety

Typing in the terminal is always your own action. When AstaIDE itself is about to run a command that looks destructive (for example `rm -rf /` style commands) it asks for explicit confirmation first.

## Expected result

Command output appears in the panel, and long-running servers keep running until you stop them.

## Common problems

- **A command is "not found":** the tool is not installed or not on your `PATH` ([PHP, Python and Node.js Not Found](../troubleshooting/runtimes.md)).
- **A server will not stop:** press <kbd>Ctrl+C</kbd> in its terminal, or use the **Stop** / **Stop all** buttons in Run and Debug.

## Related

- [Multiple Terminals, Split and Resize](panes.md)
- [Manage Running Processes](../run-debug/overview.md#manage-running-processes)
