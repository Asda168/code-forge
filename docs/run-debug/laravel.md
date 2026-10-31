AstaIDE detects Laravel projects and adds Artisan shortcuts and folder shortcuts to the Run and Debug view.

## Requirements

- PHP and Composer installed (`php -v`, `composer -V`).
- A Laravel project folder (it contains `artisan` and `composer.json`).

## Laravel development setup

```bash
composer create-project laravel/laravel my-app
cd my-app
cp .env.example .env
php artisan key:generate
```

(`composer create-project` already prepares `.env` and the key; the last two lines are for a project you cloned.) Open the folder in AstaIDE: <kbd>Ctrl+O</kbd>.

Then press **Run** (<kbd>F5</kbd>) in Run and Debug. AstaIDE runs:

```bash
php artisan serve
```

and the server is available at http://127.0.0.1:8000.

## Artisan commands

The **Laravel** section of Run and Debug runs these in a new terminal:

| Shortcut | Runs |
|---|---|
| route:list | `php artisan route:list` |
| migrate | `php artisan migrate` |
| optimize:clear | `php artisan optimize:clear` |
| make:model | asks for a name, runs `php artisan make:model <Name>` |
| make:controller | asks for a name, runs `php artisan make:controller <Name>` |
| make:migration | asks for a name, runs `php artisan make:migration <name>` |

Names may contain letters, digits, `_`, `\` and `/` (for example `Admin/UserController`). For anything else, use the terminal: `php artisan tinker`, `php artisan queue:work`, `php artisan test`.

## Jump into your code

Below the Artisan list the view has expandable sections for **Routes**, **Models**, **Controllers**, **Middleware**, **Migrations**, **Views**, **Jobs** and **Events**. They list the files from the standard folders (`routes`, `app/Models`, `app/Http/Controllers`, `app/Http/Middleware`, `database/migrations`, `resources/views`, `app/Jobs`, `app/Events`); click one to open it.

Install the **Laravel** extension for snippets, `.blade` highlighting and <kbd>Ctrl+Click</kbd> / <kbd>F12</kbd> navigation ([Customize AstaIDE for Laravel](../advanced-guides/laravel.md)).

## Expected result

The terminal shows `INFO  Server running on [http://127.0.0.1:8000]` and the Laravel welcome page loads in your browser.

## Common problems

- **`php` is not recognized:** add PHP to your `PATH` and restart AstaIDE ([PHP Not Found](../troubleshooting/runtimes.md#php-not-found)).
- **"No application encryption key has been specified":** run `php artisan key:generate`.
- **Port 8000 is busy:** `php artisan serve --port=8001` (create a custom run configuration with that command).

## Related

- [Tutorial: Build and Ship a Laravel Project](../tutorials/laravel.md)
- [Understanding Run and Debug](overview.md)
