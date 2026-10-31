A file association tells the editor which language to use for a file extension.

## Add an association

```json
{
  "id": "template-files",
  "name": "Template Files",
  "version": "1.0.0",
  "fileAssociations": {
    ".tpl": "html",
    ".blade": "html",
    ".env.example": "ini"
  }
}
```

Keys start with a dot and may contain letters, digits, `_`, `.` and `-`. Values are language ids such as `html`, `php`, `javascript`, `json`, `python`, `sql`, `css` or `markdown`.

## Bundled examples

| Extension | Associations |
|---|---|
| Laravel | `.blade` as `html` |
| React | `.jsx`, `.tsx` |
| Vue | `.vue` |
| Git Config Files | `.gitignore`, `.gitattributes` |

## Expected result

Files with that ending get syntax highlighting for the chosen language as soon as the extension loads. The language name appears in the status bar.

## Common problems

- **No effect:** reload extensions and reopen the file; check the extension is enabled.
- **The association is dropped:** the key did not start with `.` or the language id contained invalid characters.

## Related

- [Create a Custom Extension](create.md)
- [Understanding the Editor](../ide-fundamentals/editor.md)
