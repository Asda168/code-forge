// Merge-conflict resolution, in the style of VS Code / Antigravity:
//  - conflict blocks are highlighted (current / incoming / base) and get inline actions above them
//    (Accept Current Change | Accept Incoming Change | Accept Both Changes | Compare Changes)
//  - a floating bar in the editor shows "N conflicts" with Accept All Current / Incoming / Both and Mark as Resolved
//  - Source Control lists conflicted files under "Merge Changes" (see git.js)
// Everything edits the Monaco model with undoable edits; "Mark as Resolved" saves and stages the file.
(() => {
  const { S, $, h } = CF;
  const OPEN = /^<{7}(?: |$)/, BASE = /^\|{7}(?: |$)/, MID = /^={7}$/, CLOSE = /^>{7}(?: |$)/;

  // ---- parsing ---------------------------------------------------------------------------------------------------------
  // Returns [{ start, base, mid, end, curLabel, incLabel }] with 1-based line numbers (base = 0 without diff3).
  CF.conflictRegions = (model) => {
    const out = [], n = model.getLineCount();
    for (let i = 1; i <= n; i++) {
      if (!OPEN.test(model.getLineContent(i))) continue;
      const r = { start: i, base: 0, mid: 0, end: 0 };
      for (let j = i + 1; j <= n; j++) {
        const t = model.getLineContent(j);
        if (OPEN.test(t)) break;                                   // unterminated block: not a conflict we can resolve safely
        if (BASE.test(t) && !r.mid) r.base = j;
        else if (MID.test(t) && !r.mid) r.mid = j;
        else if (CLOSE.test(t) && r.mid) { r.end = j; break; }
      }
      if (r.mid && r.end) {
        r.curLabel = model.getLineContent(r.start).slice(8).trim(); r.incLabel = model.getLineContent(r.end).slice(8).trim();
        out.push(r); i = r.end;
      }
    }
    return out;
  };
  const textOf = (model, from, to) => { const a = []; for (let i = from; i <= to; i++) a.push(model.getLineContent(i)); return a; };
  const parts = (model, r) => ({ current: textOf(model, r.start + 1, (r.base || r.mid) - 1), incoming: textOf(model, r.mid + 1, r.end - 1), base: r.base ? textOf(model, r.base + 1, r.mid - 1) : [] });

  // The edit that replaces one whole conflict block (marker lines included) with `lines`.
  const editFor = (model, r, lines) => {
    const n = model.getLineCount();
    if (!lines.length) return { range: r.end < n ? new monaco.Range(r.start, 1, r.end + 1, 1) : new monaco.Range(r.start, 1, r.end, model.getLineMaxColumn(r.end)), text: '' };
    return { range: new monaco.Range(r.start, 1, r.end, model.getLineMaxColumn(r.end)), text: lines.join('\n') };
  };
  const editorFor = (model) => monaco.editor.getEditors().find((e) => e.getModel() === model);
  const apply = (model, edits) => {
    const ed = editorFor(model);
    if (ed) ed.executeEdits('cf-conflict', edits); else model.pushEditOperations([], edits, () => null);
  };
  const pick = (kind, p) => (kind === 'current' ? p.current : kind === 'incoming' ? p.incoming : [...p.current, ...p.incoming]);

  CF.resolveConflict = (model, index, kind) => {
    const regs = CF.conflictRegions(model), r = regs[index];
    if (!r) return;
    apply(model, [editFor(model, r, pick(kind, parts(model, r)))]);
  };
  CF.resolveAllConflicts = (model, kind) => {
    const regs = CF.conflictRegions(model);
    if (!regs.length) return 0;
    apply(model, regs.slice().reverse().map((r) => editFor(model, r, pick(kind, parts(model, r)))));   // bottom-up keeps line numbers valid
    return regs.length;
  };

  // ---- compare: current vs incoming side by side ----------------------------------------------------------------------
  const compare = (model, index) => {
    const r = CF.conflictRegions(model)[index]; if (!r) return;
    const p = parts(model, r), host = h('div', { style: 'height:340px;border:1px solid var(--border);border-radius:6px;overflow:hidden' });
    CF.modal('Compare Changes', [h('div', { class: 'muted', style: 'display:flex;justify-content:space-between;margin-bottom:6px' },
      h('span', {}, 'Current Change' + (r.curLabel ? ` (${r.curLabel})` : '')), h('span', {}, 'Incoming Change' + (r.incLabel ? ` (${r.incLabel})` : ''))), host], [
      { label: 'Accept Current', cls: 'sec', run: () => { done(); CF.resolveConflict(model, index, 'current'); } },
      { label: 'Accept Incoming', cls: 'sec', run: () => { done(); CF.resolveConflict(model, index, 'incoming'); } },
      { label: 'Accept Both', cls: 'sec', run: () => { done(); CF.resolveConflict(model, index, 'both'); } },
      { label: 'Close', run: () => done() }], { wide: true });
    const lang = model.getLanguageId();
    const orig = monaco.editor.createModel(p.current.join('\n'), lang), mod = monaco.editor.createModel(p.incoming.join('\n'), lang);
    const ed = monaco.editor.createDiffEditor(host, { readOnly: true, renderSideBySide: true, automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false });
    ed.setModel({ original: orig, modified: mod });
    const done = () => { try { ed.dispose(); orig.dispose(); mod.dispose(); } catch { /* already gone */ } CF.closeOverlay(); };
  };

  // ---- mark as resolved: save + git add ---------------------------------------------------------------------------------
  CF.markResolved = CF.guard(async (path) => {
    const m = S.models.get(path);
    if (m && CF.conflictRegions(m.model).length) {
      if (!(await CF.confirm('This file still contains conflict markers. Mark it as resolved anyway?', 'Mark as resolved'))) return;
    }
    if (m && m.dirty) await CF.save(path);
    const r = await cf.git.run(S.root, ['add', '--', rel(path)]);
    if (r.code !== 0) throw new Error((r.stderr || 'git add failed').trim());
    CF.toast('Marked as resolved: ' + base(path));
    CF.gitRefresh && CF.gitRefresh();
  });

  // ---- editor integration -------------------------------------------------------------------------------------------------
  const decos = new WeakMap();               // model -> decoration ids
  const decorate = (model) => {
    const ds = [];
    const line = (a, b, cls, over) => { if (b >= a) ds.push({ range: new monaco.Range(a, 1, b, 1), options: { isWholeLine: true, className: cls, ...(over ? { overviewRuler: { color: over, position: monaco.editor.OverviewRulerLane.Full } } : {}) } }); };
    for (const r of CF.conflictRegions(model)) {
      line(r.start, r.start, 'cf-c-head cf-c-cur', '#40c8ae');
      line(r.start + 1, (r.base || r.mid) - 1, 'cf-c-cur');
      if (r.base) { line(r.base, r.base, 'cf-c-mark'); line(r.base + 1, r.mid - 1, 'cf-c-base'); }
      line(r.mid, r.mid, 'cf-c-mark');
      line(r.mid + 1, r.end - 1, 'cf-c-inc');
      line(r.end, r.end, 'cf-c-head cf-c-inc', '#40a6ff');
    }
    decos.set(model, model.deltaDecorations(decos.get(model) || [], ds));
  };

  // floating "N conflicts" bar, one per editor
  const attachBar = (ed) => {
    if (ed.__cfBar) return; ed.__cfBar = true;
    const bar = h('div', { class: 'cf-bar', role: 'toolbar', 'aria-label': 'Merge conflicts', hidden: true });
    const label = h('span', { class: 'cf-count' });
    const mk = (t, tip, fn) => h('button', { type: 'button', class: 'cf-btn', title: tip, onclick: () => fn() }, t);
    const model = () => ed.getModel();
    bar.append(label,
      mk('Accept All Current', 'Keep your side of every conflict in this file', () => model() && CF.resolveAllConflicts(model(), 'current')),
      mk('Accept All Incoming', 'Take the incoming side of every conflict', () => model() && CF.resolveAllConflicts(model(), 'incoming')),
      mk('Accept Both', 'Keep both sides of every conflict', () => model() && CF.resolveAllConflicts(model(), 'both')),
      mk('Mark as Resolved', 'Save and stage this file', () => { const m = model(); const e = m && [...S.models.values()].find((x) => x.model === m); if (e) CF.markResolved(e.path); }));
    const widget = { getId: () => 'cf.conflict.bar', getDomNode: () => bar, getPosition: () => ({ preference: monaco.editor.OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER }) };
    ed.addOverlayWidget(widget);
    const refresh = () => {
      const m = model(); const n = m ? CF.conflictRegions(m).length : 0;
      bar.hidden = !n; label.textContent = n ? `${n} merge conflict${n === 1 ? '' : 's'}` : '';
      if (m) decorate(m);
    };
    ed.onDidChangeModel(refresh); ed.onDidChangeModelContent(refresh); refresh();
  };

  CF.initConflicts = () => {
    if (CF.__conflictsReady || !window.monaco) return; CF.__conflictsReady = true;
    const cmd = (id, fn) => monaco.editor.registerCommand(id, (_acc, uri, idx) => { const m = monaco.editor.getModel(monaco.Uri.parse(uri)); if (m) fn(m, idx); });
    cmd('cf.conflict.current', (m, i) => CF.resolveConflict(m, i, 'current'));
    cmd('cf.conflict.incoming', (m, i) => CF.resolveConflict(m, i, 'incoming'));
    cmd('cf.conflict.both', (m, i) => CF.resolveConflict(m, i, 'both'));
    cmd('cf.conflict.compare', (m, i) => compare(m, i));
    monaco.languages.registerCodeLensProvider('*', {
      provideCodeLenses(model) {
        const lenses = [];
        CF.conflictRegions(model).forEach((r, idx) => {
          const range = new monaco.Range(r.start, 1, r.start, 1), args = [model.uri.toString(), idx];
          [['Accept Current Change', 'cf.conflict.current'], ['Accept Incoming Change', 'cf.conflict.incoming'], ['Accept Both Changes', 'cf.conflict.both'], ['Compare Changes', 'cf.conflict.compare']]
            .forEach(([title, id]) => lenses.push({ range, command: { id, title, arguments: args } }));
        });
        return { lenses, dispose() {} };
      },
    });
    monaco.editor.onDidCreateEditor(attachBar);
    monaco.editor.getEditors().forEach(attachBar);
    monaco.editor.onDidCreateModel((m) => { decorate(m); m.onDidChangeContent(() => decorate(m)); });
    monaco.editor.getModels().forEach((m) => { decorate(m); m.onDidChangeContent(() => decorate(m)); });
  };
})();
