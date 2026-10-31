The Explorer shows your project's files. Everything you do here goes through AstaIDE's safe file operations: they only work inside the folder you opened.

## Requirements

- An open folder ([Open Your First Project](../getting-started/open-project.md)).

## Create, rename, move and delete files

Right-click a file or folder, or use the buttons at the top of the Explorer (New File, New Folder, Refresh, Collapse All).

| Action | How |
|---|---|
| New file / folder | Right-click, **New File** or **New Folder** |
| Rename | Right-click, **Rename**, or select and press <kbd>F2</kbd> |
| Delete | Right-click, **Delete**, or select and press <kbd>Delete</kbd>. You confirm first and the item goes to the **Trash / Recycle Bin**. |
| Move | Drag the item onto a folder |
| Copy / cut / paste | Select an item and use <kbd>Ctrl+C</kbd>, <kbd>Ctrl+X</kbd>, <kbd>Ctrl+V</kbd> |
| Copy path | Right-click, **Copy Path** or **Copy Relative Path** |
| Show in your file manager | Right-click, **Reveal in File Manager** |
| Open a terminal there | Right-click, **Open in Terminal** or **Open in Git Bash** |

> **Note:** deleted items are moved to the Trash, not erased, so a mistaken delete can be recovered from there.

## Following the active file

When you switch tabs, the Explorer scrolls to and highlights that file. Source Control and search results can also reveal a file in the tree (**Reveal in Explorer**).

## File icons

Icons come from the *Symbols* pack by Miguel Solorio by default. Change them under Settings, **Theme**, *File icon theme* (`iconTheme`): `symbols`, `asta`, `jetbrains`, `badges` or `minimal`.

```json
{ "iconTheme": "minimal" }
```

## Expected result

New files appear instantly in the tree and open in the editor.

## Common problems

- **A new file does not show up:** use the Refresh button; files created outside AstaIDE appear after a refresh.
- **Delete does nothing:** the confirmation was cancelled, or the path is outside the opened folder.

## Related

- [Understanding the Editor](editor.md)
- [Source Control overview](../source-control/overview.md)
