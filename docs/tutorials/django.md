Create a Django project with its own virtual environment, run it from AstaIDE, tune the editor and use Git.

## Requirements

- AstaIDE and Git installed.
- Python 3 ([Python Not Found](../troubleshooting/runtimes.md#python-not-found) if `python` fails).

## 1. Install Python

Download from [python.org](https://www.python.org/downloads/) (tick **Add python.exe to PATH** on Windows), or `brew install python` / `sudo apt install python3 python3-venv python3-pip`. Check:

```bash
python --version
```

(Use `python3` on macOS and Linux if needed.)

## 2. Create and open the project

Option A: the wizard. Command Palette, **New Project…**, type **django**, name `mysite`. AstaIDE creates the folder, a `.venv`, installs Django and runs `django-admin startproject`.

Option B: by hand in a terminal:

```bash
mkdir mysite
cd mysite
python -m venv .venv
```

Open the folder in AstaIDE (<kbd>Ctrl+O</kbd>).

## 3. Activate the virtual environment

In the AstaIDE terminal (<kbd>Ctrl+`</kbd>):

```bash
.venv\Scripts\Activate.ps1        # Windows PowerShell
.venv\Scripts\activate.bat        # Windows CMD
source .venv/bin/activate         # macOS and Linux
source .venv/Scripts/activate     # Git Bash on Windows
```

The prompt now starts with `(.venv)`.

## 4. Install dependencies and start the project

```bash
pip install django
pip freeze > requirements.txt
django-admin startproject config .
python manage.py migrate
```

(`startproject config .` creates `manage.py` right in the folder, which is what AstaIDE detects. Skip this line if the wizard already did it.)

## 5. Run the server

Open **Run and Debug** (<kbd>Ctrl+Shift+D</kbd>): *Detected: django*. Click **Run**, or run it yourself:

```bash
python manage.py runserver
```

Open http://127.0.0.1:8000 for Django's welcome page. The **Django** list in Run and Debug has `makemigrations`, `migrate`, `createsuperuser` and `shell` one click away.

> **Note:** a run configuration uses whichever `python` the terminal finds. If you click **Run** from a terminal without the environment active, add a configuration with the command `.venv\Scripts\python manage.py runserver` (macOS and Linux: `.venv/bin/python manage.py runserver`).

## 6. Customize the editor

```json
{
  "tabSize": 4,
  "insertSpaces": true,
  "trimWhitespace": true,
  "finalNewline": true,
  "fontSize": 15,
  "autoSave": "onFocusChange"
}
```

Install **Python Snippets** and **Django Snippets** from the Extensions view.

## 7. Use Git

1. Create a `.gitignore` in the project root:

```text
.venv/
__pycache__/
db.sqlite3
.env
```

2. Source Control (<kbd>Ctrl+Shift+G</kbd>), **Initialize Repository**.
3. **Generate** a message (or type `chore: Initial Django project`) and commit; confirm **Stage all & commit**.
4. Make a branch: branch name, **＋ Create new branch…**, `feature/home-page`.
5. Edit `config/urls.py`, stage, commit, and merge back from the **Branches** tab (right-click, **Merge into main**).

## Expected result

Django runs at http://127.0.0.1:8000, your dependencies are recorded in `requirements.txt`, and your work is committed on a branch.

## Common problems

- **PowerShell refuses to run `Activate.ps1`:** `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use CMD.
- **"No module named django":** the environment is not active in that terminal.
- **Run says no configuration:** open the folder that contains `manage.py`.

## Related

- [Python and Django Setup](../run-debug/python-django.md)
- [Customize AstaIDE for Python and Django](../advanced-guides/python-django.md)
