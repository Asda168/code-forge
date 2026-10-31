Run several terminals at once, split one into panes, and size the panel to fit your screen.

## Create multiple terminals

Click **+** in the panel title bar or press <kbd>Ctrl+Shift+`</kbd>. Each terminal appears as a tab next to *Terminal / Problems / Debug Console*; click a tab to switch, and use the trash button (*Kill terminal*) to end the current one.

## Split a terminal

| Action | Shortcut |
|---|---|
| Split right | <kbd>Ctrl+Shift+5</kbd> |
| Split down | <kbd>Ctrl+Shift+6</kbd> |
| Close the focused pane | <kbd>Ctrl+Shift+W</kbd> (terminal focused) |
| Clear the terminal | <kbd>Ctrl+Shift+K</kbd> (terminal focused) |

A split pane starts in the same folder as the pane it came from. On a narrow panel some title-bar buttons collapse into the **more actions** (`...`) menu.

## Resize the terminal

- **Height:** drag the edge between the editor and the panel. Double-click that edge to reset the height to the default.
- **Full height:** the *Maximize / restore panel* arrow makes the panel fill the editor area; click it again to go back.
- **Show / hide:** <kbd>Ctrl+J</kbd>.
- **Zoom one pane:** the *Maximize / restore pane* button enlarges the focused split pane.

AstaIDE keeps the editor at a minimum height, so the panel can never push the editor out of sight on a small window.

## Expected result

Two or more shells running side by side or as tabs, each refitting to its new size when you resize.

## Common problems

- **Text wraps oddly after resizing:** resizing refits the terminal automatically; if it looks off, press <kbd>Ctrl+Shift+K</kbd> to clear and redraw.
- **The panel is hidden:** press <kbd>Ctrl+J</kbd> or <kbd>Ctrl+`</kbd>.

## Related

- [Run Commands](run-commands.md)
- [Complete Shortcut Reference](../keyboard-shortcuts/reference.md)
