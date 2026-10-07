// Markdown preview pane (Ctrl+Shift+V): safe renderer (HTML is escaped, only http/https/mailto links), live-updates as you type.
(() => {
  const { S, $, h } = CF;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = (t) => {
    const codes = []; t = esc(t).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    t = t.replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img alt="$1" src="$2">')
      .replace(/\[([^\]]+)\]\(((?:https?:|mailto:|#)[^)\s]*)\)/g, '<a href="$2" data-href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<b>${a || b}</b>`).replace(/(^|[\s(])\*([^*\s][^*]*)\*|(^|[\s(])_([^_\s][^_]*)_/g, (_, p1, a, p2, b) => `${p1 || p2}<i>${a || b}</i>`)
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/(^|[\s(>])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, p, u) => `${p}<a href="${u}" data-href="${u}">${u}</a>`);
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  };
  CF.renderMarkdown = (src) => {
    const lines = src.replace(/\r\n?/g, '\n').split('\n'); const out = []; let i = 0;
    const isTable = (k) => lines[k] && lines[k].includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[k + 1] || '');
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    while (i < lines.length) {
      const l = lines[i]; let m;
      if ((m = l.match(/^\s*(```|~~~)\s*(\w*)/))) { const buf = []; i++; while (i < lines.length && !lines[i].trim().startsWith(m[1])) buf.push(lines[i++]); i++; out.push(`<pre data-lang="${esc(m[2] || '')}"><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
      if ((m = l.match(/^(#{1,6})\s+(.*?)\s*#*$/))) { out.push(`<h${m[1].length} id="${m[2].toLowerCase().replace(/<[^>]*>|[`*_~]/g, '').trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')}">${inline(m[2])}</h${m[1].length}>`); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (isTable(i)) { const head = cells(l); const al = cells(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:-/.test(c) ? 'left' : '')); i += 2; const rows = []; while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++])); out.push(`<table><thead><tr>${head.map((c, x) => `<th${al[x] ? ` style="text-align:${al[x]}"` : ''}>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, x) => `<td${al[x] ? ` style="text-align:${al[x]}"` : ''}>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
      if (/^\s*>/.test(l)) { const buf = []; while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*> ?/, '')); out.push(`<blockquote>${CF.renderMarkdown(buf.join('\n'))}</blockquote>`); continue; }
      if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
        const ord = /^\s*\d+\./.test(l); const items = [];
        while (i < lines.length && (/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) || (/^\s+\S/.test(lines[i]) && items.length))) {
          const mm = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
          if (mm) items.push({ ind: mm[1].replace(/\t/g, '    ').length, text: mm[3] }); else items[items.length - 1].text += ' ' + lines[i].trim(); i++;
        }
        const build = (from, ind) => { let s = `<${ord ? 'ol' : 'ul'}>`; let k = from; while (k < items.length && items[k].ind >= ind) { if (items[k].ind > ind) { const [sub, nk] = build(k, items[k].ind); s = s.replace(/<\/li>$/, sub + '</li>'); k = nk; continue; } let t = items[k].text; const task = t.match(/^\[([ xX])\]\s+(.*)/); if (task) t = `<input type="checkbox" disabled ${task[1] !== ' ' ? 'checked' : ''}> ${inline(task[2])}`; else t = inline(t); s += `<li${task ? ' class="task"' : ''}>${t}</li>`; k++; } return [s + `</${ord ? 'ol' : 'ul'}>`, k]; };
        out.push(build(0, items[0].ind)[0]); continue;
      }
      if (!l.trim()) { i++; continue; }
      const buf = []; while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s|>|([-*+]|\d+\.)\s)/.test(lines[i]) && !isTable(i)) buf.push(lines[i++]);
      out.push(`<p>${inline(buf.join('\n')).replace(/ {2,}\n|\\n/g, '<br>')}</p>`);
    }
    return out.join('\n');
  };

  let pane = null, timer = null, last = '', lastTop = -1;
  const area = () => $('#editor-area');
  const current = () => { const g = CF.activeGroup(); const m = g && g.active && S.models.get(g.active); return m && m.model ? { path: g.active, text: m.model.getValue() } : null; };
  const update = () => {
    if (!pane) return; const c = current();
    const key = c ? c.path + '\n' + c.text : '';
    if (key === last) return; last = key;
    $('#md-title', pane).textContent = c ? 'Preview: ' + CF.base(c.path) : 'Preview';
    const body = $('#md-body', pane); const top = body.scrollTop;
    if (c && /\.(html?|svg)$/i.test(c.path)) { body.classList.add('web'); let f = body.firstChild; if (!f || f.tagName !== 'IFRAME') { body.innerHTML = ''; f = h('iframe', { sandbox: '', class: 'web-frame' }); body.append(f); } f.srcdoc = /\.svg$/i.test(c.path) ? '<body style="margin:0;display:grid;place-items:center;background:#fff">' + c.text : c.text; return; }
    body.classList.remove('web');
    body.innerHTML = c && /\.(md|markdown|mdx)$/i.test(c.path) ? CF.renderMarkdown(c.text) : '<p class="muted">Open a Markdown, HTML or SVG file to preview it.</p>';
    body.scrollTop = top;
    if (window.monaco) body.querySelectorAll('pre[data-lang]').forEach((pre) => { const code = pre.firstChild, lang = pre.dataset.lang; if (!lang) return; const txt = code.textContent; monaco.editor.colorize(txt, ({ js: 'javascript', ts: 'typescript', sh: 'shell', bash: 'shell', zsh: 'shell', yml: 'yaml', py: 'python', rs: 'rust' })[lang] || lang, {}).then((html) => { if (code.isConnected && code.textContent === txt) code.innerHTML = html; }).catch(() => {}); });
  };
  const sync = () => {
    if (!pane) return; const g = CF.activeGroup(); const ed = g && g.editor; if (!ed || !ed.getScrollTop) return;
    const max = ed.getScrollHeight() - ed.getLayoutInfo().height; const t = ed.getScrollTop(); if (t === lastTop || max <= 0) return; lastTop = t;
    const b = $('#md-body', pane); if (b && !b.classList.contains('web') && !b.matches(':hover')) b.scrollTop = (t / max) * (b.scrollHeight - b.clientHeight);
  };
  CF.closeMdPreview = () => { if (!pane) return; clearInterval(timer); pane.remove(); pane = null; area().classList.remove('md-open', 'md-full'); area().style.removeProperty('--md-w'); CF.renderTabs && CF.renderTabs(); S.groups.forEach((g) => g.editor.layout()); };
  const toggleFull = () => { const f = area().classList.toggle('md-full'); pane.classList.toggle('full', f); const b = $('#md-full', pane); b.title = f ? 'Exit full screen' : 'Full screen'; b.replaceChildren(CF.icon(f ? 'restore' : 'maximize', 14)); if (!f) S.groups.forEach((g) => g.editor.layout()); };
  CF.mdOpen = () => !!pane;
  CF.toggleMdPreview = () => {
    if (pane) return CF.closeMdPreview();
    pane = h('div', { id: 'md-preview' }, h('div', { class: 'md-head' }, h('b', { id: 'md-title' }, 'Preview'), h('span', { class: 'grow' }), h('button', { class: 'icon-btn', id: 'md-full', title: 'Full screen', onclick: toggleFull }, CF.icon('maximize', 14)), h('button', { class: 'icon-btn', title: 'Close preview', onclick: CF.closeMdPreview }, CF.icon('close', 14))), h('div', { id: 'md-body', class: 'md-body' }));
    const grip = h('div', { class: 'md-grip', title: 'Drag to resize' }); pane.prepend(grip);
    grip.onmousedown = (e) => { e.preventDefault(); grip.classList.add('drag'); const a = area(), r = a.getBoundingClientRect(); pane.style.pointerEvents = 'none'; const mv = (ev) => { const w = Math.min(Math.max(r.right - ev.clientX, 240), r.width - 160); a.style.setProperty('--md-w', w + 'px'); S.groups.forEach((g) => g.editor.layout()); }; const up = () => { grip.classList.remove('drag'); pane.style.pointerEvents = ''; document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }; document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); };
    pane.addEventListener('dblclick', (e) => { if (e.target.closest('.md-head')) toggleFull(); });
    pane.addEventListener('click', (e) => { const pre = e.target.closest && e.target.closest('pre'); if (pre && e.target === pre) { const r = pre.getBoundingClientRect(); if (e.clientX > r.right - 70 && e.clientY < r.top + 28) { navigator.clipboard.writeText(pre.textContent); pre.classList.add('copied'); setTimeout(() => pre.classList.remove('copied'), 1200); return; } } const a = e.target.closest && e.target.closest('a[data-href]'); if (!a) return; e.preventDefault(); const u = a.dataset.href; if (u[0] === '#') { const t = pane.querySelector('[id="' + decodeURIComponent(u.slice(1)).replace(/"/g, '') + '"]'); if (t) t.scrollIntoView(); return; } if (/^https?:/.test(u)) cf.app.openExternal && cf.app.openExternal(u); });
    area().append(pane); area().classList.add('md-open'); last = ''; update(); timer = setInterval(() => { update(); sync(); }, 350); CF.renderTabs && CF.renderTabs();
    setTimeout(() => S.groups.forEach((g) => g.editor.layout()), 30);
  };
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyV' && !(e.target.closest && e.target.closest('.xterm'))) { e.preventDefault(); CF.toggleMdPreview(); } }, true);
})();
