Plain PHP projects run with PHP's built-in web server. AstaIDE detects them when the folder has an `index.php` (or `public/index.php`) and no other project type.

## Requirements

- PHP 7.4 or newer on your `PATH` (`php -v`).

## PHP development setup

1. Open your project folder.
2. In Run and Debug you should see **Detected: php** and a **PHP built-in server** configuration.
3. Click **Run**. AstaIDE runs:

```bash
php -S localhost:8000
```

4. Open http://localhost:8000.

To serve a `public` folder instead, add your own run configuration:

| Field | Value |
|---|---|
| Name | `PHP public` |
| Command | `php -S localhost:8000 -t public` |
| Working Directory | `${workspaceFolder}` |

## Snippets and highlighting

Install the **PHP Snippets** extension (Extensions view) for common snippets in `php` files.

## Debug with Xdebug

If Xdebug is installed and configured in your `php.ini`, the **Debug** button starts the command with `XDEBUG_MODE=debug` and `XDEBUG_SESSION=1` in the environment. AstaIDE does not include a PHP debugger front end; use Xdebug's output or an external client.

## Expected result

The terminal prints `PHP ... Development Server (http://localhost:8000) started` and your page loads.

## Common problems

- **404 for every page:** the document root is wrong; use `-t public` or run from the folder that contains `index.php`.
- **`php` not found:** [PHP Not Found](../troubleshooting/runtimes.md#php-not-found).

## Related

- [Laravel and Artisan](laravel.md)
- [Understanding Run and Debug](overview.md)
