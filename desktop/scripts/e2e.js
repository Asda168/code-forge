(async () => {
  const R = {}; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = async (n, f) => { try { R[n] = (await f()) ?? 'ok'; } catch (e) { R[n] = 'ERR ' + (e && e.message); } };
  const root = (await cf.ws.recents())[0].path;
  await step('setRoot', async () => { await CF.setRoot(root); await sleep(800); return CF.T.flat.map((n) => n.name).join(','); });
  await step('createFile', async () => { await CF.newFile; const p = await cf.fs.createFile(root, 'new.js'); await CF.refreshTree(); await CF.openFile(p); return CF.T.flat.map((n) => n.name).join(','); });
  await step('editorModel', async () => { const g = CF.activeGroup(); return g.editor.getModel() ? g.editor.getModel().getLanguageId() : 'no model'; });
  await step('typeAndSave', async () => { const g = CF.activeGroup(); g.editor.setValue('const a = 1;\n'); await CF.save(); return (await cf.fs.read(root + '\\new.js')).text; });
  await step('openPhp', async () => { await CF.openFile(root + '\\a.php'); return CF.activeGroup().editor.getModel().getLanguageId(); });
  await step('terminal', async () => { const t = await CF.newTerminal(); await sleep(2500); cf.term.write(t.id, 'echo CF_OK\r'); await sleep(1500); const b = t.xterm.buffer.active; let txt = ''; for (let i = 0; i < b.length; i++) txt += (b.getLine(i)?.translateToString(true) || '') + '\n'; return { pty: !!(await cf.app.platform()).pty, hasOutput: txt.includes('CF_OK'), sample: txt.trim().slice(0, 200) }; });
  await step('git', async () => { await CF.gitRefresh(); return $('#sb-branch').textContent; });
  await step('search', async () => (await cf.fs.search(root, 'echo', {})).length);
  await step('runDetect', async () => cf.project.detect(root));
  await step('paletteOpen', async () => { CF.palette(); const n = document.querySelectorAll('.palette .it').length; CF.closeOverlay(); return n; });
  await step('settingsDialog', async () => { await CF.settingsDialog(); const ok = !!document.querySelector('.dlg.wide'); CF.closeOverlay(); return ok; });
  await step('layout', async () => { const r = (s) => { const e = document.querySelector(s); const b = e && e.getBoundingClientRect(); return b && [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { sidebar: r('#sidebar'), editor: r('#editor-area'), panel: r('#panel'), term: r('#panel-terminal'), status: r('#statusbar') }; });
  return R;
})()
