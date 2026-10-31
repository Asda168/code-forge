// Runs INSIDE the renderer (injected by scripts/ui-audit.js at every window size / theme). Returns { issues: [...], info: {...} }.
// Checks: page overflow, clipped/overlapping bar children, elements outside the window, overlays (menu, palette, dialog, settings) fully inside the viewport,
// and that the editor / panel / sidebar keep usable sizes.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const root = (await cf.ws.recents())[0].path;
  if (CF.S.root !== root) { await CF.setRoot(root); await sleep(700); }
  if (!window.__auditOpen) { window.__auditOpen = 1; for (const f of ['f1.txt', 'f2.txt', 'f3.txt', 'x.txt']) { try { await CF.openFile(root + '\\' + f); } catch (e) { /* optional */ } } await sleep(300); }
  const W = innerWidth, H = innerHeight, issues = [], info = {};
  const sel = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
  const rectOf = (e) => e.getBoundingClientRect();
  const vis = (e) => { const r = rectOf(e); if (!r.width || !r.height) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const clippedByAncestor = (e) => { const b = rectOf(e); for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { if (/(hidden|auto|scroll|clip)/.test(getComputedStyle(p).overflowX + getComputedStyle(p).overflowY)) { const r = rectOf(p); if (b.right > r.right + 1 || b.bottom > r.bottom + 1 || b.left < r.left - 1) return true; } } return false; };
  const inside = (name, e) => { if (!e || !vis(e)) return issues.push(`${name}: not visible`); const r = rectOf(e); if (r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5) issues.push(`${name}: outside viewport (${[r.left, r.top, r.right, r.bottom].map(Math.round)} in ${W}x${H})`); };
  const pass = (label) => {
    const de = document.documentElement;
    if (de.scrollWidth > W || de.scrollHeight > H) issues.push(`${label}: document scrolls (${de.scrollWidth}x${de.scrollHeight} in ${W}x${H})`);
    for (const e of qa('body *')) {
      if (!vis(e) || e.closest('.monaco-editor, .xterm, svg, #ctx, .toast, [hidden], .monaco-aria-container, .monaco-hover, .overflow-guard, .scm-scroll, .scm-dock, #tree, #side-body')) continue;
      const r = rectOf(e);
      if ((r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) && !clippedByAncestor(e)) issues.push(`${label}: ${sel(e)} outside window (${[r.left, r.top, r.right, r.bottom].map(Math.round)})`);
    }
    for (const id of ['#topbar', '#statusbar', '#panel-tabs', '#side-title']) {
      const e = q(id); if (!e) continue; const pr = rectOf(e);
      const kids = [...e.children].filter(vis).map((c) => ({ c, r: rectOf(c) }));
      kids.forEach(({ c, r }) => { if (r.right > pr.right + 1 || r.left < pr.left - 1) issues.push(`${label}: ${id} child ${sel(c)} sticks out`); });
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i].r, b = kids[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) issues.push(`${label}: ${id} ${sel(kids[i].c)} overlaps ${sel(kids[j].c)}`); }
    }
    const ed = q('#editor-area'), pn = q('#panel'), sb = q('#sidebar');
    if (ed && pn && !pn.classList.contains('hidden') && !pn.classList.contains('max') && rectOf(ed).height < 110) issues.push(`${label}: editor only ${Math.round(rectOf(ed).height)}px tall`);
    if (sb && vis(sb) && rectOf(sb).width < 150) issues.push(`${label}: sidebar only ${Math.round(rectOf(sb).width)}px wide`);
  };
  // 1. every sidebar view
  for (const v of ['explorer', 'search', 'git', 'gitlens', 'run', 'extensions']) { q(`[data-view=${v}]`).click(); await sleep(500); pass('view:' + v); }
  // 2. source control: footer tabs / dock, fixed regions
  q('[data-view=git]').click(); await sleep(700);
  { const t = q('.ft-tab'); if (t) { t.click(); await sleep(350); pass('git-dock'); const f = q('.scm-foot'), s = q('.scm'); if (f && s && Math.abs(rectOf(f).bottom - rectOf(s).bottom) > 1) issues.push('git: footer not at bottom of panel'); const sc = q('.scm-scroll'); if (sc && rectOf(sc).height < 40) issues.push('git: changes list only ' + Math.round(rectOf(sc).height) + 'px'); t.click(); await sleep(250); } }
  // 3. overlays near the bottom-right corner
  { const items = Array.from({ length: 14 }, (_, i) => ['Item ' + i, () => {}]); CF.menu({ clientX: W - 4, clientY: H - 4 }, items); await sleep(80); inside('context menu', q('#ctx')); q('#ctx').hidden = true; }
  { CF.palette(); await sleep(300); const p = q('.palette'); inside('palette', p); CF.closeOverlay(); await sleep(100); }
  { const p = CF.ask('Audit', [{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }, { id: 'c', label: 'Three' }]); await sleep(300); inside('dialog', q('.dlg')); const d = q('.dlg'); if (d && d.scrollWidth > d.clientWidth + 1) issues.push('dialog scrolls horizontally'); CF.closeOverlay(); await Promise.race([p, sleep(200)]); }
  // 4. settings tab
  { await CF.openFile('settings://main'); await sleep(700); const pg = q('.page, #groups .page, [class*="settings"]'); const g = q('#groups'); pass('settings'); const pgs = qa('#groups *').filter((e) => e.scrollWidth > e.clientWidth + 2 && /visible/.test(getComputedStyle(e).overflowX) && vis(e) && !e.closest('.monaco-editor, .tabs, .xterm') && e.children.length === 0 && e.textContent.trim()).slice(0, 4).map(sel); if (pgs.length) issues.push('settings: text overflow in ' + pgs.join(', ')); }
  info.vp = W + 'x' + H; info.editorH = Math.round(rectOf(q('#editor-area')).height); info.panelH = Math.round(rectOf(q('#panel')).height); info.sidebarW = Math.round(rectOf(q('#sidebar')).width);
  q('[data-view=git]').click(); await sleep(500);
  return { issues: [...new Set(issues)], info };
})()
