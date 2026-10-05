(async () => {
  const { S, $, $$ } = CF;
  S.platform = await cf.app.platform();
  S.settings = await cf.settings.get();
  CF.applyTheme(S.settings.theme);                   // CSS vars first, Monaco theme after load
  await CF.initMonaco();
  CF.initEditors(); CF.applySettings(); CF.initGitLens();
  CF.loadExtensions(true);                           // downloads URLs listed in settings.json "extensions", loads custom ones
  await CF.initTerminal();
  CF.bindMenu();

  $$('#activitybar [data-view]').forEach((b) => (b.onclick = () => CF.showView(b.dataset.view)));
  $$('#panel-tabs [data-panel]').forEach((b) => (b.onclick = () => CF.showPanel(b.dataset.panel)));
  $('#panel-close').onclick = CF.togglePanel; $('#panel-max').onclick = CF.toggleMaxPanel;
  $('#cmd-center').onclick = CF.palette;
  $('#sb-branch').onclick = () => CF.showView('git');
  $('#sb-problems').onclick = () => CF.showPanel('problems');
  $('#sb-font').onclick = CF.settingsDialog;
  monaco.editor.onDidChangeMarkers(() => CF.updateProblems());

  let chord = 0;
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') { chord = Date.now(); return; }
    if (chord && Date.now() - chord < 1500 && mod && e.key.toLowerCase() === 't') { e.preventDefault(); chord = 0; CF.themePicker(); }
  }, true);
  window.addEventListener('blur', () => { if (S.settings.autoSave === 'onWindowChange' || S.settings.autoSave === 'onFocusChange') CF.saveAll(); });

  cf.onOpenPath(async ({ root, file }) => { await CF.setRoot(root); if (file) CF.openFile(file); });
  CF.showView('explorer');

  // ---- session: reopen the last project, files and layout --------------------------------------
  const KEY = 'cf.session';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = () => {
    try {
      if (!S.root) return localStorage.setItem(KEY, JSON.stringify({ root: null }));
      const g = CF.activeGroup();
      localStorage.setItem(KEY, JSON.stringify({ root: S.root, files: [...new Set(S.groups.flatMap((x) => x.tabs))].filter((p) => p.startsWith(S.root)), active: g && g.active, split: S.groups.length > 1 ? (S.vertical ? 'down' : 'right') : null, panel: !$('#panel').classList.contains('hidden'), sidebar: S.settings.sidebar !== false }));
    } catch { /* storage unavailable */ }
  };
  CF.saveSession = save; setInterval(save, 1500); window.addEventListener('beforeunload', save);
  const sess = load(); let restored = false;
  if (sess && sess.root) {
    try {
      const root = await cf.ws.openRecent(sess.root);
      await CF.setRoot(root); restored = true;
      if (sess.split) CF.split(sess.split === 'down');
      for (const f of sess.files || []) await CF.openFile(f).catch(() => {});
      if (sess.active && (sess.files || []).includes(sess.active)) await CF.openFile(sess.active).catch(() => {});
      if (sess.panel === false) $('#panel').classList.add('hidden');
    } catch { /* folder moved or deleted: fall back to the welcome screen */ }
  }
  if (!restored) CF.renderWelcome();
  CF.updateProblems();
  if (S.settings.autoUpdate) setTimeout(() => CF.checkUpdates(false).catch(() => {}), 4000);   // silent when offline / signed out
})();
