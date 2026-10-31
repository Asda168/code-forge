In about twenty minutes you will install the tools, create a Laravel app, run it, make a change on a feature branch and commit it, then tune the editor.

## Requirements

- Windows, macOS or Linux with AstaIDE installed ([Download and Installation](../getting-started/install.md)).
- Git installed.

## 1. Install PHP and Composer

| System | Commands |
|---|---|
| Windows | Install PHP (from [windows.php.net](https://windows.php.net/download/) or a bundle such as Laragon) and [Composer](https://getcomposer.org/download/); make sure `php` is on your `PATH` |
| macOS | `brew install php composer` |
| Ubuntu / Debian | `sudo apt install php-cli php-mbstring php-xml php-curl php-sqlite3 unzip composer` |

Check in any terminal:

```bash
php -v
composer -V
```

## 2. Open AstaIDE and create the project

1. Start AstaIDE.
2. Command Palette (<kbd>Ctrl+Shift+P</kbd>), **New Project…**.
3. Type **laravel**, name it `blog`, choose a location, **Create Project**. AstaIDE runs:

```bash
composer create-project laravel/laravel "blog"
```

When it finishes, the `blog` folder opens. (Or run that command yourself in a terminal and open the folder with <kbd>Ctrl+O</kbd>.)

## 3. Configure the terminal

Press <kbd>Ctrl+`</kbd>. On Windows pick PowerShell or Git Bash from the arrow next to **+**, and set it as the default if you like:

```json
{ "defaultShell": "powershell" }
```

## 4. Run the app

Open **Run and Debug** (<kbd>Ctrl+Shift+D</kbd>). It says *Detected: laravel*. Click **Run** (or press <kbd>F5</kbd>). The terminal runs:

```bash
php artisan serve
```

Open http://127.0.0.1:8000: the Laravel welcome page appears. Use **migrate** or **route:list** from the Artisan list when you need them.

## 5. Put the project under Git

If the folder is not a repository yet, open Source Control (<kbd>Ctrl+Shift+G</kbd>) and click **Initialize Repository**. Laravel's `.gitignore` already excludes `vendor/` and `.env`.

1. Click **Generate**, or type `chore: Initial Laravel project`.
2. Press **Commit**. AstaIDE asks to stage everything because nothing is staged; confirm with **Stage all & commit**.

## 6. Create a branch and make a change

1. Click the branch name at the top of Source Control, **＋ Create new branch…**, type `feature/hello` and **Create & checkout**.
2. Open `routes/web.php` and add:

```php
Route::get('/hello', function () {
    return 'Hello from AstaIDE';
});
```

3. Save (auto save does it after a second), run the app and visit http://127.0.0.1:8000/hello.

## 7. Commit the change

1. In Source Control click **+** on `routes/web.php` to stage it.
2. Click **Generate** (expect something like `Update web.php`) and improve it to `feat: Add /hello route`.
3. Press <kbd>Ctrl+Enter</kbd> to commit.

## 8. Switch branches and merge

1. Open the footer **Branches** tab and click `main` (or `master`) to check it out; the `/hello` route disappears.
2. Right-click `feature/hello`, **Merge into main**, and confirm. The route is back.
3. Optional: with a remote added, press **Publish Branch** or **Sync Changes** ([Remotes](../source-control/remotes-sync.md)).

## 9. Customize the editor

Open Settings (<kbd>Ctrl+,</kbd>) or `settings.json`:

```json
{
  "theme": "monokai-dimmed",
  "fontFamily": "JetBrains Mono",
  "fontSize": 15,
  "lineHeight": 1.6,
  "tabSize": 4,
  "finalNewline": true,
  "trimWhitespace": true
}
```

Pick another theme with <kbd>Ctrl+K</kbd> <kbd>Ctrl+T</kbd>. Install **Laravel Snippets** from the Extensions view for the `route` snippet and <kbd>Ctrl+Click</kbd> navigation.

## Expected result

A running Laravel app, a `feature/hello` branch merged into your main branch, and an editor set up your way.

## Common problems

- **`php` is not recognized:** [PHP Not Found](../troubleshooting/runtimes.md#php-not-found).
- **Port 8000 busy:** run `php artisan serve --port=8001`.
- **Checkout is blocked by local changes:** commit or **Stash changes** first ([Stash](../source-control/conflicts-stash.md#stash-work-in-progress)).

## Related

- [Laravel and Artisan](../run-debug/laravel.md)
- [Customize AstaIDE for Laravel](../advanced-guides/laravel.md)
