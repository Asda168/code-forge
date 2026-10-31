Change any shortcut with a click, or by editing `keyboard.json`.

## Customize shortcuts in the Keyboard Shortcuts tab

1. Press <kbd>Ctrl+K</kbd> then <kbd>Ctrl+S</kbd> (or Settings, **Shortcuts**, or Command Palette, **Preferences: Open Keyboard Shortcuts**).
2. Click the binding of a command.
3. Press the new key combination. Two combinations in a row make a **chord**, such as <kbd>Ctrl+K</kbd> <kbd>Ctrl+T</kbd>.
4. Save. To remove a binding, save it empty.

A **Reset** button on that page restores every default.

## Edit keyboard.json

Run **Preferences: Open keyboard.json** (or Settings, **Shortcuts**, *keyboard.json*). The file lists every command with its default **commented out**; remove the `//` and change the value to override it.

```json
{
  // "toggle-sidebar": "mod+b",
  "toggle-sidebar": "mod+alt+b",
  "save-all": "mod+shift+s",
  "toggle-terminal": ""
}
```

- Keys are the **command ids** from the [reference](reference.md).
- Values are lowercase key combinations joined with `+`: `mod` (Ctrl on Windows/Linux, Cmd on macOS), `ctrl`, `alt`, `shift`, plus a key such as `s`, `f5`, `` ` ``, `\`, `,`, `=`.
- A chord is two combinations separated by a space: `"keyboard-shortcuts": "mod+k mod+s"`.
- An empty string (`""`) **unbinds** the command.
- The file tolerates `//` comment lines, a trailing comma and a missing comma between lines. When you save it, AstaIDE reloads the shortcuts and shows **"Keyboard shortcuts reloaded"**.
- Invalid entries (a bad id, or a value with unsupported characters) are ignored.

Only your overrides are applied; everything else keeps its default.

## Keyboard shortcut conflicts

Two commands cannot share the same key in the same context. When you assign a key that is already used, the tab warns you ("Already used by …. Saving removes it from there") and, if you save, **the other command loses the key** so every shortcut stays unambiguous. It also warns when your key would shadow another shortcut in a different context.

Terminal commands (`term-*`, `clear-terminal`, `term-close-pane`) apply only while the terminal is focused, which is why `Ctrl+=` can zoom the editor in the editor and the terminal in the terminal.

When you edit `keyboard.json` by hand there is no warning, so check [the reference](reference.md) for the id you are changing and unbind the old command with `""` if needed.

## Reset

- **Tab:** the **Reset** button.
- **File:** delete your override lines, or rename `keyboard.json` and reopen it; AstaIDE writes a fresh commented template.

## Expected result

The new key triggers the command immediately, and the menu shows the updated shortcut.

## Common problems

- **Nothing happens when I press my key:** another command holds it, or the combination is reserved by your operating system.
- **A shortcut works in the editor but not in the terminal:** shell keys such as <kbd>Ctrl+C</kbd>, <kbd>Ctrl+D</kbd>, <kbd>Ctrl+L</kbd>, <kbd>Ctrl+R</kbd>, <kbd>Ctrl+W</kbd>, <kbd>Ctrl+A</kbd>, <kbd>Ctrl+E</kbd>, <kbd>Ctrl+K</kbd> and <kbd>Ctrl+U</kbd> stay with the shell while the terminal has focus.

## Related

- [Complete Shortcut Reference](reference.md)
- [Windows, macOS and Linux Differences](platforms.md)
