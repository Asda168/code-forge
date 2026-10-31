Tune syntax colours, the editor font and spacing from the Settings page or `settings.json`.

## Customize editor colors

Syntax colours can be overridden for seven token groups with `tokenColors` (Settings, **Editor**, **Syntax colors** has a colour picker for each):

| Key | Colours |
|---|---|
| `comment` | Comments and doc comments |
| `class` | Classes and types |
| `function` | Functions and methods |
| `keyword` | Keywords and control keywords |
| `string` | Strings and escapes |
| `number` | Numbers |
| `variable` | Variables and predefined variables |

```json
{
  "tokenColors": {
    "comment": "#6b7280",
    "keyword": "#c4a7ff",
    "string": "#9be39b"
  }
}
```

Clear one by removing its line; set `"tokenColors": {}` to go back to the theme's colours.

## Customize font family

```json
{ "fontFamily": "JetBrains Mono" }
```

Default `JetBrains Mono` (bundled). Any font installed on your computer works if you use its exact name. Use a monospace font for code.

## Customize font size

```json
{ "fontSize": 16 }
```

Default `14`. Or zoom with <kbd>Ctrl+=</kbd> / <kbd>Ctrl+-</kbd> and reset with <kbd>Ctrl+0</kbd>.

## Customize line height

```json
{ "lineHeight": 1.7 }
```

Default `1.5`: a multiplier of the font size.

## More font options

| Key | Meaning | Values | Default |
|---|---|---|---|
| `fontWeight` | Text weight | `"300"`, `"400"`, `"500"`, `"700"` | `"400"` |
| `letterSpacing` | Extra pixels between letters | number (about -2 to 5) | `0` |
| `ligatures` | Combine characters like `=>` | `true` / `false` | `true` |
| `smoothFonts` | Smooth font rendering | `true` / `false` | `true` |

## Before and after

| Setting | Before | After |
|---|---|---|
| `fontSize` 14, `lineHeight` 1.5 | Compact, default | |
| `fontSize` 16, `lineHeight` 1.7 | | Larger, airier text, easier on the eyes |

The Settings page shows a live preview of the font while you change it.

## Reset

The Settings page has a **Reset** button for the editor font group. In `settings.json`, delete the keys or set the defaults:

```json
{ "fontFamily": "JetBrains Mono", "fontSize": 14, "fontWeight": "400", "lineHeight": 1.5, "letterSpacing": 0, "ligatures": true }
```

## Expected result

The editor updates as you change a value (no restart).

## Common problems

- **Font not applied:** it is not installed or the name is misspelled.
- **Ligatures look odd:** set `"ligatures": false`.

## Related

- [Change the Color Theme](color-theme.md)
- [Settings Reference](../settings/reference.md)
