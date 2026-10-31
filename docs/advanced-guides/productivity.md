Small habits that make AstaIDE faster to use.

## Learn ten shortcuts first

| Do this | Press |
|---|---|
| Open any file | <kbd>Ctrl+P</kbd> |
| Run any command | <kbd>Ctrl+Shift+P</kbd> |
| Find in all files | <kbd>Ctrl+Shift+F</kbd> |
| Toggle the terminal | <kbd>Ctrl+`</kbd> |
| New terminal | <kbd>Ctrl+Shift+`</kbd> |
| Split the editor | <kbd>Ctrl+\</kbd> |
| Source Control | <kbd>Ctrl+Shift+G</kbd> |
| Run the project | <kbd>F5</kbd> |
| Go to definition | <kbd>F12</kbd> |
| Switch project | <kbd>Ctrl+R</kbd> |

## Use the Command Palette

Almost every setting has a command: toggle auto save, change the theme, open `settings.json`, reload extensions, toggle the header.

## Let auto save work

The default (`afterDelay`, 1 second) means you rarely press save. Use `onFocusChange` if you prefer saves only when you switch away.

## Keep Git tidy

- Commit small and often; use **Generate** as a first draft.
- Keep a `feature/…` branch per task ([Branches](../source-control/branches.md)).
- Use the footer **Commits** tab filter to find an old change by word.
- Use **Stash changes** before switching tasks.

## Make shortcuts yours

Rebind what you use most in `keyboard.json` ([Customize Shortcuts](../keyboard-shortcuts/customize.md)).

## Free up space

- <kbd>Ctrl+B</kbd> sidebar, <kbd>Ctrl+J</kbd> panel, <kbd>Ctrl+Alt+H</kbd> header.
- Maximize the terminal panel for long-running output.

## Save your setup

Back up `settings.json` and `keyboard.json` in a Git repository of your own ([Backup and Migration Guide](backup-migration.md)).

## Related

- [Complete Shortcut Reference](../keyboard-shortcuts/reference.md)
- [Open, Search and Edit Settings](../settings/open-and-edit.md)
