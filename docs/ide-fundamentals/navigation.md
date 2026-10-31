Move around a project quickly with Quick Open, Go to Line and Go to Definition.

## Quick Open and Go to Line

- <kbd>Ctrl+P</kbd> (Go to File): type part of a file name and press <kbd>Enter</kbd>.
- <kbd>Ctrl+G</kbd> (Go to Line): jump to a line number.
- <kbd>Ctrl+R</kbd> (Find Project): switch to another recent project.
- <kbd>Ctrl+Shift+P</kbd>: the Command Palette for everything else.

## Go to Definition

Press <kbd>F12</kbd> or <kbd>Ctrl+Click</kbd> a symbol to jump to where it is defined. This works out of the box for JavaScript and TypeScript, and the **Laravel** extension adds definition jumping for PHP projects: views, classes, controller methods, config keys, route names, Blade components and asset paths ([Customize AstaIDE for Laravel](../advanced-guides/laravel.md)).

> **Note:** AstaIDE does not run language servers, so definition support for other languages is limited to what the editor can work out from open files.

## Breadcrumb navigation

AstaIDE does not currently have a breadcrumb bar. Two features cover the same need:

- **Sticky scroll** (`stickyScroll`, on by default) pins the enclosing class or function lines at the top of the editor while you scroll.
- The Explorer **follows the active file**, so you always see where it lives in the tree.

## Code navigation inside a file

- <kbd>Ctrl+F</kbd> to find, then <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd> for next and previous match.
- Code folding arrows in the gutter collapse blocks.
- In the diff viewer, <kbd>F7</kbd> and <kbd>Shift+F7</kbd> jump to the next and previous change.

## Expected result

You can open any file or line in a couple of keystrokes.

## Common problems

- **F12 does nothing:** the language has no definition provider. For Laravel projects install the Laravel extension ([Extensions](../extensions/overview.md)).
- **Quick Open does not find a file:** make sure the file is inside the opened folder.

## Related

- [Search and Replace](search.md)
- [Customize AstaIDE for Laravel](../advanced-guides/laravel.md)
