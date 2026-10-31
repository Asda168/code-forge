AstaIDE is a code editor, not a database client. For SQL it gives you editing, highlighting and snippets, and the integrated terminal runs your database's command-line tools.

## Requirements

- A database server and its command-line client, for example MySQL (`mysql --version`).
- Optional: the **SQL Snippets** and **MySQL Snippets** extensions.

## Edit SQL

1. Create a file ending in `.sql`.
2. Install **SQL Snippets** (common statements) and **MySQL Snippets** (MySQL specifics) from the Extensions view.
3. Type a snippet prefix and press <kbd>Tab</kbd> (see the extension's page in the Extensions view for its prefixes).

## Run SQL from the terminal

```bash
# run a file against a database
mysql -u root -p my_database < schema.sql

# open an interactive session
mysql -u root -p
```

For Laravel and Django projects use their own tools, which read your connection settings:

```bash
php artisan migrate
python manage.py migrate
```

## A simple workflow

1. Keep `schema.sql` and `seed.sql` in your project and commit them with Git.
2. Open a terminal split (<kbd>Ctrl+Shift+5</kbd>) with a `mysql` session next to the editor.
3. Re-run `source schema.sql;` inside the session after each change.

## Expected result

Statements typed or sourced from a file run and print their results in the terminal.

## Common problems

- **`mysql` is not recognised:** add MySQL's `bin` folder to your `PATH` and restart AstaIDE ([PATH problems](../troubleshooting/runtimes.md)).
- **Access denied:** check the user and password; never commit passwords to Git.

## Related

- [Customize AstaIDE for Database Development](../advanced-guides/database.md)
- [Snippet Extensions](../extensions/snippets.md)
