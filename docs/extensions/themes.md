A theme extension defines UI colours, editor colours and optional syntax rules. Once loaded, it appears in the Color Theme picker.

## Define a theme

This is the bundled *Forest* theme, trimmed:

```json
{
  "id": "theme-forest",
  "name": "Forest Theme",
  "version": "1.0.0",
  "themes": [
    {
      "id": "forest",
      "name": "Forest",
      "base": "vs-dark",
      "ui": {
        "--bg": "#0d1a14",
        "--side": "#10231a",
        "--panel": "#0e1d16",
        "--border": "#1a3a2a",
        "--hover": "#17332a",
        "--sel": "#1f4a37",
        "--accent": "#4ade80",
        "--cyan": "#86efac"
      },
      "ed": {
        "editor.background": "#0d1a14",
        "editor.lineHighlightBackground": "#12281d"
      }
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | Letters, digits, `.`, `_`, `-`. The theme's full id becomes `<extension id>.<theme id>`, for example `theme-forest.forest` |
| `name` | Name shown in the picker |
| `base` | `vs` (light), `vs-dark` or `hc-black`; supplies every colour you leave out |
| `ui` | App colours: CSS variable names starting with `--`, values as hex colours (`#rgb` up to `#rrggbbaa`) |
| `ed` | Editor colours: [Monaco colour ids](https://code.visualstudio.com/api/references/theme-color) such as `editor.background`, values as hex colours |
| `rules` | Syntax colours: `{ "token": "comment", "foreground": "6b7280", "fontStyle": "italic" }`; `foreground` is 6 hex digits **without** `#`; `fontStyle` uses `italic`, `bold`, `underline` |

Up to 400 rules per theme. Colours that are not valid hex are dropped.

## Select your theme

1. Reload extensions ([Introduction, Browse, Install and Manage](overview.md#reload-extensions)).
2. Press <kbd>Ctrl+K</kbd> then <kbd>Ctrl+T</kbd> and choose the theme.

The choice is saved as the `theme` setting, for example `"theme": "theme-forest.forest"`.

## Import a VS Code theme

Run **Preferences: Import VS Code Theme…** from the Command Palette and pick a VS Code theme `.json` file. AstaIDE converts it with the same checks and saves it as an extension.

## Expected result

The picker lists your theme; selecting it recolours the window and editor immediately.

## Common problems

- **Part of the window keeps the old colour:** that variable is missing from `ui`; add it (see the list above).
- **A colour is ignored:** it was not a valid hex value.

## Related

- [Change the Color Theme](../themes/color-theme.md)
- [Create a Custom Extension](create.md)
