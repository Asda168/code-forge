Every open file has a tab. You can keep several files visible at once by splitting the editor.

## Editor tabs

| Action | How |
|---|---|
| Next / previous tab | <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> |
| Close the current tab | <kbd>Ctrl+W</kbd> |
| Tab menu | Right-click a tab |

The tab menu offers **Close**, **Close Others**, **Close Saved**, **Close All**, **Pin** / **Unpin**, **Split Right**, **Split Down** and **Move to Other Group**. The tab bar also has **Close Saved** and **Close All** buttons; hide them with the *Tab bar buttons* switch in Settings, **Layout** (`tabActions`).

```json
{ "tabActions": false }
```

When there are more tabs than fit, the tab strip scrolls horizontally.

## Split editor

Show two files side by side:

- <kbd>Ctrl+\</kbd> splits the editor to the right.
- Right-click a tab and choose **Split Right** or **Split Down** to send that file to the new group.
- Palette: *Split Editor Right* and *Split Editor Down*.

Each group has its own tabs. Use **Move to Other Group** to move a file between them, and close the last tab of a group to merge back.

## Expected result

Two files visible at once, each with its own tab bar.

## Common problems

- **A tab shows a dot and will not close without asking:** the file has unsaved changes. Save it or turn on auto save ([Understanding the Editor](editor.md#auto-save-and-saving)).
- **Too many tabs:** use **Close Saved** to close every file that has no pending changes.

## Related

- [Code Navigation](navigation.md)
- [Complete Shortcut Reference](../keyboard-shortcuts/reference.md)
