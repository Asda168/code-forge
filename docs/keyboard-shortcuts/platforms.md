One set of defaults covers all three systems. The only difference is the modifier name.

## Windows shortcuts

| Notation | Key |
|---|---|
| `mod` / Ctrl/Cmd | <kbd>Ctrl</kbd> |
| `alt` | <kbd>Alt</kbd> |

Example: Quick Open is <kbd>Ctrl+P</kbd>, Toggle Terminal is <kbd>Ctrl+`</kbd>.

## macOS shortcuts

| Notation | Key |
|---|---|
| `mod` / Ctrl/Cmd | <kbd>Cmd</kbd> |
| `ctrl` | <kbd>Ctrl</kbd> |
| `alt` | <kbd>Option</kbd> |

Example: Quick Open is <kbd>Cmd+P</kbd>, Settings is <kbd>Cmd+,</kbd>. Some shortcuts are defined with an explicit `ctrl`, for example Show Source Control (<kbd>Ctrl+Shift+G</kbd>) and Next Editor (<kbd>Ctrl+Tab</kbd>), so they use <kbd>Ctrl</kbd> on macOS too.

## Linux shortcuts

Same as Windows: `mod` is <kbd>Ctrl</kbd>, `alt` is <kbd>Alt</kbd>. Your desktop environment may reserve some combinations (for example <kbd>Ctrl+Alt+Arrow</kbd> for workspaces); change them in your system settings or remap the AstaIDE command.

## Menu shortcuts are labels

Menu items show the current shortcut, but the keys are handled by one central handler, not by the operating system's menu. That is why remapping in `keyboard.json` takes effect everywhere and the menu labels follow.

## In the terminal

Keys the shell needs (<kbd>Ctrl+C</kbd>, <kbd>Ctrl+D</kbd>, <kbd>Ctrl+L</kbd>, <kbd>Ctrl+R</kbd>, <kbd>Ctrl+W</kbd>, <kbd>Ctrl+A</kbd>, <kbd>Ctrl+E</kbd>, <kbd>Ctrl+K</kbd>, <kbd>Ctrl+U</kbd>) are left to the shell, which is why the terminal shortcuts use <kbd>Ctrl+Shift</kbd> combinations.

## Expected result

The same actions are reachable with the matching modifier on every system.

## Common problems

- **A shortcut does nothing on macOS:** it may be taken by macOS; remap it ([Customize Shortcuts](customize.md)).
- **Non-US keyboard layouts:** keys such as `` ` `` and `\` can be in different places; remap to a key you can type.

## Related

- [Complete Shortcut Reference](reference.md)
- [Customize Shortcuts and Resolve Conflicts](customize.md)
