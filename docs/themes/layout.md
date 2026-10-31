Control which parts of the window are visible, and how big they are.

## Customize sidebar appearance

| Setting | Controls | Default |
|---|---|---|
| `sidebar` | Show the sidebar (toggle: <kbd>Ctrl+B</kbd>) | `true` |
| `activityBar` | Show the icon column on the far left | `true` |
| `statusBar` | Show the status bar | `true` |
| `iconTheme` | File icon set: `symbols`, `asta`, `jetbrains`, `badges`, `minimal` | `symbols` |

```json
{ "activityBar": true, "statusBar": true, "iconTheme": "minimal" }
```

The sidebar's **width** is set by dragging its right edge (between about 160 and 640 pixels) and is remembered. On a narrow window AstaIDE limits the sidebar to a share of the window so the editor stays usable.

## Customize terminal appearance

See [Terminal Font and Appearance](../terminal/appearance.md) for `termFontFamily`, `termFontSize`, `termLineHeight`, `termCursorStyle` and `termCursorBlink`.

## Hide the layout header

The top bar (logo and command palette button) can be hidden to give the editor more room:

- Press <kbd>Ctrl+Alt+H</kbd>, or
- Command Palette, **View: Toggle Layout Header**, or
- Settings, **Layout**, *Hide Layout Header*, or edit `settings.json`:

```json
{ "hideHeader": true }
```

Default `false`.

## Tab bar buttons

The **Close Saved** and **Close All** buttons on the tab bar can be hidden:

```json
{ "tabActions": false }
```

## Reset appearance settings

To go back to the default look, delete these keys from `settings.json` (or set the values shown):

```json
{
  "theme": "monokai-dimmed",
  "iconTheme": "symbols",
  "sidebar": true,
  "activityBar": true,
  "statusBar": true,
  "hideHeader": false,
  "tabActions": true,
  "tokenColors": {}
}
```

To reset the **panel height**, double-click the edge above the panel. To reset everything, see [Backup, Restore and Reset](../settings/backup-reset.md).

## Expected result

The window changes immediately as you toggle each option.

## Common problems

- **The activity bar disappeared:** set `"activityBar": true`.
- **The top bar is gone:** press <kbd>Ctrl+Alt+H</kbd> to bring it back.

## Related

- [Interface Overview](../getting-started/interface.md)
- [Settings Reference](../settings/reference.md)
