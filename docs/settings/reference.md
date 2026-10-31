Every key AstaIDE reads from `settings.json`, with what it does, the allowed values and its default. The complete default file is at the bottom of this page, generated from the application's source.

## Editor settings

| Key | Description | Values | Default |
|---|---|---|---|
| `fontFamily` | Editor font | font name | `"JetBrains Mono"` |
| `fontSize` | Editor font size (px) | number | `14` |
| `fontWeight` | Text weight | `"300"`, `"400"`, `"500"`, `"700"` | `"400"` |
| `lineHeight` | Line height multiplier | number | `1.5` |
| `letterSpacing` | Extra letter spacing (px) | number | `0` |
| `ligatures` | Font ligatures | `true` / `false` | `true` |
| `smoothFonts` | Smooth font rendering | `true` / `false` | `true` |
| `minimap` | Show the minimap | `true` / `false` | `true` |
| `wordWrap` | Wrap long lines | `true` / `false` | `false` |
| `tabSize` | Spaces per tab | number | `4` |
| `insertSpaces` | Spaces instead of tabs | `true` / `false` | `true` |
| `bracketColors` | Colour bracket pairs | `true` / `false` | `true` |
| `stickyScroll` | Pin enclosing scopes while scrolling | `true` / `false` | `true` |
| `autoSave` | When to save automatically | `"off"`, `"afterDelay"`, `"onFocusChange"`, `"onWindowChange"` | `"afterDelay"` |
| `autoSaveDelay` | Delay for `afterDelay` (ms) | 100 to 60000 | `1000` |
| `trimWhitespace` | Trim trailing whitespace on save | `true` / `false` | `false` |
| `finalNewline` | Ensure a final newline on save | `true` / `false` | `false` |
| `tokenColors` | Syntax colour overrides | object with keys `comment`, `class`, `function`, `keyword`, `string`, `number`, `variable` and `#rrggbb` values | `{}` |

Example: larger, wrapped text with a longer save delay.

```json
{
  "fontSize": 16,
  "wordWrap": true,
  "autoSave": "afterDelay",
  "autoSaveDelay": 2000
}
```

## Terminal settings

| Key | Description | Values | Default |
|---|---|---|---|
| `termFontFamily` | Terminal font (empty = safe fallback stack) | font name | `""` |
| `termFontSize` | Terminal font size (px) | number | `13` |
| `termLineHeight` | Terminal line height | number | `1.4` |
| `termCursorStyle` | Cursor shape | `"block"`, `"bar"`, `"underline"` | `"block"` |
| `termCursorBlink` | Blinking cursor | `true` / `false` | `true` |
| `defaultShell` | Shell for new terminals (empty = auto) | `""`, `"gitbash"`, `"powershell"`, `"cmd"`, `"zsh"`, `"bash"` | `""` |
| `gitBashPath` | Path to Git Bash's `bash.exe` | path or `""` | `""` |
| `powershellPath` | Path to PowerShell | path or `""` | `""` |
| `cmdPath` | Path to `cmd.exe` | path or `""` | `""` |

```json
{
  "defaultShell": "gitbash",
  "gitBashPath": "C:\\Program Files\\Git\\bin\\bash.exe",
  "termFontSize": 14
}
```

## Git settings

| Key | Description | Values | Default |
|---|---|---|---|
| `gitPath` | Path to the `git` program (empty = the one on your system) | path or `""` | `""` |
| `gitDefaultBranch` | Branch name for `Initialize Repository` | branch name | `"main"` |

```json
{ "gitPath": "C:\\Program Files\\Git\\cmd\\git.exe", "gitDefaultBranch": "main" }
```

> **Note:** the defaults also contain a `gitUser` key. No part of the current app reads it; set your Git identity with `git config --global user.name` and `user.email`.

## Appearance and layout settings

| Key | Description | Values | Default |
|---|---|---|---|
| `theme` | Colour theme id | a built-in id or `<extension>.<theme>` | `"monokai-dimmed"` |
| `iconTheme` | File icon set | `"symbols"`, `"asta"`, `"jetbrains"`, `"badges"`, `"minimal"` | `"symbols"` |
| `sidebar` | Show the sidebar | `true` / `false` | `true` |
| `activityBar` | Show the activity bar | `true` / `false` | `true` |
| `statusBar` | Show the status bar | `true` / `false` | `true` |
| `hideHeader` | Hide the top layout header | `true` / `false` | `false` |
| `tabActions` | Show Close Saved / Close All on the tab bar | `true` / `false` | `true` |

## Extension settings

| Key | Description | Default |
|---|---|---|
| `extensions` | HTTPS manifest URLs to download | `[]` |
| `customExtensions` | Local manifest files or folders | `[]` |
| `disabledExtensions` | Extension ids switched off | `[]` |
| `suggestExtensions` | Suggest extensions for the project | `true` |
| `dismissedSuggestions` | Suggestions you dismissed | `[]` |

See [Extensions](../extensions/overview.md).

## Updates

| Key | Description | Default |
|---|---|---|
| `autoUpdate` | Check the release feed for new versions | `true` |

## Internal keys

`gitlensSeeded` and `stickyScrollMigrated` are bookkeeping flags set by AstaIDE. Leave them alone.

## Restore a default

Delete the key from `settings.json` (or set the default shown above). To restore everything, see [Backup, Restore and Reset](backup-reset.md).

## Complete default settings

{{settings-defaults}}

## Related

- [Open, Search and Edit Settings](open-and-edit.md)
- [Customize Shortcuts](../keyboard-shortcuts/customize.md)
