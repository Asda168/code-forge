A custom extension is a folder (or a single file) containing an `extension.json` manifest. This page shows the layout and every supported field.

## Requirements

- A text editor (AstaIDE works) and your `settings.json`.

## Extension directory structure

```text
my-extension/
  extension.json
```

That is all. There is no build step and no code. Register the folder in `settings.json`:

```json
{
  "customExtensions": [
    "C:\\Users\\you\\extensions\\my-extension",
    "/home/you/extensions/another.json"
  ]
}
```

An entry may be a **folder** (AstaIDE reads `extension.json` inside it) or a **path to a `.json` file**. Then run **Reload Extensions** from the Command Palette.

## extension.json reference

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "Snippets, a theme and a file type",
  "icon": "MX",
  "color": "#38bdf8",
  "snippets": {
    "php": [
      { "prefix": "dd", "body": "dd($1);", "description": "Dump and die" }
    ]
  },
  "themes": [
    {
      "id": "midnight-blue",
      "name": "Midnight Blue",
      "base": "vs-dark",
      "ui": { "--bg": "#0b1220", "--accent": "#38bdf8" },
      "ed": { "editor.background": "#0b1220" },
      "rules": [{ "token": "comment", "foreground": "6b7280", "fontStyle": "italic" }]
    }
  ],
  "fileAssociations": { ".tpl": "html" },
  "navigation": ["laravel"],
  "readme": "Longer description shown in the Extensions view.",
  "screenshots": [{ "src": "https://example.com/shot.png", "caption": "Dark theme" }]
}
```

| Field | Required | Rules |
|---|---|---|
| `id` | **yes** | Lowercase letters, digits, `.`, `_`, `-`; starts with a letter or digit; up to 64 characters |
| `name` | no | Up to 80 characters (defaults to the id) |
| `version` | no | Up to 20 characters (default `0.0.0`) |
| `description` | no | Up to 300 characters |
| `icon` | no | Up to 4 characters, such as an emoji or initials |
| `color` | no | `#rrggbb` (default purple) |
| `snippets` | no | `{ "<language>": [ { prefix, body, description } ] }`, up to 500 per language ([Snippet Extensions](snippets.md)) |
| `themes` | no | List of themes ([Theme Extensions](themes.md)) |
| `fileAssociations` | no | `{ ".ext": "language" }` ([File Association Extensions](file-associations.md)) |
| `navigation` | no | Built-in features to switch on: `laravel`, `gitlens`, `gitblame` |
| `readme` | no | Plain text, up to 4000 characters; a blank line starts a new paragraph |
| `screenshots` | no | Up to 6 items, **https** image URLs only |

Anything else in the file is ignored.

## Expected result

After reloading, the extension appears in the Extensions view with its icon and description. An invalid manifest shows up with the error message instead of silently failing.

## Common problems

- **The extension shows an error row:** read the message; typically an invalid `id`, a path that does not exist, or JSON with a trailing comma.
- **Windows paths:** double each backslash in JSON (`C:\\Users\\you`), or use forward slashes.

## Related

- [Snippet Extensions](snippets.md), [Theme Extensions](themes.md), [File Association Extensions](file-associations.md)
- [Extension Security](security.md)
