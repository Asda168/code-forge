AstaIDE edits SQL and runs your database tools in its terminal. It does not include a graphical database browser.

## Extensions

Install **SQL Snippets** and **MySQL Snippets**. Files ending in `.sql` get SQL highlighting.

## Settings

```json
{
  "tabSize": 2,
  "insertSpaces": true,
  "wordWrap": false,
  "finalNewline": true
}
```

## Project layout

```text
database/
  schema.sql
  seed.sql
  queries/
    reports.sql
```

Commit these files so the schema is versioned with the code.

## Run SQL

```bash
mysql -u root -p app_db < database/schema.sql
psql -U postgres -d app_db -f database/schema.sql
sqlite3 app.db < database/schema.sql
```

Framework tools read your connection settings for you:

```bash
php artisan migrate
python manage.py migrate
```

## Keep secrets out of Git

Store passwords in `.env` and add `.env` to `.gitignore`. Never paste real credentials into `.sql` files.

## Tips

- Split the terminal (<kbd>Ctrl+Shift+5</kbd>) and keep a database session open beside the editor.
- Use **Find in Files** (<kbd>Ctrl+Shift+F</kbd>) to find every query that touches a table.
- Review migrations in Source Control's diff viewer before committing.

## Expected result

You edit `.sql` with snippets and run files with one terminal command.

## Related

- [SQL and MySQL Workflow](../run-debug/sql-mysql.md)
- [Snippet Extensions](../extensions/snippets.md)
