The terminal has its own font and cursor settings, separate from the editor.

## Where to change them

Open Settings, **Terminal**, **Appearance**, or edit `settings.json`:

```json
{
  "termFontFamily": "Cascadia Mono",
  "termFontSize": 14,
  "termLineHeight": 1.3,
  "termCursorStyle": "bar",
  "termCursorBlink": false
}
```

## Settings

| Key | What it does | Values | Default |
|---|---|---|---|
| `termFontFamily` | Terminal font. Empty uses a safe monospace stack | font name or `""` | `""` |
| `termFontSize` | Font size in pixels | number | `13` |
| `termLineHeight` | Line spacing multiplier | number | `1.4` |
| `termCursorStyle` | Cursor shape | `block`, `bar`, `underline` | `block` |
| `termCursorBlink` | Blink the cursor | `true` / `false` | `true` |

## Quick zoom

With the terminal focused, <kbd>Ctrl+=</kbd> increases the font, <kbd>Ctrl+-</kbd> decreases it and <kbd>Ctrl+0</kbd> resets it.

## Colours

The terminal colours follow your selected colour theme ([Change the Color Theme](../themes/color-theme.md)).

## Restore the defaults

Delete the keys you changed from `settings.json`, or set them back to the defaults in the table above.

## Expected result

Terminal text uses the font and cursor you chose immediately, with no restart.

## Common problems

- **Text overlaps or looks uneven:** use a **monospace** font. A proportional font makes characters collide. Leave `termFontFamily` empty to use the built-in fallback stack.
- **The font is ignored:** the font must be installed on your computer under exactly that name.

## Related

- [Sidebar, Terminal and Layout Appearance](../themes/layout.md)
- [Settings Reference](../settings/reference.md)
