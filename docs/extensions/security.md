AstaIDE extensions are **declarative JSON only**. They cannot execute code, start processes or read your files, so installing one cannot harm your computer the way a code-running plugin could.

## What an extension can and cannot do

| Can | Cannot |
|---|---|
| Add snippets, colour themes and file associations | Run JavaScript, shell commands or any program |
| Switch on built-in features (`laravel`, `gitlens`, `gitblame`) | Add new features or change how the app behaves |
| Show a description, README text and https screenshots | Read, write or send your source code |

The built-in navigation features are part of AstaIDE itself; an extension can only turn them on by name.

## What is validated

Every manifest is cleaned before it is saved or used:

- `id` must match lowercase letters, digits, `.`, `_`, `-` (max 64 characters).
- Text fields are length-limited (name 80, description 300, version 20, icon 4, readme 4000).
- Colours must be valid hex; invalid values are dropped.
- Theme `ui` keys must be CSS variable names (`--name`); at most 400 syntax rules.
- At most 500 snippets per language; language keys must be simple names.
- File association keys must look like `.ext`; values must be simple language names.
- Screenshots must be `https://` URLs (up to 6).
- Unknown fields are ignored.

## Downloads

- Only `https://` URLs are accepted; `http://` is refused.
- A manifest larger than 1 MB is refused.
- Installed manifests are stored as plain JSON in AstaIDE's data folder (`extensions/<id>.json`), so you can read exactly what was saved.

## Good habits

> **Security:** an extension cannot run code, but it can still change colours and snippets. Install extensions from sources you trust, and read the manifest if it came from a URL you do not know.

- Prefer the bundled catalog.
- Keep `extensions` URLs in `settings.json` under version control for your team.
- Remove extensions you no longer use from the Extensions view.

## Expected result

An invalid or unsafe manifest is rejected with a clear message and nothing is installed.

## Related

- [Create a Custom Extension](create.md)
- [Introduction, Browse, Install and Manage](overview.md)
