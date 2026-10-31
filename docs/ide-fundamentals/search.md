AstaIDE has two kinds of search: **Find** inside the current file, and **Find in Files** across the whole project.

## Find and replace in a file

- <kbd>Ctrl+F</kbd> opens Find; <kbd>Ctrl+H</kbd> opens Replace.
- Use the toggles in the find box for match case, whole word and regular expression.

## Find in Files

1. Press <kbd>Ctrl+Shift+F</kbd> to open the Search view.
2. Type what to find. Results are grouped by file; click one to jump to the line.
3. Open the details (<kbd>Ctrl+Shift+J</kbd>) to filter which files are included or excluded.

| Option | Shortcut (search focused) |
|---|---|
| Match case | <kbd>Alt+C</kbd> |
| Match whole word | <kbd>Alt+W</kbd> |
| Use regular expression | <kbd>Alt+R</kbd> |
| Toggle search details | <kbd>Ctrl+Shift+J</kbd> |

The view has two layouts, list and tree, and you can open results in a full editor tab with *Search: Open New Search Editor* from the Command Palette.

## Replace in Files

Press <kbd>Ctrl+Shift+H</kbd> (or palette: *Replace in Files*) and enter the replacement text. You can replace a single line, every match in one file, or use **Replace All** (AstaIDE asks you to confirm and tells you how many files it will write).

> **Warning:** replacing across many files changes them on disk. Commit first so you can review the diff in Source Control and undo with Git if needed.

## Regular expression example

Find every `console.log(...)` call:

```text
console\.log\(.*\);?
```

## Expected result

A list of matching lines grouped by file, with the matches highlighted.

## Common problems

- **Nothing is found in a folder you expect:** these folders are skipped on purpose: `node_modules`, `.git`, `vendor`, `__pycache__`, `.venv`, `venv`, `dist`, `build`, `storage` and `.next`. Open the file directly, or search from a terminal, if what you need lives there.
- **A regex matches too much:** turn on *Match whole word* or anchor the pattern with `^` and `$`.

## Related

- [Code Navigation](navigation.md)
- [Complete Shortcut Reference](../keyboard-shortcuts/reference.md)
