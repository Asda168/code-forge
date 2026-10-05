// Laravel navigation: Ctrl+click (or F12) on views, classes, controller methods, config keys, route names,
// Blade components and asset paths jumps to the file. Turned on by an enabled extension whose manifest lists
// "navigation": ["laravel"]; the logic is built into the editor, so extensions themselves stay declarative.
(() => {
  const { S } = CF;
  const norm = (p) => p.replace(/\\/g, '/');
  const SEP = () => (S.platform.platform === 'win32' ? '\\' : '/');
  const abs = (rel) => S.root.replace(/[\\/]+$/, '') + SEP() + rel.split('/').join(SEP());
  const read = async (rel) => (await cf.fs.read(abs(rel))).text;

  // ---- project index (file list + composer psr-4 map), refreshed lazily ----------------------------
  const idx = { root: null, set: new Set(), lower: new Map(), byBase: new Map(), at: 0, loading: null, psr4: [{ prefix: 'App\\', dir: 'app/' }] };
  function refresh() {
    if (!S.root) return Promise.resolve();
    if (idx.loading) return idx.loading;
    const root = S.root;
    idx.loading = (async () => {
      const files = (await cf.fs.files(root)).map(norm);
      idx.root = root; idx.at = Date.now(); idx.set = new Set(files);
      idx.lower = new Map(files.map((f) => [f.toLowerCase(), f])); idx.byBase = new Map();
      for (const f of files) if (f.endsWith('.php')) { const b = f.slice(f.lastIndexOf('/') + 1, -4).toLowerCase(); (idx.byBase.get(b) || idx.byBase.set(b, []).get(b)).push(f); }
      try {
        const c = JSON.parse(await read('composer.json')); const maps = { ...(c.autoload || {})['psr-4'], ...(c['autoload-dev'] || {})['psr-4'] };
        const list = Object.entries(maps).flatMap(([prefix, dirs]) => [].concat(dirs).map((d) => ({ prefix, dir: norm(String(d)).replace(/^\.\//, '').replace(/\/?$/, '/') })));
        if (list.length) idx.psr4 = list.sort((a, b) => b.prefix.length - a.prefix.length);
      } catch { /* no composer.json: keep the App\ default */ }
    })().catch(() => {}).finally(() => { idx.loading = null; });
    return idx.loading;
  }
  const fresh = () => { if (idx.root !== S.root || Date.now() - idx.at > 20000) refresh(); };
  const exists = (rel) => (idx.set.has(rel) ? rel : idx.lower.get(rel.toLowerCase()) || null);
  const firstExisting = (list) => { for (const p of list) { const r = exists(p); if (r) return r; } return null; };

  // ---- resolvers: name -> project-relative path -----------------------------------------------------
  const viewRel = (name) => { if (name.includes('::')) return null; const p = 'resources/views/' + name.replace(/\./g, '/'); return firstExisting([p + '.blade.php', p + '.php', p + '/index.blade.php']); };
  const studly = (s) => s.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const componentRel = (tag) => {
    const parts = tag.split('.'); const kebab = parts.join('/'); const cls = parts.map(studly).join('/');
    return firstExisting([`resources/views/components/${kebab}.blade.php`, `resources/views/components/${kebab}/index.blade.php`, `app/View/Components/${cls}.php`]);
  };
  const configRel = (key) => exists(`config/${key.split('.')[0]}.php`);
  const assetRel = (s) => { s = norm(s).replace(/^\/+/, ''); return /^[\w./@-]+\.\w+$/.test(s) ? firstExisting([s, 'public/' + s, 'resources/' + s]) : null; };

  const parseUses = (text) => {
    const map = {}; const ns = (/^[ \t]*namespace\s+([\w\\]+)\s*;/m.exec(text) || [])[1] || '';
    for (const m of text.matchAll(/^[ \t]*use\s+([\w\\]+?)(?:\\\{([^}]+)\})?(?:\s+as\s+(\w+))?\s*;/gm)) {
      if (m[2]) { for (const part of m[2].split(',')) { const [n, a] = part.trim().split(/\s+as\s+/i); if (n) map[a || n.split('\\').pop()] = m[1] + '\\' + n; } }
      else if (m[1].includes('\\')) map[m[3] || m[1].split('\\').pop()] = m[1];      // skips `use SomeTrait;` inside classes
    }
    return { ns, map };
  };
  // Class name as written in `text` (short, relative or \-qualified) -> project-relative .php path
  function classRel(name, text) {
    name = name.replace(/\\\\/g, '\\');
    const { ns, map } = parseUses(text || '');
    const cands = [];
    if (name.startsWith('\\')) cands.push(name.slice(1));
    else { const first = name.split('\\')[0]; if (map[first]) cands.push(map[first] + name.slice(first.length)); if (ns) cands.push(ns + '\\' + name); cands.push(name); }
    for (const fqn of cands) for (const { prefix, dir } of idx.psr4) if (fqn.startsWith(prefix)) { const r = exists(dir + fqn.slice(prefix.length).replace(/\\/g, '/') + '.php'); if (r) return r; }
    const last = name.split('\\').pop().toLowerCase(), hits = idx.byBase.get(last) || [];      // not PSR-4 mapped: unique basename match
    return hits.length === 1 ? hits[0] : hits.find((p) => p.startsWith('app/')) || null;
  }

  // ---- locating the line inside the target file ------------------------------------------------------
  const lineOf = (text, index) => text.slice(0, index).split('\n').length;
  const classLine = (text, name) => { const m = new RegExp('^[ \\t]*(?:(?:abstract|final|readonly)\\s+)*(?:class|interface|trait|enum)\\s+' + name + '\\b', 'm').exec(text); return m ? lineOf(text, m.index) : 1; };
  const memberLine = (text, member) => {
    for (const re of [new RegExp('function\\s+&?' + member + '\\s*\\('), new RegExp('\\bconst\\s+' + member + '\\b'), new RegExp('\\$' + member + '\\b\\s*[;=]')]) { const m = re.exec(text); if (m) return lineOf(text, m.index); }
    return 0;
  };
  async function locateMember(rel, member, depth = 0) {
    const text = await read(rel); const line = memberLine(text, member); if (line) return { rel, line };
    const ex = depth < 4 && /\bextends\s+([\\\w]+)/.exec(text); const up = ex && classRel(ex[1], text);
    return up ? locateMember(up, member, depth + 1) : null;
  }
  async function locateClass(rel) { return { rel, line: classLine(await read(rel), rel.slice(rel.lastIndexOf('/') + 1, -4)) }; }
  async function locateKey(rel, key) {                 // config('app.name') -> the 'name' line in config/app.php
    const text = await read(rel); const last = key.split('.').pop(); const m = new RegExp('[\'"]' + last.replace(/[^\w-]/g, '') + '[\'"]\\s*=>').exec(text);
    return { rel, line: m ? lineOf(text, m.index) : 1 };
  }
  async function locateRoute(name) {
    for (const f of [...idx.set].filter((p) => /^routes\/[^/]+\.php$/.test(p))) {
      const text = await read(f); const m = new RegExp('->name\\(\\s*[\'"]' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]').exec(text);
      if (m) return { rel: f, line: lineOf(text, m.index) };
    }
    return null;
  }

  // ---- what is under the cursor -----------------------------------------------------------------------
  const VIEW_CTX = /(?:\bview|View::\w+|->view|->markdown|->layout|@extends|@include\w*|@each|@component|Route::view|Mail::markdown)\s*\(\s*(?:[^()]*,\s*)?$/;
  function stringTarget(line, i, text) {
    for (const m of line.matchAll(/(['"])((?:\\.|(?!\1).)*?)\1/g)) {
      const open = m.index, close = m.index + m[0].length - 1;
      if (i < open + 1 || i > close) continue;
      const s = m[2], before = line.slice(0, open), range = { start: open + 2, end: close + 1 };
      let t = null; const cm = /([\\\w]+)::class\s*,\s*$/.exec(before);
      if (cm && /^\w+$/.test(s)) { const r = classRel(cm[1], text); t = r && { rel: r, go: async () => (await locateMember(r, s)) || locateClass(r) }; }
      else if (VIEW_CTX.test(before)) { const r = viewRel(s); t = r && { rel: r, go: async () => ({ rel: r, line: 1 }) }; }
      else if (/\bconfig\s*\(\s*$/.test(before)) { const r = configRel(s); t = r && { rel: r, go: () => locateKey(r, s) }; }
      else if (/(?:\broute|->route|->routeIs|->named)\s*\(\s*$/.test(before)) t = { rel: null, go: () => locateRoute(s) };
      else if (/^\\?[A-Za-z_][\w\\]*(?:@\w+)?$/.test(s.replace(/\\\\/g, '\\')) && /[\\@]/.test(s)) {
        const [cls, member] = s.split('@'); const r = classRel(cls, text); t = r && { rel: r, go: async () => (member && (await locateMember(r, member))) || locateClass(r) };
      }
      if (!t) { const r = assetRel(s); t = r && { rel: r, go: async () => ({ rel: r, line: 1 }) }; }
      return t && { ...t, ...range };
    }
    return undefined;           // not inside a string
  }
  function findTarget(model, pos) {
    const line = model.getLineContent(pos.lineNumber), i = pos.column - 1, text = model.getValue();
    const st = stringTarget(line, i, text); if (st !== undefined) return st && { ...st, line: pos.lineNumber };
    for (const m of line.matchAll(/<\/?x-([\w.:-]+)/g)) {            // Blade component tags
      const s = m.index + m[0].indexOf('x-'); const e = m.index + m[0].length;
      if (i >= s && i <= e) { const r = componentRel(m[1].replace(/:/g, '.')); return r && { rel: r, line: pos.lineNumber, start: s + 1, end: e + 1, go: async () => ({ rel: r, line: 1 }) }; }
    }
    for (const m of line.matchAll(/\\?[A-Za-z_]\w*(?:\\[A-Za-z_]\w*)*/g)) {
      const start = m.index, end = start + m[0].length; if (i < start || i > end) continue;
      const word = m[0], before = line.slice(0, start), range = { line: pos.lineNumber, start: start + 1, end: end + 1 };
      const sm = /([\\\w]+)::\$?$/.exec(before);
      if (sm || /\$this->$/.test(before)) {                         // Class::member, $this->member
        const owner = sm ? sm[1] : null; let rel = null;
        if (!owner || owner === 'self' || owner === 'static') rel = model.uri.fsPath && relOf(model.uri.fsPath);
        else if (owner === 'parent') { const ex = /\bextends\s+([\\\w]+)/.exec(text); rel = ex && classRel(ex[1], text); }
        else rel = classRel(owner, text);
        return rel && { ...range, rel, go: async () => (await locateMember(rel, word)) || locateClass(rel) };
      }
      if (!/^[A-Z]/.test(word.split('\\').pop())) return null;
      const rel = classRel(word, text);
      return rel && { ...range, rel, go: () => locateClass(rel) };
    }
    return null;
  }
  const relOf = (p) => { const r = norm(p), root = norm(S.root || '').replace(/\/$/, '') + '/'; return r.toLowerCase().startsWith(root.toLowerCase()) ? exists(r.slice(root.length)) : null; };

  async function go(t) {
    const dest = await t.go();
    if (!dest) return CF.toast('Not found in this project', true);
    CF.openFile(abs(dest.rel), { line: dest.line || 1, col: 1 });
  }

  // ---- migration completions ----------------------------------------------------------------------------------
  // [name, snippet body, doc]. Suggested inside database/migrations files (or any file using Blueprint).
  const COLUMNS = [
    ['id', 'id()', 'Auto-incrementing BIGINT primary key'], ['string', "string('${1:name}')", 'VARCHAR column'], ['text', "text('${1:name}')", 'TEXT column'],
    ['longText', "longText('${1:name}')", 'LONGTEXT column'], ['mediumText', "mediumText('${1:name}')", 'MEDIUMTEXT column'], ['tinyText', "tinyText('${1:name}')", 'TINYTEXT column'],
    ['char', "char('${1:name}', ${2:100})", 'CHAR column'], ['integer', "integer('${1:name}')", 'INTEGER column'], ['bigInteger', "bigInteger('${1:name}')", 'BIGINT column'],
    ['unsignedBigInteger', "unsignedBigInteger('${1:name}')", 'UNSIGNED BIGINT column'], ['unsignedInteger', "unsignedInteger('${1:name}')", 'UNSIGNED INTEGER column'],
    ['mediumInteger', "mediumInteger('${1:name}')", 'MEDIUMINT column'], ['smallInteger', "smallInteger('${1:name}')", 'SMALLINT column'], ['tinyInteger', "tinyInteger('${1:name}')", 'TINYINT column'],
    ['unsignedSmallInteger', "unsignedSmallInteger('${1:name}')", 'UNSIGNED SMALLINT column'], ['unsignedTinyInteger', "unsignedTinyInteger('${1:name}')", 'UNSIGNED TINYINT column'],
    ['increments', "increments('${1:id}')", 'Auto-incrementing UNSIGNED INTEGER primary key'], ['bigIncrements', "bigIncrements('${1:id}')", 'Auto-incrementing UNSIGNED BIGINT primary key'],
    ['boolean', "boolean('${1:name}')", 'BOOLEAN column'], ['decimal', "decimal('${1:name}', ${2:8}, ${3:2})", 'DECIMAL column (precision, scale)'],
    ['float', "float('${1:name}')", 'FLOAT column'], ['double', "double('${1:name}')", 'DOUBLE column'], ['date', "date('${1:name}')", 'DATE column'],
    ['dateTime', "dateTime('${1:name}')", 'DATETIME column'], ['dateTimeTz', "dateTimeTz('${1:name}')", 'DATETIME with timezone'], ['time', "time('${1:name}')", 'TIME column'],
    ['timestamp', "timestamp('${1:name}')", 'TIMESTAMP column'], ['timestampTz', "timestampTz('${1:name}')", 'TIMESTAMP with timezone'], ['year', "year('${1:name}')", 'YEAR column'],
    ['timestamps', 'timestamps()', 'created_at and updated_at'], ['timestampsTz', 'timestampsTz()', 'created_at and updated_at with timezone'], ['nullableTimestamps', 'nullableTimestamps()', 'Nullable created_at and updated_at'],
    ['softDeletes', 'softDeletes()', 'Nullable deleted_at'], ['softDeletesTz', 'softDeletesTz()', 'Nullable deleted_at with timezone'], ['rememberToken', 'rememberToken()', 'Nullable remember_token VARCHAR(100)'],
    ['json', "json('${1:name}')", 'JSON column'], ['jsonb', "jsonb('${1:name}')", 'JSONB column'], ['uuid', "uuid('${1:name}')", 'UUID column'], ['ulid', "ulid('${1:name}')", 'ULID column'],
    ['enum', "enum('${1:name}', ['${2:one}', '${3:two}'])", 'ENUM column'], ['set', "set('${1:name}', ['${2:one}', '${3:two}'])", 'SET column'], ['binary', "binary('${1:name}')", 'BLOB column'],
    ['ipAddress', "ipAddress('${1:ip_address}')", 'IP address column'], ['macAddress', "macAddress('${1:mac_address}')", 'MAC address column'],
    ['foreignId', "foreignId('${1:user_id}')", 'UNSIGNED BIGINT for a foreign key'], ['foreignIdFor', 'foreignIdFor(${1:User}::class)', 'Foreign key column from a model class'],
    ['foreignUuid', "foreignUuid('${1:user_id}')", 'UUID foreign key column'], ['foreignUlid', "foreignUlid('${1:user_id}')", 'ULID foreign key column'],
    ['morphs', "morphs('${1:taggable}')", '{name}_id and {name}_type with index'], ['nullableMorphs', "nullableMorphs('${1:taggable}')", 'Nullable morph columns'],
    ['uuidMorphs', "uuidMorphs('${1:taggable}')", 'UUID morph columns'], ['ulidMorphs', "ulidMorphs('${1:taggable}')", 'ULID morph columns'],
    ['geometry', "geometry('${1:name}')", 'GEOMETRY column'], ['point', "point('${1:name}')", 'POINT column'],
  ];
  const TABLE_OPS = [
    ['primary', "primary(['${1:id}'])", 'Add a primary key'], ['unique', "unique('${1:column}')", 'Add a unique index'], ['index', "index('${1:column}')", 'Add an index'],
    ['fullText', "fullText('${1:column}')", 'Add a full-text index'], ['spatialIndex', "spatialIndex('${1:column}')", 'Add a spatial index'],
    ['foreign', "foreign('${1:user_id}')->references('${2:id}')->on('${3:users}')", 'Add a foreign key constraint'],
    ['dropColumn', "dropColumn('${1:column}')", 'Drop a column'], ['renameColumn', "renameColumn('${1:from}', '${2:to}')", 'Rename a column'],
    ['dropIndex', "dropIndex('${1:index}')", 'Drop an index'], ['dropUnique', "dropUnique('${1:index}')", 'Drop a unique index'], ['dropPrimary', 'dropPrimary()', 'Drop the primary key'],
    ['dropForeign', "dropForeign(['${1:user_id}'])", 'Drop a foreign key'], ['dropConstrainedForeignId', "dropConstrainedForeignId('${1:user_id}')", 'Drop a foreign key and its column'],
    ['dropTimestamps', 'dropTimestamps()', 'Drop created_at and updated_at'], ['dropSoftDeletes', 'dropSoftDeletes()', 'Drop deleted_at'], ['dropRememberToken', 'dropRememberToken()', 'Drop remember_token'],
    ['dropMorphs', "dropMorphs('${1:taggable}')", 'Drop morph columns'], ['renameIndex', "renameIndex('${1:from}', '${2:to}')", 'Rename an index'],
    ['engine', "engine('${1:InnoDB}')", 'Table storage engine'], ['charset', "charset('${1:utf8mb4}')", 'Table character set'], ['collation', "collation('${1:utf8mb4_unicode_ci}')", 'Table collation'],
    ['comment', "comment('${1:text}')", 'Table comment'], ['temporary', 'temporary()', 'Temporary table'],
  ];
  const MODIFIERS = [
    ['nullable', 'nullable()', 'Allow NULL values'], ['default', 'default(${1:value})', 'Default value'], ['unique', 'unique()', 'Add a unique index'], ['index', 'index()', 'Add an index'],
    ['primary', 'primary()', 'Add a primary key'], ['unsigned', 'unsigned()', 'Set an integer column as UNSIGNED'], ['after', "after('${1:column}')", 'Place the column after another (MySQL)'],
    ['first', 'first()', 'Place the column first (MySQL)'], ['comment', "comment('${1:text}')", 'Column comment'], ['useCurrent', 'useCurrent()', 'Default TIMESTAMP to CURRENT_TIMESTAMP'],
    ['useCurrentOnUpdate', 'useCurrentOnUpdate()', 'Set TIMESTAMP to CURRENT_TIMESTAMP on update'], ['autoIncrement', 'autoIncrement()', 'Auto-increment an integer column'],
    ['change', 'change()', 'Modify an existing column'], ['constrained', 'constrained()', 'Foreign key from the column name (user_id -> users.id)'],
    ['references', "references('${1:id}')->on('${2:table}')", 'Foreign key target column and table'], ['on', "on('${1:table}')", 'Foreign key target table'],
    ['cascadeOnDelete', 'cascadeOnDelete()', 'ON DELETE CASCADE'], ['cascadeOnUpdate', 'cascadeOnUpdate()', 'ON UPDATE CASCADE'], ['nullOnDelete', 'nullOnDelete()', 'ON DELETE SET NULL'],
    ['restrictOnDelete', 'restrictOnDelete()', 'ON DELETE RESTRICT'], ['restrictOnUpdate', 'restrictOnUpdate()', 'ON UPDATE RESTRICT'], ['noActionOnDelete', 'noActionOnDelete()', 'ON DELETE NO ACTION'],
    ['onDelete', "onDelete('${1:cascade}')", 'ON DELETE action'], ['onUpdate', "onUpdate('${1:cascade}')", 'ON UPDATE action'],
    ['storedAs', "storedAs('${1:expression}')", 'Stored generated column'], ['virtualAs', "virtualAs('${1:expression}')", 'Virtual generated column'],
    ['charset', "charset('${1:utf8mb4}')", 'Column character set'], ['collation', "collation('${1:utf8mb4_unicode_ci}')", 'Column collation'], ['invisible', 'invisible()', 'Hide the column from SELECT *'],
    ['fulltext', 'fulltext()', 'Add a full-text index'],
  ];
  const SCHEMA = [
    ['create', "create('${1:table}', function (Blueprint \\$table) {\n\t\\$table->id();\n\t$0\n\t\\$table->timestamps();\n})", 'Create a new table'],
    ['table', "table('${1:table}', function (Blueprint \\$table) {\n\t$0\n})", 'Modify an existing table'], ['drop', "drop('${1:table}')", 'Drop a table'],
    ['dropIfExists', "dropIfExists('${1:table}')", 'Drop a table if it exists'], ['rename', "rename('${1:from}', '${2:to}')", 'Rename a table'],
    ['hasTable', "hasTable('${1:table}')", 'Does the table exist?'], ['hasColumn', "hasColumn('${1:table}', '${2:column}')", 'Does the column exist?'],
    ['hasColumns', "hasColumns('${1:table}', ['${2:column}'])", 'Do all the columns exist?'], ['getColumnListing', "getColumnListing('${1:table}')", 'List column names'],
    ['dropColumns', "dropColumns('${1:table}', ['${2:column}'])", 'Drop columns from a table'], ['disableForeignKeyConstraints', 'disableForeignKeyConstraints()', 'Turn off foreign key checks'],
    ['enableForeignKeyConstraints', 'enableForeignKeyConstraints()', 'Turn on foreign key checks'], ['withoutForeignKeyConstraints', 'withoutForeignKeyConstraints(function () {\n\t$0\n})', 'Run a callback without foreign key checks'],
    ['connection', "connection('${1:name}')", 'Use another database connection'],
  ];
  const MIGRATION_FILE = "<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n\tpublic function up(): void\n\t{\n\t\tSchema::create('${1:table}', function (Blueprint \\$table) {\n\t\t\t\\$table->id();\n\t\t\t$0\n\t\t\t\\$table->timestamps();\n\t\t});\n\t}\n\n\tpublic function down(): void\n\t{\n\t\tSchema::dropIfExists('${1:table}');\n\t}\n};\n";
  const COL_ARG = /->(after|dropColumn|dropIndex|dropUnique|index|unique|primary|fullText|renameColumn|foreign|dropForeign|dropConstrainedForeignId)\(\s*(?:\[\s*(?:['"][\w]+['"]\s*,\s*)*)?['"][\w]*$/;
  const isMigration = (model) => /[\\/]database[\\/]migrations[\\/]/i.test(model.uri.path) || /Illuminate\\Database\\Schema\\Blueprint|Blueprint\s+\$/.test(model.getValue());
  const SNIP = () => monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
  function migrationItems(model, pos) {
    const K = monaco.languages.CompletionItemKind, w = model.getWordUntilPosition(pos);
    const range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
    const upto = model.getLineContent(pos.lineNumber).slice(0, pos.column - 1), before = upto.slice(0, upto.length - w.word.length);
    const item = ([name, body, doc], kind, rank, detail) => ({ label: name, kind, insertText: body, insertTextRules: SNIP(), documentation: doc, detail, sortText: rank + name, range });
    if (COL_ARG.test(upto)) {                                   // inside a column-name string: offer the columns declared in this file
      const names = new Set(); for (const m of model.getValue().matchAll(/\$\w+->\w+\(\s*['"](\w+)['"]/g)) names.add(m[1]);
      return [...names].map((n) => ({ label: n, kind: K.Field, insertText: n, detail: 'column in this migration', sortText: '0' + n, range }));
    }
    if (/Schema::$/.test(before)) return SCHEMA.map((s) => item(s, K.Method, '0', 'Schema'));
    if (/(?:\)|^\s*)\s*->\s*$/.test(before)) return MODIFIERS.map((s) => item(s, K.Method, '0', 'Column modifier'));
    if (/\$(?!this\b)\w+->\s*$/.test(before)) return [...COLUMNS.map((s) => item(s, K.Method, '0', 'Column type')), ...TABLE_OPS.map((s) => item(s, K.Method, '1', 'Table operation'))];
    if (!before.trim()) {                                       // start of a statement
      const out = [['create', 'Schema::create'], ['table', 'Schema::table']].map(([n, label], i) => ({ label, kind: K.Snippet, insertText: 'Schema::' + SCHEMA[i][1] + ';', insertTextRules: SNIP(), documentation: SCHEMA[i][2], detail: 'Schema', sortText: '1' + label, range }));
      out.push({ label: 'Schema::dropIfExists', kind: K.Snippet, insertText: "Schema::dropIfExists('${1:table}');", insertTextRules: SNIP(), documentation: SCHEMA[3][2], detail: 'Schema', sortText: '1Schema::dropIfExists', range });
      if (model.getValue().trim().length < 6) out.push({ label: 'migration', kind: K.Snippet, insertText: MIGRATION_FILE, insertTextRules: SNIP(), documentation: 'Full migration class with up() and down()', detail: 'Laravel', sortText: '0migration', range: { startLineNumber: 1, endLineNumber: pos.lineNumber, startColumn: 1, endColumn: w.endColumn } });
      return out;
    }
    return [];
  }
  let migHooked = false;
  function hookMigrations() {
    if (migHooked) return; migHooked = true;
    monaco.languages.registerCompletionItemProvider('php', { triggerCharacters: ['>', ':', "'", '"'], provideCompletionItems: (model, pos) => {
      if (!enabled || !isMigration(model)) return { suggestions: [] };
      return { suggestions: migrationItems(model, pos) };
    } });
  }

  // ---- editor wiring ----------------------------------------------------------------------------------------
  const isTarget = (model) => !!model && (model.getLanguageId() === 'php' || (model.getLanguageId() === 'html' && /\.blade$|\.blade\.php$/i.test(model.uri.path)));
  const editors = new Map(); let enabled = false, hooked = false;
  function attach(ed) {
    if (editors.has(ed)) return;
    const deco = ed.createDecorationsCollection(), key = ed.createContextKey('cfLaravelNav', enabled);
    const hot = (e) => e.ctrlKey || e.metaKey;
    const clear = () => deco.clear();
    ed.onMouseMove((e) => {
      if (!enabled || !hot(e.event) || !e.target.position || !isTarget(ed.getModel())) return clear();
      fresh(); const t = findTarget(ed.getModel(), e.target.position);
      if (!t) return clear();
      deco.set([{ range: new monaco.Range(t.line, t.start, t.line, t.end), options: { inlineClassName: 'cf-nav-link' } }]);
    });
    ed.onMouseLeave(clear); ed.onKeyUp((e) => { if (e.keyCode === monaco.KeyCode.Ctrl || e.keyCode === monaco.KeyCode.Meta) clear(); }); ed.onDidChangeModel(clear);
    ed.onMouseDown((e) => {
      if (!enabled || !e.event.leftButton || !hot(e.event) || !e.target.position || !isTarget(ed.getModel())) return;
      const t = findTarget(ed.getModel(), e.target.position); if (!t) return;
      e.event.preventDefault(); e.event.stopPropagation(); clear(); CF.guard(go)(t);
    });
    ed.addAction({ id: 'cf.laravel.goto', label: 'Go to Laravel Definition', keybindings: [monaco.KeyCode.F12], precondition: 'cfLaravelNav && (editorLangId == php || editorLangId == html)',
      contextMenuGroupId: 'navigation', contextMenuOrder: 1.4, run: (x) => {
        const t = isTarget(x.getModel()) && findTarget(x.getModel(), x.getPosition());
        return t ? CF.guard(go)(t) : CF.toast('No Laravel definition under the cursor');
      } });
    editors.set(ed, { key, deco });
  }
  CF.laravelNav = {
    set(on) {
      enabled = !!on;
      if (enabled && !hooked) { hooked = true; monaco.editor.onDidCreateEditor(attach); hookMigrations(); }
      if (enabled) { monaco.editor.getEditors().forEach(attach); refresh(); }
      editors.forEach((v, ed) => { v.key.set(enabled); if (!enabled) v.deco.clear(); });
    },
  };
})();
