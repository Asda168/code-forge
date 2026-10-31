A short list of settings and habits that make Python and Django work pleasant in AstaIDE.

## Settings

PEP 8 uses 4 spaces and a trailing newline:

```json
{
  "tabSize": 4,
  "insertSpaces": true,
  "trimWhitespace": true,
  "finalNewline": true,
  "autoSave": "onFocusChange"
}
```

## Extensions

Install **Python Snippets** and **Django Snippets** (models, views, URLs) from the Extensions view.

## Environments

AstaIDE has no interpreter picker, so make the environment part of your routine:

1. `python -m venv .venv` in the project root.
2. Activate it in the terminal (see [Python and Django Setup](../run-debug/python-django.md#python-development-setup)).
3. Add a run configuration that uses the environment's Python explicitly, so it works from any terminal:

| Field | Value (Windows) |
|---|---|
| Name | `Django (venv)` |
| Command | `.venv\Scripts\python manage.py runserver` |

Keep `.venv/` and `db.sqlite3` out of Git with a `.gitignore`:

```text
.venv/
__pycache__/
db.sqlite3
.env
```

## Handy Django shortcuts

The **Django** section of Run and Debug runs `makemigrations`, `migrate`, `createsuperuser` and `shell`, and lists `models.py`, `urls.py` and `views.py`. Use <kbd>Ctrl+P</kbd> and type `models` to jump between apps.

## Debugging

Use **Debug** on a `python` command for `python -X dev -m pdb ...`, or drop `breakpoint()` into the code and run in the terminal.

## Expected result

One click starts the dev server with the right interpreter, and Git stays clean.

## Related

- [Tutorial: Django from Zero to Running](../tutorials/django.md)
- [Python and Django Setup](../run-debug/python-django.md)
