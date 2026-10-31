A snippet expands a short **prefix** into a larger block of code, with places for you to tab through.

## Add snippets

In `extension.json`, put snippets under the language they belong to:

```json
{
  "id": "my-snippets",
  "name": "My Snippets",
  "version": "1.0.0",
  "snippets": {
    "php": [
      { "prefix": "route", "body": "Route::get('/$1', [${2:Controller}::class, '${3:index}']);", "description": "Laravel route" },
      { "prefix": "ddv", "body": ["dd(", "\t$1", ");"], "description": "Dump and die" }
    ],
    "javascript": [
      { "prefix": "cl", "body": "console.log($1);", "description": "console.log" }
    ]
  }
}
```

- **Language key:** the editor's language id, such as `php`, `html`, `javascript`, `typescript`, `python`, `sql`, `css`, `json`.
- **`prefix`:** what you type to trigger the snippet.
- **`body`:** a string, or an array of lines that is joined with newlines.
- **`description`:** shown next to the suggestion.

## Placeholders

| Syntax | Meaning |
|---|---|
| `$1`, `$2` | Tab stops, visited in order |
| `${2:name}` | A tab stop with default text |
| `$0` | Final cursor position |
| `\t` | A tab character |

## Use a snippet

Type the prefix in a file of that language, pick the suggestion with <kbd>Enter</kbd> or <kbd>Tab</kbd>, then press <kbd>Tab</kbd> to move between tab stops.

## Limits

Up to 500 snippets per language per extension; `prefix` and `body` must both be present. Language keys may contain letters, digits, `_` and `-`.

## Expected result

Typing `route` in a PHP file offers **Laravel route** and expands to a full route line with tab stops.

## Common problems

- **No suggestion appears:** check the language key matches the file's language (look at the language shown in the status bar) and that the extension is enabled.
- **The snippet is inserted literally with `$1`:** make sure the `body` uses valid snippet syntax and reload extensions.

## Related

- [Create a Custom Extension](create.md)
- [Introduction, Browse, Install and Manage](overview.md)
