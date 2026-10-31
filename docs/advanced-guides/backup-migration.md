Move AstaIDE to a new computer, or keep a team's setup identical.

## What to carry over

| Item | Where |
|---|---|
| Settings | `settings.json` in the data folder |
| Shortcuts | `keyboard.json` |
| Installed extensions | `extensions/` folder (or the `extensions` URL list in `settings.json`) |
| Your own extensions | The folders in `customExtensions` |

The data folder is `%APPDATA%\Asta` (Windows), `~/Library/Application Support/Asta` (macOS) or `~/.config/Asta` (Linux). Details: [Backup, Restore and Reset](../settings/backup-reset.md).

## Keep your setup in a Git repository

```bash
mkdir asta-config && cd asta-config
git init
cp "<data folder>/settings.json" "<data folder>/keyboard.json" .
git add . && git commit -m "My AstaIDE setup"
```

On a new machine: install AstaIDE, start and quit once, copy the files back, start again.

## Make extensions portable

Rather than copying the `extensions/` folder, list sources in `settings.json` so one command reinstalls everything:

```json
{
  "extensions": ["https://example.com/my-snippets/extension.json"],
  "customExtensions": ["/home/you/asta-config/my-extension"]
}
```

Then run **Reload Extensions** from the Command Palette.

## Share with a team

Commit a shared `settings.json` (without personal paths such as `gitBashPath`) and an extension folder to your repository, and ask teammates to point `customExtensions` at it.

## Per-project items

Custom run configurations belong to each project folder and live in the app, not in `settings.json`; re-create them on the new computer (they are only a name, a command, a folder and variables).

## Expected result

On the new machine the theme, fonts, shortcuts and extensions match your old setup.

## Related

- [Backup, Restore and Reset](../settings/backup-reset.md)
- [Extensions overview](../extensions/overview.md)
