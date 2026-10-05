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
  // One session per project (keyed by root) plus the last project, so reopening any project
  // brings back its own files, split and panel state.
  const KEY = 'cf.session';
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.projects ? v : { last: null, projects: {} }; } catch { return { last: null, projects: {} }; } };
  let restoring = false;
  const save = () => {
    if (restoring) return;
    try {
      const all = load();
      if (!S.root) all.last = null;
      else {
        const g = CF.activeGroup();
        all.last = S.root;
        all.projects[S.root] = { files: [...new Set(S.groups.flatMap((x) => x.tabs))].filter((p) => p.startsWith(S.root)), active: g && g.active, split: S.groups.length > 1 ? (S.vertical ? 'down' : 'right') : null, panel: !$('#panel').classList.contains('hidden'), at: Date.now() };
        const keys = Object.keys(all.projects);                         // keep the 30 most recent
        if (keys.length > 30) keys.sort((a, b) => all.projects[b].at - all.projects[a].at).slice(30).forEach((k) => delete all.projects[k]);
      }
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* storage unavailable */ }
  };
  const restore = async (root) => {
    const sess = load().projects[root];
    if (!sess) return;
    if (sess.split) CF.split(sess.split === 'down');
    for (const f of sess.files || []) await CF.openFile(f).catch(() => {});
    if (sess.active && (sess.files || []).includes(sess.active)) await CF.openFile(sess.active).catch(() => {});
    $('#panel').classList.toggle('hidden', sess.panel === false);
  };
  const baseSetRoot = CF.setRoot;                                       // every project switch saves the old one and restores the new one
  CF.setRoot = async (root) => {
    save(); restoring = true;
    try { await baseSetRoot(root); await restore(root); } finally { restoring = false; save(); }
  };
  CF.saveSession = save; setInterval(save, 1500); window.addEventListener('beforeunload', save);
  let restored = false;
  const last = load().last;
  if (last) {
    try { await CF.setRoot(await cf.ws.openRecent(last)); restored = true; }
    catch { /* folder moved or deleted: fall back to the welcome screen */ }
  }
  if (!restored) CF.renderWelcome();
  CF.updateProblems();
  if (S.settings.autoUpdate) setTimeout(() => CF.checkUpdates(false).catch(() => {}), 4000);   // silent when offline / signed out
})();
