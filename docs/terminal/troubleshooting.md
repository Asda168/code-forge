Most terminal problems come from a missing shell, a missing optional component, or a wrong shell path.

## The terminal will not open

1. Make sure a folder is open and the panel is visible (<kbd>Ctrl+J</kbd>).
2. Open the profile menu (arrow next to **+**). If it is empty, no shell was detected; set the shell path in `settings.json` ([Open the Terminal and Choose a Shell](shells.md#custom-shell-locations)).
3. Try another profile, for example **PowerShell** instead of Git Bash.
4. Restart AstaIDE.

## "node-pty not installed: limited line-mode terminal"

AstaIDE uses the optional `node-pty` component for a full terminal. Without it you get a basic line-oriented terminal (no full-screen programs such as `vim` or interactive installers) and a yellow notice at the top.

- **Installed AstaIDE:** reinstall the latest version from the [download page](/#download); installers include the component.
- **Running from source:** run `npm install` in the `desktop/` folder (it installs the optional dependency; it needs build tools available on your platform).

## Git Bash is not listed (Windows)

Install Git for Windows, or point AstaIDE at it: [Git Bash Configuration](../troubleshooting/git.md#git-bash-configuration).

## Garbled or overlapping text

Use a monospace `termFontFamily` (or leave it empty) and reset zoom with <kbd>Ctrl+0</kbd> ([Terminal Font and Appearance](appearance.md)).

## Commands are not found

The terminal inherits your system `PATH`. If you installed PHP, Python or Node.js while AstaIDE was open, restart AstaIDE so it picks up the new `PATH` ([PHP, Python and Node.js Not Found](../troubleshooting/runtimes.md)).

## Still stuck?

Check the local error log (`logs/errors.log` inside AstaIDE's data folder; nothing in it is uploaded) and open an issue on [GitHub](https://github.com/Asda168/code-forge/issues). See [Extensions, Performance, Rendering and Crashes](../troubleshooting/application.md).

## Related

- [Multiple Terminals, Split and Resize](panes.md)
- [Reset Application Settings](../settings/backup-reset.md)
