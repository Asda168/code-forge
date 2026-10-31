AstaIDE detects Django projects (`manage.py`) and plain Python folders. It does not manage Python environments for you: you create and activate a virtual environment in the terminal, and AstaIDE runs commands in that terminal.

## Requirements

- Python 3 (`python --version`; on macOS and Linux this may be `python3`).

## Python development setup

```bash
# create a virtual environment in the project
python -m venv .venv

# activate it
.venv\Scripts\Activate.ps1        # Windows PowerShell
.venv\Scripts\activate.bat        # Windows CMD
source .venv/bin/activate         # macOS and Linux
source .venv/Scripts/activate     # Git Bash on Windows

# install dependencies
pip install -r requirements.txt
```

> **Note:** AstaIDE has no Python interpreter picker. A run configuration uses whichever `python` the terminal finds, so activate the environment in that terminal first (or use `.venv/Scripts/python` in the command).

## Django development setup

1. Open the folder that contains `manage.py`. Run and Debug shows **Detected: django** and **Django Development**.
2. In the terminal: activate the environment and `pip install django` (or `pip install -r requirements.txt`).
3. Press **Run**. AstaIDE runs `python manage.py runserver` at http://127.0.0.1:8000.

The **Django** section of Run and Debug has one-click commands, each run in the terminal:

| Shortcut | Runs |
|---|---|
| runserver | `python manage.py runserver` |
| makemigrations | `python manage.py makemigrations` |
| migrate | `python manage.py migrate` |
| createsuperuser | `python manage.py createsuperuser` |
| shell | `python manage.py shell` |

It also lists your `models.py`, `urls.py` and `views.py` files so you can open them quickly.

## Use the virtual environment in a run configuration

Add a configuration (**+**) so every run uses the environment's Python:

| Field | Value (Windows) |
|---|---|
| Name | `Django (venv)` |
| Command | `.venv\Scripts\python manage.py runserver` |

On macOS and Linux use `.venv/bin/python manage.py runserver`.

## Debug

**Debug** turns `python script.py` into `python -X dev -m pdb script.py`, an interactive debugger in the terminal.

## Expected result

`Starting development server at http://127.0.0.1:8000/` appears in the terminal.

## Common problems

- **`python` not found:** [Python Not Found](../troubleshooting/runtimes.md#python-not-found).
- **PowerShell will not run `Activate.ps1`:** run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use CMD.
- **"No module named django":** the environment is not active in that terminal.

## Related

- [Tutorial: Django from Zero to Running](../tutorials/django.md)
- [Customize AstaIDE for Python and Django](../advanced-guides/python-django.md)
