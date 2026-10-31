AstaIDE has a Settings page for everyday options and a plain `settings.json` file for everything, including extensions. Both edit the same settings.

## Open settings

- Press <kbd>Ctrl+,</kbd> (macOS: <kbd>Cmd+,</kbd>), click the gear at the bottom of the activity bar, or run **Open Settings** from the Command Palette.
- The Settings page opens as an editor tab with categories on the left: **Editor**, **Terminal**, **Git**, **Appearance**, **Shortcuts** and **Updates**.

## Search settings

Type in the search box at the top of the Settings page to filter the rows by name or description.

## User settings

Settings are **per user**: they apply to every project you open. Changes you make on the page are saved immediately and applied without a restart.

> **Note:** AstaIDE does not support workspace-level (per-project) `settings.json` files. A few things are remembered per project folder by the app, such as custom run configurations, but they are not stored in `settings.json`.

## Edit settings.json

Click the **settings.json** button on the Settings page, or run **Open settings.json** from the Command Palette. The file opens in the editor.

```json
{
  "theme": "monokai-dimmed",
  "fontSize": 15,
  "autoSave": "afterDelay"
}
```

- It is plain JSON: double quotes, no comments, no trailing commas.
- Save the file; AstaIDE re-reads it, reloads extensions and shows **"settings.json applied"**. If the JSON is invalid you get an error message and nothing changes.
- You only need to list the keys you change. Anything missing uses the default.
- Keys AstaIDE does not know are kept in the file but have no effect. See the [Settings Reference](reference.md) for every supported key.

Where the file lives: a file called `settings.json` in AstaIDE's data folder: `%APPDATA%\Asta` on Windows, `~/Library/Application Support/Asta` on macOS and `~/.config/Asta` on Linux. Use the button above rather than hunting for it.

## Related files

| File | Purpose | Open it with |
|---|---|---|
| `settings.json` | Options and extension lists | **Open settings.json** |
| `keyboard.json` | Shortcut overrides | **Preferences: Open keyboard.json** ([Customize Shortcuts](../keyboard-shortcuts/customize.md)) |

## Configure Git, editor and extension settings

- Git: [Settings Reference, Git](reference.md#git-settings)
- Editor: [Settings Reference, Editor](reference.md#editor-settings)
- Terminal profiles: [Open the Terminal and Choose a Shell](../terminal/shells.md)
- Extensions: [Settings Reference, Extensions](reference.md#extension-settings)

## Expected result

A change in the file or on the page takes effect immediately.

## Common problems

- **"settings.json is not valid JSON":** look for a missing comma or an extra trailing comma near the line named in the message.
- **A value has no effect:** check the key spelling against the reference; keys are case-sensitive.

## Related

- [Settings Reference](reference.md)
- [Backup, Restore and Reset](backup-reset.md)
