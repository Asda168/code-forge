The editor is Monaco, the engine behind VS Code, wrapped with AstaIDE's tabs, themes and settings. This page covers the everyday editing features and the settings that control them.

## Understanding the editor

Open any file from the Explorer or with Quick Open (<kbd>Ctrl+P</kbd>). Changes are saved automatically by default (see *Auto save* below). A dot on the tab means the file has unsaved changes.

Useful built-in features: syntax highlighting for many languages, bracket matching, code folding, snippets (from extensions), find and replace, and a read-only diff viewer from Source Control.

## Auto save and saving

| Setting | Values | Default |
|---|---|---|
| `autoSave` | `off`, `afterDelay`, `onFocusChange`, `onWindowChange` | `afterDelay` |
| `autoSaveDelay` | milliseconds (100 to 60000) | `1000` |
| `trimWhitespace` | `true` / `false` | `false` |
| `finalNewline` | `true` / `false` | `false` |

```json
{
  "autoSave": "onFocusChange",
  "trimWhitespace": true,
  "finalNewline": true
}
```

Save manually with <kbd>Ctrl+S</kbd>, save everything with <kbd>Ctrl+Alt+S</kbd>, or toggle auto save from the Command Palette (*Toggle Auto Save*).

## Editor minimap

The minimap is the small overview on the right edge of the editor. Turn it off if you want more room:

```json
{ "minimap": false }
```

Default: `true`. Restore the default by setting it back to `true` or deleting the key.

## Multi-cursor editing

The editor supports the standard Monaco multi-cursor commands:

- <kbd>Alt+Click</kbd> adds a cursor where you click.
- <kbd>Ctrl+Alt+Up</kbd> / <kbd>Ctrl+Alt+Down</kbd> add a cursor on the line above or below.
- <kbd>Ctrl+D</kbd> selects the next occurrence of the current word; <kbd>Ctrl+Shift+L</kbd> selects all occurrences.

On macOS use <kbd>Option</kbd> and <kbd>Cmd</kbd> in place of <kbd>Alt</kbd> and <kbd>Ctrl</kbd>.

## Indentation, wrapping and readability

| Setting | Meaning | Default |
|---|---|---|
| `tabSize` | Spaces per tab | `4` |
| `insertSpaces` | Insert spaces instead of tab characters | `true` |
| `wordWrap` | Wrap long lines | `false` |
| `bracketColors` | Colour matching bracket pairs | `true` |
| `stickyScroll` | Keep the enclosing scope lines pinned at the top | `true` |
| `ligatures` | Font ligatures (for example `=>`) | `true` |

## Zoom the editor font

<kbd>Ctrl+=</kbd> makes the editor font larger, <kbd>Ctrl+-</kbd> smaller and <kbd>Ctrl+0</kbd> resets it. When the **terminal** has focus, the same keys change the terminal font instead.

## Expected result

You can edit, save automatically and change how the editor looks from `settings.json` or the Settings page.

## Common problems

- **The caret jumps or spaces vanish while typing:** update to AstaIDE 1.3.9 or newer, which fixed an auto-save and trim-whitespace interaction.
- **The editor font looks wrong:** the font family must be installed on your computer ([Editor Colors and Fonts](../themes/editor-appearance.md)).

## Related

- [Editor Tabs and Split Editor](tabs-and-split.md)
- [Settings Reference](../settings/reference.md)
