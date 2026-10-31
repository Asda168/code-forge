Everything you configure is stored in a few small files. Copy them to back up or move your setup, delete them to start fresh.

## Where your configuration lives

AstaIDE's data folder:

| System | Location |
|---|---|
| Windows | `%APPDATA%\Asta` |
| macOS | `~/Library/Application Support/Asta` |
| Linux | `~/.config/Asta` |

Inside it:

| File or folder | Contains |
|---|---|
| `settings.json` | All settings and extension lists |
| `keyboard.json` | Your shortcut overrides |
| `extensions/` | Installed extensions (one JSON file each) |
| `recents.json`, `workspaces.json` | Recent projects and saved workspaces |
| `logs/errors.log` | Local error log (never uploaded) |

> **Note:** the quickest way to reach the two main files is from inside AstaIDE: **Open settings.json** and **Preferences: Open keyboard.json** in the Command Palette.

## Back up

1. Quit AstaIDE.
2. Copy `settings.json`, `keyboard.json` and the `extensions` folder to a safe place (cloud drive, Git repository).

Custom extension folders listed in `customExtensions` are separate: copy those too.

## Restore or move to another computer

1. Install AstaIDE on the new machine and start it once, then quit.
2. Copy your files into the same data folder.
3. If `customExtensions` points at folders, put those folders at the same paths (or edit the paths).
4. Start AstaIDE and run **Reload Extensions** from the Command Palette.

## Reset to default settings

Reset one thing:

- Delete the key from `settings.json`.
- Settings page: the **Reset** button of the editor font group, and **Reset** on the Keyboard Shortcuts page for shortcuts.

Reset all settings:

1. Quit AstaIDE.
2. Rename `settings.json` to `settings.json.bak` (keep it in case you want it back).
3. Start AstaIDE; it uses the defaults and writes a fresh file.

Reset shortcuts only: rename `keyboard.json` the same way, or use the Reset button on the Keyboard Shortcuts tab.

Reset the sidebar width and panel height: these are stored by the app, not in `settings.json`; drag them back, or double-click the panel edge to restore its default height.

## Expected result

AstaIDE starts with your restored look and shortcuts, or with the default look after a reset.

## Common problems

- **Settings did not carry over:** the files were copied while AstaIDE was running (it rewrote them). Quit first, copy, then start.
- **Extensions are missing after a move:** `customExtensions` paths are not valid on the new machine.

## Related

- [Backup and Migration Guide](../advanced-guides/backup-migration.md)
- [Settings Reference](reference.md)
