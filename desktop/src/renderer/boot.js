(async () => {
  const { S, $, $$ } = CF;
  S.platform = await cf.app.platform();
  S.settings = await cf.settings.get();
  CF.applyTheme(S.settings.theme);                   // CSS vars first, Monaco theme after load
  await CF.initMonaco();
  CF.initEditors(); CF.applySettings();
  CF.loadExtensions(true);                           // downloads URLs listed in settings.json "extensions", loads custom ones
  await CF.initTerminal();
  CF.bindMenu();

  $$('#activitybar [data-view]').forEach((b) => (b.onclick = () => CF.showView(b.dataset.view)));
  $$('#panel-tabs [data-panel]').forEach((b) => (b.onclick = () => CF.showPanel(b.dataset.panel)));
  $('#panel-close').onclick = CF.togglePanel;
  $('#cmd-center').onclick = CF.palette;
  $('#sb-branch').onclick = () => CF.showView('git');
  $('#sb-problems').onclick = () => CF.showPanel('problems');
  $('#sb-font').onclick = CF.settingsDialog;
  monaco.editor.onDidChangeMarkers(() => CF.updateProblems());

  window.addEventListener('blur', () => { if (S.settings.autoSave === 'onWindowChange' || S.settings.autoSave === 'onFocusChange') CF.saveAll(); });

  cf.onOpenPath(async ({ root, file }) => { await CF.setRoot(root); if (file) CF.openFile(file); });
  CF.showView('explorer');
  CF.renderWelcome();
  CF.updateProblems();
  if (S.settings.autoUpdate) setTimeout(() => CF.checkUpdates(false).catch(() => {}), 4000);   // silent when offline / signed out
})();
