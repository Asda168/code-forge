Extensions add themes, snippets, file associations and a few built-in navigation features. In AstaIDE an extension is a small **JSON file**, so it can never run code on your computer.

![The Extensions view](/shots/extensions.webp)

## Introduction to extensions

Open the Extensions view with <kbd>Ctrl+Shift+X</kbd>. It lists extensions you have installed and a catalog of bundled ones you can install with one click. You can search, and sort by relevance, name, recently installed or installed.

## Browse built-in extensions

| Extension | Adds |
|---|---|
| **Laravel Snippets** | PHP/Blade snippets, `.blade` files as HTML, <kbd>Ctrl+Click</kbd> / <kbd>F12</kbd> Laravel navigation |
| **PHP Snippets** | Common PHP snippets |
| **Python Snippets** / **Django Snippets** | Python helpers; models, views, URLs |
| **JavaScript Snippets** | JS and TS helpers |
| **React Snippets** | Components and hooks; `.jsx` and `.tsx` files |
| **Vue Snippets** | Vue 3 single-file components; `.vue` files |
| **SQL Snippets** / **MySQL Snippets** | Common SQL; MySQL specifics |
| **Git Config Files** | `.gitignore` and `.gitattributes` associations |
| **GitLens** | Line blame, file blame, file and line history, GitLens view |
| **Git Blame** | Who last changed the current line |
| **Forest, Neon Night, Ocean, Paper, Sunset** | Colour themes ([Change the Color Theme](../themes/color-theme.md)) |

## Install extensions

- **From the catalog:** click **Install** on a bundled extension.
- **From a URL:** the **...** menu in the Extensions view, **Install from URL…**, or the Command Palette. Only `https://` URLs to a JSON manifest are accepted (maximum 1 MB).
- **From a local folder or file:** list it under `customExtensions` ([Create a Custom Extension](create.md)).
- **From settings.json:** list URLs under `extensions`, then reload:

```json
{
  "extensions": [
    "https://example.com/my-snippets/extension.json"
  ]
}
```

## Enable and disable extensions

Use the switch on an extension in the Extensions view. Disabled ids are saved in `settings.json`:

```json
{ "disabledExtensions": ["theme-neon", "gitblame"] }
```

Remove an id from the list to enable it again.

## Reload extensions

After editing `extensions`, `customExtensions` or a manifest, run **Reload Extensions (download from settings.json)** from the Command Palette, or **Sync extension sources** in the **...** menu. It downloads every URL in `extensions` and rereads your local manifests; errors are reported in a notice.

## Related settings

| Key | Meaning | Default |
|---|---|---|
| `extensions` | HTTPS manifest URLs to download | `[]` |
| `customExtensions` | Local manifest files or folders | `[]` |
| `disabledExtensions` | Ids that are switched off | `[]` |
| `suggestExtensions` | Suggest extensions for the project type | `true` |
| `dismissedSuggestions` | Suggestions you have dismissed | `[]` |

## Expected result

Installed extensions show an enabled switch; a theme appears in the Color Theme list and snippets show up while typing.

## Common problems

- **"Invalid extension: id must be lowercase letters, digits, . _ -":** fix the `id` field ([extension.json reference](create.md#extension-json-reference)).
- **An extension does not load:** [Extensions Not Loading](../troubleshooting/application.md#extensions-not-loading).

## Related

- [Create a Custom Extension](create.md)
- [Extension Security](security.md)
