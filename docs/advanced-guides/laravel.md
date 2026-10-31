Turn AstaIDE into a comfortable Laravel workspace with the Laravel extension, a few settings and the right run configurations.

## Requirements

- PHP, Composer and a Laravel project ([Laravel and Artisan](../run-debug/laravel.md)).

## 1. Install the Laravel extension

Extensions view (<kbd>Ctrl+Shift+X</kbd>), install **Laravel Snippets**. It provides:

- Snippets for `php` and `html` files (for example the `route` snippet: `Route::get('/…', [Controller::class, 'index']);`).
- `.blade` files highlighted as HTML.
- **Go to definition** with <kbd>Ctrl+Click</kbd> or <kbd>F12</kbd> on views, classes, controller methods, config keys, route names, Blade components and asset paths. It reads your `composer.json` PSR-4 map, so custom namespaces work.

## 2. Recommended settings

```json
{
  "tabSize": 4,
  "insertSpaces": true,
  "finalNewline": true,
  "trimWhitespace": true,
  "wordWrap": false,
  "autoSave": "afterDelay"
}
```

PSR-12 uses 4 spaces and a final newline, which these settings match. Blade templates are often 2 or 4 spaces; keep one style per project.

## 3. Run configurations for a Laravel app

The detected **Laravel Development** (`php artisan serve`) is ready. Add the rest in Run and Debug (**+**):

| Name | Command |
|---|---|
| Queue worker | `php artisan queue:work` |
| Vite dev server | `npm run dev` |
| Tests | `php artisan test` |
| Serve on 8001 | `php artisan serve --port=8001` |

Set *Environment* to `APP_ENV=local` if you want to force it for one configuration.

## 4. Daily workflow

1. <kbd>F5</kbd> to start the server; keep it in its own terminal tab.
2. Use the **Artisan** shortcuts for `migrate`, `route:list` and `make:*`.
3. <kbd>Ctrl+Shift+5</kbd> to split a terminal for `php artisan tinker`.
4. Commit often in Source Control; use **Generate** for a first draft of each message.

> **Note:** keep `.env` out of Git. Laravel's default `.gitignore` already does.

## Expected result

<kbd>Ctrl+Click</kbd> on `view('welcome')` opens `resources/views/welcome.blade.php`, and the Laravel section lists your routes, models and controllers.

## Related

- [Tutorial: Build and Ship a Laravel Project](../tutorials/laravel.md)
- [Snippet Extensions](../extensions/snippets.md)
