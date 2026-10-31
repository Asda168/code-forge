Diagnose extensions, speed, drawing glitches and crashes, and reset when needed.

## Extensions Not Loading

1. Open the Extensions view and look for a row with a **red error message**: it names the problem (invalid `id`, file not found, bad JSON).
2. Check the extension is **enabled** (not listed in `disabledExtensions`).
3. For URL extensions the address must be `https://`, point at a JSON file and be under 1 MB.
4. After editing `settings.json` or a manifest, run **Reload Extensions (download from settings.json)** from the Command Palette.
5. If `settings.json` itself is invalid JSON, AstaIDE shows "settings.json is not valid JSON" and keeps the previous settings; fix the syntax first.

## Editor Performance Problems

- Open the project's **root folder**, not a parent that contains many projects.
- Close tabs you do not need (**Close Saved** on the tab bar).
- Switch off costly visuals:

```json
{
  "minimap": false,
  "bracketColors": false,
  "stickyScroll": false,
  "ligatures": false
}
```

- Very large files are slower in any editor; open them with a terminal tool such as `less`.
- Huge folders such as `node_modules` and `vendor` are skipped by search; keep them out of the project root if you can.

## UI Rendering Problems

For blank areas, flicker or garbled drawing:

1. Update your graphics driver and the operating system.
2. Reselect a theme (<kbd>Ctrl+K</kbd> <kbd>Ctrl+T</kbd>), for example the default `monokai-dimmed`.
3. Reset the layout: double-click the panel edge, and drag the sidebar edge back.
4. Try software rendering by starting AstaIDE with the standard Chromium switch from a terminal, for example `Asta.exe --disable-gpu` (Windows) or `./Asta.AppImage --disable-gpu` (Linux).
5. Reset the application settings (below).

## Application Crashes

1. Reopen AstaIDE; unsaved work is protected by auto save (default after 1 second).
2. Look at the local error log, `logs/errors.log` in AstaIDE's data folder ([Backup, Restore and Reset](../settings/backup-reset.md#where-your-configuration-lives)). It stays on your computer.
3. Rename `settings.json` to see whether a setting causes it.
4. Reinstall the latest version ([download page](/#download)).
5. Report it on [GitHub issues](https://github.com/Asda168/code-forge/issues) with the version, your OS and the log lines around the crash (remove anything private).

## Reset Application Settings

Quit AstaIDE, rename `settings.json` (and `keyboard.json` if shortcuts are involved) in the data folder, and start again. Full steps: [Backup, Restore and Reset](../settings/backup-reset.md#reset-to-default-settings).

## Expected result

The problem goes away, or you have a log and version to attach to a bug report.

## Related

- [Troubleshoot Terminal Issues](../terminal/troubleshooting.md)
- [Settings Reference](../settings/reference.md)
