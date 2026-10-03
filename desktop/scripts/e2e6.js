(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = (await cf.ws.recents())[0].path; await CF.setRoot(root); await sleep(800);
  await CF.openFile(root + '\a.php'); await sleep(500);
  const R = { themes: Object.keys(CF.THEMES).length };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const bg = (sel) => getComputedStyle(document.querySelector(sel)).backgroundColor;
  R.applied = {};
  for (const id of ['vsc-dark-modern', 'vsc-light-modern', 'monokai', 'solarized-dark']) { await CF.setSetting({ theme: id }); await sleep(150); R.applied[id] = { bg: css('--bg'), statusbar: bg('#statusbar'), editorTheme: monaco.editor.getEditors ? 'ok' : '' }; }
  // import a JSONC VS Code theme
  const sample = `{ // comment\n "name": "My Test", "type": "dark",\n "colors": { "editor.background": "#101820", "sideBar.background": "#0c121a", "statusBar.background": "#c0392b", "foreground": "#e0e0e0", "focusBorder": "#f1c40f", },\n "tokenColors": [ { "scope": ["comment"], "settings": { "foreground": "#667788", "fontStyle": "italic" } }, { "scope": "string", "settings": { "foreground": "#ffcc00" } } ] }`;
  const m = CF.vscodeToManifest(sample, 'x');
  await cf.ext.saveManifest(m); await CF.loadExtensions(); await CF.setSetting({ theme: m.id + '.theme' }); await sleep(200);
  R.imported = { id: m.id, inThemes: !!CF.THEMES[m.id + '.theme'], bg: css('--bg'), status: bg('#statusbar'), accent: css('--accent'), rules: m.themes[0].rules.length };
  await cf.ext.uninstall(m.id); await CF.loadExtensions(); await CF.setSetting({ theme: 'vsc-dark-modern' });
  CF.themePicker(); await sleep(300); R.pickerItems = document.querySelectorAll('.palette .it').length; CF.closeOverlay();
  return R;
})()
