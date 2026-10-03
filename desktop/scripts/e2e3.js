(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = (await cf.ws.recents())[0].path; await CF.setRoot(root); await sleep(1200);
  const hit = (sel) => { const e = document.querySelector(sel); if (!e) return 'missing ' + sel; const b = e.getBoundingClientRect(); const t = document.elementFromPoint(b.x + b.width / 2, b.y + Math.min(b.height / 2, 12)); return t && (e.contains(t) ? 'ok' : 'BLOCKED by #' + (t.id || t.className)); };
  return { tree: hit('.row-n'), searchBtn: hit('[data-view=search]'), term: hit('#panel-terminal .term'), editorArea: hit('#editor-area'), overlayDisplay: getComputedStyle(document.getElementById('overlay')).display, welcomeDisplay: getComputedStyle(document.getElementById('welcome')).display };
})()
